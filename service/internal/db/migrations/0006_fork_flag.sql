-- 0006_fork_flag.sql — a fork stays a fork when its original's row is gone.
--
-- A fork follows its original (workflow 11 §Following the original): the shelf
-- change check tells the fork's device how many new saves the original has, or
-- that the original is gone (sync.fork_follow). books.original_book_id is
-- ON DELETE SET NULL — the original's owner deleting their account nulls it
-- (workflow 17, account deletion's settled contract) — and a NULL there alone
-- cannot tell "a fork whose original was hard-deleted" from "never a fork".
-- is_fork records that the book was made by a fork, for the life of the row, so
-- the change check can answer originalGone for the one cause it otherwise could
-- not see (sync.fork_follow Decision). Existing forks are backfilled from the
-- original they still record; a fork whose original was already hard-deleted
-- before this migration is indistinguishable and stays false.
ALTER TABLE books ADD COLUMN is_fork boolean NOT NULL DEFAULT false;
UPDATE books SET is_fork = true WHERE original_book_id IS NOT NULL;
