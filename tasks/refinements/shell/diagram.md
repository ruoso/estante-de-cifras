# shell.diagram — The chord diagram

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 34–38, task `shell.diagram`
("The chord diagram"), under `task shell` (lines 6–8, which `depends
foundation.app_tooling, foundation.e2e_web`). It `depends !tokens,
foundation.music_core_import`. The note, verbatim:

> Song's shape in ink, my shape in the chord colour, default hollow; the
> starting fret as a plain number right-aligned beside the first fret.
> docs/mockups/ChordBox.dc.html. Tests: unit (the starting fret, the marks
> for the song's shape, my shape and the default); behavior (rendered with
> an accessible name, axe).

`shell.diagram` is a leaf of Area 50, alongside `shell.chart`: the two
drawings everything else uses. Both `depends !tokens`; `shell.diagram` also
`depends foundation.music_core_import` for the renderer and the fingering
model it draws from.

## Effort estimate

**1 day** (from the `.tji`). The work is: a thin React view component that
wraps the already-imported SVG renderer, the stylesheet that maps the
renderer's classes onto the theme tokens with the three kinds, two i18n
strings, and the unit + behavior tests. The geometry, the starting-fret
label and the accessible name already exist in the carried music core; this
task themes and presents them.

## Repository

**estante-de-cifras only** (`app/`). This is app work, not a `cifra.md:`
task. The app and the service share no code
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 line 288); nothing
here touches the service, the API, or cifra.md. The drawing is the app's own
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.7 lines 421–423:
"Charts are drawn by the app").

**No design delta** is authored. The three states, the colours and the
right-aligned fret number are already decided by
[`docs/mockups/README.md`](../../../docs/mockups/README.md) lines 25–26 and
drawn in [`docs/mockups/ChordBox.dc.html`](../../../docs/mockups/ChordBox.dc.html);
this refinement turns those into a work order, it does not amend them.

## Inherited dependencies

- **`shell.tokens`** — *settled* (`complete 100`), refinement
  [`tokens.md`](tokens.md). It adopted
  [`docs/mockups/theme.css`](../../../docs/mockups/theme.css) whole into
  `app/src/theme/theme.css`. The diagram consumes the per-theme colour
  tokens it defines: **`--chord`** (lines 39, 66, 95 of
  `app/src/theme/theme.css`), **`--default-dot`** (46, 73, 102), `--ink`,
  `--ink-2`, and the fonts `--font-chart` / `--font-ui`. These are
  theme-keyed, so the diagram re-themes automatically with no code in it.
  The root class `est theme-current density-…` is applied by
  `app/src/theme/ThemeRoot.jsx`, above this component.
