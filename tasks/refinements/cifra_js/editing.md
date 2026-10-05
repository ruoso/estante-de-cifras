# cifra_js.editing — Editing operations

## TaskJuggler entry

`task editing` in [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) (lines
50–55), under `task cifra_js`, `depends !writer`. The area file's header
states the stream's rule: *"The app's implementation of the format, held to
the corpus byte for byte. Framework-free: the view is the only layer that
knows React"* ([`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 3–4).

The `.tji` note: *"cifra.md: §8.5 — choose a shape for an occurrence or a
key, clear, many at once, add a variation; what the arrange mode and the
wizard call. Tests: unit (each §8.5 operation on corpus songs — one
occurrence, a key, clear, many at once, a new variation — its output
canonical and re-read to the expected model)."*

## Effort estimate

**2 days** (from the `.tji`).

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, extended by this
task:

- `js/src/` — a new `edit.js` module holding the five §8.5 editing
  operations as pure model transforms, re-exported from `js/src/index.js`.
  It reuses the already-landed seams: `keyFor` from `parse.js`
  (`parse.js:105`) to keep a voicing key's string in step with its
  `(symbol, index)`, and `canonical`/`write` from `write.js` (the §8.3
  footnote invariants I1→I3→I2 in `footnotes`, plus the §4.5 re-layout) as
  the normalise pass every operation's output is handed to. It mutates
  nothing in place: like `setlist.js`'s §10.10 operations it deep-clones the
  document and returns a new model (§Decisions).
- `js/test/` — a new `editing.test.js` unit suite, each §8.5 operation
  exercised on songs that carry voicings, its output written with `write`
  and re-read with `parse` to the expected model.

This task is a **port with no reference to port from**: the Python reference
implements the reader, the canonical writer, setlists and merge only, and
does **not** implement the §8.5 editing operations (`reference/README.md`
lines 3–6, 28–43; confirmed by a survey of `reference/cifra_md/`). The
corpus holds no editing fixtures either (`corpus/README.md`; no entry
exercises §8.5). So this JavaScript module is the first implementation of
§8.5, written against the specification prose alone, reusing the one piece
that **is** cross-checked by the corpus — the canonical writer's §8.3 pass
(§Decisions: *No reference, no corpus, no Go — and why that is correct*).
It touches nothing under `reference/` or `corpus/`.

No design delta is authored. §8.5 (`spec/8-normalisation.md` lines 414–491)
is already normative prose; a new `edit.js` module and its unit file are an
internal module layout, the implementer's choice as the `package` task
established — not a new architectural seam, a new runtime dependency, or a
change to designed behaviour (§Decisions).

## Inherited dependencies

- **`cifra_js.writer` — settled.** Complete (cifra.md `c10ea54`,
  [`cifra_js/writer.md`](./writer.md) Status): `js/src/write.js` delivers
  `write`/`canonical`/`serialize`/`isCanonical`/`MarkedTextError`,
  re-exported from `js/src/index.js`. `canonical(doc)` applies the §8.3
  footnote invariants in `footnotes` (I1→I3→I2 in one pass, `write.js`
  lines 92–160, called from `canonical` at `write.js:184`) and re-lays-out
  any sung line whose marker changed width (§4.5). `write(doc)` =
  `serialize(canonical(doc))` plus the marked-text refusal. This is exactly
  the *"the document is written in canonical form, which applies §8.3"* that
  the spec names as the closing step of every §8.5 operation
  (`spec/8-normalisation.md` lines 418–419): an operation does its targeted
  edit, the caller hands the result to `write`/`canonical`, and the
  renumbering (I2), merging (I3) and pruning (I1) fall out of the already
  corpus-proven writer rather than being re-derived here.
