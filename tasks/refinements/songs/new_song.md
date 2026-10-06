# songs.new_song — Writing a new song

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task new_song "Writing a new song"`
under `task songs` (lines 34–39). Dependencies as declared: `depends !editor,
!search` (the sibling `songs.editor` and `songs.search`), plus the parent
`task songs` cascade `depends shell.layout, shell.chart, foundation.e2e_web`.
The one-line note:

> "From search, the empty shelf, a book, the file view; which book; named once
> at the first save; My songs created when first written to. Workflow 3. Tests:
> behavior (which book, the name at first save, My songs created; axe); e2e-web
> (write a new song from search, the empty shelf, a book and the file view,
> offline; axe)."

This is the flow that takes a person "from nothing to a song saved in a book"
(workflow 3 L5–6). It is the **first real in-app host** of the CodeMirror
editor `songs.editor` built behind `#dev/editor` (editor.md Decision 6,
editor.md:540–550) — the task that wires the editor's deferred "new-song entry
+ book selection + first-save naming" (editor.md:131–137, 459–466).

## Effort estimate

**2d** (as scoped in the `.tji`), allocated `team`. Roughly: ~0.75d for the
view (the entry affordances in `SearchScreen`/`FirstRun`, the which-book bar
above the editor, the editor host in the shell — three viewports, React Aria,
i18n, axe), ~0.75d for the Worker seam this task is the first to need (ensure
*My songs* under its reserved id, allocate a placeholder path, the first-save
naming — rename + commit + push), ~0.5d for the e2e journey across the three
available ways in, offline.

## Repository

**estante-de-cifras** only, `app/` and `e2e/`:

- `app/src/songs/` — a pure filename helper (`song-filename.js`) and the
  new-song host wiring; small additions to `SearchScreen.jsx`/`FirstRun.jsx`
  for the ways in, with co-located tests.
- `app/src/shell/AppShell.jsx` — an ephemeral "editing a song" view state and
  the editor host region, plus threading the new-song callbacks through
  `destinationPanels` (the way `onAddBook`/`onNavigate` are already threaded,
  `AppShell.jsx:123–132`).
- `app/src/worker/` — the write path this task is the first to exercise: a
  `NEW_SONG` command (ensure the target book — *My songs* lazily under its
  reserved id — and allocate a placeholder path) and a `NAME_AND_SAVE` command
  (the one-time first-save naming: rename the placeholder to the title's slug,
  then commit and push). These extend `protocol.js` / `logic.js` /
  `working-copy.js` the way every prior consumer did (`storage.working_copy`,
  `storage.index`, `songs.search`, `books.shelf` each added their own kinds).
  It reuses the existing `shelf` slice, `SHELF` event and `source` slice — it
  adds no new read slice.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — new copy for the ways in and
  the which-book bar (catalogue completeness is a hard build gate, `shell.i18n`).
- `e2e/web/tests/new-song.spec.js` — the Playwright journey.

**Not a `cifra.md:` task.** It consumes the format's JavaScript library
(`cifra-md`) only through the editor (`parse`, the template) and the canonical
save path (`canonicaliseFile`); it changes nothing in the spec, reference or
corpus, and the app and the service share no code (DIRECTION §3.6 L288–291). A
new song is a file in a git repository entirely on the device; the service is
untouched (a book is only ever seen by the service when it is *put online*,
`books.online`). Plain JS/JSX; no TypeScript; contracts are JSDoc `@typedef`s.

**No design delta is authored.** Workflow 3 and the W03 board already decide the
screen; the default book, the "can change until the first save" rule and the
title→filename rule are normative (workflow 3 §Which book/§Its file name,
DIRECTION §4 L446–448); `shelf.json`'s shape is fixed by `home-book-format.md`
§4.2; the protocol is open to new command/event kinds (DIRECTION §3.7
L410–414). The one documentation inconsistency this task surfaces (workflow 3
L102's stale "whether a save also pushes is still open") is settled against it
by DIRECTION §3 L111–113 and is a save-behavior nit owned by workflow 4 /
`songs.save_sheet`, not edited here (see Decisions 6 and Open questions).

## Inherited dependencies

All **settled** — every declared and reused dependency is `complete 100`:

- **`songs.editor`** — *settled, Done 2026-10-06*
  ([`editor.md`](editor.md)). The component this task mounts and the seams it
  wires:
  - `SongEditor` (`app/src/editor/SongEditor.jsx`, default export, props
    `{ store, bookId, path, isNew, onSave, layoutMode, editorRef }`,
    `:66–74`). **`isNew` drives template-vs-working-copy**: when `isNew` the
    initial document is `template(preferences)` (`:96–99`, `:221–232`);
    otherwise it reads the working copy via `OPEN_SOURCE`/the `source` slice
    (`:95`, `:235–238`). This task passes `isNew` with a real `bookId`/`path`.
  - Durability is a **debounced `WRITE`** that fires **only when
    `bookId && path` are set** (`SongEditor.jsx:112–124`, `:113`, guard also at
    unmount `:204`). So the new-song host must assign a concrete `bookId` and
    `path` *before* the editor mounts, or no keystroke persists (Decision 2).
  - The Save button calls `onSave?.()` after the pre-save voicing/marker gate
    (`SAVE_BLOCKERS = { 'bad-voicing', 'marker-line' }`, `:48`, `:268`). The
    editor owns the gate and the affordance; the host owns what Save *does*
    (editor Decision 10, editor.md:572–580) — this task's first-save naming.
  - `template(preferences, { title })` (`app/src/editor/template.js:34`;
    `templateDialect` `:20`) already accepts an optional `title` (left empty
    when absent) and writes `- notation:` from `preferences.notation?.value ??
    DEFAULT_DIALECT` (editor Decision 9). This task passes the search query as
    the title (workflow 3 §Ways in L10–11); it does **not** re-create the
    template, paste or voicing-stop logic.
  - Hosts switch songs by remounting via React `key` (editor.md note; EditorDev
    uses `key={`${bookId}:${path}`}`).
- **`songs.search`** — *settled, Done 2026-10-05* ([`search.md`](search.md)).
  Where two ways in originate, and the mechanism that surfaces a new unsaved
  song:
  - `SearchScreen` (`app/src/songs/SearchScreen.jsx`) already carries the
    callback seams `onOpenSong`, **`onWriteSong`** (`:260`), `onAddBook`
    (`:261`), `onExploreChord`; `onWriteSong` is passed to `<FirstRun>`
    (`:433`). This task extends `onWriteSong`'s payload (an optional `title`
    and `bookId`/`folder`) and adds the two missing affordances: the **Create
    "{query}"** row in the no-match state (today only a `search.empty`
    `role="status"` line, `:421–422`) and **new song in this book** in
    `BookSection` (`:193`).
  - A `SEARCH_RESULTS` result carries an **`unsaved`** flag wired end-to-end
    from the index's `index_locations` (search Decision 7; search.md:316–320),
    and **re-indexing runs inline on `WRITE`** (index.md Decision 5/6) — so a
    brand-new song written to the working copy **appears in search with an
    *unsaved* badge before any save** (workflow 3 L20–23). This task relies on
    that: it creates the file via `WRITE`, nothing more, for it to be findable.
