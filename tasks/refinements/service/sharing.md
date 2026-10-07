# service.sharing — Members and invitations

## TaskJuggler

[`tasks/30-service.tji:56`](../../30-service.tji) — `task sharing "Members and
invitations"`, under `task service`. `effort 3d`, `allocate team`,
`depends !books`. Through the parent `task service` it also inherits
`foundation.service_skeleton`, `foundation.api_contract` and
`foundation.e2e_api`.

Downstream, `service.admin` (`tasks/30-service.tji:68`, `depends !sharing`)
withdraws invitations and removes members as admin actions; `sync.engine`'s
reconcile path (`tasks/45-sync.tji:35`, `depends … service.sharing`) relies on
a shared book appearing on, and disappearing from, a device's shelf; the app's
books area (`books.online`/`books.sharing`, `tasks/65-books.tji:25,31`,
`depends … service.sharing`) is the UI over the operations this task
implements. None are blockers for this task.

## Effort estimate

**3d.** Seven small handlers over three tables that already exist, but the
weight is in the rules, not the SQL:

- **The fifty-member cap, enforced race-safely.** The cap is the service's to
  hold, not the schema's — a `count(*)` of `memberships` per book that must be
  serialized against concurrent accepts so the fifty-first cannot slip in
  between a count and an insert.
- **Invitation lifecycle.** A random secret token stored as a hash, an expiry
  resolved to an absolute instant, a use-limit decremented atomically, a
  withdrawal that stops new joins but keeps those who joined — four
  independent reasons an accept is refused, each with its own `409` code.
- **Who-sees-whom, server-side.** `listMembers` returns a different member
  array to the owner, to an editor and to a reader; the filter is the
  service's because the copyright framing makes the service the enforcement
  point, never the client.

## Repository

**estante-de-cifras.** No cifra.md work: the service never parses a song for
this task — it moves registry rows and composes a link. The app and the
service **share no code** (DIRECTION §3.6 line 288); only the HTTP contract in
`api/` and the format bind them.

Directories/files that change:

- `service/internal/server/sharing.go` — the seven handlers and the pure
  helpers (new), following the one-file-per-feature pattern of `books.go`,
  `git.go`, `sessions.go`.
- `service/internal/server/sharing_test.go` — behavior tests (new).
- `service/internal/server/server.go` — register the seven routes inside the
  existing `if api != nil` block.
- `e2e/api/sharing.test.js` — e2e-api black-box tests (new).

**No new migration.** Every table this task touches — `memberships`,
`invitations`, `invitation_joins` — already ships in
`service/internal/db/migrations/0001_registry.sql` (`service.schema`), along
with the `book_role` and `invitation_expiry` enums and every constraint this
task relies on. This task only reads and writes rows.

**No new `APIDeps` field and no new config.** The invitation token is a random
secret stored hashed (Decisions), so there is no signing key to add; the
shareable link is composed from the `PublicBaseURL` already in `APIDeps`
(`service/internal/server/email_links.go:29-51`). The fifty-member cap is a
code constant beside the books quotas (`service/internal/server/books.go:31-35`).

## Inherited dependencies

- **`service.books`** (Done, 2026-10-07) — the registry-and-volume seam this
  task extends, and the source of the helpers it reuses:
  - `resolveBookAccess(ctx, q, bookID, accountID) (bookAccess, bool, error)`
    (`service/internal/server/books.go:453`) — the one-query role gate:
    `CASE WHEN b.owner_id=$2 THEN 'owner' ELSE m.role::text END` over a live
    book (`deleted_at IS NULL AND taken_down_reason IS NULL`), returning
    `bookAccess{ownerID, role, sizeBytes}`; `found=false` → the caller answers
    `404`. This is the owner-vs-member-vs-stranger decision for every handler
    here.
  - `isMember` (`:477`), `ownedUsage` (`:427`, the quota template to mirror
    for a per-book count), and the `querier` interface (`:420`,
    `QueryRow(ctx, sql, args...) pgx.Row`) that lets a helper run against the
    pool or an open `pgx.Tx`.
  - The **404-vs-403 ladder** (`handleDeleteBook`, `books.go:263-277`): a
    caller who is neither owner nor member → `404` (never confirm a private
    book to a stranger); `403` only for a member whose role is insufficient
    for an owner-only action. The quota constants and git URL helper
    `gitURL(base, id)` (`:65`) and the transaction-with-cleanup pattern
    (`:107-142`). *(settled)*
