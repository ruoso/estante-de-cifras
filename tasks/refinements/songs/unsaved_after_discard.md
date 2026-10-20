# songs.unsaved_after_discard — Discarding or saving clears the unsaved badge where one returns

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) — `task unsaved_after_discard`
(line 176), in milestone `m3_service` (`tasks/99-milestones.tji:32`).

## Effort estimate

0.5d.

## Repository

The app only: `app/src/worker/` (`logic.js`, `recents.js`) and their tests,
plus one new e2e-web spec under `e2e/web/tests/`. Nothing under `cifra.md/`,
`service/` or `api/`. No design delta.

## Inherited dependencies

- `songs.save_sheet` — **settled** (complete): SAVE, DISCARD, PREVIEW_SAVE,
  the discard confirm (`app/src/songs/DiscardConfirm.jsx`) and the search
  screen's *unsaved* badge.
- Also leaned on, all complete: `storage.index` (the per-location `unsaved`
  flag, `reindexOrRemove`), `songs.search` (BROWSE, the `recents` slice,
  RECORD_RECENT), `songs.save_feedback` (SAVED posted before the re-index and
  the push, by design), `foundation.e2e_web`.

## What this task is

After *Discard changes* (or a save) the user goes back to search and the song
still wears its *unsaved* badge; a never-saved draft that was discarded still
sits in *Recent* as a row pointing at a file that no longer exists. Two Worker
fixes: after SAVE and DISCARD re-index, post `INDEX_STATUS` so every listing
re-browses (exactly what WRITE already does), and drop from the device-local
recents every location a command removed from the book.

## Why it needs to be done

Usability review 2026-10-19 finding L3, verified against the code:

- The Worker handles commands concurrently — `attachWorker` hands each message
  straight to `logic.handle` without waiting for the previous one
  (`app/src/worker/attach-worker.js:18`).
- DISCARD posts `DISCARDED` (`app/src/worker/logic.js:1956`) **before** it
  re-indexes the reverted paths (`logic.js:1957-1972`), and never posts
  anything after. The confirm closes on `DISCARDED`, the search screen mounts
  and sends BROWSE (`app/src/songs/SearchScreen.jsx:530-535`); BROWSE takes no
  lock, so it reads the index before the re-index lands and lists the song as
  unsaved. Nothing ever asks again: the screen re-browses only when the
  `index` slice moves (`SearchScreen.jsx:535`), and nothing moved it.
- SAVE has the same order: `SAVED` at `logic.js:1759-1767`, the re-index at
  `logic.js:1768-1783`, no event after. `songs.save_feedback` moved SAVED
  earlier on purpose (the save answers at once), so the race is now the
  common case, not a corner.
- WRITE already solved this hazard: after its re-index it posts
  `INDEX_STATUS { state: 'ready' }` "so a browse listing … re-reads it"
  (`logic.js:1680-1702`, the comment at 1691-1695). The reducer gives `index`
  a new reference on every `INDEX_STATUS` (`app/src/worker/reducer.js:389-411`),
  which is what re-sends BROWSE.
- Recents are only ever promoted, never pruned (`app/src/worker/recents.js`,
  `promoteRecent` and `record`). The search screen shows a recent whose
  location is not in the browse listing as a bare row (`SearchScreen.jsx:549-558`,
  title `''`), so a discarded draft lingers as a dead row in *Recent*.

Workflow 4 §Edit (`docs/workflows/04-edit-and-save.md:11-14`) promises the badge
in search lasts "until it is saved or the changes are discarded"; workflow 3
§Abandoning it (`docs/workflows/03-write-a-new-song.md:52-54`) says *Discard*
deletes a new song's file; workflow 2 (`docs/workflows/02-find-and-play.md:13-15`)
says recents are "the way back into what you were playing" — a way back to
nothing is not one.

## Inputs / context

