# storage.fs_flush — Flush the fs superblock on save, discard, and book creation

## TaskJuggler entry

`tasks/40-storage.tji`, `task storage.fs_flush "Flush the fs superblock on save, discard, and book creation"` (lines 98–103):

> "working-copy.save(), working-copy.discard(), and the CREATE_BOOK handler in logic.js still rely on lightning-fs's 500ms superblock debounce without an explicit flush() call. The same latent reload-durability gap that caused editor e2e failures (songs.editor fix 2) exists for save, discard, and book creation — a tab closed immediately after any of these operations may lose the path-to-inode map, causing ENOENT on the next open. Fix: add await fs.flush() after the git commit in working-copy.save(), after the git reset in working-copy.discard(), and after CREATE_BOOK's git.init in logic.js, mirroring the flush already applied to working-copy.write() and example-book.js. Source of debt: tasks/refinements/songs/editor.md (songs.editor). Tests: unit (none — no isolatable pure logic); behavior (save then immediate reload does not ENOENT; discard then immediate reload does not ENOENT; CREATE_BOOK then immediate reload finds the book)."

`depends !working_copy`.

## Effort estimate

**0.5d** (as scoped in the `.tji`), allocated `team`. Three call-site additions plus the suite's first cold-open reload tests; no new module, no new seam, no UI.

## Repository

**estante-de-cifras** only. All code is app-side, framework-free, below the view: production modules under `app/src/worker/` (`working-copy.js`, `logic.js`), their co-located behavior tests (`working-copy.behavior.test.js`, `books.behavior.test.js`), with the Worker test rig under `app/src/test/`. This is **not** a `cifra.md:` task — the note does not start with `cifra.md:`, and nothing in the sibling `/home/ruoso/devel/cifra.md` repo changes. The app and the service share no code, only the HTTP API and the format (DIRECTION §3.6). The code is plain JS; there is no TypeScript. Contracts are documented as JSDoc `@typedef`s, matching every sibling in `app/src/worker/`.

## Inherited dependencies

- **storage.working_copy** — *settled, Done 2026-10-05* ([`working_copy.md`](working_copy.md)). The two functions this task hardens: `createWorkingCopy({ fs, git, locks }) → { write, save, discard }` (`app/src/worker/working-copy.js:53`). `save` canonicalises → writes back → `add` → `commit` → `push`, all inside **one** `withLock` (`:99–159`); `discard` checks each path out of HEAD (or unlinks a never-saved file) inside **one** `withLock` (`:164–181`). working_copy already applied `await fs.flush()` to `write` (`:90`) — the exact pattern this task extends to `save` and `discard`. The **one-lock-per-logical-operation** rule is inherited from here (`working-copy.js:16–21`; locks.md Decision 1).
- **storage.fs** — *settled, Done 2026-10-05* ([`fs.md`](fs.md)). The `flush()` seam this task calls: `createFileSystem(name, { indexedDB }) → { promises, flush }` (`app/src/worker/fs.js:154–173`), where `flush: () => source.flush()` forces lightning-fs's debounced superblock (inode-table) save immediately. `flush` sits **beside** `promises`, not within it — it is not part of the isomorphic-git `fs.promises` contract (`fs.js:22–53`, the `@typedef` and Decision 6 documented in the module header; `fs.js:117–135` keeps `INTERFACE_METHODS` to exactly the eleven git calls). One `createFileSystem` instance serves the whole Worker; every book is a directory `/books/<bookId>` within it (`git.js:65–66`), so there is **one superblock for all books** — the property Decision 3 below turns on.
- **storage.home_book** — *settled, Done 2026-10-05* ([`home_book.md`](home_book.md)). The CREATE_BOOK handler writes the new book's shelf entry through the home book: `home.ensureLocal`, `home.ensureDeviceId`, `home.set({ bookId: HOME_BOOK_ID, file: 'shelf.json', changes, author })` (`logic.js:759–774`). `home-book.js` does **not** flush on its own writes — a fact Decision 2 and the deferred follow-up both turn on.
- **books.shelf** — *settled, Done* ([`../books/shelf.md`](../books/shelf.md)). The book-repo side of CREATE_BOOK: `createBooks({ fs, git, locks }).createLocal({ title, author })` (`app/src/worker/books.js:70–93`) runs `git.init` → write `README.md` + `.gitattributes` → `add` → `commit` inside **one** `withLock` on the new book's id, and **does not flush** today.
- **songs.editor** — *settled, Done 2026-10-06* ([`../songs/editor.md`](../songs/editor.md)), the **source of debt**. Its fix 2 added the `fs.js` flush seam and applied `await fs.flush()` after `working-copy.write()` and after the example-book seed commit (`example-book.js:127`), to close the editor's reload-durability failures. This task closes the same gap for the remaining durability-bearing operations the editor work did not touch.

