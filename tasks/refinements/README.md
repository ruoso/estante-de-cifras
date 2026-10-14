# Task refinements

This directory holds per-task refinement documents. Each refinement expands
the one-line description in [`project.tjp`](../../project.tjp) (and its
included `tasks/*.tji` files) into the constraints, prior decisions, and
open questions that bound the task's scope. A refinement is the source of
truth for "what does this task mean?" — read it before doing the work.

## Layout

Refinements are organized by work stream, mirroring the `tasks/*.tji` file
split. The directory name is the first dot-segment of the fully-qualified
task id; the filename is `<task_name>.md` matching the `task <task_name>`
identifier in the `.tji` file:

```
tasks/refinements/<area>/<task_name>.md
```

So `cifra_js.package` is `tasks/refinements/cifra_js/package.md`.

Areas, matching `tasks/05-…80-*.tji`: `format`, `cifra_js`, `cifra_go`,
`design`, `foundation`, `service`, `hook`, `storage`, `sync`, `shell`,
`music`, `songs`, `books`, `account`, `launch`. (`bootstrap` is
complete and has none.)

### The format lives in `cifra.md/`

A task whose `.tji` note starts with `cifra.md:` is implemented under
`cifra.md/` — the format's specification, Python reference, corpus, and the
JavaScript (`cifra.md/js/`) and Go (`cifra.md/go/`) implementations. It is a
git subtree, published to [github.com/ruoso/cifra.md](https://github.com/ruoso/cifra.md)
by the human with `git subtree push --prefix=cifra.md`; agents never push or
split it. Its refinement lives here beside every other, and the task lands in
one commit like any other. (Refinements written before 2026-10-14 speak of a
sibling cifra.md repository and cifra.md commit SHAs; those are history.)

### Design tasks

Tasks in the `design` area produce **documents, not code**: a workflow
document in [`docs/workflows/`](../../docs/workflows/), decided to its
screens and edge cases in the shape of the existing fourteen, and a board
in [`docs/mockups/`](../../docs/mockups/) drawing it on two phones, a tablet
and a computer (`docs/mockups/GUIDE.md`), registered in `canvas.json`.
DIRECTION §6 and §7 are updated for the gap the task closes. Their
acceptance criteria are what the document must decide, not tests.

## Refinement document shape

Each refinement covers, in roughly this order:

1. **TaskJuggler entry** — back-link to the `.tji` task definition.
2. **Effort estimate**, **where** the work lands (under `cifra.md/`,
   elsewhere, or both, with the directories), and
   **Inherited dependencies** (settled or pending).
3. **What this task is** — one paragraph of plain-language scope.
4. **Why it needs to be done** — the dependency chain and downstream
   consumers.
5. **Inputs / context** — the governing documents (the `.tji` `note` names
   them: DIRECTION sections, workflows, mockup boards, cifra.md spec
   chapters), real file paths with line numbers, and the predecessor
   refinements' decisions. No invented references.
6. **Constraints / requirements** — what the implementation must satisfy,
   including the component boundaries of DIRECTION §3.6–3.7 (the app and the
   service share no code; the view is the only layer that knows React; the
   Worker owns the data) and the project's standing rules: canonical form
   over preserving content, accessibility, no song text in logs, offline
   first, no book without an account.
7. **Acceptance criteria** — the concrete check that says "done": the
   behavior delivered, and **the tests the task lands with, by level**
   (below), each named — its file where possible — with what it pins: the
   workflow section, DIRECTION section, spec section or corpus entry. For a
   design task, what the workflow document must decide and the board must
   show.
8. **Decisions** — pre-settled choices with rationale against alternatives.
9. **Open questions** — what remains unresolved, or `(none — all decided)`.
10. **Status** — appended on completion (see ritual below); until then a
    `## Status` heading with `_pending implementation_`.

## Tests: the levels, and the rule

**The WBS does not split tests out of the tasks.** Each task lands with the
appropriate level of test for what it delivers, at the time it lands. Its
`.tji` note ends with them — `Tests: unit (…); behavior (…); e2e-api (…);
e2e-web (…).`, the levels that apply — and its refinement's acceptance
criteria name them.

- **unit** — pure modules and functions: Vitest (app, cifra.md js), `go
  test` (service, hook, cifra.md go), pytest (cifra.md reference).
- **behavior** — a component working with its real collaborators inside one
  process: React components with Testing Library plus an axe check of what
  they render; the Web Worker's storage and sync logic against a fake
  IndexedDB and a local git remote; Go handlers through `httptest` against a
  real Postgres (from compose) and real git.
- **e2e-api** — black-box against the compose stack (the service's image
  with git, the hook, Postgres, the mail catcher): HTTP calls and real git
  clients (the git CLI and isomorphic-git) doing what a user's device would.
  The harness is `e2e/api/` (`foundation.e2e_api`).
- **e2e-web** — Playwright against the compose stack (the app served by the
  service on its one origin), on phone, tablet and computer viewports, with
  axe at WCAG 2.1 AA on every screen the task touches, and offline where the
  task is about offline. The harness is `e2e/web/` (`foundation.e2e_web`).
- **Format work** (cifra.md: reference, js, go) — unit plus the corpus (the
  canonical and merge corpora are its behavior/conformance level).
- **Design tasks** (workflow documents, mockup boards) — no code tests;
  acceptance is the document and the board.

Proportionate: a pure module gets unit tests; a screen gets behavior tests
plus an e2e-web journey with axe; an endpoint gets behavior tests plus
e2e-api.

The rule, for every role in the loop:

- The implementer writes the named tests **in the same task**. A feature
  without its tests is not done. Tests are never deferred to a later task,
  and tech debt may never be "add tests for X".
- `scripts/gate` runs every level (the e2e levels against the compose stack
  it brings up once and tears down); a harness that exists must run.
- Nobody deletes, skips or weakens a test to get green.
- The closer checks that the refinement's named tests exist and ran — not
  skipped — in the gate's output before committing, and refuses otherwise.
- A missing test is a defect of the task that should have had it, never a
  new test-only task.

## Task-completion ritual

When a task ships, these happen in the **same commit** as the work itself
(for a `cifra.md:` task too):

0. **The named tests exist and ran.** Every test the acceptance criteria
   name is in the change and ran, not skipped, in the gate's output (see
   above). Otherwise the task is not done: nothing is committed.
