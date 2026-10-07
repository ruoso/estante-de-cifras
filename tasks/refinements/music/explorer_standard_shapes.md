# music.explorer_standard_shapes — Star a shape on the standard-guitar fallback

## TaskJuggler entry

[`tasks/55-music.tji`](../../55-music.tji), `task music.explorer_standard_shapes`
("Star a shape on the standard-guitar fallback"), under `task music` (which
`depends foundation.music_core_import`).
`depends !explorer, !instruments`.

`note`: *"Starring a shape when the in-use instrument is the synthesized
standard-guitar fallback (id: null) cannot persist because shapes.json is keyed
by instrument id (home-book §4.4) and standardEntry.shapes is always empty.
Materialize the standard as a real instrument with a reserved shapes id on first
star, so the write path works identically to any named instrument.
Source-of-debt: tasks/refinements/music/explorer.md (tech-debt note),
home-book-format.md §4.4. Tests: behavior (star a shape on the standard fallback,
confirm the leaf persists in shapes.json and is read back by the explorer)."*

## Effort estimate

1d (`allocate team`), unchanged from the `.tji`. The explorer screen, the star
control, the `SAVE_SHAPE`/`REMOVE_SHAPE` write path, the diagram, the roster and
the my-shapes review are **all already shipped** (`music.explorer`,
`music.instruments`, both Done). This task adds no screen and no new user-facing
control. The weight is a **small, surgical correctness fix in the Worker**: give
the synthesized standard entry a stable reserved id, materialize it into
`instruments.json` on first star (the `§2.1` lazy write the design already
anticipates), and set it in use — so the generic shape-write path round-trips
for the fallback exactly as it does for any named instrument. One pure
change-set builder, one branch in the `SAVE_SHAPE` arm, and a small display
audit for the now-materialized entry.

## Repository

**estante-de-cifras** only. App work (the note does not start with `cifra.md:`).
Nothing lands in `/home/ruoso/devel/cifra.md`; **no spec, reference or corpus
change**, and **no design delta** (see Decisions — materialization is the
already-designed lazy write of home-book-format §2.1, and the reserved id is an
app-internal instrument id, which the format holds opaque, §4.3). Directories
touched:

- `app/src/worker/instruments.js` — the projection that synthesizes the standard
  fallback. Give `standardEntry()` a stable **reserved id** (today `id: null`,
  L150), add a pure **materialization change-set builder**
  (`standardMaterialization()`, mirroring the shipped `instrumentRemoval`), and
  have `surfaceInstruments` stop synthesizing the standard once the reserved
  instrument is materialized in `instruments.json` (so the roster entry, which
  carries live shapes, is the single in-use entry).
- `app/src/worker/logic.js` — one branch in the `SAVE_SHAPE` arm (L1325): when
  the payload id is the reserved standard id and `instruments.json` holds no live
  entry for it, write the definition + rules registers (mirroring the
  `SAVE_INSTRUMENT` add branch, L1204–1225) and set `preferences.instrumentInUse`
  to the reserved id when absent — all through `home-book.set`, under the same
  lock, before the `shapes.json` write that already runs.
