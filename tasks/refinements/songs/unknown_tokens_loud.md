# songs.unknown_tokens_loud — Text that is not a chord is flagged loudly before a save

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task unknown_tokens_loud` under
`task songs` (`tasks/60-songs.tji:199-204`). Dependencies as declared:
`depends !save_gate_dropped_section`, plus the parent `task songs` cascade
(`shell.layout`, `shell.chart`, `foundation.e2e_web`). Wired into milestone
**`milestones.m3_service`** (`tasks/99-milestones.tji:32`). The note:

> "M2, decided 2026-10-19: saves are canonical (songs.save_gate_dropped_section),
> so bad syntax must be refused loudly, not discovered later. Typing [Am]Teste
> [G]linha inside a fence gives a section named Am with unknown tokens Teste and
> [G]linha and no diagnostic — conformant, since spec/2-chart.md §2.9 says a
> reader MUST NOT raise a diagnostic for an unknown token, but MUST keep it and
> SHOULD list the distinct ones. That is the reader; the app may refuse: mark
> every unknown token in the editor, and make the save sheet list them and
> require an explicit Save anyway — not an outright block, since §2.9 names
> annotations the format does not define (fine, rit., (solo)) as legitimate
> unknown tokens. Also flag a bracket heading whose name parses as a chord
> symbol ([Am] read as a section) as almost certainly a chord written in another
> format, pointing to the format help (songs.format_help). … Tests: unit (which
> inputs are flagged); behavior (the editor marks, the save sheet lists and
> asks, a bracket-chord heading flagged; axe); e2e-web (bracket chords typed
> into a new song are flagged and the save asks first, on the three viewports;
> axe)."

## Effort estimate

**1d**, allocated `team`. One small reader export in cifra.md for JavaScript,
one editor decoration layer and one notice, one field on the Worker's save
preview and its rendering on the sheet, a handful of keys in four locales, and
three levels of test.

## Repository

**Both** — mostly estante-de-cifras's `app/`, with one additive export in
`cifra.md/js/`:

- `cifra.md/js/src/parse.js`, `cifra.md/js/src/index.js` — a new export
  `unknownTokens(input, dialect?)` (Decision 1).
- `cifra.md/js/test/unknown-tokens.test.js` *(new)* — its unit test.
- `app/src/editor/unknown-words.js` *(new)* — the pure module: the marks'
  document ranges and the chord-like bracket headings.
- `app/src/editor/unknown-words.test.js` *(new)* — its unit test.
- `app/src/editor/source-extensions.js` — a mark-decoration `StateField`
  beside the line-class one (`:24-52`).
- `app/src/editor/SongEditor.jsx` — feeds the marks, renders the bracket
  notice beside the existing notices (`:488-541`).
- `app/src/editor/editor.css` — the mark's style.
- `app/src/worker/save-preview.js` — each previewed song gains `unknown`
  (`previewPath`, `:67-99`).
- `app/src/songs/SaveSheet.jsx` — the list and *Save anyway* (`SaveForm`,
  `:62`; `confirm`, `:167`).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the new keys.
- `e2e/web/lib/journeys.js` — `saveThroughSheet` learns *Save anyway*
  (`:349-358`); `e2e/web/tests/unknown-tokens.spec.js` *(new)*.
- `docs/workflows/04-edit-and-save.md` §Saving — the design delta (already
  written with this refinement; Decision 7).

**Not a `cifra.md:` task** and no format change: the spec, the Python
reference, the Go implementation and the corpus are untouched. The export is
JavaScript API surface that §2.9's SHOULD already invites (Decision 1).

## Inherited dependencies

- **`songs.save_gate_dropped_section`** — *settled, Done 2026-10-15*
  ([`save_gate_dropped_section.md`](save_gate_dropped_section.md)). It made
  saves refuse to lose what the writer drops, in the editor before the sheet
  (`app/src/editor/save-blockers.js`). This task is its soft sibling: what the
  writer *keeps* but the user probably did not mean is asked about, not
  stopped. `save-blockers.js` is not changed.
- **`songs.save_sheet`**, **`songs.save_feedback`** — *settled*
  ([`save_sheet.md`](save_sheet.md), [`save_feedback.md`](save_feedback.md)).
  The sheet renders the Worker's `savePreview` (`{path, title, changes,
  summary, isNew, …}`), *Saving…* and the per-field misses; "a button that is
  grey with no reason given is never how a save says no" (workflow 4 §Saving).
- **`songs.editor`** — *settled* ([`editor.md`](editor.md)). Decision 2
  (marks are synchronous decorations computed in the view per keystroke) and
  Decision 8 (reuse `cifra-md`'s reader, never a second grammar) govern.
- **`design.format_help`** — *settled, Done 2026-10-20*
  ([`../design/format_help.md`](../design/format_help.md)). It decided the
  notice this task's bracket flag is: workflow 3 §When it looks like another
  format (`docs/workflows/03-write-a-new-song.md:232-258`), board
  `docs/mockups/Format-help.dc.html` (phone frame 1, the bracket notice). It
  says the bracket case "is the same check as that task's bracket-heading flag
  — whichever build lands second reuses the first's".
- **`songs.format_help`** — *pending, not a dependency* (Decision 5). It builds
  the help popup, *Show me how*, the bracket-in-notes and chords-outside-the-
  music cases, and reuses this task's check and notice.
- **`songs.new_song`**, **`foundation.e2e_web`** — *complete*; they drive the
  e2e journey (a new song written in a local book through the real UI).

No pending blocking dependency. Every named test is driven by what exists:
`cifra-md`'s `parse` for the units; the editor rig (`makeStore` +
`emit(SOURCE)`, `SongEditor.behavior.test.jsx`), the sheet rig
(`SaveSheet.behavior.test.jsx`) and the Worker's save-preview rig
(`app/src/worker/save-preview.behavior.test.js`) for behavior; the new-song
journey on a local book for e2e-web (no account, no hosted book needed).

## What this task is

Inside the music, the reader reads every word it can as a chord; a word that is
not one is an *unknown token*, kept in place and written back unchanged, and
never a diagnostic (spec §2.9). So a writer who types chords the way another
format does — `[Am]Teste [G]linha` — gets a part named *Am* (a bracket
heading, spec §1.7.2) whose one line is two unknown tokens, a blank preview,
and no word of complaint; the save then commits it as canonical text.

This task makes that moment loud without making it a stop:

1. **The editor marks every unknown token** in the text as it is typed — a
   wavy underline on exactly the word, with a tooltip saying it is not read as
   a chord.
2. **The editor flags a bracket heading whose name reads as a chord** — the
   *Chords in brackets* notice workflow 3 pins: *Line 4 looks like chords in
   brackets. Here a chord goes on its own line, above its words.*
3. **The save sheet lists the unknown words the save brings in** and its
   button reads **Save anyway** while they are listed; pressing it saves as
   *Save* would.

## Why it needs to be done

Usability review 2026-10-19 (Claude in Chrome on the deployed app): a person
writing bracket chords got a blank preview and a successful save of text the
format reads as something else. Since saves are canonical
(`songs.save_gate_dropped_section`), what was typed is committed as it reads;
the only honest place to catch the mistake is before the save, loudly. Leaf of
M3 (`m3_service`); `songs.format_help` builds on its check and notice.

## Inputs / context

### The format

- `cifra.md/spec/2-chart.md` §2.9 (`:257-271`) — an unknown token is kept, is
  not a diagnostic (MUST NOT), survives the round trip; "a reader SHOULD make
  the distinct unknown symbols of a document available, in first-seen order,
  so an application can show them".
- `cifra.md/spec/1-document.md` §1.7.2 (`:226-246`) — a bracket heading: `[`,
  a non-empty name not all digits, `]`; what follows on the line is a line of
  its own; recognised only inside a fence. No chord check on the name.
- `cifra.md/corpus/10-unknown-tokens/` — the corpus witness of §2.9.

Checked against the reader (2026-10-20): `[Am]Teste [G]linha` in a bare fence
→ section `{name:"Am", heading:"bracket"}`, one chart line, items
`unknown "Teste"`, `unknown "[G]linha"`, no diagnostics. A fenced line of words
with no chord line above it (`Walk the road`) is a chart line of three unknown
tokens. `| G | rit. |` → `rit.` unknown in bar 2.

### The reader (cifra.md/js)

- `cifra.md/js/src/parse.js:160` — `classifyCore` makes `{type:"unknown",
  text}`; `:214` items carry `column` while scanning; `chartLine` deletes it
  (`:797-799`); lines carry `_line` (`:772`, `:781`, `:789`), deleted in the
  cleanup (`:709-720`). `demote` (`:991-1004`) turns an unclaimed ending into
  `unknown "N."`, keeping `column`.
- `parse.js:447-459` — the bracket-heading loop: `rest` (after `]`) becomes the
  line's text, so its items' columns are relative to `rest`, not the source
  line.
- `parse.js:1053-1061` — the result `{title, properties, sections, blocks,
  sung, sungAt, diagnostics}`; no unknown list.
- `cifra.md/js/src/index.js:28` — `parseChord`, `isChord` exported; the
  package exports only `.` (`cifra.md/js/package.json:8-10`).

### The app

- `app/src/editor/SongEditor.jsx:363` `parsed = useMemo(() => parse(text))`,
  `:368` `saveBlockers(...)`, `:414-426` `onSavePress`, `:234-252` the
  CodeMirror view; notices at `:488` (`notice accent`, `role="status"`), `:504`,
  `:536` (the stop, `role="alert"`).
- `app/src/editor/source-extensions.js:24-52` — the line-class `StateField`
  (`buildDecorations`); no mark decorations yet.
- `app/src/editor/cifra-syntax.js:94` `classifyLines`, `:68` `reportedLines`;
  imports `isChord`, `fenceOpen`, `closesFence` from `cifra-md` and
  `songDialect` (`app/src/core/notation/dialects.js:88`).
- `app/src/worker/save-preview.js:46-55` `headModel`, `:67-99` `previewPath`
  (parses the bytes to save, `:86`), `:99` `preview({bookId, paths})`; built in
  `app/src/worker/logic.js:443-452`.
- `app/src/songs/SaveSheet.jsx:62` `SaveForm`, `:167` `confirm`, `:176`
  `beforeSave`, `:423` `SaveSheet`. Hosts: `EditSongHost.jsx:156`,
  `NewSongHost.jsx:98`, `files/FileView.jsx:453`, `SearchScreen.jsx:836`,
  `shell/AppShell.jsx:1251` (Save all).
- i18n: `editor.source.*` (`en.js:1908`), `saveSheet.*` (`en.js:1077`);
  `app/src/i18n/i18n.test.js:46-65` holds every locale to English's keys and
  placeholders.
- e2e: `e2e/web/lib/journeys.js:349` `saveThroughSheet` clicks
  `{ name: 'Save', exact: true }` on the sheet; new-song paths
  `journeys-account.js:335` `writeSongFromScratch`, `:391` `writeChartSong`,
  `journeys-core.js:156` `createSongFromSearch`; `e2e/web/tests/new-song.spec.js`.

### The workflows

- `docs/workflows/03-write-a-new-song.md` §When it looks like another format
  (`:232-258`) — the *Chords in brackets* notice, its copy, the timing rule ("a
  line counts once the cursor has left it, or at once for pasted text"), the
  dismiss "for the rest of this editing of the song", never stops a save.
- `docs/workflows/04-edit-and-save.md` §Editing (`:25-31`) — "Words inside the
  music that the format does not read as chords are marked in the text as they
  are typed, and the save lists them and asks before saving (§Saving)".
- `docs/workflows/04-edit-and-save.md` §Saving — the paragraph this task adds
  (the list, *Save anyway*, only the words the save adds; Decision 7).

## Constraints / requirements

- **The reader decides; the app only locates.** What is an unknown token is
  `cifra-md`'s answer, never an app regex (editor Decision 8). The app gets
  positions from the reader (Decision 1) and does string arithmetic only.
- **No format change.** Unknown tokens stay non-diagnostics (§2.9 MUST NOT);
  `parse()`'s result shape is unchanged, so the corpus and every `parse`
  consumer are untouched. The Go and Python implementations are not asked to
  grow the export — it is not corpus-facing.
- **A question, never a stop.** No new save blocker; *Save anyway* is
  pressable and saves byte-identically to *Save* (the Worker canonicalises as
  ever). The bracket notice never stops a save and never rewrites the text
  (workflow 3).
- **Songs only.** Marks, the bracket notice and the sheet's list apply to a
  song — a `*.cifra.md` path or a new song with no path yet. A setlist,
  README.md or another file in the raw editor (`RawEditorHost.jsx`) gets none
  (Decision 6).
- **Accessibility.** Status is carried by words: the mark is an underline
  shape (not colour alone) with `title` text; the sheet names the words in
  text; the notice is the existing `notice accent` `role="status"` pattern with
  a RAC `Button` to dismiss (named "Dismiss the notice"). Keyboard path:
  Tab reaches the dismiss and *Save anyway* like any button. axe at WCAG 2.1 AA
  clean on the marked editor, the notice and the sheet.
- **i18n.** Every new string in `en`, `pt-BR`, `es-419`, `it`, translated;
  token texts are shown as written, never translated.
- **No song text in logs; purpose-written fixtures** (Portuguese lines in the
  manner of the note: "Teste", "linha", "Tarde Clara").
- **Offline first.** The marks and the flag are synchronous over the local
  buffer; the list rides the Worker's existing local preview. No network.
- **Existing journeys keep passing.** Some e2e fixtures may hold unknown
  tokens (a lyrics-only fenced line is one); `saveThroughSheet` must press
  *Save anyway* when the sheet shows it rather than fail on the exact `Save`
  name — and a journey that does not expect the list should still see `Save`
  (audit `e2e/web/tests` and the `journeys*.js` fixtures; fix fixtures that
  hold unknown tokens by accident rather than teaching every journey to
  ignore the list).

## Acceptance criteria

### Behavior delivered

1. **`unknownTokens(input, dialect?)`** is exported from `cifra-md`
   (`cifra.md/js/src/index.js`). It takes what `parse` takes and returns every
   unknown token of the document in source order as `{text, line, column}` —
   `line` 1-based, `column` the 0-based UTF-16 offset in the source line — such
   that `sourceLines[line-1].slice(column, column + text.length) === text`. It
   includes tokens after a bracket heading (columns offset by the heading),
   demoted endings, and tokens in chord lines over lyrics; it is computed by the
   same `Parser` run as `parse` (collected before the cleanup deletes `_line`
   and `column`), so its count equals the number of `type:"unknown"` items in
   `parse(input).sections`. *Pins spec §2.9 (the SHOULD), §1.7.2.*
2. **The editor marks every unknown token** of a song: a CodeMirror
   `Decoration.mark` with class `est-unknown` and `title` =
   `t('editor.source.unknownMark')` ("Not read as a chord") over exactly each
   token's range, recomputed on every change. `[Am]Teste [G]linha` in a fence
   marks `Teste` and `[G]linha`; `| G | C | fine |` marks `fine`; a clean chart
   marks nothing. *Pins workflow 4 §Editing.*
3. **A chord-like bracket heading is flagged.** A section with
   `heading:"bracket"` whose name (its first word, before any count) is a chord
   in the song's dialect (`isChord(name, songDialect(doc))`) raises the notice
   `t('editor.source.bracketChords', {line})` — en: *"Line {line} looks like
   chords in brackets. Here a chord goes on its own line, above its words."* —
   naming the first such heading's line, located as the first fenced source
   line whose bracket heading carries that name. `[Refrão]`, `[1]`, `## Am` and
   a `[Am]` line outside a fence are not flagged; `[A]` is (workflow 3: a part
   named *A* is legitimate, the notice only says it looks like a chord). The
   timing follows workflow 3: a typed line counts once the cursor has left it;
   pasted text counts at once. A RAC `Button` dismisses it for the rest of this
   editing of the song; it goes on its own when the text no longer holds the
   case. It does not stop a save. *Pins workflow 3 §When it looks like another
   format.*
