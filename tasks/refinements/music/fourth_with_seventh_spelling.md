# music.fourth_with_seventh_spelling — A fourth on a seventh is spelled in each dialect's own notation

## TaskJuggler entry

[`tasks/55-music.tji`](../../55-music.tji), `task music.fourth_with_seventh_spelling`
("A fourth on a seventh is spelled in each dialect's own notation"), under
`task music`. `depends !explorer_flip_copy`. Listed in `milestones.m5` (the
polish milestone, `tasks/99-milestones.tji:44`).

`note`: *"Source: music.explorer_flip_copy
(tasks/refinements/music/explorer_flip_copy.md); workflow 16 (Viewing by
notation). The Brazilian and Real Book formatters write a fourth on a seventh
as C47/Csus47; spell them in each dialect's own notation. Tests: unit (the
Brazilian and Real Book formatters on C7 with a fourth, round-tripped through
parseChord)."*

## Effort estimate

0.5d (`allocate team`), unchanged. Two formatter branches rewritten in one
pure module (`format.js`: the Brazilian parenthesis, the Real Book
sus4/add4), unit tables in three existing test files, and one existing
explorer behavior case extended. No new screen, no new control, no Worker
change, no new module.

## Repository

**estante-de-cifras** only — app work (the note does not start with
`cifra.md:`). The app's notation module (`app/src/core/notation/`) is the music
core carried over from Explore Chords, not the cifra.md format: nothing lands
under `cifra.md/`, no spec, reference or corpus change. cifra.md §5.6 already
says what the Brazilian spelling is; this task makes the app's formatter write
it.

- `app/src/core/notation/format.js` — `formatBrazilian` (L88–139) and
  `formatRealBook` (L195–244). `formatAmerican` (L141–193) is already right
  (fixed by `music.explorer_flip_copy`) and does not change.
- Tests: `app/src/core/notation/notation.test.js`,
  `app/src/core/notation/flip.test.js`, `app/src/core/transpose.test.js`,
  `app/src/music/ChordExplorer.behavior.test.jsx` (all extended).

No design delta (see Decision 6).

## Inherited dependencies

- **`music.explorer_flip_copy`** (`!explorer_flip_copy`) — Done 2026-10-16
  ([`explorer_flip_copy.md`](explorer_flip_copy.md)). Added `flipSymbol`
  (`app/src/core/notation/flip.js`), the `{ accidentals: 'unicode' }` option and
  the American fourth-on-a-seventh fix (`C7sus4`, `C7add4`), and deferred the
  Brazilian and Real Book ones here (its Decision 4). Settled.
- Transitively, **`music.explorer`** (the notice, the flip and the star,
  `ChordExplorer.jsx` L108, L125–148, L172–192) and **`music.transpose`**
  (`transpose.js` L203 formats every transposed chord in the song's dialect).
  Settled.

Nothing else is needed to drive the tests: the unit tests are pure; the
behavior case uses the explorer's existing harness (`makeSeededWorker`,
`startGitHttpRemote`, `readHome`, `ChordExplorer.behavior.test.jsx` L236–272),
which already stars a shape and reads `shapes.json` back.

## What this task is

`formatChord` (`format.js` L263–269) writes a chord in the user's notation
dialect. Over a seventh, the Brazilian and Real Book formatters spell a fourth
in no dialect's notation. Measured against today's code (each parsed in
American, formatted in the dialect, parsed back in the dialect):

| chord | `brazilian` today | `realbook` today |
|---|---|---|
| C7sus4 | `C47` | `Csus47` |
| C9sus4 | `C47(9)` | `Csus49` |
| Cmaj7sus4 | `C47M` | `Csus4∆7` |
| C13sus4 | `C413` | `Csus413` |
| C7sus4♭9 | `C47(9-)` | `Csus47b9` |
| C7add4 | `C7(4)` — **reads back as C7sus4** | `C74` |
| Cmaj7add4 | `C7M(4)` — **reads back as Cmaj7sus4** | `C∆74` |
| C9add4 | `C7(9)(4)` — **reads back as C9sus4** | `C94` |
| Cm7add4 | `Cm7(4)` | `C−74` |
| Cadd4 | `C(4)` — **reads back as Csus4** | `Cadd4` |

