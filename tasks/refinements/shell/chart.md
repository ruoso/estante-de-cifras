# shell.chart — The chart

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 28–33, task `shell.chart`
("The chart"), under `task shell` (lines 6–8, which `depends
foundation.app_tooling, foundation.e2e_web`). It `depends !tokens,
cifra_js.reader`. The note, verbatim:

> Proportional: sung lines as chords stacked over the syllables they belong
> to, a centred hyphen where a chord opens room in a word, measures between
> bar rules, sections; marking for defaults, conflicts, arrange mode.
> docs/mockups/README.md. Tests: unit (sung-line layout: chords over
> syllables, the centred hyphen, measures between bar rules, sections);
> behavior (corpus songs rendered with Testing Library, defaults, conflicts
> and arrange-mode marking, axe); e2e-web (a chart on the three viewports
> without horizontal overflow, axe).

`shell.chart` is a leaf of Area 50, alongside `shell.diagram`: the two
drawings everything else uses. Both `depends !tokens`; `shell.chart` also
`depends cifra_js.reader` for the parsed song model it draws.

## Effort estimate

**4 days** (from the `.tji`). The work is: a pure layout module that turns
the cifra.md reader's parsed model into chart render rows (segments for a
sung line, measures for a bar line, runs, word lines, breaks, section
names), a React view component that renders those rows into the chart markup
the mockups already draw and the stylesheet already styles, the
consumer-supplied marking seam for defaults / conflicts / arrange mode, a
small hash-gated dev gallery so the chart can be driven in a real browser,
and the unit + behavior + e2e-web tests. The visual language, the chart CSS
and the attachment/layout of a sung line already exist (in
`app/src/theme/theme.css` and in the reader's §4.5 pass); this task draws
them.

## Repository

**estante-de-cifras only** (`app/`, plus `e2e/web/` for the e2e spec). This
is app work, not a `cifra.md:` task. The app and the service share no code
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 line 288); the
drawing is the app's own —
[`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.7 lines 421–423:
"**Charts are drawn by the app**, in a proportional face, as chords stacked
over the syllables they belong to, with a centred hyphen where a chord opens
room inside a word." The chart *consumes* the format (the parsed model from
`cifra-md`) but adds nothing to it, so no work lands in the cifra.md
repository.

**No design delta** is authored. The proportional chord-over-syllable
drawing, the centred hyphen, measures between bar rules, section names and
the three marking states are already decided by
[`docs/mockups/README.md`](../../../docs/mockups/README.md) line 24 and
[`docs/mockups/GUIDE.md`](../../../docs/mockups/GUIDE.md) lines 45–97, and
drawn in the boards; the markup and tokens are in
`app/src/theme/theme.css` lines 210–229. This refinement turns those into a
work order, it does not amend them.

## Inherited dependencies

- **`shell.tokens`** — *settled* (`complete 100`), refinement
  [`tokens.md`](tokens.md). It adopted
  [`docs/mockups/theme.css`](../../../docs/mockups/theme.css) whole into
  `app/src/theme/theme.css`, **including the chart block** the mockups draw.
  The chart renders into those classes and tokens, authoring no colour of
  its own:
  - `.chart` (line 210): `font-family: var(--font-chart)` (proportional,
    line 19) at `font-size: var(--chart-size)` (line 22; `15px`/`19px` at
    compact/roomy density, lines 113–115).
  - `.sung` / `.s` / `.s .c` / `.s .w` (lines 211–214): a sung line is a row
    of segments; `.c` is the chord in `var(--chord)` weight 700, `.w` the
    words in `var(--ink)`.
  - `.s .w .fill` / `.fill::after` (lines 218–219): the **centred hyphen** —
    a short `var(--ink-2)` bar centred in the gap a chord opens inside a
    word.
  - `.barline` / `.m` / `.m:last-child` (lines 220–222): **measures between
    bar rules**, each a `min-width: 4.2em` cell with a `2px var(--ink-2)`
    left rule (and a right rule on the last).
  - `.runline` (223), `.words` (224), `.gap` (225): a chord run with no bar
    lines, a words-only line, a stanza break.
  - `.sec-name` (226): the section label, `var(--ink-2)`, uppercased.
  - `.mark-def` (227, dashed outline), `.mark-conf` (228, `--conflict-soft`
    background), `.mark-tap .c` (229, `--accent-soft` highlight on each
    chord) — the three marking states.
  The root class `est theme-current density-…` is applied by
  `app/src/theme/ThemeRoot.jsx`, above this component.
- **`cifra_js.reader`** — *settled* (`complete 100`,
  [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) line 32), refinement
  [`../cifra_js/reader.md`](../cifra_js/reader.md). It is the cifra.md
  JavaScript reader, published as the `cifra-md` package the app already
  depends on (`app/package.json`: `"cifra-md": "file:../../cifra.md/js"`;
  imported as `parse` in `app/src/worker/logic.js` line 13). `parse(bytes) →
  model` produces a **plain-object, framework-free** model (spec
  `0-overview.md` §0.4), and — this is the key fact for the chart — it runs
  the **§4.5 layout convergence pass** on every sung line, so the model
  already holds each sung line *as laid out*: every measure-making item
  carries its `column` (NFC code points from 0) and its attached `words`.
  The chart therefore **does not re-derive attachment**; it renders the
  attachment the reader computed. The model shape the chart reads:
  - top level `{ title, properties, sections, blocks, sung, sungAt,
    diagnostics }` (`js/src/parse.js` `result()`, lines 1029–1062);
  - a `section` `{ name, heading, anchor, body[], groups[], times? }`; its
    `body[]` holds `{ type: "music", lines[] }` parts (also `notes` /
    `verbatim` prose parts — see Constraints);
  - a `line` has `kind ∈ "chart" | "sung" | "lyric" | "break" |
    "annotation"`; a chart/sung line has `measures[]` and `closeBar`, a
    chart line may carry `run` (no bar lines, §2.1), a sung line's items
    carry `column`/`words`, a `lyric` has `text`, a `break` is a blank-line
    gap (§4.6);
  - a `measure` `{ bar, items[], column?, anchor?, anchorColumn? }`; `bar`
    is the bar line *before* the measure (`"|"`/`"||"`) or `null`;
  - an `item` has a `type` discriminator: `chord`
    (`{ symbol, index, key, chord, column?, words? }`), `lead`
    (`{ column:0, words }`, the syllables before the first chord),
    `nochord`, `unknown` (kept verbatim), and the non-attached `mark` /
    `count` / `ending` (which have a `column` but no `words`).
  The clearest worked example is
  [`/home/ruoso/devel/cifra.md/corpus/28-sung-line-layout/parsed.json`](/home/ruoso/devel/cifra.md/corpus/28-sung-line-layout/parsed.json)
  — `lead`, `chord` items with `column`+`words`, bar lines with a `column`,
  and a second measure, all in one file.

**Downstream.** The chart is the surface the song-reading and editing work
is built on. The song-reading view (Workflow 2, songs area) composes the
chart with the title, the shapes (`shell.diagram`), badges and prose; arrange
mode (Workflow 5) turns its chords into tappable controls; the conflicts
view (Workflow 9) renders two charts side by side with the conflicted lines
marked; `shell.a11y_chart` (`depends !chart, design.screen_reader`) later
implements and checks the *designed* screen-reader reading order of a sung
line, a chart and a conflict. Those tasks decide **which** lines and chords
are marked and own any interaction; this task draws a **given** chart and
accepts a **given** marking.

## What this task is

Build the app's chart as a React view component that renders a parsed
cifra.md song model proportionally, in the visual language:

- a **sung line** is drawn as segments, each a chord stacked over the words
  it is attached to; where a chord opens room **inside** a word, a centred
  hyphen bridges the gap (as syllables are joined under notes in sheet
  music);
- a **chord-only line** is measures between bar rules (`.barline`/`.m`), or a
  chord **run** with no bar lines (`.runline`);
- a **words-only line** and a **stanza break** render as themselves;
- **section names** head their sections.

The component takes the already-parsed, plain-object model (the Worker owns
parsing; the view receives the model as data) and a consumer-supplied
marking seam that paints a line with the defaults / conflict / arrange-mode
state. A pure layout module does the model→rows transform so the geometry
can be unit-tested with no DOM. A hash-gated dev gallery mounts
representative charts so the drawing can be driven in a real browser for the
e2e-web checks (overflow and contrast) before any song screen exists.

## Why it needs to be done

The reader produces a laid-out song model and the mockups decided and drew
the chart, but **nothing in `app/` renders a song**: there is no component
that turns a model into the `.chart` markup, no module that turns the
reader's measures and attached words into render rows, and no marking seam
for the defaults / conflict / arrange states the reading, arrange and
conflicts screens need. Until this lands, no song can be shown: the entire
song-reading, editing, arrange and conflicts surface sits on top of it. It
is one of the two drawings the rest of the app is built on, which is why Area
50 ships it before the song and book surfaces.

## Inputs / context

- [`docs/mockups/README.md`](../../../docs/mockups/README.md) line 24 (the
  `.tji`'s named governing file, "Decisions the drawings carry", header line
  22): "**Charts are set in a proportional face, not a monospace.** A sung
  line is drawn as segments, each a chord stacked over the words it is
  attached to. A chord wider than its syllable opens room in the words.
  Where that room falls inside a word, a centred hyphen bridges it… Chord-only
  lines are measures between bar rules. Only the raw source editor is
  monospaced." Line 26 carries the standing rule: "Every status badge carries
  a word, never colour alone."
- [`docs/mockups/GUIDE.md`](../../../docs/mockups/GUIDE.md) "Charts" (lines
  45–97) — the authoritative markup. Line 25: "**The rendered chart is NOT
  monospaced** — never align chords with spaces." Lines 84–95: the exact DOM
  — `<div class="chart">` with, per line, `.sec-name`; `.sung` of `.s`
  segments each `<span class="c">`chord`</span><span class="w">`words`<span
  class="fill"></span></span>`; `.barline` of `.m` measures; `.runline`;
  `.words`; `.gap`. Line 80 fixes the behaviour: words are attached by
  column, underscore padding (`W_hen`, "the canonical text's room made inside
  a word") is removed, and "where a chord then opens room inside a word, the
  `.fill` span draws a centred hyphen in the gap." Line 97: a bigger chart on
  a tablet/computer sets `style="--chart-size: 20px"` on `.chart`.
- The boards that draw the three marks (cited for the states, not amended):
  the reference chart in
  [`docs/mockups/Main.dc.html`](../../../docs/mockups/Main.dc.html) lines
  50–69; **defaults** `mark-def` in
  [`docs/mockups/W02-find-and-play.dc.html`](../../../docs/mockups/W02-find-and-play.dc.html)
  lines 266–272; **arrange** `mark-tap` in
  [`docs/mockups/W05-arrange.dc.html`](../../../docs/mockups/W05-arrange.dc.html)
  lines 263–272; **conflict** `mark-conf` in
  [`docs/mockups/W09-conflicts.dc.html`](../../../docs/mockups/W09-conflicts.dc.html)
  line 318.
- [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.7 "The app" (line
  394): "Charts are drawn by the app… proportional… centred hyphen" (lines
  421–423); "the view is the only layer that" knows React (lines 415–417);
  "One owner for the data: a Web Worker… The main thread never touches
  IndexedDB" (lines 407–409); React Aria "for the richest accessible
  experience" (396–405). §3.6 line 288: the app and service share no code.
  §4 (line 428): the interface the chart is read inside — search is the
  primary way in (430–435), history reads "a diff in musical terms" (446–450).
- The workflows the drawing serves (cited for the marking semantics, not
  amended here):
  [`docs/workflows/02-find-and-play.md`](../../../docs/workflows/02-find-and-play.md)
  lines 67–108 (reading a song; where a shape comes from — the song's choice,
  your shape, the default, "each marked for what it is");
  [`docs/workflows/05-arrange-for-an-instrument.md`](../../../docs/workflows/05-arrange-for-an-instrument.md)
  lines 14–61 (arranging is a mode; chords become tappable; an accidental tap
  must never change the song);
  [`docs/workflows/09-conflicts.md`](../../../docs/workflows/09-conflicts.md)
  lines 13–78 (what can conflict; "the song shows the user's own version,
  with the conflicted places marked").
- The cifra.md specification, for the meaning of what the model holds:
  [`/home/ruoso/devel/cifra.md/spec/2-chart.md`](/home/ruoso/devel/cifra.md/spec/2-chart.md)
  (§2.1 chord lines and runs, §2.2 measures and bar lines, §2.6 no-chord);
  [`/home/ruoso/devel/cifra.md/spec/4-lyrics.md`](/home/ruoso/devel/cifra.md/spec/4-lyrics.md)
  (§4.4 columns and attachment, and padding — the `_` inside a word, lines
  100–186; §4.5 "Laying out a sung line", lines 188–335; §4.6 breaks; §4.7 a
  sung document has no bar numbers);
  [`/home/ruoso/devel/cifra.md/spec/0-overview.md`](/home/ruoso/devel/cifra.md/spec/0-overview.md)
  §0.4 "The document model" (lines 109–192).
- The sibling drawing for the view conventions to mirror:
  [`app/src/diagram/ChordDiagram.jsx`](../../../app/src/diagram/ChordDiagram.jsx),
  [`app/src/diagram/chord-diagram.js`](../../../app/src/diagram/chord-diagram.js)
  and its
  [`ChordDiagram.behavior.test.jsx`](../../../app/src/diagram/ChordDiagram.behavior.test.jsx)
  — a thin React view over a framework-free helper, presentation state carried
  on the host as a modifier class, colour only from tokens, status by a word,
  axe pinned at WCAG 2.1 AA.
- The shared harness and conventions: the axe helper
  [`app/src/a11y/axe.js`](../../../app/src/a11y/axe.js) (`checkWcag21aa`, the
  WCAG 2.1 AA tag set; contrast is a jsdom no-op, pinned at e2e-web); the
  e2e-web fixture [`e2e/web/lib/axe.js`](../../../e2e/web/lib/axe.js)
  (`checkA11y`) and the three viewport projects in
  [`e2e/web/playwright.config.js`](../../../e2e/web/playwright.config.js);
  specs reach the app with `page.goto('/')`
  ([`e2e/web/tests/theme.spec.js`](../../../e2e/web/tests/theme.spec.js)).
  Stack (from `shell.tokens`/`shell.layout`): React 19 + React Compiler,
  React Aria Components, Vite, Vitest (jsdom) with `vitest-axe`, plain
  JavaScript + JSX (no TypeScript); tests co-located (`*.test.js` for pure
  modules, `*.behavior.test.jsx` for component behavior).

## Constraints / requirements

- **The view is the only layer that knows React** (DIRECTION §3.7 lines
  415–417). The model-→rows transform is a pure, framework-free module
  (`app/src/chart/layout.js`), unit-tested with no DOM; only the component
  (`app/src/chart/Chart.jsx`) and the dev gallery are React. The chart does
  **not** import `cifra-md` or call `parse` in production — the Worker owns
  parsing and the model reaches the view as plain data (DIRECTION §3.7 lines
  407–414). The model is plain JSON (it crosses the Worker boundary), so the
  component's input is an ordinary object prop.
- **Render the attachment the reader computed; do not re-derive it.** The
  §4.5 convergence already placed every chord over its syllable and divided
  the words among the attached items. The chart maps each measure-making item
  (`lead`, `chord`, `nochord`, `unknown`) to one segment — its `words` beneath
  the chord `symbol` (empty chord for `lead`; the no-chord mark for
  `nochord`; the kept text for `unknown`) — in item order, with bar rules
  between measures. The **centred hyphen** is drawn (the `.fill` span)
  between two adjacent segments when the split falls inside a word — i.e.
  the left segment's words end on a non-space and the right segment's begin
  on a non-space (the mockup's rule, `GUIDE.md` segment helper lines 55–60;
  spec §4.4 padding). The stored `words` do not contain the `_` padding
  (§4.4), so the hyphen is inferred from the segment boundary, never printed
  from the text. **Never align with spaces / never a monospace** in the
  rendered chart (GUIDE line 25).
- **Chord-only lines** render as measures between bar rules (`.barline` of
  `.m`), one `.m` per `measure`, its chords shown in order; a `run`
  (no bar lines, §2.1) renders as a `.runline`. Bar numbers are **not** drawn
  (the governing chart mockup shows none, and §4.7 gives a sung document no
  numbers); song history's "Verse bar 5" wording (DIRECTION §4) is the
  history view's concern, not the chart's.
- **Colour and typeface are the only things that change with the theme.**
  All colour comes from the tokens through the adopted chart CSS
  (`app/src/theme/theme.css` lines 210–229); the chart authors none. The
  structure is identical on every theme and in print — the chart invariant,
  shared with the diagram.
- **No meaning carried by colour alone** (DIRECTION §3.7; mockups README line
  26). The three marks are not colour-only: `mark-def` is a dashed outline,
  `mark-conf` a background plus (in the consuming conflicts view) a "conflict"
  word, `mark-tap` a highlight on chords that are, in arrange mode, labelled
  and operable controls owned by the arrange surface. The marking *word* for
  defaults/conflicts is carried by the surrounding screen (badges, notices),
  not re-invented inside the chart; the chart supplies the line-level visual
  state those screens ask for.
- **Marking is a view concern the consumer supplies**, exactly as the
  diagram's kind is (ChordDiagram decision). The chart accepts an optional
  `markOf(address) → 'def' | 'conf' | 'tap' | null` keyed by a stable line
  address (`{ section, part, line }` indices); it derives nothing from the
  model. Default: no marking (the plain reading chart).
- **Not interactive in this task.** Like the diagram, the chart introduces no
  React Aria Components control. Arrange mode's tap-to-choose (Workflow 5) —
  making chords real buttons and opening the shape picker — is the arrange
  task's: that surface owns the control and its keyboard path. `mark-tap`
  here is the visual affordance only ("an accidental tap must never change the
  song" — W5 line 14). Any landmark/region the chart sits in is non-interactive.
- **Scope of what the chart draws.** The chart draws the **music** of a song
  — section names and the `music` parts' lines. The song's title, artist and
  other properties, the voicing blocks, the shapes legend and prose `notes`/
  `verbatim` body parts are the **song-reading view's** composition (songs
  area, Workflow 2), drawn around the chart, not by it. An `annotation` line
  (a `//` comment, §4.x) renders as a plain words line — no new token.
- **Standing rules, scoped.** *Canonical form over preserving content:* the
  chart is a read-only drawing of the model the reader produced from
  canonical (or working-copy) text; it preserves no non-canonical spelling
  and writes nothing. A text holding git conflict markers is surfaced by the
  reader as diagnostics and is never canonical — the conflicts view, not the
  chart, decides how two versions are shown; the chart only accepts a
  `mark-conf` line state. *No song text in logs:* a pure view, it logs
  nothing; tests and the gallery use songs written for the purpose, never
  anyone's copyrighted words. *Offline first / no book without an account:*
  the chart touches no network and no storage and fetches no book — it draws
  the data handed to it; the gallery uses in-memory fixtures, not a book.

## Acceptance criteria

**Behaviour delivered.**

- A pure module `app/src/chart/layout.js` turns a parsed model into an
  ordered list of render rows: a **section-name** row per named section; a
  **sung** row of segments (`{ chord, words, hyphen }`) built from the
  measure-making items in column order, with bar rules between measures and
  the `hyphen` flag set where a chord splits a word; a **bars** row of
  measures (chords between bar rules); a **run** row; a **words** row; a
  **gap** row. Each content row carries its `{ section, part, line }`
  address.
- A React component `app/src/chart/Chart.jsx` renders those rows into the
  mockups' chart markup (`.chart` → `.sec-name` / `.sung` of `.s`/`.c`/`.w`
  with the `.fill` hyphen / `.barline` of `.m` / `.runline` / `.words` /
  `.gap`), applying the class `markOf` returns to each line. An optional
  `size` sets `--chart-size` on the `.chart` host (GUIDE line 97). The DOM
  order within a segment is chord-then-words, so the reading order is sensible
  (the *designed* reading order is `shell.a11y_chart`'s).
- The three marking states render as decided: `mark-def` (dashed outline),
  `mark-conf` (`--conflict-soft` background), `mark-tap` (each chord
  highlighted) — all from the adopted CSS, driven by the `markOf` seam.
- A hash-gated dev gallery (`app/src/chart/gallery/ChartGallery.jsx`, mounted
  by `app/src/App.jsx` only when `location.hash` begins `#dev/chart`, absent
  from the tab bar and from normal navigation) renders written-for-purpose
  charts in four states — plain, all-defaults, a conflicted line, arrange
  mode — so the e2e-web spec can drive a real chart before a song screen
  exists.
- Any accessible name/label strings the component needs (e.g. a region label
  for the chart) are added to all four locale catalogues
  (`app/src/i18n/locales/{en,pt-BR,es-419,it}.js`); catalogue completeness
  across the four languages is pinned by `shell.i18n`, not re-pinned here.

**Tests the task lands with, by level.**

- **unit — `app/src/chart/layout.test.js`** (Vitest, no DOM): against
  plain model-object fixtures in the reader's shape (the
  `corpus/28-sung-line-layout` structure, with songs written for the
  purpose): a **sung line** yields one segment per measure-making item with
  the chord over its attached words and a `lead` segment for leading
  syllables; the **centred-hyphen** flag is set between two segments that
  split a word and clear at a word boundary (a trailing/leading space);
  **bar-line** lines yield one measure per `measure` with its chords, between
  bar rules; a **run** line (no bars) yields a run row; a **words** line and a
  **break** yield their rows; a named **section** yields its section-name row,
  an unnamed section none. *Pins:* "sung-line layout: chords over syllables,
  the centred hyphen, measures between bar rules, sections" (`.tji` note);
  mockups README line 24; spec `4-lyrics.md` §4.4–§4.5 and `2-chart.md`
  §2.1–§2.2.
