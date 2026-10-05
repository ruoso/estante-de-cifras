# cifra_js.reader — Reader

## TaskJuggler entry

`task reader` in [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) (lines
29–34), under `task cifra_js`, `depends !chords`. The area file's header
states the stream's rule: *"The app's implementation of the format, held to
the corpus byte for byte. Framework-free: the view is the only layer that
knows React"* ([`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 1–4).

The `.tji` note: *"cifra.md: §1-7 — metadata, sections, fences, chord lines,
repeats, sung lines with attachment and the layout convergence pass (§4.5),
tunings, voicings, diagnostics. Tests: unit (each §1-7 construct and every
diagnostic, sung-line attachment and the §4.5 convergence pass); corpus
(input to model for every entry)."*

## Effort estimate

**6 days** (from the `.tji`) — the largest `cifra_js` task. It ports the
reference's `parse.py` (988 lines), the reading half of `layout.py` (the §4.5
`converge` engine and its token model), and the `tuning.py`/`frets.py`
helpers, and lands the unit tests for every §1–§7 construct and all 22
diagnostics plus the corpus reading checks for every song entry.

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, extended by this
task:

- `js/src/` — four new modules, ported from the reference with the same split:
  - `parse.js` — the song reader: `parse(bytes) → model`, the line-walk state
    machine (metadata, the chart/voicings split at the rule, fences and notes,
    sections and headings), the chart tokeniser, sung-line classification and
    attachment, bar numbering, repeat pairing, the voicings-part reader, and
    every diagnostic. Ports `reference/cifra_md/parse.py`.
  - `layout.js` — the §4.5 layout convergence pass (`converge` and its token
    model/placement), which `parse.js` runs on every sung line. Ports the
    reading half of `reference/cifra_md/layout.py`; the writer's rendering
    functions (`chart_line_text`, `sung_text`, …) land in the same module with
    `cifra_js.writer`.
  - `tuning.js` — §6 tunings: `parseTuning`, `tuningId`, `isTuning`. Ports
    `reference/cifra_md/tuning.py`.
  - `frets.js` — §7.5 fret strings and §7.5.1 fingerings: `parseFrets`,
    `formatFrets`, `parseFingers`, `checkFingers`, `formatFingers`. Ports
    `reference/cifra_md/frets.py`.
- `js/src/index.js` — the `parse` stub (line 74) is replaced by the real
  reader; `write`, `canonical` and `merge` stay stubs (their tasks). No new
  re-exports are required by a consumer yet; `parseTuning`/`isTuning`/
  `parseFrets` may be re-exported if the writer or a later task needs them
  (the writer re-prints voicings), but the task's contract is the `parse`
  surface already fixed in `index.js`.
- `js/test/` — new Vitest unit files (below) and a shrink of
  `js/test/corpus/expected-failures.json` (the reading checks this task turns
  green).

No new runtime dependency (the reader uses only regular expressions, plain
objects and the already-ported `text.js`/`chord.js`/`pitch.js`/`markdown.js`).
No design delta is authored — §1–§7 and §4.5 are already normative, and the
work is a faithful port of the reference held to the committed corpus (see
§Decisions, mirroring [`package.md`](./package.md)).

## Inherited dependencies

- **`cifra_js.chords` — settled.** Complete (cifra.md `fe19a35`,
  [`cifra_js/chords.md`](./chords.md) Status): `js/src/chord.js` delivers
  `parseChord(symbol, dialect) → { chord, ambiguities, errors }` (never
  throws), `isChord`, `chordTones`, `DIALECTS`, `DEFAULT_DIALECT`, and
  `js/src/pitch.js` the note-name helpers, all re-exported from
  `js/src/index.js`. The reader calls `parseChord` on every chart token,
  wraps the result in a chart item (adding `index`/`key`), and turns a
  non-chord (`chord: null`) into an unknown token (§2.9). The chords
  refinement explicitly left to the reader: the `notation` → dialect mapping
  and the `bad-notation` diagnostic (§1.4.3), and chart-level unknown-token
  handling (§2.9). `chords` is the task before `reader` on the single
  `cifra_js` chain, and it established the harness conventions this task
  extends (checks are `{ id, run }`; `discover`/`readingChecks`/`dump`/
  `compareBytes`/`staleLedgerIds`; "compare bytes, never deep-equal";
  born-passing checks live outside `expected-failures.json`).
- **`cifra_js.text_layer` — settled** (transitively, through `chords`):
  cifra.md `7c2106c`, [`cifra_js/text_layer.md`](./text_layer.md) —
  `js/src/text.js` delivers `prepare(bytes) → string[]` (the whole §1.3
  pipeline: UTF-8 reject → strip U+FEFF → NFC → split on LF/CRLF/CR →
  tabs→space → strip trailing U+0020), `decode`, `markerLines`,
  `isMarkerLine` and `NotUtf8Error`. `parse` begins with `prepare`; the
  reader stands on this floor and never re-implements it. The marker-line
  primitive (`isMarkerLine`, §11.12.3) is what the reader's `marker-line`
  diagnostic uses.
