# songs.search_scope_follows — Search after a save shows where the song went

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task search_scope_follows` under
`task songs` (`tasks/60-songs.tji:256-261`). `depends !save_sheet, !search,
books.row_opens_songs` (all `complete 100`); the parent `task songs` cascade
(`shell.layout`, `shell.chart`, `foundation.e2e_web`) applies. Wired into
milestone **`milestones.m3_service`** (`tasks/99-milestones.tji:32`). The note:

> "Design and build in one task. Signed in with Roda de Choro, a teacher made
> a song in My songs and saved it: Search came back still scoped to Roda de
> Choro, listing My songs below it with 0 songs (a count within the scope),
> and only clearing the chip showed 1 song; … And a book section expanded in
> Search collapses whenever she switches tabs and comes back. Decide in
> workflow 2 … and draw on W02: decided with the human 2026-10-21: after a
> save, the scope follows the song to the book it was saved to (never stays
> on another book, never clears); while a scope is set, books outside it are
> left out of Search (a scoped Search is that book's songs; other books are
> reached by clearing the chip or from Books); a book section's expanded
> state is kept for the session. … Tests: behavior (SearchScreen: the scope
> after a save to another book, the counts of books outside a scope, the
> expanded state across a tab switch; axe); e2e-web (scoped to one book, a
> new song saved to another, Search shows it and no 0 songs for the book it
> is in, on the three viewports; axe, mockup W02)."

## Effort estimate

**1d**, allocated `team`. Three small changes in the app (a scope rule on
`SAVED`, a filter on what a scoped Search lists, the sections' open state
lifted to the shell), one pure helper, a supplementary board, and two levels
of test.

## Repository

**estante-de-cifras only** — not a `cifra.md:` task.

- `app/src/songs/search-query.js` — two pure helpers beside `INITIAL_SCOPE`
  / `scopePayload` (`:42`, `:55-63`): `inScope(scope, bookId, path)` and
  `followScope(scope, bookId, path)`.
- `app/src/songs/SearchScreen.jsx` — `bookIds` (`:577-584`) and
  `recentItems` (`:558-566`) narrowed to the scope; `BookSection`
  (`:283-389`, its `Disclosure` at `:323`) made controlled.
- `app/src/shell/AppShell.jsx` — the `SAVED` listeners (`:861-873`), the
  scope state (`:295`), a new session-held `expandedBooks` state passed in
  the `search` object (`:1138-1144`) and the computer book-detail split
  (`:1417-1428`); the put-online / fork re-point (`:673-683`) re-keys it.
- `app/src/shell/use-place-history.js` — a `replaceNext` beside `pushNext`
  (`:229-232`, returned at `:260`), setting `forceReplaceRef` like
  `renameBook` / `followSong` do (`:237`, `:250`).
- **Design delta (written with this refinement):**
  `docs/workflows/02-find-and-play.md` — §The search screen (the paragraph
  after *Before anything is typed*, L13-18) and §Scope (the two paragraphs
  after the bar's, L92-108).
- **Board (this task):** new `docs/mockups/Search-scope.dc.html`, and a
  DIRECTION §6 bullet (`docs/DIRECTION.md`, after *Opening a book*,
  L645-653) naming it.
- Tests: `app/src/songs/search-query.test.js`,
  `app/src/songs/SearchScreen.behavior.test.jsx`,
  `app/src/shell/AppShell.routing.behavior.test.jsx`, new
  `e2e/web/tests/search-scope.spec.js`.

## Inherited dependencies

- **`songs.search`** (complete) — the scope is a chip in the box, sent as
  `scope` on `SEARCH` / `BROWSE`; books are collapsible sections from the
  `browse` slice with a per-book count; the scope resets at the start of a
  session (`tasks/refinements/songs/search.md` Decision 8, L530-535: no
  persisted scope). Settled.
- **`songs.save_sheet`** (complete) — the sheet sends `SAVE` /
  `NAME_AND_SAVE` and closes on `SAVED`; nothing was decided about where the
  app goes after it (`tasks/refinements/songs/save_sheet.md` L265-268).
  Settled; this task adds the scope rule.
- **`books.row_opens_songs`** (complete) — the one-book scope is an address
  (`…/b/<book>`, `bookOfScope`, `app/src/shell/place.js:66-71`), the scoped
  book's section opens by default (`defaultExpanded={id === barBook}`,
  `SearchScreen.jsx:832`), and the bar above the results names the book.
  Settled; this task keeps all three.

## What this task is

Three promises on the search screen, decided with the human on 2026-10-21 and
now written into workflow 2:

1. **After a save, the scope follows the song.** When a song is saved into a
   book the current scope does not hold, the scope becomes that book
   (`{ bookId }`): chip, bar, address `…/b/<book>`, its section open with the
   song in it. A save the scope already holds changes nothing; a save with no
   scope leaves none. The move is not a history step.
2. **A scoped Search is that book's songs.** With a scope set, the books
   outside it get no section (and so no *0 songs*), and recents from them
   are not listed. Other books are reached by clearing the chip or from
   Books.
3. **A section's open state lasts the session.** Opening or closing a book's
   section survives a tab switch, a song opened over Search, and an editor;
   a reload starts fresh (every section closed but the scoped book's).

Plus the board that draws them, and the DIRECTION §6 entry.

## Why it needs to be done

The persona exploration (2026-10-20) found a first-time teacher reading
*My songs · 0 songs* beside a search that still found her song. Two causes,
both in `SearchScreen.jsx`:

- `bookIds` (`:577-584`) unions the **scoped** browse slice with the
  **unscoped** `indexSlice` and `fillSlice`, so a book outside the scope gets
  a section with no browse entry, and `BookSection` falls back to
  `count = book?.count ?? 0` (`:312`). That is status that lies.
- Nothing moves the scope after a save: AppShell's `SAVED` listeners
  (`AppShell.jsx:861-873`) only close the new-song or edit host. A new song
  from the no-match *Create* row always lands in My songs (`:747`, `:755`),
  and *Change book* (`WhichBook.jsx:46-81`) can move it anywhere, so the
  scope is left on a book where the song does not show.

And each section is an uncontrolled RAC `Disclosure` (`:323`) inside a
`TabPanel` that RAC unmounts when another tab is chosen (`AppShell.jsx:182-183`,
`:1152-1212`), and inside a shell that full-screen hosts replace
(`:1449-1477`), so its open state is lost on every switch.

## Inputs / context

- **Workflow 2** `docs/workflows/02-find-and-play.md`:
  - §The search screen, *Before anything is typed* (L13-18) — the sections
    are collapsible; **delta:** their open state lasts the session.
  - §Scope (L78-108) — scope resets each session, shown in the box, the
    `…/b/<book>` exception, the bar (L88-90); **delta:** *A scoped search is
    that book's songs* (L92-96) and *After a save, the scope follows the
    song* (L98-108).
- **Workflow 4** `docs/workflows/04-edit-and-save.md` §Saving (L61-63) — the
  sheet closes as soon as the version is kept on this device; no wait on the
  network, so the follow is local.
- **Workflow 7** §A book's songs — the bar, and *Manage*.
- **DIRECTION** §4 (L506-511): "Books are a scope on that search"; §6
  (L645-653) the *Opening a book* entry this task's bullet follows; §3.7 the
  address follows where you are.
- **Mockups:** `docs/mockups/W02-find-and-play.dc.html` draws no scope chip
  and no book section on a phone (computer pane L154-168 draws the unscoped
  Books list); `docs/mockups/Open-a-book.dc.html` draws the chip and the bar
  (Phone 2, Tablet); `docs/mockups/GUIDE.md` (L4, L19-37) the board shape;
  `docs/mockups/canvas.json` (boards keyed by file, `order`; last board
  `Review-polish.dc.html` at `y 43920`, 1620 stride).
- **Code:**
  - `app/src/songs/SearchScreen.jsx` — scope held or lifted (`:489-495`),
    `recentItems` (`:558-566`), `bookIds` (`:577-584`), `bookById`
    (`:586-590`), `barBook` (`:610`), chip ✕ (`:641-652`), sections
    (`:808-837`), `BookSection` (`:283-389`).
  - `app/src/songs/search-query.js:42`, `:55-63` — `INITIAL_SCOPE`,
    `scopePayload`.
  - `app/src/worker/search-index.js:471-479` — the Worker's `matchesScope`
    (the rule `inScope` mirrors on the main thread: `books` list, `bookId`,
    `prefix`); `browse` at `:582-608`.
  - `app/src/worker/protocol.js:465-471` — `SAVED` carries `bookId` and the
    saved `paths`, or for `NAME_AND_SAVE` the final `path`.
  - `app/src/shell/AppShell.jsx` — scope `:295`; `openBookSongs`
    `:1059-1067`; `applyPlace` `:589-601`; re-point on fork / put-online
    `:673-683`; `startNewSong` `:729-741`; `changeBook` `:747-763`; `SAVED`
    listeners `:861-873`.
  - `app/src/shell/place.js:66-71` `bookOfScope`, `:92-97` `isOpening`.
  - `app/src/shell/use-place-history.js:99-260` — push / replace / step-back
    and the `forceReplaceRef` seam.
- **Predecessor refinements:** `tasks/refinements/songs/search.md`
  (Decision 8), `tasks/refinements/books/row_opens_songs.md` (L246-248,
  L280-286), `tasks/refinements/songs/search_book_head_narrow.md`
  (Decision 4: no `mockup()` frame for a board W02 does not draw),
  `tasks/refinements/design/book_row_songs.md` (supplementary board, closer
  registers it in `canvas.json`).
- **Tests to extend:** `app/src/songs/SearchScreen.behavior.test.jsx`
  (`makeStore` L21-27, seeding by `BROWSE_RESULTS` / `INDEX_STATUS` / `SHELF`
  L163-190, the `Scoped` harness L554-557); `e2e/web/lib/journeys.js`
  (`makeLocalBook` L181, `scopeToBook` L319, `saveThroughSheet` L370,
  `gotoTab` L33), `e2e/web/lib/journeys-core.js` (`createSongFromSearch`
  L156, always My songs).

## Constraints / requirements

1. **The follow rule** (`followScope(scope, bookId, path)`, pure):
   - `scope` null → null (a save never sets a scope the person did not);
   - the scope holds the save — `bookId` in `scope.books`, or equal to
     `scope.bookId` with no `prefix`, or with a `prefix` the saved path
     starts with (or no path given) → `scope` unchanged (same object, so no
     re-render, no history entry);
   - otherwise → `{ bookId }` (a one-book scope, an address).
   Applied in AppShell on every `SAVED` (`setScope((prev) =>
   followScope(prev, bookId, path ?? paths?.[0]))`), for a new song and an
   edit alike, whatever tab is showing — the scope is shell state.
2. **Not a history step.** When `followScope` changes the scope, the change
   is applied through `replaceNext()` (new, in `use-place-history.js`,
   setting `forceReplaceRef`): the address becomes `…/b/<saved book>` and
   Back from it leads where Back led from the search the song was written
   from. It must still compose with the host's close (the step back the
   hook makes when the entry below matches) — no dead entry naming the
   editor layer left behind.
3. **A scoped Search lists only what the scope holds.** With a scope set:
   `bookIds` keeps only ids `inScope`; `recentItems` keeps only recents
   `inScope(scope, r.bookId, r.path)`; the song results already are
   (`SEARCH` sends the scope). A book in scope still shows *still loading*
   or its fill word while it builds or comes down (the `indexSlice` /
   `fillSlice` paths stay, filtered). No scope → unchanged (every book).
4. **The count shown is the section's own songs.** A section only exists for
   a book in scope, so its `count` is from that book's browse entry; under a
   folder scope it is the folder's count (the scope is shown in the box, so
   the narrower number is honest). No *0 songs* for a book whose songs the
   scope hides.
5. **Open state for the session.** AppShell holds `expandedBooks`
   (a `Map<bookId, boolean>`) in `useState`, so it survives a tab switch and
   a full-screen host, and is gone on reload (a session, like the scope —
   `search.md` Decision 8). `BookSection` becomes a controlled `Disclosure`
   (`isExpanded` / `onExpandedChange`): a book with an entry uses it, one
   without opens iff it is `barBook` (today's default). A standalone
   `SearchScreen` with no lifted props holds the map itself, as it does the
   scope (`:489-495`). When a book's id changes (fork, put-online,
   `:673-683`) its entry moves with it.
6. **Accessibility.** The trigger keeps `aria-expanded` from RAC; nothing new
   is interactive; the scope change is announced by what already names it
   (the chip and the bar's heading), not a new live region. axe clean.
7. **Offline first, no Worker change.** The follow uses the `SAVED` event
   the Worker already posts when the commit is durable; nothing waits on a
   push. The main thread does not touch IndexedDB; `inScope` is a pure
   main-thread mirror of `matchesScope`, not shared with the Worker module.
8. **Fixtures** are songs written for the purpose; no song text in logs.

## Acceptance criteria

Behavior delivered:

- Scoped to book A, a song saved into book B (new via *Create* into My
  songs, or moved by *Change book*) leaves Search scoped to B: chip and bar
  name B, address `…/b/<B>`, B's section open with the song listed under
  its real count; A is not listed. One Back goes where it went before.
- Scoped to a book, no section, no count, no recent from any other book.
  Clearing the chip lists every book with its own count.
- A section opened (or the scoped one closed) is the same after switching to
  Books and back, and after opening a song and returning; a reload resets it.

Board and docs:

- `docs/mockups/Search-scope.dc.html` (title *2. Search within a book*),
  shaped per `GUIDE.md` (two phones, tablet, computer; the cast, real copy,
  `var(--…)` only): Phone 1 — Search scoped to *Choros da Ana*, its bar, its
  section open, no other book; Phone 2 — just after saving a new song made
  from *Create*, scoped to *My songs*, the song in its open section, *1
  song*; Tablet — the same scoped Search with the section left open after a
  tab switch; Computer — search beside the saved song, the pane scoped to
  the book it went to. The closer registers it in `canvas.json`
  (`boards["Search-scope.dc.html"] = { x: 0, y: 45540, w: 3208, h: 1500,
  title: "2. Search within a book" }`, appended to `order`).
- DIRECTION §6: a bullet after *Opening a book* — "**Search within a book**,
  decided (workflow 2 §The search screen, §Scope) and drawn on
  mockups/Search-scope.dc.html — a scoped search is that book's songs, the
  scope follows a song saved into another book, a section's open state
  lasts the session. No new workflow."
- Workflow 2 delta: already written (see Repository).

Tests, by level:

- **unit** — `app/src/songs/search-query.test.js`, new `describe('scope
  follows a save')`: `followScope` null → null; `{bookId:A}` + save in A →
  same object; `{books:[A]}` + save in B → `{bookId:B}`; `{bookId:A,
  prefix:'choros/'}` + save at `choros/x.md` → unchanged, at `y.md` →
  `{bookId:A}`; and `inScope` for each scope shape (workflow 2 §Scope,
  *After a save*).
- **behavior** — `app/src/songs/SearchScreen.behavior.test.jsx`, new
  `describe('— a scoped search is that book's songs')`:
  - scoped (`Scoped` harness) to A with `INDEX_STATUS` ready for A and B and
    a browse slice of A only: no section and no *0 songs* for B, no recent
    from B; clearing the chip shows B with its count (workflow 2 §Scope,
    *A scoped search*);
  - a book in scope still *still loading* while it builds;
  - the open state: open B's section, unmount and remount `SearchScreen`
    with the same lifted `expandedBooks` (what a tab switch does) — still
    open; a fresh map — closed, the scoped book open (workflow 2 §The
    search screen);
  - axe clean on the scoped screen.
- **behavior** — `app/src/shell/AppShell.routing.behavior.test.jsx`, new
  case *the scope follows a save*: scoped to A at `/b/A`, start a new song,
  emit `NEW_SONG_READY` and `SAVED { bookId: MY_SONGS_ID, path }` —
  Search shows the chip and bar for My songs, `location.pathname` is
  `/b/<my songs>`, `history.length` did not grow by a step for the follow,
  and Back lands where it would have before the song was started; an edit
  saved in the scoped book leaves the scope and address untouched; the
  open state of a section survives choosing the Books tab and Search again
  (workflow 2 §Scope, *After a save*; DIRECTION §3.7). axe on the result.
- **e2e-web** — new `e2e/web/tests/search-scope.spec.js`, on the phone,
  tablet and computer projects, real UI only: `makeLocalBook(page, 'Roda de
  Choro')`, `scopeToBook(page, 'Roda de Choro')`, then a song written for the
  test made through *Create* (`createSongFromSearch`, into My songs) — after
  the save, the chip and bar name *My songs*, the URL is `/b/…`, the song is
  listed in the open section, the page holds no *0 songs* and no *Roda de
  Choro* section; clear the chip — both books, *1 song* for My songs; open
  Roda de Choro's section, `gotoTab` Books and back to Search — still open.
  axe (WCAG 2.1 AA) on the scoped Search after the save (workflow 2 §Scope;
  §The search screen). No `mockup()` call (Decision 4).

No deferred work.

## Decisions

### 1. The follow is a pure helper applied on `SAVED`, for every save
Rejected: following only after `NAME_AND_SAVE` of a new song. An edited song
saved into its own book is always in a scope that showed it, so the rule is
a no-op there; one rule on one event is simpler than a branch per host, and
covers *Change book* and Save all for free. Rejected: opening the saved song
instead — workflow 4 says the sheet closes back to where the writer was; the
note asks that Search *show* the song, which the open section does.

### 2. No scope stays no scope
"Never clears" is about a scope that was set. Setting one on an unscoped
Search would hide every other book after a save, the forgotten-scope
problem §Scope warns of; unscoped Search already lists the saved song.

### 3. The follow replaces the entry rather than pushing one
`isOpening` (`place.js:92-97`) would read a scope change as a step. A
consequence of a save is not a place the person went to; a pushed step would
make Back return to the book where the song does not show. `replaceNext`
reuses the `forceReplaceRef` seam `renameBook` and `followSong` already use.

### 4. Supplementary board, no `mockup()` frame; W02 left as it is
The note says "draw on W02". W02's four frames are fully used for typing,
reading and the computer split, and they are `mockup()` capture subjects by
index (`e2e/web/lib/mockup-frames.json`, `reading.spec.js:45, 132`,
`explorer.spec.js:173`); redrawing one would move those captures. The
precedent is a supplementary board in the workflow's number
(`design/book_row_songs.md`, *Open-a-book*), and, like
`search_book_head_narrow` Decision 4, the e2e calls no `mockup()` for a board
not in `mockup-frames.json` (it throws). Axe and the real-UI assertions
carry the e2e level.

### 5. Open state in AppShell memory, not `sessionStorage`
The scope itself is AppShell `useState` and resets on reload (search.md
Decision 8); the sections' state lives beside it with the same lifetime.
`sessionStorage` would outlive a reload while the scope did not — a section
open for a scope that is gone. No new store or context for one map with
one consumer.

### 6. Recents are narrowed too
*A scoped search is that book's songs* — a recent from another book is a
song outside the scope. Leaving recents unfiltered would keep the confusion
(a song shown, its book not). `inScope` applies the Worker's rule to them on
the main thread from data already there.

### 7. Folder scope counts the folder
Under `{bookId, prefix}` the section's count is the browse count within the
prefix. The scope is visible in the box and the bar, so the number reads as
the folder's; adding an unscoped count beside it would be two numbers for
one row.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-21.

- `app/src/songs/search-query.js`: pure `followScope` / `inScope` helpers beside `scopePayload`.
- `app/src/songs/SearchScreen.jsx`: a scoped Search lists only that book's sections and recents (no misleading *0 songs*); book sections are controlled.
- `app/src/shell/AppShell.jsx`, `app/src/shell/use-place-history.js`: after a save the scope follows the song to its book as a replaced history entry (new `replaceNext`); each section's open state is held for the session and moves with the book on fork / put online.
- Design: `docs/workflows/02-find-and-play.md`, `docs/DIRECTION.md` §6, new board `docs/mockups/Search-scope.dc.html` registered in `docs/mockups/canvas.json`.
- Tests: unit `app/src/songs/search-query.test.js`; behavior `app/src/songs/SearchScreen.behavior.test.jsx` and `app/src/shell/AppShell.routing.behavior.test.jsx`; e2e-web `e2e/web/tests/search-scope.spec.js` (phone, tablet, computer; axe).
- No tech-debt follow-ups; canvas republishing noted in `tasks/parking-lot.md`.
