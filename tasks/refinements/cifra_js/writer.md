# cifra_js.writer — Canonical writer

## TaskJuggler entry

`task writer` in [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) (lines
36–41), under `task cifra_js`, `depends !reader`. The area file's header
states the stream's rule: *"The app's implementation of the format, held to
the corpus byte for byte. Framework-free: the view is the only layer that
knows React"* ([`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 1–4).

The `.tji` note: *"cifra.md: §8 — invariants I1-I5, the numbered serializer,
sung-line printing, refusing marked texts. Tests: unit (invariants I1-I5,
sung-line printing, a marked text refused); corpus (model to canonical text
and canonical text to canonical model, every entry, byte for byte)."*

## Effort estimate

**4 days** (from the `.tji`). It ports the reference's `write.py` (358 lines)
and the writer half of `layout.py` (the model→text line renderers), lands the
§8 unit suites, and flips the write and canonicalise corpus checks for every
song entry.

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, extended by this
task:

- `js/src/` — one new module and one extended module, ported from the
  reference with its split:
  - `write.js` (new) — the §8 canonical writer: `write(model) → text` (the
    public entry, `serialize ∘ canonical` with the marked-text refusal),
    `canonical(model) → model` (model-level canonicalisation, §8.2/§8.3/§4.5),
    `serialize(model) → text` (the §8.4 byte-for-byte serialiser), the §8.3
    footnote invariants (`footnotes`, applying I1 → I3 → I2), the §8.4.1
    block assembly, §8.4.2 metadata, §8.4.3 chart blocks and fences
    (`fence`, `musicLines`, `headingLine`, `headingName`, the chart-block and
    voicing-block assembly), §8.4.6 voicings part, the marked-text guard
    (`checkUnmarked`/`MarkedTextError`, §8.1, §11.12.3), and the canonicality
    check `isCanonical(text)` (§8.1 fixed point). Ports
    `reference/cifra_md/write.py`.
  - `layout.js` (extended) — the per-line model→text renderers the reader
    refinement reserved for this task: `chartLineText` (§8.4.4, a chord line
    not sung), `sungText` (§8.4.5, the two lines of a sung line), `chordText`
    and `lyricText` (the chord line and the words line of §8.4.5). These join
    the §4.5 `converge` engine and the token model (`lineTokens`, `itemText`,
    `unpad`) the reader already landed in this module, so one token model both
    lays a sung line out and prints it — the seam the reader refinement names
    ([`cifra_js/reader.md`](./reader.md) §Repository, §Decisions). Ports the
    writer half of `reference/cifra_md/layout.py` (`chart_line_text`,
    `sung_text`, `chord_text`, `lyric_text`, `_token_text`).
- `js/src/index.js` — the two song-writer stubs are replaced by the real
  implementation: `write` (line 81) and `canonical` (line 86), re-exported
  from `write.js`. `MarkedTextError` and `isCanonical` are re-exported for the
  app's save path (the app refuses to save a marked text; §Decisions). The
  three reader modules' derivation helpers `canonical` needs
  (`numberBars`/`pairRepeats`, or their JS equivalents) are imported from
  `parse.js`, re-exported only if a consumer needs them. The `merge` stub
  stays a stub (`cifra_js.merge`).
