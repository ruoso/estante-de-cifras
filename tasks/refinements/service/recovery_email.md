# service.recovery_email — Recovery email and passkey-confirmed deletion

## TaskJuggler

[`tasks/30-service.tji:84-89`](../../30-service.tji), `task service.recovery_email`
("Recovery email and passkey-confirmed deletion"). `depends !email_links,
!passkeys, design.recovery_email`, and so also the parent `service` task's
foundation dependencies. Downstream: `account.recovery_email`
(`tasks/70-account.tji:49-54`) builds the account-screen region, the
confirmation page and the passkey confirm in Leaving on the endpoints this
task adds; `books.add_book_chooser` needs a recovery email to exist for its
*No passkey here? Email me a link*.

## Effort estimate

`2d` (from the `.tji`). Three small endpoints for the recovery email (read,
request, confirm), one migration, two new mails, a passkey begin endpoint for
the deletion confirm, a second branch in `DELETE /api/account`, and a guard on
`DELETE /api/account/passkeys/{id}`. Everything rides existing seams — the
`emaillink` token, the `Mailer`, the `passkey.RP` state seal, the rate
limiter — so no new runtime dependency and no new configuration.

## Repository

**estante-de-cifras.** Not a cifra.md task (the note does not start with
`cifra.md:`). Service and contract only; the app side is
`account.recovery_email`. Directories:

- `api/openapi.yaml` — extended **first** (the note): the new paths, schemas
  and the changed `DeleteAccountRequest` / `removePasskey`.
- `service/internal/db/migrations/0007_recovery_email.sql` — the verification
  table (new).
- `service/internal/recoveryemail/` — the pure verification rules (new).
- `service/internal/mail/` — two new messages on the `Mailer`.
- `service/internal/passkey/state.go` — a purpose sealed into the state.
- `service/internal/ratelimit/ratelimit.go` — two new rules.
- `service/internal/server/` — `recovery_email.go` (new), `account.go`,
  `passkeys.go`, `server.go` (routes).
- `e2e/api/` — `recovery-email.test.js` (new), `account.test.js` (extended).

## Inherited dependencies

All **settled**:

- **`service.email_links`** (Done) — the signed-token module
  `service/internal/emaillink/token.go` (`LinkLifetime` :26, `NewID` :41,
  `Mint` :53, `Parse` :62, `CheckState` :91-123), the `email_login_links`
  table (`migrations/0002_email_links.sql:18-26`) and its atomic consume, the
  `Mailer` (`service/internal/mail/mail.go:21-26`, `message.go:7-32`),
  `requestEmailLink`'s always-202 rule, and `ESTANTE_LINK_SECRET`.
- **`service.passkeys`** (Done) — go-webauthn behind `passkey.RP`
  (`service/internal/passkey/passkey.go`: `StateTTL` 5 min :30, `Seal`/`Open`
  :118/:124), the HMAC-sealed stateless ceremony state
  (`passkey/state.go:36-57`), `UserFor` (`credential.go:124`), the Go software
  authenticator (`service/internal/webauthntest/authenticator.go`) and the JS
  one (`e2e/api/lib/authenticator.js:83`).
- **`design.recovery_email`** (Done, `tasks/refinements/design/recovery_email.md`)
  — workflow 13 §The recovery email and §The last way in, workflow 17 §An
  account with no email, the DIRECTION §3.6 API line, and the board
  `docs/mockups/Recovery-email.dc.html`. Its acceptance names this task's
  tests (`design/recovery_email.md:150-198`) and puts the last-passkey guard
  in this task (`:174-178`, Decision *The last way in cannot be removed*).
- Also relied on: `account.leaving` (Done) for `handleDeleteAccount`
  (`service/internal/server/account.go:34-127`) and its tests;
  `service.rate_limits` (Done) for the limiter; `service.sessions` (Done) for
  `session.Resolve`.

## What this task is

