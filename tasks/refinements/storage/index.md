# storage.index — The search index

## TaskJuggler entry

[`tasks/40-storage.tji`](../../40-storage.tji), `task storage.index`
(lines 50–55), under `task storage`. Dependencies as declared:
`depends !working_copy, cifra_js.reader` (line 53). The one-line note
(line 54):

> "MiniSearch with accent folding; title, properties, sections, words,
> chords; keyed by blob hash; covers unsaved work; kept in IndexedDB.
> Workflow 2. Tests: unit (accent folding, the fields, ranking); behavior
> (the index built in the Worker from a book, updated on save and on
> unsaved edits, kept across a restart in a fake IndexedDB, keyed by blob
> hash so unchanged files are not re-read)."

This is the derived, blob-hash-keyed index DIRECTION §3 promises
(`docs/DIRECTION.md` L114–117) and the engine behind the primary interface
DIRECTION §4 names (L430–435): song search across every loaded book.

## Effort estimate

**3d** (as scoped in the `.tji`).

## Repository

**estante-de-cifras**, `app/` — the Web Worker logic under
`app/src/worker/` and its co-located tests. Not a `cifra.md:` task: the
index consumes the format's reader (`parse` from the `cifra-md` package) but
changes nothing in the spec, the reference or the corpus. The app and the
service share no code (DIRECTION §3.6 L275–278); the service does not search
songs — search is entirely on the device (workflow 2 L152–155).

## Inherited dependencies

- **`storage.working_copy`** — *settled, Done 2026-10-05*
  ([`working_copy.md`](working_copy.md)). The index reads what this task put
  on disk and hooks the dispatch points it established:
  - Each book is a real git working tree on the injected `fs` at
    `git.bookDir(bookId)` = `/books/<bookId>/` (`app/src/worker/git.js`,
    `app/src/worker/working-copy.js:58,82,96`). Current file bytes —
    **including unsaved, uncanonicalised edits** — are read with
    `fs.promises.readFile`; `WRITE` persists the editor's raw bytes with no
    commit (`working-copy.js:80–87`). This is the surface that lets the
    index "cover the working copy too, so unsaved work is findable"
    (DIRECTION §3 L116–117).
  - `createWorkingCopy({ fs, git, locks }) → { write, save, discard }`
    (`working-copy.js:53`). `save(...)` canonicalises, commits one or many
    paths and best-effort pushes, resolving `{ commit, pushed }` or
    `{ refused: { path, reason, … } }` (`working-copy.js:117–152`);
    `discard(...)` checks tracked paths back to HEAD and unlinks
    never-saved files.
  - The command/event seam these mutations flow through, in
    `app/src/worker/logic.js`: `WRITE='write'` (payload `{ bookId, path,
    text }`, **emits nothing** on success — a silent durability write),
    `SAVE='save'`, `DISCARD='discard'`; events `SAVED`/`DISCARDED`/
    `SAVE_REFUSED` (`logic.js` dispatch ~`:261–302`). **There is no generic
    "file changed" event and WRITE emits none** — so the index must be
    invoked inline at these dispatch points (Decision 5).
  - Working-tree status is read with isomorphic-git `statusMatrix` over the
    shared `fs` (`working-copy.js:163–164`); isomorphic-git is called
    directly over `fs` for local reads — the pattern the index follows for
    blob hashing (Decision 2).

- **`cifra_js.reader`** — *settled, Done 2026-10-05*
  ([`../cifra_js/reader.md`](../cifra_js/reader.md)). The index parses every
  song through it:
  - `import { parse } from 'cifra-md'` (the `file:../../cifra.md/js` link in
    `app/package.json`). `parse(bytes) → model`; it never throws on
    malformed music (everything it cannot keep becomes a diagnostic), the
    only throw being `NotUtf8Error`.
  - The model is plain JS objects — directly indexable: `model.title`
    (`string | null`); `model.properties` (ordered list, holds artist and
    the rest, §1.4.2); `model.sections[].name`; on sung lines
    `item.words` per chord item and `{ kind:"lyric", text }` lines;
    chords as `item.symbol` (the raw chart token, e.g. `"Cm"`), `item.key`
    (voicing key), and structured `item.chord` (`{ root, quality,
    extensions, bass }` or `null`). `model.sung` / `model.sungAt` say
    whether the song carries words.

