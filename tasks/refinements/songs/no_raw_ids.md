# songs.no_raw_ids — No raw book ids and no file-name titles in lists

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) — `task no_raw_ids` (line 183), in
milestone `m3_service` (`tasks/99-milestones.tji:32`).

## Effort estimate

1d.

## Repository

The app only: `app/src/books/`, `app/src/songs/`, `app/src/shell/AppShell.jsx`,
`app/src/worker/` (`logic.js`, `shelf.js`, `upload.js`, a new
`readme-title.js`), `app/src/i18n/locales/*.js`, and their tests; one new e2e-web
spec and one new fixture zip under `e2e/web/`. Nothing under `cifra.md/`,
`service/` or `api/`.

Design delta (rides in this task's commit):
`docs/workflows/02-find-and-play.md` §Edge cases (L180-185) and
`docs/workflows/07-add-a-book.md` §The book-management screen (L16-21) — see
Decision 1.

## Inherited dependencies

No `depends` in the `.tji`. Leaned on, all complete: `books.shelf` (the
`shelf.json` registers, `surfaceShelf`, CREATE_BOOK, RENAME_BOOK),
`books.upload` (IMPORT_UPLOAD, the zip preview), `songs.search` (book sections,
song rows, recents), `songs.new_song` (the `untitled.cifra.md` placeholder,
`newSong.untitled`), `songs.editor_chrome` (the unsaved list),
`songs.history`, `songs.reading`, `foundation.e2e_web`.

## What this task is

Two labels fall back to something the user never named. **Books**: every book
label resolver falls back to the opaque book id when this device's shelf entry
carries no title, so `local-6467d4de-…` appeared in the search sections, the
Books list and the song header's meta. **Songs**: a song with no title is
listed by its placeholder file name (`untitled-2`) in search rows, setlist
rows, the unsaved list, history and the song headers, where workflow 3 says
only the file view shows it. The task makes every resolver fall back to a
localized *Untitled book* / *Untitled song* instead, and has the Worker put
back on the shelf, at OPEN, a local book that is on the device but missing from
this device's shelf namespace, titled from its README's level-1 heading.

## Why it needs to be done

Usability review 2026-10-19, findings L1 and L2, verified against the code.

**L2 — ids as labels.**

- `titleFor` (`app/src/books/book-display.js:31-33`) is `label ?? title ??
  bookId`; its callers are the Books list (`BooksScreen.jsx:115`, `:695-696`),
  `BookBar.jsx:63`, `BookDetail.jsx:330`, `FileView.jsx:46`,
  `AppShell.jsx:935, 949, 1223`, `AddToSetlist.jsx:73, 202`,
  `SetlistsScreen.jsx:65`, `SetlistView.jsx:171`, `WhichBook.jsx:55`,
  `UploadPreview.jsx:303`, `LeaveDialogs.jsx:141`, `saveTargetFor`
  (`book-display.js:232`) and `unsaved-list.js:32`.
- `bookLabelFor` (`app/src/songs/first-run.js:39-45`) is the same rule over the
  `shelf` slice, ending in `|| bookId`; callers: `SongReading.jsx:335` (rendered
  as the header meta at `:669`), `NewSongHost.jsx:107`, `WhichBook.jsx:48`, and
  `SearchScreen.jsx:588` (the wrapper used for sections `:813`, song rows `:707`,
  recents `:789`, setlist rows `:700`, the scope chip `:426-428, :633`, *searched
  in* `:727`).
- `SongHistory.jsx:258` — `bookLabel || bookId`, and its only caller,
  `AppShell.jsx:1241-1247`, passes no `bookLabel`, so history **always** shows
  the id.
- `unsaved-list.js:34` — `labels.get(bookId) ?? bookId`.
- The Worker writes an id as a label in one place: FORK's
  `entry?.label?.value ?? bookId` (`app/src/worker/logic.js:2675`).

**Why an entry is missing** (the note asks): nothing reconciles the
repositories under `/books` against the shelf. `buildIndexes`
(`logic.js:1003-1017`) indexes every directory with a commit (`listBookIds`,
`logic.js:287-296`) whatever the shelf says, so a book with no entry in this
device's `local` namespace still gets a search section — labelled by its id —
while `orderedBooks` (`book-display.js:155-176`) drops it from the Books list.
`handleOpen` (`logic.js:1584-1631`) never reads a book's README. The ways a
`local-…` repository ends up without this device's entry:

1. **The device id changes while the files stay.** `deviceId` lives in the
   `estante` database's `meta` record (`home-book.js:394-424`); `shelf.json` and
   the books live in the separate `estante-fs` database (`logic.js:416-418`). If
   the browser evicts or the user clears the first and not the second,
   `ensureDeviceId` mints a new id and every local entry moves to `elsewhere`
   (`shelf.js:78-111`) — exactly the device-namespace mismatch the note guesses.
2. **A lost flush.** CREATE_BOOK writes the repository (`books.createLocal`),
   then the shelf register, and flushes once at the tail (`logic.js:2446-2482`);
   the filesystem's debounced superblock save (`fs.js:43-50, 167-172`) can persist
   the repository before the shelf commit, and a reload in that window keeps the
   book without its entry. IMPORT_UPLOAD's `new_book` (`logic.js:2353-2375`) has
   the same window.
3. **LEAVE_ESTANTE** (`logic.js:2989-3038`) deletes the home book and only the
   directories listed in `local[deviceId]`, so an already-orphaned directory
   survives with an empty shelf.

The sign-in attach is **not** a cause: `home.sync` unions the namespaces and
keeps this device's `local[<dev>]` (pinned by
`new-device.behavior.test.js:404-437`). Each cause above is a crash window or
outside the app, so the fix is a heal at OPEN (Decision 3), not a change at
each writer.