Transitively **foundation.app_tooling** (Vitest, `fake-indexeddb ^6.2.5`, the gate) and the settled storage stack (`storage.worker`, `storage.git`, `storage.locks`). Nothing pending blocks this task — `storage.fs_flush depends !working_copy`, which is Done, and every collaborator the fix touches already ships in the tree. It is the last storage leaf M2 (`m2_local`) waits on among `storage.*` (`tasks/99-milestones.tji:25`); nothing downstream depends on it beyond M2's completeness.

## What this task is

A three-site durability fix in the Worker. lightning-fs writes each file's **bytes** on the `writeFile` call, but the **inode table** (the path-to-inode map, "the superblock") that lets a fresh instance *find* those bytes is persisted on a 500 ms debounce (`fs.js:44–52`). A tab closed — or reloaded — inside that window keeps the bytes but loses the map, so the next open reads `ENOENT`. `storage.working_copy` already forces the superblock out after a keystroke `write()`; this task adds the same `await fs.flush()` after the two other working-copy durability points and after creating a book:

1. **`working-copy.save()`** — after `gitCommit` (`working-copy.js:144`), inside the existing lock.
2. **`working-copy.discard()`** — after the checkout/unlink loop (`working-copy.js:166–179`), inside the existing lock.
3. **The CREATE_BOOK handler** (`logic.js:749–776`) — at the tail of the handler, after both the new book's repo (`books.js:createLocal`) and the home-book shelf write (`home.set`) have landed, so an immediate reload finds the book *and* its shelf entry (Decision 2).

No new module, no new seam, no protocol change, no UI. The `flush()` seam, the lock composition and the handlers all already exist; this task only adds the missing call sites and the first tests that prove a cold reopen keeps the data.

## Why it needs to be done

Without it, the project's central storage promise — "written to storage as they type, so closing the tab loses nothing" (DIRECTION §3, `docs/DIRECTION.md:108–110`) — holds only for per-keystroke writes, not for the two operations a user most expects to be durable (an explicit **Save**, workflow 4 §Saving; and **Discard**, workflow 4 §Discarding) nor for **creating a book** (workflow 7 §The book-management screen). Each is offline-first and local: the commit (or the new repo) is the durable artifact the user chose to keep, and a reload moments later must not read it back as `ENOENT`. The editor e2e already exposed this class of bug for `write()` and the example-book seed (songs.editor fix 2); the same debounce window sits under `save`, `discard` and `CREATE_BOOK`. It belongs to milestone **M2 (`m2_local`)** — "a songbook on one device: find, read, write, edit… installed and offline" — which depends on `storage.fs_flush` directly (`tasks/99-milestones.tji:25`).

## Inputs / context

### Governing design

- **DIRECTION §3 — Storage in the browser** (`docs/DIRECTION.md:104–115`): "each book is a git repository on a filesystem backed by IndexedDB, operated by isomorphic-git in a Web Worker" (L105–106); "What the user is editing is the working copy, written to storage as they type, so closing the tab loses nothing" (L108–110); "Saving is a commit, and then a push… the working copy is always safe; a save is a version the user chose to keep" (L111–113). The durability this task enforces is exactly these promises.
- **DIRECTION §3.7 — The app**: the Worker owns the data; the main thread never touches IndexedDB. The flush is Worker-internal and invisible to the view.
- **Workflow 4 — Edit and save** (`docs/workflows/04-edit-and-save.md`), §Saving (L24–35) and §Discarding (L74–77): the operations whose durability this task guarantees.
- **Workflow 7 — Add a book** (`docs/workflows/07-add-a-book.md`), §The book-management screen (L25): "**New book**: a name, and an empty local repository. No account needed" — the CREATE_BOOK path.

