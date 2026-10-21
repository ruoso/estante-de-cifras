# books.new_book_counted — A new book reads 0 songs at once

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji) — `books.new_book_counted`
("A new book reads 0 songs at once"), in milestone `milestones.m3_service`
(`tasks/99-milestones.tji:32`).

## Effort estimate

0.25d.

## Repository

The work happens in this repository, outside `cifra.md/`. The note does not start with `cifra.md:`.

- `app/src/worker/logic.js` — the `CREATE_BOOK` handler (L2483-2518).
- `app/src/worker/books.behavior.test.js` — one new case in `the shelf write path (behavior)`.
- `e2e/web/tests/books.spec.js` — one more assertion in the existing journey.

No view, reducer, protocol, locale, service or API change.

## Inherited dependencies

All of them are settled.

- `books.shelf` (`complete 100`) built the Books screen, the `CREATE_BOOK` command and the e2e journey this task extends. Refinement: `tasks/refinements/books/shelf.md`.
- Already complete and relied on, though not in `depends`:
  - `books.row_opens_songs` — the row's `{where} · {role} · {count} songs` meta line. It reads *still loading* while no count has arrived (`app/src/books/book-display.js:85-92`). It also added the song count to the `ready` `INDEX_STATUS` (`app/src/worker/logic.js:1010-1015`).
  - `account.first_run` — `indexOneBook` (`app/src/worker/logic.js:1000-1016`), written so `OPEN_EXAMPLE_BOOK` indexes just the book it seeded.
  - `books.add_book_chooser` — the *Add a book* chooser and its *New book* step, which the journey goes through.

## What this task is

After *Add a book → New book*, the new book's row on the Books screen should read **On this device · can save · 0 songs** straight away. Today it reads *still loading* until the app is reloaded. The fix is for the `CREATE_BOOK` handler to index the book it just made, with the same `indexOneBook(bookId)` call that `OPEN_EXAMPLE_BOOK` (L2556) and the new-book branch of `IMPORT_UPLOAD` (L2412) already make.

## Why it needs to be done

The persona exploration on 2026-10-20 found a new empty book reading *On this device · can save · still loading* for more than 50 seconds. It read *0 songs* only after a reload. Two things cause this:

- `CREATE_BOOK` (`app/src/worker/logic.js:2483-2518`) never indexes the book, so no `INDEX_STATUS` `ready` with a count is ever posted for it.
- `bookMetaFor` (`app/src/books/book-display.js:90-91`) says *still loading* whenever the count is not a number.

On reload, the bring-up sweep `buildIndexes` (L977-992) indexes every book that has commits, and that is why the count then appears.

Workflow 7 §The book-management screen (`docs/workflows/07-add-a-book.md:24-26`) promises *how many songs* a book holds, "or *still loading* while the device has not finished reading it". An empty book that is never read breaks that promise: it says the device is busy when it is not. `milestones.m3_service` waits on this task.

## Inputs / context

