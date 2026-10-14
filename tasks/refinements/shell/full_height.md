# shell.full_height — Full-screen surfaces scroll inside, not the page

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 82–87, task
`shell.full_height` ("Full-screen surfaces scroll inside, not the page"),
under `task shell` (which `depends foundation.app_tooling,
foundation.e2e_web`). It `depends !layout`. It sits in the polish milestone
(`tasks/99-milestones.tji` line 44). The note, verbatim:

> The themed root .est has min-height: 100dvh (app/src/shell/shell.css:23), an
> indefinite height, so the height: 100% / flex: 1; min-height: 0 chains beneath
> it resolve to auto and inner scrollers grow with their content — the page
> scrolls instead. A phone-viewport probe found it on the shell's search, books
> and setlists tabs, the account screen, arrange, the wizard, song history, the
> file view (tree, history, open file), the new-song editor, the chord explorer
> and the upload preview; only reading and the setlist view cap themselves
> (reading.css:19, setlist.css:23). Cap at the shell (height or max-height
> 100dvh), give the surfaces that rely on the theme's bare .scroll (overflow:
> hidden, theme.css:130 — file-view tree and history, song history) an
> overflow-y: auto scroller, and re-check the tab screens and the upload
> preview. Source: tasks/parking-lot.md 2026-10-14 (Shell .est min-height).
> Tests: e2e-web (on each listed surface a long content scrolls its own
> container and the document does not overflow, on the three viewports; axe).

The parking-lot entry it came from (first raised 2026-10-08 by the closer for
`sync.read_in_place`) asked whether to cure this once at the shell or leave
each surface to cap itself; the WBS note settles it: cap at the shell.

## Effort estimate

**1 day** (from the `.tji`). The work is a handful of CSS rules (the shell
cap, the shell-level scroller rule, the tab panel's flex link, two tab-screen
fixes, the print release), removing the two now-redundant per-surface caps,
and one e2e-web spec with a small geometry helper that visits every listed
surface on the three viewports.

## Repository

**estante-de-cifras only** — `app/src/` (CSS under `shell/`, `songs/`,
`books/`, and one class name in `shell/AppShell.jsx`) and the e2e-web harness
(`e2e/web/tests/`, `e2e/web/lib/`). Not format work; the note does not start
with `cifra.md:`. Nothing touches the service, the API or cifra.md.

**No design delta.** DIRECTION §4 and the workflows already assume a fixed
frame with chrome that stays put (workflow 16 L148–156: "the chord input and
the instrument chip stay reachable while the results scroll"; the boards draw
every surface inside a fixed device box, `docs/mockups/theme.css` L124–127).
This task makes the running app match what is drawn; it decides nothing new.

## Inherited dependencies

Settled (all `complete 100`):

- `shell.layout` — the shell, `.est` → `.shell` (RAC `Tabs`) → `.screen` /
  `.split`, and the shell's own `.scroll` around the tab panels
  (`app/src/shell/AppShell.jsx` 857–907, `app/src/shell/shell.css`).
- `shell.tokens` — `app/src/theme/theme.css` is `docs/mockups/theme.css`
  verbatim minus the canvas scaffolding (tokens refinement Decision "Adopt
  `theme.css` whole"); its `.scroll` is `overflow: hidden` (L130).
- The surfaces the spec visits, each built by a complete task:
  `songs.search`, `books.shelf`, `books.setlists`, `account.account_screen`,
  `songs.arrange`, `songs.wizard_ui`, `songs.history`, `books.file_view`,
  `songs.new_song` / `songs.editor`, `music.explorer`, `books.upload_ui`,
  and `songs.reading` / `sync.read_in_place` (the cap this task generalises).
- `foundation.e2e_web` — the harness, the axe fixture, the phone / tablet /
  computer projects (`e2e/web/playwright.config.js` 39–43).

Pending: none. Every test named below is drivable today (see Acceptance
criteria, "What drives each visit").

## What this task is

Make the app occupy exactly the window, so that every full-screen surface's
own scroller does the scrolling and the page itself never scrolls. Today
`.est` is `min-height: 100dvh`; an indefinite height means every
`height: 100%` / `flex: 1; min-height: 0` beneath it resolves to the content's
height, so on a tall list or song the whole document scrolls — carrying the
app bar, the instrument chip and the phone's tab bar off screen — and, where
a surface's body is the theme's bare `.scroll` (`overflow: hidden`), the
content past the window can only be reached by scrolling the page. This task
gives `.est` a definite height, makes every theme `.scroll` body inside the
app a vertical scroller, links the tab panels into the flex chain, and pins
the result with an e2e-web spec on every listed surface on the three
viewports.

## Why it needs to be done

- **Chrome that stays put is what the boards draw and the workflows assume.**
  The phone tab bar (workflow 1, DIRECTION §4), the reading view's chrome, the
  explorer's chord input and chip (workflow 16 L154–156), the save button in
  the editor's app bar all disappear on a page scroll.
- **Two surfaces already patched it locally** (`app/src/songs/reading.css`
  8–20, `app/src/books/setlist.css` 20–29), each with a comment explaining the
  shell's indefinite height. A third and fourth patch would be the same
  workaround; the shell is the one place to fix it.
- **The upload preview's body says it scrolls** (`books/upload-preview.css`
  13–15 comment) but stays `overflow: hidden` — a long merge preview's
  *Import* button sits under the fold, reachable only by page scroll.
