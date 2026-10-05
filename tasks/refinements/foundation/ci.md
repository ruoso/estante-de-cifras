# foundation.ci — CI

## TaskJuggler entry

Back-link: `task ci` in [`tasks/25-foundation.tji`](../../25-foundation.tji),
lines 51–56:

```
task ci "CI" {
  effort 1d
  allocate team
  depends !compose
  note "GitHub Actions calling scripts/gate and nothing else — both repositories (cifra.md checked out beside), with Docker and Playwright's browsers installed so the gate's e2e level runs once the harnesses exist. Tests: none of its own — the workflow runs scripts/gate green on a push."
}
```

The area file's purpose line (lines 1–5): "The monorepo, its tooling, the
API contract, running everything locally as in production, CI, and the two
end-to-end harnesses every later task's e2e tests are written in. The
harnesses land before anything needs them."

## Effort estimate

**1 day** (from the `.tji`).

## Repository

**estante-de-cifras** (`/home/ruoso/devel/estante-de-cifras`). The task adds
GitHub Actions workflow(s) under `.github/workflows/` and nothing more; no
existing file is edited. The note does **not** start with `cifra.md:`, so no
work lands in the `/home/ruoso/devel/cifra.md` repository — though the
workflow **checks that repository out beside** this one and the gate it calls
validates both working trees (see Decisions). **No design delta is
authored**: DIRECTION §3.6 (lines 386–392) already says CI runs the app
tests, the Go tests and the end-to-end tests here, and `scripts/gate` already
exists as the single thing CI calls.

## Inherited dependencies

- **`foundation.compose`** — `depends !compose` (`.tji` line 54), **settled**
  (`complete 100`, `.tji` line 47). `compose.yaml`, the multi-stage
  `Dockerfile` and `.dockerignore` are in place at the repository root, so the
  gate's end-to-end step has a stack to bring up the moment an e2e harness
  exists. CI is the task that makes that stack build and run on a push.
- Transitively settled and relied on: `foundation.monorepo` (the layout and
  `scripts/gate`), `foundation.service_skeleton` (`service/go.mod`, Go 1.25),
  `foundation.app_tooling` (`app/package.json`, Node from `.node-version`),
  `foundation.api_contract` (`api/`). Each is `complete 100`. The gate already
  exercises all of them; CI only makes a hosted runner run the gate.

Downstream consumers: **`foundation.e2e_api`** (`depends !ci`, `.tji` line 59)
and, after it, **`foundation.e2e_web`** (`depends !e2e_api, service.serve_app`,
line 65) are gated behind this task — their e2e tests are only worth writing
once a push actually runs the gate's e2e level on a hosted runner with Docker
and Playwright's browsers. Beyond them, **every later task** relies on this
workflow to run `scripts/gate` on its pull request, so a push can never merge
a red tree.

## What this task is

Wire **GitHub Actions** so that a push (and a pull request) to this repository
runs `scripts/gate` — the project's single source of green — on a hosted
runner, over **both repositories**, and reports the result. The workflow:

1. checks out estante-de-cifras and, beside it, the `ruoso/cifra.md` repository
   at the sibling path the gate expects (`../cifra.md`);
2. provisions the toolchain the gate needs — git, Node (pinned by
   `.node-version`), Go (pinned by `service/go.mod`), Python 3, TaskJuggler
   (`tj3`), Docker with the Compose plugin, and — once an e2e-web harness
   exists — Playwright's browsers;
3. runs `scripts/gate` **and nothing else** for verification.

It does **not** reimplement any check the gate performs (no separate `npm
test`, `go test`, lint, build or `docker compose` step), does not add or edit
any gate logic, and does not build or publish a release image — deployment is
not in scope anywhere in the WBS yet. It is a thin, config-only task: a
runner definition that delegates all verification to the gate.

## Why it needs to be done