- **`storage.worker`** — *settled, Done 2026-10-05* (transitive via
  `working_copy`) ([`worker.md`](worker.md)). The protocol/store/reducer the
  index extends (Decisions 4, 6):
  - `app/src/worker/protocol.js` — `CommandKind` and `EventKind`, both
    `Object.freeze`d and open to new kinds; `command(kind, payload)` /
    `event(kind, payload)` envelopes (`{ v:1, dir, kind, payload }`), every
    message structured-cloneable.
  - `app/src/worker/reducer.js` — pure `reduce()` folding events into named
    slices from `initialState`; **an unchanged slice keeps its reference
    (`Object.is`), an unknown event kind returns the same state** — the
    bail-out that makes `useSyncExternalStore` re-render only what changed.
  - `app/src/worker/store.js` — `createStore(endpoint)` with `send(message)`
    and per-slice `store.slice(name)`; `app/src/worker/useStore.js` —
    `useSlice(store, name)` over `useSyncExternalStore`.
  - `app/src/worker/logic.js` — `createWorkerLogic(port, options = {})`, the
    sole IndexedDB owner; injection seam `options` (`indexedDB`, `name`,
    `migrations`, `navigator`, `fetch`, `fs`); memoised `ensure*()` helpers
    compose the primitives in the closure; `switch (message.kind)` dispatch;
    **errors never cross the port — they become an `ERROR` event**; logs
    nothing (`logic.js:9–11`).

- **`storage.migrations`** — *settled, Done 2026-10-05*
  ([`migrations.md`](migrations.md)). `app/src/worker/migrations.js` —
  `MIGRATIONS` is an ordered list of steps `{ version, label, upgrade(db,
  tx, oldVersion) }`; `latestVersion(MIGRATIONS)` derives `SCHEMA_VERSION`;
  `runMigrations(...)` runs steps `(oldVersion, newVersion]` inside the one
  `versionchange` transaction. The header reserves this task a slot:
  "Each later storage task (…, **storage.index**, …) lands its own step
  here." The index's object stores are created by appending **one** step
  (Decision 3).

- **`foundation.app_tooling`** — *settled* (transitively). Plain JS/JSX, no
  TypeScript (contracts are JSDoc `@typedef`); Vitest in jsdom with
  co-located `*.test.js` / `*.behavior.test.js`; `fake-indexeddb ^6.2.5`;
  the in-process loopback transport, local git-HTTP remote and Web-Locks
  shim under `app/src/test/`.

No pending dependencies: both named dependencies and the transitive
foundation are Done.

## What this task is

