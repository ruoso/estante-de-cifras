# reader.pair_design — Pairing a device, decided

## TaskJuggler entry

[`tasks/85-reader.tji`](../../85-reader.tji), `task pair_design "Pairing a
device, decided"` (lines 117–120):

> A reMarkable cannot do a passkey, so it is paired like a television
> (docs/remarkable-reader.md §5.1): it shows a short code and an address, and
> the person, signed in on a phone or a computer, enters the code there. Decide
> the web side in workflow 13: where Pair a device lives (an address,
> estantedecifras.app/pair, and the account screen), its one page (the code
> field, the confirmation Pair your reMarkable naming what it will be able to
> do — read every book on the shelf, never change one), what an unknown,
> expired or used code says, and how a paired reader appears among the
> signed-in devices (your reMarkable) and is signed out from there. Copy in the
> four locales. Tests: none — design deliverable (workflow 13 edits and its
> board).

## Effort estimate

0.5d, as the `.tji` gives it. The workflow text is written with this
refinement (the design delta, below). What is left for the implementer is the
board, and checking it against the text.

## Repository

estante-de-cifras, **not** `cifra.md/`: the note does not start with
`cifra.md:`. No code and no `api/` change. `api/openapi.yaml` is extended by
`reader.device_pairing`, which builds what this decides. Files:

- `docs/workflows/13-new-device.md`: edited, written with this refinement.
  - §The account screen, the Signed-in devices bullet, L288–293: *Pair a
    device* at the section's foot, and the reader's row.
  - The new **§Pairing a reMarkable**, L332–467, with its subsections Where it
    lives, Not signed in, The page, A code that does not pair, Among the
    signed-in devices, and The copy, in the four locales.
  - §Later, L469–: the *Pairing a device from one already signed in* entry now
    says that a reMarkable is already paired the other way round, and a
    browser device is not.
- `docs/workflows/19-remarkable-reader.md` §Pairing, L102–113: edited, written
  with this refinement. It says what the reader does when its session is
  signed out from the account.
- `docs/DIRECTION.md`: edited, written with this refinement.
  - §3.3, L161–165: the bare domain's forward keeps the path, so
    `estantedecifras.app/pair` lands on `www`'s `/pair`.
  - §6, L624–634: the new bullet *Pairing a reMarkable, decided and drawn*.
  - §7 is unchanged: there is no new workflow.
- `docs/mockups/Pair-a-device.dc.html`: **new**. The implementer draws it.
- `docs/mockups/canvas.json`: the board is registered there, by the closer,
  following the precedent of `design.recovery_email`. GUIDE.md tells a board
  writer not to edit this file.

## Inherited dependencies

The `.tji` lists no `depends`. The task builds on what is settled:

- **Workflow 13** (decided). The one sign-in surface is §Signing in, or making
  an account, L10–49. The account screen's Signed-in devices section and its
  sign-out are §The account screen, L270–316. Devices are named by kind in
  §Books that were only on the other device, L237–241.
- **Workflow 19 §Pairing** (decided, L100–). These are the reader's pages: the
  code `KQ7-4TM`, the address `estantedecifras.app/pair`, *This code works
  until 14:42*, *Get a new code*, and *Sign out*, which removes the books and
  returns to *Not paired*.
  - `reader.browse_screens` drew them (`tasks/refinements/reader/browse_screens.md`
    L19, L47–49).
  - `reader.pairing` wires them to the service.
- **remarkable-reader.md §5.1** (L308–325). It defines the three calls
  `begin`, `approve` and `poll`; a session that is the account's, read-only by
  scope, and listed as *your reMarkable*; and codes that live ten minutes, are
  single-use and are rate-limited. §4 (L244): the reader carries one locale.
- **The account screen as built** (`account.account_screen`, complete).
  - `app/src/account/AccountScreen.jsx` L785–815 is `devicesRegion`. Each
    row's label is `session.device || t('account.unknownDevice')`, plus
    *last used* and a ConfirmDialog sign-out.
  - The copy is in `app/src/i18n/locales/en.js` L994–1009, with its
    `pt-BR`/`es-419`/`it` twins at L917–930.
  - `GET /api/account/sessions` and `DELETE /api/account/sessions/{id}` are at
    `api/openapi.yaml` L366–397. `Session` (L1279–1295) has `device`, a
    User-Agent description, and **no kind**.
  - The `sessions` table (`service/internal/db/migrations/0001_registry.sql`
    L61–71) has no kind and no scope.
