# shell.fonts — Self-host the designed typefaces

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 85–90, `task fonts`
("Self-host the designed typefaces") inside `task shell`.

Note: _"Commit woff2 subsets of Figtree, Fraunces, Source Sans 3, JetBrains
Mono, IBM Plex Mono and Atkinson Hyperlegible (+ Mono) with each family's
license file beside it (SIL OFL 1.1; confirm each — Atkinson Hyperlegible's
original release has its own Braille Institute license — and stop if any
forbids redistribution); @font-face in theme.css with the current system stacks
as fallbacks and font-display: swap; the PWA precache extended so the fonts work
offline. Source: tasks/parking-lot.md 2026-10-14 (Font licensing). Tests:
behavior (the theme resolves each family to its @font-face); e2e-web (fonts load
from the origin and, offline after a reload, from the precache; axe)."_

## Effort estimate

1 day (`tasks/50-shell.tji:86`).

## Repository

**estante-de-cifras** only, nothing under `cifra.md/`:

- `app/src/theme/fonts/` — new: one directory per family holding its `woff2`
  files and its license file, plus a `README.md` recording where each came from
  and under what license.
- `app/src/theme/theme.css` — the `@font-face` rules.
- `app/src/theme/fonts.behavior.test.js` — new behavior test.
- `service/internal/server/app.go` — a `font/woff2` content type (one `case`),
  with its test in `service/internal/server/app_test.go`.
- `e2e/web/tests/fonts.spec.js` — new e2e-web spec.

`app/vite.config.js` needs no change to its configuration (see Decisions). The
only edit there, if any, is its comment. No design delta.

## Inherited dependencies

Both are **settled** (`complete 100`):

- **`shell.tokens`** ([`tokens.md`](tokens.md)) adopted
  `docs/mockups/theme.css` as `app/src/theme/theme.css` and planned to
  self-host the fonts with no CDN (its §What, item 2, lines 87–91; Decision
  lines 349–353). That part shipped as a deviation: system fallbacks only,
  blocked on the licensing question (lines 383–387). This task closes the
  deviation.
- **`shell.pwa`** ([`pwa.md`](pwa.md)) set up the vite-plugin-pwa
  (workbox `generateSW`) precache with `globPatterns:
  ['**/*.{js,css,html,svg,png,woff2}']` (`app/vite.config.js:42`) and the
  offline e2e approach (`e2e/web/lib/offline.js` `runOffline`).

The e2e also uses things that already exist: the account screen's Theme picker
(`account.account_screen`, complete), reached through `chooseTheme`
(`e2e/web/lib/journeys-account.js:178`), and `startApp`
(`e2e/web/lib/journeys.js:26`).

## What this task is

The app gets the typefaces its three themes were drawn with. Seven families are
committed as `woff2` files into `app/src/theme/fonts/`, each with its license
beside it:

- Estante: Figtree, JetBrains Mono.
- Caderno: Source Sans 3, Fraunces, IBM Plex Mono.
- Palco: Atkinson Hyperlegible, Atkinson Hyperlegible Mono.

`theme.css` declares an `@font-face` for each, under the exact family name its
tokens already use, with `font-display: swap`. The existing `--font-*` stacks
stay as they are, so the system fonts remain the fallback. Vite emits the files
as hashed `assets/*.woff2`. The existing precache glob already picks those up,
so the fonts work offline once the app is installed. The service serves them as
`font/woff2`.

## Why it needs to be done