Two faults: the sus4 spellings are not what a Brazilian cifra or a Real Book
writes, and the Brazilian added fourth breaks the formatter's own contract,
`parse(format(c, d), d) === c` (`format.js` L5–7): `C7(4)` is the Brazilian
suspended chord (cifra.md §5.6), so a Brazilian formatter that writes an added
fourth as `(4)` turns it into a suspension.

The task makes the two formatters spell a fourth as follows (American is
unchanged):

**`brazilian`** — one parenthesis after the seventh, ascending by degree:

- a suspended fourth over a seventh drops the `4` from the base and opens the
  parenthesis: `C7(4)`, `C7(4,9)`, `C7(4,9-)`, `C7M(4)`, `C7M(4,9)`,
  `C13(4)`. A sus4 triad stays `C4`;
- a natural added fourth on a **major** triad (with or without a seventh) is
  `add4` inside the parenthesis: `C7(add4)`, `C7M(add4)`, `C7(add4,9)`,
  `C(add4)`. On a minor triad it stays `Cm7(4)` / `Cm(4)` — never ambiguous
  there (cifra.md §5.6 L261–265);
- the dominant or major ninth's `9` joins that one parenthesis instead of
  opening a second one: `C7(9,11+)`, not `C7(9)(11+)`.

**`realbook`** — the American shape, with the Real Book's own symbols:

- a suspended fourth over a seventh follows the seventh and its stated top,
  before any alteration: `C7sus4`, `C9sus4`, `C13sus4`, `C7sus4b9`,
  `C∆7sus4`. A sus4 triad stays `Csus4`;
- a natural fourth over a seventh is `add4`, in every quality: `C7add4`,
  `C∆7add4`, `C9add4`, `C−7add4`. Without a seventh it stays `Cadd4`.

Every spelling above round-trips through `parseChord` in its dialect (checked
against the current parser while writing this refinement; see Inputs).

Where the user sees it:

- the explorer's notice, *Read as {chord} — {reading}.* (`ChordExplorer.jsx`
  L108, L178–183): a Brazilian user's `C7(4)` reads *Read as C7(4) —
  suspended 4th*, not *C47*; after the flip, *Read as C7(add4) — added 4th*,
  not *C7(4)*;
- the explorer's flip back to the user's own reading (`flip.js` L32–33), which
  is spelled in the user's dialect: *Read as C7(4) instead?*, not *C47*;
- the star's key in `shapes.json` (`ChordExplorer.jsx` L137, L144 write
  `formatChord(chord, DEFAULT_DIALECT)`, i.e. Brazilian; `fingering-groups.js`
  L45–46 and `voicings.js` L185–186 read it back with `parseChord(leaf.chord)`
  in the default dialect). Today a shape starred on the **added-fourth**
  reading is stored as `C7(4)` and comes back as a C7sus4 shape: the star
  vanishes from the chord it was given to and appears on the other. With
  `C7(add4)` it comes back as what was starred;
- transposed charts (`transpose.js` L203): a Brazilian chart's `C7(4)` up a
  tone reads `D7(4)`, not `D47`; a Real Book chart's `C7add4` reads `D7add4`,
  not `D74`.

## Why it needs to be done

- **The contract.** `format.js` promises the round trip for every dialect;
  the Brazilian added fourth breaks it today, and the breakage reaches a
  user through the star (a *your shape* that lands on the wrong chord, home
  book format §4.4: "matched by chord, not by spelling").
- **The workflow's rule.** Workflow 16 §Viewing by notation
  (`docs/workflows/16-chord-explorer.md` L109–115): *"The reading taken is
  written in the user's dialect"*, and the flip back is spelled *"in the
  user's dialect"*. `C47` and `Csus47` are no dialect's spelling, so the
  notice and the flip back are currently not in the user's dialect at all.
