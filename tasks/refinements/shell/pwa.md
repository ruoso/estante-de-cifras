# shell.pwa — Installable and offline

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 43–48, `task pwa`
("Installable and offline") inside `task shell`.

Note: _"Manifest, icons, the service worker precaching everything, the update
taken on the next launch. Tests: behavior (the manifest and icons; an update
held until the next launch); e2e-web (offline: loaded on the stack, the network
cut, reloaded — the app opens from the precache; an update taken on the next
launch)."_

## Effort estimate

2 days (`tasks/50-shell.tji:44`).

## Repository

**estante-de-cifras** only. App work under `app/` (the PWA manifest module,
the icons, the main-thread update affordance) and the e2e-web spec under
`e2e/web/`. Nothing lands in cifra.md, and nothing in `service/` — the app and
the service share no code (DIRECTION §3.6). A one-line normative design delta
lands in `docs/DIRECTION.md` §3.7 (see Decisions).

## Inherited dependencies

Both direct dependencies are **settled** (Done):

- **`shell.layout`** (`depends !layout`, [`tasks/50-shell.tji:46`];
  [`tasks/refinements/shell/layout.md`](./layout.md)). The mount tree the
  precache serves offline: `app/src/main.jsx` mounts `<App>`, which composes
  `ThemeRoot → LocaleRoot → AppShell` (`app/src/App.jsx:29-35`); the shell
  opens on **Search** on every viewport. `shell.layout` already left an
  `e2e/web/tests/offline.spec.js` smoke test that cuts the network, reloads and
  asserts the shell (`<main>` + the `Search` level-1 heading) renders from the
  precache.
- **`storage.migrations`** ([`tasks/refinements/storage/migrations.md`](../storage/migrations.md)).
  The versioned IndexedDB migration framework inside the Worker
  (`app/src/worker/migrations.js`, `logic.js:42`). Its Decision 4 binds schema
  migration to the **same next-launch boundary** this task implements: because
  the service worker does not skip waiting, the Worker and the main thread are
  always the same build within one load, so a migration never runs under a
  live edit (`migrations.md` Decision 4; `migrations.md:267-275` hands the
  service-worker activation lifecycle and the first-screen-over-a-migrated-DB
  journey downstream to the shell tasks). This task is the activation side of
  that lifecycle; `storage.migrations` tested the IndexedDB-stepping side.

Settled transitive context this task builds on, not re-decides:

- **`foundation.app_tooling`** — wired `vite-plugin-pwa`; the VitePWA block and
  the precache strategy already exist (`app/vite.config.js:36-69`).
- **`foundation.app_sw_register`**
  ([`tasks/refinements/foundation/app_sw_register.md`](../foundation/app_sw_register.md))
  — added the module-scope `registerSW({ immediate: true })` in
  `app/src/main.jsx:16`, and explicitly handed **"the full manifest polish,
  real icons, and the user-visible 'update on next launch' behaviour and its
  e2e-web proof"** to `shell.pwa` (`app_sw_register.md:63-67, 195-198`).
- **`foundation.e2e_web`** — the Playwright harness: three viewports, the axe
  fixture, and the offline helper (`e2e/web/lib/offline.js`) this task reuses.
- **`service.serve_app`** — the Go handler serves the built app at `/` on one
  origin, with `sw.js`/`index.html`/`manifest.webmanifest` at `no-cache` and
  content-hashed `assets/*` immutable; icons must fit that policy.

## What this task is

Make the app a real installable, offline-first PWA and surface its update
lifecycle. The service-worker precache, `navigateFallback`, `clientsClaim`,
`skipWaiting: false` and the manifest's text fields were configured by
`foundation.app_tooling` and the worker is registered by
`foundation.app_sw_register`; what is missing is the part a person sees and
installs: **real icons** in the manifest and the HTML head, and the
**user-visible update affordance** that honours "the update taken on the next
launch." Concretely: author icon assets and an `icons` array; link them from
`app/index.html`; capture the plugin's `onNeedRefresh` callback into a small
main-thread update state; and render a quiet, dismissible "a new version is
ready" notice in the shell that never interrupts a running session and lets the
person reload on their own terms. The update otherwise applies on the next
launch, which is the natural waiting-worker lifecycle `skipWaiting: false`
already produces.