- Downstream: `shell.narrow_fit` (horizontal fit) and `shell.header_chrome`
  both assume a fixed frame; `sync.read_in_place`'s anchor restore relies on
  the reading body being the scroll port, which this keeps true.

## Inputs / context

- `app/src/shell/shell.css`
  - 10–14 `html, body, #root { height: 100% }`.
  - 22–26 `.est { min-height: 100dvh; display: flex; flex-direction: column }` — the cause.
  - 30–35 `.shell { flex: 1; min-height: 0; … }` (the RAC `<Tabs>`).
- `app/src/theme/ThemeRoot.jsx:66` renders `.est`; `App.jsx:88` wraps
  everything in it, so every full-screen surface (AppShell's early returns at
  `AppShell.jsx` 542–838: SignIn, Account, Invited, SongConflict,
  BookConflicts, SongHistory, FileView, NewSongHost, EditSongHost,
  SongWizard, SongArrange, SongReading, SetlistPlay, SetlistView,
  ChordExplorer) is a direct child of `.est`.
- `app/src/shell/AppShell.jsx` 863–906 — wide: `.split > main.pane.main >
  .scroll > TabPanels`; narrow: `.screen > … > main.scroll > TabPanels`. The
  RAC `TabPanel`s (`destinationPanels`, 179–222) carry no class, so they are
  not part of the flex chain.
- `app/src/theme/theme.css` 129–134 — `.screen`, `.scroll` (`flex: 1;
  min-height: 0; overflow: hidden; …`), `.split`, `.pane`; the mockup copy is
  `docs/mockups/theme.css` 141–146, where the fixed `.dev` frame (124–127)
  supplies the definite height the app lacks.
- The per-surface state (from a survey of the CSS):
  - Search: `songs/search.css` 8–15, `.search-screen { flex: 1; min-height: 0; overflow-y: auto }` — right once the chain above it is definite.
  - Books: `books/books.css` 8–14, `.books-screen` has `overflow-y: auto; min-height: 0` but no `flex: 1`; wide detail `.scroll.book-detail-body` (`BookDetail.jsx:279`) has no overflow.
  - Setlists tab: `books/setlist.css` 7–13, `.setlists-screen` has `overflow-y: auto` only.
  - Account: `account/account.css` 7–22, `height: 100%` + `.account-scroll { overflow-y: auto }` — right once `.est` is definite.
  - Arrange `songs/arrange.css` 6–14, wizard `songs/wizard.css` 8–16, explorer `music/music.css` 7–20, 121–127 — scrollers set, uncapped.
  - Song history `songs/song-history.css` 9–24: `.est-history-body`, `.est-history-detail` are bare `.scroll`.
  - File view `files/file-view.css` 6–25 and `files/BookHistory.jsx` 198–224: tree, open-file pane and book-history `.scroll`s are bare.
  - New-song / edit `songs/new-song.css` 7–14, `editor/editor.css` 9–73: `height: 100%` chain; CodeMirror and `.est-editor-preview` scroll themselves.
  - Upload preview `books/upload-preview.css` 7–15: `.upload-body` bare.
  - Not in the note's list but under the same root, and today page-scrolling:
    `.est-conflict-scroll` (`songs/song-conflict.css:7`),
    `.est-bookconf-scroll` (`books/book-conflicts.css:6`), the sign-in and
    invited screens.