- **`service.schema`** (Done, 2026-10-07) — the three tables and two enums,
  all in `0001_registry.sql`:
  - `book_role AS ENUM ('editor', 'reader')` (`:26`) — the invitable roles;
    **the owner is never a `memberships` row**, it is `books.owner_id`.
  - `invitation_expiry AS ENUM ('day', 'week', 'month', 'until-withdrawn')`
    (`:30`), default `'week'`.
  - `memberships` (`:100-106`): composite `PRIMARY KEY (book_id, account_id)`
    — the "one membership per person per book" invariant — `role book_role`,
    `created_at`; both FKs `ON DELETE CASCADE`.
  - `invitations` (`:116-126`): `id uuid` PK (the owner's opaque handle),
    `token text NOT NULL UNIQUE` (**the hash of the secret**, Decisions),
    `book_id`, `role book_role`, `expiry invitation_expiry DEFAULT 'week'`,
    `expires_at timestamptz` (NULL for until-withdrawn),
    `uses_remaining integer CHECK (uses_remaining IS NULL OR uses_remaining >= 0)`
    (NULL = unlimited — the "uses never below zero" invariant), `created_at`,
    `withdrawn_at timestamptz` (nullable). Index `invitations_book_id_idx`.
  - `invitation_joins` (`:133-138`): composite `PRIMARY KEY
    (invitation_id, account_id)`, `joined_at` — who joined through each
    invitation, the owner's "who joined" list. *(settled)*
- **`service.sessions`** (Done, 2026-10-07) — the account gate.
  `session.Resolve(ctx, db, r)` (`service/internal/session/session.go:128`)
  reads the `estante_session` cookie and returns the signed-in account id, or
  `ok == false` for not-signed-in. There is **no middleware and no context
  key**: each handler calls `Resolve` inline (as every books handler does).
  Its lazy revocation (a revoked row refused at the next `Resolve`, never
  deleted) is the template for this task's lazy role changes. *(settled)*
- **`foundation.api_contract`** (Done) — the sharing operations and schemas in
  `api/openapi.yaml` are already fixed; this task implements them, it does not
  design them. *(settled)*
- **`foundation.e2e_api`** (Done) — the `e2e/api/` harness: the `HttpClient`
  cookie jar (`e2e/api/lib/http.js`), the WebAuthn `Authenticator`
  (`lib/authenticator.js`), `seedAccount` (`lib/db.js`), and the real git
  clients `GitCli`/`IsoGit` (`lib/git.js`). *(settled)*
- **`service.git_http`** (Done, 2026-10-07) — *not a blocker; the consumer
  this task feeds.* Git over HTTP already gates clone/push on
  `resolveBookAccess`: any role may fetch, owner/editor may push, a reader's
  push → `403`, a non-member → `404`, re-read every request. This task does not
  touch `git.go`; it only changes the membership rows that gate reads. The
  e2e-api test exercises the accept→clone→push path this makes possible.

## What this task is

The seven member-and-invitation operations behind workflow 10, as
`api/openapi.yaml` already declares them:

- **`POST /api/books/{bookId}/invitations` (`createInvitation`)** — owner only.
  Mint an invitation for a role (`editor`/`reader`), an expiry (resolved to an
  absolute `expires_at`), and an optional use-limit. Return `201` with the
  invitation and its **link** (the only time the raw token is ever shown).
- **`GET /api/books/{bookId}/invitations` (`listInvitations`)** — owner only.
  Each invitation with its role, resolved expiry, remaining uses, withdrawn
  flag, and **who joined through it**; the link is omitted (Decisions).
- **`DELETE /api/books/{bookId}/invitations/{invitationId}`
  (`withdrawInvitation`)** — owner only. Set `withdrawn_at`; nobody new joins,
  those who joined stay members.
- **`POST /api/invitations/{token}/accept` (`acceptInvitation`)** — any
  signed-in account, no prior membership needed. Admit the caller to the book
  at the invitation's role and put it on their shelf; return `200` with the
  `Book`. Refused `409` — withdrawn, expired, exhausted, or the book full —
  each with a machine-readable `code`.
- **`GET /api/books/{bookId}/members` (`listMembers`)** — any member. The
  members the caller may see (owner sees all; a member sees the owner and the
  editors, not other readers), with the true `count` (members besides the
  owner) against the `limit` of `50`.
- **`PATCH /api/books/{bookId}/members/{userId}` (`changeMemberRole`)** — owner
  only. Move a member between `editor` and `reader`; takes effect at their next
  request.
- **`DELETE /api/books/{bookId}/members/{userId}` (`removeMember`)** — owner
  only. Drop the membership; takes effect at their next request, when the book
  becomes "no longer shared with you".

## Why it needs to be done

A book goes online **private** (`service.books`, workflow 7): only its owner
can open it. This task is what opens it to other people — the server side of
workflow 10 and of the "Sharing" line of the API (DIRECTION §3.6 lines
368-369). Until it lands, a second account cannot be admitted to a book at all:
`service.git_http` can gate a push on a membership, but nothing can *create*
one except a direct `INSERT` (which is exactly how the books and git e2e tests
seed a second member today — `e2e/api/books.test.js` lines 110-115, with a
comment that "service.sharing is downstream"). It realises "a book reaches at
most fifty people besides its owner" (DIRECTION §3.3 lines 175-176) — the cap
that keeps a book a songbook passed around a class, not a public lyrics site —
and unblocks `service.admin`, the app's sharing screen, and sync's handling of
a book arriving on or leaving a shelf.

## Inputs / context

**The task note** (`tasks/30-service.tji:60`): "Invitations with role, expiry,
limit on uses, who joined; accept; withdraw; members' roles; remove; at most
fifty people per book, a full book refusing joins and telling the owner; who
sees whom. Workflow 10. Tests: unit (role, expiry and use rules); behavior
(invite, accept, withdraw, change a role, remove; the fiftieth person joins,
the fifty-first is refused and the owner told; who sees whom); e2e-api (an
invitation accepted by a second account, which can then clone and, as editor,
push; a full book refusing a join)."

**Workflow** — `docs/workflows/10-share.md` (decided):

- *Who can open a book* (lines 9-26): **"Only people the owner let in, each
  with an account, and at most fifty of them."** A book starts private; the
  owner opens it from *share*, inviting people as a **reader** or an
  **editor**. "The service enforces all of it: a request without a session is
  refused, and so is a reader's push."
- *At most fifty people per book* (lines 28-38): "A book has its owner and **at
  most fifty members**, readers and editors together." The owner sees the count
  ("37 of 50"). When full, "an invitation stops admitting anyone: opening it
  says the book has reached its limit, and the owner is told someone tried.
  Making room is removing someone. The service enforces the count, not the
  app." Fifty is per book, not per invitation.
- *Invitations* (lines 40-61): by link, not by email address — "The service
  holds nobody's address before they have agreed to anything." **One invitation
  may be used by many people.** Each has an expiry chosen when made — "a day, a
  week (the default), a month, or until withdrawn" — and optionally a limit on
  uses, "down to one". The owner sees who joined through each and can withdraw
  it: "nobody new joins, and those who joined stay members." Accepting "asks
  the person to sign in, or to make an account … and then puts the book on
  their shelf."
- *Roles* (lines 63-69): **Owner** (one per book; shares, invites, removes,
  deletes), **Editor** (saves to the book), **Reader** (reads it, keeps it on
  their shelf). "Only the owner invites, in the first pass."
- *Who sees whom* (lines 71-75): "The owner sees every member with their role,
  and every invitation with who joined through it. Members see who the owner
  and the editors are … but not the other readers."
- *Removing someone, or lowering their role* (lines 77-85): takes effect "at
  their next request to the service. What is on their device stays." The shelf
  shows "no longer shared with you". An editor lowered or removed with unpushed
  saves "is told those saves can no longer go to the book, and is offered a
  fork (workflow 11) or the download (workflow 7)" — this offer is app-side
  (books area), triggered by the next push being refused by `service.git_http`.
- *A copyright notice* (lines 103-106): an admin may withdraw invitations,
  remove members, or take a book down — that is `service.admin`, not this task.
- *Later* (lines 108-117): approving each person before they join; handing
  ownership; editors who invite; forks inheriting a limit; actively **telling
  people a book changed** ("Your teacher updated Choros") — all deferred; "in
  the first pass the sync state on the shelf (workflow 8) says it."

**DIRECTION:**

- §3.3 (lines 175-182): **"No book is reachable without an account, and a book
  reaches at most fifty people besides its owner (workflow 10)."** "Every
  request for a book needs a session and a membership; there is no anonymous
  read and no link that opens a book to whoever holds it, and nothing the
  service serves is indexed (`noindex`)." The cap keeps a book "a songbook
  passed around a class or a band". The registry — "each book's owner, its
  members and their roles, and its invitations" — is Postgres (lines 184-185).
- §3.3 (lines 164-169): commits are authored with a per-user no-reply address,
  **never the user's real email** — the reason the registry holds no display
  name (Decisions).
- §3.6 (lines 368-369): the Sharing API — "members listed, their roles changed,
  removed; invitations made with a role, an expiry and a limit on uses, listed
  with who joined, withdrawn, and accepted, up to fifty people per book". (lines
  370-372): "Reads for every member; pushes for editors and the owner" — the
  gate `service.git_http` already applies to the rows this task writes. (line
  288): app and service share no code.

