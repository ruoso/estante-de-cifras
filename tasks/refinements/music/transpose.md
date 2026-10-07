# music.transpose — "Transposing for reading"

## TaskJuggler entry

[`tasks/55-music.tji`](../../55-music.tji), `task transpose` inside
`task music` (`depends foundation.music_core_import`):

```
task transpose "Transposing for reading" {
  effort 2d
  allocate team
  depends !fallback, shell.chart
  note "..."
}
```

The note, verbatim:

> _View only, never the song; no chosen shapes while transposed; spelling by
> the key property or fewest accidentals; remembered per song in the home
> book. Workflow 2. Tests: unit (spelling by the key property or fewest
> accidentals; no chosen shapes while transposed; remembered per song);
> behavior (a transposed chart rendered, the song untouched). The reading
> journey is songs.reading's._

`!fallback` is the same-milestone sibling shorthand for
[`music.fallback`](./fallback.md).

## Effort estimate

2d (`allocate team`), unchanged from the `.tji`. The heavy pieces already
exist: diatonic, correctly-spelled note transposition
(`transposeNote`/`transposePitch`, `app/src/core/pitch.js`), chord parsing
and formatting (`app/src/core/notation/`), the three-level voicing resolver
with its `ignoreSongVoicings` seam built for exactly this task
(`app/src/core/voicings.js`), the chart renderer
(`app/src/chart/Chart.jsx`), and the on-disk `transposition` register
(`docs/home-book-format.md` §4.5). The weight here is the chord-level glue —
choosing one global spelling for a semitone offset and re-rooting every
symbol without touching the song — plus the pure per-song read/write seam
and the tests that pin all three promises.

## Repository

**estante-de-cifras** only. App work: the note does not start with
`cifra.md:`. Nothing lands in `/home/ruoso/devel/cifra.md`; this task carries
**no spec, reference or corpus change** (see Decisions — the cifra.md
specification deliberately leaves transposition to the app) and **no design
delta** (the behavior is settled in workflow 2 and the mockups, and the
`transposition` register is already fixed in `docs/home-book-format.md`
§4.5).

Directories touched:

- `app/src/core/transpose.js` — **new**: the pure transposition engine.
- `app/src/core/transpose.test.js` — **new**: unit tests (spelling,
  immutability, the no-chosen-shapes composition, key naming).
- `app/src/worker/songs.js` — **new**: the pure per-song reading-state seam
  (`transpositionOf`, `transpositionChange`), a home-book projection
  mirroring `app/src/worker/preferences.js` and `app/src/worker/instruments.js`.
- `app/src/worker/songs.test.js` — **new**: unit tests for the seam.
- `app/src/chart/Chart.transpose.behavior.test.jsx` — **new**: the behavior
  test (a transposed chart rendered, the song untouched; axe).
- `app/src/core/pitch.js` — **consumed, not modified**: `interval`,
  `degreeToInterval`, `transposeNote` (:81, :94, :113).
- `app/src/core/notation/parse.js`, `.../format.js` — **consumed, not
  modified**: `parseChord` (:136), `formatChord` (:240).
- `app/src/core/chord.js` — **consumed, not modified**: `chord(root,
  quality, extensions, bass)` (:103).
- `app/src/core/voicings.js` — **consumed, not modified**: `resolveSongVoicings`
  and its `ignoreSongVoicings` option (:145, :140-142, :151).
- `app/src/chart/Chart.jsx`, `app/src/chart/layout.js` — **consumed, not
  modified**: `Chart` takes a plain model and draws `item.symbol` (:87-99;
  `chordText`, layout.js:27-42).

## Inherited dependencies

Both settled.

- **[`music.fallback`](./fallback.md)** (Done 2026-10-06) — `resolveSongVoicings`
  in `app/src/core/voicings.js:145`, with the `source: 'song' | 'yours' |
  'default'` provenance enum and, decisively, the `ignoreSongVoicings`
  option (`voicings.js:140-142, 151`) added as "the seam music.transpose
  uses for 'a transposed song has no chosen shapes'." This task consumes
  that seam; it does not reopen the resolver.
