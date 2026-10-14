# books.setlists — Setlists

## TaskJuggler

[`tasks/65-books.tji`](../../65-books.tji), `task books.setlists` ("Setlists").

## Effort estimate

4d (from the `.tji`).

## Repository

**estante-de-cifras**, the app only. Directories:

- `app/src/books/` (or a new `app/src/setlists/` sibling) — the new setlist
  surface: the Setlists-destination list, the open/read view, the structured
  editor and its children, the Add-to-setlist dialog, the missing-item repoint
  panel, and co-located `.css` and a pure `setlist-display.js` helper.
- `app/src/worker/` — two new `CommandKind`/`EventKind` members and their
  `logic.js` switch arms (`LIST_SETLISTS`, `ADD_TO_SETLIST`) and a `setlists`
  reducer slice; **no new git/merge/index code** — the setlist file is read,
  written, canonicalised, saved and relinked through machinery that already
  exists (see Inputs).
- `app/src/songs/` — wire the existing unused `onAddToSetlist` seam in
  `SongReading.jsx` and add the same affordance to the song rows in
  `SearchScreen.jsx` (workflow 12: "on every song, in search and in the
  reading view").
- `app/src/shell/AppShell.jsx` — replace the `setlists` destination
  placeholder (currently a bare `<h1>`) with the real list, and expose the
  `openSetlist` ephemeral surface.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — a new `setlists` copy
  section (en is the source of truth; catalogue completeness is a build gate).
- `e2e/web/` — the Playwright harness (reused, not rebuilt), a new
  `e2e/web/tests/setlists.spec.js`, and an edit to `navigation.spec.js`'s
  stale "Setlists tab shows an empty `<h1>`" assertion.

**No work in cifra.md**, none in `service/` or `api/`. The cifra.md
JavaScript setlist library (`/home/ruoso/devel/cifra.md/js/src/setlist.js`,
published as the `cifra-md` package) is **consumed, not duplicated** — the
app writes no second implementation of the §10 format (standing rule:
implementations agree because they are checked to the corpus, not shared).

## Inherited dependencies

All **settled** (each `complete 100`):

- **cifra_js.setlists** (`tasks/refinements/cifra_js/setlists.md`, cifra.md
  commit `c72c24e`) — the §10 reader, canonical writer and the §10.10 editing
  operations, exported from `cifra-md`
  (`/home/ruoso/devel/cifra.md/js/src/setlist.js`), all pure
  (model→model, framework-free, below the view):
  - `parseSetlist(bytes) → { title, properties, body, diagnostics }` (:288);
    `writeSetlist(model) → text` (:441); `canonicalSetlist(model)` (:472).
  - `body` is an ordered array of items:
    `{ type:'song', number, text, path, entries }` |
    `{ type:'unlinked', number, content, entries }` |
    `{ type:'notes', lines }`. An item's `entries` hold
    `{ type:'property', key, value }` (reserved keys `key`, `note`, §10.7).
  - **`item.path` is folder-relative** — the decoded link exactly as spelled,
    relative to the *setlist's own folder* (keeps `..`), **not** book-root
    (§10.5; memory *setlist-item-path-is-folder-relative*). Resolving it to
    the book root is the app's job.
  - Path helpers `songPath(dest)` (:167), `writePath(path)` (:233),
    `pathFromSetlistToSong(setlistDirSegments, songPathSegments)` (:513);
    link-text helper `textForSong({ title, fileName })` (:574).
  - Editing transforms: `addSong(model, {text, path}, at)` (:585),
    `removeItem(model, at)` (:597), `moveItem(model, from, to)` (:607)
    [reorder], `setProperty(model, at, key, value)` (:620) [key/note],
    `removeProperty(model, at, key)` (:631),
    `pointItemAtSong(model, at, {text, path})` (:642) [repoint a missing
    item], `retargetItem(model, at, path)` (:655), `refreshText` (:665). All
    `at`/`from`/`to` are 0-based positions **among items only** (songs +
    unlinked, ignoring notes blocks).
- **songs.reading** (`tasks/refinements/songs/reading.md`) — the reading
  surface `app/src/songs/SongReading.jsx`. It already carries an
  **`onAddToSetlist({ bookId, path })` prop seam** (`:111`), raised from the
  wide app bar (`:572`) and the narrow "More" menu (`MenuItem id="addToSetlist"`,
  `:623`, i18n `reading.addToSetlist` = "Add to setlist"), but **AppShell does
  not pass it** today (`AppShell.jsx:698-708`), so it is a no-op awaiting this
  task — the "editor-owns-the-affordance, host-owns-the-action" pattern
  (reading.md Decision 6). This task is the host that wires the destination
  flow.

**Drivers complete but outside this task's `depends`** (they satisfy the
test-driving rule by being `complete 100`, not by a `depends` edge; no `.tji`
edit is made, per the `books.upload_ui` precedent):

