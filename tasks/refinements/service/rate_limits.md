# service.rate_limits — Rate limits

## TaskJuggler

`service.rate_limits` in [`tasks/30-service.tji`](../../30-service.tji) (task
`rate_limits`, under `task service`):

> Rate limits — Sign-in attempts, emailed links, book creation, invitations
> accepted. Tests: unit (the limiter's windows); behavior (each limit trips at
> its threshold through httptest and recovers); e2e-api (repeated sign-in
> attempts limited against the stack).

## Effort

1d.

## Repository

estante-de-cifras. All code lands in `service/` (a new
`service/internal/ratelimit` package, a client-IP helper in
`service/internal/server`, the four handlers under
`service/internal/server/`, `service/internal/config`,
`service/cmd/service/main.go`) plus the contract in `api/openapi.yaml` (a 429
response on the throttled routes). A same-commit design delta amends
`docs/DIRECTION.md` §3.3 (below). No work lands in cifra.md — the `.tji` note
does not start with `cifra.md:`.

## Inherited dependencies

Settled (all `complete 100`):

- **`service.sessions`** (the declared `depends`) — `session.Resolve(ctx, db,
  r) → (accountID, ok, err)` (`service/internal/session/session.go:128`), the
  inline session gate every authenticated handler already calls as its first
  line; it yields the account id the account-keyed limits need.
- **`service.email_links`** — the two sign-in endpoints
  (`service/internal/server/email_links.go:67` request, `:141` redeem), the
  `APIDeps` struct (`email_links.go:29`), the response helpers
  (`service/internal/server/respond.go`), `decodeStrict`
  (`email_links.go:196`), and the no-secrets logging rule
  (`service/internal/server/logging.go:42`).
- **`service.passkeys`** — `handleAuthenticatePasskeyFinish`
  (`service/internal/server/passkeys.go:238`), the second sign-in surface; the
  Go software authenticator (`service/internal/webauthntest/authenticator.go`)
  and the `newBooksEnv(t)` passkey-minting behavior env.
- **`service.books`** — `handleCreateBook`
  (`service/internal/server/books.go:76`) and `handleForkBook`
  (`books.go:307`), both of which create a book; the `newBooksEnv(t)` behavior
  fixture (`service/internal/server/books_test.go:42`); the e2e git/http libs.
- **`service.sharing`** — `handleAcceptInvitation`
  (`service/internal/server/sharing.go:422`) and the token redactor
  `redactInvitationToken` (`logging.go:63`).

No pending dependencies: the four flows this task throttles all exist and are
complete, so every named test can be driven today (see Acceptance criteria).

## What this task is

Add request-rate limiting to the four abuse-prone endpoints the service
already serves, so a caller cannot hammer them. Concretely:

1. a small in-memory fixed-window limiter (`service/internal/ratelimit`), a
   pure module keyed by an opaque string, with injectable time for testing;
2. a proxy-aware client-IP helper so the IP a limit keys on is the real client,
   not Railway's edge;
3. a `Limiter` field on `APIDeps`, built once in `main.go`, consulted inline at
   the top of each of the four handlers (the same shape as the inline
   `session.Resolve` gate — there is no middleware);
4. a `429 Too Many Requests` with the contract's `Error` body
   (`{code:"rate_limited", …}`) and a `Retry-After` header, added to the
   throttled routes in `api/openapi.yaml`.

The four limits:

| What | Endpoint(s) | Keyed by | Counts |
| --- | --- | --- | --- |
| Sign-in attempts | `POST /api/auth/email/redeem`, `POST /api/auth/passkey/authenticate/finish` | client IP | **failed** attempts only (401) |
| Emailed sign-in link | `POST /api/auth/email/request` | address **and** client IP | every request |
| Book creation | `POST /api/books`, `POST /api/books/{bookId}/fork` | account | every authenticated attempt |
| Invitation acceptance | `POST /api/invitations/{token}/accept` | account | every authenticated attempt |

## Why it needs to be done

