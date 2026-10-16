# books.setlist_chrome — The setlist view keeps the tab bar on a phone

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task setlist_chrome` (L142-147):

> The W12 board keeps Search, Books and Setlists visible under an open setlist
> on a phone; the app hides the tab bar there. Source: UI audit 2026-10-14 (app
> screens vs rendered boards; e2e/web/lib/mockup.js). Tests: behavior (the tab
> bar under an open setlist on narrow); e2e-web (a setlist opened from the
> Setlists tab on a phone, the tab bar reaches Search; mockup W12#1-2).

Milestone: listed in `tasks/99-milestones.tji` L44 with the other UI-audit polish tasks.

## Effort estimate

0.5d. One branch of `AppShell.jsx` changes: on the narrow layout, the open setlist moves from an early return into the shell's `.screen`. Two small state rules come with it, one behavior test file is extended, and one e2e-web case is added.

## Repository

The work lands in **estante-de-cifras**, not under `cifra.md/`:

- `app/src/shell/AppShell.jsx` (and `app/src/shell/shell.css` if the flex chain needs a rule)
- `app/src/shell/AppShell.routing.behavior.test.jsx`
- `e2e/web/tests/setlists.spec.js`

`SetlistView.jsx` itself does not change.

There is no design delta. The W12 board already decides this. Workflow 12 and DIRECTION §4 say nothing about the phone's chrome, and nothing in them is contradicted.

## Inherited dependencies

- `books.setlists` — **settled** (`complete 100`). Its outputs are `SetlistView`, the `openSetlist` surface in `AppShell`, and the Setlists destination (`tasks/refinements/books/setlists.md`).
- Also settled, though not in `depends`:
  - `shell.routing`: the place, and the push/replace history rules (`tasks/refinements/shell/routing.md`).
  - `books.setlist_search`: a setlist opened from search through the same `setOpenSetlist`, Decision 5.
  - `books.play`: the chrome-free player above the setlist.
  - `shell.header_chrome`: Decision 8 says deep screens keep their own app bar and get no wordmark row.
  - `shell.full_height`: the destination panels join the flex chain, and the phone tab bar stays in view.

## What this task is

On a phone, opening a setlist currently replaces the whole shell with `SetlistView`, so the bottom tab bar (Search · Books · Setlists) disappears. W12 phone #1 draws it differently:

- the setlist's app bar (Back, title, Edit, More);
- the Play button, the numbered rows and the missing notice;
- **the tab bar underneath, with Setlists marked on** (`docs/mockups/W12-setlists.dc.html` L28-67, the tab bar at L62-66).

This task renders the open setlist inside the narrow shell, in the Setlists tab panel, with the tab bar below it:

- From there, a tab press reaches Search or Books.
- Back still returns to where the setlist was opened from.
- The player (W12 phone #2, L70-102) stays chrome-free, as `books.play` decided.
- The wide layout (tablet and computer, W12 #3 and #4) draws no rail under a setlist, and is unchanged.

## Why it needs to be done

The UI audit of 2026-10-14 compared the app's screens with the rendered boards. It found that on a phone an open setlist is a dead end: the only way out is Back, while the board keeps the three destinations one tap away. It is one of the M5 polish leaves in `tasks/99-milestones.tji` L44. No later task depends on it.

## Inputs / context

- **Board W12 phone #1**, `docs/mockups/W12-setlists.dc.html` L28-67:
  - app bar at L30-35;
  - `.tabbar` with `.tab.on` on Setlists at L62-66.
- **Board W12 phone #2**, L70-102: the player has no app bar and no tab bar. That stays as it is.
- **Board W12 tablet #3 and computer #4**, L109-242: no rail and no tab bar under a song or a setlist.
- **Frame numbering:**
  - `e2e/web/lib/mockup-frames.json` L333-354 gives W12 #1 and #2 as phone, #3 as tablet and #4 as desktop.
  - The helper is `mockup(page, board, index, { note })` at `e2e/web/lib/mockup.js:45`.
- **`docs/mockups/GUIDE.md:34`**: "the phone tab bar is Search · Books · Setlists".
- **`app/src/shell/AppShell.jsx`:**
  - the early return for `openSetlist` at L1018-1032; it comes after `openSong` (L960-1001) and `playingSetlist` (L1003-1016);
  - the narrow shell at L1092-1112: `.screen` > `HeaderChrome.instr-top` + `TabList.tabbar` + `main.scroll` > `destinationPanels(...)`;
  - `destinationPanels` at L171-226, where the `setlists` panel renders `SetlistsScreen` at L212-213;
  - `<Tabs selectedKey={selected} onSelectionChange={setSelected}>` at L1060-1065;
  - the place at L393-398, `applyPlace` at L442-452, and `back` from `usePlaceHistory`.
- **`app/src/shell/place.js`:**
  - L47: a `.setlist.md` address parses to `{ tab: 'setlists', setlist }`, so a reloaded setlist is already on the Setlists tab;
  - `isOpening` at L89-98.
- **`app/src/shell/use-place-history.js`** L11-17: opening pushes; a tab switch or a close replaces, or steps back when the entry below is exactly the new state.
- **`tasks/refinements/shell/routing.md`:**
  - Decision 4 at L391-394: tab switches replace;
  - place slots at L215-224.
- **`app/src/books/SetlistView.jsx`:**
  - props at L125-132;
  - the root is always `.setlist-screen` with its own `.appbar` and `.scroll` (L245, L265, L474);
  - every edit is a working-copy WRITE at L176-179, committed by Save or reverted by Discard.
- **`app/src/books/setlist.css`** L30-38: `.setlist-screen` is a flex column with `flex: 1; min-height: 0`, and its `.scroll` overflows on y.
- **`app/src/shell/shell.css`** L83-91 and L140-149: the tab panels in the flex chain; the `.tabbar` placed last with `order`.
- **Existing tests:**
  - `app/src/shell/AppShell.behavior.test.jsx` L59-117 covers narrow vs wide tab bar presence.
  - `app/src/shell/AppShell.routing.behavior.test.jsx` has tab clicks at L155-159 and a setlist deep link at L365-373; that fixture is reused here.
  - `e2e/web/tests/setlists.spec.js`.
- **e2e journeys:**
  - `e2e/web/lib/journeys.js`: `openExampleBook` at L55 and `gotoTab` at L33-51;
  - `e2e/web/lib/journeys-files.js`: `openSetlist(page, name)` at L113-119 opens it from the Setlists tab, and `EXAMPLE_BOOK`. The bundled example book holds the setlist "A Short Set", already used by `setlist-play.spec.js` L83.
  - Several helpers check whether the Search tab is visible and press Back when it is not: `journeys-files.js:122-130` `addToSetlistFromSearch`, and `journeys-sync.js:49-63` `gotoTabFromSong`. They keep working when the tab is visible under a setlist, because they then press it directly.

## Constraints / requirements

- **Narrow only.** The wide branch (tablet and computer) keeps `SetlistView` as a full-screen early return, as W12 #3 and #4 draw. `layout-mode.js` `WIDE_QUERY` (600px) decides which applies.
- **Real tab panel.** On narrow, the open setlist renders inside the RAC `TabPanel` for `setlists`, so the tabs' `aria-controls` point at a real panel and axe stays clean. Do not draw a stand-alone `TabList` beside an early return.
- **No wordmark row above the setlist.** On narrow, `HeaderChrome` is not rendered while a setlist is open. The board's first row is the setlist's own app bar, and header_chrome Decision 8 says deep screens get no wordmark row.
- **Scrolling.** The setlist's own `.scroll` scrolls; the app bar stays at the top and the tab bar stays at the foot (the full_height promise). `.setlist-screen` already carries `flex: 1; min-height: 0`. If the panel chain needs it, add one rule in `shell.css`, not in `setlist.css`.
- **Player above everything.** The player stays a chrome-free surface above everything: the `playingSetlist` early return keeps coming before this branch.
- **Routing stays as `shell.routing` decided:**
  - opening a setlist pushes;
  - Back is `back(() => setOpenSetlist(null))`;
  - a tab switch replaces;
  - the address stays `/b/<book>/<path>` while the setlist is open.
- **Accessibility:**
  - every control is still RAC, and the tab bar is keyboard reachable (arrow keys within the `TabList`);
  - the selected tab is carried by `aria-selected` and the `.on` treatment, not by colour alone;
  - axe stays clean at WCAG 2.1 AA.
- **Offline first; no data path changes.** Leaving a setlist mid-edit by a tab loses nothing: the edits are already working-copy WRITEs, shown as unsaved.

## Acceptance criteria

### Behavior delivered

1. **The setlist sits inside the phone shell.** On narrow, with a setlist open and no surface above it:
   - the shell renders `.screen` with the `.tabbar` `TabList` (Search, Books, Setlists, in that order);
   - the Setlists tab is `aria-selected="true"`;
   - the `setlists` tab panel holds `SetlistView`, both the read view and the editor, with its app bar first.
   - `HeaderChrome` is not rendered.
2. **Opening a setlist selects the Setlists tab.** This holds whichever destination it was opened from: the Setlists destination, a search hit (`books.setlist_search`), or an address. The open handler sets `selected` to `'setlists'` along with `openSetlist`. In `applyPlace`, a place that names a setlist is applied on the Setlists tab. This agrees with `place.js` L47 and with the board (W12 L65).
3. **A destination tab leaves the setlist.** Pressing Search or Books while a setlist is open closes it and shows that destination.
   - It is a tab switch plus a close, so the history entry is replaced (routing Decision 4), and the address becomes `/` or `/books`.
   - Pressing the already-selected Setlists tab does nothing; RAC fires no selection change. Back is the way out of the setlist to the list.
4. **Back is unchanged.** It returns to the place below: the Setlists list, or search if the setlist was opened from search, with that destination's tab selected again.
5. **Wide is unchanged**, and so is the player: no tab bar and no rail under the setlist, and the player is chrome-free.

### Tests, by level

- **behavior — `app/src/shell/AppShell.routing.behavior.test.jsx`** (extended; it reuses the file's setlist fixture from L365-373):
  - *narrow, a setlist opened from the Setlists destination*:
    - the `tablist` named by `shell.nav` is present;
    - the Setlists tab has `aria-selected="true"`;
    - the setlist's h2 is inside the `tabpanel` named Setlists;
    - there is no wordmark or instrument chip;
    - axe is clean.
  - *narrow, the Search tab leaves the setlist*:
    - pressing the Search tab shows the search region and no setlist heading;
    - `location.pathname` is `/`;
    - `history.length` has not grown, because the entry was replaced.
  - *narrow, a setlist opened from search is on the Setlists tab*:
    - the Setlists tab is selected under the open setlist;
    - Back leaves Search selected and the setlist closed.
  - *narrow, the editor keeps the tab bar*: after Edit, the tab bar is still present, and so are the editor's Save and Discard.
  - *wide, unchanged*: an open setlist renders no `.tabbar` and no rail.

  *Pins:* W12 phone #1 (L28-67, tab bar at L62-66); routing Decision 4; header_chrome Decision 8.
- **e2e-web — `e2e/web/tests/setlists.spec.js`**, a new test *"the tab bar stays under an open setlist on a phone; Search is a tap away"*. It runs on the phone, tablet and computer projects and goes through the real UI only:
  1. `openExampleBook(page)`, then `openSetlist(page, 'A Short Set')`, which opens the setlist from the Setlists tab.
  2. **On the phone:**
     - the `tablist` is visible and in the viewport, and the Setlists tab is selected;
     - `await mockup(page, 'W12-setlists', 1, { note: 'tab bar' })`;
     - `checkA11y()`;
     - press the Search tab: the searchbox is visible, the setlist heading is gone, and the URL path is `/`.
  3. **On tablet and computer:**
     - the setlist shows with no `tablist` in view, as W12 #3 and #4 draw;
     - Back returns to the Setlists destination, whose rail reaches Search;
     - `checkA11y()` on the open setlist.

  W12 #2 (the player) is unchanged by this task. It stays pinned by the existing `setlist-play.spec.js` (L84-93: `mockup(…, 2)` and axe on the player). That spec enters the player from a setlist now rendered inside the phone shell, so its passing run also checks that the player still opens above the new branch.

  *Pins:* W12#1 phone tab bar; routing Decision 4.

Every case is driven by what already exists: the bundled example book's setlist "A Short Set", the `openSetlist` and `gotoTab` journeys, and the AppShell setlist fixture. No hosted book, second device or sign-in is needed.

No test level is dropped. No test is deferred. No deferred WBS leaf.

## Decisions

1. **Render the setlist in the Setlists `TabPanel` on narrow, not a tab bar bolted onto the early return.**
   - *Rationale:* The `TabList` and its panels belong to one RAC `Tabs`. Putting the setlist in the panel keeps `aria-controls` valid, reuses the `.screen` flex chain that `shell.full_height` made, and keeps one tab bar in the app.
   - *Rejected:* a second `TabList` inside `SetlistView`. It would duplicate the shell's chrome, and its tabs would point at panels that are not mounted.
2. **Phone only.**
   - *Rationale:* W12 tablet #3 and computer #4 draw no rail under a song or a setlist, and the task names the phone.
   - *Rejected:* also putting the rail beside the setlist on wide. The board does not draw it, and the computer's setlist editor needs the width for its raw-file side pane (`SetlistView.jsx` L448-471).
3. **A setlist is always on the Setlists tab.**
   - *Rationale:* The board marks Setlists on, and `place.js` already maps a setlist address to `tab: 'setlists'`, so a reload and a fresh open now agree. Opening from search pushes, so Back still lands on Search.
   - *Rejected:* keeping whichever tab it was opened from. A setlist under a selected Search tab would contradict both the board and the address.
4. **Another tab closes the setlist and replaces the entry.**
   - *Rationale:* The place is a tab plus an open item, and the address must say what is shown. Routing Decision 4 already makes tab switches replace, so back does not turn into a tour of the tab bar.
   - *Rejected:* keeping a per-tab stack, so that the setlist would still be open on returning to Setlists. That is a new navigation model that no workflow decides.
5. **The editor keeps the tab bar too.**
   - *Rationale:* The editor is internal state of the same surface, and every edit is already a working-copy WRITE, so leaving by a tab loses nothing; the setlist shows as unsaved, as any file does (workflow 4). Hiding the bar only while editing would need a new seam out of `SetlistView` for a case the board does not draw.
   - *Rejected:* an `onEditingChange` seam that hides the bar in the editor.
6. **The app bar keeps the setlist's own title.** W12 #1 writes the generic "Setlist" in the bar. The app shows the setlist's title, which `books.setlists` chose. That is outside this task's note, so it is not changed here.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-16.

- On a phone an open setlist renders inside the Setlists tab panel of the shell, with the Search · Books · Setlists tab bar below it: `app/src/shell/AppShell.jsx`.
- No wordmark row above it; its app bar spans the full width via one new rule in `app/src/shell/shell.css`.
- Opening a setlist from anywhere selects the Setlists tab; pressing Search or Books closes it and replaces the history entry. Back, the player, tablet and computer are unchanged.
- Behavior: "AppShell setlist chrome on a phone", 5 cases (with axe), in `app/src/shell/AppShell.routing.behavior.test.jsx`.
- e2e-web: "the tab bar stays under an open setlist on a phone; Search is a tap away" in `e2e/web/tests/setlists.spec.js` (mockup W12#1 plus axe), passed on phone, tablet and computer.
- Follow-up: none.

