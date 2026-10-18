# songs.arrange_polish — Arrange and the wizard as drawn

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task arrange_polish "Arrange and
the wizard as drawn"` (in `songs`). Wired into `milestones.m5_complete`'s
`depends` in [`tasks/99-milestones.tji`](../../99-milestones.tji) line 44.

## Effort estimate

2d (the `.tji` estimate). Roughly: ½d the chip and its overlay in arrange,
1d entering a shape as a screen of arrange with the role read-out (a pure
module, the shared builder, arrange's host), ½d the wizard's computer split
and its *Back*.

## Repository

Not under `cifra.md/` (the note does not start with `cifra.md:`). The work
lands in the app and its harness:

- `app/src/songs/` — `SongArrange.jsx`, `arrange.css`, `SongWizard.jsx`,
  `wizard.css`, their behavior tests;
- `app/src/music/` — `EnterShape.jsx` (the shared builder), `music.css`, a new
  pure `shape-readout.js` + `shape-readout.test.js`, `EnterShape.behavior.test.jsx`;
- `app/src/instruments/InstrumentChip.jsx` (a label prop);
- `app/src/shell/layout-mode.js` (+ `layout-mode.test.js`), `AppShell.jsx`
  (the wizard's close also leaving arrange from *Done*);
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`;
- `e2e/web/tests/arrange.spec.js`, `e2e/web/tests/wizard.spec.js`, and
  `e2e/web/lib/journeys-core.js` where a helper's locator changes.

Design delta (written with this refinement, rides in the closer's commit):
`docs/workflows/05-arrange-for-an-instrument.md` lines 28-33 (the chip),
43-51 (*Enter a shape* as a screen with the role read-out), 91-93 (the wizard
beside the chart on a computer, *Back*); `docs/workflows/16-chord-explorer.md`
lines 149-156 (the shared builder: a dialog in the explorer, a screen in a
song, roles named).

## Inherited dependencies

All settled:

- `songs.arrange` — complete 100. `SongArrange.jsx`, the picker as a RAC
  sheet, `EnterShape` mounted in it with a configurable `primary`
  (arrange.md D1, D4, D6).
- `songs.wizard_ui` — complete 100. `SongWizard.jsx` mounted by `AppShell`
  over arrange, the preview in memory until *Write the plan*, new-first /
  over-second (wizard_ui.md D1-D4).

Landed alongside and relied on (all complete): `shell.header_chrome`
(`chipLabel`, `chipDescription`, one chip per screen — its D7; the W16 long
chip replaced by the short label in workflows 01/15/16), `songs.reading_chrome`
and `songs.editor_chrome` (the pattern: measured boxes + `mockup()` + axe,
`app/src/test/widths.js`'s `installWidths`, named 1080px queries in
`layout-mode.js`), `music.instruments_layout` (a non-switching mention in
chip styling, its D5).

## What this task is

Bring arrange mode, entering a shape by hand, and the voicing wizard into line
with the W05 board, as the 2026-10-14 UI audit found them apart:

1. **The chip.** Arrange's header carries a plain `<span class="chip accent">`
   reading `Arranging · {instrument}` and no instrument chip. Make the mode
   chip *the* instrument chip: the shared `InstrumentChip` (a RAC `Button`,
   the full identity as its description), labelled `Arranging · Guitar`,
   opening the instruments overlay from arrange as it does from reading.
2. **Enter a shape, inline.** In a song it is a centred modal stacked over the
   picker sheet. The board (W05#3, tablet) draws it as a screen of arrange:
   app bar Back · *Enter a shape for Cm* · chip; a context line plus the
   board's help text; the big diagram; *Notes it holds* with the summary
   (`C · E♭ · G · A♭`) and one row per string — string (`A2`, `E4 · high E`),
   fret, note, and a badge with the note's **chord-tone role** (`root`,
   `fifth`, `minor third`) or `not in Cm`; a conflict notice spelling out the
   foreign notes; *Cancel* / *Choose this shape*. The explorer keeps its
   dialog but the shared builder gains the same read-out.
3. **The wizard on a computer.** It takes the whole screen; the board (W05#4)
   sits it in a 380px side pane beside arrange's chart, which previews the
   plan. Its step back reads `← Other ways`; the board says **Back**.

## Why it needs to be done

`milestones.m5_complete` depends on it: the first pass, complete, is the app as the boards
draw it. Workflow 15 §The roster, and switching (lines 62-69) puts the
instrument chip in the header everywhere, and arrange is the one song screen
without it — while switching instrument re-derives the arrange picker's
ranking (lines 80-83), which presumes the switch is reachable there. The role
read-out is how a by-hand shape tells the player what it holds (workflow 16
§Entering a shape by hand), and the board's computer split is what lets a
player see the plan on the chart they will play from before writing it.

## Inputs / context

Governing documents:

- **Board** `docs/mockups/W05-arrange.dc.html` — frames in
  `e2e/web/lib/mockup-frames.json` lines 147-170:
  - #1 phone (lines 28-65): app bar Back · *Tarde Clara* · **Done**, chip
    `Arranging · Guitar` (line 37), hint *Tap a chord to choose its shape*.
  - #2 phone (lines 67-115): the picker sheet, *Enter a shape* row at the top
    of the results (line 101).
  - #3 tablet (lines 120-160): *Enter a shape for Cm* as a screen; app bar
    Back, title, chip (line 127 draws `Guitar · E A D G B E`, superseded by
    header_chrome's short label: `Guitar`); line 130 the context + help
    copy; lines 140-141 *Notes it holds* / `C · E♭ · G · A♭`; rows from the
    data at lines 274-281; line 151 the notice; lines 154-155 Cancel /
    *Choose this shape*.
  - #4 computer (lines 164-231): `.split`, `.pane.side` 380px with *Voicing
    wizard* / *The plan is ready* / the two option cards / *Either way…* /
    **Back** · *Write the plan* (lines 168-190); `.pane.main` with app bar
    *Tarde Clara* · `Arranging · Guitar` · *Done* (195-197), the variation
    row, *Preview of the plan* (203), the chart at `--chart-size: 20px` and a
    300px *Shapes · Up the neck* column (217).
- **Workflow 5** `docs/workflows/05-arrange-for-an-instrument.md` §Arranging
  is a mode (14-33, with this task's delta at 28-33), §Choosing a shape
  (35-51, delta 43-51), §The wizard (80-93, delta 91-93).
- **Workflow 15** `docs/workflows/15-set-up-an-instrument.md` lines 62-69 (the
  chip's one short label, full identity as its description), 80-83.
- **Workflow 16** `docs/workflows/16-chord-explorer.md` §Entering a shape by
  hand (147-160, delta 149-156).
- `docs/mockups/README.md` line 26 — every status badge carries a word.

Code (line numbers as of `46fb914`):

- `app/src/songs/SongArrange.jsx` — `instrumentLabel` (137,
  `chipLabel(entry) || t('search.instrument')`), the app bar (366-377; the
  plain mode chip at 373), the picker modal (409-473), `EnterShape` mounted
  in it (454-460) with `enterPrimary` (302-316).
- `app/src/music/EnterShape.jsx` — `stringNote` (41-48, keeps only the
  spelled note), `readoutLabel` (50-59), `ShapeBuilder` (64-162; read-out
  117-129), the `DialogTrigger` › `Modal className="dialog enter-shape"`
  (182-212).
- `app/src/core/chord.js` — `chordTones(c)` (123) returns `{degree, alter,
  spelled, pitchClass, role}`; `QUALITIES` (49-57) give the alters (minor
  third = degree 3 alter −1).
- `app/src/instruments/InstrumentChip.jsx` (21-43); `instrument-helpers.js`
  `inUseEntry` (23), `chipLabel` (139), `chipDescription` (153).
- `app/src/songs/SongReading.jsx` — how a song screen mounts the chip and
  `InstrumentsOverlay` (chip 663/769, overlay 753/777/808); its
  `READING_ACTIONS_WIDE_QUERY` subscription (62, 81).
- `app/src/songs/SongWizard.jsx` — the action bar (419-436; `wizard.back` at
  427), the full-screen root (438-460); `wizard.css` 23-28 (the in-screen
  grid on `wizard-wide`).
- `app/src/shell/AppShell.jsx` — the wizard mount (1207-1221) checked before
  arrange (1224-1242); `layout-mode.js` (`WIDE_QUERY` 600px, the 1080px
  per-surface queries).
- Locales: `app/src/i18n/locales/en.js` `arrange.*` (1585-1626;
  `arrange.modeChip` 1588 — the note's "line 1200" predates later
  additions), `explorer.enter.*` (596-613: `help`, `readout` *What it sounds*,
  `foreign` *not in the chord*), `wizard.back` (2095, `← Other ways`); the
  same keys in `pt-BR.js` (1426, 1932), `es-419.js` (1427, 1934), `it.js`
  (1427, 1936).
- Tests: `app/src/songs/SongArrange.behavior.test.jsx` (mode chip 168-177;
  *Enter a shape* 232-275, the dialog named *Enter a shape for Cm* at 239),
  `app/src/songs/SongWizard.behavior.test.jsx` (describes at 171, 204, 240,
  289, 357, 410), `app/src/music/EnterShape.behavior.test.jsx` (58, 91, 110);
  `e2e/web/tests/arrange.spec.js` (34 with `mockup` W05 #1/#2 at 42/48; 57
  the by-hand dialog with `mockup` W05 #3 at 73), `e2e/web/tests/wizard.spec.js`
  (30 with `mockup` W05 #4 at 39; 69; 97), `e2e/web/lib/journeys-core.js`
  (`enterArrange` 35 waiting on `/Arranging ·/` at 43; `chip` 93;
  `addInstrument` 102; `toPreview` 134), `e2e/web/lib/mockup.js` 45.

Predecessor decisions carried: arrange.md D1 (arrange is its own surface), D2
(writes go through `WRITE`), D6 (`EnterShape`'s configurable primary);
wizard_ui.md D1 (`SongWizard` its own component), D2 (preview in memory),
D5 (the view never re-plans); header_chrome D7 (exactly one
`/change instrument/` button per screen), D8 (deep screens keep their app bar,
no wordmark); instruments_layout D5 (a non-switching instrument mention is
plain text in chip styling, never a dead button).

## Constraints / requirements

- **The view is the only layer that knows React; the Worker owns the data**
  (DIRECTION §3.7). No new Worker command: a shape chosen on the new screen
  goes through arrange's existing apply → `write` → `WRITE` path, exactly as
  a listed candidate does (arrange.md D2).
- **The music stays in pure modules.** The role words, string names, the
  *Notes it holds* summary and the foreign list are computed by a new pure
  `app/src/music/shape-readout.js` over `chordTones` and the tuning — no
  React, no DOM, unit-tested. `ShapeBuilder` renders what it returns. No new
  chord-theory: roles come from `chordTones`' `degree`/`alter`.
- **One chip per screen** (header_chrome D7): arrange has one
  `/change instrument/` button — the mode chip; the enter-a-shape screen and
  the wizard's main pane show a non-interactive mention in chip styling
  (Decision 3).
- **Accessibility:** React Aria for every control (the chip `Button`, the
  screen's Back / Cancel / Choose, the wizard pane's controls); keyboard path
  through the new screen and back to the picker, focus returned to the *Enter
  a shape* row on Back/Cancel and to the chord pressed on Choose; every role
  and the foreign mark is a word (`root`, `not in Cm`), never colour alone;
  axe clean at WCAG 2.1 AA on every state.
- **Copy in all four locales**, translated, `i18n.test.js` parity kept;
  board copy where the board has it.
- **Canonical form** is untouched: this task only changes how choices are
  presented; what is written is what arrange already writes.
- **Offline first:** nothing here touches the network; the existing offline
  e2e cases (`arrange.spec.js` 229, `wizard.spec.js` 97) must stay green.
- Test fixtures stay the purpose-written songs the specs already use (the
  example book's *Choro da Chuva* chart with `Cm`, `SONG` in
  `journeys-core.js`) — no copyrighted words.

## Acceptance criteria

### Behavior delivered

1. **The chip names the instrument and is the instrument chip.**
   `InstrumentChip` takes an optional `labelFor(label)` (or `prefix`) so
   arrange renders it as `Arranging · {chipLabel}` with
   `instr.chip.change` → *Arranging · Guitar, change instrument* as its name
   and `chipDescription` as its description. The `t('search.instrument')`
   fallback goes (the Worker always sends the standard entry; `inUseEntry`
   never returns null once the slice is loaded — render the chip only once
   it is). Pressing it opens `InstrumentsOverlay` from `SongArrange`, as
   `SongReading` does; switching re-renders arrange for the new tuning (its
   chart marks, shapes strip and picker ranking).
2. **Enter a shape is a screen of arrange.** In the picker, the *Enter a
   shape* row (arrange's host) is a plain row `Button` that closes the picker
   and opens the screen — no `ModalOverlay` in arrange's path. The screen, on
   every viewport, replaces arrange's body under its own app bar: Back
   (`arrange.back`) · *Enter a shape for {chord}* (an `h1`) · the
   non-interactive instrument mention; the context line
   `{song} · {section}, bar {n} · {scope}` (scope *only here* / *every Cm*,
   from the picker's segmented choice); the help *Tap a string at a fret to
   place a finger; tap above the nut to mute or open it.*; the builder; the
   notice; *Cancel* / *Choose this shape*. Back and Cancel return to arrange
   with the picker reopened on the same occurrence and scope, focus on the
   *Enter a shape* row; *Choose this shape* writes as a listed candidate does
   (every Cm → the key; only here → the `Cm[n]` footnote per arrange.md, with
   [[only-here-needs-prechosen-key]]'s branch kept), returns to arrange with
   the picker closed and focus on the chord. Wide layouts put the diagram
   card and the read-out side by side (W05#3); the phone stacks them.
3. **The read-out names roles.** Shared by both hosts (`ShapeBuilder`): the
   heading *Notes it holds*; the summary line — the distinct notes sounded,
   the chord's tones first in chord order then the foreign ones in string
   order, low to high, joined by ` · ` (`C · E♭ · G · A♭`); one row per
   string low to high: the string's name (its pitch with octave, `A2`;
   `· low E` / `· high E` added when two strings share a letter, the lowest
   and highest — a tuning with three or more of one letter falls back to the
   pitch alone), the fret (*muted*, *open*, *fret 3*), the note (`—` when
   muted), and a badge: the role word, or *not in {chord}* (`badge conflict`)
   for a foreign note. Role words from `degree`/`alter`: 1 *root*; 3 −1
   *minor third*, 0 *major third*; 2 *second*; 4 *fourth*; 5 −1 *flat
   fifth*, 0 *fifth*, +1 *sharp fifth*; 6 *sixth*; 7 −2 *diminished
   seventh*, −1 *minor seventh*, 0 *major seventh*; 9 −1 *flat ninth*, 0
   *ninth*, +1 *sharp ninth*; 11 0 *eleventh*, +1 *sharp eleventh*; 13 −1
   *flat thirteenth*, 0 *thirteenth* (any other pair: the degree's ordinal
   word with *flat*/*sharp*). When any note is foreign, a `notice conflict`
   says *The A♭ on the high E string is not in Cm, which is C, E♭ and G. You
   can still choose this shape.* — several foreign notes joined with
   `Intl.ListFormat` (as editor_chrome's `search.searchedIn`), the string
   named by its letter (*the A string*, *the high E string*). The unplayable
   message stays as is. The radios' accessible names
   (`explorer.enter.setFret` etc.) are unchanged. The explorer's dialog takes
   the board's help copy too (one `explorer.enter.help`).
4. **The wizard on a computer sits beside the chart.** At a new
   `ARRANGE_WIDE_QUERY = '(min-width: 1080px)'` in `layout-mode.js`
   (subscribed as `SongReading` subscribes `READING_ACTIONS_WIDE_QUERY`),
   `SongWizard` renders a `.split`: a 380px `.pane.side` with the wizard's
   head (a close `Button`, `wizard.cancel`, beside *Voicing wizard*), its
   steps and its action bar at the pane's foot; and a `.pane.main` dressed as
   arrange — app bar with the song's title, the non-interactive `Arranging ·
   Guitar` mention and **Done** — holding *Preview of the plan* and the
   song's `Chart` at size 20 with the plan's shapes in a *Shapes ·
   {target variation}* column (the typed name for *into a new variation*, the
   in-use variation for *over*); in the policy step the main pane shows the
   chart with the variation's current shapes. **Done** closes the wizard and
   arrange together, back to reading (nothing was written — wizard_ui D2).
   Below 1080px the wizard keeps its current full-screen layout (tablet's
   in-screen grid at `mode === 'wide'`, phone stacked).
5. **Back.** `wizard.back` reads **Back** — *Voltar* (pt-BR), *Volver*
   (es-419), *Indietro* (it), no arrow — and still returns to the policy
   step.

### Tests, by level

The prerequisites all exist: arrange and the wizard (both complete), the
example book and its `Cm` song via `openExampleBook`/`openSongFromSearch`,
`enterArrange`, `picker`, `toPreview`, `chip`, `addInstrument` in
`e2e/web/lib/journeys-core.js`, `installWidths` in `app/src/test/widths.js`.
No `#dev/*` mount, no injected state.

**unit**

- `app/src/music/shape-readout.test.js` — role words for every pair in
  criterion 3 (Cm's `minor third`, C7's `minor seventh`, Cmaj7's `major
  seventh`, Cdim7's `diminished seventh`, C7♭9's `flat ninth`, Cm7♭5's `flat
  fifth`) and the ordinal fallback; string names for standard guitar (`E2 ·
  low E`, `E4 · high E`, `A2` bare), cavaquinho D G B D (`low D` / `high D`)
  and a tuning with three of a letter (bare pitches); the summary order for
  Cm `x35544` (`C · E♭ · G · A♭`); the foreign list naming *the high E
  string*. Pins workflow 16 §Entering a shape by hand and board W05#3 lines
  141, 151, 274-281.
- `app/src/shell/layout-mode.test.js` — `ARRANGE_WIDE_QUERY` is 1080px
  (pins W05#4 as a computer-only split).

**behavior** (each state with `checkWcag21aa`)

- `app/src/songs/SongArrange.behavior.test.jsx`, describe *the mode chip*
  (replaces 168-177): exactly one `/change instrument/` button, named
  *Arranging · Guitar, change instrument*, its description the full identity;
  with a cavaquinho entry in use it reads *Arranging · Cavaquinho*; pressing
  it opens the instruments overlay; axe. Pins workflow 15 lines 62-69 and
  the workflow 5 delta lines 28-33.
- same file, describe *entering a shape inline* (replaces 232-275): from the
  picker on `Cm` with *Only here*, *Enter a shape* leaves no dialog open
  (`queryByRole('dialog')` null) and shows the heading *Enter a shape for
  Cm*, the context line ending *only here*, the help copy; entering
  `x35544` reads rows `A2 · fret 3 · C · root`, `D3 … G · fifth`, `B3 … E♭ ·
  minor third`, `E4 · high E … A♭ · not in Cm`, the summary `C · E♭ · G ·
  A♭` and the notice; Back reopens the picker on `Cm` with *Only here* still
  on and focus on *Enter a shape*; *Choose this shape* sends one `WRITE`
  carrying the shape and focus lands on the chord; a keyboard-only pass
  (Tab/arrow/Enter) through the screen; axe on the screen with the notice.
  Pins the workflow 5 delta lines 43-51 and W05#3.
- `app/src/music/EnterShape.behavior.test.jsx` (extends 58): the explorer's
  dialog reads *Notes it holds*, the role badges and *not in {chord}*, the
  board's help copy, axe. Pins workflow 16 lines 149-156 (the shared
  builder).
- `app/src/songs/SongWizard.behavior.test.jsx`, new describe *the computer
  split* (with `installWidths` at 1280): the side pane holds the plan step's
  radiogroup and **Back** / *Write the plan*; the main pane holds the title,
  `Arranging · Guitar`, *Done*, *Preview of the plan*, the chart and the
  *Shapes · Up the neck* column after typing that name; *Done* calls the
  close that leaves arrange too, with no `WRITE`; at 700 the layout is the
  existing one; **Back** (not *Other ways*) returns to the policy step in
  both; axe in both. Pins the workflow 5 delta lines 91-93 and W05#4.

**e2e-web** (the three Playwright projects; `checkA11y()` on every screen)

- `e2e/web/tests/arrange.spec.js`, *arranges a song for guitar* (34) extended:
  the header's one chip reads `Arranging · Guitar` on phone, tablet and
  computer and opens the instruments; after `addInstrument` (cavaquinho)
  and switching from that chip, it reads `Arranging · Cavaquinho`. Mockup
  W05 #1/#2 kept.
- same file, *only here warns, and a shape by hand can be chosen* (57)
  reworked: *Enter a shape* opens a screen, no dialog; the A♭ row reads *not
  in Cm* and the others their roles; the notice is visible; on the tablet
  the diagram card and the read-out sit side by side (measured boxes, no
  `overlaps` from `e2e/web/lib/fit.js`); `mockup(page, 'W05-arrange', 3)`
  then axe; *Choose this shape* writes it and arrange shows it. Three
  viewports.
- `e2e/web/tests/wizard.spec.js`, new *on a computer the wizard sits beside
  the chart*: via `toPreview`, the side pane's right edge ≤ the chart's left
  edge and both visible without scrolling on the computer; on phone and
  tablet the wizard is the full screen as before (the branch asserts the
  split is absent); **Back** returns to the planners on all three;
  `mockup(page, 'W05-arrange', 4)` moved here from line 39 (or kept there,
  once) then axe. Existing 30/69/97 stay green with `wizard.back`'s new name
  in any locator.

No e2e-api: nothing here crosses the service.

## Decisions

1. **The mode chip is the instrument chip, carrying the mode.** Alternatives:
   two chips (*Arranging* plus *Guitar*) — the board draws one, and
   header_chrome D7 holds one per screen; keep the span and add an
   `InstrumentChip` beside it — two chips again. One `InstrumentChip` with a
   label prop reuses the shared seam and makes switching reachable in
   arrange, which workflow 15 lines 80-83 presume.
2. **Enter a shape is a screen of arrange on every viewport, not a modal.**
   The board draws it as a full screen with its own app bar (W05#3); a modal
   over a sheet is the stacked overlay the audit flagged. The board draws only
   the tablet; the phone gets the same screen (a big diagram needs the room),
   and the computer too (one presentation, one test path) — rejected: a third
   pane on the computer, which the board never draws. Back returns to the
   picker as it was rather than to bare arrange, because the user came from
   choosing among the listed shapes.
3. **Inside a step, the instrument is a mention, not a switch.** The enter-a-
   shape screen and the wizard's main pane name the instrument in chip
   styling but do not open the instruments: a shape half-entered on six
   strings, or a plan planned for one tuning, would be invalidated by a
   switch. instruments_layout D5 is the precedent (no dead or dangerous
   control). The board's tablet chip `Guitar · E A D G B E` follows
   header_chrome's delta to the short label.
4. **The explorer keeps its dialog; the builder's read-out is shared.**
   Workflow 16 makes it "the same affordance"; the presentation differs by
   host (a dialog over results there; a step of a mode here) but the
   read-out, help copy and roles are one `ShapeBuilder` fed by one pure
   module, so they cannot drift. Rejected: role badges only in arrange — the
   two would disagree on the same shape.
5. **Role words, not symbols.** The board writes `root`, `fifth`, `minor
   third`; symbols (`R`, `♭3`) are terser but are a second vocabulary for the
   same thing. Derived from `chordTones`' degree and alter, so no new
   harmony.
6. **The computer split lives in `SongWizard`, at its own 1080px query.** The
   wizard owns the preview (wizard_ui D2), so it renders both panes; mounting
   `SongArrange` as the main pane would show the song's current shapes, not
   the plan. 1080px is the computer line every other split uses (a 380px pane
   beside a usable chart does not fit the 712px tablet).
7. **No variation selector in the preview pane.** W05#4 draws the
   *Voicings | Up the neck | + New variation* row in the main pane, but the
   variation it would select does not exist until *Write the plan*; a control
   that cannot act is a dead one. The pane names the target in its *Shapes ·
   {variation}* heading instead. Recorded as a deliberate departure from the
   board.
8. **Done leaves the wizard and arrange.** The board's main pane carries
   arrange's *Done*; it keeps arrange's meaning (back to reading). Nothing is
   lost — the plan is in memory until written.
9. **The design delta** is in workflows 5 and 16 (cited above): workflow 5
   was silent on the chip, the screen and the computer split, and workflow
   16 called the shared affordance "the same by-hand dialog", which would
   now be wrong in a song (the instruments_layout D8 / editor_chrome D1
   rule: a delta when the workflow is silent or contradicts the board).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-18.

- Arrange's mode chip is now the shared instrument chip, `Arranging · {instrument}`, opening the instruments overlay: app/src/instruments/InstrumentChip.jsx (label prop), app/src/songs/SongArrange.jsx.
- Enter a shape is a screen of arrange (no modal): app/src/songs/SongArrange.jsx, app/src/songs/arrange.css; the shared builder in app/src/music/EnterShape.jsx and app/src/music/music.css gains *Notes it holds*, per-string rows, role badges and the foreign-note notice (the explorer's dialog included).
- Chord-tone roles, string names, summary and foreign list live in the pure app/src/music/shape-readout.js (unit: app/src/music/shape-readout.test.js).
- The wizard sits beside the chart at the new `ARRANGE_WIDE_QUERY` (1080px): app/src/songs/SongWizard.jsx, app/src/songs/wizard.css, app/src/shell/layout-mode.js, app/src/shell/AppShell.jsx (Done leaves wizard and arrange); the preview pane is a named, focusable region (axe scrollable-region-focusable); `wizard.back` reads *Back*.
- Copy in all four locales: app/src/i18n/locales/{en,pt-BR,es-419,it}.js.
- Behavior tests: SongArrange, SongWizard, EnterShape behavior tests, layout-mode.test.js; e2e-web: e2e/web/tests/arrange.spec.js, e2e/web/tests/wizard.spec.js (W05 #1-4).
- Design delta: docs/workflows/05-arrange-for-an-instrument.md, docs/workflows/16-chord-explorer.md.