- **books.shelf** — `app/src/books/BooksScreen.jsx` and
  `app/src/books/book-display.js` (`orderedBooks`, `canSaveFor`, `titleFor`):
  the savable-book list the Add-to-setlist picker and the New-setlist book
  choice read, and the New-book way-in that stands up a second local book for
  the cross-book e2e.
- **books.file_view** — `app/src/files/FileView.jsx`, and the already-shipped
  **relink-on-move**: the pure `app/src/worker/setlist-links.js`
  `relinkSetlists({ setlists, fromPath, toPath })` (:42) and its unit test
  `app/src/worker/setlist-links.test.js`, driven by the Worker's
  `MOVE_FILE`/`working-copy.move` so a renamed or moved song's setlist links
  are rewritten in the same save (workflow 12 §Songs moved, renamed or
  deleted L80-81). **Deleting** a song does *not* relink — it leaves a
  *missing* item (file_view.md Decision 2). This is the surface the e2e drives
  to produce a missing item.
- **songs.search** — `app/src/songs/SearchScreen.jsx`, which gains an
  Add-to-setlist affordance on its song rows.
- **foundation.e2e_web** — the Playwright harness `e2e/web/` (three viewport
  projects, `lib/axe.js`, `lib/devices.js`, `lib/offline.js`), reached through
  the `books` parent's `depends foundation.e2e_web`.
- The bundled **example book** (`app/example-book/`, globbed
  `*.{cifra,setlist}.md`) ships songs and a real sample setlist
  (`a-short-set.setlist.md`), seeded through the first-run way-in.

## What this task is

Everything a user does *with* a setlist short of playing it through. From the
**Setlists** destination (today an empty labelled slot in the shell), a list
of the setlists in the loaded books; opening one shows its songs in order,
each with its per-setlist key and note, any item whose link now points at
nothing marked **missing** and offered a song to point at. An **editor**
reorders the songs (by dragging and by keyboard), edits each item's target
key and free-text note, removes an item, adds a song, and points a missing
item at a song in the same book; every change is an ordinary unsaved edit,
committed by **Save** like any other file (workflow 4). **Add to setlist** —
wired onto every song in search and in the reading view — chooses an existing
setlist or makes a new one; adding a song from *another* book copies the song
into the setlist's book first and says so. It is purely the view, its two
small Worker commands, axe, and the e2e-web journey; the format, the merge,
the relink-on-move and the save/commit pipeline already exist.

**Out of scope — `books.play`** (the separate task `depends !setlists`): the
full-screen play-through (the W12 phone "playing through" screen, the
Wake Lock, swipe / edge-tap / pedal navigation, the next-song title, sync
waiting, and *applying* a per-item `key` as a transposition at read time). The
**Play** control is drawn in the setlist surface this task owns, so this task
renders it as an **`onPlay` seam** (the symmetric mirror of reading's
`onAddToSetlist`), wired by `books.play` when it lands.

## Why it needs to be done

The `setlists` destination is a drawn-but-dark slot (`AppShell.jsx:208-210`),
`SongReading`'s `onAddToSetlist` seam dangles, and the cifra-md setlist
library + the relink-on-move + the save pipeline have no in-app caller that
*creates or edits* a setlist. This task is the one place in-app setlist
authoring lives: `books.file_view` reserves its New → Setlist entry for it
("appears when `books.setlists` lands", file_view.md Decision 6), reading
hands it the add-to-setlist action, and `books.play` (which `depends
!setlists`) needs an openable, buildable setlist to play. It closes
workflow 12's building story and unblocks the play-through.

