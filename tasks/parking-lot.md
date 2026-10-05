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

### 2026-10-05 — Promote next-launch/never-mid-song lifecycle into DIRECTION §3.7

- **Source**: closer for `storage.migrations` (commit TBD — see estante-de-cifras log), surfaced by refinement Decision 4.
- **Question**: The next-launch / never-mid-song lifecycle (`skipWaiting: false`, `registerType: 'prompt'`) is documented in worker.md Decision 6 and the `protocol.js` header comment, but DIRECTION §3.7 has no prose sentence for it. Maintainers may want a sentence in DIRECTION §3.7 (around L394–396) recording the guarantee that a migration only activates on the next launch, never mid-session.
- **Why parked**: documentation-scope decision. The behavior is already settled and tested (vite.config.js:39,52; worker.md Decision 6). Adding it to DIRECTION is a human judgment call about where normative prose should live; no current task is blocked.

### 2026-10-05 — Should the format specification carry a version string, and how should all three implementations declare it?
- **Source**: closer for `cifra_js.conformance` (cifra.md commit `b7f5ce9`), surfaced by refinement §Open questions.
- **Question**: `js/README.md` claims the §9 profiles against the in-repo specification; DIRECTION's *Versions* speaks of a canonical-form version the service negotiates (workflow 14), which is a different axis. Should the format spec itself carry a version number, and should all three implementations export a machine-readable `conformsTo` / `CONFORMANCE` constant or declare it in their READMEs? This is a cross-cutting format-governance decision that would move the spec, the reference, and both implementations together.
- **Why parked**: format-governance decision that only a person can make; it spans three implementations and the spec itself. The §9 profiles are declared correctly in `js/README.md` for now. No WBS task is blocked by the absence of a version string.

### 2026-10-05 — Workflow 2 line 17 vs. recents in the synced home book
- **Source**: closer for `design.home_book_format`, surfaced by implementer's return summary.
- **Question**: Workflow 2 line 17 reads "Recents are kept on the device and are not synced." The home book format (§4.6, §7) namespaces recents per device and syncs them for recoverability — a device reads only its own namespace, so there is no cross-device most-recently-played, but the bytes do sync. The refinement explicitly reconciled this (design §7), and workflow 13 lines 35–37 confirm per-device recents. Should workflow 2 line 17 get a one-line clarification ("…but the bytes sync for recoverability; each device reads only its own") to avoid future confusion?
- **Why parked**: wording decision on a workflow document; the behaviour is already decided and consistent with workflows 8 and 13. Whether to clarify workflow 2 is a human judgment call.

### 2026-10-05 — Left-handed / horizontal-neck diagram display options
- **Source**: closer for `design.explorer` (tasks/refinements/design/explorer.md), surfaced by implementer's return summary and the refinement §Open questions.
- **Question**: Explore Chords has display toggles for vertical/horizontal neck and left-handed mirror. The chord explorer (workflow 16) ships with the vertical `ChordBox` only. Should Estante carry these display toggles — and if so, as a home-book preference — so left-handed players can use the explorer and the in-song picker comfortably?
- **Why parked**: product judgment call; no Estante workflow or mockup currently includes these toggles. Deciding yes would require a new home-book preference key, a `ChordBox` mirror mode, and a UI surface to toggle it — a deliberate decision, not an import.

### 2026-10-05 — Republish the mockup canvas after W15

- **Source**: closer for `design.instruments` (tasks/refinements/design/instruments.md).
- **Question**: The W15 board (`docs/mockups/W15-set-up-an-instrument.dc.html`) is written and registered in `canvas.json`, but the published canvas on Diagram.Codes (or wherever it is hosted) needs to be updated to include it. The implementer cannot render or publish the board.
- **Why parked**: work only a person can do — requires publishing access to the external canvas host.

### 2026-10-05 — foundation.e2e_web re-deferred: app does not register its service worker

- **Source**: closer for `foundation.e2e_web` (re-defer — no commit, nothing landed).
- **Question**: The task halted because `app/src/main.jsx` never calls `registerSW()` and VitePWA's `injectRegister: null` means the service worker is never registered. The offline smoke test (`offline.spec.js`) cannot pass without fixing the app — which is outside the harness task's scope. **Concrete trigger to unblock**: `foundation.app_sw_register` must reach `complete 100` before `foundation.e2e_web` is re-attempted. That task is now registered in `tasks/25-foundation.tji` with `depends !app_tooling` and `foundation.e2e_web` updated to `depends !e2e_api, !app_sw_register, service.serve_app`.
- **Why parked**: informational record of the re-defer; no human judgment needed — the prerequisite task is in the WBS and the orchestrator will pick it up.
