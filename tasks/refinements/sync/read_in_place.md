# sync.read_in_place — A song open while sync changes it

## TaskJuggler

`tasks/45-sync.tji` → `task sync` → `task read_in_place`
("A song open while sync changes it"). Area `sync`.

## Effort

**1.5d** (as estimated in the `.tji`).

## Repository

**estante-de-cifras**, the app only (`app/src/`). No service, hook, or
cifra.md change: the merged bytes already land in the working copy on the
clean path (`sync.engine`), and the behavior is a main-thread view gate plus
one new Worker→main event. Touched areas:

- `app/src/worker/sync-engine.js` — emit a per-file "a merge landed" fact on
  the clean path.
- `app/src/worker/protocol.js` — one new `EventKind` (the open `kind`
  channel, as designed).
- `app/src/songs/SongReading.jsx` — react to the fact: update in place, the
  notice, the full-screen defer.
- `app/src/shell/AppShell.jsx` — wire the `onOpenHistory` seam the notice
  (and the existing History button) need.
- `app/src/i18n/*` — the notice copy.

## Inherited dependencies

- **`songs.reading`** — *settled, Done 2026-10-07.* The reading surface
  (`app/src/songs/SongReading.jsx`): `source`/`song` slices, the
  `fullScreen` ephemeral `useState` (`SongReading.jsx:135`), the
  `onOpenHistory({ bookId, path })` prop seam (`SongReading.jsx:118`), the
  inline `.notice` body pattern (`SongReading.jsx:401`, `:470`), and the
  full-screen branch (`SongReading.jsx:348-359`). songs.reading explicitly
  deferred this behavior to here (its Decision 4, "The updated-in-place
  behavior is sync's, deferred", and its Deferred-work register for
  `sync.read_in_place`).
- **`sync.states`** — *settled, Done 2026-10-07.* The engine ships *facts,
  not presentation* (`sync.engine` Decision 5); `sync-display.js`'s
  `syncDisplayFor` atom is the one shelf-word authority. states.md's
  Decision "song-screen sync rendering stays with the tasks that own those
  surfaces" hands the song-screen notice to this task. The dependency is
  real because this task renders a song-screen sync surface, but it does
  **not** reuse the shelf badge atom (see Decisions).
- **`sync.engine`** (transitive, via `!states`) — *settled.* The clean
  fetch→merge→push loop. `defaultMergeBook` brings the working copy to the
  merged head (`sync-engine.js:195-231`); the dirty-tree guard
  (`:173-180`, `:386-388`) defers the merge while an edit is unsaved — which
  is exactly the boundary between this task (being read) and `sync.unsaved`
  (being edited).

## What this task is

When a background sync brings a new version of the song the reader currently
has open, the open reading view updates **in place** — the chart re-renders
to the merged version while the reader keeps their place on the page — and a
non-modal inline notice appears: *updated by {name}: see what changed*, whose
action opens the song's history. If the reader is in chrome-free **full
screen**, the update is held back: the view keeps showing what it had, and
applies the update only when the reader leaves full screen. This is the clean
("being read") half of workflow 8 §"A song open while it changes"; the
"being edited under unsaved changes" half (L55-56) is already `sync.unsaved`.

## Why it needs to be done

`sync.engine` already merges and rewrites the working copy on the clean path,
but nothing re-surfaces that to an open reading view: `OPEN_SOURCE` is a
one-shot read (`logic.js` posts `SOURCE` once in reply), the `source` slice
is never re-emitted by the engine, and the per-book `SYNC` fact names no file
and no author. So today an open song silently goes stale — the reader sees
the pre-merge bytes until they re-open it. This task closes that gap for the
one surface where staleness matters most (the song someone is reading, maybe
mid-performance), delivering the workflow-8 promise and the W08 board. It is a
leaf: nothing depends on it.

## Inputs / context

Governing (normative):

- **Workflow 8 §"A song open while it changes"** —
  `docs/workflows/08-sync.md:49-56`. The three bullets: being read → in place,
  keeping the place, notice *updated by Ana: see what changed* that opens its
  history (L51-52); being read full screen → waits, updates when the user
  leaves, "The middle of a performance is the worst moment for a song to
  move" (L53-54); being edited → merged under unsaved edits — **out of scope,
  `sync.unsaved`** (L55-56). Clean-merge-without-asking context at
  `08-sync.md:42-45`.
