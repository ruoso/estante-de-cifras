# foundation.gate_localhost_origin — Clean up the e2e-stack localhost origin

## TaskJuggler entry

Back-link: `task gate_localhost_origin` in
[`tasks/25-foundation.tji`](../../25-foundation.tji) lines 79–84, inside the
`foundation` task whose area file opens (lines 1–5):

> The monorepo, its tooling, the API contract, running everything locally as
> in production, CI, and the two end-to-end harnesses every later task's
> e2e tests are written in. The harnesses land before anything needs them.

The task's note:

```
Move `ESTANTE_E2E_BASE_URL` and `ESTANTE_WEBAUTHN_RP_ID` in `scripts/gate`
from `127.0.0.1` to `localhost`, and drop the host-normalisation workarounds
added in `compose.yaml` and `e2e/web/lib/env.js`/`e2e/api/lib/env.js` by
account.sign_in. Source-of-debt: account.sign_in
(tasks/refinements/account/sign_in.md); real Chromium rejects WebAuthn on an
IP-literal origin so the fix landed as normalisation in downstream files,
leaving a two-source-of-truth with the gate. DIRECTION §3.3 (one origin).
Tests: no new tests — the existing e2e-web (account-sign-in.spec.js, all
three viewports) and e2e-api suites are the verification after the cleanup.
```

## Effort estimate

**0.5d** (from the `.tji`).

## Repository

**estante-de-cifras** (`/home/ruoso/devel/estante-de-cifras`). Four files,
no new ones:

- [`scripts/gate`](../../../scripts/gate) — the two exports and the comment
  above them.
- [`compose.yaml`](../../../compose.yaml) — the service's WebAuthn/base-URL
  environment and the comment block that justified the IP-literal
  workaround.
- [`e2e/web/lib/env.js`](../../../e2e/web/lib/env.js) and
  [`e2e/api/lib/env.js`](../../../e2e/api/lib/env.js) — the host-rewrite
  helpers.

**No design delta is authored.** The target state is exactly what
DIRECTION §3.3 already says — one origin, a named host (`estantedecifras.app`
in production, `localhost` on the local/CI stack), never an IP literal. This
task removes a deviation that crept in as a workaround; it changes no
designed behaviour, so neither DIRECTION nor a workflow is edited.

## Inherited dependencies

- **`account.sign_in`** — settled, **Done 2026-10-07**
  ([`tasks/refinements/account/sign_in.md`](../account/sign_in.md) Status;
  this task's `depends account.sign_in`,
  [`tasks/25-foundation.tji`](../../25-foundation.tji) line 82). That task
  shipped the passkey + emailed-link sign-in surface and, to make a real
  Chromium drive the WebAuthn ceremony, introduced the host normalisation
  this task now consolidates. Its Status records the three downstream edits
  (`sign_in.md:526–527`): `e2e/web/lib/env.js` and `e2e/api/lib/env.js`
  `127.0.0.1`→`localhost` rewrites, and `compose.yaml`'s
  `ESTANTE_PUBLIC_BASE_URL`/`ESTANTE_WEBAUTHN_RP_ID` moved to `localhost`.
  It did **not** touch `scripts/gate`, which still exports the IP literal —
  the two-source-of-truth this task closes.

**Transitively settled** (the files this edits were built by these, all
`complete 100`):

- **`foundation.compose`** — `compose.yaml`
  ([`tasks/25-foundation.tji`](../../25-foundation.tji) lines 44–50).
- **`foundation.e2e_api`** / **`foundation.e2e_web`** — the two harnesses
  whose `lib/env.js` this edits (lines 58–63, 72–77).
- **`foundation.ci`** — runs `scripts/gate` unchanged
  ([`tasks/25-foundation.tji`](../../25-foundation.tji) lines 51–56); the
  gate must stay green on a push after this cleanup, on the CI runner where
  `localhost` resolves to the published loopback bind.