## Why it needs to be done

DIRECTION promises a "static PWA, which the browser installs and caches"
(§3.3 lines 157–159) that is "installed and cached up front, so its weight is
not a constraint" (§3.7 lines 396–397) and works "in a lesson with no signal"
(§1 offline-first, lines 29–31). Without icons and a complete manifest the
browser will not offer to install the app or show a home-screen icon, and
without the update affordance a person can neither tell that a new version is
waiting nor choose to take it — the app would either silently diverge from the
server or (if it skipped waiting) move the shell out from under a live session.
`foundation.app_sw_register` deliberately left `onNeedRefresh` unwired and
named this task as its owner (`app_sw_register.md:63-67`). Downstream, the app
stores (DIRECTION §8) package this PWA, and every later screen relies on the
install-and-cache guarantee this task completes.

## Inputs / context

Governing documents (normative — the work order turns these into tests, it
does not redesign them):

- **DIRECTION §1** (lines 29–31) — _"Offline first. The app works in a lesson
  with no signal. Sync is something that happens when there is a network, never
  something the app waits for."_
- **DIRECTION §3.3** (lines 157–162, 170–173) — _"The same service serves the
  app — a static PWA, which the browser installs and caches … at the root of
  `estantedecifras.app`"_; _"The `.app` domain is HTTPS-only … which a PWA and
  passkeys need anyway."_; the **one origin** rule.
- **DIRECTION §3.7** (lines 396–397, 407–409, 424–426) — "installed and cached
  up front"; "One owner for the data: a Web Worker … The main thread never
  touches IndexedDB"; "Tooling carries over from Explore Chords: Vite, the PWA
  plugin …". Plus the design delta this task adds there (see Decisions): the
  install-and-update-on-next-launch bullet.
- **Workflow 8 — Sync** (`docs/workflows/08-sync.md:22-24, 51-54`) —
  _"Nothing runs while the app is closed: Safari has no background sync …"_ and
  the no-interruption principle: a song read full screen _"waits, and updates
  when the user leaves it. The middle of a performance is the worst moment for a
  song to move."_ The same principle governs applying a new shell version.
- **Workflow 1 — First run** (`docs/workflows/01-first-run.md:20-40`) — the
  example book "comes with the app" and opening it "puts it on the shelf as a
  local book"; the shelf shows something with no network. (The example book is
  bundled into the Worker chunk and thus precached — `app/src/worker/example-book.js`.)
- **`docs/mockups/theme.css`** — the visual language's default direction:
  `--bg` `#F3F4F1` and `--accent` `#1F4F8F`, already the manifest's
  `background_color`/`theme_color` and the `index.html` `theme-color`. The dark
  **Palco** theme exists (mockups README lines 12–15) — icons should read on
  both light and dark OS surfaces.

Real seams in the source (all exist today):

- `app/vite.config.js:36-69` — the `VitePWA({...})` block: `registerType:
  'prompt'` (`:39`), `injectRegister: null` (`:40`), `workbox.globPatterns:
  ['**/*.{js,css,html,svg,png,woff2}']` (`:42`), `navigateFallback:
  '/index.html'` (`:45`), `cleanupOutdatedCaches: true` (`:46`), `clientsClaim:
  true` (`:51`), `skipWaiting: false` (`:52`), and the `manifest` object
  (`:54-67`) with **no `icons` array**.
- `app/src/main.jsx:3,16` — `import { registerSW } from 'virtual:pwa-register'`
  and the module-scope `registerSW({ immediate: true })`; the comment at
  `:11-14` records that update callbacks are deliberately absent because "the
  user-visible update affordance is shell.pwa's".
- `app/index.html:6-7` — `<meta name="theme-color" content="#1F4F8F">` and the
  title; **no `<link rel="icon">` or apple-touch-icon**. No `app/public/`
  directory exists yet.
- `e2e/web/lib/offline.js` — `waitForServiceWorker(page)` (waits on
  `navigator.serviceWorker.controller`) and `runOffline(page, {path,
  whileOffline})` (go online → wait for worker → `setOffline(true)` → reload →
  assert → `setOffline(false)`); `e2e/web/tests/offline.spec.js` is the
  foundation smoke test.
