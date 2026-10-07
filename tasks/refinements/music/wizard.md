# music.wizard — The voicing wizard

## TaskJuggler entry

[`tasks/55-music.tji:44-49`](../../55-music.tji) — `task wizard "The voicing
wizard"` under `task music`.

```
effort 2d
allocate team
depends !fallback, cifra_js.editing
note "Explore Chords' planners; the plan into a new variation first.
      Workflow 5. Tests: unit (Explore Chords' planners' tests carried
      over; the plan written into a new variation, canonical)."
```

## Effort estimate

**2d**, `allocate team`, unchanged from the `.tji`. The work is a carry-over,
not a fresh design: the three planners, their candidate generators, their shape
metrics and their ~32-case test file already exist and are proven in Explore
Chords (`../explore-chords/src/core/voicing-plan/`). The 2d covers re-pointing
their imports onto the app's core (`search.js`, `instrument.js`, `fretstring.js`),
re-sourcing the song reading onto the cifra.md parse model, writing the
plan→variation bridge over cifra.md for JavaScript's already-built §8.5 edit
operations, and carrying the tests over onto cifra.md fixtures.

## Repository

**estante-de-cifras.** App work — the `.tji` note does not start with
`cifra.md:`. The planner is framework-free music core (no React), callable from
the view or the Worker (DIRECTION §3.7, "Framework-free below the view",
`docs/DIRECTION.md:415-417`).

Directories touched:

- `app/src/core/voicing-plan/` — **new**: `index.js`, `candidates.js`,
  `shape.js` (the planners, carried over), `apply.js` (new bridge), with
  `index.test.js` and `apply.test.js`.
- `app/src/core/song-analysis.js` — **new**: `analyseSong`, carried over and
  re-sourced onto the cifra.md model, with `song-analysis.test.js`.
- `app/src/data/sources.js` — **new (carried over)**: the language-independent
  reference list the choro planner's `sources` ids point into.
- `cifra-md` package (`js/src/edit.js`, `js/src/write.js`) — **consumed, not
  modified**: `chooseShapes`, `addVariation`, `write`, `canonical`,
  `isCanonical`, already built and unit-tested by `cifra_js.editing`.
- `app/src/core/voicings.js`, `song-variations.js` — **consumed, not modified**:
  `defaultVoicing`, `withSongFingers`'s thumb mapping, `songVariations`.

**Design delta (same commit):** `app/src/core/DESIGN.md` §2.10 — a short note
that the text-level batch writer `setVoicingsForOccurrences(text, …) -> text`
(carried verbatim at `app/src/core/DESIGN.md:323`) does **not** come over; in
the app, cifra.md for JavaScript's §8.5.4 `chooseShapes` (model→model) and
`write` (canonical) own that reconciliation, and §8.5.5 `addVariation` creates
the new variation. See Decisions. No cifra.md spec/reference/corpus change — the
format side is `cifra_js.editing`, already done.

## Inherited dependencies

Both **settled**.