**Downstream.** None blocks on this. Every later e2e test the WBS wires
reads the base URL through the same `lib/env.js` seam, so consolidating the
host there (and in the gate) leaves them reading one already-correct origin
with no per-harness rewrite. The sign-in suites that prove the origin is
right are already in the tree (below).

## What this task is

A debt-paydown refactor with no behaviour change. `account.sign_in` needed
the e2e stack's one origin to be a named host, because a real browser
rejects WebAuthn on an IP-literal origin. Rather than change the one place
that mints the origin — `scripts/gate`, which still exports
`http://127.0.0.1:<port>` and `ESTANTE_WEBAUTHN_RP_ID=127.0.0.1` — the fix
landed as `127.0.0.1`→`localhost` rewrites in three downstream files:
`compose.yaml` hardcodes the service to `localhost`, and each `lib/env.js`
rewrites the gate's host before use. The result works but encodes the host
in four places that must agree. This task makes `scripts/gate` export
`localhost` directly, then removes the now-redundant rewrites so the gate is
the single source of truth and the downstream files simply read it.

## Why it needs to be done

The one-origin principle (DIRECTION §3.3) is load-bearing: a passkey binds
to one domain, the session cookie flows on one origin, and the mailed
sign-in link must land on that same origin. On the local/CI stack that
origin has to be a named host (`localhost`) and not `127.0.0.1`, because
`navigator.credentials.create()` throws `SecurityError "This is an invalid
domain."` on an IP-literal origin for every `rp.id`. The sign-in fix spread
that one fact across four files, each re-deriving or rewriting the host; a
future change to the stack's addressing (a new port scheme, an added
service, an IPv6 default) has to be kept consistent in all four, and the
gate — the natural source — says the wrong thing, with a stale comment
claiming the `127.0.0.1` RP ID "validates" when in fact `compose.yaml`
silently overrides it to `localhost`. Collapsing the host to one authored
place removes that trap before more e2e work is written against the seam.

## Inputs / context

- **`scripts/gate`'s stack bring-up** —
  [`scripts/gate`](../../../scripts/gate) `stack_up()` lines 247–279:
  - line 253 `export ESTANTE_E2E_BASE_URL="http://127.0.0.1:$ESTANTE_HTTP_PORT"`
    — the IP-literal origin to change.
  - line 267 `export ESTANTE_WEBAUTHN_RP_ID="127.0.0.1"` — the RP ID to
    change.
  - lines 261–265 the comment that claims the RP ID is `127.0.0.1` and "the
    software authenticator's ceremony validates" — stale; it must be
    rewritten to describe the named-host origin.
  - line 254 `ESTANTE_E2E_MAIL_URL` and line 255
    `ESTANTE_TEST_DATABASE_URL` stay on `127.0.0.1` (see Decisions — no
    WebAuthn constraint, read raw by the harnesses and Go tests).
  - line 193 `free_port()` binds `127.0.0.1` to let the kernel pick a free
    port; that stays — the port is equally free under the `localhost` name,
    which resolves to the same loopback.
