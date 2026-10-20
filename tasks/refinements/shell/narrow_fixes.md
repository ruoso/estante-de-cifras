# shell.narrow_fixes — Nothing cut off or crowded where the explorers found it

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 146–151, task
`shell.narrow_fixes` ("Nothing cut off or crowded where the explorers found
it"), under `task shell`. It `depends !narrow_fit` and sits in the milestone
`milestones.m3_service` (`tasks/99-milestones.tji` line 32). The note,
verbatim:

> At phone width: the Add a book sheet Mine on Estante line runs past the
> sheet’s right edge (Your books that are not on this shelf yet. Sign in to
> s…); the Account Neck choice reads Verti… with its Selected badge crowding
> it; the setlist edit header truncates the book name to M., wraps Save to a
> second row beside the unsaved changes pill and clips the Key field, and the
> Key and note apply in this setlist only line wraps awkwardly; the search
> field shows two clear controls while typing (a blue × inside the field and a
> separate ✕). Source: persona exploration 2026-10-19 (Haiku agents as guitar
> teachers driving the app with playwright-cli on a local stack; findings
> verified against screenshots and code). Tests: behavior (each control has
> room, one clear control; axe); e2e-web (each screen at 390px and 412px in all
> themes, nothing clipped; axe, the narrow_fit checks).

## Effort estimate

**0.5 day** (from the `.tji`). Four local fixes, CSS plus a small markup
regrouping in the setlist editor's app bar; four behavior assertions in
existing test files; one e2e-web spec of four states, reusing
`e2e/web/lib/fit.js`.

## Repository

**estante-de-cifras only** — `app/src/` (`theme/theme.css`, `songs/search.css`,
`books/BooksScreen.jsx`, `books/books.css`, `books/SetlistView.jsx`,
`books/setlist.css`, `account/account.css`) and the e2e-web harness
(`e2e/web/tests/`, possibly one journey in `e2e/web/lib/journeys.js`). Not
format work; the note does not start with `cifra.md:`. Nothing touches the
service, the API or cifra.md.

**No design delta.** Every fix brings the app to what the workflows and boards
already promise (a sheet within the screen, a labelled choice read whole, a
status word beside its controls, one clear control per field). The phone
setlist editor is not drawn on a board (W12 draws the editor on the computer
only, `docs/mockups/W12-setlists.dc.html:158-172`); Decision 3 lays it out from
the computer frame's order, which is a fit decision, not a new behaviour.

## Inherited dependencies

**Settled:**

- `shell.narrow_fit` (complete) — `e2e/web/lib/fit.js` `expectFits(page, {
  whole, sentences })` (L38-172): no sideways document scroll, every visible
  element inside `[0, innerWidth]`, every control inside the viewport and every
  clipping ancestor, `whole` labels not ellipsized, `sentences` at least 60 % of
  their parent's width. Its rules: fix at the component; never pass a check
  with `overflow: hidden`; ellipsis only for user-length strings; a bar's
  actions wrap as a unit with Save last (its Decision 5). It also made the
  search field's ✕ share the input's row (`songs/search.css` `.search .field`,
  narrow_fit Decision 1) — this task removes the second clear control that row
  reveals.
- The screens themselves: the Add a book chooser and Mine on Estante
  (`books.add_book_chooser`, `books.add_by_link`), the account Preferences with
  the Neck choice (`shell.display_preferences`, `music.diagram_*`), the setlist
  editor (`books.setlists`, `books.setlists_resilient`,
  `books.setlist_picker_fixes`), search (`songs.search`). All complete, with
  journeys in `e2e/web/lib/` (below).

**Pending:** none.

## What this task is

Four places a person at phone width found cut off or crowded, each fixed at
its component and each pinned by the narrow_fit geometry checks at 390 px and
412 px in both themes:

1. **Add a book → Mine on Estante** — the row's description ("Your books that
   are not on this shelf yet. Sign in to see them.") runs past the sheet's
   right edge. It must wrap inside the sheet.
2. **Account → Diagrams → Neck** — the two side-by-side tiles squeeze the name
   to "Verti…" beside the "Selected" badge. The name must read whole; the
   badge goes beneath it when the tile cannot hold both.
3. **The setlist editor's header** — the book name shrinks to "M.", Save wraps
   alone beside the "unsaved changes" pill, the Key field is clipped, and the
   "Key and note apply in this setlist only" hint is squeezed beside the
   section title. The header becomes two rows on a phone (title and book; then
   the status word and actions, Save last), the row's fields fit, and the hint
   wraps under the title.
4. **Search** — typing shows Chromium's native search cancel (×) inside the
   input as well as the app's own ✕ "Clear search". Only the app's ✕ remains.

## Why it needs to be done

Workflow 7 (§The book-management screen, `docs/workflows/07-add-a-book.md:51-57`)
says each way in is "named and explained in a line"; a line that runs off the
sheet is not explained. Workflow 13 (§The account screen,
`docs/workflows/13-new-device.md:248-256`) and workflow 16 (§How diagrams are
drawn, `docs/workflows/16-chord-explorer.md:217-220`) make the Neck a labelled
choice with the chosen one marked by a word; a label that reads "Verti…" is
neither. Workflow 12 (§Building one, `docs/workflows/12-setlists.md:56-66`;
§The key, L44-54) has the editor set a key per item; a clipped Key field
cannot be read back. Two clear controls in one field is two ways to do one
thing, one of them unstyled and unnamed by the app. DIRECTION §4 promises one
app on phone, tablet and computer. `shell.surface_restore_focus` depends on
this task and the M3 milestone lists it.

## Inputs / context

**Governing documents**

- `docs/workflows/07-add-a-book.md:41-57` — the four ways in, Mine on Estante
  signed out offering *Sign in with a passkey* and *No passkey here? Email me a
  link*.
- `docs/workflows/13-new-device.md:244-256` — Preferences: hand, then neck
  (Vertical default, Horizontal), the chosen one marked by a word.
- `docs/workflows/16-chord-explorer.md:207-225` — Neck, two labelled choices
  with one live diagram (`docs/mockups/Theme-picker.dc.html`).
- `docs/workflows/12-setlists.md:44-66`; board
  `docs/mockups/W12-setlists.dc.html:158-172` — the computer editor bar: Back,
  title, book name (flex 1), the `unsaved changes` badge, Add song, Play, Save
  (primary); the section label "Songs · drag to reorder" with "Key and note
  apply in this setlist only"; each row: drag, number, name/meta, Key (64 px),
  Note (200 px), Remove.
- `tasks/refinements/shell/narrow_fit.md` — the checks and rules above.

**Code**

- Add a book sheet: `app/src/books/BooksScreen.jsx:423-603` (sheet), `:533`
  (`div.list.add-choices`), `:554-584` (the Mine row: `div.row.add-choice.add-mine`
  > `span.grow` > `.name`, `span.t-small.mine-note` with the signed-out
  `role="status"` span, `MineList`), `:275-342` (`MineList`: `Button.btn.mine-sign-in`,
  `Button.mine-email-link`). CSS `app/src/books/books.css:115-185`
  (`.add-choice`, `.add-choice .meta` wraps but `.mine-note` is not `.meta`,
  `.add-mine`, `.mine-email-link`, `.mine-note`); theme
  `app/src/theme/theme.css:304` (`.btn` nowrap), `:341` (`.list` overflow
  hidden), `:342-346` (`.row`, `.row .grow`, `.row .name`/`.meta` nowrap +
  ellipsis), `:367-369` (`.scrim`, `.sheet` — no `max-width`, content-box).
  Strings `app/src/i18n/locales/en.js:50-54`.
- Neck: `app/src/account/AccountScreen.jsx:142-149` (`HAND_OPTIONS`,
  `NECK_OPTIONS`), `:271-286` (`PickerRow`: `span.check`, `span.grow` >
  `.name`, the `badge ok` "Selected" at L282), `:636-653` (Neck `RadioGroup
  .list.account-list.account-tiles`). CSS `app/src/account/account.css:749-761`
  (`.account-tiles` row; tile `flex:1; min-width:0; flex-wrap:wrap`), `:714-725`
  (`.account-meta-long` hidden under 600 px); theme `.badge` nowrap (`theme.css:330`),
  `.row .grow { flex:1; min-width:0 }` — basis 0, so the tile's wrap never
  moves the badge and `.name` ellipsizes.
- Setlist editor: `app/src/books/SetlistView.jsx:523-543` (the edit app bar:
  Back, `span.title`, `span.t-small.setlist-appbar-book`, the `badge unsaved
  dot`, Add song, Play, Discard when unsaved, Save primary), `:387-449` (section
  label with `setlists.keyNoteHint`, `GridList.setlist-edit-list`, rows with
  `TextField.setlist-field` > `Input.setlist-key`/`.setlist-note`). CSS
  `app/src/books/setlist.css:47-56` (bar wraps; `.setlist-appbar-book {flex:1;
  min-width:0; ellipsis}` — shrinks to "M."), `:87-125` (row wraps, `.grow`
  min 40 %, Key 64 px, Note 200 px, `.setlist-field {flex:none}`); theme
  `.section-label` (`theme.css:351`, space-between, no wrap). Strings
  `en.js:519-529`.
- Search: `app/src/songs/SearchScreen.jsx:631-656` (`Group.search` >
  `SearchField.field` > `Input` + `Button.field-x` "Clear search"); RAC's
  `useSearchField` gives the input `type="search"`
  (`app/node_modules/react-aria/dist/private/searchfield/useSearchField.mjs:28`),
  so Chromium draws `::-webkit-search-cancel-button`. No CSS anywhere hides it.
  CSS `app/src/songs/search.css:51-97`. The setlist in-book picker
  (`SetlistView.jsx:101-103`, `setlist.css:136-143`) has no app clear button;
  its native one is its only clear control.

**Tests and harness**

- `e2e/web/lib/fit.js` (`expectFits`, `expectInsideViewport`, `overlaps`).
- `e2e/web/lib/axe.js` — `checkA11y` runs axe in both colour schemes
  (`analyzeBothThemes`, L59-77); `expectFits` checks the current one only.
- `e2e/web/playwright.config.js:39-43` — phone (Pixel 7, 412 px), tablet
  (712 px), computer (1280 px). No 390 px project; `header.spec.js:20,58-66`
  precedent: `page.setViewportSize` on the phone project, restored in
  `finally`.
- Journeys: `lib/journeys.js` `startApp`, `gotoTab`, `openExampleBook`,
  `makeLocalBook` (L171, opens Add a book); `lib/journeys-account.js:35`
  `openAccount`, `:280` `chooseDiagramNeck`; `lib/journeys-files.js:197`
  `addToNewSetlist`, `:170` `openSetlist`, `:236` `editSetlist`.
- Behavior tests: `app/src/books/BooksScreen.behavior.test.jsx` (L232 the
  sheet), `app/src/books/MineOnEstante.behavior.test.jsx`,
  `app/src/account/AccountScreen.behavior.test.jsx` (L232 Neck Selected),
  `app/src/books/SetlistView.behavior.test.jsx` (L242 editor, L399-410 unsaved
  and Save), `app/src/songs/SearchScreen.behavior.test.jsx`.

## Constraints / requirements

1. **Fix at the component, by narrow_fit's rules.** No `overflow: hidden` to
   pass a check; no ellipsis on a fixed label (Vertical, Horizontal, Save, the
   hint, the Mine description). The book name in the editor bar is
   user-length and may ellipsize only when it alone exceeds its row — never
   shrink to a letter because neighbours took its room.
2. **Measure before fixing the sheet.** The note's symptom is the Mine
   description past the sheet's right edge; the cause was not measured in a
   browser. Find which box is wider than the scrim (candidates: the `.sheet`
   content-box with no `max-width`, a `nowrap` child of `.add-mine` —
   `.btn.mine-sign-in`, `.mine-email-link`, `.row .name` — setting its
   min-content) and fix that box; the description then wraps as a sentence.
3. **The status word stays.** "Selected" and "unsaved changes" are the words
   that carry state (accessibility rule: never colour alone); they move, they
   are not dropped or hidden at narrow widths.
4. **One clear control per search field.** Hide the native cancel only where
   the app draws its own (`.search .field input`), so the setlist in-book
   picker keeps its only one. Clearing still works by the ✕ and by Escape (RAC
   SearchField).
5. **React Aria and order.** No interactive part changes component; regrouping
   the editor bar's markup must keep DOM order equal to visual and tab order
   (Back, title, book, status, Add song, Play, Discard, Save).
6. **Harmless at width.** Tablet and computer layouts stay as the boards draw
   them; the computer editor bar stays one row as on W12.
7. **e2e through the real UI only** (`e2e/web/eslint.config.js`).
   `page.setViewportSize` and `page.emulateMedia` are used by existing specs
   and are not state injection.

## Acceptance criteria

### Behavior delivered

- **Mine on Estante:** at 390 and 412 px the sheet lies within the viewport,
  and the Mine row's description, its signed-out status sentence, *Sign in with
  a passkey* and *No passkey here? Email me a link* lie inside the sheet; the
  description wraps rather than ellipsizes.
- **Neck (and Hand, the same tiles):** each tile's name reads whole
  ("Vertical", "Horizontal"); the chosen tile's "Selected" badge sits beside
  the name when there is room and on its own line beneath it when not
  (`.account-tiles .account-row .grow` takes its content basis, so the tile's
  existing `flex-wrap` moves the badge). The badge is still inside the tile
  and the radio's accessible name is unchanged.
- **Setlist editor:**
  - The edit app bar holds two groups: a head (Back, the title, the book name
    as a `t-small` line under the title, as the read view's `.setlist-head`
    does) and an actions group (the `unsaved changes` badge, Add song, Play,
    Discard, Save). On a phone the actions group wraps as a unit onto a second
    row with Save last and right-aligned; the badge stays with the actions,
    never alone. On the computer the bar stays one row in W12's order.
  - The book name is not squeezed: at 390 px the example book's name reads
    whole.
  - Each editor row's Key field and Note field and Remove fit inside the row:
    on a phone the fields wrap to the row's second line with Key at its 64 px
    and Note taking the remaining width (`flex: 1 1 auto`, a minimum) instead
    of a fixed 200 px.
  - The theme's `.section-label` wraps (`flex-wrap: wrap`, a row gap), so the
    hint drops whole beneath "Songs · drag to reorder" when both do not fit,
    instead of each squeezing; harmless for every other section label.
- **Search:** while typing, the field shows exactly one clear control, the
  app's ✕ "Clear search" (`.search .field input::-webkit-search-cancel-button
  { appearance: none; display: none }` in `songs/search.css`); ✕ and Escape
  both clear.

### Tests, by level

**behavior** (Vitest + Testing Library + axe; jsdom has no layout, so these
pin structure and the words, and the e2e pins geometry):

- `app/src/books/BooksScreen.behavior.test.jsx` — new case: the Add a book
  sheet's Mine row, signed out, renders its description and status sentence
  outside any `.name`/`.meta` element (the ellipsizing classes), and both
  sign-in controls; axe clean. Pins workflow 7 §The book-management screen
  (each way explained in a line).
- `app/src/account/AccountScreen.behavior.test.jsx` — new case: in the Neck
  group the chosen radio's tile holds its name and the "Selected" word, and
  choosing Horizontal moves the word; the radio's accessible name is the
  option's name alone; axe clean. Pins workflow 13 §The account screen (the
  chosen one marked by a word).
- `app/src/books/SetlistView.behavior.test.jsx` — new case: editing a Key
  makes the bar show "unsaved changes" inside the actions group, whose
  children in order are the badge, Add song, Play, Discard, Save; the book name
  is in the head group; tab order follows; axe clean. Pins workflow 12
  §Building one and W12's editor bar.
- `app/src/songs/SearchScreen.behavior.test.jsx` — new case: with a query
  typed, exactly one button named /clear/i is in the field ("Clear search");
  pressing it, and separately Escape, empties the field; axe clean. (The native
  cancel is a pseudo-element jsdom cannot see; the e2e pins it.)

**e2e-web** — `e2e/web/tests/narrow-fixes.spec.js`, taking `test`/`expect`
from `../lib/axe.js`, running on the three projects; on the phone project each
state is checked at 412 px and again at 390 px (`page.setViewportSize`,
restored in `finally`, as `header.spec.js` does), and at each width in both
colour schemes (the current one, then `page.emulateMedia({ colorScheme })` to
the other — Estante and Palco through Automatic, as `axe.js` does). Each state
ends in `expectFits` and `checkA11y()`. One shared local helper runs that
width × theme loop.

1. **the Add a book sheet, Mine on Estante signed out** (`startApp`, Books,
   Add a book; a fresh device is signed out) — `expectFits(page, { sentences:
   [the Mine description] })`, plus the description and both sign-in controls
   inside the sheet's box (`expectInsideViewport`-style check against the
   sheet). Pins workflow 7 §The book-management screen.
2. **Account, the Neck choice** (`openAccount`, then each of Vertical and
   Horizontal chosen with `chooseDiagramNeck`) — `expectFits(page, { whole:
   [the Vertical and Horizontal names, the Selected badge] })` and the badge
   does not `overlaps` the name. Pins workflow 13 §The account screen,
   workflow 16 §How diagrams are drawn.
3. **The setlist editor, unsaved** (`openExampleBook`, `addToNewSetlist`,
   `openSetlist`, `editSetlist`, then a key typed into the first row's Key
   field) — `expectFits(page, { whole: [Save, the unsaved changes badge, the
   book name], sentences: [the keyNoteHint] })`; the badge and Save are on the
   same row (vertical centres within half Save's height), the Key field's box
   lies inside its row, and the Key field shows the typed key
   (`scrollWidth <= clientWidth`). Pins workflow 12 §Building one, §The key;
   W12's editor bar.
4. **Search while typing** (`gotoTab(page, 'Search')`, a query filled) —
   exactly one clear control: the "Clear search" button is visible and the
   input's `::-webkit-search-cancel-button` computes `display: none`
   (`getComputedStyle(input, '::-webkit-search-cancel-button')`); then the ✕
   empties the field; `expectFits(page, { whole: [the input] })`.

Every case drives only existing journeys and real UI (no `#dev/*`, no
`addInitScript`, no mocks, no API writes). If no journey opens the Add a book
sheet without going on to a step, factor `openAddABook(page)` out of
`makeLocalBook` in `e2e/web/lib/journeys.js` and use it in both.