- `js/test/` — two new Vitest unit files (`writer.test.js`, `canonical.test.js`,
  ported from the reference's `test_writer.py`/`test_canonical.py`) and a
  shrink of `js/test/corpus/expected-failures.json` (the write and canonicalise
  checks this task turns green).

This task is a **consumer** of the already-committed corpus bytes: the Python
reference generates and checks `corpus/` (the thirty-four song entries 01–34),
and this task touches nothing under `reference/` or `corpus/`. Agreement is by
the corpus, not by shared code — `write.js` and the `layout.js` renderers are a
**port** of `write.py`/`layout.py`, matched to the reference and the corpus,
never importing, transpiling or shelling out to Python or Go (DIRECTION §3.6).

No design delta is authored. Chapter 8 (the invariants §8.3, the serialiser
§8.4, sung-line printing §8.4.5, the marked-text refusal §8.1) and the Writer
profile of §9.1 are already normative; the module split is the implementer's
choice as `package` and `reader` established — not a new architectural seam, a
new runtime dependency, or a change to designed behaviour (§Decisions).

## Inherited dependencies

- **`cifra_js.reader` — settled** (cifra.md `9eb9a7c`,
  [`cifra_js/reader.md`](./reader.md) Status): `js/src/parse.js` delivers
  `parse(bytes) → model` for §1–§7, with `js/src/layout.js` (the §4.5
  `converge` engine and token model), `js/src/tuning.js` and `js/src/frets.js`.
  This task serialises the model the reader produces — the whole-song model
  `{ title, properties, sections, blocks, sung, sungAt, diagnostics }`
  (`corpus/*/parsed.json`), with the section/part/line/measure/item shapes the
  reader pins — and reuses the token model and `converge` the reader built. The
  reader pruned exactly `01-34/1` and `01-34/3` from the ledger, leaving
  `01-34/{2,4,6}` (the write and canonicalise checks) for this task; it left
  the `write` and `canonical` stubs in `index.js` for this task to fill
  ([`cifra_js/reader.md`](./reader.md) §Acceptance "Deferred work").
- **`cifra_js.chords` — settled** (transitively, cifra.md `fe19a35`,
  [`cifra_js/chords.md`](./chords.md)): the chord model and the dialect table
  (`DIALECTS`, `DEFAULT_DIALECT`). The writer **copies each chord's symbol as
  written** (§5.6/§5.7, §8.4.4 item table: *"its key: the symbol"*); the §5.7
  model→symbol formatter is **not** built here and is `cifra_js.editing`'s
  (§8.5 respelling/transposition), as `chords.md` recorded. The dialect the
  writer needs is for the §4.5 re-layout only (`converge` reuses it to detect a
  line that would misread), resolved from the model's `notation` as the reader
  resolved it.
- **`cifra_js.text_layer` — settled** (transitively, cifra.md `7c2106c`,
  [`cifra_js/text_layer.md`](./text_layer.md)): `text.js`'s `isMarkerLine`/
  `markerLines` (the marked-text guard uses them) and the §1.3 rules the
  canonical text satisfies by construction (the `<entry>/tl` born-passing check
  already proves canonical text is a fixed point of `prepare`).
- **`cifra_js.package` — settled** (transitively, cifra.md `552cf37`,
  [`cifra_js/package.md`](./package.md)): `js/` as a framework-free,
  zero-runtime-dependency ES-module package with the Vitest corpus harness and
  the expected-failure ledger. The harness
  ([`js/test/corpus/harness.js`](/home/ruoso/devel/cifra.md/js/test/corpus/harness.js))
  **already routes song entries** to this task's operations: `readingChecks`
  binds `write: impl.write, canonical: impl.canonical` (lines 171–176) and
  builds check `2` (write `input.parsed.json` → `canonical.cifra.md`, lines
  214–222), check `4` (write `parsed.json` → `canonical.cifra.md`, the fixed
  point, lines 234–242) and check `6` (model-level `canonical(input.parsed.json)`
  stripped of `diagnostics`/`sungAt` → stripped `parsed.json`, lines 244–255).
  No harness change is needed — only the two stubs' real implementations and
  the ledger pruning.
- **`format.canonical_form` — settled** (transitively, through `package`): the
  specification (including chapter 8 and §9.1), the Python reference, and the
  four-file corpus this task is held to.

Downstream: `cifra_js.editing` (`depends !writer`) performs the §8.5 editing
operations (choose a shape, clear a key, add a variation, the batch op) on top
of this writer, each landing in canonical form. `cifra_js.merge`
(`depends !writer, !setlists, format.merge`) merges songs and writes the result
through this writer, and its marked-text handling rests on the refusal this
task delivers. `cifra_js.conformance` (`depends !writer, !setlists, !merge`)
needs the write and canonicalise ledger entries flipped on its way to an empty
ledger. The app's Worker (DIRECTION §3.7) saves every song through `write`
once the storage/sync streams exist, and the save sheet (`cifra_js.diff`,
workflow 4) shows what canonicalising will change using the reader's
diagnostics and this writer's output.

## What this task is

This task implements the **canonical writer** — the half of the format that
turns a song model back into bytes. Chapter 8 defines, for every document, a
single canonical form: the text §8.4 writes byte for byte from the model, after
the footnote invariants of §8.3, and a writer MUST save every document in it
([`spec/8-normalisation.md`](/home/ruoso/devel/cifra.md/spec/8-normalisation.md)
lines 8–37). The writer is total and deterministic: *"Nothing in it is left to
a writer's choice"* (§8.1 lines 17–20). This module is a port of
`reference/cifra_md/write.py` and the writer half of
`reference/cifra_md/layout.py`, matched to the reference and the thirty-four
song corpus entries, not shared with them.

Concretely it delivers, re-exported from `js/src/index.js`:

- `write(model) → text` — the public writer. `serialize(canonical(model))`,
  then the marked-text guard: it throws `MarkedTextError` (naming the first
  marker line) rather than return a text that holds a line of git's conflict
  markers (§8.1 lines 30–33). This is what the app's save path calls.
- `canonical(model) → model` — the model-level canonicaliser (§8.2/§8.3/§4.5):
  drops an empty title, drops all-null fingerings, applies the §8.3 footnote
  invariants (I1 → I3 → I2), sorts each block's voicings, collapses blank runs
  in notes, re-lays-out every sung line whose marker changed width (§4.5), and
  re-derives bar numbers and repeat groups as a reader would. It leaves
  `sungAt` and `diagnostics` as they were — they describe a text, not a model
  (§Decisions). The harness's check 6 calls this.
- `serialize(model) → text` — the §8.4 serialiser proper, taking a model in
  which §8.3 has already been applied and writing it in the order §8.4 gives:
  the metadata block (§8.4.2), the chart's blocks section by section (§8.4.3,
  with fences, the three heading forms, and bracket/label headings written into
  a music fence), and the voicings part (§8.4.6), each present only when it has
  something in it, separated by exactly one blank line; the empty document is
  the zero-byte file (§8.4.1).
- The §8.4.4 chord-line serialiser and §8.4.5 sung-line printing in
  `layout.js`: the measure-by-measure token steps 1–6, the item-text table, the
  bar-line/anchor token rendering, the `,` guard for a line that would misread,
  and the two lines of a sung line printed from the laid-out columns and words.

