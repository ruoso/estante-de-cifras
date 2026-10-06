# history — History of a song

## TaskJuggler entry

Defined in [`tasks/60-songs.tji`](../../60-songs.tji) as `songs.history`:

```
depends storage.history, cifra_js.diff
```

> The list with unsaved changes first, a version read as it was, compare with
> now, show the text, restore. Workflow 6. Tests: behavior (unsaved changes
> first, a version read as it was, compare, show the text, restore; axe);
> e2e-web (a song's history on the three viewports, offline, a version restored
> and saved; axe).

## Effort estimate

**3d** (as scoped in the `.tji`), allocated `team`. The data layer is already
built and tested by `storage.history`, so the three days are view work: the
history surface (list + version detail, responsive), the restore-asks-first
dialog, the line-diff for *show the text*, and the parse-and-diff assembly that
turns committed version texts into musical summaries — plus the behavior and
e2e-web tests.

## Repository

**estante-de-cifras** only. Touched directories:

- `app/src/songs/` — the history surface, the restore confirm, the shared diff
  rows, the two pure helpers, and their unit/behavior tests.
- `app/src/App.jsx` — a `#dev/history` dev mount, mirroring `#dev/editor`.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — a new `history.*` section.
- `e2e/web/tests/` — the e2e-web journey.

**Not a `cifra.md:` task.** The work only *consumes* the cifra.md library: it
imports `parse` and `diff` from the `cifra-md` package (already a dependency,
used by the editor and the save sheet) and calls them in the view, exactly as
the editor does for its preview. It writes no format code. The app and the
service share no code (DIRECTION §3.6).

## Inherited dependencies

- **`storage.history`** — *settled, Done 2026-10-05*
  ([`tasks/refinements/storage/history.md`](../storage/history.md)). Ships the
  entire Worker/protocol/reducer substrate this task consumes, already handled
  in `app/src/worker/history.js` and wired through the store:
  - `CommandKind.SONG_LOG {bookId, path}` → `EventKind.SONG_LOG` → the
    `history[bookId][path].entries` slice (`app/src/worker/protocol.js:43-48`,
    `157-160`; `logic.js:735`; `reducer.js:49-57,184-263`). Each entry is
    `{ commit, short, parents, isMerge, author: {name, email}, timestamp,
    timezoneOffset, message, path, resolution }`, where `path` is the song's
    path **at that commit** (renames followed, `log({ follow: true })`) and
    `resolution: true` flags a merge kept because the song differs from every
    parent (the only merge that becomes an entry).
  - `CommandKind.READ_VERSION {bookId, path, commit}` → `EventKind.VERSION
    {bookId, path, commit, text}` → cached in `history[bookId][path].versions[commit]`
    (`logic.js:745`; `reducer.js` VERSION fold). UTF-8 verbatim bytes of the
    blob at that commit.
  - `CommandKind.RESTORE_VERSION {bookId, path, commit, fromPath}` →
    `EventKind.RESTORED {bookId, path}`, which bumps a monotonic
    `history[bookId][path].restored` token (`logic.js:760`;
    `reducer.js` RESTORED fold). Restore writes the historical blob into the
    **current** working-copy path uncommitted — it does **not** commit,
    canonicalise, or push; the restored copy is then unsaved, to be saved as a
    new version (`app/src/worker/history.js:22-34`).
  - `READ_VERSION`/`RESTORE_VERSION` must be sent with the **entry's historical
    `path`** as `fromPath` so a renamed song restores correctly.
  - The refinement states explicitly (`storage/history.md:100-106,354-362`) that
    the unsaved-changes-first entry, *compare with now*, and the per-version
    musical summary are **this task's** job: `history.js` returns raw bytes and
    commit metadata only; the UI calls `cifra_js.diff` itself and derives the
    unsaved entry from working-copy state.
- **`cifra_js.diff`** — *settled, Done*
  ([`tasks/refinements/cifra_js/diff.md`](../cifra_js/diff.md)). Ships
  `diff(before, after) → { changes, summary }` in the `cifra-md` package
  (`app/node_modules/cifra-md/src/diff.js`), over two **parsed song models**
  (the output of `parse`, not raw text). `changes` is an ordered array of
  `{ kind, op, where, before, after, text }` (`kind` ∈
  `title|property|section|chord|words|voicing`, `op` ∈
  `added|removed|changed|renamed|reordered`); `summary` is the records' neutral
  English `text` joined with `"; "`. The app already renders these records with
  the pure, localized `renderChange(change, t)` (`app/src/songs/render-change.js`),
  whose header comment names *songs.history's version previews* as a planned
  consumer.

