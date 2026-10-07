# service.sessions — Sessions and devices

## TaskJuggler

[`tasks/30-service.tji`](../../30-service.tji), `task service.sessions`
("Sessions and devices"). Declares `depends !passkeys` — on its sibling
`service.passkeys` — and so also inherits the parent `service` task's
dependencies (`foundation.service_skeleton`, `foundation.api_contract`,
`foundation.e2e_api`), and transitively `service.schema` (through passkeys,
and through the shared session seam `service.email_links` introduced).
Downstream, the app's account area consumes these endpoints:
`account.account_screen` lists the signed-in devices and signs one out, and
`account.sign_out` is the this-device sign-out with its remove-or-keep prompt
(both workflow 13).

## Effort estimate

`2d` (from the `.tji`). No new seam, no new table, no new dependency: the
`sessions` table and the `session.Issue`/`session.Resolve` seam already exist
(`service.email_links` built them, `service.passkeys` reused them), and all
three endpoints are already written down in the contract. The weight is three
small handlers on the existing mux, deriving the `current` flag and a
best-effort device label, and the behaviour/e2e tests that prove a signed-out
device is refused at its next request.

## Repository

**estante-de-cifras.** Not a cifra.md task (the `.tji` note does not start
with `cifra.md:`). The app and the service **share no code**
([`docs/DIRECTION.md:288`](../../../docs/DIRECTION.md)); this task is entirely
service-side Go plus the e2e-api harness. Directories:

- `service/internal/server/sessions.go` — the three handlers (`signOut`,
  `listSessions`, `revokeSession`), new, registered on the existing mux
  ([`service/internal/server/server.go`](../../../service/internal/server/server.go)
  — the mux `Handler` builds, currently registers only health, the email
  routes and the passkey routes).
- `service/internal/session/session.go` — extend the existing seam: a pure
  `describeDevice(userAgent)` helper, a short-lived cookie-clearing helper, and
  an `End`/revoke helper; `Issue` gains the request so it can store a device
  label (see Decisions). Today `Issue` writes only `account_id`
  ([`service/internal/session/session.go:44`](../../../service/internal/session/session.go)).
- `service/internal/server/email_links.go`,
  `service/internal/server/passkeys.go` — the three existing `session.Issue`
  call sites update to the new signature (email redeem, passkey
  authenticate-finish, first-run register-finish).
- `e2e/api/sessions.test.js` — the end-to-end test (new), reusing the existing
  cookie-jar `HttpClient`, `lib/db.seedAccount` and the Mailpit reader to put
  two devices on one account.

No new migration: the `sessions` table from
[`service/internal/db/migrations/0001_registry.sql`](../../../service/internal/db/migrations/0001_registry.sql)
already has `device`, `last_used_at` and `revoked_at`.

## Inherited dependencies

- **`service.passkeys`** (settled, Done 2026-10-07) — the direct dependency.
  It reuses `session.Issue` on register-finish and authenticate-finish, and it
  **added `session.Resolve`**, the read seam every authenticated route now
  calls inline (there is no generic session middleware; each handler calls
  `session.Resolve` itself, as the passkey list/remove handlers do). First-run
  account creation lives there, not here.
- **`service.email_links`** (settled, Done 2026-10-07) — introduced
  `session.Issue` and the `estante_session` cookie, fixing its attributes
  (HttpOnly, Secure, SameSite=Lax, Path=/). This task extends that seam; it
  does not re-introduce it. The package doc at
  [`service/internal/session/session.go:4`](../../../service/internal/session/session.go)
  already names `service.sessions` as the task that builds device listing,
  last-used display, revocation and sign-out on this same table and this same
  `Issue`.
- **`service.schema`** (settled, Done 2026-10-07) — the `accounts` and
  `sessions` tables, the forward-only embedded migrator, and the decision that
  **sessions are the signed-in devices; there is no separate `devices` table**.
- **The foundation three** (settled) — the Go module
  `estantedecifras.app/service`, the `server.Handler` mux with
  `LogRequests`/`NoIndex`, the OpenAPI contract (which already specifies all
  three endpoints and the `Session`/`SessionList` schemas), and the `e2e/api/`
  Vitest harness with its cookie-jar client, DB seeder and Mailpit reader.

