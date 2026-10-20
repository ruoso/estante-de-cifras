# songs.empty_states — An empty song or section says so and offers Edit

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task empty_states` under
`task songs` (`tasks/60-songs.tji:221-226`). `depends design.review_polish,
!render_notes`; the parent `task songs` cascade (`shell.layout`,
`shell.chart`, `foundation.e2e_web`, `tasks/60-songs.tji:6`) applies. Wired
into milestone **`milestones.m5_complete`** (`tasks/99-milestones.tji:45`).
The note:

> "L6: the reading view has no empty state (SongReading.jsx), so a song saved
> from the template reads as a blank section; only the arrange chart has one
> (en.js Nothing written yet.). As design.review_polish decides. … Tests:
> behavior (an empty song and an empty section, Edit reachable; axe); e2e-web
> (a song saved untouched reads its empty state on the three viewports; axe)."

(The note's "only the arrange chart has one" is stale: `editor.nothingYet`,
`app/src/i18n/locales/en.js:2082`, is defined and used nowhere —
`tasks/refinements/design/review_polish.md:135`.)

## Effort estimate

**0.5d**, allocated `team`. One pure helper beside `chartRows`, one opt-in
row kind in `Chart`, one branch in the reading sheet, two locale keys in four
locales, and three levels of test.

## Repository

**estante-de-cifras only, `app/` and `e2e/web/`** — not a `cifra.md:` task.
The reader's model already says everything needed (below); no format change.

- `app/src/chart/layout.js` — `chartRows` (`:234-256`) and a new exported
  `isEmptySong(model)`.
- `app/src/chart/Chart.jsx` — a `markEmpty` prop and the `empty` row
  (`Row`, `:119-181`; `Chart`, `:224-257`).
- `app/src/songs/SongReading.jsx` — the sheet (`:509-540`).
- `app/src/songs/reading.css` — the muted line and the notice's layout.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — `reading.emptySong`,
  `reading.emptySection`.
- Tests: `app/src/chart/layout.test.js`, `app/src/songs/SongReading.behavior.test.jsx`,
  new `e2e/web/tests/empty-song.spec.js`.

## Inherited dependencies

- **`design.review_polish`** — settled (`complete 100`,
  `tasks/20-design.tji:99-104`). Its item 4 decided the two states and their
  copy; workflow 2 §Nothing written yet carries them
  (`docs/workflows/02-find-and-play.md:116-126`); the board
  `docs/mockups/Review-polish.dc.html` draws them (Phone 2, `:75-96`;
  Computer, `:165`, `:204-205`).
- **`songs.render_notes`** — settled (`complete 100`,
  `tasks/60-songs.tji:195-200`). Notes and verbatim parts are drawn in the
  chart (`Chart.jsx:161-181`, `layout.js:240-247`), so "a note" is something
  the chart already shows, and emptiness can be judged from the chart's own
  rows.
- Already in place and used by the e2e journey: `songs.new_song` (Create
  "{query}" from search opens the template), `songs.save_empty_message` (a
  save with no musical summary commits, `tasks/60-songs.tji:99-104`),
  `songs.reading`.

## What this task is

Make the reading view say so when there is nothing to read. A song whose
sections hold no bar, no sung line and no note, with nothing before its first
section — a new song saved untouched from the template is one — shows, in
place of the chart, the notice *Nothing written in this song yet.* with an
**Edit** button that opens the editor as the toolbar's Edit does; no section
names, no shapes. A song that has content but also an empty section shows
that section's name and under it a muted line *Nothing written here yet.*,
with no button.

## Why it needs to be done

Usability review 2026-10-19, finding L6: a song saved from the template reads
as the bare word *Intro* — the reader cannot tell a blank song from a broken
render, and nothing on the sheet points to where to write. Workflow 2 now
promises both states (`02-find-and-play.md:116-126`); this task delivers
them. It is one of the review-polish leaves gating `milestones.m5_complete`.

## Inputs / context

- **Workflow 2 §Nothing written yet** — `docs/workflows/02-find-and-play.md:116-126`
  (normative; quoted in full in Constraints 1-3).
- **design.review_polish** — `tasks/refinements/design/review_polish.md:233-242`
  (item 4), `:372-373` (the copy), `:407-413` (Decision: the song-level
  notice with Edit, a muted line per empty section without a button; do not
  reuse `editor.nothingYet`).
- **The board** — `docs/mockups/Review-polish.dc.html`: Phone 2 (`:75-96`) —
  app bar *Untitled song*, the book line *My songs*, then a `.notice` in a
  column (`flex-direction: column; gap: 12px`) holding the sentence in
  `t-body` and a primary **Edit** button with the pencil icon, the bottom bar
  (Edit, Full screen) unchanged. Computer (`:204-205`) — after the drawn
  sections, `<div class="sec-name">Refrão</div>` then
  `<p class="t-small" style="color: var(--ink-2)">Nothing written here yet.</p>`.
- **The model** — `parse` from `cifra-md` (`SongReading.jsx:349`). Sections
  are `model.sections`, each `{ name, heading, anchor, body, groups }`;
  content before the first `##` is a leading section with `name: ''`
  (`layout.js:238` draws no name row for it). The untouched template
  (`app/src/editor/template.js:34-47`: title, `- artist:`, `- notation:`,
  `## Intro`, an empty fence) parses to one section `Intro` whose body is
  `[{ type: 'music', lines: [] }]`; a heading with nothing under it has
  `body: []`. Properties live in `model.properties`, not in a section.
