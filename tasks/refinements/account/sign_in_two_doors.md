# Refinement — `account.sign_in_two_doors`

## TaskJuggler entry

[`tasks/70-account.tji`](../../70-account.tji), `task sign_in_two_doors "Sign
in and make an account as two doors"` (line 71). `depends !sign_in,
!recovery_email, design.sign_in_two_doors`. The task is in milestone M3
(`tasks/99-milestones.tji:32`). The note, in short:

> As design.sign_in_two_doors decides: one sign-in surface with an *Already
> have an account?* section (passkey, emailed link) and a *New here?* section
> (make an account). Every entry opens it the same way: the cold first run;
> the Account screen, whose not-signed-in card becomes a single entry,
> replacing its own passkey / email pair (`AccountScreen.jsx:659-670`); *Mine
> on Estante*; and the add-book sheet. A press that names a step lands on that
> step. This replaces the intent prop's create-vs-sign-in split. The invited
> screen's buttons land on their sections. A newly made account is asked for
> its recovery email at once, reusing the account screen's set-and-verify,
> with *Not now* leaving it to the account screen. The fixed banner is shown
> on every screen while a signed-in account has no confirmed recovery email,
> and is gone once the address is confirmed. Tests: behavior (…; axe);
> e2e-web (…; axe).

## Effort estimate

The `.tji` says 1.5d. Expect nearer **2d**. The surface, the step and the
banner are about a day. The rest is churn:

- the four locales;
- the existing behavior tests that assert the old *Sign in* heading or the
  card's pair;
- the e2e journeys. `signedInDevice`, `signInExistingWithPasskey`,
  `openEmailedLink`, `joinByInvite` and `acceptInvitation` all click the old
  copy, and `signedInDevice` is used by about twenty specs.

## Repository

This lands in estante-de-cifras, **not** `cifra.md/` (the note does not start
with `cifra.md:`).

- `app/src/account/` — `SignIn.jsx`, `InvitedScreen.jsx`, `AccountScreen.jsx`
  and `RecoveryEmailRegion.jsx` change. `RecoveryEmailStep.jsx` is new.
- `app/src/shell/` — `AppShell.jsx` changes. `RecoveryBanner.jsx`,
  `use-account-status.js` and `account-status.js` are new, plus banner CSS.
- `app/src/songs/` — `FirstRun.jsx`, `SearchScreen.jsx` (pass-through) and
  `SongReading.jsx` (it reports full screen).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Tests next to each of these.
- `e2e/web/lib/journeys.js`, `journeys-account.js`, `journeys-share.js`, the
  specs that click the old copy, and the new spec
  `e2e/web/tests/sign-in-two-doors.spec.js`.
- `docs/workflows/13-new-device.md` — the design delta, **written with this
  refinement**: §The banner gains *Screens without the header chrome* (see
  Decision *Which screens carry the banner*).

There is no `service/` or `api/` change. Every call the task makes already
exists:

- `POST /api/auth/passkey/register/*` and `POST /api/auth/passkey/authenticate/*`;
- `POST /api/auth/email/request`;
- `GET` and `POST /api/account/recovery-email`.

## Inherited dependencies

All are settled (`complete 100`):

- **`design.sign_in_two_doors`** — workflows 1 and 13 (§Signing in, or making
  an account; §Asked when the account is made; §The banner), DIRECTION §6, the
  boards W01 #1/#2/#4, W13 #1/#2 and `docs/mockups/Sign-in.dc.html`. Its
  refinement is `tasks/refinements/design/sign_in_two_doors.md`, which carries
  the pinned English copy table.
- **`account.sign_in`** — `SignIn.jsx`, its steps, the passkey offer after an
  emailed sign-in, and `auth-client.js`.
- **`account.recovery_email`** — `RecoveryEmailRegion.jsx`,
  `recovery-email.js`, `getRecoveryEmail` / `requestRecoveryEmail`, and the
  e2e helpers in `e2e/web/lib/mail.js` and `journeys-account.js`.
- **What the e2e tests need to drive them** — all `complete 100`:
  - `account.first_run` (the cold row);
  - `account.account_screen` (the card);
  - `books.add_by_link` and `service.sharing` (invitations, *Mine on Estante*);
  - `account.new_device` (`sharePasskeys`, a second device of one account);
  - `service.recovery_email` (the verification mail);
  - `foundation.e2e_web` (the harness).

Downstream, milestone M3 waits on this task.

## What this task is

Build what the design decided.

1. **One sign-in surface.** `SignIn` loses its `intent` prop. Its first step
   is headed *Sign in or make an account* and draws two labelled sections:
   - *Already have an account?* — **Use a passkey**, which runs the
     authenticate ceremony, and **Email me a link**;
   - *New here?* — **Make an account**, which runs the register ceremony,
     with the line *Makes a new account with a passkey. Already have one?
     Sign in above. This would be a second, separate account.*

   Every entry opens this surface:
   - the cold first-run row, renamed *Sign in or make an account* and offered
     only while signed out;
   - the Account screen's card, now one button;
   - *Mine on Estante* — its passkey button opens the sections, and its email
     link opens the email step;
   - an invitation.
2. **Add a recovery email.** This step follows *Make an account*, and only
   *Make an account*. **Send link** posts the address, then shows the
   region's *waiting* words with **Done**. **Not now** goes straight on. The
   home book attaches, and an invitation is accepted, behind the step.
3. **The banner.** While a signed-in account has no confirmed recovery email
   (a pending address included), a non-dismissible banner is shown. Its
   **Add one** opens the account screen at the Recovery email region, with
   focus there. It sits where workflow 13 §The banner places it.

## Why it needs to be done