- **Implied: `cifra_js.reader`, `cifra_js.chords`** (settled, through
  `writer`'s own chain) — this task consumes the model `parse` builds and
  writes back through `write`; it reads and mutates the chart's
  `type:"chord"` items (`parse.js:161`) and the voicing blocks
  (`parse.js:575`, `:614`) those two tasks defined.

The I4 invariant, *"defaults are not written"*, was deliberately **left to
this task** by the writer: it binds an application when it edits and the
serialiser has no notion of a default ([`cifra_js/writer.md`](./writer.md)
"Deferred work"; `spec/8-normalisation.md` lines 138–141). See §Constraints
for how this task honours it.

## What this task is

The five editing operations of §8.5 — the operations a writer performs on a
song's voicings so that *"two writers make the same change to the same
document"* (`spec/8-normalisation.md` lines 414–417). They are the app's
write path for arranging: what the arrange mode and the chord wizard call.

1. **Choose a shape for one occurrence** (§8.5.1) — a single chart position
   gets a shape in one tuning's variation, splitting it off onto its own
   footnote index only when the block cannot reuse an existing one.
2. **Choose a shape for a key** (§8.5.2) — every occurrence of a voicing key
   moves together.
3. **Clear a key** (§8.5.3) — a block's entry for a key is removed; the
   chart marker stays unless canonicalising (I3) now finds its index the
   same as a lower one.
4. **Choose shapes for many occurrences at once** (§8.5.4) — the batch an
   arrangement tool produces, computed in one pass (never a loop of §8.5.1),
   grouping planned occurrences by shape and rewriting every token from the
   end of the chart to the start.
5. **Add a variation** (§8.5.5) — a new voicing block for a tuning and name,
   empty or copied from another variation; refusing rather than silently
   landing in an existing one.

Each is a pure function `doc → doc` returning a new, mutated model; the
caller writes it canonical with the existing `write` (§Decisions: *Operations
do not self-canonicalise*).

## Why it needs to be done

`cifra_js.editing` is the seam between the format core and the app's
arranging UI. Its direct downstream consumers name it in their `depends`:

- **`songs.arrange`** (the arrange mode and the picker — *"tappable chords,
  every Cm or only here, choose these for every unchosen chord, enter a shape
  by hand, variations"*, [`tasks/60-songs.tji`](../../60-songs.tji) lines
  44–47, Workflow 5): "only here" is §8.5.1, "every Cm" is §8.5.2, "choose
  these for every unchosen chord" is the §8.5.4 batch, "variations" is
  §8.5.5.
- **`music.fallback`** (*"the plan into a new variation first"*,
  [`tasks/55-music.tji`](../../55-music.tji) lines 34–37, Workflow 5): the
  explorer's planner writes its chosen shapes into a new variation — §8.5.5
  then the §8.5.4 batch.

It is a dependency of milestone **`milestones.m1_format`**
([`tasks/99-milestones.tji`](../../99-milestones.tji) line 18, *"what the app
needs from the format exists"*). Without it the app can read, write and diff
a song but cannot change a voicing deterministically — every arranging
action would otherwise have to re-invent the footnote-index bookkeeping that
§8.5 settles once.

## Inputs / context

Normative, read in full:

- [`spec/8-normalisation.md`](/home/ruoso/devel/cifra.md/spec/8-normalisation.md)
  **§8.5** (lines 414–491) — the five operations, step by step. §8.5.1 lines
  427–444 (its four-branch decision); §8.5.2 lines 446–451; §8.5.3 lines
  453–460; §8.5.4 lines 462–484 (the one-pass requirement and its two
  reasons); §8.5.5 lines 486–491.
- **§8.3** (lines 102–150) — the footnote invariants I1, I3, I2 the output is
  canonicalised under, and I4/I5. §8.5.1 step 2 and §8.5.4 step 2 depend on
  the I3 *"no other block tells `i` from `j`"* predicate (lines 117–130); I4
  (lines 138–141) is the *"defaults are not written"* rule this task honours.
- **§2.4** (`spec/2-chart.md` lines 98–134) — the chord token, its footnote
  marker, and the **voicing key** `(symbol, index)` written `symbol` for
  index 1 and `symbol[index]` otherwise. *"The symbol in the key is the text
  as written, compared character for character… canonicalising never respells
  one."*
- **§7.4–§7.5** (`spec/7-voicings.md` lines 107–174) — a voicing item is a
  `key` and a **fret string** (one `x`/fret per string in tuning order),
  optionally a **fingering**; keys within a block are unique; the symbol is
  matched character for character and is not validated against §5. §7.3
  (lines 81–106) — variations: a block's **name** (label), the default
  block's name empty.

The seams in the existing JavaScript (all cifra.md `js/src/`), from the
survey:

- `parse.js:105` `keyFor(symbol, index)` → `index > 1 ? \`${symbol}[${index}]\` : symbol`.
- `parse.js:161` the chart chord item `{ type:"chord", symbol, index, key, chord }` (optional `ambiguities`); items live at `doc.sections[s].body[p].lines[l].measures[m].items[i]` in both unsung and sung lines.
- `parse.js:575` the voicing block `{ label, tuning, voicings, notes }` (`label` the variation name, `""` the default; `tuning` the `{ text, pitches, id }` from `parseTuning`, identity by `id`).
- `parse.js:614` a voicing entry `{ key, symbol, index, frets }` (optional `fingers`); `frets` an array of `int | "x"`, `fingers` an array of `int | "T" | null` (`frets.js:22–37`, `:50–67`).
- `write.js:184` `canonical(doc)`; `write.js:92–160` `footnotes(doc)` (I1 at `:99–103`, I3 via `same(i,j)`/`sameShape` at `:85–122`, I2 at `:137–140`, I5 by rewriting chart and blocks in one pass `:141–158`).
- `js/src/index.js` the public barrel; `js/src/setlist.js` the established
  pure-transform editing pattern (deep-clone via `JSON.parse(JSON.stringify(...))`,
  op returns a new model, re-exported from index, unit-tested by
  construct-then-round-trip — `setlist.test.js:396` onward).

Reference (behaviour to match, not code to port): **none for §8.5** — the
reference does not implement the editing operations. The one reference
anchor is the normalise step they all run afterwards:
`reference/cifra_md/write.py:70` `footnotes(doc)`, reached via `canonical` /
`write`, already ported faithfully in `js/src/write.js`.

## Constraints / requirements

- **Canonical output.** Every operation's result, handed to `write`, is in
  canonical form: the standing rule (canonical form over preserving content).
  The operation performs only its targeted §8.5 edit — it does not renumber,
  merge or prune; `write`/`canonical` do that under §8.3. A model that would
  write to a marked text is impossible here (editing never introduces
  conflict markers), but `write` still refuses one if handed it, unchanged.
- **The voicing key is text.** The symbol in a key is compared and carried
  character for character (§2.4, §7.4); an operation never respells a symbol
  and never validates it against §5 — a key for an unknown token
  (`type:"unknown"` in the chart) is as good as any other. Use `keyFor` to
  derive the `key` string so an index change and its string stay in step.
- **I4 — defaults are not written** (`spec/8-normalisation.md` lines 138–141).
  The operation writes into a block **only** the explicit shape it is given;
  it never injects an application's default shape. Because each shape-setting
  operation takes the shape as an input, this holds by construction — the
  responsibility to not pass a default rests with the caller (the arrange
  mode), and this task pins it with a test that a shape equal to no
  particular default is still written exactly as given, and that an operation
  never adds an entry for a key it was not asked about.
- **§8.5.4 is not a loop.** The batch operation MUST NOT be implemented as a
  sequence of §8.5.1 (spec lines 465–468: rewriting one token shifts later
  positions, and renumbering between steps moves the indices later steps aim
  at). It groups planned occurrences by shape under the I3 "tells apart"
  constraint, assigns each group the smallest of its members' current
  unreserved indices (so a plan agreeing with the document rewrites nothing),
  and rewrites all tokens in one pass from the end of the chart to the start.
- **Pure, framework-free, zero-dependency.** `edit.js` is plain ES module
  code below the view: it knows nothing of React, storage or the network, has
  no runtime dependency, and does not import, transpile or shell out to the
  Python reference or the Go module (DIRECTION §3.6 — implementations agree by
  the corpus and the spec, never by shared code). It is a sibling of
  `setlist.js`, mutating the model and returning a new one.
- **No song text in tests or anywhere.** Test fixtures are the corpus's own
  purpose-written songs and small songs written for this suite — never
  someone else's words.

## Acceptance criteria

**Behaviour delivered.** `js/src/edit.js` exports the five operations,
re-exported from `js/src/index.js`:

- `chooseShapeForOccurrence(doc, occurrence, tuning, variation, shape)` — §8.5.1.
- `chooseShapeForKey(doc, key, tuning, variation, shape)` — §8.5.2.
- `clearKey(doc, key, tuning, variation)` — §8.5.3.
- `chooseShapes(doc, plan, tuning, variation)` — §8.5.4 (`plan` an array of
  `{ occurrence, shape }`).
- `addVariation(doc, tuning, name, copyFrom)` — §8.5.5 (`copyFrom` optional;
  refuses when a block for that tuning and name already exists).

with the input shapes fixed under §Decisions: an **occurrence** is the index
path `{ section, part, line, measure, item }` into the model; a **voicing
key** is `{ symbol, index }` (or the `keyFor` string); a **tuning** is a
tuning text or parsed `{ text, pitches, id }`, resolved to a block by `id`; a
**variation** is the block label (`""` the default); a **shape** is
`{ frets, fingers? }` in the model's array form. Each returns a new model and
mutates nothing in place.

**Tests it lands with — unit** (Vitest, `js/test/editing.test.js`; the only
level, see §Decisions: *No reference, no corpus, no Go*). Fixtures are the
voicing-bearing corpus songs (`corpus/05-voicings-two-tunings`,
`corpus/06-variations`, `corpus/24-footnote-invariants`,
`corpus/29-voicings-part`) and small songs written for the suite; every case
asserts the operation's output **written by `write` is canonical** and
**re-read by `parse` equals the expected model** (`dump(parse(write(op(doc))))`
byte-for-byte), the round-trip pattern `setlist.test.js` established:

- **§8.5.1, each of its four branches** (spec lines 433–444): (1) the block
  already has the given shape for `(S,i)` — nothing changes; (2) another used
  index `j` has the shape and no block tells `i` from `j` — the occurrence's
  token is rewritten to `j`, the shape reused; (3) the occurrence is the only
  one with index `i`, or `(S,i)` has no shape yet — the block's entry for
  `(S,i)` becomes the shape (pinning *"the first choice for a chord applies to
  every bare occurrence"*); (4) otherwise — the token moves to the smallest
  index of `S` not used in the chart and the block gets that entry. Each
  pins §8.5.1 and the I3 predicate of §8.3.
- **§8.5.2** (lines 446–451): choosing a shape for a key moves every
  occurrence with that key together; steps 1 and 2 of §8.5.1 read over all of
  them, else the block's entry for the key becomes the shape. Pins §8.5.2.
- **§8.5.3** (lines 453–460): clearing a key removes the block's entry; the
  marker stays when another instrument still tells it apart, and goes away
  (via I3 on write) when it does not — two cases, one song with a second
  tuning's block holding the index apart, one without. Pins §8.5.3 and §8.3 I3.
- **§8.5.4 the batch** (lines 462–484): a plan whose groups agree with the
  document rewrites nothing (smallest reserved/current index reused); a plan
  that regroups rewrites tokens end-to-start with correct final indices; two
  occurrences another block tells apart are never put in one group; and a
  **divergence case** — a plan a naïve loop of §8.5.1 would mis-number but the
  one-pass algorithm numbers per spec — pinning the lines-465–468 requirement
  explicitly.
- **§8.5.5 add a variation** (lines 486–491): an empty new block for a tuning
  and name; a copy carrying the source variation's entries; and a refusal
  (throws, mirroring `addVariation`'s "SHOULD refuse") when a block for that
  tuning and name already exists. Pins §8.5.5.
- **I4** (§8.3 lines 138–141): an operation writes only the shape it is given
  and adds no entry for a key it was not asked about — no application default
  is ever persisted. Pins I4, the invariant the writer left to this task.
- **Canonical and marker upkeep across all of the above**: each result is
  re-written stably (a fixed point of `write`) and, where a rewritten marker
  changed a sung line's width, the §4.5 re-layout keeps every chord over its
  syllable (reusing `canonical`'s existing pass; a sung fixture pins it).

No corpus check and no expected-failure ledger id change: §8.5 has no corpus
entry (§Decisions), and this task flips none. `scripts/gate` runs
`js/test/editing.test.js` with the rest of the Vitest suite; the closer
confirms it ran, not skipped.

## Decisions

- **No reference, no corpus, no Go — and this is the correct scope.** The
  Python reference does not implement §8.5 and the corpus has no editing
  fixture; `cifra_go` has **no** `editing` task
  ([`tasks/15-cifra-go.tji`](../../15-cifra-go.tji): reader, writer,
  setlists, versions, merge, conformance — no editing). This is not a gap to
  backfill here. The format's *agreement* guarantee is about what a canonical
  file **is**, and that is fully pinned by the reader, the writer and the
  corpus in both languages, byte for byte. §8.5 is about how an application
  *produces* an edit; its output is a canonical document, already
  cross-checked by the writer's corpus. "Two writers make the same change"
  (spec line 416) only bites across two implementations that both edit — and
  only the app edits; the Go side reads, writes canonical and merges for the
  hook, it never arranges. So §8.5 lands as JavaScript unit tests against the
  spec prose, reusing the one shared, corpus-proven seam — `canonical`'s §8.3
  pass. *Alternative considered: implement §8.5 in the Python reference and
  add editing corpus fixtures first, to get a second opinion.* Rejected as
  out of scope and unjustified: it expands a 2-day JS task into a reference +
  corpus + (for symmetry) Go programme for behaviour no second implementation
  consumes, and the spec — not a reference port — is the oracle the standing
  rule names. Surfaced in the return summary for the parking lot as a product
  call, not encoded as a WBS task (no "audit" leaf).
- **Operations do not self-canonicalise.** Each op performs only its targeted
  §8.5 edit on the (canonical) input model and returns a raw mutated model;
  the caller runs `write`/`canonical` to apply §8.3 and §4.5. This matches
  the spec's own separation — §8.5.4 says the batch rewrites tokens *"and the
  document is then written in canonical form"* (lines 483–484) — and reuses
  the writer's proven `footnotes` pass rather than duplicating I1/I2/I3 inside
  `edit.js`. The acceptance tests therefore assert on `write(op(doc))`.
  *Alternative: each op returns an already-canonical model.* Rejected: it
  would re-run the whole §8.3/§4.5 pass inside every op (the batch op calls it
  once at the end anyway), couples `edit.js` to the writer's internals, and
  blurs "the edit" with "canonicalising", which the spec keeps apart.
- **An occurrence is an index path `{ section, part, line, measure, item }`.**
  The model is a tree of plain objects; a chart position is a path of indices
  into it, which the arrange UI (rendering from the same model) already knows
  and which survives the op's deep clone. *Alternatives:* object identity
  (does not survive the clone), bar-number addressing (sung documents have no
  bar numbers, §2 / `diff.js`), or an opaque occurrence id minted at parse
  time (adds state to every model for one caller). The path is derivable,
  stateless and unambiguous; `diff.js` already locates chords by a structured
  `where`, so the convention is in the house.
- **Inputs are model-level, not text.** A shape is `{ frets, fingers? }` in
  the array form the model stores, a key is `{ symbol, index }`, a tuning is
  resolved by `id`. `edit.js` stays a pure model transform; callers that hold
  text use the already-exported `parseFrets`/`parseFingers`/`parseTuning` to
  build the inputs. *Alternative: accept fret strings and tuning text and
  parse inside.* Rejected: it couples the editing layer to the §7.5 parsers
  and duplicates validation the reader already owns.
- **A shape-setting op creates its target block when absent.** If no block
  exists for the given tuning and variation, `chooseShapeForOccurrence` /
  `chooseShapeForKey` / `chooseShapes` create one (the entry it is setting its
  sole content), matching *"the first choice for a chord applies to every bare
  occurrence"* (§8.5.1 step 3) for a song that has no voicings yet. `addVariation`
  remains the explicit, refuse-on-exists create for a **named** variation; the
  shape-setting ops never refuse and never copy.
- **Module and test file names.** A new `js/src/edit.js` (sibling of
  `setlist.js`) and `js/test/editing.test.js`, re-exported from `index.js` —
  the internal layout the `package` task left to each task, not a new seam.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- cifra.md `b1d1f94`: `js/src/edit.js` — five §8.5 editing operations as pure `doc → doc` model transforms: `chooseShapeForOccurrence` (§8.5.1 four-branch), `chooseShapeForKey` (§8.5.2), `clearKey` (§8.5.3), `chooseShapes` (§8.5.4 one-pass, not a loop), `addVariation` (§8.5.5, refuse-on-exists). Reuses `keyFor` (`parse.js:105`) and `parseTuning` (`tuning.js`); leaves §8.3 canonicalisation to `write`/`canonical`.
- cifra.md `b1d1f94`: `js/src/index.js` — re-exports the five operations on the public barrel.
- cifra.md `b1d1f94`: `js/test/editing.test.js` — 19 Vitest unit cases: §8.5.1 all four branches + corpus/05 branch-1; §8.5.2 "otherwise" and step-2-reuse; §8.5.3 marker-stays and marker-goes-away (I3); §8.5.4 plan-agrees/divergence-one-pass/never-group-told-apart; §8.5.5 empty/copy/refuse + corpus/06; I4 verbatim-shape-only; sung-line §4.5 re-layout fixed point; purity. Each asserts `write(op(doc))` is `isCanonical` and `parse`s to the expected model.
- No corpus check, no reference port, no Go module — §8.5 has no corpus entry and the spec (not a reference) is the oracle; see §Decisions.
