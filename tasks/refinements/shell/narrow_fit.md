# shell.narrow_fit — Nothing clipped, overflowing or wrapped word by word at phone and tablet widths

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 120–125, task
`shell.narrow_fit` ("Nothing clipped, overflowing or wrapped word by word at
phone and tablet widths"), under `task shell`. It `depends !layout` and sits in
the polish milestone `milestones.m5_complete` (`tasks/99-milestones.tji` line
44). The note, verbatim:

> Fit defects the UI audit found: the search field breaks onto two lines (typed
> text, then the clear control) on phone and computer (W01, W02); the reading
> view notice wraps one word per line on a phone (W02); two first-run row
> descriptions end in an ellipsis (W01); the explorer title truncates and the
> chip clips at tablet width (W16); the raw editor toolbar overflows with Save
> clipped on a phone (W14); the version view title truncates (W06); the reading
> toolbar clips Print on a tablet (W12); the raw Markdown pane clips long lines
> with no horizontal scroll (W12). Fix each at its component, and add an e2e
> check that no visible control overflows the viewport on each surface. Source:
> UI audit 2026-10-14 (app screens vs rendered boards; e2e/web/lib/mockup.js).
> Tests: e2e-web (each listed surface on the three viewports: no element wider
> than the viewport, controls fully visible; axe). Also (pairwise audit): the
> Leaving Estante region overflows the right edge on a phone (W17).

## Effort estimate

**2 days** (from the `.tji`). Nine small, local CSS (and in two places
markup) fixes; one breakpoint constant and its use in the reading toolbar; a
shared e2e geometry helper; one e2e-web spec visiting ten states on three
viewports; one behavior test for the reading toolbar's collapse.

## Repository

**estante-de-cifras only** — `app/src/` (`theme/theme.css`, `songs/`,
`music/`, `instruments/`, `editor/`, `books/`, `account/`, `shell/`) and the
e2e-web harness (`e2e/web/lib/`, `e2e/web/tests/`). Not format work; the note
does not start with `cifra.md:`. Nothing touches the service, the API or
cifra.md.

**No design delta.** Every fix brings the app to what the boards already draw
(Decisions 1–9); no workflow or DIRECTION section says otherwise.

## Inherited dependencies

**Settled (all `complete 100`):** `shell.layout` (the 600px narrow/wide
switch, `app/src/shell/layout-mode.js:22`), and — for driving the states the
spec visits — `account.first_run`, `songs.search`, `songs.reading`,
`music.explorer`, `music.instruments`, `songs.editor`, `songs.history`,
`books.file_view`, `books.setlists`, `account.sign_in`, `account.leaving`,
`shell.full_height` (the frame these fits sit in) and `shell.header_chrome`
(the header chip and wordmark, `app/src/shell/HeaderChrome.jsx`).

**Pending: none** that this task waits on. Sibling M5 polish leaves touch the
same chrome later and must keep this task's checks green — they are not
predecessors: `songs.reading_chrome` (moves every reading action into the ⋯
menu, as the boards draw), `songs.editor_chrome` (the editor header title and
unsaved strip), `songs.history_phone_actions` (the version's action bar pinned
on a phone).

## What this task is

Fix ten fit defects the 2026-10-14 UI audit found where the app, at the phone
(Pixel 7, 412px), tablet (Galaxy Tab S4, 712px) or computer (1280px) width,
clips a control, overflows the viewport, ellipsizes a short label the boards
draw whole, or squeezes a sentence to one word per line — each at the
component that causes it — and land a shared e2e geometry check that says, on
each of those surfaces and viewports, that no visible element is wider than
the viewport, every visible control is fully visible, and the named texts are
neither ellipsized nor squeezed.

## Why it needs to be done

The boards (`docs/mockups/W01…W17`) are what the workflows decided, drawn at
these widths; DIRECTION §4 puts the app on phone, tablet and computer alike.
A clipped Save or Print is an action the user cannot reach; a notice wrapped
one word per line is unreadable; a page that scrolls sideways breaks the fixed
frame `shell.full_height` established. Nothing in the e2e suite checks
horizontal fit generically — only local checks in `chart.spec.js:39-47`,
`header.spec.js:28-60` and `portal.spec.js:44-54` — which is why these
shipped. The helper this task adds is what later chrome tasks
(`songs.reading_chrome`, `songs.editor_chrome`, …) reuse to keep the fit.

## Inputs / context

Governing documents:

- DIRECTION §4 (the interface: one app on phone, tablet and computer) and §3.7.
- Boards: `docs/mockups/W01-first-run.dc.html`, `W02-find-and-play.dc.html`
  (the reading appbar on a tablet, lines 109–115: Back, title, Edit, ⋯; on a
  computer, lines 172–178: Edit, History, Add to setlist, Print, Share),
  `W06-history.dc.html` (version title "Rua do Porto · 20 Sep" with the
  unsaved badge and both actions on a tablet, lines 105–110),
  `W12-setlists.dc.html`, `W14-file-view.dc.html` (phone raw editor, lines
  66–86: Save always in reach), `W16-chord-explorer.dc.html` (title "Explore
  a chord" whole, chip "Cavaquinho" whole, lines 84–88), `W17-leaving.dc.html`.
- `docs/mockups/theme.css:140,152,176,192-193,205` — the drawings' nowrap /
  ellipsis rules; the app's copy is `app/src/theme/theme.css` (imported at
  `app/src/App.jsx:2`): `.appbar .title` L289, `.btn` L301, `.field` (column)
  L307, `.chip` L325, `.row .name/.meta` L342-343, `.notice` L351, `.notice .act`
  L355, `.editor .ln` (`white-space: pre`) L428, `.scroll`/`.pane`
  (`overflow: hidden`) L291/L293.
- Predecessor refinements: `tasks/refinements/shell/full_height.md` (one
  surface per `test`, real-UI journeys, a generic geometry helper in `lib/`,
  never `overflow: hidden` to make an overflow check pass — L162-167, Decision
  6; horizontal overflow explicitly left to this task), `header_chrome.md`
  (`expectUnclipped`, "ellipsis as a last resort, never the normal case"
  L233-234), `layout.md` (the 600px breakpoint, L438).

The defects, with their causes as found in the source:

1. **Search field (W01, W02).** `app/src/songs/SearchScreen.jsx:532-557`: a
   RAC `SearchField className="field"` holding the `Input` and the
   `Button.field-x` "Clear search". The theme's `.field { flex-direction:
   column }` (`theme.css:307`) also matches it; `.search .field`
   (`songs/search.css` ~L47-53) never resets the direction, so the input and ✕
   stack.
2. **Reading notices (W02 phone).** `app/src/songs/SongReading.jsx`: the
   no-voicings notice (L613-620 wide, L654-661 narrow; copy
   `i18n/locales/en.js:1412-1414`, "Nobody has chosen shapes for {instrument}
   in this song yet. …" + "Arrange for {instrument}"), the update notice
   (L533-550) and the instrument prompt (L509-523). `.notice` is a flex row
   with no wrap (`theme.css:351`) and its `.act`/`.btn` are nowrap
   (L355, L301); the text span has no flex basis, so a long action squeezes it
   to min-content — one word per line. The explorer's flip notice
   (`music/ChordExplorer.jsx:179-193`) has the same shape.
3. **First-run descriptions (W01).** `app/src/songs/FirstRun.jsx:109-157`,
   copy `en.js:577-591` (e.g. "Songs that come with the app, put on your
   shelf; remove it any time", "Bring back your shelf from another device");
   `.row .meta` is nowrap + ellipsis (`theme.css:343`) and at ≥600px
   `.first-run-ways` is a two-column grid (`songs/search.css:240-245`).
4. **Explorer title and chip (W16 tablet).** `music/ChordExplorer.jsx:256-262`
   (`span.title` "Explore a chord", ellipsis from `theme.css:289`); the chip
   (`instruments/InstrumentChip.jsx:36-43`, `instruments/instruments.css:16-20`)
   sits in the 340px side pane's `HeaderChrome` row (`shell/shell.css:95-108`:
   the wordmark `flex: 1 0 auto` never shrinks, the chip `min-width: 0` does,
   and clips).
5. **Raw editor toolbar (W14 phone).** `editor/SongEditor.jsx:414-435`
   `.est-editor-bar`: Text/Preview `seg`, spacer, "Add section", "Save"
   (primary); `editor/editor.css:17-25` is a non-wrapping flex row of nowrap
   buttons, so at 412px Save is pushed past the edge. Reached from the file
   view (`files/RawEditorHost.jsx:27-44`) and from Edit / new song.
6. **Version view title (W06).** `songs/SongHistory.jsx:530-531` (computer),
   556-569 (tablet: back, title, unsaved badge, "Compare with now", "Restore
   this version"); `songs/song-history.css:17-19`; the nowrap buttons take the
   row and the title ellipsizes.
7. **Reading toolbar (W12 tablet).** `songs/SongReading.jsx:579-603` — the
   wide appbar carries Back, title, Edit, History, Add to setlist, Print
   (L594-596), Share and ⋯ in one non-wrapping row; at 712px Print and Share
   fall off. The narrow toolbar (L630-646) already holds History / Add to
   setlist / Print / Share in the ⋯ menu.
8. **Raw Markdown pane (W12).** `books/SetlistView.jsx:447-458`
   `.pane.side.setlist-side > .scroll > div.editor.setlist-raw` with one
   `div.ln` per line, `white-space: pre`; `books/setlist.css:143-160` gives the
   `.scroll` `overflow-y: auto` only, and the theme's `overflow: hidden`
   (`theme.css:291`) clips horizontally. (The file view's CodeMirror,
   `editor/editor.css:78-99`, already scrolls sideways.)
9. **Leaving Estante (W17 phone).** `account/LeaveDialogs.jsx:260-268`
   `.account-card.account-leave-card` (copy `en.js:788-791`);
   `account/account.css:26-32` (`width: 100%; max-width: 360px`) and
   313-336 (the card's border and padding), with `.btn.block` (`width: 100%`,
   nowrap). The card overflows the right edge on a phone.

e2e harness: projects in `e2e/web/playwright.config.js:38-42`; the axe
fixture `e2e/web/lib/axe.js:38-52` (`checkA11y`); real-UI journeys in
`e2e/web/lib/journeys.js` (`startApp`, `openExampleBook`, `gotoTab`,
`openSongFromSearch`, `editFromReading`, `openFiles`, `openFileInFiles`,
`signedInDevice`, `historyFromReading`), `journeys-core.js` (`SONG`,
`addInstrument`, `closeInstruments`, `openExplorerFor`, `chip`),
`journeys-edit.js` (`buildHistory`, `openHistory`, `openFirstVersion`),
`journeys-files.js` (`EXAMPLE_BOOK`, `addToNewSetlist`, `openSetlist`),
`journeys-account.js` (`openAccount`). The vertical-frame precedent is
`e2e/web/lib/scroll.js` and `e2e/web/tests/full-height.spec.js`. The
no-voicings notice is reached through the real UI exactly as
`e2e/web/tests/explorer.spec.js:133,150-153` does (add *My Drop D*, open the
song).

## Constraints / requirements

- **Fix each at its component** (the note). A fix to a shared theme class
  (`.notice`, `.field`-in-search) is a fix at that component, and must not
  change any other surface's drawn appearance at the board widths.
- **Never make a fit check pass by clipping.** No `overflow: hidden` or
  `overflow-x: hidden` added on `.est`, `body`, a pane or a bar to hide what
  overflows (full_height.md L162-164); content that is genuinely wider than
  its pane (raw source lines) scrolls sideways in its own container.
- **Ellipsis is a last resort** (header_chrome.md L233-234): the labels the
  boards draw whole at these widths — the search input beside ✕, the
  first-run descriptions, "Explore a chord", the chip, the version title of
  the fixture song — must render whole. Ellipsis stays legitimate for
  user-length strings (a long song title, a commit note) beyond what the
  boards draw.
- **Accessibility.** Every interactive part stays a React Aria Component;
  actions moved into the ⋯ menu are RAC `MenuItem`s reachable by keyboard; a
  horizontally scrolling pane is keyboard-scrollable (`tabIndex=0`, a name —
  axe's `scrollable-region-focusable`); axe WCAG 2.1 AA clean on every visited
  state; no text conveyed by colour.
- **The view is the only layer that knows React** (DIRECTION §3.7); this task
  touches no Worker, storage or sync code.
- **No song text in logs; fixtures are songs written for the purpose** (the
  bundled example book, the authored long-line song) — never someone else's
  words.
- e2e-web only through the real UI (`e2e/web/eslint.config.js`): no `#dev/*`,
  no `addInstrument`-style state injection by script, no network mocking, no
  synthetic events, no API writes.

