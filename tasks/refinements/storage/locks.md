# storage.locks — One lock per book

## TaskJuggler entry

[`tasks/40-storage.tji`](../../40-storage.tji), task `locks` under `task
storage`:

```
task locks "One lock per book" {
  effort 1d
  allocate team
  depends !git
  note "Web Locks around every git operation, so two tabs never interleave.
        Tests: behavior (two operations on one book serialised, on two books
        not; a second tab's operation waits — Web Locks in the test
        environment)."
}
```

## Effort estimate

1 day.

## Repository

**estante-de-cifras**, `app/` — the Web Worker storage stack. A new
production module under `app/src/worker/` with shared test support under
`app/src/test/` (reusing the existing Web Locks shim). This is **not** a
`cifra.md:` task: nothing here touches the format, the spec, the reference or
the corpus. The app and the service share no code, only the HTTP API and the
format (DIRECTION §3.6).

## Inherited dependencies

Settled (all Done 2026-10-05):

- **`storage.git`** (`tasks/refinements/storage/git.md`) — the direct
  dependency (`depends !git`). It ships `createGitLayer({ fs, http })` →
  `{ clone, fetch, push, bookDir }` (`app/src/worker/git.js:44-92`), where
  each of `clone`/`fetch`/`push` takes `{ dir, url, onProgress }` and
  `bookDir(bookId)` → `` `/books/${bookId}` `` (`git.js:63-65`). These are
  the operations this task serialises. Its own refinement already names the
  dependency: "`storage.locks` serialises the git operations this layer
  exposes" (`git.md`). Its behavior test already installs the Web Locks shim
  (`git.behavior.test.js`).
- **`storage.fs`** (`tasks/refinements/storage/fs.md`) — created
  `app/src/test/web-locks.js` (`makeLockManager`, `installWebLocks`), the
  in-memory Web Locks shim this task's tests build on, and established that a
  real Worker has `navigator.locks` so production is unaffected.
- **`storage.worker`** (`tasks/refinements/storage/worker.md`) — the Worker
  logic (`createWorkerLogic(port, options)`, `app/src/worker/logic.js:111`),
  the dependency-injection options seam (`indexedDB`, `name`, `fs`,
  `navigator`), the loopback transport (`app/src/test/loopback.js`), and the
  `fake-indexeddb` convention (per-file `new IDBFactory()`, never global).
- **`storage.migrations`** — precedent for inheriting a lifecycle one layer
  down without re-litigating it (its Decision 4).

Pending: none. The consumers that will wrap their work in this lock —
`storage.working_copy` (save = commit + push), `storage.home_book`,
`storage.history`, `storage.download`, and the `sync` engine — are
**downstream** of this task, not dependencies of it.

## What this task is

A small Worker-side primitive that puts a per-book exclusive
[Web Lock](https://developer.mozilla.org/docs/Web/API/Web_Locks_API) around a
unit of git/working-copy work, so two browser tabs editing the same book can
never interleave the many IndexedDB transactions that a single git operation
(clone, fetch, merge, checkout, commit, push) spans. The deliverable is one
module — `app/src/worker/locks.js` — exporting a factory
`createBookLocks({ navigator })` → `{ withLock(bookId, fn) }`. `withLock`
acquires an exclusive Web Lock named for the book, runs `fn` while the lock
is held, and releases it when `fn` settles — resolving with `fn`'s result or
propagating its rejection. Consumers compose their git work by wrapping it in
`withLock(bookId, …)`.

This is the primitive, delivered as a standalone module in the shape
`storage.git` and `storage.fs` established (a Worker primitive, not new store
command/event kinds). It does not itself wire git into the Worker's command
dispatch; the first consumer (`storage.working_copy`) constructs the git
layer and the lock registry in the `createWorkerLogic` closure and composes
them, exactly as `git.js` is consumed rather than self-wired today.

## Why it needs to be done

Every book is a git repository on a lightning-fs filesystem backed by
IndexedDB, operated by isomorphic-git inside the Worker (DIRECTION §3
L105–106). A single git operation is not atomic against IndexedDB: it is a
long sequence of reads and writes across many object-store transactions.
Two tabs of the same origin each run their own Worker, but all tabs share one
browser-level Web Locks broker; without a lock, a fetch/merge in one tab and
a save in another can interleave their transactions and corrupt the working
copy or the `.git` directory. DIRECTION §3 L118–119 makes this a standing
rule of the storage design: **"One lock per book (Web Locks), since a git
operation spans many IndexedDB transactions and two tabs must not interleave
them."** This task turns that rule into a reusable primitive so every later
consumer that mutates a book (save, sync, restore, download, the automatic
home-book commit) runs inside the book's lock.

## Inputs / context

Governing documents (normative — the refinement turns them into a work
order, it does not redesign them):

- `docs/DIRECTION.md:105-106` — "Everything is in the browser: each book is a
  git repository on a filesystem backed by IndexedDB, operated by
  isomorphic-git in a Web Worker."
- `docs/DIRECTION.md:118-119` — **the rule this task implements**: "**One lock
  per book** (Web Locks), since a git operation spans many IndexedDB
  transactions and two tabs must not interleave them."
- `docs/DIRECTION.md:407-409` — §3.7 "**One owner for the data: a Web
  Worker.** It holds git, the working copy and the search index, and does
  every clone, fetch, merge, save and index update. The main thread never
  touches IndexedDB."
- `docs/DIRECTION.md:127-131` — §3.1 Sync: "Fetch, merge, push, retried when
  the push races another." (The lock orders a tab's own operations; git's ref
  locking plus retry still settles a genuine push race between devices — the
  two mechanisms are distinct and complementary.)

