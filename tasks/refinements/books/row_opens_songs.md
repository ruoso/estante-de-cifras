# Refinement — `books.row_opens_songs`

## TaskJuggler

[`tasks/65-books.tji`](../../65-books.tji), `task row_opens_songs "A book on
the shelf opens on its songs"` (lines 185-190). The note, in short:

> As design.book_row_songs decides: the book row's press opens the book's
> songs (search scoped to it at …/b/<book>), the row has no other action — the
> management detail is reached from an entry on the book's songs view, and
> Files moves from the row into that detail; a book that needs you opens as
> the design says. Source: launch smoke test 2026-10-19 (the Books tab's only
> visible way into a book was Files). Tests: behavior (the row opens the
> scoped search, its detail entry opens the detail, Files reached from the
> detail, keyboard paths; axe); e2e-web (a book's songs opened from the Books
> tab and a song played from there, the detail reached from the book's songs
> and Files from the detail, on the three viewports; axe, mockup W07 and W14).

## Effort estimate

1d as the `.tji` gives it. That is tight. Beyond the screens, the work also
reroutes the e2e journeys that reach a book's detail through its row
(`openBookRow`, `pressShare`, `openFiles`, the rename in `books.spec.js`, the
conflicts and bring-in specs). If the task runs over, that rerouting is where
the time goes. It is not optional, because those specs would fail without it.

## Repository

estante-de-cifras, **not** `cifra.md/` (the note does not start with
`cifra.md:`). The work lands in:

- `app/src/books/` — `BooksScreen.jsx` (the row, one list), `BookDetail.jsx`
  (Rename, Files, *Back to {book}*), a new `BookBar.jsx` (the bar above a
  book's songs), and their behavior tests;
- `app/src/songs/SearchScreen.jsx` — mounts the bar while the scope is one
  book;
- `app/src/shell/AppShell.jsx` — the row's press as a place, the detail as a
  layer, and Settle / Files / Bring them in wired from the bar and the detail;
- `app/src/worker/` — the per-book song count on `INDEX_STATUS` and a reducer
  slice for it (Decision *The count rides on INDEX_STATUS*);
- `app/src/i18n/locales/*.js` — the new copy, in the four locales;
- `e2e/web/tests/` and `e2e/web/lib/` — a new spec, plus the rerouted journeys.

No `api/` change, no service change, and no design delta: workflows 7, 14, 2
and 9 and DIRECTION §6 were edited by `design.book_row_songs` (commit
3ec1fce).

## Inherited dependencies

All of these are settled (`complete 100`):

- `books.shelf` — `BooksScreen`, `BookDetail`;
- `books.file_view` — `FileView`, the `files` layer;
- `design.book_row_songs` — the workflow text and the `Open-a-book` board.

Also in place and used here:

- the book address and scoped search (`app/src/shell/place.js`,
  `use-place-history.js`);
- conflicts (`BookConflicts.jsx`, `sync.conflicts`);
- the fork's bring-in (`books.bring_in`).

Every e2e prerequisite already exists. The example book needs no account
(`openExampleBook`, `e2e/web/lib/journeys.js:55`). A hosted book comes from
`books.online` (`putBookOnline`, `hostedBook`). Two people and a conflict
come from the conflicts spec's existing `ownerAndAna`. A fork with new saves
comes from `bring-in.spec.js`'s existing setup.

Downstream: `books.detail_as_drawn` (`tasks/65-books.tji:203-207`) reorders
the detail on top of this task. This task is in milestone M3
(`tasks/99-milestones.tji:32`).

## What this task is

This task builds what `design.book_row_songs` decided.

On the Books screen, each row:

- shows its song count (*14 songs*, or *still loading*) in the meta line;
- loses its Files button, rename pencil and *Bring them in* button;
- has one action: pressing it opens the book's songs, i.e. search scoped to
  the book at `…/b/<book>`.

The Books screen is one list at every width, with no split and no *Pick a
book* pane.

On a book's songs, a bar between the search box and the results shows:

- the book's title;
- the meta line;
- its sync state in words;
- **Manage** (accessible name *Manage {book}*);
- when the book waits on the user, a notice:
  - for a book that needs you: *{count} songs need you.* with **Settle**;
  - for a fork whose original has new saves: *{original} has {count} new
    saves.* with **Bring them in**.

**Manage** opens the book's detail as a layer over its songs. The detail:

- gains **Rename** in its title and a **Files** card after Download;
- has *Back to {book}* as its Back.

Removing or leaving the book returns to Books.

## Why it needs to be done

The launch smoke test (2026-10-19) found that the only visible way into a
book from the Books tab was **Files**. Pressing the row opened the management
detail (`openBookDetail`, `app/src/books/BooksScreen.jsx:912-919`), so the
plain way to a book's songs was missing, and the advanced one was the default.

Workflow 7 §The book-management screen now says that pressing a book opens
its songs. This task makes the app do it. `books.detail_as_drawn` then
reorders the detail that this task makes reachable from the book.

## Inputs / context

**Governing documents (normative):**

- `docs/workflows/07-add-a-book.md`:
  - §The book-management screen (L12-38): the row's meta with *how many
    songs* (L21-23); *Pressing a book opens its songs* … *That is the row's
    one action* (L28-34); one list on a tablet and a computer (L36-37).
  - §A book's songs (L58-95): the bar (L60-67); when it shows, and that
    clearing the scope removes it (L69-73); the two notices (L75-85); the
    detail as a layer, with Rename, Files after Download, and remove or leave
    returning to Books (L86-95).
  - §Links to books (`…/b/<book>` is the book's songs).
- `docs/workflows/14-file-view.md` §The view (L130-135): reached by **Files**
  on the detail, via *Manage*. Back returns to where it was opened from.
- `docs/workflows/02-find-and-play.md` §Scope (L60-72): the row opens the
  same place as the address. The bar shows while the scope is one book.
- `docs/workflows/09-conflicts.md` §Meeting one (L31-33): pressing the book
  opens its songs with the notice and **Settle**.
- `docs/DIRECTION.md` §6, the *Opening a book* bullet.
- `tasks/refinements/design/book_row_songs.md`: Decisions, the new-copy
  table, and Acceptance 1-5 (what each test pins).
- Boards:
  - `docs/mockups/Open-a-book.dc.html`: Phone 1 the rows; Phone 2 *My songs*
    open with the bar; Tablet a book that needs you with **Settle**; Computer
    the detail beside the book's songs with **Files**.
  - `docs/mockups/W07-add-a-book.dc.html`: Phone 1 rows with counts; the
    Computer frame is the detail over the book's songs.
  - `docs/mockups/W14-file-view.dc.html`: inside Files.

**The app as built:**

- `app/src/books/BooksScreen.jsx`:
  - `BookRow` 183-250. The row button is at 196 (`onOpen`). Meta 189-193.
    Files is a sibling button at 213-219 (`fileView.filesFor`). Then come
    `RenameDialog` 220 (component 256-303) and the fork's Bring them in
    234-247.
  - `openBookDetail` 912-919: a needs-you book goes to `onOpenBook`.
  - The detail is built at 921-936. The wide split is `.books-split` at
    1054-1071 with `books.pickBook`. Narrow is `detail ?? listView` at 1073.
  - `BOOKS_WIDE_QUERY` is imported at 43, and BooksScreen is its only user
    (`app/src/shell/layout-mode.js:36`).
- `app/src/books/BookDetail.jsx`:
  - Props 234-242 (`onBack`, `onReselect`, `onShare`).
  - The appbar and narrow Back (`books.detailBack` *Back to books*) are at
    358-367. Chips 370-388.
  - Cards: Download 466-473, Fork 475-484, Remove 486-498, Leave 500-524,
    Share 526-540, Delete 542-548.
  - It has no Files and no Rename. A removed or left book calls `onBack`
    (321, 325).
- `app/src/songs/SearchScreen.jsx`:
  - Scope is controlled by the shell (422-453).
  - The scope chip with ✕ *Clear filter* is at 556-567. `scopeChipLabel` is
    at 399-405.
  - `BookSection` is at 283-372: count/still loading at 296-303, and the
    *Search only in {book}* button at 346-352 sets `{books:[id]}` (731).
- `app/src/shell/place.js`:
  - `placeFromUrl` 38-51 (`/b/<book>` → `{tab:'search', book}`);
    `urlFromPlace` 55-61.
  - `bookOfScope` 66-71 accepts `{bookId}` (no prefix) or `{books:[id]}`.
  - `isOpening` pushes when a one-book scope opens.
- `app/src/shell/AppShell.jsx`:
  - `scope` state 270. `place` and `layers` 446-467 (`files` at 458).
  - `applyPlace` 507-519 sets `{bookId}` from `next.book`.
  - `openConflicts` 934-937 (selects Books when wide). `openBook` 938-945
    (needs-you → conflicts, otherwise `setOpenFile`).
  - Conflicts render at 1148-1161 (the Books content when wide, framed on a
    phone). `FileView` at 1225-1236 (`back(closers.files)`). `onShowFile`
    at 1372.
  - The computer reading split is `SongReading.jsx:725-737` (side pane
    `SearchScreen`, `computer = mode === 'wide' && actionsInline`, :189, at
    `READING_ACTIONS_WIDE_QUERY` 1080px, `layout-mode.js:44`).
- Worker:
  - `INDEX_STATUS` `{bookId, state}` is emitted at `app/src/worker/logic.js`
    993/996 (`indexOneBook`), 1690 (a visible re-index), 1126/2602/2711
    (`null`).
  - `songCountOf(bookId)` is at 1259-1263 (songs only, unsaved included,
    from the search index's `browse`).
  - The `index` slice is at `reducer.js:75-80`, its case at 384-393.
  - The `browse` slice is scoped by SearchScreen's current BROWSE
    (`reducer.js:396-401`, `SearchScreen.jsx:498`), so it cannot serve the
    shelf.
- Copy, reused from `app/src/i18n/locales/en.js`:
  - `search.songCount`, `search.stillLoading`;
  - `books.onDevice` / `onEstante` / `canSave` / `reader`;
  - `books.needsYou`, `bookConflicts.needsYou` (:1275-1278);
  - `books.originalNewSaves`, `books.bringIn` / `bringInLabel`;
  - `books.renameLabel` / `renameTitle` / `renameField`;
  - `fileView.filesEntry` / `filesFor` (:1309-1311);
  - `books.detailBack` (:178, retired by this task).
- Tests today:
  - `app/src/books/BooksScreen.behavior.test.jsx`: Rename at 379; the fork's
    Bring them in at 479-534.
  - `app/src/books/BookDetail.behavior.test.jsx`.
  - `app/src/shell/AppShell.behavior.test.jsx:249-292`: *Files in Choros da
    Ana* on a needs-you book sends OPEN_CONFLICTS.
  - `app/src/songs/SearchScreen.behavior.test.jsx`.
- e2e journeys that press the row for the detail:
  - `openBookRow` (`e2e/web/lib/journeys-sync.js:74`), used by conflicts
    (:113), add-by-link, leave-book, new-device and fork;
  - `pressShare` (`e2e/web/lib/journeys-share.js:150`);
  - `openFiles` / `openFileInFiles` (`e2e/web/lib/journeys.js:368-377`);
  - `gotoTab`'s *Back to books* step (`journeys.js:38`);
  - `books.spec.js:18`, which renames on the row.
- e2e mockup captures today: W07 #1 and #4 at `online.spec.js:27/53`, #2 at
  `books.spec.js:44`, #3 at `upload.spec.js:61`; W14 #1-4 at
  `file-view.spec.js:83/90/123/183` and `file-view-create.spec.js:65/161`.
  `Open-a-book` is not in `e2e/web/lib/mockup-frames.json`.

## Constraints / requirements

- **React Aria Components for every control**: the row, Manage, Settle,
  Bring them in, Rename, Files, and Back.
- **Keyboard:** the row is one tab stop, and Enter or Space opens the book's
  songs. On a book's songs, the reading order is the box (with the chip and
  ✕), then the bar (Manage, then the notice's button), then the results.
- **Status in words:** the sync state, *still loading*, *needs you*, the
  notice text, and *conflict* on a song.
- **axe WCAG 2.1 AA** on every screen touched.
- **Offline first:** opening a book's songs, its bar and its detail reads
  only local slices (`shelf`, `sync`, `originals`, the new `songCounts`).
  Nothing waits on the network.
- **The Worker owns the data:** the count comes from the Worker's index. The
  view never touches IndexedDB.
- **No new address:** the detail is a layer (in `layers`, with a closer).
  - Reloading with the detail open lands on `…/b/<book>`.
  - The row's press is the place `{tab:'search', book}`, pushed, so the
    browser's Back returns to Books.
  - Back from the detail returns to the book's songs. Back from Files opened
    from the detail returns to the detail.
- **The bar** shows exactly when `bookOfScope(scope)` names a book, or the
  scope is `{bookId, prefix}` (a folder in it). It stays while typing, and
  goes when the scope is cleared.
- **A needs-you book's press opens its songs**, never the conflicts directly.
  Its conflicts are reached by **Settle**.
- **Show file:** `onShowFile` from the reading view still opens the file view
  at the song, as workflow 14 says. `openBook`'s needs-you diversion is
  dropped (conflicts are reached by Settle), but the upload's and the
  bring-in's `onNeedsYou` still open the conflicts directly
  (`books.upload_ui` Decision 2).
- **Put online from the detail:** the book's id changes (`onReselect`, the
  service id). The open detail, the scope and the place follow the new id, as
  the scope already follows a fork (`SearchScreen.jsx:457`).
- **Canonical form, no song text in logs:** the task does not touch either.
- **Test fixtures** use the example book and the songs the existing specs
  write for the purpose. Never real lyrics.

## Acceptance criteria

### Behavior delivered

1. **The row.**
   - Each book row is a single RAC `Button`. Its content: title; `{where} ·
     {role} · {count} songs` (or `· still loading` while the book's index
     state is `building` or no count has arrived); the sync badge in words;
     a fork's *from {original}* and new-saves line; ▸.
   - The row has no Files, no pencil and no Bring them in.
   - Pressing the row, for every sync phase including `needs_you`, selects
     Search with the scope `{bookId}`. That pushes `…/b/<book>`.
2. **One list.**
   - The Books screen has no `.books-split` and no `books.pickBook`.
   - BooksScreen no longer imports `BOOKS_WIDE_QUERY`, and the constant is
     deleted (its only user was BooksScreen), with its comment.
   - `books.pickBook` is removed from the four locales.
3. **The count rides on INDEX_STATUS.**
   - Every `INDEX_STATUS` with `state: 'ready'` carries `songs:
     songCountOf(bookId)`.
   - The reducer keeps a `songCounts` slice keyed by `bookId`. Only that
     book's entry moves, and a `null` status removes the entry.
4. **The bar** (`app/src/books/BookBar.jsx`) is rendered by SearchScreen
   above the results while the scope is one book or a folder in it. It
   shows:
   - the title (the shelf label);
   - the meta line, the same as the row's;
   - the sync state in words when the book is out of step;
   - **Manage**, with aria-label *Manage {book}*;
   - the needs-you notice: *{count} songs need you.* (`bookConflicts.needsYou`)
     with **Settle** (aria-label *Settle conflicts in {book}*), which opens
     the shell's conflicts for the book;
   - the fork notice (`books.originalNewSaves`) with **Bring them in**
     (`books.bringInLabel`), which opens the bring-in preview as the row's
     button did.

   It is gone once ✕ clears the scope.
5. **The detail as a layer.**
   - **Manage** sets a new shell layer, `bookDetail`, holding `{bookId}`.
   - Its layout follows the reading view's split rule (Decision *The detail
     splits where a song does*):
     - at `READING_ACTIONS_WIDE_QUERY` (the computer), it is the main pane
       beside a side pane holding the book's songs;
     - below that (the phone and the 712px tablet), it is full screen with
       *Back to {book}* (new key, replacing `books.detailBack`).
   - Removing, leaving or deleting the book closes the layer, clears the
     scope, and selects Books.
6. **Rename and Files on the detail.**
   - The title carries **Rename**, the RenameDialog moved from the row. Its
     aria-label is `books.renameLabel`, and it sends `RENAME_BOOK` as before.
   - A **Files** card follows Download: heading *Files*, the line *Every file
     in the book, as it is stored.*, and a **Files** button with aria-label
     `fileView.filesFor`. The button opens the `files` layer on the book.
7. **New copy** in the four locales (en, pt-BR, es-419, it):
   - *Manage*, *Manage {book}*;
   - *Settle*, *Settle conflicts in {book}*;
   - *Back to {book}*;
   - *Every file in the book, as it is stored.*;
   - the row meta's count appended with the shipped `search.songCount` and
     `search.stillLoading`.

   The i18n key-parity test stays green.

### Tests, by level

**unit** (this level is added to the note's clause, because of the Worker
change):

- `app/src/worker/reducer.test.js`: `INDEX_STATUS` with `songs` sets
  `songCounts[bookId]`, leaves the other books' references, and a `null`
  state drops it. Pins workflow 7 L21-23.
- `app/src/worker/example-book.behavior.test.js` (the Worker driven over a fake IndexedDB; it already indexes the example book through `indexOneBook`):
  the `ready` status after indexing the example book carries `songs` equal
  to its song count, and a new song written in it and re-indexed emits the
  count plus one.

**behavior** (Testing Library plus axe):

- `app/src/books/BooksScreen.behavior.test.jsx`:
  - the row reads *On this device · can save · 2 songs*, and *still loading*
    while building (workflow 7 L21-23);
  - pressing the row calls `onOpenBookSongs(id)` for an in-step book and for
    a `needs_you` book (workflow 7 L28-34; workflow 9 §Meeting one);
  - keyboard: Tab reaches the row as one stop, Enter opens it, and no Files,
    pencil or Bring them in button is in the row (workflow 7 L32);
  - no *Pick a book* pane in a wide mode (L36-37);
  - axe clean.

  The existing Rename case (379) and the fork's Bring them in cases
  (479-534) move to the BookDetail and BookBar tests below. The fork row
  keeps its *N new saves* words.
- `app/src/books/BookBar.behavior.test.jsx` (new):
  - title, meta and **Manage** (*Manage {book}*), which calls
    `onManage(bookId)`;
  - a `needs_you` book shows *2 songs need you.* and **Settle**, which calls
    `onSettle(bookId)`;
  - a fork with new saves shows the line and **Bring them in**, which sends
    `PREVIEW_BRING_IN`;
  - an in-step book shows no badge and no notice;
  - axe clean.

  Pins workflow 7 §A book's songs, L60-85.
- `app/src/songs/SearchScreen.behavior.test.jsx`:
  - with scope `{bookId}`, the bar renders between the box and the results,
    and comes after the chip's ✕ and before the first result in tab order;
  - with `{books:[id]}` (*Search only in*) and `{bookId, prefix}` the bar
    shows;
  - typing keeps it;
  - ✕ clears the scope and the bar goes;
  - a two-book scope or no scope shows no bar.

  Pins workflow 7 L69-73 and workflow 2 §Scope.
- `app/src/books/BookDetail.behavior.test.jsx`:
  - **Rename** in the title opens with the current name, sends
    `RENAME_BOOK`, and the title re-labels (workflow 7 L89);
  - the Files card sits after Download with its line, and its button (*Files
    in {name}*) calls `onFiles(bookId)` (workflow 7 L91-93; workflow 14 §The
    view);
  - the narrow Back reads *Back to {book}*;
  - axe clean.
- `app/src/shell/AppShell.behavior.test.jsx`:
  - pressing a Books row selects Search scoped to the book, with the place
    URL `/b/<book>`;
  - **Manage** opens the detail layer, and Back returns to the book's songs;
  - **Files** from the detail opens the file view, and its Back returns to
    the detail;
  - **Settle** on a `needs_you` book sends `OPEN_CONFLICTS` and shows the
    conflicts panel. This replaces the case at 249-292;
  - removing the book from its detail lands on Books.

  Pins workflow 7 L28-34 and L86-95, and workflow 14 L132-134.

**e2e-web** (Playwright, phone, tablet and computer, axe at WCAG 2.1 AA on
each screen):

- `e2e/web/tests/open-a-book.spec.js` (new), on the example book (no account
  needed):
  - Books shows the row with *… songs* and no Files button. axe.
    `mockup('W07-add-a-book', 1)` moves here from `online.spec.js:27` only if
    that capture's state is the same. Otherwise both stay.
  - Pressing the row: the URL is `/b/<book>`, the search box holds the scope
    chip, and the bar shows **Manage**. axe.
  - *Morning on the Porch* is opened from the list and its chart shows (a
    song played from the book's songs).
  - Back to the book's songs. **Manage** opens the detail (phone: *Back to
    Example Book*; computer: the detail beside the book's songs). axe.
  - **Files** opens the file view on the book (`mockup('W14-file-view',
    1)`), and Back returns to the detail.
  - Reloading with the detail open lands on the book's songs.

  Pins workflow 7 §The book-management screen and §A book's songs, workflow
  14 §The view, and W07 / W14.
- Rerouted, kept green (the same user promises, through the new path):
  - `openBookRow` becomes *Books → row → Manage* (renamed `openBookDetail`),
    serving conflicts, add-by-link, leave-book, new-device and fork;
  - `pressShare` goes through Manage;
  - `openFiles` / `openFileInFiles` go through Manage → Files;
  - `gotoTab` steps back through *Back to {book}*;
  - `books.spec.js:18` renames through Manage → Rename, keeping
    `mockup('W07-add-a-book', 2)`;
  - `online.spec.js` keeps its `mockup('W07-add-a-book', 4)` at the detail,
    now over the book's songs on the computer.
- `e2e/web/tests/conflicts.spec.js`: `ownerCollidesAndEngages` presses the
  book row, asserts the book's songs with *… songs need you.* and the
  *conflict* badge, axe, then **Settle** and the existing paused-panel
  assertions (workflow 9 §Meeting one).
- `e2e/web/tests/bring-in.spec.js`: the *Bring them in from {original}*
  button is pressed on the book's bar after pressing the row, and the row
  still reads the count. The existing W11 #2 capture is taken on the bar's
  state (workflow 11; workflow 7 L83-85).

No `Open-a-book` mockup captures are taken: the board is not in
`mockup-frames.json`, and `mockup()` throws on an unknown frame (Decision
*No Open-a-book captures*).

**No deferred follow-ups.** `books.detail_as_drawn` already exists and owns
the rest of the detail's order.

## Decisions

### The count rides on INDEX_STATUS, in its own slice

**Chosen:** `INDEX_STATUS` `ready` carries `songs: songCountOf(bookId)`, and
a new `songCounts` slice holds it. The row and the bar read it, and the
`index` slice keeps its word.

**Rejected:**

- **BooksScreen reads `browse`.** That slice is the result of SearchScreen's
  current scoped BROWSE, so with one book open, every other row would read
  0.
- **A second unscoped BROWSE from the Books screen.** It would clobber the
  scoped listing.
- **Changing `index[bookId]` to an object.** That touches every reader of
  the build state for no gain.

The count is the same number the book's search section shows (songs only,
unsaved included), so the row and the section agree.

### The detail is a shell layer, not BooksScreen state

**Chosen:** `bookDetail` joins `layers` with its closer, the way `files`,
`people` and `conflicts` do, so Back, popstate and reload behave like every
other surface.

**Rejected:** keeping `openDetail` in BooksScreen and jumping to the Books
tab. Workflow 7 puts the detail over the book's songs, and the Books
screen's detail pane is gone.

### The detail splits where a song does

**Chosen:** the computer (`READING_ACTIONS_WIDE_QUERY`, 1080px) draws the
detail in the main pane beside the book's songs, as `SongReading` does
(`SongReading.jsx:725-737`). Below that, it is full screen with Back.
Workflow 7 says *on a tablet and a computer it takes the main pane … as a
song does*, and in the app a song takes the whole screen on the 712px
tablet, so following the song is the faithful reading.

**Rejected:** a split at `WIDE_QUERY` (600px). A 340px side pane beside a
340px rail leaves the detail no room at 712px. This is the reason
`BOOKS_WIDE_QUERY` existed (`layout-mode.js:24-36`).

### Settle opens the existing conflicts surface

**Chosen:** **Settle** calls the shell's `openConflicts` (with
`OPEN_CONFLICTS`), unchanged in placement. Back from it returns to the
book's songs (the entry before it).

