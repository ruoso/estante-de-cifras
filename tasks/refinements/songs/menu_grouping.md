# songs.menu_grouping — The song menu grouped

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) — `task menu_grouping "The song menu grouped"` (L228-233),
under `songs`; wired into `milestones.m5_complete` (`tasks/99-milestones.tji:45`).

## Effort estimate

0.25d.

## Repository

Not under `cifra.md/`. The work lands in `app/` (`app/src/songs/`,
`app/src/theme/controls.css`, `app/src/i18n/locales/`) and in the existing
e2e-web spec `e2e/web/tests/reading.spec.js`, whose order assertion the
regrouping changes.

## Inherited dependencies

- `design.review_polish` — **settled** (`complete 100`). Its item 5 decides
  the groups and their order; workflow 2 §The song's menu carries it, and the
  `Review-polish.dc.html` Computer frame draws it.
- `songs.reading_chrome` — **settled**. Decision 2: the menu holds every
  action on every device, and the toolbar buttons are shortcuts that stay.
- `songs.empty_states` — **settled**. It touches the same reading view; this
  task leaves it alone.

## What this task is

The ⋯ menu on the reading view lists eight actions in one flat run. This
task splits it into three named groups, each with a small visible header,
with a separator between them, in the order workflow 2 gives:

- **This song**: Edit, Arrange for {instrument} (left out while transposed),
  History, Show the file;
- **Take it along**: Add to setlist, Share, Print;
- **View**: Full screen.

It uses React Aria's `MenuSection` + `Header` + `Separator`, so a screen
reader names each group. The actions, their handlers, the trigger, the
popover surface and the toolbar shortcuts all stay as they are.

## Why it needs to be done

Usability review finding L7 (2026-10-19): eight flat items are hard to scan,
and a screen-reader user hears no structure. `design.review_polish` item 5
decided the grouping, and this task builds it. It is one of the
`milestones.m5_complete` leaves.

## Inputs / context

- `docs/workflows/02-find-and-play.md` §The song's menu (L129-139):
  the three groups, their order, a visible header as the screen-reader name,
  a separator between groups, and every action kept on every device.
- `tasks/refinements/design/review_polish.md`: item 5 (L244-251), the
  Computer frame (L298-303), the copy table row *⋯ menu group headers (new)
  | This song · Take it along · View* (L374), and Decision *Three named
  groups in the menu, the toolbar untouched* (L415-422). The last one
  rejects bare separators, a fourth group, and removing toolbar duplicates.
- `docs/mockups/Review-polish.dc.html:165-231` (the Computer frame) and
  `:291-293` (`menuGroups`). The board draws the header as `t-h3` with
  `padding: 6px 16px 2px`, and the separator as `border-top: 1px solid
  var(--line); margin: 6px 0` inside a `card` 260px wide. The board marks
  the visible header `aria-hidden` and labels the group with `aria-label`.
  That is a static-drawing stand-in; the build lets RAC label the group
  from its `Header`.
- `tasks/refinements/songs/reading_chrome.md` Decision 2 (L336-347): one
  menu, the same everywhere.
- `app/src/songs/SongReading.jsx:618-654`: `moreMenu` today. A flat `Menu`
  of eight `MenuItem`s with ids `edit`, `history`, `addToSetlist`, `print`,
  `share`, `showFile`, `arrange` (only when `!transposed`) and
  `fullScreen`, and one `onAction` switch on the key. The RAC imports are at
  L36-38.
- `app/src/theme/controls.css:58-110`: §4, the shared `.popover` surface and
  the `:where(.popover)` row rules for `[role='menu']` and `[role='menuitem']`.
  Nothing styles a menu section, header or separator yet.
- `app/src/i18n/locales/en.js:1629-1680`: the `reading` messages
  (`reading.more`, `reading.fullScreen`, `reading.showFile`, …). There are
  four locales in `app/src/i18n/locales/` (`en`, `pt-BR`, `es-419`, `it`).
  `app/src/i18n/i18n.test.js` already checks that every locale carries
  every key.
- `app/src/songs/SongReading.behavior.test.jsx`:
  - L1081-1190, the `songs.reading_chrome` block. `EIGHT` (L1088) pins the
    old order and is used at L1125, L1136, L1166 and L1182. The
    per-device test (L1116-1157) opens ⋯, checks the order, runs axe, uses
    Escape to get back to More, and reaches each item by ArrowDown + Enter.
    The transposed test (L1159-1170) checks the seven without Arrange.
    Show the file is at L1180-1190.
  - L611-648, the popover-surface test, which takes the first `menuitem`
    (still Edit).
- `e2e/web/tests/reading.spec.js:69` `MENU` (the old order), and L107-114:
  ⋯ opened by the keyboard, the items checked in order, Escape. This runs on
  the three viewports with `checkA11y` (L118). The journeys in
  `e2e/web/lib/journeys*.js` find menu items by name, so the regrouping does
  not affect them.

## Constraints / requirements

1. **The workflow's groups and order, exactly.** Groups *This song*, *Take
   it along*, *View*, in that order. Items as listed above. Arrange is left
   out of *This song* while transposed; the group itself stays. The menu is
   the same on every device (reading_chrome Decision 2).
2. **RAC only.** `MenuSection` (RAC ≥1.x exports it,
   `react-aria-components/dist/types/exports/index.d.ts:38`), `Header`
   (`:27`) and `Separator` (`:49`), inside the existing `Menu`. Each group
   is `role="group"` and takes its accessible name from its visible `Header`
   (RAC wires `aria-labelledby`). Pass an explicit `aria-label` on
   `MenuSection` only if the test shows RAC did not name it. Headers and
   separators are not focusable. ArrowDown/ArrowUp go straight from the last
   item of one group to the first of the next.
