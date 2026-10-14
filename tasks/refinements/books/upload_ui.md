# books.upload_ui — Upload preview

## TaskJuggler

[`tasks/65-books.tji`](../../65-books.tji), `task books.upload_ui`
("Upload preview").

## Effort estimate

2d (from the `.tji`).

## Repository

**estante-de-cifras**, the app only: `app/src/books/` (the upload surface — the
file picker, the preview screen, its children and co-located styles), a new
`onUpload` way-in on the existing `AddBookSheet` in
`app/src/books/BooksScreen.jsx`, the four `app/src/i18n/locales/*.js`
catalogues, and the e2e harness `e2e/web/`. **No work in cifra.md, none in
`service/`, `api/` or `app/src/worker/`** — the upload engine, its Worker
protocol kinds and its preview model already exist (sync.upload, commit
c3de9e9). This task is a view + axe + e2e-web consumer of a Worker subsystem
that is already complete: it writes no git, no IndexedDB, no merge logic.

## Inherited dependencies

All **settled** (each `complete 100`):

- **sync.upload** (`tasks/refinements/sync/upload.md`) — the Worker-side upload
  engine `app/src/worker/upload.js`, and the protocol kinds it added in
  `app/src/worker/protocol.js`:
  - **Commands** (`protocol.js:355-357`): `CommandKind.PREVIEW_UPLOAD`
    (`'preview_upload'`), `CommandKind.IMPORT_UPLOAD` (`'import_upload'`),
    `CommandKind.CANCEL_UPLOAD` (`'cancel_upload'`).
  - **Event** (`protocol.js:606`): `EventKind.UPLOAD_PREVIEW`
    (`'upload_preview'`), the reply to a `PREVIEW_UPLOAD`.
  - The UI contract is already written down in `protocol.js:334-353`: "the view
    picks the zip, renders the preview and sends the confirm. PREVIEW_UPLOAD …
    replying with UPLOAD_PREVIEW. A non-zip buffer, a CRC failure or a zip-slip
    entry name is refused (ERROR, never a crash). IMPORT_UPLOAD `{ uploadId, …}`
    … CANCEL_UPLOAD `{ uploadId }` removes the scratch repo."
  - `preview({ target, bytes })` returns (`upload.js:597`):
    `{ uploadId, target, branch, hasHistory, sharedHistory, historyMarkers,
    previews }`. Each entry of `previews` is
    `{ path, title, status, changes?, summary?, line? }` with
    `status ∈ 'added' | 'changed' | 'conflict' | 'replace' | 'unresolved'`
    (`upload.js:447, 468, 485, 501, 529, 594`); `line` is the 1-based first
    marker line for an `'unresolved'` row; `changes`/`summary` are the diff rows
    and the one-line musical summary for a `'changed'` row (from `diff`,
    `upload.js:446`).
  - `import_({ uploadId, choice, target, perFile })` (`upload.js:789`),
    `choice ∈ 'new_book' | 'latest_without_history' | 'merge' | 'replace'`;
    `perFile?: string[]` is the chosen paths for the `'replace'` path
    (`upload.js:737-774, 789-827`); result kinds `{ kind: 'new_book', bookId,
    title }`, `{ kind: 'merged', bookId, pushed }`, `{ kind: 'replaced', bookId,
    pushed }`, `{ kind: 'needs_you', bookId }`.
  - `cancel({ uploadId })` (`upload.js:~835`) removes the scratch repo.
  - **No view, axe or e2e level shipped with the engine** — all three were
    explicitly deferred to this task (upload.md Decision 9); the engine ships
    unit (`app/src/worker/upload.test.js`) and Worker-behavior
    (`app/src/worker/upload.behavior.test.js`) only.
- **books.shelf** (`tasks/refinements/books/shelf.md`) — the book-management
  screen `app/src/books/BooksScreen.jsx`, the `AddBookSheet` component
  (`:318`) and its three drawn ways in (New book, By link, Mine on Estante).
  The header comment reserves the fourth outright: "Upload (books.upload_ui,
  not this task)" (`BooksScreen.jsx:314`) — the Upload row does **not** exist
  yet; this task adds it. The pure display helpers `app/src/books/book-display.js`
  (`orderedBooks`, `canSaveFor`, `titleFor`) give the list of books the user
  can save to (the merge targets).

