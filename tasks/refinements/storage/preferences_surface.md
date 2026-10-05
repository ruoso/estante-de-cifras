# storage.preferences_surface — Surface preferences from the home book

## TaskJuggler entry

`tasks/40-storage.tji`, `task storage.preferences_surface "Surface preferences
from the home book"` (lines 75–80):

> The Worker reads preferences.json from the home book and emits a PREFERENCES
> event the reducer folds into the preferences slice (the contract defined by
> shell.tokens), re-emitted when sync changes a register. DIRECTION §3.2, §3.7;
> home-book-format §4.1. Source of debt: tasks/refinements/shell/tokens.md
> (shell.tokens). Tests: unit (a preferences.json map → the event payload of
> {value, at} registers; an absent register stays absent); behavior (the Worker
> against a fake IndexedDB and a local git remote surfaces a theme change, the
> reducer folds it, the ThemeRoot re-applies).

`depends !home_book, shell.tokens`.

## Effort estimate

**1d**, as scoped in the `.tji`. The work is small and all composition: a pure
projection module, three edits to `logic.js` (compose the home book, surface on
open, re-surface after a home-book sync), one new `CommandKind`, and the two
test levels the note names. The hard parts — the register/merge/canonical
mechanism and the `PREFERENCES` event + `preferences` slice contract — already
exist (see Inherited dependencies).

## Repository

**estante-de-cifras only** (`app/`). This is app work below the view:
framework-free Worker modules under `app/src/worker/`, with the behavior test
rendering `ThemeRoot` (`app/src/theme/`) over a store the real Worker logic
drives. The note does **not** start with `cifra.md:`; nothing in the sibling
`/home/ruoso/devel/cifra.md` repo changes — `preferences.json` is a home-book
file, not a cifra.md song (`docs/home-book-format.md` §1). The app and the
service share no code (DIRECTION §3.6 L288). **No design delta** is authored:
the protocol is explicitly open to new kinds (`protocol.js` L5–7; DIRECTION §3.7
L413–414 "each is a message"), the home book's JSON sync is already in DIRECTION
§3.2 and workflow 8, and the `PREFERENCES` event and `preferences` slice already
exist (shell.tokens). Plain JS/JSX; no TypeScript. Contracts are JSDoc
`@typedef`s, as every sibling in `app/src/worker/`.

## Inherited dependencies

- **storage.home_book** — *settled, Done 2026-10-05.* Gives the module this task
  reads through: `createHomeBook({ fs, git, locks })` →
  `{ read, set, sync, ensureDeviceId }` (`app/src/worker/home-book.js:116`).
  - `read({ bookId, file })` (`home-book.js:193`) parses a settings file to its
    model, an absent file as `{}` (ENOENT → `{}`, `home-book.js:125–132`) — the
    exact read this task surfaces, and safe to call before any home book exists.
  - `sync({ bookId, author })` (`home-book.js:243`) fetches, merges each settings
    file key by key (the Worker's own §5 merge, not git's), commits the merge
    automatically and pushes; offline-first, a failed push resolves
    `pushed: false` without rolling back (`home-book.js:317–324`). This is the
    sync that "changes a register," after which this task re-surfaces.
  - It also settled the envelope predicate reused here: `isRegister(obj)` —
    exactly `{ value, at }` with a well-formed §3 instant
    (`app/src/worker/home-book-merge.js`) — and the canonical serializer
    (`home-book-canonical.js`), neither re-authored here.
  - The home book lives at `git.bookDir('home')` → `/books/home`; the home-book
    behavior test already uses `const BOOK = 'home'`
    (`home-book.behavior.test.js:31`). This task formalises it as the exported
    constant `HOME_BOOK_ID` (Decision 2).
  - Transitively settled: **storage.git** (`createGitLayer` →
    `{ clone, fetch, push, bookDir }`, `git.js:44`, `bookDir` at `:63`),
    **storage.locks** (`createBookLocks({ navigator })` → `{ withLock }`,
    `locks.js:61`), **storage.fs** (`createFileSystem` → the isomorphic-git `fs`,
    `fs.js:144`), and **storage.worker/migrations** (the protocol/store/reducer/
    logic seam and the composition pattern this task extends).