- **`storage.working_copy`** — *settled, Done 2026-10-05*
  ([`../storage/working_copy.md`](../storage/working_copy.md)), via the editor.
  `createWorkingCopy({ fs, git, locks }) → { write, save, discard }`
  (`app/src/worker/working-copy.js:53`):
  - `write({ bookId, path, text })` (`:80`) — `mkdirp` + `fs.writeFile` +
    `fs.flush()` under the book lock, no commit. **This is the create-file
    path**: a `WRITE` to a never-committed path creates it (and its folders).
  - `save({ bookId, paths, message, author })` (`:99`) — canonicalise each path
    (`canonicaliseFile`, `app/src/worker/canonicalise.js`), write back,
    `git.add`/`git.remove`, one `commit`, best-effort `push`; returns
    `{ commit, pushed }` or `{ refused }`; offline → `pushed: false`, commit
    kept. The first-save naming reuses this after the rename (Decision 4).
  - `discard({ bookId, paths })` (`:171`) — a never-saved new file (no HEAD
    blob) is **deleted**; this is exactly workflow 3 §Abandoning it L50–55 and
    the "moving the draft costs nothing" of §Which book (Decision 3).
  - Author before sign-in is the device local id `LOCAL_IDENTITY =
    { id: 'local', name: 'Me' }` (`SearchScreen`/`BooksScreen`; `authorFrom` in
    `app/src/worker/author.js`), the account id after.
- **`books.shelf`** — *settled, Done 2026-10-06* ([`../books/shelf.md`](../books/shelf.md)).
  The local-book-creation and local-home-book-provisioning seam this task
  reuses to make *My songs*:
  - `createBooks({ fs, git, locks }) → createLocal({ title, author, now })`
    (`app/src/worker/books.js`), `git.init` (added to
    `app/src/worker/git.js`), and `createHomeBook(...).ensureLocal({ author })`
    (`app/src/worker/home-book.js:346`) — provision a **local** home book (init
    + §2.2 scaffold, no remote) idempotently so a write works **with no
    account**. `home-book.set({ bookId, file: 'shelf.json', changes, author })`
    (`home-book.js:213`) writes a `shelf.local.<deviceId>.<id>.{ title,
    position }` entry; `nextShelfPosition(model, deviceId)` (`logic.js:218–230`)
    computes `position`. The `CREATE_BOOK` handler (`logic.js:749–784`) is the
    reference flow; `OPEN_EXAMPLE_BOOK` (`logic.js:785–831`) is the reference
    **idempotent create under a reserved id** this task mirrors for *My songs*.
  - **`books.shelf` is not in this task's declared `depends`** — a graph gap
    surfaced for the closer (see Acceptance → graph notes). It is `complete
    100` (M2), so nothing is blocked.
- **`account.first_run`** — *settled, Done 2026-10-05*, commit 98ff7ae
  ([`../account/first_run.md`](../account/first_run.md)). It established the
  **reserved *My songs* identity this task implements**:
  `MY_SONGS = { id: 'local-my-songs', labelKey: 'firstRun.mySongs', metaKey:
  'firstRun.mySongsMeta' }` (`app/src/songs/first-run.js:55–59`), whose comment
  (`:48–54`) names it "the reserved identity songs.new_song will create the
  repository under … created when the first song is written into it." It also
  built the empty-shelf **`onWriteSong`** entry (`FirstRun.jsx:120`, `:137–139`;
  "Write a song" / "It goes into My songs", `firstRun.writeSong` /
  `firstRun.writeSongMeta`) and the `OPEN_EXAMPLE_BOOK` e2e-seeding seam
  (`e2e/web/tests/first-run.spec.js`, `editor.spec.js`). **Not in this task's
  declared `depends`** — the same graph gap (it is `complete 100`, M2).
- **`storage.index`** — *settled, Done 2026-10-05*
  ([`../storage/index.md`](../storage/index.md)), via search. Re-indexes inline
  on `WRITE`, so the new unsaved song is findable at once.
- **`storage.home_book` / `storage.shelf_surface`** — *settled, Done*
  (transitive through `books.shelf`). The `shelf` slice (`reducer.js:32–40`,
  fold `:308–316`) and `surfaceHomeBookShelf()` (`logic.js:439–446`) the
  which-book control reads and the create re-emits.
- **`shell.layout`** — *settled, Done* ([`../shell/layout.md`](../shell/layout.md)).
  Two layout modes split at `(min-width: 600px)`; **no router**; navigation and
  "which song is open" are ephemeral `useState` (Decision 5). The editor host
  uses the detail region on `wide` and a full screen on `narrow`, keying off
  `useLayoutMode()` as the editor's preview split already does.
- **`shell.chart`** — *settled, Done* (parent cascade). Used indirectly: the
  editor's preview is the reading `Chart`. Not directly touched here.
- **`foundation.e2e_web`** — *settled, Done*
  ([`../foundation/e2e_web.md`](../foundation/e2e_web.md)). The Playwright
  harness at `e2e/web/` (phone/tablet/computer projects; `lib/axe.js`,
  `lib/offline.js`). The new-song journey lands here.

