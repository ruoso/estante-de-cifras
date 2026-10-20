# account.no_passkey_hint — Using a passkey where there is none says what to do

## TaskJuggler entry

`tasks/70-account.tji`, task `account.no_passkey_hint` (block at
`tasks/70-account.tji:85-89`); a dependency of the launch milestone
(`tasks/99-milestones.tji:32`).

## Effort estimate

0.25d.

## Repository

Lands in `app/` only: `app/src/account/SignIn.jsx`, the four locale files
under `app/src/i18n/locales/` (`en.js`, `pt-BR.js`, `es-419.js`, `it.js`),
`app/src/account/SignIn.behavior.test.jsx`, and
`e2e/web/tests/account-sign-in.spec.js`. Nothing under `cifra.md/`,
`service/` or `api/`. The design delta is in
`docs/workflows/13-new-device.md` §Signing in, or making an account (see
Decisions).

## Inherited dependencies

- `account.sign_in_two_doors` (settled, `complete 100`). It built the one
  sign-in surface with its two sections, *Already have an account?* (Use a
  passkey, Email me a link) and *New here?* (Make an account), and the
  `isCancellation` early return this task builds on.
- Through it: `account.sign_in` (settled). It built the ceremonies, the
  worded `ErrorNotice`, and the e2e-web journey's
  `enableVirtualAuthenticator` (`e2e/web/lib/journeys.js:76-90`).

Every test named below can be driven with what has already landed. The fresh
device is a new Playwright page with a CDP virtual authenticator that holds
no credential. The sign-in surface opens from the empty shelf's row
(`openSignIn`, `e2e/web/tests/account-sign-in.spec.js:31-36`). No book, no
second person and no hook is needed.

## What this task is

On a device that has no passkey for the site, pressing **Use a passkey**
makes the browser's prompt reject with `NotAllowedError`, exactly as it does
when the person cancels. `SignIn` deliberately shows nothing after a
cancellation (`app/src/account/SignIn.jsx:215`), so the person presses, the
browser's prompt comes and goes, and the screen stays as it was. Nothing tells
them what to try next.

This task adds one calm line to the method step after a cancelled
**authenticate** ceremony. The line says that if there is no passkey here,
*Email me a link* reaches an existing account and *Make an account* under
*New here?* starts one. It does not blame the person. A cancelled
**register** ceremony (*Make an account*) and a cancelled *Add a passkey* on
the offer step get no line.

## Why it needs to be done

The persona exploration on 2026-10-19 found this. Agents playing guitar
teachers on a fresh browser pressed *Use a passkey*, saw nothing happen, and
were stuck. It is the first thing a person who already has an account does on
a new device (workflow 13 §Signing in on another device, "Neither" case).
Silence there looks like a broken app. Nothing downstream depends on this
task; it is a launch-milestone polish item.

## Inputs / context

- `docs/workflows/13-new-device.md` §Signing in, or making an account
  (lines 10-45). The two sections, the no-passkey note, and (from this task's
  delta) the cancelled-passkey line.
- `docs/workflows/13-new-device.md` §Signing in on another device. The
  "Neither" case, where the emailed link is the way in.
- `app/src/account/SignIn.jsx`:
  - `runCeremony(create)` (lines 195-218). The `isCancellation(err)` early
    return at line 215 is the seam. `create` already tells the two doors
    apart.
  - `ErrorNotice` (lines 83-90) is `notice warn`, `role="alert"`. The new
    line deliberately does not reuse it (Decision 2).
  - The method step's JSX (lines 289-332). The error slot sits at line 299,
    above the *Already have an account?* group.
  - `addPasskeyHere` (lines 249-266) has its own cancellation return at
    line 263. It stays silent.
  - The *Email me a link* press (lines 309-313) and `goMethod`.
- `app/src/account/webauthn-json.js:42-44`, `isCancellation`, which matches
  `NotAllowedError` or `AbortError`.
- `app/src/i18n/locales/en.js:794-832`, the `signIn` namespace. The existing
  `note` and `newHereNote` lines set the voice.
  `app/src/i18n/i18n.test.js:46-65` requires every locale to have every key,
  with matching placeholders and real translations.
