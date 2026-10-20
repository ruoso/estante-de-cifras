# Refinement — `design.sign_in_two_doors`

## TaskJuggler

[`tasks/20-design.tji`](../../20-design.tji), `task sign_in_two_doors "Sign in
and make an account as two doors"` (line 81). The note, in short (quoted where
it pins words):

> Decided 2026-10-19 (launch smoke test): the sign-in surface has two sections,
> every entry opening the same surface — *Already have an account?* (use a
> passkey, or email me a link) and *New here?* (make an account, which creates
> a passkey). […] Making an account then asks for the recovery email straight
> away […]; this reverses workflow 13's an account starts with no email and the
> first run asks for nothing. It can be left for later (*Not now*) […] but while
> a signed-in account has no confirmed recovery email a fixed banner in the
> shell says that […] — not dismissible, shown on every screen until the
> address is confirmed (a pending, unconfirmed address keeps it), opening the
> account screen's recovery-email region. […] decide where it sits beside the
> header chrome and the update-ready notice, and how it reads in Palco and to a
> screen reader. The Account screen's not-signed-in card […] becomes one entry
> into the shared surface […]. English copy pinned by the human 2026-10-19
> (translate it into pt-BR, es-419 and it; do not reword the English) […].
> Decide where the invited screen's two buttons land, and draw it. Workflows 1
> (Cold, Invited), 13 (Signing in, The recovery email). Tests: none — design
> deliverable (workflow 1 and 13 edits and the W13 and W01 boards, the banner
> drawn on a phone, tablet and computer).

The pinned English copy (verbatim, not to be reworded):

| Where | Copy |
|---|---|
| Account card button / its line | *Sign in or make an account* / *Bring your books to this device, or start keeping them on Estante.* |
| First-run row / its line | *Sign in or make an account* / *Bring back your shelf, or start one on Estante.* |
| Section 1 | *Already have an account?* — **Use a passkey**, **Email me a link** |
| Section 2 | *New here?* — **Make an account**, line *Makes a new account with a passkey. Already have one? Sign in above. This would be a second, separate account.* |
| Step after making an account | *Add a recovery email* — **Send link**, **Not now** |
| Banner | *No recovery email yet. If you lose your passkeys, you lose this account and your books on Estante.* — **Add one** |

## Effort estimate

0.5d as the `.tji` gives it, likely nearer 1d: the workflow text is written
(the deltas below, with this refinement), but the drawing touches three
boards — four frames redrawn in place on W01 and W13 and one new
supplementary board (Decision *One new supplementary board*). If it runs
over, that is the board, not more deciding.

## Repository

estante-de-cifras, **not** `cifra.md/` (the note does not start with
`cifra.md:`). Files:

- `docs/workflows/01-first-run.md` — edited (delta, **written with this
  refinement**): §Cold (the row, L25-30), §Invited (the two sections, L53-63).
- `docs/workflows/13-new-device.md` — edited (delta, **written with this
  refinement**): new §Signing in, or making an account (L10-40); §Signing in
  on another device, *Neither* (L56-61); §The recovery email intro (L65-71)
  and *Setting it* (L76-78); new §Asked when the account is made (L106-120)
  and §The banner (L122-159); §Later (the *Asking for a recovery email
  unprompted* entry removed — the step and the banner decide it).
- `docs/DIRECTION.md` — §6 (delta, **written with this refinement**): the
  recovery-email bullet now says a new account is asked for an address at
  once (L605-613), and a new *Signing in, or making an account* bullet
  (L629-639). §7 unchanged: no new workflow.
- `docs/mockups/W01-first-run.dc.html` — frames 1, 2 and 4 redrawn in place
  (the implementer).
- `docs/mockups/W13-new-device.dc.html` — frames 1 and 2 redrawn in place
  (the implementer).