- **behavior — `app/src/chart/Chart.behavior.test.jsx`** (Vitest + Testing
  Library, rendered under a `theme-current` root): songs written for the
  purpose, **parsed through the real `cifra-md` reader** and rendered, so the
  chart is exercised with its real collaborators (the reader, the adopted
  CSS, i18n). It asserts: the chord symbols appear over their words
  (`.sung`/`.s`/`.c`/`.w` structure); the centred hyphen (`.fill`) appears
  where a chord splits a word and not at a word boundary; measures render
  between bar rules (`.barline`/`.m`); section names render; and each of the
  three marks — supplied via `markOf` to reproduce the W02 (`mark-def`), W05
  (`mark-tap`) and W09 (`mark-conf`) board states — paints the right class;
  axe-clean via `checkWcag21aa`. *Pins:* "corpus songs rendered with Testing
  Library, defaults, conflicts and arrange-mode marking, axe" (`.tji` note);
  mockups README line 24 and the marking classes (theme.css lines 227–229);
  Workflows 2, 5 and 9; DIRECTION §3.7 lines 415–417. Axe here pins
  role/name/structure — the rules that run under jsdom; contrast at AA is a
  jsdom no-op, pinned at e2e-web.
- **e2e-web — `e2e/web/tests/chart.spec.js`** (Playwright against the compose
  stack, on the phone, tablet and computer projects): navigate to the dev
  gallery (`#dev/chart`); for each of the four charts assert **no horizontal
  overflow** (the chart's `scrollWidth` does not exceed its `clientWidth`, and
  the page has no horizontal scroll) on all three viewports — the proportional
  face wraps, it never scrolls sideways; axe at WCAG 2.1 AA via `checkA11y`
  on each viewport, in Estante light and Palco dark (contrast on every theme).
  *Pins:* "a chart on the three viewports without horizontal overflow, axe"
  (`.tji` note); the not-monospace/proportional decision (mockups README line
  24, GUIDE line 25); the density/size tokens (theme.css lines 113–115, 22).

