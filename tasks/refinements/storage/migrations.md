# storage.migrations — On-device versions

## TaskJuggler entry

[`tasks/40-storage.tji`](../../40-storage.tji), `task storage.migrations`
(lines 63–68), under `task storage`. The one-line note: "Versioned
migrations of what the Worker keeps in IndexedDB; an app update applied on
the next launch, never mid-song."

The Worker is the single owner of the on-device data (DIRECTION §3.7
L394–396); this task gives that owner a way to evolve the shape of what it
keeps in IndexedDB across app updates, applied once per launch.

## Effort estimate

**1d** (as scoped in the `.tji`).

## Repository

**estante-de-cifras**, `app/` — specifically the Web Worker logic under
`app/src/worker/` and its co-located tests. Not a `cifra.md:` task: nothing
here touches the format, the spec, the reference or the corpus. The app and
the service share no code (DIRECTION §3.6 L275–278); the service's own
Postgres migrations are a separate task (`service.schema`,
[`tasks/30-service.tji`](../../30-service.tji) lines 9–12) and share nothing
with these.

## Inherited dependencies

- **`storage.worker`** — *settled, Done 2026-10-05*
  ([`worker.md`](worker.md)). This task builds directly on the seam that
  refinement left:
  - The Worker logic is the sole IndexedDB owner, transport-agnostic, with
    the IndexedDB factory and database name dependency-injected
    (`app/src/worker/logic.js:72–74`: `options.indexedDB`, `options.name`).
    The main thread never touches IndexedDB (DIRECTION §3.7 L396); migration
    stepping must therefore live **inside** the Worker logic, not on the
    main thread. (worker.md Decision 1.)
  - The database `estante` opens at an initial schema version with a single
    keyless `meta` object store, and the `meta` record is stamped with
    `schemaVersion` (`logic.js:18–21`, `:26–39`, `:53–57`). The comment at
    `logic.js:15–17` names this task explicitly: "`storage.migrations` steps
    the version later (this task only opens at the initial one). Decision 7."
    **The seam exists; this task implements the stepping.** (worker.md
    Decision 7, L310–316.)
  - The next-launch update lifecycle is already decided and configured:
    `skipWaiting: false` in `app/vite.config.js:47–52` ("an update must
    still ask before replacing what someone is using … no user action is
    lost"), with the rationale recorded in worker.md Decision 6 (L304–309):
    the service worker's non-skip-waiting update "guarantees the Worker and
    main thread are always the same build within one load, so skew cannot
    occur mid-session." This task **consumes** that guarantee; it does not
    re-establish it. (See Decisions §6.)
  - The behavior-test harness is in place: `fake-indexeddb ^6.2.5` imported
    per-test (worker.md Decision 4), the in-process loopback transport
    (`app/src/test/loopback.js`), and the error-as-event path
    (`logic.js:104–113`). Tests here reuse all three.

- **`foundation.app_tooling`** — *settled* (transitively, via
  `storage.worker`): plain JS/JSX, Vitest in jsdom, co-located `*.test.js`
  tests, `vitest-axe` via `app/src/a11y/axe.js`.

No pending dependencies: `storage.migrations` depends only on `!worker`,
which is Done.

## What this task is

The Worker keeps a growing amount of state in one IndexedDB database
(`estante`): today just a `meta` record, and over the following storage
tasks a filesystem backing store, book repositories, the working copy and
the search index. When a new build of the app changes the shape of that
on-device state — a new object store, a new index, a reshaped record — the
database on an existing device must be stepped from the version it holds to
the version the new build expects, in order, without losing data. This task
turns the single-version-open the Worker does today into a **versioned
migration framework**: an ordered list of migration steps, each taking the
database from version N−1 to version N; the database opens at the latest
version; every step between the version found on disk and the latest runs in
order inside the one IndexedDB `versionchange` transaction; the `meta`
record's `schemaVersion` is updated to match. Because the app is a PWA whose
service worker does not skip waiting (`vite.config.js:52`), a new build — and
therefore the migration it carries — only takes over on the **next launch**,
never mid-session, so a migration never runs under a song the user is
editing.

## Why it needs to be done

Every later storage task adds to what the Worker keeps in IndexedDB —
`storage.fs` a filesystem store, `storage.git`/`storage.working_copy` book
repositories and working trees, `storage.index` the MiniSearch index kept in
IndexedDB (`tasks/40-storage.tji` lines 15–61). Without a migration
framework, each of those would have to invent its own ad-hoc version bump, or
worse open the database at a hand-picked version and create stores outside an
upgrade transaction — the two ways to corrupt an IndexedDB database on a
user's only copy of their books. This task gives all of them one disciplined
seam: append a step, bump the derived version. It is also a direct dependency
of the app shell: `storage.shell` (`tasks/50-shell.tji:41`,
`depends … storage.migrations`) needs the database opened and migrated at
launch before the shell renders. And it protects the standing offline-first
rule — nothing the user does is lost (`vite.config.js:48–50`) — by binding
migrations to the next-launch lifecycle rather than letting a schema change
land under live edits.

## Inputs / context

- **DIRECTION §3 — Storage** (`docs/DIRECTION.md` L97–119). What the Worker
  keeps in IndexedDB: "each book is a git repository on a filesystem backed
  by IndexedDB, operated by isomorphic-git in a Web Worker" (L99–100); a real
  working copy (L102–104), a derived index keyed by blob hash (L108–111),
  one lock per book (L112–113), `navigator.storage.persist()` and an export
  (L114–115). These are the shapes future migration steps will carry.
- **DIRECTION §3.7 — the app** (`docs/DIRECTION.md` L381–414). "One owner
  for the data: a Web Worker. … The main thread never touches IndexedDB"
  (L394–396). "installed and cached up front" (quoted in `vite.config.js:38`,
  DIRECTION L384). Vite and the PWA plugin are the carried-over tooling
  (L411–413).
- **DIRECTION §3.6 — Versions** (`docs/DIRECTION.md` L289–293). "the app
  carries only the current one, and rewrites its saves not yet pushed when it
  updates." This is the format-conformance sibling of on-device schema
  versioning: both are version-at-update behaviors keyed to a new build. (It
  governs canonical-form rewriting, done in `storage.working_copy`, not this
  task; cited for the shared update-time spirit.)
- **The seam this task extends** — `app/src/worker/logic.js`:
  - `SCHEMA_VERSION`/`DB_NAME`/`META_STORE`/`META_KEY` constants (`:18–21`).
  - `openDatabase(idb, name, version)` and its `onupgradeneeded` that does
    first-time `meta`-store creation only (`:26–39`); `onblocked` rejects
    with `database open blocked` (`:37`).
  - `loadOrCreateMeta` and the `meta` record shape
    `{ schemaVersion, protocolVersion, createdAt }` (`:44–65`, record at
    `:53–57`).
  - `createWorkerLogic(port, options)` with injected `options.indexedDB` /
    `options.name` (`:72–74`), `ensureOpen()` opening once at
    `SCHEMA_VERSION` (`:77–80`), and the error-as-event path (`:104–113`).
  - The comment naming this task: `logic.js:15–17`.
- **The update lifecycle** — `app/vite.config.js:36–53`: `registerType:
  'prompt'` (`:39`), `skipWaiting: false` (`:52`) with the comment "an update
  must still ask before replacing what someone is using (standing offline
  rule — no user action is lost)" (`:48–50`); and `protocol.js` header
  comment (reported at `:12–15`) on the same-build-per-load guarantee.
- **The test harness** — `app/src/test/loopback.js` (in-process transport),
  `app/src/worker/store.test.js` (the fake-IndexedDB open/recover pattern to
  mirror), `app/src/test/setup.js` (matchers, `afterEach(cleanup)`),
  `app/package.json` (`fake-indexeddb ^6.2.5`, `vitest`, test script
  `vitest run`).
- **Predecessor refinement** — [`worker.md`](worker.md), Decisions 1, 4, 6, 7
  (the IndexedDB-ownership, fake-IndexedDB, next-launch, and
  minimal-ownership decisions this task inherits).
- **Sibling convention** — `service.schema`
  (`tasks/30-service.tji` lines 9–12) tests "every migration applied from
  empty to the latest." This task mirrors that philosophy for the on-device
  database (see Acceptance criteria).

## Constraints / requirements

- **Stepping lives in the Worker logic.** All IndexedDB access stays inside
  `app/src/worker/` (the main thread never touches IndexedDB — DIRECTION
  §3.7 L396). The migration framework is a Worker-side module consumed by
  `logic.js`, not by the store, the hook or any view.
- **Structural changes happen only in the `versionchange` transaction.**
  Creating or deleting object stores and indexes, and any data transform that
  must be atomic with them, run inside `onupgradeneeded`, using
  `request.result` and its `transaction`. Nothing restructures the database
  after open. (Doing otherwise is the classic IndexedDB corruption bug on a
  user's only copy of their books.)
- **One database, one monotonic version, one ordered step list.** There is a
  single database (`estante`) with a single integer schema version. Steps are
  contiguous integers from 1; the latest version is **derived** from the step
  list, not hand-maintained in parallel — bumping the schema means appending a
  step, nothing else. No task opens the database at an ad-hoc version or
  creates stores outside the framework.
- **Idempotent, forward-only, in order.** A step is guarded so re-running it
  over an already-upgraded database is safe (as today's `contains()` guard is
  — `logic.js:31`). Only steps with `oldVersion < step.version <= newVersion`
  run, in ascending order. No down-migrations: the app carries only the
  current build (DIRECTION §3.6 L289–293), so a database is only ever stepped
  forward.
- **A failed migration leaves the prior version intact.** If a step throws,
  the `versionchange` transaction aborts, the database stays at the version it
  held, and the open fails — surfaced through the existing error-as-event path
  (`logic.js:104–113`) rather than leaving a half-migrated store. No user data
  is destroyed by a failed upgrade.
- **Applied on the next launch, never mid-song.** The task relies on the
  configured `skipWaiting: false` lifecycle (`vite.config.js:52`): a new
  build, and the migration it carries, only activates when the app is next
  launched (all old clients gone), so within one load the Worker and main
  thread are the same build and no migration runs under a live edit. This
  task adds no runtime version negotiation and no mid-session re-open (worker
  Decision 6). An old client still holding the database open at the prior
  version blocks the upgrade (`onblocked`, `logic.js:37`); the Worker reports
  that as an error rather than hanging, consistent with the next-launch
  guarantee.
- **The `meta` record tracks the version.** After an upgrade the `meta`
  record's `schemaVersion` reflects the version actually on disk, so a fresh
  Worker instance can read what shape it is looking at.
- **Standing rules.** No song text in logs — this module logs nothing and
  stores only schema `meta` and (later) opaque book data it does not inspect
  (`logic.js:9–11`). Offline-first — migrations never wait on the network and
  the user's unpushed work is preserved across them. Accessibility and
  "no book without an account" do not apply: this task renders no UI and makes
  no network request.

## Acceptance criteria

**Behavior delivered.**

- A migration framework in `app/src/worker/` (proposed `migrations.js`): an
  **ordered list of steps** `{ version, label, upgrade(db, tx, oldVersion) }`
  starting at 1; `latestVersion(steps)` deriving the current version from the
  list (and asserting the versions are contiguous from 1); `runMigrations(db,
  tx, oldVersion, newVersion, steps)` running each step in
  `(oldVersion, newVersion]` in ascending order.
- The existing first-time `meta`-store creation (`logic.js:29–34`) becomes
  **step 1** of the list, so the framework is exercised from the very first
  open and today's behavior is preserved.
- `logic.js` consumes the framework: `SCHEMA_VERSION` is **derived** from the
  step list (single source of truth); `openDatabase`'s `onupgradeneeded` calls
  `runMigrations` with the event's `oldVersion`/`newVersion` and the
  `versionchange` transaction; after open, the `meta` record's
  `schemaVersion` is set to the version on disk. The step list is injectable
  (`options.migrations ?? MIGRATIONS`), reusing the existing `options`
  injection seam (`logic.js:72–74`) so tests can exercise multi-step
  stepping without fabricating future production schema.
- A failed step aborts the upgrade and surfaces an error event; the database
  stays at the prior version.

**Tests the task lands with, by level** (levels from the note: **unit** and
**behavior**):

- **unit — `app/src/worker/migrations.test.js`** (Vitest, jsdom, no
  IndexedDB needed for the pure functions): `latestVersion` returns the
  highest step version and rejects a gap in the sequence; `runMigrations` runs
  exactly the steps in `(oldVersion, newVersion]`, in ascending order, and no
  others (synthetic multi-step list; order recorded) — pins "unit (each
  migration step)" (`tasks/40-storage.tji:67`); the real **step 1** creates
  the `meta` object store and is idempotent when the store already exists —
  pins the inherited `meta`-store seam (`logic.js:29–34`); a throwing step
  propagates so the caller can abort the transaction — pins the
  failed-migration constraint.
- **behavior — `app/src/worker/migrations.behavior.test.js`** (Vitest,
  `fake-indexeddb` per-test, loopback where a command/event path is involved —
  worker.md Decisions 4, 2):
  - *version N opened by N+1 and migrated*: open `estante` at version N over a
    fresh `IDBFactory` with a synthetic step list, seed a record; open a
    second logic instance built at version N+1 over the **same** factory →
    `onupgradeneeded` runs the N→N+1 step(s), the new store/data is present,
    and `meta.schemaVersion === N+1` — pins "behavior (a store at version N
    opened by N+1 in a fake IndexedDB and migrated)"
    (`tasks/40-storage.tji:67`).
  - *empty to latest in one open*: a fresh factory opened at the latest
    version runs every step in order from empty — mirrors the
    `service.schema` "from empty to the latest" convention
    (`tasks/30-service.tji:12`).
  - *an update held until the next launch*: while a first logic instance
    holds the database open at version N, the database stays at version N (no
    migration fires mid-session); only a second instance built at N+1 — the
    next launch — triggers the upgrade, and an N-version connection still open
    blocks it (`onblocked` → error event, not a hang) — pins "behavior (…;
    an update held until the next launch)" (`tasks/40-storage.tji:67`) and
    the `skipWaiting: false` guarantee (`vite.config.js:52`, worker Decision
    6).
  - *a failed migration leaves the prior version intact*: a throwing step
    aborts the upgrade; the database remains at the prior version and the
    Worker emits an `ERROR` event through the loopback rather than opening a
    half-migrated store — pins the failed-migration constraint and the
    error-as-event path (`logic.js:104–113`).