- **Workflow** — `docs/workflows/07-add-a-book.md:14-30` (§The book-management screen: each row's title, where it lives, can save, how many songs or *still loading*), and L25 (New book: an empty local book, no account).
- **DIRECTION** — §3.7 (the Worker owns the working copy and the index; the view only sends commands), §2.1 (a new book is a repository holding only `README.md` and `.gitattributes`).
- **Code**
  - `app/src/worker/logic.js`:
    - L2483-2518 — the `CREATE_BOOK` handler: `createLocal`, the `shelf.json` write, `surfaceHomeBookShelf()`, `ensureFs().flush()`, `BOOK_CREATED`.
    - L1000-1016 — `indexOneBook`: hydrates the index, posts `building`, reconciles, persists, then posts `ready` with `songs: songCountOf(bookId)`.
    - L1316-1320 — `songCountOf`: 0 for a book that `browse` lists with no songs, or does not list at all.
    - L2390-2414 — `IMPORT_UPLOAD`'s new-book tail: shelf write, `surfaceHomeBookShelf`, `indexOneBook`, flush, `BOOK_CREATED`. This is the order to copy.
    - L2520-2556 — `OPEN_EXAMPLE_BOOK`: the same tail.
    - L977-992 — `buildIndexes`, which skips a directory with no commits. `createLocal` commits the scaffold (`app/src/worker/books.js` L64-66), so the new book always has one.
  - `app/src/books/book-display.js:85-92` — `bookMetaFor`.
  - `app/src/books/BooksScreen.jsx:117-131` — `BookRow`: the meta line sits inside the row's one RAC `Button`, so it is part of the row's accessible name.
  - `app/src/worker/books.behavior.test.js:86-128` — the existing `CREATE_BOOK` case and its `makeWorker` / `lastEvent` helpers.
  - `e2e/web/tests/books.spec.js:20-88` — the journey that makes and renames a book on the three viewports, with axe.
  - `app/src/i18n/locales/en.js:484` (`songCount`, `{count} songs`), L491 (`stillLoading`).

## Constraints / requirements

1. **Index the book the handler made, and only that one.** Call `await indexOneBook(bookId)` after `surfaceHomeBookShelf()` and before `ensureFs().flush()` and `BOOK_CREATED`. That is the same order `IMPORT_UPLOAD` and `OPEN_EXAMPLE_BOOK` use. It runs after the book's lock and the home book's lock have been released one after the other, so no lock is nested (locks.md Decision 1). It does not rebuild other books.
2. **Offline first.** Indexing is local. `CREATE_BOOK` still makes no network call and no push (the existing case's `fetchCalls` assertion must still hold).
3. **The order of events.** The `ready` status (with `songs: 0`) must arrive before `BOOK_CREATED`. Then, when the view moves focus to the new row, the row already says *0 songs*.
4. **No view change.** `bookMetaFor` and `BookRow` already render *0 songs* when `songCount` is 0 (`typeof 0 === 'number'`). Pluralization goes through `songCount`'s `other` form in each locale.
5. **Accessibility.** No new UI. The journey's axe checks on the shelf stay, and run with the row reading *0 songs*.

## Acceptance criteria

The behavior: right after *New book*, the new book's row reads *On this device · can save · 0 songs*, with no reload. Its section in Search (workflow 2) is ready with 0 songs too, the same as after a reload.

Tests, by level:

- **behavior** — `app/src/worker/books.behavior.test.js`, a new case in `describe('the shelf write path (behavior)')`: *CREATE_BOOK indexes the new book: INDEX_STATUS ready with songs 0 before BOOK_CREATED (books.new_book_counted; workflow 7 L24-26)*.
  - It sends `CREATE_BOOK` and waits for `BOOK_CREATED`.
  - It asserts that an `INDEX_STATUS` event for that `bookId` has `state: 'ready'` and `songs: 0`, and that its position in `w.events` is before `BOOK_CREATED`'s.
  - It asserts that `fetchCalls` is still empty.
  - This case fails against today's handler.
- **e2e-web** — `e2e/web/tests/books.spec.js`, in the existing journey `a new book is made and renamed on the shelf…`, right after the row appears (L67), with no reload in between: `await expect(page.getByRole('button', { name: new RegExp(`^${NAME}`) })).toContainText('0 songs')`. The test also asserts that the row does not contain *still loading*.
  - It then runs the existing `checkA11y()` on the shelf with the new row present.
  - It runs on phone, tablet and computer, which are the three projects every spec runs on.
  - It pins workflow 7 L24-26.
  - It is driven entirely through the real UI (Books → *Add a book* → *New book* → a name → *New book*). That path already exists, so nothing else is needed to drive it.

## Decisions

1. **Call `indexOneBook` rather than posting a bare `ready` with `songs: 0`.** A new book is known to be empty, so posting `INDEX_STATUS {state:'ready', songs:0}` directly would be cheaper. But it would leave the persisted index without the book until the next startup sweep. It would also make `CREATE_BOOK` the one book-adding path that does not go through the index. `indexOneBook` on a repository holding only `README.md` and `.gitattributes` costs very little, gives the same `building` → `ready` pair as every other path, and keeps the count and the index in agreement. The note says the same: "CREATE_BOOK indexes the book it made, as every other path that adds a book does".
2. **Extend the existing e2e journey rather than add a spec.** `books.spec.js` already makes a new book through the real UI on the three viewports and runs axe on the shelf. One assertion at the point where the bug showed pins the promise without repeating the journey. The `makeLocalBook` helper in `e2e/web/lib/journeys.js:181-188` stays as it is: other specs use it, and they do not need the count.
3. **No change to `bookMetaFor`.** Showing *0 songs* when no count has arrived would hide a real *still loading* on a book that is still being read. The fault is that the count was never sent, not how the row renders it.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-21.

- `app/src/worker/logic.js`: `CREATE_BOOK` now calls `indexOneBook(bookId)` after `surfaceHomeBookShelf()` and before the flush and `BOOK_CREATED`, the order `IMPORT_UPLOAD` and `OPEN_EXAMPLE_BOOK` use. No network call.
- A new book reads *On this device · can save · 0 songs* at once, with no reload; no view, reducer, protocol or locale change.
- behavior: `app/src/worker/books.behavior.test.js`, new case *CREATE_BOOK indexes the new book: INDEX_STATUS ready with songs 0 before BOOK_CREATED*; it also checks `fetchCalls` stays empty.
- e2e-web: `e2e/web/tests/books.spec.js`, the existing journey asserts the row contains *0 songs* and not *still loading* with no reload, then runs axe on the shelf, on phone, tablet and computer.
- WBS: `complete 100` on `books.new_book_counted` in `tasks/65-books.tji`. No tech debt registered.