4. **The save sheet lists the words and asks.** `previewPath` adds `unknown:
   string[]` to each song it previews: the distinct texts of
   `unknownTokens(after)` in first-seen order, minus those present in the HEAD
   version (all of them for a new song); `[]` for a non-song path. When any
   previewed song has a non-empty `unknown`, the sheet shows, above its buttons,
   `t('saveSheet.unknownWords', {words})` — en: *"Not read as chords, kept as
   written: {words}"* — one line per such song, prefixed with its title when
   the sheet saves several; and the confirm button reads
   `t('saveSheet.saveAnyway')` (*Save anyway*). Pressing it commits exactly as
   *Save* would. With no list the button reads *Save* as today. The list
   follows the text on the computer's side panel as the preview does. *Pins
   workflow 4 §Saving (delta).*

New keys (all four locales): `editor.source.unknownMark`,
`editor.source.bracketChords` (`{line}`), `editor.source.dismissNotice`,
`saveSheet.unknownWords` (`{words}`), `saveSheet.saveAnyway`.

### Tests the task lands with, by level

Per the note: **unit**, **behavior**, **e2e-web**.

- **unit — `cifra.md/js/test/unknown-tokens.test.js`** (*which inputs are
  flagged*, at the reader): `[Am]Teste [G]linha` in a fence →
  `[{text:"Teste",line:L,column:4},{text:"[G]linha",line:L,column:10}]`;
  `| G | rit. |` → `rit.` at its column; `G C fine` → `fine`; `(solo)` kept as
  one token; a demoted ending; a clean chart → `[]`; text outside a fence
  (notes) → `[]`; and over **every `cifra.md/corpus/*/input.cifra.md`**: every
  reported token equals its source slice, and the count equals the unknown
  items of `parse` (pins spec §2.9 and the export's contract against the
  corpus). Runs in `npm test` under `cifra.md/js/`.
