# books.file_view — The file view

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task file_view "The file view"` under
`task books`. Dependencies as declared: `depends storage.history, songs.editor,
songs.new_song` (the task's own line), plus the parent `task books` cascade
`depends shell.layout, foundation.e2e_web`. The one-line note:

> "The tree with statuses as words, only the allowed kinds, rename keeping its
> kind and updating setlist links, delete, raw editor, save several files, the
> book's log with line diffs and per-file restore. Workflow 14. Tests: behavior
> (the tree with statuses as words, rename keeping its kind and updating setlist
> links, delete, raw editor, save several, the log with line diffs, per-file
> restore; axe); e2e-web (the file view on the three viewports: a rename, a raw
> edit saved with another file, a restore from the log; axe)."

This is **the file view** DIRECTION names beside search and the shelf: "for
advanced users, and shows the book as git sees it: the tree with each file's
status, a raw editor for any file, the book's log with the files each commit
touched, and plain line diffs. Renaming, moving and deleting files happen only
here" (DIRECTION §4 L449–452). Everything else in the app sees songs; this sees
**files**, for the user who wants to understand how the two relate, or to do what
only files allow — rename, move, delete (workflow 14 L5–8).

## Effort estimate

**4d** (as scoped in the `.tji`), allocated `team`. Roughly: ~1.25d for the view
(the tree, the raw-editor host, the changes-to-save list, the book-history list
with per-commit line diffs and per-file restore — three viewports, React Aria,
i18n, axe), ~1.5d for the four new Worker seams this task owns (the book-tree
read, move/rename, delete, and the per-commit diff read) plus the pure
setlist-relink helper, ~0.5d for the i18n copy and the mount/entry wiring, the
rest for the e2e journey. Much of the heavy lifting is **reused, not rebuilt**:
the raw editor (`songs.editor`), the several-files-one-commit save and the save
sheet (`storage.working_copy` / `songs.save_sheet`), the book log, per-file
restore and the line-diff renderer (`storage.history` / `songs.history`).

## Repository

**estante-de-cifras** only, `app/` and `e2e/`:

- `app/src/files/` (new area) — the file-view screen (`FileView.jsx`) and its
  presentational children (a file tree, the raw-editor host, the rename dialog,
  the delete confirm, the book-history list, a per-commit diff pane), pure
  display helpers (`file-tree.js`), co-located styles (`file-view.css`) and
  tests. A `#dev/files` dev mount (`FilesDev.jsx`), mirroring
  `app/src/editor/EditorDev.jsx` and `app/src/songs/HistoryDev.jsx`, so the
  surface stands up before every real entry point exists (Decision 7).
- `app/src/books/BooksScreen.jsx` — a small addition: the per-book *Files* entry
  that opens the file view, wired through the existing `onOpenBook` seam
  (`BooksScreen.jsx`, a no-op default today). `app/src/shell/AppShell.jsx` — a
  full-screen host override for the open file view, exactly as it already
  returns `<NewSongHost …>` when `editing?.bookId && editing?.path` is set;
  selection stays ephemeral `useState`, no router (Decision 7).
- `app/src/worker/` — the four seams this task is the first to need: a
  book-tree reader (`book-tree.js`: `createBookTree({ fs, git, locks }) →
  tree({ bookId })`), a `move`/`remove` pair on the working copy
  (`working-copy.js`), a per-commit diff op on the history layer
  (`history.js`), and a pure setlist-relink helper (`setlist-links.js`). The
  new `CommandKind.BOOK_TREE` / `MOVE_FILE` / `DELETE_FILE` / `COMMIT_DIFF` and
  `EventKind.TREE` / `FILE_MOVED` / `FILE_DELETED` / `COMMIT_DIFF`, their
  dispatch cases and `ensure…()` composition in `logic.js`, and a `tree` read
  slice in `reducer.js`. It **reuses unchanged** `BOOK_LOG`/`bookLog`,
  `RESTORE_VERSION`/`RESTORED`, `OPEN_SOURCE`/`SOURCE`/`source`,
  `WRITE`/`SAVE`/`DISCARD`/`save`, and `PREVIEW_SAVE`/`SAVE_PREVIEW`.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — a new `fileView` copy section
  in all four catalogues (catalogue completeness is a hard build gate,
  `shell.i18n`; `en` is the source of truth).
- `e2e/web/tests/file-view.spec.js` — the Playwright journey.

**Not a `cifra.md:` task.** Nothing in the sibling `/home/ruoso/devel/cifra.md`
repo changes: renaming, moving and deleting files, listing the working tree,
rewriting setlist links and diffing commits are all local git and local
format operations on the device; the app and the service share no code
(DIRECTION §3.6). The setlist-link rewrite composes **existing** cifra.md JS
exports (`parseSetlist`, `pathFromSetlistToSong`, `retargetItem`, `writeSetlist`
— `cifra.md/js/src/setlist.js:167,288,441,513,655`), already shipped by
`cifra_js.setlists` and canonicalised on save by `canonicaliseFile`
(`app/src/worker/canonicalise.js`). Plain JS/JSX; no TypeScript; contracts are
JSDoc `@typedef`s, as every sibling in `app/src/worker/`.

