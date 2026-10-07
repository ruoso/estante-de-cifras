# service.email_links — Emailed sign-in links

## TaskJuggler

[`tasks/30-service.tji`](../../30-service.tji), `task service.email_links`
("Emailed sign-in links"). Declares `depends !schema` — on its sibling
`service.schema` — and so also inherits the parent `service` task's
dependencies (`foundation.service_skeleton`, `foundation.api_contract`,
`foundation.e2e_api`). Downstream, `service.sessions` builds the
account-screen device management on top of the minimal session seam this task
introduces (see Decisions), and `service.rate_limits` adds the limiter on
emailed-link requests.

## Effort estimate

`2d` (from the `.tji`). The request/redeem handlers and the token module are
small; the weight is in three new seams the service does not have yet — a
mailer, a signed-token module, and the first session-cookie minting — plus
wiring real SMTP into the compose stack and an end-to-end test that drives the
Mailpit catcher. No new runtime dependency (stdlib `net/smtp`, `crypto/hmac`,
`crypto/sha256`, `crypto/rand`), which keeps it to two days.

## Repository

**estante-de-cifras.** Not a cifra.md task (the `.tji` note does not start
with `cifra.md:`). The app and the service **share no code**
([`docs/DIRECTION.md:288`](../../../docs/DIRECTION.md)); this task is entirely
service-side Go plus the e2e-api harness. Directories:

- `service/internal/emaillink/` — the signed-token module (new).
- `service/internal/mail/` — the `Mailer` interface and its SMTP
  implementation (new).
- `service/internal/session/` — the minimal session-mint seam (new; see
  Decisions on ordering).
- `service/internal/server/` — the two handlers register on the existing mux
  ([`service/internal/server/server.go:33`](../../../service/internal/server/server.go)).
- `service/internal/db/migrations/0002_email_links.sql` — the token table
  (new; the migrator from `service.schema` is forward-only and picks it up by
  name).
- `service/internal/config/`, `service/cmd/service/main.go` — new `ESTANTE_*`
  fields and their construction.
- `compose.yaml`, `scripts/gate` — wire SMTP and the signing secret to the
  service container.
- `e2e/api/` — the end-to-end test (new), reusing the existing Mailpit reader.

## Inherited dependencies

The three foundation predecessors are **settled** (Done, 2026-10-05); the
sibling `service.schema` is **settled** (Done, 2026-10-07):

- **`foundation.service_skeleton`** (settled) — the Go module
  `estantedecifras.app/service`
  ([`service/go.mod:1`](../../../service/go.mod)), the `net/http.ServeMux`
  frame in `server.Handler`, the `LogRequests`/`NoIndex` middleware, and the
  pure `config.Load(lookup)` seam.
- **`foundation.api_contract`** (settled) — the OpenAPI contract
  ([`api/openapi.yaml`](../../../api/openapi.yaml)) already specifies both
  endpoints this task implements, the `estante_session` cookie scheme, and the
  `Error` shape that forbids email addresses and tokens in error bodies.
- **`foundation.e2e_api`** (settled) — the `e2e/api/` Vitest harness, its
  session-carrying `HttpClient` ([`e2e/api/lib/http.js`](../../../e2e/api/lib/http.js)),
  and the Mailpit reader ([`e2e/api/lib/mail.js`](../../../e2e/api/lib/mail.js))
  with `waitForMessageTo` / `extractLink`, written as "the seam the emailed
  sign-in link flow (workflow 13) is tested through."
- **`service.schema`** (settled) — the Postgres registry. This task reads
  `accounts.email`
  ([`service/internal/db/migrations/0001_registry.sql:37-39`](../../../service/internal/db/migrations/0001_registry.sql)),
  "the address the sign-in/recovery link is mailed to (workflow 13)," and
  writes `sessions`
  ([`0001_registry.sql:64`](../../../service/internal/db/migrations/0001_registry.sql)).
  It adds `0002_email_links.sql` through the forward-only, embedded migrator
  (`db.Migrate`, [`service/internal/db/migrate.go:33`](../../../service/internal/db/migrate.go));
  `0001_registry.sql` left the token table out deliberately so this task owns
  it. pgx v5 is already a direct dependency, so no new dependency is added for
  Postgres.