**Rejected:** a new conflicts placement inside search. It is not drawn, and
`sync.conflicts_polish` settled where that panel sits.

### `openBook` splits into its two meanings

**Chosen:** the shell's `openBook(bookId, path)` becomes `openFiles` (show
file, the detail's Files) and `openConflicts` (Settle, upload/bring-in
`onNeedsYou`). A new `openBookSongs(bookId)` handles the row.

**Rejected:** keeping the needs-you check inside the file opener. It would
send a person who presses Files on a needs-you book to the conflicts, which
is today's surprise in another place.

### The e2e journeys are rerouted, not duplicated

**Chosen:** change `openBookRow`, `pressShare`, `openFiles` and `gotoTab` in
`e2e/web/lib/` so every spec that reaches the detail goes through the real
path, *row → Manage*. They are real-UI journeys, which is what the lint
requires.

**Rejected:** leaving old helpers for the old path. That path no longer
exists.

### No Open-a-book captures

**Chosen:** the new spec asserts the board's states without
`mockup('Open-a-book', n)`. The board is not in `mockup-frames.json`, and
regenerating it is `audit/render-mockups.mjs`'s job in a board pass. The
precedent is `tasks/refinements/account/sign_in_two_doors.md`, Decision *No
mockup capture of the Sign-in board*. The note's "mockup W07 and W14" is
met by the existing W07 #1, #2 and #4 and W14 #1 captures, taken on the new
path.

