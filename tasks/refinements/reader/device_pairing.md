# reader.device_pairing — Pairing a device, and a read-only session, in the service

## TaskJuggler entry

[`tasks/85-reader.tji`](../../85-reader.tji), `task device_pairing "Pairing a
device, and a read-only session, in the service"` (lines 123–128):

> The service side of pairing (docs/remarkable-reader.md §5.1): POST
> /api/devices/pair/begin (no session) returns a short code, an address and a
> poll token; POST /api/devices/pair/approve (a signed-in session) approves a
> code for the account; POST /api/devices/pair/poll with the token answers
> pending, expired, or — once — the new session. Codes live ten minutes, are
> single-use and rate-limited, and are never logged. The session it makes is
> the account's, listed among its signed-in devices with its kind, revocable
> like any, and read-only by scope: receive-pack and every API write refuse it.
> api/openapi.yaml extended first. Tests: behavior (begin, approve, poll through
> the handlers against Postgres; an expired, a reused and an unknown code; the
> rate limit; a read-only session refused a push and a write, allowed a fetch
> and a change check); e2e-api (a client begins, a signed-in client approves,
> the first polls and clones a book with the session, and its push is refused).

## Effort estimate

2d, as the `.tji` gives it: a contract extension, one migration, a small code
module, three handlers, one guard in front of the mux, and their tests.

## Repository

estante-de-cifras, **not** `cifra.md/` (the note does not start with
`cifra.md:`). Directories:

- `api/` — `openapi.yaml` extended first (three operations, the `Session`
  additions, a `ReadOnly` response).
- `service/internal/db/migrations/` — `0008_device_pairing.sql`.
- `service/internal/session/` — sessions gain a kind and a read-only scope.
- `service/internal/pairing/` — new: the code alphabet, generation and
  normalisation (pure).
- `service/internal/ratelimit/` — three new rules.
- `service/internal/server/` — the three handlers (`pairing.go`), the
  read-only guard (`readonly.go`), the session list's new fields, a
  defence-in-depth check in `authorizePush`.
- `e2e/api/` — `pairing.test.js`.
- `docs/DIRECTION.md` — the design delta (below), already written with this
  refinement.

No app change: the web page is `reader.pair_web`, the reader's side is
`reader.pairing`.

## Inherited dependencies

Settled:

- `reader.pair_design` (complete) — workflow 13 §Pairing a reMarkable
  (`docs/workflows/13-new-device.md` L332–467) decides the page, the four
  refusals and the device row; its refinement
  (`tasks/refinements/reader/pair_design.md`) hands this task three
  constraints: approve answers unknown, expired, used and rate-limited **apart**
  (L361–364); the alphabet leaves out 0, O, 1, I and L, shown three-dash-three
  as `KQ7-4TM` (L366–370); `Session` gains a kind (at least `remarkable`) and
  the read-only mark through the contract, never named by its User-Agent
  (L380–381).
- Everything the tests stand on is complete: `account.sign_in` (the passkey
  ceremony that mints the approving session), `service.git_http`, the hook,
  `books.online`/`POST /api/books` and a git-CLI push for a cloneable book,
  `foundation.e2e_api` (the harness), `reader.sync` (which uses the session as
  the `estante_session` cookie, `tasks/refinements/reader/sync.md` L137–153).

Pending (downstream, consume this): `reader.pair_web`, `reader.pairing`.

## What this task is

The service half of pairing a reMarkable the way a television is paired. A
device with no session asks for a code; the service gives a six-character code,
the address to type it at, a poll token and an expiry. A signed-in person types
the code at `/pair`, and the service, on their session, makes a new session of
their account — kind `remarkable`, **read-only** — tied to the pairing. The
device, polling with the token only it holds, receives that session once. From
then on the session is one of the account's signed-in devices, listed with its
kind and its read-only mark, revoked like any other, and refused by the
service everywhere it would change something: a git push (advertised or
sent), and every API write, by a deny-by-default guard.

