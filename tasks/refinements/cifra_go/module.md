# cifra_go.module — Module and corpus harness

## TaskJuggler entry

`task module` in [`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) (lines
9–13), under `task cifra_go`. One line there: *"Module and corpus harness."*
The area file's header states the stream's rule:
*"cifra.md for Go … The hook's implementation of the format, and
git-merge-cifra for computers. A second, independent implementation, held to
the same corpus."* ([`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines
1–4).

## Effort estimate

**1 day** (from the `.tji`).

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, created by this
task:

- `go/` — a new Go module (`go.mod`, `go 1.25`) with no third-party runtime
  dependencies, the package that will become the format implementation (its
  corpus-facing operations exported as stubs that return a *not implemented*
  error), and a corpus test harness that enumerates every corpus entry and
  runs its reading checks in both directions plus a forward merge check.
  `go/` does not exist yet anywhere in the repository; this is the first
  `cifra_go` task and it is greenfield.

The harness reads the already-committed `corpus/` beside `go/`; it is a
**consumer** of the corpus, never a generator — the corpus is generated and
checked by the Python reference (`reference/tools/corpus.py`), and this task
changes nothing there, nor in `js/` or `reference/`.

In **estante-de-cifras**, only this refinement (and, on completion, its
`## Status` block and `complete 100` in the `.tji`) land. No code changes in
estante — the hook that will link the Go module (`service/internal/hook`,
`service/cmd/pre-receive`) is a later consumer, not this task.

No design delta is authored. The module is a planned component
(DIRECTION §3.6 line 285), its language, its directory, its test tool
(`go test`) and the gate wiring are already settled (§Inputs); the
expected-failure ledger this task introduces is a test-harness convention,
not a new architectural seam or a change to designed behaviour (§Decisions).

## Inherited dependencies

