# songs.show_the_file — Show the file from the reading view

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) — `songs.show_the_file`, lines 126-131:

> Workflow 14 (14.8 in the e2e coverage audit) opens a song's file in the file
> view from its reading view; no task built the entry and the UI has none.
> Source: e2e coverage audit 2026-10-14 (audit/e2e-coverage.md P3). Tests:
> behavior (the action opens the file view on the song's file, axe); e2e-web
> (search → song → Show the file → the file view with the file open, three
> viewports).

`depends !reading, books.file_view`. Milestone: M5 (`tasks/99-milestones.tji:44`).

## Effort estimate

1d.

## Repository

The app only. Nothing lands under `cifra.md/`, `service/` or `api/`:

- `app/src/songs/SongReading.jsx`: a *Show the file* item in the ⋯ menu and
  an `onShowFile` prop.
- `app/src/shell/AppShell.jsx`: `openFile` carries a path as well as a book;
  the reading view's `onShowFile` opens the file view over the song; the
  shell follows a move or delete of the open song made in the file view.
- `app/src/files/FileView.jsx`: an `initialPath` prop that opens the view
  with that file selected.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`: `reading.showFile`.
- Tests: `app/src/songs/SongReading.behavior.test.jsx`,
  `app/src/files/FileView.behavior.test.jsx`,
  `app/src/shell/AppShell.routing.behavior.test.jsx`,
  `e2e/web/tests/file-view.spec.js`, and a helper in `e2e/web/lib/journeys.js`.

## Inherited dependencies

- `songs.reading` — **settled** (complete). The reading view, its props
  (`SongReading.jsx:136-151`) and `{ bookId, path }` as the open song.
- `books.file_view` — **settled** (complete). FileView, the tree, the raw
  editor, the phone's one-pane-at-a-time layout; its refinement deferred this
  entry ("wires the second way into the file view … This task exposes the
  open-at-path seam; `songs.reading` calls it",
  `tasks/refinements/books/file_view.md:632-635`), but the seam was never
  built (FileView has no path prop, `FileView.jsx:31`).
- `songs.reading_chrome` — **settled** (complete, not a `depends` but already
  landed). It built the ⋯ menu as a RAC `MenuTrigger` and named this task as
  the one that adds *Show the file* to it
  (`tasks/refinements/songs/reading_chrome.md:55-57`, `:90-91`).

## What this task is

The reading view's ⋯ menu gains *Show the file*. Choosing it opens the file
view on the song's book, full screen as it always is, with the song's file
selected and open in the raw editor — the tree "opened at that file". Back
from the file view returns to the song's reading view. This is the second of
the two ways into the file view that workflow 14 names; the first (*Files in
{book}* on Books) exists.

## Why it needs to be done

Workflow 14 §The view decides two entries; only one was built
(audit/e2e-coverage.md:275, journey 14.8 "not implemented: no such
affordance in SongReading, and no task"; P3 at :353). It is the path from
"this song" to "the file it is" — the file view's stated purpose is to let a
user see how songs and files relate (workflow 14 L5-8). M5 ("the first pass,
complete") depends on it.

## Inputs / context

- **Workflow 14 §The view**, `docs/workflows/14-file-view.md:132-135`:
  "*files* on each book in the book-management screen, and *show the file* on
  a song's reading view, which opens the tree at that file. Not hidden behind
  a setting". L137-138: tree and file side by side, one at a time on a phone.
- **Workflow 2 §Reading**, `docs/workflows/02-find-and-play.md:96-97`: the
  reading view's actions (edit, history, transpose, print).
- **The ⋯ menu today**: `app/src/songs/SongReading.jsx:529-558` — `moreMenu`,
  `MenuTrigger` › `Button aria-label={t('reading.more')}` › `Popover` ›
  `Menu onAction` with keys `edit`, `history`, `addToSetlist`, `print`,
  `share`, `arrange` (only when not transposed), `fullScreen` (handlers
  539-545, items 548-554). Placed once per layout (715, 739, 757). The same
  menu on every device (reading_chrome Decision 2, `reading_chrome.md:336-348`).
- **The menu-order test**: `SongReading.behavior.test.jsx:787-834` pins
  `SEVEN = ['Edit','History','Add to setlist','Print','Share','Arrange for
  Guitar','Full screen']`.
- **The shell**: `app/src/shell/AppShell.jsx` — `openFile` state holds a book
  id (335); the `files` layer (434) and its closer (455); `openBook(bookId)`
  routes a book needing the user to its conflicts, else `setOpenFile`
  (849-856); FileView is rendered full screen before the reading branch
  (988-994), so it covers an open song; SongReading's wiring (1107-1120).
- **FileView**: `app/src/files/FileView.jsx` — signature (31), `selected`
  state `{ path, kind, isNew }` (43), `selectFile` (67-70), NEW_SONG_READY
  selecting a file programmatically (86-89), FILE_MOVED / FILE_DELETED
  (100-110). FileTree has no collapsible folders (`FileTree.jsx:1-10`): a
  selected path is visible as soon as it is selected.
- **Worker facts**: FILE_MOVED `{ bookId, fromPath, toPath }` and FILE_DELETED
  `{ bookId, path }`, transient (`app/src/worker/protocol.js:612-627`).
- **books.file_view Decision 7** (`file_view.md:721-729`): the file view is a
  full-screen layer with ephemeral state and no address of its own.
- **i18n**: `en.js` `reading` at 1474 (keys 1504, 1512-1518), `fileView` at
  1232; `pt-BR.js` `reading` at 1325.
- **e2e helpers**: `e2e/web/lib/journeys.js` — `openExampleBook` (55),
  `openSongFromSearch` (227), `historyFromReading` (302, the More-menu
  pattern), `openFiles` (316); `e2e/web/lib/journeys-files.js` — `fileRow`
  (34), `backToTree` (38); `journeys-core.js` `SONG` (10).
- **Boards**: no board draws the item; W02's menu
  (`docs/mockups/W02-find-and-play.dc.html:174-178`) predates it. See
  Decision 5.

## Constraints / requirements

1. **One menu item, every device.** *Show the file* is an item of the ⋯ menu
   on phone, tablet and computer, never an inline shortcut, in the same menu
   reading_chrome built (no second menu).
2. **RAC and keyboard.** It is a RAC `MenuItem` with key `showFile`; reached
   by the menu's existing keyboard path (Enter/Space/ArrowDown on More, arrows,
   Enter). axe clean at WCAG 2.1 AA on the reading view with the menu open and
   on the file view it opens.
3. **Opens at the file.** The file view opens on the song's book with the
   Files tab (not History) showing and the song's path selected — its row
   marked selected in the tree and its raw editor open. On a phone, where one
   pane shows at a time, that is the file pane with *Back to files*; on the
   tablet and computer, the tree beside the open file.
4. **Back returns to the song.** The file view is a layer over the song
   (`files` in `layers`, same address); its Back, and the browser's back,
   close it and show the reading view of the same song. Nothing about the
   song's address changes while the file view is open.
5. **The same gate as Files.** It goes through `openBook`'s guard: a book
   needing the user opens its conflicts (workflow 9) instead, as *Files in
   {book}* does. One rule for both entries.
6. **Follows the song.** If, in a file view opened from a song, the user
   renames or moves that song's file (FILE_MOVED with `fromPath` the open
   song's path in its book), the open song follows to `toPath`; if they
   delete it (FILE_DELETED of that path), the open song closes, so Back lands
   on the destination underneath rather than on a reading view of a file that
   is gone.
7. **No new routing.** The file view stays addressless (books.file_view
   Decision 7); the selected path is ephemeral FileView state seeded once
   from `initialPath`. Picking another file in the tree works as before.
8. **Offline first.** Nothing waits on the network: the tree and the file come
   from the Worker's working copy.
9. **Copy, in every locale**: en *Show the file*; pt-BR *Mostrar o arquivo*;
   es-419 *Mostrar el archivo*; it *Mostra il file*.
10. **Fixtures** are purpose-written songs (the example book's), never
    anyone's words.

## Acceptance criteria

### Behavior delivered

1. **The item.** `SongReading` takes `onShowFile`; its ⋯ menu holds, in order,
   Edit, History, Add to setlist, Print, Share, **Show the file**, Arrange for
   {instrument} (when not transposed), Full screen. `onAction('showFile')`
   calls `onShowFile({ bookId, path })`.
2. **The seam.** `FileView` takes `initialPath`; when given, the view opens
   with `selected = { path: initialPath, kind: fileKind(…), isNew: false }`
   and `tab = 'files'`.
3. **The shell.** `openFile` becomes `{ bookId, path }` (path `null` from
   *Files in {book}*); `openBook(bookId, path = null)` keeps its conflict
   guard; SongReading's `onShowFile` calls it; FileView is rendered with
   `bookId={openFile.bookId} initialPath={openFile.path}`. Every other reader
   of `openFile` (the guards at 680, 709) reads `openFile` as truthy as
   before.
4. **Following the song.** While the `files` layer is open over a song, the
   shell's FILE_MOVED / FILE_DELETED handlers update or close `openSong` as
   Constraint 6 says.

### Tests, by level

**Behavior — `app/src/songs/SongReading.behavior.test.jsx`**

- The existing menu-order test (787-834) becomes `EIGHT`, with *Show the file*
  after Share, on phone, tablet and computer. *Pins:* Constraint 1;
  reading_chrome Decision 2.
- *"Show the file in the ⋯ menu opens the song's file"* — open More by
  keyboard (ArrowDown), arrow to *Show the file*, Enter: `onShowFile` called
  once with `{ bookId, path }` of the song; axe clean with the menu open.
  *Pins:* workflow 14 L132-135; Constraint 2.

**Behavior — `app/src/files/FileView.behavior.test.jsx`**

- *"opened at a file: the tree shows it selected and the raw editor holds
  it"* — a book whose tree has `sets/evening/lantern-road.cifra.md` among
  others, rendered with `initialPath` that path on a wide mode: the row is
  marked selected (`aria-current` / the selected word, not colour alone), the
  editor shows that song's text, the Files tab is the selected one; axe clean.
  *Pins:* workflow 14 L133; Constraint 3.
- *"opened at a file on a phone: the file pane, Back to files to the tree"* —
  the same in narrow mode: the file pane with *Back to files*; activating it
  shows the tree with the row selected. *Pins:* workflow 14 L137-138.
- *"without initialPath nothing is selected"* — the existing entry unchanged.

**Behavior — `app/src/shell/AppShell.routing.behavior.test.jsx`**

- *"show the file is a layer over the song; back returns to the song"* — open
  a song, choose *Show the file*: the file view shows with the song's file
  selected, a history step was pushed with the same address; Back (the
  in-app one and `history.back()`) shows the reading view of the same song.
  *Pins:* Constraint 4; books.file_view Decision 7.
- *"a song moved in the file view opened from it follows the move"* — with
  the file view open from a song, a FILE_MOVED event for that path: Back shows
  the reading view at the new path (the address names it). And a FILE_DELETED
  of it: Back lands on the destination, no song open. *Pins:* Constraint 6.
- *"show the file on a book needing you opens its conflicts"* — the book's
  sync phase `needs_you`: the conflicts screen, not the file view.
  *Pins:* Constraint 5; workflow 9.

**e2e-web — `e2e/web/tests/file-view.spec.js`**

- *"show the file from the reading view opens the file view at the song;
  Back returns to it (workflow 14 §The view)"* — on phone, tablet and
  computer: `openExampleBook`, `openSongFromSearch(page, SONG.search,
  SONG.title)`, a new helper `showFileFromReading(page)` (More → menuitem
  *Show the file*, in `e2e/web/lib/journeys.js` next to
  `historyFromReading`); the file view shows `morning-on-the-porch.cifra.md`
  open in the raw editor (its text in `.cm-content`), on a phone with *Back to
  files* and on the wider two with its tree row selected beside it; axe at
  WCAG 2.1 AA on the menu open and on the file view; Back returns to the
  reading view of *Morning on the Porch*. Real UI only — no `#dev/*`, no
  injected state. *Pins:* workflow 14 L132-138; audit journey 14.8.

The levels the note names (behavior, e2e-web) are all here; no level is
dropped. Everything a test needs exists: the example book (first run), search,
the reading view and the file view are all complete; no service or sign-in is
involved. Nothing is deferred; no new WBS leaf.

## Decisions

1. **An `initialPath` prop, not an address for the file view.** The file view
   is addressless by books.file_view Decision 7, and the entry needs only to
   seed the selection once. *Rejected:* a `/book/{id}/files/{path}` address —
   a new routing seam for one entry, against a settled decision, and
   reload-into-the-file-view is not asked for by any workflow.
2. **The file open, not only the row highlighted.** "Opens the tree at that
   file" with a flat tree (no collapsible folders) is satisfied by selecting
   the file, and selecting a file in the file view opens it — the same thing
   a click on its row does; the note's e2e expects "the file view with the
   file open". On a phone that lands on the file pane, one *Back to files*
   from the tree. *Rejected:* a phone landing on the tree with the row
   scrolled into view — a second selection model (highlighted but not open)
   the file view does not have.
3. **Through `openBook`'s guard.** Both entries obey the same rule about a book
   needing the user. *Rejected:* opening the file view over a book in
   conflict from the song — a second behavior for the same destination.
4. **The shell follows a move or delete of the song.** The file view is the
   one place a song's file can be renamed or deleted, and opening it from the
   song makes "came back to a song that is no longer there" reachable for the
   first time. The Worker already emits FILE_MOVED / FILE_DELETED; the shell
   listening to them is the smallest fix. *Rejected:* leaving SongReading to
   show an empty or missing song on Back.
5. **In the menu after Share, no board change.** Workflow 14 decides the
   action exists; reading_chrome Decision 2 decides the menu is the one home
   of every reading action on every device. After Share keeps the board's
   five in their drawn order and the instrument and full-screen items last,
   as reading_chrome placed them. The W02 board predates the action; adding a
   menu row is not a design change needing a board delta (the workflow
   already decides it). *Rejected:* an inline shortcut — workflow 14 L134
   asks only that it not be behind a setting, and the header has no room on
   a phone.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-16.

- The reading view's ⋯ menu gains *Show the file* (key `showFile`, after Share) and an `onShowFile` prop: `app/src/songs/SongReading.jsx`; copy in all four locales, `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- The seam: `FileView` takes `initialPath` and opens with that file selected on the Files tab (`app/src/files/FileView.jsx`); on a phone *Back to files* keeps the file it left marked in the tree.
- The shell: `openFile` is `{ bookId, path }`, `openBook(bookId, path)` keeps the conflict guard, and the file view is a layer over the song (`app/src/shell/AppShell.jsx`).
- Beyond the refinement's list: `followSong` in `app/src/shell/use-place-history.js`, so history entries for a moved or deleted song open where it went or drop the song (without it Back landed on not-here).
- Behavior tests: `app/src/songs/SongReading.behavior.test.jsx` (menu order now EIGHT; "Show the file in the ⋯ menu opens the song's file"), `app/src/files/FileView.behavior.test.jsx` (opened at a file, on a phone, without initialPath), `app/src/shell/AppShell.routing.behavior.test.jsx` (layer over the song, moved, deleted, needs-you conflicts).
- e2e-web: `e2e/web/tests/file-view.spec.js` journey on phone, tablet and computer with the `showFileFromReading` helper in `e2e/web/lib/journeys.js`; `e2e/web/tests/reading.spec.js` MENU gains the new item.
- Tech-debt follow-ups: none.