- **shell.tokens** — *settled, Done 2026-10-05.* This is the **source of debt**:
  it defined the consumer with no producer, and this task is that producer. It
  shipped, as the contract this task fills:
  - `EventKind.PREFERENCES = 'preferences'` (`app/src/worker/protocol.js:49`),
    whose payload is "the home book's preferences.json as a flat map of
    `{value, at}` registers" (`protocol.js:39–42`).
  - The `preferences` slice (`app/src/worker/reducer.js:25–31`, default `{}`) and
    its fold: a `PREFERENCES` event **replaces** the slice with the payload map,
    an absent payload resetting it to `{}` (`reducer.js:120–125`). Only this
    slice moves ("only what shows it moves").
  - `ThemeRoot` (`app/src/theme/ThemeRoot.jsx`) reading `preferences.theme.value`
    through `useSyncExternalStore` and resolving the applied theme; the pure
    resolver (`app/src/theme/resolve.js`) maps an absent/`null`/`"automatic"`
    chosen theme to the device's light/dark mode, an explicit theme otherwise.
  - Its `ThemeRoot.test.jsx` `manualStore()` helper fires a hand-made
    `PREFERENCES` event "the way the deferred Worker producer eventually will"
    (`ThemeRoot.test.jsx:20–27`) — the stub this task's behavior test replaces
    with a store the real Worker logic drives.
  - Transitively **foundation.app_tooling** (React 19 + React Aria, Vite,
    Vitest/jsdom with `vitest-axe`; the shared `checkWcag21aa`,
    `app/src/a11y/axe.js`) and **foundation.e2e_web** (not used here — see
    Acceptance → Why no e2e).

Nothing pending blocks this task; everything it consumes is Done. Its consumer
is **sync.engine** (`tasks/45-sync.tji`, `sync.engine`, which already `depends
storage.home_book`): the sync engine's loop re-surfaces preferences after
routing the home book to `home-book.sync` (Acceptance → graph note).

## What this task is

Make the home book's preferences **visible to the view**. The Worker already
owns the home book and can read `preferences.json`; `shell.tokens` already
defined the `PREFERENCES` event and the `preferences` slice and wired `ThemeRoot`
to read them; but nothing yet **reads the file and emits the event**. This task
is that producer:

1. A pure projection — `preferences.json`'s model → the `PREFERENCES` payload:
   the flat map of `{value, at}` registers, keeping only well-formed registers
   (an absent key stays absent; a malformed entry is dropped), so the slice never
   carries anything but registers.
2. The Worker wiring in `logic.js`: compose `createHomeBook` in the closure
   (`ensureHomeBook()`, beside `ensureWorkingCopy()`); a `surfaceHomeBook
   Preferences()` helper that reads `preferences.json` and posts the
   `PREFERENCES` event; call it once on `OPEN` (the initial surface), and again
   after a home-book sync, so a register a sync changed reaches the slice.
3. A `SYNC_HOME` command so the home book can be synced and re-surfaced from the
   Worker's command surface — the testable trigger for the re-emit, and the seam
   the sync engine (later) drives on its schedule.

It is the **read/surface** path only. Writing a preference (choosing a theme,
labelling a book) is the consumer tasks' (`home-book.set` is already built;
the chooser that calls it is unowned — parking lot, per shell.tokens).
Provisioning the home book (cloning it on a new device, creating it on first run)
is `account.new_device` / first-run, not this task; before a home book exists
`read` returns `{}` and the app stays on the automatic theme.

## Why it needs to be done

Without this task the `preferences` slice is permanently `{}`: a user's chosen
theme (and, later, language, notation, …) lives in the home book but never
reaches the view, so the app always resolves to the automatic theme regardless
of what the user chose on this or another device (`store.js:71–77` records
exactly this gap — "until it lands the `preferences` slice stays `{}`"). It is
the last link between the home book DIRECTION §3.2 describes and the themed shell
`shell.tokens` built, and it is the seam the sync engine needs to make a theme
changed on another device re-apply here. It is a leaf of milestone **M2**
(`milestones.m2_local`), the same milestone `storage.home_book` belongs to.

## Inputs / context

### Governing design

- **DIRECTION §3.2 "Personal state"** (`docs/DIRECTION.md` L136–151): the theme
  is personal state that "lives in a **home book** … committed automatically —
  explicit save is for what the user authors, not for preferences" (L141–144);
  the home book is "a **settings repository** … its files are JSON that merge key
  by key, the later change winning (workflow 8)" (L146–147); the format is
  `home-book-format.md` (L148–151).