## Inputs / context

### Normative design

- **Workflow 12** `docs/workflows/12-setlists.md`:
  - §The file (L8-34) — a setlist is a `*.setlist.md` Markdown file in a book:
    an H1 title, a numbered list of relative links to `*.cifra.md` files **in
    the same book**, each with optional `key` and `note` properties
    (verbatim example L14-22). "Opening one lists its songs." (L34).
  - §Songs from another book (L36-42) — **"A setlist points only into its own
    book."** (L38). "*Add to setlist* on a song from another book copies the
    song into the setlist's book first, and says so." (L39-40). A personal
    multi-book gig setlist "lives in *My songs*, with copies." (L41-42).
  - §The key (L44-54) — the per-item `key` is the band's, so it lives in the
    shared setlist file, **not** in anyone's home book (L46-47); it is a
    **target key**, applied as a transposition only *while playing* (that
    application is `books.play`). This task stores and edits the property.
  - §Building one (L57-62) — "*Add to setlist* is on every song, in search and
    in the reading view, and chooses the setlist or makes a new one." (L58-59).
    "Within a setlist, songs are reordered by dragging and removed by swiping.
    Every change is an edit, saved like any other (workflow 4)." (L59-61).
  - §Songs moved, renamed or deleted (L78-85) — rename/move in the file view
    rewrites links in the same save (already shipped, file_view). "A link that
    still points at nothing … shows as *missing* in the setlist, is skipped
    when playing, and offers to be pointed at a song." (L83-85).