- **[`shell.chart`](../shell/chart.md)** (Done 2026-10-05) — `Chart`
  (`app/src/chart/Chart.jsx:87`) draws a cifra.md parse model's chord
  symbols over their syllables, importing no parser (the Worker owns
  parsing; the model crosses as plain data). The model shape is
  `{ title, properties, sections, blocks, sung, sungAt, diagnostics }`; a
  chord item is `{ type:'chord', symbol, index, key, chord, ... }`
  (chart.md:99-120). The chart has no transpose awareness; it renders
  whatever model it is given.

## What this task is

A reader can read a song in a different key. Transposing moves every chord
up or down by a whole number of semitones and draws the result; it
**changes the view, never the song** — the text, the chart and every
voicing block stay exactly as written (workflow 2, §Transposing, L112). The
deliverable is the machine that makes that true:

1. a **pure transposition engine** that, given a parse model and a signed
   semitone offset, returns a *new* model whose chord symbols are re-rooted
   and spelled in one consistent spelling — by the key property when the
   song has one, otherwise by whichever of sharps or flats gives the fewest
   accidentals — while the input model is left untouched;
2. the **no-chosen-shapes-while-transposed** composition: a transposed
   model is resolved through `resolveSongVoicings(..., ignoreSongVoicings:
   true)`, so every chord takes *my shape* or the app's default, never the
   song's choice, even where a transposed chord happens to coincide with one
   the song voices;
3. the **per-song memory seam**: pure functions to read and to write the
   `transposition` register the home book already defines (§4.5), keyed by
   song ref, `0`/absent meaning the written key;
4. the **transposed-key name** helper (`G` +2 → `A`) the reading control
   will show.

The reading **screen** that mounts the transpose control, dispatches the
write, applies the remembered offset on open, and runs the three-viewport
journey is **not** this task — it is [`songs.reading`](../songs/reading.md)
(which `depends music.transpose`). See Decisions for the boundary.

## Why it needs to be done

Workflow 2 reaches transposing from the reading view, and
[`songs.reading`](../songs/reading.md) depends on `music.transpose` to
supply it: without the engine there is nothing for the control to drive, and
without the memory seam a singer's "this song in D" is forgotten on close.
Transposing is also what makes the voicing work of
[`music.fallback`](./fallback.md) complete — the `ignoreSongVoicings` seam
was built here-ward and has had no consumer until now. The capo feature the
workflow marks "Later" builds directly on this one (workflow 2, L127-129).

## Inputs / context

Normative documents (read as the work order, not to be redesigned):

- **`docs/workflows/02-find-and-play.md`**, §Transposing (L110-149) — the
  governing section. Load-bearing lines:
  - L112 — "**It changes the view, never the song**: the text, the chart and
    every voicing block stay as they are." cifra.md §8.6 (transposing a
    *document*) is explicitly **not** this; this is "a reader showing what it
    read in another key" (L116-117).
  - L119-125 — "**A transposed song has no chosen shapes.**" Every chord
    takes my shape or the default, "This holds even where a transposed chord
    coincides with one the song voices — up a fourth, the song's `G` is a
    `C`, and the song may well voice a `C` — because … a match is a
    coincidence."
  - L131-133 — "**Spelling.** With a `key` property, the transposed chords
    are spelled as the new key spells them: up a semitone from C is D♭, with
    flats. Without one, whichever of the sharp or the flat spelling gives the
    song fewer accidentals."
  - L136-138 — "**It is remembered per song.** … kept in the home book,
    beside the variation in use, and is shown plainly while it applies —
    *transposed to D (+2)* — with a way back to the written key."
  - L140-149 — "**It is for reading.**" edit opens the text as written;
    arrange is not offered; tapping a chord still opens the picker and saves
    *my shape*, not into the song; "Printing and a link to the song carry the
    transposition; search matches the chords as written." (These are
    reading-screen behaviors — [`songs.reading`](../songs/reading.md) — and
    are listed here as the context the engine must make possible, not as this
    task's surface.)
  - L127-129 — the capo feature, "Later."
- **`docs/DIRECTION.md`** §3.2 (L136-151), with **L139** naming "how far a
  song is transposed" among the personal state the home book holds, beside
  "which variation is in use" and *my shapes*; §3.7 (L415-417) "Framework-free
  below the view. The music core from Explore Chords and cifra.md for
  JavaScript know nothing of React; the view is the only layer that does."