Both predecessors are Done; nothing here is pending.

## What this task is

From a song, *history* opens a surface that lists the song's versions newest
first — each with the note it was saved with, who saved it, when, and a summary
of what changed in musical terms — with the current unsaved changes pinned as
the first entry when there are any. Opening an entry shows the song as it was
then (the rendered chart), beside the musical diff from the version before it,
with *show the text* for the line diff of the file and *compare with now* for
the diff against the working copy. *Restore this version* writes the chosen
version into the working copy to be saved as a new one; when the working copy
already holds unsaved changes it asks first, showing what would be lost, the way
discard does. Everything works offline, because every book is a full clone.

This is purely view-layer wiring: the Worker data layer (`SONG_LOG`,
`READ_VERSION`, `RESTORE_VERSION`, the `history` slice and the `restored`
handshake) is already built and tested by `storage.history`, and `cifra_js.diff`
+ `renderChange` already render musical change records in the save sheet. No
Worker protocol, reducer, or logic change is needed.

## Why it needs to be done

Workflow 6 is one of the local-first milestone's screens: `songs.history` is a
direct dependency of **M2 (`m2_local`)** in
[`tasks/99-milestones.tji`](../../99-milestones.tji) — "find, read, write,
edit, arrange, history … installed and offline." Without it the song's git log
exists only as raw Worker replies with no way to see it, compare versions, or
go back. It is also where `cifra_js.diff`'s summaries and the `render-change.js`
renderer earn their second consumer, and it is the song-facing complement to the
file view's plain line-diff lens over the same log (DIRECTION §4, workflow 14).

## Inputs / context

### Governing design

- **Workflow 6** — [`docs/workflows/06-history.md`](../../../docs/workflows/06-history.md),
  decided end to end:
  - *The list* (L11-37): from the reading view, versions newest first; each
    entry gives the note (workflow 4), **who** (the author's name, or *you* for
    the user's own saves — recognised by the host-account email, or the name
    given before sign-in), **when**, and the musical **summary**. **Unsaved
    changes are the first entry** when present: *unsaved, on this device*.
    **Merges are not entries**, except a merge whose resolution changed the song
    (workflow 9), listed as *merged, with your resolution*. **Renames are
    followed** — the list starts where the song did.
  - *A version* (L39-51): opening an entry shows the song as it was, to be read,
    beside what changed from the version before. The diff is the musical summary
    by default; *show the text* gives the line diff of the file. Each version is
    compared with the one before it; one other comparison, **compare with now**,
    is offered. Comparing two arbitrary versions is not built at first.
  - *Restoring* (L53-62): *restore this version* writes it into the working copy
    to be saved as a new version; **history is never rewritten**. When the
    working copy holds unsaved changes, restoring asks first and shows what would
    be lost, as discard does. A **whole** version is restored, not part of one.
  - *Deleted songs* (L63-68): out of scope here — a deleted song is not in search
    and has no song view to open history from; it is recovered in the file view
    (workflow 14).
  - *Later* (L70-74): **restoring part of a version** is explicitly deferred.
- **DIRECTION §3.7** (`docs/DIRECTION.md:394-434`): the view is the only layer
  that knows React; a Web Worker owns git, the working copy and the index, and
  the main thread never touches IndexedDB; the main-thread store is fed by the
  Worker's messages and components read slices through `useSyncExternalStore`;
  "framework-free below the view — the music core and cifra.md for JavaScript
  know nothing of React" (L415-417); charts are drawn by the app.
- **DIRECTION §3.1–3.2** (`docs/DIRECTION.md:127-151`): sync is fetch/merge/push,
  a merge joining two people's changes makes a merge commit; personal state
  (transpose, variation, shapes) lives in the home book, **not** in a song's
  history — the song log is authored musical content only.
