# cifra_js.conformance — Conformance

## TaskJuggler entry

`task conformance` in [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) (lines
71–76), under `task cifra_js`. One line there: *"Conformance."* The area
file's header states the stream's rule: *"The app's implementation of the
format, held to the corpus byte for byte. Framework-free: the view is the
only layer that knows React"*
([`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 1–4).

This is the **terminal** `cifra_js` task: with it, cifra.md for JavaScript
is a conforming Merger, and milestone `m1_format` ("M1: The format in
JavaScript", [`tasks/99-milestones.tji`](../../99-milestones.tji) lines
16–19) can close.

## Effort estimate

**2 days** (from the `.tji`).

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, extended by this
task:

- `js/` — test support and one new test module under `js/test/` (the §11.3
  property suite, its deterministic generator and the shared merge-property
  helpers), one assertion added to `js/test/corpus.test.js` (the ledger is
  empty), and a short conformance statement in a new `js/README.md`. **No
  change to `js/src/`** — the implementation that passes is already landed
  (reader, writer, setlists, merge). This task adds the checks that *say* it
  conforms and locks that in.

No design delta is authored. The §9 profiles and the §11.3 properties are
already normative in the specification; this task turns them into JavaScript
tests and a documented claim, which is a test-and-governance convention, not
a new architectural seam, a new runtime dependency, or a change to the
format (§Decisions).

## Inherited dependencies

- **`cifra_js.writer` — settled.** Complete (cifra.md `c10ea54`,
  [`writer.md`](writer.md)): the §8 canonical writer; the writer refuses to
  save a marked text (§8.3 / §11.12.3), the one Merger obligation this task
  does not re-pin. Reading entries pass checks 2, 4, 6.
- **`cifra_js.setlists` — settled.** Complete (cifra.md `c72c24e`,
  [`setlists.md`](setlists.md)): §10 reader, canonical writer and editing
  operations; the thirteen setlist reading entries pass checks 1, 2, 3, 4, 6.
  The Merger merges setlists too (§11.13), so this predecessor is a direct
  `depends`.
- **`cifra_js.merge` — settled.** Complete (cifra.md `47a635e`,
  [`merge.md`](merge.md)): the §11 three-way merge for songs and setlists,
  held to the whole `corpus/merge/` battery (§11.16 checks `/1` `/2` `/3`
  `/4` `/perm`). That task **emptied the expected-failures ledger**
  ([`js/test/corpus/expected-failures.json`] is `[]`), so every reading and
  merge entry already passes byte for byte. The merge refinement records that
  *"The profile claim is `cifra_js.conformance`'s, built on this task"*
  ([`merge.md`](merge.md) line 362) — this task makes that claim.

The transitive predecessors (`package`, `text_layer`, `chords`, `reader`)
are settled through the chain; `package` ([`package.md`](package.md))
defined the corpus harness and the expected-failure ledger this task reads.

## What this task is

With the merge task landed, cifra.md for JavaScript already **passes** every
reading and merge corpus entry in both directions (the ledger is empty).
This task makes the implementation a *claimed, checked* conformant Merger by
delivering the two things the corpus does not already give, plus one guard:

1. **The §11.3 property suite, ported.** The specification states seven
   properties every conforming merger MUST have (§11.3); the Python
   reference checks them over *generated* documents in
   `reference/tests/test_merge_properties.py`, with a seeded generator
   (`merge_gen.py`) and shared helpers (`merge_props.py`). The corpus pins
   fixed examples; the property suite exercises the merge over families of
   synthetic songs and setlists, catching a rule that holds on every stored
   entry but breaks on a shape no entry happens to contain. Porting it to
   JavaScript (Vitest, a deterministic seeded generator, no new dependency)
   is this task's substantive work.
2. **The Merger-profile claim (§9), recorded and locked.** §9: *"An
   implementation claims conformance to one or more profiles."* This task
   states, in `js/README.md`, that the JavaScript package claims **Full**,
   **Merger**, **Setlist reader** and **Setlist writer** (§9.1), and backs
   the claim with a test asserting the ledger is empty — so the claim cannot
   stand while any corpus check is an expected failure.
3. **The empty-ledger guard.** Today a check that genuinely fails can be
   hidden by naming its id in the ledger (the harness then asserts it
   *fails*). An explicit "the ledger is `[]`" assertion closes that door:
   once the profile is claimed, no later change can re-ledger a broken check
   and stay green. A future spec change that adds a failing entry breaks the
   claim until it is fixed — which is correct.

## Why it needs to be done

`m1_format` depends on `cifra_js.conformance` directly
([`tasks/99-milestones.tji`](../../99-milestones.tji) line 18): the
milestone's promise is *"cifra.md for JavaScript passes the canonical and
merge corpora"* — stated, checked and claimed, not merely true by accident
of the merge task. Downstream, `format.cross_check`
(`depends cifra_js.conformance`, [`tasks/05-format.tji`](../../05-format.tji))
runs the same random documents through Python, JavaScript and Go and
compares the bytes; it needs a JavaScript Merger that is known to conform.
The app itself merges with this package below its view
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 line 297: *"The app
merges with the JavaScript one; both are held to the same corpus"*).

The §11.3 suite is specifically **not** the cross-implementation comparison
of `format.cross_check`: that task compares bytes *across* implementations
on shared random documents; this suite checks that the JavaScript merge
satisfies the §11.3 invariants on its *own* generated documents, inside one
process, which is the project rule — *"Implementations agree because they
are checked, not because they are shared"*
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 lines 280–281). Each
implementation checks its own properties; the corpus and the cross-check are
where the bytes meet.

## Inputs / context

- [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 1–4 (stream
  header), 71–76 (`task conformance`, its `depends !writer, !setlists,
  !merge`, the `note`, the `Tests:` clause: unit + corpus).
- [`tasks/99-milestones.tji`](../../99-milestones.tji) lines 16–19
  (`m1_format`, which this task closes).
- **The specification** (`/home/ruoso/devel/cifra.md/spec/`):
  - `spec/9-conformance.md` lines 68–77 — the **Merger** profile: *"A writer
    that merges three versions of a song (§11)… Must meet: §11 for songs,
    and §5 to the extent §11.7.2 needs the chord model. It MUST give the same
    result, or the same conflicts and marked text, as any other conforming
    merger, and MUST refuse to save a marked text (§11.12.3). A merger that
    is also a setlist writer merges setlists as §11.13 says. Full does not
    include it."*
  - `spec/9-conformance.md` lines 7–66 — the profiles the Merger inherits
    (Chart/Chord/Cifra/Voicings reader, Writer, Full) and the Setlist
    reader/writer (lines 79–107); lines 109–125 — §9.2, what every profile
    must do; lines 127–137 — §9.3, the corpus is the conformance level.
  - `spec/11-merge.md` lines 112–158 — **§11.3**, the seven properties
    (deterministic; depends on canonical forms only; result is canonical;
    unchanged sides change nothing; symmetric, with the one §11.9.5
    exception; a change to the grouping survives, §11.9.4; independent
    changes do not conflict).
  - `spec/11-merge.md` §11.16 (lines 2341+) — the merge-corpus checks, which
    already pass; and the §11.9.5 asymmetry exception the symmetry property
    carves out (an entry marked `asymmetric`).
- **The reference suite to port** (a translation, not shared code —
  cifra.md's implementations *"agree because they are checked, not because
  they are shared"*):
  - `reference/tests/test_merge_properties.py` (226 lines) — `SEEDS =
    range(12)`, `N = 25`, and the eleven property test functions (listed in
    §Acceptance criteria).
  - `reference/tests/merge_gen.py` (320 lines) — the seeded generator:
    `document`, `edit`, `setlist`, `edit_setlist`, `join`, `regroup`,
    `insert_copy`, `add_note`, `unrelated`, `only_section_changed`,
    `cm_grouping`, `section_texts`, and the token pools (`CHORDS`, `WORDS`,
    `SHAPES`, `SYMBOLS`, …).
  - `reference/tests/merge_props.py` (95 lines) — `regions`, `resolve`,
    `mirror_text`, `mirror_conflict`, `normal`, `symmetric`. The JavaScript
    harness already ports most of these as `markedRegions`, `mirrorText`,
    `mirrorConflict`, `normalConflict`
    (`js/test/corpus/harness.js` lines 344–378); `resolve` and `symmetric`
    are what the suite additionally needs.
- **The JavaScript harness and ledger** (`/home/ruoso/devel/cifra.md/js/`):
  - `js/test/corpus/expected-failures.json` — the ledger, currently `[]`.
  - `js/test/corpus.test.js` lines 20–24 (loads the corpus and ledger),
    45–63 (a ledgered id MUST fail, an unledgered id MUST pass), plus the
    stale-id guard (`staleLedgerIds`, `js/test/corpus/harness.js` lines
    519–521). This task adds the empty-ledger assertion here.
  - `js/test/corpus/harness.js` lines 386–512 — `mergeChecks`, the §11.16
    battery (already green); lines 344–378 — the mirror/normal helpers to
    reuse.
  - `js/src/index.js` — the public surface the suite drives: `parse` (:68),
    `write, canonical, isCanonical` (:77), `canonicalSetlist` (:47),
    `merge, conflictsJson, mergeOutputs, resolveMarked` (:118),
    `markerLines` (:20). No new export is added.
- [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 lines 280–298 —
  agreement by the corpus and the cross-implementation comparison; *Versions*
  (lines 289–293); the app merges with the JavaScript implementation
  (line 297).
- [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 126–142 — the merge checks and the generated unchanged-side check.

## Constraints / requirements

- **cifra.md, `js/` only.** This task touches `js/test/` and adds
  `js/README.md`; it does not touch `js/src/` (the implementation is
  complete), the corpus, the spec, or the Python reference. The corpus is
  consumed, never generated, by `js/` ([`package.md`](package.md)).
- **No new dependency.** The package has zero runtime dependencies and
  Vitest as its only dev dependency ([`package.md`](package.md)). The
  property generator uses a small deterministic pseudo-random generator
  written in the test support, not a property-testing library (§Decisions) —
  matching the reference, which uses stdlib `random.Random(seed)` and no
  `hypothesis`.
- **A port, not a redesign** (the stream rule): the suite mirrors the
  reference's file split (a generator module, a helpers module, a test
  module) and its structure (same seeds, same case count, the same eleven
  properties), reusing the mirror/normal helpers the harness already holds
  rather than duplicating them.
- **Deterministic and reproducible.** Fixed seeds, fixed case count; a run
  produces the same documents every time, so a failure is reproducible from
  its seed. The generated documents need not match the Python reference's
  byte-for-byte (§Decisions).
- **Tests use songs written for the purpose** — the generator builds
  synthetic songs and setlists from its own token pools; no copyrighted
  words. (Format work, so no song text in logs does not arise — there is no
  service here.)
- **Canonical form over preserving content** holds as everywhere: the
  properties assert the result is canonical and a fixed point, and that a
  marked text is never a merge input or output (§11.4) — the suite must not
  weaken either.

## Acceptance criteria

**Behaviour delivered.** cifra.md for JavaScript claims the Merger profile
(§9) and the claim is checked: every reading and merge corpus entry passes
with an empty expected-failures ledger, the §11.3 property suite passes over
generated documents, and `js/README.md` states the claimed profiles. No
`js/src/` change; `npm test` (the gate's package step) runs every level
below, none skipped.

Because format work's conformance level **is** the corpus, the `.tji`
`Tests:` clause names only **unit** and **corpus** — there are no behavior,
e2e-api or e2e-web levels (there is no React component and no service here).
The clause is sharpened to these files and cases; no level it names is
dropped.

- **unit — `js/test/merge_properties.test.js`** (ported from
  `reference/tests/test_merge_properties.py`), with `js/test/support/merge_gen.js`
  (the seeded document/setlist generator, ported from `merge_gen.py`),
  `js/test/support/prng.js` (the deterministic generator), and the
  mirror/`resolve`/`symmetric` helpers reused from
  `js/test/corpus/harness.js` (exported for the suite) or a shared
  `js/test/support/merge_props.js`. `SEEDS = 0..11`, `N = 25`. The eleven
  properties, each pinning its §11.3 clause:
  - *unchanged sides change nothing* — merging `b,x,x`, `b,b,x`, `b,x,b`
    gives `c(x)` (§11.3 "Unchanged sides change nothing");
  - *the result is canonical and a fixed point* (§11.3 "Its result is
    canonical", §11.11);
  - *merging depends on canonical forms only* — messy inputs (BOM, CRLF,
    trailing spaces) merge as their canonical forms do (§11.3 "It depends on
    canonical forms only", §11.2 step 2);
  - *exchanging the sides mirrors the outcome* — symmetry, with the
    `asymmetric` §11.9.5 exception respected (§11.3 "It is symmetric");
  - *resolving by one side gives a document* — each region resolved by ours
    and by theirs yields a marker-free canonical fixed point (§11.12.4);
  - *changes to different sections do not conflict* (§11.3 "Independent
    changes do not conflict", §2.8/§4.2 carve-outs);
  - *voicings of different tunings do not conflict* (§11.3 independence,
    §11.10);
  - *setlists* — the unchanged-side, symmetry and resolution properties for
    setlist merges (§11.13);
  - *keys both sides joined stay joined* (§11.9.4);
  - *a change to the grouping survives a side that did not change it*
    (§11.9.4);
  - *a copy inserted does not take another copy's entries* (§11.13).
  Also a case that the empty-ledger guard **fails** when a bogus id is
  ledgered (so the guard itself is pinned), alongside the harness's existing
  discovery / planted-mismatch / stale-id unit tests
  (`js/test/harness.test.js`).
- **corpus — `js/test/corpus.test.js`** via `js/test/corpus/harness.js`:
  every reading entry (checks 1–4, 6) and every `corpus/merge/` entry (the
  §11.16 battery `/1` `/2` `/3` `/4` `/perm`) passes, and a new assertion
  pins **`expected-failures.json` is `[]`** — "the JavaScript package claims
  the Merger profile (§9); no corpus check is an expected failure" (§9.3,
  §11.16, the Merger profile of §9.1). This assertion is the machine-checked
  half of the claim; `js/README.md` is its stated half.

No follow-up work is deferred: this is the terminal `cifra_js` task, and the
suite it lands is complete. (`format.cross_check` — the three-implementation
byte comparison — is already a separate WBS leaf that depends on this task;
it is not spawned here.)

## Decisions

- **The generator is a hand-written seeded PRNG in the test support, not a
  property-testing library, and not a port of Python's MT19937.** The
  reference uses stdlib `random.Random(seed)` with fixed seeds and a fixed
  case count — a deterministic enumeration, not randomised fuzzing — and no
  `hypothesis`. The JavaScript port mirrors that with a small deterministic
  generator (e.g. a `mulberry32`/`sfc32`-style function) seeded by
  `0..11`, giving the same `12 × 25` case budget.
  - *Alternative — add `fast-check`.* Rejected: it brings a dev dependency
    and a different (shrinking, randomised) model than the reference's
    seeded enumeration, and buys nothing the properties need; the stream's
    rule is a port, not a redesign.
  - *Alternative — port Python's `random` (MT19937) exactly so the two
    implementations generate byte-identical documents.* Rejected: the §11.3
    properties are **invariants the merge must satisfy on any input**, not
    stored outputs, so the suite is self-checking and does not compare
    JavaScript's merge to Python's. Reproducing Python's RNG stream is heavy
    (a full Mersenne Twister), and coupling the two implementations' test
    streams would violate *"checked, not shared"*. The cross-implementation
    byte comparison on shared documents is `format.cross_check`'s job, with
    its own mechanism.
- **The generated documents need not equal the reference's.** Following from
  the above: the JavaScript generator need only be deterministic within
  JavaScript and cover the same document shapes `merge_gen.py` builds
  (multi-section charts, sung lines, two tunings with voicings, `Cm`
  groupings to join/split/regroup, setlists with repeated songs). What is
  pinned is the properties, not a corpus of generated cases.
- **The Merger-profile claim is a documented statement in `js/README.md`
  plus a tested invariant (the empty ledger), not a new code export.** §9
  frames a claim as a statement an implementation makes; DIRECTION's
  *Versions* says *"Each implementation says which version of the
  specification it conforms to"* — a README is where an implementation says
  what it conforms to. The evidence is the passing corpus (empty ledger) and
  the §11.3 suite.
  - *Alternative — export a machine-readable `conformsTo` / `CONFORMANCE`
    constant from `js/src/index.js`.* Rejected for now: it has **no consumer**
    (`format.cross_check` compares bytes, not profile strings; the app does
    not read it), and the project bias is the simpler abstraction with a
    real call site. Adding a public API nobody reads, to a surface the
    predecessors deliberately fixed, is scope the claim does not need. If a
    consumer appears, a later task adds the export in one line.
- **The empty-ledger assertion lives in `corpus.test.js`, beside the ledger
  it checks.** The harness already fails on a stale ledger id and on an
  unledgered check that fails; the missing invariant — that the ledger is
  *empty* — is what makes "no expected failure left" enforceable. Placing it
  with the other ledger logic keeps one source of truth for the ledger's
  rules. A future spec change that adds a corpus entry the package cannot yet
  pass would break this assertion, which correctly means the Merger claim no
  longer holds until the entry is made to pass.
- **No change to `js/src/`.** The implementation already passes; adding
  tests and a README is the whole of conformance. This matches the ledger
  state (`[]`) the merge task left and keeps the task to what *"claimed"*
  adds over *"passing"*.

## Open questions

(none — all decided.)

The specification carries no formal version *number* (DIRECTION's *Versions*
speaks of the canonical-form version the service negotiates in workflow 14,
a different axis from the §9 profile claim). Whether the format should carry
a spec version string, and how all three implementations would declare it,
is a cross-cutting format-governance decision — it moves the spec, the
reference, and both implementations together, and is a human call, not an
agent-implementable leaf. It is surfaced for the parking lot, not scoped as
a WBS task, and does not block this claim: `js/README.md` claims the §9
profiles against the in-repo specification.

## Status

**Done** — 2026-10-05.

- cifra.md `b7f5ce9`: `js/README.md` — Merger-profile conformance claim (Full, Merger, Setlist reader/writer, §9.1); the stated half of the §9 claim.
- cifra.md `b7f5ce9`: `js/test/merge_properties.test.js` — §11.3 property suite (11 properties × seeds 0–11 × N=25 = 132 tests), ported from `reference/tests/test_merge_properties.py`.
- cifra.md `b7f5ce9`: `js/test/support/prng.js`, `js/test/support/merge_gen.js`, `js/test/support/merge_props.js` — deterministic mulberry32 PRNG, seeded document/setlist generator and resolve/symmetric/unmarked helpers, ported from `merge_gen.py` and `merge_props.py`.
- cifra.md `b7f5ce9`: `js/test/corpus/harness.js` — `unexpectedFailures` empty-ledger guard added; `js/test/corpus.test.js` — asserts ledger is `[]` (machine-checked half of the Merger claim); `js/test/harness.test.js` — unit test pinning the guard.
- One premise strengthened (not assertion weakened): "changes to different sections do not conflict" also requires the `Cm` footnote grouping unchanged on both sides, closing a coupling gap from §11.9.4 global renumbering confirmed to conflict in the Python reference too.
- Full JS suite: 1292 tests, all passed, empty ledger — cifra.md for JavaScript is a checked, claimed Merger (§9), closing `m1_format`.