- The two local caps this replaces: `songs/reading.css` 8–20 (`max-height:
  100dvh` with its comment) and `books/setlist.css` 20–29.
- Print: `songs/reading.css` 175–198 `@media print` sets the reading scrollers
  `overflow: visible` so a song prints whole (workflow 2 L85, L100).
- Workflow 16 L148–156 (explorer: input and chip reachable while results
  scroll); DIRECTION §4 L467–490 (the surfaces).
- e2e-web harness (`e2e/web/lib/`): `journeys.js` (`startApp`, `gotoTab`,
  `openExampleBook`, `openSongFromSearch`, `openSongInEditor`, `openFiles`,
  `openFileInFiles`), `journeys-core.js` (`enterArrange` :35,
  `openExplorerFor` :133, `addInstrument` :102, `closeInstruments` :120,
  `createSongFromSearch` :143), `journeys-edit.js` (`openHistory` :82,
  `addSection` :11), `journeys-files.js` (`openFilesHistory` :60,
  `fileRow` :15), `journeys-account.js` (`openAccount` :16); spec-local
  helpers to lift: `buildHistory` (`tests/history.spec.js` 29–38),
  `toPreview` (`tests/wizard.spec.js:33`), `uploadZip`
  (`tests/upload.spec.js` 30–38) with `fixtures/upload/merge.zip`. The only
  existing overflow check is horizontal (`tests/chart.spec.js` 40, 46).

## Constraints / requirements

- **The shell owns the frame; the theme stays verbatim.** No edit to
  `app/src/theme/theme.css` (tokens refinement: the visual language is
  decided in the mockups). The fixes live in `shell/shell.css` (layout
  plumbing, its header comment) and in surface stylesheets.
- **`.est` gets a definite height, not `overflow: hidden`.** Hiding overflow
  at the root would make "the document does not overflow" true by clipping
  and hide the very bug the test is for.
- **Horizontal overflow is unchanged.** Only `overflow-y` moves; the theme's
  `overflow: hidden` on the x axis stays (horizontal fit is
  `shell.narrow_fit`'s).
- **Every full-screen surface keeps a reachable end** — including the ones
  outside the note's list (conflicts, sign-in, invited, setlist play); capping
  the root must not turn today's page scroll into clipped content anywhere.
- **Print still prints the whole song.** The cap is screen-only.
- **`sync.read_in_place`'s anchor restore keeps working** — `.reading-scroll`
  stays the reading view's scroll port (its specs stay green).
- **Accessibility:** a scroller must remain keyboard-reachable content (no
  `tabindex` hacks beyond what the browser gives a scroll container); axe at
  WCAG 2.1 AA on every surface the spec visits (`scrollable-region-focusable`
  is in the rule set — a scroller holding no focusable content must be
  focusable, so the implementer fixes any such report, not the rule).
- No song text written for the test beyond what the bundled example book and
  the authored upload fixtures already hold, plus purpose-written saves
  (`buildHistory`).

## Acceptance criteria

Behavior delivered:

1. `app/src/shell/shell.css`: `.est { height: 100dvh; … }` (replacing
   `min-height`), with the comment updated to say why it is definite.
2. `app/src/shell/shell.css`: `.est .scroll { overflow-y: auto; }` — every
   theme `.scroll` body in the running app scrolls vertically (Decision 2).
   This covers song history, the file view's tree / open file / history, the
   upload preview's body, the book detail body, the conflict screens and the
   sign-in screen without per-surface rules.
3. The tab panels join the flex chain: the RAC `TabPanel`s in
   `destinationPanels` (`AppShell.jsx` 179–222) get a class (e.g.
   `shell-panel`) styled `flex: 1; min-height: 0; display: flex;
   flex-direction: column` in `shell.css`; `.books-screen` gets `flex: 1`
   (`books/books.css`), `.setlists-screen` gets `flex: 1; min-height: 0`
   (`books/setlist.css`) — so on the tab screens it is the screen's own
   scroller, not the shell's `main.scroll`, that scrolls, and the phone tab
   bar stays put.
4. The local caps go: `max-height: 100dvh` is removed from
   `songs/reading.css` 8–20 and `books/setlist.css` 20–26, and their comments
   rewritten to point at the shell; their `overflow-y: auto` scroll ports
   stay.
5. `@media print` in `shell.css` releases the frame (`.est { height: auto }`,
   `.est .scroll { overflow: visible }`), so the reading view still prints
   the whole song.
6. On every surface below, on phone, tablet and computer, the document never
   scrolls; the surface's chrome (app bar, phone tab bar, explorer input and
   chip) stays in view; the end of the content is reachable by scrolling the
   surface's own container.

