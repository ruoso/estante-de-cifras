# music.explorer_flip_copy — The explorer reads an augmented fifth as the workflow writes it

## TaskJuggler entry

[`tasks/55-music.tji`](../../55-music.tji), `task music.explorer_flip_copy`
("The explorer reads an augmented fifth as the workflow writes it"), under
`task music`. `depends !explorer`. Listed in `milestones.m5` (the polish
milestone, `tasks/99-milestones.tji:44`).

`note`: *"Workflow 16 (Viewing by notation) offers to read C7+ as C7#5; the app
asks Read as C7(5+) instead?. Use the notation the workflow names for the flip,
in every language. Source: UI audit 2026-10-14 (app screens vs rendered boards;
e2e/web/lib/mockup.js). Tests: unit (the flip label for C7+ and its siblings);
e2e-web (the explorer on C7+, mockup W16#3). Also (pairwise audit): the
difficulty words read Easy/Medium/Hard where the W16 board writes them
lowercase."*

## Effort estimate

0.5d (`allocate team`), unchanged. One pure helper that spells the flip's
alternative, one small formatter option (Unicode accidentals) and one formatter
fix (American fourth-on-a-seventh), the explorer switched to the helper, four
locale strings lowercased, one behavior-test regex and one e2e case extended.
No new screen, no new control, no Worker change.

## Repository

**estante-de-cifras** only — app work (the note does not start with
`cifra.md:`). The app's notation module (`app/src/core/notation/`) is the music
core carried over from Explore Chords, not the cifra.md format: nothing lands
under `cifra.md/`, no spec, reference or corpus change. Directories touched:

- `app/src/core/notation/format.js` — a `{ accidentals: 'unicode' }` option on
  `formatChord` (default ASCII, unchanged for every existing caller); the
  American formatter's fourth-on-a-seventh spelling.
- `app/src/core/notation/flip.js` (new) — `flipSymbol`, the pure function that
  spells the flip's alternative; `flip.test.js` (new) beside it.
- `app/src/music/ChordExplorer.jsx` — the notice (L171–193) uses `flipSymbol`
  instead of `formatChord(altParsed.chord, dialect)`.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the `difficulty` words
  lowercased.
- Tests: `app/src/core/notation/notation.test.js` (extended),
  `app/src/music/ChordExplorer.behavior.test.jsx` (extended),
  `e2e/web/tests/explorer.spec.js` (extended).

Design delta: `docs/workflows/16-chord-explorer.md` §Viewing by notation — one
paragraph, *How the flip spells the other reading* (written with this
refinement; rides in the closer's commit).

## Inherited dependencies

- **`music.explorer`** (`!explorer`) — Done 2026-10-06
  ([`explorer.md`](explorer.md)). Built the explorer, the reading-it-took
  notice and the flip (`ChordExplorer.jsx` L94, L150–153, L171–193), the
  `sevenFour` ambiguity in `dialects.js`/`parse.js`, the shared
  `FingeringGroups.jsx` with its difficulty badge, and `explorer.spec.js` with
  the W16#3 mockup frame. Settled.

Nothing else is needed to drive the tests: the e2e journey starts from search's
chord row (`openExplorer` in `explorer.spec.js`), which `music.explorer`
shipped, on a fresh device with no book online.

## What this task is

The explorer's flip names the other reading of an ambiguous chord. Today it
spells that reading in the user's own dialect, so a Brazilian-notation user
typing `C7+` is told *Read as C7M — major seventh* and offered *Read as C7(5+)
instead?* — where workflow 16 and the W16 board say *Read as C7♯5 instead?*.
This task makes the flip spell the other reading the way the workflow does: in
American spelling with `♯`/`♭`, unless the flip is back to the user's own
dialect's reading. It covers the sharp-fifth family (`C7+`, `Cm7+`, `C7+/E`,
`C7+(9)`) and the other three ambiguities that use the same flip (`C9`, `B°`,
`C7(4)`). That last one needs the American formatter to write `C7add4` and
`C7sus4` where today it writes `C74` and `Csus47`. It also lowercases the
difficulty words on the shape badges (*easy*, *medium*, *hard*), as the
workflow writes them and the board draws them.

## Why it needs to be done

`C7+` is what workflow 16 calls "the dangerous one: three identical characters,
two chords a semitone apart". The flip exists so the user can see the other
chord and pick it. `C7(5+)` is the Brazilian spelling of that chord. It is
correct, but it looks too much like the `C7+` the user typed, and it is not what
the workflow promises. The UI audit of 2026-10-14 (e2e mockup screenshots
against the rendered boards) flagged both this and the capitalised badges. This
task is a leaf in `milestones.m5`, and nothing downstream depends on it.

## Inputs / context

- `docs/workflows/16-chord-explorer.md` §Viewing by notation (L75–118 after the
  delta): the four ambiguities and their flips, *"read as C7M (major seventh) ·
  read as C7♯5 instead?"*, *"read as C9 (dominant ninth) instead?"*, *"read as
  Bdim (diminished triad) instead?"*, *"read as C7add4 (added fourth)
  instead?"*. The new paragraph *How the flip spells the other reading* is this
  task's delta.
- `docs/workflows/16-chord-explorer.md` L49–55 (§The shapes): each shape
  carries "a **difficulty word** instead — *easy*, *medium* or *hard*".
- `docs/mockups/W16-chord-explorer.dc.html:127-128`: the tablet notice, *Read
  as **C7M** — major seventh…* and the button *Read as C7♯5 instead?*. Lines
  135, 139, 148, 152, 161, 214–236 draw the badges `easy`/`medium`/`hard` in
  lowercase. `docs/mockups/theme.css:178` `.badge` has no `text-transform`,
  and neither does `app/src/theme/theme.css:327`.
- `e2e/web/lib/mockup-frames.json:428-453`: the W16 frames (#3 = tablet, "an
  ambiguous symbol, C7+, with the reading it took and the flip").
  `e2e/web/lib/mockup.js:45` `mockup(page, board, index)`.
- `app/src/music/ChordExplorer.jsx`:
  - L94 `ambiguity = parsed?.ambiguities?.[0]`;
  - L107 `chordSymbol = formatChord(chord, dialect)`, the reading line (this
    stays in the user's dialect);
  - L150–153 `flip()` stores `{ [kind]: alternatives[0] }` in `overrides`;
  - L171–193: the notice. `altParsed` re-parses with the alternative, then
    L177 does `altSymbol = formatChord(altParsed.chord, dialect)`. **This is
    the line the task replaces.**
- `app/src/core/notation/dialects.js:39,49,59`: each dialect's default reading
  per kind. `brazilian` gives `sevenPlus: majorSeventh`,
  `sevenFour: suspendedFourth`; `american` and `realbook` give
  `dominantSharpFive`, `addedFourth`.
- `app/src/core/notation/format.js`:
  - L20–21 the alteration maps, with ASCII `#`/`b` in American (`ALTER_PREFIX_US`);
  - L73 `formatBrazilian`. L86–87 and L115 give the aug-on-a-seventh as `7(5+)`,
    and L93–94 give sus4 as `4`, which is where `C47` comes from;
  - L126 `formatAmerican`. L138–145 build the base, with `sus4` in the base
    and so before the `7` (giving `Csus47`), and L165 appends `#5`;
  - L177 `formatRealBook`;
  - L240 `formatChord(c, dialectId)`.
- `app/src/i18n/locales/en.js:571-572`: `notice.readAs` and `notice.flip` (`'Read
  as {chord} instead?'`). The chord is interpolated and never translated, and
  the same holds in `pt-BR.js:526-527`, `es-419.js:526-527` and `it.js:526-527`.
- The `difficulty` words are at `en.js:1412`, `pt-BR.js:1276`, `es-419.js:1277`
  and `it.js:1276`. They render in `app/src/music/FingeringGroups.jsx:52`,
  which is shared by the explorer and the song picker (`SongArrange.jsx:460`).
  `app/src/render/diagram.js:226` already lowercases them for the diagram's
  accessible name (`diagram.toPlay`, `en.js:1423`).
- Existing tests:
  - `ChordExplorer.behavior.test.jsx` L169–195 expects `/^(Easy|Medium|Hard)$/`
    (L181–182). L297–317 flips `C7(4)` but never asserts the flip's text.
  - `notation.test.js` L81–103 is the C7+ ambiguity, L308–325 the format cases,
    and L359–365 the C7+ flip by tones.
  - `explorer.spec.js` L97–124 types `C7+`, expects `/Read as/` and calls
    `mockup(page, 'W16-chord-explorer', 3)`.

What each symbol renders today, as reading → flip (Explore survey, run through
`parseChord`/`formatChord`):

- In `brazilian`:
  - `C7+` → C7M / **C7(5+)**
  - `Cm7+` → Cm7M / **Cm7(5+)**
  - `C7+/E` → C7M/E / **C7(5+)/E**
  - `C7+(9)` → C7M(9) / **C7(9)(5+)**
  - `C9` → C(9) / C7(9)
  - `C°` → C° / Cdim
  - `C7(4)` → C47 / **C7(4)**
- In `american`:
  - `C7+` → C7#5 / Cmaj7
  - `C7(4)` → C74 / **Csus47**

## Constraints / requirements

- **The flip spells the other reading as workflow 16 says** (the delta
  paragraph).
  - Use the user's dialect when the alternative is that dialect's own default
    reading for the kind (`getDialect(dialect).readings[kind] === alternative`).
    That is the flip back after a first flip.
  - Otherwise use **American with Unicode accidentals**.
  - `chordSymbol` (the reading taken) stays in the user's dialect, as the board
    draws it (*Read as **C7M***).
- **Unicode accidentals are display only.** `formatChord(c, dialect)` with no
  options returns exactly what it does today, byte for byte. Charts,
  transposition (`core/transpose.js`) and anything written to a book keep ASCII
  `#`/`b`, so canonical form is untouched. The option is applied structurally
  in the formatter, as a different alteration map and note spelling, never by
  a string replace over the output.
- **American fourth on a seventh:** a suspended fourth over a dominant seventh
  formats as `C7sus4` and an added fourth as `C7add4`. A sus4 triad stays
  `Csus4`. This changes the American output of these two shapes everywhere
  `formatChord(…, 'american')` is used; both are bug fixes, pinned by unit.
- **In every language:** no locale gains a chord spelling. The `{chord}` in
  `notice.flip` is the same string in all four locales.
- **Difficulty words lowercase in all four locales:**
  - `en`: easy/medium/hard;
  - `pt-BR`: fácil/média/difícil;
  - `es-419`: fácil/media/difícil;
  - `it`: facile/media/difficile.

  `diagram.js:226`'s `.toLowerCase()` stays, and is now a no-op. The words
  are a badge in mid-row, never at the start of a sentence, so lowercase
  everywhere is right.
- Accessibility: the flip stays a React Aria `Button` and its accessible name is
  its text (*Read as C7♯5 instead?*). Screen readers read `♯` as "sharp", and
  the reading word beside it carries the meaning (*dominant 7th, raised 5th*).
  axe stays clean on the explorer.

## Acceptance criteria

Behavior delivered:

1. A Brazilian-notation user typing `C7+` sees *Read as C7M — major seventh…*
   and the button *Read as C7♯5 instead?*. After flipping, the button reads
   *Read as C7M instead?*.
2. The sharp-fifth siblings flip to `Cm7♯5`, `C7♯5/E` and `C9♯5` (for
   `C7+(9)`). The other ambiguities flip to `C9` (bare `C9`), `Cdim` (`C°`) and
   `C7add4` (`C7(4)`), as workflow 16 names them.
3. An American-notation user on `C7+` is offered *Read as Cmaj7 instead?*,
   which is the American major seventh, in the user's own dialect. On `C7(4)`
   they are offered *Read as C7sus4 instead?*.
4. Shape badges read *easy* / *medium* / *hard* (lowercase in every locale) in
   the explorer and in the song picker.

Tests, by level:

- **unit** — `app/src/core/notation/flip.test.js` (new): `flipSymbol` over
  the flip labels for C7+ and its siblings, plus the other three kinds
  (workflow 16 §Viewing by notation, the delta paragraph).
  - In `brazilian`:
    - `C7+` → `C7♯5`, and after the override → `C7M`;
    - `Cm7+` → `Cm7♯5`;
    - `C7+/E` → `C7♯5/E`;
    - `C7+(9)` → `C9♯5`;
    - `C9` → `C9`;
    - `C°` → `Cdim`;
    - `C7(4)` → `C7add4`.
  - In `american`:
    - `C7+` → `Cmaj7`;
    - `C9` → `Cadd9`;
    - `C7(4)` → `C7sus4`.
  - `realbook`: `C7+` → `Cmaj7`, which the flip spells in American because
    the alternative is not Real Book's own default.
  - A non-ambiguous symbol (`C7(5+)`, `C+`) returns `null`.
  - No label contains ASCII `#`.
- **unit** — `app/src/core/notation/notation.test.js` (extended, in the format
  block by L308–325):
  - `formatChord(C7♯5, 'american', { accidentals: 'unicode' })` → `C7♯5`;
  - a flat ninth → `C7♭9`;
  - a sharp root → `C♯m`;
  - the same chords without the option still give `C7#5`, `C7b9`, `C#m`
    (ASCII unchanged);
  - American `C7sus4` and `C7add4` round-trip through `parseChord` and
    `formatChord`, and `Csus4` stays `Csus4`.
- **behavior** — `app/src/music/ChordExplorer.behavior.test.jsx` (extended):
  - the ranked-groups test's regex (L181–182) becomes
    `/^(easy|medium|hard)$/` (workflow 16 L49–55; board badges);
  - a new case types `C7+` in the default (`brazilian`) dialect and asserts:
    - the button is named exactly `Read as C7♯5 instead?`;
    - pressing it shows the *raised 5th* reading;
    - the button is then named `Read as C7M instead?`;
    - axe is clean.

  The test's own songs and shapes are the existing fixtures (no third-party
  words).
- **e2e-web** — `e2e/web/tests/explorer.spec.js` (extended, the case at
  L97–124, on all three viewports):
  - after `input.fill('C7+')`, expect the button `{ name: 'Read as C7♯5
    instead?' }` visible *before* `mockup(page, 'W16-chord-explorer', 3)`, so
    the W16#3 frame captures the drawn copy;
  - expect a badge reading `easy` among the shapes;
  - press the flip and expect `{ name: 'Read as C7M instead?' }`;
  - axe on the explorer after the flip.

  Real UI only: the journey types into the Chord field and presses buttons,
  with no `#dev/*` mount, no injected state and no network mock.

Deferred: **`music.fourth_with_seventh_spelling`** (0.5d, not `cifra.md:`,
milestone `m5`). The Brazilian and Real Book formatters write a fourth on a
seventh as `C47`/`C74`/`Csus47` (`format.js` L93–94, L108–111 and the Real Book
twin). That is visible in the explorer's *reading* line (`Read as C47 —
suspended 4th`), in the flip back for a Brazilian user on `C7(4)`, and in
transposed charts. The task spells these in each dialect's own notation and
pins them with unit tests in `notation.test.js` and a behavior assertion on the
reading line. Depends `music.explorer_flip_copy` (closer registers in WBS).

## Decisions

1. **The flip is spelled in American with `♯`/`♭`, except a flip back to the
   user's dialect.**
   - The workflow's four flips are exactly what the American formatter gives
     once the fourth-on-a-seventh is fixed and accidentals are Unicode.
   - It is the one spelling that tells the two readings apart for every
     ambiguity: `♯5`, `add4`, `dim`, a bare `9` meaning the dominant.
   - Rejected: the user's dialect, as today. Brazilian spells the sharp-fifth
     seventh `C7(5+)` and the added fourth `C7(4)`, which is literally the
     ambiguous symbol, so the flip would offer the very text the user typed.
   - Rejected: "the first dialect whose default is the alternative". It sends
     a Real Book user's `C7(4)` flip through Brazilian, and the degree-sign
     triad has no dialect that defaults to it.
   - The flip-back exception keeps the notice consistent with how it first
     named that reading: *C7M*, not *Cmaj7*, for a Brazilian user.
   - Recorded as a workflow 16 delta, because the workflow showed the spellings
     but never stated the rule.
2. **Unicode accidentals as a `formatChord` option, not a post-processing
   replace or a fourth "dialect".**
   - A string replace of `b` is fragile, and a pseudo-dialect would leak into
     the preference's value space.
   - Defaulting to ASCII keeps every chart, transposition and saved file
     unchanged.
3. **`flipSymbol` lives in `core/notation/flip.js`, not inline in the
   component.**
   - It is pure (text, dialect, overrides → string | null), so the note's
     "unit (the flip label for C7+ and its siblings)" can pin it without
     rendering.
   - The explorer is its one caller today.
4. **The American fourth-on-a-seventh fix is in scope, and the Brazilian and
   Real Book ones are deferred.**
   - The flip's American spelling must be right for the `C7(4)` flip the
     workflow names, so that fix belongs here.
   - The other dialects' spellings only affect the reading line and charts,
     and choosing Brazilian's spelling for a sus4 seventh is its own small
     decision (`C7(4)`, `C7sus4` or `C4(7)`), so it is registered as a
     follow-up rather than squeezed into 0.5d.
5. **Lowercase the locale strings, not a CSS `text-transform`.** The board
   draws the words lowercase in plain `.badge` text, and changing the strings
   keeps copy and rendering one thing. The words are only ever used as a badge
   and inside the diagram's accessible name, which already lowercases them.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-16.

- `app/src/core/notation/flip.js` (new) spells the explorer's flip in the workflow 16 notation (C7♯5, Cdim, C7add4; the user's own dialect on a flip back); unit tests in `app/src/core/notation/flip.test.js`.
- `app/src/core/notation/format.js`: a display-only `formatChord` accidentals option for Unicode ♯/♭ (plain output unchanged); the American formatter now writes `C7sus4`/`C7add4`; tests in `app/src/core/notation/notation.test.js`.
- `app/src/music/ChordExplorer.jsx` uses the new flip labels; difficulty badges are lowercase in `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Behavior: `app/src/music/ChordExplorer.behavior.test.jsx` (badge regex lowercased; new C7+ flip case, axe clean).
- e2e-web: `e2e/web/tests/explorer.spec.js` (C7+ flip button and `easy` badge before W16#3, flip back, axe), green on phone, tablet and computer.
- Design delta: `docs/workflows/16-chord-explorer.md`.
- Follow-up registered: `music.fourth_with_seventh_spelling` (Brazilian/Real Book `C47`/`Csus47`).
