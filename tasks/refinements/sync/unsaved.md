# sync.unsaved — Merging under unsaved changes

## TaskJuggler

`task unsaved "Merging under unsaved changes"` — `tasks/45-sync.tji:15`.
- **Effort:** 2d. **Allocate:** team.
- **Depends:** `!engine` (same-parent: `sync.engine`).
- **Inherited through the parent `sync` task** (`tasks/45-sync.tji:5`):
  `storage.working_copy`, `cifra_js.merge`, `foundation.e2e_api`.
- **Milestone:** `milestones.m3_service` (`tasks/99-milestones.tji:32`).
- Note names: **DIRECTION §3.1**, **workflow 4** (and, for the merge-while-
  editing promise, **workflow 8 §A song open while it changes**).
- Note's `Tests:` clause: **behavior** only.

## Effort estimate

**2d.** The engine's fetch → cifra-aware merge → push loop, the per-file
cifra merge driver, the per-book lock, and the behavior-test harness (a real
local git remote plus `fake-indexeddb`) all exist from `sync.engine`. The
work is one new code path: replace the dirty-tree *deferral* with a
merge-that-re-applies the unsaved working text on top of the merged
committed content, plus the conflict-under-unsaved branch and the fact the
editor view will later consume. Bounded, one module mostly, with its own
behavior tests. The editor's *view* of the result is deferred (see
Acceptance criteria), which keeps this task Worker-only.

## Repository

**estante-de-cifras, app only.** The note does not start with `cifra.md:`.
The merge logic lives entirely in the Web Worker. No service, hook, or
cifra.md change (the format's three-way merge already exists and is consumed
unchanged — `cifra_js.merge`).

Directories / files that change:

- `app/src/worker/sync-engine.js` (edit) — replace the dirty-tree deferral
  (`syncSongbook` gate, `sync-engine.js:486-491`) with the
  merge-under-unsaved path: capture each dirty file's working text and
  pre-merge HEAD oid, run the existing committed merge (`defaultMergeBook`,
  `sync-engine.js:209`), then re-apply the captured edits onto the merged
  working tree. Emit a fact per re-applied / conflicted path.
