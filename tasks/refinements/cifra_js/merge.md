# cifra_js.merge — Merge

## TaskJuggler entry

`task merge` in [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) (lines
57–62), under `task cifra_js`, `depends !writer, !setlists, format.merge`. The
area file's header states the stream's rule: *"The app's implementation of the
format, held to the corpus byte for byte. Framework-free: the view is the only
layer that knows React"* ([`tasks/10-cifra-js.tji`](../../10-cifra-js.tji)
lines 3–4).

The `.tji` note: *"cifra.md: chapter 11 — whole files, alignment, chart,
footnote markers with the grouping merged three ways, voicings, setlists, the
conflict model and marked text. Held to corpus/merge/. Tests: unit (alignment,
the chart, footnote markers, voicings, setlists, the conflict model and marked
text, chapter 11 section by section); corpus (every corpus/merge/ entry: merged
text and conflicts.json)."*

## Effort estimate

**8 days** (from the `.tji`) — the largest `cifra_js` leaf, tied with the
reader. It ports two reference modules (`reference/cifra_md/merge.py`, ~1588
lines, and `setlist_merge.py`, ~365 lines) that between them realise every
section of a long chapter — the generic sequence merge, the chart with its
footnote-marker algebra merged three ways, the voicings part, setlists, the
conflict model, the marked text and its JSON — then lands the section-by-section
unit suite and builds the **full §11.16 corpus battery** into the harness (the
reverse/symmetry, canonicality, resolution and unchanged-side checks the
`package` task deferred to this one), turning every `corpus/merge/` entry green.

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, extended by this
task:

- `js/src/` — two new modules mirroring the reference's split (§Decisions):
  - `merge.js` — the merge entry point and the **song** merge. `merge(base,
    ours, theirs, { setlist }) → Outcome`; the §11.2 method (whole files,
    canonicalise, unchanged sides, part-by-part merge, finish); the generic
    §11.5 sequence merge (alignment, changes, clusters, settlement, keyed
    lists); §11.6 values; §11.7 metadata and `reading` conflicts; §11.8 chart;
    §11.9 footnote markers; §11.10 voicings; §11.11 result; §11.12 conflict
    model, marked text and resolution. It also exports the pure helpers the
    corpus and the app need: an `Outcome` the app reads to present conflicts,
    `conflictsJson(outcome)` (§11.12.5), `mergeOutputs(outcome, { setlist })`
    (the corpus file map), and `resolveMarked(text, side)` (§11.12.4).
  - `setlist_merge.js` — the **setlist** merge (§11.13): the keyed-list merge
    of entries, items (reference + occurrence, three-step pairing) and notes
    blocks, and the setlist conflict kinds and marked text. Called by
    `merge.js` when the path is a setlist.
  - `index.js` — the `merge` stub ([lines 116–123](/home/ruoso/devel/cifra.md/js/src/index.js))
    is replaced by the real `merge` (now returning an `Outcome`, §Decisions),
    and `conflictsJson`/`mergeOutputs`/`resolveMarked` are added to the public
    barrel. This is the **last** corpus-facing stub; after it, `index.js` has no
    `NotImplementedError` left.
- `js/test/` — the merge unit suite (`merge.test.js` for §11.2–§11.12,
  `setlist_merge.test.js` for §11.13), ported from the reference's
  `test_merge.py` / `test_merge_examples.py` / `test_setlist_merge` cases; the
  extension of `js/test/corpus/harness.js`'s `mergeChecks` to the full §11.16
  battery; the pruning of the forward-merge ids from the ledger; and a
  planted-mismatch guard in `js/test/harness.test.js` for the new checks.

The corpus beside `js/` is unchanged: this task is a **consumer** of the
already-committed corpus bytes — the Python reference generates and checks
`corpus/merge/` (the entries landed with `format.merge`), and this task touches
nothing under `reference/` or `corpus/`. Agreement is by the corpus, not by
shared code — `merge.js`/`setlist_merge.js` are a **port** of
`reference/cifra_md/merge.py` and `setlist_merge.py`, matched to the reference
and the corpus, never importing, transpiling or shelling out to Python or Go
(DIRECTION §3.6).

No design delta is authored. Chapter 11 and the Merger profile of §9.1 are
already normative, and `format.merge` has produced the spec, the reference and
the merge corpus; the new module split and the harness extension are internal
layout and a test-harness convention (the expected-failure ledger the `package`
task introduced), not a new architectural seam, a new runtime dependency, or a
change to designed behaviour (§Decisions).

## Inherited dependencies

- **`cifra_js.writer` — settled.** Complete (cifra.md `c10ea54`,
  [`cifra_js/writer.md`](./writer.md) Status): `js/src/write.js` delivers
  `write`/`canonical`/`serialize`, the §8.3 footnote invariants I1→I3→I2, the
  §8.4 serialiser, `checkUnmarked`/`MarkedTextError` and `isCanonical`,
  re-exported from `index.js`. The merge **finishes** through this writer: the
  result is built, the invariants applied, every sung line laid out, written and
  canonicalised (§11.11 steps 2–5) with exactly the writer's `canonical`; and
  the marked text is written with the writer's §8.4 serialiser *without* the
  invariants and *without* canonicalising (§11.12.2). The writer's refusal to
  save a marked text (`MarkedTextError`, §11.12.3) is the standing rule this
  task's output honours — the merge never returns a marked text as a saveable
  result.
- **`cifra_js.setlists` — settled.** Complete (cifra.md `c72c24e`,
  [`cifra_js/setlists.md`](./setlists.md) Status): `js/src/setlist.js` delivers
  `parseSetlist`/`writeSetlist`/`canonicalSetlist` and the §10.5/§10.9.2 path
  machinery. The setlist merge (§11.13) canonicalises its inputs with
  `canonicalSetlist`, identifies items by the reference `writePath`/`songPath`
  produce, and writes its result and marked text through `writeSetlist`
  (§11.13: *"a setlist merges as a song does, with less in it"*). The setlist
  **merge** entries (`corpus/merge/24`, `25`, `60`–`68`, which
  [`setlists.md`](./setlists.md) §Inherited dependencies explicitly left to this
  task) are held to this module.
