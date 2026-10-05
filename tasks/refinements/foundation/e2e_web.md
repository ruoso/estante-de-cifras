# foundation.e2e_web — End-to-end web harness

## TaskJuggler entry

Back-link: `task e2e_web` in
[`tasks/25-foundation.tji`](../../25-foundation.tji), lines 65–70, under
`task foundation`:

```
task e2e_web "End-to-end web harness" {
  effort 2d
  allocate team
  depends !e2e_api, service.serve_app
  note "e2e/web/: Playwright against the compose stack (the app served by the service on its one origin), run by scripts/gate with an explicit `--workers`; three projects — phone, tablet and computer viewports — so every test runs on all three; an axe fixture that checks WCAG 2.1 AA on every screen a test visits and fails on any violation; an offline mode (network cut after load, reload, network back); two-device helpers (two browser contexts, two accounts). DIRECTION §3.6, §3.7. Tests: e2e-web (the harness's own: the app loads at the origin on all three viewports; the axe fixture passes a clean page and fails a fixture page with a planted violation; offline mode cuts and restores the network)."
}
```

The area file's purpose line (lines 1–5): _"The monorepo, its tooling, the
API contract, running everything locally as in production, CI, and the two
end-to-end harnesses every later task's e2e tests are written in. The
harnesses land before anything needs them."_ This task is the second of those
two harnesses — the e2e-web one — and it lands before anything needs it.

## Effort estimate

**2 days** (from the `.tji`).

## Repository

**estante-de-cifras** (`/home/ruoso/devel/estante-de-cifras`). The work lands
entirely under **`e2e/web/`** (reserved by `foundation.monorepo`, today just
[`e2e/web/README.md`](../../../e2e/web/README.md)): a Node/Playwright test
package — `package.json`, `package-lock.json`, `playwright.config.js`,
`eslint.config.js`, a small `lib/`/`fixtures/` of harness fixtures and
helpers (the axe check, offline mode, the two-device primitive, a
purpose-written page with a planted violation), and the harness's own smoke
tests under `tests/`. The note does **not** start with `cifra.md:`, so nothing
lands in the cifra.md repository. No file outside `e2e/web/` is edited — the
harness runs against the existing `compose.yaml` (`foundation.compose`) and the
existing `scripts/gate` e2e-web wiring as-is.

**No design delta is authored.** DIRECTION §3.6 (lines 386–392) already says
the end-to-end tests run against the one-origin compose stack here, §3.7 (lines
394–426) already names Playwright and "axe at WCAG 2.1 AA" as the carried-over
tooling, and the `.tji` note and `scripts/gate` already specify the harness's
shape — three viewport projects, the axe fixture, offline mode, the two-device
helpers, its base URL and how it is invoked (`npx playwright test --workers`).
This task turns that promise into a Playwright package; it introduces nothing
new to the direction.

## Inherited dependencies

- **`foundation.e2e_api`** — `depends !e2e_api` (`.tji` line 68), **settled**
  (`complete 100`, [`tasks/25-foundation.tji`](../../25-foundation.tji), commit
  `5628ee1`). The e2e-api harness landed the compose-stack contract this
  harness reuses: the `ESTANTE_E2E_BASE_URL`/`ESTANTE_E2E_MAIL_URL` convention,
  the fail-fast env read, purpose-written fixtures, and the `lib/` +
  `fixtures/` + per-package `eslint.config.js` layout this one mirrors for the
  web side (see [`e2e_api.md`](./e2e_api.md)). It also switched the gate's e2e
  level on; this task is the second half of it.
- **`service.serve_app`** — `depends service.serve_app` (`.tji` line 68),
  **settled** (`complete 100`, [`tasks/30-service.tji`](../../30-service.tji)
  line 60, commit `8c42cb1`). The service now serves the built PWA at the root
  of the one origin with the API beneath it, SPA-falls-back deep links to the
  app shell, stamps `X-Robots-Tag: noindex` on every response, and sets the
  service-worker cache headers (see [`serve_app.md`](../service/serve_app.md)).
  **This is what makes a web e2e harness possible**: until `/` returned the app
  shell there was nothing for Playwright to load. Every screen this harness and
  its downstream consumers visit is served by `serve_app`.