- **`compose.yaml`'s service environment** —
  [`compose.yaml`](../../../compose.yaml):
  - lines 85–96 the comment block justifying the IP-literal workaround
    ("a real browser rejects WebAuthn on an IP-literal origin … so the
    e2e-web browser must drive the passkey ceremony against `localhost`");
    to be trimmed to the plain fact now that the gate supplies the host.
  - line 99 `ESTANTE_PUBLIC_BASE_URL: http://localhost:${ESTANTE_HTTP_PORT:-8080}`
    — hardcodes `localhost`, ignoring the gate's exported origin.
  - lines 101–108 the RP-ID comment; line 109
    `ESTANTE_WEBAUTHN_RP_ID: localhost` — hardcodes `localhost`, ignoring
    the gate's exported `ESTANTE_WEBAUTHN_RP_ID`.
  - line 115 `- "127.0.0.1:${ESTANTE_HTTP_PORT:-8080}:8080"` and line 123
    the healthcheck `http://127.0.0.1:8080/healthz` stay (see Decisions —
    the published bind and the in-container loopback probe are correct as
    IP literals; only the *origin the outside world and the service agree
    on* must be the named host).
- **The e2e-web host rewrite** —
  [`e2e/web/lib/env.js`](../../../e2e/web/lib/env.js) lines 26–41: the
  `browserOrigin()` helper and its comment; line 39 rewrites hostname
  `127.0.0.1`→`localhost`; line 44 `export const baseUrl =
  browserOrigin(required('ESTANTE_E2E_BASE_URL'))`. `required()` (lines
  11–24) already drops a trailing slash.
- **The e2e-api host rewrite** —
  [`e2e/api/lib/env.js`](../../../e2e/api/lib/env.js) lines 22–38: the
  `stackOrigin()` helper and its comment; line 33 rewrites the host; line 38
  `export const baseUrl = stackOrigin(required('ESTANTE_E2E_BASE_URL'))`.
- **The one-origin principle** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.3 lines 170–171
  (*"**One origin** for both: no CORS, a session cookie that simply flows,
  and a passkey for the one domain."*) and lines 158–162 (production host
  `estantedecifras.app`, HTTPS-only "which a PWA and passkeys need anyway") —
  a named host, never an IP literal; and the app's own §3.7 lines 400–401
  (the app's dev server proxies the API so it is one origin there too).
- **The source-of-debt record** —
  [`sign_in.md`](../account/sign_in.md) Status lines 526–527 (the three
  downstream edits), line 529 (the e2e-web suite shipped: "2 tests ×
  3 viewports, all passing"), and lines 391–394 (this app task adds no
  e2e-api level; the service-side passkey/session/email-link coverage lives
  in the service tasks' own e2e-api specs).
- **The verification suites** (unchanged by this task, must stay green):
  [`e2e/web/tests/account-sign-in.spec.js`](../../../e2e/web/tests/account-sign-in.spec.js)
  — the sign-in journey, run on all three viewports; and the e2e-api
  passkey/session/email-link/mail specs in
  [`e2e/api/`](../../../e2e/api/) that already drive the software
  authenticator against the stack origin.

## Constraints / requirements

- **The gate becomes the single source of the stack's origin host.** After
  this change, the host appears authored in exactly one place —
  `scripts/gate` — and everything else reads it. `compose.yaml` reads the
  gate's exported `ESTANTE_WEBAUTHN_RP_ID` (with a `localhost` default for a
  developer's bare `docker compose up`) and derives the service's public
  base URL from the gate's origin rather than hardcoding `localhost`; each
  `lib/env.js` reads `ESTANTE_E2E_BASE_URL` verbatim with no host rewrite.
- **No behaviour change.** The stack still serves its one origin on
  `localhost`; the browser origin, the service's RP ID and RP origin, and
  the mailed sign-in link still all agree on that one host. The only
  difference is *where the host is written*. The already-passing sign-in
  suites must pass unchanged — that is the whole acceptance signal.
- **One origin (DIRECTION §3.3).** The local/CI stack mirrors production's
  shape: one named host for app + API + mailed link + passkey. This cleanup
  removes the IP-literal deviation; it does not add a second origin, a CORS
  surface or a second host.
- **The published bind stays a loopback IP literal.** `compose.yaml`
  publishing on `127.0.0.1:<port>` and the in-container healthcheck probing
  `http://127.0.0.1:8080/healthz` are correct and unrelated to the
  *origin* — Docker binds the host port on the loopback interface, and
  `localhost` resolves there. Do not rewrite these to a name; they are not
  part of the two-source-of-truth.
- **`ESTANTE_E2E_MAIL_URL` and `ESTANTE_TEST_DATABASE_URL` are out of
  scope.** The note names only `ESTANTE_E2E_BASE_URL` and
  `ESTANTE_WEBAUTHN_RP_ID`. Mail-catcher HTTP and the Go behavior tests'
  Postgres DSN carry no WebAuthn/origin constraint and are read raw; leaving
  them on `127.0.0.1` keeps the change minimal and reviewable. (A developer
  could later unify them for tidiness, but that is not this debt and not a
  separate task.)
- **app ↔ service ↔ harness share no code (DIRECTION §3.6).** The two
  `lib/env.js` files are deliberate duplicates (`e2e/web/lib/env.js:8` cites
  "the harnesses share no code"); this task edits each independently and
  does not factor a shared helper across them.
- **No song text in logs (standing rule).** Nothing in scope logs; the gate
  comment and env files carry no user content. Test fixtures are untouched.

## Acceptance criteria

**Behaviour delivered.** `scripts/gate` exports
`ESTANTE_E2E_BASE_URL="http://localhost:$ESTANTE_HTTP_PORT"` and
`ESTANTE_WEBAUTHN_RP_ID="localhost"`, with the surrounding comment rewritten
to state the named-host reason plainly (no stale `127.0.0.1` claim).
`compose.yaml` no longer hardcodes the host: it reads
`ESTANTE_WEBAUTHN_RP_ID` from the environment (default `localhost`) and
derives the service's public base URL from the gate's origin (default
`http://localhost:${ESTANTE_HTTP_PORT:-8080}` for a bare `docker compose
up`), and its comment block is trimmed to the plain fact. `e2e/web/lib/env.js`
and `e2e/api/lib/env.js` drop `browserOrigin`/`stackOrigin` and their
comments; each `baseUrl` is `required('ESTANTE_E2E_BASE_URL')` (trailing
slash still stripped) used directly. `docker compose config` stays valid.
The host is authored once, in the gate.

**Tests the task lands with, by level.** The `.tji` note names **no new
test level** — *"no new tests — the existing e2e-web
(account-sign-in.spec.js, all three viewports) and e2e-api suites are the
verification after the cleanup."* This is a pure refactor that removes
duplicated wiring and changes no observable behaviour, so the verification
is the existing suites continuing to pass against the consolidated origin:

- **e2e-web — `e2e/web/tests/account-sign-in.spec.js`** (Playwright against
  the compose stack, phone + tablet + computer): drives the real-Chromium
  WebAuthn passkey ceremony and the emailed-link path against
  `baseUrl`. This is precisely the test that fails if the origin is wrong —
  an IP-literal origin throws `SecurityError` in the browser — so it is the
  direct proof that `localhost`, now sourced from the gate and read raw,
  reaches the browser, the service's RP ID/origin and the mailed link in
  agreement. Pins DIRECTION §3.3 (one origin) across all three viewports.
- **e2e-api — the passkey / session / email-link / mail specs in
  `e2e/api/`**: drive the software authenticator, which echoes the service's
  RP ID and stamps the origin into `clientDataJSON`; they pass only if the
  origin the harness uses matches the origin the service validates. They
  confirm the api-side `lib/env.js` reads the right origin with the rewrite
  removed.

Both suites run against the compose stack `scripts/gate` brings up, on every
gate run. The closer confirms they ran — not skipped — in the gate's output
after the change; a failure there means the consolidation broke the origin
agreement and the task is not done. No **unit** or **behavior** level
applies: the removed `browserOrigin`/`stackOrigin` helpers had no unit tests
(none exist in the tree) and the change leaves no pure logic to test — each
`env.js` now only reads a variable. Adding a unit test for `process.env`
pass-through would pin the harness plumbing, not any behaviour this task
delivers.

**Deferred work.** None. No follow-up task, no parking-lot item. The debt
this closes is fully paid by the four edits above.

## Decisions

- **`scripts/gate` becomes the single source of truth; `compose.yaml` reads
  it rather than hardcoding `localhost`.** *Rationale:* the two-source-of-
  truth is the debt. Fixing it by making every file read the gate's value
  (gate → `compose.yaml` env → service; gate → `lib/env.js` → harness)
  leaves one authored host. `compose.yaml` keeps a `localhost` default so a
  developer's bare `docker compose up` (no gate) still comes up on a
  WebAuthn-valid origin. *Alternatives rejected:* (a) change only the gate
  and leave `compose.yaml` hardcoding `localhost` — the values would agree
  today but drift the moment the gate's origin changes, which is the exact
  trap being removed; (b) delete the `compose.yaml` defaults and require the
  gate's exports always be present — breaks the hand-run `docker compose up`
  path the current defaults support.
- **Remove the `browserOrigin`/`stackOrigin` rewrites entirely rather than
  keep them as a safety net.** *Rationale:* once the gate exports
  `localhost`, a `127.0.0.1`→`localhost` rewrite is dead code that only
  masks a future misconfiguration instead of surfacing it; a wrong origin
  should fail the sign-in suite loudly, not be silently repaired in two
  places. *Alternative rejected:* keep the helpers "just in case" — that
  preserves the very duplication this task exists to remove and keeps the
  misleading comments alive.
- **Leave `ESTANTE_E2E_MAIL_URL`, `ESTANTE_TEST_DATABASE_URL`, the published
  port bind and the in-container healthcheck on `127.0.0.1`.** *Rationale:*
  the note scopes only the two origin variables; these four carry no
  WebAuthn/origin constraint (the mail API and Postgres DSN are read raw;
  the bind and probe are loopback plumbing, not the shared origin). Changing
  them would widen a 0.5d cleanup into an unscoped churn with no behavioural
  payoff. *Alternative rejected:* unify everything to `localhost` for
  cosmetic consistency — out of scope, and the DSN/port forms are correct as
  IP literals.
- **No new test, as the note directs, recorded here deliberately.**
  *Rationale:* the testing policy forbids *dropping* a level the note names
  without a decision; here the note names none, because the task delivers no
  new behaviour — it removes duplication. The behaviour that could regress
  (the origin reaching browser, service and mailed link in agreement) is
  already pinned, and pinned precisely, by `account-sign-in.spec.js` on
  three viewports plus the e2e-api authenticator specs, all of which run on
  every gate. A fabricated unit test over `process.env` pass-through would
  add noise, not coverage. *Alternative rejected:* add an e2e assertion that
  the origin host is literally `localhost` — it would restate what the
  WebAuthn ceremony already enforces (the ceremony cannot succeed on a
  non-named host), duplicating the guarantee.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `scripts/gate` — `ESTANTE_E2E_BASE_URL` now exports `http://localhost:$ESTANTE_HTTP_PORT`, `ESTANTE_WEBAUTHN_RP_ID` exports `localhost`; comment rewritten to state the named-host reason and single-source-of-truth note.
- `compose.yaml` — `ESTANTE_PUBLIC_BASE_URL` reads `${ESTANTE_E2E_BASE_URL:-http://localhost:${ESTANTE_HTTP_PORT:-8080}}`; `ESTANTE_WEBAUTHN_RP_ID` reads `${ESTANTE_WEBAUTHN_RP_ID:-localhost}`; workaround comment block trimmed. Published bind (`127.0.0.1`) and healthcheck left unchanged per scope.
- `e2e/web/lib/env.js` — dropped `browserOrigin()` helper and its comment; `baseUrl` reads `required('ESTANTE_E2E_BASE_URL')` directly (trailing-slash strip retained).
- `e2e/api/lib/env.js` — dropped `stackOrigin()` helper and its comment; `baseUrl` reads `required('ESTANTE_E2E_BASE_URL')` directly (trailing-slash strip retained).
- Gate is the single authored origin host; all downstream consumers read it with no per-file rewrite. No behaviour change; no new tests (none needed — existing e2e-web and e2e-api suites are the verification).
