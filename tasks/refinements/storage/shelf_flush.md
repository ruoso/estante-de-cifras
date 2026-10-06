# storage.shelf_flush — Flush the fs superblock after shelf-mutating command handlers

## TaskJuggler entry

`tasks/40-storage.tji`, `task storage.shelf_flush "Flush the fs superblock after shelf-mutating command handlers"`:

> "OPEN_EXAMPLE_BOOK, RENAME_BOOK, and other command handlers that persist a home-book shelf write via home.set have no handler-tail await fs.flush(). An immediate reload after any of these can lose the shelf change (the home-book.js writes never flush on their own). Fix: a handler-tail await ensureFs().flush() on each affected handler in logic.js, mirroring the CREATE_BOOK fix from storage.fs_flush. Source of debt: tasks/refinements/storage/fs_flush.md (storage.fs_flush), Deferred-work section. Tests: unit (none — no isolatable pure logic); behavior (open-example then fresh-instance reload keeps the shelf entry; rename then fresh-instance reload keeps the new label)."

`depends !fs_flush`.

## Effort estimate

**0.5d** (as scoped in the `.tji`), allocated `team`. Two call-site additions (one per affected handler) plus two cold-open reload tests; no new module, no new seam, no protocol change, no UI — the smaller twin of [`storage.fs_flush`](fs_flush.md).

## Repository

**estante-de-cifras** only. All code is app-side, framework-free, below the view: the production change is in `app/src/worker/logic.js`; the tests are co-located behavior suites (`app/src/worker/example-book.behavior.test.js`, `app/src/worker/books.behavior.test.js`), driven by the Worker rig under `app/src/test/`. This is **not** a `cifra.md:` task — the note does not start with `cifra.md:`, and nothing in the sibling `/home/ruoso/devel/cifra.md` repo changes. The app and the service share no code, only the HTTP API and the format (DIRECTION §3.6). The code is plain JS; contracts are JSDoc `@typedef`s, matching every sibling in `app/src/worker/`.

## Inherited dependencies

- **storage.fs_flush** — *settled, Done 2026-10-06* ([`fs_flush.md`](fs_flush.md)), the **source of debt** (`fs_flush.md` §Deferred work, L99–101). It established the exact pattern this task completes: a handler-tail `await ensureFs().flush()` at the end of the CREATE_BOOK handler (`logic.js:781`), after `home.set`/`surfaceHomeBookShelf`, forcing out the one filesystem-global superblock so an immediate reload finds both the new book's repo *and* its shelf entry. It explicitly deferred the **other** shelf-mutating handlers — `OPEN_EXAMPLE_BOOK` and `RENAME_BOOK` — to this leaf, and registered it `depends !fs_flush`, M2. Every design decision this task leans on (the flush seam is fs.md Decision 6; one global superblock covers all books; the flush needs no lock; cold-open reads prove durability) is settled there and re-cited, not re-argued, below.
- **storage.fs** — *settled, Done 2026-10-05* ([`fs.md`](fs.md)). The `flush()` seam: `createFileSystem(name, { indexedDB }) → { promises, flush }` (`app/src/worker/fs.js:154–173`), where `flush: () => source.flush()` forces lightning-fs's debounced superblock (inode-table) save immediately. `flush` sits **beside** `promises`, off the isomorphic-git `fs.promises` contract (fs.md Decision 6). One `createFileSystem` instance serves the whole Worker; every book, and the home book, is a directory within it, so there is **one superblock for all of them** — the property that makes a single handler-tail flush sufficient.
- **storage.home_book** — *settled, Done 2026-10-05* ([`home_book.md`](home_book.md)). `createHomeBook({ fs, git, locks }).set({ bookId, file, changes, author })` (`app/src/worker/home-book.js:213–232`) reads → applies register changes → writes the file back in canonical form → `add` → `commit`, all inside **one** `withLock` on the home book's id. It **does not flush on its own** (confirmed: no `flush` call in `set`, `home-book.js:213–232`) — the fact the whole task turns on. The shelf write every affected handler performs goes through this `set`.
- **storage.shelf_surface** — *settled, Done 2026-10-05* ([`shelf_surface.md`](shelf_surface.md)). `surfaceHomeBookShelf()` (`logic.js:497–509`) re-reads `shelf.json` and emits SHELF; each affected handler calls it after `home.set`. It is a read + postMessage, not a filesystem write, so it does not flush and is not the fix; the flush lands *after* it (handler tail), mirroring CREATE_BOOK.
- **books.shelf** / **example-book seed** — *settled, Done.* `OPEN_EXAMPLE_BOOK` seeds the bundled repo through `ensureExampleBook().seed({ author })`, which flushes its **own** repo at the tail of the seed (`example-book.js:127`). That flush runs **before** the handler's `home.set` shelf write (seed at `logic.js:799`, `home.set` at `:811`), so it does **not** cover the shelf write — exactly the gap this task closes (Decision 2).