- **Board W08** — `docs/mockups/W08-sync.dc.html`: subtitle L20; the
  *Updated by Ana* / *See what changed* notice L65, L177; the *Full screen*
  button L81; "full screen during a performance: Ana's update waits" L120,
  L125, "An update from Ana is waiting. It will show when you leave full
  screen." L155; "after leaving full screen: the update in place" L159.
- **DIRECTION §3.1** (`DIRECTION.md:127-134`) — clean merge pushed without
  asking; the unsaved-merge rule L129-131 (that is `sync.unsaved`'s).
  **§3.7** (`DIRECTION.md:405-445`): the Worker owns git/working copy/index,
  the main thread never touches IndexedDB (L418-420); the store is fed by the
  Worker's messages and components read slices through `useSyncExternalStore`
  — "A sync finishing, **a merge landing**, a clone's progress: each is a
  message, and only what shows it moves" (L421-425); the view is the only
  React layer (L426-428); "The middle of a performance is the worst moment
  for anything to move" (L438-440).
- **Mockups README** — `docs/mockups/README.md:26`: every status carried by
  a word, never colour alone.

Seams (real paths):

- `app/src/songs/SongReading.jsx` — mount reads `OPEN_SOURCE`/`OPEN_SONG`
  (`:128-133`); `source` slice read at `:144`; `fullScreen` at `:135`;
  full-screen render branch `:348-359`; `onOpenHistory` prop `:118`, invoked
  from the History button `:446-447` and the overflow menu `:372`, `:498`;
  inline notice pattern `:401`, `:470`; the scroll container `.reading-scroll`
  `:465`, `:505` and `.reading-fullscreen-scroll` `:356`.
- `app/src/worker/sync-engine.js` — `defaultMergeBook` `:195-231` (the
  pre-merge `local` head `:197`, the `checkout` to the merged head `:229`,
  the fast-forward flag `:220`); `emitFact` `:279-290`; the clean-path merge
  site `:386-398`; the dirty-tree guard `:386-388`. It already imports `log`,
  `resolveRef`, `isDescendent` (`:36-44`).
- `app/src/worker/protocol.js` — the open `kind` channel; `EventKind` at
  `:214-331`; transient-reply precedent `RESTORED`/`FILE_MOVED`
  (`:235`, `:305`); `SYNC` fact `:317-330`; `event()` builder `:341`.
- `app/src/worker/logic.js` — the engine's `emit` → `port.postMessage(event(
  EventKind.SYNC, …))` (`:511`); `OPEN_SOURCE` handler posts `SOURCE`
  (`:1214-1224`); device identity `resolveSyncAuthor` (`:537-543`); the
  `switch (message.kind)` dispatch (`:657`).
- `app/src/worker/useStore.js` — `useSlice` (`:15`) and `useWorkerEvent(
  store, kind, handler)` (`:30-43`) for transient events.
- `app/src/worker/store.js` — `subscribeEvents` for transient events
  (`:62-67`).
- `app/src/worker/history.js` — `metaOf` carries `{ commit, short, author:
  { name, email }, … }` (`:222-237`); `songLog` (`:252-297`) — the shape the
  "see what changed" link opens.
- `app/src/songs/SongHistory.jsx` — the history surface the notice opens
  (built by `songs.history`; dev mount `#dev/history` only, not yet wired
  in-shell — see Decisions).
- `app/src/shell/AppShell.jsx` — the open-song render (`:423-435`) mounts
  `<SongReading>` **without** `onOpenHistory` (it defaults to the no-op);
  the comment at `:418-422` names history a seam its owning task wires.
- `app/src/pwa/UpdateReady.jsx` — the reuse model: a non-modal
  `<div className="notice accent …" role="status">` with a `grow` message
  span and React Aria `Button` actions that never trap or steal focus
  (`:1-11`, `:31-43`). `.notice` / `.notice .act` tokens in
  `app/src/theme/theme.css:189-193`.

