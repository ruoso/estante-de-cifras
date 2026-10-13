# shell.a11y_chart — A sung line for a screen reader

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 50–55, task `a11y_chart`
inside the `shell` task group. `depends !chart, design.screen_reader`
(`shell.chart` as a sibling with `!`, and `design.screen_reader`). The note,
verbatim:

> The decided reading order, implemented and checked. Tests: unit (the
> reading-order text of a sung line, a chart, a diagram and a conflict);
> behavior (accessible names as design.screen_reader decided, Testing Library
> and axe); e2e-web (a chart read through the accessibility tree and by
> keyboard on the three viewports).

## Effort estimate

**1 day** (from the `.tji`). The work is: a framework-free chord-speech
module that turns a parsed chord into its spoken name (§3); a framework-free
reading module that turns a chart render row into the ordered announced
tokens of `docs/screen-reader.md` §2, §4, §5 and the §7 region wording; the
ARIA mechanics in `Chart.jsx` that realise those tokens in the fixed reading
order (visually-hidden spoken text, glyphs hidden from the tree, chart-line
measures as an ordered list, a bounded conflict region); routing the chord
button's accessible name in arrange through the spoken name; the spoken-word
i18n strings in all four catalogues; and a visually-hidden utility class. The
chord diagram's reading (§6) is already produced by `shell.diagram` — this
task pins it and composes the role word into the announced order.

## Repository

**estante-de-cifras only** (`app/` — the chart view and its pure
music-rendering siblings, `e2e/web/`). This is **not** a `cifra.md:` task:
the format's specification is silent on assistive technology
(`tasks/refinements/design/screen_reader.md` records that the cifra.md spec
does not describe AT), and the spoken forms are an app-side rendering of the
model the reader already produces. The app and the service share no code
(DIRECTION §3.6 line 288); nothing here touches `service/`, `api/` or the
format.

**No design delta** is authored. `docs/screen-reader.md` (new in commit
78bfd1b, the `design.screen_reader` deliverable) already decides *what is
said and in what order* and §8 (lines 307–338) explicitly leaves the ARIA
*mechanics* — a visually-hidden text layer, `aria-label`s, `role` grouping,
the keyboard path — to this task. Choosing those mechanics is the work this
refinement orders; it does not amend the spec, the board, or DIRECTION.

## Inherited dependencies

- **`shell.chart`** — *settled* (`complete 100`),
  [`tasks/refinements/shell/chart.md`](chart.md). Gives the pure layout
  module `app/src/chart/layout.js` (`chartRows(model)` → ordered render rows,
  each sung segment carrying `{ chord, words, hyphen, token }`, each `token`
  an addressed `{ symbol, key, address }` from `tokenFor`, lines 62–69) and
  the view `app/src/chart/Chart.jsx` (host `role="group"` + `aria-label`,
  lines 172–183; `Segment` renders chord-then-words in DOM order, lines
  67–83; the `markOf(address)` seam and `markClass`, lines 38–41; the
  opt-in `onChordPress`/`chordLabel` arrange seam, lines 47–60). chart.md
  explicitly deferred the *designed* screen-reader reading order to this task.
- **`design.screen_reader`** — *settled* (`complete 100`),
  [`tasks/refinements/design/screen_reader.md`](../design/screen_reader.md).
  Produced the normative spec [`docs/screen-reader.md`](../../../docs/screen-reader.md),
  the board [`docs/mockups/Screen-reader.dc.html`](../../../docs/mockups/Screen-reader.dc.html)
  and the DIRECTION §6 bullet (lines 535–542). The spec's five
  `Announced text (exact)` fences are the strings this task pins.
- **`shell.diagram`** — not a `depends` edge, but the chord-diagram reading
  (§6) is already built there,
  [`tasks/refinements/shell/diagram.md`](diagram.md):
  `app/src/diagram/ChordDiagram.jsx` renders `role="img"` with the
  `describeFingering` sentence (`app/src/render/diagram.js` lines 186–231) as
  its accessible name and the kind word (*your shape* / *default*) as
  adjacent visible text, read in document order. diagram.md noted that
  `shell.a11y_chart` "later checks the full screen-reader reading order".
