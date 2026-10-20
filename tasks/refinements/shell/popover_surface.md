# shell.popover_surface — Every popover and menu drawn on a surface

## TaskJuggler entry

`tasks/50-shell.tji` lines 134–138, task `shell.popover_surface` ("Every
popover and menu drawn on a surface"), under `task shell`. The note, verbatim:

> M7, M9: six RAC Popovers have no class and nothing styles .react-aria-Popover
> or a bare menu, so they render see-through over what is beneath —
> SongReading.jsx:412 (Transpose: its Written key label lands on the
> arrangement caption), :444 (variation Select), :565 (the ⋯ menu, which also
> opens off the right edge), PeopleScreen.jsx:123, SetlistView.jsx:278,
> WhichBook.jsx:66. Only the file view gets it right (className card
> file-create-menu, placement bottom end; files/file-view.css:146-158). One
> shared popover and menu surface for all of them, the ⋯ menu placed bottom
> end, and a check that fails on a Popover without it. Mind the theme root:
> overlays portal outside .est unless given a container inside it. Source:
> usability review 2026-10-19 (Claude in Chrome on the deployed app, findings
> verified against the code). Tests: unit or lint (no bare Popover); behavior
> (each popover has the surface class and tokens; axe); e2e-web (Transpose open
> over the arrangement caption and the ⋯ menu opened on the three viewports in
> all themes, nothing overlapping; axe).

Listed in `milestones.m3_service` (`tasks/99-milestones.tji` line 32). No
`depends`.

## Effort estimate

**0.5 day** (from the `.tji`). One stylesheet section, a class on eight
Popovers, two placements, one source-scanning unit test, behavior cases in the
files that already open these popovers, one e2e spec.

## Repository

**estante-de-cifras only** — app work, not a `cifra.md:` task.

- `app/src/theme/controls.css` — a new section 4: the shared `.popover`
  surface and its menu/list rows.
- `app/src/songs/SongReading.jsx`, `app/src/books/PeopleScreen.jsx`,
  `app/src/books/SetlistView.jsx`, `app/src/songs/WhichBook.jsx`,
  `app/src/files/CreateMenu.jsx`, `app/src/files/FileView.jsx`,
  `app/src/instruments/AddInstrumentForm.jsx` — the class (and placement) on
  each Popover; `app/src/files/file-view.css`, `app/src/instruments/instruments.css`
  — their per-screen surface lines folded into the shared class.
- `app/src/theme/popover-surface.test.js` — new unit test.
- The behavior files listed under Acceptance criteria; `e2e/web/tests/popover-surface.spec.js` — new.

## Inherited dependencies

None in `depends`. What this task stands on, all **settled** (complete):

- `shell.portal_provider` — `app/src/theme/ThemeRoot.jsx` lines 56–86 wraps
  the app in react-aria's `UNSAFE_PortalProvider` with
  `getContainer={() => rootRef.current}`, so every RAC Popover portals *inside*
  the `.est` theme root, app-wide. The note's "mind the theme root" is
  therefore already true in the app; this task only has to keep it true (and
  its behavior tests must render through `ThemeRoot` so the popover lands in a
  token scope, as `SetlistView.behavior.test.jsx` line 122 does).
- `shell.palco_contrast` — `app/src/theme/controls.css` (the app's own layer
  after the verbatim `theme.css`), `app/src/theme/tokens-used.test.js` (the
  source-scanning unit test precedent), `app/src/test/theme-styles.js`
  `injectStyles` (real stylesheets in jsdom), and `e2e/web/lib/axe.js`
  `checkA11y()` checking Estante and Palco on every call.
- `books.file_view_create_menu` — the one popover drawn right
  (`CreateMenu.jsx` line 33, `FileView.jsx` line 393: `card file-create-menu`,
  `placement="bottom end"`; `files/file-view.css` lines 146–177).
- The screens and journeys: `songs.reading`/`songs.reading_chrome`
  (`e2e/web/lib/journeys.js` `openExampleBook`, `openSongFromSearch` line 280),
  `account.preferences_layout` (`e2e/web/lib/journeys-account.js` `chooseTheme`
  line 235). The example book needs no sign-in.

Every named test is driven by existing UI paths; no new dependency.

## What this task is

Give every React Aria popover in the app — the menus, the Select list boxes
and the Transpose dialog — one opaque surface drawn from the theme tokens, so
nothing beneath shows through, and place the ⋯ menus at the trigger's end so
they never open off the right edge. Then pin it: a unit test fails on any
`<Popover>` without the shared class.

## Why it needs to be done

The usability review (2026-10-19) found the Transpose popover's *Written key*
label printed over the arrangement caption beneath it, and the reading ⋯ menu
see-through and cut off at the right edge — on the reading screen, the
screen a musician uses most. RAC components "carry no look of their own, so
the visual language applies as drawn" (`docs/DIRECTION.md` §3.7 lines
459–460); for a popover nothing was drawn on it, so it has no background at
all. `theme.css` defines no `.menu` rule although four of these popovers use
`className="menu"`. It blocks M3 (Estante online).