**The contract** (`api/openapi.yaml`), tag `Sharing` (`:45`):

- `GET /api/books/{bookId}/members` `listMembers` → `200 MemberList`, `401`,
  `404` (`:410-431`). Role-filtered; count is members besides the owner.
- `PATCH /api/books/{bookId}/members/{userId}` `changeMemberRole` → body
  `ChangeMemberRoleRequest`, `200 Member`, `400/401/403/404` (`:433-462`).
- `DELETE /api/books/{bookId}/members/{userId}` `removeMember` → `204`,
  `401/403/404` (`:463-480`).
- `GET /api/books/{bookId}/invitations` `listInvitations` → `200
  InvitationList`, `401/403/404` (`:481-500`).
- `POST /api/books/{bookId}/invitations` `createInvitation` → body
  `CreateInvitationRequest`, `201 Invitation` "with its link",
  `400/401/403/404` (`:501-527`).
- `DELETE /api/books/{bookId}/invitations/{invitationId}` `withdrawInvitation`
  → `204`, `401/403/404` (`:529-546`).
- `POST /api/invitations/{token}/accept` `acceptInvitation` → `200 Book`,
  `401`, `404`, `409` (`:548-573`). The `409 Conflict` carries a `code`:
  `invitation_withdrawn`, `invitation_expired`, `invitation_exhausted`,
  `book_full` (`:557-558`).