- Transitively settled and relied on:
  - **`foundation.compose`** (`complete 100`) — the one-origin stack this
    harness drives a browser against: `postgres`, `mail` (`axllent/mailpit`)
    and `service` (the multi-stage image with git and the built app), each
    healthchecked, brought up by `docker compose … up --build --detach --wait`
    at `ESTANTE_E2E_BASE_URL` and torn down with `down --volumes`
    ([`compose.md`](./compose.md), [`compose.yaml`](../../../compose.yaml)
    lines 55–80).
  - **`foundation.ci`** (`complete 100`) — CI runs `scripts/gate` on every push
    over both repositories, with Docker and **Playwright's browsers installed**
    (`npx playwright install --with-deps`) so the gate's e2e-web level runs the
    moment this harness exists ([`ci.md`](./ci.md)).
  - **`foundation.app_tooling`** (`complete 100`) — the app shell at `/` that
    the clean-page axe check and the load/offline smoke tests render; Vite's
    `dist`, the PWA plugin (precache shell, `registerType: 'prompt'`,
    `navigateFallback: '/index.html'`, `clientsClaim`, `skipWaiting: false`),
    and the app's own axe-at-AA tag set this harness mirrors
    ([`app_tooling.md`](./app_tooling.md),
    [`app/vite.config.js`](../../../app/vite.config.js) lines 36–69).
  - **`foundation.monorepo`** (`complete 100`) — the `e2e/web/` directory and
    `scripts/gate`.

**Downstream.** This harness is the one place e2e-web tests are written for the
rest of the project (the area purpose line; the one-harness rule in
[`tasks/refinements/README.md`](../README.md)). Every app-facing journey that
lands a browser test writes it **here**, reusing the three viewport projects,
the axe fixture, offline mode and the two-device primitive this task delivers:
the sign-in and new-device journeys (`account.*`, workflows 1 and 13), the
save/edit journey (`songs.*`, workflow 4), sharing and fork (`books.*`,
workflows 10 and 11), sync and conflicts offline (`sync.*`, workflows 8 and 9),
the shell and chart (`shell.*`), the instrument and explorer screens
(`music.*`). None builds a parallel harness — including the Mailpit-reading
step a web sign-in journey needs, which the first `account` e2e-web task adds
to this harness (as e2e-api carries its own mail helper), not a new one.

## What this task is

Fill `e2e/web/` with the Playwright test package that drives a real browser
against the running compose stack — the app served by the service on its one
origin — exactly as a user's device would, plus the reusable fixtures every
later e2e-web test is written on. It delivers five things:

1. **Three viewport projects — phone, tablet and computer** — configured so
   every test runs on all three, with `use.baseURL` resolved from
   `ESTANTE_E2E_BASE_URL` (the one origin, app + API);
2. an **axe fixture** that checks WCAG 2.1 AA (the same tag set the app's
   behavior-level axe matcher uses) on a page and fails the test on any
   violation — the seam every screen a later test touches is held to;
3. an **offline mode** helper — load online, wait for the service worker to
   control the page, cut the network (`context.setOffline(true)`), reload,
   restore it — the primitive the offline-first journeys (workflows 8, 9) are
   tested through;
4. a **two-device primitive** — two isolated browser contexts (two independent
   sessions/cookie jars), the seam the sharing and new-device journeys
   (workflows 10, 13) bind an account to each; and
5. the harness's **own smoke tests**, which prove the app loads at the origin
   on all three viewports, the axe fixture passes a clean page and fails a
   planted violation, and offline mode cuts and restores the network — the
   executable proof that `serve_app`, the compose stack and the CI e2e-web path
   actually run end to end in a browser.

## Why it needs to be done

The e2e-web half of the gate's e2e level has existed, wired and waiting, since
`foundation.ci`: `scripts/gate` already runs `e2e_preflight` for `e2e/web`
(installing its deps and asserting Playwright's browsers are present, lines
221–242) and already runs `CI=true npx --no-install playwright test
--workers="$E2E_WORKERS"` against the live stack (lines 348–357) — but only
**once `e2e/web/package.json` exists** (lines 316, 348–359). Until then the
gate prints `skip "estante e2e-web: e2e/web/package.json does not exist yet"`
(line 359) and no browser ever loads the app that `service.serve_app` now
serves. This task closes that: the moment the package lands, the gate drives a
real browser against the one origin on every push and in CI.

It is also the foundation every later app-facing test stands on. The project
forbids parallel harnesses, so the viewport projects, the axe fixture, offline
mode and the two-device primitive written here are what the sign-in, save,
sharing, sync-and-conflict and shell/chart e2e-web tests reuse. Getting the
seams right now — three projects that run every test ×3, one axe check held to
AA, one way to go offline, one way to open a second device — is the task. The
app's accessibility promise in particular (React Aria + "axe at WCAG 2.1 AA",
DIRECTION §3.7 lines 396–426) is only kept if the axe fixture every screen runs
through is right from the first journey.

