-- 0003_book_kind.sql — the repository kind the registry records per book.
--
-- A book is either a songbook (the default, and every book created before this
-- migration) or a home book — the per-user settings repository whose files are
-- JSON that merge key by key (docs/home-book-format.md §1, §8). The two move
-- over the same git-over-HTTP, but the pre-receive hook validates them
-- differently: a songbook holds only *.cifra.md/*.setlist.md/README/.gitattributes
-- and every song canonical (hook.contents/hook.canonical), a home book holds the
-- seven settings files of §2.1 in canonical JSON (hook.home_book).
--
-- The hook is not left to guess a repository's kind from its contents — that is
-- "fragile and spoofable" (docs/home-book-format.md §8 lines 496-500; the design
-- Decision). The service reads this column and forwards it to the hook through
-- the ESTANTE_BOOK_KIND environment it already passes on a push
-- (service/internal/server/git.go pushEnv). The CHECK constraint keeps the
-- column to the two kinds the hook knows; the DEFAULT leaves every existing row a
-- songbook, the smallest registry change.
ALTER TABLE books
    ADD COLUMN kind text NOT NULL DEFAULT 'songbook'
        CHECK (kind IN ('songbook', 'home'));
