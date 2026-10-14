# orchestrator/

Python driver that loops a planning agent session ("the orchestrator") with
a sequence of working agent sessions ("sub-agents") until the milestones in
`tasks/99-milestones.tji` are closed. Ported from arbitrarycomposer's
orchestrator; the loop, the adapters and the resumability are the same, and
the verification is this project's `scripts/gate`.

Each iteration is at least two agent CLI invocations, plus — after every
`implementer` dispatch — a deterministic verification + fixer + closer tail
that the driver owns:

1. **Orchestrator turn** — system prompt at `prompts/orchestrator_system.md`,
   plus the carried-over `context_summary` and the previous sub-agent's
   output. Final assistant message must be a JSON envelope:
   `{"next": {"template": "refinement_writer"|"implementer", "vars": {...}}, "context_summary": "..."}`
   or `{"stop": "<reason>"}`.
2. **Sub-agent turn** — `prompts/<template>.md` rendered with `vars`, run as
   a fresh top-level agent session. Exception: a `refinement_writer`
   dispatch whose `refinement_path` already exists (non-empty) on disk is
   skipped by the driver — the orchestrator gets a `(driver notice)` return
   telling it to dispatch the implementer next, and no sub-agent runs.
3. **(implementer only) deterministic tail** — the driver runs
   `scripts/gate` (output tee'd to `logs/iter-NNNN-verify-gate.log`). On
   failure it dispatches the `fixer` sub-agent against the failing log and
   loops (cap: `MAX_FIXER_ATTEMPTS`). Once green, the driver dispatches the
   `closer` sub-agent with the pass-block as `$test_results` and the state
   of the working tree as `$repositories`. The closer's return is what
   feeds back into the next orchestrator turn; if the working tree still
   holds uncommitted changes after it, the driver appends a
   `(driver notice)` saying so.

All invocations stream JSON so the driver prints live event summaries as
they arrive. Full event streams are tee'd to `logs/iter-NNNN-<phase>.log`.

## One repository, with the format as a subtree

The WBS here plans all the work, in this one repository:

- the app (`app/`), the service and hook (`service/`), the API contract
  (`api/`), the design documents (`docs/`), and the WBS (`project.tjp`,
  `tasks/`);
- **cifra.md**, the format, as the `cifra.md/` git subtree: its
  specification (`cifra.md/spec/`), its Python reference
  (`cifra.md/reference/`), the corpus (`cifra.md/corpus/`), and the
  JavaScript (`cifra.md/js/`) and Go (`cifra.md/go/`) implementations.
  Tasks whose `.tji` note starts with `cifra.md:` are implemented there.

This repository is the source of truth for cifra.md; the human publishes
the subtree back to github.com/ruoso/cifra.md with
`git subtree push --prefix=cifra.md`. Agents never run `git subtree push`
or `split`, and never push there. End to end:

- **Access.** Agents run with this repository as their working directory,
  so `cifra.md/` is simply part of it; the driver also fills the subtree's
  absolute path into every template as `$cifra_md_dir`.
- **Refinements** for cifra.md tasks live here, like every other
  (`tasks/refinements/<area>/<task>.md`), and say whether the work lands
  under `cifra.md/`.
- **Verification.** `scripts/gate` checks the whole tree on every run,
  `cifra.md/` included, so whatever a task touched is covered.
- **Commits.** The closer makes one commit per task: the work (under
  `cifra.md/` or not) together with the completion — the refinement's
  Status block, `complete 100`, milestone propagation, tech debt, the
  parking lot. The driver checks the working tree afterwards.
- **Worktrees.** Each worktree has its own copy of `cifra.md/`, committed
  like any other change. The orchestrator still treats all cifra.md work
  (`format`, `cifra_js`, `cifra_go`) as one workstream across worktrees,
  since it all leans on the same spec and corpus.

## scripts/gate

The single source of truth for "is the tree green?", run by the driver,
by people before committing, and — once `foundation.ci` lands — by CI,
which should call it rather than repeat its steps. It runs what exists and
skips, saying so, what does not yet:

- estante-de-cifras: `tj3 --no-reports` on `project.tjp` (any error or
  warning fails), `scripts/unblocked.py`; `app/` (npm install if needed,
  then `lint`, `test`, `build` scripts) when `app/package.json` exists;
  `service/` (`go vet`, `go test`, `go build`) when `service/go.mod` exists.
- the end-to-end step, once `compose.yaml` and an e2e harness
  (`e2e/api/package.json`, `e2e/web/package.json`) exist: a preflight
  (Docker with the compose plugin and a reachable daemon; Playwright's
  browsers), then the compose stack brought up **once** — built from the
  working tree, under an isolated project name, on free ports, waiting for
  every healthcheck — before the service's Go tests (whose behavior level
  uses its Postgres, `ESTANTE_TEST_DATABASE_URL`); then e2e-api (`npm test`
  in `e2e/api/`, `--maxWorkers=N`) and e2e-web (`playwright test
  --workers=N` in `e2e/web/`, phone, tablet and computer, axe). The stack
  is always torn down (a trap), with its volumes and built images. Until a
  harness exists the step is skipped, saying so; once one exists it must
  run — no Docker or no browsers is a FAIL with what to install.
  `ESTANTE_E2E_WORKERS` sets N (default: `nproc`, at most 4).