- **`cifra_js.package` — settled** (transitively): cifra.md `552cf37`,
  [`cifra_js/package.md`](./package.md) — `js/` as a framework-free,
  zero-runtime-dependency ES-module package with its Vitest corpus harness
  and the expected-failure ledger. `js/src/index.js` exports seven
  corpus-facing stubs; `parse` is the one this task fills in, and the harness
  routes every song reading entry's checks through it.
- **`format.canonical_form` — settled** (transitively): the specification
  (§1–§7, §4.5), the Python reference and the four-file reading corpus this
  task is held to.

Available, not a declared dependency: **`cifra_js.setlists`** (cifra.md
`c72c24e`, [`cifra_js/setlists.md`](./setlists.md)) landed
`js/src/markdown.js` — `mdHeading`, `fenceOpen`, `closesFence` (§1.4.1 title,
§1.9 fences) — as a neutral shared home *"so `cifra_js.reader` imports them
when it lands"*. The reader reuses `markdown.js` rather than re-deriving these
primitives. It is not on the reader's `depends` (the WBS chain is `!chords`
only) because these primitives also live in the reference's `parse.py`
(`md_heading`/`fence_open`/`closes_fence`), so the reader's correctness does
not hinge on the setlist branch; reusing the one committed copy simply avoids
a duplicate. `setlist.js` is also a close structural template (the line-walk
loop, the `diag()` helper, fence handling), the song reader being the same
shape over music the setlist reader does not read.

Downstream: `cifra_js.writer` (`depends !reader`) consumes the model this task
produces and serialises it (checks 2/4/6); `cifra_js.diff` (`depends
!reader`) summarises changes between two models; `cifra_js.editing` (through
the writer), `cifra_js.merge` and `cifra_js.conformance` build on the whole
chain. In the app, the Worker reads every song through `parse` (DIRECTION
§3.6–§3.7). Until this task lands, the entire song pipeline is stubbed: `parse`
throws, and every song reading check is an expected failure.

## What this task is

The **song reader**: `parse(bytes) → model`, the function that turns the text
of a `.cifra.md` document into its canonical in-memory model, implementing
§1–§7 of the specification. It is the union of the four reader profiles of
§9.1 (Chart, Chord, Cifra and Voicings reader): it reads the document
structure (§1 — the UTF-8/NFC/LF text layer, the title and properties, the
chart/voicings split at the rule, sections and the three heading forms, fences
and notes), tokenises every chart line into measures and items (§2 — bar
lines, chords with footnote markers, the no-chord mark, bar anchors and
numbers, unknown tokens), pairs repeats (§3 — the `%` sign, groups, counts and
endings, kept as written), detects whether the document is sung and attaches
each chart item to the syllable under it and runs the §4.5 layout convergence
pass so the model holds every sung line as canonical form lays it out (§4),
classifies each chart token through `chord.js` (§5), and reads the voicings
part after the rule into per-tuning, per-variation blocks of fret strings and
fingerings (§6 tunings, §7 voicings). It reports everything it cannot keep as a
diagnostic (22 codes), and it never throws on malformed input — the single
exception is invalid UTF-8, which the text layer rejects (`NotUtf8Error`)
because such bytes are not a document.

It builds the whole-song model and so turns the reading corpus checks green:
reading `input.cifra.md` gives `input.parsed.json` (check 1) and reading
`canonical.cifra.md` gives `parsed.json` (check 3), for every song entry
(01–34), byte for byte. It does **not** write (checks 2/4) or canonicalise a
model (check 6): those are `cifra_js.writer`'s §8 work.

## Why it needs to be done

The reader is the gate to the whole song side of the format. `cifra_js.writer`
reads a model to serialise it, but every corpus check that proves the writer
right needs the model the reader built; `cifra_js.diff` compares two models;
`cifra_js.merge` merges parsed documents; `cifra_js.conformance` claims the
Merger profile over the whole corpus. In the app, the Worker reads every song
the user opens, saves or syncs through `parse` (DIRECTION §3.6 line 269, §3.7).
None of that moves while `parse` is a stub. `chords` delivered the chart
token's model but could only pin it entry-fragment by entry-fragment (the
born-passing `<entry>/chords` check); the reader is what finally builds the
whole-song model the standing checks 1/3 assert.

## Inputs / context

Specification (cifra.md `spec/`), the sections this task implements:

- **§1 Document structure** —
  [`spec/1-document.md`](/home/ruoso/devel/cifra.md/spec/1-document.md): §1.1
  encoding and §1.3 text/lines (lines 5–71, the `text.js` floor); §1.4 title
  and properties (lines 72–153) — §1.4.1 title (a level-1 ATX heading that is
  the first non-blank line; `#` alone is no title), §1.4.2 properties (a
  Markdown list immediately after the title; key `[A-Za-z0-9_-]+` lowercased,
  space after the colon required, first-appearance order kept, last value wins
  on repeat), §1.4.3 reserved keys (`notation` ∈ brazilian/american/realbook,
  default brazilian; `words` yes/no overrides sung detection; unknown keys
  kept); §1.5 the two parts (lines 154–172), §1.6 the rule (`---`, the first
  one outside a fence ends the chart; a later one reported and ignored); §1.7
  headings (lines 191–292) — §1.7.1 Markdown (outside a fence), §1.7.2 bracket
  `[Intro]` and §1.7.3 label `Intro:` (inside a fence), §1.7.4 anchor `@N` and
  count on a heading; §1.8 sections (lines 293–309, music before the first
  heading is the empty-named section; empty sections kept); §1.9 fences and
  notes (lines 311–383) — fenced code blocks hold music; an empty/`cifra` info
  string is music, anything else verbatim; outside a fence in the chart every
  non-heading line is notes kept verbatim; `//` is an annotation; an unclosed
  fence runs to end of document.