- `app/src/account/SignIn.behavior.test.jsx:406-426`, the existing case "a
  cancelled passkey prompt returns to the method step with no error shouted".
  The new cases build on its `installWebAuthn` / `makeClient` set-up.
- `e2e/web/tests/account-sign-in.spec.js`, the existing sign-in journeys, and
  `e2e/web/lib/journeys.js:76-90` (`enableVirtualAuthenticator`).
- `docs/mockups/theme.css:204-208`, the `.notice` variants. Plain `.notice`
  is the neutral surface.

## Constraints / requirements

- **The browser's answer is all there is.** WebAuthn cannot tell the app "no
  credential" apart from "the person cancelled", by design (privacy). The
  line shows on every cancelled authenticate. Its wording has to be right in
  both cases: conditional ("if there's no passkey…"), never "you have no
  passkey" and never "something went wrong".
- **Not an error.** The line is not `role="alert"` and not `.warn`. It is
  announced politely (`role="status"`) on a plain `.notice` surface, carried
  by words alone, never colour.
- **One line, gone with the next press.** It clears when any ceremony
  starts, when *Email me a link* moves to the email step, and when the step
  changes. A later real error (a 401, offline) replaces it rather than
  stacking. The hint and `ErrorNotice` are never both shown.
- **Only after authenticate.** A cancelled *Make an account*, and a cancelled
  *Add a passkey* on the offer step, keep today's silence.
- **Under an invitation lead, too.** The invited screen draws the same two
  sections (`lead` prop), so the line appears there in the same place.
- **i18n.** A new `signIn.noPasskeyHint` leaf in all four locales, with no
  placeholders, translated rather than copied. It names the buttons by the
  same words those buttons carry in each locale (`emailLink`, `makeAccount`,
  `newHere`).
- **Accessibility.** No new interactive part: the line is text. Focus stays
  on the *Use a passkey* button, which is re-enabled; the line must not move
  it. axe at WCAG 2.1 AA with the line shown.
- No network, no logging, and no service change. The line is local state of
  the surface.

## Acceptance criteria

Behavior delivered:

- After *Use a passkey* rejects with `NotAllowedError` or `AbortError`, the
  method step shows, above the two sections, in a `role="status"` plain
  `.notice`, the English line:
  *No passkey for Estante on this device? If you already have an account,
  Email me a link signs you in. If not, Make an account under New here?
  starts one.*
  The pt-BR, es-419 and it locales carry translations that use their own
  button names.
- The line is absent on first open. It is absent after a cancelled *Make an
  account* and after a cancelled *Add a passkey* on the offer step. It goes
  away when any ceremony starts or the step changes. It is replaced, not
  joined, by a worded error.
- A 401 on authenticate finish still shows `errorPasskey`, and only that.

Tests, by level:

- **unit**: `app/src/i18n/i18n.test.js` (existing, runs over the new key).
  `signIn.noPasskeyHint` is present in every locale, has no placeholders, and
  is translated.
- **behavior**: `app/src/account/SignIn.behavior.test.jsx`:
  - *"a cancelled Use a passkey says, in a status line, what to do if there is
    no passkey here — no alert, axe clean"*. `get` throws `NotAllowedError`.
    The `role="status"` line with the English text appears; there is no
    `role="alert"`; *Use a passkey* is re-enabled; `checkWcag21aa` passes.
    Pins workflow 13 §Signing in, or making an account (the cancelled-passkey
    paragraph). This extends or replaces the existing case at lines 406-426,
    whose "no error shouted" assertion stays.
  - *"a cancelled Make an account shows no line"*. `create` throws
    `NotAllowedError`. There is no hint and no alert. Pins the same paragraph,
    "a cancelled Make an account gets no line".
  - *"the line goes with the next press: Email me a link moves on without it,
    and a retried Use a passkey that 401s shows only the passkey error"*. Pins
    "goes away with the next press" and Constraints (never both).
  - *"under an invitation lead, a cancelled Use a passkey shows the same
    line"*. Renders with `lead`, so the invited screen keeps the same
    behavior.