- **The spec names the Brazilian spelling.** cifra.md §5.6
  (`cifra.md/spec/5-chord-symbols.md` L261–265): *"`C7(4)` is the Brazilian
  suspended chord: a cifra writes `C7(4)` for what American notation spells
  `C7sus4`."*
- **The follow-up was registered for this.** `explorer_flip_copy.md`
  L262–271 and Decision 4.

## Inputs / context

- `app/src/core/notation/format.js`
  - L5–7 — the round-trip contract.
  - L44–86 `analyse` — `top`, `covered`, `extras` (ascending by degree); shared
    by the three formatters, unchanged.
  - L88–139 `formatBrazilian` — L108–110 writes `4` into the base for sus4
    (the `C47` source); L121–127 the seventh tail (`7M(top)`, `7(9)`, the bare
    top); L129–136 the extras parenthesis, where a natural 4 becomes `4` (the
    `C7(4)` round-trip fault) and a second parenthesis follows `7(9)`.
  - L141–193 `formatAmerican` — the model to follow for Real Book: L160–162
    (no `sus4` in the base over a seventh), L178 (`sus4` after the top), L186–187
    (a natural 4 over a seventh is `add4`).
  - L195–244 `formatRealBook` — L214–216 writes `sus4` into the base (the
    `Csus47` source); L236–240 writes a natural extra over a seventh as a bare
    degree (the `C74` source).
- `app/src/core/notation/parse.js`
  - L395–401 — *"Brazilian writes a suspended fourth as a bare 4"*, only as the
    first element (`C4`, `C47`).
  - L403–424 — the `sevenFour` ambiguity: a bare 4 after a stated seventh on a
    major triad; Brazilian reads `suspendedFourth`, American and Real Book
    `addedFourth`. This is why the Brazilian added fourth must not be a bare 4,
    and why the Real Book must not write `C74`/`C7(4)` for a suspension.
  - L298–303 `SUS4` after the seventh sets the quality (so `C7sus4`,
    `C∆7sus4`, `C9sus4` read as written); L314–324 `ADD` sets a natural degree
    (so `(add4)` and `add4` read as added in every dialect).
  - Checked with the current parser: `C7(4)`, `C7(4,9)`, `C7(4,9-)`, `C7M(4)`,
    `C7M(4,9)`, `C13(4)`, `C7(add4)`, `C7M(add4)`, `C7(add4,9)`, `C(add4)`,
    `Cm7(4)`, `C7(9,11+)` in `brazilian`; `C7sus4`, `C9sus4`, `C13sus4`,
    `C7sus4b9`, `C∆7sus4`, `C∆9sus4`, `C7add4`, `C∆7add4`, `C9add4`, `C−7add4`
    in `realbook` — each parses to the intended chord. **No parser change.**
- `app/src/core/notation/dialects.js` L67 — `DEFAULT_DIALECT = 'brazilian'`.
- `app/src/core/notation/flip.js` L32–33 — the flip back uses the user's
  dialect formatter.