- **DIRECTION §4** (`docs/DIRECTION.md:454-458`): "Song history, in the song's
  own view, is the same log seen through the format: a diff in musical terms …
  Restoring an old version writes it into the working copy, to be saved as a new
  one; history is never rewritten." The plain-line-diff / file-status lens is the
  file view's (workflow 14), a separate task.

### The mockup (what the drawings decide)

[`docs/mockups/W06-history.dc.html`](../../../docs/mockups/W06-history.dc.html),
board *Workflow 6 — History*. Real copy and states to match:

- **The list** (phone screen 1; computer side pane): header title + subtitle
  "… · newest first"; the unsaved row pinned at top on `--unsaved-soft`, name
  *Unsaved, on this device*, its working-copy summary in `--ink`, a `badge
  unsaved dot` carrying the word *unsaved*; then each entry row with `{note}`,
  the `{by}` meta (author/you · when), and the musical `{summary}`. Sample
  entries include *Ukulele shapes — Ana · yesterday — "Voicings for G4 C4 E4 A4:
  added Am, C, Dm, F"*; *Merged, with your resolution — you · 2 Oct — "Refrão bar
  2: your G7 kept over Ana's G7(13)"*; *First version — you · 14 Sep — "New song:
  Primeira Parte, Refrão"*. The selected row carries class `sel` on the computer
  split.
- **A version** (phone screen 2; computer main pane): appbar "Rua do Porto ·
  28 Sep" with back "Back to history"; header `{note}` + `{by}` ("you · 28 Sep,
  22:40"); a card *What changed from the version before* with two-column `.diff`
  rows (location | `was X → now Y`); then *The song as it was* and the rendered
  chart; sticky footer **Compare with now** and **Restore this version**
  (primary). On the computer, a *Show the text* `toggle` (role=switch) reveals
  the file's line diff in an `editor` block, captioned "the line diff of
  `<file>.cifra.md` against the version before" with `ln` lines classed
  `del`/`add`/`gap`.
- **Restore asks first** (tablet, scrim dialog `role=dialog` labelled
  `w06-restore-title`): title *Restore the version of 20 Sep?*; body "Rua do
  Porto has unsaved changes on this device. Restoring replaces them, and this
  would be lost:"; a card on `--unsaved-soft` with the to-be-lost `.diff` rows;
  caption "The whole version is restored. It is then unsaved, and saving it makes
  a new version; nothing in the history is changed."; actions *Keep my changes*
  and danger *Lose them and restore*.
- **Layouts**: phone = two stacked full screens (list, then version with sticky
  action footer); tablet = single-column version view with appbar actions,
  overlaid by the restore dialog; computer = persistent two-pane split (list
  left, version + optional file-text diff right). This is the same narrow/wide
  split the shell draws at 600px (`useLayoutMode()`).
- Status is a word, never colour alone (`docs/mockups/README.md:26`): the
  *unsaved* badge and the *merged, with your resolution* label carry words.

### The code seams this extends

- **Store ↔ Worker** (DIRECTION §3.7): `createStore(endpoint)` /
  `store.send(message)` / `store.slice(name)` (`app/src/worker/store.js`);
  `getAppStore()` (`store.js:99`); React bindings `useSlice(store, name)` and
  `useWorkerEvent(store, kind, handler)` (`app/src/worker/useStore.js:15,30`);
  envelope builders `command(kind, payload)` / `event(...)` and the `CommandKind`
  / `EventKind` enums (`app/src/worker/protocol.js`). No promise/correlation API
  — fire a command, observe the event or the slice. The store is prop-threaded,
  not in React context; navigation ("which version is open") is ephemeral
  `useState`, never a slice (the project's no-router, no-createContext
  convention).
- **Parsing in the view is already the pattern.** `SongEditor.jsx:11-12,27,246,
  358` imports `parse` from `cifra-md` and feeds `parse(text, dialect)` straight
  into `Chart` for its preview and pre-save diagnostics (editor Decision 2). This
  task does the same for each historical version's text.
- **The chart renderer**: `Chart({ model, markOf, size, label, className })`
  (`app/src/chart/Chart.jsx:98`) — a pure view over an already-parsed plain-object
  model; "it never imports cifra-md or parses, because the Worker owns
  durability" — the view hands it a model (`Chart.jsx:13`).