- `docs/mockups/Sign-in.dc.html` — **new** board (the implementer).
- `docs/mockups/canvas.json` — the new board registered (the closer, per the
  refinements' precedent; GUIDE.md tells a board writer not to edit it).

No code, no `api/` change, no locale file: the build is
`account.sign_in_two_doors` (`tasks/70-account.tji:71`), which implements this
"as design.sign_in_two_doors decides" and translates the pinned copy.

## Inherited dependencies

The task has no `depends` in the WBS. What it builds on is all settled
(`complete 100`):

- `design.recovery_email` — the recovery email, its three states and the
  *last way in* (workflow 13 §The recovery email,
  `docs/mockups/Recovery-email.dc.html`), whose Decision 1 rejected asking
  at first run; this task reverses that in part (Decision *The recovery email
  is asked right after making an account*).
- `account.sign_in`, `account.first_run`, `account.recovery_email`,
  `books.add_by_link` — the surface, the cold row, the region and the invited
  screen as built (Inputs).

Downstream, waiting on this task: `account.sign_in_two_doors`
(`tasks/70-account.tji:71-75`, depends on this), and through it milestone M3
(`tasks/99-milestones.tji:32`).

## What this task is

Decide, in workflows 1 and 13, and draw: (1) one sign-in surface with two
sections — *Already have an account?* and *New here?* — opened the same way
from every entry, including where the invited screen's two buttons land;
(2) the *Add a recovery email* step right after making an account, with
*Not now*; and (3) the non-dismissible banner a signed-in account without a
confirmed recovery email sees on every screen — where it sits beside the
header chrome and the update-ready notice, how it reads in Palco and to a
screen reader.

## Why it needs to be done

The launch smoke test (2026-10-19) could not make the first account on a
browser that already held a local book. Making an account is reachable only
from the cold first run — whose row reads *Sign in* but runs the create
ceremony (`AppShell.jsx:992`/`:1018` `setSignIn({intent:'create'})`,
`FirstRun.jsx:147-152`, `SignIn.jsx:168-191`) — and from an invitation. The
Account screen (`AppShell.jsx:800`) and *Mine on Estante* (`AppShell.jsx:293`
`signInMine`) open sign-in only, so once the shelf is not empty there is no
way to make an account, and the browser answers there is no passkey for the
site. The surface itself draws the same copy for both intents (heading *Sign
in*, `en.js:784-822`), so neither the person nor the app can tell the doors
apart. And a signed-out create always makes a new account
(`service/internal/server/passkeys.go:96-103` mints an account id with no
session, `:168-199` → `createAccountWithPasskey` `:536`): a person with an
account who presses the cold row on a new device silently gets a second one.
Meanwhile every new account starts with its one passkey as its only way back
in; the recovery email waits on the account screen, where nobody is sent.

## Inputs / context

- **Workflow 1** — `docs/workflows/01-first-run.md`: §Two ways in (L7-16,
  *neither door asks anything before showing something*), §Cold (L18-33),
  §Invited (L46-87: the invited screen names no book before sign-in; a
  refusal is a dialog over the shelf, *empty for someone who has just made
  their account*, W01 computer frame), §The instrument (the header row:
  wordmark, chip, account affordance, L93-97).
- **Workflow 13** — `docs/workflows/13-new-device.md`: §Signing in on another
  device (the three cases, the emailed link as the *Neither* case); §The
  recovery email (setting, confirming, changing, one account per address,
  offline); §The last way in; §The account screen (the Recovery email region's
  three states; the computer rail's *not signed in, the way to sign in*);
  §Later.
- **Workflow 7** — *Mine on Estante*'s *No passkey here? Email me a link*, a
  press that names the email step (`BooksScreen.jsx:418-429`).
- **Workflows 8 and 12** — reading full screen (`08-sync.md:53`, a setlist's
  *Play* `12-setlists.md:65`), where the chrome steps aside.
- **DIRECTION** — §3.7 *Installed, and updated on the next launch*
  (`docs/DIRECTION.md:479-486`: the new version never replaces a running
  session; the middle of a performance is the worst moment for anything to
  move); §3.6 The API, Signing in (L389-395); §6 (L567-).
- **The app today** (`app/src/`):
  - `shell/AppShell.jsx` — `signIn` state `{intent, step?, token?,
    forInvite?}` (:286); `signInMine(step)` (:293, sign-in intent only); the
    surface rendered ahead of everything (:761-785); the Account screen's
    `onSignIn` ignoring which button was pressed (:800); the invited screen's
    `onMakeAccount` / `onSignIn` (:812-818); `HeaderChrome` at the head of the
    rail (:978, `side-head`) and on a phone above the destination (~:1003,
    `instr-top`).
  - `account/SignIn.jsx` — steps `method` (:260), `email` (:286),
    `checkEmail` (:318), `redeeming` (:332), `offer` (:343); intent changes
    only the ceremony (:168-191); the stale prop comment (:94-96).
  - `account/AccountScreen.jsx:659-670` — the not-signed-in card's own *Use a
    passkey* / *Email me a link* pair (`onSignIn('passkey'|'email')`).
  - `account/InvitedScreen.jsx:122-138` — *You're invited to a book on
    Estante*, the *An account is a passkey* card, **Make an account** and
    **I have an account: sign in**.
  - `songs/FirstRun.jsx:134-158` — the four ways in; the *Sign in* row shown
    whether or not someone is signed in.
  - `account/RecoveryEmailRegion.jsx`, `account/recovery-email.js:14`
    (`none`/`waiting`/`confirmed`/`confirmed+waiting`) and the copy at
    `i18n/locales/en.js:971-990` — the strings the step reuses
    (`recoveryNoneWarn`, `recoveryLabel`, `recoveryHint`, `recoverySent`,
    `recoveryOnceNone`), and the generic *Done*.
  - `GET /api/account/recovery-email` → `{email, pending}`
    (`auth-client.js:290`): `email` non-null means confirmed — what the
    banner reads.
  - `pwa/UpdateReady.jsx` + `pwa/update-ready.css:6-16` — the update-ready
    notice: `.notice.accent` `role="status"`, fixed top centre, z-index 50,
    *Reload now* / *Dismiss*.
  - `theme/theme.css:247-275` (Palco tokens), `:354-364` (`.notice`,
    `.accent`, `.unsaved`, `.conflict`).
- **Boards** — `docs/mockups/W01-first-run.dc.html` (#1 phone cold L28-60,
  the *Sign in* row L46; #2 phone invited L62-85, buttons L79-80; #3 tablet
  song with *Playing on guitar — change?*; #4 computer empty shelf L142-196,
  *Sign in* card L165, refusal dialogs L171-192);
  `docs/mockups/W13-new-device.dc.html` (#1 phone *Sign in* L28-51 with the
  browser's passkey prompt as a sheet L39-50; #2 phone the shelf filling
  L53-90; #3 tablet two *My songs*; #4 computer account screen and sign-out);
  `docs/mockups/Recovery-email.dc.html` (the region's states drawn);
  `docs/mockups/GUIDE.md` (two phones, a tablet, a computer; 3208×1500; only
  `var(--…)` tokens; overlays last in `.dev`; the cast);
  `docs/mockups/canvas.json` (last board `Remove-from-shelf.dc.html` at
  `y: 36440` on the 1620 stride).
- **The e2e captures** that tie frames to their subjects (`e2e/web/lib/mockup.js`,
  frames by index in `e2e/web/lib/mockup-frames.json`): `first-run.spec.js:45`
  (W01 #1), `:105` (W01 #3); `share.spec.js:122` (W01 #2), `:336` (W01 #4);
  `new-device.spec.js:81` (W13 #1), `:94` (W13 #2), `:168` (W13 #3);
  `sign-out.spec.js:98`, `account-screen.spec.js:106` (W13 #4).
- **Predecessor refinements** — `tasks/refinements/design/recovery_email.md`
  (shape; the region; a supplementary board for decisions of existing
  workflows), `account/sign_in.md` (one multi-step surface, Decision 3; the
  passkey offer after an emailed sign-in, Decision 5), `account/first_run.md`
  (one string per door), `account/recovery_email.md` (the region's states and
  its offline note).

## Constraints / requirements

- **The pinned English is verbatim.** The workflows and the boards use it
  word for word; anything else the surface, step and banner say reuses copy
  that already exists (the region's strings, *Done*) — no new English beyond
  the pinned table. Translation into pt-BR, es-419 and it is the build's.
- **The workflows still say what the service does.** A signed-out create makes
  a new account, always; the design says so to the person rather than
  changing it (Decision *New here? warns rather than the service merging*).
- **Neither door asks anything before showing something** (workflow 1): the
  recovery email is asked only after someone chose to make an account.
- **Offline first.** The banner never claims what the device does not know;
  nothing in a song waits on it; the step and *Add one* need a connection,
  like signing in.
- **Accessibility**: each section a labelled group with a heading; the banner
  a labelled region, not a live region; its state in words, never colour
  alone; AA in Estante, Caderno and Palco; RAC in the build.
- **No book without an account** is untouched: the invited screen still names
  no book before sign-in.
- **The boards** follow `docs/mockups/GUIDE.md`, and a redrawn W01/W13 frame
  keeps the subject its e2e capture names (Inputs), so the screenshots stay
  comparable.

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` `Tests:` clause is
*"none — design deliverable (workflow 1 and 13 edits and the W13 and W01
boards, the banner drawn on a phone, tablet and computer)"*). Acceptance is
what the workflow documents decide, what the boards show, and the DIRECTION
delta — concrete enough that `account.sign_in_two_doors`'s named tests (its
`.tji` note: behavior for both sections from every entry, each ceremony, the
emailed-link step, the recovery-email step and its *Not now*, the banner with
no or a pending address and gone once confirmed, not dismissible, axe; e2e-web
for the account made and its email verified via the mail catcher, *Not now*
and the banner on every destination, the Account-screen path after a local
song, and the cold path with an existing passkey making no second account)
can be written against them.

1. **Workflow 13 decides** (written with this refinement; the implementer
   checks it against the boards and keeps the two in step):
   - **one surface, every entry the same** (§Signing in, or making an
     account): heading *Sign in or make an account*; *Already have an
     account?* (**Use a passkey**, **Email me a link**, the no-passkey note)
     above *New here?* (**Make an account** and its pinned line); opened from
     the cold row, the account card, *Mine on Estante*, the add-book sheet and
     the invited screen — *pins the build's behavior "both sections from every
     entry", and its e2e "from the Account screen after writing a local song"*;
   - **no entry picks a door**, and none skips the two sections — except a
     press that already names a step (*Mine on Estante*'s *Email me a link*)
     opening on the email step — *pins "the emailed-link step"*;
   - **making an account never joins an existing one**, and *New here?* says
     so in its line — *pins the e2e "signing in from the cold first run with
     an existing passkey makes no second account"*;
   - **Add a recovery email** right after *Make an account* and only then
     (§Asked when the account is made): the region's *none* warning, field and
     hint, **Send link** / **Not now**; after *Send link* the region's
     *waiting* words naming the address, with **Done**; *Done* and *Not now*
     go on to where the person was headed, which is already coming down
     behind the step — *pins "the recovery-email step after a create and its
     Not now", and the e2e "its recovery email set and verified via the mail
     catcher right after"*;
   - **the banner** (§The banner): pinned words; signed-in with no confirmed
     address, a pending one included; not dismissible; *Add one* to the
     region; on every screen, the account screen too; below the header
     chrome — phone between the header row and the destination, tablet and
     computer across the head of the main pane, beside the rail; not
     scrolling, taking its own room; the update-ready notice left as it is
     and never merged; hidden with the chrome reading full screen; the
     warning tone in each theme's tokens, Palco's included; a labelled
     region read once after the header, not a live region; not shown offline
     before the service has answered — *pins "the banner shown with no or a
     pending address and gone once confirmed, not dismissible" and the e2e
     "sees the banner on every destination until it confirms one"*;
   - the *Neither* case and §The recovery email's intro and *Setting it*
     agree with the above; §Later no longer lists asking unprompted.
2. **Workflow 1 decides** (written with this refinement):
   - §Cold: the row *Sign in or make an account* / *Bring back your shelf, or
     start one on Estante*, opening the one surface, **shown only while no one
     is signed in on the device**;
   - §Invited: the invited screen draws the surface's **two sections** under
     its own heading, in the surface's order and words — the two buttons
     *Make an account* and *I have an account: sign in* become them; making
     an account there is followed by the recovery-email step, the invitation
     accepted behind it, the book opening after *Done* or *Not now*.
3. **W01** (`docs/mockups/W01-first-run.dc.html`) redrawn in place, frames
   keeping their subjects:
   - **#1 Phone · cold start** — the third row reads *Sign in or make an
     account* / *Bring back your shelf, or start one on Estante*; nothing
     else changes;
   - **#2 Phone · invited** — heading, body and *An account is a passkey*
     card as today; below them, in place of the two buttons, *Already have an
     account?* with **Use a passkey** and **Email me a link**, then *New
     here?* with **Make an account** and its pinned line; the *Then the book
     goes on your shelf…* line kept;
   - **#4 Computer · refusal over an empty shelf** — the shelf of an account
     just made: three cards (no sign-in card), and **the banner** across the
     head of the main pane beside the rail (*No recovery email yet. …* —
     **Add one**), the refusal dialogs over it as today;
   - #3 Tablet unchanged.
4. **W13** (`docs/mockups/W13-new-device.dc.html`) redrawn in place:
   - **#1 Phone · the sign-in surface** — heading *Sign in or make an
     account*, the two sections as in item 1, the no-passkey note under
     *Email me a link*; the browser's passkey prompt sheet removed (it is the
     browser's, and covered the doors);
   - **#2 Phone · the shelf filling** — as today, with **the banner** between
     the header row (*Books*, the *Guitar* chip) and the *Home book restored*
     notice;
   - #3 and #4 unchanged.
5. **The new board** `docs/mockups/Sign-in.dc.html`, drawn to GUIDE.md:
   `.board-head` *Workflows 1 & 13 · Signing in, or making an account*, a
   one- or two-sentence `board-sub`; it must show:
   - **Phone 1 · the account screen, not signed in** — the Preferences above
     as on W13, and the card reduced to one **Sign in or make an account**
     button with *Bring your books to this device, or start keeping them on
     Estante.*;
   - **Phone 2 · Add a recovery email** — the step after *Make an account*:
     heading *Add a recovery email*, the *If you lose every device with a
     passkey, there is no way back in.* warning, the *Recovery email* field
     (`ana@example.com` typed) and its hint, **Send link** (primary) and
     **Not now** (quiet);
   - **Tablet · where the person was headed, with the banner** — *Choros da
     Ana*'s songs (the invitation's book) after *Send link* and *Done*: the
     rail with the header chrome at its head, **the banner** across the head
     of the main pane (a pending address keeps it), the update-ready notice
     drawn floating at the top centre over it, so the two are seen apart;
   - **Computer · Add one pressed** — the account screen's computer layout
     (rail; Preferences in two columns), **the banner** across the main
     pane's head, scrolled to the Recovery email region in its *Waiting for
     you to confirm* state naming `ana@example.com`, focus ring on the region;
   - status in words (`.badge`, the banner's own *No recovery email yet*),
     never colour alone; the banner in the `.notice.unsaved` warning tone;
     only `var(--…)` tokens, so the Palco tweak draws it in Palco's.
   - Registration: `boards["Sign-in.dc.html"] = { x: 0, y: 38060, w: 3208,
     h: 1500, title: "1 & 13. Signing in, or making an account" }`, appended
     to `order` — by the closer. No other board touched.
6. **DIRECTION** (written with this refinement; same commit): §6's
   recovery-email bullet amended, and the new *Signing in, or making an
   account* bullet. §7 unchanged.
7. **No code tests, and none deferred.** The tests that pin these decisions
   are `account.sign_in_two_doors`'s, named in its `.tji` note — named here as
   the handshake, not a deferral. `e2e/web/lib/mockup-frames.json` is
   regenerated by `audit/render-mockups.mjs` when the build next renders; no
   capture index moves (item 3-4 keep every subject).
8. **No deferred WBS follow-up.**

## Decisions

### One surface, two sections, the existing-account door first

**Chosen:** every entry opens the same surface, *Already have an account?*
above *New here?*. The order is fixed by the pinned line (*Sign in above*),
and it puts the door that loses nothing first: signing in to the wrong place
fails visibly; making an account by mistake succeeds silently. **Rejected:**
keeping the intent prop's two surfaces (the smoke test's failure — whoever
opens the wrong one has no way across); a toggle or tabs between *Sign in* and
*Create account* (hides one door behind the other, the very problem).

### New here? warns rather than the service merging

**Chosen:** the section says it makes a second, separate account and points
up. **Rejected:** having the service detect an existing account before
creating one — a signed-out device cannot know whose passkeys the browser
holds without asking for one, which is the sign-in door; and an account can
not be found by anything the person typed (no email asked before creating),
so there is nothing to match on.

### The invited screen's buttons become the sections

**Chosen:** the invited screen draws the two sections themselves, under its
invitation heading, so *Use a passkey* / *Email me a link* / *Make an account*
are one press from the invitation. **Rejected:** the two buttons each opening
the surface at their section (a second press for the same choice, and *Make
an account* there would show the *second, separate account* warning only
after the person already chose); a single *Continue* opening the surface (one
more screen between a link and the book).

### The cold row is offered only while signed out

**Chosen:** the empty shelf of a signed-in account offers the other three
ways. **Rejected:** keeping it (today's `FirstRun.jsx` shows it regardless) —
*Sign in or make an account* to someone signed in is a door to a second
account.

### The recovery email is asked right after making an account

**Chosen:** a step of the surface, after *Make an account* and never after a
sign-in, the region's own set-and-verify; *Send link* then *Done*, or *Not
now*. This reverses `design.recovery_email` Decision 1 in part: the first run
still asks nothing; the question comes once someone chose an account.
**Rejected:** asking before the passkey (an address typed before there is an
account to attach it to, and a form in front of a ceremony that takes
seconds); a sheet over the destination after the surface closes (the step is
part of making the account — on the surface it is one flow, and the
destination is not hidden behind a modal while it loads); asking after every
sign-in (the banner covers an existing account without one).

### After Send link, the step names the address and says Done

**Chosen:** the region's *waiting* words and a *Done*, all existing copy.
**Rejected:** moving on silently after *Send link* (the person would land
under a banner saying *No recovery email yet* with no sign the link went);
staying until the link is opened (it may be opened on another device, and
nothing should wait on a mailbox).

### The banner sits under the header chrome, in the main pane, taking room

**Chosen:** an in-flow strip below the header row on a phone and across the
head of the main pane on a tablet and a computer; it pushes content down and
does not scroll. **Rejected:** inside the header chrome (the header row is
three things already, and a phone's row has no room for a sentence); in the
rail (narrow, and out of the reading path of the screen); floating like the
update-ready notice (a floating thing that cannot be dismissed covers content
for good); at the bottom (the phone's tab bar is there, and a bottom strip
reads as transient).

### The update-ready notice stays separate

**Chosen:** unchanged — floating at the top centre, dismissible, and drawn
over the banner when both show. **Rejected:** merging them into one notice
area (one is dismissed, the other only answered; a stack would let a
dismissal look like it answered both).

### Full screen hides it

**Chosen:** reading full screen the banner goes with the chrome, back when the
person leaves full screen. **Rejected:** keeping it in full screen (DIRECTION
§3.7: the middle of a performance is the worst moment for anything to show);
this is the one place "every screen" yields, because full screen is a song
with the chrome put away, not another screen.

### A labelled region, not a live region

**Chosen:** a region named *No recovery email yet*, read once in reading order
after the header. **Rejected:** `role="status"` or `alert` (re-announced on
every screen change it would become noise, and it is not news — it is a
standing condition).

### Shown on the service's answer, not on a guess

**Chosen:** shown once `GET /api/account/recovery-email` answers with no
confirmed address; not shown offline before that. **Rejected:** a cached
answer from an earlier session (it would show a banner after the address was
confirmed elsewhere, or need storage the main thread may not touch);
showing it until proven otherwise (a confirmed account would see it on every
offline launch).

### One new supplementary board, plus in-place redraws

**Chosen:** W01 #1, #2, #4 and W13 #1, #2 redrawn in place, and a new
`Sign-in.dc.html` for the account card, the step, and the banner on a tablet
and at the account screen. **Rejected:** putting all of it on W01 and W13:
each board is four fixed frames, and every one of them is the subject of an
e2e capture (`mockup()` by index), so replacing a frame's subject would make
those screenshots compare against the wrong drawing. The precedent is
Theme-picker, Recovery-email and Leave-book: a board that draws decisions of
existing workflows.

## Open questions

(none — all decided.)

Surfaced for the parking lot (human product judgment, not WBS tasks):

- **The banner reads *No recovery email yet* while an address is pending.**
  The pinned copy and the *a pending address keeps it* rule together mean a
  person who just pressed *Send link* sees a banner saying they have none.
  The design follows the pinned words; whether the pending state should have
  its own wording (e.g. naming that the link is waiting) is the human's call
  on copy.
- **The effort** is likely nearer 1d than the 0.5d estimate (a third board).

## Status

**Done** — 2026-10-19.

- New board `docs/mockups/Sign-in.dc.html`: the account card as one entry into the sign-in surface, the *Add a recovery email* step (*Send link* / *Not now*), and the non-dismissible banner on a phone, tablet and computer; registered in `docs/mockups/canvas.json` (y 38060).
- `docs/mockups/W01-first-run.dc.html` frames 1, 2, 4 redrawn (cold row *Sign in or make an account*, invited screen landing on the two sections, banner on a computer).
- `docs/mockups/W13-new-device.dc.html` frames 1, 2 redrawn (two sections *Already have an account?* / *New here?*; browser passkey sheet removed; banner on a phone).
- `docs/workflows/01-first-run.md`, `docs/workflows/13-new-device.md` and `docs/DIRECTION.md` §6 carry the decision and the pinned English copy.
- Design task: no code tests; the code tests belong to `account.sign_in_two_doors`.
- Boards were not rendered; republishing the canvas is in `tasks/parking-lot.md`.