- Schemas: `Role` enum `[owner, editor, reader]` (`:835`); `InvitableRole`
  enum `[editor, reader]` (`:840`); `Member` required `[userId, role]`,
  optional `displayName` (`:1124`); `MemberList` required `[members, count,
  limit]`, `limit const: 50` (`:1137-1153`); `ExpiryChoice` `[day, week, month,
  until-withdrawn]` (`:1155`); `Joiner` required `[userId]`, optional
  `displayName`, `joinedAt` (`:1160`); `CreateInvitationRequest` required
  `[role]`, optional `expiry`, `useLimit` (min 1) (`:1173`); `Invitation`
  required `[id, role, expiry, createdAt, joined, joinedCount, withdrawn]`,
  optional `url` (format uri), `expiresAt` (nullable), `useLimit` (nullable)
  (`:1187-1220`); `InvitationList` required `[invitations]` (`:1221`);
  `ChangeMemberRoleRequest` required `[role]` (InvitableRole) (`:1231`).
- Parameters: `BookId`, `UserId` ("A member's opaque user id", `:720`),
  `InvitationId` (`:737`), `InvitationToken` (`token` in path, "opaque token,
  carried by its link", min length 1, `:742`). `sessionCookie` =
  `estante_session` (`:700-707`). Shared responses: `NotFound` (conflates "no
  such book" with "not a member"), `Forbidden` (403), `Conflict` (409,
  `:791-799`), `Error` `{code, message}` only (`:819`).

**The schema** (`0001_registry.sql`): enums `:26, :30`; `memberships`
`:100-106`; `invitations` `:116-126`; `invitation_joins` `:133-138`;
`accounts` `:37-41` (`email` nullable — an invitee has no row until they
accept; no name column). `0002_email_links.sql` header note contrasts the two
secret patterns: email links store an HMAC of an id, "the invitations pattern …
stores a hash of a raw secret token because the token is the secret."

**Code seams to reuse:** `session.Resolve` (`session.go:128`);
`resolveBookAccess`/`isMember`/`ownedUsage`/`querier`/`gitURL` (`books.go:453,
477, 427, 420, 65`); the quota constants block (`books.go:31-35`) — add
`maxMembersPerBook = 50` beside them; `writeJSON`/`writeError`
(`respond.go:20,28`), `writeUnauthorized` (`email_links.go:184`),
`decodeStrict` (`email_links.go:191`), `isUUID` (`passkeys.go:540`); path
params via `r.PathValue`; route registration inside `if api != nil`
(`server.go:48-91`); `apicontract` response validation as the books/sessions
behavior tests use it.

**Test precedents:** `service/internal/server/books_test.go:42-78`
(`newBooksEnv(t)` — a `passkeyEnv` that mints real accounts and sessions via
the Go software authenticator `service/internal/webauthntest/authenticator.go`,
a `t.TempDir()` books root, a real `APIDeps`, an `httptest.NewServer`);
`email_links_test.go:102-143` (`migratedServerSchema`/`envDSN` — a throwaway
Postgres schema per test, `t.Skip` when `ESTANTE_TEST_DATABASE_URL` is unset);
`passkeys_test.go:83` (the `.do(t, method, path, cookie, body)` helper);
`migrate_test.go` (`insertAccount`/`insertBook`), `books_test.go:414-448`
(`seedREADME`/`gitRun`). e2e-api: `e2e/api/books.test.js:25`
(`registerNewAccount(client, authenticator)`), the second-`HttpClient`
stranger pattern (`:98-99`), `e2e/api/git.test.js:104-173` (owner pushes/clones
with `client.cookieHeader()`; a stranger refused), `lib/git.js`
(`GitCli.cloneHTTP`/`pushHTTP`, `IsoGit`).

**Standing rules in scope:** **No book without an account** — every handler
gates on `session.Resolve`; a non-member is `404`, never `403`; `accept`
requires a session. **No song text or secrets in logs** — log the operation,
book id, invitation id and outcome; **never the token** (it is the secret) and
never a member's email. **No book without a membership** — the fifty-member cap
and the owner-only gates are the service's, enforced before anything is
written. Canonical form and offline-first are not this task's concern (no song
parsing, no client state here); accessibility is the app's (no UI here).

