# shell.palco_contrast — Palco everywhere: no light rows, every label readable

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 127–132, task
`shell.palco_contrast` ("Palco everywhere: no light rows, every label
readable"), under `task shell`. The note, verbatim:

> In Palco the file view tree rows, its history cards, the Add to setlist list
> and the setlist point-at results keep a light fill with light text, so titles
> are near invisible (W14, W12; the amber New setlist row is low contrast on
> it). Those components set a surface colour outside the theme tokens. The e2e
> axe checks run in the automatic theme on a light device, i.e. Estante only,
> which is why none caught it: make the axe fixture also check under Palco
> (emulateMedia dark) on every screen it visits. Source: UI pairwise audit
> 2026-10-14 (e2e mockup() screenshots vs rendered boards, audit/out). Tests:
> behavior (the listed rows take the theme surface; axe in Palco); e2e-web (axe
> under both themes on every visited screen, three viewports).

Listed in `milestones` (`tasks/99-milestones.tji` line 44, the M5 list).

## Effort estimate

**1 day** (from the `.tji`). Most of the day goes to the fixture change and
fixing whatever the Palco axe pass turns up on the visited screens. The row
reset itself is small.

## Repository

**estante-de-cifras only.** This is app work, not a `cifra.md:` task.

- `app/src/theme/` — a new app-level stylesheet `controls.css`, imported from
  `app/src/App.jsx` right after `theme.css` (line 2); a new unit test.
- `app/src/books/AddToSetlist.jsx`, `app/src/books/setlist.css`,
  `app/src/files/file-view.css`, `app/src/songs/song-history.css` — the
  per-component fixes.
- `e2e/web/lib/axe.js` — the fixture; `e2e/web/tests/axe-fixture.spec.js`,
  `e2e/web/tests/setlists.spec.js` — the new and extended cases.

## Inherited dependencies

- `shell.tokens` (`depends !tokens`) — **settled** (complete). It adopted
  `docs/mockups/theme.css` as `app/src/theme/theme.css`, and made the
  automatic theme a live device-mode mapping in `ThemeRoot`
  (`app/src/theme/ThemeRoot.jsx`, `app/src/theme/resolve.js` `resolveTheme`).
  The automatic theme switches live, without a reload, when the device's
  `prefers-color-scheme` changes (`e2e/web/tests/theme.spec.js` lines 27–44).
  That is what lets the fixture flip the scheme in the middle of a test.
- The screens whose rows are fixed are complete: the file view and its history
  (`books.file_view`, `books.file_view_create_menu`), Add to setlist and the
  setlist view's in-book picker (`books.setlists`). Their e2e journeys already
  exist (`e2e/web/lib/journeys-files.js` `addToSetlistFromSearch` line 174;
  `tests/setlists.spec.js`; `tests/file-view.spec.js`).
- The harnesses `foundation.e2e_web` and `foundation.app_tooling` are complete.

Every named test runs through existing UI paths. It needs no new dependency.

## What this task is

Make every list row readable in Palco, and make the e2e axe check hold every
screen it visits to WCAG 2.1 AA contrast in **both** Estante (light) and Palco
(dark), so this class of defect cannot come back unseen.

The root cause is not a hard-coded colour. A survey of `app/src/**/*.css`
found no light literal outside the token blocks. The theme's shared `.row`
(`app/src/theme/theme.css` line 339) sets `color: inherit` but no `background`
and no border reset. That is right for the `<div>`, `<label>` and `<a>` the
boards draw rows as, but React Aria's `Button` renders a native `<button>`. A
`<Button className="row">` therefore keeps the browser's default button
chrome: a light grey `ButtonFace` fill, because no theme declares
`color-scheme`, so the user agent paints light controls even in Palco. It also
keeps a 2px outset border and the UA button font. Palco's light `--ink`
(`#F1F0EA`) and amber `--accent` (`#F2B544`) then sit on that light fill.

Some screens patched this locally, each with its own reset:

- `.file-tree button.row`, `app/src/files/file-view.css` lines 141–156. It
  landed with `books.file_view_create_menu` after the audit, which is why the
  tree rows named in the note are already right.
- `.books-screen button.row`, `books.css` line 70.
- `.search-screen button.row`, `search.css` line 108.
- `.est-history-row`, `song-history.css` line 55.

The rest never got one:

- **File view history cards:** `BookHistory.jsx` `CommitList`, lines 72–95,
  `.row.commit-row`. No CSS names `commit-row` or `commit-list`.
- **Add to setlist list:** `AddToSetlist.jsx` lines 148–170, and the amber
  **New setlist…** row at lines 171–183, whose amber is an inline
  `style={{ color: 'var(--accent)' }}` (lines 33, 42, 181).
- **Setlist point-at / add-song results:** `SetlistView.jsx` `InBookPicker`,
  lines 96–113, inside `.setlist-repoint` (`setlist.css` line 125).
- **Other `Button.row` uses** that rely on the default:
  - `ShareSheet.jsx` line 30
  - `SetlistsScreen.jsx` line 47
  - `FirstRun.jsx` line 109
  - `EnterShape.jsx` line 201 and `SongArrange.jsx` line 602 (`.row.explore`)

The fix is one app-level baseline that resets every `button.row` inside `.est`
back to the `.row` look. Each theme also declares its `color-scheme`, so any
remaining native control (scrollbars, checkboxes, a button nobody restyled)
follows the theme. The per-screen resets then shrink to what is specific to
their screen.

Separately, `song-history.css` line 227 uses `var(--ink-soft)`, a token no
theme defines. It is the only undefined token in the app (every other
`var(--…)` resolves), and it becomes `--ink-2`. A unit test keeps both
invariants: no undefined token, and no colour literal outside the theme.

## Why it needs to be done

Palco is the stage theme (`docs/mockups/README.md` line 15: "dark stage,
amber chords"). It is the theme the automatic setting picks on any device in
dark mode (workflow 1 §The theme; `resolveTheme`), so a performer at a dark
gig sees it by default. Titles that cannot be read there fail the standing
accessibility rule (WCAG 2.1 AA, DIRECTION §3.7) on four screens.

The e2e fixture checked only Estante, so the gate passed. The fixture is the
seam every screen's test goes through: 46 spec files call `checkA11y()` about
190 times. Teaching it the second theme closes the gap for every screen at
once, today's and tomorrow's.

## Inputs / context

- **Tokens and the shared rows.**
  - `app/src/theme/theme.css`: `.est` base at lines 174–187, Palco at line 246.
  - `.list` at line 338 (`background: var(--surface)`), `.row` at line 339,
    `.row.sel` and `.row.explore` at lines 344–345 (`var(--accent-soft)`).
  - The file's header (lines 1–18) says it is `docs/mockups/theme.css`
    verbatim plus `@font-face`: "Do not re-author the visual language here".
- **Palco values.** `docs/mockups/theme.css` lines 79–105: `--surface
  #181B1F`, `--ink #F1F0EA`, `--accent #F2B544`, `--accent-soft #3A2F17`.
  Amber on `--surface` is about 9:1 and on `--accent-soft` about 7:1, both
  well over AA. The amber New setlist row is fine once its row stops being
  light.
- **Theme application.**
  - `app/src/theme/ThemeRoot.jsx`: `usePrefersDark` is a live `matchMedia`
    subscription. ThemeRoot wraps the tree in `UNSAFE_PortalProvider`, so
    overlays render inside `.est`; see the memory
    [[rac-overlays-portal-outside-est-theme-root]].
  - `app/src/App.jsx` line 2 imports `theme.css`.
- **The precedent resets.** `app/src/files/file-view.css` lines 137–156 has
  the fullest one: `width: 100%; background: none; border: 0; border-bottom:
  1px solid var(--line); font: inherit; color: inherit; text-align: left;
  cursor: pointer; appearance: none`, plus `.sel` restored to
  `var(--accent-soft)`.
- **The affected components.**
  - `app/src/files/BookHistory.jsx` lines 49–95.
  - `app/src/books/AddToSetlist.jsx` lines 28–45 (icons) and 148–183 (rows).
  - `app/src/books/SetlistView.jsx` lines 96–113.
  - `app/src/books/setlist.css` lines 125–140 (`.setlist-repoint`) and 196
    (`.setlist-new-row .name`).
- **The e2e fixture.**
  - `e2e/web/lib/axe.js`: `analyzeWcag21aa` at lines 15–20, the `checkA11y`
    fixture at lines 38–52. It disables no rule, so `color-contrast` runs.
  - `e2e/web/playwright.config.js` projects (lines 39–43: phone, tablet,
    computer) set no `colorScheme`, so every spec runs light.
  - `e2e/web/lib/mockup.js` lines 40–43 and 55–86 already flip Estante/Palco
    with `page.emulateMedia({ colorScheme })` for screenshots, the same
    mechanism.
  - `e2e/web/eslint.config.js` lines 35–63 do not restrict `emulateMedia`.
- **The behavior-level axe.** `app/src/a11y/axe.js` lines 16–23: under jsdom,
  axe's `color-contrast` rule does not run. jsdom's `getComputedStyle` does
  cascade declared values from injected `<style>` sheets. Checked in this
  session: `.est button.row { background: none }` reads back as
  `backgroundColor: rgba(0, 0, 0, 0)`, while `var()` values come back
  unresolved.
- **Workflows and boards.**
  - Workflow 1 §The theme decides the automatic mapping.
  - W12 (`docs/mockups/W12-setlists.dc.html`) and W14
    (`docs/mockups/W14-file-view.dc.html`) draw these rows on `--surface`,
    with the selected row in `--accent-soft`.
- **Predecessor refinement.** `tasks/refinements/shell/tokens.md`: contrast is
  pinned at e2e-web because jsdom has no layout; the CSS carries no
  `prefers-color-scheme` query by design.

## Constraints / requirements

1. **`theme.css` stays verbatim.** The baseline lives in a new app-level
   stylesheet, `app/src/theme/controls.css`, imported by `App.jsx` right after
   `theme.css`. It holds:
   - **The `color-scheme` per theme:** `.est.theme-estante,
     .est.theme-caderno { color-scheme: light }` and `.est.theme-palco {
     color-scheme: dark }`. This is a property, not a media query, so it keeps
     the shell.tokens decision that the CSS never queries the device.
   - **The reset:** `.est button.row` back to the `.row` look. That means
     `width: 100%`, `background: none`, `border: 0` with `border-bottom: 1px
     solid var(--line)`, `font: inherit`, `color: inherit`, `text-align:
     start`, `cursor: pointer`, `appearance: none`, plus `.est
     button.row:last-child { border-bottom: 0 }`.
   - **The selected and explore fills restored:** `.est button.row.sel, .est
     button.row.explore { background: var(--accent-soft) }`. The baseline's
     specificity, (0,2,1), beats the theme's `.row.sel` at (0,2,0).
   - **Focus:** RAC's `[data-focus-visible]` ring is left as each screen draws
     it. The reset must not remove a focus indicator (no `outline: none`).
2. **The per-screen resets reduce.** In the four existing local resets
   (`file-view.css` 141–156, `books.css` 70–80, `search.css` 108–115,
   `song-history.css` 55–65), declarations that only restate the baseline are
   removed. Screen-specific ones (padding, the history row's own look) stay.
   The rendered look in Estante must not change; the existing e2e and
   `narrow_fit` / `full_height` checks are the guard.
3. **The New setlist row's amber moves into CSS.** The inline `style={{ color:
   'var(--accent)' }}` on `AddToSetlist.jsx` lines 33, 42 and 181 becomes
   classes in `setlist.css`, e.g. `.setlist-new-row .name, .setlist-new-row
   svg { color: var(--accent) }` and a `.setlist-pick-check` class. Every
   colour then lives in a stylesheet, and the unit test below covers it.
4. **`--ink-soft` becomes `--ink-2`** at `song-history.css` line 227. The
   boards' secondary ink is `--ink-2`; no theme defines `--ink-soft`.
5. **The fixture checks both themes, and leaves the page as it found it.**
   `checkA11y()`:
   1. Reads the current scheme with `matchMedia('(prefers-color-scheme:
      dark)').matches` in the page.
   2. Runs axe.
   3. Emulates the other scheme and waits for the theme to settle (two
      `requestAnimationFrame`s, after `useSyncExternalStore` has re-rendered).
   4. Runs axe again.
   5. Restores the original scheme.

   It fails on the union of violations, each labelled with the theme `.est`
   carried when it was found (read from the `theme-<name>` class, as
   `mockup.js` lines 61–75 do). Effects on specs:
   - A spec that chose an explicit theme runs the same theme twice. That is
     harmless; the explicit theme is what the user sees.
   - A spec that already emulated dark (`theme.spec.js`, `chart.spec.js`,
     `a11y-chart.spec.js`, `fonts.spec.js`) gets its Estante pass for free,
     and keeps its dark scheme afterwards.
   - Journeys that take `checkA11y` (`journeys-files.js` lines 17–23 and
     114–121; `journeys.js` lines 324–328) inherit the change unchanged.

   The direct `analyzeWcag21aa` call in `journeys-fork.js` line 39 also moves
   to the two-theme check, through a shared helper exported from `axe.js`
   (`analyzeBothThemes(page)`).
6. **Whatever the Palco pass finds on a visited screen is fixed in this task**,
   at its component, through tokens. No `disableRules`, no exclusion, no
   per-spec opt-out. The note's promise is "every label readable". If a
   finding is in `theme.css` itself, a drawn token pair that fails AA, it is
   fixed in **both** `docs/mockups/theme.css` and `app/src/theme/theme.css`
   with the same value, because the visual language is drawn there first.
   That edit is a design delta; record it under Decisions in the Status block.
7. **Accessibility rules stand.** Rows stay RAC `Button`s with their names and
   `aria-pressed`. Status is still carried by words. Nothing here changes
   roles or names.

## Acceptance criteria

Behavior delivered:

- In Palco, on phone, tablet and computer, these rows are drawn on the theme
  surface (`--surface`, or `--surface-2` inside `.setlist-repoint`) with
  readable ink, and the selected row on `--accent-soft`:
  - the file view tree and its history commit rows (W14)
  - the Add to setlist list and its amber New setlist… row (W12)
  - the setlist in-book picker results (W12)
  - every other `Button.row` listed above
- Every native control follows the theme's `color-scheme`.
- Estante and Caderno look as before.
- Every e2e `checkA11y()` holds the screen to WCAG 2.1 AA in Estante **and**
  Palco, on the three viewports.

Tests, by level:

- **unit** — `app/src/theme/tokens-used.test.js`. It reads every app
  stylesheet and component source through `import.meta.glob('../**/*.{css,jsx}',
  { query: '?raw', import: 'default', eager: true })` and pins:
  - (a) every `var(--name)` used is defined by `theme.css` (or locally in the
    same file). This catches the `--ink-soft` case.
  - (b) no stylesheet outside `theme.css` declares a colour literal (hex,
    `rgb()`/`hsl()` other than the black-alpha `rgba(0, 0, 0, …)` of a
    `box-shadow`, or a named colour on a `color`/`background`/`border`
    property). This pins the note's "a surface colour outside the theme
    tokens".
  - (c) no JSX carries an inline `style` colour. This catches the New setlist
    row's inline amber.
  - (d) `controls.css` sets `color-scheme: dark` on `.est.theme-palco` and
    `light` on Estante and Caderno.
- **behavior** — the listed rows take the theme surface under Palco, and axe
  is clean (structure rules) in Palco. Each test renders inside `<div
  className="est theme-palco">`, with `theme.css` and `controls.css` (imported
  `?raw`) injected as `<style>` elements, and asserts on
  `getComputedStyle(row)`:
  - `app/src/files/FileView.behavior.test.jsx`, new case "in Palco the tree
    and history rows reset the native button". With a tree and a history, each
    `button.row` reads `backgroundColor` `rgba(0, 0, 0, 0)` (shows the `.list`
    surface), the selected tree row's `background` names `var(--accent-soft)`,
    and `checkWcag21aa` passes. Pins workflow 14 §The view, W14.
  - `app/src/books/SetlistView.behavior.test.jsx`, new cases:
    - "in Palco the in-book picker results reset the native button": the
      editor's add-song and point-at picker, same assertions, axe clean. Pins
      workflow 12 §Songs moved, W12.
    - "in Palco the Add to setlist rows reset the native button and the New
      setlist row is amber through a class": rendering `AddToSetlist` as
      `SetlistView.behavior.test.jsx` / `SearchScreen.behavior.test.jsx`
      already do. The list rows and the New setlist… row are transparent;
      the New setlist name has no inline `style` and carries the class that
      `setlist.css` colours `var(--accent)`; axe clean. Pins W12.
  - `app/src/theme/ThemeRoot.behavior.test.jsx`, new case "a bare RAC
    Button.row inside .est resets to the row look in every theme". In each of
    `theme-estante`, `theme-caderno` and `theme-palco`, a `Button
    className="row"` and a `Button className="row sel"` read `background-color`
    transparent and an `accent-soft` background respectively, and `border-top`
    and `font` are inherited, not UA. This pins the baseline for every
    `Button.row` screen, including ShareSheet, SetlistsScreen, FirstRun,
    EnterShape and SongArrange.
- **e2e-web** — axe under both themes on every visited screen, on the three
  viewports:
  - `e2e/web/lib/axe.js`: `checkA11y()` and the new `analyzeBothThemes(page)`
    per constraint 5. Every existing `checkA11y()` call in the 46 specs now
    checks Estante and Palco, on phone, tablet and computer. The whole e2e-web
    suite passing is this task's main acceptance (DIRECTION §3.7, WCAG 2.1 AA;
    workflow 1 §The theme).
  - `e2e/web/tests/axe-fixture.spec.js`, new cases:
    - "the axe fixture catches a violation only Palco shows". Content is set
      with a `<style>` whose `@media (prefers-color-scheme: dark)` block paints
      low-contrast text. The page is light, the Estante pass alone is clean,
      and `checkA11y()` rejects with a message naming `color-contrast` and
      Palco (dark).
    - "the axe fixture restores the colour scheme it found": after
      `checkA11y()` on a light page `matchMedia('(prefers-color-scheme:
      dark)')` is still false, and after `emulateMedia({ colorScheme: 'dark'
      })` plus `checkA11y()` it is still true.
  - `e2e/web/tests/setlists.spec.js`:
    - "a deleted song becomes a missing item, pointed at another song and
      saved" gains `await checkA11y(); // the in-book picker, its results
      listed` after the search is filled (line ~222), so the point-at results
      are axe-checked in both themes.
    - "build a setlist from songs…" already checks the open Add to setlist
      dialog (line 58), which now covers its rows and the New setlist… row in
      Palco.
  - `e2e/web/tests/file-view.spec.js`: the existing checks on the tree (line
    82) and the history list (line 168) now cover those rows in Palco. No new
    case is needed.

No follow-up task is deferred.

## Decisions

1. **One app-level reset, not another per-screen one.** The defect is a
   pattern: `Button className="row"` drawn as a native button. Four screens
   had already patched it locally, and at least eight uses had not. Two
   alternatives were rejected:
   - Adding resets to the four named components fixes the audit's list and
     leaves the next `Button.row` broken.
   - Editing `.row` in `theme.css` contradicts its "verbatim from the
     mockups" contract (header lines 1–6). The boards draw rows as non-button
     elements, so the mockup CSS has nothing to fix.

   `controls.css` is the app's own layer under the drawn language: the place
   for what a running browser adds and a board does not. It sits beside
   `theme.css` and is imported once.
2. **Declare `color-scheme` per theme as well as resetting.** The reset fixes
   `.row`. `color-scheme: dark` is what makes the user agent's own surfaces
   (scrollbars, native checkboxes, autofill, any unstyled button) dark in
   Palco. It is a CSS property keyed on the theme class, so it does not
   reintroduce a `prefers-color-scheme` query (shell.tokens decision).
   Rejected: a `<meta name="color-scheme">`. That is page-wide and cannot
   follow an explicitly chosen Palco on a light device.
3. **The fixture flips the scheme in place, not a second Playwright project
   set.** Rejected: adding `colorScheme: 'dark'` projects (phone-dark,
   tablet-dark, computer-dark). That doubles every journey's runtime, not just
   its axe calls, and it skips the light pass for specs that emulate dark
   themselves. Flipping inside `checkA11y()` costs one extra axe run per call,
   checks exactly the states the specs already reach, and uses the mechanism
   `mockup.js` already relies on. It works because the automatic theme
   follows the device mode live (theme.spec.js lines 40–43).
4. **Restore the scheme the fixture found, read in the page.** Playwright has
   no getter for the emulated scheme. Reading `matchMedia` in the page is
   exact, and keeps a spec that emulated dark on dark after the check.
   `colorScheme: null`, as `mockup.js` uses, would silently undo such a spec's
   own emulation.
5. **Caderno is not added to the fixture.** Caderno is reachable only by an
   explicit choice. Flipping to it would mean a preference write in the middle
   of a test, which e2e specs may not inject (eslint rules). The note names
   both device-mode themes. Caderno's surfaces are light like Estante's, and
   the behavior test in ThemeRoot pins the reset in Caderno too.
6. **Behavior tests read computed declared styles, not contrast.** axe
   `color-contrast` does not run under jsdom (`app/src/a11y/axe.js` lines
   16–20), so "axe in Palco" at the behavior level pins the structure rules
   inside a Palco root. "The rows take the theme surface" is pinned by the
   cascaded `background-color` of each rendered row, with the real
   stylesheets injected. That checks the reset's selector matches what the
   component actually renders, which a grep cannot. Contrast itself is the
   e2e level's job, as shell.tokens decided.
7. **Fix in scope whatever the Palco pass finds.** Rejected: excluding a
   finding, or deferring it to a follow-up. The note's promise is "every label
   readable", and a test that is disabled to pass is not a check. A failing
   token pair in the drawn palette is fixed in both theme files: that is the
   only delta this task may make to the visual language, and it is recorded
   when it happens.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-18.

- `app/src/theme/controls.css` (new, imported by `app/src/App.jsx` after `theme.css`): a `color-scheme` per theme and one app-wide `button.row` / `button.act` reset, `:where(.est) button:where(.row)` at specificity (0,0,1) so screen rules such as `.add-choice[data-pressed]` still win. `theme.css` stays verbatim apart from the token below.
- Per-screen resets trimmed in `app/src/files/file-view.css`, `app/src/books/{books,setlist}.css`, `app/src/songs/{search,song-history}.css`; `--ink-soft` became `--ink-2`; the inline colours in `app/src/books/AddToSetlist.jsx`, `app/src/books/LeaveDialog.jsx` and `app/src/songs/SearchScreen.jsx` moved into classes (the New setlist row's amber is now CSS).
- Unit: `app/src/theme/tokens-used.test.js` (a–d: defined tokens, no colour literal outside the theme, no inline JSX colour, `color-scheme` per theme); `app/src/test/theme-styles.js` injects the real stylesheets, read from disk (Vitest returns `.css?raw` as empty), with a model of Chromium's button chrome so the tests can fail.
- Behavior: Palco row cases in `app/src/files/FileView.behavior.test.jsx` and `app/src/books/SetlistView.behavior.test.jsx` (in-book picker; Add to setlist and the amber New setlist row), and per-theme baseline cases in `app/src/theme/ThemeRoot.behavior.test.jsx`.
- E2e-web: `e2e/web/lib/axe.js` `checkA11y()` and the new `analyzeBothThemes(page)` check Estante and Palco and restore the scheme found; two new cases in `e2e/web/tests/axe-fixture.spec.js`; a picker check in `e2e/web/tests/setlists.spec.js`; eleven specs and `e2e/web/lib/journeys-fork.js` moved from direct `analyzeWcag21aa` to `analyzeBothThemes`.
- Design delta (Decisions): the Palco pass found white text on `#FF8A7A` in `.btn.danger` (2.29:1). A `--conflict-ink` token (`#FFFFFF` in Estante and Caderno, `#1A1300` in Palco, about 8:1) was added to `docs/mockups/theme.css` and `app/src/theme/theme.css` and used in `.btn.danger`. `color-scheme: dark` also turned the native `button.act` grey, so `controls.css` resets it.
- Deviation: the reset is at (0,0,1) rather than the (0,2,1) the refinement named, because (0,2,1) would have overridden screen rules and changed Estante; the theme's `.row.sel` / `.explore` fills win on their own.
- Watch: `EnterShape.behavior.test.jsx` "opens, places…" is slow (about 5s timeout in about half the full-suite runs); nothing it imports changed. Parked for a person.
