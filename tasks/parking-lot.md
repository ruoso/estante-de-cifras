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

### 2026-10-05 — Progression matching: extension-tolerance and enharmonic roots

- **Source**: closer for `storage.progression_search` (commit TBD — see estante-de-cifras log), surfaced by refinement §Deferred work and implementer's return summary.
- **Question**: The shipped default is full spec §5.2 equality: roots compare by spelling (`Db` ≠ `C#`), and `Am` does not match `Am7`. Two product decisions are deferred here: (1) **Extension-tolerance** — should a query `Am` match a song's `Am7` (and `F` match `Fmaj7`, etc.), treating extensions as optional for discovery purposes? (2) **Enharmonic roots** — should `Bb` and `A#` be treated as the same chord for search? The spec §5.2 explicitly reserves enharmonic matching as a "MAY", and §5.2.1 normalises triad alterations into the quality. Both are feel decisions for real musicians that cannot be settled without user research. The implementation is designed for easy addition (the canonical-token builder in `progression.js` is the single place to add either fold), but the decision of what the default should be requires a deliberate product choice.
- **Why parked**: product/musician-UX judgment call; neither decision is needed to ship the feature at spec-floor behavior, and changing the default after real usage data is easy. Only a person (ideally with musician feedback) can decide which floor feels right.
- **Updated** (2026-10-14, triage): kept parked on purpose — ship spec-floor equality and revisit once musicians have used search.

### 2026-10-05 — Shared deep-screen app bar vs. per-screen composition
- **Source**: closer for `shell.layout` (tasks/refinements/shell/layout.md), surfaced by refinement §Open questions.
- **Question**: The mockups draw a per-screen `.appbar` with screen-specific actions (Back, Edit, Transpose, History…). Should a shared `AppBar` primitive be extracted in the shell, or should each content task compose `.appbar` from `theme.css`? Extracting now would require deciding what surface the shell owns vs. what content tasks own; deferring lets the first two or three content tasks reveal the natural split.
- **Why parked**: interface-consistency judgment call; the content tasks (`songs.search`, `books.shelf`, `books.setlists`) own what fills each screen and are better placed to decide whether a shared primitive is worth extracting once their needs are concrete.
- **Updated** (2026-10-14, triage): kept parked; no extraction yet.