**No pending blocking dependencies.** The one way in with no host yet — the
**file view** ("new song in the folder being looked at", workflow 3 L14,
workflow 14) — is `books.file_view`'s (an existing M2 leaf, not yet built); it
reuses this task's new-song flow and tests that entry (Decision 7, graph note).

## What this task is

The "write a new song" flow — from any of its ways in, through the editor, to a
song saved and named in a book:

1. **The ways in.** A new song can be started **from search** (the *Create
   "{query}"* row when nothing matched, the query becoming the title), **from
   the empty shelf** (*Write a song* → *My songs*), **from a book's section**
   on the search screen (*new song in this book*), and **from the file view**
   (in the folder being looked at — `books.file_view`'s to wire, Decision 7).
2. **Which book.** The book it was started from, if any; otherwise **My
   songs**. A book the user cannot push to is never the default and is not
   offered. The book is shown above the editor and can be changed **until the
   first save** — until then the file is only in the working copy, so moving it
   costs nothing.
3. **The song before its first save.** A new song is a new file in its book's
   working copy, **safe from the first keystroke**, with a placeholder name
   (`untitled.cifra.md`, `untitled-2.cifra.md`, …) that only the file view
   shows. It appears in search with an *unsaved* badge like any other unsaved
   work. **My songs is created when first written to** — its repository and its
   shelf entry are minted, under the reserved `local-my-songs` id, at the
   moment the first new song is started into it.
4. **Named at the first save.** The file is **named once, at the first save**,
   from the title as it is then — the title folded to an ASCII slug
   (*Coração Vagabundo* → `coracao-vagabundo.cifra.md`), a taken name gaining
   `-2`, `-3` — committed as *Add {title}* and pushed (when the book is online
   and there is a network; queued otherwise). The app never renames it
   afterwards; editing the title later edits the heading, not the file
   (DIRECTION §4 L446–448).

The editor itself, the template, the paste-into-a-fence and the voicing-stop
are `songs.editor`'s (reused unchanged). The **save sheet** — the musical
what-changed summary, the prefilled note, discard-showing-what-would-be-lost,
save-all — is `songs.save_sheet`'s (workflow 4); this task delivers the
first-save *mechanism* (the slug derivation and the rename-and-commit) that its
sheet later presents (Decision 6).

## Why it needs to be done

Without it, a person can find and read songs but cannot create one: the editor
`songs.editor` exists only behind `#dev/editor`, and the reserved *My songs*
identity, the `onWriteSong` seam and the *Create "{query}"* affordance are
present but inert. It is a leaf of milestone **M2 (`milestones.m2_local`)** —
"a songbook on one device: find, read, write, edit… installed and offline"
(`tasks/99-milestones.tji:23–25`) — and the first in-app host of the editor, on
which `songs.save_sheet` (the sheet over its first save) and `books.file_view`
(the folder way in) build.

## Inputs / context

### Governing design

- **Workflow 3 — Write a new song** (`docs/workflows/03-write-a-new-song.md`,
  Status: decided):
  - **§Ways in** (L9–17): *From search* "with the query as its title" (L10–11);
    *From the empty shelf* "*write a song*" (L12); *From a book's section* "*new
    song in this book*" (L13); *From the file view*, "in the folder being looked
    at (workflow 14)" (L14); *By pasting* (L15–17, the editor's, editor.md).
  - **§The song before its first save** (L20–23): "A new song is a new file in
    the working copy of its book. It is safe from the first keystroke, and it
    appears in search with an *unsaved* badge like any other unsaved work."
  - **§Which book** (L26–33): "The book it was started from, if any; otherwise
    *My songs*. A book the user cannot push to is never the default, and is not
    offered." "The book is shown above the editor and can be changed until the
    first save… moving it costs nothing. A song started from the file view goes
    in the folder being looked at; any other new song goes at the root of its
    book."
  - **§Its file name** (L35–48): "named at the **first save**, from the title as
    it is then, and never renamed by the app afterwards (DIRECTION §4). Until
    then it has a placeholder name, `untitled.cifra.md` (`untitled-2.cifra.md`
    and so on), which only the file view shows." "The name is the title folded
    to ASCII: accents dropped, lower case, runs of anything else turned into one
    hyphen. *Coração Vagabundo* becomes `coracao-vagabundo.cifra.md`… A name
    taken in the same folder gains `-2`, `-3`." (ASCII because accented file
    names are where tools disagree.)
  - **§Abandoning it** (L50–55): "*Discard* deletes the file — after asking, if
    it holds more than a title. A new song left unsaved stays in the working
    copy, findable by its badge."
  - **§The notation property** (L82–85) and **§The editor** (L57–79) — the
    editor's, reused (editor.md).
  - **§The first save** (L98–102): "*Save* names the file, commits it with the
    message *Add Garota de Ipanema*, and from then on the song is an ordinary
    one: editing it is workflow 4." (L102's "Whether a save also pushes is still
    open (DIRECTION §6)" is stale — Decision 6.)
- **DIRECTION §4 — The interface** (`docs/DIRECTION.md` L436–458): "**Search
  never shows or changes a file name. A song created from search is named once,
  from its title, and renaming it afterwards edits its heading, not its file.**"
  (L446–448) — the normative file-name rule, echoed verbatim in the W03 save
  dialog caption. "Renaming, moving and deleting files happen only [in the file
  view]." (L449–453) — so the first-save *naming* (a one-time act, not a rename)
  is this flow's, distinct from the file view's user renames.
- **DIRECTION §3 — Explicit save** (L111–113): "Saving is a commit, and then a
  push (workflow 4). Persisting and versioning are separate…" — settles that the
  first save pushes (Decision 6).
- **DIRECTION §3.2 — Personal state** (L136–151): the shelf list and a book's
  label live in the **home book**, committed automatically; `shelf.json`'s
  `local` namespace holds device-local books like *My songs*.
- **DIRECTION §3.7 — The app** (L394–427): "One owner for the data: a Web
  Worker… The main thread never touches IndexedDB" (L407–409); React + React
  Aria; "only what shows it moves" (L410–414).

