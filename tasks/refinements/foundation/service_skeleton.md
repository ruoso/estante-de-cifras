# foundation.service_skeleton — Service skeleton

## TaskJuggler entry

`task service_skeleton` in
[`tasks/25-foundation.tji`](../../25-foundation.tji) (lines 29–34), under
`task foundation`. Its note: *"Go module, net/http, config, structured
logging of request metadata only (never song text, commit messages or
secrets), health check. DIRECTION §3.6. Tests: unit (config from the
environment; the log line carries method, path, status and duration and
never a body); behavior (the health check through httptest)."* The area
file's header states the stream's purpose: *"The monorepo, its tooling, the
API contract, running everything locally as in production, CI, and the two
end-to-end harnesses every later task's e2e tests are written in. The
harnesses land before anything needs them."*
([`tasks/25-foundation.tji`](../../25-foundation.tji) lines 1–5).

## Effort estimate

**1 day** (from the `.tji`).

## Repository

**estante-de-cifras** (`/home/ruoso/devel/estante-de-cifras`), the
`service/` directory only — and within it `service/cmd/service` (the one
binary) plus `service/internal/…` Go packages. This task turns the
reserved, README-only `service/` slot (from
[`foundation.monorepo`](monorepo.md): [`service/README.md`](../../../service/README.md)
and [`service/cmd/service/README.md`](../../../service/cmd/service/README.md),
each naming this task as the one that fills it) into a real Go module that
builds, runs and serves a health check. It does **not** touch
`service/cmd/pre-receive` — that slot belongs to the hook stream
(`foundation.monorepo` reserved it for the hook, not for this task). No other
directory is touched, and no cifra.md work lands: the note does not begin
with `cifra.md:`.