The service runs as one small instance with users' data in it (DIRECTION
§3.3–§3.4). Three of these endpoints are unauthenticated and the fourth sends
mail or creates storage, so without a cap a single client can brute-force
sign-in, flood a mailbox with sign-in links, or spin up books and memberships
as fast as it can post. Workflow 14 already commits the product to
rate-limiting book creation (`docs/workflows/14-file-view.md:42-43`: "100 books
and 200 MB per account, forks included, **with creating books
rate-limited**"); the other three are the same class of protection, named by
this task. It is a leaf task that the `m5_complete` milestone
(`tasks/99-milestones.tji:44`) depends on; nothing depends on it in turn.

## Inputs / context

Governing documents:

- **DIRECTION §3.3** "The one server" (`docs/DIRECTION.md:153-218`) — one Go
  service, one origin, the registry in Postgres, the abuse-protection story
  (session + membership, the fifty-person cap, `noindex`). This task adds the
  rate-limiting paragraph (design delta below).
- **DIRECTION §3.4** "One instance" (`docs/DIRECTION.md:224-254`) — a single
  instance owns the git volume; "the load is small". This is why the limiter
  is in-memory: there is one process, so there is nowhere else the counts need
  to live, and no distributed store to coordinate.
- **Workflow 14 §Limits** (`docs/workflows/14-file-view.md:38-47`) — the
  book-creation rate limit; the storage caps (100 books / 200 MB) are a
  separate, absolute cap already enforced in `handleCreateBook`
  (`books.go:119-120`, `413 too_large`). The rate limit is a *velocity* guard
  layered on top of that *total* cap, not a replacement.
- **Workflow 13** (`docs/workflows/13-new-device.md`) — the sign-in flows
  (synced passkey, cross-device passkey, emailed link). It says nothing about
  failed attempts or lockouts; this task adds the throttle invisibly, below the
  flows the workflow draws.

Code seams (all in `service/`):

- Routing + middleware: `service/internal/server/server.go:39` (`Handler`),
  the four routes at `:51` (email request), `:52` (email redeem), `:68`
  (create book), `:70` (fork), `:90` (accept invitation), `:107-108` (passkey
  authenticate begin/finish). The only wrappers are `LogRequests(logger,
  NoIndex(mux))` at `server.go:119`; there is no auth middleware.
- DI: `APIDeps` (`service/internal/server/email_links.go:29-56`), captured by
  every `handleXxx(api *APIDeps) http.HandlerFunc` closure and built in
  `service/cmd/service/main.go` (the `api := &server.APIDeps{…}` block).
- Responses: `writeError(w, status, code, message)` and `errorBody{Code,
  Message}` (`service/internal/server/respond.go:12,28`); the contract `Error`
  schema is `{code, message}`, `additionalProperties:false`, and must never
  carry an address, token or secret.
- Config: the pure `config.Load(lookup)` with `ESTANTE_*` vars and `Default*`
  consts (`service/internal/config/config.go`); each new var is paired with a
  `config_test.go` case.
- Logging: `LogRequests` records method/path/status/duration only
  (`logging.go:42`); `redactInvitationToken` (`logging.go:63`) keeps the
  invitation token out of logs.

## Constraints / requirements

1. **In-memory, single instance.** The limiter keeps counts in a
   mutex-guarded map in the one process (DIRECTION §3.4). No Postgres table, no
   Redis, no new runtime dependency. Counts reset on restart — acceptable for
   an abuse throttle (restarts are deploy-time and rare), and stated as such.
   The map is bounded by lazy eviction of windows that have fully elapsed, so a
   churn of distinct keys cannot grow it without limit.

2. **Fixed window, injectable clock.** Each (rule, key) tracks a window start
   and a count; past the window it resets. Time is injected (`now func()
   time.Time`, mirroring `config.Load`'s injected `lookup`) so the unit tests
   drive windows deterministically without sleeping.

3. **Real client IP, not the edge.** In production Railway terminates TLS and
   proxies, so `r.RemoteAddr` is the edge for every user — keying on it would
   lump the whole world into one bucket and lock everyone out at the first
   limit. A pure helper derives the client IP from the trailing entries of
   `X-Forwarded-For` according to a configured count of trusted proxy hops
   (`ESTANTE_TRUSTED_PROXIES`, default `0` → use `RemoteAddr`), taking the
   `(hops+1)`-th address from the right and falling back to `RemoteAddr` when
   the header is short. Client-supplied left-hand entries are never trusted.
   Compose and the e2e stack have no proxy, so the default is correct there;
   production sets `ESTANTE_TRUSTED_PROXIES=1`.

4. **429 with a stable code and `Retry-After`.** A limited request gets `429`,
   the `Error` body `{code:"rate_limited", message:"Too many requests. Try
   again shortly."}`, and an integer-seconds `Retry-After` header (the time
   left in the window). The contract (`api/openapi.yaml`) gains this response
   on the six throttled routes — the same contract-first discipline
   `service.admin` used to add `403`/`GitForbidden`.

5. **Inline, after the right amount of work.** Like `session.Resolve`, the
   check is inline in the handler, not middleware (the key differs per
   endpoint). IP-keyed sign-in checks run first, before any WebAuthn or token
   work. The email-request check runs after the address is parsed and
   lowercased (`email_links.go:81`) so it can key on the address — and it
   returns the same indistinguishable outcome regardless of whether an account
   exists, so it never enumerates accounts. Account-keyed checks (book create,
   fork, accept) run right after `session.Resolve` yields the account id.

6. **No secrets in the limiter or its logs.** Keys are a client IP, a
   lowercased email address, or an account UUID — never a token, credential or
   session id. The invitation-accept limit keys on the **account id**, never
   the path token (which `redactInvitationToken` already keeps out of logs).
   The limiter itself logs nothing; a 429 is recorded by the existing
   `LogRequests` as status only. This is the standing "no song text / no
   secrets in logs" rule (DIRECTION §3.3).

7. **No book without an account is unaffected.** Rate limiting is additive to
   the existing session + membership gate; it never grants access, only
   refuses excess. A nil `Limiter` on `APIDeps` disables limiting entirely (the
   same nil-guard pattern as `Passkeys`), so the skeleton and the many existing
   behavior tests that build an `APIDeps` without one keep passing unchanged.

8. **Thresholds are generous defaults in the `ratelimit` package.** Defaults
   (below) are compile-time consts with rationale, not per-threshold env vars —
   no real use meets them, and tuning is a redeploy, not an operational knob.
   Behavior tests inject a `Limiter` built with tiny windows to trip quickly;
   e2e relies on the per-address default being small enough to drive. Only the
   trusted-proxy count is `ESTANTE_*` config, because only it affects
   correctness per environment.

Default thresholds (per the generous-but-protective rule):

- sign-in failures: **10 per minute per IP**;
- emailed-link requests: **5 per hour per address**, **20 per hour per IP**;
- book creation (incl. fork): **20 per hour per account**;
- invitation acceptance: **20 per hour per account**.

## Acceptance criteria

**Behavior delivered.** Each of the four flows refuses excess with `429` +
`Retry-After` once its window is full and serves normally again after the
window rolls; successful sign-ins never count toward the sign-in limit (only
401s do); the email-request 429 is as account-oblivious as its 202; the
account-keyed limits key on the account, never the invitation token; a nil
limiter is a no-op.

**Tests, by level** (the `.tji` `Tests:` clause, sharpened):

- **unit** — `service/internal/ratelimit/ratelimit_test.go`: the limiter's
  windows (Constraint 2) — the Nth call in a window allowed and the (N+1)th
  refused with a `Retry-After` equal to the window remainder; the count resets
  once the injected clock passes the window; distinct keys and distinct rules
  are isolated; elapsed windows are evicted (map stays bounded). Plus
  `service/internal/server/remoteip_test.go`: the client-IP helper (Constraint
  3) — `RemoteAddr` at `trustedProxies=0`, the rightmost `X-Forwarded-For`
  entry at `=1`, left-hand spoof entries ignored, short-header fallback. Plus a
  `service/internal/config/config_test.go` case: `ESTANTE_TRUSTED_PROXIES`
  parsed, defaulted to 0, and rejected when non-numeric or negative.
- **behavior** — `service/internal/server/ratelimit_test.go`, driving the real
  `server.Handler` through `httptest` on `newBooksEnv(t)` with an injected
  tiny-window `Limiter`: each limit **trips at its threshold and recovers** (the
  note's behavior clause) — sign-in failures per IP (set `X-Forwarded-For`
  with `trustedProxies=1`, assert a successful sign-in in between does *not*
  count), emailed-link requests per address and per IP, book create + fork per
  account, invitation accept per account; the 429 body validated against the
  contract via `apicontract.Validate`, `Retry-After` present; a distinct IP /
  address / account is unaffected (keys isolate); the no-secrets-in-logs
  assertion reused from `logging_test.go` over a tripped request (pins
  Constraint 6); a nil limiter serves all. Pins workflow 14 §Limits (book
  create) and DIRECTION §3.3 (the rest).
- **e2e-api** — `e2e/api/rate-limits.test.js` against the compose stack:
  repeated sign-in-link requests for one freshly-chosen address are limited —
  fire the per-address default + 1 `POST /api/auth/email/request` for a unique
  address, assert the last is `429` with `Retry-After`, and that a *different*
  address is still `202`. This is the note's "repeated sign-in attempts limited
  against the stack", keyed on the address so it is deterministic and touches no
  other test (see Decision 4). Uses the `HttpClient` from `e2e/api/lib/http.js`;
  no new harness lib.

No deferred follow-ups; no tech debt. The contract change and the DIRECTION
delta ride in the closer's commit.

## Decisions

1. **In-house fixed-window limiter, not `golang.org/x/time/rate`.** The `.tji`
   note says "the limiter's **windows**"; `x/time/rate` is a token-bucket
   (rate + burst), not a window, and it is not already a dependency (adding one
   needs a `go.mod`/`go.sum` change and the offline-gate lockfile dance). A
   ~60-line fixed-window counter is trivially unit-tested with an injected
   clock, reads exactly as "N per window", and costs no dependency. Rejected a
   token bucket (semantics the note doesn't ask for, extra dependency) and a
   Postgres-backed limiter (pointless on one instance, a write per request on
   the hot sign-in path — DIRECTION §3.4).

2. **In-memory, counts lost on restart.** One instance owns everything
   (§3.4), so an in-memory map is the whole story; a restart clears the counts,
   which for an abuse throttle (not a billing meter) is fine and is called out
   in DIRECTION. A persistent store would buy nothing and add a write to every
   throttled request.

3. **Sign-in limit counts failures, not attempts.** Brute force is a stream of
   *failed* attempts, so the IP sign-in limit counts only 401s;
   a legitimate user who signs in succeeds and never approaches it. This also
   keeps the e2e suite stable: every test's successful sign-ins from the
   shared runner IP cost nothing, so they cannot accumulate toward the cap.
   Rejected counting every attempt (would throttle a busy shared IP of honest
   users, and couple unrelated e2e tests through the shared IP).

4. **e2e targets the per-address email-request limit.** Of the four, only this
   one has a key the e2e test fully controls and that no other test shares — a
   unique email address — so firing the burst is deterministic and isolated,
   with no window-timing assumptions and no risk of tripping (or being tripped
   by) another test that shares the stack's single client IP. The IP-keyed
   sign-in limiter and the account-keyed limiters are pinned at the behavior
   level, where the test controls the IP (via `X-Forwarded-For` with
   `trustedProxies` set) and mints its own accounts. Requesting an emailed
   sign-in link is a sign-in attempt (workflow 13's fallback path), so this
   satisfies the note's e2e clause while staying deterministic. Rejected an
   IP-keyed redeem/authenticate burst in e2e (shares the runner IP with
   `email-links.test.js` / `passkeys.test.js`, which assert 401 on a bad
   token/credential — a tripped IP limit would flake them).

5. **Thresholds as consts, only the proxy count is env.** Per-threshold env
   vars would multiply config surface (eight values) for a knob no real use
   reaches; the behavior tests inject their own `Limiter` and need no env, and
   e2e leans on the small per-address default. Only `ESTANTE_TRUSTED_PROXIES`
   changes between environments (0 locally, 1 on Railway) and affects
   correctness, so only it is config. Rejected making every window/count an
   `ESTANTE_*` var (surface without a need) and hard-coding the proxy count
   (would break IP keying in production or in tests, one or the other).

6. **Fork is throttled with creation.** `handleForkBook` creates a book and
   a repository just as `handleCreateBook` does (workflow 14 says "forks
   included"), so both share the per-account book-creation limit rather than
   leaving fork an unthrottled way to spin up books.

7. **Design delta, not a silent choice.** Rate limiting is a new server-wide
   seam that DIRECTION §3.3 did not spell out (only workflow 14 named the book
   case), so a concise §3.3 paragraph is added same-commit, establishing the
   per-account / per-IP / per-address keying and the in-memory rationale.
   Rejected leaving it undocumented (a new architectural seam belongs in the
   constitution).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-13.

- Created `service/internal/ratelimit/ratelimit.go` — in-memory fixed-window limiter with injectable clock, mutex-guarded map, lazy eviction of elapsed windows.
- Created `service/internal/server/remoteip.go` — proxy-aware client-IP helper keyed on `ESTANTE_TRUSTED_PROXIES` / `X-Forwarded-For`.
- Created `service/internal/server/ratelimit.go` — `429 Too Many Requests` writer + nil-safe Limiter guards.
- Edited `api/openapi.yaml` — `RateLimited` 429 response added to the 6 throttled routes.
- Edited `service/internal/config/config.go` — `ESTANTE_TRUSTED_PROXIES` config var (default 0).
- Edited `service/cmd/service/main.go` — wire `Limiter` + `TrustedProxies` into `APIDeps`.
- Edited `service/internal/server/email_links.go`, `passkeys.go`, `books.go`, `sharing.go` — inline rate-limit checks on the four flows.
- Edited `docs/DIRECTION.md` §3.3 — added rate-limiting paragraph (per-IP / per-address / per-account keying, in-memory rationale).
- Unit tests: `service/internal/ratelimit/ratelimit_test.go` (windows, reset, key/rule isolation, eviction, Check/Record, atomic AllowAll); `service/internal/server/remoteip_test.go` (clientIP cases); `service/internal/config/config_test.go` (TrustedProxies default/honour/reject).
- Behavior tests: `service/internal/server/ratelimit_test.go` — all four limits trip+recover, successes don't count, keys isolate, 429 body validated against contract with `Retry-After`, no-secrets-in-logs, nil-limiter no-op.
- e2e-api: `e2e/api/rate-limits.test.js` — per-address email-request burst → 429, other address still 202.
- Per-IP email-link cap raised 20→200 (fixer: shared NAT / e2e-runner IP exhausted earlier threshold; per-address cap of 5 remains the mailbox-flood guard).
