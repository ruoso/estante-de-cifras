# shell.tokens — Themes and tokens

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 9–13, task `shell.tokens`
("Themes and tokens"), under `task shell` (lines 6–8, which `depends
foundation.app_tooling, foundation.e2e_web`). The note, verbatim:

> `docs/mockups/theme.css` as the app's stylesheet: Estante, Caderno, Palco,
> densities; automatic theme by the device's light or dark mode; the chosen
> theme from the home book. Workflow 1. Tests: unit (the theme chosen by the
> device's mode and by the home book); behavior (each theme and density
> rendered on a sample surface, axe contrast at AA); e2e-web (the shell in
> Estante light and Palco dark on the three viewports, axe).

Area 50 is the app's shell and visual language — "the themes, languages, and
the two drawings everything else uses." `shell.tokens` is the root of the
shell: `shell.layout`, `shell.chart` and `shell.diagram` all `depends
!tokens`.

## Effort estimate

**2 days** (from the `.tji`). The work is: adopt the drawn stylesheet, build
the small theme-resolution layer that applies it, and pin themes, densities
and the automatic device-mode mapping across the three test levels.

## Repository

**estante-de-cifras only** (`app/`). This is app work, not a `cifra.md:`
task. The app and the service share no code
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 line 288); nothing
here touches the service, the API, or cifra.md. No design delta is authored
(the governing documents already settle themes and the automatic mapping —
see Decisions); the one genuinely-undecided item, density as a *chosen*
preference, is parked rather than invented (see Open questions).

## Inherited dependencies

