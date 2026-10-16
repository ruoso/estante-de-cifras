# songs.history_phone_actions — A version's actions in reach on a phone

## TaskJuggler entry

`tasks/60-songs.tji:119-124` — `task history_phone_actions "A version's actions in reach on a phone"`, under `songs`; part of milestone `m5` (`tasks/99-milestones.tji:44`).

## Effort estimate

0.5d.

## Repository

Not under `cifra.md/`. The work lands in the app and in the e2e-web harness:

- `app/src/songs/`: `SongHistory.jsx`, `song-history.css` and `SongHistory.behavior.test.jsx`.
- `e2e/web/tests/`: `history.spec.js`, `narrow-fit.spec.js` and `full-height.spec.js`.

## Inherited dependencies

- `songs.history`: **settled** (`complete 100`). It built the history surface, including the phone's stacked list → version screens with an action footer (`tasks/refinements/songs/history.md` L177-185, AC 8 L357-362).
- Not in `depends`, but already landed:
  - `shell.full_height` (`complete 100`): the window-height frame and `expectScrollsInside` (`e2e/web/lib/scroll.js`).
  - `shell.narrow_fit` (`complete 100`): `expectFits` (`e2e/web/lib/fit.js`).

  narrow_fit explicitly left the phone's version title and pinned bar to this task (`e2e/web/tests/narrow-fit.spec.js:148-149`; `tasks/refinements/shell/narrow_fit.md` L57, L233-235).

## What this task is

On a phone, a version of a song is one full screen with three parts:

1. An app bar: back to history, and the title *{song} · {date}*.
2. The scrolling version: its note, what changed, and the song as it was.
3. A bar pinned at the bottom with **Compare with now** and **Restore this version** (primary). The two buttons share the width, as the W06 board draws them.

This task makes that hold in the running app:

- The bar stays in view however long the version is, without scrolling, at any phone height.
- The bar's two buttons fill it.
- The title in the app bar is readable whole: it wraps instead of being cut with an ellipsis.

It also lands the tests that pin all of this, which nothing pins today.

## Why it needs to be done

The UI audit of 2026-10-14 found the version view running past the fold on a phone, with the action bar out of sight. On a phone, the bar is the only place workflow 6's two actions live: *compare with now* (§A version) and *restore this version* (§Restoring). If it is out of reach, a phone user cannot restore. narrow_fit carved the phone case out to this task, so until it lands the phone's version view is the one history state with no fit or reach check.

The m5 milestone depends on it.

## Inputs / context

**Workflow 6** (`docs/workflows/06-history.md`):

- L38-50, §A version: the song as it was, beside what changed; *compare with now* against the working copy.
- L52-70, §Restoring: *Restore this version* writes into the working copy and is saved as a new version. It asks first over unsaved changes.

**The W06 board** (`docs/mockups/W06-history.dc.html`):

- Phone artboard #2, L61-96 (frame `W06-history` index 2 in `e2e/web/lib/mockup-frames.json` L176-181).
- App bar, L63-66: back "Back to history" and the title "Rua do Porto · 28 Sep".
- `.scroll` body, L67-90.
- The bar, L91-94: a flex sibling *after* `.scroll` inside the `.screen` column, not `position: sticky`. It has `border-top: 1px solid var(--line)`, `background: var(--surface)`, `padding: 12px 16px 22px`, and two `.btn`s with `flex: 1`, Restore marked `primary`.
- Tablet (L107-110) and computer (L185-187) put the two actions in the app bar instead.
- `docs/mockups/GUIDE.md:30`: phones are 390×844 with a ~370px content width.

**The code today:**

- `app/src/songs/SongHistory.jsx`
  - `actionButtons`, L494-503: `div.est-history-actions` holding a Compare `Button.btn` and a Restore `Button.btn.primary`.
  - `detailHeader`, L505-510.
  - The phone branch, L591-608: `div.est-history.est-history-phone` > `.appbar.est-history-appbar` (title `history.songInBook`, L600) → `.scroll.est-history-body` → `div.est-history-footer{actionButtons}`.
  - The layout comes from `useHistoryLayout()`, L66-71: phone is the shell's narrow mode, below 600px.
  - The surface is mounted straight under ThemeRoot's `div.est-frame`: `app/src/shell/AppShell.jsx:853-874`, `app/src/theme/ThemeRoot.jsx:80`.
