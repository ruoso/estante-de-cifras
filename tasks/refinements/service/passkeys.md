# service.passkeys — Passkeys (register, sign in, several per account)

## TaskJuggler entry

[`tasks/30-service.tji`](../../30-service.tji), task `service.passkeys`
(lines 15–20):

```
task passkeys "Passkeys" {
  effort 3d
  allocate team
  depends !schema
  note "go-webauthn: register and sign in, the browser's own cross-device QR
  flow, several passkeys per account. Workflow 13. Tests: unit (the go-webauthn
  wiring with a software authenticator); behavior (register, sign in, a second
  passkey, an unknown credential refused — httptest against Postgres); e2e-api
  (register and sign in over HTTP against the stack with a software
  authenticator)."
}
```

## Effort estimate

3 days (unchanged from the WBS).

## Repository

**estante-de-cifras.** The work lands in the Go service and its contract:

- `service/internal/passkey/` — new package: the go-webauthn configuration,
  the `webauthn.User` adapter over the `accounts`/`passkeys` rows, credential
  (de)serialisation, and the signed begin→finish state codec.
- `service/internal/server/passkeys.go` (+ `passkeys_test.go`) — the six HTTP
  handlers, registered on the existing mux.
- `service/internal/session/session.go` — a minimal session-**read** seam
  (`Resolve`) beside the existing `Issue`.
- `service/internal/config/config.go` — the RP-ID and state-secret config.
- `service/go.mod` / `go.sum` — adds `github.com/go-webauthn/webauthn`.
- `compose.yaml`, `scripts/gate` — the new `ESTANTE_*` vars for the container
  and the test stack.
- `e2e/api/passkeys.test.js` + `e2e/api/lib/authenticator.js` (+ the
  `e2e/api/package.json` / lockfile entry for a CBOR helper) — the black-box
  flow with a software authenticator.

The contract (`api/openapi.yaml`) is **already cut** for passkeys — no edit to
it is expected (see Inputs). The `passkeys` table is **already created** in
migration `0001_registry.sql` — no new migration is expected (see Decisions).

No work lands in cifra.md. The app and the service share no code (DIRECTION
§3.6): the app's passkey UI is `account.sign_in` and `account.account_screen`,
which consume these endpoints over the contract — not this task.

## Inherited dependencies

**Settled:**

- `service.schema` (the `!schema` dependency) — `accounts`, `passkeys` and
  `sessions` tables, the pgx pool, and the forward-only embedded migrator are
  landed. See `service/internal/db/migrations/0001_registry.sql:37–71` and
  `tasks/refinements/service/schema.md`.
- `service.email_links` (a de-facto predecessor — landed first, not a formal
  `depends`) owns the seams this task reuses: `session.Issue` and the
  `estante_session` cookie
  (`service/internal/session/session.go:22,42`), the `APIDeps` DI struct and
  route-registration pattern (`service/internal/server/email_links.go:27`,
  `server.go:39–61`), the `respond`/`decodeStrict` helpers
  (`service/internal/server/respond.go`,
  `service/internal/server/email_links.go:172`), the `ESTANTE_*` config
  pattern (`service/internal/config/config.go`), and the HMAC-signed,
  short-lived, single-purpose token pattern
  (`service/internal/emaillink/token.go`). See
  `tasks/refinements/service/email_links.md`.
- `foundation.api_contract` — the passkey operations, schemas and the
  `sessionCookie` scheme in `api/openapi.yaml`, and the Go validator
  `apicontract.Validate` (`api/validate.go`).
- `foundation.e2e_api` — the `e2e/api/` Vitest harness, `HttpClient` cookie
  jar (`e2e/api/lib/http.js`), and the compose stack (`compose.yaml`,
  `scripts/gate`).
- `foundation.service_skeleton` — `server.Handler`, the `ServeMux`, the
  `LogRequests`/`NoIndex` middlewares.

**Pending (downstream, not blockers):**

- `service.sessions` (`depends !passkeys`) builds the signed-in-devices
  management (list, last-used, revoke) and the `signOut` handler on the same
  `sessions` table and the session seam this task extends.
