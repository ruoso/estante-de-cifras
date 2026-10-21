# shell.overlay_stacking — Sheets and dialogs always paint above the screen

## TaskJuggler entry

`tasks/50-shell.tji`, `shell.overlay_stacking` (inside `task shell`):
"Sheets and dialogs always paint above the screen".

## Effort estimate

0.5d.

## Repository

The app only. It does not touch `cifra.md/`. The work lands in:

- `app/src/theme/ThemeRoot.jsx`: the overlay layer and the portal container;
- `app/src/shell/shell.css`: the layer's rule;
- the behavior tests in `app/src/theme/` and `app/src/shell/`;
- one e2e-web spec in `e2e/web/tests/`.

## Inherited dependencies

- `shell.portal_provider` — **settled** (Done 2026-10-06).
  `UNSAFE_PortalProvider` sits in ThemeRoot. Its container is the `.est` div
  itself, through a ref (`app/src/theme/ThemeRoot.jsx:74`, `:80-82`). Overlays
  stay inside the token scope, and no screen adds its own portal container.
  Its tests are `ThemeRoot.behavior.test.jsx:69` (portals into `.est`) and
  `:91` (bare-render fallback to `document.body`), and
  `e2e/web/tests/portal.spec.js`.
- `shell.popover_surface` — **settled** (Done 2026-10-20). Every RAC Popover
  carries the `popover` surface class (`app/src/theme/controls.css:71`), and
  the `app/src/theme/popover-surface.test.js` unit check enforces it.
  `e2e/web/tests/popover-surface.spec.js` uses a hit test (`elementFromPoint`,
  `:80-104`) to check that nothing of the screen covers an open popover. This
  task reuses that technique for sheets.

What the e2e journey needs already exists, all `complete 100`:
`books.share_needs_online` (Share on a local book's song, then *Sign in to put
it online*), `account.sign_in` (*Make an account* with the recovery-email
step, `e2e/web/lib/journeys.js:138` `makeAccount`), and `books.online` (Put
online). No new dependency is needed.

## What this task is

Every overlay, whether a sheet, a dialog, a popover or a menu, must paint
above the screen no matter what order it mounted in. ThemeRoot gets one
**overlay layer**: an element inside `.est` that comes after the screen in
document order and has its own stacking context. Every RAC overlay portals
into that layer, not loose into `.est`. No component gets a z-index of its
own.

## Why it needs to be done

A persona run on 2026-10-20 hit the bug:

1. A song in a book that is only on this device.
2. Share, then *Sign in to put it online*, then *Make an account*, the
   recovery email, then Done.
3. The Share sheet came back with the song page painted over it: chips,
   chord diagrams and *Arrange for Guitar* sat on top of the sheet's text.
4. The *New invitation* form after Put online was covered the same way.

The sheet is opaque and inside `.est`. The cause is order:

- While signing in, AppShell returns `SignIn` in place of the whole shell
  (`app/src/shell/AppShell.jsx:896-927`). The open song and its sheet unmount.
- On Done, `onDone` only clears `signIn` (`:920`). The song surface and the
  still-open sheet (`sharing` state, `:414`) mount again in one commit.
- React inserts the portal's content into `.est` before it appends the new
  `recovery-frame`. The scrim ends up **before** the screen in `.est`.
- `.scrim` is `position: absolute; inset: 0` with no z-index
  (`app/src/theme/theme.css:369`). The reading body is a positioned element
  later in the document: `.scroll { position: relative }`
  (`app/src/shell/shell.css:59-61`; `SongReading.jsx:755`). So the reading
  body paints over the scrim.

Any path that mounts an open overlay in the same commit as its screen has
this bug. That includes remounting from SignIn, from the recovery confirm
(`AppShell.jsx:882-884`), or from any future full-screen swap. Patching one
screen leaves the others broken. Workflow 10's Share flow is only usable if
the sheet can be read.

## Inputs / context

- `app/src/theme/ThemeRoot.jsx`:
  - `:56-66` is the provider's comment. `getContainer` is lazy and returns
    null in a bare render.
  - `:74` and `:80-87` hold the one `.est … est-frame` div, which is today's
    portal target.
- `app/src/shell/shell.css`:
  - `:33-37` `.est-frame` (`height: 100dvh; display: flex; flex-direction:
    column`, no `position`). Print override at `:169-171`.
  - `:59-61` `:where(.est) .scroll { position: relative }`.