## Inputs / context

- `docs/DIRECTION.md` §3.7 lines 454–455 (menus, comboboxes among the React
  Aria parts), 459–460 (components carry no look of their own).
- `docs/mockups/theme.css` → `app/src/theme/theme.css` line 339 `.card`
  (`--surface`, `1px solid var(--line)`, `--radius`), line 371 `.dialog`
  (its shadow); `--surface`/`--surface-2` per theme at lines 192–193
  (Estante), 220–221 (Caderno), 250–251 (Palco).
- W14 #1 L58–63 (the file view board): a menu is "a card dropped under the
  trigger, about 210px wide" — the only board that draws a popover, and the
  model for all of them.
- The popovers (line numbers as of this writing; the note's are a few lines
  older):
  - `app/src/songs/SongReading.jsx` line 420 — Transpose (`DialogTrigger` →
    `Dialog.reading-transpose`); line 452 — variation `Select` →
    `ListBox.menu`; line 573 — the ⋯ `MenuTrigger` → `Menu.menu`.
  - `app/src/books/PeopleScreen.jsx` line 123 — a member's role menu.
  - `app/src/books/SetlistView.jsx` line 278 — the setlist ⋯ menu (Edit, Play).
  - `app/src/songs/WhichBook.jsx` line 66 — the new song's *Change book* menu.
  - `app/src/instruments/AddInstrumentForm.jsx` line 153 — `instr-popover`, a
    seventh one with its own surface (`instruments.css` lines 76–92).
  - `app/src/files/CreateMenu.jsx` line 33, `app/src/files/FileView.jsx` line
    393 — the file view's two.
- `app/src/songs/reading.css` lines 152–158 — `.reading-transpose`: flex,
  padding, min-width, no background (why the Transpose popover is clear).
- `app/src/theme/controls.css` — sections 1–3 (palco_contrast); its header
  says what belongs there: what a running browser adds and a board does not.
- `app/src/theme/tokens-used.test.js` — reads every `src/**/*.{css,jsx}` from
  disk; the model for the new unit test, and it will hold the new CSS to theme
  tokens too.
- `e2e/web/lib/fit.js` — `overlaps` line 175, `expectInsideViewport` line 180,
  `expectFits`; `e2e/web/tests/portal.spec.js` `assertTokenScoped`;
  `e2e/web/tests/reading.spec.js` lines 77–130 (the ⋯ menu by name *More*).

## Constraints / requirements

1. `theme.css` stays the boards' stylesheet verbatim; the shared surface lives
   in `controls.css`, using only theme tokens (`tokens-used.test.js` (a)–(b)
   holds it: the shadow is a black-alpha `rgba(0, 0, 0, …)` on `box-shadow`).
2. Every `<Popover>` in `app/src` (tests excluded) carries the `popover`
   class. A screen may add its own class beside it for width or layout
   (`file-create-menu`, `instr-popover`), never a second background.
3. The surface is opaque in all three themes: `background: var(--surface)`,
   `border: 1px solid var(--line)`, `border-radius: var(--radius)`, a
   shadow, `color: var(--ink)`, `overflow: auto` and a `max-height` RAC's
   `--visual-viewport-height` allows, so a long list scrolls inside it.
