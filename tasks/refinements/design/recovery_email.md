# Refinement — `design.recovery_email`

## TaskJuggler

[`tasks/20-design.tji`](../../20-design.tji), `task recovery_email "Setting a
recovery email; deleting a passkey-only account"` (line 56):

> Decide and draw where a signed-in person sets, verifies (by an emailed link)
> and changes the recovery email that service.email_links mails — nothing
> writes accounts.email today, so a passkey-only account has no recovery path.
> And how a passkey-only account (no email) confirms deletion: a passkey
> re-authentication in place of the typed email (workflow 17). Workflows 13,
> 17. Source: tasks/parking-lot.md 2026-10-14 (Where accounts.email is first
> written; Passkey-only account cannot confirm deletion). Tests: none — design
> deliverable (workflow 13 and 17 edits and the boards).

## Effort estimate

1d (as the `.tji` gives it). The workflow text is written (below, the deltas);
the bulk of the day is the board.

## Repository

estante-de-cifras, **not** `cifra.md/` (the note does not start with
`cifra.md:`). Files:

- `docs/workflows/13-new-device.md` — edited (delta, written with this
  refinement).
- `docs/workflows/17-leaving.md` — edited (delta, written with this
  refinement).
- `docs/DIRECTION.md` — §3.3, §3.6 and §6 edited (delta, written with this
  refinement).
- `docs/mockups/Recovery-email.dc.html` — **new** board (the implementer
  draws it).
