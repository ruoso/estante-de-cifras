# songs.save_sheet — Save, discard, and the save sheet

## TaskJuggler

[`task save_sheet`](../../60-songs.tji) in `tasks/60-songs.tji` (area
`songs`): *"Save, discard, and the save sheet."*

## Effort estimate

2d (from the WBS leaf).

## Repository

**estante-de-cifras**, the app:

- `app/src/songs/` — the save sheet, the discard confirm, the pure change
  renderer, and the search-screen *save all* entry point.
- `app/src/worker/` — one new preview command and its handler, and the
  first-save author-name persistence to the home book.
- `app/src/i18n/locales/` — the `saveSheet.*` chrome, in all four locales.
- `e2e/web/tests/` — the Playwright journey.

No cifra.md work: the semantic diff it consumes (`cifra_js.diff`) already
ships inside the `cifra-md` package.

One design delta rides in this task's commit (see Decisions): the stale
"whether a save pushes is still open" line in
`docs/workflows/03-write-a-new-song.md` is corrected to the settled
save-pushes rule.

## Inherited dependencies

Settled:

- **`songs.editor`** (`depends !editor`, complete). The CodeMirror editor
  owns the **Save** button and the **pre-save gate**
  (`SAVE_BLOCKERS = {'bad-voicing','marker-line'}`,
  `app/src/editor/SongEditor.jsx:48`), and hands off through the single
  `onSave?.()` seam (`SongEditor.jsx:273-280`) when the parse is clean.
  editor Decision 10: *the editor owns the gate and the affordance; the host
  owns what Save does.* The sheet is what Save does.
- **`cifra_js.diff`** (`depends cifra_js.diff`, complete; cifra.md commit
  `f833ee5`). `diff(before, after) → { changes, summary }`, imported from
  `cifra-md` (`app/node_modules/cifra-md/src/diff.js`). `changes` is an
  ordered array of records `{ kind, op, where, before, after, text }`
  (`kind ∈ title|property|section|chord|words|voicing`,
  `op ∈ added|removed|changed|renamed|reordered`); `summary` is the records'
  neutral-English `text` joined with `"; "`, designed to double as the git
  commit subject. See [`cifra_js/diff.md`](../cifra_js/diff.md).
- **`songs.new_song`** (complete). Owns the first-save *mechanism* reused
  here: `deriveSongFilename` (`app/src/songs/song-filename.js`) and the
  `NAME_AND_SAVE` Worker command (parse title → slug → rename placeholder →
  canonicalise → commit *Add {title}* → push → emit `SAVED`). new_song's
  first save is dialogless; this task wraps it in the sheet. new_song
  Decision 6 assigns the *save sheet* and *the name prompt when a title is
  absent* to this task. **Recommended WBS edit (closer):** add
  `depends songs.new_song` to this leaf — it reuses that task's
  `NAME_AND_SAVE` and `deriveSongFilename` rather than stubbing them (the
  two are independent siblings today; whichever lands first stands alone).
- **`storage.working_copy`** / **`storage.git`** (complete). The commit/push
  engine: `createWorkingCopy({fs,git,locks}) → { write, save, nameAndSave,
  discard }` (`app/src/worker/working-copy.js`); `CommandKind.SAVE
  {bookId, paths, message, author}` canonicalises each path, makes **one**
  commit, then best-effort pushes (offline → `pushed:false`, commit kept);
  `CommandKind.DISCARD {bookId, paths}` restores from HEAD or deletes a
  never-saved file; `EventKind.SAVED {bookId, path?, commit, pushed}` /
  `DISCARDED` / `SAVE_REFUSED {bookId, path, reason, marker, line}`.
- **`shell.portal_provider`** (complete). `app/src/theme/ThemeRoot.jsx`
  portals every React Aria overlay inside the `.est` token scope; RAC
  `ModalOverlay`/`Modal`/`Dialog` just work. (Memory:
  [[rac-overlays-portal-outside-est-theme-root]].)
