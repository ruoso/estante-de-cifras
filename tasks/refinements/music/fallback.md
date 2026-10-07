# music.fallback — Where a chord's shape comes from

## TaskJuggler entry

[`tasks/55-music.tji`](../../55-music.tji), `task music.fallback`
("Where a chord's shape comes from"), under `task music` (which
`depends foundation.music_core_import`).
`depends !instruments, cifra_js.reader`.

`note`: *"The song's choice, then my shape, then the app's default; each
marked for what it is. Workflow 2. Tests: unit (the song's choice, then my
shape, then the default, each marked for what it is)."*

## Effort estimate

1d (`allocate team`), unchanged from the `.tji`. Everything the resolver
reaches for is already in hand: the parsed-song model (`cifra_js.reader`,
Done), the fingering search and `defaultVoicing` (carried core, Done), the
`shapes.json` read path and the in-use instrument with its effective rules
(`music.instruments`, Done), and the three provenance buckets already modelled
by the shipped `ChordDiagram` (`song | yours | default`). The weight is a
single pure core function — the three-level resolver — plus rewiring the
already-carried `unvoiceableKeys` to the cifra.md model, and its unit tests.
No React, no view, no Worker command: this is the parser-free primitive the
reading view (`songs.reading`), the wizard (`music.wizard`) and transposition
(`music.transpose`) all consume.

## Repository

**estante-de-cifras** only. App work (the note does not start with
`cifra.md:`). Nothing lands in `/home/ruoso/devel/cifra.md`; §7.6 of its
specification governs the song's-choice step and is already written — no spec,
reference or corpus change. Directories touched:

- `app/src/core/voicings.js` — **extended**. Today it carries only
  `defaultVoicing(chord, instrument)` (the app's default) and
  `unvoiceableKeys(parsed, resolved)`, both **exported but uncalled** — the
  stub this task grows into. Add the three-level resolver
  `resolveSongVoicings`, and rewire `unvoiceableKeys` (and the resolver's
  occurrence walk) from the old Explore Chords `parsed.occurrences` shape to
  the cifra.md parsed model. Stays pure, synchronous and framework-free
  ([`app/src/core/DESIGN.md`](../../../app/src/core/DESIGN.md) §3.2; DIRECTION
  §3.7 "framework-free below the view").
- `app/src/core/voicings.test.js` — **extended** with the named unit cases
  below (the file exists; it tests `defaultVoicing`/`unvoiceableKeys` today).
- `app/src/core/`, `app/src/data/` — **consumed, not modified**:
  `search.js` (`searchFingerings`, `fingeringFromFrets`), `fretstring.js`
  (`parseShorthand`), `chord.js` (`sameChord`, `parseChord`), `instrument.js`
  (`configFor`, the instrument instance), `data/instruments.js`.
- `cifra.md` (the JS package `cifra-md`) — **consumed, not modified**: `parse`
  gives the model this reads (`app/` imports it via the music stream's wiring).

No design delta. Workflow 2 §"Where a chord's shape comes from" and cifra.md
§7.6 already settle the behaviour down to the ordering and the no-fallback
rule; the three-way `source` the resolver emits already has its render-side
twin in `ChordDiagram`'s `kind`. Nothing here deviates from a governing
document or adds a seam beyond one core function.

## Inherited dependencies

Both settled.

- **`music.instruments`** (`!instruments`, same milestone) — Done 2026-10-06
  ([`tasks/refinements/music/instruments.md`](instruments.md)). Supplies the
  model the resolver reads: the **instrument in use** (a `preferences.json`
  singleton `instrumentInUse.value` = an instrument id, absent = the standard
  guitar), its **effective voicing rules** (a `HeuristicConfig` derived by
  `resolveRules` in [`app/src/worker/instruments.js`](../../../app/src/worker/instruments.js),
  with `rootInBass` re-clamped by `hasBassRegister`), and **my shapes** —
  `shapes.json` keyed instrument id → tuning → chord, surfaced to the UI as
  `entry.shapes: {tuning, chord, shorthand}[]` on the `INSTRUMENTS` event
  (`shapesForId`, `surfaceInstruments`). The sibling tasks `music.explorer`
  (Done) and `music.explorer_standard_shapes` (Done) built the **write** path
  (`SAVE_SHAPE`/`REMOVE_SHAPE`, `STANDARD_INSTRUMENT_ID = 'standard'`
  materialised on first star) and the by-chord match helper
  `starredShorthands(chord, shapes)` in
  [`app/src/music/fingering-groups.js`](../../../app/src/music/fingering-groups.js)
  — `sameChord`, not spelling. This task is the **read**-side counterpart: it
  consumes `entry.shapes` and never writes.
- **`cifra_js.reader`** — Done 2026-10-05 (cifra.md `9eb9a7c`,
  [`tasks/refinements/cifra_js/reader.md`](../cifra_js/reader.md)). The
  `cifra-md` package's `parse(bytes) → model` (§1–§7). The model this resolver
  walks:
  - **Chart chord items** (`cifra.md/js/src/parse.js:161`):
    `{ type: 'chord', symbol, index, key, chord, ambiguities? }`, inside
    `model.sections`. `key` is the §2.4 voicing key — `keyFor(symbol, index)`
    (`parse.js:105`), `Cm` for the first, `Cm[2]` for a repeat. `chord` is the
    dialect-free §5.2 chord model from `parseChord`. Non-chord tokens are
    `{ type: 'unknown', text }` and are not chord items.
  - **Voicing blocks** (`parse.js:575`):
    `{ label, tuning: { text, pitches, id }, voicings, notes }`. `label` is the
    variation name, the **default variation being `""`**. `tuning.id` is the
    §6.3 sound identity (MIDI pitch classes, so `Eb2`≡`D#2`). A voicing item
    (`parse.js:614`): `{ key, symbol, index, frets, fingers? }`, `frets` an
    array of `int | 'x'`, `fingers` an array of `int(1–4) | 'T' | null` when
    the song gave a valid fingering. Blocks are ordered by tuning id then
    default-variation-first (`parse.js:1031–1052`).

## What this task is

A **pure resolver** that, given a parsed song, the instrument in use and the
user's saved shapes, decides for every chord in the chart **which shape to show
and where it came from** — the song's choice, then my shape, then the app's
default, in that order, each marked for what it is (workflow 2, DIRECTION §3.2).
It is the read-time realisation of cifra.md §7.6, whose step 3 — "a chord with
no chosen shape takes a default" — the spec deliberately leaves to the app
(§7.6 lines 224–233: *"No chosen shape" is a defined outcome, not an error*).

Concretely, in `app/src/core/voicings.js`:

```
resolveSongVoicings(parsed, instrument, { variation = '', shapes = [],
                                          ignoreSongVoicings = false } = {})
  → Map<key, { source: 'song' | 'yours' | 'default', fingering: Fingering }>
```

keyed by the occurrence `key` in chart order. For each distinct chord
occurrence with a valid parsed chord:

1. **the song's choice** (`source: 'song'`) — the block for `instrument`'s
   tuning id (§6.3) and the **variation in use** (its block; none chosen → the
   default variation `label === ''`; no default → the first block for that
   tuning, `parse.js` order). Look up the occurrence's `key` in that block's
   `voicings`. Present → the shape is its `frets` (with the song's own
   `fingers` when it gave them), built into a `Fingering`.
2. **my shape** (`source: 'yours'`) — no song's choice → the shape the user
   starred for *this chord* (`sameChord`, not spelling) on this instrument and
   tuning, from `shapes` (`parseShorthand` → `fingeringFromFrets`).
3. **the app's default** (`source: 'default'`) — neither → `defaultVoicing`,
   the easiest shape the fingering search finds under the instrument's rules.

A valid chord the search cannot voice at all is **absent from the map** and
listed by `unvoiceableKeys` (rewired to walk the cifra.md model). Unknown
tokens are not chord items and are skipped (the chart still shows them marked —
"a reader never discards what it did not understand", workflow 2).

## Why it needs to be done

cifra.md §7.6 defines the first two steps of resolution and hands the default
to the app; **no component in the app performs that resolution yet**.
`defaultVoicing` sits uncalled, and `resolveSongVoicings` was left behind in
the Explore Chords checkout — DESIGN.md §2.11 deferred the document-coupled
voicing adapters to the music stream, to be rewired to the cifra.md parser
exactly here (DIRECTION §5: "`resolveSongVoicings` … take a *parsed song* as
input, so they come over with the music stream"). Until this lands:

- **`songs.reading`** cannot pair the chart with per-chord diagrams — there is
  no "chart chord → resolved shape → `ChordDiagram kind`" bridge today
  (`app/src/chart/Chart.jsx` is text-only).
- **`music.transpose`** (`depends !fallback`) has nothing to fall through to
  when it declares a transposed song *has no chosen shapes* (workflow 2).
- **`music.wizard`** (`depends !fallback`) needs the default/my-shape baseline
  its plan departs from.

This task is the one seam all three sit on.

## Inputs / context

- **Workflow 2 §"Where a chord's shape comes from"**
  ([`docs/workflows/02-find-and-play.md`](../../../docs/workflows/02-find-and-play.md)
  lines 87–108) — the normative behaviour: the three-level order (lines 90–97),
  *each marked* "the song's choice plain, *your shape*, or *default*" and "on
  paper they print alike" (lines 99–101), "My shapes match by chord, not by
  spelling, so one saved as `Cmaj7` serves a song that writes `C7M`" and are
  "applied when the song is shown and are never written into it" (lines
  106–108). The reading context (lines 68–86): a song with no voicings still
  plays, every chord taking a default marked as not the song's choice; a song
  with only some chords voiced mixes the song's shapes and defaults.
- **Workflow 2 §Transposing** (lines 111–149) — "A transposed song has no
  chosen shapes … every chord takes my shape or the app's default", even where
  a transposed chord coincides with one the song voices (lines 120–125). The
  `ignoreSongVoicings` option is the seam `music.transpose` uses to reach that
  (Decisions).
- **cifra.md [`spec/7-voicings.md` §7.6](../../../../cifra.md/spec/7-voicings.md)**
  lines 212–234 — the resolution algorithm: block by tuning (§6.3) and
  variation, then the voicing key (§2.4), else no chosen shape. Lines 224–229:
  a reader **MUST NOT** fall back from `Cm[2]` to `Cm`, from one variation to
  another, or from one tuning to another; "no chosen shape" is not an error.
  Lines 231–233: defaults are never written into the document.
  [`spec/6-tunings.md` §6.3](../../../../cifra.md/spec/6-tunings.md) lines
  58–73 — tuning identity by sound (a capo is a tuning).
- **DIRECTION**
  ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md)) §3.2 (lines 136–151) —
  *my shapes* "how the user plays a chord on an instrument, used wherever a
  song has chosen none", personal state in the home book; §3.7 (lines 394–435)
  — the music core "know[s] nothing of React; the view is the only layer that
  does"; §5 (lines 460–475) — `resolveSongVoicings`/`applySavedVoicings`
  deferred to the music stream against the new parser;
  [`app/src/core/DESIGN.md`](../../../app/src/core/DESIGN.md) §2.11 — the
  deferral target.
- **The render-side twin** —
  [`docs/mockups/README.md`](../../../docs/mockups/README.md) line 26:
  "Defaults are drawn hollow, your shapes filled in the chord colour, the
  song's own shapes filled in ink. Every status badge carries a word, never
  colour alone." [`docs/mockups/ChordBox.dc.html`](../../../docs/mockups/ChordBox.dc.html):40
  and [`app/src/diagram/ChordDiagram.jsx`](../../../app/src/diagram/ChordDiagram.jsx):29,33
  — the `kind` enum `song | yours | default`, labels `""` / "your shape" /
  "default". The resolver's `source` is named to equal this `kind` 1:1.
- **Existing core seams** —
  [`app/src/core/voicings.js`](../../../app/src/core/voicings.js):25,31
  (`defaultVoicing`, `unvoiceableKeys`);
  [`app/src/core/search.js`](../../../app/src/core/search.js):24 (the
  `Fingering` typedef), :344 (`searchFingerings`), :447 (`fingeringFromFrets`);
  [`app/src/core/fretstring.js`](../../../app/src/core/fretstring.js):20
  (`parseShorthand`); [`app/src/core/chord.js`](../../../app/src/core/chord.js):262
  (`sameChord`); `app/src/music/fingering-groups.js`:41 (`starredShorthands`,
  the by-chord match this follows). The resolver to port lives at
  `/home/ruoso/devel/explore-chords/src/core/voicings.js` — `ResolvedVoicing`
  `{ source: 'chosen' | 'default', fingering }`, `resolveSongVoicings`,
  `unvoiceableKeys`, default memoisation per symbol.

## Constraints / requirements

- **Pure, synchronous, framework-free.** It lives in `app/src/core/`, imports
  only other core modules and the `cifra-md` model, touches no IndexedDB, no
  Worker message, no React (DIRECTION §3.7; DESIGN.md §3.2). It does not read
  the home book itself — the caller passes `instrument` and `shapes` already
  surfaced by the Worker.
- **Read-only.** Resolving never mutates `parsed` and never writes a shape into
  the song. My shapes are "applied when the song is shown and are never written
  into it" (workflow 2). This is the deliberate break from Explore Chords,
  whose `applySavedVoicings` wrote a starred shape into song text — **not
  ported here**; writing shapes into a song is an explicit act (`music.wizard`,
  workflow 5).
- **The §7.6 order is exact and the no-fallback rule is absolute.** Song's
  choice → my shape → app's default, resolved per occurrence key; never fall
  from `Cm[2]` to `Cm`, across variations, or across tunings (§7.6 lines
  224–229). A match between a transposed chord and a voiced one is a
  coincidence, not a choice (workflow 2 lines 120–125) — honoured by the
  `ignoreSongVoicings` seam.
- **My shapes match by chord, not spelling, and by tuning identity.** Use
  `sameChord` against the stored shape's chord (parsed with `parseChord`), and
  the instrument's current tuning (the only tuning an instrument has), so a
  `Cmaj7` star serves a `C7M` song (workflow 2 line 106).
- **Provenance is carried, not rendered.** The resolver emits `source`
  (`song | yours | default`); the word and the fill are the view's job via
  `ChordDiagram kind`. On paper the three print alike (workflow 2 line 101) —
  the resolver draws no such distinction, it only labels the source.
- **Canonical-form / content rules** do not bite: nothing is written, so there
  is no canonical form to preserve or re-emit here.

## Acceptance criteria

### Behaviour delivered

`resolveSongVoicings(parsed, instrument, { variation, shapes,
ignoreSongVoicings })` returns, for every valid chord occurrence in the chart,
a `{ source, fingering }` marked `song`, `yours` or `default` by the §7.6 order
above; unvoiceable valid chords are absent and returned by `unvoiceableKeys`;
unknown tokens are skipped. The function is pure and leaves `parsed`
unchanged. No view, Worker command or e2e ships in this task (see Decisions).

### Tests the task lands with, by level

**unit** — `app/src/core/voicings.test.js` (Vitest, extending the existing
file), each case pinning workflow 2 §"Where a chord's shape comes from" and
cifra.md §7.6:

- **the song's choice** — a chord the song voices for the instrument's tuning
  and variation in use resolves to `{ source: 'song' }`, its `fingering` built
  from the song's own `frets`/`fingers` (workflow 2 line 90; §7.6 step 1).
- **my shape when the song chose none** — no voicing for the key, a starred
  shape for that chord on the instrument → `{ source: 'yours' }`, the starred
  shorthand (workflow 2 lines 77–79, 93).
- **my shape matches by chord, not spelling** — a shape starred as `Cmaj7`
  resolves a song written `C7M` (workflow 2 line 106; `sameChord`).
- **the app's default** — neither a song's choice nor a star → `{ source:
  'default' }`, equal to `defaultVoicing` (the easiest shape) (workflow 2 line
  96; §7.6 step 3).
- **the order holds** — a chord with all three available resolves to `song`;
  drop the song's voicing → `yours`; drop the star → `default` (the three-level
  precedence, workflow 2 lines 90–97).
