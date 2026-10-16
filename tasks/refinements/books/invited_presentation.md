# books.invited_presentation — The invited screen and refusals as drawn

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji) lines 129–134, task
`books.invited_presentation` ("The invited screen and refusals as drawn"),
under `task books`. It `depends !add_by_link` and sits in the polish milestone
`milestones.m5_complete` (`tasks/99-milestones.tji` line 44). The note, verbatim:

> The invited screen centres its content a third of the way down where the W01
> board top-aligns it under a book mark; its heading shows a dark focus box on
> arrival (the programmatic focus needs the theme focus treatment, or a focus
> target that is not outlined); and the dead-link and full-book refusals are
> standalone screens where the board draws them as dialogs over the empty shelf.
> Copy is unchanged (workflow 1 Invited L49-66 names no book). Source: UI audit
> 2026-10-14 (app screens vs rendered boards; e2e/web/lib/mockup.js). Tests:
> behavior (refusals as dialogs, focus lands on the heading without the outline,
> axe); e2e-web (a dead link and a full book on the three viewports, mockup W01#2
> and W01#4).

## Effort estimate

**0.5 day** (from the `.tji`). The work: one CSS modifier and a decorative mark
on `InvitedScreen`, a no-outline focus rule, the refused phase moved out into a
small RAC alert dialog that `AppShell` renders over the shell, updates to two
behavior test files, and one new e2e-web case plus edits to one existing case.

## Repository

**estante-de-cifras only.** The work lands in `app/src/account/`
(`InvitedScreen.jsx`, a new `InvitedRefusal.jsx`, `account.css`),
`app/src/shell/AppShell.jsx`, and the e2e-web harness
(`e2e/web/tests/add-by-link.spec.js`). It is not format work: the note does not
start with `cifra.md:`. The task touches no service, API or Worker code.

**Design delta (rides in this task's commit):** a new paragraph in
`docs/workflows/01-first-run.md` §Invited, right after the "A link that no
longer works" paragraph (L61–66). It says that the invited screen is a screen of
its own while it asks for an account or opens the book, and that a refusal is a
dialog over the person's shelf. That shelf is empty for someone who has just made
their account, and dismissing the dialog leaves them on it. Until now the
workflow said nothing about how a refusal is presented; the paragraph records
what the W01 board already draws. It does not change the copy.

## Inherited dependencies

Settled (`complete 100`):

- `books.add_by_link` (`tasks/refinements/books/add_by_link.md`) built the flow
  this task restyles:
  - the `/i/<token>` route (`app/src/account/invitation-route.js`) and its
    capture in `App.jsx` L179–194;
  - the Worker's `ADD_BY_LINK`, `NEED_ACCOUNT`, `BOOK_CLONED` and
    `BOOK_REFUSED{reason}` (`app/src/worker/logic.js` L320–330 maps 409
    `book_full` to `'full'`, other 409s and 404 to `'dead'`, and anything else
    to `'error'`);
  - `InvitedScreen` with phases `working | prompt | refused`.

  From that refinement, Decision 1 (the pre-account screen is generic and names
  no book) and its refusal copy, taken verbatim from the board, both stand.
- The theme's dialog vocabulary is `.scrim.center` and `.dialog`
  (`app/src/theme/theme.css` L364–368). On a phone, the `.dialog` width cap is
  `app/src/books/books.css` L103–112. `ThemeRoot`'s `UNSAFE_PortalProvider`
  (`app/src/theme/ThemeRoot.jsx` L56–87) portals every RAC overlay inside
  `.est`, so a new modal needs no portal plumbing of its own.

Pending: none.

## What this task is

Make the invitation look the way the W01 board draws it, without changing any
words.

1. **Layout.** The invited screen (the *working* and *prompt* phases) puts its
   column at the top, under a small book mark in the accent colour. Today the
   column sits a third of the way down the window.
2. **Focus.** The heading still takes focus on arrival, so a screen reader
   starts there, but it no longer draws a focus box.
3. **Refusals.** The two refusals are no longer full-screen pages: *This link
   doesn't open a book* and *This book is full* (and the transport failure *We
   couldn't open this link*, which shares the code path). Each is an alert
   dialog, with the board's warning or person icon, over the person's shelf.
   For someone who made their account through this very link, that shelf is
   the empty front door.

## Why it needs to be done

The UI audit of 2026-10-14 compared app screenshots, taken with
`e2e/web/lib/mockup.js`, against the rendered boards. On W01 #2 and #4 it found
three differences:

- `.account-scroll` centres the column vertically (`app/src/account/account.css`
  L13–27: `justify-content: safe center`).
- The `tabIndex={-1}` heading that `InvitedScreen` focuses
  (`InvitedScreen.jsx` L90–95) shows the browser's default focus ring. Neither
  `app/src/theme/theme.css` nor `account.css` has a focus rule for it.
- `AppShell` returns `InvitedScreen` early whenever `invited` is set
  (`AppShell.jsx` L740–758), so a refusal replaces the whole shell. Nothing is
  behind it.

The task is part of the M5 polish milestone, and nothing downstream depends on
it.

## Inputs / context

Governing documents:

- `docs/workflows/01-first-run.md` §Invited (L42–66, plus the new paragraph from
  the delta):
  - L50–56: until there is an account, the screen names neither the book nor
    its owner.
  - L61–66: the dead-link and full-book refusals name nothing about the book.
- `docs/mockups/W01-first-run.dc.html`:
  - **#2 (phone, L62–87), the invited screen.** L68
    `<div class="scroll" style="padding-top: 28px; gap: 18px">` puts it at the
    top. L69 is a flex column with `gap:10px; align-items:flex-start`, and L70
    is a 40 px book-mark svg in `var(--accent)` (path
    `M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-.8 3 15.6-3.5.8z`) above the heading.
    The board's book name, role chip and named footer were superseded by
    add_by_link Decision 1, and stay superseded.
  - **#4 (computer, L144–198), the refusals.** It shows the split shell with
    the empty shelf: side pane L146–157, main pane "Your shelf is empty" with
    four cards at L158–171. Over it is `<div class="scrim center">` (L173),
    holding two alternative dialogs, each `.dialog` 470 px wide:
    - dead link (L175–185): a 28 px warning-triangle svg in `var(--conflict)`,
      `h2.t-h2` *This link doesn't open a book*, `p.t-body`, and `.actions` with
      `btn quiet` *Add a book by its link* and `btn primary` *OK*;
    - full book (L186–195): a person svg in `var(--conflict)`, `h2.t-h2` *This
      book is full*, `p.t-body`, and `.actions` with `btn primary` *OK*.
- Frames: `e2e/web/lib/mockup-frames.json` L50–73 lists W01 #2 as phone and #4
  as desktop. `mockup(page, board, index, { note })` is at
  `e2e/web/lib/mockup.js:45`. It does nothing unless `ESTANTE_E2E_MOCKUPS` is
  set, and only fires in the project whose kind matches the frame.

Code seams:

- `app/src/account/InvitedScreen.jsx`:
  - L70–78: `refusalCopy(reason)`.
  - L80–89: the props, which are `phase`, `reason`, `onMakeAccount`,
    `onSignIn`, `onAddByLink` and `onClose`.
  - L90–95: the focus effect.
  - L101, L113 and L133: the `h2.t-display.account-heading` with
    `tabIndex={-1}`.
  - L109–128: the refused branch, which has `role="alert"` on its body.
  - L155–166: the frame, which is `.screen.account-screen`, then an `.appbar`
    with a close button and `invited.brand`, then
    `.scroll.account-scroll > .account-card`.
- `app/src/account/account.css` L7–41. `.account-scroll` is shared with
  `SignIn.jsx:357`, `AccountScreen.jsx:914`, `RecoveryEmailConfirm.jsx:159` and
  `shell/NotHere.jsx:66`, which must keep their centring.
- `app/src/shell/AppShell.jsx`:
  - L247–256: the `invited` state.
  - L578–631: `openByLink` and the Worker events. `BOOK_REFUSED` sets
    `{ phase: 'refused', reason }` at L627–631.
  - L740–758: the early return.
- Dialog precedents: `app/src/books/LeaveDialog.jsx` L100–178 uses
  `ModalOverlay className="scrim center"`, `Modal className="dialog"` and
  `Dialog role="alertdialog"`. `app/src/files/DeleteFileConfirm.jsx` L10–49 is
  the smallest example.
- Outline-suppression precedents for programmatically focused,
  non-interactive targets: `app/src/books/play.css` L15–17
  (`.play-fullscreen:focus { outline: none; }`), and `outline: none` on dialog
  containers in `app/src/instruments/instruments.css` L53 and L95 and
  `app/src/songs/arrange.css` L92 and L142.
- i18n: the `invited` block in `app/src/i18n/locales/en.js` L612–641 (and
  `pt-BR`, `es-419`, `it`). It is unchanged, apart from at most a new
  `invited.mark` key, and only if one is needed (see Decision 5: the mark is
  decorative, so none is expected).
- Tests today:
  - `app/src/account/InvitedScreen.behavior.test.jsx`: L23 the generic prompt,
    L36 the dead link (`role=alert`), L49 the full book, L59 the account
    buttons.
  - `app/src/shell/AppShell.routing.behavior.test.jsx`: L455 "an invitation
    link ends on the song address", which renders `AppShell` with a `store`
    and an `inviteToken`.
  - `e2e/web/tests/add-by-link.spec.js`, test L70: `mockup(…, 'W01-first-run',
    2)` at L113, the withdrawn link at L129–134 with W01 #4, and the full book
    at L136–140 with no mockup call.
  - Journeys: `openDevice` (`e2e/web/lib/devices.js:11`),
    `enableVirtualAuthenticator` (`journeys.js:74`), `inviteThroughShare` /
    `openSharing` (`journeys-share.js:176`, `:142`), and `fillBookToCapacity`
    (`e2e/web/lib/db.js:55`).

## Constraints / requirements

- **Copy unchanged.** Every string stays the same `invited.*` key with the same
  text in all four locales. No refusal names the book or its owner (workflow 1
  L50–56, L61–66).
- **Accessibility.**
  - Each refusal is a RAC `ModalOverlay`, `Modal` and `Dialog` with
    `role="alertdialog"`, labelled by its `Heading slot="title"`, so it is
    announced when it opens and traps focus.
  - The dialog closes on *OK*, and on Escape for keyboard users; both run the
    existing `onClose`.
  - Icons are `aria-hidden`.
  - The book mark is decorative (`aria-hidden`).
  - The invited heading keeps `tabIndex={-1}` and programmatic focus. Only its
    ring is suppressed: it is not in the tab order and is not operable, so WCAG
    2.4.7 does not ask for a visible indicator, and the button focus rings are
    untouched.
  - The rendered result is axe clean at WCAG 2.1 AA.
- **Status by word.** The `var(--conflict)` icon goes with the heading text,
  never instead of it.
- **Scoped CSS.** The top alignment is an `InvitedScreen`-only modifier
  (`.invited-scroll`). The shared `.account-scroll` keeps centring for SignIn,
  the account screen, the recovery-email confirmation and NotHere.
  `theme.css` stays the verbatim visual language; new rules go in
  `account.css`.
- **The view only.** The Worker protocol, `refusedReason` and the order of the
  `AppShell` flow (SignIn, then invited, then shell) are unchanged, except that
  the `refused` phase no longer takes the early return.

## Acceptance criteria

### Behavior delivered

1. **Top-aligned under a book mark.**
   - `InvitedScreen`'s scroller is `.scroll.account-scroll.invited-scroll`.
     `.invited-scroll` sets `justify-content: flex-start`, keeps the column
     horizontally centred with its 360 px max width, and has a top padding of
     `calc(var(--u) * 3.5)` (the board's 28 px).
   - The column begins with a 40 px book-mark svg in `var(--accent)` (the board's
     path, `aria-hidden`), placed above the heading.
   - The heading takes the board's title scale (`t-h1`, in place of
     `t-display`).
   - This applies to the *working* and *prompt* phases.
2. **No focus box on arrival.**
   - Each phase's heading still receives focus when it appears (the effect at
     L90–95 is kept).
   - A rule `.invited-heading:focus { outline: none; }` in `account.css` applies
     to the `h2`, which carries the class `invited-heading`. It follows the
     `.play-fullscreen:focus` precedent.
3. **Refusals as dialogs over the shell.**
   - A new `app/src/account/InvitedRefusal.jsx` renders the board's dialog:
     - `ModalOverlay className="scrim center"` with `isOpen`, and
       `isDismissable`;
     - `Modal className="dialog invited-refusal"`, with `width` capped at
       470 px as drawn and the `books.css` max-width still applying on a phone;
     - `Dialog role="alertdialog"`, with a heading row holding the icon (the
       warning triangle for `'dead'` and `'error'`, the person for `'full'`,
       both `var(--conflict)`, `aria-hidden`) and `Heading slot="title"
       className="t-h2"`, then a `p.t-body`, then `.actions`.
     - In `.actions`, `btn quiet` *Add a book by its link* appears only for
       `'dead'` and calls `onAddByLink`. `btn primary` *OK* calls `onClose`.
   - The copy comes from the existing `refusalCopy`, which moves to the new
     file or is exported from `InvitedScreen.jsx`.
   - `.invited-refusal:focus { outline: none; }` keeps the dialog container,
     which RAC focuses on open, free of the same box.
   - `InvitedScreen` drops its `refused` branch.
   - In `AppShell`, the early return is taken only when `invited.phase` is
     `'working'` or `'prompt'`. When it is `'refused'`, the shell renders as
     usual, with `<InvitedRefusal reason={invited.reason} …/>` mounted over it.
     The handlers are the existing ones: *OK* or Escape runs `setInvited(null)`,
     and *Add a book by its link* runs `setInvited(null)` then
     `setSelected('books')`.
   - For a fresh account, the shell behind the dialog shows the empty front
     door (`FirstRun`), as W01 #4 draws it.

### Tests, by level

- **behavior: `app/src/account/InvitedScreen.behavior.test.jsx`** (updated):
  - *prompt* and *working*: after render, `document.activeElement` is the level-2
    heading (*You're invited to a book on Estante*, and the working heading). It
    is still the heading after a re-render that moves from `working` to
    `prompt`. The heading carries `invited-heading`, the class the no-outline
    rule targets.
  - The book-mark svg comes before the heading in the column and is
    `aria-hidden`.
  - The generic prompt still names neither the book nor the owner (the existing
    L23 case). Axe clean.

  *Pins:* workflow 1 §Invited L50–56; W01 #2; the note's focus finding.
- **behavior: `app/src/account/InvitedRefusal.behavior.test.jsx`** (new; it
  replaces the L36 and L49 cases, which move here):
  - `'dead'`: an `alertdialog` named *This link doesn't open a book* holds the
    body *The invitation may have expired…* and buttons *Add a book by its link*
    and *OK*. Pressing each calls `onAddByLink` / `onClose`, and Escape calls
    `onClose`. The secret title `Choros da Ana` appears nowhere. Axe clean.
  - `'full'`: an `alertdialog` named *This book is full* has only *OK*, with no
    add-by-link button and no book name. Axe clean.
  - `'error'`: *We couldn't open this link*, with *OK*. Axe clean.
  - Focus is inside the dialog when it opens.

  *Pins:* workflow 1 §Invited L61–66 and the new presentation paragraph; W01 #4
  L175–195.
- **behavior: `app/src/shell/AppShell.routing.behavior.test.jsx`** (a new case
  beside L455, through the same `store` / `inviteToken` render): after
  `BOOK_REFUSED{reason:'dead'}`, the shell is rendered, meaning its tab
  navigation exists in the DOM, and the `alertdialog` is over it. *OK* closes
  the dialog and leaves the shell on the Search destination. *Add a book by its
  link* leaves it on Books. The invited screen's heading is not rendered in the
  refused state. *Pins:* the workflow 1 presentation paragraph (a refusal is a
  dialog over the shelf, and dismissing it leaves you there).
- **e2e-web: `e2e/web/tests/add-by-link.spec.js`** (phone, tablet and computer
  through the config's three projects; real UI only):
  - In the existing test (L70), step 1, after the invited heading is visible:
    - the heading is the focused element (`toBeFocused`);
    - its computed `outline-style` is `none`;
    - its top lies in the upper third of the viewport, below the book mark;
    - axe; `mockup(…, 'W01-first-run', 2)` is kept.

    Steps 3 and 4:
    - the withdrawn and the full link each show an `alertdialog` with the
      heading, over the shelf, where the joiner's earlier books are still
      visible behind it once *OK* is pressed;
    - axe with the dialog open;
    - *OK* closes it;
    - the existing `mockup(…, 'W01-first-run', 4)` is kept for the dead link,
      and a second W01 #4 call is added for the full book, with
      `{ note: 'full book' }`.
  - A new test, *"a fresh device opening a withdrawn link makes an account and
    is refused in a dialog over its empty shelf"*:
    - The owner makes and withdraws an invitation through the Share dialog, as
      in L89–94.
    - On a new `openDevice` with `enableVirtualAuthenticator`, the joiner opens
      the link and sees the generic invited screen. They press *Make an
      account* and then *Use a passkey*.
    - The `alertdialog` *This link doesn't open a book* appears, and the empty
      front door (*Your shelf is empty*) is behind it, visible after *OK*.
    - Axe with the dialog open and after it closes.
    - `mockup(…, 'W01-first-run', 4)` runs. This is the board's exact state:
      a new account and an empty shelf.

    It is driven by existing pieces: a hosted book through `putBookOnline` or
    the spec's `ownerWithBooks`, a second account through the passkey ceremony
    on a fresh device, and the withdraw through the real Share UI.

  *Pins:* the note's audit findings (W01 #2, W01 #4); workflow 1 §Invited.

Every prerequisite exists, because `books.add_by_link`, `books.share`,
`books.online` and `account.sign_in` are all `complete 100`. This task drops no
test level, defers no test, and leaves no deferred WBS leaf.

## Decisions

1. **The refusal is a dialog rendered by the shell, not a styled screen.**
   *Rationale:* the board draws it over the shelf, and once a link is refused
   the shelf is where the person is, so dismissing the dialog needs no
   navigation. *Rejected:* keeping `InvitedScreen` as the host and painting a
   fake shelf behind a scrim. That would duplicate the shell, and the tab bar
   or rail would not be real.
2. **Suppress the ring on the focused heading instead of moving focus.**
   *Rationale:* the note allows either option. Landing a screen reader on the
   heading is the right arrival point (the `bring-in` and `play` precedents
   focus a non-interactive target too). A `tabIndex={-1}` heading is not
   operable, so a missing ring costs keyboard users nothing; their next Tab
   reaches the buttons, which keep their rings. *Rejected:* a theme-wide
   `[tabindex="-1"]:focus` rule, which would silently change every other focus
   target in the app; and `:focus:not(:focus-visible)`, which Chrome still
   matches on a programmatic focus that follows a keyboard navigation, which
   is exactly the "dark box on arrival" the audit saw.
3. **The ring check is e2e-only.** jsdom applies no stylesheet, so the
   behavior level pins that focus lands on the heading and that the heading
   carries the class the rule targets. The computed `outline-style: none` is
   asserted in Playwright, against the real CSS.
4. **The top alignment is a modifier, not a change to `.account-scroll`.** Four
   other screens share the class and are drawn centred. Restyling them is not
   this task.
5. **The book mark is decorative, and the app bar stays.** The board's phone
   header (*Estante* with the chip) in place of the app's close-button app bar
   is not one of the note's three findings. The close button is the way out of
   the account-first prompt, so it stays. The mark repeats nothing the heading
   does not already say, so it is `aria-hidden` and needs no new i18n key.
6. **`'error'` takes the same dialog.** It is a refusal by the same code path,
   and a transport failure offline also leaves the person on their shelf
   (offline first). One component serves all three reasons.
7. **`NotHere` is out of scope.** It shares the dead-link title and
   `share.spec.js` L199–215 compares it to W01 #4, but it is `shell.routing`'s
   screen for a non-member opening a book's plain address, not an invitation
   refusal. The note names only the invitation refusals.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-15.

- The invited screen is top-aligned under a 40 px accent book mark with a `t-h1` heading that takes focus without an outline: app/src/account/InvitedScreen.jsx, app/src/account/account.css (`.invited-scroll`, `.invited-heading:focus`).
- Dead, full and error refusals are RAC alert dialogs (W01 #4 icons, 470 px): app/src/account/InvitedRefusal.jsx; copy unchanged.
- AppShell shows the refusal over the real shelf instead of a separate screen; early return only for the working and prompt phases: app/src/shell/AppShell.jsx.
- Behavior tests: app/src/account/InvitedRefusal.behavior.test.jsx (new), app/src/account/InvitedScreen.behavior.test.jsx, app/src/shell/AppShell.routing.behavior.test.jsx.
- e2e-web: e2e/web/tests/add-by-link.spec.js (focus/outline/position, dialogs for dead and full links with axe, new fresh-device withdrawn-link test; W01 #2 and #4 captured) on phone, tablet and computer.
- Design paragraph in docs/workflows/01-first-run.md §Invited.
- No tech debt registered.