- **`shell.i18n`** (complete). `t(key, params)` /
  `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`; `en.js` is the source of
  truth every other locale is checked against.
- **`storage.home_book`** / **`storage.preferences_surface`** (complete).
  The home book is the settings repository for personal state (DIRECTION
  §3.2); the first-save author name is kept there.
- **`foundation.e2e_web`** (complete, via `task songs` depends). The
  Playwright harness at `e2e/web/`.

Pending: none — every dependency is in.

## What this task is

When the editor's Save passes its gate, this task is **the sheet that
opens**. It shows **what changed, in musical terms** (the semantic diff
between the last-saved version and the working copy) and **a note prefilled
from that summary** which the user may edit; confirming commits the one file
with the note as the message and pushes it. It adds **Discard changes**,
which shows the same summary as *what would be lost* and always asks before
reverting; **save all**, which opens the same sheet over every changed song
in a book and makes one commit; and, on the **first save ever**, a one-time
prompt for the author's **name, as it will appear in a song's history**,
kept in the home book. The editor, the commit/push engine, the filename
mechanism and the diff all exist — this task is the view that presents them,
plus the one new Worker read that computes the per-file preview.

## Why it needs to be done

Workflow 4 makes a save two taps on purpose: *"a save is a version the user
chose to keep, and seeing what is in it is part of choosing"*
(`docs/workflows/04-edit-and-save.md:31-34`). Until this ships, Save has a
seam (`onSave`) but no sheet: the editor can gate a save but the user never
sees what they are keeping, cannot edit the note, cannot discard with their
eyes open, and cannot save a book's worth of changes in one commit. It is
the last piece of the edit-and-save loop (Workflow 4) and the shared
save-surface that `songs.history` (version previews) and `songs.arrange`
(saving a new variation) read against.

## Inputs / context

Governing documents (normative — the refinement turns their promises into a
work order, it does not redesign them):

- **Workflow 4** — `docs/workflows/04-edit-and-save.md` (status: decided):
  - §Editing (`:9-21`): every change writes to the working copy as made; the
    song shows **unsaved changes** until saved or discarded; *"There is one
    kind of unsaved change, whatever made it."*
  - §Saving (`:23-34`): *"Save opens a short sheet with two things on it"* —
    **what changed** in musical terms *"Verse bar 5: G7 → D♭7; added voicings
    for G4 C4 E4 A4"* from the semantic diff, and **a note**, prefilled from
    that summary, which the user may edit. *"Confirming commits the one file,
    with the note as the commit message."*
  - §Save pushes (`:36-45`): *"Save commits and then pushes: at once if there
    is a network, at the next sync if not (workflow 8) … saved means shared
    with whoever shares the book."*
  - §Normalising (`:47-56`): voicings put in canonical order at save, the
    chart untouched; a voicing line the parser cannot read **stops the save**
    with a message pointing at it. (Already enforced by the editor's gate —
    see Constraints.)
  - §Several songs at once (`:58-64`): *"save all is in the book's section on
    the search screen and in the file view. It opens the same sheet, listing
    every song and what changed in each, and makes one commit."*
  - §Who made the change (`:66-71`): *"The first save asks once for a name,
    as it will appear in a song's history, and keeps it in the home book.
    After sign-in, the host account supplies the email, and its name is
    offered in place of the one given."*
  - §Discarding (`:73-77`): *"Discard changes puts the song back as last
    saved. It shows what would be lost — the same summary as save — and
    always asks, since it is the one destructive action here."*
  - §A book the user cannot push to (`:79-84`): a shared song can still be
    edited; **Save** there explains the book is someone else's and offers to
    make it the user's own (workflow 11); until then the changes stay
    unsaved.