- **§2 The chart** —
  [`spec/2-chart.md`](/home/ruoso/devel/cifra.md/spec/2-chart.md): §2.1 chord
  lines, §2.2 measures and bar lines (`|`, `||`), §2.3 items and the strict
  classification order (lines 60–97), §2.4 chord tokens and footnote markers
  (the `(symbol, index)` voicing key; `[0]`/`[1]` read as index 1; gaps kept,
  never renumbered by the reader), §2.5 several chords in a measure, §2.6 the
  no-chord mark, §2.7 repeat items, §2.8 bar anchors and bar numbers (lines
  178–256 — anchors set a measure's number and carry forward), §2.9 unknown
  tokens (lines 257–272 — an unknown token is **not** a diagnostic).
- **§3 Repeats** —
  [`spec/3-repeats.md`](/home/ruoso/devel/cifra.md/spec/3-repeats.md): §3.1 the
  `%` sign, §3.2 groups (`|:…:|` or cifra brackets, interchangeable, no
  nesting), §3.3 counts (`x2`/`2x`/`×2`/`(2x)`/`bis`), §3.4 endings (`N.`),
  §3.5 expansion (OPTIONAL per §9.1 — not done, see §Decisions), §3.6 repeats
  and words.
- **§4 Words** —
  [`spec/4-lyrics.md`](/home/ruoso/devel/cifra.md/spec/4-lyrics.md): §4.1 line
  shapes (forced/blank/chords/prose/chart), §4.2 whether the document is sung
  (a `chords` line immediately followed by a `prose` line with ≥2 words, or any
  `forced` line; `words:` overrides; the reader exposes `sungAt`), §4.3 forcing
  a line with `>`, §4.4 columns (Unicode code points, from 0) and attachment
  (each measure-making item attaches to a character; bar lines, marks, counts,
  endings and anchors have columns but no words; a `lead` item holds words
  before the first attached item), **§4.5 laying out a sung line (lines
  188–336)** — read in full; the heart of this task (below), §4.6 breaks (a run
  of blank lines between two music lines kept as a `break` line), §4.7 a sung
  document has no bar numbers.
- **§5 Chord symbols** —
  [`spec/5-chord-symbols.md`](/home/ruoso/devel/cifra.md/spec/5-chord-symbols.md):
  already implemented by `chord.js`; the reader is its caller and owns the
  §1.4.3 `notation` → dialect resolution and the `bad-notation` diagnostic.
- **§6 Tunings** —
  [`spec/6-tunings.md`](/home/ruoso/devel/cifra.md/spec/6-tunings.md): pitches
  in scientific notation (letter either case here, C4 = middle C), separated by
  commas/spaces; identity by sound (§6.3); a single pitch is not a tuning
  (§6.4).
- **§7 Voicings** —
  [`spec/7-voicings.md`](/home/ruoso/devel/cifra.md/spec/7-voicings.md): §7.2
  block headings `## <label>: <tuning>` (`Voicings` = the default variation,
  name `""`); §7.3 variations (no inheritance; duplicate tuning+name blocks
  merged, last wins); §7.4 voicing items (`- key: frets (fingers)`, keys
  matched char-for-char against chart tokens, not validated against §5, unique
  per block); §7.5 fret strings (one fret per string, compact or hyphenated,
  `x`/`X` for a muted string); §7.5.1 fingering (`bad-fingering`); §7.6
  resolving a chord to its shape; §7.7 the legend.
- **§9 Conformance** —
  [`spec/9-conformance.md`](/home/ruoso/devel/cifra.md/spec/9-conformance.md):
  §9.1 the reader profiles (this task is their union); §9.2 (lines 109–125) the
  general reader rules — a reader MUST NOT fail on a line it does not
  understand (report and continue), MUST NOT alter the input, and MUST report
  anything it does not keep so the app can warn before canonicalising drops it.

The Python reference — the behaviour to match, not code to translate
([`reference/README.md`](/home/ruoso/devel/cifra.md/reference/README.md)):

- `reference/cifra_md/parse.py` — `parse(text|bytes, dialect=None)` (line 986)
  over `_Parser` (lines 304–950). The pipeline in `run()` (line 375): marker
  scan (line 377, `marker-line`), `read_metadata` (line 327), dialect
  resolution (lines 381–385, `bad-notation`), the body state machine (lines
  394–483), `voicings_line` (line 495), `finish_sections` (line 587) and
  `result()` (line 931, which sorts diagnostics by line, sorts voicings and
  orders blocks). The finishing passes to port: `carry_anchors` (line 756,
  §2.8), `converge_sung` (line 785, §4.5), `number_bars` (line 798, §2.8,
  non-sung only), `pair_repeats` (line 828, §3), `check_repeat_signs` (line
  913), `_demote` (line 904). The per-line tokeniser `scan_line` (line 162) and
  `line_shape` (line 272, §4.1–§4.2).
- `reference/cifra_md/layout.py` — the §4.5 engine: `converge(line, text,
  dialect)` (line 366) and its helpers `unpad` (239), `line_tokens` (64),
  `_place` (306), `_padding` (271), `_pushed` (280), `_divide` (417),
  `_may_touch` (213). (The printing functions `chart_line_text`/`sung_text`/
  `chord_text`/`lyric_text` in the same file are the **writer's**.)
- `reference/cifra_md/tuning.py` (33 lines), `reference/cifra_md/frets.py` (73
  lines) — the §6/§7.5 helpers.
- Reference tests, the port oracles: `reference/tests/test_document.py`,
  `test_chart.py`, `test_repeats.py`, `test_lyrics.py`, `test_voicings.py`,
  `test_fingering.py`, `test_pitch_tuning_frets.py`, `test_marker_lines.py`.

The §4.5 layout convergence pass, the hard core (quoting
[`spec/4-lyrics.md`](/home/ruoso/devel/cifra.md/spec/4-lyrics.md)):

- Lead-in (lines 190–197): *"A reader lays out every sung line as canonical
  form writes it, and the model holds the result … The layout below is the one
  definition both use: the reader runs it once anchors carried from elsewhere
  (§2.8) have reached the line, and canonicalising runs it again on a line
  whose tokens §8.3 rewrote."* So the reader runs `converge` **after**
  `carry_anchors`, and the reader and the writer share one layout so reading a
  document and reading its canonical form give the same sung lines.
- The algorithm (§4.5.3, lines 252–315) is a single deterministic left-to-right
  pass tracking *end*, *shift*, *floor*, with at most one guard re-run (lines
  289–300: if the laid-out chord line would read as a heading/annotation/forced
  line, lay it out again with a leading `,` guard; if the padded words would
  not read as prose, the line becomes `forced` with a `>`). It is **idempotent,
  not iterative**: *"Laying out a line that is already laid out changes
  nothing"* (lines 311–315). "Convergence" is the fixed-point property across
  the reader↔writer round-trip, not an internal loop.

The corpus and harness:

- [`corpus/README.md`](/home/ruoso/devel/cifra.md/corpus/README.md) (lines
  7–58) — a reading entry's four files; the five numbered checks and the
  reference's sixth; *"a reader lays out every sung line as canonical form
  writes it (§4.5), so the two JSON files agree on every sung line's columns
  and words however the input was spaced"* (lines 29–38). 34 song reading
  entries (01–34); setlists (35–47) use a separate reader and are out of scope.
- `js/test/corpus/harness.js` (lines 162–291) — `readingChecks` builds, per
  song entry: `1` = `dump(parse(input bytes)) == input.parsed.json`, `2` =
  `write(…) == canonical`, `3` = `dump(parse(canonical bytes)) == parsed.json`,
  `4` = `write(parsed.json) == canonical`, `6` = `stripModel(canonical(input
  model)) == stripModel(parsed.json)`. `1` and `3` call only `parse`; `2`/`4`
  call `write`; `6` calls `canonical`.
- `js/test/corpus/expected-failures.json` — the ledger. Today it names
  `01-34/{1,2,3,4,6}` (checks that throw because `parse`/`write`/`canonical`
  stub). This task prunes `01-34/1` and `01-34/3` (68 ids). Checks 5 (schema)
  is not run in JS, and the born-passing `<entry>/tl` and `<entry>/chords`
  checks are already green.

Governing component boundaries:
[`docs/DIRECTION.md`](../../docs/DIRECTION.md) §3.6 (lines 264–269, cifra.md for
JavaScript in `js/`, *"Reads and canonicalizes songs and setlists, merges,
diffs in musical terms. The app's."*) and §3.7 (lines 402–404, *"The music
core … and cifra.md for JavaScript know nothing of React; the view is the only
layer that does."*).

## Constraints / requirements

- **Framework-free, zero runtime dependencies, ES modules** (DIRECTION §3.7).
  `js/src/` imports only other `js/src/` modules and uses only language
  built-ins; no Node built-in in `src` (the corpus harness, in `js/test/`, is
  the only place `node:fs` appears). The reader knows nothing of React.
- **Port the reference; never import, transpile or shell out to it.**
  Implementations agree because they are checked against the spec and held to
  the corpus byte for byte, not because they share code (the standing rule;
  DIRECTION §3.6). The reference is the second opinion on behaviour; a
  disagreement is settled in the spec, never by copying.
- **Plain-object model with pinned key order; compare bytes, never
  deep-equal.** The model is plain objects and arrays in the reference's exact
  key order (the corpus check serialises with `dump` = `JSON.stringify(…, 2) +
  "\n"` and compares to the stored JSON byte for byte; key insertion order and
  array order are part of conformance). `result()` orders diagnostics by line,
  orders voicings, and orders blocks by tuning id then label — the reader must
  match.
- **The reader never throws on malformed input.** Everything it cannot keep is
  a diagnostic `{ code, line, message, text? }`; it reads and keeps the rest
  (§9.2). The single exception is invalid UTF-8: `prepare`/`decode` raise
  `NotUtf8Error` because such bytes are not a document, and `parse` lets it
  propagate to the caller (the index.js contract comment; the reference does
  the same). An unknown token is kept, not diagnosed (§2.9).
- **Columns are Unicode code points, from 0, in the §1.3-prepared text**
  (§4.4). The model's columns and the words are those of the §4.5 laid-out
  line, so reading a document and reading its canonical form produce the same
  sung lines. `converge` is idempotent.
- **Canonical form over preserving content is the writer's rule; the reader's
  job is to report what canonicalising will drop.** The reader keeps and
  diagnoses the uncanonical input (non-property list items, later rules,
  problem voicings, stray marks) so the app can warn before a save drops them
  (§9.2; corpus/README lines 11–13). The reader does not canonicalise.
- **A marked text (conflict markers) is surfaced, never silently read as
  music.** The reader emits a `marker-line` diagnostic for every conflict
  marker (§11.12.3, via `isMarkerLine`); the standing rule that a marked text
  is never canonical and never saved/pushed is enforced above the reader (the
  app refuses to save while the diagnostic is present).
- **No song text in logs; test fixtures are purpose-written.** Unit tests use
  tiny songs written for the purpose, never anyone's copyrighted words (the
  corpus entries are already purpose-written).
- **Reuse the settled seams.** `prepare` (text.js) for the text layer;
  `parseChord`/`DIALECTS`/`DEFAULT_DIALECT` (chord.js) for every chart token;
  `parseNote`/`formatNote` (pitch.js) for tuning pitches; `mdHeading`/
  `fenceOpen`/`closesFence` (markdown.js) for the title and fences. One correct
  copy, imported, not re-derived.

## Acceptance criteria

**Behaviour delivered.** `js/src/parse.js` implements `parse(bytes) → model`
for §1–§7 — metadata, the chart/voicings split, sections and the three heading
forms, fences and notes, the chart tokeniser (measures, items, chords via
`chord.js`, footnote markers, the no-chord mark, bar anchors and numbers,
unknown tokens), repeats kept as written (§3), sung detection with `sungAt`,
attachment and the §4.5 layout convergence pass (`js/src/layout.js`), tunings
(`js/src/tuning.js`) and voicings with fret strings and fingerings
(`js/src/frets.js`), and all 22 diagnostics — matching the reference byte for
byte on every song corpus model. `parse` replaces its `index.js` stub; `write`,
`canonical` and `merge` stay stubs. `scripts/gate cifra.md` runs it all via
`npm test` in `js/` (gate lines 378–382) alongside the reference's unchanged
`pytest`.

**Tests the task lands with, by level** (the `.tji` `Tests:` clause names
unit + corpus; format work's conformance level **is** the corpus — there are
no behavior, e2e-api or e2e-web levels). The unit files mirror the reference's
test split, on purpose-written inputs; the implementer may consolidate files
but must pin every §1–§7 construct and every one of the 22 diagnostics named
below:

- **unit (Vitest, `js/test/document.test.js`)** — §1, ported from
  `test_document.py` and `test_marker_lines.py` (reader side): title present
  and absent (`#` alone, first-non-blank rule, a level-1 heading elsewhere is a
  section), property grammar (key charset and lowercasing, the required space
  after the colon, first-appearance order, last-wins on repeat, empty values,
  a list after no title); reserved keys including `notation` resolution and
  `words: yes/no` override; the chart/voicings split at the rule and a later
  rule reported; the three heading forms and §1.7.4 anchor/count; the
  empty-named section and kept empty sections; fences vs notes vs verbatim by
  info string, `//` annotations, an unclosed fence to end of document; a
  conflict marker. Diagnostics pinned here: `marker-line`, `duplicate-property`,
  `bad-property`, `bad-notation`, `heading-looks-like-key`, `extra-rule`,
  `unclosed-fence`, `unfenced-music`.
- **unit (Vitest, `js/test/chart.test.js`)** — §2, ported from `test_chart.py`:
  measures and bar lines (`|`, `||`), the §2.3 item classification order, chord
  tokens and footnote markers (`(symbol, index)` key, `[0]`/`[1]` → index 1,
  gaps kept and not renumbered), several chords in a measure, the no-chord mark,
  bar anchors and bar numbers (§2.8 carry-forward), and unknown tokens kept
  without a diagnostic (§2.9). Measures-with-no-items are not measures.
- **unit (Vitest, `js/test/repeats.test.js`)** — §3, ported from
  `test_repeats.py`: the `%` sign kept as a bar, groups (`|:…:|` and cifra
  brackets, interchangeable), counts (`x2`/`2x`/`×2`/`(2x)`/`bis`) as group,
  line and section counts, and endings (`N.`). Repeats kept as written, not
  expanded (§3.5 optional — §Decisions). Diagnostics pinned here:
  `repeat-without-previous`, `repeat-beside-items`, `stray-mark`,
  `unclosed-group`, `ending-outside-group`, `count-out-of-place`,
  `bad-ending-sequence`, `count-with-endings`.
- **unit (Vitest, `js/test/lyrics.test.js`)** — §4.1–§4.4, §4.6–§4.7, ported
  from `test_lyrics.py`: the five line shapes; sung detection (a `chords` line
  immediately followed by a `prose` line with ≥2 words, a `forced` line, the
  `words:` override) and the `sungAt` the model exposes; forcing with `>`;
  columns in code points and attachment (the `lead` item, items with no words,
  words divided among attached items); breaks kept as `break` lines; a sung
  document has no bar numbers.
- **unit (Vitest, `js/test/layout.test.js`)** — **the §4.5 convergence pass**,
  ported from the reference's layout cases (`test_lyrics.py`/`test_fixed_point.py`
  and corpus entries 28/33/34 read through `converge`): a token that grows
  (`nc`→`N.C.`, `Cm`→`Cm[2]`) pushes the words right only when the gap cannot
  absorb it, always leaving one space; a token that shrinks (`(2x)`→`x2`) leaves
  the following tokens where they were; `_` padding inside a word vs space
  padding; the `,` guard when the laid-out line would read as a heading/
  annotation/forced; a line forced because its padded words would read as
  chords; carried anchors with and without room; a chord line longer than its
  words; and idempotence — laying out an already-laid-out line changes nothing.
- **unit (Vitest, `js/test/voicings.test.js`)** — §6 and §7, ported from
  `test_voicings.py`, `test_fingering.py` and `test_pitch_tuning_frets.py`:
  tuning parsing (either-case letters, comma/space separators, identity by
  sound, a single pitch is not a tuning); block headings and the default vs
  named variation; voicing items and char-for-char keys; fret strings (compact
  and hyphenated, `x`/`X`, position count equals string count); fingerings
  (fingers 1–4/`T`/`-`, barres); resolving a chord to its shape and "no chosen
  shape" as a non-error; duplicate blocks merged. Diagnostics pinned here:
  `bad-block-heading`, `item-outside-block`, `notes-outside-block`,
  `bad-voicing`, `bad-fingering`, `duplicate-block`.
- **corpus (Vitest, the `<entry>/1` and `<entry>/3` reading checks in
  `js/test/corpus.test.js` via `js/test/corpus/harness.js`)** — for every song
  entry 01–34, reading `input.cifra.md` gives `input.parsed.json` (check 1) and
  reading `canonical.cifra.md` gives `parsed.json` (check 3), compared byte for
  byte by `compareModelBytes`/`dump`. This task prunes the 68 ids
  `01-34/1` and `01-34/3` from `js/test/corpus/expected-failures.json` (and no
  others — the harness then asserts them to pass, and a regression fails the
  gate). The entries exercise, per `corpus/README.md`: metadata/properties
  (02, 25, 27), sections and headings (14, 25, 16, 30), fences/verbatim (15,
  21, 23, 32, 19), chord lines and spellings (01, 17, 18, 20, 10, 12),
  repeats/bars/counts/endings (07, 08, 22, 24), sung attachment and §4.5 layout
  (04, 13, 28, 33, 34), tunings and voicings (05, 06, 29), the diagnostics
  entry (11), the text layer (03, 26), and the edge documents (30 title-only,
  31 empty). The `<entry>/tl` and `<entry>/chords` born-passing checks stay
  green throughout.

The `.tji` `Tests:` clause is sharpened to these files and cases; no level it
names is dropped. See §Decisions for why checks 2/4/6 are **not** flipped here.

**Deferred work.** None registered by this task. Checks 2 and 4 (write) and 6
(canonical) for 01–34 are `cifra_js.writer`'s — its note already reads *"model
to canonical text and canonical text to canonical model, every entry, byte for
byte"*, and it `depends !reader`, consuming this model. They are not a
follow-up this task creates; they are an existing WBS leaf. The §5.7
model→symbol formatter and model-level canonicalisation (§8.2/§8.3) are the
writer's/editing's, as `chords.md` already recorded. No new leaf.

## Decisions

- **Four modules, ported from the reference with its split: `parse.js`,
  `layout.js`, `tuning.js`, `frets.js`.** `parse.js` is the reader proper;
  `layout.js` holds the §4.5 engine; `tuning.js` and `frets.js` are the §6/§7.5
  helpers. *Rationale:* the reference splits them exactly this way
  (`parse.py` imports `converge` from `layout.py`, and the voicings reader
  imports `parse_tuning`/`parse_frets`); the split keeps the §4.5 layout and
  the fret/tuning grammars independently and exhaustively testable, and matches
  the "port the reference's module split" rule the siblings set (`pitch.js`/
  `chord.js`, `markdown.js`). *Alternative rejected:* one monolithic `parse.js`
  — buries the §4.5 engine and the voicings grammar, and diverges from the
  reference layout the tests are ported from.
- **The §4.5 `converge` engine lands here, in `layout.js`; the writer's
  rendering functions join the same module later.** The reader needs `converge`
  and its token model (`line_tokens`, `_place`, `_padding`, `_divide`), because
  it lays out every sung line during the read (§4.5 lead-in). The printing
  functions in the reference's `layout.py` (`chart_line_text`, `sung_text`,
  `chord_text`, `lyric_text`) are model→text and belong to `cifra_js.writer`,
  which will add them to `layout.js`. *Rationale:* one shared layout is the
  spec's whole point — the reader lays a line out exactly as the writer prints
  it, so reading a document and reading its canonical form agree; putting
  `converge` and the writer's renderers in one module keeps that shared token
  model in one place, as the reference does. *Alternative rejected:* a separate
  reader-only layout — risks drifting from the writer's placement and breaking
  the round-trip the corpus pins.