## What this task is

Emailed sign-in links: the WebAuthn fallback and the account-recovery path of
workflow 13. Two public endpoints, already named in the contract. **Request**
(`POST /api/auth/email/request`) takes an email address, and — only when an
account holds that address — mails a signed, short-lived, single-use link; it
answers `202` either way so the response never reveals who has an account.
**Redeem** (`POST /api/auth/email/redeem`) takes the token the link carries,
and when it verifies, is unexpired, and has not been used, starts a session
(sets the `estante_session` cookie) and returns the account. The task also
lands the three service-side seams these need and that no sibling has built
yet: a `Mailer` (SMTP in development to the Mailpit catcher), a signed-token
module, and the first session-cookie minting.

## Why it needs to be done

Workflow 13's third sign-in case — "a borrowed computer, no Bluetooth, a
browser where this is patchy (desktop Linux): the emailed link. It is also how
an account is recovered when every device holding a passkey is lost"
([`docs/workflows/13-new-device.md:25-27`](../../../docs/workflows/13-new-device.md))
— has no other implementation. Passkeys cover the first two cases; this is the
only path for the third and for recovery. It also brings up the service's first
outbound-mail and session-cookie machinery, which `service.sessions`,
`service.passkeys`, and every later signed-in route build on.

## Inputs / context

- **The `.tji`**: "Signed, short-lived, single-use links through the email
  provider; the fallback and account recovery. Workflow 13. Tests: unit
  (signing, expiry, single use); behavior (request and redeem through
  httptest; an expired and a reused link refused); e2e-api (request a link,
  read it from the mail catcher, redeem it into a session — workflow 13)."
  ([`tasks/30-service.tji:21-26`](../../30-service.tji)).
- **Workflow 13**, "Signing in on another device"
  ([`docs/workflows/13-new-device.md:10-27`](../../../docs/workflows/13-new-device.md)):
  the emailed link is the fallback (no reachable passkey) and the recovery
  path (all passkey-holding devices lost). "The account screen" (lines 68-73):
  a session is one signed-in device; a revoked session stops working at its
  **next request** (lazy enforcement).
- **DIRECTION §3.3 The one server**
  ([`docs/DIRECTION.md:153-198`](../../../docs/DIRECTION.md)): one origin, one
  Go binary; "Sign-in links are mailed from it too" (line 162); "One origin …
  a session cookie that simply flows" (line 171); Postgres "holds accounts,
  sessions and passkeys" (line 184); "A transactional email provider sends the
  sign-in links that back up passkeys and recover an account" (lines 188-190).
- **DIRECTION §3.6**
  ([`docs/DIRECTION.md:277-402`](../../../docs/DIRECTION.md)): the service is
  Go, `service/` (line 283); "The app and the service share no code" (line
  288); the stack is "`net/http`; `pgx`; `go-webauthn`; `net/smtp` to hand the
  sign-in mail to the email provider (a local catcher stands in for it in
  development)" (lines 313-315, **amended by this task** — see the design
  delta under Decisions); the API has "requesting and redeeming an emailed
  link" (lines 359-361); "everything runs as in production … a local mail
  catcher in place of the email provider" (lines 396-402).
- **The contract**
  ([`api/openapi.yaml`](../../../api/openapi.yaml)):
  `requestEmailLink` (lines 164-185) — public, body `EmailLinkRequest`
  (`{email}`, lines 927-935), **always `202`** "whether or not an account
  exists … so the response never reveals who has an account. The address is
  kept to this request body and is never echoed in an error," `400` on a bad
  body; `redeemEmailLink` (lines 187-209) — public, body
  `EmailLinkRedeemRequest` (`{token}`, lines 937-944), `200` returns `Account`
  (`{id}`, lines 852-859) and "Starts a session (sets the session cookie) when
  the token is valid and unexpired," `401` otherwise; the `estante_session`
  cookie scheme (lines 700-707); `Error` "Never carries … an email address or
  a token" (lines 819-825).
