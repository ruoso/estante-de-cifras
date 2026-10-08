# cifra_go.reader — Reader

## TaskJuggler entry

[`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 15–20, task
`cifra_go.reader` (fully-qualified `cifra_go.reader`):

> **Reader** — `effort 8d`, `allocate team`, `depends !module`.
> note: "cifra.md: text layer, chord symbols, chart, sung lines with layout
> convergence, tunings, voicings. Tests: unit (text layer, chord symbols,
> chart, sung lines with convergence, tunings, voicings, diagnostics);
> corpus (input to model for every entry)."

The note starts with `cifra.md:`, so the work lands in the sibling
[cifra.md](https://github.com/ruoso/cifra.md) repository; the refinement,
its Status block and `complete 100` land here.

## Effort estimate

**8 days.** The reader is the largest single leaf in the cifra_go stream:
it collapses three JavaScript tasks (`cifra_js.text_layer`,
`cifra_js.chords`, `cifra_js.reader`) into one Go task. The text layer is
already shared (landed by `cifra_go.setlists`), so the eight days cover the
chord/pitch parser (§5, §6-pitches), the chart tokeniser (§2, §3), the
words and sung-line layout-convergence engine (§4, §4.5 — the hard core),
and the voicings/tunings readers (§6, §7), plus the full diagnostic set and
the corpus flip.

## Repository

**cifra.md**, directory `go/` (and `go/internal/corpus/` for the harness
checks). New source files in package `cifra` at the module root, new
`*_test.go` unit files beside them, and edits to
`go/internal/corpus/harness.go` and `go/internal/corpus/expected-failures.json`.
In **estante-de-cifras**, only this refinement, its Status block, and
`complete 100` in `tasks/15-cifra-go.tji`.

## Inherited dependencies

- **`cifra_go.module`** — settled. Done 2026-10-07, cifra.md `2200741`.
  Refinement [`cifra_go/module.md`](module.md). Shipped the module
  (`github.com/ruoso/cifra.md/go`, package `cifra`, `go 1.25`), the
  order-preserving model type `Object` with `DecodeModel`/`Encode`
  ([`go/model.go`](../../../../cifra.md/go/model.go)), the stub corpus-facing
  ops including `Parse`/`Write`/`Canonical` ([`go/cifra.go`](../../../../cifra.md/go/cifra.go)),
  and the corpus harness + embedded ledger
  ([`go/internal/corpus/harness.go`](../../../../cifra.md/go/internal/corpus/harness.go),
  `expected-failures.json`). **This task implements `Parse`.**
- **`cifra_go.setlists`** — not a dependency, a **sibling** (both
  `depends !module`), but it has landed (Done 2026-10-08, cifra.md
  `839d8c9`, refinement [`cifra_go/setlists.md`](setlists.md)) and left two
  shared internals the reader stands on: the §1.3/§10.2 text layer
  [`go/text.go`](../../../../cifra.md/go/text.go) (`prepare`: UTF-8 reject,
  BOM strip, NFC, line split, tab→space, trailing-space strip) and the
  §1.4.1/§1.9 block primitives [`go/markdown.go`](../../../../cifra.md/go/markdown.go)
  (`mdHeading`, `fenceOpen`, `closesFence`, `asciiLower`). It also added the
  one allowed non-stdlib dependency, `golang.org/x/text`'s `unicode/norm`.
- **`format.canonical_form`** — settled before the refinements directory
  existed (no refinement document; cited directly). Shipped the
  specification §1–§8, the Python reference reader + canonical writer, and
  the four-file song corpus, entries `corpus/01-…` through `corpus/34-…`,
  closing the read/write cycle both ways. This is the corpus the Go reader
  is held to. See [`corpus/README.md`](../../../../cifra.md/corpus/README.md)
  and [`reference/README.md`](../../../../cifra.md/reference/README.md).

## What this task is

Implement `cifra.Parse(src []byte) (Model, error)` in Go: the song reader
for the cifra.md format, turning the bytes of a `.cifra.md` file into the
document model that [`go/model.go`](../../../../cifra.md/go/model.go) already
holds and `Encode` already serialises. It is the union of the four reader
profiles in [`spec/9-conformance.md`](../../../../cifra.md/spec/9-conformance.md)
— Chart reader (§1, §2, §3, §5-validity), Chord reader (the full §5.2 chord
model), Cifra reader (§4 words and §4.5 sung-line layout convergence) and
Voicings reader (§6 tunings, §7 voicings) — plus the complete set of reader
diagnostics. It builds the whole document model: title, properties,
sections (headings, chord/sung/lyric/annotation/break lines, measures,
items), voicing blocks, the derived `sung`/`sungAt` facts, and the
`diagnostics` array, all in the pinned key order and compared byte for byte
against the corpus. It does **not** write canonical text (`Write`,
`Canonical` stay stubs — `cifra_go.writer`), and it does not merge.

## Why it needs to be done

The reader is the bottom of the cifra_go implementation stack. Its direct
consumers in the WBS:

- **`cifra_go.writer`** (`depends !reader`) — the §8 canonical serialiser
  and `is canonical`, which the hook needs to check a push (workflow 14,
  DIRECTION §3.6). The writer re-derives and re-lays-out through the same
  model and layout engine the reader builds; `Canonical(m) =
  Parse(Write(m))` depends on reading.
- **`cifra_go.versions`** (`depends !writer`) and **`cifra_go.merge`**
  (`depends !writer, !setlists`) — both build on the read model.
- **`cifra_go.conformance`** — empties the ledger; the reader prunes its
  own checks toward that.

DIRECTION §3.6 ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) line 285):
"cifra.md for Go … Reads and canonicalizes songs and setlists. The hook's;
also a git merge driver for computers." The one server checks "that a push
holds canonical ones, which the Go implementation does in the hook"
(DIRECTION line 290). The hook cannot judge a song canonical without a Go
reader. This task is on the path to the **cifra.md-for-Go milestone** (see
[`tasks/99-milestones.tji`](../../99-milestones.tji)).

## Inputs / context

Normative specification (cifra.md repository, `spec/` — read, not optional;
the reader turns these into a work order):

- [`spec/1-document.md`](../../../../cifra.md/spec/1-document.md) — the
  document structure. §1.3 "Text and lines" (line 28) is the text-layer
  stage, already provided by `go/text.go`. §1.4 title/properties, §1.5–1.6
  the two parts and the rule, §1.7 headings, §1.8 sections, §1.9 fences and
  notes.
- [`spec/2-chart.md`](../../../../cifra.md/spec/2-chart.md) — the chart:
  chord lines and runs (§2.1 line 7), measures and bar lines (§2.2), items
  (§2.3), chord tokens and footnote markers (§2.4), several chords per
  measure (§2.5), N.C. (§2.6), repeat items (§2.7), bar anchors/numbers
  (§2.8), unknown tokens (§2.9 — kept, never diagnosed).
- [`spec/3-repeats.md`](../../../../cifra.md/spec/3-repeats.md) — repeats;
  repeat-group pairing (§3.2). §3.5 expansion is OPTIONAL and no corpus
  entry expands (see Decisions).
- [`spec/4-lyrics.md`](../../../../cifra.md/spec/4-lyrics.md) — "Words". §4.2
  (line 49) decides whether a document is sung; §4.4 "Sung lines: columns
  and attachment" (line 100) and §4.5 "Laying out a sung line" (line 188)
  are the layout-convergence core: a reader re-lays-out every sung line
  exactly as canonical form writes it, "so that the model holds the line as
  canonical form writes it" (line 104), columns counted in NFC code points
  from column 0.
- [`spec/5-chord-symbols.md`](../../../../cifra.md/spec/5-chord-symbols.md) —
  chord grammar: root (§5.1.1), bass (§5.1.2), body (§5.1.3); the
  dialect-free canonical model `Chord{root, quality, extensions, bass}` in
  §5.2 (line 48); §5.4 "Errors" (line 220) — an invalid symbol is reported
  and kept as an unknown token (§2.9), never discarded; §5.6 the three
  dialects and four ambiguous spellings; §5.7 preferred spellings.
- [`spec/6-tunings.md`](../../../../cifra.md/spec/6-tunings.md) — §6.1
  "Pitches" (line 18), scientific pitch notation reusing the §5.1.1 root
  grammar; §6.2 how a tuning is written, §6.3 identity, §6.4 not-a-tuning.
- [`spec/7-voicings.md`](../../../../cifra.md/spec/7-voicings.md) — voicing
  blocks: §7.2 headings, §7.3 variations, §7.4 items (key→shape), §7.5 fret
  strings and §7.5.1 fingering, §7.6 resolving occurrences to shapes, §7.7
  the legend.
- [`spec/9-conformance.md`](../../../../cifra.md/spec/9-conformance.md) — the
  reader profiles (Chart line 9, Chord line 34, Cifra line 42, Voicings line
  48) and §9.2 "What every profile must do" (line 109): a reader MUST NOT
  fail on a line it does not understand (report and continue), MUST NOT
  alter the document, MUST keep unknown properties, MUST report whatever it
  does not keep.
- [`spec/0-overview.md`](../../../../cifra.md/spec/0-overview.md) — §0.4 "The
  document model" (lines 109–191): top-level `Document{title, properties,
  sections, blocks, sung, sungAt, diagnostics}`; §0.6 (lines 222–246) the
  reader's processing order. The normative shape is the JSON Schema
  [`schema/cifra.schema.json`](../../../../cifra.md/schema/cifra.schema.json)
  (`Diagnostic` def lines 397–407: `{code, message, line, text?}`).

The reference — **the behaviour to port, the specification's second
opinion, not code to translate**:
[`reference/cifra_md/parse.py`](../../../../cifra.md/reference/cifra_md/parse.py)
(`parse` line 986, the `_Parser` class line 304, `diag` line 314,
`converge_sung` line 785, `number_bars` line 798, `pair_repeats` line 828,
`result` line 931 with the final key order and sorts), plus the chord/pitch
helpers it exports. The JavaScript twin — **read, not imported** —
[`js/src/parse.js`](../../../../cifra.md/js/src/parse.js) (`parse` line 1105,
`rederive` line 1117, the `Parser` class), `js/src/chord.js`,
`js/src/pitch.js`, `js/src/layout.js`, and the matching refinements
[`cifra_js/reader.md`](../cifra_js/reader.md),
[`cifra_js/chords.md`](../cifra_js/chords.md),
[`cifra_js/text_layer.md`](../cifra_js/text_layer.md) — the three JS tasks
Go folds into this one.

Seams already in `go/` (reuse, do not re-derive):
[`go/model.go`](../../../../cifra.md/go/model.go) (`Object`, `DecodeModel`,
`Encode`); [`go/text.go`](../../../../cifra.md/go/text.go) (`prepare`);
[`go/markdown.go`](../../../../cifra.md/go/markdown.go) (`mdHeading`,
`fenceOpen`, `closesFence`, `asciiLower`);
[`go/setlist.go`](../../../../cifra.md/go/setlist.go) as the idiomatic
template for diagnostic closures and order-preserving model building;
[`go/cifra.go`](../../../../cifra.md/go/cifra.go) (the `Parse` stub to
replace). The corpus harness and ledger:
[`go/internal/corpus/harness.go`](../../../../cifra.md/go/internal/corpus/harness.go)
(`ReadingChecks` line 145, the `/tl` and `/chords` TODO at lines 14–17),
`expected-failures.json`, `corpus_test.go` (`TestCorpusConformance`); the JS
harness's `/tl` and `/chords` check definitions in
[`js/test/corpus/harness.js`](../../../../cifra.md/js/test/corpus/harness.js)
lines 184–294, to mirror. Corpus layout:
[`corpus/README.md`](../../../../cifra.md/corpus/README.md).

## Constraints / requirements

- **`Parse(src []byte) (Model, error)`.** Takes bytes (the text layer
  validates UTF-8 first); returns the `Object`/`[]any` model and an error.
  The **only** error `Parse` returns is invalid UTF-8 (`NotUTF8Error` from
  `go/text.go`) — a non-UTF-8 input is not a document and no model is built.
  Everything else unparseable becomes a **diagnostic inside the model**,
  never a Go error; the reader never fails on a line it does not understand
  (§9.2). Mirror JS/reference exactly: diagnostics are data, not control
  flow.
- **Reuse the model, do not redefine it.** Build the document as `Object`
  (order-preserving) and `[]any` directly, in the pinned top-level key order
  `title, properties, sections, blocks, sung, sungAt, diagnostics`
  (§0.4). Serialise with the existing `Encode`; **correctness is byte-for-byte
  on the serialisation, never deep-equal** — key order (including
  `properties` order), field presence/omission (e.g. `ambiguities` omitted
  when empty), and `diagnostics` sorted by line are all part of the bytes.
- **Reuse the text layer and block primitives.** `prepare` from `go/text.go`
  and `mdHeading`/`fenceOpen`/`closesFence`/`asciiLower` from
  `go/markdown.go`. Do not bring a second text layer.
- **Port the chord/pitch parser; do not share code.** §5 and §6-pitches have
  no Go implementation yet. Add them (new `go/chord.go` + `go/pitch.go` or
  equivalent) as a faithful port of the reference's behaviour, held to the
  corpus — never transpiled from, vendored from, or shelling out to the JS
  or Python. Expose `parseChord` and `DIALECTS` so the harness `/chords`
  check can call them (lowercase/internal is fine; the harness is in the
  same module via `internal/corpus` injection — match how setlists wired
  its ops into `Impl`).
- **The §4.5 layout convergence is a single deterministic left-to-right
  pass**, run once after anchors carry (§2.8), idempotent — "convergence" is
  the fixed-point property across the reader↔writer round-trip, **not** an
  internal iteration loop. At most one guard re-run (the leading-`,` guard,
  or the line becomes `forced` with `>`), exactly as the reference does.
  Reading a document and reading its canonical form give the same sung lines
  (§4.5 line 190).
- **Diagnostics match the reference byte for byte** — every code, message
  and line number. Agreement is by corpus, not by shared code. The reader
  carries the full song-reader diagnostic set the corpus pins (the JS reader
  pinned 22 codes, 21 song-reader codes plus `marker-line`); the exact Go
  set is whatever the corpus bytes require.
- **`notation` → dialect resolution and the `bad-notation` diagnostic are
  the reader's**, feeding the chord parser. An unknown chord token is kept
  (§2.9), not diagnosed.
- **Standard library plus `golang.org/x/text` only** (already a dependency,
  for NFC via `go/text.go`). No new runtime dependency.

### Standing rules, scoped

This is pure format work in a library module. Of the project's standing
rules: **canonical form over preserving content** applies at one remove —
the reader does not write, but it builds the model the writer canonicalises,
and §9.2 requires it to *report* (as diagnostics) everything it will not
keep so an app can warn the author. **No song text in logs** applies: the
reader library does not log, and its unit tests use **songs written for the
purpose** (the corpus is such); never someone else's words. The UI standing
rules — **accessibility**, **offline first**, **no book without an account**
— **do not apply**: there is no interface, no network, no storage, and no
account in a format reader. Stated so the omission is deliberate.
**Implementations agree because they are checked, not because they are
shared** (DIRECTION §3.6) is the governing rule: the corpus harness is the
check; a disagreement with JS or the reference is settled in the spec, never
by copying one implementation into another.

## Acceptance criteria

### Behaviour delivered

`cifra.Parse` reads every §1–§7 construct into the §0.4 model: the text
layer (via `prepare`), chord symbols with the full §5.2 model and dialect
resolution, the chart (chord lines, runs, measures, items, bar numbering,
repeat pairing), words and sung lines re-laid-out through the §4.5
convergence pass, tunings (§6) and voicing blocks (§7) with occurrences
resolved to shapes, the derived `sung`/`sungAt`, and the full `diagnostics`
array — all in pinned key order, serialising byte-for-byte to the corpus
JSON via `Encode`. `Write`/`Canonical` remain stubs (the writer's task).

### Tests the task lands with, by level

Format work's behaviour/conformance level **is the corpus**; there are no
behavior, e2e-api or e2e-web levels for a library reader (no component, no
HTTP, no screen). The note names `unit` and `corpus`; both land here.

- **unit** (`go test ./...` in `go/`), purpose-written inputs, each file
  pinning a spec area:
  - `document_test.go` — §1: title, properties (order kept), headings,
    sections, fences and notes, unknown properties kept (§9.2).
  - `chart_test.go` — §2: chord lines and runs, measures and bar lines,
    items, several chords per measure, N.C., bar anchors and numbering,
    unknown tokens kept (§2.9).
  - `repeats_test.go` — §3: repeat items and §3.2 group pairing.
  - `chord_test.go` / `pitch_test.go` — §5 and §6.1: root/bass/body grammar,
    the §5.2 model, the three dialects and four ambiguities (§5.6), §5.4
    errors reported-and-kept; scientific pitch notation.
  - `lyrics_test.go` — §4.1–§4.7: the sung/lyric/annotation classification
    (§4.2), attachment.
  - `layout_test.go` — §4.5 convergence: a sung line and its canonical form
    read to the same model; the leading-`,` guard and the `forced`/`>`
    branch; idempotence.
  - `voicings_test.go` — §6/§7: tunings, voicing blocks, fret strings and
    fingerings (§7.5), occurrences resolved to shapes (§7.6), the legend
    (§7.7).
  - `diagnostics_test.go` — every reader diagnostic code the corpus pins,
    with its message and line, plus the `NotUTF8Error`-only error path and
    `bad-notation`.
- **corpus** (`go/internal/corpus`, `TestCorpusConformance`):
  - Flip song reading **checks 1 and 3** for entries `01-…` through `34-…`:
    `Parse(input.cifra.md)` serialises to `input.parsed.json`, and
    `Parse(canonical.cifra.md)` serialises to `parsed.json`. The 68 ids
    `01-…/1`…`34-…/1` and `01-…/3`…`34-…/3` are **pruned** from
    `expected-failures.json`. Checks **2, 4 and 6 remain ledgered** — they
    call `Write`/`Canonical`, which `cifra_go.writer` implements (the harness
    flips a check only when the function it calls is done). This mirrors the
    JS reader exactly ([`cifra_js/reader.md`](../cifra_js/reader.md): "flipped
    only checks 1 and 3").
  - Add the two born-passing checks the module deferred to this task
    ([`cifra_go/module.md`](module.md), harness TODO at `harness.go` lines
    14–17), mirroring `js/test/corpus/harness.js` lines 184–294, **outside
    the ledger**: `<entry>/tl` — the canonical text is a fixed point of
    `prepare` (rejoin by LF, one trailing LF iff non-empty) for every reading
    entry; `<entry>/chords` — for every stored `type:"chord"` item,
    re-derive its model from its written symbol under the document's dialect
    via the ported `parseChord`/`DIALECTS` and compare byte-for-byte to the
    stored `chord` (+`ambiguities` with the same omit-when-empty rule), for
    every entry whose model holds chords. The stale-id guard
    (`TestLedgerNamesNoCheckThatDoesNotExist`) and the "ledgered but passed —
    prune it" assertion keep the flip honest.

The closer verifies every named test exists and ran (not skipped) in the
gate (`scripts/gate` `go_checks`, over the cifra.md checkout) before
committing.

### Deferred work

- Checks **2, 4, 6** for songs 01–34 and the §8 serialiser are **not a
  deferral this task creates** — they are the existing WBS leaf
  `cifra_go.writer` (`depends !reader`, effort 4d, note starts `cifra.md:`),
  already in the WBS and the milestone. No new task.
- §3.5 repeat **expansion** is a **scope decision, not a deferral** (see
  Decisions): OPTIONAL per §9.1 and no corpus entry exercises it, so no WBS
  leaf.

No new WBS leaf is created by this task.

## Decisions

- **One Go file split mirroring the reference's concerns, under package
  `cifra`.** Add `go/chord.go` (+ `go/pitch.go` for §6.1 pitches), and a
  reader core (`go/parse.go`) with the §4.5 layout engine either inline or in
  `go/layout.go`, plus voicings/tunings handling (`go/voicings.go` /
  inline). *Rationale:* matches the reference's module concerns (parse,
  chord, pitch, layout, tuning, frets) and the flat package-`cifra` layout
  the module and setlists established; keeps the one-file-per-spec-area unit
  tests legible. *Alternative rejected:* a single monolithic `parse.go` —
  harder to test per spec area and diverges from the reference's structure
  the ports track.
- **Diagnostics are model data, not Go errors; `Parse` errors only on
  non-UTF-8.** *Rationale:* §9.2 — a reader reports and continues, never
  fails on an unparseable line; the corpus stores diagnostics inside the
  model and compares them as bytes. Matches `go/setlist.go`'s diagnostic
  closures and the JS/reference contract. *Alternative rejected:* returning
  an error for malformed content — would make the reader fail where the spec
  requires it to keep reading, and could not reproduce the corpus.
- **Flip only checks 1 and 3; leave 2/4/6 ledgered.** *Rationale:* the
  harness flips a check only when the function it calls is implemented;
  `Parse` is this task, `Write`/`Canonical` are `cifra_go.writer`. A clean
  scope boundary identical to the JS reader. *Alternative rejected:*
  implementing the writer here to flip all five — that is a separate 4d WBS
  leaf with its own §8 scope.
- **§3.5 repeat expansion is out of scope.** *Rationale:* OPTIONAL in §9.1
  and no corpus entry expands repeats; the reader keeps repeats as written,
  exactly as the JS reader decided. *Alternative rejected:* implementing
  expansion speculatively — untested-by-corpus behaviour the spec does not
  require of a reader.
- **Port the chord/pitch parser; never share code with JS or Python.**
  *Rationale:* DIRECTION §3.6 standing rule — implementations agree because
  they are checked against the corpus, not because they share code; a
  disagreement is settled in the spec. *Alternative rejected:* transpiling
  or vendoring the reference — forbidden by the standing rule and would not
  be idiomatic Go.
- **No design delta.** *Rationale:* the reader implements already-normative
  spec §1–§7 held to the committed corpus; nothing in DIRECTION, a workflow
  or the spec changes. *Alternative considered:* none needed — every
  behaviour is already decided in the specification.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-08.

- cifra.md `1b3caef`: new source files `go/pitch.go` (§6.1 pitch notation), `go/chord.go` (§5 chord parser, `parseChord`/`DIALECTS`), `go/frets.go` (§7.5 fret strings/fingering), `go/tuning.go` (§6.2–6.4 tuning reader), `go/layout.go` (§4.5 convergence engine), `go/parse.go` (§1–4/§7 document parser core), `go/objutil.go` (Object builder helpers)
- cifra.md `1b3caef`: edited `go/cifra.go` (replaced `Parse` stub), `go/text.go` (exported `Prepare`, added `isMarkerLine`), `go/internal/corpus/harness.go` (added `/tl` and `/chords` checks, `Impl` seams), `go/internal/corpus/harness_test.go` and `go/internal/corpus/corpus_test.go` (fakes), `go/internal/corpus/expected-failures.json` (pruned 68 song `/1` and `/3` ids for entries 01–34)
- cifra.md `1b3caef`: unit tests in `go/document_test.go` (§1), `go/chart_test.go` (§2), `go/repeats_test.go` (§3), `go/chord_test.go` + `go/pitch_test.go` (§5/§6.1), `go/lyrics_test.go` (§4.1–4.7), `go/layout_test.go` (§4.5 convergence/forced/idempotence), `go/voicings_test.go` (§6/§7), `go/diagnostics_test.go` (all 22 codes + `NotUTF8Error` + `bad-notation`)
- cifra.md `1b3caef`: corpus checks 1 and 3 flipped for all 34 song entries (68 ids pruned); `/tl` and `/chords` born-passing checks added outside the ledger; checks 2/4/6 remain ledgered for `cifra_go.writer`
- `Write`/`Canonical` remain stubs; `cifra_go.writer` (`depends !reader`) implements them — already in the WBS, no new leaf