- cifra.md: the reference's `pytest` and `python -m tools.corpus --check`
  (creating `reference/.venv` if missing); `js/` and `go/` likewise when
  they exist.

`scripts/gate estante` or `scripts/gate cifra.md` checks one part of the
tree, for a narrow check by hand; the driver always runs both. Parallelism is
always bounded (`go … -p $(nproc)`, explicit e2e worker counts).

Tests land with their task — the WBS has no test stream. The refinement
names each task's tests by level (unit, behavior, e2e-api, e2e-web; the
corpus for format work; none for design), the implementer writes them, the
fixer may not delete or weaken them, and the closer checks in the gate's
log that they exist and ran (not skipped) before committing — otherwise it
returns `REFUSED (missing tests)` and leaves the work in the tree, and the
orchestrator re-dispatches the implementer for the same task
(`tasks/refinements/README.md`, "Tests: the levels, and the rule").

When CI exists, a step replaying it locally (as arbitrarycomposer does with
`act`) can be appended to `VERIFICATION_STEPS` in `driver.py`; until then
the gate is the whole chain.

## Persistent state

The orchestrator's `context_summary` field is persisted to
`state/context_summary.md` after every orchestrator turn and re-loaded on
the next driver startup, so the loop is resumable across runs (Ctrl-C,
crashes, manual stops). The contents of `state/` and `logs/` are gitignored.

If the verification chain exhausts `MAX_FIXER_ATTEMPTS`, the driver appends
a `## Verification chain exhausted at iter <N>` block to
`state/context_summary.md` and exits non-zero. The next driver run picks
that context back up and the orchestrator sees the failure block on its
first turn — its prompt directs it to `stop` with a `corrupted: ...` reason
so the human user can intervene.

## Running

```
cd orchestrator
python3 driver.py
```

(The driver resolves every path from its own location, so the working
directory does not matter; agents and the gate always run from the
repository root.)

The default CLI is Claude Code. Use Codex CLI with:

```
AGENT_CLI=codex python3 driver.py
```

### Replaying a step

`--resume <log>` re-runs the step recorded in an `iter-NNNN-<phase>.log`,
**continuing that agent session** (the CLI is invoked with `--resume` /
`exec resume`) so partial work is preserved, then rejoins the normal loop at
the next iteration. The prior log is kept as `.attempt-N`.

```
python3 driver.py --resume logs/iter-0031-implementer.log
python3 driver.py --resume logs/iter-0031-implementer.log --note "you were mid-refactor"
```

`--fresh` replays the same step in a **brand-new session** instead — the step,
its model and its prompt are still recovered from the log and the dispatch
manifest, so the same work is re-dispatched, but with no memory of the recorded
attempt:

```
python3 driver.py --resume logs/iter-0031-implementer.log --fresh
python3 driver.py --resume logs/iter-0031-implementer.log --fresh --note "the previous attempt tried X; don't"
```

Use `--fresh` when the session is the *problem* rather than the victim — it
wedged, thrashed, or talked itself into a bad approach, and resuming would only
carry the mistake forward. Use a plain `--resume` when the session was merely
interrupted and its partial work is worth keeping.

Note what a fresh replay does *not* discard: only the agent's conversation is
thrown away. The recorded prompt is a snapshot of the rendered **template**, and
every substantive input it points at — the refinement, the design documents,
the WBS, both working trees — is re-read from disk by the sub-agent. So a fresh
replay picks those up at their *current* state, which is what makes it the
right tool after you have edited a refinement or the task graph underneath a
failing run.