- `app/src/instruments/` and `app/src/instruments/MyShapes.jsx` /
  `InstrumentChip.jsx` — **display audit only**: any place that detects the
  synthesized fallback by `entry.id == null` (or treats a null id as "not a real
  instrument") migrates to an explicit flag, and the now-materialized
  reserved-id entry renders as *Guitar · Standard* through the **existing**
  catalogue/tuning name derivation (no new copy).
- `app/src/music/` — **consumed, not modified**: `ChordExplorer.jsx` already
  sends `SAVE_SHAPE { id: entry.id, … }` (L119) and reads starred state from
  `entry.shapes` (L94–97); with the reserved id on the standard entry it sends
  the reserved id and reads the star back **with no explorer change**.
- Tests: `app/src/worker/instruments.test.js` (unit, extended) and
  `app/src/music/StandardShapeStar.behavior.test.jsx` (new behavior).

## Inherited dependencies

Both settled.

- **`music.explorer`** (`!explorer`) — Done 2026-10-06
  ([`tasks/refinements/music/explorer.md`](explorer.md)). Built the explorer
  screen, the star, and the `SAVE_SHAPE`/`REMOVE_SHAPE` write path this task
  fixes for one case. Its Status and Decisions record the tech-debt this task
  resolves: the star writes `shapes.json[id][tuning][chord]` through
  `home-book.set`, keyed by the in-use entry's id; it left the
  **standard-fallback id (`null`)** persistence gap that the `.tji` note names.
  `ChordExplorer.jsx` `toggleStar` (L117–141) and the starred-state read
  (L94–97) are unchanged by this task.
- **`music.instruments`** (`!instruments`) — Done 2026-10-06
  ([`tasks/refinements/music/instruments.md`](instruments.md)). Built the home
  book instrument model this task extends: `surfaceInstruments`, `resolveRules`
  and the pure `instrumentRemoval` change-set builder in
  [`app/src/worker/instruments.js`](../../../app/src/worker/instruments.js); the
  `SAVE_INSTRUMENT` add branch in
  [`app/src/worker/logic.js`](../../../app/src/worker/logic.js) (L1185–1232) that
  this task's materialization mirrors; the roster, the header chip
  ([`InstrumentChip.jsx`](../../../app/src/instruments/InstrumentChip.jsx),
  `inUseEntry` L17–24) and the per-instrument my-shapes review
  ([`MyShapes.jsx`](../../../app/src/instruments/MyShapes.jsx)); and the
  behavior-test stack (a real Worker over `fake-indexeddb` + `startGitHttpRemote()`,
  the `preferences_surface` template). It is the refinement that decided *absent
  `instrumentInUse` means the standard guitar, a lazy write* (its Decision at
  L475–486) — the decision this task finally writes out on first star.

## What this task is

When the user has set up **no instrument**, the app shows the **synthesized
standard guitar** — `fromCatalog('6guitar', 'Standard')`, nothing stored
(workflow 15 L71–74; `standardEntry()`,
[`app/src/worker/instruments.js`](../../../app/src/worker/instruments.js)
L142–162). Its `id` is `null` and its `shapes` is a hardcoded `[]`. So when the
explorer stars a shape while this fallback is in use, the write keys on a null id
(`shapes.json[null][tuning][chord]`) and the read never comes back:
`standardEntry()` always reports `shapes: []`, so the star silently fails to
stick (the bug the `.tji` note describes).

This task gives the standard guitar a **stable reserved id** and **materializes
it as a real `instruments.json` instrument on the first star** — the lazy write
the home-book format already contemplates (§2.1: *"the app creates each [file]
lazily, the first time it has something to put in it"*; workflow 15 L74: the
standard guitar is *"a lazy write"*). From that first star on, the standard
guitar is an ordinary named instrument: it is in the roster, in use, reviewable
in the my-shapes list, and its shapes are written and read back through the
**exact same generic path** as any instrument the user added by hand. No screen,
no control and no copy is added; the explorer and its star are untouched.

## Why it needs to be done

It is the registered follow-up to `music.explorer`'s one unhandled star case.
The standard guitar is the **default instrument for every user who has not set
one up** (workflow 15 L71–74) — the single most common state in which someone
opens the explorer. Leaving the star broken there means *your shape* silently
fails for the default instrument, the fallback the reading view's chain
(`music.fallback`, workflow 2) will later consume. Fixing it closes the gap for
the common case without widening the write path: the point is that the fallback
star becomes **indistinguishable** from a named-instrument star, so every
downstream consumer (`music.fallback`, the my-shapes review) sees one uniform
shape store.

## Inputs / context

Normative (read before scoping):

- **The `.tji` note** — the work order above: *materialize the standard as a
  real instrument with a reserved shapes id on first star, so the write path
  works identically to any named instrument.*
- **home-book format §2.1** —
  [`docs/home-book-format.md`](../../../docs/home-book-format.md) L74–94: the
  seven tracked files; *"A settling file that is absent is read as the empty map
  `{}`: the app creates each lazily, the first time it has something to put in
  it"* (L89–91). This is the licence for materializing `instruments.json` on
  first star.
- **home-book format §4.3 `instruments.json`** — L255–273: keyed by **instrument
  id**, each a map of two registers `definition` + `rules`; the id, the
  definition value and the rules value are **opaque** to the format (the music
  core and `design.instruments` own the schema). No reserved-id scheme is
  contemplated or forbidden — the format validates the envelope, not the id.
- **home-book format §4.4 `shapes.json`** — L275–293: keyed **instrument id →
  tuning → chord**, leaf `{ value, at }`, value the opaque shape; the chord key
  is *the chord as the music core matches it* (by chord, not spelling). The id
  key is what this task repairs: a stable reserved id instead of `null`.
- **Workflow 15** —
  [`docs/workflows/15-set-up-an-instrument.md`](../../../docs/workflows/15-set-up-an-instrument.md):
  the roster and switching (L60–69); the in-use singleton *absent meaning the
  standard guitar … a lazy write* (L71–82); adding an instrument and *setting up
  Guitar · Standard … leaves … instruments in the roster* (L84–100); *removing
  the in-use or the last instrument falls back to the standard guitar* (L189).
- **DIRECTION §3.2 / §3.7** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md): personal state commits
  automatically — starring is a preference, no explicit save (L136–151); the
  Worker owns the data, the main thread never touches IndexedDB or git
  (L394–434).