- **`foundation.e2e_web`** — *settled* (`complete 100`): the Playwright
  harness with phone/tablet/computer projects and the `checkA11y` axe
  fixture, which the e2e-web level runs in.

**Downstream.** This is the cross-cutting reading-order rule DIRECTION §6
(lines 541–542) says every chart-bearing screen obeys — the reading view
(`SongReading.jsx`), the conflict surface (`SongConflict.jsx`), arrange
(`SongArrange.jsx`), history and the editor's preview all render `<Chart>`
and inherit it. No later task re-opens it; `m4_together`
(`tasks/99-milestones.tji` line 44) depends on it.

## What this task is

The chart renders a song's chords, lyrics and measures as a proportional
visual face. A screen-reader user cannot see that face; read naïvely, the
markup would speak chord glyphs letter by letter ("C hash m seven"), the bar
rule as "pipe", underscore padding, and the chord line and lyric line as two
disconnected passes. `design.screen_reader` decided instead exactly what a
reader hears — a sung line interleaved chord-before-word-run in source order,
a chord spoken by its name, a chart line as its ordered measures, a diagram
by its fingering and whose shape it is, a conflict bounded by a word — and
left the ARIA mechanics open. This task implements those mechanics and checks
them: the view assembles, in the fixed order of `docs/screen-reader.md` §2–§7,
the spoken forms produced by two new framework-free modules, so the
accessibility tree reads each chart exactly as the spec's `Announced text`
fences say.

## Why it needs to be done

Until this lands, the chart is drawn correctly but reads wrongly: chart.md
shipped the visual face and host `role="group"`, but its chord tokens have no
spoken name (the arrange button's `chordLabel` is the raw symbol,
`SongArrange.jsx` line 319), the bar line is an undifferentiated row of
spans, and no mechanism replaces glyph text with the decided words. DIRECTION
§3.7 (lines 447–449) and `docs/screen-reader.md` §8 make every chart-bearing
screen's conformance — the right words in the right order, axe-clean at WCAG
2.1 AA — a requirement, and `design.screen_reader` deliberately produced no
code tests, handing the pinning of its exact strings to this task. Every
screen that embeds `<Chart>` is blocked from being accessible until the
reading order is real and checked.

## Inputs / context

Normative spec — the strings to assert, `docs/screen-reader.md`:

- **§1.2 (lines 72–76)** — "Announced text" joins tokens with `", "` (a comma
  and a space); the comma is the token boundary, its realisation this task's
  to choose. **§1.3 (lines 78–85)** — the single quotes around word-runs in
  worked examples are a documentation device, not part of the announced text.
- **§2.1–§2.2 (lines 93–125)** — the sung line: segments in source order,
  chord first then its word-run; MUST NOT read chord-line then lyric-line as
  two passes, MUST NOT drop chords. Exact: `G … D … Em` over "Quando eu te vi
  passar" → `G, Quando, D, eu te vi, E minor, passar`.
- **§3 (lines 131–155)** — the spoken chord name: by name, never glyphs.
  `Em`→`E minor`, `C#m7`→`C sharp minor seven`, `G/B`→`G over B`. In the home
  book's `notation` preference (cifra.md §5.6; workflow 16 lines 74–83), the
  same preference as the visible symbol, no per-chart control. Footnote
  marker (cifra.md §2.4): `Cm[2]`→`C minor footnote 2`; `Cm` and `Cm[1]`→`C
  minor` (index 1 is the bare key).
- **§4 (lines 157–182)** — padding silent, the centred hyphen silent (MUST
  NOT be read as "hyphen"), a split word read as pieces in source order, not
  reassembled. Exact: `W_hen` under `C`/`G` → `C, W, G, hen`.
- **§5 (lines 184–221)** — the chart line: expose measures as an ordered
  group (count + position announced), MUST NOT speak the `|` glyph, MUST NOT
  flatten into a run. Exact: `G | D | Em | C` → `G, D, E minor, C`; numbered
  bar (cifra.md §2.8) + no-chord (cifra.md §2.6) `@5 N.C. | C | G7` → `bar 5:
  no chord, C, G7`. A `.run`/intro line reads chords as a plain sequence, not
  an ordered measure group.