**No design delta** is authored: workflow 14 is Status: decided and specifies
the whole view (the tree, the statuses, what can be done to a file, saving
several, the book's history); the W14 board draws it on the four devices; the
protocol is open to new command/event kinds (`protocol.js` header; the pattern
`storage.history` used to add four kinds). The service-side portions of workflow
14 — *What a book may hold*, *What the service checks* (the `pre-receive` hook),
and the canonical-form **specification** gaps — are not this task's; they are
the `hook.*` tasks (M3) and cifra.md spec/corpus work (see Constraints).

## Inherited dependencies

- **`storage.history`** — *settled, Done 2026-10-05*
  ([`../storage/history.md`](../storage/history.md)). The git-reading data layer
  this screen's history pane and restore are built on
  (`app/src/worker/history.js`, `createHistory({ fs, git, locks })`), each op
  under one `locks.withLock(bookId, …)` over `dir = git.bookDir(bookId)`:
  - `bookLog({ bookId })` (`history.js:344`) → `{ commits }` — **every commit,
    newest first, merges included and flagged**, each `{ commit, short, parents,
    isMerge, author: { name, email }, timestamp, timezoneOffset, message,
    files }`, where `files` is `[{ path, status }]` with status
    `'added'|'modified'|'deleted'` computed by walking the commit tree vs its
    first parent (`changedFiles`, `history.js:191`; `SHORT = 7`, `:52`; root
    commit vs `EMPTY_TREE`, `:57`). **This is the file-view history list.**
    Surfaced as `EventKind.BOOK_LOG` (`protocol.js:160`) → the `bookLog` slice
    keyed by bookId (`reducer.js:61`, fold `:265`); command `CommandKind.BOOK_LOG`
    (`protocol.js:46`), handler `logic.js:776`.
  - `restoreVersion({ bookId, path, commit, fromPath })` (`history.js:320`) →
    `{ restored: true }` — reads the historical blob at `fromPath`@`commit` and
    **writes it into the song's current `path` in the working tree, uncommitted**,
    under one lock (never via `workingCopy.write` — Web Locks are non-reentrant,
    would deadlock; `storage.history` Decision 4). Rename-correct. A deleted file
    is restored the same way (workflow 14 L169–170; workflow 6). Reused as-is for
    the file view's per-file *restore this version*. Command
    `CommandKind.RESTORE_VERSION { bookId, path, commit, fromPath }` →
    `EventKind.RESTORED { bookId, path }` (a monotonic token).
  - `readVersion({ bookId, path, commit })` (`history.js:303`) → `{ text }`
    (verbatim UTF-8, never re-canonicalised). The per-commit diff op this task
    adds composes the same `readBlob` machinery (Decision 4).
- **`songs.editor`** — *settled, Done 2026-10-06*
  ([`../songs/editor.md`](../songs/editor.md)). The CodeMirror 6 source editor is
  **the raw plain-text editor this view reuses** (editor.md:36–38, 459–466: "the
  file view's raw editor (DIRECTION §4) … build[s] on this CodeMirror seam"):
  - `SongEditor` (`app/src/editor/SongEditor.jsx:67`, default export,
    props `{ store, bookId, path, isNew, title, onSave, layoutMode, editorRef }`)
    — a single raw-text buffer with per-line cifra.md syntax tinting; file-
    agnostic (any `{ bookId, path }`). Loads via `OPEN_SOURCE { bookId, path }`
    → `SOURCE { bookId, path, text }` → the `source` slice; persists via
    debounced `WRITE { bookId, path, text }` (`WRITE_DEBOUNCE_MS = 400`), no
    commit. The pre-save gate (`SAVE_BLOCKERS = { 'bad-voicing', 'marker-line' }`,
    `SongEditor.jsx:49`) hands off through the single `onSave?.()` seam — **the
    host decides what Save does** (editor Decision 10). Hosts switch files by
    remounting via React `key={`${bookId}:${path}`}`.
  - CodeMirror jsdom geometry stub required in any behavior test that mounts it
    (`Range.prototype.getClientRects`/`getBoundingClientRect`, per-test, as
    `SongEditor.behavior.test.jsx:24–29`; memory `codemirror-jsdom-getclientrects`).
- **`songs.new_song`** — *settled, Done 2026-10-06*
  ([`../songs/new_song.md`](../songs/new_song.md)). The first in-app host of the
  editor, which **made the new-song flow folder-aware for this task and added the
  `books.file_view → songs.new_song` graph edge** (new_song.md Decision 7, :587–589):
  - `CommandKind.NEW_SONG { targetBookId?, folder?, author }` → ensures the
    target book + allocates a free `untitled[-N].cifra.md` placeholder, placing it
    in `folder` when given → `EventKind.NEW_SONG_READY { bookId, path }`; then the
    editor opens, and `CommandKind.NAME_AND_SAVE { bookId, fromPath, author }`
    parses the title, derives the filename (`deriveSongFilename`,
    `app/src/songs/song-filename.js`) and does the first canonical save. **The
    file view wires *new song here* (in the folder being looked at) to `NEW_SONG
    { folder }`** — the fourth "way in" new_song left to it (new_song.md:557–560,
    the file-view entry is explicitly not e2e-tested there).
  - **Genuine user rename/move/delete of a committed file is file_view's own**
    (new_song.md Decisions 3, 4): "the file view owns real file moves (DIRECTION
    §4 L449–452)"; no `MOVE_FILE`/`RENAME`/`DELETE_FILE` command exists yet.
- **`shell.layout`** — *settled, Done* ([`../shell/layout.md`](../shell/layout.md)).
  One controlled React Aria `<Tabs>`; a full-screen host overrides the tabs (as
  `AppShell` returns `<NewSongHost …>` for the open editor — `AppShell.jsx`).
  Two layout modes split at `(min-width: 600px)` (`useLayoutMode()` → `'narrow'`
  / `'wide'`): the file view is **laid out for a wide screen first — the tree and
  the file side by side, collapsing to one at a time on a phone** (workflow 14
  L130–132; W14 phone/tablet/computer). No router; selection is ephemeral `useState`.
- **`foundation.e2e_web`** — *settled, Done*
  ([`../foundation/e2e_web.md`](../foundation/e2e_web.md)). The Playwright harness
  at `e2e/web/` (phone/tablet/computer projects, the axe helper
  `e2e/web/lib/axe.js`, the offline helper `lib/offline.js`; siblings
  `search.spec.js`, `editor.spec.js`, `history.spec.js`, `books.spec.js`). The
  file-view journey lands here.
- **`storage.working_copy`** / **`storage.index`** — *settled, Done* (transitive,
  via `songs.editor`/`songs.save_sheet`). `createWorkingCopy({ fs, git, locks })`
  → `write` (`:82`), `save({ bookId, paths, message, author })` (`:101`, **the
  several-files-one-commit path** — canonicalise each → stage → one commit →
  best-effort push), `discard({ bookId, paths })` (`:238`, unlinks a never-saved
  file, else checks out HEAD). `canonicaliseFile(path, input)`
  (`canonicalise.js:68`) dispatches `*.setlist.md` through the setlist writer,
  everything else through the chart writer. The search index indexes only
  `*.cifra.md`; it is **not** the file tree (Decision 1).
- **`songs.save_sheet`** — *settled, Done* ([`../songs/save_sheet.md`](../songs/save_sheet.md)).
  `SaveSheet` (`app/src/songs/SaveSheet.jsx:190`, props include `{ store, isOpen,
  onClose, bookId, paths, … }`) already renders a **multi-file** musical diff
  (`PREVIEW_SAVE { bookId, paths }` → `SAVE_PREVIEW` → the `savePreview` slice;
  `multi` when `paths.length > 1`) and commits several files in one `SAVE`. The
  file view's *Save…* opens this sheet for the checked paths (Decision 3).
- **`songs.history`** — *settled, Done* ([`../songs/history.md`](../songs/history.md)).
  The pure line/hunk diff is reused as-is: `lineDiff(before, after)`
  (`app/src/songs/line-diff.js:82`) → hunks of classed `context`/`add`/`del`
  lines (a short LCS, `CONTEXT = 3`, no diff library, **no CodeMirror, no jsdom
  geometry stub** — history Decision 6), rendered by `LineDiffView`
  (`SongHistory.jsx`). The file view renders each commit's per-file diff through
  the same `lineDiff` + `LineDiffView` (Decision 4). `RestoreConfirm.jsx` /
  `DiscardConfirm.jsx` are the confirm-dialog patterns the delete confirm mirrors.
- **`shell.i18n`** / **`shell.tokens`** / **`shell.portal_provider`** — *settled,
  Done* (transitive). Copy goes through `t(key, params)`
  (`app/src/i18n/index.js`); the four catalogues already carry `history`,
  `saveSheet`, `editor`, `books`, `search` sections; a new `fileView` section is
  added to all four. The class vocabulary the W14 board uses
  (`.row`/`.list`/`.grow`/`.name`/`.meta`/`.badge` (`.unsaved`/`.conflict`/`.ok`/
  `.dot`)/`.badges`/`.split`/`.pane.side`/`.pane.main`/`.appbar`/`.scroll`/
  `.editor`/`.ln` (`.add`/`.del`/`.md`/`.ch`)/`.check`/`.section-label`/`.field`/
  `.input`/`.dialog`/`.scrim`/`.notice.accent`/`.btn` (`.primary`/`.icon`)) is all
  in `docs/mockups/theme.css`. React Aria overlays portal into the `.est` token
  root via the app-wide `UNSAFE_PortalProvider` (`shell.portal_provider`; memory
  `rac-overlays-portal-outside-est-theme-root`), so the rename dialog and the New
  menu need no per-screen `portalContainer` plumbing.

**No pending blocking dependencies.** The screen renders seams later tasks fill
(the live *conflict* status, the reader/editor gate on a shared book, the New →
Setlist entry) the way `songs.search` and `books.shelf` left theirs to their
owners — each is an existing WBS leaf, no new task (Decisions 5, 6; Deferred work).

## What this task is

The file view — the React screen that shows **the book as git sees it** — and the
Worker seams for the file operations only it allows:

1. **The tree, with statuses as words.** Every file the book holds, read from a
   new `tree` slice (the working tree walked in the Worker), grouped into folders
   (git has no empty folders, so a folder exists once a file is in it), each file
   with its **status** shown as a **word** — *unsaved changes*, *new* (never
   saved), *deleted* (deleted but not yet saved), *conflict* (workflow 9), or
   nothing when in step (workflow 14 L134–138; W14 board; mockups README L26).
   **Only the allowed kinds** are listed — `*.cifra.md`, `*.setlist.md`,
   `README.md`, `.gitattributes`, and folders holding them; `.git` and anything
   else are not shown (workflow 14 L24–29).
2. **The raw editor.** Opening a file shows its text in the CodeMirror raw editor
   (`SongEditor`), file-agnostic, persisting through the debounced `WRITE` — the
   same editor songs use, here over any file (workflow 14 L148–149).
3. **Rename and move, keeping the kind and updating setlist links.** A rename/move
   control writes the file's working-copy bytes to the new path, removes the old,
   and **rewrites every setlist in the book whose item points at the moved song**
   to the new relative path — all as uncommitted working-copy changes, saved
   together in one commit (workflow 14 L144–146; W14 tablet rename dialog: "Links
   to it are updated in the same save"). **A name keeps its kind**: a `.cifra.md`
   cannot be renamed out of `.cifra.md` (the dialog pins the extension; the Worker
   refuses a cross-kind move).
4. **Delete, asked once.** A delete control, after one confirm, removes the file
   from the working copy — shown as *deleted* until the save, which commits the
   removal. A never-saved file is unlinked outright. A delete **does not** rewrite
   setlist links; a setlist pointing at a deleted song becomes a *missing item*
   (workflow 14 L147–148; workflow 12). 
5. **Saving several files.** The changed files are listed with a check beside each,
   all checked; *Save…* opens the save sheet for the checked paths and makes one
   commit — the one piece of git's staging the file view keeps (workflow 14
   L152–159). This reuses the existing multi-file `SAVE` and `SaveSheet`.
6. **The book's history, with line diffs and per-file restore.** Every commit,
   newest first, merges included and marked, each with its message, author, date,
   short hash and the files it touched (`bookLog`). Opening one shows the **plain
   line diff** of each file and, per file, *restore this version*, which writes it
   into the working copy to be saved as a new version — a deleted file the same way
   (workflow 14 L161–173).
7. **New song here.** The New affordance wires *new song in the folder being looked
   at* to `NEW_SONG { folder }` (the folder-aware seam `songs.new_song` left to this
   task). New → Setlist is `books.setlists`'s; a folder is emergent (it exists once
   a file is in it); the README already exists (scaffolded on book create) —
   Decision 6.

