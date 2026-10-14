# books.setlist_search — Surface setlists in song search

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji) → `task books.setlist_search`
("Surface setlists in song search"), lines 64–69.

## Effort estimate

1 day (as scheduled in the `.tji`).

## Repository

**estante-de-cifras** only — app work, no cifra.md / service / api change.
Two directories:

- `app/src/worker/` — the search index and its reconcile seams
  (`search-index.js`, `logic.js`).
- `app/src/songs/` — the one song-search view (`SearchScreen.jsx`,
  `search.css`).

The format is not touched: the setlist format (`*.setlist.md`, §10) and its
parser (`parseSetlist` from the `cifra-md` package) already landed with
`cifra_js.setlists`; this task consumes them, it does not change them.

## Inherited dependencies

- **`books.setlists`** (`!setlists`, `tasks/refinements/books/setlists.md`,
  **Done 2026-10-13**) — *settled*. The source of this debt. It built the
  in-app setlist surface (open, build, reorder, key and note, play seam) and
  the Worker commands `LIST_SETLISTS` / `ADD_TO_SETLIST`
  (`app/src/worker/logic.js:1283-1345`). It deferred setlist-in-song-search
  to this task (setlists.md Decision 8, lines 484-490; Deferred work, lines
  411-422) because the drawn **Setlists destination** is the primary
  discovery path and the 4d task's scope list named "open", not search
  integration.

Transitively settled through `books.setlists`: the one song search and its
index (`storage.index`, `songs.search`, `songs.reading`) — the
`createSearchIndex` engine, the `SearchScreen` view, the `index_docs` /
`index_locations` IndexedDB stores, and the reconcile seams this task
extends are all in place. `cifra_js.setlists` supplies `parseSetlist`.

No pending dependency. Every test this task names (below) is drivable today.

## What this task is

The one song search indexes only songs (`*.cifra.md`). A book's setlists
(`*.setlist.md`) are discoverable only through the drawn **Setlists
destination** that `books.setlists` built — they never appear in the search
that is "the primary interface" (DIRECTION §4). Workflow 12 says they must:
*"Setlists are found by the same search as songs, marked as setlists.
Opening one lists its songs."* (`docs/workflows/12-setlists.md:33-34`).

This task makes that true. It teaches the Worker's search index to index a
setlist's **title** alongside song fields, tagged with a **kind** so a
setlist is distinguishable from a song; it surfaces setlist hits in the
typed-query results of `SearchScreen`, each **marked by the word "Setlist"**
and opening into the existing setlist view; and it wires setlist index
entries through the **same reconcile seams** as songs, so they are kept
current on every save and on every index sweep (open, upload import,
put-online) exactly as song entries are.

## Why it needs to be done

Workflow 12 §The file L33-34 promises the behaviour; `books.setlists`
delivered everything else in the workflow and registered this as the bounded
follow-up (setlists.md:507, wired to milestone **M5**). Without it the
workflow's second discovery path — a setlist found through the primary
search, not only through its own destination — does not exist, and a user
who types a setlist's name into the one search that "finds everything" is
told nothing matched.

No task depends on this one; it closes workflow 12's search clause.

## Inputs / context

Governing documents (named by the `.tji` note):

- **Workflow 12 §The file** — `docs/workflows/12-setlists.md:8-34`. The
  setlist file format (an H1 **title**, then a numbered list of relative
  links to `*.cifra.md` files in the same book, each with optional `key` /
  `note`). The normative clause, **L33-34**:
  > Setlists are found by the same search as songs, marked as setlists.
  > Opening one lists its songs.

  L24: *"The **title** is the level-1 heading, as in a song."* — the one
  field this task indexes.
- **DIRECTION §4 (The interface)** — `docs/DIRECTION.md:462-478`. *"Song
  search is the primary interface. One search across every loaded book:
  title, artist, sections, words, chords. Accent-insensitive … Each result
  says which book and folder it is in, and whether it has voicings …,
  unsaved changes, or a conflict."* (L464-468). *"Search never shows or
  changes a file name."* (L470).