The launch smoke test (2026-10-19) could not make the first account on a
browser that already held a local book:

- Making an account was reachable only from the cold row (`AppShell.jsx:992`,
  `:1018` `setSignIn({ intent: 'create' })`) and the invited screen (`:815`).
- The account card (`:800`) and *Mine on Estante* (`signInMine`, `:293`)
  opened the sign-in intent only.
- Both intents drew the same *Sign in* heading (`en.js:788`), so nothing told
  the doors apart.
- A signed-out create always mints a new account
  (`service/internal/server/passkeys.go:168-199`). So the cold row silently
  gave a second account to someone who already had one.
- A new account's only way back was its one passkey.

This task closes all of that, and is the last account piece M3 needs.

## Inputs / context

**Governing documents**

- **Workflow 13** (`docs/workflows/13-new-device.md`):
  - §Signing in, or making an account (L10-39): the sections, their order,
    the entries, the email-step exception, and that signing in has no step;
  - §Signing in on another device, *Neither* (L56-61);
  - §The recovery email, *Setting it* (L76-83);
  - §Asked when the account is made (L106-120);
  - §The banner (L122-168, including this task's delta: *Screens without the
    header chrome*);
  - §The account screen (the Recovery email region).
- **Workflow 1** (`docs/workflows/01-first-run.md`):
  - §Cold (L25-29): the row's copy, offered only while no one is signed in;
  - §Invited (L54-63): the invited screen draws the two sections under its
    own heading, and making an account there asks for the recovery email,
    with the invitation accepted behind it;
  - L65-71: no book named before sign-in.
- **DIRECTION**:
  - §6: the *Signing in, or making an account* bullet and the amended
    recovery-email bullet;
  - §3.7 (L479-486): the update-ready notice, and that nothing moves
    mid-performance;
  - §3.6 *Signing in*.
- **Boards**:
  - `docs/mockups/W13-new-device.dc.html` #1: the surface;
  - W13 #2: the banner on a phone, between the header row and the
    destination;
  - `docs/mockups/W01-first-run.dc.html` #1: the cold row;
  - W01 #2: the invited screen with the two sections;
  - W01 #4: the banner on a computer over an account's empty shelf;
  - `docs/mockups/Sign-in.dc.html`:
    - Phone 1: the card — *Not signed in*, the line, one **Sign in or make
      an account**;
    - Phone 2: the step;
    - Tablet: the banner across the main pane, with the update-ready notice
      floating apart;
    - Computer: *Add one* pressed, the region in *waiting*, focus on it.
- **Copy**: the pinned English is in
  `tasks/refinements/design/sign_in_two_doors.md` L28-37. Use it verbatim.

**The app today (`app/src/`)**

- `shell/AppShell.jsx`:
  - the `signIn` state (:286-288, shape `{intent, step?, token?, forInvite?}`;
    the comment at :274-285 is stale);
  - `signInMine(step)` (:293);
  - `destinationPanels(… onSignIn …, onSignInMine …)` (:175), with the
    first-run seam at :992 and :1018;
  - early returns, in order:
    - `RecoveryEmailConfirm` (:751);
    - `SignIn` (:761-786). Its `onSignedIn` sends
      `ATTACH_HOME {accountId}` (:773), then `setSignIn(null)`, then
      `openByLink(token)` if `forInvite` (:777-781);
    - `AccountScreen` (:795-809). Its `onSignIn` ignores the method (:800);
    - `InvitedScreen` (:811-825);
    - then `NotHere`, `MySongsChoice`, `UploadPreview`, history, people,
      editors, wizard, arranging, `openSong` (:1268), `playingSetlist`
      (:1329) and the rest;
  - `renderShell` (:962): `HeaderChrome` as `side-head` in the rail
    (:978-983), and as `instr-top` on a phone (:1003-1008, suppressed with a
    `setlistView`).
  - The shell holds **no session state**.
- `account/SignIn.jsx`:
  - props (:93-110): `intent`, `redeemToken`, `initialStep`, `authClient`,
    `label`, `onSignedIn`, `onClose`;
  - steps: `method` (:260), `email` (:286), `checkEmail` (:318), `redeeming`
    (:332), `offer` (:343);
  - `usePasskey` branches on intent (:169-192);
  - `finishSignIn` → `shouldOfferPasskey` (`offer-passkey.js:37`; false for
    register);
  - `handleClose` at offer calls `onSignedIn` (:251-257);
  - focus moves to the heading on every step change (:127-134).
- `account/AccountScreen.jsx`:
  - the card (:659-670), used as `whoBlock` when `auth === 'out'` (:837);
  - `recovery` and `loadRecovery` (:425, :447-455);
  - the region mount (:845-851);
  - the wide and narrow layouts (:891, :913-923);
  - there is no id or ref to scroll or focus to the region.
- `account/RecoveryEmailRegion.jsx`:
  - signature `({ recovery, loadError, authClient, online, onReload })`
    (:129);
  - `request` (:142-160);
  - `requestErrorCopy` (:108-115, module-private);
  - the field form (:212-238);
  - the `none` / `waiting` blocks (:242-253, :282-320);
  - the offline note (:331-339).
- `account/recovery-email.js:14` `recoveryEmailState`.
- `account/auth-client.js`:
  - `registerBegin`/`Finish` (:158/:162);
  - `authenticateBegin`/`Finish` (:168/:171);
  - `requestEmailLink` (:180);
  - `getRecoveryEmail` (:290);
  - `requestRecoveryEmail` (:295);
  - `AuthError` (:27).
- `account/use-online.js:8` `useOnline`.
- `account/InvitedScreen.jsx`:
  - props `phase`, `onMakeAccount`, `onSignIn`, `onClose` (:89-96);
  - the prompt phase (:118-140): heading, body, the *An account is a
    passkey* card, the two buttons, and the footer.
