# account.sign_in — Signing in

## TaskJuggler entry

[`tasks/70-account.tji`](../../70-account.tji), `task account.sign_in`
("Signing in"). `depends service.passkeys, service.email_links,
service.sessions`.

## Effort estimate

3d (`allocate team`), as the `.tji` fixes it. The weight is a new app area
(`app/src/account/`) that is the app's **first** non-git network consumer and
its first `navigator.credentials` caller — a small REST client, a multi-step
sign-in surface with three ceremonies (register, authenticate, email request /
redeem), a boot-time redeem route, and the e2e harness that drives a virtual
authenticator and the mail catcher. No Worker/storage work (that is
`account.new_device`), which keeps it to three days.

## Repository

**estante-de-cifras** only. App work: the `.tji` note does not start with
`cifra.md:`. Directories touched:

- `app/src/account/` — **new area.** The sign-in surface (`SignIn.jsx` + small
  presentational children), a main-thread auth client over the `/api/auth/*`
  and `/api/account/passkeys` endpoints, a thin native-WebAuthn JSON helper, and
  the pure predicates (the boot-route token parser, the offer-a-passkey rule).
- `app/src/shell/AppShell.jsx` — a new full-screen surface state `signIn`
  following the `openSong`/`openFile` `useState` + early-return pattern
  (AppShell.jsx:182–198, 317–388), and threading the already-present `onSignIn`
  seam into `destinationPanels` (currently dropped at AppShell.jsx:138/151).
- `app/src/App.jsx` — the boot-time redeem route: when the app loads at
  `/sign-in/<token>` it opens the surface in redeem mode (sibling to the
  `#dev/*` mounts, App.jsx:19–60), then cleans the URL.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the sign-in copy in all four
  locales (the `firstRun.signIn`/`signInMeta` keys already exist at
  en.js:147–148).