1. **Refinement `## Status` block.** Append a `## Status` section at the
   bottom of the refinement noting **Done** with the date and brief
   pointers to the produced artifacts (files, tests, corpus entries,
   document deltas, and the cifra.md commit when there is one). Don't edit
   the prior sections — Decisions and Acceptance criteria are the
   historical record of why the task existed; the Status section is the
   historical record of how it landed.
2. **`complete 100` in the `.tji` — and the note back-link.** Add
   `complete 100` immediately after the `allocate team` line of the
   matching task block in the relevant `tasks/*.tji` file, and make sure
   the task's `note` ends with
   `Refinement: tasks/refinements/<area>/<task_name>.md` (appended after
   the existing text; refinements written ahead of implementation add the
   pointer when they land). After editing, run
   `tj3 --silent --no-reports project.tjp 2>&1 | grep -iE "error|warning"`
   and confirm silence — there is no pre-commit hook; this check (also part
   of `scripts/gate`) is the WBS gate. The `complete 100` marker is what
   tj3's scheduler (and `scripts/unblocked.py`) reads — refinement Status
   alone is for human readers.
3. **Milestone propagation.** If the task is the last one a milestone
   depends on, also add `complete 100` to the milestone in
   `tasks/99-milestones.tji`. Milestones don't infer completion from their
   dependencies — they need the explicit marker too.
4. **Tech-debt registration.** Any follow-up work the refinement or
   implementation deferred becomes a real WBS leaf (effort, `allocate
   team`, `depends`, a `note` citing the source refinement — starting with
   `cifra.md:` when the work lands there, and ending with the `Tests:` it
   will land with), wired into a milestone's
   `depends` — an unwired task is an orphan, flagged by
   `scripts/unblocked.py`'s ORPHANS audit. Human-judgment items go to
   [`tasks/parking-lot.md`](../parking-lot.md) instead, never into the WBS.
   Tests are never tech debt: there is no "add tests for X" leaf.

Before any commit, `scripts/gate` is green: it checks both repositories
(see [`orchestrator/README.md`](../../orchestrator/README.md)).

## Why refinements exist alongside the design documents

The two layers serve different purposes:

- **The design documents** — [`docs/DIRECTION.md`](../../docs/DIRECTION.md),
  the workflows in [`docs/workflows/`](../../docs/workflows/) and the
  visual language in [`docs/mockups/`](../../docs/mockups/), and for the
  format the cifra.md specification and its corpus — are the
  **constitution**: what the app is and does, decided and amended
  explicitly. A change that alters designed behavior updates the governing
  document in the same commit; a change to the format moves the spec, the
  reference and the corpus together.
- **Refinements** capture **task scope** — the constraints, prior
  decisions, and open questions that bound a single piece of work. They
  cite the design as Inputs but they aren't decision records themselves;
  they're work-shaping documents that get a `## Status` block on
  completion.

A refinement may surface a gap that becomes a design delta; the amended
document then constrains future refinements that depend on it. The two
layers stay separate so each can be read for what it is.