## Why it needs to be done

remarkable-reader.md §5.1 calls this "the one change the reader needs in the
service and the API contract". `reader.sync` today runs on a passkey session
pasted in by hand (`e2e/api/reader-sync.test.js` L1–15, L185–188); a reader
cannot do a passkey, so without pairing it has no way to an account.
`reader.pair_web` builds the page over `approve` and the session list's new
fields; `reader.pairing` builds the reader's pages over `begin` and `poll`.
Both depend on this task; milestone `m7_reader` depends on all three.

## Inputs / context

Governing documents:

- `docs/remarkable-reader.md` §5.1 (L308–326) — the three calls, the session's
  scope, ten minutes, single use, rate-limited; §5.2–5.3 (L328–346) — what the
  reader then reads: `GET /api/account/home-book`, `POST
  /api/shelf/change-check`, git upload-pack; §10 (L546–553) — read-only by
  scope, revocable from the account.
- `docs/workflows/13-new-device.md` L288–293 (Signed-in devices: *your
  reMarkable*, *Reads only*), L341–350 (the address holds no token), L387–392
  (the field: any case, with or without dash or spaces; the alphabet), L404–416
  (the four refusals; *used* is "already approved, by this account or
  another"), L418–435 (the row, two reMarkables two rows, never *This device*;
  sign-out stops it at its next request; account deletion signs it out).
- `docs/workflows/19-remarkable-reader.md` L100–140 — the reader shows "This
  code works until 14:42" (an absolute expiry, no countdown); a revoked
  session refused at its next sync.
- `docs/DIRECTION.md` §3.3 L215–226 (rate limiting: per account with a
  session, per IP before; in memory), §3.3 The API L393–420 (the signing-in
  bullet; git "by session"), the one origin and its apex forwarding with the
  path kept (L154–186).

Seams in the code:

- Sessions: `service/internal/db/migrations/0001_registry.sql` L61–71 (`id`,
  `account_id`, `device`, `created_at`, `last_used_at`, `revoked_at`; no kind,
  no scope). `service/internal/session/session.go`: `CookieName` L25, `Execer`
  L30, `Issue` L50 (inserts and writes the cookie; the cookie value **is** the
  session uuid), `Revoke` L74, `Resolve` L128–151 (one `UPDATE … SET
  last_used_at … RETURNING account_id`). No auth middleware: 22 handlers call
  `session.Resolve` inline.
- The device list: `service/internal/server/sessions.go` — `handleSignOut` L28,
  `handleListSessions` L59, `handleRevokeSession` L128, `sessionJSON` L161.
  Contract: `api/openapi.yaml` `signOut` L217, `listSessions` L366,
  `revokeSession` L381, `Session` L1279–1295 (`additionalProperties: false`,
  required `id, lastUsedAt, current`, optional `device`).
- Routing: `service/internal/server/server.go` `Handler` L39–136, all routes on
  one `ServeMux`, wrapped `LogRequests(logger, NoIndex(mux))` at L135.
- Git: `service/internal/server/git.go` — info/refs L58 (calls `authorizePush`
  for `service=git-receive-pack`, L72–76), upload-pack L104, receive-pack L140
  (`authorizePush` at L149), `gitAuthorize` L199, `authorizePush` L274 (403 for
  a reader role, 413 over quota).
- Writes that are reads, and a read that writes: `POST /api/shelf/change-check`
  (`shelf.go` L17–20, server.go L89), `POST /git/{id}/git-upload-pack`;
  `GET /api/account/home-book` makes the home book on first call
  (`home_book.go` L61).
- Rate limits: `service/internal/ratelimit/ratelimit.go` rule ids L30–53,
  thresholds L58–88, `NewDefault` L143–152, `Check` L197, `Record` L207,
  `AllowAll` L168; glue `service/internal/server/ratelimit.go` (`writeRateLimited`
  L22, 429 with `Retry-After`; `rateCheck` L65; `rateRecordFailure` L78); client
  IP `remoteip.go` L19. The sign-in pattern — check first, record only on
  failure — `passkeys.go` L241–251.
