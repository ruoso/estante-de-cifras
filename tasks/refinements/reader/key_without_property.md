# reader.key_without_property — A song with no key property, named by its key

## TaskJuggler entry

[`tasks/85-reader.tji`](../../85-reader.tji), `reader.key_without_property` (lines 108–112).

## Effort estimate

0.5d.

## Repository

**Not under `cifra.md/`**: the note does not start with `cifra.md:`, and the
format is not touched. The `key` property stays informative (cifra.md
§1.4.3). A setlist still applies its key only through the song's own `key`
property (§10.7.1).

The work lands in `app/`:

- `app/src/core/song-key.js`: new. It holds the key-naming rule.
- `app/src/core/song-key.test.js`: new.
- `app/src/core/voicings.js`: export its existing `chartChords` walk.
- `app/src/songs/reading-view.js`: `chordKeyName` moves out. The private `chartChordItems` walk stays.
- `app/src/songs/reading-view.test.js`: the `chordKeyName` cases move out.
- `app/src/songs/song-sheet.js`: L149–151 call the new rule.
- `app/src/songs/SongReading.jsx`: comment only (L405–406).
- `app/src/songs/SongReading.behavior.test.jsx`: the keyless test changes, and new tests are added.
- `app/src/books/SetlistPlay.jsx`, `app/src/books/SetlistPlay.behavior.test.jsx`: the chip for a song with no key.
- `app/src/device/entry.js`, `app/src/device/entry.test.js`: the sheet's key carries the name.

The design delta has already been written in this task and rides in its commit:

- `docs/workflows/02-find-and-play.md` §Transposing (L262–272);
- `docs/workflows/19-remarkable-reader.md` §A song (L278–281).

## Inherited dependencies

The `.tji` lists none. Everything this task touches is already in the tree and complete:

| Seam | Where | From |
|---|---|---|
| The first-chord name | `chordKeyName`, `app/src/songs/reading-view.js:48` | songs.reading |
| The sheet's key | `readSongSheet` L147–151 (`startKey`, `startKeyNow`, `status`), `app/src/songs/song-sheet.js` | songs.reading |
| The transposed row | `transposeStatus`, `app/src/songs/reading-view.js:28` | songs.reading |
| The stepper and the chip | `transposeNow`, `app/src/songs/SongReading.jsx:405–411`; `transposedLabel`, `song-sheet.js:222` | songs.reading |
| The chord walk | `chartChords`, `app/src/core/voicings.js:117` (private today) | music core |
| The written key | `transposedKeyName` and the private `readKey`, `app/src/core/transpose.js:224`, `:95` | music core |
| Play mode's chip | `app/src/books/SetlistPlay.jsx:176–209` | books.setlist_play |
| The device sheet | `sheet()`, `app/src/device/entry.js:99–173`, returning `key: { written, status }` at L164 | reader.bundle (complete) |

Settled.

## What this task is

Today a song that states no key is named by the key of its first chord. A
choro that opens on its dominant is therefore misnamed. *Três Estrelinhas*,
in D minor, opens on A7/C♯, and both the web app and the reader would call it
A.

This task moves the naming into the music core and changes the rule. A song
is now named by the key its **last chord** gives:

- the chord's root;
- plus `m` when the chord is minor.

A song with no chords names no key.

Every place that names a song's key then uses this one function:

- the reading view's stepper (*Key of …*);
- the reading view's transposed chip and *Back to …*;
- play mode's chip when the user's own transposition moves a song with no key;
- the device sheet that the reader's key button reads.

## Why it needs to be done

The reader design review used a book of choros (2026-11-01). It found that
the first-chord rule, adopted on 2026-10-31 for the web app, names the wrong
key for the pieces the reader's owner plays most.

Two later tasks consume the device sheet's key:

- **`reader.song_screen`** draws the key button and the key grid's
  *As written*.
- **`reader.play`** shows a setlist key as a note.

Both need a name that is right, and that is right at the written key too.
Today the device sheet names a song with no key only inside `status`, which
is null at offset 0. So the reader's key button would have nothing to show
for an untransposed choro.