## Acceptance criteria

### Behavior delivered

1. **Search field.** On every viewport the input and the "Clear search" ✕ sit
   on one row, ✕ to the right of the typed text, inside the search group
   (`.search .field` lays out as a row; the RAC `SearchField` keeps its role
   and labels).
2. **Notices.** A `.notice`'s text takes the row and its action wraps beneath
   it when both do not fit (`theme.css` `.notice` wraps; the text span gets a
   flex basis and `min-width: 0`); on a phone the no-voicings notice, the
   instrument prompt and the update notice read as sentences, never one word
   per line, and the action stays fully visible.
3. **First-run.** The ways-in descriptions wrap onto a second line rather
   than ellipsize, on every viewport (`.first-run-ways .meta` wraps; names
   stay single-line).
4. **Explorer.** "Explore a chord" is whole on every viewport; the chip in
   the side pane's header row on a tablet/computer and in the appbar on a
   phone shows its short label whole, inside the viewport, overlapping
   neither the wordmark nor the account button (the wordmark may shrink before
   the chip clips; the chip's ellipsis stays a last resort for a long custom
   name).
5. **Raw editor toolbar.** On a phone, Save and Add section are fully visible
   in the editor bar — the bar wraps the actions onto a second row as a unit
   (Save last, right-aligned) when the Text/Preview switch and both actions
   do not fit — from the file view, Edit and a new song alike.