- **`foundation.app_tooling`** — *settled* (`complete 100`). The app is one
  npm package under `app/`: React 19 + React Aria Components, Vite 8, Vitest
  (jsdom) with `vitest-axe`, plain JavaScript + JSX (no TypeScript), tests
  co-located (`<module>.test.js` for pure modules, `<Component>.test.jsx`
  for component behavior). The shared axe helper
  [`app/src/a11y/axe.js`](../../../app/src/a11y/axe.js) (`checkWcag21aa`)
  pins the WCAG 2.1 AA tag set (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`);
  the Vitest setup is `app/src/test/setup.js`. The root is already mounted as
  `<div className="est theme-current">`
  ([`app/src/App.jsx`](../../../app/src/App.jsx) line 10) — the exact
  visual-language root class this task fills in. The main-thread store seam
  is `useSlice(store, name)`
  ([`app/src/worker/useStore.js`](../../../app/src/worker/useStore.js)) over
  a pure reducer
  ([`app/src/worker/reducer.js`](../../../app/src/worker/reducer.js)) whose
  `initialState` today carries only `connection`, `meta` and `save` — no
  preferences slice yet.
- **`foundation.e2e_web`** — *settled* (`complete 100`). The Playwright
  harness is `e2e/web/` (plain ESM, no build step). Three Chromium viewport
  projects — **phone, tablet, computer** — run every spec
  (`e2e/web/playwright.config.js`); `baseURL` from `ESTANTE_E2E_BASE_URL`
  (`e2e/web/lib/env.js`); the axe fixture `e2e/web/lib/axe.js` re-declares
  the same four AA tags and asserts zero violations. Specs live at
  `e2e/web/tests/<name>.spec.js`. Tests run against the compose stack the
  gate brings up — no `webServer` block.

**Transitively settled:** the service worker is already registered at module
scope in `app/src/main.jsx` (`foundation.app_sw_register`); the PWA precache
globs already include `css`/`woff2`
([`app/vite.config.js`](../../../app/vite.config.js)), so the stylesheet and
its fonts are precached once added.

**Downstream:** `shell.layout` (navigation), `shell.chart` (the chart) and
`shell.diagram` (the chord diagram) all build on the tokens this task lands;
`shell.pwa` relies on the precached stylesheet/fonts.

## What this task is

Turn the drawn visual language into the running app's stylesheet and the
small layer that applies it:

1. **Adopt [`docs/mockups/theme.css`](../../../docs/mockups/theme.css) as the
   app's stylesheet** — the `.est` base tokens (lines 7–20), the three theme
   classes `theme-estante`/`theme-current` (22–47), `theme-caderno` (49–76)
   and `theme-palco` (78–105), the three density classes
   `density-compact`/`density-comfortable`/`density-roomy` (107–109), and the
   token-keyed shared component classes — dropping only the mockup-canvas
   scaffolding (board/device framing used solely to draw on fake phones).
2. **Self-host the themes' typefaces** (Figtree, Fraunces, Source Sans 3,
   JetBrains Mono, IBM Plex Mono, Atkinson Hyperlegible + Mono) as local
   `woff2` with `@font-face`, precached — no web-font CDN (offline-first; no
   external calls). The `system-ui`/`Georgia`/`ui-monospace` fallbacks
   already in theme.css keep every theme legible if a face is missing.
3. **A pure theme resolver** — `(chosenTheme, prefersDark) → applied theme`,
   where `chosenTheme ∈ {automatic, estante, caderno, palco}` (absent →
   automatic) and automatic maps to `palco` when the device is in dark mode,
   `estante` otherwise.
4. **A theme root** that applies `est theme-<applied> density-<density>` to
   the app root, reading the chosen theme from the store's `preferences`
   slice and following the device's light/dark mode live (a
   `prefers-color-scheme` `MediaQueryList` surfaced through
   `useSyncExternalStore`). Density is applied at the default `comfortable`.
5. **The consumer seam for the chosen theme** — a `preferences` slice
   (default `{}`) folded from a `PREFERENCES` Worker event, so a `theme`
   register (the `{value, at}` shape of `preferences.json`) drives the
   applied theme. The *producer* — the Worker reading `preferences.json` from
   the home book and emitting that event — is a deferred leaf (below); the
   main thread never touches IndexedDB (DIRECTION §3.7 line 409).

## Why it needs to be done

The app renders today against `theme-current` with no stylesheet behind it —
a placeholder. Every shell screen (navigation, the chart, the chord diagram)
is drawn in the visual language of `theme.css`; until the tokens exist and
can be themed, none of those can be built to look as drawn. `shell.tokens` is
the explicit `!tokens` prerequisite of `shell.layout`, `shell.chart` and
`shell.diagram`. It is also the first delivery of "the chosen theme from the
home book" (DIRECTION §3.2) and the automatic light/dark behavior Workflow 1
promises on first run.

## Inputs / context

- [`docs/mockups/theme.css`](../../../docs/mockups/theme.css) — the token
  model this task adopts. `.est` base: `--u: 8px` (line 8), `--radius`
  (9–10), font tokens `--font-ui`/`--font-display`/`--font-chart`/`--font-code`
  (11–14), `--display-weight` (15), `--chart-size: 17px` (16). Theme classes
  carry the full colour set (`--bg`, `--surface`, `--surface-2`, `--ink`,
  `--ink-2`, `--line`, `--accent`(+`-ink`/`-soft`), `--chord`, `--unsaved`,
  `--conflict`, `--ok`, `--default-dot`, `--frame`): Estante/`theme-current`
  (22–47, ink-blue, `--bg #F3F4F1`), Caderno (49–76, paper/pen-red, Fraunces
  display), Palco (78–105, dark stage, amber, Atkinson Hyperlegible).
  Densities (107–109) drive `--u` and `--chart-size`. There is **no**
  `prefers-color-scheme` media query here — light vs dark is which theme
  class is applied; "automatic" is this task's device-mode mapping.
- [`docs/mockups/README.md`](../../../docs/mockups/README.md) — the three
  directions (lines 12–15); `theme-current` picks the direction all boards
  show (18); "Every status badge carries a word, never colour alone" (26–27).