- **The diff renderer**: `renderChange(change, t) → { where, what }`
  (`app/src/songs/render-change.js:91`), localized, musical tokens passed as
  data; its header names songs.history as a consumer. The React rows that wrap it
  are currently duplicated inline as `DiffRows` in `SaveSheet.jsx:48-63` and
  `DiscardConfirm.jsx:72-84`.
- **The "what would be lost" slice**: `CommandKind.PREVIEW_SAVE {bookId, paths}`
  → `EventKind.SAVE_PREVIEW` → the `savePreview[bookId]` slice
  `{ previews: [{ path, title, changes, summary, isNew }] }`
  (`app/src/worker/save-preview.js`, `reducer.js` savePreview fold). It diffs
  HEAD vs working copy in the Worker — exactly the unsaved-entry summary and the
  restore "what would be lost". `DiscardConfirm.jsx` reads it and sends `DISCARD`.
- **The working-copy text**: `CommandKind.OPEN_SOURCE {bookId, path}` →
  `EventKind.SOURCE {bookId, path, text}` → the `source` slice
  (`reducer.js:97-103`; `logic.js:863`), the live working-copy bytes — the
  "compare with now" right-hand side.
- **The identity, for *you***: the device-local commit identity is
  `{ id: 'local', name }` (`SaveSheet.jsx:45` `LOCAL_ID='local'`;
  `AppShell.jsx:37` `LOCAL_IDENTITY`), the display name kept in
  `preferences.authorName.value` (`SaveSheet.jsx:99`; `reducer.js` preferences
  slice). The commit email is `noReplyAddress('local')` =
  `local@users.estantedecifras.app` (`app/src/worker/author.js` — DIRECTION §3.2,
  the per-user no-reply address; the account user-id replaces the local id after
  sign-in).
- **The dev-mount pattern**: `App.jsx` hash-routes dev mounts
  (`isEditorDev()` → `#dev/editor`, re-rendering on `hashchange`,
  `App.jsx:25-67`); `EditorDev.jsx` reads `book`/`path` from the hash, mounts the
  screen and wires `SaveSheet`/`DiscardConfirm`. The save-sheet e2e reaches the
  editor through `#dev/editor?book=…&path=…` because no reading view exists yet
  (editor Decision 6).
- **Overlays**: `ThemeRoot` (`app/src/theme/ThemeRoot.jsx:60-72`) wraps the tree
  in `UNSAFE_PortalProvider` anchored to the `.est` token root, so any
  `ModalOverlay`/`Modal`/`Dialog` from `react-aria-components` portals inside
  `.est` and gets tokens with no per-screen plumbing
  (memory: `rac-overlays-portal-outside-est-theme-root`). The sheet/dialog
  class vocabulary (`scrim`, `scrim center`, `sheet`, `dialog`, `.diff`) lives in
  `app/src/songs/save-sheet.css` and `app/src/books/books.css`.

**The reading view does not exist yet.** `songs.reading` is a sibling, not a
dependency, and is not Done. There is no `SongView`/reading component; a song is
addressed everywhere by `{ bookId, path }`, and today only the editor's dev
mount reaches a song. So this task delivers the history surface and a
`#dev/history` mount to host and test it now, plus a single host-callback seam
(`onOpenHistory({ bookId, path })` / an `onRestored` callback) that `songs.reading`
will wire to its toolbar when it lands — mirroring how `onOpenSong`/`onSave` were
created as seams before the screens that call them (editor Decision 6).

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data.** *Central.*
  (DIRECTION §3.7:407-414.) The surface reads the `history`, `savePreview`,
  `source` and `preferences` slices and sends `SONG_LOG`, `READ_VERSION`,
  `RESTORE_VERSION`, `OPEN_SOURCE`, `PREVIEW_SAVE`; it never touches IndexedDB,
  git, or the book lock. `parse`/`diff` run in the view on bytes the Worker
  already handed over — the same boundary the editor uses — because cifra.md is
  framework-free and knows nothing of React.
- **Canonical form and the save refusal stay the Worker's.** *Applies.* Restore
  writes historical bytes into the working copy uncommitted; the new version is
  saved through the existing save path (`storage.history` restore + the save
  sheet), where the cifra.md writer canonicalises and may refuse a marked text.
  The history view never canonicalises, commits, or pushes, and never writes back
  non-canonical spelling.