Test harness: `app/src/test/loopback.js` (`createLoopbackEndpoint`),
`app/src/test/git-http-remote.js` (`startGitHttpRemote`),
`app/src/test/web-locks.js` (`installWebLocks`), `fake-indexeddb`; the view
behavior precedent `app/src/songs/SongReading.behavior.test.jsx`; the Worker
behavior precedent `app/src/worker/sync-engine.behavior.test.js`; e2e-web
`e2e/web/tests/*.spec.js` with `e2e/web/lib/{axe,offline,devices}.js`.

## Constraints / requirements

- **Offline-first, Worker owns the data (DIRECTION §3.7).** The main thread
  never touches IndexedDB or git. The merged bytes are written by the engine
  inside the book lock; the view only reads re-surfaced slices and reacts to
  a message. The full-screen defer is a *main-thread view gate*, never a
  Worker slice (`SongReading.jsx:17`).
- **A merge landing is a message (DIRECTION §3.7 L423-424).** Carry the
  per-file fact on the existing open `kind` channel — no new channel, no
  reducer reshaping.
- **The view is the only React layer.** The engine ships a fact; the view
  renders the notice and composes the music core itself, as it already does.
- **No song text in logs (standing rule).** The new fact carries book id,
  path and an author display name — the same metadata `SOURCE`/`SONG`/
  `SONG_LOG` already surface — **never song text**. The engine logs nothing.
  Re-surfacing the merged text to the view is demand-driven (the view
  re-issues `OPEN_SOURCE` for its own open path), so no song text is pushed
  to the slice for songs nobody has open.
- **Canonical form over preserving content.** The merged version the engine
  wrote is canonical (`sync.engine`); the view parses and renders it as it
  parses any saved song — nothing here preserves a non-canonical spelling.
- **Accessibility (WCAG 2.1 AA).** The notice is a non-modal inline element
  with `role="status"` that must not aria-hide the chart or chrome (it must
  not interrupt a performance — `UpdateReady.jsx:1-11`; project memory
  "RAC modal aria-hides shell chrome"). React Aria `Button` for "see what
  changed"; a keyboard path to it and to leaving full screen; the state is
  carried by the words *updated by {name}*, never colour alone
  (`mockups/README.md:26`). axe clean.
- **Clean path only.** This task fires on a **clean** merge of a song the
  reader is viewing (merge commit or fast-forward). A dirty tree (an unsaved
  edit) is deferred by the engine's guard and handled by `sync.unsaved`; the
  conflict path is `sync.conflicts`. Those boundaries are not re-litigated
  here.

## Acceptance criteria

### Behavior delivered

