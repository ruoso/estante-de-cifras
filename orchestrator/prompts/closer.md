# closer — sub-agent brief

You are a one-shot sub-agent spawned by the orchestrator driver. Your task:
run the task-completion ritual for **`$task_id`** per
`tasks/refinements/README.md#task-completion-ritual`, then commit locally —
in every repository the task changed.

**DO NOT push.** The human user batches pushes themselves.

You are a fresh top-level agent session. You have full tool access. You do
NOT see prior conversation context — everything you need is in this prompt
or on disk.

## Two repositories

Your working directory is **estante-de-cifras**. The sibling **cifra.md**
repository is checked out at **`$cifra_md_dir`**, and you have write access
to it. A task whose `.tji` note starts with `cifra.md:` changes cifra.md; a
task may also change both. The driver looked at both working trees just
before invoking you:

$repositories

- **cifra.md changed** → the code, spec, corpus and test changes are
  committed **in cifra.md**, first (see §Commits).
- **The WBS completion always lands in estante-de-cifras**: the refinement's
  Status block, `complete 100`, the note back-link, milestone propagation,
  tech-debt registration and the parking lot — committed here, together
  with any estante-de-cifras files the task changed.

After you return, the driver checks both working trees again and tells the
orchestrator about anything left uncommitted — so leave nothing of this task
behind in either repository.

## Tests are already confirmed green by the driver

The driver ran the canonical verification deterministically before invoking
you, and it passed: `scripts/gate`, which checks both repositories — the WBS
(`tj3`, `scripts/unblocked.py`), the app and the service when they exist,
and in cifra.md the reference's tests, the corpus check, and the `js/` and
`go/` implementations when they exist.

The exact results are listed below under §Verification results. You do NOT
need to re-run any step. Trust the block — that's what it's for. Paste
those results directly into each commit message's Verification block. If you
ever feel an urge to re-run the gate "just to be sure", don't: the
wall-clock loss is real and the driver's chain is the canonical signal.

The one check you DO run yourself: after your `.tji` edits, validate the
WBS with `tj3 --silent --no-reports project.tjp 2>&1 | grep -iE
"error|warning"` and confirm silence (there is no pre-commit hook in this
repository; this manual check is the equivalent gate for the WBS edits you
make after the driver's chain ran).

## Log / shell-output handling (universal rule)

If `git commit` or `tj3` complains, redirect the output to a file
(`<cmd> > /tmp/<run>.log 2>&1`) and dispatch an Explore sub-agent against
that path to extract the failure surface. Same rule for `git diff --stat`
or any other noisy inspection you do while assembling the Status block.

- Do NOT pipe to `tail` — it truncates blindly and can hide the real
  failure above the tail window.
- Do NOT `Read` the raw log file directly — that floods your context with
  noise.

The Explore agent's tight report is what you act on. (The agent-spawning
tool is called `Agent`; some CLI versions name it `Task`.)

## Additional context from orchestrator

$additional_context

## Inputs

The refinement is at **`$refinement_path`**.

The implementer's return summary (use this to seed the Status block and the
commit bodies — if a fixer sub-agent also touched the change, its follow-up
summary will be appended in the same block):

---

$implementer_summary

---

## Verification results (from the driver)

The chain ran deterministically against the implementer's trees (and any
subsequent fixer edits). Each row is `<step>: <PASS/FAIL>` with the log
path written under `orchestrator/logs/`. All rows are PASS by construction
— the driver would not have invoked you otherwise.

---

$test_results

---

## Blocked-task re-defer (do this INSTEAD of the ritual when nothing landed)

If the implementer's summary reports the task could NOT proceed (a
precondition the WBS graph doesn't express turned out unmet; the refinement
was found unimplementable as scoped), do NOT run the completion ritual —
there is nothing to mark complete. Instead: if the implementer left partial
changes in either repository, do not commit them — set them aside with
`git stash push -u -m "$task_id re-deferred"` in that repository and say so.
Then append a `tasks/parking-lot.md` entry describing the blocker and the
concrete trigger that would unblock it, append a `## Status` block to the
refinement noting the re-defer (date + reason — not Done), commit those two
files in estante-de-cifras, and say prominently in your return summary that
the task was re-deferred so the orchestrator records it in
`context_summary` and stops re-picking it.