- `app/src/worker/logic.js`
  - `reindexOrRemove` (`:939-950`) — re-index a path, or `removePath` it when
    the file is gone; the removal returns `deleteLocations: [key]`.
  - WRITE (`:1680-1702`) — the `INDEX_STATUS` precedent.
  - SAVE (`:1703-1789`) — SAVED, then the re-index, then the sync trigger.
  - DISCARD (`:1953-1974`).
  - MOVE_FILE (`:2051-2070`) and DELETE_FILE (`:2082-2095`) — the same
    "re-index without telling the views" shape, and the other commands that
    remove a song's location from the index.
  - `surfaceRecents` (`:1545-1554`) and RECORD_RECENT (`:2198-2207`) — how
    RECENTS reaches the slice.
  - The bring-up sweep (`:976-988`) calls `removeBook` for a half-cloned
    directory, and put-online re-keys via `removeBook(localId)` (`:2595`) —
    why pruning recents is **not** hooked into `persistIndexChanges`
    (Decision 3).
- `app/src/worker/search-index.js` — `removePath` (`:348-353`), `visibleChange`
  (`:321-327`).
- `app/src/worker/recents.js` — `promoteRecent`, `createRecents` (`read`,
  `record`, the serialising `writeQueue`).
- `app/src/worker/recents.behavior.test.js` — the existing behavior suite this
  task extends.
- `app/src/songs/SearchScreen.jsx:177-180` (the badge), `:530-535` (BROWSE on
  `index`), `:549-558` (recents rows).
- `app/src/songs/DiscardConfirm.jsx:42` — closes on `DISCARDED`.
- e2e-web: `e2e/web/tests/save-sheet.spec.js:67-95` and
  `e2e/web/tests/edit-and-save.spec.js:53-75` (existing discard journeys);
  `e2e/web/lib/journeys-core.js:16` `toSearch`, `:156` `createSongFromSearch`;
  `e2e/web/lib/journeys.js:171` `makeLocalBook`, `:280` `openSongFromSearch`,
  `:314` `openSongInEditor`, `:321` `typeAtEndOfLine`, `:332` `settleEdits`,
  `:349` `saveThroughSheet`; `e2e/web/lib/journeys-edit.js:49` `backToSearch`;
  `e2e/web/playwright.config.js` (the phone/tablet/computer projects).
- Predecessor refinements: `tasks/refinements/songs/save_sheet.md`,
  `tasks/refinements/songs/save_feedback.md`,
  `tasks/refinements/songs/discard_summary.md`; `songs.search`'s recents
  Decision 2 (device-local, `meta` store, no commit) quoted in
  `recents.js:1-16`.

## Constraints / requirements

1. **Event order is kept.** `DISCARDED` and `SAVED` still go out as soon as the
   working copy (and, for a save, the commit) is done — the confirm and the
   sheet close on them, and `songs.save_feedback` made SAVED early on purpose.
   The fix is an event *after* the re-index, never moving the reply later.
2. **One `INDEX_STATUS { bookId, state: 'ready', songs: songCountOf(bookId) }`
   per command, after `persistIndexChanges`,** in SAVE, DISCARD, MOVE_FILE and
   DELETE_FILE — unconditionally (Decision 2). WRITE keeps its
   `visibleChange` guard (it runs per keystroke).
