# storage.worker — The Worker and its store protocol

## TaskJuggler entry

[`tasks/40-storage.tji`](../../40-storage.tji), `task storage.worker` (lines
9–13). One owner for the data; messages to the main thread's store, read
through `useSyncExternalStore`. The main thread never touches IndexedDB.
DIRECTION §3.7.

## Effort estimate

**3d** (as scoped in the `.tji`).

## Repository

**estante-de-cifras**, in `app/`. New code under `app/src/worker/` and
shared test support under `app/src/test/`. This is not a `cifra.md:` task.
The app and the service share no code (DIRECTION §3.6 L275–278); nothing
here imports from `service/`.

## Inherited dependencies

- **`foundation.app_tooling`** — *settled* (Done 2026-10-05,
  [`tasks/refinements/foundation/app_tooling.md`](../foundation/app_tooling.md)).
  It stood up the app package and fixes the ground this task builds on:
  - Plain **JavaScript + JSX, no TypeScript** (app_tooling.md:264–275;
    `app/package.json` `"type": "module"`). This task writes `.js` / `.jsx`,
    never `.ts`.
  - **Vite 8 + Vitest 5**, test block inline in `app/vite.config.js`
    (lines 71–79): `environment: 'jsdom'` (line 76),
    `setupFiles: ['./src/test/setup.js']` (line 77),
    `include: 'src/**/*.{test,spec}.{js,jsx}'` (line 78).
  - **Testing Library + `vitest-axe`** behind the shared helper
    `app/src/a11y/axe.js`, pinned to WCAG 2.1 AA (app_tooling.md:284–293).
    `app/src/test/setup.js` registers the jest-dom and vitest-axe matchers.
  - Tests **co-located** beside the module; `*.test.js` where there is no
    JSX, `*.test.jsx` where a component is rendered (app_tooling.md:216–238,
    343–344).
  - app_tooling deliberately stopped at the **cached PWA shell** and the
    view/test scaffold; the **Worker-owned, IndexedDB-backed data layer is
    this storage stream's work** (app_tooling.md:178–183, 259–260). This
    task opens that seam.
- **Context (not a formal predecessor):**
  [`foundation.music_core_import`](../foundation/music_core_import.md) —
  the music core under `app/src/core/`, `app/src/render/`,
  `app/src/data/`, `app/src/i18n/` is already **framework-free and
  worker-portable by design** (`app/src/data/instruments.js:5`: "core/ must
  stay portable enough to run in a Web Worker or a bare Node process";
  `app/src/core/search.js` is synchronous). The Worker built here is where
  that core will eventually run; this task only stands up the Worker and its
  protocol, not the core's use of it.

## What this task is

Stand up the **one Web Worker that owns the data** and the plumbing that
connects it to the interface, as the skeleton every later storage and sync
task layers onto. Concretely:

1. A **message protocol** — plain, structured-cloneable, versioned
   envelopes in both directions: *commands* from the main thread to the
   Worker, *events* from the Worker to the main thread, with an extensible
   `kind` so later tasks (a clone's progress, a merge landing, a sync
   finishing) add message types without reshaping the channel.
2. The **Worker logic** — a transport-agnostic module that handles commands,
   owns the Worker's IndexedDB connection, and emits events through an
   injected port. Because it is transport-agnostic it runs **in-process** in
   a test (jsdom has no `Worker`), fed a fake IndexedDB.
3. The **Worker thread entry** — a thin adapter that wires that logic to the
   real worker global (`self.onmessage` / `self.postMessage`), plus the
   main-thread factory that spawns the real `Worker`.
4. The **main-thread store** — holds state built by folding incoming events
   through a pure reducer into named **slices**, each with a stable
   reference so unrelated changes do not churn it; sends commands down the
   port; exposes `subscribe` + per-slice snapshots.
5. The **`useSyncExternalStore` binding** — a hook that subscribes a
   component to one slice so it re-renders only when that slice changes.