- **DIRECTION §3.7 (The app)** — `docs/DIRECTION.md:433-435`. *"One owner
  for the data: a Web Worker. It holds git, the working copy and the search
  index, and does every … index update. The main thread never touches
  IndexedDB."* The index change lands entirely in the Worker.
- **Mockups decision** — `docs/mockups/README.md:26`: status is carried by a
  **word** on every badge, never colour alone. The "marked as setlist"
  mark is therefore a word.

Code seams this task extends (all verified against the files as they stand):

- `app/src/worker/search-index.js`
  - `createSearchIndex({ fs, git, parse, readHeadOids })` (`:184`), returning
    `{ hydrate, indexDocument, reindexPath, removePath, removeBook,
    reconcile, search, browse }` (`:559-568`).
  - `const SONG_SUFFIX = '.cifra.md'` (`:71`) — the comment (`:69-70`) names
    setlists as out of scope ("Deferred work"); the single gate to lift.
  - `songPaths(bookId)` (`:336-358`) — walks the working tree collecting only
    `SONG_SUFFIX` files (`:353`).
  - `extractFields(model, oid)` (`:117`) → `{ oid, title, artist, properties,
    sections, words, chords, chordSeq }` — per-song field extraction.
  - `makeMini()` (`:201`): `SEARCH_FIELDS` (`:47`), `FIELD_BOOST` title:10
    (`:48`), `storeFields: ['bookId','path','title','artist']` (`:205`).
  - `locationKey(bookId, path)` (`:67`); the location record `{ key, bookId,
    path, oid, unsaved }` built in `indexDocument` (`:271`, record at `:283`).
  - `indexDocument` (`:271`) / `reindexPath` (`:297`) / `removePath` (`:306`)
    / `removeBook` (`:324`) / `reconcile(bookId)` (`:386-425`) — the change-set
    producers (`{ putDocs, putLocations, deleteLocations }`).
  - `toRow` (`:511-517`) — the result-row shape wired to the view; `browse`
    (`:535-557`) — the pre-typing per-book grouping.
- `app/src/worker/logic.js`
  - `ensureSearchIndex()` (`:496-505`) composes `createSearchIndex({ fs, git,
    parse: parseSong })`; `parseSetlist` is already imported from `cifra-md`
    (`:13`).
  - WRITE handler reindex (`:952-968`, `reindexPath({ bookId, path, unsaved:
    true })` at `:962`); SAVE handler loop (`:1008-1023`, `reindexOrRemove({
    …, unsaved: false })` at `:1020`); `reindexOrRemove` (`:691-702`);
    `indexOneBook(bookId)` (`:739-746`); `buildIndexes()` (`:727-733`, on
    OPEN); index catch-up on upload import (`:1481`, `:1492`), example-book
    open (`:1584`), put-online re-key (`:830`, `:1696`).
  - `SETLIST_SUFFIX = '.setlist.md'` (`:79`); `LIST_SETLISTS` /
    `ADD_TO_SETLIST` handlers (`:1283-1345`) — the existing, non-index
    setlist listing (unchanged by this task).
- `app/src/songs/SearchScreen.jsx`
  - default export `SearchScreen` (`:358`), props at `:358-368` (`onOpenSong`
    default `:360`, `onAddToSetlist` default `:365`).
  - typed-query results map (`:526-538`) → `SongRow` (`:199-238`);
    `SongRow.onPress` opens via `onOpen({ bookId, path })` (`:217`); `Badges`
    (`:223`); Add-to-setlist trailing button (`:225-235`).
  - pre-typing `browse` grouping via `BookSection` (`:255`).
