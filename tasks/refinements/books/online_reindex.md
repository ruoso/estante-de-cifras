# books.online_reindex — Reindex on put-online and on remove/delete

## TaskJuggler entry

Defined in [`tasks/65-books.tji`](../../65-books.tji):

```
task online_reindex "Reindex on put-online and on remove/delete" {
  effort 1d
  allocate team
  depends !online
  note "When put-online adopts the service id, drop the localId docs/locations
        from the search index and re-index the serviceId dir; drop stale index
        entries for a removed or deleted book. App work, Worker only. Source of
        debt: tasks/refinements/books/online.md (books.online). Governing:
        DIRECTION §3.7; storage.index. Tests: behavior (put-online then search
        finds the book by serviceId, not localId; remove then search finds no
        entries for that book)."
}
```

In plain language: `books.online` re-keys a book's on-disk directory and shelf
register from its `local-<uuid>` id to its service id when it goes online, and
deletes the on-disk directory when a book is removed or deleted — but it never
told the search index about any of it. This task closes that gap. On put-online,
drop the stale `localId` locations from the index and index the relocated
`serviceId` directory; on remove and delete, drop the book's index entries.

## Effort estimate

**1d** (as scoped in the `.tji`), allocated `team`. The day is: a new
book-level `removeBook(bookId)` on the index module; three handler extensions in
the Worker's command loop (`PUT_ONLINE`, `REMOVE_BOOK`, `DELETE_BOOK`); clearing
the stale per-book build-status slice entry through the existing event; and the
named unit + behavior tests. No UI, no service, no format work.

## Repository

**estante-de-cifras only**, `app/` — Worker only. The files touched are
`app/src/worker/search-index.js`, `app/src/worker/logic.js`, and their test
files `app/src/worker/search-index.test.js` and
`app/src/worker/online.behavior.test.js`. No `app/src/books/` (view) change — the
index is invisible to the view except through slices the reducer already
surfaces. No cifra.md change: the format is untouched. No service change.

## Inherited dependencies

- **`books.online`** (`!online`) — **settled.** Done; it built put-online,
  download, remove and delete. The seams this task extends:
  - `app/src/worker/online.js` `putOnline({ localId, title })` (online.js:161-188)
    creates the service book, then under the book's lock copies the working tree
    from `bookDir(localId)` to `bookDir(serviceId)` and **removes**
    `bookDir(localId)` (online.js:170-174), sets the remote and pushes. `remove({ bookId })`
    (online.js:231-233) and `deleteBook({ bookId })` (online.js:245-248)
    `removeTree(bookDir(bookId))` the local clone.
  - `app/src/worker/logic.js` handlers: `PUT_ONLINE` (logic.js:1248-1317) migrates
    the shelf register `shelf.local[device][localId]` → `shelf.books[serviceId]`
    and emits `BOOK_ONLINE { previousBookId: localId, bookId: serviceId }`
    (logic.js:1311); `REMOVE_BOOK` (logic.js:1328-1356) and `DELETE_BOOK`
    (logic.js:1358-1384) tombstone the shelf and emit `BOOK_REMOVED { bookId }`
    (logic.js:1355, logic.js:1382). **None of the three touches the index.** This is
    the debt, named in [`books/online.md`](online.md) only implicitly: online.md
    re-keys the directory and the shelf (Decision 3) but is silent on the index
    keyed by the same id.
- **`storage.index`** — **settled** (Done 2026-10-05, `complete 100`). It built
  the index module and its Worker wiring, described in
  [`storage/index.md`](../storage/index.md). This task reuses that machinery
  rather than adding new index infrastructure; see Inputs / context. (It is not
  in `depends` because it is already `complete 100` — its code is on disk and
  scheduling is satisfied — but it governs this task.)

No pending dependencies. The two behavior scenarios the note names are both
drivable today: a device putting its own local book online, and removing or
deleting it, are exactly what `books.online` delivered and what
`online.behavior.test.js` already drives; indexing a book and searching it are
what `storage.index` delivered.

