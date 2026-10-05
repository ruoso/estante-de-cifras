# foundation.e2e_api — End-to-end API harness

## TaskJuggler entry

Back-link: `task e2e_api` in
[`tasks/25-foundation.tji`](../../25-foundation.tji), lines 58–63, under
`task foundation`:

```
task e2e_api "End-to-end API harness" {
  effort 2d
  allocate team
  depends !ci
  note "e2e/api/: a black-box test package (Node, Vitest; `npm test` takes `--maxWorkers`) run against the compose stack scripts/gate brings up — the service's image with git, the hook, Postgres, the mail catcher — at ESTANTE_E2E_BASE_URL and ESTANTE_E2E_MAIL_URL; helpers for HTTP calls with a session, reading mail from the catcher, and real git clients doing what a device would: the git CLI and isomorphic-git in Node. The stack's Postgres is also what the Go behavior tests use (ESTANTE_TEST_DATABASE_URL). DIRECTION §3.6. Tests: e2e-api (the harness's own: the stack is up and the health check answers; the mail catcher's API answers; the git CLI and isomorphic-git helpers init, commit and clone a local repository)."
}
```

The area file's purpose line (lines 1–5): _"The monorepo, its tooling, the
API contract, running everything locally as in production, CI, and the two
end-to-end harnesses every later task's e2e tests are written in. The
harnesses land before anything needs them."_ This task is one of those two
harnesses — the e2e-api one — and it lands before anything needs it.

## Effort estimate

**2 days** (from the `.tji`).

## Repository

**estante-de-cifras** (`/home/ruoso/devel/estante-de-cifras`). The work lands
entirely under **`e2e/api/`** (reserved by `foundation.monorepo`, today just
`e2e/api/README.md`): a Node/Vitest test package — `package.json`,
`package-lock.json`, `vitest.config.js`, a small `lib/` of helpers, a
`fixtures/` of purpose-written songs, and the harness's own smoke tests. The
note does **not** start with `cifra.md:`, so nothing lands in the cifra.md
repository. No file outside `e2e/api/` is edited (the harness runs against the
existing `compose.yaml` and the existing `scripts/gate` wiring as-is).

**No design delta is authored.** DIRECTION §3.6 (lines 386–392) already says
the end-to-end tests run against the one-origin compose stack here, and the
`.tji` note and `scripts/gate` already specify the harness's shape, its base
URLs and how it is invoked. This task turns that promise into a test package;
it introduces nothing new to the direction.

## Inherited dependencies

- **`foundation.ci`** — `depends !ci` (`.tji` line 61), **settled**
  (`complete 100`, [`tasks/25-foundation.tji`](../../25-foundation.tji),
  commit `d2687a2`). CI now runs `scripts/gate` on every push over both
  repositories, on a hosted runner with Docker and the Compose plugin — so the
  moment `e2e/api/package.json` exists, the gate's e2e level brings the stack
  up and runs this harness **on every push**, which is what makes writing
  these tests worthwhile (`ci.md` §Why it needs to be done). See
  [`ci.md`](./ci.md).
- Transitively settled and relied on:
  - **`foundation.compose`** (`complete 100`) — the one-origin stack this
    harness is black-box against: `postgres`, `mail` (`axllent/mailpit`) and
    `service` (the multi-stage image with git and the built app), each
    healthchecked, brought up by `docker compose … up --build --detach --wait`
    and torn down with `down --volumes` ([`compose.md`](./compose.md)).
  - **`foundation.service_skeleton`** (`complete 100`) — the unauthenticated
    `GET /healthz` → `200 ok` the first smoke test hits
    ([`service_skeleton.md`](./service_skeleton.md)).
  - **`foundation.api_contract`** (`complete 100`) — `api/`, the contract both
    sides are tested against; downstream e2e-api tests written in this harness
    will check real responses against it ([`api_contract.md`](./api_contract.md)).
  - **`foundation.monorepo`** (`complete 100`) — the `e2e/api/` directory and
    `scripts/gate`.