**Why no e2e-web / e2e-api / axe.** The note scopes unit + behavior only.
This task is pure Worker logic with no screen rendered and no HTTP call, so
e2e-web, e2e-api and an axe check have nothing to assert here. The
service-worker *activation* lifecycle itself (a new build waiting, then
taking over on reload) is build-config behavior owned by the PWA plugin and
worker.md Decision 6, not code this task writes; this task tests the
IndexedDB stepping and its next-launch consumption at the behavior level. The
first screen that renders over a migrated database — the app shell — carries
the e2e-web journey in `storage.shell` (`tasks/50-shell.tji`).

**Deferred work.** None registered. The framework is complete for the state
that exists today; each later storage task (`storage.fs`, `storage.git`,
`storage.working_copy`, `storage.index`, `storage.home_book`) lands its own
migration **step** as part of its own work when it adds to the on-device
shape — those are existing WBS leaves, not deferrals of this task, and each
carries its own tests. No "add tests for X" and no audit/revisit task.

## Decisions

1. **One module of ordered, injectable steps; the latest version is
   derived.** `migrations.js` exports an array of `{ version, label, upgrade }`
   steps and derives `SCHEMA_VERSION` from it. Rationale: a single source of
   truth means bumping the schema is appending one step — the version can
   never drift from the steps, and a reviewer reads the whole history in one
   place. Injecting the list (`options.migrations`, reusing the existing
   `options` seam) lets behavior tests exercise genuine multi-step stepping
   today, when only one real step exists. *Rejected:* a hand-maintained
   `SCHEMA_VERSION` constant alongside a `switch (oldVersion)` in
   `onupgradeneeded` — the constant and the switch drift, and the switch is
   not independently testable. *Rejected:* fabricating a no-op "version 2"
   production step purely to have something to test against — dead schema the
   next real step would have to work around.

