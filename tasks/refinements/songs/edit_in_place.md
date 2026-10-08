# songs.edit_in_place — An editor open while sync merges under it

## TaskJuggler

`tasks/60-songs.tji` → `task songs` → `task edit_in_place`
("An editor open while sync merges under it"). Area `songs`.

## Effort

**1.5d** (as estimated in the `.tji`).

## Repository

**estante-de-cifras**, the app only (`app/src/`). No service, hook, or
cifra.md change: the merge under unsaved changes, the merged working text on
disk, and the `EventKind.MERGED` fact that names who it came from all already
land in the Worker (`sync.unsaved`). This task is purely the main-thread,
editor-view consumption — the editor-view mirror of what `sync.read_in_place`
built for the reading view. Touched areas:

- `app/src/editor/SongEditor.jsx` — react to the `MERGED` fact: re-read the
  merged working text, swap the CodeMirror document keeping the edit position,
  show the notice. This is the one component over the live buffer, so the
  behavior lives here and every host inherits it.
- `app/src/editor/editor.css` — the merge-notice styling (alongside the
  existing `.est-editor-notice` paste/save-stop notices).
- `app/src/songs/NewSongHost.jsx`, `app/src/files/RawEditorHost.jsx` (and
  `app/src/files/FileView.jsx` as their mount point) — thread the
  `onOpenHistory({ bookId, path, commit })` seam the notice needs up to the
  shell.
- `app/src/shell/AppShell.jsx` — point the editor hosts' `onOpenHistory` at
  the existing `setHistory` / `SongHistory` seam (`AppShell.jsx:437-446`,
  `:458`), already wired for the reading view.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the notice copy under the
  `editor` block.

## Inherited dependencies

- **`songs.editor`** — *settled, Done 2026-10-06.* The source editor
  (`app/src/editor/SongEditor.jsx`). The seams this task extends:
  - the `source` slice read at `SongEditor.jsx:97` and requested via
    `OPEN_SOURCE` at `:241-244` — the demand-driven read-back command
    (editor.md D4) this task re-issues to pull the merged bytes;
  - the single initial-load effect at `SongEditor.jsx:224-238`, guarded by the
    `loadedKey` ref (`:114`, bail at `:230`) so a later `SOURCE` for the same
    path does **not** clobber the buffer — this task adds the one deliberate
    exception: a merge-driven swap;
  - the `EditorView` created once at `:178-219`, the `text` React mirror at
    `:90`, and `view.dispatch({ changes, selection })` (`:233-236`, `:273`) —
    the dispatch surface for the swap;
  - the debounced `WRITE` (`scheduleWrite` `:118-130`, `WRITE_DEBOUNCE_MS = 400`
    at `:43`, `pendingWrite`/`writeTimer` refs `:112-113`, unmount flush
    `:206-217`) — the buffer↔working-copy durability model this task must not
    fight;
  - the inline notice pattern — the paste notice (`SongEditor.jsx:331-341`,
    `role="status"`) and save-stop notice (`:343-349`, `role="alert"`), both
    `className="notice accent est-editor-notice"` — the shape the merge notice
    follows;
  - the pre-save gate (editor.md D3): a buffer holding a conflict marker already
    blocks Save with a line-pointed message — the behavior a conflicting merge's
    `marked` text inherits for free.
- **`sync.unsaved`** — *settled, Done.* The merge-under-unsaved engine
  (`app/src/worker/sync-engine.js`). On a sync pass over a book with an unsaved
  file it captures the working text `W` and pre-merge HEAD blob `H0`
  (`captureDirtyWork` `:211-236`), runs the committed merge and push, then
  re-applies `cifraMerge(base=H0, ours=W, theirs=M)` back into the working tree
  **uncommitted** (`reapplyDirtyWork` `:247-282`); a clean re-apply writes the
  merged result, a conflicting one writes the `marked` text. HEAD is the pushed
  merge; the working text differs, so `reconcile` derives `unsaved:true` with no
  new flag. It then emits the **same** `EventKind.MERGED` fact for the re-merged
  song (`announceMerge` `:401-419`). sync.unsaved's refinement names this task as
  its deferred editor-view follow-up.
- **`books.online`** — *settled, Done.* A device puts its own local book online
  (`books/online.md`). This is what makes a **hosted book on the shelf** exist,
  so a second device can push a new version into it and a sync pass can merge it
  under the editor — the driver for the e2e. The reusable "put a local book
  online on the stack" e2e harness is `e2e/web/tests/online.spec.js`.