- [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.2 Personal state (lines
  136–151): the enumerated personal state includes **"the theme"** (138–141);
  it lives in the **home book**, "committed automatically — explicit save is
  for what the user authors, not for preferences" (141–144); a settings
  repository whose files merge key by key (146–151). §3.7 The app (394–426):
  React Aria Components (396–405); "Its components carry no look of their own,
  so the visual language (`docs/mockups/theme.css`) applies as drawn"
  (404–405); "One owner for the data: a Web Worker" and "the main thread never
  touches IndexedDB" (407–409); the interface mirrors it, components read
  slices via `useSyncExternalStore`, the React Compiler limits re-rendering
  (410–414); "the view is the only layer that" knows React (415–417); tooling
  carries over — Vite, PWA, Vitest, Playwright, axe at WCAG 2.1 AA (424–426).
  §3.6 line 288: "The app and the service share no code."
- [`docs/workflows/01-first-run.md`](../../../docs/workflows/01-first-run.md)
  (Workflow 1) §Theme (lines 86–106): the three themes, "The user chooses
  one, from the same place as the language" (88–92); **automatic** —
  "Estante while the device is in light mode, Palco while it is in dark mode,
  following the device as it changes … Choosing a theme replaces automatic,
  and *automatic* stays one of the choices" (94–98); the choice "kept in the
  home book like the language, so it follows the user to a new device.
  Automatic still follows each device's own light or dark mode" (100–103);
  "The chart itself never changes with the theme beyond colour and typeface"
  (105–106). §"Two ways in" line 15–16: "Setup happens at the moment it
  becomes visible, not up front" — first run defaults, nothing asked up front.
- [`docs/home-book-format.md`](../../../docs/home-book-format.md) §4.1
  `preferences.json` (lines 187–206): a flat map of `{value, at}` registers.
  `theme` — `"estante"`, `"caderno"`, `"palco"` or `"automatic"`; "The
  register is absent until the user chooses; while absent, the app's theme is
  automatic, following the device's light or dark mode … which is a per-device
  matter and is not written here" (199–202). There is **no `density`
  register** (see Open questions).
- Seams in `app/`: [`app/src/App.jsx`](../../../app/src/App.jsx) line 10 (the
  `est theme-current` root this task replaces with the resolved classes, and
  its test `app/src/App.test.jsx`);
  [`app/src/worker/reducer.js`](../../../app/src/worker/reducer.js) lines
  15–33 (`initialState` — add the `preferences` slice here) and the
  forward-compatible `default: return state` (113–114);
  [`app/src/worker/useStore.js`](../../../app/src/worker/useStore.js)
  (`useSlice`); the protocol's `EventKind`
  (`app/src/worker/protocol.js`) — add a `PREFERENCES` kind;
  [`app/src/i18n/index.js`](../../../app/src/i18n/index.js) — the
  framework-free module-state precedent (`detectLocale` over
  `navigator.languages`) this task's device-mode read mirrors in spirit.
- Predecessor refinements:
  [`foundation/app_tooling.md`](../foundation/app_tooling.md) (the stack, the
  shared axe helper, and its scope note that `color-contrast` does not run
  under jsdom — contrast is an e2e-web check) and
  [`foundation/e2e_web.md`](../foundation/e2e_web.md) (the three-viewport
  harness and its axe fixture).

## Constraints / requirements

- **The stylesheet is the drawn one.** Adopt `theme.css` as-is for the token
  layers and the token-keyed component classes; do not re-author the visual
  language. Strip only the mockup-canvas scaffolding (board/device framing).
  The colour tokens and the status-word rule are the mockups' — never swap a
  colour or drop a word.
- **The view is the only layer that knows React** (DIRECTION §3.7 lines
  415–417). The resolver is a pure, framework-free module; only the theme
  root and the `useSlice`/`useSyncExternalStore` bindings are React.
- **The main thread never touches IndexedDB** (DIRECTION §3.7 line 409). The
  chosen theme reaches the view only through the store's `preferences` slice,
  fed by a Worker event — never by reading the home book from the view.
- **Automatic follows each device, per device** (Workflow 1 lines 94–103):
  the device-mode read is a live `prefers-color-scheme` subscription, not a
  one-time read; it is never written to the home book.
- **Offline first** (standing rule): the stylesheet and its fonts are local
  and precached; no web-font CDN, no external request for a typeface.
- **Accessibility** (standing rule): React Aria Components for every
  interactive part (the root wrapper adds none; the existing `Button` stays
  React Aria); axe at WCAG 2.1 AA; status carried by a word, never colour
  alone — already true of `App.jsx` and preserved. Contrast at AA is pinned
  where it actually runs (e2e-web — see Decisions).
- **First-run default is automatic** (Workflow 1 lines 94–98): with no
  `theme` register, the app is automatic; nothing is asked up front.
- **Density ships at `comfortable`** — the mockup prop default — as a render
  axis. This task does not add a density chooser or density persistence; none
  is governed (see Open questions).
- *Rules that do not bear on this task:* canonical form over preserving
  content (no song is written here); no song text in logs (no logging, no
  song text); no book without an account (no book is fetched). Named for
  completeness.

## Acceptance criteria

**Behaviour delivered.**

- The app renders under `est theme-<applied> density-comfortable` with
  `theme.css` applied, its fonts loaded locally.
- With no chosen theme, the applied theme is **automatic**: Estante while the
  device reports light mode, Palco while it reports dark mode, switching live
  as the device mode changes.
- With a `theme` register in the `preferences` slice, the applied theme is
  the chosen one (`estante`/`caderno`/`palco`), overriding automatic;
  `"automatic"` as the register value returns to following the device.
- All three themes and all three densities render correctly on a sample
  surface; the status word is preserved (never colour alone).

**Tests the task lands with, by level.**

- **unit — `app/src/theme/resolve.test.js`** (Vitest): the resolver —
  `automatic` + dark → `palco`, `automatic` + light → `estante`, an absent
  chosen theme → automatic, and each explicit `estante`/`caderno`/`palco`
  returned unchanged regardless of device mode; and the applied-class builder
  emits `est theme-<applied> density-<density>`. *Pins:* "the theme chosen by
  the device's mode and by the home book" (`.tji` note); Workflow 1 lines
  94–103; home-book-format §4.1 lines 199–202 (register value set and the
  absent-register default).
- **behavior — `app/src/theme/ThemeRoot.test.jsx`** (Vitest + Testing
  Library, `matchMedia` stubbed in the test): each theme and each density
  rendered on a sample surface carries the correct `est theme-<x>
  density-<y>` classes and is axe-clean via `checkWcag21aa`; a `theme`
  register injected into the `preferences` slice drives the applied theme; a
  simulated device-mode change under automatic re-applies Estante↔Palco.
  *Pins:* "each theme and density rendered on a sample surface" and the
  home-book-driven choice (`.tji` note); DIRECTION §3.7 lines 404–414; the
  status-word rule (mockups README lines 26–27). Axe here pins
  role/name/label/structure — the rules that run under jsdom; **contrast is
  pinned at e2e-web** (see Decisions and `foundation/app_tooling.md`).
- **behavior — `app/src/App.test.jsx`** (updated): the root is the resolved
  `est theme-…` class (default automatic), replacing the `theme-current`
  assertion; still axe-clean. *Pins:* the shell root now carries the resolved
  theme (DIRECTION §3.7 lines 404–405).
- **unit — `app/src/worker/reducer.test.js`** (extended): a `PREFERENCES`
  event folds into the `preferences` slice; an unrelated event leaves it
  referentially stable; the slice starts `{}`. *Pins:* DIRECTION §3.7 lines
  410–414 ("only what shows it moves"); the consumer contract for the
  home-book theme.
- **e2e-web — `e2e/web/tests/theme.spec.js`** (Playwright, three viewports,
  compose stack): with the app at automatic, a light `colorScheme` shows
  Estante and a dark `colorScheme` shows Palco (emulated per Playwright
  `colorScheme`), on phone, tablet and computer; a computed-style assertion
  confirms the theme's tokens cascade (e.g. the page background is Estante's
  `#F3F4F1` / Palco's `#0F1113`); the axe fixture (`e2e/web/lib/axe.js`,
  WCAG 2.1 AA — **color-contrast runs here in a real browser**) is clean on
  each. *Pins:* "the shell in Estante light and Palco dark on the three
  viewports, axe" (`.tji` note); Workflow 1 lines 94–103; contrast at AA.