Play mode in the web app has a gap of its own. A song with no key, read under
the user's own transposition, shows no chip at all
(`SetlistPlay.jsx:203` → `transposedKeyName(null, offset)` → null). That is a
transposed chart with no word saying so, which workflow 2 §Transposing rules
out ("on stage the chords must not look like the written ones without a word").

## Inputs / context

**Workflow 2 §Transposing**, `docs/workflows/02-find-and-play.md`:

- L254–257, spelling: a song with no key is spelled with whichever spelling gives fewer accidentals. That is untouched.
- L258–272 as amended by this task:
  - a song with no key is named by the key its last chord gives;
  - *Key of Dm*, *Transposed to E♭m (+1)*, *Back to Dm*;
  - never a bare number of semitones;
  - a song with no chords names no key;
  - the name is only a name, so a setlist key stays a note.

**Workflow 19 §A song**, `docs/workflows/19-remarkable-reader.md`:

- L255–276: the key grid, *As written*, *Your key*.
- L278–281 as amended: a song with no key is named by its last chord, as the web app does (*Dm* for *Três Estrelinhas*). A song with no chords shows no key button and no strip.

**Workflow 12 §The key**, `docs/workflows/12-setlists.md` L54–64: the setlist
key is a target key. When the song has no `key` property, the setlist key is
shown as a note.

**cifra.md:**

- §1.4.3, `cifra.md/spec/1-document.md:135`: `key` is informative.
- §10.7.1, `cifra.md/spec/10-setlists.md:342–347`: the setlist key is not applied when the song has no `key` property.
- §3.4–3.5, `cifra.md/spec/3-repeats.md:114–161`: the last ending is written after the closing mark. Navigation marks such as Fine and D.C. are not in the format (§3 Open questions, L179–181). So the last chord in document order is the last chord played.

**DIRECTION §3.7**, `docs/DIRECTION.md:449`: the layers below the view know
nothing of React. `app/src/core/DESIGN.md` lists what the music core holds;
pure music rules belong there.

**Predecessor:** `tasks/refinements/reader/bundle.md` §Acceptance. The device
`sheet()` returns `key: { written, status }`, and `status` includes the
first-chord name. This task extends that shape and does not replace it.

**Current tests that pin the old rule:**

- `app/src/songs/reading-view.test.js:46–56`: the `chordKeyName` cases.
- `app/src/songs/SongReading.behavior.test.jsx:645–650`: `'Am  F  G'` at +3 expected to read *Transposed to Cm (+3)*. Under the new rule that chart ends on G.
- `app/src/device/entry.test.js:142`: "names a song with no key by its first chord when transposed".

## Constraints / requirements

- **One rule, in the music core.** `app/src/core/song-key.js` exports:
  - `chordKeyName(symbol, notation)`, moved from `reading-view.js` unchanged: the root, plus `m` when the chord is minor; null for a symbol that is not a chord.
  - `songKeyName(model, notation)`: the key the song's **last chord** gives. It is null when the chart has no chord. The walk is `chartChords` from `voicings.js`, exported, not a third copy of the walk. The function does not read the `key` property. Callers name a stated key through `transposedKeyName`, as today. So a `key: G major`, which is not a key, still falls back to the music.
  - Nothing in `song-key.js` imports React, the Worker or the view.
- **No other caller keeps the first-chord rule.** After this task, no `chartChordList(...)[0]` and no `chordList[0]` names a key anywhere in `app/src` (grep).
- **`readSongSheet`** (`song-sheet.js:147–151`):
  - `startKey` becomes `songKeyName(baseModel, notation)` when there is no written key.
  - `startKeyNow` becomes `songKeyName(model, notation)`, read from the transposed model, so it carries the transposed spelling (`Dm` → `E♭m`).
  - `transposeStatus` is unchanged.
- **Play mode** (`SetlistPlay.jsx`):
  - When the song has no written key and no item key, and the user's own offset moves it, the chip names the key as `songKeyName(model, notation)` of the transposed model: *In E♭m*.
  - A setlist key on such a song stays a note, untransposed, with no chip (§10.7.1). The name is never used to compute an interval.
- **The device sheet** (`entry.js` `sheet()`):
  - `key` gains `named`: the song's key as it is read now. That is the written key transposed (`transposedKeyName`) when the song states one, else `songKeyName` of the model as read.
  - `named` is null only for a song with no chords and no key.
  - `written` and `status` keep their meaning.
  - The host API stays version 1. The field is additive, and no consumer of it has landed yet: `reader.song_screen` is pending.