- **`format.merge` — settled** (cifra.md, `05-format.tji` `complete 100`,
  effort 8d, note *"cifra.md: chapter 11, the reference merge, the merge corpus,
  marked inputs, joins and repeated setlist songs, the grouping merged three
  ways"*). No refinement document was written for `format.merge` (it predates
  this directory, like `format.canonical_form`/`sung_layout`/`setlists`), so
  this refinement cites spec **chapter 11**, [`corpus/README.md`](/home/ruoso/devel/cifra.md/corpus/README.md)
  and the reference directly rather than a predecessor refinement. `format.merge`
  produced: the normative spec chapter
  [`spec/11-merge.md`](/home/ruoso/devel/cifra.md/spec/11-merge.md) (2454
  lines); the reference merge (`reference/cifra_md/merge.py`,
  `setlist_merge.py`, `merge_gen.py`, `merge_props.py`); and the `corpus/merge/`
  entries with their expected outputs. These are the behaviour to match and the
  bytes to pass.
- **`cifra_js.reader` — settled** (transitively, through `writer`): cifra.md
  `9eb9a7c`, [`cifra_js/reader.md`](./reader.md). The merge works on the models
  `parse` produces: it reads each present input through `parse`/`parseSetlist`
  before it merges (§11.2 step 2), and the chart's units, sections, chords,
  tunings and voicings it merges are exactly the reader's model shapes.
- **`cifra_js.text_layer` — settled** (transitively): cifra.md `7c2106c`,
  [`cifra_js/text_layer.md`](./text_layer.md). `js/src/text.js` delivers
  `decode`/`prepare`/`isMarkerLine`/`markerLines`/`NotUtf8Error`. The merge's
  whole-files step rests on all of these: an input that is not valid UTF-8 is a
  `file` conflict (`decode`/`NotUtf8Error`, §11.4); an input that holds a
  **marker line** after the text layer (`isMarkerLine`/`markerLines`, §11.12.3)
  is a marked text and gives an `unresolved` conflict, never merged (§11.4).
  This is the module that already holds the §11.12.3 marker-line primitive the
  merge needs — this task writes no second copy.
- **`cifra_js.editing` — settled** (transitively): cifra.md `b1d1f94`,
  [`cifra_js/editing.md`](./editing.md). Not imported — the merge does not
  perform §8.5 editing operations — but it established that `js/src/edit.js`'s
  occurrence/variant model and the writer's §8.3 pass are the shared vocabulary
  for footnote keys and shapes, which §11.9/§11.10 merge.
- **`cifra_js.package` — settled** (transitively): cifra.md `552cf37`,
  [`cifra_js/package.md`](./package.md) — `js/` as a framework-free,
  zero-runtime-dependency ES-module package with the Vitest corpus harness and
  the expected-failure ledger. `package` deliberately landed the **merge
  harness forward-only** — one born-failing check `merge/<name>/1` per
  `corpus/merge/` entry — and handed *"the reverse / symmetry / canonicality /
  resolution / idempotence checks"* to **this task** in a comment on
  `mergeChecks`
  ([`js/test/corpus/harness.js`](/home/ruoso/devel/cifra.md/js/test/corpus/harness.js)
  lines 303–309). `index.js` carries the `merge` stub, documented for this task
  to fill, with a comment (lines 116–120) anticipating *"the richer Outcome and
  the reverse/canonical/resolution checks"*.

Downstream consumers:

- **`cifra_js.conformance`** (`depends !writer, !setlists, !merge`) ports the
  §11.3 **property tests** (the generative determinism/symmetry/unchanged-side
  properties), claims the **Merger profile** of §9.1, and drives the ledger to
  empty across *all* corpora. The fixed `corpus/merge/` entries pass here, in
  `merge`; the generative properties and the profile claim are conformance's.
- **The app's Worker** (DIRECTION §3.1–3.2, §3.7) runs `merge` to sync a book,
  merge an upload and bring in a fork's changes, reading the `Outcome` to
  present each conflict one at a time with *keep mine* / *take theirs* / *edit*
  (§11.12.4) and calling `resolveMarked` for the first two. Wiring `merge` as
  isomorphic-git's merge-driver callback in the Worker is the **sync/storage**
  stream's, not this task's (§Deferred work).
- **The git merge driver** `git-merge-cifra` (§11.14), the computer-side binary
  that runs `merge` for a book over HTTP, is a **Go** concern (the `cifra_go`
  and `hook` streams), written against the same chapter and held to the same
  corpus — not this JavaScript task (§Deferred work).

## What this task is

This task implements the **three-way merge** — the last operation the format
defines, and the one that lets two people change copies of one song and have
their changes brought together (§11 preamble;
[`spec/11-merge.md`](/home/ruoso/devel/cifra.md/spec/11-merge.md) lines 1–33).
A plain line merge is wrong for a song, because a song's text is only partly the
author's lines: its voicings are a structure, its footnote markers are names
that canonicalising renumbers, and a sung line is laid out from what it means.
So the merge works **on meaning where the format has structure, and by lines
where the text is the author's** — the chart merges line by line with footnote
markers merged separately as the arrangement decisions they are; the voicings
merge per tuning, then variation, then key; properties and the title merge per
value. What genuinely collides is a **conflict**, shown both in musical terms
(the `Outcome`) and as a **marked text** carrying git-style conflict markers for
whoever prefers to edit. Like the canonical form (§8), the merge is **defined to
the byte and deterministic**: the JavaScript merge on a device and a Go git
merge driver on a computer produce the same result, or the same conflicts and
the same marked text, and the corpus holds them to it (§11.16).

Concretely it adds two modules, re-exported from `js/src/index.js`:

- `js/src/merge.js` — the entry point `merge(base, ours, theirs, { setlist })`
  and the song merge, porting `reference/cifra_md/merge.py`. Each of `base`,
  `ours`, `theirs` is **bytes or `null`** (absent); `{ setlist }` says which
  file kind (the caller knows it from the path). It returns an **`Outcome`**
  (§Decisions): `{ result, deleted, conflicts, marked, kept }` with the kinds
  §11.12 defines. Alongside it:
  - `conflictsJson(outcome) → string` — the §11.12.5 JSON (two-space indent,
    non-ASCII as itself, final newline), mirroring `merge.py:conflicts_json`.
  - `mergeOutputs(outcome, { setlist }) → Map<name, bytes>` — the corpus file
    map (`result<ext>` / `result.deleted` / `conflicts.json` / `marked<ext>`),
    mirroring `reference/tools/corpus.py:merge_outputs`; the seam the corpus
    harness compares byte for byte.
  - `resolveMarked(markedText, side) → text` — resolution by one side
    (§11.12.4): replace each region by `"ours"` or `"theirs"`, used by the app
    for *keep mine* / *take theirs* and by the corpus's resolution check.