- **The chart's rows** — `chartRows` (`layout.js:234-256`): a notes part
  yields a row only with a non-blank paragraph (`:240-243`); a verbatim part
  always yields one (`:245-247`); a music line yields sung / bars / run /
  words (lyric and `//` annotation) or gap (break and anything else) via
  `rowForLine` (`:182-197`). `Chart` draws `row.type === 'section'` as
  `<div className="sec-name">` (`Chart.jsx:119-120`).
- **The reading sheet** — `SongReading.jsx:509-540`: `<Chart model={model} …
  label={displayTitle} />` (`:511`), the shapes section gated on
  `shapes.length` (`:512`, so absent with no chords), the unvoiced line
  (`:534-538`). The same `sheet` renders in full screen (`:568`). Edit is
  `onEdit({ bookId, path, title: baseModel?.title })` — the ⋯ item (`:600`,
  `:610`), the tablet/computer `editButton` (`:729-733`), the phone bottom
  bar (`:823-835`). The no-voicings notice (`:709-716`) is the pattern for a
  `.notice` with a RAC `Button`; `noVoicings` is false with no chords
  (`:387`).
- **`.notice`** — `app/src/theme/theme.css:356-359`.
- **Locales** — `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`, the
  `reading:` block (`en.js:1629`); parity is checked by
  `app/src/i18n/i18n.test.js:46` ("has every key English has, and no
  others"), placeholders at `:55`, translated-not-copied at `:65`.
- **Tests to extend** — `app/src/songs/SongReading.behavior.test.jsx`
  (`song()` builder `:65-77`, `makeStore` `:126`, `renderReading` `:197`,
  `checkWcag21aa` from `../a11y/axe.js`, `installWidths` `:43`);
  `app/src/chart/layout.test.js`. e2e: `e2e/web/lib/journeys.js`
  (`startApp` `:26`, `openSongFromSearch` `:298-314` — which waits for the
  group named after the song, `editFromReading` `:326-329`,
  `saveThroughSheet` `:370-380`), `e2e/web/tests/new-song.spec.js:79-127`
  (the Create "{query}" path), `e2e/web/lib/axe.js` (`checkA11y` fixture),
  `e2e/web/playwright.config.js:39-42` (phone, tablet, computer projects).

## Constraints / requirements

1. **When a song is empty** (workflow 2 L118-120): no section holds a bar, a
   sung line or a note, and there is nothing outside a section. Implemented
   as: `chartRows(model)` yields no row other than `section` and `gap` rows.
   That is, a sung, bars, run, words, notes or verbatim row anywhere —
   including in the unnamed leading section — makes the song not empty. The
   title and properties are not content.
2. **The empty song** (L120-123): in place of the chart, the notice *Nothing
   written in this song yet.* (`reading.emptySong`) with **Edit**, a RAC
   `Button` calling the same `onEdit({ bookId, path, title })` as the
   toolbar's Edit. No section names drawn; no shapes section (already absent
   with no chords — keep it so); no no-voicings notice (already false with no
   chords). Drawn as the board's Phone 2: a `.notice` laid out as a column,
   the sentence then a primary Edit with the pencil icon. The toolbar /
   bottom-bar Edit and the ⋯ menu are unchanged.
