-- 0004_book_notices.sql — the durable record behind "the owner is told why".
--
-- A copyright notice (workflow 10 lines 103-115) is handled by an operator
-- command (service/cmd/estante-admin), not an app feature: the service can
-- withdraw a book's invitations, remove its members, or take the book down, and
-- each action records the reason it was taken, durably, against the book. This
-- table is that record. Without it, only take-down had a carrier
-- (books.taken_down_reason, 0001_registry.sql:91); withdraw and remove had
-- nowhere to record their reason, and the task's obligation is "the owner's
-- notice recorded" for *each* action (refinement Decisions).
--
-- The row captures what an operator and the book's owner need to read back: the
-- book, the owner as it stood at action time (books.owner_id, copied in so the
-- record stands even if ownership later changes), the action, the operator's
-- reason (legal text, stored here — a table, not a log; the no-secrets-in-logs
-- rule is about tokens and song text), and when. The reason reaches the book's
-- owner and members over the git refusal for a take-down (service/internal/server
-- /git.go); surfacing it inside the app is a later addition over this record
-- (workflow 10 line 114; the deferred books.notice_surface).
--
-- action is a text column with a CHECK rather than an enum: the three admin
-- subcommands are the only values, and the CHECK is the one the command's
-- argument parser mirrors (refinement Acceptance — the unit test pins this set).
-- Both foreign keys cascade, matching the registry's other child tables
-- (memberships, invitations): a hard-deleted book or account (account deletion,
-- 0001_registry.sql:85) takes its notices with it; the normal book delete is a
-- soft deleted_at, which leaves the notices in place.
CREATE TABLE book_notices (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id    uuid        NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    owner_id   uuid        NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    action     text        NOT NULL CHECK (action IN ('take_down', 'withdraw_invitations', 'remove_members')),
    reason     text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX book_notices_book_id_idx ON book_notices (book_id);