## Inputs / context

Governing direction, [`docs/DIRECTION.md`](../../../docs/DIRECTION.md):

- **§3.6** (lines 277–392):
  - "**The app and the service share no code**, only the HTTP API and the
    format" (line 288) — this harness is a third, independent device-side
    client: a browser driver that speaks only HTTP to the one origin and shares
    no code with `app/` or `service/`.
  - **One origin / local-as-production** (lines 386–392): `compose.yaml` brings
    up Postgres, the service's image with git, the hook and the built app and a
    mail catcher, and "the end-to-end tests run against that one origin"; "CI
    runs the app's tests, the Go tests and the end-to-end tests here". The
    harness loads the app from that one origin, never a Vite dev server.
  - **The API** (lines 355–371): books and git "for its members only, by
    session" (369–371); sharing "up to fifty people per book" (366–368) — the
    surfaces the two-device journeys cover downstream through two sessions.
- **§3.7** (lines 394–426) — the app:
  - **React Aria Components**, chosen for "the richest accessible experience",
    carrying "keyboard and screen-reader behaviour, press and touch handling
    that works on phones … drag and drop with a keyboard alternative" across "a
    phone, a tablet and a computer alike" (lines 396–405) — why the harness
    runs every test on three viewports with touch emulation on the mobile two.
  - "**One owner for the data: a Web Worker.** It holds git, the working copy
    and the search index … **The main thread never touches IndexedDB**" (lines
    406–409) — the architecture the offline journeys exercise: the Worker's
    precached app works with the network cut.
  - "the app is installed and cached up front, so once loaded the app works
    with no network" (lines 405, 424–426; reinforced by the PWA config's
    precache + `navigateFallback`) — the behavior offline mode pins.
  - "**axe at WCAG 2.1 AA**" among the carried-over tooling, with "Playwright"
    named beside it (lines 424–426) — the two tools this harness is built on.
- **§1 Offline first** (lines 29–31): "The app works in a lesson with no
  signal. Sync is something that happens when there is a network, never
  something the app waits for" — the standing rule offline mode makes testable.
- **§3.3** one origin / no CORS (line 170); no book without an account, at most
  fifty per book (lines 175–176) — structural for the two-device journeys.

The gate (the single source of truth for how this harness is invoked),
[`scripts/gate`](../../../scripts/gate):

- **Header** (lines 28–39) — the e2e-web level is "`e2e/web/` (Playwright:
  phone, tablet and computer, axe)"; parallelism "is always bounded … and
  Playwright `--workers=N` with an explicit N; nothing [uses a bare] `-j`"
  (lines 55–56); "A harness that exists must run" (line 38).