- **Accessibility:** no new controls. The stepper, the chip and *Back to …* keep their labels and roles, and only the key word in them changes. axe stays clean on the states the behavior tests render.
- **Fixtures** are songs written for the purpose: a short choro-like chart in Dm that opens on `A7/C#` and ends on `Dm`. Never a real choro's chart.

## Acceptance criteria

### Behavior delivered

- A chart with no `key` that opens on `A7/C#` and ends on `Dm` reads as follows:
  - the stepper says *Key of Dm*;
  - at +1, the chip says *Transposed to E♭m (+1)* and the button says *Back to Dm*;
  - in play mode under the user's +1, the chip says *In E♭m*;
  - the device sheet gives `key.named` `'Dm'` at offset 0 and `'Ebm'` at +1.
- A song with no chords names no key:
  - the stepper falls back to *the written key* (`reading.writtenKey`);
  - the device sheet gives `key.named: null`.
- A song with `key: G` is named G everywhere, whatever chord it ends on.

### Tests, by level

**Unit** (Vitest):

- **`app/src/core/song-key.test.js`**:
  - `songKeyName` for a chart that opens on its dominant (`A7/C# | Dm | Gm | A7 | Dm` gives `Dm`);
  - for a chart that ends on a major chord (`C | F | G7 | C` gives `C`);
  - for a sung chart whose last chord is on a sung line;
  - for a last ending written after the closing mark (`|: Dm | A7 :|2. Dm |` gives `Dm`, §3.4);
  - for a chart with no chords (null);
  - for a song that states `key: G` and ends on `D7`: `songKeyName` gives `D`, and the callers prefer the stated key, which is pinned at the sheet level below.
  - The `chordKeyName` cases are moved from `reading-view.test.js:46–56`.
  - These pin workflow 2 §Transposing as amended.
- **`app/src/songs/song-sheet.test.js`**, new cases:
  - `readSongSheet` for the Dm chart gives `startKey` `'Dm'` and, at +1, `status` `{ keyName: 'Ebm', writtenKey: 'Dm' }`;
  - for a song with `key: G` that ends on `D7`, `startKey` is null and `status.writtenKey` is `'G'`;
  - for a song with no chords, `startKey` is null and `status.keyName` is null.
- **`app/src/device/entry.test.js`**:
  - L142 is renamed to "names a song with no key by its last chord" and re-pinned on the Dm chart: `key.named` is `'Dm'` at 0 and `'Ebm'` at +1, and `key.status` is set at +1;
  - a song with `key: G` gives `key.named` `'A'` at +2;
  - a song with no chords gives `key.named: null`;
  - a setlist target key on the Dm chart stays `keyNote`, at offset 0, with `key.named` `'Dm'` (workflow 12 §The key; §10.7.1).
  - These pin workflow 19 §A song as amended.

**Behavior** (Testing Library + axe):

- **`app/src/songs/SongReading.behavior.test.jsx`**:
  - The test at L645–650 is renamed "names a keyless song by the key its last chord gives". Its chart becomes `'A7/C#  Dm  Gm  A7  Dm'` at +1, and it expects *Transposed to E♭m (+1)* and *Back to Dm*.
  - A new case for that chart at offset 0: the reading view's key chip (the stepper) reads *Key of Dm*. No test pins this today.
  - A new case for a song with no chords: the stepper reads the `reading.writtenKey` copy, with no key named.
  - axe clean.
  - These pin workflow 2 §Transposing as amended.
- **`app/src/books/SetlistPlay.behavior.test.jsx`**:
  - A new case: the Dm chart as an item with no key, under the user's own +1, shows the chip *In E♭m* (workflow 2 §Transposing, "never without a word").
  - The existing L219–229 case stays: a song with no key under an item key is a note with no chip.
  - The axe test at L304 adds the keyless own-transposition state.

No e2e level: the note names unit and behavior only. The change is a naming rule
in pure code, plus the words in three existing controls. Each of those
controls already has an e2e journey that does not depend on which chord names
the key, so no e2e test changes.

## Decisions

