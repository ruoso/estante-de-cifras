# foundation.monorepo — Monorepo layout

## TaskJuggler entry

`task monorepo` in [`tasks/25-foundation.tji`](../../25-foundation.tji)
(lines 10–14), under `task foundation`. One line there: *"app/, service/
(cmd/service, cmd/pre-receive), api/, e2e/ (api/ and web/, the end-to-end
harnesses), docs/, compose.yaml. DIRECTION §3.6 Repositories. Tests: none —
directories and ignore rules only; scripts/gate keeps passing over the new
layout."* The area file's header states the stream's purpose: *"The
monorepo, its tooling, the API contract, running everything locally as in
production, CI, and the two end-to-end harnesses every later task's e2e
tests are written in. The harnesses land before anything needs them."*
([`tasks/25-foundation.tji`](../../25-foundation.tji) lines 1–5).

## Effort estimate

**1 day** (from the `.tji`).

## Repository

**estante-de-cifras** (`/home/ruoso/devel/estante-de-cifras`), the root of
the tree. This task creates the top-level directory skeleton that every
later component drops into, matching the tree in DIRECTION §3.6
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 360–379). The
directories reserved by this task:

- `app/` — the PWA (JavaScript, React, a Web Worker owning git). Filled by
  [`foundation.app_tooling`](../../25-foundation.tji) and the tasks after
  it; this task only reserves the slot.
- `service/` — the Go service, with `service/cmd/service` (the one binary)
  and `service/cmd/pre-receive` (the hook) beneath it. Filled by
  `foundation.service_skeleton` and the hook stream.
- `api/` — the HTTP contract both sides are tested against. Filled by
  `foundation.api_contract`.
- `e2e/` — the two black-box harnesses, `e2e/api/` and `e2e/web/`. Filled by
  `foundation.e2e_api` and `foundation.e2e_web`.
- `docs/` — **already exists** (the direction, the fourteen workflows, the
  mockups and the visual language, from the `bootstrap` stream); named in
  the tree for completeness, untouched by this task.

`compose.yaml` is named in both the `.tji` note and DIRECTION's tree, but it
is **not** created here: it is the deliverable of `foundation.compose`, and
creating an empty or partial `compose.yaml` now would pre-empt that task and
change which branch the gate takes (§Decisions). This task reserves its
place in the layout, nothing more.

No design delta is authored. The layout is specified to the directory in
DIRECTION §3.6; this task implements that specification without amending it.

## Inherited dependencies

- **`bootstrap.architecture` — settled.** Complete (`complete 100`,
  [`tasks/00-bootstrap.tji`](../../00-bootstrap.tji) lines 26–32): it is what
  decided *"Go service and hook, React + React Aria app, a Web Worker owning
  git, cifra.md implemented per language and held to the corpus"* and wrote
  it into [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.3–3.7. The
  components table (§3.6 lines 264–273) and the repository tree (§3.6 lines
  360–379) this task realises are its output. The `foundation` parent
  depends on it ([`tasks/25-foundation.tji`](../../25-foundation.tji) line
  8); no refinement document exists for it (it predates this directory), so
  this refinement cites DIRECTION directly.
- **`bootstrap.direction` — settled** (not a declared dependency, but the
  source of the tree). Complete (`complete 100`,
  [`tasks/00-bootstrap.tji`](../../00-bootstrap.tji) lines 6–11):
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) itself.

`monorepo` is the root of the `foundation` stream: `app_tooling`,
`service_skeleton`, `api_contract` and `compose` each carry `depends
!monorepo` ([`tasks/25-foundation.tji`](../../25-foundation.tji) lines 18,
30, 36, 42), and the rest of the stream chains onward from them. Nothing in
the stream precedes this task.

## What this task is

This task lays out the monorepo: it creates the top-level directories named
in DIRECTION §3.6 — `app/`, `service/` (with `cmd/service` and
`cmd/pre-receive`), `api/`, `e2e/` (with `api/` and `web/`) — each with a
tracked placeholder `README.md` naming what lands there and the task that
fills it, and it reviews and extends the root `.gitignore` so it covers the
whole tree. It writes no code, no package manifest, no Go module, no API
contract, and no `compose.yaml`: those are the deliverables of the tasks that
depend on `!monorepo`. The one observable outcome is a committed directory
skeleton over which `scripts/gate` stays green, every build-and-test check
skipping on the "does not exist yet" branch it already carries.

## Why it needs to be done

Every later `foundation` task fills exactly one of these slots —
`app_tooling` → `app/`, `service_skeleton` → `service/`, `api_contract` →
`api/`, `compose` → `compose.yaml`, `e2e_api` → `e2e/api/`, `e2e_web` →
`e2e/web/` — and all of them declare `depends !monorepo`. Establishing the
layout once, matching DIRECTION's tree exactly, means each subsequent task
drops into a known, documented place, and the physical separation of `app/`
from `service/` is the first enforcement of the standing boundary that *"the
app and the service share no code"* (DIRECTION §3.6 line 275): there is no
shared top-level directory for them to reach into. The gate
([`scripts/gate`](../../../scripts/gate)) is already written to expect this
layout — it checks for each component's manifest and skips cleanly when it is
absent — so landing the skeleton makes the project's single source of
"is the tree green?" meaningful across the shape the whole WBS targets.