- **DIRECTION §3.7 "The app"** (L407–414): "**One owner for the data: a Web
  Worker.** … The main thread never touches IndexedDB" (L407–409); "**The
  interface mirrors it.** A store on the main thread is fed by the Worker's
  messages, and components read the slices they need through
  `useSyncExternalStore` … A sync finishing, a merge landing … each is a message,
  and only what shows it moves" (L410–414). The preferences reach the view **only**
  as a Worker event folded into a slice — never by the view reading the home book.
- **DIRECTION §3.6** (L288): the app and the service share no code (named for
  the repository scope; nothing here touches the service).

### Workflows

- **Workflow 1 §Theme** (`docs/workflows/01-first-run.md` L86–106): the chosen
  theme "is kept in the home book like the language, so it follows the user to a
  new device"; with no choice the theme is **automatic**, following each device's
  light/dark mode. This task is what makes the *chosen* theme actually follow the
  device: it surfaces `preferences.theme` so `ThemeRoot`'s resolver applies it.
- **Workflow 8 §The home book / §Merging** (`docs/workflows/08-sync.md` L41–47,
  L72–77): the home book's files merge key by key, the later change winning, and
  sync "makes the merge commit and pushes it" without asking. "Re-emitted when
  sync changes a register" is this: after such a merge, a register may hold a new
  value, and the slice must reflect it.
- **Workflow 13 §What comes down** (`docs/workflows/13-new-device.md` L30–37):
  on a new device the home book comes down **first** so the theme (and language,
  notation, instrument) is right "before anything else." Cloning the home book is
  `account.new_device`'s; this task is what then surfaces it. (That end-to-end
  journey is `account.new_device`'s e2e-web, not this task's — see Acceptance.)

### The format

- **`docs/home-book-format.md` §4.1 `preferences.json`** (L187–206): "A flat map
  of singleton preferences, each a register." `theme` — `"estante"`,
  `"caderno"`, `"palco"` or `"automatic"`; **"The register is absent until the
  user chooses; while absent, the app's theme is automatic"** (L199–202).
  `language`, `notation` (opaque) likewise. This fixes the payload shape (a flat
  map of registers) and the "absent register stays absent" rule the unit test
  pins.
- **§3 the register envelope** (L150–180): an object is a register iff its keys
  are exactly `value` and `at` with `at` a well-formed instant. `isRegister`
  (`home-book-merge.js`) is this predicate; the projection reuses it.

### The code seams this extends

- `app/src/worker/home-book.js:116` — `createHomeBook({ fs, git, locks })`;
  `read` at `:193` (the surfaced read), `sync` at `:243` (the re-surface
  trigger). `home-book.js:56–63` lists the §2.1 settings files (`preferences.json`
  first).
- `app/src/worker/home-book-merge.js` — `isRegister(obj)` (the §3 predicate the
  projection filters with).
- `app/src/worker/protocol.js` — `CommandKind` (`:28–33`, add `SYNC_HOME`) and
  `EventKind.PREFERENCES` (`:49`, already present; no new event). `command()` /
  `event()` builders (`:55–62`); the channel is open to new kinds (`:5–7`).
- `app/src/worker/reducer.js:120–125` — the `PREFERENCES` fold (untouched here;
  the contract this task feeds).
- `app/src/worker/logic.js` — `createWorkerLogic(port, options)` (`:118`); the
  `handleOpen()` that posts `READY` (`:165–176`, where the initial surface is
  appended); `ensureWorkingCopy()` (`:154–163`), composing `createGitLayer` +
  `createBookLocks` + the shared `fs` — the composition this task mirrors for
  `ensureHomeBook()`; the command `switch` (`:182–237`), where `SYNC_HOME` is
  added; the catch that turns any throw into an `ERROR` event (`:238–247`);
  `authorFrom` already imported (`:25`, used by `SAVE`), reused for the sync
  author.
- `app/src/theme/ThemeRoot.jsx`, `app/src/theme/resolve.js` — the consumer the
  behavior test renders; `resolve.js` maps absent/`null`/`"automatic"` → the
  device mode, an explicit theme otherwise.
- `app/src/worker/store.js` (`createStore`, `createLoopbackEndpoint` consumer)
  and `app/src/test/loopback.js` — `createLoopbackEndpoint(createLogic)` wires a
  `createStore` (main side) to `createWorkerLogic` (worker side) in one process,
  each message crossing a `structuredClone` + `queueMicrotask` boundary. This is
  how the behavior test drives the real Worker logic from React.
