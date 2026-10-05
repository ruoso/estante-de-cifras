# foundation.compose — Everything locally, as in production

## TaskJuggler entry

Defined as `task compose` in
[`tasks/25-foundation.tji`](../../25-foundation.tji) lines 44–49:

> _compose.yaml: Postgres, the service's image with git, the hook and the
> built app on one origin, a local mail catcher with an HTTP API; a
> healthcheck on every service so `docker compose up --wait` means ready;
> published ports and Postgres credentials read from the variables
> scripts/gate sets (ESTANTE_HTTP_PORT, ESTANTE_PG_PORT, ESTANTE_MAIL_PORT,
> ESTANTE_PG_USER/PASSWORD/DB, with defaults), so the gate can run an
> isolated stack beside a developer's; the app's dev server proxying the
> API. DIRECTION §3.6. Tests: none of its own — `docker compose config`
> valid; the stack is proven by foundation.e2e_api's smoke tests, which land
> next._

The area file's purpose (lines 1–5): _"The monorepo, its tooling, the API
contract, running everything locally as in production, CI, and the two
end-to-end harnesses every later task's e2e tests are written in. The
harnesses land before anything needs them."_ This task is the "running
everything locally as in production" line.

## Effort estimate

**2 days** (from the `.tji`).

## Repository

**estante-de-cifras** (`/home/ruoso/devel/estante-de-cifras`). The work lands
at the repository root (`compose.yaml`, a `Dockerfile` for the service image,
`.dockerignore`) and references, but does not modify, `app/` and `service/`.
The note does not start with `cifra.md:`, so nothing lands in the cifra.md
repository.

A **design delta is not authored**: DIRECTION §3.3 and §3.6 already describe
the stack this task stands up; nothing new to the direction is introduced.

## Inherited dependencies

- `foundation.service_skeleton` — **settled** (`complete 100`,
  [`tasks/25-foundation.tji`](../../25-foundation.tji) lines 30–36). Gives
  the Go binary, its `PORT`-driven config and the `GET /healthz` endpoint the
  container healthcheck targets.
- `foundation.app_tooling` — **settled** (`complete 100`,
  [`tasks/25-foundation.tji`](../../25-foundation.tji) lines 16–22). Gives the
  Vite build (`npm run build` → `app/dist/`) the image bundles, and the
  dev-server API proxy (`ESTANTE_API_ORIGIN`) that makes development
  one-origin too.