## Inputs / context

- **DIRECTION §3.6 Repositories** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 360–379: the
  canonical tree (`app/`, `service/cmd/service`, `service/cmd/pre-receive`,
  `api/`, `docs/`, `compose.yaml`) and the rule that *"Locally, everything
  runs as in production"* (lines 373–379). The directory names this task
  creates come from here verbatim.
- **DIRECTION §3.6 components table** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 264–273: which
  component lives in which directory and what each is written in; and line
  275, *"The app and the service share no code, only the HTTP API and the
  format."*
- **The `.tji` note and the `e2e/` split** —
  [`tasks/25-foundation.tji`](../../25-foundation.tji) lines 10–14 (this
  task) and lines 51–62 (`e2e_api` → `e2e/api/`, `e2e_web` → `e2e/web/`): the
  note names `e2e/ (api/ and web/)`, which the tree in DIRECTION abbreviates;
  the two sub-directories are explicit in the harness tasks.
- **The current `.gitignore`** —
  [`.gitignore`](../../../.gitignore): already carries `node_modules/`,
  `dist/`, `coverage/`, `.vite/`, `test-results/`, `playwright-report/` and
  `blob-report/` (the JavaScript and Playwright artefacts), plus the agent
  orchestrator's worktrees and run state. This task reviews it against the
  new layout.
- **`scripts/gate`** — [`scripts/gate`](../../../scripts/gate): the per-
  component existence checks and their skip messages — `app/package.json`
  ("estante app: app/package.json does not exist yet"), `service/go.mod`
  ("estante service: service/go.mod does not exist yet"),
  `e2e/api/package.json` and `e2e/web/package.json` and `compose.yaml`
  ("estante e2e: compose.yaml and the e2e harnesses do not exist yet"). The
  acceptance check leans on these exact branches.
- **The root `README.md`** — [`README.md`](../../../README.md) lines 14–19:
  the project's "Design. Nothing is built yet." status; the layout the
  directory READMEs describe is consistent with it.
- **Style precedent** — [`cifra_js/package.md`](../cifra_js/package.md), the
  nearest scaffold-task refinement (greenfield directory creation with no
  behaviour to pin beyond the gate).

## Constraints / requirements

- **The directory names match DIRECTION §3.6 exactly.** `app/`, `service/`
  with `service/cmd/service` and `service/cmd/pre-receive` beneath it,
  `api/`, and `e2e/` with `e2e/api/` and `e2e/web/`. No alternate spelling,
  no extra top-level directory, no shared `lib/`/`common/` between `app/`
  and `service/` (DIRECTION §3.6 line 275).
- **No manifests, no code, no `compose.yaml`.** This task creates no
  `app/package.json`, no `service/go.mod`, no `api/` contract document, no
  `e2e/*/package.json` and no `compose.yaml`. Each of those is the
  deliverable of a task that depends on `!monorepo`; creating any of them
  here would duplicate that task and, for `compose.yaml`, change the gate's
  branch (§Decisions).
- **git must track every reserved directory.** git does not track an empty
  directory, so each reserved directory carries a tracked placeholder —
  a short `README.md` naming what lands there and the owning task (not an
  opaque `.gitkeep`; §Decisions). The owning task replaces or augments its
  directory's README when it fills the slot.
- **The gate stays green over the new layout.** After the skeleton lands,
  [`scripts/gate`](../../../scripts/gate) run over estante-de-cifras must
  pass with `tj3` silent and `scripts/unblocked.py` clean, and every
  build-and-test check skipping on its existing "does not exist yet" branch
  — the layout must not trip any check into running against an empty
  directory or into a FAIL.
- **`.gitignore` covers the whole tree, minimally.** Extended only for
  artefact kinds a newly-reserved directory actually introduces; the gate
  builds Go binaries to a temporary directory and never into the tree
  (`go_checks` in [`scripts/gate`](../../../scripts/gate)), so no speculative
  Go ignores are added beyond what a local build or editor would otherwise
  leave (§Decisions).
- **Standing rules — which apply.** The component boundary of DIRECTION §3.6
  (app and service share no code) is enforced structurally by this layout,
  as above. The remaining standing rules — canonical form over preserving
  content, accessibility, no song text in logs, offline first, no book
  without an account — govern behaviour this task delivers none of; they
  bind the tasks that fill these directories, not the skeleton. No song text,
  no fixtures, and no network are involved.

## Acceptance criteria

**Behaviour delivered.** The monorepo has the top-level layout of DIRECTION
§3.6, committed in estante-de-cifras. Concretely:

- `app/`, `service/`, `service/cmd/service`, `service/cmd/pre-receive`,
  `api/`, `e2e/`, `e2e/api/` and `e2e/web/` exist and are tracked by git,
  each through a placeholder `README.md` that names what the directory is for
  and the task (`foundation.app_tooling`, `foundation.service_skeleton`, the
  hook stream, `foundation.api_contract`, `foundation.e2e_api`,
  `foundation.e2e_web`) that fills it.