- **DIRECTION** — `docs/DIRECTION.md`:
  - §3 (`:111-117`): *"Saving is a commit, and then a push … the working copy
    is always safe; a save is a version the user chose to keep."*
  - §3.1 Sync (`:127-134`): offline push waits for the next sync; every git
    request to a hosted book goes through the service.
  - §3.2 Personal state (`:136-151`): the home book is the settings
    repository, JSON merged key by key — where the author name lives.
  - §3.6 (`:277-291`): the app and the service share no code; **cifra.md for
    JavaScript** *"diffs in musical terms. The app's."*
  - §3.7 (`:407-417`): *"One owner for the data: a Web Worker … The main
    thread never touches IndexedDB … the view is the only layer"* that knows
    React.
  - §4 (`:454-458`): song history is *"a diff in musical terms … and a
    default save message drawn from it."*
- **Mockup** — `docs/mockups/W04-edit-and-save.dc.html` (board
  `W04-edit-and-save`, `canvas.json:48-54`). It carries the concrete copy:
  the bottom sheet `role="dialog"` titled **Save Tarde Clara**, heading
  **What changed** with two-column rows (*Primeira Parte bar 2* | *D → D7*;
  *Voicings* | *added for G4 C4 E4 A4*), the **Note** field prefilled with
  the summary, the push caption **"Saving shares this version with whoever
  shares the book; with no network, at the next sync."**, **Cancel** /
  **Save**; the discard dialog **Discard changes to Tarde Clara?** / **"The
  song goes back to how it was last saved. This would be lost:"** / **Keep
  editing** / danger **Discard changes**; the computer board's **Unsaved**
  list (save-all surface), the someone-else's-book card, and the first-save
  **"Your name, as it will appear in a song's history"** pane.
  `docs/mockups/README.md:26`: *every status badge carries a word, never
  colour alone.*

Seams in the source (all shipped):

- `app/src/editor/SongEditor.jsx` — `onSave` prop; `parse(text, dialect)` is
  already computed live (`:245`) as the *after* model; `editorRef.current`
  exposes the live buffer.
- `app/src/shell/AppShell.jsx` — holds the ephemeral `editing` view-state and
  `editorRef`; `saveNewSong()` currently sends `NAME_AND_SAVE` on the
  editor's `onSave`; `useWorkerEvent(store, SAVED, …)` closes the host.
- `app/src/worker/protocol.js` — `command`/`event`, `CommandKind`
  (`WRITE`/`SAVE`/`DISCARD`/`NAME_AND_SAVE`/`OPEN_SOURCE`/`READ_VERSION`),
  `EventKind` (`SAVED`/`DISCARDED`/`SAVE_REFUSED`/`SOURCE`/`VERSION`);
  `kind` is an open string.
- `app/src/worker/logic.js` — the `handle` switch; `authorFrom(author)`
  (`app/src/worker/author.js`), default `{id:'local', name:'Me'}`; the SAVE
  handler takes `payload.message` as the commit note and re-indexes touched
  paths (`unsaved:false`).
- `app/src/worker/reducer.js` — the `save` slice keyed by `bookId`
  (`{status:'saved', commit, pushed}` | `{status:'discarded'}` |
  `{status:'refused', path, reason, line, marker}`); `source` slice (working
  copy text); `search` results carry `unsaved`.
- `app/src/worker/store.js` / `useStore.js` — `store.send(command(…))`,
  `useSlice(store, name)`, one-shot `useWorkerEvent(store, kind, handler)`;
  no promise/correlation API — fire a command, observe the event or slice.
- `app/src/books/BooksScreen.jsx` — RAC `AddBookSheet` (bottom sheet:
  `ModalOverlay.scrim` → `Modal.sheet` with `.grip`/`.sheet-head`) and
  `RenameDialog` (centered: `ModalOverlay.scrim.center` → `Modal.dialog`) —
  the templates to copy; classes in `app/src/books/books.css`.
- `app/src/songs/SearchScreen.jsx` — renders each book as a section; the
  *save all* entry point goes in that section's header.
