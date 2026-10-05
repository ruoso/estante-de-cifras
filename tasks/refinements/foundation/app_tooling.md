# foundation.app_tooling — App tooling

## TaskJuggler entry

`task app_tooling` in [`tasks/25-foundation.tji`](../../25-foundation.tji)
(lines 16–21), under `task foundation`. Its one line there: *"Vite, React 19
with the React Compiler, React Aria Components, the PWA plugin, Vitest +
Testing Library with an axe matcher for the behavior level (Playwright
belongs to foundation.e2e_web). DIRECTION §3.7. Tests: unit (a first Vitest
test, so the gate runs app/'s `test`); behavior (one component rendered with
Testing Library and checked with axe at WCAG 2.1 AA, proving the set-up every
UI task uses)."* The area header states the stream's purpose: *"The monorepo,
its tooling, the API contract, running everything locally as in production,
CI, and the two end-to-end harnesses every later task's e2e tests are written
in."* ([`tasks/25-foundation.tji`](../../25-foundation.tji) lines 1–5).

## Effort estimate

**2 days** (from the `.tji`).

## Repository

**estante-de-cifras** (`/home/ruoso/devel/estante-de-cifras`), the `app/`
directory only. This task turns the reserved, README-only `app/` slot (from
[`foundation.monorepo`](monorepo.md)) into a real npm package: its manifest,
its Vite + React + PWA build, its Vitest + Testing Library + axe test
set-up, its ESLint config, an entry point, and the first unit test and first
behavior test that prove the chain end to end. No other directory is
touched, and no cifra.md work lands (the note does not start with
`cifra.md:`). No design delta is authored: DIRECTION §3.7 names the toolchain
this task installs, and installing it amends no designed behaviour and opens
no new seam.

## Inherited dependencies

- **`foundation.monorepo` — settled.** Complete (`complete 100`,
  [`tasks/25-foundation.tji`](../../25-foundation.tji) lines 10–15; refinement
  [`monorepo.md`](monorepo.md)). It reserved `app/` with a placeholder
  [`app/README.md`](../../../app/README.md) naming this task as the one that
  *"the tooling and first scaffolding land in"*, and left
  [`scripts/gate`](../../../scripts/gate) skipping the app on *"estante app:
  app/package.json does not exist yet"* (gate line 295). Creating
  `app/package.json` here is what flips that branch from SKIP to a real run.
- **`bootstrap.architecture` / `bootstrap.direction` — settled** (via
  `foundation` → `bootstrap.architecture`,
  [`tasks/25-foundation.tji`](../../25-foundation.tji) line 8): the source of
  DIRECTION §3.6–3.7, the component boundaries and the toolchain decision
  this task realises.

`app_tooling` is the root of the app side of the stream:
[`foundation.music_core_import`](../../25-foundation.tji) (line 25) and
`foundation.compose` (line 43) carry `depends !app_tooling`, and every later
UI task (the `shell`, `songs`, `books`, `account` streams) builds on the
React + React Aria + Testing Library + axe set-up this task proves.

## What this task is

This task scaffolds the app as a Vite + React 19 single-page PWA and lands
the test set-up every later UI task reuses. Concretely it adds, under
`app/`: `package.json` with `dev`/`build`/`preview`/`test`/`lint` scripts and
the dependency set (React 19 and React DOM, React Aria Components, and the
dev toolchain); `vite.config.js` wiring `@vitejs/plugin-react` with the React
Compiler as a Babel plugin and `vite-plugin-pwa`; a Vitest config running in
jsdom with a setup file that registers `@testing-library/jest-dom` and an axe
matcher; `eslint.config.js` (flat, with the React Hooks / Compiler rule and
`jsx-a11y`); an entry (`index.html`, `src/main.jsx`, a minimal accessible
`src/App.jsx`); a small shared accessibility helper that pins the axe run to
WCAG 2.1 AA; and the two tests the note names — a unit test over the helper
and a behavior test that renders a React Aria component with Testing Library
and asserts it is axe-clean. It installs **no Playwright** (that is
[`foundation.e2e_web`](../../25-foundation.tji) line 58) and brings over **no
feature code**: the music core is [`foundation.music_core_import`](../../25-foundation.tji),
and real screens, styles and translated copy are the feature streams.

## Why it needs to be done