- **`docs/home-book-format.md`** §4.5 (L295-316) — `songs.json`, the
  `transposition` register: "the semitone offset the song is read at, a
  signed integer; `0` or the absent register means the written key … remembered
  per song" (L312-314). §2.3 (L144-152) — the song ref key `<book-id>/<path>`,
  NFC-normalised.
- **`docs/mockups/W02-find-and-play.dc.html`** — the computer board is drawn
  in the transposed state: the accent chip `Transposed to A (+2)` (L183) with
  a `Back to G` quiet button (L184), "Arranging is off while transposed"
  inline (L185), a shapes panel "Shapes in A" whose chord boxes are drawn
  `kind="yours"` and `kind="default"` only — none `kind="song"` (L199-206) —
  matching "a transposed song has no chosen shapes." The transpose control is
  an icon button on phone (`aria-label="Transpose"`, L68) and a text button
  on tablet (L113-114). `docs/mockups/README.md` L23-26: "Defaults are drawn
  hollow, your shapes filled in the chord colour … Every status badge carries
  a word, never colour alone." (These drawings are [`songs.reading`](../songs/reading.md)'s
  to build; they fix the copy and states the engine's output must support.)
- **cifra.md spec** (`/home/ruoso/devel/cifra.md/spec/`) —
  `1-document.md` §1.4.3 (L135): "`key` — The song's key, as a chord symbol
  root with `m` for minor: `G`, `Em`, `Bb`. Informative: it changes nothing a
  reader does." `8-normalisation.md` §8.6 (L493-502): transposition is **"Not
  defined in this version"** — a document rewrite "invalidates every voicing
  block … a workflow question this draft does not settle"; "The `key` property
  … is informative and is not changed by a reader." This is the licence to do
  transposing in the app as reading state, not as a canonical rewrite.

Code seams (verified on disk):

