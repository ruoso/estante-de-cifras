# e2e/web

The e2e-web harness: Playwright against the compose stack — the app served by
the service on its one origin, driven in a real browser exactly as a user's
device would, on phone, tablet and computer viewports, with axe at WCAG 2.1 AA
on every screen a test touches, and offline where the test is about offline
(DIRECTION §3.6, §3.7; `tasks/refinements/README.md`).

It is a third, independent device-side client: it speaks only HTTP to the one
origin and shares no code with `app/`, `service/` or `e2e/api/` (DIRECTION §3.6
line 288). It neither starts nor stops the compose stack and never reaches
inside a container — the gate owns the stack's lifecycle.

## How it runs

### Via the gate (the canonical path)

`scripts/gate` brings the compose stack up once (built from the working tree,
on free ports), exports `ESTANTE_E2E_BASE_URL` (the one origin, app + API), and
runs `npx --no-install playwright test --workers="$E2E_WORKERS"` here — with
`E2E_WORKERS` bounded (`nproc`, capped at 4) — then tears the stack down. CI
provisions Playwright's browser (`npx playwright install --with-deps chromium`)
so this level runs on every push. Nothing to set up by hand.

### Against a stack you brought up yourself

```sh
# Install the harness and the browser (chromium only — see Projects).
npm ci
npx playwright install chromium

# Point it at a stack you brought up (the one origin, app + API), then run it.
export ESTANTE_E2E_BASE_URL=http://127.0.0.1:<port>
npx playwright test --workers=4
```

`playwright.config.js` fails fast with an actionable message if
`ESTANTE_E2E_BASE_URL` is unset — the harness is black-box against a live stack,
so there is nothing to load without one.

## Projects

Three projects — **phone**, **tablet** and **computer** — with no per-project
test filter, so every spec runs on all three (DIRECTION §3.7, "a phone, a tablet
and a computer alike"). All three are **Chromium**: Playwright's offline network
emulation (`context.setOffline`) is a Chromium capability WebKit lacks, and the
offline journeys must run on every viewport, so one shared engine. The mobile
two use Chromium device descriptors (viewport, `deviceScaleFactor`, `isMobile`,
`hasTouch`); the computer a desktop Chromium viewport. Because the config names
no `webkit`/`iphone`/`ipad`/`safari`/`firefox` token, the gate installs
chromium only.

## Layout

- `playwright.config.js` — the entry point: `use.baseURL` from
  `ESTANTE_E2E_BASE_URL`, the three viewport projects, no `webServer`, `workers`
  left to the gate's `--workers`.
- `lib/env.js` — the fail-fast read of `ESTANTE_E2E_BASE_URL`.
- `lib/axe.js` — the axe fixture: `test`/`expect` with a `checkA11y()` that runs
  `@axe-core/playwright` at WCAG 2.1 AA and fails on any violation. Every later
  screen's test calls it.
- `lib/offline.js` — offline mode: load online, wait for the worker to control
  the page, cut the network, reload, restore.
- `lib/devices.js` — the two-device primitive: open a second isolated browser
  context (two sessions, two cookie jars).
- `fixtures/violation.html` — a purpose-written page with one planted,
  axe-detectable WCAG 2.1 AA violation, for the negative axe test.
- `tests/` — the harness's own smoke tests (`app-loads`, `axe-fixture`,
  `offline`): the app loads at the origin on all three viewports, the axe
  fixture passes a clean page and fails the planted violation, and offline mode
  cuts and restores the network.