### The mockup (what the drawings decide)

- **`docs/mockups/W03-write-a-new-song.dc.html`** — the new-song board. Real
  copy and anatomy:
  - **Subtitle**: "A new song is a file in its book's working copy, safe from
    the first keystroke… The file is named once, from the title, at the first
    save."
  - **From search, no match** (phone): empty-state heading "No songs match"; a
    **Create "Garota de Ipanema"** primary row with meta "A new song in My
    songs" — establishing the default target and the query-as-title; below it
    "Or paste a whole song…".
  - **The which-book control**, drawn three ways and defaulting to **My
    songs**: phone "In **My songs**" + "Change book"; tablet "In **My songs** ·
    can change until the first save" + "Change book"; computer a "Book" chip
    "My songs ▾" + caption "Can change until the first save".
  - **The template** (phone): `# Garota de Ipanema` / `- artist:` /
    `- notation: brazilian` / blank / `## Intro` / an empty fence with the
    cursor inside; caption "The notation comes from your preference, so the song
    reads the same to everyone." `unsaved` badge in the appbar; Text/Preview
    toggle; "Add section" + "Save".
  - **The first-save dialog** (computer): title **Save "Coração de Estrada"**;
    a **Book** field ("My songs ▾"); a **File name** field (read-only, mono)
    `coracao-de-estrada.cifra.md`; caption "**Named once, from the title.
    Changing the title later edits its heading, not the file.**"; a **Note**
    field defaulting to "Add Coração de Estrada"; actions "Keep editing" /
    "Save". *This dialog is `songs.save_sheet`'s to render (Decision 6); this
    task provides the slug and the naming it presents.*
- **`docs/mockups/README.md` L26** — "Every status badge carries a word, never
  colour alone." Binds the *unsaved* badge and the which-book words.

### The code seams this extends

- **The ways in:** `SearchScreen.jsx` (`onWriteSong` `:260`, `onAddBook`
  `:261`, the no-match `search.empty` block `:408–425`, `BookSection` `:193`),
  `FirstRun.jsx` (`onWriteSong` `:120`, `:137–139`), `first-run.js`
  (`MY_SONGS` `:55–59`, its reservation comment `:48–54`).
- **The editor host:** `AppShell.jsx:123–132` (`destinationPanels(store,
  onNavigate)`, the callback-prop cross-navigation pattern); the shell's
  `wide`/`narrow` regions (`layout-mode.js`).
- **Store ↔ Worker:** `createStore` → `store.send`/`store.slice`
  (`app/src/worker/store.js`), `useSlice(store, name)`
  (`app/src/worker/useStore.js:14`), `command`/`CommandKind`/`event`/`EventKind`
  (`app/src/worker/protocol.js`). New kinds are added to `protocol.js` /
  `logic.js` / (where a slice is needed) `reducer.js`, as every prior consumer
  did.
- **The Worker dispatch:** `createWorkerLogic(port, options).handle` switch
  (`logic.js:555–882`); `CREATE_BOOK` (`:749–784`), `OPEN_EXAMPLE_BOOK`
  (`:785–831`, the reserved-id idempotent create), `WRITE` (`:559`), `SAVE`
  (`:577`), `OPEN_SOURCE` (`:863`); `nextShelfPosition` (`:218–230`),
  `surfaceHomeBookShelf` (`:439–446`). The home book / books / working copy
  modules composed in the closure (`ensureWorkingCopy`, `ensureBooks`,
  `ensureHomeBook`/`ensureLocal`).
- **Accent folding prior art:** `app/src/worker/fold.js` (search's
  accent-insensitive fold) — the slug's ASCII fold is the same idea (NFD +
  strip combining marks) but a distinct transform (hyphenation + `.cifra.md` +
  collision suffix), so `song-filename.js` is its own small pure module
  (Decision 1). No slug helper exists today (grep: none).
- **Accessibility / test support:** `checkWcag21aa(container)`
  (`app/src/a11y/axe.js`); `createLoopbackEndpoint` (`app/src/test/loopback.js`),
  `installWebLocks` (`app/src/test/web-locks.js`), `fake-indexeddb`,
  `createFileSystem` (`app/src/worker/fs.js`), `startGitHttpRemote`
  (`app/src/test/git-http-remote.js`) — the in-process Worker rig, as
  `working-copy.behavior.test.js` / `books.behavior.test.js` use; the git CLI
  asserts committed state against `/books/<id>`.

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data.** The host
  reads the `shelf`/`source` slices through `useSlice` and drives the flow
  through `store.send(command(…))`; it never touches IndexedDB, git or the book
  lock (DIRECTION §3.7 L407–414). The ensure-*My songs*, the placeholder
  allocation, the rename and the canonical commit are framework-free Worker
  code. *Central.*