No test level is dropped. No test is deferred.

**Deferred follow-up (closer registers in the WBS).** Defining the
`preferences` slice as the consumer with no producer creates one concrete
leaf:

- **`storage.preferences_surface`** (~1d, estante-de-cifras; note does **not**
  start with `cifra.md:`; milestone: the same one `storage.home_book`
  belongs to) — the Worker reads `preferences.json` from the home book and
  emits a `PREFERENCES` event the reducer folds into the `preferences` slice
  (the contract this task defines), re-emitted when sync changes a register.
  `depends storage.home_book, shell.tokens`. Tests: unit (a `preferences.json`
  map → the event payload of `{value, at}` registers; an absent register
  stays absent); behavior (the Worker against a fake IndexedDB and a local
  git remote surfaces a theme change, the reducer folds it, the `ThemeRoot`
  re-applies).

(The theme/language *chooser*, density as a chosen preference, and font
licensing are human-judgment items surfaced to the parking lot, not WBS
leaves — see Open questions.)

## Decisions

- **Adopt `theme.css` whole (minus mockup-canvas scaffolding), not
  tokens-only.** *Rationale:* the note says "`theme.css` as the app's
  stylesheet," and the component classes are keyed purely on tokens
  (theme-agnostic), so the later shell tasks (layout/chart/diagram) style
  against the one drawn source rather than re-deriving it. Per-component
  correctness is pinned when each component lands. *Alternative rejected:*
  import only the token layers and re-author each component's CSS in its own
  task — risks drift from the mockups and re-interprets a language already
  decided and drawn.