- **History is never rewritten.** *Central.* Restore only writes into the working
  copy; no command here edits, amends, or deletes a commit. (Workflow 6 L55-56.)
- **Offline first.** *Central — pinned by the offline e2e.* Every book is a full
  clone (DIRECTION §3); listing, reading a version, comparing, and restoring are
  all local git reads/writes and must work with the network cut. Saving the
  restored version follows the existing offline-save path (commit kept, pushed
  when the network returns).
- **Accessibility (every UI task).** *Central.* Every interactive part is a React
  Aria Component with full keyboard paths — the list rows, the back/compare/
  restore/show-the-text controls, the restore dialog — and axe at WCAG 2.1 AA on
  the list, the version view, and the open restore dialog, each viewport. Status
  is a word: the *unsaved* badge and the *merged, with your resolution* label
  never rely on colour (`docs/mockups/README.md:26`).
- **No song text in logs; purpose-written fixtures.** *Applies.* The Worker logs
  nothing; test fixtures are songs written for the purpose, never anyone's
  copyrighted words.
- **Component boundaries (DIRECTION §3.6).** *Applies.* No code shared with the
  service; `cifra-md` stays framework-free below the view.
- **No book without an account; `noindex`.** *Applies trivially.* History reads
  only books already on the device; the whole app carries `noindex`.
- **i18n.** All copy goes through `t(key, params)`; a new `history.*` section is
  added to all four catalogues (`en`, `pt-BR`, `es-419`, `it`), with `en` the
  source of truth — catalogue completeness is a hard build gate. Musical tokens
  (chords, note names, section names, bar numbers) are passed through as data,
  never translated (the `renderChange` rule).
- **Unsaved is derived from the save preview, not the index flag.** The search
  index's `unsaved` flag is live-only and a reload reconciles every song as saved
  (memory: `reconcile-resets-unsaved-on-reload`); the authoritative signal is a
  non-empty `savePreview` (HEAD vs working copy), which the view already has.

## Acceptance criteria

### Behavior delivered

1. **The list, newest first, with the unsaved entry pinned.** Opening history on
   `{ bookId, path }` sends `SONG_LOG` and renders `history[bookId][path].entries`
   newest first; each row shows the note (`entry.message` subject), the author —
   or *you* when `entry.author.email` is the local no-reply address (or the name
   matches before sign-in) — the time, and the musical summary. When
   `savePreview` reports changes for the path, a first row *Unsaved, on this
   device* is pinned above them, carrying that preview's summary and an *unsaved*
   word badge. *Pins workflow 6 §The list L11-37; mockup W06 phone screen 1 /
   computer side pane.*
2. **Merges handled as the log gives them.** Ordinary merge commits never appear
   (filtered by `storage.history`); an entry with `resolution: true` is shown
   with the localized note *merged, with your resolution* and a summary diffing
   the merge against its first parent. *Pins workflow 6 §The list L28-32; workflow
   9; mockup W06 `entries` "Merged, with your resolution".*
3. **Renames followed.** Each `READ_VERSION`/`RESTORE_VERSION` is sent with the
   entry's historical `entry.path` as `fromPath`, so a version of a since-renamed
   song reads and restores correctly. *Pins workflow 6 §The list L34-37;
   `storage/history.md` restore contract.*
4. **A version read as it was.** Opening an entry sends `READ_VERSION`, parses the
   returned text in the view, and renders it with `Chart` as *The song as it
   was*, beside a *What changed from the version before* card whose rows are
   `renderChange` over `diff(parse(previousText), parse(thisText))` (the oldest
   version diffs against an empty parse, yielding its *New song: …* summary).
   *Pins workflow 6 §A version L39-45; mockup W06 phone screen 2 / computer main
   pane.*
5. **Compare with now.** *Compare with now* re-renders the card as
   `diff(parse(thisVersionText), parse(workingCopyText))`, the working text read
   from the `source` slice (`OPEN_SOURCE`). *Pins workflow 6 §A version L46-50;
   mockup W06 footer "Compare with now".*
6. **Show the text.** A *Show the text* switch reveals the file's line diff of the
   version against the one before — a pure `lineDiff(previousText, thisText)` →
   hunks, rendered as classed `del`/`add`/`gap` lines (no CodeMirror). *Pins
   workflow 6 §A version L43-45; mockup W06 computer `editor` block.*
