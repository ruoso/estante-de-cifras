# foundation.app_sw_register — Register the service worker on app load

## TaskJuggler entry

Back-link: `task app_sw_register` in
[`tasks/25-foundation.tji`](../../25-foundation.tji) lines 65–70, inside the
`foundation` task whose area file opens (lines 1–5):

> The monorepo, its tooling, the API contract, running everything locally as
> in production, CI, and the two end-to-end harnesses every later task's
> e2e tests are written in. The harnesses land before anything needs them.

The task's note:

```
app/src/main.jsx: import `virtual:pwa-register` and call `registerSW()` so
the precached shell controls the page and the app works offline. VitePWA
sets `injectRegister: null` and `registerType: 'prompt'`; without this call
the service worker is never registered, `navigator.serviceWorker.ready`
never resolves, and the offline-first promise (DIRECTION §1 lines 29–31,
§3.7 lines 405/424–426) is not kept. Unblocks foundation.e2e_web whose
offline smoke test requires the worker to control the page. Source:
foundation.e2e_web re-defer (tasks/refinements/foundation/e2e_web.md).
Tests: behavior (mock `virtual:pwa-register`, assert registerSW() is called
on startup).
```

## Effort estimate

**0.5d** (from the `.tji`).

## Repository

**estante-de-cifras** (`/home/ruoso/devel/estante-de-cifras`), in `app/` —
one edit to `app/src/main.jsx` and one new test file beside it.

**No design delta is authored.** VitePWA's `injectRegister: null` was chosen
deliberately in `foundation.app_tooling` precisely so the app registers the
worker itself; this task fills the hole that choice left open, it does not
change a designed behaviour.

## Inherited dependencies