Source seams:

- `app/src/worker/git.js:44-92` — `createGitLayer({ fs, http })` →
  `{ clone, fetch, push, bookDir }`; the three ops each take
  `{ dir, url, onProgress }`; `bookDir(bookId)` → `/books/${bookId}`
  (`git.js:63-65`). The operations to serialise.
- `app/src/worker/logic.js:111-180` — `createWorkerLogic(port, options)`; its
  closure already memoises per-Worker singletons (`ensureOpen`, `ensureFs` at
  `logic.js:135-138`, `requestPersistence`) and its `switch (message.kind)`
  in `handle` (`logic.js:157`) is where future git command kinds dispatch.
  The lock registry is the natural companion to `ensureFs` in this closure
  when a consumer wires it. Errors never throw across the port — they surface
  as `ERROR` events (`logic.js:169-178`).
- `api/openapi.yaml:814-818` — the `Id` schema: "An opaque, server-assigned
  identifier." The `bookId` is the single opaque identity shared by the repo
  path (`/books/<id>`), the git URL, and the service's bare repo
  (`DIRECTION.md:186-187`). It is the key the lock names.

Test seams (inherited):

- `app/src/test/web-locks.js:15-85` — `makeLockManager()` (exclusive locks,
  FIFO queue per name, `ifAvailable`, `steal`) and `installWebLocks()`
  (defines `navigator.locks`, returns `restore()`). jsdom provides no
  `navigator.locks`; this shim is the seam. A single shared manager instance
  models the origin's one broker across "tabs."
- `app/src/test/git-http-remote.js:151-169` — `startGitHttpRemote()`, a real
  `git-http-backend` over `node:http` speaking smart-HTTP v1, for the
  composition test against the real git layer.
- `app/vite.config.js:71-79` — the inline Vitest config (`environment:
  'jsdom'`, `setupFiles: ['./src/test/setup.js']`, `include:
  ['src/**/*.{test,spec}.{js,jsx}']`). `scripts/gate` runs `vitest run`. Plain
  JS/JSX, co-located tests; `*.behavior.test.js` is the behavior level for
  headless Worker logic.

## Constraints / requirements

- **The Worker owns it.** The lock lives entirely in the Worker; the main
  thread never acquires it and never touches IndexedDB (DIRECTION §3.7
  L407–409). No new protocol command/event kinds — the lock is a primitive
  consumers compose with, matching `git.md` Decision 4 and the `fs.md`
  primitive pattern.
- **Per book, exclusive.** One exclusive lock per book, keyed on the opaque
  `bookId`. Every git/working-copy operation mutates (fetch and clone write
  packs, refs and the working tree; push updates local refs too), so there is
  no read-only mode to grant concurrently — exclusive is the only mode.
- **The lock spans a logical operation, not a single call.** `withLock(bookId,
  fn)` holds the lock for the whole of `fn`. A consumer's unit of work that is
  several git calls (a save is commit + push; a sync is fetch + merge + push)
  passes one `fn` so the lock is held across all of them and the working copy
  stays consistent for the whole unit — not reacquired per call, which would
  let another tab interleave between the calls.