- `e2e/web/playwright.config.js:39-43` — three Chromium projects: phone
  (`Pixel 7`), tablet (`Galaxy Tab S4`), computer (`Desktop Chrome`); every
  spec runs on all three. `context.setOffline` is Chromium-only (why all
  projects are Chromium).
- `e2e/web/lib/axe.js:9` — `checkA11y()` at WCAG 2.1 AA
  (`['wcag2a','wcag2aa','wcag21a','wcag21aa']`); the behavior matcher
  `app/src/a11y/axe.js` `checkWcag21aa` uses the same tag set (re-declared, not
  shared — the app and the e2e harness share no code).

## Constraints / requirements

- **Offline first.** The icons are precached (they match `globPatterns`
  `**/*.png`/`.svg`, `app/vite.config.js:42`) so the installed app shows them
  with no network; nothing this task adds waits on the network. The update
  check is background and silent until a new version is actually waiting.
- **The service worker is not the Web Worker.** The PWA service worker
  (workbox-generated `sw.js`) precaches assets; the Web Worker
  (`app/src/worker/`) owns git and IndexedDB. The update affordance lives on
  the **main thread** and touches neither IndexedDB nor the Worker — it reads
  only the plugin's registration callbacks (DIRECTION §3.7 "the main thread
  never touches IndexedDB"). The Worker's own bundle is already precached (it is
  a hashed `.js` chunk matched by `globPatterns`) and re-revisioned on each
  build, so it rides the same next-launch activation.
- **No mid-session takeover.** `skipWaiting` stays `false`
  (`app/vite.config.js:52`). The app must never call `skipWaiting`/reload on its
  own; a new version applies on the next launch, or only when the person
  explicitly chooses to reload (workflow 8 no-interruption; same-build-per-session,
  `migrations.md` Decision 4).
- **Accessibility.** The update notice is built with React Aria Components for
  every interactive part (the reload and dismiss actions), keyboard reachable,
  non-modal (it must not trap focus or steal it from a performance), axe clean
  at WCAG 2.1 AA; its status is carried by a word ("A new version is ready"),
  never colour alone (mockups README).
- **One origin.** The manifest `start_url`/`scope`/`id` stay `/`
  (`app/vite.config.js:58-60`); icon `src` paths are root-relative and served
  from the one origin by `service.serve_app`.
- **Serve-policy alignment.** Icons placed in `app/public/` land at the dist
  root with fixed names and are served by the Go app handler; the manifest and
  `index.html` already revalidate (`no-cache`), so an icon or manifest change
  reaches installed clients on the next launch. Do not rely on a hashed path
  for an icon referenced by a fixed name in `index.html`.
- **No new runtime or dev dependency.** Adding an npm package (an icon
  generator such as `@vite-pwa/assets-generator` or `sharp`) breaks `npm ci` in
  both `scripts/gate` and the `Dockerfile` until `app/package-lock.json` is
  regenerated by a network install. `vite-plugin-pwa` is already a dependency;
  icons are authored by hand (see Decisions).
- **No song text in logs.** N/A to the precache (app assets only) — noted for
  completeness; fixtures use the bundled example book, written for the purpose.

## Acceptance criteria

**Behavior delivered.** The browser offers to install the app and shows a
home-screen icon and name from a complete web app manifest; the installed app
opens offline from the precache on phone, tablet and computer. When a new
version is deployed, the running session is not disturbed; a quiet, dismissible
notice tells the person a new version is ready and lets them reload now, and
the new version otherwise takes effect on the next launch.

**Tests, by level** (the `.tji` note names behavior and e2e-web; this
refinement sharpens them and adds a unit level for the two pure modules — see
Decisions):

- **unit** — `app/src/pwa/manifest.test.js`: the extracted manifest module
  (`app/src/pwa/manifest.js`) carries `name`, `short_name`, `id`/`start_url`/
  `scope` = `/`, `display: 'standalone'`, `theme_color`/`background_color`
  matching the visual language, and an `icons` array that includes a 192×192
  and a 512×512 `any` icon plus a 512×512 `maskable` icon; every `icons[].src`
  and the apple-touch icon exist on disk under `app/public/`; and
  `app/index.html` links the manifest, a `rel="icon"` and an
  `apple-touch-icon`, and keeps the `theme-color` meta. Pins DIRECTION §3.3
  static-PWA installability and the mockup colours.