- `docs/` is unchanged; no `compose.yaml`, package manifest, Go module or
  contract document is created.
- `.gitignore` covers the tree as laid out and carries no rule that would
  ignore one of the new placeholder READMEs.

**Tests the task lands with, by level.** **None** — and this is the `.tji`
note's own `Tests: none`, justified rather than dropped (§Decisions). The
task delivers directories and ignore rules, which carry no behaviour,
component, endpoint or screen to pin; there is no unit, behavior, e2e-api or
e2e-web level that applies. The structural acceptance check that stands in
for a test is one the gate already performs:

- **gate (`scripts/gate estante`)** — run over the new layout it is green:
  `tj3 --silent --no-reports project.tjp` reports no error or warning,
  `scripts/unblocked.py` passes, and each component check SKIPs on its
  existing message — *"estante app: app/package.json does not exist yet"*,
  *"estante service: service/go.mod does not exist yet"*, and *"estante e2e:
  compose.yaml and the e2e harnesses do not exist yet"* (because no
  `compose.yaml` and no `e2e/*/package.json` were created). The closer reads
  this gate output as the task's acceptance; there are no named test files
  because none exist to name.

**Deferred work.** None registered. Every directory this task reserves is
filled by a task that already exists in the WBS and already depends on
`!monorepo` (`app_tooling`, `service_skeleton`, `api_contract`, `compose`,
`e2e_api`, `e2e_web`, and the hook stream); this task defers nothing of its
own.

## Decisions

- **The layout is directories and ignore rules only — no manifests, no
  `compose.yaml`, no code.** *Rationale:* each slot's content is the
  deliverable of a dedicated task that declares `depends !monorepo`, and
  [`scripts/gate`](../../../scripts/gate) is written to skip each component
  cleanly until its manifest exists; the clean, documented empty layout is
  exactly what the gate expects. *Alternative rejected:* scaffolding minimal
  `package.json`/`go.mod`/`compose.yaml` here to "light up" the gate — it
  would duplicate and pre-empt `app_tooling`, `service_skeleton` and
  `compose`, and a stub `compose.yaml` with no e2e harness would push the
  gate onto the *"compose.yaml exists but no e2e harness yet"* branch, making
  the layout task silently own part of `compose`'s surface. Reserving the
  slot and letting the owning task create its manifest keeps each task's
  scope intact.
- **Placeholders are a per-directory `README.md`, not `.gitkeep`.**
  *Rationale:* git needs a tracked file to keep an otherwise-empty directory,
  and a short README documents the directory's purpose and owning task
  exactly where a reader looks, mirroring DIRECTION §3.6's tree; the owning
  task replaces or extends it when it fills the slot. *Alternative rejected:*
  an empty `.gitkeep` — it keeps the directory but carries no information and
  would have to be removed or left as litter once the directory fills.
- **`.gitignore` is extended minimally, against the actual layout.**
  *Rationale:* the gate builds every artefact to a temporary directory and
  runs tests with `CI=true`, so the tree stays clean under the gate; ignore
  rules exist for what a developer's local build or editor leaves, and the
  existing JavaScript/Playwright rules already cover `app/` and `e2e/`.
  *Alternative rejected:* a large speculative ignore set covering every
  toolchain up front — noise that drifts from what the tree actually
  produces; rules are added as a directory's toolchain lands if the gate's
  clean-tree guarantee ever leaves something behind.
- **`Tests: none` is correct and stands; the gate is the regression guard.**
  *Rationale:* the task delivers no behaviour to pin, and the project's test
  levels (unit/behavior/e2e-api/e2e-web) all pin behaviour, a component, an
  endpoint or a screen — none of which this task produces; the standing rule
  that a feature lands with its tests is satisfied vacuously because there is
  no feature, only structure. The gate running green over the layout is the
  check that the structure is consistent. *Alternative rejected:* a shell or
  Vitest test asserting the directories exist — it would test the filesystem
  and the gate's own skip logic rather than any product behaviour, and would
  duplicate what `scripts/gate` already proves on every run.
- **No design delta.** *Rationale:* DIRECTION §3.6 specifies the tree to the
  directory and the component boundary this task realises; implementing it
  changes no designed behaviour and introduces no new seam, so there is
  nothing to amend in DIRECTION or a workflow.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `app/README.md`, `service/README.md`, `service/cmd/service/README.md`, `service/cmd/pre-receive/README.md`, `api/README.md`, `e2e/README.md`, `e2e/api/README.md`, `e2e/web/README.md` — placeholder READMEs for all reserved directories, each naming the owning task and what fills the slot.
- Root `.gitignore` reviewed; the existing JavaScript/Playwright rules already cover `app/` and `e2e/`; no Go-binary rules were added (gate builds to a temp directory).
- `scripts/gate` confirmed green over the new layout with all three expected SKIP messages: `estante app: app/package.json does not exist yet`, `estante e2e: compose.yaml and the e2e harnesses do not exist yet`, `estante service: service/go.mod does not exist yet`.
- No manifests, no code, no `compose.yaml` created — each is the deliverable of its dedicated task.