No design delta is authored. DIRECTION §3.6 names the service's language,
home and inner shape (*"`net/http`; `pgx` for Postgres … One binary, with
git beside it in the image"*), and §3.3 fixes the one-server model and the
request-metadata-only logging rule; this task realises that skeleton without
amending any designed behaviour (§Decisions).

## Inherited dependencies

- **`foundation.monorepo` — settled.** Complete (`complete 100`,
  [`tasks/25-foundation.tji`](../../25-foundation.tji) lines 10–15;
  refinement [`monorepo.md`](monorepo.md)). It reserved `service/` with
  placeholder READMEs — [`service/README.md`](../../../service/README.md)
  and [`service/cmd/service/README.md`](../../../service/cmd/service/README.md)
  — naming this task as the one that fills `cmd/service` and reserving
  `cmd/pre-receive` for the hook stream, and it fixed the directory shape
  (`service/`, `service/cmd/service`, `service/cmd/pre-receive`; no alternate
  spelling, no shared `lib/`/`common/` between `app/` and `service/`,
  DIRECTION §3.6 line 275). It left [`scripts/gate`](../../../scripts/gate)
  skipping the service on *"estante service: service/go.mod does not exist
  yet"* (gate lines 326–330). Creating `service/go.mod` with a package here
  is what flips that branch from SKIP to a real `go vet` / `go test` / `go
  build` run (gate `go_checks`, lines 171–189). `depends !monorepo` is this
  task's only declared dependency
  ([`tasks/25-foundation.tji`](../../25-foundation.tji) line 32).
- **`bootstrap.architecture` / `bootstrap.direction` — settled** (through
  the `foundation` parent,
  [`tasks/25-foundation.tji`](../../25-foundation.tji) line 8). They wrote
  DIRECTION §3.3 *The one server* and §3.6 *Components*, which name the one
  Go service, its net/http core, and the no-song-text-in-logs rule this task
  carries.

This task is a sibling of `app_tooling`, `api_contract` and `compose`, which
also carry `depends !monorepo`
([`tasks/25-foundation.tji`](../../25-foundation.tji) lines 20, 39, 45).
Downstream it is load-bearing: the whole service stream gates on it —
`task service { depends foundation.service_skeleton, foundation.api_contract,
foundation.e2e_api }`
([`tasks/30-service.tji`](../../30-service.tji) line 7) — so
`service.schema`, `service.passkeys`, `service.git_http`, `service.serve_app`
and the rest build inside the module, config, logging middleware and
request-handling seam this task establishes. `foundation.compose`
(`depends !service_skeleton`,
[`tasks/25-foundation.tji`](../../25-foundation.tji) line 45) builds the
service's image and wires a container healthcheck to the endpoint this task
adds, and `foundation.e2e_api`'s first smoke test is *"the stack is up and
the health check answers"*
([`tasks/25-foundation.tji`](../../25-foundation.tji) line 58).

## What this task is

This task creates the Go service as a real, runnable program: a `go.mod`
module at `estantedecifras.app/service`, a `cmd/service` entry point, and the
three cross-cutting seams every later service task leans on, each kept
deliberately minimal:

1. **Configuration from the environment** — a small typed `Config` loaded
   once at start-up from environment variables, with sensible defaults and a
   fail-fast error on a bad value. Today it carries only what the skeleton
   needs (the listen port); later tasks extend it (the Postgres DSN in
   `service.schema`, the volume path in `service.books`, the email provider
   and session secrets in sign-in).
2. **Structured logging of request metadata only** — a JSON structured
   logger (Go's standard `log/slog`) and one request-logging middleware that
   emits a single line per request carrying method, path, status and
   duration, and **never** a request or response body, a commit message, an
   email address or a token (DIRECTION §3.3). This is the standing
   "no song text in logs" rule made concrete at the HTTP edge; later handlers
   add fields (the authenticated user id, the book id) but never a body.
3. **A health check** — an unauthenticated `GET /healthz` returning `200` and
   a tiny fixed body, assembled onto a `net/http.ServeMux` behind the logging
   middleware, run under an `http.Server` with graceful shutdown on
   `SIGINT`/`SIGTERM` (a clean stop matters for a container). This is the
   endpoint `foundation.compose`'s container healthcheck and
   `foundation.e2e_api`'s smoke test target.

It writes no database code, no auth, no git-over-HTTP and no app serving:
those are the `service.*` tasks, each of which will register its routes on
the mux and its fields on `Config`. This task is the frame they hang on.

## Why it needs to be done

Nothing in the service stream can start until the module exists and builds:
`service.schema` needs a module to add `pgx` and migrations to;
`service.passkeys`, `service.git_http` and `service.serve_app` need a mux to
register routes on, a `Config` to read their settings from, and a logger that
already refuses bodies. `foundation.compose` needs a binary to build into an
image and a health endpoint to point a container healthcheck at, and
`foundation.e2e_api` needs that endpoint to answer before any black-box test
can assume the stack is up. Establishing the config, logging and
request-handling seams once, correctly — especially the
request-metadata-only logging rule — means every later handler inherits them
rather than re-deciding them. It also flips the gate's service branch from
SKIP to a live `go vet` / `go test` / `go build`, so Go regressions are
caught from here on.

## Inputs / context

- **The task block** —
  [`tasks/25-foundation.tji`](../../25-foundation.tji) lines 29–34: effort
  `1d`, `depends !monorepo`, and the note naming the four deliverables (Go
  module, net/http, config, logging, health check) and the two test levels.
- **DIRECTION §3.6 *Components, and what each is written in*** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 264–302. The
  service is *"Go … this repository, `service/`"* (line 270); *"The app and
  the service share no code"* (line 275); and *"Inside the service, nothing
  unusual: `net/http`; `pgx` for Postgres; `go-webauthn` for passkeys; the
  email provider's HTTP API. One binary, with git beside it in the image"*
  (lines 300–302). The skeleton takes only the `net/http` and one-binary part
  now; `pgx`, `go-webauthn` and the email API arrive with the tasks that use
  them.
- **DIRECTION §3.6 *Repositories*** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 360–371: the
  `service/` → `cmd/service`, `cmd/pre-receive` tree this task fills the first
  of.
- **DIRECTION §3.3 *The one server*** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 140–209: one small
  Go program in a container on Railway, serving the app at the root of
  `estantedecifras.app` and the API beneath; the standing rule that the
  service logs request metadata only, never song text, commit messages or
  secrets (the §Constraints anchor below).
- **The standing-rule cross-reference** —
  [`tasks/refinements/foundation/api_contract.md`](api_contract.md) lines
  244–248 names *"the structured logging rule carried by
  `foundation.service_skeleton`"* and ties it to DIRECTION §3.3. This task is
  that carrier.
- **The gate's Go hook** — [`scripts/gate`](../../../scripts/gate) lines
  171–189 (`go_checks`: `go vet ./...`, `go test -p $(nproc) ./...`, `go
  build`), lines 326–330 (the service branch, run when `service/go.mod`
  exists). A module with `go mod init` but no package is excused (*"no Go
  packages yet"*, lines 173–176), so the skeleton must land at least one
  package with tests to go live.
- **The downstream consumers of the health endpoint** —
  [`tasks/25-foundation.tji`](../../25-foundation.tji) line 46
  (`foundation.compose`: *"a healthcheck on every service so `docker compose
  up --wait` means ready"*) and line 58 (`foundation.e2e_api`: *"the stack is
  up and the health check answers"*). The gate publishes the stack's port as
  `ESTANTE_HTTP_PORT` and maps it to the container
  ([`scripts/gate`](../../../scripts/gate) lines 248–256).
- **Module-path and Go-version precedent** —
  [`api/go.mod`](../../../api/go.mod): `module estantedecifras.app/api`, `go
  1.25`. The service follows the pattern: `estantedecifras.app/service`, `go
  1.25`.
- **The reserved slots** — [`service/README.md`](../../../service/README.md)
  and [`service/cmd/service/README.md`](../../../service/cmd/service/README.md),
  which name this task.
- **Style precedent** — [`foundation/monorepo.md`](monorepo.md),
  [`foundation/app_tooling.md`](app_tooling.md) and
  [`foundation/api_contract.md`](api_contract.md), the sibling foundation
  refinements, for section shape, the test-naming convention
  (`**<level> — `<path>`** (<runner>): <what it pins>`) and the
  rationale/alternative Decisions form.

## Constraints / requirements

- **Go, in `service/`, one binary, `net/http` only.** The module lives at
  `estantedecifras.app/service`; the entry point is `service/cmd/service`;
  routing is a standard-library `net/http.ServeMux` (no third-party router).
  No dependency is added that the skeleton does not use — `pgx`,
  `go-webauthn` and the email client arrive with their tasks (DIRECTION §3.6
  lines 300–302).
- **The component boundary holds.** The service shares no code with the app:
  nothing in `service/` imports from `app/`, and no shared `lib/`/`common/`
  top-level directory is introduced (DIRECTION §3.6 line 275;
  [`monorepo.md`](monorepo.md)). The only contracts crossing the boundary are
  the HTTP API (`api/`) and the format (cifra.md), neither touched here.
- **Config is loaded once, from the environment, and fails fast.** `Config`
  is a plain struct built by a pure `Load` function taking an env lookup, so
  it is unit-testable without touching the real process environment; an
  unparseable value is a start-up error with a clear message, not a silent
  default.
- **No song text — and no body at all — in logs.** The request-logging
  middleware records method, path, status and duration and nothing drawn from
  a request or response body, nor any header carrying a secret (no
  `Authorization`, `Cookie`, or email address). This is the standing
  "no song text in logs" rule (DIRECTION §3.3; carried by this task per
  [`api_contract.md`](api_contract.md) lines 244–248), and it is the task's
  central deliverable, not an afterthought.
- **The health check is unauthenticated, cheap and side-effect-free.** It
  does no I/O (the skeleton has no database or volume yet), so it answers
  purely that the process is up and serving — exactly what a container
  healthcheck and the e2e smoke test need.
- **Graceful shutdown.** The server stops cleanly on `SIGINT`/`SIGTERM` via
  `http.Server.Shutdown`, so the container stops without dropping in-flight
  requests — the behaviour a Railway deploy and `docker compose down` rely
  on.
- **Standing rules — which apply.** *No song text in logs* **applies and is
  the task's core** (structured logging of request metadata only).
  *Offline-first*, *accessibility* (no UI here — React Aria and axe bind the
  app tasks, not the service), *no book without an account* (no book access
  is served yet) and *canonical form over preserving content* (no format
  handling) deliver nothing in this task and are not scoped.

## Acceptance criteria

**Behaviour delivered.** `service/` is a Go module that builds and runs: `go
build ./...` produces the `cmd/service` binary; running it starts an HTTP
server on the configured port; `GET /healthz` answers `200` with its fixed
body; every request logs exactly one structured line of method, path, status
and duration with no body in it; and `SIGINT`/`SIGTERM` stops the server
cleanly. The gate's service branch goes from SKIP to a green `go vet` / `go
test` / `go build`. Concretely:

- `service/go.mod` declares `module estantedecifras.app/service` and `go
  1.25`; `service/cmd/service/main.go` wires `Config` → `slog` logger →
  `ServeMux` behind the logging middleware → `http.Server` with graceful
  shutdown.
- `Config` is read from the environment with a default listen port and a
  fail-fast error on a bad value.
- `GET /healthz` → `200`; the logging middleware emits one metadata-only line
  per request.

**Tests the task lands with, by level.** The `.tji` note names **unit** and
**behavior**; both land here.

- **unit — `service/internal/config/config_test.go`** (`go test`): pins that
  `Config` loads from an injected env lookup — the default listen port when
  the variable is unset, an overriding value honoured, and an unparseable
  value rejected with a clear error (not a silent fallback). Pins the
  config-from-the-environment half of the note and DIRECTION §3.3's
  container/Railway deployment model.
- **unit — `service/internal/server/logging_test.go`** (`go test`): drives
  one request (carrying a song-like body fixture written for the purpose, and
  an `Authorization`/`Cookie` header) through the logging middleware wrapping
  a stub handler, with the logger writing to a buffer, and asserts the line
  carries method, path, status and duration and that **none** of the body
  bytes, the header values, or an email address appear anywhere in it. Pins
  the "log the metadata, never a body or a secret" rule (DIRECTION §3.3; the
  note's *"the log line carries method, path, status and duration and never a
  body"*).
- **behavior — `service/internal/server/health_test.go`** (`go test` via
  `net/http/httptest`): assembles the real handler (mux + logging middleware
  + `/healthz`) and, through `httptest`, makes `GET /healthz` and asserts
  `200`, the expected body, and that exactly one metadata-only line was
  logged. Pins the note's *"the health check through httptest"* and DIRECTION
  §3.6's `net/http`.

*Why no e2e levels here.* The `.tji` note names none, and neither harness
exists yet: `foundation.compose` and `foundation.e2e_api` land after this
task. The health endpoint's over-the-wire proof is already scoped as
`foundation.e2e_api`'s own smoke test (*"the stack is up and the health check
answers"*, [`tasks/25-foundation.tji`](../../25-foundation.tji) line 58) and
its container-healthcheck wiring as `foundation.compose`'s — neither is
deferred by this task; both are existing WBS leaves.

**Deferred work.** None registered. The config, logging and request-handling
seams are complete as a skeleton; later `service.*` tasks extend `Config`
with their own fields, register their own routes on the mux, and land their
own behavior and e2e-api tests against those fields and routes — ordinary
in-scope work for those tasks, not tech debt carried from this one.

## Decisions

- **Module path `estantedecifras.app/service`, `go 1.25`.** *Rationale:*
  mirrors the only existing Go module in the repository,
  [`api/go.mod`](../../../api/go.mod) (`estantedecifras.app/api`, `go 1.25`),
  so the two modules share a stable, domain-anchored prefix (DIRECTION §3.3's
  one origin, `estantedecifras.app`) and the same toolchain line the gate
  already runs green. *Alternative rejected:* a bare `service` or a
  `github.com/…` path — needlessly divergent from the sibling module and, for
  the GitHub form, premature given the service is not published as a library.
- **Listen port from `PORT` (default `8080`).** *Rationale:* DIRECTION §3.3
  commits to Railway as the first host, and Railway injects `PORT` and expects
  the process to bind it; honouring `PORT` makes the service deploy with no
  platform-specific glue. The gate/compose publish the stack's host port as
  `ESTANTE_HTTP_PORT` and map it to the container's fixed internal port, so
  the container's own bind stays a simple default. *Alternative rejected:* an
  `ESTANTE_PORT`/`ESTANTE_LISTEN_ADDR` variable for prefix-consistency with
  the gate's `ESTANTE_*` set — those are the stack's *host-side* publish
  variables ([`scripts/gate`](../../../scripts/gate) lines 248–256), a
  different concern from what the container binds, and inventing a bind
  variable Railway does not set would need glue to translate it back to
  `PORT`. Matching the deployment target wins over matching the gate's
  host-side names. (Later service config variables the service itself owns —
  a Postgres DSN, the volume path — may still take an `ESTANTE_` prefix; that
  is each task's call.)
- **`log/slog` with a JSON handler, no logging dependency.** *Rationale:* the
  standard library covers structured logging exactly as DIRECTION §3.6's
  *"nothing unusual"* intends, and a no-new-dependency default matches the
  sibling tasks' bias; JSON lines are what a container log collector ingests.
  The middleware builds the line field by field, so a body is structurally
  impossible to log by accident. *Alternative rejected:* `zap`/`zerolog` —
  faster, but the service's traffic is small (§3.3) and a third-party logger
  buys nothing the standard library lacks here.
- **`net/http.ServeMux`, method-and-path patterns, no router.** *Rationale:*
  DIRECTION §3.6 says `net/http`; Go 1.22+'s `ServeMux` routes by method and
  path, which is all the service needs, and it keeps the dependency surface
  minimal for the git-over-HTTP framing that `service.git_http` writes by
  hand. *Alternative rejected:* `chi`/`gorilla` — a dependency the standard
  mux makes unnecessary.
- **A dedicated `/healthz` endpoint, unauthenticated and I/O-free.**
  *Rationale:* a stable, well-known liveness path that a container
  healthcheck and the e2e smoke test can hit without a session, doing no work
  the skeleton cannot yet do (no DB). *Alternative rejected:* folding
  liveness into `/` — `/` is reserved for the served app
  (`service.serve_app`), and a readiness check that touches Postgres is
  `service.schema`'s to add later, layered on this liveness check.
- **Graceful shutdown in the skeleton.** *Rationale:* a container is stopped
  by signal on every deploy and every `docker compose down`; wiring
  `Shutdown` once, in the frame, means no later task has to retrofit it.
  *Alternative rejected:* a bare `ListenAndServe` — simpler now, but it drops
  in-flight requests and would have to be undone the moment real handlers
  exist.
- **Two internal packages (`config`, `server`) plus `cmd/service`.**
  *Rationale:* `config` is pure and unit-testable without a process
  environment; `server` holds the mux assembly, the logging middleware and
  the health handler together (their three test files live beside them); `main`
  only wires them. This is the smallest split that keeps each seam
  independently testable at the level the note names. *Alternative rejected:*
  everything in `cmd/service` (not importable, awkward to unit-test) or a
  package per concern (more structure than two call sites justify today).
- **No design delta.** DIRECTION §3.6 names the language, home, `net/http`
  core and one-binary shape, and §3.3 fixes the one-server model and the
  request-metadata-only logging rule; building the skeleton realises them and
  changes no designed behaviour and opens no new architectural seam, so there
  is nothing to amend in DIRECTION or a workflow.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `service/go.mod` — `module estantedecifras.app/service`, `go 1.25`, stdlib-only (no `go.sum`); flips the gate's service branch from SKIP to a live `go vet` / `go test` / `go build`.
- `service/internal/config/config.go` — pure `Load(lookup)` → `Config{Port}`, default `8080` via `PORT`, fail-fast on unparseable or out-of-range value.
- `service/internal/server/logging.go` — `LogRequests` middleware: one JSON line per request with method, path, status and duration; no body, no `Authorization`/`Cookie`, no email address.
- `service/internal/server/health.go` — `GET /healthz` → `200`, fixed body `"ok\n"`, I/O-free.
- `service/internal/server/server.go` — `Handler` assembling `ServeMux` behind the logging middleware.
- `service/cmd/service/main.go` — wires Config → slog JSON → mux → `http.Server` with SIGINT/SIGTERM graceful shutdown (clean exit 0).
- Unit tests: `service/internal/config/config_test.go` (default port, override, empty-as-unset, unparseable rejected, out-of-range rejected); `service/internal/server/logging_test.go` (song-like body + Authorization/Cookie + email-in-query → one metadata line, nothing leaked).
- Behavior test: `service/internal/server/health_test.go` (real handler via `httptest.NewServer`, `GET /healthz` → 200 + body + exactly one metadata-only line logged).