- **§6 (lines 223–254)** — the diagram: the `describeFingering` sentence
  (workflow 16 lines 67–72) + whose shape it is by word. Exact: a saved
  A-major shape → `A major, x02220, open position, fingers 2-1-3, root on the
  5th string, your shape`. Role word `your shape` (saved) or `default`; the
  song's own shape is unmarked. Starting fret is inside the sentence; the
  difficulty word is omitted here.
- **§7 (lines 265–305)** — the conflict: at entry announce by the word `needs
  you` + what conflicts in musical terms (chart line / voicing / property,
  workflow 9 lines 13–23); read content by its kind (§5 / §2); announce the
  region's **end** at exit (REQUIRED). Exact: user's version `G7 | C7 | F | F`
  → `needs you, conflict in the chart line, G7, C7, F, F, end of conflict`.
  §7.3: a shown default (`mark-def`) uses the same bounding with `default` at
  entry and `end of defaults` at exit. Raw git markers (cifra.md §11.12.2)
  live only in the monospace source editor, never spoken in the reading chart.
- **§8 (lines 307–338)** — the handshake: the renderer produces spoken chord
  names and `describeFingering` as framework-free labels and emits no padding
  or hyphen as accessible text; the view assembles the tokens in the §2–§7
  order; every chart-bearing screen passes axe WCAG 2.1 AA. `shell.a11y_chart`
  pins the exact strings across unit, behavior and e2e-web.

Governing documents: DIRECTION §6 lines 535–542 (the decided-and-drawn rule),
§3.7 lines 415–417 (the view is the only layer that knows React), lines
436–438 (chart stacking), lines 447–449 (axe on every chart-bearing screen),
§5 line 482 (the music core's accessible labels), §3.6 line 288 (app and
service share no code); workflow 16 (`docs/workflows/16-chord-explorer.md`)
lines 67–72 (`describeFingering`), 74–83 (notation dialect), 158–161 (axe);
workflow 9 (`docs/workflows/09-conflicts.md`) lines 13–23 (conflict kinds);
the board `docs/mockups/Screen-reader.dc.html` (registered in
`docs/mockups/canvas.json` at y:29960).

App seams this extends:

- `app/src/chart/layout.js` — `chartRows` (lines 173–186), the sung
  `{ chord, words, hyphen, token }` segments, `tokenFor` (lines 62–69,
  `token` carries `{ symbol, key, address }`), `chordText` (lines 27–42,
  the visible-glyph source for `nochord`→`N.C.`, numbered/`N.C.` handling),
  `SEGMENT_TYPES` (line 21). Already structures the model into rows; the
  reading module consumes these rows.
- `app/src/chart/Chart.jsx` — host `role="group"`/`aria-label` (lines
  172–183), `Segment` chord-then-words DOM order (lines 67–83), `ChordToken`
  (lines 47–60, `chordLabel(token) ?? token.symbol` default), `markClass`
  (lines 38–41), the `Row` switch over `section`/`sung`/`bars`/`run`/`words`/
  `gap` (lines 102–147).
- `app/src/render/diagram.js` — `describeFingering` (lines 186–231), the §6
  sentence; `app/src/diagram/ChordDiagram.jsx` — `role="img"` + kind word.
- `app/src/songs/SongConflict.jsx` — `markOf` returning `'conf'` for marked
  keys (line 192), the preview `<Chart … markOf={markOf} …>` (lines 97, 313);
  the §7.2 surface. `app/src/songs/SongArrange.jsx` — the interactive path
  (lines 379–385), `chordLabel = t('arrange.chordButton', { chord })` (line
  319), the §3-by-keyboard surface. `app/src/songs/SongReading.jsx` line 421
  — the plain reading surface that embeds the diagram (§6).