- The setlist-open destination already exists in the shell:
  `app/src/shell/AppShell.jsx` — `onOpenSetlist`/`setOpenSetlist`
  (`:336`, `:768-776`), already wired to `SetlistsScreen`
  (`SetlistsScreen.jsx:15,48`; AppShell `:214`). `SearchScreen` is mounted at
  `AppShell.jsx:190-200`.

Predecessor decisions carried forward (setlists.md):

- The setlist model is **consumed, not duplicated**: `parseSetlist(bytes) →
  { title, body, properties, diagnostics }` from the `cifra-md` package
  (`/home/ruoso/devel/cifra.md/js/src/setlist.js`). Only `model.title` is
  needed here.
- Setlist open/edit reuse the existing commands (`OPEN_SOURCE` / `WRITE` /
  `SAVE` / `DISCARD`); the view composes the model (setlists.md Decision 3).
  So a setlist edit already travels the WRITE/SAVE reindex seams.

## Constraints / requirements

- **Worker owns the index** (DIRECTION §3.7). All indexing, kind-tagging and
  reconcile changes land in `app/src/worker/`; the view reads the result
  slice through the store as it does today. The main thread never touches
  IndexedDB.
- **One index, one reconcile path.** Setlist entries live in the same
  `index_docs` / `index_locations` stores, flow through the same
  `{ putDocs, putLocations, deleteLocations }` change-sets, and are kept
  current by the same seams (`reindexPath` on WRITE, `reindexOrRemove` on
  SAVE, `reconcile`/`indexOneBook` on OPEN / upload import / put-online). No
  parallel index.
- **Correct parse per kind.** `indexDocument` / `reindexPath` / `songPaths` /
  `reconcile` must dispatch on file suffix: a `*.setlist.md` path is parsed
  with `parseSetlist` and indexed as `kind: 'setlist'` (title only); a
  `*.cifra.md` path stays `kind: 'song'` with the full field set. (Today a
  WRITE on a `*.setlist.md` path would mis-parse it as a song; this task's
  suffix dispatch makes the live edit path correct too, matching what
  `reconcile` enforces on reload.)
- **Marked by a word.** A setlist result is marked by the word "Setlist"
  (`docs/mockups/README.md:26` — status by word, never colour alone), carried
  as a localised string through the i18n catalogue like the existing badges.
- **Accessibility** (every UI task): the setlist result is a React Aria
  `Button`, reachable and operable by keyboard, with an accessible name that
  includes the title and that it is a setlist; axe clean at WCAG 2.1 AA on
  the results list and on the opened setlist. No colour-only signalling.
- **Search never shows a file name** (DIRECTION §4 L470): a setlist result
  shows its **title** and where it lives (book, and folder when not at the
  root), never `*.setlist.md`. A title-less setlist falls back exactly as a
  title-less song does (the existing `songTitle(title, path)` fallback,
  SearchScreen `:208`).
- **Canonical form, offline-first, no song text in logs, no book without an
  account** — unchanged and respected: no new persistence, no new network,
  no logging of titles or file bodies, and the index covers only books
  already on the shelf (every book needs a session already).
- **Fixtures use songs/setlists written for the purpose** — the shipped
  example book's `a-short-set.setlist.md` ("A Short Set",
  `app/example-book/a-short-set.setlist.md`) or purpose-written fixtures;
  never someone else's words.

## Acceptance criteria

### Behaviour delivered

1. A `*.setlist.md` file in any loaded book is indexed by its **title** and
   tagged `kind: 'setlist'`; a typed query in the one song search that
   matches the title returns the setlist among the results.
2. Each setlist result is **marked by the word "Setlist"**, shows its title
   and where it lives (book + folder, never the file name), and is **not**
   offered the Add-to-setlist action (that action is for songs). Opening it
   routes to the existing setlist view (via a new `onOpenSetlist` prop on
   `SearchScreen`, wired at `AppShell.jsx` to the same `setOpenSetlist` the
   Setlists destination uses), which "lists its songs" (workflow 12 L34).