**Downstream.** This harness is the one place e2e-api tests are written for the
rest of the project (the area purpose line; the one-harness rule in
`tasks/refinements/README.md`). `foundation.e2e_web` (`depends !e2e_api,
service.serve_app`, `.tji` lines 64–68) is gated behind it; and every service,
sign-in, sharing, change-check and git-over-HTTP task that lands an e2e-api
journey — `service.git_http`, the `account` sign-in tasks (workflow 13), the
`books`/sharing tasks (workflows 7, 10, 11), the `sync` change-check tasks
(workflow 8) — writes its tests **in this harness**, reusing the session,
mail and git helpers this task delivers. It never builds a parallel harness.

## What this task is

Fill `e2e/api/` with the black-box, device-side test package: a Node/Vitest
project that talks to the running compose stack over HTTP and over git exactly
as a user's browser or a desktop merge driver would, plus the reusable helpers
every later e2e-api test is written on. It delivers four things:

1. an **HTTP client that carries a session** — a cookie jar over Node's global
   `fetch`, resolving paths against `ESTANTE_E2E_BASE_URL` (the one origin,
   app and API);
2. a **mail helper** that reads the catcher (Mailpit) over its HTTP API at
   `ESTANTE_E2E_MAIL_URL` — list, fetch, find the latest message to a
   recipient, extract a link, and clear the mailbox — the seam the emailed
   sign-in link flow (workflow 13) is tested through;
3. **real git clients** doing what a device would: a **git CLI** helper (the
   host `git` driven through `node:child_process`) and an **isomorphic-git**
   helper (the Node build of the same client the app's Worker uses); and
4. the harness's **own smoke tests**, which prove the stack is reachable, the
   mail API answers and both git clients work — the executable proof that the
   compose stack (`foundation.compose`) and the CI e2e path (`foundation.ci`)
   actually run.

## Why it needs to be done

Two upstream config-only tasks deliberately shipped with **no test of their
own** and named this task as their executable proof: `compose` ("the stack is
proven by foundation.e2e_api's smoke tests", `.tji` line 49) and `ci` (the
Docker/Playwright e2e path is "first exercised by `foundation.e2e_api`",
`ci.md` §Acceptance). Until this harness exists, `scripts/gate` **skips** the
whole e2e level (lines 315–324: "compose.yaml exists but no e2e harness yet"),
the stack is never brought up by the gate, and nothing asserts that Postgres,
the mail catcher and the service-with-git actually come up and answer together.
This task closes that: the moment `e2e/api/package.json` lands, the gate's
`e2e_preflight` + `stack_up` fire on every push and run these tests against the
live stack (gate lines 315–346).

It is also the foundation every later black-box test stands on. The project
forbids parallel harnesses, so the session/mail/git helpers written here are
what the sign-in, sharing, change-check and git-over-HTTP e2e-api tests reuse.
Getting the seams right now — one cookie jar, one mail reader, one pair of git
clients — is the task.

## Inputs / context

Governing direction:

- **DIRECTION §3.6**, [`docs/DIRECTION.md`](../../../docs/DIRECTION.md):
  - Component table line 281 — the app does "Git through isomorphic-git in a
    Web Worker"; this harness's isomorphic-git helper is the **device-side**
    counterpart a test drives. Line 283 — the service does "git over HTTP".
  - Line 288 — "**The app and the service share no code**, only the HTTP API
    and the format." This harness is a third, independent device-side client:
    it speaks the HTTP API and git, shares no code with either.
  - **Git over HTTP** (lines 317–353) — smart HTTP per book, protocol v2,
    `info/refs?service=…`, `git-upload-pack`/`git-receive-pack`; the endpoints
    the git-client helpers exercise once `service.git_http` lands.
  - **The API** (lines 355–371) — sign-in (359–361, workflow 13), books
    (362–363), the change check (364–365, workflow 8), sharing (366–368,
    workflow 10), git for members by session (369–371) — the surfaces later
    e2e-api tests cover through the session helper.
  - **Repositories** (lines 375–384) and **"Locally, everything runs as in
    production"** (lines 386–392): `compose.yaml` brings up the stack and "the
    end-to-end tests run against that one origin"; "CI runs the app's tests,
    the Go tests and the end-to-end tests here" (390–392).
- **DIRECTION §3.3**, lines 140–209 — the one server: Postgres holds accounts,
  the registry and sessions (line 171); a transactional email provider sends
  the sign-in links, stood in for locally by the mail catcher (lines 175–177);
  "Everything runs locally as it runs in production … so end-to-end tests sync
  against a real server" (lines 207–209).
- **DIRECTION §3.7**, lines 394–413 — the app holds git in a Web Worker
  (407–409); the isomorphic-git the Worker uses is the client this harness
  mirrors device-side.

The gate (the single source of truth for how this harness is invoked),
[`scripts/gate`](../../../scripts/gate):

- **Header** (lines 23–39) — the e2e-api level is "`e2e/api/` (Vitest,
  black-box: HTTP and real git clients)", run against the compose stack brought
  up once; "A harness that exists must run."