- `app/src/songs/song-history.css`
  - L9-14: `.est-history { display:flex; flex-direction:column; min-height:0; height:100% }`. It has no `flex: 1`, unlike the theme's `.screen`.
  - L16-26: the app bar wraps, and the title is `flex: 1 1 auto`.
  - L27-32: `.est-history-actions { margin-left:auto }`, with no `flex: 1`.
  - L165-179: `.est-history-footer` (wrap, padding, border, surface), plus `.est-history-footer .btn { flex:1 }`. Inside the content-sized actions wrapper, those buttons do not fill the bar.
- `app/src/theme/theme.css`
  - L288-289: `.appbar .title { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0 }`. This is why a long phone title is cut.
  - L290: `.screen { flex:1; min-height:0; overflow:hidden; display:flex; flex-direction:column }`.
  - L291: `.scroll { flex:1; min-height:0 }`.
- `app/src/shell/shell.css`
  - L33-37: `.est-frame { height:100dvh; display:flex; flex-direction:column }`.
  - L46-48: `.est .scroll { overflow-y:auto }`.

**The established bottom-bar pattern to reuse:** the reading view's phone bar.

- `app/src/songs/SongReading.jsx:729-745`: `div.screen.reading-screen` > appbar → `.scroll.reading-scroll` → `div.reading-actionbar` with `.btn.grow` buttons.
- `app/src/songs/reading.css`: L8-16 (`.reading-screen { flex:1; min-height:0 }`) and L119-129 (the bar, with the same tokens as `.est-history-footer`).
- The same shape is used by `.upload-confirm`, `.file-view-foot`, `.wizard-actionbar`, `.arrange-actionbar` and `.play-bar`. None of them uses sticky or fixed positioning.

**Tests to extend:**

- `app/src/songs/SongHistory.behavior.test.jsx`
  - The matchMedia stub is at L65-75; `mediaMatches=false` gives the phone layout.
  - `renderHistory` is at L219.
  - "read a version" is at L262.
  - Precedents for structural assertions: `SongReading.behavior.test.jsx:402,466` (`not.toContainElement`, querying the action bar).
- `e2e/web/tests/history.spec.js`
  - L31-53: the version view, `mockup(page, 'W06-history', 2)` at L44.
  - Journeys `buildHistory`, `openHistory` and `openFirstVersion` in `e2e/web/lib/journeys-edit.js` L73-106.
- `e2e/web/tests/full-height.spec.js:140-151`: the song-history surface. Its `stayInView` holds only the app bar.
- `e2e/web/tests/narrow-fit.spec.js:140-152`: the version view. `whole` is empty on the phone.
- `e2e/web/lib/scroll.js`: `shortenViewport` and `expectScrollsInside({ stayInView })`. The latter asserts `toBeInViewport({ ratio: 0.95 })` after scrolling to the end.
- `e2e/web/lib/fit.js:38`: `expectFits({ whole })`.

**Predecessor and sibling refinements:**

- `tasks/refinements/songs/history.md`: Decision 2, a navigable screen and not a sheet; AC 8, the phone footer.
- `tasks/refinements/shell/full_height.md`: never pass a frame check by adding `overflow: hidden`.
- `tasks/refinements/shell/narrow_fit.md`: never pass a fit check by clipping; in Decision 6, actions wrap rather than ellipsizing a title.
- `tasks/refinements/songs/reading_chrome.md` and `transpose_chrome.md`: e2e names carry the board frame (`(W06#2)`), then `mockup(...)`, then `checkA11y()`.

## Constraints / requirements