## What this task is

The Web Worker owns the search index (DIRECTION §3.7). The index stores one
**location** per book-file pair, keyed by `<bookId>\0<path>`
(search-index.js:67), plus a content-addressed **doc** cache keyed by git blob
oid. The `bookId` in a location key is simply the directory segment under
`/books/` — the book's current on-device id.

`books.online` changes that id in three places without telling the index:

1. **Put-online** relocates the working copy from `bookDir(localId)` to
   `bookDir(serviceId)` and removes the old directory. Afterward the index still
   holds `localId\0path` locations pointing at files that no longer exist, and
   the `serviceId` tree is unindexed until the next full OPEN sweep (which keys
   off `/books`, so the live session's search is stale until a reload).
2. **Remove from my shelf** deletes `bookDir(bookId)`. The book's locations are
   left orphaned — searchable rows for a book the device no longer has.
3. **Delete the book** likewise deletes the local clone, leaving orphaned
   locations.

This task makes the three handlers keep the index in step, mirroring the
per-file pattern `DELETE_FILE` already uses (logic.js:1042-1054,
`reindexOrRemove` → `removePath` on ENOENT) but at **book** scope.

## Why it needs to be done

Search is the app's primary way into a loaded book (DIRECTION §4: "One search
across every loaded book"). After a user puts a book online — the first thing
many do after creating it — the live session's search would miss the book
entirely (its `serviceId` tree is unindexed) or, worse, return results pointing
at a `localId\0path` location whose file is gone, yielding a broken open. After
removing or deleting a book, search would surface a book the device no longer
holds. The debt is invisible on a page reload (the OPEN sweep rebuilds from
`/books`) but live-wrong within the session — exactly the "a merge landing is a
message, and only what shows it moves" expectation of DIRECTION §3.7. This task
is small and self-contained: it has no downstream dependents; it is a correctness
patch over `books.online`.

## Inputs / context

- **DIRECTION §3.7** (`docs/DIRECTION.md:418-425`): "**One owner for the data: a
  Web Worker.** It holds git, the working copy and the search index, and does
  every clone, fetch, merge, save and index update. The main thread never
  touches IndexedDB." All work here is inside `app/src/worker/`; the view is
  not touched.
- **DIRECTION §4** (`docs/DIRECTION.md:449-453`): search is one accent-insensitive
  query across every loaded book — the behavior that goes stale without this fix.
- **`storage.index`** refinement ([`storage/index.md`](../storage/index.md)) and
  its implementation:
  - `app/src/worker/search-index.js` — `createSearchIndex({ fs, git, parse,
    readHeadOids })` (search-index.js:184) returns `{ hydrate, indexDocument,
    reindexPath, removePath, reconcile, search, browse }` (search-index.js:537).
    - `locationKey = (bookId, path) => `${bookId}\0${path}`` (search-index.js:67);
      the in-memory `locationByKey` Map (search-index.js:198) holds every
      location; `mini` is the MiniSearch instance.
    - `removePath({ bookId, path })` (search-index.js:306) discards **one**
      location (`mini.discard(key)`, `locationByKey.delete(key)`), returns
      `{ putDocs: [], putLocations: [], deleteLocations: [key] }`, and **leaves
      the content-addressed doc cache intact**.
    - `reconcile(bookId)` (search-index.js:364) walks `songPaths(bookId)` under
      `bookDir(bookId)`, re-derives `unsaved` from HEAD oids, re-parses only on a
      changed oid, and drops locations whose files vanished (search-index.js:397-401).
      `songPaths` returns `[]` on ENOENT (search-index.js:322-324).
  - `app/src/worker/logic.js` index wiring to reuse:
    - `ensureSearchIndex()` (logic.js:470-479), `ensureIndexHydrated()`
      (logic.js:583-592), `persistIndexChanges(changes)` (logic.js:595-597) →
      `applyIndexChanges` one readwrite tx over both stores.
    - `indexOneBook(bookId)` (logic.js:651-658): emits `INDEX_STATUS building`,
      `reconcile(bookId)`, persists, emits `INDEX_STATUS ready` — the exact helper
      to index the relocated `serviceId` tree.
    - `reindexOrRemove` (logic.js:603-614) and the `DELETE_FILE` handler
      (logic.js:1042-1054) — the per-file precedent to mirror at book scope.
  - `app/src/worker/reducer.js` — the `index` slice (reducer.js:80) is keyed by
    `bookId`; `INDEX_STATUS` sets `index: { ...state.index, [bookId]: state ?? null }`
    (reducer.js:336-344). An `INDEX_STATUS { bookId, state: null }` nulls a book's
    entry with no reducer change.
- **`books.online`** seams enumerated under Inherited dependencies
  (`online.js:161-188, 231-248`; `logic.js:1248-1384`).
- **Tests** to extend: `app/src/worker/search-index.behavior.test.js` and
  `app/src/worker/search-index.test.js` (unit; `createSearchIndex` with a stub
  `readHeadOids`); `app/src/worker/online.behavior.test.js` (drives
  `PUT_ONLINE`/`REMOVE_BOOK`/`DELETE_BOOK` against a real `startGitHttpRemote()`
  with an injected `/api/books` `fetch` double; `fake-indexeddb`,
  `installWebLocks()`, `createFileSystem`, a loopback store).

## Constraints / requirements

- **Worker only.** All changes live in `app/src/worker/`. The main thread never
  touches IndexedDB; the view learns nothing new (DIRECTION §3.7). No new
  protocol command or event kind is required — the handlers already own the ids
  they need (`BOOK_ONLINE` carries `previousBookId` and `bookId`; `BOOK_REMOVED`
  carries `bookId`).
- **Drop locations, not docs.** The content-addressed doc cache is keyed by blob
  oid and **shared across books** (the same song in two books is one doc). On
  put-online the relocated `serviceId` files carry the same oids, so the docs
  must survive the rename and be reused — re-parsing is both wasted work and a
  content-addressing violation. On remove/delete, a dropped book's doc may still
  be referenced by another book's location. So this task drops **locations**
  only, exactly as `removePath` and `reconcile` already do; it never drops docs.
- **Book-level drop, order-independent.** The drop of a book's locations must not
  depend on the directory already being gone. Put-online's `putOnline` removes
  `bookDir(localId)` before the handler regains control, but the remove/delete
  handlers call the online op and then the index drop; the index API must drop a
  book's locations from the in-memory map directly, not by walking a (now empty)
  directory.
- **Index stays consistent across a live session.** After each handler the
  in-memory MiniSearch instance and both IndexedDB stores
  (`index_docs`, `index_locations`) agree, through `persistIndexChanges`, so a
  subsequent `SEARCH` in the same session is correct without a reload.
- **Standing rules.** No song text in logs — these handlers log nothing new.
  Offline-first — put-online already handles a failed push by leaving the sync
  engine to retry; the index drop/reindex is local and does not wait on the
  network. No book without an account, canonical form, accessibility — untouched
  (no UI, no new served content).

## Acceptance criteria

### Behavior delivered

1. **A book-level location drop.** `search-index.js` gains `removeBook(bookId)`
   (a sibling of `removePath`): it discards from `mini` and deletes from
   `locationByKey` **every** location whose `bookId` matches, and returns
   `{ putDocs: [], putLocations: [], deleteLocations: [...keys] }`. It leaves the
   content-addressed doc cache intact and leaves other books' locations
   untouched. It is added to the module's returned object (search-index.js:537).
2. **Put-online re-indexes under the service id.** The `PUT_ONLINE` handler
   (logic.js:1248-1317), after `putOnline` returns and the shelf register
   migrates, under the book's existing lock: `ensureIndexHydrated()`, then
   `persistIndexChanges(removeBook(localId))` to drop the stale `localId`
   locations, then `indexOneBook(serviceId)` to index the relocated tree. Because
   docs are oid-keyed, `indexOneBook(serviceId)` reuses the cache with **no
   re-parse**. The stale `index` build-status entry for `localId` is nulled via
   `INDEX_STATUS { bookId: localId, state: null }`. All of this precedes the
   existing `BOOK_ONLINE` emit so the view's next read is already consistent.
3. **Remove drops the book's index entries.** The `REMOVE_BOOK` handler
   (logic.js:1328-1356), after `online.remove` deletes the local clone and the
   shelf is tombstoned, calls `persistIndexChanges(removeBook(bookId))` and nulls
   the book's `index` build-status entry, before the existing `BOOK_REMOVED` emit.
4. **Delete drops the book's index entries.** The `DELETE_BOOK` handler
   (logic.js:1358-1384) does the same as (3) after `online.deleteBook`.

In all cases a `SEARCH` issued in the same session afterward reflects reality:
the book is findable under `serviceId` and not under `localId` (2); not findable
at all after remove or delete (3, 4).

### Tests, by level

The `.tji` note names **behavior** for the two journeys. It is kept in full and
sharpened to named files and cases; a **unit** level is added for the new pure
`removeBook` method (a new function gets a unit test — proportionate per the
testing policy, not a substitute for the behavior cases). No e2e level: this is
an invisible-to-the-view Worker correctness patch with no screen of its own; the
put-online / remove / delete journeys already have their e2e-web coverage in
`books.online` (`e2e/web/tests/online.spec.js`), and adding a search assertion
there would pin nothing this behavior suite does not pin more cheaply.

- **unit — `app/src/worker/search-index.test.js`:** `removeBook(bookId)` discards
  every location for that book and returns them all in `deleteLocations`; leaves
  a second book's locations present; leaves the content-addressed doc cache
  intact (a later `indexDocument` of the same oid does not re-parse). Pins the
  location-keying model of `storage.index` (Decision 3) and the drop-locations-not-docs
  constraint.
- **behavior (Worker) — `app/src/worker/online.behavior.test.js`:**
  - *put-online re-indexes under the service id* — seed a purpose-written song in
    a local book (via the Worker's existing save/write path), build the index,
    confirm `SEARCH` finds it; send `PUT_ONLINE` (injected `/api/books` returns a
    `serviceId`); after `BOOK_ONLINE`, `SEARCH` for the same term returns a result
    whose location `bookId` is the `serviceId` and **none** under the `localId`;
    the `parseSpy` shows no re-parse across the rename (docs carried over by oid);
    the `index` slice no longer carries a live entry for `localId`. Pins the
    note's "put-online then search finds the book by serviceId, not localId",
    DIRECTION §3.7 (Worker owns the index), and `storage.index` content-addressing.
  - *remove drops the book's index entries* — seed + build + `SEARCH` finds the
    song; send `REMOVE_BOOK`; after `BOOK_REMOVED`, `SEARCH` for the term returns
    no result for that book and the `index` slice carries no live entry for it.
    Pins the note's "remove then search finds no entries for that book".
  - *delete drops the book's index entries* — same as remove but `DELETE_BOOK`
    (injected `DELETE /api/books/{id}`), for an owned book. Pins the same note
    clause for the delete path.

Fixtures are songs written for the purpose, never anyone's copyrighted words.
The closer confirms every named test above exists and ran — not skipped — in the
gate's output.

No tech-debt is deferred: this task delivers its behavior and its tests in full.

## Decisions

1. **Add `removeBook(bookId)` rather than reuse `reconcile(bookId)` after the
   directory is gone.** *Chosen* because it is explicit, order-independent and
   book-scoped, mirroring the per-file `removePath`; it drops locations directly
   from `locationByKey`/`mini` without any disk walk. *Rejected:* calling
   `reconcile(bookId)` once `bookDir(bookId)` is deleted — `songPaths` returns
   `[]` on ENOENT (search-index.js:322-324) and `reconcile` then drops every
   location, so it would *work*, but only as a side-effect of deletion ordering,
   and it does wasted hashing of an empty present-set. A named method the three
   handlers call is clearer and testable in isolation.
2. **Drop locations only; never drop docs.** *Chosen* because the doc cache is
   content-addressed by blob oid and shared across books: on put-online the
   `serviceId` files reuse the `localId` files' oids (so the rename must keep
   them — and `indexOneBook(serviceId)` then re-parses nothing), and on
   remove/delete a doc may still back another book's location. This matches
   `removePath`'s existing "leaves the doc cache intact" behavior. *Rejected:*
   dropping the book's docs too — it would re-parse every song after a put-online
   and risk removing a doc another book still references.
3. **Re-index `serviceId` with the existing `indexOneBook`, not a bespoke pass.**
   *Chosen* because `indexOneBook` already emits `INDEX_STATUS building`,
   reconciles the tree, persists and emits `ready` (logic.js:651-658) — exactly
   the per-book index build this needs, and content-addressing means the carried-over
   docs are not re-parsed. *Rejected:* a new relocation-specific routine — it
   would duplicate `indexOneBook` for no gain.
4. **Null the stale build-status slice entry through the existing `INDEX_STATUS`
   event; add no new event or reducer branch.** *Chosen* because the reducer
   already maps `INDEX_STATUS { bookId, state }` to `index[bookId] = state ?? null`
   (reducer.js:336-344), so `state: null` clears a book's entry with zero
   protocol or reducer change, and a null entry is display-equivalent to an
   absent one (the view keys status off the shelf's books, which already drop the
   old id). *Rejected:* a new `INDEX_STATUS 'gone'` state plus a reducer branch
   that deletes the key — tidier storage, but it widens the protocol for a
   cosmetic difference; the null entry count is bounded by books ever on the
   device.
5. **No design delta.** *Chosen* because every change — a sibling index method, a
   reuse of `indexOneBook`, a reuse of `INDEX_STATUS`, three handler extensions —
   is implementation within the seams DIRECTION §3.7 and `storage.index` already
   define. No new runtime dependency, no new architectural seam, no deviation
   from what DIRECTION or a workflow says the app does, no format change.
   *Rejected:* amending DIRECTION §3.7 to describe reindex-on-id-change — it
   already says the Worker "does every … index update"; this task simply honors
   it at the put-online/remove/delete sites.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-08.

- `app/src/worker/search-index.js`: new `removeBook(bookId)` method — discards every location for the book from `locationByKey` and `mini`, returns `deleteLocations`, leaves the oid-keyed doc cache intact; exported from the module's returned object.
- `app/src/worker/logic.js`: `PUT_ONLINE` handler now calls `ensureIndexHydrated()`, `persistIndexChanges(removeBook(localId))`, `indexOneBook(serviceId)`, and emits `INDEX_STATUS { bookId: localId, state: null }` before the existing `BOOK_ONLINE` emit; `REMOVE_BOOK` and `DELETE_BOOK` handlers each call `persistIndexChanges(removeBook(bookId))` and emit `INDEX_STATUS { bookId, state: null }` before their existing `BOOK_REMOVED` emit.
- `app/src/worker/search-index.test.js`: unit suite for `removeBook` — discards all locations for the book; returns them in `deleteLocations`; leaves a second book's locations present; leaves the doc cache intact (no re-parse on same-oid re-index); no-op for a book with no locations.
- `app/src/worker/online.behavior.test.js`: three new behavior cases — put-online re-indexes under `serviceId` not `localId` with no re-parse (parseSpy confirms); remove drops the book's index entries; delete drops the book's index entries.
