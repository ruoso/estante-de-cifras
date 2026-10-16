# account.preferences_layout — The account screen as drawn: compact theme rows, two columns on a computer

## TaskJuggler entry

[`tasks/70-account.tji`](../../70-account.tji) lines 64–69, task
`account.preferences_layout` ("The account screen as drawn: compact theme rows,
two columns on a computer"), under `task account`. It `depends !account_screen`
and sits in the polish milestone `milestones.m5_complete`
(`tasks/99-milestones.tji` line 44). The note, verbatim:

> The Estante, Caderno and Palco rows of the theme picker grow to about 850px
> each (the Theme list is about 2600px on a phone): the non-split swatch carries
> the theme root classes and stretches to the row
> (app/src/account/AccountScreen.jsx:145-159, account.css:147-150); the board
> draws 56px rows with a 52x40 swatch. On a computer the screen is one narrow
> column; the Theme-picker and W13 boards lay identity and sign-out in a left
> rail and Theme and Language beside devices and passkeys. Source: UI audit
> 2026-10-14 (app screens vs rendered boards; e2e/web/lib/mockup.js). Tests:
> behavior (each theme row the swatch height, axe); e2e-web (the account screen
> on the three viewports, mockup Theme-picker#1-4 and W13#4).

Two corrections to the note, both checked against the files: the line numbers
have moved (the swatch is now `AccountScreen.jsx:213-229`, its CSS
`account.css:147-180`); and the computer board does not put Theme and Language
beside devices and passkeys. Theme-picker #4 puts Theme beside Density and
Chord diagrams beside Language, with devices and passkeys full width below
(see Inputs). The boards govern, and this refinement follows them.

## Effort estimate

**1 day** (from the `.tji`). The work is a one-line CSS scoping fix with its
ThemeRoot class, then moving the self sign-out into the identity block, then
one computer arrangement of regions that already exist (a media-query hook
and CSS). The tests are two behavior files and one e2e-web spec.

## Repository

**estante-de-cifras only.** The work lands in `app/src/` (`account/`,
`theme/ThemeRoot.jsx`, `shell/shell.css`, `shell/layout-mode.js`) and the
e2e-web harness (`e2e/web/tests/`, plus one label in
`e2e/web/lib/mockup-frames.json`). This is not format work: the note does not
start with `cifra.md:`. Nothing touches the service, the API or cifra.md.

**Design delta (already written; rides in this task's commit):**
`docs/workflows/13-new-device.md` §The account screen gains a closing paragraph
covering three points:

- who is signed in sits with *sign out of this device*;
- phone and tablet are one column;
- on a computer, a left rail holds title, identity and sign-out (or the way to
  sign in), and beside it Preferences sit in two columns (theme | density,
  chord diagrams | language) with devices, passkeys, recovery email and Leaving
  Estante full width below, the reading order unchanged.

This puts into the workflow what the Theme-picker and W13 boards already draw.

## Inherited dependencies

Settled (all `complete 100`):

- `account.account_screen` built `AccountScreen.jsx`, which is a full screen
  over the shell, mounted at `AppShell.jsx:729-737`. It contains the Theme
  `RadioGroup` of `PickerRow`s and the `ThemeSwatch` live preview.
- `shell.display_preferences` added Density and Chord diagrams (Hand and Neck
  tiles) between Theme and Language (`AccountScreen.jsx:509-607`).
- `account.sign_out` added `SignOutDialog`, whose trigger *Sign out of this
  device* currently sits on the current session's row (`AccountScreen.jsx:647-680`)
  and in `offlineSignedOutRegion` (754-770).
- `account.recovery_email` (`RecoveryEmailRegion`) and `account.leaving`
  (`LeaveDialogs`) follow Passkeys.
- `shell.full_height` added the frame rule `.est { height: 100dvh; display:
  flex; flex-direction: column }` (`app/src/shell/shell.css:30-34`, print
  release 151-158). That rule causes the defect.
- `shell.narrow_fit` added `e2e/web/lib/fit.js` (`expectFits`,
  `expectInsideViewport`, `overlaps`). Its spec visits the account screen
  (`narrow-fit.spec.js:228`) and must keep passing.
- `account.sign_in` and the virtual-authenticator journeys provide
  `signedInDevice` (`e2e/web/lib/journeys.js:129`) and `openAccount`
  (`e2e/web/lib/journeys-account.js:31`).

Nothing is pending.

## What this task is

The task makes the account screen look as the boards draw it.

1. **Compact theme rows.** The Estante, Caderno and Palco swatches stop
   stretching to the window's height. Each theme row becomes a normal picker
   row: a 52×40 swatch on a phone and 60×44 on a tablet or computer (the
   boards), inside the row's usual padding.
2. **Sign out beside who is signed in.** *Sign out of this device* moves from
   this device's row in the devices list to the identity block (name, *Signed
   in on this device*, the button). This is where the tablet and computer
   boards draw it, and it lets the computer rail hold it.
3. **Two columns on a computer.** At ≥1080px the screen is a split:
   - **Left rail** (300px): the back button and the *Account* title, then who
     is signed in and *Sign out of this device*. When not signed in, the rail
     holds the not-signed-in card; while loading or on error it holds that
     state.
   - **Main pane:** Preferences, with Theme beside Density and Chord diagrams
     beside Language (320px). Below them, full width: Signed-in devices,
     Passkeys, Recovery email and Leaving Estante.

   Phone and tablet keep the one column.

## Why it needs to be done

The UI audit of 2026-10-14 compared app screenshots taken by
`e2e/web/lib/mockup.js` with the rendered boards. On a phone the Theme list is
about 2600px tall, because three of its four rows are each one viewport high.
On a computer the account screen is a 560px column in the middle of 1280px.

The cause of the tall rows:

- Each non-split swatch carries `est theme-<id>` (`AccountScreen.jsx:226`) so
  that the theme's tokens cascade into it.
- The frame rule `.est { height: 100dvh; display:flex; flex-direction:column }`
  (`shell.css:30-34`) meant for ThemeRoot's wrapper matches the swatch too.
- That rule has the same specificity as `.account-swatch { height: 40px }`
  (`account.css:149`) and comes later in the bundle (shell.css is imported by
  `AppShell.jsx:60`, after account.css by `AccountScreen.jsx:74`), so it wins.
- Automatic's split swatch is spared because its outer box carries no `.est`
  and clips its two halves.

The task is in the M5 polish milestone, and nothing downstream depends on it.

## Inputs / context

Governing documents:

- `docs/workflows/13-new-device.md` §The account screen (L134–172 after the
  delta). Its regions in order are Preferences (theme, density, chord diagrams,
  language), Signed-in devices, Passkeys, Recovery email. "each chosen one
  marked by a word, never colour alone". The delta adds the layout paragraph.
- `docs/workflows/17-leaving.md` L23–24: *Leaving Estante* sits at the foot of
  the account screen, below Passkeys.
- `docs/DIRECTION.md` §6 L592–598: the theme picker is a Preferences section of
  the account screen.
- Boards. Frames are `(board, index)` in `e2e/web/lib/mockup-frames.json`, and
  `mockup()` (`mockup.js:45`) only takes screenshots and asserts nothing.
  - `docs/mockups/Theme-picker.dc.html` #1 (phone, L29–122), not signed in:
    - Preferences: Theme, Density, Chord diagrams, Language, then the
      not-signed-in card.
    - Theme rows are `gap:12px` with the swatch `52×40, border-radius 8px,
      1px var(--line)`.
    - Automatic is split (L43: two `flex:1` `.est.theme-estante` /
      `.est.theme-palco` halves, *G* 13px). The others are plain (L49, 54, 59:
      one `.est.theme-X` box, *G* 16px).
    - The row height comes from `.row` (`min-height:44px`, padding `1.5u`;
      `docs/mockups/theme.css:189`). That gives the ~56px row the note
      describes, not hundreds of pixels.
  - Theme-picker #2 (phone, L124–184), signed in with Palco: the same 52×40
    swatch.
  - Theme-picker #3 (tablet, L188–301), Caderno, roomy:
    - The identity row comes first, with *Sign out of this tablet* pushed right
      (L198).
    - Preferences are in two columns (flex 1 | 340px), with 60×44 swatches.
    - Then devices | passkeys.
  - Theme-picker #4 (computer, L304–441), compact. It is a `.split`:
    - **Rail** (L309–316): `.pane.side` at `width:300px`, inner `padding:22px
      20px; gap:14px`. It holds the *Account* `t-h1`, a 44px avatar with name
      (`t-h2`) and email (`t-small`), and a `btn block` *Sign out of this
      computer*.
    - **Main pane** (L320–): scroll `padding:24px 32px; gap:16px`, holding:
      - *Preferences* `t-h3`;
      - row A (L322, `flex; gap:28px; align-items:flex-start`): Theme (flex 1,
        60×44 swatches) | Density (flex 1);
      - row B (L365): Chord diagrams (flex 1) | Language (`width:320px; flex:none`,
        L411);
      - then Signed-in devices (L425) and Passkeys (L431), full width.
  - `docs/mockups/W13-new-device.dc.html` #4 (computer, L142–200):
    - The rail is the same as Theme-picker #4 (L147–154).
    - The main pane has devices then passkeys.
    - A sign-out dialog is drawn over it.
- `e2e/web/lib/mockup-frames.json:42` labels Theme-picker #3 "Preferences
  beside devices and passkeys". This is out of date: the board's own label
  (Theme-picker L190) says "Preferences in two columns, devices and passkeys
  below".

Code seams:

- `app/src/account/AccountScreen.jsx`:
  - `THEME_OPTIONS` 87–91;
  - `ThemeSwatch` 213–229;
  - `PickerRow` 231–251;
  - `preferencesRegion` 509–607 (Theme `RadioGroup` 513–526, Density 528–545,
    Chord diagrams 547–593, Language 595–606);
  - `notSignedInCard` 611–622;
  - `identityRow` 624–645;
  - `devicesRegion` 647–683 (`SignOutDialog` on the current row at ~669);
  - `passkeysRegion` 692–746;
  - `offlineSignedOutRegion` 754–770;
  - `signedInRegions` 772–814;
  - the screen frame 816–831 (`.screen.account-screen` › `.appbar` ›
    `.scroll.account-scroll` › `.account-card.account-screen-card`).
- `app/src/account/account.css`:
  - `.account-screen` 7–12;
  - `.account-scroll` 14–22;
  - `.account-card` 26–32;
  - `.account-screen-card` 81–84 (`max-width:560px`);
  - `.account-swatch` 147–163;
  - `.account-swatch-half` 169–180;
  - the only media query, `(min-width: 600px)`, at 568–575.
- `app/src/account/SignOutDialog.jsx:130`: the trigger `<Button
  className="btn">{t('account.signOutThis')}</Button>` (en *Sign out of this
  device*).
- `app/src/theme/ThemeRoot.jsx:76`: `<div ref={rootRef}
  className={themeClasses(applied, density)}>`.
- `app/src/theme/resolve.js:43-47`: `themeClasses` returns `est theme-<x>
  density-<y>`, "every board sets exactly this".
- `app/src/shell/shell.css:24-45` and `151-158`: the frame rule and its print
  release.
- `app/src/shell/layout-mode.js`:
  - `WIDE_QUERY` 600px (L22);
  - `BOOKS_WIDE_QUERY` and `READING_ACTIONS_WIDE_QUERY` 1080px (L36, L44),
    each with a comment saying why. This is the precedent for a per-screen
    computer query.
  - Components subscribe with `matchMedia` and `useSyncExternalStore`
    (`AppShell.jsx:62-67`, `BooksScreen.jsx:67-72`).
- Tests:
  - `app/src/account/AccountScreen.behavior.test.jsx`:
    - `installMatchMedia()` 105–112 (fixed `matches:false`);
    - `renderAccount` 134–143 (ThemeRoot › LocaleRoot › AccountScreen);
    - `rootOf` 132 (the first `.est`);
    - theme tests 172, 198;
    - sign-out lookups by name at 384, 586;
    - axe via `checkWcag21aa` (`app/src/a11y/axe.js`).
  - `e2e/web/tests/account-screen.spec.js` already calls `mockup(page,
    'Theme-picker', 1|2|3|4)` (60, 137–139) and `mockup(page,
    'W13-new-device', 4)` (106).
  - `sign-out.spec.js:88,124` finds the sign-out button by name only.
  - Playwright projects (`playwright.config.js:40-42`): phone Pixel 7 at
    412px, tablet Galaxy Tab S4 at 712px, computer Desktop Chrome at 1280px.

Predecessor refinement: `tasks/refinements/account/account_screen.md`
(Decision 1: one `AccountScreen.jsx`; Decision 7: no design delta, the screen
realises workflow 13 and the boards).

## Constraints / requirements

- **The view only.** This is CSS and composition. The Worker, the preferences
  slice and the auth client are unchanged.
- **One theme root frame.** Only ThemeRoot's wrapper is the window-height
  flex frame. Elements that carry `est theme-*` for token scope (the swatches,
  and any future preview) are never framed.
- **Reading order is workflow 13's order on every viewport.** The order is:
  - the who-block (or not-signed-in card / loading / error);
  - Theme, Density, Chord diagrams (Hand, Neck), Language;
  - devices, passkeys, recovery email, Leaving.

  The computer split arranges that DOM order: the rail's content comes first
  in the DOM, and the two-column rows pair consecutive regions. No CSS `order`
  or grid placement may make focus order differ from visual order (WCAG 2.4.3,
  1.3.2).

  On a phone and a tablet the order stays as today (Preferences first, then
  the signed-in regions), as Theme-picker #1/#2 draw. Only the self sign-out
  moves into the identity block.
- **One *Sign out of this device* button** on the screen, on every viewport.
  Two identically named buttons would be ambiguous to a screen reader and to
  `getByRole`.
- **Accessibility.**
  - Everything interactive stays RAC.
  - The swatch stays `aria-hidden`, and the row's name is the label.
  - *Selected* stays a word.
  - Do not add an unlabelled `aside` or other landmark for the rail. If the
    rail is a landmark, it is a labelled one, and axe must stay clean.
  - Axe clean at WCAG 2.1 AA on every state touched, on all three viewports
    and in Palco.
- **Nothing overflows.** The computer layout and the phone and tablet columns
  pass `expectFits` (`e2e/web/lib/fit.js:38`), and `narrow-fit.spec.js` keeps
  passing.
- **Copy unchanged.** The button stays *Sign out of this device* on every form
  factor (the boards' *this computer* / *this tablet* is drawing copy). There
  are no new i18n keys unless the rail needs one, and if it does, it goes in
  all four locales.
- **Offline first** is untouched.

## Acceptance criteria

### Behavior delivered

1. **The frame rule targets ThemeRoot only.**
   - ThemeRoot's wrapper gains a frame class (`est-frame`):
     `className={\`${themeClasses(applied, density)} est-frame\`}`.
     `themeClasses` stays the boards' exact `est theme-<x> density-<y>`.
   - `shell.css`'s frame rule (L30–34) and its print release (L151–158) move
     from `.est` to `.est-frame`.
   - `.est .scroll` (L43) is unchanged.
   - Nothing else in `app/src` carries `est-frame`.
2. **Theme rows are compact.**
   - The Estante, Caderno and Palco swatches render 52×40 below 600px and
     60×44 at ≥600px (one `@media (min-width: 600px)` rule beside the existing
     one in `account.css`), with *G* at 16px / 18px as drawn.
   - Automatic's split swatch is the same size, with *G* at 13px / 15px.
   - Each theme row is the swatch height plus the row's padding.
3. **The identity block holds the self sign-out.**
   - `identityRow` becomes a block: avatar, name or *Signed in*, *Signed in on
     this device* (`role="status"` as today), and the `SignOutDialog` trigger.
   - The current session's row in `devicesRegion` keeps its name (*This
     device*) and meta (*In use now · …*) but no longer has a button.
   - `offlineSignedOutRegion` keeps the identity block (with sign-out) and its
     offline note, and drops the one-row devices list that only existed to
     carry the button.
   - On a phone and a tablet the button sits at the end of the identity row
     (`margin-left:auto`, wrapping below the text when the row is too narrow,
     never clipped). On a computer it is a `btn block` under the identity in
     the rail.
4. **The computer split.**
   - `ACCOUNT_WIDE_QUERY = '(min-width: 1080px)'` goes in `layout-mode.js`,
     with a comment in the shape of `BOOKS_WIDE_QUERY`'s. The reason it is
     1080 and not 600: the 712px tablet has no room for a 300px rail beside
     two preference columns.
   - `AccountScreen` subscribes to it the way `AppShell` subscribes to
     `WIDE_QUERY`.
   - When it matches, the screen renders `.split.account-split`:
     - **Rail:** `.pane.side.account-rail` (`width:300px`, `padding: 22px
       20px`, `gap:14px`). It holds the back button and the *Account* title
       (the appbar's two parts, as the rail's head), then whatever the
       signed-in state has as its who-block:
       - signed in: the identity block with the `btn block` sign-out;
       - not signed in: `notSignedInCard`;
       - loading: the status line;
       - error: the `ErrorNotice`, or the offline identity block and note.
     - **Main:** `.pane.main` with a `.scroll` at `padding: 24px 32px; gap:
       16px`. It holds:
       - *Preferences*;
       - row A: Theme | Density, each `flex:1; min-width:0`, `gap:28px`,
         `align-items:flex-start`;
       - row B: Chord diagrams (`flex:1`) | Language (`width:320px; flex:none`);
       - then, full width: the action `ErrorNotice` (if any), devices,
         passkeys, `RecoveryEmailRegion`, `LeaveDialogs`.
   - Below 1080px the current one-column card is rendered (560px max) with
     the same regions in the same order.
   - The regions are the same JSX values arranged twice. They are not
     duplicated components.
5. **The stale frame label.** In `e2e/web/lib/mockup-frames.json` the
   Theme-picker #3 label is corrected to the board's own label, and #4 to
   "…Preferences in two columns, devices and passkeys below".

### Tests, by level

- **unit, `app/src/shell/layout-mode.test.js`:** `ACCOUNT_WIDE_QUERY` is
  `'(min-width: 1080px)'`, beside the existing `BOOKS_WIDE_QUERY` /
  `READING_ACTIONS_WIDE_QUERY` cases. *Pins:* workflow 13 §The account screen
  (as amended): the computer split engages on the computer, not on the
  712px tablet.
- **behavior, `app/src/theme/ThemeRoot.test.jsx`:** the wrapper carries
  `est-frame` alongside `est theme-<x> density-<y>`, in each theme and
  density. *Pins:* the one-frame constraint; shell.full_height's frame still
  applies to the app root.
- **behavior, `app/src/account/AccountScreen.behavior.test.jsx`.** jsdom
  computes no layout, so this level pins the structure that decides the
  height, and the e2e level measures it (Decision 2):
  - *each theme row is a swatch row, not a frame*:
    - the rendered tree holds exactly one `.est-frame`, ThemeRoot's wrapper;
    - in each of the four Theme radios, the swatch is `aria-hidden`;
    - Estante, Caderno and Palco carry `est theme-<id> account-swatch` and
      not `est-frame`;
    - Automatic's halves carry `est theme-estante` / `est theme-palco` and not
      `est-frame`;
    - axe clean.
    - *Pins:* the note's defect; workflow 13 "each chosen one marked by a
      word" (the *Selected* badge still on the chosen row).
  - *signed in, sign-out beside the identity*:
    - exactly one button named *Sign out of this device*, inside the element
      holding *Signed in on this device*;
    - the *This device* row in the Signed-in devices list contains no button;
    - pressing it opens the existing *Sign out of this device?* dialog;
    - axe clean.
    - The existing cases at 384 and 586 keep passing unchanged.
    - *Pins:* workflow 13 §The account screen (as amended); Theme-picker #3,
      W13 #4.
  - *offline, signed in*: the identity block, the offline note and the one
    sign-out button; no devices list. *Pins:* account.sign_out offline
    teardown still reachable.
  - *computer composition* (`installMatchMedia` variant whose
    `ACCOUNT_WIDE_QUERY` matches):
    - Signed in: the back button, *Account* title, identity and sign-out come
      before the Theme radiogroup in document order.
    - Theme, Density, Hand, Neck and Language radiogroups follow in that
      document order, then the *Signed-in devices* and *Passkeys* headings,
      the recovery-email region and *Leaving Estante*
      (`compareDocumentPosition`).
    - Theme and Density share one row container, and Chord diagrams and
      Language share the next.
    - Not signed in: the *Use a passkey* / *Email me a link* card precedes the
      Theme radiogroup.
    - Axe clean in both.
    - *Pins:* workflow 13 §The account screen order (as amended), Theme-picker
      #4.
  - *phone and tablet composition* (default stub, no match): Preferences come
    before the identity block, as today; no `.account-split`. *Pins:*
    Theme-picker #1/#2.
- **e2e-web, `e2e/web/tests/account-layout.spec.js`** (new). It uses `test` /
  `expect` from `../lib/axe.js` and real-UI journeys only (`startApp`,
  `signedInDevice`, `openAccount`, `chooseTheme`, `chooseDensity`), with
  `expectFits` / `overlaps` from `../lib/fit.js`. It runs on phone, tablet and
  computer through the config projects:
  - *theme rows are compact, not signed in*:
    - `openAccount`;
    - for each of the four Theme radios, its row's swatch (`[aria-hidden] `
      inside the radio's label) measures 52×40 on phone and 60×44 on tablet
      and computer (±1px);
    - each row's height is under `swatch height + 40px`;
    - the Theme radiogroup's height is under 400px;
    - `expectFits(page)`;
    - `mockup(page, 'Theme-picker', 1)` (phone), `mockup(page, 'Theme-picker', 3)`
      (tablet), `mockup(page, 'Theme-picker', 4)` (computer), each a no-op on
      the other projects;
    - axe.
    - *Pins:* the note's ~850px rows; Theme-picker #1/#3/#4 swatches.
  - *the same, in Palco and roomy*:
    - `chooseTheme(page, 'Palco')`, `chooseDensity(page, 'Roomy')`, then
      reopen;
    - the same row bounds hold;
    - `mockup(page, 'Theme-picker', 2)` (phone);
    - axe (Palco contrast on the swatches and the badge).
    - *Pins:* Theme-picker #2; the defect is not theme-dependent.
  - *signed in, the layout*:
    - `signedInDevice`, `openAccount`.
    - Every viewport:
      - one visible *Sign out of this device* button;
      - its box lies inside the viewport and within the identity block's
        vertical extent;
      - `expectFits(page)`.
    - Computer:
      - the sign-out button and the *Signed in on this device* text are left
        of the Theme radiogroup (box right ≤ the radiogroup's left);
      - the Theme and Density radiogroups' boxes start at the same top (±4px)
        and do not overlap (`overlaps` false), and the same holds for the
        Chord diagrams and Language groups;
      - the *Signed-in devices* heading is below the bottom of both
        preference rows.
      - `mockup(page, 'Theme-picker', 4)`, `mockup(page, 'W13-new-device', 4)`.
    - Phone and tablet:
      - Theme, Density and Language radiogroups are stacked (each top ≥ the
        previous bottom);
      - the identity block is below Language;
      - `mockup(page, 'Theme-picker', 3)` on tablet.
    - axe.
    - *Pins:* workflow 13 §The account screen (as amended); the note's
      "two columns on a computer"; Theme-picker #3/#4 and W13 #4.

  Existing specs keep passing unchanged: `account-screen.spec.js`,
  `sign-out.spec.js` (button by name), `narrow-fit.spec.js` (account screen
  fit), `theme.spec.js` and the `div.est.first()` lookups in
  `journeys-account.js` (ThemeRoot's wrapper is still the first `.est`).

**Every test can be driven.** The account screen (`account.account_screen`),
sign-in with a virtual authenticator (`account.sign_in`, `signedInDevice`),
sign-out (`account.sign_out`), the density and diagram preferences
(`shell.display_preferences`) and the fit helpers (`shell.narrow_fit`) are all
`complete 100`. No hosted book, second person or second device is needed.

No test level is dropped. No test is deferred. No deferred WBS leaf.

## Decisions

1. **Scope the frame rule to ThemeRoot with a frame class; do not raise the
   swatch's specificity.**
   - The defect is that a rule meant for one element matches every element
     carrying `.est`. Any future preview that borrows a theme's tokens (a
     density sample, a Palco preview) would hit the same rule.
   - `est-frame` on the wrapper makes the frame explicit at its one owner.
   - *Rejected:*
     - `.est.account-swatch { height: 40px; flex-direction: row }`: it fixes
       one victim and leaves the trap.
     - `#root > .est`: it couples CSS to the mount point, and test renders
       (`renderAccount`) do not mount under `#root`.
     - Adding the class inside `themeClasses`: `resolve.js` documents that
       function as the boards' exact class set, which the swatch halves also
       use conceptually.
2. **Behavior pins the cause; e2e measures the height.**
   - The note asks behavior to check "each theme row the swatch height".
     jsdom computes no layout and the app's Vitest does not process CSS
     (`app/src/a11y/axe.js`; no `getComputedStyle` test exists for this), so
     a height read in jsdom would be 0 whatever the CSS says.
   - The behavior level therefore pins the structural cause (exactly one
     frame, no swatch carrying it), plus axe.
   - The e2e-web level measures each row's and swatch's real box on the three
     viewports.
   - Both levels the note names are kept.
3. **The computer split engages at 1080px, not at `WIDE_QUERY` (600px).**
   - The board draws a 300px rail plus two preference columns (flex 1 | 320px)
     in 32px padding. At the 712px tablet that leaves the Theme column under
     300px for a 60px swatch, a name, a meta line and the *Selected* badge,
     which squeezes the meta to a word per line (the failure `narrow_fit`
     pins).
   - 1080 is already the app's computer line for screens that need a second
     column (`BOOKS_WIDE_QUERY`, `READING_ACTIONS_WIDE_QUERY`).
   - The tablet keeps today's single 560px column. The tablet board's (#3)
     two preference columns are drawn at 792px with a 340px right column and
     would not fit the 712px test tablet either. That is a judgment on the
     tablet board, not a gap in this task, and it is surfaced for the parking
     lot rather than deferred.
4. **The rail follows Theme-picker #4, not the note's summary.** Theme pairs
   with Density and Chord diagrams with Language, and devices and passkeys are
   full width below, as drawn (L322, L365, L411, L425). Pairing consecutive
   regions keeps the DOM, reading and focus order equal to workflow 13's order
   with no CSS reordering. *Rejected:* "Theme and Language beside devices and
   passkeys" (the note's wording), which is neither what the board draws nor
   achievable without visual reordering.
5. **Self sign-out moves to the identity block on every viewport.**
   - Both boards that show a signed-in identity (Theme-picker #3 tablet, #4
     and W13 #4 computer) draw it there.
   - Doing it everywhere keeps one place, one button and one set of tests
     instead of a viewport-dependent position.
   - The *This device* row keeps its information (*In use now*) without a
     button, because the action is beside who is signed in.
   - *Rejected:* keeping it on the row and duplicating it in the rail (two
     same-named buttons); moving it only on a computer (two code paths for
     one action).
   - This is the one behavioral change, and it is in the workflow 13 delta.
6. **The arrangement is chosen in JSX by a media query, not by CSS grid
   placement alone.**
   - The rail needs the who-block first in the DOM on a computer, while the
     phone keeps Preferences first (Theme-picker #1/#2). Only re-rendering
     changes DOM order without breaking reading order.
   - The regions stay single JSX values, arranged by two small layouts.
   - This follows the `AppShell`/`BooksScreen` pattern (`matchMedia` +
     `useSyncExternalStore`).
7. **Copy stays *Sign out of this device*.** The boards' *this computer* /
   *this tablet* would need form-factor detection that the app does not do,
   and new copy in four locales for no change in meaning.
8. **The design delta is small and descriptive.** Workflow 13 said nothing
   about layout. The paragraph records the order constraint, the identity /
   sign-out pairing and the computer arrangement the boards draw. DIRECTION
   is unchanged.

## Open questions

(none — all decided)

For the parking lot (a product judgment on a board, not a WBS task): the
Theme-picker tablet board (#3) draws two preference columns and devices beside
passkeys at 792px. The app keeps the tablet as one column (Decision 3) because
the 712px test tablet cannot fit it. Either the board is redrawn as one
column, or a tablet breakpoint is chosen for it.

## Status

**Done** — 2026-10-15.

- The window-height frame moved to ThemeRoot's `est-frame` class (`app/src/theme/ThemeRoot.jsx`, `app/src/shell/shell.css`), so the theme swatches are 52×40 / 60×44 rows instead of one viewport high (`app/src/account/account.css`).
- *Sign out of this device* moved into the identity block (`app/src/account/AccountScreen.jsx`, `app/src/account/SignOutDialog.jsx` gains a `block` prop); the devices list row and the offline devices list no longer carry it.
- At ≥1080px the screen is a 300px rail beside Preferences in two columns (Theme | Density, Chord diagrams | Language), with devices, passkeys, recovery email and Leaving full width below; `ACCOUNT_WIDE_QUERY` is in `app/src/shell/layout-mode.js`.
- Beyond the refinement: `.account-scroll` uses `safe center` so a tall column stays scrollable to its head; row descriptions wrap inside the two columns on a computer.
- Workflow design delta in `docs/workflows/13-new-device.md`; Theme-picker #3/#4 labels corrected in `e2e/web/lib/mockup-frames.json`.
- Tests: unit `app/src/shell/layout-mode.test.js`; behavior `app/src/theme/ThemeRoot.test.jsx`, `app/src/account/AccountScreen.behavior.test.jsx`; e2e-web `e2e/web/tests/account-layout.spec.js` (phone, tablet, computer, axe) and `e2e/web/tests/full-height.spec.js` (account check targets the Back button).
- Tablet board mismatch (Theme-picker #3 two columns at 792px vs the app's one column at 712px) parked in `tasks/parking-lot.md`.