- **`format.canonical_form` — settled.** Complete (`complete 100`,
  [`tasks/05-format.tji`](../../05-format.tji) lines 7–12): the specification,
  the Python reference reader and canonical writer, and the four-file corpus
  that closes the read/write cycle both ways. This is the `cifra_go` stream's
  one declared dependency (`depends format.canonical_form` on `task cifra_go`,
  [`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) line 7). No refinement
  document was written for `format.canonical_form` (its note carries no
  `Refinement:` line; only [`format/setlist_corpus.md`](../format/setlist_corpus.md)
  exists in that area), so this refinement cites the spec, `corpus/README.md`
  and the reference directly rather than a predecessor refinement.
- **`format.setlist_corpus` — settled** (not a declared dependency of
  `module`, but the corpus this harness enumerates already holds its entries).
  Complete (`complete 100`, [`format/setlist_corpus.md`](../format/setlist_corpus.md)):
  `corpus/35-setlist-minimal/` … `corpus/47-setlist-text-layer/` are setlist
  reading entries. The harness must discover and run them too, so it is wired
  for both input kinds from the start (§Constraints). `cifra_go.setlists`
  declares the dependency explicitly ([`tasks/15-cifra-go.tji`](../../15-cifra-go.tji)
  line 29).
- **`cifra_js.package` — not a dependency; the twin and the precedent.**
  The JavaScript module-and-harness task is Done
  ([`cifra_js/package.md`](../cifra_js/package.md), cifra.md `552cf37`), and its
  harness has since grown with the JS reader, chords and merge tasks. This
  task builds the Go equivalent of that **original scaffold landing**: the
  reading checks in full and a forward-only merge check, ledgered as expected
  failures — the later `cifra_go` tasks extend the harness exactly as the
  later `cifra_js` tasks extended theirs (§Decisions).

`module` has no `depends` of its own; it is the stream's root (`depends
!module` on `reader` and `setlists`, and the chain onward to `writer`,
`versions`, `merge`, `conformance`).

## What this task is

This task creates the `go/` module — cifra.md for Go, the hook's
implementation of the format and (later) `git-merge-cifra` for computers — as
a framework-free Go package whose corpus-facing operations are stubs that
return a *not implemented* error, and builds the **corpus harness** that will
hold it to the corpus byte for byte as the later `cifra_go` tasks (`reader`,
`writer`, `setlists`, `versions`, `merge`, `conformance`) fill it in. The
package reads and writes nothing yet. What this task delivers is the scaffold
and the *check*: a `go test` harness that

1. discovers every reading entry (song by `input.cifra.md`, setlist by
   `input.setlist.md`) and every merge entry under `corpus/merge/`, sorted by
   name, exactly as the reference's `tools/corpus.py` does;
2. runs each reading entry's checks in both directions — reader direction
   (text → model) and writer direction (model → canonical text) — comparing
   byte for byte against the stored files, serialising models the one pinned
   way; and a forward merge check for every merge entry;
3. because the package passes none of them yet, declares every runnable check
   an **expected failure by name** in a ledger that the later tasks prune as
   they make checks pass, never a skip — so the whole corpus surface is
   executed on every run, and both a premature pass and a regression fail the
   gate.

The ledger is the `cifra_go` stream's progress record: `conformance`
(`cifra_go.conformance`) is done when it is empty.

## Why it needs to be done

Everything else in the `cifra_go` stream depends on this task (directly —
`reader` and `setlists` `depends !module` — or through the chain to
`conformance` and `merge`). DIRECTION makes the corpus the conformance level
and the reason the implementations may be independent:
*"Implementations agree because they are checked, not because they are shared.
That is what the specification is for. The corpus holds, for every entry, the
input, its model, the canonical text and the canonical model, and each
implementation must reproduce all four byte for byte, in both directions"*
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 lines 293–300). The Go
implementation is *"The hook's; also a git merge driver for computers"*
(§3.6 line 285), and the service *"never needs to understand a song except to
check that a push holds canonical ones, which the Go implementation does in
the hook"* (§3.6 lines 288–291). A module with no harness has nothing holding
it to the corpus; a harness that could only run once the whole reader and
writer existed would break the every-task-lands-with-its-tests rule. The
expected-failure ledger lets each later task land its slice of conformance
with the corpus checks it flips green, in the same task, verifiable in the
gate.

Downstream consumers: every later `cifra_go` task (which flips its checks);
`hook.canonical` ([`tasks/35-hook.tji`](../../35-hook.tji) line 32, `depends …
cifra_go.writer, cifra_go.setlists, cifra_go.versions`), which links the Go
module to refuse non-canonical and marked songs/setlists on a push;
`git-merge-cifra`, the static binary built from the module (`cifra_go.merge`);
and `format.cross_check`, which compares bytes across Python, JavaScript and
Go. The milestone this feeds is **M6 "The format in Go, everywhere"**
([`tasks/99-milestones.tji`](../../99-milestones.tji), `depends
cifra_go.conformance, cifra_go.merge, …`); the writer/setlists/versions path
also reaches M3 through `hook.canonical`.

## Inputs / context

- [`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 1–4 (stream header),
  9–13 (`task module`, its `note`, the `Tests:` clause: unit + corpus).
- [`docs/DIRECTION.md`](../../../docs/DIRECTION.md):
  - §3.6 component table line 285 (*"cifra.md for Go | Go | the cifra.md
    repository, `go/` | Reads and canonicalizes songs and setlists. The
    hook's; also a git merge driver for computers."*);
  - §3.3 lines 196–198 — the `pre-receive` hook, *"a Go program of its own,"*
    checks every push against canonical form (workflow 14);
  - §3.6 lines 288–291 — the app and the service share no code; the Go
    implementation does the canonical check in the hook;
  - §3.6 lines 293–300 — agreement by the corpus, byte for byte, both
    directions; a disagreement is settled in the specification, never by
    copying one implementation into another;
  - §3.6 lines 302–306 — *Versions*: the Go hook carries the current and the
    previous canonical form (relevant to `cifra_go.versions`, not read here);
  - §3.6 lines 308–311 — the merge driver is the one static binary built from
    the Go implementation (relevant to `cifra_go.merge`);
  - §3 repository layout line 382 (`go/` for the hook and git-merge-cifra) and
    lines 387–395 — the hook links the Go package as a named build context
    (`cifra-md-go`, wired in `compose.yaml`) so `go build` resolves it
    *"without vendoring it or copying code between the two repositories"* —
    which fixes the chosen module path as the import path the service's
    `replace` will target (§Decisions).
- [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  — normative for what the harness does:
  - lines 7–24 — the four files of a reading entry, song vs setlist by input
    extension, setlists run checks 1–4 and the sixth but not the fifth;
  - lines 26–35 — why the two JSON files differ and what may not;
  - lines 37–58 — the six checks (1–4 both directions; 5 schema; 6
    model-level canonicalisation ignoring `diagnostics`/`sungAt`);
  - lines 48–53 — texts compare byte for byte; models compare exactly, same
    keys, arrays in order, `properties` order significant, serialised
    two-space indent, non-ASCII as themselves, final newline;
  - lines 104–149 — merge entries: the inputs (`base`/`ours`/`theirs` with
    `.cifra.md` or `.setlist.md`), the outcome files (`result.*`,
    `result.deleted`, `conflicts.json`, `marked.*`), and the merge checks.
- Reference harness, the thing to **port** (not import):
  - `reference/tools/corpus.py` — `dump()` (lines 45–47: `json.dumps(model,
    indent=2, ensure_ascii=False) + "\n"`), `entries()`/`setlist_entries()`/
    `merge_entries()` (lines 50–61, discovery by input file, sorted),
    `extension()` (64–66), `merge_inputs`/`merge_outputs`/`stale_outputs`
    (69–102).
  - `reference/tests/test_corpus.py` — the six checks parametrised over
    `ENTRIES` (lines 29–61); check 1 as `dump(parse(bytes)) ==
    text(input.parsed.json)` (line 31) shows the compare-the-serialisation
    pattern; check 6 strips `diagnostics`/`sungAt` (lines 55–61).
  - `reference/README.md` layout table (lines 21–40) — the reference
    primitives the harness mirrors: `parse(text|bytes) -> dict`, `write(doc)
    -> str`, `canonical(doc) -> doc` (§8.2/§8.3), `is_canonical(text)`,
    `parse_setlist`/`write_setlist`, `merge(base, ours, theirs, setlist=…) ->
    Outcome` / `conflicts_json(outcome)`.
- The twin, the thing to mirror in Go (read, not imported):
  - `/home/ruoso/devel/cifra.md/js/test/corpus/harness.js` — `dump`,
    `discover`, `compareBytes`, `readingChecks`, `mergeChecks`,
    `staleLedgerIds`; the `{id, run}` check shape and the `<entry>/<check>` /
    `merge/<entry>/<check>` id format.
  - `/home/ruoso/devel/cifra.md/js/test/corpus.test.js` — the ledger-driven
    assertion (listed id → must fail; unlisted → must pass; always executed).
  - `/home/ruoso/devel/cifra.md/js/test/harness.test.js` — the harness's own
    unit tests (discovery, planted mismatch, ledger guard).
  - `/home/ruoso/devel/cifra.md/js/src/index.js` — the corpus-facing operation
    names the harness calls.
  - [`cifra_js/package.md`](../cifra_js/package.md) — the predecessor
    refinement whose decisions this one follows.
- `cifra.md/spec/8-normalisation.md` §8 — the canonical form checks 2, 4 and
  6 pin. `cifra.md/spec/9-conformance.md` §9.1 (profiles) and §9.3 (the test
  corpus).
- Existing Go in estante-de-cifras, the module-layout convention to match:
  `api/go.mod` (`module estantedecifras.app/api`, `go 1.25`), `service/go.mod`
  (`go 1.25.0`, flat `internal/<pkg>` libraries and `cmd/<binary>/main.go`
  executables, `<name>_test.go` beside the code). The new `go/` module picks
  its own module path (§Decisions); `go 1.25` matches.
- [`scripts/gate`](../../../scripts/gate) — already wired for the Go module:
  `go_checks` (lines 171–189) runs `go vet ./...`, `go test -p "$JOBS" ./...`
  (bounded parallelism) and `go build`; the cifra.md section runs it when
  `go/go.mod` exists — `if [[ -f "$CIFRA_MD_DIR/go/go.mod" ]]` →
  `(cd "$CIFRA_MD_DIR/go"; go_checks "cifra.md go")` (lines 432–433), else the
  skip message *"cifra.md go: go/go.mod does not exist yet"* (434–435).
  `ESTANTE_CIFRA_MD_DIR` (lines 51, 69–78, default `../cifra.md`) locates the
  repository; the reference's `pytest`/`tools.corpus --check` (lines 409–420)
  and the JS `npm_checks` (426–427) are unaffected. So landing
  `go/go.mod` with at least one package makes the gate run `go vet`, `go test`
  and `go build` automatically — and `go test` must be green, which is what
  the ledger provides at a stubbed landing.

## Constraints / requirements

- **A Go module, no third-party runtime dependencies.** `go/go.mod` declares
  `go 1.25` (matching the estante modules) and a self-chosen module path
  (§Decisions). The package `go/src` (the format implementation) imports only
  the Go standard library; the test-only harness may use `testing`,
  `encoding/json`, `os`, `path/filepath`, `embed`, `runtime` — all standard.
  Nothing third-party is added to `go.mod`'s `require`.
- **`go test ./...` runs the whole corpus harness and is green.** The gate
  runs `go vet ./...`, `go test -p "$JOBS" ./...` and `go build` (gate lines
  171–189); all three must pass. `go vet` clean and `go build ./...` clean are
  part of the bar, not just the tests.
- **The corpus is a sibling, found without configuration.** `corpus/` is a
  sibling of `go/`, outside the module tree, so it cannot be `//go:embed`-ed.
  The harness resolves the corpus directory from the harness source file's own
  path (`runtime.Caller` → repo root → `corpus/`) — the Go idiom for JS's
  `new URL("../../corpus/", import.meta.url)` — so it needs no configuration
  and works from whatever checkout the gate points `go test` at. The
  expected-failures ledger, which *is* inside the module, is loaded by
  `//go:embed` so it is CWD-independent.
- **Discovery mirrors the reference, exactly.** List `corpus/`; a directory
  with `input.cifra.md` is a song reading entry, one with `input.setlist.md` a
  setlist reading entry; `corpus/merge/`'s directories are merge entries; sort
  by name (`corpus.py` lines 50–61). The harness must find **every** entry
  present, so a new corpus entry cannot be silently skipped (pinned by the
  discovery unit test against a second, independent directory walk).
- **Both directions, byte for byte, per reading entry.** For every reading
  entry the harness runs, against the entry's stored files
  ([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 37–58):
  1. `Parse(input.cifra.md bytes)` serialised == `input.parsed.json` bytes;
  2. `Write(model of input.parsed.json)` == `canonical.cifra.md` bytes;
  3. `Parse(canonical.cifra.md bytes)` serialised == `parsed.json` bytes;
  4. `Write(model of parsed.json)` == `canonical.cifra.md` bytes;
  6. `Canonical(model of input.parsed.json)` == model of `parsed.json`, with
     `diagnostics` and `sungAt` dropped from both.

  Setlist entries use `ParseSetlist`/`WriteSetlist`/`CanonicalSetlist` on the
  `.setlist.md` texts and run the same checks 1–4 and 6. Check **5** (schema
  validity) is **not** run (§Decisions). The text-layer fixed-point check
  (`/tl`) and the per-chord check (`/chords`) the JS harness now carries are
  **not** built here — in Go they land with `cifra_go.reader`, which owns the
  text layer and chord symbols (§Decisions).
- **Models compare as their pinned serialisation, in key order.** The harness
  never deep-equals; it serialises the produced model the one canonical way —
  `Dump(model) = json.dumps-equivalent(model, indent=2, ensure_ascii=False) +
  "\n"` — and compares the resulting UTF-8 bytes to the stored `.json` file.
  **This is the task's one genuinely Go-specific problem:** Go's `map` does not
  preserve key order and `encoding/json` re-sorts map keys and escapes `<`,
  `>`, `&`; but the corpus treats key order (including `properties` order) as
  part of the model and emits non-ASCII and HTML characters raw
  ([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 48–53). So the model must use an **order-preserving** representation
  and `Dump` must reproduce Python's `json.dumps` byte for byte: two-space
  indent, `": "` and `",\n"` separators, HTML escaping off, non-ASCII as raw
  UTF-8, numbers decoded with `UseNumber()` so they round-trip, a single
  trailing newline (§Decisions). The reader task reuses this model type and
  this serialiser.
- **Texts and bytes.** Files are read as bytes; texts compare byte for byte
  (an empty canonical file is zero bytes). The corpus-facing `Parse` and
  `Merge` take **bytes** (a merge input *"need not be UTF-8,"*
  [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  line 120, and the text layer begins by validating UTF-8), so the harness
  passes raw bytes, not decoded strings.
- **Merge entries are enumerated and run, forward.** For each merge entry the
  harness reads `base`/`ours`/`theirs` with the right extension (a missing
  input is absent), runs the forward merge, and compares the produced files
  (`result.*` | `result.deleted` | `conflicts.json` [+ `marked.*`]) byte for
  byte to the entry's stored files, with no unexpected or missing file
  (mirroring `merge_outputs`/`stale_outputs`, `corpus.py` lines 78–102). The
  reverse/symmetry, canonicality, marked-text-resolution and the generated
  permutation checks the reference and the current JS harness also run
  ([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 126–142) are **not** built here; they are the scope of
  `cifra_go.merge` (and `cifra_go.conformance`), which own `corpus/merge/`
  (§Decisions). The forward check is enough for every merge entry to be
  enumerated and to carry a running, failing check from day one.
- **Expected failures, never skips.** Every runnable check carries an explicit
  expectation. A ledger (`expected-failures.json`, embedded) names, by
  `<entry>/<check>` and `merge/<entry>/<check>` id, the checks currently
  expected to fail; a check not named is expected to pass. The harness
  **runs** every check and asserts it against its expectation — an
  expected-fail check must error or mismatch, an expected-pass check must
  match — so nothing is skipped (no `t.Skip`). The harness fails if the ledger
  names a check that no longer exists (a stale id), forcing the ledger to
  track the corpus. At this task's landing the package implements nothing, so
  the ledger names every reading-entry check (1–4 and 6) and every merge-entry
  forward check.
- **Component boundaries and standing rules, scoped where they apply:**
  - *Implementations agree because they are checked, not shared* (DIRECTION
    §3.6 lines 293–300): the harness is **the** check for Go. It must not
    import, transpile, vendor or shell out to the Python reference or the
    JavaScript implementation; it reads only the corpus bytes they are all
    held to.
  - *Canonical form over preserving content* (cifra.md §8): the corpus already
    pins this; the harness only compares bytes — it adds nothing and preserves
    nothing of its own.
  - *Test fixtures use songs written for the purpose*: the corpus already
    does; the planted-mismatch unit test uses a tiny **synthetic** entry
    (invented text), never a real song, and never anyone's copyrighted words.
  - *No song text in logs* applies to the service, not a pure format library;
    the module does no logging and touches no network or storage. A failing
    `go test` prints fixture text, which is purpose-written corpus/test
    material — acceptable test output, not a service log.
  - *Offline first*, *no book without an account* and the *accessibility*
    rules do not apply: the module has no UI, no network and no persistence
    (it is the format core the hook and the merge driver sit above). Noted so
    the omission is deliberate.

## Acceptance criteria

**Behaviour delivered.** `go/` exists as a Go module (`go 1.25`, no
third-party runtime dependencies); `go test ./...` runs a corpus harness that
discovers and executes every corpus entry's checks — reading checks 1–4 and 6
in both directions, and a forward merge check — against the stubbed package,
and the suite is **green** because every runnable check is a named expected
failure in the ledger. `go vet ./...` and `go build ./...` are clean.
`scripts/gate cifra.md` runs all three via `go_checks "cifra.md go"` (gate
lines 432–433) alongside the unchanged reference and JS checks. Concretely
(file names are the recommended shape; the implementer may adjust placement so
long as the package boundary and the tested surface hold):

- `go/go.mod` — `go 1.25`, module path per §Decisions, no third-party
  `require`.
- `go/*.go` (package `cifra`) — the corpus-facing operations exported as stubs
  returning a clear `ErrNotImplemented`: `Parse`, `Write`, `Canonical`,
  `ParseSetlist`, `WriteSetlist`, `CanonicalSetlist`, `Merge`, `MergeOutputs`.
  (Their eventual signatures, the `Outcome` shape and any richer public surface
  are owned by `reader`/`writer`/`setlists`/`merge`; the stubs fix only the
  names the harness calls — §Decisions.)
- `go/model.go` (package `cifra`) — the order-preserving model type and the
  `json.dumps`-compatible encoder, reused by the later reader (§Decisions).
- `go/internal/corpus/harness.go` — pure, implementation-injected functions:
  `Discover(corpusDir)`, `Dump(model)`, `ReadingChecks(entry, impl)`,
  `MergeChecks(entry, impl)`, byte comparison, model-as-bytes comparison, and
  `StaleLedgerIds(ledger, checkIds)`.
- `go/internal/corpus/expected-failures.json` — the embedded ledger, naming
  every reading-entry check (1–4, 6) and every merge-entry forward check as
  expected-fail at this landing.
- `go/internal/corpus/corpus_test.go` — wires the real stubbed `impl` and the
  embedded ledger, iterates every entry via `t.Run(check.id, …)`, asserts each
  check against its expectation.
- `go/internal/corpus/harness_test.go` — the harness's own unit tests.

**Tests the task lands with, by level** (the `.tji` `Tests:` clause names
unit + corpus; format work's behaviour/conformance level **is** the corpus, so
there are no behavior, e2e-api or e2e-web levels — §Decisions):

- **corpus (`go test`, `go/internal/corpus/corpus_test.go`)** — every reading
  entry's checks 1–4 and 6, and every merge entry's forward check, run and are
  asserted against the embedded ledger. At this landing all are expected
  failures, so the suite passes with the package stubbed; this is the format
  conformance level and the exact surface the later tasks flip. Pins
  [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 37–58 (reading) and 104–149 (merge, forward), DIRECTION §3.6 lines
  293–300. Runs in `scripts/gate` as `go test` under `go/`.
- **unit (`go test`, `go/internal/corpus/harness_test.go`)** —
  - *discovery*: `Discover` enumerates exactly the corpus's reading entries
    (song + setlist) and merge entries, classified by input extension and
    sorted by name — cross-checked against a second, independent directory
    walk so a newly added entry cannot be missed (pins `corpus.py` lines 50–61
    and [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
    lines 19–21);
  - *planted mismatch*: with a tiny synthetic entry (invented song text) and a
    canned/identity `impl` that returns exactly the stored files, every check
    passes; a one-byte difference in an expected file makes the relevant check
    report failure; and a model whose keys are reordered fails check 1 —
    proving the harness compares `Dump` **bytes in key order**, not a
    deep-equal, and that `Dump` reproduces `json.dumps` (including non-ASCII
    emitted raw). This is the *"fails on a planted mismatch"* the `.tji` names;
  - *ledger guard*: a ledger id with no matching discovered check fails the
    harness (pins the stale-id guard, so `conformance` can later prove the
    ledger empty and honest).

The `.tji` `Tests:` clause is sharpened to these files and cases; no level it
names is dropped.

**Deferred work.** None registered by this task. The text-layer fixed-point
(`/tl`) and per-chord (`/chords`) reading checks fall to `cifra_go.reader`
(which owns the text layer and chord symbols,
[`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) line 17) and the fuller merge
checks (symmetry, canonicality, marked-text resolution, the generated
permutations) to `cifra_go.merge`
([`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) line 43) — both existing WBS
leaves, not follow-ups this task creates. Each extends the harness and flips
its ledger slice with its own tests, landing with that task, not deferred here.

## Decisions

- **The harness is a check, ported from the reference and mirrored on the JS
  twin — never shared code.** The Go harness re-implements discovery, `Dump`,
  the reading checks and the forward merge check in `go/internal/corpus/`,
  reading the same corpus bytes Python generates and JavaScript is held to. It
  does not import, transpile or invoke the reference or the JS package.
  *Rationale:* DIRECTION §3.6 lines 293–300 — agreement is by the corpus, not
  by shared code; a disagreement is settled in the specification, which only
  works if each implementation is independent. *Alternative rejected:* calling
  the reference, or transpiling/vendoring the JS, to avoid a second
  reader/writer — explicitly forbidden by the standing rule and DIRECTION.

- **Order-preserving model and a `json.dumps`-compatible `Dump`.** The model
  is an order-preserving JSON value type (object keys in read/insertion order,
  numbers kept via `UseNumber()`), and `Dump` reproduces `json.dumps(…,
  indent=2, ensure_ascii=False) + "\n"` byte for byte: two-space indent,
  `": "`/`",\n"` separators, HTML escaping off, non-ASCII raw, one trailing
  newline. *Rationale:* key order (including `properties` order) and raw
  non-ASCII are part of the model the corpus pins
  ([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 48–53), and matching **bytes** — not just structure — is what the
  later reader and writer owe the corpus; the reader reuses this type as its
  model. *Alternative rejected:* `map[string]any` + `json.MarshalIndent` — Go
  re-sorts map keys and escapes `<`, `>`, `&`, so checks 1 and 3 could never
  match the corpus bytes; a deep-equal comparison would also hide the key-order
  and formatting differences the spec treats as part of the model.

- **Expected failures that run, not skips.** Each check is driven by a named
  entry in the embedded `expected-failures.json`: listed → asserted to fail,
  unlisted → asserted to pass, and the check is executed either way.
  *Rationale:* the `.tji` note requires it (*"wired as expected failures by
  name, flipped as they pass"*); running every check on every gate means a
  check that starts passing before its task flips it, or regresses after, both
  fail the gate, and an empty ledger is the natural, checkable terminal state
  for `cifra_go.conformance`. *Alternatives rejected:* `t.Skip` for
  not-yet-passing checks — removes them from the run so a premature pass or a
  regression is invisible; a grow-only allow-list of *passing* checks — the
  note frames progress as failures that shrink to empty.

- **Reading harness in full; merge harness forward-only; no `/tl` or
  `/chords` yet.** This task builds the reading-entry checks 1–4 and 6
  completely (what `reader`→`writer` and `setlists` flip) and a forward-merge
  byte comparison for every merge entry (so merge entries are enumerated and
  carry a running, failing check). The reverse/symmetry/canonicality/
  resolution/permutation merge checks go to `cifra_go.merge`/`conformance`;
  the text-layer and per-chord reading checks go to `cifra_go.reader`.
  *Rationale:* this is the exact scope `cifra_js.package` chose at its scaffold
  landing, and the 1-day effort matches it; the heavier checks are meaningless
  without the implementation they exercise and belong to the task that writes
  it (Go folds text layer and chords into the one `reader` task, where JS split
  them). *Alternative rejected:* a full merge battery / text-layer / chord
  harness now — premature and out of proportion to a scaffold task, duplicating
  work the `reader` and 8-day `merge` tasks own. *Alternative rejected:* no
  merge handling at all — then merge entries would be unenumerated and the
  ledger would not account for them.

- **Skip the schema check (check 5) in Go.** The harness runs checks 1–4 and
  6, not 5. *Rationale:* check 5 validates the corpus JSON against
  `schema/cifra.schema.json`; it exercises no Go reader or writer, the
  reference and `tools.corpus --check` already enforce it on every corpus
  change, and checks 1 and 3 compare the Go model byte for byte to that same
  schema-valid JSON — so a Go model that matches is schema-valid transitively.
  Running it in Go would add a JSON-Schema dependency for no gain to Go
  conformance. *Alternative rejected:* adding a JSON-Schema validator
  dependency to re-validate the corpus — redundant coverage at the cost of a
  dependency and drift from "the harness checks the implementation."

- **Corpus-facing operations are stubs now; their signatures belong to the
  later tasks.** `go/*.go` exports named operations the harness calls
  (`Parse`, `Write`, `Canonical`, `ParseSetlist`, `WriteSetlist`,
  `CanonicalSetlist`, `Merge`, `MergeOutputs`), each returning a clear
  `ErrNotImplemented`; the `Model` type and the `json.dumps`-compatible encoder
  are fixed here (the harness needs them), but the `Outcome` shape and any
  richer public API are a minimal placeholder the downstream tasks flesh out.
  *Rationale:* the harness needs a stable set of names and the model/dump
  contract to exist before the reader and writer do; fixing only those keeps it
  decoupled from decisions `reader`/`writer`/`setlists`/`merge` own.
  *Alternative rejected:* the module task pre-committing the full public API and
  `Outcome` shape — it would freeze signatures the `.tji` assigns to downstream
  tasks.

- **Module path `github.com/ruoso/cifra.md/go`, `go 1.25`.** The new module
  takes the import path of its repository and subdirectory, matching the
  estante modules' Go version. *Rationale:* it is the idiomatic path for a
  package at `github.com/ruoso/cifra.md` under `go/`, and it is the stable
  import path the service's hook build will target with a `replace` to the
  `cifra-md-go` named build context (DIRECTION §3.6 lines 387–395), resolving
  the sibling without vendoring. *Alternative rejected:* an opaque local path
  like `cifra.md/go` — works for a `replace` target but is non-idiomatic and
  less clear about provenance; the import path is cheap to get right now and
  awkward to change once the hook depends on it.

- **No executable in this task; library module only.** `go/` ships a package
  and its test harness, no `cmd/` binary. *Rationale:* the one binary,
  `git-merge-cifra`, is built by `cifra_go.merge` (DIRECTION §3.6 lines
  308–311); a `main` here would serve nothing. `go build ./...` with no main
  package still runs in the gate (gate lines 181–188) and must be clean.
  *Alternative rejected:* scaffolding `cmd/git-merge-cifra` now — premature; it
  belongs with the merge implementation it fronts.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- cifra.md `2200741`: `go/go.mod` — `module github.com/ruoso/cifra.md/go`, `go 1.25`, no third-party requires
- cifra.md `2200741`: `go/model.go` — order-preserving `Object` model, `DecodeModel`, and `Encode`/`Dump` reproducing `json.dumps(…, indent=2, ensure_ascii=False)` byte for byte
- cifra.md `2200741`: `go/cifra.go` — `ErrNotImplemented` + stub ops `Parse/Write/Canonical/ParseSetlist/WriteSetlist/CanonicalSetlist/Merge/MergeOutputs`, minimal `Outcome` placeholder
- cifra.md `2200741`: `go/internal/corpus/harness.go` — `CorpusDir`, `Discover`, `Dump`, `ReadingChecks` (1–4, 6), `MergeChecks` (forward), byte/model comparison, `StaleLedgerIds`
- cifra.md `2200741`: `go/internal/corpus/expected-failures.json` — embedded ledger naming all 311 runnable checks (47 reading × 5 + 76 merge × 1)
- cifra.md `2200741`: `go/internal/corpus/corpus_test.go`, `go/internal/corpus/harness_test.go`, `go/.gitignore`
- estante-de-cifras: `service/internal/emaillink/token.go` — fix latent token malleability (`RawURLEncoding.Strict()`); `service/internal/emaillink/token_test.go` — corrected comment
