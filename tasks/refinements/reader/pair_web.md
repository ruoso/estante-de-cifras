# reader.pair_web — Pair a device, in the web app

## TaskJuggler entry

[`tasks/85-reader.tji`](../../85-reader.tji), `task pair_web "Pair a device, in
the web app"` (lines 130–135):

> The web side of pairing as workflow 13 decides it: estantedecifras.app/pair
> (and its way in from the account screen) takes a reMarkable code, says what
> the device will be able to do, and approves it; an unknown, expired or used
> code is said in words; the paired reader is listed among the signed-in
> devices as your reMarkable and can be signed out there. Copy in the four
> locales. Tests: behavior (the page: a code approved, each refusal said; the
> device listed; axe); e2e-web (a code begun against the stack is approved from
> the page on the three viewports, and the device appears among the signed-in
> devices).

## Effort estimate

1d, as the `.tji` gives it: one page component, a pure boot-path parser and code
check, one auth-client method, the account screen's row and foot, 23 strings in
four locales, and their tests. No service code, no contract change.

## Repository

estante-de-cifras, **not** `cifra.md/` (the note does not start with
`cifra.md:`). Directories:

- `app/src/account/` — new `PairDevice.jsx` (the page), `pair-route.js` (the
  boot-path parser), `pair-code.js` (the client-side shape check);
  `auth-client.js` gains `approveDevicePairing`; `AccountScreen.jsx` gains the
  reMarkable row and the **Pair a device** foot.
- `app/src/App.jsx`, `app/src/shell/AppShell.jsx` — `/pair` read at boot and
  the page opened as a surface.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the copy.
- `service/internal/server/app_test.go` — one test pinning that `/pair` serves
  the shell (no production change; Decision 6).
- `e2e/web/lib/remarkable-device.js` (new), `e2e/web/tests/pair-device.spec.js`
  (new).

## Inherited dependencies

- `reader.pair_design` — **settled** (`complete 100`): workflow 13 §Pairing a
  reMarkable (`docs/workflows/13-new-device.md` L332–467) and the board
  `docs/mockups/Pair-a-device.dc.html`. Normative for this task.
- `reader.device_pairing` — **settled** (`complete 100`, Status 2026-11-02):
  `beginDevicePairing`, `approveDevicePairing`, `pollDevicePairing` in
  `api/openapi.yaml` (L445, L469, L508), `Session.kind` / `Session.readOnly`
  (L1433–1461), the session minted at approve so it is listed at once
  (device_pairing.md Decision 4).
- Already landed and used: `account.sign_in` (the sign-in surface, `SignIn.jsx`
  with its `lead` slot), the account screen (`AccountScreen.jsx`), the e2e-web
  harness (`foundation.e2e_web`) and its passkey journeys.

## What this task is

The page a person opens to pair their reMarkable, and its place on the account
screen. `estantedecifras.app/pair` — or **Pair a device** at the foot of the
account screen's Signed-in devices — opens *Pair a device*: one Code field, what
the reMarkable will be able to do, the warning line, and **Pair your
reMarkable**, which approves the code with the service. Signed out, the page
first shows the one sign-in surface under its own lead, then goes on to the
code. A malformed code is refused before anything is sent; an unknown, expired
or used code, or too many tries, is said in words under the field. Approved, the
page says it is paired and **Done** opens the account screen, where the reader
is listed as *your reMarkable*, marked *Reads only*, and can be signed out with
its own confirmation. All copy in en, pt-BR, es-419 and it, from workflow 13's
table.

## Why it needs to be done

The service can pair (`reader.device_pairing`), but nothing a person can reach
approves a code: the reader's pairing page (`reader.pairing`) shows an address
that today boots to search. This task closes the loop from the person's side and
makes the read-only session visible and revocable, which the design promises
before anyone trusts a device with their books. `reader.pairing`'s e2e-api
journey uses an API approve, but the person's path is this page; milestone
`m_reader` (`tasks/99-milestones.tji` L60) lists it.

## Inputs / context