- `songs/FirstRun.jsx`:
  - props (:119-124);
  - the sign-in row (:147-152), which does not know whether anyone is signed
    in;
  - rendered by `SearchScreen.jsx:671-686`.
- `books/BooksScreen.jsx` `MineList` (:418-432): `onSignIn('method' |
  'email')`, threaded through `AddBookSheet` (:527, :714-723) to the shell's
  `signInMine`.
- `songs/SongReading.jsx:177` `fullScreen` state, and the
  `.reading-fullscreen` layer (:514-531).
- `pwa/UpdateReady.jsx:19`, mounted in `App.jsx:228` outside the shell, and
  `pwa/update-ready.css:6-26` (fixed, top centre, z-index 50).
- `theme/theme.css`: `.notice` (:354), `.notice.unsaved` (:356), `.badge`
  (:330), `.badge.unsaved` (:331).
- `i18n/locales/en.js`:
  - `firstRun` (:720-734);
  - `invited` (:755-779);
  - `signIn` (:784-817): `heading` :788, `note` :792, `offerSkip: 'Not now'`
    :810;
  - `account.notSignedIn`/`notSignedInBody`/`usePasskey`/`emailLink`
    (:869-873);
  - the recovery keys (:971-989): `recoveryNoneWarn`, `recoveryLabel`,
    `recoveryHint`, `recoverySent`, `recoveryOffline`.
  - `i18n/i18n.test.js:44-53` checks key parity across all four locales.
- **Existing tests touched**:
  - `account/SignIn.behavior.test.jsx`, which has the loopback `makeClient`
    (:36) and `installWebAuthn` (:71);
  - `account/AccountScreen.behavior.test.jsx`: :312-322 for the card pair,
    and :757-960 for recovery;
  - `account/InvitedScreen.behavior.test.jsx`: :69-93 asserts the heading
    *Sign in* for both buttons;
  - `songs/FirstRun.behavior.test.jsx`;
  - `shell/AppShell.behavior.test.jsx`: the header chrome per layout,
    :161-215;
  - `shell/AppShell.routing.behavior.test.jsx`: :844-901, *Mine's sign-in is
    for an existing account* and the first-run register;
  - `books/MineOnEstante.behavior.test.jsx:61`.

**The e2e harness (`e2e/web/`)**

- `lib/journeys.js`:
  - `enableVirtualAuthenticator` (:74);
  - `sharePasskeys` (:94);
  - `signInWithPasskey` (:120), which clicks `/Sign in/`, expects the
    heading *Sign in*, then clicks *Use a passkey* and so creates the
    account;
  - `signedInDevice` (:129);
  - `gotoTab` (:33).
- `lib/journeys-account.js`:
  - `uniqueEmail` (:28), `openAccount` (:33);
  - `openEmailedLink` (:44);
  - `recoveryRegion` (:62), `setRecoveryEmail` (:70),
    `readVerificationLink` (:93), `confirmOnFreshDevice` (:104);
  - `signInFromMine` (:139), `joinByInvite` (:178);
  - `signInExistingWithPasskey` (:200), which goes through the card's *Use a
    passkey*;
  - `anotherDeviceSignsIn` (:216);
  - `accountShelf` (:276), which reads `GET /api/account/home-book`;
  - `writeSongFromScratch` (:323).
- `lib/journeys-share.js:232-238` `acceptInvitation`.
- `lib/mail.js`: `waitForMessage` (:71), `extractRecoveryEmailLink` (:83).
- `lib/axe.js`: the `checkA11y()` fixture (:618) and `analyzeBothThemes`
  (:580).
- Specs that click the old copy:
  - `account-sign-in.spec.js:32-100`;
  - `first-run.spec.js:24` (*Sign in* in `WAYS`);
  - `share.spec.js:123-125`;
  - `add-by-link.spec.js:148-150, 211-213, 356, 396-407`.
- `leaving.spec.js:89, :197` match `/Sign in/`, which the new row still
  matches.
- `e2e/web/eslint.config.js` bans, in specs: `#dev/`, `addInitScript`,
  `route`, `dispatchEvent`, and API writes. Read-only `GET`s are allowed.
- `mockup()` captures: W01 #1 (`first-run.spec.js:45`), W01 #2
  (`share.spec.js:122`), W01 #4, W13 #1 (`new-device.spec.js:81`), W13 #2
  (`:94`). `Sign-in.dc.html` is not in `lib/mockup-frames.json`, so no spec
  may capture it (see Decisions).

**Predecessor refinements**

- `account/sign_in.md`: one multi-step surface (Decision 3), and the offer
  after an emailed sign-in (Decision 5).
- `account/recovery_email.md`: the region's states, the loopback-client
  behavior style, and `setRecoveryEmail` / `confirmOnFreshDevice`.
- `account/first_run.md`: one string per door.
- `design/sign_in_two_doors.md`: every design decision, including the order,
  the warning, the cold row only while signed out, the banner's placement,
  and the region rather than a live region.

## Constraints / requirements

**The design governs**

- **The pinned English is verbatim.** Other words reuse existing copy:
  - `account.recoveryNoneWarn`, `recoveryLabel`, `recoveryHint`,
    `recoverySent`, `recoveryOffline`;
  - `signIn.offerSkip` for *Not now*;
  - an existing *Done*.

  pt-BR, es-419 and it get translations of every new or changed key, written
  by the implementer as fluent translations, not English left in place.
  `i18n.test.js` parity, placeholder and not-mostly-English checks stay
  green. Keys that become unused are removed from all four locales:
  - `account.usePasskey`, `account.emailLink`;
  - `invited.makeAccount`, `invited.signIn`.
