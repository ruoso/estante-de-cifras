-- 0001_registry.sql — the registry the one server keeps in Postgres.
--
-- Postgres holds identity and the book registry only: accounts, their
-- passkeys and signed-in devices (sessions), and each book's owner, members,
-- roles and invitations (DIRECTION §3.3 lines 184–185). Book content — songs,
-- setlists and all history — lives in the bare git repositories on the volume
-- (DIRECTION §3.3 lines 186–187, §3.5 lines 267–271); no song text, no commit
-- message and no working copy is ever stored here.
--
-- The invariants the downstream service tasks rely on are built in as
-- constraints, not left to application code: "no book without an account" is a
-- NOT NULL foreign key; one membership per person per book is a composite key;
-- an invitation's remaining uses can never go below zero is a CHECK. The owner
-- is books.owner_id — never a memberships row — so the fifty-member cap
-- (service.sharing) is a plain count of memberships and a book can never lack
-- an owner (refinement Decisions).
--
-- The enums match api/openapi.yaml exactly: a membership or invitation role is
-- InvitableRole (editor, reader); the owner role the members listing shows is
-- assembled from books.owner_id by the handler, never stored. An invitation's
-- expiry is ExpiryChoice (day, week, month, until-withdrawn).

-- book_role is api/openapi.yaml's InvitableRole (lines 840–843): the roles a
-- membership or an invitation may carry. The owner role (api Role, line 835)
-- is books.owner_id, not an enum value stored on a row.
CREATE TYPE book_role AS ENUM ('editor', 'reader');

-- invitation_expiry is api/openapi.yaml's ExpiryChoice (lines 1155–1158): the
-- expiry an owner chooses when making an invitation; the default is a week.
CREATE TYPE invitation_expiry AS ENUM ('day', 'week', 'month', 'until-withdrawn');

-- accounts — one per person. The id is the <user-id> of the authoring address
-- recorded in git history, <user-id>@users.estantedecifras.app (DIRECTION §3.3
-- lines 164–165); the real email is held only to mail the sign-in/recovery
-- link (workflow 13) and is unique when present. An invitee has no row until
-- they accept (workflow 10 lines 44–45), so email is nullable.
CREATE TABLE accounts (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email      text        UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- passkeys — several per account (workflow 13 line 73). The columns are the
-- WebAuthn credential go-webauthn stores; credential_id is unique across the
-- instance. A deleted account takes its credentials with it (cascade).
CREATE TABLE passkeys (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id       uuid        NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    credential_id    bytea       NOT NULL UNIQUE,
    public_key       bytea       NOT NULL,
    sign_count       bigint      NOT NULL DEFAULT 0,
    aaguid           bytea,
    transports       text[],
    backup_eligible  boolean     NOT NULL DEFAULT false,
    backup_state     boolean     NOT NULL DEFAULT false,
    label            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    last_used_at     timestamptz
);

-- sessions — one row per signed-in device (api Session, lines 946–962;
-- workflow 13 lines 69–72). Revocation sets revoked_at and is enforced lazily
-- at the device's next request; the service never deletes the row to sign out.
CREATE TABLE sessions (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   uuid        NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    device       text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz NOT NULL DEFAULT now(),
    revoked_at   timestamptz
);

-- books — the registry row for a bare repository at /data/books/<id>.git
-- (DIRECTION §3.3 lines 186–187). owner_id is NOT NULL, so no book is
-- reachable without an account (DIRECTION §3.3 lines 175–178). original_book_id
-- is the single-level fork original (workflow 11 lines 37–39); ON DELETE SET
-- NULL lets the original go away without touching the fork. size_bytes is the
-- book's size with history, the input the per-book and per-account quotas are
-- checked against (workflow 14 lines 39–48); it is maintained by the push path
-- (service.git_http / the hook). deleted_at and taken_down_reason carry the
-- lifecycle the git refusal reads before git starts (DIRECTION §3.6 lines
-- 337–340, workflow 10 lines 103–106).
CREATE TABLE books (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          uuid        NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    visibility        text        NOT NULL DEFAULT 'private' CHECK (visibility IN ('private')),
    original_book_id  uuid        REFERENCES books (id) ON DELETE SET NULL,
    size_bytes        bigint      NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
    created_at        timestamptz NOT NULL DEFAULT now(),
    deleted_at        timestamptz,
    taken_down_reason text
);

CREATE INDEX books_owner_id_idx ON books (owner_id);

-- memberships — the editors and readers of a book, never the owner (refinement
-- Decisions). The composite primary key is the "one membership per person per
-- book" invariant (workflow 10 lines 28–39); the fifty-member cap is a count
-- of these rows per book (service.sharing enforces the number).
CREATE TABLE memberships (
    book_id    uuid        NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    account_id uuid        NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    role       book_role   NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (book_id, account_id)
);

-- invitations — a shareable link, not an email (workflow 10 lines 41–45). The
-- opaque id is the handle the owner manages; token is the secret the accept
-- link carries, stored hashed and unique (api InvitationToken vs id). expiry is
-- the chosen ExpiryChoice and expires_at its resolved time (NULL for
-- until-withdrawn). uses_remaining is NULL for unlimited, and the CHECK is the
-- "remaining uses never below zero" invariant (workflow 10 lines 50–51; api
-- Invitation.useLimit line 1185). withdrawn_at stops new joins while existing
-- members stay (workflow 10 lines 52–53).
CREATE TABLE invitations (
    id             uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
    token          text              NOT NULL UNIQUE,
    book_id        uuid              NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    role           book_role         NOT NULL,
    expiry         invitation_expiry NOT NULL DEFAULT 'week',
    expires_at     timestamptz,
    uses_remaining integer           CHECK (uses_remaining IS NULL OR uses_remaining >= 0),
    created_at     timestamptz       NOT NULL DEFAULT now(),
    withdrawn_at   timestamptz
);

CREATE INDEX invitations_book_id_idx ON invitations (book_id);

-- invitation_joins — who joined through each invitation (workflow 10 lines
-- 52–53); the owner's "who joined" list reads it. One join per person per
-- invitation.
CREATE TABLE invitation_joins (
    invitation_id uuid        NOT NULL REFERENCES invitations (id) ON DELETE CASCADE,
    account_id    uuid        NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    joined_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (invitation_id, account_id)
);
