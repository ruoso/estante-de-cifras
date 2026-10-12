# cifra_go.conformance — Conformance

## TaskJuggler entry

[`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 49–54:

> ```
> task conformance "Conformance" {
>   effort 2d
>   allocate team
>   depends !writer, !setlists
>   note "cifra.md: every canonical-corpus entry passes byte for byte. Tests: corpus (every canonical-corpus entry passing byte for byte, no expected failure left)."
> }
> ```

The note starts with `cifra.md:`, so the work lands in the sibling
[cifra.md](https://github.com/ruoso/cifra.md) repository (`go/`). Only this
refinement, its `## Status` block and `complete 100` in
[`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) land in estante-de-cifras.

## Effort estimate

2d (from the `.tji`). The reading corpus is already green — the predecessors
pruned every reading-entry check as they landed (see
[Why it needs to be done](#why-it-needs-to-be-done)) — so the weight of this
task is not a prune but the final, enforced guarantee: a named guard that the
canonical corpus carries **no** expected failure, and a full byte-for-byte
verification run over all 47 reading entries that is the culmination of the
`cifra_go` reader/writer/setlist stream.

## Repository

cifra.md, in `go/` — specifically
[`go/internal/corpus/`](../../../../cifra.md/go/internal/corpus/) (the corpus
harness and its ledger) and a one-sentence correction to
[`spec/9-conformance.md`](../../../../cifra.md/spec/9-conformance.md) §9.3 (see
[Decisions](#decisions)). No change to the `cifra` package itself: the format
is already implemented; this task locks the conformance claim.

## Inherited dependencies

- **`cifra_go.writer`** (settled, `complete 100`) — the §8 serializer,
  `Write`, `Canonical`, `IsCanonical`. Its landing pruned the 102 song
  write/canonicalise ids (`<entry>/{2,4,6}` for the 34 song entries) from the
  ledger, each flipped byte for byte against `canonical.cifra.md`. See
  [`writer.md`](writer.md).
- **`cifra_go.setlists`** (settled, `complete 100`) — the §10 reader and
  canonical writer. Its landing pruned the 65 setlist ids (`/1 /2 /3 /4 /6`
  for the 13 setlist entries) from the ledger. See
  [`setlists.md`](setlists.md).

Transitively settled through those: **`cifra_go.module`** (the corpus harness
and ledger, [`module.md`](module.md)) and **`cifra_go.reader`** (checks 1 and
3, plus the born-passing `/tl` and `/chords`, [`reader.md`](reader.md)).

Not a dependency: **`cifra_go.merge`** (pending). The 76 `merge/*/1` ids remain
ledgered as expected failures; they are not canonical-corpus entries and are
out of this task's scope (see [Decisions](#decisions)).

## What this task is

`cifra_go.conformance` is the terminal conformance gate for the Go
implementation's **canonical corpus** — the 47 reading entries (34 songs
`01-minimal-chart`…`34-pushed-words`, 13 setlists
`35-setlist-minimal`…`47-setlist-text-layer`), each of which pins the reader
and the canonical writer in both directions (`corpus/README.md`). By the time
this task runs, the predecessors have already made every one of those entries'
checks pass and pruned them from the expected-failures ledger, so the corpus
suite is green. This task:

1. **Verifies** that every reading entry passes every reading check (`/tl`, 1,
   2, 3, 4, 6, and `/chords` where the model holds chords) byte for byte, as
   the gate runs them.
2. **Adds a named guard** that the canonical corpus carries no expected
   failure: a Go test asserting that no reading-entry check id appears in
   `expected-failures.json`. This turns "no expected failure left" from an
   incidental state into an enforced, named invariant.
3. **Corrects** the one stale sentence in the specification's conformance
   chapter (§9.3) that still says the corpus has no setlist reading entries.

It does **not** touch the `cifra` package, add check 5 (schema), or disturb the
76 merge ids.

## Why it needs to be done

The `cifra_go` stream's progress is tracked by shrinking a ledger of expected
failures ([`module.md`](module.md): "The ledger is the `cifra_go` stream's
progress record"). `reader`, `writer` and `setlists` each pruned their own
slice as they made those checks pass; between them they have already emptied
the ledger of **every reading-entry id**. The live ledger
([`go/internal/corpus/expected-failures.json`](../../../../cifra.md/go/internal/corpus/expected-failures.json))
now holds exactly 76 ids, all `merge/*/1`, and the corpus suite is green.

So the canonical corpus is, as a matter of fact, already fully conformant — but
only incidentally. `TestCorpusConformance`
([`go/internal/corpus/corpus_test.go`](../../../../cifra.md/go/internal/corpus/corpus_test.go)
lines 84–104) treats a ledgered check as **expected to fail**: a reading check
that was silently re-ledgered to hide a regression would keep the gate green.
Nothing today forbids a reading-entry id from being in the ledger. This task
closes that escape hatch for the canonical corpus and makes the conformance
claim an explicit, enforced guarantee — which is exactly what a "conformance"
task is for, and what the downstream consumers of the Go format
(`hook.canonical`, which calls `IsCanonical`/`Write`/`FormOf`) rely on when
they trust the Go implementation to agree with the reference byte for byte.

The milestone this closes toward is **M6 "The format in Go, everywhere"**
([`tasks/99-milestones.tji`](../../99-milestones.tji),
`depends cifra_go.conformance, cifra_go.merge, …`).

## Inputs / context

- [`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 49–54 — this task's
  block.
- [`spec/9-conformance.md`](../../../../cifra.md/spec/9-conformance.md) — the
  conformance chapter. §9.1 Writer (lines 55–62: "it MUST save every document
  in the canonical form of §8.4, and canonicalising with it MUST give the same
  bytes as with any other conforming writer"); Full (lines 64–66); Setlist
  reader (79–99) and Setlist writer (101–107); §9.2 "What every profile must
  do" (109–125); §9.3 Test corpus (127–137), whose lines 136–137 ("The corpus
  has no entries for reading setlists yet") are now stale.
- [`corpus/README.md`](../../../../cifra.md/corpus/README.md) — the corpus
  contract. Reading entry = four files (lines 7–24); the five self-validation
  checks (lines 37–46); "Texts compare byte for byte … Models compare exactly"
  (lines 48–53); the reference's sixth, model-level check (55–58); the 47
  reading entries (66–102).
- [`go/internal/corpus/harness.go`](../../../../cifra.md/go/internal/corpus/harness.go)
  — the harness. Package doc (lines 1–17): the ledger mechanism, "a ledgered
  check must fail, an unledgered check must pass, and every check is run either
  way". `Discover` (96–131); `ReadingChecks` building `/tl`, 1, 2, 3, 4, 6 and
  `/chords` (139–296); `MergeChecks` (377–414); `StaleLedgerIds` (419–427).
- [`go/internal/corpus/corpus_test.go`](../../../../cifra.md/go/internal/corpus/corpus_test.go)
  — `TestCorpusConformance` (lines 84–104, the ledgered-must-fail /
  unledgered-must-pass gate) and `TestLedgerNamesNoCheckThatDoesNotExist`
  (73–82, the stale-id guard). `pkgImpl` wires the real package (24–45);
  `loadLedger` (47–54) and `allChecks` (56–71) are reusable helpers.
- [`go/internal/corpus/expected-failures.json`](../../../../cifra.md/go/internal/corpus/expected-failures.json)
  — the live ledger: 76 ids, all `merge/*/1`, zero reading ids.
- Predecessor refinements: [`module.md`](module.md) (the harness + ledger +
  "conformance is done when it is empty" framing), [`reader.md`](reader.md),
  [`writer.md`](writer.md), [`setlists.md`](setlists.md).
- [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 (line 277), lines
  293–294: "Implementations agree because they are checked, not because they
  are shared." Go is held to the corpus, never shared with or transpiled from
  the reference or JS.

## Constraints / requirements

- **cifra.md, Go, `go/` only.** No change to the estante-de-cifras app or
  service — they share no code with the format (DIRECTION §3.6); only the
  refinement and completion markers land here.
- **Held to the corpus, never shared.** The harness is a re-implementation of
  the reference's checks, mirrored on the JS twin, importing neither
  (DIRECTION §3.6 lines 293–294). This task adds no path that reads, imports,
  transpiles or shells out to the reference or JS.
- **Canonical form is byte-exact.** Conformance means the produced canonical
  text equals `canonical.cifra.md` / `canonical.setlist.md` byte for byte, and
  the serialised model equals the stored `.json` byte for byte (two-space
  indent, non-ASCII as itself, one trailing newline) — the module's
  order-preserving `Object`/`Encode`/`Dump` contract, not deep-equality
  (`corpus/README.md` lines 48–53).
- **Nothing is skipped.** The guard this task adds must not use `t.Skip`; like
  the rest of the harness, every assertion runs every time, so a regression
  fails the gate (harness.go lines 1–17).
- **The ledger stays honest for merge.** The 76 `merge/*/1` ids are left
  exactly as they are, for `cifra_go.merge` to prune; the stale-id guard
  (`StaleLedgerIds`) must still see every ledgered id name a live check.
- **Standing rules, scoped.** *Canonical form over preserving content* is the
  whole subject of conformance and is honoured by construction. *No song text
  in logs* and *purpose-written fixtures*: the corpus is purpose-written
  reference material, and the harness reports only check ids and byte counts,
  never song text (harness.go `compareBytes`, lines 438–443). *Accessibility*,
  *offline-first* and *no book without an account* do not apply to a pure Go
  format library — noted so the omission is deliberate.

## Acceptance criteria

### Behaviour delivered

- Every canonical-corpus (reading) entry — all 47 — passes every reading check
  (`/tl`, 1, 2, 3, 4, 6, and `/chords` for entries whose model holds chords)
  byte for byte, under the real `cifra` package, as `scripts/gate`'s
  `go_checks` runs them.
- The canonical corpus carries **no expected failure**: no reading-entry check
  id appears in `expected-failures.json`, and this is enforced by a named test,
  not left to the incidental absence of such ids.
- The specification's conformance chapter states the corpus accurately: §9.3 no
  longer claims there are no setlist reading entries.

### Tests the task lands with, by level

Format work's behaviour/conformance level **is** the corpus, so there are no
behavior, e2e-api or e2e-web levels — this is a pure Go format library
(consistent with [`writer.md`](writer.md), [`setlists.md`](setlists.md)). The
levels that apply:

- **corpus** —
  [`go/internal/corpus/corpus_test.go`](../../../../cifra.md/go/internal/corpus/corpus_test.go):
  - `TestCorpusConformance` runs every reading check over all 47 entries and
    asserts each (unledgered) check **passes** byte for byte — checks 1–4 and
    6 (`corpus/README.md` lines 37–58), plus the born-passing `/tl` (§1.3
    fixed point) and `/chords` (§5 re-derivation) the reader added. This pins
    the whole read↔write cycle as a fixed point for the canonical corpus.
  - `TestCanonicalCorpusHasNoExpectedFailure` (**new, added by this task**) —
    enumerates the reading-entry check ids from `Discover(CorpusDir())` +
    `ReadingChecks` and asserts **none** is present in the embedded ledger, so
    a reading check cannot be silently re-ledgered to mask a regression. Pins
    the note's "no expected failure left" for the canonical corpus and
    §9.1/§9.3 (the Full, Setlist-reader and Setlist-writer profiles are
    corpus-conformant with no escape hatch).
  - `TestLedgerNamesNoCheckThatDoesNotExist` (existing) continues to assert the
    ledger names only live checks, so the remaining `merge/*/1` ids stay
    honest.

Fixtures are the existing purpose-written corpus entries; no new fixture is
needed. The closer verifies every named test exists and ran (not skipped) in
the gate (`scripts/gate` `go_checks`, over the cifra.md checkout) before
committing. The `.tji` `Tests:` clause is sharpened to these test names and
what they pin; no level it names is dropped.

### Deferred work

None registered by this task. The 76 `merge/*/1` ids are flipped and the fuller
merge battery added by the already-planned `cifra_go.merge` (8d, note begins
`cifra.md:`, milestone M6) — not a deferral of this task. The whole ledger is
empty only once both `cifra_go.conformance` and `cifra_go.merge` have landed.

## Decisions

- **Scope is the canonical (reading) corpus; the merge ids stay ledgered.** The
  note scopes the task to "every canonical-corpus entry", and this task
  `depends !writer, !setlists` — not `!merge`. A merge entry is not a
  canonical-corpus entry (it has no `canonical.*` file; its outcome is a
  result, deletion or conflicts). So the 76 `merge/*/1` ids are out of scope
  and left for `cifra_go.merge`. *This reconciles the predecessors' loose
  "conformance is done when the ledger is empty" language*
  ([`module.md`](module.md), [`reader.md`](reader.md)): this task empties the
  ledger of **reading-entry** ids and locks that in; the ledger is literally
  empty only after `cifra_go.merge` also lands.
  *Alternative rejected:* make `conformance` `depends !merge` and empty the
  whole ledger — it would force the 2d conformance gate to wait on 8d of merge
  work it does not need, against a note that scopes it to the canonical corpus.

- **The deliverable is an enforced guard, not a prune.** The predecessors
  already pruned every reading-entry id, so there is nothing left to flip; the
  value this task adds is a named test that *forbids* a reading-entry id from
  being ledgered at all.
  *Rationale:* `TestCorpusConformance` treats a ledgered check as expected to
  fail, so without this guard a reading-check regression could be hidden by
  re-ledgering it and the gate would stay green — exactly the hole a
  conformance gate must close.
  *Alternative rejected:* rely on the current incidental absence of reading ids
  from the ledger — not enforced; a future edit could re-ledger a reading check
  and pass the gate, silently un-conforming the canonical corpus.

- **Check 5 (schema) stays out of the Go harness.** `corpus/README.md`'s fifth
  check validates each model against `schema/cifra.schema.json`;
  [`module.md`](module.md) deliberately did not run it in Go (the harness runs
  1, 2, 3, 4, 6), as the JS twin also does not.
  *Rationale:* Go and JS produce byte-identical models to the reference, and
  the reference validates every model against the schema
  (`reference/tests/test_corpus.py` test 5); schema-validity is therefore
  transitive, and the note's "byte for byte" names checks 1–4 and 6, not schema
  validity. Adding a JSON-Schema dependency to the Go module for a redundant
  check is unwarranted.
  *Alternative rejected:* add check 5 to the Go harness — a new runtime
  dependency and a reversal of a settled module-level decision, for a check the
  byte-for-byte equality to the reference already guarantees.

- **Correct §9.3 in the same commit (spec correction, not a format change).**
  [`spec/9-conformance.md`](../../../../cifra.md/spec/9-conformance.md) lines
  136–137 still read "The corpus has no entries for reading setlists yet",
  which is false — setlist reading entries `35`…`47` exist and this task holds
  the Go implementation to them. The conformance chapter must state its own
  corpus accurately, so the sentence is corrected (to note the reading corpus
  now includes setlist entries, §10) in this task's commit.
  *Rationale:* the corpus and the reference already read and write setlists;
  this is a documentation fix, not a change to the format, so the spec does not
  move the reference or corpus with it. It belongs here because `conformance`
  is the task that closes the Go reading corpus, setlists included.
  *Alternative rejected:* leave the line — it leaves the normative conformance
  chapter factually wrong about the corpus it governs.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-12.

- cifra.md `32d3a05`: `go/internal/corpus/corpus_test.go` — `TestCanonicalCorpusHasNoExpectedFailure` added (enumerates reading-entry check ids via `Discover`+`ReadingChecks`, asserts none is in the embedded ledger; excludes `merge/*` ids; uses `sort` import and `readingCheckIDs` helper).
- cifra.md `32d3a05`: `spec/9-conformance.md` — §9.3 corrected: stale "no entries for reading setlists yet" replaced with accurate statement that the reading corpus includes setlist entries (§10).
- No change to the `cifra` package, no new fixture, no check 5, the 76 `merge/*/1` ledger ids left intact for `cifra_go.merge`.
- `TestCorpusConformance` and `TestLedgerNamesNoCheckThatDoesNotExist` already present and green; all three corpus-level tests confirmed passing in gate run (`go/internal/corpus` 0.127s, no skips).