- `account.sign_in`, `account.account_screen` (`depends service.passkeys`)
  are the app-side consumers of these endpoints (workflows 7, 13).

## What this task is

Implement, in the Go service, the server half of WebAuthn passkey sign-in,
using `go-webauthn`:

- **Register a passkey** (begin/finish). With no session, `finish` creates a
  new account and starts a session — this is the first-run account-creation
  path. With a session, it adds a passkey to that account ("several passkeys
  per account").
- **Sign in with a passkey** (begin/finish) via discoverable credentials — no
  username is sent; the authenticator offers the account. On success, a
  session is started.
- **The cross-device QR flow** needs nothing in the service beyond standard
  WebAuthn (workflow 13 line 22): the browser drives it; the service only sees
  a standard assertion at `authenticate/finish`.
- **List and remove** the account's passkeys (the account screen, workflow 13
  line 73).

The six endpoints are already named and shaped in the contract; this task
writes the handlers, the go-webauthn wiring, a `webauthn.User` adapter over the
registry rows, a stateless begin→finish state codec, and a minimal
session-read seam the authenticated routes need.

## Why it needs to be done

Passkeys are the primary way into an account (workflow 13; DIRECTION §3.3
"a passkey for the one domain"). The emailed link (`service.email_links`,
landed) is explicitly the *fallback and recovery* path — it signs in only an
account that already exists and never creates one
(`tasks/refinements/service/email_links.md`, §Decisions). **First-run account
creation lives here.** Until this task lands, there is no way to create an
account at all, so every downstream account/book/sharing flow is blocked:
`service.sessions`, `account.sign_in`, `account.account_screen`,
`account.new_device`, and the whole books/sharing tier past them.

## Inputs / context

**The WBS task.** `tasks/30-service.tji:15–20`.

**Governing documents (normative):**

- **Workflow 13** (`docs/workflows/13-new-device.md`), §Signing in on another
  device (lines 10–27): the three cases — *same ecosystem* (the synced passkey
  is offered, confirm with face/finger; label *Sign in*, lines 15–19),
  *another ecosystem* (the browser's own *use a phone or tablet* QR flow —
  "Nothing in the app beyond standard WebAuthn … the app offers to make a
  passkey on the laptop," lines 20–24), and *neither* (the emailed link,
  lines 25–27). §The account screen (lines 69–73): "**Passkeys**, listed, and
  removable." Multiple passkeys per account are implied by lines 24 and 73;
  the workflow sets **no explicit cap**, **no per-passkey device naming** (only
  an optional `label`), and **no copy for an unknown/failed credential** — the
  refusal behaviour is this task's call (see Decisions).
- **DIRECTION §3.3** (`docs/DIRECTION.md:153–222`): one service, one origin,
  `estantedecifras.app`, HTTPS-only, "a PWA and passkeys need [it] anyway"
  (lines 160–162); "**One origin** … a session cookie that simply flows, and a
  passkey for the one domain" (lines 170–173); Postgres "holds accounts,
  sessions and passkeys" (line 184). The per-user no-reply authoring address
  `<user-id>@users.estantedecifras.app` (lines 164–165) is derived from the
  account id, not stored.
- **DIRECTION §3.6** (`docs/DIRECTION.md:277–372`): the library stack names
  "**`go-webauthn` for passkeys**" (lines 313–316) — the dependency is
  pre-decided, not a design delta. The API bullet (lines 360–362):
  "**Signing in**: registering a passkey and signing in with one; … the
  signed-in devices and the passkeys, listed and removed (workflow 13)."
- **DIRECTION §3.4** (`docs/DIRECTION.md:224–254`): sign-in is part of the
  stateless tier that scales out first (lines 243–245) — a reason to keep the
  begin→finish challenge off persistent storage (see Decisions).

**The contract (already cut) — `api/openapi.yaml`:**

- `POST /api/auth/passkey/register/begin` — `registerPasskeyBegin`
  (lines 62–88). `security: [{}, sessionCookie]` (public **or** authed). Body
  `PasskeyRegisterBeginRequest` (optional `label`, line 861). `200` →
  `CredentialCreationOptions` (`publicKey` + opaque `state`, line 870); `400`.