It is **not** the service's push checks, the *what a book may hold* enforcement on
the wire, or the canonical-form specification gaps — those are `hook.*` and cifra.md
spec/corpus tasks (Constraints). This task is the app's view and the local file
operations.

## Why it needs to be done

It is the only place the book is shown as files, and the only place a file can be
renamed, moved or deleted (DIRECTION §4 L449–452). It is a leaf of milestone **M2
(`milestones.m2_local`)** — "a songbook on one device … find, read, write, edit,
arrange, history, the explorer, **the file view** — installed and offline"
(`tasks/99-milestones.tji:23–26`), which already lists `books.file_view` among its
dependencies. Without it there is no way to reorganise a book (rename/move songs
into folders, delete a file), no whole-book history view, and the "advanced users
find it" escape hatch DIRECTION promises is missing. It depends on `storage.history`
(the log + restore), `songs.editor` (the raw editor) and `songs.new_song` (the
folder-aware new-song seam) and composes them into the screen.

## Inputs / context

### Governing design

- **Workflow 14 — The file view** (`docs/workflows/14-file-view.md`, Status: decided):
  - **The view** (L124–132): reached via *files* on a book in the book-management
    screen and *show the file* on a song's reading view; **laid out for a wide
    screen first — the tree and the file side by side, collapsing to one at a time
    on a phone** (L130–132); not hidden behind a setting.
  - **Statuses** (L134–138): a file shows *unsaved changes*, *new*, *deleted*,
    *conflict* (workflow 9), or nothing when in step.
  - **What can be done to a file** (L140–150): **Create** a song/setlist/folder/
    README — "what a book may hold, and nothing else" (L141–143; a folder exists
    once a file is in it); **Rename** and **move**, which "update the links to a
    song in the book's setlists (workflow 12). A name keeps its kind" (L144–146);
    **Delete**, asked once (L147); **Edit** in the raw editor (L148). "Each is a
    change to the working copy, saved like any other (workflow 4). Deleted files
    are listed as *deleted* until the save." (L149–150).
  - **Saving several files** (L152–159): changed files listed with a check,
    all checked; *Save* opens the save sheet, one commit; "Choosing which changes
    go in a save is the one piece of git's staging the file view keeps."
  - **The book's history** (L161–173): every commit newest first, merges marked;
    each shows message, author, date, short hash, the files it touched; opening one
    shows the line diff of each file and, per file, *restore this version*; short
    hashes are all of git's machinery that shows.
  - **What a book may hold** (L17–47), **What the service checks** (L85–122),
    **Canonical form** (L49–83) — the service/hook/spec portions; see Constraints.