2. **Stepping runs inside the `versionchange` transaction, forward only,
   idempotent.** `runMigrations` is called from `onupgradeneeded` with the
   event's `oldVersion`/`newVersion` and the upgrade transaction; each step is
   guarded so re-running is safe. Rationale: structural IndexedDB changes are
   only valid inside that transaction, and atomicity there is what keeps a
   half-applied upgrade from corrupting a user's only copy of their books; the
   app carries only the current build (DIRECTION §3.6 L289–293), so forward is
   the only direction. *Rejected:* opening at a version, then creating stores
   on a later ordinary transaction — invalid IndexedDB and the canonical
   corruption bug.

3. **A failed step aborts the upgrade; the database stays at the prior
   version and the failure is an event.** Rationale: IndexedDB aborts the
   whole `versionchange` transaction when a step throws, so the on-disk
   version does not advance and no store is half-built; surfacing it through
   the existing error-as-event path (`logic.js:104–113`) keeps the "never
   throw across the port" contract and loses no data. *Rejected:* catching and
   continuing past a failed step — that is exactly how a half-migrated store
   ships.

4. **The next-launch / never-mid-song lifecycle is inherited, not
   re-established — so no design delta.** The mechanism (`skipWaiting: false`,
   `registerType: 'prompt'`) is already configured in `vite.config.js:39,52`
   with its rationale, and the same-build-per-load guarantee is already
   recorded in worker.md Decision 6 and the `protocol.js` header comment. This
   task consumes that guarantee and tests the migration side of it; it adds no
   runtime version negotiation and no mid-session re-open. Rationale: DIRECTION
   does not state the update-activation timing in words, but the behavior is
   already settled one layer down (a predecessor refinement decision + the PWA
   config + code comments), and the brief's bias is to reuse existing seams
   over amending the constitution for a 1d task. *Rejected:* a DIRECTION §3.7
   delta adding the lifecycle sentence — the behavior is already decided and
   documented; a new delta would duplicate worker.md Decision 6 rather than
   close a genuine gap. (Surfaced in the return summary for the parking lot in
   case the maintainers want the lifecycle promoted into DIRECTION later.)