### The code seams this extends

- **The flush seam** — `app/src/worker/fs.js:154–173`. `createFileSystem` returns `{ promises, flush }`; `flush()` calls lightning-fs's own `source.flush()`, which runs the debounced `saveSuperblock` (`fs.js:92–94`) immediately. The module header (`fs.js:44–52`) is the normative description of the debounce and why `write()` / the example-book open already flush. `flush` is deliberately off the `promises` surface (`fs.js:168–172`).
- **`working-copy.js`** — `save` (`:99–159`): the `await gitCommit(...)` is at `:144`; the push is the best-effort try/catch at `:150–156`. `discard` (`:164–181`): the per-path `gitCheckout`/`unlink` loop is `:167–179`. `write` (`:80–92`) is the model — note the flush at `:90` with its comment citing fs.js Decision 6.
- **`logic.js`** — the CREATE_BOOK handler (`:749–776`): `ensureHomeBook()` → `home.ensureLocal` → `ensureBooks().createLocal({ title, author })` (`:761`) → `home.ensureDeviceId` → `home.read` → `home.set` (the shelf write, `:765–773`) → `surfaceHomeBookShelf()` (`:774`) → `port.postMessage(event(EventKind.BOOK_CREATED, { bookId }))` (`:775`). The handler is where this task's flush lands (Decision 2).
- **`books.js`** — `createLocal` (`:70–93`): `git.init` (`:77`) → write + stage README and `.gitattributes` → `gitCommit` (`:83–90`), all inside `locks.withLock(bookId, …)`. It flushes nowhere today.
- **`example-book.js`** — `seed` (`:98–130`): `git.init` → write the bundled files → commit → `await fs.flush()` (`:127`). The already-landed precedent for a per-repo flush.
- **The Worker behavior rig** — `app/src/test/loopback.js` (`createLoopbackEndpoint`), `app/src/test/web-locks.js` (`installWebLocks`), `app/src/test/git-http-remote.js` (`startGitHttpRemote`, a real `git http-backend` over smart HTTP v1 with push). `working-copy.behavior.test.js` builds its window with a second `createFileSystem(`${name}-fs`, { indexedDB: idb })` over the same `(idb, name)` the Worker uses (header L19–22); `books.behavior.test.js` `makeWorker(label)` already returns `{ idb, name, fs, git, … }` (its rig at `:60–82`).
- **Signatures** — `createFileSystem(name, { indexedDB }) → { promises, flush }`; `createGitLayer({ fs, http }) → { init, clone, fetch, push, bookDir }`, `bookDir(id) = /books/<id>`; `createBookLocks({ navigator }).withLock(bookId, fn)` — exclusive, non-reentrant.

## Constraints / requirements

- **The Worker owns the data; the fix is invisible above the view.** `flush()` is called only inside the Worker; no protocol message, slice or view changes (DIRECTION §3.7). *Central.*
- **One lock per logical operation** (locks.md Decision 1). The `save` and `discard` flushes run **inside** the existing `withLock(bookId, …)` — they are part of that logical unit. They do **not** add a lock, reacquire one, or nest (Web Locks are non-reentrant). The CREATE_BOOK handler-tail flush runs **after** the book lock and the home-book lock have each released in sequence (Decision 4); it needs no lock because it mutates no working tree. *Central.*
- **Offline-first.** The flush persists local state only; it never waits on or implies a network. In `save` it runs after the commit and may run before the best-effort push, so durability of the commit never depends on the push outcome (workflow 4; DIRECTION §3 L111–113). *Central.*
- **Canonical form over preserving content** is untouched: `save` still canonicalises and refuses a marked/unreadable file before any commit (`working-copy.js:120–130`); the flush only follows a commit that already happened. *Applies.*
- **No song text, titles or secrets in logs.** `flush()` logs nothing, and the fix adds no logging (`fs.js`/`working-copy.js`/`logic.js` headers). Fixtures are purpose-written songs. *Applies.*
- **No new runtime dependency, no new seam.** The `flush()` seam is fs.md Decision 6, already shipped; this task adds call sites only (Decision 1). No design delta. *Applies.*