3. **The empty section** (L124-126): in a song that is not empty, a named
   section with no row but gaps under its name is drawn as its name and,
   under it, a muted line *Nothing written here yet.*
   (`reading.emptySection`) — `t-small` in `--ink-2`, as the board's
   Computer frame — and no button. The unnamed leading section never gets the
   line (it has no name to sit under, and it is empty in every song that
   starts with a heading).
4. **The reading view only.** `Chart` draws the muted line only when given
   `markEmpty`; the reading sheet passes it. The editor preview, history,
   conflict, arrange, wizard and setlist-play charts are unchanged
   (Decision 3).
5. **The sheet keeps its name.** The empty-song notice sits inside a
   `role="group"` named `displayTitle`, the name the chart carries
   (`SongReading.jsx:511`), so a screen reader — and
   `openSongFromSearch` — finds the song's sheet the same way, empty or not.
6. **Transposition** changes nothing: emptiness is judged on the model drawn
   (`model`), and transposing does not add or remove rows.
7. **Copy in the four locales**, from `review_polish.md:372-373` in English;
   translated, not copied; `editor.nothingYet` stays unused (not reused, not
   deleted — out of scope).
8. **Accessibility**: the Edit is a RAC `Button`, reachable by Tab and
   pressed with Enter/Space; the state is carried by words, not by colour or
   an icon alone; axe at WCAG 2.1 AA on both states. The muted line is plain
   text (no `role="status"`: it is content of the sheet, not a change).
9. No song text in logs (nothing new is logged); fixtures are songs written
   for the purpose.

## Acceptance criteria

Behavior delivered: Constraints 1-9.

Tests, by level:

- **unit** — `app/src/chart/layout.test.js`:
  - `isEmptySong`: true for the untouched template text (`template.js`
    output parsed), for a song of headings only (`## A` / `## B`, bodies
    `[]`), for an empty fence plus a blank notes part, and for a fence holding
    only blank lines (gap rows); false for a single bar, a single sung line, a
    lyric-only line, a notes paragraph before the first heading, and a
    verbatim fence — workflow 2 L118-120.
  - `chartRows(model, { markEmpty: true })` yields `{ type: 'empty' }` right
    after the `section` row of each named section with only gaps, none for
    the unnamed leading section, none for a section with content; and
    `chartRows(model)` (no option) is unchanged for the same model —
    workflow 2 L124-126, Constraint 4.
  - `app/src/i18n/i18n.test.js` (existing) runs over the two new keys in the
    four locales — Constraint 7.
- **behavior** — `app/src/songs/SongReading.behavior.test.jsx`, new
  `describe('nothing written yet')`:
  - *an empty song*: a store holding the untouched template song — the text
    *Nothing written in this song yet.* inside the group named after the song;
    no *Intro* section name; no shapes heading; pressing its **Edit** (by
    click, and separately by focusing it and keyDown+keyUp Enter — one
    gesture each) calls `onEdit` with `{ bookId, path, title }`; axe clean
    (`checkWcag21aa`) — workflow 2 L118-123, board Phone 2.
  - *an empty section*: a song with a `## Verse` holding bars and an empty
    `## Chorus` — *Chorus* drawn, *Nothing written here yet.* after it and
    before nothing else of that section, no Edit button in the sheet besides
    the toolbar's, the Verse's bars drawn, shapes present; axe clean —
    workflow 2 L124-126, board Computer.
  - *a song with content*: neither sentence is shown (guards against the
    state leaking) — Constraint 1.