4. Rows inside it — `[role=menuitem]`, `[role=option]` — read as the drawn
   rows: at least 44px tall (the touch target the theme's `.btn` keeps), the
   focused row on `--surface-2`, a keyboard focus ring in `--accent`
   (`[data-focus-visible]`), a disabled one in `--ink-2`, a selected option
   marked by weight and a word or check, not colour alone. The file view's
   existing `.file-create-item` rules keep winning where they are more
   specific.
5. The ⋯ menus (reading, setlist) and the role menu (a trigger at a row's
   end) use `placement="bottom end"`, as the file view does; the others keep
   RAC's default (`bottom`, under the trigger).
6. Overlays stay inside `.est` through `ThemeRoot`'s provider — no screen adds
   a `UNSAFE_PortalContainer` of its own.
7. Accessibility: the popovers stay RAC (focus, Escape, arrow keys
   unchanged); axe at WCAG 2.1 AA with each open.
8. Test songs are the example book's or written for the purpose.

## Acceptance criteria

### Behaviour delivered

- Every popover in the app — Transpose, the variation picker, the reading ⋯,
  the setlist ⋯, the role menu, Change book, the instrument picker and the
  file view's New and More — is drawn on the theme surface with a border and
  a shadow, in Estante, Caderno and Palco; nothing beneath reads through it.
- The reading and setlist ⋯ menus and the role menu open under their trigger,
  right edges aligned, inside the viewport on phone, tablet and computer.
- A `<Popover>` without the shared class fails the unit suite.

### Tests, by level

**unit** — `app/src/theme/popover-surface.test.js` (new; reads sources from
disk as `tokens-used.test.js` does):

- "every Popover carries the popover surface class" — each `<Popover` opening
  tag in a non-test `.jsx` under `src/` has a `className` whose static string
  holds the `popover` token; the failure lists file:line. A self-check case
  feeds it a bare `<Popover>` snippet and expects it reported, so the scan can
  fail. *Pins:* the note's "a check that fails on a Popover without it".
- "the popover surface is drawn from the theme" — `controls.css` defines
  `.popover` with `var(--surface)`, `var(--line)`, `var(--radius)` and a
  `box-shadow`, and its rows a `--surface-2` focused fill. *Pins:* constraint 3,
  DIRECTION §3.7 lines 459–460.

**behavior** — each case renders inside `ThemeRoot` (the app's portal
container), injects `theme.css` + `controls.css` with `injectStyles`, opens
the popover by its trigger, and asserts: the popover element is a descendant
of `.est`, carries `popover`, its computed `background` resolves to
`var(--surface)` (jsdom keeps the `var()` text, as the palco_contrast cases
check `var(--accent-soft)`), and axe (`checkWcag21aa`) is clean with it open.

- `app/src/songs/SongReading.behavior.test.jsx` — "the Transpose popover,
  the variation picker and the ⋯ menu are drawn on the popover surface"
  (the variation picker with a two-variation tuning, as the existing
  "variation picker" describe at line 340 builds it; `renderReading` line 196
  already renders through `ThemeRoot`, the ⋯ opened by `openMore`). Placement
  needs layout, so the ⋯ menu's bottom-end alignment is pinned in the e2e
  spec, not here. *Pins:* M7 (Transpose, variation), M9 (⋯), workflow 2
  L67–70.
- `app/src/books/SetlistView.behavior.test.jsx` — "the setlist ⋯ menu is
  drawn on the popover surface" (new: no case opens this menu today; open it
  by its *More* label from `renderSetlist` line 120). *Pins:* the note,
  SetlistView.
- `app/src/books/PeopleScreen.behavior.test.jsx` — "a member's role menu is
  drawn on the popover surface". *Pins:* the note, PeopleScreen.
- `app/src/songs/NewSong.behavior.test.jsx` — "the Change book menu is drawn
  on the popover surface" (WhichBook with two writable books offered).
  *Pins:* the note, WhichBook.
- `app/src/instruments/instruments.behavior.test.jsx` — "the instrument
  picker is drawn on the popover surface". *Pins:* constraint 2.
- `app/src/files/FileView.behavior.test.jsx` — the existing *New* and narrow
  *More* cases additionally assert the `popover` class. *Pins:* the file view
  keeps its look under the shared class.

**e2e-web** — `e2e/web/tests/popover-surface.spec.js` (new; runs on the
phone, tablet and computer projects):

- "Transpose opens on a surface over the shapes caption, in every theme" —
  `openExampleBook`, `openSongFromSearch(page, 'Morning', 'Morning on the
  Porch')`, press *Transpose*. Then, once with the automatic theme (Estante,
  light) and once after `chooseTheme(page, 'Caderno')`, and under Palco by
  `page.emulateMedia({ colorScheme: 'dark' })` on the automatic theme: the
  popover is inside `.est`; its computed `background-color` is an opaque
  colour (alpha 1) equal to the `.est` root's resolved `--surface`; for every
  visible reading element under it whose box `overlaps` the popover's (the
  shapes caption `.reading-shapes p` among them, when the layout puts it
  there), `document.elementFromPoint` at the overlap's centre lands inside the
  popover — nothing prints through or over it; *Written key* is visible;
  `checkA11y()` with it open. *Pins:* M7, the note's "Transpose open over the
  arrangement caption … in all themes, nothing overlapping; axe".