**No deferred WBS leaf.** The `.tji` note names unit, behavior and e2e-web;
all three land here, none dropped. **e2e-api** does not apply — the chart is a
pure view with no endpoint and no git client. No test is deferred. The
interactive arrange control (Workflow 5), the song-reading composition
(Workflow 2, songs area) and the designed screen-reader reading order
(`shell.a11y_chart`) are **existing** downstream leaves, not new deferrals of
this task.

## Decisions

- **Render the reader's already-laid-out model; do not re-implement
  attachment, and do not re-parse the source text.** *Rationale:*
  `cifra_js.reader` runs the §4.5 convergence pass, so the model holds every
  sung line with each chord's `column` and attached `words` already computed
  — the hard part (keeping a chord over an accented syllable, in NFC code
  points) is done and conformance-tested in the corpus. The chart maps items
  to segments and infers the mid-word hyphen from the segment boundary.
  *Alternative rejected:* the mockup's `segsOf` helper re-derives segments by
  scanning a monospaced chord line against a words line (GUIDE lines 50–61) —
  right for a static board built from typed text, wrong for the app, where
  re-deriving what the reader already computed would duplicate §4.4/§4.5,
  drift from it, and reintroduce the column arithmetic the format owns.
- **Do not reuse the carried `app/src/core/chart-layout.js`.** *Rationale:*
  that module (carried by `foundation.music_core_import`) implements Explore
  Chords' *shared-column grid* — measures across lines line up in columns, a
  split bar becomes fractional cells (its header cites a `docs/DESIGN.md §2.6`
  and a `./song.js` model that were **not** carried, so it is orphaned from
  its data source). The governing chart drawing does **not** do that: the
  mockups render measures as independent `min-width: 4.2em` flex cells that
  wrap (`.m`, theme.css line 221), with no cross-line alignment. Routing the
  cifra.md model through the carried grid would also discard the §4.5 column
  information for sung lines (it reduces a sung line to "one column per
  segment, no grid"). This task writes `app/src/chart/layout.js` against the
  reader model and the mockup markup instead. *Alternative rejected:* adapt
  the reader model into the carried module's `{lines:[{measures:[{segments}]}]}`
  shape — more code in both directions to reach a layout the governing
  drawing explicitly does not use. (The carried module is left untouched —
  out of this task's file scope and possibly intended for a future file/grid
  view; its disposition is noted for the parking lot, not scoped as work.)
- **The chart is a pure view over a plain-object prop; the Worker owns
  parsing.** *Rationale:* DIRECTION §3.7 (one data owner, the view the only
  React layer); the model is JSON that already crosses the Worker boundary, so
  the component needs no parser and no store access of its own — the consuming
  screen reads the model from a slice and passes it down. *Alternative
  rejected:* the chart calls `parse` itself — pulls parsing onto the main
  thread and couples the view to `cifra-md`, against the data-owner boundary.
  (The *behavior test* calls `parse` to build fixtures from written-for-purpose
  text — a test convenience that pins the real reader→chart contract, not
  production wiring.)
- **Marking is a consumer-supplied, line-addressed seam (`markOf`), not
  derived from the model.** *Rationale:* which lines are defaults, in conflict
  or tappable is decided by the reading, conflicts and arrange screens
  (Workflows 2/9/5), exactly as the diagram's kind is decided by its
  consumer; the chart's job is to *draw* a given state. A positional
  `{ section, part, line }` address is the minimal stable key, and the three
  values map onto the adopted `mark-def`/`mark-conf`/`mark-tap` classes.
  *Alternative rejected:* a rich marks schema or deriving marks from
  `diagnostics`/voicing state inside the chart — speculative, and it would put
  product decisions that belong to three different screens into the drawing.
- **No interactive control in this task; arrange owns the tap.** *Rationale:*
  mirrors the diagram decision and Workflow 5's "an accidental tap must never
  change the song" — the tap target, the picker and the keyboard path are the
  arrange surface's, built when arrange is. The chart ships the `mark-tap`
  visual state only, so it introduces no RAC control and nothing to mis-fire.
  *Alternative rejected:* build tappable chord buttons now — interaction with
  no owner screen, untestable as a journey, and it would pre-empt Workflow 5's
  design (every-Cm vs only-here, the warning notice).
- **A hash-gated dev gallery is the e2e-web mount point.** *Rationale:* the
  `.tji` note mandates an e2e-web level (overflow and contrast are real chart
  risks a browser catches and jsdom cannot), but no song screen exists yet to
  host a chart. A gallery reachable only at `#dev/chart` — absent from
  navigation, carrying the site-wide `noindex`, using in-memory
  written-for-purpose fixtures (no book, no account) — satisfies the mandated
  e2e honestly and doubles as the chart's living visual reference as real
  screens adopt it. *Alternative rejected:* dropping e2e-web as the diagram
  did — the diagram's note named only unit+behavior; the chart's names
  e2e-web, and the closer checks the named spec ran, so it cannot be dropped
  without a decision, and overflow/contrast genuinely need a browser.
  *Alternative rejected:* defer the chart's e2e-web to the first song screen —
  that screen is in a later area, and tests are never deferred to a later task.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- Pure layout module `app/src/chart/layout.js`: turns parsed cifra.md model into ordered render rows (section-name, sung segments with `{ chord, words, hyphen }`, bars, run, words, gap), each content row carrying its `{ section, part, line }` address.
- React component `app/src/chart/Chart.jsx`: renders layout rows into the mockup chart markup (`.chart`, `.sec-name`, `.sung`/`.s`/`.c`/`.w`/`.fill`, `.barline`/`.m`, `.runline`, `.words`, `.gap`) with optional `markOf` seam for `mark-def` / `mark-conf` / `mark-tap` and optional `size` prop (`--chart-size`).
- Hash-gated dev gallery `app/src/chart/gallery/ChartGallery.jsx` (fixtures in `app/src/chart/gallery/fixtures.js`), mounted from `app/src/App.jsx` only at `#dev/chart`.
- `chart.label` added to all four locale catalogues: `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Unit tests `app/src/chart/layout.test.js` (11 tests): sung-line segments, centred-hyphen flag, bar-line measures, run row, words/break rows, named/unnamed sections.
- Behavior tests `app/src/chart/Chart.behavior.test.jsx` (7 tests): real `cifra-md` parse → render; chord-over-word, `.fill` hyphen, `.barline`/`.m`, section names, W02 `mark-def`/W05 `mark-tap`/W09 `mark-conf` via `markOf`, `--chart-size`, axe.
- e2e-web `e2e/web/tests/chart.spec.js`: gallery on phone/tablet/computer viewports, no horizontal overflow per chart + page, axe in Estante light and Palco dark — all three viewport projects passed.