- **DIRECTION §4 — The interface** (`docs/DIRECTION.md` L449–452): the file view
  "shows the book as git sees it: the tree with each file's status, a raw editor for
  any file, the book's log with the files each commit touched, and plain line diffs.
  Renaming, moving and deleting files happen only here." L445–447: "Search never
  shows or changes a file name" — the title-vs-filename split the file view makes
  visible.
- **DIRECTION §2.1 — Songs are found by name** (L57–75): a songbook holds
  `*.cifra.md`, `*.setlist.md`, a `README.md` and a `.gitattributes`, "and nothing
  else"; a book's title is its README's level-1 heading, or the repository name —
  **renaming a file is not renaming the book and does not touch the README.**
- **DIRECTION §3.7 — The app** (L407–420): "One owner for the data: a Web Worker …
  The main thread never touches IndexedDB"; "A store on the main thread is fed by
  the Worker's messages, and components read the slices they need through
  `useSyncExternalStore` … only what shows it moves"; "The source editor is
  CodeMirror 6" (reused here); React + React Aria Components.
- **Workflow 12 — Setlists** (`docs/workflows/12-setlists.md`): a setlist item is a
  link to a song by path; a song that moves keeps its links; a deleted song leaves a
  *missing item*. The link-rewrite-on-move is specified here and realised by this
  task over the setlist library.
- **Workflow 6 — History** (`docs/workflows/06-history.md` L55–68): "history is
  never rewritten"; restoring writes the old bytes into the working copy to be saved
  as a new version — the same mechanism this view uses for whole-file restore,
  including a deleted file.

### The mockup (what the drawings decide)

- **`docs/mockups/W14-file-view.dc.html`** — the four devices. Real anatomy and copy:
  - **The tree** (`.list` of `.row`s): a folder (`.name` bold, a folder icon) or a
    file (`.name.t-mono`, a file icon), indented by depth; a file carries its status
    `.badge` — `unsaved changes`/`unsaved` (`.badge.unsaved.dot`), `new`
    (`.badge.ok`), `deleted` (`.badge`, name struck through), `conflict`
    (`.badge.conflict.dot`). The footer: "{n} files changed" + a `.btn.primary`
    *Save…*. A New menu (`.card`) lists **Song** (`*.cifra.md`), **Setlist**
    (`*.setlist.md`), **Folder** ("exists once a file is in it"), and "README.md
    already exists". Caption: "A book holds songs (*.cifra.md), setlists
    (*.setlist.md), README.md and .gitattributes, and nothing else."
  - **Phone**: the tree, then one file opened in the raw `.editor`; a *Discard* /
    *Save* footer on the open file; the appbar carries Back, History, New.
  - **Tablet**: tree and file **side by side** (`.split` with `.pane.side` 320px +
    `.pane.main`), the selected row `.sel`; the file pane's appbar has *Rename* and a
    delete icon. The **Rename song** dialog: a name `.input.t-mono` with the
    `.cifra.md` suffix **pinned beside it** (the kind is kept), the hint "A song keeps
    .cifra.md, so it stays a song. The title inside it does not change.", and a
    `.notice.accent`: "**Links to it are updated in the same save** ·
    gigs/ensaio-de-quinta.setlist.md · item 3".
  - **Computer**: the book's **History**. A left pane — "Changes not saved / One
    save, one commit" with a checked `.row` per change (path + status badge) and a
    *Save 2 files…* `.btn.primary.block`; below, the **History** `.list` of commits,
    each `{ msg, meta (author · date), hash (.badge.t-mono), a merge badge, "{n}
    files" }`, the open one `.sel`. The right pane — the open commit: a heading, a
    "{author} · {date} · {hash} · {n} files" line, then **per file** a path + a
    *Restore this version* `.btn` and the `.editor` **line diff** (`.ln` classed
    `md`/`del`/`add`, `@@` hunk headers). Caption: "Restoring writes that file as it
    was after this commit into the working copy, to be saved as a new version."
- **`docs/mockups/README.md` L26** — "**Every status badge carries a word, never
  colour alone.**" Binds every tree status and the change-list badges.
- **`docs/mockups/README.md` L24** — "the rendered chart is NOT monospaced; only the
  raw source editor is" — the tree names and the raw editor are `t-mono`.

### The code seams this extends

- **The git history layer:** `app/src/worker/history.js` — `bookLog` (`:344`),
  `restoreVersion` (`:320`), `readVersion` (`:303`), `changedFiles` (`:191`),
  `SHORT` (`:52`), `EMPTY_TREE` (`:57`). All local git reads live here (`git.js`
  header); the per-commit diff op this task adds belongs here, not in `git.js`.
- **The working copy:** `app/src/worker/working-copy.js` — `write` (`:82`), `save`
  (`:101`, several files, one commit), `discard` (`:238`). All local git writes
  live here; the `move`/`remove` ops this task adds belong here.
- **Canonicalisation + the setlist library:** `app/src/worker/canonicalise.js`
  (`canonicaliseFile`, `:68`) already imports the cifra.md setlist writer; the
  relink helper composes `parseSetlist` (`cifra.md/js/src/setlist.js:288`),
  `songPath` (`:167`), `pathFromSetlistToSong` (`:513`), `retargetItem` (`:655`),
  `writeSetlist` (`:441`).
- **The raw editor:** `app/src/editor/SongEditor.jsx:67` (and `OPEN_SOURCE`/`SOURCE`/
  `source`, debounced `WRITE`, `onSave` seam). Dev-mount pattern:
  `app/src/editor/EditorDev.jsx`, `app/src/songs/HistoryDev.jsx`,
  `App.jsx`'s `#dev/…` hash route.
- **The line diff + save sheet:** `app/src/songs/line-diff.js:82` (`lineDiff`),
  `SongHistory.jsx` (`LineDiffView`), `app/src/songs/SaveSheet.jsx:190`.
- **The store/protocol:** `createStore(endpoint)` → `store.send`, `store.slice`,
  `store.open()`; `useSlice(store, name)` (`useStore.js`), `useWorkerEvent(store,
  kind, handler)` for one-shot events (no promise/correlation API);
  `command`/`CommandKind`/`event`/`EventKind` (`protocol.js`), `reduce`
  (`reducer.js`, referentially-stable slices). The channel is open to new kinds;
  a user-driven Worker flow owns its full seam (CommandKind/EventKind + `ensure…()`
  + dispatch + slice), as `storage.history` did (history.md Decision 1).
- **The mount/entry:** `app/src/shell/AppShell.jsx` (`destinationPanels`, the
  `<NewSongHost>` full-screen override pattern), `app/src/books/BooksScreen.jsx`
  (the `onOpenBook` seam, a no-op default). `folderNames(bookId, folder)`
  (`logic.js:488`) lists one directory via `fs.promises.readdir` — the only
  existing listing; a **whole-tree** walk is new (Decision 1).
