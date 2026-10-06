# storage.index_dirty_reconcile — Derive unsaved from dirty working tree on reconcile

## TaskJuggler entry

[`tasks/40-storage.tji`](../../40-storage.tji) lines 105–110:

> ```
> task index_dirty_reconcile "Derive unsaved from dirty working tree on reconcile" {
>   effort 1d
>   allocate team
>   depends !index
>   note "search-index.reconcile() marks every song as saved (unsaved: false) on
>         load; an uncommitted draft loses its badge after a full page reload
>         because the working-tree diff is not checked. Fix: on reconcile, compare
>         each file's working-copy blob hash against HEAD and set unsaved: true
>         where they differ. Source of debt: tasks/refinements/songs/save_sheet.md
>         (songs.save_sheet). Tests: unit (reconcile with a dirty working tree sets
>         unsaved: true); behavior (a draft reloaded in a fresh Worker instance
>         retains the unsaved badge)."
> }
> ```

`depends !index` → the sibling task `storage.index` (the search index).

## Effort estimate

**1d** (as scoped in the `.tji`).

## Repository

**estante-de-cifras**, `app/` only — specifically the Web Worker data layer
(`app/src/worker/search-index.js`) and its tests (`app/src/worker/*.test.js`,
`app/src/worker/*.behavior.test.js`). No `cifra.md` work: the fix reads git
state through isomorphic-git, it does not change the format. The app and the
service share no code (DIRECTION §3.6, L288–291); this task touches neither the
service nor the API.

## Inherited dependencies

- **`storage.index`** — *settled, Done 2026-10-05*
  ([`index.md`](index.md), `complete 100` at `tasks/40-storage.tji:53`). Built
  the search index this task fixes: `app/src/worker/search-index.js`, the
  `createSearchIndex({ fs, git, parse })` factory (`search-index.js:149`), the
  `reconcile(bookId)` rebuild path (`search-index.js:315–337`), the
  `index_locations` record shape `{ key, bookId, path, oid, unsaved }`
  (`search-index.js:243`), and the `index_docs` content-addressed parse cache
  keyed by git blob oid. index.md Decision 3 fixes the persisted shape; this
  task adds nothing to it — `unsaved` already exists on the location record.