Also relied on, and already landed (`complete 100`), so no new `depends` entry:

- **`books.file_view`** (Done) — the file view's **raw editor**
  (`app/src/files/RawEditorHost.jsx:45-53` mounts `SongEditor`, reached through
  `app/src/files/FileView.jsx`, itself mounted at `AppShell.jsx:362`). This is
  the production path that opens the editor on an **existing** song inside a
  **hosted** book — the state the e2e scenario starts from. (The reading view's
  `onEdit` seam is raised but not yet wired to an editing host in AppShell, so
  the file-view raw editor is the reachable editor-open path for a hosted song
  today; the e2e uses it.)

## What this task is

A user has a song open in the editor with unsaved changes. A background sync
brings a new version of that same song from someone else (or from the same
account's other device). `sync.unsaved` has already merged the incoming version
*under* the user's unsaved edits — the edits stay on top, uncommitted — and
written the merged working text to the working copy, and it has emitted an
`EventKind.MERGED` fact naming the incoming author and commit. This task makes
the open editor **react**: it swaps the CodeMirror document to the merged
working text while **keeping the edit position** (the caret and selection), and
shows a non-modal inline notice naming who the change came from — *Updated by
{name}: see what changed* — whose action opens the song's history. It is the
editor-view mirror of `sync.read_in_place`'s reading-view update.

## Why it needs to be done

Workflow 8 §A song open while it changes (L55-56) promises that a song **being
edited** with unsaved changes merges the incoming version under them and that
*the editor shows the result, and says what came in*. `sync.unsaved` built the
merge and the fact; `sync.read_in_place` built the reading-view half of the
promise and explicitly deferred the editor half here. Without this task the
Worker silently rewrites the working copy under an open editor: the buffer keeps
showing the pre-merge text, a later debounced `WRITE` would clobber the merge
on disk, and the user never learns their song changed. This task closes the last
leaf of workflow 8's "a song open while it changes" trio.

## Inputs / context

- **Workflow 8** — `docs/workflows/08-sync.md`, §A song open while it changes
  (L49-56). The three bullets: being read updates in place (L51-52), being read
  full screen waits (L53-54), and **being edited merges under the unsaved
  changes; the editor shows the result and says what came in** (L55-56, the line
  this task implements). §Merging (L40-47): cleanly-merging saves commit and push
  without asking; anything that does not merge cleanly goes to workflow 9.
- **Workflow 4** — `docs/workflows/04-edit-and-save.md`, §Editing (L11-21):
  every change goes to the working copy as made and shows *unsaved changes*;
  "there is one kind of unsaved change, whatever made it." §Normalising (L47-56):
  a conflict-marker / unreadable line is never canonical and stops the save.
- **Workflow 9** — `docs/workflows/09-conflicts.md` and task `sync.conflicts`
  (`tasks/45-sync.tji:35`): the conflict-resolution surface. **Out of scope
  here** — this task displays the `marked` text and lets the existing save gate
  block it; resolving the conflict is workflow 9's concern.
- **DIRECTION §3.1 Sync** (`docs/DIRECTION.md:127`): base, theirs and the
  working text merged; the edits stay unsaved on top (the merge contract
  `sync.unsaved` implements).
- **DIRECTION §3.7 The app** (`docs/DIRECTION.md:405`, "a merge landing" as its
  own message at `:424`): the Worker owns git, the working copy and the index;
  the main thread reacts to facts over the message channel.
- **The `MERGED` fact** — `app/src/worker/protocol.js:372-392`
  (`EventKind.MERGED = 'merged'`), payload `{ bookId, changed: [{ path, author,
  commit }] }`, transient (no reducer slice), metadata only — **never song
  text**. Its doc comment (`:385-391`) names *this* task as the consumer.
  `author` is the incoming commit's display name (the person, not the device
  "Me"); `commit` is the oid for the history link. Emitted by
  `sync-engine.js announceMerge` (`:401-419`, author via `metaOf`-style
  resolution `:374-396`), threaded through `logic.js:545` (`emitMerged`).
- **The subscription seam** — `useWorkerEvent(store, kind, handler)`
  (`app/src/worker/useStore.js:30-43`): a transient one-shot event, no slice.
  The reading-view mirror subscribes at `SongReading.jsx:193-200`.