3. **Behavior unchanged.** The same item ids and the same `onAction` switch.
   No item gains, loses or renames an action. The trigger, its label
   (`reading.more`), the `popover` surface, `placement="bottom end"` and the
   Share-return ref stay as they are.
4. **Look from the board, tokens only.** A header in the small heading type
   (`t-h3`, as the board draws it, or the theme's equivalent rule) inset to
   the row padding. The separator is a 1px `var(--line)` rule with a small
   vertical margin. Add these rules to `controls.css` §4 as
   `:where(.popover) :where([role='menu']) …` rules, wrapped in `:where()`
   like the rows so screen rules keep winning, and so every grouped menu in
   the app shares them. Use only `var(--…)` tokens.
5. **Copy in four locales.** New keys `reading.menuThisSong`,
   `reading.menuTakeAlong` and `reading.menuView`. English: *This song*,
   *Take it along*, *View*. The builds translate them into pt-BR, es-419
   and it (suggested: *Esta música* / *Levar junto* / *Exibir*; *Esta
   canción* / *Para llevar* / *Ver*; *Questo brano* / *Da portare* /
   *Vista*).
6. **Accessibility.** axe at WCAG 2.1 AA, clean with the menu open: a
   `menu` holding `group`s and `separator`s is valid ARIA. The group name
   is a visible word, not a colour or a rule.

## Acceptance criteria

Behavior delivered: on the phone, tablet and computer, ⋯ opens one menu of
three named, separated groups in the workflow's order. Every action works
exactly as before. The toolbar shortcuts are unchanged.

Tests, by level:

- **unit**: `app/src/i18n/i18n.test.js` (existing, must pass). The four
  locales carry `reading.menuThisSong`, `reading.menuTakeAlong` and
  `reading.menuView` with matching placeholders (Constraint 5).
- **behavior**: `app/src/songs/SongReading.behavior.test.jsx`, in the
  `songs.reading_chrome` block (L1081-), with `EIGHT` replaced by the
  grouped order `['Edit', 'Arrange for Guitar', 'History', 'Show the file',
  'Add to setlist', 'Share', 'Print', 'Full screen']`:
  - *⋯ holds every action, on the {phone, tablet, computer}* (updated). On
    each device the menu has exactly three `group`s, named *This song*,
    *Take it along* and *View* in that order (`getAllByRole('group')` inside
    the menu, by accessible name). Each group holds its items in order, and
    there are two `separator`s. axe is clean with the menu open. Escape
    returns focus to More. ArrowDown from Edit reaches every item in the
    grouped order, crossing the group boundaries without stopping on a
    header or separator, and Enter on each calls its existing seam (workflow
    2 §The song's menu; review_polish item 5, "groups named for a screen
    reader, keyboard order").
  - *⋯ while transposed* (updated). Still three groups. *This song* holds
    Edit, History and Show the file, with no Arrange for (workflow 2 L136-137).
  - *Show the file in the ⋯ menu* (updated, L1180-1190). It reaches the item
    by its index in the new order.
  - *the popover surface* (L611-648) passes unchanged. The first item is
    still Edit.
- **e2e-web**: `e2e/web/tests/reading.spec.js`, *the reading chrome as
  drawn* (updated). `MENU` (L69) takes the grouped order. With the menu
  opened by the keyboard, it checks the three groups by name
  (`menu.getByRole('group', { name: 'This song' })` …), and `checkA11y` runs
  while the menu is open on phone, tablet and computer. This is the
  user-visible promise through the real UI: open a song, press ⋯.

Nothing is deferred.

## Decisions

1. **The visible `Header` names the group.** *Chosen:* a RAC `Header` inside
   each `MenuSection`, which labels the group by reference. A sighted user
   and a screen-reader user get the same word (workflow 2 L133-134).
   *Rejected:* copying the board's `aria-label` + `aria-hidden` header. That
   says the same name twice and lets the two drift; the board does it only
   because it is a static drawing.
2. **Shared section styling in `controls.css` §4, not in a reading-view
   stylesheet.** The popover row rules already live there for every menu. A
   header and separator rule in the same place means the next grouped menu
   (the file view's menus, for example) gets the drawn look for free.
   *Rejected:* a `song-menu`-scoped rule. Today it would have only one call
   site, but it would split one surface's rules across two files.
3. **The e2e-web level is added, not new.** The note's `Tests:` clause names
   only behavior. But `reading.spec.js` already checks the flat order on the
   three viewports, so it has to change. Making it check the groups, with
   axe while the menu is open, costs nothing extra and pins the promise
   through the real UI. No new spec file.
4. **The order follows the workflow, not the old list.** Arrange moves up
   next to Edit, and Print moves after Share. *Rejected:* keeping the old
   order inside groups. The workflow lists the order explicitly, and the
   tests pin it.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- The ⋯ menu on the reading view is three named groups, *This song* / *Take it along* / *View*, using React Aria `MenuSection`, `Header` and `Separator` (app/src/songs/SongReading.jsx); item ids, the `onAction` switch, the trigger and the toolbar are unchanged.
- Group headers use `t-h3`; the shared header and separator rules are in app/src/theme/controls.css §4, tokens only.
- New `reading.menu*` strings in app/src/i18n/locales/{en,pt-BR,es-419,it}.js, covered by the existing app/src/i18n/i18n.test.js.
- Behavior: app/src/songs/SongReading.behavior.test.jsx (`songs.reading_chrome` block) checks the groups by name, separators, ArrowDown order, Enter on each item, Escape, and axe.
- e2e-web: e2e/web/tests/reading.spec.js checks the grouped order and group names with axe while the menu is open, on phone, tablet and computer.
- No tech-debt follow-up.
