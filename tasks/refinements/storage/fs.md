# storage.fs — The filesystem layer

## TaskJuggler entry

`tasks/40-storage.tji`, `task storage.fs` (lines 15–20). The one-line note:

> "lightning-fs behind a small interface, so OPFS can replace it;
> `navigator.storage.persist()`. Tests: unit (the filesystem interface's
> contract suite, run against lightning-fs on a fake IndexedDB so OPFS can
> later pass the same suite); behavior (`persist()` asked for once)."

## Effort estimate

**2d** (as scoped in the `.tji`).

## Repository

**estante-de-cifras**, `app/` — the Web Worker storage stack, all under
`app/src/worker/` with shared test support under `app/src/test/`. This is
not a `cifra.md:` task. The app and the service share no code, only the HTTP
API and the format (DIRECTION §3.6 L275: "**The app and the service share no
code**, only the HTTP API and the format.").

## Inherited dependencies

- **`storage.worker`** — [`worker.md`](worker.md), *settled, Done
  2026-10-05*. The seams this task plugs into:
  - `createWorkerLogic(port, options = {})` in `app/src/worker/logic.js:108`
    — the transport-agnostic Worker brain that owns on-device state. Its
    `options` injection seam (`logic.js:99-111`) already threads
    `options.indexedDB`, `options.name` and `options.migrations`; this task
    adds `options.fs` and `options.navigator` beside them, defaulting to the
    real backends and overridable in tests.
  - The `open` command (`protocol.js:26` `CommandKind.OPEN`) and the `ready`
    event (`EventKind.READY`): the Worker's storage bring-up. This task
    extends bring-up from "open the IndexedDB `meta`" to "bring the whole
    storage stack up" (meta + filesystem + persistence).
  - `app/src/test/loopback.js` — the in-process loopback transport double,
    for the behavior test.
  - `fake-indexeddb` `^6.2.5` (devDependency, added by `storage.worker`),
    imported per-test, never globally.
- **`storage.migrations`** — [`migrations.md`](migrations.md), *settled,
  Done 2026-10-05*. The `estante` IndexedDB database, one monotonic version
  derived from the `MIGRATIONS` step list (`app/src/worker/migrations.js`).
  This task does **not** append a step (see Decisions §3): lightning-fs owns
  its own IndexedDB database, outside `estante`'s versioned shape.

No pending dependencies: `storage.fs depends !worker`, which is Done.
(`storage.migrations` is a sibling leaf off `!worker`, not a predecessor of
`fs`, but its framework is a settled fact of the codebase and is cited for
continuity.)

## What this task is

A browser filesystem for the Worker, so the next task (`storage.git`,
`depends !fs`) can run isomorphic-git against it. The deliverable is a
**small, documented interface** — the exact `fs` contract isomorphic-git
requires — with **lightning-fs** as the implementation behind it, wired so a
future **OPFS** backend can satisfy the same interface and pass the same
contract suite. The task also claims `navigator.storage.persist()`: the
Worker asks for durable storage **once**, at storage bring-up, best-effort
and tolerant of browsers that do not offer it. No git, no working copy, no
index, no UI — those are later storage tasks; this is the storage substrate
they all sit on.

## Why it needs to be done

DIRECTION §3 L100: "each book is a git repository on a filesystem backed by
IndexedDB, operated by isomorphic-git in a Web Worker." isomorphic-git does
not touch IndexedDB itself — it is handed an `fs` object and does all its I/O
through it. That `fs` is what this task builds. `storage.git` (`depends
!fs`), `storage.working_copy`, `storage.index`, `storage.home_book`,
`storage.history` and `storage.download` all read and write through it. The
"small interface so OPFS can replace it" framing is what keeps the storage
backend swappable: lightning-fs is adequate and ubiquitous today, OPFS is
faster and, on iOS, eviction-resistant (DIRECTION §8 L547-549) later — and
the only thing isomorphic-git and the storage stack above it ever see is the
interface, never the backend.

`navigator.storage.persist()` belongs here because this is where the durable
store comes up. DIRECTION §3 L114-115: "**`navigator.storage.persist()`**,
and an export, because a book with no remote is still one phone away from
being lost." A real working copy is written to storage as the user types
(DIRECTION §3 L103-105: "written to storage as they type, so closing the tab
loses nothing"); that copy is only as safe as the storage is persistent, so
persistence must be requested as soon as the storage exists, not deferred to
a first save or push.

## Inputs / context

- **`tasks/40-storage.tji`** lines 15–20 — the task note (above). Line 18
  `depends !worker`; line 21 `task git` `depends !fs` — the immediate
  downstream consumer.
- **`docs/DIRECTION.md`** — the authoritative design for this task:
  - §3 "Storage", L100: "each book is a git repository on a filesystem
    backed by IndexedDB, operated by isomorphic-git in a Web Worker."
  - §3 L103-105: "**A real working copy.** … written to storage as they
    type, so closing the tab loses nothing."
  - §3 L114-115: "**`navigator.storage.persist()`**, and an export, because a
    book with no remote is still one phone away from being lost."
  - §3.7 L394-396 (the load-bearing boundary): "**One owner for the data: a
    Web Worker.** It holds git, the working copy and the search index, and
    does every clone, fetch, merge, save and index update. The main thread
    never touches IndexedDB."
  - §3.7 L402-404: "**Framework-free below the view.** … the view is the only
    layer that [knows React]."
  - §3.6 L268: the app's row — "Git through isomorphic-git in a Web Worker;
    the music core from Explore Chords." L275: app and service share no code.
  - §8 L547-549 — OPFS's eventual payoff (iOS storage "that is never
    evicted"), the motive for keeping the backend swappable.
- **`app/src/worker/logic.js`** — the injection seam:
  - `logic.js:108-118` `createWorkerLogic(port, options = {})`,
    `options.indexedDB ?? globalThis.indexedDB`, `options.name`,
    `options.migrations ?? MIGRATIONS`, and `ensureOpen()` memoising the open.
  - `logic.js:1-11` — the module's standing-rule header: framework-free,
    "Logs nothing — in particular never song text, commit messages, or
    secrets."
- **`app/src/worker/protocol.js`** — `CommandKind` (`:26`), `EventKind`
  (`:33`), `command()`/`event()` constructors (`:41`/`:46`); the structured-
  cloneable envelope the `ready`-with-`persisted` payload extends.
- **`app/src/worker/reducer.js`** — `initialState` (`:15`), `reduce()`
  (`:27`): unknown message kinds return the same reference, so extending the
  `ready` payload is forward-compatible.
- **`app/vite.config.js`** lines 71-79 — the inline Vitest block:
  `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.js']`,
  `include: ['src/**/*.{test,spec}.{js,jsx}']`. No separate config file.
- **`app/src/test/setup.js`** — jest-dom + vitest-axe matchers, `afterEach
  (cleanup)`; does **not** register a global IndexedDB fake (by design).
- **`app/package.json`** — zero runtime dependencies today (react/react-dom/
  react-aria-components aside); no `@isomorphic-git/lightning-fs`,
  `lightning-fs` or `isomorphic-git` present. This task adds the first.
- **isomorphic-git's documented `fs` requirement** — the external contract
  the "small interface" mirrors: the promises API `readFile`, `writeFile`,
  `unlink`, `readdir`, `mkdir`, `rmdir`, `stat`, `lstat`, `readlink`,
  `symlink` (and `rename`). This is the method set, pinned to an external
  spec rather than invented. lightning-fs exposes exactly this as its
  `.promises` surface.

## Constraints / requirements

- **The small interface is the only thing anything above it sees.** The
  filesystem module exports the interface and a factory; callers (eventually
  isomorphic-git in `storage.git`) receive the interface object, never a
  lightning-fs type. The interface is documented as a JSDoc `@typedef`
  enumerating exactly the methods isomorphic-git needs, so an OPFS backend
  has a precise target and the contract suite has a precise subject.
- **Framework-free, Worker-only.** Plain ESM `.js`, no React, no DOM beyond
  `navigator.storage`. The main thread (store, hook, any view) never
  references lightning-fs, a filesystem, or `indexedDB`; it reaches storage
  only through the Worker's message port (DIRECTION §3.7 L394-396; the
  boundary `worker.md` already enforces). All filesystem code lives under
  `app/src/worker/`.
- **Injected backends.** The IndexedDB factory and the `navigator` object are
  injected through the existing `options` seam, so tests supply a fresh
  `fake-indexeddb` `IDBFactory` and a `navigator.storage` stub without
  touching globals. Production defaults to `globalThis.indexedDB` and
  `globalThis.navigator`.
- **`navigator.storage.persist()` asked at most once per Worker session,**
  memoised, and absence-tolerant: `navigator.storage?.persist` may be
  undefined (older/embedded browsers) and that must not throw — persistence
  is best-effort, never a blocker. Nothing the user does waits on it.
- **No MIGRATIONS step for the filesystem.** lightning-fs owns its own
  IndexedDB database with its own internal schema; it is not part of the
  `estante` database's versioned shape, so no step is appended to
  `app/src/worker/migrations.js` (Decisions §3).
- **Standing rules, each weighed:**
  - *No song text in logs* — **applies**: the module logs nothing, matching
    `logic.js`'s header rule. It stores file bytes (which will include song
    text once `storage.working_copy` lands) but never logs them.
  - *Offline first* — **applies, and is the point**: this is the durable
    local store; nothing here waits on a network, and `persist()` is what
    protects the offline copy. It is best-effort and never blocks.
  - *Accessibility* — **not applicable**: no UI in this task (considered;
    there is nothing a user sees or operates here).
  - *Canonical form over preserving content* — **not applicable**: the
    filesystem stores bytes; canonicalisation on save is
    `storage.working_copy` (considered).
  - *No book without an account* — **not applicable**: device-local storage;
    membership and the no-anonymous-read rule are server-side (considered).