The seams, on disk (the fix lives entirely in the first two):

- **The synthesized fallback** —
  [`app/src/worker/instruments.js`](../../../app/src/worker/instruments.js):
  `STANDARD_TUNING = 'E2 A2 D3 G3 B3 E4'`, `STANDARD_CATALOG = '6guitar'`,
  `STANDARD_FRETS = 22` (L36–38); `standardEntry()` (L142–162) returns
  `{ id: null, catalogId: '6guitar', label: null, tuning: STANDARD_TUNING,
  fretCount, …, shapes: [] }`; `surfaceInstruments({ instruments, preferences,
  shapes })` (L173–186) builds the roster via `buildEntry`, resolves `inUseId`
  from `preferences.instrumentInUse` (forced to `null` when not in the roster,
  L184), and returns `{ instruments: roster, inUseId, standard: standardEntry() }`.
  `buildEntry(id, node, shapesModel)` (L108–138) reads a real entry's shapes live
  via `shapesForId(shapesModel, id)` (L89–103, L136) — the path the materialized
  standard will use.
- **The in-use resolution** —
  [`app/src/instruments/InstrumentChip.jsx`](../../../app/src/instruments/InstrumentChip.jsx)
  `inUseEntry(slice)` (L17–24): returns the roster entry matching `inUseId`, else
  `slice.standard` — so before materialization the explorer's `entry` is the
  synthesized standard, and after it is the roster entry.
- **The write path** —
  [`app/src/worker/protocol.js`](../../../app/src/worker/protocol.js)
  `SAVE_SHAPE` (L168) / `REMOVE_SHAPE` (L167), payloads `{ id, tuning, chord,
  shorthand, author }` / `{ id, tuning, chord, author }` (L157–162); the arms in
  [`app/src/worker/logic.js`](../../../app/src/worker/logic.js): `SAVE_SHAPE`
  L1325–1344 (writes `changes: [{ path: [id, tuning, chord], value: shorthand }]`
  through `home-book.set`, then `surfaceHomeBookInstruments()` + `flush()`),
  `REMOVE_SHAPE` L1346–1361 (same, `value: null`). The **template to mirror** is
  the `SAVE_INSTRUMENT` add branch L1204–1225: `const newId =
  crypto.randomUUID()` (L1205), writes `[newId,'definition']` + `[newId,'rules']`
  (L1211–1212), then sets `instrumentInUse = newId` when none is set (L1216–1225).
