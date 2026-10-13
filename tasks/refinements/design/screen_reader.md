# Refinement — `design.screen_reader`

## TaskJuggler

- Task `design.screen_reader` — "How a screen reader reads a sung line".
- Defined in `tasks/20-design.tji` (lines 26–30).
- `note:` *"A decided order for chords and words read aloud, and how a chart, a
  diagram and a conflict are announced. DIRECTION §6. Tests: none — design
  deliverable (the decided reading order, in a document and on the board);
  shell.a11y_chart's tests pin it."*

## Effort estimate

1d (unchanged from the `.tji`). This is a design task: the deliverable is a
decided-reading-order **document** and a **mockup board**, not code. The budget
covers deciding the aural order of a sung line, a chart line, a chord diagram
and a conflict against the governing documents; writing that down precisely
enough that `shell.a11y_chart`'s unit test can assert the exact announced text;
drawing one board that shows the four cases visually beside their announced
reading on two phones, a tablet and a computer; and the DIRECTION §6 delta.

## Repository

**estante-de-cifras.** The deliverables:

- `docs/screen-reader.md` — the decided reading order, written in the register
  of `docs/home-book-format.md` (numbered sections, RFC 2119 conformance
  language, example announced strings), the specification `shell.a11y_chart`
  implements and tests against.
- `docs/mockups/Screen-reader.dc.html` — the board, registered in
  `docs/mockups/canvas.json`.
- `docs/DIRECTION.md` §6 — the open-decision bullet retired (see Acceptance
  criteria).