- **Accessibility:** `checkWcag21aa(container)` (`app/src/a11y/axe.js`) — WCAG 2.1
  AA tags; contrast/layout rules do not run under jsdom, so contrast is pinned at
  e2e-web.
- **Test support:** `createLoopbackEndpoint` (`app/src/test/loopback.js`),
  `installWebLocks` (`app/src/test/web-locks.js`), `fake-indexeddb`,
  `createFileSystem` (`app/src/worker/fs.js`), the git CLI via
  `git-http-remote.js`/`spawn` — the in-process Worker rig, as
  `working-copy.behavior.test.js` and `history.behavior.test.js` use it. A **local**
  book needs no remote.

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data.** `FileView` reads
  the `tree`, `bookLog`, `source` and `save`/`savePreview` slices through `useSlice`
  and sends `BOOK_TREE`/`MOVE_FILE`/`DELETE_FILE`/`COMMIT_DIFF`/`SAVE`/`RESTORE_VERSION`
  through `store.send`; it never touches IndexedDB, never runs git, never reads the
  working tree directly (DIRECTION §3.7 L407–414). The tree walk, the move/delete,
  the setlist relink and the commit diff are framework-free Worker code. The line
  diff itself is computed in the view over version texts the Worker hands over
  (as `songs.history` does — history Decision 6). *Central.*
- **Offline first; no account needed.** Every file operation is a local working-copy
  change; `save` commits locally and best-effort pushes (never blocks, never rolls
  back offline). Restore writes the working copy and does not commit. No operation
  waits on the network. *Central — pinned by the Worker behavior test and the e2e.*
- **Canonical form over preserving content.** Moves/renames/edits are saved through
  the existing `save`, which canonicalises every song and setlist
  (`canonicaliseFile`); the setlist relink writes **canonical** setlists by
  construction (`writeSetlist`). A file holding conflict markers (marked text) reads
  as *conflict* in the tree and is refused by `save` (the writer throws
  `MarkedTextError`), so it is never committed. **The service's canonical-form
  enforcement on push, the *what a book may hold* / *stowaway* / limit checks (the
  `pre-receive` hook), and the canonical-form specification gaps workflow 14
  §Canonical form names (BOM, line endings, final newline, NFC, tabs; the setlist
  canonical form) are NOT this task's** — they are `hook.messages`/`hook.home_book`
  (M3) and cifra.md spec/corpus work. This task keeps the app to the allowed kinds
  locally (BOOK_TREE lists only them; MOVE_FILE keeps the kind) but does not
  implement the wire-side guarantee. *Scoped out explicitly (Decision 8).*
- **Accessibility (every UI task).** Every interactive part is a React Aria
  Component — the tree (a keyboard-navigable list/tree with selection), the New menu
  and the rename dialog and the delete confirm (overlays), the raw editor
  (`SongEditor`, already RAC-clean), the changes-to-save checkboxes, the history list
  and the per-file *restore* buttons — with full keyboard paths and axe at WCAG 2.1 AA
  on every state (tree, open file, rename dialog, delete confirm, the change list, the
  history list, an open commit, empty). **Statuses are carried by a word**, never
  colour alone (mockups README L26). On the wide master-detail the open file/commit
  carries `.sel`; selection is `useState`. *Central.*
- **No song text / no file names in logs.** The Worker logs nothing — a file name, a
  setlist link and a song's text are a user's words; `save`'s commit message is the
  save note. Fixtures are purpose-written songs and setlists. *Applies.*
- **One lock per logical operation** (locks.md Decision 1). The tree read, the
  move+relink, the delete and the commit diff each take one `withLock(bookId, …)`;
  the move+relink writes the moved file, the removed old file and the rewritten
  setlists all inside that one lock (one logical operation, one commit on save). Web
  Locks are non-reentrant — no nesting, no calling a sibling op that re-locks.
  *Applies.*
- **Component boundaries (DIRECTION §3.6).** No code shared with the service; the file
  view operates entirely on the device. The setlist relink composes cifra.md JS
  (already in the app); it writes no second implementation (implementations agree
  because they are checked to the corpus, not shared). *Applies.*
- **No book without an account** — bears on **shared** books (reader/editor gate on
  who may do file operations), filled by the membership seam (Decision 5); not
  applicable to a local book, which lives only on the device. The whole app carries
  `noindex`. *Applies to the shared case via a seam.*

## Acceptance criteria

### Behavior delivered

1. **Mounts as the file view for a book.** The file view opens full-screen for a
   `{ bookId }` (overriding the tabs, as the editor host does), reached from the
   per-book *Files* entry on the book-management screen (`BooksScreen`'s `onOpenBook`
   seam) and from a `#dev/files?book=…` dev mount. The reading view's *show the file*
   entry is `songs.reading`'s to wire (render-when-present seam; Decision 7). Wide:
   tree and file side by side; narrow: one at a time (workflow 14 L124–132).
2. **The tree lists only the allowed kinds, with statuses as words.** `FileView`
   reads the `tree` slice (the working tree walked in the Worker), grouped into
   folders, listing `*.cifra.md`, `*.setlist.md`, `README.md`, `.gitattributes`
   (and folders holding them) and nothing else (`.git` excluded). Each file shows its
   status as a **word** — *unsaved changes* / *new* / *deleted* (struck through) /
   *conflict* / nothing — each a word + the matching `.badge` class, never colour
   (workflow 14 L134–138; mockups README L26).
3. **The raw editor opens any file.** Selecting a file mounts `SongEditor` over its
   `{ bookId, path }` (remounted by `key`), loading via `OPEN_SOURCE` and persisting
   via the debounced `WRITE`; editing marks the file *unsaved changes* in the tree
   (workflow 14 L148).
4. **Rename/move keeps the kind and updates setlist links.** The rename dialog pins
   the extension (a `.cifra.md` stays a song) and takes a new base name and/or folder;
   submit sends `MOVE_FILE { bookId, fromPath, toPath }`. The Worker moves the file's
   working-copy bytes to `toPath`, removes `fromPath`, and **rewrites every setlist in
   the book whose item resolves to the moved song** to the new relative path — all
   uncommitted working-copy changes; the tree reflects them, and the next `SAVE`
   commits them in one commit. A cross-kind move is refused (workflow 14 L144–146; W14
   rename dialog; Decision 2).
5. **Delete, asked once.** A delete control, after one confirm (mirroring
   `RestoreConfirm`/`DiscardConfirm`), sends `DELETE_FILE { bookId, path }`: a
   committed file is removed from the working copy and shown *deleted* until save; a
   never-saved file is unlinked outright. Setlist links are **not** rewritten — a
   setlist pointing at the deleted song becomes a *missing item* (workflow 14 L147;
   workflow 12; Decision 2).
6. **Saving several files.** The changed files are listed with a check beside each,
   all checked; *Save…* opens the `SaveSheet` for the checked paths and commits them
   in one `SAVE` (workflow 14 L152–159; reusing `songs.save_sheet`).