**Drivers complete but outside this task's `depends`** (they satisfy the
test-driving rule by being `complete 100`, not by a `depends` edge; no `.tji`
edit is made):

- **foundation.e2e_web** — the Playwright harness `e2e/web/` (three viewport
  projects, `lib/axe.js`, `lib/devices.js`), reused, not rebuilt.
- The existing **conflict-resolution surface** `app/src/books/BookConflicts.jsx`
  + `app/src/songs/SongConflict.jsx` (sync.conflicts) — where an upload merge
  that collides lands (the `needs_you` kind). This task does **not** build it;
  it only surfaces the `'conflict'` status word in the preview and lets that
  existing surface take over on confirm (Decision 2).

No merge target in any named test needs to be a *hosted* book, so
`account.sign_in` / `books.online` are **not** drivers here: a local book from
the New-book flow is savable, and an upload merged into it commits locally
(workflow 7 §Upload: "No account needed" for a new book).

## What this task is

The screen a user sees between picking a `.zip` and anything being written to a
book. From the Add-a-book sheet's new **Upload** way-in, a file picker accepts a
`.zip`; the app reads it to an `ArrayBuffer`, hands the bytes to the Worker
(`PREVIEW_UPLOAD`), and renders the returned preview: a segmented choice
(*Import as a new book* / *Merge into an existing book*), a merge-target picker,
the branch the zip is on, the **song-by-song** list with a status word per row
(*added* / *changed* / *conflict* / *replace* / *unresolved*), per-row keep
choices for the replace path, the informational *Left out* and *Put in canonical
form* cards, and a confirm row. Confirming sends `IMPORT_UPLOAD`; cancelling or
dismissing sends `CANCEL_UPLOAD`. It is purely the view, axe and the e2e-web
journey — the engine is done.

## Why it needs to be done

It is the only in-app path to the upload engine sync.upload built: without it
the `PREVIEW_UPLOAD` / `IMPORT_UPLOAD` / `CANCEL_UPLOAD` commands have no caller
and the fourth Add-a-book way-in (drawn in the W07 board, stubbed in
`AddBookSheet`) stays dark. It closes workflow 7's upload story — "how a
download edited on a computer comes home, and how a book kept elsewhere moves to
Estante" — and gives the project its import-from-a-file capability. It is a leaf
(nothing depends on it), so its value is entirely the delivered flow.

## Inputs / context

### Normative design