- **Link-opened pages** (the precedent for `/pair`). `/recovery-email/<token>`
  is parsed in `app/src/account/recovery-email-route.js`, captured at boot in
  `app/src/App.jsx` L108–115, and rendered by `AppShell.jsx` L955. The service
  serves the shell on these paths through `linkRoutes`
  (`service/internal/server/app.go` L57–68).

Waiting on this task:

- `reader.device_pairing` (`tasks/85-reader.tji` L122–127) and
  `reader.pair_web` (L128–133), both of which build "as workflow 13 decides".
- `reader.pairing` (L140–145), indirectly: the workflow 19 delta.

## What this task is

It decides, in workflow 13, the web side of pairing a reMarkable:

- the address and the account-screen button that open the page;
- what the page shows signed out and signed in;
- its one field and its one button;
- what each refusal says;
- the page once a code is paired;
- how a paired reader is listed and signed out;
- the copy, in en, pt-BR, es-419 and it.

It is drawn on a board, on two phones, a tablet and a computer. The task also
closes one gap that deciding the web side's *sign out* opens on the reader:
what the reader shows when its session was ended from the account.

## Why it needs to be done

`reader.device_pairing` cannot word its refusals, or know what a paired
session must carry for the list, until this is decided. `reader.pair_web` has
no page to build. remarkable-reader.md §5.1 names only the two phrases
*Pair your reMarkable* and *your reMarkable*.

Without this task, the reader's *Pair with your account* points at an address
that opens nothing, and the reader milestone (`tasks/99-milestones.tji` L60)
cannot close.

## Inputs / context

- `docs/remarkable-reader.md`:
  - §5.1 (L308–325): the three calls, read-only by scope, ten minutes,
    single-use, rate-limited;
  - §4 (L244): one locale on the reader;
  - §10 (L546–553): the session is revocable from the account.
- `docs/workflows/19-remarkable-reader.md` §Pairing (L100–): the reader's
  copy. The board reproduces it only as the code that the phone's field
  receives.
- `docs/workflows/13-new-device.md`:
  - §Signing in, or making an account (L10–49): the one surface, with no
    entry choosing a door;
  - §The banner (L132–182): the rule for which screens carry the banner;
  - §The account screen (L270–316);
  - §Books that were only on the other device (L223–241).
- `docs/workflows/17-leaving.md`: deleting the account removes every session.
- `docs/DIRECTION.md` §3.3 (L156–168): the one origin `www.estantedecifras.app`,
  with the bare domain forwarding there.
- `docs/mockups/GUIDE.md`: a board's shape. It has two phones, a tablet and a
  computer (L4, L20), frames 390×844, 820×1180 and 1280×800 (L30), and one bar
  per screen since 2026-11-01 (L34).
- `docs/mockups/W13-new-device.dc.html`, Computer, L142–209: the account
  screen's Signed-in devices rows (L158–162, data L220–225). The new board
  draws its account screen to match.
- `docs/mockups/Recovery-email.dc.html` and `Sign-in.dc.html`: the precedent
  for a supplementary workflow 13 board.
- `tasks/refinements/design/recovery_email.md`: the precedent for this
  refinement's shape, where the workflow delta is written with the refinement
  and the board is left to the implementer.

## Constraints / requirements

- **What is decided is final.** The reader's pages (workflow 19 §Pairing) and
  §5.1's three calls are not reopened. The web page uses the reader's words
  where it names them: *Get a new code* and the code's look, `KQ7-4TM`.
- **No book without an account.** The page holds no token, and opening it
  grants nothing: only a signed-in session can approve a code. The page is
  `noindex` like everything served.
- **Accessibility**, for `reader.pair_web` to build and for the board to
  show:
  - React Aria `TextField` and `Button`;
  - each refusal said in words under the field, tied to it as its error
    message, with the focus kept in the field;
  - *Reads only* a word, never a colour;
  - the warning a line of text, not an icon.
- **No secrets in logs.** A code is a credential for ten minutes. The service
  never logs it (the note of `reader.device_pairing`). Under this decision,
  `/pair` carries no code in its URL, so request metadata cannot hold one.
