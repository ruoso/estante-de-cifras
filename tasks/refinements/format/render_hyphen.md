# format.render_hyphen — Proportional rendering in §4

## TaskJuggler entry

`task render_hyphen` in [`tasks/05-format.tji`](../../05-format.tji) (lines
54–59), under `task format`. One line there: *"Proportional rendering in
§4."*

## Effort estimate

**0.5 day** (from the `.tji`).

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, one file:

- `spec/` — a new subsection in `spec/4-lyrics.md` (§4.8, after §4.7 and
  before *Open questions*): a SHOULD telling a proportional renderer how to
  present a sung line — as segments, with a centred hyphen where a chord
  opens room inside a word.

Nothing else moves. In particular the Python reference (`reference/`) and the
corpus (`corpus/`) do **not** change: this subsection is display advice, not
reading or writing behaviour, so there is no model field, no canonical byte
and no corpus entry to add (§Decisions, *The spec moves alone; the reference
and corpus do not*). This is the task's sole deliverable, and it is spec
prose — the implementer writes §4.8, the closer commits it with the Status
block. No design delta is authored ahead of implementation: the subsection
*is* the task.

## Inherited dependencies

- **`format.sung_layout` — settled.** Complete (`complete 100`,
  [`tasks/05-format.tji`](../../05-format.tji) lines 13–19): the reference
  reads sung lines, attaching each item to a character of the words and
  padding a word with `_` where a chord opens room inside it, against spec
  §4.4–§4.5. No refinement document was written for `format.sung_layout` (it
  predates this refinements directory — the only format refinements on disk
  are [`conflicts_schema.md`](conflicts_schema.md) and
  [`setlist_corpus.md`](setlist_corpus.md)), so this refinement cites the
  spec chapter directly rather than a predecessor refinement. §4.8 names no
  new concept: *segment*, *attachment* and *padding* are all defined by
  §4.4–§4.5, which sung_layout landed.

Not a dependency, and deliberately not made one — the downstream consumer:
**`shell.chart`** ([`tasks/50-shell.tji`](../../50-shell.tji) lines 29–34,
estante-de-cifras `app/`) draws the chart in the app's proportional face and
carries the real tests for this behaviour (*"unit (sung-line layout: chords
over syllables, the centred hyphen, measures between bar rules, sections)"*).
`shell.chart` does not depend on `render_hyphen`, nor the reverse: the app's
note describes the hyphen on its own, and this task documents the same
behaviour in the format spec. The two agree because they are checked against
the same drawn decision (§Decisions, *The behaviour is pinned downstream, not
here*), not because either waits on the other.

## What this task is

