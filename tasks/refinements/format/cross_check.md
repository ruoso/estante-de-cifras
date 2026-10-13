# format.cross_check — Cross-implementation comparison in CI

## TaskJuggler entry

`task cross_check` in [`tasks/05-format.tji`](../../05-format.tji) (lines
62–67), under `task format`. One line there: *"Cross-implementation
comparison in CI."*

## Effort estimate

**2 days** (from the `.tji`).

## Repository

**Both.**

- **cifra.md** (`/home/ruoso/devel/cifra.md`), three directories:
  - `reference/tools/` — the comparison tool `reference/tools/crosscheck.py`
    (beside `corpus.py`), run `python -m tools.crosscheck` from `reference/`;
    and its generator of random documents.
  - `js/tools/` — the JavaScript comparison **driver**
    `js/tools/crosscheck.mjs` (new; `js/` has no `tools/` dir or CLI today),
    a thin wrapper over the parse/write/serialise the library already has.
  - `go/cmd/crosscheck/` — the Go comparison driver
    `go/cmd/crosscheck/main.go` (new; `go/cmd/` holds only
    `git-merge-cifra` today), the same wrapper over the Go package.
  - `reference/tests/test_crosscheck.py` — the tool's pytest.
- **estante-de-cifras**, one file: [`scripts/gate`](../../../scripts/gate)
  — the new cross-check step in the cifra.md section (lines 399–438), after
  the three per-implementation checks. The gate is cifra.md's CI
  (DIRECTION §3.6, below); the completion ritual lands in this repository, so
  the gate edit rides in the closer's commit here.

No design delta is authored ahead of implementation: DIRECTION §3.6 and the
`.tji` note already promise this comparison; the refinement turns the promise
into a work order and adds no new runtime dependency, format change or
architectural seam (§Decisions, *No design delta — the comparison is already
in the constitution*).

## Inherited dependencies

- **`format.setlist_corpus` — settled.** Complete (`complete 100`,
  [`tasks/05-format.tji`](../../05-format.tji) lines 34–39; refinement
  [`setlist_corpus.md`](setlist_corpus.md)): the setlist reader and canonical
  writer are pinned by `corpus/35-setlist-minimal`–`47-setlist-text-layer`
  in both directions. This task generates setlists as well as songs, so the
  setlist read/write surface must exist and be corpus-pinned in all three
  implementations before random setlists can be compared across them.