7. **The book's history, with line diffs and per-file restore.** A history list reads
   the `bookLog` slice — every commit newest first, merges marked, each with message,
   author, date, short hash and files touched. Opening a commit sends `COMMIT_DIFF
   { bookId, commit }`; the view renders each touched file's plain line diff via
   `lineDiff` + `LineDiffView` and a per-file *restore this version* that sends
   `RESTORE_VERSION` (writing the historical bytes into the working copy, uncommitted,
   to be saved as a new version). A deleted file is restored the same way, from a
   commit where it still existed (workflow 14 L161–173; workflow 6; Decision 4).
8. **New song here.** The New affordance wires *new song in the current folder* to
   `NEW_SONG { targetBookId: bookId, folder, author }`, opening the editor for the
   placeholder, then `NAME_AND_SAVE` at first save — the folder-aware seam
   `songs.new_song` left to this task. New → Setlist is deferred to `books.setlists`;
   a folder is emergent; the README already exists (Decision 6).
9. **Empty/degenerate states.** A freshly made book shows its `README.md` and
   `.gitattributes` (scaffolded on create) and no songs, never a blank pane; a book
   with no unsaved changes shows an empty change list and no *Save…*; a book with no
   history beyond the root commit shows that one commit (`role="status"` lines where
   there is nothing, mirroring `search.empty`).

Wiring: a new `app/src/files/` area — `FileView.jsx` and presentational children
(`FileTree.jsx`, a raw-editor host, `RenameFileDialog.jsx`, `DeleteFileConfirm.jsx`,
`BookHistory.jsx`, `CommitDiff.jsx`), a pure `file-tree.js` (the folder assembly,
kind derivation and status→word mapping and ordering), `file-view.css`, `FilesDev.jsx`;
a `fileView` section in all four i18n catalogues; the *Files* entry +
full-screen host in `BooksScreen.jsx`/`AppShell.jsx`; a new `app/src/worker/book-tree.js`
(`createBookTree({ fs, git, locks })`) and `app/src/worker/setlist-links.js` (pure
`relinkSetlists`); `move`/`remove` on `working-copy.js`; a per-commit diff op on
`history.js`; `CommandKind.BOOK_TREE`/`MOVE_FILE`/`DELETE_FILE`/`COMMIT_DIFF`,
`EventKind.TREE`/`FILE_MOVED`/`FILE_DELETED`/`COMMIT_DIFF` in `protocol.js`; the
dispatch cases + `ensure…()` composition in `logic.js`; a `tree` slice + folds in
`reducer.js`. **`bookLog`/`RESTORE_VERSION`/`SAVE`/`PREVIEW_SAVE`/`OPEN_SOURCE` and
their slices are reused unchanged.**

### Tests the task lands with, by level

Per the `.tji` note: **behavior** and **e2e-web**; a **unit** level is added for the
two pure helpers and is justified below (genuine pure modules; the testing policy
permits adding a level a task needs). Fixtures are purpose-written songs and
setlists, never anyone's copyrighted words.