- **Offline first; no account needed.** Starting a new song, every keystroke,
  and the first save all run on the device and never wait on a network: *My
  songs* is a **local** repository (no remote) provisioned with no account
  (reusing `home-book.ensureLocal` / `books.createLocal`); `WRITE` persists
  locally; the first save commits locally and, for a local book, does not push
  at all (for an online book, pushes when there is a network and queues
  otherwise — `working-copy.save`'s `pushed: false`). *Central — pinned by the
  offline e2e and the Worker behavior test.*
- **Canonical form over preserving content.** The first save canonicalises
  through `canonicaliseFile` (the cifra.md writer is the single authority); the
  editor's pre-save gate already blocks a `bad-voicing` or a marker line from
  reaching Save (editor.md Decision 3), and a marked text is never saved (spec
  §8.1). This task writes no bytes of its own into a song and re-implements no
  canonicality. The scaffolded *My songs* `README.md`/`.gitattributes` are the
  §2.1 identity bytes `books.createLocal` already writes. *Applies.*
- **Accessibility (every UI task).** Every interactive part is a React Aria
  Component — the *Create "{query}"* and *new song in this book* rows, the
  which-book control (a `Select`/`Button` + its menu or dialog) and its "Change
  book" trigger, the editor host's controls (the editor's own are editor.md's)
  — with full keyboard paths and axe at WCAG 2.1 AA on every state. The
  **which-book label and the *unsaved* badge are carried by a word**, never
  colour alone (mockups README L26). Focus moves to the editor when a new song
  opens, and back to a sensible place on save/discard. *Central.*
- **No song text in logs.** The Worker logs nothing (`logic.js:9–11`); the
  first-save commit message *Add {title}* is git history (intended, drawn in
  W03), not a log. Fixtures are purpose-written songs, never anyone's
  copyrighted words. *Applies.*
- **No book without an account.** *My songs* and any new-song book in M2 are
  **local** — they live only on the device and reach no one, so sharing and
  membership do not apply; the whole app carries `noindex`. The "a book the
  user cannot push to is not offered" rule is enforced by `canSaveFor`
  (`book-display.js:57`): local books always savable, shared books only with
  the editor role. *Applies.*
- **One lock per logical operation** (locks.md Decision 1). Ensuring *My
  songs* (its repo init/scaffold under `withLock(bookId)`, the shelf write
  under `withLock(HOME_BOOK_ID)`) and the first save (rename + commit + push
  under `withLock(bookId)`) each use one lock per repository, never nested
  (Web Locks are non-reentrant). *Applies.*
- **Component boundaries (DIRECTION §3.6).** No code shared with the service; a
  new song is created entirely on the device. The music core (`cifra-md`) stays
  framework-free below the view. *Applies.*

## Acceptance criteria

### Behavior delivered

1. **The ways in.** `SearchScreen` renders a **Create "{query}"** primary row in
   the no-match state (meta "A new song in My songs") that invokes
   `onWriteSong({ title: query })`; `BookSection` renders a **new song in this
   book** affordance that invokes `onWriteSong({ bookId })`; `FirstRun`'s
   existing **Write a song** invokes `onWriteSong()` (→ *My songs*). The file
   view's way in is `books.file_view`'s (Decision 7). *Pins workflow 3 §Ways in
   L9–14; W03 Create row.*
2. **Opening the editor on a new song.** When `onWriteSong(opts)` fires, the
   host sends `NEW_SONG { targetBookId?, folder?, author }`, and on
   `NEW_SONG_READY { bookId, path }` mounts `SongEditor` with `isNew`, the
   returned `bookId`/`path`, and the layout mode — in the shell detail region on
   `wide` and full screen on `narrow`. The editor applies `template(preferences,
   { title })` (the query when started from search), whose first debounced
   `WRITE` persists it. *Pins workflow 3 §The song before its first save
   L20–23, §The editor; DIRECTION §3.7.*
3. **Which book — default, offered set, changeable until first save.** Above the
   editor a control shows **In {book}** (default: the started-from book, else
   *My songs*) with a **Change book** trigger listing only books the user **can
   push to** (`canSaveFor`); the home-book/shared books that cannot be pushed are
   not offered. Changing the book before the first save re-targets the draft
   (`NEW_SONG` for the new book, `WRITE` the current text, `DISCARD` the old
   placeholder — Decision 3); after the first save the control is gone. *Pins
   workflow 3 §Which book L26–33; W03 which-book control.*
4. **My songs created when first written to.** The first time a new song is
   started into *My songs* and it does not yet exist, the Worker provisions a
   **local** home book if absent (`ensureLocal`), `git.init`s and scaffolds
   `/books/local-my-songs` (the §2.1 `README.md` = *My songs* title /
   `.gitattributes`) with one commit, and writes
   `shelf.local.<deviceId>.local-my-songs.{ title, position }` through
   `home-book.set`, then re-surfaces `SHELF` — all **idempotent** under the
   reserved id, mirroring `OPEN_EXAMPLE_BOOK`. *My songs* then appears on the
   shelf and in search. **No account, no network.** *Pins workflow 3 §Which
   book L28, first-run.js:48–54; workflow 7 L25.*
5. **The placeholder, and findable unsaved.** The new file is created at
   `untitled.cifra.md` (or `folder/untitled.cifra.md`), a taken placeholder
   gaining `-2`, `-3`, allocated by `NEW_SONG` against the book's working copy.
   Written via `WRITE`, it is re-indexed inline and shows in search with an
   *unsaved* badge before any save; left unsaved it persists; *Discard* deletes
   it (`working-copy.discard`, no HEAD blob). *Pins workflow 3 §The song before
   its first save L20–23, §Abandoning it L50–55.*
6. **The name at the first save.** On the editor's clean `onSave`, the host
   sends `NAME_AND_SAVE { bookId, fromPath, author }`; the Worker parses the
   working-copy file for its title, derives `toPath` via
   `deriveSongFilename(title)` with a collision suffix against the book's folder,
   renames the placeholder to `toPath`, then canonicalises, commits *Add
   {title}* and pushes (local book: commits only; online book: pushes, or
   `pushed: false` offline), re-indexes, and emits `SAVED { bookId, path:
   toPath, commit, pushed }`. From then the song is ordinary; the app never
   renames it. *Pins workflow 3 §Its file name L35–48, §The first save L98–101;
   DIRECTION §4 L446–448, §3 L111–113.*
7. **`deriveSongFilename` — the slug.** A pure helper: NFD-fold and drop
   combining marks (accents), lower case, turn runs of anything non-alphanumeric
   into one hyphen, trim leading/trailing hyphens, append `.cifra.md`; an
   empty/placeholder title yields `untitled`; a name taken in the same folder
   gains `-2`, `-3`. Reused by `songs.save_sheet` to preview the name in its
   sheet (Decision 6). *Pins workflow 3 §Its file name L39–48.*

Wiring: `app/src/songs/song-filename.js` (pure `deriveSongFilename`); the
new-song host and callbacks in `app/src/shell/AppShell.jsx`; the **Create
"{query}"** row and **new song in this book** affordance in
`app/src/songs/SearchScreen.jsx`, the extended `onWriteSong` payload in
`SearchScreen.jsx`/`FirstRun.jsx`; the which-book bar component in
`app/src/songs/`; `CommandKind.NEW_SONG`/`NAME_AND_SAVE` and
`EventKind.NEW_SONG_READY` in `protocol.js`, their handlers (ensure reserved-id
book, placeholder allocation, rename-and-save) + the `surfaceHomeBookShelf`
re-emit in `logic.js`, a `nameNewSong`/rename helper in `working-copy.js`; new
copy in all four i18n catalogues. The `shelf`/`source` slices and the `SAVED`
event are reused unchanged.

### Tests the task lands with, by level

Per the `.tji` note: **behavior** and **e2e-web**; a **unit** level is added for
the pure `deriveSongFilename` helper (a genuine pure module — the testing policy
permits adding a level a task needs), and a Worker **behavior** test for the
`NEW_SONG`/`NAME_AND_SAVE` seam (the mechanism the view behavior test cannot
reach). Fixtures are purpose-written songs, never anyone's copyrighted words.

- **unit — `app/src/songs/song-filename.test.js`** (added level):
  `deriveSongFilename` folds accents and lower-cases (*Coração Vagabundo* →
  `coracao-vagabundo.cifra.md`), collapses non-alphanumeric runs to one hyphen
  and trims them, yields `untitled` for an empty/placeholder title, and appends
  `-2`/`-3` against a given set of existing names (and `untitled` →
  `untitled-2`). *Pins workflow 3 §Its file name L39–48; DIRECTION §4 L446–448.*
- **behavior — `app/src/songs/NewSong.behavior.test.jsx`** (real RAC and i18n; a
  loopback-backed store seeded with `shelf`/`source`/`preferences`; axe over
  `container`):
  - *Which book* — the which-book bar defaults to *My songs* (and to the
    started-from book when opened from a book section); the Change-book menu
    offers only push-capable books (a shared reader-role book and the home book
    are absent); keyboard-reachable. *Pins workflow 3 §Which book L26–33;
    `canSaveFor`.*
  - *The name at first save* — with a titled new song on a placeholder path,
    pressing the editor's Save sends `NAME_AND_SAVE { bookId, fromPath }`; the
    derived file name is surfaced to the user (the W03 File-name string via
    `deriveSongFilename`); after `SAVED` the which-book control is gone. *Pins
    workflow 3 §Its file name / §The first save.*
  - *My songs created* — starting a new song from the empty shelf sends
    `NEW_SONG` and, on `NEW_SONG_READY`/`SHELF`, shows *My songs* with the new
    draft; the create-from-query row carries the query as title. *Pins workflow
    3 §Which book L28, §Ways in.*
  - axe clean on the ways-in rows, the editor host and the which-book control.
- **behavior — `app/src/worker/new-song.behavior.test.js`** (the Worker rig —
  `fake-indexeddb`, `installWebLocks()`, a `createFileSystem`; a **local** home
  book, no remote; a `startGitHttpRemote()` only for the online-book case):
  - *My songs under the reserved id, idempotent* — `NEW_SONG` with no home book
    yet provisions a local home book, `git.init`s `/books/local-my-songs` with
    the §2.1 scaffold, writes `shelf.local.<deviceId>.local-my-songs`, allocates
    `untitled.cifra.md`, re-surfaces `SHELF`, and emits `NEW_SONG_READY`; a
    **second** `NEW_SONG` reuses the same repo and allocates `untitled-2.cifra.md`
    (asserted via the git CLI / a second `createFileSystem`). *Pins workflow 3
    §Which book L28, §Its file name L42–48; §2.1.*
  - *Findable before save* — after the editor's `WRITE` to the placeholder, a
    `SEARCH` for the title returns the location with `unsaved: true` (re-index on
    WRITE). *Pins workflow 3 L20–23.*
  - *The first save names and commits* — `NAME_AND_SAVE { bookId, fromPath }`
    for a buffer titled *Coração de Estrada* renames to
    `coracao-de-estrada.cifra.md`, makes one commit *Add Coração de Estrada*
    authored by the device local id, leaves no `untitled*` file, and (local
    book) makes no push; a later rename never happens. For an **online** book
    (seeded remote) the commit is pushed, and **offline** it resolves
    `pushed: false` with the commit kept (`working-copy.save`). *Pins workflow 3
    §Its file name / §The first save; DIRECTION §3 L111–113; offline-first.*
  - *Discard an unsaved draft deletes it* — `DISCARD` of a never-saved
    placeholder removes the file (no HEAD blob). *Pins workflow 3 §Abandoning
    it L50–55.*
- **e2e-web — `e2e/web/tests/new-song.spec.js`** (compose stack,
  phone/tablet/computer projects, axe WCAG 2.1 AA on every screen the flow
  touches):
  - *From the empty shelf* — on a first visit, **Write a song** opens the
    editor on *My songs*; type a title and body; **Save**; the song is on the
    shelf and in search without an *unsaved* badge; *My songs* now exists. *Pins
    workflow 3 §Ways in L12, §Which book, §The first save.*
  - *From search (no match)* — type a query that matches nothing, press **Create
    "{query}"**, see the template titled with the query; Save and find it. *Pins
    workflow 3 §Ways in L10–11.*
  - *From a book's section* — seed the bundled example book
    (`OPEN_EXAMPLE_BOOK`, the editor's e2e pattern), use **new song in this
    book**, and confirm the song lands in that book (its *where* shows the book).
    *Pins workflow 3 §Ways in L13, §Which book L32–33.*
  - *Offline* — with the network cut (`lib/offline.js`), write a new song and
    make its first save; the file persists and (for an online book) the push is
    queued, resolving when the network returns. *Pins workflow 3; offline-first;
    DIRECTION §3.4.*
  - axe at WCAG 2.1 AA on the ways-in surfaces, the editor host and the
    which-book control on every viewport.
  - *The file-view way in* is **not** exercised here (no file view exists yet) —
    it is `books.file_view`'s e2e (Decision 7, graph note). This task's e2e
    covers the three ways in that have a host. (This is a refinement of the
    note's e2e cases, not a dropped level: all of unit/behavior/e2e-web ship.)

### Deferred work and graph notes (closer registers / wires)

- **No new WBS leaves.** Everything this flow leaves open is an **existing** M2
  leaf that extends it or a dependency edge to correct; this task exposes the
  seams:
  - **The save sheet over the first save** → `songs.save_sheet` (`60-songs.tji`,
    `depends !editor, cifra_js.diff`): it renders the W03/W04 save dialog (Book /
    File name / Note, and the name prompt when a title is absent) and the musical
    diff, **reusing this task's `deriveSongFilename` and `NAME_AND_SAVE`**. The
    editor's `onSave` is the shared seam (editor Decision 10). No new leaf.
  - **The file-view way in** → `books.file_view` (`65-books.tji`, `depends
    storage.history, songs.editor`): it wires *new song in the folder being
    looked at* to this task's `onWriteSong({ bookId, folder })` /
    `NEW_SONG { folder }` and e2e-tests that entry (workflow 3 L14, workflow
    14). No new leaf.
- **Graph note for the closer (not a new task): add `books.shelf` and
  `account.first_run` to `songs.new_song`'s `depends`.** This task reuses
  `books.shelf`'s local-book-creation and local-home-book-provisioning seam
  (`git.init`, `books.createLocal`, `home-book.ensureLocal`, `home-book.set`,
  `nextShelfPosition`) and `account.first_run`'s reserved `MY_SONGS` identity,
  `onWriteSong` entry and `OPEN_EXAMPLE_BOOK` e2e seeding. Both are `complete
  100` M2 leaves, so nothing is blocked — this is a graph edge to record for an
  accurate dependency order. (`account.first_run` already `depends books.shelf`
  and `songs.search`, so no cycle: `new_song → {account.first_run, books.shelf,
  songs.editor, songs.search}`.)
- **Graph note for the closer (not a new task): add `songs.new_song` to
  `books.file_view`'s `depends`.** The file view wires the fourth way in to this
  task's new-song flow; today `file_view depends storage.history, songs.editor`.
  Both M2.
- **Graph note (optional, non-blocking): `songs.save_sheet` may depend on
  `songs.new_song`** to reuse `deriveSongFilename`/`NAME_AND_SAVE` rather than
  stub them. They are independent siblings today; whichever lands first stands
  alone (this task's first save is dialogless; `save_sheet` wraps it). Surfaced
  for the closer; not required.

## Decisions

1. **`deriveSongFilename` is a small pure module in `app/src/songs/`, shared by
   the Worker and the view.** The slug transform (NFD accent-drop, lower-case,
   hyphen-collapse, `.cifra.md`, collision suffix) is specified by workflow 3
   §Its file name and is needed in two places: the Worker computes the
   authoritative name (with collision against the real folder) at
   `NAME_AND_SAVE`, and the view/`songs.save_sheet` previews it (the W03 File
   name field). A framework-free module importable by both keeps them in
   agreement. It is a *different* transform from search's `fold.js` (which
   normalises for matching, not for a filename), so it does not reuse it beyond
   the shared idea. *Rejected: deriving in the view and passing the name to the
   Worker — the collision suffix needs the folder listing only the Worker has,
   so the authoritative name must be the Worker's; the view only previews.
   Rejected: putting it under `app/src/worker/` — `save_sheet`'s view needs it
   too, and a pure module under `songs/` is reachable from both.*
2. **A new `NEW_SONG` command ensures the target book and allocates the
   placeholder path; the editor is mounted only after `NEW_SONG_READY`.** The
   editor persists only when `bookId && path` are set (`SongEditor.jsx:113`),
   and a plain `WRITE` into `/books/local-my-songs` would write bytes into a
   directory with **no git repository and no shelf entry** — *My songs* would
   not be a book, could not be saved, and would not show its place. So one
   command, before the editor mounts, (a) ensures the target book exists — for
   *My songs*, idempotently under the reserved `local-my-songs` id, mirroring
   `OPEN_EXAMPLE_BOOK` (`logic.js:785–831`); for an already-existing chosen
   book, a no-op — and (b) allocates a free `untitled[-N].cifra.md` path against
   the book's working copy, returning `NEW_SONG_READY { bookId, path }`. "Created
   when first written to" is honoured: starting the song *is* writing its
   template into the book. *Rejected: minting *My songs* with `CREATE_BOOK` — it
   assigns a random `local-…` id (`books.js:74`), not the reserved
   `local-my-songs` every surface (first-run.js, search) already names, and is
   not idempotent. Rejected: allocating the placeholder in the view — the free
   name needs the Worker's dir listing.*
3. **Changing the book before the first save re-targets the draft with existing
   primitives; no bespoke move command.** Workflow 3 §Which book: until the
   first save "moving it costs nothing." So "Change book" issues `NEW_SONG` for
   the new book (ensuring it / allocating its placeholder), `WRITE`s the current
   buffer text into the new placeholder, and `DISCARD`s the old placeholder
   (which, being uncommitted, is deleted — `working-copy.discard`). This reuses
   three shipped operations rather than adding a `MOVE` command for a pre-save
   convenience. *Rejected: a `MOVE_FILE` command — the file view owns real file
   moves (DIRECTION §4 L449–453); a pre-save draft move is just create-here /
   discard-there, and reusing them keeps the working-copy surface small.*
4. **The first save is one `NAME_AND_SAVE` command: rename the placeholder, then
   the existing canonical commit-and-push.** The Worker parses the working-copy
   file for its title, derives `toPath`, renames `fromPath → toPath` on the fs
   (the placeholder is uncommitted, so no `git mv` is needed), then runs
   `working-copy.save` on `toPath` (canonicalise → `git.add` → `commit` *Add
   {title}* → best-effort `push`) and re-indexes, emitting the existing `SAVED`.
   This keeps canonicality and the offline-push behavior exactly the editor's
   save path, and the naming a thin step in front of it. *Rejected: a `RENAME`
   command separate from `SAVE` — two round-trips and two index passes for one
   user action, and a window where the renamed file is uncommitted under its
   final name for no reason. Rejected: extending `SAVE` to rename — `SAVE` serves
   every caller (edit, restore, save-all) and most never rename; a dedicated
   first-save command keeps `SAVE` unburdened.*
5. **Which-song-is-open and which-book-chosen are ephemeral view state; there is
   no router and no slice.** Following `shell.layout` (navigation is `useState`)
   and `songs.search` (scope is ephemeral, search Decision 8), the editor host's
   "open song" (`{ bookId, path, isNew }`) and the pre-save book choice live in
   `useState` in `AppShell`/the host, not a store slice. The durable state (the
   file, the shelf entry) is the Worker's; what is *open* is the view's.
   *Rejected: a store "open document" slice — the open buffer and the draft's
   book are view state; the Worker needs only the durable bytes (`WRITE`), the
   book (`NEW_SONG`) and the save (`NAME_AND_SAVE`).*
6. **This task owns the first-save *naming mechanism*; `songs.save_sheet` owns
   the *save sheet* that presents it; the first save pushes.** Workflow 3 §Its
   file name and DIRECTION §4 L446–448 place the title→slug naming and the
   `untitled` placeholder with the new-song flow (working_copy.md:176–178 says
   it is "the editor/new-song task's"); editor Decision 10 deferred the *sheet*
   (and "first-save naming") to `songs.save_sheet`. These reconcile by splitting
   mechanism from presentation: `new_song` delivers `deriveSongFilename` and
   `NAME_AND_SAVE` (and a dialogless first save, so writing a new song works and
   is e2e-tested now), and `save_sheet` renders the W03/W04 dialog (Book / File
   name / Note; the name prompt when a title is absent; the musical diff) over
   that mechanism (graph note). In `new_song`'s own flow a title is always
   present (the query, the template heading, or a pasted first line), so no
   name-prompt is needed here. The first save **commits and pushes** — DIRECTION
   §3 L111–113 ("Saving is a commit, and then a push") and workflow 4 settle it;
   workflow 3 L102's "still open (DIRECTION §6)" is a stale cross-reference (§6
   carries no such decision) and a save-behavior nit owned by workflow 4 /
   `save_sheet`, not corrected here. *Rejected: building the save sheet here —
   it is a separate leaf with its own semantic diff (`cifra_js.diff`) and tests;
   the `onSave` seam keeps the boundary clean, as the editor left it. Rejected:
   editing workflow 3 L102 — the save/push decision and its wording belong to
   workflow 4's domain; surfaced for the parking lot instead.*
7. **The file-view way in is `books.file_view`'s; this task builds the
   folder-aware flow it reuses.** Three of the four ways in have a host now
   (search, the empty shelf, a book section); the file view does not yet exist
   (`books.file_view` is an unbuilt M2 leaf). This task makes the new-song flow
   folder-aware (`NEW_SONG { folder }` places the placeholder in the folder;
   otherwise at the book root — workflow 3 L32–33) and exposes
   `onWriteSong({ bookId, folder })`; `books.file_view` wires its *new song
   here* entry and e2e-tests it (graph note). *Rejected: stubbing a file view
   here to test the fourth way in — it would build a throwaway surface that
   `books.file_view` owns and must rebuild; folder placement is testable at the
   Worker/behavior level now, and the entry's e2e belongs with the real file
   view.*

## Open questions

(none — all decided.)

One documentation nit is surfaced for the human-review queue rather than fixed
here: workflow 3 L102 ("Whether a save also pushes is still open (DIRECTION
§6)") contradicts DIRECTION §3 L111–113 (a save commits **and** pushes) and
points at a §6 decision that no longer exists. The save/push behavior is
workflow 4 / `songs.save_sheet`'s domain; the one-line correction to workflow 3
belongs there, not in this task's write scope (Decision 6).

## Status

**Done** — 2026-10-06.

- `app/src/songs/song-filename.js` — pure `deriveSongFilename` helper (NFD
  accent-fold, lower-case, hyphen-collapse, `.cifra.md`, collision suffix; yields
  `untitled` for empty/placeholder titles).
- `app/src/worker/my-songs.js`, `app/src/worker/protocol.js`,
  `app/src/worker/logic.js` — `NEW_SONG`/`NEW_SONG_READY` command+event:
  idempotent *My songs* provisioning under `local-my-songs`, placeholder
  allocation; `NAME_AND_SAVE` command: title-parse, slug rename, canonical
  commit+push (`working-copy.save`), `SAVED` re-emit; `surfaceHomeBookShelf`
  re-emit on create.
- `app/src/worker/working-copy.js` — `nameNewSong` / rename helper; offline push
  with `pushed: false` carried through unchanged.
- `app/src/worker/store.js`, `app/src/worker/useStore.js` — `subscribeEvents` +
  `useWorkerEvent` for transient `NEW_SONG_READY`/`SAVED` (Decision 5).
- `app/src/songs/WhichBook.jsx`, `app/src/songs/new-song.css` — which-book bar
  (In *{book}* + Change-book trigger, `canSaveFor` filter; gone after first save).
- `app/src/songs/NewSongHost.jsx` — editor host (mounts after `NEW_SONG_READY`;
  full-screen on all viewports per W03 board; sends `NAME_AND_SAVE` on Save).
- `app/src/shell/AppShell.jsx` — ephemeral new-song view state; threads
  `onWriteSong`/`onSongSaved` through `destinationPanels`.
- `app/src/songs/SearchScreen.jsx` — **Create "{query}"** row in the no-match
  state; **new song in this book** affordance in `BookSection`.
- `app/src/songs/FirstRun.jsx` — wires existing `onWriteSong` entry to the host.
- `app/src/editor/SongEditor.jsx` — optional `title` prop wiring the
  template-title seam (acceptance 2; `template(preferences, { title })`).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — new copy for ways in and
  which-book bar.
- Tests: `app/src/songs/song-filename.test.js` (unit, 7 tests),
  `app/src/songs/NewSong.behavior.test.jsx` (behavior, 5 tests, axe),
  `app/src/worker/new-song.behavior.test.js` (behavior, 6 tests, Worker rig),
  `e2e/web/tests/new-song.spec.js` (e2e-web, 4 tests × 3 viewports = 12).
- Graph edges added: `songs.new_song` now depends on `books.shelf` and
  `account.first_run`; `books.file_view` now depends on `songs.new_song`.
