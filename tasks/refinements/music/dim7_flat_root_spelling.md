# music.dim7_flat_root_spelling — A diminished seventh on a flat root reads at every key

## TaskJuggler entry

[`tasks/55-music.tji`](../../55-music.tji), `task music.dim7_flat_root_spelling`
("A diminished seventh on a flat root reads at every key"), under `task music`.
`depends !explorer`. Listed in `milestones.m7_reader`
(`tasks/99-milestones.tji:60`).

`note`: *"Source of debt: tasks/refinements/reader/engine.md (reader.engine),
found while writing the choro fixtures. Flat-rooted dim7 chords (F°, Bb°, Ab°,
Db°) throw Bad accidental: -3 in app/src/core/pitch.js note(), reached through
transposeNote from chordTones, because the respelled root needs a triple flat;
spell the chord so it reads at every key (the reading view and the reader's
bundle). Governing: cifra.md section on chord spelling;
docs/remarkable-reader.md section 7. The choro fixtures use Fdim/Bbdim to avoid
it. Tests: unit (chordTones and transposeNote for F°, Bb°, Ab°, Db° at all
twelve keys); behavior (the reading view renders a song with a flat-rooted dim7
at every key)."*

## Effort estimate

0.5d (`allocate team`), unchanged. One pure-module widening (`pitch.js`: a
spelled note may carry a triple accidental, plus one respelling helper), two
call sites that write a symbol's root or bass through it (`transpose.js`,
`diagram.js`), one glyph table (`shape-readout.js`), the same one-line table fix
in the Python reference and in cifra.md for JavaScript, and tests at each. No
new screen, control, Worker message or module.

## Repository

**estante-de-cifras**, both trees (the note does not start with `cifra.md:`,
but the governing spec section is cifra.md §5.5, and the clarification this task
makes there moves with its reference and its JavaScript implementation — see
Decision 2):

- `app/src/core/pitch.js`, `app/src/core/transpose.js`,
  `app/src/render/diagram.js`, `app/src/music/shape-readout.js` — the fix.
- `cifra.md/spec/5-chord-symbols.md` §5.5 — the design delta (written with this
  refinement).
- `cifra.md/reference/cifra_md/pitch.py` (`format_note`),
  `cifra.md/js/src/pitch.js` (`ACCIDENTAL_TEXT`) — the same fault in the format's
  own `chord_tones` / `chordTones`.
- Tests: `app/src/core/pitch.test.js`, `app/src/core/chord.test.js`,
  `app/src/core/transpose.test.js`, `app/src/render/render.test.js`,
  `app/src/music/shape-readout.test.js`, `app/src/songs/song-sheet.test.js`,
  `app/src/device/entry.test.js`, `app/src/songs/SongReading.behavior.test.jsx`,
  `cifra.md/reference/tests/test_chords.py`, `cifra.md/js/test/chord.test.js`.

cifra.md for Go has no chord-tone resolver (`cifra.md/go/` spells no tones), so
nothing lands there. No corpus entry: the corpus pins reading and merging, not
tones (`cifra.md/corpus/README.md`), and the reference's `chord_tones` is "for
tests and display" (`chord.py` L362).

## Inherited dependencies

- **`music.explorer`** (`!explorer`) — complete. Settled. It is the WBS anchor;
  the code this task touches (`pitch.js`, `chord.js`, `transpose.js`, the
  reading view) is all in place.
- **`music.transpose`** — complete; `transpose.js` and its single-spelling rule
  (workflow 2 §Transposing) are what produces the flat roots. Settled.
- **`reader.engine`** — complete (2026-11-01); found the fault and registered
  this task (`tasks/refinements/reader/engine.md` L500). Its agreement test
  (`app/src/device/entry.test.js` L106–128) is the reader-bundle seam. Settled.

Every named test is driven by what exists: the unit tests are pure; the song
sheet and the device entry are pure functions over a text; the behavior case
uses `SongReading.behavior.test.jsx`'s stub store (`makeStore`, L127, which
already takes `transposition`) and `song()` (L66). No hosted book, second
device or sign-in is involved.

## What this task is