- **This task flips reading checks `1` and `3` only; `2`/`4`/`6` are the
  writer's.** Checks 1 and 3 call only `parse`, which this task implements, so
  it turns `01-34/1` and `01-34/3` green (68 ledger ids). Checks 2 and 4 call
  `write`, and check 6 calls `canonical` (model-level canonicalisation,
  §8.2/§8.3/§4.5) — both still stubs after this task; §8 is `cifra_js.writer`'s
  chapter. *Rationale:* the harness makes a check flip only when the function it
  calls is implemented, and the reader note scopes *"input to model"* (the two
  reading directions), while the writer note scopes the writing directions and
  the canonical-model check. The reader builds the `converge` engine check 6
  will reuse, but the §8.2/§8.3 canonicalisation around it is the writer's.
  *Alternative rejected:* claiming check 6 here — `canonical` is the §8
  normalisation the writer task owns; flipping it would need code outside this
  task's §1–§7 scope, and the closer would find `canonical` still a stub.
- **`parse` takes bytes and never throws except `NotUtf8Error`.** Malformed
  content is reported as a diagnostic and the rest is kept (§9.2); only invalid
  UTF-8 raises, from the text layer, and propagates to the caller. *Rationale:*
  the `index.js` stub contract already fixes "takes bytes because the text layer
  begins by validating UTF-8"; §9.2 forbids failing on an understood-or-not
  line; the reference returns a model with diagnostics rather than raising, so
  the app's per-document read needs no try/catch except around the
  not-a-document UTF-8 case. *Alternative rejected:* throwing on malformed music
  — diverges from the reference and §9.2 and makes every caller defensive.