- **unit — `app/src/editor/unknown-words.test.js`**: `unknownMarks(text)` →
  document ranges `{from, to}` for the inputs above (and none for a
  `*.setlist.md`-style call, which the editor never makes — the predicate is
  `isSongPath(path)`, tested: `x.cifra.md` and no path → song; `x.setlist.md`,
  `README.md` → not); `chordBracketHeadings(text)` → `[{line, name}]`: `[Am]`,
  `[G7]`, `[A]`, `[Am] x2` flagged; `[Refrão]`, `[1]`, `## Am`, `[Am]` outside
  a fence, `[Am]` in a `js` fence not flagged; the song's `notation` dialect
  decides (`[Do]` flagged under `notation: latin`, not under the default).
  *Pins workflow 3 §When it looks like another format; spec §1.7.2.*
- **behavior — `app/src/worker/save-preview.behavior.test.js`**, added case
  *"lists the unknown words a save adds"*: HEAD holds `fine`; the buffer adds
  `Teste` and `fine` again → `unknown: ['Teste']`; a new song → all, first-seen
  order, each once; a README path → `[]`. (The Worker's save-preview rig;
  pins workflow 4 §Saving delta, "the ones this save adds".)
- **behavior — `app/src/editor/SongEditor.behavior.test.jsx`**, added cases:
  *"marks every word it does not read as a chord"* — `emit(SOURCE)` with
  `[Am]Teste [G]linha` fenced: `.est-unknown` elements with texts `Teste` and
  `[G]linha` and the `title`; the bracket notice (`role="status"`) names the
  line; axe clean (`checkWcag21aa`); Save still calls `onSave`. *"dismisses
  the bracket notice and keeps it away while editing"* — dismiss → gone;
  another keystroke → still gone. *"a typed bracket line waits for the cursor
  to leave it"* — typing `[Am]` on a line: no notice until the selection moves
  to another line. *"a raw README marks nothing"* — `path="README.md"`, a fence
  of words: no `.est-unknown`, no notice. *Pins workflow 3, workflow 4
  §Editing.*