7. **Restore, asking first when dirty.** *Restore this version* with no unsaved
   changes sends `RESTORE_VERSION`; with unsaved changes it first opens a centered
   confirm dialog (title *Restore the version of {date}?*, the to-be-lost
   `savePreview` rows, *Keep my changes* / danger *Lose them and restore*) and
   sends `RESTORE_VERSION` only on confirm. On the resulting `RESTORED` token
   bump, the host opens the save sheet on `{ bookId, path }` so the restored copy
   is saved as a new version. *Pins workflow 6 §Restoring L53-62; mockup W06
   tablet restore dialog; `storage/history.md` RESTORED→save-sheet handshake.*
8. **Responsive surface.** Narrow (phone): stacked full screens — list, then
   version with a sticky action footer and back navigation. Wide (tablet,
   computer): the version view with appbar actions, the restore dialog as a
   centered overlay, and on the computer the persistent two-pane split (list
   left, version right) with the selected row marked. *Pins mockup W06 three
   columns; `useLayoutMode()` narrow/wide at 600px.*
9. **Offline.** The whole surface works with the network cut — reads and restore
   are local; the restored version saves offline and pushes when the network
   returns. *Pins DIRECTION §3; workflow 8 §Offline.*

Wiring: new `app/src/songs/SongHistory.jsx` (the surface), `RestoreConfirm.jsx`
(the dialog, mirroring `DiscardConfirm.jsx`), `DiffRows.jsx` (extracted from the
inline duplicates in `SaveSheet.jsx`/`DiscardConfirm.jsx`, now a shared component
over `renderChange`), the pure `history-view.js` (assembly: pair versions,
compute summaries, mark *you*, prepend unsaved, label resolution, format *when*)
and `line-diff.js` (hunks); `song-history.css` for the list/version/split
styling; a `#dev/history?book=…&path=…` mount in `App.jsx` with a thin host that
mounts `SongHistory` and opens `SaveSheet` on `RESTORED`; and the `history.*`
i18n section in all four catalogues. No change to `protocol.js`, `reducer.js`, or
`logic.js` — the Worker seams already exist.

### Tests the task lands with, by level

Per the `.tji` note: **behavior**, **e2e-web**. This refinement adds **unit** —
the testing policy permits adding a level a task needs, and the two pure helpers
(`line-diff.js`, `history-view.js`) are exactly what the unit level pins, as
`render-change.test.js`/`save-note.test.js` did for the save sheet. Fixtures are
purpose-written songs, never anyone's copyrighted words.

- **unit — `app/src/songs/line-diff.test.js`** (*show the text*): `lineDiff`
  produces the right added/removed/unchanged hunks for an insert, a delete, and a
  one-line chord change, and an empty diff for identical text. *Pins workflow 6
  §A version L43-45.*
- **unit — `app/src/songs/history-view.test.js`** (*the list assembly*): pairing
  adjacent versions yields each entry's `summary` via `diff`; the oldest entry
  diffs against empty; *you* is marked by the local no-reply email and by the name
  before sign-in; the unsaved entry is prepended only when the preview has
  changes; a `resolution` entry gets the *merged, with your resolution* label and
  a first-parent summary. *Pins workflow 6 §The list L11-37.*
- **behavior — `app/src/songs/SongHistory.behavior.test.jsx`** (real RAC and
  i18n, a loopback-backed store seeded against a local git remote — the Worker rig
  of `history.behavior.test.js`/`working-copy.behavior.test.js` — so `SONG_LOG`,
  `READ_VERSION` and `RESTORE_VERSION` run against a repository built in the test,
  with a CodeMirror-free surface so no jsdom geometry stub is needed):
  - unsaved changes shown first, with the *unsaved* word badge (*Pins §The list
    L23-26*);
  - a version read as it was renders its chart and the *what changed from the
    version before* rows (*Pins §A version L39-45*);
  - *compare with now* re-renders the rows against the working copy (*Pins §A
    version L46-50*);
  - *show the text* reveals the line diff (*Pins §A version L43-45*);
  - restore with a clean working copy sends `RESTORE_VERSION` and the save sheet
    opens on the `RESTORED` bump; restore with unsaved changes asks first and
    shows what would be lost, cancelling leaves the working copy untouched (*Pins
    §Restoring L53-62*);
  - *you* vs an author's name; an ordinary merge absent, a resolution entry
    present and labelled (*Pins §The list L15-32*);
  - axe clean on the list, the version view, and the open restore dialog.