- `app/src/theme/theme.css:368-374` holds `.scrim`, `.scrim.center`, `.sheet`
  and `.dialog`. None of them sets a z-index. This is the boards' verbatim
  sheet (popover_surface Decision 1), so it is not edited here.
- `app/src/pwa/update-ready.css:7-11` has the only z-index in the app:
  `.update-ready`, `position: fixed; z-index: 50`. It is rendered inside
  ThemeRoot (`app/src/App.jsx:228`).
- RAC's Popover positioning (`useOverlayPosition`) already puts an inline
  `position: absolute` and a high z-index on every popover. That is why
  popovers win today even when they mount early. Sheets and dialogs
  (ModalOverlay `scrim`) have nothing like it.
- These files render `ModalOverlay`/`Modal` directly, with no shared wrapper:
  - `account/`: AccountScreen, AuthorNameDialog, InvitedRefusal, LeaveDialogs,
    SignOutDialog;
  - `books/`: AddToSetlist, BookDetail, BooksScreen, LeaveDialog, MakeYourOwn,
    NewInvitation, PeopleScreen, ShareSheet (`ShareSheet.jsx:146-148`);
  - `editor/FormatHelp`;
  - `files/`: DeleteFileConfirm, NewNameDialog, RenameFileDialog;
  - `instruments/InstrumentsOverlay`;
  - `music/EnterShape`;
  - `songs/`: DiscardConfirm, RestoreConfirm, SaveSheet, SongArrange.
- Behavior seams:
  - `app/src/shell/AppShell.routing.behavior.test.jsx:1235-1250`
    `openLocalSongShare`, and `:1286-1304` (signed out, *Sign in to put it
    online*, Close, back on the song with the share open). That test runs
    wide; this task adds the narrow twin.
  - The account-making double is `makeAuth` with the WebAuthn stand-in
    (`:1509-1550`).
  - `app/src/test/theme-styles.js` `injectStyles` lets jsdom compute the real
    cascade.
- e2e seams:
  - `e2e/web/tests/share-needs-online.spec.js:33-91` is the same journey, with
    `shareSong` at `:19-30`.
  - `makeAccount(page, { recovery })` is in `e2e/web/lib/journeys.js:138-152`.
  - The hit-test pattern is in `e2e/web/tests/popover-surface.spec.js:80-104`.
- Workflow 10 §Sharing a song (the needs-online state) and workflow 13
  §Signing in, or making an account set what the journey does. This task
  changes neither, only what paints on top.

## Constraints / requirements

1. **One layer, not a z-index per component.** ThemeRoot renders
   `<div className="est-overlays">` as the last child of the `.est-frame`
   div, after `{children}`. The `UNSAFE_PortalProvider` returns that element.
   No overlay component, and no screen stylesheet, gets a z-index or a portal
   container of its own (portal_provider constraint 6 stands).
2. **The layer is its own stacking context, above the screen whatever the
   DOM order.** Add this rule to `shell.css`:
   - `.est-overlays { position: fixed; inset: 0; z-index: 1; pointer-events: none; }`
   - `.est-overlays > * { pointer-events: auto; }`

   `z-index: 1` beats every unindexed positioned element of the screen. It
   stays below `.update-ready` (50), which keeps its current place above
   everything. The rule goes in `shell.css` next to `.est-frame`, not in
   `theme.css`, which stays the boards' sheet. Leave the print override
   alone, because overlays are not printed.
3. **Still inside the token scope.** The layer is a descendant of `.est`, so
   `portal.spec.js` (overlay is a descendant of `.est`, tokens apply) and
   `ThemeRoot.behavior.test.jsx:69` stay green unchanged. A bare render with
   no ThemeRoot still falls back to `document.body` (`:91`).
4. **The container is known before any overlay renders.** Hold the layer in
   a callback ref that sets state (`useState`). When the layer attaches,
   ThemeRoot re-renders, and an overlay that opened in the same first commit
   moves into the layer instead of staying in `document.body`. Today's
   `useRef` approach depends on `.est` already existing, which the layer must
   not.