## Ritual (in order)

### 1. Commit in cifra.md, if it changed

If the repository block above shows uncommitted changes in cifra.md that
belong to this task, commit them there now (see §Commits for the message
and staging rules), and note the commit's short SHA. This comes first so
the Status block and the estante-de-cifras commit can cite it. If cifra.md
holds changes that are clearly NOT this task's (unrelated files the
implementer and fixer never mention), leave them alone and report them.

### 2. Append a `## Status` block to `$refinement_path`

Format:

```
## Status

**Done** — <today's date>.

- <4–8 bullets summarizing what landed, citing artifact paths; for cifra.md
  work, the paths relative to that repository and its commit, e.g.
  "cifra.md `abc1234`: js/src/text.js, corpus harness in js/test/">
```

Do not rewrite earlier sections of the refinement. Use the implementer
summary above to seed the bullets, expanded with the actual file paths from
the diffs (`git diff --stat` in each repository to confirm).

### 3. Mark the task complete in the WBS

Add `complete 100` immediately after `allocate team` in the matching task
block in `tasks/<NN>-<area>.tji` (the area is the first dot-segment of
`$task_id`). While there, if the task's `note` does not yet end with
`Refinement: $refinement_path`, append that pointer to the note string
(keeping the existing text, including a leading `cifra.md:`) — the WBS is
the index into the refinements.

### 4. Milestone propagation

If `$task_id` is the last unmet dependency of a milestone in
`tasks/99-milestones.tji`, add `complete 100` to that milestone too. Check
by walking the milestone's `depends` list and confirming every other entry
is also `complete 100` (`python3 scripts/unblocked.py <milestone-id>`
reports it).

### 5. Register tech-debt tasks in the WBS — and wire each to a milestone

If the implementer's summary or the Status block names a follow-up task,
add that task to the appropriate `tasks/<NN>-<area>.tji` file in the same
commit. Use a stable snake_case id, give it:

- an effort estimate (`0.5d` / `1d` / `2d`),
- an `allocate team` line,
- a `depends` list reflecting the real prerequisites,
- a `note` line — starting with `cifra.md:` when the work lands in the
  cifra.md repository — citing the source-of-debt refinement + this commit,
  and the governing document (DIRECTION section, workflow, or spec chapter).

Do NOT add `complete 100` (the task is deliberately open).

**Always wire the new task to a milestone.** A registered task that no
milestone depends on is an *orphan*: `python3 scripts/unblocked.py` prints
an ORPHANS audit section for exactly this. After registering the task, add
its fully-qualified id to the `depends` list of the milestone whose scope
it belongs to in `tasks/99-milestones.tji` — normally the milestone that
already gates `$task_id`, or a later one if the debt is genuinely
later-stage. If you truly cannot find a milestone the debt belongs to,
that is a signal the task may not be real — say so in your return summary
rather than leaving it ungated.

**Self-check before committing:** run `python3 scripts/unblocked.py` and
confirm the new task id does NOT appear in the `ORPHANS` section. If it
does, you have not wired it to a milestone — fix that first.