## Constraints / requirements

- **The fifty-member cap is the service's, enforced race-safely at accept.**
  The cap counts `memberships` rows for the book (the owner is never one). It
  is checked inside the accept transaction after taking a row lock on the book
  (`SELECT id FROM books WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`), so
  two concurrent accepts cannot both pass a count of 49. At the limit, accept is
  refused `409` with `code: "book_full"`. `createInvitation` is *not* refused
  when the book is full — an invitation that exists keeps working again once the
  owner removes someone (workflow 10 lines 32-34). `limit` in `MemberList` is
  the constant `50`; `count` is the live membership count.
- **Owner-only operations use the 404-vs-403 ladder.** `createInvitation`,
  `listInvitations`, `withdrawInvitation`, `changeMemberRole` and
  `removeMember` resolve the caller with `resolveBookAccess`: not owner and not
  a member → `404`; a member who is not the owner → `403`; owner → proceed. A
  non-UUID `bookId`/`userId`/`invitationId` → `404` without touching the
  database. `listMembers` is open to any member (owner or member → `200`
  filtered; stranger → `404`).
- **An invitation token is a random secret, stored hashed.** Minting generates
  a high-entropy random token, stores `SHA-256(token)` in `invitations.token`
  (`NOT NULL UNIQUE`), and returns the raw token exactly once, inside the
  `url` of the `201` response. `acceptInvitation` hashes the presented token
  and looks up by the hash; an unknown token → `404`. `listInvitations` **omits
  `url`** — the raw token is unrecoverable by design (Decisions). The token is
  never logged.
- **Expiry is resolved to an absolute instant at creation.** `expires_at` =
  `now()` plus one day / seven days / thirty days for `day`/`week`/`month`, or
  `NULL` for `until-withdrawn`; the chosen `expiry` enum is stored alongside so
  the owner sees their choice. `acceptInvitation` refuses `409
  invitation_expired` when `expires_at` is non-NULL and in the past.
- **Accept is a single, serialized, idempotent transaction.** In order under
  the book-row lock: resolve the invitation by token hash (→ `404` if none);
  refuse `409 invitation_withdrawn` (`withdrawn_at` set), `409
  invitation_expired`, `409 invitation_exhausted` (`uses_remaining = 0`), `409
  book_full` (count ≥ 50); then `INSERT INTO memberships … ON CONFLICT
  (book_id, account_id) DO NOTHING` and `INSERT INTO invitation_joins … ON
  CONFLICT DO NOTHING`; decrement `uses_remaining` (when not NULL) **only when a
  membership row was actually inserted**, so a repeat accept by an existing
  member (or the owner) consumes no use and creates no duplicate. Returns `200`
  with the `Book` (id, title from the book's README, the caller's new role, git
  URL), composed exactly as `listBooks` composes a book.
- **Role changes and removals are lazy.** `changeMemberRole` updates
  `memberships.role`; `removeMember` deletes the row. Neither interrupts
  anything in flight — the effect is that `resolveBookAccess`, re-read on the
  member's next request by the books and git handlers, yields the new role or a
  miss. This mirrors session lazy-revocation. `changeMemberRole` accepts only
  `editor`/`reader` (the owner is never assigned a role this way); a `userId`
  that is not a membership row (including the owner's own id, which has no
  membership row) → `404`. Removing a member leaves the historical
  `invitation_joins` rows untouched (the owner's "who joined" record is
  history, workflow 10 line 52).
- **Who-sees-whom is filtered server-side in `listMembers`.** The owner sees
  every member (including the owner, role `owner`) and every editor and reader.
  A non-owner member sees the owner (role `owner`) and the editors (role
  `editor`) only — other readers are omitted from the `members` array. `count`
  and `limit` are the true numbers for every caller. The filter is in the
  service because the client must never receive reader identities it may not
  see (DIRECTION §3.3 — the service is the enforcement point).
- **No display name is stored or returned.** `accounts` holds an id and an
  optional email, no name (`0001:37-41`), and commit authorship uses a no-real-
  email address (DIRECTION §3.3 lines 164-169). `Member.displayName` /
  `Joiner.displayName` are optional and left unset; members are identified by
  their opaque `userId` (the account id), and any human label the app shows
  comes from git history (workflow 10 line 74).
- **One binary, standard library, contract-first.** `net/http.ServeMux` method
  routes; `pgx` with plain SQL in a transaction for accept; request bodies via
  `decodeStrict`; every response validated against `api/openapi.yaml` in the
  behavior tests; statuses exactly the declared set.
- **No song text or secrets in logs.** Log method, book id, invitation id and
  outcome; never the token, a member's email, or any song bytes (this task
  never reads a song — only the README title, through the same path as
  `listBooks`).

## Acceptance criteria

**Behavior delivered:**