- `app/src/worker/cifra-merge-driver.js` (edit) — expose the per-file cifra
  three-way merge (`cifraMerge`, imported `cifra-merge-driver.js:28`) as a
  reusable `reapplyWorkingText({ base, ours, theirs, setlist })` helper the
  engine calls directly (outside isomorphic-git's tree walk) and that maps
  the `Outcome` to `{ text, conflict, marked }`.
- `app/src/worker/protocol.js` (edit) — the engine emits, for a song whose
  working text was re-merged, the same "updated by {name}" fact
  `sync.read_in_place` established for the reading view (`emitFact`,
  `sync-engine.js:271-290`), carrying `{ bookId, path, author }` so the
  editor view (deferred task) can show the result and say what came in.
- `app/src/worker/sync-engine.behavior.test.js` (edit / add cases) and a
  unit case in `app/src/worker/sync-engine.test.js` if the re-apply helper
  warrants one in isolation.

## Inherited dependencies

- **`sync.engine` — Done** (`tasks/45-sync.tji:11`, `complete 100`;
  refinement `tasks/refinements/sync/engine.md`). The engine's per-pass
  change-check → fetch → cifra-aware merge → silent two-parent merge commit →
  push loop, with the up-to-three-times lost-race retry
  (`sync-engine.js` `pushWithRetry` ~`:392`), and the per-book Web Lock
  (`withLock(bookId, fn)`, `app/src/worker/locks.js:61`). Crucially it ships
  the **dirty-tree guard** (`defaultTreeDirty`, `sync-engine.js:187`;
  deferral at `sync-engine.js:486-491`) that *defers* the merge when the
  working tree is dirty, with the in-code comment that "the base/theirs/
  working-text merge is sync.unsaved." **This task supersedes that guard.**
- **`storage.working_copy` — settled** (through the parent). Unsaved edits
  are written straight into the IndexedDB-backed git working tree on every
  WRITE command (`working-copy.js` `write`, `~:93`→`fs.promises.writeFile`
  `:102`; `logic.js` WRITE handler `:811-826`, reindex with `unsaved:true`
  `:824`). There is **no separate draft store**: the working text *is* the
  working-copy file, and `unsaved` is derived, never trusted across restart
  (`search-index.js` `reconcile` `:400`: `unsaved = headOids.get(path) !==
  oid`).
- **`cifra_js.merge` — settled** (through the parent). cifra.md's
  `merge(base, ours, theirs, { setlist }) → Outcome` (`cifra.md/js/src/merge.js:634`,
  exported `cifra.md/js/src/index.js`). Each input is a UTF-8 string, raw
  bytes, or `null` (absent); `Outcome = { result, deleted, conflicts,
  marked, kept, kind }` with `kind ∈ result | deleted | conflicts`. A clean
  merge returns `kind:'result'` with canonical `result`; a conflict returns
  `kind:'conflicts'` with `marked` (conflict-marked text,
  `<<<<<<< ours` / `=======` / `>>>>>>> theirs`) and `kept` (ours). It is
  byte-deterministic and held to the Go driver by the corpus. Already wired
  into the app through `cifra-merge-driver.js:28` (`import { merge as
  cifraMerge } from 'cifra-md'`).
- **`foundation.e2e_api` — settled** (through the parent). Not exercised by
  this task — it lands behavior-only — but inherited by the parent.

## What this task is

When a sync pass brings a new version of a song that has **unsaved
working-copy edits**, the engine must no longer defer. It performs the
three-way merge DIRECTION §3.1 describes — **base, theirs, and the working
text** — so the incoming changes are folded in and the user's edits remain
**unsaved, on top of** the merged result. The committed side (the device's
committed head merged with the remote) is still merged and pushed exactly as
`sync.engine` does; only the uncommitted working text is additionally
re-applied, and it is never committed or pushed by this task. When the
working text cannot be reconciled with the incoming content, the working
file becomes a conflict-marked text — unsaved, and (being marked) never
canonical, so never saved or pushed.

Concretely, for each file dirty at the start of the pass: capture the
working text `W` and the pre-merge HEAD blob `H0` (the version the edit was
made from); let the committed merge run and check out the merged head so the
working tree holds the merged committed content `M`; then compute
`cifraMerge(base = H0, ours = W, theirs = M)` and write the result back to
the working tree, uncommitted. A file with no incoming change merges to `W`
unchanged (one-side-changed fast path); a file whose edit conflicts with the
incoming content is written as the `marked` text.

## Why it needs to be done

`sync.engine` deliberately stops at the guard: it will push committed work
even when the tree is dirty, but it refuses to check a merged tree out over
an unsaved edit, and emits nothing that resolves the edit. Without this
task, a user editing a song while someone else's save arrives would see sync
stall on that book indefinitely (the guard defers every pass), and the
promise of DIRECTION §3.1 — edits stay unsaved and land on top — and
workflow 8 §A song open while it changes — "the incoming version is merged
under them" — would be unmet. This task closes the one gap the engine left
named-but-unbuilt. Downstream, `sync.conflicts` (workflow 9) handles the
case the committed merge itself cannot settle; the editor's in-place view of
a merge-under-unsaved is a deferred follow-up (below).

## Inputs / context

Normative:

- **DIRECTION §3.1 Sync** (`docs/DIRECTION.md:127-134`), the central
  citation. Verbatim (`:129-131`): "With unsaved work in the working copy,
  incoming changes are merged into it — base, theirs, and the working text —
  so the user's edits stay unsaved and land on top." And (`:133-134`):
  "Every git request to a hosted book goes through the app's one server
  component." Working-copy / index model: §3 (`:103-119`) — the real working
  copy (`:108-110`), explicit save = commit + push (`:111-113`), the derived
  index covering the working copy (`:114-117`), one Web Lock per book
  (`:118-119`).
- **DIRECTION §3.7 The app** (`docs/DIRECTION.md:418-424`): the Worker
  "holds git, the working copy and the search index, and does every clone,
  fetch, merge, save and index update. The main thread never touches
  IndexedDB." The view is fed by Worker messages; "only what shows it moves."
- **Workflow 4 — Edit and save** (`docs/workflows/04-edit-and-save.md`).
  "Editing" (`:9`): every change goes to the working copy as it is made; the
  song shows *unsaved changes* until saved or discarded; leaving loses
  nothing (`:11-15`). The single-state rule (`:17-21`): "There is one kind of
  unsaved change, whatever made it… All of them write to the same working
  copy, and are saved or discarded the same way." A merge re-applied under a
  user's edits produces another unsaved change of that same one kind.
  "Saving" is commit-then-push; *saved* means shared (`:36-41`). Normalising
  at save, an unreadable line stopping the save (`:47-56`) — the boundary
  that keeps a marked text from being pushed.
- **Workflow 8 — Sync** (`docs/workflows/08-sync.md`). "Merging" (`:40-47`):
  clean, cifra-aware merges are committed and pushed **without asking**; what
  does not merge cleanly is workflow 9. "A song open while it changes"
  (`:49-56`), the merge-under-editing promise — verbatim (`:55-56`): "Being
  edited, with unsaved changes, the incoming version is merged under them
  (DIRECTION §3.1); the editor shows the result, and says what came in." "A
  push that loses a race" (`:58-62`): retried up to three times, silently.

Code seams (all paths under `app/src/`, real line numbers from
`sync.engine` as it stands):

- `worker/sync-engine.js` — `createSyncEngine(deps)`. The committed merge
  `defaultMergeBook(bookId, author)` (`:209`), whose `igMerge({ … ours:'main',
  theirs:'refs/remotes/origin/main', abortOnConflict:true, fastForward:true,
  mergeDriver })` (`:221-234`) runs the cifra-aware tree merge and then force
  checks out `main` (`:243`) to bring the working copy to the merged head.
  `SyncConflictError` (`~:55`) halts the book when the committed merge
  conflicts. The **dirty-tree guard** this task replaces:
  `defaultTreeDirty(bookId)` (`:187`, `statusMatrix` rows `:189-193`) and the
  `syncSongbook` gate `if (await treeDirty(bookId)) { deferred = true; }`
  (`:486-491`); the committed-merge site is `:494`. `emitFact` (`:271-290`)
  is the fact channel.
- `worker/cifra-merge-driver.js` — `createCifraMergeDriver(options)` (`:43`)
  returns the per-file callback; `const [base, ours, theirs] = contents;`
  (`:48`) → `cifraMerge(base, ours, theirs, { setlist })` (`:50`);
  `outcome.kind === 'result'` → `{ cleanMerge:true, mergedText: outcome.result }`,
  else `{ cleanMerge:false, mergedText: ours }` (`:57-63`). Today only the
  committed revisions reach this; the live working text is not fed in. This
  task adds a sibling entry point for the re-apply.
- `worker/search-index.js` — `reconcile` (`:400`) derives `unsaved` from
  working-vs-committed oid; location shape `{ key, bookId, path, oid,
  unsaved }` (`:197`). The merged working text differing from the pushed
  merge commit is exactly what keeps the song *unsaved* after the pass, with
  no new flag to persist.
- `worker/protocol.js` — `EventKind.SYNC { bookId, phase, … }`
  (`:317-330`); the read-in-place fact pattern for carrying author.

Test harness (from `sync.engine`):

- `worker/sync-engine.behavior.test.js` — "the sync engine over a real local
  git remote and a fake IndexedDB." `IDBFactory` from `fake-indexeddb` into
  `createFileSystem({ indexedDB })`; `startGitHttpRemote()` from
  `../test/git-http-remote.js`; another device advances the shared bare repo
  via the host `git` CLI (`advanceRemote(remote, files, message)`); wires the
  real `createGitLayer`, `createGitHttpClient`, `createBookLocks`,
  `createHomeBook`, `createCifraMergeDriver`, `createSyncEngine`, and
  `installWebLocks`.
- `app/src/test/git-http-remote.js` — `startGitHttpRemote(options)`
  (`~:163`), `{ seed }` default true (seeds one commit), `{ seed:false }` for
  an empty remote.

## Constraints / requirements

- **The merge is base / theirs / working text** (DIRECTION §3.1 `:129-131`).
  `base` = the pre-merge HEAD blob of the file (the version the edit was made
  from); `theirs` = the merged committed content in the working tree after
  the committed merge checks out; `ours` = the captured working text. Label
  the user's text as *ours* and the incoming as *theirs* so conflict markers
  read `<<<<<<< ours` / `>>>>>>> theirs` from the editor's point of view.
- **The edits stay unsaved, on top** (DIRECTION §3.1; workflow 4 `:17-21`).
  The re-applied result is written to the working tree **uncommitted**. HEAD
  is the committed merge commit; the working text differs from it, so
  `reconcile` derives `unsaved:true` — a merge-driven unsaved change is the
  same one kind of unsaved change as any other.
- **Only the committed side is pushed** (workflow 4 `:36-41`, workflow 8
  `:40-47`). The committed merge (device head ↔ `origin/main`) is made and
  pushed exactly as `sync.engine` does, without asking. The uncommitted
  working text is never committed or pushed by this task.
- **Canonical over preserving content; a marked text is never canonical.**
  When the re-apply conflicts (`Outcome.kind !== 'result'`), write the
  `marked` text to the working tree, unsaved. Being marked it is never
  canonical and must never be saved or pushed — already enforced downstream
  (a marked / unreadable text stops the save, workflow 4 `:54-56`; the song
  carries `conflict` status, `protocol.js`). This task writes the marked
  text and emits the fact; it does not build conflict-resolution UI
  (`sync.conflicts`, workflow 9).
- **Offline first.** A failed change-check / fetch / push still never rolls
  back a commit and never surfaces an error (inherited from the engine); the
  dirty-book pass behaves the same — a lost race retries up to three times
  (workflow 8 `:58-62`), and the working text is captured once per pass and
  re-applied only after the committed merge lands.
- **The Worker owns it; one lock per book** (DIRECTION §3.7 `:418-424`, §3
  `:118-119`). Capture of the working text and the re-apply both run inside
  the book's existing `withLock` critical section, so a user WRITE cannot
  interleave between capture and write-back. After the lock releases, the
  working tree holds the merged-with-edits text; surfacing that to a live
  editor is the deferred view task.
- **No song text in logs.** The change-check client logs request metadata
  only; the re-apply logs nothing of the song (inherited constraint).
- **No new runtime dependency, no new architectural seam.** The re-apply
  reuses isomorphic-git (for the committed merge), the existing cifra merge
  import, the existing lock and fact channel. cifra.md is consumed, not
  changed.

## Acceptance criteria

The task delivers:

1. **The dirty-tree deferral is replaced by a merge** (`sync-engine.js:486-491`).
   A book with unsaved working-copy edits now syncs: the committed merge is
   made and pushed, and the working text is re-applied on top.
2. **base / theirs / working-text merge, edits unsaved on top.** For each
   file dirty at the start of the pass, the engine captures the working text
   and pre-merge HEAD blob, runs the committed merge, then writes
   `cifraMerge(H0, W, M)` to the working tree uncommitted. After the pass:
   HEAD is the pushed merge commit; the working file holds the incoming
   content with the user's edit applied; the index derives the song still
   *unsaved*.
3. **A file with no incoming change is untouched.** Its re-apply hits the
   one-side-changed fast path and returns the working text unchanged — the
   edit is preserved verbatim.
4. **A conflict under unsaved text becomes a marked working file.** When the
   re-apply's `Outcome.kind !== 'result'`, the `marked` text is written to
   the working tree (unsaved, `conflict` status); the committed merge still
   pushed cleanly; nothing marked is committed or pushed.
5. **A fact names what came in.** For each re-merged song the engine emits
   the read-in-place-style `{ bookId, path, author }` fact, so the editor
   view (deferred) can show the result and say what came in.

Tests it lands with, by level:

- **behavior — `app/src/worker/sync-engine.behavior.test.js`** (the sync
  engine over the real local git remote + `fake-indexeddb`, no React, no
  axe), new cases:
  - *base, theirs and the working text merged* — a book cloned on the device
    with an unsaved working-copy edit to a song; another clone advances the
    remote with a save that touches a different part of the same song;
    `startGitHttpRemote` + `advanceRemote`. Assert: HEAD advances to the
    pushed merge commit, the remote receives it, the working file holds the
    incoming change **with the device's edit applied**, and the index shows
    the song still *unsaved* (DIRECTION §3.1 `:129-131`; workflow 8 `:40-47`).
  - *the edits still unsaved on top* — assert the working text ≠ the committed
    HEAD blob after the pass and the edit survives (`reconcile` `:400`;
    workflow 4 `:17-21`). Include a dirty file with **no** incoming change and
    assert it is byte-for-byte preserved.
  - *a merge that conflicts with unsaved text* — the remote's save and the
    device's unsaved edit touch the same bar so `cifraMerge` returns a
    conflict. Assert: the working file is the `marked` text (conflict
    markers), the song carries *unsaved* / conflict status, the committed
    merge was still pushed, and nothing marked reached the remote
    (DIRECTION §3.1; workflow 4 `:54-56`; workflow 8 `:47`).
  - *the fact names what came in* — assert the engine emits the
    `{ bookId, path, author }` fact for the re-merged song (workflow 8
    `:55-56`).
  - All test songs are written for the purpose (standing rule), never
    someone else's words.
- **unit — `app/src/worker/sync-engine.test.js`** (optional, if the re-apply
  helper `reapplyWorkingText` is extracted): the `Outcome`→
  `{ text, conflict, marked }` mapping for the three outcome kinds
  (`result` / `deleted` / `conflicts`), with injected strings. If the helper
  stays inline in the engine, this is covered by the behavior cases and no
  separate unit case is added — a defensible choice given the note scopes
  behavior only.

No e2e level. The note scopes **behavior** only, and the deliverable is
Worker-internal: the merged-with-edits working tree, the derived unsaved /
conflict status, and the emitted fact. The one user-facing promise that
would need e2e-web — the editor showing the merged result and saying what
came in (workflow 8 `:55-56`) — is the deferred follow-up below, which
carries its own behavior + e2e-web tests. Dropping e2e here is recorded
under Decisions.

Deferred follow-up (closer registers in WBS):

- **`songs.edit_in_place` — "An editor open while sync merges under it"**,
  effort **1.5d**, app work (note does **not** start with `cifra.md:`),
  milestone **`milestones.m3_service`**. `depends !editor`,
  `sync.unsaved`, `books.online`. When a sync merges a new version under an
  open editor's unsaved changes, the editor updates to the merged working
  text — keeping the edit position — and shows a notice naming what came in
  (workflow 8 §A song open while it changes `:55-56`), the editor-view
  mirror of `sync.read_in_place`'s reading-view update. `Tests: behavior
  (the editor shows the merged working text and a notice naming the author,
  keeping the edit position; Testing Library and axe); e2e-web (a song open
  in the editor with unsaved changes while a sync from the stack merges a new
  version under it — put a local book online via books.online, a second
  device pushing as the same user — on phone, tablet and computer; axe).`

## Decisions

- **Re-apply the working text onto the committed merge, rather than merge the
  working text inside the git tree walk.** *Chosen:* run the engine's
  existing committed merge (device head ↔ `origin/main`) to produce and push
  the merge commit and check out the merged content, then do a *second*,
  per-file `cifraMerge(H0, W, M)` to rebase the uncommitted edit onto it.
  *Rationale:* isomorphic-git's merge operates on commits/trees, and the
  working text is not committed; the committed side is exactly what must be
  pushed (and must not contain the unsaved edit), while the edit must stay
  uncommitted. Splitting the two keeps the pushed history clean and canonical
  and the edit unsaved, matching DIRECTION §3.1 precisely. *Rejected:*
  committing the working text to a scratch commit, merging, then
  soft-resetting — it risks the scratch commit leaking to a push on a lost
  race, and muddies history; the re-apply is simpler and never creates a
  commit the user did not choose.
- **`base` = pre-merge HEAD blob, `ours` = working text, `theirs` = merged
  committed content.** *Chosen:* this maps DIRECTION's "base, theirs, and the
  working text" onto `cifraMerge(base, ours, theirs)` so the user's delta
  (W relative to H0) re-applies onto the incoming merged content, and
  conflict markers label the user's text as *ours*. *Rejected:* using the
  merge-base of the two committed heads as `base` — that is the committed
  merge's base, not the edit's base, and would mis-rebase the user's delta.
- **A re-apply conflict writes the `marked` text and stops there; it does not
  build resolution UI.** *Chosen:* write `Outcome.marked`, unsaved, carrying
  `conflict` status; the committed merge still pushes. *Rationale:* a marked
  text is never canonical and never pushed (standing rule), and the
  conflict-resolution screens (keep mine / take theirs / edit with markers /
  abandon) are `sync.conflicts` (workflow 9). This task's note is behavior-
  only and names the conflict case as a *merge* outcome, not a screen.
- **Behavior-only; e2e-web is the deferred view task's, not this one's.**
  *Chosen:* land the Worker merge with behavior tests and defer the editor's
  in-place view (`songs.edit_in_place`) with its own behavior + e2e-web
  tests. *Rationale:* the note names behavior only and no screen; the
  deliverable is Worker-internal; and `sync.read_in_place` set the precedent
  that the engine emits the fact while a separate view task consumes it. This
  is not dropping a named level — the note names no e2e — and the user-facing
  promise is kept by the registered follow-up, which carries e2e-web. The
  alternative, folding the editor view into this task, would contradict the
  behavior-only note without covering the screen's axe/e2e obligations.
- **No separate draft store; `unsaved` stays derived.** *Chosen:* read and
  write the working text through the existing working-copy filesystem and let
  `reconcile` derive `unsaved` from working-vs-committed oid. *Rationale:*
  that is the established model (§3 `:114-117`; `search-index.js:400`);
  introducing a draft store would be a new seam for no gain.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-08.

- `app/src/worker/sync-engine.js` — replaced the dirty-tree deferral (`syncSongbook` gate) with the merge-under-unsaved path: captures dirty song/setlist working text + pre-merge HEAD blob, runs the committed merge, re-applies each edit onto the merged content (gated behind injectable `treeDirty` seam), announces via the existing MERGED fact.
- `app/src/worker/cifra-merge-driver.js` — added `reapplyWorkingText({ base, ours, theirs, setlist })` mapping `Outcome` → `{ text, conflict, marked, deleted }`.
- `app/src/worker/protocol.js` — MERGED doc-comment updated (no longer "deferred"; now names re-merged songs).
- `app/src/worker/sync-engine.behavior.test.js` — 4 new cases: base/theirs/working merge pushes committed merge + folds edit under (AC2); edits unsaved on top + dirty-no-incoming-change byte-for-byte (AC2/3); conflict→marked working file, only clean committed merge pushed (AC4); read-in-place fact names incoming author (AC5). Removed 2 cases pinning the superseded deferral guard.
- `app/src/worker/sync-engine.test.js` — 4 unit cases for `reapplyWorkingText` (result / in-file-marked conflict / file-level conflict kept-ours / deleted).