- **e2e-web**: `e2e/web/tests/account-sign-in.spec.js`, a new case *"a fresh
  device with no passkey presses Use a passkey and is told what to do"*.
  `enableVirtualAuthenticator(page)` with no credential added, then
  `openSignIn(page)`, then press *Use a passkey*. The line is visible, there
  is no session cookie (`hasSessionCookie` false), the two sections are still
  there, and `checkA11y()` runs with the line shown. It runs on the phone,
  tablet and computer projects. Real UI only: no `#dev/*`, no init script, no
  mocked network. Pins workflow 13 §Signing in, or making an account and the
  "Neither" case of §Signing in on another device.

Nothing is deferred.

## Decisions

1. **The line follows every cancelled authenticate, not a guessed "no
   credential".** The alternatives were timing heuristics (a rejection that
   arrives under N ms means "no passkey") or a conditional-mediation probe.
   Both are unreliable across browsers and would give two different messages
   for one indistinguishable answer. One conditional line is right in both
   cases: a person who really cancelled reads a harmless hint.
2. **A calm status, not the error notice.** Reusing `ErrorNotice` with a new
   key would be the smallest change. But `notice warn` with `role="alert"`
   reads as "you did something wrong", and the task says "without blaming the
   person". A plain `.notice` with `role="status"` matches how the surface
   already reports neutral state (`BusyStatus`). It is a separate piece of
   state (for example `hint: boolean`) cleared wherever `setError(null)` runs
   today, so the two never show together.
3. **Placed above the two sections, in the error slot.** The line points at
   both sections, so it sits where a message about the whole step already
   goes (`SignIn.jsx:299`). Putting it inside *Already have an account?*
   would hide the pointer to *New here?*.
4. **No line after a cancelled Make an account or Add a passkey.** Those
   people chose to make a passkey. A cancellation there is a real "not now",
   and the offer step already has *Not now*. This keeps the existing
   deliberate silence everywhere except the one ambiguous case.
5. **Design delta in workflow 13, no board change.** The workflow said
   nothing about what a cancelled prompt shows, and the task adds a visible,
   worded state to the surface. So §Signing in, or making an account gains a
   short paragraph (`docs/workflows/13-new-device.md:37-45`) with the copy.
   The W13 board is not redrawn: the line is one plain notice in the slot the
   board's error state already occupies, and the visual language is
   unchanged.
6. **e2e uses a virtual authenticator with no credential.** Removing the
   authenticator entirely would make Chromium show its own "no authenticator"
   UI rather than reject at once. An empty resident-key authenticator with
   automatic presence answers `NotAllowedError`, the same answer a real
   device with no passkey gives. If Chromium holds the request until the
   WebAuthn `timeout` instead of rejecting at once, the case waits for the
   line with a timeout above the options' `timeout`. It does not shorten the
   service's options.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- app/src/account/SignIn.jsx: a cancelled *Use a passkey* (`NotAllowedError` or `AbortError`) sets a `hint` state; the method step shows one plain `.notice` with `role="status"` above the two sections, on the plain screen and under an invitation lead. It clears on the next ceremony, on *Email me a link* and on a step change, and a worded error replaces it. A cancelled *Make an account* or *Add a passkey* still shows nothing.
- app/src/i18n/locales/en.js, pt-BR.js, es-419.js, it.js: new `signIn.noPasskeyHint`, translated, no placeholders; app/src/i18n/i18n.test.js covers it (unit).
- app/src/account/SignIn.behavior.test.jsx: the four named cases plus an `AbortError` case and a cancelled *Add a passkey* case; axe clean with the line shown.
- e2e/web/tests/account-sign-in.spec.js: "a fresh device with no passkey presses Use a passkey and is told what to do", on phone, tablet and computer, axe checked.
- docs/workflows/13-new-device.md: the cancelled-passkey paragraph in §Signing in, or making an account.
- No tech-debt follow-ups.