The `merge` stub in `index.js` stays a stub: this task builds no merger. The
§8.5 editing operations are not in this task — they are `cifra_js.editing`'s
(`depends !writer`), and §8.6 transposition is *"Not defined in this version"*
(§8.6).

## Why it needs to be done

A saved song is always written in canonical form (DIRECTION's standing rule;
§8.1 lines 35–51): what a user edits, the app merges, or a device syncs is
pinned to one text per model, so that two writers agree byte for byte and a
program checks canonicality by canonicalising and comparing (§8.1 lines 21–23).
The reader is the other half — it reads any hand-written document and reports
what canonicalising will drop (§9.2) — and this task closes the loop: the
corpus's write direction (`model → canonical text`) and its fixed-point
(`canonical text → canonical model → canonical text`) are the Writer profile of
§9.1 ([`spec/9-conformance.md`](/home/ruoso/devel/cifra.md/spec/9-conformance.md)
lines 55–62), and they cannot be proven without it.

It `depends !reader` because it serialises the reader's model and reuses the
reader's token model and §4.5 `converge`: a sung line is laid out once, by the
reader when it reads and by `canonical` when a marker changes width, and printed
from that one layout, so reading a document and reading its canonical form give
the same sung lines (§8.4.5 lines 376–379).

Downstream consumers: `cifra_js.editing` (every §8.5 operation ends by writing
canonical form), `cifra_js.merge` (writes its result through this writer and
refuses to save a marked text), `cifra_js.conformance` (the write/canonicalise
ledger entries must be flipped and no song entry left failing), and the app's
Worker and save sheet, once the storage/sync/app streams exist.

## Inputs / context