- **The explorer (consumed, not modified)** —
  [`app/src/music/ChordExplorer.jsx`](../../../app/src/music/ChordExplorer.jsx):
  `toggleStar` builds `{ id: entry.id, tuning: entry.tuning, author }` (L119) and
  sends `SAVE_SHAPE`/`REMOVE_SHAPE`; starred state is `entry.shapes` filtered to
  the tuning (L94–97). With the reserved id on `standardEntry`, both already do
  the right thing.
- **`home-book.set`** —
  [`app/src/worker/home-book.js`](../../../app/src/worker/home-book.js)
  (L213–234): applies register changes under one lock, writes canonical form,
  auto-commits with a content-free message, **no push**. `applyChange` writes a
  `{ value, at }` register at the key path (a `null` value is a tombstone), with
  last-write-wins by `at`.
- **The catalogue and rules defaults** —
  [`app/src/core/instrument.js`](../../../app/src/core/instrument.js)
  `fromCatalog`, `defaultPresetFor` (`'strumming'` for `6guitar`);
  [`app/src/instruments/AddInstrumentForm.jsx`](../../../app/src/instruments/AddInstrumentForm.jsx)
  L129 (`definition = { catalogId, label, tuning, fretCount }`) — the exact
  definition shape the materialization must produce;
  [`app/src/instruments/instrument-helpers.js`](../../../app/src/instruments/instrument-helpers.js)
  `buildShape(entry, shape)` (L75–94) reconstructs a drawable from
  `entry.catalogId/fretCount/config` + `shape.tuning` — all present on the
  materialized standard, so it draws identically.
- **Test harness** — the behavior stack
  (`app/src/test/loopback.js`, `app/src/test/git-http-remote.js`,
  `app/src/test/web-locks.js`, `fake-indexeddb`) exactly as `music.instruments`
  and `music.explorer` wired it, and the unit file
  `app/src/worker/instruments.test.js`.

## Constraints / requirements

- **Materialize, do not re-synthesize.** On the first star while the standard
  fallback is in use, the Worker writes a real `instruments.json` entry under a
  **reserved id** and sets it in use, through `home-book.set` (canonical,
  auto-committed, no push). From then on the entry is surfaced by `buildEntry`
  with live shapes like any other; the synthesized `standard` is **not** sent in
  the roster payload once the reserved entry is materialized (so there is one
  in-use entry, not two sharing an id).
- **One reserved id, stable across devices and sync.** The materialized standard
  MUST use a **fixed reserved id** — never a fresh `crypto.randomUUID()` — so two
  offline devices that each star on the fallback materialize the **same** key and
  the key-by-key merge (home-book §5) converges on **one** standard guitar, not
  two. The reserved id MUST NOT be `null` (it stringifies to the fragile key
  `"null"`) and MUST NOT be a value `crypto.randomUUID()` can emit. It is exported
  as a named constant for the write path and the tests.
- **The write path is unchanged and generic.** `SAVE_SHAPE`/`REMOVE_SHAPE` keep
  keying `shapes.json[id][tuning][chord]` for whatever id they are handed; the
  only addition is the one-time materialization branch before the shape write.
  The explorer is **not** modified: it already sends `entry.id` and reads
  `entry.shapes`, both correct once `standardEntry` carries the reserved id.
- **The Worker owns the data (offline first).** All three writes (the shape, the
  instrument definition+rules, the in-use preference) go through `home-book.set`
  under one lock, committed automatically, **no push** (syncs later, workflow 8).
  The main thread never touches IndexedDB or git. Starring never waits on a
  network and never needs an account or a book.