Everything downstream is unchanged, so a fresh replay is a drop-in for a
session-resuming one: same log path and archival, same model resolution, and an
`implementer` replay still runs the post-implementer verify → fixer → closer
chain.

**`--resume` does not re-read `state/context_summary.md`.** The replayed prompt
comes from the log's `---PROMPT---` block, and for an *orchestrator* step the
context summary is inlined into that text rather than pointed at — so a resumed
orchestrator turn re-runs against the summary it originally saw, edits to the
file notwithstanding. To hand the orchestrator a new summary, edit the file and
start a plain run (see `--archive`).

### Starting a fresh run

A plain `python3 driver.py` restarts iteration numbering at 0, which overwrites
`iter-0000-*` onwards in place. `--archive` moves the previous run's logs and
dispatch manifests into a dated directory under `logs/` first:

```
python3 driver.py --archive
```

`state/context_summary.md` is *copied* into the archive but left where it is —
it is the state the new run carries forward. Edit it before starting if you want
the fresh run to begin from different context. `--archive` cannot be combined
with `--resume` (archiving would move the log being replayed).

No dependencies beyond the Python standard library, plus what the gate needs:
`git`, `tj3`, and — as the parts exist — Node (the version in
`.node-version`) with npm, Go, and the cifra.md reference's Python virtual
environment. Stop with Ctrl-C; in-flight sub-agent processes get SIGTERM'd
cleanly. Prompt files are loaded immediately before each dispatch, so edits
under `prompts/` take effect on the next agent turn without restarting the
driver.

Before every orchestrator turn, the driver also injects persisted
`orchestrator/state/context_summary.md` snapshots from all registered git
worktrees, and the `cifra.md/` subtree path this worktree uses. The orchestrator
uses those snapshots to avoid assigning sibling worktrees overlapping tasks
or workstreams.

## Models

Per-template model selection lives in the selected `AgentCli` adapter;
override via env vars (`ORCH_MODEL`, `SUB_MODEL`, `CLOSER_MODEL`) when you
want to experiment.

## Prompts layout

- `prompts/orchestrator_system.md` — orchestrator system prompt (mission,
  the `cifra.md/` subtree, read-only rule, pick heuristics, tests landing with
  their task, JSON envelope contract). Not rendered: it has no variables.
- `prompts/refinement_writer.md` — refinement-writer sub-agent brief.
  Vars: `$task_id`, `$refinement_path`.
- `prompts/implementer.md` — implementer sub-agent brief.
  Vars: `$refinement_path` (plus `$task_id` for log labelling).
- `prompts/closer.md` — closer sub-agent brief (driver-internal).
  Vars: `$task_id`, `$refinement_path`, `$implementer_summary`,
  `$test_results`, `$repositories`.
- `prompts/fixer.md` — fixer sub-agent brief (driver-internal). Vars:
  `$task_id`, `$refinement_path`, `$implementer_summary`, `$failing_step`,
  `$failing_command`, `$failing_log`, `$prior_attempts`, `$repositories`.

Every rendered template also gets `$additional_context` (from the
orchestrator, default `(none)`) and `$cifra_md_dir` (from the driver).

Vars are substituted via `string.Template.safe_substitute`, so `$var` is
the substitution syntax — escape literal dollar signs as `$$` (e.g. the
`$$(cat <<'EOF' ...)` HEREDOC in `closer.md`, or `-j $$(nproc)`).

Cross-cutting policies (the design documents as constitution, the corpus as
what implementations agree on, the project's standing rules — canonical
form, accessibility, no song text in logs, offline first, no book without
an account — the test levels and tests landing with their task, tech-debt
registration, test-output handling, the `cifra.md/` subtree, and "what
sub-agents must NOT do") are embedded into each
template that needs them, since sub-agents are fresh sessions with no shared
state.

## Permissions

For Claude, the driver passes no permission flags to `claude -p`. Whatever `~/.claude/settings.json`
provides as the default is what the sub-agents get. If headless runs block
on tool prompts, add e.g. `--permission-mode acceptEdits` in
`ClaudeCli.command()`.

For Codex, the adapter runs `codex -a never exec` with
`sandbox_mode="workspace-write"` and network access; the working directory
(the repository root, `cifra.md/` included) is the writable workspace.
