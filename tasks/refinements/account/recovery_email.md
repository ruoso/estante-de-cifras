# account.recovery_email — Recovery email; deleting a passkey-only account

## TaskJuggler entry

`tasks/70-account.tji` lines 49–54, `task recovery_email "Recovery email;
deleting a passkey-only account"` under `task account`. `depends
!account_screen, !leaving, service.recovery_email, design.recovery_email`.
Back-link target for the completion note:
`Refinement: tasks/refinements/account/recovery_email.md`.

## Effort estimate

**2d** (unchanged from the `.tji`). The service and the contract are done
(`service.recovery_email`), and the design is decided and drawn
(`design.recovery_email`). What remains is app view work on seams that already
exist:

- a **Recovery email** region on the account screen, with three states;
- a token page for the emailed link, modelled on `/sign-in/<token>`;
- a passkey branch in the existing delete dialog;
- the *last way in* rule on the Passkeys rows;
- four auth-client methods;
- four-locale copy.

There is also a one-function fix to the service's SPA fallback, so that the
emailed link opens on a device that has never loaded the app (Decisions §1).
Most of the budget goes on tests: behavior with axe on every state, and two
e2e-web journeys.

## Repository

**estante-de-cifras** only. This is not a cifra.md task: the `.tji` note does
not start with `cifra.md:`, and the format is untouched.

- `app/src/account/`:
  - the Recovery email region (`RecoveryEmailRegion.jsx`), composed into
    `AccountScreen.jsx`;
  - the confirm page (`RecoveryEmailConfirm.jsx`) and its route parser
    (`recovery-email-route.js`);
  - the passkey branch in `LeaveDialogs.jsx` and `leave.js`;
  - the new `auth-client.js` methods and the error `code`;
  - `account.css`.