Every screen the app will ever render — the search that is the primary
interface (DIRECTION §4), the song view, the setlist editor, the sharing and
sign-in dialogs — is a React component built with React Aria and held to axe
at WCAG 2.1 AA (the standing accessibility rule). That is only possible once
the build compiles JSX with the React Compiler, the PWA plugin produces an
installable, offline-cached shell (DIRECTION §3.7, "installed and cached up
front"), and the test harness can render a component with its real
collaborators and fail on an accessibility violation. This task is where that
chain is assembled and proven once, so every UI task after it writes a
component and its behavior test against a set-up that already works rather
than re-deriving it. It also flips the gate's `app/` checks (lint, test,
build) from SKIP to live, making `scripts/gate` meaningful for the app from
here on.

## Inputs / context

- **DIRECTION §3.7 The app** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 381–413: *"React,
  with React Aria Components, chosen for the richest accessible experience"*;
  *"installed and cached up front, so its weight is not a constraint"*; the
  Web-Worker-owns-the-data and store-via-`useSyncExternalStore` architecture
  (lines 394–401) that this task's view layer will later feed; *"Framework-
  free below the view. … the view is the only layer that"* knows React (lines
  402–404); and the carry-over list (lines 411–413): *"Vite, the PWA plugin,
  Vitest with Testing Library, Playwright, axe at WCAG 2.1 AA, and the i18n
  set-up with its four languages."* The React Compiler is implied by *"The
  React Compiler keeps re-rendering to what changed"* (line 400).
- **DIRECTION §3.6 components and boundary** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 266–278: the app is
  *"JavaScript, React, a PWA … this repository, `app/`"*, and *"The app and
  the service share no code, only the HTTP API and the format."* Line 377:
  *"its dev server proxies the API to the service, so it is one origin
  there too."*
- **The `.tji` note and Tests clause** —
  [`tasks/25-foundation.tji`](../../25-foundation.tji) line 20: the toolchain
  list, the explicit exclusion *"(Playwright belongs to
  foundation.e2e_web)"*, and the two test levels this task lands with.