## What this task is

The account-screen side of a session: list the devices this account is signed
in on, each with when it was last used; sign a device out from another device;
and sign out of the current device. The session row and the cookie already
exist — this task makes them manageable. It implements the three
already-contracted endpoints, derives the two fields the contract asks for that
aren't stored verbatim (`current`, whether a listed session is the request's
own; and a best-effort `device` label), and proves that a signed-out or revoked
device is refused at its next request (lazy revocation — the row is never
deleted to sign out).

## Why it needs to be done

Workflow 13 promises an account screen that lists signed-in devices and signs
out any of them — "A lost phone is signed out from the laptop, and its session
stops working at its next request"
([`docs/workflows/13-new-device.md:70`](../../../docs/workflows/13-new-device.md))
— and a this-device sign-out. Those are the three endpoints the contract
reserved but left unimplemented: `POST /api/auth/signout`,
`GET /api/account/sessions`, `DELETE /api/account/sessions/{sessionId}`
([`api/openapi.yaml:211`](../../../api/openapi.yaml)). The app's
`account.account_screen` and `account.sign_out` tasks cannot be built without
them. It is the last piece of the sign-in subsystem before the registry
(`service.books`) opens, which `service.sessions` unblocks.

## Inputs / context

- **The contract — the three endpoints** (already written, not yet routed):
  - `POST /api/auth/signout` → `signOut`, 204/401, "clears the session cookie"
    ([`api/openapi.yaml:211`](../../../api/openapi.yaml)).
  - `GET /api/account/sessions` → `listSessions`, 200 `SessionList`/401,
    "The signed-in devices, each with when it was last used"
    ([`api/openapi.yaml:222`](../../../api/openapi.yaml)).
  - `DELETE /api/account/sessions/{sessionId}` → `revokeSession`,
    204/401/404, "The revoked session stops working at its next request (lazy
    enforcement, workflow 13)"
    ([`api/openapi.yaml:237`](../../../api/openapi.yaml)).
  - `Session` = required `[id, lastUsedAt, current]` + optional `device`
    ("A short device description (e.g. \"Chrome on Linux\"), when known");
    `SessionList` = required `[sessions]`
    ([`api/openapi.yaml:946`](../../../api/openapi.yaml)).
  - `SessionId` path parameter ([`api/openapi.yaml:724`](../../../api/openapi.yaml)),
    `Unauthorized` and `NotFound` responses
    ([`api/openapi.yaml:768`](../../../api/openapi.yaml)); the global default
    security is the `estante_session` cookie.
- **The session seam**
  ([`service/internal/session/session.go`](../../../service/internal/session/session.go)):
  `CookieName = "estante_session"` (`:24`); `Issue(ctx, db, accountID, w)`
  inserts `INSERT INTO sessions (account_id) VALUES ($1) RETURNING id` and sets
  the cookie HttpOnly/Secure/SameSite=Lax/Path=/ (`:44`); `Resolve(ctx, db, r)`
  reads the cookie, rejects a non-uuid value locally, and runs one atomic
  `UPDATE sessions SET last_used_at = now() WHERE id=$1 AND revoked_at IS NULL
  RETURNING account_id` (`:76`) — absent/malformed/unknown/revoked is simply
  "not signed in". `Execer` (`:29`) is satisfied by both the pool and a `pgx.Tx`.
- **The table** ([`service/internal/db/migrations/0001_registry.sql:64`](../../../service/internal/db/migrations/0001_registry.sql)):
  `sessions(id uuid PK, account_id uuid NOT NULL REFERENCES accounts ON DELETE
  CASCADE, device text /* nullable, never written yet */, created_at,
  last_used_at NOT NULL DEFAULT now(), revoked_at timestamptz /* lazy
  revocation */)`. One row per signed-in device.