- `js/src/setlist_merge.js` — the setlist merge (§11.13), porting
  `reference/cifra_md/setlist_merge.py`, called by `merge.js` on a
  `.setlist.md` path.

### What the merge covers, section by section

The `.tji` note names the pieces; chapter 11 is their normative definition
(cited in §Inputs). The merge comprises:

- **The method** (§11.2): whole files (§11.4), then canonicalise each present
  input, then the unchanged-side short-circuits, then the part-by-part merge,
  then finish (write + canonicalise, or produce conflicts + marked text).
- **Whole files** (§11.4): the seven-row absence table; not-UTF-8 → a `file`
  conflict (file left unrewritten); a **marked input** → a single `unresolved`
  conflict naming each marked side with its first marker line, ours left byte
  for byte as it is; delete-vs-change → a `file` conflict with no marked text;
  the empty document as the base when there is none. The fixed case order:
  not-UTF-8, then deleted-on-both, then marked input, then the rest.
- **The generic sequence merge** (§11.5): the deterministic LCS **alignment**
  (§11.5.1), **changes**/runs/modifications and when two changes **touch**
  (§11.5.2), **clusters** and the merged sequence (§11.5.3), **settling** a
  cluster by the conflict policy (with or without pairing) or by combining
  (§11.5.4), and **keyed lists** — presence, values, order (§11.5.5). Used for
  sections, section bodies, block notes, and (combine-only) for every keyed
  list.
- **Values** (§11.6) and **metadata** (§11.7): the three-way value merge; the
  title and the keyed-list of properties; and §11.7.2's `reading` conflicts,
  where one side changes `notation` or `words` under music the other side wrote.
- **The chart** (§11.8): units and their **masked text** (a chord's symbol in
  place of its key, so `Cm[2]` masks to `Cm`); section match/same/equal;
  headings field by field; bodies put back into parts; what the merged text
  decides when read (repeat groups, bar numbers, sung-ness — not merged).
- **Footnote markers merged three ways** (§11.9): the heart of the task.
  Decisions are identified by the occurrences that carry them, not by marker
  names; corresponding keys and the matching procedure (§11.9.2); re-keyed
  occurrences (§11.9.3); **variants** with their signatures, joins,
  destinations and groupings so *a change to the grouping survives* (§11.9.4);
  and the fresh numbering with its single documented asymmetry (§11.9.5).
- **The voicings part** (§11.10): blocks by tuning-by-sound and variation, with
  renames; tuning spellings (a value that never conflicts); voicings per variant
  and block, with **weak absence**; and the notes and order.
- **The result** (§11.11) and **conflicts** (§11.12): building and
  canonicalising the clean result; the conflict model, the marked text, the
  marker-line primitive, resolution, and the JSON.
- **Setlists** (§11.13): the same shape with less in it — entries, items by
  reference and occurrence with the three-step pairing, notes blocks, and the
  setlist conflict kinds.

## Why it needs to be done

Merge is what makes a book a shared, offline-first thing. The app syncs a book,
merges an upload, and brings in the changes of a book it was forked from
(DIRECTION §3.1–3.3; §11.1 lines 35–69); every one of those is a three-way
merge of a song or a setlist. Nothing the user does waits on the network, so the
Worker merges on the device when the network returns (DIRECTION §3.1–3.2,
*offline first*), and a computer that holds a book merges the same way through a
git merge driver (§11.14) — the two must agree to the byte, which is exactly
what being *defined to the byte and held to the corpus* (§11.3, §11.16)
guarantees. Reading the `Outcome` is how the conflict UI shows a stretch of
chart with each side's bars, a shape for one chord in one tuning with each side's
diagram, a property with each side's value; writing the marked text is what the
*edit* choice opens. This is the **Merger profile** of §9.1 — *"a writer that
merges three versions of a song"* — which `cifra_js.conformance` claims once
this task makes every merge entry pass.

That is why this task `depends !writer, !setlists, format.merge`: the merge
*finishes* through the §8 writer, merges setlists through the §10 setlist layer,
and is held to the corpus and the reference `format.merge` produced. Downstream,
`cifra_js.conformance` ports the §11.3 property tests and claims the profile, and
the app's Worker and conflict UI run `merge` and read its `Outcome` once the
storage/sync/app streams exist.

## Inputs / context