A diminished seventh is spelled from its root by §5.5: degree 7 lowered twice.
On a root that already carries a flat, that seventh needs three flats — the
seventh of `Fb°` is E♭♭♭ — and on a double-flat root the third and fifth go
past a double too. The app's `SpelledNote` holds only −2..+2 (`pitch.js`
L39–46), so `chordTones` (`chord.js` L123–144) throws `Bad accidental: -3` from
`transposeNote` (`pitch.js` L113–126) for `Cb°`, `Fb°`, `Bbb°`, `Ebb°`, `Abb°`.

Nobody writes those chords; transposition makes them. A chart in `key: C`
written `C F° Bb° Ab° Db° G7 C` reads, measured against today's
`transpose.js`:

| offset | transposed chart | today |
|---|---|---|
| +1 | `Db Gb° Cb° Bbb° Ebb° Ab7 Db` | throws |
| +3 | `Eb Ab° Db° Cb° Fb° Bb7 Eb` | throws |
| +6 | `Gb Cb° Fb° Ebb° Abb° Db7 Gb` | throws |
| +8 | `Ab Db° Gb° Fb° Bbb° Eb7 Ab` | throws |
| +10 | `Bb Eb° Ab° Gb° Cb° F7 Bb` | throws |
| others | (no flat-on-flat root) | reads |

Through `readSongSheet` (`app/src/songs/song-sheet.js` L88, which the reading
view and the reader's bundle both call), with a guitar entry, the throw comes
from voicing the chart (`resolveSongVoicings` → the search → `chordTones`):
keyed in C, Dm, Gm or Am, every one of `F°`, `Bb°`, `Ab°`, `Db°` fails at one to
five of the twelve keys; keyless charts fail fewer (they spell sharps), and the
choro fixtures dodge it with `Fdim`/`Bbdim` (triads, no seventh).

A second, rarer fault on the same seam: `transpose.js`'s cost function
(`accidentalsUnder`, L79–81) calls `transposeNote` on every chord root under
every candidate interval, so a keyless chart with a `D#` or `A#` root read up a
fourth (`+5`, whose candidates include the augmented third: `D#` → `F###`)
throws before any spelling is chosen.

The task:

1. **A spelled note may carry a triple accidental.** `note()` accepts −3..+3;
   `formatNote` writes `bbb`/`###`. `parseNote` and the chord grammar are
   unchanged — a root or bass read from text is still at most a double
   (§5.1.1). `chordTones`, `transposeNote` and the cost function then never
   throw for any chord the parser accepts, transposed by any interval.
   §5.5's spelling is kept: the tones of `Fb°` are `Fb Abb Cbb Ebbb`.
2. **What a symbol writes stays inside §5.1.1.** A new
   `plainSpelling(n)` in `pitch.js` returns `n` when its accidental is at most a
   double, otherwise the same pitch on the neighbouring letter (`Ebbb` → `Db`,
   `F###` → `G#`, `Bbbb` → `Ab`, `B###` → `C##`). It is applied where a spelled note becomes part
   of a chord symbol:
   - `transpose.js` — the transposed root and bass (L195–200), so a transposed
     symbol always re-parses. Reachable only when the global spelling for an
     offset lands a past-double root (the keyless `Fb Fb D#°` read `+5` picks
     the augmented third: `A A G#°`, not `A A F###°`). Every other chord keeps
     the one spelling the offset chose (workflow 2 §Transposing);
   - `diagram.js` — the sounded bass in `soundedSymbol` (L127–132) and the
     short `voicedAsLabel` form (L172): a `Cb°` shape sounding its seventh
     lowest is labelled `Cb°/Ab`, not `Cb°/Bbbb`.
3. **Tone lists show the triple accidental.** `shape-readout.js`'s `GLYPH`
   (L33) gains `-3: '𝄫♭'` and `3: '𝄪♯'`, so the readout of an `Fb°` shape names
   E𝄫♭; `describeChordTones` (`chord.js` L255–259) reads `Ebbb` through
   `formatNote`.
4. **The format's own resolvers.** The reference's `format_note`
   (`cifra.md/reference/cifra_md/pitch.py` L30–32) raises `KeyError: -3` and
   cifra.md for JavaScript's `formatNote` (`cifra.md/js/src/pitch.js` L27,
   L55–57) writes `Eundefined` for the same chords; both gain the ±3 entries.
   Their `chord_tones`/`chordTones` arithmetic (`chord.py` L361–386,
   `js/src/chord.js` L427–455) already yields −3; only the name table is short.

