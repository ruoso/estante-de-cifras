# songs.song_notation_views — Every view reads a song in its own notation

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) L152–157, `task songs.song_notation_views`
("Every view reads a song in its own notation"), under `task songs`.
`depends music.voicings_song_dialect, !editor, music.wizard, books.play`. Listed
in `milestones.m5` (`tasks/99-milestones.tji:44`).

`note`: *"SetlistPlay, SongEditor (with editor/cifra-syntax.js) and SongWizard
still pass the user's notation preference as cifra-md's dialect override; they
take songDialect(model) as SongReading and SongArrange now do (the preference
kept for what spells for the user). Source-of-debt:
tasks/refinements/music/voicings_song_dialect.md (Decision 6; cifra.md section
5.6). Tests: behavior (SetlistPlay: an american song's C7+ played at a setlist
key a tone up shows the sharp-fifth chord transposed; SongWizard: an american
song's C7+ is offered the sharp-fifth shapes); unit (cifra-syntax: an american
song's ambiguity diagnostics report the american reading under a brazilian
preference)."*

## Effort estimate

0.5d (`allocate team`), unchanged. Three views and one pure module stop
overriding the song's dialect; no new screen, control, Worker change or format
change.

## Repository

**estante-de-cifras** only — app work (the note does not start with
`cifra.md:`). Nothing lands under `cifra.md/`.

- `app/src/books/SetlistPlay.jsx` — parse and transpose in the song's dialect.
- `app/src/songs/SongWizard.jsx` — parse, plan and write in the song's dialect.
- `app/src/editor/SongEditor.jsx`, `app/src/editor/cifra-syntax.js` — parse,
  colour and preview in the song's dialect.
- Tests: `app/src/books/SetlistPlay.behavior.test.jsx`,
  `app/src/songs/SongWizard.behavior.test.jsx`,
  `app/src/editor/cifra-syntax.test.js`,
  `app/src/editor/SongEditor.behavior.test.jsx` (all extended).

Design delta: `docs/workflows/02-find-and-play.md` §Reading a song, the bullet
*"The song's notation reads its chords"* gains one sentence: the same holds
wherever the song is read — playing through a setlist (workflow 12), the wizard
(workflow 5), the editor's preview and colouring (workflow 4). Written with this
refinement; rides in the closer's commit.

## Inherited dependencies

- **`music.voicings_song_dialect`** — Done 2026-10-16
  ([`voicings_song_dialect.md`](../music/voicings_song_dialect.md)). Gives
  `songDialect(model)` (`app/src/core/notation/dialects.js` L88–93, resolving a
  song's dialect as cifra-md's reader does — `notation: Real Book` falls back
  to `brazilian`, per its Status), and the pattern this task copies:
  SongReading parses with `parse(text)`, takes `notation = songDialect(model)`
  for every read of the chart, and keeps the preference `dialect` only for what
  spells a chord for the user (`SongReading.jsx` L280, L306–311, L339, L484).
  Registered this task (its Decision 6). Settled.
- **`songs.editor`** (`!editor`), **`music.wizard`**, **`books.play`** — the
  three views this task changes. All `complete 100`. Settled.

Everything the tests need already exists: each view's behavior harness is a
stub-Worker loopback store (no hosted book, no second device, no sign-in), and
cifra-syntax is pure.

## What this task is

The same fault `music.voicings_song_dialect` fixed in the reading and arrange
views, in the three other places a song is read: each passes the user's
notation preference to cifra-md's `parse(text, dialect)`, whose second argument
**overrides** the song's `notation` property (`cifra.md/js/src/parse.js`
L401). So an `american` song's `C7+` (C7♯5) is read as `C7M` by a Brazilian
user — played transposed, planned for, spoken and coloured as the wrong chord.

1. **SetlistPlay** (`app/src/books/SetlistPlay.jsx`) — L178 `parse(songText,
   dialect)` becomes `parse(songText)`; `const notation =
   songDialect(baseModel)`; L192 `transpose(baseModel, offset, { dialect:
   notation })`. Since the chart shows `item.symbol` as written
   (`app/src/chart/layout.js` L23–30) and transpose re-formats every symbol in
   the dialect it is given (`app/src/core/transpose.js` L203), an american
   `C7+` up a tone now shows `D7#5` (today `D7M`). The dead third argument at
   L198 (`transposedKeyName(key, semitones)` takes two, `transpose.js` L221) is
   dropped, and with it the `dialect`/`preferences` reads if nothing else uses
   them.