The Worker builds and keeps a full-text search index of every song on the
device, so that one search box spans every loaded book. For each song it
pulls five fields from the parsed model — **title, properties (artist and
the rest), section names, lyric words, and chords** — folds them so accents
and case do not matter (`coracao` finds *Coração*), and feeds them to a
[MiniSearch](https://github.com/lucaong/minisearch) index that ranks by
field and by match. The index is **keyed by git blob hash**: a song's text
is parsed once per distinct blob, so two copies of the same song parse once
and a reopen re-reads nothing that has not changed. It **covers the working
copy**, hashing the current working-tree bytes — so unsaved edits are
findable the moment they are typed — and updates incrementally as the user
writes, saves and discards. Its persisted records live in the `estante`
IndexedDB database behind a migration step, so the index survives a restart
without re-parsing. Querying runs in the Worker: a `SEARCH` command returns
ranked results to the main-thread store as a structured-cloneable event, and
a per-book build status lets the search screen say a book is "still
loading."

## Why it needs to be done

Song search is the app's primary interface — "The app opens on search: one
box, across every book on the shelf" (workflow 2 L11), "**Song search is the
primary interface.** One search across every loaded book" (DIRECTION §4
L430–431). Nothing in the app surfaces a song to the user without it. It is
the direct engine for the search screen (workflow 2), the chord-explorer
composition (workflow 2 L26–42, which needs songs matched by the chords they
use), writing a new song from search (workflow 3, DIRECTION §4 L437–439) and
the setlist and file views that locate songs. DIRECTION §3 commits to it
explicitly as "a derived index … keyed by blob hash" (L114–116) owned by the
one Web Worker (§3.7 L407–409). It depends on the working copy (the text to
index, saved and unsaved) and the reader (to turn that text into fields),
and it is itself a dependency of every screen that finds a song.

## Inputs / context

### Governing design

