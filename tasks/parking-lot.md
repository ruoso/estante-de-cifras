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

### 2026-10-05 — Font licensing for self-hosted typefaces

- **Source**: closer for `shell.tokens`, surfaced by implementer's return summary and refinement §Open questions.
- **Question**: `shell.tokens` ships `theme.css` with system-ui/Georgia/ui-monospace fallbacks only. Self-hosting the designed typefaces (Figtree, Fraunces, Source Sans 3, JetBrains Mono, IBM Plex Mono, Atkinson Hyperlegible + Mono) as local woff2 requires confirming redistribution licenses — a legal/human call. Once licenses are cleared, woff2 files can be committed, `@font-face` rules added to `theme.css`, and the PWA precache extended to include them.
- **Why parked**: legal/licensing judgment call; only a human can confirm redistribution rights. No WBS task is blocked by the absence of self-hosted fonts — the fallback stack keeps every theme legible offline.

### 2026-10-05 — Theme chooser placement in the shell

- **Source**: closer for `shell.tokens`, surfaced by refinement §Open questions.
- **Question**: Workflow 1 (lines 88–92) puts the theme chooser in the header alongside the language chooser, but no WBS leaf builds the theme chooser or the home-book write path for a theme preference. `shell.i18n` implies a language chooser, and `shell.layout` builds the header. Whether the theme chooser rides with `shell.i18n`, `shell.layout`, or a dedicated settings surface is an interface-placement call.
- **Why parked**: product/interface judgment call; the home-book write path for `theme` is also unscoped. Only a person can decide where the chooser lives and which task owns it.

### 2026-10-05 — Workflow 4: author display name for automatic home-book commits

- **Source**: closer for `storage.home_book`, flagged by implementer's return summary.
- **Question**: `home-book.js` calls `authorFrom({ id, name }, now)` from `author.js` for every automatic commit. Before sign-in the `id` is the device's local id, but what `name` should accompany it as the git author display name? After sign-in the account name is available; before sign-in (workflow 1 / workflow 4) no user name is on hand. Should the pre-sign-in display name be a device label (e.g. "This device"), the app name ("Estante de Cifras"), or a synthetic placeholder? Workflow 4's history view may surface this string to the user.
- **Why parked**: UX/product judgment call; the email address (`<local-id>@users.estantedecifras.app`) is correct and sufficient for the automatic commit's identity, but the human-readable display name is not settled. Deciding requires agreement between `account.sign_in` (which reauthors pre-sign-in commits) and `shell`/`books` tasks that show commit history, not just `storage.home_book`.

### 2026-10-05 — Density as a user-chosen, synced preference

- **Source**: closer for `shell.tokens`, surfaced by refinement §Open questions.
- **Question**: `shell.tokens` ships density locked at `comfortable`. DIRECTION §3.2, Workflow 1, and `home-book-format §4.1` do not define a `density` register. Whether users can choose density (and where it would be stored and surfaced) is an unresolved product question. Deciding yes would require a new home-book register key (`density`), a format-spec edit (§4.1), a UI surface, and a `storage.preferences_surface`-style consumer task.
- **Why parked**: product judgment call; no governing document currently mandates a density preference. Only a person can decide whether density becomes a user-chosen, synced preference.