No deferred work.

## Decisions

1. **The badge moves below; the name is never cut.** *Rationale:* the name is
   a fixed label (narrow_fit: no ellipsis on fixed labels) and the word is the
   state; giving `.grow` its content basis lets the tile's existing
   `flex-wrap` do it. *Rejected:* stacking the two tiles on a phone (loses the
   side-by-side the Theme-picker board draws and doubles the height); hiding
   the badge on a phone (state by colour alone); shortening the label.
2. **The editor bar becomes two groups, actions wrapping as a unit.**
   *Rationale:* the same pattern narrow_fit Decision 5 chose for the raw editor
   toolbar; the status word belongs with Save, which it qualifies; the book
   name under the title matches the read view's `.setlist-head`. *Rejected:*
   folding Add song and Play into a ⋯ menu on a phone (hides the editor's
   main actions, a behaviour change); letting the bar keep wrapping item by
   item (what produced Save alone and "M.").
3. **No new board for the phone editor.** It is W12's computer bar in the same
   order, wrapped; DIRECTION and workflow 12 already say what it holds.
4. **Note flexes, Key stays 64 px.** The key is two or three characters and
   must read whole; the note is free text and is the field that can give.
5. **Wrap `.section-label` in the theme**, not only in the setlist, for the
   same reason narrow_fit fixed `.notice` once: every section label with a
   caption has the same failure, and wrapping is a no-op where it fits.