1. **The engine announces a landed merge, per changed song file.** On the
   clean path, after `defaultMergeBook` brings the working copy to the merged
   head (merge commit **or** fast-forward), the engine computes the song
   paths whose bytes changed between the pre-merge local head and the merged
   head, and for each reads the incoming author's display name and the
   incoming commit (the newest commit touching that path reachable from the
   merged head but not from the pre-merge head). It emits a new transient
   event `EventKind.MERGED` — `{ bookId, changed: [{ path, author, commit }] }`.
   Emitted only for songbooks (the home book's key-by-key merge re-surfaces
   through `PREFERENCES`/`SHELF`/`INSTRUMENTS`, not this). Not emitted when the
   merge changed nothing, nor when the merge was deferred by the dirty-tree
   guard (that is `sync.unsaved`'s signal).
2. **A song open and being read updates in place.** When a `MERGED` event
   names the open `{ bookId, path }` and the reader is **not** in full screen,
   the view re-issues `OPEN_SOURCE` for that path (fresh merged text flows
   through the `source` slice and the chart re-renders), **keeping the place
   on the page**: the reader's scroll position is preserved across the swap
   (a scroll anchor captured before the swap and restored after the new chart
   lays out, falling back to `scrollTop`).
3. **The notice.** On that in-place update the view shows a non-modal inline
   notice *updated by {name}: see what changed* (`{name}` from the event's
   `author`), `role="status"`, in the scroll body — not a modal, not
   aria-hiding the chart. Its "see what changed" React Aria `Button` calls
   `onOpenHistory({ bookId, path, commit })`, opening the song's history. The
   notice is dismissible and does not steal focus.
4. **Full screen defers.** When the reader is in full screen, a `MERGED`
   event naming the open song does **not** swap the text or show the notice;
   the view keeps rendering what it already had (the `source` slice is not
   re-requested). The pending `{ author, commit }` is held in ephemeral view
   state; on leaving full screen (`setFullScreen(false)`) the view applies the
   deferred update — re-issues `OPEN_SOURCE`, preserves the place, shows the
   notice. Two merges while full screen collapse to the most recent pending
   update.
5. **The notice reaches history in-app.** `AppShell` wires `onOpenHistory`
   into `<SongReading>` (`AppShell.jsx:423-435`) to mount `SongHistory` for
   `{ bookId, path }` (ephemeral view state, no router, `onBack` returns to
   reading) — closing the seam songs.reading left for its toolbar
   (`AppShell.jsx:418-422`), so both the notice and the existing History
   button open history in-app.

### Tests, by level

The `.tji` `Tests:` clause names **behavior** and **e2e-web**. Both land here;
no level is dropped.

- **behavior (view)** — `app/src/songs/SongReading.behavior.test.jsx`
  (extended) or a new `app/src/songs/ReadInPlace.behavior.test.jsx`, with the
  loopback store, seeded `source`/`song`/`instruments`/`preferences` slices,
  real RAC + i18n, axe:
  - a `MERGED` event naming the open song, not full screen → the view
    re-issues `OPEN_SOURCE`, the chart shows the new version, the notice
    *updated by {name}: see what changed* renders (`role="status"`), its
    button calls `onOpenHistory` with the commit (pins workflow 8 L51-52, W08
    L65/L177);
  - full screen → no notice, no text swap on the event; leaving full screen
    applies the update and shows the notice (pins workflow 8 L53-54, W08
    L120/L155/L159; DIRECTION §3.7 L438-440);
  - a `MERGED` event for a **different** song (or book) leaves the open song
    untouched;
  - axe clean on the notice state and the full-screen state (WCAG 2.1 AA,
    `mockups/README.md:26`).
  jsdom has no layout, so "keeps the place" is asserted mechanically here (the
  scroll container's captured position is restored on swap); the visual
  guarantee is e2e-web below.
- **behavior (Worker)** — `app/src/worker/sync-engine.behavior.test.js`
  (extended), against a real git HTTP remote (`startGitHttpRemote`) with a
  second clone racing, `installWebLocks`, `fake-indexeddb`:
  - a second clone saves a new version of a song; a clean merge emits a
    `MERGED` fact naming the path and the incoming author; a fast-forward
    emits it too (pins workflow 8 L42-45, L51; DIRECTION §3.1);
  - a merge that changed nothing, and a merge deferred by the dirty-tree
    guard (an unsaved edit present), emit **no** `MERGED` fact (pins the
    boundary to `sync.unsaved`);
  - the fact carries no song text (standing rule).
- **e2e-web** — `e2e/web/tests/read-in-place.spec.js`, Playwright against the
  compose stack on phone, tablet and computer, axe WCAG 2.1 AA on each:
  - a song open in the reading view while a sync from the stack (a second
    device pushes a new version) brings it in → the chart updates in place,
    the reader's place on the page is preserved, the *updated by {name}: see
    what changed* notice appears and opens history (pins workflow 8 L51-52,
    W08);
  - the same while full screen → the update waits, then applies on leaving
    full screen (pins workflow 8 L53-54, W08 L120/L155/L159);
  - axe clean on the in-place-notice state and the full-screen state on all
    three viewports.

No new tech debt is deferred: the behavior and e2e-web levels the note names
both land in this task.

## Decisions

1. **A new transient `EventKind.MERGED` fact, not an overloaded `SYNC`
   fact.** *Chosen:* a dedicated per-file event `{ bookId, changed:
   [{ path, author, commit }] }`, carried on the existing open `kind`
   channel and observed with `useWorkerEvent` (like `RESTORED`/`FILE_MOVED`).
   *Rationale:* DIRECTION §3.7 L423-424 literally anticipates "a merge
   landing" as its own message; the per-book `SYNC` fact is presentation-free
   book state (`sync.engine` Decision 5) and overloading it with per-file
   author/commit would couple the shelf word to merge detail and reshape the
   `sync` slice. A transient event (no reducer slice) fits a one-shot signal
   the view reacts to, not state it renders from. *Rejected:* a new reducer
   slice keyed by book+path ("pending update") — more machinery than a
   one-shot needs, and it would persist a notice as state when the view
   already holds "which song is open" ephemerally.
2. **Demand-driven text re-surface: the view re-issues `OPEN_SOURCE`, the
   engine does not push `SOURCE`.** *Chosen:* the fact carries only metadata
   (path, author, commit); the view pulls fresh text for its own open path.
   *Rationale:* the Worker does not know which song is open (ephemeral view
   state, songs.reading Decision 5), so an engine-side `SOURCE` re-surface
   would push song text into the slice for songs nobody opened — against "only
   what shows it moves" (DIRECTION §3.7 L423) and needlessly widening what
   song text crosses the boundary. Demand-driven keeps the text surface
   exactly as wide as what is read. It also gives the full-screen defer its
   lever for free: the slice stays on the old bytes until the view chooses to
   re-request, so "waiting" is simply *not re-requesting yet* — no snapshot to
   hold, no risk of the Worker racing the view. *Rejected:* engine re-surfaces
   `SOURCE` for every changed path.
3. **The full-screen defer is a main-thread view gate.** *Chosen:* gate the
   re-request and the notice on the existing `fullScreen` ephemeral state;
   hold the pending `{ author, commit }` in a sibling `useState`; apply on
   exit. *Rationale:* consistent with songs.reading (`SongReading.jsx:17`:
   full screen is ephemeral view state, never a slice) and with DIRECTION
   §3.7 L438-440. The merged bytes are already durable in the Worker; nothing
   needs persisting across the defer. *Rejected:* a Worker-held "deferred for
   this book" flag — it would put a view concern (is the reader in full
   screen?) into the Worker, which cannot and must not know it.
4. **"Keeping the place" = a captured scroll anchor restored after re-layout.**
   *Chosen:* before the text swap, capture the top-most chart line in view and
   its offset within the `.reading-scroll` viewport; after the new chart lays
   out (a layout effect), scroll so that line returns to the same offset;
   fall back to preserving `scrollTop` when no anchor resolves. *Rationale:*
   the chart reflows on the merged version, so a bare `scrollTop` restore
   drifts; anchoring to a stable rendered landmark keeps the *musical* place.
   The guarantee is visual, so e2e-web is its real check; the behavior test
   pins the mechanism fires. *Rejected:* bare `scrollTop` only (drifts when the
   content above reflows) — kept only as the fallback.
5. **The incoming author is the merged-in commit's `author.name`.** *Chosen:*
   per changed path, the newest commit reachable from the merged head but not
   from the pre-merge local head, its `author.name` (the same `metaOf` shape
   history reads, `history.js:222-237`); its oid is the `commit` the notice's
   history link targets. *Rationale:* that is "who made the change" the reader
   is seeing (*updated by Ana*), distinct from the device's own
   `resolveSyncAuthor` identity. *Rejected:* the device identity (names the
   wrong person) and the merge commit's author (always "Me" — the engine makes
   the merge commit under the device identity).
