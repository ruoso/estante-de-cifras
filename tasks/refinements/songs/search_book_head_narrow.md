# songs.search_book_head_narrow — A book section heading in search fits a phone

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task search_book_head_narrow`
under `task songs` (`tasks/60-songs.tji:215-220`). `depends
design.review_polish`; the parent `task songs` cascade (`shell.layout`,
`shell.chart`, `foundation.e2e_web`, `tasks/60-songs.tji:6`) applies. Wired
into milestone **`milestones.m5_complete`** (`tasks/99-milestones.tji:45`).
The note:

> "M13: on a phone the search screen book section header puts the bordered
> row, the 44px plus, Save all and the 44px filter side by side
> (SearchScreen.jsx:308-350; search.css:128-201), crowding the card edge; W02
> draws the row alone. As design.review_polish draws it. … Tests: behavior
> (the actions reachable at narrow width; axe); e2e-web (a book section with
> unsaved songs at 390px, nothing clipped; axe, mockup W02)."

(The note's line numbers have drifted: the section is now
`SearchScreen.jsx:292-389`, its header `:326-371`; the CSS `search.css:131-215`.)

## Effort estimate

**0.5d**, allocated `team`. One move of a button out of a flex row into a line
of its own with a count, one CSS rule replaced, one plural key in four
locales, and two levels of test.

## Repository

**estante-de-cifras only, `app/` and `e2e/web/`** — not a `cifra.md:` task.

- `app/src/songs/SearchScreen.jsx` — `BookSection` (`:292-389`).
- `app/src/songs/search.css` — `.book-head .save-all` (`:202-210`) replaced by
  the new line's rule.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — a new `search.unsavedCount`
  plural.
- Tests: `app/src/songs/SearchScreen.behavior.test.jsx` (a new `describe`),
  new `e2e/web/tests/search-book-head.spec.js`.

## Inherited dependencies

- **`design.review_polish`** — settled (`complete 100`). Its item 3 decided
  the header (`tasks/refinements/design/review_polish.md:225-232`) and the
  copy (`:371`, *{count} song with unsaved changes / {count} songs with
  unsaved changes · Save all*). Workflow 2 carries it
  (`docs/workflows/02-find-and-play.md:17-26`); the board
  `docs/mockups/Review-polish.dc.html` draws it (Phone frame, `:26-60`).
- Already in place and used here: `songs.search` (the book sections),
  `songs.save_sheet` (Save all and the save sheet for several songs, workflow
  4 §Several songs at once), `books.owner_can_save` (the plus on an
  owner-role book), `books.setlists_resilient` (no plus or Save all on a book
  still coming down), `shell.narrow_fit` (`e2e/web/lib/fit.js`).

## What this task is

A book's section on the search screen today puts four things in one row: the
bordered disclosure row (caret, name, song count), the 44px plus, **Save all**
(when the book has unsaved songs) and the 44px filter. On a phone that row
runs into the card's edge. Workflow 2 decided the fix: the header keeps the
bordered row and the two icons only, on every device; when the book has songs
with unsaved changes, a line of its own sits under the header, above the
songs — *2 songs with unsaved changes* with **Save all** at its end — outside
the part that opens and closes, so it shows with the section closed too.

## Why it needs to be done

Usability review 2026-10-19 finding M13: Save all crowds the header on a
phone, and the header never said what Save all would save. The line under the
header fixes both. It is one of the review's build tasks in
`milestones.m5_complete`; nothing downstream depends on it.

## Inputs / context

- **Workflow 2** `docs/workflows/02-find-and-play.md:17-26` — *A book's
  section header*: the row and the two icons; the unsaved line, its words,
  Save all at its end, outside what opens and closes, shown with the section
  closed; "a phone's 370px holds the row and the two icons; … none goes
  there".
- **Workflow 4** `docs/workflows/04-edit-and-save.md:119-125` (§Several songs
  at once — Save all opens the one sheet, one commit) and §A book the user
  cannot push to (`:151`; Save all opens the make-it-your-own offer).
- **The board** `docs/mockups/Review-polish.dc.html:26-60` — the Phone frame:
  bordered row with `▾ Ensaios / 12 songs`, the plus, the filter; under it
  `2 songs with unsaved changes` (`t-small`, `flex: 1`) and a `btn` *Save
  all*, `padding: 0 4px`, gap 10px; then the list.
- **The design refinement** `tasks/refinements/design/review_polish.md:138-143`
  (the code as it was), `:225-232` (the decision), `:285-290` (the frame),
  `:371` (the copy).
- **The code today**: `app/src/songs/SearchScreen.jsx:292-389` —
  `unsavedPaths` (`:316`, empty while the book is coming down), the
  `book-head` div (`:326`) holding the `Heading`/trigger, the plus
  (`:341-348`, `newSong.inThisBook`, only `canWrite && !comingDown`), Save all
  (`:354-362`, `saveSheet.saveAllLabel` as its accessible name,
  `saveSheet.saveAll` as its text, `onSaveAll({ bookId, paths, bookLabel })`),
  the filter (`:364-370`, `search.scopeToBook`); the `DisclosurePanel`
  (`:372`). The save sheet for Save all is mounted by `SearchScreen`
  (`:838-844`).
- **CSS**: `app/src/songs/search.css:137-215` — `.book-head` flex row,
  `.book-head .scope-btn` (44px), `.book-head .save-all` (`:202-210`),
  `.book-panel`.
- **Strings**: `app/src/i18n/locales/en.js:484` (`search.songCount`, the
  `{ one, other }` plural shape to follow), `:1119-1120`
  (`saveSheet.saveAll`, `saveSheet.saveAllLabel`); the same keys in
  `pt-BR.js:1026-1027`, `es-419.js:1027-1028`, `it.js:1026-1027`.
- **Tests to extend / follow**: `app/src/songs/SearchScreen.behavior.test.jsx`
  (`makeStore`/`emit`, `labelled`, `BROWSE_RESULTS` with `unsaved` songs at
  `:128-160`, `checkWcag21aa`); `e2e/web/tests/save-sheet.spec.js:102-135`
  (two songs left unsaved in the example book through the real UI, then
  *Save all changes in Example Book*); `e2e/web/tests/narrow-fixes.spec.js:21,
  33-58` (the phone checked at its 412px and again at 390px with
  `setViewportSize`); `e2e/web/lib/fit.js` (`expectFits`,
  `expectInsideViewport`, `overlaps`); `e2e/web/lib/journeys-edit.js`
  (`addSection`, `backToSearch`); `e2e/web/lib/journeys.js`
  (`openExampleBook`, `openSongInEditor`).
- **Precedent**: `tasks/refinements/songs/empty_states.md` Decision 4 — the
  Review-polish board is not in `e2e/web/lib/mockup-frames.json`, and
  `mockup()` throws on an unknown frame (`e2e/web/lib/mockup.js:47`).

## Constraints / requirements

1. **The header** (`.book-head`) holds exactly the bordered disclosure row,
   the plus (when it is offered today) and the filter — on every device.
   Save all never sits in it.
2. **The unsaved line** renders when, and only when, `unsavedPaths.length >
   0` (so never for a book still coming down, as today). It sits inside the
   `Disclosure`, after the header and before the `DisclosurePanel`, so it
   shows whether the section is open or closed. It holds the text
   `search.unsavedCount` (*1 song with unsaved changes* / *{count} songs with
   unsaved changes*) and the Save all `Button` at its end.
3. **Save all is unchanged in behavior**: same `onSaveAll` call with the same
   paths, same accessible name (`saveSheet.saveAllLabel`, *Save all changes
   in {book}*), same visible text, same fork offer for a book the user cannot
   push to. Only its place moves.
4. **Layout** follows the board: the line is a flex row, the text `flex: 1;
   min-width: 0` (it may wrap in a long locale, never ellipsize), Save all
   `flex: none` keeping its 44px touch target; the line indents a few pixels
   as drawn (`padding: 0 4px`). The `.book-head .save-all` rule goes; no
   other header rule changes.
5. **Keyboard order**: trigger, plus, filter, then Save all, then the songs
   (when open) — document order, no `tabIndex` games.
6. **Accessibility**: React Aria `Button` as today; the count is plain text
   (the word carries the status, not a colour); axe clean at WCAG 2.1 AA.
7. **Copy in four locales**: `search.unsavedCount` `{ one, other }` in
   `en.js`, `pt-BR.js`, `es-419.js`, `it.js`, in each locale's existing word
   for *unsaved changes* (en `'{count} song with unsaved changes'` /
   `'{count} songs with unsaved changes'`, as the design refinement's copy
   table).
8. Test fixtures are songs written for the purpose (the bundled example book
   in e2e; invented titles in the behavior test).

## Acceptance criteria

Behavior delivered: on every device, a book section's header is the bordered
row with the plus and the filter beside it; a book with unsaved songs shows,
under the header and outside the collapsible part, *N song(s) with unsaved
changes* and **Save all**, which opens the save sheet for those songs as
before; at 390px nothing in the section runs past the card's edge.

Tests, by level:

- **unit** — `app/src/i18n/i18n.test.js` (existing): key parity across the
  four locales now covers `search.unsavedCount` and its `one`/`other` forms
  (Constraint 7).
- **behavior** — `app/src/songs/SearchScreen.behavior.test.jsx`, a new
  `describe('SearchScreen — a book section’s Save all on its own line
  (songs.search_book_head_narrow)')` (workflow 2 §A book's section header,
  `02-find-and-play.md:17-26`):
  - *a book with two unsaved songs: the header holds the trigger, the plus
    and the filter, and Save all sits on a line of its own under it reading
    "2 songs with unsaved changes"; axe clean* — Save all (*Save all changes
    in {book}*) is not inside the header's container (the element holding
    the trigger and *Search only in {book}*), the count text and Save all
    share their own container, which follows the header;
    `checkWcag21aa` passes.
  - *the line shows with the section closed, and Save all opens the save
    sheet for the unsaved songs* — with the section collapsed (its default)
    the line and Save all are present; pressing Save all shows the save sheet
    dialog (workflow 4 §Several songs at once).
  - *keyboard order: trigger, New song in {book}, Search only in {book}, Save
    all* — `userEvent.tab()` from the trigger walks them in that order (the
    actions reachable without the pointer, whatever the width).
  - *one unsaved song reads "1 song with unsaved changes"; none, no line* —
    the singular, and with no unsaved song neither the count text nor Save
    all renders.
  - The existing coming-down test (`:225-241`, no Save all while a book is
    coming down) keeps passing unchanged.