- **`stack_up()`** (lines 247–267) exports, per run, free loopback ports and:
  `ESTANTE_E2E_BASE_URL=http://127.0.0.1:$ESTANTE_HTTP_PORT` (the one origin,
  app + API), `ESTANTE_E2E_MAIL_URL=http://127.0.0.1:$ESTANTE_MAIL_PORT` (the
  catcher's HTTP API), `ESTANTE_TEST_DATABASE_URL` (the Go behavior tests'
  DSN, not this harness's), the `ESTANTE_PG_*` credentials, and
  `ESTANTE_COMPOSE_PROJECT`; then `docker compose -p … -f compose.yaml up
  --build --detach --wait --wait-timeout 300`. **The stack is already healthy
  before any test runs** (`--wait`), so tests need not poll for startup.
- **The e2e-api block** (lines 332–346): in `e2e/api`, `npm_install_if_needed`;
  `npm run lint` **if** a `lint` script exists (336–339); then
  `has_npm_script test || fail "e2e/api/package.json has no 'test' script — a
  harness that exists must run"` (line 340); then `CI=true npm test --
  --maxWorkers="$E2E_WORKERS"` (line 342). `ESTANTE_E2E_WORKERS` defaults to
  `nproc` **capped at 4** (lines 63–64). So `test` **must** be `vitest run`
  (the `--maxWorkers` forwards to Vitest), and Vitest **must** find at least
  one test file or it exits non-zero and fails the gate — the smoke tests are
  mandatory for green.
- **`e2e_preflight()`** (lines 211–243) — once `e2e/api/package.json` exists, a
  missing `compose.yaml`, Docker or the Compose plugin is a hard **fail** with
  install instructions (Playwright's browsers are only required for e2e/web).
- The e2e level is reached only when `e2e/api/package.json` exists (lines
  315–324); landing this file is what switches it on.
- **`stack_down()`** (lines 101–110) always tears the stack down (`down
  --volumes --remove-orphans --rmi local`) via a trap.

Toolchain on disk: [`.node-version`](../../../.node-version) → `24.20.0`
(global `fetch` and ESM available; no `node-fetch` needed). The host `git` CLI
is already guaranteed present — `scripts/gate` itself runs `git rev-parse`
(line 60) and CI provisions git (`ci.md` §Constraints). The app and `api/` are
plain JavaScript (`app/vite.config.js`, `api/openapi.test.js`) on Vitest, the
runner this harness matches.

Predecessor and sibling refinements: [`compose.md`](./compose.md) (the stack,
Mailpit, the `ESTANTE_*` variables, `up --wait`/`down --volumes`),
[`ci.md`](./ci.md) (the gate is the only verifier; the e2e path on a push;
config-only task proven by its downstream), [`api_contract.md`](./api_contract.md)
(one origin, session cookie, no CORS), [`service_skeleton.md`](./service_skeleton.md)
(`/healthz` → `200 ok`; structured logging of metadata only).

## Constraints / requirements

- **Node/Vitest, plain JavaScript (ESM), invoked exactly as the gate invokes
  it.** `e2e/api/package.json` declares `"type": "module"` and a `test` script
  of `vitest run` so `npm test -- --maxWorkers=N` forwards the bound to Vitest
  (gate line 342); a committed `package-lock.json` so `npm ci` is reproducible
  (gate `npm_install_if_needed`). Vitest runs in the **node** environment (no
  DOM — this is black-box HTTP and git, not component rendering). No build or
  transpile step.
- **Black-box against the running stack; read the stack's address from the
  environment.** Every HTTP call resolves against `ESTANTE_E2E_BASE_URL`; the
  mail helper against `ESTANTE_E2E_MAIL_URL`. A single `lib/env.js` reads and
  validates these at import and **fails fast with a clear message** when unset
  (so running `npm test` outside the gate says "bring the stack up via
  scripts/gate, or set ESTANTE_E2E_BASE_URL/ESTANTE_E2E_MAIL_URL"). The harness
  neither starts nor stops the stack and never reaches inside a container — no
  `docker exec`, no direct Postgres access (`ESTANTE_TEST_DATABASE_URL` is the
  Go behavior tests', not this harness's): it only does what a device can do
  over the network.
- **A third, independent device-side client — shares no code with app or
  service** (DIRECTION §3.6 line 288). The harness imports neither `app/` nor
  `service/` code; it speaks the HTTP API and git over the wire. The
  isomorphic-git helper uses the published `isomorphic-git` package (the same
  client the Worker uses), not the app's Worker modules.
- **Bounded parallelism, isolated tests.** Vitest runs with the gate's
  `--maxWorkers` (≤4); nothing runs an unbounded `-j`. Every test that touches
  the filesystem creates its own `fs.mkdtemp` working directory and cleans it
  up; every test that will (downstream) create server state must use unique
  identifiers per test, so files run in parallel without collision. The
  helpers make this the easy path (e.g. a fresh session per client, a temp dir
  per git helper instance).
- **Session carried by a cookie** (DIRECTION §3.6 line 369, §3.3 line 171;
  `api_contract.md`). The HTTP client keeps a cookie jar across calls and
  re-sends it — one session per client instance — so a test signs in once and
  stays signed in, as a browser does on one origin (no CORS).
- **Real git clients, both.** The git CLI helper drives the host `git` through
  `node:child_process` (never a shell string — argument arrays, so song text
  and paths are never interpolated into a command line). The isomorphic-git
  helper uses `isomorphic-git` with `node:fs` and, for the wire, the package's
  Node HTTP client — carrying the session cookie on requests, the way the
  device authenticates to the per-book git endpoint (DIRECTION §3.6 lines
  369–371), for the downstream git-over-HTTP tests.
- **No song text in logs; purpose-written fixtures only.** The harness logs
  nothing of its own beyond Vitest's test output; fixtures under
  `e2e/api/fixtures/` are songs written for the purpose (the standing rule),
  never anyone's copyrighted words, and the injected test email is likewise
  purpose-written. (The service's own "metadata only" logging is
  `service_skeleton`'s; this task adds none.)
- **No book without an account** holds structurally: the harness has no
  back-door to a book — any book access a later test performs goes through a
  real session and membership over the API. This task's own smoke tests touch
  no book: only `/healthz`, the mail API, and local git.
- **Rules that do not bear on this task.** *Accessibility/axe* is the e2e-web
  level's (there is no UI here); *offline-first* is the app/Worker's;
  *canonical form over preserving content* is the format's and the service's —
  none has a surface in a black-box API harness, and none is scoped here.

## Acceptance criteria

**Behaviour delivered.**

- `e2e/api/` is a runnable Node/Vitest package: `npm ci` installs it and
  `npm test -- --maxWorkers=4` runs green against a live stack; a `lint` script
  (ESLint flat config, matching `app/`/`api/`) runs clean. The gate's e2e-api
  block (lines 332–346) finds a `test` script and a test file, so the e2e level
  switches from "skipped" to "run" on every push and in CI.
- A `lib/http.js` session client: `fetch`-based, cookie jar carried across
  calls, paths resolved against `ESTANTE_E2E_BASE_URL`, JSON helpers; a fresh
  session per instance.
- A `lib/mail.js` Mailpit helper: list messages, fetch one, find the latest to
  a given recipient, extract a link/token from its body, and clear the mailbox,
  all over `ESTANTE_E2E_MAIL_URL`.
- A `lib/git.js` with two clients: a git-CLI helper (init, config identity,
  add, commit, clone — local now, clone/fetch/push over HTTP with a session
  later) and an isomorphic-git helper (init, add, commit, read-back now; HTTP
  clone/fetch/push with the session cookie later), each operating in a
  caller-provided or `mkdtemp` working directory.
- `lib/env.js` validates `ESTANTE_E2E_BASE_URL`/`ESTANTE_E2E_MAIL_URL` and
  fails fast when unset. `e2e/api/README.md` describes how to run the harness
  (via `scripts/gate`, or against a stack up with the `ESTANTE_*` vars set).

**Tests the task lands with, by level.** Per the `.tji` note — _"Tests:
e2e-api (the harness's own: the stack is up and the health check answers; the
mail catcher's API answers; the git CLI and isomorphic-git helpers init,
commit and clone a local repository)"_ — this task lands with its own
**e2e-api** smoke tests and only those (it is itself the e2e-api harness; there
is no pure module, component or endpoint of its own to unit- or behavior-test —
see Decisions). The gate runs them against the stack it brings up:

- **e2e-api — `e2e/api/health.test.js`** (Vitest, via the session HTTP helper):
  `GET /healthz` at `ESTANTE_E2E_BASE_URL` → `200`, body `ok` — the stack is up
  and answers at the one origin. Pins DIRECTION §3.6 lines 386–392 (end-to-end
  against the one origin), `service_skeleton`'s `/healthz`, and the executable
  proof `compose.md` names (`.tji` line 49). This is the first assertion the
  whole compose→ci→e2e chain has ever made.
- **e2e-api — `e2e/api/mail.test.js`** (Vitest, via the mail helper): the
  Mailpit HTTP API at `ESTANTE_E2E_MAIL_URL` answers — the message list returns
  `200` JSON; a purpose-written message is injected through Mailpit's send API,
  the helper finds it by recipient and extracts its link/token, then the
  mailbox is cleared. Pins the mail-reading seam the emailed sign-in flow
  (workflow 13, DIRECTION §3.3 lines 175–177) is tested through, and the note's
  "the mail catcher's API answers".
- **e2e-api — `e2e/api/git.test.js`** (Vitest, via the git helpers): the
  git-CLI helper inits a bare repo and a working repo, commits a purpose-written
  song fixture, clones the bare repo to a second local directory and reads the
  committed file back; the isomorphic-git helper inits a repo in Node with
  `node:fs`, adds and commits the same fixture, and reads it back via
  `log`/`readBlob`. Pins that both device-side git clients (DIRECTION §3.6 line
  281, lines 317–353) are wired and functional in the harness, and the note's
  "init, commit and clone a local repository". (Scope of each client's verbs
  here, and where HTTP clone/push is proven, under Decisions.)

The closer confirms all three files exist and ran — not skipped — in the gate's
e2e-api step (lines 341–342) before committing.

**Deferred work.** **None registered.** This harness plus its smoke tests are
self-contained. The real device journeys written *in* this harness — the
sign-in, books, sharing, change-check and git-over-HTTP e2e-api tests, and
isomorphic-git's HTTP clone/fetch/push against the live service — are **not**
follow-ups this task defers: they are owned by existing WBS leaves
(`account.*` sign-in, `books.*`/sharing, `sync.*` change-check,
`service.git_http`) that write their tests here when they land, each reusing
these helpers. No new WBS leaf, and no human-judgment item, arises from this
task.

## Decisions

**Plain JavaScript (ESM) on Vitest, no TypeScript, no build step.** *Rationale:*
`app/` and `api/` are plain JS on Vitest, and the gate invokes `npm test --
--maxWorkers=N` expecting `vitest run`; matching that keeps the harness
one `npm ci` away from running, consistent with the repo, and lets `--maxWorkers`
forward with no wrapper. *Alternative rejected:* TypeScript — it would add a
transpile/config layer the rest of the repo does not use, for a black-box
package whose surface is HTTP and shell calls, with no payoff.

**Vitest `run` in the node environment; the env read once and validated.**
*Rationale:* black-box HTTP and git need no DOM, so `environment: 'node'`;
`vitest run` (not watch, reinforced by `CI=true`) is what the gate expects; a
single `lib/env.js` reading `ESTANTE_E2E_BASE_URL`/`ESTANTE_E2E_MAIL_URL` and
throwing a clear message when unset turns "ran outside the gate" from a cryptic
connection error into an actionable one. The stack is already healthy before
tests run (`--wait`, gate line 261), so tests assert, they do not poll for
startup. *Alternative rejected:* a Vitest `globalSetup` that itself brings the
stack up — the gate owns the stack's lifecycle (`stack_up`/`stack_down`); a
harness that also managed it would double-manage and break the one-stack-per-run
isolation.

**A hand-rolled cookie jar over the global `fetch`, no HTTP-client
dependency.** *Rationale:* the API is one origin with one session cookie and no
CORS (`api_contract.md`), so "keep Set-Cookie, re-send Cookie" is a few lines
over Node 24's built-in `fetch` — fewer dependencies to audit, and exactly the
device behaviour. *Alternative rejected:* `tough-cookie` + a fetch wrapper (or
`got`/`axios` with a jar) — full RFC 6265 cookie semantics the single session
cookie does not need, and a supply-chain surface for no gain.

**The mail catcher is exercised through Mailpit's HTTP API, including its send
endpoint, to prove the read helper end-to-end.** *Rationale:* `compose` chose
`axllent/mailpit`, which exposes a read API (`GET /api/v1/messages`,
`/api/v1/message/{id}`), a clear (`DELETE /api/v1/messages`) and a send
(`POST /api/v1/send`) over HTTP. At this task no service component sends mail
yet (sign-in is downstream), so injecting a purpose-written message through the
send API is the only self-contained way to exercise the *reader* — list, find
by recipient, extract a link, clear — which is the seam workflow 13's tests
depend on. *Alternative rejected:* asserting only that `GET
/api/v1/messages` returns `200` on an empty mailbox — it would prove the
transport but leave the find-by-recipient and link-extraction logic (the part
later tests actually reuse) untested until the sign-in task, landing a helper
with no coverage, which the testing policy forbids. (The harness depends on
Mailpit's send endpoint, present in the `axllent/mailpit` image `compose`
runs; noted so a future pin of that image keeps it.)

**Both git clients land; each smoke test exercises the verbs that client
supports locally, and isomorphic-git's HTTP transport is proven downstream
against the real service.** *Rationale:* the host `git` CLI supports cloning a
local repository natively, so its smoke test does the full init→commit→clone
round-trip locally. isomorphic-git has **no local-filesystem clone transport**
— its `clone` speaks smart HTTP to a git server — and the service's
git-over-HTTP endpoint does not exist until `service.git_http` (downstream);
so its smoke test proves the client is wired and functional with `node:fs`
via init→add→commit→read-back, and its clone/fetch/push are exercised over HTTP
against the live service by the `service.git_http` and `sync` e2e-api tests
(the clients' real job, workflows 8 and 14), where a real remote exists. The
helper surface for HTTP clone/push (session cookie on requests) ships now so
those tests have it. This sharpens the note's "init, commit and clone a local
repository" per client without dropping the e2e-api level. *Alternative
rejected:* standing up a throwaway git smart-HTTP server inside the harness so
isomorphic-git can "clone locally" now — it would reimplement the very server
`service.git_http` delivers, as a parallel fixture, for a smoke test; wasteful
and misleading.

**Reusable helpers in `lib/`, purpose-written fixtures in `fixtures/`, each
test in its own temp dir.** *Rationale:* the one-harness rule means every later
e2e-api test is written here, so the session/mail/git seams must be libraries,
not copy-paste; `fs.mkdtemp` per test plus unique identifiers make the
≤4-worker parallel run collision-free, and purpose-written songs honour the
copyright rule. *Alternative rejected:* inlining helpers in the smoke tests —
later authors would duplicate them and drift, defeating the single-harness
intent.

**A `lint` script, matching `app/`/`api/`.** *Rationale:* the gate runs
`npm run lint` for e2e/api when the script exists (gate lines 336–339); an
ESLint flat config consistent with the rest of the repo keeps the harness held
to the same standard the code it tests is, at no extra invocation cost.
*Alternative rejected:* no lint — the gate would simply skip it, but the
harness is code every later task edits, and leaving it unlinted invites drift.

**No unit or behavior tests of this task's own, and no design delta.**
*Rationale:* the deliverable *is* the e2e-api harness — a black-box test
package whose only meaningful assertions are against the running stack, which
is the e2e-api level by definition; it has no pure in-process module or handler
to pin at a lower level, and the helpers are proven exactly by the three smoke
tests that use them. The note names only e2e-api, and that is what lands.
DIRECTION §3.6 (lines 386–392) and the gate already describe this harness
precisely, so nothing in the direction changes. *Alternative rejected:* unit-
testing the cookie jar or the link extractor in isolation — they have no
behaviour independent of a real response, and the smoke tests exercise them
against the real stack, which is the honest level.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `e2e/api/package.json`, `package-lock.json`, `vitest.config.js`, `eslint.config.js` — the Node/Vitest package scaffolding; `vitest run` is the `test` script, `--maxWorkers` forwarded as the gate requires.
- `e2e/api/lib/env.js` — reads and validates `ESTANTE_E2E_BASE_URL`/`ESTANTE_E2E_MAIL_URL`; fails fast with an actionable message when unset.
- `e2e/api/lib/http.js` — fetch-based session client with a hand-rolled cookie jar; paths resolved against `ESTANTE_E2E_BASE_URL`; a fresh session per instance.
- `e2e/api/lib/mail.js` — Mailpit helper: list, fetch, find by recipient, extract link/token, clear; reads the catcher at `ESTANTE_E2E_MAIL_URL`.
- `e2e/api/lib/git.js` — two clients: git-CLI helper (argument arrays through `node:child_process`) and isomorphic-git helper (`node:fs`, HTTP transport with session cookie wired for downstream use).
- `e2e/api/fixtures/the-tuning-song.cifra.md`, `e2e/api/fixtures/songs.js` — purpose-written song fixtures for the git smoke tests.
- `e2e/api/health.test.js` — e2e-api smoke test: `GET /healthz` → 200 `ok`; proves the compose stack is up at the one origin.
- `e2e/api/mail.test.js` — e2e-api smoke tests: Mailpit list/send/find-by-recipient/extract-link/clear; proves the mail catcher and the read helper are wired.
- `e2e/api/git.test.js` — e2e-api smoke tests: git-CLI init→commit→clone round-trip; isomorphic-git init→add→commit→read-back; proves both device-side git clients are functional.
- `e2e/api/README.md` — updated with how to run the harness (via `scripts/gate`, or with `ESTANTE_*` vars set against a running stack).
- Gate's e2e-api level switches from skipped to run on every push; 5 tests, 3 files, all green.