- [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 3–4 (stream header),
  57–62 (`task merge`, its `depends !writer, !setlists, format.merge`, the
  `note` and its `Tests:` clause: unit + corpus).
- [`cifra_js/writer.md`](./writer.md), [`cifra_js/setlists.md`](./setlists.md),
  [`cifra_js/reader.md`](./reader.md), [`cifra_js/text_layer.md`](./text_layer.md),
  [`cifra_js/editing.md`](./editing.md) and [`cifra_js/package.md`](./package.md)
  — the predecessors: the writer's `write`/`canonical`/`MarkedTextError`/
  `isCanonical`; the setlist layer's `parseSetlist`/`writeSetlist`/
  `canonicalSetlist`/`songPath`/`writePath`; the reader's model shapes; the
  text layer's `decode`/`isMarkerLine`/`markerLines`/`NotUtf8Error`; the
  harness shape (`discover`/`dump`/`compareBytes`/`compareModelBytes`/
  `staleLedgerIds`; checks are `{ id, run }`), the expected-failure ledger
  convention (listed → asserted to fail, unlisted → asserted to pass, executed
  either way; a stale id fails the harness), the zero-runtime-dependency rule,
  the *"compare bytes, never deep-equal"* rule, the born-passing-check pattern
  (checks outside the ledger), the plain-object-model-with-pinned-key-order
  rule, and the "corpus-facing operations are stubs until their task" seam.
- **Specification (normative) —
  [`spec/11-merge.md`](/home/ruoso/devel/cifra.md/spec/11-merge.md):**
  - Preamble lines 1–33 — scope (an app that syncs/merges-an-upload/merges-a-
    fork, and a git merge driver; a pure reader/writer needs none of it); base /
    ours / theirs; *"the merge works on meaning where the format has structure,
    and by lines where the text is the author's"*; *"Like the canonical form
    (§8), the merge is defined to the byte"* and deterministic (lines 27–33).
  - §11.1 lines 35–69 — what is merged: the three inputs, any **absent**; the
    **outcome** (result / deleted / conflicts [+ marked]); file kind by name
    (`*.setlist.md` → setlist, else song); non-song/setlist files not merged
    here; the real-world cases table.
  - §11.2 lines 71–110 — the five-step method, and the table *"What each part of
    a song is merged as"* (title, properties, sections, heading, body, footnote
    markers, voicing blocks, voicings, block notes — what identifies each
    element and when it conflicts).
  - §11.3 lines 112–158 — the normative properties: deterministic; depends on
    canonical forms only; result canonical; **unchanged sides change nothing**;
    **symmetric** (with the §11.9.5 exception); **a change to the grouping
    survives**; independent changes do not conflict; the one far-reaching change
    (sung vs not). (The generative *tests* of these are `cifra_js.conformance`'s;
    the merge must *have* the properties, and the corpus's reverse/unchanged-side
    checks pin them per entry.)
  - §11.4 lines 160–218 — whole files: the seven-row table; no base; deleted-vs-
    changed; not-UTF-8; **marked inputs** (`unresolved`, ours untouched); the
    fixed case order; not-canonical inputs canonicalised first.
  - §11.5 lines 220–383 — sequences: §11.5.1 alignment (lines 234–260), §11.5.2
    changes/touch/identical (262–295), §11.5.3 the merged sequence/clusters
    (297–321), §11.5.4 settling a cluster — conflict (with/without pairing) and
    combine (322–347), §11.5.5 keyed lists — presence/values/order (349–383).
  - §11.6 lines 385–395 — values. §11.7 lines 397–443 — §11.7.1 title and
    properties (399–409), §11.7.2 `reading` conflicts for `notation`/`words`
    (411–443).
  - §11.8 lines 445–561 — §11.8.1 units and masked text (447–493), §11.8.2
    sections (495–525), §11.8.3 headings (526–530), §11.8.4 bodies (532–544),
    §11.8.5 what the merged text decides (546–561).
  - §11.9 lines 562–784 — §11.9.1 why names are not enough (564–578), §11.9.2
    corresponding keys and the matching procedure (580–613), §11.9.3 re-keyed
    occurrences (615–631), §11.9.4 **variants**: signature, joined, destination,
    moved / moved-in-place / reshaped, grouping, continues (632–753), §11.9.5
    numbering and the one asymmetry (754–784).
  - §11.10 lines 786–897 — §11.10.1 blocks and renames (788–818), §11.10.2
    tuning spellings (820–829), §11.10.3 voicings and **weak absence**
    (831–885), §11.10.4 notes and order (887–897).
  - §11.11 lines 899–921 — building and canonicalising the clean result (steps
    1–5: invariants I1→I3→I2, sung re-layout, write, canonicalise).
  - §11.12 lines 923–1110 — §11.12.1 the conflict model and kinds (925–977),
    §11.12.2 the marked text and its region table (978–1033), §11.12.3 marker
    lines (1035–1056), §11.12.4 resolving (1058–1076), §11.12.5 **as JSON**, the
    member table and ordering (1078–1110).
  - §11.13 lines 1112–1219 — setlists: entries, items (reference + occurrence,
    three-step pairing), notes blocks, conflict kinds, marked text, JSON.
  - §11.14 lines 1221–1269 — the git merge driver (a **Go** concern, out of
    scope; cited so the JS merge produces exactly the Outcome the driver maps to
    `%A`/exit codes).
  - §11.15 lines 1271–2340 — the 22 worked examples the corpus mirrors.
  - §11.16 lines 2341–2397 — **corpus entries**: the file layout; the four
    self-validation checks (forward byte-exact; reverse/symmetry with sides
    exchanged, `asymmetric` skipping it; result canonical; resolution fixed
    point); the generated unchanged-side checks (`merge(b,x,x)`,
    `merge(b,b,x)`, `merge(b,x,b)` give `c(x)`); the coverage list.
- [`spec/9-conformance.md`](/home/ruoso/devel/cifra.md/spec/9-conformance.md)
  lines 68–77 — the **Merger** profile: *"A writer that merges three versions of
  a song (§11)"*; must meet §11 for songs and §5 to the extent §11.7.2 needs the
  chord model; MUST give the same result/conflicts/marked text as any conforming
  merger and MUST refuse to save a marked text (§11.12.3); a merger that is also
  a setlist writer merges setlists as §11.13 says; *"Full does not include
  Merger"* (line 77). §9.2 lines 109–125 (universal reader rules); §9.3 lines
  128–137 (the merge corpus; a merger SHOULD pass every entry as §11.16 says).
  **The profile claim is `cifra_js.conformance`'s**, built on this task.
- [`corpus/README.md`](/home/ruoso/devel/cifra.md/corpus/README.md) lines
  104–181 — the **merge entries**: the files (`base`/`ours`/`theirs`, one of
  `result`/`result.deleted`/`conflicts.json`, `marked` when a region exists,
  `asymmetric`); and the merge checks, which this task builds into the JS
  harness.
- **Reference, the behaviour to match** (port, never import —
  `/home/ruoso/devel/cifra.md/reference/`):
  - `reference/cifra_md/merge.py` — `merge(base, ours, theirs, setlist=False) →
    Outcome` (line 408, the entry point: decode, absent/deleted, marked →
    `unresolved`, equal-sides short-circuits, canonicalise, dispatch);
    `@dataclass Outcome` (line 48: `result`/`deleted`/`conflicts`/`marked`/
    `kept`, property `kind`); `class SongMerge(b, o, t).run()` (line 643, the
    song engine); and the supporting machinery `merge_value`, `merge_sequence`,
    `align`, `Change`, `combine`, `keyed_order`, `Unit`/`units_of`,
    `Sec`/`sec_match`/`sec_equal`, `Version`, `KeyMatch`, `region`,
    `finish_marked`, `Marker`; `conflicts_json(outcome)` (line 364) and
    `conflict_json(c)` (line 360) — the §11.12.5 serialiser.
  - `reference/cifra_md/setlist_merge.py` — `merge_setlists(b, o, t) → Outcome`
    (line 364), `class SetlistMerge` (line 177), `class EntryMerge`, and the
    id/body helpers `entry_ids`, `body_ids`, `side_body_ids`, `reference`,
    `with_notes`.
  - `reference/tools/corpus.py` — `merge_outputs(outcome, ext)` (line 78),
    `merge_inputs(entry)` (69), `extension(entry)` (64): the map from an
    `Outcome` to the corpus file set, which `mergeOutputs` mirrors.
  - `reference/tests/test_merge.py`, `test_merge_examples.py`, and the
    setlist-merge cases — the unit cases to port (the §11.15 example texts and
    the section-by-section behaviour). `reference/cifra_md/merge_props.py` and
    `test_merge_properties.py` are the §11.3 **property** tests — noted so the
    boundary is clear: they are `cifra_js.conformance`'s to port, not this
    task's.