- **Workflow 7** `docs/workflows/07-add-a-book.md`:
  - *Add a book* L23-30 — the four ways in; "**Upload**: a zip (below)."
  - *Uploading a book* L64-82 — "A zip is uploaded, and the app reads it as a
    remote to pull from. It ends one of two ways: **Import as a new book** … its
    history becomes the book's … **Merge into an existing book**, one the user
    can save to … what collides goes to conflict resolution (workflow 9)."
    "Nothing in the zip is run: hooks, its config and its remotes are ignored."
  - *A preview comes first* L84-87 — "The upload shows what it would do, song by
    song — *added*; *changed*, with the musical summary; *conflict* — and
    nothing is written until it is confirmed. For a merge, the preview is the
    save sheet (workflow 4)."
  - *Edits never committed* L89-93 — the synthetic "*changes from the upload*"
    commit, "by the user uploading … shown in the preview like any other."
  - *A zip with no history* L95-99 — "each file that matches one in the book is
    offered as *replace with the uploaded version*, with its diff, chosen song
    by song; files with no match are added."
  - *A zip with a history unrelated to the book's* L101-104 — "the preview says
    the two share no history, and every song present in both is shown as a
    *conflict* to choose between."
  - *Which branch* L106 — "the zip's checked-out branch only, named in the
    preview."
  - *A merge left half done* L108-122 — a text holding git's conflict markers
    (cifra.md §11.12.3) "is never canonical, so it can never be saved or pushed".
    Working-tree marker: shown as "*unresolved merge: fix it before importing*",
    pointing at its first marker line, and **left out**; the rest goes ahead.
    Committed marker: "the preview names the commit and the file, and offers two
    ways on: fix it on the computer and upload again, or **import the latest
    version without its history**, if the latest version is itself clean".
  - *Unsaved changes in the book merged into* L124-126 — carried on top, still
    unsaved (the engine's job; the preview only reports).
- **Mockup board** `docs/mockups/W07-add-a-book.dc.html` (canvas.json L69-74):
  - Phone-2 draws the Add-a-book sheet's four ways in; **Upload** row copy: *"A
    zip of a book, with or without its history."* (L96-99).
  - Tablet draws the **preview** (L108-174, dev-label "Tablet · uploading a zip:
    the preview, before anything is written"): an appbar with a Cancel icon
    (aria-label *"Cancel the upload"*) + title *"Upload banda-do-bairro.zip"*;
    a *"What to do with it"* `role="radiogroup"` (aria-label *"What to do with
    the upload"*) with radios **"Import as a new book"** / **"Merge into an
    existing book"**; a *"Merge into"* book picker; the branch/why line *"From
    the zip's branch main, which shares its history with Banda do Bairro. Edits
    in the zip that were never saved are read as one more save: changes from the
    upload, by you."*; a *"Song by song"* `.list` with a per-row
    `<span class="badge {{cls}}">{{state}}</span>`; two cards **"Left out"**
    (*"A book holds songs, setlists, a README and .gitattributes, so these stay
    behind:"*) and **"Put in canonical form"** (*"The voicings are put in
    canonical order; the chart is left as written."*); a pre-filled **"Note"**
    field (*"Merge the upload from banda-do-bairro.zip"*); a confirm row,
    caption *"Nothing is written until you confirm. The conflict goes to
    resolution."*, buttons **"Cancel"** and primary **"Merge and save"**.
  - Status vocabulary from the board's `preview` data (L266-271): new song =
    **added** (badge `ok`), changed song = **changed** (badge `voiced`),
    conflicted song = **conflict** (badge `conflict`). Each badge carries a
    **word**, never colour alone (`docs/mockups/README.md:26`).
  - Tokens (`docs/mockups/theme.css`): `.badge` + `.badge.ok|.conflict|.voiced`
    (L175-183); `.seg` / `.seg button.on` segmented control (L164-167);
    `.list` / `.row` / `.row .name` / `.row .meta` / `.badges` (L185-197);
    `.btn.primary` / `.field` / `.input` (L151-160).
- **DIRECTION.md**:
  - §3.7 L420-461 — the app: React with React Aria Components; one data owner in
    a Web Worker that "does every clone, fetch, merge, save and index update";
    "A store on the main thread is fed by the Worker's messages." The upload
    engine's git/merge runs in the Worker; the view only sends commands and
    reads slices/events.
  - §3.1 L127-134 — unsaved work merged into incoming changes (the behaviour the
    engine reuses for an upload merge; the preview only reports it).

### Code seams this task extends

- **Add-a-book sheet** — `app/src/books/BooksScreen.jsx`: `AddBookSheet`
  (`:318`, props `onCreate, onByLink, onSignIn, onAddMine, onListMine, mine` —
  **no `onUpload` yet**), the RAC `DialogTrigger`/`ModalOverlay`/`Modal`/`Dialog`
  sheet pattern (`:323-360`). This task adds an **Upload** way-in row (copy from
  the board L96-99) and an `onUpload` prop that opens the file picker.
- **Store / slice seam** — `app/src/worker/store.js` (`store.send`,
  `store.slice`, `store.open`), `app/src/worker/useStore.js` `useSlice(store,
  name)` (`:15`); commands are `store.send(command(CommandKind.X, payload))`,
  events arrive on the store. The view sends `PREVIEW_UPLOAD` /
  `IMPORT_UPLOAD` / `CANCEL_UPLOAD` and consumes the `UPLOAD_PREVIEW` event and
  the subsequent shelf/sync slice updates. It never touches IndexedDB or git
  (DIRECTION §3.7).
- **Save-sheet reuse** — `app/src/songs/SaveSheet.jsx`, `app/src/songs/DiffRows.jsx`
  render the musical summary + diff rows; workflow 7 L87 ("the preview is the
  save sheet") makes a `'changed'` row render through the same components.
- **Portal** — RAC overlays portal into the `.est` theme root app-wide through
  `UNSAFE_PortalProvider` in `app/src/theme/ThemeRoot.jsx:67` (shell.portal_provider);
  no per-screen portal work is needed (see
  [[rac-overlays-portal-outside-est-theme-root]]).
- **Layout** — `app/src/shell/layout-mode.js`: `WIDE_QUERY = '(min-width: 600px)'`
  (`:22`). The preview is a **full-screen surface** with its own appbar (the W07
  tablet drawing), not the shelf's `BOOKS_WIDE_QUERY` (`:36`, 1080px)
  master-detail pane (Decision 1).
- **Zip reading for fixtures** — `app/src/worker/book-zip.js` `createZip(files,
  at?)` (`:86`), `readZip(buffer)` (`:152`), `crc32` (`:36`) — used by behavior
  tests to build an in-memory zip to feed the real engine.

### Test harness

- Behavior (React): `*.behavior.test.jsx` — `createLoopbackEndpoint(createLogic)`
  (`app/src/test/loopback.js`) → `createStore`, Testing Library, axe via
  `checkWcag21aa` (`app/src/a11y/axe.js`); RAC overlays portal into `.est`
  through `ThemeRoot`'s `UNSAFE_PortalProvider`. Query by text, never colour.
  Templates: `app/src/books/BooksScreen.behavior.test.jsx`,
  `app/src/books/BookConflicts.behavior.test.jsx`,
  `app/src/songs/SaveSheet.behavior.test.jsx`. Synthetic event injection for a
  hard-to-produce model is the established pattern
  ([[voicing-keepboth-synthetic-planResult]]).
- e2e-web: `e2e/web/tests/*.spec.js` against the compose stack, three viewport
  projects auto-run every spec; helpers `e2e/web/lib/axe.js` (`test`, `expect`,
  `checkA11y`), `lib/devices.js`. Playwright drives a file picker with
  `locator.setInputFiles(path)`. Template: `e2e/web/tests/books.spec.js`,
  `e2e/web/tests/online.spec.js`.

## Constraints / requirements

- **Component boundary (DIRECTION §3.7).** The view only sends commands and
  reads the preview event / slices; it reads no zip into git, runs no merge,
  touches no IndexedDB. Reading the picked `File` to an `ArrayBuffer` on the main
  thread and handing the **bytes** to the Worker is the only data handling here
  (sync.upload Decision; `protocol.js:334`).
- **Canonical form over preserving content.** The preview reports what the
  engine will leave out (non-song files, marked files) and what it canonicalises
  (voicings); the view **never** offers to keep a non-canonical spelling or a
  marked file. An `'unresolved'` row is shown as left out, not as an importable
  choice (workflow 7 L108-116).
- **A marked text is never imported.** An `'unresolved'` row carries the
  first-marker line and the "fix it before importing" wording and is excluded
  from the confirm; a history with committed markers offers only "fix and
  upload again" or, when the latest is clean, "import the latest version without
  its history" (`choice: 'latest_without_history'`). The view adds no third way.
- **Accessibility (standing rule).** Every interactive part is a React Aria
  Component with a keyboard path and an accessible name: the file picker, the
  `role="radiogroup"` choice, the merge-target picker (a RAC `Select`/`ComboBox`
  or `ListBox`), the per-row keep toggles, the Cancel and Merge/Import buttons.
  Status is a **word** in the badge, never colour alone. axe at WCAG 2.1 AA runs
  on the picker, the preview (each status present) and every overlay.
- **No song text in logs; fixtures are written for the purpose.** Behavior and
  e2e fixtures use songs written for the test; no copyrighted words. The view
  logs nothing about a zip's contents.
- **Offline first.** The whole flow is local (reading a zip, previewing,
  importing to a local book) and needs no network; a merge into a *hosted* book
  pushes through the engine's normal path, but no named test here requires a
  hosted target.

## Acceptance criteria

### Behavior delivered

1. **An Upload way-in.** `AddBookSheet` gains a fourth row, **Upload**, with the
   board's copy ("A zip of a book, with or without its history."), that opens a
   file picker accepting `.zip`. Picking a file reads it to an `ArrayBuffer` and
   sends `PREVIEW_UPLOAD { target: null, bytes }`; a non-zip / corrupt file
   surfaces the engine's `ERROR` as a worded message, never a crash
   (`protocol.js:342`).
2. **A preview surface** (full screen, its own appbar with a Cancel affordance,
   aria-label "Cancel the upload"), rendering the `UPLOAD_PREVIEW` model:
   - a `role="radiogroup"` "What to do with the upload" — **Import as a new
     book** / **Merge into an existing book**; the merge radio reveals a
     merge-target picker listing books the user can save to (`canSaveFor` /
     `orderedBooks`);
   - the zip's **branch** named, and the why-line about the synthetic "changes
     from the upload" commit when the engine reports one;
   - the **song-by-song** `.list`, one row per `previews` entry, each with its
     title, meta and a badge carrying the status **word**: *added*, *changed*
     (rendering the musical `summary`/`changes` through the save-sheet
     components), *conflict*, *replace*, *unresolved* (with its first-marker
     line and the "fix it before importing" wording, shown as left out);
   - for a no-history-into-existing preview (`hasHistory === false`, status
     `'replace'`), a **per-row keep** choice (song by song), feeding `perFile`;
   - the **Left out** and **Put in canonical form** informational cards
     (Decision 6);
   - when `historyMarkers` is present, a notice naming the commit and file, with
     an **Import the latest version without its history** action only when the
     engine reports the latest is clean (`latestClean`);
   - a confirm row — the caption "Nothing is written until you confirm", buttons
     **Cancel** and the primary **Import as a new book** / **Merge and save**
     (wording follows the chosen radio).
3. **Confirm / cancel.** Confirm sends `IMPORT_UPLOAD { uploadId, choice,
   target?, perFile? }` with `choice` derived from the radio and `hasHistory`
   (Decision 3): `'new_book'` (or `'latest_without_history'` for the escape
   hatch), or `'merge'` (`target: { bookId }`) when the zip has history, or
   `'replace'` (`target`, `perFile`) when it has none. On a `new_book` result
   the new book appears on the shelf and the surface closes; on
   `merged`/`replaced` the surface closes and the target reflects the change; on
   `needs_you` the existing conflict surface (`BookConflicts.jsx`) takes over
   (Decision 2). Cancel/dismiss, and a target change that re-previews, send
   `CANCEL_UPLOAD { uploadId }` for the superseded upload (Decision 5).

### Tests, by level

The `.tji` names **behavior** and **e2e-web**. Both are delivered; no level is
dropped, and no new level is needed (the git-history mechanics are already
pinned at the shipped Worker-behavior level `app/src/worker/upload.behavior.test.js`).

- **behavior (React) — `app/src/books/UploadPreview.behavior.test.jsx`**
  (axe clean on the picker, the preview for every status present, and every
  overlay):
  - *The Upload way-in and a real round-trip.* Through the loopback with the
    real `createLogic` upload engine: the Add-a-book **Upload** row opens a
    picker accepting `.zip`; feeding a **no-history** zip built in-test with
    `createZip` of authored `*.cifra.md` files previews all songs as **added**;
    confirming **Import as a new book** sends `IMPORT_UPLOAD { choice:
    'new_book' }` and the new book appears on the shelf. Switching to **Merge
    into an existing book** against a savable book re-previews as **replace**
    rows + **added** rows; toggling per-row keep and confirming **Merge and
    save** sends `IMPORT_UPLOAD { choice: 'replace', target, perFile }`. Pins
    workflow 7 §Uploading a book, §A zip with no history; `protocol.js:334-357`.
  - *Every status word renders (synthetic `UPLOAD_PREVIEW`).* Injected preview
    models (Decision 7) exercise **changed** (the musical summary + diff rows via
    the save-sheet components — workflow 7 L87), **conflict** (the word
    "conflict" and the "The conflict goes to resolution." caption, no in-preview
    resolver — Decision 2), **unresolved** (the "unresolved merge: fix it before
    importing" wording, the first-marker line, shown left out — workflow 7
    L108-116), and a **historyMarkers** notice naming the commit and file with
    the "Import the latest version without its history" action gated on
    `latestClean` (workflow 7 L117-122). Pins "song by song", "left out and
    canonicalised", "marked files", "history that cannot be rewritten" from the
    `.tji` note; the W07 tablet board.
  - *The Left out and Put in canonical form cards* render the board's copy, and
    the branch is named (workflow 7 L106; W07 board).
- **e2e-web — `e2e/web/tests/upload.spec.js`** (three viewport projects auto-run;
  axe at WCAG 2.1 AA on the picker, the preview and every overlay):
  - **A zip uploaded as a new book**: open Add a book → **Upload** →
    `setInputFiles` the import fixture → **Import as a new book** → confirm →
    assert the new book is on the shelf.
  - **…and merged into one**: upload the merge fixture → **Merge into an
    existing book** → pick the book just imported → the preview shows the song
    by song list → **Merge and save** → assert the target reflects the import.
  - Fixtures live under `e2e/web/fixtures/upload/`, authored for the test
    (no-song-text rule): a history-bearing book zip for the verbatim import, and
    a second zip (a shared-history variant, or a no-history folder of
    `*.cifra.md`) for the merge. Pins workflow 7; the three viewports; axe.

## Decisions

1. **The preview is a full-screen surface opened from the Add-a-book sheet, not
   the shelf master-detail pane.** *Chosen* to follow the W07 board, which draws
   the preview as a dedicated screen with its own appbar (Cancel icon + "Upload
   <name>") and a bottom confirm row, on the tablet frame. *Rejected*: rendering
   it in the shelf's `BOOKS_WIDE_QUERY` detail pane — the thing being previewed
   is not yet a book on the shelf, the board gives it a full screen, and the
   confirm/cancel framing is a focused task, not a persistent pane. On the phone
   it is a full-screen surface over the sheet; on tablet/computer it is the same
   full surface (the board draws one layout, not a split). Reusing the shell's
   RAC overlay + `UNSAFE_PortalProvider` is not a new seam.
2. **No per-conflict keep-mine/keep-theirs/keep-both selector lives in the
   upload preview.** The orchestrator brief framed one; the constitution does
   not. Workflow 7 L74 sends collisions "to conflict resolution (workflow 9)",
   the W07 board's confirm caption says "The conflict goes to resolution.", and
   the shipped engine turns a colliding upload merge into the ordinary
   `needs_you` state driven by the existing conflict session
   (`app/src/books/BookConflicts.jsx` / `app/src/songs/SongConflict.jsx`,
   sync.conflicts; `upload.js` Decision 3 reused that session rather than adding
   upload-conflict vocabulary). *Chosen*: the preview shows a `'conflict'` row
   as a status word and the "goes to resolution" caption, and confirming a merge
   that collides hands off to that existing surface. *Rejected*: a resolver in
   the preview — it would duplicate and diverge from the one conflict surface,
   re-introduce the keep-mine/keep-theirs/keep-both vocabulary sync.upload
   deliberately kept in one place, and contradict both the workflow and the
   board. (Consequently this task uses the engine's real `choice`/`perFile`
   payload, not the brief's `strategy: 'verbatim'|'merge'` + `conflictResolutions`
   map, which the shipped engine never defined.)
3. **Merge vs replace is derived from the preview's `hasHistory`, both under the
   single "Merge into an existing book" radio.** *Chosen* per workflow 7 L95-99
   ("Into an existing book there is no common ancestor to merge from, so it is
   not a merge … offered as *replace with the uploaded version*, chosen song by
   song") and the engine's `choice` values: a zip with history →
   `choice: 'merge'`; a zip with none → `choice: 'replace'` with per-row
   `perFile`. The user sees one "merge into" choice; the view picks the right
   `choice` from `hasHistory`. *Rejected*: exposing "merge" and "replace" as two
   separate radios — the board draws two radios (new / merge), and the
   distinction is a consequence of the zip, not a user decision.
4. **The default selection is "Import as a new book."** *Chosen* because it is
   always valid (no target, no account, no probing) and is the first
   `PREVIEW_UPLOAD` (`target: null`). *Rejected*: defaulting to "Merge into an
   existing book" preselected to a book the zip shares history with (the board's
   example default) — finding that book would mean previewing the zip against
   every savable book (N scratch repos materialised), and the board's
   merge-default reflects its "a download comes home" example scenario, not a
   general rule. The user picks a merge target explicitly.
5. **Changing the target re-previews, and the superseded `uploadId` is
   cancelled.** *Chosen* because `preview()` mints a fresh `uploadId` and scratch
   repo each call and computes `previews` **against the given target** (a merge
   preview needs the target at preview time), so switching to a merge target, or
   between merge targets, re-sends `PREVIEW_UPLOAD { target, bytes }`; the view
   sends `CANCEL_UPLOAD { uploadId }` for the prior preview so scratch repos do
   not leak. *Rejected*: one preview reused across choices — the engine cannot
   produce a target-specific preview without the target.
6. **The "Left out" and "Put in canonical form" cards render static explanatory
   copy, not payload-driven per-path lists.** The shipped `UPLOAD_PREVIEW`
   payload (`{ uploadId, target, branch, hasHistory, sharedHistory,
   historyMarkers, previews }`) carries only the song-by-song decisions; it does
   not enumerate the non-song files left behind or the voicing-canonicalisation.
   *Chosen*: render the board's sentences ("A book holds songs, setlists, a
   README and .gitattributes, so these stay behind." / "The voicings are put in
   canonical order; the chart is left as written.") as static informational
   cards — the behaviour they describe is structurally invariant for every
   upload, so the copy is true without a per-path list, and the board's mono
   paths are illustrative sample data from its example zip. *Rejected*:
   extending `UPLOAD_PREVIEW` to enumerate left-out / canonicalised paths — that
   is a Worker-engine change owned by sync.upload (with its own Worker-behavior
   tests), out of scope for a view task, and not needed to tell the user the
   truth. No design delta; no follow-up task (the enumeration is cosmetic, not a
   missing capability).
7. **The view-behavior test drives the real engine for the no-history path and
   injects synthetic `UPLOAD_PREVIEW` models for the git-history-dependent
   statuses.** *Chosen* because jsdom has no git CLI to build a history-bearing
   or marked-history zip, while a no-history zip is a plain `createZip` of
   authored `*.cifra.md` files — so the real round-trip (picker → PREVIEW →
   confirm) is exercised for **added** and **replace**, and the **changed /
   conflict / unresolved / historyMarkers** rows are rendered from injected
   models (the established synthetic-model pattern,
   [[voicing-keepboth-synthetic-planResult]]). The full git-history import,
   verbatim history, marked-file exclusion and merge mechanics are already pinned
   at the shipped Worker level (`app/src/worker/upload.behavior.test.js`) and at
   e2e-web (real stack, real zip fixtures). *Rejected*: building a git repo
   in-test for the React behavior level — it would duplicate the Worker-behavior
   coverage and drag a git dependency into jsdom.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-13.

- `app/src/books/UploadPreview.jsx` — new full-screen upload-preview surface: `role="radiogroup"` choice (Import as a new book / Merge into an existing book), merge-target RadioGroup picker, branch/why line, song-by-song list with status badges (*added*, *changed*, *conflict*, *replace*, *unresolved*), per-row keep toggles for the replace path, Left out and Put in canonical form cards, historyMarkers notice, confirm row with Cancel and primary Import/Merge buttons.
- `app/src/books/upload-preview.css` — styles for the preview surface, including the VisuallyHidden input-cover override that makes RAC radio labels hittable by Playwright.
- `app/src/books/BooksScreen.jsx` — Upload way-in row added to `AddBookSheet` (board copy "A zip of a book, with or without its history."), `onUpload` prop, full-screen render branch that shows `UploadPreview` overtop the sheet.
- `app/src/i18n/locales/{en,es-419,it,pt-BR}.js` — new `books.upload*` i18n keys (27 strings, parity across four locales).
- `e2e/web/fixtures/upload/book.zip`, `e2e/web/fixtures/upload/merge.zip` — authored test fixtures (no song text), a history-bearing zip and a no-history zip for the e2e journeys.
- `app/src/books/UploadPreview.behavior.test.jsx` — 9 behavior tests: real loopback round-trip (Upload→picker→added preview→Import as new book→shelf; switch to Merge→replace+added→per-row keep→Merge and save with `perFile`), synthetic models for *changed*/*conflict*/*unresolved*/`historyMarkers`+`latestClean`, branch and cards, cancel→CANCEL_UPLOAD, axe on picker and preview with every status.
- `e2e/web/tests/upload.spec.js` — 2 e2e-web tests × 3 viewports (6 total): new-book import and import-then-merge; axe at WCAG 2.1 AA on picker/preview/merge/files. Locators made `{ exact: true }` (fixer 1) to survive Playwright strict mode against the `.meta` summary line.