**Never register an "audit" / "re-audit" / "revisit" / "reconsider"
successor task.** If the implementer or refinement says a decision should
be revisited later, DO NOT create a task whose deliverable is that
re-examination. Such tasks have no implementable deliverable — their "work"
is a human judgment call — so the orchestrator keeps picking them up,
failing to resolve them, and registering yet another successor: a
self-perpetuating loop. Instead, append an entry to `tasks/parking-lot.md`
(the human-review queue — see that file's header for the entry format) in
this same commit, and move on. Items the implementer or refinement_writer
flagged for human review in their return summaries go to the same place,
and so does work only a human can do — an external account or approval, a
legal question, republishing the mockup canvas after a design task (one
open entry for that is enough; update it rather than adding another). Only
register *WBS tasks* for concrete *agent-implementable* work; everything
that needs a human goes to the parking lot, not the WBS.

### 6. Validate the WBS

Run `tj3 --silent --no-reports project.tjp 2>&1 | grep -iE "error|warning"`
and confirm no output. Any error or warning on your `.tji` edits must be
fixed before the commit.

## Commits (one task = one commit per repository it changed)

Both repositories write commit messages the same way — read
`git log -5` in each to match the voice:

- the subject is a plain imperative sentence saying what the change does
  for the project, in the repository's own words (e.g. "Read the text layer
  in cifra.md for JavaScript"), no task-id prefix, no trailing period;
- the body is prose explaining what landed and why, citing the refinement
  and the governing document(s);
- then the task, and the verification;
- then the attribution trailer lines.

Use `git commit -m "$$(cat <<'EOF' ... EOF)"` so the multi-line body
formats correctly. Shape:

```
<imperative subject>

<paragraph(s) explaining what landed and why, citing the refinement and
the governing document(s)>

<bulleted list of files with one line each>

Task: $task_id (estante-de-cifras, $refinement_path)
<in the estante-de-cifras commit of a task that also changed cifra.md:>
cifra.md: <short SHA> <its subject>

Verification (driver-run `scripts/gate`, both repositories — see the
results block): green.
  - <the rows of the results block>
  - <task-specific verification if any>

<the attribution trailer lines your environment requires>
```

**Attribution.** End every commit message with the attribution trailer
lines your session's instructions require for commits you create (for
example a `Co-Authored-By:` line and a session link). Copy them exactly as
given — do not invent, alter or omit them; if your instructions give none,
add none.

**Build and test before committing.** The driver's green gate is that
check for this change; do not commit anything the gate has not seen (no
edits beyond the ritual's own files after the chain ran). If you ever need
to build or test, any parallelism flag gets an explicit bound
(`-j $$(nproc)`), never a bare `-j`.

## Hard rules

- **DO NOT run `git push`**, in either repository. The commits stay local;
  the human user pushes in batches at their own cadence.
- DO NOT bundle two tasks in one commit. One leaf = one commit per
  repository it changed.
- DO NOT open PRs.
- DO NOT amend a previous commit. Always create a new one.
- DO NOT edit source/test/spec/corpus files beyond what the ritual
  specifies — the implementer and fixer own the work; you own the WBS
  state, the Status block, the parking lot, and the commits.

## Stage carefully

When staging files, prefer adding specific files by name rather than
`git add -A` or `git add .`.

- **In cifra.md**: the files the implementer and fixer touched — spec
  chapters, reference code and tests, corpus entries (including their
  generated files), `js/` or `go/` sources, tests and lockfiles.
- **In estante-de-cifras**: the source/test/document files the implementer
  touched here (including any design delta the refinement_writer produced
  in `docs/`), the refinement (with its new Status block), the
  `tasks/<NN>-<area>.tji` change for the `complete 100` line (and any
  registered tech-debt block), the `tasks/99-milestones.tji` change
  (milestone propagation and/or debt wiring), and any `tasks/parking-lot.md`
  entry you appended.

Never stage generated output that is not meant to be tracked
(`node_modules/`, build output, `report/`, `.unblocked-report.tjp`,
`orchestrator/logs/`, `orchestrator/state/`, a Python `.venv`).

## Reference paths

- `tasks/refinements/README.md` — refinement shape + task-completion
  ritual (authoritative for the ritual you're running).
- `tasks/parking-lot.md` — the human-review queue and its entry format.
- `scripts/gate` — what the driver's chain ran.

## Return contract

When done, your final assistant message must be a short summary
(≤ 6 lines):

- Commit SHA(s), per repository (estante-de-cifras, and cifra.md if it
  changed).
- `complete 100` lines added (which task ids).
- Milestone propagation done-yes-or-no (and which milestone if yes).
- Tech-debt tasks registered (id list) and the milestone each was wired
  into — `none` if none. (Confirm none landed in the `ORPHANS` section of
  `python3 scripts/unblocked.py`.)
- Parking-lot entries appended (titles) — `none` if none — and one-line
  confirmation that `git push` was NOT run in either repository.

The orchestrator reads this and uses it to decide the next pick.