- `POST /api/auth/passkey/register/finish` — `registerPasskeyFinish`
  (lines 90–115). `security: [{}, sessionCookie]`. Body `PasskeyFinishRequest`
  (`state`, `credential`, optional `label`, line 909). `200` → `Account`
  (`{id}`, line 852); `400`.
- `POST /api/auth/passkey/authenticate/begin` — `authenticatePasskeyBegin`
  (lines 117–138). `security: [{}]` (public). Body
  `PasskeyAuthenticateBeginRequest` (empty — discoverable, line 903). `200` →
  `CredentialRequestOptions` (line 888); `400`.
- `POST /api/auth/passkey/authenticate/finish` — `authenticatePasskeyFinish`
  (lines 140–162). `security: [{}]`. Body `PasskeyFinishRequest`. `200` →
  `Account`; `401`.
- `GET /api/account/passkeys` — `listPasskeys` (lines 255–268). `200` →
  `PasskeyList` (`Passkey` = `{id, createdAt, label?, lastUsedAt}`, lines
  973–997); `401`.
- `DELETE /api/account/passkeys/{passkeyId}` — `removePasskey`
  (lines 270–283); `204`; `401`; `404`. Param `PasskeyId` (lines 730–735).
- `sessionCookie` scheme: apiKey cookie `estante_session` (lines 700–707).
  Global default `- sessionCookie: []` (line 55).

**The schema (already created) — `service/internal/db/migrations/0001_registry.sql`:**

- `accounts` (lines 37–41): `id uuid pk`, `email text UNIQUE` (**nullable**),
  `created_at`.
- `passkeys` (lines 46–59): `id uuid pk`, `account_id uuid NOT NULL REFERENCES
  accounts ON DELETE CASCADE`, `credential_id bytea NOT NULL UNIQUE`,
  `public_key bytea NOT NULL`, `sign_count bigint NOT NULL DEFAULT 0`,
  `aaguid bytea`, `transports text[]`, `backup_eligible bool`,
  `backup_state bool`, `label text`, `created_at`, `last_used_at`. The comment
  (lines 43–45) states these are "the WebAuthn credential go-webauthn stores."
- `sessions` (lines 64–71): `id`, `account_id`, `device`, `created_at`,
  `last_used_at`, `revoked_at` (nullable). Revocation is lazy at the next
  request.

**The seams to reuse:**

- `service/internal/session/session.go:42` —
  `Issue(ctx, db session.Execer, accountID string, w http.ResponseWriter)`;
  `CookieName = "estante_session"` (line 22). Its package doc (lines 4–9)
  already states service.passkeys reuses `Issue`.
- `service/internal/server/server.go:39–61` — `Handler(logger, appRoot, ready,
  api *APIDeps)`; the `if api != nil` block (lines 48–53) is where
  `/api/auth/email/*` register and where the passkey routes join. `ServeMux`
  longest-prefix match lets `/api/…` win over the app at `/`.
- `service/internal/server/email_links.go:27` — `APIDeps{ DB, Mailer,
  LinkSecret, PublicBaseURL }`; the redeem handler (lines 117–161) is the
  template: `decodeStrict` → DB work → `session.Issue` → `writeJSON(…Account)`.
- `service/internal/server/respond.go` — `writeJSON` (line 20), `writeError`
  (line 28), `errorBody` (line 12); `writeUnauthorized` and `decodeStrict` in
  `email_links.go:165,172`.
- `service/internal/config/config.go` — `Config` struct and `Load(lookup)`;
  `PublicBaseURL` (`ESTANTE_PUBLIC_BASE_URL`), `LinkSecret` (required) as the
  pattern for a new required secret.
- `service/internal/emaillink/token.go` — `Mint`/`Parse` (HMAC-SHA256),
  `CheckState`: the pure-core signed-token pattern the state codec mirrors.
- `api/validate.go` — `apicontract.Contract.Validate(operationID, direction,
  status, payload)` for conformance assertions in behavior tests.

**Test precedents:**

