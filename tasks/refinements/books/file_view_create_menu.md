# books.file_view_create_menu — Create a song, a setlist, a folder or a README in the file view

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji) — `task file_view_create_menu`
(`books.file_view_create_menu`), under milestone `milestones.m5_complete` (listed in
`tasks/99-milestones.tji` L44):

> Workflow 14 (What can be done to a file, first bullet) lets the file view
> create a song, a setlist, a folder or a README; the app offers only New
> song. Add the create menu the W14 board draws, and on a phone the board top
> bar (icon actions, the title not collapsed) and the open file header with a
> ... menu holding Rename and Delete. Source: UI audit 2026-10-14 (app
> screens vs rendered boards; e2e/web/lib/mockup.js). Tests: unit (the new
> file names and their templates); behavior (each create kind, axe); e2e-web
> (Books → Files → create each kind, then it appears in the tree and opens;
> mockup W14#1-2).

## Effort estimate

2d (from the `.tji`). Roughly: half a day for the Worker command and the
pure name/template module with its unit tests, a day for the view (the menu,
the setlist and folder dialogs, selectable folder rows, the phone bars) with
its behavior tests, half a day for the e2e journey and the helper updates
the renamed controls force.

## Repository

Lands **outside `cifra.md/`** (the note does not start with `cifra.md:`):

- `app/src/files/` — the view (`FileView.jsx`, `FileTree.jsx`,
  `RawEditorHost.jsx`, a new `CreateMenu.jsx` and `NewNameDialog.jsx`,
  `file-view.css`, `icons.jsx`) and a new pure module `new-file.js` with
  `new-file.test.js`;
- `app/src/worker/` — one new command (`protocol.js`, `logic.js`,
  `working-copy.js`) and its cases in `file-ops.behavior.test.js`;
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the `fileView` copy;
- `e2e/web/lib/journeys-files.js`, `e2e/web/tests/file-view.spec.js` (and a
  new `e2e/web/tests/file-view-create.spec.js`).

**Design delta (rides in this task's commit):**
`docs/workflows/14-file-view.md` — §Statuses (L142-145) gains the *empty*
word for a folder just made, and §What can be done to a file (L147-171)
says what *New* opens and where each kind goes: the folder being looked at,
a setlist named as it is made and starting with only its title, a folder
shown *empty* until a file is in it, the README holding the book's title and
offered only when there is none. Already written in the working tree.

## Inherited dependencies

- `books.file_view` — **settled** (complete 100). It built the tree, the
  raw editor, Rename (`MOVE_FILE`), Delete (`DELETE_FILE`), the change list
  and Save…, and the *New song* button (its Decision 6 left the other kinds
  to this task).
- Transitively settled and reused: `songs.new_song` (`NEW_SONG { folder }`,
  the placeholder, `NAME_AND_SAVE` at first save), `books.setlists`
  (`setlistFilename`, `writeSetlist` through `addToSetlist`),
  `books.file_view_history_polish` (the rename dialog's links),
  `books.file_view_spec_narrow_comment` (the viewport facts the e2e relies
  on).

## What this task is

The file view's *New song* button becomes the W14 board's *New* menu with
four entries — **Song** (`*.cifra.md`), **Setlist** (`*.setlist.md`),
**Folder** (*exists once a file is in it*) and **README.md** (or the
disabled line *README.md already exists*). Each creates in the folder being
looked at. A song goes through the existing new-song path. A setlist is
named in a small dialog and written empty (its title only) by a new Worker
command that also writes a README. A folder is named in the same dialog and
held by the view as an *empty* folder row, chosen, so the next song or
setlist goes in it. Folder rows become choosable, which is how a person
points *New* at a folder. On a phone, the tree's top bar carries History and
New as icon buttons so the *Files* title is not squeezed. The open file has
one bar — *Back to files*, the file name, and a **More** (⋯) menu holding
*Rename* and *Delete* — in place of today's two stacked bars.

## Why it needs to be done

Workflow 14 §What can be done to a file (L147-171) promises four kinds of
create, and the app offers one. The 2026-10-14 UI audit (rendered boards
against `mockup()` screenshots) found the phone frames W14#1-2 off in three
ways:

- the menu is missing;
- the text buttons squeeze the title to an ellipsis;
- the open file shows its path twice, in two stacked bars.

Without this task there is no way in the app to start a setlist except from
a song (workflow 12's *Add to setlist*). There is also no way to make a
folder except by renaming a file into one, and no way to restore a README
once it is deleted. `milestones.m5_complete` depends on the task.

## Inputs / context

### Governing design

- `docs/workflows/14-file-view.md`:
  - L24-36: what a book may hold;
  - L137-138: the tree and the file collapse to one at a time on a phone;
  - L142-145: statuses as words (now with *empty* for a folder);
  - L147-171: what can be done to a file, including this task's delta;
  - L181-185 (around): a new book's README holds its title as a level-1
    heading.
- `docs/workflows/03-write-a-new-song.md`:
  - L14 and L32-33: a song started from the file view goes "in the folder
    being looked at";
  - L37-48: named at the first save, `untitled.cifra.md` until then;
  - L64-75: the template.
- `docs/DIRECTION.md`:
  - §2.1 L63-74: a book holds songs, setlists, `README.md` and
    `.gitattributes`, and its title is the README's level-1 heading;
  - §4 L507-510: the file view, where renaming, moving and deleting happen.
- `docs/mockups/README.md` L26: every status badge carries a word.

### The mockup (`docs/mockups/W14-file-view.dc.html`)

- **#1, phone, the tree (L28-64).**
  - Top bar (L30-35): a Back icon, the title *Files*, and icon buttons
    labelled **History** (clock) and **New** (`+`).
  - The create menu (L58-63) is a card dropped under `+`, about 210px wide,
    with items *Song* `*.cifra.md`, *Setlist* `*.setlist.md`, *Folder*
    *exists once a file is in it*, and the plain line *README.md already
    exists*.
  - Caption (L51): "A book holds songs (*.cifra.md), setlists
    (*.setlist.md), README.md and .gitattributes, and nothing else."
- **#2, phone, one file open (L66-86).**
  - Top bar (L68-72): **Back to files**, the file name in mono
    (`tarde-clara.cifra.md`, the base name), and a **More** icon (three
    dots). No menu is drawn for it.
  - Body (L74): a meta line "Banda do Bairro · mpb/" with the *unsaved
    changes* badge, then the raw editor.
  - Footer: *Discard* / *Save*.
- **#3, tablet (L94-123).**
  - Top bar: text buttons **History** and **New**.
  - The file header: **Rename** and an icon **Delete**, as the app already
    does on wide.
- Frames: `e2e/web/lib/mockup-frames.json` L381-404 (#1-2 phone, #3 tablet,
  #4 computer). Helper: `e2e/web/lib/mockup.js:45`
  `mockup(page, board, index, { note })`. It only captures with
  `ESTANTE_E2E_MOCKUPS`, and asserts nothing.

### The code seams this extends

- `app/src/files/FileView.jsx`:
  - L43 `savable`;
  - L45-67 the view state (`selected`, `leftPath`, dialogs);
  - L87-96 `newSong()` sends `NEW_SONG { targetBookId, folder, mySongsTitle }`
    with the folder of the selected file;
  - L98-102 `NEW_SONG_READY` selects `{ path, kind: 'song', isNew: true }`;
  - L131-143 `SAVED` moves the selection;
  - L187-204 the top bar's `filesActions` (History, *New song*);
  - L226-233 Delete on a new song flushes, then opens `DiscardConfirm`;
  - L280-299 the narrow open-file bar (`file-view-narrow-editor`, *Back to
    files*, the full path);
  - L300-311 the narrow tree, where `showTopBar` hides the top bar while a
    file is open;
  - L321 the wide title "{book} · Files".
- `app/src/files/RawEditorHost.jsx` L28-46: the second bar,
  `appbar raw-editor-head`. It holds the path, *Rename* (`aria-label`
  "Rename {name}", songs and setlists that are not new; hidden at L30) and
  the Delete icon (`aria-label` "Delete {name}", every file).
- `app/src/files/FileTree.jsx` L39-78: `role="group"`. Folders are static
  `div.row.file-folder`; files are RAC `Button.row.file-row` with
  `aria-pressed` and a `StatusBadge`.
- `app/src/files/file-tree.js`:
  - `buildTree` (L66) builds folders from file paths only;
  - `splitPath` (L130), `kindSuffix` (L145), `baseWithoutSuffix` (L158).
- `app/src/files/icons.jsx`: Plus, Clock, Folder, File, Trash, ChevronLeft,
  Lock. There is no dots icon yet; `SongReading.jsx` L108-116 has
  `MoreIcon`.
- The ⋯ menu pattern to follow:
  - `app/src/songs/SongReading.jsx` L555-590:
    `MenuTrigger > Button.btn.icon aria-label="More" > Popover > Menu
    className="menu" onAction > MenuItem id`;
  - `app/src/books/SetlistView.jsx` L274-289.
- Worker:
  - `app/src/worker/logic.js` L3137-3188 `NEW_SONG` allocates
    `deriveSongFilename('', folderNames(bookId, folder))` and writes nothing,
    leaving it to the editor's first `WRITE`;
  - `logic.js` L961-972 `folderNames` (a missing folder reads as `[]`);
  - `logic.js` L1673-1690 `WRITE` writes and reindexes the path as unsaved;
  - `logic.js` L2018 `BOOK_TREE`, and L2113 `ADD_TO_SETLIST`, which creates
    a setlist with a first song;
  - `app/src/worker/working-copy.js`: L104-116 `write` (mkdirp under the
    book lock), L47 `kindOfPath`, L402-447 `addToSetlist` (the model
    `{ title, properties: [], body: [] }` through `writeSetlist`), L442 the
    returned ops.
  - `app/src/worker/protocol.js` L217-227 `NEW_SONG`, L291-324 the file-view
    and setlist commands, L612-635 `NEW_SONG_READY` and `TREE`.
- Names:
  - `app/src/songs/song-filename.js`: `slugify` (L49), `deriveSongFilename`
    (L72);
  - `app/src/books/setlist-display.js` L129: `setlistFilename(title,
    existing)`, which gives a slug plus `.setlist.md`, `untitled`, `-2`/`-3`.
- Existing tests this task extends:
  - `app/src/files/FileView.behavior.test.jsx` (uses `makeStore()`; no case
    presses *New song*);
  - `app/src/worker/file-ops.behavior.test.js`;
  - `app/src/worker/new-song.behavior.test.js` (no `folder` case yet);
  - `e2e/web/tests/file-view.spec.js`, which clicks *New song* at L84 and
    `Rename ${SHORT_SET}` inline at L98;
  - `e2e/web/lib/journeys-files.js` L71-87 `renameOpenFile` /
    `deleteOpenFile`, which click `Rename {name}` / `Delete {name}` buttons.

### Predecessor decisions carried forward

- `tasks/refinements/books/file_view.md`:
  - Decision 6 (L710-720): only *Song* worked in that task, and "a dead
    Setlist entry would mislead". That is why the setlist entry lands here
    working, not stubbed.
  - Decision 7 (L721-729): view state is ephemeral `useState`, with no
    router.
- `tasks/refinements/songs/new_song.md`:
  - Decision 2 (L613-629): the Worker allocates the placeholder against the
    working copy;
  - Decision 7 (L683-694): `NEW_SONG { folder }`.
- `tasks/refinements/books/setlists.md`:
  - Decision 3 (L445-456): new setlists are written canonically with
    `writeSetlist`, and the change stays unsaved until `SAVE`.

## Constraints / requirements

1. **What a book may hold, and nothing else** (workflow 14 L24-36). The menu
   creates exactly four kinds. A setlist path always ends `.setlist.md`, a
   README is `README.md` at the root only, and a folder is never written to
   git empty: no `.gitkeep`, no placeholder file.
2. **The folder being looked at** (workflow 3 L32-33; workflow 14 delta) is,
   in order:
   - the folder chosen in the tree;
   - else the folder of the open (selected) file;
   - else the root.

   The README ignores it, since it is root-only.
3. **Each create is a working-copy change, saved like any other** (workflow
   14 L170-171). Nothing commits or pushes. The new file shows *new* in the
   tree and in the change list, until a save or a *Discard*.
4. **Canonical form.** The new setlist is written with cifra-md's
   `writeSetlist({ title, properties: [], body: [] })`, so its bytes are what
   a save would write. The README template is `# {title}\n`, which passes the
   README text rules unchanged (workflow 14 L73-77). The song keeps the
   existing template (`app/src/editor/template.js`).
5. **Offline first; the Worker owns the files.** The view never builds a
   path it then trusts. The Worker allocates the final name under the book
   lock against the real working copy, as `NEW_SONG` does, so a stale tree
   slice cannot overwrite a file. The README is refused (not overwritten) if
   one exists when the command runs. Works with no network.
6. **Only where the book is savable.** *New* shows only when
   `canSaveFor(...) !== false` (`FileView.jsx` L43), as *New song* does
   today.
7. **Accessibility** (WCAG 2.1 AA):
   - React Aria Components throughout: `MenuTrigger`/`Menu`/`MenuItem` for
     *New* and *More*, `ModalOverlay`/`Dialog`/`TextField` for the name
     dialogs, RAC `Button` with `aria-pressed` for folder rows.
   - Every icon-only button has an accessible name (*New*, *History*, *More*,
     *Back*, *Back to files*).
   - The disabled README line is a `MenuItem` in `disabledKeys`, so it is
     announced, not just greyed.
   - The *empty* folder status is a word (`StatusBadge`), never colour alone.
   - Keyboard: Enter/Space opens a menu, arrows move, Escape closes, and
     focus returns to the trigger.
   - Overlays portal inside the `.est` theme root (the menus and dialogs
     already in the file view do).
8. **Copy in all four locales** (`app/src/i18n/locales/*.js`, the `fileView`
   section). English is the board's: *New*, *Song*, *Setlist*, *Folder*,
   *exists once a file is in it*, *README.md already exists*, *More*,
   *Rename*, *Delete*, *New setlist*, *New folder*, *Name, in {folder}/*,
   *empty*, *Create*, *Cancel*.
9. **No song text in logs; fixtures are purpose-written** (the example book
   and invented names such as *Rehearsal set*, `ensaios/`).

## Acceptance criteria

### Behavior delivered

1. **The New menu.**
   - On the tree's top bar, on every layout, *New song* is replaced by
     **New**: an icon `+` button labelled *New* on narrow, a text button
     *New* with the `+` icon on wide (the tablet board L94-99).
   - It opens a RAC menu with four items in the board's order:
     - **Song** — description `*.cifra.md`;
     - **Setlist** — `*.setlist.md`;
     - **Folder** — *exists once a file is in it*;
     - **README.md** — enabled only when the tree has no `README.md` at the
       root, or has one only as *deleted*. Otherwise it is the disabled item
       *README.md already exists*.
2. **Song** sends today's `NEW_SONG { targetBookId, folder, mySongsTitle }`,
   with `folder` the folder being looked at (Constraint 2). It opens the
   editor on the template exactly as today (`NEW_SONG_READY` →
   `isNew: true`), and the song is named at the first save.
3. **Setlist** opens the dialog **New setlist**:
   - a name field labelled *Name, in {folder}/* (or *Name, in the book* at
     the root);
   - *Create* is disabled while the name is blank;
   - *Cancel* closes it.

   *Create* sends `CREATE_FILE { bookId, kind: 'setlist', folder, title }`.
   On `FILE_CREATED { bookId, path }` the view selects the new file. It
   opens in the raw editor holding `# {title}`, shows *new* in the tree, and
   on narrow it is the one pane shown.
4. **Folder** opens the dialog **New folder** with the same name field.
   - The name must be one path segment (Decision 4 gives the rule). An
     invalid name keeps *Create* disabled, with the reason shown as text
     under the field.
   - *Create* adds a view-held folder row at `{parent}/{name}/` with the
     status word *empty*, and makes it the chosen folder.
   - The next *Song* or *Setlist* goes in it. Once the tree holds a file
     under it, the row is the tree's own folder row and the *empty* word
     goes.
   - A folder still empty when the file view is left is gone.
   - Nothing is sent to the Worker.
5. **README.md** sends `CREATE_FILE { bookId, kind: 'readme', title }`, with
   `title` the book's name as the file view shows it. On `FILE_CREATED` the
   view selects `README.md`, open in the raw editor holding `# {title}`.
   - If one appeared meanwhile, the Worker answers
     `CREATE_REFUSED { bookId, kind, reason: 'exists' }`, and the view shows
     *README.md already exists* as an inline notice in the tree pane. Nothing
     is overwritten.
6. **Folder rows are choosable.**
   - Each folder row in `FileTree` is a RAC `Button` with `aria-pressed`,
     named `{name}/` (followed by *empty* when it is view-held).
   - Pressing it makes it the chosen folder and clears any file selection.
     On narrow it opens no pane; the tree stays.
   - Pressing a file clears the chosen folder: the folder being looked at is
     then that file's.
7. **The phone top bar** (narrow, tree shown): Back icon, the title *Files*,
   then the icon buttons **History** (clock) and **New** (`+`). The title
   is never truncated at the phone viewport (412px), nor at the board frame
   (370px). Wide keeps "{book} · Files" with the text buttons *History* and
   *New*.
8. **The phone open-file header** (narrow, a file open) is one bar:
   - **Back to files**;
   - the file's base name in the mono title;
   - a **More** (⋯) `MenuTrigger`, whose menu holds **Rename** (when today's
     rule shows Rename: a song or setlist that is not new) and **Delete**
     (always; on a new song it is the same flush-then-`DiscardConfirm` path
     as today).

   Below it, a meta line "{book} · {folder}/" (or "{book}" at the root)
   carries the file's status badge. The second `raw-editor-head` bar is not
   rendered on narrow; the path no longer shows twice. Each item opens the
   existing `RenameFileDialog` / `DeleteFileConfirm`. On wide the header is
   unchanged: *Rename {name}* / *Delete {name}* buttons, as the tablet board
   L119-123 draws.
9. **The Worker command.**
   - `CREATE_FILE { bookId, kind: 'setlist' | 'readme', folder?, title }`
     runs under the book lock:
     - for `setlist`, the path is
       `setlistFilename(title, folderNames(bookId, folder))` in `folder`;
     - for `readme`, it is `README.md`, refused with `exists` if present in
       the working copy.
   - It writes the template from `new-file.js` (mkdirp, as `write` does).
   - It reindexes the path as unsaved, as `WRITE` does (`logic.js`
     L1680-1689), so a new setlist is listed by `LIST_SETLISTS` and the
     Setlists tab at once.
   - It replies with `FILE_CREATED { bookId, path }`, followed by the
     refreshed `TREE`.
   - It commits nothing.

### Tests, by level

**unit** — `app/src/files/new-file.test.js` (Vitest), on the pure module
`app/src/files/new-file.js`:

- `setlistTemplate('Rehearsal set')` equals
  `writeSetlist({ title: 'Rehearsal set', properties: [], body: [] })`, and
  it parses back (`parseSetlist`) to that title with no items. Pins workflow
  14 L147-171 (a setlist starting with only its title) and Constraint 4
  (canonical).
- `readmeTemplate('Example Book')` is `# Example Book\n`. Pins workflow 14
  §What a new book starts with and DIRECTION §2.1 L74.
- `newSetlistPath` (folder + `setlistFilename`) picks:
  - `ensaios/rehearsal-set.setlist.md`;
  - `rehearsal-set-2.setlist.md` when the first is taken;
  - `untitled.setlist.md` for a title with no letters.

  Pins the delta's "`-2` when taken".
- `folderNameProblem(name, siblings)` gives `null` for `ensaios`. It names
  the problem for:
  - an empty or blank name;
  - a `/`;
  - `.` and `..`;
  - a leading dot (`.git`);
  - a name already a sibling folder or file.

  Pins Decision 4.
- `createChoices(entries)`:
  - README is enabled with no root `README.md`;
  - enabled with only a *deleted* one;
  - disabled with a present one;
  - not enabled by a `README.md` in a subfolder.

  Pins Acceptance 1 and the delta's "offered only when the book has none".
- `folderBeingLookedAt({ chosenFolder, selectedPath })`: the chosen folder,
  else the selected file's folder, else the root. Pins workflow 3 L32-33 and
  Constraint 2.

**behavior (Worker)** — `app/src/worker/file-ops.behavior.test.js`, on the
existing file-ops rig (fake IndexedDB, real isomorphic-git working copy):

- `CREATE_FILE` setlist in `ensaios/` writes
  `ensaios/rehearsal-set.setlist.md`:
  - the bytes are `setlistTemplate`;
  - it replies `FILE_CREATED`, then a `TREE` listing the path as *new*;
  - there is no new commit (HEAD unchanged).
- A second create with the same title gets `-2`.
- `LIST_SETLISTS` lists it.
- `CREATE_FILE` readme with no README writes `# {title}\n`.
- With a README present it replies `CREATE_REFUSED` (`exists`) and the file
  is unchanged.
- A following `SAVE` of the setlist commits it unchanged, since it is
  already canonical.

Pins workflow 14 L147-171 and L170-171 (a working-copy change saved like any
other), and Constraint 5.

**behavior (Worker)** — `app/src/worker/new-song.behavior.test.js`: a new
case, `NEW_SONG { folder: 'ensaios' }`, allocates
`ensaios/untitled.cifra.md`. It allocates `ensaios/untitled-2.cifra.md` when
that one exists. Pins workflow 3 L32-33 (the file-view way in had no folder
test).

**behavior (view)** — `app/src/files/FileView.behavior.test.jsx`, with
`makeStore()`, real RAC and i18n, and axe (`checkWcag21aa`) on each state
named:

- *New* opens a menu with *Song*, *Setlist*, *Folder* and the disabled
  *README.md already exists* when the seeded tree has a README. Axe runs
  with the menu open. Pins W14 #1 L58-63.
- *Song* with a file in `choro/` selected sends `NEW_SONG` with
  `folder: 'choro'`. With nothing selected, it sends `folder: null`. Pins
  workflow 3 L32-33.
- *Setlist*:
  - the dialog is headed *New setlist*, labelled *Name, in choro/*;
  - *Create* is disabled while blank;
  - typing *Rehearsal set* and *Create* sends
    `CREATE_FILE { kind: 'setlist', folder: 'choro', title: 'Rehearsal set' }`;
  - an emitted `FILE_CREATED` plus `TREE` selects the path, and the editor
    mounts with the *new* badge.

  Axe runs on the dialog.
- *Folder*:
  - `..` shows the reason and keeps *Create* disabled;
  - `ensaios` adds a row `ensaios/` with the word *empty*, pressed;
  - *Song* then sends `folder: 'ensaios'`;
  - once a `TREE` lists `ensaios/untitled.cifra.md`, the *empty* word is
    gone.

  Axe runs on the tree with the empty folder.
- *README.md* is enabled on a tree without one. It sends
  `CREATE_FILE { kind: 'readme', title: <book name> }`. An emitted
  `CREATE_REFUSED` shows *README.md already exists* as a notice.
- Folder rows: pressing `choro/` makes it chosen (`aria-pressed="true"`)
  and opens no editor. Pressing a file clears it.
- Narrow (`mode="narrow"`):
  - the tree bar has icon buttons named *History* and *New*, and the title
    *Files*;
  - opening a file renders one bar (*Back to files*, the base name, *More*),
    with no `raw-editor-head`, and the path text appears once;
  - *More* → *Rename* opens the rename dialog;
  - *More* → *Delete* opens the delete confirm (or, on a new song, the
    discard confirm, after the flush);
  - on README, *More* holds only *Delete*.

  Axe runs with *More* open. Pins W14 #2 L68-74 and the `.tji` note.
- The existing cases that press `Rename {name}` / `Delete {name}` keep
  passing on wide, unchanged.

**e2e-web** — new `e2e/web/tests/file-view-create.spec.js`, on the phone,
tablet and computer projects against the compose stack. It goes through the
real UI only (`openExampleBook`, `openFiles` from `journeys.js`; new helpers
below):

- **"create each kind from the New menu; each appears in the tree and
  opens"**:
  1. Books → *Files in Example Book*. *New* opens the menu (`checkA11y`;
     `mockup(page, 'W14-file-view', 1, { note: 'create menu' })` with the
     menu open).
  2. *Folder* `ensaios`: its row shows *empty*.
  3. *Setlist* *Rehearsal set*: `ensaios/rehearsal-set.setlist.md` opens
     with `# Rehearsal set`, and after `backToTree` its row is in the tree
     with *new* and the folder's *empty* is gone.
  4. *Song*, chosen with `ensaios/` pressed: the editor opens on the
     template. A purpose-written song is typed and saved (`confirmSaveSheet`),
     and `ensaios/<slug>.cifra.md` is in the tree.
  5. The setlist is saved with *Save…* (`saveAllChanges`), and its *new*
     word is gone.
  6. The README: `README.md` is deleted (`deleteOpenFile`) and saved. *New*
     → *README.md* is now enabled; it opens with a level-1 heading equal to
     the book name the file view shows, and its row shows *new*.
  7. `checkA11y()` on the setlist dialog, the folder dialog, the tree with
     the empty folder, and the open README.

  Pins workflow 14 L147-171 and §Statuses, and workflow 3 L32-33.
- **"on a phone, the top bar's icon actions and the open file's More menu"**
  (asserts on the phone project; tablet and computer check that the wide
  *Rename*/*Delete* buttons are present instead):
  - the tree bar's *Files* title is not truncated (`scrollWidth <=
    clientWidth`, measured in-page through the real UI);
  - *History* and *New* are icon buttons;
  - opening `morning-on-the-porch.cifra.md` shows one bar with its base name
    and *More*;
  - *More* holds *Rename* and *Delete*;
  - *Rename* through the menu renames it and keeps `.cifra.md`.

  `checkA11y()` runs with the menu open. Captures
  `mockup(page, 'W14-file-view', 2, { note: 'more menu' })`. Pins W14 #1
  L30-35, W14 #2 L68-72 and the `.tji` note.
- `e2e/web/tests/file-view.spec.js` L84 changes from *New song* to the new
  `createInFiles(page, 'Song')` helper, and its inline `Rename ${SHORT_SET}`
  (L98) changes to go through a helper that works on every layout. Its
  existing `mockup` #1-2 calls stay.
- `e2e/web/lib/journeys-files.js`:
  - new `createInFiles(page, kind, name?)` opens *New*, picks the
    `menuitem`, and fills and confirms the dialog when one opens;
  - new `chooseFolder(page, name)`;
  - `renameOpenFile` / `deleteOpenFile` open *More* → the `menuitem` when a
    *More* button is visible (phone). Otherwise they press today's
    `Rename {name}` / `Delete {name}` buttons. Every spec that uses them
    (`file-view`, `setlists`, `sign-out`, `online`, `upload`, `full-height`,
    `narrow-fit`) keeps passing unchanged.

**Drivability.** Every e2e step needs only what already exists:

- the example book on the shelf (`openExampleBook`, `first-run`);
- the file view (`books.file_view`, complete);
- saving in a local book (`file-view.spec.js` already does);
- deleting and saving README (`DELETE_FILE`, complete).

No hosted book, second person or second device is needed. No new `depends`.

**No test is deferred, and there is no deferred WBS leaf.**

## Decisions

1. **One Worker command, `CREATE_FILE`, for setlist and README; the song
   keeps `NEW_SONG`; a folder never reaches the Worker.**
   - *Rationale:* naming must be decided against the real working copy under
     the lock (`new_song.md` Decision 2), and a setlist has no "first save
     names it" step to defer to. Workflow 12's setlists are named as they are
     made. One command with a `kind` covers both writes. A folder has no
     bytes to write (constraint 1).
   - *Rejected:* the view computing the path and sending plain `WRITE`.
     `WRITE` overwrites silently, so a stale tree slice, or a sync that
     brought the same name, would clobber a file.
   - *Rejected:* `ADD_TO_SETLIST` with an absent song. That bends a command
     whose contract is "with a first song".
   - *Rejected:* separate `NEW_SETLIST` / `NEW_README` commands. That is two
     handlers for one shape.
2. **A setlist is named in a dialog and starts with only its title.**
   - *Rationale:* a setlist's title is its level-1 heading and its file name
     is the slug of it (`setlistFilename`, as *New setlist…* in workflow 12
     does). An empty body is a valid canonical setlist.
   - *Rejected:* an `untitled.setlist.md` placeholder named at first save.
     That copies the song flow, but the save sheet has no title-to-name
     step for setlists, and a placeholder setlist would show in the
     Setlists tab as *untitled*.
3. **A new folder is view-held, shown *empty* and chosen, until a file is in
   it** (the design delta).
   - *Rationale:* git has no empty folders (workflow 14 L149-150), and the
     board's own meta, *exists once a file is in it*, says the folder is a
     promise. Holding it in ephemeral view state matches `file_view.md`
     Decision 7: nothing is half-written to the working copy, and nothing
     survives a reload that git could not hold.
   - *Rejected:* a `.gitkeep`. That is a file a book may not hold (workflow
     14 L24-36), and the hook would refuse it.
   - *Rejected:* a dialog naming the folder and its first file in one go.
     That makes the dialog heavier than the board's one-field cards, and
     still needs "the folder being looked at" for later files.
4. **A folder name is one path segment: not blank, no `/`, not `.` or `..`,
   no leading dot, not a sibling's name.** Characters are otherwise kept as
   typed (trimmed). Workflow 14 lets folders be named freely; only
   path-breaking and hidden names (`.git`) are refused, and a folder clashing
   with a sibling would merge silently.
   - *Rejected:* slugifying the folder name. Folders are the user's
     organisation (`bossa/`, `choro/` on the board), not names derived from
     a title.
5. **The folder being looked at becomes explicit: folder rows are
   choosable.**
   - *Rationale:* workflow 3 L32-33 needs a folder to point at. Today it is
     only "the selected file's folder", which on a phone is always the root,
     because the tree bar (and *New song*) hides while a file is open. A
     pressed folder row is the smallest real affordance, and the board
     already draws folder rows as rows.
   - *Rejected:* a folder picker inside each create dialog. That is a second
     tree for one field.
   - *Rejected:* creating always at the root. That contradicts workflow 3.
6. **On a phone, Rename and Delete move into a *More* (⋯) menu; wide keeps
   the board's buttons.**
   - *Rationale:* the `.tji` note says so, and W14 #2 draws the *More*
     button. The board draws no menu, so its contents follow the wide
     header: Rename when today's rule shows it, and Delete. The menu follows
     the established pattern (`SongReading.jsx` L555-590, accessible name
     *More*). Wide stays as the tablet board draws it (L119-123), which also
     keeps every existing `Rename {name}` / `Delete {name}` behavior test
     valid.
   - *Rejected:* the menu on every layout. That would contradict the tablet
     board.
7. **README's title is the book name the file view shows.**
   - *Rationale:* a new book's README holds its title (workflow 14 L181-185),
     and when the README is gone the book's name is its repository name
     (DIRECTION §2.1 L74). Writing that name back keeps the shelf's title
     stable across the create.
   - *Rejected:* an empty README. It would title the book with nothing.
8. **README is offered when the root has none, or has one only as
   *deleted*.**
   - *Rationale:* a deleted-unsaved README is absent from the working copy
     (`DELETE_FILE` unlinks it), so creating it writes a file, which the tree
     then shows by its difference from HEAD. This is the natural undo-by-
     recreate.
   - The e2e still saves the delete first, so the created README is
     unambiguously *new*.
9. **The e2e lands in a new spec file**, `file-view-create.spec.js`, rather
   than growing `file-view.spec.js` (already seven journeys, 327 lines). The
   shared helpers live in `journeys-files.js`, where the file view's real-UI
   paths already are.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-18.

- The New menu (Song, Setlist, Folder, README.md) replaces *New song* in the file view: `app/src/files/CreateMenu.jsx`, `app/src/files/NewNameDialog.jsx`, wired in `app/src/files/FileView.jsx`; pure rules and templates in `app/src/files/new-file.js`.
- Folder rows are choosable, and a view-held *empty* folder row is drawn: `app/src/files/FileTree.jsx`, `app/src/files/file-tree.js`, `app/src/files/file-view.css`, `app/src/files/icons.jsx`.
- Worker `CREATE_FILE` (setlist or README, uncommitted, reindexed unsaved) with `FILE_CREATED` / `CREATE_REFUSED`: `app/src/worker/protocol.js`, `logic.js`, `working-copy.js`; `NEW_SONG` takes the folder being looked at.
- On a phone the tree bar uses icon History/New and the open file has one bar with a More (⋯) menu holding Rename and Delete: `app/src/files/FileView.jsx`, `RawEditorHost.jsx`, `file-view.css`.
- Copy in the four locales: `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Tests: unit `app/src/files/new-file.test.js`, `file-tree.test.js`; behavior `app/src/worker/file-ops.behavior.test.js`, `new-song.behavior.test.js`, `app/src/files/FileView.behavior.test.jsx`; e2e-web `e2e/web/tests/file-view-create.spec.js` with helpers in `e2e/web/lib/journeys-files.js`, and `e2e/web/tests/file-view.spec.js` moved onto the layout-independent helpers.
- Workflow `docs/workflows/14-file-view.md` carries the design delta.