- **Corpus (the bytes this task is held to) —
  `/home/ruoso/devel/cifra.md/corpus/merge/`:** one directory per entry,
  covering the §11.15 examples and the alternatives their text describes, every
  row of §11.4, a non-UTF-8 file, marked base/ours/theirs (and
  git-written markers, `28-marked-theirs-by-git`), every song conflict kind of
  §11.12.1 and setlist kind of §11.13, the footnote-marker join/revoice/move
  cases of §11.9 (including `59-numbering-inside-a-conflict`, flagged
  `asymmetric`), non-canonical inputs, and the setlist cases (two reorders, a
  song added twice, a notes block changed on both sides, a copy removed on one
  side and changed on the other). Each holds `base`/`ours`/`theirs` (`.cifra.md`
  or `.setlist.md`; a missing file is absent) and exactly one of
  `result<ext>` / `result.deleted` / `conflicts.json`, with `marked<ext>` when a
  conflict has a region, and `asymmetric` where §11.9.5's exception applies.
- **Harness (what this task extends) — `/home/ruoso/devel/cifra.md/js/`:**
  - [`js/test/corpus/harness.js`](/home/ruoso/devel/cifra.md/js/test/corpus/harness.js)
    — `discover` (lines 52–75, already lists `corpus/merge/` subdirs as merge
    entries); `mergeExtension` (35), `mergeOutputNames` (29), `mergeInputs`
    (296–301, reads `base`/`ours`/`theirs` as bytes, `null` when absent);
    `mergeChecks` (303–346) — today one forward check `merge/<name>/1` calling
    `impl.merge(...)` and comparing the returned file map byte for byte, with
    the comment (303–309) assigning *"the reverse / symmetry / canonicality /
    resolution / idempotence checks"* to this task.
  - `js/test/corpus.test.js` — loads `expected-failures.json`, guards it with
    `staleLedgerIds`, asserts each check fail/pass per the ledger.
  - `js/test/corpus/expected-failures.json` — currently lists one id
    `merge/<name>/1` per merge entry (the only expected failures left; every
    reading/setlist entry already passes). This task **removes** those ids.
  - `js/test/harness.test.js` — the planted-mismatch guard that proves a check
    is not vacuously green; extended for the new merge checks.
  - [`js/src/index.js`](/home/ruoso/devel/cifra.md/js/src/index.js) lines
    116–123 — the `merge` stub this task flips.

## Constraints / requirements

- **Deterministic and defined to the byte** (§11.3). The merge's output depends
  only on the three texts and the file kind — not on the program, machine, time,
  or visit order beyond what the chapter fixes. Two mergers produce the same
  bytes; so the JS merge and the Go git driver agree. Every tie-break the
  chapter fixes is honoured exactly: the alignment walk (pair whenever possible;
  between dropping and taking, drop first — §11.5.1); combining by sort string
  (code point, prefix first — §11.5.4); the corresponding-keys matching order
  (greatest count, then same-index, then least base index, then least side
  index — §11.9.2); the variant numbering (signature key indices descending as
  lists, then first occurrence in the merged chart, ours's side first inside a
  region — §11.9.5). No `Map`/`Set` iteration order or object-key order is
  relied on where the spec fixes an order; order is computed, not inherited.
- **Depends on canonical forms only; the result is canonical** (§11.2 step 2,
  §11.3, §11.11). Each present input is read and canonicalised before anything is
  compared (`canonical`/`canonicalSetlist`); an absent base is the empty
  document. The clean result is **finished through the writer** — the merged
  model, footnote invariants I1→I3→I2, every sung line laid out, written as §8.4,
  then canonicalised (§11.11 steps 1–5) — so the result is canonical and a fixed
  point by construction, not by a second code path. The unchanged-side
  short-circuits (§11.2 step 3) compare canonical texts.
- **The marked text is written without the invariants and without
  canonicalising** (§11.12.2). It is written from a merged model that keeps
  every variant of both sides, with the writer's §8.4 serialiser but *not*
  §11.11 step 2 (invariants) or step 5 (canonicalise). Its markers are exactly
  seven characters with the labels `ours`/`theirs`; the region rules (no blank
  line directly inside a region's markers; a `chart` region inside a part only
  when both runs are lines of one part, otherwise the whole section becomes one
  `sections` region; fence handling across regions) are honoured so it matches
  the corpus byte for byte.
- **A marked input is never merged** (§11.4, §11.12.3). A present input that
  holds a marker line after the text layer gives a single `unresolved` conflict
  naming each marked input with the 1-based line number of its first marker
  line; **ours stays exactly as it is, byte for byte** (or stays absent), with
  no result and no marked text. The merge detects this with
  `isMarkerLine`/`markerLines` from `text.js` (not a second copy), in the fixed
  case order (not-UTF-8, deleted-on-both, marked, then the rest). A not-UTF-8
  input is a `file` conflict and the file is **not rewritten**.
- **The conflict model and its JSON are produced exactly as §11.12 says.** The
  `Outcome` carries the conflicts in the order of their regions in the marked
  text (a `file`/`unresolved` conflict being the only conflict of its merge);
  `conflictsJson` writes the §11.12.5 object with each member present under its
  rule and in the fixed order, strings and run-arrays as specified, two-space
  indent, non-ASCII as itself, final newline. A run is written in the result's
  keys, a base run as base has it (§11.12.1, §11.9.5).
- **Footnote markers merged three ways, grouping-preserving** (§11.9). Decisions
  are identified by the occurrences that carry them, never by marker names;
  corresponding occurrences, the matching procedure, re-keying, signatures,
  joins, destinations and groupings are implemented so that *a change to the
  grouping survives*, *independent arrangements do not conflict*, *what base told
  apart and no side moved stays apart*, and the single documented numbering
  asymmetry (§11.9.5) is the only departure from symmetry. Voicings merge per
  variant with **weak absence** (§11.10.3), so a bar split off for one
  instrument takes the shape the other side chose on another.