**L1 — file names as titles.** `songTitle(title, path)`
(`app/src/songs/search-query.js:79-83`) returns the file name minus
`.cifra.md` for a titleless song; it renders search and setlist rows
(`SearchScreen.jsx:209, 255`) and the unsaved list (`unsaved-list.js:53, 71`).
The song headers fall back to the whole path: `SongReading.jsx:530, 542, 706`,
`SongWizard.jsx:523, 580`, `SongArrange.jsx:466, 507`, `EditSongHost.jsx:82`,
`SongHistory.jsx:257`, and `SetlistView.jsx:260` (a setlist's song list, the
file name with its suffix). Workflow 3 §Its file name
(`docs/workflows/03-write-a-new-song.md:37-41`) says the placeholder name
"only the file view shows"; workflow 2's edge case said the opposite and is
corrected here (Decision 1).

## Inputs / context

- `docs/workflows/03-write-a-new-song.md:37-41` — the placeholder name shows
  only in the file view.
- `docs/workflows/02-find-and-play.md:180-185` — the edge cases, as amended by
  this task.
- `docs/workflows/07-add-a-book.md:16-21` — a book's title, as amended.
- `docs/DIRECTION.md:74` (§2.1) — "A book's title is the level-1 heading of its
  README, or the repository name."
- `docs/home-book-format.md` §4.2 (`shelf.json`, `local[<device-id>][<book-id>]`
  = `{ title, position }`), §7 (a device writes only its own namespace).
- Resolvers and their tests: `app/src/books/book-display.js:13-33`
  (`registerValue`, `titleFor`), `book-display.test.js:27-43`;
  `app/src/songs/first-run.js:39-45`, `first-run.test.js:26-53`;
  `app/src/songs/search-query.js:70-83`, `search-query.test.js`;
  `app/src/songs/unsaved-list.js:8-71`, `unsaved-list.test.js`.
- i18n: `app/src/i18n/index.js:125` (`t`); `newSong.untitled` *Untitled song*
  at `locales/en.js:1046` (pt-BR `:962`, es-419 `:963`, it `:962`). No
  *Untitled book* string exists. The pure modules hold no i18n by design (their
  header comments say so); the views call `t()`.
- Worker: `handleOpen` (`logic.js:1584-1631`), `surfaceHomeBookShelf`
  (`:1061-1068`), `buildIndexes` (`:1003-1017`), `listBookIds` (`:287-296`),
  `hasCommits`, `nextShelfPosition` (`:298-315`), CREATE_BOOK (`:2446-2482`),
  IMPORT_UPLOAD `new_book` (`:2353-2375`), RENAME_BOOK (`:2531-2561`), FORK
  (`:2660-2685`); `shelf.js:127-137` (`surfaceShelf`); `home-book.js`
  (`read`, `set`, `ensureLocal`, `ensureDeviceId`).