- Tokens at rest: invitations store only `hashToken` (SHA-256 hex,
  `sharing.go` L114); single use by an atomic conditional `UPDATE`
  (`email_links.go` L202).
- Logging: `service/internal/server/logging.go` `LogRequests` L43 logs method,
  path, status, duration — never headers, query or body; path redactors L74,
  L98.
- The public base: `ESTANTE_PUBLIC_BASE_URL` (`service/internal/config/config.go`
  L152, L283), `APIDeps.PublicBaseURL` (`email_links.go` L34), used to build
  links (`email_links.go` L154, `home_book.go` L90).
- Contract: `api/openapi.yaml` tags L37–50 (five; `api/openapi.test.js` L66
  checks them), global `security: [sessionCookie]` L54 with `security: []`
  overrides, `RateLimited` L1047–1063, `Error {code, message}` L1074–1090,
  `Conflict` with a reason in `code` L1033–1041; validators `api/validate.go`
  (`Validate(opID, dir, status, payload)` L128) used by the behavior tests.
- Test seams: `newPasskeyEnv` / `e.do` / `registerNewAccount`
  (`service/internal/server/passkeys_test.go` L40–138), `migratedServerSchema`
  (`email_links_test.go` L125), `newBooksEnvWith` (`books_test.go` L42–90),
  `newGitEnv` / `gitc` / `cloneCommitPush` / `installRealHook` (`git_test.go`
  L178, L283, L310, L823), `newRateLimitEnv` with an injected clock and
  `assertRateLimited` (`ratelimit_test.go` L52, L100), `sessionsOf`
  (`sessions_test.go` L304). e2e: `e2e/api/lib/http.js` (`HttpClient`),
  `lib/authenticator.js`, `lib/git.js` (`GitCli.cloneHTTP`/`pushHTTP`
  L107/L120, `IsoGit.clone`/`push` L197–214), the module-local
  `registerNewAccount`/`createBook` in `e2e/api/git.test.js` L34–56.

## Constraints / requirements

1. **Contract first.** `api/openapi.yaml` is extended before the handlers, and
   every response the behavior and e2e tests read is validated against it.