6. **Version view.** On a tablet and a computer the version's title is whole
   for the fixture song; the actions wrap onto a second appbar row when title,
   badge and actions do not fit together. (The phone's pinned action bar is
   `songs.history_phone_actions`.)
7. **Reading toolbar.** Below a new `READING_ACTIONS_WIDE_QUERY`
   (`(min-width: 1080px)`, beside `WIDE_QUERY` in
   `app/src/shell/layout-mode.js`), the wide reading appbar shows Back, the
   title, Edit and ⋯, with History, Add to setlist, Print and Share as ⋯ menu
   items — the arrangement the narrow toolbar and the W02 tablet frame
   already use; at and above it, the full row as the W02 computer frame draws.
   No action is lost on any width. E2e journeys that click those buttons on
   a tablet go through the menu (`historyFromReading` already does; the
   setlist journeys in `journeys-files.js` get the same either-or).
8. **Raw Markdown pane.** The setlist's raw pane scrolls sideways inside its
   own container (`overflow-x: auto` on the pane's scroller, keyboard
   focusable with an accessible name), so a long line is readable to its last
   character and nothing outside the pane moves.
9. **Leaving Estante.** On a phone the region and its two buttons lie inside
   the viewport (the card sizes with `box-sizing: border-box` and its buttons
   may wrap their label), as W17 draws.