5. **Nothing visible changes when no overlay is open.** The empty layer
   paints nothing and takes no input (`pointer-events: none`), and it is out
   of flow, so it does not take a flex slot in `.est-frame`.
   - Scrims still cover the viewport: `position: absolute; inset: 0` now
     resolves against the fixed layer, which is the viewport, as before.
   - Popovers still sit under their trigger: RAC positions them against the
     positioned container, whose origin is the viewport.
   - `.est-frame` is `100dvh` and the document does not scroll, so no
     scroll offset enters.
6. **Accessibility unchanged.** RAC's `ariaHideOutside` keeps the layer,
   which holds the modal, exposed and hides the screen. A popover opened from
   inside a modal lands in the same layer and stays exposed. Axe stays clean
   at WCAG 2.1 AA in both themes. Focus restore (shell.surface_restore_focus)
   does not depend on the portal node and is untouched.
7. Standing rules: React Aria for every interactive part (no new ones here),
   offline first (nothing touches the network), and fixtures use songs
   written for the purpose (`Paper Lanterns`, already in
   `share-needs-online.spec.js`).

## Acceptance criteria

**Behavior delivered:** after making an account from inside Share (signed
out, a local book's song, *Sign in to put it online*, *Make an account*, the
recovery email, Done), the Share sheet is fully visible above the song page.
After Put online, the *New invitation* form is fully visible too. This holds
on phone, tablet and computer, and for every sheet, dialog, popover and menu
in the app, whatever order it mounted in.

**Tests, by level:**