- **The `notation` → dialect resolution and `bad-notation` are the reader's,
  feeding `chord.js`.** The reader lowercases the `notation` property (or a
  caller override), falls back to `brazilian` with a `bad-notation` diagnostic
  on an unknown value (§1.4.3), and passes the resolved dialect id to
  `parseChord` for every token. *Rationale:* `chords.md` explicitly left this to
  the reader — `parseChord` is a pure function of `(symbol, dialect)` and has no
  document; the diagnostic is about the document, not one chord; the reference
  splits exactly here (`parse.py` resolves, `chord.py` consumes). *Alternative
  rejected:* resolving inside `chord.js` — it has no document to resolve from
  (already decided in `chords.md`).
- **Diagnostic codes match the reference and the committed corpus exactly; the
  reader emits the 22 song-reader codes.** The 21 codes the song reading corpus
  pins (`bad-block-heading`, `bad-ending-sequence`, `bad-fingering`,
  `bad-notation`, `bad-property`, `bad-voicing`, `count-out-of-place`,
  `count-with-endings`, `duplicate-block`, `duplicate-property`,
  `ending-outside-group`, `extra-rule`, `heading-looks-like-key`,
  `item-outside-block`, `notes-outside-block`, `repeat-beside-items`,
  `repeat-without-previous`, `stray-mark`, `unclosed-fence`, `unclosed-group`,
  `unfenced-music`) plus `marker-line` (emitted by the reader but exercised by
  no song reading entry — unit-tested from `test_marker_lines.py`).
  *Rationale:* the corpus `parsed.json` files store `{ code, line, message }`
  and the checks compare byte for byte, so the code strings and the messages are
  pinned by the committed corpus, not chosen by this implementation; matching
  the corpus is how JS and Go agree (checked, not shared). The spec states
  diagnostics as prose "a reader MUST report …" obligations and names an
  explicit code only for `bad-fingering` (§7.5.1) — the full code set is
  normative only through the reference and the corpus. *Alternative rejected:*
  inventing JS-local codes or messages — fails the corpus byte comparison and
  breaks agreement with Go and the reference.