- **No entry picks a door.** The only exception is *Mine on Estante*'s
  *Email me a link*, which opens the email step. No entry opens on a step
  past the sections.
- **A signed-out *Make an account* still makes a new account.** The service
  is unchanged. The *New here?* line says so.
- **The recovery step follows *Make an account* only**, and runs wherever the
  person made it: the surface or the invitation. It never follows a sign-in,
  an emailed-link redemption, or the passkey offer.
- **Nothing waits on the step.** `ATTACH_HOME` and an invitation's accept are
  sent when the account exists, before the step shows.
- **The banner**:
  - shown only on the service's answer, and never offline before an answer;
  - not dismissible, with no timer;
  - a pending address keeps it;
  - not a live region (`role="status"` / `alert` are not used);
  - its state carried in words;
  - the `.notice.unsaved` tone in each theme's tokens;
  - taking its own room, without scrolling or covering anything;
  - never merged with `UpdateReady`, which is untouched.

**Component boundaries and standing rules**

- **Offline first.** The new account-status probe is a main-thread `fetch`
  through `auth-client.js`, like the account screen's. It never touches
  IndexedDB (the Worker owns that). Its failure never blocks anything.
- **Accessibility**:
  - React Aria Components `Button` for every press;
  - each section is a `role="group"` labelled by its heading;
  - the banner is a `<section>` labelled by its *No recovery email yet.*
    text;
  - a keyboard path through the sections and the step;
  - focus moves to each step's heading, as `SignIn` does today;
  - *Add one* moves focus into the region;
  - axe at WCAG 2.1 AA in Estante and Palco.
- **No book without an account.** The invitation's sections name no book
  before sign-in (workflow 1 L65-71).
- **No song text, address or secret in logs.** There are no logs on this
  path. Test fixtures use invented addresses (`uniqueEmail`, `ana@…`), and
  songs written for the purpose.

**Tests**

- **Behavior tests** inject the loopback auth client. Per memory
  [[api-validate-js-breaks-under-vite]], shapes are checked structurally,
  not via `api/validate.js`.
- **RAC overlays** stay inside `.est` ([[rac-overlays-portal-outside-est-theme-root]]).
- **The shell's auth client** is held in a `useRef`
  ([[load-effect-client-needs-useref]]).
- **Existing tests are updated to the new copy and flow, never weakened.**
  `signedInDevice` now leaves an account with no recovery email, so the
  banner shows in every spec that uses it. A layout or geometry assertion it
  disturbs (e.g. `narrow-fit.spec.js`, `account-layout.spec.js`) is fixed in
  the app or by asserting the same promise with the banner present.

## Acceptance criteria

### Behavior delivered

**`SignIn.jsx` — one surface**

- **Props.** `intent` is removed. The props become:
  - `initialStep` (`'method'` | `'email'`);
  - `redeemToken`;
  - `lead`;
  - `authClient`;
  - `label`;
  - `onSignedIn(account)`;
  - `onDone()`;
  - `onClose()`.
- **The `method` step:**
  - The heading is `signIn.heading` = *Sign in or make an account*. The
    surface's other lines are as W13 #1 draws them.
  - **Already have an account?** is a group labelled by its heading. It holds
    **Use a passkey** (authenticate, as today), then **Email me a link**
    (→ the `email` step), then `signIn.note`.
  - **New here?** is a group labelled by its heading. It holds **Make an
    account** (`registerBegin` → `createCredential` → `registerFinish`), then
    the pinned line.
  - The two groups are in that order in the DOM.
- **`onSignedIn(account)` fires exactly once**, when a session first exists:
  - after `authenticateFinish`;
  - after `registerFinish`;
  - after a redeemed emailed link.

  The surface then stays open until its last step ends and calls `onDone()`:
  - a sign-in with no offer → `onDone()` at once;
  - the offer step → `onDone()` after *Add a passkey* or *Not now*;
  - *Make an account* → the `recovery` step.
- **Closing.** `onClose()` (the close button before any session) is
  unchanged. Closing after a session exists calls `onDone()`.
- **`lead`** replaces the `method` step's heading and lines with the given
  node. The invitation passes `InvitedLead`, exported from
  `InvitedScreen.jsx`: the existing `invited.promptHeading`, `promptBody`,
  the *An account is a passkey* card and `promptFooter`. The step's heading
  focus goes to the lead's `h1`. The two sections are drawn unchanged below
  it.

**`RecoveryEmailStep.jsx` (new) — the `recovery` step**

- Rendered by `SignIn` after *Make an account*. It shows:
  - the heading *Add a recovery email*;
  - `account.recoveryNoneWarn`;
  - the field `account.recoveryLabel` with `account.recoveryHint`;
  - **Send link** (primary);
  - **Not now** (quiet, `signIn.offerSkip`).
- **Send link** calls `authClient.requestRecoveryEmail(address)`, the same
  `POST /api/account/recovery-email` the region uses. Errors use the same
  mapping: `requestErrorCopy` is exported from `RecoveryEmailRegion.jsx`,
  which handles 400 / 429 / network in a `role="alert"`.
- On a 202 the step shows `account.recoverySent` naming the address, and
  **Done**.
- **Done** and **Not now** both call `onDone()`. *Not now* posts nothing.
- **Offline** (`useOnline` false), *Send link* is disabled with
  `account.recoveryOffline`, and *Not now* stays enabled.
- The field and alert markup is extracted from the region into a shared
  `RecoveryEmailField`. The region keeps its own submit label and every
  behavior its existing tests pin.

**`AppShell.jsx` — entries**