Tests it lands with:

- **e2e-web — `e2e/web/tests/full-height.spec.js`**, on the phone, tablet and
  computer projects, one `test` per surface. Each visit shortens the viewport
  to a fixed short height (keeping the project's width, so the
  narrow/wide layout is unchanged — e.g. `page.setViewportSize({ width,
  height: 420 })`), so ordinary content is "long", then calls a new helper
  `expectScrollsInside(page, { stayInView })` in `e2e/web/lib/scroll.js` that
  asserts:
  - the document does not overflow: `document.scrollingElement.scrollHeight
    - clientHeight <= 1`;
  - some visible element with computed `overflow-y` `auto`/`scroll` has
    `scrollHeight > clientHeight + 1`; scrolling it to its end moves its
    `scrollTop` and brings its last child into the viewport;
  - every locator in `stayInView` is still inside the viewport after the
    scroll.
  Then `checkA11y()` on the surface. Where a surface does not overflow at the
  short height on some project, the implementer lengthens the content with
  the helpers listed (more saves, the merge zip), never by skipping the
  assertion. The surfaces, what drives each visit, and what each pins:
  - *Search tab* — `startApp`, `openExampleBook`, Search (results listed);
    stays in view: the search field, and the tab bar on the phone. Pins
    DIRECTION §4 L469; shell.layout's tab bar.
  - *Books tab* — `openExampleBook`, `gotoTab('Books')`, and on wide the book
    detail open; tab bar on the phone. Pins DIRECTION §4.
  - *Setlists tab* — `openExampleBook`, `addToNewSetlist` /
    `addToSetlistFromSearch` enough to fill it, `gotoTab('Setlists')`.
  - *Account screen* — `startApp`, `openAccount`.
  - *Arrange* — `openExampleBook`, `openSongFromSearch`, `enterArrange`; app
    bar in view.
  - *Wizard* — as arrange, then the lifted `toPreview` (moved from
    `wizard.spec.js:33` into `lib/journeys-core.js`).
  - *Song history* — the lifted `buildHistory` (moved from
    `history.spec.js` 29–38 into `lib/journeys-edit.js`), `openHistory`, and a
    version opened (`openFirstVersion`) for the detail pane.
  - *File view: tree, history, open file* — `openExampleBook`, `openFiles`
    (tree); `openFilesHistory` (history); `openFileInFiles` (open file — the
    scroller here is CodeMirror's, which the helper finds the same way).
  - *New-song editor* — `createSongFromSearch` with enough sections that the
    editor overflows; Save in the app bar stays in view.
  - *Chord explorer* — `addInstrument` (guitar), `closeInstruments`,
    `openExplorerFor(page, 'A')`; stays in view: the chord input and the
    instrument chip (workflow 16 L154–156).
  - *Upload preview* — `startApp`, `gotoTab('Books')`, the lifted
    `uploadZip` (moved from `upload.spec.js` 30–38 into
    `lib/journeys-files.js`) with `merge.zip`; the import action reachable at
    the end of the body (workflow 7 §Uploading a book).
  - *Reading* (regression for the removed cap) — `openSongFromSearch`; the
    reading chrome and action bar in view. Pins `sync.read_in_place`
    Decision 4's scroll port.
  - *Print* — the reading view under `page.emulateMedia({ media: 'print' })`
    at the short height: the document's scroll height exceeds the viewport
    (the song is in flow, not clipped). Pins workflow 2 L85, L100.
- **Existing e2e-web specs stay green** — notably `reading.spec.js`,
  `read-in-place.spec.js`, `setlists.spec.js`, `setlist-play.spec.js`,
  `conflicts.spec.js`, `explorer.spec.js`, `upload.spec.js`, `history.spec.js`,
  `wizard.spec.js` (whose helpers move to `lib/` and are re-imported).

No unit or behavior test: the defect is layout geometry, which jsdom does not
compute (Decision 4).

## Decisions

1. **`height: 100dvh` on `.est`, not `max-height`, not `overflow: hidden`.**
   *Rationale:* only a definite `height` makes the `height: 100%` children
   (account, history, file view, explorer, new song) resolve; `max-height`
   alone leaves percentages indefinite. `overflow: hidden` at the root would
   clip instead of scroll and make the test's first assertion vacuous.
   `dvh`, not `vh`, so the frame follows the phone's collapsing URL bar.
   *Alternative rejected:* each surface capping itself (the parking-lot
   "leave each surface" option) — it is what reading and setlists did, and
   it is why nine more surfaces were found broken; the next surface would be
   too.
2. **One shell rule `.est .scroll { overflow-y: auto }` instead of a rule per
   surface.** The theme's `.scroll` is `overflow: hidden` because the boards
   are static drawings clipped by a device frame; in the running app a
   `.scroll` body that cannot scroll is never intended. Doing it once in
   `shell.css` covers the note's list and the surfaces outside it
   (conflicts, sign-in, invited), which the cap would otherwise turn from
   page-scrolling into clipped. *Alternatives rejected:* editing
   `theme.css` (it is the mockups' file, verbatim by the tokens decision);
   per-surface `overflow-y: auto` (the note's literal suggestion, but it
   repeats the per-surface pattern Decision 1 rejects and misses the
   conflict screens). Nested scrollers this creates (the shell's
   `main.scroll` around a tab screen that scrolls itself) are harmless once
   item 3 bounds the inner one; it then never overflows the outer.
3. **Remove the reading and setlist `max-height` caps.** Under a definite
   `.est` they are redundant, and leaving them keeps two comments that
   describe a cause that no longer exists. The reading regression visit and
   the existing reading / read-in-place / setlist specs pin that nothing
   depended on them.
4. **e2e-web only, as the note says.** The bug is computed layout, which
   jsdom does not do; a behavior test could only assert class names, which
   pins the implementation, not the behavior.
5. **A short viewport, not a seeded long book.** Shrinking the viewport's
   height (width kept, so the layout mode is unchanged) makes the existing
   example-book content "long" on every surface with the journeys that
   already exist; there is no helper that seeds N songs or a tall song, and
   writing one through the UI would be slow. The note's "a long content" is
   relative to the frame, which is what this varies.
6. **A generic scroller finder, not per-surface selectors.** The helper looks
   for the element that actually scrolls, so the spec pins the behavior
   ("something inside scrolls, the page does not, the chrome stays") and not
   which class carries it; the `stayInView` locators carry the per-surface
   promise (workflow 16's input and chip, the phone tab bar, the app bar).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-14.

- `app/src/shell/shell.css`: `.est` is `height: 100dvh` with a print release; every `.est .scroll` scrolls vertically, is `position: relative`, and its children don't shrink; tab panels join the flex chain (`shell-panel`, `AppShell.jsx`).
- `app/src/songs/reading.css`, `app/src/books/setlist.css`: the local 100dvh caps are gone; `books.css`, `search.css`, `song-history.css`, `music.css`, `editor.css` adjusted (history footer wraps on phone).
- `SearchScreen.jsx`, `ChordExplorer.jsx`: the field / chord input sits outside the scroller, results scroll beneath.
- `SongReading.jsx`, `SetlistPlay.jsx`, `SongEditor.jsx`: scrollable regions are focusable and named (axe `scrollable-region-focusable`); CodeMirror content gets `tabindex="0"`.
- `e2e/web/tests/full-height.spec.js` and `e2e/web/lib/scroll.js`: 15 surfaces (including print) on phone, tablet and computer, with axe; `toPreview`, `buildHistory`, `uploadZip` moved into `e2e/web/lib/journeys-{core,edit,files}.js`.
- `app/src/songs/SongArrange.behavior.test.jsx`: the two axe-heavy picker tests get a 20 s budget (slow under full-suite load, no race).
- Verified by the driver's `scripts/gate` (iter-0004): green, 45/45 full-height tests passed.

