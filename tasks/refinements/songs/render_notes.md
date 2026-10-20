# songs.render_notes — Notes and verbatim blocks shown in the preview and the reading view

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task render_notes` under
`task songs` (`tasks/60-songs.tji:194-198`). No `depends` of its own; the
parent `task songs` cascade (`shell.layout`, `shell.chart`,
`foundation.e2e_web`) applies. Wired into milestone **`milestones.m3_service`**
(`tasks/99-milestones.tji:32`). Two later tasks wait on it:
`songs.format_help` (`:209`) and `songs.empty_states` (`:221`). The note:

> "M1, in part: text outside a fence is a notes part
> (cifra.md/spec/1-document.md:244-246), which the spec says is free text for
> whoever reads the sheet (:339), and a verbatim fence is shown in a monospaced
> face (:353-355); but the editor preview renders only Chart
> (editor/SongEditor.jsx:560) and chart/layout.js:197,209 skips every
> non-music part, so a song written as bracket chords on plain lines previews
> blank and reads blank. Render notes and verbatim parts in the preview and the
> reading view, in document order. … Tests: behavior (notes and verbatim drawn
> in order, read by a screen reader; axe); e2e-web (a song with notes and a
> verbatim block read on the three viewports; axe)."

(The note's `SongEditor.jsx:560` is stale; the preview's `<Chart>` is at
`app/src/editor/SongEditor.jsx:595-610` today.)

## Effort estimate

**1d**, allocated `team`. Two new row types in one pure layout function, two
new cases in one component's row switch, a few CSS rules and one i18n key in
four locales, one guard in the conflict text, and three levels of test.

## Repository

**estante-de-cifras only, `app/` and `e2e/web/`** — not a `cifra.md:` task;
the reader already produces the parts (below) and no format change is made.

- `app/src/chart/layout.js` — `chartRows` yields `notes` and `verbatim` rows
  in document order (`:190-216`); its doc comment rewritten.
- `app/src/chart/layout.test.js` — unit cases.
- `app/src/chart/Chart.jsx` — `Row` draws the two new rows (`:114-162`).
- `app/src/chart/reading.js` — `readingTokens` reads the two rows as their
  text (`:57-95`), so the module stays the one statement of the reading order.
- `app/src/chart/reading.test.js` — unit cases.
- `app/src/theme/theme.css` — `.chart .notes`, `.chart .verbatim` beside the
  chart rules (`:381-401`); the `--font-code` comment (`:181`, and the theme
  blocks at `:214`, `:244`, `:273`) no longer says "the raw source editor
  only".
- `app/src/songs/conflict-text.js` — `chartPlace` matches over music rows only
  (`:74`, Decision 5).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — `chart.verbatim` (the
  verbatim block's accessible name).
- `app/src/chart/Chart.behavior.test.jsx`, `app/src/editor/SongEditor.behavior.test.jsx`,
  `app/src/songs/SongReading.behavior.test.jsx` — behavior cases.
- `e2e/web/tests/notes.spec.js` *(new)* — the e2e-web journey.
- `docs/DIRECTION.md` §3.7 — the design delta (already written with this
  refinement, Decision 1); `docs/mockups/README.md:24` ("Only the raw source
  editor is monospaced") gains "and a verbatim block in a song" to match it,
  edited by the implementer in the same commit.

## Inherited dependencies

- **`shell.chart`** — *settled* ([`../shell/chart.md`](../shell/chart.md)).
  It built `chartRows` + `Chart` and scoped the chart to the **music** only,
  leaving prose `notes`/`verbatim` parts "the song-reading view's composition
  … drawn around the chart, not by it" (`chart.md:302-307`). This task
  revisits that scoping (Decision 1): drawn *around* the chart, notes could
  never sit in their place between two fences of one section.
- **`shell.a11y_chart`** — *settled*. `reading.js` + `Chart.jsx` speak each
  row (`docs/screen-reader.md` §1.2, §2, §5); the new rows follow its pattern.
- **`songs.reading`** — *settled* ([`reading.md`](reading.md)). D1: the view
  parses `OPEN_SOURCE` text and composes `transpose` and `<Chart>` itself
  (`app/src/songs/SongReading.jsx:331-333`, `:493`). Nothing changes there.
- **`songs.editor`** — *settled* ([`editor.md`](editor.md)). AC5: "The
  preview is the reading `Chart` fed the model the editor parses from its
  buffer" (`SongEditor.jsx:388`, `:595-610`); D2 synchronous parse in the
  view. So a chart that draws notes draws them in the preview with no editor
  change.
- **`songs.unknown_tokens_loud`** — *settled, complete*
  ([`unknown_tokens_loud.md`](unknown_tokens_loud.md)). Notes are not scanned
  for unknown tokens; this task's fixtures put the music inside fences so the
  editor flags nothing and the save asks nothing.
- **`songs.new_song`**, **`foundation.e2e_web`** — *complete*; they drive the
  e2e journey (*Write a song* on the home screen, the editor, the save sheet,
  search, the reading view; no account, no network — the path
  `e2e/web/tests/unknown-tokens.spec.js:17-50` already walks).

No pending dependency. Every named test is driven by what exists: hand-built
models and `parse` for the units; the Chart rig
(`Chart.behavior.test.jsx`), the editor rig (`makeStore` + `emit(SOURCE)`,
`SongEditor.behavior.test.jsx:33`) and the reading rig (`song(…)` +
`makeStore`, `SongReading.behavior.test.jsx:65-126`) for behavior; *Write a
song*, `saveThroughSheet` and `openSongFromSearch` (`e2e/web/lib/journeys.js:352`,
`:280`) for e2e-web.

## What this task is

A cifra.md song's sections hold three kinds of part, in document order
(`cifra.md/js/src/parse.js:684-704`, `schema/cifra.schema.json:51-69`):

- `{ type: "music", lines }` — what the chart draws today;
- `{ type: "notes", text }` — the text outside the fences: "free text for
  whoever reads the sheet", kept "in their position relative to the section's
  fences", never interpreted (spec §1.9, `cifra.md/spec/1-document.md:338-344`);
  blank lines at either end already trimmed by the reader, inner blank lines
  kept;
- `{ type: "verbatim", info, text }` — a fence whose info string is neither
  empty nor `cifra` (`tab`, `strum`, …): "kept as it is, line for line, blank
  lines included, shown in a monospaced face, and not read as music"
  (`:351-355`).

`chartRows` drops the last two (`app/src/chart/layout.js:209`), so every
view of a song — the reading view, the editor's preview, the setlist's play
view, the song's history, the wizard — leaves them out. A song written as
bracket chords on plain lines (all notes, no fence) previews and reads as a
title and nothing else; a tablature block written properly in a `tab` fence
is never seen.

This task makes the chart draw the whole body:

1. **Notes** are drawn in their place among the section's music, in the
   chart's proportional face and ink, *as written*: each run of lines
   separated by a blank line is a paragraph, line breaks and leading spaces
   kept, no Markdown read (`**`, `_`, `[x](y)` show as typed).
2. **A verbatim block** is drawn in its place in the monospaced face
   (`--font-code`), every line kept, blank ones included, no wrapping; a block
   wider than the screen scrolls sideways inside itself.
3. **A screen reader** reads a notes paragraph as its text and a verbatim
   block as a named group ("Tab block", from its info string) holding its
   text, in the same order the eye meets them.

## Why it needs to be done

Usability review 2026-10-19, finding M1: a person who wrote a song the way
other sites do — chords in brackets on plain lines — got a blank preview and
a blank reading view, with nothing saying where their text went. The format
promises that what is outside the music is *kept* and shown to whoever reads
the sheet (spec §1.9; workflow 3 topic 7, `docs/workflows/03-write-a-new-song.md:187-198`:
"*Lines outside the backticks are notes: shown as written, never read as
chords*"); the app kept them and showed nothing. `songs.format_help` needs
it: its examples "read in the preview exactly as the topic says"
(`03-write-a-new-song.md:213-219`), and its *Notes* topic and its
"kept as a note" notice point at text the preview must show.
`songs.empty_states` needs it to tell an empty section from one holding only
notes.

## Inputs / context

### The format

- `cifra.md/spec/1-document.md` §1.9 (`:311-383`) — notes (`:338-344`),
  verbatim (`:351-359`), leading spaces significant in notes and verbatim
  (`:64-66`), a bracket line outside a fence is notes (`:244-246`), music and
  notes before the first heading belong to the empty-name section
  (`:300-302`).
- `cifra.md/spec/0-overview.md:206,211` — notes map to Markdown paragraph
  text, "kept and not interpreted".
- `cifra.md/spec/9-conformance.md:22` — a reader keeps notes; nothing on how
  an application shows them.
- Corpus witnesses: `cifra.md/corpus/09-notes/` (notes before the first
  heading, before and after fences, `[not a heading out here]`),
  `cifra.md/corpus/20-cifra-conventions/` (a `tab` verbatim part,
  `parsed.json:28-30`), `cifra.md/corpus/32-unclosed-verbatim/`.

### The app

- `app/src/chart/layout.js:190-216` — `chartRows`; the skip at `:209`, the
  doc comment at `:196-198` that hands notes to the reading view.
- `app/src/chart/Chart.jsx:114-162` (`Row`), `:168-186` (`renderUnits`, the
  `conf`/`def` regions), `:203-232` (`Chart`, host `role="group"` named by
  `label`).
- `app/src/chart/reading.js:57-95` — `readingTokens` (the default case
  returns `[]`).
- `app/src/theme/theme.css:178-181` (`--font-chart`, `--font-code`),
  `:381-401` (the chart's rules), `:288` (`.t-mono`).
- `app/src/editor/SongEditor.jsx:388` (`parse(text)`), `:595-610` (the
  preview region and its `<Chart>`).
- `app/src/songs/SongReading.jsx:331-333`, `:493` — parse, transpose, Chart.
- `app/src/core/transpose.js:125-135` — transposes music parts only; the
  other parts pass through.
- Every other `<Chart>`: `books/SetlistPlay.jsx:246`,
  `songs/SongWizard.jsx:551`, `songs/SongArrange.jsx:526-533`,
  `songs/SongHistory.jsx:220`, `songs/SongConflict.jsx:156,455`.
- Every other `chartRows` caller: `songs/conflict-text.js:74` (`chartPlace`,
  matches a run of disputed lines against consecutive rows),
  `songs/SongConflict.jsx:130` (`markedAddresses`, by `row.address.line`).
- `app/src/worker/search-index.js:115` — notes and verbatim are deliberately
  not indexed; unchanged.

### The design

- `docs/DIRECTION.md` §3.7, *Charts are drawn by the app* — now carries the
  delta (Decision 1).
- `docs/mockups/README.md:24` — charts in a proportional face; "Only the raw
  source editor is monospaced". No board draws notes or a verbatim block in a
  rendered song (checked 2026-10-20); the chart's tokens govern.
- `docs/screen-reader.md` §1.2 (announced text), §2 (sung line), §5 (chart
  line) — notes and verbatim are not covered; Decision 4 decides their
  reading.
- `docs/workflows/03-write-a-new-song.md:93-96` (a paste outside a fence
  "would be read as notes — kept, but not as music"), `:187-198` (topic 7),
  `:235-248` (the "kept as a note" notice); `docs/workflows/14-file-view.md:45`
  ("a song's notes are free text").

## Constraints / requirements

- **The chart stays a pure drawing of the reader's model** (`chart.md`):
  no parse, no second grammar, nothing written. Notes and verbatim text come
  from the part's `text` exactly; the app adds nothing and drops nothing but
  the paragraph split.
- **Never interpret notes** (spec §1.9 MUST NOT): no Markdown, no links, no
  chord colouring; rendered as React text children (never
  `dangerouslySetInnerHTML`), so `<b>` in a note shows as `<b>`.
- **Document order.** Rows follow `section.body` order; a section's name row
  comes first, then its parts as the reader lists them. The empty-name section
  (notes before the first heading) draws its notes with no name row.
- **Transposition, dialect and arrangement touch music only.** A transposed
  reading view or setlist key shows the notes and verbatim text unchanged
  (`core/transpose.js:128` already skips them).
- **Accessibility.** WCAG 2.1 AA under axe on every changed render; the
  verbatim block, when it scrolls, is reachable by keyboard
  (`scrollable-region-focusable`); nothing carried by colour alone (notes
  use `--ink`, as words do). React Aria is not needed — nothing new is
  interactive beyond a focusable scroll box.
- **Fits a phone.** A long notes line wraps inside the chart's width
  (`white-space: pre-wrap`, as `.chart .s .w` does); a verbatim block never
  wraps (a tab's columns are its meaning) and scrolls inside itself, never
  widening the page (`e2e/web/tests/narrow-fit.spec.js` stays green).
- **The conflict view does not change.** Its matching and marks behave as
  before (Decision 5).
- **No song text in logs; purpose-written fixtures** — every song in the
  tests is written for them.
- **Canonical form untouched.** Nothing about saving changes; a note with
  inner blank-line runs is saved as one blank line by the writer as today.

## Acceptance criteria

### Behavior delivered

1. `chartRows(model)` yields, for each part in body order: the music lines'
   rows as today; for a `notes` part one row
   `{ type: 'notes', paragraphs: string[], address: { section, part } }`
   (`text` split on runs of blank lines — a line that is empty or only
   whitespace — each paragraph's lines kept with their `\n` and leading
   spaces); for a `verbatim` part one row
   `{ type: 'verbatim', info, text, address: { section, part } }` (`text`
   whole, blank lines kept). An empty verbatim fence still yields its row (an
   empty fence is a part of its section, spec §1.9 `:360`); a notes part with
   empty `text` yields none (the reader never emits one; guard anyway).
2. `Chart` draws a notes row as `<div class="notes">` holding one `<p>` per
   paragraph, in `--font-chart`, `--ink`, `white-space: pre-wrap`; a verbatim
   row as `<pre class="verbatim" role="group" aria-label={t('chart.verbatim', { info })} tabIndex={0}>`
   holding the text, in `--font-code`, `white-space: pre`, `overflow-x: auto`,
   a `--surface-2` ground and `--radius-s` corners so it reads as a block.
   The new key: en `'{{info}} block'`, `info` being the reader's lower-cased
   info string with its first letter capitalised (`Tab block`, `Strum block`); pt-BR `'Bloco {{info}}'`,
   es-419 `'Bloque {{info}}'`, it `'Blocco {{info}}'`.
3. `readingTokens` returns a notes row's paragraphs (each trimmed of trailing
   spaces) and a verbatim row's `[label, text]` — the chart's reading order as
   one function, as `shell.a11y_chart` keeps it.
4. In the editor preview and the reading view a song written as plain lines
   with bracket chords and no fence reads as those lines, as written; a song
   with notes between two fences of one section shows *music, note, music* in
   that order; a `tab` block shows in monospace. The same holds in setlist
   play, history and the wizard with no change to them (one `Chart`).
5. `conflict-text.js` `chartPlace` matches only over `sung`/`bars`/`run`/
   `words`/`gap`/`section` rows, so a conflict's place is found exactly as
   before.

### Tests, by level

**unit**

- `app/src/chart/layout.test.js`, new `describe('chartRows — notes and verbatim')`:
  - a section `[music, notes, music]` yields its rows in that order, the
    notes row between the two music parts' rows, address `{section, part: 1}`
    (spec §1.9 `:340-341`, position relative to the fences);
  - notes text `'Softer the second time.\n\nThen   louder.\n  indented'` yields
    paragraphs `['Softer the second time.', 'Then   louder.\n  indented']` —
    inner spaces and leading spaces kept (spec §1.3 `:64-66`);
  - notes text with `**bold**` and `[x](y)` passes through unchanged (spec
    §1.9 MUST NOT interpret);
  - a verbatim part `{info:'tab', text:'e|--3--|\n\nB|--0--|'}` yields one row
    with the text whole, blank line kept (spec §1.9 `:353-355`);
  - an empty-name section holding only notes yields the notes row and no
    section row (spec §1.8 `:300-302`);
  - parsed: `parse` of a purpose-written song with notes before the first
    heading, a `## Verse` with a note between two fences and a ```` ```tab ````
    block yields rows in document order (the reader's model, not a hand
    shape).