- [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 1–4 (stream header),
  36–41 (`task writer`, its `depends !reader`, the `note` and its `Tests:`
  clause: unit + corpus).
- [`cifra_js/reader.md`](./reader.md) — the direct predecessor: the model shape
  this task serialises, the token model and `converge` in `layout.js` this task
  extends, the decision that the writer's renderers land in `layout.js`, and
  the explicit deferral of checks 2/4/6 and the `write`/`canonical` stubs to
  this task.
- [`cifra_js/chords.md`](./chords.md), [`cifra_js/text_layer.md`](./text_layer.md),
  [`cifra_js/package.md`](./package.md), [`cifra_js/setlists.md`](./setlists.md)
  — the predecessors and the sibling writer: the harness shape
  (`readingChecks(entry, impl)` returning `{ id, run }`; `discover`/`dump`/
  `compareBytes`/`compareModelBytes`/`stripModel`/`staleLedgerIds`), the
  expected-failure ledger convention (a listed id asserted to fail, an unlisted
  id asserted to pass, executed either way; a stale id fails the harness), the
  zero-runtime-dependency rule, the *"compare bytes, never deep-equal"* rule,
  and the "corpus-facing operations are stubs until their task" seam. `setlists`
  is the in-repo writer precedent (`writeSetlist`/`canonicalSetlist`) — its
  read-after-write canonicalisation is **not** carried over for songs
  (§Decisions).
- **Specification (normative) —
  [`spec/8-normalisation.md`](/home/ruoso/devel/cifra.md/spec/8-normalisation.md):**
  - §8.1 the canonical form, lines 8–54 — the five properties a writer MUST
    preserve: *unique* (*"Nothing in it is left to a writer's choice"*, lines
    17–20), *a fixed point* (lines 21–23), *depends on the text alone* (lines
    24–26), *reads back as its own model* (*"apart from the line numbers in
    diagnostics and in `sungAt`"*, lines 27–29), and *holds no marker line*
    (*"a writer refuses to save it"*, lines 30–33); *"A writer that saves a
    document MUST save it in canonical form"* (lines 36–37); canonical form
    takes precedence over preserving the text, but *"it never moves a chord to
    another syllable"* (lines 39–51); Appendix A is never applied (lines 53–54).
  - §8.2 what canonicalising changes, lines 56–100 — the text, metadata, chart
    and voicings changes, and which of them a reader has already reported (lines
    98–100). Informative, but the enumeration the unit tests pin case by case.
  - §8.3 footnote invariants, lines 102–150 — the definition of a *used* key
    (lines 110–111); **I1** every key in a block is used (lines 113–115);
    **I3** one shape, one key — the merging rule with "the same" and "tells
    apart" (lines 117–130); **I2** indices are contiguous — renumber 1…n in the
    chart and every block (lines 132–136); **I4** defaults are not written —
    *"binds an application when it edits"* and *"is not part of the canonical
    form"* (lines 138–141); **I5** the chart and the blocks agree — one-pass
    rewrite, *"a writer MUST NOT leave a state where a chart token names an
    index no block was rewritten for"* (lines 143–146); the application order
    **I1 → I3 → I2** (line 108) and the sung-line re-layout after (lines
    148–150).
  - §8.4 writing the canonical text, lines 152–412 — *"This section is the
    canonical writer … An implementation in any language follows it step by
    step"* (lines 154–156). §8.4.1 the text (UTF-8, no U+FEFF, NFC, LF, no CR,
    no tab, no trailing space, no leading/trailing blank line, never two blank
    lines outside a verbatim fence, one final LF; the block sequence separated
    by one blank line; the empty document is the zero-byte file, lines
    158–176). §8.4.2 metadata (the title line and one line per property in
    model order, lines 178–189). §8.4.3 the chart (heading text with ` @`
    anchor and ` x` count and the closing-`#` guard; the three section forms;
    a part as notes / a music fence / a verbatim fence; the fence character and
    length rule; a bracket or label heading written into a music fence, steps
    1–4, lines 191–254). §8.4.4 music lines — the item-text table, the token
    steps 1–6, bar-line/anchor token rendering, the non-sung chord line joined
    by single spaces, and the `,` guard (lines 256–347). §8.4.5 sung lines —
    the chord line at written columns and the words line with `_` padding,
    *"The writer prints it … and decides nothing"* (lines 350–379). §8.4.6 the
    voicings part — the rule, block order by first tuning then variation, the
    block heading/items/notes, and the code-point sort with the UTF-16 warning
    (lines 382–412).
  - §8.5 editing operations, lines 414–491 — **out of scope** (the
    `cifra_js.editing` task, `depends !writer`); noted so the boundary is
    explicit. §8.6 transposition *"Not defined in this version"* (lines
    493–502); §8.7 legacy forms never applied by canonicalising (lines 504–515).
- [`spec/9-conformance.md`](/home/ruoso/devel/cifra.md/spec/9-conformance.md)
  lines 55–62 — the **Writer** profile (*"Must meet: §8 … it MUST save every
  document in the canonical form of §8.4, and canonicalising with it MUST give
  the same bytes as with any other conforming writer. A writer that checks
  whether a document is canonical does so by canonicalising it and comparing"*);
  §9.2 lines 109–125 (a writer writes unknown properties' values back under
  their lower-cased keys); §9.3 lines 127–137 (the corpus pins the writer in
  both directions).
- **Reference, the behaviour to match** (port, never import —
  `/home/ruoso/devel/cifra.md/reference/`):
  - `reference/cifra_md/write.py` (358 lines) — `write(doc)` (335,
    `serialize(canonical(doc))` then `check_unmarked`), `canonical(doc)` (128,
    the model→model canonicaliser: empty title → None, drop all-null `fingers`,
    `footnotes`, sort voicings, `_collapse_blank_runs` on notes, re-`converge`
    sung lines, `_rederive`; leaves `sungAt`/`diagnostics`), `serialize(doc)`
    (297), `footnotes(doc)` (70, the §8.3 invariants I1/I3/I2 with `_same_shape`
    66 and `_chord_items` 54), `_collapse_blank_runs` (119), `_rederive(doc)`
    (157, bar numbers and repeat groups recomputed with the reader's helpers),
    `fence` (179), `music_lines` (191), `heading_line` (208), `heading_name`
    (216), `_chart_blocks` (225), `_voicing_blocks` (278), `MarkedTextError`
    (317), `check_unmarked(text)` (328), `is_canonical(text)` (343),
    `_dialect(doc)` (36).
  - `reference/cifra_md/layout.py` — the writer-half renderers `item_text` (30),
    `line_tokens` (64), `_token_text` (159), `chart_line_text` (168),
    `chord_text` (457), `lyric_text` (440), `sung_text` (474); `converge` (366)
    the reader already ported, which `canonical` reuses for the sung-line
    re-layout.
  - `reference/tests/test_writer.py` (161 lines) — the §8.4 unit cases to port:
    the examples are canonical and have no diagnostics and validate; the chord
    line (single spaces and bars, leading/closing bars, double bar, repeat
    marks, endings, a close mark against a chord, anchors, an anchor-only line
    moving to the next bar, unknown tokens and repeat signs, cifra counts
    becoming `x` form, beat runs and annotations); a heading count and anchor; a
    verbatim fence; `N.C.`; the sung-line cases (line count, columns kept, lead
    words, a forced line, lyric lines and breaks, bars on a sung line);
    metadata; headings become level 2; cifra headings share one fence; notes
    kept in place; an empty section kept; a heading anchor; voicings sorted and
    single-spaced, blocks ordered by first tuning (default first), problems
    dropped, empty blocks written as headings, no blocks → no rule, notes in
    blocks following the items.
  - `reference/tests/test_canonical.py` (709 lines) — the §8.1/§8.2/§8.3 cases:
    the text layer (BOM, CR LF and lone CR, every BOM removed, trailing spaces
    removed, tabs → one space, NFC and NFC keeping chords over syllables, a
    no-break space is not whitespace, not-UTF-8 refused, the empty document is
    the empty file, one final newline); metadata (title and properties then one
    blank line, title only, empty title dropped, keys lower-cased with first
    position and last value, empty value, non-property items dropped, never adds
    a property); the chart (items and bars one space apart, a close mark then
    count, marks against bars, bar-line spellings, counts/endings/marks, no-chord
    and punctuation, anchor first in its measure, unknown tokens kept, …); the
    footnote invariants I1/I3/I2 on a chart and a sung line; the fixed-point
    round-trip helper. The JS unit files port these case by case.
  - `reference/tests/test_corpus.py` — how the reference runs the entries in
    both directions; the JS mirror is the harness.
- **Corpus (the thirty-four song reading entries) —
  `/home/ruoso/devel/cifra.md/corpus/`:** entries `01`…`34` (listed in
  [`corpus/README.md`](/home/ruoso/devel/cifra.md/corpus/README.md) lines
  66–85), each with `input.cifra.md`, `input.parsed.json`, `canonical.cifra.md`,
  `parsed.json`. The §8-exercising entries this task is held to include: layout
  normalisation and heading levels (`01-minimal-chart`), the text layer
  (`03`, `26`), blank lines in fences (`21`), repeat marks and counts (`22`),
  fence lengths and info strings (`23`), **the footnote invariants I1/I3/I2 on
  a chart and a sung line** (`24-footnote-invariants`), headings (`25`), sung
  line layout with tokens that grow and shrink and the guard (`28`), the
  voicings part — what canonicalising drops, label and tuning spelling, merged
  blocks (`29-voicings-part`), the title-only document (`30`), the empty document
  → empty file (`31`), an unclosed verbatim fence (`32`), sung anchors kept at
  their columns (`33`), and pushed words so every chord stays over its character
  (`34`). [`corpus/README.md`](/home/ruoso/devel/cifra.md/corpus/README.md)
  lines 37–53 — the five numbered checks and the reference's sixth, and the rule
  that texts compare byte for byte and models compare exactly (array and key
  order are part of the model).
- **Harness (what this task flips) — `/home/ruoso/devel/cifra.md/js/`:**
  - `js/test/corpus/harness.js` — `readingChecks` (162–255, already routes
    songs to `impl.write`/`impl.canonical`, ext `.cifra.md`, and builds checks
    `2`/`4`/`6`); check 6 strips top-level `diagnostics` and `sungAt` before
    comparing (`stripModel`, 115–121). No harness change is needed.
  - `js/test/corpus.test.js` — loads `expected-failures.json`, guards it with
    `staleLedgerIds`, asserts each check fail/pass per the ledger.
  - `js/test/corpus/expected-failures.json` — currently lists, for every one of
    the thirty-four song entries, the three ids `/2 /4 /6` (102 ids). This task
    **removes** those 102 ids (they become passing), and adds none.
  - `js/src/index.js` lines 80–88 — the two song-writer stubs this task flips
    (`write`, `canonical`); the `merge` stub (line 95) stays.

Governing component boundaries:
[`docs/DIRECTION.md`](../../docs/DIRECTION.md) §3.6 (cifra.md for JavaScript in
`js/`, *"Reads and canonicalizes songs and setlists…"*) and §3.7 (*"The music
core … and cifra.md for JavaScript know nothing of React; the view is the only
layer that does"*).

## Constraints / requirements

- **The §8.4 serialiser, byte for byte against the corpus.** `write` produces
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
  variation, each block's items ordered by symbol then index, and the code-point
  sort done on code points not UTF-16 code units (§8.4.6 lines 409–412).
- **The §8.3 footnote invariants, applied I1 → I3 → I2, in one pass.**
  `canonical` drops a key no occurrence uses (I1), merges two indices no block
  tells apart into the lower one and drops the merged entries (I3), and
  renumbers each symbol's used indices 1…n in the chart and every block alike
  (I2) — rewriting chart tokens and block keys in one step so no chart token
  names an index no block was rewritten for (I5). A rewritten token on a sung
  line changes width, so `canonical` re-lays-out that line with `converge`
  afterwards (§8.3 lines 148–150, §4.5). I4 is **not** part of the canonical
  form (it binds an application when it edits — `cifra_js.editing`), and is not
  implemented here beyond the serialiser never inventing a default shape
  (§Decisions).
- **The writer prints a laid-out sung line and decides nothing** (§8.4.5). The
  model's sung lines are already laid out (the reader lays them out; `canonical`
  re-lays-out those whose marker changed width). `sungText` prints the two
  lines from the model's columns and words — the chord line with each token at
  its written column, the words line with `_` padding only in the gaps the
  layout left — and never moves a chord to another syllable (§8.1 lines 48–51).
  The `,` guard is applied to a chord line whose first character the layout left
  as a space and which would otherwise read as a heading/annotation/forced line
  (§8.4.5 lines 356–361).
- **Chords are copied as written; the writer does not re-spell.** The item-text
  table writes a chord as *"its key: the symbol"* (§8.4.4) — the symbol the
  reader stored, not a re-derived spelling. The §5.7 model→symbol formatter is
  **not** built here; it is `cifra_js.editing`'s, for the operations that change
  a chord (§Decisions, mirroring [`chords.md`](./chords.md)). The dialect
  `canonical` resolves from the model is used only by `converge`'s misread check
  on re-layout.
- **A marked text is refused, never written** (§8.1 lines 30–33). `write`
  (via `checkUnmarked`, using `isMarkerLine`/`markerLines`) throws
  `MarkedTextError`, naming the first marker line, rather than return a text
  that holds a line of git's conflict markers. No song corpus entry triggers it
  (a reader keeps a marker line as notes and reports `marker-line`; the
  canonical model of a clean document holds none), so this is pinned by a
  purpose-written unit test, and `MarkedTextError`/`isCanonical` are re-exported
  for the app's save path (the standing rule: a marked text is never canonical,
  never saved, never pushed).
- **`canonical` leaves `sungAt` and `diagnostics` as they were** (§8.1 lines
  27–29; `write.py:canonical` docstring). They describe a text, not a model; the
  harness's check 6 strips both before comparing (`stripModel`), and the app
  wants the canonical model carrying the input's diagnostics so it can say what
  canonicalising dropped. `canonical` re-derives the model's **derived** fields
  — bar numbers and repeat groups — as a reader would, reusing `parse.js`'s
  derivation helpers (one implementation of bar-numbering, not a second copy;
  §Decisions).
- **The canonical form is unique and a fixed point** (§8.1 lines 17–23). The
  serialiser leaves nothing to choice; `write(parsed.json) == canonical.cifra.md`
  (check 4) and `write(input.parsed.json) == canonical.cifra.md` (check 2) both
  hold, and `isCanonical(text)` is defined as `write(parse(text)) == text`.
- **Framework-free, zero runtime dependencies** (DIRECTION §3.7; stream header;
  [`package.md`](./package.md)). `write.js` and the `layout.js` additions import
  only other `js/src/` modules (`parse.js`, `layout.js`, `chord.js`, `pitch.js`,
  `tuning.js`, `frets.js`, `text.js`) and language built-ins — regular
  expressions, `String.prototype.normalize`, plain objects/arrays — and add no
  `dependencies` entry. They know nothing of React, storage, the network or the
  filesystem; the app's save path (which decides *when* to save and surfaces
  `MarkedTextError`) is the Worker's. Node built-ins may appear only under
  `js/test/`.
- **Agreement is by the corpus, not shared code** (DIRECTION §3.6). The modules
  are a **port** of `write.py`/`layout.py`; they import, transpile or shell out
  to no Python or Go. A disagreement with the reference is settled in the spec
  and the corpus, never by copying code.
- **Standing rules scoped where they apply:** *Canonical form over preserving
  content* — this module writes canonical form only and preserves no
  non-canonical spelling; where keeping the author's text and writing
  canonically conflict, the canonical form wins (§8.1 lines 39–51). *A marked
  text is never canonical, never saved or pushed* — enforced by the refusal
  above. *Test fixtures are purpose-written* — the unit tests use tiny invented
  songs and the purpose-written corpus entries 01–34, never anyone's copyrighted
  words. *No song text in logs*, *offline first*, *accessibility* and *no book
  without an account* do not apply: this is a pure format module with no UI,
  network, storage or logging (noted so the omission is deliberate, per the
  brief).

## Acceptance criteria

**Behaviour delivered.** `js/src/write.js` implements the §8 canonical writer —
`write(model)` (the public entry, `serialize ∘ canonical` with the §8.1
marked-text refusal), `canonical(model)` (the §8.2/§8.3/§4.5 model-level
canonicaliser applying I1 → I3 → I2, re-laying-out sung lines whose markers
changed width, and re-deriving bar numbers and repeat groups), `serialize(model)`
(the §8.4 serialiser), `footnotes`/`fence`/`musicLines`/`headingLine`/
`headingName`/the chart-block and voicing-block assembly, `checkUnmarked`/
`MarkedTextError` and `isCanonical`; `js/src/layout.js` gains the §8.4.4/§8.4.5
renderers (`chartLineText`, `sungText`, `chordText`, `lyricText`); both are
re-exported from `js/src/index.js`, flipping the `write` and `canonical` stubs.
The thirty-four song corpus entries pass checks 2, 4 and 6. `scripts/gate
cifra.md` runs it all via `npm test` in `js/`, alongside the reference's
unchanged `pytest`. The `merge` stub stays a stub.

**Tests the task lands with, by level** (the `.tji` `Tests:` clause names
unit + corpus; format work's conformance level **is** the corpus — there are no
behavior, e2e-api or e2e-web levels):

- **unit (Vitest, `js/test/writer.test.js`)** — the §8.4 serialiser on
  purpose-written models, ported from `reference/tests/test_writer.py`:
  - *The chord line* (§8.4.4): items and bar lines joined by single spaces;
    leading and closing bars; the double bar; repeat marks on bar lines; endings
    (`1.`, `2.`); a close mark against a chord; bar anchors (`@9`) and an
    anchor-only line moving to the next bar; unknown tokens and repeat signs
    (`%`); cifra counts (`(2x)`) written as `x` form; beat runs and annotations
    (`// `); `N.C.`; punctuation dropped.
  - *Sections, fences and metadata* (§8.4.1–§8.4.3): the title line and
    properties then one blank line; a title-only document; heading levels become
    2; a heading's count and anchor and the closing-`#` guard; cifra (bracket/
    label) headings sharing one fence and carrying a leading chord line; a
    verbatim fence with its info string; notes kept in place with blank runs
    collapsed; an empty section kept as a heading; the fence character and
    length rule.
  - *Sung lines* (§8.4.5): the two-line count; columns kept; the lead words; a
    forced line written with `>`; lyric lines and breaks; bars on a sung line
    at their columns; the `,` guard.
  - *The voicings part* (§8.4.6): items sorted and single-spaced; blocks ordered
    by first tuning with the default variation first; problem items dropped;
    empty blocks written as a heading alone; no blocks → no rule; notes in a
    block following the items; the code-point sort (a supplementary-plane symbol
    sorts by code point, not UTF-16 code unit).
  Pins §8.4 construct by construct.
