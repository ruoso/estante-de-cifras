# cifra_go.writer — Canonical writer and check

## TaskJuggler entry

[`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 22–27, task
`cifra_go.writer` (fully-qualified `cifra_go.writer`), under `task cifra_go`,
`depends !reader`:

> **Canonical writer and check** — `effort 4d`, `allocate team`,
> `depends !reader`.
> note: *"cifra.md: §8 serializer, invariants, `is canonical` as the hook
> needs it, marker lines. Tests: unit (the invariants; `is canonical` true and
> false on corpus texts and their non-canonical inputs; marker lines refused);
> corpus (canonical text byte for byte, every entry)."*

The stream header states the stream's rule: *"The hook's implementation of the
format, and git-merge-cifra for computers. A second, independent
implementation, held to the same corpus"*
([`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 1–4). The note starts
with `cifra.md:`, so the work lands in the sibling
[cifra.md](https://github.com/ruoso/cifra.md) repository; the refinement, its
Status block and `complete 100` land here.

## Effort estimate

**4 days** (from the `.tji`). It ports the reference's `write.py` (358 lines)
and the writer half of `layout.py` (the model→text line renderers) into Go,
lands the two §8 unit suites, adds the hook's `IsCanonical` check and the
marked-text refusal, and flips the write and canonicalise corpus checks for
every song entry. It is the Go twin of the already-done `cifra_js.writer`
(also 4 days), standing on a reader that already landed the shared token model
and the §4.5 convergence engine the writer reuses.

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), directory `go/` (and
`go/internal/corpus/` for the ledger), extended by this task:

- `go/write.go` (new) — the §8 canonical writer in package `cifra`, ported
  from `reference/cifra_md/write.py` with its split: the document serialiser
  (§8.4.1 text rules, §8.4.2 metadata, §8.4.3 chart blocks and fences, §8.4.6
  the voicings part), the §8.3 footnote invariants (`footnotes`, applying
  I1 → I3 → I2), the model-level canonicaliser, the marked-text guard
  (`checkUnmarked` and a `MarkedTextError` type), and the `IsCanonical`
  predicate (§8.1 fixed point, §9.1). This is where the song's `Write` and
  `Canonical` machinery lives.