- **behavior — `app/src/songs/SaveSheet.behavior.test.jsx`**, added cases:
  *"lists the words not read as chords and asks Save anyway"* — a preview with
  `unknown: ['Teste','[G]linha']`: the text names both, the button is named
  *Save anyway*, pressing it calls the save with the note as usual; axe clean.
  *"several songs list one line each, by title"* (Save all). *"no list, plain
  Save"*. *Pins workflow 4 §Saving delta.*
- **e2e-web — `e2e/web/tests/unknown-tokens.spec.js`**, on phone, tablet and
  computer: in a local book, write a new song through the real UI
  (`writeSongFromScratch` / the editor), type into the editor a fence holding
  `[Am]Teste [G]linha` (keyboard, then move to the next line): the editor shows
  the *looks like chords in brackets* notice and the two marked words; axe on
  the editor. Press *Save*: the sheet lists `Teste, [G]linha` and the button
  reads *Save anyway*; axe on the sheet; press it → the sheet closes and the
  song is saved (it opens in the reading view). *Pins the note's e2e clause;
  workflow 3 §When it looks like another format; workflow 4 §Saving.*
  `saveThroughSheet` gains `{ saveAnyway: true }` for it, and the existing
  specs keep passing (Constraint "Existing journeys").

No test needs a `#dev/*` mount, injected state or network mocking.