- **e2e-web — `e2e/web/tests/history.spec.js`** (compose stack;
  phone/tablet/computer projects; axe WCAG 2.1 AA on the list, the version view,
  and the restore dialog each viewport; offline via `e2e/web/lib/offline.js`):
  seed by opening the example book, build a short history by editing and saving a
  song twice through `#dev/editor?book=local-example-book&path=…` (the save sheet
  is Done), then open `#dev/history?book=…&path=…`: the versions list newest
  first; open a version and read it; *compare with now*; *show the text*; restore
  a version, which opens the save sheet, save it, and confirm a new version
  appears at the top; and the whole flow once more after a reload with the network
  cut. *Pins workflow 6; workflow 8 §Offline.*

### Deferred work (closer registers in the WBS; milestone unless noted)

- **Restoring part of a version** (workflow 6 §Later L72-74; DIRECTION §2.1):
  *bring back the ukulele voicings from last week* — restore one block, not the
  whole song, using the semantic diff's block structure. New WBS leaf
  `songs.restore_part` (**no new leaf exists yet**), effort **1.5d**, depends
  `songs.history`, `cifra_js.editing`; note "Restore a single block of a version
  into the working copy, not the whole song; chosen from the per-version musical
  diff. Workflow 6 §Later. Tests: behavior (one block restored, the rest
  untouched; axe); e2e-web (a block restored and saved on the three viewports;
  axe)." Not in M2 (M2 is "find, read, write, edit, arrange, history"); wire into
  a later refinement/polish milestone. (Closer registers in the WBS.)
- **Comparing two arbitrary versions** (workflow 6 §A version L50) is explicitly
  *not built at first* — **no new leaf**; left as designed-future, not deferred
  work.
- **The reading view's history affordance.** This task ships the surface and a
  `#dev/history` mount; the real entry point (a *history* control in the song's
  toolbar) belongs to `songs.reading` (the existing sibling leaf), which wires the
  `onOpenHistory` seam when it lands — **no new leaf**. Graph note for the closer
  (not a new task): `songs.reading` already shares the M2 milestone; no edge
  change needed.
- **`DiffRows` extraction** is done inside this task (not deferred): the inline
  duplicates in `SaveSheet.jsx` and `DiscardConfirm.jsx` are replaced by the
  shared component so all three consumers render identically. Covered by the
  existing `SaveSheet.behavior.test.jsx` plus this task's behavior test.

## Decisions

1. **Parse and diff the version texts in the view; add no Worker seam.**
   `storage.history` deliberately ships raw version bytes + commit metadata and
   states (`storage/history.md:100-106,354-362`) that the UI computes the musical
   summary and the unsaved entry itself; the editor already parses in the view for
   its preview (`SongEditor.jsx:246`, editor Decision 2); `renderChange` names
   songs.history as its consumer. So the surface calls `parse`/`diff` on bytes the
   Worker already returns via `READ_VERSION`/`OPEN_SOURCE`, and reuses
   `renderChange`. *Rejected: a new Worker command that returns per-entry
   summaries (or parsed models) — it would duplicate a seam the predecessor
   deliberately left to the UI, send redundant data across the port, and split the
   parse-in-the-view pattern the editor set. cifra.md stays framework-free either
   way; importing it in a view module does not make it "know React".*
2. **The history surface is a navigable screen (list + detail), not a bottom
   sheet.** The mockup draws full screens with their own appbar and back
   navigation (phone), a persistent two-pane split (computer), and only the
   *restore confirm* as an overlay dialog. It follows the shell's narrow/wide
   split at 600px. *Rejected: a `ModalOverlay` sheet like the save sheet — it fits
   a short confirm, not a two-pane list/version browser with its own navigation,
   and the drawings decided against it.*