1. **Create an invitation.** `POST /api/books/{bookId}/invitations` by the
   owner with `{role, expiry?, useLimit?}` inserts an `invitations` row with a
   hashed token, the resolved `expires_at`, and `uses_remaining` (= `useLimit`,
   or NULL), and returns `201` with `{id, url, role, expiry, expiresAt,
   useLimit, joined: [], joinedCount: 0, withdrawn: false}`, where `url` is
   `<PublicBaseURL>/i/<raw-token>`. A non-owner member → `403`; a stranger or
   unknown/non-UUID book → `404`; a role outside `editor`/`reader` or a
   `useLimit` below 1 → `400`; not signed in → `401`.
2. **List invitations.** `GET /api/books/{bookId}/invitations` by the owner
   returns every invitation with its role, resolved expiry, remaining uses, the
   `joined` set (each joiner's `userId` and `joinedAt`) and `joinedCount`, and
   its `withdrawn` flag — **`url` omitted**. A non-owner member → `403`; a
   stranger → `404`; not signed in → `401`.
3. **Withdraw an invitation.** `DELETE
   /api/books/{bookId}/invitations/{invitationId}` by the owner sets
   `withdrawn_at` and returns `204`; a subsequent accept of that token → `409
   invitation_withdrawn`, and those who already joined remain members. Non-owner
   → `403`; unknown invitation on an owned book → `404`.
4. **Accept an invitation.** `POST /api/invitations/{token}/accept` by a
   signed-in non-member admits the caller at the invitation's role, records a
   join, decrements a finite use, and returns `200` with the `Book` on the
   caller's shelf. A repeat accept by the same account is idempotent (no second
   membership, no second use). Refused `409` with the matching `code` when the
   invitation is withdrawn, expired, exhausted, or the book already has fifty
   members; an unknown token → `404`; not signed in → `401`.
5. **List members, filtered.** `GET /api/books/{bookId}/members` returns, to
   the owner, every member with their role and the true "N of 50" (`count`,
   `limit: 50`); to a non-owner member, the owner and the editors only. A
   stranger → `404`; not signed in → `401`.
6. **Change a role.** `PATCH /api/books/{bookId}/members/{userId}` by the owner
   moves a member between `editor` and `reader` and returns `200` with the
   member; the new role governs the member's next request. Non-owner → `403`; a
   `userId` with no membership row → `404`; a role outside `editor`/`reader` →
   `400`.
7. **Remove a member.** `DELETE /api/books/{bookId}/members/{userId}` by the
   owner deletes the membership and returns `204`; the book then resolves as
   inaccessible to that account (its next `listBooks` omits it, its next push is
   refused by git). Non-owner → `403`; a `userId` with no membership row →
   `404`.

**Tests the task lands with, by level.** The note names **unit**, **behavior**
and **e2e-api** — all three apply and are delivered.