- **The `signIn` state becomes `{step?, token?, forInvite?}`.** There is no
  intent.
- **Each entry opens the surface:**
  - the first-run seam → `setSignIn({})`;
  - the account card → `setSignIn({})`;
  - `signInMine('method')` → `{}`;
  - `signInMine('email')` → `{ step: 'email' }`.
- **Invitations.** When an invitation reaches its `prompt` phase, the shell
  renders the **one `SignIn` early return** with
  `lead={<InvitedLead />}` and `forInvite`, instead of `InvitedScreen`'s
  prompt phase. That keeps one `SignIn` element in one tree position, so its
  step state survives the session landing. `InvitedScreen` keeps its
  `working` phase. Its `onMakeAccount` / `onSignIn` props go. Closing the
  invitation's surface before signing in does what `InvitedScreen`'s
  `onClose` does today.
- **`onSignedIn(account)`:**
  - sends `ATTACH_HOME {accountId}`;
  - if `forInvite`, calls `openByLink(token)`;
  - calls `accountStatus.refresh()`;
  - does **not** close.
- **`onDone()`** → `setSignIn(null)`. The person lands where they were
  headed: the shelf, or the invitation's book once it is accepted.

**Account status, the banner, and the cold row**

- **`shell/account-status.js` (new, pure):**
  - `showsRecoveryBanner({status, recovery})` — true iff `status === 'in'`,
    `recovery` is loaded, and `recovery.email` is null (pending or not);
  - `offersFirstRunSignIn({status})` — true unless `status === 'in'`.
- **`shell/use-account-status.js` (new):**
  - `useAccountStatus(authClient)` → `{status: 'unknown'|'in'|'out',
    recovery, refresh}`.
  - It answers from `GET /api/account/recovery-email`:
    - 200 → `in` with `{email, pending}`;
    - 401 → `out`;
    - a network failure keeps the last answer (`unknown` at first).
  - It probes:
    - on mount;
    - when `useOnline` turns true;
    - on `visibilitychange` to visible;
    - on `refresh()`.
  - The shell calls `refresh()` after `onSignedIn`, after sign-out and
    leaving, and when the account screen closes.
  - `AppShell` takes an `authClient` prop, defaulting to the module client.
    It is shared with `SignIn`, `AccountScreen` and the hook.
- **`shell/RecoveryBanner.jsx` (new):**
  - `<section className="notice unsaved recovery-banner"
    aria-labelledby>` with the bold *No recovery email yet.* (the label),
    the sentence, and one RAC `Button` **Add one**;
  - no other control, no `role="status"` or `alert`, no timer.
- **Where `RecoveryBanner` is shown** (workflow 13 §The banner, and its
  delta):
  - **In `renderShell`** — on a phone below `instr-top`, above the
    destination; on wide layouts across the head of `.pane.main`, beside the
    rail. It is in flow and does not scroll: it sits outside the scroll
    container.
  - **On the account screen** — drawn by `AccountScreen` from its own
    `recovery` state, across the head of its main pane (wide) or below its
    appbar (phone). It updates as the region reloads.
  - **Above every other shell-replacing early return**, via one shell
    wrapper: a column with the banner, then the surface in the remaining
    height. This covers `openSong`, the editors, history, people, conflicts
    and the like. The wrapper excludes:
    - the `SignIn` surface;
    - `RecoveryEmailConfirm`;
    - `playingSetlist`;
    - a song while `SongReading` is full screen. `SongReading` gains
      `onFullScreenChange(boolean)`.
- **Add one** opens the account screen with `focusRecovery`:
  - `setAccount({ focus: 'recovery' })` from the shell;
  - from the account screen's own banner, the same request in place.

  `AccountScreen` scrolls `RecoveryEmailRegion` into view, and focuses its
  field in the `none` state, or the region (`tabIndex={-1}` section)
  otherwise. The region takes a `focusRequest` prop for this.
- **The cold row.** `FirstRun` takes `offerSignIn`, passed through
  `SearchScreen` from `offersFirstRunSignIn(accountStatus)`. When it is
  false, the *Sign in or make an account* row is not rendered (three rows).
  The row's copy is `firstRun.signIn` = *Sign in or make an account*, with
  `signInMeta` = *Bring back your shelf, or start one on Estante.*

**`AccountScreen.jsx` — the card**

- The card keeps the heading *Not signed in*.
- Its line becomes *Bring your books to this device, or start keeping them on
  Estante.*
- It has one primary RAC `Button`, **Sign in or make an account**, calling
  `onSignIn()` with no argument.

### Tests, by level

The `.tji` names **behavior** and **e2e-web**. A **unit** level is added for
the pure selectors, following the precedent of `account/recovery_email.md`.
Every named test lands in this task and runs, not skipped, in `scripts/gate`.

**unit** (Vitest)

- `app/src/shell/account-status.test.js` (new):
  - `showsRecoveryBanner`:
    - true for `in` with `{email: null, pending: null}`;
    - true for `in` with `{email: null, pending: 'a@x'}`;
    - false for `in` with a confirmed `email`, pending or not;
    - false for `out`;
    - false for `unknown`;
    - false for `in` with `recovery` not loaded.
  - `offersFirstRunSignIn`: false only for `in`.

  Pins workflow 13 §The banner (*a pending address keeps it*; *What the
  device knows*) and workflow 1 §Cold (*offered only while no one is signed
  in*).

**behavior** (RTL, real React Aria, real i18n, the loopback `makeClient` and
`installWebAuthn`; `checkWcag21aa` on every state named)