- "the ⋯ menu opens under its trigger, inside the screen, in every theme" —
  on the same song, press *More* in each of the three themes: the menu's
  surface is opaque as above, `expectInsideViewport(page, menu)`, its right
  edge within 1px of the trigger's right edge and its top at or below the
  trigger's bottom (bottom end), every `menuitem` fully visible, and the same
  elementFromPoint check over the reading beneath; `checkA11y()` with it open.
  *Pins:* M9, the note's "the ⋯ menu placed bottom end … on the three
  viewports".

No follow-up task is deferred.

## Decisions

1. **One class, `popover`, in `controls.css` — not a wrapper component, not
   a global `.react-aria-Popover` rule.** *Rationale:* it is what the file
   view already does (a class on the Popover), it is one line per call site,
   and `controls.css` is where the app's browser-only layer lives
   (palco_contrast). *Rejected:* a `.react-aria-Popover` rule — RAC drops that
   default class as soon as a screen sets its own `className` (the file view,
   the instrument picker), so it would cover some popovers and silently not
   others; a `<SurfacePopover>` wrapper — a new seam with no behavior of its
   own, and every Select/MenuTrigger would import a second Popover; adding
   the rule to `theme.css` — that file stays the boards' verbatim sheet.
2. **The check is a unit test, not an ESLint rule.** *Rationale:*
   `tokens-used.test.js` already scans every source this way and lists
   offenders by file; an ESLint `no-restricted-syntax` selector can demand a
   `className` attribute but not that its value holds `popover`. The note
   allows either.
3. **The file view and the instrument picker join the shared class.**
   `file-create-menu` keeps its 210px width and flex column but drops `card`
   (the surface now comes from `popover`); `instr-popover` keeps its width and
   loses its own background, border, radius and shadow, and its focused
   option moves from `--accent-soft` to the shared `--surface-2`. *Rationale:* "one
   shared popover and menu surface for all of them" — two surfaces would
   drift. The note counts six bare ones; the instrument picker is the seventh
   with a hand-rolled surface.
4. **`bottom end` for the trigger-at-the-end menus; the default elsewhere.**
   The reading ⋯ and setlist ⋯ sit at the right end of an app bar, the role
   menu at a row's end — `bottom end` aligns the menu's right edge with the
   trigger, as the file view's ⋯ does. Transpose, the variation picker,
   Change book and the instrument picker open under a trigger with room on
   both sides; RAC's `bottom` stays.
5. **`className="menu"` stays where it is.** Nothing styles it and nothing
   needs to; the surface hangs on the Popover. Removing it is churn in files
   `songs.menu_grouping` (M5) will also touch.
6. **"All themes" in the e2e is Estante, Palco and Caderno.** `checkA11y()`
   already checks Estante and Palco on each call (palco_contrast Decision 4);
   Caderno is chosen through the account screen (`chooseTheme`) because the
   fixture does not cover it and its `--surface` differs.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- One shared opaque `.popover` surface and menu/option row style in `app/src/theme/controls.css` (section 4): `--surface`, `--line`, `--radius`, a black-alpha shadow, 44px rows, `--surface-2` focus fill, `--accent` focus ring.
- The class on all nine Popovers: `app/src/songs/SongReading.jsx` (Transpose, variation picker, ⋯), `app/src/songs/WhichBook.jsx`, `app/src/books/PeopleScreen.jsx`, `app/src/books/SetlistView.jsx`, `app/src/files/CreateMenu.jsx`, `app/src/files/FileView.jsx`, `app/src/instruments/AddInstrumentForm.jsx`; the file view and instrument picker per-screen surfaces folded in (`app/src/files/file-view.css`, `app/src/instruments/instruments.css`).
- The reading ⋯, setlist ⋯ and role menus open `bottom end`, right-aligned to their trigger.
- unit: `app/src/theme/popover-surface.test.js` — fails on any Popover without the class (with a self-check) and pins the surface to theme tokens.
- behavior: new cases in `SongReading`, `SetlistView`, `PeopleScreen`, `NewSong` and `instruments` behavior tests; the `FileView` New/More cases also check the class; `app/src/test/theme-styles.js` supports them.
- e2e-web: `e2e/web/tests/popover-surface.spec.js` — Transpose and the ⋯ menu in Estante, Caderno and Palco on phone, tablet and computer.
- Unrelated: `file-view-create.spec.js` phone fails in `backToTree` (`e2e/web/lib/journeys-files.js:40`) on HEAD too; parked in `tasks/parking-lot.md`.