- **The reading-view mirror to follow** — `app/src/songs/SongReading.jsx`:
  the `MERGED` handler (`:193-200`), `applyUpdate` re-issuing `OPEN_SOURCE`
  (`:182-187`), place-keeping capture/restore (`:157-176`, `useLayoutEffect`
  `:227-241`), and the notice JSX (`:522-539`): `<div className="notice accent
  reading-update-notice" role="status">`, `t('reading.updatedBy', { name })`, a
  "see what changed" button → `onOpenHistory({ bookId, path, commit })`, a
  dismiss button. i18n at `app/src/i18n/locales/en.js:612-614`
  (`updatedBy: 'Updated by {name}'`, `seeWhatChanged`, `updateDismiss`).
- **Predecessor refinements** — `tasks/refinements/sync/read_in_place.md`
  (Decisions 1-6: transient `MERGED` fact; demand-driven `OPEN_SOURCE`;
  place-keeping; inline non-modal notice; author = incoming commit name;
  `onOpenHistory` seam), `tasks/refinements/sync/unsaved.md` (the merge
  contract), `tasks/refinements/songs/editor.md` (D2 view parses for
  preview/diagnostics, D3 the pre-save gate, D4 the `OPEN_SOURCE`/`source`
  read-back, D5 cursor/selection are ephemeral editor state).
- **e2e templates** — `e2e/web/tests/read-in-place.spec.js`: the two-device
  pattern — `secondDeviceSeedsSong` (`:285-292`) and
  `secondDevicePushesNewVersion` (`:297-305`, pushes as `INCOMING_AUTHOR` via the
  git CLI with `cookieArgs`) — and `e2e/web/tests/online.spec.js` (put a local
  book online). axe via `e2e/web/lib/axe.js`.
- **Behavior-test rig** — `app/src/editor/SongEditor.behavior.test.jsx`:
  `makeStore()` (`:31-37`, loopback `createStore` endpoint; `emit` pushes a
  Worker→main event), source seeded via `event(EventKind.SOURCE, …)`, cursor/doc
  read through `editorRef.current.state` (`:57-61`), CodeMirror geometry stubs
  (`:24-29`, [[codemirror-jsdom-getclientrects]]), axe via `checkWcag21aa`
  (`app/src/a11y/axe.js`). The reading-view rig's `emitMerged` + `setSource`
  helpers (`SongReading.behavior.test.jsx:161-166`) are the shape to add here.

## Constraints / requirements

- **The Worker owns the merge; the view adopts the result.** The view must not
  re-merge: no three-way merge in the view (editor.md D2 keeps canonical
  save/merge in the Worker). On `MERGED` the editor re-issues `OPEN_SOURCE` and
  adopts the bytes the `source` slice returns. The engine never pushes `SOURCE`
  (read_in_place D2); the view pulls for its own open path.
- **No lost edit, no clobbered merge.** The merge's *ours* is the editor's
  last-written working text, so edits already flushed by the 400ms debounce are
  preserved *by the merge* and reappear in the merged text. The editor therefore
  must **not** re-send its pre-merge buffer after a merge (that would overwrite
  the incoming side on disk): on adopting the merged text it **cancels any
  pending debounced `WRITE`** (which still holds the pre-merge buffer), then lets
  the normal debounce persist subsequent edits.
- **Keep the edit position.** The caret and selection are ephemeral editor state
  (editor.md D5). The swap must preserve them: dispatch the merged text as the
  minimal change from the current buffer and let CodeMirror map the selection
  through that change (clamped to the new document bounds).