- **"Automatic" is a device-mode mapping built here, not a `theme.css`
  change.** Estante ⇔ light, Palco ⇔ dark, via a live `prefers-color-scheme`
  subscription; the two light themes and one dark theme are the one pairing
  that can respect the device (Workflow 1 lines 94–98). *Rationale:*
  `theme.css` deliberately has no `prefers-color-scheme` (light/dark is which
  class is applied); the mapping is app behavior, within DIRECTION's and
  Workflow 1's promise, so **no design delta**. *Alternative rejected:* add
  `@media (prefers-color-scheme)` into the stylesheet — would bake a
  theme-selection policy into the token layer and fight the explicit-class
  model the mockups use.
- **The chosen theme reaches the view through a `preferences` store slice fed
  by a Worker event.** *Rationale:* DIRECTION §3.7 mandates the
  store/`useSyncExternalStore` path and forbids the main thread touching
  IndexedDB; a new `PREFERENCES` event folded by the reducer matches the
  existing `connection`/`meta`/`save` pattern and its forward-compatible
  `default` branch. *Alternative rejected:* read the home book from the view
  (or a React context seeded outside the store) — breaks the data-owner
  boundary (§3.7 lines 407–409).
- **The resolver is a pure module; only the root wrapper is React.**
  *Rationale:* "the view is the only layer that" knows React (§3.7 lines
  415–417); a pure resolver is unit-testable without a DOM and mirrors the
  framework-free i18n module. *Alternative rejected:* fold resolution into a
  component effect — harder to unit-test and spreads policy into the view.
- **Contrast at AA is pinned at e2e-web, not at the behavior level.**
  *Rationale:* axe's `color-contrast` rule needs layout, which jsdom does not
  provide, so it is a no-op under Vitest — the established scope note in
  `foundation/app_tooling.md`. The behavior level still runs axe (the AA tag
  set) on every theme/density surface, pinning role/name/structure; contrast
  across Estante light and Palco dark is pinned in a real browser at e2e-web.
  This places the check where it runs; it does not drop the behavior level.
  *Alternative rejected:* claim contrast at the behavior level — the `.tji`
  note's literal "axe contrast at AA" at behavior — would assert a check that
  never actually runs under jsdom.