- Behavior/e2e templates: `app/src/songs/NewSong.behavior.test.jsx`,
  `app/src/editor/SongEditor.behavior.test.jsx`,
  `e2e/web/tests/new-song.spec.js`, `e2e/web/tests/editor.spec.js`;
  axe via `app/src/a11y/axe.js` (`checkWcag21aa(container)`) and
  `e2e/web/lib/axe.js` (`checkA11y`); offline via `e2e/web/lib/offline.js`
  (`runOffline`). Memory: [[codemirror-jsdom-getclientrects]] — the
  CodeMirror geometry stub is required in any jsdom test that mounts the
  editor.

## Constraints / requirements

- **The editor's gate stands in front of the sheet.** The sheet opens only
  after `onSave` fires, i.e. after `bad-voicing`/`marker-line` diagnostics
  have cleared (`SongEditor.jsx:273-280`). §Normalising's save-stop and its
  "Not saved. Line 23 …" notice are the **editor's**, already built — the
  sheet does not duplicate them. The Worker's `SAVE_REFUSED{reason:'marked'}`
  on a conflict-marker text remains the backstop; the sheet surfaces it if it
  ever fires, but never tries to save over a marked text (canonical form over
  preserving content — a marked text is never canonical, never saved).
- **The view is the only React layer; the Worker owns the data** (DIRECTION
  §3.7). The sheet reads slices through `useSlice`/`useWorkerEvent` and sends
  commands through `store.send`; it never touches IndexedDB, git, or HEAD
  directly. Reading the last-saved version to diff against is a Worker
  operation (new command below), not a main-thread fetch.
- **The diff is computed in the Worker**, not the view: the Worker is where
  HEAD and the working copy both live, and the preview must serve *save all*
  (N paths, one reply). The view receives `{ changes, summary }` per path and
  renders it. (The diff design note names the save sheet, history and version
  previews as its Worker consumers.)
- **The prefilled note is the diff's `summary`, verbatim and neutral.** It
  becomes the git commit message, stored in history and shared with every
  member of the book (who may read in any locale); keeping it the diff's
  one-line neutral English keeps history consistent and reproducible. The
  user may edit it before confirming. The **displayed** musical summary is
  localized (see Decisions).
- **Save commits and then pushes** (DIRECTION §3; Workflow 4 §Save pushes).
  Online → pushed at once; offline → committed, `pushed:false`, pushed at the
  next sync (Workflow 8) — nothing the user does waits on the network
  (offline first). A local-only book (My songs) commits with no remote; a
  shared book pushes.
- **Two taps, and Discard always asks.** Discard is the one destructive
  action; its confirm shows what would be lost and offers *Keep editing*.
- **Accessibility.** Every interactive part is a React Aria Component; full
  keyboard paths through the sheet, the note field, the discard confirm and
  the save-all list; axe at WCAG 2.1 AA on every state; the unsaved status is
  a **word**, never colour alone.
- **No song text in logs; fixtures are purpose-written songs** — never
  anyone's copyrighted words.
- **`canSaveFor`** (`app/src/worker/book-display.js`) decides savable books;
  a book the user cannot push to is never the default. For an existing song
  already in someone else's book, Save shows the explanatory notice
  (§A book the user cannot push to) and the changes stay unsaved.

## Acceptance criteria

### Behavior delivered

1. Pressing **Save** on a clean parse opens a sheet showing **What changed**
   as localized two-column rows (where · what) built from the diff's
   `changes`, and a **Note** field prefilled with the diff's `summary`,
   editable. *Pins Workflow 4 §Saving (`:23-34`); mockup W04 phone save
   sheet.*
2. Confirming sends `SAVE {bookId, paths:[path], message:note, author}` (an
   existing song) or `NAME_AND_SAVE {bookId, fromPath, message:note, author}`
   (a never-saved new song); the sheet closes on `SAVED`, and the song is no
   longer **unsaved** in search. The push caption states that saving shares
   the version with the book, at the next sync when offline. *Pins §Saving,
   §Save pushes (`:36-45`), DIRECTION §3 (`:111-117`); mockup push caption.*