- `app/src/chart/reading.test.js`: `readingTokens` of a notes row is its
  paragraphs; of a verbatim row, `['Tab block', text]`; `announce` joins them
  with `", "` (`docs/screen-reader.md` §1.2).
- `app/src/songs/conflict-text.test.js` (existing file): one added case — a
  disputed chart line in a section whose fences are split by a note is placed
  as it was before this task (Decision 5); the existing cases stay green.

**behavior** (Testing Library + axe via `checkWcag21aa`)

- `app/src/chart/Chart.behavior.test.jsx`, new
  `describe('notes and verbatim')`: a purpose-written song (`## Verse`, a
  fence, a note *Softer the second time.*, a fence, a ```` ```tab ```` block)
  renders the sung line, the note paragraph and the second fence's bars in
  DOM order (`compareDocumentPosition`); the note's text is reachable by
  `getByText`; the tab block is `getByRole('group', { name: 'Tab block' })`,
  a `<pre>`, focusable, holding the tab text exactly; `**x**` in a note is
  shown literally and no `<strong>` exists; axe clean (spec §1.9; workflow 3
  topic 7; DIRECTION §3.7).
- `app/src/editor/SongEditor.behavior.test.jsx`: the store emits `SOURCE` of
  a song written as bracket chords on plain lines (`[G]Walk the [C]road`, no
  fence); the preview region (`getByRole('region', { name: 'Preview' })`)
  contains that line as written — the M1 case, a blank preview no more; on
  `narrow`, behind the Preview tab, the same; axe clean (workflow 3
  `:93-96`; editor.md AC5).
- `app/src/songs/SongReading.behavior.test.jsx`: a song whose chart part is
  `note line, fence, tab block` reads in that order inside the chart group
  named by the title; transposed up a tone, the chords move and the note and
  the tab text are unchanged; axe clean (reading.md D1; spec §1.9).

**e2e-web**

- `e2e/web/tests/notes.spec.js` *(new)*, `test('a song with notes and a tab
  block previews and reads them in order')`, on the phone, tablet and
  computer projects: *Write a song* from the home screen, `insertText` a
  purpose-written song (title *Beira do Rio*; `## Verso`; a fence with a
  chord line over words; the note *Mais devagar na segunda vez.*; a second
  fence; a ```` ```tab ```` block of two strings), the preview shows the
  note and the tab block (on a phone after choosing the Preview tab), axe on
  the editor with its preview; `saveThroughSheet`; `openSongFromSearch` by
  the title; in the reading view the chart group shows the sung line, then
  the note, then the second music, then `getByRole('group', { name: 'Tab block' })`
  in that order, the block's computed `font-family` contains the theme's
  monospace and the note's does not; on the phone the page does not scroll
  sideways (`document.documentElement.scrollWidth <= innerWidth`); axe on the
  reading view (spec §1.9; DIRECTION §3.7; workflow 3 topic 7). A local
  book: no account, no network.

No e2e-api level: nothing on the service changes.

## Decisions

1. **The chart draws notes and verbatim parts, as rows in its own stream —
   not the reading view around it.** `shell.chart` scoped them to the reading
   view (`chart.md:302-307`), but a section's notes sit *between* its fences
   (spec §1.9 `:340-341`), and a composition around one `<Chart>` cannot put
   text between two of its rows; splitting the chart per part in the reading
   view would break the `conf`/`def` regions and the one named group a
   screen reader enters. And seven views draw a song through `<Chart>`; one
   change there reaches the preview, the reading view, setlist play, history
   and the wizard alike, where a reading-view composition would reach one and
   leave the preview — the M1 case — blank. Recorded as a delta in
   `docs/DIRECTION.md` §3.7 (*Charts are drawn by the app*); `layout.js`'s
   doc comment is rewritten to match.
2. **Notes are shown as written, never as Markdown.** The spec says MUST NOT
   interpret (`:341-342`) and workflow 3 says "shown as written". A
   Markdown renderer would also be a new runtime dependency for a gain the
   format does not promise. Paragraphs split on blank lines (Markdown's
   paragraph and the canonical writer's one-blank-line runs agree on that),
   line breaks and leading spaces kept by `pre-wrap`, so a list someone typed
   with `-` reads as they typed it.
3. **Verbatim in `--font-code`, unwrapped, scrolling inside itself.** The
   spec says monospaced (`:354`); a tab's columns are its meaning, so
   wrapping is wrong, and the page must not widen on a phone. A scrolling box
   must be keyboard-reachable for axe (`scrollable-region-focusable`), so it
   takes `tabIndex={0}` and, to be announced as something, `role="group"`
   with a name from its info string. `--font-code` is reused rather than a new
   token: it is the theme's one monospace and each theme already chooses it.
   This is the one exception to "only the raw source editor is monospaced"
   (`docs/mockups/README.md:24`), recorded in DIRECTION and that line.
4. **The reading of the new rows lives in `reading.js`.** `shell.a11y_chart`
   made `reading.js` the single statement of the chart's spoken order; a
   notes row reads as its paragraphs, a verbatim row as its label then its
   text. The DOM carries this naturally (`<p>` text; a named group around a
   `<pre>`); the unit pins it. `docs/screen-reader.md` is not extended: the
   reading is plain text with nothing spoken that is not on the screen.
5. **The conflict view keeps its music-only matching.** `chartPlace` finds a
   disputed run as consecutive rows; notes rows between two fences would now
   break a run that used to match across them. Filtering to the existing row
   types keeps the conflict view exactly as `songs.conflicts` built it;
   showing notes in conflicts is not this task's. `markedAddresses` needs no
   change (`rowText` returns `null` for the new rows).
6. **Everywhere, not opt-in.** A `showNotes` prop on `Chart` was considered
   and rejected: no view of a song has a reason to hide what the author wrote
   for its reader, and the setlist on stage is where a note like *Mais devagar
   na segunda vez.* matters most. The arrange chart shows them too; they hold
   no chords to press.
7. **No new board.** The drawing is the chart's own tokens plus a monospace
   block with the surface ground the boards use for cards; the e2e asserts
   order, face and fit, not pixels. A board would add nothing a later
   `design.*` task could not.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- `app/src/chart/layout.js`: `chartRows` yields a `notes` row (paragraphs) and a `verbatim` row (info, text) for those parts, in document order.
- `app/src/chart/Chart.jsx`, `app/src/theme/theme.css`: notes drawn as literal `<p>` paragraphs (never Markdown); verbatim fences as a focusable, sideways-scrolling `<pre>` in `--font-code`, named "Tab block" and the like.
- `app/src/chart/reading.js`: `readingTokens` includes notes paragraphs and verbatim `[label, text]` in the screen-reader order.
- `app/src/songs/conflict-text.js`: `chartPlace` matches over music rows only, so conflict places are unchanged.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`: the `chart.verbatim` label; `docs/mockups/README.md` line updated (DIRECTION §3.7 already carried the change).
- Tests: unit `app/src/chart/layout.test.js`, `reading.test.js`, `app/src/songs/conflict-text.test.js`; behavior (axe) `app/src/chart/Chart.behavior.test.jsx`, `app/src/editor/SongEditor.behavior.test.jsx`, `app/src/songs/SongReading.behavior.test.jsx`; e2e-web `e2e/web/tests/notes.spec.js` on phone, tablet and computer.
- Tech-debt follow-up: none.