- **e2e-web** — new `e2e/web/tests/search-book-head.spec.js`, on the phone,
  tablet and computer projects, real-UI journeys only (`openExampleBook`,
  `openSongInEditor`, `addSection`, `backToSearch` — as
  `save-sheet.spec.js:102-135`):
  - *a book section with unsaved songs: the header holds the row and two
    icons, Save all on its own line, nothing clipped; axe* — leave two
    example-book songs unsaved, return to search with an empty box; the
    example book's section shows *2 songs with unsaved changes* and *Save
    all changes in Example Book*; the plus and the filter sit on the
    trigger's row, Save all below it (its box's top at or below the
    trigger's bottom); `expectFits(page, { whole: ['Save all'] })` and
    `expectInsideViewport` on the plus, the filter and Save all; on the phone
    project this is checked at its own 412px and again at **390px**
    (`setViewportSize`, restored in `finally`, as `narrow-fixes.spec.js:33-58`);
    `checkA11y` at each width. Pins workflow 2 §A book's section header and
    the Review-polish board's Phone frame (`Review-polish.dc.html:26-60`).
  - *the section closed still shows the line, and Save all opens the sheet
    listing both songs* — collapse the example book's section; the line and
    Save all stay visible; pressing Save all opens the dialog naming both
    titles; Escape (or Cancel) closes it, nothing saved. Pins workflow 2
    ("shows with the section closed too") and workflow 4 §Several songs at
    once.

