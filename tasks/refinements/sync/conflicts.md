# sync.conflicts — Conflicts

## TaskJuggler

[`tasks/45-sync.tji:35`](../../45-sync.tji) — `task conflicts "Conflicts"`, under
`task sync`.

- `effort 4d`, `allocate team`.
- `depends !engine, foundation.e2e_web, books.add_by_link`.
- Through the parent `task sync` it also inherits `storage.working_copy`,
  `cifra_js.merge` and `foundation.e2e_api`.

Downstream, milestone [`milestones.m4_together`](../../99-milestones.tji) depends
on it directly ("merges and conflicts between people"). It is the task the other
`sync.*` refinements name as the owner of conflict resolution: `sync.engine`
halts the book and hands off here; `sync.unsaved` writes a re-apply conflict as
marked text and says "the conflict-resolution screens (keep mine / take theirs /
edit with markers / abandon) are `sync.conflicts` (workflow 9)."

## Effort estimate

4d. The deterministic merge, the marked text and `resolveMarked` already exist
(cifra.md §11, `cifra_js.merge`); the shelf word (*needs you*), the chart's
conflict mark, the editor's marker colouring, the search *conflict* badge and
the marked-text save refusal are all already-built seams. The work is the
on-engage materialisation of the in-progress merge in the Worker, the per-song
and book-level resolution surfaces, and the commit-and-push on settle — plus the
e2e-web two-device journey on three viewports.

## Repository

estante-de-cifras, app only. The note does not start with `cifra.md:`. The
cifra-aware merge it drives lives in cifra.md (`cifra_js.merge`, already Done);
this task adds no format work.

Directories / files that change:

- `app/src/worker/conflict-model.js` *(new)* — pure: maps a cifra.md merge
  `Outcome` (`conflicts`/`marked`) into the view model the screens render in
  musical terms (one entry per conflict, each side's bars/chords/values, who
  wrote each, the section/bar label), and derives which lines a conflicted
  song's reading view marks. Framework-free, unit-tested.
- `app/src/worker/conflicts.js` *(new)* — the Worker merge session: recompute
  the `Outcome` from the three blobs on engage, materialise the in-progress
  merge in the working copy, apply *keep mine* / *take theirs* / *edit* /
  *keep*-or-*delete* / *abandon*, and commit the two-parent merge and push when
  every file is settled. git/fs under the book lock.
- `app/src/worker/cifra-merge-driver.js` *(edit)* — export the per-file
  recompute helper (`merge(base, ours, theirs, { setlist })` → `Outcome`) that
  `conflicts.js` calls directly, alongside the existing driver and
  `reapplyWorkingText`.
- `app/src/worker/sync-engine.js` *(edit)* — skip a book that has an
  in-progress merge in a pass (it stays *needs you* and takes nothing new from
  sync until settled or abandoned), rather than re-fetching and re-aborting it.
- `app/src/worker/protocol.js` *(edit)* — the commands
  (`OPEN_CONFLICTS`, `RESOLVE_CONFLICT`, `ABANDON_MERGE`, `COMMIT_MERGE`) and the
  `CONFLICTS` event carrying the recomputed per-book model.
- `app/src/worker/logic.js`, `app/src/worker/reducer.js`,
  `app/src/worker/useStore.js` *(edit)* — wire the commands and a `conflicts`
  reducer slice (held in memory, recomputed; no new IndexedDB store).
- `app/src/books/BookConflicts.jsx` *(new)* — the book-level paused panel: the
  *N songs need you* notice, the *in conflict* list with *Settle*, the
  deleted-against-edited card, *came in … already here*, the held-save card and
  *abandon the merge*.
- `app/src/songs/SongConflict.jsx` *(new)* — the per-song resolver: the *Conflict
  k of n* stepper, the two cards side by side in musical terms, *keep mine* /
  *take theirs* / *edit*, and *settled so far*.