- **no §7.6 fallback** — a `Cm[2]` with no voicing does not inherit `Cm`'s; a
  key absent from the in-use variation does not borrow another variation's or
  another tuning's; each falls to my shape/default, never another block (§7.6
  lines 224–229).
- **the variation in use selects the block** — two variations for the tuning:
  the in-use variation's shape is chosen; `''` (default variation) when none
  chosen; the first block when there is no default (§7.3; §7.6 step 1;
  `parse.js` ordering).
- **a mixed song** — some chords voiced, some not → the voiced keys `song`, the
  rest `yours`/`default`, in one pass (workflow 2 lines 78–79).
- **read-only** — resolving does not mutate `parsed` and writes no shape into
  the song (workflow 2 line 108; contrast the un-ported `applySavedVoicings`).
- **an unvoiceable valid chord** — absent from the map, present in
  `unvoiceableKeys` (rewired to the cifra.md model).
- **the transpose seam** — with `ignoreSongVoicings: true`, a chord the song
  voices still resolves to `yours`/`default`, never `song` (workflow 2 lines
  120–125; the path `music.transpose` consumes).

No behavior / e2e-api / e2e-web level here: the `.tji` note names **unit**
only, and that is the right fit — this is a pure, framework-free core module
whose every output is observable in-process. The screens that render its
output (the reading view pairing chart with diagrams, the variation picker,
"arrange for cavaquinho") are **`songs.reading`** and **workflow 5
(`music.wizard`)**, each landing with its own behavior and e2e-web tests against
the live resolver (the reading journey is `songs.reading`'s, per
`music.transpose`'s note).

### Deferred work

None. The resolver is complete at the unit level; its consumers
(`songs.reading`, `music.transpose`, `music.wizard`) are existing WBS leaves
that already `depend` on it, not new follow-ups. `applySavedVoicings` is not
deferred-as-debt — writing shapes into a song is a distinct, decided behaviour
owned by `music.wizard`/workflow 5, not a port of this task.

## Decisions

- **`source` is the three-way `song | yours | default`, named to equal
  `ChordDiagram`'s `kind`.** Explore Chords' resolver returned `'chosen' |
  'default'` — two buckets, because it folded starred shapes into the song text
  before reading. Here my shapes are a distinct read-time source (workflow 2's
  middle step), and the render layer already distinguishes three
  (`ChordDiagram kind`, mockups README line 26). Emitting `source` equal to
  `kind` means the view maps 1:1 with no translation table to drift. *Rejected:*
  keep `'chosen'`/`'default'` and fold my-shapes into "chosen" — loses the
  provenance the UI must show; or translate `source`→`kind` at the view — a
  needless mapping that can skew.
- **The resolver takes `instrument` and `shapes` as arguments; it does not read
  the home book.** The Worker already surfaces the in-use instrument (with its
  effective `HeuristicConfig`) and `entry.shapes` on the `INSTRUMENTS` event;
  the resolver stays a pure core function the view calls with that slice.
  *Rejected:* a resolver that reaches into storage — breaks the core/ purity
  boundary (DIRECTION §3.7) and the Worker-owns-data rule.
- **My shapes are matched by `sameChord` and the instrument's tuning, reusing
  the explorer's rule.** `starredShorthands` already matches by chord not
  spelling for the star UI; the resolver follows the same `sameChord` path so a
  starred shape and a song chord agree on identity exactly as the explorer
  shows them. One leaf per (instrument, tuning, chord) in `shapes.json` means
  one my-shape per chord — no ambiguity to break. *Rejected:* matching by
  symbol string — fails the `Cmaj7`/`C7M` case workflow 2 names.
- **The song's-choice `Fingering` keeps the song's own `fingers` when present.**
  A teacher's fingering is part of the shape they chose (§7.5.1); build the
  `Fingering` from the voicing item's `frets` preferring its `fingers`, letting
  `fingeringFromFrets` assign only when the song gave none. *Rejected:*
  re-deriving fingers always — discards the teacher's choice.
- **An `ignoreSongVoicings` option, consumed by `music.transpose`.** Rather
  than `music.transpose` forking a parallel resolver to honour "a transposed
  song has no chosen shapes", it calls this one with the song's-choice step
  suppressed — one boolean, one decided successor consumer, keeping a single
  resolution path. *Rejected:* a separate transpose-only resolver — two code
  paths for one §7.6-shaped question, a drift risk workflow 2 explicitly ties
  together (lines 120–125).
- **`unvoiceableKeys` is rewired, not rewritten anew.** The carried function
  iterates the old `parsed.occurrences`; this task points it (and the
  resolver's occurrence walk) at the cifra.md model's chart chord items across
  `model.sections`, keyed by `keyFor`. Same contract, new model shape.
- **No behavior/e2e level, no design delta.** Justified above and under
  Repository — the note names unit only and the behaviour is fully specified by
  workflow 2 and §7.6.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- Added `resolveSongVoicings(parsed, instrument, { variation, shapes, ignoreSongVoicings })` to `app/src/core/voicings.js` — the three-level resolver emitting `{ source: 'song'|'yours'|'default', fingering }` per occurrence key in chart order; rewired `unvoiceableKeys` from the old `parsed.occurrences` shape to the cifra.md model; pure, synchronous, framework-free.
- Extended `app/src/core/voicings.test.js` with 12 new unit cases covering the song's choice (with song's own fingering kept), my shape by chord not spelling (`Cmaj7`↔`C7M`), the app's default, three-level order, no §7.6 fallback (key/variation/tuning), variation selection (named / `''` default / first-when-no-default), mixed song in one pass, read-only (no mutation), unvoiceable valid chord absent + in `unvoiceableKeys`, and the `ignoreSongVoicings` transpose seam; 15 tests total pass.