- **Workflow 13 §Pairing a reMarkable** (`docs/workflows/13-new-device.md`):
  - §Where it lives L341–354: the address, the account screen door, the bar
    (**Back** to the account screen, or to the shelf when the address opened
    it; title; chip, Help, account; banner above).
  - §Not signed in L356–364: *Sign in to the account whose books the reMarkable
    should read.* above the one sign-in surface, "as the invited screen draws
    it"; signed in there, the page goes on to the code. An emailed link opens
    the shelf (no return to `/pair`).
  - §The page L366–402: copy, the field's leniency (case, dash, spaces), the
    malformed check on the press (*A code is six letters and numbers, like
    KQ7-4TM.*, nothing sent), the warning line (not a dialog), **Paired.** with
    **Done** → account screen at Signed-in devices, **Offline** (button
    disabled, *You're offline. Pairing needs a connection.*, field kept).
  - §A code that does not pair L404–416: Unknown, Expired, Used, Too many tries;
    each under the field, the field keeps its text and takes the focus.
  - §Among the signed-in devices L418–434: *your reMarkable*, last used,
    *Reads only* as a word, **Sign out**; never *This device*; the dialog
    *Sign your reMarkable out?* with its body, **Sign out** / **Cancel**.
  - §The copy, in the four locales L436–467 (rows L440–462; *Get a new code*
    stays English, italicised in pt/es/it, L464–467).
  - §The account screen L288–293: the reMarkable row and the **Pair a device**
    foot with its line.
- **The board** `docs/mockups/Pair-a-device.dc.html`: phone L30 (the page
  signed in, `kq7 4tm` typed), phone L59 (expired refusal, `role="alert"`,
  `aria-invalid`; other refusals card L208–212), tablet L97 (signed out, the
  sign-in sections L107–119; paired card L122–130; offline L132–135), computer
  L143 (the account screen, the reMarkable row with the `.badge` *Reads only*
  L173–175, the foot L177–180, the sign-out dialog L185–193).
- **pair_design.md** (`tasks/refinements/reader/pair_design.md`): accessibility
  L162–168; what pair_web owns L197, L220–246, L301–303; why sign-in comes
  first (no oracle for strangers) L321–329; no code in the URL, no QR L331–338.
- **The contract** (`api/openapi.yaml`): `approveDevicePairing` L469–506 — body
  `{code}` (any case, dash or spaces), 204; 401; 403 `read_only`; 404
  `pair_code_unknown`; 409 `pair_code_used`; 410 `pair_code_expired`; 429
  `rate_limited`. `listSessions` L386–399, `revokeSession` L401–418, `Session`
  L1433–1461 (`kind: remarkable`, `readOnly: true`, no `device`,
  `current: false`). `beginDevicePairing` L445–467 and `DevicePairing`
  L1463–1484 (code pattern `^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$`);
  `pollDevicePairing` L508–535, `DevicePairingPoll` L1504–1526 (the session is
  sent as the `estante_session` cookie).
- **App seams:**
  - `app/src/App.jsx` L100–124 (boot-path readers `bootRedeemToken`,
    `bootRecoveryEmailToken`, `bootInvitationToken`), L170–179 (held in state),
    L185–189 (the path cleaned to `/`), L209–215 (`<AppShell …>` props).
  - `app/src/account/recovery-email-route.js`, `sign-in-route.js`,
    `invitation-route.js` and their `*.test.js` — the pure boot-path parser
    pattern.
  - `app/src/shell/place.js` L25, L38–51 and `shell/use-place-history.js`
    L67–80, L146: an unknown path boots to search and the URL becomes `/` —
    so `/pair` must be caught in App.jsx first.
  - `app/src/shell/AppShell.jsx` `renderSurface()` from L950: `signIn` L968–999
    (`lead`/`leadFooter` props, `onSignedIn`/`onDone`/`onClose`), `account`
    L1028–1042; state at L319, L340, L366; the invited flow L297–307, L796–857.
  - `app/src/account/SignIn.jsx` L126–127 (`lead`, `leadFooter`), L165–166.
  - `app/src/account/InvitedScreen.jsx` (`InvitedLead`) — the lead precedent.
  - `app/src/account/AccountScreen.jsx`: the session probe L508–534
    (`listSessions` → `'in'|'out'|'error'`), `devicesRegion` L785–822 (row
    label `session.device || t('account.unknownDevice')` L790), `revoke`
    L538–548, `ConfirmDialog` L325, Back L958.
  - `app/src/account/auth-client.js`: `AuthError` L27, `KIND_BY_CODE` L52–59,
    `failureOf` L64 (401 → `unauthorized`, 429 → `rate_limited`), `postJson`
    L82, `emptyOf` L73, `createAuthClient` L150, `listSessions` L195,
    `revokeSession` L198.
  - `app/src/account/use-online.js` — the online signal.
  - `app/src/i18n/index.js` L26–31 (the four locales); `locales/en.js` account
    block from L920, devices keys L994–1010 (pt-BR L917, es-419 L918, it L917);
    `i18n/i18n.test.js` L46, L55, L65, L82.
- **Test seams:**
  - `app/src/account/AccountScreen.behavior.test.jsx` — `makeAuthClient(routes)`
    L47–68, Signed-in devices L338–378.
  - `app/src/account/RecoveryEmailConfirm.behavior.test.jsx` L20–39 — a
    one-endpoint page with axe (`checkWcag21aa`, `app/src/a11y/axe.js`).
  - `app/src/shell/AppShell.routing.behavior.test.jsx`.
  - `service/internal/server/app.go` L86–106 (`/pair` has no extension, so it
    already falls back to `index.html`), `TestEmailedLinkRoutesServeShell`
    (`app_test.go` L286); `pairing.go` L57–69 (`pairURL` = base + `/pair`).
  - `e2e/web/eslint.config.js` L32–62 (spec restrictions);
    `e2e/web/lib/git-device.js` (a non-browser second device in `lib/`, the
    precedent for the reMarkable stand-in); `lib/journeys.js` (`startApp` L26,
    `enableVirtualAuthenticator` L82, `openSignInSurface` L129, `makeAccount`
    L144, `signedInDevice` L168); `lib/journeys-account.js` (`openAccount` L35,
    `reopenAccount` L117); `lib/axe.js` (`checkA11y` fixture L97–111);
    `tests/account-screen.spec.js` L79–121 (the revoke journey);
    `tests/new-device.spec.js` (per-project branching);
    `e2e/api/pairing.test.js` L61–80 (begin/poll, not shareable with e2e/web —
    the harnesses share no code).

## Constraints / requirements

1. **The address.** A boot at `/pair` or `/pair/` (nothing else after the
   segment; a query or hash ignored) opens the *Pair a device* page; `/pairs`
   or `/pair/x` do not. Caught in `App.jsx` beside the token routes by a pure
   `isPairPath(pathname)` in `account/pair-route.js`, then the address is
   cleaned to `/` like the token paths (Decision 2). No code is ever read from
   the URL (pair_design.md L331–338).
2. **The page is a surface in `AppShell`**, like the account screen: opened by
   the boot flag (`pairOpen`) or by **Pair a device** on the account screen;
   **Back** returns to the shelf (opened by the address) or to the account
   screen (opened from it). Its bar and banner as workflow 13 L351–354 and the
   board draw them.
3. **Signed out first.** The page probes the session (`listSessions`, as
   `AccountScreen` L508–534 does). `'out'` → the one sign-in surface
   (`SignIn`) with a `PairLead` (the page heading *Pair a device* and *Sign in
   to the account whose books the reMarkable should read.*) in its `lead`,
   both doors and making an account; on `onSignedIn` the page goes on to the
   code, on the same surface. Closing sign-in returns to the shelf. No code
   field is shown before a session exists.
4. **The field and the press.** React Aria `TextField` (label *Code*, the hint
   as its description) and `Button` *Pair your reMarkable*. Nothing is checked
   or sent before the press. On the press, `pair-code.js` strips spaces and
   dashes and requires exactly six ASCII letters or digits; otherwise the
   malformed line is said and **no request is made**. A well-shaped code is
   sent as typed (trimmed) — the service normalises and answers a look-alike
   (`O`, `0`, `1`, `I`, `L`) as unknown; the client does not re-implement the
   alphabet (Decision 3).
5. **Refusals said in words** as the field's error message (`TextField`
   `isInvalid` + `FieldError`, so `aria-invalid` and `aria-describedby` tie
   it), with the field keeping its text and taking focus: 404 → Unknown, 410 →
   Expired, 409 → Used, 429 → Too many tries, malformed → Malformed. 401 (the
   session ended under the page) → the sign-in surface as in 3. Any other
   failure (network, 5xx) → the offline line when offline, else a generic
   *Couldn't reach Estante* style line already in the app's copy (reuse an
   existing `account.*` network string; no new design copy). The press is
   disabled while a request is in flight.