## Open questions

(none — all decided.)

## Status

**Done** — 2026-10-20.

- Pressing a book on the shelf opens its songs at `/b/<book>` with a bar above them (*N songs*, Manage, and Settle or Bring them in when the book waits on you): `app/src/books/BookBar.jsx`, `app/src/books/book-bar.css`, `app/src/songs/SearchScreen.jsx`.
- Books is one list; the row's only action is the press (`app/src/books/BooksScreen.jsx`, `books.css`, `book-display.js`); Manage opens the detail as a layer, now with Rename and Files (`app/src/books/BookDetail.jsx`, `book-detail.css`); BringIn's Back reads *Back to {book}* (`BringIn.jsx`, `bring-in.css`).
- The song count comes from the Worker on `INDEX_STATUS` (`app/src/worker/logic.js`, `protocol.js`, `reducer.js`).
- Shell routing for the scoped book and the openBook split (`app/src/shell/AppShell.jsx`, `use-place-history.js`, `layout-mode.js`); strings in the four `app/src/i18n/locales/*.js`.
- Beyond the refinement: a needs-you row engages its merge but the bar never does; the scoped book's section opens by default; songs in an engaged merge read *conflict*; Back shows on the computer's detail; a fork made from the detail lands on Books with its one-time note.
- Tests: unit `app/src/worker/reducer.test.js`, `app/src/books/book-display.test.js`, `app/src/worker/example-book.behavior.test.js`; behavior `BookBar.behavior.test.jsx` (new) and cases in `BooksScreen`, `BookDetail`, `SearchScreen`, `AppShell`, `AppShell.routing`; e2e-web `e2e/web/tests/open-a-book.spec.js` (new), journeys in `e2e/web/lib/` rerouted, and specs `books`, `online`, `conflicts`, `bring-in`, `fork`, `leave-book`, `lost-access`, `notice-surface`, `portal`, `sign-out`, `add-by-link`, `full-height`.
- Tech debt: none.
