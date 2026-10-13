# sync.upload — Upload a zip

## TaskJuggler

[`task upload`](../../45-sync.tji) in `tasks/45-sync.tji` (area `sync`):
*"Upload a zip."*

## Effort estimate

4d (from the WBS leaf).

## Repository

**estante-de-cifras**, the app — the Web Worker data core only:

- `app/src/worker/` — one new subsystem (`upload.js`) that reads a zip as a
  git remote, materialises it, previews a prospective import/merge song by
  song, and commits on confirm; plus new `CommandKind`/`EventKind` entries in
  `protocol.js`, their handlers in `logic.js`, and a small generalisation of
  `conflicts.js` (the incoming ref) so an upload merge's collisions reuse the
  existing conflict session.
- `app/src/worker/*.test.js`, `app/src/worker/*.behavior.test.js` — the unit
  and Worker-behavior tests.

**No React view and no e2e in this task.** The upload *preview screen* (the
*Upload* entry on *Add a book*, the song-by-song preview rendered as the save
sheet, its axe coverage) and the end-to-end journey are
[`books.upload_ui`](../../65-books.tji) (`task upload_ui`, `depends
sync.upload, !shelf`), the downstream consumer this task unblocks — see *Why*
and Decision 9. Accessibility (RAC, keyboard, axe) is that task's; this task
ships no interactive UI.

No cifra.md work: the merge, the semantic diff, `resolveMarked` and the §8
writer all already ship inside the `cifra-md` package
(`app/package.json`: `"cifra-md": "file:../../cifra.md/js"`).

## Inherited dependencies

Settled:

- **`sync.engine`** (`depends !engine`, complete — [[../sync/engine]]). The
  per-book `fetch → cifra-aware merge → push` loop, and the seams this task
  reuses verbatim:
  - `createSyncEngine(deps)` (`app/src/worker/sync-engine.js:156`), whose
    per-book git ops are **fully injectable** (`fetchBook`, `pushBook`,
    `mergeBook`, `treeDirty`, `listBooks`, …) — the natural seam for a "merge
    from this unpacked zip" path.
  - `defaultMergeBook(bookId, author)` (`sync-engine.js:319`): the committed
    merge via `igMerge({ fs, dir, ours:'main',
    theirs:'refs/remotes/origin/main', abortOnConflict:true, fastForward:true,
    mergeDriver, message:'Merge' })` (`:331`), then `checkout({ ref:'main',
    force:true })` (`:353`); returns `{ merged, fastForward, before, after }`.
    An upload merge is this with `theirs` pointed at the zip's ref.
  - `captureDirtyWork(bookId, headOid)` (`:233`) and
    `reapplyDirtyWork(bookId, captured)` (`:269`) — the base/theirs/working
    three-way that keeps unsaved edits on top of a merge (DIRECTION §3.1); an
    upload merge reuses it so §Unsaved changes (workflow 7 L124-126) is the
    sync behaviour, not new code.
  - `SyncConflictError` (`:57`) — the halt an unsettleable merge raises.
- **`cifra_js.merge`** (via `sync.engine`; complete). `merge(base, ours,
  theirs, { setlist }) → Outcome` (`cifra.md/js/src/merge.js:634`, exported
  `cifra.md/js/src/index.js:118`), `Outcome = { result, deleted, conflicts,
  marked, kept, kind }`, `kind ∈ result|deleted|conflicts`. Wrapped for the
  Worker in `app/src/worker/cifra-merge-driver.js`:
  `createCifraMergeDriver(options)` (`:43`, the `igMerge` driver callback),
  `recomputeMerge({ base, ours, theirs, setlist })` (`:114`, a direct per-file
  recompute outside the tree walk — what the preview calls), and
  `reapplyWorkingText(...)` (`:118`).