3. Setlist entries are kept current through the **same reconcile seams** as
   songs: a newly saved setlist becomes findable, an edited one updates, a
   deleted/vanished one disappears, and an unsaved edit carries the existing
   unsaved word-badge (derived from HEAD as for songs). The pre-typing
   **browse** grouping stays songs-only (see Decision 4).

### Tests the task lands with, by level

Driven entirely by already-landed infrastructure (the index engine + fake
IndexedDB + local git remote from the index harness; `parseSetlist` from
`cifra-md`; the `SearchScreen` view; the example book's setlist; the shell's
`setOpenSetlist` destination). No prerequisite is missing.

- **unit** — `app/src/worker/search-index.test.js` (extend): a `*.setlist.md`
  path indexes as `kind: 'setlist'` with `title` from `parseSetlist` and no
  song-only fields; a `*.cifra.md` path stays `kind: 'song'`; a typed
  `search` returns both kinds with the kind tag on each row; `browse` returns
  songs only. Pins workflow 12 §The file L33-34 and the suffix/kind dispatch.
- **behavior (Worker index)** —
  `app/src/worker/search-index.behavior.test.js` (extend): over the full
  async path with a local git repo and fake IndexedDB — `reconcile` indexes
  a setlist file, a WRITE marks it unsaved and a SAVE clears it, a removed
  setlist drops from results, and `unsaved` is re-derived on a fresh
  (restarted) index. Pins the reconcile-on-save seam
  (`docs/DIRECTION.md:433-435`, workflow 12 L33-34).
- **behavior (React)** — `app/src/songs/SearchScreen.behavior.test.jsx`
  (extend): a setlist result row renders the word "Setlist", shows the title
  and location (not the file name), offers no Add-to-setlist button, and on
  press calls `onOpenSetlist` with `{ bookId, path }`; axe clean on the
  results list. Pins workflow 12 §The file L33-34, DIRECTION §4 L470, and
  `docs/mockups/README.md:26` (status by word).
- **e2e-web** — `e2e/web/tests/search.spec.js` (extend): on phone, tablet and
  computer viewports, type the setlist's title into the one song search, see
  it listed marked as a setlist, open it, and land on the setlist view that
  lists its songs; axe at WCAG 2.1 AA on the search results with a setlist
  present and on the opened setlist. Pins workflow 12 §The file L33-34 on the
  compose stack.

(The note's `Tests:` clause names behavior and e2e-web; the **unit** level is
added because the suffix/kind dispatch in `search-index.js` is a pure,
unit-testable branch and the index already has a unit suite — strengthening,
not dropping, a level.)

No test is deferred; there is no follow-up task. This closes the search
clause of workflow 12.

## Decisions

1. **One index, setlists tagged by `kind`; lift the `SONG_SUFFIX` gate.** The
   setlist index entry rides the existing `search-index.js` engine, stores
   (`index_docs` / `index_locations`), change-sets and reconcile seams; the
   location record and MiniSearch `storeFields` gain a `kind` field
   (`'song'` | `'setlist'`), and `songPaths` collects `*.setlist.md` too.
   *Rejected:* a separate setlist index — it would duplicate hydrate,
   reconcile, persist and the IndexedDB stores for no gain, and the one song
   search must return both kinds from one query anyway.