- **e2e-web** — new `e2e/web/tests/empty-song.spec.js`, on the phone, tablet
  and computer projects: `startApp`; search a title written for the purpose
  (*Pebble Road*); Create "Pebble Road"; save the template untouched through
  `saveThroughSheet`; `openSongFromSearch(page, 'Pebble Road', 'Pebble
  Road')`; the reading view shows *Nothing written in this song yet.* and no
  *Intro*; `checkA11y()` on that state; press the notice's **Edit** (scoped
  to the notice, not the toolbar's) and the editor opens on the song
  (`.cm-content` contains *Pebble Road*) — workflow 2 §Nothing written yet,
  workflow 3 (a new song saved untouched). Real UI only; no `#dev/*`, no
  injected state.

Every prerequisite of these tests exists: the template and Create from
search (`songs.new_song`), an untouched first save that commits
(`songs.save_empty_message`), the reading view (`songs.reading`), the e2e
harness (`foundation.e2e_web`). No hosted book or second device is needed.

No deferred work.

## Decisions

### 1. Emptiness is judged from the chart's own rows

**Chosen:** `isEmptySong(model)` in `layout.js` is "`chartRows(model)` holds
only `section` and `gap` rows", and the empty-section line comes from the
same pass. **Rejected:** a separate walk of `model.sections` checking line
kinds — two definitions of "something is drawn" would drift (render_notes
already had to teach `chartRows` about notes and verbatim); deriving from the
rows means "empty" is exactly "the chart would draw nothing but names". A
lyric-only or annotation line counts as content because the chart draws it as
words; a verbatim fence counts because it is drawn as a block.

### 2. The notice replaces the chart inside a group with the song's name

**Chosen:** SongReading renders, instead of `<Chart>`, a `role="group"`
named `displayTitle` holding the `.notice`. **Rejected:** (a) letting `Chart`
draw the song-level notice — `Chart` knows no `onEdit` and is shared by every
chart screen; the Edit belongs to the reading view; (b) dropping the group — the
sheet would lose the name a screen reader and the existing journeys find it
by.

### 3. The muted line is opt-in, for the reading view

**Chosen:** `Chart`'s `markEmpty` prop, passed by SongReading only.
**Rejected:** drawing it in every chart — workflow 2 decides the reading view;
in the editor preview the line would sit under every heading a person has
just typed, nagging mid-writing, and in history or conflict views it would
describe a past or other version in present-tense words. Setlist play reads
songs too, but workflow 7 decides nothing here; left as is.

### 4. No mockup() frame in the e2e

The Review-polish board's frames are not in `e2e/web/lib/mockup-frames.json`
(`mockup()` throws on an unknown frame, `e2e/web/lib/mockup.js:47`), and
regenerating that list (`audit/render-mockups.mjs`) is outside this task's
scope. The spec asserts the copy and the absent section name instead.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- `app/src/chart/layout.js`: exported `isEmptySong(model)` (chart rows hold only section and gap rows); `chartRows(model, { markEmpty })` adds an `empty` row after each named section with nothing drawn.
- `app/src/chart/Chart.jsx`: draws the `empty` row as a muted line, only when given `markEmpty`.
- `app/src/songs/SongReading.jsx`, `app/src/songs/reading.css`: an empty song shows the notice with an Edit button inside the group named after the song; the sheet passes `markEmpty`.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`: `reading.emptySong`, `reading.emptySection`.
- Unit: `app/src/chart/layout.test.js` (`isEmptySong`, `markEmpty`); behavior: `app/src/songs/SongReading.behavior.test.jsx` (`nothing written yet`, axe).
- e2e-web: `e2e/web/tests/empty-song.spec.js` (Pebble Road saved untouched, empty state, axe, notice Edit opens the editor).
- Deviations: the reader drops blank lines in a fence, so that unit case checks the parsed song and a model built with break lines; the e2e waits for the saved song's search result before opening it.

