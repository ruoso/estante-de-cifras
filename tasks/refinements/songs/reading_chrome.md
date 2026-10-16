# songs.reading_chrome — The reading view chrome as drawn

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) — `songs.reading_chrome`, lines 106-111:

> The W01, W02 and W12 boards put the instrument chip, Transpose and a ... menu
> in the reading header, with the shapes in a bordered SHAPES · <instrument>
> card; the app puts Edit, History, Add to setlist and Print in the header and
> the chip and Transpose in the body, and the shapes panel has no card or
> subtitle. Follow the boards (the menu holds Edit, History, Add to setlist,
> Print, Share), keeping every action keyboard-reachable. Source: UI audit
> 2026-10-14 (app screens vs rendered boards; e2e/web/lib/mockup.js). Tests:
> behavior (each action reachable from the menu, axe); e2e-web (reading on the
> three viewports, mockup W01#3, W02#2-4, W12#3).

Milestone: M5 (`tasks/99-milestones.tji:44`).

## Effort estimate

1d.

## Repository

The app only — not under `cifra.md/`:

- `app/src/songs/SongReading.jsx`, `app/src/songs/reading.css` — the header,
  the ⋯ menu, the tablet layout, the shapes card.
- `app/src/i18n/locales/{en,es-419,it,pt-BR}.js` — one new `reading.*` key.
- `app/src/songs/SongReading.behavior.test.jsx` — behavior tests.
- `e2e/web/tests/reading.spec.js`, `e2e/web/tests/header.spec.js` — e2e-web.

No design delta: the W01, W02 and W12 boards already decide this (see
Decisions for how the per-viewport frames are read).

## Inherited dependencies

Settled:

- `songs.reading` (complete) — `SongReading.jsx`, its props as seams
  (`onEdit`, `onOpenHistory`, `onAddToSetlist`, `onShare`, `onArrange`), the
  transpose popover, full screen, the print stylesheet
  (`tasks/refinements/songs/reading.md` AC3-AC5, Decision 6).
- `songs.edit_in_place` (complete) — the reading update notice and the
  `onOpenHistory` seam this task must keep working
  (`tasks/refinements/songs/edit_in_place.md` D6).
- Also landed and to be kept green, though not in `depends`:
  `shell.header_chrome` (the chip, `HeaderChrome`, one chip per screen —
  `tasks/refinements/shell/header_chrome.md` AC5, Decision 7),
  `shell.narrow_fit` (`READING_ACTIONS_WIDE_QUERY`, `e2e/web/lib/fit.js`,
  `narrow-fit.spec.js` state 8 — `tasks/refinements/shell/narrow_fit.md`
  AC7, Decision 7), `books.share` (Share on a song opens `SharingScreen` with
  the song's address), `books.setlists` (the Add to setlist dialog).

Pending, and not this task's: `songs.transpose_chrome` (the one transposed
row naming the key — W02#4), `songs.show_the_file` (a *Show the file* action,
which will join this task's ⋯ menu).

## What this task is

Rearrange the reading view's chrome to what the boards draw on each device,
without adding or removing any action:

- **Phone** (W02#2): Back · title · Transpose (icon) · ⋯ in the app bar; the
  chip and *Key of G* under the title; Arrange · Edit · **Full screen** in
  the bottom bar; a plain *Shapes* heading over the shapes. This is already
  what the app draws; the phone's only change is the menu's contents.
- **Tablet** (W01#3, W02#3, W12#3): the song takes the whole pane — no search
  rail beside it. The app bar is Back · title · **instrument chip** ·
  **Transpose** (labelled) · Edit · ⋯. The shapes sit beside the chart in a
  bordered card headed *SHAPES · GUITAR*.
- **Computer** (W02#4): search beside the song, its rail head carrying the
  wordmark and the chip (unchanged); the app bar's full row Edit · History ·
  Add to setlist · Print · Share; Transpose at the head of the row under the
  title (where W02#4 draws the transposed state); the shapes a column beside
  the chart headed *SHAPES · GUITAR* (*SHAPES IN A* while transposed).
- **The ⋯ menu is the same on every device**: Edit, History, Add to setlist,
  Print, Share, then *Arrange for {instrument}* (not while transposed) and
  *Full screen*. The buttons a device can afford beside it are shortcuts to
  items the menu also holds.

## Why it needs to be done

The 2026-10-14 UI audit (rendered boards against `mockup()` screenshots from
the e2e run) found the reading view off its boards on the tablet and in the
menu: the chip in a search rail the tablet board does not draw, Transpose in
the body, the shapes wrapping below the chart with no card, and a menu whose
contents change with width. The reading view is the screen people spend the
most time on (workflow 2); M5 is the milestone that brings the app's screens
to their boards. `songs.show_the_file` adds its action to the menu this task
settles.

## Inputs / context

Governing documents:

- `docs/workflows/02-find-and-play.md` L71-72 (opening a result shows the
  song), L86-87 ("From the reading view the song can be edited (workflow 4),
  its history opened (workflow 6), transposed (below), and printed"),
  L101-103 (shapes marked by a word; on paper they print alike), L112-151
  (transposing; L150-151 printing and a link carry the transposition).
- `docs/workflows/15-set-up-an-instrument.md` L62-75 — the chip in the header
  everywhere, one short label, the full identity as its description.
- `docs/workflows/12-setlists.md` L58-59 — *Add to setlist* is on every song,
  in search and in the reading view.
- `docs/workflows/10-share.md` L150-158 — *Share* on a song shares its book;
  for a member, the song's address. (Unchanged here; the menu item calls the
  existing `onShare`.)
- `docs/workflows/01-first-run.md` L79-86 — the chip; the once-only *Playing
  on guitar — change?* notice (W01#3).

Boards (`docs/mockups/`; frames numbered per `e2e/web/lib/mockup-frames.json`,
#1-2 phone, #3 tablet, #4 computer):

- `W02-find-and-play.dc.html` L63-100 (W02#2 phone): app bar L65-70 (Back,
  title, `aria-label="Transpose"` icon, `aria-label="More"`); chips under the
  title L72-75; `Shapes` heading L86-92, no card; bottom bar L94-98 (Arrange,
  Edit, Full screen primary).
- `W02-find-and-play.dc.html` L104-144 (W02#3 tablet): app bar L109-116 (Back,
  title, chip, `Transpose`, `Edit`, More); no side rail; the chart and a
  `card pad` 230px wide side by side (L119, L130-139), headed
  `Shapes · cavaquinho`, a two-column grid of diagrams, the caption under.
- `W02-find-and-play.dc.html` L146-213 (W02#4 computer): the side pane with
  wordmark and chip (L153); app bar L172-179 (title, Edit, History, Add to
  setlist, Print, Share); the transposed row L181-186; shapes column
  L198-207, 300px, no card, headed `Shapes in A`.
- `W01-first-run.dc.html` L91-139 (W01#3 tablet): app bar L96-102 (Back,
  title, chip, `Transpose`, More); the instrument notice L104-108; shapes
  card L124-134 headed `Shapes · guitar`.
- `W12-setlists.dc.html` L106-154 (W12#3 tablet): app bar L111-118 (title,
  chip, `Transpose`, `Add to setlist`, More); the Add to setlist dialog over
  it.
- `docs/mockups/theme.css` L133 (`.t-h3` uppercase — the board's
  *SHAPES · GUITAR*), L186-187 (`.card`, `.card.pad`).

Code:

- `app/src/songs/SongReading.jsx`
  - L131-143 props; L156 `actionsInline` (`READING_ACTIONS_WIDE_QUERY`);
  - L342-354 the transposed status row; L358 the Transpose variant (icon on
    narrow, labelled on wide); L363-396 `transposeControl`;
  - L428-438 the shapes caption and heading (`reading.shapes`,
    `reading.shapesInKey`); L440-465 the sheet and the
    `section.reading-shapes` (aria-label = the heading);
  - L493-515 `moreMenu(extra)` — RAC `MenuTrigger` › `Button.btn.icon`
    `aria-label="More"` › `Popover` › `Menu.menu`, `onAction` by key
    (`history`, `addToSetlist`, `print` → `window.print()`, `share`,
    `arrange`, `fullScreen`) — there is no `edit` key yet;
  - L574-586 the meta row (byline, chip on narrow only, *Key of*, Transpose
    on wide only, variation picker);
  - L588-658 the wide branch: `.split.reading-split`, `.pane.side.reading-side`
    with `HeaderChrome className="rail-head"` (L597) and `SearchScreen`, the
    appbar L601-643 (Edit; the four inline when `actionsInline`, else in ⋯);
  - L670-712 the narrow branch: appbar (Back, title, Transpose icon, ⋯ with
    the four) and the bottom bar (Arrange, Edit, Full screen).
- `app/src/songs/reading.css` L84-107 (the wide split; the shapes 300px,
  wrapping below the chart on the tablet), L170-190 (print hides
  `.reading-chrome`, `.reading-meta`).
- `app/src/shell/layout-mode.js` L22 (`WIDE_QUERY` 600px), L38-44
  (`READING_ACTIONS_WIDE_QUERY` 1080px).
- `app/src/shell/AppShell.jsx` L967-1007 — the open song replaces the shell;
  the seams wired to editor, history, `SharingScreen`, `AddToSetlist`.
- `app/src/instruments/InstrumentChip.jsx` L29 — the chip
  (`instr.chip.change`, "Guitar, change instrument"); `chipLabel` in
  `app/src/instruments/instrument-helpers.js`.
- `app/src/i18n/locales/en.js` L1386-1429 (`reading.*`: `shapes`,
  `shapesInKey`, `edit`, `history`, `addToSetlist`, `print`, `share`, `more`,
  `fullScreen`).

Tests today:

- `app/src/songs/SongReading.behavior.test.jsx` L206-221 (region *Shapes*),
  L356-368 (⋯ › Add to setlist / Share), L595-655 (the toolbar collapse:
  tablet ⋯ lists the four; computer four buttons, **not** in the menu),
  L659-687 (header chrome: wide chip in the rail head, narrow in the meta
  row).
- `e2e/web/tests/reading.spec.js` L18-56 (L37-41: searchbox beside the song on
  tablet and computer; L42 `mockup W02#2`; L46-51 Full screen via ⋯ on wide),
  L58-73 (L66 `mockup W02#4`).
- `e2e/web/tests/header.spec.js` L105-120 (tablet and computer: the chip in
  `.reading-side .rail-head`; L120 `mockup W02#4`).
- `e2e/web/tests/narrow-fit.spec.js` L154-175 (Print a button on computer, a
  ⋯ item on phone and tablet).
- Existing frame captures: `first-run.spec.js:105` (W01#3),
  `explorer.spec.js:154` (W02#3), `setlists.spec.js:162` (W12#3).
- `e2e/web/lib/mockup.js:45` `mockup(page, board, index, { note })`;
  `e2e/web/lib/fit.js:38` `expectFits(page, { whole, sentences })`;
  journeys reaching History/Share/Full screen "button if visible, else ⋯"
  (`journeys.js` L299-308, `journeys-sync.js` L26-43, `journeys-edit.js`
  L83-88, `share.spec.js` L152-162) keep working unchanged.

## Constraints / requirements

- **The view only.** No Worker, protocol or storage change; transposition,
  variation and full screen keep their seams. Every action keeps its
  existing callback (`onEdit`, `onOpenHistory`, `onAddToSetlist`, `onShare`,
  `onArrange`, `window.print()`, `setFullScreen`) — the menu gains an `edit`
  key calling `onEdit({ bookId, path, title })`.
- **One chip per screen** (header_chrome Decision 7): the tablet app bar
  carries the chip because the tablet loses the rail; the computer keeps the
  chip in the rail head and none in its app bar; the phone keeps it in the
  meta row. Exactly one button named `/change instrument/` on every device.
- **Accessibility.** The menu, its trigger and every button are React Aria
  Components; the ⋯ trigger opens with the keyboard (Enter / Space /
  ArrowDown), its items move with the arrow keys and activate with Enter,
  Escape returns focus to the trigger. The shapes region is named by its
  visible heading (`aria-labelledby`). axe at WCAG 2.1 AA in every state the
  task touches. Shape kinds keep their words (README "Decisions the drawings
  carry" L26).
- **Fits.** The tablet and computer app bars must not clip at the e2e
  viewports (`shell.narrow_fit`'s `expectFits` stays green); the title
  ellipsizes before any button is pushed out.
- **Print unchanged.** The print stylesheet still hides the chrome (the card
  border included — print the shapes, not the card) and keeps the chart and
  the shapes (workflow 2 L101-103).
- **Notices keep their place**: the instrument prompt (W01#3), the update
  notice (edit_in_place D6), the no-voicings notice and the transposed row
  stay first in the scroll, above the chart.

## Acceptance criteria

### Behavior delivered

1. **The menu.** On every device ⋯ (*More*) lists, in order: *Edit*,
   *History*, *Add to setlist*, *Print*, *Share*, *Arrange for {instrument}*
   (absent while transposed), *Full screen*; each calls its existing seam.
   The `actionsInline` condition governs only the inline buttons, never the
   menu's contents.
2. **Phone** (`mode="narrow"`): unchanged layout — Back, title, Transpose
   icon, ⋯; chip and key in the meta row; Arrange, Edit, Full screen in the
   bottom bar; the shapes headed *Shapes*, no card.
3. **Tablet** (`mode="wide"`, below `READING_ACTIONS_WIDE_QUERY`): no search
   rail and no `HeaderChrome`; one pane with the app bar Back · title · chip ·
   Transpose (labelled) · Edit · ⋯; the meta row holds the byline, *Key of*
   and the variation picker (no chip, no Transpose); the chart and the shapes
   side by side, the shapes in a `.card.pad` about 230px wide headed
   *Shapes · {instrument}* (`reading.shapesFor`, the chip's short label),
   the diagrams in two columns, the caption under them.
4. **Computer** (`mode="wide"`, at or above the query): the rail with
   `HeaderChrome` and search beside the song (unchanged); the app bar Back ·
   title · Edit · History · Add to setlist · Print · Share · ⋯; Transpose
   (labelled) at the head of the meta row; the shapes a 300px column beside
   the chart, no card, headed *Shapes · {instrument}*.
5. **Transposed**, every device: the heading reads *Shapes in {key}*
   (`reading.shapesInKey`, W02#4), as today. The transposed row itself is
   `songs.transpose_chrome`'s.
6. New locale key `reading.shapesFor: 'Shapes · {instrument}'` in `en`,
   `es-419`, `it`, `pt-BR`.

### Tests, by level

**behavior** — `app/src/songs/SongReading.behavior.test.jsx`, the toolbar
block (L595-687) reworked, with the existing `installWidths` matchMedia stub:

- *"⋯ holds every action, on phone, tablet and computer"* — for each of the
  three widths: focus *More*, open it with the keyboard, the menu lists the
  seven items in order (six while transposed — no *Arrange for*); arrow to
  each of Edit, History, Add to setlist, Share and press Enter: `onEdit`
  gets `{ bookId, path, title }`, the others `{ bookId, path }`; *Print*
  calls `window.print` (stubbed); Escape returns focus to *More*; axe clean
  with the menu open. *Pins:* the `.tji` note (the menu holds Edit, History,
  Add to setlist, Print, Share; every action keyboard-reachable); workflow 2
  L86-87.
- *"tablet: the chip and Transpose in the app bar, no rail"* — wide below the
  query: no `searchbox`, no `.rail-head`; the app bar holds the button
  *Guitar, change instrument*, *Transpose* and *Edit*; the meta row holds
  neither chip nor Transpose; exactly one `/change instrument/` button; axe.
  *Pins:* W02#3 L109-116, W01#3 L96-102, W12#3 L111-118; workflow 15
  L62-75; header_chrome Decision 7.
- *"computer: the full row, the chip in the rail"* — wide at the query: Edit,
  History, Add to setlist, Print, Share are buttons in the app bar (and also
  menu items); the chip is in `.rail-head` and not in the app bar; Transpose
  in the meta row; axe. *Pins:* W02#4 L153, L172-179. (Replaces L639-650's
  "not in the menu".)
- *"the shapes card on the tablet, a plain section on the phone"* — tablet:
  the region named *Shapes · Guitar* is a `.card`; computer: the same name,
  not a `.card`; phone: the region named *Shapes*, not a `.card`;
  transposed (any width): named *Shapes in {key}*. *Pins:* W02#3 L130-139,
  W01#3 L124-134, W02#4 L198-207, W02#2 L86-92.
- The existing L206-221 locator moves to the region's new name; L659-687's
  wide case splits into the tablet and computer cases above.

**e2e-web** — on the phone, tablet and computer projects, through the real
UI (`openExampleBook`, `openSongFromSearch`):

- `e2e/web/tests/reading.spec.js`, new test *"the reading chrome as drawn:
  the header, the ⋯ menu and the shapes"*:
  - phone: the app bar has *Transpose* and *More*, the bottom bar *Edit* and
    *Full screen*, the region *Shapes* is visible;
  - tablet: no searchbox; the app bar has *Guitar, change instrument*,
    *Transpose*, *Edit*, *More*; the region `/^Shapes · Guitar/` is beside
    the chart (its box starts right of the chart's right edge) and is a
    `.card`;
  - computer: the rail head has the chip; the app bar has *Edit*,
    *History*, *Add to setlist*, *Print*, *Share*;
  - all three: `expectFits` on the app bar; focus *More*, press Enter, the
    seven items are visible; Escape; then *More* › *History* opens the
    song's history and Back returns to the song; *More* › *Add to setlist*
    opens the dialog headed *Add to setlist*, Cancel closes it (Print and
    Share are not activated here — Print raises the browser dialog, and
    Share is pinned by `share.spec.js` through the same ⋯ fallback);
  - `mockup(page, 'W02-find-and-play', 2)` (phone),
    `mockup(page, 'W02-find-and-play', 3, { note: 'reading chrome, guitar' })`
    (tablet), `mockup(page, 'W02-find-and-play', 4)` (computer), then
    `checkA11y()`.
  *Pins:* W02#2-4, W01#3, W12#3 headers; workflow 2 L86-87; workflow 15
  L62-75.
- `e2e/web/tests/reading.spec.js` L37-41 updated: the searchbox is beside the
  song on the computer only; on phone and tablet there is none.
- `e2e/web/tests/header.spec.js` *"one chip per screen"* (L105-120) updated:
  on the tablet the chip is in the reading app bar (`.reading-chrome`), not
  a rail; on the computer, `.reading-side .rail-head` as now; one chip on
  each.
- The frames the note names keep being captured, now showing the new chrome:
  W01#3 (`first-run.spec.js:105`), W02#2 (`reading.spec.js:42`), W02#3
  (`explorer.spec.js:154`), W02#4 (`reading.spec.js:66`, `header.spec.js:120`),
  W12#3 (`setlists.spec.js:162`). `narrow-fit.spec.js` state 8 stays green
  unchanged (Print a button on computer, a ⋯ item on phone and tablet).

No test level is dropped; nothing is deferred; no new WBS leaf.

## Decisions

1. **The tablet reads the song on the whole pane, without the search rail.**
   The three tablet frames (W01#3, W02#3, W12#3) draw no rail, and the chip in
   the app bar; the rail is a computer frame's (W02#4 "search beside the
   song"). With the rail gone the chip moves to the app bar and one chip per
   screen holds, and the 230px card fits beside the chart (today the 340px
   rail pushes the shapes below it, `reading.css` L96-99). The split is
   keyed on `READING_ACTIONS_WIDE_QUERY` (1080px), which `shell.narrow_fit`
   already chose as where the full row fits; reusing it means one
   tablet/computer boundary for the reading view. *Rejected:* keeping the
   rail on the tablet and the chip in its head — the board draws neither,
   and the chip would not be in the header the note asks for; two chips
   (rail and app bar) — breaks header_chrome Decision 7.
2. **One menu, the same everywhere; the inline buttons are shortcuts.** The
   note says the menu holds Edit, History, Add to setlist, Print and Share;
   the boards draw different extra buttons per frame (W02#3 Edit, W12#3 Add
   to setlist, W01#3 none, W02#4 all five). Holding every action in the menu
   on every device makes each action reachable the same way everywhere (the
   behavior test's "each action reachable from the menu") and makes the
   menu's code width-independent. The inline buttons follow the boards:
   phone bottom bar Arrange/Edit/Full screen, tablet Edit (W02#3, the
   frame drawing the plain reading state; W12#3's *Add to setlist* button
   illustrates that frame's action), computer the full row. *Rejected:*
   removing from the menu what is inline (today's narrow_fit behavior) — the
   menu's contents would change with the window, and the note asks for them
   in the menu.
3. **Transpose follows the board per device.** Phone: the icon in the app
   bar (as today). Tablet: labelled, in the app bar (W01#3, W02#3, W12#3).
   Computer: at the head of the meta row, where W02#4 draws the transposed
   state's controls; adding it to the computer's full app bar would push
   past what `narrow_fit` measured to fit at 1080px. *Rejected:* Transpose in
   the computer app bar — not drawn, and risks clipping Share at the
   breakpoint.
4. **The card is the tablet's; the subtitle is everyone's but the phone's.**
   The tablet frames draw a bordered `card pad`; the computer frame draws an
   unbordered 300px column; the phone a plain *Shapes*. Each is followed. The
   instrument subtitle (*Shapes · guitar*) appears on tablet and computer,
   where the chip is not right above the shapes; the phone keeps *Shapes*
   (W02#2), its chip being in the meta row just above. Transposed, the
   heading is *Shapes in {key}* everywhere (W02#4), unchanged. The subtitle
   uses the chip's short label (`chipLabel`), so a custom name or a
   non-standard tuning reads the same in both places (workflow 15 L62-75);
   `.t-h3` uppercases it as the board does. *Rejected:* a card on every
   width — the computer and phone frames draw none.
5. **The shapes region is named by its heading.** The accessible name moves
   with the visible text (*Shapes · Guitar*) rather than staying *Shapes*;
   tests locate it by the new name. The arrange view's own *Shapes* strip
   (`SongArrange`, `arrange.spec.js:41`, `wizard.spec.js:50-84`) is a
   different region and is untouched.
6. **No e2e activation of Print or Share in the new test.** Print opens the
   browser's print dialog, which Playwright cannot dismiss through the UI;
   the behavior test pins that the item calls `window.print`. Share's flow
   needs a hosted book and is pinned end to end by `share.spec.js`, whose
   helper already reaches it through ⋯ when no button is drawn.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-16.

- The reading header, ⋯ menu and shapes follow W01, W02 and W12 on phone, tablet and computer: `app/src/songs/SongReading.jsx`, `app/src/songs/reading.css`.
- One ⋯ menu on every device: Edit, History, Add to setlist, Print, Share, Arrange for…, Full screen (six items while transposed).
- Tablet reads on the whole pane with no search rail; chip, Transpose, Edit and ⋯ in the app bar; shapes in a 230px card headed *Shapes · {instrument}*. Computer keeps the rail and full row, with Transpose at the head of the meta row.
- New locale key `reading.shapesFor` in `app/src/i18n/locales/{en,es-419,it,pt-BR}.js`.
- Behavior tests: `app/src/songs/SongReading.behavior.test.jsx` ("the reading chrome as drawn"); `app/src/shell/AppShell.routing.behavior.test.jsx` adjusted to computer widths for the rail case.
- e2e-web: `e2e/web/tests/reading.spec.js` (new chrome test on all three viewports; searchbox checks computer-only), `e2e/web/tests/header.spec.js` (tablet chip in the reading app bar); comment fixes in `e2e/web/lib/journeys.js`, `e2e/web/lib/journeys-core.js`.
- Tech debt: none.