No follow-up task is deferred.

## Decisions

### 1. The line lives between the header and the panel, inside the Disclosure

**Chosen:** render the line as a sibling after `.book-head` and before the
`DisclosurePanel`. **Rejected:** (a) inside the `DisclosurePanel` — it would
hide with the section closed, against workflow 2; (b) outside the
`Disclosure` altogether — it would detach from its book in the DOM, so a
screen reader moving by section would meet it after the songs, or under the
next book; (c) keeping Save all in the header and wrapping the row with
`flex-wrap` — the workflow decides no third action goes beside the row, and a
wrap would put Save all at a width-dependent place with no words saying what
it saves.

### 2. The count is plain text, not a live region

**Chosen:** a plain `span`. **Rejected:** `role="status"` — the count changes
as songs are edited elsewhere and the person comes back to search; a live
region would announce every book's count on each return. The words are read
in order beside Save all, which is enough; Save all keeps its explicit
accessible name.

### 3. A new key rather than reusing an existing plural

**Chosen:** `search.unsavedCount`. **Rejected:** reusing the book-removal
plural (*… song with unsaved changes will be lost*, `en.js:228-229`) by
string surgery, or `songCount` + `unsaved` concatenation — both break word
order in pt-BR, es-419 and it.

### 4. No mockup() frame in the e2e; the note's "mockup W02" is the Review-polish board

W02 never draws a book section on a phone (`review_polish.md:142-143`); the
frame that draws this is Review-polish's Phone frame, and that board is not
in `e2e/web/lib/mockup-frames.json` (`mockup()` throws on an unknown frame,
`e2e/web/lib/mockup.js:47`). Regenerating the frame list
(`audit/render-mockups.mjs`) is outside this task, as
`songs.empty_states` Decision 4 settled. The spec asserts the drawn
arrangement instead — the icons on the trigger's row, Save all below it, the
count's words — and cites the frame in its header comment.

### 5. 390px by resizing the phone project, not a fourth project

**Chosen:** the phone project's 412px and then 390px via `setViewportSize`,
as `narrow-fixes.spec.js` does. **Rejected:** a new Playwright project at
390px — it would run every spec again for one check.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-20.

- Save all moved out of the book section's header onto its own line under it, with a count ("2 songs with unsaved changes") that shows with the section open or closed: app/src/songs/SearchScreen.jsx, app/src/songs/search.css.
- The header keeps only the bordered row, the plus and the filter, so nothing runs past the card's edge at 390px.
- New `search.unsavedCount` (`one`/`other`) in app/src/i18n/locales/{en,pt-BR,es-419,it}.js; key parity covered by the existing app/src/i18n/i18n.test.js.
- Behavior: five new tests in app/src/songs/SearchScreen.behavior.test.jsx (header layout with axe; line with the section closed and Save all opening the sheet; keyboard order; singular count; no line when nothing is unsaved). Keyboard order is checked through DOM order (no positive tabIndex) because @testing-library/user-event is not an app dependency.
- e2e-web: e2e/web/tests/search-book-head.spec.js, two tests on phone, tablet and computer, the first also at 390px on the phone, with axe.
- No follow-up task deferred.