- **Mockup board** `docs/mockups/W12-setlists.dc.html` (canvas.json: "12.
  Setlists"). The real states and copy this task renders:
  - **Phone · a setlist opened** (L28-67): app bar — Back, title *"Setlist"*,
    quiet **Edit**, **More**; body — `h2.t-display` title (*"Bar do Zé, 10
    October"*), `t-small` meta *"{book} · {folder}/ · {n} songs"*; a
    `.btn primary block` **Play** (the `onPlay` seam); a `.list` of `.row`
    items, each a number (`t-h2`, `--ink-2`), name + meta, and badges — a
    `.badge voiced` *"in {key}"* for an item with a key, a `.badge conflict
    dot` **"missing"**; a `.notice conflict` *"**{title} is missing.** Nothing
    is at {path} any more, so it is skipped when playing."* with an `.act`
    **"Point it at a song"**; the Setlists tab active.
  - **Tablet · Add to setlist, on a song from another book** (L108-153): the
    reading view behind, a `.scrim center` `.dialog` (width 580) — `h2.t-h1`
    **"Add to setlist"**; a `.list` of setlist rows (the selected row shows a
    `--accent` check; each row name + meta *"{book} · {n} songs"*) and a
    **"New setlist…"** row (plus icon, accent); a `.notice accent`
    *"**This song will be copied into {book} first.** {title} is in
    {otherBook}, and a setlist points only at songs in its own book."* with the
    song's `t-mono` path; a `p.t-small` *"The copy and the setlist change are
    then unsaved changes to {book}, saved like any other."*; `.actions` —
    **Cancel** / **Copy and add** (same-book: **Add**).
  - **Computer · the setlist editor beside its Markdown file** (L159-243): app
    bar — Back, title, book name, `.badge unsaved dot` *"unsaved changes"*,
    **Add song**, **Play**, primary **Save**; a `.split` — `.pane main` the
    editable list (`section-label` *"Songs · drag to reorder"* +
    *"Key and note apply in this setlist only"*), each `.row` = a drag-handle
    `.btn icon` (`aria-label="Drag to reorder"`), number, name/meta, a key
    `.input` (placeholder *"Key"*, 64px), a note `.input` (placeholder
    *"Note"*, 200px), a remove `.btn icon` (`aria-label="Remove from
    setlist"`); it draws the drag state (shadow + `outline: 2px solid
    var(--accent)` + `translateX`), a missing row (`background:
    var(--conflict-soft)`, meta *"{path} is not in the book"*, `.badge conflict
    dot` *"missing"*) with an inline repoint panel *"Point it at a song in
    {book}"* — a `.search` field, a result `.list`, `.actions` **Cancel** /
    **Point here**; `.pane side` = the raw `*.setlist.md` text (per-line
    classes `ln md|cur|err`) with the note *"Links are relative to {folder}/,
    so the file opens the songs on any git host."*
  - Status is carried by a **word** on every badge, never colour alone
    (`docs/mockups/README.md:26`).
  - Tokens (`docs/mockups/theme.css`, scoped to `.est`): `.badge` +
    `.badge.voiced|.conflict`, `.notice.accent|.conflict`, `.list`/`.row`/
    `.name`/`.meta`/`.badges`, `.seg`, `.split`/`.pane.side|.main`, `.appbar`,
    `.scroll`, `.dialog`/`.scrim`, `.btn.primary|.quiet|.icon|.block`,
    `.field`/`.input`, `.chip.accent`, `--conflict-soft`, `--accent`,
    `--ink-2`.
- **DIRECTION.md**:
  - §3.7 L420-461 — the app: React with React Aria Components; L430 names
    "drag to reorder a setlist" and "drag and drop with a keyboard
    alternative" among the hard accessible interactions. L433-435: "One owner
    for the data: a Web Worker … does every clone, fetch, merge, save and
    index update. The main thread never touches IndexedDB." L436-440: the
    store on the main thread is fed by the Worker's messages, read via
    `useSyncExternalStore`. L441-443: the music core and cifra.md JS "know
    nothing of React; the view is the only layer that does."
  - §3.2 L136-151 — personal state lives in the home book (JSON, auto
    committed); the per-item setlist `key` is **not** personal — it is the
    band's, in the shared setlist file (cross-reference workflow 12 §The key).
  - §4 L462-478 — song search is the primary interface; *Add to setlist* lives
    in search and the reading view; renaming/moving/deleting files happens only
    in the file view (the surface that relinks setlists).

### Code seams (all exist)

- **Worker contract** `app/src/worker/protocol.js` — envelope
  `{ v, dir, kind, payload }`; `command(kind, payload)` (:612),
  `event(kind, payload)` (:617); `CommandKind`/`EventKind` are frozen but the
  `kind` string is **open to new members**. `logic.js` dispatches one
  `case CommandKind.X` per command in the switch at `logic.js:944`.
- **Reused commands** (no change): `OPEN_SOURCE` → `SOURCE` event/`source`
  slice keyed `[bookId][path].text` (handler `logic.js:1988`) — read the live
  working-copy setlist text; `BOOK_TREE` → `TREE`/`tree` slice
  (`logic.js:1227`) — the book's file set, for missing-item detection;
  `WRITE` (`logic.js:948`) persists edited text; `SAVE` (`logic.js:966`)
  canonicalises + commits + pushes; `DISCARD` (`logic.js:1138`) reverts;
  `PREVIEW_SAVE` → `SAVE_PREVIEW` (`logic.js:1028`); `SEARCH` scoped to
  `{ books:[bookId] }` (`logic.js:1279`) — the in-book song search that drives
  the repoint picker and the add-song picker.
- **Store + hooks** — `app/src/worker/store.js` `createStore`/`getAppStore`,
  folding events through the pure reducer `app/src/worker/reducer.js`;
  `app/src/worker/useStore.js` `useSlice(store, name)` and
  `useWorkerEvent(store, kind, handler)` (one-shot). Commands:
  `store.send(command(CommandKind.X, payload))`. No promise/correlation API.
- **Canonicalisation** `app/src/worker/canonicalise.js` — `SETLIST_SUFFIX =
  '.setlist.md'` (:31) dispatches a setlist file through
  `writeSetlist(parseSetlist(input))` (:70-73), so `SAVE` already writes a
  setlist canonically; a marked (conflict-marker) setlist is tolerated by the
  writer, never raised.
- **Kind detection** `app/src/worker/book-tree.js` (:18-26) and
  `app/src/files/file-tree.js` `kindOf`/`baseSuffixFor` already classify
  `.setlist.md`.
- **Routing** — no router. `AppShell.jsx` holds ephemeral `useState` surfaces
  (`openSong`, `openFile`, `editing`, …), each an early full-screen `return`;
  this task adds `openSetlist`. A `#dev/setlists?book=&path=` hash mount +
  `SetlistsDev.jsx` stands the surface up (the `ReadingDev`/`FilesDev`
  pattern, `app/src/App.jsx:24-75`). Member deep links reuse
  `bookSongPath`/`bookSongRoute` (`app/src/books/book-route.js`).
- **Theming / overlays** — `app/src/theme/ThemeRoot.jsx` wraps the app in
  react-aria `UNSAFE_PortalProvider` (`getContainer` → the `.est` root,
  :67), so every RAC overlay (the Add-to-setlist `Modal`, the New-setlist
  dialog, menus, the drag preview) portals into `.est` and resolves tokens
  automatically — **no per-screen `portalContainer`** (memory
  *rac-overlays-portal-outside-est-theme-root*; pinned by
  `e2e/web/tests/portal.spec.js`).

### Test harness

- Behavior (React): `*.behavior.test.jsx`, rendered under jsdom against a
  loopback store (`createLoopbackEndpoint(createLogic)`,
  `app/src/test/loopback.js`) → `createStore`, Testing Library, real RAC +
  i18n, axe via `checkWcag21aa` (`app/src/a11y/axe.js`). Contrast/layout axe
  rules do not run under jsdom — contrast is pinned at e2e-web only.
- Behavior (Worker): `*.behavior.test.js` on the file-ops rig
  (`app/src/worker/file-ops.behavior.test.js` is the model — it already pins
  workflow 14 *and* workflow 12): injected `fake-indexeddb`,
  `installWebLocks()` (`app/src/test/web-locks.js`), a shared lightning-fs
  (`createFileSystem`, `fs.js`), a book scaffolded with the real `git` CLI,
  state cross-checked with `isomorphic-git`, an `until()` poll, `seedEnv()`
  identity. All setlist/song text written in-test.
- Unit: `*.test.js` beside source, vitest.
- e2e-web: `e2e/web/tests/*.spec.js`, Playwright over the compose stack, three
  viewport projects auto-run, axe WCAG 2.1 AA on each screen/overlay; helpers
  in `e2e/web/lib/`.

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data**
  (DIRECTION §3.7). The view never touches IndexedDB or git. It composes the
  setlist model itself from working-copy text (`OPEN_SOURCE` → `source` slice
  → `parseSetlist`) and applies the pure cifra-md editing ops in the view,
  matching reading.md's "the view composes the music core; the Worker surfaces
  state, not a prepared model." The Worker owns only the two operations that
  need I/O or atomicity across files — `LIST_SETLISTS` and `ADD_TO_SETLIST`.
- **Canonical form over preserving content.** Every save writes the setlist in
  canonical form (the existing `canonicalise.js` path); the editor's in-view
  edits compose with `writeSetlist` before `WRITE`, so what is persisted is
  always canonical. An editor MUST NOT, on its own initiative, remove or
  silently retarget a missing/unlinked item (spec §10.10 L640-642) — the user
  points it, or removes it, explicitly.
- **One lock per logical operation; Web Locks are non-reentrant.**
  `ADD_TO_SETLIST` does its copy-the-song, create-if-new and add-the-item as
  uncommitted working-copy changes under a single `withLock(targetBookId)`
  (the file_view move+relink precedent), so a confirm is one coherent unsaved
  change, saved as one commit.
- **Offline first.** Add-to-setlist, every edit and the cross-book copy write
  the working copy locally and are **unsaved** until the user saves; saving
  commits locally and pushes when there is a network (the existing `SAVE`).
  Nothing waits on the network.
- **Accessibility** (WCAG 2.1 AA, every state and overlay): every interactive
  part is a React Aria Component with a keyboard path and an accessible name —
  the reorderable list (RAC `GridList` + `useDragAndDrop`, keyboard
  pick-up/move/drop), the drag handle, the remove button, the key and note
  fields, the Add-to-setlist `Modal` and its list + "New setlist…", the
  New-setlist dialog, the repoint search and result list. Status is a **word**
  (`missing`, `unsaved changes`, `in {key}`), never colour alone. Overlays
  portal into `.est`.
- **No book without an account** is not engaged here — a setlist is a file in
  a book the device already holds; all named tests operate on **local** books
  (the example book and a new local book), so no session/membership is a
  driver. Cross-book copy is between two books on the same device's shelf.
- **No song text in logs; fixtures are purpose-written** songs and setlists,
  never anyone's copyrighted words.

## Acceptance criteria

### Behavior delivered

1. **The Setlists destination** lists the setlists in the loaded books (title,
   book, song count), opening one; it replaces the `AppShell` placeholder.
2. **Open a setlist** (read view): title, meta, the songs in order each with
   its number, name, folder, a `in {key}` badge when it carries a `key`, and
   its `note`; an item whose folder-relative link resolves to a path absent
   from the book is marked **missing** with the `… is missing … skipped when
   playing` notice and a **Point it at a song** action; a **Play** control
   (the `onPlay` seam).
3. **Edit**: reorder by dragging and by keyboard (RAC `GridList` +
   `useDragAndDrop` → `moveItem`), edit each item's target **key**
   (`setProperty`/`removeProperty`, a key validated/formatted per §10.7) and
   free-text **note** (`setProperty`), **remove** an item (`removeItem`, an
   accessible remove button), **add a song** from the in-book search
   (`addSong`), and **point a missing item** at a song found by the in-book
   search (`pointItemAtSong`) — each an unsaved canonical `WRITE`, committed by
   **Save** / reverted by **Discard**.
4. **Add to setlist** from a song (reading view `onAddToSetlist`, and new on
   search rows): the dialog lists setlists in the user's savable books and a
   **New setlist…** row; choosing one in the song's own book adds it; choosing
   one (or a new setlist) in a different book shows the *"will be copied into
   {book} first"* notice and **Copy and add**; confirming leaves unsaved
   changes to the target book, saved like any other. A new setlist is created
   in the song's own book when savable, else in the home book ("My songs").
5. **Links kept when songs move** is already delivered by the inherited
   relink-on-move (`setlist-links.js` via `MOVE_FILE`, file_view) — the setlist
   this task opens/edits shows the rewritten links; a *deleted* song surfaces
   as a missing item here.

### Tests, by level

- **unit — `app/src/books/setlist-display.test.js`** (this task's new pure
  module `setlist-display.js`): resolving a folder-relative `item.path` to a
  book-root path (joining the setlist's directory, collapsing `..`; pins
  memory *setlist-item-path-is-folder-relative* and spec §10.5);
  **missing-item detection** against a book file set (resolved path present →
  linked, absent → missing); display-row derivation (number, title from
  `item.text`, folder, key badge from the `key` property, note from the `note`
  property); and the new-setlist filename slug from a title. Plus the
  **inherited `app/src/worker/setlist-links.test.js`** (`relinkSetlists`),
  which the gate runs and which pins "keeping links when songs move"
  (workflow 12 §Songs moved L80-81) — see Decision 2.
- **behavior (React) — `app/src/books/SetlistView.behavior.test.jsx`**: open
  (songs in order, `in {key}` badges, notes, a missing item with its notice +
  Point-it action; axe clean); the editor — reorder **by keyboard** (RAC DnD
  Enter/arrows → order changes), key and note edited, an item removed, a song
  added, a missing item pointed at a song via the in-book search
  (`pointItemAtSong`), the `unsaved changes` word appearing then Save
  clearing it; the Add-to-setlist dialog — same-book **Add**, cross-book
  **Copy and add** with its notice, **New setlist…**; axe on every state and
  overlay. Pins workflow 12 §Building one, §Songs from another book, §Songs
  moved L83-85, the W12 board copy.
- **behavior (Worker) — `app/src/worker/setlist.behavior.test.js`** (file-ops
  rig): `LIST_SETLISTS` returns the setlists across the loaded books with
  title + count; `ADD_TO_SETLIST` into a setlist in the song's own book adds a
  canonical item **unsaved**; into a setlist in *another* book **copies the
  song file** into the target book and adds the item, both unsaved; with a
  `newTitle` it creates the `*.setlist.md`; a following `SAVE` commits the copy
  and the setlist change as **one commit** (cross-checked with isomorphic-git
  on the shared fs). Pins workflow 12 §Songs from another book L38-40 and the
  one-lock/one-commit rule.
- **e2e-web — `e2e/web/tests/setlists.spec.js`** (phone, tablet, computer; axe
  on each screen/overlay): build a setlist from a song (**New setlist…** →
  add), add a second song, **reorder by drag** and, on the computer,
  **reorder by keyboard**; edit an item's key and note and save;
  **copy from another book** — from a song in a second local book, Add to
  setlist into the first book's setlist, **Copy and add**, saved; open a
  setlist, delete its referenced song in the file view to make a **missing**
  item, open the setlist and **point it at a song**. Update
  `navigation.spec.js`'s stale assertion that the Setlists tab shows an empty
  `<h1>`. Pins workflow 12 §Building one, §Songs from another book, §Songs
  moved L83-85, DIRECTION §3.7 L430 (keyboard reorder).

### Deferred work (closer registers in the WBS)

- **`books.setlist_search`** — ~1d, app (`app/src/worker/search-index.js` +
  `app/src/songs/SearchScreen.jsx`), Worker + view. Index setlist titles and
  surface setlists in the one song search "marked as setlists" (workflow 12
  §The file L33-34), reconciled on save/sync like song index entries.
  Governing: workflow 12 §The file; DIRECTION §4. Tests: behavior (a setlist
  found by search, marked as a setlist, opens; axe); e2e-web (search surfaces a
  setlist and opens it). Milestone: the same milestone as `books.setlists`
  (M5). *This task delivers setlist discovery through the drawn **Setlists
  destination** (the board's primary entry); setlist-in-song-search is the
  additional discovery path the workflow also names.*

## Decisions

1. **Play-through is `books.play`; this task renders Play as a seam.** The
   setlist surface this task owns draws a Play control (W12 phone + computer
   boards), but the full-screen player, Wake Lock, swipe/edge/pedal
   navigation, next-title, sync-waiting and the read-time *application* of a
   per-item key as a transposition are `books.play` (which `depends
   !setlists`). *Chosen* over building play here because the `.tji` splits them
   and `books.play` carries their tests; the symmetric `onPlay` prop (mirroring
   reading's `onAddToSetlist`) is the clean seam. *Rejected*: rendering Play
   disabled (it would ship dead UI the next task must rework).
2. **The named unit "keeping links when songs move" is the inherited
   `setlist-links.test.js`; this task's own unit is `setlist-display.test.js`.**
   The relink-on-move mechanism (`relinkSetlists` + its unit test) **landed
   early with `books.file_view`**, which needed it for rename/move. It exists
   and runs in the gate, so it legitimately pins the note's named unit
   (`app/src/worker/setlist-links.test.js`). This task does not re-implement
   it; it adds `setlist-display.test.js` for the genuinely new pure logic it
   introduces (folder-relative path resolution, missing-item detection, display
   rows, new-setlist slug). No named level is dropped. *Rejected*: re-declaring
   a duplicate relink unit here (double-counting shipped code).
3. **Open and edit reuse `OPEN_SOURCE`/`BOOK_TREE`/`WRITE`/`SAVE`/`DISCARD`
   with the pure cifra-md ops in the view; only `LIST_SETLISTS` and
   `ADD_TO_SETLIST` are new Worker commands.** Reorder/key/note/remove/point
   are pure model→model transforms the view applies, then `writeSetlist` +
   `WRITE`; the setlist is an ordinary working-copy file the existing save
   pipeline already canonicalises and commits. A Worker command is added only
   where I/O or cross-file atomicity is unavoidable: listing setlists across
   books, and the copy-into-the-book / create-if-new / add-the-item that must
   be one locked, unsaved change. *Chosen* for minimal new surface and the
   reading.md "view composes the model" precedent. *Rejected*: an
   `OPEN_SETLIST`/`SAVE_SETLIST` pair or a Worker-prepared setlist model
   (duplicates the save pipeline and couples the Worker to a view model).
4. **Reorder is RAC `GridList` + `useDragAndDrop` — the app's first
   reorderable list — giving both drag and the keyboard alternative.** RAC's
   drag-and-drop hooks provide keyboard reorder (pick up, move, drop, cancel)
   for free, satisfying DIRECTION §3.7 L430; an explicit drag-handle button
   (`aria-label="Drag to reorder"`, per the board) is the pointer affordance.
   Keyboard reorder is pinned at behavior (jsdom can drive keys); pointer drag
   is pinned at e2e (Playwright). *Rejected*: a bespoke up/down-button reorder
   (not what the board draws; still needs the DnD list for pointer drag).
5. **Remove is an accessible button; touch swipe-to-remove is a progressive
   enhancement on the same action, not a separate deliverable.** The board's
   computer editor draws a remove button (`aria-label="Remove from setlist"`);
   that is the keyboard-and-AT path and the tested affordance. Workflow 12's
   "removed by swiping" (L60) is layered as an optional touch gesture over the
   identical `removeItem` action — no separate behavior/test surface, so it is
   not deferred functionality. *Rejected*: making swipe the only remove path
   (fails the keyboard/AT requirement).
6. **The raw `*.setlist.md` side pane (wide) is a read-only preview.** The
   computer board shows the file beside the structured editor; editing raw
   Markdown is `books.file_view`'s raw editor. Rendering it read-only here is
   cheap and matches the board without duplicating the raw-edit surface.
   *Rejected*: an editable raw pane (overlaps file_view, doubles the save
   paths).
7. **A new setlist is created in the song's own book when savable, else in the
   home book ("My songs").** This honours workflow 12 §Songs from another book
   L41-42 (a personal multi-book setlist lives in *My songs* with copies) while
   keeping the common case — a new setlist in the book you are adding from — a
   single step. The cross-book copy path applies uniformly.
8. **Setlist discovery is the drawn Setlists destination now;
   setlist-in-song-search is deferred (`books.setlist_search`).** The board
   centres a Setlists tab/destination as the primary entry, and the task's
   scope list names "open", not search integration; indexing setlist titles
   into the one song search (workflow 12 §The file L33-34) is a bounded
   follow-up that touches `search-index.js` + `SearchScreen.jsx`. *Rejected*:
   expanding this 4d task to also index and mark setlists in song search.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-13.

- Worker: `app/src/worker/protocol.js` (LIST_SETLISTS, ADD_TO_SETLIST CommandKind/EventKind members), `app/src/worker/logic.js` (switch arms for both commands), `app/src/worker/working-copy.js` (one-lock `addToSetlist`, new-setlist create, cross-book copy), `app/src/worker/reducer.js` (`setlists` slice).
- Shell / routing: `app/src/App.jsx` (`#dev/setlists` hash mount, `SetlistsDev`), `app/src/shell/AppShell.jsx` (Setlists destination, `openSetlist` ephemeral surface, `onAddToSetlist` wired to reading and search, `onPlay` seam).
- New components: `app/src/books/SetlistsScreen.jsx`, `app/src/books/SetlistView.jsx`, `app/src/books/SetlistsDev.jsx`, `app/src/books/AddToSetlist.jsx`, `app/src/books/use-load-song.js`, `app/src/books/setlist-display.js`, `app/src/books/setlist.css`.
- Search affordance: `app/src/songs/SearchScreen.jsx` (per-row Add-to-setlist button), `app/src/songs/search.css`.
- i18n: `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` (new `setlists` copy section).
- Bug fixes (fixer): `app/src/editor/SongEditor.jsx` (suppress initial-load self-WRITE for existing files, fixing resurrection of deleted songs); `app/src/worker/save-preview.js` (tolerate deleted working-copy file, diff HEAD→empty instead of ENOENT); `app/src/books/setlist.css` (editor row wraps on narrow viewports).
- Tests — unit: `app/src/books/setlist-display.test.js` (13 tests), `app/src/worker/setlist-links.test.js` (4 tests, inherited); behavior: `app/src/books/SetlistView.behavior.test.jsx` (12 tests), `app/src/worker/setlist.behavior.test.js` (4 tests); e2e-web: `e2e/web/tests/setlists.spec.js` (5 journeys × 3 viewports, keyboard-reorder on computer only), `e2e/web/tests/navigation.spec.js` (stale Setlists-tab assertion updated).
- Tech-debt registered: `books.setlist_search` (~1d) in `tasks/65-books.tji`, wired to M5.