- **unit** — `service/internal/server/sharing_test.go` pure-helper tests (`go
  test`, no DB, no network), for the rules the note calls out ("role, expiry
  and use rules"):
  - `resolveExpiry(choice, now)` → `now+24h` / `now+7d` / `now+30d` / `nil` for
    the four `ExpiryChoice` values. *Pins:* workflow 10 lines 49-51; contract
    `ExpiryChoice` `:1155`.
  - `newInvitationToken()` returns a high-entropy raw token and its `SHA-256`
    hash, and `hashToken(raw)` reproduces the hash (so accept finds the row).
    *Pins:* the hash-of-secret pattern (`0002` header note); `invitations.token`
    `NOT NULL UNIQUE` (`0001:117`).
  - `visibleMembers(callerRole, members)` returns all for an owner, and the
    owner + editors only for a reader/editor. *Pins:* workflow 10 lines 71-75;
    contract `listMembers` description `:415-418`.
- **behavior** — `service/internal/server/sharing_test.go` (`httptest` + real
  Postgres via `migratedServerSchema`, two accounts+sessions via `newBooksEnv`'s
  passkey env; `t.Skip` without `ESTANTE_TEST_DATABASE_URL`); every response
  validated against `api/openapi.yaml`:
  - invite / accept / withdraw: the owner creates an invitation (201 with
    `url`), a second account accepts (200 `Book`, a `memberships` row and an
    `invitation_joins` row appear, `uses_remaining` drops by one), a re-accept
    is idempotent; withdraw → a later accept `409 invitation_withdrawn` while
    the joined member stays. *Pins:* workflow 10 lines 40-61; contract
    `:501-546`, `:548-573`.
  - the four `409` reasons each fire with the right `code`: a withdrawn, an
    expired (seed `expires_at` in the past), an exhausted (`useLimit: 1`, used
    once), and a full book. *Pins:* contract `:557-558`; workflow 10 lines
    28-61.
  - **the fiftieth joins, the fifty-first is refused**: seed 49 members, two
    accounts accept; the one taking the book to 50 succeeds, the next → `409
    book_full`; `MemberList.count` reads `50`, `limit` `50`. *Pins:* DIRECTION
    §3.3 lines 175-176; workflow 10 lines 28-38; `MemberList` `:1137-1153`.
  - change a role / remove: owner moves an editor to reader and back (200
    `Member`); removes a member (204) and the book then resolves inaccessible
    to that account (`resolveBookAccess` miss); a non-owner's change/remove →
    `403`; a non-member `userId` → `404`. *Pins:* workflow 10 lines 63-85;
    contract `:433-480`.
  - who sees whom: with an owner, two editors and two readers, `listMembers`
    returns all five + owner to the owner, and owner + the two editors to a
    reader caller; `count` is `4` for both. *Pins:* workflow 10 lines 71-75;
    contract `:410-431`.
  - owner-only gates: a non-owner member's `createInvitation` /
    `listInvitations` / `withdrawInvitation` → `403`; a stranger's → `404`.
    *Pins:* the 404-vs-403 ladder (`books.go:263-277`); contract `:481-546`.
- **e2e-api** — `e2e/api/sharing.test.js` (black-box over the compose stack;
  accounts via `registerNewAccount`, git via `GitCli`/`IsoGit` with each
  client's `cookieHeader()`):
  - the owner creates a book and an editor invitation; a second `HttpClient`
    registers and `POST`s `/api/invitations/{token}/accept`; its `listBooks`
    now shows the book, and as editor it clones and **pushes** over git. A third
    account accepts a **reader** invitation, clones successfully, but its push →
    `403`. *Pins:* workflow 10 lines 22-26, 63-67; DIRECTION §3.6 lines 370-372
    (reads for every member, pushes for editors/owner); contract `:548-573`,
    git routes `:586-693`.
  - a **full book refuses a join**: seed the book to fifty members via
    `lib/db.js`, then a fresh account's accept → `409 book_full`. Withdraw an
    invitation and a new accept → `409 invitation_withdrawn` while an
    already-joined member keeps access. *Pins:* workflow 10 lines 28-38, 52-53;
    DIRECTION §3.3 lines 175-176.

**No deferred follow-ups** become new WBS leaves. `service.admin` (admin
withdraw/remove/take-down with the owner told why) and the app's sharing screen
are existing downstream leaves wired through `depends !sharing` — ordering, not
deferral. The removed-editor fork/download offer (workflow 10 lines 83-85) is
app-side, already owned by the books/songs areas and triggered by
`service.git_http`'s refusal; no new task. The one designed behavior this task
does **not** fully realise — an *active* notice to the owner that "someone
tried" to join a full book, and to members that "a book changed" — is the
notification channel workflow 10 itself defers to "Later" (lines 108-117); in
the first pass the owner learns the book is full from the sharing screen's "50
of 50" and removes someone, and the member learns from the shelf's sync state
(workflow 8). That channel is a product/UX decision spanning app and service,
not an agent-implementable module, so it is surfaced for the parking lot rather
than registered as a leaf. No tech debt registered.

## Decisions

- **The invitation token is a random secret stored as a hash; the raw token is
  shown once.** *Chosen:* mint a high-entropy random token, store
  `SHA-256(token)` in `invitations.token` (`NOT NULL UNIQUE`), return the raw
  token only in the `url` of the `201`; `listInvitations` omits `url`; accept
  hashes the presented token to look up the row. *Rejected:* storing the token
  in plaintext so the owner can re-copy the link later — a registry leak would
  then expose every live invitation link, and the schema's own note
  (`0002_email_links.sql`) records the opposite decision: "the invitations
  pattern … stores a hash of a raw secret token because the token is the
  secret." *Rejected:* the email-links HMAC-of-an-id scheme — that lets the
  service recompute a verifier for a stored id, but an invitation's token *is*
  the capability, with no id to anchor to, so there is nothing to HMAC and no
  key to add. An owner who loses a link withdraws it and makes a new one. `url`
  is optional in the `Invitation` schema precisely so it can be present at
  creation and absent on listing. No new config secret. No DIRECTION delta.
- **Expiry is resolved to an absolute `expires_at` at creation.** *Chosen:*
  compute and store `expires_at` from the enum once; `until-withdrawn` → NULL;
  accept compares against `now()`. *Rejected:* recomputing `created_at + enum`
  on every check — it works, but the schema ships an `expires_at timestamptz`
  column (`0001:121`) precisely so "expired" is one indexed comparison, and
  storing the resolved instant means a later change to what "a month" means
  cannot retroactively move an existing invitation's deadline. No delta.
- **The fifty-member cap is enforced at accept, under a book-row lock; a full
  book does not block creating invitations.** *Chosen:* `SELECT … FOR UPDATE`
  the book row inside the accept transaction, count memberships, refuse `409
  book_full` at fifty. Creating an invitation on a full book is allowed; the
  link simply refuses joins until the owner removes someone. *Rejected:*
  counting without a lock — two accepts could both read 49 and both insert, and
  the `memberships` PK does not stop that (different accounts). *Rejected:*
  refusing `createInvitation` when full — workflow 10 (lines 32-34) says the
  *invitation* "stops admitting anyone" and starts working again when room is
  made, so the cap belongs on the join, not on minting the link. "The owner is
  told someone tried" is realised in the first pass by the sharing screen's
  live "50 of 50" count and the remedy beside it; an active per-attempt notice
  rides with the deferred notification channel (workflow 10 "Later"). No delta.
- **Accept is idempotent and serialized in one transaction.** *Chosen:* resolve
  and check the invitation, then `INSERT … ON CONFLICT DO NOTHING` for both the
  membership and the join, decrementing a finite use only when a membership was
  actually inserted — so a forwarded link opened twice by the same person (or
  by the owner) is harmless and consumes nothing. *Rejected:* refusing a
  re-accept with `409`/`400` — opening a link twice is normal behaviour for a
  shared link, and the `memberships` composite PK already makes a second
  membership impossible; making it an error would turn a no-op into a confusing
  failure. No delta.
- **Role changes and removals are lazy, not pushed.** *Chosen:* change or delete
  the `memberships` row; rely on `resolveBookAccess` being re-read every request
  by the books and git handlers to apply the new access at the member's next
  request. *Rejected:* actively terminating a member's access mid-flight — the
  service holds no long-lived per-member state to tear down (git requests are
  one-shot and already re-authorized each time), and this matches session
  lazy-revocation (`sessions.md`). The "your unpushed saves can no longer go to
  the book" offer (workflow 10 lines 83-85) is the app's, triggered by the next
  push's `403`/`404` from `service.git_http`; nothing for the service to do
  beyond changing the row. No delta.
- **Who-sees-whom is filtered in the service, not the client.** *Chosen:*
  `listMembers` builds the `members` array from the caller's role — all for the
  owner, owner + editors for a non-owner — with `count`/`limit` always true.
  *Rejected:* returning every member and letting the app hide readers — "no
  book without an account" and the copyright framing (DIRECTION §3.3) make the
  service the single enforcement point; a reader's identity must never reach a
  client that may not see it, regardless of what the UI draws. No delta.
- **No display name is stored or returned.** *Chosen:* leave
  `Member.displayName`/`Joiner.displayName` unset; identify members by their
  opaque `userId`. *Rejected:* adding a name column to `accounts` — no workflow
  collects a name, and the no-real-email authorship rule (DIRECTION §3.3 lines
  164-169) deliberately keeps personal identifiers out of a book's history and
  the registry; the app surfaces any human label from git history (workflow 10
  line 74). The optional field stays available for a later task without a
  contract change. No delta.
- **The handlers live in a new `service/internal/server/sharing.go`, reusing
  the books helpers; no new package.** *Chosen:* one file for the seven
  handlers and the three pure helpers, reusing `resolveBookAccess`, `isMember`,
  `ownedUsage` and the 404-vs-403 ladder from `books.go`, matching the
  one-file-per-feature layout. *Rejected:* a separate `service/internal/sharing`
  package like `book`/`session` — those wrap an external resource (git, cookies)
  with real seams to isolate; sharing is thin SQL and HTTP over tables
  `books.go` already touches, so a package would only add indirection. The pure
  rule-helpers that warrant unit tests (expiry, token hash, visibility filter)
  are small and stay beside the handlers. No new `APIDeps` field, no new
  migration. No delta.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `service/internal/server/sharing.go` (new) — seven handlers and pure helpers (`resolveExpiry`, `newInvitationToken`/`hashToken`, `visibleMembers`, `requireOwner`, serialized idempotent `acceptInvitationTx` under a books-row lock).
- `service/internal/server/server.go` — registered the seven routes inside the existing `if api != nil` block.
- `service/internal/server/logging.go` — added `redactInvitationToken` so the accept route's path token is never logged; satisfies the "no secrets in logs" hard rule.
- `service/internal/server/sharing_test.go` (new) — unit tests (`TestResolveExpiry`, `TestInvitationTokenHash`, `TestVisibleMembers`, `TestRedactInvitationToken`) and behavior tests (`TestCreateInvitation`, `TestListInvitations`, `TestWithdrawInvitation`, `TestAcceptInvitation`, `TestFiftiethJoinsFiftyFirstRefused`, `TestListMembersWhoSeesWhom`, `TestChangeMemberRole`, `TestRemoveMember`) via `httptest` against real Postgres.
- `e2e/api/sharing.test.js` (new) — three e2e-api tests: editor accept→clone→push, reader push 403, full book→`book_full`, withdrawn→`invitation_withdrawn`.
- `api/openapi.yaml` — added missing `createdAt` property to `Invitation` schema (fixer: the field was in `required` but not in `properties` under `additionalProperties: false`).