5. **The `meta` record tracks the on-disk version.** After an upgrade the
   `meta.schemaVersion` is set to the version on disk. Rationale: a fresh
   Worker instance reads `meta` to know what shape it is looking at
   (`logic.js:44–65`); keeping it in step with the upgrade means the record
   never lies about the database. *Rejected:* deriving the version only from
   `db.version` at open — true, but the `meta` record already carries
   `schemaVersion` by design (worker.md), and keeping it honest costs one
   write already on the upgrade path.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- Created `app/src/worker/migrations.js` — the versioned migration framework: `MIGRATIONS` ordered steps (`{ version, label, upgrade }`), `latestVersion` deriving the current version from the list (with contiguity assertion), `runMigrations` executing only the steps in `(oldVersion, newVersion]` in ascending order, and `META_STORE` re-exported for `logic.js`.
- Edited `app/src/worker/logic.js` — `SCHEMA_VERSION` is now derived from the step list (single source of truth); `openDatabase`'s `onupgradeneeded` calls `runMigrations` with the event's `oldVersion`/`newVersion` and the `versionchange` transaction; `loadOrCreateMeta` stamps `schemaVersion` from the on-disk version; `options.migrations` injection seam added alongside existing `options.indexedDB` / `options.name`. The inline meta-store creation is now step 1 of `MIGRATIONS`.
- Created `app/src/worker/migrations.test.js` — unit tests: `latestVersion` (highest version, gap rejection, empty list), `runMigrations` ((old,new] range, ascending order, empty-to-latest, no-op), real step 1 (creates meta store, idempotent), throwing step propagates.
- Created `app/src/worker/migrations.behavior.test.js` — behavior tests: version N opened by N+1 and migrated (data preserved); empty→latest in one open (synthetic + real production schema); update held until next launch (open N-version connection blocks → error event, not hang); failed migration leaves prior version intact (error event, data survives).