- i18n: `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`; `chart.label` at
  `en.js:820`. No `.visually-hidden`/`.sr-only` utility exists in the app's
  own CSS today (only comments noting React Aria's internal wrappers).

Test harness: `app/src/a11y/axe.js` (`checkWcag21aa`, tags
`wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`; contrast is a jsdom no-op);
`app/src/chart/layout.test.js` (unit, no DOM), `app/src/chart/Chart.behavior.test.jsx`
(the `render(<div className="est theme-current">…</div>)` root pattern,
`setLocale('en')` in `beforeEach`, fixtures parsed through the real `parse`
from `cifra-md`); `e2e/web/tests/chart.spec.js` driving `#dev/chart`;
`e2e/web/lib/axe.js` (`checkA11y`); `e2e/web/playwright.config.js` phone
(Pixel 7) / tablet (Galaxy Tab S4) / computer (Desktop Chrome) projects
(lines 39–43); the `#dev/chart`, `#dev/reading`, `#dev/arrange` hash mounts in
`app/src/App.jsx`.

## Constraints / requirements

- **The view is the only layer that knows React (DIRECTION §3.7 lines
  415–417).** The spoken chord name and the ordered announced tokens are
  produced by **framework-free** modules (new `app/src/render/chord-speech.js`
  and `app/src/chart/reading.js`) — no DOM, no React, no `cifra-md` import —
  mirroring the `layout.js` / `diagram.js` split. `Chart.jsx` is the only
  place that turns their output into ARIA.
- **The accessibility tree reads exactly the `Announced text` of §2, §4, §5,
  §6, §7, token-joined with `", "`.** No glyph that would mis-read (a chord
  symbol, `N.C.`, a numbered-bar marker) reaches the tree as text; no padding
  or centred hyphen reaches it at all; the `|`/measure rule is CSS border, not
  a character, and must stay so.
- **React Aria for every interactive part.** The chart stays non-interactive
  by default (chart.md); this task adds no new control. The one interactive
  surface it touches is arrange's existing React Aria `Button` chord tokens,
  whose accessible name becomes the §3 spoken name (routed through the same
  chord-speech module), so the keyboard path announces "E minor", not the
  glyph. No hand-rolled ARIA replaces a RAC control.
- **Status by a word, never colour alone** (mockups README line 26). The
  conflict and default regions already carry marking classes; this task adds
  the *word* — `needs you` / `conflict in the …` / `end of conflict`,
  `default` / `end of defaults` — as announced text, so the region's meaning
  never rides on `mark-conf`/`mark-def` colour.
- **axe at WCAG 2.1 AA** on every chart-bearing screen this task touches
  (DIRECTION §3.7 lines 447–449; `docs/screen-reader.md` §8). Behavior axe
  (jsdom, via `checkWcag21aa`) pins role/name/structure; contrast at AA is a
  jsdom no-op, pinned at e2e-web (via `checkA11y`, a real browser).
- **Canonical form over preserving content; no song text in logs; offline
  first; no book without an account** — named for completeness. The reading
  mechanism is a pure, network-free rendering of the already-loaded model
  (nothing waits on the network, §8 line 325), writes nothing, logs nothing;
  fixtures are songs written for the purpose. The dev-gallery mounts this
  task's e2e drives need no account or book.

## Acceptance criteria

**Behaviour delivered.**

- A new pure module `app/src/render/chord-speech.js` — `speakChord(chord,
  { notation, t })` decomposes a parsed chord into its spoken name per §3:
  root and accidental in the notation preference that matches the visible
  symbol, quality/interval/bass/footnote as locale words. `E minor`,
  `C sharp minor seven`, `G over B`, `C minor footnote 2`; `Cm`/`Cm[1]`→`C
  minor`.
- A new pure module `app/src/chart/reading.js` — given a `chartRows` row and a
  `speakChord`, `announce(row)` returns the `", "`-joined announced string and
  `readingTokens(row)` the token array, per §2 (sung: chord-then-word-run in
  source order), §4 (split word as pieces; padding and centred hyphen contribute
  nothing), §5 (bars as ordered measures, numbered-bar `bar N:` prefix, `N.C.`→
  `no chord`; a `.run` line as a plain chord sequence). Plus `regionAnnouncement(mark)`
  → `{ enter, exit }` for §7: `'conf'` (with a musical-terms phrase from the
  consumer) and `'def'`.
- `app/src/chart/Chart.jsx` realises the tokens: each chord `.c` glyph is
  `aria-hidden` with its spoken name carried by an adjacent visually-hidden
  text node placed before the word-run, so a segment reads "E minor, passar";
  the centred-hyphen `.fill` and any padding stay out of the tree; a chart
  line's `.barline` becomes an ordered list (`role="list"`, each `.m` a
  `role="listitem"`, its `N.C.`/numbered glyph hidden and spoken form
  supplied) so the count and position announce; a `.runline` stays a plain
  sequence (no list); a contiguous run of rows sharing a `'conf'`/`'def'`
  mark is wrapped in a bounded `role="group"` whose entry phrase and trailing
  visually-hidden exit text come from `regionAnnouncement`. Host stays
  `role="group"`.