- **Setlists merge as songs with less** (§11.13). Inputs canonicalised with
  `canonicalSetlist`; entries, items (by reference from `writePath`/`songPath`
  and occurrence, three-step pairing) and notes blocks as keyed lists; the
  setlist conflict kinds (`title`, `property`, `item`, `text`, `entry`, `notes`,
  plus `file`/`unresolved`); the result and marked text written with
  `writeSetlist`.
- **Framework-free, zero runtime dependencies** (DIRECTION §3.7; stream header;
  [`package.md`](./package.md)). `merge.js` and `setlist_merge.js` import only
  other `js/src/` modules (`parse`/`write`/`canonical`/`isMarkerLine`/…) and
  language built-ins; no Node built-in in `src`, no `dependencies` entry added.
  They know nothing of React, git, isomorphic-git, storage or the network — the
  merge is a pure function of three byte strings. Node built-ins and
  isomorphic-git appear only in `js/test/` and, later, the Worker.
- **Agreement is by the corpus, not shared code** (DIRECTION §3.6). The two
  modules are a **port** of `merge.py`/`setlist_merge.py`, mirroring the
  reference's file split; they import, transpile or shell out to no Python or
  Go. The Go git merge driver (§11.14) is a separate implementation written
  against the same chapter and the same corpus, never a copy of this one.
- **Standing rules scoped where they apply:** *Canonical form over preserving
  content* — the merge's clean result is always canonical (§11.11), and a
  **marked text is never canonical, never a saveable result**: the merge returns
  it only as `marked` for the *edit* path, and the writer refuses to save one
  (`MarkedTextError`, §11.12.3); the merge preserves no non-canonical spelling,
  since it works on canonical forms only. *Test fixtures are purpose-written* —
  the unit tests use tiny invented songs and setlists, and the purpose-written
  `corpus/merge/` entries, never anyone's copyrighted words or real song files.
  *No song text in logs*, *offline first*, *accessibility* and *no book without
  an account* do not apply to the module itself — it is a pure format function
  with no UI, network, storage or logging (noted so the omission is deliberate);
  *offline first* is the reason it exists as a pure device-side function, honoured
  by the Worker that calls it, not by this module.

## Acceptance criteria

**Behaviour delivered.** `js/src/merge.js` implements `merge(base, ours,
theirs, { setlist }) → Outcome` and the song merge (§11.2–§11.12), with
`conflictsJson` (§11.12.5), `mergeOutputs` (the corpus file map) and
`resolveMarked` (§11.12.4); `js/src/setlist_merge.js` implements the setlist
merge (§11.13); both are re-exported from `js/src/index.js`, flipping the
`merge` stub (the last `NotImplementedError` in the barrel). Every
`corpus/merge/` entry passes the **full §11.16 battery** — forward merge,
reverse/symmetry, result-canonical, resolution fixed-point, and the generated
unchanged-side checks — byte for byte. `scripts/gate cifra.md` runs it all via
`npm test` in `js/`, alongside the reference's unchanged `pytest`.

**Tests the task lands with, by level** (the `.tji` `Tests:` clause names unit +
corpus; format work's conformance level **is** the corpus — there are no
behavior, e2e-api or e2e-web levels):

- **unit (Vitest, `js/test/merge.test.js`)** — the song merge, **chapter 11
  section by section**, ported from `reference/tests/test_merge.py` and
  `test_merge_examples.py` on purpose-written songs:
  - *Whole files* (§11.4): the seven-row absence table (each outcome); not-UTF-8
    → a `file` conflict with `unreadable`, the file not rewritten; a marked
    input (base, ours, theirs; and a git-written marker) → a single `unresolved`
    conflict with the right first-marker line and ours left byte for byte;
    delete-vs-change → a `file` conflict with `deleted`, no marked text; no base
    → the empty document as base; the fixed case order.
  - *Sequences* (§11.5): the alignment on a crafted base/side pair (LCS and the
    pair-first / drop-before-take tie-break); runs, modifications, and the
    `touch` predicate (adjacent changes do not touch; two insertions at one
    place do; a delete and a change to the same line do); identical changes
    taken once; clusters and spans; settlement with pairing (sections) and
    without (bodies, notes); combine by sort string; keyed-list
    presence/values/order (a one-side reorder kept, two of one stretch combined,
    order never conflicts).
  - *Values and metadata* (§11.6, §11.7): the value table (x=y; y=a; x=a;
    conflict); the title; properties as a keyed list (value and
    deleted-vs-changed `property` conflicts, merged order); §11.7.2 `reading`
    conflicts for `notation` (naming the symbols that read differently) and for
    `words`, including that the property stays in the result until resolved and
    the text is laid out in base's dialect while `notation` conflicts.
  - *The chart* (§11.8): units and **masked text** (`Cm[2]` masks to `Cm`; a
    sung line is one unit; a marker-only change is not a line change, but a
    marker that pushes words is); section match/same/equal (a renamed section is
    the same; a renamed-and-edited section on one side changed on the other is a
    `sections` conflict); headings field by field (`heading` conflict with
    non-conflicting fields merged); bodies put back into parts; §11.8.5 (a
    repeat group spanning lines merges as those lines; a stray mark is reported,
    not a conflict).
  - *Footnote markers* (§11.9): corresponding keys and the matching procedure
    (greatest count continues a key; a split-off is new; a kept name on a tie);
    re-keying vs renumbering; the variant signature/join/destination/grouping on
    the §11.15 cases — two instruments two markers; a marker renumbered on one
    side; a bar split off and revoiced elsewhere; a bar moved to an existing
    key; keys joined on both sides; one bar moved two ways (→ `voicing`
    conflict); a key of unknown tokens; **the grouping merged three ways** (a
    move on one side kept against an unrelated change on the other); the
    numbering and its one asymmetry inside a conflict region.
  - *Voicings* (§11.10): blocks by tuning-by-sound and variation; a renamed
    block edited on the other side (`variation` conflict when both rename
    differently; `block` conflict on delete-vs-change); tuning spelling never
    conflicts; voicings per variant; **weak absence** (a bar split off takes the
    other side's shape on another instrument; `voicing` conflict only where both
    chose differently); notes and order.
  - *The result and conflicts* (§11.11, §11.12): a clean merge's result is
    canonical and a fixed point; the conflict model and every song kind; the
    marked text's regions (in place of lines vs a whole `sections`/`block`
    region; markers exactly seven chars; no stray blank lines); `resolveMarked`
    by ours and by theirs each gives a marker-free canonical text;
    `conflictsJson` byte-exact against a crafted expected object (member
    presence/order, run arrays, the two-space/non-ASCII/final-newline rules);
    the §11.12.3 marker-line primitive reused from `text.js`.