- **Workflow 13** ([`docs/workflows/13-new-device.md`](../../../docs/workflows/13-new-device.md)):
  "## The account screen" (`:68`) — "**Signed-in devices**, each with when it
  was last used, and **sign out** for any of them. A lost phone is signed out
  from the laptop, and its session stops working at its next request" (`:70`).
  "## Signing out" (`:75`) — the this-device sign-out and its remove-or-keep
  prompt; and "## Later" (`:83`) — device pairing by short code/QR, explicitly
  out of scope.
- **DIRECTION §3.3** ([`docs/DIRECTION.md:170`](../../../docs/DIRECTION.md)):
  "**One origin** for both: no CORS, a session cookie that simply flows";
  Postgres holds accounts, sessions and passkeys (`:184`); "**The browser only
  ever holds its session with the service**" (`:206`). **§3.6** names the
  service's "Signing in: … signing out; the signed-in devices and the passkeys,
  listed and removed (workflow 13)" as the API's sign-in surface
  ([`docs/DIRECTION.md:360`](../../../docs/DIRECTION.md)).
- **The handler/test conventions** the siblings established: handlers call
  `session.Resolve` inline and `writeJSON`/`writeError`/`writeUnauthorized`
  from `respond.go`; every response is validated against the contract via
  `apicontract.Load()`; behaviour tests get a freshly-migrated,
  uniquely-named schema (`migratedServerSchema(t)`), `t.Skip` when
  `ESTANTE_TEST_DATABASE_URL` is unset, and drive the real `server.Handler`
  through `httptest`; e2e tests are `e2e/api/<feature>.test.js` over the
  compose stack with the cookie-jar `HttpClient`.

## Constraints / requirements

- **Sessions are the devices.** Model a "device" as a `sessions` row; do not add
  a `devices` table (inherited from `service.schema`). "Sign out that device" is
  revoking that session row.
- **Lazy revocation; never delete to sign out.** Signing out or revoking sets
  `revoked_at = now()`; the row stays. `session.Resolve` already enforces this —
  a revoked row matches no `WHERE` clause and resolves to "not signed in" at the
  device's next request. No active push to the revoked device (matching workflow
  13's "stops working at its next request" and §3.7's "applies at next launch").
- **Account-scoped.** `revokeSession` may only act on a session belonging to the
  requesting account; a `sessionId` that is not one of the account's sessions
  (including a malformed or unknown id) is `404`, never a signal that someone
  else's session exists.
- **Contract-first.** The three endpoints, their statuses and the
  `Session`/`SessionList` shapes are fixed by `api/openapi.yaml`; every response
  conforms and is validated in the behaviour tests. No contract change.
- **One origin, the fixed cookie.** The `estante_session` cookie keeps its
  attributes (HttpOnly, Secure, SameSite=Lax, Path=/); the cookie that
  `signOut` clears carries the same attributes with an expiry in the past.
- **No song text — and no session value — in logs.** These routes carry no song
  text; the service logs request metadata only (`LogRequests`), never the
  cookie, the session id or the account id. Test fixtures use accounts seeded
  for the purpose.
- **No book without an account** is not exercised here (no book endpoints), but
  these endpoints are themselves the account gate every book request will later
  require: all three demand a resolved session (`401` otherwise).
- **Service-side only.** The this-device sign-out's remove-or-keep-the-books
  prompt and the counting of unsaved changes and unpushed saves are the app's
  concern — the Worker owns the working copy and the index, not the service
  (workflow 13 §Signing out; `account.sign_out`). The service's `signOut` ends
  the session and clears the cookie; it does not touch any working copy.

## Acceptance criteria

The behaviour delivered:

1. `POST /api/auth/signout` on a signed-in device → `204`, sets `revoked_at` on
   the current session, and clears the `estante_session` cookie (a Set-Cookie
   with a past expiry, same HttpOnly/Secure/SameSite=Lax/Path=/); the same
   cookie on a later request resolves to "not signed in". Unauthenticated →
   `401`.