The themes are a decided part of the product (workflow 1 lines 94–117: "Caderno
(… serif titles)", "Palco (a dark stage, amber chords, a typeface …)"). Without
the faces, Caderno has no serif titles on most devices, and Palco's
legibility-for-distance typeface is missing. The fonts were planned in
`shell.tokens` and parked only on licensing (parking lot 2026-10-05, triaged on
2026-10-14 into this leaf). Later work assumes the drawn typefaces are the ones
on screen: `shell.display_preferences` (density with the chart size), and any
visual check of the chart against the mockups.

## Inputs / context

- `.tji` note above (`tasks/50-shell.tji:89`).
- `app/src/theme/theme.css:13-23` — the base `.est` font tokens (Figtree,
  JetBrains Mono). Estante repeats them at `:49-52`, Caderno is at `:77-81`
  (Source Sans 3, Fraunces with `Georgia, serif`, IBM Plex Mono), and Palco at
  `:106-109` (Atkinson Hyperlegible, Atkinson Hyperlegible Mono). The file
  header (`:1-11`) says it is the mockup stylesheet adopted verbatim.
  `docs/mockups/theme.css:11-14, 43-46, 71-75, 100-103` is the source.
- `app/src/App.jsx:2` imports the stylesheet once.
- `app/vite.config.js:36-60` — VitePWA: `globPatterns` already includes
  `woff2` (`:42`), with `navigateFallback`, `clientsClaim`, no `includeAssets`
  and no `runtimeCaching`. Workbox's default `maximumFileSizeToCacheInBytes`
  (2 MiB) applies.
- `service/internal/server/app.go:183-209` — `contentType()` has no `.woff2`
  case, so a font would be served as `application/octet-stream`.
  `cacheControl()` (`:211-222`) marks `assets/*` as immutable, which is right
  for hashed font files. `service/internal/server/app_test.go:31-60` holds the
  fixture app root (`testAsset`, `write(...)`). Tests in the same style:
  `TestCacheHeaders` (`:166`) and `TestIconContentType` (`:195`). Nothing in
  `service/` sets a CSP, so there is no `font-src` to widen.
- `e2e/web/lib/offline.js:17-44` — `waitForServiceWorker` and `runOffline`
  (go online, wait for the worker, cut the network, reload, verify, restore).
  `e2e/web/tests/pwa.spec.js:70-90` shows the pattern of fetching from inside
  the page so the request goes through the service worker.
  `e2e/web/tests/theme.spec.js:18-44` shows the `getComputedStyle` reads and
  the light/dark `emulateMedia` switch.
- `e2e/web/eslint.config.js:36-63` forbids `#dev/`, `addInitScript`,
  `route`/`routeFromHAR`, `dispatchEvent` and API writes. `page.evaluate`,
  `page.on('request'|'response')` and `page.request.get` are allowed.
- `e2e/web/playwright.config.js:39-42` — phone, tablet and computer projects,
  all Chromium.
- DIRECTION §3.7 — "installed and cached up front"; once loaded the app works
  with no network (lines 405, 424–426, 445).
- Parking lot entry (removed in commit `799f87d`), "2026-10-05 — Font licensing
  for self-hosted typefaces": OFL redistribution was the open question.

## Constraints / requirements

- **Licensing gate first.** Before committing any file, confirm each family's
  license from the file shipped with the source you take it from:
  - SIL OFL 1.1 → proceed.
  - Another license, such as Atkinson Hyperlegible's Braille Institute
    license → read it, and proceed only if it permits redistributing the font
    files with an application.
  - A license that forbids redistribution → **stop**. Commit no fonts, and
    report `BLOCKED: shell.fonts — <family> license forbids redistribution`
    so the question goes back to the parking lot.

  Record each family in `app/src/theme/fonts/README.md`: source package and
  version, license name, the copyright line, and any Reserved Font Name.
- **Files are redistributed unmodified.** Take the per-script `woff2` subsets
  as published by the Google Fonts pipeline through the Fontsource packages
  (`npm pack @fontsource-variable/<family>` / `@fontsource/<family>` into a
  scratch directory under `/tmp` — **not** `npm install`, so `app/` gains no
  dependency and the lockfile is untouched). Commit the chosen files
  byte-for-byte, with the package's license file. Do not re-subset, rename or
  re-encode them (see Decisions, Reserved Font Names). Fetching needs network.
  If the sandbox blocks it, stop and report so; there is no offline substitute.
- **Which files** — `latin` and `latin-ext` subsets, normal style only:
  - variable `wght` files for Figtree, Fraunces, Source Sans 3, JetBrains Mono
    and Atkinson Hyperlegible Mono (each covers the 400/600/700 weights the
    app uses);
  - static 400 and 600 for IBM Plex Mono;
  - static 400 and 700 for Atkinson Hyperlegible.

  Each `@font-face` carries the package's own `unicode-range` for its subset
  and a matching `font-weight` (a range like `100 900` for variable files, the
  single weight for static ones). Glyphs outside the subsets (♯ ♭ ∆ arrows)
  fall back to the system stack glyph by glyph. That is acceptable, and the
  stacks are what make it work.
- **Family names match the tokens exactly**: `"Figtree"`, `"Fraunces"`,
  `"Source Sans 3"`, `"JetBrains Mono"`, `"IBM Plex Mono"`,
  `"Atkinson Hyperlegible"`, `"Atkinson Hyperlegible Mono"`. The `--font-*`
  tokens are unchanged — the first name is the face, the rest is the fallback
  stack (note: "the current system stacks as fallbacks"). The visual language
  is not re-authored.
- **`font-display: swap`** on every rule. Add no `<link rel="preload">`: a
  preload would fetch every theme's faces on first paint, and the precache
  already holds them for later loads.
- **The `@font-face` rules go in `app/src/theme/theme.css`**, in a block after
  the header comment, with relative `url('./fonts/<family>/<file>.woff2')
  format('woff2')` so Vite fingerprints them into `assets/`. Update the header
  comment to say the font faces are the one app-only addition.
  `docs/mockups/theme.css` is not edited.
- **Offline first.** No request to any origin but the app's for a font, ever
  (no CDN). With the service worker in control, fonts come from the precache
  with the network cut (DIRECTION §3.7).
- **Service**: `contentType()` returns `font/woff2` for `.woff2`. The existing
  `assets/*` immutable policy is kept. This is app-bundle serving, not shared
  code (the app and the service share no code).
- **Accessibility**: no interactive surface changes. Axe at WCAG 2.1 AA stays
  clean in each theme with the real faces (contrast is unaffected by the face,
  but the check runs in all three).
- **Precache budget**: every committed font is well under workbox's 2 MiB
  per-file limit (Fontsource subsets are tens of KiB). The total added to the
  precache is recorded in the fonts README.

## Acceptance criteria

Behavior delivered:

1. `app/src/theme/fonts/<family>/` exists for each of the seven families, with
   its `woff2` files and the license file from its source (`LICENSE` / `OFL.txt`).
   `app/src/theme/fonts/README.md` records the source, version, license,
   copyright and Reserved Font Name per family.
2. `theme.css` declares each family's `@font-face` rules as constrained above.
3. `npm run build` emits the fonts as `dist/assets/*.woff2`, and the generated
   `sw.js` precache manifest lists them. No `vite.config.js` configuration
   change is needed for this.
4. The service serves `/assets/*.woff2` with `Content-Type: font/woff2` and
   `Cache-Control` immutable.

Tests, by level:

- **unit (Go)** — `service/internal/server/app_test.go`
  `TestFontContentType`. Add a hashed `assets/font-abc123.woff2` to the fixture
  app root; `GET` returns 200, `Content-Type: font/woff2`, and `Cache-Control`
  equal to `cacheImmutable`. Pins that a self-hosted face is served as a font
  and cached forever under its hash (`shell.fonts` Constraints, the
  `service.serve_app` content-type rule).
- **behavior** — `app/src/theme/fonts.behavior.test.js`: the theme resolves
  each family to its `@font-face` (the note's behavior clause). It reads
  `app/src/theme/theme.css` with `readFileSync` (the pattern of
  `app/src/pwa/manifest.test.js:9,18`) and parses it with the DOM's CSSOM (a
  `<style>` in jsdom; read `CSSFontFaceRule`s and the theme rules). Cases:
  - for each theme block (`.est`, `.est.theme-estante`, `.est.theme-caderno`,
    `.est.theme-palco`), every `--font-*` token's first family has at least one
    `@font-face` with that exact `font-family`, and the token still ends in its
    generic system fallback (`sans-serif` / `serif` / `monospace`);
  - every `@font-face` has `font-display: swap`, a `format('woff2')` `src` that
    resolves to an existing file under `app/src/theme/fonts/` starting with the
    `wOF2` signature, and a `unicode-range`;
  - every font directory holds a license file. Where the README records OFL,
    the file contains "SIL OPEN FONT LICENSE Version 1.1";
  - no `@font-face` `src` names a non-relative URL (no CDN).
- **e2e-web** — `e2e/web/tests/fonts.spec.js`, on phone, tablet and computer:
  - **"each theme's faces load from the origin"**: `startApp`, with the
    device in light mode (Estante). A `page.on('response')` collector records
    font responses. `page.evaluate` runs `document.fonts.load('16px "<family>"')`
    for all seven families and asserts each resolves to a non-empty list with
    `status === 'loaded'`. Every font response is same-origin, status 200,
    `content-type: font/woff2`. No request leaves the origin. Then
    `getComputedStyle` of the root reports `Figtree` first, and
    `document.fonts.check('16px "Figtree"')` is true. Axe is clean. Pins
    DIRECTION §3.7 (no external call) and the note's "fonts load from the
    origin".
  - **"Caderno and Palco render with their faces"**: `chooseTheme(page,
    'Caderno')`, then `document.fonts.ready`. The page's level-1 heading
    computes `Fraunces` first and body text `Source Sans 3` first, and both pass
    `document.fonts.check`. Axe is clean. Then `emulateMedia({ colorScheme:
    'dark' })` with `chooseTheme(page, 'Palco')`: the root computes `Atkinson
    Hyperlegible` and `document.fonts.check` passes. Axe is clean. Pins
    workflow 1 lines 94–117 (the themes' typefaces) through the real Theme
    picker.
  - **"offline after a reload, from the precache"**: `chooseTheme(page,
    'Caderno')`, then `runOffline` (worker in control, network cut, reload).
    While offline, `document.fonts.load` for all seven families resolves
    `loaded`. Every font response collected after the reload is status 200 with
    `response.fromServiceWorker() === true`. The heading still computes
    `Fraunces` with `document.fonts.check` true. Axe is clean after the
    network is restored. Pins the note's "offline after a reload, from the
    precache" and DIRECTION §3.7 lines 424–426.

No deferred follow-ups.

## Decisions

- **Take Google Fonts' published subsets via Fontsource, unmodified, rather
  than subsetting locally with fontTools.** *Rationale:* several of these
  families carry an OFL Reserved Font Name (e.g. "Source" for Source Sans 3,
  "Plex" for IBM Plex Mono). Under OFL, a file we re-subset is a Modified
  Version and may not keep the reserved name. Redistributing the
  distributor's files byte-for-byte keeps us an unmodified redistributor, so
  `font-family` names stay as the tokens spell them. Fontsource also ships each
  subset's exact `unicode-range` and its license in one tarball. *Alternatives
  rejected:*
  - `pyftsubset` to a custom range including ♯/♭: modifies RFN fonts and drops
    name-table license IDs by default.
  - `npm install @fontsource*` as dependencies: adds seven runtime deps and a
    lockfile change for static files that never update.
  - Upstream GitHub releases: full unsubset fonts, several times the precache
    weight.
- **`latin` + `latin-ext`, normal style, variable where the family has a
  variable cut.** *Rationale:* `latin` covers every locale the app ships (en,
  es-419, it, pt-BR — `app/src/i18n/locales/`). `latin-ext` covers names and
  titles in other Latin-script languages, and its `unicode-range` means the
  browser fetches it only when such a glyph appears. Variable `wght` files give
  400/600/700 from one file. Italics are not shipped: the app uses one italic
  run (`app/src/songs/song-conflict.css:52`), which the browser synthesizes.
  Music symbols the subsets lack fall back glyph by glyph to the system stack.
  *Alternative rejected:* every subset Google publishes (Cyrillic, Greek,
  Vietnamese) — precache weight for scripts the UI does not use. A song in
  those scripts still renders with the system fallback.
- **Fonts live under `app/src/theme/fonts/` and are referenced from CSS, not
  placed in `app/public/`.** *Rationale:* Vite fingerprints `url()` assets into
  `assets/`, which the service marks immutable and workbox precaches by
  revision, so a font change is a new URL. Files in `public/` would keep fixed
  names and revalidate on every load. The license sits beside the font in the
  source tree. In the shipped bundle the license travels in each font's own
  name table, since the files are unmodified.
- **No `vite.config.js` configuration change.** The note asks for "the PWA
  precache extended". `globPatterns` already includes `woff2` (from
  `shell.pwa`), and the hashed fonts are under the size limit. The extension
  is that the fonts now exist to be matched, and the e2e offline case proves
  they are precached. Adding `includeAssets` or `runtimeCaching` would only
  duplicate the glob.
- **No `<link rel="preload">`.** `swap` plus the precache gives the right
  behavior: the first online visit shows the fallback briefly, then the face,
  and later loads read the face from the precache at once. A preload would
  download all three themes' faces on the first paint.
- **A Go unit test is added to the service**, beyond the note's levels.
  Without the `font/woff2` case the e2e content-type assertion fails, and the
  service rule belongs pinned where it lives, beside `TestIconContentType`.
- **`docs/mockups/theme.css` is not edited.** The mockups are drawings on the
  design canvas. The app's stylesheet adds only the faces, and its header
  comment says so.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- Seven families self-hosted as Fontsource's unmodified latin + latin-ext `woff2` subsets (18 files, 385,184 bytes) in `app/src/theme/fonts/<family>/`, each with its SIL OFL 1.1 `LICENSE` beside it; source, version, license, copyright and Reserved Font Name recorded in `app/src/theme/fonts/README.md`.
- 18 `@font-face` rules (`font-display: swap`, `unicode-range`, relative `src`) added to `app/src/theme/theme.css`; the system stacks stay as fallbacks. `vite.config.js` unchanged: the build emits the fonts and `sw.js` precaches them.
- `service/internal/server/app.go` serves `.woff2` as `font/woff2`; `TestFontContentType` in `service/internal/server/app_test.go` pins it with immutable caching.
- Behavior test `app/src/theme/fonts.behavior.test.js` (7 tests) pins each token family to its `@font-face`, the descriptors, the `wOF2` signature, license files and no CDN.
- e2e-web `e2e/web/tests/fonts.spec.js`: load from origin, Caderno/Palco faces, offline from the precache, with axe, on phone, tablet and computer.
- Fixer: `app/src/editor/editor.css` gained `min-width: 0` on `.est .cm-editor`; the wider JetBrains Mono let long lines widen the editor past its pane on tablet.
- Tech-debt follow-ups: none.
