# account.account_screen — The account screen

## TaskJuggler entry

[`tasks/70-account.tji`](../../70-account.tji), `task account.account_screen`
("The account screen"). `depends !sign_in, design.theme_picker`.

## Effort estimate

2d (`allocate team`), as the `.tji` fixes it. The weight is one new full-screen
surface with three regions and a new header affordance, over machinery that
already exists: the `app/src/account/` area and its surface-mount pattern
(`account.sign_in`), the main-thread REST client it only needs four more methods
on, the home-book preference write/read path (`storage.preferences_surface`,
`storage.home_book`), the theme/language consumers (`ThemeRoot`, `LocaleRoot`)
that re-apply off the `preferences` slice with no new plumbing, the roster +
per-row-confirm + `RadioGroup` template (`books.share`'s `SharingScreen`), the
four locales, and the virtual-authenticator / Mailpit / Postgres e2e-web harness.
The genuinely new code is a header entry, an `AccountScreen` component with its
children, two Worker preference-write commands, four auth-client methods, and the
copy in four locales — which keeps it to two days.

## Repository

**estante-de-cifras** only. App work: the `.tji` note does not start with
`cifra.md:`. Directories touched:

- `app/src/account/` — the new screen `AccountScreen.jsx` and its presentational
  children (preferences pickers, devices roster, passkeys roster), beside the
  existing `SignIn.jsx` / `InvitedScreen.jsx`; four new methods on
  `auth-client.js`; styles in `account.css`.
- `app/src/shell/AppShell.jsx` — a new full-screen surface state `account`
  (the `openSong`/`signIn` `useState` + early-return pattern) and the **header
  account affordance** that opens it (it does not exist yet — `account.sign_in`
  left it to this task).
- `app/src/worker/protocol.js` + `app/src/worker/logic.js` — two new
  `CommandKind`s (`SET_THEME`, `SET_LANGUAGE`) and their handlers, following the
  `SET_IDENTITY_NAME` preference-write template.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the account-screen copy in all
  four locales (held to `en` by `app/src/i18n/i18n.test.js`).
- `e2e/web/tests/` — the account-screen journeys, reusing `e2e/web/lib/`
  (`axe.js`, `devices.js`, `mail.js`, `db.js`) and the virtual-authenticator /
  `hasSessionCookie` helpers established by `account-sign-in.spec.js`; no new
  harness.

The only contract with the service is `api/openapi.yaml`; no service or `cifra.md`
work lands here (DIRECTION §3.6 line 289, "The app and the service share no
code").

## Inherited dependencies

Both settled:

- **`account.sign_in`** (Done 2026-10-07,
  [`tasks/refinements/account/sign_in.md`](sign_in.md)) — the `app/src/account/`
  area, the `createAuthClient({ fetch })` main-thread REST client
  (`auth-client.js`) with `AuthError { kind: 'unauthorized' | 'network', status }`,
  the authed passkey-register flow (`registerBegin`/`registerFinish` +
  `webauthn-json.js`), the `AppShell` full-screen-surface mount pattern, the
  session cookie `estante_session` (HttpOnly — the app never reads it; "signed
  in" is known only from a response), and the e2e-web harness (virtual
  authenticator via CDP, Mailpit reader `e2e/web/lib/mail.js`, Postgres seeder
  `e2e/web/lib/db.js`, `hasSessionCookie`). The client currently has **no**
  session/passkey-management methods; this task adds them.
- **`design.theme_picker`** (Done 2026-10-13,
  [`tasks/refinements/design/theme_picker.md`](../design/theme_picker.md)) — the
  Preferences section decided and drawn: four theme choices (Automatic default,
  Estante, Caderno, Palco), a language picker beside it, present and writable
  before sign-in, the chosen one marked by a **word** and never colour alone,
  each a labelled `RadioGroup`, stored as a `{ value, at }` register in the home
  book's `preferences.json`. The deliverable is
  [`docs/mockups/Theme-picker.dc.html`](../../docs/mockups/Theme-picker.dc.html).

Settled context relied on but not a direct predecessor, all `complete 100`:
`storage.home_book` and `storage.preferences_surface` (the home book,
`preferences.json`, and the `PREFERENCES` surface that feeds the `preferences`
slice `ThemeRoot`/`LocaleRoot` read); `shell.tokens` (`ThemeRoot`, `resolve.js`)
and `shell.i18n` (`LocaleRoot`, `i18n/index.js`, the four `LOCALES`);
`books.share` (`SharingScreen` — the roster + per-row-confirm + `RadioGroup`
template, and `sharing-client.js` — the exact shape the new auth-client methods
take); `foundation.e2e_web` (`e2e/web/`). The service endpoints this task
consumes are already built and e2e-api-covered (`service.sessions`,
`service.passkeys`).

## What this task is

The **account screen**: one full-screen surface, reached from a new header
affordance, that workflow 13 §The account screen gives three regions —

1. **Preferences** — a **theme** picker (Automatic, Estante, Caderno, Palco) and
   a **language** picker (the four `LOCALES`), **present and writable whether or
   not the user is signed in**, since preferences live in the local home book
   from the first minute. Choosing one writes a `{ value, at }` register to the
   home book's `preferences.json` through the Worker (offline, auto-committed,
   never pushed) and the existing `ThemeRoot`/`LocaleRoot` re-apply it live off
   the `preferences` slice.
2. **Signed-in devices** (additive, when signed in) — the account's sessions,
   each with when it was last used, the current one marked, and **sign out** for
   any *other* device (revokes its session; it stops at its next request).
3. **Passkeys** (additive, when signed in) — the account's passkeys, listed and
   removable, with **add a passkey to this device** reusing the authed register
   flow.

When not signed in, the signed-in regions are replaced by a "Not signed in" card
whose **Use a passkey** / **Email me a link** open the existing `SignIn` surface.

Out of scope, by the `.tji` graph: **signing out *this* device** — the
remove-this-account's-books-or-keep-them prompt with unsaved/unpushed counted
(`POST /api/auth/signout`) — is `account.sign_out` (which `depends
!account_screen`); this task renders the current-device sign-out control but
delegates its action to an `onSignOut` seam `sign_out` fills (mirroring how
`first_run` shipped the `onSignIn` seam `sign_in` filled). Filling the shelf, the
home book coming down, and the commit-author switch are `account.new_device`.

## Why it needs to be done

Workflow 13 anchors the theme picker, the language picker, the devices list and
the passkeys list to this one screen; DIRECTION §6 lines 543–548 explicitly place
the Preferences section here, and the API contract (§3.6 lines 364–366) promises
"the signed-in devices and the passkeys, listed and removed." `design.theme_picker`
drew it and left "picker behavior/e2e-web tests land with
`account.account_screen`"; the backing REST endpoints and the preference
read/apply path exist but nothing consumes them. This task is where the drawn
screen becomes real and `account.sign_out` (its current-device prompt depends on
this screen existing) can begin.

## Inputs / context

Governing design (normative — this refinement turns it into a work order):

- **Workflow 13**,
  [`docs/workflows/13-new-device.md`](../../docs/workflows/13-new-device.md):
  §The account screen, lines 68–81 — **Preferences** "theme and language
  (workflow 1) … Present and writable whether or not the user is signed in, since
  preferences live in the local home book from the first minute; the signed-in
  sections below are additive. Theme offers Automatic (the default, following the
  device's light or dark mode), Estante, Caderno and Palco, the chosen one marked
  by a word, never colour alone" (70–76); **Signed-in devices** "each with when
  it was last used, and sign out for any of them. A lost phone is signed out from
  the laptop, and its session stops working at its next request" (77–79);
  **Passkeys** "listed, and removable" (80). §Signing out, lines 83–88 (the
  current-device prompt — `account.sign_out`'s, cited for the boundary).
- **DIRECTION** [`docs/DIRECTION.md`](../../docs/DIRECTION.md): §3.2 lines
  138–144 ("the theme … lives in a **home book** … committed automatically —
  explicit save is for what the user authors, not for preferences") and 146–151
  (the home book is a settings repository, JSON merging key by key, later change
  winning); §3.6 lines 364–366 (the API: "the signed-in devices and the
  passkeys, listed and removed (workflow 13)") and 289 (app and service share no
  code); §3.7 lines 422–424 ("One owner for the data: a Web Worker … The main
  thread never touches IndexedDB"), 425–429 (the store fed by Worker messages,
  components read slices through `useSyncExternalStore`), 430–432 ("the view is
  the only layer that" knows React), 411–420 (React Aria Components; formatting by
  locale for the four languages; the visual language `docs/mockups/theme.css`);
  §3.3 lines 206–207 ("The browser only ever holds its session with the
  service"); §6 lines 543–548 (the Preferences section of the account screen,
  reached from the header, present before sign-in, four theme choices beside the
  language).
- **The home-book format**,
  [`docs/home-book-format.md`](../../docs/home-book-format.md): §4.1 — the
  `theme` register, values `"estante" | "caderno" | "palco"` or absent (⇒
  automatic, following the device's light/dark mode) (lines ~195, 202–205); the
  `language` register, a language tag, absent until chosen (⇒ the browser's)
  (lines ~196, 206); each a `{ value, at }` envelope merged key by key, later
  change winning.
- **The mockups**:
  [`docs/mockups/Theme-picker.dc.html`](../../docs/mockups/Theme-picker.dc.html)
  — the Preferences section (Theme + Language `role="radiogroup"` with
  `aria-label`, each option a row with a live preview swatch, a text name, a meta
  description, and a `Selected` badge + check on the chosen one; the "Automatic"
  explanation copy; the not-signed-in card "These preferences are saved on this
  device now. Sign in to keep your books and carry theme and language to your
  other devices." with "Use a passkey" / "Email me a link"); the signed-in
  identity row, the devices list ("Chrome on Android · in use now" / "Edge · last
  used 10 minutes ago" + "Sign out"), the passkeys list (name + meta + quiet
  "Remove"); and the responsive layout (phone: stacked Preferences → devices;
  tablet: Preferences beside devices + passkeys; desktop: a side pane with the
  identity and "Sign out of this computer", a main pane with Preferences above
  devices and passkeys).
  [`docs/mockups/W13-new-device.dc.html`](../../docs/mockups/W13-new-device.dc.html)
  — the original account surface (devices + passkeys) and the current-device
  sign-out dialog (`account.sign_out`'s).

Code seams (cited file:line; all have landed, lines current at writing):

- `app/src/account/auth-client.js` — `createAuthClient({ fetch })` with
  `registerBegin/registerFinish`, `authenticateBegin/authenticateFinish`,
  `requestEmailLink`, `redeemEmailLink`; internals `postJson(fetch, path, body)`
  (POST, `content-type: application/json`, `credentials: 'same-origin'`) and
  `accountOf(response)` (200→json, 401→`AuthError('unauthorized')`, else
  `AuthError('network')`). **No** session/passkey-management methods yet.
- `app/src/account/webauthn-json.js` — `createCredential` / `getCredential` /
  `isCancellation` over `navigator.credentials` (reused for "add a passkey").
- `app/src/account/SignIn.jsx` — the surface "Use a passkey" / "Email me a link"
  the not-signed-in card routes to; `addPasskeyHere()` is the authed-register
  shape "add a passkey" reuses.
- `app/src/shell/AppShell.jsx:223` (the `signIn` `useState`), `:453–475` (its
  early-return mount), `:145` (`destinationPanels(...)`), `:712`/`:732` (the
  `onSignIn` seam → `setSignIn(...)`), `:51` (`LOCAL_IDENTITY = { id: 'local',
  name: 'Me' }`, the device commit identity until the author switch
  `new_device` owns). No header account affordance exists yet.
- `app/src/theme/ThemeRoot.jsx:60–66` — reads `useSlice(store, 'preferences')`,
  `resolveTheme(preferences?.theme?.value, prefersDark)`, applies
  `est theme-<applied> density-<density>`; `app/src/theme/resolve.js:14`
  (`THEMES = ['estante','caderno','palco']`), `:18`
  (`CHOSEN_THEMES = ['automatic', ...THEMES]`), `:30` (`resolveTheme`), `:37`
  (`themeClasses`).
- `app/src/i18n/LocaleRoot.jsx:34–36` — reads `preferences?.language?.value`,
  `resolveLocale(...)`, `setLocale(...)`, remounts the subtree on change;
  `app/src/i18n/index.js:26–34` (`LOCALES` = `en`, `pt-BR`, `es-419`, `it`, each
  `{ id, name, messages }`, `name` written in its own language — the picker's
  option set), `:64` (`resolveLocale`), `:68` (`setLocale`).
- `app/src/worker/logic.js:1009–1033` — `SET_IDENTITY_NAME`, the preference-write
  template: `ensureHomeBook()` → `home.ensureLocal({ author })` →
  `home.set({ bookId: HOME_BOOK_ID, file: 'preferences.json', changes: [{ path:
  ['<key>'], value }], author })` → `surfaceHomeBookPreferences()` →
  `ensureFs().flush()` (so an immediate reload reads it). Offline, auto-committed,
  never pushed. `app/src/worker/protocol.js:214` (`SET_IDENTITY_NAME` in
  `CommandKind`), `:307` (`EventKind.PREFERENCES`); `app/src/worker/preferences.js:31`
  (`surfacePreferences`); `app/src/worker/reducer.js:120–125` (folds `PREFERENCES`
  into the `preferences` slice).
- `app/src/books/SharingScreen.jsx:96–136` (`RemoveMemberDialog` — the per-row
  destructive-action confirm Dialog), `:256–281` (`RadioGroup`/`Radio`, `Switch`),
  and `app/src/books/sharing-client.js` (`createSharingClient`, `SharingError`,
  `listMembers`/`removeMember`/… — the exact shape the new session/passkey client
  methods take). Status carried by a word + `role="status"`/`role="alert"`.
- `app/src/a11y/axe.js` — `checkWcag21aa(container)`, `axeOptions`
  (WCAG 2.1 AA).
- `app/src/worker/preferences-surface.behavior.test.jsx` — the model for driving
  a preference through the real command/event path in a worker-backed behavior
  test. Test wiring: `app/src/test/loopback.js` (`createLoopbackEndpoint`),
  `setup.js`, `web-locks.js`, `git-http-remote.js`; `app/src/worker/useStore.js`
  (`useSlice`).
- `e2e/web/lib/`: `axe.js` (`test` fixture + `checkA11y`), `devices.js`
  (`openDevice(browser)` — a second cookie jar = a second device), `mail.js`
  (`waitForMessageTo`, `extractSignInLink`), `db.js` (`seedAccount(email)`);
  `e2e/web/tests/account-sign-in.spec.js` (`enableVirtualAuthenticator(page)`,
  `hasSessionCookie(page)`, `openSignIn(page)`).

The API contract, [`api/openapi.yaml`](../../api/openapi.yaml) — all `[Sign-in]`,
all require `sessionCookie` (`estante_session`):

- `listSessions` `GET /api/account/sessions` → 200 `SessionList` / 401
  (222–235). `SessionList` `{ sessions: Session[] }` (978); `Session`
  `{ id, current: boolean, lastUsedAt: date-time, device?: string }` (961–976) —
  `current: true` marks the requesting session ("this device").
- `revokeSession` `DELETE /api/account/sessions/{sessionId}` → 204 / 401 / 404
  (237–253), lazy enforcement (the revoked session stops at its next request).
- `listPasskeys` `GET /api/account/passkeys` → 200 `PasskeyList` / 401
  (255–268). `PasskeyList` `{ passkeys: Passkey[] }` (1004); `Passkey`
  `{ id, label?, createdAt: date-time, lastUsedAt: date-time|null }` (988–1002).
- `removePasskey` `DELETE /api/account/passkeys/{passkeyId}` → 204 / 401 / 404
  (270–283).
- "Add a passkey" reuses `registerPasskeyBegin`/`registerPasskeyFinish` (62–115)
  via the existing `registerBegin`/`registerFinish`. `signOut` `POST
  /api/auth/signout` (211–220) is **not** consumed here — it is `account.sign_out`'s.

## Constraints / requirements

- **Preferences work before and without an account.** The theme and language
  pickers render and write whenever the screen is open; they do not gate on a
  session (workflow 13 lines 70–74; DIRECTION §6 line 546). The signed-in regions
  are additive: present only when a session exists, absent (replaced by the "Not
  signed in" card) otherwise.
- **The view never touches IndexedDB; the Worker owns the write.** A theme or
  language choice is a Worker command (`SET_THEME` / `SET_LANGUAGE`) that writes
  the register through `home.set` and re-surfaces `PREFERENCES`; the view only
  dispatches and reads the resulting `preferences` slice (DIRECTION §3.7 lines
  422–429). The choice is **auto-committed and never pushed** — "explicit save is
  for what the user authors, not for preferences" (DIRECTION §3.2 line 142) — and
  flushed at the handler tail so an immediate reload reads it (the
  `SET_IDENTITY_NAME` pattern). The chosen value follows the user to other
  devices through home-book sync; `automatic` re-reads each device's own mode and
  is the absent register, never written as a value.
- **The session is a cookie the app never reads.** "Signed in" is known only from
  a response: `listSessions`/`listPasskeys` return 200 under a session and 401
  without one (DIRECTION §3.3 lines 206–207; `account.sign_in` Decision 6). The
  app stores no token; it does not persist signed-in-ness across a cold reload
  (that re-detection is `account.new_device`'s) — the account screen reads
  "signed in" afresh each time it opens, from a 200 vs 401.
- **One origin, same-origin fetch, the cookie flows.** The new client methods are
  same-origin `fetch` with `credentials: 'same-origin'`, no CORS, no
  `Authorization` header (DIRECTION §3.3; `sign_in` Decision 1); a `GET` maps
  200→json / 401→`AuthError('unauthorized')`, a `DELETE` maps 204→ok / 404→a
  typed not-found / 401→`AuthError('unauthorized')`.
- **Revoking is another device; signing out this device is not this task.** The
  per-device "Sign out" action calls `revokeSession` **only for a session whose
  `current` is false**; the current session's sign-out control (the row and the
  "Sign out of this <device>" button) is rendered here but delegates to an
  `onSignOut` seam `account.sign_out` fills with the remove/keep-books prompt and
  `POST /api/auth/signout`.
- **Accessibility** (DIRECTION §3.7; standing rule; `design.theme_picker`): every
  interactive part is React Aria Components — the two pickers are labelled
  `RadioGroup`s, the selected option marked by a **word** ("Selected") and an
  indicator, each option named in text even where a swatch previews it; the
  rosters are keyboard-reachable with per-row actions; a per-device sign-out and a
  passkey removal confirm through a RAC Dialog (the `SharingScreen` pattern);
  status and errors carried by words (`role="status"`/`role="alert"`), never
  colour; axe at WCAG 2.1 AA clean on every state. Overlays inherit the themed
  portal from `ThemeRoot`.
- **No secrets, no song text, no identifiers in logs** (standing rule): the new
  client logs nothing — no session id, passkey id, device string, email or
  account id; the preference writers log neither the value nor the register.
- **No email, no name the contract does not give.** `Account` is `{ id }` and no
  endpoint returns the account's email; the identity indication shows the
  author's display name (`preferences.authorName`) when the home book carries one
  and a neutral "signed in" status otherwise, and shows no email (Decision 5).
- **The store contract** (as the area follows): `store` is threaded by prop,
  never context; navigation is `AppShell` view-state, no router; the surface opens
  via the header affordance and closes to where it was opened from. The i18n
  parity test (`i18n.test.js`) holds every non-`en` locale to `en`, so every new
  key lands in all four.

## Acceptance criteria

### Behavior delivered

1. **The screen opens from a header affordance.** `AppShell` gains a header
   account control (present signed-in or not — DIRECTION §6 line 545) that opens
   the `account` full-screen surface (the `openSong`/`signIn` pattern), closing
   back to where it was opened from.
2. **Preferences, before sign-in.** The surface shows a **Theme** `RadioGroup`
   with Automatic (default, the absent register), Estante, Caderno and Palco —
   each named in text with a preview swatch — and a **Language** `RadioGroup` of
   the four `LOCALES`, each name in its own language. The chosen option carries
   the word "Selected" and an indicator (never colour alone). Choosing a theme
   dispatches `SET_THEME`; choosing a language dispatches `SET_LANGUAGE`; both
   write the `{ value, at }` register and the applied theme / language change
   live via `ThemeRoot` / `LocaleRoot`.
3. **The preference persists across a reload, offline, unpushed.** `SET_THEME`
   and `SET_LANGUAGE` write `preferences.json` through `home.set`, auto-commit to
   the local home book, re-surface `PREFERENCES`, and flush; a reload re-surfaces
   the committed register, so the choice survives. Nothing is pushed and no
   network is touched.
4. **Not signed in.** With no session, the signed-in regions are replaced by the
   "Not signed in" card whose "Use a passkey" / "Email me a link" open the
   `SignIn` surface.
5. **Signed-in devices.** Under a session, `listSessions` fills a roster: the
   `current: true` session marked ("in use now"), the others with their
   `lastUsedAt` and `device`. "Sign out" on a non-current device confirms, calls
   `revokeSession`, and removes the row; a 404 (already gone) reconciles the row
   away; the current-device sign-out control invokes the `onSignOut` seam.
6. **Passkeys.** `listPasskeys` fills a roster (label, `createdAt`, `lastUsedAt`);
   "Remove" confirms and calls `removePasskey`; "Add a passkey to this device"
   runs the authed `registerBegin` → `createCredential` → `registerFinish` and
   re-lists.
7. **Errors are worded and retryable.** A failed list/revoke/remove shows a
   worded `role="alert"` message with a retry, never colour alone; the rest of the
   app keeps working.

### Tests, by level

The `.tji` `Tests:` clause names **behavior** and **e2e-web**. A screen gets
behavior + e2e-web (the policy's proportion); no pure-module **unit** level is
introduced because the option sets and resolvers are already unit-pinned
(`app/src/theme/resolve.test.js`, `app/src/i18n/i18n.test.js`) and the new logic
is a Worker command and a REST client, both pinned at the behavior level below.

- **behavior** (Vitest):
  - `app/src/account/AccountScreen.behavior.test.jsx` (React Testing Library +
    real React Aria + real i18n; a worker-backed loopback store
    (`createLoopbackEndpoint`) so a theme/language choice round-trips through the
    real command path and `ThemeRoot`/`LocaleRoot` re-apply; an injected
    auth-client double routing `GET/DELETE /api/account/{sessions,passkeys}` and
    the register pair, with a stubbed `navigator.credentials`; `checkWcag21aa`) —
    Preferences render before sign-in with the four themes and four languages and
    the "Selected" word; choosing a theme and a language updates the applied theme
    and the on-screen language; the not-signed-in card opens `SignIn`; under a
    session the devices roster marks the current one and "Sign out" on another
    calls `revokeSession` and drops the row; the passkeys roster lists, removes,
    and adds a passkey; a failed call shows the worded error and retries; a full
    keyboard path; **axe** clean on the not-signed-in and signed-in states. Pins
    workflow 13 §The account screen (lines 68–81), `design.theme_picker`, mockup
    `Theme-picker.dc.html`; the request/response shapes checked structurally
    against `api/openapi.yaml` (not by importing `api/validate.js`, which breaks
    under Vite — [[api-validate-js-breaks-under-vite]]).
  - `app/src/worker/preferences-theme-language.behavior.test.js` (worker-backed:
    loopback + fake-indexeddb + a local git remote, the
    `preferences-surface.behavior.test.jsx` rig) — `SET_THEME` writes the `theme`
    register to `preferences.json` and re-surfaces `PREFERENCES`; `SET_LANGUAGE`
    writes `language`; both auto-commit to the home book and **do not push**; a
    re-surface after a simulated reload still carries them; an invalid value is
    rejected. Pins home-book-format §4.1 and DIRECTION §3.2 (preferences
    auto-committed, never pushed).
- **e2e-web** (`e2e/web/tests/account-screen.spec.js`, Playwright against the
  compose stack on the phone, tablet and computer projects, `@axe-core/playwright`
  at WCAG 2.1 AA, reusing `lib/axe.js`, `lib/devices.js`, `lib/mail.js`,
  `lib/db.js` and `enableVirtualAuthenticator`/`hasSessionCookie` from
  `account-sign-in.spec.js`):
  - **Theme and language kept across a reload** (no sign-in) — open the account
    screen from the header, choose Palco and Português (Brasil), reload; the app
    is in Palco (`est theme-palco` on the root) and Portuguese (`<html lang="pt-BR">`
    and a translated string); axe on the account screen. On all three viewports
    (pins the `.tji` e2e clause, workflow 13 lines 70–76).
  - **Another device signed out from here** — `seedAccount(email)`; context A
    signs in via an emailed link (request → read `/sign-in/<token>` from Mailpit →
    redeem); context B (`openDevice`) signs in via a second emailed link to the
    same account; A's account screen lists both devices; "Sign out" on the B row
    calls `revokeSession`; B's next request 401s (its session stopped). axe (pins
    workflow 13 lines 77–79).
  - **Passkeys listed, added and removed** — create an account with a passkey via
    the virtual authenticator; the account screen lists it; "Add a passkey"
    registers a second with the virtual authenticator; "Remove" takes one away and
    the list reflects it. axe (pins workflow 13 line 80).

All named tests land in this task and run (not skipped) in `scripts/gate`. The
service side is already covered by `e2e/api/{sessions,passkeys}.test.js` and is
not duplicated here (the `.tji` names no e2e-api level for this app task).

### Deferred work / graph notes

No net-new WBS leaf. The current-device sign-out control's action is filled by
the existing **`account.sign_out`** (`depends !account_screen`): `POST
/api/auth/signout` and the remove-this-account's-books-or-keep-them prompt with
unsaved/unpushed counted (workflow 13 §Signing out). `account.new_device` owns the
shelf fill, the home book coming down, and the commit-author switch. No test is
deferred; no "add tests for X" leaf.

## Decisions

1. **The account screen is a new `AccountScreen.jsx` in `app/src/account/`,
   mounted as an `AppShell` full-screen surface, reached from a new header
   affordance.** *Why:* it sits beside `SignIn.jsx`, reuses the area's
   surface-mount pattern and auth client, and the header is the entry
   `design.theme_picker` and DIRECTION §6 name ("reached from the header"). The
   header control is the piece `account.sign_in` explicitly left to this task.
   *Rejected:* a `DESTINATIONS` tab (the account is not a search scope like Search
   / Books / Setlists; it is reached from the header, workflow 13); a RAC `Modal`
   over the shelf (it is a screen with its own regions, and it opens before
   sign-in where no meaningful shell may be behind it — cf.
   [[rac-modal-aria-hides-shell-chrome]]).

2. **Theme and language are two new Worker preference-write commands (`SET_THEME`,
   `SET_LANGUAGE`), each the `SET_IDENTITY_NAME` template.** The handler
   provisions the local home book, writes the `{ value, at }` register to
   `preferences.json` through `home.set`, re-surfaces `PREFERENCES`, and flushes;
   the view only dispatches and reads the `preferences` slice. *Why:* the Worker
   owns IndexedDB and git (DIRECTION §3.7), there is an established preference-write
   path with three siblings, and `ThemeRoot`/`LocaleRoot` already re-apply off the
   slice — so the pickers are pure dispatch-and-read with no new apply logic. Each
   command validates its value against `CHOSEN_THEMES` / `LOCALE_IDS` at the
   boundary. *Rejected:* one generic `SET_PREFERENCE { key, value }` (loses the
   per-key validation and diverges from the codebase's specific-command style);
   writing from the main thread (crosses the §3.7 Worker-owns-the-data boundary).

3. **The theme choice is stored as a value, with `automatic` = the absent
   register.** The picker shows Automatic selected when the `theme` register is
   absent and writes `estante`/`caderno`/`palco` otherwise; choosing Automatic
   clears back to absent (a tombstone register, home-book-format §5), it is never
   written as a literal `"automatic"`. *Why:* `resolveTheme` treats absent and any
   non-`THEMES` value as "follow the device" (resolve.js:30), and
   home-book-format §4.1 defines absent ⇒ automatic; keeping it absent means a new
   device with no choice follows its own mode. Language mirrors this: absent ⇒ the
   browser's.

4. **Per-device "Sign out" is `revokeSession` for other sessions only; the
   current device's sign-out is an `onSignOut` seam.** The roster enables
   `revokeSession` on sessions with `current: false`; the current-session control
   renders but calls `onSignOut` (default no-op), which `account.sign_out` fills.
   *Why:* the `.tji` splits them — "another device signed out from here" is this
   task's e2e, the remove/keep-books prompt is `sign_out`'s — and the seam mirrors
   `first_run`→`sign_in`'s `onSignIn`. *Rejected:* building the current-device
   prompt here (it is `sign_out`'s whole task, with the unsaved/unpushed count and
   book removal); hiding the current-device control (it is drawn in the mockup and
   the user expects it).

5. **The identity indication shows the display name, not an email.** The signed-in
   header shows `preferences.authorName` when the home book carries one, and a
   neutral "signed in" status otherwise; it shows no email. *Why:* `Account` is
   `{ id }` and no endpoint returns the account's email (the mockup's
   "rafael@example.com" is sample chrome); "the browser only ever holds its session
   with the service" (DIRECTION §3.3 lines 206–207) argues against the app holding
   an address it has no need for. *Rejected:* adding a `GET /api/account` that
   returns the email (a new contract surface — a design-level change — for chrome
   the screen does not need, making the app hold an identifier §3.3 keeps off it).

6. **Four new auth-client methods, same shape as `sharing-client.js`.**
   `listSessions`/`listPasskeys` (`GET`, 200→json/401) and
   `revokeSession`/`removePasskey` (`DELETE`, 204→ok/404/401), typed `AuthError`.
   "Add a passkey" reuses the existing `registerBegin`/`registerFinish`. *Why:*
   the endpoints exist and the roster-with-REST-client shape is `books.share`'s
   proven template; adding GET/DELETE helpers beside `postJson` is a small, local
   change. *Rejected:* routing these through the Worker (they are plain
   session-cookie HTTP with no IndexedDB/git, like the rest of the auth client).

7. **No design delta.** Every choice realises workflow 13 §The account screen,
   DIRECTION §3.2/§3.6/§3.7/§6, home-book-format §4.1, `design.theme_picker` and
   the API contract; nothing deviates from a governing document, changes the
   format, or adds a runtime dependency. The copy strings this task writes into
   i18n realise the mockup's wording. (DIRECTION §3.2's preference prose names the
   theme but not language; the language register is already settled by
   home-book-format §4.1, workflow 13 line 70 and DIRECTION §6 line 547, so this is
   a non-exhaustive summary, not a gap — no edit needed.)

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-13.

- `app/src/account/AccountScreen.jsx` (new) — the full-screen surface with `PreferencesSection`, `ThemePicker`, `LanguagePicker`, `DevicesSection`, `PasskeysSection`, and the not-signed-in card.
- `app/src/account/account.css` — styles for the account screen regions, picker rows, roster rows, and the header affordance.
- `app/src/account/auth-client.js` — four new methods: `listSessions`, `revokeSession`, `listPasskeys`, `removePasskey`; `not_found` kind added to `AuthError`.
- `app/src/shell/AppShell.jsx` — header account affordance chip and the `account` full-screen surface state (the `openSong`/`signIn` pattern).
- `app/src/worker/protocol.js` — `SET_THEME` and `SET_LANGUAGE` added to `CommandKind`.
- `app/src/worker/logic.js` — handlers for `SET_THEME` and `SET_LANGUAGE`, importing `CHOSEN_THEMES` and `LOCALE_IDS`; each writes the `{ value, at }` register via the `SET_IDENTITY_NAME` template.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the `account` copy in all four locales.
- **behavior**: `app/src/account/AccountScreen.behavior.test.jsx` (9 cases: preferences render before sign-in, theme/language dispatch round-trips, not-signed-in card, devices roster with sign-out, passkeys list/remove/add, error+retry, keyboard path, axe); `app/src/worker/preferences-theme-language.behavior.test.js` (4 cases: SET_THEME writes and re-surfaces, SET_LANGUAGE writes and re-surfaces, both survive simulated reload, invalid value rejected).
- **e2e-web**: `e2e/web/tests/account-screen.spec.js` — three journeys (theme+language kept across reload; another device signed out; passkeys listed/added/removed) on phone, tablet and computer viewports with axe.
- Implementation note: the account screen is built as one responsive measured column (stacked regions) rather than the mockup's multi-pane tablet/desktop composition; all decided states, copy, and the selected-by-word marking are present and axe-clean.