6. **This task wires `onOpenHistory` into the shell.** *Chosen:* `AppShell`
   mounts `SongHistory` for `{ bookId, path }` on the seam, `onBack` returns.
   *Rationale:* the notice's "see what changed" and the reading screen's
   existing History button both need a working in-app path to history for the
   behavior/e2e to assert, and `SongHistory` already exists (`songs.history`);
   songs.reading left the wiring to "its toolbar, a sibling task"
   (`AppShell.jsx:418-422`) and no task owns it — this task, needing it,
   closes it. *Rejected:* leaving `onOpenHistory` a no-op and asserting only
   the callback fires — the e2e-web journey must land on history, so the
   wiring must exist.
7. **This task does not reuse the shelf badge atom.** *Chosen:* render the
   song-screen notice directly from the `MERGED` event, not through
   `syncDisplayFor`. *Rationale:* `syncDisplayFor` maps per-book *phase* to a
   shelf word; this is a per-file "a named person changed this song" notice
   with a history action — a different atom with different data (author,
   commit). states.md reserved the shelf atom's `kind` for extension but also
   ruled that song-screen sync rendering belongs to the task that owns the
   surface; forcing this notice through the shelf atom would bend it out of
   shape. The `sync.states` dependency stands because this task renders a
   song-screen sync surface the states work scoped to here, not because it
   reuses the shelf word.

