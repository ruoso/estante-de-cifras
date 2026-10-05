# cifra_js.text_layer — Text layer

## TaskJuggler entry

`task text_layer` in [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) (lines
15–20), under `task cifra_js`. One line there: *"Text layer."* The area
file's header states the stream's rule: *"The app's implementation of the
format, held to the corpus byte for byte. Framework-free: the view is the
only layer that knows React"* ([`tasks/10-cifra-js.tji`](../../10-cifra-js.tji)
lines 1–4).

The `.tji` note: *"cifra.md: §1.3 — UTF-8, NFC, LF, U+FEFF, tabs, whitespace
as U+0020 only, marker lines. Tests: unit (each §1.3 rule: NFC, LF, U+FEFF,
tabs, whitespace, marker lines); corpus (the text-layer checks of the entries
that exercise them flipped to passing)."*

## Effort estimate

**1 day** (from the `.tji`).

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, extended by this
task:

- `js/src/` — a new module `text.js` holding the §1.3 text layer and the
  §11.12.3 marker-line primitive; re-exported from `js/src/index.js`. No new
  runtime dependency (the text layer uses only the platform's `TextDecoder`
  and `String.prototype.normalize`).
- `js/test/` — the text-layer unit tests (`text.js`'s own Vitest suite) and a
  text-layer check added to the corpus harness.

The corpus beside `js/` is unchanged: this task is a **consumer** of the
already-committed corpus bytes (the Python reference generates and checks the
corpus; this task touches nothing under `reference/` or `corpus/`).

No design delta is authored. The §1.3 text layer and the §11.12.3 marker-line
definition are already normative in the specification; the text-layer harness
check is a test-harness convention like the expected-failure ledger the
`package` task introduced, not a new architectural seam or a change to
designed behaviour (§Decisions).

## Inherited dependencies

- **`cifra_js.package` — settled.** Complete (cifra.md `552cf37`,
  [`cifra_js/package.md`](./package.md) Status): `js/` exists as a
  framework-free, zero-runtime-dependency ES-module package with its Vitest
  corpus harness. The harness discovers every reading entry (song +
  setlist) and every merge entry, runs each entry's checks and asserts them
  against `js/test/corpus/expected-failures.json` (listed → must fail,
  unlisted → must pass), and `js/src/index.js` exports seven corpus-facing
  stubs — `parse`, `write`, `canonical`, `parseSetlist`, `writeSetlist`,
  `canonicalSetlist`, `merge` — that throw `NotImplementedError`. The stub
  comment on `parse` already records that it *"[t]akes bytes because the text
  layer (spec §1.3) begins by validating UTF-8"* — this task is the direct
  seam that comment points at.
- **`format.canonical_form` — settled** (transitively, through `package`):
  the specification, the Python reference and the four-file corpus that this
  task is held to.

No other `cifra_js` task precedes this one: `text_layer` is the first task on
the chain after the scaffold (`chords` `depends !text_layer`, then `reader`,
`writer`, …).

## What this task is

This task implements the **text layer** — the first thing every cifra.md
reader does, before anything is parsed: the six-step preparation of §1.3 that
turns a file's bytes into the list of lines everything above it reads, shared
by songs and setlists alike (§10.2). In order: reject non-UTF-8 bytes;
remove every U+FEFF; normalise to NFC; split into lines (at LF, at CR LF, or
at a lone CR); replace each tab with one space; strip trailing spaces. It
also delivers the **marker-line** primitive of §11.12.3 — the pure test of
whether a line, *after* the text layer, is one of git's conflict markers
(`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`), which later tasks use to refuse
to save a marked text (writer, §8) and to report marker lines (reader, merge,
hook).

Concretely it adds `js/src/text.js` — a port of the reference's
`reference/cifra_md/text.py` — exporting:

- `decode(bytes) → string` — UTF-8 decode, throwing a dedicated
  `NotUtf8Error` on invalid bytes (mirroring the reference's `NotUTF8Error`);
- `prepare(bytes | string) → string[]` — the full six-step layer; on `bytes`
  it decodes first (so invalid UTF-8 throws), on a `string` it assumes the
  bytes were already valid and skips step 1, exactly as the reference does;
- `markerLines(bytes | string) → number[]` — the 1-based line numbers of the
  marker lines in a text, computed over `prepare(...)` so the text layer is
  applied first;
- a `NotUtf8Error` class.

The corpus-facing stubs in `index.js` stay stubs: this task does not build a
reader or writer, so it cannot produce or serialise a model, and therefore
cannot flip the whole-entry corpus checks (1–4, 6) of any entry — those
belong to `cifra_js.reader`/`cifra_js.writer`/`cifra_js.setlists` (§Decisions,
§Acceptance criteria). What it adds to the harness is a **text-layer check**
the text layer alone can satisfy against the real corpus bytes.

## Why it needs to be done

The text layer is the floor of the whole format. The Chart reader profile —
the base profile every cifra.md reader claims — requires an implementation to
*"prepare the text exactly as §1.3 says, in that order"*
([`spec/9-conformance.md`](file:///home/ruoso/devel/cifra.md/spec/9-conformance.md)
lines 19–21). Every downstream `cifra_js` task consumes it: `reader` calls it
to get its lines (the reference's `_Parser.__init__` does `self.lines =
prepare(text)`); `writer` must refuse to save a marked text and point at the
first marker line (§8, [`spec/8-normalisation.md`](file:///home/ruoso/devel/cifra.md/spec/8-normalisation.md)
lines 30–33); `merge` treats a present input that *"holds a marker line
(§11.12.3), after the text layer of §1.3"* as a marked text giving an
`unresolved` conflict ([`spec/11-merge.md`](file:///home/ruoso/devel/cifra.md/spec/11-merge.md)
lines 193–203); and the app's offline canonicality check (and, in the service
repository, the push hook) must *"find a marked text not canonical"*
(§11.12.3 line 1046). Putting the text layer and the marker-line primitive in
one small, exhaustively unit-tested module — as the reference co-locates them
in `text.py` — gives all of those a single correct implementation to call.

Downstream consumers: `cifra_js.chords` (`depends !text_layer`) and the whole
chain onward to `cifra_js.conformance`; and, once the app streams exist, the
Worker's reader/writer/merge paths (DIRECTION §3.7).

## Inputs / context

- [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 1–4 (stream header),
  15–20 (`task text_layer`, its `depends !package`, the `note` and its
  `Tests:` clause: unit + corpus).
- [`cifra_js/package.md`](./package.md) — the predecessor: the harness shape
  (checks are `{ id, run }`; `discover`/`readingChecks`/`mergeChecks`/`dump`/
  `compareBytes`/`staleLedgerIds`), the expected-failure ledger convention,
  the zero-runtime-dependency rule, the *"compare bytes, never deep-equal"*
  rule, and §Decisions "Corpus-facing operations are stubs now."
- **Specification (normative):**
  - [`spec/1-document.md`](file:///home/ruoso/devel/cifra.md/spec/1-document.md)
    §1.3 lines 28–70 — the text layer. The six steps in order (lines 34–47);
    *"**space** and **whitespace** mean U+0020 and nothing else … A no-break
    space … is an ordinary character: it is never trimmed and never separates
    anything"* (lines 49–54); *"A **blank line** is a line that is empty after
    step 6"* (line 56); why a tab becomes one space, not a run to the next tab
    stop (lines 58–62). §1.1 lines 6–9 — non-UTF-8 bytes *"are not a document:
    a reader MUST report them and read nothing."*
  - [`spec/11-merge.md`](file:///home/ruoso/devel/cifra.md/spec/11-merge.md)
    §11.12.3 lines 1035–1056 — a **marker line** is a line, *after the text
    layer of §1.3*, that is `<<<<<<<`, `=======`, `>>>>>>>` or `|||||||`,
    alone or followed by a space and anything; a text holding one is a
    **marked text**, never canonical; lines 1053–1056 — so no document may
    hold a line of exactly seven `=`/`<`/`>`/`|`, even in notes.
  - [`spec/8-normalisation.md`](file:///home/ruoso/devel/cifra.md/spec/8-normalisation.md)
    lines 30–33 — canonical form *"holds no marker line."*
  - [`spec/9-conformance.md`](file:///home/ruoso/devel/cifra.md/spec/9-conformance.md)
    lines 19–21 — the Chart reader profile MUST *"prepare the text exactly as
    §1.3 says, in that order."*
- **Reference, the behaviour to match** (port, never import —
  `/home/ruoso/devel/cifra.md/reference/`):
  - `reference/cifra_md/text.py` — `_LINE_END = re.compile(r"\r\n|\r|\n")`
    (line 8); `NotUTF8Error(ValueError)` (line 11); `decode(data: bytes) ->
    str` raising `NotUTF8Error(f"not valid UTF-8 at byte {e.start}")` (lines
    15–19); `prepare(text: str | bytes) -> list[str]` — bytes→`decode`,
    `text.replace("﻿", "")`, `unicodedata.normalize("NFC", text)`, empty
    text → `[]`, `_LINE_END.split`, pop a trailing empty element, then per
    line `ln.replace("\t", " ").rstrip(" ")` (lines 22–47); `is_marker_line`
    (line 50) and `marker_lines(text) -> list[int]` as the 1-based positions
    over `prepare(...)` (line 56).
  - `reference/tests/test_canonical.py` class `TestText` (lines 36–90) — the
    text-layer cases to port: `test_bom_crlf_and_lone_cr` (37),
    `test_every_byte_order_mark_is_removed` (40),
    `test_trailing_spaces_are_removed_everywhere` (47),
    `test_tabs_become_one_space` (51), `test_nfc` (56),
    `test_nfc_keeps_chords_over_their_syllables` (59),
    `test_no_break_space_is_not_whitespace` (68), `test_not_utf8_is_refused`
    (75), `test_empty_document_is_the_empty_file` (79),
    `test_one_final_newline` (83).
  - `reference/tests/test_marker_lines.py` — `test_marker_lines`/
    `test_lines_that_are_not_markers` (22, 27),
    `test_markers_are_found_after_the_text_layer` (31,
    `marker_lines("a\r\n=======  \r\n<<<<<<<\t\n") == [2, 3]`),
    `test_text_that_is_not_utf8_is_not_canonical` (67).
- **Corpus (the entries that exercise §1.3) —
  `/home/ruoso/devel/cifra.md/corpus/`:**
  - `03-crlf-bom/` (song) — a BOM and CR LF line ends throughout.
  - `26-text-layer/` (song) — the dense one: a BOM, a second U+FEFF mid-line,
    lone-CR line ends, tabs, non-NFC (`Cafe`+combining acute → `Café`), a
    no-break space both in a lyric and leading a chart line, and trailing
    spaces. [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
    line 76 summarises it.
  - `47-setlist-text-layer/` (setlist) — the setlist counterpart: a BOM,
    CR and CR LF ends, a tab, non-NFC in the title, trailing spaces
    ([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
    line 102). The text layer applies to setlists via §10.2.
  - [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
    lines 37–58 — the six checks; no reading entry's input is invalid UTF-8
    (such a file *"is not a document"*), so step 1 is exercised only by unit
    tests and by the merge corpus (`merge/37-file-not-utf8`), which is
    `cifra_js.merge`'s.
- **Harness (what this task extends) —
  `/home/ruoso/devel/cifra.md/js/`:**
  - `js/test/corpus/harness.js` — `readingChecks(entry, impl)` returns the
    per-entry `{ id, run }` list (lines 128–207), `compareBytes` (96–102),
    `dump` (22), `discover` (52), `staleLedgerIds` (265); the text-layer
    check is added here.
  - `js/test/corpus.test.js` — builds `checkIds` from every check, guards the
    ledger against stale ids, and asserts each check against the ledger
    (lines 29–64); a new check id not in the ledger is asserted to pass.
  - `js/src/index.js` — the stubs and `NotImplementedError`; `prepare` /
    `markerLines` / `decode` / `NotUtf8Error` are re-exported from here so the
    harness and future tasks import them from one place.

## Constraints / requirements

- **Match §1.3 exactly, in order.** The six steps run in the order the spec
  gives, because the order is observable: FEFF-removal and NFC happen before
  the split (so an NFC recomposition spanning a would-be line boundary, or a
  FEFF, cannot change where a line begins), and tab→space and
  trailing-space-strip happen per line, after the split (`text.py` lines
  22–47; `reference/tests/test_canonical.py::test_tabs_nfc_and_trailing_spaces_come_first`).
- **Whitespace is U+0020 only.** Step 5 replaces U+0009 (tab) with exactly
  one U+0020 — never a run to a tab stop (§1.3 lines 58–62). Step 6 strips
  only trailing U+0020 (`/ +$/`), never U+00A0 or any other Unicode-whitespace
  character (§1.3 lines 49–54; `test_no_break_space_is_not_whitespace`). A
  **blank line** is the empty string after step 6.
- **Line splitting.** A line ends at LF, at CR LF, or at a lone CR; the
  terminator is not part of the line; a final line without a terminator is a
  line; a terminator at the very end does not begin another line; the empty
  text is zero lines (`[]`). Use the single regex `/\r\n|\r|\n/` (CR LF
  alternative first so it is consumed as one), split, then drop one trailing
  empty element — mirroring the reference.
- **UTF-8 validation is for bytes.** `prepare`/`markerLines` given a
  `Uint8Array` decode with a fatal `TextDecoder("utf-8", { fatal: true })`
  and, on failure, throw `NotUtf8Error` — they do **not** return lines and do
  **not** place a diagnostic in any model (the reference raises; the model is
  never built — a diagnostic for an unreadable file is the *reader*'s and
  *merge*'s concern, which catch the error). Given a `string`, step 1 is
  skipped (the bytes were already decoded), exactly as the reference's
  `str | bytes` entry does. The harness passes Node `Buffer`s (a
  `Uint8Array`), so `decode` must accept them.
- **Marker lines are a layer above §1.3.** `markerLines` applies the text
  layer first, then tests each resulting line: a marker line is exactly
  `<<<<<<<`, `=======`, `>>>>>>>` or `|||||||`, or one of those followed by a
  space and anything (§11.12.3 lines 1037–1041). It returns 1-based line
  numbers. This task delivers only the primitive; refusing to save a marked
  text is `cifra_js.writer`'s, reporting marker lines is `cifra_js.reader`'s,
  and the `unresolved` conflict is `cifra_js.merge`'s.
- **Framework-free, zero runtime dependencies** (DIRECTION §3.7; stream
  header; [`package.md`](./package.md) §Constraints). `js/src/text.js` imports
  nothing from Node and adds no `dependencies` entry — it uses only
  `TextDecoder` and `String.prototype.normalize("NFC")`, both platform
  built-ins available in the browser and in Node. It knows nothing of React,
  storage or the network; it is a pure function of its input.
- **The harness stays a check, ported, never shared.** The text-layer check
  added to `readingChecks` reads only corpus bytes and calls the
  implementation under test; it imports, transpiles or shells out to no
  Python or Go (DIRECTION §3.6: agreement is by the corpus, not shared code).
- **Standing rules scoped where they apply:** *Canonical form over preserving
  content* — the text layer is the first step of canonicalising; it adds
  nothing of its own to preserve. *Test fixtures are purpose-written* — the
  unit tests use tiny invented texts and the purpose-written corpus entries
  03/26/47, never anyone's copyrighted words. *No song text in logs*,
  *offline first*, *accessibility* and *no book without an account* do not
  apply: this is a pure format module with no UI, network, storage or logging
  (noted so the omission is deliberate, per the brief).

## Acceptance criteria

**Behaviour delivered.** `js/src/text.js` implements §1.3 and the §11.12.3
marker-line primitive, matching the reference byte for byte; `prepare`,
`markerLines`, `decode` and `NotUtf8Error` are re-exported from
`js/src/index.js`. The corpus harness gains a text-layer check that runs over
every reading entry and passes. `scripts/gate cifra.md` runs it all via
`npm test` in `js/` (gate lines 378–382), alongside the reference's unchanged
`pytest`. The seven corpus-facing stubs stay stubs.

**Tests the task lands with, by level** (the `.tji` `Tests:` clause names
unit + corpus; format work's conformance level **is** the corpus):

- **unit (Vitest, `js/test/text.js.test.js` — or `js/test/text.test.js`)** —
  each §1.3 rule and the marker-line primitive, ported from the reference's
  `TestText` and `test_marker_lines.py`, on purpose-written inputs:
  - *UTF-8*: valid bytes decode; invalid bytes (`Uint8Array` of e.g.
    `[0x23, 0x0a, 0xff, 0x0a]`) throw `NotUtf8Error`; a `string` input skips
    the check (pins §1.1 lines 6–9, §1.3 step 1, `test_not_utf8_is_refused`).
  - *U+FEFF*: a BOM at the start, a doubled BOM, a U+FEFF mid-line and one
    after a newline are all removed (pins step 2,
    `test_every_byte_order_mark_is_removed`).
  - *NFC*: `Cafe`+U+0301 → `Café`; a combining mark across the text is
    recomposed before the split (pins step 3, `test_nfc`,
    `test_nfc_keeps_chords_over_their_syllables`).
  - *Line splitting (LF)*: LF, CR LF and lone CR each end a line; a final line
    without a terminator is kept; a trailing terminator adds no line; `""` →
    `[]` (pins step 4, `test_bom_crlf_and_lone_cr`,
    `test_empty_document_is_the_empty_file`, `test_one_final_newline`).
  - *Tabs*: each tab → exactly one space, not a run to a tab stop (pins step 5,
    `test_tabs_become_one_space`).
  - *Whitespace (U+0020 only)*: trailing U+0020 stripped on every line; a
    no-break space (U+00A0) is neither stripped nor treated as a separator,
    leading or trailing (pins step 6 and §1.3 lines 49–54,
    `test_trailing_spaces_are_removed_everywhere`,
    `test_no_break_space_is_not_whitespace`).
  - *Marker lines*: the four markers (`<<<<<<<`, `=======`, `>>>>>>>`,
    `|||||||`), alone and `marker + space + anything`, are detected; a shorter
    or longer run, or one with no space before trailing text, is not; markers
    are found *after* the text layer (`markerLines("a\r\n=======  \r\n<<<<<<<\t\n")`
    === `[2, 3]`); numbering is 1-based (pins §11.12.3 lines 1037–1041,
    `test_markers_are_found_after_the_text_layer`).
  - *Corpus inputs pinned*: `prepare` on the real input bytes of
    `03-crlf-bom`, `26-text-layer` and `47-setlist-text-layer` yields the
    expected clean line lists — concretely pinning "the entries that exercise
    them" on the input side, which the whole-entry corpus checks cannot reach
    until the reader lands.
- **corpus (Vitest, the text-layer check in `js/test/corpus.test.js` via
  `js/test/corpus/harness.js`)** — for every reading entry (song + setlist) a
  new check `<entry>/tl`: the canonical text is a **fixed point** of the text
  layer — `prepare(canonical bytes)` rejoined (lines joined by LF, a trailing
  LF iff there is at least one line, the empty file → zero bytes) equals the
  canonical bytes, compared with `compareBytes`. This holds for all 47 reading
  entries (verified: §8 makes canonical form text-layer-clean — UTF-8, NFC,
  LF, no BOM, no tabs, no trailing spaces, one final newline) and is this
  task's corpus contribution, born passing. It pins §1.3 (line joining, no
  over-strip, NFC-idempotence, empty→empty, one final newline) and §8 line 27
  against the real corpus. The `<entry>/tl` ids are **not** added to
  `expected-failures.json` (so the harness asserts them to pass); `checkIds`
  gains them, so `staleLedgerIds` stays correct.

The `.tji` `Tests:` clause is sharpened to these files and cases; no level it
names is dropped. See §Decisions for why the whole-entry corpus checks (1–4,
6) of 03/26/47 are **not** flipped by this task.

**Deferred work.** None registered by this task. Flipping checks 1–4/6 for
03/26/47 (and every other entry) is the standing work of `cifra_js.reader`,
`cifra_js.writer` and `cifra_js.setlists`, which produce and serialise the
model those checks compare — not a follow-up this task creates. Using the
marker-line primitive to refuse a marked text is `cifra_js.writer`'s; to
report marker lines, `cifra_js.reader`'s; the `unresolved` conflict,
`cifra_js.merge`'s — all existing WBS leaves.

## Decisions

- **One module for the text layer and the marker-line primitive, ported from
  `text.py`.** `js/src/text.js` holds `decode`, `prepare`, `markerLines` and
  `NotUtf8Error`, re-exported from `index.js`. *Rationale:* the reference
  co-locates them (`text.py`) because marker detection is defined *on* the
  prepared lines (§11.12.3 *"after the text layer of §1.3"*) and every
  consumer that needs one needs the other; a single small, exhaustively
  tested module gives the reader, writer, merge and canonicality check one
  correct implementation to import. *Alternative rejected:* deferring
  `markerLines` to `cifra_js.writer`/`merge` — the `.tji` note scopes *"marker
  lines"* to this task, the reference places it here, and splitting it would
  duplicate the prepared-lines plumbing.

- **Invalid UTF-8 throws `NotUtf8Error`; it is not a model diagnostic.**
  `decode`/`prepare`/`markerLines` on invalid bytes raise, and do not return
  lines. *Rationale:* §1.1/§1.3 say such bytes *"are not a document: a reader
  MUST … read nothing"*; the reference raises `NotUTF8Error` and lets it
  propagate — the model is never built, and the callers that want graceful
  handling (the reader's report, merge's `unresolved`, the canonicality
  check's *"not canonical"*) catch it themselves. Putting a diagnostic in a
  model here would presuppose a model the text layer has no business building.
  *Alternative rejected:* returning `[]` and a diagnostic — it would hide an
  unreadable file behind an empty-but-valid read.

- **`prepare` accepts bytes or a string; only bytes are UTF-8-validated.**
  *Rationale:* the reference's `str | bytes` contract — bytes are a file's
  raw content (validate), a string is already-decoded text (trust) — lets the
  reader feed bytes while an editor or test feeds a string, without a second
  decode; the harness passes Node `Buffer`s. *Alternative rejected:* a
  bytes-only API — it would force callers that already hold a string to
  re-encode, and diverge from the reference.

- **The corpus footprint is a canonical fixed-point check, not a flip of
  checks 1–4/6.** This task cannot make `parse(input) == input.parsed.json`
  (checks 1/3) or `write(...) == canonical` (checks 2/4) or the
  canonicalisation check (6) pass for *any* entry, including 03/26/47: those
  require a reader and a writer this task does not build — a model cannot be
  produced or serialised from the text layer alone. (Confirmed on
  `26-text-layer`: `prepare(input)` and `prepare(canonical)` differ only by
  blank lines the *writer* inserts between the title and first section and
  before a fence — writer reflow, not the text layer — so even
  `prepare(input) == prepare(canonical)` is not a sound text-layer check in
  general.) So the task adds a *new* harness check, `<entry>/tl`, that the
  text layer alone satisfies: the canonical text round-trips through
  `prepare` unchanged, for every reading entry. *Rationale:* it is the
  strongest text-layer assertion computable from the committed corpus bytes
  without a reader; it keeps a real corpus footprint (format work's
  conformance level is the corpus) rather than dropping the level the note
  names; and running it over *every* reading entry (not only 03/26/47) guards
  that no canonical text is ever corrupted by the layer, matching the
  harness's "every entry enumerated" ethos. The input-side transforms of the
  three entries that exercise §1.3 are pinned at the unit level instead
  (`prepare` on their real input bytes), because the corpus stores no
  intermediate "prepared input" artifact and the input→model path needs the
  reader. *Alternatives rejected:* (a) claiming checks 1–4/6 for 03/26/47 as
  "flipped" — impossible without the reader/writer, and the closer would find
  them still failing; (b) `prepare(input) == prepare(canonical)` as the check
  — unsound (conflates writer reflow with the text layer, and fails on 26);
  (c) no corpus check at all — would drop the level the `.tji` note names with
  no honest substitute, when a genuine one exists.

- **The `<entry>/tl` checks are born passing, outside the ledger.** They are
  introduced and satisfied in the same task, so they never appear in
  `expected-failures.json`; the ledger continues to track only the
  not-yet-implemented reader/writer/merge checks that *shrink* toward
  `cifra_js.conformance`'s empty-ledger terminal state. *Rationale:* the
  harness already treats an unledgered check as expected-to-pass and runs it,
  so a born-passing check is first-class and a future regression in the text
  layer fails the gate; adding these ids to the ledger as momentary failures
  would be theatre, since nothing in this task leaves them failing.
  *Alternative rejected:* seeding them in the ledger and flipping them within
  the same commit — no information, and it muddies the ledger's meaning as the
  record of *outstanding* work.

- **No design delta.** §1.3 and §11.12.3 are already normative; the text-layer
  harness check is a test convention, not designed behaviour; no new runtime
  dependency is added (`TextDecoder`, `String.prototype.normalize`). *Rationale
  and alternative* mirror [`package.md`](./package.md): a format task that
  implements the spec as written needs no spec change, and the spec moves only
  when behaviour does.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-04.

- cifra.md `7c2106c`: `js/src/text.js` — new module: §1.3 text layer (`decode`, `prepare`) and §11.12.3 marker-line primitive (`isMarkerLine`, `markerLines`), `NotUtf8Error`; ported from `reference/cifra_md/text.py`, zero runtime dependencies.
- cifra.md `7c2106c`: `js/src/index.js` — re-exports `decode`, `prepare`, `markerLines`, `isMarkerLine`, `NotUtf8Error`; seven corpus-facing stubs unchanged.
- cifra.md `7c2106c`: `js/test/text.test.js` — 35 unit tests covering each §1.3 rule (UTF-8, U+FEFF, NFC, line-splitting, tabs, trailing-space/NBSP), marker-line detection, and `prepare` pinned on corpus inputs 03/26/47.
- cifra.md `7c2106c`: `js/test/corpus/harness.js` — added `<entry>/tl` fixed-point text-layer check to `readingChecks`; all 47 reading entries born passing, none added to the expected-failures ledger.
- cifra.md `7c2106c`: `js/test/harness.test.js` — synthetic impl gains real `prepare`; planted non-fixed-point `tl` test confirms the check catches regressions.