3. A save made **offline** commits with `pushed:false` and shows a
   waiting-to-push state; when the network returns the sync pushes it. *Pins
   §Save pushes, Workflow 8; DIRECTION §3.1 (`:127-134`).*
4. **Discard changes** opens a confirm that shows the same summary as *what
   would be lost* and always asks; *Keep editing* cancels, *Discard changes*
   (danger) sends `DISCARD {bookId, paths}` — reverting an existing song to
   HEAD, deleting a never-saved draft. *Pins §Discarding (`:73-77`); Workflow
   3 §Abandoning; mockup discard dialog.*
5. **Save all**, from a book's section on the search screen, opens the same
   sheet listing every changed song in that book and what changed in each,
   and makes **one** commit over all their paths. *Pins §Several songs at once
   (`:58-64`); mockup computer Unsaved list.*
6. The **first save ever**, when no author name is stored and there is no
   account, shows a one-time field **"Your name, as it will appear in a
   song's history"**; the name is persisted to the home book and used as the
   commit author, and is not asked again. *Pins §Who made the change
   (`:66-71`); DIRECTION §3.2 (`:136-151`); mockup first-save pane.*
7. Saving a song whose title line is absent prompts for a name (feeding the
   title/filename through `deriveSongFilename`) before the save proceeds.
   *Pins new_song Decision 6; DIRECTION §4 (`:445-448`).*
8. Saving an existing song in a book the user cannot push to shows the
   someone-else's-book notice and keeps the changes unsaved; the **Make this
   book your own** action links to the sharing flow (Workflow 11) and is
   delivered there, not here. *Pins §A book the user cannot push to
   (`:79-84`); mockup card.*

### Tests the task lands with, by level

- **unit** — `app/src/songs/render-change.test.js`: the pure
  `renderChange(change, t)` renders each `kind × op` record to a localized
  `{where, what}` row (title/property/section add·remove·rename·reorder,
  chord by bar, coarse words, voicing block and per-voicing), musical tokens
  (chords, note-names, section names) passed through as data. *Pins the diff
  output shape ([`cifra_js/diff.md`](../cifra_js/diff.md)) and mockup W04's
  two-column rows.* And `app/src/songs/save-note.test.js`: `buildSaveNote`
  for one song (the `summary` verbatim) and for *save all* (the per-song
  aggregate). *Pins §Saving, §Several songs at once.*
- **behavior (view)** — `app/src/songs/SaveSheet.behavior.test.jsx`, over an
  `AppShell`/store double with seeded `SAVE_PREVIEW`/`SAVED`/`SAVE_REFUSED`
  events (CodeMirror geometry + `matchMedia` stubs,
  [[codemirror-jsdom-getclientrects]]): the musical summary rows and the
  prefilled note (§Saving); Save sends `SAVE`/`NAME_AND_SAVE` with the note
  as `message`; the first-save name field shown once then persisted
  (§Who made the change); the title-absent name prompt; discard showing what
  would be lost and always asking (§Discarding); save all listing every song
  and making one commit (§Several songs at once); the someone-else's-book
  notice (§A book the user cannot push to); **axe clean on every state**
  (`checkWcag21aa`).
- **behavior (Worker)** — `app/src/worker/save-preview.behavior.test.js`, on
  the Worker rig (`fake-indexeddb`, `installWebLocks`, `createFileSystem`,
  `createLoopbackEndpoint`, `startGitHttpRemote` for the online case):
  `PREVIEW_SAVE` reads HEAD and the working copy, runs `diff`, and returns
  the per-path `{ changes, summary, title, isNew }`; a never-saved song
  returns an all-added preview with its title; SAVE with the sheet's note
  commits with that message and re-indexes `unsaved:false`; the first-save
  author name is written to the home book and reused on the next save; an
  offline save returns `pushed:false` with the commit kept. *Pins §Saving,
  §Save pushes, §Who made the change.*