No `cifra.md:` work. The sung line, the chart, the chord diagram and the
conflict are **read** here from the cifra.md model, but nothing in
`/home/ruoso/devel/cifra.md` changes: the specification defines the document
model and canonical text only, and it is silent on assistive technology (a
full grep of `/home/ruoso/devel/cifra.md/spec/` for *screen reader / accessible
/ aria / reading order* finds nothing musical — the one "reading order" hit,
`spec/3-repeats.md:35`, is the order of measures, not a screen reader's). The
reading order is an app concern and lives on this side of the two repositories
(DIRECTION §3.6–3.7: the app and the format are separate, held together only by
the API contract and the format itself).

## Inherited dependencies

The `design` parent carries `depends bootstrap.workflows` — the fourteen
workflows exist. The task declares no further `depends` of its own, and needs
none:

- **Settled.** The chart's visual model — a sung line as segments, each chord
  stacked over the words it attaches to, measures between bar rules — is decided
  (DIRECTION §3.7 lines 436–438; `docs/mockups/GUIDE.md` §Charts; cifra.md
  `spec/4-lyrics.md` §4.8, `spec/2-chart.md` §2.2). This task decides how that
  model is **read aloud**, not the model.
- **Settled (sibling, already landed).** The chord diagram's accessible name is
  decided in workflow 16 (`docs/workflows/16-chord-explorer.md` lines 67–72):
  the music core's `describeFingering`. This task reuses it unchanged.
- **Settled (sibling, already landed).** What a conflict is, and that the
  reading view shows the user's own version with the conflicted places marked,
  is decided in workflow 9 (`docs/workflows/09-conflicts.md` lines 13–23, 34–36)
  and DIRECTION §2.2 (lines 94–97). This task decides how a marked place is
  announced in the reading chart.
- **Not a dependency (deliberately decoupled).** `shell.chart`,
  `shell.diagram` and `shell.a11y_chart` consume this document; they do not
  precede it. `shell.a11y_chart` (`tasks/50-shell.tji` line 50) carries
  `depends !chart, design.screen_reader` — it is the downstream build task that
  implements and checks the order this document decides. This task is a pure
  design deliverable and has no runnable prerequisite to drive (it lands no
  tests of its own — see Acceptance criteria).

## What this task is

A rendered chart is drawn, not spoken: the sighted reader sees each chord
sitting over the syllable it lands on, the measures ruled off between bar lines,
the chord diagrams in a strip, the conflicted lines flagged. A screen reader
walks a tree and reads tokens in order. Left to the incidental nesting of the
chart's DOM, that order is an accident — it might read a chord, then a fragment
of a word, then the glyph `#` as "hash", then a padding underscore as nothing,
then the next chord, in whatever sequence the segment spans happen to fall.
DIRECTION §6 asks for this to be **decided rather than left to the markup**.

This task writes down, as a normative document, the order in which a screen
reader reads:

1. a **sung line** — the interleaving of its chords and its words, and how a
   chord is spoken (its name, not its glyphs), and what is not spoken at all
   (padding, the centred hyphen);
2. a **chart line** — chord-only measures between bar rules, how the bar
   structure and any bar number are conveyed and the no-chord mark announced;
3. a **chord diagram** — reusing workflow 16's `describeFingering` accessible
   name, plus whose shape it is, by word;
4. a **conflict** — how a marked place in the reading chart is announced so a
   listener hears they have entered and left an unresolved region, without the
   raw git markers.

It draws one board showing all four, each beside the exact text a screen reader
announces, so the decision is visible, and it retires the DIRECTION §6 bullet.

## Why it needs to be done

DIRECTION §6 lines 535–536 record the open decision:

> - **How a screen reader reads a sung line**: an order for chords and words
>   read aloud, decided rather than left to the markup.

It is the last accessibility gap in the design, and it blocks a build task that
is itself a dependency of the whole chart surface:

- `shell.a11y_chart` (`tasks/50-shell.tji` line 50, note: *"The decided reading
  order, implemented and checked"*) cannot be written until the order is
  decided — its unit test asserts *the reading-order text* of a sung line, a
  chart, a diagram and a conflict, which only exists once this document fixes
  it. `shell.chart`'s own axe/behavior tests already render corpus songs
  (`tasks/refinements/shell/chart.md` lines 125–129), but the *reading order*
  is deferred to `shell.a11y_chart` precisely because it waits on this design.
- `shell.diagram` (`tasks/refinements/shell/diagram.md` line 94) notes that
  `shell.a11y_chart` "later checks the full screen-reader reading order" — the
  diagram ships its `describeFingering` label, and this task is where the song
  chart's reading of that label is settled.
- The accessibility standing rule (every UI task: axe at WCAG 2.1 AA, status by
  a word never colour) applies to every screen the chart appears on; without a
  decided order, each chart-bearing screen would improvise one, and they would
  drift.

## Inputs / context

Governing documents and the sources the decision reads:

- **DIRECTION §6** — `docs/DIRECTION.md` lines 519–542; the screen-reader bullet
  at lines 535–536 (retired by this task). §7 — the numbered-workflow list,
  lines 544–574 (unchanged; this is not a workflow).
- **DIRECTION §3.7, the app** — `docs/DIRECTION.md` lines 409–449: charts are
  drawn by the app as chords stacked over the syllables they belong to, with a
  centred hyphen where a chord opens room inside a word (436–438); the source
  editor is CodeMirror 6, which shows conflict markers (433–434); the view is
  the only layer that knows React, the music core and cifra.md-for-JavaScript
  below it are framework-free (430–432); axe at WCAG 2.1 AA (447–449).
- **DIRECTION §5** — `docs/DIRECTION.md` lines 480–482: the music core brings
  over the i18n the renderer's **accessible labels** need (`src/i18n/`); the
  accessible-name seam this task reads already exists.
- **DIRECTION §2.2** — `docs/DIRECTION.md` lines 94–97: what collides becomes a
  conflict the app shows in musical terms (workflow 9); its *edit* option writes
  git's markers into the text, and a marked text is never canonical.
- **Workflow 16, the chord explorer** — `docs/workflows/16-chord-explorer.md`
  lines 67–72 (every diagram carries an accessible name, the music core's
  `describeFingering`, *"A major, x02220, open position, fingers 2-1-3, root on
  the 5th string, easy"* — "so the groups read under a screen reader as they
  look"); line 54 (a word, never a number, never colour alone); lines 74–83
  (the notation dialect: the home book's `notation` preference, cifra.md §5.6);
  lines 158–161 (a full keyboard path, React Aria Components, axe WCAG 2.1 AA).
- **Workflow 9, conflicts** — `docs/workflows/09-conflicts.md` lines 13–23 (what
  can conflict: the chart, a voicing, a property, a deletion, a non-song file);
  lines 34–36 (until settled, the song shows the user's own version with the
  conflicted places marked).
- **Mockups** — `docs/mockups/GUIDE.md` §Charts (lines 45–97: the segment model,
  the `L.sung`/`L.bars`/`L.run`/`L.words`/`L.sec`/`L.gap` helpers, the `.fill`
  centred-hyphen span, the `.barline` of `.m` measures); line 40 (a sung line
  may carry `mark-def` dashed defaults, `mark-conf` conflict, `mark-tap` arrange
  mode; the monospace `.editor > .ln` carries `.mk` conflict-marker lines);
  lines 19–31 (the board shape: `.est … board` 3208×1500, a `.board-head`, three
  `.dev-col`s = two phones, a tablet, a computer; copy `W02`'s head/helmet/
  script); line 28 (never real song lyrics — invented *Tarde Clara* / new short
  Portuguese). `docs/mockups/README.md` "Decisions the drawings carry" lines
  22–26 (proportional segments and the centred hyphen; the starting fret alone;
  defaults hollow, your shapes in the chord colour, the song's in ink, every
  status badge a word never colour). `docs/mockups/ChordBox.dc.html` (the chord
  diagram component: `chord`, `frets`, `kind="song|yours|default"`, the `who`
  word drawn for non-song kinds).
- **The cifra.md model being read** (`/home/ruoso/devel/cifra.md/spec/`):
  `4-lyrics.md` §4.4 (line 100: a sung line's chords attach to word characters
  by column), §4.8 (line 357: rendering in a proportional face — the segment
  model and the centred hyphen); `2-chart.md` §2.2 (line 28: measures and bar
  lines), §2.3 (60: items), §2.4 (98: chord tokens and footnote markers), §2.6
  (146: the no-chord mark), §2.8 (213: bar anchors and bar numbers);
  `7-voicings.md` §7.5 (line 148: fret strings), §7.5.1 (176: fingering) — what
  `describeFingering` summarizes; `11-merge.md` §11.12 (line 923: the conflict
  model), §11.12.2 (978: the marked text — `ours` / `=======` / `theirs`). The
  notation dialect that spells a chord: §5.6, read in workflow 16.
- **Sibling refinements for the consuming tasks** —
  `tasks/refinements/shell/chart.md` (lines 125–129 name `shell.a11y_chart` as
  the task that implements and checks this order), `tasks/refinements/shell/
  diagram.md` (line 94), `tasks/refinements/format/render_hyphen.md` (line 208).
- **Sibling design refinements for shape and ritual** —
  `tasks/refinements/design/theme_picker.md` and
  `tasks/refinements/design/home_book_format.md` are the closest templates: a
  cross-cutting decision document that is **not** a numbered workflow, with a
  board (theme_picker) and in the spec register (home_book_format). The
  design-task convention — a document and a board, DIRECTION §6/§7 updated, no
  code tests — is `tasks/refinements/README.md` lines 38–45.

## Constraints / requirements

- **The settled models are normative; this task decides the reading, it does
  not redesign them.** The chart's segment layout (DIRECTION §3.7, cifra.md
  §4.8), the diagram (ChordBox, workflow 16's `describeFingering`), the merge
  and its marked text (cifra.md §11.12, workflow 9) are fixed. This document
  turns them into a decided aural order and nothing more.
- **Component boundary (DIRECTION §3.6–3.7).** The spoken forms — a chord's
  name, a fingering's sentence — are produced below the view, in the
  framework-free music core / renderer whose accessible labels already exist
  (DIRECTION §5 line 482); the view (the only React layer) applies them as ARIA.
  The Worker owns the data and is not involved. The document fixes **what is
  said**; `shell.a11y_chart` decides the ARIA mechanics (a visually-hidden text
  layer, `aria-label`s, `role` grouping) that say it.
- **Accessibility (standing rule).** Every interactive part of a chart — a
  tappable chord in arrange mode, a diagram's star — uses React Aria Components
  with a full keyboard path, and axe runs at WCAG 2.1 AA on every chart-bearing
  screen (workflow 16 lines 158–161). Status is carried by a **word, never
  colour or line-style alone**: a conflict, a shown default, whose shape a
  diagram is — each announced in words (`docs/mockups/README.md` lines 22–26).
- **Offline first.** Reading a chart aloud is pure client rendering of data the
  Worker already holds; the spoken forms come from the framework-free music
  core (DIRECTION §3.7, §5). Nothing here waits on the network.
- **No song text in logs; invented songs only.** The board and every downstream
  test use songs written for the purpose (the GUIDE's *Tarde Clara* or new short
  Portuguese lyrics), never someone else's words (`docs/mockups/GUIDE.md` line
  28).
- **Canonical form / no book without an account do not apply here.** Reading an
  on-screen chart neither writes nor fetches; both standing rules are noted so
  the task is not mis-scoped against them.
- **No new runtime dependency and no new architectural seam.** The accessible
  labels (`src/i18n/`, `describeFingering`) and the chart renderer already
  exist; this task adds a decision, not a dependency — so there is no DIRECTION
  §3.x delta, only the §6 bullet.

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` `Tests:` clause is *"none
— design deliverable (the decided reading order, in a document and on the
board); shell.a11y_chart's tests pin it"*). Acceptance is what the document
decides, what the board shows, and the DIRECTION §6 delta. The document and the
board must be concrete enough that `shell.a11y_chart`'s named tests (criterion 4)
are writable against them — in particular, the document must give the **exact
announced text** for a worked example of each of the four cases, so the unit
test has a string to assert.

**1. `docs/screen-reader.md` exists and decides, in the `docs/home-book-format.md`
register (numbered sections, RFC 2119, worked examples):**

- **The sung line reads interleaved, chord before the word-run it sits over, in
  source order.** For a line written `G … D … Em` over *"Quando eu te vi
  passar"*, the announced text is *"G, 'Quando', D, 'eu te vi', E minor,
  'passar'"* — the chord, then the words it attaches to, then the next chord.
  A lead-in before the first chord reads as words alone; a chord over empty
  space reads as the chord alone. *Pins `shell.a11y_chart`'s unit case — the
  reading-order text of a sung line — and the behavior test's accessible names
  (DIRECTION §3.7 lines 436–438; cifra.md §4.4, §4.8).*
- **A chord is spoken by name, never by its glyphs.** `Em` → *"E minor"*,
  `C#m7` → *"C sharp minor seven"*, `G/B` → *"G over B"* — the symbol expanded
  to words in the user's notation dialect (the home book's `notation`
  preference, cifra.md §5.6, workflow 16 lines 74–83), so a screen reader does
  not read `Em` as the word "em" or spell `C#m7` letter by letter. The spoken
  form is the music core's label, not markup. *Pins the unit case's chord text
  and the behavior test (workflow 16 lines 67–72; DIRECTION §5 line 482).*
- **Padding and the centred hyphen are not spoken.** The canonical text's
  underscore padding (`W_hen`, cifra.md §4.5.2) and the `.fill` centred-hyphen
  span (GUIDE §Charts) carry no accessible text. A word split across chords
  reads as its pieces in source order, each after its chord (`W_hen` under two
  chords → *"<chord>, 'W', <chord>, 'hen'"*), the musically honest split — not
  reassembled, and the hyphen never read as "hyphen". *Pins the unit case's
  split-word text (cifra.md §4.8; `tasks/refinements/format/render_hyphen.md`
  line 208).*
- **A chart line reads its measures in order, with the bar structure conveyed
  and the `|` glyph never spoken.** `G | D | Em | C` is announced as four
  measures — *"G"*, *"D"*, *"E minor"*, *"C"* — exposed as an ordered group so
  count and position are announced; a numbered bar (cifra.md §2.8) leads with
  its number (*"bar 5: …"*); the no-chord mark (cifra.md §2.6) reads *"no
  chord"*; a footnote marker (cifra.md §2.4) reads as its footnote reference; a
  `.run`/intro line reads its chords in order with no bars. *Pins the unit case
  — the reading-order text of a chart — (cifra.md §2.2, §2.3, §2.6, §2.8).*
- **A chord diagram reads its `describeFingering` name plus whose shape it is,
  by word.** The accessible name is the music core's `describeFingering`
  sentence decided in workflow 16 (*"A major, x02220, open position, fingers
  2-1-3, root on the 5th string"*); in the song chart the diagram also announces
  its role by word — *"your shape"* / *"default"*, the song's own shape
  unmarked (ink) — never colour alone (ChordBox `who`; README lines 22–26). The
  starting fret is already in the sentence. The explorer's difficulty word is
  omitted here (it belongs to ranked candidates, not the chosen shape). *Pins
  the unit case — the reading-order text of a diagram — and the behavior test's
  accessible name (workflow 16 lines 67–72; `tasks/refinements/shell/diagram.md`
  line 94).*
- **A conflict is announced by a word, bounding the user's own version.** In the
  reading view the song shows the user's version with the conflicted places
  marked (`mark-conf`, workflow 9 lines 34–36); the announcement names the
  conflict in musical terms and by a word — *"needs you — conflicted chart line:
  <the line read as above>"* at entry and the region's end at exit — so a
  listener hears they are in and out of an unresolved place without hearing raw
  git markers. The `<<<<<<<` / `=======` / `>>>>>>>` markers (cifra.md §11.12.2)
  exist only in the monospace CodeMirror source editor (DIRECTION §3.7 lines
  433–434), where they are plain text read verbatim — not announced in musical
  terms. The same mechanism applies to a shown default (`mark-def` → *"default"*),
  conflict being the case the note names. *Pins the unit case — the reading-order
  text of a conflict — (workflow 9 lines 13–23, 34–36; DIRECTION §2.2; cifra.md
  §11.12).*

**2. `docs/mockups/Screen-reader.dc.html` exists and is registered.** Drawn to
`docs/mockups/GUIDE.md` (the `.dc.html` structure, `W02`'s head/helmet/`<script
type="text/x-dc">` verbatim, the `.board-head`, three `.dev-col`s = **two
phones, a tablet, a computer**), using only `var(--…)` tokens and the invented
cast (never real lyrics). Because this is a cross-cutting rule rather than a
screen flow, each device shows a real reading-view chart (a short invented
song) **beside an "as a screen reader reads it" annotation** that spells the
decided order, so the decision is visible. Across the four devices it must show,
between them, all four cases:

- a **sung line** with its chords over the words and the annotated interleaved
  reading, including a chord spoken by name (*E minor*) and a word split across
  two chords (the centred hyphen drawn, absent from the annotation);
- a **chart line** (`.barline`) of measures and its annotated measure-by-measure
  reading;
- a **chord diagram** (`<dc-import name="ChordBox" …>`) with its
  `describeFingering` annotation and its *your shape* / *default* word;
- a **conflicted line** (`mark-conf`) with the *needs you — conflict* word and
  the annotation bounding the user's own version.

Registered in `canvas.json`: a `boards["Screen-reader.dc.html"]` entry
(`w:3208, h:1500, x:0`, the next `y` on the 1620 stride after the last board —
`y:29960`, after `Theme-picker.dc.html` at `y:28340`) and appended to `order`.
(`Main`, `ChordBox` and the W-boards are not touched.)

**3. Governing-document delta (same commit, closer's):**

- `docs/DIRECTION.md` §6 lines 535–536: the screen-reader bullet flipped from
  the open form (*"an order … decided rather than left to the markup"*) to a
  **decided-and-drawn** form that points at `docs/screen-reader.md` and
  `docs/mockups/Screen-reader.dc.html`, mirroring the instrument (524–528),
  chord-explorer (529–532) and theme-picker (537–542) bullets.
- **No `docs/DIRECTION.md` §7 item and no new workflow document** — this is a
  cross-cutting reading-order rule, not a journey a user walks (see Decisions),
  so it joins the §6 close like `design.theme_picker` and
  `design.home_book_format` did, not the §7 list.

**4. No code tests, and none deferred.** The `.tji` `Tests:` clause is honoured
by the design deliverable. The tests for the order **as built** land in
`shell.a11y_chart` (`tasks/50-shell.tji` line 50 — not this task's, not deferred
from it): unit (*the reading-order text of a sung line, a chart, a diagram and a
conflict* — the worked strings this document fixes), behavior (*accessible names
as design.screen_reader decided, Testing Library and axe*), e2e-web (*a chart
read through the accessibility tree and by keyboard on the three viewports*).
Naming them here is the handshake, not a deferral.

**5. No deferred WBS follow-up.** A design task with no code seam to build later;
`shell.a11y_chart` already exists and `depends` on this one, so nothing is
registered. No parking-lot item.

## Decisions

### A reading-order document and a board, not a new workflow

The design-area convention is a workflow document plus a board
(`tasks/refinements/README.md` lines 38–45). This task deviates on the document,
like `design.home_book_format`: its `.tji` title is **not** "Workflow NN: …",
and its note says the deliverable is *"the decided reading order, in a document
and on the board"*. **Chosen:** a standalone `docs/screen-reader.md` in the
`docs/home-book-format.md` register (numbered sections, RFC 2119, worked
examples) **plus** a board, closing the §6 bullet and adding no §7 item.
**Rejected:** a 17th workflow document — there is no user-facing flow to
describe; a screen reader reading a chart is a cross-cutting property of every
chart-bearing screen (workflows 2, 4, 5, 9, 12…), not a journey, and a workflow
would misrepresent §7 and duplicate those screens. Unlike `home_book_format`
(invisible, no board), this task **does** carry a board, because the decided
order is a visible, drawable thing — the chart beside its announced reading —
and a drawing is the clearest way to pin "read this, not that".

### The sung line interleaves chord-then-word, in source order

**Chosen:** a screen reader reads each chord immediately before the word-run it
sits over, in the source order of the segments — *"G, 'Quando', D, 'eu te vi',
E minor, 'passar'"*. **Rejected:** (a) two passes — the whole chord line then
the whole lyric line — which severs the attachment that *is* the sung line's
meaning (a chord attaches to a specific word character by column, cifra.md §4.4;
a musician hears "G on *Quando*", not "all the chords, then all the words"); (b)
the words alone with chords skipped — loses the music; (c) leaving it to the DOM
— exactly what §6 forbids, and a bare segment-span traversal reads padding,
punctuation glyphs and the `.fill` hyphen as noise. Interleaving also matches
the visual segment order (DIRECTION §3.7, cifra.md §4.8), so the chart reads as
it looks (the goal workflow 16 states for the explorer, line 72).

### A chord is spoken by name, in the notation dialect — the heart of the task

**Chosen:** the chord token is announced as its spoken expansion — `Em` → *"E
minor"*, `C#m7` → *"C sharp minor seven"* — in the user's notation dialect
(cifra.md §5.6, the home book's `notation` preference set in workflow 16), the
music core's accessible label (DIRECTION §5 line 482), not the glyph string.
**Rejected:** reading the raw symbol — a screen reader pronounces `Em` as the
word "em", `C#m7` as "C-number-sign-m-seven" or similar, and `G/B` as "G slash
B"; unintelligible, and the clearest instance of the §6 "decided rather than
left to the markup" harm. The dialect is a single preference (workflow 16 lines
76–79), so there is no per-chart control; the spoken form follows the same
preference the visible symbol does.

### Padding and the centred hyphen are silent; a split word reads as its pieces

**Chosen:** underscore padding (cifra.md §4.5.2) and the `.fill` centred-hyphen
span (GUIDE §Charts, `tasks/refinements/format/render_hyphen.md` line 208) are
visual only and carry no accessible text; a word split across chords reads as
its pieces in source order, each after its chord (`W_hen` under two chords →
*"<chord>, 'W', <chord>, 'hen'"*). **Rejected:** (a) reassembling the word whole
and reading the chords before or after it — hides which chord lands on the
second syllable, the one piece of information the split exists to carry; (b)
announcing the hyphen ("W hyphen hen") — a rendering artifact, never spoken. The
split read is the musically honest one and matches the sheet-music convention
the hyphen draws (cifra.md §4.8).

### A chart line reads measures as an ordered group, not the `|` glyph

**Chosen:** a chord-only bar line is announced as its measures in order, each
measure's chords spoken by name, exposed as an ordered group so a screen reader
announces count and position; a numbered bar leads with its number (cifra.md
§2.8), the no-chord mark reads *"no chord"* (§2.6), a footnote marker as its
reference (§2.4). **Rejected:** (a) reading the `|` as "vertical bar" — the
glyph is structure, not content; (b) a flat run of chords with the bar
boundaries dropped — loses the metre, which is what a chart line is for. Grouping
by measure is the structure the spec defines (§2.2, §2.3); conveying it through
an ordered group is the decided order, not left to incidental markup.

### The diagram reuses `describeFingering`, plus whose shape it is, by word

**Chosen:** the chord diagram's accessible name is the music core's
`describeFingering` sentence already decided in workflow 16 (lines 67–72), and
in the song chart it additionally announces its role by word — *"your shape"* /
*"default"*, the song's own shape unmarked — reusing the ChordBox `who` label
and the README decision (defaults hollow, yours in the chord colour, the song's
in ink, "every status badge a word, never colour alone"). **Rejected:** (a)
reading the fret grid cell by cell — unlistenable and already solved by
`describeFingering`; (b) conveying whose shape it is by the fill colour alone —
a direct violation of the standing rule and an axe failure for a colour-blind
user. The explorer's difficulty word is dropped here — in the song chart the
shape is the chosen one, not a ranked candidate, so the bucket word would be
noise.

### A conflict is announced in musical terms, bounding the user's own version

**Chosen:** in the reading view a `mark-conf` place is announced by a word
(*needs you — conflict*, matching workflow 8's "needs you" and workflow 9's
musical-terms framing), naming what conflicts (a chart line, a voicing, a
property), with the region's entry and exit announced, while the content read is
the user's own version (workflow 9 lines 34–36). The raw git markers
(`<<<<<<<` / `=======` / `>>>>>>>`, cifra.md §11.12.2) are read verbatim only in
the monospace CodeMirror source editor (DIRECTION §3.7 lines 433–434), where
they are the literal text, and are never spoken in the rendered reading chart.
**Rejected:** (a) reading both sides inline in the reading view — the reading
view deliberately shows one version so someone opening the song mid-lesson gets
a song, not a puzzle (workflow 9 line 36); the two-sided resolution is the
conflict-resolution surface's job (workflow 9), with its own a11y, outside this
task; (b) announcing the conflict by the `mark-conf` colour/soft-background
alone — the standing-rule violation again. The end-of-region announcement
matters: without it a listener cannot tell where their own version resumes being
uncontested.

## Open questions

(none — all decided.)

## Status

**Done** — 2026-10-13.

- `docs/screen-reader.md` — normative reading-order spec in the `home-book-format.md` register: numbered §§1–8, RFC 2119, exact `Announced text` strings for sung line (§2.2), split word (§4), chart line (§5), diagram (§6), and conflict (§7.2).
- `docs/mockups/Screen-reader.dc.html` — board (2 phones = sung line + chart line, tablet = chord diagram, computer = conflict + editor-verbatim contrast), all four cases shown beside their announced reading.
- `docs/mockups/canvas.json` — board registered at `y:29960`, appended to `order`.
- `docs/DIRECTION.md` §6 lines 535–542 — the screen-reader bullet flipped to decided-and-drawn form, pointing at both deliverables; no §7 item added.