- **Canonical form, matched by chord.** The stored shape value is the fret-string
  shorthand (cifra.md §7), recomputed to a diagram on load; the chord key is the
  chord as the music core matches it (home-book §4.4). The materialized
  definition is the canonical `{ catalogId: '6guitar', label, tuning:
  STANDARD_TUNING, fretCount: 22 }` + rules `{ preset: 'strumming' }` — exactly
  what hand-adding *Guitar · Standard* writes (AddInstrumentForm L129,
  `defaultPresetFor('6guitar')`).
- **Never into a song.** Unchanged from `music.explorer`: starring changes only
  the home book. No song text ever reaches a log.
- **Display parity (accessibility / standing rules).** The now-materialized
  reserved-id entry MUST render identically to a hand-added *Guitar · Standard*
  in the chip, the roster and the my-shapes review — through the **existing**
  catalogue·tuning name derivation, with **no new copy** and no colour-only
  status. Any fallback detection that keyed off `entry.id == null` migrates to an
  explicit flag so a materialized standard is treated as the real instrument it
  now is. No new interactive surface is introduced, so React Aria coverage and
  the axe gate are inherited from the (unchanged) explorer and instrument
  screens; the behavior test still runs axe on what it renders.

## Acceptance criteria

### Behavior delivered

1. **A star on the standard fallback persists.** With no instrument set up (in
   use = the synthesized standard), starring a shape in the explorer writes one
   leaf `shapes.json[<reserved-id>][tuning][chord] = { value: shorthand, at }`
   through `home-book.set` (canonical, auto-committed, no push), and the explorer
   **reads it back** — the shape draws `kind="yours"` and its star is pressed.
   Unstarring tombstones the same leaf (workflow 16 L108–133; home-book §4.4).
2. **The standard is materialized as a real instrument on first star.** The same
   first star writes `instruments.json[<reserved-id>]` with `definition =
   { catalogId: '6guitar', label, tuning: 'E2 A2 D3 G3 B3 E4', fretCount: 22 }`
   and `rules = { preset: 'strumming' }`, and sets `preferences.instrumentInUse`
   to the reserved id (it was absent). The entry then appears in the roster, in
   use, and reviewable in the my-shapes list — indistinguishable from a
   hand-added *Guitar · Standard* (workflow 15 L84–100, L71–74; home-book §2.1,
   §4.3). A second star adds another leaf without re-writing the definition or
   changing the in-use (idempotent materialization).
3. **One reserved id, converging.** The reserved id is a fixed constant, never a
   fresh UUID, so a materialization on one device and another on a second device
   merge to **one** standard guitar after sync (home-book §5). The synthesized
   `standard` is no longer emitted in the roster payload once the reserved entry
   exists, so there is exactly one in-use entry.
4. **Display parity.** The materialized standard renders as *Guitar · Standard*
   in the chip, the roster and the my-shapes review through the existing name
   derivation, with no new copy and no fallback-only special-casing by null id.
5. **Offline, no account.** Every write is local and commits automatically;
   nothing waits on a network; no book or membership is involved (DIRECTION §3.2,
   §3.7; workflow 16 L164–170).

### Tests the task lands with, by level

- **unit — `app/src/worker/instruments.test.js`** (Vitest, no DOM; extended).
  The pure materialization change-set builder (`standardMaterialization()`,
  beside the shipped `instrumentRemoval`): it emits the **reserved-id** definition
  register (`{ catalogId: '6guitar', label, tuning: 'E2 A2 D3 G3 B3 E4',
  fretCount: 22 }`) and rules register (`{ preset: 'strumming' }`) under the
  reserved id; the reserved id constant is **stable, non-null, and not
  UUID-shaped**; and `surfaceInstruments` stops emitting the synthesized
  `standard` once `instruments.json` holds the reserved entry (and keeps emitting
  it otherwise). *Pins:* the `.tji` phrase "materialize the standard as a real
  instrument with a reserved shapes id"; home-book §4.3; §2.1 (the lazy write);
  workflow 15 L71–74. (A pure builder + unit test mirrors `music.instruments`'s
  `instrumentRemoval`; it is added over the `.tji`'s named level because the
  reserved-id/definition shape is cleanly pure and worth pinning without the
  Worker.)
