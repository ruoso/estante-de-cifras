# books.setlists_resilient — Setlists never stuck loading; a half-cloned book never reads as empty

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task setlists_resilient`
(lines 192-197), in milestone `m3_service` (`tasks/99-milestones.tji:32`).

## Effort estimate

1d.

## Repository

The app only: `app/src/worker/` (a new `setlist-list.js`, `logic.js`),
`app/src/books/SetlistsScreen.jsx`, `app/src/songs/SearchScreen.jsx`,
`app/src/i18n/locales/*.js`, their tests beside them, and one e2e-web spec
under `e2e/web/tests/`. Nothing under `cifra.md/`, `service/` or `api/`.

## Inherited dependencies

- `books.setlists` — **settled** (`complete 100`): the Setlists destination,
  `LIST_SETLISTS` and the `setlists` slice.
- Used by the tests, all already complete: `account.new_device` (the shelf
  fill, `SHELF_FILL`, the `fill` slice, the `anotherDeviceSignsIn` journey),
  `books.online` (put online), `account.sign_in` (`signedInDevice`).

## What this task is

Two findings from the 2026-10-19 usability review. **H1:** the Setlists
destination can show *Loading setlists…* forever. `LIST_SETLISTS` reads
every directory under `/books` through the book tree's `statusMatrix`,
which runs under the book's lock. It has no per-book catch. A directory
with no readable `.git/HEAD` (left by an interrupted clone, or by
`removeTree`, which is not atomic) makes the whole command throw, and a book
being cloned makes it wait for the whole clone. The Worker then posts a
generic `ERROR`, which `SetlistsScreen` ignores, so the slice stays `null`.
The fix: list setlists without waiting on any book's lock, skip a book that
cannot be read or has no commit, and end *Loading* on an `ERROR` with a
plain sentence. **M8:** a book read *0 songs* and then, later, *9 songs*.
At start-up, `buildIndexes` indexes a directory that has `HEAD` but no
`main` (a half-done clone) as ready and empty, until the shelf fill
re-clones it. The fix: don't index or list a book with no commit. Search
shows a book that is still coming down with its fill word (*waiting*,
*cloning 40%*), the same word the shelf uses, never *0 songs*. The
add-by-link clone (`cloneOntoShelf`) treats any `.git` as already cloned,
which is how a half-cloned book can stay on the shelf. It now heals the
directory the way the shelf fill does.

## Why it needs to be done

Setlists is one of the three destinations. A destination that never loads
is a dead end for everyone with a damaged directory, and the damage outlives
the session that made it. A book that reads *0 songs* looks lost (workflow 2
§Edge cases L177-179 says it must say it is still loading). Both are M3
(Estante online) blockers. A new device fills its shelf by cloning, which is
when these states happen. `books.setlist_picker_fixes` and
`books.setlist_invitation` build on a Setlists destination that loads.

## Inputs / context

- `docs/workflows/02-find-and-play.md:177-179` — a book still cloning, or an
  index still building, "says it is still loading, rather than looking
  empty". `docs/workflows/13-new-device.md:178-185` §What comes down — every
  book listed at once and cloned in the background. `docs/workflows/12-setlists.md`
  §The file (L34) — the Setlists destination lists the loaded books'
  setlists. DIRECTION §3.7 "Offline first": nothing the user does waits on a
  clone.
- `app/src/worker/logic.js:2123-2155` — `LIST_SETLISTS`: `listBookIds`
  (:290-299, every `/books` entry, no `.git` check), then
  `ensureBookTree().tree({ bookId })` per book. Only `ENOENT` is tolerated on
  a file read (:2143). One `SETLISTS { setlists: [{bookId, path, title, count}] }`
  at the end.
- `app/src/worker/book-tree.js:57-80` — `tree()` runs `statusMatrix` inside
  `locks.withLock(bookId, …)`. isomorphic-git maps a missing ref to an empty
  tree only when `HEAD` is a symbolic ref to an unborn branch. A missing
  `HEAD` throws `NotFoundError`.
- `app/src/worker/add-by-link.js:51-54` — `cloneHosted` holds the book lock
  for the whole `git.clone`. `app/src/worker/locks.js` — one Web Lock per
  book. It has no try-lock.
- `app/src/worker/logic.js:3524-3542` — the generic catch posts
  `ERROR { message, code: 'command_failed' }`. `protocol.js:808-815`:
  envelopes carry no request id, so an `ERROR` is not tied to a command.
  `reducer.js:212-217` folds it into `connection` only. Screens that react to
  `ERROR` track their own in-flight state:
  `app/src/books/UploadPreview.jsx:135-147` and
  `app/src/account/MySongsChoice.jsx:71-73`.
- `app/src/books/SetlistsScreen.jsx:15-65` — sends `LIST_SETLISTS` on mount
  (:19-21), re-lists on `SETLIST_UPDATED`/`SAVED` (:25-30), and renders
  `setlists.loading` while the slice is `null` (:38-39). The strings are at
  `app/src/i18n/locales/en.js:490-491`.
- `app/src/worker/search-index.js:92-111` (`readHeadOidsFromGit`, blanket
  catch → empty map) and `:379-399` (`songPaths`, a plain `readdir` walk that
  skips `.git`, no git involved) — the pattern for tolerating a damaged
  directory. `search-index.js:366-376` `removeBook` returns the
  `deleteLocations` diff that `persistIndexChanges` applies.
- `app/src/worker/logic.js:978-1000` — `buildIndexes` / `indexOneBook`:
  `building` → `ready` with `songCountOf`, for every `/books` entry.
  `:1253-1260` `hasCommits` (lock-free `resolveRef('main')`, already used
  lock-free by `fillOnce` at :1381). `:1358-1366` `clearPartialClone`.
  `:1377-1420` `fillOnce`: `waiting` → `cloning n%` → `ready` with songs, back
  to `waiting` on failure.
- `app/src/worker/logic.js:1053-1066` — `cloneOntoShelf`: a present `.git` is
  "already cloned" (no `main` check, no cleanup). It is reached from
  `ADD_BY_LINK` (:3033) and `ADD_MINE` (:3053).
- `app/src/books/book-display.js:292-318` — `fillDisplayFor(entry, { t })` →
  `{ state, word, meta, cls, percent }` from `books.fillWaiting` /
  `fillCloning` / `fillReady`. `BooksScreen.jsx:114-150` renders it on the
  shelf row. `reducer.js:178-183, 652-668` — the `fill` slice.
- `app/src/songs/SearchScreen.jsx:289-313` — `BookSection` meta is
  `search.stillLoading` while building, else `search.songCount` with
  `book?.count ?? 0`. `:551-556`: the listed books are `browse.books` ∪
  `Object.keys(index)`. The screen does not read `fill`.
- Tests today: `app/src/worker/setlist.behavior.test.js` (setup ≈100-175:
  fake-indexeddb, lightning-fs, the loopback Worker, `installWebLocks()`,
  `seedBook`, `settled`; two books listed at 182-210);
  `app/src/worker/search-index.behavior.test.js`;
  `app/src/worker/add-by-link.behavior.test.js`;
  `app/src/worker/new-device.behavior.test.js` (fill order :294, a failed
  clone back to waiting :363-392); `app/src/songs/SearchScreen.behavior.test.jsx`
  (`makeStore`/`emit`, :20-26). No `SetlistsScreen` test exists. The
  fake-Worker pattern is in `app/src/books/SetlistView.behavior.test.jsx:70-111`.
  e2e: `e2e/web/tests/new-device.spec.js:226-279` interrupts a fill by going
  offline once the first book is *ready* and another is *cloning*. Journeys:
  `signedInDevice`, `makeLocalBook`, `putBookOnline`, `syncNow`, `gotoTab`
  (`e2e/web/lib/journeys.js`), `writeSongInBook`/`songLines`
  (`journeys-share.js`), `addToNewSetlist` (`journeys-files.js:192`),
  `anotherDeviceSignsIn`, `untilAccountShelf`, `bookRow`
  (`journeys-account.js`).
- Predecessors: `tasks/refinements/books/setlists.md`,
  `tasks/refinements/account/new_device.md` (the fill's Decision 6:
  clone one at a time, in shelf order).

## Constraints / requirements

1. **A book is listable only once it has a commit.** `hasCommits(bookId)`
   (`resolveRef('main')`) is the test, the same one `fillOnce` uses. A
   directory with no `HEAD`, or a `HEAD` with no `main`, is not a book yet:
   it contributes no setlists and no index. A local book is committed when
   it is made (`books.js:65-90`, `my-songs.js:55-81`), so this never hides a
   real book.
2. **`LIST_SETLISTS` never waits on a lock.** It is a read of present files.
   It walks the working tree with `readdir` (skipping `.git`, as `songPaths`
   does) for `*.setlist.md` files and parses each one. It no longer calls the
   book tree's `statusMatrix` or takes the book lock. A file present in the
   working tree is exactly what `tree()` reported as not `deleted`, so the
   rows are the same as today. A book whose read throws (any error, not just
   `ENOENT`) is skipped and the rest are listed. `SETLISTS` is always posted
   unless the `/books` listing itself fails.
3. The walk lives in a new Worker module, `app/src/worker/setlist-list.js`:
   `listSetlists({ fs, bookDir, bookIds, hasCommits })` →
   `[{ bookId, path, title, count }]`, sorted as today (book order, then path
   order). It is framework-free and logs nothing (no titles, no text).
   `logic.js` calls it with its existing `ensureFs`, `ensureGit().bookDir`,
   `listBookIds` and `hasCommits`.
4. **The Setlists screen leaves *Loading* on an error.** `SetlistsScreen`
   records that a list is in flight when it sends `LIST_SETLISTS` and clears
   that on `SETLISTS`. An `ERROR` while a list is in flight and the slice is
   still `null` replaces *Loading setlists…* with `setlists.failed` — *The
   setlists on this device couldn't be read.* — and a **Try again** button
   (RAC `Button`, `setlists.retry`) that re-sends `LIST_SETLISTS` and shows
   *Loading* again. An `ERROR` with nothing in flight is ignored, as in
   `UploadPreview.jsx:135-147`. If a list is already showing, a later failed
   re-list leaves it in place. The message is a `role="status"` paragraph:
   the state is a sentence, not a colour.
5. **Setlists re-lists when a book lands.** Besides `SETLIST_UPDATED` and
   `SAVED`, the screen re-sends `LIST_SETLISTS` on a `SHELF_FILL` whose state
   is `ready`. A book that finishes cloning while Setlists is open then shows
   its setlists.
6. **No index for a book with no commit.** `buildIndexes` skips a book with
   no commit. It posts no `INDEX_STATUS` for it, and it drops any records
   the hydrated index holds for it (`removeBook` → `persistIndexChanges`).
   The shelf fill indexes the book after its clone lands (`fillOnce` →
   `indexOneBook`), so it shows up then. `indexOneBook` itself is unchanged.
7. **Search shows a book coming down by its fill word.** `SearchScreen`
   reads the `fill` slice. A book whose fill entry is `waiting` or `cloning`
   is listed among the books, even with nothing indexed yet. Its section
   meta is the shelf's word from `fillDisplayFor` (*waiting*, *cloning
   40%*), never *0 songs*. The order of precedence is: fill not `ready` →
   fill word; index `building` → *still loading*; otherwise the song count.
   Such a section offers no new-song or Save all affordance (nothing is
   there to write into yet).
8. **The add-by-link clone heals a half-cloned directory.** `cloneOntoShelf`
   treats the book as already here only when `hasCommits(serviceId)`.
   Otherwise it runs `clearPartialClone(serviceId)` and then clones. Opening
   the same link twice still never clones into a book that is there.
9. New strings (`setlists.failed`, `setlists.retry`) land in all four
   locales (`en`, `pt-BR`, `es-419`, `it`). Search reuses the existing
   `books.fill*` keys.
10. Standing rules: Worker ownership (the view never touches IndexedDB or
    git; `listSetlists` is Worker-only). Offline first (every read is local,
    and nothing waits on a clone). Accessibility (RAC `Button`, keyboard
    path to Try again, axe at WCAG 2.1 AA). No song text or titles in logs.

## Acceptance criteria

Behavior: the Setlists destination always ends in a list, an empty-state
sentence, or a plain failure sentence with Try again. It lists every
readable book's setlists while another book is damaged or still being
cloned. Search never shows *0 songs* for a book that is still coming down;
it shows the shelf's fill word. A directory left half-cloned is never
indexed or listed, and adding the same book by link again heals it.

Tests, by level:

- **unit** — `app/src/worker/setlist-list.test.js`, over lightning-fs on
  fake-indexeddb (`createFileSystem`), with books built by isomorphic-git
  `init`/`add`/`commit` and fixture setlists written for the purpose:
  - a good book beside a **`HEAD`-less directory** (a `/books/<id>` holding a
    `*.setlist.md` and an empty `.git`): only the good book's setlists are
    returned, and nothing throws (Constraints 1-2; H1);
  - a good book beside a **book with `HEAD` → `refs/heads/main` and no
    `main`** (`git.init` with no commit, plus a setlist file in the tree):
    only the good book's setlists (Constraint 1; M8);
  - a book whose setlist read throws a non-`ENOENT` error (an injected
    `hasCommits`/`fs` stub that throws for one book) is skipped and the
    other is listed (Constraint 2);
  - rows match today's shape and count: `title`, and `count` of `song` +
    `unlinked` items. A setlist in a subfolder is listed by its path, and
    `.git` is never walked (Constraint 3; workflow 12 §The file).
- **behavior**, each UI one with an axe check of what it renders:
  - `app/src/worker/setlist.behavior.test.js` (the real Worker, loopback):
    - `LIST_SETLISTS` with a `HEAD`-less directory beside a seeded book
      replies `SETLISTS` with the seeded book's setlists, and no `ERROR`
      (H1);
    - `LIST_SETLISTS` replies while another book's lock is held for the
      whole test (`navigator.locks.request('book:<id>', …)` never released
      until the end). The reply holds the free book's setlists; the held
      book's also come back, read lock-free (Constraint 2; DIRECTION §3.7
      offline first).
  - `app/src/worker/search-index.behavior.test.js`: bring-up over a
    directory with `HEAD` and no `main` beside a seeded book posts
    `INDEX_STATUS` only for the seeded book, and `BROWSE` lists only it
    (Constraint 6; M8).
  - `app/src/worker/add-by-link.behavior.test.js`: `ADD_BY_LINK` for a book
    whose directory a prior clone left with `HEAD` and no `main` clones it.
    Its songs are then readable and `hasCommits` is true. A second
    `ADD_BY_LINK` of a complete book still does not clone again
    (Constraint 8).
  - `app/src/books/SetlistsScreen.behavior.test.jsx` (new; fake Worker as in
    `SetlistView.behavior.test.jsx:70-111`):
    - an `ERROR` after `LIST_SETLISTS` replaces *Loading setlists…* with
      `setlists.failed` and Try again. Try again re-sends `LIST_SETLISTS`
      and, on `SETLISTS`, the list renders. Keyboard path: Tab to Try
      again, Enter (Constraint 4);
    - an `ERROR` with no list in flight (sent after `SETLISTS`) leaves the
      list as it is (Constraint 4);
    - a `SHELF_FILL { state: 'ready' }` re-sends `LIST_SETLISTS`;
      `waiting`/`cloning` do not (Constraint 5);
    - axe clean on the loading, failed and listed states.
  - `app/src/songs/SearchScreen.behavior.test.jsx`: with `SHELF_FILL`
    `waiting` for one book and `cloning 40` for another, and nothing
    indexed for either, both sections are listed and read *waiting* and
    *cloning 40%*. Neither reads *0 songs*, and neither offers New song.
    After `SHELF_FILL ready` and `INDEX_STATUS ready` with songs, the
    section reads its song count (Constraint 7; workflow 2 L177-179). Axe
    clean.
- **e2e-web** — `e2e/web/tests/setlists-resilient.spec.js`, on phone,
  tablet and computer (every project):
  - *a book still coming down beside one that is here: Setlists lists the
    one that is here, and Search says the rest are waiting*. Device A
    (`signedInDevice`): `makeLocalBook` *Banda do Bairro*,
    `writeSongInBook` with a song written for the purpose,
    `addToNewSetlist` into *Ensaio de sábado*, `putBookOnline`; then three
    more books made and put online; `syncNow`;
    `untilAccountShelf(… 4 live books)`. Device B (`anotherDeviceSignsIn`):
    once *Banda do Bairro* is *ready* and another row is *cloning*, as at
    `new-device.spec.js:241`, `context.setOffline(true)`. The rest go back
    to *waiting*. `gotoTab('Setlists')`: *Ensaio de sábado* is listed and
    *Loading setlists…* is gone. Search: the books not yet here read
    *waiting*, and no book section reads *0 songs*. Back online, `syncNow`:
    the rest reach *ready* on the shelf. Axe (`analyzeBothThemes`) on
    Setlists and Search while offline (workflow 12 §The file; workflow 2
    L177-179; workflow 13 §What comes down).
  - Real UI only: the offline seam is `context.setOffline`, as the lint
    sanctions (`e2e/web/eslint.config.js:54`). No new journey is needed.

No follow-up tasks are deferred.

## Decisions

1. **List setlists lock-free from the working tree, rather than add a
   try-lock.** Setlists only needs the files present, which is what a
   `readdir` walk gives (the index sweep already reads books this way,
   `search-index.js:379-399`, and `fillOnce` calls `hasCommits` lock-free).
   A `withLock(…, { ifAvailable })` variant was rejected. It would drop a
   book's setlists from the list whenever a sync or save held the lock, and
   then need a re-list trigger for each of them. It would also add an API to
   `locks.js`, which is deliberately minimal (locks Decision 4). The cost of
   reading without the lock is that a re-list during a checkout may see a
   half-checked-out tree. It is a read-only list of titles, and the next
   `SHELF_FILL ready` / `SAVED` re-lists. The book lock still guards every
   write.
2. **"Has a `main` commit" is the one test of a book being here.** It is the
   test the fill already trusts (`hasCommits`, `clearPartialClone`). A
   per-directory `.git/HEAD` check was rejected: `HEAD` exists in exactly the
   half-cloned state M8 reports. Local books are committed on creation, so
   no real book is hidden.
3. **The new module is for the unit level.** `LIST_SETLISTS` lives inside
   `createWorkerLogic`, which only behavior tests reach. The note asks for
   unit tests of it, so the walk moves into `setlist-list.js` over injected
   `fs`/`bookDir`/`hasCommits`, following `book-tree.js`. The behavior tests
   then pin the wiring and the lock.
4. **`ERROR` handling by in-flight state, not a protocol change.** Envelopes
   carry no request id (`protocol.js:808-815`). Adding correlation would
   reshape every command, out of proportion for one screen. The two screens
   that already react to `ERROR` use an in-flight flag, and this follows
   them. A failed re-list over a showing list stays quiet: the list on
   screen is still true for what it shows.
5. **Search reuses the shelf's fill words.** The shelf and Search then
   describe one book in one way (*waiting*, *cloning 40%*), and workflow 2
   L177-179 ("says it is still loading") is met with a more exact word. A
   new *still coming down* string was rejected as a second wording for the
   same state.
6. **Heal in `cloneOntoShelf` as well.** M8's half-cloned book reaches the
   shelf only through the add-by-link path: an interrupted clone leaves
   `.git`, and a retry skips the clone. The fill already heals with
   `clearPartialClone`, so the same helper, under the same test, closes the
   only other route.
7. **The e2e case is a book still coming down, not a damaged directory.**
   The only real-UI way to leave a directory with no `HEAD`, or with `HEAD`
   and no `main`, is to close a tab mid-clone. An offline error makes
   isomorphic-git remove `.git`, and `clearPartialClone` removes the rest.
   Closing a tab mid-clone cannot be timed reliably, and injecting the state
   is barred by `e2e/web/eslint.config.js`. So the damaged directory is
   pinned at the unit and behavior levels. The e2e level carries the promise
   the user sees: one book here and others still coming down, Setlists lists
   the one that is here (not *Loading* forever), and Search says *waiting*,
   not *0 songs*. This reshapes the note's e2e wording ("a damaged local
   book directory beside a good one"). It does not drop the level.
8. **No design delta.** Workflow 2 L177-179, workflow 12 §The file and
   workflow 13 §What comes down already promise this. The code fell short
   of them.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- `app/src/worker/setlist-list.js` (new): lock-free `listSetlists` walk over the working tree, skipping a book with no commit or one that throws; wired into `LIST_SETLISTS` in `app/src/worker/logic.js`.
- `app/src/worker/logic.js`: `buildIndexes` skips and drops a book with no commit; `cloneOntoShelf` heals a half-cloned directory with `clearPartialClone`.
- `app/src/books/SetlistsScreen.jsx`, `setlist.css`: failure sentence with Try again on `ERROR`, re-list on `SHELF_FILL ready`.
- `app/src/songs/SearchScreen.jsx`: a book still coming down shows its fill word, never *0 songs*, and offers no New song.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`: `setlists.failed`, `setlists.retry`.
- Tests: unit `app/src/worker/setlist-list.test.js`; behavior `setlist`, `search-index`, `add-by-link`, `SetlistsScreen` (new), `SearchScreen`; e2e-web `e2e/web/tests/setlists-resilient.spec.js` (phone, tablet, computer).