2. `GET /api/account/sessions` → `200` `SessionList`: every non-revoked session
   for the account, most-recently-used first, each with `id`, `lastUsedAt`,
   `current` (exactly the request's own session is `true`), and `device` when a
   label could be derived. A signed-out/revoked session does not appear.
   Unauthenticated → `401`.
3. `DELETE /api/account/sessions/{sessionId}` for one of the account's own
   sessions → `204`; that session's next request → `401` (ended, lazily).
   A `sessionId` not belonging to the account, or malformed/unknown → `404`.
   Unauthenticated → `401`. Revoking one's own current session is allowed
   (`204`); the cookie is not cleared (that is `signOut`'s job), but the session
   stops resolving.
4. Signing in stores a best-effort `device` label derived from the request's
   `User-Agent`; an absent or unrecognised agent leaves `device` NULL (the
   contract's "when known") and the field is omitted.

The tests it lands with, by level:

- **unit** — `service/internal/session/device_test.go`: `describeDevice` over
  representative `User-Agent` strings (e.g. Chrome on Linux, Safari on iOS,
  Firefox on Windows) and the empty/unrecognised case → `""`; pins the
  contract's `Session.device` "when known" (`api/openapi.yaml:959`). (A level
  the task adds for the one pure helper it introduces — see Decisions.)
- **behavior** — `service/internal/server/sessions_test.go`, the real
  `server.Handler` through `httptest` against the compose Postgres,
  contract-validated via `apicontract.Load()`:
  - **the cookie HttpOnly, Secure, SameSite** — the suite's sign-in helper
    asserts the `estante_session` Set-Cookie attributes, and `signOut`'s
    clearing cookie carries the same attributes with a past expiry (DIRECTION
    §3.3 `:170`; the note's named behaviour).
  - **devices with last use** — two sessions on one account listed by
    `listSessions`, each with `lastUsedAt`, exactly one `current`, ordered most
    recent first, `device` populated; a revoked session absent; `401`
    unauthenticated (workflow 13 §The account screen `:70`;
    `api/openapi.yaml:222`, `946`).
  - **signing out another device ends its session** — account with two sessions;
    from session A, `DELETE .../{B}` → `204`, then a request carrying B's cookie
    → `401`; a `sessionId` outside the account → `404`; `signOut` → `204` +
    cleared cookie, the stale cookie then `401` (workflow 13 §The account screen,
    §Signing out; `api/openapi.yaml:211`, `237`).
  - **no session value logged** — the metadata-only log line for these routes
    carries no cookie or session id (reusing the `logging_test.go` assertion
    pattern; the standing no-song-text/no-secrets rule).
- **e2e-api** — `e2e/api/sessions.test.js`, black-box over the compose stack
  with the cookie-jar `HttpClient`:
  - **a session carried across calls** — sign in (emailed link via
    `lib/db.seedAccount` + the Mailpit reader, or a passkey), then
    `GET /api/account/sessions` on the same client → `200` with the current
    device present (the note's named e2e; DIRECTION §3.3 `:206`).
  - **a signed-out device refused** — `POST /api/auth/signout` → `204`, then the
    same client's next authenticated call → `401` (the note's named e2e).
  - **signing out another device** — two `HttpClient`s redeem links for one
    seeded account (two sessions); client A lists and `DELETE`s client B's
    session id; client B's next call → `401` (workflow 13 §The account screen).

## Decisions

1. **New `sessions.go` handler file, registered on the existing mux; no
   contract change.** The three endpoints, statuses and schemas are already in
   `api/openapi.yaml`; this task only implements and routes them. No design
   delta (the one service delta, email_links' SMTP wording, is already landed).
2. **`signOut` both revokes the current session and clears the cookie.** Setting
   `revoked_at` on the row *and* expiring the cookie, rather than only clearing
   the cookie. Alternative — clear the cookie only — rejected: a copied or
   cached cookie would still resolve, so "sign out" would not actually end the
   session. Revoking the row makes sign-out effective even if the cookie
   lingers, and costs one `UPDATE`.
3. **Populate `sessions.device` with a best-effort, dependency-free label.** A
   pure `describeDevice(userAgent)` helper derives a coarse "Browser on OS"
   label (a small hand-rolled classifier over the `User-Agent` header),
   extending `Issue` to take the request so it writes `device` at sign-in.
   - *Alternative A — a User-Agent-parsing library* — rejected: a new runtime
     dependency for a coarse, best-effort label runs against the service's
     stdlib-leaning, share-no-code posture; the label need only let a person
     tell their laptop from their phone.
   - *Alternative B — leave `device` NULL / defer labelling* — rejected: the
     workflow's scenario is "a lost phone is signed out from the laptop"
     (workflow 13 `:70`), which needs the devices to be *distinguishable*;
     `lastUsedAt` alone is a poor discriminator (two devices used minutes
     apart). The contract reserved `device` precisely for this. An unrecognised
     agent still falls back to NULL, so the helper is strictly additive.
4. **Extend `Issue`'s signature to carry the request (three call sites), rather
   than a new mint function.** The device label needs the `User-Agent`, which
   only the request has; `Issue` is the one place a session is born. The three
   existing callers (email redeem, passkey authenticate-finish, first-run
   register-finish) already hold `r`. This is an internal Go-seam change, not a
   contract or DIRECTION change — the package doc already anticipates
   `service.sessions` extending this seam.
5. **Derive `current` in the handler by comparing each row's id to the request's
   validated session cookie value.** `session.Resolve` has already validated the
   cookie (it resolved the account), so its value is the current session's id;
   `current = (row.id == cookieValue)`. Alternative — extend `Resolve` to also
   return the session id — deferred as unnecessary for the single call site; it
   would add a return value every other caller ignores.
6. **`listSessions` lists only non-revoked sessions, ordered by `last_used_at`
   descending.** A signed-out/revoked device is no longer a signed-in device, so
   it drops off the list; most-recently-used first matches "when it was last
   used" and puts the current device near the top.
7. **`revokeSession` is account-scoped and returns `404` for anything not the
   account's own session.** The `UPDATE ... WHERE id=$1 AND account_id=$2 AND
   revoked_at IS NULL` affecting zero rows (wrong account, unknown, malformed,
   already revoked) is a `404`; a malformed uuid is rejected before the query.
   This keeps one account from probing or revoking another's sessions. Revoking
   one's own current session is permitted (`204`) — a remote-style self-sign-out
   — distinct from `signOut`, which also clears the cookie on this device.
8. **Lazy revocation, inherited.** No active logout push; `session.Resolve`
   already refuses a revoked row at the next request, and the row is never
   deleted. This is the behaviour workflow 13 and §3.7 describe, and it needs no
   new code beyond setting `revoked_at`.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `service/internal/session/device.go` (new) — pure `describeDevice(userAgent)` classifier; derives a coarse "Browser on OS" label from the `User-Agent` header; unknown/empty agents return `""`.
- `service/internal/session/session.go` — `Issue` gains `r *http.Request` to write `device` at sign-in; new `Revoke` (sets `revoked_at`), `ClearCookie` (clears the `estante_session` cookie with a past expiry), and shared `writeCookie` helper.
- `service/internal/server/sessions.go` (new) — `handleSignOut`, `handleListSessions`, `handleRevokeSession`, plus `sessionJSON` and `sessionList` helpers; all three call `session.Resolve` inline and validate responses via `apicontract.Load()`.
- `service/internal/server/server.go` — routes the three endpoints on the existing mux (`POST /api/auth/signout`, `GET /api/account/sessions`, `DELETE /api/account/sessions/{sessionId}`).
- `service/internal/server/email_links.go`, `service/internal/server/passkeys.go` — three `session.Issue` call sites updated to the new signature (email redeem, passkey authenticate-finish, first-run register-finish).
- `service/internal/session/device_test.go` (new) — unit tests for `describeDevice` over Chrome/Linux, Safari/iOS, Firefox/Windows, Chrome/Android, Edge/Windows, and empty/unrecognised/browser-only cases.
- `service/internal/server/sessions_test.go` (new) — behavior tests: cookie attributes; devices with last use (order, current flag, device label, revoked absent, 401); revoking another device (204→401, 404 cross-account/malformed, signOut flow); no session value in logs.
- `e2e/api/sessions.test.js` (new) — e2e-api tests: session carried across calls; signed-out device refused at next request; signing out another device from a second client.
