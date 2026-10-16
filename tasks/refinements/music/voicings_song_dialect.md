# music.voicings_song_dialect — A song's chords are voiced in the song's own notation

## TaskJuggler entry

[`tasks/55-music.tji`](../../55-music.tji) L65–70, `task music.voicings_song_dialect`
("A song's chords are voiced in the song's own notation"), under `task music`.
`depends !fourth_with_seventh_spelling`. Listed in `milestones.m5` (the polish
milestone, `tasks/99-milestones.tji:44`).

`note`: *"resolveSongVoicings (app/src/core/voicings.js) parses every chart
symbol in the default (Brazilian) dialect, not the song's notation property
(cifra.md section 5.6), so an american or realbook song that writes C7(4) is
voiced as a C7sus4 and a C7+ as a major seventh. Thread the song's dialect (the
one transpose is given) into resolveSongVoicings and unvoiceableKeys.
Source-of-debt: tasks/refinements/music/fourth_with_seventh_spelling.md. Tests:
unit (voicings.test.js: an american song's C7(4) and C7+ resolve the
added-fourth and sharp-fifth default voicings; a brazilian one the suspension
and the major seventh; my shape still matched by chord across dialects)."*

## Effort estimate

0.5d (`allocate team`), unchanged. One option on two pure functions, one small
pure helper, and the dialect the two voicing views (reading, arrange) read a
chart in. No new screen, no new control, no Worker change, no format change.

## Repository

**estante-de-cifras** only — app work (the note does not start with
`cifra.md:`). Nothing lands under `cifra.md/`: the format already says what a
song's dialect is (§5.6 Rules), and `cifra-md`'s reader already applies it when
it is not overridden (`cifra.md/js/src/parse.js` L401–406).

- `app/src/core/voicings.js` — `resolveSongVoicings` (L145–206),
  `unvoiceableKeys` (L214–224).
- `app/src/core/notation/dialects.js` — new `songDialect(model)`.
- `app/src/songs/SongReading.jsx`, `app/src/songs/SongArrange.jsx` — read,
  transpose and voice the chart in the song's dialect.
- Tests: `app/src/core/voicings.test.js`,
  `app/src/core/notation/notation.test.js`,
  `app/src/songs/SongReading.behavior.test.jsx`,
  `app/src/songs/SongArrange.behavior.test.jsx` (all extended).

Design delta: `docs/workflows/02-find-and-play.md` §Reading a song — one bullet,
*"The song's notation reads its chords"* (Decision 1).

## Inherited dependencies

- **`music.fourth_with_seventh_spelling`** (`!fourth_with_seventh_spelling`) —
  Done 2026-10-16 ([`fourth_with_seventh_spelling.md`](fourth_with_seventh_spelling.md)).
  Each dialect now spells a fourth on a seventh in its own notation and every
  spelling round-trips (`C7(4)`/`C7(add4)` Brazilian, `C7sus4`/`C7add4` Real Book),
  and the default-dialect `shapes.json` key reads back as the chord starred. It
  registered this task (its Acceptance criteria, *Deferred to*). Settled.
- Transitively **`music.transpose`** (`transpose(model, semitones, { dialect })`,
  `app/src/core/transpose.js` L189) and **`songs.reading`** / **`songs.arrange`**
  (the two views that call the resolver). Settled.

Nothing else is needed to drive the tests: the unit tests are pure (cifra-md
`parse`, `fromCatalog('6guitar')`); the behavior cases use the existing stub-Worker
harnesses of `SongReading.behavior.test.jsx` (`makeStore` L122, which takes a
`preferences` map, so a test sets `notation`) and `SongArrange.behavior.test.jsx`
(the *writes every unchosen chord* case, L274).

## What this task is

A song's chart symbols are read in **the song's dialect**: its `notation`
property, or `brazilian` when it has none (cifra.md §5.6 Rules). Today the
resolver that decides each chord's shape reads every symbol with
`parseChord(item.symbol)` (`voicings.js` L168, L219), the default Brazilian
dialect, whatever the song declares. And the two views that call it parse and
transpose the song in the **user's** preference instead (`SongReading.jsx`
L280, L305–306; `SongArrange.jsx` L134, L162), overriding the song's property
(`cifra-md` `parse(text, dialect)`: the second argument is an override,
`parse.js` L401). So an `american` song that writes `C7+` and `C7(4)`:

| | read today (Brazilian user) | the song means (§5.6) |
|---|---|---|
| `C7+` | C7M — major-seventh shape | C7♯5 — sharp-fifth shape |
| `C7(4)` | C7sus4 — suspended shape | C7add4 — added-fourth shape |

The guitarist is shown a shape a semitone away from the chord the author wrote.

The task:

1. `resolveSongVoicings(parsed, instrument, { …, dialect })` and
   `unvoiceableKeys(parsed, resolved, { dialect })` read each chart symbol in
   `dialect` (default `DEFAULT_DIALECT`, as `transpose`'s option does). A
   *my shape* leaf's chord (`voicings.js` L185) keeps being read in
   `DEFAULT_DIALECT`, the dialect `shapes.json` keys are written in
   (`ChordExplorer.jsx` L137/L144; home-book format §4.4) — so a star still
   matches by chord across dialects.
2. A pure `songDialect(model)` in `app/src/core/notation/dialects.js` returns
   the dialect a parsed song resolves to, exactly as the reader resolves it
   (`parse.js` L401–405, `write.js` L49–58): the `notation` property,
   ASCII-lowercased with spaces removed, if it names a known dialect; otherwise
   `DEFAULT_DIALECT`.
3. **SongReading** parses the song without the preference override
   (`parse(text)`), takes `const notation = songDialect(baseModel)`, and passes
   it to `transpose` (L306), to `resolveSongVoicings` and `unvoiceableKeys`
   (L319–333), and to the `parseChord` of each shape's symbol for the diagram
   context (L478). The context's `dialect` (how the explorer and the diagram
   *spell* a chord for this user) stays the preference.