### Deferred

(none — the help popup, *Show me how*, and the notice's two other cases are
already `songs.format_help`'s, a registered task; Decision 5.)

## Decisions

1. **Positions come from the reader, as one additive export
   `unknownTokens`.** The model carries no source positions (`parse.js:709-720`
   and `:799` delete them), so the editor cannot place a mark from `parse()`.
   *Rejected: re-scanning fenced lines in the app with `lineShape`/regexes* —
   a second grammar (editor Decision 8) that would miss the reader's own
   decisions (demoted endings, bracket-rest offsets, chord-over-lyric pairing).
   *Rejected: adding positions to `parse()`'s result* — changes the shape the
   corpus harness and every consumer compare. *Rejected: line-level marks only*
   — the note asks for every token marked, and a line of chords with one bad
   word would light whole. The export is JavaScript API the spec's §2.9 SHOULD
   invites; it is not corpus-facing, so it asks nothing of Go or Python and
   changes no format behavior.
2. **The bracket check uses the model's sections and `isChord`, locating the
   line by name.** The reader already decides what a bracket heading is
   (§1.7.2); the app asks only "is its name a chord in this song's dialect"
   and finds the line. *Rejected: a cifra.md spec diagnostic for a chord-like
   bracket name* — a format change for an app hint, and workflow 3 holds `[A]`
   legitimate. *Rejected: having `unknownTokens` also report headings* — keeps
   the export to what §2.9 names.
3. **The sheet asks with *Save anyway*, not a checkbox and not a second
   dialog.** The note says "require an explicit Save anyway"; renaming the one
   confirm button makes the answer the same tap as a save, keeps the two-tap
   save of workflow 4, and keeps the button pressable with its reason in words.
   *Rejected: an acknowledgement checkbox* — a third gesture, and a disabled
   *Save* until checked is the grey-without-reason button workflow 4 forbids.
   *Rejected: a stop in the editor like `save-blockers.js`* — the note says
   "not an outright block", and the list belongs on the sheet.
4. **Only the words this save adds are listed.** A song whose saved text
   already holds `fine` would otherwise ask at every save, and a question asked
   every time stops being read. The words were asked about when they were
   saved. *Rejected: every unknown word in the song* — trains the user to tap
   through. The editor still marks every token, saved or not.
5. **This task builds the bracket notice without *Show me how*; it does not
   wait for `songs.format_help`.** `design.format_help` anticipated either
   order ("whichever build lands second reuses the first's"). The notice ships
   with its pinned copy and a dismiss; `songs.format_help` adds the button that
   opens the help, and its other two cases, into the same notice. *Rejected:
   depending on `songs.format_help`* — would hold the loud save behind the
   popup for no gain in what the flag says.
6. **Songs only.** The raw editor also opens README.md and setlists; a fence
   in a README is code, and a setlist holds no chart, so marks there would be
   noise. The predicate mirrors the sheet's song/non-song split (a `*.cifra.md`
   path or a new song). *Rejected: every path the song writer writes* (the
   save gate's predicate) — that predicate answers "would saving drop it",
   this one "is this a song a person is writing".
7. **Design delta: workflow 4 §Saving.** §Editing already promised that "the
   save lists them and asks before saving", but §Saving did not say what the
   sheet shows or how it asks. The added paragraph
   (`docs/workflows/04-edit-and-save.md` §Saving, after "never how a save says
   no") pins the copy, *Save anyway*, "only the words this save adds", and one
   line per song on Save all. It rides in the closer's commit. No spec delta.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-20.

- cifra.md/js/src/parse.js, cifra.md/js/src/index.js: `cifra-md` gains `unknownTokens(input, dialect?)`, a JS-only export (no format change) collected by the same `Parser` run as `parse`; unit test in cifra.md/js/test/unknown-tokens.test.js, including a pass over every corpus input.
- app/src/editor/unknown-words.js (+ unknown-words.test.js), source-extensions.js, SongEditor.jsx, editor.css: the song editor underlines every word not read as a chord and shows the dismissible *Chords in brackets* notice (typed line counts after the cursor leaves it, pasted at once).
- app/src/worker/save-preview.js: `previewPath` adds `unknown` (the words a save adds, first-seen order).
- app/src/songs/SaveSheet.jsx, save-sheet.css: the sheet lists the words (one line per title for Save all) and the confirm reads *Save anyway*, saving exactly as Save does.
- app/src/i18n/locales/{en,pt-BR,es-419,it}.js: the five new keys; docs/workflows/04-edit-and-save.md §Saving written with the refinement.
- Tests: behavior in save-preview, SongEditor and SaveSheet behavior tests; e2e-web e2e/web/tests/unknown-tokens.spec.js on phone, tablet and computer. `saveThroughSheet` gains `{ saveAnyway }`; `createSongFromSearch` and new-song's Create case now step up into the empty fence before typing, since the template's closing fence is otherwise kept as an unknown token.
- Deviation: the reader has no `latin` notation, so the "`[Do]` flagged under latin" case became a check that the song's notation is the one asked (`notation: american`, `[C7+]`).