- **unit (Vitest, `js/test/canonical.test.js`)** — `canonical`, the §8.1
  properties, §8.2 changes and the §8.3 invariants, ported from
  `reference/tests/test_canonical.py` on purpose-written models and texts:
  - *The text and the fixed point* (§8.1, §8.4.1): BOM / CR LF / lone CR removed
    (via a read-then-write round-trip), trailing spaces removed, tabs → one
    space, NFC with chords kept over their syllables, a no-break space kept as a
    character, the empty document → the empty file, one final newline;
    `isCanonical` true on a canonical text and false on an uncanonical one;
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
    `24` and `34`).
  - *The marked-text refusal* (§8.1): `write` on a model whose serialisation
    would hold a line of git's conflict markers throws `MarkedTextError` naming
    the first marker line; `isCanonical` is false for such a text.
- **corpus (Vitest, `js/test/corpus.test.js` via `js/test/corpus/harness.js`)**
  — the thirty-four song entries `01`…`34` pass checks `2` (write
  `input.parsed.json` → `canonical.cifra.md`), `4` (write `parsed.json` →
  `canonical.cifra.md`, the fixed point) and `6` (model-level
  `canonical(input.parsed.json)` → `parsed.json`, stripped of
  `diagnostics`/`sungAt`), each **byte for byte**. The 102 ids
  (`01-34/{2,4,6}`) are **removed** from
  `js/test/corpus/expected-failures.json`; `checkIds` still finds them (the
  harness already enumerates them), so the ledger stays stale-free
  (`staleLedgerIds`) and `cifra_js.conformance` is that much closer to an empty
  ledger. The born-passing `<entry>/tl` and `<entry>/chords` checks stay green
  on all thirty-four. This pins §8 against the committed corpus bytes
  `format.canonical_form` produced; with the reader's checks 1 and 3 it closes
  the read↔write cycle in both directions.