## Acceptance criteria

### Behavior delivered

1. **A save survives an immediate reload.** After `save` commits, `await fs.flush()` runs inside the lock (after `working-copy.js:144`). A fresh filesystem instance opened over the same backing store — the cold-open a reloaded tab performs — finds the saved file's committed and working-copy bytes; no `ENOENT`. *Pins DIRECTION §3 L111–113; workflow 4 §Saving; the note's first behavior case.*
2. **A discard survives an immediate reload.** After `discard`'s checkout/unlink loop, `await fs.flush()` runs inside the lock. A fresh instance reads a reverted tracked file back as its last-saved (HEAD) bytes and sees a discarded never-saved file stay gone — the discard's working-tree state is durable, not lost to the debounce. *Pins workflow 4 §Discarding; the note's second behavior case.*
3. **A created book survives an immediate reload, with its shelf entry.** After the CREATE_BOOK handler finishes, one `await fs.flush()` at the handler tail has persisted both the new book's repo (`README.md`, `.gitattributes`, the first commit) and the home-book `shelf.json` write. A fresh instance over the same backing store finds the book repo *and* lists the book on the shelf; no `ENOENT`, and the book is not orphaned off the shelf. *Pins workflow 7 §The book-management screen; DIRECTION §3 L105–110; the note's third behavior case; Decision 2.*

No change to `protocol.js`, `reducer.js`, any slice, or any screen.

### Tests the task lands with, by level

Per the `.tji` note: **unit (none)**, **behavior (three cases)**. Fixtures are purpose-written songs, never anyone's copyrighted words. Conventions: plain JS, co-located; `*.behavior.test.js` for the behavior level; `fake-indexeddb` imported per-file, never globally; `scripts/gate` runs `vitest run`.

- **unit — none.** The change is three one-line `await fs.flush()` call-site additions; there is no new pure module or branchable logic to isolate (the note says so). Documented here so the closer does not expect a unit file. *(Decision justifies the absence per the testing policy.)*
- **behavior — `app/src/worker/working-copy.behavior.test.js`** (the Worker rig: `createLoopbackEndpoint` → `createWorkerLogic`, a fresh `new IDBFactory()`, `installWebLocks()`, a cloned `startGitHttpRemote()` window):
  - *Save then immediate reload does not ENOENT* — drive `SAVE`, await `SAVED`; then open a **fresh** `createFileSystem(`${name}-fs`, { indexedDB })` + `createGitLayer` over the same `(idb, name)` and read the saved path's bytes (working copy and `git.show HEAD:<path>`) with no `ENOENT`. *Pins DIRECTION §3 L111–113, workflow 4 §Saving, `tasks/40-storage.tji:102`.*
  - *Discard then immediate reload does not ENOENT* — write + save a file, write a new edit, `DISCARD`, await `DISCARDED`; a fresh instance reads the reverted file back as its HEAD bytes; a discarded never-saved file stays absent while its sibling files are still found. *Pins workflow 4 §Discarding, `tasks/40-storage.tji:102`.*
  - Rig note: `setup()` must expose `(idb, name)` (or gain a `reopen()` helper that builds a fresh `createFileSystem`+`createGitLayer`); the existing `ctx.read` reads a **live** coherent window and would not prove a cold-open survived (Decision 5).