- `service/internal/server/email_links_test.go` — behavior tests driving the
  real `Handler` through `httptest` against a per-test, uniquely-named migrated
  Postgres schema (`ESTANTE_TEST_DATABASE_URL`; `t.Skip` when unset), with a
  fake collaborator. The passkey behavior tests mirror this, with a Go
  software authenticator in place of the fake mailer.
- `e2e/api/email-links.test.js` with `e2e/api/lib/http.js` (`HttpClient`) and
  `e2e/api/lib/db.js` (`seedAccount`) — the black-box shape.
- `scripts/gate`: `cd api && go test ./... && npm test`; `cd service && go vet
  ./... && go test -p N ./...` (behavior, against the live stack's Postgres);
  `cd e2e/api && npm test` (against the compose stack).

**Standing-rule context:**

- `tasks/parking-lot.md`, 2026-10-07 "Where `accounts.email` is first written"
  — a passkey account is created here with `accounts.email = NULL`; the
  recovery-email write path is an unscoped **product** question already parked.
  This task does not decide it (see Decisions).

## Constraints / requirements

- **Component boundary (DIRECTION §3.6).** The service and the app share no
  code — only the contract. This task writes Go only; it must not add an
  app-facing or cross-language artefact. The WebAuthn `publicKey` options and
  the `credential` are passed as the standard WebAuthn JSON the contract leaves
  `additionalProperties: true` (`api/openapi.yaml:878–882, 918–921`); the
  service owns their exact shape via go-webauthn.
- **One origin, one cookie (DIRECTION §3.3).** No CORS. Sessions are started
  only through `session.Issue`, which sets `estante_session`
  HttpOnly/Secure/SameSite=Lax/Path=/. The passkey RP is the one domain.
- **No book without an account** does not bite here directly, but **account
  creation is the gate for it**: an account is created only by a successful
  `registerPasskeyFinish` (or an accepted invitation elsewhere), never by a
  begin call and never speculatively.
- **No song text / no secrets in logs (DIRECTION §3.3).** The handlers log
  nothing beyond the metadata `LogRequests` already records; a `credential`, a
  challenge, a `state` token, a `credential_id`, a public key and an account id
  are never logged, never echoed in an `Error` body. The `Error` shape carries
  only a stable `code` and a safe `message`.
- **Contract-first.** Every response conforms to `api/openapi.yaml`; the status
  set is exactly what each operation defines (e.g. `authenticate/finish` is
  `200`/`401` only, so every non-success — malformed body, unknown credential,
  bad assertion — is a `401`, as `redeemEmailLink` does for its route).
- **Reuse before building.** Reuse `session.Issue`, `APIDeps`, `decodeStrict`,
  `writeJSON`/`writeError`/`writeUnauthorized`, the config and signed-token
  patterns. Register routes on the existing mux; add no third-party router.
- **Stateless-tier friendly (DIRECTION §3.4).** The begin→finish challenge is
  not written to Postgres (see Decisions).
- **Tests land with the task**, at the three levels the note names (below);
  none deferred.
- **Adding dependencies needs the lockfile + network.** `go get
  github.com/go-webauthn/webauthn` (service `go.mod`/`go.sum`) and the e2e CBOR
  helper (`e2e/api` lockfile) must be resolved with network access at
  implementation time; `go.sum` and `package-lock.json` are committed so the
  gate's `go build`/`npm ci` stay offline-reproducible
  (cf. [[adding-npm-deps-needs-lockfile-and-network]]).

## Acceptance criteria

**Behaviour delivered:**

1. `registerPasskeyBegin` with no session returns `CredentialCreationOptions`
   for a fresh user handle and an opaque `state`; with a session, it returns
   options for the signed-in account with the account's existing credentials in
   `excludeCredentials`.
2. `registerPasskeyFinish` verifies the attestation and the `state`; with no
   session it creates an `accounts` row (`email = NULL`), inserts the
   `passkeys` row, starts a session and returns the `Account`; with a session
   it inserts the passkey for that account and returns the `Account`. A
   duplicate credential (unique `credential_id`) is refused.
3. `authenticatePasskeyBegin` returns `CredentialRequestOptions` for
   discoverable sign-in (no username) and an opaque `state`.
4. `authenticatePasskeyFinish` verifies the assertion against the stored
   credential, advances `sign_count`, updates `last_used_at`, starts a session
   and returns the `Account`. An **unknown credential** (no matching
   `credential_id`), a bad signature, a replayed/stale `state` or a malformed
   body is refused `401` with no session.
5. `listPasskeys` returns the signed-in account's passkeys (`PasskeyList`);
   `removePasskey` deletes one of the caller's passkeys (`204`), `404` for an
   id not on the caller's account; both `401` without a valid session.

**Tests the task lands with, by level:**

- **unit** — `service/internal/passkey/`:
  - `state_test.go` — the signed state codec seals and opens go-webauthn
    `SessionData`, and rejects a tampered, truncated or expired handle (pins
    the `state` of `CredentialCreationOptions`/`CredentialRequestOptions`,
    `api/openapi.yaml:870–901`).
  - `credential_test.go` — `webauthn.Credential` ↔ `passkeys` columns round-trip
    (credential id, public key, sign count, AAGUID, transports, backup flags),
    and the `webauthn.User` adapter exposes the right id/credentials (pins the
    `passkeys` columns of `0001_registry.sql:46–59`).
  - `webauthn_test.go` — the go-webauthn config builder (RP ID and origins from
    config), and begin→finish driven by a **Go software authenticator** (ES256,
    `none` attestation) with no DB: a registration yields a credential, an
    assertion verifies, an advancing sign-count is accepted and a tampered
    assertion rejected (pins "the go-webauthn wiring with a software
    authenticator", DIRECTION §3.6 line 314).
  - `config_test.go` (extended) — `ESTANTE_WEBAUTHN_RP_ID` and the state secret
    load and are validated (pins the config seam).
- **behavior** — `service/internal/server/passkeys_test.go` (real `Handler`
  via `httptest` against a per-test migrated Postgres schema, the Go software
  authenticator):
  - register creating a new account (no session) → `200` `Account`,
    `estante_session` set, one `accounts` + one `passkeys` row (workflow 13;
    `registerPasskeyBegin`/`Finish`; DIRECTION §3.3).
  - sign in with that passkey from a fresh client → `200`, same account id,
    session set (workflow 13 §same ecosystem; `authenticate` begin/finish).
  - a **second passkey** added to the signed-in account → `200`, two `passkeys`
    rows; the first appears in `excludeCredentials` of the second begin
    (workflow 13 lines 24, 73 — several per account).
  - an **unknown credential** at `authenticate/finish` → `401`, no session (the
    note's "an unknown credential refused").
  - `listPasskeys` lists the account's passkeys; `removePasskey` removes one
    and `404`s for an id not on the account; both `401` without a session
    (workflow 13 line 73; `listPasskeys`/`removePasskey`).
  - responses validate against the contract via `apicontract.Validate` for the
    passkey operations.
- **e2e-api** — `e2e/api/passkeys.test.js` (Vitest, `HttpClient`, a JS
  **software authenticator** helper `e2e/api/lib/authenticator.js` built on
  Node WebCrypto + a small CBOR encoder):
  - **register over HTTP**: `register/begin` → `authenticator.create(options)`
    → `register/finish` → `200`, `HttpClient` now carries `estante_session`,
    and `GET /api/account/passkeys` succeeds (workflow 13; DIRECTION §3.6 one
    origin).
  - **sign in over HTTP**: a fresh `HttpClient` → `authenticate/begin` →
    `authenticator.get(options)` → `authenticate/finish` → `200`, same account
    id, session carried (workflow 13).
  - an **unknown credential** → `401` (the note's refusal).
  - fixtures are synthetic accounts created by the flow itself (no seeded
    email); no real address, no song text.

**No tech-debt deferred.** The `signOut` handler and signed-in-device
listing/revocation are `service.sessions` (already a WBS leaf, `depends
!passkeys`); passkey/sign-in rate limits are `service.rate_limits` (already a
WBS leaf). Device pairing from an already-signed-in device is workflow 13
§Later (design, not scoped). The recovery-email write path is already parked
(human product call, `tasks/parking-lot.md` 2026-10-07). This task registers no
new follow-up leaf.

## Decisions

1. **`go-webauthn` is the WebAuthn library — pre-decided, not a design delta.**
   DIRECTION §3.6 line 314 names it. Added to `service/go.mod` via `go get
   github.com/go-webauthn/webauthn`; `go.sum` committed. No alternative
   considered — the direction fixed it.

2. **No new migration.** `0001_registry.sql:46–59` already has exactly the
   go-webauthn credential columns. The handlers map `webauthn.Credential` onto
   them directly. A `0003_*.sql` is added only if a concrete column turns out
   missing during implementation — not expected.

3. **The begin→finish challenge is a stateless, HMAC-signed, short-lived
   `state` token — not a server-side `SessionData` store.** The codec seals
   go-webauthn's `SessionData` (challenge, allowed credentials, UV flag, user
   handle) into the opaque `state` the contract returns, verified and
   expiry-checked at `finish` — mirroring `emaillink.Mint`/`Parse`.
   *Rationale:* the contract already models `state` as "an opaque handle to
   echo to finish" (`api/openapi.yaml:883–886`); keeping the transient
   challenge off Postgres matches the stateless tier (DIRECTION §3.4) and needs
   no migration or sweeper. *Alternative rejected:* a `webauthn_sessions`
   table keyed by a random handle — the textbook approach, but it adds a
   transient table and its cleanup for a value that lives seconds, buying
   strict single-use that the threat model does not need here (a short expiry
   bounds replay; a registration replay fails on the unique `credential_id`; an
   authentication replay would only re-mint the legitimate user's own session,
   and requires intercepting an HTTPS one-origin assertion). A **short
   expiry** (≈5 min) is set in the sealed blob.

4. **A dedicated signing secret `ESTANTE_WEBAUTHN_STATE_SECRET`**, loaded and
   required like `ESTANTE_LINK_SECRET`, added to `compose.yaml` and
   `scripts/gate`. *Rationale:* single-purpose HMAC keys; do not overload
   `LinkSecret` across two token types. The state codec lives in
   `internal/passkey`, not `internal/emaillink`.

5. **RP ID and origins are config-driven.** `ESTANTE_WEBAUTHN_RP_ID` (the
   effective domain; `estantedecifras.app` in production, `localhost` in
   compose/dev) and the RP origins derived from `PublicBaseURL`; RP display
   name a fixed "Estante de Cifras". *Rationale:* DIRECTION §3.3 ties the
   passkey to the one domain, but dev runs on `localhost` over the compose
   stack — a hard-coded RP ID would make either production or the e2e stack
   fail WebAuthn origin validation. *Alternative rejected:* deriving the RP ID
   from the request `Host` — spoofable and surprising; config is explicit.

6. **User-verification `preferred`, attestation `none`, resident key
   `required`.** *UV preferred:* platform authenticators verify with
   biometrics ("face or finger", workflow 13 line 19) but `required` would lock
   out roaming keys without a UV gesture; `preferred` is the passkey norm.
   *Attestation none:* we store no attestation statement and want no device
   fingerprinting — privacy-preserving and standard for passkeys. *Resident key
   required:* discoverable credentials are the point — `authenticate/begin`
   sends no username (`PasskeyAuthenticateBeginRequest` is empty,
   `api/openapi.yaml:903–907`), so the credential must be discoverable. These
   are left undecided by the docs; this is the defensible WebAuthn-standard
   call.

7. **First-run account creation lives here; email stays null.** A successful
   `registerPasskeyFinish` with no session creates the `accounts` row with
   `email = NULL` (the column is nullable, `0001_registry.sql:39`) and starts a
   session. The WebAuthn **user handle is the account UUID bytes** — stable and
   non-PII, never an email (so a lost or late-set email never changes a
   credential's binding). The authenticator's display name uses the account's
   `email` when present, else a short account label (cosmetic, shown only in the
   authenticator UI). *Why here:* `service.email_links` explicitly declined to
   create accounts (its refinement §Decisions); the recovery-email write path
   is a separate, parked product question (`tasks/parking-lot.md` 2026-10-07) —
   not blocked by, and not decided by, this task.

8. **Scope includes `listPasskeys` and `removePasskey` (server side).** The
   contract files them under the `Sign-in` tag (`api/openapi.yaml:255–283`),
   workflow 13 line 73 pairs them with registration ("listed, and removable"),
   and no other service leaf owns them; they also share this task's
   session-read seam. The *UI* is `account.account_screen` (app, over the
   contract). *Alternative rejected:* leaving them for `service.sessions` —
   that task is about devices/sessions, not passkeys, and would need the same
   go-webauthn-adjacent row mapping this task already builds.

9. **A minimal session-**read** seam `session.Resolve` is introduced here**,
   beside `Issue`: it reads the `estante_session` cookie, selects the account
   for a non-revoked `sessions` row, and bumps `last_used_at`; absent/unknown/
   revoked → not signed in. The authenticated routes (`register/*` with a
   session, `listPasskeys`, `removePasskey`) use it. *Rationale:* `Issue`
   writes but nothing reads yet; this mirrors how `service.email_links`
   introduced the minimal `Issue` before `service.sessions`, as the session
   package doc already anticipates (`session.go:4–9`). `service.sessions`
   extends the same seam with device listing, last-used display, revocation and
   `signOut`. *Alternative rejected:* blocking on `service.sessions` for the
   read path — it `depends !passkeys`, so that would invert the WBS order.

10. **Software authenticators are written as test helpers in this task** — a Go
    one (ES256, `none` attestation, CBOR attestation object, assertion signing)
    used by the unit and behavior tests, and a JS one
    (`e2e/api/lib/authenticator.js`, Node WebCrypto + a small CBOR encoder) for
    e2e-api. The note names "a software authenticator" at every level; there is
    no off-the-shelf standalone authenticator for either runtime, so each is a
    small purpose-built helper (like the Mailpit reader before it), not a new
    runtime dependency of the service.

## Open questions

(none — all decided.)

## Status

**Done** — 2026-10-07.

- `service/internal/passkey/passkey.go` — go-webauthn RP configuration builder (RP ID and origins from config, UV preferred, attestation none, resident key required).
- `service/internal/passkey/state.go` + `state_test.go` — HMAC-signed, short-lived `state` codec sealing/opening go-webauthn `SessionData`; tamper, truncation and expiry rejection tested.
- `service/internal/passkey/credential.go` + `credential_test.go` — `webauthn.Credential` ↔ `passkeys` columns round-trip; `webauthn.User` adapter over account rows.
- `service/internal/passkey/user.go` — user handle as account UUID bytes.
- `service/internal/passkey/webauthn_test.go` — go-webauthn config builder and begin→finish via the Go software authenticator (ES256, `none` attestation, no DB).
- `service/internal/webauthntest/authenticator.go` — Go software authenticator for unit and behavior tests.
- `service/internal/server/passkeys.go` + `passkeys_test.go` — six HTTP handlers (register/begin, register/finish, authenticate/begin, authenticate/finish, list, remove); behavior tests via `httptest` against real Postgres with the software authenticator; contract-validated with `apicontract.Validate`.
- `service/internal/session/session.go` — `Resolve` read-seam added alongside `Issue`.
- `service/internal/config/config.go` + `config_test.go` — `ESTANTE_WEBAUTHN_RP_ID` and `ESTANTE_WEBAUTHN_STATE_SECRET` added.
- `service/internal/server/server.go` — passkey routes registered on the mux.
- `service/internal/server/email_links.go` — `APIDeps.Passkeys` field added.
- `service/cmd/service/main.go` — RP wired via `APIDeps`.
- `service/go.mod` / `service/go.sum` — go-webauthn v0.17.4, uuid, fxamacker/cbor, api-module replace added.
- `compose.yaml` / `scripts/gate` — `ESTANTE_WEBAUTHN_RP_ID` and `ESTANTE_WEBAUTHN_STATE_SECRET` vars added.
- `e2e/api/lib/authenticator.js` + `e2e/api/passkeys.test.js` — JS software authenticator (Node WebCrypto + CBOR); three e2e-api flows (register, sign in, unknown credential).
- `e2e/api/package.json` / `e2e/api/package-lock.json` — cbor2 added.
- `.dockerignore` / `Dockerfile` — `api/` included in build context for the `../api` module replace (fixer fix).