A regression test is planted in `js/test/harness.test.js` only if the writer
adds a new born-passing check; it does not (it flips ledger entries), so the
existing ledger guard (a premature pass or a regression fails the gate) is the
guard. The `.tji` `Tests:` clause is sharpened to these files and cases; no
level it names is dropped.

**Deferred work.** None registered by this task. The §8.5 editing operations
(choose a shape for an occurrence or a key, clear, the batch op, add a
variation) are **not** a follow-up this task creates — they are the existing
`cifra_js.editing` leaf (`depends !writer`), whose note already reads *"§8.5 …
what the arrange mode and the wizard call"*. The §5.7 model→symbol chord
formatter is the editing task's (the writer copies symbols as written), as
[`chords.md`](./chords.md) recorded. §8.6 transposition is *"Not defined in
this version"* and is not a WBS leaf. No new leaf.

## Decisions

- **A new `write.js` for chapter 8; the per-line renderers extend `layout.js`.**
  The reference splits the writer across `write.py` (the document serialiser,
  the §8.3 invariants, the canonicaliser, the marked-text guard) and `layout.py`
  (the per-line renderers `chart_line_text`/`sung_text`/`chord_text`/
  `lyric_text`, beside the `converge` engine). The reader refinement already
  reserved the `layout.js` renderers for this task
  ([`cifra_js/reader.md`](./reader.md) §Repository, §Decisions), because they
  share the token model (`lineTokens`, `itemText`) and the §4.5 layout with the
  reader — one token model both lays a sung line out and prints it, which is
  what makes reading a document and reading its canonical form agree (§8.4.5
  lines 376–379). The document-level serialiser, the invariants and the
  canonicaliser go in `write.js`, matching the reference split. *Rationale:*
  a shared token model wants one home (`layout.js`); the document serialiser is
  a new concern with one call site (`write`), so a new module. *Alternatives
  rejected:* (a) putting the per-line renderers in `write.js` — forces a second
  token model or an odd `write.js → layout.js → write.js` dependency, and
  contradicts the reader's recorded plan; (b) one giant `write.js` holding
  everything including a copy of the layout — duplicates `converge`'s token
  model. The module names are a layout choice the implementer may adjust;
  `package` fixed only the `index.js` surface (`write`, `canonical`).