- `app/src/App.jsx` and `app/src/shell/AppShell.jsx`: the boot capture of the
  token and the confirm surface.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`: the strings.
- `service/internal/server/app.go`: the SPA fallback serves the shell for the
  app's emailed-link routes (Decisions §1), with its test in `app_test.go`.
- `e2e/web/`:
  - `tests/recovery-email.spec.js` (new);
  - `tests/leaving.spec.js` (extended);
  - `lib/mail.js` and `lib/journeys-account.js` (helpers).

`api/` is untouched: the contract is already extended (`api/openapi.yaml`
:228–364, :438–457, :1165–1241).

## Inherited dependencies

All of them are settled.

**design.recovery_email** (Done 2026-10-15) decided:

- workflow 13 §The recovery email (`docs/workflows/13-new-device.md`
  L32–68);
- §The last way in (L70–76);
- §The account screen, the Passkeys bullet (L133–134) and the Recovery email
  bullet (L135–142);
- workflow 17 §Deleting the account (`docs/workflows/17-leaving.md` L50–55)
  and §An account with no email (L70–92), plus its edge cases (L196–203);
- DIRECTION §3.3 (L201–209), §3.6 (L377–383) and §6 (L585–592).

It also drew `docs/mockups/Recovery-email.dc.html` (four frames: Phone 1,
Phone 2, Tablet, Computer). Its refinement's Decisions
(`tasks/refinements/design/recovery_email.md` L237–317) bind this task:

- the region sits below Passkeys;
- the address is written only when the link is opened;
- the link confirms and does not sign in;
- the old address stays in effect, and is told when it is replaced;
- an address held by another account is refused only at the link;
- the owner is shown the address, but the confirm field is not prefilled;
- a passkey-only account confirms deletion with a fresh passkey;
- the last way in cannot be removed.

**service.recovery_email** (Done 2026-10-15, `tasks/refinements/service/recovery_email.md`)
says the app side is this task (:8–12, :26–27, :376–377). Its endpoints:

- `GET /api/account/recovery-email` → 200 `{email, pending}`, both nullable.
  `pending` is still reported after it has expired, so the app keeps showing
  *waiting* with **Send again** (:461–466). 401 without a session.
- `POST /api/account/recovery-email` `{email}` → 202, always. Also 400
  `bad_request`, 401, and 429 `rate_limited` with `Retry-After`.
- `POST /api/recovery-email/confirm` `{token}` takes no session and sets no
  cookie. → 204, 400 `link_invalid` (expired, used, tampered or unknown, all
  one code), 409 `address_taken` (the link stays unconsumed), or 429.
- `POST /api/account/delete/begin` → 200 `{publicKey, state}`. This is a
  non-discoverable assertion over the account's own passkeys, sealed for
  deletion and good for five minutes. → 400 `confirm_by_email` when the
  account has a confirmed email; a pending-only address still gets 200.
- `DELETE /api/account` with `{passkey: {state, credential}}` → 204. A stale
  or foreign assertion → 400 `passkey_refused`. The wrong branch for the
  account → 400 `confirm_mismatch`.
- `DELETE /api/account/passkeys/{id}` → 409 `last_way_in` when the account
  has no email and this is its only passkey.
- The link is mailed as `${ESTANTE_PUBLIC_BASE_URL}/recovery-email/<token>`
  (`service/internal/server/recovery_email.go:148`). The token is
  `base64url(id).base64url(hmac)`, which contains a dot
  (`service/internal/emaillink/token.go:53–55`).

**account.account_screen** (Done) built:

- `AccountScreen.jsx` with its Preferences, Signed-in devices and Passkeys
  regions;
- the injected `authClient` held in `useRef` (:313–314);
- `auth-client.js`, which has a typed `AuthError(kind, status)` and never
  reads the error body's `code` (:20–27).

Its Decision 5 ("shows no email") is superseded for this one region by
design.recovery_email Decision L281.

**account.leaving** (Done) built:

- `LeaveDialogs.jsx`: the delete modal with the typed-email field (:305–314),
  the `role="alert"` errors (:316–324), and `confirmDelete` (:162–177), which
  calls `deleteAccount` and then the Worker's `LEAVE_ESTANTE`;
- `leave.js` `canDeleteAccount` (:34–36);
- `e2e/web/tests/leaving.spec.js`.

Its Open question, that a passkey-only account cannot type-match, is closed
by this task.

**account.sign_in** (Done) set the token-page precedent. These are covered
under Inputs: `sign-in-route.js`, `App.jsx`'s `bootRedeemToken` (:108–110)
with the `replaceState` cleanup (:182–186), `AppShell`'s token-seeded
surface (:261–263, :547–564), and `webauthn-json.js` `getCredential`
(:29–36) / `isCancellation` (:42–44).

## What this task is

It builds the app side of the recovery email and of a passkey-only account's
deletion, as workflows 13 and 17 decide and `Recovery-email.dc.html` draws.

**The Recovery email region.** A signed-in person's account screen gains it
below Passkeys. It is read from `GET /api/account/recovery-email` and shows:

- **none**: the warning, an address field and **Send a verification link**;
- **waiting for you to confirm**: names the pending address, with **Send
  again** and **Use a different address**;
- **confirmed**: the address, a *Confirmed* badge, and **Change**. While a
  change is pending, the confirmed address stays shown above the waiting
  block.

The region's actions wait offline, and it says so in words.

**The last way in.** While the account has no confirmed email, its only
passkey loses **Remove**. In its place:

- a *last way in* badge;
- *Your only way to sign in — add a recovery email or another passkey
  first.*

**The confirm page.** The emailed `/recovery-email/<token>` link opens a page
on any device, signed in or not. The page posts the token and says, in words,
that the email is confirmed, the link is expired or used, or the address
belongs to another account. It never signs in.

**Deleting a passkey-only account.** When the account has no confirmed email,
Leaving's **Delete my account** dialog replaces the typed field with a passkey
notice. Pressing Delete asks the browser for a passkey through
`delete/begin`, sends the assertion with `DELETE /api/account`, and then
tears the device down exactly as the typed path does. A cancelled prompt and
a refused assertion each leave the dialog open with their own `role="alert"`
words.

## Why it needs to be done

Nothing in the app writes `accounts.email` today. A passkey-only account, which
is every account created through the app, therefore has no recovery path:
lose every device with a passkey and the account is gone. Such an account
also cannot delete itself, because the typed confirm can never match. Both
were filed in `tasks/parking-lot.md` 2026-10-14 and are why the design and
service tasks exist; this task is where a user can finally reach them.

Downstream:

- `books.add_book_chooser`'s *No passkey here? Email me a link* needs a
  recovery email to exist (service refinement :8–12).
- Three e2e specs seed `accounts.email` straight into Postgres with a "no UI
  writes a recovery email yet" comment (`e2e/web/lib/db.js` `seedAccount`
  :28, used at `account-sign-in.spec.js:68` and `leaving.spec.js:48`, :126).
  After this task, a real UI path exists.

## Inputs / context

**Governing documents.** These are normative, and the copy is taken from them
and from the board.

- **Workflow 13** (`docs/workflows/13-new-device.md`):
  - §The recovery email, L32–68: Setting it L41, Confirming it L48, Changing
    it L54, Who holds an address L60, It needs a connection L66;
  - §The last way in, L70–76;
  - §The account screen, L133–142;
  - §Later, L152–164: removing the email and prompting for one unasked are
    *not* in scope.
- **Workflow 17** (`docs/workflows/17-leaving.md`):
  - §Deleting the account, L50–55;
  - §An account with no email, L70–92;
  - §The cascade, L141–145;
  - §Offline, L165–176;
  - Edge cases L196–203: no passkey reachable on this device, and an email
    that is set but unconfirmed still confirms by passkey.
- **DIRECTION**: §3.3 rate limits L201–209 (*try again shortly*); §3.6 Signing
  in, L377–383; §3.7 the app (offline first, view-only React); §6 L585–592.
- **The board**, `docs/mockups/Recovery-email.dc.html`:
  - Phone 1 (L26–60): the none state and the last passkey;
  - Phone 2 (L65–96): waiting, and the *When offline* note;
  - Tablet (L105–139): the link opened, plus the Confirmed state with Change
    and a removable passkey;
  - Computer (L147–200): the passkey-confirmed delete with the cancelled
    alert.
- `docs/mockups/README.md` "Decisions the drawings carry" and `theme.css`:
  badges `badge unsaved dot` and `badge ok dot`.

**Code seams.**

- `app/src/account/AccountScreen.jsx`:
  - `probe` :331–347 and `loadPasskeys` :316–324;
  - `removePasskey` :370–381: a 409 currently surfaces as `errNetwork`;
  - `passkeysRegion` :509–548, with its per-row Remove `ConfirmDialog`
    :527–537;
  - the signed-in composition :592–605: identity, error, devices, passkeys,
    then `<LeaveDialogs>`.
- `app/src/account/auth-client.js`:
  - `AuthError` :20–27;
  - the helpers `postJson` :33, `getJson` :63, `del` :78;
  - `deleteAccount(confirmEmail)` :182–198.
- `app/src/account/LeaveDialogs.jsx`:
  - `useOnline` :54–69;
  - the delete state :96–100;
  - `openDelete` :153–160, `confirmDelete` :162–177;
  - the typed field :305–314 and the error alert :316–324.
- `app/src/account/leave.js` `canDeleteAccount` :34–36.
- `app/src/account/webauthn-json.js` `getCredential` :29–36 and
  `isCancellation` :42–44.
- `app/src/account/sign-in-route.js` (regex `/^\/sign-in\/([^/?#]+)\/?$/`,
  :14–22), with its pure test `sign-in-route.test.js`.
- `app/src/App.jsx` `bootRedeemToken` :108–110, `useState(bootRedeemToken)`
  :173 and the URL cleanup :182–186.
- `app/src/shell/AppShell.jsx`: props :225–231, the signIn seed :261–263, the
  surface order :547–601.
- `service/internal/server/app.go`: `ServeHTTP` :62–82 and `isAssetRequest`
  :125–131. `path.Ext("recovery-email/<id>.<sig>")` is non-empty, so on a
  device with no service worker yet, a cold load of the link 404s instead of
  booting the shell. `/sign-in/<token>` has the same latent fault.
  `account-sign-in.spec.js:83–90` only passes because it opens the link in a
  context whose service worker already serves `navigateFallback`
  (`app/vite.config.js:46`).
- Tests:
  - `AccountScreen.behavior.test.jsx`: `makeAuthClient(routes)` :48–69,
    `installWebAuthn` :74–102 (create only), the Leaving order check
    :603–648;
  - `LeaveDialogs.behavior.test.jsx`: `makeAuthClient` :42–63, the Delete
    describe :247 and its mismatch case :313, Offline :335;
  - `leave.test.js`;
  - `app/src/a11y/axe.js` `checkWcag21aa`;
  - `app/src/i18n/i18n.test.js`, which enforces parity across the four
    locales.
- e2e-web:
  - `lib/journeys.js`: `enableVirtualAuthenticator` :65–83 (CDP),
    `signedInDevice` :120, `hasSessionCookie` :95;
  - `lib/journeys-account.js`: `uniqueEmail` :11, `openAccount` :16,
    `openEmailedLink` :25–41;
  - `lib/mail.js`: `waitForMessageTo` :48–56, `extractSignInLink` :60–65;
  - `lib/devices.js` `openDevice(browser)` :11, a fresh context with no
    service worker;
  - `lib/axe.js`, which provides the `checkA11y` fixture;
  - `playwright.config.js:39–43`: the phone, tablet and computer projects.
- e2e-api precedent for the mail flow: `e2e/api/recovery-email.test.js:44–75`.
  Its `waitForMail(recipient, accept)` polls until a predicate passes,
  because one address receives several mails in turn.

## Constraints / requirements

**Components.**

- React Aria Components for every interactive part: TextField (type email),
  Button, the existing ConfirmDialog/Modal.
- RAC overlays portal into `.est` ([[rac-overlays-portal-outside-est-theme-root]]).
- Keyboard paths throughout. Every status is a word (*No recovery email*,
  *Waiting for you to confirm*, *Confirmed*, *last way in*), never colour
  alone.
- axe at WCAG 2.1 AA on every state.

**Network and errors.**

- The recovery email is plain session HTTP on the main-thread auth-client,
  like sessions and passkeys (account_screen Decision 6). The Worker is not
  involved, and nothing is written to IndexedDB, the home book or any book
  (workflow 13 L34–39).
- Nothing waits on the network that is not about the network. Offline, the
  region's actions are disabled with the *When offline* note. Songs, and the
  rest of the screen, are untouched (workflow 13 L66–68; DIRECTION §3.7).
- `AuthError` carries the server's `code` (read from the `{code, message}`
  body when one is present). The view words each code itself; it never shows
  the server's `message` and never shows a raw status.