- **Offline first.** Pairing needs the network, and the page says so in words.
  Nothing else waits on it.
- **The board follows GUIDE.md**: two phones, a tablet, a computer; one bar per
  screen; real copy from the workflow; no browser chrome; the reMarkable is
  not drawn as a device frame.

## Acceptance criteria

This is a **design task, with no code tests**. The `.tji` `Tests:` clause
says *"none — design deliverable (workflow 13 edits and its board)"*.

Acceptance is three things: what workflow 13 decides, what the board shows, and
the DIRECTION and workflow 19 deltas. Each must be concrete enough that the
named tests of `reader.device_pairing` and `reader.pair_web` can be written
against it.

1. **Workflow 13 decides** (written; the implementer keeps it and the board in
   step):

   - **Where it lives** (§Where it lives).
     - `estantedecifras.app/pair` opens the *Pair a device* page on any
       device. It holds no token.
     - *Pair a device* at the foot of Signed-in devices opens the same page.
     - The page is a deeper screen: **Back** goes to the account screen, or
       to the shelf when the address opened it. The banner sits above it.
     - *Pins:* the e2e-web test of `reader.pair_web`, which opens the page
       from the account screen, and the `/pair` route.
   - **Not signed in** (§Not signed in).
     - The one sign-in surface is drawn under the page's heading, with both
       doors, beneath *Sign in to the account whose books the reMarkable
       should read.*
     - Signing in there returns to the code step.
     - An emailed link opens the shelf.
   - **The page** (§The page).
     - It has one field, *Code* (hint *Six letters and numbers, like
       KQ7-4TM*). The field accepts any case, with or without a dash or
       spaces.
     - It says what the reMarkable will be able to do. *Read every book on
       your shelf, with your instruments and preferences* and *never change
       one* are worded there.
     - It warns: *Only enter a code shown on your own reMarkable…*.
     - Its one button is **Pair your reMarkable**. Nothing is checked before
       the press.
     - A malformed code is refused locally and nothing is sent.
     - Paired: *Your reMarkable is paired…* with **Done**, which opens
       Signed-in devices.
     - Offline: *You're offline. Pairing needs a connection.*, with the button
       disabled.
     - *Pins:* the `reader.pair_web` behavior test "a code approved".
   - **Refusals** (§A code that does not pair). *Unknown*, *expired*, *used*
     and *too many tries* each have their own words. Each is said under the
     field, which keeps the text and takes the focus.
     - *Pins:* the `reader.pair_web` behavior test "each refusal said", and the
       `reader.device_pairing` behavior test "an expired, a reused and an
       unknown code; the rate limit". That test must answer these four apart
       (see Decisions).
   - **Among the signed-in devices** (§Among the signed-in devices).
     - The row is *your reMarkable*, named by kind and never by a browser
       description, with *Reads only* as a word, last used, and **Sign out**.
     - Two reMarkables are two rows. The row is never *This device*, and never
       an *only on your …* line.
     - The sign-out dialog is *Sign your reMarkable out?*, with its own body.
       Account deletion signs the reader out too.
     - *Pins:* the `reader.device_pairing` statement "listed among its
       signed-in devices with its kind", and the `reader.pair_web` behavior
       test "the device listed" and its e2e-web test.
   - **The copy, in the four locales** (§The copy, in the four locales). A
     table holds every string above in en, pt-BR, es-419 and it, using the
     existing locale terms:
     - *Encerrar a sessão* / *Cerrar sesión* / *Esci* for sign out;
     - *estante* / *estantería* / *scaffale* for shelf.

     The reader's *Get a new code* stays in English in every locale, because
     the reader carries one locale. `reader.pair_web` adds these strings to
     `app/src/i18n/locales/*.js` from the table.
2. **Workflow 19 decides** (written, §Pairing L102–113):
   - A session signed out from the account is refused at the reader's next
     sync.
   - The reader then forgets the session, removes the books, and shows *Not
     paired* with *This reMarkable was signed out from your account.*
   - Rule 5 holds. A background refusal replaces the page only at the next
     page opened, and a song on screen stays readable until Back. A refusal
     met by *Sync* is shown in the redraw that ends it.
   - This falls to `reader.pairing`, whose note already makes *Sign out*
     remove the books and return to *Not paired*. Its refinement scopes the
     refused-session case and its tests from this text.