- **behavior — `app/src/worker/books.behavior.test.js`** (`makeWorker(label)` already returns `{ idb, name, … }`, offline `spyFetch`, no remote):
  - *CREATE_BOOK then immediate reload finds the book* — `send(command(CommandKind.CREATE_BOOK, { title, author }))`, await `BOOK_CREATED`; then build a **fresh** `createFileSystem(`${name}-fs`, { indexedDB: w.idb })` + `createGitLayer` and assert, via isomorphic-git `listFiles`/`readFile`, that the new book's repo holds `README.md` (`# {title}\n`) and `.gitattributes`, **and** that the home book's `shelf.json` lists the book under `local.<deviceId>.<bookId>` — extending the existing "New book" assertions. *Pins workflow 7 §The book-management screen, DIRECTION §3 L105–110, `tasks/40-storage.tji:102`; proves the handler-tail/global-superblock decision (Decision 2, Decision 3).*

Each behavior case is a real regression guard because the in-test synchronous turn never fires lightning-fs's 500 ms debounce (Decision 5): remove the `flush()` and the superblock stays pending, so the fresh instance loads a stale/absent inode table and the assertion `ENOENT`s. The closer confirms all three ran (not skipped) in the gate before committing.

### Why no e2e-web / e2e-api / axe here

The `.tji` names only unit and behavior, and nothing visual or networked ships — this is a Worker-internal durability fix. No new screen, so no axe; no endpoint, so no e2e-api. The integration-level manifestation of this bug (a reload losing a just-saved song) is already exercised by `songs.editor`'s Playwright journey (`e2e/web/tests/editor.spec.js`, which reloads), so a regression would also surface there; this task pins the fault at the Worker boundary where it lives, at the proportionate behavior level with a cold-open fresh-instance assertion.

### Deferred work (closer registers in the WBS; milestone **M2**)

- **`storage.shelf_flush`** — *new leaf, ~0.5d, estante-de-cifras, not a `cifra.md:` task.* The same reload-durability gap remains in the **other** command handlers that persist a home-book shelf write without a flush: `OPEN_EXAMPLE_BOOK` (`logic.js:778–816`; `example-book.js` flushes the seeded repo at `:127` but the subsequent `home.set` shelf write is unflushed) and `RENAME_BOOK` (`logic.js:818+`, `home.set` with no flush), plus any reorder/remove shelf mutation. Because `home-book.js` writes never flush, an immediate reload after any of these can lose the shelf change (the example book's incidental survival in the editor e2e rode on a later `WRITE` flush, which is global). Fix: a handler-tail `await fs.flush()` on each (same shape as this task's CREATE_BOOK fix). Tests: behavior (`example-book.behavior.test.js` / `books.behavior.test.js` — open-example then fresh-instance reload keeps the shelf entry; rename then reload keeps the new label). `depends !fs_flush`. Wired into **M2 (`m2_local`)**. *(This task deliberately scopes to the three operations the note names; the sibling handlers surfaced during refinement and are registered rather than silently folded in.)*

## Decisions

1. **Reuse the `fs.flush()` seam (fs.md Decision 6); add only the missing call sites — no new mechanism, no design delta.** The seam already exists (`fs.js:168–172`, off `.promises`), and `songs.editor` already applied it to `write()` and the example-book seed. This task extends the identical pattern — `await fs.flush()` after the operation's git write — to `save`, `discard` and `CREATE_BOOK`. Because it changes no designed behavior, adds no dependency and invents no seam, it needs no edit to DIRECTION or a workflow. *Rejected:* changing lightning-fs's debounce interval or forcing a synchronous superblock write on every `writeFile` — it would slow every keystroke `write`, fights the backend's own batching, and the targeted per-operation flush already gives the durability the promise needs. *Rejected:* a new "durable" wrapper around git operations — redundant with the one-line seam the siblings already use.