4. **SongArrange** does the same: `parse(text)` at L162, L210, L225, L260;
   `notation` to `resolveSongVoicings` (L169), `unchosenPlan` (L223, which
   analyses the chart via `analyseSong(model, dialect)`), and every
   `parseChord` of a chart symbol (L274, L319, L353). Props and context fields
   that spell for the user (`EnterShape dialect` L455, `pickerContext.dialect`
   L277, `speakChord`'s `notation` L320) stay the preference.

## Why it needs to be done

- **The format says so.** cifra.md §5.6 Rules
  (`cifra.md/spec/5-chord-symbols.md` L269–284): *"The document's dialect is the
  `notation` property (§1.4.3), or `brazilian` if absent"*; *"the document says
  which notation it is in, and the reader follows it."*
- **Workflow 3 writes the property for this.** `docs/workflows/03-write-a-new-song.md`
  L81–85: a new song writes `notation:` from its author's preference *"so that it
  reads the same to someone whose preference differs."* Today it does not: a
  Brazilian reader of an American author's `C7+` gets a different chord.
- **The wrong shape is the worst failure the reading view has** — a diagram a
  semitone off, on stage (DIRECTION §3.7).
- **Registered by the predecessor** (`fourth_with_seventh_spelling.md`,
  *Deferred to `music.voicings_song_dialect`*).

## Inputs / context

- `app/src/core/voicings.js`
  - L145–149 — `resolveSongVoicings(parsed, instrument, { variation, shapes,
    ignoreSongVoicings })`; L168 `parseChord(item.symbol).chord` (the default
    dialect); L183–187 my shape matched by `parseChord(s.chord)` + `sameChord`;
    L194–198 default memoised per symbol.
  - L214–224 — `unvoiceableKeys`; L219 the same default-dialect parse.
- `app/src/core/notation/parse.js` L136 — `parseChord(text, dialectId =
  DEFAULT_DIALECT, options)`.
- `app/src/core/notation/dialects.js` L67 `DEFAULT_DIALECT`, L73–75 the dialect
  lookup (throws on an unknown id — hence `songDialect` must fall back, not
  pass the raw property).
- `cifra.md/js/src/parse.js` L401–406 — the reader's dialect: override, else
  `notation`, else default, with `bad-notation` falling back to the default;
  L1105 `parse(bytes, dialect = null)`. `cifra.md/js/src/write.js` L49–58 and
  `merge.js` L713–720 — the same resolution, from `doc.properties`.
- `app/src/core/transpose.js` L150–203 — `chooseInterval` and `transpose` parse
  and re-format every symbol in the `dialect` they are given.
- `app/src/songs/SongReading.jsx` L280 (`dialect` = the preference), L305–306
  (parse with override, transpose), L316–333 (resolve, unvoiced), L478 (diagram
  context).
- `app/src/songs/SongArrange.jsx` L134, L162, L169, L210, L223, L225, L260,
  L274, L277, L319–320, L353, L455.
- `app/src/songs/arrange-choices.js` L55–57 — `unchosenPlan(model, resolved,
  dialect)` → `analyseSong(model, dialect)`.
- Tests to extend: `app/src/core/voicings.test.js` (L15–21 the `song` and
  `shape` helpers; L82 the Cmaj7-star-for-C7M case — workflow 2 L112);
  `app/src/core/notation/notation.test.js`;
  `app/src/songs/SongReading.behavior.test.jsx` (L61 `song({ props, chart })`,
  L111–113 `register`, L122 `makeStore({ preferences })`, L219–239 the shapes
  region assertions); `app/src/songs/SongArrange.behavior.test.jsx` (L274 the
  *writes every unchosen chord* case).
- Governing documents: cifra.md §5.6 (`cifra.md/spec/5-chord-symbols.md`
  L237–284); workflow 2 §Reading a song and §Where a chord's shape comes from
  (`docs/workflows/02-find-and-play.md` L69–118 after this task's bullet, *my shapes match by chord, not
  by spelling*); workflow 2 §Transposing (L119–); workflow 3 §The notation
  property (L81–85); workflow 16 §Viewing by notation
  (`docs/workflows/16-chord-explorer.md` L75–118 — the preference is how the
  *user* reads and spells); `docs/home-book-format.md` §4.4 (the `shapes.json`
  chord key, matched by chord).

## Constraints / requirements

- **One dialect per chart, end to end.** Within a view, the chart is parsed,
  transposed, voiced, analysed for arrange and its symbols parsed for the
  diagram context, all in `songDialect(model)`. A transposed model's symbols
  are formatted in that same dialect (`transpose.js` L203), so the resolver
  reads back what transpose wrote.
- **The preference still spells.** Whatever *displays* a chord to the user —
  the explorer opened from a diagram, the diagram's speech, the shape picker,
  the chip's key name — keeps the user's preference (workflow 16 §Viewing by
  notation).
- **My shapes are keyed in the default dialect.** `shapes.json` chord keys are
  written with `formatChord(chord, DEFAULT_DIALECT)`; the resolver reads them
  in `DEFAULT_DIALECT` regardless of the song's dialect.
- **Pure core.** `voicings.js` and `dialects.js` stay React-free and
  Worker-free (DIRECTION §3.7); the change is an option and a helper.
- **Existing callers unchanged in meaning.** `dialect` defaults to
  `DEFAULT_DIALECT`, so every existing test of the resolver keeps passing as is.
- **No song text written.** The task changes reading only; the song's text and
  its `notation` property are never rewritten. Arrange's writes (`chooseShapes`,
  `addVariation`) keep copying symbols as written (cifra.md §8).
- **Accessibility.** No new UI; the touched views stay axe clean.
- **Fixtures** are chord charts written for the purpose (`C7+  C7(4)`), no
  lyrics from anyone.

## Acceptance criteria

Behavior delivered:

1. In an `american` (or `realbook`) song, `C7+` is voiced as C7♯5 and `C7(4)`
   as C7add4, whatever the user's preference; in a song with no `notation` (or
   `notation: brazilian`), as C7M and C7sus4.