- `e2e/web/tests/` and `e2e/web/lib/` — the account sign-in journey, plus a
  Mailpit reader added to `e2e/web/lib/` (the `devices.js` harness header, lines
  4–7, anticipates exactly this: "the Mailpit-driven sign-in step is added by
  the first `account` e2e-web journey, reusing this harness, never a new one").

The only contract with the service is `api/openapi.yaml`; no service or
`cifra.md` work lands here (DIRECTION §3.6, "The app and the service share no
code", line 288).

## Inherited dependencies

All three settled (Done 2026-10-07) and all service-side — they define the API
this task consumes; the app shares none of their code:

- **`service.passkeys`**
  ([`tasks/refinements/service/passkeys.md`](../service/passkeys.md)) — the
  WebAuthn endpoints: `POST /api/auth/passkey/register/{begin,finish}` (public
  **or** authed; no session → `finish` creates a new account and starts a
  session — the primary account-creation path), `POST
  /api/auth/passkey/authenticate/{begin,finish}` (public; `finish` starts a
  session). `begin` returns `{ publicKey, state }`; the app echoes the opaque
  `state` to `finish` unchanged (the challenge is carried HMAC-signed in
  `state`, ~5-min expiry, nothing stored server-side). Cross-device ("use a
  phone or tablet" + QR) is "nothing in the app beyond standard WebAuthn" — the
  browser drives it; the service sees a standard assertion. `authenticate/finish`
  is **200/401 only**.
- **`service.email_links`**
  ([`tasks/refinements/service/email_links.md`](../service/email_links.md)) —
  `POST /api/auth/email/request` (public, body `{ email }`, **always 202** so no
  account is enumerated) mails `${ESTANTE_PUBLIC_BASE_URL}/sign-in/<token>` only
  when the address has an account (15-minute, single-use token); `POST
  /api/auth/email/redeem` (public, body `{ token }`, 200 starts a session / 401
  if tampered/expired/reused).
- **`service.sessions`**
  ([`tasks/refinements/service/sessions.md`](../service/sessions.md)) — the
  session cookie this task relies on: **`estante_session`**, `HttpOnly`,
  `Secure`, `SameSite=Lax`, `Path=/`, minted by `session.Issue` on every
  successful `finish`/`redeem`. One origin, no CORS, no bearer token — the
  browser carries it automatically (DIRECTION §3.3 lines 171–173). `POST
  /api/auth/signout`, `GET/DELETE /api/account/sessions*` are **not** this
  task's (they are `account.sign_out` / `account.account_screen`).

Settled context relied on but not a direct predecessor: `shell.layout` (the
`AppShell` full-screen-surface pattern and `DESTINATIONS`),
`shell.portal_provider` (`ThemeRoot`'s `UNSAFE_PortalProvider getContainer={()
=> rootRef.current}` at ThemeRoot.jsx:67, so any RAC overlay portals **inside**
`.est` and inherits the tokens — the `rac-overlays-portal-outside-est-theme-root`
gotcha is already solved app-wide), `account.first_run` (shipped the `onSignIn`
seam this task fills — FirstRun.jsx:122/151, SearchScreen.jsx:334/544), and the
`foundation.e2e_web` harness (`e2e/web/`, `e2e/web/lib/devices.js`,
`e2e/web/lib/axe.js`).

## What this task is

The app's **authentication** flow: everything that makes the service set (or,
for a brand-new user, first mint) the `estante_session` cookie. Reached through
the `onSignIn` seam `account.first_run` already wired to the empty shelf's
"Sign in" row, it stands up one surface that offers, per workflow 7 §Signing in
and workflow 13 §Signing in on another device:

1. **Sign in with a passkey** (returning user) — `authenticate/begin` →
   `navigator.credentials.get()` → `authenticate/finish`. The browser decides
   same-ecosystem (a synced passkey, face/finger, done) vs another-ecosystem
   ("use a phone or tablet" + QR over Bluetooth) entirely on its own; the app
   draws no QR.
2. **Make an account with a passkey** (brand-new user, no session) —
   `register/begin` → `navigator.credentials.create()` → `register/finish`,
   which creates the account and starts the session. This is the primary
   account-creation path (workflow 7, "An account is a passkey").
3. **Email me a link** (the fallback where no passkey can be reached, and
   account recovery) — `email/request` (always answered "check your email"),
   then, when the user follows the mailed link, the app boots at
   `/sign-in/<token>` and `email/redeem`s it.
4. **Offer a passkey on this device** — after a sign-in that did **not** use a
   passkey resident here (an email redeem, or a cross-device assertion), the app
   offers to `register` one so next time is case 1 (workflow 13 lines 23–24).

On success the surface hands the resulting `Account { id }` to an
`onSignedIn(account)` seam and closes. It does **not** fill the shelf, bring
down the home book, reconcile a device used before signing in, or re-author
unpushed commits — all of that is `account.new_device` (which `depends
!sign_in`), and the account screen's device/passkey lists and the sign-out
books prompt are `account.account_screen` / `account.sign_out`. This task is the
door; the rooms behind it are their own tasks.

## Why it needs to be done

Nothing hosted exists without it: "no book is reachable without an account … a
session and a membership" (DIRECTION §3.3 lines 175–182). Putting a book online,
accepting an invitation, seeing "mine on Estante", restoring a shelf on a new
device — every one begins at this surface. `account.first_run` already renders a
"Sign in" row whose `onSignIn` callback is, today, a no-op default
(SearchScreen.jsx:334; AppShell never passes it, so it is dropped at
AppShell.jsx:151); `account.new_device` cannot begin until a sign-in yields a
session and an account id to restore from. This task is the hinge both sides
wait on.

## Inputs / context

Governing design (normative — this refinement turns these into a work order, it
does not redesign them):

- **Workflow 13**,
  [`docs/workflows/13-new-device.md`](../../docs/workflows/13-new-device.md):
  §Signing in on another device, lines 11–27 — the three cases (same ecosystem
  → *Sign in*, confirm with face or finger; another ecosystem → the browser's
  own *use a phone or tablet* + QR, "Nothing in the app beyond standard
  WebAuthn", and "once in, the app offers to make a passkey on the laptop, so
  the next time is the first case"; neither → the **emailed link**, "also how an
  account is recovered when every device holding a passkey is lost"). §What
  comes down (29–55), §A device used before signing in (57–66), §The account
  screen (68–73), §Signing out (75–81) are explicitly **out of scope here** —
  they are `new_device` / `account_screen` / `sign_out`.
- **Workflow 7**,
  [`docs/workflows/07-add-a-book.md`](../../docs/workflows/07-add-a-book.md):
  §Signing in, lines 34–37 — "With a **passkey**, and an emailed link as the
  fallback for a device without one. No passwords, and no other identity
  providers in the first pass." §The book-management screen, lines 28–29 —
  "**Mine on Estante**: once signed in …" (a caller of this surface, owned by
  `books.add_by_link`).
- **DIRECTION** [`docs/DIRECTION.md`](../../docs/DIRECTION.md): §3.3 lines
  158–162 (one origin at `estantedecifras.app`, `.app` is HTTPS-only "which a
  PWA and passkeys need anyway", sign-in links mailed from it), 164–173
  (commits authored with `<user-id>@users.estantedecifras.app`; **before
  sign-in a device's commits carry a local id, which the account's address
  replaces in the saves not yet pushed when the user signs in** — the
  re-author, owned by `new_device`; "One origin … a session cookie that simply
  flows, and a passkey for the one domain"), 175–182 (no book without an
  account), 188–190 (emailed links back up passkeys and recover an account),
  206–211 ("The browser only ever holds its session with the service");
  §3.6 lines 288 (app and service share no code), 313–316 (`go-webauthn`
  server-side; a local mail catcher in dev), 356–362 (the API is a written
  contract; the sign-in endpoints), 400–403 (the dev server proxies the API so
  it is one origin there too); §3.7 lines 405–446 (React + React Aria; the
  Worker owns the data and IndexedDB — which sign-in does **not** touch; the
  view is the only React layer; offline-first — the app opens with no signal);
  §1 lines 29–31 (offline first — sign-in is the online exception; nothing
  *else* waits on it).
- **The API contract**, [`api/openapi.yaml`](../../api/openapi.yaml): the
  security scheme `sessionCookie` = cookie `estante_session` (700–707); global
  default `- sessionCookie: []` (55); `registerPasskeyBegin` 62–88,
  `registerPasskeyFinish` 90–115, `authenticatePasskeyBegin` 117–138,
  `authenticatePasskeyFinish` 140–162, `requestEmailLink` 164–185,
  `redeemEmailLink` 187–209; schemas `CredentialCreationOptions` /
  `CredentialRequestOptions` = `{ publicKey, state }` (870–901),
  `PasskeyRegisterBeginRequest` `{ label? }` (861), `PasskeyFinishRequest` `{
  state, credential, label? }` (909–925), `EmailLinkRequest` `{ email }`
  (927–935), `EmailLinkRedeemRequest` `{ token }` (937–944), `Account` `{ id }`
  (852–859). Validators: [`api/validate.js`](../../api/validate.js),
  [`api/validate.go`](../../api/validate.go).
- **The mockups**: [`docs/mockups/W13-new-device.dc.html`](../../docs/mockups/W13-new-device.dc.html)
  — the **Sign-in screen** (heading "Sign in"; body "Bring your books,
  instruments and preferences to this phone."; primary "Use a passkey";
  secondary "Email me a link"; note "No passkey here? The link signs you in on
  this phone, and recovers your account if every device with a passkey is
  lost."), the platform passkey prompt (browser-native, not ours to style), and
  the after-sign-in restore notice (that notice is `new_device`'s).
  [`docs/mockups/W01-first-run.dc.html`](../../docs/mockups/W01-first-run.dc.html)
  — the invited door's account-first card ("An account is a passkey — No
  password to choose. Your phone makes it, and it takes seconds.", buttons "Make
  an account" / "I have an account: sign in"); that door's dialogs are
  `books.add_by_link`, but its two-button account-or-sign-in choice is this
  surface's. [`docs/mockups/W07-add-a-book.dc.html`](../../docs/mockups/W07-add-a-book.dc.html)
  — "No passkey here? Email me a link". The visual language is
  [`docs/mockups/theme.css`](../../docs/mockups/theme.css) /
  [`docs/mockups/README.md`](../../docs/mockups/README.md) ("every status
  carries a word, never colour alone").

Code seams (cited file:line; the first-run changes have landed, so treat lines
as current at writing):

- `app/src/songs/FirstRun.jsx:122,148–151` — the "Sign in" row, `onSignIn`
  prop, `SignInIcon`, copy `firstRun.signIn`/`firstRun.signInMeta`.
- `app/src/songs/SearchScreen.jsx:334,544` — `onSignIn` defaulted to `() => {}`
  and forwarded to `FirstRun`; **not** currently supplied by `AppShell`.
- `app/src/shell/AppShell.jsx:44` (`LOCAL_IDENTITY = { id: 'local', name: 'Me'
  }`, "An account id replaces it once signed in — not an M2 concern"); 138/151
  (`destinationPanels` builds `<SearchScreen>` without `onSignIn`); 182–214 (the
  `useState` surface flags); 317–388 (the early-return surface renders). The new
  `signIn` surface and its `onSignIn`/`onSignedIn` wiring land here.
- `app/src/App.jsx:5,19–60` — the root; `isDev*` boot checks reading
  `location.hash`. The `/sign-in/<token>` **path** check and redeem-mode mount
  are a sibling of these.
- `app/src/worker/git-http.js:9–13,89–94` — every git request already sends
  `credentials: 'include'`, so the `estante_session` cookie this task obtains
  flows to the Worker's git requests with **no further plumbing**; the client
  "stores no credentials and never uses isomorphic-git's `onAuth`".
- `app/src/worker/author.js:31–55` — `authorFrom({ id, name })`; `id` is "either
  the account user-id or the device local id". The switch from the local id to
  the account id on sign-in is `new_device`'s (see Decisions 6, Deferred).
- `app/src/theme/ThemeRoot.jsx:14,67–69` — the app-wide `UNSAFE_PortalProvider`;
  new RAC overlays need no per-screen portal prop.
- `app/src/i18n/index.js` — `t(key, params)`; locales `app/src/i18n/locales/{en,
  pt-BR,es-419,it}.js`; the parity test `app/src/i18n/i18n.test.js` holds every
  non-`en` locale to `en`.
- `app/src/a11y/axe.js:11,21` — `axeOptions` (WCAG 2.1 AA tags) and
  `checkWcag21aa(container)` for the behavior axe check.
- `e2e/web/lib/devices.js:1–14` — `openDevice(browser)` (a second cookie jar);
  `e2e/web/lib/axe.js` (the axe fixture); `e2e/web/lib/offline.js`. There is no
  Mailpit reader in `e2e/web/lib/` yet — this task adds one (mirroring
  `e2e/api/lib/mail.js`).

## Constraints / requirements

- **The session is a cookie the app never reads.** `estante_session` is
  `HttpOnly` (set by `session.Issue`): the app cannot read it from JS. "Signed
  in" is therefore known only from an endpoint's response — the `Account { id }`
  returned by a `finish`/`redeem`, or a 200 vs 401 from a session-scoped call.
  The app stores **no** token (DIRECTION §3.3 lines 206–211); it keeps only an
  in-memory `Account` for the life of the surface and hands it to
  `onSignedIn`. Persisting/ re-detecting "signed in" across a cold reload is
  `new_device`'s probe, not this task.
- **WebAuthn is main-thread; so is this client.** `navigator.credentials` does
  not exist in a Worker. The auth REST client and the ceremonies run on the main
  thread — the app's first deliberate non-git network. This touches no
  IndexedDB, git, or index, so it does not cross the DIRECTION §3.7 Worker
  boundary (the Worker owns *data*; the cookie the service sets is a
  browser-level fact that reaches the Worker's git fetches automatically via
  `git-http.js`'s `credentials: 'include'`).
- **One origin, same-origin fetch, the cookie flows.** Every `/api/auth/*` call
  is a same-origin `fetch` with `credentials: 'same-origin'` (or default), JSON
  bodies, no CORS, no `Authorization` header (DIRECTION §3.3 lines 171–173;
  §3.6 lines 400–403 in dev). The client validates each request/response shape
  against the contract in tests (`api/validate.js`).
- **The service owns the WebAuthn shape; the app only (de)serialises.** `begin`
  returns `publicKey` as standard WebAuthn JSON; the browser needs `ArrayBuffer`
  fields. Conversion uses the native
  `PublicKeyCredential.parseCreationOptionsFromJSON` /
  `parseRequestOptionsFromJSON` and `credential.toJSON()` (Decision 2) — no new
  runtime dependency. The app never inspects or reshapes the credential beyond
  this (`additionalProperties: true` in the contract).
- **No account enumeration, nothing about who has an account.** `email/request`
  is always answered the same ("check your email"); the app shows that
  unconditionally and never reveals whether the address had an account
  (email_links.md; workflow 13). The email address is used only in that request
  body and is never put in a URL, a log, or an error.
- **No secrets, no song text in logs** (standing rule): the client logs nothing
  — no address, no token, no credential, no account id. The `state` handle and
  the redeem token pass through the app opaque and untouched.
- **Offline-first everywhere but here.** Opening and editing never wait on the
  network (DIRECTION §1 lines 29–31); sign-in is the one action that needs it.
  When a ceremony cannot reach the service (offline, or a 5xx), the surface says
  so in words and lets the user retry; the rest of the app keeps working
  offline. The empty-shelf "Sign in" row and the boot redeem both degrade to a
  clear message, never a hang.
- **Accessibility** (DIRECTION §3.7; standing rule): every interactive part is
  React Aria Components — the surface is keyboard-reachable and operable, focus
  is managed across its steps, the platform passkey prompt is the browser's own
  (outside our axe surface), status and errors are carried by words (never
  colour), and axe at WCAG 2.1 AA is clean on every step this task renders.
  Overlays inherit the themed portal from `ThemeRoot`.
- **The store contract** (as `first_run` followed): `store` is threaded by prop
  (`App → AppShell`), never React context; navigation is `AppShell` view-state,
  no router; the `signIn` surface opens via a callback and closes to where it
  was opened from. This task adds **no** `CommandKind`/`EventKind` to
  `app/src/worker/protocol.js` (no Worker message is needed for authentication
  itself).
- **Idempotent, cancellable steps.** A second "Use a passkey" while one is in
  flight does not start two ceremonies; cancelling the browser prompt (or a
  `NotAllowedError`) returns to the method step with no error shouted; a
  redeemed or expired token shows "this link has expired — request a new one"
  rather than a dead screen.

## Acceptance criteria

### Behavior delivered

1. **The surface opens from the seam.** `AppShell` passes `onSignIn` through
   `destinationPanels` to `SearchScreen`→`FirstRun`; pressing the empty shelf's
   "Sign in" row opens the `signIn` full-screen surface (the `openSong`/
   `openFile` pattern). The surface shows the workflow-13 sign-in screen:
   heading "Sign in", the body, a primary **Use a passkey** and a secondary
   **Email me a link**, and the no-passkey note. (Callers other than first-run
   — `books.add_by_link`'s invited door with its "Make an account" / "I have an
   account: sign in" — open the same surface with the create/ sign-in intent;
   those callers land with their tasks.)
2. **Sign in with a passkey.** "Use a passkey" runs `authenticate/begin` →
   `navigator.credentials.get({ publicKey })` → `authenticate/finish({ state,
   credential })`; a 200 yields `Account { id }`, the surface calls
   `onSignedIn(account)` and closes. A cancelled prompt returns to the method
   step; a 401 shows "That passkey didn't work — try again or use an emailed
   link."
3. **Make an account with a passkey.** In create intent, "Use a passkey" runs
   `register/begin({ label? })` → `navigator.credentials.create({ publicKey })`
   → `register/finish({ state, credential, label? })` with **no** session,
   creating the account and starting the session; `onSignedIn(account)` fires.
4. **Email me a link.** "Email me a link" shows an email field; submitting
   `email/request({ email })` always moves to a "Check your email" state
   (workflow 13; the response is 202 regardless), with a way back to try a
   passkey. The address is never echoed anywhere.
5. **Redeem on boot.** When the app loads at `/sign-in/<token>`, `App` opens the
   surface in redeem mode and runs `email/redeem({ token })`; 200 →
   `onSignedIn(account)` and the URL is cleaned to `/` (`history.replaceState`);
   401 → "This link has expired or has already been used — request a new one",
   offering the email step again.
6. **Offer a passkey on this device.** After a sign-in that did not use a
   passkey resident here — every email redeem, and a passkey assertion whose
   `authenticatorAttachment !== 'platform'` (the cross-device case) — the
   surface offers "Make signing in quicker — add a passkey to this device",
   which runs `register/begin`→`create()`→`register/finish` **with** the session
   now set; declining or succeeding both close to `onSignedIn`. (Same-ecosystem
   passkey sign-in, `authenticatorAttachment === 'platform'`, skips the offer.)
7. **The cookie just works for git.** After any success the `estante_session`
   cookie is set by the service; no app code reads or forwards it, and the
   Worker's existing `credentials: 'include'` carries it on the next git request
   (verified by the e2e journey, where `new_device`'s shelf fill is a separate
   spec).

### Tests, by level (the `.tji` `Tests:` clause — behavior; e2e-web — sharpened,
plus a unit level added for the pure helpers)

- **unit** (Vitest, colocated `*.test.js`) — `app/src/account/sign-in-route.test.js`:
  the pure parser that recognises a `/sign-in/<token>` path and extracts the
  token (and rejects everything else), so the boot route is pinned without a
  DOM. `app/src/account/offer-passkey.test.js`: the pure predicate deciding when
  to offer a passkey — true for an email redeem and for an assertion with
  `authenticatorAttachment` cross-platform/absent, false for a `platform`
  assertion (pins workflow 13 lines 23–24). (Added under the testing policy's
  "a level the task turns out to need"; the `webauthn-json` helper wraps native
  methods absent from jsdom and is covered at the behavior level with a stubbed
  `navigator.credentials`, not here.)
- **behavior** (React Testing Library + real React Aria + real i18n, a stubbed
  `navigator.credentials` and a loopback `fetch` double, `checkWcag21aa` from
  `app/src/a11y/axe.js`) — `app/src/account/SignIn.behavior.test.jsx`: the
  sign-in screen renders with its workflow-13 copy and the two methods; "Use a
  passkey" calls `authenticate/begin`, the stubbed `credentials.get`, then
  `authenticate/finish`, and fires `onSignedIn` with the returned `Account`;
  create intent drives the `register/*` pair; "Email me a link" posts
  `email/request` and shows "Check your email" without revealing account
  existence; a redeem-mode mount posts `email/redeem` and then shows the
  offer-a-passkey step; the offer step registers a passkey; a cancelled prompt
  and a 401 each show the worded error and a retry; a full keyboard path through
  the surface; **axe** clean on each step (pins workflow 13 §Signing in on
  another device, workflow 7 §Signing in, mockup W13; the request/response
  shapes against `api/validate.js`).
- **e2e-web** (Playwright against the compose stack — the app served by the
  service on its one origin — on the phone, tablet and computer projects, with
  `@axe-core/playwright` at WCAG 2.1 AA; a CDP **virtual authenticator** and the
  **Mailpit** catcher) — `e2e/web/tests/account-sign-in.spec.js`: (a) **a
  passkey with a virtual authenticator** — from the empty shelf, make an account
  with a passkey; `register/finish` creates the account and the surface reports
  signed-in, and the `estante_session` cookie is present on the context; (b)
  **an emailed link read from the mail catcher** — request a link for an address
  that has an account, read the `/sign-in/<token>` URL from Mailpit, open it in
  the same context, and be signed in after `redeem`; (c) **a passkey offered on
  a new device** — after the emailed-link sign-in the offer appears and
  registering a passkey with the virtual authenticator succeeds; axe on the
  sign-in screen, the email/check-your-email step and the offer step, on all
  three viewports (pins the `.tji` e2e clause, workflow 13 lines 11–27). The new
  Mailpit reader lands in `e2e/web/lib/` (mirroring `e2e/api/lib/mail.js`); the
  journey reuses `e2e/web/lib/devices.js` and `axe.js`, never a parallel
  harness.

All named tests land in this task and run (not skipped) in `scripts/gate`. The
service side is already covered by `e2e/api/{passkeys,sessions,email-links,
mail}.test.js` and is not duplicated here (the `.tji` names no e2e-api level for
this app task).

### Deferred work / graph notes

No net-new WBS leaf. The rooms behind this door are existing leaves that
`depend !sign_in` (or a sibling) and carry their own tests:

- **`account.new_device`** — the home book first, the shelf filling, the
  "device used before signing in" merge/keep-both, and the **re-author of
  unpushed commits** from the device local id to the account address (DIRECTION
  §3.3 lines 168–171; `author.js`). `onSignedIn(account)` is the seam it
  consumes; persisting/re-detecting signed-in across a cold reload is also its
  probe.
- **`account.account_screen`** — the header **Account** button (shared shell
  chrome, drawn in W01/W13, not built here), the signed-in-devices and passkeys
  lists (`GET /api/account/sessions`, `GET /api/account/passkeys` and their
  `DELETE`s), language and theme.
- **`account.sign_out`** — `POST /api/auth/signout` and the remove-or-keep-the-
  books prompt.
- **`books.add_by_link`** — the invited door, its account-first prompt and the
  dead/full-link dialogs; it opens this surface in create/sign-in intent.

No test is deferred; no "add tests for X" leaf.

## Decisions

1. **A new `app/src/account/` area, with a main-thread auth client and surface,
   not a Worker command family.** The surface is `app/src/account/SignIn.jsx`
   (RAC throughout, small presentational children), mounted as a full-screen
   `AppShell` surface via the existing `openSong`/`openFile` `useState` +
   early-return pattern; the client is a plain `fetch` module over the
   `/api/auth/*` + `/api/account/passkeys` endpoints. *Why:* `navigator.
   credentials` is unavailable in a Worker, so the ceremony must run on the main
   thread; and since the `estante_session` cookie the service sets reaches the
   Worker's git requests automatically (`git-http.js` already sends
   `credentials: 'include'`), routing auth through the Worker would buy nothing
   and would push a DOM-only API across the port. Auth touches no IndexedDB/git/
   index, so it respects the §3.7 Worker-owns-the-data boundary. *Rejected:* a
   Worker `CommandKind`/`EventKind` family for sign-in (can't call WebAuthn
   there; adds protocol surface for nothing); a context-provided auth singleton
   (the project threads `store`/callbacks by prop, never context).

2. **Native WebAuthn JSON (de)serialisation, no new dependency.** A thin
   `app/src/account/webauthn-json.js` wraps
   `PublicKeyCredential.parseCreationOptionsFromJSON` /
   `parseRequestOptionsFromJSON` and `credential.toJSON()`. *Why:* the service
   owns the WebAuthn shape (`go-webauthn`) and returns/accepts standard JSON; the
   only app-side need is the base64url↔ArrayBuffer conversion, which these
   native methods do. They are available in every passkey-capable browser the
   `.app` (HTTPS-only) target supports, and in the Chromium the e2e virtual
   authenticator runs under. Keeping it a one-module seam means a polyfill could
   be dropped in later without touching the client. Avoiding a dependency sidesteps
   the lockfile/network friction a new `app/` dep carries
   ([[adding-npm-deps-needs-lockfile-and-network]]) and matches `first_run`'s
   "prefer the built-in" (`import.meta.glob`) stance. *Rejected:* a library
   (`@github/webauthn-json`, `@simplewebauthn/browser`) — a new runtime
   dependency (a design-level addition) for conversion the platform now does;
   hand-rolling base64url↔ArrayBuffer (re-implementing a standard the browser
   already exposes).

3. **The sign-in surface is one multi-step surface, not several screens or a
   modal.** `SignIn.jsx` holds internal step state (method → email form → check
   your email → offer a passkey; plus a redeem/busy/error step), opened full-
   screen. *Why:* W13 draws sign-in as a screen with the platform prompt layered
   by the browser; a single surface keeps focus management and the axe surface in
   one place and matches how `AppShell` renders `openSong`/`arranging` et al.
   *Rejected:* a stack of routed screens (there is no router; navigation is
   view-state); a RAC `Modal` over the shelf (the flow has several steps and an
   emailed-link boot entry with no shelf behind it — a surface reads better and
   avoids a modal that must aria-hide a shell that may not be meaningful yet,
   cf. [[rac-modal-aria-hides-shell-chrome]]).

4. **The emailed link is a path route (`/sign-in/<token>`) handled at boot in
   `App.jsx`, cleaned with `history.replaceState`.** *Why:* the service mails
   `${ESTANTE_PUBLIC_BASE_URL}/sign-in/<token>` (email_links.md), a path, not a
   hash; `App.jsx` already branches on `location` at boot for the `#dev/*`
   mounts, so a `location.pathname` check beside them is the smallest change.
   Cleaning the URL stops the single-use token lingering in history or a share.
   *Rejected:* a hash route (the service controls the mailed URL and uses a
   path); handling redeem inside the Worker (WebAuthn aside, the token arrives on
   the main thread via the URL; the Worker never sees navigation).

5. **"Offer a passkey here" keys off how the sign-in happened, via
   `authenticatorAttachment`.** The offer shows after every email redeem and
   after a passkey assertion whose `authenticatorAttachment` is
   `cross-platform` or absent; it is skipped when the assertion is `platform`
   (the passkey already lives here). *Why:* workflow 13 wants the offer after the
   cross-device and email cases (so "next time is the first case") but not after
   a same-ecosystem sign-in; `authenticatorAttachment` on the
   `PublicKeyCredential` is the standard, test-observable signal that
   distinguishes them, with no server round-trip. *Rejected:* always offering
   (nags the same-ecosystem user who already has a synced passkey); never
   offering after passkey sign-in (misses W13's explicit cross-device offer);
   asking the service which case it was (the service only sees a standard
   assertion — passkeys.md).

6. **This task does not switch the commit author or persist signed-in-ness; it
   hands off via `onSignedIn(account)`.** The surface keeps the `Account` in
   memory for its lifetime and passes it out; it leaves `AppShell`'s
   `LOCAL_IDENTITY` (AppShell.jsx:44) and `author.js` untouched. *Why:* the
   re-author of unpushed commits "when the user signs in" (DIRECTION §3.3 lines
   168–171) and the cold-reload re-detection belong with the reconciliation
   `new_device` already owns ("a device used before signing in"), which `depends
   !sign_in`; splitting them keeps this task to authentication and avoids two
   tasks writing the identity switch. *Rejected:* flipping the Worker's author id
   here (duplicates the identity/merge logic `new_device` must own anyway; would
   half-do the §3.3 re-author without the unpushed-save rewrite); storing the
   account id in `localStorage` (the session cookie is the source of truth; the
   app holds no token — §3.3 lines 206–211).

7. **No design delta.** Every choice realises what workflows 7 and 13, DIRECTION
   §3.3/§3.6/§3.7 and the API contract already decide; nothing deviates from a
   governing document, changes the format, or adds a runtime dependency (Decision
   2). So no `docs/` or `spec/` edit rides with this task. The sign-in copy
   strings this task writes into i18n are realisations of the mockup's wording,
   not new product decisions.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- New area `app/src/account/` — `SignIn.jsx`, `auth-client.js`, `webauthn-json.js`, `sign-in-route.js`, `offer-passkey.js`, `account.css` — the sign-in surface and main-thread auth client over `/api/auth/*`.
- `app/src/shell/AppShell.jsx` — new `signIn` full-screen surface state and `onSignIn` threaded through `destinationPanels` to `SearchScreen`.
- `app/src/App.jsx` — boot `/sign-in/<token>` redeem route with `history.replaceState`.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — `signIn` i18n block in all four locales.
- `e2e/web/lib/mail.js` — Mailpit reader for the e2e-web harness (mirroring `e2e/api/lib/mail.js`).
- `e2e/web/lib/db.js` — Postgres email-account seeder (pre-creates accounts the emailed-link journeys need).
- `e2e/web/lib/env.js` — lazy `mailUrl()` and `127.0.0.1`→`localhost` host normalization (WebAuthn requires a named-host origin).
- `e2e/api/lib/env.js` — same host normalization, keeping the software-authenticator origin in lockstep.
- `compose.yaml` — `ESTANTE_PUBLIC_BASE_URL` and `ESTANTE_WEBAUTHN_RP_ID` moved to `localhost`.
- `e2e/web/package.json` + `package-lock.json` — `postgres` dep added for the account seeder.
- Tests: unit `sign-in-route.test.js` (8 tests), `offer-passkey.test.js` (6 tests); behavior `SignIn.behavior.test.jsx` (12 tests); e2e-web `account-sign-in.spec.js` (2 tests × 3 viewports, all passing).