- **e2e-web** — `e2e/web/tests/save-sheet.spec.js`, compose stack, phone ·
  tablet · computer, axe WCAG 2.1 AA on the sheet and the discard dialog:
  edit a seeded song, open the sheet, see the summary and prefilled note,
  save, confirm it is no longer unsaved; discard shows what would be lost and
  reverts; **save all** from a book section makes one commit over two changed
  songs; the first save asks for a name and the second does not; **a save
  made offline waits and pushes when the network returns** (`runOffline` →
  `pushed:false` → push on reconnect). *Pins Workflow 4 §Saving/§Discarding/
  §Several songs/§Who made the change/§Save pushes and Workflow 8 (offline).*

(The note's `Tests:` names behavior and e2e-web; this refinement **adds a
unit level** for the two pure helpers it introduces — `renderChange` and
`buildSaveNote` — per the testing policy. No level the note names is
dropped.)

### Deferred work (closer registers in the WBS; none are new tasks for the
deliverables above — the tests above all land here)

- The **file view's** *save all* entry point rides with the file-view
  screen when it lands (DIRECTION §4 `:449-452`): it reuses this task's
  `SaveSheet` with multiple paths. Not built here because the advanced file
  view does not yet exist; **no new leaf** — it is that screen's wiring.
- The **Make this book your own** action (fork a shared book to the user's
  own) is Workflow 11's; this task renders only the explanatory notice. It is
  owned by the sharing/membership work — **no new leaf created here**; if no
  Workflow 11 leaf yet covers the fork action it is surfaced for the closer
  (see return summary), not encoded as an audit.

## Decisions

1. **The sheet is a new view over existing commands; the editor is
   untouched.** `onSave` is the one seam (editor Decision 10). This task
   re-points `AppShell`'s `onSave` handler to open `SaveSheet`; the sheet
   then issues the existing `SAVE` (ordinary song) or `NAME_AND_SAVE`
   (never-saved song) with the note as `message`. *Rejected:* teaching the
   editor to render the sheet — it would break the gate/affordance-vs-action
   boundary the editor refinement drew and couple CodeMirror to the save UI.
2. **The diff is computed in the Worker via a new read command,
   `PREVIEW_SAVE {bookId, paths}` → `SAVE_PREVIEW {bookId, previews:[{path,
   title, changes, summary, isNew}]}`.** The Worker owns HEAD and the working
   copy (DIRECTION §3.7), parses both and calls `diff`; one reply serves both
   a single save and *save all*. A new `savePreview` reducer slice (or
   one-shot event) feeds the sheet. *Rejected:* computing the diff in the
   view — the view would still need a Worker round-trip for HEAD
   (`OPEN_SOURCE` returns the working copy, not HEAD; `READ_VERSION` needs the
   HEAD sha first), and the diff design places this in the Worker beside
   save/merge/index. Doing it in the view costs two round-trips and leaks
   data-layer work above the view boundary.
3. **Displayed summary is localized; the saved note stays the diff's neutral
   English.** A pure `renderChange(change, t)` maps each structured record to
   a localized `{where, what}` row (templates under `saveSheet.change.*` in
   the i18n catalogue), with musical tokens (chord symbols, note names,
   section names, bar numbers) passed through as data; the **Note** field
   defaults to `summary` verbatim. *Rationale:* the note is the commit
   message — shared with the book's members across locales and stored in
   history — so one neutral, reproducible line is correct there, while the
   on-screen display must obey the i18n rule. *Rejected:* rendering the
   library's English `text` on screen (violates the i18n standing rule for a
   pt-BR/es/it UI); and localizing the note too (would make the same commit
   read differently per author and break history consistency across a shared
   book). The renderer is pure and reused later by `songs.history`'s version
   previews.
