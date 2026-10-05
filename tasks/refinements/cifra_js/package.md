# cifra_js.package — Package and corpus harness

## TaskJuggler entry

`task package` in [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) (lines
9–13), under `task cifra_js`. One line there: *"Package and corpus
harness."* The area file's header states the stream's rule: *"The app's
implementation of the format, held to the corpus byte for byte.
Framework-free: the view is the only layer that knows React"*
([`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 1–4).

## Effort estimate

**1 day** (from the `.tji`).

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, created by this
task:

- `js/` — a new, framework-free ES-module package with no runtime
  dependencies, its Vitest setup, and a corpus harness that enumerates every
  corpus entry and runs its checks in both directions. `js/` does not exist
  yet (nor `go/`); this is the first `cifra_js` task and it is greenfield.

The harness reads the already-committed `corpus/` beside `js/`; it is a
**consumer** of the corpus, never a generator — the corpus is generated and
checked by the Python reference (`reference/tools/corpus.py`), and this task
changes nothing there.

No design delta is authored. The package is a planned component
(DIRECTION §3.6), its language, its test framework and its dependency rule
are already settled by the `.tji` note and DIRECTION; the expected-failure
ledger this task introduces is a test-harness convention, not a new
architectural seam or a change to designed behaviour (§Decisions).

## Inherited dependencies

- **`format.canonical_form` — settled.** Complete (`complete 100`,
  [`tasks/05-format.tji`](../../05-format.tji) lines 7–12): the specification,
  the Python reference reader and canonical writer, and the four-file corpus
  that closes the read/write cycle both ways. No refinement document was
  written for `format.canonical_form` (it predates this directory; only
  [`format/setlist_corpus.md`](../format/setlist_corpus.md) exists here), so
  this refinement cites the spec, `corpus/README.md` and the reference
  directly rather than a predecessor refinement.
- **`format.setlist_corpus` — settled** (not a declared dependency, but the
  corpus this harness enumerates already holds its entries). Complete
  (cifra.md `a37c2f5`, [`format/setlist_corpus.md`](../format/setlist_corpus.md)):
  `corpus/35-setlist-minimal/` … `corpus/47-setlist-text-layer/` are setlist
  reading entries. The harness must discover and run them too, so it is wired
  for both input kinds from the start (§Constraints).

No other `cifra_js` task precedes this one; `package` is the stream's root
(`depends !package` on `text_layer`, and the chain onward).

## What this task is

This task creates the `js/` package — the app's implementation of the
cifra.md format — as an empty, framework-free ES-module shell, and builds the
**corpus harness** that will hold it to the corpus byte for byte as the later
`cifra_js` tasks (`text_layer`, `chords`, `reader`, `writer`, `setlists`,
`merge`) fill it in. The package itself reads and writes nothing yet: its
corpus-facing operations are stubs that throw. What this task delivers is the
scaffold and the *check*: a Vitest harness that

1. discovers every reading entry (song by `input.cifra.md`, setlist by
   `input.setlist.md`) and every merge entry under `corpus/merge/`, sorted by
   name, exactly as the reference's `tools/corpus.py` does;
2. runs each entry's checks in both directions — reader direction
   (text → model) and writer direction (model → canonical text) — comparing
   byte for byte against the stored files, serialising models the one pinned
   way;
3. because the package passes none of them yet, declares every check an
   **expected failure by name** in a ledger that the later tasks prune as
   they make checks pass, never a `skip` — so the whole corpus surface is
   executed on every run, and both a premature pass and a regression fail the
   gate.

The ledger is the `cifra_js` stream's progress record: `conformance`
(`cifra_js.conformance`) is done when it is empty.

## Why it needs to be done

Everything else in the `cifra_js` stream depends on this task (directly or
through the chain: `text_layer` `depends !package`, and so on to
`conformance`). DIRECTION makes the corpus the conformance level —
*"Implementations agree because they are checked, not because they are
shared … The corpus holds, for every entry, the input, its model, the
canonical text and the canonical model, and each implementation must
reproduce all four byte for byte, in both directions"*
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6, lines 280–287). The
JavaScript package is *"The app's"* implementation (§3.6 line 269), and
*"The app merges with the JavaScript one; both are held to the same corpus"*
(§3.6 line 298). A package with no harness has nothing holding it to the
corpus; a harness that cannot run against a partial implementation would have
to wait until the whole reader and writer exist, which is exactly the
every-task-lands-with-its-tests rule this project forbids. The expected-
failure ledger lets each later task land its slice of conformance with the
corpus checks it flips green, in the same task, verifiable in the gate.

Downstream consumers: every later `cifra_js` task (which flips its checks),
`format.cross_check` (which `depends cifra_js.conformance` and compares bytes
across Python, JavaScript and Go), and the app itself, which imports this
package below its view (§3.7 line 402–404).

## Inputs / context

- [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 1–4 (stream header),
  9–13 (`task package`, its `note`, the `Tests:` clause: unit + corpus).
- [`docs/DIRECTION.md`](../../../docs/DIRECTION.md):
  - §3.6 component table line 269 (*"cifra.md for JavaScript … The app's."*),
    line 274 (the reference as *"The specification's second opinion."*);
  - §3.6 lines 280–287 — agreement by the corpus, byte for byte, both
    directions; lines 290–293 — *Versions* (each implementation says which
    spec version it conforms to); line 298 — the app merges with the JS one;
  - §3.7 lines 395–397 (the Worker owns the data) and lines 402–404 —
    *"The music core from Explore Chords and cifra.md for JavaScript know
    nothing of React; the view is the only layer that does."*;
  - §3 repository layout lines 364–369 (`corpus/` the agreed bytes,
    `js/` for the app) and line 378–379 (the corpus and the cross-impl
    comparison run in cifra.md).
- [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  — normative for what the harness does:
  - lines 7–24 — the four files of a reading entry, song vs setlist by input
    extension, setlists run checks 1–4 and the sixth but not the fifth;
  - lines 26–35 — why the two JSON files differ and what may not;
  - lines 37–58 — the six checks (1–4 both directions; 5 schema; 6
    model-level canonicalisation ignoring `diagnostics`/`sungAt`);
  - lines 48–53 — texts compare byte for byte; models compare exactly, same
    keys, arrays in order, serialised two-space indent, non-ASCII as
    themselves, final newline;
  - lines 104–149 — merge entries: the inputs (`base`/`ours`/`theirs` with
    `.cifra.md` or `.setlist.md`), the outcome files (`result.*`,
    `result.deleted`, `conflicts.json`, `marked.*`), and the merge checks.
- Reference harness, the thing to **port** (not import):
  - `reference/tools/corpus.py` — `dump()` (lines 45–47: `json.dumps(model,
    indent=2, ensure_ascii=False) + "\n"`), `entries()`/`setlist_entries()`/
    `merge_entries()` (lines 50–61, discovery by input file, sorted),
    `extension()` (64–66), `merge_inputs`/`merge_outputs`/`stale_outputs`
    (69–102), `generate`/`generate_setlist` (105–128).
  - `reference/tests/test_corpus.py` — the six checks parametrised over
    `ENTRIES` (lines 14, 29–61); check 1 as `dump(parse(bytes)) ==
    text(input.parsed.json)` (line 31) shows the compare-the-serialisation
    pattern; check 6 strips `diagnostics`/`sungAt` (lines 55–61).
  - `reference/tests/conftest.py` lines 7–11 — `ROOT` as repo root, the
    `text()`/`model()` readers.
  - `reference/README.md` layout table — the reference primitives the
    harness mirrors: `parse(text|bytes) -> model`, `write(model) -> str`,
    `canonical(model) -> model` (§8.2/§8.3/§4.5), `parse_setlist` /
    `write_setlist`, `merge(base, ours, theirs, setlist=…) -> Outcome` /
    `conflicts_json(outcome)`.
- `cifra.md/spec/1-document.md` §1.3 (lines 28–70) — the text layer the
  corpus-facing `parse` must run on raw bytes, in order: reject non-UTF-8,
  drop every U+FEFF, NFC, split LF/CRLF/lone-CR, tab → one space, strip
  trailing spaces. (Implemented by `cifra_js.text_layer`; relevant here only
  because the harness feeds `parse` **bytes**.)
- `cifra.md/spec/8-normalisation.md` §8 — the canonical form checks 2, 4 and
  6 pin. `cifra.md/spec/9-conformance.md` §9.1 (profiles) and §9.3 (the test
  corpus: *"an implementation … SHOULD pass every corpus entry in both
  directions as `corpus/README.md` describes"*).
- [`scripts/gate`](../../../scripts/gate) — how the gate runs this package:
  lines 378–382 run `npm_checks "cifra.md js"` when `js/package.json` exists;
  `npm_checks` (lines 149–165) runs the package's `lint` (if present),
  `test` and `build` (if present) scripts, after an `npm ci`/`npm install`.
  The corpus harness runs as `npm test` (Vitest). The reference's `pytest`
  and `python -m tools.corpus --check` (lines 361–376) are unaffected.

## Constraints / requirements

- **Framework-free, ES modules, zero runtime dependencies.** `js/package.json`
  declares `"type": "module"` and an empty `"dependencies"`; the only
  dev dependency is Vitest. `js/src/` imports nothing from Node and nothing
  with a `dependencies` entry — it is the package the app bundles below its
  view and knows nothing of React (DIRECTION §3.7 lines 402–404). Node
  built-ins (`node:fs`, `node:path`, `node:url`) appear only in the
  test-only harness under `js/test/`, never in `js/src/`.
- **A `test` script that runs the whole corpus harness.** The gate runs the
  package through `npm test`; `package.json` must define `"test": "vitest
  run"` (not the `npm init` placeholder). A `build` step is deliberately
  absent — the package ships as ES-module source; the app bundles it
  (§Decisions). If a `lint` script is added it must pass in the gate.
- **The corpus is a sibling, found by relative path.** The harness resolves
  the corpus directory from its own location —
  `new URL("../../corpus/", import.meta.url)` from `js/test/corpus/` — so it
  needs no configuration and works from whatever checkout the gate points at
  (`ESTANTE_CIFRA_MD_DIR`).
- **Discovery mirrors the reference, exactly.** List `corpus/`; a directory
  with `input.cifra.md` is a song reading entry, one with `input.setlist.md`
  a setlist reading entry; `corpus/merge/`'s directories are merge entries;
  sort by name (`corpus.py` lines 50–61). The harness must find **every**
  entry present, so a new corpus entry cannot be silently skipped (pinned by
  the discovery unit test).
- **Both directions, byte for byte, per reading entry.** For every reading
  entry the harness runs, against the entry's stored files
  ([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 37–58):
  1. `parse(input.cifra.md bytes)` serialised == `input.parsed.json` bytes;
  2. `write(model of input.parsed.json)` == `canonical.cifra.md` bytes;
  3. `parse(canonical.cifra.md bytes)` serialised == `parsed.json` bytes;
  4. `write(model of parsed.json)` == `canonical.cifra.md` bytes;
  6. `canonical(model of input.parsed.json)` == model of `parsed.json`, with
     `diagnostics` and `sungAt` dropped from both.

  Setlist entries use `parseSetlist`/`writeSetlist`/`canonicalSetlist` on the
  `.setlist.md` texts and run the same checks 1–4 and 6. Check **5** (schema
  validity) is **not** run (§Decisions).
- **Models compare as their pinned serialisation.** The harness never
  deep-equals objects; it serialises the produced model the one canonical way
  — `dump(model) = JSON.stringify(model, null, 2) + "\n"` — and compares the
  resulting UTF-8 bytes to the stored `.json` file, mirroring the reference's
  `dump` (`corpus.py` lines 45–47) and its *compare-the-serialisation*
  pattern (`test_corpus.py` line 31). This makes key order (insertion order,
  as the reader emits it) and non-ASCII spelling part of what the later reader
  and writer tasks must reproduce.
- **Texts and bytes.** Files are read as bytes; texts compare byte for byte
  (an empty canonical file is zero bytes). The corpus-facing `parse` and
  `merge` take **bytes** (a merge input *"need not be UTF-8"*,
  [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  line 120, and §1.3 begins by validating UTF-8), so the harness passes raw
  bytes, not decoded strings.
- **Merge entries are enumerated and run, forward.** For each merge entry the
  harness reads `base`/`ours`/`theirs` with the right extension (a missing
  input is absent), calls `merge(...)`, and compares the produced files
  (`result.*` | `result.deleted` | `conflicts.json` [+ `marked.*`]) byte for
  byte to the entry's stored files, with no unexpected or missing file
  (mirroring `merge_outputs`/`stale_outputs`, `corpus.py` lines 78–102). The
  reverse/symmetry, canonicality, marked-text-resolution and generated
  idempotence checks the reference also runs
  ([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 126–142) are **not** built here; they are the scope of
  `cifra_js.merge` (and `cifra_js.conformance`), which owns `corpus/merge/`
  (§Decisions). The forward check is enough for every merge entry to be
  enumerated and to carry a running, failing check from day one.
- **Expected failures, never skips.** Every discovered check carries an
  explicit expectation. A ledger (`js/test/corpus/expected-failures.json`)
  names, by `<entry>/<check>` id, the checks currently expected to fail; a
  check not named is expected to pass. The harness **runs** every check and
  asserts it against its expectation — an expected-fail check must throw or
  mismatch, an expected-pass check must match — so nothing is `.skip`ped or
  `.todo`ed. The harness fails if the ledger names a check that no longer
  exists (a stale id) — forcing the ledger to track the corpus. At this task's
  landing the package implements nothing, so the ledger names every reading-
  entry check and every merge-entry check.
- **Component boundaries and standing rules, scoped where they apply:**
  - *Implementations agree because they are checked, not shared* (DIRECTION
    §3.6 lines 280–287): the harness is **the** check for JavaScript. It must
    not import, transpile, vendor or shell out to the Python reference or the
    Go implementation; it reads only the corpus bytes they are all held to.
  - *Canonical form over preserving content* (cifra.md §8): the corpus
    already pins this; the harness only compares bytes — it adds nothing and
    must preserve nothing of its own.
  - *Test fixtures use songs written for the purpose*: the corpus already
    does; the planted-mismatch unit test uses a tiny **synthetic** entry
    (invented text), never a real song, and never anyone's copyrighted words.
  - *No song text in logs* applies to the service, not a pure format library;
    the package does no logging and touches no network or storage. The
    harness's failure diffs print fixture text, which is purpose-written
    corpus/test material — acceptable test output, not a service log.
  - *Offline first*, *no book without an account* and the *accessibility*
    rules do not apply: the package has no UI, no network and no persistence
    (it is the format core the Worker and the view sit above). Noted so the
    omission is deliberate, per the brief.

## Acceptance criteria

**Behaviour delivered.** `js/` exists as a framework-free ES-module package
with no runtime dependencies, `npm test` runs a Vitest corpus harness that
discovers and executes every corpus entry's checks in both directions against
the stubbed package, and the suite is **green** because every check is a
named expected failure in the ledger. `scripts/gate cifra.md` runs it
(lines 378–382) alongside the reference's unchanged `pytest` and
`tools.corpus --check`. Concretely:

- `js/package.json` — `"type": "module"`, empty `"dependencies"`, Vitest as
  the sole dev dependency, `"test": "vitest run"`.
- `js/src/index.js` (and whatever modules it fronts) — the corpus-facing
  operations exported as stubs that throw a clear *not implemented* error:
  `parse`, `write`, `canonical`, `parseSetlist`, `writeSetlist`,
  `canonicalSetlist`, `merge`. (Their eventual signatures and any richer
  public surface are owned by `text_layer`/`reader`/`writer`/`setlists`/
  `merge`; the stubs only fix the names the harness calls — §Decisions.)
- `js/test/corpus/harness.js` — pure, implementation-injected functions:
  `discover(corpusDir)`, `dump(model)`, `readingChecks(entry, impl)`,
  `mergeChecks(entry, impl)`, byte comparison and model-as-bytes comparison.
- `js/test/corpus/expected-failures.json` — the ledger, naming every check as
  expected-fail at this landing.
- `js/test/corpus.test.js` — wires the real stubbed `impl` and the ledger,
  iterates every entry, asserts each check against its expectation.
- `js/test/harness.test.js` — the harness's own unit tests.

**Tests the task lands with, by level** (the `.tji` `Tests:` clause names
unit + corpus; format work's behaviour/conformance level **is** the corpus,
so there are no behavior, e2e-api or e2e-web levels — §Decisions):

- **corpus (Vitest, `js/test/corpus.test.js`)** — every reading entry's
  checks 1–4 and 6, and every merge entry's forward check, run and are
  asserted against the ledger. At this landing all are expected failures, so
  the suite passes with the package stubbed; this is the format conformance
  level and the exact surface the later tasks flip. Pins
  [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 37–58 (reading) and 126–149 (merge, forward), DIRECTION §3.6
  lines 280–287. Runs in `scripts/gate` as `npm test` in `js/`.
- **unit (Vitest, `js/test/harness.test.js`)** —
  - *discovery*: `discover` enumerates exactly the corpus's reading entries
    (song + setlist) and merge entries, classified by input extension and
    sorted by name — pinned against the real `corpus/` so a newly added entry
    cannot be missed (pins `corpus.py` lines 50–61 and
    [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
    lines 19–21);
  - *planted mismatch*: with a tiny synthetic entry and a canned/identity
    `impl`, a one-byte difference in an expected file makes the relevant check
    report failure, and a matching synthetic entry makes it pass — proving the
    harness compares bytes and is not vacuously green (pins the byte/model
    comparison and `dump`);
  - *ledger guard*: a ledger id with no matching discovered check fails the
    harness (pins the stale-id guard, so `conformance` can prove the ledger
    empty and honest).

The `.tji` `Tests:` clause is sharpened to these files and cases; no level it
names is dropped.

**Deferred work.** None registered by this task. The fuller merge-corpus
checks (symmetry, canonicality, marked-text resolution, idempotence) are
already within the scope of the existing WBS leaf `cifra_js.merge`
([`tasks/10-cifra-js.tji`](../../10-cifra-js.tji), *"Held to corpus/merge/
… merged text and conflicts.json"*) and `cifra_js.conformance` — not a
follow-up this task creates. Flipping the ledger is each later task's own
work, landing with that task's tests, not deferred here.

## Decisions

- **The harness is a check, ported from the reference — never shared code.**
  The JavaScript harness re-implements discovery, `dump`, the reading checks
  and the forward merge check in `js/test/`, reading the same corpus bytes the
  Python reference generates. It does not import, transpile or invoke the
  reference or the Go implementation. *Rationale:* DIRECTION §3.6 (lines
  280–287) — agreement is by the corpus, not by shared code; a disagreement is
  settled in the specification, which only works if each implementation is
  independent. *Alternative rejected:* calling the reference (or generating JS
  from it) to avoid writing a second reader/writer — explicitly forbidden by
  the standing rule and by DIRECTION.

- **Expected failures that run, not skips.** Each check is driven by a named
  entry in `expected-failures.json`: listed → asserted to fail, unlisted →
  asserted to pass, and the check is executed either way. *Rationale:* the
  `.tji` note requires it (*"wired as expected failures by name, flipped by
  the tasks that make them pass — never skipped"*); running every check on
  every gate means a check that starts passing before its task flips it, or
  regresses after, both fail the gate, keeping the whole corpus surface honest
  and making each task's ledger diff show exactly what it turned green.
  *Alternatives rejected:* Vitest `.skip`/`.todo` for not-yet-passing checks —
  it removes them from the run and the count, so a premature pass or a
  regression is invisible; a grow-only allow-list of *passing* checks — the
  same toggle inverted, but the note frames progress as failures that shrink,
  and an empty failures-ledger is the natural, checkable terminal state for
  `cifra_js.conformance`.

- **Compare models by their pinned serialisation, not by deep equality.** The
  harness serialises a produced model with `JSON.stringify(model, null, 2) +
  "\n"` and compares UTF-8 bytes to the stored `.json`. *Rationale:* the
  corpus pins the serialisation itself — two-space indent, non-ASCII as
  themselves, final newline, `properties` order significant
  ([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 48–53) — and the reference checks its own serialisation byte for byte
  (`test_corpus.py` line 31). Matching bytes, not just structure, is what the
  later reader and writer owe the corpus; a deep-equal would hide key-order
  and formatting differences the spec treats as part of the model.

- **Skip the schema check (check 5) in JavaScript.** The harness runs checks
  1–4 and 6, not 5. *Rationale:* check 5 validates the corpus JSON against
  `schema/cifra.schema.json`; it exercises no JavaScript reader or writer, the
  reference and `tools.corpus --check` already enforce it on every corpus
  change, and checks 1 and 3 compare the JS model byte for byte to that same
  schema-valid JSON — so a JS model that matches is schema-valid transitively.
  Running it in JS would add nothing to JS conformance and would pull in a
  JSON-Schema validator, breaking the zero-runtime-dependency rule for no
  gain. *Alternative rejected:* adding `ajv` (or similar) as a dev dependency
  to re-validate the corpus — redundant coverage at the cost of a dependency
  and drift from "the harness checks the implementation."

- **Corpus-facing operations are stubs now; their signatures belong to the
  later tasks.** `js/src` exports named operations the harness calls
  (`parse`, `write`, `canonical`, `parseSetlist`, `writeSetlist`,
  `canonicalSetlist`, `merge`), throwing *not implemented* at this landing.
  *Rationale:* the harness needs a stable set of names to call so it can exist
  before the reader and writer do, and the reader/writer/setlists/merge tasks
  design the real signatures and any richer public API. Fixing only the names
  keeps the harness decoupled from decisions those tasks own. *Alternative
  rejected:* the package task pre-committing the full public API — it would
  freeze signatures the `.tji` assigns to downstream tasks, coupling the
  harness to premature design.

- **Reading harness in full; merge harness forward-only.** This task builds
  the reading-entry checks completely (they are what `text_layer`→`writer`
  and `setlists` flip) and a forward-merge byte comparison for every merge
  entry (so merge entries are enumerated and carry a running, failing check).
  The reverse/symmetry/canonicality/resolution/idempotence merge checks
  ([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 126–142) are left to `cifra_js.merge`/`conformance`, which own
  `corpus/merge/`. *Rationale:* those checks are meaningless without a merge
  implementation and are tightly coupled to it; building them in a 1-day
  scaffold task would duplicate work the 8-day `cifra_js.merge` task already
  owns, while the forward check keeps enumeration honest. *Alternative
  rejected:* a full merge harness now — premature and out of proportion to a
  package-scaffold task; *Alternative rejected:* no merge handling at all —
  then merge entries would be unenumerated and the ledger would not account
  for them.

- **No build step; ES-module source is the artifact.** `package.json` has no
  `build` script; the app bundles the source. *Rationale:* the package is a
  dependency-free ES-module library; the app (a later stream) owns bundling,
  and a build step here would add tooling and a dependency for no consumer in
  this repository. *Alternative rejected:* bundling/transpiling in `js/` — the
  gate's `npm_checks` would run it, but it serves nothing the package itself
  needs and the view-layer app is where bundling belongs.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-04.

- cifra.md `552cf37`: `js/package.json` — `type: module`, Vitest sole dev dependency, `test: vitest run`, no runtime dependencies.
- cifra.md `552cf37`: `js/src/index.js` — seven corpus-facing stubs (`parse`, `write`, `canonical`, `parseSetlist`, `writeSetlist`, `canonicalSetlist`, `merge`) that throw a clear *not implemented* error.
- cifra.md `552cf37`: `js/test/corpus/harness.js` — pure harness functions: `discover(corpusDir)`, `dump(model)`, `readingChecks(entry, impl)`, `mergeChecks(entry, impl)`, byte and model comparison.
- cifra.md `552cf37`: `js/test/corpus/expected-failures.json` — ledger of 311 expected-failure ids naming every reading-entry check (checks 1–4 and 6) and every merge-entry forward check.
- cifra.md `552cf37`: `js/test/corpus.test.js` — wires the real stubbed impl and the ledger; iterates all entries; asserts each check against its expectation; all 312 tests pass.
- cifra.md `552cf37`: `js/test/harness.test.js` — 15 unit tests: discovery (classification, nothing skipped, sorted, merge separate), planted mismatch (byte/text diff, key-order), ledger guard.
- cifra.md `552cf37`: `js/.gitignore`, `js/package-lock.json` — project hygiene.
- 327 tests (15 unit + 312 corpus) pass; `scripts/gate` runs via `npm test` in `js/` (gate lines 378–382).