## Acceptance criteria

**Behavior delivered.**

- A filesystem module `app/src/worker/fs.js` exports `createFileSystem(name,
  options)` returning the small-interface object (a `.promises` surface
  conforming to the documented `@typedef`), backed by lightning-fs by
  default, with the IndexedDB factory injectable via `options.indexedDB` so
  the test backs lightning-fs with `fake-indexeddb` and production uses the
  global. One filesystem instance serves the Worker; books become directories
  within it (the directory layout itself is `storage.git`'s to settle).
- The small interface is documented as a JSDoc `@typedef` naming exactly the
  isomorphic-git-required methods, so the OPFS backend and the contract suite
  share one precise contract.
- Storage bring-up (the `open` command) now also materialises the filesystem
  once (memoised, like `ensureOpen`) and asks `navigator.storage.persist()`
  once, best-effort and absence-tolerant; the granted/denied/unavailable
  result rides on the `ready` event payload as `persisted` (`true` / `false`
  / `null`) and the reducer folds it into the connection slice, so a later
  task can nudge toward export when persistence was denied. No UI this task.

**Tests the task lands with, by level** (the `.tji` `Tests:` clause,
sharpened; these are the levels that apply — see "Why no e2e / axe" below):

- **unit** — `app/src/worker/fs.contract.js` exports a reusable
  `runFsContract(makeFs)` registering the interface's contract cases
  (write/read-back a file, `readdir` lists entries, `mkdir`/`rmdir` nested
  directories, `stat`/`lstat` sizes and types, `unlink`, `rename`, `symlink`/
  `readlink`, errors on a missing path). `app/src/worker/fs.test.js` runs the
  suite against lightning-fs over a fresh `new IDBFactory()` per test (a
  distinct FS name per test so databases do not collide), **pinning the
  isomorphic-git `fs` contract** so that OPFS can later call the same
  `runFsContract` and pass unchanged. A second unit case pins the
  persistence helper in isolation: asked once when called twice, returns
  `null` (does not throw) when `navigator.storage` is absent.
- **behavior** — `app/src/worker/fs.behavior.test.js` drives
  `createWorkerLogic` in-process through `app/src/test/loopback.js` with an
  injected `fake-indexeddb` factory and a `navigator.storage` stub whose
  `persist` is a spy; sends `open` twice and asserts `persist` was called
  **exactly once**, and that `persisted` is surfaced on the `ready` event
  (**pins `.tji` "`persist()` asked for once"** and DIRECTION §3 L114-115).

Test conventions, inherited: plain JS, co-located; `*.test.js` for unit,
`*.behavior.test.js` for the behavior level; `fake-indexeddb` imported
per-file, never globally; `scripts/gate` runs `vitest run`. Fixtures use
paths and byte contents written for the purpose (no song text is needed at
this layer; any bytes used are arbitrary test content).

**Why no e2e-web / e2e-api / axe.** The `.tji` names only unit and behavior,
and rightly: this is a headless, framework-free Worker module with no screen
and no HTTP endpoint. The first screen that storage reaches (and its
e2e-web journey with axe) arrives with `shell`/`songs`; the first
git-over-HTTP e2e-api arrives with `sync`. Requesting those levels here would
pin nothing this task owns.

**Deferred work.** None requiring a new WBS leaf. The `persisted` result is
surfaced for a future consumer, but the export escape hatch it points at is
the existing leaf `storage.download` (workflow 7), and any "persistence
denied" nudge is UI that belongs to the shell/account screens, not a new
storage leaf. The OPFS backend is explicitly **not** a deferred follow-up to
register: it is a hypothetical future the interface is shaped to admit
(DIRECTION §8 "Later"), not committed work — registering it now would be
speculative.

## Decisions

1. **The "small interface" is exactly isomorphic-git's documented `fs`
   contract, not a filesystem abstraction of our own.** The method set
   (`readFile`, `writeFile`, `unlink`, `readdir`, `mkdir`, `rmdir`, `stat`,
   `lstat`, `readlink`, `symlink`, `rename`, as a `.promises` surface) is
   pinned to an external spec with two independent implementations already
   (Node's `fs.promises` and lightning-fs), so the contract suite tests
   against a real standard and OPFS has an unambiguous target. *Rejected:* a
   richer bespoke VFS interface — more surface to implement twice, and
   isomorphic-git would still only use this subset, so the extra methods
   would be untested dead weight. *Rejected:* handing isomorphic-git a
   lightning-fs instance directly with no interface — then there is no
   documented contract for OPFS to meet and no single suite to hold both
   backends to, which is exactly what the `.tji` note forbids.

2. **lightning-fs is added as the storage stack's first runtime dependency.**
   `@isomorphic-git/lightning-fs` (current `^4.x`, pinned as the lockfile
   records at install), a devless peer of isomorphic-git. The app has shipped
   zero runtime dependencies so far (the Explore Chords heritage, e.g. the
   hand-written zip in `explore-chords/src/state/zip.js`), so this is a
   deliberate first. It is justified and not a surprise: DIRECTION §3 L100
   and §3.6 L268 already commit the architecture to "isomorphic-git in a Web
   Worker" on "a filesystem backed by IndexedDB", and lightning-fs is that
   filesystem — hand-rolling an IndexedDB-backed POSIX filesystem is not a 2d
   task and would be strictly worse than the de-facto standard backend. No
   DIRECTION delta is needed: the dependency realises an already-stated
   design, and the small interface (Decision 1) contains it so the commitment
   stays swappable. *Rejected:* writing our own IndexedDB filesystem — out of
   proportion and lower quality. *Rejected:* adopting OPFS now instead of
   lightning-fs — OPFS is not uniformly available (notably weaker on the iOS
   Safari the project cares about, per DIRECTION §8) and would make the app's
   first storage release the riskier bet; the point of the interface is to
   adopt it *later* without a rewrite.

3. **The filesystem lives in lightning-fs's own IndexedDB database, not a
   store inside `estante`; no `MIGRATIONS` step is appended.** lightning-fs
   manages its own database (named from the FS instance name) with its own
   internal schema and versioning. Folding it into the `estante` database
   would mean reimplementing lightning-fs's storage backend against our
   object stores — defeating the point of using it. So the `estante`
   migration framework (`migrations.js`) continues to govern only the shapes
   the Worker itself defines (`meta` today, the search index later), and the
   filesystem backend owns its own on-disk shape. This is a considered
   divergence from `migrations.md`'s forecast that "`storage.fs` [adds] a
   filesystem store" to `estante`: that forecast predates choosing a
   library that brings its own database. *Rejected:* a dedicated
   `estante`-DB object store for files behind a hand-written lightning-fs
   backend — Decision 2's rejected build in a different hat. If a future
   decision ever needs the filesystem and the app's own stores in one
   transactional database, that is a design change with its own task; it is
   not required by anything today.

4. **`navigator.storage.persist()` is owned here, asked once at storage
   bring-up, best-effort.** Neither `worker.md` nor `migrations.md` assigned
   it; this is the layer where the durable store first exists, so it is the
   earliest correct point to ask. It is memoised (one call per Worker
   session), tolerant of `navigator.storage` being absent, and never blocks —
   the result is advisory. *Rejected:* asking on every filesystem operation —
   the result does not change within a session, so it is waste. *Rejected:*
   asking only after the first save or push — the working copy is written as
   the user types (DIRECTION §3 L103-105), so it is already at risk before
   any save; waiting is the loss DIRECTION §3 L114-115 warns about.
   *Rejected:* surfacing a permission dialog — `persist()` is itself the
   programmatic request (browsers decide heuristically or silently); there is
   no separate prompt to show, and inventing one would be a workflow change
   with no mockup behind it.

5. **The fake backs lightning-fs through the injected `options.indexedDB`,
   and the contract suite keeps the global suite clean.** The test passes a
   fresh `new IDBFactory()` into `createFileSystem` (threaded the same way
   `createWorkerLogic` already threads `options.indexedDB`), so lightning-fs
   reads and writes the fake and no global is mutated for the rest of the
   suite — the same discipline `worker.md` Decision 4 set for
   `fake-indexeddb`. Each contract case uses a distinct FS name so its
   database is isolated. *Rejected:* assigning `globalThis.indexedDB = new
   IDBFactory()` for the run — leaks a fake into unrelated tests and breaks
   the per-file isolation the suite was built on.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `app/src/worker/fs.js` — `createFileSystem(name, options)` returns the small-interface `.promises` object (the isomorphic-git `fs` contract, documented as a JSDoc `@typedef`), backed by lightning-fs with `options.indexedDB` injectable so tests use `fake-indexeddb` and production uses `globalThis.indexedDB`.
- `app/src/worker/fs.contract.js` — reusable `runFsContract(makeFs)` registering the interface's contract cases (write/read-back, readdir, mkdir/rmdir, stat/lstat, unlink, rename, symlink/readlink, missing-path errors); OPFS can later call the same suite unchanged.
- `app/src/worker/fs.test.js` — runs `runFsContract` against lightning-fs over a fresh `IDBFactory` per test, plus `createPersister` isolation cases (asked-once, absence→null, reject→null, denied→false).
- `app/src/worker/fs.behavior.test.js` — drives `createWorkerLogic` in-process via `loopback.js`; asserts `persist` called exactly once over two `open`s and `persisted` surfaced on the `ready` event.
- `app/src/test/web-locks.js` — in-memory Web Locks shim for tests (lightning-fs's fallback mutex eagerly touches `indexedDB` that jsdom lacks; a real Worker has `navigator.locks`, so production is unaffected).
- `app/src/worker/logic.js` — bring-up materialises the fs and asks `persist()` once via injected `options.navigator`; `options.fs` and `options.navigator` added to the injection seam.
- `app/src/worker/reducer.js` — folds `persisted` into the connection slice; `ready` payload carries `persisted` (`true` / `false` / `null`).
- `app/src/worker/reducer.test.js` — gains a `persisted`-surfacing assertion on the ready-event case.
- `app/package.json` + `app/package-lock.json` — adds `@isomorphic-git/lightning-fs ^4.10.3`, the first runtime dependency (Decision 2).