- **Cross-tab correctness via the native broker.** The lock serialises across
  the origin's tabs because Web Locks are origin-global; a tab that closes
  mid-operation has its held lock released automatically by the browser (the
  lock is bound to the holding context), so a crash or closed tab never
  orphans a book lock.
- **Release on failure.** When `fn` rejects or throws, the lock is released
  and the rejection propagates; a failed operation never leaves a book locked.
  (The caller surfaces the failure as an `ERROR` event per the Worker's
  convention — `logic.js:169-178`.)
- **Non-reentrant, by the native contract.** Web Locks are not reentrant;
  `withLock(bookId, …)` must not be called while the same book's lock is
  already held on the same path, or the inner request queues forever behind
  the outer. The composition rule — one `fn` per logical operation — is the
  mitigation, documented in the module.
- **Injected seam.** `createBookLocks({ navigator = globalThis.navigator })`
  reads `navigator.locks`, overridable in tests (the same injection style as
  `createFileSystem`'s `indexedDB` and `createPersister`'s `navigator`). No
  new runtime dependency — Web Locks is a platform API.
- **No song text in logs.** The lock logs nothing; it carries only an opaque
  `bookId` and never song text (standing rule; `git.js` already logs nothing).
- **Offline first.** The lock is a local coordination primitive; it never
  waits on the network and adds no network dependency.

## Acceptance criteria

**Behavior delivered:** `app/src/worker/locks.js` exports
`createBookLocks({ navigator })` → `{ withLock(bookId, fn) }`. `withLock`
acquires an exclusive Web Lock named `book:${bookId}`, runs `fn` while held,
resolves with `fn`'s value or rejects with its error, and always releases the
lock on settle. Two operations on one book serialise; operations on different
books run concurrently; a second tab's operation on the same book waits for
the first to release.