2. **The code.** Six characters from the 31-character alphabet
   `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (digits without 0 and 1, letters without
   I, L and O), drawn uniformly from `crypto/rand` (rejection sampling, no
   modulo bias). Given out as `XXX-XXX`. Approve accepts any case, with or
   without the dash or whitespace; what does not normalise to six characters
   of the alphabet is answered as **unknown** (the page refuses it before
   sending, workflow 13 L390–392, so only a hand-made request reaches here).
   No look-alike mapping (an `O` is not read as `0`): the alphabet makes it
   unnecessary.
3. **Lifetimes.** A code is approvable for ten minutes from begin. An approved
   pairing is delivered by poll **once**; it stays deliverable for ten minutes
   after approval, after which poll answers `expired` and the undelivered
   session is revoked in the same transaction.
4. **Single use.** Approve is one transaction: select the pairing by code hash
   `FOR UPDATE`; unknown → refuse; already approved → *used* (by this account
   or another); past `expires_at` → *expired*; else mint the session and mark
   the pairing approved. Two concurrent approvals of one code: exactly one
   succeeds, the other is *used*.
5. **Never logged, never in a URL.** Code and poll token travel only in JSON
   bodies; no new path carries a secret (so `LogRequests` needs no new
   redactor). No log line, error message or `Problem` carries the code, the
   token or the session id. At rest the code and the poll token are stored as
   SHA-256 hex, as invitation tokens are; the session's id is the
   `sessions.id` already stored.
6. **The session.** Minted at approve (so the page's *Done* finds it listed,
   workflow 13 L397–400) by a `session` package function that inserts without
   writing a cookie: `account_id` the approver's, `kind = 'remarkable'`,
   `read_only = true`, `device` NULL. Revoked by the existing `DELETE
   /api/account/sessions/{id}` and `signOut`; dropped by account deletion's
   cascade. `Resolve` is unchanged for every handler: a revoked reader session
   is a 401 at its next request (`GET /api/account/home-book` included).
7. **Read-only by scope, deny by default.** A guard in front of the mux
   (`ReadOnly(db, mux)`, between `NoIndex` and the mux at server.go L135) looks
   the request's session cookie up — only for requests it would refuse, so a
   GET costs nothing — and, for a live read-only session, refuses with **403
   `read_only`** every request except: `GET`/`HEAD` (save `GET
   /git/{id}/info/refs?service=git-receive-pack`), `POST
   /api/shelf/change-check`, `POST /git/{id}/git-upload-pack`, `POST
   /api/auth/signout` (the reader signing itself out, `reader.pairing`), and
   `POST /api/devices/pair/begin|poll` (which read no session). A write route
   added later is refused to the reader without anyone remembering to. A
   request with no cookie, or a full session, passes untouched. For the git
   refusals the body is git's plain-text 403, as `authorizePush` answers a
   reader member; for the API it is `Error {code: "read_only"}`.
8. **Defence in depth on push.** `authorizePush` (git.go L274) also refuses a
   read-only session (403), so receive-pack is refused even if the guard's
   allowlist is ever widened by mistake.
9. **Rate limits** (DIRECTION §3.3, in memory, generous): `pair_begin` per
   client IP, 30 per hour; `pair_approve` failures (unknown, expired, used) per
   account, 10 per 10 minutes, checked before and recorded on failure as
   sign-in is; `pair_poll` per client IP, 120 per minute. A refusal is the
   existing 429 `rate_limited` with `Retry-After` — the page's *Too many tries*.
10. **The address.** Begin's `url` is `ESTANTE_PUBLIC_BASE_URL` with a leading
    `www.` host label dropped, plus `/pair` — `https://estantedecifras.app/pair`
    in production (the apex forwards with the path kept, DIRECTION §3.3), the
    stack's own origin in e2e. No new configuration.
11. **Housekeeping.** Begin deletes pairings whose `expires_at` is more than a
    day past (one `DELETE` per begin; no background job).
12. **No book without an account; no song text in logs** — untouched: the
    reader session is an account session, and the git and book checks behind
    `gitAuthorize` and `resolveBookAccess` apply to it unchanged (it reads only
    books its account is a member of).

## Acceptance criteria

### Behavior delivered