- 429 (`rate_limited`) is worded *Too many tries — try again shortly.*
  (DIRECTION §3.3), and the region stays usable.

**What is shown and logged.**

- The address appears only in this region and on the confirm page, to its
  owner (design Decision L281). Leaving's typed confirm field is still never
  prefilled, and the app still never echoes the address in an error.
- Nothing is logged that holds the address or the token. The app's token
  route clears the URL with `history.replaceState` on boot, as
  `/sign-in/<token>` does.

**The confirm page.**

- It must not create a session or change the device's signed-in state. It
  needs no session, and a 401 is impossible there; it must not be read as
  *signed out*.
- On a device that has never loaded Estante, the page must boot from a cold
  load. That makes the service fix in Decisions §1 part of this task.

**Deletion.**

- The typed path is unchanged for an account whose email is confirmed. A
  pending-only address confirms by passkey (workflow 17 L202–203).
- A passkey-only account is never made to set an email in order to leave
  (workflow 17 L88–92).
- After a 204, the teardown is the same `LEAVE_ESTANTE` path as today
  (leaving Decisions 3, 7).

**Language and tests.**

- Every string ships in all four locales: en, pt-BR, es-419 and it.
- Test fixtures use addresses under `@estante.test` (e2e) or `example.com`
  (behavior). There is no song text.