- Test support (as `working-copy.behavior.test.js` uses them):
  `app/src/test/git-http-remote.js` — `startGitHttpRemote()` → `{ url, repoDir,
  stop() }` (a real `git http-backend`, push enabled, auto-seeded bare repo);
  `app/src/test/web-locks.js` — `installWebLocks()` → `restore()`;
  `fake-indexeddb` — a fresh `new IDBFactory()` per test, threaded into
  `createFileSystem(name, { indexedDB })` and `createWorkerLogic(port, {
  indexedDB, name, fetch })`.

## Constraints / requirements

- **The Worker owns the home book; the view never reads it.** The chosen theme
  reaches `ThemeRoot` only through the `PREFERENCES` event folded into the
  `preferences` slice — never by the main thread touching IndexedDB or the home
  book (DIRECTION §3.7 L407–409). The projection and surfacing are framework-free
  Worker code; only the behavior test's rendered `ThemeRoot` is React.
- **The payload is the whole preferences map, not a delta.** The reducer
  *replaces* the slice (`reducer.js:120–125`), so every emit — on open and after
  a sync — surfaces the complete current `preferences.json` map of registers.
- **An absent register stays absent.** The projection never fabricates a register
  or a default; a key not in the file is not in the payload (home-book-format
  §4.1 L199–202), so `ThemeRoot` falls back to automatic exactly when the file
  has no `theme`. A tombstone (`{ value: null, at }`) is a well-formed register
  (§5.3) and is kept; the resolver treats a `null` chosen theme as automatic.
- **Only well-formed registers surface.** The projection keeps only entries that
  pass `isRegister` (§3); a malformed top-level entry is dropped, so the slice
  carries only `{value, at}` registers (a malformed home book is the validator's
  concern — `hook.home_book` — not something to crash the surface).
- **Safe before any home book exists.** On `OPEN` with no home book cloned yet,
  `read` returns `{}` (ENOENT) and the surface emits `{}` — never an error, never
  a crash. Provisioning the home book is `account.new_device` / first-run, not
  this task.
- **Offline first** (standing rule; workflow 1 L72–78). The initial surface on
  `OPEN` is a local read and never waits on the network. `SYNC_HOME` runs
  `home-book.sync`, which is offline-first (a failed push keeps the local commit,
  `home-book.js:317–324`); the re-surface runs regardless, reflecting whatever
  the local tree now holds.
- **One lock per logical operation** (locks.md Decision 1). `SYNC_HOME` delegates
  to `home-book.sync`, which already takes **one** `withLock(HOME_BOOK_ID, …)`
  for the whole fetch → merge → commit → push; the surface read runs outside that
  lock (a plain working-copy read). This task adds no new locking.
- **No preferences, labels, links or secrets in logs** (standing rule; DIRECTION
  §3.3). The projection and surfacing log nothing; errors surface as the Worker's
  `ERROR` event via the existing catch (`logic.js:238–247`), never to `console`,
  and never carry a preference value.
- **No new protocol beyond one command.** Add `CommandKind.SYNC_HOME` only; no
  new `EventKind` (`PREFERENCES` already exists), and `reducer.js` is untouched
  (the fold is shell.tokens'). The channel was designed for this (`protocol.js`
  L5–7).
- **Accessibility.** No new UI ships; the producer renders nothing. The behavior
  test runs `checkWcag21aa` on the `ThemeRoot` surface it renders (role/name/
  structure under jsdom); theme **contrast** across viewports is already pinned at
  e2e-web by shell.tokens' `theme.spec.js` (contrast needs a real browser —
  shell.tokens Decision), so no new axe-contrast obligation here.
- *Rules named for completeness, not bearing here:* canonical form over
  preserving content (no file is written by this task — it only reads; the writer/
  merger is home_book's); no book without an account (the home book is private to
  one account and uses the existing transport, no new endpoint).

## Acceptance criteria

### Behavior delivered

- **`app/src/worker/preferences.js`** — the pure projection.
  `surfacePreferences(model) → payload`: returns a new flat map containing each
  top-level entry of `model` that passes `isRegister` (§3), in which an absent key
  stays absent and a non-register entry is dropped; `{}` → `{}`. Pure; no I/O, no
  logging; imports only `isRegister` from `home-book-merge.js`.