- **behavior** — `app/src/theme/ThemeRoot.behavior.test.jsx`, new cases:
  - *"portals every overlay into the one overlay layer, the last child of
    `.est`, even when it mounts in the same commit as a positioned screen
    rendered after it"*. Render, inside ThemeRoot, an open `ModalOverlay
    className="scrim"` placed **before** a `.scroll` screen in tree order, in
    one render. Assert that:
    - the dialog's node is inside `.est-overlays`;
    - `.est-overlays` is `.est`'s last element child;
    - the screen precedes the layer in document order
      (`compareDocumentPosition`);
    - axe is clean.

    This pins constraints 1, 3 and 4.
  - *"the overlay layer is its own stacking context above the screen"*. With
    `injectStyles('shell/shell.css')`, `getComputedStyle` of `.est-overlays`
    reads `position: fixed`, a numeric `z-index` ≥ 1 and
    `pointer-events: none`. A scrim inside it reads `pointer-events: auto`.
    This pins constraints 2 and 5.
  - The existing `:69` (portals into `.est`) and `:91` (bare-render
    fallback) stay green unchanged.
- **behavior** — `app/src/shell/AppShell.routing.behavior.test.jsx`, new
  case next to `:1286`: *"narrow: a local book's song, signed out: Sign in to
  put it online, Make an account, Not now — the share sheet comes back in the
  overlay layer, after the song in document order (shell.overlay_stacking)"*.
  - It renders `<ThemeRoot><AppShell/></ThemeRoot>` at the narrow layout and
    reaches Share through More then Share.
  - It uses `makeAuth` and the WebAuthn stand-in from `:1509-1550` for
    *Make an account*, then presses *Not now*.
  - It asserts that the `Share Paper…` dialog is inside `.est-overlays`, and
    that the song's `.scroll` body precedes the layer.
  - Axe clean.

  This pins the reported remount path (AppShell `:896-927`, `:920`; workflow
  10 §Sharing a song, workflow 13 §Signing in, or making an account).
- **e2e-web** — `e2e/web/tests/overlay-stacking.spec.js` (new), real UI
  only, on the phone, tablet and computer projects:
  - *"Share, an account made from it, Done: the sheet and then New invitation
    are uncovered"*. The steps:
    1. `enableVirtualAuthenticator`, `writeSongFromScratch` (a song written
       for the test), `startApp`.
    2. Share. Reuse the `shareSong` pattern from
       `share-needs-online.spec.js:19-30`.
    3. *Sign in to put it online*, then
       `makeAccount(page, { recovery: uniqueEmail('overlay') })`, which takes
       the recovery-email step through *Send link* and Done, as in the
       report.
    4. A hit-test helper, copied from `popover-surface.spec.js:80-104` and
       taking the surface's locator, asserts that every visible text leaf of
       the Share surface is its own `elementFromPoint` hit, so nothing of the
       song page covers it.
    5. Put online, then (on the phone, *Invite someone to this song*) the
       *New invitation* / *Create link* form. The same hit test runs over it.
    6. `analyzeBothThemes` is clean at both stops.

    On the computer the song's Share is the in-flow panel, not a sheet. The
    hit test still runs there, to pin that the panel is uncovered, as the
    note asks for three viewports.

    The helper lives in the spec, or in `e2e/web/lib/` if the implementer
    lifts it out of `popover-surface.spec.js` to share it. Either way it
    takes a locator and only reads (`page.evaluate` over
    `getBoundingClientRect`/`elementFromPoint`), which
    `e2e/web/eslint.config.js` allows.
  - The existing `portal.spec.js` and `popover-surface.spec.js` (popover
    under its trigger, on a surface, uncovered) stay green. They pin that
    moving the container into a fixed layer did not move popovers
    (constraint 5).

Nothing is deferred.

## Decisions

1. **One fixed overlay layer inside `.est`, not a z-index on `.scrim`,
   `.dialog` and `.popover`.** The note asks for "one overlay layer with its
   own stacking context, not a z-index per component".
   - A z-index on `.scrim` would mean editing `theme.css` (the boards'
     verbatim sheet), and it is per-class: every new overlay class would need
     the same.
   - A layer fixes the order for every overlay RAC portals, now and later,
     in one place.
   - Making `.est-frame` itself `isolation: isolate` would not help. The scrim
     and the screen would still be siblings inside the same context, ordered
     by DOM.
2. **The layer is `position: fixed; inset: 0`, not a zero-height in-flow
   sibling.** The scrim's `position: absolute; inset: 0` needs a containing
   block the size of the viewport. A fixed layer is that block, and it is out
   of `.est-frame`'s flex flow. `pointer-events: none` on the empty layer
   keeps it from swallowing taps, and `> *` gives them back to whatever is
   portaled in.
3. **`z-index: 1`, below `.update-ready`'s 50.** The screen has no z-index
   anywhere, so 1 is enough. The update notice keeps its existing place over
   everything. Changing it is out of scope.
4. **A state-held callback ref for the container, not `useRef`.**
   `getContainer` is called while an overlay renders. A `useRef` to a sibling
   rendered *after* the children is null on the first commit, so an overlay
   open at first mount would fall back to `document.body`, outside the
   tokens. A state ref re-renders ThemeRoot once, when the layer attaches, and
   the overlay re-portals into it.
5. **The AppShell behavior case takes the Not now branch, and the e2e takes
   the recovery-email branch.** Both remount the shell from SignIn through
   `onDone` (`:920`), so they are the same bug. The e2e uses the
   recovery-email branch to reproduce the report exactly, which the mail
   catcher in the stack makes possible. The behavior test uses Not now to
   avoid an extra auth route.
6. **No design delta.** DIRECTION and workflows 10 and 13 already say the
   sheet is shown over the song. This task only makes that true. No new
   dependency, and no seam beyond the existing provider.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-21.

- `app/src/theme/ThemeRoot.jsx`: a `.est-overlays` layer, the last child of `.est`, held by a state-backed callback ref; the `UNSAFE_PortalProvider` returns it, so every React Aria overlay portals into it even when it mounts in the same commit as its screen.
- `app/src/shell/shell.css`: the layer's rule, `position: fixed; inset: 0; z-index: 1; pointer-events: none`, with `> *` taking taps back; below `.update-ready` (50).
- `app/src/theme/ThemeRoot.behavior.test.jsx`: two new cases (an early-mounted overlay lands in the layer after a positioned screen, axe clean; the layer's computed stacking style); `:69` and `:91` unchanged.
- `app/src/shell/AppShell.routing.behavior.test.jsx`: the narrow case (Sign in to put it online, Make an account, Not now: the share sheet returns in the layer after the song body, axe clean); `makeAuth` and the WebAuthn stand-in lifted to file level as `installWebAuthn` / `removeWebAuthn`.
- `e2e/web/tests/overlay-stacking.spec.js`: phone, tablet and computer; hit-tests every visible text of Share after the recovery-email Done and of New invitation after Put online, with `analyzeBothThemes` at each stop.
- Driver-run `scripts/gate` green (`orchestrator/logs/iter-0005-verify-gate.log`); no tech debt, no unit/e2e-api/corpus tests.