- **unit** — `app/src/pwa/update-state.test.js`: the main-thread update store —
  `onNeedRefresh` sets `updateReady` true and stashes the `updateSW` function;
  `dismiss()` hides the notice without clearing the waiting update; `reload()`
  calls `updateSW(true)` exactly once; a bare registration (no waiting worker)
  never sets `updateReady` and never calls `updateSW`. Pins "held until the next
  launch" and the no-skipWaiting rule (`app/vite.config.js:52`, workflow 8).
- **behavior** — `app/src/pwa/UpdateReady.behavior.test.jsx`: with the update
  store in the `updateReady` state the component renders a non-modal status
  carrying the word-bearing message, a React Aria **Reload now** button
  (invokes `reload()`) and a **Dismiss** button (invokes `dismiss()`), both
  keyboard reachable; it renders nothing when no update is waiting; axe clean
  (role/name/structure — `color-contrast` is a jsdom no-op, pinned at e2e-web).
  Pins the user-visible update affordance handed over by `app_sw_register.md`
  and the status-by-a-word rule.
- **e2e-web** — `e2e/web/tests/pwa.spec.js`, on phone, tablet and computer:
  - **Installable**: `index.html` links `manifest.webmanifest`; fetching it
    parses to a manifest with `name`, `start_url` `/`, `display: 'standalone'`,
    `theme_color`, and an `icons` array including 192, 512 and a `maskable`
    icon; each icon URL returns 200 with an image content-type; the
    apple-touch-icon link resolves. axe clean on the shell. Pins DIRECTION §3.3,
    §3.7.
  - **Offline from the precache**: via `runOffline`, with the network cut and
    the page reloaded the app opens (`<main>` + the `Search` heading) and the
    icons are still available from cache. axe clean. Pins §1 offline-first,
    workflow 2 §Offline. (Complements the foundation smoke
    `e2e/web/tests/offline.spec.js`, which stays.)
  - **Update taken on the next launch**: `context.route('**/sw.js', …)` serves
    a byte-changed service worker (an appended version comment) to simulate a
    new deploy; after the worker controls the page (v1), `registration.update()`
    installs the new worker, which goes to **waiting** (not active) because
    `skipWaiting` is false; the current page's controller is unchanged and the
    shell is not reloaded (the update is **held**). Then a fresh page/context (a
    next launch) activates the waiting worker and it controls the page (the
    update is **taken**). axe clean. Pins the `.tji` note, workflow 8
    no-interruption, and `skipWaiting: false`.

The closer verifies each named test ran (not skipped) in `scripts/gate`'s
output before committing.

## Decisions

- **Author icons by hand into `app/public/`; add no npm dependency.**
  *Rationale:* a new dep (an icon generator / `sharp`) would break `npm ci` in
  `scripts/gate` and the `Dockerfile` until `app/package-lock.json` is
  regenerated by a network install (recorded project hazard), for a one-time
  asset step; `vite-plugin-pwa` is already present and emits the manifest. The
  implementer commits a small icon set — an SVG source plus rasterised
  `icon-192.png`, `icon-512.png`, a `icon-512-maskable.png` (with maskable safe
  zone) and `apple-touch-icon-180.png` — derived from the visual language's
  accent on its background. *Alternatives rejected:* `@vite-pwa/assets-generator`
  or `sharp` (new dep + lockfile churn); generating icons in CI (same dep
  problem, and the output would not be reviewable in the diff).
- **Extract the manifest into a pure `app/src/pwa/manifest.js` consumed by
  `vite.config.js`.** *Rationale:* gives a framework-free, unit-testable seam
  for the icons/fields contract and keeps the Vite config thin; the module
  knows nothing of React (DIRECTION §3.7 "framework-free below the view").
  *Alternative rejected:* keep the manifest inline in `vite.config.js` and test
  by importing the config into Vitest — importing the config pulls the whole
  plugin graph (React, PWA) into the test environment for no benefit.