4. **First-save name = the commit author, persisted once to the home book.**
   Workflow 4 §Who made the change and the W04 first-save pane are the
   author's display name, distinct from the song's filename (new_song's,
   derived from the title). The sheet reads the stored identity name from the
   home-book preferences slice; when it is unset and there is no account, it
   shows the name field and sends the name with the first save; the Worker
   writes it to the home book (reusing the preferences-write path from
   `storage.preferences_surface`/`storage.home_book`; if no write command is
   exposed, a narrow `SET_IDENTITY_NAME {name}` is added) and uses it as the
   commit author, so it is asked once. After sign-in the account's name is
   offered in its place. *Rejected:* keeping the author in ephemeral state —
   it must survive across sessions and appear in history, which is exactly
   what the home book is for (DIRECTION §3.2).
5. **`NAME_AND_SAVE` gains an optional `message`.** new_song's dialogless
   first save commits *Add {title}*; the sheet now supplies a note, so
   `NAME_AND_SAVE` accepts `message?` (absent → the existing *Add {title}*).
   A small, backward-compatible Worker change. *Rejected:* a separate
   first-save-with-note command — it would duplicate the rename/commit/push
   path new_song already owns.
6. **Save-all entry on the search screen now; the file view later.** Workflow
   4 names both the search-screen book section and the file view; the former
   exists (`SearchScreen.jsx` book sections), the latter does not yet. This
   task wires the search-screen entry and the sheet's multi-path mode; the
   file-view entry rides with the file-view screen (Deferred). *Rejected:*
   building a file view here — out of scope and a much larger screen.
7. **Design delta — Workflow 3's stale save-push line.** Workflow 4
   §Save pushes settles that a save commits and then pushes (and says it
   settles DIRECTION §6, which no longer lists it open); Workflow 3's first
   save still read *"Whether a save also pushes is still open (DIRECTION
   §6)."* (`03-write-a-new-song.md:101`). new_song flagged this as this task's
   to correct. The line is replaced with the settled rule, in this task's
   commit. No DIRECTION change is needed (§6 is already updated).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- Worker: `app/src/worker/protocol.js` (PREVIEW_SAVE, SET_IDENTITY_NAME, SAVE_PREVIEW; NAME_AND_SAVE `message`/`title`), `app/src/worker/save-preview.js` (new — PREVIEW_SAVE handler, diff against HEAD), `app/src/worker/logic.js` (handlers + composer), `app/src/worker/reducer.js` (`savePreview` slice).
- View: `app/src/songs/SaveSheet.jsx`, `app/src/songs/DiscardConfirm.jsx`, `app/src/songs/render-change.js`, `app/src/songs/save-note.js`, `app/src/songs/save-sheet.css` (new); wired `app/src/songs/NewSongHost.jsx`, `app/src/editor/EditorDev.jsx`, `app/src/songs/SearchScreen.jsx` + `app/src/songs/search.css`, `app/src/shell/AppShell.jsx`.
- i18n `saveSheet.*` keys in `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Docs: `docs/home-book-format.md` §4.1 (`authorName` register); `docs/workflows/03-write-a-new-song.md` L102 corrected from stale "still open" to settled save-pushes rule (Decision 7).
- Tests — unit: `app/src/songs/render-change.test.js` (20 tests), `app/src/songs/save-note.test.js` (4 tests); behavior (view): `app/src/songs/SaveSheet.behavior.test.jsx` (8 tests) + updated `app/src/songs/NewSong.behavior.test.jsx`; behavior (Worker): `app/src/worker/save-preview.behavior.test.js` (5 tests); e2e-web: `e2e/web/tests/save-sheet.spec.js` (5 tests × 3 viewports), `e2e/web/tests/new-song.spec.js` updated for sheet-in-the-middle flow.
- Tech-debt registered: `storage.index_dirty_reconcile` (1d), `songs.editor_section_after_voicings` (0.5d); both wired to m2_local.