2. **SongWizard** (`app/src/songs/SongWizard.jsx`) — L122 and L203 `parse(text)`;
   `const notation = songDialect(model)`; L136 `planVoicings(…, { dialect:
   notation, existing, choices })` (the planner re-parses each symbol with
   `analyseSong(song, dialect)`, `app/src/core/song-analysis.js` L175–179). The
   diagram `context.dialect` (L353) stays the preference — it spells the name
   the user hears (`render/diagram.js` L189).
3. **cifra-syntax** (`app/src/editor/cifra-syntax.js`) — `classifyLines(text)`
   drops its `dialect` parameter: `reportedLines` parses with `parse(text)` (no
   override, L71) and `looksLikeChords` tests tokens with `isChord(t,
   songDialect(doc))`, the one parse feeding both. The colouring now shows what
   the reader reports for the song as written — including a `bad-notation`
   diagnostic (line 1) for a `notation` value the reader does not know, which
   the override has been hiding.
4. **SongEditor** (`app/src/editor/SongEditor.jsx`) — L359 `parse(text)` (the
   preview `<Chart>` at L508 and the save gate read the song's own dialect, so
   the preview's spoken names are the song's chords); L216 `parse(…)` without
   override (the title check is dialect-free anyway); `buildDecorations` calls
   `classifyLines(doc.toString())`, and `dialectRef` goes. The new song's
   template keeps `templateDialect(preferences)` (`editor/template.js` L20,
   L41) — that is where the preference *writes* the property (workflow 3
   §The notation property), not a read.

## Why it needs to be done

- **The format says so.** cifra.md §5.6 Rules
  (`cifra.md/spec/5-chord-symbols.md` L266–284): the document's dialect is its
  `notation` property; *"the document says which notation it is in, and the
  reader follows it."*