The written song is never touched (workflow 2: transposition is the view).

## Why it needs to be done

- **The reading view fails at a key a user asks for.** Workflow 2 §Transposing
  lets any song be read at any of twelve keys; a choro in C with a `Bb°`
  cannot be read a semitone up. Diminished sevenths on flat roots are the
  ordinary passing chords of choro and samba, the repertoire the app is for.
- **The reader shares the fault.** The reMarkable reader runs the same
  `readSongSheet` in its bundle (`docs/remarkable-reader.md` §4, §7 — a song
  screen with "the key grid", every key a press away); a key grid with keys
  that fail is not one. `reader.engine` registered this task for it and its
  fixtures avoid the chord until it lands.
- **The spec's rule already says what the tone is**, and three implementations
  of it cannot hold the answer. §5.5's formula gives E♭♭♭ for the seventh of
  `Fb°7`; the clarification makes the case explicit so the next resolver does
  not fall into it.

## Inputs / context

- `cifra.md/spec/5-chord-symbols.md`
  - §5.1.1 Root (L24–31): a root's accidental is at most a double; §5.1.2 Bass
    (L33–) the same.
  - §5.5 Spelled tones (L229–) — the rule; the clarification added by this
    task (see Decisions 1–2).
  - §5.7 Preferred spellings (L290–313): a writer *"MUST NOT emit a spelling the
    grammar of §5.3 does not accept"* — why a symbol's root and bass are
    respelled within a double.