- `app/src/songs/SaveSheet.jsx` *(edit, small)* — refuse a save in a book with an
  in-progress merge with *settle the conflicts first* (distinct from the
  existing marker-line refusal).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` *(edit)* — the workflow-9 copy.
- `app/src/worker/*.behavior.test.js`, `app/src/**/*.behavior.test.jsx`,
  `app/src/worker/conflict-model.test.js`, `e2e/web/tests/conflicts.spec.js`
  *(new)* — the tests.

## Inherited dependencies

- **`sync.engine`** — Done 2026-10-07. The clean fetch→merge→push path, and the
  halt this task takes over. On a conflict the engine does `igMerge({ …,
  abortOnConflict: true, mergeDriver })` (`sync-engine.js:316`), which leaves
  HEAD at *ours*, retains the fetched `refs/remotes/origin/main`, throws
  `SyncConflictError`, emits `EventKind.SYNC { phase: 'needs_you' }` and stops
  retrying that book (`sync-engine.js:508-511`, `:590-593`). It persists **no**
  `Outcome` — engine.md Decision: "`sync.conflicts` recomputes the `Outcome` via
  the byte-deterministic `merge` when the user engages." This task owns that
  recompute, the materialisation and the resolution.
- **`foundation.e2e_web`** — Done. `e2e/web/`: Playwright on phone/tablet/
  computer, the axe fixture (WCAG 2.1 AA on every screen a test visits), offline
  mode, and the two-browser-context / two-account helpers the two-device journey
  needs.
- **`books.add_by_link`** — Done. An invitation clones a hosted book as editor
  (and *mine on Estante* puts a book on a second device of one account). It
  depends on `books.online` and `service.sharing`, so the whole hosted-shared-
  book world — a book online, a second member, a second device pushing — is
  available to drive the e2e journey.
- **`cifra_js.merge`** (through `task sync`) — Done 2026-10-05 (cifra.md
  `47a635e`). `merge(base, ours, theirs, { setlist }) → Outcome` with
  `conflictsJson`, `resolveMarked` and `mergeOutputs`, exported from
  `cifra.md/js/src/index.js:118` and published as `cifra-md`. The conflict model,
  the marked text and side-resolution this task renders and applies.

## What this task is

When the cifra-aware merge cannot settle a book alone, the book is *paused*:
whoever synced second meets the conflict, settles it one piece at a time in
musical terms, and the resolved merge is committed and pushed. This task builds
that. On engaging a book the sync engine left reading *needs you*, the Worker
**recomputes** the merge (it is byte-deterministic — nothing was stored) and
**materialises** it as a real in-progress merge: everything that merged cleanly
lands in the working copy so the rest of the book carries on; each conflicted
song stays at the user's own version, with its conflicted places marked. A song
in conflict opens its conflicts one at a time — two bars or two diagrams side by
side, named *yours* and *Ana's* — and offers *keep mine*, *take theirs*, or
*edit* (the text with git's markers, in the editor). *Deleted on one side,
edited on the other* offers *keep the song, with the edits* or *delete it*. A
save in the book is held until the conflicts are settled. When the last conflict
in the book is settled the merge is committed — listed in history as *merged,
with your resolution* — and pushed; *abandon the merge* instead puts the book
back as it was before the sync, the incoming changes waiting for the next one.

## Why it needs to be done

`sync.engine` deliberately stops at the conflict: it halts the book, emits
*needs you* and persists nothing, because resolution is a shape this task owns.
Without this task a book that hits a conflict is stuck reading *needs you*
forever — it never takes another incoming change and the user has no way to
settle it. It is the last piece of the two-people sync story (milestone
*M4: Together*): invitations and sharing let two people edit one book, and this
is what happens when their edits collide. It is reached from sync (workflow 8)
and, later, from merging an upload (workflow 7).

## Inputs / context

**Normative:**

- **Workflow 9** — [`docs/workflows/09-conflicts.md`](../../../docs/workflows/09-conflicts.md),
  the whole document (Status: decided):
  - *What can conflict* (L13-24): the chart, a voicing, a property, a song
    deleted one side and edited the other, a non-song file (git's line merge).
  - *Meeting one* (L26-33): whoever syncs second meets it; the book shows *needs
    you*; each song in conflict carries a *conflict* badge in search; **until it
    is settled the song shows the user's own version, with the conflicted places
    marked**.
  - *The rest of the book carries on* (L38-45): everything that merged cleanly is
    already in the working copy; reading and editing go on everywhere; **saving
    asks the user to settle the conflicts first**, since a save mid-merge would
    be folded into it.
  - *Settling one* (L48-67): conflicts one at a time, each as the two versions
    side by side in musical terms, named *yours* / *Ana's*; *keep mine*; *take
    theirs*; *edit* opens the text with `<<<<<<<` / `=======` / `>>>>>>>` where
    the sides differ, and *save refuses while a marker line remains, and points
    at it*; deleted-vs-edited is *keep the song, with the edits* or *delete it*,
    keeping first; a non-song file is settled in the file view (workflow 14).
  - *When every conflict is settled* (L69-70): committed, listed in history as
    *merged, with your resolution* (workflow 6), and pushed.
  - *Leaving one* (L73-78): a conflict can wait indefinitely; the book stays
    *needs you* and receives nothing new meanwhile; **abandon the merge** puts
    the book back as before the sync, the incoming changes waiting.
  - *Later* (L80-87): *keep both* (a voicing into a new variation; a song beside
    it as `<name>-ana.cifra.md`) — "Both can be done by hand with *edit* in the
    meantime." Deferred (see Acceptance / Decisions).
- **Workflow 8** — [`docs/workflows/08-sync.md`](../../../docs/workflows/08-sync.md):
  the shelf states incl. *needs you* (`:26-38`); *Merging* (`:40-47`) — "what
  does not merge cleanly is workflow 9".
- **Workflow 4** — [`docs/workflows/04-edit-and-save.md`](../../../docs/workflows/04-edit-and-save.md)
  `:54-56`: a marked/unreadable line stops the save — the boundary that keeps a
  marked text from being committed or pushed.
- **DIRECTION §2.2 Merging** — [`docs/DIRECTION.md:94-101`](../../../docs/DIRECTION.md):
  "What genuinely collides becomes a conflict the app shows in musical terms
  (workflow 9). Its *edit* option writes git's conflict markers into the text
  for the user to edit away, and a text holding them is never canonical, so it
  is never saved or pushed."
- **DIRECTION §3.1 Sync** — [`docs/DIRECTION.md:127-134`](../../../docs/DIRECTION.md).
  **§3.7 The app** — [`docs/DIRECTION.md:417-431`](../../../docs/DIRECTION.md):
  the Worker owns git, the working copy and the index; the main thread never
  touches IndexedDB; the view mirrors the Worker through messages; the source
  editor is CodeMirror 6, which colours conflict markers.
- **Mockup board W09** —
  [`docs/mockups/W09-conflicts.dc.html`](../../../docs/mockups/W09-conflicts.dc.html),
  four screens with real copy:
  - Phone, *Conflict 1 of 2* (L25-93): appbar *conflict* badge; stepper
    *Conflict 1 of 2* with *Previous/Next conflict*; heading *Primeira parte,
    bar 5* + "You and Ana both changed this bar."; two `card pad` with a one-bar
    chart + a chord diagram each, labelled *Yours* / *Ana's*; action row *Keep
    mine* / *Take theirs* / *Edit*; notice "Until you settle it, Carinhoso reads
    as your version, with the places in conflict marked."; the full song preview
    below with the disputed bar carrying `mark-conf` (L318).
  - Phone, *Conflict 2 of 2* — a voicing (L95-138): heading *The shape for G7*,
    "Guitar · E A D G B E · main variation"; two `ChordBox` diagrams *Yours* /
    *Ana's*; stacked `btn block` *Keep mine* / *Take theirs* / *Edit*; hint "To
    keep both shapes, choose Edit and put Ana's in a variation of its own." (the
    *Later* keep-both, by hand); *Settled so far* card recording conflict 1.
  - Tablet, *Edit* with markers + Save refusing (L143-177): monospaced editor
    with `mk` marker lines; error notice "**Not saved.** Line 10 is still a
    conflict marker…" with a *Go to line 10* link; a *Reading the markers*
    legend.
  - Computer, the book *needs you*; the rest carries on (L180-256): sidebar book
    *Choros da Ana* badge *needs you*; book notice "**2 songs need you.** …this
    book takes nothing new from sync until these are settled."; *in conflict*
    list with *Settle*; the *Brejeiro* deleted-against-edited card with *Keep the
    song, with the edits* / *Delete it*; *came in from Ana, already here*; the
    *Saving in this book* card with a disabled *Save Doce de Coco* and "unsaved …
    safe as they are … until then"; the *Not now* card with *Abandon the merge*.
- **Mockup decisions** — [`docs/mockups/README.md:24-26`](../../../docs/mockups/README.md):
  "Only the raw source editor is monospaced" (so the per-song diffs render as
  proportional bar charts, the *edit* view is the sole monospaced surface);
  "Every status badge carries a word, never colour alone."
- **cifra.md §11.12** — [`/home/ruoso/devel/cifra.md/spec/11-merge.md`](/home/ruoso/devel/cifra.md/spec/11-merge.md):
  - §11.12.1 *The conflict model* (L925-977): the `Outcome`/`Conflict` structure
    and the kinds — song: `file`, `unresolved`, `title`, `property`, `reading`,
    `heading`, `chart`, `sections`, `voicing`, `variation`, `block`,
    `block-notes`; setlist: `title`, `property`, `item`, `text`, `entry`,
    `notes`. L969-976: **"These are the conflicts an application presents in
    musical terms: a stretch of chart with each side's bars, a shape for one
    chord in one tuning and variation with each side's diagram, a property with
    each side's value, a section or a block one side deleted."**
  - §11.12.2 *The marked text* (L978-1033); §11.12.3 *Marker lines* (L1035-1056)
    — a line of exactly seven `<`, `=`, `>` or `|`; a text holding one is never
    canonical and a writer must refuse to save it; §11.12.4 *Resolving*
    (L1058-1076): "offers *keep mine* and *take theirs* as resolution by one side
    and *edit* as resolution by editing the marked text" — `file`/`unresolved`
    have no region; §11.12.5 *As JSON* (L1078-1110).

**Code seams:**

- `app/src/worker/sync-engine.js` — `SyncConflictError` (`:56`), `isMergeConflict`
  (`:98`), `defaultMergeBook` with `abortOnConflict: true` (`:295-324`), the
  `needs_you` emits (`:508-511`, `:590-593`), `syncSongbook` (`:542`), `pass`
  (`:651`). `headOf`/`originHeadOf` (`:141-157`) give *ours* and the retained
  *theirs* refs.
- `app/src/worker/cifra-merge-driver.js` — `createCifraMergeDriver` (`:43`); the
  `Outcome` mapping (`:57-63`); `reapplyWorkingText` (`:98`) — the precedent for
  calling `merge` directly, outside git's tree walk, and the
  `{ text, conflict, marked, deleted }` mapping.
- `app/src/worker/canonicalise.js` — `firstMarkerRefusal` / `markerLines`
  (§11.12.3) (`:42-46`): the marker-line save refusal, already wired into the
  save path; and `MarkedTextError` from the §8 writer.
- `app/src/sync-display.js` — `syncDisplayFor` (`:69`), `needs_you → "needs you"`
  (`:89-90`), `OUT_OF_STEP` (`:28`): the shelf word (`sync.states`); this task
  reads the same `sync` slice to know a book is *needs you*.
- `app/src/songs/SearchScreen.jsx` — `Badges` (`:167`), `item.conflict → badge
  conflict dot` with `t('search.conflict')` (`:183-186`): the per-song *conflict*
  badge seam this task feeds.
- `app/src/chart/Chart.jsx:36` — the `mark-conf` conflict background; the
  reading view marks a conflicted song's disputed bars.
- `app/src/editor/cifra-syntax.js` — `isMarkerLine`, the `mk` marker highlight
  (`:31`, `:73`): CodeMirror already colours `<<<<<<<` / `=======` / `>>>>>>>`
  for the *edit* view.
- `app/src/songs/SaveSheet.jsx:65-72, 170-172` — the `SAVE_REFUSED` backstop and
  the `est-save-refused` notice.
- `app/src/worker/protocol.js` — `EventKind.SYNC` (`:400-413`), the open
  `{ v, dir, kind, payload }` envelope, `event()` (`:341`); `reducer.js` `sync`
  slice; `useStore.js` `useSlice`/`useWorkerEvent`.
- `app/src/worker/locks.js:61` — `withLock(bookId, fn)`: the materialisation,
  every resolution and the commit run inside the book's one Web Lock.

**Test harness:**

- `app/src/test/git-http-remote.js` — `startGitHttpRemote`, `advanceRemote`
  (advance a bare repo via the host `git` CLI) to make the colliding incoming
  commit; `app/src/test/loopback.js` (`createLoopbackEndpoint`),
  `app/src/test/web-locks.js`, `fake-indexeddb`.
- `e2e/web/lib/{offline,axe,devices}.js` and the two-context / two-account
  helpers; templates `e2e/web/tests/books.spec.js`, `sync-states.spec.js`.
- Memory to honour: a resolution overlay must not aria-hide the chart/shell
  ([[rac-modal-aria-hides-shell-chrome]]), and any React Aria overlay needs its
  portal inside `.est` ([[rac-overlays-portal-outside-est-theme-root]]).

## Constraints / requirements

- **The Worker owns git, the working copy and the index** (DIRECTION §3.7). All
  of recompute, materialise, resolve, commit and push run in the Worker under
  the book lock; the view is a mirror fed by messages and never touches
  IndexedDB or git. The conflict model is recomputed, not stored — **no new
  IndexedDB store, no migration** (engine.md's rejected "conflict store").
- **A marked text is never canonical, so never saved or pushed** (project rule;
  DIRECTION §2.2; §11.12.3). The commit on settle canonicalises each resolved
  file and refuses (does not commit) if any file still holds a marker line —
  through the format's own `markerLines`/§8 writer (`canonicalise.js`), never a
  re-implemented scan. A save in a book with an in-progress merge is refused
  outright.
- **Recompute is byte-deterministic.** The model and the marked text come from
  `merge(base, ours, theirs, { setlist })` where `base` is the merge base of the
  local HEAD and the retained `refs/remotes/origin/main`, `ours` the local HEAD
  blob (left by `abortOnConflict`), `theirs` the fetched origin blob. *keep mine*
  / *take theirs* are `resolveMarked(marked, 'ours' | 'theirs')`; *edit* writes
  any lines. This mirrors the app merge and the Go `git-merge-cifra` driver,
  held equal by the merge corpus — no second implementation (project rule).
- **Status by a word, never colour alone** (mockup README): the book carries
  *needs you*, each song *conflict*, each diff names *yours* / *Ana's*; the
  reading-view mark and the error notices pair their colour with text.
- **Accessibility** (every UI task): React Aria Components for every interactive
  part; the *Previous/Next conflict* stepper, *keep mine* / *take theirs* /
  *edit* / *settle* / *abandon* and the deleted-vs-edited choice all reachable
  and operable by keyboard; axe clean at WCAG 2.1 AA on every conflict screen;
  overlays keep the chart/shell reachable and portal inside `.est`.
- **No song text in logs** (project rule): the Worker logs no song text, no
  conflict content, no commit message; test songs are written for the purpose.
- **Offline first**: settling a conflict is a local operation; only the final
  commit's push waits on the network. If the push cannot go up the merge is
  committed locally and waits (*saves waiting*), like any save (workflow 8).
- **The middle of a performance is the worst moment for a song to move**
  (DIRECTION §3.7; read_in_place precedent): materialising the in-progress merge
  does not move a song being read full screen until the reader leaves, the same
  defer `sync.read_in_place` established.

## Acceptance criteria

The task delivers:

1. **On engage, the in-progress merge is materialised.** Opening a book the
   engine left *needs you* recomputes the merge and writes every clean-merged
   file into the working copy (the rest of the book carries on, shows the
   incoming changes, and stays readable/editable), leaves each conflicted song at
   *ours* in the working copy (the user's own version), records which songs
   conflict and their recomputed models, and marks the book as having an
   in-progress merge. The engine then skips that book each pass until it is
   settled or abandoned.
2. **The conflict model in musical terms.** Each song's conflicts are presented
   one at a time, each the two sides side by side: a `chart` conflict as the
   disputed bars rendered per side; a `voicing` conflict as the two chord
   diagrams for the one chord in its tuning/variation/key; a `property`/`title`
   conflict as the two values; named *yours* and *Ana's* (the incoming author).
   A conflicted song's reading view marks its disputed lines (`mark-conf`).
3. **Settling.** *keep mine* and *take theirs* resolve a song's current conflict
   by one side (`resolveMarked`); *edit* opens the song's marked text in the
   editor and *save* refuses while a marker line remains, pointing at it; a
   *deleted on one side, edited on the other* (`file`) conflict offers *keep the
   song, with the edits* or *delete it*, keeping first; a non-song file is
   settled in the file view with *keep mine* / *take theirs* / *edit*. A save in
   the book is refused with *settle the conflicts first* while the merge is in
   progress.
4. **Committing.** When the last conflict in the book is settled, the two-parent
   merge (parents: local HEAD and origin/main) is committed — each file
   canonical, refused if any marker line remains — listed in history as *merged,
   with your resolution* (workflow 6), and pushed (offline-tolerant).
5. **Abandoning.** *abandon the merge* resets the book to exactly before the
   sync (working copy back to *ours*, the in-progress merge and the retained
   incoming ref dropped), clears *needs you*, and leaves the incoming changes to
   be merged at the next sync; the user's other books are unaffected.

Tests it lands with (the note names unit, behavior, e2e-web):

- **unit** — `app/src/worker/conflict-model.test.js`: the pure mapper from a
  cifra.md merge `Outcome` to the view model, one case per kind the screens draw
  — `chart` (each side's bars), `voicing` (each side's diagram, with its
  tuning/variation/key), `property`/`title` (each side's value), `file`
  (deleted-vs-edited) — plus deriving the conflicted-line set a reading view
  marks, and the ordering/labels (*yours* first, the incoming author for
  *theirs*). Pins §11.12.1 and workflow 9 §Settling one. Fed fixed `Outcome`s
  (fake songs written for the purpose); no git, no React.
- **behavior (Worker)** — `app/src/worker/conflicts.behavior.test.js`: the merge
  session over a real local git remote (`git-http-remote`) and a fake IndexedDB
  with a second clone that pushed a colliding change — materialise (clean files
  land, conflicted songs stay at *ours*, the book reads *needs you* and the
  engine skips it); *keep mine* / *take theirs* / *edit* each produce the right
  working text; a *deleted-vs-edited* kept and deleted; **save refused mid-merge
  (`settle the conflicts first`) and refused on a remaining marker line**; the
  two-parent commit on settle canonical and pushed; *abandon* restores the
  pre-sync state. Pins workflow 9 §§The rest/Settling/When every/Leaving,
  DIRECTION §2.2.
- **behavior (view)** — `app/src/songs/SongConflict.behavior.test.jsx` and
  `app/src/books/BookConflicts.behavior.test.jsx`: the per-song resolver (the
  *Conflict k of n* stepper, the two musical-terms cards, *keep mine* / *take
  theirs* / *edit*, *settled so far*) and the book-level paused panel (the *N
  songs need you* notice, the *in conflict* list and *Settle*, the deleted-vs-
  edited card, the held-save card, *abandon the merge*), each with Testing
  Library, a loopback store double, real React Aria + i18n, the keyboard path
  through every action, and axe clean. Pins workflow 9 and the W09 board copy.
- **e2e-web** — `e2e/web/tests/conflicts.spec.js`: two browser contexts of two
  accounts on the compose stack sharing one hosted book (owner puts a book online
  and invites an editor — `books.online` + `books.add_by_link`); both edit the
  same bar and push; the device that syncs second shows *needs you*, the rest of
  the book readable; the conflict settled **each way** — one run *keep mine*, one
  *take theirs*, one *edit away the markers*, and one *abandon* — the resolved
  merge pushed and fetched back by the first device; on phone, tablet and
  computer, with axe on every conflict screen; the second device's colliding
  push may be driven from its browser context or the git CLI as that account.
  Pins workflow 9 end to end.

- **Deferred:** the dedicated *keep both* affordances (workflow 9 §Later — a
  voicing into a new variation named for the other person; a song written beside
  it as `<name>-ana.cifra.md`) are **not** in this task; workflow 9 says they are
  done by hand with *edit* in the meantime, which this task delivers. Deferred to
  `sync.keep_both` (app; ~2d; "keep-both resolution — theirs into a new variation
  for a voicing, a `<name>-other.cifra.md` sibling for a song; workflow 9 §Later;
  Tests: behavior (each keep-both against a local remote; axe), e2e-web (keep
  both a voicing on the three viewports; axe)"; milestone `m4_together`). The
  closer registers it in the WBS.

## Decisions

- **Recompute and materialise on engage; persist no conflict store.** *Chosen:*
  the engine's halt leaves exactly what a deterministic recompute needs (HEAD at
  *ours*, the incoming ref retained); on engaging the book the Worker re-runs
  `merge` for the files both sides changed, writes clean results and the one-
  sided changes into the working copy, keeps conflicted songs at *ours*, and
  holds the recomputed models in memory. *Rejected:* persisting the `Outcome`
  (engine.md already rejected a conflict store — redundant state for a
  deterministic function); and materialising eagerly inside the engine's pass
  (it would move the working copy of a book the user has not opened, against
  §3.7's "only what shows it moves", and complicate the engine, which is kept to
  the clean path). *Rationale:* one owner of merge materialisation (this task),
  the engine unchanged but for a skip guard, and the on-disk truth is git's own
  (the working copy + the retained ref), not a bespoke store.
- **The reading view shows *ours* with disputed places marked; the marker text
  is only the *edit* view.** *Chosen:* a conflicted song reads as the user's own
  canonical version, its disputed bars drawn with `mark-conf` from the conflict
  model; `<<<<<<<` markers appear only when the user chooses *edit*, in
  CodeMirror. *Rejected:* showing the marked text as the song (a puzzle, not a
  song — workflow 9 L35-37 is explicit). *Rationale:* someone opening a song
  mid-lesson gets a playable chart.
- **keep mine / take theirs = `resolveMarked(marked, side)`; edit = the marked
  text in the editor; the §8 writer is the single gate on canonicality.**
  *Chosen:* reuse the format's own side-resolution and marker-line scan
  (`canonicalise.js` → `markerLines`/`MarkedTextError`), never a re-implemented
  parser. *Rationale:* §11.12.4 defines resolution exactly this way, and the app
  must agree with the Go driver byte for byte via the corpus.
- **Deleted-against-edited keeps first.** *Chosen:* a `file` conflict offers
  *keep the song, with the edits* (primary) and *delete it*, matching workflow 9
  L62-64 ("keeping first, since a deletion is the easier one to make again"); it
  has no region, so it is not a side-resolution of marked text but a choice of
  which tree entry survives. *Rationale:* workflow decision; a lost song is
  costlier than a redone deletion.
- **A book with an in-progress merge is paused: the engine skips it and a save is
  refused.** *Chosen:* a small `sync-engine.js` guard skips a book whose merge is
  in progress (it keeps reading *needs you* and takes nothing new), and the save
  path gains a *settle the conflicts first* refusal distinct from the marker-line
  one. *Rejected:* letting the engine keep re-fetching and re-aborting the book
  each pass (churn, and it would fight the materialised working copy).
  *Rationale:* workflow 9 L38-45 — the merge is book-wide and nothing new comes
  in until it is settled.
- **Abandon = reset to pre-sync.** *Chosen:* restore the working copy to *ours*,
  drop the in-progress merge and the retained incoming ref, clear *needs you*;
  the next sync re-fetches and re-attempts the merge. *Rationale:* workflow 9
  L77-78 verbatim; the retained ref is a cache, not state to keep.
- **No new workflow or spec change (no design delta).** Workflow 9 is decided,
  DIRECTION §2.2 and cifra.md §11.12 settle the model and resolution, and
  `sync.engine` already anticipates this handoff. Nothing here deviates from a
  governing document or adds a dependency or seam beyond the planned ones.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-13.

- Worker merge session: `app/src/worker/conflict-model.js` (new — pure mapper from cifra.md `Outcome` to musical-terms view model per §11.12.1); `app/src/worker/conflicts.js` (new — engage/materialise/keep-mine/take-theirs/edit/deleted-vs-edited/abandon/commit-and-push under the book lock); `app/src/worker/cifra-merge-driver.js` (exports `recomputeMerge`); `app/src/worker/sync-engine.js` (in-progress-merge skip guard); `app/src/worker/protocol.js` (4 commands: `OPEN_CONFLICTS`, `RESOLVE_CONFLICT`, `ABANDON_MERGE`, `COMMIT_MERGE`; `CONFLICTS` event); `app/src/worker/reducer.js` (`conflicts` slice + fold); `app/src/worker/logic.js` (`ensureConflicts`, 4 command cases, mid-merge SAVE refusal).
- View: `app/src/songs/SongConflict.jsx` + `app/src/songs/song-conflict.css` (new — per-song resolver: *Conflict k of n* stepper, two musical-terms cards, *keep mine* / *take theirs* / *edit*, *settled so far*); `app/src/books/BookConflicts.jsx` + `app/src/books/book-conflicts.css` (new — book-level paused panel: *N songs need you*, in-conflict list, deleted-vs-edited card, held-save card, *abandon the merge*); `app/src/songs/SaveSheet.jsx` (mid-merge save refusal); `app/src/shell/AppShell.jsx` (route a *needs you* book → OPEN_CONFLICTS + both panels); `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` (workflow-9 copy). Fix: `app/src/books/BooksScreen.jsx` (row-open routes a `needs_you`-phase book to `onOpenBook`); `app/src/songs/SongConflict.jsx` (`value`/`onChange` on `<TextField>`, not the bare `<TextArea>`, so `onChange` yields a string).
- Tests: `app/src/worker/conflict-model.test.js` (unit — 8 cases); `app/src/worker/conflicts.behavior.test.js` (behavior — 7 cases); `app/src/songs/SongConflict.behavior.test.jsx` (behavior — 6 cases); `app/src/books/BookConflicts.behavior.test.jsx` (behavior — 4 cases); `app/src/songs/SaveSheet.behavior.test.jsx` +1 case (9 total); `e2e/web/tests/conflicts.spec.js` (e2e-web — 4 tests × 3 viewports: phone/tablet/computer).