- **`songs.save_sheet`** — *settled, Done 2026-10-06*
  ([`../songs/save_sheet.md`](../songs/save_sheet.md)) — **the source of this
  debt.** It wired `unsaved` through the live command path: the WRITE handler
  marks a drafted path `unsaved: true` (`logic.js:613–629`), SAVE / NAME_AND_SAVE
  / DISCARD flip it back to `false` (`logic.js:671, 1076, 1080, 729`), and the
  search slice carries `unsaved` to the view (save_sheet.md L189, L193). It
  registered this follow-up itself (save_sheet.md L437: "Tech-debt registered:
  `storage.index_dirty_reconcile` (1d) … wired to m2_local"). save_sheet also
  built, in the Worker, an on-demand working-tree-vs-HEAD **musical** diff
  (`PREVIEW_SAVE` → `app/src/worker/save-preview.js`, save_sheet.md Decision 2) —
  related but distinct: that is a parse-and-diff preview opened per save, not the
  cheap persistent dirty flag this task derives.

Both predecessors are Done; nothing about this task is pending on unsettled work.

## What this task is

Today `reconcile(bookId)` — the bring-up / restart path that rebuilds the index
from the on-disk working tree (`search-index.js:315–337`, called by
`indexOneBook`/`buildIndexes` in `logic.js:505–524`) — indexes every file with
`unsaved` defaulting to `false` (`indexDocument`'s `unsaved = false` default,
`search-index.js:231`), and for a content-unchanged file it `continue`s past the
re-index entirely (`search-index.js:326`), keeping whatever `unsaved` the
persisted record happened to hold. Nothing in reconcile consults git. The only
place `unsaved: true` is ever set is the live WRITE handler (`logic.js:623–627`).

So a draft written but never committed is marked `unsaved: true` live, but after
a full page reload (a fresh Worker instance, which rebuilds via reconcile, not
WRITE) its badge silently flips to saved — the index now disagrees with the
actual working tree.

This task makes `reconcile` derive `unsaved` from git: for each working-tree
song, compare its working-copy blob hash (the `oid` reconcile already computes
at `search-index.js:324`) against the blob at that path in `HEAD`, and set
`unsaved: true` when they differ or when the path has no blob in `HEAD` at all (a
never-committed new song). The badge then means the same thing after a reload as
it did before one: the song's working copy differs from what is committed.

## Why it needs to be done

The unsaved badge is the only signal that a draft has work the user has not
committed. If it vanishes on reload, a person who closes and reopens the app —
or whose tab is reloaded by the browser, or by an app update applied on next
launch (DIRECTION §3.7, L424–431) — can no longer see which songs still hold
uncommitted edits, and "save all" on the search screen (which collects
`unsavedPaths`, `SearchScreen.jsx:243, 278–282`) silently narrows to nothing.
The working copy itself survives the reload (it is in IndexedDB, owned by the
Worker, §3.7 L407–409); only the index's record of its dirtiness is lost. This
closes that gap so the index reflects the persistent truth the working copy
already holds.

## Inputs / context

### Governing design

- `docs/DIRECTION.md` §3.1 **Sync**, L129–131 — the normative definition of
  "unsaved": *"With unsaved work in the working copy, incoming changes are merged
  into it — base, theirs, and the working text — so the user's edits stay unsaved
  and land on top."* "Unsaved" is the working-copy-vs-committed delta. This task
  makes the index's `unsaved` flag mean exactly that, which it does not reliably
  do after a reload today.
- `docs/DIRECTION.md` §3.7 **The app**, L407–409 — *"One owner for the data: a
  Web Worker. It holds git, the working copy and the search index, and does every
  clone, fetch, merge, save and index update. The main thread never touches
  IndexedDB."* The derivation runs entirely inside the Worker, over the Worker's
  own fs and git.
- `docs/DIRECTION.md` §3.7, L410–414 — the view reads slices fed by Worker
  messages through `useSyncExternalStore`; a corrected `unsaved` reaches the
  screen through the existing `search` slice with no protocol change.

### Workflows

- `docs/workflows/04-edit-and-save.md` — the save flow. A save makes the song
  canonical and committed; after it the song is no longer unsaved. This task is
  the reload-side invariant of that: a song is unsaved iff its working copy
  differs from the last commit, whether that was learned live or re-derived on
  load.

### The format

Not applicable — this task reads git object identity (blob oids), not song
content, and changes nothing about cifra.md. (A marked text — conflict markers,
spec §11.12.3 — is never canonical and never committed, so it necessarily
differs from HEAD and is correctly `unsaved: true`; the index still indexes it as
working-tree bytes, because indexing is not saving.)

### The code seam(s) this extends

- `app/src/worker/search-index.js`:
  - `createSearchIndex({ fs, git, parse })` factory — `:149`. `git` here is the
    network transport layer (`createGitLayer`), used only for
    `git.bookDir(bookId)` → `/books/<bookId>` (`git.js:65–67`).
  - `reconcile(bookId)` — `:315–337`. Walks `songPaths(bookId)` (`:274–296`,
    `*.cifra.md` only, `SONG_SUFFIX` `:71`); for each path reads the working
    bytes and `hashBlob({ object: bytes })` → `oid` (`:324`, `hashBlob` imported
    from isomorphic-git `:28`); `continue`s when `prev.oid === oid &&
    docsByOid.has(oid)` (`:326`); else `indexDocument(...)`. Returns a change-set
    `{ putDocs, putLocations, deleteLocations }`.
  - `indexDocument({ bookId, path, bytes, unsaved = false })` — `:231–253`,
    builds `location = { key, bookId, path, oid, unsaved }` (`:243`).
  - `reindexPath({ bookId, path, unsaved = false })` — `:257–261`.
  - `toRow` surfaces the flag: `unsaved: !!locationByKey.get(r.id)?.unsaved`
    (`:428`, also `browse` `:462`).
- `app/src/worker/working-copy.js` — the established local-git patterns this task
  mirrors. `discard` is the only existing working-tree-vs-HEAD check:
  `statusMatrix({ fs, dir, filepaths: [path] })`, reading `row[1]` (the HEAD
  column; `row = [filepath, HEAD, WORKDIR, STAGE]`), `inHead === 0` ⇒ never
  committed (`working-copy.js:238–260`). working-copy.js imports `add, remove,
  commit, checkout, statusMatrix` directly from isomorphic-git (`:27–33`) — the
  precedent for importing a git primitive directly into a Worker module rather
  than routing it through `createGitLayer` (whose surface is network-only by
  `storage.git` Decision 4, `git.md:301`).
- `app/src/worker/logic.js`:
  - `indexOneBook(bookId)` — `:517–524`, wraps `reconcile` with
    `INDEX_STATUS {state:'building'|'ready'}` and persists the returned
    change-set. The reconcile caller; unchanged by this task.
  - WRITE handler `:613–629` (`reindexPath({ unsaved: true })` `:623–627`), SAVE
    `:631–676` (`unsaved: false` `:671`), DISCARD `:713–734` (`:729`),
    NAME_AND_SAVE `:1015–1080` (`:1076, 1080`). The live-path flag setters;
    unchanged by this task.
  - Logs nothing per operation (`logic.js:9–11`) — the "no song text in logs"
    anchor.
- `app/src/songs/SearchScreen.jsx:176–180` — renders the badge from
  `item.unsaved` as `.badge.unsaved` (a word, not colour alone). Unchanged; this
  task only makes the value correct after a reload.
- Tests: `app/src/worker/search-index.test.js` (unit, in-memory,
  `createSearchIndex({ parse })`, no fs/git today);
  `app/src/worker/search-index.behavior.test.js` (behavior; real
  `fake-indexeddb` IDBFactory per test, `createFileSystem`, `startGitHttpRemote`,
  `installWebLocks`, a loopback `createWorkerLogic`, a "restart" = a second
  `makeStore` over the same idb + fs). Harness modules
  `app/src/test/git-http-remote.js`, `app/src/test/web-locks.js`,
  `app/src/test/loopback.js`, `app/src/test/setup.js`;
  `app/src/worker/migrations.js` (`INDEX_DOCS_STORE`, `INDEX_LOCATIONS_STORE`).

## Constraints / requirements

- **Worker owns the data; the derivation is internal to the index module.**
  (DIRECTION §3.7 L407–409.) The HEAD comparison runs in `search-index.js` over
  the injected `fs` and `git.bookDir(bookId)`, inside the existing
  `reconcile`/`indexOneBook` path. No new command, no new event, no protocol or
  reducer change: `unsaved` already rides the `search`/`browse` rows and the
  store/view already read it. The main thread stays untouched.
- **Offline first.** (DIRECTION §3.7.) Reconcile reads only the local working
  tree and local git refs — no network. The derivation must never fetch or
  resolve a remote ref; `HEAD` is the local committed state. *Applies as a
  constraint on the implementation: use only local isomorphic-git reads.*
- **The flag is re-derived for every present file, including content-unchanged
  ones.** The `continue` fast-path (`search-index.js:326`) must not leave a stale
  `unsaved`: an unchanged working blob can still differ from HEAD (e.g. a draft
  whose bytes have not changed since the last index but were never committed).
  The parse may still be skipped when the oid is unchanged (content-addressing,
  index.md Decision 6) — only the `unsaved` flag must be recomputed, and a
  location update emitted only when it actually changed (keep slices
  referentially stable, index.md / reducer.js convention).
- **Canonical form over preserving content** — *not applicable to indexing.* The
  index covers the working copy as-typed (index.md), including non-canonical and
  marked drafts; such a draft differs from HEAD and is correctly `unsaved: true`.
  This task does not canonicalise, save, or push anything.
- **No song text in logs.** (The project's standing rule.) The derivation
  compares blob *oids*, not contents, for the HEAD side; it logs nothing.
  *Applies trivially — noted so the closer sees it was considered.*
- **Accessibility** — *not applicable (no new UI).* The badge already rendered by
  `SearchScreen.jsx:176–180` carries its state as a word; this task only corrects
  the value feeding it. No React Aria, axe, or keyboard-path surface is added.
- **No book without an account** — *not applicable;* this task touches no
  request path, only local reconcile.

## Acceptance criteria

### Behavior delivered

- **`app/src/worker/search-index.js`** — `reconcile(bookId)` derives `unsaved`
  from git for every present song:
  - A new collaborator **`readHeadOids`** is injected into
    `createSearchIndex({ fs, git, parse, readHeadOids })`, with a default
    implementation that resolves `HEAD` for `git.bookDir(bookId)` and returns a
    `Map(path → blob oid)` for the committed tree, using isomorphic-git's local
    tree walk (`walk` + `TREE({ ref: 'HEAD' })`) over the injected `fs`. A book
    with no commit yet (`HEAD` unresolvable) yields an **empty map** — every
    present file is then a new, uncommitted draft.
  - For each path in `songPaths(bookId)`: `unsaved` is `true` when the path is
    absent from the HEAD map, or when its HEAD oid differs from the working-copy
    `oid` reconcile already computed (`search-index.js:324`); `false` when the
    HEAD oid equals the working-copy oid. The computed `unsaved` is passed into
    `indexDocument(...)` for changed/new files and into the location record for
    unchanged ones.
  - The content-unchanged `continue` (`:326`) is replaced by: skip the
    re-parse, but recompute `unsaved`; emit a location put (reusing the existing
    doc, no re-parse) only when `unsaved` changed from the persisted value,
    otherwise still `continue`.
  - Existing default callers (`logic.js` `createSearchIndex({ fs, git, parse })`)
    keep working via the `readHeadOids` default.

Observable result: after a full reload (a fresh Worker instance), a never-saved
draft keeps `unsaved: true` in its search row; a saved/committed song reads
`unsaved: false`; a working copy whose bytes exactly match HEAD reads
`unsaved: false` even if it was marked unsaved live (the index now agrees with
git).

### Tests the task lands with, by level

- **unit — `app/src/worker/search-index.test.js`** (existing file, new cases):
  drive `reconcile(bookId)` with an in-memory stub `fs` (a handful of
  `*.cifra.md` files), a stub `git` exposing `bookDir`, and a **stub
  `readHeadOids`** returning a known `Map(path → oid)`. Assert the derived
  `unsaved` for three cases on the returned change-set / resulting rows: a path
  whose working bytes hash differs from its HEAD oid → `unsaved: true`; a path
  whose working oid equals its HEAD oid → `unsaved: false`; a path absent from
  the HEAD map (new, never committed) → `unsaved: true`. A fourth case pins the
  fast-path: a content-unchanged file whose HEAD oid now matches is reconciled
  from a stale `unsaved: true` to `false` without a re-parse (parse spy not
  called). *Pins `.tji` note "reconcile with a dirty working tree sets unsaved:
  true" and DIRECTION §3.1 L129–131 (unsaved = working-copy-vs-committed).*

- **behavior — `app/src/worker/search-index.behavior.test.js`** (existing file,
  new/extended case, held green): over the real harness (fake-indexeddb,
  `createFileSystem`, `startGitHttpRemote`, cloned book), write and **save**
  (commit) a song, then write a second song as a draft that is **never
  committed**; perform a "restart" (a second `makeStore` over the same idb + fs,
  i.e. a fresh Worker instance = a reload) so the index rebuilds through
  `reconcile`; `searchUntil` the rebuilt index and assert the committed song's
  row has `unsaved: false` and the never-committed draft's row has
  `unsaved: true`. Extend the existing restart test (`:285–323`) to also assert a
  saved file's `unsaved` stays `false` across the restart. *Pins the `.tji` note
  "a draft reloaded in a fresh Worker instance retains the unsaved badge",
  workflow 04 (a save clears unsaved), and DIRECTION §3.7 L407–409 (the Worker
  rebuilds the index from its own working tree on load).*

Fixtures use songs written for the purpose, never someone else's words. The
closer confirms every named test above ran (not skipped) in the gate's output
before committing.

### Why no e2e-web / e2e-api / axe here

- **e2e-web / axe** — the fix is entirely inside the Worker data layer and adds
  no screen or interaction; the badge's rendering and axe-cleanliness are already
  pinned by `songs.save_sheet`'s e2e-web and behavior coverage. The one
  user-observable effect — the badge persisting across a reload — is pinned
  deterministically at the behavior level against a fresh Worker instance, which
  *is* a reload of the data layer (the view reads the same `search` slice either
  way). An e2e-web reload journey would re-exercise the view for a value the
  behavior test already proves correct at its source. *Noted so the closer sees
  the level was considered and deliberately not added.*
- **e2e-api** — no service, request, or git-over-HTTP path is touched.

### Deferred work

**None.** The task is self-contained: it corrects one derivation inside an
existing reconcile path and lands its own unit and behavior coverage. No new
module, seam, or follow-up is required.

## Decisions

1. **Derive `unsaved` by comparing the working-copy blob oid against the HEAD
   blob oid, not by re-running the musical diff.** reconcile already computes
   each working file's `hashBlob` oid (`search-index.js:324`) for the
   content-addressed parse cache; the only missing input is the committed oid at
   that path. A blob-oid comparison is O(1) per file once the HEAD tree is read,
   is exactly what the `.tji` note specifies ("compare each file's working-copy
   blob hash against HEAD"), and is consistent with the index's blob-hash
   identity model (index.md Decision 3). *Rejected:* reusing save_sheet's
   `PREVIEW_SAVE` musical diff (`save-preview.js`) to decide dirtiness — it
   parses both sides and diffs in musical terms, far more work than an oid
   compare, and it is designed as an on-demand per-save preview, not a
   whole-book load-time sweep; two files identical byte-for-byte are trivially
   not dirty without any parse. *Rejected:* trusting the persisted `unsaved`
   value across reload — that is the bug.

2. **Read HEAD once per book into a `path → oid` map (isomorphic-git `walk` +
   `TREE({ ref: 'HEAD' })`), rather than per-file `statusMatrix`.** reconcile
   already walks every working path and holds each working oid; a single HEAD
   tree walk gives all committed oids in one read of tree objects (no blob
   contents), and the per-file comparison is then a map lookup against the oid
   already in hand. *Rejected:* `statusMatrix({ filepaths: [path] })` per file
   (the pattern `working-copy.js` discard uses) — statusMatrix re-hashes the
   working-tree bytes to decide WORKDIR status, which would duplicate the
   `hashBlob` reconcile already performs for every file, doubling the hashing
   over the whole book; its tri-state WORKDIR semantics are also more than needed
   when the working oid is already computed. statusMatrix remains the right tool
   for `discard`'s single-path HEAD-existence check; it is the wrong shape for a
   whole-book load-time derivation.

3. **Inject the HEAD-oid reader as a `readHeadOids` collaborator of
   `createSearchIndex`, with a real isomorphic-git default.** This matches the
   Worker's dependency-injection house style (`createSearchIndex({ fs, git,
   parse })`, `createWorkingCopy({ fs, git, locks })`, `createGitLayer({ fs,
   http })`) and, crucially, makes reconcile's dirty-derivation *unit-testable*
   with a stub map — honouring the `.tji` note's unit-level entry — without
   standing up a real committed git repo in a unit test (reconcile's git read
   otherwise only runs against the behavior harness). The default implementation
   lives in `search-index.js` and imports `walk`/`TREE` directly from
   isomorphic-git, mirroring how the module already imports `hashBlob` and how
   `working-copy.js` imports its local git primitives. *Rejected:* importing
   `walk`/`TREE` inline with no injectable seam — it would force the "reconcile
   with a dirty working tree" test up to the behavior level (a real repo),
   leaving the note's named unit test undeliverable as a true unit test.
   *Rejected:* extending `createGitLayer`'s surface with a HEAD reader — that
   layer is network-only by `storage.git` Decision 4 (`git.md:301`); local reads
   belong in the consumer, as `working-copy.js` already establishes.

4. **No change to the protocol, reducer, store, or view; no design delta.**
   `unsaved` is already an `index_locations` field (index.md Decision 3), already
   carried on `search`/`browse` rows (`search-index.js:428, 462`), and already
   rendered by `SearchScreen.jsx:176–180`. This task only makes the value correct
   after a reload — it brings the index into agreement with DIRECTION §3.1
   L129–131 (unsaved = the working-copy-vs-committed delta) and with the working
   copy that §3.7 L407–409 already persists in IndexedDB. Because designed
   behavior is unchanged (the badge means what it has always meant), no
   `DIRECTION.md` or workflow edit is required. *Rejected:* a DIRECTION delta
   stating "unsaved survives reload" — the invariant is already implied by §3.1
   (unsaved lives in the working copy) and §3.7 (the Worker persists and rebuilds
   from the working copy); writing it afresh would restate, not amend, the
   constitution, and the bias is against ceremony for a bug fix. (Surfaced in the
   return summary for the record, not encoded as work.)

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- `app/src/worker/search-index.js` — added `readHeadOids` default (local `walk` + `TREE({ ref: 'HEAD' })` → `path → oid` map, empty on no-commit); injected `readHeadOids` collaborator into `createSearchIndex`; `reconcile` now derives `unsaved` per present file (working oid vs HEAD oid; absent-from-HEAD ⇒ `true`) for both the re-parse path and the content-unchanged fast path, emitting a location put only when the flag changed.
- `app/src/worker/search-index.test.js` — 5 new unit cases: dirty→`true`, equal→`false`, absent-from-HEAD→`true`; fast-path stale-`true`→`false` without re-parse (parse spy); no-change→no-put.
- `app/src/worker/search-index.behavior.test.js` — extended the restart test to SAVE a song and assert `unsaved: false` survives the restart; new test "re-derives unsaved on a restart: a never-committed draft keeps its badge, a saved song does not".