Transitively **foundation.app_tooling** (Vitest, `fake-indexeddb`, the gate) and the settled storage stack. Nothing pending blocks this task — its only dependency, `storage.fs_flush`, is Done, and every handler and seam it touches already ships in the tree. It is a remaining `storage.*` leaf **M2 (`m2_local`)** waits on (`tasks/99-milestones.tji`); nothing downstream depends on it beyond M2's completeness.

## What this task is

The second half of the durability fix `storage.fs_flush` began. lightning-fs writes each file's **bytes** on `writeFile`, but the **inode table** (the path-to-inode map, "the superblock") that lets a fresh instance find and resolve those bytes is persisted on a 500 ms debounce (`fs.js:44–52`). A tab closed — or reloaded — inside that window keeps the bytes but loses or staled the map, so the next cold open reads the old shelf (or `ENOENT`). `storage.fs_flush` added a handler-tail `await ensureFs().flush()` to CREATE_BOOK. This task adds the **same one line** to the two other command handlers that persist a home-book shelf write through `home.set` and do not flush:

1. **`OPEN_EXAMPLE_BOOK`** (`logic.js:785–823`) — after `surfaceHomeBookShelf()` (and after `indexOneBook`), so the shelf entry written at `:811–819` is durable even though `example.seed`'s own flush (`example-book.js:127`) ran *before* that write.
2. **`RENAME_BOOK`** (`logic.js:825–848`) — after `surfaceHomeBookShelf()`, so the renamed `title`/`label` register written at `:841–846` is durable.

No other command handler needs it today: CREATE_BOOK already flushes (`:781`); `SYNC_HOME` writes through `home.sync`, not `home.set`, and is out of scope (Decision 3); `RECORD_RECENT` touches device-local recents, not the home book (`logic.js:718–727`); and no reorder/remove-book handler exists in `logic.js` yet (workflow 7 §Removing a book is unbuilt) — when one lands it carries its own flush, not a successor to this task. No new module, no new seam, no protocol change, no UI.

## Why it needs to be done

Without it, the storage promise — "written to storage as they type, so closing the tab loses nothing" (DIRECTION §3, `docs/DIRECTION.md:108–110`) — holds for a created book (fixed in `storage.fs_flush`) but not for the two other shelf mutations a user performs and expects to stick: **opening the example book** (workflow 1 §Cold — the first thing a cold-start user is offered) and **renaming a book on the shelf** (workflow 7 L16–18). Each writes only to the home book's `shelf.json` through `home.set`, which does not flush; with no later global-flushing operation to ride on, an immediate reload reads the stale superblock and the book is missing from the shelf, or still shows its old name. `storage.fs_flush` noted precisely this: the example book's incidental survival in the editor e2e rode on a *later* `WRITE` flush, not on anything the open itself did. This task removes that reliance on luck. It belongs to milestone **M2 (`m2_local`)** — "a songbook on one device: find, read, write, edit… installed and offline".

## Inputs / context

### Governing design