2. Transposing such a song keeps those chords (an `american` `C7+` up a tone
   is still a sharp-fifth seventh, and its shape is that chord's default).
3. A *my shape* starred for a chord serves that chord in a song of any dialect,
   and only that chord.
4. Arrange's *write every unchosen chord* writes the song-dialect reading's
   shapes.

Tests, by level:

- **unit** — `app/src/core/voicings.test.js`, new
  `describe("resolveSongVoicings — the song's own notation (cifra.md §5.6)")`,
  chart `C7+  C7(4)` (via the `song` helper), on guitar:
  - *an american song voices C7+ as the sharp fifth and C7(4) as the added
    fourth*: with `notation: american` in the song and `{ dialect: 'american' }`,
    `get('C7+').fingering.shorthand` equals
    `defaultVoicing(parseChord('C7#5', 'american').chord, guitar).shorthand`
    and `get('C7(4)')` equals the `C7add4` default; both `source: 'default'`;
  - *a brazilian song voices them as the major seventh and the suspension*:
    no `notation`, no option → the `C7M` and `C7sus4` defaults;
  - a guard that the two readings' defaults differ (so the cases above can
    fail);
  - *a realbook song reads them as american does* (`{ dialect: 'realbook' }` →
    the C7♯5 and C7add4 defaults);
  - *my shape matched by chord across dialects*: a star under `C7(add4)` (the
    default-dialect key `formatChord` writes) serves the `american` song's
    `C7(4)` as `yours` and does **not** serve the `brazilian` song's `C7(4)`
    (which takes the C7sus4 default); a star under `C7(4)` (the suspension)
    serves the brazilian one and not the american one (pins workflow 2
    §Where a chord's shape comes from L112–113, home-book format §4.4, *matched by chord, not by spelling*);
  - *unvoiceableKeys reads in the same dialect*: on ukulele, `unvoiceableKeys(
    parsed, resolved, { dialect })` lists exactly the keys the resolver left
    out under that dialect — with the american and brazilian readings of the
    same chart each agreeing with their own resolution.
  (Pins cifra.md §5.6 Rules, the note's three cases.)
- **unit** — `app/src/core/notation/notation.test.js`, new
  `describe('songDialect')`: `notation: american` → `american`;
  `notation: Real Book` → `realbook` (lowercased, spaces removed); no property →
  `brazilian`; `notation: klingon` → `brazilian`; and for each, the same answer
  the reader takes — `parse(text)` of a song with `C7+` classifies it as the
  chord `parseChord('C7+', songDialect(model))` gives (pins §5.6 Rules and
  `cifra.md/js/src/parse.js` L401–405).
- **behavior** — `app/src/songs/SongReading.behavior.test.jsx`, new
  `describe("SongReading — the song's own notation (workflow 2 §Reading a song)")`,
  preferences `{ instrumentInUse, notation: register('brazilian') }`:
  - *an american song's C7+ and C7(4) show the sharp-fifth and added-fourth
    shapes*: song `props: ['notation: american']`, chart `C7+  C7(4)`, no
    voicings; the two diagrams in the Shapes region carry the accessible names
    the renderer gives the C7♯5 and C7add4 defaults (not those of C7M and
    C7sus4), each marked `default`; axe clean;
  - *transposed up a tone, they stay the sharp-fifth and added-fourth chords*:
    after **Up a semitone** twice, the diagrams' names are those of the D7♯5
    and D7add4 defaults (pins workflow 2 §Transposing with the song's dialect;
    `transpose.js` L203).
- **behavior** — `app/src/songs/SongArrange.behavior.test.jsx`, new case
  *writes an american song's unchosen chords as the song reads them*: same song
  and preference; *write every unchosen chord* persists a voicings block whose
  `C7+` and `C7(4)` entries are the C7♯5 and C7add4 default frets (pins
  `unchosenPlan` with the song's dialect; workflow 5's write-in); axe clean on
  the arrange view.

No e2e-web: see Decision 5.

Deferred to **`songs.song_notation_views`** (closer registers in WBS; 0.5d, not
`cifra.md:`, milestone `m5`): *"Every view reads a song in its own notation."*
`SetlistPlay.jsx` (L66, L178, L192 — parse and transpose a setlist song in the
preference), `SongEditor.jsx` (L216, L359) with `editor/cifra-syntax.js` (L71),
and `SongWizard.jsx` (L122, L203) still pass the preference as `cifra-md`'s
dialect override; they take `songDialect(model)` as this task's views do (the
preference kept for what spells for the user). Tests: behavior
(`SetlistPlay.behavior.test.jsx`: an `american` song's `C7+` played at a
setlist key a tone up shows the sharp-fifth chord transposed; `SongEditor` /
`cifra-syntax` unit: an `american` song's ambiguity diagnostics report the
american reading under a brazilian preference; `SongWizard.behavior.test.jsx`:
an `american` song's `C7+` is offered the sharp-fifth shapes). Not in this task
because those views do not voice a chart through the resolver; this task fixes
the two that do.

## Decisions

1. **"The song's dialect" is §5.6's, not the user's preference.** The note says
   both *"the song's notation property"* and *"the one transpose is given"*;
   today transpose is given the preference, which overrides the property. §5.6
   and workflow 3 L81–85 settle it: the document's `notation`. So this task
   also changes what the views give transpose, making the note's two phrases
   the same thing.
   - Rejected: threading the preference into the resolver (the literal minimum).
     It would make the resolver agree with the view, but both would still read
     an American author's `C7+` as a major seventh for a Brazilian reader —
     exactly the fault the note describes.
   - Design delta: workflow 2 §Reading a song gains the bullet *"The song's
     notation reads its chords"* (`docs/workflows/02-find-and-play.md`), since
     the reading view had been built (`songs/reading.md`, *parse(text,
     dialect)*) on the opposite assumption and workflow 2 L39 (the search box,
     the user's notation) was easy to read as covering it.
2. **An explicit `dialect` option, not one derived inside the resolver.** It
   mirrors `transpose(model, n, { dialect })`; the caller that transposed is
   the one that knows which dialect the model's symbols are now formatted in.
   Deriving from `parsed.properties` inside the resolver would silently
   disagree with a model parsed under an override or transposed in another
   dialect. Default `DEFAULT_DIALECT` keeps every existing caller and test.
3. **`songDialect(model)` in the app, not exported from `cifra-md`.** The rule
   is three lines and already written twice inside `cifra-md` (`write.js`,
   `merge.js`), privately; exporting it would be a `cifra.md/js` API change
   (and a Go twin by the implementations' parity) for one app call site. It
   lives in the app's `dialects.js` beside `DEFAULT_DIALECT`, and its unit
   test cross-checks it against the reader.
4. **My-shape keys stay in the default dialect.** `shapes.json` keys are
   written by `formatChord(chord, DEFAULT_DIALECT)`; reading them in the song's
   dialect would turn a starred `C7(4)` (Brazilian suspension) into an added
   fourth inside an American song. The key is matched by chord (home-book
   format §4.4), and the chord is fixed by the dialect it was written in.
5. **unit and behavior; no e2e-web.** The note names unit. Behavior is added
   because the user-visible fault is the views' wiring (which dialect they hand
   the resolver and transpose), which only the view harnesses reach. An e2e
   journey would have to author an `american` song through the editor and
   compare diagram names, repeating `reading.spec.js`'s journey with another
   chart; the behavior cases pin the same promise in-process, and the resolver
   is pure.
6. **Two views now, the rest registered.** SongReading and SongArrange are the
   resolver's only callers (`voicings.js`'s consumers) and the note's scope;
   SetlistPlay, the editor and the wizard read songs too and get the same
   change in `songs.song_notation_views`, with their own tests, rather than
   widening a 0.5d task across five screens.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-16.

- `app/src/core/voicings.js`: `resolveSongVoicings` and `unvoiceableKeys` take a `dialect` option (default Brazilian) and read each chart symbol in it; *my shape* keys are still read in the default dialect, so a star matches by chord across dialects.
- `app/src/core/notation/dialects.js`: new pure `songDialect(model)`, resolving a song's dialect as cifra-md's reader does.
- `app/src/songs/SongReading.jsx`, `app/src/songs/SongArrange.jsx`: parse, transpose, voice and arrange in `songDialect(model)`; the user's preference only decides how chords are spelled for them (cifra.md §5.6).
- Departure from Decision text: `notation: Real Book` falls back to `brazilian` (the reader only trims ends and ignores case, `cifra.md/js/src/parse.js`, §1.4.3); `RealBook` gives `realbook`. `songDialect` follows the reader and the test pins both.
- Unit: `app/src/core/voicings.test.js` (the song's own notation describe), `app/src/core/notation/notation.test.js` (`songDialect`).
- Behavior: `app/src/songs/SongReading.behavior.test.jsx` (diagram names, axe, transposed case), `app/src/songs/SongArrange.behavior.test.jsx` (writes an american song's unchosen chords as the song reads them, axe). No e2e (Decision 5).
- Workflow 2 bullet in `docs/workflows/02-find-and-play.md`.
- Follow-up registered: `songs.song_notation_views` (0.5d, wired into `m5_complete`).