- **`E2E_WORKERS`** (lines 63–66) — defaults to `nproc` **capped at 4**;
  forwarded to Playwright as `--workers`. The config must not pin its own
  `workers` (it would fight the gate's bound).
- **`stack_up()`** (lines 247–267) exports, per run, free loopback ports and
  `ESTANTE_E2E_BASE_URL=http://127.0.0.1:$ESTANTE_HTTP_PORT` (the one origin,
  app + API, line 253), `ESTANTE_E2E_MAIL_URL` (the catcher, line 254), the
  `ESTANTE_PG_*` credentials and `ESTANTE_COMPOSE_PROJECT`; then `docker
  compose … up --build --detach --wait --wait-timeout 300`. **The stack is
  already healthy before any test runs** (`--wait`), so tests navigate, they do
  not poll for startup.
- **`e2e_preflight()`** (lines 211–243) — once `e2e/web/package.json` exists:
  `npm_install_if_needed "estante e2e-web"` (line 224); then it **fails** if
  `@playwright/test` is not a dependency (lines 227–228) or if the browsers the
  config names are not installed (lines 229–240). The gate **checks** the
  browsers; it does **not** install them — `foundation.ci` provisions them. The
  browsers required are derived by **`playwright_browsers()`** (lines 196–207):
  **`chromium` always**; `webkit` only if the config names `webkit` or a WebKit
  device (`iphone|ipad|safari`); `firefox` only if it names `firefox`. So the
  config's device/project names decide what CI must install.
- **The e2e-web block** (lines 348–360): in `e2e/web`, `npm run lint` **if** a
  `lint` script exists (351–353), then `CI=true npx --no-install playwright
  test --workers="$E2E_WORKERS"` (line 356). It runs Playwright **directly**,
  not through an `npm test` script — so `@playwright/test` must be installed
  (`--no-install`) and the config's `testDir`/`testMatch` must find the smoke
  tests, or Playwright exits non-zero and the gate fails (an empty suite is a
  non-zero exit — the smoke tests are mandatory for green).
- The e2e level is reached only when an e2e harness exists (lines 315–324);
  with `e2e/api/` already present the stack is already brought up, and landing
  `e2e/web/package.json` adds the browser leg. `stack_down()` (a trap) always
  tears the stack down.

Toolchain and app, on disk:

- [`.node-version`](../../../.node-version) → `24.20.0`; the repo is plain
  JavaScript (ESM) on Node, no TypeScript — `app/`, `api/` and `e2e/api/` all.
- [`app/vite.config.js`](../../../app/vite.config.js): `base: '/'` (line 15),
  `build.outDir: 'dist'` (line 18); **VitePWA** (lines 36–69) precaches the
  shell (`globPatterns`, line 42), `registerType: 'prompt'` (line 39),
  `navigateFallback: '/index.html'` (line 45) so a deep link works offline,
  `clientsClaim: true` (line 51) so the worker controls the first visit, and
  `skipWaiting: false` (line 52). The app already uses `axe-core`/`vitest-axe`
  at the behavior level ([`app/package.json`](../../../app/package.json)); this
  harness is the e2e-web counterpart with `@axe-core/playwright`.
- [`serve_app.md`](../service/serve_app.md) Constraints/Acceptance — `/`
  returns the shell, a deep link SPA-falls-back to the shell, every response
  carries `X-Robots-Tag: noindex`, `sw.js`/`index.html`/`manifest.webmanifest`
  revalidate while hashed assets are immutable — the served surface the smoke
  tests load.

Predecessor and sibling refinements: [`e2e_api.md`](./e2e_api.md) (the sibling
harness — the env convention, fail-fast env read, `lib/`/`fixtures/` layout,
per-package ESLint, "a third independent device-side client", purpose-written
fixtures, "the real journeys are owned by existing downstream leaves"),
[`serve_app.md`](../service/serve_app.md), [`compose.md`](./compose.md),
[`ci.md`](./ci.md), [`app_tooling.md`](./app_tooling.md).

## Constraints / requirements

- **Node/Playwright, plain JavaScript (ESM), invoked exactly as the gate
  invokes it.** `e2e/web/package.json` declares `"type": "module"`, lists
  `@playwright/test` and `@axe-core/playwright` as dependencies (so `npx
  --no-install playwright test` resolves, gate line 356), and ships a committed
  `package-lock.json` so `npm ci`/`npm_install_if_needed` is reproducible. A
  `playwright.config.js` (ESM) is the entry point; no `test` script is required
  by the gate (it runs Playwright directly), though one is provided for local
  use. No build or transpile step.
- **Black-box against the running stack; read the origin from the
  environment.** `playwright.config.js` sets `use.baseURL` from
  `ESTANTE_E2E_BASE_URL` and **fails fast with an actionable message** when it
  is unset (mirroring `e2e/api/lib/env.js`), so running Playwright outside the
  gate says "bring the stack up via scripts/gate, or set ESTANTE_E2E_BASE_URL".
  Tests navigate with `page.goto('/')` and relative paths. The harness neither
  starts nor stops the stack (the gate owns its lifecycle) and never reaches
  inside a container — it only does what a browser on the network can.
- **Three projects — phone, tablet, computer — every test on all three.**
  `projects` defines exactly three, each with a viewport (and `isMobile` +
  `hasTouch` on the mobile two), and **no project-level `testMatch` filter**,
  so every spec runs on all three. The `workers` count is left to the gate's
  `--workers` (never pinned in the config). `retries`/`forbidOnly` follow
  `process.env.CI` as Playwright's template does.
- **Chromium for all three projects** (see Decisions): the mobile viewports use
  Chromium mobile device descriptors (viewport, `deviceScaleFactor`,
  `isMobile`, `hasTouch`); the computer project a desktop Chromium viewport. The
  config names **no** `webkit`/`iphone`/`ipad`/`safari`/`firefox` token, so
  `playwright_browsers()` (gate lines 196–207) resolves to **`chromium` only**
  and CI installs just that one engine.
- **The axe fixture checks WCAG 2.1 AA and fails on any violation.** A
  Playwright fixture exposes an axe check built on `@axe-core/playwright`
  (`AxeBuilder`) configured with **exactly** the WCAG 2.1 AA tag set —
  `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` — the same set the app's behavior
  axe matcher uses (re-declared here, not imported: the app and the harness
  share no code, DIRECTION §3.6 line 288). The check asserts zero violations
  and, on failure, reports the rule and the offending node. Later tests call it
  on every screen they visit (the fixture makes it the one-line easy path).
- **Offline mode: load, wait for the worker, cut, reload, restore.** A helper
  loads a page online, waits for the service worker to control the page
  (`navigator.serviceWorker.ready` plus the workbox precache settling — the app
  is precache-first, `clientsClaim: true`), then `context.setOffline(true)`,
  reloads, asserts the shell still renders (the PWA's `navigateFallback`), and
  `context.setOffline(false)` to restore. This is Chromium network emulation —
  another reason all projects are Chromium (see Decisions).
- **Two-device primitive: two isolated contexts.** A helper opens a second
  `browser.newContext()` so a test holds two independent sessions (two cookie
  jars, two "devices") in one run. At this foundation stage no account surface
  exists, so the helper delivers the context isolation; binding an account to
  each (the Mailpit sign-in step) is added by the downstream `account` e2e-web
  task, as e2e-api carries its own mail helper — not a new harness.
- **Bounded parallelism, isolated tests.** Playwright runs with the gate's
  `--workers` (≤4); nothing runs an unbounded `-j`. The harness's own smoke
  tests create no server state and so are collision-free; the helpers the
  downstream journeys use (unique accounts/books per test) make server-state
  isolation the easy path there too.
- **A third, independent device-side client — shares no code with app or
  service** (DIRECTION §3.6 line 288). The harness imports neither `app/` nor
  `service/` nor `e2e/api/` code; it drives a browser against the one origin and
  re-declares the small constants it needs (the axe tag set).
- **Accessibility is this harness's first-class concern** — React Aria + axe at
  WCAG 2.1 AA (DIRECTION §3.7 lines 396–426). The axe fixture is the mechanism;
  status reported by the rule id and node, never colour (the standing rule).
- **No song text in logs; purpose-written fixtures only.** The harness logs
  nothing of its own beyond Playwright's reporter output; any fixture content
  (the planted-violation page, later any song shown on screen) is
  purpose-written, never anyone's copyrighted words (the standing rule). No
  `noindex`/cache behavior is this harness's to set — `serve_app` owns it; a
  later task may assert the header from the browser if a journey needs it.
- **No book without an account** holds structurally: the harness has no
  back-door to a book; any book a later test opens goes through a real session
  and membership over the API. This task's own smoke tests touch no book — they
  load the public app shell, an in-page fixture, and go offline.
- **Rules that do not bear on this task.** *Canonical form over preserving
  content* is the format's and the service's; *no song text in logs* has no
  service surface here — none is scoped. *Offline-first* and *accessibility*
  do bear, and are scoped above.

## Acceptance criteria

**Behaviour delivered.**

- `e2e/web/` is a runnable Node/Playwright package: `npm ci` installs it, the
  configured browser (chromium) present, and `npx playwright test
  --workers=4` runs green against a live stack; a `lint` script (ESLint flat
  config, matching `app/`/`api/`/`e2e/api/`) runs clean. The gate's e2e-web
  block (lines 348–357) finds the config and the smoke tests, so the e2e-web
  level switches from "skipped" to "run" on every push and in CI.
- `playwright.config.js`: `use.baseURL` from `ESTANTE_E2E_BASE_URL` (fail-fast
  when unset); three projects — phone, tablet, computer — all Chromium, every
  spec on all three; `workers` left to the gate's `--workers`.
- An **axe fixture** (`lib/axe.js` extending Playwright's `test`): a check over
  `@axe-core/playwright` with the WCAG 2.1 AA tag set that fails on any
  violation, available to every spec.
- An **offline-mode helper** (`lib/offline.js`): go online → wait for the
  worker to control the page → `setOffline(true)` → reload → `setOffline(false)`.
- A **two-device helper** (`lib/devices.js`): open a second isolated browser
  context.
- `fixtures/` holds a purpose-written `violation.html` (a page with a planted,
  axe-detectable violation) for the negative axe test. `e2e/web/README.md`
  describes how to run the harness (via `scripts/gate`, or against a stack up
  with `ESTANTE_E2E_BASE_URL` set and `npx playwright install chromium` done).

**Tests the task lands with, by level.** Per the `.tji` note — _"Tests: e2e-web
(the harness's own: the app loads at the origin on all three viewports; the axe
fixture passes a clean page and fails a fixture page with a planted violation;
offline mode cuts and restores the network)"_ — this task lands with its own
**e2e-web** smoke tests and only those (it is itself the e2e-web harness; there
is no pure module, component or endpoint of its own to unit- or behavior-test —
see Decisions). The gate runs them against the stack it brings up, on each of
the three projects:

- **e2e-web — `e2e/web/tests/app-loads.spec.js`** (Playwright, all three
  projects): `page.goto('/')` at `ESTANTE_E2E_BASE_URL` renders the app shell
  (a stable landmark/title is visible), and the axe fixture finds **zero**
  WCAG 2.1 AA violations on it. Running on all three projects proves the app
  loads on phone, tablet and computer viewports and is accessible on each. Pins
  DIRECTION §3.6 lines 386–392 (end-to-end against the one origin), §3.7 lines
  399/426 (three viewports; axe at AA), `serve_app`'s `/` → app shell, and the
  note's "the app loads at the origin on all three viewports" and the clean
  half of "the axe fixture passes a clean page".
- **e2e-web — `e2e/web/tests/axe-fixture.spec.js`** (Playwright): the axe
  fixture passes on a known-clean page (the served app shell, or a trivial
  clean fixture) and **fails** on `fixtures/violation.html` loaded via
  `page.setContent()`/`goto` — the test asserts the fixture *reports* a
  violation (the negative case is wrapped so a detected violation is the
  expected outcome, not a red test). Pins that the axe seam both passes clean
  and actually catches a real WCAG 2.1 AA violation (DIRECTION §3.7 line 426),
  and the note's "fails a fixture page with a planted violation" — so no later
  screen's axe check is a silent no-op.
- **e2e-web — `e2e/web/tests/offline.spec.js`** (Playwright, Chromium):
  `goto('/')`, wait for the service worker to control the page, `setOffline(true)`,
  `reload()`, the app shell still renders (the PWA precache +
  `navigateFallback`), then `setOffline(false)` and the page works online
  again. Pins the offline-first promise (DIRECTION §1 lines 29–31, §3.7 lines
  405/424–426; `app/vite.config.js` lines 42–52) and the note's "offline mode
  cuts and restores the network" — the primitive workflows 8 and 9 depend on.

The closer confirms all three spec files exist and ran — not skipped — across
the three projects in the gate's e2e-web step (line 356) before committing.

**Deferred work.** **None registered.** This harness plus its smoke tests are
self-contained. The real device journeys written *in* this harness — sign-in
and new-device (workflows 1, 13), save/edit (workflow 4), sharing and fork
(workflows 10, 11), sync and conflicts offline (workflows 8, 9), the shell,
chart, instrument and explorer screens — are **not** follow-ups this task
defers: they are owned by existing WBS leaves (`account.*`, `songs.*`,
`books.*`, `sync.*`, `shell.*`, `music.*`) that write their e2e-web tests here
when they land, each reusing these fixtures. The one web-harness extension
those leaves need — a Mailpit-reading sign-in step so a browser can complete
the emailed-link flow — is part of the first `account` e2e-web journey, not a
standalone leaf. No new WBS leaf, and no human-judgment item, arises from this
task.

## Decisions

**Chromium for all three viewport projects; the mobile two via Chromium device
emulation; no WebKit or Firefox.** *Rationale:* the note mandates an offline
mode ("network cut after load, reload, network back"), and Playwright's network
emulation — `context.setOffline()` — is a **Chromium** (and Firefox) capability
that **WebKit does not support**; running the mandated offline journeys on all
three viewports therefore forces a single engine that can cut the network, and
Chromium is the one every project can share. The direction frames the three
dimensions as *viewports* — "a phone, a tablet and a computer alike" (§3.7 line
399) — not engines; what the journeys pin is behavior and accessibility (React
Aria + axe), which are engine-agnostic. Chromium mobile device descriptors give
real viewport sizes, `deviceScaleFactor`, `isMobile` and `hasTouch`, so touch
handling is still exercised. Keeping to Chromium also bounds CI's browser
install to one engine (`playwright_browsers()` → `chromium`, gate lines
196–207) and keeps every-test-×3 within the ≤4-worker bound. *Alternative
rejected:* WebKit for the phone/tablet projects (the real iOS engine, which the
gate's `iphone|ipad|safari`→webkit detection anticipates) — authentic mobile
rendering, but Playwright cannot put a WebKit context offline, so the offline
journeys the direction centres could not run on those projects, splitting the
suite by engine for a cross-engine rendering parity the direction does not ask
for; and Firefox, which no journey or device here motivates and which would
add a third engine's install for nothing it pins.

**Playwright on plain JavaScript (ESM), no TypeScript, no build step; a
`playwright.config.js` entry, not an `npm test` script.** *Rationale:* `app/`,
`api/` and `e2e/api/` are all plain JS on Node, and the gate invokes `npx
--no-install playwright test` directly (line 356), reading `playwright.config.js`
— matching that keeps the harness one `npm ci` away from running and lets
`--workers` forward with no wrapper. *Alternative rejected:* TypeScript — a
transpile/config layer the rest of the repo does not use, for a black-box
browser package whose surface is the DOM over the wire, with no payoff; and a
custom `npm test` indirection the gate would bypass anyway.

**`use.baseURL` from `ESTANTE_E2E_BASE_URL`, read and validated in the config,
with no `webServer` and no stack management.** *Rationale:* the gate owns the
stack's lifecycle (`stack_up`/`stack_down`) and the stack is already healthy
before Playwright starts (`--wait`, gate line 261), so the config just points
`baseURL` at the exported origin and tests navigate; a fail-fast read (mirroring
`e2e/api/lib/env.js`) turns "ran outside the gate" from a cryptic connection
error into an actionable one. *Alternative rejected:* a Playwright `webServer`
block that boots the app or the stack — it would double-manage what the gate
owns and break the one-stack-per-run isolation (exactly as `e2e_api.md` rejected
a Vitest `globalSetup` that brought the stack up).

**The axe fixture is built on `@axe-core/playwright` with the WCAG 2.1 AA tag
set re-declared, not shared with the app.** *Rationale:* `AxeBuilder` is axe's
first-party Playwright integration and runs axe inside the page under test; the
AA tag set (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) is the same one the
app's behavior-level matcher uses, so a screen that passes in a component test
is held to the identical bar end to end — but the constant is re-declared here,
because the app and the harness share no code (DIRECTION §3.6 line 288). A fixture
(extending Playwright's `test`) makes the check the one-line easy path every
later screen takes. *Alternative rejected:* importing the app's axe helper to
avoid re-declaring four strings — it would couple the harness to `app/`'s
internals across the share-no-code boundary for a trivial constant; and
hand-rolling an axe run without `AxeBuilder`, which would reimplement the
injection/serialization the first-party integration already handles.

**The negative axe test uses an in-harness purpose-written `violation.html`,
not a deliberately broken app screen.** *Rationale:* the fixture must prove it
*catches* a violation, not just that it passes — otherwise every green axe check
downstream could be a silent no-op. A tiny purpose-written page with one known
axe-detectable fault (loaded via `page.setContent()`/`goto`, needing no service
route) is self-contained and stable, and `AxeBuilder` analyses whatever DOM the
page holds regardless of origin. *Alternative rejected:* planting a violation in
the real app to test the fixture — it would mean shipping broken accessibility
in `app/` (breaching the standing rule) purely to exercise the harness; and
asserting only the clean case, which leaves the fixture's failure path unproven,
which the testing policy forbids.

**Offline mode waits for the service worker to control the page before cutting
the network.** *Rationale:* the app is precache-first (`globPatterns`,
`navigateFallback`, `clientsClaim: true`; `app/vite.config.js` lines 42–51), so
a reload survives offline only once the worker has installed and taken control;
waiting on `navigator.serviceWorker.ready` (and the precache settling) before
`setOffline(true)` makes the test assert the real offline-first behavior rather
than racing the worker's first install. *Alternative rejected:* cutting the
network immediately after the first `goto` — it would race service-worker
registration and flake, testing the race rather than the offline promise.

**The two-device helper ships the context-isolation primitive now; account
binding comes with the first `account` e2e-web journey.** *Rationale:* two
"devices" is two isolated browser contexts (two cookie jars), which Playwright
gives directly via `browser.newContext()`; at foundation time there is no
sign-in surface to bind an account to, so shipping the isolation primitive is
exactly the seam the sharing/new-device journeys need, and they add the
Mailpit-driven sign-in step when they land — reusing this harness, never a new
one (as `e2e_api.md` leaves its real journeys to downstream leaves). *Alternative
rejected:* deferring the two-device primitive entirely until an account exists —
it is named in the note and is a one-helper seam; landing it now with the rest
of the harness is where it belongs. *Alternative rejected:* building the full
sign-in/mail flow now — there is no account surface to sign into yet, so it
would be dead, untested code.

**A `lint` script, matching `app/`/`api/`/`e2e/api/`.** *Rationale:* the gate
runs `npm run lint` for e2e/web when the script exists (gate lines 351–353); an
ESLint flat config consistent with the rest of the repo holds the harness to the
same standard as the code it tests, at no extra invocation cost. *Alternative
rejected:* no lint — the gate skips it, but the harness is code every later task
edits, and leaving it unlinted invites drift.

**No unit or behavior tests of this task's own, and no design delta.**
*Rationale:* the deliverable *is* the e2e-web harness — a browser-driving test
package whose only meaningful assertions are against the app served by the
running stack, which is the e2e-web level by definition; it has no pure
in-process module or React component of its own to pin at a lower level, and the
fixtures are proven exactly by the three smoke tests that use them. The note
names only e2e-web, and that is what lands. DIRECTION §3.6/§3.7 and the gate
already describe this harness precisely, so nothing in the direction changes.
*Alternative rejected:* unit-testing the axe tag-set constant or the offline
helper in isolation — they have no behaviour independent of a real page and a
real worker, and the smoke tests exercise them against the live app, which is
the honest level.

## Open questions

(none — all decided)

## Status

**Re-deferred** — 2026-10-05.

Implementer halted: the app does not register its service worker. `app/src/main.jsx` only mounts React and never calls `registerSW()`; `app/vite.config.js` sets VitePWA `injectRegister: null`, so no registration is auto-injected. Consequently `navigator.serviceWorker.ready` never resolves, `context.setOffline(true)` + reload returns `net::ERR_INTERNET_DISCONNECTED`, and `offline.spec.js` — the third mandatory smoke test — cannot be made to pass without editing `app/` (outside this task's scope and across the app↔harness share-no-code boundary).

Per the Tests-land-with-this-task rule the implementer stopped rather than landing a harness whose required test is unfixable in scope.

**Blocking prerequisite registered:** `foundation.app_sw_register` (0.5d) — register the service worker in `app/src/main.jsx` by importing `virtual:pwa-register` and calling `registerSW()`. Once it is `complete 100`, `foundation.e2e_web` is unblocked and can be re-picked.

No files were created or edited; nothing is staged.

## Status

**Done** — 2026-10-05.

- `e2e/web/package.json` and `e2e/web/package-lock.json`: Node/Playwright package (`"type": "module"`) with `@playwright/test` and `@axe-core/playwright` as dependencies, committed lockfile for reproducible installs.
- `e2e/web/playwright.config.js`: three Chromium viewport projects (phone, tablet, computer), `use.baseURL` from `ESTANTE_E2E_BASE_URL` (fail-fast on unset), `workers` left to the gate's `--workers`, `retries`/`forbidOnly` following `process.env.CI`.
- `e2e/web/eslint.config.js`: ESLint flat config matching `app/`/`api/`/`e2e/api/`; the `lint` script in `package.json` triggers the gate's `npm run lint` check (gate lines 351–353).
- `e2e/web/lib/axe.js`: Playwright fixture extending `test` with an axe check over `@axe-core/playwright` (`AxeBuilder`) at the WCAG 2.1 AA tag set (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`), asserting zero violations.
- `e2e/web/lib/offline.js`: offline-mode helper — loads a page online, waits for `navigator.serviceWorker.ready`, calls `context.setOffline(true)`, reloads, asserts the shell renders, then `setOffline(false)`.
- `e2e/web/lib/devices.js`: two-device primitive — opens a second isolated `browser.newContext()` for independent-session tests.
- `e2e/web/lib/env.js`: `ESTANTE_E2E_BASE_URL` read and fail-fast validation, mirroring `e2e/api/lib/env.js`.
- `e2e/web/fixtures/violation.html`: purpose-written page with a planted axe-detectable WCAG 2.1 AA violation for the negative axe test.
- `e2e/web/tests/app-loads.spec.js`: smoke test — `page.goto('/')` renders the app shell and passes zero AA violations; ran on phone, tablet and computer (×3 projects).
- `e2e/web/tests/axe-fixture.spec.js`: axe fixture self-test — passes on the clean shell, catches the planted violation in `fixtures/violation.html`; ran on all three projects.
- `e2e/web/tests/offline.spec.js`: offline smoke test — cuts network after SW control, reload renders shell, restore works; ran on all three projects.
- `e2e/web/README.md`: updated to describe how to run the harness (via `scripts/gate`, or with `ESTANTE_E2E_BASE_URL` set and `npx playwright install chromium`).
- Gate's e2e-web level switches from "skipped" to "run": 12 tests passed (4 × 3 projects) in 4.1 s against the live compose stack.