- `app/src/core/pitch.js` — `interval(letterSteps, semitones)` (:81),
  `degreeToInterval(degree, alter)` (:94), `transposeNote(n, iv)` (:113,
  "keeping the spelling correct … `Bb` up a major third is `D` and not
  `C##`"; it picks the accidental nearest zero across the octave boundary).
  The `letterSteps` field of an `Interval` is exactly what lets one semitone
  offset be spelled sharp or flat.
- `app/src/core/notation/parse.js` — `parseChord(text, dialectId, options)`
  → `{ chord, ambiguities, errors }` (:136); `chord === null` on a symbol it
  cannot parse. `app/src/core/notation/format.js` — `formatChord(c,
  dialectId)` (:240), which renders `c.bass` as `/<note>`.
- `app/src/core/chord.js` — `chord(root, quality, extensions, bass)` (:103):
  a chord is its root note, a quality, degree-relative extensions, and an
  optional bass note. Transposing a chord is transposing `root` and `bass`
  by an interval and keeping `quality`/`extensions` (they are relative to
  the root).
- `app/src/core/voicings.js` — `resolveSongVoicings(parsed, instrument, {
  variation, shapes, ignoreSongVoicings })` (:145); with
  `ignoreSongVoicings: true` the song block is never selected (`:151`), so
  step 1 (`source: 'song'`) cannot fire and every occurrence resolves to
  `yours` or `default`.
- `app/src/chart/layout.js` — `chartRows(model)` (:120) walks
  `model.sections[].body[]` music parts; `chordText(item)` returns
  `item.symbol` for a `chord` item (:27-42). N.C., beat, repeat and unknown
  items are not chords and are not transposed.
- `app/src/worker/home-book.js` — `set({ bookId, file, changes, author,
  now })`, each change `{ path: string[], value }` stored as a `{ value, at }`
  register. `transpositionChange` returns a change in this shape; the Worker
  command that calls it is [`songs.reading`](../songs/reading.md)'s.

## Constraints / requirements

- **Pure, synchronous, framework-free.** The engine and the memory seam are
  plain functions over plain data — no React, no IndexedDB, no `await`
  (DIRECTION §3.7, L415-417). The engine imports only the music core
  (`pitch.js`, `notation/`, `chord.js`); the seam imports nothing but reads
  the home-book `songs.json` model shape.
- **View only, never the song.** `transpose(model, n, …)` MUST return a new
  model and MUST NOT mutate its input (workflow 2, L112). What is saved,
  indexed, pushed and shown in history is always the written song — so
  **canonical form is untouched** and **search matches the chords as
  written** (workflow 2, L149) for free, because transposition never reaches
  the stored document. This is also why cifra.md §8.6 need not change.
- **One spelling for the whole chart.** The sharp/flat choice is a single
  global decision per offset, applied to every chord, so a chart never mixes
  `D♯` and `E♭`. With a `key` property the key decides (minimise the
  transposed tonic's accidentals); without one, minimise total accidentals
  across every chord root and bass. Ties go to flats (workflow 2's "D♭"
  convention). See Decisions.
- **A symbol that will not parse is left verbatim.** If `parseChord` returns
  `chord === null` for an item's symbol, the engine keeps the symbol as
  written rather than dropping it — "a reader never discards what it did not
  understand" (cifra.md, spec reader rule; workflow 2, L78).
- **No chosen shapes while transposed.** The reading pipeline MUST resolve a
  transposed model with `ignoreSongVoicings: true`; a coincidental match
  with a song-voiced chord is still `yours`/`default`, never `song`
  (workflow 2, L119-125). Provenance stays a word + fill (hollow default,
  colour for yours), never colour alone (mockups README L23-26) — rendered by
  [`shell.diagram`](../shell/diagram.md), consumed here.
- **The Worker owns the data (offline first).** The actual write of the
  `transposition` register goes through `home-book.set` inside the Worker,
  committed automatically, never pushed by the user's hand
  (home-book-format §1); this task supplies only the pure change-set builder
  and projection the Worker command will call. The register is keyed by song
  ref per §2.3; `0`/absent is the written key (§4.5).
- **Accessibility.** The behavior test's rendered chart is axe-clean at WCAG
  2.1 AA. The transpose control, the chip and the "back to written key"
  button — and their keyboard paths and axe coverage — are the reading
  screen's ([`songs.reading`](../songs/reading.md)); this task mounts no
  interactive control.

## Acceptance criteria

### Behavior delivered

1. **The engine.** `transpose(model, semitones, { dialect } = {})` in
   `app/src/core/transpose.js` returns a new parse model in which every
   `type:'chord'` item's `symbol` is the chord re-rooted by `semitones` and
   re-formatted in `dialect`; `root` and `bass` move by the chosen interval,
   `quality`/`extensions` are kept. The input model is deeply unchanged.
   `semitones === 0` returns a model equal to the input (the written key).
2. **Spelling.** The engine chooses one global spelling for the offset: with
   `model.properties.key`, the spelling that gives the **transposed key
   tonic** the fewest accidentals (so C transposed up a semitone reads in
   D♭, with flats — workflow 2 L131-133); without a key, the spelling that
   gives the **fewest accidentals summed over every chord's root and bass**;
   on a tie, flats.
3. **No chosen shapes while transposed.** Resolving a transposed model with
   `resolveSongVoicings(transposed, instrument, { shapes, ignoreSongVoicings:
   true })` yields only `source: 'yours' | 'default'`, never `'song'` —
   including where a transposed chord coincides with a chord the song voices
   (the `G`→`C` up-a-fourth case).
4. **Remembered per song.** `transpositionOf(songsModel, songRef)` in
   `app/src/worker/songs.js` returns the stored signed offset, `0` when the
   register is absent or `0`; `transpositionChange(songRef, semitones)`
   returns the home-book change `{ path: [songRef, 'transposition'], value:
   semitones }` for `home-book.set` to write to `songs.json` (§4.5), keyed by
   the §2.3 song ref.
5. **The transposed key name.** `transposedKeyName(key, semitones, dialect)`
   names the destination key (`G` +2 → `A`, in the chosen spelling) for the
   reading control's "Transposed to A (+2)" chip and "Back to G" button;
   `null` when the song has no `key` property.
6. **A transposed chart renders, the song untouched.** `Chart`, given
   `transpose(model, +2, …)`, draws the transposed symbols over the same
   words; the original model object is deep-equal to what it was before; the
   render is axe-clean.

### Tests the task lands with, by level

- **unit — `app/src/core/transpose.test.js`:**
  - *Spelling with a key:* a song with `key: C` transposed +1 reads in D♭
    (flats); `key: G` +2 reads in A (naturals). *Pins:* note "spelling by the
    key property"; workflow 2 §Transposing L131-133; cifra.md spec §1.4.3.
  - *Spelling without a key, fewest accidentals:* a key-less song transposed
    by an offset with two spellings takes the one with fewer total
    accidentals; an exact tie goes to flats. *Pins:* note "or fewest
    accidentals"; workflow 2 L131-133.
  - *View only, never the song:* `transpose` does not mutate its input
    (deep-equal before/after); `semitones === 0` returns the written chords.
    *Pins:* note "View only, never the song"; workflow 2 L112; cifra.md spec
    §8.6 (not a document rewrite).
  - *Unparseable symbol kept:* an item whose symbol `parseChord` rejects is
    returned verbatim. *Pins:* cifra.md reader rule; workflow 2 L78.
  - *No chosen shapes while transposed:* `resolveSongVoicings` over a
    transposed model with `ignoreSongVoicings: true` returns only
    `yours`/`default`, proven on the `G`→`C` up-a-fourth coincidence where
    the song voices the coincident chord. *Pins:* note "no chosen shapes
    while transposed"; workflow 2 L119-125; `voicings.js:140-142, 151`.
  - *Transposed key name:* `transposedKeyName('G', 2, dialect) === 'A'`;
    `null` without a key. *Pins:* workflow 2 L136-138 ("transposed to D (+2)").
- **unit — `app/src/worker/songs.js` → `app/src/worker/songs.test.js`:**
  - *Remembered per song:* `transpositionChange(ref, 2)` produces the §4.5
    change shape; after it is applied (via the home-book register envelope),
    `transpositionOf(model, ref)` reads back `2`; an absent register and a
    `0` register both read `0` (the written key); a different song ref is
    independent. *Pins:* note "remembered per song in the home book";
    home-book-format §4.5 L295-316, §2.3 L144-152.
- **behavior — `app/src/chart/Chart.transpose.behavior.test.jsx`** (Testing
  Library + real React Aria + axe):
  - *A transposed chart rendered, the song untouched:* render `Chart` with
    `transpose(model, +2, …)`; the transposed chord symbols appear over the
    original syllables; the original `model` object is deep-equal to a frozen
    copy taken before the call (the song is untouched); axe reports no
    violations at WCAG 2.1 AA. *Pins:* note "a transposed chart rendered, the
    song untouched"; workflow 2 L112.

All named tests land in this task and run (not skipped) in `scripts/gate`.
No e2e level: the note scopes none for this task, and the transpose-and-reopen
journey on three viewports is [`songs.reading`](../songs/reading.md)'s e2e
(see Decisions).

### Deferred work

- **No new WBS leaf to register.** The transpose control (phone icon button,
  tablet/computer button, the "Transposed to A (+2)" chip and "Back to G"
  reset), the `SET_TRANSPOSITION` Worker command and reducer slice that call
  `transpositionChange`/`transpositionOf`, applying the remembered offset on
  open, and the e2e-web "transpose and reopen on the three viewports … offline"
  journey are all already scoped by the existing leaf
  [`songs.reading`](../songs/reading.md) (which `depends music.transpose`).
  The "edit opens as written / arrange off / tapping a chord saves *my shape*
  while transposed" behaviors (workflow 2 L140-149) are likewise reading-screen
  behaviors of that leaf.
- **The capo feature** (workflow 2 L127-129, marked "Later") builds on this
  task but needs a product/workflow decision first (which shapes a capo
  reuses, how it is shown); it is not yet a WBS leaf and is surfaced for the
  parking lot rather than invented here.

## Decisions

- **The engine lives in `app/src/core/`, framework-free.** *Chosen:* a new
  `app/src/core/transpose.js` beside `pitch.js`, `voicings.js` and
  `notation/`, importing only the music core. *Rejected:* a new
  `app/src/music/` React module (that directory is for screens, per
  [`music.explorer`](./explorer.md)) — transposition is a pure model→model
  transform with no view of its own; DIRECTION §3.7 keeps the core
  React-free.
- **Transpose by rewriting symbols, re-parsed with the app's parser.**
  *Chosen:* for each `chord` item, `parseChord(item.symbol)` → re-root
  `root`/`bass` with `transposeNote` → `formatChord` in the reading dialect,
  replacing `item.symbol`; preserve the occurrence `key` (§2.4) as an opaque
  per-occurrence identity. *Rationale:* `resolveSongVoicings` already
  re-parses `item.symbol` itself (`voicings.js:168`) and, with
  `ignoreSongVoicings: true`, never matches `item.key` against a song block —
  so the occurrence key need only stay unique, and rewriting the symbol is
  enough to carry the transposition through the whole reading pipeline
  (chart, voicings, diagrams). *Rejected:* re-deriving §2.4 keys, which would
  re-implement cifra.md's keying for no observable gain.
- **One global spelling chosen by accidental count.** *Chosen:* with a `key`,
  minimise the transposed tonic's accidentals; without one, minimise the
  total across all chord roots and basses; tie → flats. *Rationale:* this is
  the single rule the workflow's two clauses reduce to — "by the key property
  or fewest accidentals" — and a global choice keeps a chart from mixing
  enharmonic spellings. `transposeNote` already spells each note correctly
  once the interval's `letterSteps` is fixed, so the whole decision is the
  choice of `letterSteps` for the offset. *Rejected:* per-chord spelling
  (inconsistent charts) and a hard sharp/flat preference (contradicts the
  key-driven case).
- **Transposition is reading state, not a document rewrite — no cifra.md
  change.** *Chosen:* store a signed offset in the home book and transpose at
  read time. *Rationale:* cifra.md spec §8.6 deliberately leaves transposing
  a *document* undefined (it would invalidate every voicing block — "a
  workflow question this draft does not settle"), and §1.4.3 makes `key`
  informative and unchanged by a reader. Reading in another key is explicitly
  "not that" (workflow 2 L116-117). *Rejected:* rewriting the song's symbols
  and blocks — it destroys the teacher's arrangement and would need a spec
  delta the format declines to make.
- **The memory seam is pure; the Worker command is `songs.reading`'s.**
  *Chosen:* this task ships `transpositionOf` and `transpositionChange` (pure,
  unit-tested) in `app/src/worker/songs.js`; the `SET_TRANSPOSITION` command,
  the reducer slice and the control that dispatch them land in
  [`songs.reading`](../songs/reading.md). *Rationale:* the note's only
  behavior test is the chart render, not a Worker round-trip, and the end-to-end
  "transpose and reopen" is `songs.reading`'s e2e — so the persistence is
  pinned here at unit level and exercised end-to-end there. This mirrors
  [`music.fallback`](./fallback.md) shipping the `ignoreSongVoicings` seam
  ahead of its consumer. *Rejected:* building the Worker command here, which
  would pull the whole reading control and its e2e into a task whose note
  scopes neither.
- **No transpose control in this task.** *Chosen:* the engine emits the
  transposed model and the key name; the icon/text button, the chip and the
  reset button are drawn by [`songs.reading`](../songs/reading.md) per the W02
  mockups. *Rationale:* "The reading journey is songs.reading's" (the note),
  and the control's three-viewport axe coverage belongs with the screen it
  lives on.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- `app/src/core/transpose.js` — pure engine: `transpose(model, semitones, { dialect })` returns a new model whose every `type:'chord'` item's `symbol` is re-rooted and spelled in one consistent spelling; `transposedKeyName(key, semitones, dialect)` names the destination key for the UI chip.
- `app/src/worker/songs.js` — per-song transposition memory seam: `transpositionOf(songsModel, songRef)` reads the stored offset (0 when absent or 0), `transpositionChange(songRef, semitones)` builds the home-book change `{ path: [songRef, 'transposition'], value: semitones }` per §4.5.
- `app/src/core/transpose.test.js` — 14 unit tests: spelling by key (key C +1 → D♭; key G +2 → A); spelling by fewest accidentals + tie→flats; view-only immutability and offset 0; verbatim unparseable symbol; no chosen shapes via `ignoreSongVoicings` on the G→C up-a-fourth coincidence; `transposedKeyName` returns A for G+2, null without a key.
- `app/src/worker/songs.test.js` — 7 unit tests: §4.5 change-shape round-trip; absent/0 register reads 0; independent song refs.
- `app/src/chart/Chart.transpose.behavior.test.jsx` — 3 behavior tests: transposed chord symbols over original syllables; original model deep-equal/untouched; axe WCAG 2.1 AA.
- cifra.md unchanged: transposition is reading state, not a document rewrite (spec §8.6 deliberately undefined; `key` is informative and unchanged by a reader — workflow 2 L116-117).