- **unit — `app/src/worker/setlist-links.test.js`** (added level):
  - `relinkSetlists({ setlists: [{ path, text }], fromPath, toPath })` rewrites a
    setlist item whose link resolves to `fromPath` to the new relative path
    (`pathFromSetlistToSong` recomputed for the setlist's folder), returns only the
    setlists it changed, and leaves a setlist that does not reference the song
    untouched; output is canonical (`writeSetlist`). *Pins workflow 14 L144–146;
    cifra.md spec §10.4–10.5, §10.10.*
  - A setlist referencing the song from a different folder gets the correct `..`/
    descent path; a move within the same folder changes only the file name. *Pins the
    relative-path machinery.*
- **unit — `app/src/files/file-tree.test.js`** (added level):
  - `buildTree(entries)` assembles folders from file paths (git has no empty folders),
    orders folders-then-files and alphabetically, derives each file's **kind**
    (song/setlist/readme/gitattributes) from its name, and excludes anything else.
    *Pins workflow 14 L24–29, L141–143.*
  - `statusWord(status)` maps `unsaved`/`new`/`deleted`/`conflict`/in-step to the
    `fileView.status.*` copy key. *Pins workflow 14 L134–138; mockups README L26.*
- **behavior — `app/src/files/FileView.behavior.test.jsx`** (real RAC and i18n; a
  loopback-backed store seeded with `tree`/`bookLog`/`source`/`savePreview` slices;
  the CodeMirror geometry stub; axe over `container`):
  - *The tree* — a seeded `tree` (folders, a song, a setlist, README, .gitattributes,
    and a file in each status) renders folders-then-files, only the allowed kinds, and
    each status as its word + badge. *Pins workflow 14 L134–138, L24–29.*
  - *The raw editor* — selecting a file mounts the editor and shows its `source` text.
    *Pins workflow 14 L148.*
  - *Rename keeps the kind and shows the link notice* — the rename dialog pins the
    `.cifra.md` suffix and shows the setlist-link notice; submit sends `MOVE_FILE
    { fromPath, toPath }`. *Pins workflow 14 L144–146.*
  - *Delete asks once* — the delete confirm opens, submit sends `DELETE_FILE`, and the
    row reads *deleted*. *Pins workflow 14 L147.*
  - *Save several* — the change list shows each changed path checked; *Save…* opens the
    save sheet for the checked paths. *Pins workflow 14 L152–159.*
  - *History, line diffs, restore* — the `bookLog` list renders commits newest-first
    with merges marked, short hash and files; opening one sends `COMMIT_DIFF` and
    renders each file's line-diff hunks (`add`/`del`/`context`); *restore this version*
    sends `RESTORE_VERSION`. *Pins workflow 14 L161–173.*
  - axe clean on the tree, the open file, the rename dialog, the delete confirm, the
    change list, the history list and an open commit.
- **behavior — `app/src/worker/file-ops.behavior.test.js`** (the Worker rig —
  `fake-indexeddb`, `installWebLocks()`, `createFileSystem`; **no remote**, a local
  book scaffolded with songs and a setlist; the git CLI cross-checks state):
  - *The tree with statuses* — `BOOK_TREE` lists the allowed kinds and folders
    (`.git` excluded), a working-copy-modified song as *unsaved changes*, a
    never-committed file as *new*, and a removed file as *deleted*. *Pins workflow 14
    L24–29, L134–138.*
  - *Rename keeps the kind and relinks setlists* — `MOVE_FILE { fromPath:
    "valsa.cifra.md", toPath: "mpb/valsa-da-esquina.cifra.md" }`: the song bytes are at
    the new path, the old path is gone, and a seeded setlist referencing the song is
    rewritten to the new relative path — all **uncommitted** working-copy changes; a
    following `SAVE` of the two paths makes **one** commit holding both. Asserted via
    the git CLI / isomorphic-git. *Pins workflow 14 L144–146, L152–159.*
  - *A name keeps its kind* — `MOVE_FILE` from `.cifra.md` to `.setlist.md` is refused.
    *Pins "A name keeps its kind" (workflow 14 L146).*
  - *Delete* — `DELETE_FILE` on a committed song leaves it *deleted* until a `SAVE`
    commits the removal, and does **not** rewrite a setlist referencing it (the link is
    left dangling → a missing item); on a never-saved file it unlinks it outright.
    *Pins workflow 14 L147; workflow 12.*
  - *The commit diff* — `COMMIT_DIFF { commit }` returns per-file `{ path, status,
    before, after }` for an added file (before empty), a modified file (both), and a
    deleted file (after empty), matching `git show`. *Pins workflow 14 L161–167.*
  - *Restore is uncommitted / offline* — `RESTORE_VERSION` writes a past version into
    the working copy with HEAD unchanged and no push; the whole sequence makes no
    network call. *Pins workflow 14 L169–173; workflow 6; offline-first.*
- **e2e-web — `e2e/web/tests/file-view.spec.js`** (compose stack, phone/tablet/
  computer projects, axe WCAG 2.1 AA on every screen the view touches):
  - *The file view on the three viewports* — open a local book's file view; write a new
    song from the file view (named at first save) and see it in the tree; raw-edit it
    and rename another song (keeping `.cifra.md`); save both in one commit from the
    change list (save several); then open the book's history, open the commit, and
    restore an earlier version of a file from the log, saving it as a new version — on
    each viewport. Entirely in-app (a local book, songs written in-app), so fully
    implementable now. *Pins workflow 14 L124–173; DIRECTION §4 L449–452; the
    file-view new-song entry `songs.new_song` deferred here.*
  - axe at WCAG 2.1 AA on the tree, the raw editor, the rename dialog, the change list,
    the history and an open commit, on every viewport.

The e2e asserts the three `.tji` cases (a rename keeping its kind, a raw edit saved
with another file, a restore from the log) plus the deferred new-song-from-file-view
entry. The **setlist-link update on move** is pinned at the unit and Worker-behavior
levels (which can stage a setlist freely; in-app setlist creation is `books.setlists`,
M5, not available at M2), not the e2e — a deliberate level placement, not a dropped
case (Decision 3). No test level named in the `.tji` is dropped.

### Deferred work and graph notes (closer registers / wires)

- **No new WBS leaves.** Everything this screen leaves open is an **existing** leaf or
  a render-when-present seam:
  - **New → Setlist** → `books.setlists` (`65-books.tji`, M5, workflow 12): adds the
    Setlist entry to the file view's New menu and the setlist create/edit flow. In M2
    the New menu offers *Song* (functional, via `songs.new_song`); *Setlist* appears
    when `books.setlists` lands.
  - **Live *conflict* status in the tree** → `sync.conflicts` (M4, workflow 9): fills
    the conflict status the tree already renders when present; in M2 there is no sync,
    so no conflicts arise (the status slot renders when the Worker reports a marked
    file).
  - **Reader/editor gate on file operations for a shared book** → `books.share` /
    membership: rename/move/delete/new are offered when the book is savable (reuse
    `canSaveFor`, `app/src/books/book-display.js`); a reader sees a read-only tree,
    editor and history. In M2 every book is local and savable.
  - **The reading view's *show the file* entry** → `songs.reading` (M2): wires the
    second way into the file view (opening the tree at a given file). This task exposes
    the open-at-path seam; `songs.reading` calls it. (Mirrors how `songs.search` left
    `onOpenSong` to `songs.reading`.)
  - **Similarity-based rename detection in the log** — already parked by
    `storage.history` (exact/content-preserving rename-following via `log({ follow:
    true })` covers all app renames and `git mv`); not a new task.
- **Graph note for the closer (not a new task): add `cifra_js.setlists` to
  `books.file_view`'s `depends`.** The setlist-link rewrite on move composes
  `parseSetlist`/`pathFromSetlistToSong`/`retargetItem`/`writeSetlist`
  (`cifra.md/js/src/setlist.js`), shipped by `cifra_js.setlists` (M1,
  `10-cifra-js.tji`, complete). It is available transitively (M2 depends on
  `milestones.m1_format`), but the honest edge is `books.file_view → cifra_js.setlists`;
  surfaced for the closer to record.
- **Graph note (already present): `books.file_view` depends on `songs.new_song`.** The
  edge `songs.new_song` added for the folder-aware file-view entry is already on the
  `.tji` line and in the M2 milestone; no action, noted for continuity.

## Decisions

1. **The file tree is a new Worker-walked `tree` slice, not the search index or the
   `browse` slice.** The index holds only `*.cifra.md` songs — it omits setlists,
   README and `.gitattributes`, and carries no working-copy status — so it cannot be
   the file tree. The file view needs **every file the book holds, with its working-tree
   status**. So a new `book-tree.js` reader walks the working directory (recursively,
   `fs.promises.readdir`, excluding `.git`), keeps only the allowed kinds, and computes
   each file's status from `statusMatrix` (unsaved/new/deleted) and a marked-text check
   (conflict), surfaced as a `tree` slice keyed by bookId. *Rejected: deriving the tree
   from `browse`/the index — it hides setlists, README, `.gitattributes` and empty-folder
   context, and has no delete/conflict status. Rejected: walking the HEAD tree only — it
   would miss new and deleted working-copy files, exactly the statuses the view shows.*
2. **Rename/move and delete are new working-copy ops (`move`/`remove`), delivered here
   because this is the first task to move or delete a committed file; the setlist relink
   rides inside the move.** `songs.new_song` built only placeholder-rename
   (`nameAndSave`, no HEAD blob, no `git mv`) and explicitly reserved real file
   moves/deletes to the file view. `working-copy.move({ bookId, fromPath, toPath })`
   writes the file's working-copy bytes to `toPath`, removes `fromPath`, and applies the
   pure `relinkSetlists` to the book's setlists — all uncommitted, under one lock, saved
   later in one commit (the mockup's "updated in the same save"). `working-copy.remove({
   bookId, path })` unlinks a never-saved file or stages the removal of a committed one
   (shown *deleted* until save). The relink is a **pure** `setlist-links.js`
   (`relinkSetlists`) composing cifra.md's setlist exports, so it unit-tests without I/O.
   *Rejected: a `git mv` plumbing op — the move must also rewrite setlist links and stay
   uncommitted until the shared save, so it is a working-copy edit, not a staged rename.
   Rejected: rewriting setlist links on delete — workflow 14 scopes relinking to
   rename/move; a deleted song's links become missing items (workflow 12), which is the
   designed behavior.*
3. **Saving several files reuses the existing multi-file `SAVE` and `SaveSheet`; the
   file view adds only the checkbox change-list.** `working-copy.save` already takes a
   `paths` array and makes one commit, and `SaveSheet` already renders a multi-file
   musical diff and commits several paths. The file view's contribution is the
   change-list with per-file checks (the one piece of git staging it keeps) that feeds
   the checked paths to the sheet. *Rejected: a new multi-file save path — the primitive
   and the sheet exist; a second would duplicate canonicalisation and the commit. The
   setlist-link update is pinned at unit + Worker-behavior, not e2e, because in-app
   setlist creation is `books.setlists` (M5); the e2e stages only what M2 can make.*
4. **Per-commit diffs come from a new `COMMIT_DIFF` Worker op returning per-file version
   texts; the view computes and renders the line diff with the existing `lineDiff` /
   `LineDiffView`.** `bookLog` already reports which files a commit touched and their
   status; `COMMIT_DIFF { bookId, commit }` reuses the same tree-walk to read, per file,
   the blob at the commit and at its first parent (before empty for an add, after empty
   for a delete), returning `{ path, status, before, after }`. The view runs
   `lineDiff(before, after)` and renders the classed hunks — the same dependency-free,
   CodeMirror-free, stub-free path `songs.history` established. *Rejected: fetching each
   file's two versions with paired `READ_VERSION` calls from the view — chatty (2N round
   trips per commit) and `READ_VERSION` errors on the missing-path edges (add/delete),
   which `COMMIT_DIFF` resolves in the Worker in one reply. Rejected: computing rendered
   hunks in the Worker — line-diff rendering is a pure view concern already owned by
   `line-diff.js`; the Worker owns only the git reads.*
5. **Where-it-lives savability and the live conflict status are render-when-present
   seams.** A file's status is whatever the Worker reports; *conflict* is populated by
   sync (`sync.conflicts`, M4) and renders when present, nothing otherwise — the file
   view does not compute merge state. Whether file operations are offered is gated by
   `canSaveFor` (local always; a shared book by its editor role, filled by
   `books.share`). *Rejected: computing conflict/merge state or the membership role in
   the file view — it would pull sync and membership into a local-first M2 screen,
   crossing the component boundary; the seam lets the owners fill it, as `songs.search`
   did for `voicedFor`/`conflict`.*
6. **The New menu offers *Song* (functional, via the folder-aware `NEW_SONG`) here;
   Setlist, Folder and README are deferred or emergent.** `songs.new_song` made
   `NEW_SONG` folder-aware precisely so the file view wires *new song in this folder*;
   that is this task's. Creating a **setlist** is `books.setlists`'s (its format and
   editing live there, M5). A **folder** is emergent — git has no empty folders, so "new
   folder" is just a new file at a folder path, covered by new-song-in-a-folder. The
   **README** always exists (scaffolded on book create, `books.shelf`), so the menu
   shows it as already present (the W14 board draws exactly this). *Rejected: building
   setlist creation here — it needs the setlist format and editing UI that `books.setlists`
   owns; drawing a dead Setlist entry now would mislead. This mirrors how `books.shelf`
   shipped the Add-a-book sheet with only New book functional.*
7. **Selection and the open view are ephemeral `useState`; the view mounts full-screen
   from the books screen.** Like the shell's destination selection and the editor host,
   the open file view (its `bookId`), the selected file/commit, and the open dialogs are
   `useState`, not a store slice — there is no router and nothing to persist. The file
   view mounts full-screen (overriding the tabs) from `BooksScreen`'s `onOpenBook` seam
   and a `#dev/files` dev route, exactly as the new-song editor host does; the reading
   view's *show the file* is a second entry `songs.reading` wires. *Rejected: a store
   slice for the open view or selection — the shell set the precedent that navigation is
   ephemeral; the editor host set the precedent for a full-screen tab override.*