2. **Index the title only.** A setlist's indexable content is its H1 title
   (workflow 12 L24); it has no artist/sections/words/chords. `extractFields`
   branches on kind: a setlist yields `{ oid, title, kind: 'setlist' }`, the
   title indexed into the boosted `title` field. *Rejected:* also indexing
   the titles of the songs a setlist references — out of scope ("Index
   setlist **titles**"), and it would make a setlist match on songs it merely
   links, muddying results.

3. **Inject `parseSetlist`; dispatch by suffix.** `createSearchIndex` gains a
   `parseSetlist` injection beside `parse` (wired from `cifra-md` in
   `logic.js:496-505`), and `indexDocument` / `reindexPath` / `songPaths` /
   `reconcile` choose the parser and kind by file suffix. *Rationale:* mirrors
   the existing injected `parse` (keeps the engine testable with stubs), and
   makes the live WRITE/SAVE edit path parse a setlist correctly — matching
   what `reconcile` enforces on reload. *Rejected:* detecting kind by parse
   success — fragile and couples the index to parser internals.

4. **Typed search returns setlists; pre-typing browse stays songs-only.**
   Workflow 12 L33 says setlists are "found by the same search" — finding is
   the typed query, which now returns both kinds. The empty-query **browse**
   (songs grouped by book) stays songs-only, because the drawn **Setlists
   destination** that `books.setlists` built (Decision 8 there) is the
   at-rest setlist listing; duplicating setlists into browse would double the
   discovery surface the setlists task already decided. `browse` therefore
   filters to `kind === 'song'`. *Rejected:* listing setlists in browse too —
   redundant with the Setlists destination, and not what L33 ("found by …
   search") asks for.

5. **A distinct setlist row, routed to the existing open seam.** The results
   map renders a `kind: 'setlist'` row as a setlist (title + "Setlist"
   word-badge + location, no Add-to-setlist), opened through a new
   `onOpenSetlist` prop on `SearchScreen` wired at `AppShell.jsx:190` to the
   same `setOpenSetlist({ bookId, path })` the Setlists destination uses
   (`AppShell.jsx:214`, `:768-776`). *Rationale:* reuses the one setlist-open
   destination; no new screen or route. *Rejected:* overloading `onOpenSong`
   — it opens the reading view, which cannot render a setlist.

6. **No design delta.** Workflow 12 §The file L33-34 already designs this
   behaviour; DIRECTION §4's field enumeration describes the song case and is
   not contradicted by adding a title-indexed, kind-marked setlist result.
   The workflows are constitution alongside DIRECTION, so no document needs
   amending. *Rejected:* editing DIRECTION §4 to list setlists — it would
   restate a workflow decision without closing a gap.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-14.

- `app/src/worker/search-index.js` — added `SETLIST_SUFFIX` + `kindOf` suffix dispatch; `createSearchIndex` now accepts `parseSetlist`; `extractFromBytes`/`indexDocument` parse a `*.setlist.md` title-only as `kind:'setlist'`; `toMiniDoc`/`storeFields`/`toRow` carry `kind`; `songPaths` walks setlists too; `browse` filters to `kind:'song'`.
- `app/src/worker/logic.js` — `ensureSearchIndex` injects `parseSetlist` from `cifra-md`.
- `app/src/songs/SearchScreen.jsx` — new `SetlistRow` (title + "Setlist" word-badge + location, no Add-to-setlist) + `onOpenSetlist` prop; typed-query results map branches on `kind`.
- `app/src/shell/AppShell.jsx` — wires `onOpenSetlist={setOpenSetlist}` into `SearchScreen`.
- `app/src/theme/theme.css` — `.badge.setlist`; `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — `search.setlist` key.
- `app/src/worker/search-index.test.js` — unit: setlist indexes as `kind:'setlist'` title-only, song stays `kind:'song'`, typed search returns both tagged, browse songs-only, reconcile dispatches by suffix (15 tests total, all passed).
- `app/src/worker/search-index.behavior.test.js` — behavior (Worker): reconcile indexes a setlist, WRITE marks unsaved/SAVE clears, discard drops, unsaved re-derived across restart (13 tests total, all passed).
- `app/src/songs/SearchScreen.behavior.test.jsx` — behavior (React): setlist row marked "Setlist", title+location not file name, no Add-to-setlist, opens via `onOpenSetlist`, axe-clean (8 tests total, all passed).
- `e2e/web/tests/search.spec.js` — e2e-web: type "A Short Set", see it marked as setlist, open to setlist view listing its songs; axe on results + opened setlist on phone, tablet, and computer viewports (all passed).