- **`canonical` is a dedicated model→model function, not read-after-write.**
  The sibling `cifra_js.setlists` defined `canonicalSetlist(model)` as
  `parseSetlist(writeSetlist(model))` ([`setlists.md`](./setlists.md)
  §Decisions). That does **not** carry over to songs, and this task ports the
  reference's dedicated `write.py:canonical` instead. *Rationale:* a setlist's
  canonicalisation is purely textual (reorder entries, collapse a repeated key,
  renumber) — read-after-write expresses it with no second code path. A song's
  canonicalisation is **model-level**: the §8.3 footnote invariants (I1/I3/I2)
  merge and renumber indices across the chart and every block, and the §4.5
  re-layout runs on the sung lines whose markers changed width — operations on
  the model, which `write.py:canonical` performs directly and which the
  serialiser (`serialize`) then assumes already applied. The reference also
  contracts that `canonical` leaves `sungAt` and `diagnostics` as they were
  (they describe the input text); `parse(write(model))` would recompute them
  against the canonical text and renumber lines, discarding the input's — wrong
  for a model-level canonicaliser the app uses to show what a save will drop,
  even though the corpus check 6 strips both. *Alternative rejected:*
  `canonical = parse ∘ write` for songs — it happens to satisfy check 6 (which
  strips the differing fields) but breaks the reference's contract and the app's
  use, and would make `write = serialize ∘ canonical` circular with a
  parse step in the middle.