- **`foundation.music_core_import`** — *settled* (`complete 100`),
  refinement [`../foundation/music_core_import.md`](../foundation/music_core_import.md).
  It carried Explore Chords' music core and renderer into `app/src/core/`
  and `app/src/render/` with history. The diagram builds directly on:
  - `renderChordBox(fingering, options)` →
    [`app/src/render/chord-box.js`](../../../app/src/render/chord-box.js)
    lines 48–165: returns a vertical chord-box **SVG string** with
    `role="img"` and an `aria-label`, drawing frets/strings/nut, the
    open/muted markers as distinct glyphs (`ec-open`, `ec-muted`), the
    barre, the fretted dots (`ec-dot`, lines 121–130), and the starting-fret
    number right-aligned in the left margin when the shape sits up the neck
    (`ec-fretnum`, `text-anchor="middle"`, lines 81–86).
  - `renderDiagram(fingering, context, options)` →
    [`app/src/render/index.js`](../../../app/src/render/index.js) lines
    48–71: the cached entry point; dispatches to `renderChordBox` for the
    vertical orientation.
  - `describeFingering(fingering, { chord, dialect, instrument })` →
    [`app/src/render/diagram.js`](../../../app/src/render/diagram.js) lines
    186–231: the sentence used as the `aria-label` ("C major, x32010, open
    position, fingers 3-2-1, root on the 5th string.").
  - The `Fingering` model →
    [`app/src/core/search.js`](../../../app/src/core/search.js) lines 23–34
    (`frets`, `fingers`, `barre`, `midis`, `position`, `shorthand`), built by
    `searchFingerings` / `fingeringFromFrets` from a `chord`
    (`core/notation/parse.js`) and an `instrument` (`core/instrument.js`).
  - The i18n seam `t()` / `ordinal()` →
    [`app/src/i18n/index.js`](../../../app/src/i18n/index.js), already used
    by `describeFingering`; its four catalogues are
    `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.

**Downstream.** `shell.diagram` is the drawing the song-reading and
instrument surfaces reuse: the fallback states of Workflow 2 ("Where a
chord's shape comes from", §lines 87–100), the arrange mode (Workflow 5
lines 18–23), the chord explorer's ranked shapes and *your shape* star
(Workflow 16 lines 67–69, 124–126), and the "my shapes" review (Workflow 15
lines 170–171) all draw a `ChordBox`. Those tasks choose **which** kind a
chord gets; this task draws a **given** kind. `shell.a11y_chart`
(`depends design.screen_reader`) later checks the full screen-reader reading
order of "a chart, a diagram and a conflict"; this task ships the accessible
name that already exists.

## What this task is

Build the app's chord diagram as a React view component that draws a
`Fingering` as a vertical chord box in the visual language, in one of three
kinds:

- **the song's own shape** — dots filled in ink (`--ink`), no extra word;
- **your shape** — dots filled in the chord colour (`--chord`), labelled
  *your shape*;
- **the default** — dots drawn hollow (filled `--default-dot`, the surface
  colour, with an ink outline), labelled *default*.

The starting fret, when the shape does not sit at the nut, is a plain number
right-aligned beside the first fret. The whole diagram is an image with an
accessible name. The component wraps the already-imported SVG renderer and
supplies the stylesheet that colours the renderer's classes from the theme
tokens; the kind is a view concern carried on the component, not pushed into
the music core.

## Why it needs to be done

The music core was imported with a renderer that produces a themed-class SVG
string, but **no stylesheet in `app/` colours those classes** (`theme.css`
defines `--chord`, `--default-dot`, `--ink`, but nothing maps them onto
`ec-dot` / `ec-fret` / `ec-string`), the renderer has **no song/yours/default
distinction**, and there is **no React component** to place a diagram on a
screen. Until this lands, nothing downstream can draw a chord: the song
reading view, the arrange mode, the chord explorer and the instrument setup
all draw a `ChordBox`. It is one of the two drawings the rest of the app is
built on, which is why Area 50 ships it before the song and book surfaces.

## Inputs / context

- [`docs/mockups/ChordBox.dc.html`](../../../docs/mockups/ChordBox.dc.html)
  — the drawing (the `.tji`'s named governing file). It realises the three
  kinds in its logic: line 82 `const dotFill = kind === 'song' ?
  'var(--ink)' : kind === 'yours' ? 'var(--chord)' : 'var(--default-dot)';`
  and line 81 `const who = kind === 'yours' ? 'your shape' : kind ===
  'default' ? 'default' : '';`. Its props (line 40) are `kind`
  (`song`/`yours`/`default`, default `song`), `size` (`s`/`m`/`l`), `chord`
  (the name), `frets`. The chord name is drawn above the box in `--chord` /
  `--font-chart` (line 17); the box outline and dot border are `--ink`
  (lines 16, 29); the fret number, the markers and the "who" word are
  `--ink-2` (lines 20, 32, 36).
- [`docs/mockups/README.md`](../../../docs/mockups/README.md) — "Decisions
  the drawings carry". Line 25: "**A chord diagram that starts up the neck**
  shows the fret number alone (`8`), right-aligned beside the first fret."
  Line 26: "**Defaults are drawn hollow, your shapes filled in the chord
  colour, the song's own shapes filled in ink.** Every status badge carries
  a word, never colour alone." Line 17 names `ChordBox.dc.html` as "the chord
  diagram component every board uses."
- [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.7 "The app" (line
  394): the view/Worker boundary and the layering this component sits in —
  "the view is the only layer that" knows React (lines 415–417);
  "**Charts are drawn by the app**" (421–423); React Aria "for the richest
  accessible experience" (396–405). §3.6 line 288: the app and service share
  no code.
- The workflows that consume the drawing (not amended here, cited for the
  kind semantics): [`docs/workflows/02-find-and-play.md`](../../../docs/workflows/02-find-and-play.md)
  lines 87–100 (the fallback order song → *your shape* → *default*, each
  "marked for what it is"); [`docs/workflows/16-chord-explorer.md`](../../../docs/workflows/16-chord-explorer.md)
  lines 67–69, 124–126 ("the `ChordBox` decision", *your shape* in the chord
  colour, "a word plus a drawing, never colour alone").
- The carried code and test harness, as listed under Inherited dependencies:
  `app/src/render/chord-box.js`, `.../index.js`, `.../diagram.js`;
  `app/src/core/search.js`; `app/src/i18n/`; the axe helper
  [`app/src/a11y/axe.js`](../../../app/src/a11y/axe.js) (`checkWcag21aa`);
  the component+axe test template
  [`app/src/shell/AppShell.behavior.test.jsx`](../../../app/src/shell/AppShell.behavior.test.jsx);
  the carried render tests
  [`app/src/render/render.test.js`](../../../app/src/render/render.test.js).
- Stack (from `shell.tokens`): React 19 + React Aria Components, Vite,
  Vitest (jsdom) with `vitest-axe`, plain JavaScript + JSX (no TypeScript),
  tests co-located (`*.test.js` for pure modules, `*.behavior.test.jsx` for
  component behavior).

## Constraints / requirements

- **The view is the only layer that knows React** (DIRECTION §3.7 lines
  415–417). The music core and its renderer stay framework-free: this task
  does **not** edit `app/src/render/*` or `app/src/core/*`. The kind
  (song/yours/default), its word and its colour are presentation, so they
  live in the React component and its stylesheet, not in the renderer.
- **Colour comes from the theme tokens, never from code.** The three kinds
  resolve to `--ink` / `--chord` / `--default-dot` through CSS, so light,
  the three themes and print run off one set of tokens
  (`app/src/theme/theme.css`). "Hollow" is `fill: var(--default-dot)` (the
  theme's surface colour) with an ink outline — not `fill: none` — so the
  dot reads as a ring against the page in every theme, including Palco dark.
- **No information carried by colour alone** (DIRECTION §3.7; mockups README
  line 26, the standing status-by-word rule). *Your shape* and *default*
  each carry a visible word; the song's own shape is the plain, unlabelled
  case. The open and muted strings stay the distinct `O`/`×` glyphs the
  renderer already draws, not coloured dots.
- **Accessibility** (standing rule): the diagram is an image with an
  accessible name — `role="img"` with the `aria-label` from
  `describeFingering`, which the renderer already sets. axe at WCAG 2.1 AA
  (`checkWcag21aa`) is clean on the rendered component. The diagram is
  **not interactive** in this task (tapping to enlarge, starring and
  entering a shape are Workflows 5, 16 and their own tasks), so no React Aria
  Components interactive part is introduced here; when an enclosing surface
  makes the diagram pressable, that surface owns the RAC control and its
  keyboard path.
- **The structure never re-themes, only colour and typeface.** The grid,
  the markers, the fret number and the three-kind marking are the same on
  every theme; only `--chord` / `--default-dot` / `--ink` and the font
  change. (Workflow 1's chart invariant, applied to the diagram.)
- *Rules that do not bear on this task:* canonical form over preserving
  content, no song text in logs, offline first, no book without an account —
  this is a pure drawing with no storage, network or song text. Noted for
  completeness.

## Acceptance criteria

**Behaviour delivered.**

- A React component (`app/src/diagram/ChordDiagram.jsx`) renders a
  `Fingering` as a vertical chord box via the carried renderer, placing the
  SVG inside a host element that carries the kind modifier class.
- The three kinds render as decided: **song** → dots filled `--ink`, no
  word; **yours** → dots filled `--chord`, the word *your shape*;
  **default** → dots filled `--default-dot` with an ink outline (hollow), the
  word *default*. The barre takes the same kind fill as the dots.
- A shape that sits up the neck shows the starting fret as a plain number
  right-aligned beside the first fret; a shape at the nut shows no number and
  draws the thick nut.
- The diagram is an image with an accessible name (the `describeFingering`
  sentence); the kind word is adjacent visible text.
- The stylesheet (`app/src/diagram/diagram.css`) maps the renderer's classes
  (`ec-fret`, `ec-nut`, `ec-string`, `ec-fretnum`, `ec-open`, `ec-muted`,
  `ec-barre`, `ec-dot`) onto the theme tokens, with
  `.chord-diagram--{song,yours,default}` selecting the dot/barre fill.
- Two i18n strings (`diagram.yourShape`, `diagram.default`) are added to all
  four locale catalogues (`app/src/i18n/locales/{en,pt-BR,es-419,it}.js`);
  catalogue completeness across the four languages is pinned by
  `shell.i18n`'s unit test, not re-pinned here.

**Tests the task lands with, by level.**

- **unit — `app/src/diagram/chord-diagram.test.js`** (Vitest, no DOM): the
  pure helpers in `app/src/diagram/chord-diagram.js` — `diagramKind(kind)`
  returns the right modifier class and word for `song` (plain, no word),
  `yours` (*your shape*) and `default` (*default*), and the component's
  SVG-building helper surfaces the starting fret: a shape up the neck yields
  markup with `ec-fretnum` carrying the lowest fret, right-aligned (the
  renderer's left-margin `text-anchor="middle"`), and an open-position shape
  yields none and keeps the nut. *Pins:* "the starting fret, the marks for
  the song's shape, my shape and the default" (`.tji` note); mockups README
  lines 25–26; `ChordBox.dc.html` lines 81–82.
- **behavior — `app/src/diagram/ChordDiagram.behavior.test.jsx`** (Vitest +
  Testing Library, rendered under a `theme-current` root): the diagram is
  queryable as an image by its accessible name
  (`getByRole('img', { name: /…/ })`); each kind renders its modifier class
  and, for `yours`/`default`, its visible word, while `song` shows none;
  axe-clean via `checkWcag21aa`. *Pins:* "rendered with an accessible name,
  axe" (`.tji` note); DIRECTION §3.7 lines 415–417; mockups README line 26
  (status by word); the accessible name from `describeFingering`
  (`app/src/render/diagram.js` lines 186–231). Axe here pins
  role/name/label/structure — the rules that run under jsdom; contrast at AA
  is a jsdom no-op and is covered by the e2e-web of the screens that embed
  the diagram (see Decisions).

**No deferred WBS leaf.** No test level the `.tji` note names is dropped; no
new level is needed (see the e2e-web decision). No test is deferred: the
unit and behavior tests land in this task.

## Decisions

- **Reuse the carried SVG renderer (`renderChordBox` / `renderDiagram`)
  rather than re-drawing the diagram in JSX.** *Rationale:* it is already
  imported, tested (`app/src/render/render.test.js`) and is the same string
  that print and export use — "SVG rather than canvas, so printing and export
  are the same string that is already on screen" (`chord-box.js` lines 4–7);
  re-drawing in React would duplicate the geometry and drift from print, and
  violate "framework-free below the view." The component renders the trusted,
  app-generated SVG string into its host (the label inside is already escaped
  by the renderer's `esc`). *Alternative rejected:* a JSX re-implementation
  of the grid and dots — two drawings of one picture, guaranteed to diverge.
- **The kind (song/yours/default) is a view concern, carried on a modifier
  class on the React host, not an option on the renderer.** *Rationale:*
  keeps the carried music core free of React and of app-presentation tokens
  it should not know (DIRECTION §3.7 lines 415–417); the colour then comes
  from CSS tokens, not code, so no information is carried by colour in the
  drawing logic. One seam, one call site. *Alternative rejected:* adding a
  `kind` option to `renderChordBox` — couples the framework-free renderer to
  the app's `--chord` / `--default-dot` tokens and edits code carried with
  history for no gain.
- **"Hollow" is `fill: var(--default-dot)` with an ink outline, not
  `fill: none`.** *Rationale:* `--default-dot` is defined as the theme's own
  surface colour (white in Estante, paper in Caderno, dark in Palco), so the
  dot reads as a ring against the page in every theme; it matches
  `ChordBox.dc.html` line 82 exactly. *Alternative rejected:* `fill: none`
  — a transparent hole shows whatever sits behind the diagram (a selected
  row, a tint), not the page, so the dot stops reading as hollow on coloured
  surfaces.
- **Each non-song kind carries a visible word; the accessible name is not
  duplicated with it.** *Rationale:* the status-by-word rule (mockups README
  line 26) wants a word beside the drawing; the word is adjacent visible text
  read by assistive tech in document order, so repeating it inside the SVG's
  `aria-label` would say it twice. *Alternative rejected:* fold the kind into
  the `aria-label` — a double announcement, and it would reopen the carried
  `describeFingering` the music core owns.
- **No e2e-web level in this task.** *Rationale:* the diagram has no
  standalone route — it is a sub-component embedded in screens (the chart,
  the song reading view, the chord explorer W16) that each carry their own
  Playwright journey with axe at AA across themes and viewports; contrast at
  AA (a jsdom no-op) is pinned there, on the surfaces a user actually visits.
  The `.tji` note names only unit and behavior, matching this. *Alternative
  rejected:* a synthetic e2e route that mounts a bare diagram — it would
  assert contrast on a surface no user reaches and duplicate the embedding
  screens' checks.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `app/src/diagram/chord-diagram.js` — pure helpers `diagramKind()`, `diagramSvg()`, `KINDS`; maps kind → modifier class and visible word
- `app/src/diagram/ChordDiagram.jsx` — React view wrapping the carried SVG renderer; kind carried as host modifier class
- `app/src/diagram/diagram.css` — maps `ec-*` renderer classes onto theme tokens; `.chord-diagram--{song,yours,default}` select dot/barre fill (hollow = `--default-dot` + ink outline)
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — added `diagram.yourShape` and `diagram.default` i18n strings
- `app/src/diagram/chord-diagram.test.js` — unit tests: kind→class/word, starting fret surfaces as `ec-fretnum` up the neck, nut present at open position (6 tests)
- `app/src/diagram/ChordDiagram.behavior.test.jsx` — behavior tests: image by accessible name, per-kind modifier + visible word, axe WCAG 2.1 AA each kind (5 tests)