- `app/src/music/ChordExplorer.jsx` L108 (`chordSymbol` in the user's dialect),
  L125–148 (star and unstar keyed by `formatChord(chord, DEFAULT_DIALECT)`),
  L172–192 (the notice).
- `app/src/music/fingering-groups.js` L45–46, `app/src/core/voicings.js`
  L185–186 — a stored leaf is matched by `parseChord(leaf.chord)` +
  `sameChord`.
- `app/src/core/transpose.js` L189–206 — every transposed symbol is
  `formatChord(transposed, dialect)`.
- Tests to extend: `app/src/core/notation/notation.test.js` (L162–197 the
  `C7(4)` ambiguity; L250–302 the round-trip matrix `CORPUS`; L343–355 the
  American fourth-on-a-seventh case); `app/src/core/notation/flip.test.js`
  (L15–33); `app/src/core/transpose.test.js` (L103–123, the `song`/`keyed`
  helpers L16–19); `app/src/music/ChordExplorer.behavior.test.jsx` (L236–272
  the star read-back; L298–317 the `C7(4)` flip).
- Governing documents: workflow 16 §Viewing by notation
  (`docs/workflows/16-chord-explorer.md` L75–118, the rule at L109–115) and
  §Starring a shape (L120–131); workflow 2 §Reading a song (transposition,
  view only); `docs/home-book-format.md` §4.4 (L354–372, the chord key is
  matched by chord); cifra.md §5.6 (`cifra.md/spec/5-chord-symbols.md`
  L237–265).

## Constraints / requirements

- **Round trip, every dialect.** `parseChord(formatChord(c, d), d)` equals `c`
  (by `sameChord` and by `describeChordTones`) for every chord this task
  touches, in all three dialects.
- **No parser change.** The spellings are chosen from what the parser already
  reads; the parser and its four ambiguities stay as cifra.md §5.6 states.
- **American output unchanged**, byte for byte, for every chord in the matrix.
- **ASCII by default.** The Brazilian `+`/`-` suffixes and the Real Book `b`/`#`
  prefixes keep coming from the existing `ALTER_SUFFIX_BR` / `sp.alter`; the
  Unicode option keeps working for every new spelling.
- **View only.** The formatter writes display text, transposed chart text
  (never saved — workflow 2) and the `shapes.json` chord key. A song's own
  chart text is never rewritten by this task.
- **No song text** beyond chord symbols in fixtures; the behavior test reuses
  the existing instrument seed.

## Acceptance criteria

Behavior delivered:

1. `formatChord` writes every spelling listed under *What this task is*, in
   `brazilian` and `realbook`; `american` is unchanged.
2. Every one of them reads back, in its dialect, as the chord formatted.
3. A Brazilian user typing `C7(4)` in the explorer reads *Read as C7(4) —
   suspended 4th*; after the flip, *Read as C7(add4) — added 4th* with the flip
   back named *Read as C7(4) instead?*; a shape starred on the added-fourth
   reading is stored under `C7(add4)` and shows as *your shape* on that
   reading.
4. A transposed Brazilian or Real Book chart spells a fourth on a seventh in
   the song's dialect.

Tests, by level:

- **unit** — `app/src/core/notation/notation.test.js`:
  - new `describe('a fourth on a seventh in each dialect')` with a table
    `[chord, dialect, spelling]` covering every row of *What this task is*
    (both dialects, sus4 and added fourth, over `7`, `7M`/`∆7`, a ninth, a
    thirteenth, a `♭9`; the minor added fourth; the sus4 and add4 triads):
    `formatChord(c, d)` is exactly the spelling, and `parseChord(spelling, d)`
    gives `c` back by `sameChord` and `describeChordTones` (pins `format.js`
    L5–7 and cifra.md §5.6 L261–265: `C7(4)` is the Brazilian suspension);
  - the same table formatted with `{ accidentals: 'unicode' }` on the `♭9`
    rows (`C7sus4♭9` in Real Book; Brazilian keeps its `9-` suffix) — pins the
    option through the new branches;
  - the round-trip matrix `CORPUS` (L257–288) gains: sus4 + `7`, sus4 + `maj7`,
    sus4 + `7` + `9`, sus4 + `7` + `♭9`, major + `7` + `4`, major + `maj7` +
    `4`, major + `7` + `9` + `4`, minor + `7` + `4`, major + `4`, and major +
    `7` + `9` + `♯11` — run in all three dialects by the existing `it.each`
    (pins the contract for each dialect; the added-fourth rows fail in
    `brazilian` today);
  - *the default-dialect shape key reads back as the chord starred*:
    `parseChord(formatChord(C7add4, DEFAULT_DIALECT)).chord` is the added
    fourth and the same for C7sus4 (pins home-book format §4.4: the key is
    matched by chord; `ChordExplorer.jsx` L137/L144 with `fingering-groups.js`
    L45–46);
  - the existing American case (L343–355) is left as is (pins *American
    unchanged*).
- **unit** — `app/src/core/notation/flip.test.js`:
  - *spells the flip back to the brazilian suspension in brazilian*:
    `flipSymbol('C7(4)', 'brazilian', { sevenFour: 'addedFourth' })` is
    `C7(4)` (workflow 16 L113–115: the flip back is in the user's dialect);
  - the existing `C7add4` / `C7sus4` cases (L19–29) still pass unchanged (the
    flip to the *other* reading stays American).
- **unit** — `app/src/core/transpose.test.js`, new
  `describe('transpose — a fourth on a seventh in the song's dialect')`:
  - a Brazilian chart `C7(4) C7(add4)` (`keyed('C', …)`) up 2 reads
    `D7(4) D7(add4)`;
  - the same chart with `notation: realbook` written `C7sus4 C7add4` up 2
    reads `D7sus4 D7add4`
  (pins `transpose.js` L203 against workflow 2's transposed view; uses the
  transpose API's `{ dialect }` option exactly as the existing cases do).
- **behavior** — `app/src/music/ChordExplorer.behavior.test.jsx`, the
  existing case *shows the §5.6 reading it took and re-runs the search on the
  flip (C7(4))* (L298–317) is extended:
  - before the flip, the notice reads `Read as C7(4) — suspended 4th.`;
  - after the flip, it reads `Read as C7(add4) — added 4th.` and the flip
    button is named exactly `Read as C7(4) instead?`;
  - star the first shape (`/Star C7\(add4\),/`, one keyboard gesture, as
    L246–249), then `readHome(idb, name, 'shapes.json')` holds a leaf under
    `g1 → GUITAR_TUNING → 'C7(add4)'` and the button reads back pressed as
    *your shape* (`/Your shape for C7\(add4\), .* — unstar/`);
  - axe clean on the explorer after the flip.
  (Pins workflow 16 L109–115 and §Starring L120–131; home-book format §4.4.)

No e2e-web: see Decision 7.

Deferred to **`music.voicings_song_dialect`** (closer registers in WBS; 0.5d,
not `cifra.md:`, milestone `m5`): *"A song's chords are voiced in the song's
own notation."* `resolveSongVoicings` (`app/src/core/voicings.js` L168) parses
every chart symbol with `parseChord(item.symbol)`, the default (Brazilian)
dialect, not the song's `notation` property (cifra.md §5.6 Rules: *"The
document's dialect is the `notation` property"*). So an `american` or
`realbook` song that writes `C7(4)` (an added fourth in its own notation) is
voiced as a C7sus4, and a `C7+` as a major seventh. The task threads the song's
dialect (the same one `transpose` is given) into `resolveSongVoicings` and
`unvoiceableKeys`. Tests: unit (`voicings.test.js`: an `american` song's
`C7(4)` and `C7+` resolve the added-fourth and sharp-fifth default voicings; a
`brazilian` one the suspension and the major seventh; *my shape* still matched
by chord across dialects). Found while writing this refinement; not in this
task's scope because it changes which shape a song plays, not how a symbol is
spelled.

## Decisions

1. **Brazilian sus4 over a seventh is `C7(4)`, with the `4` opening the
   parenthesis.**
   - It is the spelling cifra.md §5.6 names for the Brazilian suspended chord,
     and the one the Brazilian parser reads as a suspension (`parse.js`
     L403–424). Extensions follow it in the same parenthesis (`C7(4,9)`),
     which the parser reads as written.
   - Rejected: `C4(7)`. It parses, but it is a rarer cifra spelling, and it
     would make the notice read *C4(7)* for a `C7(4)` the user typed.
   - Rejected: `C7sus4`. It is American; workflow 16 asks for the reading in
     the user's dialect.
   - Rejected: `C7/4` (Chediak's stacked spelling). `/` is the slash bass.
2. **The Brazilian added fourth on a major triad is `(add4)`.**
   - A bare `4` there is the suspension (§5.6), so it cannot round-trip;
     `add4` is never ambiguous (§5.6 L264–265) and reads in every dialect.
   - Only on a major triad: on a minor triad `Cm7(4)` is unambiguous and is
     how a cifra writes it, so it stays.
   - Rejected: respelling the degree as `(11)`. A Brazilian cifra often writes
     the added fourth that way, but `11` is a different degree in the model
     (it implies the ninth when stated as the top), so the chord would change.
3. **One Brazilian parenthesis.** The dominant `7(9)` and the `7M(9)` fold
   their ninth into the extras' list (`C7(4,9)`, `C7(add4,9)`, `C7(9,11+)`).
   Two parentheses (`C7(9)(4)`) are not a cifra spelling, and with the fourth
   they hide which reading is meant. The fold touches other chords with a
   ninth plus an extra (`C7(9)(11+)` → `C7(9,11+)`); both parse to the same
   chord, and the matrix pins it.
4. **The Real Book follows the American shape with its own symbols.** Real
   Book charts write `C7sus4` / `C7sus` and `C7add4`-style additions; the
   American formatter already writes exactly that order (`format.js` L160–187),
   so the Real Book mirrors it with `∆` and `−`. Rejected: `C7sus` (shorter,
   also Real Book) — `sus4` is what the Real Book formatter already writes for
   a triad, and one spelling per dialect keeps the tests exact.
5. **No migration of stored `shapes.json` keys.** A leaf written today under
   `C7(4)` for an added-fourth star will still read as C7sus4. After this task
   the Brazilian formatter writes `C7(4)` for a suspension too, so the old
   leaf cannot be told apart from a new, correct one; a load-time rewrite
   would guess. The user sees the star on the suspended reading and can move
   it; new stars are right. (Home-book format §4.4 is unchanged — the key was
   always meant to be matched by chord; this task makes the key say it.)
6. **No design delta.** Workflow 16 already says the reading and the flip back
   are spelled in the user's dialect (L109–115), and cifra.md §5.6 already
   names `C7(4)` as the Brazilian suspension. The task makes the formatter do
   what both say; the workflow's bullet examples (*read as C7sus4 (suspended
   fourth)*, L100) describe the readings, not a dialect's spelling, as the
   other bullets do (*read as Cadd9* for a Brazilian `C9`).
7. **unit and behavior; no e2e-web.** The note names unit only. The behavior
   case is added because the user-visible fault (a star landing on the other
   chord) crosses the formatter, the Worker and `shapes.json`, and only the
   behavior harness reads `shapes.json` back. An e2e journey would repeat
   `explorer.spec.js`'s existing flip journey (C7+) with another symbol and
   pin nothing the behavior case does not; the formatter is pure.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-16.

- `app/src/core/notation/format.js`: `formatBrazilian` writes the fourth inside the one parenthesis (`C7(4)`, `C7(4,9)`, `C7M(4)`, `C13(4)`, `C7(add4)`, `C(add4)`) and folds a ninth top into it (`C7(9,11+)`); `formatRealBook` puts `sus4`/`add4` after the seventh (`C7sus4`, `C∆7sus4`, `C7add4`, `C−7add4`). American output unchanged; no parser change.
- Ordering deviation: a folded ninth stays before a `5-`/`5+` (the parser reads `C7(5-,9)` as a flat ninth), so C9♭5 is `C7(9,5-)`, which reads back correctly.
- Unit: `app/src/core/notation/notation.test.js` (new `a fourth on a seventh in each dialect` describe, unicode ♭9 rows, default-dialect shape-key read-back, 10 new round-trip `CORPUS` rows); `app/src/core/notation/flip.test.js` (flip back to the Brazilian suspension); `app/src/core/transpose.test.js` (Brazilian and Real Book transposed charts).
- Behavior: `app/src/music/ChordExplorer.behavior.test.jsx` — the C7(4) flip case extended with the notice text, the flip-back label, axe after the flip and a star under `C7(add4)` read back as *your shape*.
- No e2e (Decision 7) and no corpus change (no cifra.md change).
- Follow-up registered: `music.voicings_song_dialect` (0.5d, `tasks/55-music.tji`, wired into `milestones.m5`).