- **behavior — `app/src/music/StandardShapeStar.behavior.test.jsx`** (new; React
  Testing Library + real React Aria + i18n + a loopback-backed **real Worker**
  over `fake-indexeddb` + `startGitHttpRemote()`, the `preferences_surface`
  template, exactly as `music.instruments`/`music.explorer` wired it). Starting
  with **no instrument configured** (in use = the synthesized standard): render
  the explorer for a chord, **star a shape**, and assert (a) the leaf persists in
  `shapes.json` under the reserved id and is **read back by the explorer** (the
  shape draws *your shape* / `kind="yours"`, its star pressed); (b)
  `instruments.json` now holds the reserved entry and it is **in use**; (c) the
  materialized standard appears in the **my-shapes review**
  (`app/src/instruments/MyShapes.jsx` reads it back); (d) **unstarring**
  tombstones the leaf; (e) a second star does not re-materialize; **axe clean**
  on what is rendered. *Pins:* the `.tji` behavior clause "star a shape on the
  standard fallback, confirm the leaf persists in shapes.json and is read back by
  the explorer"; workflow 15 L71–82, L84–100; home-book §4.4, §4.3, §2.1;
  DIRECTION §3.2.

No e2e-web level is added (Decisions): the task introduces no new screen or
visible control, and `e2e/web/tests/explorer.spec.js` already drives the
star-as-my-shape journey with axe on three viewports over the compose stack. All
named tests land in this task and run (not skipped) in `scripts/gate`.

### Deferred work / graph notes

- **No deferred WBS leaf.** The fix is self-contained; nothing is split out.
- **Graph note (closer):** this task `depends !explorer, !instruments` — both
  Done — and belongs to the same milestone as `music.explorer`. No new edge is
  needed.
- **Downstream (not this task):** `music.fallback` will consume a starred *your
  shape* (now including one starred on the materialized standard) as a
  reading-view fallback source; it is already a WBS leaf.

## Decisions

- **A fixed reserved id, not a fresh UUID.** *Chosen:* materialize the standard
  under one reserved constant id (exported from `app/src/worker/instruments.js`,
  e.g. `STANDARD_INSTRUMENT_ID = 'standard'`). *Rejected:* a
  `crypto.randomUUID()` like every hand-added instrument. The random-UUID path
  breaks convergence: two offline devices each starring on the fallback would
  materialize **different** standard-guitar ids, and the home book's key-by-key
  merge (home-book §5) keeps both — the user ends up with two "standard guitars"
  that never reconcile. A fixed id guarantees both devices write the **same**
  key and merge to one. The value must not be `null` (it stringifies to the
  fragile `"null"` key — the present bug) and must be outside the UUID space
  `crypto.randomUUID()` can produce (any non-UUID string, e.g. `'standard'`,
  satisfies this; the implementer may instead pick a reserved fixed UUID if any
  code assumes UUID-shaped ids — either satisfies *reserved, stable,
  collision-free*).