3. **The board** `docs/mockups/Pair-a-device.dc.html` exists, drawn to
   GUIDE.md: `board-num` *Workflow 13*, `board-title` *Pairing a reMarkable*,
   a `board-sub` of one or two sentences, two phones, a tablet and a
   computer. It shows:
   - **Phone 1**: `/pair` opened by the address, signed in. The bar shows
     Back and *Pair a device*. The page shows the intro, the *Code* field
     holding `kq7 4tm` as typed, the *What your reMarkable will be able to
     do.* block, the warning line, and **Pair your reMarkable**.
   - **Phone 2**: the same page with the **expired** refusal under the field,
     its text kept. A small inset or caption lists the other three refusals'
     words (unknown, used, too many tries), so all four are on the board.
   - **Tablet**: `/pair` opened **not signed in**. It shows *Sign in to the
     account whose books the reMarkable should read.* above the sign-in
     surface's two sections, drawn as `Sign-in.dc.html` draws them. Beside or
     below it, the **paired** confirmation *Your reMarkable is paired. Its
     shelf appears on it in a moment.* with **Done**.
   - **Computer**: the account screen. It is laid out as W13's Computer frame,
     with the rail and the full-width sections:
     - Signed-in devices lists *This device*, a phone, and **your reMarkable**,
       *Reads only · last used today*, with **Sign out**;
     - **Pair a device** is at the foot with its line;
     - the dialog *Sign your reMarkable out?* is open over the screen, with
       its body, **Sign out** and **Cancel**.
   - Status is carried by **words** (`.badge`), never colour alone. The board
     uses the theme's classes only: `.field`/`.input`, `.notice` for the
     refusal, `.badge` for *Reads only*. There is no fake status bar, and the
     reMarkable's screen is not drawn.
   - **Registration** (by the closer): a `boards["Pair-a-device.dc.html"]`
     entry `{ "x": 0, "y": 49580, "w": 3208, "h": 1500, "title": "13 & 19.
     Pairing a reMarkable" }`. Its `y` is the next free slot on the 1620
     stride after `Search-scope.dc.html` at 47960. The entry is appended to
     `order`, and no other board is touched.
4. **DIRECTION** (written):
   - §3.3 (L161–165): the forward keeps the path;
   - §6 (L624–634): the new bullet;
   - §7 is unchanged.
5. **No code tests, and none deferred.** The tests that pin these decisions are
   in the notes of `reader.device_pairing`, `reader.pair_web` and
   `reader.pairing`. They are named here as the handshake, not as a deferral.
6. **No deferred WBS follow-up.** Everything decided falls inside the three
   existing build tasks:
   - the session's kind and read-only mark, and the four distinct refusals, in
     `reader.device_pairing`;
   - the page, the row and the `/pair` route on the service's `linkRoutes` or
     `appRoutes` (`service/internal/server/app.go` L57–70), in
     `reader.pair_web`;
   - the refused session on the reader, in `reader.pairing`.

## Decisions

### One page, confirmed by its button, with no lookup before the press

**Chosen:** the field, what the device can do, the warning and **Pair your
reMarkable**, all on one page. The code is checked only when the button is
pressed.

**Rejected:** a code step, then a separate confirmation step reached after the
service has looked the code up. That needs a fourth call, a lookup, which
§5.1 does not have and which would answer "is this a live code?" without
approving it. It would also add a second screen to a ten-minute window. The
note asks for "its one page". The button's label is itself the confirmation
§5.1 names.

### Sign in first, then the code

**Chosen:** a signed-out visitor sees the sign-in surface on the page.

**Rejected:** taking the code first and signing in after. The approve call
needs a session, and checking a code without one would be an oracle for
strangers. Holding a typed code across an emailed-link sign-in, which may open
in another tab or on another device, would mean carrying the code in a URL or
in storage. Instead the reader's *Get a new code* is always at hand.

### The address carries no code, and the reader shows no QR code

**Chosen:** `/pair`, typed, then the code, typed.

**Rejected:** `/pair/KQ7-4TM` or a QR code on the reader. Workflow 19 already
decided the reader's page, without a QR code. A code in a path reaches request
logs and browser history, and the standing rule keeps secrets out of logs.
Typing six characters costs little.