- **`app/src/worker/logic.js`** — the wiring:
  - `ensureHomeBook()` — memoised composition of `createHomeBook({ fs, git,
    locks })` over the same `fs`, git layer and lock registry as
    `ensureWorkingCopy()` (the git layer and locks factored into a shared
    memoised helper so both consumers reuse one of each — Decision 3), mirroring
    the `ensureWorkingCopy()` pattern (`logic.js:154–163`).
  - `surfaceHomeBookPreferences()` — reads `ensureHomeBook().read({ bookId:
    HOME_BOOK_ID, file: 'preferences.json' })`, applies `surfacePreferences`, and
    `port.postMessage(event(EventKind.PREFERENCES, payload))`.
  - `handleOpen()` calls `surfaceHomeBookPreferences()` after posting `READY`, so
    the current preferences surface on bring-up (an empty `{}` when none).
  - A new `case CommandKind.SYNC_HOME`: `await ensureHomeBook().sync({ bookId:
    HOME_BOOK_ID, author: message.payload.author })`, then
    `await surfaceHomeBookPreferences()` — the re-emit after a sync that may have
    changed a register. Errors flow through the existing catch as an `ERROR` event.
- **`app/src/worker/protocol.js`** — `CommandKind.SYNC_HOME = 'sync_home'` added,
  with a one-line comment; `HOME_BOOK_ID = 'home'` exported from `home-book.js`
  (Decision 2) and imported by `logic.js`. No new `EventKind`.
- **Observable result**: with a home book whose `preferences.json` holds
  `theme = "palco"`, after `OPEN` the `preferences` slice is `{ theme: { value:
  "palco", at } }` and `ThemeRoot` applies `theme-palco`; after a `SYNC_HOME`
  that merges a remote change to `theme = "estante"`, the slice updates and
  `ThemeRoot` re-applies `theme-estante`; with no `theme` register the slice has
  no `theme` and `ThemeRoot` stays automatic.

### Tests the task lands with, by level

