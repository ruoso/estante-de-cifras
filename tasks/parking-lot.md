# Parking lot — items for human review

This file is the queue for decisions the automated WBS loop (orchestrator +
closer + refinement_writer, `orchestrator/`) **must not** make on its own:
judgment calls, "should we revisit X later" questions, scope decisions, work
only a person can do (an account with a provider, a legal question,
republishing the mockup canvas), and anything that would otherwise be
(mis)encoded as a self-perpetuating "audit" WBS task.

**Why this exists:** an open question encoded as a WBS task gets picked up
by the orchestrator, can't be closed by an implementer (the work is a human
call), and spawns a successor — a loop. Instead of a task, the closer
appends an entry here and moves on. The human triages this file and either
resolves the item, wires real *implementation* work into a milestone, or
deletes the entry.

**Who writes here:** the closer (`orchestrator/prompts/closer.md`) appends
entries — both items it hits during the ritual and items the implementer /
refinement_writer flagged for human review in their return summaries. The
orchestrator's `human-intervention-needed` stop also points here.

**What triage does with an entry:**

- **Resolved → delete the block.** The decision lives where it will be
  read: a new WBS leaf's `note` (citing `tasks/parking-lot.md <date>
  (<title>)`), DIRECTION or a workflow, or the cifra.md specification.
  `git log -p tasks/parking-lot.md` recovers the original question.
- **Re-parked → append an `- **Updated** (<date>, triage):` line** saying
  what changed and why the trigger has not fired.
- **Still open, nothing new → leave it alone.**

So this file holds only *live* questions. It shrinks.

## Format

Append one `###` block per item, newest at the bottom:

```
### <YYYY-MM-DD> — <short title>
- **Source**: closer for `<task_id>` (commit `<sha>`), or the run that surfaced it.
- **Question**: the decision the loop could not make, or the work only a person can do.
- **Why parked**: judgment call / preconditions unmet / scope decision / needs a person.
```

### 2026-10-04 — §9.3 line 140 stale prose: "The corpus has no entries for reading setlists yet"
- **Source**: closer for `cifra_js.setlists` (cifra.md commit `c72c24e`), surfaced by the refinement's §Open questions.
- **Question**: `spec/9-conformance.md` line 140 reads *"The corpus has no entries for reading setlists yet (§10, Open questions)"*. This was falsified when `format.setlist_corpus` added entries 35–47. The correction is a one-line format-spec edit. Is the sentence simply deleted, or replaced with a count/cross-reference?
- **Why parked**: format-spec wording decision; the implementer correctly did not edit a conformance spec from a JS implementation task.