## Acceptance criteria

### Behavior delivered

**Auth-client.** `app/src/account/auth-client.js` gains:

- `getRecoveryEmail()` → `{email, pending}`;
- `requestRecoveryEmail(email)` → resolves on 202;
- `confirmRecoveryEmail(token)` → resolves on 204;
- `beginDeletePasskey()` → `{publicKey, state}`;
- `deleteAccountByPasskey({state, credential})` → resolves on 204.

`AuthError` carries `code` when the response body has one. The kinds added:

| Server answer | `AuthError` kind |
| --- | --- |
| 429 | `'rate_limited'` |
| 400 `link_invalid` | `'link_invalid'` |
| 409 `address_taken` | `'address_taken'` |
| 400 `passkey_refused` | `'refused'` |
| 400 `confirm_by_email` | `'confirm_by_email'` |
| 409 `last_way_in` | `'last_way_in'` |
| 400 `bad_request` on the address | `'bad_request'` |

The existing kinds (`unauthorized`, `network`, `not_found`, `mismatch`) are
unchanged.

**The Recovery email region** (`RecoveryEmailRegion.jsx`) is composed into
`AccountScreen.jsx` between `passkeysRegion` and `<LeaveDialogs>`. It is shown
only when signed in. Its heading is *Recovery email*, and `AccountScreen`
loads it after the passkeys in `probe`. It renders:

- **none** (`email` and `pending` both null), as on board Phone 1:
  - the *No recovery email* badge;
  - *If you lose every device with a passkey, there is no way back in.*;
  - a field labelled *Recovery email*, with the hint *Used only to email you
    a sign-in link. Shown here, to you, and nowhere else.*;
  - **Send a verification link**.
- **waiting** (`pending` set), as on Phone 2:
  - the *Waiting for you to confirm* badge;
  - *We sent a verification link to **{address}**. Check your inbox and open
    it.*;
  - *The link works once, for fifteen minutes. Until it is opened, nothing
    changes…*. The tail reads *…and the account still has no recovery email*
    only when `email` is null; when a change is pending it reads *…and
    {confirmed address} stays your recovery email*;
  - **Send again**, which posts the pending address;
  - **Use a different address** (quiet), which returns to the field.
- **confirmed** (`email` set), as on the Tablet's account-screen card:
  - the address with the *Confirmed* badge;
  - *Gets a sign-in link when you ask for one. Shown only to you.*;
  - **Change**, which opens the field with **Send a verification link** and
    **Cancel**;
  - the hint *Changing it keeps this address in effect until the new one is
    confirmed; this address then gets a short notice that it was changed.*

  With `pending` also set, the confirmed card is followed by the waiting block
  for the new address.

How a request is answered:

- A 202 reloads the region, which lands in waiting.
- A 400 `bad_request` gives a `role="alert"` *That does not look like an
  email address.*