- `docs/mockups/canvas.json` — the board registered (the closer, per the
  refinements' precedent; GUIDE.md tells a board writer not to edit it).

No code, no `api/` change: `api/openapi.yaml` is extended by
`service.recovery_email`, which builds what this decides.

## Inherited dependencies

The task has no `depends` in the WBS. What it builds on is all settled
(`complete 100`):

- `service.email_links` — the emailed sign-in link: `POST
  /api/auth/email/request` / `redeem` (`api/openapi.yaml:166-209`), the
  `email_login_links` table, the 15-minute single-use HMAC token
  (`service/internal/emaillink/token.go:26`), the mail
  (`service/internal/mail/message.go`), the per-address and per-IP caps
  (`service/internal/ratelimit/ratelimit.go:51-66`).
- `service.passkeys` — account creation by passkey with `email` NULL
  (`service/internal/server/passkeys.go:28`, `:513` `INSERT INTO accounts
  (id)`), the authenticate begin/finish pair (`api/openapi.yaml:117-160`), and
  passkey removal (`passkeys.go:392`, unguarded).
- `account.account_screen`, `account.leaving`, `design.leaving` — the account
  screen (`app/src/account/AccountScreen.jsx`), the Leaving Estante region and
  its type-the-name delete (`app/src/account/LeaveDialogs.jsx:305-314`),
  `DELETE /api/account` (`service/internal/server/account.go:34-148`).

Downstream, waiting on this task: `service.recovery_email`
(`tasks/30-service.tji:84`) and `account.recovery_email`
(`tasks/70-account.tji:49`), both "as design.recovery_email decides"; and the
W07 *Mine on Estante* "No passkey here? Email me a link" offer
(`books.add_book_chooser`, `tasks/65-books.tji:142`), which only reaches
someone once an account can hold an email.

## What this task is

Decide, in workflows 13 and 17, and draw on one board: (1) where and how a
signed-in person sets, confirms by an emailed link, and changes the recovery
email the sign-in link goes to; and (2) how an account without an email
confirms its own deletion — a fresh passkey confirmation in place of the typed
name. Plus the one adjacent hole the first question exposes: a passkey-only
account can today remove its last passkey and lock itself out for good.

## Why it needs to be done

Nothing in the service writes `accounts.email`: the only insert is
`INSERT INTO accounts (id)` (`passkeys.go:513`). So every real account has a
NULL email, and the emailed link — workflow 13's fallback and its *only*
recovery path (`docs/workflows/13-new-device.md:25-31`) — can reach nobody
(`email_links.go:123-149` looks the address up and mails nothing on a miss).
And `DELETE /api/account` compares a typed `confirm` to that NULL email, so it
fails closed with 400 for every account (`account.go:~70-77`, pinned by
`TestDeleteAccountNullEmailFailsClosed`, `account_test.go:146-160`): no real
account can be deleted. Both were parked on 2026-10-07 and 2026-10-13
(`git show 799f87d^:tasks/parking-lot.md`, lines 218-221 and 258-262) and
turned into this task plus the two build tasks above.

## Inputs / context

- **Workflow 13** — `docs/workflows/13-new-device.md`: §Signing in on another
  device (the *Neither* case, L25-31, now naming the recovery email); §The
  recovery email (L32-69, new); §The last way in (L70-76, new); §The account
  screen (L117-139, Passkeys and the new Recovery email region); §Later
  (L148-, two new entries).
- **Workflow 17** — `docs/workflows/17-leaving.md`: §Deleting the account
  (L50-69, the confirm now "its recovery email … or … a passkey"); §An account
  with no email (L70-93, new); §The cascade (L141-, the call carries the typed
  name or the passkey confirmation); §Edge cases (L178-201, two new).
- **DIRECTION** — §3.3 rate limits (L200-209, the verification link joins the
  mail-sending requests); §3.3 L164-169 (commits carry the no-reply address,
  never the real email — why the address is never in history); §3.6 The API,
  Signing in (L374-381); §6 (L582-, the new decided-and-drawn bullet).
- **The app today** — `AccountScreen.jsx:30` "shows no email … Account is only
  `{ id }`" (account_screen Decision 5); `LeaveDialogs.jsx:16` "the app never
  holds the address"; the sign-in surface's *Email me a link*
  (`app/src/account/SignIn.jsx:250-299`). No endpoint returns the email; the
  `Account` schema is `{ id }` (`api/openapi.yaml:962-969`).
- **Boards** — `docs/mockups/W13-new-device.dc.html` (phone: sign in and the
  shelf; tablet: two *My songs*; computer: the account screen and sign-out) and
  `docs/mockups/W17-leaving.dc.html` (phone: Leaving Estante and data out;
  tablet: a member's shelf after the owner left; computer: the type-the-name
  delete). Both fill their four frames. `docs/mockups/GUIDE.md` (structure,
  devices, tokens, the cast), `docs/mockups/theme.css`,
  `docs/mockups/README.md`. `docs/mockups/canvas.json`: the last board is
  `W17-leaving.dc.html` at `y: 31580` on the 1620 stride.
- **Predecessor refinements** — `tasks/refinements/design/leaving.md` (shape,
  the type-the-name confirm as the house pattern for terminal actions, the
  delete needing a connection), `theme_picker.md` (a supplementary board that
  places a decision of an existing workflow, without a new workflow).

## Constraints / requirements

- **The address belongs to its owner only.** Never in a book's history (the
  no-reply author stays, DIRECTION §3.3 L164-169), never in the home book,
  never logged by the service (standing rule), never echoed by a request
  answer that would tell whether an address has an account
  (`requestEmailLink`'s always-202 precedent, `openapi.yaml:171-173`).
- **Accessibility** for what the board draws and the build implements: every
  state said in words (*No recovery email*, *Waiting for you to confirm*,
  *Confirmed*, *Not deleted*), never colour alone; real buttons and labelled
  fields; React Aria in the build.
- **Offline first, with the bounded exception.** Setting, changing, and
  deleting need a connection — account-lifecycle state lives only on the
  service, like signing in (workflow 17 §Offline). The region says so offline.
- **No book without an account** is untouched: the verification link opens no
  book and starts no session.
- **The board** follows `docs/mockups/GUIDE.md` exactly: W02's head and
  helmet, 3208×1500, two phones, a tablet, a computer, only `var(--…)` tokens,
  the cast (Ana / *Choros da Ana*, *Banda do Bairro*, *My songs*), invented
  addresses on `example.com`.

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` `Tests:` clause is
*"none — design deliverable (workflow 13 and 17 edits and the boards)"*).
Acceptance is what the workflow documents decide, what the board shows, and
the DIRECTION deltas — concrete enough that `service.recovery_email`'s and
`account.recovery_email`'s named tests can be written against them.

1. **Workflow 13 decides** (written with this refinement; the implementer
   checks it against the board and keeps the two in step):
   - an account starts with a passkey and **no email**; the recovery email is
     the one address held, used only to mail the sign-in link (§The recovery
     email) — *pins `service.recovery_email`'s e2e-api "set, verified, then
     used for an emailed sign-in"*;
   - **setting** it: an address typed on the account screen, a verification
     link mailed, the address written **only when the link is opened**; the
     link single-use, fifteen minutes, a new request replacing the old —
     *pins `service.recovery_email`'s unit (token rules) and behavior (set,
     verify)*;
   - **confirming** it: the link opens the app's own page on any device, says
     *Your recovery email is confirmed*, and **does not sign in**; expired or
     used says so — *pins `account.recovery_email`'s behavior and the e2e-web
     "verified via the mail catcher"*;
   - **changing** it: the current address stays in effect until the new one is
     confirmed; the old address then gets a link-less notice — *pins
     `service.recovery_email`'s behavior (change)*;
   - **one account per address**: the request always says *check your inbox*;
     an address held by another account is refused only on opening the link;
   - **offline**: the region says it needs a connection;
   - **the last way in**: no confirmed recovery email ⇒ the last passkey cannot
     be removed, worded *your only way to sign in — add a recovery email or
     another passkey first* (§The last way in) — *a guard both
     `service.recovery_email` (refuse the DELETE of the last passkey) and
     `account.recovery_email` (the worded refusal) pick up*;
   - the account screen's **Recovery email** region below Passkeys, its three
     states in words (none / waiting for you to confirm / confirmed), the
     address shown to its owner there and nowhere else, signed-in only;
   - *Later*: removing the email outright; prompting for one unprompted.
2. **Workflow 17 decides** (written with this refinement):
   - an account **with** a recovery email confirms deletion by typing it,
     unchanged;
   - an account **without** one gets the same dialog with the typed field
     replaced by *This account has no email. Confirm with one of your passkeys
     to delete it.*; **Delete my account** asks for a passkey through the
     browser's prompt; the deletion goes only with that fresh confirmation,
     minted for this deletion and short-lived (§An account with no email) —
     *pins `service.recovery_email`'s behavior "delete a passkey-only account
     by passkey, a wrong or stale assertion refused" and `account.recovery_email`'s
     e2e-web "a passkey-only account deleted with a virtual authenticator"*;
   - cancelled ⇒ *Not deleted — the passkey was not confirmed*, the dialog
     open; refused ⇒ *That passkey did not confirm this account. Try again.*;
   - a passkey-only account is never made to set an email in order to leave;
   - edge cases: no passkey reachable on this device; an email set but not yet
     confirmed still confirms by passkey.
3. **The board** `docs/mockups/Recovery-email.dc.html` exists, drawn to
   GUIDE.md: `.board-head` *Workflows 13 & 17 · The recovery email*, a
   `board-sub` of one or two sentences, two phones, a tablet, a computer. It
   must show:
   - **Phone 1** · the account screen scrolled to Passkeys and **Recovery
     email** in its *none* state: the warning line in words, the *Recovery
     email* field, **Send a verification link**; the last passkey's Remove
     replaced by *your only way to sign in…*;
   - **Phone 2** · the *waiting for you to confirm* state naming the address
     (e.g. `ana@example.com`), **Send again**, **Use a different address**;
   - **Tablet** · the verification link opened: the app's confirmation page
     *Your recovery email is confirmed*, with — as a second panel or inset —
     the account screen's *Confirmed* state (address, a *Confirmed* badge,
     **Change**);
   - **Computer** · the delete-account dialog for an account with no email:
     the same blast radius and counted warnings as W17, *This account has no
     email. Confirm with one of your passkeys to delete it.*, **Delete my
     account**, *Take your data out first*; and the *Not deleted — the passkey
     was not confirmed* alert;
   - status carried by a **word** (`.badge`), never colour alone; the browser's
     own passkey prompt is not drawn (it is the browser's, as W13 leaves it).
   - Registration: a `boards["Recovery-email.dc.html"]` entry `{ x: 0, w: 3208,
     h: 1500, title: "13 & 17. The recovery email" }` at the next free `y` on
     the 1620 stride after the last board when it lands (`33200` today, after
     W17 at `31580`), appended to `order` — by the closer. No other board is
     touched.
4. **DIRECTION** (written with this refinement; same commit): §3.3 the
   verification link among the mail-sending, rate-limited requests (L200-209);
   §3.6 The API's Signing-in bullet names the recovery email and the passkey
   confirm (L374-381); §6 the new *The recovery email, decided and drawn*
   bullet (L582-). §7 is unchanged: no new workflow.
5. **No code tests, and none deferred.** The tests that pin these decisions
   are `service.recovery_email`'s and `account.recovery_email`'s, named in
   their `.tji` notes — named here as the handshake, not a deferral.
6. **No deferred WBS follow-up.** The last-way-in guard is decided here and
   falls inside the two existing build tasks ("as design.recovery_email
   decides"); their refinements scope its tests.

## Decisions

### The recovery email lives in its own region of the account screen, below Passkeys

**Chosen:** a *Recovery email* region after Passkeys and before Leaving
Estante — it backs up the passkeys, so it sits with them; three states in
words. **Rejected:** asking for an email at first run (workflow 1 asks for
nothing, and a required address before the first song contradicts the
first-run promise); putting it inside the sign-in surface (that surface is for
signing in, before there is an account to attach to); a separate settings
screen (one account screen is decided, workflow 13).

### The address is written only when the link is opened

**Chosen:** verify-then-write, as the service note already says. **Rejected:**
write-then-verify (an unverified address would receive sign-in links: a typo
sends account access to a stranger's inbox, and a squatter could claim
someone's address). The verification token reuses `email_login_links`' shape
(single-use, 15 minutes, HMAC-signed id) — how is `service.recovery_email`'s
call.

### The verification link confirms and does not sign in

**Chosen:** a link that only confirms. **Rejected:** a link that also signs in
(it would be a second sign-in link minted by a signed-in session, so a stolen
session could mint itself a durable way back in on any device; and the device
opening it may not be the person's). Keeping it inert makes it safe to open
anywhere.

### On change, the old address stays until the new one is confirmed, and is told

**Chosen:** keep the old in effect; a link-less notice to it on confirmation.
**Rejected:** clearing the old address at request time (a mistyped new address
leaves no way back); no notice (a hijacked session could swap the recovery
address silently — the notice is the one cheap signal the owner gets).

### An address held by another account is refused only at the link

**Chosen:** the request always answers *check your inbox*; the refusal shows
only to the one who opened the link. **Rejected:** refusing at request time
(it would tell anyone signed in whether an address has an Estante account —
the enumeration `requestEmailLink` was built to avoid); silently moving the
address between accounts (it would take recovery away from the other account).

### The account screen shows its owner the address

**Chosen:** the recovery-email region reads and shows the address to the
signed-in owner — a deliberate change from account_screen Decision 5 (*shows
no email*, `AccountScreen.jsx:30`), which held because there was no email to
show. **Rejected:** a masked address (`a••@example.com`) — the owner needs to
see exactly where recovery would go to catch a typo; the session is theirs and
the origin one. Still never logged, never in the home book. The typed-name
delete keeps comparing server-side (`LeaveDialogs.jsx:16`), so the confirm
field does not prefill it.

### A passkey-only account confirms deletion with a fresh passkey

**Chosen:** the same dialog, the typed field replaced by a passkey
confirmation minted for the deletion. **Rejected:** requiring a recovery email
before deletion is offered (it makes leaving cost an address the person chose
not to give); a passkey confirm for every account (changes a decided,
built flow, and type-the-name is the house pattern for terminal actions, W17
and the book delete); deleting on the session alone (a terminal cross-user
action with no confirm a borrowed, still-signed-in device could fire).

### The last way in cannot be removed

**Chosen:** without a confirmed recovery email, the last passkey's Remove is
refused, in words. **Rejected:** leaving removal unguarded as today
(`passkeys.go:392`) — a passkey-only account removing its only passkey is
locked out for good, the very loss this task exists to close; a confirm-only
warning (one tap still locks the person out). It rides in the existing build
tasks rather than a new WBS leaf because it is the same decision's edge.

### One new supplementary board, not more frames on W13 and W17

**Chosen:** `Recovery-email.dc.html`, the Theme-picker / Screen-reader
precedent: a board that draws decisions of existing workflows. **Rejected:**
redrawing W13 and W17 (both fill their four frames with their own journeys;
GUIDE.md fixes the board size); a new workflow 18 (nothing here is a new
journey — it is workflow 13's account screen and workflow 17's dialog).

## Open questions

(none — all decided.)

Surfaced for the parking lot (human product judgment, not WBS tasks):

- **Removing the recovery email outright** — going back to passkey-only on
  purpose. Put in workflow 13 §Later; whether to offer it is a privacy-vs-safety
  product call.
- **Prompting for a recovery email** after a first sign-in or a new passkey,
  rather than leaving it to the account screen — workflow 13 §Later; a nudge
  frequency is a product call.

## Status

_pending implementation_

## Status

**Done** — 2026-10-15.

- New board `docs/mockups/Recovery-email.dc.html`: no-email state with warning, field and **Send a verification link** (last passkey's Remove replaced by "Your only way to sign in…"); *Waiting for you to confirm* with **Send again** / **Use a different address**; the "Your recovery email is confirmed" page; the *Confirmed* state with **Change**; the W17 delete dialog confirmed by passkey for an account with no email, with its "Not deleted — the passkey was not confirmed" alert.
- Board registered in `docs/mockups/canvas.json` (`Recovery-email.dc.html`, y 33200, appended to `order`).
- Workflow decisions in `docs/workflows/13-new-device.md` and `docs/workflows/17-leaving.md`, and `docs/DIRECTION.md` §3.3, §3.6, §6, written with the refinement and checked against the board.
- The board was not rendered (only checked: tags balanced, no hard-coded colours); republishing the canvas is parked.
- Tests: none — design deliverable. The tests pinning these decisions belong to `service.recovery_email` and `account.recovery_email`.