- **Repeats are kept as written; §3.5 expansion is not implemented.** The reader
  pairs groups, counts and endings and records them, but does not expand a
  repeat into played-out measures. *Rationale:* §9.1 marks expansion OPTIONAL,
  no corpus entry expands, and canonical form writes repeats as written
  (§8); building expansion would be untested by any corpus check this task
  lands and speculative ahead of a caller. *Alternative rejected:* expanding
  here — unpinned by the corpus and not required by any reader profile the app
  needs.
- **No design delta.** §1–§7, §4.5, §1.4.3 and §9.2 are already normative; the
  reading corpus checks are the pinned conformance level, not new designed
  behaviour; no new runtime dependency is added. *Rationale and alternative*
  mirror [`package.md`](./package.md), [`text_layer.md`](./text_layer.md) and
  [`chords.md`](./chords.md): a format task that implements the spec as written
  needs no spec change, and the spec moves only when behaviour does.

## Open questions

- **The spec states reader diagnostics as prose obligations, not a normative
  code table.** Only `bad-fingering` has an explicit code in the specification
  (§7.5.1); the other 21 reader codes and their messages are normative only
  through the reference and the committed corpus, which this task matches byte
  for byte. Whether `spec/` should gain a consolidated, normative
  diagnostic-code table (so the reader's observable surface is pinned by the
  spec and not only by the corpus) is a format-area documentation judgement,
  not code this task can land, and is surfaced for the parking lot / format-area
  review rather than encoded as a WBS task. It does not block this task — the
  corpus pins every code this reader emits.