- A 429 gives *Too many tries — try again shortly.*
- A network failure gives the existing `errNetwork` word with **Retry**.

Offline (`useOnline` false), every region button is disabled and the note
reads *The recovery email needs a connection, like signing in. Its buttons
wait until you are back online; your songs do not.*

**The last way in** (workflow 13 L70–76, Phone 1). When the account has no
confirmed `email` and exactly one passkey, that row shows:

- the *last way in* badge;
- *Your only way to sign in — add a recovery email or another passkey
  first.*;
- no **Remove**.

A pending address does not lift this. With a confirmed email, every row has
**Remove** (Tablet). If a remove still races into 409 `last_way_in`, the
screen words it with the same sentence in a `role="alert"` and reloads the
passkeys and the region.

**The confirm page.**

- `recovery-email-route.js` `recoveryEmailToken(pathname)` matches
  `/^\/recovery-email\/([^/?#]+)\/?$/`.
- `App.jsx` captures the token at boot (`bootRecoveryEmailToken`) and clears
  the URL, alongside the sign-in and invitation tokens.
- `AppShell` renders `RecoveryEmailConfirm` as its own full-screen surface,
  checked before `signIn`, `account` and `invited`.

The page posts `confirmRecoveryEmail(token)` once (a ref-guarded effect, as
`SignIn`'s redeem does). Its app bar shows *Estante*, and it shows:

- **while it waits**: *Confirming your recovery email…*;
- **204** (Tablet): the heading *Your recovery email is confirmed*, and the
  notice *This link only confirms the address — it does not sign you in on
  this {device}, and opens no book.* The body is *Your recovery email is now
  where Estante sends a sign-in link if you lose every device with a
  passkey.*, without the address, because the page has no session and the
  `204` carries none;
- **400 `link_invalid`**: *This link has expired or was already used — send a
  new one from the account screen.*;
- **409 `address_taken`**: *This address is the recovery email of another
  Estante account — sign in with it instead.*;
- **429**: *Too many tries — try again shortly.*, with **Try again**;
- **network or offline**: the existing `errNetwork` word and **Try again**.

Every outcome has **Open Estante**, which closes the surface to the shelf.
The device's session is untouched: a signed-in device stays signed in, and a
signed-out one stays signed out.

**Deleting a passkey-only account** (workflow 17 L70–92, Computer):

- `AccountScreen` passes `confirmBy`, which is `'email'` when `email` is
  set, `'passkey'` when it is null, and `null` until the region has loaded,
  to `<LeaveDialogs>`.
- With `confirmBy === 'passkey'`, the delete modal keeps its willHappen list,
  its counted warnings and **Take your data out first**. It replaces the
  typed field with the notice *This account has no email. Confirm with one of
  your passkeys to delete it.*
- `canDeleteAccount` becomes `canDeleteAccount({confirmBy, confirmEmail,
  online})`:
  - `'email'` needs a non-empty field and online;
  - `'passkey'` needs online only;
  - `null` disables the action.
- Pressing **Delete my account** with `'passkey'` runs `beginDeletePasskey()`,
  then `getCredential(publicKey)`, then `deleteAccountByPasskey({state,
  credential})`. A 204 dispatches `LEAVE_ESTANTE`, as the typed path does.
- The failures, each a `role="alert"` with the dialog left open:
  - **cancelled** (`isCancellation`): *Not deleted — the passkey was not
    confirmed. Nothing has changed. Try again when you are ready.* This also
    covers a device where no passkey for the account can be reached
    (workflow 17 L196–201), because the browser's prompt ends in
    `NotAllowedError`;
  - **`passkey_refused`**: *That passkey did not confirm this account. Try
    again.*;
  - **`confirm_by_email` from begin** (an email confirmed elsewhere since the
    screen loaded): the screen reloads the region, and the dialog switches to
    the typed field with *This account now has an email — type it to
    confirm.*;
  - **network**: the existing word.
- No `DELETE` is sent after a cancelled prompt.

**The service SPA fallback.** In `service/internal/server/app.go`, a path
whose first segment is one of the app's emailed-link routes (`sign-in`,
`recovery-email`) is a navigation, even when its token holds a dot. The shell
is served, not a 404 (Decisions §1).

**Comments.** The header comments that say the screen "shows no email"
(`AccountScreen.jsx:30`, `LeaveDialogs.jsx:1–25`) are updated to name the
region as the one place the address is shown.

### Tests, by level

The `.tji` names **behavior** and **e2e-web**. A **unit** level is added for
the new pure modules and the service fallback, following the precedent of
sign_in and leaving, which each added unit tests for their pure shapes. Every
named test lands in this task and runs, not skipped, in `scripts/gate`.