- Upload: `app/src/worker/upload.js:70-76` (`titleFromReadme`, private),
  `createFirstCommitBook` (`:515-555`, the hard-coded `'Untitled'`),
  `importVerbatim` (`:561-582`).
- Behavior rigs: `app/src/worker/books.behavior.test.js:56-82` (`makeWorker`,
  fake IndexedDB, `createWorkerLogic` over `createLoopbackEndpoint`, the device
  id precomputed), `:139` (the cold-reopen case to model on);
  `app/src/worker/upload.behavior.test.js` (IMPORT_UPLOAD),
  `app/src/worker/fork.behavior.test.js` (FORK);
  `app/src/songs/SearchScreen.behavior.test.jsx`,
  `SongReading.behavior.test.jsx`, `SongHistory.behavior.test.jsx`,
  `app/src/books/BooksScreen.behavior.test.jsx`.
- e2e-web: `e2e/web/tests/upload.spec.js` (the upload journey and the fixture
  convention, `e2e/web/fixtures/upload/book.zip`); `e2e/web/lib/journeys.js:26`
  `startApp`, `:33` `gotoTab`, `:171` `makeLocalBook`, `:185` `openBookSongs`,
  `:280` `openSongFromSearch`; `e2e/web/lib/journeys-files.js:17` `uploadZip`;
  `e2e/web/lib/journeys-edit.js:11` `addSection`, `:49` `backToSearch`;
  `e2e/web/lib/journeys-core.js:16` `toSearch`; the new-song entry points in
  `e2e/web/tests/new-song.spec.js:49, 125`; `e2e/web/playwright.config.js:39-42`
  (phone, tablet, computer).
- Predecessor refinements for continuity: `tasks/refinements/songs/new_song.md`,
  `songs/editor_chrome.md`, `songs/search.md`, `songs/unsaved_after_discard.md`.

## Constraints / requirements

1. **No resolver returns an id or a file name.** `titleFor`, `bookLabelFor`,
   `songTitle` and `unsaved-list`'s rows take the localized fallback from their
   caller (Decision 2) and return it when there is no name. A register whose
   value is `''`, whitespace, `null` (a tombstone) or absent is *no name*.
2. **Pure modules stay i18n-free.** The fallback string is a parameter:
   `titleFor(book, untitled)`, `bookLabelFor(shelf, bookId, untitled)`,
   `songTitle(title, untitled)`, `buildUnsavedList({ …, untitledBook,
   untitledSong })` (whatever its entry point is named). Every view passes
   `t('books.untitled')` / `t('newSong.untitled')`.
3. **One string per thing.** New key `books.untitled` — en *Untitled book*,
   pt-BR *Livro sem título*, es-419 *Libro sin título*, it *Libro senza titolo*.
   Songs reuse `newSong.untitled` everywhere (the unused `sheets.untitled` is
   left alone).
4. **Every call site listed under *Why* is moved**, books and songs alike,
   including `AppShell.jsx:1241-1247` passing `bookLabel` (via `titleFor`) to
   `SongHistory`, and `SongHistory.jsx:257-258` falling back to the two strings.
   The **file view** (`app/src/files/`) keeps showing file names — that is what
   it is for. The upload preview (`PreviewRows.jsx:43`) and the conflict and
   bring-in lists (`worker/conflicts.js:111-125`, `worker/bring-in.js:60-78`)
   keep naming files: they are file-level surfaces (Decision 5).
5. **The Worker never writes an id as a label.** FORK (`logic.js:2675`) falls
   back to the book's README heading, then to no label (the register is not
   written); the view then says *Untitled book*.
6. **Backfill at OPEN — the shelf heal.** In `handleOpen`, before
   `surfaceHomeBookShelf`, the Worker reconciles this device's namespace:
   for each id from `listBookIds` that has a commit, starts with `local-` (the
   local-book id shape: `books.createLocal`, upload, *My songs*, the example
   book), and is **absent** from both `shelf.books` and
   `shelf.local[deviceId]` — not tombstoned, absent — it writes
   `local[deviceId][id].position` (`nextShelfPosition`) and, when the working
   copy's `README.md` has a level-1 heading, `local[deviceId][id].title`. An
   entry present in this namespace with a live `position` but no live `title`
   gets its title the same way. All changes go in **one** `home.set` and one
   flush; with nothing to heal there is no write and no commit, so OPEN stays
   as cheap as today on a healthy shelf.