- **unit — `app/src/worker/preferences.test.js`** (the `.tji`'s "a
  preferences.json map → the event payload of {value, at} registers; an absent
  register stays absent"):
  - a `preferences.json` model with `theme` and `language` registers → a payload
    holding both unchanged (the flat map of `{value, at}` registers);
  - a model with **no `theme`** → a payload with no `theme` key (*an absent
    register stays absent* — not defaulted, not fabricated);
  - a tombstone `theme: { value: null, at }` is kept (a well-formed register,
    §5.3);
  - a malformed top-level entry (not `{value, at}`, or `at` not a §3 instant) is
    dropped;
  - `{}` → `{}`.
  Settings written for the purpose. *Pins:* home-book-format §4.1 L199–202, §3;
  and `tasks/40-storage.tji:79`.
- **behavior — `app/src/worker/preferences-surface.behavior.test.jsx`** (the
  `.tji`'s "the Worker against a fake IndexedDB and a local git remote surfaces a
  theme change, the reducer folds it, the ThemeRoot re-applies"): over a fresh
  `new IDBFactory()`, `installWebLocks()` active and a `startGitHttpRemote()`,
  clone the home book into the device's fs (as `working-copy.behavior.test.js`
  seeds a working copy), seed `preferences.json` on the remote with
  `theme = "palco"`; build a store via
  `createStore(createLoopbackEndpoint((port) => createWorkerLogic(port, {
  indexedDB, name, fetch })))` and render `<ThemeRoot store={store}>` (replacing
  shell.tokens' `manualStore()` stub with the real Worker producer). Then:
  1. `store.open()` → the Worker reads `preferences.json` and emits `PREFERENCES`;
     the reducer folds it; `ThemeRoot` applies **`theme-palco`** (*surfaces*, *the
     reducer folds it*, *the ThemeRoot re-applies*, workflow 1 L86–106).
  2. A second `createHomeBook` device (or a direct commit) pushes `theme =
     "estante"` with a later `at` to the remote; `store.send(command(
     CommandKind.SYNC_HOME, { author }))` → the Worker fetches, merges key by key,
     re-surfaces; `ThemeRoot` **re-applies `theme-estante`** (*re-emitted when
     sync changes a register*, workflow 8 L41–47, L72–77).
  3. With a home book whose `preferences.json` has **no** `theme`, `open()`
     surfaces `{}` and `ThemeRoot` stays **automatic** (resolving by the device
     mode) — the absent-register path end to end.
  4. `checkWcag21aa` on the rendered `ThemeRoot` surface is clean.
  *Pins:* `tasks/40-storage.tji:79`; DIRECTION §3.2 L136–151, §3.7 L407–414;
  home-book-format §4.1; workflow 1 L86–106; workflow 8 L41–47, L72–77.

No test level is dropped; no test is deferred.

### Why no e2e-web / e2e-api / axe-contrast here

The `.tji` names only **unit** and **behavior**. No new screen ships (the theme
chooser is unowned — parking lot, per shell.tokens; `ThemeRoot` itself shipped
with shell.tokens), so there is nothing new for axe-contrast or a Playwright
journey beyond what already exists. The theme rendered in Estante light and Palco
dark across the three viewports with contrast at AA is pinned by shell.tokens'
`e2e/web/tests/theme.spec.js`; the end-to-end new-device journey — the home book
down first, the theme right before anything else (workflow 13 L30–37) — is
`account.new_device`'s e2e-web; the home book syncing against the **real** Go
service and its `hook.home_book` validator is that hook's e2e-api and
`sync.engine`'s e2e-api. The local loopback + fake-IndexedDB + local-remote
harness is the right level for this producer seam.

### Deferred work and graph notes

- **No new WBS leaves.** The *write* side (a theme/language chooser that calls
  `home-book.set`) is an unowned interface-placement item already surfaced to the
  parking lot by shell.tokens (not a WBS leaf); this task is read-only and needs
  no follow-up. Tests are not deferred — both levels land here.
- **Graph note for the closer (not a new task): `sync.engine` should re-surface
  preferences after it syncs the home book, and depend on
  `storage.preferences_surface`.** The sync engine (`tasks/45-sync.tji`,
  `sync.engine`) runs the fetch/merge/push loop over the user's books and, per
  home_book.md's graph note, routes the home book to `home-book.sync`. After that
  home-book sync it must call this task's `surfaceHomeBookPreferences()` (or send
  `SYNC_HOME`) so a register the engine's sync changed reaches the slice —
  exactly the "re-emitted when sync changes a register" behavior, driven on the
  engine's schedule (open, foreground, network back, after save, every five
  minutes; workflow 8 L12–25). `sync.engine` already `depends storage.home_book`;
  it should also `depends storage.preferences_surface` for an accurate graph
  (both are M2/M3 leaves; nothing is blocked — surfaced so the closer can add the
  edge). The `SYNC_HOME` command this task adds is the in-Worker seam for that;
  the engine reuses the internal helper rather than reshaping it.

## Decisions

1. **Add one command, `SYNC_HOME`, as the testable re-emit trigger; no `SET_HOME`
   and no new event.** The note requires the `PREFERENCES` event "re-emitted when
   sync changes a register," and the loopback harness drives the Worker only
   through commands, so a sync-and-re-surface command is needed for this task to
   deliver *and test* its own requirement (tests are part of the task). The
   command delegates to the already-built `home-book.sync` and then re-surfaces;
   the sync engine (which runs in the same Worker) reuses the internal
   `surfaceHomeBookPreferences()`/`sync` path on its schedule.
   *Rejected:* deferring the sync trigger entirely to `sync.engine` — then this
   task could not exercise the re-emit through any public seam and would ship
   without the behavior its note names. *Rejected:* a generic `SET_HOME` command
   now — writing a preference is a consumer's concern (`home-book.set` exists; the
   chooser is unowned/parked), and speculative write surface is churn
   (home_book.md Decision 1). *Rejected:* a new `PREFERENCES`-adjacent event —
   the existing event and fold already carry exactly this.
2. **Reserve `HOME_BOOK_ID = 'home'`, exported from `home-book.js`.** The home
   book lives at `git.bookDir('home')`; the home-book behavior test already uses
   `BOOK = 'home'` (`home-book.behavior.test.js:31`), so this formalises the
   existing convention as the single production constant `logic.js` reads.
   *Rationale:* the home book shares the `/books/<id>` namespace with songbooks
   and needs a stable reserved id; service-assigned book ids are opaque server ids
   and will not take the reserved literal `home`.
   *Rejected:* threading the id in from each caller — there is exactly one home
   book per installation, so a reserved constant is simpler and keeps the surface
   path self-contained. (That book ids never collide with `'home'` is a mild
   assumption on the service's id space; surfaced in the return summary for the
   parking lot in case the account/service work wants to pin it explicitly.)