- `go/layout.go` (extended) — the per-line model→text renderers the reader
  reserved for this task (`layout.go` already carries the comment *"The §8
  printers (chord_text, lyric_text, sung_text) belong to cifra_go.writer"*):
  `chartLineText` (§8.4.4, a non-sung chord line), `sungText` (§8.4.5, the two
  lines of a sung line), `chordText` and `lyricText` (the chord line and the
  words line of §8.4.5). These join the §4.5 `converge` engine and the token
  model (`tok`/`itemText`) the reader already landed here, so one token model
  both lays a sung line out and prints it — the seam the reader named
  ([`reader.md`](reader.md) §Decisions). Ports the writer half of
  `reference/cifra_md/layout.py` (`chart_line_text`, `sung_text`, `chord_text`,
  `lyric_text`, `_token_text`).
- `go/cifra.go` — the two song-writer stubs are replaced by the real entry
  points: `Write(model Model) ([]byte, error)` (line 37) and
  `Canonical(model Model) (Model, error)` (line 43), each delegating into
  `write.go` as `Parse` delegates into `parse.go`. The new exported
  `IsCanonical(text []byte) bool` and the `MarkedTextError` type join them for
  the hook's push check (§Decisions). The `Merge`/`MergeOutputs` stubs stay
  stubs (`cifra_go.merge`).
- `go/text.go` — already carries the marker primitives the guard needs
  (`isMarkerLine` and the `markers` array, added by the reader); the writer
  adds a `markerLines`-equivalent helper (first marker line and its index) if
  `write.go` does not inline it.
- `go/internal/corpus/expected-failures.json` — the write and canonicalise
  checks this task turns green are pruned (the 102 song ids `01-…/{2,4,6}`
  through `34-…/{2,4,6}`).

No new unit-test area is a separate file split from source: two new `*_test.go`
files (`go/write_test.go`, `go/canonical_test.go`) join the reader's per-area
suites. No change to `go/internal/corpus/harness.go` is needed — the harness
already builds checks `2`, `4` and `6` and routes them to `impl.Write`/
`impl.Canonical` with `stripModel` on check 6
([`go/internal/corpus/harness.go`](../../../../cifra.md/go/internal/corpus/harness.go)
lines 158–253); only the two stubs' real implementations and the ledger
pruning are this task's.

This task is a **consumer** of the already-committed corpus bytes: the Python
reference generates and checks `corpus/` (the thirty-four song entries 01–34),
and this task touches nothing under `reference/` or `corpus/`. Agreement is by
the corpus, not shared code — `write.go` and the `layout.go` renderers are a
**port** of `write.py`/`layout.py`, matched to the reference and the corpus,
never importing, transpiling or shelling out to Python or JavaScript
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6). In estante-de-cifras,
only this refinement, its Status block, and `complete 100` in
[`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) land.

No design delta is authored. Chapter 8 (the invariants §8.3, the serialiser
§8.4, sung-line printing §8.4.5, the marked-text refusal §8.1), the Writer
profile of §9.1 and the thirty-four corpus entries are already normative; the
module split is the implementer's choice as `module`, `reader` and `setlists`
established — not a new architectural seam, a new runtime dependency, or a
change to designed behaviour (§Decisions).

## Inherited dependencies

- **`cifra_go.reader` — settled** (Done 2026-10-08, cifra.md `1b3caef`,
  [`reader.md`](reader.md) Status): `go/parse.go` delivers
  `Parse(src []byte) (Model, error)` for §1–§7, with `go/layout.go` (the §4.5
  `converge` engine and the token model `tok`/`itemText`), `go/chord.go`
  (`parseChord`/`DIALECTS`), `go/pitch.go`, `go/tuning.go`, `go/frets.go` and
  `go/objutil.go` (the `Object` builder helpers). This task serialises the
  model the reader produces — the whole-song model
  `{ title, properties, sections, blocks, sung, sungAt, diagnostics }`
  ([`corpus/*/parsed.json`](../../../../cifra.md/corpus/README.md)), in the
  pinned key order — and reuses the token model and `converge` the reader
  built, and the re-derivation helper (`rederive`, reusing
  `numberBars`/`pairRepeats`) the reader added to `parse.go`. The reader pruned
  exactly `01-…/{1,3}` through `34-…/{1,3}` from the ledger, leaving
  `01-…/{2,4,6}` … `34-…/{2,4,6}` (the write and canonicalise checks) for this
  task, and left the `Write`/`Canonical` stubs in `go/cifra.go` for this task
  to fill ([`reader.md`](reader.md) §Acceptance "Deferred work").
- **`cifra_go.setlists` — not a dependency, a sibling** (both `depends
  !module`), but it has landed (Done 2026-10-08, cifra.md `839d8c9`,
  [`setlists.md`](setlists.md)) and this task stands on two of its internals and
  one of its decisions:
  - [`go/text.go`](../../../../cifra.md/go/text.go) — `Prepare` (the §1.3 text
    layer), `isMarkerLine` and the `markers` array (the reader exported/added
    these; the marked-text guard builds on them).
  - [`go/markdown.go`](../../../../cifra.md/go/markdown.go) —
    `mdHeading`/`fenceOpen`/`closesFence`/`asciiLower`, the §1.4.1/§1.9 block
    primitives the serialiser's fence and heading logic reuses.
  - `go/setlist.go`'s `WriteSetlist`/`CanonicalSetlist` are the in-repo writer
    precedent, and `CanonicalSetlist` is defined as read-after-write
    (`ParseSetlist(WriteSetlist(model))`) — a precedent this task deliberately
    **does not** carry over for songs (§Decisions). It also brought in the one
    allowed non-stdlib dependency, `golang.org/x/text`'s `unicode/norm`
    (the writer needs no new dependency).
- **`cifra_go.module` — settled** (transitively, Done 2026-10-07, cifra.md
  `2200741`, [`module.md`](module.md)): the module
  (`github.com/ruoso/cifra.md/go`, package `cifra`, `go 1.25`), the
  order-preserving model type `Object`/`Model = *Object` with
  `Set`/`Get`/`Keys`/`Len`/`Without`
  ([`go/model.go`](../../../../cifra.md/go/model.go)), the one pinned JSON
  serialiser `Encode`/`Dump` (used only by the harness's model-side
  comparisons, not by the writer's text output), and the corpus harness with
  its embedded expected-failure ledger. The harness
  ([`go/internal/corpus/harness.go`](../../../../cifra.md/go/internal/corpus/harness.go))
  **already routes song entries** to this task's operations:
  `ReadingChecks` binds `write: impl.Write`, `canonical: impl.Canonical`
  (lines 158–162) and builds check `2` (`Write(model of input.parsed.json)` ==
  `canonical`, lines 204–213), check `4` (`Write(model of parsed.json)` ==
  `canonical`, the fixed point, lines 226–235) and check `6`
  (`Canonical(model of input.parsed.json)` == `model of parsed.json`, each
  `stripModel`-ped of `diagnostics`/`sungAt`, lines 237–253). No harness change
  is needed — only the two stubs' real implementations and the ledger pruning.
- **`format.canonical_form` — settled** (transitively, no refinement; cited
  directly): the specification (including chapter 8 and §9.1), the Python
  reference's reader and canonical writer, and the four-file song corpus
  (entries `01`…`34`) this task is held to.

Downstream: `cifra_go.versions` (`depends !writer`) exposes the current and the
previous canonical check side by side for the hook to accept both for a while
(DIRECTION §3.6 Versions, workflow 14). `cifra_go.merge`
(`depends !writer, !setlists, format.merge`) writes its merge result through
`Write` and rests its marked-text handling on the refusal this task delivers.
`cifra_go.conformance` (`depends !writer, !setlists`) needs the write and
canonicalise ledger entries flipped on its way to an empty ledger. The **hook**
(task 35) calls `IsCanonical`/`Write` to check that a push holds only canonical,
marker-free texts (workflow 14, DIRECTION §3.6) — the primary reason the Go
writer exists.

## What this task is

This task implements the **canonical writer** for Go — the half of the format
that turns a song model back into bytes, plus the `is canonical` predicate the
hook needs. Chapter 8 defines, for every document, a single canonical form: the
text §8.4 writes byte for byte from the model, after the footnote invariants of
§8.3, and a writer MUST save every document in it
([`spec/8-normalisation.md`](../../../../cifra.md/spec/8-normalisation.md)
lines 8–37). The writer is total and deterministic: *"Nothing in it is left to
a writer's choice"* (§8.1 lines 17–20). This is a Go port of
`reference/cifra_md/write.py` and the writer half of
`reference/cifra_md/layout.py`, matched to the reference and the thirty-four
song corpus entries, never shared with them or with the JavaScript twin.

Concretely it delivers, exported from package `cifra` in `go/cifra.go`:

- `Write(model Model) ([]byte, error)` — the public writer.
  `serialize(canonical(model))`, then the marked-text guard: it returns a
  `*MarkedTextError` (naming the first marker line) rather than return a text
  that holds a line of git's conflict markers (§8.1 lines 30–33). This is what
  the hook calls to produce canonical bytes, and the marked-text refusal the
  merge driver leans on.
- `Canonical(model Model) (Model, error)` — the model-level canonicaliser
  (§8.2/§8.3/§4.5): drops an empty title, drops all-null fingerings, applies the
  §8.3 footnote invariants (I1 → I3 → I2), sorts each block's voicings,
  collapses blank runs in notes, re-lays-out every sung line whose marker
  changed width (§4.5), and re-derives bar numbers and repeat groups as a reader
  would. It leaves `sungAt` and `diagnostics` as they were — they describe a
  text, not a model (§Decisions). The harness's check 6 calls this.
- `IsCanonical(text []byte) bool` — the canonicality predicate §9.1 defines
  operationally: a non-UTF-8 text is not canonical (false), a text holding a
  marker line is not canonical (false), otherwise `Write(Parse(text))` equals
  the text byte for byte (§8.1 fixed point). The hook uses it to decide a push.
- `MarkedTextError` — an exported error type (mirroring the reader's
  `NotUTF8Error`) carrying the first marker line and its index, returned by
  `Write` and surfaced by the hook and the merge driver.
- `serialize` (internal) — the §8.4 serialiser proper, taking a model in which
  §8.3 has already been applied and writing it in the order §8.4 gives: the
  metadata block (§8.4.2), the chart's blocks section by section (§8.4.3, with
  fences, the three heading forms, and bracket/label headings written into a
  music fence), and the voicings part (§8.4.6), each present only when it has
  something in it, separated by exactly one blank line; the empty document is
  the zero-byte file (§8.4.1).
- The §8.4.4 chord-line serialiser and §8.4.5 sung-line printing added to
  `go/layout.go`: the measure-by-measure token steps 1–6, the item-text table,
  the bar-line/anchor token rendering, the `,` guard for a line that would
  misread, and the two lines of a sung line printed from the laid-out columns
  and words.

The `Merge`/`MergeOutputs` stubs stay stubs: this task builds no merger. The
§8.5 editing operations are **not** in this task — and, unlike JavaScript, the
Go stream has **no editing task at all** (the Go implementation is for the hook
and the merge driver, which read, canonicalise, check and merge but never
edit), so §8.5 is simply out of scope here (§Decisions). §8.6 transposition is
*"Not defined in this version"* (§8.6).

## Why it needs to be done

A saved song is always written in canonical form (DIRECTION's standing rule;
§8.1 lines 35–51): what a device syncs or the hook accepts is pinned to one
text per model, so that two writers agree byte for byte and a program checks
canonicality by canonicalising and comparing (§8.1 lines 21–23, §9.1 lines
60–62). The reader is the other half — it reads any hand-written document and
reports what canonicalising will drop (§9.2) — and this task closes the loop:
the corpus's write direction (`model → canonical text`) and its fixed point
(`canonical text → canonical model → canonical text`) are the Writer profile of
§9.1 ([`spec/9-conformance.md`](../../../../cifra.md/spec/9-conformance.md)
lines 55–62), and they cannot be proven without it.

It is the Go writer specifically because the hook runs on the server in Go and
must decide whether a pushed `.cifra.md` is canonical and marker-free before it
lands (workflow 14, DIRECTION §3.6); and the git-merge-cifra driver
(`cifra_go.merge`) writes every merge result through it. The two
implementations agree because both are held to the same corpus, never because
they share code (DIRECTION §3.6).

It `depends !reader` because it serialises the reader's model and reuses the
reader's token model and §4.5 `converge`: a sung line is laid out once, by the
reader when it reads and by `Canonical` when a marker changes width, and printed
from that one layout, so reading a document and reading its canonical form give
the same sung lines (§8.4.5 lines 376–379).

## Inputs / context

- [`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 1–4 (stream header),
  22–27 (`task writer`, its `depends !reader`, the `note` and its `Tests:`
  clause: unit + corpus).
- [`reader.md`](reader.md) — the direct predecessor: the model shape this task
  serialises, the token model and `converge` in `go/layout.go` this task
  extends, the `layout.go` reservation of the §8 printers for this task, the
  `rederive` helper in `parse.go`, and the explicit deferral of checks 2/4/6 and
  the `Write`/`Canonical` stubs to this task. Its error-handling decision —
  *"Diagnostics are model data, not Go errors; `Parse` errors only on
  non-UTF-8"* — this task mirrors for the writer (the only error `Write` returns
  is `MarkedTextError`; §Decisions).
- [`setlists.md`](setlists.md) — the in-repo writer precedent
  (`WriteSetlist`/`CanonicalSetlist`); its read-after-write canonicalisation is
  **not** carried over for songs (§Decisions). [`module.md`](module.md) — the
  `Object`/`Encode`/`Dump` model, the harness shape and the expected-failure
  ledger convention.
- [`cifra_js/writer.md`](../cifra_js/writer.md) — the done JavaScript twin
  (cifra.md `c10ea54`): the same spec, the same two-suite unit split
  (`writer.test.js` + `canonical.test.js`), the same decision that `canonical`
  is a dedicated model→model function (not read-after-write), that I4 is not
  part of the canonical form, that chords are copied as written, and that the
  marked-text refusal and `isCanonical` are part of the writer's public
  contract. This refinement reproduces those decisions in Go idiom.
- **Specification (normative) —
  [`spec/8-normalisation.md`](../../../../cifra.md/spec/8-normalisation.md):**
  - §8.1 the canonical form, lines 8–55 — the five properties a writer MUST
    preserve: *unique* (*"Nothing in it is left to a writer's choice"*, lines
    17–20), *a fixed point* (lines 21–23), *depends on the text alone* (lines
    24–26), *reads back as its own model* (*"apart from the line numbers in
    diagnostics and in `sungAt`"*, lines 27–29), and *holds no marker line*
    (*"a writer refuses to save it"*, lines 30–33); *"A writer that saves a
    document MUST save it in canonical form"* (lines 36–37); canonical form
    takes precedence over preserving the text, but *"it never moves a chord to
    another syllable"* (lines 39–51); Appendix A is never applied (lines 53–54).
  - §8.2 what canonicalising changes, lines 56–101 — the text, metadata, chart
    and voicings changes, and which of them a reader has already reported (lines
    98–100). Informative, but the enumeration the unit tests pin case by case.
  - §8.3 footnote invariants, lines 102–151 — the definition of a *used* key
    (lines 110–111); **I1** every key in a block is used (lines 113–115);
    **I3** one shape, one key — the merging rule with *"the same"* and *"tells
    apart"* (lines 117–130); **I2** indices are contiguous — renumber 1…n in the
    chart and every block (lines 132–136); **I4** defaults are not written —
    *"binds an application when it edits"* and *"is not part of the canonical
    form"* (lines 138–141); **I5** the chart and the blocks agree — one-pass
    rewrite, *"a writer MUST NOT leave a state where a chart token names an
    index no block was rewritten for"* (lines 143–146); the application order
    **I1 → I3 → I2** (line 108) and the sung-line re-layout after (lines
    148–150).
  - §8.4 writing the canonical text, lines 152–413 — *"This section is the
    canonical writer … An implementation in any language follows it step by
    step"* (lines 154–156). §8.4.1 the text (UTF-8, no U+FEFF, NFC, LF, no CR,
    no tab, no trailing space, no leading/trailing blank line, never two blank
    lines outside a verbatim fence, one final LF; the block sequence separated
    by one blank line; the empty document is the zero-byte file, lines
    158–177). §8.4.2 metadata (the title line and one line per property in model
    order, lines 178–190). §8.4.3 the chart (heading text with ` @` anchor and
    ` x` count and the closing-`#` guard; the three section forms; a part as
    notes / a music fence / a verbatim fence; the fence character and length
    rule; a bracket or label heading written into a music fence, steps 1–4,
    lines 191–255). §8.4.4 music lines — the item-text table, the token steps
    1–6, bar-line/anchor token rendering, the non-sung chord line joined by
    single spaces, and the `,` guard (lines 256–348). §8.4.5 sung lines — the
    chord line at written columns and the words line with `_` padding, *"The
    writer prints it … and decides nothing"* (lines 349–380). §8.4.6 the
    voicings part — the rule, block order by first tuning then variation, the
    block heading/items/notes, and the code-point sort with the UTF-16 warning
    (lines 381–413).
  - §8.5 editing operations, lines 414–492 — **out of scope**; the Go stream has
    no editing task (noted so the boundary is explicit; §Decisions). §8.6
    transposition *"Not defined in this version"* (lines 493–503); §8.7 legacy
    forms never applied by canonicalising (lines 504–514).
- [`spec/9-conformance.md`](../../../../cifra.md/spec/9-conformance.md) lines
  55–62 — the **Writer** profile (*"Must meet: §8 … it MUST save every document
  in the canonical form of §8.4, and canonicalising with it MUST give the same
  bytes as with any other conforming writer. A writer that checks whether a
  document is canonical does so by canonicalising it and comparing"*); §9.2
  lines 109–126 (a writer writes unknown properties' values back under their
  lower-cased keys); §9.3 lines 127–137 (the corpus pins the writer in both
  directions).
- **Reference, the behaviour to match** (port, never import —
  `/home/ruoso/devel/cifra.md/reference/`):
  - `reference/cifra_md/write.py` (358 lines) — `write(doc)` (335,
    `serialize(canonical(doc))` then `check_unmarked`), `canonical(doc)` (128,
    the model→model canonicaliser: empty title → None, drop all-null `fingers`,
    `footnotes`, sort voicings, `_collapse_blank_runs` on notes, re-`converge`
    sung lines, `_rederive`; leaves `sungAt`/`diagnostics`), `serialize(doc)`
    (297), `footnotes(doc)` (70, the §8.3 invariants I1/I3/I2 with `_same_shape`
    66 and `_chord_items` 54), `_collapse_blank_runs` (119), `_rederive(doc)`
    (157), `fence` (179), `music_lines` (191), `heading_line` (208),
    `heading_name` (216), `_chart_blocks` (225), `_voicing_blocks` (278),
    `MarkedTextError` (317), `check_unmarked(text)` (328), `is_canonical(text)`
    (343), `_dialect(doc)` (36).
  - `reference/cifra_md/layout.py` — the writer-half renderers `item_text` (30),
    `line_tokens` (64), `_token_text` (159), `chart_line_text` (168),
    `chord_text` (457), `lyric_text` (440), `sung_text` (474); `converge` (366)
    the reader already ported to `go/layout.go`, which `Canonical` reuses for
    the sung-line re-layout.
  - `reference/tests/test_writer.py` (161 lines) and
    `reference/tests/test_canonical.py` (709 lines) — the §8.4 and §8.1/§8.2/§8.3
    unit cases to port into `go/write_test.go` and `go/canonical_test.go`
    (enumerated under Acceptance). `reference/tests/test_corpus.py` — how the
    reference runs the entries in both directions; the Go mirror is the harness.
- **Corpus (the thirty-four song reading entries) —
  [`corpus/README.md`](../../../../cifra.md/corpus/README.md):** entries
  `01`…`34`, each with `input.cifra.md`, `input.parsed.json`,
  `canonical.cifra.md`, `parsed.json`. Texts compare byte for byte; models
  compare exactly (array and key order are part of the model). The
  §8-exercising entries this task is held to include: layout normalisation and
  heading levels (`01-minimal-chart`), the text layer (`26-text-layer`), blank
  lines in fences (`21-blank-lines-in-fences`), repeat marks and counts
  (`22-repeat-marks-and-counts`), fence lengths and info strings
  (`23-fence-lengths`), **the footnote invariants I1/I3/I2 on a chart and a sung
  line** (`24-footnote-invariants`), headings (`25-headings`), sung line layout
  with tokens that grow and shrink and the guard (`28-sung-line-layout`), the
  voicings part — what canonicalising drops, label and tuning spelling, merged
  blocks (`29-voicings-part`), the title-only document (`30-title-only`), the
  empty document → empty file (`31-empty`), an unclosed verbatim fence
  (`32-unclosed-verbatim`), sung anchors kept at their columns
  (`33-sung-anchors`), and pushed words so every chord stays over its character
  (`34-pushed-words`).
- **Harness (what this task flips) —
  [`go/internal/corpus/`](../../../../cifra.md/go/internal/corpus/harness.go):**
  - `harness.go` — `ReadingChecks` (lines 158–253) already routes songs to
    `impl.Write`/`impl.Canonical` and builds checks `2`/`4`/`6`; `stripModel`
    (lines 429–432) drops top-level `diagnostics` and `sungAt` before check 6
    compares. The `Impl` interface (lines 35–48) already names `Write` and
    `Canonical`. No harness change is needed.
  - `corpus_test.go` / `harness_test.go` — load `expected-failures.json`, guard
    it with `StaleLedgerIds`, and assert each check fails/passes per the ledger
    (`TestCorpusConformance`, `TestLedgerNamesNoCheckThatDoesNotExist`).
  - `expected-failures.json` — currently lists, for every one of the thirty-four
    song entries, the three ids `/2 /4 /6` (102 ids), alongside the 76 `merge/*`
    ids. This task **removes** those 102 song ids (they become passing), adds
    none, and leaves the merge ids for `cifra_go.merge`.

Governing component boundaries:
[`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 (cifra.md for Go in `go/`,
the hook's format implementation and the merge driver; the two implementations
agree by the corpus, not shared code; Versions — the hook accepts the current
and previous forms for a while).

## Constraints / requirements

- **The §8.4 serialiser, byte for byte against the corpus.** `Write` produces
  the canonical text and the harness compares it to `canonical.cifra.md` **byte
  for byte** (checks 2 and 4). Every rule of §8.4.1–§8.4.6 is binding: the block
  sequence separated by one blank line and the empty document as the zero-byte
  file (§8.4.1); the title line and properties in model order with the value
  dropped when empty (§8.4.2); heading text with the anchor, count and
  closing-`#` guard, the three section forms, a part as notes / music fence /
  verbatim fence, the fence character (backtick unless the info string holds
  one, then tilde) and length (three, or one more than the longest inner run),
  and a bracket or label heading written into a music fence — opening the fence,
  carrying a leading non-sung chord line on the heading line under its
  condition, and keeping the fence open across continuing sections (§8.4.3); the
  item-text table, the token steps 1–6 that put every mark, count, ending, bar
  line and anchor back in the measure a reader counts it in, and the `,` guard
  for a line that would misread as a heading/annotation/forced line (§8.4.4);
  the voicings part after the rule, blocks ordered by first tuning then
  variation, each block's items ordered by symbol then index.
- **The output is byte-exact** (§8.4.1): UTF-8, NFC, LF only, no CR, no tab, no
  U+FEFF, no trailing space, never two blank lines in a row outside a verbatim
  fence, exactly one final LF, and the zero-byte file for the empty document.
  The writer emits text bytes directly — `Encode`/`Dump` are the model-side JSON
  serialiser only and the writer does not touch them.
- **The §8.3 footnote invariants, applied I1 → I3 → I2, in one pass.**
  `Canonical` drops a key no occurrence uses (I1), merges two indices no block
  tells apart into the lower one and drops the merged entries (I3), and
  renumbers each symbol's used indices 1…n in the chart and every block alike
  (I2) — rewriting chart tokens and block keys in one step so no chart token
  names an index no block was rewritten for (I5). A rewritten token on a sung
  line changes width, so `Canonical` re-lays-out that line with `converge`
  afterwards (§8.3 lines 148–150, §4.5). I4 is **not** part of the canonical
  form and is not implemented here beyond the serialiser never inventing a
  default shape (§Decisions).
- **The writer prints a laid-out sung line and decides nothing** (§8.4.5). The
  model's sung lines are already laid out (the reader lays them out; `Canonical`
  re-lays-out those whose marker changed width). `sungText` prints the two lines
  from the model's columns and words — the chord line with each token at its
  written column, the words line with `_` padding only in the gaps the layout
  left — and never moves a chord to another syllable (§8.1 lines 48–51). The `,`
  guard is applied to a chord line whose first character the layout left as a
  space and which would otherwise read as a heading/annotation/forced line
  (§8.4.5 lines 356–361).
- **Chords are copied as written; the writer does not re-spell.** The item-text
  table writes a chord as its stored symbol (§8.4.4) — the symbol the reader
  stored, not a re-derived spelling. The §5.7 model→symbol formatter is not
  built here; the Go stream has no editing task, and no corpus entry exercises a
  re-spelling (canonical text keeps the symbol). The dialect `Canonical`
  resolves from the model's `notation` is used only by `converge`'s misread
  check on re-layout (§Decisions).
- **A marked text is refused, never written** (§8.1 lines 30–33). `Write` (via
  `checkUnmarked`, using `isMarkerLine`/`markers`) returns a `*MarkedTextError`
  naming the first marker line rather than return a text that holds a line of
  git's conflict markers. No song corpus entry triggers it (a reader keeps a
  marker line as notes and reports `marker-line` at `parse.go:761`; the
  canonical model of a clean document holds none), so this is pinned by a
  purpose-written unit test; `MarkedTextError` and `IsCanonical` are exported for
  the hook and the merge driver (the standing rule: a marked text is never
  canonical, never saved, never pushed).
- **`Canonical` leaves `sungAt` and `diagnostics` as they were** (§8.1 lines
  27–29). They describe a text, not a model; the harness's check 6 strips both
  before comparing (`stripModel`), and a consumer wants the canonical model
  carrying the input's diagnostics so it can say what canonicalising dropped.
  `Canonical` re-derives the model's **derived** fields — bar numbers and repeat
  groups — as a reader would, reusing `parse.go`'s `rederive`
  (`numberBars`/`pairRepeats`): one implementation of bar-numbering, not a
  second copy (§Decisions).
- **The canonical form is unique and a fixed point** (§8.1 lines 17–23). The
  serialiser leaves nothing to choice; `Write(parsed.json) == canonical.cifra.md`
  (check 4) and `Write(input.parsed.json) == canonical.cifra.md` (check 2) both
  hold, and `IsCanonical(text)` is `Write(Parse(text)) == text` after the UTF-8
  and marker gates.
- **A second, independent implementation; no new runtime dependency** (stream
  header; DIRECTION §3.6). `write.go` and the `layout.go` additions import only
  the Go standard library and `golang.org/x/text`'s `unicode/norm` (already
  present) and the package's own files; they add no new dependency and share no
  code with the JavaScript or Python writers — a disagreement is settled in the
  spec and the corpus, never by copying code. Code-point ordering of voicing
  symbols (§8.4.6 lines 409–412) is natural in Go: a Go string is UTF-8, so a
  byte-order sort already yields code-point order (byte order and code-point
  order agree for UTF-8), unlike the UTF-16 hazard the spec warns JS about; the
  implementer confirms the sort key is the symbol string, not a decomposed form.
- **Standing rules scoped where they apply:** *Canonical form over preserving
  content* — this module writes canonical form only and preserves no
  non-canonical spelling; where keeping the author's text and writing
  canonically conflict, the canonical form wins (§8.1 lines 39–51). *A marked
  text is never canonical, never saved or pushed* — enforced by the refusal
  above, and the hook and merge driver surface `MarkedTextError`. *Test fixtures
  are purpose-written* — the unit tests use tiny invented songs and the
  purpose-written corpus entries 01–34, never anyone's copyrighted words. *No
  song text in logs*, *offline first*, *accessibility* and *no book without an
  account* do not apply: this is a pure format module with no UI, network,
  storage or logging (noted so the omission is deliberate, per the brief).

## Acceptance criteria

**Behaviour delivered.** `go/write.go` implements the §8 canonical writer —
`Write(model)` (the public entry, `serialize ∘ canonical` with the §8.1
marked-text refusal returning `*MarkedTextError`), `Canonical(model)` (the
§8.2/§8.3/§4.5 model-level canonicaliser applying I1 → I3 → I2, re-laying-out
sung lines whose markers changed width, and re-deriving bar numbers and repeat
groups), the internal `serialize`, the §8.3 `footnotes`, the fence/heading/
chart-block and voicing-block assembly, `checkUnmarked`/`MarkedTextError`, and
`IsCanonical`; `go/layout.go` gains the §8.4.4/§8.4.5 renderers (`chartLineText`,
`sungText`, `chordText`, `lyricText`); `go/cifra.go` wires `Write`/`Canonical`/
`IsCanonical` to them, flipping the `Write`/`Canonical` stubs. The thirty-four
song corpus entries pass checks 2, 4 and 6. `scripts/gate cifra.md` runs it all
(`go vet ./...`, `go test -p "$JOBS" ./...`, `go build`) alongside the
reference's unchanged `pytest` and the JS twin's `npm test`. The
`Merge`/`MergeOutputs` stubs stay stubs.

**Tests the task lands with, by level.** The `.tji` `Tests:` clause names
**unit + corpus**. Format work's behaviour/conformance level **is** the corpus,
so there are no behavior, e2e-api or e2e-web levels.

- **unit (`go test`, `go/write_test.go`)** — the §8.4 serialiser on
  purpose-written models, ported from `reference/tests/test_writer.py`, pinning
  §8.4 construct by construct:
  - *The chord line* (§8.4.4): items and bar lines joined by single spaces;
    leading and closing bars; the double bar; repeat marks on bar lines; endings
    (`1.`, `2.`); a close mark against a chord; bar anchors (`@9`) and an
    anchor-only line moving to the next bar; unknown tokens and repeat signs
    (`%`); cifra counts written as `x` form (`x2`); beat runs and annotations
    (`// `); `N.C.`; punctuation dropped.
  - *Sections, fences and metadata* (§8.4.1–§8.4.3): the title line and
    properties then one blank line; a title-only document; heading levels become
    2; a heading's count and anchor and the closing-`#` guard; bracket/label
    headings sharing one fence and carrying a leading chord line; a verbatim
    fence with its info string; notes kept in place with blank runs collapsed;
    an empty section kept as a heading; the fence character and length rule.
  - *Sung lines* (§8.4.5): the two-line count; columns kept; the lead words; a
    forced line written with `>`; lyric lines and breaks; bars on a sung line at
    their columns; the `,` guard.
  - *The voicings part* (§8.4.6): items sorted and single-spaced; blocks ordered
    by first tuning with the default variation first; problem items dropped;
    empty blocks written as a heading alone; no blocks → no rule; notes in a
    block following the items; the code-point sort (a supplementary-plane symbol
    sorts by code point — in Go, by the UTF-8 byte order that equals it).
- **unit (`go test`, `go/canonical_test.go`)** — `Canonical`, the §8.1
  properties, §8.2 changes, the §8.3 invariants, the marked-text refusal and
  `IsCanonical`, ported from `reference/tests/test_canonical.py` on
  purpose-written models and texts:
  - *The text and the fixed point* (§8.1, §8.4.1): BOM / CR LF / lone CR removed
    (via a read-then-write round-trip), trailing spaces removed, tabs → one
    space, NFC with chords kept over their syllables, a no-break space kept as a
    character, the empty document → the empty file, one final newline;
    canonicalising a canonical model changes nothing (the fixed point).
  - *Metadata* (§8.2): an empty title dropped; keys lower-cased, first position,
    last value; an empty value; non-property list items dropped; a property
    never added.
  - *The chart* (§8.2): items and bars one space apart; a close mark then a
    count; marks against bars; bar-line spellings; counts/endings/marks placed;
    no-chord and punctuation; the anchor first in its measure; unknown tokens
    kept.
  - *The footnote invariants* (§8.3): **I1** a key no occurrence uses dropped
    from every block; **I3** two indices no block tells apart merged into the
    lower, with a block that gives different shapes (or a shape for only one)
    keeping them apart, and no block → no two the same; **I2** used indices
    renumbered 1…n in the chart and every block, keys used only by unknown
    tokens not renumbered; the one-pass rewrite (I5) leaving no dangling token;
    and a sung line **re-laid-out** after a marker grew or shrank, every chord
    still over its syllable (pins §8.3 lines 148–150, cross-checked by corpus
    `24-footnote-invariants` and `34-pushed-words`).
  - *The marked-text refusal and `IsCanonical`* (§8.1, §9.1): `Write` on a model
    whose serialisation would hold a line of git's conflict markers returns a
    `*MarkedTextError` naming the first marker line (and no bytes);
    `IsCanonical(text)` is **true** on a canonical corpus text
    (`canonical.cifra.md`) and **false** on its non-canonical input
    (`input.cifra.md`), **false** on a marked text, and **false** on a non-UTF-8
    byte string — the three `is canonical` cases the `.tji` names, pinned
    directly (the corpus harness does not invoke `IsCanonical`).
- **corpus (`go test`, `go/internal/corpus`, `TestCorpusConformance`)** — the
  thirty-four song entries `01`…`34` pass checks `2` (`Write(model of
  input.parsed.json)` == `canonical.cifra.md`), `4` (`Write(model of
  parsed.json)` == `canonical.cifra.md`, the fixed point) and `6`
  (`Canonical(model of input.parsed.json)` == `model of parsed.json`, each
  stripped of `diagnostics`/`sungAt`), each **byte for byte**. The 102 ids
  (`01-…/{2,4,6}` … `34-…/{2,4,6}`) are **removed** from
  `go/internal/corpus/expected-failures.json`; the harness still enumerates them
  (`ReadingChecks` builds them), so the ledger stays stale-free
  (`StaleLedgerIds` / `TestLedgerNamesNoCheckThatDoesNotExist`) and a premature
  pass or a regression still fails the gate. The born-passing `<entry>/tl` and
  `<entry>/chords` checks the reader added stay green on all thirty-four, and
  the 76 `merge/*` ids are left untouched for `cifra_go.merge`. With the
  reader's checks 1 and 3 this closes the read↔write cycle in both directions
  and brings `cifra_go.conformance` that much closer to an empty ledger.

The closer verifies every named test exists and ran (not skipped) in the gate
(`scripts/gate` `go_checks`, over the cifra.md checkout) before committing. The
`.tji` `Tests:` clause is sharpened to these files and cases; no level it names
is dropped.

**Deferred work.** None registered by this task. The §8.5 editing operations do
not become a follow-up: the Go stream has no editing task (the Go implementation
serves the hook and the merge driver, which never edit a song), so §8.5 is out
of scope rather than deferred, and the §5.7 model→symbol formatter it would need
is not built. The downstream `cifra_go.versions`, `cifra_go.merge` and
`cifra_go.conformance` leaves already exist in the WBS
([`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 35–52) and are not
created here. No new WBS leaf.

## Decisions

- **A new `go/write.go` for chapter 8; the per-line renderers extend
  `go/layout.go`.** The reference splits the writer across `write.py` (the
  document serialiser, the §8.3 invariants, the canonicaliser, the marked-text
  guard) and `layout.py` (the per-line renderers beside the `converge` engine),
  and the JS twin mirrored it (`write.js` + `layout.js`). The reader already
  reserved the `go/layout.go` renderers for this task (its source comment names
  `chord_text`/`lyric_text`/`sung_text` as `cifra_go.writer`'s), because they
  share the token model (`tok`, `itemText`) and the §4.5 layout with the
  reader — one token model both lays a sung line out and prints it, which is
  what makes reading a document and reading its canonical form agree (§8.4.5
  lines 376–379). The document-level serialiser, the invariants and the
  canonicaliser go in `write.go`, matching the reference split and the reader's
  recorded *"one Go file split mirroring the reference's concerns"* decision
  ([`reader.md`](reader.md) §Decisions). *Alternatives rejected:* (a) the
  per-line renderers in `write.go` — forces a second token model or an odd
  `write.go → layout.go → write.go` dependency, and contradicts the reader's
  reservation; (b) one monolithic `write.go` holding a copy of the layout —
  duplicates `converge`'s token model. The file names are a layout choice the
  implementer may adjust so long as the package boundary and the tested surface
  hold; `module` fixed only the `cifra.go` surface (`Write`, `Canonical`).

- **`Canonical` is a dedicated model→model function, not read-after-write.**
  The sibling `cifra_go.setlists` defined `CanonicalSetlist(model)` as
  `ParseSetlist(WriteSetlist(model))` ([`setlists.md`](setlists.md)). That does
  **not** carry over to songs, and this task ports the reference's dedicated
  `write.py:canonical` (as the JS twin did). *Rationale:* a setlist's
  canonicalisation is purely textual (reorder entries, collapse a repeated key,
  renumber) — read-after-write expresses it with no second code path. A song's
  canonicalisation is **model-level**: the §8.3 footnote invariants (I1/I3/I2)
  merge and renumber indices across the chart and every block, and the §4.5
  re-layout runs on the sung lines whose markers changed width — operations on
  the model, which `canonical` performs directly and which `serialize` then
  assumes already applied. The reference also contracts that `Canonical` leaves
  `sungAt` and `diagnostics` as they were (they describe the input text);
  `Parse(Write(model))` would recompute them against the canonical text and
  renumber lines, discarding the input's — wrong for a model-level canonicaliser
  a consumer uses to show what a save will drop, even though check 6 strips
  both. *Alternative rejected:* `Canonical = Parse ∘ Write` for songs — it
  happens to satisfy check 6 (which strips the differing fields) but breaks the
  reference's contract, and would make `Write = serialize ∘ Canonical` circular
  with a parse step in the middle.

- **The marked-text refusal is a returned `*MarkedTextError`, not a panic.**
  Go reports errors by return value, and the reader already set the pattern —
  *"diagnostics are model data, not Go errors; `Parse` errors only on
  non-UTF-8"*, with a `NotUTF8Error` struct type carrying the offending byte
  ([`reader.md`](reader.md) §Decisions, `go/text.go`). `Write` returns
  `(nil, &MarkedTextError{Line, Text})` when the serialised text holds a git
  conflict-marker line, mirroring JS's thrown `MarkedTextError` in Go idiom and
  the reader's `NotUTF8Error` style. The guard scans the *serialised* text
  (markers survive into the model as notes, `parse.go:761`), so it lives in
  `Write` after `serialize`, not in `Canonical`; `Canonical` returns a nil error
  in the corpus path (its error slot is the module's uniform signature).
  *Rationale:* consistent with the module's established error handling and the
  spec's refusal rule; the hook and merge driver get a typed error naming the
  first marker line. *Alternative rejected:* a sentinel `ErrMarkedText` — cannot
  carry the first marker line's number the way `NotUTF8Error` carries its byte.

- **`IsCanonical(text []byte) bool`, exported for the hook, unit-tested not
  corpus-tested.** §9.1 defines the predicate operationally — *"A writer that
  checks whether a document is canonical does so by canonicalising it and
  comparing"* — so `IsCanonical` decodes UTF-8 (false if not), is false if any
  marker line is present, and otherwise returns `Write(Parse(text)) == text`.
  It takes `[]byte` because the hook reads file bytes and because the UTF-8 gate
  must see raw bytes (matching the JS/Python `isCanonical`/`is_canonical`, which
  accept bytes). The corpus harness does **not** invoke it (it drives `Write`
  and `Canonical` directly), so it is pinned by `go/canonical_test.go` on corpus
  texts and their non-canonical inputs and on a marked and a non-UTF-8 text — the
  exact cases the `.tji` `Tests:` clause names. *Rationale:* the `is canonical`
  the hook needs is a thin wrapper over `Write`/`Parse`; exposing it keeps the
  marker-and-compare logic in one place rather than re-implemented in the hook.
  *Alternative rejected:* leaving the hook to call `Write` and compare itself — a
  second copy of the UTF-8/marker gating.

- **I4 is not implemented as part of the canonical form.** §8.3 I4 (*"Defaults
  are not written"*) *"binds an application when it edits … It is not part of
  the canonical form, which cannot know what an application's default is"* (§8.3
  lines 138–141). The serialiser does not strip "default" shapes — it has no
  notion of a default — and writes the chosen shapes the model holds. Honouring
  I4 would be an editing application's job, and the Go stream has no editing
  task. *Rationale:* the spec says so explicitly; the canonical form must depend
  on the text alone (§8.1 lines 24–26). *Alternative rejected:* threading an
  application default into the writer.

- **The writer copies chord symbols as written; no §5.7 formatter here.** The
  §8.4.4 item table writes a chord as its stored symbol, and §8 never re-spells a
  chord. The model→symbol formatter (§5.7 preferred spellings) belongs to the
  operations that change a chord — which the Go side does not perform (no editing
  task, and §8.6 transposition is undefined in this version). *Rationale:*
  matches the reference (its `item_text` writes the stored symbol) and no corpus
  entry exercises a re-spelling. *Alternative rejected:* building a formatter
  now — unused by any corpus entry and outside this stream's purpose.

- **Re-deriving bar numbers and repeat groups reuses the reader's helpers.**
  `Canonical` recomputes the model's derived fields (bar numbers when the song is
  not sung, repeat groups per section) exactly as the reader does, reusing
  `parse.go`'s `rederive` (`numberBars`/`pairRepeats`), as the reference's
  `_rederive` reuses the parser's methods and the JS twin's `canonical` reuses
  `rederive`. *Rationale:* one implementation of bar-numbering held to the
  corpus, not a second copy that could drift (DIRECTION §3.6's one-correct-copy
  rule, within a language). *Alternative rejected:* a separate re-derivation in
  `write.go` — two copies of the §2.8/§3 rules to keep in step.

- **No design delta.** Chapter 8, the §9.1 Writer profile and the thirty-four
  corpus entries are already normative; `write.go` is an internal module split
  and no runtime dependency is added. *Rationale and alternative* mirror
  [`module.md`](module.md), [`reader.md`](reader.md) and
  [`cifra_js/writer.md`](../cifra_js/writer.md): a format task that implements the
  spec as written, held to the committed corpus, needs no spec change.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-08.

- cifra.md `d5dd57b`: `go/write.go` (new) — §8.4 `serialize`, §8.3 `footnotes`
  (I1→I3→I2), model-level `canonicalModel`, model-level re-derivation twins
  (`rederiveModel`/`numberBarsModel`/`pairRepeatsModel`), fret/finger formatters,
  `MarkedTextError`+`checkUnmarked`, `isCanonical`.
- cifra.md `d5dd57b`: `go/layout.go` (extended) — §8.4.4/§8.4.5 renderers
  `chartLineText`, `sungText`, `chordText`, `lyricText`.
- cifra.md `d5dd57b`: `go/cifra.go` — wired `Write`/`Canonical`, added exported
  `IsCanonical`; `Merge`/`MergeOutputs` stubs remain for `cifra_go.merge`.
- cifra.md `d5dd57b`: `go/internal/corpus/expected-failures.json` — pruned the
  102 song `/2,/4,/6` ids (all 34 entries now pass checks 2/4/6); 76 `merge/*`
  ids kept for `cifra_go.merge`.
- cifra.md `d5dd57b`: `go/write_test.go`, `go/canonical_test.go` (new) — unit
  suites for §8.4 serialiser and §8.1/§8.2/§8.3/`IsCanonical`.
- Re-derivation note: the refinement assumed `parse.go` had a `rederive` helper;
  it had not (parser methods act on internal structs, not the model). Model-level
  twins were written in `write.go` instead — recorded in memory for
  `cifra_go.merge`.