7. **The plan is pure.** `planShelfBackfill(model, deviceId, books)` in
   `worker/shelf.js` — `books` is `[{ id, readmeTitle }]` — returns the
   `home.set` change list (empty when nothing to do). The README heading reader
   moves out of `upload.js` into `worker/readme-title.js`
   (`readmeTitle(bytes|string) → string | null`), used by upload, FORK and the
   backfill.
8. **Never resurrect, never adopt.** A tombstoned entry (the user removed the
   book, or put it online) is left alone; a directory whose id does not start
   with `local-` (a hosted book's clone) is never written into `local` — it has
   a remote and belongs in `books`, which only the shelf fill and add-by-link
   write (Decision 4). Another device's namespace is never written (§7).
9. **Upload stops writing English.** `createFirstCommitBook` and
   `importVerbatim` return `title: null` when the README is missing or has no
   level-1 heading; IMPORT_UPLOAD writes `title` only when it has one. A zip
   with no README still gets one scaffolded (the §2.1 shape) — with the
   localized title the main thread sends in the IMPORT_UPLOAD payload as
   `untitledTitle` (the `mySongsTitle` precedent, `protocol.js:225`), and that
   title on the shelf. A zip whose README has no heading keeps its README as
   written and gets no shelf title, so it reads *Untitled book* in the user's
   language.
10. **No song text in logs.** Nothing new is logged; a README heading is the
    user's words.
11. **Offline first.** The backfill is local; nothing waits on the network.
12. **Accessibility.** Labels change words only; accessible names that embed a
    title or a book (`search.addToSetlist`, `SongReading.jsx:542`, the
    `books.renameLabel` button) carry the localized fallback too. Axe at WCAG
    2.1 AA on every screen the tests render.

## Acceptance criteria

Behavior:

- No list, header, chip, bar or dialog shows a book id; a book with no label
  reads *Untitled book* (in the UI language).
- A titleless song reads *Untitled song* in search, recents, setlist rows, the
  unsaved list, history and the reading, editor, wizard and arrange headers;
  `untitled-2` appears only in the file view.
- After OPEN, a `local-…` book on the device with no entry in this device's
  namespace is on the Books list under its README heading, and its search
  section says so too; a second OPEN writes nothing.
- A zip imported as a new book with a heading-less README is on the shelf as
  *Untitled book*.

Tests, by level:

- **unit**
  - `app/src/books/book-display.test.js` — `titleFor`: label wins over title;
    `''`/whitespace/`null` registers fall through; an empty or missing book
    returns the passed fallback; the result is never the id (the existing id
    cases at `:37-43` are rewritten to expect the fallback). Pins workflow 7
    L16-21 (amended), Constraint 1.
  - `app/src/songs/first-run.test.js` — `bookLabelFor`: the same table over the
    `shelf` slice; never the id (`:46-53` rewritten). Constraint 1.
  - `app/src/songs/search-query.test.js` — `songTitle`: a title is kept; `''`,
    whitespace and missing return the fallback; never the placeholder file name
    (`untitled-2`). Pins workflow 3 L37-41, workflow 2 L180-182 (amended).
  - `app/src/songs/unsaved-list.test.js` — a current row whose book is not on
    the shelf has meta *Untitled book*, not the id; titleless rows read the
    passed song fallback; a folder still follows the book (`Untitled book ·
    sets/`). Constraint 1-2.
  - `app/src/worker/readme-title.test.js` (new) — the level-1 heading of
    string and byte input; trimmed; a `##` heading is not a title; the first
    `#` heading wins; no heading / empty / `null` → `null`. Pins DIRECTION §2.1.
  - `app/src/worker/shelf.test.js` — `planShelfBackfill`: an absent local book
    gets position (next past every position) and its README title; a heading-less
    one gets position only; an entry with live position and no title gets the
    title; a tombstoned entry, a `shelf.books` entry and a non-`local-` id yield
    nothing; another device's namespace is never in a change path; a healthy
    shelf yields `[]`. Constraints 6-8.
- **behavior**
  - `app/src/worker/books.behavior.test.js` (the `makeWorker` rig, fake
    IndexedDB), new cases:
    - *OPEN puts a local book with no shelf entry back under its README
      heading* — CREATE_BOOK, delete its `local[deviceId][id]` registers through
      `createHomeBook(...).set` in the test, restart the logic and OPEN: the
      `SHELF` event's `local[id].title.value` is the README heading and it has a
      position (workflow 7 L16-21; cause 1-2 above).
    - *A second OPEN writes nothing* — the home book's `main` oid is unchanged
      across a further restart and OPEN (Constraint 6).
    - *A removed book is not resurrected* — tombstone the entry (as
      `removeFromShelf` does) leaving the directory: OPEN leaves it tombstoned
      (Constraint 8).
    - *A hosted clone with no `books` entry is not adopted as local*
      (Constraint 8).
  - IMPORT_UPLOAD's behavior suite (`app/src/worker/upload.behavior.test.js`):
    a zip whose README has no heading → `BOOK_CREATED`, and the shelf entry has
    a position and no title; a zip with no README → the scaffolded README and
    the shelf title are the payload's `untitledTitle` (Constraint 9).
  - FORK's suite (`app/src/worker/fork.behavior.test.js`): a hosted entry with
    no `label` forks under its README heading, never the id (Constraint 5).
  - `app/src/songs/SearchScreen.behavior.test.jsx` — a book section, a song
    row's meta, a recent and the scope chip for a book absent from the `shelf`
    slice read *Untitled book* and nowhere contain the id; a titleless song's
    row reads *Untitled song*, not `untitled-2`; axe clean (workflow 2 L180-185).
  - `app/src/books/BooksScreen.behavior.test.jsx` — a `local` entry with a
    position and no title is a row named *Untitled book*; axe clean.
  - `app/src/songs/SongReading.behavior.test.jsx` — the header meta of a song
    in a book with no shelf label reads *Untitled book*; a titleless song's
    heading reads *Untitled song*, not its path; axe clean.
  - `app/src/songs/SongHistory.behavior.test.jsx` — with no `bookLabel` and no
    title, the chrome reads *Untitled book* and *Untitled song*, never the id or
    path; axe clean.
  - `app/src/shell/AppShell.behavior.test.jsx` — history opened from a song in
    a labelled book shows the book's label (the `bookLabel` now threaded,
    Constraint 4).