- **Materialize on first star — the designed lazy write; no design delta.**
  *Chosen:* write `instruments.json[<reserved>]` (definition + rules) and set
  it in use the first time a shape is starred while the fallback is in use.
  This is **exactly** the lazy write home-book §2.1 prescribes (*"the app creates
  each [file] lazily, the first time it has something to put in it"*) and that
  workflow 15 L74 names for the standard guitar (*"a lazy write"*); it preserves
  the invariant *the in-use is the standard guitar* (before the first star,
  `instrumentInUse` is absent = the standard; after, it is the reserved id =
  the standard, now explicit). `music.instruments` deferred exactly this: its
  Decision (L475–486) said *absent means the standard guitar, nothing stored*
  because, until there is a shape to store, there is nothing to put in
  `instruments.json`. So **no DIRECTION / workflow / format delta** is required —
  the behavior is already designed; this task implements it. *Rejected:* storing
  nothing and instead teaching the read path to synthesize shapes for a null id
  — that would special-case the fallback through the whole read path forever,
  the opposite of the `.tji`'s "works identically to any named instrument", and
  would still leave the shape store keyed on a null id.
- **Set the materialized standard in use.** *Chosen:* mirror the
  `SAVE_INSTRUMENT` add branch's "first instrument becomes in use when none is"
  (logic.js L1216–1225): on materialization, set `instrumentInUse` to the
  reserved id when it is absent. Without this the roster would hold the
  materialized entry while `inUseEntry` still returned the synthesized `standard`
  (shapes `[]`), and the star would not read back. Setting it in use makes the
  roster entry the one the explorer reads — and matches workflow 15's "first add
  sets it in use". *Rejected:* leaving in-use absent and having the synthesized
  entry read `shapesForId(<reserved>)` — a second code path to the same data,
  and two entries sharing the reserved id in the payload.
- **The explorer and the UI are not changed.** *Chosen:* the fix is entirely in
  the Worker projection and the `SAVE_SHAPE` arm; `ChordExplorer.jsx` already
  sends `entry.id` and reads `entry.shapes`, so once `standardEntry` carries the
  reserved id both are correct. The only view-side work is a **display audit**:
  migrate any `id == null` fallback test to an explicit flag so a materialized
  standard is rendered as a real instrument. *Rejected:* a bespoke explorer
  branch for the fallback — it would duplicate the write path the task is meant
  to unify.
- **No new e2e; behavior + a pure unit.** *Chosen:* pin the fix with the `.tji`'s
  named behavior test (real Worker, read-back and my-shapes) plus a small pure
  unit for the reserved-id change-set builder. *Rejected:* a new e2e-web spec —
  the task adds no screen or visible control, and `explorer.spec.js` already
  exercises the star journey end-to-end with axe on three viewports; a
  behavior-level test is the proportionate home for a Worker persistence fix.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- `app/src/worker/instruments.js` — exported `STANDARD_INSTRUMENT_ID = 'standard'` (reserved, non-null, non-UUID constant); `standardEntry()` carries it as `id` instead of `null`; `surfaceInstruments` stops synthesizing the `standard` once the reserved entry is materialized in `instruments.json`; new pure `standardMaterialization()` change-set builder (mirrors `instrumentRemoval`, idempotent — emits `definition` + `rules` registers under the reserved id and sets `instrumentInUse` when absent).
- `app/src/worker/logic.js` — one branch added in the `SAVE_SHAPE` arm: on first star while the reserved standard id is in use and not yet in `instruments.json`, calls `standardMaterialization()` and writes definition + rules + `instrumentInUse` through `home-book.set` under the lock, before the generic shape write (mirrors the `SAVE_INSTRUMENT` add branch).
- Display audit: no view keyed off `id == null` required migration — chip/roster/my-shapes already render generically via `displayLabel`/`entry.id`; the materialized standard (label `null`) renders through the existing catalogue·tuning name derivation.
- Unit tests extended in `app/src/worker/instruments.test.js` (17 tests total): reserved-id stable/non-null/non-UUID; `standardMaterialization()` emits definition + rules and sets in-use; leaves in-use alone when already set; idempotent; `surfaceInstruments` stops synthesizing once materialized.
- New behavior test `app/src/music/StandardShapeStar.behavior.test.jsx` (3 tests, real Worker over `fake-indexeddb` + `startGitHttpRemote()`): star persists under reserved id, reads back (`kind="yours"`, star pressed), standard materialized in use, appears in my-shapes, axe clean; second star adds leaf without re-materializing or changing in-use; unstar tombstones the leaf.