- **unit (Vitest, `js/test/setlist_merge.test.js`)** — the setlist merge
  (§11.13) on purpose-written setlists: the entries keyed list; items by
  reference and **occurrence** with the three-step pairing (a song played twice;
  a copy inserted vs changed vs moved; a new copy on each side with one
  occurrence is one item); reorders kept and combined; a song removed on one
  side and changed on the other → an `item` conflict; `text`, `entry` and
  `notes` conflicts; the setlist marked text and the setlist specifics of the
  JSON (`item`/`occurrence`/`after`). Ported from the reference's setlist-merge
  cases.
- **corpus (Vitest, `js/test/corpus.test.js` via `js/test/corpus/harness.js`)**
  — **every `corpus/merge/` entry** passes the full §11.16 battery, built into
  `mergeChecks` by this task:
  - `merge/<name>/1` — **forward**: `mergeOutputs(merge(base, ours, theirs))`
    equals the entry's stored output files byte for byte, with no extra and no
    missing file (the `.tji` note's *"merged text and conflicts.json"*; already
    enumerated, now made to pass).
  - `merge/<name>/2` — **reverse / symmetry**: merging base, **theirs, ours**
    gives the same `result`/`result.deleted`, or a `conflicts.json` equal to the
    expected with every `ours`/`theirs` member and `"ours"`/`"theirs"` value
    exchanged and a marked text with the two sides of every region exchanged; an
    entry flagged `asymmetric` skips this check (§11.16, §11.9.5).
  - `merge/<name>/3` — **result canonical**: when the entry has a
    `result<ext>`, `canonical`/`canonicalSetlist` of it is itself.
  - `merge/<name>/4` — **resolution fixed point**: resolving every region of
    `marked<ext>` by ours, and every one by theirs (`resolveMarked`), gives a
    text with no marker line whose canonical form is a fixed point.
  - `merge/<name>/perm` — the generated **unchanged-side** checks: for each of
    the entry's readable, marker-free inputs taken as `b` and `x`,
    `merge(b, x, x)`, `merge(b, b, x)` and `merge(b, x, b)` give the canonical
    text of `x` (§11.16, §11.3).

  The forward ids (`merge/<name>/1`, one per entry — the only merge ids now in
  the ledger) are **removed** from `js/test/corpus/expected-failures.json`; the
  new `/2`, `/3`, `/4` and `/perm` ids are **born-passing**, added outside the
  ledger (the pattern `/tl` and `/chords` established), so `checkIds` finds them
  and `staleLedgerIds` stays clean, leaving the merge corpus with **no expected
  failure** — exactly what `cifra_js.conformance` needs for an empty ledger.
  `js/test/harness.test.js` gains a planted-mismatch case for the new merge
  checks, proving none is vacuously green.

The `.tji` `Tests:` clause is sharpened to these files and cases, and the corpus
level is **widened** from the forward check to the full §11.16 battery the
`package` task deferred to this one (`mergeChecks` comment, lines 303–309); no
level the note names is dropped.

**Deferred work.** None registered by this task — no new WBS leaf, and tests are
never deferred. Three adjacent pieces live in other, already-planned places and
are **not** new leaves this task creates:

- The **git merge driver** `git-merge-cifra` (§11.14) is a **Go** binary built
  against the same chapter and held to the same corpus — the `cifra_go` / `hook`
  streams, not this JavaScript task.
- Wiring `merge` as **isomorphic-git's merge-driver callback** in the Worker,
  and the conflict UI that reads the `Outcome` and offers *keep mine* / *take
  theirs* / *edit*, are the **storage/sync/app** streams (DIRECTION §3.1–3.2,
  §3.7); they consume the `Outcome`, `resolveMarked` and `mergeOutputs` this
  task delivers.
- The **§11.3 property tests** (generative determinism/symmetry/unchanged-side)
  and the **Merger profile** claim are `cifra_js.conformance` (`depends
  !merge`), an existing leaf; `reference/cifra_md/merge_props.py` is their port
  source. The **`conflicts.json` JSON Schema** is `format.conflicts_schema`
  (`depends !merge`, in `05-format.tji`), also an existing leaf; §11.12.5 is
  normative until it lands, and this task's `conflictsJson` is held to the
  corpus bytes, not to a schema.

## Decisions

- **`merge` returns an `Outcome`; a pure mapper produces the corpus files.** The
  public `merge(base, ours, theirs, { setlist })` returns a plain-object
  `Outcome` mirroring the reference dataclass — `{ result, deleted, conflicts,
  marked, kept }` with a derived `kind` — and two pure helpers accompany it:
  `mergeOutputs(outcome, { setlist })` maps it to the corpus file map (mirroring
  `reference/tools/corpus.py:merge_outputs`), and `conflictsJson(outcome)`
  writes the §11.12.5 JSON (mirroring `merge.py:conflicts_json`). The harness's
  `mergeChecks` is updated to call `impl.merge` then `impl.mergeOutputs` for the
  forward byte comparison, and to use the `Outcome` and `marked` directly for
  the reverse, canonicality and resolution checks. *Rationale:* the `Outcome` is
  what the app's conflict UI reads to present conflicts one at a time (§11.12.1,
  §11.12.4), and it is the reference's own shape, so the JS mirrors it; the stub
  the `package` task left already anticipates this richer contract
  ([`index.js`](/home/ruoso/devel/cifra.md/js/src/index.js) lines 118–120).
  *Alternative rejected:* `merge` returning the file map directly (the stub's
  interim contract) — it would throw away the structured conflicts the app
  needs, force the reverse/symmetry and resolution checks to re-parse files the
  merge just wrote, and diverge from the reference's `Outcome` the corpus JSON
  is generated from.