3. **Reuse `DiscardConfirm`'s shape for restore, as a sibling `RestoreConfirm`,
   and derive "what would be lost" from `savePreview`.** Workflow 6 says restore
   "asks first and shows what would be lost, as discard does"; the loss is the
   working copy's unsaved changes — exactly the `savePreview` (HEAD vs working)
   that `DiscardConfirm` already shows. A sibling component keeps the restore copy
   and the danger action ("Lose them and restore") distinct while sharing the CSS,
   the slice, and the extracted `DiffRows`. *Rejected: parametrizing
   `DiscardConfirm` with both sets of copy — two destructive flows with different
   verbs and captions read more clearly as two small components than one with
   mode branches.*
4. **Derive "unsaved" from `savePreview`, not the search-index flag.** The index's
   `unsaved` flag is live-only and a reload marks every song saved (memory:
   `reconcile-resets-unsaved-on-reload`); a non-empty `savePreview` is the
   authoritative HEAD-vs-working signal and is already the source for the unsaved
   entry's summary and the restore loss. *Rejected: `search.results[].unsaved` —
   wrong after a reload, the exact bug that memory records.*
5. **Ship a `#dev/history` mount and an `onOpenHistory`/`onRestored` host seam;
   do not wait on the reading view.** `songs.reading` is a sibling, not a
   dependency, and is not built; the editor set the precedent of standing a
   surface up behind a dev hash so its behavior and e2e run now (editor Decision
   6), with the real screens wiring the seam later. *Rejected: blocking on
   `songs.reading` — it is not in this task's `depends`, and the e2e needs a
   stable entry point regardless.*
6. **Write a small pure `lineDiff`; add no diff dependency.** *Show the text*
   needs a line/hunk diff of two texts; a short LCS-based helper is unit-testable
   and avoids a new npm dependency (which would need a lockfile update behind a
   possibly-blocked network — memory:
   `adding-npm-deps-needs-lockfile-and-network`). Rendered as plain classed lines,
   not CodeMirror, so no jsdom geometry stub is needed
   (memory: `codemirror-jsdom-getclientrects`). *Rejected: pulling a diff library,
   or reusing CodeMirror's merge view — both add weight the one read-only hunk
   view does not justify.*

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- Created `app/src/songs/SongHistory.jsx` — the history surface: list, version detail,
  two-pane split, back/compare/restore/show-the-text controls, SAVED→list navigation.
- Created `app/src/songs/RestoreConfirm.jsx` — the restore-asks-first centered dialog,
  showing what would be lost (the `savePreview` rows), *Keep my changes* / danger
  *Lose them and restore*.
- Created `app/src/songs/DiffRows.jsx` — extracted from inline duplicates in
  `SaveSheet.jsx`/`DiscardConfirm.jsx`; all three consumers now render identically.
- Created `app/src/songs/HistoryDev.jsx` — thin dev-mount host wiring `SongHistory` and
  opening `SaveSheet` on the `RESTORED` token bump.
- Created `app/src/songs/history-view.js` — pure assembly: pair versions, compute
  summaries via `diff`/`renderChange`, mark *you*, prepend unsaved entry, label
  resolution entries, format *when*.
- Created `app/src/songs/line-diff.js` — minimal LCS-based line-hunk diff; no
  dependency added, no CodeMirror geometry in tests.
- Created `app/src/songs/song-history.css` — list/version/split layout; switch hit-target
  fix (RAC `Switch` 1px wrapper expanded to full transparent overlay).
- Edited `app/src/App.jsx` — `#dev/history?book=…&path=…` mount, `hashchange` listener.
- Edited `app/src/songs/SaveSheet.jsx`, `DiscardConfirm.jsx` — now use shared `DiffRows`.
- Edited `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — new `history.*` i18n section.
- Tests: unit `app/src/songs/line-diff.test.js` (5 tests), `history-view.test.js` (7 tests);
  behavior `app/src/songs/SongHistory.behavior.test.jsx` (9 tests, real Worker rig, axe);
  e2e-web `e2e/web/tests/history.spec.js` (3 tests × phone/tablet/computer = 9 runs, axe,
  offline restore+save).
- Two post-implementation fixes landed with the same commit: switch hit-target CSS in
  `song-history.css`, return-to-list on SAVED in `SongHistory.jsx`, and offline e2e
  defensive-pattern corrections in `history.spec.js`.
