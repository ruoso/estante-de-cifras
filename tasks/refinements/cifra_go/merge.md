# cifra_go.merge — Merge, and git-merge-cifra

## TaskJuggler entry

`task merge` in [`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) (lines
43–47), under `task cifra_go`, `depends !writer, !setlists, format.merge`. The
area file's header states the stream's purpose: *"The hook's implementation of
the format, and git-merge-cifra for computers"*
([`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 1–4).

The `.tji` note: *"cifra.md: chapter 11, and the git merge driver as one static
binary (§11.14). Not needed by the hook; for a clone on a computer. Tests: unit
(chapter 11 section by section); corpus (every corpus/merge/ entry); behavior
(git-merge-cifra configured as a merge driver in a throwaway repository, merging
two branches through the git CLI, clean and conflicted)."*

The note starts with `cifra.md:`, so the work lands in the sibling
[cifra.md](https://github.com/ruoso/cifra.md) repository; the refinement, its
Status block and `complete 100` land here.

## Effort estimate

**8 days** (from the `.tji`) — the largest `cifra_go` leaf, tied with the
reader. It is the **Go twin** of the already-done `cifra_js.merge` (also 8d,
Done 2026-10-05, [`cifra_js/merge.md`](../cifra_js/merge.md)): it ports the same
two reference modules — `reference/cifra_md/merge.py` (~1600 lines) and
`setlist_merge.py` (~365 lines) — that between them realise every section of a
long chapter (the generic sequence merge, the chart with its footnote-marker
algebra merged three ways, the voicings part, setlists, the conflict model, the
marked text and its JSON), lands the section-by-section unit suite, and widens
the corpus harness from the forward-only check `package`/`module` left to the
**full §11.16 battery**, turning every `corpus/merge/` entry green and emptying
the merge slice of the ledger. Beyond the JS twin it adds two Go-only pieces the
JS task deferred here: the **`git-merge-cifra` static binary** (§11.14) and a
**behavior** test driving it through the git CLI in a throwaway repository.

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, extended by this
task:

- `go/` — the flat `cifra` package at the module root
  (`github.com/ruoso/cifra.md/go`, `go 1.25`), gaining:
  - [`go/merge.go`](../../../../cifra.md/go/merge.go) — the merge entry point and
    the **song** merge, porting `reference/cifra_md/merge.py`: the §11.2 method
    (whole files, canonicalise, unchanged-side short-circuits, part-by-part
    merge, finish); the generic §11.5 sequence merge (alignment, changes,
    clusters, settlement, keyed lists); §11.6 values; §11.7 metadata and
    `reading` conflicts; §11.8 chart; §11.9 footnote markers merged three ways;
    §11.10 voicings; §11.11 result; §11.12 conflict model, marked text and
    resolution.
  - [`go/setlist_merge.go`](../../../../cifra.md/go/setlist_merge.go) — the
    **setlist** merge (§11.13), porting `reference/cifra_md/setlist_merge.py`:
    the keyed-list merge of entries, items (reference + occurrence, three-step
    pairing) and notes blocks, and the setlist conflict kinds and marked text.
    Called by `merge.go` on a `.setlist.md` path.
  - [`go/cifra.go`](../../../../cifra.md/go/cifra.go) — the placeholder
    `type Outcome struct { Payload any }` is replaced with the real fields
    (§Decisions), the `Merge`/`MergeOutputs` stubs (returning `ErrNotImplemented`
    today) are implemented, and `ConflictsJSON`/`ResolveMarked` are added. These
    are the **last** corpus-facing stubs; after this task `go/cifra.go` has no
    `ErrNotImplemented` path left.
  - new `*_test.go` unit files beside the source
    ([`go/merge_test.go`](../../../../cifra.md/go/merge_test.go),
    [`go/setlist_merge_test.go`](../../../../cifra.md/go/setlist_merge_test.go)).
  - [`go/cmd/git-merge-cifra/`](../../../../cifra.md/go/cmd/git-merge-cifra) — a
    new `main` package: the `git-merge-cifra` static binary (§11.14), built into
    the git-ignored `go/bin/`, and its behavior test (`driver_test.go`).
  - [`go/internal/corpus/harness.go`](../../../../cifra.md/go/internal/corpus/harness.go)
    — `MergeChecks` is widened from the forward-only `merge/<entry>/1` to the
    full §11.16 battery, and the `Impl` interface gains `ResolveMarked`.
  - [`go/internal/corpus/expected-failures.json`](../../../../cifra.md/go/internal/corpus/expected-failures.json)
    — the 76 `merge/<entry>/1` ids are **removed**; the new checks are
    born-passing, outside the ledger.

The corpus beside `go/` is unchanged: this task is a **consumer** of the
already-committed corpus bytes — the Python reference generates and checks
`corpus/merge/` (the entries landed with `format.merge`), and this task touches
nothing under `reference/` or `corpus/`. Agreement is by the corpus, not by
shared code — `merge.go`/`setlist_merge.go` are a **port** of
`reference/cifra_md/merge.py` and `setlist_merge.py`, matched to the reference
and the corpus, never importing, transpiling or shelling out to Python or the
JavaScript twin (DIRECTION §3.6). The module split mirrors the reference's and
the JS twin's; it is the implementer's layout, not a new architectural seam.

No design delta is authored. Chapter 11, the Merger profile of §9.1 and the
git-merge-cifra binary of DIRECTION §3.6 are already normative, and
`format.merge` has produced the spec, the reference and the merge corpus; the
new modules, the binary and the harness extension are internal layout and a
test-harness convention (the expected-failure ledger `cifra_go.module`
introduced), not a new runtime dependency or a change to designed behaviour
(§Decisions).

In **estante-de-cifras**, only this refinement, its Status block, and
`complete 100` in [`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) land, in the
closer's commit; the implementation itself is committed in cifra.md, and the
Status block cites that commit.

## Inherited dependencies

- **`cifra_go.writer` — settled** (Done 2026-10-08, cifra.md `1b3caef`,
  [`writer.md`](writer.md) Status): [`go/write.go`](../../../../cifra.md/go/write.go)
  delivers `Write`/`Canonical`/`IsCanonical`, the §8.3 footnote invariants
  I1→I3→I2, the §8.4 serialiser, the model-level canonicalisation twins
  (`canonicalModel`, `numberBarsModel`, `pairRepeatsModel`, `rederiveModel`), and
  `MarkedTextError`/`checkUnmarked`. The merge **finishes** through this writer:
  the clean result is built, the invariants applied, every sung line laid out,
  written and canonicalised (§11.11 steps 2–5) with exactly the writer's
  `Canonical`; and the marked text is written with the writer's §8.4 serialiser
  *without* the invariants and *without* canonicalising (§11.12.2). The writer's
  refusal to save a marked text (`MarkedTextError`, §11.12.3) is the standing
  rule this task's output honours — the merge never returns a marked text as a
  saveable result.
- **`cifra_go.setlists` — settled** (Done 2026-10-08, cifra.md `839d8c9`,
  [`setlists.md`](setlists.md) Status): [`go/setlist.go`](../../../../cifra.md/go/setlist.go)
  delivers `ParseSetlist`/`WriteSetlist`/`CanonicalSetlist` and the §10.5/§10.9.2
  path machinery (`objString`, `objArray`, `orderedEntries`). The setlist merge
  (§11.13) canonicalises its inputs with `CanonicalSetlist`, identifies items by
  the reference its path writer produces, and writes its result and marked text
  through `WriteSetlist`. The setlist **merge** entries (`corpus/merge/24`, `25`,
  `60`–`68`, `65-setlist-marked-side`) are held to this module.
- **`format.merge` — settled** (cifra.md, [`tasks/05-format.tji`](../../05-format.tji)
  `complete 100`, effort 8d, note *"cifra.md: chapter 11, the reference merge,
  the merge corpus, marked inputs, joins and repeated setlist songs, the grouping
  merged three ways"*). No refinement document was written for `format.merge` (it
  predates this directory, like `format.canonical_form`/`sung_layout`), so this
  refinement cites spec **chapter 11**,
  [`corpus/README.md`](/home/ruoso/devel/cifra.md/corpus/README.md) and the
  reference directly rather than a predecessor refinement. `format.merge`
  produced: the normative spec chapter
  [`spec/11-merge.md`](/home/ruoso/devel/cifra.md/spec/11-merge.md) (2455 lines);
  the reference merge (`reference/cifra_md/merge.py`, `setlist_merge.py`, and the
  grouping/props helpers); and the 76 `corpus/merge/` entries with their expected
  outputs. These are the behaviour to match and the bytes to pass.
- **`cifra_go.reader` — settled** (transitively, through `writer`; Done
  2026-10-08, cifra.md `1b3caef`, [`reader.md`](reader.md)): the merge works on
  the models [`go/parse.go`](../../../../cifra.md/go/parse.go) produces — it reads
  each present input through `Parse`/`ParseSetlist` before it merges (§11.2 step
  2), and the chart's units, sections, chords, tunings and voicings it merges are
  exactly the reader's `*Object` model shapes.
- **`cifra_go.module` — settled** (transitively, Done 2026-10-07, cifra.md
  `2200741`, [`module.md`](module.md)): the module
  (`github.com/ruoso/cifra.md/go`, package `cifra`, `go 1.25`); the
  order-preserving `Object`/`Model` with `Encode`/`DecodeModel` reproducing
  `json.dumps(indent=2, ensure_ascii=False)` byte for byte; the shared text-layer
  primitives [`go/text.go`](../../../../cifra.md/go/text.go)
  (`Prepare`/`prepare`, `isMarkerLine`, `markers`, `NotUTF8Error`) the merge uses
  to detect a marked input and a non-UTF-8 input; the `FormOf`/`SetlistFormOf`
  form registry; and the corpus harness with its ledger convention (listed →
  asserted to fail, unlisted → asserted to pass, executed either way; no
  `t.Skip`; a stale id fails `TestLedgerNamesNoCheckThatDoesNotExist`). `module`
  seeded `MergeChecks` **forward-only** — one born-failing check `merge/<entry>/1`
  per `corpus/merge/` entry — and the `Merge`/`MergeOutputs` stubs, documented for
  this task to fill.
- **`format.canonical_form` — settled** (transitively, no refinement; cited
  directly): the §8/§10.9 canonical form the merge's inputs are reduced to and
  its result conforms to.

Downstream consumers:

- **`cifra_go.conformance` — already complete** (Done, cifra.md `7afcfc8`,
  [`conformance.md`](conformance.md)). It is **not** a dependant of this task
  (`conformance depends !writer, !setlists`, not `!merge`): it landed the
  canonical-corpus gate `TestCanonicalCorpusHasNoExpectedFailure`, which asserts
  no **reading** check id is ledgered, and deliberately **left the 76
  `merge/<entry>/1` ids** in the ledger for this task. This task is what empties
  the merge slice; after it, `expected-failures.json` is `[]` and the whole
  `cifra_go` stream's ledger is empty — the stream's progress record is complete.
- **The hook** (task 35) does **not** need the merge: the `.tji` note says so
  outright (*"Not needed by the hook"*). The hook guards a book by checking
  canonical form (`IsCanonical`, the writer's refusal), never by merging; it
  rejects a non-fast-forward push rather than merging on the server.
- **A clone on a computer** (DIRECTION §3.6 lines 308–311) is the real consumer:
  `git-merge-cifra`, configured as a git merge driver, merges a book's songs and
  setlists on a laptop that has no JavaScript runtime, agreeing to the byte with
  the app's JS merge because both are held to the same corpus.

## What this task is

This task implements cifra.md's **three-way merge** (spec §11) in Go, and builds
it into the **`git-merge-cifra`** static binary a computer runs as a git merge
driver (§11.14). The merge is the last operation the format defines: it lets two
people change copies of one song and have their changes brought together
([`spec/11-merge.md`](/home/ruoso/devel/cifra.md/spec/11-merge.md) lines 1–33). A
plain line merge is wrong for a song, because a song's text is only partly the
author's lines: its voicings are a structure, its footnote markers are names
that canonicalising renumbers, and a sung line is laid out from what it means.
So the merge works **on meaning where the format has structure, and by lines
where the text is the author's** — the chart merges line by line with footnote
markers merged separately as the arrangement decisions they are; the voicings
merge per tuning, then variation, then key; properties and the title merge per
value. What genuinely collides is a **conflict**, shown both in musical terms
(the `Outcome`) and as a **marked text** carrying git-style conflict markers for
whoever prefers to edit. Like the canonical form (§8), the merge is **defined to
the byte and deterministic**: the Go git merge driver on a computer and the
JavaScript merge on a device produce the same result, or the same conflicts and
the same marked text, and the corpus holds them to it (§11.16).

Concretely it:

- fills [`go/cifra.go`](../../../../cifra.md/go/cifra.go)'s merge seam — replaces
  the placeholder `Outcome` with real fields and implements
  `Merge(base, ours, theirs []byte, setlist bool) (Outcome, error)` (a `nil`
  input is an absent side), `MergeOutputs(outcome, setlist) (map[string][]byte,
  error)` (the corpus file map), `ConflictsJSON(outcome) ([]byte, error)` (the
  §11.12.5 JSON) and `ResolveMarked(marked []byte, side string) ([]byte, error)`
  (§11.12.4);
- adds `go/merge.go` (the song merge, porting `merge.py`) and
  `go/setlist_merge.go` (the setlist merge, porting `setlist_merge.py`), called
  by `Merge` on the file kind the caller gives (song, or setlist by the
  `.setlist.md` path);
- builds `go/cmd/git-merge-cifra/main.go`: a `main` that takes git's four
  arguments `%O %A %B %P` (base, ours = output, theirs, path), merges, and
  writes the result or the marked text to `%A` with the exit code §11.14 fixes;
- widens the corpus harness's `MergeChecks` to the full §11.16 battery and
  prunes the merge ledger.

### What the merge covers, section by section

The `.tji` note names the pieces; chapter 11 is their normative definition
(cited in §Inputs). The merge comprises:

- **The method** (§11.2): whole files (§11.4), then canonicalise each present
  input, then the unchanged-side short-circuits, then the part-by-part merge,
  then finish (write + canonicalise, or produce conflicts + marked text).
- **Whole files** (§11.4): the seven-row absence table; not-UTF-8 → a `file`
  conflict (file left unrewritten); a **marked input** → a single `unresolved`
  conflict naming each marked side with its first marker line, ours left byte for
  byte; delete-vs-change → a `file` conflict with no marked text; the empty
  document as the base when there is none. The fixed case order: not-UTF-8, then
  deleted-on-both, then marked input, then the rest.
- **The generic sequence merge** (§11.5): the deterministic LCS **alignment**
  (§11.5.1, pair whenever possible; between dropping and taking, drop first),
  **changes**/runs/modifications and when two changes **touch** (§11.5.2),
  **clusters** and the merged sequence (§11.5.3), **settling** a cluster by the
  conflict policy (with or without pairing) or by combining (§11.5.4), and
  **keyed lists** — presence, values, order (§11.5.5, order never conflicts).
- **Values** (§11.6) and **metadata** (§11.7): the three-way value merge; the
  title and the keyed list of properties; §11.7.2's `reading` conflicts, where
  one side changes `notation` or `words` under music the other side wrote.
- **The chart** (§11.8): units and their **masked text** (a chord's symbol in
  place of its key, so `Cm[2]` masks to `Cm`); section match/same/equal;
  headings field by field; bodies put back into parts; what the merged text
  decides when read (repeat groups, bar numbers, sung-ness — not merged).
- **Footnote markers merged three ways** (§11.9): the heart of the task.
  Decisions are identified by the occurrences that carry them, not by marker
  names; corresponding keys and the matching procedure (§11.9.2); re-keyed
  occurrences (§11.9.3); **variants** with their signatures, joins, destinations
  and groupings so *a change to the grouping survives* (§11.9.4); and the fresh
  numbering with its single documented asymmetry (§11.9.5).
- **The voicings part** (§11.10): blocks by tuning-by-sound and variation, with
  renames; tuning spellings (a value that never conflicts); voicings per variant
  and block, with **weak absence**; the notes and order.
- **The result** (§11.11) and **conflicts** (§11.12): building and canonicalising
  the clean result; the conflict model, the marked text, the marker-line
  primitive, resolution, and the JSON.
- **Setlists** (§11.13): the same shape with less in it — entries, items by
  reference and occurrence with the three-step pairing, notes blocks, and the
  setlist conflict kinds.
- **The git merge driver** (§11.14): the binary's argument contract, exit codes
  and stderr reporting (see §Constraints).

## Why it needs to be done

The merge driver is how a book stays mergeable on a computer with no JavaScript
runtime. DIRECTION ships the same merge two ways: the app merges with the
JavaScript implementation on a device, and *"a clone on a computer with
`*.cifra.md merge=cifra` in its `.gitattributes`"* merges with `git-merge-cifra`
(DIRECTION §3.6 lines 99–100, 308–311; §11.14). The two must agree to the byte —
which is exactly what being *defined to the byte and held to the corpus* (§11.3,
§11.16) guarantees — so that a song merged on a laptop and the same song merged
on a phone come out identical. This is the **Merger profile** of §9.1 — *"a
writer that merges three versions of a song"* — which the `cifra_go` stream
claims once this task makes every merge entry pass (the profile is for programs
that merge; the hook, a pure canonical-form guard, does not claim it).

That is why this task `depends !writer, !setlists, format.merge`: the merge
*finishes* through the §8 writer, merges setlists through the §10 setlist layer,
and is held to the corpus and the reference `format.merge` produced. It is the
last leaf in the `cifra_go` stream to touch the ledger — after it, the stream's
expected-failure ledger is empty and the Go implementation covers the whole
format, songs and setlists, read, written, canonicalised and merged.

## Inputs / context

- [`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 1–4 (stream header),
  43–47 (`task merge`, its `depends !writer, !setlists, format.merge`, the `note`
  and its `Tests:` clause: unit + corpus + behavior).
- [`writer.md`](writer.md), [`setlists.md`](setlists.md), [`reader.md`](reader.md),
  [`module.md`](module.md) and [`conformance.md`](conformance.md) — the
  predecessors and siblings: the writer's
  `Write`/`Canonical`/`MarkedTextError`/`IsCanonical` and model-level
  canonicalisation twins; the setlist layer's
  `ParseSetlist`/`WriteSetlist`/`CanonicalSetlist` and path machinery; the
  reader's model shapes; the module's `Object`/`Encode`/`DecodeModel`, text-layer
  primitives, `FormOf`, the corpus harness (`Discover`/`CorpusDir`/`Dump`,
  `ReadingChecks`/`MergeChecks`, `StaleLedgerIds`, the embedded ledger, the
  `Check{ID, Run}` shape, the `Impl` interface), and the "corpus-facing
  operations are stubs until their task" seam; conformance's canonical-corpus
  gate and its explicit hand-off of the 76 merge ids.
- The **JS twin**, [`cifra_js/merge.md`](../cifra_js/merge.md) — the same port
  decided and landed in JavaScript: the two-module split, the `Outcome` shape,
  the `mergeOutputs`/`conflictsJson`/`resolveMarked` seams, the full §11.16
  corpus battery, and the boundary with conformance (the §11.3 property tests and
  the schema check are not the merge task's). This Go task reproduces those
  decisions in Go idiom and adds the git driver and behavior test the JS task
  left to Go.
- **Specification (normative) —
  [`spec/11-merge.md`](/home/ruoso/devel/cifra.md/spec/11-merge.md):**
  - Preamble lines 1–33 — scope (an app that syncs, and a git merge driver; a
    pure reader/writer needs none of it); base / ours / theirs; *"the merge works
    on meaning where the format has structure, and by lines where the text is the
    author's"*; *"Like the canonical form (§8), the merge is defined to the
    byte"* and deterministic (lines 27–33).
  - §11.1 lines 35–69 — what is merged: the three inputs, any **absent**; the
    **outcome** (result / deleted / conflicts [+ marked]); file kind by name
    (`*.setlist.md` → setlist, else song); the real-world cases table, whose last
    row maps the git merge driver's `%O`/`%A`/`%B` to base/ours/theirs.
  - §11.2 lines 71–110 — the five-step method, and the *"What each part of a song
    is merged as"* table.
  - §11.3 lines 112–158 — the normative properties: deterministic; depends on
    canonical forms only; result canonical; **unchanged sides change nothing**;
    **symmetric** (with the §11.9.5 exception); **a change to the grouping
    survives**; independent changes do not conflict; the one far-reaching change
    (sung vs not).
  - §11.4 lines 160–218 — whole files: the seven-row table; no base; deleted-vs-
    changed; not-UTF-8; **marked inputs** (`unresolved`, ours untouched); the
    fixed case order; non-canonical inputs canonicalised first.
  - §11.5 lines 220–384 — sequences: §11.5.1 alignment (234–260), §11.5.2
    changes/touch/identical (262–296), §11.5.3 the merged sequence/clusters
    (297–321), §11.5.4 settling — conflict (with/without pairing) and combine
    (322–347), §11.5.5 keyed lists — presence/values/order (349–384).
  - §11.6 lines 385–396 — values. §11.7 lines 397–444 — §11.7.1 title and
    properties (399–409), §11.7.2 `reading` conflicts for `notation`/`words`
    (411–444).
  - §11.8 lines 446–561 — §11.8.1 units and masked text (448–494), §11.8.2
    sections (495–525), §11.8.3 headings (527–531), §11.8.4 bodies (533–544),
    §11.8.5 what the merged text decides (546–561).
  - §11.9 lines 562–785 — §11.9.1 why names are not enough (564–578), §11.9.2
    corresponding keys and the matching procedure (580–614), §11.9.3 re-keyed
    occurrences (616–631), §11.9.4 **variants**: signature, joined, destination,
    moved / moved-in-place / reshaped, grouping, continues (633–753), §11.9.5
    numbering and the one asymmetry (755–785).
  - §11.10 lines 787–898 — §11.10.1 blocks and renames (789–819), §11.10.2 tuning
    spellings (820–830), §11.10.3 voicings and **weak absence** (832–886),
    §11.10.4 notes and order (888–898).
  - §11.11 lines 899–921 — building and canonicalising the clean result (steps
    1–5: invariants I1→I3→I2, sung re-layout, write, canonicalise).
  - §11.12 lines 923–1110 — §11.12.1 the conflict model and kinds (925–977),
    §11.12.2 the marked text and its region table (978–1033), §11.12.3 marker
    lines (1035–1056), §11.12.4 resolving (1058–1076), §11.12.5 **as JSON**, the
    member table and ordering (1078–1110).
  - §11.13 lines 1112–1219 — setlists: entries, items (reference + occurrence,
    three-step pairing), notes blocks, conflict kinds, marked text, JSON.
  - §11.14 lines 1221–1269 — **the git merge driver**: the `[merge "cifra"]`
    config and `.gitattributes`; the argument contract `%O %A %B %P` (base,
    ours = output, theirs, path); the conforming-driver rules (write result to
    `%A`, exit 0 on clean; write marked text to `%A`, exit 1 on conflict; leave
    `%A`, exit 1, explain on stderr for not-UTF-8 and marked input; markers of
    exactly seven characters with labels `ours`/`theirs` whatever size git asks);
    and what git does itself (one-sided change, a delete).
  - §11.15 lines 1271–2340 — the 22 worked examples the corpus mirrors.
  - §11.16 lines 2341–2397 — **corpus entries**: the file layout; the four stored
    self-validation checks (forward byte-exact; reverse/symmetry with sides
    exchanged, `asymmetric` skipping it; result canonical; resolution fixed
    point); the generated unchanged-side checks (`merge(b,x,x)`, `merge(b,b,x)`,
    `merge(b,x,b)` give `c(x)`); the coverage list.
- [`spec/9-conformance.md`](/home/ruoso/devel/cifra.md/spec/9-conformance.md)
  lines 68–77 — the **Merger** profile: *"A writer that merges three versions of
  a song (§11)"*; must meet §11 for songs and §5 to the extent §11.7.2 needs the
  chord model; MUST give the same result/conflicts/marked text as any conforming
  merger and MUST refuse to save a marked text (§11.12.3); *"Full does not include
  it"* (line 77). §9.3 lines 128–137 — the merge corpus in `corpus/merge/`; a
  merger SHOULD pass every entry, as §11.16 says.
- [`corpus/README.md`](/home/ruoso/devel/cifra.md/corpus/README.md) — the
  **merge entries**: the files (`base`/`ours`/`theirs`, one of
  `result`/`result.deleted`/`conflicts.json`, `marked` when a region exists,
  `asymmetric`); and the per-entry checks (1 forward byte-exact; 2 symmetry; 3
  result canonical; 4 resolution fixed point; 5 `conflicts.json` valid against
  `schema/conflicts.schema.json`; plus the generated unchanged-side permutations),
  which this task builds into the Go harness.
- **Reference, the behaviour to match** (port, never import —
  `/home/ruoso/devel/cifra.md/reference/`):
  - `reference/cifra_md/merge.py` — `merge(base, ours, theirs, setlist=False) →
    Outcome` (line 408: decode, absent/deleted, marked → `unresolved`, equal-side
    short-circuits, canonicalise, dispatch); `@dataclass Outcome` (line 48:
    `result`/`deleted`/`conflicts`/`marked`/`kept`, property `kind`); `class
    SongMerge` (line 643, the song engine); the machinery `merge_value`,
    `merge_sequence`, `align`, `Change`, `combine`, `keyed_order`,
    `Unit`/`units_of`, `Sec`/`sec_match`/`sec_equal`, the footnote-variant
    grouping, `region`, `finish_marked`; and `conflicts_json(outcome)` (line 364)
    / `conflict_json(c)` (line 360) — the §11.12.5 serialiser.
  - `reference/cifra_md/setlist_merge.py` — `merge_setlists(b, o, t) → Outcome`
    (line 364), `class SetlistMerge` (line 177), `class EntryMerge`, and the
    id/body helpers.
  - `reference/cifra_md/__main__.py` — `merge_driver(argv)` (line 41) and `main`
    (line 78): the CLI the Go binary's argument/exit/stderr contract mirrors
    (`BASE OURS THEIRS [PATH]`; setlist iff path ends `.setlist.md`; write to
    OURS and exit 0 / 1; usage → exit 2). The Go deliverable is a **standalone**
    `git-merge-cifra` taking `%O %A %B %P`, not a `cifra-md merge` subcommand.
  - `reference/tools/corpus.py` — `merge_outputs(outcome, ext)` (line 78),
    `merge_inputs(entry)` (69), `extension(entry)` (64): the map from an
    `Outcome` to the corpus file set, which `MergeOutputs` mirrors.
  - `reference/tests/test_merge.py`, `test_merge_examples.py`, and the
    setlist-merge cases — the unit cases to port.
    `reference/cifra_md/merge_props.py` / `test_merge_properties.py` are the §11.3
    **property** tests — noted so the boundary is clear: they are *not* in scope
    here (the `cifra_go` stream's conformance already landed; see §Decisions).
- **Corpus (the bytes this task is held to) —
  `/home/ruoso/devel/cifra.md/corpus/merge/`:** 76 entries, one directory each,
  covering the §11.15 examples and their alternatives, every row of §11.4, a
  non-UTF-8 file, a marked base/ours/theirs (including a git-written marker set
  with `|||||||`, a BOM and CR LF), every song conflict kind of §11.12.1 and
  setlist kind of §11.13, the footnote-marker join/revoice/move cases of §11.9
  (including `59-numbering-inside-a-conflict`, flagged `asymmetric`), non-canonical
  inputs, and the setlist cases. Each holds `base`/`ours`/`theirs` (`.cifra.md` or
  `.setlist.md`; a missing file is absent) and exactly one of `result<ext>` /
  `result.deleted` / `conflicts.json`, with `marked<ext>` when a conflict has a
  region, and `asymmetric` where §11.9.5's exception applies.
- **Harness (what this task extends) —
  [`go/internal/corpus/`](../../../../cifra.md/go/internal/corpus):**
  - `harness.go` — `Discover` already lists every `corpus/merge/` subdir as a
    `MergeEntry`; `mergeInputs` reads `base`/`ours`/`theirs` as bytes (`nil` when
    absent); `mergeExtension` picks `.setlist.md` or `.cifra.md`;
    `mergeOutputNames(ext)` is `result<ext>`/`result.deleted`/`conflicts.json`/
    `marked<ext>`; `MergeChecks` today builds only the forward check
    `merge/<entry>/1` (call `Merge`, then `MergeOutputs`, compare the file map
    byte for byte), with a comment handing the symmetry/canonicality/resolution/
    permutation checks to this task; the `Impl` interface carries `Merge` and
    `MergeOutputs`.
  - `corpus_test.go` — `TestCorpusConformance` runs every check as a subtest; a
    ledgered id must fail, an unledgered id must pass.
    `TestCanonicalCorpusHasNoExpectedFailure` forbids a reading id in the ledger
    (merge ids are out of its scope). `TestLedgerNamesNoCheckThatDoesNotExist`
    forbids a stale id.
  - `expected-failures.json` — currently a list of 76 `merge/<entry>/1` ids (the
    only ledgered failures; every reading/setlist entry already passes). This
    task **removes** them.

## Constraints / requirements

- **Deterministic and defined to the byte** (§11.3). The merge's output depends
  only on the three texts and the file kind — not on the program, machine, time,
  or visit order beyond what the chapter fixes. Two mergers produce the same
  bytes; so the Go git driver and the JS merge agree. Every tie-break the chapter
  fixes is honoured exactly: the alignment walk (pair whenever possible; between
  dropping and taking, drop first — §11.5.1); combining by sort string (code
  point, prefix first — §11.5.4); the corresponding-keys matching order
  (greatest count, then same-index, then least base index, then least side index
  — §11.9.2); the variant numbering (signature key indices descending as lists,
  then first occurrence in the merged chart, ours's side first inside a region —
  §11.9.5). No Go `map` iteration order is relied on where the spec fixes an
  order; order is computed over the `Object`'s preserved key order and over
  sorted keys, never inherited from a `map`.
- **Depends on canonical forms only; the result is canonical** (§11.2 step 2,
  §11.3, §11.11). Each present input is read and canonicalised before anything is
  compared (`Canonical`/`CanonicalSetlist`); an absent base is the empty
  document. The clean result is **finished through the writer** — the merged
  model, footnote invariants I1→I3→I2, every sung line laid out, written as §8.4,
  then canonicalised (§11.11 steps 1–5) — so the result is canonical and a fixed
  point by construction, not by a second code path. The result and marked text
  are built and written at the **model level**, reusing `write.go`'s model-level
  serialiser and canonicalisation twins
  ([[go-rederive-is-model-level-not-parser-reuse]]): a Go port cannot re-run the
  parser to re-derive bar numbers and repeat pairing the way a string round-trip
  would, so it operates on the `*Object` model throughout, as the Go writer does.
- **The marked text is written without the invariants and without
  canonicalising** (§11.12.2). It is written from a merged model that keeps every
  variant of both sides, with the writer's §8.4 serialiser but *not* §11.11 step 2
  (invariants) or step 5 (canonicalise). Its markers are exactly seven characters
  with the labels `ours`/`theirs`; the region rules (no blank line directly
  inside a region's markers; a `chart` region inside a part only when both runs
  are lines of one part, otherwise the whole section becomes one `sections`
  region; fence handling across regions) are honoured so it matches the corpus
  byte for byte.
- **A marked input is never merged** (§11.4, §11.12.3). A present input that
  holds a marker line after the text layer gives a single `unresolved` conflict
  naming each marked input with the 1-based line number of its first marker line;
  **ours stays exactly as it is, byte for byte** (or stays absent), with no result
  and no marked text — carried in the `Outcome`'s `kept`. The merge detects this
  with `isMarkerLine`/`markers` from `text.go` (not a second copy), in the fixed
  case order (not-UTF-8, deleted-on-both, marked, then the rest). A not-UTF-8
  input is a `file` conflict and the file is **not rewritten**.
- **The conflict model and its JSON are produced exactly as §11.12 says.** The
  `Outcome` carries the conflicts in the order of their regions in the marked
  text (a `file`/`unresolved` conflict being the only conflict of its merge);
  `ConflictsJSON` writes the §11.12.5 object with each member present under its
  rule and in the fixed order, strings and run-arrays as specified, two-space
  indent, non-ASCII as itself (the `Encode`/`Dump` convention), final newline. A
  run is written in the result's keys, a base run as base has it.
- **Footnote markers merged three ways, grouping-preserving** (§11.9). Decisions
  are identified by the occurrences that carry them, never by marker names;
  corresponding occurrences, the matching procedure, re-keying, signatures,
  joins, destinations and groupings are implemented so that *a change to the
  grouping survives*, *independent arrangements do not conflict*, *what base told
  apart and no side moved stays apart*, and the single documented numbering
  asymmetry (§11.9.5) is the only departure from symmetry. Voicings merge per
  variant with **weak absence** (§11.10.3).
- **Setlists merge as songs with less** (§11.13). Inputs canonicalised with
  `CanonicalSetlist`; entries, items (by reference and occurrence, three-step
  pairing) and notes blocks as keyed lists; the setlist conflict kinds (`title`,
  `property`, `item`, `text`, `entry`, `notes`, plus `file`/`unresolved`); the
  result and marked text written with `WriteSetlist`.
- **The git merge driver `git-merge-cifra`** (§11.14). A `main` package built as
  **one static binary** (CGO disabled, no runtime to rely on — DIRECTION §3.6
  lines 308–309) that:
  - takes exactly four positional arguments `%O %A %B %P` — base, ours (the
    **output** path), theirs, and the file path — and chooses setlist iff the
    path ends `.setlist.md`, else song (a wrong argument count → a usage line on
    stderr, exit 2);
  - reads the three files as bytes (git supplies an empty `%O` when there is no
    base, which is the empty document, so the driver and the app agree) and calls
    `Merge`;
  - on a **result**: writes the result bytes to `%A`, exits **0**;
  - on a **conflict with a region**: writes the marked text to `%A`, exits **1**;
  - on a **not-UTF-8** input: leaves `%A` as it is, writes to stderr which sides
    are unreadable, exits **1**;
  - on a **marked input** (`unresolved`): leaves `%A` as it is, writes to stderr
    which inputs hold marker lines and each one's first marker line, exits **1**
    (a marked ours stays marked; git keeps the file unmerged);
  - writes conflict markers of **exactly seven characters** with the labels
    `ours`/`theirs` whatever marker size git asks for (inherited from the §8.4
    marked-text writer, not re-chosen here), so the driver's marked text is the
    one the corpus holds. **No song text is written to stderr** — only which
    sides, and line numbers (DIRECTION's logging rule; §11.14 asks for exactly
    this).
- **Framework-free, one allowed dependency** (DIRECTION §3.6; stream header). The
  merge and the driver import only the `cifra` package, the Go standard library,
  and the one dependency the module already carries (`golang.org/x/text`'s
  `unicode/norm`, pulled in by `cifra_go.setlists`); no new `go.mod` entry. They
  know nothing of HTTP, the service, isomorphic-git or the app — the merge is a
  pure function of three byte slices, and the driver is a thin `os.Args` + file
  wrapper over it.
- **Agreement is by the corpus, not shared code** (DIRECTION §3.6). The two
  modules are a **port** of `merge.py`/`setlist_merge.py`, mirroring the
  reference's file split; they import, transpile or shell out to no Python or
  JavaScript. The JS merge (§11.14 is a Go concern there) is a separate
  implementation against the same chapter and corpus, never a copy of this one.
- **Standing rules scoped where they apply:** *Canonical form over preserving
  content* — the merge's clean result is always canonical (§11.11), and a
  **marked text is never canonical, never a saveable result**: the merge returns
  it only as `marked`/writes it to `%A` for the *edit* path, and the writer
  refuses to save one (`MarkedTextError`, §11.12.3); the merge preserves no
  non-canonical spelling, since it works on canonical forms only. *Test fixtures
  are purpose-written* — the unit and behavior tests use tiny invented songs and
  setlists, and the purpose-written `corpus/merge/` entries, never anyone's
  copyrighted words. *No song text in logs* — the driver's stderr carries only
  side names and line numbers, never song text. *Offline first* is the reason the
  driver exists as a pure device-/computer-side function; it is honoured by the
  clone that runs it, not by this code. *Accessibility* and *no book without an
  account* do not apply — there is no UI, network or account here (stated so the
  omission is deliberate).

## Acceptance criteria

### Behaviour delivered

`go/merge.go` implements `Merge(base, ours, theirs []byte, setlist bool) →
Outcome` and the song merge (§11.2–§11.12), with `ConflictsJSON` (§11.12.5),
`MergeOutputs` (the corpus file map) and `ResolveMarked` (§11.12.4);
`go/setlist_merge.go` implements the setlist merge (§11.13); `go/cifra.go`'s
placeholder `Outcome` is replaced and its merge stubs are filled (no
`ErrNotImplemented` path remains). `go/cmd/git-merge-cifra/main.go` is the static
binary with the §11.14 argument/exit/stderr contract. Every `corpus/merge/`
entry passes the **full §11.16 battery** — forward merge, reverse/symmetry,
result-canonical, resolution fixed-point, and the generated unchanged-side checks
— byte for byte. `scripts/gate`'s `go_checks` runs it all (`go vet ./...`, `go
test -p $JOBS ./...`, `go build`) over the cifra.md checkout.

### Tests the task lands with, by level

The `.tji` `Tests:` clause names **unit + corpus + behavior**. Format work's
behaviour/conformance level **is** the corpus; the behavior level here is the
git-driver integration the note calls for; there are no e2e-api or e2e-web levels
(no HTTP endpoint, no screen).

- **unit** (`go test`, [`go/merge_test.go`](../../../../cifra.md/go/merge_test.go))
  — the song merge, **chapter 11 section by section**, ported from
  `reference/tests/test_merge.py` and `test_merge_examples.py` on purpose-written
  songs, grouped by spec subsection as Go subtests (`t.Run`), with the enumerable
  cases as table tests. All byte-level comparisons use the module's `Encode`/
  `Dump`, never `reflect.DeepEqual` on models:
  - *Whole files* (§11.4): the seven-row absence table (each outcome); not-UTF-8
    → a `file` conflict with `unreadable`, the file not rewritten; a marked input
    (base, ours, theirs; and a git-written marker) → a single `unresolved`
    conflict with the right first-marker line and ours left byte for byte (`kept`);
    delete-vs-change → a `file` conflict with `deleted`, no marked text; no base
    → the empty document as base; the fixed case order.
  - *Sequences* (§11.5): the alignment on a crafted base/side pair (LCS and the
    pair-first / drop-before-take tie-break); runs, modifications, and the `touch`
    predicate (adjacent changes do not touch; two insertions at one place do; a
    delete and a change to the same line do); identical changes taken once;
    clusters and spans; settlement with pairing (sections) and without (bodies,
    notes); combine by sort string; keyed-list presence/values/order (a one-side
    reorder kept, two of one stretch combined, order never conflicts).
  - *Values and metadata* (§11.6, §11.7): the value table (x=y; y=a; x=a;
    conflict); the title; properties as a keyed list (value and
    deleted-vs-changed `property` conflicts, merged order); §11.7.2 `reading`
    conflicts for `notation` (naming the symbols that read differently) and for
    `words`, with the property staying in the result until resolved and the text
    laid out in base's dialect while `notation` conflicts.
  - *The chart* (§11.8): units and **masked text** (`Cm[2]` masks to `Cm`; a sung
    line is one unit; a marker-only change is not a line change, but a marker that
    pushes words is); section match/same/equal (a renamed section is the same; a
    renamed-and-edited section changed on the other side is a `sections`
    conflict); headings field by field (`heading` conflict with non-conflicting
    fields merged); bodies put back into parts; §11.8.5 (a repeat group spanning
    lines merges as those lines; a stray mark is reported, not a conflict).
  - *Footnote markers* (§11.9): corresponding keys and the matching procedure
    (greatest count continues a key; a split-off is new; a kept name on a tie);
    re-keying vs renumbering; the variant signature/join/destination/grouping on
    the §11.15 cases — two instruments two markers; a marker renumbered on one
    side; a bar split off and revoiced elsewhere; a bar moved to an existing key;
    keys joined on both sides; one bar moved two ways (→ `voicing` conflict); a
    key of unknown tokens; **the grouping merged three ways** (a move on one side
    kept against an unrelated change on the other); the numbering and its one
    asymmetry inside a conflict region.
  - *Voicings* (§11.10): blocks by tuning-by-sound and variation; a renamed block
    edited on the other side (`variation` conflict when both rename differently;
    `block` conflict on delete-vs-change); tuning spelling never conflicts;
    voicings per variant; **weak absence** (a bar split off takes the other side's
    shape on another instrument; `voicing` conflict only where both chose
    differently); notes and order.
  - *The result and conflicts* (§11.11, §11.12): a clean merge's result is
    canonical and a fixed point; the conflict model and every song kind; the
    marked text's regions (in place of lines vs a whole `sections`/`block`
    region; markers exactly seven chars; no stray blank lines); `ResolveMarked`
    by ours and by theirs each gives a marker-free canonical text; `ConflictsJSON`
    byte-exact against a crafted expected object (member presence/order, run
    arrays, the two-space/non-ASCII/final-newline rules); the §11.12.3 marker-line
    primitive reused from `text.go`.
- **unit** (`go test`,
  [`go/setlist_merge_test.go`](../../../../cifra.md/go/setlist_merge_test.go)) —
  the setlist merge (§11.13) on purpose-written setlists: the entries keyed list;
  items by reference and **occurrence** with the three-step pairing (a song played
  twice; a copy inserted vs changed vs moved; a new copy on each side with one
  occurrence is one item); reorders kept and combined; a song removed on one side
  and changed on the other → an `item` conflict; `text`, `entry` and `notes`
  conflicts; the setlist marked text and the setlist specifics of the JSON
  (`item`/`occurrence`/`after`). Ported from the reference's setlist-merge cases.
- **corpus** (`go test`,
  [`go/internal/corpus/corpus_test.go`](../../../../cifra.md/go/internal/corpus/corpus_test.go)
  via `harness.go`, `TestCorpusConformance`) — **every `corpus/merge/` entry**
  passes the full §11.16 battery, built into `MergeChecks` by this task:
  - `merge/<entry>/1` — **forward**: `MergeOutputs(Merge(base, ours, theirs))`
    equals the entry's stored output files byte for byte, with no extra and no
    missing file (already enumerated, now made to pass).
  - `merge/<entry>/2` — **reverse / symmetry**: merging base, **theirs, ours**
    gives the same `result`/`result.deleted`, or a `conflicts.json` equal to the
    expected with every `ours`/`theirs` member and `"ours"`/`"theirs"` value
    exchanged and a marked text with the two sides of every region exchanged; an
    entry flagged `asymmetric` skips this check (§11.16, §11.9.5).
  - `merge/<entry>/3` — **result canonical**: when the entry has a `result<ext>`,
    `Canonical`/`CanonicalSetlist` of it is itself.
  - `merge/<entry>/4` — **resolution fixed point**: resolving every region of
    `marked<ext>` by ours, and every one by theirs (`ResolveMarked`), gives a text
    with no marker line whose canonical form is a fixed point.
  - `merge/<entry>/perm` — the generated **unchanged-side** checks: for each of
    the entry's readable, marker-free inputs taken as `b` and `x`,
    `Merge(b, x, x)`, `Merge(b, b, x)` and `Merge(b, x, b)` give the canonical
    text of `x` (§11.16, §11.3).

  The 76 forward ids (`merge/<entry>/1`, the only merge ids now in the ledger)
  are **removed** from
  [`go/internal/corpus/expected-failures.json`](../../../../cifra.md/go/internal/corpus/expected-failures.json);
  the new `/2`, `/3`, `/4` and `/perm` ids are **born-passing**, outside the
  ledger (the `/tl` and `/chords` pattern `ReadingChecks` established), so
  `TestCorpusConformance` asserts them green and `TestLedgerNamesNoCheckThatDoesNotExist`
  / `StaleLedgerIds` stay clean. After this task the ledger is `[]` — the whole
  `cifra_go` stream's expected-failure ledger is empty.
- **behavior** (`go test`,
  [`go/cmd/git-merge-cifra/driver_test.go`](../../../../cifra.md/go/cmd/git-merge-cifra/driver_test.go))
  — `git-merge-cifra` **configured as a git merge driver in a throwaway
  repository, merging two branches through the git CLI, clean and conflicted**
  (the `.tji` note). `TestMain` builds the binary once into the test's temp dir;
  each case runs `git` (CLI) in a fresh `t.TempDir()` repo with `git init`, the
  `[merge "cifra"]` driver pointed at the built binary and `*.cifra.md
  merge=cifra` / `*.setlist.md merge=cifra` in `.gitattributes`, commits a base
  purpose-written song, branches, makes a divergent change on each branch, and
  `git merge`s:
  - *clean*: two independent changes (different sections) merge with **exit 0**,
    and the worktree file is the canonical merged text (equal to the matching
    `corpus/merge/` result), with no `<<<<<<<` left and `git status` clean of
    unmerged paths.
  - *conflicted*: two changes to the same line merge with a **non-zero exit**, the
    worktree file holds the **marked text** (`<<<<<<< ours` … `=======` …
    `>>>>>>> theirs`, markers exactly seven chars), and `git status` reports the
    path unmerged; resolving by hand to one side and committing leaves a canonical
    text.
  - *setlist*: the same two cases on a `.setlist.md` file, proving the path-kind
    dispatch (§11.14 chooses setlist by `%P`).
  - *marked input / not-UTF-8*: a branch whose file holds a marker line, and one
    whose file is not UTF-8, each leave the worktree file untouched, exit
    non-zero, and print the expected diagnostic to stderr (no song text).

  This level needs only the **git CLI** (present in the cifra.md checkout and the
  gate environment) and `go build`; it introduces no new dependency and needs no
  compose stack.

The `.tji` `Tests:` clause is sharpened to these files and cases; the corpus
level is **widened** from the forward check to the full §11.16 battery `module`
deferred here; no level the note names is dropped.

### Deferred work

**None registered by this task** — no new WBS leaf, and tests are never deferred.
Two adjacent pieces live elsewhere and are not leaves this task creates:

- The **§11.3 property tests** (generative determinism/symmetry/unchanged-side)
  are not a `cifra_go` leaf: unlike the JS stream, the Go stream's conformance
  (`cifra_go.conformance`) already landed and scopes itself to the canonical
  corpus and the ledger, not the §11.3 generative properties; the per-entry
  corpus battery above (reverse, canonical, resolution, permutation) pins those
  properties per entry, which is what the Go stream claims. The generative port is
  the JS stream's (`cifra_js.conformance`), against `merge_props.py`.
- The **`conflicts.json` JSON Schema** (`schema/conflicts.schema.json`) is
  `format.conflicts_schema`'s (already `complete 100`); §11.12.5 is the normative
  description and this task's `ConflictsJSON` is held to the corpus bytes, not run
  against the schema — consistent with the Go harness not running the reading
  model-schema check either ([`module.md`](module.md), [`conformance.md`](conformance.md)
  §Decisions). Wiring the schema into the Go harness is not scoped; the reference
  and the JS side validate against it.

## Decisions

- **`Merge` returns a real `Outcome`; `MergeOutputs`/`ConflictsJSON`/`ResolveMarked`
  are the seams the harness and the driver use.** The placeholder
  `type Outcome struct { Payload any }` in `go/cifra.go` is replaced with fields
  mirroring the reference dataclass — `result`, `deleted`, `conflicts`, `marked`,
  `kept` with a derived `kind` — and three helpers accompany `Merge`:
  `MergeOutputs(outcome, setlist)` maps it to the corpus file map (mirroring
  `reference/tools/corpus.py:merge_outputs`), `ConflictsJSON(outcome)` writes the
  §11.12.5 JSON (mirroring `merge.py:conflicts_json`), and `ResolveMarked(marked,
  side)` resolves every region by one side (§11.12.4). *Rationale:* the stub the
  `module` task left anticipates this richer `Outcome` (its comment says
  `cifra_go.merge` replaces the placeholder fields); the harness's forward check
  already calls `Merge` then `MergeOutputs`, and the reverse/canonicality/
  resolution checks need the structured `Outcome` and `ResolveMarked`; and the
  driver needs the same `Outcome` to decide exit code and what to write to `%A`.
  *Alternative rejected:* `Merge` returning the file map directly — it would throw
  away the structured conflicts, force the reverse and resolution checks to
  re-parse files the merge just wrote, and diverge from the reference `Outcome`
  the corpus JSON is generated from.

- **Two modules, `merge.go` and `setlist_merge.go`, mirroring the reference and
  the JS twin.** The reference and the JS twin both keep the song merge and the
  setlist merge apart, with the entry point dispatching on the file kind; the Go
  does the same, flat in package `cifra`. *Rationale:* the standing stream rule —
  mirror the reference's file split so a port is a translation, not a redesign
  ([`reader.md`](reader.md), [`setlists.md`](setlists.md), the JS
  [`merge.md`](../cifra_js/merge.md) §Decisions) — and the two engines share only
  the whole-files front matter and the generic sequence/value helpers, which live
  in `merge.go`. *Alternative rejected:* one module holding both — diverges from
  the reference layout the port is matched against and mixes two conflict-kind
  vocabularies.

- **The result and marked text are built and written at the model level.** The
  clean result is assembled as an `*Object`, handed to the writer's §8.3
  invariants, sung re-layout, §8.4 serialiser and `Canonical` (§11.11 steps 1–5);
  the marked text is written with the same §8.4 model serialiser from a model
  keeping every variant of both sides, skipping the invariants (step 2) and
  canonicalising (step 5) (§11.12.2). *Rationale:* the Go writer already
  established that re-derivation (bar numbering, repeat pairing) is a model-level
  operation, not a parser round-trip ([[go-rederive-is-model-level-not-parser-reuse]]),
  so the merge reuses `write.go`'s model-level twins and holds exactly one copy of
  §8.3/§8.4, and the result's canonicality is guaranteed by construction (corpus
  check 3 confirms it). *Alternative rejected:* a merge-local writer, or writing
  the marked text by stitching text fragments — two serialisers to keep
  byte-identical, and the model-level re-derivation the Go writer needs cannot run
  on fragments.

- **The marker-line primitive is reused from `text.go`, not re-implemented.** A
  marked input is detected with `isMarkerLine`/`markers`
  ([`go/text.go`](../../../../cifra.md/go/text.go), landed by `module`), and the
  merge never merges one (§11.4, §11.12.3). *Rationale:* the §11.12.3 marker-line
  rule is one definition the whole implementation shares (the reader reports it,
  the writer refuses it, the merger stops on it); a second copy could drift.
  *Alternative rejected:* a merge-local marker scan — duplicates a corpus-proven
  primitive.

- **`git-merge-cifra` is a standalone `main` under `go/cmd/`, taking `%O %A %B
  %P`.** The binary lives at `go/cmd/git-merge-cifra/` and is built static (no
  cgo) into the git-ignored `go/bin/`; it takes git's four placeholders directly,
  not a `cifra-md merge` subcommand the way the Python reference exposes it.
  *Rationale:* DIRECTION §3.6 calls for *"one static binary … the easiest thing to
  install where there is no runtime to rely on"*, and the §11.14 config line is
  literally `driver = git-merge-cifra %O %A %B %P`; a standalone binary matches
  that line with no wrapper. `go/cmd/<name>/` is the idiomatic home for a binary
  in a library module, and `go/.gitignore` already reserves `/bin/` for built
  output. *Alternative rejected:* a subcommand of a larger CLI (as Python does) —
  there is no other Go CLI in this module to attach to, and the driver's whole job
  is to be the one program git's config names.

- **This task owns the full §11.16 corpus battery and empties the merge ledger.**
  `module` landed `MergeChecks` forward-only and handed the symmetry/canonicality/
  resolution/permutation checks here; `conformance` left the 76 `merge/<entry>/1`
  ids ledgered for this task. This task builds the rest and prunes the ledger to
  `[]`. *Rationale:* the harness comment and `conformance`'s explicit hand-off are
  the authoritative assignment, the `.tji` note's *"every corpus/merge/ entry"*
  scopes it here, and a merge that passed only the forward check could be silently
  asymmetric or leave a non-canonical result — the reverse, canonicality and
  resolution checks are exactly what catch that per entry. *Alternative rejected:*
  leaving some merge checks for a later task — `conformance` is already complete
  and scoped to the reading corpus, so there is no later leaf to take them, and
  splitting an entry's checks would leave this task's forward pass unproven against
  its own symmetry.

- **The §11.3 generative property tests are not in this Go task.** Unlike the JS
  stream, where `cifra_js.conformance` (`depends !merge`) ports `merge_props.py`,
  the Go stream's `cifra_go.conformance` already landed without the generative
  properties and is scoped to the canonical corpus and the ledger. *Rationale:*
  the per-entry corpus battery pins determinism, symmetry and the unchanged-side
  identities for every entry, which is the guarantee the Go stream needs for the
  Merger profile; the generative port adds coverage the corpus does not, but it is
  not a dependant of this task and `cifra_go.conformance` is done. Adding a
  generative suite here would be new scope the `.tji` note does not name.
  *Alternative rejected:* porting `merge_props.py` into this task anyway — it would
  silently widen the note's `Tests:` clause beyond unit + corpus + behavior for no
  WBS-tracked reason, when the corpus already holds the properties per entry.

- **No design delta.** Chapter 11, the Merger profile of §9.1, the git-merge-cifra
  binary of DIRECTION §3.6 and the `corpus/merge/` entries are already normative
  (produced by `format.merge` and settled in DIRECTION); the modules, the binary
  and the harness extension are internal layout and a test convention; no runtime
  dependency is added. *Rationale and alternative* mirror the sibling format
  tasks: a format task that implements the spec as written needs no spec change,
  and the spec moves only when behaviour does. (The spec's own §11 *"Open
  questions"* — finer units for sung lines, sections renamed and edited, the
  §11.9.5 asymmetry, honouring git's labels/marker size — are **format-version**
  deferrals the chapter records for a later version of the format, not WBS work
  and not this implementation's to change.)

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-12.

- cifra.md `b3f961c`: `go/merge.go` — song merge (§11.2–§11.12), `Merge`/`MergeOutputs`/`ConflictsJSON`/`ResolveMarked`/`MarkerLines`, whole-files front matter, generic sequence/alignment/settling, values/metadata, chart with masked text, footnote-marker variants and grouping (§11.9), voicings part with weak absence (§11.10), result finish (§11.11), conflict model and marked text (§11.12)
- cifra.md `b3f961c`: `go/setlist_merge.go` — setlist merge (§11.13): entries, items by reference and occurrence with three-step pairing, notes blocks, setlist conflict kinds
- cifra.md `b3f961c`: `go/cmd/git-merge-cifra/main.go` — static binary (CGO_ENABLED=0) with §11.14 argument/exit/stderr contract (`%O %A %B %P`)
- cifra.md `b3f961c`: `go/cifra.go` — `Outcome` placeholder replaced with real fields; `Merge`/`MergeOutputs` stubs implemented; no `ErrNotImplemented` path remains
- cifra.md `b3f961c`: `go/internal/corpus/harness.go` — `MergeChecks` widened to full §11.16 battery (forward, reverse/symmetry, result-canonical, resolution fixed-point, unchanged-side permutations); `Impl` gains `ResolveMarked`
- cifra.md `b3f961c`: `go/internal/corpus/expected-failures.json` — pruned from 76 `merge/<entry>/1` ids to `[]`; whole `cifra_go` stream ledger now empty
- unit tests: `go/merge_test.go` (§11.4–§11.12 section by section), `go/setlist_merge_test.go` (§11.13 invariants)
- behavior test: `go/cmd/git-merge-cifra/driver_test.go` — git CLI in throwaway repos, clean + conflicted + setlist + marked-input + not-UTF-8