- **The schema**
  ([`service/internal/db/migrations/0001_registry.sql`](../../../service/internal/db/migrations/0001_registry.sql)):
  `accounts(id uuid pk, email text unique nullable, created_at)` (lines 37-44);
  `sessions(id uuid pk, account_id references accounts, device, created_at,
  last_used_at, revoked_at)` (line 64 on); the `invitations` token precedent
  (lines 116 on) — a hashed, single-use, expiring secret, the pattern this task
  adapts (see Decisions).
- **The code seams**: `config.Load`
  ([`service/internal/config/config.go:54`](../../../service/internal/config/config.go)),
  whose doc comment already anticipates "the email provider and session secrets
  in sign-in" (lines 26-27); `server.Handler(logger, appRoot, ready Pinger)`
  ([`service/internal/server/server.go:33`](../../../service/internal/server/server.go)),
  called from `main.run` with the pool already passed
  ([`service/cmd/service/main.go:35,61`](../../../service/cmd/service/main.go));
  `LogRequests` logs method, path, status, duration only — never the query,
  which "can carry a token or an email"
  ([`service/internal/server/logging.go`](../../../service/internal/server/logging.go)).
- **The stack**: Mailpit is already a compose service,
  `axllent/mailpit:latest`, SMTP on the compose network at `mail:1025`
  (unpublished), HTTP API on the host at `ESTANTE_MAIL_PORT`
  ([`compose.yaml:40-53`](../../../compose.yaml)); the `service` container's
  env currently holds only `ESTANTE_DATABASE_URL`
  ([`compose.yaml:79-84`](../../../compose.yaml)); `scripts/gate` brings the
  stack up once, exports `ESTANTE_E2E_MAIL_URL`, `ESTANTE_E2E_BASE_URL`, and
  `ESTANTE_TEST_DATABASE_URL`, then runs the service's Go tests and the
  e2e-api suite against it
  ([`scripts/gate:247-267,343-363`](../../../scripts/gate)).

## Constraints / requirements

- **No account enumeration.** `requestEmailLink` answers `202` whether or not
  the address has an account; a link is minted and mailed only when
  `accounts.email` matches. The address never appears in a response body or an
  error.
- **No email, token, or secret in logs.** Handlers log metadata only, keeping
  `LogRequests`' discipline; the address stays in the request body, the token
  in the request body and the mailed link, the signing key in config.
- **Canonical component boundaries** (DIRECTION §3.6): the service shares no
  code with the app; the only contract between them is `api/openapi.yaml`, which
  this task implements to the letter (status codes, bodies, the cookie name).
- **`ESTANTE_*` namespace.** New config is read through the pure
  `config.Load(lookup)`; the service's own vars are `ESTANTE_*` (only the bind
  `PORT` stays plain).
- **Signed, short-lived, single-use.** The token is HMAC-signed with a server
  secret; it expires (a short lifetime, 15 minutes); it is consumed atomically
  on first redeem so a second redeem is refused.