- **Two modules, `merge.js` and `setlist_merge.js`, mirroring the reference
  split.** The reference keeps the song merge (`merge.py`) and the setlist merge
  (`setlist_merge.py`) apart, with `merge()` dispatching on the file kind; the
  JS does the same. *Rationale:* the standing stream rule — mirror the
  reference's file split so a port is a translation, not a redesign
  ([`reader.md`](./reader.md), [`setlists.md`](./setlists.md) §Decisions) — and
  the two engines share only the whole-files front matter and the generic
  sequence/value helpers, which live in `merge.js` and `setlist_merge.js`
  imports. *Alternative rejected:* one `merge.js` holding both — a single large
  module that diverges from the reference layout the port is matched against and
  mixes two conflict-kind vocabularies.

- **This task owns the full §11.16 corpus battery, not only the forward
  check.** The `package` task landed `mergeChecks` forward-only and its comment
  (lines 303–309) hands *"the reverse / symmetry / canonicality / resolution /
  idempotence checks"* to `cifra_js.merge`; this task builds them. *Rationale:*
  the harness comment is the authoritative hand-off, and the `.tji` note's
  *"every corpus/merge/ entry"* plus the task-completion policy that lets a
  refinement widen a `Tests:` clause to a level the task turns out to need make
  this the right home; a merge that passed only the forward check could be
  silently asymmetric or leave a non-canonical result, which the reverse,
  canonicality and resolution checks are exactly what catch per entry.
  *Alternative rejected:* deferring the reverse/canonicality/resolution checks
  to `cifra_js.conformance` — that task's note scopes it to the §11.3
  *generative* property tests and the profile claim, not the per-entry corpus
  checks, and splitting a corpus entry's checks across two tasks would leave
  this task's forward pass unproven against its own symmetry.

- **The result finishes through the writer; the marked text is written without
  the invariants or canonicalising.** The clean result is built, then handed to
  the writer's §8.3 invariants (I1→I3→I2), sung re-layout, §8.4 serialiser and
  `canonical` (§11.11 steps 1–5); the marked text is written with the same §8.4
  serialiser from a model keeping every variant of both sides, skipping the
  invariants (step 2) and canonicalising (step 5) (§11.12.2). *Rationale:* the
  writer is corpus-proven for canonical form; reusing it means the merge holds
  exactly one copy of §8.3/§8.4 (DIRECTION §3.6, the writer's own Decision), and
  the result's canonicality is guaranteed by construction, which corpus check 3
  then confirms. *Alternative rejected:* a merge-local writer that re-implements
  §8.4 — two serialisers to keep byte-identical, for no gain.

- **The marker-line primitive is reused from `text.js`, not re-implemented.** A
  marked input is detected with `isMarkerLine`/`markerLines`
  ([`text.js`](/home/ruoso/devel/cifra.md/js/src/text.js), landed by
  `text_layer`), and the merge never merges one (§11.4, §11.12.3). *Rationale:*
  the §11.12.3 marker-line rule is one definition the whole implementation shares
  (the reader reports it, the writer refuses it, the merger stops on it); a
  second copy could drift. *Alternative rejected:* a merge-local marker scan —
  duplicates a corpus-proven primitive.

- **Plain-object `Outcome` and conflicts with pinned key order, matching the
  reference and the corpus.** Conflicts are plain objects built in the §11.12.5
  member order; `conflictsJson` serialises with `JSON.stringify(…, 2) + "\n"`
  and non-ASCII kept raw, and the corpus check compares byte for byte.
  *Rationale:* the corpus pins `conflicts.json` to the byte, so member insertion
  order and array order are part of conformance, exactly as the model's are for
  the reader/writer ([`setlists.md`](./setlists.md), [`writer.md`](./writer.md)
  §Decisions). *Alternative rejected:* classes compared by deep-equal — breaks
  the *"compare bytes, never deep-equal"* rule and risks drift from the
  reference's JSON.

- **No design delta.** Chapter 11, the Merger profile of §9.1 and the
  `corpus/merge/` entries are already normative (produced by `format.merge`); the
  module split and the harness extension are internal layout and a test
  convention; no runtime dependency is added. *Rationale and alternative* mirror
  the sibling format tasks: a format task that implements the spec as written
  needs no spec change, and the spec moves only when behaviour does. (The spec's
  own §11 *"Open questions"* — finer units for sung lines; sections renamed and
  edited — are **format-version** deferrals the chapter already records for a
  later version of the format, not WBS work and not this implementation's to
  change.)

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- cifra.md `47a635e`: `js/src/merge.js` — 2090-line port of `merge.py`; entry
  point `merge(base, ours, theirs, { setlist }) → Outcome`; song merge §11.2–§11.12;
  generic sequence merge §11.5 (alignment, changes, clusters, settlement, keyed
  lists); values §11.6; metadata/reading conflicts §11.7; chart/masked text §11.8;
  footnote markers three ways §11.9; voicings/weak absence §11.10; result §11.11;
  conflict model/marked text §11.12; plus `conflictsJson()`, `mergeOutputs()`,
  `resolveMarked()`
- cifra.md `47a635e`: `js/src/setlist_merge.js` — 486-line port of
  `setlist_merge.py`; setlist merge §11.13; entries, items by reference+occurrence,
  three-step pairing, notes blocks, setlist conflict kinds
- cifra.md `47a635e`: `js/src/index.js` — last `NotImplementedError` stub flipped;
  `merge`/`conflictsJson`/`mergeOutputs`/`resolveMarked` exported; no stubs remain
- cifra.md `47a635e`: `js/src/parse.js`, `js/src/write.js`, `js/src/setlist.js` —
  §8.4/§5/§10.9 helpers exported for merge reuse
- cifra.md `47a635e`: `js/test/merge.test.js` — 65 unit tests §11.4–§11.12
  section by section (whole files, sequences, values, chart, footnote markers,
  voicings, result, conflicts, marked text)
- cifra.md `47a635e`: `js/test/setlist_merge.test.js` — 12 unit tests §11.13
  (items, pairing, conflicts, marked text)
- cifra.md `47a635e`: `js/test/corpus/harness.js` — `mergeChecks` extended from
  forward-only to full §11.16 battery (/1 forward, /2 reverse/symmetry, /3
  result-canonical, /4 resolution fixed point, /perm unchanged-side); 606 corpus
  checks over all 76 `corpus/merge/` entries, all green
- cifra.md `47a635e`: `js/test/corpus/expected-failures.json` — merge ids removed,
  now `[]`; merge corpus has no expected failure
- cifra.md `47a635e`: `js/test/harness.test.js` — planted-mismatch guard for new
  /2, /3, /4, /perm checks proving non-vacuousness