3. **Factor the git layer and the lock registry into shared memoised helpers so
   `ensureWorkingCopy()` and `ensureHomeBook()` reuse one of each.** The home book
   and the working copy must share one `fs`, and sharing one git layer and one
   lock registry keeps a single owner of each (and avoids two lock registries
   racing on the same global Web Lock name). This is a small refactor of the
   existing `ensureWorkingCopy()` composition (`logic.js:154–163`).
   *Rejected:* a second, independent git layer + lock registry inside
   `ensureHomeBook()` — functionally correct (Web Locks are global by name) but
   two owners of the same primitives for no reason.
4. **Surface on `OPEN`, and read the local working copy (never clone here).** The
   initial surface belongs at bring-up, right after `READY`, so the themed shell
   reflects the home book as soon as the Worker is up; the read is local and
   offline-first, and returns `{}` when no home book exists yet. Cloning/
   provisioning the home book is `account.new_device` / first-run.
   *Rejected:* surfacing only on an explicit command — the view would start on the
   wrong theme until something triggered it, defeating "the theme is right before
   anything else" (workflow 13 L30–37).
5. **The projection keeps only `isRegister` entries; it never defaults or walks a
   value.** home-book-format §4.1 makes `preferences.json` a flat map of
   registers, and §3's predicate (`isRegister`, reused) is the exact test; a
   malformed entry is dropped rather than surfaced or thrown on, keeping the slice
   clean without this task policing the format (that is `hook.home_book`'s). An
   absent key stays absent (no default), which is what lets `ThemeRoot` fall back
   to automatic.
   *Rejected:* passing the raw model straight through — a malformed file could put
   a non-register into the slice and break the resolver; *rejected:* injecting a
   default `theme: "automatic"` register — it would violate "absent until the user
   chooses" (§4.1 L199–202) and could be written back as a real choice by a later
   writer.

## Open questions

(none — all decided.)

shell.tokens' three parking-lot items (the theme/language chooser's placement,
density as a chosen preference, font licensing) are human-judgment product/legal
calls already recorded there, not this task's — this task is the read path and
needs none of them resolved. The only thing surfaced anew is the mild assumption
that service book ids never collide with the reserved `'home'` id (Decision 2),
noted for the parking lot rather than encoded as a task.

## Status

**Done** — 2026-10-05.

- Created `app/src/worker/preferences.js`: pure `surfacePreferences(model)` projection, filters via `isRegister`, absent keys stay absent, `{}` → `{}`.
- Created `app/src/worker/preferences.test.js`: 5 unit tests pinning the register pass-through, absent-stays-absent, tombstone kept, malformed dropped, and empty-map cases.
- Created `app/src/worker/preferences-surface.behavior.test.jsx`: 2 behavior tests over real Worker + fake IndexedDB + local git remote — surfaces `theme-palco` on open, re-applies `theme-estante` after `SYNC_HOME` merge, stays automatic with no theme register; axe-clean.
- Edited `app/src/worker/protocol.js`: added `CommandKind.SYNC_HOME = 'sync_home'`.
- Edited `app/src/worker/home-book.js`: exported `HOME_BOOK_ID = 'home'` as the reserved constant.
- Edited `app/src/worker/logic.js`: factored `ensureGit`/`ensureLocks` shared memoised helpers; added `ensureHomeBook()`; added `surfaceHomeBookPreferences()` reading `preferences.json` and posting the `PREFERENCES` event; called on `OPEN` after `READY`; added `case CommandKind.SYNC_HOME` delegating to `home-book.sync` then re-surfacing.
- Edited existing tests (`fs.behavior.test.js`, `store.test.js`, `migrations.behavior.test.js`): scope-consequence adjustments — OPEN now takes a per-book Web Lock for the home book (Web Locks shim installed in three previously-unshimmed OPEN-driving tests), and `store.test.js` notify count 1→2 (OPEN now surfaces the empty preferences as a second state move).
- Graph note acted on: added `storage.preferences_surface` to `sync.engine`'s `depends` list in `tasks/45-sync.tji` so the graph reflects the re-surface dependency.
- Parking-lot entry appended: Decision 2's mild assumption that service-assigned book ids never collide with the reserved `'home'` id.