Downstream, `foundation.ci` (lines 50–55) runs `scripts/gate` in GitHub
Actions over this stack, and `foundation.e2e_api` (lines 56–61) is the first
task to bring the stack up automatically — its smoke tests ("the stack is up
and the health check answers; the mail catcher's API answers") are the
executable proof of this task. `foundation.e2e_web` (lines 62–67), the
service's `serve_app`, `schema`, `books`, `git_http`, sign-in and the hook
area all extend this `compose.yaml`/`Dockerfile` as they land.

## What this task is

Write the one `compose.yaml` at the repository root that runs the whole
system locally the way it runs in production: Postgres, a local mail catcher
standing in for the transactional email provider, and the service's own image
— a multi-stage build that carries the Go service binary, git beside it, and
the built PWA — all on one origin, with a healthcheck on every service so
`docker compose up --wait` blocks until the stack is ready. Published host
ports and Postgres credentials come from the `ESTANTE_*` variables
`scripts/gate` sets (with sensible defaults for a developer running the stack
by hand), so the gate can bring up an isolated, randomly-ported stack beside a
developer's own. This is the first of the compose → ci → e2e chain; it stands
up the stack's shape, and the e2e-api harness that lands next exercises it.

## Why it needs to be done

Every later end-to-end test — API and web — runs against this stack, and the
Go behavior tests use its Postgres (`ESTANTE_TEST_DATABASE_URL`). `scripts/gate`
already hardcodes `-f compose.yaml` at the repository root and, once an e2e
harness exists, runs `docker compose … up --build --detach --wait` and tears
it down; the file it expects does not exist yet. Until it does, the gate's e2e
level is skipped and nothing proves the service, Postgres and mail actually
run together as production will run them. This task closes that gap: it is the
single dependency `foundation.ci` and `foundation.e2e_api` wait on, and the
production-shape image and one-origin wiring every service task builds on.

## Inputs / context

Governing direction:

- **DIRECTION §3.6**, [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines
  264–379 — the components and what each is written in. Line 302: _"One
  binary, with git beside it in the image."_ The repositories diagram (lines
  362–371) places `compose.yaml` at the repository root. Lines 373–379 are the
  normative statement this task implements: _"Locally, everything runs as in
  production: `compose.yaml` brings up Postgres, the service's image with git,
  the hook and the built app, and a local mail catcher in place of the email
  provider, and the end-to-end tests run against that one origin. While
  developing the app, its dev server proxies the API to the service, so it is
  one origin there too."_
- **DIRECTION §3.3**, lines 140–209 — the one server. Postgres holds accounts,
  the registry and sessions (line 171); a volume holds one bare git repository
  per book at `/data/books/<id>.git` (lines 173–174); a transactional email
  provider sends the sign-in links (lines 175–177); _"Everything runs locally
  as it runs in production: the container and Postgres under docker compose, so
  end-to-end tests sync against a real server"_ (lines 207–209).
- **DIRECTION §3.7**, lines 381–413 — the app is a static PWA the service
  serves and the browser caches; served at the root origin.

The gate (the single source of truth for the stack wiring),
[`scripts/gate`](../../../scripts/gate):

- `stack_up()` (lines 247–267) exports, per run: `ESTANTE_HTTP_PORT`,
  `ESTANTE_PG_PORT`, `ESTANTE_MAIL_PORT` (each a free loopback port);
  `ESTANTE_PG_USER=estante`, `ESTANTE_PG_PASSWORD=estante`,
  `ESTANTE_PG_DB=estante`;
  `ESTANTE_E2E_BASE_URL=http://127.0.0.1:$ESTANTE_HTTP_PORT` (app + API, one
  origin); `ESTANTE_E2E_MAIL_URL=http://127.0.0.1:$ESTANTE_MAIL_PORT` (the
  catcher's HTTP API);
  `ESTANTE_TEST_DATABASE_URL=postgres://…@127.0.0.1:$ESTANTE_PG_PORT/…` (the Go
  behavior tests' DSN); and `ESTANTE_COMPOSE_PROJECT` (a unique `-p` project
  name per run, for isolation).
- It then runs `docker compose -p "$ESTANTE_COMPOSE_PROJECT" -f compose.yaml
  up --build --detach --wait --wait-timeout 300` (lines 260–261) — so **every
  service must declare a healthcheck**, or `--wait` cannot know the stack is
  ready — and `stack_down()` (lines 101–110) runs `down --volumes
  --remove-orphans --rmi local`.
- `e2e_preflight()` (lines 211–243) fails the gate if `compose.yaml`, docker or
  the compose plugin is missing — but only once `e2e/api/package.json` or
  `e2e/web/package.json` exists (lines 315–324). Until an e2e harness lands,
  the stack is not brought up.

The service the image wraps:

- [`service/internal/config/config.go`](../../../service/internal/config/config.go)
  — reads only `PORT` today, `DefaultPort = 8080` (line 16). Its comment
  (lines 12–16): the stack publishes a host port and maps it to this fixed
  internal port, so the container's own bind stays the default.
- [`service/internal/server/health.go`](../../../service/internal/server/health.go)
  lines 11–19 — unauthenticated `GET /healthz` → `200`, body `"ok\n"`, no I/O;
  the endpoint the container healthcheck and `foundation.e2e_api`'s first smoke
  test hit.
- [`service/cmd/service/main.go`](../../../service/cmd/service/main.go) —
  binds all interfaces and shuts down gracefully on `SIGINT`/`SIGTERM` (lines
  50–72), which is how `docker compose down` stops it.
- [`service/go.mod`](../../../service/go.mod) — `go 1.25`, stdlib only.
- `service/cmd/pre-receive/` — README only; its `main.go` is filled by the
  hook area, not here (see Decisions).

The app the image bundles:

- [`app/vite.config.js`](../../../app/vite.config.js) — `base: '/'` (line 15,
  root origin, not a subpath); `build.outDir: 'dist'` (lines 16–19); the
  VitePWA plugin; and the dev-server proxy `server.proxy['/api'] → apiTarget`
  where `apiTarget = process.env.ESTANTE_API_ORIGIN || 'http://localhost:8080'`
  (lines 10, 21–24) — the "dev server proxying the API" the note names,
  already delivered by `foundation.app_tooling`.
- [`app/package.json`](../../../app/package.json) — `build: vite build`.
- [`.node-version`](../../../.node-version) — `24.20.0`.

Predecessor and sibling refinements:
[`service_skeleton.md`](service_skeleton.md) (the `PORT`/`ESTANTE_HTTP_PORT`
split, `/healthz`, graceful shutdown, "git beside it in the image", and that
compose "builds the service's image and wires a container healthcheck to the
endpoint this task adds"); [`app_tooling.md`](app_tooling.md) (root-origin
PWA, the dev proxy, `/` reserved for the served app);
[`api_contract.md`](api_contract.md) (one origin, session cookie, no CORS).

## Constraints / requirements

- **One file at the repository root.** `compose.yaml` at
  `/home/ruoso/devel/estante-de-cifras/compose.yaml` — `scripts/gate` hardcodes
  that name and path (lines 101–110, 260–261). Validate with `docker compose
  config`.
- **Three services, a healthcheck on each.** Postgres, a mail catcher, and the
  service. `docker compose up --wait` must mean ready, so each service's
  `healthcheck` must turn healthy only when it is genuinely serving.
- **One origin.** The service publishes a single HTTP port that serves both
  the app (at `/`, once `service.serve_app` lands) and the API (beneath it) —
  `ESTANTE_E2E_BASE_URL` is that one origin (DIRECTION §3.3 line 157, §3.6 lines
  373–379). No separate static-file container; no CORS surface introduced.
- **The service's image carries git and the built app.** A multi-stage build:
  the PWA built with Node 24, the Go binary built from `service/`, a final
  image with git installed beside the binary and the built app bundled in it
  (DIRECTION §3.6 line 302, lines 373–377). The binary binds its default
  internal port `8080`; the published host port maps to it.
- **Ports and credentials from `ESTANTE_*`, with defaults.** Host ports from
  `ESTANTE_HTTP_PORT`/`ESTANTE_PG_PORT`/`ESTANTE_MAIL_PORT`, Postgres
  credentials from `ESTANTE_PG_USER`/`ESTANTE_PG_PASSWORD`/`ESTANTE_PG_DB`, each
  with a `${VAR:-default}` fallback so `docker compose up` works unset — and so
  the gate's randomly-ported, uniquely-named stack runs beside a developer's
  (note line 48; `scripts/gate` 247–267).
- **The data volume is production-shaped.** A named volume mounted at the
  book path `/data/books` (DIRECTION §3.3 lines 173–174), and a named volume
  for Postgres data, both removed by the gate's `down --volumes` so runs are
  isolated.
- **Component boundaries hold.** The app and the service share no code
  (DIRECTION §3.6 line 275); compose wires containers, it does not couple them.
  The service's structured logging already carries request metadata only — no
  song text, commit messages or secrets (the standing rule); nothing in this
  task logs a body.
- **No book without an account; nothing indexed.** This task adds no route
  and no access path; it only wires the stack. The access rules stay the
  service's.
- **Offline-first and canonical-form rules** do not bear on this task — it
  ships no app behavior and touches no song text — and no test fixtures with
  anyone's copyrighted words are introduced.

## Acceptance criteria

**Behaviour delivered.**

- `compose.yaml` at the repository root defines `postgres`, `mail` (the
  catcher) and `service`, each with a `healthcheck`; `docker compose up
  --build --detach --wait` brings all three to healthy, and `docker compose
  down --volumes` removes them and their volumes.
- The service is reachable on one origin at the published HTTP port;
  `GET /healthz` answers `200 ok` there.
- The mail catcher's HTTP API answers at the published mail port
  (`ESTANTE_E2E_MAIL_URL`), and its SMTP endpoint is reachable from the service
  container on the compose network.
- Postgres is reachable on the published Postgres port with the
  `ESTANTE_PG_*` credentials (the DSN `scripts/gate` builds as
  `ESTANTE_TEST_DATABASE_URL`).
- Host ports and Postgres credentials read from the `ESTANTE_*` variables with
  defaults; unset, `docker compose up` still works on `8080`/`5432`/`8025` and
  `estante`/`estante`/`estante`.
- A `Dockerfile` (multi-stage) and `.dockerignore` at the root build the
  service image — the Go binary, git beside it, and the built PWA bundled in —
  with the build context the repository root.

**Tests the task lands with, by level.** Per the `.tji` note — _"Tests: none
of its own"_ — this is a configuration task and lands with **no automated test
of its own**. Its acceptance is mechanical and manual at landing, and
automated by the very next task:

- **Validation (manual at landing).** `docker compose config -q` exits clean
  (the file is valid and fully interpolates with the `ESTANTE_*` defaults);
  `docker compose up --build --wait` brings every service healthy locally and
  `GET $ESTANTE_E2E_BASE_URL/healthz` answers `ok`; `docker compose down
  --volumes` cleans up. The implementer runs this and records it in the Status
  block.
- **Automated proof (next task, not here).** `foundation.e2e_api` — which
  depends on this through `foundation.ci` — brings the stack up with the same
  `docker compose … up --build --wait` the gate uses and asserts "the stack is
  up and the health check answers" and "the mail catcher's API answers"
  ([`tasks/25-foundation.tji`](../../25-foundation.tji) line 60). That is where
  the gate first exercises this stack.

*Why no unit or behavior tests here.* This task adds no pure module, no
component and no handler — only container wiring. The service's config,
health and logging already carry their own unit and behavior tests from
`foundation.service_skeleton`.

*Why no e2e tests here.* The e2e harnesses do not exist yet — they are
`foundation.e2e_api` (`e2e/api/`) and `foundation.e2e_web` (`e2e/web/`),
downstream of this task through `foundation.ci`. Writing an e2e test here
would require a parallel harness, which the project forbids; the stack's e2e
proof is written in those harnesses, against this stack, as each lands.

**Deferred work.** None — and nothing is deferred to a new task. The pieces
this `compose.yaml`/`Dockerfile` does not yet carry are each already owned by
an existing WBS leaf that extends these files in its own commit, so no
follow-up is registered here:

- Serving the built app at `/` — `service.serve_app`
  ([`tasks/30-service.tji`](../../30-service.tji) line 56); a pure Go change on
  the existing mux, no Dockerfile change needed (see Decisions).
- The `pre-receive` hook binary built into the image — the hook area
  (`tasks/35-hook.tji`), which adds it to this Dockerfile when its `main.go`
  exists.
- The service's runtime environment (Postgres DSN, book-volume path, mail
  endpoint, session/email secrets) — `service.schema`, `service.books`,
  `service.git_http` and the sign-in tasks add their own env to this
  `compose.yaml` as they teach the service to read it.

## Decisions

**The mail catcher is Mailpit (`axllent/mailpit`).** *Rationale:* it receives
over SMTP (the service posts to it on the compose network) and exposes an HTTP
API for reading messages (`ESTANTE_E2E_MAIL_URL`, the catcher the note and
`scripts/gate` line 254 name), and ships readiness endpoints (`/readyz`) for a
healthcheck — exactly the three the stack needs. *Alternative rejected:*
MailHog — effectively unmaintained since ~2020 and without a modern readiness
endpoint, so `--wait` would need a brittle port probe.

**One multi-stage `Dockerfile` at the repository root, final image on a small
Linux base with git.** *Rationale:* the build context must span both `app/`
(for the built PWA) and `service/` (for the binary), so a root Dockerfile with
`context: .` is simplest; a Node 24 stage runs `npm ci && npm run build`, a
`golang:1.25` stage builds the service binary CGO-free, and the final stage
installs git beside the binary (DIRECTION §3.6 line 302) and bundles
`app/dist`. A small base with a shell and `wget` (e.g. Alpine's busybox) lets
the container healthcheck hit `/healthz` with no extra tooling. *Alternative
rejected:* a `scratch` final image — it cannot host git, which DIRECTION
requires in the image, nor run a shell-based healthcheck.

**The image bundles the built app now; serving it stays `service.serve_app`.**
*Rationale:* DIRECTION §3.6 lists "the built app" among what `compose.yaml`
brings up (note line 48, lines 373–377), and the app is buildable today
(`foundation.app_tooling`); bundling it here means `service.serve_app` is a
pure Go change registering a static handler on the existing
[`server.go`](../../../service/internal/server/server.go) mux, and
`foundation.e2e_web` needs no Dockerfile change. *Alternative rejected:*
deferring the app bundle to `service.serve_app` — it would split the image
definition across two tasks for no gain, since the asset is cheap and
buildable now.

**The `pre-receive` hook binary is not built by this Dockerfile.**
*Rationale:* `service/cmd/pre-receive/` has no `main.go` yet (it belongs to the
hook area), so `go build ./cmd/pre-receive` would fail the image build and
break the very stack `foundation.e2e_api` needs. compose is not a consumer of
the hook — e2e-api's smoke tests need only health, the mail API and local git
— so the hook task adds its binary to this Dockerfile, in its own commit, when
the binary exists. *Alternative rejected:* building the hook now (unbuildable)
or stubbing a `main.go` (edits another area's code, which this task's scope
forbids).

**Host ports and credentials via `${ESTANTE_*:-default}`, SMTP kept
internal.** *Rationale:* the gate injects free random ports and a unique
project name for isolation (`scripts/gate` 247–267), and defaults
(`8080`/`5432`/`8025`, `estante`/`estante`/`estante`) let a developer
`docker compose up` by hand beside the gate's stack (note line 48). Only the
mail *HTTP* port is published (tests read it); SMTP (1025) stays on the compose
network, as only the service posts to it. *Alternative rejected:* hardcoded
host ports — they would collide between the gate's stack and a developer's, and
with a developer's own Postgres on 5432.

**`depends_on` with health conditions, and named volumes, wired now though
unused today.** *Rationale:* the service starts after Postgres and the mail
catcher are healthy, and a named volume is mounted at `/data/books` (DIRECTION
§3.3 lines 173–174) and one for Postgres data — the production shape — so
`service.schema`/`books`/`git_http` read them without re-touching compose, and
the gate's `down --volumes` keeps runs isolated. *Alternative rejected:* adding
volumes and `depends_on` piecemeal in each later task — more churn and less
"as in production" now.

**No service runtime environment is set here.** *Rationale:* the service reads
only `PORT` today (`config.go` lines 36–45), and the env names for the Postgres
DSN, the volume path and the mail/provider endpoint are each the owning task's
call (the `foundation.service_skeleton` decision records this); those tasks add
their env to this `compose.yaml` in the same commit that teaches the service to
read it. *Alternative rejected:* inventing those env names now — guesses that
later tasks would likely rename, churning the file.

**No automated test lands with this task.** *Rationale:* a config-only task has
no pure module, component or endpoint to pin, the e2e harnesses do not yet
exist, and a parallel harness is forbidden; the note itself says "none of its
own". Acceptance is `docker compose config` validity plus a local
`up --wait`, and `foundation.e2e_api` (next) is the executable proof. Naming no
test means the closer has none to check in the gate output — correct for this
task. *Alternative rejected:* a throwaway test harness here — it would
duplicate `e2e/api/` and violate the one-harness rule.

**No design delta.** *Rationale:* DIRECTION §3.3 (lines 207–209) and §3.6
(lines 373–379) already describe this stack precisely; the task turns their
promise into `compose.yaml`, introducing nothing new to the direction.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `compose.yaml` (3.4 KB) at the repository root defines `postgres` (official image), `mail` (`axllent/mailpit`) and `service` (built from `Dockerfile`), each with a healthcheck; `docker compose up --build --detach --wait` brought all three to healthy.
- `Dockerfile` (2.5 KB) at the repository root: multi-stage build — Node 24 stage builds the PWA (`npm ci && npm run build`), `golang:1.25-alpine` stage builds the Go binary CGO-free, final Alpine stage installs git beside the binary and bundles `app/dist/` at `/srv/app`.
- `.dockerignore` (628 B) at the repository root excludes `node_modules/`, build outputs, and git objects from the Docker build context.
- All three services configured with `${ESTANTE_*:-default}` variables (ports: `8080`/`5432`/`8025`; credentials: `estante`/`estante`/`estante`); SMTP port kept internal to the compose network, only the mail HTTP API port published.
- Named volumes wired: `books_data` at `/data/books` (DIRECTION §3.3 lines 173–174) and `postgres_data` for Postgres; `service` `depends_on` both `postgres` and `mail` with health conditions.
- Manual validation recorded by implementer: `docker compose config -q` clean; `docker compose up --build --detach --wait` → all healthy; `GET /healthz` → `200 ok`; Mailpit HTTP API → `200`; SMTP reachable from service container; Postgres accepting connections; `docker compose down --volumes` → clean.