### 2026-10-05 — Content-similarity rename following for rename-and-edit in one commit
- **Source**: closer for `storage.history` (Decision 3), surfaced by refinement §Decisions and §Open questions.
- **Question**: `history.js` follows renames via `log({ follow: true })`, which tracks content-preserving renames (app renames, `git mv`). A non-app git user who renames *and* edits a song in a single commit produces a non-exact rename that exact following does not cross — the history chain starts at the rename. Adding content-similarity detection (git's `-M` heuristic or a bespoke similarity threshold) would cover this case, but it is a heuristic with a tunable threshold and ambiguity that is a product judgment, not a settled behavior, and it only affects non-app git users.
- **Why parked**: product/heuristic judgment call. The shipping behavior (exact following) degrades gracefully (chain starts at the rename, as git's own default does). Deciding to add similarity detection requires choosing a threshold, handling ambiguity, and accepting the risk of false positives — a deliberate product decision, not a technical one.

### 2026-10-05 — Service book-id collision with reserved `'home'` id

- **Source**: closer for `storage.preferences_surface` (Decision 2), surfaced by implementer's return summary.
- **Question**: `HOME_BOOK_ID = 'home'` is exported from `home-book.js` as the reserved id for the home book, which lives at `git.bookDir('home')` alongside service-assigned songbook ids. The mild assumption is that service-assigned book ids (opaque server ids) will never take the literal value `'home'`. Should the service's id-generation strategy explicitly reserve `'home'` (and other potential reserved values), or should the app's book-store layer enforce that reservation?
- **Why parked**: service/account design judgment call; the current assumption is safe for the id schemes under consideration, but whether to encode it as an explicit invariant on the service side (in `account.sign_in`, the book-create endpoint, or hook validation) is a decision for the service and account tasks.

### 2026-10-05 — Progression matching: extension-tolerance and enharmonic roots

- **Source**: closer for `storage.progression_search` (commit TBD — see estante-de-cifras log), surfaced by refinement §Deferred work and implementer's return summary.
- **Question**: The shipped default is full spec §5.2 equality: roots compare by spelling (`Db` ≠ `C#`), and `Am` does not match `Am7`. Two product decisions are deferred here: (1) **Extension-tolerance** — should a query `Am` match a song's `Am7` (and `F` match `Fmaj7`, etc.), treating extensions as optional for discovery purposes? (2) **Enharmonic roots** — should `Bb` and `A#` be treated as the same chord for search? The spec §5.2 explicitly reserves enharmonic matching as a "MAY", and §5.2.1 normalises triad alterations into the quality. Both are feel decisions for real musicians that cannot be settled without user research. The implementation is designed for easy addition (the canonical-token builder in `progression.js` is the single place to add either fold), but the decision of what the default should be requires a deliberate product choice.
- **Why parked**: product/musician-UX judgment call; neither decision is needed to ship the feature at spec-floor behavior, and changing the default after real usage data is easy. Only a person (ideally with musician feedback) can decide which floor feels right.

### 2026-10-05 — Shell URL / deep-link routing
- **Source**: closer for `shell.layout` (tasks/refinements/shell/layout.md), surfaced by refinement §Open questions.
- **Question**: `shell.layout` ships in-memory destination selection with no URL synchronisation. Should the shell sync the active destination to the URL (enabling browser-back and bookmarkable destinations)? The one place URLs carry meaning — book links — is owned by `books.add_by_link`/`books.share`. The right moment to decide is when the share-link flow is built, since its deep-navigation needs will inform whether top-level destination routing is also desirable.
- **Why parked**: product/architecture judgment call; requires deciding routing strategy before it becomes load-bearing for `books.add_by_link` or `books.share`; baking it into the shell now would pre-decide deep navigation for songs, books and the file view.

### 2026-10-05 — Shared deep-screen app bar vs. per-screen composition
- **Source**: closer for `shell.layout` (tasks/refinements/shell/layout.md), surfaced by refinement §Open questions.
- **Question**: The mockups draw a per-screen `.appbar` with screen-specific actions (Back, Edit, Transpose, History…). Should a shared `AppBar` primitive be extracted in the shell, or should each content task compose `.appbar` from `theme.css`? Extracting now would require deciding what surface the shell owns vs. what content tasks own; deferring lets the first two or three content tasks reveal the natural split.
- **Why parked**: interface-consistency judgment call; the content tasks (`songs.search`, `books.shelf`, `books.setlists`) own what fills each screen and are better placed to decide whether a shared primitive is worth extracting once their needs are concrete.

### 2026-10-05 — Language chooser placement: header vs. account screen
- **Source**: closer for `shell.i18n` (tasks/refinements/shell/i18n.md), surfaced by refinement §Open questions.
- **Question**: Workflow 1 §Language (lines 82–84) and DIRECTION §Theme say the language is chosen in the header alongside the theme. The WBS instead routes the language+theme control to `account.account_screen` (`tasks/70-account.tji:26-30`). These two placements need reconciliation before `account.account_screen` is drawn, so the chooser control lands in the right place. `shell.i18n` is intentionally placement-agnostic — it applies whatever the `preferences` slice says regardless of where the chooser lives.
- **Why parked**: product/interface judgment call; resolving it requires a human decision on whether Workflow 1's header placement or the account-screen placement wins, before the chooser control task is scoped.

### 2026-10-06 — Final PWA icon artwork
- **Source**: closer for `shell.pwa` (see estante-de-cifras log), surfaced by refinement §Open questions.
- **Question**: `shell.pwa` commits functional, visual-language-derived icons (`icon.svg`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon-180.png`). Brand-grade, design-reviewed icon artwork is a separate design call. Should a future design pass replace the current geometric icons with brand-quality artwork?
- **Why parked**: design/product judgment call; the functional icons meet the installability criteria. Brand artwork requires a deliberate design decision, not an automated agent deliverable.

### 2026-10-06 — Update-ready notice copy and placement within the shell
- **Source**: closer for `shell.pwa` (see estante-de-cifras log), surfaced by refinement §Open questions.
- **Question**: `shell.pwa` renders a defensible, non-modal update notice with placeholder copy. There is no workflow or mockup board specifying the exact wording, placement, or visual treatment of the update affordance within the shell. Should a future design pass define the notice's copy and its exact position in the shell layout?
- **Why parked**: design/copy judgment call; the shipped notice is non-modal, keyboard-reachable, and axe-clean. Wording and placement refinement requires a human design decision about the in-shell hierarchy.

### 2026-10-06 — `.tji` note and `songs.search` Decision 6 say per-book status comes from `shelf.json`
- **Source**: closer for `storage.shelf_surface` (see estante-de-cifras log), surfaced by implementer's return summary and refinement Decision 3.
- **Question**: The `tasks/40-storage.tji` note for `shelf_surface` and `songs.search` Decision 6 both state the per-book status ('reading', 'N setlists') "comes from `shelf.json`." It does not — `home-book-format.md` §4.2 has no status field. The status is derived by consumers from index/derived state (Decision 3 of this refinement). Should the `.tji` note and any future refinement or workflow prose that mentions this status be re-worded to say it is composed by consumers from derived state rather than read from `shelf.json`?
- **Why parked**: documentation wording decision; the behavior is correctly settled by Decision 3. Re-wording the `.tji` note (a WBS annotation) and any product documentation is a human judgment call about where and how to record this clarification.

### 2026-10-06 — Workflow 3 L102 stale "whether a save also pushes is still open (DIRECTION §6)"
- **Source**: closer for `songs.new_song` (see estante-de-cifras log), surfaced by refinement Decision 6 and §Open questions.
- **Question**: `docs/workflows/03-write-a-new-song.md` line 102 reads "Whether a save also pushes is still open (DIRECTION §6)." DIRECTION §3 L111–113 ("Saving is a commit, and then a push (workflow 4)") settles this: a save commits and pushes. The cross-reference (§6) points at a section that no longer contains this decision. The one-line correction to workflow 3 belongs to workflow 4 / `songs.save_sheet`'s domain — the save/push behavior and its wording live there.
- **Why parked**: documentation wording decision; the behavior is correctly settled by DIRECTION §3 and `songs.new_song` Decision 6. Editing workflow 3 L102 is `songs.save_sheet`'s scope and a human judgment call about exact wording.

### 2026-10-06 — `SET_IDENTITY_NAME` author-name durability through a real-browser reload

- **Source**: closer for `songs.history` (see estante-de-cifras log), surfaced by fixer attempt 2's return summary.
- **Question**: After `SET_IDENTITY_NAME` writes the author name, a real-browser reload appears to re-ask for the name (the home-book preferences write may not be durable), while the fake-indexeddb cold-reopen behavior test (`save-preview.behavior.test.js:154-171`) passes. The fixer suggests: set name → `page.reload()` → edit → Save → assert *Your name* absent, and confirm/fix `SET_IDENTITY_NAME`'s home-book write durability. Is there a real bug in the reload path, and if so which task owns the fix?
- **Why parked**: potential bug in the home-book write path for `SET_IDENTITY_NAME`; requires confirming whether the reload path actually fails before the scope is clear. Touches `songs.save_sheet`, `storage.preferences_surface`, and the home-book write plumbing — a human needs to triage which task owns it and whether the durability gap is real.

### 2026-10-06 — Non-song/no-change file restore+save leaves the save sheet open

- **Source**: closer for `books.file_view` (see estante-de-cifras log), surfaced by fixer attempt 1's return summary.
- **Question**: Restoring a non-song or no-change file (e.g. README.md, .gitattributes) from the book history and then saving appeared to leave the save sheet open in the browser even though the Worker emits SAVED. The fixer could not confirm this as a defect (it was out of scope for the restore-a-song test) and did not reproduce it in a throwaway harness. Is there a real UI bug in the non-song restore+save path, and which task (books.file_view? songs.save_sheet?) owns the fix if so?
- **Why parked**: couldn't confirm as defect; "worth a closer look" is a revisit, not an implementable deliverable. Needs a human to reproduce and triage.

### 2026-10-06 — Capo feature: product/workflow decision needed before WBS leaf
- **Source**: closer for `music.transpose` (see estante-de-cifras log), surfaced by refinement §Deferred work; workflow 2 L127-129 marks it "Later."
- **Question**: The capo feature builds directly on `music.transpose` (the engine and the per-song memory seam are ready), but needs a product decision first: which shapes a capo reuses (the open-position shapes, or the shapes at the capoed position?), and how it is shown to the reader (a separate "Capo 2" label vs. displayed alongside transposition?). Once those decisions are made, a concrete WBS leaf can be scoped and wired to a milestone.
- **Why parked**: product/workflow scope decision; the governing documents mark capo "Later" (workflow 2 L127-129) and do not specify shapes or display. Not yet an agent-implementable deliverable.

### 2026-10-06 — Extend the save gate to warn when a hand-typed section after a hand-typed rule would be dropped

- **Source**: closer for `songs.editor_section_after_voicings` (see estante-de-cifras log), surfaced by refinement §Deferred.
- **Question**: `songs.editor_section_after_voicings` fixes the *Add section button* placing content in the voicings part, but a user who manually types `---` between two sections — or types a `## Section` heading after a pre-existing rule — still loses that content silently on save. The reader already reports it (`spec/7-voicings.md` §7.2; `js/src/parse.js:548-549`) but the diagnostic is not in `SAVE_BLOCKERS` (`{'bad-voicing','marker-line'}`, `SongEditor.jsx:48`). Should a save gate diagnostic be added to block saving when a section heading placed after the first rule would be dropped by canonicalise?
- **Why parked**: product-scope judgment call. The refinement explicitly scoped this task to the Add-section button only. Whether to extend the save gate requires deciding on the UX — blocking save (adds friction) vs. warning-only — and whether the "accidentally typed `---`" case is common enough to warrant the friction. Only a person can make that call.

### 2026-10-07 — Arrange §Later: "start from a nearby tuning" and first-class capo

- **Source**: closer for `songs.arrange` (see estante-de-cifras log), surfaced by Workflow 5 `:96-102` §Later and the refinement §Deferred work.
- **Question**: Workflow 5 `:96-102` names two §Later capabilities: (1) "start from a nearby tuning" — an offer to adapt a neighbouring tuning's chosen shapes to the current tuning when beginning a new arrangement; (2) first-class capo support as a tuning (§6.3). Both build on infrastructure that already exists (the tuning roster, `music.transpose`, §6.3 capo-as-tuning). Neither has a product decision yet: for (1) how the similarity/closeness of tunings is defined and shown; for (2) how the capo interacts with the existing arrange surface (the capo entry already parked under 2026-10-06 covers the latter). What product decisions would allow either to be scoped into a concrete WBS leaf?
- **Why parked**: both capabilities are explicitly marked §Later in the governing workflow and need design decisions before they can be implemented. Tracking them here so they are not lost when M2 closes.

### 2026-10-07 — `Invitation.useLimit` minimum:1 cannot express a 0-remaining exhausted invitation
- **Source**: closer for `service.sharing` (see estante-de-cifras log), surfaced by implementer's return summary.
- **Question**: The contract maps `uses_remaining` → `Invitation.useLimit` with `minimum: 1`, but a use-limited invitation that has been fully exhausted has `uses_remaining = 0`. That value satisfies the "exhausted" 409 path at runtime but would fail the contract's `minimum: 1` validation if the property were emitted for an exhausted invitation. The current handler omits `useLimit` (null/omitted) for exhausted invitations; this is a frozen-contract nuance — the contract was not designed to express the exhausted state via `useLimit`. Should the contract add a `minimum: 0` or a nullable variant to express a fully-exhausted invitation, or should the field remain omitted?
- **Why parked**: frozen-contract scope decision; the current behavior (omit `useLimit` when exhausted) is functionally correct and clients can infer exhaustion from the 409 code. Changing the contract requires a human judgment call about whether the exhausted state should be representable in `Invitation.useLimit`.

### 2026-10-07 — Active "someone tried" / "book changed" notification channel (workflow 10 Later)
- **Source**: closer for `service.sharing` (see estante-de-cifras log), surfaced by implementer's return summary and workflow 10 lines 108-117.
- **Question**: Workflow 10 lines 108-117 defers an active notification when someone tries to join a full book ("the owner is told someone tried") and when a book changes ("Your teacher updated Choros"). In the first pass, the owner learns the book is full from the sharing screen's live "50 of 50" count, and members learn about changes from the shelf's sync state (workflow 8). Realising active notifications requires an app-and-service notification channel spanning `service.sharing`, `service.admin`, the app's books area, and the sync engine — a workflow 10 §Later product decision. What product decisions and infrastructure would allow this to be scoped as concrete WBS leaves?
- **Why parked**: explicitly deferred to §Later in workflow 10 (lines 108-117); spans app and service; requires product design decisions about the notification channel before any concrete leaf can be scoped.

### 2026-10-07 — `sync.fork_follow` dependency on `service.change_check`
- **Source**: closer for `service.change_check` (see estante-de-cifras log), surfaced by refinement §Acceptance criteria and implementer's return summary.
- **Question**: `sync.fork_follow` sits in the device area (`tasks/45-sync.tji:44`, `depends !engine`) and does not currently depend on `service.change_check`. But a forker may not be a member of the original book and so cannot read it from the device — only the service can expose its head. Whether `fork_follow` therefore needs to extend the `POST /api/shelf/change-check` endpoint (e.g. by including the original book in the request) is a task-boundary judgment. The endpoint as shipped emits only `changed` and `gone`; the fork fields (`originalNewSaves`, `originalGone`, `unchanged`) are already in the contract schema but intentionally unset by this task.
- **Why parked**: task-boundary scope decision. The question is whether `sync.fork_follow` needs to add a service-side extension, and if so whether that work belongs to `fork_follow`, a new `service.*` leaf, or an extension of `change_check`. Only a person can decide the correct boundary before `sync.fork_follow` is refined.

### 2026-10-08 — W07 board under-illustrates the Remove flow
- **Source**: closer for `books.online` (Decision 5).
- **Question**: The W07 board (`docs/mockups/W07-add-a-book.dc.html`) draws only the hosted-in-step Remove one-liner ("Deletes this device's copy only. The book stays on Estante."). The unsaved/unpushed loss-warning case and the device-only "gone for good, download first" case are normative in workflow 7 L128-135 but are not illustrated on the board. Should the board be updated to illustrate these two additional Remove confirmations?
- **Why parked**: drawing gap, not a WBS task — the board under-specifies a normative workflow case that is already implemented correctly. Updating the mockup requires republishing the canvas; only a person with publishing access can do that.

### 2026-10-07 — Where `accounts.email` is first written (recovery-email flow)
- **Source**: closer for `service.email_links` (see estante-de-cifras log), surfaced by implementer's return summary.
- **Question**: `service.email_links` reads `accounts.email` to mint and mail the sign-in link, but no endpoint currently writes it. A passkey-based account (`service.passkeys`) is created with a null `accounts.email`. How and when does a user associate a recovery email with their account? This is the "account recovery email" flow (workflow 13 mentions the emailed link as the recovery path, but does not specify the screen where a user sets their recovery address).
- **Why parked**: product/workflow scope decision. The schema has the column; `service.email_links` reads it; but the write path (which endpoint, which screen, which workflow) is unscoped and requires a human decision about where to surface the recovery-email UI.

### 2026-10-08 — Shell `.est` min-height leaves other full-screen surfaces as page-scrollers
- **Source**: closer for `sync.read_in_place` (see estante-de-cifras log), surfaced by fixer's return summary (attempt 2).
- **Question**: The themed root `.est` uses `min-height: 100dvh` (indefinite), so any full-screen surface whose scroll container does not cap at `100dvh` grows to its content's full height and the *page* scrolls rather than the component. `sync.read_in_place` fixed this for the reading surface by capping `.reading-screen` and `.reading-split` at `100dvh` and giving `.reading-scroll` `overflow-y: auto`. The other bare full-screen surfaces — arrange, history, wizard — may have the same pattern (their e2e tests pass, but that does not rule out silent page-scroll). A shell-level `.est { height: 100dvh; overflow: hidden }` would be the broader cure but could have side effects on non-full-screen surfaces.
- **Why parked**: architectural scope decision. The fix for reading was targeted and tested; a blanket shell-level change needs a deliberate review of every surface and its scroll intent. A human should decide whether to scope a `shell.layout` fix or leave each surface to cap its own height.

### 2026-10-13 — Editor lowered to reader with unpushed saves: surface for the saves-can-never-go boundary
- **Source**: closer for `sync.lost_access` (see estante-de-cifras log), surfaced by refinement §Open questions.
- **Question**: When an editor is lowered to reader (still a member) with commits already made but not pushed, a push now returns 403 and the engine keeps the book on `saves_waiting`, retrying a push that can never succeed. Workflow 10 L83–85 says that user "is told those saves can no longer go to the book, and is offered a fork or the download". Is this surface `books.fork`'s "saving where one cannot" entry, or does it warrant a small distinct engine/UI change to detect the permanent-403 boundary and surface it differently from a transient sync pause? `sync.lost_access` deliberately left the 403 path unchanged (the 403 is not lost access — the user is still a member and can still read), but the UX gap remains.
- **Why parked**: product-judgment call best made when `books.fork` is scheduled for refinement; the boundary involves both engine behaviour (detecting a permanent-403 vs a transient permission error) and UI copy (workflow 10 vs workflow 11 entry points). Only a person can decide the correct scope before `books.fork` is refined.

### 2026-10-13 — Proactive notification when a book is taken down (workflow 10 *Later*)
- **Source**: closer for `books.notice_surface` (see estante-de-cifras log), surfaced by refinement §Open questions.
- **Question**: Workflow 10 marks "actively telling people" a book was taken down as a *Later* concern. `books.notice_surface` surfaces the reason when the owner opens the book detail, but does not proactively notify. Whether and how the app should proactively notify (push, in-app bell, email) — versus only surfacing the reason on demand — is a product-and-legal judgment that involves the notification channel, consent, and potentially the `service/` email infrastructure.
- **Why parked**: product-and-legal judgment call; workflow 10 explicitly scopes it *Later*. No WBS task is currently blocked. Only a person can decide whether and how to implement proactive notification.

### 2026-10-13 — Service frames the take-down reason in English; frame is untranslated for non-English locales
- **Source**: closer for `books.notice_surface` (see estante-de-cifras log), surfaced by refinement §Open questions (Decision 4).
- **Question**: The service returns the operator's reason as `"This book has been taken down: <reason>"` — the frame sentence is in English. For a user in a non-English locale the frame sentence is untranslated (the reason text itself cannot be localized). Fully localizing the frame would require adding a structured `reason` field to the `GitForbidden` contract (a `service/` + `api/openapi.yaml` change) so the app can build its own frame. The decision is whether the rare-event wart (an English frame sentence in a non-English UI) is worth the cross-repo change.
- **Why parked**: product/l10n scope decision; the behavior is correct per Decision 4 of `books.notice_surface`. Only a person can weigh the wart against the cross-repo `service.admin`-level change needed to fix it.