- **Session in Postgres** (DIRECTION §3.3 line 184): redeeming inserts a
  `sessions` row and sets the `estante_session` cookie; the cookie is
  `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, one origin.
- **No new runtime dependency.** `net/smtp` and `crypto/*` are stdlib; pgx is
  already present — so no `go.mod` addition, no DIRECTION stack change beyond
  the SMTP wording delta.
- **Tests use songs and people written for the purpose.** Fixture accounts use
  `@estante.test` addresses; no real person's address, no song text anywhere.

## Acceptance criteria

**Behavior delivered:** `POST /api/auth/email/request` answers `202` for any
syntactically valid address and `400` for a malformed body; when an account
holds that address it mints a signed, 15-minute, single-use token, stores it in
`email_login_links`, and mails a `${ESTANTE_PUBLIC_BASE_URL}/sign-in/<token>`
link through the `Mailer`; when no account holds it, it does neither — the two
cases are indistinguishable to the caller. `POST /api/auth/email/redeem`
verifies the token's signature, that it is unexpired and unconsumed, consumes
it atomically, inserts a `sessions` row, sets the `estante_session` cookie
(`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`), and returns the `Account`;
a tampered, expired, reused, or unknown token is refused `401` with a session
never set. No email address, token, or secret reaches a log.

**Tests the task lands with, by level.** (The `.tji` names unit, behavior, and
e2e-api. The config-field and message-composition unit tests are sharpenings;
single-use is inherently stateful, so its *enforcement* is pinned at behavior
and e2e level while its *decision logic* is a pure unit check — see Decisions.)

- **unit** (`go test`, no database):
  - `service/internal/emaillink/token_test.go` (new) — `Mint`/`Parse`
    round-trips; a token with a flipped signature byte is rejected; a token
    under a different secret is rejected; `CheckState(row, now)` returns
    `fresh` before `expires_at`, `expired` after it, and `consumed` once
    `consumed_at` is set. *Pins:* the `.tji` "unit (signing, expiry, single
    use)".
  - `service/internal/mail/message_test.go` (new) — `composeSignInMessage`
    produces a subject and a body carrying exactly the one sign-in link and no
    other address or token. *Pins:* the no-secret-in-content rule; DIRECTION
    §3.3 line 162 (links mailed from the service).
  - `service/internal/config/config_test.go` (extended) —
    `ESTANTE_SMTP_ADDR`, `ESTANTE_MAIL_FROM`, `ESTANTE_PUBLIC_BASE_URL`, and
    `ESTANTE_LINK_SECRET` parsed; a missing `ESTANTE_LINK_SECRET` is an error
    (no insecure default). *Pins:* DIRECTION §3.6 `ESTANTE_*` namespace;
    `config.go:26-27`.
- **behavior** (`go test` against compose Postgres via
  `ESTANTE_TEST_DATABASE_URL`; each test migrates into a freshly-created,
  uniquely-named schema and drops it; `t.Skip` when the DSN is unset), in
  `service/internal/server/email_links_test.go` (new), driving the real
  `Handler` through `httptest` with a recording fake `Mailer`:
  - request for a seeded `accounts.email` → `202`; one message recorded; one
    `email_login_links` row. *Pins:* `requestEmailLink` `202`
    (`openapi.yaml:181-183`); workflow 13 lines 25-27.
  - request for an address with no account → `202`; no message; no row.
    *Pins:* `requestEmailLink` "never reveals who has an account"
    (`openapi.yaml:169-172`).
  - request with a malformed body → `400`, no message. *Pins:*
    `openapi.yaml:184-185`.
  - redeem a valid token → `200` `Account`; `estante_session` set `HttpOnly`,
    `Secure`, `SameSite=Lax`, `Path=/`; one `sessions` row for the account.
    *Pins:* `redeemEmailLink` `200` + cookie (`openapi.yaml:187-209`,
    `700-707`); DIRECTION §3.3 lines 170-171, 184.
  - redeem an expired token → `401`, no session, no `sessions` row. *Pins:*
    the `.tji` "an expired … link refused".
  - redeem the same token twice → first `200`, second `401`; one `sessions`
    row only (atomic single-use). *Pins:* the `.tji` "a reused link refused".
  - redeem a tampered or unknown token → `401`. *Pins:* `redeemEmailLink`
    `401` (`openapi.yaml:208-209`).
  - the captured log across request and redeem contains no address and no
    token. *Pins:* the no-song-text/no-secret-in-logs rule; `logging.go`.
- **e2e-api** (`e2e/api/`, black-box against the compose stack, real SMTP to
  Mailpit), in `e2e/api/email-links.test.js` (new): seed a fixture account
  with an `@estante.test` address (via `ESTANTE_TEST_DATABASE_URL`; see
  Decisions), `POST /api/auth/email/request`, `waitForMessageTo` the address on
  Mailpit, `extractLink` the token, `POST /api/auth/email/redeem`, assert the
  `HttpClient` now carries `estante_session` and a follow-up authenticated call
  is accepted; a second redeem of the same token → `401`. *Pins:* the `.tji`
  e2e clause "request a link, read it from the mail catcher, redeem it into a
  session — workflow 13".

**No deferred follow-ups land as tech debt.** The downstream `service.sessions`
(account-screen device list, revoke, last-used) and `service.rate_limits`
(limiting link requests) already exist as WBS leaves; this task does not create
them, and does not defer any of its own scope or tests to them. No tech debt
registered. One product question — where an account's recovery email is first
set (`accounts.email` is read here, never written) — is surfaced for the
parking lot in the return summary, not encoded as a task.

## Decisions

- **The SMTP delta to DIRECTION §3.6.** *Chosen:* amend the one-line stack
  description from "the email provider's HTTP API" to "`net/smtp` to hand the
  sign-in mail to the email provider (a local catcher stands in for it in
  development)," and send via stdlib `net/smtp`. *Rejected:* an HTTP-API client
  for a named provider. *Rationale:* the constitution already committed to SMTP
  at the infrastructure layer — the compose stack provisions Mailpit, which is
  a receive-only SMTP catcher on `mail:1025`
  ([`compose.yaml:40-53`](../../../compose.yaml)), and the e2e harness is built
  around reading what arrives there. A catcher cannot be driven by a provider's
  bespoke HTTP API, so the service must speak SMTP to be testable as the stack
  is wired. SMTP is also the universal transactional-mail transport, so no
  provider is foreclosed. This is a genuine deviation from DIRECTION's wording,
  so it rides as a **same-commit design delta** in
  [`docs/DIRECTION.md:313-315`](../../../docs/DIRECTION.md). A `Mailer`
  interface (one method, send the sign-in link) keeps the provider swappable
  behind the SMTP implementation.
- **A signed token over a stored-secret token.** *Chosen:* the token is
  `base64url(id) || "." || base64url(HMAC-SHA256(secret, id))`; the DB row
  (`email_login_links`) stores the opaque `id`, `account_id`, `expires_at`, and
  a nullable `consumed_at`. Redeem recomputes the HMAC in constant time, then
  runs `UPDATE email_login_links SET consumed_at = now() WHERE id = $1 AND
  consumed_at IS NULL AND expires_at > now() RETURNING account_id` — one atomic
  statement that is the single-use and expiry guard; zero rows → `401`.
  *Rejected:* the invitations pattern verbatim — storing a hash of a raw secret
  token. *Rationale:* invitations store a hash because the token *is* the secret
  ([`0001_registry.sql:116` on](../../../service/internal/db/migrations/0001_registry.sql));
  an HMAC-signed id puts the secret in config, never in the row, so a database
  leak yields no usable link without the server key — strictly stronger, and it
  gives a pure, unit-testable signing/expiry module (`emaillink`). Single-use
  is inherently stateful, so its *enforcement* is the atomic `UPDATE` (behavior
  and e2e), while `CheckState` keeps the *decision* (fresh/expired/consumed)
  pure for the unit level. No DIRECTION delta.
- **A 15-minute lifetime, a named constant.** *Chosen:* `LinkLifetime = 15 *
  time.Minute`, documented. *Rejected:* a config knob, or a longer
  recovery-specific lifetime. *Rationale:* workflow 13 says "short-lived"
  without a number; 15 minutes is the common magic-link default and one value
  keeps the fallback and recovery paths identical. A knob is easy to add later
  if a real need appears; one or two call sites do not warrant it now. No
  delta.
- **email_links introduces the minimal session-mint seam.** *Chosen:* a small
  `service/internal/session` package with `Issue(ctx, pool, accountID, w)` that
  inserts a `sessions` row and writes the `estante_session` cookie
  (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`), and `main`/`server` thread
  the pool and config through (the pool is already passed to `server.Handler`
  as `Pinger`). *Rejected:* deferring the cookie until `service.sessions`, or
  waiting on `service.passkeys`. *Rationale:* the contract requires
  `redeemEmailLink` to set the cookie, and in the WBS this is the first sign-in
  path to land — `service.passkeys` and `service.sessions` both sit after it
  (`sessions depends !passkeys`), so neither seam exists yet. email_links
  therefore owns the smallest correct version; `service.sessions` later builds
  the account-screen management (list devices, last-used, revoke) on the same
  table and the same `Issue`, and `service.passkeys` reuses `Issue`. The cookie
  attributes match what `service.sessions`' note already fixes
  ([`tasks/30-service.tji:27-32`](../../30-service.tji)), so nothing is
  re-litigated. This is a WBS-ordering resolution, not a design change: sessions
  in Postgres and the one-origin cookie are already DIRECTION §3.3. No delta.
- **The e2e fixture account is seeded through Postgres.** *Chosen:* the e2e-api
  test inserts its `@estante.test` account against the compose Postgres via
  `ESTANTE_TEST_DATABASE_URL` (already exported by `scripts/gate`), adding a
  minimal `postgres` client to `e2e/api`
  (see [[adding-npm-deps-needs-lockfile-and-network]] — the lockfile is updated
  in the same change). *Rejected:* a test-only HTTP seeding endpoint (new
  production surface), or waiting for an account-creation endpoint to exist.
  *Rationale:* no landed HTTP endpoint sets `accounts.email` yet (passkeys do
  not carry email, and the account-screen "recovery email" flow is a later,
  separate concern), so the real SMTP→Mailpit→redeem round-trip cannot be
  reached black-box without seeding. The schema convention keeps Postgres out
  of e2e *assertions*; seeding a precondition that no endpoint yet provides is a
  bounded, documented exception. The assertions stay black-box over HTTP and the
  Mailpit HTTP API. No delta.
- **No account creation on request or redeem.** *Chosen:* a link is only ever
  minted for an existing `accounts.email`; redeem signs in an existing account.
  *Rejected:* creating an account when an unknown address redeems a link.
  *Rationale:* the `.tji` scopes this to "the fallback and account recovery,"
  both of which presuppose an account (made on first run by passkey, workflow
  1); creating accounts from an inbound address would turn a sign-in link into a
  sign-up vector and complicate enumeration. First-run account creation stays
  with `service.passkeys`. No delta.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `service/internal/emaillink/token.go`, `token_test.go` — HMAC-SHA256 signed-token module: `Mint`, `Parse`, `CheckState` (fresh/expired/consumed).
- `service/internal/mail/mail.go`, `message.go`, `message_test.go` — `Mailer` interface and stdlib `net/smtp` implementation; `composeSignInMessage` unit-tested for the one-link body, no stray address or token.
- `service/internal/session/session.go` — minimal `Issue(ctx, pool, accountID, w)` seam: inserts a `sessions` row and writes the `estante_session` cookie (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`).
- `service/internal/db/migrations/0002_email_links.sql` — `email_login_links` table (id, account_id, expires_at, consumed_at).
- `service/internal/server/email_links.go`, `email_links_test.go` — `requestEmailLink` and `redeemEmailLink` handlers with full behavior-level coverage (seeded 202, unknown 202, bad-body 400, redeem 200+cookie+session row, expired 401, single-use reuse 401, tampered/unknown 401, no-secret-in-logs).
- `service/internal/server/respond.go` — shared JSON-response helper.
- `service/internal/server/server.go` — `APIDeps` struct; route registration for both endpoints.
- `service/internal/config/config.go`, `config_test.go` — `ESTANTE_SMTP_ADDR`, `ESTANTE_MAIL_FROM`, `ESTANTE_PUBLIC_BASE_URL`, `ESTANTE_LINK_SECRET` (required, no insecure default).
- `service/cmd/service/main.go` — wires new config fields and `APIDeps` pool through to `server.Handler`.
- `compose.yaml`, `scripts/gate` — SMTP vars and `ESTANTE_LINK_SECRET` wired to the service container.
- `docs/DIRECTION.md` — §3.6 design delta: `net/smtp` (stdlib) in place of "provider's HTTP API."
- `e2e/api/lib/db.js`, `e2e/api/email-links.test.js` — e2e-api: seeds fixture account via Postgres, drives Mailpit, redeems token into a session cookie; single-use 401 and no-mail-for-unknown confirmed.
- `e2e/api/package.json`, `package-lock.json` — added `postgres` client for fixture seeding.
