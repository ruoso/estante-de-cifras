# sync.conflicts_row_summary — The In conflict row's summary line

## TaskJuggler entry

[`tasks/45-sync.tji`](../../45-sync.tji), lines 84-89:

> W09#4 draws a .meta summary line under the title in the In conflict row; the
> app row has none. It needs the conflict titles moved into a shared pure
> module. Source of debt: tasks/refinements/sync/conflicts_polish.md
> (sync.conflicts_polish). Governing: workflow 9, mockup W09#4. Tests: unit
> (the shared conflict-title module); behavior (the row's summary line, axe).

`depends !conflicts_polish` (`complete 100`). Milestone: `m5_complete`
(`tasks/99-milestones.tji:44`).

## Effort estimate

0.5d (from the `.tji`). The task moves two functions into a pure module, adds
one more, and adds one line of markup. It adds no Worker, protocol or format
change, and no new copy.

## Repository

Not cifra.md. The work lands in `app/`, plus one assertion in `e2e/web/`:

- `app/src/songs/conflict-text.js`: gains the conflict titles and the row
  summary.
- `app/src/songs/SongConflict.jsx`: its `describe` takes its title from the
  shared module.
- `app/src/books/BookConflicts.jsx`: the *In conflict* row's `.meta` line.
- Tests:
  - `app/src/songs/conflict-text.test.js` (unit)
  - `app/src/books/BookConflicts.behavior.test.jsx` (behavior)
  - `app/src/songs/SongConflict.behavior.test.jsx` (existing; stays green)
  - `e2e/web/tests/conflicts.spec.js` (e2e-web; one assertion added)

No design delta. Workflow 9 and the W09 board already decide the line, and
this task brings the app into line with them.

## Inherited dependencies

- **sync.conflicts_polish** (settled, Done 2026-10-18,
  `tasks/refinements/sync/conflicts_polish.md`).
  - It made the *In conflict* rows theme `.row`s in a reset `ul`, so a
    `.meta` child gets the theme's row styling.
  - It added `differingMeasures` to `conflict-text.js`.
  - It deferred this task (its Decision 7 and §Deferred). Its proposed note
    put the titles in `conflict-text.js`, joined by `·`, with an e2e-web
    check that the row reads *Parte, bar 4*. This refinement keeps that
    check (see Decision 5).
- **sync.conflicts_editing** (settled, Done 2026-10-16). It added
  `conflictPlace` and the `chartTitle*` strings, which give the place titles
  (*Primeira parte, bar 5*) this line reuses.
- **sync.conflicts** (settled). It built the `conflicts` slice. Each song
  entry already carries `items` and `marked`
  (`app/src/worker/conflicts.js` L386-395), so the row has everything it
  needs.

## What this task is

Each song in the book panel's *In conflict* list gets a second line under its
title, as W09#4 draws it. The line names that song's conflicts the way the
resolver titles them, joined by ` · `. For example: *Primeira parte, bar 5 ·
The shape for G7*. To build the line, the resolver's title logic
(`placeTitle` and the title half of `describe`, both private to
`SongConflict.jsx`) moves into the pure `conflict-text.js`. The resolver
heading and the row then share one source.

## Why it needs to be done

- **W09#4** (`docs/mockups/W09-conflicts.dc.html` L222) draws the row as
  `name` + `meta` (*Carinhoso* / *Primeira parte, bar 5 · the shape for G7 on
  guitar*). The app row shows only the title and the count badge
  (`BookConflicts.jsx` L76-78).
- **Workflow 9 §Meeting one / §Settling one**
  (`docs/workflows/09-conflicts.md` L25-51) has the user decide which song to
  settle first. The places in musical terms ("two bars … named", DIRECTION §4)
  tell them what they are about to face before they open the song.
- `sync.conflicts_polish` Decision 7 deferred this line. It is one of the M5
  polish leaves.

## Inputs / context

- **Board**, `docs/mockups/W09-conflicts.dc.html` L222 (frame W09#4, desktop,
  `e2e/web/lib/mockup-frames.json` L249-271): `<span class="grow"><span
  class="name">Carinhoso</span><span class="meta">Primeira parte, bar 5 · the
  shape for G7 on guitar</span></span>`, then the `2 conflicts` badge and
  *Settle*.
- **Theme**, `app/src/theme/theme.css` L343: `.row .meta` is 13px,
  `--ink-2`, `white-space: nowrap; overflow: hidden; text-overflow:
  ellipsis`. A long line truncates by itself.
- **The titles today**, `app/src/songs/SongConflict.jsx`:
  - `placeTitle(place)` L203-211, which uses `chartTitleFallback`,
    `chartTitle`, `chartTitleBar`, `chartTitleBars` and `chartTitleBarRange`;
  - `describe(item, author, model)` L214-247, which returns `{ title, body }`
    per kind:
    - voicing → `voicingTitle {chord}`;
    - property → `propertyTitle {key}`;
    - title → `titleTitle`;
    - chart / sections → `placeTitle(conflictPlace(model, item))`;
    - anything else → `genericTitle`;
  - its callers: the heading (L396) and the *settled so far* labels
    (L303, L307, L311);
  - `model` is `previewModel` (L283):
    `snippetModel(resolveMarked(song.marked, 'ours').split('\n'))`.
    `snippetModel` (L63-71) parses, and returns null on an empty input or a
    parse failure.
- **Strings**, `app/src/i18n/locales/en.js` L1132-1150 (`songConflict.*`).
  The same keys exist in `es-419.js`, `it.js` and `pt-BR.js`.
- **The pure module**, `app/src/songs/conflict-text.js`:
  - It imports `parse` from `cifra-md` and `chartRows`.
  - It exports `labelMarkers`, `rowText`, `conflictPlace` (L123) and
    `differingMeasures` (L141).
  - Its header promises no DOM, no React, no store, nothing logged.
- **Precedent for i18n in a pure module**: `app/src/songs/render-change.js`
  L12-13 takes `t` as an argument (`renderChange(change, t)`), so its tests
  need no locale setup.
- **The row**, `app/src/books/BookConflicts.jsx` L73-90: `songs.map` over the
  slice's `book.songs`, each `<li className="row est-bookconf-row">` with
  `.grow > .name`. The *came in* row (L112-119) already shows the `.name` +
  `.meta` pair.
- **Slice shape**, `app/src/worker/conflicts.js` L375-404 (`buildPayload`):
  each song entry is `{ path, title, count, author, marked, items,
  markedLines }`, with items from `songConflictModel`
  (`app/src/worker/conflict-model.js` L40-58).
- **Existing tests**:
  - `app/src/songs/conflict-text.test.js` (`conflictPlace` L52-103 over
    `OURS_SONG`);
  - `app/src/books/BookConflicts.behavior.test.jsx`, whose fixture at L32 is
    `{ path, title: 'Carinhoso', count: 2, author: 'Ana' }`, with no
    `items` or `marked`;
  - `app/src/songs/SongConflict.behavior.test.jsx`, whose `MARKED` / `SONG`
    fixture is at L48-69, and whose title tests are at L143 and L155.
- **e2e**, `e2e/web/tests/conflicts.spec.js`:
  - the fixture song *Roda de rua*, section `## Parte`, bar line
    `C | G | Am | F`; the owner writes `…| Dm` and Ana `…| E7` (L40-46);
  - `expectPanelAsDrawn` (L156-172) already finds the *Roda de rua*
    `listitem` in the *In conflict* list, before `mockup(page,
    'W09-conflicts', 4)` (L205);
  - `openResolver` asserts the heading *Parte, bar 4*.

## Constraints / requirements

1. **The shared titles live in `conflict-text.js`.**
   - Add `conflictTitle(item, model, t)`. It returns the string `describe`
     returns as `title` today, kind by kind, with the same keys and the same
     `placeTitle` rule (moved, unexported or exported as convenient).
   - Add `oursModel(marked)`. It is
     `parse(resolveMarked(marked, 'ours'))` in a `try`, and returns null on
     an absent `marked` or a parse failure, as `snippetModel` does for the
     preview. The resolver may keep `snippetModel` for its own snippets.
   - `t` is passed in, following the `render-change.js` precedent. The module
     stays free of DOM, React and the store, and logs nothing.
2. **The resolver reads the shared title.**
   - `describe` in `SongConflict.jsx` takes `title` from
     `conflictTitle(item, previewModel, t)` and keeps its own `body`.
   - Its heading and *settled so far* labels must not change: every existing
     `SongConflict.behavior.test.jsx` test stays green and unedited (L143 and
     L155 pin the titles).
3. **The summary.**
   - Add `conflictSummary(song, t)`. It returns the distinct
     `conflictTitle`s of `song.items`, in item order, joined by `' · '`. The
     model comes from `oursModel(song.marked)`, computed once.
   - With no items it returns null.
   - With no `marked`, or `marked` that does not parse, the chart titles fall
     back to *A bar you both changed* and the other kinds keep their titles.
     It never throws.
   - Musical tokens (section names, chord symbols, property keys) pass
     through as data and are never translated (the `render-change.js` rule).
4. **The row.**
   - In the *In conflict* list, each row's `.grow` holds `.name`, then, when
     the summary is non-null, `<span className="meta">{summary}</span>`. This
     is the same pair as the *came in* row and W09#4 L222.
   - The badge, *Settle* and *Keep both*, and their accessible names, are
     unchanged.
   - Overflow is the theme's ellipsis (theme.css L343). The task adds no new
     CSS rule unless the row needs `min-width: 0` on `.grow` to let the
     ellipsis act. Use tokens only.
5. **No new copy.** The line reuses the `songConflict.*` title keys in all
   four locales. The ` · ` joiner is the one `SongConflict.jsx` already uses
   (L303).
6. **No Worker, protocol or format change.** The view already holds `items`
   and `marked`. The main thread never touches IndexedDB. Nothing is saved,
   pushed or logged.
7. **Accessibility.**
   - The summary is plain text inside the `li`, so a screen reader reads the
     title then the places. Visual truncation does not truncate the text.
   - The list stays a real `ul`/`li`.
   - Axe at WCAG 2.1 AA stays clean on the panel, narrow and embedded.
8. Test songs are written for the purpose: the existing *Choro Teste*,
   *Roda de rua* and `OURS_SONG` fixtures.

## Acceptance criteria

**Behavior delivered.**

- Each *In conflict* row reads its title, then a muted line naming its
  conflicts by place, joined by ` · `. In the e2e that line is *Parte, bar
  4*.
- The resolver's heading for each conflict is unchanged and comes from the
  same function.

**Tests.**

- **unit**, `app/src/songs/conflict-text.test.js`, with `t` from
  `app/src/i18n/index.js` at the default (en) locale:
  - *"conflictTitle names each kind as the resolver heading does (workflow 9
    §Settling one; W09#1 L42)"*. Over `parse(OURS_SONG)`, asserts:
    - a chart item gives *Primeira parte, bar 5*;
    - a two-bar item gives *…, bars 5 and 7*;
    - a three-or-more-bar item gives the range form;
    - a sections item gives *Primeira parte*;
    - an unplaceable chart item, or a null model, gives *A bar you both
      changed*;
    - a voicing `{ chord: 'G7' }` gives *The shape for G7*;
    - a property `{ key: 'key' }` gives *The key*;
    - a title item gives *The title*;
    - an unknown kind gives *A change you both made*.
  - *"conflictSummary joins the distinct titles of a song's conflicts with
    ` · ` (W09#4 L222)"*. A song `{ marked, items: [chart, voicing] }`, where
    `marked` is a marked text whose ours side places the chart item in
    *Primeira parte*. Asserts:
    - the chart title and *The shape for G7*, in that order, joined by
      `' · '`;
    - two items with the same title appear once;
    - `items: []` gives null.
  - *"conflictSummary falls back without throwing when marked is absent or
    unreadable"*. With `marked: null`, and with `marked: '<<<<<<< ours'`
    truncated garbage, the chart item reads *A bar you both changed* and the
    voicing keeps its title.
- **behavior**, `app/src/books/BookConflicts.behavior.test.jsx`:
  - *"the in-conflict row carries a summary line naming its conflicts by
    place (W09#4 L222), axe clean"*.
    - Fixture: a songs entry with `items` and `marked` as in
      `SongConflict.behavior.test.jsx` L48-69 (a chart region in *Primeira
      parte* and a G7 voicing).
    - Asserts:
      - within the row, the `.name` *Choro Teste*, then a `.meta` reading
        exactly *Primeira parte, bar 7 · The shape for G7*;
      - the *2 conflicts* badge and *Settle Choro Teste* still present;
      - axe clean.
  - *"a row whose song has no items shows the title alone"*. With the
    existing L32 fixture (no `items`), the row has no `.meta`. The existing
    tests stay green.
- **behavior**, `app/src/songs/SongConflict.behavior.test.jsx`: no new test.
  The title tests at L143 and L155 and every other existing test pass
  unedited, which pins constraint 2.
- **e2e-web**, `e2e/web/tests/conflicts.spec.js`, on phone, tablet and
  computer:
  - In `expectPanelAsDrawn`, the *Roda de rua* `listitem` of the *In
    conflict* list contains the text *Parte, bar 4*. This is the summary line
    through the real UI, reached by `reachNeedsYou` (two browser contexts, no
    injection).
  - It runs before `mockup(page, 'W09-conflicts', 4)`, so the W09#4 shot now
    shows the line.
  - Axe on the panel already runs in `openResolver`.

## Decisions

1. **The titles are lifted, not duplicated.**
   - One `conflictTitle` serves the resolver heading and the row, so the row
     always names a conflict as the screen it opens on names it. This is the
     same reason `sync.conflicts_polish` Decision 1 made the diagrams reuse
     `chartPlace`'s comparison.
   - Rejected: a second, row-only title function. It would drift from the
     heading the first time either is edited.
2. **`t` is injected.**
   - This follows `render-change.js`, keeping `conflict-text.js` free of the
     i18n singleton and its tests locale-explicit.
   - Rejected: importing `t` in the module. That works, but it would make
     this the one pure `songs/` helper reaching for global state.
3. **Reuse the resolver's wording, not the board's lower-case "the shape for
   G7 on guitar".**
   - The board's line continues mid-sentence and appends the instrument.
     Matching it would need a parallel, lower-cased set of keys in four
     locales, where casing rules differ, plus a tuning-to-instrument name
     lookup the resolver does not have (it shows the tuning in its body).
   - The `mockup` capture is observational, and the promise (the places, in
     musical terms) is kept.
   - Rejected: lower-casing at runtime (`toLowerCase` breaks section names
     and chord symbols, which are data).
4. **Distinct titles, in item order, with no cap.**
   - Two voicing conflicts on the same chord in two variations, or two
     unplaceable bars, would otherwise repeat the same phrase.
   - The badge already carries the exact count, and the theme's ellipsis
     bounds the width.
   - Rejected: "and N more" text. It is new copy in four locales for a case
     the ellipsis already handles.
5. **e2e-web is added though the note names only unit and behavior.**
   - The predecessor's deferral named it.
   - It is one assertion in an existing journey whose every prerequisite is
     landed (`reachNeedsYou`).
   - It pins the line through the real slice the Worker emits. jsdom
     fixtures cannot pin that `buildPayload`'s `marked` and `items` really
     produce *Parte, bar 4*.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-18.

- `app/src/songs/conflict-text.js`: `conflictTitle` and `conflictSummary` (distinct titles joined by ` · `) moved into the shared pure module, taking `t` as an argument; `oursModel` refuses a marked text whose regions are not all closed.
- `app/src/songs/SongConflict.jsx`: the resolver heading uses the shared `conflictTitle`, so heading and row summary come from one function.
- `app/src/books/BookConflicts.jsx`: each *In conflict* row has a muted `.meta` line naming its conflicts by place (e.g. *Primeira parte, bar 7 · The shape for G7*); a row with no items shows only the title.
- Unit: `app/src/songs/conflict-text.test.js` (conflictTitle per kind; conflictSummary join and dedupe; fallback without throwing).
- Behavior: `app/src/books/BookConflicts.behavior.test.jsx` (summary line with axe; row with no items); `SongConflict.behavior.test.jsx` unedited and green.
- e2e-web: `e2e/web/tests/conflicts.spec.js` `expectPanelAsDrawn` checks the *Roda de rua* row contains *Parte, bar 4* before the W09#4 mockup.
- Found: cifra.md/js `resolveMarked` never returns on an unterminated `<<<<<<< ours` region; registered `format.resolve_marked_unterminated`.