3. **Recents prune only what a command removed.** The paths for which
   `reindexOrRemove` returned a removal (non-empty `deleteLocations`) in
   DISCARD, SAVE (a saved deletion), DELETE_FILE and MOVE_FILE (the `fromPath`)
   are dropped from the recents list; when the list changed, post
   `RECENTS { recents }` so the slice moves. A path that still exists (a saved
   song's discard that only reverted it) keeps its recent.
4. **Recents stay device-local and serialised.** A new `forget(db, locations)`
   on `createRecents` runs on the same `writeQueue` as `record` (a
   read-modify-write on the one `recents` key, which RECORD_RECENT can race),
   in one `meta`-store transaction. No commit, no push, no network.
5. **A pure list move for the prune**, beside `promoteRecent`:
   `dropRecents(list, locations)` — removes every entry whose
   `{ bookId, path }` matches, keeps order, returns the same array reference
   when nothing matched (so the caller can tell "changed" without diffing).
6. **No song text in logs.** Nothing new is logged; recents hold locations only.
7. Offline first: all of this is local; nothing waits on the network.
8. The view layer does not change — it already re-browses on `index` and
   re-renders on `recents`.

## Acceptance criteria

Behavior:

- After discarding an unsaved edit and returning to search, the song's row has
  no *unsaved* badge, on any timing of BROWSE against the re-index.
- After saving and returning to search, likewise.
- A never-saved draft that is discarded is gone from *Recent* as well as from
  its book's section.
- A saved song whose edits are discarded stays in *Recent*.

Tests, by level:

- **unit** — `app/src/worker/recents.test.js` (new):
  `dropRecents` removes the matching `{ bookId, path }` entries and keeps the
  rest in order; matches on both fields (same path in another book is kept);
  returns the same reference when nothing matched; tolerates a non-array list.
  Pins workflow 2 L13-15 (recents are a way back) and Constraint 5.
- **behavior** — Worker logic against a fake IndexedDB and a real book, in the
  existing suites:
  - `app/src/worker/search-index.behavior.test.js`, new cases:
    - *DISCARD posts a ready INDEX_STATUS after DISCARDED, and a BROWSE sent
      then lists the song without unsaved* — WRITE an edit to a committed song,
      DISCARD it, await `INDEX_STATUS` for the book following `DISCARDED`,
      BROWSE → the song's `unsaved` is false (workflow 4 L11-14, Constraint 1-2).
    - *A BROWSE racing DISCARD is followed by an INDEX_STATUS* — send DISCARD
      and BROWSE without awaiting between them (what the search screen does on
      mount); assert an `INDEX_STATUS` arrives after the `DISCARDED`, and a
      BROWSE sent on it reports `unsaved: false` (the L3 race, attach-worker.js:18).
    - *SAVE posts a ready INDEX_STATUS after SAVED, and BROWSE lists the song
      saved* — same shape for SAVE (workflow 4 L11-14; save_feedback's early SAVED).
    - *DELETE_FILE and MOVE_FILE post a ready INDEX_STATUS* — one case each
      (Constraint 2).
  - `app/src/worker/recents.behavior.test.js`, new cases:
    - *Discarding a never-saved draft drops it from the recents and emits
      RECENTS* — WRITE a new song's file, RECORD_RECENT it, DISCARD → a
      `RECENTS` event without it, and a re-read after a restart of the logic
      still lacks it (workflow 3 L52-54; Constraint 3-4).
    - *Discarding a saved song's edits keeps its recent* — no RECENTS change
      (Constraint 3).
    - *DELETE_FILE of a recent drops it* (Constraint 3).
    - *A forget racing a record loses neither* — RECORD_RECENT of another song
      and DISCARD of a draft sent together: the result holds the new song and
      not the draft (Constraint 4).
- **e2e-web** — `e2e/web/tests/unsaved-after-discard.spec.js` (new), on the
  phone, tablet and computer projects, through the real UI only, axe at WCAG
  2.1 AA on the search screen at each assertion point:
  - *A discarded draft leaves no badge and no recent* — `makeLocalBook`; in
    the searchbox type a title written for the purpose and press
    `Create "<title>"` (not `createSongFromSearch`, which saves), add a chord
    line (`addSection`), `settleEdits`, `backToSearch`: the row reads
    *unsaved*; open it from search (`openSongFromSearch`, which records it as
    a recent), `backToSearch`: it is under *Recent*; `editFromReading`, press
    **Discard changes** and confirm in the dialog, `backToSearch`: neither
    *Recent* nor the book's section lists the title, and
    `page.getByText('unsaved')` has count 0 (workflow 3 §Abandoning it L52-54;
    workflow 2 L13-15; workflow 4 L11-14).
  - *An edit discarded, then an edit saved, each clears the badge* — a song
    written and saved (`createSongFromSearch`), opened from search
    (`openSongInEditor`), edited (`typeAtEndOfLine`, `settleEdits`),
    `backToSearch`: its row contains *unsaved*; reopen in the editor, press
    **Discard changes** and confirm (the editor stays on the song —
    `EditSongHost.jsx:155-162`), `backToSearch`: `getByText('unsaved')` has
    count 0 and the song is still under *Recent*; edit again, save through
    the sheet (`saveThroughSheet`), `backToSearch`: count 0 again (workflow 4
    §Discarding L118-122, L11-14).
  - Runs on phone, tablet and computer (the three projects of
    `e2e/web/playwright.config.js:39-42`). All through the real UI; no
    `#dev/*` mount, no injected state.

  The behavior cases above use the existing Worker rig — fake-indexeddb, a
  `startGitHttpRemote()` clone, `createLoopbackEndpoint` over
  `createWorkerLogic` in `createStore`, `installWebLocks()`
  (`search-index.behavior.test.js:52`, `recents.behavior.test.js:33`) — and read
  BROWSE through `store.slice('browse')`. They sit beside the existing
  *re-indexes on save and drops a discarded never-saved file* case
  (`search-index.behavior.test.js:274`), which checks SEARCH but never BROWSE
  or the event after the reply.

No deferred work.

## Decisions

1. **Post `INDEX_STATUS` after the re-index, not move `DISCARDED`/`SAVED` after
   it.** Moving the reply later would also close the race for DISCARD, but
   undoes `songs.save_feedback`'s early SAVED for SAVE, and keeps the
   assumption that the only screen to worry about is the one mounted after
   the reply. `INDEX_STATUS` is the existing "listings, re-read" signal every
   listing already follows (WRITE's precedent); using it fixes the two
   commands by the same means and any listing already on screen too.
2. **Unconditional, not guarded by `visibleChange`.** WRITE guards because it
   runs per keystroke. SAVE, DISCARD, MOVE and DELETE are deliberate single
   actions that almost always change what a listing shows (the unsaved flag
   flips, or the location goes); `mergeIndexChanges` (`logic.js:330-334`) does
   not carry `visibleChange` anyway, and one extra BROWSE per user action is
   cheap. Simpler and harder to get wrong.
3. **Prune recents at the commands that remove a song, not in
   `persistIndexChanges` and not on bring-up.** Every `deleteLocations` passing
   one seam looked tidier, but `removeBook` runs for a half-cloned directory at
   bring-up and for put-online's re-key (`logic.js:984`, `:2595`); pruning
   there would empty the recents of a book that is merely loading or moving. A
   stat of every recent at bring-up was rejected for the same reason (a book
   still coming down reads as missing). The commands that delete a file are the
   places the Worker *knows* a location ceased to exist.
4. **MOVE_FILE and DELETE_FILE are in scope.** They have the identical hazard
   (re-index without telling the views) and are the other two commands that
   remove a location; leaving them would leave the same stale badge and dead
   recent one tap away. Each is a two-line change at the same seam. A moved
   song's recent is dropped, not re-pointed to the new path — re-pointing is a
   nicety with no workflow behind it, and the moved song is in its book's
   section at the new path.
5. **`forget` shares `record`'s write queue.** Both are read-modify-writes on
   the one `recents` key and the Worker handles commands concurrently
   (`recents.js` comment on `writeQueue`); a separate path would reintroduce
   the lost-entry race `songs.search` closed.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- `app/src/worker/logic.js`: SAVE, DISCARD, MOVE_FILE and DELETE_FILE post a ready `INDEX_STATUS` after their re-index (`DISCARDED`/`SAVED` still go out first), so open listings re-browse and drop the stale *unsaved* badge.
- `app/src/worker/recents.js`: new pure `dropRecents(list, locations)` and `forget(db, locations)` on the same write queue as `record`; locations a command removed leave the device-local recents, and `RECENTS` is posted when the list changes.
- Unit: `app/src/worker/recents.test.js` (`dropRecents`).
- Behavior: `app/src/worker/search-index.behavior.test.js` (5 INDEX_STATUS cases) and `app/src/worker/recents.behavior.test.js` (4 recents cases, including a forget racing a record).
- e2e-web: `e2e/web/tests/unsaved-after-discard.spec.js`, 2 journeys with axe, passing on phone, tablet and computer.
- Deviation: the second journey edits with `addSection` rather than `typeAtEndOfLine`, because `createSongFromSearch` leaves no chord line for the latter to find.
- No tech debt.