## Open questions

(none — all decided)

## Unfinished work, and why it waited (2026-10-08)

A first implementation exists and is kept on the branch
**`wip/sync-read-in-place`** (commit 180738d): the engine's `MERGED` event, the
in-place update keeping the place, the notice opening history, the full-screen
defer, the i18n strings, and their unit and behavior tests, all passing. Only
the first of the e2e-web scenarios (the notice reaching history) was written.

**Recover it before doing anything else**, from a clean tree:

```
git cherry-pick --no-commit wip/sync-read-in-place
```

then write the missing e2e-web scenarios, and delete the branch once the task
lands (`git branch -D wip/sync-read-in-place`).

It waited because the other three e2e-web scenarios — the merge-in-place
journey, full screen deferring, and axe on those states — need a *hosted* book
on the device's shelf, and nothing could put one there until `books.online`.
The task now depends on it. With it, the journey is: the device puts a local
book online (`books.online`), and the second device is played by the git CLI
pushing a new version to that book as the same user (the e2e harness's git
helpers, with the session the device signed in with).

## Status

**Done** — 2026-10-08.

- `app/src/worker/sync-engine.js` — on the clean path after `defaultMergeBook`, computes per-file diff between pre-merge local head and merged head, reads incoming author via `metaOf`, emits transient `EventKind.MERGED` `{ bookId, changed: [{ path, author, commit }] }` per changed songbook file; fast-forward and merge-commit both covered; nothing emitted when diff is empty or merge is deferred by dirty-tree guard.
- `app/src/worker/protocol.js` — new `EventKind.MERGED` constant on the open `kind` channel, transient-event pattern (no slice).
- `app/src/worker/logic.js` — threads `bookId` into the engine so the emitted fact carries it.
- `app/src/songs/SongReading.jsx` — `useWorkerEvent(store, EventKind.MERGED, …)` reacts to the fact: when not full screen, re-issues `OPEN_SOURCE`, captures scroll anchor before swap, restores it in a `useLayoutEffect` after re-layout; when full screen, holds `pendingUpdate` `{ author, commit }`; applying on `setFullScreen(false)` exit; inline notice `role="status"` *updated by {name}: see what changed* with RAC `Button` calling `onOpenHistory({ bookId, path, commit })`; notice dismissible; `useLayoutEffect` keyed on `[text, update]` so the notice height is included in the compensation.
- `app/src/songs/reading.css` — `.reading-screen, .reading-split { max-height: 100dvh }` and `.reading-scroll { overflow-y: auto }` so the scroll container is a real bounded scroll port (the fix that makes `scrollTop` restoration work on phone).
- `app/src/shell/AppShell.jsx` — wires `onOpenHistory` into `<SongReading>`, mounting `<SongHistory>` for `{ bookId, path }` with `onBack` returning to reading; closes the seam `songs.reading` left at `AppShell.jsx:418-422`.
- `app/src/i18n/locales/{en,es-419,it,pt-BR}.js` — `readInPlaceUpdatedBy` / `readInPlaceUpdatedBySeeWhatChanged` copy for the notice.
- `app/src/songs/SongReading.behavior.test.jsx` — extended: in-place update keeps place + notice + history-open (AC 2-3, 5); full-screen defer collapses to most-recent (AC 4); different-song MERGED leaves view untouched; axe clean on notice and full-screen states.
- `app/src/worker/sync-engine.behavior.test.js` — extended: clean-merge and fast-forward emit MERGED naming path and incoming author (AC 1); unchanged merge and dirty-tree-deferred merge emit nothing (AC 1 boundary).
- `e2e/web/tests/read-in-place.spec.js` — new, 9 cases on phone/tablet/computer: in-place update + notice + history (AC 2-3, 5; W08); full-screen defer + apply on exit (AC 4; W08 L120/L155/L159); toolbar history button (AC 5); axe on all states.