8. **This task is the app view only; workflow 14's service/spec portions are other
   tasks.** Workflow 14 also decides *what a book may hold* on the wire, *what the
   service checks* (the `pre-receive` hook over quarantined objects: one ref,
   fast-forward only, no stowaways, every blob's path/mode/size/encoding/canonicality,
   the limits), and the canonical-form **specification** gaps (BOM, line endings, final
   newline, NFC, tabs; a setlist canonical form). Those land in `hook.messages`/
   `hook.home_book` (M3) and cifra.md spec/corpus work, not in this M2 app task. The
   file view keeps the app to the allowed kinds locally (the tree lists only them; a
   move keeps the kind; `save` canonicalises), which is the app's half of the contract;
   the service remains the guarantor. *Rejected: implementing any push-time check here —
   it is the hook's, and the app and the service share no code (DIRECTION §3.6).*

## Open questions

(none — all decided.) One graph edge is surfaced for the closer rather than left open:
`books.file_view` should depend on `cifra_js.setlists` (whose setlist path/relink exports
the move composes); the `songs.new_song` edge it also needs is already present.

## Status

**Done** — 2026-10-06.

- Worker: `app/src/worker/book-tree.js` (new — `createBookTree({ fs, git, locks })` → `tree({ bookId })`), `app/src/worker/setlist-links.js` (new — pure `relinkSetlists`); extended `working-copy.js` (move/remove ops), `history.js` (commitDiff op), `logic.js` (ensureBookTree + four dispatch cases: BOOK_TREE/MOVE_FILE/DELETE_FILE/COMMIT_DIFF), `protocol.js` (+CommandKind.BOOK_TREE/MOVE_FILE/DELETE_FILE/COMMIT_DIFF, +EventKind.TREE/FILE_MOVED/FILE_DELETED/COMMIT_DIFF), `reducer.js` (+tree slice and fold).
- View: `app/src/files/` (new area) — `FileView.jsx`, `FileTree.jsx`, `RawEditorHost.jsx`, `RenameFileDialog.jsx`, `DeleteFileConfirm.jsx`, `BookHistory.jsx`, `CommitDiff.jsx`, `FilesDev.jsx`, `file-tree.js`, `icons.jsx`, `file-view.css`; extended `shell/AppShell.jsx` (full-screen host + onOpenBook), `books/BooksScreen.jsx` (per-book Files entry), `App.jsx` (`#dev/files` mount), `songs/SongHistory.jsx` (exported `LineDiffView`), `i18n/locales/{en,pt-BR,es-419,it}.js` (+`fileView` section).
- Tests — unit: `app/src/worker/setlist-links.test.js` (4 tests), `app/src/files/file-tree.test.js` (3 tests); behavior: `app/src/files/FileView.behavior.test.jsx` (6 tests, axe), `app/src/worker/file-ops.behavior.test.js` (6 tests); e2e-web: `e2e/web/tests/file-view.spec.js` (3 tests × 3 viewports — phone, tablet, computer; all passed, 2 flaky on computer recovered on retry #1).
- Graph edge added: `cifra_js.setlists` added to `books.file_view`'s `depends` (honest edge — the setlist-link rewrite composes its exports).
- Tech-debt: `books.file_view_spec_narrow_comment` registered (0.5d, fix stale narrow comment in the e2e spec, wired to m2_local); `file_view-nonsong-restore-save` parked (couldn't confirm defect; needs human triage).