2. **`save` and `discard` flush internally (inside their lock); CREATE_BOOK flushes at the handler tail in `logic.js`, not inside `books.js:createLocal`.** `save` and `discard` are self-contained durability units within `working-copy.js` — the commit, or the checkout/unlink, is the whole unit — so the flush belongs there, right after the git write and still under the operation's single `withLock` (mirroring `write()` at `:90`). CREATE_BOOK is different: its durability spans **two repositories** — the new book's repo (`books.js:createLocal`) and the home-book `shelf.json` write (`home.set`, `logic.js:765–773`) — and the handler is the only place both are in scope. A single flush at the handler tail, after `home.set`/`surfaceHomeBookShelf`, persists both. *Rejected:* flushing inside `createLocal` (mirroring `example-book.js:seed`) — it would persist the book repo but leave the **later** shelf write exposed to the debounce, so an immediate reload could find the repo yet not list the book, failing "finds the book" (the shelf is how the book is found). *Rejected:* a flush inside `home.set` for this task — that is the broader home-book durability fix, out of this leaf's named scope, and is registered as `storage.shelf_flush`.

3. **One flush per logical unit suffices, because the superblock is filesystem-global.** There is one `createFileSystem` instance for the whole Worker and every book is a directory `/books/<id>` inside it, so a single inode table (superblock) covers all books and the home book. `writeFile` already persists each file's bytes synchronously; only the shared inode table is debounced (`fs.js:44–52`). Therefore one `await fs.flush()` after a unit's writes forces out *all* pending inodes — the new book's repo and the home book's shelf alike. *Rejected:* flushing per file or per path (per committed path in `save`, per discarded path in `discard`) — needless; the inode table is written whole, so one flush at the end of the unit is both sufficient and cheapest.

4. **The flush needs no lock of its own.** For `save`/`discard` it already runs inside the operation's `withLock`. For CREATE_BOOK the handler-tail flush runs *after* the book lock and the home-book lock have each released (taken in sequence, never nested — locks.md Decision 1). That is correct because `flush()` mutates no working tree; it only forces the already-written superblock out, so its only ordering requirement is to run after the writes it must persist. *Rejected:* taking a lock across the CREATE_BOOK flush, or folding it back inside one of the two locks — unnecessary (no tree mutation) and it would have to pick one of the two repos' locks while needing to cover both.

5. **The tests introduce the suite's first cold-open reload assertion — read through a fresh `createFileSystem`, not the live window.** No existing test reopens a fresh filesystem instance; `working-copy.behavior.test.js`'s `ctx.read` reads a *live* coherent window over the same backing store, which would still see an in-memory superblock and so prove nothing about durability. Each new case must build a brand-new `createFileSystem(`${name}-fs`, { indexedDB })` (+ `createGitLayer`) after the operation and read through it — the cold open a reloaded tab performs. This is a real regression guard precisely because the in-test synchronous turn never elapses lightning-fs's 500 ms debounce: with the flush the superblock is persisted and the fresh instance finds the data; without it the superblock is still pending and the fresh instance `ENOENT`s. *Rejected:* asserting through the existing live `fs` window — it passes with or without the flush and guards nothing. *Rejected:* a timer-based test that waits out the debounce — slow, flaky, and it would pass even if the flush were removed, defeating the point.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- `app/src/worker/working-copy.js` — `await fs.flush()` added after `gitCommit` in `save()` (inside `withLock`), and after the checkout/unlink loop in `discard()` (inside `withLock`).
- `app/src/worker/logic.js` — `await ensureFs().flush()` at the CREATE_BOOK handler tail, after `surfaceHomeBookShelf()`, persisting both the new book's repo and the home-book shelf write in one global flush.
- `app/src/worker/working-copy.behavior.test.js` — added `idb`/`name`/`reopen()` to the rig; two cold-open tests: *SAVE then immediate cold reopen finds committed and working-copy bytes*; *DISCARD then immediate cold reopen reads reverted/removed state durably*.
- `app/src/worker/books.behavior.test.js` — one cold-open test: *CREATE_BOOK then immediate cold reopen finds the book repo AND its shelf entry*.
- Tech-debt follow-up registered: `storage.shelf_flush` (handler-tail flush for `OPEN_EXAMPLE_BOOK`, `RENAME_BOOK`, and other shelf mutations; `depends !fs_flush`, M2).