10. **No sideways page.** On each surface above, the document never scrolls
    horizontally.

### Tests, by level

- **e2e-web — `e2e/web/lib/fit.js`** (new shared helper, the horizontal twin
  of `lib/scroll.js`): `expectFits(page, { whole = [], sentences = [] })`
  asserts on the current state:
  - the document has no horizontal overflow
    (`scrollingElement.scrollWidth - clientWidth <= 1`);
  - **no element wider than the viewport:** every visible element (box
    non-empty, not `visibility: hidden`, not `.visually-hidden`), unless it is
    inside an ancestor that scrolls horizontally (`overflow-x: auto|scroll`),
    lies within `[0, innerWidth]` (1px tolerance);
  - **controls fully visible:** every visible `button`, `a[href]`, `input`,
    `textarea`, `select` and `[role=button|menuitem|tab|radio|checkbox|switch]`
    lies within the viewport and within every clipping ancestor
    (`overflow` ≠ `visible`) that does not itself scroll in that axis;
  - each `whole` locator is not ellipsized (`scrollWidth <= clientWidth`);
  - each `sentences` locator is not squeezed: its width is at least 60% of
    its parent's content width (so a sentence never collapses to one word per
    line).
  The failure message names the offending element (tag, classes, accessible
  name, box). Pins DIRECTION §4 and the note's "no element wider than the
  viewport, controls fully visible".