- Arrange's chord buttons announce the spoken name: `Chart.jsx`'s default
  `chordLabel` becomes `speakChord`, and `SongArrange.jsx` routes its button
  label through it (replacing the raw-symbol `arrange.chordButton`), so a
  keyboard user hears "E minor, button".
- The diagram's §6 reading is unchanged in `ChordDiagram.jsx` (already
  `describeFingering` + kind word); this task composes and pins the role-word
  order.
- Spoken-word strings (`chord.spoken.*` — minor/major/sharp/flat/over/
  diminished/augmented/the interval numbers/footnote, and the region words)
  added to all four locale catalogues (`app/src/i18n/locales/{en,pt-BR,
  es-419,it}.js`); catalogue completeness across the four languages is pinned
  by `shell.i18n`, not re-pinned here. A `.visually-hidden` utility class
  added to the chart's CSS.

**Tests the task lands with, by level.**

- **unit — `app/src/render/chord-speech.test.js`** and
  **`app/src/chart/reading.test.js`** (Vitest, no DOM): `speakChord` returns
  the §3 strings — `Em`→`E minor`, `C#m7`→`C sharp minor seven`, `G/B`→`G over
  B`, `Cm[2]`→`C minor footnote 2`, `Cm`/`Cm[1]`→`C minor` — in English with
  the default notation; `announce` returns `G, Quando, D, eu te vi, E minor,
  passar` for the §2.2 sung line, `C, W, G, hen` for the §4 split word (padding
  and hyphen silent), `G, D, E minor, C` for the §5 chart line and `bar 5: no
  chord, C, G7` for the numbered + `N.C.` line, a `.run` line as a plain chord
  sequence; `regionAnnouncement` returns `{ enter: 'needs you, conflict in the
  chart line', exit: 'end of conflict' }` for a chart-line conflict and
  `{ enter: 'default', exit: 'end of defaults' }` for a default; and the
  diagram's §6 string composes from `describeFingering` + the kind word.
  *Pins:* "the reading-order text of a sung line, a chart, a diagram and a
  conflict" (`.tji` note); `docs/screen-reader.md` §2.2, §3, §4, §5, §6, §7.2,
  §7.3; cifra.md §2.4/§2.6/§2.8/§5.6 as those sections cite them.
- **behavior — `app/src/chart/Chart.a11y.behavior.test.jsx`** (Vitest +
  Testing Library, rendered under a `theme-current` root): corpus-free songs
  written for the purpose, parsed through the real reader; the sung line's
  accessible text content reads chord-then-word-run in order with the spoken
  name and no hyphen/padding; a chart line exposes `getAllByRole('listitem')`
  of the right count with the spoken measure content and no `|` in the tree; a
  `'conf'`-marked run is a `role="group"` named by the §7.2 entry phrase with
  the exit phrase present; axe-clean via `checkWcag21aa` across the
  unmarked, conflict and default cases. A companion case renders the arrange
  path (`onChordPress`) and asserts each chord `Button`'s accessible name is
  the spoken chord name (`getByRole('button', { name: 'E minor' })`).
  *Pins:* "accessible names as design.screen_reader decided, Testing Library
  and axe" (`.tji` note); `docs/screen-reader.md` §2, §4, §5, §7; DIRECTION
  §3.7 lines 447–449. Axe here pins role/name/structure — the rules that run
  under jsdom; contrast at AA is a jsdom no-op, pinned at e2e-web.