- **The update applies on the next launch; a quiet, dismissible notice offers an
  explicit reload; the app never skips waiting on its own.** *Rationale:* this
  is exactly what `skipWaiting: false` (`app/vite.config.js:52`) and the
  workflow-8 no-interruption principle require, and it preserves the
  same-build-per-session invariant `storage.migrations` depends on (a schema
  migration only runs at a launch boundary). A user-initiated reload is itself a
  launch — it tears down and rebuilds both threads — so it is safe and loses no
  work. The notice is non-modal so it cannot interrupt a performance.
  *Alternatives rejected:* (a) auto-`skipWaiting` + reload on `onNeedRefresh` —
  moves the shell out from under a live session and can run a migration mid-edit;
  (b) no affordance at all — `app_sw_register` handed the visible affordance
  here, and a silent-only update leaves a person unable to see or opt into a new
  version while reading offline.
- **Simulate the new deploy in e2e with `context.route('**/sw.js')` appending
  bytes.** *Rationale:* it drives the real workbox install→waiting→activate
  lifecycle deterministically in the black-box harness, with no second build
  (the gate builds the app once) and no test-only file shipped in production.
  *Alternatives rejected:* building and serving a second app revision in the
  gate (heavy, and the gate owns a single build); fabricating
  `registration.waiting` (not possible from page script).
- **Design delta: add an install/update-on-next-launch bullet to DIRECTION
  §3.7.** *Rationale:* the task's central deliverable ("the update taken on the
  next launch") had no normative anchor — the lifecycle lived only in a
  `vite.config.js` comment, `main.jsx`, and `storage/worker.md`/`migrations.md`
  (whose Decision 4 flagged the gap). The delta states the already-configured
  behaviour as constitution so the acceptance criteria pin to it; it changes no
  behaviour (the config already sets `skipWaiting: false`) and rides this task's
  closer commit. *Alternative rejected:* leave it implicit in code comments and
  park it — leaves the acceptance criteria pinning to a comment and perpetuates
  the undocumented lifecycle the WBS has already flagged twice.

## Open questions

(none — all decided.)

Two product/design judgment calls are surfaced for `tasks/parking-lot.md`
(human/design review), **not** encoded as WBS tasks: the final icon artwork
(this task ships functional, visual-language-derived icons; brand-grade artwork
is a design call), and the exact copy and placement of the update notice within
the shell (there is no workflow or mockup board for an update affordance; this
task renders a defensible non-modal status, which a future design pass may
refine).

## Status

**Done** — 2026-10-06.

- `app/public/`: icon assets authored and committed — `icon.svg`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon-180.png` (visual-language accent on background, reads on light and dark OS surfaces).
- `app/src/pwa/manifest.js`: pure manifest module extracted from `vite.config.js`; `app/src/pwa/manifest.test.js` (7 tests) pins name, ids, `display`, colours, and the icons array.
- `app/src/pwa/update-state.js`: main-thread update store (`onNeedRefresh` / `dismiss` / `reload`); `app/src/pwa/update-state.test.js` (6 tests) pins held-until-next-launch and no-skipWaiting invariants.
- `app/src/pwa/UpdateReady.jsx` + `update-ready.css`: dismissible non-modal status notice built with React Aria; `app/src/pwa/UpdateReady.behavior.test.jsx` (4 tests, axe clean).
- `app/index.html`: added `<link rel="manifest">`, `<link rel="icon">`, `<link rel="apple-touch-icon">`, `theme-color` meta unchanged.
- `app/vite.config.js`: manifest block now imports from `manifest.js`; icons array wired.
- `app/src/main.jsx` + `app/src/main.test.jsx`: `registerSW` wired with `onNeedRefresh` feeding the update store.
- `app/src/App.jsx`: `<UpdateReady>` rendered in the shell.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`: `update.reload` → "Reload now" / `update.dismiss` → "Dismiss" (repurposed the unused legacy `update` block).
- `docs/DIRECTION.md` §3.7: install/update-on-next-launch bullet added (normative anchor for the lifecycle).
- `service/internal/server/app.go` + `app_test.go` (deviation from "nothing in service/"): Go handler returned `application/octet-stream` for `.png`, failing the e2e icon-content-type criterion; added `.png` → `image/png` with `TestIconContentType`.