6. **Hide the native cancel only in `.search`.** *Rejected:* a global
   `input[type=search]` rule (would leave the setlist in-book picker with no
   clear control); `type="text"` on the input (loses the `searchbox` role the
   journeys and screen readers use).
7. **390 px via `setViewportSize` on the phone project**, not a new Playwright
   project: one spec needs it, `header.spec.js` set the precedent, and a new
   project would run the whole suite again. "All themes" is the two colour
   schemes; density is not in the note and is already covered by
   `account-layout.spec.js`.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- Add a book sheet: the Mine row is border-box and fits inside the sheet (app/src/books/books.css).
- Neck and Hand tiles read whole, "Selected" moves under the name when narrow (app/src/account/account.css); `.section-label` wraps (app/src/theme/theme.css).
- Setlist editor bar is a head group and an actions group that wrap as a unit with Save last; book name under the title; Note fills the second line on a phone (app/src/books/SetlistView.jsx, app/src/books/setlist.css).
- Search shows only the app's ✕ clear button (app/src/songs/search.css).
- Behavior cases in BooksScreen, AccountScreen, SetlistView and SearchScreen `.behavior.test.jsx`.
- e2e-web: e2e/web/tests/narrow-fixes.spec.js (four states, 412 and 390 px, both colour schemes, expectFits + axe); `openAddABook` split out in e2e/web/lib/journeys.js.
- Deviations: the badge and Save cannot share a row at 390/412 px in the required order, so the e2e checks the badge shares a row with another action and Save is last; the native cancel's display is read over CDP.