- `docs/remarkable-reader.md` §4 (the bundle runs the app's reading code, "no
  port") and §7 (the song screen and its key grid).
- `docs/workflows/02-find-and-play.md` §Transposing (L233–) — the view only; one spelling for
  the whole chart (as `transpose.js` L18–24 quotes it).
- `app/src/core/pitch.js` — `ACCIDENTAL_NAMES` L24; `note()` L39–46 (the
  throw); `parseNote` L53–58 (regex up to a double — unchanged); `formatNote`
  L61–63; `transposeNote` L113–126 (nearest-to-zero accidental, may reach ±3).
- `app/src/core/chord.js` — `chordTones` L123–144; `voicedAs` L238–252 (the
  sounded bass is a spelled tone); `describeChordTones` L255–259.
- `app/src/core/transpose.js` — `accidentalsUnder` L79–81; `chooseInterval`
  L153–167; `transpose` L189–213 (root and bass at L195–200).
- `app/src/render/diagram.js` — `soundedSymbol` L127–132; `voicedAsLabel`
  L164–175 (the `full: false` form at L172).
- `app/src/music/shape-readout.js` — `GLYPH` / `glyphNote` L33–34; tone names
  at L144, L164, L168.
- `app/src/render/chord-speech.js` L25–45 — speaks a symbol's root and bass
  only, so it never meets more than a double; unchanged.
- `app/src/songs/song-sheet.js` `readSongSheet` L88–; the reader's entry
  `app/src/device/entry.js` calls it.
- `cifra.md/reference/cifra_md/pitch.py` `format_note` L30–32;
  `cifra.md/reference/cifra_md/chord.py` `chord_tones` L361–386;
  `cifra.md/js/src/pitch.js` `ACCIDENTAL_TEXT` L27, `formatNote` L55–57;
  `cifra.md/js/src/chord.js` `chordTones` L427–455.
- Tests to extend: `app/src/core/pitch.test.js` (L19–47 parsing/formatting,
  L86– `transposeNote`); `app/src/core/chord.test.js` (L19– triads, L187– what a
  shape sounds); `app/src/core/transpose.test.js` (L55– by key, L87– keyless);
  `app/src/render/render.test.js` (L216– the voiced-as label);
  `app/src/music/shape-readout.test.js`; `app/src/songs/song-sheet.test.js`;
  `app/src/device/entry.test.js` (L106–128 agreement at twelve keys);
  `app/src/songs/SongReading.behavior.test.jsx` (`song()` L66,
  `chartFirstLineGlyphs` L82, `makeStore` L127, `openAndWait` L221);
  `cifra.md/reference/tests/test_chords.py` (`test_tones` table L38–86);
  `cifra.md/js/test/chord.test.js` (L338–343).
- Predecessor: `tasks/refinements/reader/engine.md` L500 (the finding).

## Constraints / requirements

- **§5.5 spelling, unchanged.** A tone is always on the letter *d − 1* steps
  above the root; no tone list respells a degree onto another letter.
- **§5.1.1 for symbols.** Every chord symbol the app writes — a transposed chart
  symbol, a voiced-as label — re-parses; its root and bass are at most a double.
- **Workflow 2's one spelling.** `transpose` keeps choosing one interval per
  offset; only a root or bass that interval would take past a double is
  respelled. Every transposed chart in `transpose.test.js` today is unchanged.
- **No parser or grammar change.** `parseNote`, `NOTE_RE`, the chord grammar
  still reject `Ebbb`.
- **View only.** Nothing written back; the song text is untouched.
- **Implementations agree because they are checked.** The reference, cifra.md
  for JavaScript and the app each get their own fix and their own test; no code
  is shared.
- **Fixtures** use chord-only charts written for the purpose.

## Acceptance criteria

Behavior delivered:

1. `chordTones` resolves every chord the parser accepts on every root §5.1.1
   allows, and every such chord transposed by any interval, without throwing;
   the tones of `Fb°` are `Fb Abb Cbb Ebbb`.
2. A song in `key: C` written `C F° Bb° Ab° Db° G7 C` reads at all twelve keys
   in the reading view and through the reader's bundle, each chord drawn with a
   shape, the chart spelled as the table under *What this task is*.
3. A transposed symbol and a voiced-as label never carry more than a double
   accidental.
4. The reference's `chord_tones` and cifra.md for JavaScript's `chordTones`
   write `Ebbb` for the seventh of `Fb°7`.

Tests, by level:

- **unit** — `app/src/core/pitch.test.js`:
  - *a spelled note holds a triple accidental*: `note('E', -3)` and
    `note('F', 3)` build; `note('E', -4)` throws; `formatNote` gives `Ebbb`,
    `F###`;
  - *a root or bass is still at most a double*: `parseNote('Ebbb')` and
    `parseNote('F###')` throw `badNote` (§5.1.1);
  - *transposeNote spells a diminished seventh from a flat root*:
    `transposeNote(Fb, degreeToInterval(7, -2))` is `Ebbb`, from `Cb` `Bbbb`,
    from `Bbb` `Abbb` (§5.5);
  - *plainSpelling keeps a double and moves a triple to the neighbouring
    letter*: `Ebb` → `Ebb`, `Ebbb` → `Db`, `Bbbb` → `Ab`, `F###` → `G#`, `B###` →
    `C##` (same pitch class each; the neighbouring letter in the accidental's
    direction).
- **unit** — `app/src/core/chord.test.js`, new
  `describe('a diminished seventh on a flat root (§5.5)')`:
  - *F°, Bb°, Ab°, Db° at all twelve keys*: for each chord and each offset
    0..11, under every spelling `transpose` can choose for that offset (the
    flat and the sharp interval, and the neighbour-letter one for a white-key
    offset), the transposed chord's `chordTones` does not throw, holds four
    tones whose letters are the root's letter plus 0, 2, 4, 6 steps and whose
    pitch classes are the root's plus 0, 3, 6, 9;
  - *every legal root*: the same holds for `°` and `m7(b5)` on each of the 35
    roots §5.1.1 allows (seven letters × five accidentals);
  - anchors: `describeChordTones` of `Fb°` is `Fb Abb Cbb Ebbb`, of `Cb°`
    `Cb Ebb Gbb Bbbb`, of `Bbb°` `Bbb Dbb Fbb Abbb` (the §5.5 clarification's
    examples);
  - *voicedAs names a triple-flat seventh in the bass as the tone*: a `Cb°`
    sounding its seventh lowest gives `bass` `Bbbb` (the spelled tone).
- **unit** — `app/src/core/transpose.test.js`, new
  `describe('transpose — a diminished seventh on a flat root at every key')`:
  - the `keyed('C', 'C F° Bb° Ab° Db° G7 C')` chart at each offset 0..11 reads
    exactly the spellings of the table above (+1 `Db Gb° Cb° Bbb° Ebb° Ab7 Db`,
    +6 `Gb Cb° Fb° Ebb° Abb° Db7 Gb`, …; the five failing rows and the seven
    others written out) — pins workflow 2's one spelling, unchanged;
  - *a keyless D#m read up a fourth*: a keyless `D#m G#7` chart at +5 reads
    `G#m C#7` and does not throw (the cost function under the augmented third);
  - *a transposed root never passes a double*: the keyless `Fb Fb D#°` at +5
    reads `A A G#°`, and every symbol re-parses with `parseChord`.
- **unit** — `app/src/render/render.test.js`, `the voiced-as label`: a `Cb°`
  fingering that sounds its seventh lowest is labelled `Cb°/Ab` and, with
  `full: false`, `/Ab` (§5.1.2, §5.7).
- **unit** — `app/src/music/shape-readout.test.js`: the readout of an `Fb°`
  shape summarises its tones as `F♭, A𝄫, C𝄫, E𝄫♭` (the triple glyph), no
  `undefined` anywhere in the rows or the summary.
- **unit** — `app/src/songs/song-sheet.test.js`, new
  `describe('a flat-rooted diminished seventh at every key (music.dim7_flat_root_spelling)')`:
  `readSongSheet` with a guitar entry over the `key: C` chart above, at each
  offset 0..11, returns a sheet whose `chordList` symbols are the table's row
  and whose `unvoiced` is empty.
- **unit** — `app/src/device/entry.test.js`, in
  `agreement with the reading view, all twelve keys`: a new case *reads a
  flat-rooted diminished seventh at every offset as the reading view does* —
  `estante.sheet(text, offset)` for the `key: C` chart at 0..11 does not throw
  and its rows and shapes' `{ key, symbol, source }` equal `readSongSheet`'s, as
  the existing case does for the example songs (remarkable-reader §4 "no
  port", §7 the key grid). Misses may be pending (no search on the reading
  path); the case does not assert `misses()` empty.
- **behavior** — `app/src/songs/SongReading.behavior.test.jsx`, new
  `describe('SongReading — a diminished seventh on a flat root at every key (music.dim7_flat_root_spelling)')`:
  - `it.each` offsets 0..11: `makeStore({ text: song({ props: ['key: C'],
    chart: 'C  F° | Bb°  Ab° | Db°  G7 | C' }), entry: guitarEntry(),
    transposition })`, `openAndWait`; the chart's first line reads the table's
    symbols for that offset (`chartFirstLineGlyphs`), and the Shapes region
    draws one diagram per distinct chord, none of them unvoiced
    (workflow 2 §Transposing);
  - at +1 (`Cb°`, `Bbb°`, `Ebb°`): axe clean (WCAG 2.1 AA).
- **unit** — `cifra.md/reference/tests/test_chords.py`: `test_tones` gains
  `("Fb°7", "Fb Abb Cbb Ebbb")` and `("Bbb°7", "Bbb Dbb Fbb Abbb")` (§5.5 as
  clarified).
- **unit** — `cifra.md/js/test/chord.test.js`, *spelled from the root, never
  from pitch class*: `tones("Fb°7")` is `Fb Abb Cbb Ebbb` and `tones("Bbb°7")`
  `Bbb Dbb Fbb Abbb` (§5.5 as clarified).

No e2e-web and no corpus entries: see Decision 6.

## Decisions

1. **Keep §5.5's spelling: a tone may carry a triple accidental.**
   - The spec's rule (letter *d − 1* steps above the root) already gives
     E♭♭♭ for the seventh of `Fb°7`; the implementations simply could not hold
     the answer. Widening `SpelledNote` to ±3 fixes every caller of
     `transposeNote` and `chordTones` at once (the search, the voicing planner,
     the readout, the cost function) without changing what any existing tone is.
   - Rejected: **respell a tone past a double on the neighbouring letter**
     (`Fb Abb Cbb Db`). It breaks §5.5's MUST, gives the seventh a sixth's
     letter (so a stacked-thirds reading no longer holds), and would need a spec
     change against the rule's own logic.
   - Rejected: **respell the transposed chord's root** (`Cb°` → `B°`) in
     `transpose`. It is what a copyist would write, but it breaks workflow 2's
     one spelling for the whole chart (a `Gb` chart would mix `B°` with `Db7`),
     and a user can still type `Cb°` directly, which must read too.
   - Rejected: **a narrower guard** catching the throw in the reading view. It
     hides the chord instead of reading it.
2. **A §5.5 clarification is the design delta, and the format's resolvers move
   with it.** The rule needed no change, but it shows no case past a double, and
   the reference, cifra.md for JavaScript and the app all failed there. The
   added paragraph (`cifra.md/spec/5-chord-symbols.md` §5.5) says a tone may
   take a triple accidental, a reader writes it so and must not fail, and only a
   root and a bass are limited by §5.1.1. Because the spec, the reference and
   the implementations move together, the two one-line table fixes and their
   tests land in this task rather than as a `cifra.md:` follow-up; there is no
   Go resolver to fix.
3. **Symbols are respelled within a double, at the two places they are
   written.** A chord symbol must re-parse (§5.1.1, §5.7). `plainSpelling` is
   applied to the transposed root and bass and to the voiced-as bass only; a
   tone list keeps the triple. Rejected: making `transposeNote` itself clamp —
   it would silently change the letter a caller asked for and break §5.5 for
   `chordTones`.
4. **The triple glyph is `𝄫♭` / `𝄪♯`.** Unicode has no triple-flat sign; a
   double flat then a flat is how engravers set it, and it keeps the readout's
   existing glyphs.
5. **The choro fixtures are left as written.** `Fdim`/`Bbdim` in
   `app/src/device/fixtures/choros/` are pinned by the Node oracle and goja's
   84 reads (`reader.engine`); changing them means regenerating that oracle for
   no new coverage, since this task's `entry.test.js` case reads the flat-rooted
   seventh through the same bundle entry at twelve keys.
6. **unit and behavior; no e2e-web, no corpus.** The note names unit and
   behavior. The fault is in pure modules; the behavior case renders the
   reading view at every key with axe. An e2e-web journey would repeat the
   existing transpose journey with another chord and pin nothing the behavior
   case does not. The corpus has no tone entries (it pins reading and
   merging); §5.5 is pinned by each implementation's own tone tests.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-11-01.

- A spelled note may carry up to a quadruple accidental (`app/src/core/pitch.js`, `app/src/core/transpose.js`), so a flat-rooted diminished seventh resolves its tones at every key. The limit is ±4, not the refinement's ±3: legal roots `Fbb°`/`Cbb°` and `E##7(#9)` need four.
- New `plainSpelling` keeps transposed roots, basses and voiced-as basses within a double accidental (`Cb°/Ab`); `parseNote` still refuses more than a double (§5.1.1).
- The diagram and the shape readout learn triple and quadruple glyphs (`app/src/render/diagram.js`, `app/src/music/shape-readout.js`, e.g. `E𝄫♭`).
- cifra.md: §5.5 reworded in `cifra.md/spec/5-chord-symbols.md`; the reference (`cifra.md/reference/cifra_md/pitch.py`) and JavaScript (`cifra.md/js/src/pitch.js`) write `Ebbb`/`Ebbbb`; `Fb°7` tone tests added in both (and the Python/JS suites).
- Unit tests: `app/src/core/{pitch,chord,transpose}.test.js`, `app/src/render/render.test.js`, `app/src/music/shape-readout.test.js`, `app/src/songs/song-sheet.test.js`, `app/src/device/entry.test.js`, `cifra.md/reference/tests/test_chords.py`, `cifra.md/js/test/chord.test.js`.
- Behavior test: `app/src/songs/SongReading.behavior.test.jsx` (offsets 0..11, axe at +1). No corpus entries (Decision 6).
- No tech-debt follow-ups.