- **The board's structure, not a new seam.**
  - The bar stays a flex sibling after the one `.scroll` in a column bounded by `.est-frame`, the same shape as `.reading-actionbar`.
  - No `position: fixed` or `sticky`, no JS-measured heights, and no second scroller.
  - The scroller holds everything else: the note, what changed, *Show the text*, and the song as it was.
- **No clipping to pass.**
  - The bar comes into view because the column is bounded, not because content is hidden.
  - The end of the version stays reachable by scrolling inside `.scroll` (full_height's rule).
- **The title is readable whole.**
  - On the phone version screen, the app bar title (`{song} · {date}`) is never ellipsized. It wraps onto further lines when it does not fit.
  - Wrapping is scoped to the history phone app bar. The theme's global `.appbar .title` ellipsis is not changed, because every other surface's title rule stays as narrow_fit left it.
  - The back button stays aligned with the first line.
- **Tablet and computer unchanged.** Their actions stay in the app bar (W06 L107-110, L185-187). The task touches only the phone branch and its CSS.
- **Tokens only.** Use `var(--line)`, `var(--surface)` and `--u` units; no hard-coded colour (mockups README).
- **Accessibility.**
  - The actions remain the RAC `Button`s they are, in DOM order after the scroller. Tab order runs: back → scroller (focusable and named, per full_height) → Compare → Restore.
  - Restore's primary status is carried by its label, not colour alone.
  - axe at WCAG 2.1 AA is clean on the version view.
- **Offline first, no data change.** This is layout only. Nothing touches the Worker, git or the index.

## Acceptance criteria

Behavior delivered:

1. On a phone (narrow mode), the version view is one column: app bar → scrolling version → action bar.
   - The column fills the window: the phone root takes `flex: 1; min-height: 0`, as `.screen` and `.reading-screen` do.
   - The bar stays in view at any height and any version length.
2. The bar draws as W06#2 L91-94:
   - The actions wrapper fills the bar (`flex: 1`), so Compare with now and Restore this version (primary) share the width equally.
   - They wrap onto two full-width rows only when one row cannot hold both labels. The existing wrap that keeps the footer from widening the viewport stays.
3. The phone version title `{song} · {date}` renders whole: it wraps, it is never ellipsized, and it never pushes past the viewport.
4. Tablet and computer layouts are unchanged.

Before the fix, the implementer runs the new e2e case on the `phone` project to see which of 1-3 fails today. The audit predates `shell.full_height`, so the bar may already be partly in view. Then they fix exactly what fails, in the order above. The tests below pin all three either way.

Tests, by level:

- **behavior**, `app/src/songs/SongHistory.behavior.test.jsx`: a new case, *"on a phone a version's actions sit in a bar after the scrolling content, the title names the song and the date; axe"* (workflow 6 §A version, §Restoring; W06#2). With `mediaMatches=false`, after opening a version, it asserts:
  - the **Compare with now** and **Restore this version** buttons are both inside one bar element that follows the version's scroller;
  - the scroller does not contain either button (`not.toContainElement`, as `SongReading.behavior.test.jsx:402`);
  - the scroller does contain "What changed from the version before" and "The song as it was";
  - the app bar's title text is `{song} · {date}` and is not inside the scroller;
  - axe is clean.

  jsdom computes no layout, so geometry is the e2e level's job.
- **e2e-web**, `e2e/web/tests/history.spec.js`: a new test, *"a version's actions in reach without scrolling, its title whole (W06#2)"*, on all three projects (workflow 6 §A version, §Restoring; W06#2, #4).
  - Setup: `buildHistory(page, ['Coda', 'Bridge', 'Interlude', 'Outro'])` so the version runs past the fold, then `openHistory`, then `openFirstVersion`.
  - Both buttons are `toBeInViewport({ ratio: 1 })` with no scrolling, on every project. On tablet and computer they are in the app bar.
  - `expectFits(page, { whole: [the visible .est-history-appbar .title] })`.
  - On the phone it then resizes to the board's frame width (`setViewportSize({ width: 370, height: 824 })`, GUIDE L30) and repeats both checks there, so the title-wrap and two-button rules are held at the drawn size. On the phone it also asserts the two buttons share one row of equal width (bounding boxes: same `y`, widths within 2px).
  - It ends with `mockup(page, 'W06-history', 2)` and `checkA11y()`.
- **e2e-web**, `e2e/web/tests/full-height.spec.js:140-151`, sharpened: the song-history case adds the **Compare with now** and **Restore this version** buttons to `stayInView`. After `shortenViewport` (420px) and scrolling the version to its end, the bar is still in view on every project (DIRECTION §4; full_height).
- **e2e-web**, `e2e/web/tests/narrow-fit.spec.js:140-152`, sharpened: drop the phone carve-out. `whole` holds the version title on all three projects. Delete the "are songs.history_phone_actions" comment, since the phone case is now covered here.

Every case drives the real UI from `/` through the existing journeys (no `#dev/*`, no injected state). Each prerequisite has landed:

- the example book and the save sheet (`songs.save_sheet`);
- `songs.history`;
- `shell.full_height` / `shell.narrow_fit` helpers.

No deferred follow-ups.

## Decisions

1. **Fix the flex column, not a sticky footer.** The phone root becomes a bounded flex column (`flex: 1; min-height: 0` beside its `height: 100%`) with the footer as its last child, exactly like `.reading-screen` / `.reading-actionbar`. That is the board's own construction (W06 L91-94) and every other bottom bar's.
   - *Rejected:* `position: sticky; bottom: 0` inside the scroller. It moves the actions into the scrolling region, breaks the "bar outside the scrolling content" structure the note names, and changes tab order.
   - *Rejected:* `position: fixed`. It overlays content and needs padding hacks for the scroller's end.
2. **The phone title wraps; it does not shrink or truncate.** "Keep the title readable" is met by letting `.est-history-phone .est-history-appbar .title` wrap: `white-space: normal` with `overflow-wrap: anywhere`, and no ellipsis.
   - *Rejected:* ellipsis or line-clamp. A clamp is an ellipsis by another name, and narrow_fit Decision 6 already ruled ellipsis a last resort.
   - *Rejected:* dropping the date on a phone. The board names the version by it, and it is the only thing distinguishing versions in the bar.
   - *Rejected:* a smaller font. It departs from the theme's title size, and very long titles still fail.

   The wrap is scoped to this surface because no other surface has asked for it. The theme's global title rule stays.
3. **The actions wrapper fills the phone bar.** `.est-history-footer .est-history-actions { flex: 1 }` (dropping its `margin-left: auto` there) gives the board's two equal buttons.
   - *Rejected:* rendering the buttons bare in the footer without the wrapper. That would fork `actionButtons` between layouts for no gain.
4. **The e2e checks run on all three projects, not phone-only.** "Both actions visible without scrolling" is true on every viewport (tablet and computer hold them in the app bar). Running everywhere guards the wide layouts against regression and leaves no skipped case for the gate. Only the 370px resize and the equal-width row check are phone-specific branches inside the one test.
5. **No design delta.** Workflow 6 and the W06 board already settle the layout. This task makes the app match them.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-16.

- On a phone a version is app bar → one scroller → an action bar after it (a bounded flex column, no sticky/fixed): `app/src/songs/song-history.css` (bar buttons share the width equally, the board's 10px gap and 12px side padding; the `{song} · {date}` title wraps instead of an ellipsis). `app/src/songs/SongHistory.jsx` changed in a comment only.
- Tablet and computer unchanged.
- behavior: `app/src/songs/SongHistory.behavior.test.jsx` — the bar sits after the scrolling content, the title names the song and date; axe.
- e2e-web: `e2e/web/tests/history.spec.js` — actions in reach without scrolling, title whole (W06#2), on phone, tablet and computer; `e2e/web/tests/full-height.spec.js` — song-history case keeps both actions in view; `e2e/web/tests/narrow-fit.spec.js` — phone carve-out removed.
- Tech debt: none.