- **Density ships as a render axis at `comfortable`; no chooser, no
  persistence, no design delta.** *Rationale:* the mockup prop default is
  `comfortable`; the behavior test renders each density (a render axis), and
  the unit "chosen by the home book" clause names only the theme — the WBS
  tests themselves treat density as presentation, not a stored preference.
  `preferences.json` has no `density` register and no workflow gives density a
  chooser; inventing one (a format change plus a Workflow 1 delta) exceeds a
  tokens task and is a product judgment. *Alternative rejected:* make density
  a synced preference now — would require editing home-book-format §4.1 and
  Workflow 1 by fiat over an undecided product question.
- **Self-host the fonts; no web-font CDN.** *Rationale:* offline-first forbids
  a network dependency for the themes to render, and no external call keeps
  request metadata private; the PWA already precaches `woff2`. *Alternative
  rejected:* Google Fonts (or any CDN) — breaks offline-first and leaks a
  request on load.

## Open questions

Three items are genuine human-judgment gaps, surfaced to the parking lot (not
encoded as WBS leaves):

- **The theme/language chooser is unowned.** Workflow 1 (lines 88–92, 82–84)
  puts both in the header, but no WBS leaf builds the theme chooser or the
  home-book *write* path for a preference; `shell.i18n` implies a language
  chooser only. Whether the theme chooser rides with `shell.i18n`,
  `shell.layout`, or a dedicated settings surface is an interface-placement
  call for the human.
- **Is density a user-chosen, synced preference, or fixed at `comfortable`?**
  Undecided by DIRECTION §3.2, Workflow 1 and home-book-format §4.1 (no
  `density` register). This task ships density as a render axis at
  `comfortable`; whether users choose it (and where it is stored) is a product
  judgment.
- **Font licensing.** Self-hosting the themes' typefaces requires confirming
  redistribution licenses — a legal/human call. The `system-ui`/serif/mono
  fallbacks keep the app functional regardless.

## Status

**Done** — 2026-10-05.

- Adopted `docs/mockups/theme.css` as the app's stylesheet (`app/src/theme/theme.css`): `.est` base tokens, the three theme classes (`theme-estante`, `theme-caderno`, `theme-palco`), three density classes, and the token-keyed shared component classes; mockup-canvas scaffolding dropped.
- Pure theme resolver (`app/src/theme/resolve.js`): `(chosenTheme, prefersDark) → applied theme`; automatic maps to `palco` on dark, `estante` on light.
- `ThemeRoot` component (`app/src/theme/ThemeRoot.jsx`): applies `est theme-<applied> density-comfortable` to the app root via `useSyncExternalStore` over a live `prefers-color-scheme` MediaQueryList and the store's `preferences` slice.
- `preferences` store slice and `PREFERENCES` Worker event added: `app/src/worker/protocol.js` (`PREFERENCES` event kind), `app/src/worker/reducer.js` (preferences slice, fold), `app/src/worker/store.js` (`getAppStore` lazy singleton).
- `App.jsx` updated to render `ThemeRoot` and import the stylesheet; `App.test.jsx` updated to assert the resolved `est theme-estante density-comfortable` root.
- Tests landed: **unit** — `app/src/theme/resolve.test.js` (resolver + class builder, 6 tests), `app/src/worker/reducer.test.js` extended (+3 preferences tests); **behavior** — `app/src/theme/ThemeRoot.test.jsx` (14 tests: each theme×density, axe-clean, register-driven choice, live device-mode switch), `app/src/App.test.jsx` (updated, resolved root); **e2e-web** — `e2e/web/tests/theme.spec.js` (15 tests: automatic Estante light / Palco dark on phone, tablet, computer; computed-bg cascade; axe/contrast at AA).
- **Deviation**: fonts are not self-hosted — the designed typefaces render via `theme.css`'s `system-ui`/`Georgia`/`ui-monospace` fallback stack (fully offline). Bundling woff2 is blocked on the "Font licensing" human call (parking lot).