- **e2e-web** — `e2e/web/tests/no-raw-ids.spec.js` (new), phone, tablet and
  computer projects, real UI only, axe at WCAG 2.1 AA at each assertion point:
  - *A song written without a title is listed as Untitled song* —
    `makeLocalBook`, then its *New song in …* from search (the
    `new-song.spec.js:125` entry), add a chord section only (`addSection`, no
    heading typed), `backToSearch`: the row and (on the computer) the unsaved
    list read *Untitled song*, and `getByText(/untitled-\d|untitled$/)` has
    count 0; open it from search: the reading header reads *Untitled song*
    (workflow 3 L37-41, workflow 2 L180-182). Axe on search and reading.
  - *A book with no title is never shown by its id* — upload
    `e2e/web/fixtures/upload/untitled-book.zip` (new, authored for the test: a
    `README.md` of one prose line with no `#` heading, and one song with a
    title written for the purpose) via `uploadZip` and *Import as a new book*:
    the Books list has a row *Untitled book*; its search section, the song row's
    meta and the song's reading header meta read *Untitled book*;
    `page.getByText(/local-[0-9a-f]{8}/)` has count 0 on each screen; reload
    (`startApp`) and the same holds (workflow 7 L16-21, workflow 2 L183-185).
    Axe on the Books list, search and reading.

  The *missing shelf entry* heal itself has no real-UI path — every cause is a
  crash window or a cleared database (Decision 6) — so it is pinned at the
  behavior level; the e2e level carries the user-visible promise (no id, ever;
  *Untitled book*) through the upload path, which makes a book with no shelf
  title through the real UI.

No deferred work.

## Decisions