- `app/src/account/SignIn.behavior.test.jsx` (extended; the `intent` cases
  rewritten):
  - The method step has the heading *Sign in or make an account*, and the
    groups *Already have an account?* (Use a passkey, Email me a link, the
    note) before *New here?* (Make an account, the pinned line). axe.
  - **Use a passkey** → `authenticate/begin` and `/finish`. `onSignedIn` is
    called once, then `onDone`. No `register/*` call. No *Add a recovery
    email*.
  - **Make an account** → `register/begin` and `/finish`. `onSignedIn` is
    called once with the account **before** the step's heading *Add a
    recovery email* shows, and the heading is focused. No
    `authenticate/*`. axe on the step.
  - **Send link** → `POST /api/account/recovery-email` with body `{email}`.
    Then `recoverySent` names the address, and **Done** → `onDone`. axe on
    the waiting state.
  - **Not now** → `onDone`, with no recovery POST.
  - 400 → the invalid-address alert. 429 → *Too many tries…*. Offline →
    *Send link* is disabled, the offline note shows, and *Not now* is
    enabled.
  - **Email me a link** → the email step. `initialStep="email"` opens on it
    with the field focused.
  - A redeemed link → the offer step → *Not now* → `onDone`. There is never
    a recovery step after a redemption or after the offer's *Add a passkey*.
  - With `lead`: the invitation's heading is focused, no book name is shown,
    and the same two groups follow. *Make an account* → the recovery step.
    axe.
  - A keyboard path: Tab reaches *Use a passkey*, *Email me a link*, *Make
    an account* in order, and Enter on *Make an account* runs `register`.

  Pins workflow 13 §Signing in, or making an account (L10-39), §Asked when
  the account is made (L106-120), workflow 1 §Invited (L54-63), and boards
  W13 #1, W01 #2 and Sign-in Phone 2.
- `app/src/account/InvitedScreen.behavior.test.jsx` (updated):
  - the working phase as today;
  - `InvitedLead` renders the heading, body, passkey card and footer with no
    book named;
  - the old two-buttons Host test (:69-93) is replaced by `InvitedLead`
    inside `SignIn` showing both sections;
  - axe.

  Pins workflow 1 §Invited L54-71.
- `app/src/account/AccountScreen.behavior.test.jsx` (extended):
  - **Card.** Signed out, the card shows *Not signed in*, the pinned line,
    and exactly one button **Sign in or make an account**, which calls
    `onSignIn` with no argument. *Use a passkey* and *Email me a link* are
    absent. This replaces :312-322.
  - **Banner states.**
    - Signed in with `{email: null, pending: null}` → the region named *No
      recovery email yet* is before the account sections, with exactly one
      button, *Add one*.
    - With a pending address → still shown.
    - With a confirmed address → absent.
    - Signed out → absent.
  - **Add one.**
    - Pressed in the `none` state, it moves focus to the region's
      *Recovery email* field.
    - In `waiting`, it moves focus to the region.
    - `focusRecovery` on mount does the same.
  - **Region and banner together.** The region's Send link → `waiting`
    keeps the banner.
  - axe on the card, the banner with none, and the banner with pending.

  Pins workflow 13 §The banner (*Add one*, *on the account screen too*), the
  Sign-in board's Phone 1 and Computer, and the account card in workflow 13
  L30-33.
- `app/src/songs/FirstRun.behavior.test.jsx` (extended):
  - the row reads *Sign in or make an account* / *Bring back your shelf, or
    start one on Estante.*;
  - with `offerSignIn={false}` there are three rows and no sign-in button;
  - axe on both.

  Pins workflow 1 §Cold L25-29 and W01 #1.
- `app/src/shell/AppShell.routing.behavior.test.jsx` (extended). Its *Mine's
  sign-in* block becomes `describe('Every entry opens both sections')`:
  - **Every entry.** Each of these shows the heading *Sign in or make an
    account* and both groups:
    - the first-run row;
    - the account card;
    - *Mine on Estante*'s passkey button (via the add-book sheet).
  - **The email exception.** *Mine*'s email link opens *Email me a link*
    with the field focused.
  - **The invitation.** An invitation in its prompt phase shows the
    invitation heading and both groups.
  - **Create from the first-run row.** With WebAuthn installed and routes
    answering, Make an account → `ATTACH_HOME` is recorded on the store
    while *Add a recovery email* is still showing. Not now → the surface is
    gone.
  - **Create from an invitation.** Make an account → the accept request is
    recorded while the step is showing. Not now → the step is gone.
  - **Sign in from the first-run row.** *Use a passkey* calls
    `authenticate/*`, and never `register/*`.

  Pins workflow 13 L10-39 and §Asked when the account is made (*nothing
  waits on it*), and workflow 1 §Invited.
- `app/src/shell/AppShell.behavior.test.jsx` (extended),
  `describe('Recovery-email banner')`, with an injected `authClient`:
  - **Placement.** Answering `{email: null, pending: null}`, the region *No
    recovery email yet* shows below the header chrome and before the
    destination's heading in document order, on the phone layout and the
    wide layout. On wide it is inside `.pane.main`, not the rail.
  - **Across destinations.** It is still shown after switching to each
    destination tab.
  - **Pending, confirmed, signed out, offline.**
    - pending → shown;
    - confirmed → absent;
    - 401 → absent, and the first-run sign-in row is offered;
    - 200 → the row is not offered;
    - a network failure on the first probe → absent.
  - **Refresh after the account screen.** After Add one, the account screen
    opens with the region focused. When it closes with the probe now
    answering confirmed, the banner is gone.
  - **Above shell-replacing screens.** A song opened from search shows it
    above the screen's own bar. When `SongReading` reports full screen it is
    gone, and it is back on leaving.
  - **Not dismissible.** It has no button but *Add one*. Its role is not
    `status`/`alert`. It does not re-render as a new live announcement on
    tab change: there is no `aria-live`.
  - axe with the banner in Estante and in Palco.

  Pins workflow 13 §The banner (placement, full screen, screens without the
  header chrome, *How it reads*, *What the device knows*), and boards W13 #2,
  W01 #4 and Sign-in Tablet.