The format model places a chord over a *character* of the words, counted in
code-point columns from the start of the line (§4.4), and canonical form
writes the sung line in a monospaced block so that every chord stays over its
syllable (§0.5, `spec/0-overview.md` lines 208–213). An application that sets
the words in a **proportional** face — as the app does
([`docs/mockups/README.md`](../../../docs/mockups/README.md) line 24) — cannot
use columns: a proportional glyph is not one column wide. It must instead draw
the sung line as **segments**, each chord stacked over the words it is
attached to (§4.4's division of the words among the attached items), and it
needs the format's guidance on one presentation question the monospaced model
answers only implicitly: when a chord falls *inside* a word — the division
between two segments is not at a space — how is the split shown so the two
pieces still read as one word?

This task adds that guidance to the spec, as **§4.8, a SHOULD for proportional
renderers**: draw the sung line as segments, and where a chord opens room
inside a word (exactly where canonical form writes `_` padding, §4.4/§4.5.2),
bridge the two segments with a **centred hyphen**, as sheet music joins
syllables under successive notes — so `W` and `hen` under two chords read as
the one word *When* split, not as the two words *W hen*. It is advice to a
renderer, explicitly outside the conformance profiles (§9 is about reading and
writing; see §Decisions). The subsection names no new model concept; it turns
the §4.4 division and the §4.5.2 padding condition into a rendering
instruction.

## Why it needs to be done

The specification today describes only the monospaced presentation — the
natural consequence of the Markdown fence (§0.5, lines 208–213: *"the music is
set in a monospaced block that keeps every chord over the syllable it was
written over"*). It says nothing about a proportional renderer, yet a
proportional renderer is precisely what the app is
([`docs/mockups/README.md`](../../../docs/mockups/README.md) line 24: *"Charts
are set in a proportional face, not a monospace. … A chord wider than its
syllable opens room in the words. Where that room falls inside a word, a
centred hyphen bridges it, as syllables are joined under notes in sheet
music"*). DIRECTION's principle is that implementations agree because they are
checked against a written decision, not because they copy one another; a
presentation rule the app implements, and that any other proportional renderer
of the format would face the same choice over, belongs in the specification so
the decision is written once and the app's renderer is *checking* the spec, not
inventing it. The centred hyphen is the one presentation choice the monospaced
model does not make for a proportional renderer — a space would read as a word
boundary and break the word — so the spec states it as a SHOULD.

The downstream consumer is `shell.chart`: the app's chart renderer stacks
chords over syllables and draws the centred hyphen, and its unit tests pin
exactly that. §4.8 is the written authority those tests answer to.

## Inputs / context

- [`tasks/05-format.tji`](../../05-format.tji) lines 54–59 — the task, its
  `note` (the scope: *"segments, and a centred hyphen where a chord opens room
  inside a word"*, `docs/mockups/README.md`), and its `Tests:` clause (*"none
  — specification prose (a SHOULD for proportional renderers); the app's
  renderer pins it in shell.chart's tests"*).
- `cifra.md/spec/4-lyrics.md` — the chapter this task extends. The sections
  §4.8 rests on:
  - **§4.4 "Sung lines: columns and attachment" (lines 100–186)** — *columns*
    counted in code points (lines 108–119), *attachment* of each item to a
    character of the words (lines 140–158), *padding* `_` as "room the layout
    made inside a word" (lines 121–133), and above all the **division of the
    words among the attached items** (lines 160–186): *"The words are divided
    among the attached items, in column order: each takes the words from its
    column up to the next attached item's column, padding left out, and the
    last takes the rest"* (lines 160–162), *"A chord written inside a word
    divides it … `W_hen` with a chord over the `h` gives* W *… and* hen *…, and
    the two are still one word"* (lines 162–165), and the *lead* item (words
    before the first attached item, lines 166–168). A **segment** is the words
    one attached item takes, by this division — the subsection introduces the
    word, it adds no new concept.
  - **§4.5.2 "Padding" (lines 235–251)** — the condition that decides `_`
    padding from space padding: `_` *"when the character and the one before it
    in the words are both neither a space nor `_`: the room is inside a word"*
    (lines 238–241), spaces otherwise. This is the exact test §4.8 reuses to
    decide a centred hyphen (inside a word) from ordinary inter-word space (at
    a word boundary).
  - §4.7 (lines 351–355) and *Open questions* (lines 357–362) — where §4.8 is
    inserted: a new subsection after §4.7, before *Open questions*.
- `cifra.md/spec/0-overview.md` lines 208–213 — the monospaced presentation as
  a consequence of the fence (*"the music is set in a monospaced block that
  keeps every chord over the syllable it was written over"*), the baseline
  §4.8 names the proportional alternative to.
- `cifra.md/spec/9-conformance.md` — the profiles (§9.1): *Cifra reader* must
  meet §4 (line 46); every profile is about **reading** a document to its model
  and **writing** canonical form (§9.2, lines 109–125; §9.3 the corpus, lines
  128–137). Rendering is named in no profile. §4.8 is therefore a SHOULD
  outside conformance — it must say so, so an implementer of a profile is not
  misled into thinking display is checked by the corpus.
- [`docs/mockups/README.md`](../../../docs/mockups/README.md) line 24,
  *"Decisions the drawings carry"* — the decision §4.8 writes into the format:
  proportional face, segments, a centred hyphen where room falls inside a word,
  the sheet-music analogy. This is the design precedent; §4.8 is its statement
  in the specification's voice.
- [`tasks/50-shell.tji`](../../50-shell.tji) lines 29–34 — `shell.chart`, the
  app renderer (estante-de-cifras `app/`) that implements and *tests* the
  behaviour §4.8 describes.

## Constraints / requirements

- **Write §4.8 as a SHOULD, not a MUST, and say it is outside conformance.**
  The subsection is advice to a proportional renderer. §9's profiles cover
  reading and writing; display is in none of them, and the reader's model and
  the writer's canonical bytes are identical whether or not a renderer follows
  §4.8. The subsection must state plainly that it binds no profile — so a
  conformance claim neither depends on it nor is weakened by ignoring it.
- **Name no new concept; build only on §4.4 and §4.5.2.** A *segment* is the
  words one attached item takes, by the §4.4 division (lines 160–186) — the
  subsection introduces the term for the renderer and refers the division to
  §4.4. The decision "inside a word" vs "word boundary" is the §4.5.2 `_`-vs-
  space condition (lines 238–241), cited, not restated as a second rule that
  could drift from it.
- **The three things §4.8 must settle, concretely:**
  1. *Segments.* A proportional renderer SHOULD draw a sung line as segments in
     column order, one per attached item (§4.4), each with its chord (or mark)
     stacked over the start of its words; the lead (§4.4) is a segment with no
     chord; an item at or past the end of the words (§4.4) is a chord with an
     empty segment.
  2. *The centred hyphen.* Where the division between one segment and the next
     falls **inside a word** — the §4.5.2 condition: the last character of the
     earlier segment's words and the first of the later's are both neither a
     space nor `_`, which is exactly where canonical form writes `_` padding —
     the renderer SHOULD bridge the two segments with a centred hyphen, so the
     word reads as one word split under chords (`W`–`hen` = *When*), as sheet
     music joins syllables under successive notes.
  3. *A word boundary gets no hyphen.* Where the division falls at a space (the
     §4.5.2 "spaces otherwise" case), the renderer SHOULD set ordinary
     inter-word space and no hyphen; the `_` padding of the monospaced layout
     has no counterpart in proportional type beyond the hyphen this subsection
     defines.
- **Match the chapter's voice and the model's vocabulary.** Present-tense
  descriptive prose, as §4.1–§4.7; reuse *attached item*, *words*, *padding*,
  *column*, *lead* exactly as §4.4–§4.5 define them; an example in the
  chapter's style (a `W_hen`-type split shown as segments with the hyphen) is
  welcome but the normative content is the three points above.
- **Standing rules that apply.**
  - *Canonical form over preserving content* — unaffected: §4.8 changes nothing
    a writer writes. Canonical form stays monospaced with `_` padding; the
    hyphen is a display of that padding, never a character the model or the text
    holds.
  - *Implementations agree because they are checked, not shared* (DIRECTION): the
    spec is the single written decision; the app's renderer and any other
    proportional renderer check against it. This task does not make the spec
    copy the app or the app copy the spec — the drawn decision
    (`docs/mockups/README.md` line 24) and the spec state the same rule.
- **Out of scope.** The reference and the corpus (no reading/writing change —
  §Decisions). The broader chart drawing — measures between bar rules, section
  layout, the marking of defaults/conflicts/arrange mode — which is
  `shell.chart`'s concern (`docs/mockups/README.md` line 24) and already
  defined for the model by §2; §4.8 is only the sung line: segments and the
  hyphen. The screen-reader reading order (`shell.a11y_chart`,
  [`tasks/50-shell.tji`](../../50-shell.tji) lines 50–54) — a separate,
  non-visual presentation.

## Acceptance criteria

**Behaviour delivered.** `spec/4-lyrics.md` has a new §4.8 — a SHOULD for
proportional renderers — that (a) defines a *segment* as the words one attached
item takes (§4.4) and says a proportional renderer draws the sung line as
segments with each chord stacked over its segment; (b) says that where a chord
opens room inside a word (the §4.5.2 `_`-padding condition) the renderer bridges
the two segments with a centred hyphen, with the sheet-music analogy; (c) says a
division at a word boundary gets ordinary space and no hyphen; and (d) states
that this is advice outside the §9 conformance profiles. The chapter still reads
as one piece — §4.8 follows §4.7 and precedes *Open questions*, in the chapter's
voice, naming no concept §4.4–§4.5 did not already define. The `shell.chart`
renderer and the drawn decision (`docs/mockups/README.md` line 24) now have the
format's written authority for the centred hyphen.

**Tests the task lands with, by level.** The `.tji` `Tests:` clause names
**none**, and this refinement confirms it (§Decisions, *The spec moves alone*;
*The behaviour is pinned downstream*):

- **No test level applies at the format layer.** §4.8 adds no reading, writing,
  model or canonical-form behaviour, so there is nothing for the Python
  reference's pytest to exercise and no corpus entry (reading or merge) that
  could change — the format's behaviour/conformance level (the corpus, §9.3)
  pins reading and writing, and reading and writing are untouched. Dropping the
  usual levels is not a scope cut: there is no behaviour of *this task* at a
  level to pin. The gate's format checks still run (the corpus is unchanged and
  stays green; the reference's existing tests stay green), and the WBS gate
  `tj3 --silent --no-reports project.tjp` stays silent.
- **The behaviour this subsection describes is pinned downstream, in its own
  task.** `shell.chart` (estante-de-cifras `app/`) carries *unit (sung-line
  layout: chords over syllables, the centred hyphen, measures between bar rules,
  sections)*, *behavior (corpus songs rendered with Testing Library …, axe)* and
  *e2e-web (a chart on the three viewports … axe)*
  ([`tasks/50-shell.tji`](../../50-shell.tji) lines 29–34). That is not a
  deferral of this task's tests: `shell.chart` is a complete, independently
  scoped WBS leaf that already owns those tests, and §4.8 is the spec it will be
  checked against. No test is deferred, and no "add tests for §4.8" leaf is
  created.

No follow-up work is deferred by this task.

## Decisions

- **The spec moves alone; the reference and the corpus do not.** The project's
  rule is that a change to the format moves the spec, the reference and the
  corpus together — but that rule governs a change to what implementations
  *read or write*. §4.8 adds neither: it is display advice for a renderer, and a
  renderer is not a reader or a writer in §9's sense. The model a reader
  produces and the bytes a writer emits are identical before and after §4.8, so
  there is no reference behaviour to add and no corpus entry (the corpus pins
  reading and writing, §9.3) that could encode a rendering. Only `spec/4-lyrics.md`
  changes. *Alternative rejected:* adding a corpus entry or a reference field for
  the hyphen — the corpus and reference have no notion of proportional display,
  and inventing one (a "rendered" fixture) would be a new seam the format does
  not otherwise have, pinning an implementation detail of one renderer rather
  than the format; the SHOULD is checked where renderers live (the app, in
  `shell.chart`), not in the format's reader/writer corpus.

- **A SHOULD outside the conformance profiles, stated as such.** §4.8 is written
  as a SHOULD and says in the text that it binds no §9 profile. A proportional
  renderer that follows it reads the same model and writes the same canonical
  form as one that does not; display is simply not what conformance measures.
  *Alternative rejected:* a MUST, or folding rendering into a profile — the
  format deliberately keeps display out of conformance (the whole chapter is
  about what a line *means*, not how it looks), and a monospaced renderer that
  keeps chords over columns is entirely conformant without a hyphen; making the
  hyphen a MUST would wrongly fail it.

- **Reuse the §4.5.2 condition for the hyphen; do not restate it.** The test for
  "inside a word" vs "word boundary" is exactly §4.5.2's rule for `_` padding vs
  space padding (`spec/4-lyrics.md` lines 238–241). §4.8 refers to it rather than
  writing a second, parallel test — so the proportional hyphen and the monospaced
  `_` are provably the same boundary, and the two cannot drift. *Alternative
  rejected:* describing the hyphen rule from scratch ("between two letters of a
  word") — it would be an independent rule that could diverge from §4.5.2 under a
  later edit, and it would miss the corner the padding rule already handles (a
  run with `_` already in the words, a boundary next to an existing underscore).

- **The behaviour is pinned downstream, not here — and that is not a deferral.**
  The centred hyphen is tested where it is drawn: `shell.chart`'s unit and
  behavior tests (`tasks/50-shell.tji` lines 29–34). `shell.chart` is a standing
  WBS leaf that already carries those tests against the same drawn decision; this
  task does not remove them from it or push new ones onto it. §4.8 gives those
  tests their written authority. *Alternative rejected:* adding a format-level
  test for the hyphen in this task — there is no format-level surface to test it
  on (see *The spec moves alone*); the only place the hyphen is observable is a
  renderer, and the renderer's task owns its tests.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-12.

- cifra.md `082b1ac`: `spec/4-lyrics.md` — new §4.8 "Rendering in a proportional face" (40 lines, inserted after §4.7 and before *Open questions*)
- §4.8 defines a *segment* as the words one attached item takes by the §4.4 division; says a proportional renderer SHOULD draw the sung line as segments with each chord stacked over its segment
- Where the §4.5.2 `_`-padding condition holds (division inside a word), the renderer SHOULD bridge the two segments with a centred hyphen — citing the sheet-music analogy
- Where the division falls at a word boundary (§4.5.2 "spaces otherwise"), the renderer SHOULD use ordinary inter-word space and no hyphen
- §4.8 explicitly states it binds no §9 conformance profile; reading and writing are unchanged
- No reference, corpus, or test changes — spec prose only; the centred-hyphen behaviour is pinned downstream in `shell.chart`'s tests (estante-de-cifras `app/`)