- **Workflow 2 §Reading a song** (`docs/workflows/02-find-and-play.md`, *The
  song's notation reads its chords*): `C7+` in an American song is the
  sharp-fifth chord *for everyone* — its shape, default and transposition.
  Playing through a setlist is reading (workflow 12 §The key: the setlist key
  *"transposes it for reading (workflow 2)"*), so a band's setlist must not
  turn a sharp-fifth into a major seventh on stage.
- **The wizard writes what it plans** (workflow 5 §The wizard): planning the
  wrong chord writes the wrong shape into the song's voicings, which every
  other reader then sees.
- **Registered by the predecessor** (`voicings_song_dialect.md`, *Deferred to
  `songs.song_notation_views`*, Decision 6).

## Inputs / context

- `app/src/core/notation/dialects.js` L67 `DEFAULT_DIALECT`, L88–93
  `songDialect(model)`.
- `cifra.md/js/src/parse.js` L401–406 (the reader's dialect: override, else
  `notation`, else default; unknown → `bad-notation` on line 1), L1105
  `parse(bytes, dialect = null)`; the returned document carries no `dialect`
  field — hence `songDialect`. `isChord(text, dialect)`
  (`cifra.md/js/src/chord.js` L423) is true for `C7+`, `C7(4)`, `C9`, `B°` in
  every dialect; only the chord it reads differs.
- `app/src/books/SetlistPlay.jsx` L29, L66, L172–198, L247 (`<Chart>`).
- `app/src/songs/SongWizard.jsx` L35, L98, L122, L136, L148–157
  (`previewShapes`, `chord: line.chord` from the planner's re-parse), L203,
  L348–353.
- `app/src/core/voicing-plan/index.js` L291–300 (`planVoicings` → `analyseSong`).
- `app/src/editor/cifra-syntax.js` L56–63, L69–80, L89–91;
  `app/src/editor/SongEditor.jsx` L86–87, L116–119, L154, L197, L216,
  L241–243, L359–364, L508; `app/src/editor/template.js` L20–41.
- `app/src/chart/Chart.jsx` L59–66, L203–206 and `app/src/chart/layout.js`
  L23–30, L79–82: visible text is `item.symbol`; the accessible name is
  `speakChord(item.chord)` (`render/chord-speech.js` L73, the `notation`
  option ignored) — so the reader's dialect decides what is spoken. Measured
  (en): `C7+` brazilian *"C major seven"*, american *"C augmented seven sharp
  five"*.
- `app/src/core/notation/format.js` — measured spellings: the american `C7+`
  formats `C7#5` (american) / `C7(5+)` (brazilian); up a tone `D7#5`; the
  brazilian reading `C7M` / `D7M`.
- Pattern: `app/src/songs/SongReading.jsx` L306–311, and its test
  `app/src/songs/SongReading.behavior.test.jsx` L275–338 (song
  `props: ['notation: american', 'key: C']`, chart `C7+  C7(4)`, prefs
  `notation: register('brazilian')`).
- Test harnesses: `SetlistPlay.behavior.test.jsx` L27–61 (setlist and songs,
  item keys as `'   - key: A'`), L91 `makeStore()` (no PREFERENCES event today
  — one is added on `CommandKind.OPEN`), L135 `chartChords`;
  `SongWizard.behavior.test.jsx` L31 `register`, L48 `song({…})`, L98
  `makeStore({ text, entry, variations })` (prefs posted on `OPEN`, L101–108),
  L130 `renderWizard`, L138 `openWizard`, L163 `toPreview`;
  `cifra-syntax.test.js` L12 `SONG`, L41 `describe('classifyLines')`;
  `SongEditor.behavior.test.jsx` L31 `makeStore()` with `emit(event(
  EventKind.PREFERENCES, { notation: … }))` (L50, L85, L396), L394–411 the
  preview case.
- Governing documents: cifra.md §5.6; workflow 2 §Reading a song (the bullet
  this task widens) and §Transposing; workflow 12 §The key, §Playing through
  (`docs/workflows/12-setlists.md` L44–77); workflow 5 §The wizard
  (`docs/workflows/05-arrange-for-an-instrument.md` L63–73); workflow 4
  §Editing (`docs/workflows/04-edit-and-save.md` L9–22); workflow 3 §The
  notation property; workflow 16 §Viewing by notation (the preference spells).

## Constraints / requirements

- **One dialect per chart, end to end**, per view: parse, transpose, plan,
  classify — all `songDialect(model)` (or the reader's own resolution, which
  is the same thing).
- **The preference still spells**: the wizard's diagram names, the chip's key
  name, anything displaying a chord to the user (workflow 16 §Viewing by
  notation). The new-song template still writes `notation:` from the
  preference.
- **No song text written by reading.** No view rewrites `notation` or a
  symbol; the wizard's writes keep copying symbols as written (cifra.md §8).
- **Pure core**: `cifra-syntax.js` stays React-free.
- **Accessibility**: no new UI; the touched views stay axe clean; status
  words unchanged.
- **Fixtures**: chord-only charts written for the purpose (`C7+  C7(4)`), no
  lyrics.

## Acceptance criteria

Behavior delivered:

1. Playing an `american` song through a setlist, under a Brazilian
   preference, reads `C7+` as C7♯5: at a setlist key a tone up it shows
   `D7#5`, spoken as the sharp-fifth chord.
2. The wizard plans an `american` song's `C7+` as C7♯5 and `C7(4)` as C7add4,
   and its preview names those chords (spelled in the user's notation).
3. The editor's preview speaks an `american` song's `C7+` as the sharp-fifth
   chord under a Brazilian preference; its colouring reports what the reader
   reports for the song's own `notation`, including an unknown one.
4. A song with no `notation` reads as before in every view.

Tests, by level:

- **unit** — `app/src/editor/cifra-syntax.test.js`, new
  `describe("classifyLines — the song's own notation (cifra.md §5.6)")`:
  - *colours an american song's ambiguous chords as chords*: a song with
    `- notation: american` and a fence holding `C7+ C7(4) C9` classifies that
    line `ch`, and `classifyLines` takes no dialect argument (`classifyLines.length
    === 1`), so no preference can override the song;
  - *reports a notation the reader does not know*: `- notation: klingon`
    classifies line 1 `err` (the reader's `bad-notation`, parse.js L403), and
    the same song with `- notation: american` does not — the report follows
    the song, not a preference;
  - the existing cases keep passing unchanged (pins §5.6 Rules; workflow 4
    §Editing, the editor's "lines the reader reported").
- **behavior** — `app/src/editor/SongEditor.behavior.test.jsx`, new case
  *the preview reads an american song's C7+ as the sharp fifth under a
  brazilian preference*: preference `notation: brazilian` emitted, buffer an
  `american` song with chart `C7+`; on wide, the preview `.chart` holds a chord
  whose accessible name is *"C augmented seven sharp five"* (built from
  `speakChord(parseChord('C7+', 'american').chord)`, not hard-coded) and not
  the major-seventh name; axe clean (pins workflow 2 bullet as widened;
  cifra.md §5.6). This is the "american reading reported" of the note's
  editor clause: cifra-md reports a reading per chord item, not as a
  diagnostic, and the preview is where the editor shows it (Decision 3).
- **behavior** — `app/src/books/SetlistPlay.behavior.test.jsx`, new
  `describe("SetlistPlay — the song's own notation (workflow 2 §Reading a song)")`:
  `makeStore` gains a PREFERENCES event (`notation: brazilian`) on
  `CommandKind.OPEN`, and a setlist item pointing at a song with
  `notation: american`, `key: C`, chart `C7+`, under `- key: D`:
  - *plays an american song's C7+ at a setlist key a tone up as the
    sharp-fifth chord*: `chartChords` gives `D7#5` (the value of
    `formatChord(parseChord('D7#5','american').chord,'american')`), not `D7M`;
    its accessible name is the sharp-fifth chord's spoken name; the chip names
    D; axe clean (pins workflow 12 §The key, workflow 2 §Transposing,
    `transpose.js` L203);
  - the existing cases keep passing with the preference now set (a song with
    no `notation` reads as before).
- **behavior** — `app/src/songs/SongWizard.behavior.test.jsx`, new case
  *offers an american song's C7+ the sharp-fifth shapes*: `makeStore` given
  `notation: register('brazilian')` alongside `instrumentInUse`; song
  `props: ['notation: american']`, chart `C7+  C7(4)`; through `openWizard` and
  `toPreview` with the default policy, the preview diagrams' accessible names
  begin with `C7(5+)` and `C7(add4)` (`formatChord` of the american readings
  in the brazilian preference — the user's spelling of the song's chords),
  and none begins `C7M` or `C7(4)`; writing the plan persists voicings keyed
  `C7+` and `C7(4)` as written; axe clean (pins workflow 5 §The wizard,
  `analyseSong` with the song's dialect).

No e2e-web: Decision 4.

## Decisions

1. **Use the reader's own resolution: `parse(text)` plus `songDialect(model)`,
   as SongReading does.** Rejected: keep the override and pass
   `songDialect(…)` as it (parse twice to learn the property first) — the
   same answer for more work, and it would still suppress the reader's
   `bad-notation`. Continuity with the predecessor's Decisions 1–3.
2. **`classifyLines(text)` loses its dialect parameter.** The classifier
   colours what the reader reports; a caller-supplied dialect is exactly the
   override this task removes. It takes the token dialect from the same parse
   (`songDialect(doc)`). Rejected: an optional parameter defaulting to the
   song's — one call site, and the option is the bug's shape. Consequence
   accepted: while the user types `- notation: am…`, line 1 is marked until
   the value names a dialect — the same transient report every half-typed line
   gets, and the reader's truth (workflow 4 §Editing).
3. **The note's "ambiguity diagnostics" are pinned where they exist.** cifra-md
   reports the reading taken as `ambiguities` on each chord item
   (`parse.js` L162), not in `diagnostics`; the editor shows it through the
   preview's spoken chord names. So the unit level pins the classifier's
   dialect (and the one dialect diagnostic, `bad-notation`), and a behavior
   case on the preview pins the american reading under a brazilian preference.
   The behavior level is added; the note's unit level is kept.
4. **behavior and unit; no e2e-web** — as the predecessor's Decision 5. The
   fault is each view's wiring of one argument, reachable in-process by the
   existing harnesses; an e2e journey would author an american song through
   the editor, build a setlist and play it, repeating `play`'s and
   `reading`'s journeys to compare one chord's spelling.
5. **Widen workflow 2's bullet rather than add one to each workflow.** The rule
   is one rule (§5.6); naming the three other places in the bullet that states
   it keeps it in one place, and workflows 4, 5 and 12 already defer to
   workflow 2 for reading.
6. **Drop the ignored third argument to `transposedKeyName`** at
   `SetlistPlay.jsx` L198 while touching the line: it suggests the key is
   spelled in a dialect, which it is not.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-16.

- SetlistPlay (`app/src/books/SetlistPlay.jsx`) parses with `parse(text)` and transposes in `songDialect(baseModel)`; an american `C7+` a tone up shows `D7#5`. The dead third argument to `transposedKeyName` is dropped (Decision 6).
- SongWizard (`app/src/songs/SongWizard.jsx`) parses, plans and writes in the song's dialect; the diagram context keeps the user's preference for spelling.
- SongEditor (`app/src/editor/SongEditor.jsx`) previews and gates saves in the song's own dialect; `app/src/editor/cifra-syntax.js` `classifyLines(text)` loses its dialect parameter and colours what the reader reports, including `bad-notation`.
- `app/src/core/transpose.js` now keeps each transposed item's parsed chord in step with its symbol, so the spoken name matches the chart (outside the file list, needed for acceptance 1).
- Design delta: `docs/workflows/02-find-and-play.md` bullet widened to setlist play, the wizard and the editor.
- Tests: unit `app/src/editor/cifra-syntax.test.js`, `app/src/core/transpose.test.js`; behavior `app/src/books/SetlistPlay.behavior.test.jsx`, `app/src/songs/SongWizard.behavior.test.jsx`, `app/src/editor/SongEditor.behavior.test.jsx`. No e2e (Decision 4).