- **`foundation.app_tooling`** — settled, `complete 100`
  ([`tasks/25-foundation.tji`](../../25-foundation.tji) lines 16–22; this
  task's `depends !app_tooling`, line 68). It wired `vite-plugin-pwa` with
  `registerType: 'prompt'`, `injectRegister: null`, `skipWaiting: false` and
  an `index.html` navigate-fallback, and stood up the Vitest + Testing
  Library + `vitest-axe` set-up this task's test reuses. See
  [`app_tooling.md`](./app_tooling.md).

**Downstream.** Two settled leaves depend on the worker actually
registering:

- **`foundation.e2e_web`** — `depends !app_sw_register`
  ([`tasks/25-foundation.tji`](../../25-foundation.tji) line 74). Its offline
  smoke test (`e2e/web/tests/offline.spec.js`) loads the app, waits for the
  worker to control the page, cuts the network, reloads and asserts the
  shell still renders. That wait (`navigator.serviceWorker.ready`) never
  resolves until this task lands — which is why `e2e_web` re-deferred and
  registered this task as its blocking prerequisite
  ([`e2e_web.md`](./e2e_web.md) Status). See [e2e_web.md](./e2e_web.md).
- **`shell.pwa`** — "Manifest, icons, the service worker precaching
  everything, the update taken on the next launch"
  ([`tasks/50-shell.tji`](../../50-shell.tji) lines 38–42). The richer PWA
  surface — real icons, the full manifest polish, and the user-visible
  "update on next launch" behaviour and its e2e-web proof — is owned there.
  This task is only the minimal bootstrap that makes the worker register at
  all.

## What this task is

A one-line wiring fix. `foundation.app_tooling` configured `vite-plugin-pwa`
to generate and precache a service worker but set `injectRegister: null`, so
nothing registers it at runtime; `app/src/main.jsx` today only mounts
`<App />`. This task imports the plugin's virtual registration module in the
entry and calls it on load, so the generated worker installs, precaches the
shell, and takes control of the page — the precondition for the app working
with no network. It adds the behaviour test the `.tji` note names.

## Why it needs to be done

Offline-first is a founding promise (DIRECTION §1): the app must open and
work in a lesson with no signal. That only holds if a service worker has
installed and is serving the precached shell. With `injectRegister: null`
and no `registerSW()` call, the worker is built but never registered:
`navigator.serviceWorker.ready` never resolves, a reload offline returns
`net::ERR_INTERNET_DISCONNECTED`, and every offline journey — and the
`foundation.e2e_web` harness's own offline smoke test — is unreachable.
`e2e_web` stopped rather than editing `app/` across the app↔harness
share-no-code boundary and registered this task instead; it stays blocked
until this lands.

## Inputs / context

- **The entry as it stands** —
  [`app/src/main.jsx`](../../../app/src/main.jsx) (11 lines): imports
  `StrictMode` and `createRoot`, mounts `<App />` under
  `document.getElementById('root')`, and does nothing else. The comment at
  lines 5–6 ("the entry mounts the app and nothing more") is the line this
  task extends: the entry also registers the worker.
- **The VitePWA configuration** —
  [`app/vite.config.js`](../../../app/vite.config.js) lines 36–69:
  `registerType: 'prompt'` (line 39), `injectRegister: null` (line 40),
  `workbox.navigateFallback: '/index.html'` (line 45),
  `workbox.clientsClaim: true` (line 51) "take control as soon as the worker
  activates, so the first visit is offline-capable", `workbox.skipWaiting:
  false` (line 52) "an update must still ask before replacing what someone
  is using", and `devOptions: { enabled: false }` (line 68). `virtual:pwa-register`
  appears nowhere in `app/` yet (grep: zero hits), and neither does
  `navigator.serviceWorker`.
- **The offline-first promise** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §1 lines 29–31 (*"Offline
  first. The app works in a lesson with no signal."*) and §3.7 line 405
  (*"The app is installed and cached up front"*) with the carry-over tooling
  bullet at lines 424–426 (Vite, the PWA plugin).
- **The re-defer that created this task** —
  [`e2e_web.md`](./e2e_web.md) Status ("Re-deferred"): the implementer halted
  because `offline.spec.js`, a mandatory smoke test, cannot pass without the
  worker controlling the page, and the fix lives in `app/`, outside that
  task.
- **The test set-up this reuses** —
  [`app/src/test/setup.js`](../../../app/src/test/setup.js) (jest-dom + the
  `vitest-axe` matcher, `cleanup()` after each test),
  [`app/src/App.test.jsx`](../../../app/src/App.test.jsx) (the canonical
  Testing Library behaviour test), and the Vitest block inlined in
  `app/vite.config.js` (jsdom, `setupFiles: ['./src/test/setup.js']`,
  `include: ['src/**/*.{test,spec}.{js,jsx}']`). The app has no `vi.mock`
  usage yet; this test introduces the first.

## Constraints / requirements

- **Keep `injectRegister: null`.** The explicit `registerSW()` call in the
  entry is the registration path VitePWA's `null` mode expects; do not switch
  `injectRegister` to `'auto'`/`'script'`. The manual call is what pairs with
  `registerType: 'prompt'` + `skipWaiting: false` (update held, not forced)
  and keeps the entry the single place that owns startup wiring.
- **Register at module scope, once.** The `registerSW()` call sits at the top
  level of `main.jsx`, not inside a component, so React's `StrictMode`
  double-invoke does not register the worker twice.
- **Offline-first (standing rule).** The point of the change: once loaded,
  the precached shell serves the page with no network. Nothing the user does
  waits on this; registration is fire-and-forget.
- **The view is the only layer that knows React (DIRECTION §3.7 lines
  415–417).** This is entry wiring, not a component or a Worker concern; it
  touches neither the main-thread store nor IndexedDB (the Worker owns the
  data — DIRECTION §3.7 lines 407–409), and it registers the browser's
  service worker, which is unrelated to the app's own Web Worker.
- **app ↔ harness/service share no code (DIRECTION §3.6).** The fix belongs
  in `app/`; the `e2e_web` harness consumes the running app, it does not reach
  into it. That boundary is exactly why this is a separate task.
- **No update-prompt UI here.** With `skipWaiting: false` a new worker waits
  and takes over on the next launch; wiring a visible "update available"
  affordance is `shell.pwa`'s "the update taken on the next launch", not this
  task. So `registerSW()` is called without an `onNeedRefresh` handler.
- **No song text in logs (standing rule).** Registration logs nothing; any
  `onRegisterError` path (if used) reports the error, never user content —
  though nothing in scope writes a log line.

## Acceptance criteria

**Behaviour delivered.** `app/src/main.jsx` imports `registerSW` from
`virtual:pwa-register` and calls it once at module scope on load (as
`registerSW({ immediate: true })`), so the generated worker registers,
precaches the shell and — via `clientsClaim: true` — controls the page.
After this, in a built app served over the stack,
`navigator.serviceWorker.ready` resolves and an offline reload is served
from the precache. `<App />` still mounts exactly as before.

**Tests the task lands with, by level.** The `.tji` note names one level —
*"behavior (mock `virtual:pwa-register`, assert registerSW() is called on
startup)"*:

- **behavior — `app/src/main.test.jsx`** (Vitest + jsdom): with
  `virtual:pwa-register` replaced by `vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn() }))` and a `<div id="root">` placed in the document,
  importing the entry (`await import('./main.jsx')`) calls `registerSW`
  exactly once, with `{ immediate: true }` — pinning that the worker is
  registered as a side effect of app load. Pins DIRECTION §1 lines 29–31 and
  §3.7 lines 405/424–426 (offline-first via the precached shell), the note's
  *"call `registerSW()` … so the precached shell controls the page"*, and the
  `injectRegister: null` config at `app/vite.config.js` line 40 that makes
  this call load-bearing. The closer confirms `main.test.jsx` exists and ran
  — not skipped — in the gate's output.

No **unit**, **e2e-api** or **e2e-web** level applies to this leaf. There is
no pure module to unit-test (the whole change is entry wiring, which the
behaviour test exercises through the real `virtual:pwa-register` seam) and no
endpoint. The e2e-web proof that the worker actually controls a real page
offline is `foundation.e2e_web`'s own `offline.spec.js` smoke test, which
this task unblocks; it runs against a browser and the compose stack, neither
available at the Vitest level, so it correctly lands there rather than being
duplicated here.

**Deferred work.** None. The two downstream consumers are already settled WBS
leaves — `foundation.e2e_web` (the offline smoke test) and `shell.pwa` (the
full manifest/icons and update-on-next-launch behaviour and its e2e-web
proof). No new task, no parking-lot item.

## Decisions

- **The `registerSW()` call goes in `app/src/main.jsx`, not a new module.**
  *Rationale:* the note names `main.jsx`, the change is two lines, and the
  entry is already the one place that owns startup side effects; a dedicated
  `pwa/register.js` module would be ceremony around a single call site with
  no second consumer. The behaviour test reaches the call by loading the
  entry with the virtual module mocked, which also pins the "on app load"
  wording literally. *Alternative rejected:* extract a `registerServiceWorker()`
  module and unit-test it in isolation — more indirection, and it would test a
  wrapper rather than that the entry actually registers on load.
- **`registerSW({ immediate: true })`, no update callbacks.** *Rationale:*
  `immediate: true` registers as soon as the entry runs instead of waiting
  for the window `load` event, so a precache-first app gets its worker
  installing and (via `clientsClaim`) controlling the page as early as
  possible — the earliest-covered first offline reload. No `onNeedRefresh`/
  `onOfflineReady` handlers, because `skipWaiting: false` already encodes
  "update on the next launch" and the user-visible update affordance is
  `shell.pwa`'s. *Alternative rejected:* plain `registerSW()` (registers on
  the `load` event) — also passes the test and is harmless, but leaves a
  narrow window where a very fast first interaction precedes registration;
  `immediate: true` closes it at no cost.
- **Keep VitePWA's `injectRegister: null`.** *Rationale:* it is the mode that
  cedes registration to the app, which is what this task implements, and it
  preserves the prompt-style update flow `app_tooling` chose. *Alternative
  rejected:* flip to `injectRegister: 'auto'` so the plugin injects its own
  registration — that would register the worker without this code, but it
  takes the control (and the eventual `onNeedRefresh` seam `shell.pwa` wants)
  away from the app and silently contradicts the `app_tooling` decision.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `app/src/main.jsx`: added import of `registerSW` from `virtual:pwa-register` and a module-scope call `registerSW({ immediate: true })`, so the generated service worker registers at entry load, precaches the shell, and (via `clientsClaim: true`) takes control of the page — the precondition for the offline-first promise (DIRECTION §1 lines 29–31, §3.7 lines 405/424–426).
- `app/src/main.test.jsx` (new): behavior test — mocks `virtual:pwa-register`, imports the entry, asserts `registerSW` was called exactly once with `{ immediate: true }`. Ran and passed (1/1, not skipped).
- `injectRegister: null` retained in `app/vite.config.js` (unchanged); this call is the explicit registration path that config requires.
- Unblocks `foundation.e2e_web` (whose `offline.spec.js` smoke test requires `navigator.serviceWorker.ready` to resolve) and `shell.pwa` (the full manifest/icons and update-on-next-launch surface).