- `app/src/books/MineOnEstante.behavior.test.jsx` (unchanged seam, kept
  green). It pins that *Mine* still passes `'method'` / `'email'`.
- `app/src/i18n/i18n.test.js` (existing, unchanged). It runs over the new
  keys in all four locales.

**e2e-web** — `e2e/web/tests/sign-in-two-doors.spec.js` (new)

This runs on the phone, tablet and computer projects, with a virtual
authenticator (`enableVirtualAuthenticator`) and `checkA11y()` on every screen
named. It goes through the real UI only. The one read is a `GET
/api/account/home-book`, which the lint allows.

**New and updated journeys**

- `lib/journeys.js`:
  - `openSignInSurface(page)` — the cold row or the account card, then
    expects the heading *Sign in or make an account*.
  - `makeAccount(page, {recovery = 'not now' | email})` — Make an account,
    then expects *Add a recovery email*, then either *Not now*, or the
    address and *Send link* → `recoverySent` → *Done*.
- `signInWithPasskey` / `signedInDevice` now use `makeAccount` with *Not
  now*.
- `signInExistingWithPasskey`, `openEmailedLink`, `signInFromMine`,
  `joinByInvite` and `acceptInvitation` move to the new copy. The invited
  surface's *Make an account* is pressed in place.
- `lib/journeys-account.js` gains `homeBookId(page)`, a read-only `GET
  /api/account/home-book`.

**The spec's four cases**

1. **An account made from the cold first run sets its recovery email right
   after.**
   - `startApp`. The cold row reads *Sign in or make an account*.
   - Open it: both sections are shown. axe.
   - Make an account → *Add a recovery email*. axe.
   - Type `uniqueEmail()` → Send link → the waiting words name it → Done.
   - The shelf has three ways in and no *Sign in or make an account* row.
     The banner *No recovery email yet* is visible. axe.
   - Read the link via `waitForMessage` / `extractRecoveryEmailLink`, and
     `confirmOnFreshDevice`.
   - Back on the device, open Account: the region shows *Confirmed*, and
     there is no banner. *Back*: no banner on Search, Books and Setlists.

   Pins workflow 13 §Asked when the account is made, *Setting it*, §The
   banner (gone once confirmed), and workflow 1 §Cold.
2. **An account that chose Not now sees the banner on every destination until
   it confirms one.**
   - Make an account → Not now.
   - The banner is shown on Search, Books and Setlists (`gotoTab` each), on a
     song opened from search, and on the Account screen. Each holds exactly
     one button, *Add one*.
   - From Books, *Add one* → the account screen, with the *Recovery email*
     field focused.
   - `setRecoveryEmail` → *Waiting for you to confirm*. *Back*: the banner is
     still on every destination (pending keeps it).
   - Confirm via `confirmOnFreshDevice`. Open Account → *Back*: the banner is
     gone from every destination.
   - axe with the banner.

   Pins workflow 13 §The banner (not dismissible, pending keeps it, *Add
   one*, every screen).
3. **From the Account screen after writing a local song.**
   - `startApp`, `writeSongFromScratch` (a song written for the purpose):
     the shelf is no longer empty, so no cold row.
   - Account: the card has one *Sign in or make an account* and no *Use a
     passkey*. axe.
   - Press it: both sections show.
   - Make an account → Not now.
   - The session cookie is set, *My songs* still holds the song, and the
     banner is shown.

   Pins the smoke-test failure and workflow 13 L30-33 (the card is one
   entry).
4. **Signing in from the cold first run with an existing passkey makes no
   second account.**
   - Device A: `makeAccount` (*Not now*), and records `homeBookId(A)`.
   - Device B: `openDevice`, a new virtual authenticator, and `sharePasskeys(A,
     B)`.
   - On B's cold row: *Sign in or make an account* → *Use a passkey* (under
     *Already have an account?*).
   - B lands on its shelf, and *Add a recovery email* never appears.
   - `homeBookId(B)` equals `homeBookId(A)`.
   - A's Account screen lists two signed-in devices.
   - B shows the banner (the account still has no confirmed email). axe.

   Pins workflow 13 L19-28 (making an account never joins one, and signing
   in has no step) and the *Neither*/same-ecosystem cases.

**Existing specs**

These are updated to the new copy and kept green, not weakened:

- `account-sign-in.spec.js`;
- `first-run.spec.js` (the `WAYS` row);
- `share.spec.js`;
- `add-by-link.spec.js`;
- `new-device.spec.js`;
- `account-screen.spec.js`;
- `recovery-email.spec.js`;
- `leaving.spec.js`;
- every user of the changed journeys.