### A warning against an entered stranger's code

**Chosen:** one plain line where the code is typed: *Only enter a code shown on
your own reMarkable, in front of you…*.

**Why:** device-code pairing has a known phishing shape. Someone begins a
pairing on their own device, sends the code to a victim, and is approved. The
read-only scope limits the damage to reading, and a stranger reading a
person's books is exactly what *No book without an account* forbids.

**Rejected:** a confirmation dialog, which adds friction without new
information, and nothing at all.

### The four refusals are told apart

**Chosen:** *unknown*, *expired*, *used* and *too many tries* each get their
own words.

**Why:** each needs a different next step on the reader: check the code, press
*Get a new code*, check whether the device is paired, or wait.

**Constraint on `reader.device_pairing`:** approve answers the four as
distinct problem types. The cost is that "expired" and "used" reveal that the
code existed. That is harmless: the attempt already needs a signed-in session,
it is rate-limited, and the code is dead.

### The code leaves out 0, O, 1, I and L, and the field forgives case and separators

**Why:** the field's tolerance and the hint *Six letters and numbers* depend
on it. The look `KQ7-4TM` is the reader's, with three and three around a dash.
The alphabet is scoped to `reader.device_pairing` from workflow 13 §The page.

### The reader's row is named by kind, and marked *Reads only*

**Chosen:** the row reads *your reMarkable*, in the device-kind naming of
workflow 13 L237–241, not the `device` User-Agent description that other rows
show. The reader has no browser, so a User-Agent description would read as
"Go-http-client". *Reads only* tells the person what this session can do and
why it differs from the rest.

**Constraint on `reader.device_pairing`:** `Session` gains a kind (at least
`remarkable`) and the read-only mark, via the API contract.

**Rejected:**
- a user-typed name, which workflow 13 never uses for devices;
- the device's serial number, which identifies the device.

### Signed out from the account: books removed, said once on the reader

**Chosen:** a reader whose session is refused removes the books and says
*This reMarkable was signed out from your account.* (workflow 19 delta).

**Why:** a revoked reader has no paired screens left to show, and its own
*Sign out* already removes the books. Unlike a phone, it holds nothing of the
person's own making to protect. A signed-out lost or lent reMarkable is
emptied.

**Rejected:** keeping the books readable offline after revocation. It would
contradict the read-only session's revocability (§10) and leave books on a
device the account has disowned.

**Rule 5:** the redraw waits for the next page opened.

### One new board, not more frames on W13

W13's four frames are full: sign-in, the shelf filling, merge, and the account
screen. The precedent is `Recovery-email.dc.html` and `Sign-in.dc.html`, a
supplementary board titled by its workflows.

### The bare domain's forward keeps the path (DIRECTION §3.3)

The reader shows `estantedecifras.app/pair`, the short address and the one
easiest to type. It only works if the registrar's forward to `www` keeps the
path, so DIRECTION now says it does. Configuring the registrar is a human's
job. It is surfaced for the parking lot, not as a WBS task. The e2e stack
serves the app directly and does not depend on it.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-11-02.

- Board drawn: `docs/mockups/Pair-a-device.dc.html` (*Workflow 13 · Pairing a reMarkable*): phone `/pair` signed in with a code typed, then the expired refusal (and the unknown / used / too-many-tries wording); tablet `/pair` not signed in, paired confirmation, offline state; computer account screen with *your reMarkable* (*Reads only*), **Pair a device**, and the sign-out dialog.
- Registered in `docs/mockups/canvas.json` (y 49580, last in `order`); not rendered — republishing is in `tasks/parking-lot.md`.
- Workflow 13 §Pairing a reMarkable decided in `docs/workflows/13-new-device.md`; reader side in `docs/workflows/19-remarkable-reader.md`; `docs/DIRECTION.md` §3.3 and §6 updated.
- Two choices on the board: the Help icon is new (no earlier board draws Help); the computer's first device row reads *This device*, as the app does.
- No tests (design task); the tests belong to `reader.device_pairing`, `reader.pair_web`, `reader.pairing`.
- `tasks/85-reader.tji`: `reader.pair_design` marked `complete 100`; `reader.m7_reader` still waits on the other reader tasks.