- **Explore Chords, the carry-over source** —
  [`explore-chords/package.json`](file:///home/ruoso/devel/explore-chords/package.json)
  and [`explore-chords/vite.config.js`](file:///home/ruoso/devel/explore-chords/vite.config.js):
  Vite 8, `vite-plugin-pwa` 1.3 (`registerType: 'prompt'`, `skipWaiting:
  false`, precache-everything, `navigateFallback` to the app shell), Vitest 5
  with an inline `test` block (`environment: 'node'`, no setup file), ESLint
  10 flat config, `axe-core` 4.13, a bespoke no-library i18n with four
  locales (en, pt-BR, es-419, it), and `.node-version` pinned to Node
  24.20.0.
  **Explore Chords is vanilla JavaScript — it has no React, no React Aria, no
  Testing Library, and no Vitest axe matcher**: those parts are *new* in this
  task. Its `@axe-core/playwright` and `@playwright/test` are its e2e level,
  which here belongs to [`foundation.e2e_web`](../../25-foundation.tji), not
  this task.
- **cifra.md for JavaScript, the sibling JS package** —
  [`cifra.md/js/package.json`](file:///home/ruoso/devel/cifra.md/js/package.json):
  plain JavaScript (`"type": "module"`, `src/index.js`), Vitest, no
  TypeScript, no build step. The format package the app depends on is plain
  JS, as is the music core that carries over — context for the
  language/toolchain decision below.
- **`scripts/gate`, the app branch** —
  [`scripts/gate`](../../../scripts/gate) lines 118–165, 292–296:
  `npm_checks "estante app"` runs `lint`, then `test`, then `build`, each
  only when its `package.json` script exists; `test` is additionally skipped
  until `has_js_tests` finds a `*.test.*`/`*.spec.*`/`__tests__` file; all run
  with `CI=true`. The first unit test is what makes the `test` branch live.
- **The visual language** —
  [`docs/mockups/theme.css`](../../../docs/mockups/theme.css) lines 1–47
  (the `.est theme-current` token model React Aria Components are styled
  through — *"Its components carry no look of their own"*, DIRECTION §3.7
  line 391–392) and
  [`docs/mockups/README.md`](../../../docs/mockups/README.md) lines 22–27
  (*"Every status badge carries a word, never colour alone"*).
- **Style precedent** — [`foundation/monorepo.md`](monorepo.md), the sibling
  scaffold refinement in this area, and
  [`cifra_js/package.md`](../cifra_js/package.md), the nearest JS-package
  scaffold.

## Constraints / requirements

- **The toolchain is exactly the note's.** Vite; React 19 with the React
  Compiler; React Aria Components; the PWA plugin (`vite-plugin-pwa`); Vitest
  with Testing Library and an axe matcher for the behavior level. **No
  Playwright** and no Playwright-axe in `app/` — the e2e-web level and its
  Playwright live in `e2e/web/` ([`foundation.e2e_web`](../../25-foundation.tji)),
  against the compose stack, not inside the app package.
- **The view is the only layer that knows React.** The package is structured
  so React lives in the view (`src/`, components and the entry); the music
  core and cifra.md for JavaScript, which land later, stay framework-free
  (DIRECTION §3.7 lines 402–404). This task writes only view-layer code, so
  it must not introduce a React dependency anywhere a pure module would
  import.
- **The app and the service share no code** (DIRECTION §3.6 line 275): the
  app package depends only on the format and, at runtime, the HTTP API; it
  pulls in nothing from `service/`. Enforced here structurally — the package
  manifest reaches into no sibling directory.
- **Accessibility is the default, from the first component** (standing rule;
  DIRECTION §3.7). React Aria Components for every interactive part; the
  ESLint config carries `jsx-a11y`; the behavior level runs axe at WCAG 2.1
  AA and fails on any violation. The axe run is pinned to the 2.1 AA tag set
  (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) through one shared helper so
  the behavior level and the later e2e-web level agree on what "AA" means.
  Status is carried by a word, never colour alone
  ([`docs/mockups/README.md`](../../../docs/mockups/README.md) line 27).
- **Offline first begins here, at the shell** (standing rule; DIRECTION §3.7
  "installed and cached up front"): the PWA plugin precaches the built shell
  so a loaded app works with no network, and an update prompts before
  replacing a running one (`skipWaiting: false`). The data layer that makes
  *the user's actions* offline-first (the Worker owning git and IndexedDB) is
  a later task; this task sets up only the installable, cached shell.
- **The gate stays green and now runs the app.** After this lands,
  [`scripts/gate`](../../../scripts/gate) over estante-de-cifras passes: `tj3`
  silent, `scripts/unblocked.py` clean, and `estante app` running `lint`,
  `test` (the new tests, not skipped) and `build` green under `CI=true`.
  Parallelism stays bounded — no toolchain step this task adds runs an
  unbounded `-j` (the gate's own rule, lines 55–57; and the user's standing
  machine rule).
- **No song text, no copyrighted words.** The proof component and its tests
  use purpose-written placeholder text only (there is no song here at all),
  never someone else's lyrics (standing rule). The remaining standing rules —
  canonical form over preserving content, no book without an account — govern
  behaviour this task delivers none of.

## Acceptance criteria

**Behaviour delivered.** `app/` is a working Vite + React 19 PWA package
committed in estante-de-cifras:

- `npm run build` in `app/` produces an installable PWA (a precached shell
  via `vite-plugin-pwa`, a web-app manifest named "Estante de Cifras");
  `npm run dev` serves it. The React Compiler is active in the build
  (`@vitejs/plugin-react` with `babel-plugin-react-compiler` targeting React
  19), so components are compiled without hand-written memoization.
- `npm run lint` runs ESLint (flat config) with the React Hooks / React
  Compiler rule and `jsx-a11y` and is clean.
- A React Aria Components dependency is installed and used by the proof
  component; the entry (`src/main.jsx` mounting `src/App.jsx` into
  `index.html`) renders an accessible placeholder under the `est
  theme-current` root, with its only status word carried as text, not colour.
- `app/` imports nothing from `service/`, and no React import appears outside
  the view layer.

**Tests the task lands with, by level.** The note names **unit** and
**behavior**; both land here, named, and the gate runs them (not skipped):

- **unit — `app/src/a11y/axe.test.js`** (Vitest): pins that the shared axe
  helper requests exactly the WCAG 2.1 AA tag set (`wcag2a`, `wcag2aa`,
  `wcag21a`, `wcag21aa`) that the standing accessibility rule and DIRECTION
  §3.7 (line 413, "axe at WCAG 2.1 AA") require — a pure module, so the first
  Vitest test, which flips the gate's `estante app: npm run test` branch from
  *"no test files yet"* (gate line 159) to a live run.
- **behavior — `app/src/App.test.jsx`** (Vitest + jsdom + Testing Library +
  the axe matcher): renders the proof component (a React Aria Components
  element under the `est theme-current` root), asserts through
  `@testing-library/jest-dom` that its accessible name and role are present
  (proving React 19, the Compiler, React Aria and Testing Library all work
  together), and asserts the rendered tree is **axe-clean at WCAG 2.1 AA** via
  the shared helper — the set-up every later UI task reuses (DIRECTION §3.7;
  standing accessibility rule). *Scope note:* axe's layout-dependent rules
  (notably `color-contrast`) do not run under jsdom, which has no layout;
  colour-contrast and other visual rules are verified in a real browser at
  the **e2e-web** level ([`foundation.e2e_web`](../../25-foundation.tji)),
  where every screen a test visits is axe-checked. The behavior level pins
  the role/name/label/structure rules that do run in jsdom — the right
  division of labour, not a weakened check.

No **e2e-api** or **e2e-web** level applies: this task adds no endpoint and no
screen a user journeys through, and Playwright is explicitly out of scope per
the note. The e2e-web harness and the first real-browser axe pass land in
[`foundation.e2e_web`](../../25-foundation.tji).

**Deferred work.** None registered as a new WBS leaf. Three scope boundaries
are drawn rather than deferred, because existing streams already own them:

- The music core carry-over (`src/core`, `src/render`, with history) is
  [`foundation.music_core_import`](../../25-foundation.tji) (line 22), which
  already `depends !app_tooling`.
- The i18n message catalogue with its four languages, and the real visual
  language brought into the app as styles on real screens, land with the
  first screens that render translated copy — the **shell** stream
  ([`tasks/50-shell.tji`](../../50-shell.tji)). The note does not list i18n
  for this task; React Aria's locale-aware formatting is available through
  `react-aria-components` regardless, so nothing blocks on it here. (Surfaced
  to the orchestrator for confirmation that the shell stream carries it; not
  encoded as a new leaf, to avoid an orphan.)
- The Worker-owned, git-backed offline-first data layer is the **storage**
  and **sync** streams; this task sets up only the cached shell.

## Decisions

- **Plain JavaScript with JSX, not TypeScript.** *Rationale:* the carried-over
  music core arrives as `.js` with its history via `git filter-repo`
  ([`foundation.music_core_import`](../../25-foundation.tji)), cifra.md for
  JavaScript is plain JS
  ([`cifra.md/js/package.json`](file:///home/ruoso/devel/cifra.md/js/package.json)),
  and Explore Chords is plain JS; neither the note nor DIRECTION §3.7 names
  TypeScript. Keeping the app plain JS/JSX means the imported core needs no
  `allowJs` bridge and no second toolchain. *Alternative rejected:*
  TypeScript (with `allowJs` for the core) — it adds a typecheck step and a
  build seam DIRECTION does not call for and introduces friction at exactly
  the import boundary `music_core_import` crosses; React Aria's types are a
  nicety, not worth a new toolchain here.
- **The React Compiler runs as a Babel plugin through
  `@vitejs/plugin-react`.** *Rationale:* `babel-plugin-react-compiler`
  (targeting React 19) is the compiler's supported entry point and composes
  with the standard React Vite plugin; ESLint's `react-hooks` rule set (v5+)
  carries the compiler's lint rule, so violations surface in `npm run lint`.
  *Alternative rejected:* `@vitejs/plugin-react-swc` — faster, but the
  compiler's SWC path is less mature than the Babel one; build speed is not a
  constraint for a precached PWA (DIRECTION §3.7 line 384–385).
- **The axe matcher is a Vitest-native one (`vitest-axe`, over `axe-core`),
  behind one shared helper pinned to WCAG 2.1 AA.** *Rationale:* the behavior
  level runs in jsdom under Vitest, so the matcher must integrate with
  Vitest's `expect`; wrapping the run in `src/a11y/axe.js` with the explicit
  2.1 AA tag set gives the unit test something pure to pin and guarantees the
  behavior level and the later e2e-web level ask axe for the same conformance
  level. *Alternative rejected:* `jest-axe` — it works via `expect.extend` but
  is typed and documented for Jest; the Vitest-native matcher is the smaller
  surface. Explore Chords' `@axe-core/playwright` is the e2e tool and does not
  apply to the jsdom behavior level.
- **Vitest runs in jsdom by default, with a setup file.** *Rationale:* the
  level this set-up exists to prove is component rendering, which needs a DOM;
  a default `environment: 'jsdom'` plus a setup file registering
  `@testing-library/jest-dom` and the axe matcher means every later
  component test gets the right environment with no per-file ceremony, and
  pure modules run fine in jsdom too. This differs from Explore Chords'
  `environment: 'node'` because Explore Chords tested only pure modules.
  *Alternative rejected:* `node` default with per-file `// @vitest-environment
  jsdom` — avoidable friction on the common case (components).
- **The PWA plugin is configured for a root-origin install, carried from
  Explore Chords' shape.** *Rationale:* `registerType: 'prompt'` and
  `skipWaiting: false` keep the Explore Chords behaviour that an update asks
  before replacing a running app (DIRECTION §3.7, and the standing offline
  rule that nothing the user does is lost); `base` is the root `/` (the
  service serves the app on one origin, DIRECTION §3.6 line 373–377), not
  Explore Chords' `/explore-chords/` project subpath; the shell is precached
  with an `index.html` navigate-fallback so a deep link works offline.
  *Alternative rejected:* deferring all PWA config to a later task — the note
  lists the PWA plugin here, and an installable cached shell is the
  foundation offline-first builds on.
- **A minimal Vite dev-server API proxy is configured now, exercised later.**
  *Rationale:* DIRECTION §3.6 line 377 wants the dev server to proxy the API
  so development is one origin too; configuring the `server.proxy` entry here
  (reading the service origin from an env var, with a localhost default) means
  the first API-calling task inherits the one-origin dev experience rather
  than re-adding build config. It proxies to nothing until
  `foundation.service_skeleton`/`foundation.compose` exist, which is
  harmless. *Alternative rejected:* adding the proxy only when the first API
  call lands — it scatters build-config changes across feature tasks.
- **No design delta.** *Rationale:* DIRECTION §3.7 names this exact toolchain;
  installing it changes no designed behaviour and opens no new architectural
  seam, so there is nothing to amend in DIRECTION or a workflow.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `app/package.json`, `app/package-lock.json`: npm manifest with `dev`/`build`/`preview`/`test`/`lint` scripts; React 19, React DOM, React Aria Components as runtime deps; Vite 8, Vitest 5, Testing Library, vitest-axe, ESLint 10 flat config (react-hooks/compiler, jsx-a11y, eslint-plugin-react) as dev deps.
- `app/vite.config.js`: `@vitejs/plugin-react` with `babel-plugin-react-compiler` targeting React 19; `vite-plugin-pwa` precaching the shell (`registerType: 'prompt'`, `skipWaiting: false`, navigate-fallback to `index.html`); service API proxy from `VITE_API_ORIGIN` (localhost default); Vitest with jsdom environment and setup file.
- `app/eslint.config.js`: flat config wiring `eslint-plugin-react-hooks` (compiler rule), `eslint-plugin-jsx-a11y`, `eslint-plugin-react` (`jsx-uses-vars`) — lint is clean.
- `app/index.html`: PWA entry with `<div id="root">` and `<script type="module" src="/src/main.jsx">`.
- `app/src/main.jsx`: `ReactDOM.createRoot` mounting `<App />` in `<StrictMode>`.
- `app/src/App.jsx`: minimal accessible placeholder under `.est.theme-current` using a React Aria `Button`; status word carried as text, not colour.
- `app/src/a11y/axe.js`: shared helper pinning axe to WCAG 2.1 AA tag set (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).
- `app/src/test/setup.js`: Vitest setup file registering `@testing-library/jest-dom` and `vitest-axe` matchers.
- `app/src/a11y/axe.test.js` (unit): Vitest — pins that the shared helper requests exactly the WCAG 2.1 AA tag set (2 tests passed).
- `app/src/App.test.jsx` (behavior): Vitest + jsdom + Testing Library + axe — renders the React Aria `Button` under `est theme-current`, asserts role/name, asserts axe-clean at WCAG 2.1 AA (3 tests passed).
- Gate flipped: `estante app` lint/test/build all run live (not SKIPped); 5/5 tests pass; `build` emits precached `sw.js` + `manifest.webmanifest` named "Estante de Cifras".