- **`music.fallback`** (`!fallback`) — Done 2026-10-06, refinement
  [`music/fallback.md`](fallback.md). Supplies: the cifra.md parsed-model shape
  the planner walks (chart chord item `{ type:'chord', symbol, index, key,
  chord }` inside `model.sections`; voicing block `{ label, tuning:{ text,
  pitches, id }, voicings, notes }`, default variation `label === ''`); the
  `Fingering` typedef (`app/src/core/search.js:24`); `defaultVoicing(chord,
  instrument)` (`app/src/core/voicings.js:49`); the read-side thumb mapping
  `withSongFingers` (`voicings.js:115`, cifra.md `'T'` → `0`), which this task
  inverts on write. Crucially, fallback is **read-only by decision** — it never
  writes a shape into a song, and names `music.wizard`/workflow 5 as the
  explicit writer (`fallback.md` Constraints, "writing shapes into a song is an
  explicit act"). This task is that writer.
- **`cifra_js.editing`** (`cifra_js.editing`) — Done 2026-10-05, refinement
  [`cifra_js/editing.md`](../cifra_js/editing.md), cifra.md package. Supplies the
  §8.5 operations as pure `doc → doc` transforms: `chooseShapes(doc, plan,
  tuning, variation)` (`js/src/edit.js:283`, the one-pass batch, `plan` =
  `{ occurrence, shape }[]`), `addVariation(doc, tuning, name, copyFrom)`
  (`edit.js:362`, **throws** if a block for that tuning+name already exists),
  and `write`/`canonical`/`isCanonical`/`MarkedTextError`
  (`js/src/write.js:413/175/422`). Decision carried forward: **operations do not
  self-canonicalise; the caller runs `write`/`canonical`** — this task's bridge
  is that caller's composite.

## What this task is

The pure engine behind the voicing wizard of workflow 5: given a song and the
instrument in use, choose a shape for every chord in one pass by a *policy* (not
one chord at a time), and write the result into the song as a new variation in
canonical form. It is two carried-over halves plus one new bridge:

1. **The planners** (`app/src/core/voicing-plan/index.js`), carried from Explore
   Chords unchanged in behaviour: `PLANNERS` (`smoothest`, `openPosition`,
   `choroCentro`), and `planVoicings(plannerId, song, instrument, { dialect,
   existing, choices }) → { planner, reading, shapes, missing, unchanged }`,
   with `plannerById`, `plannersFor(instrument)` (honouring each planner's
   `appliesTo`), and `optionDefaults(planner)`. A planner is one function handed
   the whole already-read song, returning `{ shapes: Map<at,(number|'x')[]>,
   missing: number[] }` — a shape per chord *occurrence*. Candidate generation
   (`candidates.js`: `searched`, `centroCandidates`) and shape metrics
   (`shape.js`: `best`, `movement`, `position`, `doubling`, `sounding`,
   `lowest`, `highestString`, `stringChange`) carry over as pure utilities,
   re-pointed onto the app's `search.js`/`instrument.js`/`fretstring.js`.

2. **The song reading** (`app/src/core/song-analysis.js`): `analyseSong(doc,
   dialect) → SongReading`, carried over and re-sourced onto the cifra.md parse
   model. `reading.line[]` entries carry `{ at, ref:{ symbol, key, … }, chord,
   bassPc, occurrence }` and `reading.spans`/`spansAt` for the `walking` span
   the choro planner reads. The one addition over Explore Chords: each entry
   also carries its cifra.md **occurrence index path** `{ section, part, line,
   measure, item }`, so the bridge can map a planner's scalar `at` to the
   identity `chooseShapes` wants.

3. **The plan→variation bridge** (`app/src/core/voicing-plan/apply.js`), new:
   - `applyPlan(doc, planResult, { tuning, variation }) → doc` — turns the
     planner's `shapes` Map into a cifra.md `plan` (`{ occurrence, shape }[]`),
     mapping each `at` to its occurrence index path via `reading.line[at]`,
     converting the app's thumb `0` → cifra.md `'T'`, skipping the `missing`,
     and calling `chooseShapes(doc, plan, tuning, variation)`. Returns the
     mutated model; the caller runs `write`.
   - `planIntoNewVariation(doc, planResult, { tuning, name, copyFrom }) → doc` —
     `addVariation(doc, tuning, name, copyFrom)` then `applyPlan` into
     `(tuning, name)`. This is "the plan into a new variation first."

This task delivers the engine only. The wizard **screen** (the button above the
chart, the two-step choose-then-preview dialog, the stylistic-option radio
group, "How it works" and its citations, "into a new variation first / over
this one second", axe) is `songs.wizard_ui` (`tasks/60-songs.tji:63-67`), and
arrange mode around it is `songs.arrange` (`tasks/60-songs.tji:57-61`). Both
already exist as WBS leaves and `depend` on this task.

## Why it needs to be done

`music.fallback` deliberately stopped at reading: it resolves a chord's shape
for display (song's choice → my shape → default) but never writes one into a
song, and it names this task as the explicit writer. Nothing in the app yet runs
a whole-song voicing plan, and the cifra.md §8.5 edit operations built by
`cifra_js.editing` have **zero callers** — the wizard is their first consumer.

Downstream: `songs.wizard_ui` mounts the screen over this engine, and
`songs.arrange` (arrange mode and the one-chord picker) is a sibling consumer of
the same §8.5 write path. Both are in the launch milestone's `depends`
(`tasks/99-milestones.tji:25`).

## Inputs / context

### Normative

- **Workflow 5**, `docs/workflows/05-arrange-for-an-instrument.md`:
  - §The wizard (`L63-72`): "Run the wizard" sits *above* the chart because it
    decides the song; it "plans the whole song at once, with the planners and
    questions Explore Chords' wizard had (its DESIGN §2.10)"; its plan "is
    written into the working copy like any other edit". "A variation is the way
    to keep a plan beside an existing arrangement rather than over it. So when
    the variation in use already has choices, the wizard offers **into a new
    variation** first, and *over this one* second."
  - §Variations (`L74-84`): adding one starts empty or as a copy of the one in
    use; a name already in use is refused; which one is in use is personal
    state, remembered per song and tuning in the home book.
  - `L25-26`: "Arranging is not offered while the song is transposed (workflow
    2): it writes voicings for the chords as written." (A UI guard, owned by
    `songs.arrange`; the engine plans the chart as written.)
- **DIRECTION**, `docs/DIRECTION.md`:
  - §3.7 The app (`L394-434`): framework-free music core below the view
    (`L415-417`); the Worker owns git/working copy/index, the main thread never
    touches IndexedDB (`L407-409`); axe at WCAG 2.1 AA (`L432-434`).
  - §3.2 Personal state (`L136-151`): variation *content* is song data (an
    authored, explicitly-saved edit to the songbook); *which variation is in
    use* is home-book state, auto-committed. This task writes content only.
  - §3.1 Sync (`L127-134`) and §4 The interface (`L436-458`): the plan is an
    ordinary unsaved working-copy edit, saved/discarded via workflow 4; a
    semantic diff drives the save message ("added voicings for …", `L455-456`).
- **The app's carried design**, `app/src/core/DESIGN.md` §2.10 (`L36-348`): the
  planner contract (`Planner`/`PlanRequest`/`PlanResult`, `L58-77`),
  `planVoicings` as the thin single entry point (`L161`), "one shape per bar,
  reconciled afterwards" (`L306-348`). This is the carried reasoning the code
  travels with; the writer paragraph is the subject of this task's design delta.
- **The source of the lore**, `../explore-chords/docs/DESIGN.md` §2.10
  (`L588-900`, the planners, the choro rules and their citations) and §2.13
  (`L1279-1335`, variations — a variation is named by its block heading, blocks
  keyed by tuning *and* name, no inheritance, an empty named variation is kept).
- **cifra.md spec** (`/home/ruoso/devel/cifra.md/spec/`): §8.5.4 "many at once"
  (`spec/8-normalisation.md:462-484`), §8.5.5 "Add a variation" (`:486-491`),
  §7.3 Variations (`spec/7-voicings.md:81-101`, no inheritance; default =
  empty label), §7.6 resolution (`:216-227`), canonical block ordering
  (`spec/8-normalisation.md:390-395`).

### Code seams on disk

- **Carried-over source** (`../explore-chords/src/core/`):
  `voicing-plan/index.js` (`PLANNERS`, `planVoicings:289`, `plannerById:259`,
  `plannersFor:264`, `optionDefaults:269`), `voicing-plan/candidates.js`
  (`searched`, `centroCandidates`), `voicing-plan/shape.js` (metrics),
  `voicing-plan/index.test.js` (~32 cases), `song-analysis.js` (`analyseSong`)
  and `song-analysis.test.js`, `../explore-chords/src/data/sources.js`.
- **cifra.md JS** (`/home/ruoso/devel/cifra.md/js/src/`): `edit.js`
  `chooseShapes:283`, `addVariation:362`; `write.js` `write:413`,
  `canonical:175`, `isCanonical:422`; `parse.js` `keyFor:105`; the model shape
  (chord item `{type:'chord', symbol, index, key, chord}`; voicing block
  `{label, tuning:{text,pitches,id}, voicings:[{key,symbol,index,frets,
  fingers?}], notes}`). Re-exported from `js/src/index.js:77,87-93`.
- **App core** (`app/src/core/`): `voicings.js` `resolveSongVoicings:145`,
  `defaultVoicing:49`, `unvoiceableKeys:214`, `withSongFingers:115`;
  `song-variations.js` `songVariations:28`; `search.js` `searchFingerings:344`,
  `fingeringFromFrets:447`, `allFingerings:486`; `instrument.js`
  `instrumentInstance:76`, `openMidis:164`; `fretstring.js`.

## Constraints / requirements

- **Framework-free, pure, synchronous.** The engine lives below the view and
  knows nothing of React (DIRECTION §3.7, `L415-417`). Like the rest of
  `app/src/core/`, planners and the bridge are pure and synchronous: no I/O, no
  Worker, no home-book read. Instrument, dialect, `existing` shapes and
  `choices` are arguments passed in by the caller, exactly as `resolveSongVoicings`
  takes them in `music.fallback`.
- **Behaviour carried over unchanged.** The three planners' choices, rankings,
  tie-breaks, `appliesTo` gates, options and sources must match Explore Chords
  bar for bar — that is what "planners' tests carried over" means. The only
  adaptations are mechanical: imports re-pointed onto the app's core module
  names, and the reading built from the cifra.md parse model instead of Explore
  Chords' `song.js`.
- **The write path is cifra.md's, not reimplemented.** Footnote-slot allocation,
  the refusal to merge slots another tuning or variation depends on, and the
  renumber-and-prune pass are §8.5.4/§8.3 and belong to cifra.md for JavaScript's
  `chooseShapes`. The app does not carry over Explore Chords'
  `setVoicingsForOccurrences`. Implementations agree because they are checked
  against the corpus, never shared — the standing rule.
- **Canonical form over preserving content.** The written song is handed to
  `write` (`= serialize ∘ canonical`), which applies §8.3 and refuses a marked
  text (`MarkedTextError`). This task's bridge returns the mutated model and the
  caller runs `write`, per `cifra_js.editing`'s "operations do not
  self-canonicalise" decision; the "canonical" acceptance test runs `write` and
  asserts `isCanonical`.
- **Defaults are never written (§8.5.4 / I4).** The plan writes only the shapes
  the planner actually chose. Chords in `missing` are left out entirely — they
  fall to the app default on read via `music.fallback`, never persisted. A shape
  the planner returns that equals the song's existing choice (`unchanged`) is
  still a real choice and is written; it simply does not change the text.
- **The plan into a new variation first.** The primary path, and the one the
  unit tests pin, creates a new named variation (`addVariation`) and writes the
  plan there, leaving the variation in use untouched. "Over this one" (writing
  into the in-use variation directly) is the secondary `applyPlan` path; which
  of the two to offer, and the variation's name, are the screen's
  (`songs.wizard_ui`), not the engine's.
- **Thumb encoding.** The app represents a thumbed string as finger `0`; cifra.md
  writes `'T'`. The bridge inverts `voicings.js:withSongFingers` on write (`0` →
  `'T'`).
- **No song text in logs; test songs written for the purpose.** The carried
  fixtures and new tests use purpose-written songs (the Dominante excerpt and
  small test songs), never anyone's copyrighted words.

## Acceptance criteria

### Behavior delivered

1. `plannersFor(instrument)` returns the policies that apply to the instrument
   in use (`choroCentro` only where there are strings to spare); `planVoicings`
   runs the chosen one over a parsed cifra.md song and returns a shape per
   chord occurrence, with `missing` and `unchanged` reported.
2. `planIntoNewVariation(doc, planResult, { tuning, name })` produces a song
   whose `write()` is canonical and round-trips: the plan lands in a new
   variation block for the tuning under the given name, the previously in-use
   and default variations are untouched (variations do not inherit, §7.3), a
   duplicate `name` is refused (`addVariation` throws), chords the planner could
   not voice are not written, and the app's thumb `0` is written as `'T'`.
3. `applyPlan(doc, planResult, { tuning, variation })` writes into an existing
   (in-use or default) variation — the "over this one" path.

### Tests the task lands with, by level

Unit only — the `.tji` note's `Tests:` clause names unit, and the engine is a
pure framework-free core module with no rendered surface. The screen's behavior
and e2e-web tests (Testing Library + axe; Playwright on three viewports) are
`songs.wizard_ui` and `songs.arrange` (see Decisions).

- **unit — `app/src/core/voicing-plan/index.test.js`** (Vitest): Explore Chords'
  planner suite carried over, fixtures re-sourced onto `cifra-md`'s `parse` and
  the app's `analyseSong`. Pins the planner behaviour of `app/src/core/DESIGN.md`
  §2.10 and the sources of `../explore-chords/docs/DESIGN.md` §2.10 — the five
  groups unchanged: *planning a whole song at once* (a shape per bar not per
  chord; one shape where nothing asks it to differ; refuses an unknown planner;
  skips an unparseable chord; reports `unchanged`; every chord playable), *the
  planners differ* (open position sits lower than the smoothest path; the choro
  texture differs from both), *the choro centro planner* (~13 cases: bass a
  third above, four/five contiguous voices, the three-note dominant, register,
  staying in the first quarter, dropping the fifth, the inversion label, the
  sixth fallback), *stylistic choices* (`whenNoThirdAbove` default `sixth`, the
  `thirdBelow` alternative, unchanged where a third works), and *offered only
  where it makes sense* (`appliesTo`, seven-string, every advertised id
  resolves).
- **unit — `app/src/core/song-analysis.test.js`** (Vitest): `analyseSong`
  carried over and re-sourced — the reading over the cifra.md model (one entry
  per chord occurrence, `at`/`ref.key`/`bassPc`/the occurrence index path) and
  the `walking` span the choro planner reads. Pins §2.10 "Reading the song
  before choosing".
- **unit — `app/src/core/voicing-plan/apply.test.js`** (Vitest): the plan
  written into a new variation, canonical. Pins workflow 5 §The wizard and
  cifra.md §8.5.4/§8.5.5, §7.3: `write(planIntoNewVariation(doc, plan, {tuning,
  name}))` is `isCanonical` and `parse`s back to the expected model; the plan
  lands under the new variation and the default/in-use variation is untouched;
  a duplicate name throws; `missing` chords are not written; thumb `0` → `'T'`;
  and `applyPlan` writes into the in-use variation for the "over this one" path.
  Fixtures are voicing-bearing corpus songs and small purpose-written songs.

### Deferred work / graph notes

None to register. The wizard screen (`songs.wizard_ui`,
`tasks/60-songs.tji:63`) and arrange mode (`songs.arrange`,
`tasks/60-songs.tji:57`) already exist as WBS leaves, both `depend` on
`music.wizard`, and both are wired into the launch milestone
(`tasks/99-milestones.tji:25`). No new follow-up task, no tech debt.

## Decisions

- **Engine here, screen in `songs.wizard_ui`/`songs.arrange`.** *Chosen:* this
  task ships the pure planners and the plan→variation writer with unit tests;
  the button, the two-step dialog, the preview grid, the option radio group,
  "How it works", the source citations and axe land in `songs.wizard_ui`, over
  arrange mode from `songs.arrange`. *Rationale:* the `.tji` `Tests:` clause is
  unit-only, the WBS already carries `songs.wizard_ui` ("into a new variation
  first, over this one second"; behavior + e2e-web) and `songs.arrange` as
  separate leaves depending on this one, and this is the exact engine/screen
  split `music.transpose` used (pure `transpose.js` here, the reading journey in
  `songs.reading`). *Rejected:* folding the screen in — it would duplicate
  `songs.wizard_ui`, drag React and e2e into a core-module task, and contradict
  the WBS graph.

- **The write path is cifra.md's `chooseShapes` + `write`, not Explore Chords'
  `setVoicingsForOccurrences`.** *Chosen:* map the planner's `shapes` Map to a
  §8.5.4 `plan` and call `chooseShapes(doc, plan, tuning, variation)`, then
  `write`. *Rationale:* `cifra_js.editing` already built and corpus-tested the
  batch reconciler (slot allocation, the cross-tuning/variation merge refusal,
  renumber/prune) against the rewritten parser; reimplementing a text-level
  writer in the app would duplicate it and violate "implementations agree
  because they are checked, not shared." The wizard is the first caller of those
  ops, which is their point. *Rejected:* carrying `setVoicingsForOccurrences`
  over — it operates on text offsets against Explore Chords' old parser and has
  no place once the model and the format library are cifra.md's. **This is the
  design delta** recorded in `app/src/core/DESIGN.md` §2.10.

- **`planIntoNewVariation` is the primary, tested composite; `applyPlan` the
  lower "over this one" primitive.** *Chosen:* two exports, the new-variation
  one built on the in-place one plus `addVariation`. *Rationale:* the `.tji`
  note and workflow 5 foreground "the plan into a new variation first", so the
  canonical round-trip test exercises that path; `songs.wizard_ui` needs both
  paths ("over this one second") without re-deriving the `at`→occurrence and
  thumb adapters. *Rejected:* a single parameterised writer — the two call sites
  read more clearly as named functions, matching how `cifra_js.editing` split
  `chooseShapes` from `addVariation`.

- **The reading carries the cifra.md occurrence index path.** *Chosen:* add an
  `occurrence` `{section,part,line,measure,item}` to each `reading.line` entry
  alongside the scalar `at`. *Rationale:* the planners key `shapes` by `at`
  (unchanged, so their tests carry over), while `chooseShapes` needs the index
  path; building it once in `analyseSong` keeps the mapping in one place and the
  bridge a thin lookup. *Rejected:* recomputing the index path in the bridge by
  re-walking the model — it would duplicate the walk `analyseSong` already does
  and risk the two disagreeing.

- **`sources.js` comes over with the engine.** *Chosen:* carry
  `app/src/data/sources.js` now. *Rationale:* the choro planner's `sources`
  array and "each planner cites its own sources" is engine metadata; the ids
  must resolve. The citation *rendering* and its i18n labels belong to
  `songs.wizard_ui`. *Rejected:* deferring the whole of sources to the screen —
  it would leave the planner's `sources` ids dangling in this task.

Beyond the one DESIGN.md note, no design delta: workflow 5, DIRECTION and the
cifra.md spec already settle the behaviour; this task turns them into the engine.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `app/src/core/voicing-plan/index.js`, `candidates.js`, `shape.js` — the three planners (`smoothest`, `openPosition`, `choroCentro`), carried verbatim from Explore Chords with imports re-pointed onto the app's `search.js`, `instrument.js`, `fretstring.js`.
- `app/src/core/voicing-plan/apply.js` — new bridge: `applyPlan(doc, planResult, {tuning, variation}) → doc` and `planIntoNewVariation(doc, planResult, {tuning, name, copyFrom}) → doc`, mapping planner `at` → cifra.md occurrence index path and thumb `0` → `'T'`, over `chooseShapes` + `addVariation`.
- `app/src/core/song-analysis.js` — `analyseSong(doc, dialect) → SongReading` re-sourced onto the cifra.md parse model; each entry carries `{ at, ref, chord, bassPc, occurrence }` with the occurrence index path `{section, part, line, measure, item}`.
- `app/src/data/sources.js` — the language-independent reference list for the choro planner's `sources` ids.
- `app/src/core/DESIGN.md` §2.10 — design-delta note: `setVoicingsForOccurrences` not carried over; cifra.md's `chooseShapes` + `write` is the write path.
- Tests: `app/src/core/voicing-plan/index.test.js` (29 tests, planner suite), `app/src/core/song-analysis.test.js` (15 tests, reading + occurrence path), `app/src/core/voicing-plan/apply.test.js` (5 tests, canonical round-trip, thumb, missing, duplicate-name throws).