- **Contract** (`api/openapi.yaml`, tag *Sign-in* — no sixth tag, so
  `api/openapi.test.js`'s tag check stands):
  - `POST /api/devices/pair/begin`, `operationId: beginDevicePairing`,
    `security: []`, empty body → **201** `DevicePairing {code, url, pollToken,
    expiresAt}` (`code` matching `^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$`,
    `expiresAt` date-time); 429 `RateLimited`.
  - `POST /api/devices/pair/approve`, `operationId: approveDevicePairing`,
    session required, body `{code}` → **204**; **404** `pair_code_unknown`;
    **410** `pair_code_expired`; **409** `pair_code_used`; 401; 403
    `read_only`; 429.
  - `POST /api/devices/pair/poll`, `operationId: pollDevicePairing`,
    `security: []`, body `{pollToken}` → **200** `DevicePairingPoll`, one of
    `{status: "pending"}`, `{status: "expired"}`, `{status: "approved",
    session}` (`session` the opaque value to send as the `estante_session`
    cookie); **404** `pair_token_unknown` for a token never given out **or
    already delivered**; 429.
  - `Session` gains optional `kind` (enum `["remarkable"]`) and optional
    `readOnly` (`true`, present only on a read-only session) — additive, so no
    existing consumer breaks.
  - A shared `ReadOnly` response (403, `Error`, `code: read_only`) added to
    every operation the guard refuses (every write operation except the
    allowlist).
- **Migration** `0008_device_pairing.sql`: `sessions` gains `kind text NULL
  CHECK (kind IN ('remarkable'))` and `read_only boolean NOT NULL DEFAULT
  false`; new table `device_pairings (id uuid PK, code_hash text UNIQUE NOT
  NULL, poll_token_hash text UNIQUE NOT NULL, created_at, expires_at,
  approved_by uuid NULL → accounts ON DELETE CASCADE, approved_at, session_id
  uuid NULL → sessions ON DELETE SET NULL, delivered_at)`. A unique-violation
  on `code_hash` at begin retries with a new code (at most five).
- The three handlers, the guard, `authorizePush`'s check, the list's new
  fields, the three rate rules — as the constraints say.

### Tests, by level

**unit** (`go test`):

- `service/internal/pairing/code_test.go` — a generated code is six
  characters of the alphabet shown `XXX-XXX`; the alphabet holds none of 0, O,
  1, I, L (workflow 13 L387–390); `Normalize` accepts `kq7-4tm`, `KQ74TM`,
  ` kq7 4tm `, and rejects five or seven characters, an `O`, a `1` (Constraint
  2); a large draw touches every alphabet character (no character left out by
  a sampling bug).
- `service/internal/ratelimit/ratelimit_test.go` — the three new rules are in
  `NewDefault` with the windows and caps of Constraint 9.

**behavior** (Go `httptest` against the compose Postgres and real git, in
`service/internal/server/`):

- `pairing_test.go`, every response validated against the contract:
  - `TestPairBeginGivesCodeURLTokenExpiry` — 201, the code's shape, `url` is
    the public base's `/pair` with `www.` dropped (Constraint 10), `expiresAt`
    ten minutes on; the database holds hashes, never the code or the token.
  - `TestPairPollPendingThenApprovedOnce` — pending before approve; after
    approve (passkey-registered account, `registerNewAccount`), `approved`
    with a session; the next poll 404 `pair_token_unknown` (remarkable-reader.md
    §5.1 "receives a session"; the note's "— once —").
  - `TestPairApproveRefusals` — the four told apart (pair_design L361–364;
    workflow 13 L404–416): an **unknown** code 404 `pair_code_unknown`; an
    **expired** code (clock past ten minutes) 410 `pair_code_expired`; a
    **reused** code — again by the same account, and by a second account —
    409 `pair_code_used`; a malformed code answered unknown; approve with no
    session 401.
  - `TestPairApproveAcceptsAnySpelling` — lower case, no dash, spaces
    (workflow 13 L387–388).
  - `TestPairApproveConcurrent` — two approvals of one code at once: one 204,
    one 409, one session made (Constraint 4).
  - `TestPairPollExpired` — an unapproved code past ten minutes polls
    `expired`; an approved one not collected within ten minutes of approval
    polls `expired` and its session is revoked (Constraint 3).
  - `TestPairedSessionListed` — `listSessions` for the account shows the new
    row with `kind: remarkable`, `readOnly: true`, no `device`, `current:
    false` from the approving browser (workflow 13 L418–425); two pairings are
    two rows.
  - `TestPairedSessionRevoked` — `revokeSession` on it, then the reader's
    `GET /api/account/home-book` is 401 (workflow 13 L431–433); deleting the
    account removes it.
  - `TestPairRateLimits` (with `newRateLimitEnv`'s clock) — begin past its cap
    per IP, approve failures past their cap per account, poll past its cap per
    IP: 429 `rate_limited` with `Retry-After` (workflow 13 *Too many tries*;
    DIRECTION §3.3).
  - `TestPairNeverLogged` — after a full begin/approve/poll and every refusal,
    the log buffer holds neither the code (either spelling), the poll token,
    nor the session id (the note's "never logged"; standing rule).
- `readonly_test.go`, with a paired (read-only) session against a real book
  the account is a member of (`newGitEnv`, `installRealHook`):
  - `TestReadOnlyAllowsReads` — `git clone` and `git fetch` over upload-pack,
    `POST /api/shelf/change-check`, `GET /api/account/home-book`, `GET
    /api/account/sessions` all succeed (remarkable-reader.md §5.2–5.3).
  - `TestReadOnlyRefusesPush` — `git push` refused at
    `info/refs?service=git-receive-pack` and a hand-made `POST
    git-receive-pack` refused 403, and the book's ref unmoved (§5.1 "the
    service refuses a git push"); `authorizePush` refuses it with the guard
    bypassed (Constraint 8).
  - `TestReadOnlyRefusesWrites` — 403 `read_only` on `POST /api/books`,
    `DELETE /api/account/sessions/{id}`, `POST /api/devices/pair/approve`,
    `DELETE /api/account`, `POST /api/books/{bookId}/invitations`, contract-validated,
    and nothing changed in the database (§5.1 "any write it makes").
  - `TestReadOnlySignsItselfOut` — `POST /api/auth/signout` with the reader
    session 204, and its next request 401 (`reader.pairing` "Sign out ends the
    session with the service").
  - `TestFullSessionUnaffected` — a passkey session passes the guard on the
    same writes (no regression).

**e2e-api** (`e2e/api/pairing.test.js`, against the compose stack):

- *A reMarkable is paired, reads, and cannot write* — an owner registers a
  passkey account, creates a book and pushes a first commit with the git CLI;
  a second, cookie-less client begins and polls `pending`; the owner approves
  the code typed in lower case without the dash; the device polls and receives
  the session once (a second poll 404); with it, the git CLI and isomorphic-git
  each clone the book, `change-check` and `GET /api/account/home-book` answer;
  a push from each client is refused and the book's head is unchanged; `POST
  /api/books` is 403 `read_only`; the owner's `listSessions` shows the
  `remarkable`, `readOnly` row; revoked from there, the device's next
  home-book request is 401 (remarkable-reader.md §5.1, §10; workflow 13
  §Pairing a reMarkable).
- *A code that does not pair* — unknown and used are answered apart through
  the stack (workflow 13 L404–416). (Expiry needs a clock; it is pinned at
  behavior level.)

### Design delta

`docs/DIRECTION.md`, written with this refinement and committed with the task:

- §3.3 rate limiting (L215–): pairing a device (begin, approve, poll) joins the
  abuse-prone requests.
- §3.3 The API (L403–409): a new **Pairing a device** bullet — begin without a
  session, approve by a signed-in account, poll once for a session read-only by
  scope, listed by kind, revoked like any, refused every write save signing
  itself out.

## Decisions

1. **A deny-by-default guard in front of the mux, not a check in each
   handler.** Alternatives: make `session.Resolve` return a scope and have
   each of 22 call sites refuse; or a per-route "write" flag. Both rely on
   every future write handler remembering; the guard refuses anything not on a
   five-entry allowlist, so a forgotten case fails closed. It costs one indexed
   lookup only on requests it might refuse (non-GET, or the receive-pack
   advertisement), and leaves `Resolve`'s signature and its 22 callers alone.
   `authorizePush` gets its own check too, because a push is the one write
   whose refusal is the whole promise of §5.1.
2. **`GET /api/account/home-book` stays allowed, though it may create the home
   book.** The approving account has nearly always made it already (every
   signed-in app attaches it); if not, it is created empty, which changes
   nothing a person holds and is the same one the next browser would make.
   Refusing it would leave a reader paired to a fresh account unable to sync.
3. **Sign-out is allowed to a read-only session.** It changes only the session
   itself; `reader.pairing` needs it ("Sign out ends the session with the
   service"), and refusing it would leave a live credential behind on a device
   its owner meant to clear.
4. **The session is minted at approve, delivered at poll.** Workflow 13's
   *Done* opens Signed-in devices "where it is now listed" — so it must exist
   at approve. Minting at poll would leave the page's promise false until the
   reader next polled. The cost is a session that is never collected; it is
   revoked when poll finds it ten minutes past approval, and if the reader
   never polls again it is a listed row the person can sign out.
5. **The token is the existing session uuid, in the JSON body.** The service
   has one credential, the `estante_session` cookie whose value is the session
   id (`session.go` L50, L102); the reader already sends it as a cookie
   (`sync.md` L148–153). A `Set-Cookie` on poll would be Secure/HttpOnly
   ceremony for a client that is not a browser; a separate bearer token would
   add a second credential path the contract says does not exist
   (`openapi.yaml` L19–20).
6. **Refusals as `Error.code` with distinct statuses** — 404 unknown, 410
   expired, 409 used, 429 rate-limited — following the `Conflict` precedent
   (L1033–1041). pair_design accepted that *expired* and *used* reveal a code
   existed (L361–364): the call needs a session, is rate-limited, and the code
   is dead.
7. **A delivered or unknown poll token answers 404 alike.** A leaked token
   after delivery yields nothing and says nothing; the reader only polls while
   showing a code, so it never meets this after success.
8. **Hashes at rest (SHA-256), not HMAC.** A code lives ten minutes and a poll
   token is 256 random bits; an offline guess of a hashed code from a stolen
   database is worthless after ten minutes. The invitation precedent
   (`sharing.go` L114) is plain SHA-256 too.
9. **No new configuration for the address.** Derived from
   `ESTANTE_PUBLIC_BASE_URL` with `www.` dropped (the apex forwards with the
   path, DIRECTION §3.3); a separate `ESTANTE_PAIR_URL` would be one more
   deploy setting to keep in step for no gain.
10. **No account name in the poll answer.** The service stores no display
    name; the reader's *Paired with …* is the home book's `authorName`
    (docs/home-book-format.md L201–223), read by `reader.pairing` from what it
    syncs.
11. **Under the *Sign-in* tag**, not a new *Devices* tag: pairing is a way into
    an account, and a sixth tag would change `api/openapi.test.js`'s area
    check for nothing.
12. **Browser device kinds stay out.** Workflow 13 L237–241 names devices by
    kind (*your iPhone* …), but the browser rows already work from `device`;
    `kind` is an enum of one value now, and grows when a task needs it.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-02.

- Contract: `api/openapi.yaml` gains `beginDevicePairing`, `approveDevicePairing`, `pollDevicePairing` (tag Sign-in), `Session.kind`/`readOnly`, a `Gone` response for 410, and the `Forbidden`/`GitForbidden` descriptions widened to cover 403 `read_only`.
- Storage: `service/internal/db/migrations/0008_device_pairing.sql` (sessions `kind`, `read_only`; `device_pairings` with hashed code and poll token).
- Code module: `service/internal/pairing/code.go` (31-character alphabet, rejection sampling, normalisation), tested in `code_test.go`.
- Handlers and sessions: `service/internal/server/pairing.go`, `service/internal/session/session.go` (cookie-less mint), `service/internal/server/sessions.go` (kind and readOnly in the list), `service/internal/server/server.go` routes.
- Read-only by scope: deny-by-default guard `service/internal/server/readonly.go`, plus the second check in `authorizePush` (`service/internal/server/git.go`); refusals are 403 `read_only`.
- Rate limits: three rules in `service/internal/ratelimit/ratelimit.go` (`TestPairingRulesInDefault`).
- Tests: behavior `service/internal/server/pairing_test.go` and `readonly_test.go`; e2e-api `e2e/api/pairing.test.js`. Expiry tests move row timestamps in Postgres. Design delta in `docs/DIRECTION.md`. No follow-ups.