**Tests it lands with, by level.** The `.tji` note names **behavior** only,
and that is the right and only level: the whole deliverable is the Web-Locks
interaction, which is exactly the behavior level (Worker logic against the
test environment's lock seam); there is no pure unit separable from the lock
manager worth isolating (see Decision 5). No UI is rendered, so no axe check
applies.

- **behavior** — `app/src/worker/locks.behavior.test.js`, driving
  `createBookLocks` over the `installWebLocks()` shim
  (`app/src/test/web-locks.js`):
  - **serialised on one book** — two `withLock('book-a', …)` calls started
    concurrently; the second's `fn` body does not begin until the first's
    `fn` has resolved (proved by an ordering log and a gate promise the test
    controls). Pins DIRECTION §3 L118–119.
  - **concurrent on two books** — `withLock('book-a', …)` and
    `withLock('book-b', …)` started concurrently; both `fn` bodies enter
    before either resolves (proved by overlap). Pins "on two books not"
    (`.tji` note) and the per-book granularity of §3 L118.
  - **a second tab waits** — two `createBookLocks` instances built over **one
    shared** `navigator.locks` manager (modelling two tabs' Workers against
    the origin's single broker); tab B's `withLock('book-a', …)` body does
    not start until tab A releases. Pins "a second tab's operation waits"
    (`.tji` note) and §3.7 L407–409 (one owner; cross-tab via origin-global
    Web Locks).
  - **released on failure** — a `withLock('book-a', …)` whose `fn` rejects
    propagates the rejection and leaves the book unlocked; a following
    `withLock('book-a', …)` proceeds. Pins the release-on-failure constraint.
  - **composes with the real git layer** — `withLock('book-a', …)` wrapping an
    actual `createGitLayer` (`git.js`) clone against `startGitHttpRemote()`
    (`app/src/test/git-http-remote.js`), with `fake-indexeddb` (per-file
    `new IDBFactory()`) and `installWebLocks()` active; a concurrent
    same-book `withLock` waits until the clone completes. Pins "Web Locks
    around every git operation" (`.tji` note) and the composition contract
    named in `git.md` ("`storage.locks` serialises the git operations this
    layer exposes").

The test environment's `makeLockManager` already models exclusive locks and a
FIFO queue per name — enough for all five cases via callback-held locks and
test-controlled gate promises; extend `app/src/test/web-locks.js` only if an
assertion needs observability it does not yet expose (no `shared` mode or
`AbortSignal` is needed, since the lock is exclusive-only and never
cancelled).

No tech debt is deferred: the primitive is self-contained, and its wiring into
git command dispatch belongs to the already-planned downstream consumers
(`storage.working_copy`, `storage.home_book`, `storage.history`,
`storage.download`, the `sync` engine), not to a new task.

## Decisions

1. **Ship the primitive `withLock(bookId, fn)`, not a per-op git decorator.**
   The lock wraps an arbitrary critical section the consumer passes, so a
   logical operation spanning several git calls (save = commit + push; sync =
   fetch + merge + push) holds the lock across the whole unit.
   *Rejected:* a decorator that wraps each of `createGitLayer`'s
   `clone`/`fetch`/`push` individually — it reacquires per call, so two tabs
   could interleave *between* a unit's calls (another tab pushing between this
   tab's fetch and push), which is the exact interleaving §3 L118 forbids. The
   primitive expresses the correct granularity; the per-op decorator cannot.

2. **Lock name `book:${bookId}`, keyed on the opaque book id.** The `bookId`
   is the single identity the API (`api/openapi.yaml:814-818`), the on-device
   repo path (`/books/<id>`, `git.js:63-65`) and the git URL all share.
   *Rejected:* keying on the derived filesystem path or the git URL — both are
   functions of `bookId` and add nothing but a chance of mismatch. The
   `book:` prefix namespaces the lock so it never collides with lightning-fs's
   own locks, which it keys on the FS name (`estante-fs`), not a `bookId`.

3. **Exclusive mode only.** Every git/working-copy operation mutates the repo,
   so there is no safe concurrent-reader case.
   *Rejected:* a shared/exclusive split for read-only history or search — the
   search index is derived and kept separately (DIRECTION §3 L114–117), and
   history reads go through git operations that still write packs/refs; a
   shared mode would add API surface with no present reader that can run
   concurrently with a writer safely.

4. **No wiring into `logic.js` dispatch in this task.** `locks.js` is a
   standalone primitive, like `git.js`; the first consumer constructs the lock
   registry in the `createWorkerLogic` closure (beside `ensureFs`) and
   composes it with the git layer.
   *Rejected:* instantiating the registry and adding git command kinds now —
   there is no consumer to dispatch to yet (`git.js` itself is unwired by the
   same reasoning, `git.md` Decision 4); premature wiring would ship dead code
   and pre-empt the consumer's design.

5. **Behavior level only; no unit level added.** The `.tji` note names
   behavior, and the deliverable is wholly the Web-Locks interaction, which
   the behavior level exercises against the test environment's lock seam. A
   unit test of a thin `book:${bookId}` name helper or of `withLock` against a
   hand-rolled fake would only re-assert the shim.
   *Rejected:* adding a unit level — it would pin the fake, not behavior; the
   project's testing policy favours pinning observable behavior, and no
   named level is being dropped (the note does not name unit).

6. **Non-reentrant, matching the native Web Locks contract.** The composition
   rule (one `fn` per logical operation) keeps callers from nesting a
   same-book acquisition.
   *Rejected:* a per-Worker reentrancy guard (a held-set that runs a nested
   same-book `fn` inline) — defensible, but there is no consumer that nests
   today, and adding it now is an abstraction without a call site; the native
   contract plus the documented composition rule is simpler, and the guard is
   a trivial, isolated change if a future consumer genuinely needs it.

No design delta: DIRECTION §3 L118–119 already states the rule; this task
implements it and does not alter designed behavior. The granularity decision
(1) is an elaboration of DIRECTION's own rationale ("a git operation spans
many IndexedDB transactions"), not a deviation.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `app/src/worker/locks.js` (new): exports `createBookLocks({ navigator })` → `{ withLock(bookId, fn) }`, acquiring an exclusive Web Lock named `book:${bookId}`, running `fn` while held, and resolving with `fn`'s value or propagating its rejection — always releasing on settle.
- `app/src/worker/locks.behavior.test.js` (new): five behavior tests — serialised on one book, concurrent on two books, a second tab waits, released on failure, and composes with the real git layer (clone against `startGitHttpRemote()` + `fake-indexeddb` + `installWebLocks()`).
- `app/src/test/web-locks.js` (updated): `request()` now settles with the callback's return value or rejection (the contract `withLock` relies on), and `ifAvailable`/`steal` support is preserved.