6. The **behavior-test harness for the Worker**: `fake-indexeddb` wired for
   in-process Worker-logic tests, an in-process loopback transport double,
   and a reusable **local git remote served over HTTP** helper, ready for
   the git-driven storage and sync tasks that follow.

Explicitly **out of scope** (owned by later tasks that `depends !worker`):
the filesystem interface (`storage.fs`, lightning-fs), isomorphic-git
(`storage.git`), the working copy and save/discard (`storage.working_copy`),
the search index (`storage.index`), the home book (`storage.home_book`),
history, download, and the migration *stepping* logic (`storage.migrations`
— this task only opens the database at an initial schema version and leaves
the version record it will step).

## Why it needs to be done

Everything the device does with books runs through this Worker. The whole
storage tree (`fs`, `git`, `working_copy`, `locks`, `home_book`, `index`,
`history`, `download`, `migrations`) hangs off `storage.worker`, and the
entire sync tree (`sync.*`, workflows 7–11) hangs off `storage.working_copy`
below it. The interface cannot read a book, a shelf, or a sync state except
as a slice this store exposes. Nothing downstream can be written until the
message channel, the store, and the behavior-test harness exist — the note
calls out that this task "sets up the behavior level for the Worker," which
later tasks' `Tests: behavior (… against a fake IndexedDB and a local git
remote)` clauses depend on.

## Inputs / context

Governing text (all normative; this refinement turns it into a work order,
not a redesign):

- **DIRECTION §3** (`docs/DIRECTION.md` L97–119) — the storage model:
  "Everything is in the browser: each book is a git repository on a
  filesystem backed by IndexedDB, operated by isomorphic-git in a Web
  Worker." (L99–100); working copy "written to storage as they type, so
  closing the tab loses nothing" (L102–104); save is a separate commit+push
  (L105–107); the blob-hash-keyed index (L108–111); one Web Lock per book
  (L112–113); `navigator.storage.persist()` (L114–115).
- **DIRECTION §3.1** (L121–128) — sync is fetch/merge/push; every git
  request to a hosted book goes through the one server. (Context for the
  event kinds the protocol must leave room for; sync lands later.)
- **DIRECTION §3.2** (L130–138) — personal state lives in an
  auto-committed home book. (Context; `storage.home_book`.)
- **DIRECTION §3.6** (L264–379) — components and repositories; **"The app
  and the service share no code, only the HTTP API and the format."**
  (L275–278). The app carries only the current spec version (L289–293) —
  distinct from, but the same spirit as, versioning the Worker protocol and
  the IndexedDB schema.
- **DIRECTION §3.7** (L381–414) — **the authoritative spec for this task:**
  - L394–396: "**One owner for the data: a Web Worker.** It holds git, the
    working copy and the search index, and does every clone, fetch, merge,
    save and index update. The main thread never touches IndexedDB."
  - L397–401: "A store on the main thread is fed by the Worker's messages,
    and components read the slices they need through `useSyncExternalStore`;
    the React Compiler keeps re-rendering to what changed. A sync finishing,
    a merge landing, a clone's progress: each is a message, and only what
    shows it moves."
  - L402–404: "**Framework-free below the view.** … the view is the only
    layer that does [know React]."
  - L411–413: tooling (Vite, Vitest + Testing Library, axe WCAG 2.1 AA).
- **App package as it stands:** `app/vite.config.js` (Vitest block L71–79,
  build target `es2022` L17, `vite-plugin-pwa` with `skipWaiting: false`
  L36–69); `app/src/main.jsx` (mounts `<App/>` only); `app/src/test/setup.js`
  (matcher registration, `afterEach(cleanup)`); `app/src/a11y/axe.js` (the
  AA axe helper); `app/package.json` (scripts `test` = `vitest run`,
  `lint` = `eslint .`; **no** `fake-indexeddb`, `isomorphic-git`,
  `lightning-fs`, or worker dep today).

No invented references. The git-over-HTTP *wire contract* for hosted books
lives in `api/openapi.yaml` (opaque `application/x-git-*` bodies; git owns
the framing) per `foundation.api_contract`; this task's git-HTTP helper is
**test infrastructure**, not that endpoint.

## Constraints / requirements

- **The boundary is the point.** The main thread (store, hook, any view)
  **never** references `indexedDB`, lightning-fs, isomorphic-git, or a
  filesystem; it talks to the Worker only through the message port
  (DIRECTION §3.7 L394–396). IndexedDB is opened **only** inside the Worker
  logic. The store and hook modules import nothing from `app/src/worker/`
  except the protocol constructors and the store/hook themselves.
- **Framework-free below the view** (L402–404). `protocol.js`, `reducer.js`,
  `logic.js`, `attach-worker.js`, `store.js` import no React. Only the hook
  (`useStore.js`, which uses `useSyncExternalStore` from `react`) and the
  components that call it know React.
- **Messages are structured-cloneable** — plain objects only (no functions,
  no class instances, no DOM nodes), since they cross `postMessage`. The
  protocol constructors produce such objects; the reducer and logic never
  put a non-cloneable value on the wire.
- **Slices are referentially stable.** The reducer returns the *same*
  reference for a slice that did not change, so a component subscribed to
  slice A does not re-render when slice B moves ("only what shows it moves",
  L397–401). `useSyncExternalStore`'s `Object.is` bail-out does the rest.
- **Protocol and schema are versioned.** A protocol-version constant rides
  on the envelope; the IndexedDB database opens at an initial schema version
  with the version record `storage.migrations` will later step. No runtime
  version *negotiation* is built: the service worker (`skipWaiting: false`,
  update on next launch) guarantees the Worker and main thread are always
  the same build within one load, so skew cannot occur mid-session.
- **Offline first.** Nothing here reaches the network; the channel and store
  work entirely on-device. (The one server and sync are downstream.)
- **No song text in logs.** The Worker and store log nothing containing song
  text, commit messages, or secrets; test fixtures use purpose-written data,
  never anyone's words.
- **Accessibility.** The one rendered test fixture (the re-render proof) is
  axe-clean at WCAG 2.1 AA through `app/src/a11y/axe.js`; status in any
  surface is a word, not colour.
- **Canonical form / no book without an account** — **not applicable** to
  this task: no song is written or canonicalised (that is
  `storage.working_copy` + `cifra_js.writer`), and no book is fetched (no
  network). Noted so the closer sees they were considered.

## Acceptance criteria

**Behavior delivered**

- A versioned, structured-cloneable message protocol with command (main →
  Worker) and event (Worker → main) envelopes and an extensible `kind`.
- Worker logic that handles commands, opens and owns its IndexedDB database
  at an initial schema version, persists its own `meta` record, and emits
  events — running either on a real Worker thread or in-process behind an
  injected port.
- A thin Worker-thread entry wiring the logic to `self` via
  `attachWorker(scope, logic)`, and a main-thread `createWorkerStore()` that
  spawns the real `Worker` (`new Worker(new URL('./index.js',
  import.meta.url), { type: 'module' })`) and wraps it in the store.
- A main-thread store whose state is built by a pure reducer folding events
  into referentially-stable named slices, with `subscribe` and per-slice
  snapshots, sending commands down the port.
- A `useSlice(store, name)` hook over `useSyncExternalStore` that re-renders
  a component only when its slice changes.
- The behavior-test harness: `fake-indexeddb` wired for in-process
  Worker-logic tests, an in-process loopback transport double, and a
  reusable local-git-remote-over-HTTP helper.

**Tests the task lands with** (levels from the note: **unit** and
**behavior**; the extension tracks JSX usage, the level is named here):

- **unit — `app/src/worker/protocol.test.js`:** the message protocol — the
  envelope shape and version field, the command and event constructors, the
  extensible `kind`, and that every produced message is structured-clone-safe
  (round-trips through `structuredClone`). Pins DIRECTION §3.7 L397–401
  ("each is a message").
- **unit — `app/src/worker/reducer.test.js`:** the store's reducer — each
  event folds into its slice; a slice that did not change keeps the same
  reference (`Object.is`) while the changed slice is a new object. Pins
  §3.7 L397–401 ("only what shows it moves").
- **unit — `app/src/worker/attach-worker.test.js`:** `attachWorker(scope,
  logic)` against a fake worker-scope double — a `message` delivered to the
  scope reaches `logic`, and an event from `logic` is `postMessage`d on the
  scope; pins the thread-wiring adapter without a real `Worker`. Pins §3.7
  L394–396 (the boundary).
- **behavior — `app/src/worker/store.test.js`** (plain JS; the Worker's
  storage logic against a fake IndexedDB per the README behavior level):
  the store fed by the Worker's logic **in-process** through the loopback
  transport against `fake-indexeddb` — a command round-trips to an event
  that updates a slice; the `meta` state is persisted and a **fresh**
  Worker-logic instance over the **same** fake database recovers it; the
  store never reaches IndexedDB except through the Worker logic. Pins §3.7
  L394–401 and §3 L99–100.
- **behavior — `app/src/worker/useStore.test.jsx`** (Testing Library + axe):
  two components each subscribe to a different slice through `useSlice`;
  changing slice A re-renders only component A (a render-count spy proves
  component B does not re-render); the rendered fixture is axe-clean at WCAG
  2.1 AA via `app/src/a11y/axe.js`. Pins §3.7 L397–401.
- **behavior — `app/src/test/git-http-remote.test.js`** (Node; readies the
  Worker behavior level): the harness serves a seeded temporary repository
  over git smart HTTP **protocol v1**; the `git` CLI clones it over HTTP and
  reads the seeded commit; the server tears down cleanly. Pins the note's
  "a local git remote served over HTTP inside the test," so
  `storage.git` / `storage.working_copy` / `sync.engine` test against it.

**Real-thread coverage (not deferred).** The one line unit tests cannot
reach in jsdom — `new Worker(new URL('./index.js', …))` inside
`createWorkerStore()` — carries no logic: the logic it wires is fully
covered in-process (`store.test.js`) and the adapter is covered with a fake
scope (`attach-worker.test.js`). The real browser `Worker` instantiation is
exercised at **e2e-web** by the first shell task that mounts the Worker
(`shell.layout` / `shell.pwa` on the compose stack) — natural downstream
coverage, not a test deferred out of this task.

No tech debt is deferred: the task is self-contained and lands with every
test named above.

## Decisions

1. **Worker *logic* separated from the Worker *thread* (transport-agnostic),
   so it runs in-process in tests.** jsdom has no `Worker`, and the note
   requires "the store fed by the Worker's logic in-process against a fake
   IndexedDB." A `logic.js` that takes an injected port and emits events
   runs identically behind the real worker global or behind a loopback
   double. *Rejected:* a jsdom `Worker` polyfill — none is reliable for
   module workers, it is heavy, and it would hide the very boundary we are
   building. The in-process seam is also what every later storage/sync
   behavior test needs.
2. **The store codes to the DOM `{ postMessage, onmessage }` endpoint
   shape; a loopback double in tests, a real `Worker` in production; async
   delivery in both.** A real `Worker` and `MessagePort` already satisfy
   this shape, so production wiring is a no-op; the loopback delivers on a
   microtask so tests exercise the genuine async path (awaited via
   `waitFor`/`findBy`). *Rejected:* a bespoke RPC library — a new dependency
   when the DOM messaging shape is already the contract.
3. **Per-slice stable-reference snapshots + `useSyncExternalStore` with no
   selector shim.** DIRECTION says components "read the slices they need" —
   named slices, not arbitrary derived selectors. `useSlice(store, name)` =
   `useSyncExternalStore(store.subscribe, () => store.slice(name))`, and the
   reducer's referential stability gives the `Object.is` bail-out for free.
   *Rejected:* `use-sync-external-store/shim/with-selector` — a new
   dependency to memoize arbitrary selectors we do not need; if a derived
   value is ever wanted, a component can memoize it with the React Compiler
   already on.
4. **`fake-indexeddb` as a devDependency, imported per-test (not in the
   global setup).** It gives full IndexedDB semantics under jsdom, which the
   later `fs`/`git`/`index` behavior tests need too. Importing it only in
   the worker behavior tests keeps the rest of the suite free of a global
   fake. *Rejected:* a hand-rolled IDB mock — partial semantics that would
   mislead the downstream data-layer tasks.
5. **The git-over-HTTP harness is a Node helper wrapping `git http-backend`
   (protocol v1) behind `http.createServer`, landed in `app/src/test/`.**
   The `git` CLI is already required by `scripts/gate`, so no new dependency
   is added, and the helper serves real smart-HTTP that both the CLI (in
   this task's self-test) and isomorphic-git (downstream) can speak.
   *Rejected:* the `node-git-server` npm package (a new dependency for what
   the CLI already provides). *Rejected:* deferring the harness to
   `storage.git` — the note assigns it here, and `fs`/`git` want it ready.
   It lives beside the existing `app/src/test/setup.js`; being test-only and
   unreachable from an entry, it never enters the production bundle.
6. **Versioned, structured-cloneable envelopes; commands vs events; an
   extensible `kind` carrying progress / completion / error.** DIRECTION
   L399–401 ("a sync finishing, a merge landing, a clone's progress: each is
   a message") requires the channel to carry these without reshaping when
   sync and clone land. A version constant guards the schema even though no
   runtime negotiation is needed (same-build guarantee, decision above).
7. **Minimal IndexedDB ownership now: open the database at an initial schema
   version with a `meta` object store; `storage.migrations` steps versions
   later.** This demonstrates the boundary (the Worker owns IndexedDB) and
   gives the behavior test something real to persist and recover, without
   implementing any book, filesystem, or index. *Rejected:* touching no
   IndexedDB in this task — then "against a fake IndexedDB" bites on nothing
   and the Worker-owns-the-data boundary goes unproven.
8. **Plain JS/JSX, co-located tests, jsdom, `vitest-axe` via
   `app/src/a11y/axe.js`** — inherited from `foundation.app_tooling`, not
   re-litigated. The extension (`.js` vs `.jsx`) tracks whether a file
   renders a component; the test *level* is named explicitly in the
   acceptance criteria (a plain-JS behavior test is still a behavior test).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `app/src/worker/protocol.js` — versioned, structured-cloneable message envelopes with command/event kinds and `structuredClone`-safe constructors (DIRECTION §3.7 L397–401).
- `app/src/worker/reducer.js` — pure reducer folding events into referentially-stable named slices; unchanged slices keep the same `Object.is` reference.
- `app/src/worker/logic.js` — transport-agnostic Worker logic owning the IndexedDB connection (initial schema, `meta` object store) and emitting events through an injected port.
- `app/src/worker/attach-worker.js` — thin thread adapter wiring `logic` to `self.onmessage`/`self.postMessage`.
- `app/src/worker/index.js` — Worker thread entry point.
- `app/src/worker/store.js` — main-thread store: `subscribe`, per-slice snapshots, sends commands down the port.
- `app/src/worker/useStore.js` — `useSlice(store, name)` hook over `useSyncExternalStore`.
- `app/src/test/loopback.js` — in-process loopback transport double for behavior tests.
- `app/src/test/git-http-remote.js` — reusable local git-over-HTTP server (smart HTTP v1) for Worker and sync behavior tests.
- `app/package.json`, `app/package-lock.json` — `fake-indexeddb ^6.2.5` added as devDependency.
- Tests (unit): `app/src/worker/protocol.test.js` (5), `reducer.test.js` (3), `attach-worker.test.js` (1).
- Tests (behavior): `app/src/worker/store.test.js` (4 — in-process, fake-IndexedDB, meta persist+recover), `useStore.test.jsx` (2 — per-slice re-render, axe WCAG 2.1 AA), `app/src/test/git-http-remote.test.js` (1 — smart-HTTP v1 clone).