- **`cifra_js.diff`** (via `songs.save_sheet`; complete — [[../songs/save_sheet]]).
  `diff(before, after) → { changes, summary }` (`cifra.md/js/src/diff.js`),
  imported from `cifra-md`; `summary` is the neutral-English one-line musical
  summary (the save sheet's "what changed"). The upload preview computes the
  same summary for a *changed* song.
- **`sync.conflicts`** (via `sync.engine`; complete — [[../sync/conflicts]]).
  The Worker merge session `createConflicts(deps)`
  (`app/src/worker/conflicts.js:139`) → `{ hasInProgressMerge, open, resolve,
  commitMerge, abandon }`, recomputing the musical-terms conflict model from
  `OURS='main'` / `THEIRS='refs/remotes/origin/main'` / the merge base
  (`conflicts.js:41-42`), with `OPEN_CONFLICTS`/`RESOLVE_CONFLICT`/
  `COMMIT_MERGE`/`ABANDON_MERGE` and the `needs_you` phase. conflicts.md
  anticipated this task: resolution is *"reached from sync (workflow 8) and,
  later, from merging an upload (workflow 7)."* The `firstMarkerRefusal` /
  `canonicaliseFile` gate (`app/src/worker/canonicalise.js`) is the single §8
  writer authority for "is this text marked / canonical".
- **`books.online`** (`depends books.online`, complete). `createOnline({ fs,
  git, locks, booksClient })` (`app/src/worker/online.js:70`) — the reverse of
  this task. `download({ bookId })` (`:203`) walks the whole book dir (the
  `.git` and the working tree) and zips it with `createZip`; `putOnline`
  (`:161`) creates the book on Estante and pushes. A book that is *on Estante*
  is the merge-into-an-online-book target; `books.online` provides it (one
  device's own book — no invitation needed).
- **`books.js` scaffold** (via `storage`; complete). `createBooks({ fs, git,
  locks })` (`app/src/worker/books.js:55`) → `createLocal({ title, author })`
  (`:70`): mint `local-<uuid>`, `git.init`, write `README.md` (`# {title}`) +
  `.gitattributes` (`GITATTRIBUTES_BYTES`, `:33`, the `*.cifra.md merge=cifra`
  attributes), one `'Create book'` commit, no push. The *import as a new book*
  path writes a first commit the same way.
- **The zip reader** (via `books.online`; complete). `readZip(buffer) →
  { name, bytes }[]` (`app/src/worker/book-zip.js:152`) and `crc32` (`:36`),
  dependency-free (`CompressionStream`/`DecompressionStream`), built for
  **binary** entries precisely so a git repo's `.git/objects` round-trip. It
  has **no production consumer yet** — this task is its reader side.
- **The git/fs layer** (via `storage`; complete). `createGitLayer({ fs, http })`
  (`app/src/worker/git.js:48`) → `{ init, clone, fetch, push, setRemote,
  bookDir }`, `bookDir(id) → /books/<id>` (`:67`); the store is
  `@isomorphic-git/lightning-fs` over IndexedDB (`app/src/worker/fs.js`
  `createFileSystem`). Low-level git (`merge`, `walk`, `TREE`, `resolveRef`,
  `writeRef`, `readBlob`, `checkout`, `add`, `commit`) is called on
  isomorphic-git directly over the shared `fs`, as `working-copy.js` and
  `conflicts.js` do.
- **`foundation.e2e_api`** (via `task sync` depends; complete). Not needed
  here — this task carries no e2e (Decision 9). The Worker-behavior rig is
  `app/src/test/git-http-remote.js` (`startGitHttpRemote`),
  `app/src/test/loopback.js` (`createLoopbackEndpoint`),
  `app/src/test/web-locks.js` (`installWebLocks`), `fake-indexeddb`.

Pending: none — every dependency is `complete 100`.

## What this task is

The Worker engine behind **workflow 7 §Uploading a book**: the user picks a
zip (a `download` of a book, or a folder of `*.cifra.md` files zipped on a
computer), and the app **reads it as a remote to pull from**. The task:

1. **Reads the zip as a git repo.** `readZip` the bytes, materialise the
   entries into a scratch repo on the fs, find its checked-out branch, and
   point a **temporary ref** at that branch's head — *"copying its objects
   into the book's store and pointing a temporary ref at its head."* Nothing
   in the zip is run: hooks, config and remotes are ignored, only paths inside
   the repository are read, and entry names that would escape the scratch dir
   are refused.
2. **Reads the uploader's uncommitted edits as one more commit.** Changes in
   the zip's working tree that were never committed there are staged and
   written as a synthetic *changes from the upload* commit on top of the head,
   authored by the uploading user, so they appear in the preview and merge
   like any other.
3. **Previews, song by song, before anything is written to the book** —
   *added*; *changed*, with the musical summary (the `diff` `summary`);
   *conflict*; and the special cases below. For a merge the preview is the
   save sheet (workflow 4); for a no-history replace it is each matching file
   offered as *replace with the uploaded version*, with its diff.
4. **On confirm, lands it one of two ways.** *Import as a new book* — the
   zip's history becomes a fresh local book's (objects copied, head retargeted
   for a repo with history; one canonical first commit for a folder, an
   unrelated-choice set, or the latest-without-history escape hatch). *Merge
   into an existing book the user can save to* — the same cifra-aware merge
   sync uses, with the zip's ref as *theirs*; a clean merge is committed and
   pushed, and what genuinely collides lands in the existing conflict session
   (workflow 9, `needs_you`). Unsaved changes in the book merged into are
   carried on top, still unsaved (DIRECTION §3.1).

It covers the awkward shapes workflow 7 names: a zip with **no history**, a
zip with a **history unrelated** to the book's, a zip holding git **conflict
markers** in its working tree or its history, and the standing rule that
**Estante writes only canonical content** wherever it authors a commit.

## Why it needs to be done

*Add a book* (workflow 7) offers four ways in; three are built (new book,
by-link, mine-on-Estante). **Upload** is the fourth, and the only one that is
missing: *"This is how a download edited on a computer comes home, and how a
book kept elsewhere moves to Estante."* `download` (`books.online`) writes the
zip; nothing reads it back — `readZip` has no consumer. Without this task a
book that left Estante as a zip can never return, and the round trip the
download promises is half-open.

The downstream consumer is **`books.upload_ui`** (`tasks/65-books.tji:50`,
`depends sync.upload, !shelf`): the *Upload* tile on *Add a book* and the
preview screen rendered as the save sheet, with its own behavior (axe) and
e2e-web tests. That task reads the preview model and issues the confirm
command this task defines; it cannot start until this engine exists.

## Inputs / context

Governing documents (normative — the refinement turns their promises into a
work order, it does not redesign them):

- **Workflow 7** — `docs/workflows/07-add-a-book.md` (status: decided), the
  §Uploading a book block (`:65-127`):
  - §Ends one of two ways (`:68-74`): *import as a new book* (its history
    becomes the book's, put online like any local book) or *merge into an
    existing book* (the zip's history merged by the same cifra-aware merge
    sync uses; what collides goes to conflict resolution, workflow 9).
  - §The preview (`:84-87`): *"A preview comes first … song by song — added;
    changed, with the musical summary; conflict — and nothing is written until
    it is confirmed. For a merge, the preview is the save sheet (workflow 4):
    confirming makes the merge commit, and pushes it."*
  - §Objects, nothing run (`:79-82`): *"pulling from the zip is copying its
    objects into the book's store and pointing a temporary ref at its head.
    Nothing in the zip is run: hooks, its config and its remotes are ignored,
    and only paths inside the repository are read."*
  - §Edits never committed (`:90-93`): working-tree changes *"are read as one
    more commit on top of its head — changes from the upload, by the user
    uploading — and shown in the preview like any other."*
  - §A zip with no history (`:96-99`): becomes a new book with one first
    commit; into an existing book there is no common ancestor, so it is **not a
    merge** — each matching file is offered as *replace with the uploaded
    version* with its diff, chosen song by song, non-matching files added.
  - §A zip with unrelated history (`:101-104`): may be merged, but the preview
    says the two share no history, and every song present in both is shown as a
    conflict to choose between.
  - §Which branch (`:106`): the zip's checked-out branch only, named in the
    preview.
  - §A merge left half done (`:108-123`): working-tree markers →
    *"unresolved merge: fix it before importing"*, pointing at the first marker
    line, left out, the rest proceeds; a merge into an existing book never
    merges a marked file (that song stays as the book has it). History markers
    → the preview names the commit and file and offers *fix on the computer and
    upload again* or *import the latest version without its history* (if the
    latest is itself clean), as a book with one first commit.
  - §Unsaved changes in the book merged into (`:124-126`): handled as sync
    handles them (DIRECTION §3.1) — the merge lands in the saved book, the
    unsaved changes carried on top, still unsaved.
- **DIRECTION** — `docs/DIRECTION.md`:
  - §2.1 (`:74`): a book's title is the level-1 heading of its README, or the
    repository name — what the preview shows for an imported book.
  - §2.2 (`:77-101`): the cifra-aware merge; every version canonicalised first
    and the result canonical (`:84-85`); *"What genuinely collides becomes a
    conflict the app shows in musical terms (workflow 9). Its edit option
    writes git's conflict markers … and a text holding them is never canonical,
    so it is never saved or pushed."* (`:94-97`).
  - §3.1 (`:127-134`): *"With unsaved work in the working copy, incoming
    changes are merged into it — base, theirs, and the working text — so the
    user's edits stay unsaved and land on top."* (`:129-131`).
  - §3.6 (`:287-328`): the app's git runs through isomorphic-git in a Web
    Worker (`:291`); the app and the service share no code, only the HTTP API
    and the format (`:299-302`).
  - §3.7 (`:420-461`): *"One owner for the data: a Web Worker. It holds git,
    the working copy and the search index … The main thread never touches
    IndexedDB."* (`:432-433`).
- **cifra.md spec** — `/home/ruoso/devel/cifra.md/spec/`:
  - `spec/11-merge.md` §11 — the merge chapter; §11.1 table (`:59-69`) places
    the cases: *"Uploading a book with history … Base: as for sync; Ours: the
    book's; Theirs: the upload's"* (`:63`); unrelated-history upload has **no
    merge base** (`:64`); *"A book uploaded with no history at all is not
    merged: with no common version there is nothing to merge from, and an
    application that offers to replace a file with the uploaded one performs no
    merge."* (`:67-69`).
  - §11.4 (`:161-218`): *"An application MAY, for unrelated histories, offer
    each file present on both sides as a choice between the two instead of
    merging it, as Estante's upload does."* (`:180-182`); **Marked inputs**
    (`:193-205`): a present input holding a marker line *"is never merged …
    the outcome is a single unresolved conflict naming each marked input …
    and ours stays exactly as it is, byte for byte, or stays absent."*;
    deleted-vs-changed (`:184-186`) and not-UTF-8 (`:188-191`).
  - §11.12.3 Marker lines (`:1035-1056`): a marker line is `<<<<<<<`,
    `=======`, `>>>>>>>` or `|||||||` after the text layer; *"A text that holds
    a marker line is a marked text … It is never canonical … A writer MUST NOT
    save one: it MUST refuse, and point at the first marker line."*
  - `spec/8-normalisation.md` §8.1 (`:8-55`): the canonical form; *"A writer
    that saves a document MUST save it in canonical form."* (`:35-37`); a
    marked text is never canonical (`:30-33`); *"Canonical form takes
    precedence over preserving the text."* (`:39-51`).

Seams in the source (all shipped — cited in Inherited dependencies):
`app/src/worker/book-zip.js` (`readZip`), `sync-engine.js`
(`createSyncEngine`, `defaultMergeBook`, `captureDirtyWork`/`reapplyDirtyWork`),
`cifra-merge-driver.js` (`createCifraMergeDriver`, `recomputeMerge`),
`conflicts.js` (`createConflicts`), `canonicalise.js` (`firstMarkerRefusal`,
`canonicaliseFile`), `conflict-model.js` (`songConflictModel`),
`save-preview.js` (`diff`-based per-song `{ changes, summary, isNew }`),
`books.js` (`createLocal`, `GITATTRIBUTES_BYTES`), `online.js`
(`createOnline`, `copyTree`, `listFiles`), `git.js` (`createGitLayer`),
`fs.js` (`createFileSystem`), `protocol.js` (`command`/`event`, `CommandKind`/
`EventKind`), `logic.js` (`createWorkerLogic`, the dispatch switch, the
`ensureX` composition).

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data** (DIRECTION
  §3.7). Everything in this task runs in the Worker, under the target book's
  one Web Lock (`locks.js` `withLock(bookId, …)`) for any write to it. The main
  thread reads the zip `File` to an `ArrayBuffer` and sends the **bytes** in a
  command (structured clone, as `download` returns bytes the other way); the
  Worker never touches the DOM file picker, IndexedDB above the fs layer, or
  git from the main thread.
- **Nothing in the zip is executed; the zip is untrusted input.** Only
  `.git/objects`, `.git/refs`, `.git/HEAD`, `.git/packed-refs` and working-tree
  paths are read; `.git/hooks`, `.git/config` (and so its remotes) are ignored.
  Entry names are validated to stay inside the scratch dir — no absolute paths,
  no `..` traversal, no escape (zip-slip) — and a buffer that is not a zip, or
  an entry that failed its CRC, is rejected (`readZip` throws; the Worker
  surfaces it as an error event, never a crash).
- **Nothing is written to the book until confirm.** PREVIEW materialises only
  the scratch repo (under an `/uploads/<uploadId>` path) and reads the target
  read-only to classify; it never mutates the book. IMPORT, under the book's
  lock, is the only writer. A cancel removes the scratch repo.
- **Canonical form over preserving content — Estante writes only canonical,
  never a marked text.** Wherever this task *authors* a commit (the first
  commit of a folder / unrelated-choice / latest-without-history import, the
  synthetic *changes from the upload* commit, the merge commit), the content is
  canonical: songs go through the §8 writer (`cifra-md` `write`/`canonical`),
  and the cifra merge returns canonical results by construction. A **verbatim
  history import** (objects copied) is git transport, not a document write, and
  is taken as-is — the canonical requirement on such history bites only when
  the book is later put online and pushed (the hook, workflow 14), which is
  `books.online`'s, not this task's. A **marked** text is never written: a
  marked working-tree file is left out of the import with a notice; marked
  history forces the latest-without-history escape hatch; a merge never merges
  a marked input (spec §11.4, §11.12.3). The one gate for "is this marked /
  canonical" is `canonicalise.js` (`firstMarkerRefusal`/`canonicaliseFile`) —
  never a re-implemented marker scan.
- **The merge is the cifra-aware merge, reused, not re-implemented.** An
  upload merge is `defaultMergeBook`'s `igMerge` with `theirs` pointed at the
  zip's temporary ref and `mergeDriver = createCifraMergeDriver(...)`; a merge
  that collides raises `SyncConflictError` and hands off to the conflict
  session. The preview classifies per file with `recomputeMerge` over the
  three trees (the same `cifra-md` `merge`), never a bespoke comparison.
- **Collisions reuse the existing conflict session.** `conflicts.js` is
  generalised by one injectable — the **incoming ref** (default
  `refs/remotes/origin/main`) — so an upload merge leaves `main` at *ours*, the
  zip's ref retained as the incoming ref, and the book `needs_you`, exactly as
  a racing sync does; `OPEN_CONFLICTS`/`RESOLVE_CONFLICT`/`ABANDON_MERGE` then
  drive keep-mine / take-theirs / edit / abandon unchanged. Abandon resets the
  book to before the upload and drops the retained ref and the scratch repo.
- **Unsaved changes are carried on top** (DIRECTION §3.1; workflow 7 L124-126)
  by reusing `captureDirtyWork`/`reapplyDirtyWork` — no new three-way code.
- **No song text, no commit messages, no secrets in logs** (standing rule).
  The synthetic commit's subject is a fixed content-free *"changes from the
  upload"*; the merge commit is the engine's content-free `'Merge'`. Nothing
  from the zip's config or remotes is logged. Test fixtures are songs written
  for the purpose, never anyone's copyrighted words.
- **No React, no axe here.** This task ships no interactive surface;
  accessibility is `books.upload_ui`'s (Decision 9).

## Acceptance criteria

### Behavior delivered

1. **Read the zip as a remote.** Given zip bytes, the Worker `readZip`s them,
   materialises a scratch repo, finds the zip's checked-out branch, points a
   temporary ref at its head (copying objects into the store), and reports the
   branch name for the preview. A zip that is not a git repo (a bare folder of
   files) is recognised as *no history*. Entry names that escape the scratch
   dir, a non-zip buffer, or a CRC failure are refused. Nothing in the zip is
   executed; hooks/config/remotes are ignored. *Pins workflow 7 §Objects
   (`:79-82`), §Which branch (`:106`).*
2. **Edits never committed as a commit.** Working-tree changes in the zip that
   were never committed there are staged and written as one synthetic *changes
   from the upload* commit on top of the head, authored by the uploading user,
   and appear in the preview and the merge like any other change. *Pins §Edits
   never committed (`:90-93`).*
3. **Preview before writing.** PREVIEW returns a per-song model — `{ path,
   title, status: 'added' | 'changed' | 'conflict' | 'replace' | 'unresolved',
   changes?, summary? }` — where *changed* carries the `diff` `summary` and
   `changes` (the save sheet's "what changed"); the target book is not mutated.
   *Pins §The preview (`:84-87`).*
4. **Import as a new book, with history.** On confirm, the zip's objects are
   copied into a fresh `local-<uuid>` book, `main` pointed at the checked-out
   branch's head; the book is openable and can be put online like any local
   book; its history is taken verbatim (not rewritten). *Pins §Ends one of two
   ways (`:68-71`), spec §11.1 (`:63`).*
5. **No history.** A zip of `*.cifra.md` files with no `.git` becomes, as a new
   book, one canonical first commit; into an existing book it is **not a
   merge** — each file matching one in the book is a *replace with the uploaded
   version* choice (with its diff), chosen song by song, and non-matching files
   are added, committed as one ordinary (single-parent) commit. *Pins §No
   history (`:96-99`), spec §11.1 (`:67-69`).*
6. **Unrelated history.** A zip whose history shares no ancestor with the book
   may be merged, but the preview reports *no shared history* and shows every
   song present in both as a conflict to choose between (merge base absent =
   the empty tree). *Pins §Unrelated history (`:101-104`), spec §11.4
   (`:180-182`).*
7. **Marked files in the working tree, left out.** A working-tree file holding
   a marker line is shown in the preview as *unresolved merge: fix it before
   importing*, with the 1-based first marker line, and left out of the import;
   the rest of the upload proceeds. A merge into an existing book never merges
   a marked input — that song stays as the book has it. *Pins §A merge left
   half done (`:110-116`), spec §11.4 Marked inputs (`:193-205`), §11.12.3.*
8. **Markers committed in history.** A marked text in the zip's history is
   named in the preview (commit and file) with two ways on: *fix on the
   computer and upload again*, or — when the latest version is itself clean —
   *import the latest version without its history*, which writes the latest
   clean tree as one canonical first commit (as a book with no history).
   *Pins §A merge left half done (`:117-123`).*
9. **History rewritten to canonical.** Wherever Estante authors a commit on
   import (the first commit of a folder / unrelated-choice / latest-without-
   history import, and the synthetic working-tree commit), each song is written
   in canonical form by the §8 writer; a non-canonical-but-clean uploaded song
   lands canonical, never in its original spelling. A verbatim history import
   is left as the zip authored it (Decision 5). *Pins the standing canonical-
   form rule, spec §8.1 (`:35-37`), DIRECTION §2.2 (`:84-85`).*
10. **Merge into an existing book, and conflicts.** A clean upload merge is
    committed (the cifra-aware merge with the zip's ref as *theirs*) and pushed
    (offline → committed, pushed at the next sync); unsaved changes in the book
    are carried on top, still unsaved. A colliding merge leaves `main` at
    *ours* with the zip's ref retained as the incoming ref and the book
    `needs_you`, so the existing conflict session resolves it; abandon resets to
    before the upload. *Pins §Ends one of two ways (`:72-74`), §Unsaved changes
    (`:124-126`), DIRECTION §3.1 (`:129-131`), spec §11.1 (`:63`).*

### Tests the task lands with, by level

The note's `Tests:` clause names **unit** and **behavior**; this task adds no
level and drops none. There is no behavior-view / axe / e2e level because this
task ships no React view — the preview screen, its axe coverage and the
end-to-end journey are `books.upload_ui`'s (Decision 9).

- **unit** — `app/src/worker/upload.test.js`: *reading a zip as a remote*, with
  no network remote (over `createFileSystem` on `fake-indexeddb`, purpose-
  written song bytes). `readZip` → materialise → the checked-out branch found
  and a temporary ref pointed at its head; a bare folder recognised as *no
  history*; the synthetic *changes from the upload* commit built from a dirty
  working tree (acceptance 2); a zip-slip entry name refused, a non-zip buffer
  rejected, a CRC failure rejected; `.git/hooks` and `.git/config` ignored,
  nothing executed. *Pins workflow 7 §Objects (`:79-82`), §Which branch
  (`:106`), §Edits never committed (`:90-93`); the zip reader
  (`book-zip.js:152`).*
- **behavior (Worker)** — `app/src/worker/upload.behavior.test.js`, on the
  Worker rig (`createLoopbackEndpoint`, `installWebLocks`, `createFileSystem`
  on `fake-indexeddb`, and `startGitHttpRemote` for the push-on-confirm /
  merge-into-an-online-book cases — `books.online` provides the hosted target),
  each workflow-7 case against a local repository:
  - **import as a new book, with history** — objects copied, `main` at the
    checked-out branch head, the book openable (acceptance 4);
  - **merge into an existing book, clean** — the cifra merge committed and
    pushed; unsaved edits in the book carried on top, still unsaved
    (acceptance 10; §Unsaved changes);
  - **merge into an existing book, collision** — leaves `needs_you` with the
    retained incoming ref; the conflict session opens and `ABANDON_MERGE`
    resets to before the upload (acceptance 10);
  - **no history** — new-book first commit, and existing-book replace-per-file
    + additions as one ordinary commit (acceptance 5);
  - **unrelated history** — preview reports no shared history, each common song
    a conflict (acceptance 6);
  - **marked files left out** — the working-tree marker file is previewed
    *unresolved merge: fix it before importing* with its first marker line and
    left out; the rest imports (acceptance 7);
  - **committed markers** — the preview names the commit/file and
    *import the latest version without its history* writes one canonical first
    commit (acceptance 8);
  - **history rewritten to canonical** — a non-canonical-but-clean uploaded
    song lands canonical in an Estante-authored commit (acceptance 9);
  - **edits never committed as a commit** — the uncommitted working-tree edit
    is brought in via the synthetic commit (acceptance 2);
  - **nothing written until confirm** — PREVIEW leaves the target book's HEAD
    unchanged; a cancel removes the scratch repo (acceptance 3).

  *Pins workflow 7 §Ends one of two ways / §The preview / §No history /
  §Unrelated history / §A merge left half done / §Unsaved changes; spec §11.1,
  §11.4, §11.12.3, §8.1; DIRECTION §3.1.*

(The downstream **behavior (view) + e2e-web** — the preview rendered as the
save sheet on three viewports with axe — are `books.upload_ui`'s named tests,
not deferred debt of this task: this task delivers no view.)

## Decisions

1. **The upload engine is a new Worker subsystem, `upload.js`, composed like
   `online.js`/`add-by-link.js`.** `createUpload({ fs, git, locks, books,
   syncEngine, conflicts, booksClient })` exposes `preview({ target, bytes })`
   and `import_({ uploadId, choice, perFile })`, wired in `logic.js` behind new
   `CommandKind.PREVIEW_UPLOAD` / `IMPORT_UPLOAD` (and a `CANCEL_UPLOAD`) and
   `EventKind.UPLOAD_PREVIEW` / the existing `BOOK_CLONED`-style, `SYNC`,
   `MERGED`, `CONFLICTS` events on confirm, through the `ensureX` lazy-compose
   pattern. *Rationale:* every data operation is already a small
   `create*({ fs, git, locks })` factory over the shared fs; upload is one
   more, reusing the merge/diff/conflict factories by injection rather than
   duplicating them. *Rejected:* folding upload into `sync-engine.js` — the
   engine is the *automatic* loop (triggers, retry, the shelf sweep); an upload
   is a one-shot user act with a preview/confirm handshake, a different
   lifecycle.

2. **Read the zip as a remote by materialising a scratch repo + a temporary
   ref, not by a new transport.** `readZip` the bytes, write the entries into
   `/uploads/<uploadId>` (a non-bare repo, since the download zips a non-bare
   repo), read its `.git/HEAD` to find the checked-out branch, resolve that
   branch to an oid, copy the scratch `.git/objects` into the target's object
   store (the `copyTree` pattern from `online.js:136`, byte-preserving), and
   `writeRef` a temporary `refs/upload/<uploadId>` at the oid. The merge/preview
   then read that ref as *theirs*. *Rationale:* git objects are content-
   addressed, so copying is safe and idempotent; isomorphic-git's HTTP
   transport cannot speak `file://`, and the fs is shared, so an in-fs object
   copy is both simpler and exactly what the workflow describes (*"copying its
   objects into the book's store and pointing a temporary ref at its head"*).
   *Rejected:* adding a `file://`/in-memory git remote to `git.js` — more
   surface, no gain; the narrow `origin`/`main` transport stays untouched.

3. **The temporary ref is the incoming ref the conflict session already
   knows.** `conflicts.js` is generalised by one injectable, the incoming ref
   (default `refs/remotes/origin/main`); an upload merge passes
   `refs/upload/<uploadId>`. A colliding upload then leaves exactly the state a
   racing sync leaves — `main` at ours, the incoming ref retained, `needs_you`
   — and the shipped `OPEN_CONFLICTS`/`RESOLVE_CONFLICT`/`ABANDON_MERGE`
   machinery, screens and tests apply unchanged. *Rationale:* conflicts.md
   explicitly scoped resolution to be reached *"from merging an upload
   (workflow 7)"*; one parameter is the whole cost. *Rejected:* a parallel
   upload-conflict session — it would re-implement the merge-session, the
   musical conflict model and the abandon/commit gate, against the
   "implementations agree because they are checked" and reuse rules.

4. **The preview is a model the Worker emits; the view is the save sheet,
   elsewhere.** PREVIEW returns per-song `{ status, changes?, summary? }` built
   from `recomputeMerge` (classification) and `diff` (the summary for a
   *changed* song), the same seams the save sheet and the conflict model use.
   `books.upload_ui` renders it as the save sheet / the replace-choice list /
   the conflict preview. *Rationale:* the Worker owns HEAD and the trees
   (DIRECTION §3.7); one reply serves the whole book; the save sheet is a built
   surface to render into (`songs/SaveSheet.jsx`, `songs/DiffRows.jsx`).
   *Rejected:* computing the preview in the view — it would leak tree reads and
   the merge above the Worker boundary.

5. **A verbatim history import is taken as-is; only Estante-authored commits
   are canonicalised.** Copying a zip's objects is git transport, not writing a
   document, so §8's "a writer MUST save canonical" does not reach it; workflow
   7 says plainly *"its history becomes the book's."* Where Estante itself
   writes a commit (folder / unrelated-choice / latest-without-history first
   commit, the synthetic working-tree commit, the merge commit) it writes
   canonical, via the §8 writer / the cifra merge. A marked text is never
   written either way (left out, or the escape hatch). *Rationale:* reconciles
   "canonical form over preserving content" (which governs *writes*) with "its
   history becomes the book's" (transport). The canonical check on an imported
   non-canonical-but-clean history is the hook's at push (workflow 14), reached
   only via `books.online`'s put-online — not this task. *Rejected:* replaying
   and re-canonicalising every imported commit — it would rewrite every oid
   (losing the shared-object round trip the download/upload promise), contradict
   workflow 7, and canonicalise history nobody asked to change.

6. **No history into an existing book is a replace, not a merge.** The spec is
   explicit (§11.1 `:67-69`): with no common version there is nothing to merge;
   Estante offers each matching file as a choice (§11.4 `:180-182`). The
   confirm writes the chosen replacements and the additions and makes **one
   ordinary single-parent commit**, not a two-parent merge. *Rationale:* a
   two-parent commit would assert a shared history that does not exist.
   *Rejected:* synthesising an empty-tree merge base and merging anyway — it
   would conflict every differing line as an "add vs add" and bury the user in
   false conflicts the spec says not to produce.

7. **The synthetic working-tree commit is authored by the uploading user, with
   a content-free subject.** The uploader's identity (the save-sheet author
   name from the home book, or the account name after sign-in — the same
   `authorFrom` seam) authors *changes from the upload*; the subject names the
   act, never a song (standing rule). *Rationale:* workflow 7 says *"by the
   user uploading"*; history should attribute the edit to them. *Rejected:*
   the device identity — it would mis-attribute the uploader's work.

8. **The scratch repo lives under `/uploads/<uploadId>` and is removed on
   confirm, cancel, or abandon.** The upload id is minted at PREVIEW and
   returned so IMPORT/CANCEL name the same scratch repo without re-reading the
   zip. *Rationale:* the preview/confirm handshake needs the materialised repo
   to persist across two commands, but it must never leak — a dangling scratch
   repo wastes the device's quota. *Rejected:* keeping the zip bytes in memory
   between commands — the Worker is not guaranteed to survive between the two
   (it may be recycled); the fs is the durable place, and the id makes cleanup
   explicit.

9. **No view and no e2e in this task; `books.upload_ui` owns them.** The WBS
   already carries `books.upload_ui` (`depends sync.upload, !shelf`) for the
   *Upload* tile and the preview screen, with behavior (axe) and e2e-web tests.
   This task's note scopes unit + behavior, and this task ships no interactive
   surface, so there is no behavior-view, axe or e2e level here and none is
   deferred as debt — the UI task is a real, separate leaf that consumes this
   engine. *Rationale:* the split mirrors `songs.save_sheet` (Worker
   `PREVIEW_SAVE`) vs its view, and keeps the engine testable without a DOM.
   *Rejected:* building the preview screen here — it is a whole screen on *Add
   a book*, out of this leaf's 4d and owned by `books.upload_ui`.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-13.

- Created `app/src/worker/upload.js`: the upload engine (`createUpload`) with `preview()` and `import_()`, materialising the zip as a scratch repo, copying objects, managing the temporary ref, previewing song-by-song with `recomputeMerge`/`diff`, and landing imports via the cifra-aware merge or single-parent replace commit.
- Created `app/src/worker/upload.test.js`: unit tests (8 passing) — readZip→materialise→branch found + temp ref at head, no-history recognition, synthetic *changes from the upload* commit, zip-slip/non-zip/CRC refusal, hooks/config ignored.
- Created `app/src/worker/upload.behavior.test.js`: behavior tests (10 passing) — import-as-new (verbatim history + canonical no-history), edits-never-committed, marked working-tree left out, committed-markers escape hatch, no-history replace, unrelated history, clean merge+push with unsaved carried on top, colliding merge → needs_you + conflict session + abandon, nothing-written-until-confirm/cancel.
- Edited `app/src/worker/protocol.js`: added `CommandKind.PREVIEW_UPLOAD`, `IMPORT_UPLOAD`, `CANCEL_UPLOAD` and `EventKind.UPLOAD_PREVIEW`.
- Edited `app/src/worker/logic.js`: added `ensureUpload`, three command dispatch cases for the new commands, and `conflicts` `incomingRef` injection.
- Edited `app/src/worker/conflicts.js`: generalised incoming ref to an injectable (default `refs/remotes/origin/main`); settle drops a retained upload ref; abandon drops the resolved ref.
- Edited `app/src/worker/sync-engine.js`: extracted and exported `captureDirtyWork`/`reapplyDirtyWork` so the upload merge reuses them without new three-way code.