- **`cifra_js.conformance` — settled.** Complete (`complete 100`,
  [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 71–77; refinement
  [`cifra_js/conformance.md`](../cifra_js/conformance.md)): the JavaScript
  implementation passes every reading and merge entry with an empty
  expected-failures ledger and claims the Full, Merger, Setlist-reader and
  Setlist-writer profiles (§9.1). So `js/` can parse and write both songs and
  setlists and serialise a model byte-identically to the corpus (the `dump()`
  the driver reuses).
- **`cifra_go.conformance` — settled.** Complete (`complete 100`,
  [`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 50–56; refinement
  [`cifra_go/conformance.md`](../cifra_go/conformance.md)): the Go reading
  corpus (all 47 entries, songs and setlists) passes byte for byte with no
  expected failure. So `go/` can parse and write both songs and setlists and
  `Dump` a model byte-identically.

All three are complete; nothing is pending. The three drivers this task
writes wrap read/write/serialise seams that the dependencies have already
built and corpus-pinned in every implementation.

## What this task is

DIRECTION states, *"On top of the corpus, cifra.md's CI runs the same random
documents through the Python, JavaScript and Go implementations and compares
the bytes. A disagreement is a bug in one of them or a gap in the
specification, and is settled in the specification"*
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6, lines 297–300). The
corpus pins fixed, hand-written examples; this task adds the **random**
layer: a seeded generator produces documents no one wrote by hand, and a tool
runs each through all three implementations and compares the bytes they
produce, so a divergence on a shape the corpus does not contain is caught the
first time a seed reaches it.

The tool (`reference/tools/crosscheck.py`) generates a deterministic,
seeded set of documents — songs and setlists, deliberately non-canonical so
the readers are exercised, not only the writers — and for each document and
each implementation computes three artefacts: the **input model** (parse of
the generated text, serialised as corpus JSON), the **canonical text** (write
of that model), and the **canonical model** (parse of the canonical text,
serialised). It compares the three implementations' artefacts byte for byte.
On any disagreement it prints the seed, the document, which artefact differs
and each implementation's bytes, and exits non-zero. Python runs in-process
(the tool is Python); JavaScript and Go run through the two new thin drivers
this task adds, each a wrapper over the parse/write/serialise their library
already exposes. The gate (cifra.md's CI) runs the tool over a fixed,
bounded, seeded set so a failure is deterministic and reproducible.

## Why it needs to be done

The corpus proves each implementation reproduces a *stored* set of bytes; it
cannot prove they agree on a document no one has written yet. DIRECTION
§3.6 (lines 293–300) makes the random cross-check a named part of how the
three implementations are kept in agreement — *"Implementations agree because
they are checked, not because they are shared"* (lines 293–294) — and places
it in cifra.md: *"the corpus and the cross-implementation comparison run in
cifra.md"* (lines 401–403). `spec/9-conformance.md` makes the agreement a
normative MUST: a conforming **Writer** "canonicalising with it MUST give the
same bytes as with any other conforming writer" (§9.1, lines 60–62). The
cross-check is the random-document instrument for that MUST at the reading and
canonicalisation surface; the merge's equivalent MUST (§9.1 Merger; §11.3
*"Two conforming mergers produce the same bytes"*) is already covered by the
merge corpus and the §11.3 property suites (§Decisions, *Scope: reading and
canonicalisation, not merge*).

This is the last leaf of milestone **m1_format**'s format stream
([`tasks/99-milestones.tji`](../../99-milestones.tji) line 50:
`depends cifra_go.conformance, cifra_go.merge, format.cross_check,
format.conflicts_schema, format.setlist_schema, format.render_hyphen`): with
it, every way the three implementations can disagree — stored examples
(corpus), merge invariants (§11.3 property suites), and now random documents
across all three — has a check.

## Inputs / context

- [`tasks/05-format.tji`](../../05-format.tji) lines 62–67 — the task, its
  `note` (`cifra.md:` → the work lands in cifra.md), its `depends`, and the
  `Tests:` clause (unit + corpus).
- [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 *"Components, and
  what each is written in"* (heading line 277): the agreement principle and
  the corpus (lines 293–297), the random cross-check (lines 297–300), and the
  CI split placing the comparison in cifra.md (lines 401–403).
- `cifra.md/spec/9-conformance.md` — §9.1 the profiles (Writer "same bytes as
  any other conforming writer", lines 56–62; Merger "same result, or the same
  conflicts and marked text, as any other conforming merger", lines 68–77;
  Setlist reader/writer, lines 79–107), §9.3 the test corpus (lines 127–138).
- `cifra.md/spec/11-merge.md` §11.3 *Properties of the merge* (lines
  112–151), including *"Two conforming mergers produce the same bytes"* (line
  120) — the merge's agreement MUST, covered by the merge corpus and the
  property suites, not by this task.
- [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md) —
  the four files of a reading entry (lines 7–24), the five self-validation
  checks (lines 37–46) and the byte-comparison rules: *"Texts compare byte for
  byte. Models compare exactly … The JSON files are written with a two-space
  indent, characters outside ASCII as themselves, and a final newline"* (lines
  48–53). The cross-check reuses exactly this serialisation and comparison.
- `reference/tools/corpus.py` — the sibling tool: `dump()` (lines 45–47, the
  corpus JSON serialisation), `entries()`/`setlist_entries()` (50–55),
  `generate()`/`generate_setlist()` (105–128, the parse→write→parse pipeline
  this task mirrors over generated inputs), `main()` `--write`/`--check`
  (131–176, the CLI shape `crosscheck.py` follows).
- `reference/cifra_md/__main__.py` — the reference CLI
  (`cifra-md parse|write|check FILE`, lines 1–18, 78–106): `parse` emits the
  model as corpus JSON (line 95–97), `write` emits the canonical text (line
  100). Songs only today; the in-process tool also calls
  `parse_setlist`/`write_setlist` for setlists.
- `reference/tests/merge_gen.py` — the existing seeded generator the property
  suite uses: token pools `CHORDS`/`WORDS`/`SHAPES`/`SYMBOLS` (lines 9–13),
  `document(rnd)` (lines 68–83), `setlist(rnd)` (lines 230–250), built on
  stdlib `random.Random`. `reference/tests/test_merge_properties.py`
  (`SEEDS = range(12)`, `N = 25`) shows the deterministic-enumeration
  convention (no `hypothesis`, no randomised fuzzing) this task matches.
- `cifra.md/js/` — library in `js/src`, serialiser `dump()` in
  `js/test/corpus/harness.js` (lines 22–24), run with `npm test`
  (`"test": "vitest run"`, `js/package.json`). No CLI exists; the driver is
  new.
- `cifra.md/go/` — package `github.com/ruoso/cifra.md/go` (`go.mod`, go
  1.25.0); `Parse`/`Write`/`ParseSetlist`/… and `Dump` wired in
  `go/internal/corpus/corpus_test.go` (lines 28–49) over
  `go/internal/corpus/harness.go`. Only `go/cmd/git-merge-cifra/main.go`
  exists; the driver is new.
- [`scripts/gate`](../../../scripts/gate) lines 399–438 — the cifra.md
  section: reference pytest (line 418) and `tools.corpus --check` (line 420),
  then `js` (426) and `go` (432). The cross-check step is added here. No
  `.github/` workflow, Makefile or other CI exists in either repository; the
  gate is the CI that runs both repositories.

## Constraints / requirements

- **The same bytes through all three.** The generator produces each document
  once; the identical input bytes are handed to Python, JavaScript and Go.
  The input is the shared artefact, exactly as the corpus inputs are shared;
  the parse/write logic is not (standing rule, below).
- **Three artefacts, compared byte for byte.** For every generated document
  and every implementation: `input model = serialise(parse(input))`,
  `canonical = write(parse(input))`, `canonical model =
  serialise(parse(canonical))`. The three implementations' bytes for each
  artefact must be identical. The serialisation is the corpus one — two-space
  indent, non-ASCII as itself, one trailing newline
  ([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 48–53) — already implemented identically in all three
  (`dump`/`dump`/`Dump`), so comparison is order-preserving byte equality, not
  deep-equality.
- **Non-canonical, document-shaped input.** Generated texts are UTF-8
  documents as someone might write them — uncanonical spacing, mixed
  conventions, ambiguous tokens — so the comparison exercises reader agreement
  (where whitespace, markers and ambiguities diverge) and not only writer
  agreement. The generator must not emit a marked text (conflict markers,
  §11.12.2) or a non-UTF-8 file: those are not documents a reader produces a
  model from (§1.3), and are the merge's surface, not this one.
- **Deterministic, seeded, bounded — never flaky.** The gate must be
  reproducible: a fixed default seed and a fixed default document count, so a
  given commit either passes or fails deterministically. `--seed S` and
  `--count N` override for exploration; a reported failure prints the seed and
  document so it can be re-run in isolation. This mirrors the property suite's
  deterministic enumeration (`SEEDS`, `N`), not randomised fuzzing, and uses
  stdlib `random.Random` — **no `hypothesis`, no property-testing library**.
- **Thin drivers, no new logic.** The JavaScript and Go drivers read input
  and emit the three artefacts using the parse, write and serialise functions
  their libraries already expose and the corpus harnesses already use; they
  add no parsing, writing or serialisation logic of their own. Each driver
  branches on the input extension — `.cifra.md` a song, `.setlist.md` a
  setlist — exactly as the merge driver already does
  (`reference/cifra_md/__main__.py` line 52).
- **Driver contract (batch, file-based).** The tool writes the generated
  inputs to a temporary directory (one file each, `NNNN.cifra.md` /
  `NNNN.setlist.md`) and invokes each driver once:
  `node js/tools/crosscheck.mjs <in-dir> <out-dir>` and
  `go run ./cmd/crosscheck <in-dir> <out-dir>` (run from `go/`). A driver
  reads every input file and writes its three artefacts
  (`NNNN.input.json`, `NNNN.canonical.<ext>`, `NNNN.canonical.json`) into
  `<out-dir>`. One subprocess per implementation per run (not per document);
  the artefacts on disk make a failure inspectable. Python runs in-process.
  *(The exact filenames and whether inputs go via a directory or stdin is the
  implementer's call; the contract is: identical input bytes in, the three
  artefacts out, one invocation per implementation.)*
- **Standing rules that apply.**
  - *Implementations agree because they are checked, not shared* (DIRECTION
    §3.6). The generator and the comparison are test tooling, run once in
    Python, feeding identical input bytes to three independent
    implementations; this task must not make one implementation read, import,
    transpile or shell out to another's parse/write logic, and must not share
    a generated-document stream *as* an implementation. (The JavaScript and Go
    property suites keep their own generators by design; this task does not
    touch them.)
  - *Test fixtures use songs written for the purpose* — the generator's word,
    title and chord pools are invented (as `merge_gen.py`'s already are),
    never anyone else's words.
  - *No song text in logs* does not apply here — cifra.md is the format
    repository, not the service; the tool prints the offending generated
    document on a disagreement, which is the point, and those documents are
    machine-generated from invented pools.

## Acceptance criteria

**Behaviour delivered.** `reference/tools/crosscheck.py` exists and
`python -m tools.crosscheck` (run from `reference/`) generates a
deterministic seeded set of documents — songs and setlists, non-canonical —
runs each through Python (in-process), JavaScript
(`node js/tools/crosscheck.mjs`) and Go (`go run ./cmd/crosscheck`), compares
the input-model, canonical-text and canonical-model bytes of all three, and
exits 0 when they agree. On a disagreement it exits non-zero and prints the
seed, the document (its bytes), the artefact that differs and each
implementation's bytes for it. The two new drivers
(`js/tools/crosscheck.mjs`, `go/cmd/crosscheck/main.go`) wrap the existing
parse/write/serialise and branch on `.cifra.md` / `.setlist.md`. The step is
wired into [`scripts/gate`](../../../scripts/gate)'s cifra.md section, guarded
on all three implementations being present, running a fixed seed and count.

**Tests the task lands with, by level** (the `.tji` `Tests:` clause names
unit + corpus; format work's behaviour/conformance level **is** the
corpus/CI run, so there are no behavior, e2e-api or e2e-web levels —
§Decisions, *Format work's levels*):

- **unit (pytest)** — `reference/tests/test_crosscheck.py` (new), the tool's
  own tests, pinning the `.tji` *"identical outputs pass, a planted one-byte
  disagreement is reported with the document that caused it"*:
  - *the generator is deterministic* — the same seed and count yield the
    same documents (pins the no-flaky-gate requirement);
  - *identical artefacts pass* — given three implementations' artefacts that
    agree (fed as fixtures, no subprocess), the comparison reports no
    disagreement and the tool exits 0;
  - *a planted one-byte disagreement is reported with its document* — given
    artefacts where one implementation's bytes differ by a single byte on one
    document, the comparison exits non-zero and the report names that
    document, the artefact, and each implementation's bytes. This is the
    `.tji`'s named case.
  - *end-to-end over a tiny seed* — `python -m tools.crosscheck --count <small>`
    runs the real three implementations and exits 0, exercising both drivers
    and the subprocess plumbing (songs and setlists both appear).
- **corpus / CI** — the gate's cifra.md cross-check step
  ([`scripts/gate`](../../../scripts/gate), new, after line 436) runs
  `python -m tools.crosscheck` at the fixed default seed and count through all
  three implementations with exit 0; it is the random-document conformance
  instrument of DIRECTION §3.6 and runs every time `scripts/gate` runs the
  cifra.md section. (This is the `.tji` *"corpus (CI runs it over generated
  documents through all three implementations)"* clause; for this tool the
  corpus-level check is the gate run itself, there being no stored entry to
  add.)

The closer verifies `test_crosscheck.py` ran (not skipped) and the gate's
cross-check step is green in the gate output before committing.

No follow-up work is deferred by this task (§Decisions, *Scope*).

## Decisions

- **No design delta — the comparison is already in the constitution.**
  DIRECTION §3.6 (lines 297–300, 401–403) already decides that cifra.md's CI
  runs random documents through all three implementations and compares bytes,
  and that a disagreement is settled in the specification. This task builds
  that; it adds no runtime dependency (stdlib `random`, `node`, `go` — all
  already in the gate environment), no format change, and no architectural
  seam beyond a tool and two thin CLI drivers that mirror the Python CLI that
  already exists. So no DIRECTION or spec edit is authored. *Alternative
  rejected:* treating the new per-implementation drivers as a new seam needing
  a delta — they are plumbing parallel to `cifra-md parse`/`write`, not a
  change to what the format is or does.

- **A dedicated differential tool, not the corpus harness over a temp
  corpus.** The comparison is a purpose-built tool that generates inputs, runs
  all three and diffs their bytes against each other. *Alternative rejected:*
  generate a temporary corpus with the reference (`tools.corpus --write` into
  a temp dir) and run the JavaScript and Go corpus harnesses over it. That
  privileges the reference's bytes as the stored expectation (JS/Go must match
  *it*, not each other), couples to the four-file layout and the
  expected-failures ledger (which has no meaning for ephemeral documents), and
  reports entry names rather than the generating seed — it could not "report
  the document that caused it" with the seed to reproduce. The dedicated tool
  is symmetric (no implementation is the oracle; a disagreement is "a bug in
  one of them or a gap in the specification", DIRECTION §3.6) and
  self-contained.

- **One shared generator, run once in Python; input shared, logic not.** The
  generator runs in the tool (Python) and the identical input bytes are fed to
  all three implementations — as the corpus inputs are shared. This does not
  violate *checked, not shared*: that rule is about the parse/write/merge
  logic, which stays three independent implementations; sharing the *input
  document* is what makes a cross-check a cross-check. The JavaScript and Go
  property suites keep their own, intentionally non-identical generators
  (`js/test/support/merge_gen.js` and the reference's `merge_gen.py`): those
  test invariants *within* one implementation and need only cover the same
  shapes, so a shared stream there would be the thing the rule forbids. This
  task does not touch them. *Alternative rejected:* three separate generators
  feeding the cross-check — then the implementations would not be running the
  *same* documents and a byte comparison would be meaningless.

- **Reuse the reference generator's shapes; emit raw (non-canonical) text.**
  The generator reuses the token pools and document/setlist shapes already in
  `reference/tests/merge_gen.py` so the fuzz vocabulary is the one the project
  already trusts, but emits the **pre-canonical** text (the generator's
  `document()`/`setlist()` canonicalise through the reference, which would
  both taint the input with Python's writer and limit the fuzz to canonical
  inputs). Feeding raw text exercises reader agreement — whitespace, markers,
  ambiguous tokens — which is where divergence hides; the canonical-text and
  canonical-model artefacts still cover writer agreement. Whether the
  implementer imports `merge_gen`'s helpers or keeps a small raw generator
  beside `crosscheck.py` is their call; the floor is: both songs and setlists,
  non-canonical, seeded, deterministic. *Alternative rejected:* feeding the
  generator's canonical output — weaker (canonical inputs only) and
  Python-tainted.

- **Scope: reading and canonicalisation, not merge.** The cross-check runs
  the read → write → re-read pipeline (the "same documents → same bytes"
  claim of DIRECTION §3.6 and the §9.1 Writer MUST). Merge agreement across
  the three is **already** pinned: the merge corpus (`corpus/merge/`) checks
  every merge outcome byte for byte in all three implementations, and the
  §11.3 property suites exercise random merges within each. Adding a random
  *cross-implementation* merge differential would roughly double this task's
  surface (three inputs, conflicts, marked texts, symmetry) for a guarantee
  the merge corpus and property suites already give, and DIRECTION frames the
  cross-check as running *documents*, not merges. So merge is out of scope and
  **not** deferred as a future task — there is no gap left uncovered.
  *Alternative rejected:* folding a merge differential in — unwarranted scope
  for a 2d leaf, and redundant with the merge corpus's existing
  cross-implementation byte check.

- **Deterministic in the gate, explorable by hand.** The gate runs a fixed
  seed and bounded count so CI is reproducible and never flaky; `--seed`/
  `--count` let a developer widen the search or reproduce a reported failure.
  *Alternative rejected:* a fresh random seed each CI run — it would make the
  gate non-deterministic, so a red build might not reproduce and a latent bug
  might hide for runs; fixed seeds with an easy manual widening is the
  property suite's established trade-off.

- **The gate is cifra.md's CI; the step lands in `scripts/gate`.** There is
  no `.github/` workflow in cifra.md and none is created here — `scripts/gate`
  (in estante-de-cifras) is what runs both repositories' checks, and its
  cifra.md section already runs `tools.corpus --check` (line 420). The
  cross-check is the next step in that section, guarded on all three
  implementations existing (it needs `node` and `go`, both already used
  there). *Alternative rejected:* a new GitHub Actions workflow in cifra.md —
  out of scope (no CI-infrastructure task exists; the gate is the agreed
  single entry point, DIRECTION §3.6 lines 401–403) and it would duplicate the
  gate.

- **Format work's levels.** The `.tji` names unit + corpus; this refinement
  keeps both and reads "corpus" as the gate's cross-check run (there is no
  stored entry to add — the documents are generated). No behavior, e2e-api or
  e2e-web level applies: this is format tooling in cifra.md, not an app screen
  or a service endpoint.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-12.

- cifra.md `fd17e5d`: `reference/tools/crosscheck.py` — seeded generator + differential tool; generates non-canonical songs and setlists, runs them through all three implementations, byte-compares input-model / canonical-text / canonical-model artefacts, exits non-zero on disagreement and prints the seed and differing bytes.
- cifra.md `fd17e5d`: `js/tools/crosscheck.mjs` — thin JavaScript driver wrapping `parse`/`write`/`parseSetlist`/`writeSetlist` and `dump`, branching on `.cifra.md` / `.setlist.md`.
- cifra.md `fd17e5d`: `go/cmd/crosscheck/main.go` — thin Go driver over `cifra.Parse`/`Write`/`ParseSetlist`/`WriteSetlist` + `Encode`, same contract.
- cifra.md `fd17e5d`: `reference/tests/test_crosscheck.py` — pytest: determinism, identical-artefacts pass, planted one-byte disagreement reported, end-to-end tiny seed agrees across all three implementations.
- `scripts/gate` — new cross-check step after the go block, guarded on reference venv + js/ + go/ all present, running the fixed default seed (0) and count (64); `ok: 64 documents through python, js and go agree (seed 0)`.