**unit**

- `app/src/account/recovery-email-route.test.js` (new) — the token is
  extracted from `/recovery-email/<id>.<sig>` and `/recovery-email/<t>/`;
  null for `/recovery-email/`, `/recovery-email/a/b`, `/sign-in/<t>` and `/`.
  Pins workflow 13 L48 (the link opens the app's own page).
- `app/src/account/leave.test.js` (extended) — `canDeleteAccount`:
  - `'passkey'` is enabled online with an empty field, and disabled offline;
  - `'email'` is unchanged;
  - `null` is always disabled.

  Pins workflow 17 L70–92.
- `app/src/account/recovery-email.test.js` (new, pure) — the region-state
  selector `recoveryEmailState({email, pending})` → `none` / `waiting` /
  `confirmed` / `confirmed+waiting`, and the last-way-in predicate
  `isLastWayIn({email, passkeys})`:
  - true for exactly one passkey with no confirmed email, pending or not;
  - false with two passkeys, or with a confirmed email.

  Pins workflow 13 L70–76 and L135–142.
- `service/internal/server/app_test.go` (extended) —
  `TestEmailedLinkRoutesServeShell`:
  - `GET /recovery-email/AAAA.BBBB` and `GET /sign-in/AAAA.BBBB` → 200 with
    the shell's `index.html`;
  - `GET /assets/missing.js` and `GET /foo.js` still → 404, as in
    `TestMissingAssetIs404`.

  Pins `service.serve_app` (SPA fallback) and workflow 13 L48 ("on any
  device").

**behavior** (RTL, real React Aria, real i18n, an injected loopback
`authClient` via `makeAuthClient`, `checkWcag21aa` on every state; shapes
checked structurally against `api/openapi.yaml`, not via `api/validate.js`,
per [[api-validate-js-breaks-under-vite]])

- `app/src/account/AccountScreen.behavior.test.jsx` (extended). Every
  existing `signedInClient()` gains the `GET /api/account/recovery-email`
  route. New `describe('Recovery email')`:
  - The region is present only when signed in, and the document order is
    Passkeys < Recovery email < Leaving Estante.
  - The **none** state: the badge word, the warning and the field. Sending
    posts `{email}` to `POST /api/account/recovery-email` (body shape checked)
    and lands in **waiting**, which names the address with Send again and Use
    a different address.
  - **Send again** re-posts the pending address.
  - **Use a different address** returns to the field.
  - **confirmed**: the address and the *Confirmed* badge. **Change** opens
    the field. **confirmed+waiting** shows both, with the confirmed address
    kept.
  - A 429 shows *Too many tries — try again shortly.* in a `role="alert"`.
    A 400 shows the invalid-address word.
  - Offline: every region button is disabled, with the *When offline* note.
  - **The last way in**: with one passkey and no email, there is no Remove
    button on that row, and the badge and sentence are shown. With a pending
    email, the same. With two passkeys, both have Remove. With a confirmed
    email and one passkey, Remove is present.
  - A `DELETE /api/account/passkeys/{id}` answered 409 `last_way_in` shows
    the sentence as an alert, not `errNetwork`.
  - axe clean on none, waiting, confirmed, confirmed+waiting, offline and
    last-way-in.

  Pins workflow 13 §The recovery email L41–68, §The last way in L70–76, §The
  account screen L133–142, and board Phone 1, Phone 2 and Tablet (account
  card).
- `app/src/account/RecoveryEmailConfirm.behavior.test.jsx` (new):
  - 204 → *Your recovery email is confirmed* and the does-not-sign-in
    notice. The POST body is `{token}`, posted exactly once across
    re-renders. `onSignIn` is never called, and no session call is made.
  - 400 `link_invalid` → the expired/used copy.
  - 409 `address_taken` → the another-account copy.
  - Network → `errNetwork` plus Try again, which re-posts.
  - **Open Estante** calls `onClose`.
  - axe clean on each outcome.

  Pins workflow 13 §Confirming it L48–53 and §Who holds an address L60–65,
  and board Tablet.
- `app/src/account/LeaveDialogs.behavior.test.jsx` (extended; `installWebAuthn`
  gains `navigator.credentials.get`). New `describe('Delete — no email')`:
  - With `confirmBy="passkey"`: there is no textbox, and the passkey notice
    is shown. Delete is enabled online with nothing typed.
  - Pressing Delete calls `POST /api/account/delete/begin`, then
    `credentials.get` with the returned options, then `DELETE /api/account`
    with `{passkey: {state, credential}}` (body checked). On 204,
    `LEAVE_ESTANTE` runs and `onLeft` fires.
  - `credentials.get` rejecting with a `NotAllowedError` → the not-confirmed
    alert, the dialog open, and **no** `DELETE` in `calls`.
  - `passkey_refused` → the refused alert.
  - `confirm_by_email` from begin → the typed field appears with its
    switch-over word.
  - Offline → Delete disabled with *Needs a connection…*.
  - `confirmBy={null}` → Delete disabled.
  - The existing typed-email cases pass with `confirmBy="email"`.
  - axe clean on the passkey dialog, the cancelled alert and the refused
    alert.

  Pins workflow 17 §An account with no email L70–92 and Edge cases L196–203,
  and board Computer.

**e2e-web** (phone, tablet and computer projects; `checkA11y()` at WCAG 2.1
AA on every screen touched; real UI only, per `e2e/web/eslint.config.js`)

`e2e/web/lib/mail.js` gains `extractRecoveryEmailLink(message)` (regex
`/https?:\/\/\S*\/recovery-email\/\S+/`) and `waitForMessage(recipient,
accept)`, a polling predicate as in the e2e-api `waitForMail`.
`e2e/web/lib/journeys-account.js` gains `setRecoveryEmail(page, email)`, which
types the address, sends, and waits for the waiting badge.

`e2e/web/tests/recovery-email.spec.js` (new):

1. **An email set and verified via the mail catcher.**
   - `signedInDevice(page)` gives a passkey-only account. Open Account.
   - The region says *No recovery email*. The only passkey shows *last way
     in* and has no Remove. axe.
   - `setRecoveryEmail` → *Waiting for you to confirm* names the address.
     axe.
   - Read the link with `waitForMessage` + `extractRecoveryEmailLink`. Open
     it in a **fresh context** (`openDevice(browser)`), which has no service
     worker, so this exercises the cold-load fallback.
   - The new context shows *Your recovery email is confirmed*, and
     `hasSessionCookie` is false there. axe.
   - Opening the same link again shows the expired/used copy.
   - Back on the first device, reopen Account. It shows the address as
     *Confirmed*, and the passkey now has Remove.
   - Finally, in a third fresh context, the emailed sign-in with that address
     works (`openEmailedLink`), which proves the address is the account's way
     back in.

   Pins workflow 13 §Setting it, §Confirming it and §The last way in, plus
   workflow 13 L25–30 (the emailed link goes to the recovery email).
2. **Changing it.**
   - With a confirmed address A, **Change** → B. The region shows A
     *Confirmed* and B waiting.
   - Confirm B's link. A receives the changed notice, matched on `/changed/i`
     in its subject.
   - Account shows B *Confirmed*. axe on the confirmed+waiting state.

   Pins workflow 13 §Changing it L54–59.
3. **An address another account holds.**
   - A second `signedInDevice` account requests the first account's
     confirmed address. The region still shows waiting, so nothing is
     revealed.
   - Its link opened shows *This address is the recovery email of another
     Estante account — sign in with it instead.* axe.

   Pins workflow 13 §Who holds an address L60–65.
4. **Offline.**
   - Open Account, then `context.setOffline(true)` (the `leaving.spec.js:95`
     pattern).
   - The region's buttons are disabled, with the *When offline* note. axe.

   Pins workflow 13 L66–68.

`e2e/web/tests/leaving.spec.js` (extended):

5. **A passkey-only account deleted with a virtual authenticator.**
   - `signedInDevice(page)`, open Account, then **Delete my account**.
   - The dialog has no email textbox and shows the passkey notice. axe.
   - **Delete my account** → the virtual authenticator answers → the device
     returns signed out to its first-run state, with the account's books
     removed (the existing typed-path assertions).

   Pins workflow 17 L70–92 and §The cascade L143–145.
6. **The passkey prompt not confirmed.**
   - On a passkey-only account, clear the virtual authenticator's
     credentials (CDP `WebAuthn.clearCredentials`, on the client
     `enableVirtualAuthenticator` returns), then press Delete.
   - The browser's prompt ends unconfirmed, and the dialog shows *Not
     deleted — the passkey was not confirmed…* and stays open.
   - The account still exists: closing the dialog, Account still lists its
     sessions. axe on the alert.

   Pins workflow 17 L83–85 and L196–201, and board Computer.

`account-screen.spec.js:123–147`, which adds a second passkey and removes one,
stays valid: two passkeys, one removed, and the survivor then shows *last way
in*. The spec gains that assertion.

### Deferred work

None. Workflow 13 §Later (removing the recovery email, prompting for one
unasked) is a product decision that the design task left in the parking lot.
It is not registered here. No test is deferred.

## Decisions

1. **This task fixes the service's SPA fallback for the emailed-link routes.**
   The link must open "on the app's own page on any device, signed in or not"
   (workflow 13 L48). The token's dot makes `isAssetRequest` 404 a cold load
   (`app.go:129–131`). It works today only where a service worker already
   serves `navigateFallback`.

   Alternatives rejected:
   - Leave it for a separate task: the e2e journey in a fresh context, which
     is the honest test of "any device", would fail. Not testing in a fresh
     context would hide it.
   - Change the token encoding: that is a service and contract change to
     `emaillink`, shared with sign-in.
   - Special-case only `/recovery-email/`: `/sign-in/` has the identical
     fault and the same one-line fix. Fixing it beside its twin costs a test
     case, not a task.

   The fix is an explicit allowlist of link-route prefixes, not a looser
   extension rule, so a missing asset still 404s (`service.serve_app`'s
   intent). No design delta is needed: it delivers what workflow 13 already
   says.
2. **The screen loads the recovery email once and passes `confirmBy` to
   LeaveDialogs.** Rejected: LeaveDialogs fetching on its own, which would
   make two requests for one fact, and two states that could disagree. The
   dialog's `confirm_by_email` fallback covers the race where the email is
   confirmed on another device while the dialog is open.
3. **`confirmBy` is null until known, and that disables Delete.** Rejected:
   defaulting to the typed field. That would recreate today's dead end for a
   passkey-only account whenever the GET failed, and the region's
   `errNetwork` + Retry already explains the state.
4. **The error `code` is read into `AuthError`, and the view words each code
   itself.** Rejected: showing the server's `message`. It is English-only and
   phrased for the API. The app has four locales, and the copy is the
   workflow's.
5. **The last-way-in rule is applied in the view from data the screen already
   holds** (one passkey, no confirmed email), with the 409 as a backstop.
   Rejected: offering Remove and relying on the 409. Workflow 13 L72–74 says
   the Remove *is replaced*, and the board draws no Remove.
6. **The confirm page is its own AppShell surface, captured at boot like
   `/sign-in/<token>`**, not a route inside the account screen. It needs no
   session, and it must show on a signed-out device (account_screen
   Decision 1: view-state, no router).
7. **The confirm page does not name the address.** The `204` carries no body
   and the page has no session, so it cannot read it. Adding the address to
   the response would be a contract change for decoration, and would put the
   address on whichever device opened the link. The board's Tablet body with
   the address is therefore rendered without it. The account screen's
   *Confirmed* card shows the address to its owner, as drawn.
8. **The no-passkey-reachable refusal (workflow 17 L196–201) shares the
   cancelled alert.** The browser does not distinguish "no credential here"
   from "cancelled" (`NotAllowedError` for both), the workflow decides no
   separate wording, and the cancelled alert's *Nothing has changed. Try
   again when you are ready.* is true in both cases.
9. **The confirm page and the region use the board's sentence case** where it
   differs from the workflow's lower-case prose, and its fuller wording where
   the board extends it (*Nothing has changed. Try again when you are
   ready.*). The board is the drawn decision, and the workflow's inline
   italics are prose quotations.
10. **`seedAccount` stays in the specs that use it.** Those specs are about
    sign-in by email and the typed delete, not about setting the email.
    Moving them onto the UI path would lengthen every such journey for no new
    coverage, since this task's spec 1 covers the UI path end to end.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- Recovery email region (none / waiting / confirmed / confirmed+waiting, worded offline) and the "last way in" rule on the Passkeys rows: app/src/account/RecoveryEmailRegion.jsx, AccountScreen.jsx, account.css, use-online.js.
- Confirm page for the emailed `/recovery-email/<token>` link, which never signs in: app/src/account/RecoveryEmailConfirm.jsx, recovery-email-route.js, recovery-email.js; wired through app/src/App.jsx and app/src/shell/AppShell.jsx.
- Auth client gains getRecoveryEmail, requestRecoveryEmail, confirmRecoveryEmail, beginDeletePasskey, deleteAccountByPasskey and the new AuthError kinds: app/src/account/auth-client.js.
- Passkey-confirmed account deletion when there is no confirmed email (a 400 `confirm_mismatch` is treated as `confirm_by_email`): app/src/account/LeaveDialogs.jsx, leave.js; copy in app/src/i18n/locales/{en,pt-BR,es-419,it}.js.
- Service SPA-fallback allowlist so `/sign-in/<token>` and `/recovery-email/<token>` serve the shell on a device that never loaded the app: service/internal/server/app.go, app_test.go (`TestEmailedLinkRoutesServeShell`).
- Tests: unit (recovery-email-route.test.js, recovery-email.test.js, leave.test.js); behavior (AccountScreen, RecoveryEmailConfirm, LeaveDialogs `.behavior.test.jsx`); e2e-web (e2e/web/tests/recovery-email.spec.js, leaving.spec.js, account-screen.spec.js on phone, tablet and computer; helpers e2e/web/lib/mail.js, journeys-account.js).