## Status

**Done** — 2026-10-05.

- cifra.md `9eb9a7c`: `js/src/parse.js` — song reader (§1–§7 state machine, all 22 diagnostics, `parse(bytes) → model`)
- cifra.md `9eb9a7c`: `js/src/layout.js` — §4.5 `converge` engine and token model (`line_tokens`, `_place`, `_padding`, `_divide`)
- cifra.md `9eb9a7c`: `js/src/tuning.js` — §6 tuning helpers (`parseTuning`, `tuningId`, `isTuning`)
- cifra.md `9eb9a7c`: `js/src/frets.js` — §7.5 fret-string and fingering helpers (`parseFrets`, `formatFrets`, `parseFingers`, `checkFingers`, `formatFingers`)
- cifra.md `9eb9a7c`: `js/src/pitch.js` extended — `parsePitch`, `midi`, `canonicalPitchText` added (§6.1 half deferred by `cifra_js.chords`)
- cifra.md `9eb9a7c`: `js/src/index.js` updated — real `parse` re-export replacing the stub; `write`/`canonical`/`merge` remain stubs
- cifra.md `9eb9a7c`: `js/test/corpus/expected-failures.json` pruned — 68 ids `01-34/1` and `01-34/3` removed; reading checks now passing byte-for-byte
- cifra.md `9eb9a7c`: unit tests — `document.test.js` (29), `chart.test.js` (12), `repeats.test.js` (18), `lyrics.test.js` (9), `layout.test.js` (11), `voicings.test.js` (27); 744 total JS tests green
