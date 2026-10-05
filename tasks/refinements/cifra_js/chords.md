# cifra_js.chords — Chord symbols and dialects

## TaskJuggler entry

`task chords` in [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) (lines
22–27), under `task cifra_js`, `depends !text_layer`. The area file's header
states the stream's rule: *"The app's implementation of the format, held to
the corpus byte for byte. Framework-free: the view is the only layer that
knows React"* ([`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 1–4).

The `.tji` note: *"cifra.md: §5 grammar, the canonical chord model, the three
dialects and their ambiguities. Explore Chords' core/notation is the guide.
Tests: unit (the §5 grammar in each dialect, its ambiguities, the canonical
chord model; Explore Chords' notation cases as a guide); corpus (the
chord-symbol entries)."*

## Effort estimate

**2 days** (from the `.tji`).

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, extended by this
task:

- `js/src/` — two new modules: `pitch.js` (note names, accidentals and the
  §5.5 tone spelling) and `chord.js` (the §5 permissive grammar, the canonical
  chord model, the three dialects and their four ambiguities, and chord-tone
  resolution); re-exported from `js/src/index.js`. No new runtime dependency
  (the parser uses only regular expressions and plain objects).
- `js/test/` — the chord unit suite (`chord.js`'s Vitest tests) and a
  chord-symbol check added to the corpus harness.

The corpus beside `js/` is unchanged: this task is a **consumer** of the
already-committed corpus bytes (the Python reference generates and checks the
corpus; this task touches nothing under `reference/` or `corpus/`).

No design delta is authored. §5 (the grammar, the model and the three
dialects), §5.5 (spelled tones) and §1.4.3 (the `notation` property) are
already normative in the specification; the chord-symbol harness check is a
test-harness convention like the expected-failure ledger the `package` task
introduced and the `<entry>/tl` check `text_layer` added, not a new
architectural seam or a change to designed behaviour (§Decisions). The one
spec inconsistency this task surfaces — §9.1's Chart-reader clause counting
*"three"* ambiguous spellings where §5.6 and the Chord-reader clause count
four — is a prose mismatch the reference and corpus already resolve in favour
of four; implementing §5 as written is no format change, so it is surfaced for
format-area review rather than edited from this implementation task
(§Decisions, §Open questions).

## Inherited dependencies

- **`cifra_js.text_layer` — settled.** Complete (cifra.md `7c2106c`,
  [`cifra_js/text_layer.md`](./text_layer.md) Status): `js/src/text.js`
  delivers `decode`/`prepare`/`markerLines`/`isMarkerLine`/`NotUtf8Error`,
  re-exported from `js/src/index.js`, and the corpus harness runs a
  born-passing `<entry>/tl` text-layer check over every reading entry. The
  chord parser does **not** itself call the text layer — a chord symbol is a
  single already-prepared token (§5.1 line 21: *"A symbol has no
  whitespace"*); the text layer is applied by the reader, which splits lines
  and hands the parser each chord token. `text_layer` is the dependency
  because it is the task before `chords` on the single `cifra_js` chain, and
  it established the harness conventions this task extends (checks are
  `{ id, run }`; `discover`/`readingChecks`/`dump`/`compareBytes`/
  `staleLedgerIds`; the "compare bytes, never deep-equal" rule; born-passing
  checks live outside `expected-failures.json`).
- **`cifra_js.package` — settled** (transitively, through `text_layer`):
  cifra.md `552cf37`, [`cifra_js/package.md`](./package.md) — `js/` as a
  framework-free, zero-runtime-dependency ES-module package with its Vitest
  corpus harness and the expected-failure ledger. `js/src/index.js` exports
  seven corpus-facing stubs (`parse`, `write`, `canonical`, `parseSetlist`,
  `writeSetlist`, `canonicalSetlist`, `merge`) that throw `NotImplementedError`
  and whose header comment names `chords` as one of the later tasks that fill
  in the real surface.
- **`format.canonical_form` — settled** (transitively, through `package`):
  the specification (including §5), the Python reference and the four-file
  corpus this task is held to.

Downstream: `cifra_js.reader` (`depends !chords`) is the direct consumer — it
calls the chord parser on every chart token, wraps the result in a chart item
(adding `index`/`key`), and turns a non-chord into an unknown token (§2.9).
The whole chain onward to `cifra_js.conformance`, and the app's Worker once
those streams exist (DIRECTION §3.7), build on it.

## What this task is

This task implements the **chord layer** — the parser and model for a single
chord symbol, the second format primitive after the text layer. A chord symbol
(`C7M`, `Cm7(b5)`, `B°`, `C6/9/E`) is read by **one permissive grammar** into
**one dialect-free canonical model**; the three **notation dialects**
(`brazilian`, `american`, `realbook`) matter only at four spellings that
collide, where a dialect picks a default reading and the parser reports which
it took so an application can offer the other
([`spec/5-chord-symbols.md`](/home/ruoso/devel/cifra.md/spec/5-chord-symbols.md)
lines 5–13). It is a port of the reference's
`reference/cifra_md/chord.py` and `reference/cifra_md/pitch.py`, matched to the
reference and the corpus, not shared with them.

Concretely it adds two modules, re-exported from `js/src/index.js`:

- `js/src/pitch.js` — note names and spelling: a root/note is a letter `A`–`G`
  (uppercase) plus an optional accidental (`#`/`♯`, `b`/`♭`, `##`, `bb`),
  modelled as `{ letter, accidental }` (accidental in semitones, −2..+2).
  Exports `parseNote`, `formatNote`, `isNote` and the constants the chord
  module and tone spelling need (`LETTERS`, the major-scale table), ported from
  `pitch.py`.
- `js/src/chord.js` — the grammar, the canonical model, the dialects and the
  tone resolution. Exports:
  - `parseChord(text, dialect = DEFAULT_DIALECT) → { chord, ambiguities, errors }`
    — the permissive parser. It **never throws**: a symbol that does not fit
    the grammar returns `chord: null` with a non-empty `errors` (§5.4). On a
    valid symbol `chord` is `{ root, quality, extensions, bass }` and
    `ambiguities` is a (possibly empty) list of `{ kind, chosen, alternative }`
    for each of the four spellings the dialect disambiguated (§5.6).
  - `isChord(text, dialect) → boolean` — a convenience over `parseChord`.
  - `chordTones(chord) → string[]` — the §5.5 spelled tones, from the root's
    letter, never from pitch class.
  - `DIALECTS` and `DEFAULT_DIALECT` (`"brazilian"`) — the dialect reading
    tables, so the reader can map a document's `notation` property to a dialect
    id.

The canonical model is **dialect-free**: `C7M`, `Cmaj7`, `CM7` and `C∆7` all
denote `{ root C, major, extensions {(7, 0)}, bass none }` (§5.2 lines 77–79).
The dialect is consulted only at the four ambiguities.

The seven corpus-facing stubs in `index.js` stay stubs: this task builds no
reader or writer, so it produces no whole-song model and cannot flip the
whole-entry corpus checks (1–4, 6) of any entry — those belong to
`cifra_js.reader`/`cifra_js.writer`/`cifra_js.setlists` (§Decisions,
§Acceptance criteria). What it adds to the harness is a **chord-symbol check**
the chord layer alone can satisfy against the real corpus bytes: re-derive each
stored chord item's model from its written symbol.

## Why it needs to be done

The chord model is the heart of the format: every chart is a line of chord
symbols, and §5 is *"Used by §2 (to recognise a chord token) and §7 (keys)"*
([`spec/5-chord-symbols.md`](/home/ruoso/devel/cifra.md/spec/5-chord-symbols.md)
lines 10–11). The **Chord reader** profile — *"A chart reader that also builds
the canonical chord model (§5.2) for every valid symbol, applying the
document's dialect to the four ambiguities and reporting that it did. Must
meet: §5 in full"*
([`spec/9-conformance.md`](/home/ruoso/devel/cifra.md/spec/9-conformance.md)
lines 35–40) — is exactly this module. `cifra_js.reader` (`depends !chords`)
cannot classify a chart token without it: the reference's reader calls
`parse_chord` for every candidate and turns a `chord: null` result into an
unknown token (§2.9), so the chord parser is the reader's decision procedure
for *"is this a chord, and if so what does it mean?"*. `cifra_js.editing`
(§8.5 — *"choose a shape for an occurrence or a key"*) and the app's
transposition build on the same model. Putting the grammar, the model, the
dialects and the tone spelling in two small, exhaustively unit-tested modules
— as the reference splits them across `chord.py` and `pitch.py` — gives all of
those one correct implementation to call.

Downstream consumers: `cifra_js.reader` and the whole chain onward to
`cifra_js.conformance`; `cifra_js.editing` (model→symbol, via the §5.7
formatter it will add); and, once the app streams exist, the Worker's reader
and the arrange-mode/wizard chord editing (DIRECTION §3.7).

## Inputs / context

- [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 1–4 (stream header),
  22–27 (`task chords`, its `depends !text_layer`, the `note` and its `Tests:`
  clause: unit + corpus).
- [`cifra_js/text_layer.md`](./text_layer.md) and
  [`cifra_js/package.md`](./package.md) — the predecessors: the harness shape
  (`readingChecks(entry, impl)` returning `{ id, run }`; `discover`/`dump`/
  `compareBytes`/`staleLedgerIds`), the born-passing-check pattern
  (`<entry>/tl` is added to the harness and lives outside the ledger), the
  expected-failure ledger convention (listed → must fail, unlisted → must
  pass; a stale id fails the harness), the zero-runtime-dependency rule, the
  *"compare bytes, never deep-equal"* rule, and §Decisions "Corpus-facing
  operations are stubs now."
- **Specification (normative) —
  [`spec/5-chord-symbols.md`](/home/ruoso/devel/cifra.md/spec/5-chord-symbols.md):**
  - §5 header lines 5–13 — one permissive grammar, one canonical model, three
    dialects; *"A reader MUST keep a symbol as written. The model is what a
    symbol means, not what a writer rewrites it to."*
  - §5.1 lines 15–46 — the shape of a symbol: `symbol = root body [ "/" bass ]`
    (line 17); *"A symbol has no whitespace. Case is significant everywhere and
    MUST NOT be normalised: `CM7` is a major seventh, `Cm7` a minor seventh"*
    (lines 21–22); §5.1.1 root lines 24–32 (letter `A`–`G` uppercase, one
    accidental `#`/`♯`/`b`/`♭`/`##`/`bb`); §5.1.2 bass lines 34–41 (trailing
    `/note` is a slash bass, `/` before a digit is body `C6/9`, both allowed
    `C6/9/E`, `/` with nothing is an error); §5.1.3 body lines 43–46.
  - §5.2 the canonical model lines 48–96 — the four fields `root` (letter +
    accidental, spelled: `Db` and `C#` are different roots, lines 52–54),
    `quality` (`major|minor|dim|aug|sus2|sus4|power`), `extensions` (a set of
    `(degree, alter)`, degree in `{2,4,6,7,9,11,13}`, alter −2..+2, at most one
    per degree), `bass` (a note or none); the quality base-tone table lines
    63–71; equality by spelling lines 81–84; §5.2.1 normalisation into the
    quality lines 86–96 (minor + ♭5 → dim; major + ♯5 → aug, the altered fifth
    folded into the quality and dropped from extensions; redundant ♭5-on-dim /
    ♯5-on-aug dropped).
  - §5.3 elements of the body lines 98–218 — separators are meaningless
    (whitespace, commas, round brackets: `C7(9)` = `C7 9` = `C7,9`, lines
    105–110); §5.3.1 quality words lines 113–129 (incl. the positional rule:
    `-`/`+` are quality only in first position, an alteration after a degree;
    `°` after a degree lowers it); §5.3.2 major-seventh words lines 131–142;
    §5.3.3 the top degree lines 144–162 (6/7/9/11/13 and its implied stack; the
    seventh is major with a maj-word, diminished when the quality is dim,
    minor otherwise); §5.3.4 degree modifiers lines 164–189 (incl. accidental
    placement: `#`/`b` precede the degree, `+`/`-`/`°` follow it unless a degree
    follows — `C7+9` raised ninth vs `C7(5+)` raised fifth); §5.3.5 the
    symbol→tones examples table lines 190–218.
  - §5.4 errors lines 220–227 — *"A symbol that does not fit the grammar is not
    a chord. A reader MUST report the failure rather than guess, and MUST NOT
    throw away the text"*; the non-chord examples (empty, `H7`, `7`, `C##bb7`,
    `Cmaj/`, `xyz`).
  - §5.5 spelled tones lines 229–235 — *"A reader that resolves a chord to
    tones MUST spell them from the root, not from pitch class: `#11` on C is
    F♯, `b5` on C is G♭, and the seventh of `C°7` is B♭♭ … This is what keeps
    `Db7` from coming out as `C# F G#`."*
  - §5.6 notation dialects and the four ambiguities lines 237–288 — the three
    dialects (default `brazilian`); the table of the four spellings lines
    243–248 (`C7+` sevenPlus, bare `C9` bareNine, bare `B°` degreeSign,
    `C7(4)` on a major triad bareFour) and the per-ambiguity prose lines
    250–265; *"A reader MUST apply the document's dialect to these four
    spellings and MUST report that it did … MUST NOT apply the dialect to
    anything else"* (lines 269–274); the spellings that only look ambiguous
    (`5+`, `9+`, `C7(9)`, `Cmaj9`, `Cadd9`, `C4`) lines 286–288.
  - §5.7 preferred spellings lines 290–313 — the model→symbol formatter;
    *"Canonicalising never does this; it copies every symbol as written"*
    (used by this task only as a non-goal, §Decisions).
- [`spec/1-document.md`](/home/ruoso/devel/cifra.md/spec/1-document.md) §1.4.3
  lines 128–152 — the `notation` property: values `brazilian`/`american`/
  `realbook`, default `brazilian`, compared case-insensitively (line 141); any
  other value falls back to `brazilian` and is reported (lines 142–144); only
  the four ambiguous spellings are affected. Mapping the property to a dialect
  id is the reader's (§Decisions).
- [`spec/9-conformance.md`](/home/ruoso/devel/cifra.md/spec/9-conformance.md)
  — the Chart-reader profile lines 9–32 (deciding validity and reporting the
  ambiguity met; *note the clause at line 17 says "three" where §5.6 says
  four — §Open questions*); the **Chord-reader** profile lines 35–40 (this
  module: *"§5 in full"*, four ambiguities); §9.2 universal rules lines
  109–125 (a reader MUST NOT fail on a token it does not understand — report
  and continue — and MUST report whatever it does not keep).
- **Reference, the behaviour to match** (port, never import —
  `/home/ruoso/devel/cifra.md/reference/`):
  - `reference/cifra_md/pitch.py` — `LETTERS = "CDEFGAB"`, `NATURAL_PC`,
    `MAJOR_SCALE`, `NOTE_RE` (lines 7–15); `parse_note` (18–23), `is_note`
    (26–27), `format_note` (30–32).
  - `reference/cifra_md/chord.py` — `DIALECTS` and `DEFAULT_DIALECT`
    (lines 9–21) with the four reading keys `sevenPlus`/`bareNine`/
    `degreeSign`/`bareFour` and `_ALTERNATIVES` for the other reading; the
    token table `_TOKENS` (26–47, longest/most-specific first); `_tokenize`
    (53–66), `_balanced` (69–78), `_split_bass` (81–88), `_seventh_alter`
    (91–96), `_stack` (99–100); `parse_chord(text, dialect) ->
    { "chord", "ambiguities", "errors" }` (103–354) — the left-to-right
    interpreter, the four ambiguity sites, the §5.2.1 normalisation (330–339),
    extension-degree validation (344–346), the model built in field order
    `root, quality, extensions, bass` with `extensions` sorted by degree
    (348–354); `is_chord` (357–358); `chord_tones` (361–386, §5.5).
  - `schema/cifra.schema.json` lines 324–356 — the `Chord`, `Note` and
    `Ambiguity` shapes the model serialises to (quality enum; `degree` enum
    `[2,4,5,6,7,9,11,13]`; `alter` −2..+2; `kind` enum
    `["sevenPlus","bareNine","degreeSign","bareFour"]`,
    required `kind, chosen, alternative`).
  - `reference/tests/test_chords.py` — the unit cases to port: the tones table
    (lines 14–87), slash/compound bass (90–108), case significance (111), the
    §5.2.1 normalisation cases (135–145), `TestAmbiguities` including the
    `bareFour` case (187–198), and the error table (211–215).
- **Explore Chords — the guide, diverged in its data shapes**
  (`/home/ruoso/devel/explore-chords/src/core/`): `notation/parse.js` (the
  permissive parser, the direct ancestor of `chord.py`), `chord.js` (the model
  + tone resolution), `notation/dialects.js`, and `notation/notation.test.js`
  (the worked notation cases: same-chord-across-dialects, case, slash,
  per-ambiguity suites, an extensions/tones table, errors-returned-not-thrown,
  a round-trip matrix). It is a guide for the *algorithm*, not the data
  shapes: it predates the `bareFour` ambiguity (handles only three), records
  ambiguities as `{ kind, text, chosen, alternatives: [] }` (plural) and errors
  as `{ message, code, params }`, where the corpus pins
  `{ kind, chosen, alternative }` (singular) and the reference's error form.
  Match the reference and the corpus (§Decisions).
- **Corpus (the chord-symbol entries) —
  `/home/ruoso/devel/cifra.md/corpus/`:**
  - `12-ambiguities/` — the four ambiguities under `- notation: american`:
    `C7+` → `aug` + `{(7,-1)}` with `{sevenPlus, dominantSharpFive,
    majorSeventh}`; bare `C9` → `major` + `{(7,-1),(9,0)}` with `{bareNine,
    dominant, add}`; bare `B°` → `dim` + `{(7,-2)}` with `{degreeSign,
    diminishedSeventh, diminishedTriad}`; `C7(4)` on a major triad → `major` +
    `{(4,0),(7,-1)}` with `{bareFour, added, suspended}`; and `C7(9)`, `Bdim`,
    `C7M`, `C7sus4` carrying **no** `ambiguities` (parsed.json pins each item's
    `chord` and `ambiguities`).
  - `17-chord-spellings/` — the broad spelling table under `- notation:
    realbook`: ~27 symbols covering major-seventh words, half-diminished
    (`Cø7`, `Cm7(5-)`, `Em7(b5)` → `dim` + `{(7,-1)}`), augmented (`C+`,
    `C7#5`, `C7(5+)` → `aug`), extensions and stacks (`C13`), `Calt`, slash and
    compound bass (`C6/9/E`, `Am7/G`), accidental roots (`C♯m7`, `D♭7`).
  - [`corpus/README.md`](/home/ruoso/devel/cifra.md/corpus/README.md) lines
    37–58 — the six checks; line 70 ff. the per-entry one-line descriptions
    ("12 ambiguities", "17 chord spellings"). Chord-adjacent, out of scope
    here: `10-unknown-tokens/` (§5.4/§2.9, the reader turns a non-chord into an
    unknown token) and `18-no-chord/` (the `N.C.` mark) — both reader concerns.
- **Harness (what this task extends) —
  `/home/ruoso/devel/cifra.md/js/`:**
  - `js/test/corpus/harness.js` — `readingChecks(entry, impl)` returns the
    per-entry `{ id, run }` list; `dump(model) = JSON.stringify(model, null, 2)
    + "\n"`; `compareBytes`; `discover`; `staleLedgerIds`; `<entry>/tl` was
    added here by `text_layer`. The chord-symbol check is added here.
  - `js/test/corpus.test.js` — builds `checkIds` from every check, guards the
    ledger against stale ids, runs one test per check and asserts it against
    the ledger (a new id not in the ledger is asserted to pass).
  - `js/src/index.js` — the seven stubs and `NotImplementedError`; the chord
    exports are re-exported from here so the harness and future tasks import
    them from one place.

## Constraints / requirements

- **One permissive grammar, one dialect-free model.** The parser reads every
  spelling; the model carries no dialect (§5.2 lines 77–79). The dialect is
  consulted **only** at the four ambiguous spellings of §5.6 and nowhere else
  (§5.6 lines 269–274). The model has exactly four fields —
  `{ root, quality, extensions, bass }` — in that key order, with `extensions`
  a list of `{ degree, alter }` **sorted by degree ascending**, at most one
  entry per degree. `root` and `bass` are `{ letter, accidental }` (`bass` is
  `null` when absent). This key/order discipline is part of conformance: the
  corpus check serialises the produced model with `dump` and compares it to the
  stored JSON **byte for byte** (the package rule: compare bytes, never
  deep-equal).
- **Case and spelling are significant and preserved.** `CM7` ≠ `Cm7`; case is
  never normalised (§5.1 lines 21–22). Roots compare by spelling: `Db` and
  `C#` are different chords that sound alike (§5.2 lines 81–84). The letter is
  uppercase `A`–`G`; a lowercase letter (`bb`, `am`, `e7`) is not a chord
  (§5.1.1 line 30). At most one accidental; `C##bb7` is an error (§5.4). Both
  the ASCII and the Unicode accidentals are accepted (`#`/`♯`, `b`/`♭`).
- **The §5.2.1 normalisations into the quality.** minor + ♭5 → `dim`
  (`Cm7b5` = `{dim, {(7,-1)}}`, the half-diminished seventh); major + ♯5 →
  `aug` (`C7#5` = `{aug, {(7,-1)}}`), the altered fifth folded into the quality
  and dropped from the extensions; a redundant ♭5 on a dim chord or ♯5 on an
  aug chord is dropped (§5.2.1 lines 86–96).
- **The four ambiguities, each reported.** `sevenPlus` (`C7+`), `bareNine`
  (bare `C9`), `degreeSign` (bare `B°`), `bareFour` (`C7(4)` on a major triad).
  Each resolved reading appends `{ kind, chosen, alternative }` (singular
  `alternative`, the reading not chosen). `bareFour`'s suspended reading
  applies only when the triad is major (`Cm7(4)` is an added fourth in every
  dialect and reports nothing, §5.6 lines 261–265). The spellings that only
  look ambiguous report nothing (§5.6 lines 286–288). A reader MUST report the
  dialect it applied so an application can offer the other reading.
- **A non-chord is reported, never thrown.** `parseChord` returns
  `{ chord: null, ambiguities: [], errors: [...] }` for a symbol that does not
  fit the grammar (§5.4); it never throws. The reader turns that into an
  unknown token (§2.9); the chord module does not build chart items or decide
  `index`/`key` — that is the reader's.
- **Spelled tones from the root.** `chordTones` spells each degree from the
  root's letter, not from pitch class: degree *d* altered by *a* is the letter
  *d−1* steps above the root's letter with the accidental that makes it *a*
  semitones from the major-scale degree (§5.5). `Db7` → `Db F Ab Cb`, not
  `C# F G#`; the seventh of `C°7` is `Bbb`.
- **Dialect is an input, not resolved here.** `parseChord` takes a dialect id
  (`brazilian`/`american`/`realbook`, default `brazilian`). Resolving a
  document's `notation` property to a dialect id — case-insensitive, an unknown
  value falling back to `brazilian` with a `bad-notation` diagnostic (§1.4.3) —
  is the reader's, matching the reference's split (`parse.py` resolves the
  property, `chord.py` takes the id). The chord module exposes `DIALECTS` and
  `DEFAULT_DIALECT` so the reader can do the mapping.
- **Framework-free, zero runtime dependencies** (DIRECTION §3.7; stream
  header; [`package.md`](./package.md) §Constraints). `js/src/pitch.js` and
  `js/src/chord.js` import nothing from Node and add no `dependencies` entry —
  only regular expressions and plain objects. They know nothing of React,
  storage or the network; they are pure functions of their input. Node
  built-ins may appear only under `js/test/`, never in `js/src/`.
- **Agreement is by the corpus, not shared code** (DIRECTION §3.6). The
  modules are a **port** of `chord.py`/`pitch.py` — they import, transpile or
  shell out to no Python or Go. The chord-symbol harness check reads only
  corpus bytes and calls the implementation under test.
- **Standing rules scoped where they apply:** *Canonical form over preserving
  content* — the parser keeps the symbol text as written (the reader stores it)
  and the model is what it means; this task adds no model→symbol rewriting
  (§5.7 is a non-goal, §Decisions). *Test fixtures are purpose-written* — the
  unit tests use tiny invented symbols and the purpose-written corpus entries
  12/17, never anyone's copyrighted words. *No song text in logs*, *offline
  first*, *accessibility* and *no book without an account* do not apply: this
  is a pure format module with no UI, network, storage or logging (noted so the
  omission is deliberate, per the brief).

## Acceptance criteria

**Behaviour delivered.** `js/src/pitch.js` and `js/src/chord.js` implement §5
(the grammar, the canonical model, the three dialects and their four
ambiguities), §5.5 (spelled tones) and the §5.2.1 normalisations, matching the
reference byte for byte on the corpus models; `parseChord`, `isChord`,
`chordTones`, `DIALECTS` and `DEFAULT_DIALECT` (and the `pitch.js` note
helpers) are re-exported from `js/src/index.js`. The corpus harness gains a
chord-symbol check that re-derives every stored chord item's model from its
written symbol and passes. `scripts/gate cifra.md` runs it all via `npm test`
in `js/` (gate lines 378–382), alongside the reference's unchanged `pytest`.
The seven corpus-facing stubs stay stubs.

**Tests the task lands with, by level** (the `.tji` `Tests:` clause names
unit + corpus; format work's conformance level **is** the corpus — there are
no behavior, e2e-api or e2e-web levels):

- **unit (Vitest, `js/test/chord.test.js`)** — the §5 grammar in each dialect,
  its ambiguities, the canonical model and the spelled tones, ported from the
  reference's `test_chords.py` with Explore Chords' `notation.test.js` as a
  guide, on purpose-written symbols:
  - *Root and accidentals*: `A`–`G` uppercase required; `#`/`♯`, `b`/`♭`,
    `##`, `bb` each parse to the right accidental; a lowercase letter
    (`bb`, `am`, `e7`) is not a chord; `Db` and `C#` are different roots
    (pins §5.1.1, §5.2 equality; `pitch.py`).
  - *Body grammar*: separators are meaningless (`C7(9)` = `C7 9` = `C7,9`;
    `Cm7(b5)` = `Cm7b5`); quality words (`m`/`min`/`-`/`−`/`–`, `dim`/`°`/`º`,
    `aug`/`+`, `sus2`, `sus4`/`sus`, leading `4` = sus4, `5` = power, `ø`/`Ø` =
    half-diminished seventh); major-seventh words (`maj`/`M`/`∆`/`Δ`); the top
    degree 6/7/9/11/13 and its implied stack; degree modifiers (`#d`/`bd`/`d+`/
    `d-`/`d°`/`add d`/`6/9`/`alt`); positional `+`/`-`/`°` (first position =
    quality, after a degree = alteration) and accidental placement (`C7+9`
    raised ninth vs `C7(5+)` raised fifth) (pins §5.1, §5.3.1–§5.3.4).
  - *Canonical model and normalisation*: `C7M`/`Cmaj7`/`CM7`/`C∆7` all →
    `{major, {(7,0)}}`; `Cm7b5` → `{dim, {(7,-1)}}`; `C7#5` → `{aug, {(7,-1)}}`;
    redundant ♭5-on-dim / ♯5-on-aug dropped; the field order and
    degree-sorted extensions serialise as the reference does (pins §5.2,
    §5.2.1; `test_chords.py` 135–145).
  - *The four ambiguities, in each dialect*: `C7+` (brazilian `majorSeventh`
    vs american/realbook `dominantSharpFive`); bare `C9` (brazilian `add` vs
    american/realbook `dominant`); bare `B°` (`diminishedSeventh` in all three,
    alternative `diminishedTriad`); `C7(4)` on a major triad (brazilian
    `suspended` vs american/realbook `added`; `Cm7(4)` reports nothing); each
    emits `{ kind, chosen, alternative }`; the unambiguous forms (`C7(9)`,
    `Bdim`, `C7M`, `C7sus4`, spelled `add4`/`sus4`, `5+`, `9+`) emit no
    ambiguity (pins §5.6; `TestAmbiguities` incl. `bareFour` 187–198).
  - *Slash and compound bass*: trailing `/note` → bass; `/digit` stays in the
    body (`C6/9`); both (`C6/9/E`); `Am7/G`; `/` with nothing is an error
    (pins §5.1.2).
  - *Spelled tones (`chordTones`, §5.5)*: the §5.3.5 examples; `Db7` →
    `Db F Ab Cb` (not `C# F G#`); the seventh of `C°7` is `Bbb`; `#11` on C is
    `F♯` (pins §5.5; `test_chords.py` tones 14–87).
  - *Errors returned, never thrown*: the empty string, `H7`, `7`, `C##bb7`,
    `Cmaj/`, `xyz` → `{ chord: null, errors: [...] }`, no exception (pins §5.4;
    `test_chords.py` 211–215).
  - *Dialect surface*: `DEFAULT_DIALECT === "brazilian"`; `DIALECTS` carries the
    three dialects' four reading keys (pins §5.6, §1.4.3; the property→dialect
    mapping itself is the reader's).
- **corpus (Vitest, the `<entry>/chords` check in `js/test/corpus.test.js` via
  `js/test/corpus/harness.js`)** — for every reading entry whose stored model
  holds chord items, a new check `<entry>/chords`: read the `notation` property
  from the stored model (default `brazilian`, mapped as §1.4.3) and, for each
  `type: "chord"` item, re-parse its written `symbol` under that dialect; the
  `chord` and (when present) `ambiguities` that `parseChord` produces,
  serialised with `dump`, equal the stored item's `chord` and `ambiguities`,
  compared with `compareBytes`. Born passing for the chord-symbol entries
  `12-ambiguities` and `17-chord-spellings` — the dense cases the note names —
  and for every other song entry that carries chords (the §5 parser must handle
  every chord in the corpus). The `<entry>/chords` ids are **not** added to
  `expected-failures.json` (so the harness asserts them to pass); `checkIds`
  gains them, so `staleLedgerIds` stays correct. It pins §5 (the grammar, the
  model, the dialects and the four ambiguities) against the committed corpus
  models. The harness's own `js/test/harness.test.js` gains a planted
  wrong-parse `chords` case proving the check catches a regression (as the
  package's planted-mismatch and text_layer's planted non-fixed-point cases
  do).

The `.tji` `Tests:` clause is sharpened to these files and cases; no level it
names is dropped. See §Decisions for why the whole-entry corpus checks (1–4,
6) of 12/17 are **not** flipped by this task.

**Deferred work.** None registered by this task. Flipping checks 1–4/6 for
12/17 (and every entry) is the standing work of `cifra_js.reader`,
`cifra_js.writer` and `cifra_js.setlists`, which build the whole-song model
(wrapping each chord in a chart item with `index`/`key`) and serialise it —
not a follow-up this task creates. The §5.7 model→symbol formatter (preferred
spellings) is **not** in scope and no corpus check needs it (canonicalisation
copies every symbol as written, §5.6/§5.7, §8); the task that first emits a
symbol from the model — transposition and respelling inside `cifra_js.editing`
(§8.5) — owns it, an existing WBS leaf. Unknown-token handling at the chart
level (§2.9, corpus `10-unknown-tokens`) and the `bad-notation` diagnostic on
an unknown `notation` value (§1.4.3) are `cifra_js.reader`'s. None is a new
leaf.

## Decisions

- **Two modules, `pitch.js` and `chord.js`, ported from the reference.**
  `pitch.js` holds note names, accidentals and the §5.5 tone spelling;
  `chord.js` holds the grammar, the model, the dialects and the parser, and
  imports the note helpers. *Rationale:* the reference splits them the same way
  (`chord.py` imports `NOTE_RE`/`parse_note` from `pitch.py`, and
  `chord_tones` imports the scale tables) because note spelling is reused by
  tone resolution and is worth testing in isolation; two small modules keep
  each exhaustively testable. *Alternative rejected:* one `chord.js` — diverges
  from the reference layout and buries the note-spelling cases.

- **Plain-object dict model with pinned key order, not classes.** The model is
  `{ root, quality, extensions, bass }` built as a plain object in that order,
  `extensions` sorted by degree; `root`/`bass` are `{ letter, accidental }`;
  ambiguities are `{ kind, chosen, alternative }`. *Rationale:* the corpus
  check serialises the produced model with `dump` (`JSON.stringify(…, 2) +
  "\n"`) and compares it to the stored `parsed.json` byte for byte, so key
  insertion order and extension order are part of conformance (the package
  rule); the reference uses dicts in exactly this order. *Alternative
  rejected:* classes/factories compared by deep-equal — breaks the
  "compare bytes, never deep-equal" rule and risks serialisation drift from the
  reference.

- **Implement all four ambiguities; match the reference and corpus data
  shapes, not Explore Chords.** The parser handles `sevenPlus`, `bareNine`,
  `degreeSign` **and** `bareFour`, recording each as `{ kind, chosen,
  alternative }` (singular), and reports non-chords as `{ chord: null,
  errors }`. *Rationale:* §5.6 and the Chord-reader profile define four
  ambiguities, and corpus `12-ambiguities` pins `bareFour` and the singular
  record shape; Explore Chords — the named *guide* — predates `bareFour`
  (three ambiguities), records `{ kind, text, chosen, alternatives: [] }`
  (plural) and errors as `{ message, code, params }`. The guide guides the
  tokeniser and the left-to-right interpreter; the data shapes are pinned by
  the corpus. *Alternative rejected:* following Explore Chords' shapes — would
  miss `bareFour` (failing entry 12) and fail the corpus byte comparison on the
  ambiguity records.

- **Four ambiguities is authoritative; the §9.1 "three" is a prose mismatch,
  surfaced not edited.** §5.6 (*"the four ambiguities"*), the Chord-reader
  profile (§9.1 lines 35–40, *"the four ambiguities"*), the reference
  (`DIALECTS` with four keys) and the corpus (`12-ambiguities` includes
  `bareFour`) all agree on four; only the Chart-reader clause
  ([`spec/9-conformance.md`](/home/ruoso/devel/cifra.md/spec/9-conformance.md)
  line 17) says *"three ambiguous spellings"*. *Rationale:* implementing §5 as
  written (four) is no change to the format, so it needs no spec delta from
  this implementation task; the stale count in §9.1's Chart-reader prose is a
  format-spec cleanup, not implementable as code by this task, so it is raised
  for format-area review rather than edited from a JS task or encoded as a
  WBS/audit leaf (the brief forbids audit tasks). *Alternative rejected:*
  implementing three (contradicts the normative model and entry 12) or editing
  the conformance chapter from this task (reaches into format-spec prose from
  an implementation task when no behaviour changes; properly a format-area
  decision — §Open questions).

- **`parseChord` takes a dialect id; property resolution is the reader's.** The
  module is a pure function of `(symbol, dialect)`; it does not read a
  document, a `notation` property or emit a `bad-notation` diagnostic.
  *Rationale:* the reference splits exactly here (`parse.py` lowercases the
  property, falls back and diagnoses; `chord.py` takes a valid id); a diagnostic
  about an unknown `notation` value belongs to the document read, not to one
  chord; the reader has the document, the chord module has only a token. The
  corpus `<entry>/chords` check mirrors the §1.4.3 mapping minimally (lowercase;
  one of the three else `brazilian`) to feed the parser. *Alternative
  rejected:* `parseChord` resolving `notation` itself — it has no document to
  resolve it from.

- **`parseChord` never throws.** A non-chord returns `{ chord: null, errors }`.
  *Rationale:* §5.4 and §9.2 — a reader MUST report a failure and MUST NOT
  throw away the text; the chart turns a non-chord into an unknown token
  (§2.9); the reference returns rather than raises, so the reader need not wrap
  every call in try/catch. *Alternative rejected:* throwing on an invalid
  symbol — diverges from the reference and §5.4, and burdens the reader's
  per-token loop.

- **No model→symbol formatter (§5.7) in this task.** `chord.js` reads symbols
  into the model; it does not write a symbol from the model. *Rationale:* the
  corpus round-trip and canonicalisation never serialise a chord from the model
  — they copy every symbol as written (§5.6/§5.7, §8), and the reference has no
  chord writer in that path — so no corpus check needs a formatter; the §5.7
  preferred-spelling formatter is first needed where a new symbol is produced
  from the model (transposition/respelling in `cifra_js.editing`, §8.5), which
  owns it. *Alternative rejected:* building the formatter here for
  completeness — untested by any corpus check this task lands, and speculative
  ahead of its first caller.

- **The corpus footprint is a born-passing `<entry>/chords` check, not a flip
  of checks 1–4/6.** This task cannot make `parse(input) == input.parsed.json`
  (1/3), `write(…) == canonical` (2/4) or the canonicalisation check (6) pass
  for any entry, including 12/17: those build and serialise a whole-song model,
  which needs the reader and writer this task does not build. It can, and does,
  re-derive each stored chord item's `{ chord, ambiguities }` from its written
  `symbol` and the document's dialect — exactly §5, the strongest chord
  assertion computable from the committed corpus bytes without a reader.
  *Rationale:* it keeps a real corpus footprint (format work's conformance
  level is the corpus) rather than dropping the level the note names; running
  it over *every* song entry's chords (not only 12/17) guards that the §5
  parser handles every chord in the corpus, matching the harness's "every entry
  enumerated" ethos; and born-passing-outside-the-ledger is the pattern
  `text_layer` set with `<entry>/tl`. *Alternatives rejected:* (a) claiming
  12/17's 1–4/6 "flipped" — impossible without the reader/writer, and the
  closer would find them still failing; (b) no corpus check — drops the level
  the `.tji` note names when an honest one exists.

- **The `<entry>/chords` checks are born passing, outside the ledger.** They
  are introduced and satisfied in the same task, so they never appear in
  `expected-failures.json`; the ledger continues to track only the
  not-yet-implemented reader/writer/merge checks shrinking toward
  `cifra_js.conformance`'s empty-ledger terminal state. `checkIds` gains them so
  `staleLedgerIds` stays correct and a future regression fails the gate.
  *Rationale and alternative* mirror [`text_layer.md`](./text_layer.md): the
  harness already runs an unledgered check and asserts it to pass, so a
  born-passing check is first-class; seeding then flipping in one commit would
  be theatre.

- **No design delta.** §5, §5.5 and §1.4.3 are already normative; the
  chord-symbol harness check is a test convention, not designed behaviour; no
  new runtime dependency is added. *Rationale and alternative* mirror
  [`package.md`](./package.md) and [`text_layer.md`](./text_layer.md): a format
  task that implements the spec as written needs no spec change, and the spec
  moves only when behaviour does. (The §9.1 Chart-reader "three/four" prose
  mismatch is surfaced, not edited — see the dedicated decision above and
  §Open questions.)

## Open questions

- **§9.1 Chart-reader prose: "three" vs "four" ambiguous spellings.** The
  Chart-reader clause
  ([`spec/9-conformance.md`](/home/ruoso/devel/cifra.md/spec/9-conformance.md)
  line 17) says *"three ambiguous spellings"* while §5.6, the Chord-reader
  clause, the reference and the corpus all say four (`bareFour` included). This
  task implements four (authoritative); the prose correction is a format-area
  judgement, not code this task can land, and is surfaced for the parking lot /
  format-area review rather than encoded as a WBS task. It does not block this
  task.

## Status

**Done** — 2026-10-04.

- cifra.md `fe19a35`: `js/src/pitch.js` — LETTERS, MAJOR_SCALE, parseNote, formatNote, isNote; ported from pitch.py
- cifra.md `fe19a35`: `js/src/chord.js` — DIALECTS, DEFAULT_DIALECT, parseChord (never throws), isChord, chordTones; ports chord.py with all four ambiguities (sevenPlus/bareNine/degreeSign/bareFour) as `{ kind, chosen, alternative }`, §5.2.1 normalisations (minor+♭5→dim, major+♯5→aug), and §5.5 spelled tones from root letter
- cifra.md `fe19a35`: `js/src/index.js` re-exports parseChord/isChord/chordTones/DIALECTS/DEFAULT_DIALECT + parseNote/formatNote/isNote
- cifra.md `fe19a35`: `js/test/chord.test.js` (new) — 100 unit tests covering §5 grammar per dialect, four ambiguities, canonical model + §5.2.1 normalisation, §5.5 spelled tones, slash/compound bass, errors-returned-not-thrown, dialect surface
- cifra.md `fe19a35`: `js/test/corpus/harness.js` — born-passing `<entry>/chords` check (collectChordItems, resolveDialect) over every reading entry with chord items; 12-ambiguities and 17-chord-spellings pass alongside all other song entries
- cifra.md `fe19a35`: `js/test/harness.test.js` — planted wrong-parse chords case proving the check catches regressions
- 543 Vitest tests pass (100 unit chord + 389 corpus + 19 harness + 35 text); Python reference 1597 passed
