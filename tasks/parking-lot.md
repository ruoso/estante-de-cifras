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

### 2026-10-05 — Normative diagnostic-code table missing from the spec
- **Source**: closer for `cifra_js.reader` (cifra.md commit `9eb9a7c`), surfaced by the refinement's §Open questions.
- **Question**: The spec states reader diagnostics as prose obligations (§9.2) with only `bad-fingering` having an explicit code (§7.5.1). The other 21 reader codes and their messages are normative only through the Python reference and the committed corpus. Should `spec/` gain a consolidated, normative diagnostic-code table so the reader's observable surface is pinned by the spec alone (not only the corpus)?
- **Why parked**: format-area documentation decision; the scope is "should the spec gain a section?" — a human judgment call about where to bind normative status for diagnostic codes. Does not block any current task; the corpus already pins all 22 codes this reader emits.

### 2026-10-04 — §9.3 line 140 stale prose: "The corpus has no entries for reading setlists yet"
- **Source**: closer for `cifra_js.setlists` (cifra.md commit `c72c24e`), surfaced by the refinement's §Open questions.
- **Question**: `spec/9-conformance.md` line 140 reads *"The corpus has no entries for reading setlists yet (§10, Open questions)"*. This was falsified when `format.setlist_corpus` added entries 35–47. The correction is a one-line format-spec edit. Is the sentence simply deleted, or replaced with a count/cross-reference?
- **Why parked**: format-spec wording decision; the implementer correctly did not edit a conformance spec from a JS implementation task.

### 2026-10-05 — Implement §8.5 editing operations in the Python reference and add editing corpus fixtures
- **Source**: closer for `cifra_js.editing` (cifra.md commit `b1d1f94`), surfaced by refinement §Decisions.
- **Question**: §8.5 was implemented in JavaScript only, against the spec prose; the Python reference does not implement editing operations and the corpus has no §8.5 fixtures. Should a future task add §8.5 to the Python reference and/or add editing corpus entries, to provide a cross-implementation second opinion for "two writers make the same change"?
- **Why parked**: product scope decision. The current scope is correct per §Decisions — the app is the only editing client, Go never arranges, and the spec is the oracle. Adding §8.5 to the reference + corpus would require a non-trivial reference + corpus + (for symmetry) Go programme for behaviour no second implementation consumes. Only a person should decide whether the cross-check value justifies that work.

### 2026-10-05 — Should the format specification carry a version string, and how should all three implementations declare it?
- **Source**: closer for `cifra_js.conformance` (cifra.md commit `b7f5ce9`), surfaced by refinement §Open questions.
- **Question**: `js/README.md` claims the §9 profiles against the in-repo specification; DIRECTION's *Versions* speaks of a canonical-form version the service negotiates (workflow 14), which is a different axis. Should the format spec itself carry a version number, and should all three implementations export a machine-readable `conformsTo` / `CONFORMANCE` constant or declare it in their READMEs? This is a cross-cutting format-governance decision that would move the spec, the reference, and both implementations together.
- **Why parked**: format-governance decision that only a person can make; it spans three implementations and the spec itself. The §9 profiles are declared correctly in `js/README.md` for now. No WBS task is blocked by the absence of a version string.