The service half of the recovery email and of leaving without one. A
signed-in owner can **read** their recovery email (confirmed, and any address
waiting for confirmation), **ask for a verification link** to an address
(always answered *check your inbox*), and anyone holding that link can
**confirm** it — which writes `accounts.email` then and only then, refuses an
address another account holds, mails the previous address a link-less notice
when it was a change, and never starts a session. An account **without** a
confirmed email deletes itself by a **fresh passkey assertion** in
`DELETE /api/account` instead of the typed email it cannot have. And the last
passkey of an account with no confirmed email **cannot be removed**.

## Why it needs to be done

Nothing writes `accounts.email` today: the only account insert is
`INSERT INTO accounts (id)` (`service/internal/server/passkeys.go:513`), so
every real account has a NULL email. The emailed sign-in link
(`service.email_links`) therefore reaches no one — a person who loses every
passkey device is locked out for good — and `DELETE /api/account` fails closed
with 400 for every account (`account.go:56-74`, pinned by
`TestDeleteAccountNullEmailFailsClosed`, `account_test.go:149-160`), so no
real account can leave as workflow 17 promises. `account.recovery_email`
cannot start until these endpoints exist; `books.add_book_chooser`'s emailed
link needs a recovery email to be settable.

## Inputs / context

- **Workflow 13 §The recovery email** (`docs/workflows/13-new-device.md:32-68`)
  — setting, confirming (does not sign in; expired-or-used copy), changing
  (old stays in effect; link-less notice to the old address), one account per
  address (refused only on opening the link), needs a connection.
- **Workflow 13 §The last way in** (`13-new-device.md:70-76`) — no confirmed
  recovery email ⇒ the last passkey cannot be removed.
- **Workflow 17 §An account with no email** (`docs/workflows/17-leaving.md:70-92`)
  — the passkey confirm, "made for this deletion and good for a few minutes";
  cancelled vs refused; an account with an email keeps typing it.
  §The cascade, and the one endpoint (`17-leaving.md:141-164`) — one
  `DELETE /api/account` carrying the typed name or the passkey confirmation.
  §Edge cases (`17-leaving.md:196-203`) — an email set but not confirmed still
  confirms by passkey.