6. **Offline.** While `use-online` says offline, the button is disabled and
   the page says the offline line; the field keeps what was typed; online
   again re-enables it. Offline is a word, never colour alone.
7. **Paired.** On 204 the page is replaced by *Your reMarkable is paired. Its
   shelf appears on it in a moment.* and **Done**, which closes the page and
   opens the account screen; the devices list is freshly loaded there (the
   account screen's own probe), so the new row is shown.
8. **The auth client.** `approveDevicePairing(code)` →
   `POST /api/devices/pair/approve` `{code}`, 204 → resolves; `KIND_BY_CODE`
   gains `pair_code_unknown → 'pair_unknown'`, `pair_code_expired →
   'pair_expired'`, `pair_code_used → 'pair_used'`, `read_only → 'read_only'`;
   `failureOf` must map 404/409/410 through the code (not to `network`).
   Main-thread, same-origin, like every other `auth-client` call.
9. **The devices row.** A session with `kind === 'remarkable'` is labelled
   *your reMarkable* (`account.remarkable`), never `session.device`, never
   *This device* even if `current` were set; `readOnly` shows *Reads only* as a
   visible word (the `badge` the board draws, `aria`-readable as text, not an
   icon). Its sign-out trigger's accessible name uses the same label
   (`account.signOutLabel` with *your reMarkable*), and its `ConfirmDialog`
   uses *Sign your reMarkable out?* and its body; confirm calls the existing
   `revoke`. Two reMarkables are two rows, each with its own last-used time.
   An unknown future `kind` falls back to today's label.
10. **The foot.** At the foot of Signed-in devices, **Pair a device** (a RAC
    `Button`) with its line, opening the page (constraint 2).
11. **Copy.** Every string from workflow 13 L440–462 into all four locale files
    under a new `pair` block (page) and the `account` block (foot, row, mark,
    dialog), verbatim from the table, including *Get a new code* left in
    English (italicised in pt/es/it — use the app's existing rich-text/emphasis
    convention; if there is none, plain text, since the reader shows it in
    English). `i18n.test.js` passes (keys, placeholders, translated).
12. **Accessibility.** RAC for every interactive part; keyboard: Tab to the
    field, type, Enter submits the form; Back, Done, the foot and the row's
    Sign out reachable by keyboard; axe WCAG 2.1 AA clean in every state; the
    page's heading is the `h1` focus lands on when it opens.
13. **Nothing secret logged or stored.** The code is not logged, not put in the
    URL, not kept in storage; the page holds it only in component state.
14. **Standing rules.** The app and the service share no code; the main thread
    stays off IndexedDB (nothing here touches it); no book is opened by the
    page.

## Acceptance criteria

Behavior delivered: everything in Constraints, visible on the real stack at
`/pair` and from the account screen, matching the board.

Tests, by level:

- **unit**
  - `app/src/account/pair-route.test.js` — `isPairPath`: `/pair`, `/pair/` →
    true; `/`, `/pairs`, `/pair/KQ7-4TM`, `/b/pair`, non-string → false
    (workflow 13 L343–347; pair_design.md L331–338, no code in the URL).
  - `app/src/account/pair-code.test.js` — `checkPairCode`: `KQ7-4TM`, `kq74tm`,
    ` kq7 4tm `, `KQ7--4TM` → well-shaped; `KQ7-4T`, `KQ7-4TMX`, `''`,
    `KQ7-4T#` → malformed; `KQ7-4TO` (a look-alike) → well-shaped (the service
    answers it) (workflow 13 L387–392).
  - `service/internal/server/app_test.go` `TestPairAddressServesShell` — `GET
    /pair` and `/pair/` answer `index.html` with `noindex` (the address the
    reader shows, `pairing.go` `pairURL`; Decision 6).
- **behavior**
  - `app/src/account/PairDevice.behavior.test.jsx`, a loopback auth client in
    the style of `AccountScreen.behavior.test.jsx` L47–68:
    - *a code approved*: `kq7 4tm` typed, Enter → one `POST
      /api/devices/pair/approve` with `{code}`; the paired line and **Done**;
      Done calls the open-account callback (workflow 13 L397–400); axe clean
      before and after.
    - *each refusal said*: one `it` per answer — 404 `pair_code_unknown`, 410
      `pair_code_expired`, 409 `pair_code_used`, 429 `rate_limited` — the
      workflow's words as the field's error, `aria-invalid` on the input,
      focus in the field, its text kept (workflow 13 L404–416); axe clean with
      the error shown.
    - *malformed*: `KQ7-4T` → the malformed line, **no** request recorded
      (workflow 13 L390–392).
    - *offline*: offline → button disabled, the offline line, typed text
      kept; online → enabled (workflow 13 L401–402).
    - *signed out*: `listSessions` 401 → the lead line above the sign-in
      surface's two doors, no Code field; after a sign-in completes the Code
      field appears (workflow 13 L356–364); axe clean.
    - *what it can do*: the heading, the body and the warning line present as
      text, no dialog (workflow 13 L376–385, L393–396).
  - `app/src/account/AccountScreen.behavior.test.jsx`, in the Signed-in
    devices block:
    - *the device listed*: a session `{kind:'remarkable', readOnly:true}` is
      *your reMarkable* with *Reads only* as a word and its last-used time,
      never *This device*; two such sessions → two rows (workflow 13
      L418–426).
    - *signed out there*: its Sign out opens *Sign your reMarkable out?* with
      the body; confirm sends `DELETE /api/account/sessions/{id}` and the row
      goes; Cancel sends nothing (workflow 13 L428–434).
    - *the foot*: **Pair a device** with its line, pressing it calls the
      open-pair callback (workflow 13 L288–293); axe clean with the row.
  - `app/src/shell/AppShell.routing.behavior.test.jsx` — booted with
    `pairOpen`, the *Pair a device* page is the surface; Back goes to the
    shelf; from the account screen's foot, Back returns to the account screen
    (workflow 13 L341–354).
  - `app/src/i18n/i18n.test.js` (existing) passes with the new keys in all
    four locales (workflow 13 L436–467).
- **e2e-web** — `e2e/web/tests/pair-device.spec.js`, on phone, tablet and
  computer, through the real UI only. The reMarkable is a stand-in in
  `e2e/web/lib/remarkable-device.js` (Node `fetch`, no browser): `begin()`
  (`POST /api/devices/pair/begin`, no session — a call only a reader makes,
  never the web UI; Decision 5) and `poll()`, and `canRead()` (a read-only GET
  with its session cookie).
  - *paired by the address*: an account made with a passkey (`makeAccount`);
    the stand-in begins; `startApp(page, '/pair')`; the code typed lower-case
    without the dash; axe on the page (`checkA11y`); **Pair your reMarkable**
    → the paired line; the stand-in's poll answers `approved` with a session;
    **Done** → the account screen lists *your reMarkable* with *Reads only*;
    axe on the account screen. The same code entered again → *That code was
    already used…* under the field (workflow 13 §The page, §A code that does
    not pair, §Among the signed-in devices).
  - *signed out first, then from the account screen, then signed out*: a
    fresh context opens `/pair` signed out → the lead line and the sign-in
    surface (axe); making an account there → the Code field on the same page;
    a code no reader began (`ZZZ-ZZZ`) → *No reMarkable is showing that
    code…*; a code the stand-in began → paired; then on the account screen
    **Pair a device** at the foot opens the page and Back returns to the
    account screen; the reMarkable row's Sign out → *Sign your reMarkable
    out?* (axe on the dialog) → Sign out → the row is gone and the stand-in's
    session is refused (401) (workflow 13 §Not signed in, §Where it lives,
    L428–434).
  - *offline*: on the page, `context.setOffline(true)` → the offline line and
    the button disabled, the typed code kept; back online → enabled (workflow
    13 L401–402).
  - Expired and too-many-tries are pinned at behavior level only (Decision 7).

No follow-up tasks: nothing is deferred.

## Decisions

1. **The page is a shell surface, not a place.** Like the account screen, it
   is a layer in `renderSurface()`, opened by a boot flag or a callback.
   Alternative: a `place.js` place with its own URL kept while open. Rejected:
   places are tabs and books (`shell.routing`); the account screen already
   lives without an address, and the page is a one-shot errand.
2. **`/pair` is cleaned to `/` at boot**, as the token routes are (App.jsx
   L185–189). A reload then shows the shelf, which is where Back from an
   address-opened page goes anyway. Alternative: keep `/pair` in the address
   bar — needs `use-place-history` to learn a non-place path, for no promise
   the workflow makes.
3. **The client checks only the shape the workflow states** (six letters and
   numbers, after case/dash/space leniency); the alphabet stays the service's.
   Alternative: mirror the 31-character alphabet client-side and refuse `O`
   locally — would duplicate `service/internal/pairing/code.go` (the app and
   the service share no code, only the contract) and say *malformed* where the
   workflow says *unknown*.
4. **Signed out reuses `SignIn` with a lead**, as the invited flow does
   (`InvitedLead`, AppShell L974–975), so "the one sign-in surface … as the
   invited screen draws it" (workflow 13 L357–359) is literally the same
   component. Alternative: a sign-in embedded in the page — a second surface,
   which the workflow rules out.
5. **The reMarkable in e2e-web is a `lib/` stand-in using `fetch`.** Begin and
   poll are the reader's calls; no web UI makes them, so the spec rule "no API
   writes the UI can make" (`eslint.config.js` L32–36) does not apply, and
   `lib/git-device.js` is the precedent for a non-browser second device living
   in `lib/`. The spec itself makes no `request.post`, needs no
   `eslint-disable`. Alternative: depend on `reader.pairing` and drive the real
   reader — not a browser, and it would block this task on the whole reader
   side.
6. **No service change; a test pins the address.** `/pair` already falls back
   to the shell (`app.go` L86–106: no extension). Adding it to `appRoutes` or
   `linkRoutes` would be wrong (those exempt paths *under* a segment, and
   `linkRoutes` redacts tokens). One `app_test.go` test guards the printed
   address against a future asset rule.
7. **Expired and rate-limited are not driven end to end.** Expiry needs ten
   minutes or a Postgres timestamp move, and the rate limit ten failures; both
   are the service's, already pinned by `pairing_test.go` and
   `e2e/api/pairing.test.js`. What this task adds — the words for each answer
   — is pinned per answer by `PairDevice.behavior.test.jsx`; the e2e journey
   pins the two refusals the real UI reaches naturally (unknown, used).
8. **Done reopens the account screen, which reloads sessions**, rather than
   the page pushing a row into it: the session is minted at approve
   (device_pairing Decision 4), so the account screen's own probe shows it.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-02.

- The Pair a device page at `/pair` and from the account screen's foot: `app/src/account/PairDevice.jsx`, `pair-route.js` (`isPairPath`), `pair-code.js` (`checkPairCode`); wired in `app/src/App.jsx` and `app/src/shell/AppShell.jsx` (`pairOpen`, Back to the shelf or the account screen).
- Signed out, the page shows the sign-in surface first and moves to the Code field once an account exists; malformed codes send nothing, each refusal (404/410/409/429) is said under the field, and there is an offline state.
- The paired reader is listed as *your reMarkable* with *Reads only* and its own sign-out confirmation: `app/src/account/AccountScreen.jsx`, `auth-client.js`, `account.css`.
- Copy in four locales: `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Tests: unit `pair-route.test.js`, `pair-code.test.js`, `service/internal/server/app_test.go` `TestPairAddressServesShell`; behavior `PairDevice.behavior.test.jsx`, `AccountScreen.behavior.test.jsx`, `AppShell.routing.behavior.test.jsx`; e2e-web `e2e/web/tests/pair-device.spec.js` (phone, tablet, computer) with the stand-in `e2e/web/lib/remarkable-device.js`.
- Fixer: split the slow `(c) unreachable, 401 and 409` case in `app/src/worker/leave-book.behavior.test.js` into one test each (it was close to Vitest's 5 s limit under gate load).
- No tech-debt follow-up.