- **e2e-web — `e2e/web/tests/a11y-chart.spec.js`** (Playwright against the
  compose stack, on the phone, tablet and computer projects): at `#dev/chart`,
  read the worked charts through the accessibility tree
  (`page.accessibility.snapshot()` / role-and-name locators) and assert the §2,
  §4 and §5 announced strings and the measure list on all three viewports;
  drive arrange (`#dev/arrange`) by keyboard — Tab to a chord button and
  assert its accessible name is the spoken chord name — on all three viewports;
  `checkA11y` at WCAG 2.1 AA on each, in Estante light and Palco dark (contrast
  runs here in a real browser). The diagram's §6 reading and the §7 conflict
  region, embedded on their owning screens, are asserted where the existing
  `reading.spec.js` and `conflicts.spec.js` reach them.
  *Pins:* "a chart read through the accessibility tree and by keyboard on the
  three viewports" (`.tji` note); `docs/screen-reader.md` §2/§4/§5/§6/§7, §8
  (every chart-bearing screen axe-clean).

**e2e-api** does not apply — no HTTP or git surface. **No deferred WBS leaf.**
Every level the note names lands here; the diagram seam (§6) and the arrange
button and conflict surfaces are existing downstream screens this task
extends, not new tasks. Nothing is deferred; the §7.3 default region's visual
wiring attaches wherever a surface shows a `mark-def` (none does today), and
its wording is pinned at the unit level regardless, so no follow-up is owed.

## Decisions

- **The spoken forms come from two new framework-free modules, not from the
  view.** `app/src/render/chord-speech.js` (spoken chord name) sits beside
  `diagram.js`'s `describeFingering`; `app/src/chart/reading.js` (ordered
  announced tokens) sits beside `layout.js`. *Rationale:* DIRECTION §3.7 lines
  415–417 and `docs/screen-reader.md` §8 (the renderer produces the labels,
  the view assembles them) split the music core from React; the pure modules
  are unit-testable against the exact strings with no DOM, exactly as
  `layout.js` and `chord-diagram.js` are. *Alternative rejected:* build the
  strings inside `Chart.jsx` — couples the spec's wording to React, makes the
  §2–§7 strings only testable through a render + accessibility snapshot, and
  violates the layer boundary.
- **The accessibility tree is driven by visually-hidden spoken text + hidden
  glyphs, interleaved in reading order — not by `aria-label` on the glyph
  spans, nor by one parallel duplicate-text block.** Each chord `.c` keeps its
  visible glyph as an `aria-hidden` child and gains a `.visually-hidden`
  sibling carrying the spoken name, placed in the fixed order before the
  word-run. *Rationale:* `aria-label` on a non-semantic `<span>` is honoured
  inconsistently across assistive technology, whereas a visually-hidden text
  node + `aria-hidden` on the presentation is the robust, AT-agnostic pattern
  and keeps the exact `", "`-joined string the spec demands; interleaving
  per-token (rather than one hidden paragraph per line) lets the real list and
  region *structure* carry §5's count-and-position and §7's bounding, which a
  flat duplicate block would flatten away. *Alternatives rejected:* (a)
  `aria-label` on each `.c`/`.m` — unreliable announcement, and axe would not
  catch the AT variance; (b) a single visually-hidden sentence per chart with
  the whole chart `aria-hidden` — loses §5's "ordered group (count + position
  announced)" and §7's required entry/exit framing, and duplicates every
  string.
- **A chart line is a `role="list"` of `role="listitem"` measures; a run line
  is not.** *Rationale:* §5 requires measures exposed as an ordered group with
  count and position announced and forbids flattening into a run, while a
  `.run`/intro line must read as a plain sequence — `list`/`listitem` is the
  built-in accessible answer (the AT announces "list, 4 items, item 1 …") and
  `listitem` is the required child of `list`, so it is axe-clean (unlike a
  `role="list"` of interactive buttons, which fails `aria-required-children`
  — the known trap recorded for button-row lists). *Alternative rejected:* a
  bare row of spans with positions in hidden text — re-implements what the
  list role gives for free and does not announce the group's count.