`mockup()` captures keep their frame indices (W01 #1/#2/#4, W13 #1/#2). The
boards were redrawn to these subjects.

### Deferred work

None. No WBS follow-up is registered.

## Decisions

### The surface's create and sign-in outcomes split into `onSignedIn` and `onDone`

**Chosen:** `onSignedIn` fires when the session exists, and `onDone` fires
when the surface's last step ends. This is what lets the home book attach and
the invitation be accepted *behind* the recovery step, as workflow 13 L116-118
requires.

**Rejected:**

- Keeping one `onSignedIn` that closes, and calling it after the step. The
  shelf and the invitation would wait on a mailbox form.
- A separate `onAccountMade` callback. That is two attach paths for one
  event.

### The invitation's prompt is the sign-in surface with the invitation as its lead

**Chosen:** the shell renders the one `SignIn` with `lead={<InvitedLead/>}`,
so the invited screen's sections *are* the surface's. This is workflow 1
§Invited: *not two buttons of the invitation's that open it*. Its ceremonies,
email step, offer and recovery step are the same code.

**Rejected:**

- `InvitedScreen` drawing its own three buttons that open `SignIn` on a
  door. The WebAuthn ceremony would then start from a re-render, not from
  the press, and Safari refuses `navigator.credentials.*` without transient
  user activation.
- Duplicating the ceremonies in `InvitedScreen`. That is two copies of one
  flow.
- Keeping `InvitedScreen`'s prompt and swapping it for `SignIn` on a press.
  That is a second press, which the design rejected.

One `SignIn` element in one tree position also keeps the recovery step alive
while `openByLink` moves the invitation to `working` behind it.

### The recovery step shares the region's request and field, not the region

**Chosen:** a `RecoveryEmailStep` that calls the same
`requestRecoveryEmail`, uses the exported `requestErrorCopy` and a shared
`RecoveryEmailField`, and reuses the region's strings. The board's step reads
*Send link* / *Not now* and then *Done*. The region reads *Send a
verification link* and then *Send again* / *Use a different address*.
Mounting the region would draw the account screen's buttons, not the
decided step.

**Rejected:**

- Mounting `RecoveryEmailRegion` inside the surface. That gives the wrong
  buttons and an `h3` under the step's `h1`.
- A second request path. "The same set-and-verify, not a second one"
  (workflow 13 L111-112).

### The shell learns the account's state from the recovery-email GET

**Chosen:** one probe, `GET /api/account/recovery-email`, gives both answers:
200 means signed in, with the banner's data, and 401 means signed out. The
shell has no session state today, and the banner needs exactly this
resource. The probe runs again on online, visibility, sign-in, sign-out and
account-screen close, so a confirmation opened on another device clears the
banner on the next of those.

**Rejected:**

- `listSessions()` plus a second GET. That is two requests for one answer.
- Reading the Worker's `mine` slice for signed-in-ness. That slice is
  fetched for the add-book sheet and says nothing of the recovery email.
- Caching the answer across launches. Design Decision *Shown on the service's
  answer* rejects it, and the main thread may not touch IndexedDB.
- Polling on a timer. Nothing in the design needs it.

### Which screens carry the banner (design delta)

**Chosen:**

- **The destinations.** The banner sits below the header chrome, as drawn.
- **The account screen.** It draws its own, as drawn.
- **Every other surface that replaces the shell.** One shell wrapper puts
  the banner at the top of the window, above the surface's own bar.
- **Excluded:** the sign-in surface, the verification-link page, the
  setlist's Play, and reading full screen.

Workflow 13 said *every screen* and *below the header chrome*. Most
shell-replacing screens (a song being read, the editors, history, people)
have no header chrome, and workflow 8 distinguishes a song *being read* from
one *read full screen*. So *every screen* must reach them, at the top. The
delta in `docs/workflows/13-new-device.md` §The banner, *Screens without the
header chrome*, says so.

**Rejected:**

- Showing it only where the header chrome is. A song, the screen most time
  is spent on, would never carry it.
- Threading a banner slot under each of a dozen screens' own bars. That is a
  dozen call sites for one strip, against one wrapper.
- Showing it on the sign-in surface. The step there asks the same thing.
- Showing it on the verification page. It may be opened on a device that is
  not the person's, signed out.

### *Not now* reuses `signIn.offerSkip`

**Chosen:** the existing *Not now* string. It is the same word with the same
role (skip an offered step), and translators already have it.

**Rejected:** a new key with identical English in every locale.

### No mockup capture of the Sign-in board in this task

**Chosen:** the new spec asserts the Sign-in board's states, but takes no
`mockup('Sign-in', n)` captures. `Sign-in.dc.html` is not in
`e2e/web/lib/mockup-frames.json`, `mockup()` throws on an unknown frame, and
regenerating the frames is `audit/render-mockups.mjs`'s job, which the
parking lot already tracks (2026-10-19, *check on publishing*). The W01 and
W13 captures that exist keep their indices.

**Rejected:** regenerating `mockup-frames.json` here. It renders every board
and moves unrelated frames, so it belongs in a board pass.

## Open questions

(none — all decided.)

## Status

**Done** — 2026-10-20.

- One sign-in surface: `app/src/account/SignIn.jsx` loses `intent` and draws *Already have an account?* (passkey, emailed link) and *New here?* (make an account); `InvitedScreen.jsx` lands its buttons on the sections.
- `app/src/account/RecoveryEmailStep.jsx` (new) asks a newly made account for its recovery email, reusing `RecoveryEmailRegion.jsx`; *Not now* leaves it to the account screen.
- Every entry opens the same surface: `AppShell.jsx`, `AccountScreen.jsx` (one-button card), `FirstRun.jsx`, `SearchScreen.jsx`, `SongReading.jsx`.
- The banner: `app/src/shell/RecoveryBanner.jsx`, `use-account-status.js`, `account-status.js` (+ test), `recovery-banner.css`; design delta in `docs/workflows/13-new-device.md`.
- Four locales updated (`app/src/i18n/locales/{en,pt-BR,es-419,it}.js`); behavior tests updated/added beside each component (axe included).
- e2e: new `e2e/web/tests/sign-in-two-doors.spec.js` (12/12 on phone, tablet, computer); journeys (`e2e/web/lib/journeys*.js`) and specs that clicked the old copy updated, incl. an exact-text lookup in `add-by-link.spec.js`.