### 2026-10-06 — Final PWA icon artwork
- **Source**: closer for `shell.pwa` (see estante-de-cifras log), surfaced by refinement §Open questions.
- **Question**: `shell.pwa` commits functional, visual-language-derived icons (`icon.svg`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon-180.png`). Brand-grade, design-reviewed icon artwork is a separate design call. Should a future design pass replace the current geometric icons with brand-quality artwork?
- **Why parked**: design/product judgment call; the functional icons meet the installability criteria. Brand artwork requires a deliberate design decision, not an automated agent deliverable.
- **Updated** (2026-10-14, triage): still wanted; waiting for a design pass.

### 2026-10-06 — Update-ready notice copy and placement within the shell
- **Source**: closer for `shell.pwa` (see estante-de-cifras log), surfaced by refinement §Open questions.
- **Question**: `shell.pwa` renders a defensible, non-modal update notice with placeholder copy. There is no workflow or mockup board specifying the exact wording, placement, or visual treatment of the update affordance within the shell. Should a future design pass define the notice's copy and its exact position in the shell layout?
- **Why parked**: design/copy judgment call; the shipped notice is non-modal, keyboard-reachable, and axe-clean. Wording and placement refinement requires a human design decision about the in-shell hierarchy.
- **Updated** (2026-10-14, triage): still wanted; waiting for a design pass.

### 2026-10-06 — Capo, and Arrange §Later "start from a nearby tuning"
- **Source**: closer for `music.transpose` (see estante-de-cifras log), surfaced by refinement §Deferred work; workflow 2 L127-129 marks it "Later."
- **Question**: The capo feature builds directly on `music.transpose` (the engine and the per-song memory seam are ready), but needs a product decision first: which shapes a capo reuses (the open-position shapes, or the shapes at the capoed position?), and how it is shown to the reader (a separate "Capo 2" label vs. displayed alongside transposition?). Once those decisions are made, a concrete WBS leaf can be scoped and wired to a milestone.
- **Why parked**: product/workflow scope decision; the governing documents mark capo "Later" (workflow 2 L127-129) and do not specify shapes or display. Not yet an agent-implementable deliverable.
- **Source** (merged entry, 2026-10-07 Arrange §Later: "start from a nearby tuning" and first-class capo): closer for `songs.arrange` (see estante-de-cifras log), surfaced by Workflow 5 `:96-102` §Later and the refinement §Deferred work.
- **Question**: Workflow 5 `:96-102` names two §Later capabilities: (1) "start from a nearby tuning" — an offer to adapt a neighbouring tuning's chosen shapes to the current tuning when beginning a new arrangement; (2) first-class capo support as a tuning (§6.3). Both build on infrastructure that already exists (the tuning roster, `music.transpose`, §6.3 capo-as-tuning). Neither has a product decision yet: for (1) how the similarity/closeness of tunings is defined and shown; for (2) how the capo interacts with the existing arrange surface (the capo entry already parked under 2026-10-06 covers the latter). What product decisions would allow either to be scoped into a concrete WBS leaf?
- **Why parked**: both capabilities are explicitly marked §Later in the governing workflow and need design decisions before they can be implemented. Tracking them here so they are not lost when M2 closes.
- **Updated** (2026-10-14, triage): the two entries merged; both stay workflow §Later until the capo shapes/display and tuning-closeness decisions are made.

### 2026-10-07 — `sync.fork_follow` dependency on `service.change_check`
- **Source**: closer for `service.change_check` (see estante-de-cifras log), surfaced by refinement §Acceptance criteria and implementer's return summary.
- **Question**: `sync.fork_follow` sits in the device area (`tasks/45-sync.tji:44`, `depends !engine`) and does not currently depend on `service.change_check`. But a forker may not be a member of the original book and so cannot read it from the device — only the service can expose its head. Whether `fork_follow` therefore needs to extend the `POST /api/shelf/change-check` endpoint (e.g. by including the original book in the request) is a task-boundary judgment. The endpoint as shipped emits only `changed` and `gone`; the fork fields (`originalNewSaves`, `originalGone`, `unchanged`) are already in the contract schema but intentionally unset by this task.
- **Why parked**: task-boundary scope decision. The question is whether `sync.fork_follow` needs to add a service-side extension, and if so whether that work belongs to `fork_follow`, a new `service.*` leaf, or an extension of `change_check`. Only a person can decide the correct boundary before `sync.fork_follow` is refined.
- **Updated** (2026-10-14, triage): kept parked; decide the service boundary when `sync.fork_follow` is refined (it is now ready to start in M4).

### 2026-10-07 — Active "someone tried" / "book changed" notification channel (workflow 10 Later)
- **Source**: closer for `service.sharing` (see estante-de-cifras log), surfaced by implementer's return summary and workflow 10 lines 108-117.
- **Question**: Workflow 10 lines 108-117 defers an active notification when someone tries to join a full book ("the owner is told someone tried") and when a book changes ("Your teacher updated Choros"). In the first pass, the owner learns the book is full from the sharing screen's live "50 of 50" count, and members learn about changes from the shelf's sync state (workflow 8). Realising active notifications requires an app-and-service notification channel spanning `service.sharing`, `service.admin`, the app's books area, and the sync engine — a workflow 10 §Later product decision. What product decisions and infrastructure would allow this to be scoped as concrete WBS leaves?
- **Why parked**: explicitly deferred to §Later in workflow 10 (lines 108-117); spans app and service; requires product design decisions about the notification channel before any concrete leaf can be scoped.
- **Source** (merged entry, 2026-10-13 Proactive notification when a book is taken down): closer for `books.notice_surface` (see estante-de-cifras log), surfaced by refinement §Open questions.
- **Question**: Workflow 10 marks "actively telling people" a book was taken down as a *Later* concern. `books.notice_surface` surfaces the reason when the owner opens the book detail, but does not proactively notify. Whether and how the app should proactively notify (push, in-app bell, email) — versus only surfacing the reason on demand — is a product-and-legal judgment that involves the notification channel, consent, and potentially the `service/` email infrastructure.
- **Why parked**: product-and-legal judgment call; workflow 10 explicitly scopes it *Later*. No WBS task is currently blocked. Only a person can decide whether and how to implement proactive notification.
- **Updated** (2026-10-14, triage): the two entries merged into one future notification channel; still workflow 10 §Later.

### 2026-10-13 — Republish the mockup canvas after W15, Theme-picker, Screen-reader, W09, and W17 boards
- **Source**: closer for `design.theme_picker` (tasks/refinements/design/theme_picker.md); updated by closer for `design.screen_reader`; updated by closer for `sync.keep_both`; updated by closer for `design.leaving`.
- **Question**: `docs/mockups/Theme-picker.dc.html`, `docs/mockups/Screen-reader.dc.html`, `docs/mockups/W09-conflicts.dc.html`, and `docs/mockups/W17-leaving.dc.html` are written/updated and registered in `canvas.json`, but the published canvas needs to be updated to include the new boards and the W09 change (hint region → Keep both action). Implementers cannot render or publish the board.
- **Why parked**: work only a person can do — requires publishing access to the external canvas host. (See also the earlier 2026-10-05 entry for W15; all five boards can be published in one pass.)
- **Updated** (2026-10-14, triage): merged the 2026-10-05 W15 entry here. Boards still to come and to publish in the same pass: W07 (design.w07_remove_board), and whatever design.display_preferences, design.recovery_email and design.leave_book draw.

### 2026-10-13 — Handing ownership of a book to a successor on leaving
- **Source**: closer for `design.leaving` (tasks/refinements/design/leaving.md), surfaced by implementer's return summary and workflow 10 §Later (line 120).
- **Question**: When an account owner leaves, their shared books are currently deleted for everyone (the first-pass policy). Workflow 10 §Later defers *handing ownership* — letting a departing owner pass a shared book (a band book, a class book) to a successor so it outlives them. Should leaving be where handing ownership finally lands, and if so, who may be designated successor and how is the transfer authorised?
- **Why parked**: product judgment call; workflow 10 §Later explicitly defers this. Deciding yes requires the handing-ownership feature (new service endpoint, new app surface in workflow 10) and a UI in the leaving flow to choose a successor — a deliberate design decision before it can be a WBS leaf.
- **Updated** (2026-10-14, triage): kept parked; still workflow 10 §Later. Leaving one book (design.leave_book, books.leave) is scoped to members, so an owner still cannot leave a book short of deleting it.