- **DIRECTION §3 — Storage in the browser** (`docs/DIRECTION.md:104–115`): each book is a git repository on IndexedDB operated in a Web Worker (L105–106); "written to storage as they type, so closing the tab loses nothing" (L108–110). The home book, and its `shelf.json`, live in the same store; the durability promise covers the shelf, not only song files.
- **DIRECTION §3.7 — The app**: the Worker owns the data; the main thread never touches IndexedDB. The flush is Worker-internal and invisible to the view.
- **Workflow 1 — First run** (`docs/workflows/01-first-run.md`), §Cold (L18–33): "*open the example book* puts it on the shelf as a local book" (L30–31) — the OPEN_EXAMPLE_BOOK path whose shelf entry this task makes durable.
- **Workflow 7 — Add a book** (`docs/workflows/07-add-a-book.md`), §The book-management screen (L16–18): a renamed book is "a label kept in the home book that changes nothing in the repository" — the RENAME_BOOK path. §Removing a book (L128) is not yet built (no handler), so nothing to fix there now.
- **home-book-format §4.2** (`docs/home-book-format.md`) — the `shelf.json` shape (`local.<deviceId>.<bookId>.{ title, position }`, shared books' `books.<bookId>.label`) the tests assert against; cited by the existing example-book/books behavior suites.

### The code seams this extends

- **The flush seam** — `app/src/worker/fs.js:154–173`. `createFileSystem` returns `{ promises, flush }`; `flush()` runs lightning-fs's debounced `saveSuperblock` (`fs.js:92–94`) immediately. `flush` is deliberately off the `promises` surface (fs.md Decision 6).
- **`logic.js` — the two handlers.**
  - `OPEN_EXAMPLE_BOOK` (`:785–823`): `home.ensureLocal` → `example.seed` (`:799`, flushes its own repo at `example-book.js:127`) → `home.ensureDeviceId` → `home.read` → `home.set` (the shelf write, `:811–819`) → `surfaceHomeBookShelf()` (`:820`) → `indexOneBook(exampleId)` (`:821`) → `BOOK_CREATED`. **No flush today.** The new `await ensureFs().flush()` lands at the handler tail, after `:821`.
  - `RENAME_BOOK` (`:825–848`): `home.ensureLocal` → `home.ensureDeviceId` → `home.read` → compute `local.…title` vs `books.…label` (`:838–840`) → `home.set` (`:841–846`) → `surfaceHomeBookShelf()` (`:847`). **No flush today.** The new flush lands at the handler tail, after `:847`.
  - For reference, the settled precedent: CREATE_BOOK's `await ensureFs().flush()` at `:781`, with the comment block `:775–780` naming the decisions this task reuses.
- **`home-book.js`** — `set` (`:213–232`): `writeFile` (`:222`) + `gitCommit` (`:229`), inside `withLock`; no flush.
- **The Worker behavior rigs.**
  - `example-book.behavior.test.js` `makeWorker(label)` (`:40–60`) returns `{ idb, name, fs, git, deviceId, events, send, fetchCalls, readHomeFile }` — `idb` and `name` already exposed, so a cold-open fresh instance is buildable without a rig change; `readHomeFile` reads through the **live** `fs` (so it is not a cold-open proof — Decision 4).
  - `books.behavior.test.js` `makeWorker(label)` (`:60–81`) returns the same shape, and already contains the fs_flush CREATE_BOOK cold-reopen test (`:139–179`) — the exact template: `const freshFs = createFileSystem(`${w.name}-fs`, { indexedDB: w.idb })`; `const freshGit = createGitLayer({ fs: freshFs, … })`; then read `shelf.json` from `freshFs`. It also has the existing live-window RENAME tests (`:200`, `:238`) this task's cold-reopen case extends.
- **Signatures** — `createFileSystem(name, { indexedDB }) → { promises, flush }`; `createGitLayer({ fs, http }) → { init, clone, fetch, push, bookDir }`, `bookDir(id) = /books/<id>` (home book at `bookDir(HOME_BOOK_ID)`).

## Constraints / requirements

- **The Worker owns the data; the fix is invisible above the view.** `flush()` is called only inside the Worker; no protocol message, slice, reducer or view changes (DIRECTION §3.7). *Central.*
- **Handler-tail flush, after the lock has released.** Each affected handler's `home.set` already ran inside `home-book.js`'s own `withLock`; the new flush runs *after* that handler-level step returns (same position as CREATE_BOOK's `:781`). It takes **no lock** — it mutates no working tree, it only forces the already-written superblock out, so its only ordering requirement is to run after the write it must persist (locks.md Decision 1; fs_flush.md Decision 4). *Central.*
- **One flush per handler suffices, because the superblock is filesystem-global.** One `createFileSystem` instance; one inode table covering the home book and every book. `writeFile` persisted the bytes synchronously; only the shared inode table is debounced. So one `await ensureFs().flush()` at a handler's tail forces out all its pending inodes — the shelf write included (fs_flush.md Decision 3). *Central.*
- **Offline-first.** The flush persists local state only; it never waits on or implies a network. OPEN_EXAMPLE_BOOK and RENAME_BOOK are already local/no-push (`logic.js` comments `:786–794`, `:826–831`); the flush does not change that. *Applies.*
- **Canonical form over preserving content** is untouched: `home.set` already writes `shelf.json` in canonical form before committing (`home-book.js:218–222`); the flush only follows a write that already happened. *Applies.*
- **No song text, titles or secrets in logs.** `flush()` logs nothing and the fix adds no logging. Fixtures are purpose-written songs and labels. *Applies.*
- **No new runtime dependency, no new seam, no design delta.** The `flush()` seam is fs.md Decision 6, already shipped; this task adds two call sites only (Decision 1). *Applies.*

## Acceptance criteria

### Behavior delivered

1. **Opening the example book survives an immediate cold reload, with its shelf entry.** After `OPEN_EXAMPLE_BOOK` finishes, one `await ensureFs().flush()` at the handler tail has persisted the home-book `shelf.json` write (the example repo itself was already flushed by `seed`). A fresh `createFileSystem` over the same backing store — the cold open a reloaded tab performs — reads `shelf.json` and finds the example book listed under `local.<deviceId>.<exampleId>` with its label; the book is not seeded-but-orphaned off the shelf. *Pins workflow 1 §Cold (L30–31); DIRECTION §3 L108–110; home-book-format §4.2; the note's first behavior case.*
2. **Renaming a book survives an immediate cold reload.** After `RENAME_BOOK` finishes, the handler-tail flush has persisted the `shelf.json` register change. A fresh instance reads back the **new** name — a local book's `local.<deviceId>.<bookId>.title`, a shared book's `books.<bookId>.label` — not the old one. *Pins workflow 7 L16–18; the note's second behavior case.*

No change to `protocol.js`, `reducer.js`, any slice, or any screen.

### Tests the task lands with, by level

Per the `.tji` note: **unit (none)**, **behavior (two cases)**. Fixtures are purpose-written songs and labels, never anyone's copyrighted words. Conventions: plain JS, co-located; `*.behavior.test.js` for the behavior level; `fake-indexeddb` imported per-file; `scripts/gate` runs `vitest run`.

- **unit — none.** The change is two one-line `await ensureFs().flush()` call-site additions; there is no new pure module or branchable logic to isolate (the note says so, matching `storage.fs_flush`). Documented here so the closer does not expect a unit file. *(Justified under the testing policy: no isolatable pure logic.)*
- **behavior — `app/src/worker/example-book.behavior.test.js`** (`makeWorker` rig: `new IDBFactory()`, `installWebLocks()`, offline `spyFetch`, no remote, a local home book):
  - *OPEN_EXAMPLE_BOOK then an immediate cold reopen keeps the shelf entry* — `send(command(CommandKind.OPEN_EXAMPLE_BOOK, { title, author }))`, await `BOOK_CREATED`; then build a **fresh** `createFileSystem(`${name}-fs`, { indexedDB: idb })` (+ `createGitLayer`) over the same `(idb, name)` and assert, reading through the fresh instance, that `shelf.json` lists the example book under `local.<deviceId>.<exampleId>` with its label. A real regression guard: the in-test synchronous turn never fires the 500 ms debounce and `seed`'s flush ran before the shelf write, so without the handler-tail flush the fresh instance reads a stale/absent shelf entry and the assertion fails. *Pins workflow 1 §Cold, home-book-format §4.2, the note's first behavior case; extends the existing live-window shelf assertion at `example-book.behavior.test.js:91–95`.*
- **behavior — `app/src/worker/books.behavior.test.js`** (same rig; the fs_flush CREATE_BOOK cold-reopen test at `:139–179` is the template):
  - *RENAME_BOOK then an immediate cold reopen keeps the new label* — create a local book, await `BOOK_CREATED`; `send(command(CommandKind.RENAME_BOOK, { bookId, name: 'Quinta', author }))`; then a **fresh** `createFileSystem`+`createGitLayer` reads `shelf.json` and sees `local.<deviceId>.<bookId>.title === 'Quinta'`. Add a shared-book variant asserting `books.<bookId>.label` survives (mirroring the live-window shared-rename test at `:238`). Same debounce logic makes it a real guard: remove the flush and the fresh instance reads the old name. *Pins workflow 7 L16–18, the note's second behavior case; extends the existing live-window rename assertions at `books.behavior.test.js:200,238`.*

Both cases read through a **fresh** `createFileSystem`, never the live `readHomeFile` window — the live window sees the in-memory superblock and would pass with or without the flush, proving nothing (fs_flush.md Decision 5; Decision 4 below). The closer confirms both ran (not skipped) in the gate before committing.

### Why no e2e-web / e2e-api / axe / unit here

The `.tji` names only behavior. Nothing visual or networked ships — this is a Worker-internal durability fix with no new screen (no axe), no endpoint (no e2e-api), and no isolatable pure logic (no unit). The integration-level manifestation (a reload losing a just-opened/renamed book) would also surface in the app's reload-bearing Playwright journeys, but this task pins the fault at the Worker boundary where it lives, at the proportionate behavior level with a cold-open fresh-instance assertion — the same posture `storage.fs_flush` took.

### Deferred work

(none) — this task *is* the deferred follow-up `storage.fs_flush` registered. It completes the handler-flush coverage: CREATE_BOOK (done in fs_flush), OPEN_EXAMPLE_BOOK and RENAME_BOOK (here). No reorder/remove-book handler exists in `logic.js` today; when workflow 7 §Removing a book is built, that task carries its own handler-tail flush as part of its definition of done (it is not a successor audit of this one). `SYNC_HOME`'s home-book durability is a distinct concern, addressed under Decision 3 rather than deferred.

## Decisions

1. **Reuse the `fs.flush()` seam (fs.md Decision 6) and the CREATE_BOOK pattern (fs_flush.md); add only the two missing call sites — no new mechanism, no design delta.** The seam and the handler-tail shape already ship (`logic.js:781`). This task extends the identical one-line `await ensureFs().flush()` to OPEN_EXAMPLE_BOOK and RENAME_BOOK. Because it changes no designed behavior, adds no dependency and invents no seam, it needs no edit to DIRECTION or a workflow. *Rejected:* flushing inside `home-book.js`'s `set` so every caller is covered automatically — tempting, but it couples a durability policy to every home-book write (preferences, recents-era writes, sync's own commits), flushing on paths that do not need an immediate-reload guarantee, and it was explicitly left out of scope in `storage.fs_flush` (its Decision 2) in favour of the targeted per-handler flush; keeping the flush at the handler tail keeps "which operations must be durable against an immediate reload" a decision the handler makes, matching CREATE_BOOK. *Rejected:* changing lightning-fs's debounce — fights the backend's batching and would slow every keystroke `write`.

2. **The flush lands at each handler's tail, not inside `example.seed` or `home.set`.** For OPEN_EXAMPLE_BOOK the durability that is at risk is the **shelf write**, which happens *after* `example.seed`'s own flush (`seed` at `logic.js:799`, `home.set` at `:811`); a flush inside `seed` therefore cannot cover it, and the book would reload seeded-but-orphaned. Only a handler-tail flush, after `home.set`/`surfaceHomeBookShelf`, persists the shelf entry. For RENAME_BOOK there is no repo write at all — only the `home.set` shelf change — so the handler tail is the natural single place. *Rejected:* a second flush inside `seed` *and* at the tail — redundant, since one global flush at the tail forces out every pending inode including the seed's (fs_flush.md Decision 3). *Rejected:* flushing inside `home.set` for these handlers — that is the broader home-book-wide durability change ruled out in Decision 1.

3. **`SYNC_HOME` is out of scope; the note's "other command handlers … via home.set" are only OPEN_EXAMPLE_BOOK and RENAME_BOOK today.** `SYNC_HOME` persists through `home.sync` (`logic.js:737–743`), not `home.set`, so it falls outside the note's literal scope. It is also a different durability story: a sync's local merge/scaffold commit, if lost to the debounce before a reload, is **re-derivable** — the origin still holds the commits the next fetch will merge again — whereas a lost `home.set` shelf write is gone for good (local-only, never pushed for a local book). And a sync is network-triggered, not the bare offline shelf mutation this task guards. So no flush is added to `SYNC_HOME` here. *This is a decision, not a deferred audit:* if a future refinement finds sync's local commits need a cold-open guarantee, that is a concrete, testable fix scoped then — not an open "revisit sync durability" leaf. *Rejected:* folding a `SYNC_HOME` flush in now "to be safe" — it would flush on every sync, including no-op fetches, for a commit that re-derives anyway, exceeding the note's scope without a demonstrated reload-loss.

4. **The tests read through a fresh `createFileSystem`, never the live `readHomeFile` window.** The existing suites' `readHomeFile` reads a *live* coherent window over the backing store, which sees the in-memory superblock and so passes with or without the flush — guarding nothing. Each new case must build a brand-new `createFileSystem(`${name}-fs`, { indexedDB })` (+ `createGitLayer`) after the operation and read the shelf through it — the cold open a reloaded tab performs. This is a real regression guard precisely because the in-test synchronous turn never elapses the 500 ms debounce: with the flush the superblock is persisted and the fresh instance finds the shelf change; without it the superblock is still pending and the fresh instance reads the stale shelf. The CREATE_BOOK cold-reopen test (`books.behavior.test.js:139–179`) is the exact template. *Rejected:* asserting through the live window — passes either way. *Rejected:* a timer-based test waiting out the debounce — slow, flaky, and it would pass even with the flush removed.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- `app/src/worker/logic.js`: added `await ensureFs().flush()` at the tail of the `OPEN_EXAMPLE_BOOK` handler (after `indexOneBook`) and the `RENAME_BOOK` handler (after `surfaceHomeBookShelf`), mirroring the CREATE_BOOK pattern from `storage.fs_flush`.
- `app/src/worker/example-book.behavior.test.js`: new behavior case *OPEN_EXAMPLE_BOOK then an immediate cold reopen keeps the shelf entry* — builds a fresh `createFileSystem`/`createGitLayer` over the same `(idb, name)` and asserts `shelf.json` lists the example book under `local.<deviceId>.<exampleId>`.
- `app/src/worker/books.behavior.test.js`: new behavior case *RENAME_BOOK then an immediate cold reopen keeps the new label* — cold-open fresh instance asserts both `local.<deviceId>.<bookId>.title` and `books.<bookId>.label` survive the rename.
- No changes to cifra.md, protocol, reducer, or any UI slice. No tech-debt follow-up registered.