- **e2e-web — `e2e/web/tests/narrow-fit.spec.js`**, on the phone, tablet and
  computer projects, `test`/`expect` from `../lib/axe.js`, one `test` per
  state, each ending in `expectFits` and `checkA11y()`:
  1. *the search field* — `startApp`, `openExampleBook`, `gotoTab('Search')`,
     type "Morning"; the input and "Clear search" share a row (their vertical
     centres within half the input's height, ✕ to the right); `whole`: the
     input. Pins W01, W02 search frames.
  2. *first run* — a fresh `startApp`; `whole`: each ways-in description
     (the `.meta` texts of `en.js:577-591`). Pins W01#1.
  3. *the reading notices* — fresh profile, `openExampleBook`, open the first
     song: the instrument prompt ("Playing on guitar…") as a `sentences`
     target; then `addInstrument({ tuning: 'Drop D', name: 'My Drop D' })`,
     `closeInstruments`, reopen `SONG`: the "Nobody has chosen shapes for My
     Drop D…" text as a `sentences` target, "Arrange for My Drop D" fully
     visible (the generic control check). Pins W02 phone, workflow 2.
  4. *the explorer* — `openExplorerFor(page, 'A')`; `whole`: the "Explore a
     chord" title and the header chip; the chip's box overlaps neither the
     wordmark nor the Account button where they share a row. Pins W16#1-2.
  5. *the raw editor, from the file view* — `openFiles(EXAMPLE_BOOK)`,
     `openFileInFiles(… 'morning-on-the-porch.cifra.md')`; Save and Add
     section fully visible (control check, plus an explicit
     `toBeInViewport()` on Save). Pins W14#2.
  6. *the raw editor, from Edit* — `openSongFromSearch` + `editFromReading`;
     same assertions. Pins W04 phone toolbar.
  7. *the version view* — `buildHistory(page, ['Coda'])`, `openHistory`,
     `openFirstVersion`; `whole`: the version title on tablet and computer
     (on the phone, the generic checks only — its title and bar are
     `songs.history_phone_actions`). Pins W06#2, W06#4.
  8. *the reading toolbar* — `openSongFromSearch(SONG)`; every visible action
     fully visible; on the computer, the Print button visible in the appbar;
     on phone and tablet, ⋯ opened shows a "Print" menu item (not activated —
     no print dialog), then Escape. Pins W02#2-4, W12 tablet.
  9. *the setlist raw pane* — `addToNewSetlist` with a setlist named for the
     purpose long enough to overflow the pane ("A setlist with a name long
     enough to run past the edge of the raw pane"), `openSetlist`; on the
     wide layouts (tablet, computer) the raw pane's scroller has
     `scrollWidth > clientWidth`, setting its `scrollLeft` to the end moves
     it and brings the long line's end into the pane; on the phone (where the
     raw pane is not shown) the generic checks only. Pins W12#4 side pane.
  10. *Leaving Estante* — `signedInDevice`, `openAccount`, the "Leaving
      Estante" region scrolled into view; its card and both buttons inside
      the viewport. Pins W17#1.
- **behavior — `app/src/songs/SongReading.behavior.test.jsx`** (existing; extended): with
  `matchMedia` answering wide but not `READING_ACTIONS_WIDE_QUERY`, the
  appbar holds Edit and ⋯ only, and ⋯ opened by keyboard lists History, Add
  to setlist, Print and Share as menu items; with both matching, the four are
  appbar buttons; axe clean on both. Pins item 7 and workflow 2's actions.
- **unit — `app/src/shell/layout-mode.test.js`** (existing): add a case that
  `READING_ACTIONS_WIDE_QUERY` is a min-width query wider than `WIDE_QUERY`.

No test level the note names is dropped (e2e-web, with axe, on the three
viewports). No test is deferred. No deferred WBS leaf.

## Decisions

1. **Search field: reset the direction at `.search .field`, not the theme's
   `.field`.** *Rationale:* `.field` is the label-over-input form pattern used
   across the app; only the search composite is a row. *Rejected:* renaming
   the RAC `SearchField`'s class (loses the shared field styling) or changing
   `.field` globally (breaks every form).
2. **Notices: let `.notice` wrap in the theme, with a flex basis on its text.**
   *Rationale:* the defect is the notice pattern's, and it recurs in reading,
   the editor and the explorer; one rule fixes every instance, and at board
   widths, where text and action fit, nothing changes. *Rejected:* per-notice
   overrides (three copies of the same fix, the next notice inherits the bug);
   shortening the copy (the workflow's words; translations grow anyway).
3. **First-run descriptions wrap rather than ellipsize, or drop the two-column
   grid.** *Rationale:* the boards draw the full sentence; wrapping keeps the
   grid the layout chose and survives longer translations. *Rejected:*
   one-column ways-in at ≥600px (departs from the drawn tablet layout).
4. **Explorer chip: the wordmark yields before the chip.** The header row's
   wordmark may shrink (`flex: 0 1 auto; min-width: 0`) and the chip keeps its
   content width; the chip's ellipsis applies to its text in an inner span so
   it actually renders. *Rationale:* the chip is an action, the wordmark is
   brand; header_chrome's last-resort rule. *Rejected:* widening the 340px
   side pane (moves every wide layout).
5. **Editor toolbar wraps its actions as a unit.** *Rationale:* Save must be in
   reach (W14#2, W04); wrapping is local and keeps Text/Preview and both
   actions as they are. *Rejected:* moving Save to a bottom bar as W14#2 draws
   with Discard — that is the editor host's redesign, `songs.editor_chrome`'s
   scope; icon-only Add section (a label the workflows name in words).
6. **Version view: actions wrap below the title.** *Rationale:* W06 tablet
   draws title, badge and both actions; at the app's 712px they do not fit in
   one row, and a second row keeps every word whole. *Rejected:* moving the
   actions to a footer on a tablet (the phone's arrangement,
   `songs.history_phone_actions`, not what W06 draws for a tablet).
7. **Reading toolbar collapses into ⋯ below 1080px, via a named query in
   `layout-mode.js`.** *Rationale:* the W02 tablet frame already draws Edit + ⋯
   and the narrow toolbar already has the menu, so this reuses an existing
   arrangement and is a step toward `songs.reading_chrome` (everything in
   ⋯), not a detour; a named query beside `WIDE_QUERY`/`BOOKS_WIDE_QUERY`
   follows the established seam; 1080px is the smallest width at which the
   full row fits at the computer's type size (the Galaxy Tab S4 at 712px is
   well below, Desktop Chrome at 1280px above). *Rejected:* measuring overflow
   with a ResizeObserver and moving buttons dynamically (more code, flicker,
   hard to test); a CSS container query hiding buttons (the menu renders in a
   portal outside the container, so it cannot show the matching items);
   wrapping the appbar onto two rows (W02 draws one row).
8. **Raw pane scrolls sideways; lines do not soft-wrap.** *Rationale:* it shows
   the file as it is — the raw source is monospaced (mockups README L24) and a
   wrapped line would misrepresent where lines break; CodeMirror in the file
   view already scrolls sideways, so the two raw views agree. *Rejected:*
   `white-space: pre-wrap` (hides the line structure the pane exists to show).
9. **Leaving Estante: fix the card's box model, let block buttons wrap their
   label.** *Rationale:* the card is `width: 100%` plus border and padding; a
   block button is full-width by design and its label should wrap in a
   narrow column rather than overflow. *Rejected:* `overflow: hidden` on the
   account screen (forbidden by the constraint above).
10. **One generic helper (`lib/fit.js`), not per-surface selectors.**
    *Rationale:* full_height's Decision 6 — pin the behavior, not which class
    carries it, so later chrome tasks reuse the same check. The "inside a
    horizontal scroller" exemption is what lets a raw pane or the explorer's
    phone shape row (workflow 16 L149-156, a horizontally-scrollable row)
    scroll legitimately. *Rejected:* folding horizontal checks into
    `scroll.js` (one helper per axis reads clearer and keeps full_height's
    spec untouched).
11. **A behavior test beyond the note's e2e-web.** The reading toolbar's
    collapse is a logic change (which actions render where by width), cheap
    to pin in-process with keyboard access to the menu; the other fixes are
    pure layout, which only a real browser computes, so they are e2e-only.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-15.

- Search field, notices, first-run descriptions, explorer header, version appbar and Leaving Estante card fit at phone and tablet widths: `app/src/theme/theme.css`, `app/src/songs/{search,reading,song-history}.css`, `app/src/songs/{SongReading,SongHistory}.jsx`, `app/src/music/{ChordExplorer.jsx,music.css}`, `app/src/account/account.css`, `app/src/instruments/{InstrumentChip.jsx,instruments.css}`, `app/src/shell/shell.css`.
- Raw editor bar wraps its actions as a unit: `app/src/editor/{SongEditor.jsx,editor.css}`.
- The reading toolbar folds History, Add to setlist, Print and Share into ⋯ below the new `READING_ACTIONS_WIDE_QUERY` (1080px): `app/src/shell/layout-mode.js`, `app/src/songs/SongReading.jsx`.
- The setlist raw pane scrolls sideways inside itself (focusable, named by the file name), and a long file name wraps: `app/src/books/{SetlistView.jsx,setlist.css}`.
- Unit: `app/src/shell/layout-mode.test.js`. Behavior: `app/src/songs/SongReading.behavior.test.jsx` (tablet ⋯ menu, Print from ⋯, computer four buttons, axe on both).
- E2e-web: the shared helper `e2e/web/lib/fit.js` and `e2e/web/tests/narrow-fit.spec.js` (10 states × phone/tablet/computer, each ending in `expectFits` and axe); the history/share/read-in-place journeys use ⋯ when the appbar lacks the buttons (`e2e/web/lib/journeys-sync.js`, `e2e/web/tests/{share,read-in-place}.spec.js`).
- Note: the explorer, both raw-editor states and Leaving Estante passed the spec even without the fixes at 412/712/1280px; the fixes are in place but the spec does not reproduce the audit's defect there.
