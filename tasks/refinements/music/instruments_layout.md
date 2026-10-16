# music.instruments_layout — Instruments and voicing rules as drawn

## TaskJuggler entry

[`tasks/55-music.tji`](../../55-music.tji), task `music.instruments_layout`
(under `task music`), with milestone wiring in `tasks/99-milestones.tji`
(`milestones.m5_complete`'s `depends`, L44).

## Effort estimate

1.5d.

## Repository

The app only:

- `app/src/instruments/`: `InstrumentsOverlay.jsx`, `AddInstrumentForm.jsx`,
  `VoicingRules.jsx`, `instruments.css` and `instruments.behavior.test.jsx`.
- `app/src/shell/layout-mode.js`: one new media-query constant.
- `app/src/i18n/locales/`: only if a string is added. The plan below reuses
  existing keys.
- `e2e/web/tests/instruments.spec.js`.

Nothing lands under `cifra.md/`, `service/` or `api/`, and the Worker is not
touched.

**Design delta (rides in this task's commit).** `docs/workflows/15-set-up-an-instrument.md`
gets a new subsection, §The roster, and switching › *Where it sits* (L98–124).
It says the instruments are a full screen opened over the current screen and not
a history step. It gives the phone and tablet stack with each screen's way out,
the computer rail, and the two-column voicing rules from a tablet up. It also
says the rules bar names the instrument as a label, not a chip. Workflow 15 did
not say where any of this sits, and the board is the only source.

## Inherited dependencies

- `music.instruments` (**settled**, complete 2026-10-06) built the overlay, its
  in-memory view stack (roster / detail / add / edit / rules), `VoicingRules`,
  `MyShapes`, the remove alertdialog, and the behavior and e2e tests extended here.
- Also settled, though not a `depends`:
  - `music.instruments_roster_default` (complete 2026-10-16) lists the built-in
    guitar on the roster. Its Decision 6 handed "the board's abbreviated row
    styling" to this task; see Decision 7 below.
  - `shell.routing` (complete) lists "the instrument picker" among the modals
    that push no history (`tasks/refinements/shell/routing.md` L240–242).
  - `account.preferences_layout` (complete) is the precedent for a computer rail
    keyed on 1080px.

## What this task is

Today the instruments open as a box over the shell. On a phone the box fills
the screen. From 600px up (`instruments.css` L39–47) it is a floating
`min(760px, 92vw)` × `min(680px, 90vh)` card with a shadow.

The W15 board draws something different:

- Every instruments view is a **full screen**, never a sheet.
- On a **computer**, the roster is a **rail** beside the selected instrument's
  screen (#4).
- The **voicing rules** are a full screen whose body is **two columns** under the
  preset row (#3): *Rules* toggles on the left, *Limits* and *Costs* on the right.
- **Adding an instrument** has one way out, an ✕ named *Cancel* in its bar (#2).
  The app today draws a back arrow named *Cancel* in the bar and also a *Cancel*
  button at the foot of the form.
- The **roster** opens with a back arrow named *Back* (#1). The app draws a
  Close ✕.

This task makes the instruments as drawn on the three viewports. What each
screen holds and what each command does are unchanged.

## Why it needs to be done

The UI pairwise audit (2026-10-14) compared the e2e `mockup()` screenshots
against board W15 and found the sheet, the one-column rules, the missing rail
and the doubled exits. The `.tji` note records them.

- The computer frame (#4) is a master–detail screen, the shape every other
  computer screen of the app now has (the account rail, the explorer split, the
  books split). The floating card is the only part of the app that still looks
  like a dialog for a whole area.
- The one-column rules run 18 rows deep on a tablet with half the width empty.
- The add form's two Cancels and its back arrow named *Cancel* give one action
  three controls, and the arrow's name says something its icon does not.

This is the last W15 leaf of `milestones.m5_complete`.

## Inputs / context

- **The board.** `docs/mockups/W15-set-up-an-instrument.dc.html`. Frames are
  indexed in `e2e/web/lib/mockup-frames.json` L404–427.
  - **#1 (phone, roster), L29–49.** A full `.screen` with an `.appbar`: Back
    (chevron, `aria-label="Back"`, L32), the title *Instruments* (L33) and + Add
    (L34). Then the rows, the *in use* badge, and the *+ Add instrument* explore
    row at the foot (L44).
  - **#2 (phone, add), L52–93.** A full `.screen`. Its `.appbar` has an ✕ with
    `aria-label="Cancel"` (L55) and the title *Add instrument* (L56), with nothing
    on the right. The fields follow, then a full-width primary *Add instrument*
    (L90). There is no foot Cancel.
  - **#3 (tablet, rules), L98–158.** A full `.screen` with no split. Its
    `.appbar` has Back (L103), the title *Voicing rules* (L104) and a chip naming
    the instrument (L105). Then the preset row (L108–119) and the explainer
    (L120). Then two `flex:1` columns, gap 24px (L121–154): *Rules*, 10 toggles
    (L122–136); and *Limits* plus *Costs* (L137–153).
  - **#4 (computer, detail), L161–227.** A `.split`. Its `.pane.side` rail
    (L165–179) has a head (L167) and the section label *Instruments* (L168), then
    the rows with *in use* and the open row `sel` (L172–175), then *+ Add
    instrument* (L176). Its `.pane.main` (L180–214) has an `.appbar` with the
    title and *Use this instrument* and no Back (L181–184). Then the Definition
    card, the Voicing rules card with *Edit rules*, My shapes and *Remove
    instrument*. The remove alertdialog is centred (L216–225).
- **The board grammar.** `docs/mockups/GUIDE.md` L30 gives the frame sizes
  (phone 390, tablet 820, computer 1280). L34 is `.split` / `.pane.side` /
  `.pane.main`. L39 says `.scrim` is a bottom sheet and `.scrim.center` a
  dialog.
- **The workflow.** `docs/workflows/15-set-up-an-instrument.md` §The roster, and
  switching (L60–124). §Where it sits (L98–124) is this task's delta. Also §The
  voicing rules (from L146), whose expert panel sits "below the preset".
- **The overlay today.** `app/src/instruments/InstrumentsOverlay.jsx`:
  - L58: the view stack, `{ name: 'roster'|'detail'|'add'|'edit'|'rules', id }`.
  - L63: `close()`.
  - L68–75: `saveNew` and `saveEdit`.
  - L90–94: missing-entry fallback.
  - L97–143: the roster. The Close ✕ (`instr.roster.close`) is at L101, and + Add
    at L107–113.
  - L144–177: add and edit. The back arrow named `instr.add.cancel` is at
    L149–157.
  - L178–197: the rules, with Back to the detail at L182–188.
  - L198–316: the detail. Back to the roster is in its appbar, *Edit rules* at
    L257–262, and the Remove `DialogTrigger` at L271–313.
  - L319–334: the wrapper,
    `ModalOverlay.scrim.instr-scrim[isDismissable] > Modal.instr-modal > Dialog.instr-dialog`.
- **The add form.** `app/src/instruments/AddInstrumentForm.jsx` L224–231 is the
  foot `.actions`: Cancel (L225–227) and the submit (L228–230).
- **The rules.** `app/src/instruments/VoicingRules.jsx`:
  - L53–76: the preset head.
  - L78: the explainer.
  - L80–111: *Rules*, the `TOGGLE_KEYS` switches and the no-bass note.
  - L113–137: *Limits*.
  - L139–159: *Costs*.

  `.instr-rules` is one flex column (`instruments.css` L146–183). `VoicingRules`
  is used only by the overlay (L22, L194).
- **The styles.** `app/src/instruments/instruments.css`:
  - L30–38: `.instr-modal` at 100% × 100%.
  - L39–47: the ≥600px floating card.
- **The shared layout classes.** `app/src/theme/theme.css` L288–295: `.appbar`,
  `.screen`, `.split`, `.pane.side` (340px), `.pane.main`.
- **The breakpoints.** `app/src/shell/layout-mode.js`:
  - `WIDE_QUERY` is `(min-width: 600px)`.
  - `ACCOUNT_WIDE_QUERY`, `BOOKS_WIDE_QUERY` and `READING_ACTIONS_WIDE_QUERY` are
    each `(min-width: 1080px)`.
  - `app/src/account/AccountScreen.jsx` L108–115 is the
    `matchMedia` + `useSyncExternalStore` hook pattern.
- **The hosts.** Each keeps its own `instrumentsOpen` and renders the overlay; none
  changes:
  - `app/src/shell/AppShell.jsx`: L341 and L1294–1298.
  - `app/src/music/ChordExplorer.jsx`: L57 and L288.
  - `app/src/songs/SongReading.jsx`: L174, L725, L749 and L780.

  `shell.routing`'s `layers` and `closers` (`AppShell.jsx` L431–474) have no
  instruments entry.
- **The tests today.**
  - `app/src/instruments/instruments.behavior.test.jsx`. Its cases are at L131
    (add, switch), L259 (the roster marking), L282 (the rules), L330 (shapes,
    removal), L401–574 (the built-in guitar and the zero-shape confirm) and L574
    (the keyboard add).
  - The viewport stub pattern is in `app/src/shell/AppShell.behavior.test.jsx`
    L21–55.
  - `e2e/web/tests/instruments.spec.js`:
    - test 1 (L28) captures `mockup` W15 #1 at L46, #2 at L51 and #3 at L78,
      with axe on each;
    - test 2 (L90) captures #4 at L106.
  - `e2e/web/lib/journeys-core.js`:
    - `chip` at L93;
    - `addInstrument` at L102–117, which clicks the + and the submit, both named
      exactly *Add instrument*;
    - `closeInstruments` at L120–128, which presses Escape while `.instr-scrim`
      exists.
  - `e2e/web/lib/fit.js` has `overlaps` and `expectFits` (shell.narrow_fit).
- **Predecessor and precedent refinements.**
  - `tasks/refinements/music/instruments.md` L453–473 settled the decision that
    the surface is mounted in the shell chrome as an in-memory view stack inside
    a RAC overlay, "full-screen `Modal` on narrow, master-detail within on wide",
    each deep view with its own `.appbar` and Back. This task finishes that
    decision's wide half.
  - `tasks/refinements/account/preferences_layout.md`:
    - Decision 3 (L484–496): a second column starts at 1080px, so the 712px test
      tablet keeps one.
    - Decision 4 (L497–503): DOM order is reading and focus order; no CSS
      reordering.
    - Decision 6 (L515–522): the arrangement is chosen in JSX by a media hook.
  - `tasks/refinements/shell/header_chrome.md`:
    - Decision 7 (L400–410): one chip per screen.
    - Decision 8 (L411–415): deep screens keep their own `.appbar` with no
      wordmark.

## Constraints / requirements

- **Only presentation changes.** The view stack's states, the commands sent and
  the Worker are unchanged. Opening the instruments writes nothing, as
  `instruments_roster_default` settled.
- **It stays a RAC overlay mounted by its three hosts.** The screen it opens over
  stays mounted underneath, so the reading view keeps its transpose, scroll and
  arrange state. It pushes no history (`shell/routing.md` L240–242). Escape
  closes it from any of its views, as today. RAC's focus containment and the
  portal into `.est` (memory: RAC overlays portal outside the theme root) stay as
  they are.
- **Full screen on every viewport.** `.instr-modal` fills the viewport at every
  width, and the ≥600px card rule (`instruments.css` L39–47) goes. The scrim
  stays as the overlay's class (`.instr-scrim`, which `closeInstruments` keys on)
  and is fully covered.
- **The computer rail.**
  - It starts at **1080px**. A new constant, `INSTRUMENTS_WIDE_QUERY =
    '(min-width: 1080px)'`, goes in `layout-mode.js` beside the other three. A
    `useInstrumentsWide()` hook follows the AccountScreen pattern.
  - At that width, the roster and the open view are one `.split`:
    - `.pane.side` holds the rail head, the *Instruments* heading, the rows and
      *+ Add instrument*. The rail head has Back (`instr.roster.back`), which
      closes the instruments.
    - `.pane.main` holds the detail, rules, add or edit view.
  - On open, the main pane shows the **instrument in use** (`rosterEntries(slice).inUseId`).
  - The open row carries `aria-current="true"` beside the `sel` class.
  - The detail's appbar has **no Back** on the computer. It does have Back on
    the phone and tablet, where it returns to the roster.
  - *Use this instrument* keeps the detail open on the computer, where the rail
    shows the new *in use*. On narrow it returns to the roster as today.
  - Adding on the computer opens the add form in the main pane, and a saved add
    opens the new instrument's screen there. Cancel returns to the detail that
    was open before.
- **The roster's exit on the phone and tablet.** The roster appbar's leading
  control is the board's back arrow, named **Back** (`instr.roster.back`), in
  place of the Close ✕. It closes the instruments, as Escape does.
- **The add and edit screens have one exit.**
  - The appbar's leading control is an ✕ (`CloseIcon`) named **Cancel**
    (`instr.add.cancel`). It returns where the screen came from: the roster
    (narrow), the open detail (computer), or the instrument's screen (edit).
  - `AddInstrumentForm` loses its foot Cancel. Its `.actions` hold only the
    full-width primary submit.
  - The `onCancel` prop goes, or stays unused only if another caller needs it.
    The implementer checks that no other caller passes it.
- **The two-column rules.**
  - `VoicingRules` wraps its sections in two column containers: the *Rules*
    section in the first, *Limits* then *Costs* in the second.
  - CSS lays the columns side by side from 600px (`WIDE_QUERY`, the board's
    tablet frame) and stacks them below that. DOM order is the same at every
    width: preset, explainer, Rules, Limits, Costs.
  - The rules appbar names the instrument whose rules these are at its trailing
    end, as plain text in chip styling, not a button. Its text is
    `chipLabel(entry)`. Inside the full-screen overlay the shell chip is
    aria-hidden and out of reach anyway.
- **Accessibility.**
  - Every control stays a React Aria Component.
  - Back and ✕ keep their accessible names; *in use* stays a word.
  - The rail rows stay `Button`s in the existing list structure. Memory: a
    selectable button row list needs `role="group"`, not `role="list"`.
  - Focus moves to the main pane's heading when a rail row opens a view, so a
    keyboard user lands on what they opened.
  - axe stays clean at WCAG 2.1 AA in every view, on every viewport.
- **Copy.** The board's strings are already in the four locales: *Back* is
  `instr.roster.back`, *Cancel* is `instr.add.cancel`, *Instruments* is
  `instr.roster.title`. If `instr.roster.close` becomes unused it is removed from
  all four locales.

## Acceptance criteria

Behavior delivered:

1. **Phone (<600px).**
   - The roster is a full screen with *Back*, *Instruments* and +.
   - Add is a full screen with an ✕ *Cancel* and no back arrow or foot Cancel.
   - The detail has Back, which returns to the roster.
   - The rules have Back, which returns to the detail, and are one column.
2. **Tablet (600–1079px).**
   - The screens are the same as on the phone, full screen. No floating card is
     drawn.
   - The rules are two columns under the preset row: *Rules* on the left, and
     *Limits* above *Costs* on the right (W15 #3).
3. **Computer (≥1080px).**
   - The instruments open as a rail and a main pane, the main pane on the
     instrument in use with its row marked.
   - The detail has no Back.
   - The rules, add and edit views open in the main pane with the rail still
     shown. Each has its own Back or ✕ *Cancel* back to the detail.
   - The remove confirmation is a centred alertdialog over the screen (W15 #4).
4. **Everywhere.**
   - Escape closes the instruments, and the screen underneath is as it was.
   - The rules bar names the instrument as text.

Tests, by level:

- **behavior.** These go in `app/src/instruments/instruments.behavior.test.jsx`.
  They run against the real `createWorkerLogic` like the existing cases, with a
  controllable `matchMedia` stub copied from `AppShell.behavior.test.jsx`
  L21–55. jsdom has no layout, so these pin structure and order. Geometry is
  e2e's job.
  - (a) **narrow roster and its Back** (AC 1, workflow 15 §Where it sits, W15 #1).
    - The roster dialog has a button named *Back* and none named *Close*.
    - Pressing Back calls `onClose`.
    - axe is clean.
  - (b) **add has one exit** (AC 1, W15 #2).
    - On the add view, exactly one button in the dialog is named *Cancel*, it is
      in the `.appbar` before the heading, and there is no button named *Back*.
    - Pressing Cancel returns to the roster.
    - The same holds on edit, where Cancel returns to the instrument's screen.
    - axe is clean.
  - (c) **the rules in two columns, in reading order** (AC 2, W15 #3).
    - The rules view renders two column containers. The *Root required* switch
      is in the first. The *Max span* field and the first cost field are in the
      second, Limits before Costs.
    - The preset group precedes both (`compareDocumentPosition`).
    - The appbar holds the instrument's `chipLabel` as text, and no button whose
      name matches `/change instrument/` is inside the dialog.
    - axe is clean.
  - (d) **the computer rail** (AC 3, W15 #4). With the wide stub, and after adding
    *My Drop D* and switching back to the built-in guitar:
    - Opening shows the rail rows, which include `^Open My Drop D`, and the
      guitar's detail heading in the same render.
    - The guitar's row has `aria-current="true"`.
    - The detail has no button named *Back*. The rail head has one, and pressing
      it calls `onClose`.
    - Opening *My Drop D* from the rail moves `aria-current` and the heading.
      Focus is on the main pane's heading.
    - *Edit rules* opens the rules with the rail rows still present. Its Back
      returns to the detail.
    - *+ Add instrument* opens the add form with the rail present. Its ✕
      *Cancel* returns to the detail.
    - axe is clean on the split.
  - The existing cases (L131–574) keep passing on the narrow default. Any that
    clicked the foot Cancel or the Close ✕ move to the appbar ✕ *Cancel* or to
    *Back*.
- **e2e-web.** These go in `e2e/web/tests/instruments.spec.js`, on the phone,
  tablet and computer projects, through the real UI only. The `mockup` captures
  stay at their steps (#1–#4) for the human audit. Layout is pinned by measured
  boxes.
  - **Test 1** (roster, add, rules):
    - **On every viewport:** with the roster open, the `dialog`'s bounding box
      covers the viewport within ±1px. This pins the full screen, not a card.
    - **On the phone and tablet:**
      - the roster has a button named *Back*;
      - the add view has exactly one *Cancel* and no *Back*.
    - **On the computer:**
      - the roster rows and the in-use guitar's detail heading are visible
        together, the rail's box is left of the heading's box, and the two do not
        `overlaps`;
      - the add form opens with the `^Open Guitar` row still visible.
    - **The rules (#3):**
      - **On tablet and computer:** the *Root required* switch and the *Max span*
        field have tops within ±4px, and *Max span* is to the right of *Root
        required*, so the columns sit side by side.
      - **On the phone:** *Max span* is below the last rule toggle.
    - `checkA11y()` stays on the roster, the add form and the rules.
    - The existing journey (`addInstrument`, *Use this instrument*, *Edit rules*,
      Escape) runs unchanged on all three.
  - **Test 2** (remove, #4):
    - **On the computer**, the rail (`^Open Guitar`) is visible beside the
      *My Drop D* heading when the alertdialog opens.
    - `checkA11y()` on the confirm stays.
    - After Escape, the chip is visible and reads *Guitar*. This pins that the
      screen underneath is intact.

Drivability: every case starts from a fresh app (`startApp`) and the real
roster, add and remove flows that `music.instruments` and
`music.instruments_roster_default` built. The viewports are the harness's three
projects. Nothing needs a hosted book, a second person, sign-in or a `#dev/*`
mount.

No test level is dropped (the note names behavior and e2e-web). The note names
no unit level, and the one new pure piece is a query constant. No test is
deferred, and there is no deferred WBS leaf.

## Decisions

1. **The instruments stay a RAC overlay, drawn full screen. They do not become an
   AppShell layer.**
   - The overlay is opened from three hosts: the shell, the explorer, and the
     reading view (three renders). The explorer and the reading view are
     AppShell early returns.
   - Making the instruments an AppShell surface, as `share_people` Decision 6 did
     for the people screen, would mean lifting `instrumentsOpen` out of all three.
     An early return would also **unmount the reading view** underneath, losing
     its transpose, scroll and open arrange.
   - A full-bleed `Modal` looks exactly like the board. It keeps the screen
     underneath intact, and it already has focus containment and Escape.
   - `shell.routing` already classed it as a modal that pushes no history. That
     stays, and the workflow delta says so.
   - *Rejected:* a history layer for the instruments. A system Back that closes
     the instruments would be nicer on Android. But it reopens routing's settled
     list, and it needs the lift above for the instruments alone. Escape and the
     in-app Back cover the keyboard and the pointer.
2. **The rail starts at 1080px, not 600px.** 1080px is the app's line for a
   second column (`preferences_layout` Decision 3; the books split; reading
   actions). The 712px test tablet keeps the phone's stack, which matches the
   board drawing no split on the tablet frame (#3). A 340px rail at 712px would
   leave a main pane too narrow for the two-column rules.
3. **The rules go to two columns at 600px, and the choice is made in CSS.** The
   board draws two columns on the tablet, so the line is `WIDE_QUERY`. Both
   columns are always in the DOM in reading order (preset, Rules, Limits, Costs),
   so only CSS changes. Unlike the rail, which changes what is rendered (no Back
   on the detail, the rail itself), the columns need no JSX branch.
   - *Rejected:* CSS multi-column flow over one list. It would split the toggles
     unpredictably between columns, where the board groups Rules against
     Limits and Costs.
4. **The rail head is Back plus *Instruments*, not the board's wordmark and chip.**
   - Board #4 draws the shell's side head (*Estante* and a *Guitar* chip) over
     the rail, and nothing that leaves the screen. A chip that opens the
     instruments inside the instruments would be a control that does nothing, and
     the computer would have no visible way out but Escape.
   - `header_chrome` Decision 8 gives deep screens their own appbar with no
     wordmark. The account rail (`preferences_layout`) is the app's computer-rail
     head: Back and a title.
   - The workflow delta records this.
5. **The rules bar names the instrument as text, not a chip.** This follows the
   same reasoning as Decision 4, and `header_chrome` Decision 7 (one chip per
   screen). The board's chip there carries information: which instrument's rules
   these are. Text in chip styling keeps it without a dead control.
6. **The add and edit screens' one exit is the board's ✕ *Cancel* in the bar.**
   - The foot Cancel goes, and so does the back arrow that was named *Cancel*.
   - An ✕ says "abandon this form". A back arrow on a form would suggest stepping
     back without discarding.
   - Edit is not drawn. It takes the same shape as add, since it is the same form.
   - *Rejected:* keeping the foot Cancel for reach on a tall phone. The board
     draws one, and Escape is always there.
7. **The roster row's label stays `displayLabel`.** `instruments_roster_default`
   Decision 6 deferred "the board's abbreviated *Guitar · E A D G B E* row
   styling" here. The rows keep the full *Guitar (6-string) · E2 A2 D3 G3 B3 E4*:
   - The board's pitch letters drop the octaves, which the roster exists to spell
     out. Workflow 15 L69 says "the roster spells it out".
   - A user's own label already shows as itself.
   - This is not a layout question, so no leaf is registered.
8. **Design delta: workflow 15 §Where it sits.** The workflow was silent on
   placement, and the board is partly unusable as drawn (Decisions 4 and 5). Per
   the siblings' rule, a delta is written when the workflow is silent or
   contradicts the board.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-16.

- The instruments open as a full screen on every viewport; the roster leaves by *Back*, add and edit have one ✕ *Cancel* (app/src/instruments/InstrumentsOverlay.jsx, AddInstrumentForm.jsx).
- From 1080px the roster is a rail beside the open instrument, the open row marked `aria-current`, focus on the main heading; the wide query lives in app/src/shell/layout-mode.js.
- The voicing rules are two columns from 600px (Rules left, Limits above Costs right), and their bar names the instrument as text (app/src/instruments/VoicingRules.jsx, instruments.css).
- The unused `instr.roster.close` string is removed from the four locales (app/src/i18n/locales/).
- docs/workflows/15-set-up-an-instrument.md §Where it sits carries the delta.
- Tests: behavior cases (a)–(d) in app/src/instruments/instruments.behavior.test.jsx; a `INSTRUMENTS_WIDE_QUERY` assertion in app/src/shell/layout-mode.test.js; e2e-web boxes on phone, tablet and computer in e2e/web/tests/instruments.spec.js.
- Known deviation: the rail head keeps a + button the board does not draw; it hides while add or edit is open.