1. **The last chord names the key, not the first.**
   - The task note offered the last chord, or no key when the chart does not say. A cadence on the tonic is the most reliable cue to key that a chord list carries.
   - Choros, sambas, hymns and most popular songs end on their key, including the many that open on a pickup, a dominant or a IV.
   - cifra.md has no Fine or D.C. (§3 Open questions), so the last chord written is the last chord played. A last ending is written after the closing mark (§3.4).
   - Rejected: **no key when the song does not state one**. Workflow 2 decided, after the persona explorations of 2026-10-31 and 2026-11-01, never to show a bare number of semitones. Naming nothing would undo that for every song with no key.
   - Rejected: **the first chord unless it is a dominant, then its resolution**. A7 resolves to D or Dm, and the rule cannot tell which; it is also two rules where one serves.
   - Rejected: **a key-finding analysis over all the chords** (pitch-class profiles). That is new music code with its own failure modes, for 0.5d. The last chord is legible: a reader can see why a song is called Dm.
   - Accepted risk: a song whose chart ends on a turnaround (`… | G7`) is named by that chord. The author can state `- key:` to fix it, and that is what the property is for.
2. **The name is only a name. It never computes a setlist interval.** §10.7.1 says a setlist key is applied only through the song's own `key` property. Using an inferred key there would be a format change, and a reader that guesses (§10.7.1's own word for mode). Workflow 2 and workflow 19 now say so explicitly.
3. **Where the rule lives: `app/src/core/song-key.js`.** The note asks for the music core, so that every place that names a key agrees. `reading-view.js` is the songs layer, and play mode and the device entry would otherwise import a songs-layer helper or keep their own. Considered alternatives:
   - Putting it in `transpose.js` beside `readKey` mixes key reading with chord walking.
   - Putting it in `song-analysis.js` ties it to the arrange analysis.
4. **Reuse `voicings.js`'s `chartChords` walk by exporting it**, rather than adding a third copy beside it and `reading-view.js`'s `chartChordItems`. It is the music core's walk already, and it yields chord items in document order with repeats, which is what "last chord" needs. (Removing `chartChordItems` from `reading-view.js` is not in scope; it serves `chartChordList`.)
5. **`songKeyName` ignores the `key` property.** The callers already name a stated key through `transposedKeyName`, which handles its spelling and its transposition. A second path for the stated key would be two ways of naming one thing. A property that is not a key (`G major`) falls back to the music. That matches workflow 2's "never a bare number", and §1.4.3 makes the property informative anyway.
6. **The device sheet gains `key.named` on host API version 1.** Today the reader's key button would have no name at offset 0 for a song with no key: `status` is null when not transposed. The field is additive, and its only consumers (`reader.song_screen`, `reader.play`) have not landed. So bumping `hostApi` would only make the backend refuse a bundle for no gain.
7. **Play mode's chip for a song with no key under the user's own transposition is in scope.** It is a place that names a key, the note asks that every such place agree, and today it shows nothing, against workflow 2's rule that a transposed chart always says so. It is a few lines that reuse the same function.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-01.

- app/src/core/song-key.js (new): `songKeyName` names a song by its last chord (null with no chords); `chordKeyName` moved here from reading-view.js. Unit tests in app/src/core/song-key.test.js.
- app/src/core/voicings.js exports `chartChords`, the one chord walk; app/src/songs/reading-view.js drops its `chordKeyName`.
- app/src/songs/song-sheet.js: `startKey`/`startKeyNow` use `songKeyName`; cases in song-sheet.test.js and reading-view.test.js.
- app/src/songs/SongReading.jsx (comment) and SongReading.behavior.test.jsx: keyless test re-pinned (Transposed to Ebm (+1), Back to Dm); new Key of Dm and no-chords cases, axe clean.
- app/src/books/SetlistPlay.jsx and SetlistPlay.behavior.test.jsx: play-mode chip *In Ebm* for a keyless song under the user's own transposition; a setlist key on it stays a note.
- app/src/device/entry.js and entry.test.js: device sheet `key.named` (additive, host API still 1).
- e2e/web/tests/popover-surface.spec.js: one comment; docs/workflows/02 and 19 carry the design delta.
- Keys display in ASCII (`Ebm`). No tech-debt follow-ups.