1. **Workflow 3 governs; workflow 2's edge case is amended (design delta).**
   Workflow 2 L180-181 said a titleless song "is listed by its file name",
   workflow 3 L37-41 that only the file view shows the placeholder. The task
   note and the review side with workflow 3: `untitled-2` is an artefact of
   naming at first save, not something the user chose. Workflow 2's edge case
   now says *Untitled song*, and adds *Untitled book*; workflow 7's title
   bullet says a book with no name is *Untitled book*, never its id, and that
   the app puts an orphaned local book back on the shelf at open. DIRECTION
   §2.1's "or the repository name" is left as is: it is about books in general
   (a hosted repository has a name the service gives it), and the app's
   resolvers never had the repository name to hand — the README heading is the
   fallback that matters, and the backfill delivers it.
2. **The fallback is a parameter, not a `null` the views fill.** Returning
   `null` would leave twenty-odd call sites each to remember `?? t(…)` — the
   same class of slip that produced the id fallback. Taking the string as a
   required argument keeps the pure modules i18n-free and makes forgetting a
   test failure (the unit tables call without an id path).
3. **Heal at OPEN, not per writer.** Making CREATE_BOOK and IMPORT_UPLOAD
   atomic across two repositories is not possible with the filesystem's
   debounced superblock, and the device-id reset happens outside the app.
   OPEN already walks every book (`buildIndexes`); one more pass, writing only
   when there is something to heal, cures every cause at once, including ones
   not yet found. Rejected: deriving the label from the README in the *view*
   (the main thread never reads the working copy; the label would also be
   absent from the Books list, which only lists shelf entries).
4. **Only `local-…` ids are adopted.** A hosted clone with no `books` entry
   has a remote and a role the shelf cannot infer; writing it into `local`
   would make put-online and leave misbehave. It still never shows its id —
   its search section reads *Untitled book* — and the hosted shelf is the
   shelf fill's to repair. Another device's namespace is never read for a
   title even when the id matches (`local-my-songs` and `local-example-book`
   are fixed ids every device shares, so a match proves nothing).
5. **File-level surfaces keep file names.** The file view, the upload preview
   and the conflict / bring-in lists name *files*: a user there is choosing
   files, and two titleless songs would be indistinguishable as *Untitled
   song*. Workflow 3 names the file view; the other two are the same kind of
   surface.
6. **The e2e book case goes through upload.** The heal's causes cannot be
   reached through the UI (no spec may clear a database, inject state or
   write through the API), so the e2e level pins what the user sees through
   the one real-UI path that yields a book with no shelf title: a zip whose
   README has no heading. That path also had the hard-coded English
   `'Untitled'` (`upload.js:551-586`), which this task removes.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- Every book and song label resolver takes a localized fallback and never returns an id or a placeholder file name: `app/src/books/book-display.js`, `app/src/songs/{first-run,search-query,unsaved-list}.js`; all call sites moved (`app/src/books/*`, `app/src/songs/*`, `app/src/shell/AppShell.jsx`, `app/src/account/LeaveDialogs.jsx`); `books.untitled` added to `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- History now receives the book label and falls back to *Untitled book* / *Untitled song* (`app/src/songs/SongHistory.jsx`, `AppShell.jsx`).
- OPEN heals a `local-…` book missing from this device's shelf namespace, titled from its README heading: `planShelfBackfill` in `app/src/worker/shelf.js`, wired in `app/src/worker/logic.js`; README reader moved to `app/src/worker/readme-title.js`.
- Upload no longer writes English `'Untitled'`; `untitledTitle` rides in the IMPORT_UPLOAD payload (`app/src/worker/upload.js`, `protocol.js`). FORK never writes an id as a label and now carries `untitledTitle` too.
- Tests: unit (`book-display`, `first-run`, `search-query`, `unsaved-list`, `shelf`, new `readme-title`); behavior (`books`, `upload`, `fork`, SearchScreen, BooksScreen, SongReading, SongHistory, AppShell); e2e-web `e2e/web/tests/no-raw-ids.spec.js` with fixture `e2e/web/fixtures/upload/untitled-book.zip`, green on all three viewports.
- Design delta kept: `docs/workflows/02-find-and-play.md`, `docs/workflows/07-add-a-book.md`.
- Not changed: a setlist's own header still falls back to its file name (`SetlistView.jsx`); no follow-up.