- **DIRECTION §3.6 The API** (`docs/DIRECTION.md:374-382`) — the recovery
  email "read by its owner, set and changed through a verification link";
  deletion "confirmed by its email or, without one, a passkey".
  **§3.3 rate limits** (`DIRECTION.md:200-211`) — the verification link is
  rate-limited; per account where there is a session, per address for an
  emailed link (clarified by this task's delta, below).
- **Contract today**: `deleteAccount` `api/openapi.yaml:228-253`,
  `DeleteAccountRequest` :1047-1058 (`required:[confirm]`), `removePasskey`
  :327-345, `Account` :962-969 (`{id}` only), `requestEmailLink` always-202
  :166-190, `RateLimited` :902, `Error` :929 ("never carries … an email
  address or a token").
- **Seams**: `APIDeps` (`service/internal/server/email_links.go:30-66`),
  `mintAndSend` (:128-152, the link URL at :150), `decodeStrict` (:230),
  `writeError`/`writeJSON` (`respond.go:20,28`); `handleRemovePasskey`
  (`passkeys.go:370-`, the unguarded `DELETE` at ~:392);
  `credentialBeginResponse` (`passkeys.go:46`), `loadAccountAndPasskeys`
  (:439); rate-limit rules `ratelimit.go:31-66`, `NewDefault` :128-135, the
  server wrappers in `server/ratelimit.go:22-78`; `session.Resolve`
  (`session/session.go:128`).
- **Test seams**: `newPasskeyEnv`/`passkeyEnv` (`passkeys_test.go:40-83`),
  `newBooksEnv`/`newBooksEnvWith` (`books_test.go:42-50`), `recordingMailer`
  (`email_links_test.go:47-54`), `booksEnv.setEmail` (`account_test.go:25`),
  `apicontract.Validate` (`api/validate.go:128`); e2e `lib/mail.js`
  (`waitForMessageTo` :49, `extractLink` :61), `lib/authenticator.js`,
  `lib/http.js` (`HttpClient`), `lib/db.js` (`connect` :28).
- **Predecessor decisions kept**: tokens are `id.HMAC(id)` with an opaque id
  in the row and one atomic consume-and-check `UPDATE`
  (`refinements/service/email_links.md:294-309`); 15-minute lifetime as a
  named constant (:310-316); no enumeration (:173-176); passkey state stateless
  and sealed, 5 minutes (`refinements/service/passkeys.md:374-395`);
  single-purpose HMAC keys (:391-395); rate-limit keys are an IP, a lowercased
  address or an account id, never a token (`refinements/service/rate_limits.md:179-185`);
  the server compares the typed confirm and never echoes it
  (`refinements/account/leaving.md:438-461`).

## Constraints / requirements

1. **Verify, then write.** `accounts.email` changes only inside the confirm
   endpoint's transaction, never at request time (workflow 13 §Setting it;
   design Decision *verify-then-write*). A pending address is not the
   account's email for any purpose: it receives no sign-in link, and it does
   not make deletion confirm by typing (workflow 17 §Edge cases).
2. **No enumeration.** The request endpoint answers 202 for every well-formed
   address — free, held by another account, or the account's own current one
   — and mails the link in every case. Only the confirm (by the mailbox's
   holder) may say an address is taken.
3. **The confirm does not sign in.** It sets no cookie, creates no session,
   and does not require one; it works on any device (workflow 13 §Confirming
   it).
4. **Old address in effect until the new one is confirmed**; on a confirmed
   change, the previous address gets one notice with **no link and without the
   new address** (workflow 13 §Changing it).
5. **One account per address.** Addresses are stored lowercased; the confirm
   refuses an address another account holds (compared `lower(email)`), and
   the `UNIQUE` constraint on `accounts.email` (`0001_registry.sql:37-41`) is
   the backstop.
6. **The address is never logged, and never in an error body** (workflow 13
   "never logged"; `Error` schema). The read endpoint returns it to its owner
   only. Tokens and the state are never logged. A behavior test asserts this
   over the captured log, as `email_links_test.go` does.
7. **Passkey confirm is fresh, for this deletion, for this account.** The
   assertion answers a challenge minted by a session-carrying begin made for
   deletion; a state sealed for any other ceremony, older than
   `passkey.StateTTL` (5 min, "good for a few minutes"), or answered by a
   credential not on the session's account is refused, and nothing is deleted.
8. **The typed confirm stays exactly as it is** for an account with a
   confirmed email; a passkey confirm is refused for such an account, and a
   typed confirm is refused for one without (both 400 `confirm_mismatch`,
   nothing deleted). The cascade is unchanged (workflow 17 §The cascade).
9. **The last way in.** Removing a passkey that is the account's last, while
   it has no confirmed email, is refused and removes nothing — serialised so
   two concurrent removals cannot leave zero.
10. **Rate limits** (DIRECTION §3.3): the verification request is capped per
    account and per address; the excess is 429 `rate_limited` with
    `Retry-After`, mailing nothing and as account-oblivious as the 202.
    Refused confirms count against the per-IP sign-in failure cap, as a
    refused redeem does.
11. **Contract first, both sides validated.** Every new or changed response
    is validated against `api/openapi.yaml` in the behavior tests.

## Acceptance criteria

### Behavior delivered

**Contract** (`api/openapi.yaml`, tag `Sign-in`):

- `GET /api/account/recovery-email` — operationId `getRecoveryEmail`. 200
  `RecoveryEmail` `{ email: string|null, pending: string|null }`: `email` the
  confirmed address, `pending` the address of the latest unconsumed
  verification (expired or not, so the app can keep saying *waiting for you to
  confirm* with **send again**), else null. 401 without a session.
- `POST /api/account/recovery-email` — `requestRecoveryEmail`, body
  `RecoveryEmailRequest` `{ email }` (format email, `additionalProperties:
  false`). 202 always for a well-formed address; 400 malformed; 401; 429.
  Writes a new verification row for `(account, lower(address))`, deletes the
  account's earlier unconsumed ones (a new request replaces the old), and
  mails `${ESTANTE_PUBLIC_BASE_URL}/recovery-email/<token>`.
- `POST /api/recovery-email/confirm` — `confirmRecoveryEmail`, body
  `{ token }`, **no security requirement**. 204 on success, so nothing about
  the account travels to whoever opens it; 400
  `link_invalid` for a tampered, unknown, expired or used token (one code, as
  workflow 13 has one sentence); 409 `address_taken` when another account
  holds the address; 429. Never sets a cookie.
- `POST /api/account/delete/begin` — `beginDeleteAccountPasskey`. 200
  `{ publicKey, state }` (the existing begin shape) for a signed-in account
  **with no confirmed email**: a non-discoverable assertion request
  (`allowCredentials` = the account's passkeys) whose state is sealed for the
  purpose *delete-account*. 401 without a session; 400 `confirm_by_email` for
  an account that has a confirmed email.
- `DELETE /api/account` — `DeleteAccountRequest` becomes `oneOf`
  `{ confirm }` | `{ passkey: { state, credential } }`. The typed branch is
  unchanged. The passkey branch validates the assertion against the session's
  account; success runs the existing cascade and answers 204; a stale or
  other-purpose state, a credential not on the account, or a bad signature is
  400 `passkey_refused` and deletes nothing. The `description` is updated for
  the two branches.
- `DELETE /api/account/passkeys/{passkeyId}` — gains 409 `last_way_in` when
  the passkey is the account's last and the account has no confirmed email.

**Service**:

- Migration `0007_recovery_email.sql`: `recovery_email_links (id text PK,
  account_id uuid NOT NULL REFERENCES accounts ON DELETE CASCADE, address
  text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now())`, indexed on `account_id`.
- `service/internal/recoveryemail/` (pure): `Normalize(address)` (trim,
  `mail.ParseAddress`, lowercase) and `Decide(row, now, heldByOther,
  current) Outcome` → `Confirm`, `ConfirmChange` (a different confirmed
  address was in effect: notice it), `Expired`, `Consumed`, `Taken`. Tokens
  are `emaillink.NewID`/`Mint`/`Parse` with `emaillink.LinkLifetime`.
- The confirm runs in one transaction: `SELECT … FOR UPDATE` the row joined to
  its account, decide; on `Confirm*` mark the row consumed and `UPDATE
  accounts SET email = address`; on `Taken` roll back (the link stays
  unconsumed and opening it again says the same); after commit, on
  `ConfirmChange`, mail the notice to the old address — best effort, a send
  failure logged as metadata and not failing the 204.
- `mail.Mailer` gains `SendRecoveryEmailLink(ctx, to, link)` and
  `SendRecoveryEmailChanged(ctx, to)`; `message.go` gains
  `composeRecoveryEmailLinkMessage` (exactly one link, says it confirms a
  recovery email and does not sign in, expires in fifteen minutes) and
  `composeRecoveryEmailChangedMessage` (no link, no address but its
  recipient, nothing to do).
- `passkey/state.go`: the sealed envelope gains a purpose; `SealFor(purpose,
  …)`/`OpenFor(purpose, …)` with `RP.SealFor`/`RP.OpenFor`; the existing
  `Seal`/`Open` are purpose `""`, so a deletion state does not open as a
  sign-in or registration state, nor the reverse.
- `ratelimit`: `RecoveryEmailAccount` (10 per hour per account) and
  `RecoveryEmailAddr` (5 per hour per lowercased address), registered in
  `NewDefault`; checked inline in the request handler with `rateAllowAll`.
  Refused confirms `rateRecordFailure` against `SignIn` per client IP and are
  checked before parsing, as the redeem is (`email_links.go:168-175`).
- `handleRemovePasskey`: in a transaction, `SELECT email FROM accounts WHERE
  id = $1 FOR UPDATE`, count the account's passkeys, refuse with 409
  `last_way_in` when the email is NULL and the count is 1, else delete.

### Tests, by level

**unit**

- `service/internal/recoveryemail/rules_test.go` (new) — `Decide` over every
  row state: fresh → `Confirm`; fresh with a different current email →
  `ConfirmChange`; fresh with the same current email → `Confirm` (no notice);
  expired at exactly `LinkLifetime` → `Expired`; consumed → `Consumed`; held
  by another account → `Taken` (taken wins over fresh, loses to expired and
  consumed, so a dead link never discloses who holds an address); `Normalize`
  lowercases, trims, refuses a malformed address. *Pins:* workflow 13 §The
  recovery email (single use, fifteen minutes, one account per address,
  change notice) — the `.tji` "unit (verification token rules)".
- `service/internal/mail/message_test.go` (extended) —
  `TestComposeRecoveryEmailLinkCarriesExactlyTheLink` (one link, no other
  address or token) and `TestComposeRecoveryEmailChangedCarriesNoLink` (no
  URL, no address but the recipient's). *Pins:* workflow 13 §Changing it ("no
  link, nothing to do").
- `service/internal/passkey/state_test.go` (extended) —
  `TestStatePurposeIsBound`: a state sealed for *delete-account* does not open
  with purpose `""`, and a sign-in state does not open for *delete-account*.
  *Pins:* workflow 17 §An account with no email ("made for this deletion").
- `service/internal/ratelimit/ratelimit_test.go` (extended) — the two new
  rules trip at their thresholds and are keyed independently. *Pins:*
  DIRECTION §3.3 (per account, per address).

**behavior** (`service/internal/server/`, httptest, real Postgres, every
response validated with `apicontract.Validate`)

- `recovery_email_test.go` (new):
  - `TestRecoveryEmailSetAndConfirm` — request → 202, `recordingMailer` holds
    one link, `accounts.email` still NULL, GET shows `pending`; confirm with
    no cookie → 204, no `Set-Cookie`, no new session row; GET shows `email`
    and `pending: null`. *Pins:* workflow 13 §Setting it, §Confirming it ("does
    not sign in").
  - `TestRecoveryEmailRequestReplacesEarlierLink` — two requests; the first
    token → 400 `link_invalid`, the second → 204.
  - `TestRecoveryEmailConfirmExpiredOrUsed` — an expired row → 400; a token
    redeemed twice → second 400; a tampered token → 400; none writes the
    email.
  - `TestRecoveryEmailChangeKeepsOldUntilConfirmed` — with `old@` confirmed,
    request `new@`: GET shows both, the account's email is still `old@`
    (an emailed sign-in request for `old@` still mails); confirm → email is
    `new@`, and the mailer holds a changed-notice to `old@` with no link.
    *Pins:* workflow 13 §Changing it.
  - `TestRecoveryEmailTakenRefusedOnlyOnConfirm` — account B holds `x@`;
    account A's request for `x@` → 202 and a mail; A's confirm → 409
    `address_taken`, A's email unchanged, the row unconsumed. *Pins:* workflow
    13 §Who holds an address.
  - `TestRecoveryEmailNeedsSession` — GET and POST without a cookie → 401;
    a malformed address → 400.
  - `TestRecoveryEmailRateLimited` (via `newBooksEnvWith` injecting a
    limiter) — the request trips per account and per address with 429
    `rate_limited`, mailing nothing. *Pins:* DIRECTION §3.3.
  - `TestRecoveryEmailNeverLogged` — after request, confirm and change, the
    captured log holds neither address nor token. *Pins:* workflow 13 "never
    logged".
- `account_test.go` (extended):
  - `TestDeleteAccountByPasskey` — a passkey-only account: begin → `get` on the
    `webauthntest` authenticator → DELETE with `{passkey}` → 204, the account,
    sessions and passkeys gone, the cookie cleared, the cascade as
    `TestDeleteAccountCascades` checks. *Pins:* workflow 17 §An account with
    no email.
  - `TestDeleteAccountPasskeyRefused` — each refused, nothing deleted, 400
    `passkey_refused`: a stale state (the begin's SessionData resealed with
    the env's state secret at a clock past `StateTTL`); a sign-in
    (`authenticate/begin`) state; a tampered assertion (`GetTampered`); an
    assertion by another account's passkey. *Pins:* workflow 17 ("a passkey
    not on this account, or a confirmation gone stale").
  - `TestDeleteAccountConfirmBranchesMatchTheEmail` — an account with a
    confirmed email: begin → 400 `confirm_by_email`, a passkey DELETE → 400
    `confirm_mismatch`, the typed email → 204. An account with only a
    *pending* address: begin → 200 and deletes by passkey. *Pins:* workflow 17
    §An account with no email ("neither is required of the other"), §Edge
    cases.
  - `TestDeleteAccountNullEmailFailsClosed` (kept) — a typed confirm on a
    passkey-only account is still 400 and deletes nothing.
- `passkeys_test.go` (extended) — `TestRemoveLastPasskeyRefusedWithoutEmail`:
  one passkey, no email → 409 `last_way_in`, still listed; with a second
  passkey → the first removes, the last then 409; after a confirmed email
  (`setEmail`) the last removes → 204. *Pins:* workflow 13 §The last way in.

**e2e-api** (`e2e/api/`, the compose stack, Mailpit, the JS authenticator)

- `recovery-email.test.js` (new):
  - *set, verified, then used for an emailed sign-in* — register a
    passkey-only account (`Authenticator`); POST the recovery email (a unique
    `@estante.test` address); `waitForMessageTo`; `extractLink(…,
    /\/recovery-email\/\S+/)`; confirm with a fresh `HttpClient` (no cookie)
    → 204, no session cookie; GET as the owner shows it confirmed; then
    `POST /api/auth/email/request` for it → the sign-in link mails → redeem →
    a session for the same account id. *Pins:* workflow 13 §The recovery
    email; the `.tji` e2e-api first clause.
  - *a change notices the old address* — change to a second address and
    confirm; the old address receives the notice with no link; an emailed
    sign-in for the new address works.
  - *the last passkey stays until an email is confirmed* — a passkey-only
    account's DELETE of its only passkey → 409; after confirming an email →
    204. *Pins:* workflow 13 §The last way in.
- `account.test.js` (extended) — *a passkey-only account deleted by passkey on
  the stack*: register, create a book, begin → `authenticator.get` → DELETE
  with `{passkey}` → 204; via `lib/db` `connect()` the account, its passkeys
  and sessions are gone and the book soft-deleted; the old cookie → 401. A
  replayed DELETE with the same assertion → 401 (the session is gone).
  *Pins:* workflow 17 §An account with no email, §The cascade; the `.tji`
  e2e-api second clause.

Every e2e prerequisite is in place: accounts by passkey (`service.passkeys`),
the mail catcher (`foundation.e2e_api`, `lib/mail.js`), the emailed sign-in
(`service.email_links`), books (`service.home_book`/books endpoints already
used by `account.test.js`).

No deferred follow-ups; no tech debt. The app side is the existing
`account.recovery_email`.

## Decisions

### A table of its own for verification links

**Chosen:** `recovery_email_links`, holding the address beside the id.
**Rejected:** a `purpose` column on `email_login_links` (that table's rows are
sign-in links by construction — `redeem` would have to learn to refuse a
verification row, and a missed check turns a verification link into a
sign-in link, the exact thing workflow 13 forbids); a pending-email column on
`accounts` (cannot hold the expiry and single-use the token rules need, and
complicates `UNIQUE`). A distinct table makes a verification token
structurally unable to redeem as a sign-in: its id is not in
`email_login_links`.

### Reuse `emaillink` and `ESTANTE_LINK_SECRET`

**Chosen:** the same `Mint`/`Parse`/`LinkLifetime` and secret.
**Rejected:** a second `ESTANTE_RECOVERY_LINK_SECRET`. The passkeys precedent
(single-purpose keys) separated two different *formats* signed by the same
key; here the purpose separation is the table (above), so a new secret adds
config, compose and gate wiring with nothing it prevents. Same 15 minutes:
workflow 13 says "expires as the sign-in link does".

### The confirm answers 204, 400 or 409 — never 401, never a body with the address

**Chosen:** 204 on success; one 400 `link_invalid` for every dead link; 409
`address_taken`. **Rejected:** 401 (the app reads a 401 as *signed out*, and
the confirm has nothing to do with the session); 410 for expired vs 400 for
used (workflow 13 has one sentence for both); returning the address (whoever
opens the link already knows it, but a forwarded link should not echo an
account's address back).

### Taken is checked only for a live link, and rolls back

**Chosen:** `Decide` orders expired/consumed before taken, and a `Taken`
outcome leaves the row unconsumed. **Rejected:** consuming on refusal (the
person who signs in on the other account and frees the address would need a
new link anyway — harmless either way, but rolling back keeps the confirm a
single all-or-nothing write); checking taken first (a dead link would still
tell its holder who owns an address).

### The passkey confirm rides in the DELETE body

**Chosen:** a session-carrying begin for deletion, then the assertion carried
in `DELETE /api/account` and validated there (`ValidateLogin` against
`UserFor(account)`). **Rejected:** a separate "confirm" endpoint minting a
short-lived deletion token the DELETE then carries — a second token type and
table for what one request already does; the state's 5-minute seal is the
"good for a few minutes", and a successful use deletes the account, so the
state's replayability within its TTL (passkeys Decision) cannot be exploited
here. Non-discoverable with `allowCredentials` (rather than the discoverable
sign-in request) so the browser offers only this account's passkeys — "a
passkey not on this account" is then a refusal the service makes, not a
confusing prompt.

### A purpose sealed into the passkey state

**Chosen:** `SealFor`/`OpenFor`, existing ceremonies at purpose `""`.
**Rejected:** relying on go-webauthn's `SessionData.UserID` alone (a
discoverable sign-in state carries none, so it would already fail
`ValidateLogin` — but the guarantee would be an accident of the library, and
a future account-scoped ceremony would silently share states with deletion).

### The last-passkey guard lives on the server

**Chosen:** 409 `last_way_in` from `removePasskey`, serialised by locking the
account row. **Rejected:** an app-only guard (a second device or a direct call
would still lock the account out — design Decision *The last way in cannot be
removed* gives it to this task).

### Rate limits: their own per-address bucket

**Chosen:** `RecoveryEmailAccount` (per account, the request carries a
session) and `RecoveryEmailAddr` (per address), separate from the sign-in
link's `EmailLinkAddr`. **Rejected:** sharing `EmailLinkAddr` — a signed-in
stranger could then spend a victim's five sign-in links an hour by asking for
verifications to the victim's address. **Design delta:** DIRECTION §3.3 now
says the per-address cap holds "for each emailed link (the sign-in link and
the verification link alike)" (`docs/DIRECTION.md:206-208`) — it read
"for the emailed link", which left the verification link's per-address cap
unsaid.

### The read endpoint returns the pending address even once expired

**Chosen:** `pending` is the latest unconsumed row's address. **Rejected:**
hiding it after fifteen minutes — workflow 13's *waiting for you to confirm*
region names the address with **send again**, which is exactly what an
expired link needs.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- Contract: api/openapi.yaml gains GET/POST /api/account/recovery-email, POST /api/recovery-email/confirm, POST /api/account/delete/begin, the passkey branch of DELETE /api/account and the 409 `last_way_in` on passkey removal.
- Migration service/internal/db/migrations/0007_recovery_email.sql; pure rules in service/internal/recoveryemail/ (Normalize, Decide); handlers in service/internal/server/recovery_email.go, with account.go, passkeys.go, server.go and logging.go (the confirm path is redacted from the log) extended.
- Mail: service/internal/mail/{mail,message}.go gain the verification-link and changed-notice messages; service/internal/ratelimit/ratelimit.go gains the per-account and per-address rules.
- Passkey: service/internal/passkey/{state,passkey}.go seal states for a purpose, so a deletion state opens only for deletion.
- Unit: recoveryemail/rules_test.go, mail/message_test.go, passkey/state_test.go, ratelimit/ratelimit_test.go.
- Behavior: service/internal/server/recovery_email_test.go, account_test.go, passkeys_test.go (TestListAndRemovePasskeys now confirms an email first, as the new guard requires).
- e2e-api: e2e/api/recovery-email.test.js and e2e/api/account.test.js (passkey deletion on the stack).
- Tech debt registered: service.signin_link_path_redaction (the `/sign-in/<token>` page path is still logged with its token). docs/DIRECTION.md §3.3 now names the per-address cap for both emailed links.