- **DIRECTION §3 — Storage** (`docs/DIRECTION.md` L103–119). The index
  definition, verbatim (L114–117): "**A derived index** of every song —
  title, properties, sections, words, chords — keyed by blob hash, so a song
  is parsed once per distinct text, and a pull re-reads only the trees that
  changed. It covers the working copy too, so unsaved work is findable."
  Also L105–106 ("each book is a git repository on a filesystem backed by
  IndexedDB … in a Web Worker") and L118–119 (one Web Lock per book).
- **DIRECTION §3.7 — the app** (`docs/DIRECTION.md` L394–414). "One owner
  for the data: a Web Worker. It holds git, the working copy and the search
  index, and does every clone, fetch, merge, save and index update. The main
  thread never touches IndexedDB" (L407–409). "A store on the main thread is
  fed by the Worker's messages, and components read the slices they need
  through `useSyncExternalStore` … only what shows it moves" (L410–414).
- **DIRECTION §4 — The interface** (`docs/DIRECTION.md` L428–439). "**Song
  search is the primary interface.** One search across every loaded book:
  title, artist, sections, words, chords. Accent-insensitive, so `coracao`
  finds *coração*. Each result says which book and folder it is in, and
  whether it has voicings for the instrument in use, unsaved changes, or a
  conflict. Books are a scope on that search" (L430–435).

### Workflow

- **Workflow 2 — Find and play a song** (`docs/workflows/02-find-and-play.md`,
  Status: decided, L3). What the index must support:
  - **Fields and folding** (L22–24): "results narrow on every keystroke.
    Search covers title, properties (artist and the rest), section names,
    words and chords, and ignores accents and case: `coracao` finds
    *Coração*."
  - **A chord is a result too** (L26–38): when the query parses as a chord
    symbol the explorer row comes first, then text matches, then "the songs
    that use the chord" — so chords are a searchable field. `A` is both a
    chord and a word; both kinds of result appear, "Nothing is hidden by
    guessing which was meant." (The explorer row itself is the music/explorer
    UI's job; the index only makes chord-use matches possible.)
  - **A result** (L44–58): title + artist, book and folder, badges (voiced
    for / unsaved changes / conflict); "Results are not grouped by song" —
    two songs with the same title are two results, so the index's unit is a
    **location** (book + path), not a title.
  - **Scope** (L60–65): "Search covers every book." A filter narrows it to
    books or folders.
  - **Offline** (L152–155): "Nothing on this screen needs a network. Search
    … run[s] on what is on the device."
  - **Still building** (L159–162): "A book still cloning, or an index still
    building, contributes results as they become available. The book's
    section says it is still loading, rather than looking empty."
  - **Later** (L42): searching by chord progression (`Am F C G`) — explicitly
    deferred in the workflow; out of scope here (see Acceptance → Deferred).

### The format

- `parse` from `cifra-md` (`/home/ruoso/devel/cifra.md/js/src/index.js:68`,
  `parse.js`); model shape as summarised under Inherited dependencies and in
  [`../cifra_js/reader.md`](../cifra_js/reader.md). Byte-for-byte
  conformance-pinned by the corpus; the index reads it, never reshapes it.

### The code seams this extends

- `app/src/worker/logic.js` — `createWorkerLogic(port, options)`, the
  `ensure*()` memoised composition and the `switch (message.kind)` dispatch
  (the WRITE/SAVE/DISCARD/OPEN points the index hooks).
- `app/src/worker/working-copy.js` — the working tree on `fs` at
  `/books/<bookId>/`; `write`/`save`/`discard` (`:53`, `:80–152`).
- `app/src/worker/git.js` — `createGitLayer({ fs, http }) → { clone, fetch,
  push, bookDir }`; `bookDir(bookId)`.
- `app/src/worker/protocol.js`, `reducer.js`, `store.js`, `useStore.js` —
  the message/store seam.
- `app/src/worker/migrations.js` — `MIGRATIONS`, `latestVersion`,
  `runMigrations`.
- `app/src/worker/home-book-canonical.js` — the only existing Unicode
  normalisation (NFC, **for storage**); the accent-**fold** (NFD + strip
  combining marks + lowercase, **for search**) is distinct and written fresh
  here (Decision 7).
- Test support: `app/src/test/loopback.js` (`createLoopbackEndpoint`),
  `app/src/test/git-http-remote.js` (`startGitHttpRemote`),
  `app/src/test/web-locks.js` (`installWebLocks`), `app/src/worker/fs.js`
  (`createFileSystem`), `app/src/a11y/axe.js` (unused here — no UI).

## Constraints / requirements

- **Worker-only, framework-free.** The index is plain ESM under
  `app/src/worker/`, never imported by the main thread, never touching
  React. All IndexedDB access is inside `logic.js`. The main thread learns
  of results only through structured-cloneable events and reads them through
  `useSyncExternalStore` (DIRECTION §3.7 L408–414). *Applies — central.*
- **Query runs in the Worker.** The MiniSearch instance and its documents
  stay in the Worker; the main thread sends a `SEARCH` command and receives
  a `SEARCH_RESULTS` event. The index is never shipped to the main thread
  (Decision 8). *Applies.*
- **Keyed by blob hash.** A song's parsed/extracted fields are stored under
  its git blob oid; a text is parsed at most once per distinct blob, and a
  reopen re-reads only what the oid shows changed (DIRECTION §3 L114–116).
  *Applies — central.*
- **Covers unsaved work.** The index reflects the current working-tree bytes,
  not only committed blobs; an unsaved edit is findable (DIRECTION §3
  L116–117, §4 L434). *Applies — central.*
- **Kept in IndexedDB, under the migration framework.** The index's object
  stores live in `estante` and are created by one appended `MIGRATIONS` step
  inside its `versionchange` transaction — never by opening the DB at an
  ad-hoc version (migrations.md). It survives a restart. *Applies.*
- **Offline first.** Search is entirely local; nothing it does waits on the
  network (workflow 2 L152–155). *Applies.*
- **No song text in logs.** The index parses and holds song words; it must
  log none of it — no titles, lyrics, chords or file paths in any log line
  (DIRECTION §3.5; `logic.js:9–11`). The persisted records in IndexedDB are
  the user's own on-device data and are not a log. *Applies.*
- **No book without an account.** The index only ever holds books already on
  the device, which required a session and a membership to clone; it adds no
  new read path and no anonymous surface. *Applies trivially.*
- **Canonical form over preserving content.** *Not applicable as a
  constraint on the index.* The index indexes the working copy **as it is**,
  including unsaved and uncanonicalised text, and even text carrying conflict
  markers — because DIRECTION requires unsaved work to be findable. The
  canonical-over-preserving rule governs what is *saved and pushed*
  (`working_copy.md`), not what is indexed; the index writes no song text
  back anywhere.
- **Accessibility.** *Not applicable here* — the index renders nothing. The
  search screen's React UI (its box, result rows, badges and "still
  loading" state) and its axe/WCAG checks land with the search-screen UI
  task, not this one (see Acceptance → Why no e2e-web / axe here).

## Acceptance criteria

### Behavior delivered

1. **Build on open.** When a book is opened/cloned, the Worker walks its
   song files (`*.cifra.md`) under `/books/<bookId>/`, hashes each file's
   current working-tree bytes to a git blob oid, parses once per distinct
   oid through `cifra-md` `parse`, extracts the five fields and adds a
   document per location (book + path) to the MiniSearch index.
2. **The five fields, folded.** `title`, `properties` (artist and the rest),
   section names, sung `words` + lyric-line text, and `chords`
   (`item.symbol`) are indexed; a fold (NFD, strip combining marks,
   lowercase) is applied to indexed terms and to the query alike, so
   `coracao` matches *Coração* and `CORACAO` matches *coração*.
3. **Ranking.** A title match outranks a body-only match (field boosts); a
   query matching more fields of a song ranks it higher. Results come back
   ranked, each carrying its location (`bookId`, `path`) and the title and
   artist needed to render the row (workflow 2 L44–54).
4. **Chord-use search.** A query that is a chord symbol (e.g. `Am`) matches
   songs that use that chord via the chords field (workflow 2 L37). (The
   explorer-first ordering is the UI's composition, not the index's.)
5. **Covers unsaved work, updates incrementally.** A `WRITE` re-hashes and
   re-indexes just that path; a title typed but not saved is found
   immediately. A `SAVE` re-indexes the saved paths (now canonical);
   a `DISCARD` re-indexes reverted paths and removes never-saved files from
   the index.
6. **Content-addressing.** Two locations with identical bytes share one
   parsed-document record (parse runs once); an unchanged file after reopen
   is not re-parsed.
7. **Kept across a restart.** The parsed-document records (keyed by oid) and
   the location→oid map persist in `estante`; on relaunch the MiniSearch
   index is rebuilt from the stored records without re-parsing any file whose
   oid is unchanged.
8. **Scope.** A `SEARCH` command may carry a scope (book ids, or a folder
   prefix within a book); results are filtered to it. Default is every book.
9. **Build status.** The Worker emits a per-book index status
   (`building` → `ready`) so the search screen can say a book is "still
   loading" and show results as they arrive (workflow 2 L159–162).

Wiring (Decisions 3–6): a new module `app/src/worker/search-index.js` —
`createSearchIndex({ fs, git, parse })` (named `search-index`, **not**
`index`, to avoid colliding with the Worker entry `app/src/worker/index.js`,
Decision 1) — plus a fold helper `app/src/worker/fold.js`; a `MIGRATIONS`
step creating the `index_docs` (key = blob oid) and `index_locations`
(key = `<bookId>\0<path>`) object stores; `CommandKind.SEARCH`,
`EventKind.SEARCH_RESULTS` and `EventKind.INDEX_STATUS` in `protocol.js`;
`search` and `index` slices in `reducer.js` (referentially stable); and
re-index calls at the OPEN/WRITE/SAVE/DISCARD dispatch points in `logic.js`.

### Tests the task lands with, by level

Per the `.tji` note's `Tests:` clause — **unit** and **behavior**. Fixtures
are purpose-written songs, never anyone's copyrighted words.

- **unit — `app/src/worker/fold.test.js`:** the fold maps `coração`,
  `Coração`, `CORACAO`, `coracao` to one term; preserves non-Latin scripts
  unharmed; idempotent. *Pins workflow 2 L24, DIRECTION §4 L431–432
  ("ignores accents and case" / "Accent-insensitive").*
- **unit — `app/src/worker/search-index.test.js`:**
  - *Field extraction* — from a parsed `cifra-md` model, the extractor pulls
    `title`, `properties` (artist and the rest), `sections[].name`, sung
    `words` + lyric text, and chord `symbol`s, and nothing else. *Pins
    DIRECTION §3 L114–115, `.tji` "the fields".*
  - *Ranking* — a query hitting the title ranks above one hitting only the
    words; a multi-field hit ranks above a single-field hit. *Pins `.tji`
    "ranking", workflow 2 L22–24.*
  - *Chord-use* — a chord-symbol query returns a song that uses the chord.
    *Pins workflow 2 L37.*
  - *Content-addressing* — two documents built from identical bytes cause
    one parse (parse spy called once). *Pins DIRECTION §3 L115 "parsed once
    per distinct text".*
- **behavior — `app/src/worker/search-index.behavior.test.js`** (real Worker
  logic in-process via `createLoopbackEndpoint`, a fresh `new IDBFactory()`
  per test from `fake-indexeddb`, `installWebLocks()`, `createFileSystem`,
  and `startGitHttpRemote()` for a seeded book):
  - *Built in the Worker from a book* — open a book of purpose-written
    songs; a `SEARCH` command returns the expected song ranked, with its
    `bookId`/`path`/title/artist. *Pins DIRECTION §3.7 L408, workflow 2
    L22–24.*
  - *Updated on an unsaved edit* — a `WRITE` giving a song a new title; a
    `SEARCH` for the new title finds it **before any save**. *Pins DIRECTION
    §3 L116–117 ("covers the working copy … unsaved work is findable"),
    `.tji` "updated on … unsaved edits".*
  - *Updated on save and discard* — a `SAVE` re-indexes canonical text; a
    `DISCARD` removes a never-saved file from results. *Pins `.tji` "updated
    on save", workflow 4 (save) via working_copy.*
  - *Kept across a restart, keyed by blob hash* — tear down the logic and
    re-open `createWorkerLogic` over the **same** `IDBFactory`; search works
    without re-parsing, and the parse spy is not called for a file whose oid
    is unchanged. *Pins `.tji` "kept across a restart … keyed by blob hash so
    unchanged files are not re-read".*
  - *Build status* — opening a book emits `INDEX_STATUS` `building` then
    `ready`, folded into the `index` slice. *Pins workflow 2 L159–162.*
  - *Offline* — the whole behavior suite runs with no network beyond the
    local git remote used to seed the book; search itself makes no request.
    *Pins workflow 2 L152–155.*

### Why no e2e-web / e2e-api / axe here

The `.tji` note names only unit and behavior, and that is right: the index
is a Worker module with no rendered UI and no HTTP endpoint. The
end-to-end search **journey** — typing in the box, results narrowing per
keystroke, the `coracao`→*Coração* example on phone/tablet/computer, the
"still loading" state, offline, and axe at WCAG 2.1 AA — belongs to the
search-screen UI task that renders the box and the result rows (the
`songs`/`shell` UI that consumes the `search` and `index` slices); it lands
that e2e-web coverage, not this task. No level named by the note is dropped.

### Deferred work

- **Chord-progression search** (`Am F C G` as songs that contain it) is
  marked *Later* in workflow 2 (L42) and is out of scope here. Deferred to
  **`storage.progression_search`** — effort **2d**, depends `!index`; a new
  chord n-gram field on the index plus a progression-aware query; note does
  **not** start with `cifra.md:` (it extends the app-side index, consuming
  the reader's already-structured `item.chord`); `Tests: unit (n-gram
  extraction and progression match); behavior (a progression query finds a
  song that contains the run, built in the Worker).` Belongs to the same
  milestone as the find-and-play search experience. (Closer registers in the
  WBS and wires the dependency.)
- **Indexing setlists and re-indexing after a sync merge** are not new
  tasks: setlists are a distinct artifact handled by the setlist/songs
  surface, and the sync path (area `sync`, `tasks/45-sync.tji`) calls the
  index's re-index entry for the trees a fetch/merge changed — that wiring
  lands with the sync task that owns the merge, using the seam this task
  exposes. No follow-up leaf is created for either.

## Decisions

1. **Module named `search-index.js`, not `index.js`.** The Worker already
   has `app/src/worker/index.js` as its real worker-thread entry point
   (`storage.worker`). Naming the index module `index.js` would clobber it.
   The module is `app/src/worker/search-index.js`, factory
   `createSearchIndex({ fs, git, parse })`, mirroring the `createGitLayer` /
   `createWorkingCopy` factory-with-injected-collaborators pattern. *Rejected:
   a subdirectory `app/src/worker/index/` — no sibling primitive uses a
   subdirectory, and it buys nothing for one module and a fold helper.*
2. **Blob hashing via isomorphic-git over the shared `fs`.** The index
   computes a file's git blob oid with isomorphic-git's content hashing over
   the same injected `fs` (`hashBlob` for working-tree bytes; `resolveRef` /
   tree walk for committed blobs), the "call isomorphic-git directly over
   `fs`" pattern `working_copy` set with `statusMatrix`. The working copy
   exposes no blob-hash API. *Rejected: a bespoke content hash (e.g. SHA of
   the bytes) — git's oid is already the project's content-address (DIRECTION
   L115 says "blob hash" specifically), is stable across the committed and
   working forms, and lets a pull map changed trees to changed oids for
   free.*
3. **One migration step; stores `index_docs` + `index_locations`; rebuild
   MiniSearch at launch.** The appended `MIGRATIONS` step creates
   `index_docs` (key = blob oid → `{ oid, title, properties, sections,
   words, chords }`, the content-addressed parse cache) and `index_locations`
   (key = `<bookId>\0<path>` → `{ bookId, path, oid, unsaved }`, the
   MiniSearch doc id → blob + metadata map). On launch the in-memory
   MiniSearch instance is **rebuilt** by joining locations to their stored
   docs and `addAll`-ing them — no file is re-parsed. *Rejected: persisting
   MiniSearch's own `toJSON()` serialization — its format is coupled to the
   library version and `loadJSON` requires identical options, so a MiniSearch
   upgrade would force a reserialization migration of a format that is not
   ours to own; storing our own stable extracted-field records and rebuilding
   (fast, in-memory, no parse) keeps everything under our migration framework
   and still satisfies "unchanged files are not re-read".*
4. **New protocol kinds: `SEARCH` command, `SEARCH_RESULTS` and
   `INDEX_STATUS` events.** The index is a consumer, so — like `working_copy`
   and `preferences_surface` — it adds its own kinds rather than leaving
   `protocol.js` untouched (the primitive-only pattern of `git`/`locks`).
   `SEARCH` payload `{ query, scope? }`; `SEARCH_RESULTS` payload
   `{ query, results: [{ bookId, path, title, artist, score }] }`;
   `INDEX_STATUS` payload `{ bookId, state: 'building' | 'ready' }`. Slices
   `search` (`{ query, results }`) and `index` (`{ [bookId]: state }`) are
   referentially stable, replaced only on their own events. *Rejected: a
   single combined "index" event carrying both results and status — two
   concerns updating at different cadences would thrash each other's slice
   reference and defeat the `Object.is` bail-out.*
5. **Re-index inline at the `logic.js` dispatch points.** Because `WRITE`
   emits no event and there is no generic "file changed" event, the index is
   invoked inside `logic.js` at OPEN (build), WRITE (one path), SAVE (saved
   paths) and DISCARD (reverted/removed paths), mirroring how
   `preferences_surface` re-surfaces after a sync. *Rejected: a new
   "file-changed" broadcast event the index subscribes to — it would add a
   second seam for one in-process consumer; inline invocation is simpler and
   keeps the index update atomic with the mutation that caused it.*
6. **Index the current working-tree bytes, incrementally per keystroke.**
   Each `WRITE` (itself the as-you-type durability write) re-hashes just that
   file and replaces its one MiniSearch document; parse is skipped when the
   oid is already in `index_docs`. *Rejected: debouncing / only indexing on
   save — DIRECTION requires unsaved work to be findable "the moment it is
   typed" (§3 L116–117, §4 L434); a single-document replace keyed off a cheap
   hash is well within budget, and deferring to save would make a just-typed
   song invisible to the search it was created from (workflow 3).*
7. **Accent fold written fresh (NFD + strip combining marks + lowercase),
   applied through MiniSearch `processTerm`.** The only existing
   normalisation (`home-book-canonical.js`) is NFC **for storage**, the
   opposite direction; it is not reusable for folding. MiniSearch applies
   `processTerm` to both indexed terms and query terms, so one function folds
   both sides consistently. *Rejected: a third-party diacritics library — a
   dozen-line NFD fold needs no dependency, and MiniSearch already owns the
   tokenization pipeline it slots into.*
8. **Query in the Worker, results as events.** The MiniSearch instance never
   leaves the Worker; each keystroke sends a `SEARCH` command and the Worker
   posts a `SEARCH_RESULTS` event. *Rejected: shipping the serialized index
   to the main thread to query there — it violates "the Worker owns the
   search index … the main thread never touches IndexedDB" (DIRECTION §3.7
   L408), ships every song's words across the port needlessly, and would
   duplicate MiniSearch on both sides.*
9. **MiniSearch is the engine named by the task and consistent with the
   design; no DIRECTION delta.** The `.tji` note fixes MiniSearch by name,
   and DIRECTION governs the behavior ("a derived index", the fields, accent
   insensitivity) not the library — adding `minisearch` to
   `app/package.json` realises a choice the WBS already settled, so it needs
   no design-document amendment. *Rejected: `lunr` / `flexsearch` — MiniSearch
   is the named choice, is small, runs in a Worker with no DOM, and exposes
   the per-field boosts and `processTerm` hook the folding and ranking need.*

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- Created `app/src/worker/fold.js` — NFD + strip combining marks + lowercase fold helper for accent-insensitive search.
- Created `app/src/worker/search-index.js` — `createSearchIndex({ fs, git, parse })` factory: MiniSearch engine keyed by blob hash, five indexed fields (title, properties, section names, words, chords), content-addressed parse cache, incremental updates at WRITE/SAVE/DISCARD, rebuilt from IndexedDB on restart without re-parsing.
- Created `app/src/worker/fold.test.js` and `app/src/worker/search-index.test.js` — unit tests covering accent folding, field extraction, ranking, chord-use, and content-addressing (parse-once per oid).
- Created `app/src/worker/search-index.behavior.test.js` — behavior tests (built-from-book, build status building→ready, unsaved-edit findable, save+discard re-index, restart keyed by blob hash no re-parse, offline).
- Edited `app/src/worker/protocol.js` — added `CommandKind.SEARCH`, `EventKind.SEARCH_RESULTS`, `EventKind.INDEX_STATUS`.
- Edited `app/src/worker/reducer.js` — added `search` and `index` slices (referentially stable).
- Edited `app/src/worker/migrations.js` — step 2: creates `index_docs` and `index_locations` object stores.
- Edited `app/src/worker/logic.js` — SEARCH dispatch, re-index calls at OPEN/WRITE/SAVE/DISCARD, `readIndexStores`/`applyIndexChanges` with `hasIndexStores` guard, `parse` injection.
- Edited `app/package.json` + `app/package-lock.json` — added `minisearch ^7.2.0`; fixture schema version bumped to 2 in `migrations.test.js`, `migrations.behavior.test.js`, `store.test.js`, `fs.behavior.test.js`.