- **I4 is not implemented as part of the canonical form.** §8.3 I4 (*"Defaults
  are not written"*) *"binds an application when it edits … It is not part of
  the canonical form, which cannot know what an application's default is"*
  (§8.3 lines 138–141). The serialiser therefore does not strip "default"
  shapes — it has no notion of a default — and simply writes the chosen shapes
  the model holds; honouring I4 is `cifra_js.editing`'s (it must not write its
  default into a block). *Rationale:* the spec says so explicitly. *Alternative
  rejected:* threading an application default into the writer — the canonical
  form must depend on the text alone (§8.1 lines 24–26).

- **The writer copies chord symbols as written; no §5.7 formatter here.** The
  §8.4.4 item table writes a chord as its stored symbol, and §8 never re-spells
  a chord. The model→symbol formatter (§5.7 preferred spellings) belongs to the
  operations that change a chord — transposition and respelling — which are
  `cifra_js.editing`'s (§8.5/§8.6). *Rationale:* matches the reference (its
  `item_text` writes the stored symbol) and the recorded chords-task decision
  ([`chords.md`](./chords.md)); building a formatter here would be unused by any
  corpus entry (canonical text keeps the symbol). *Alternative rejected:*
  building the formatter now — scope creep into the editing task, untested by
  the writer corpus.

- **Re-deriving bar numbers and repeat groups reuses the reader's helpers.**
  `canonical` recomputes the model's derived fields (bar numbers when the song
  is not sung, repeat groups per section) exactly as the reader does, reusing
  `parse.js`'s derivation (`numberBars`/`pairRepeats` or their JS equivalents,
  imported or re-exported), as the reference's `_rederive` reuses the parser's
  methods. *Rationale:* one implementation of bar-numbering held to the corpus,
  not a second copy that could drift (DIRECTION §3.6's one-correct-copy rule,
  within a language). *Alternative rejected:* a separate re-derivation in
  `write.js` — two copies of the §2.8/§3 rules to keep in step.

- **`MarkedTextError` and `isCanonical` are re-exported for the app.** The
  refusal (§8.1) and the canonicality check (*"A writer that checks whether a
  document is canonical does so by canonicalising it and comparing"*, §9.1) are
  part of the writer's public contract: the app's save path surfaces the refusal
  to the user and uses `isCanonical` to know whether a save would change the
  file. *Rationale:* the standing rule that a marked text is never saved or
  pushed is enforced at the writer, and the app needs the handle. *Alternative
  rejected:* keeping them private — the app would re-implement the marker scan
  or the compare, a second copy.

- **No design delta.** Chapter 8, the §9.1 Writer profile and the thirty-four
  corpus entries are already normative; `write.js` is an internal module split
  and no runtime dependency is added. *Rationale and alternative* mirror
  [`package.md`](./package.md), [`reader.md`](./reader.md) and
  [`setlists.md`](./setlists.md): a format task that implements the spec as
  written needs no spec change.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- cifra.md `c10ea54`: `js/src/write.js` (new) — the §8 canonical writer:
  `write`/`canonical`/`serialize`, footnote invariants I1→I3→I2 (`footnotes`),
  `fence`/`musicLines`/`headingLine`/`headingName`, chart-block and voicing-block
  assembly (code-point sort), `checkUnmarked`/`MarkedTextError`, `isCanonical`,
  `_dialect`.
- cifra.md `c10ea54`: `js/src/layout.js` — added the §8.4.4/§8.4.5 renderers
  `chartLineText`, `lyricText`, `chordText`, `sungText`, sharing the reader's
  token model (`lineTokens`, `itemText`, `unpad`, `converge`).
- cifra.md `c10ea54`: `js/src/parse.js` — exported `COUNT`, `asciiLower`,
  `keyFor`; added `rederive` (reuses `numberBars`/`pairRepeats`, one copy of
  §2.8/§3).
- cifra.md `c10ea54`: `js/src/index.js` — `write`/`canonical` stubs replaced by
  re-export from `write.js`; `MarkedTextError`/`isCanonical` added; `merge` stub
  kept.
- cifra.md `c10ea54`: `js/test/writer.test.js` (new, 32 tests) — §8.4 serialiser
  construct-by-construct; `js/test/canonical.test.js` (new, 44 tests) — §8.1/
  §8.2/§8.3 incl. footnote invariants, sung re-layout, marked-text refusal.
- cifra.md `c10ea54`: `js/test/corpus/expected-failures.json` — 102 song ids
  removed (`01-34/{2,4,6}`); all 34 songs now pass checks 2, 4 and 6 byte for
  byte (corpus.test.js: 389 tests).