- **A conflict/default region is a bounded `role="group"` that `Chart.jsx`
  wraps around a contiguous run of marked rows; the musical-terms phrase comes
  from the consumer.** The `markOf` seam may return the mark plus an
  announcement; `SongConflict.jsx` supplies "conflict in the chart line /
  voicing / property" (workflow 9 lines 13–23), and `reading.js` supplies the
  generic fallback and the `needs you` / `end of conflict` (and `default` /
  `end of defaults`) words. *Rationale:* §7 requires an entry word + what
  conflicts *and* an explicit end-of-region announcement; only `Chart.jsx`
  knows row adjacency (the region can span several marked rows), so the
  bounding belongs there, while chart.md's rule that "Chart derives nothing
  from the model" means the specific musical-terms phrase must come from the
  consumer that computed the mark. The trailing visually-hidden exit text
  gives the REQUIRED end announcement, which `role="group"` alone does not
  reliably speak. *Alternative rejected:* wrap the region entirely in
  `SongConflict.jsx` outside `<Chart>` — the conflicted rows are interleaved
  with unmarked rows inside one chart, so an outer wrapper cannot bound just
  the conflicted run.
- **Arrange's chord-button accessible name is routed through `speakChord`.**
  *Rationale:* §3 is "wherever a chord is announced", and arrange's React Aria
  `Button`s are the chart's keyboard surface — the note's "by keyboard" is
  only meaningful there; today their name is the raw symbol
  (`arrange.chordButton`), which a keyboard user hears spelled out. Making
  `Chart.jsx`'s default `chordLabel` be `speakChord` fixes both the arrange
  buttons and any future interactive chord with one seam. *Alternative
  rejected:* a separate spoken-label prop for arrange — two sources of the
  same string that can drift from the §3 spec.
- **The chord diagram's §6 reading is reused as-is from `shell.diagram`, not
  re-derived.** *Rationale:* diagram.md already renders `role="img"` with the
  `describeFingering` sentence and the kind word as adjacent visible text read
  in document order; §6's string is that sentence plus the role word, which
  already composes correctly. This task only *pins* it (unit composition +
  e2e tree) and composes the role word into the announced order. *Alternative
  rejected:* fold the role word into the `aria-label` — diagram.md rejected
  this to avoid a double announcement; re-opening it would contradict a
  settled decision.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-13.

- New framework-free module `app/src/render/chord-speech.js` — `speakChord(chord, { notation, t })` produces §3 spoken names (`Em`→`E minor`, `C#m7`→`C sharp minor seven`, `G/B`→`G over B`, `Cm[2]`→`C minor footnote 2`), paired with `app/src/render/chord-speech.test.js` (5 unit tests).
- New framework-free module `app/src/chart/reading.js` — `announce(row)` / `readingTokens(row)` per §2/§4/§5 and `regionAnnouncement(mark)` per §7, paired with `app/src/chart/reading.test.js` (11 unit tests covering §2.2, §4, §5, §6 composition, §7.2/§7.3).
- `app/src/chart/Chart.jsx` — ARIA mechanics: chord glyphs `aria-hidden` with adjacent `.visually-hidden` spoken names; `.barline` rows become `role="list"` / `role="listitem"` measure groups; conflict/default contiguous runs wrapped in bounded `role="group"` with entry/exit text; default `chordLabel` is now `speakChord`.
- `app/src/chart/layout.js` (+`layout.test.js`) — `voice` field per segment slot, `numbers` field per bar; 18 new unit tests.
- `app/src/songs/SongArrange.jsx` (+`SongArrange.behavior.test.jsx`) and `SongConflict.jsx` — arrange buttons route accessible names through `speakChord`; conflict surface supplies §7 musical-terms phrase.
- `app/src/songs/SongReading.behavior.test.jsx` — updated for new ARIA shape.
- `app/src/chart/gallery/{fixtures.js,ChartGallery.jsx}` — new dev-gallery fixtures for the a11y e2e drive.
- `app/src/theme/theme.css` — `.visually-hidden` utility class added.
- All four `app/src/i18n/locales/*.js` — `chord.spoken.*`, `chart.spoken.*`, `songConflict.spoken.*` added.
- `e2e/web/tests/{arrange,reading}.spec.js` — updated for spoken names; `e2e/web/tests/a11y-chart.spec.js` (new) pins §2/§4/§5 tree reads + arrange keyboard on all three viewports with axe at WCAG 2.1 AA in Estante light and Palco dark.