- **Status carried by a word.** The notice names the author in text ("Updated
  by {name}"), never colour alone; `role="status"`, non-modal, does not steal
  focus, dismissible by keyboard and pointer. React Aria for the interactive
  parts (the "see what changed" and dismiss buttons), axe clean at WCAG 2.1 AA.
- **No song text in the fact.** The `MERGED` payload carries only
  `{ bookId, path, author, commit }`; the text crosses the boundary only through
  the editor's own `OPEN_SOURCE` for its open path. (Nothing new is logged.)
- **Offline first.** This is wholly a reaction to a Worker fact on the main
  thread; it adds no network call.
- **Component boundaries.** The behavior lives in `SongEditor` (the only React
  layer over the buffer); hosts only thread `onOpenHistory`. No new Worker slice
  (the fact is transient).

## Acceptance criteria

**Behavior delivered.** A song open in the editor with unsaved changes, when a
sync merges a new version under it: the editor's buffer updates to the merged
working text keeping the caret/selection; a non-modal inline notice *Updated by
{name}: see what changed* appears naming the incoming author; its action opens
the song's history at the incoming commit; the pre-merge pending write is
cancelled so nothing clobbers the merge; a conflicting merge shows the `marked`
text and the existing save gate blocks saving it. The notice targets only the
open `{bookId, path}`; a `MERGED` for any other song/book is ignored.

**Tests, by level** (the note names *behavior* and *e2e-web*):

- **behavior** — `app/src/editor/SongEditor.behavior.test.jsx` (extended; real
  RAC + i18n over the loopback store; CodeMirror geometry stub; axe over the
  container):
  - *merge under the open editor* — seed source + a caret/selection, emit
    `MERGED { bookId, changed: [{ path, author, commit }] }` for the open path
    and serve the merged bytes on the re-issued `OPEN_SOURCE`; assert the buffer
    now holds the merged text, the caret/selection is preserved (read
    `editorRef.current.state.selection`), and the inline notice shows *Updated by
    {name}* (`role="status"`) with a "see what changed" button that calls
    `onOpenHistory({ bookId, path, commit })` and a dismiss button. **Pins**
    workflow 8 L55-56, the `MERGED` payload (`protocol.js:372-392`).
  - *the pending write is cancelled* — with a debounced `WRITE` pending, a merge
    arrives; assert the pre-merge buffer is **not** written back after the swap
    (no stale `WRITE`), so the merge on disk is not clobbered. **Pins** the
    no-clobber constraint / `sync.unsaved`'s uncommitted re-apply.
  - *a conflicting merge* — the served merged text carries conflict markers; the
    editor shows it and the existing pre-save gate blocks Save with the
    line-pointed message. **Pins** workflow 4 §Normalising L47-56, editor.md D3,
    the workflow-9 boundary.
  - *a merge for another song/book is ignored* — the open buffer is untouched.
  - *axe clean* on the notice state (WCAG 2.1 AA, `docs/mockups/README.md:26`).
  - (The Worker side — that the engine emits `MERGED` for the re-merged unsaved
    song — is already pinned by `sync-engine.behavior.test.js` under
    `sync.unsaved`; not re-pinned here.)
- **e2e-web** — `e2e/web/tests/edit-in-place.spec.js` (new; phone, tablet,
  computer; axe WCAG 2.1 AA on the editor + notice each viewport; against the
  compose stack): put a local book online (`online.spec.js` flow), open one of
  its songs in the editor through the file view's raw editor, type an unsaved
  edit, have a second device push a new version of the same song as the same
  user via the git CLI (`secondDevicePushesNewVersion` pattern, author
  `INCOMING_AUTHOR`, touching a different part); on the next sync the editor's
  buffer shows the merged text containing both edits with the caret kept, the
  notice *Updated by {INCOMING_AUTHOR}: see what changed* appears, and clicking
  it opens the song's history in-app. **Pins** workflow 8 L55-56 end to end on
  the three viewports.

Every driver exists: the hosted book on the shelf is `books.online` (Done); the
second device pushing as the same user is the git CLI from the harness (the
`read-in-place.spec.js` pattern), no UI dependency; the editor open on a hosted
song is the file view's raw editor (`books.file_view`, Done).

No follow-up is deferred from this task.

## Decisions

- **D1 — The behavior lives in `SongEditor`, not per host.** `SongEditor` is the
  single React layer over the live buffer and the only place that can swap the
  document while preserving the caret; it already takes `store`, `bookId`,
  `path`. It subscribes to `MERGED` itself (mirroring `SongReading.jsx:193-200`),
  so every host — `NewSongHost`, `RawEditorHost` / `FileView`, the `#dev/editor`
  harness — inherits the update with zero per-host logic. *Rejected:* a
  subscription in each host, which would duplicate the swap logic across three
  mount points and still have to reach into the `EditorView` for the selection.
- **D2 — Demand-driven re-read via `OPEN_SOURCE`, reusing the `source` slice.**
  The `MERGED` fact carries metadata only; the editor pulls the merged bytes with
  the same `OPEN_SOURCE` it already uses to load (editor.md D4), past the
  `loadedKey` guard as the one deliberate reload. *Rationale:* identical to the
  reading-view mirror (read_in_place D2); keeps the text crossing the boundary
  only for the open path; no new message, no new slice. *Rejected:* a new event
  carrying the text (widens what song text the Worker pushes), or overloading the
  existing initial-load (would reload on every `SOURCE`).
- **D3 — Keep the edit position by mapping the selection through the swap
  change.** Dispatch the merged text as the minimal change from the current
  buffer with CodeMirror's default selection mapping, so the caret keeps its
  place relative to surrounding text (and lands at the change boundary, clamped,
  where its own line was rewritten). *Rationale:* the editor analogue of
  read_in_place's best-effort scroll-anchor place-keeping (D4), at the caret's
  granularity; reuses CodeMirror's native mapping; no new state. *Rejected:*
  capturing a raw character offset and restoring it blindly (drifts when the
  merge changes earlier text).
- **D4 — Adopt the merged text wholesale; cancel the pending write; never
  re-merge in the view.** The merge already folded the user's last-written edits
  in as *ours*, so the editor takes the merged working text as its new base and
  cancels any in-flight pre-merge `WRITE` so it cannot overwrite the incoming
  side. *Rationale:* respects "the Worker owns the merge" (editor.md D2,
  DIRECTION §3.7); the one residual exposure — keystrokes in the <400ms debounce
  window at the instant a merge lands — is the app's existing buffer↔working-copy
  consistency model (the same window that an unmount or a crash sees,
  `SongEditor.jsx:206-217`), not a new guarantee this task weakens. *Rejected:* a
  three-way merge in the view to splice the unflushed tail back in — it would put
  canonical merge logic in the view, the exact thing editor.md D2 forbids, for a
  sub-400ms window.
- **D5 — No full-screen deferral; the editor updates immediately.** Unlike the
  reading view (read_in_place D3, which waits while reading full screen), the
  editor has no chrome-free performance mode to protect; the user is editing and
  wants the merged text, and the caret is kept by D3. *Rationale:* there is no
  "worst moment for a song to move" in an editing surface; workflow 8 L55-56
  gives the editor no "waits" bullet (only L53-54 does, for reading full screen).
- **D6 — Reuse the reading-view notice copy and the `onOpenHistory` seam.** The
  notice reads *Updated by {name}: see what changed* with new i18n keys under the
  `editor` block (`editor.updatedBy` / `editor.seeWhatChanged` /
  `editor.updateDismiss`), and opens the song's history through
  `onOpenHistory({ bookId, path, commit })` threaded from the editor hosts to
  `AppShell.setHistory` / `SongHistory` (`AppShell.jsx:437-446`, `:458`) — the
  seam the reading view already uses. *Rationale:* it is the same event and the
  same mental model across views; one copy string, one history surface.
  *Rejected:* a distinct editor wording or a separate history view (no reason to
  diverge). For a brand-new never-saved song (`isNew`) there is no history and no
  incoming version to merge, so the history link simply does not arise.
- **D7 — The author is the incoming commit's name, not the device identity.**
  The notice names `changed[].author` from the `MERGED` fact (the incoming
  commit's `author.name`), never the local "Me" identity. *Rationale:* identical
  to read_in_place D5 / `protocol.js:377-379`; it is the whole point of "says
  what came in."

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-08.

- `app/src/editor/SongEditor.jsx` — `MERGED` subscription (demand-driven `OPEN_SOURCE` re-read, cancels the pre-merge debounced `WRITE`), a swap effect adopting the merged bytes as a minimal diff (caret/selection mapped through), the *Updated by {name}* notice (`role="status"`, see-what-changed + dismiss), `onOpenHistory` prop.
- `app/src/editor/editor.css` — `.est-editor-update-notice` styling.
- `app/src/files/RawEditorHost.jsx`, `app/src/files/FileView.jsx`, `app/src/songs/NewSongHost.jsx` — thread `onOpenHistory`.
- `app/src/shell/AppShell.jsx` — points editor hosts' `onOpenHistory` at `setHistory`; moved the `history`/`SongHistory` check above the editor hosts so it renders over them.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — `editor.updatedBy` / `seeWhatChanged` / `updateDismiss`.
- `app/src/editor/SongEditor.behavior.test.jsx` — extended: merge swaps keeping caret + notice opens history (axe-clean); pending pre-merge write cancelled; conflicting merge blocked by save gate; `MERGED` for another song/book ignored. 11/11 green.
- `e2e/web/tests/edit-in-place.spec.js` — new; phone/tablet/computer, axe each viewport: hosted book → second device seeds → open in file-view raw editor → unsaved edit → second device pushes new version → sync merges under it, both edits shown, notice appears, opens history.