DIRECTION §3.6 (lines 390–392): "CI runs the app's tests, the Go tests and
the end-to-end tests here; the corpus and the cross-implementation comparison
run in cifra.md." Until this task, the gate is run only by the orchestrator
driver and by people before committing (`orchestrator/README.md` lines 73–76:
"run by the driver, by people before committing, and — once `foundation.ci`
lands — by CI, which should call it rather than repeat its steps"). Nothing
stops a red tree from being pushed. CI closes that: every push proves the
whole chain — `tj3 --silent --no-reports` clean, `scripts/unblocked.py`
clean, the app, service and API checks, and the end-to-end levels against the
compose stack — green on a neutral machine.

It also unblocks the two e2e harnesses. `foundation.e2e_api` and
`foundation.e2e_web` are written to run **in CI** against the compose stack;
the WBS wires them behind `ci` (`depends !ci`) precisely so the hosted runner
has Docker and Playwright's browsers ready before anyone writes a test that
needs them. This task flips the gate's end-to-end level from "runs on a
developer's machine" to "runs on every push," which is what makes those
harnesses meaningful.

## Inputs / context

- **The `.tji` task** — [`tasks/25-foundation.tji`](../../25-foundation.tji)
  lines 51–56 (the `ci` block, quoted above) and line 54 (`depends
  !compose`).
- **`scripts/gate`** (`/home/ruoso/devel/estante-de-cifras/scripts/gate`,
  bash, 408 lines) — the single thing CI calls. The relevant surface:
  - Header (lines 1–57): it verifies **both** repositories; each check runs
    when its target exists and is skipped (saying so) otherwise; it lists the
    test levels and the `ESTANTE_*` variables the stack is given.
  - Usage (lines 49–57): `scripts/gate [estante|cifra.md]...` (default:
    both); `ESTANTE_CIFRA_MD_DIR` is the cifra.md checkout (default
    `../cifra.md` beside this repository, a relative value resolved from the
    repo root); `ESTANTE_E2E_WORKERS` bounds e2e parallelism (default
    `nproc`, at most 4).
  - Setup (lines 58–97): `cd "$(git rev-parse --show-toplevel)"`;
    `JOBS="$(nproc)"`; `CIFRA_MD_DIR="${ESTANTE_CIFRA_MD_DIR:-../cifra.md}"`,
    resolved against the repo root (lines 69–76).
  - estante checks (lines 273–363): tj3 validation failing on any error or
    warning (lines 276–287), `python3 scripts/unblocked.py` (289–290),
    `app/` (292–296), `api/` (302–311), the e2e decision (315–324), `service/`
    Go tests against the live stack's Postgres (326–330), **e2e-api** (332–346),
    **e2e-web** via `npx --no-install playwright test --workers=…` (348–360).
  - The e2e harness skip (lines 315–324): if neither `e2e/api/package.json`
    nor `e2e/web/package.json` exists, the stack is **not** brought up and the
    e2e level is skipped with a message — so the gate is green on today's tree
    and becomes stricter as harnesses land.
  - `e2e_preflight` (lines 211–243): once an e2e harness exists, a missing
    `compose.yaml`, Docker, or Compose plugin is a **fail** with install
    instructions; for e2e/web it verifies `@playwright/test` is installed and
    the needed **browser executables exist**, else it fails telling you to run
    `npx playwright install --with-deps` — the gate checks for browsers, it
    does not install them, so the CI environment must.
  - `stack_up` (lines 247–267): injects free loopback ports, a unique
    `ESTANTE_COMPOSE_PROJECT`, and `ESTANTE_E2E_BASE_URL` /
    `ESTANTE_E2E_MAIL_URL` / `ESTANTE_TEST_DATABASE_URL`, then `docker compose
    … up --build --detach --wait --wait-timeout 300`; always torn down by a
    trap.
  - cifra.md checks (lines 369–405): skipped entirely if
    `$CIFRA_MD_DIR/.git` is absent; otherwise the Python `reference/` tests
    plus `python -m tools.corpus --check`, cifra.md `js/` and `go/`.
- **`orchestrator/README.md`** — lines 36–70 (the two repositories;
  `ESTANTE_CIFRA_MD_DIR` default `../cifra.md`, line 47–49), lines 72–115
  (`scripts/gate` is the single source of truth, "once `foundation.ci` lands
  … CI … should call it rather than repeat its steps"; `scripts/gate estante`
  or `cifra.md` checks one, the driver always runs both), lines 113–115 (a CI
  replay step via `act` can later be appended to `VERIFICATION_STEPS` in
  `driver.py`; until then the gate is the whole chain).
- **`docs/DIRECTION.md`** §3.6 Repositories (lines 373–392): the two-repo
  layout; "Locally, everything runs as in production" (lines 386–392); "CI
  runs the app's tests, the Go tests and the end-to-end tests here; the corpus
  and the cross-implementation comparison run in cifra.md" (lines 390–392).
  §3.6 line 297–298 locates the **random cross-implementation comparison** in
  cifra.md's own CI, not the gate.
- **Toolchain versions** on disk: `.node-version` → `24.20.0`; `service/go.mod`
  → `go 1.25`; `Dockerfile` stages (`node:24.20.0-slim`, `golang:1.25-alpine`,
  `alpine:3.21`). `tj3` (TaskJuggler) is a Ruby gem the gate requires.
- **Predecessor decisions** — [`compose.md`](./compose.md): the stack is
  `postgres`, `mail` (Mailpit) and `service` (from the root `Dockerfile`),
  each healthchecked; `docker compose … up --build --detach --wait` brings it
  up and `down --volumes` tears it down; host ports and credentials come from
  `${ESTANTE_*:-default}`; compose lands **no test of its own**, proven by
  `foundation.e2e_api`.
- **Style precedent** — the five sibling foundation refinements
  ([`monorepo.md`](./monorepo.md), [`app_tooling.md`](./app_tooling.md),
  [`service_skeleton.md`](./service_skeleton.md),
  [`api_contract.md`](./api_contract.md), [`compose.md`](./compose.md)); this
  task most resembles `compose.md` — config-only, no automated test of its
  own, proven green by its downstream task.

## Constraints / requirements

- **The workflow calls `scripts/gate` and nothing else, for verification.**
  No bespoke `npm`/`go`/lint/build/`docker compose`/test step; no duplication
  of a gate check; no edit to `scripts/gate` or any component. Provisioning
  the runner (checking out the repos, installing the toolchain) is setup, not
  verification — that is the workflow's job and is not "something else."
- **Both repositories, cifra.md checked out beside.** The workflow checks out
  `ruoso/cifra.md` at the sibling path the gate's default
  `ESTANTE_CIFRA_MD_DIR=../cifra.md` resolves to, so `scripts/gate` (no
  argument) validates both trees exactly as the driver does. The deterministic
  corpus check (`python -m tools.corpus --check`) is part of the gate and runs
  here; the **random cross-implementation fuzz comparison** DIRECTION §3.6
  (lines 297–298) places in cifra.md's own CI is not part of `scripts/gate`
  and is out of scope here.
- **The toolchain the gate needs, pinned to the repo.** Node from
  `.node-version` (`24.20.0`), Go from `service/go.mod` (`1.25`), Python 3,
  TaskJuggler (`tj3`), git, and Docker with the Compose plugin (present on the
  standard Ubuntu runner). Versions are read from the repo's own files, never
  hardcoded in the workflow, so a bump to `.node-version` or `go.mod` moves CI
  with it.
- **Docker and Playwright's browsers ready for the e2e level.** The runner
  must have Docker (for `compose … up --wait`) and, once an e2e-web harness
  exists, Playwright's browser binaries installed — the gate checks for them
  and fails if absent, it does not install them. Until `foundation.e2e_web`
  lands, the browser-install step is inert (guarded on
  `e2e/web/package.json`); the moment the harness exists it activates, with no
  further edit to the workflow.
- **Bounded parallelism.** Nothing the workflow adds runs an unbounded build.
  The gate already bounds everything (`-p $(nproc)`, explicit
  `--maxWorkers`/`--workers`, `ESTANTE_E2E_WORKERS` capped at 4); CI does not
  override those with anything unbounded.
- **Component boundaries (DIRECTION §3.6).** The app and the service share no
  code; CI reflects that structurally by running one gate that checks each in
  place, adding no shared build tooling.
- **Standing rules — which apply.** *No song text in logs* bears indirectly:
  CI logs are the gate's own output (request-metadata-level at most) and test
  output over purpose-written fixtures; the workflow adds no logging that could
  carry song text, and must not echo secrets. The cifra.md checkout of a
  **public** repository needs no token beyond the default `GITHUB_TOKEN`, so
  no credential is introduced. *Accessibility*, *offline-first*, *canonical
  form over preserving content* and *no book without an account* are
  feature-level rules with no surface in a CI runner definition; they are
  enforced by the tests the gate runs, not by this task.

## Acceptance criteria

**Behaviour delivered.**

- A GitHub Actions workflow under `.github/workflows/` triggers on push and on
  pull request and, on a hosted Ubuntu runner, runs `scripts/gate` to
  completion, failing the check when the gate exits non-zero and passing when
  it exits `0`.
- The workflow checks out estante-de-cifras and `ruoso/cifra.md` as siblings,
  so `scripts/gate` (default: both repositories) finds the cifra.md working
  tree at its default `../cifra.md` and validates both — no `scripts/gate`
  argument and no `ESTANTE_CIFRA_MD_DIR` override needed.
- The runner has the toolchain the gate needs, pinned to the repo: Node
  (`.node-version`), Go (`service/go.mod`), Python 3, TaskJuggler (`tj3`),
  git, and Docker with the Compose plugin.
- Playwright's browsers are installed by a step guarded on
  `e2e/web/package.json`: inert on today's tree (no e2e-web harness yet),
  active the moment `foundation.e2e_web` lands — so the gate's e2e-web level
  runs in CI with no later edit to the workflow.
- On the current tree the run is green: `tj3` clean, `scripts/unblocked.py`
  clean, the app/API/service checks run or skip as their manifests dictate,
  the e2e level skips (no harness yet), and the cifra.md checks run against the
  checked-out sibling.

**Tests the task lands with, by level.** Per the `.tji` note — "Tests: none
of its own — the workflow runs scripts/gate green on a push" — this is a
configuration task and lands with **no automated test of its own**:

- **Validation (at landing, recorded in Status).** `scripts/gate` runs green
  locally over both repositories exactly as the workflow invokes it (same
  checkout layout, same default `../cifra.md`); the workflow YAML is
  well-formed (it parses, e.g. `python -c 'import yaml,glob;[yaml.safe_load(open(f)) for f in glob.glob(".github/workflows/*.y*ml")]'`, or an editor/`actionlint` pass by the implementer). This is manual verification; `scripts/gate` adds no YAML check, and a parallel check harness is forbidden.
- **Automated proof (observed on the push, and the downstream task).** The
  first push after the workflow lands shows the Action green — this is the
  acceptance the note names. The Docker-and-browsers e2e path the workflow
  provisions is first *exercised* by `foundation.e2e_api` (the stack comes up
  on a push) and `foundation.e2e_web` (Playwright on a push), which depend on
  this task; the WBS wires those as the executable proof, as `compose`'s proof
  is `e2e_api`.

*Why no unit, behavior, e2e-api or e2e-web tests here.* There is no pure
module, component or endpoint to pin — the deliverable is a runner definition.
The e2e harnesses do not yet exist (they depend on this task), and a parallel
harness is forbidden; the gate's own e2e level, once the harnesses land, is
what proves the CI environment. Adding any test here would either duplicate
the gate (which the note forbids — "and nothing else") or invent a
throwaway harness.

**Deferred work.** None registered. Nothing is deferred to a new WBS leaf:

- Exercising the Docker/Playwright e2e path on a push is owned by the existing
  leaves `foundation.e2e_api` and `foundation.e2e_web`, which `depend !ci` and
  `!e2e_api` respectively — they are the executable proof, not new work this
  task spawns.
- Replaying the workflow locally via `act` (a step appended to
  `VERIFICATION_STEPS` in `orchestrator/driver.py`, `orchestrator/README.md`
  lines 113–115) is an orchestrator convenience, not CI scope, and not a
  blocking follow-up; it is noted for the parking lot, not the WBS.
- Build/publish of a deployable image, and a deploy pipeline, are not in the
  WBS at all (no deployment task exists yet); they are a launch-area concern
  to be planned when deployment is, not a follow-up this task defers.

## Decisions

**GitHub Actions, one workflow calling `scripts/gate`.** *Rationale:*
`orchestrator/README.md` (lines 73–76, 113–115) and the gate's own header name
GitHub Actions calling `scripts/gate` as the intended shape, and the gate is
already the single source of green for both repositories; CI's whole job is to
run it on a neutral machine on every push. *Alternative rejected:* a workflow
that spells out the individual checks (lint, test, build, compose) — it would
duplicate and drift from the gate, which the note explicitly forbids ("and
nothing else"), and lose the gate's skip-when-absent discipline that keeps the
tree green as components land.

**Trigger on push and pull request; run on `ubuntu-latest`.** *Rationale:*
the note's acceptance is "runs scripts/gate green on a push"; adding
`pull_request` makes the same check gate merges, which is the point for every
later task. The standard Ubuntu runner ships Docker and the Compose plugin,
which the gate's e2e level needs, so no custom runner or Docker-setup action is
required. *Alternative rejected:* `push` only — it would not block a red pull
request from merging; a self-hosted or container runner — unnecessary and more
to maintain when the hosted runner already has Docker.

**Both repositories as siblings under the workspace; the gate's default
`../cifra.md` resolves with no override.** *Rationale:* `scripts/gate`
defaults `ESTANTE_CIFRA_MD_DIR` to `../cifra.md` resolved from the repo root
(lines 69–76), and the driver relies on that same default
(`orchestrator/README.md` lines 47–49); checking estante out at
`estante-de-cifras/` and `ruoso/cifra.md` at `cifra.md/` (both under
`$GITHUB_WORKSPACE`, via `actions/checkout` with `path:`) reproduces the exact
layout, so `scripts/gate` with no argument validates both trees with zero
extra configuration. *Alternative rejected:* check out only estante and set
`ESTANTE_CIFRA_MD_DIR` to a non-sibling path — more configuration and a
layout that diverges from the driver's; checking cifra.md **not at all** —
contradicts the note ("both repositories, cifra.md checked out beside") and
would make the gate skip every cifra.md check.

**cifra.md checked out at its default branch (`main`), public repo, default
token.** *Rationale:* the two repositories move together — a `cifra.md:`
task's work lands in cifra.md first and its `complete 100`/Status lands here
in the same logical step — so validating this repository against cifra.md's
current `main` catches integration drift at the moment it would occur; the
repository is public, so the default `GITHUB_TOKEN`'s read access suffices and
no secret is introduced. *Alternative rejected:* pinning a cifra.md SHA — the
pair is meant to be validated as it currently stands, and a pin would silently
rot; a stored PAT — unnecessary for a public repo and a secret to manage.

**Toolchain versions read from the repo, not hardcoded.** *Rationale:*
`actions/setup-node` with `node-version-file: .node-version`,
`actions/setup-go` with `go-version-file: service/go.mod`, and
`actions/setup-python` for Python 3 keep CI's versions equal to the versions
the Dockerfile and the gate already use; a bump to `.node-version` or `go.mod`
moves CI automatically. `tj3` is installed as a Ruby gem (`gem install
taskjuggler`) since the gate runs it and the runner has Ruby. *Alternative
rejected:* pinning versions inline in the workflow — they would drift from
`.node-version`/`go.mod` and the Dockerfile and need manual sync.

**Playwright browsers installed by a step guarded on `e2e/web/package.json`.**
*Rationale:* the gate *checks for* the browser binaries and fails with install
instructions if absent (`e2e_preflight`, lines 211–243) — it does not install
them, so the CI environment must. Guarding the install on the harness's
manifest makes the step inert today (no e2e-web harness) and active the moment
`foundation.e2e_web` lands, honoring the note ("Playwright's browsers
installed so the gate's e2e level runs once the harnesses exist") without a
later edit to the workflow, and without the workflow running any test itself
(installing browsers is provisioning, not verification). *Alternative
rejected:* installing browsers unconditionally now — there is no
`@playwright/test` version to install against until e2e/web exists; letting
the gate install them — it deliberately does not, and editing the gate is out
of scope.

**Enable the setup actions' built-in dependency caches; the gate stays
cache-agnostic.** *Rationale:* `setup-node`/`setup-go` built-in caching of
npm and Go module/build caches cuts run time at no correctness cost; the gate
reads nothing about caching, so this is a pure runner optimization.
*Alternative rejected:* a hand-rolled `actions/cache` over bespoke paths —
more to maintain and easy to get wrong; no caching — needlessly slow.

**No automated test lands with this task.** *Rationale:* a runner definition
has no pure module, component or endpoint to pin; the e2e harnesses that would
exercise the Docker/Playwright path do not yet exist (they depend on this
task), and a parallel harness is forbidden; the note itself says "none of its
own." Acceptance is the workflow running `scripts/gate` green on a push, with
`foundation.e2e_api`/`e2e_web` as the executable proof of the provisioned e2e
path — mirroring how `compose` is proven by `e2e_api`. *Alternative
rejected:* a throwaway YAML-lint or smoke harness here — forbidden as a
parallel harness and redundant with the first green push.

**No design delta.** *Rationale:* DIRECTION §3.6 (lines 386–392) already
states CI runs the app tests, Go tests and end-to-end tests here while the
corpus and cross-implementation comparison run in cifra.md, and
`orchestrator/README.md` already anticipates CI calling `scripts/gate`; this
task implements that description without changing it.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- Created `.github/workflows/gate.yml`: a GitHub Actions workflow triggering on `push` and `pull_request`, running on `ubuntu-latest`.
- Checks out estante-de-cifras at `estante-de-cifras/` and `ruoso/cifra.md` at `cifra.md/` as siblings under `$GITHUB_WORKSPACE`, so `scripts/gate`'s default `ESTANTE_CIFRA_MD_DIR=../cifra.md` resolves with no override — both repositories validated exactly as the driver does.
- Toolchain provisioned from repo files: Node via `actions/setup-node` (`node-version-file: estante-de-cifras/.node-version`), Go via `actions/setup-go` (`go-version-file: estante-de-cifras/service/go.mod`), Python 3 via `actions/setup-python`, TaskJuggler via `gem install --no-document taskjuggler`.
- Playwright browser install guarded on `e2e/web/package.json`: inert on today's tree, activates automatically when `foundation.e2e_web` lands — no later edit to the workflow needed.
- The workflow calls `scripts/gate` and nothing else for verification; no bespoke test, lint, build, or compose steps.
- `scripts/gate` confirmed green: tj3 clean, `unblocked.py` clean, app (438 tests), api (14 tests + go vet/build), service (3 packages), cifra.md (1597 pytest + 1292 JS tests + corpus OK), e2e level skipped (no harness yet).
