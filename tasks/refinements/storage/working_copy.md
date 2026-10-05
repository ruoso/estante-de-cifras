# storage.working_copy — the working copy, save and discard

## TaskJuggler entry

`tasks/40-storage.tji`, `task storage.working_copy "Working copy, save and
discard"` (lines 29–33):

> Real files written as the user types; save = canonicalise, commit one file
> or several, then push; discard; author as the per-user no-reply address.
> Workflows 3, 4, 14. Tests: unit (the author's no-reply address,
> canonicalising before commit); behavior (type, save one file and several,
> discard; the commit holds canonical text; push to the local remote; a
> marked text refused — workflows 3, 4, 14).

`depends !git, !locks, cifra_js.writer`.

## Effort estimate

**3d**, as scoped in the `.tji`.

## Repository

estante-de-cifras. All code is app-side, framework-free, below the view:
production modules under `app/src/worker/`, tests co-located
(`*.test.js` unit, `*.behavior.test.js` behavior), test support under
`app/src/test/`. Not a `cifra.md:` task — but it is the first consumer in the
app of the **cifra.md for JavaScript** package (`js/`, in the sibling
`/home/ruoso/devel/cifra.md` repo): it imports the format's canonical writer
and reader from there (DIRECTION §3.6 L288–291 — the app and the service share
no code, only the API contract and the format).

The code is plain JS/JSX; there is no TypeScript. Contracts are documented as
JSDoc `@typedef`s, matching every sibling in `app/src/worker/`.

## Inherited dependencies

- **storage.git** — *settled, Done 2026-10-05.* Gives the transport layer
  `createGitLayer({ fs, http })` → `{ clone, fetch, push, bookDir }`
  (`app/src/worker/git.js:44`), fixed to the one-origin, single-branch,
  protocol-v1 shape (`remote:'origin'`, `ref:'main'`, `singleBranch:true`, no
  force-push), and the on-device repository layout `bookDir(bookId)` →
  `/books/<bookId>` (a non-bare working dir — `git.js:63`). It is a network
  primitive: git.md Decision 4 (`tasks/refinements/storage/git.md:301`)
  deliberately leaves **staging, committing and canonicalising** to this task.
  Also `createGitHttpClient({ fetch })` (`app/src/worker/git-http.js`), the
  session-cookie HTTP client push rides, and the test harness
  `startGitHttpRemote()` (`app/src/test/git-http-remote.js:145`) — a real `git
  http-backend` serving smart HTTP v1 with push enabled.
- **storage.locks** — *settled, Done 2026-10-05.* Gives
  `createBookLocks({ navigator })` → `{ withLock(bookId, fn) }`
  (`app/src/worker/locks.js:61`): one exclusive Web Lock per book, named
  `book:<bookId>`. locks.md names **storage.working_copy as its first
  consumer** (`tasks/refinements/storage/locks.md:76`,
  Decision 4 at `:280`): this task constructs the lock registry and the git
  layer in the `createWorkerLogic` closure and composes them. Its composition
  rule is load-bearing here — **one `fn` per logical operation**: a save is
  commit + push, so the whole save runs under a single `withLock`, never
  reacquired per git call (`locks.js:20–25`, Decision 1 at `locks.md:254`).
  Web Locks are non-reentrant (`locks.js:27–30`), so no save/discard/write
  nests another under the same book.
- **cifra_js.writer** — *settled, Done 2026-10-05* (cifra.md commit `c10ea54`).
  Gives the canonical writer, exported from the package index
  `/home/ruoso/devel/cifra.md/js/src/index.js`: `write(model) → text`
  (`serialize ∘ canonical`, throwing `MarkedTextError` on a marked text),
  `canonical(model) → model`, `isCanonical(text) → boolean`
  (= `write(parse(text)) === text`), and `MarkedTextError`
  (`js/src/write.js`). This is the "canonicalise before commit" seam the
  `.tji` names, and `MarkedTextError` / `isCanonical` are, per the writer's
  own refinement, "part of the writer's public contract for the app's save
  path" (`js/src/index.js:70–77`).
- **cifra_js.reader** — *settled, Done 2026-10-05* (transitive: the writer
  `depends !reader`, and `write`/`isCanonical` call it internally). Gives
  `parse(bytes) → model` (`js/src/parse.js`), which the save path needs to
  turn the working file's bytes into a model before `write`. `parse` throws
  only `NotUtf8Error`; malformed music is diagnostics, not a throw
  (`js/src/index.js:62–68`).
- **cifra_js.setlists** — *settled, Done 2026-10-05.* Gives `parseSetlist`,
  `writeSetlist(model) → text` and `canonicalSetlist(model)`
  (`js/src/index.js:44–60`) — the setlist analogues of the song writer. A book
  holds `*.cifra.md` songs **and** `*.setlist.md` setlists (workflow 14
  L24–36), and "the app canonicalizes every song **and setlist** when saving"
  (workflow 14 L51–52), so the save path must canonicalise both. The `.tji`
  `depends` line names only `cifra_js.writer`; this task also consumes the
  settled setlist writer (see Decision 6 and Open questions).
- Transitively **foundation.app_tooling** (the Vite + React 19 PWA package,
  Vitest in jsdom via `app/vite.config.js`, `scripts/gate` running `vitest
  run`), **storage.worker** (the protocol/store/logic seam), **storage.fs**
  (`createFileSystem` → the isomorphic-git `fs`), and **storage.migrations**
  (the `estante` DB — untouched here; lightning-fs owns its own DB).

Nothing pending blocks this task. The flows that build on it are later leaves
— `storage.home_book` (auto-commit over the same seam), `storage.index`
(indexing unsaved work), `storage.history`, `storage.download`, and the sync
engine (fetch + merge + push, the retry, and pushing a save made offline at
the next sync) — all `depends !working_copy`.

## What this task is

Wire the first real user-facing storage flow into the Worker, composing the
git transport (storage.git), the per-book lock (storage.locks) and the
filesystem (storage.fs) that already exist as unwired primitives. Concretely:

- **Write real files as the user types.** A `WRITE` command writes the editor's
  current text straight into the book's working copy on the filesystem, so
  "closing the tab loses nothing" (DIRECTION §3 L108–110). No canonicalisation,
  no commit — just durability.
- **Save.** A `SAVE` command canonicalises each named file through the cifra.md
  writer, writes the canonical text back to the working copy, stages and makes
  **one commit** (one file or several) authored by the per-user no-reply
  address, then pushes — the whole unit under the book's lock. A file holding
  conflict markers (a **marked text**) or an unreadable voicing stops the save
  whole: nothing is committed, nothing is pushed.
- **Discard.** A `DISCARD` command restores named files to their last-saved
  state (or deletes a never-saved new file), under the lock.

It adds the `protocol.js` command/event kinds and the `logic.js` dispatch for
these — the wiring git.md and locks.md deferred to "the first consumer" — plus
two pure modules (the author identity and the canonicalise-one-file step) and a
reducer slice carrying the save/discard outcome as a word.

It is the Worker's mechanism. The editor UI, the save sheet (the semantic-diff
summary and the prefilled note), the "unsaved" badge and the filename derived
from a title all belong to later `shell`/`songs` leaves; they call these
commands and read these events.

## Why it needs to be done

It is the point where the storage stack first does what the product is for.
DIRECTION §3 L111: "Saving is a commit, and then a push." Everything hosted
rests on a working copy that is safe as the user types and a save that lands a
canonical commit on `refs/heads/main`. Its consumers are already WBS leaves and
all `depends !working_copy`: `storage.home_book` reuses the commit+push seam
for automatic commits; `storage.index` indexes the working copy including
unsaved edits; `storage.history`, `storage.download` and the sync engine all
operate on the working copy this task establishes. Without it none of them has
a working copy to act on.

## Inputs / context

### Governing design

- **DIRECTION §3** (`docs/DIRECTION.md` L108–113): "**A real working copy.**
  … What the user is editing is the working copy, **written to storage as they
  type**, so closing the tab loses nothing." "**Explicit save.** Saving is a
  commit, and then a push (workflow 4). Persisting and versioning are separate:
  the working copy is always safe; a save is a version the user chose to keep."
- **DIRECTION §3.1 "Sync"** (L127–134): "With unsaved work in the working copy,
  incoming changes are merged into it — base, theirs, and the working text — so
  the user's edits stay unsaved and land on top." This is why a `WRITE` to the
  working copy and a sync's merge must not interleave (both touch the working
  tree): the lock covers writes too (Decision 3).
- **DIRECTION §3.2 "Personal state"** / **the no-reply address** (L160–170):
  the app's root domain is `estantedecifras.app`; "**Commits are authored with
  a per-user no-reply address**, `<user-id>@users.estantedecifras.app`, never
  the user's real email." "before sign-in, a device's commits carry a **local
  id** in its place, which the account's address replaces in the saves not yet
  pushed when the user signs in." The author's display name is asked once and
  kept in the home book (workflow 4 L67–72).
- **DIRECTION §3.7 "The app"** (L407–420): "**One owner for the data: a Web
  Worker.** It holds git, the working copy and the search index, and does every
  clone, fetch, merge, save and index update. The main thread never touches
  IndexedDB." The store protocol (L410–414): "A sync finishing, a merge
  landing, a clone's progress: each is a message, and only what shows it
  moves." The source editor is CodeMirror 6 and renders conflict markers
  (L418–420) — but canonicalisation and the save refusal are the Worker's.
- **DIRECTION §3.6** (L288–291): the app and the service share no code, only
  the HTTP API and the format; "the service never needs to understand a song
  except to check that a push holds canonical ones."

### Workflows

- **Workflow 3** (`docs/workflows/03-write-a-new-song.md`): "A new song is a new
  file in the **working copy** of its book. It is safe from the first keystroke"
  (L19–23). *Discard* "deletes the file — after asking, if it holds more than a
  title" (L51–54). The first save "names the file, commits it with the message
  **Add &lt;Title&gt;**" (L97–101). Filename derivation (title folded to an ASCII
  slug; `untitled.cifra.md` placeholder; `-2`/`-3` on collision — L36–48) is
  the editor/new-song task's, not this one's (Constraints).
- **Workflow 4** (`docs/workflows/04-edit-and-save.md`): "Every change goes to
  the **working copy** as it is made" (L10–15); "**There is one kind of unsaved
  change, whatever made it**" (L17–21). The save sheet shows *what changed* and
  *a note* prefilled from the semantic diff, editable; "Confirming commits the
  one file, with the note as the commit message" (L24–34). "**Save commits and
  then pushes: at once if there is a network, at the next sync if not (workflow
  8).**" (L37–41). Canonicalise on save: "What was typed by hand is normalised
  at save: the voicings put in canonical order, the chart untouched"; "A voicing
  line the parser cannot read … stops the save with a message pointing at it"
  (L48–56). *save all* "lists every song and what changed in each, and makes
  **one commit**" (L59–65). The author name is asked once and kept in the home
  book; after sign-in the account supplies the email (L67–72). *Discard
  changes* "puts the song back as last saved … and always asks, since it is the
  one destructive action here" (L73–77).
- **Workflow 14** (`docs/workflows/14-file-view.md`): a book holds `*.cifra.md`
  songs and `*.setlist.md` setlists, `README.md`, `.gitattributes`; UTF-8,
  ≤ 256 KB each (L24–47). "**The app canonicalizes every song and setlist when
  saving, and the service refuses any commit holding one that is not
  canonical**" (L50–52); canonical text is "UTF-8 with no BOM, LF, exactly one
  final newline, NFC, no tabs" (L65). *Save all* in the file view "makes **one
  commit**" (L154–158). What the service's `pre-receive` hook checks (L84–113)
  is the push shape this task must produce: only `refs/heads/main`,
  fast-forward, no stowaway objects, every blob canonical — "A push that fails
  any check is refused whole."

### The format

- **cifra.md spec §8.1 "The canonical form"** (`spec/8-normalisation.md`
  L8–54): every document has exactly one canonical form; "A writer that saves a
  document MUST save it in canonical form" (L36–37); it "holds no marker line"
  (L30–33, pointing at §11.12.3). Canonical form takes precedence over
  preserving the text (L39–51) — the save writes the canonical text back.
- **cifra.md spec §10.9 "Canonical form"** (`spec/10-setlists.md` L420+): a
  setlist's canonical form constrains every byte; a writer MUST write it.
- **cifra.md spec §11.12.3 "Marker lines"** (`spec/11-merge.md` L1035–1056): a
  **marker line** is a line that is exactly `<<<<<<<`, `=======`, `>>>>>>>` or
  `|||||||`, alone or followed by a space and anything. "A text that holds a
  marker line is a **marked text**." "**A writer MUST NOT save one: it MUST
  refuse, and point at the first marker line.**" This is the normative source
  for the `.tji`'s "a marked text refused" — enforced by `write` throwing
  `MarkedTextError` and `isCanonical` returning false, which the save path gates
  on rather than re-scanning for markers.

### The code seams this extends

- `app/src/worker/protocol.js` — `command()`/`event()` envelopes;
  `CommandKind` (L26, has `OPEN`) and `EventKind` (L33, has `READY`/`ERROR`),
  both `Object.freeze`d and open to new kinds.
- `app/src/worker/logic.js` — `createWorkerLogic(port, options = {})` (L111),
  its `options` injection seam (`indexedDB`, `name`, `migrations`, `navigator`),
  the memoised `ensureFs()` (L135) whose comment already says "Books will become
  directories within it", and the `switch (message.kind)` dispatch (L157) with
  its error-as-`ERROR`-event contract (L169–178, never throw across the port).
- `app/src/worker/reducer.js` — `reduce()` (L31), `initialState` (L15),
  referential-stability rule (an unchanged slice keeps its reference; an unknown
  kind returns the same state).
- `app/src/worker/store.js` — `createStore(endpoint)` with `send(message)`
  (L49) for arbitrary command envelopes.
- `app/src/worker/git.js:44`, `app/src/worker/locks.js:61`,
  `app/src/worker/fs.js:144` (the `{ promises }` surface with `readFile`,
  `writeFile`, `unlink`, `readdir`, `mkdir`, `rename`, `stat`, … — exactly
  isomorphic-git's `fs` contract).
- Test support: `app/src/test/git-http-remote.js` (`startGitHttpRemote`,
  `seedBareRepo`), `app/src/test/web-locks.js` (`installWebLocks`),
  `app/src/test/loopback.js`, `fake-indexeddb ^6.2.5` (imported per-file, a
  fresh `new IDBFactory()` per test).
- `isomorphic-git ^1.43.0` is already a dependency (storage.git). This task uses
  its **local** commands — `add`, `remove`, `commit`, `checkout`,
  `statusMatrix`, `resolveRef` — directly over the injected `fs` (Decision 2).

## Constraints / requirements

- **The Worker owns the working copy; the view never does.** Every new module
  is framework-free plain ESM under `app/src/worker/`, imports no React, and is
  never imported by the main thread (DIRECTION §3.7 L407–409). The view sends
  commands and reads slices; it never touches the filesystem, git or IndexedDB.
- **One lock per logical operation** (locks.md Decision 1). A save (canonicalise
  → write back → `add` → `commit` → `push`) runs inside **one**
  `withLock(bookId, …)`; a discard and a write likewise each run under one.
  Never reacquire per git call; never nest (Web Locks are non-reentrant).
- **Canonical form over preserving content** (standing rule; spec §8.1, §10.9;
  workflow 14 L50–52). On save, each file is canonicalised through the cifra.md
  writer and the **canonical text is written back to the working copy** before
  it is staged — the committed blob and the working file agree, and both are
  canonical. What the model does not keep is not written back.
- **A marked text is never saved or pushed** (standing rule; spec §11.12.3). If
  any file in a save is a marked text, the whole save is refused before any
  commit — surfaced as a `SAVE_REFUSED` event naming the file (and, from
  `MarkedTextError`, the first marker line). The gate is the writer's
  `MarkedTextError` / `isCanonical`, never a re-implemented marker scan.
- **The author is the per-user no-reply address** (DIRECTION §3.2 L164–170). The
  commit's author and committer are `{ name, email:
  `${id}@users.estantedecifras.app` }`, where `id` is the account user-id, or
  the device local id before sign-in. This task forms the address from an `id`
  it is handed; it does not generate the local id or store the name (that is
  the home book's, storage.home_book). Never the user's real email.
- **One commit, one file or several** (workflow 4 L59–65, workflow 14
  L154–158). A save names the paths that go in it and makes exactly one commit.
- **The push shape the service accepts** (workflow 14 L84–113): the commit sits
  on `refs/heads/main`, the push is fast-forward (git.js does not force), one
  ref only. Failures come back through git's own channel and surface as events.
- **Offline first** (standing rule; workflow 4 L37–41). The `WRITE` and the
  local commit never wait on the network and never fail for lack of one. A save
  commits locally and then attempts the push; a push that fails for want of a
  network does **not** roll back the commit — the commit is kept and the push is
  the sync engine's to retry at the next sync (storage.sync). The outcome event
  carries whether the push landed.
- **No song text, commit messages or secrets in logs** (standing rule). This is
  the first module that handles song text and commit messages; it logs none of
  them (mirrors `logic.js:9–11`). Errors surface as events, never to `console`.
- **File limits** (workflow 14 L39–47): a file is UTF-8 and ≤ 256 KB; the
  canonical writer emits UTF-8/LF/NFC/no-BOM/one-final-newline by construction
  (spec §8.4.1). Enforcing the 256 KB ceiling at save time is the service hook's
  authority (workflow 14); the app relies on canonicalisation and the hook, and
  does not re-police the byte limit here.
- **Accessibility** — *not applicable.* No UI; a framework-free Worker module
  renders nothing. The save sheet and its axe coverage belong to the `songs`
  save-sheet leaf.

## Acceptance criteria

### Behavior delivered

- **`app/src/worker/author.js`** — `noReplyAddress(id)` →
  `` `${id}@users.estantedecifras.app` `` and `authorFrom({ id, name }, now =
  Date.now())` → `{ name, email, timestamp, timezoneOffset }` shaped for
  isomorphic-git's `author`/`committer`. Pure; no I/O, no logging.
- **`app/src/worker/canonicalise.js`** — `canonicaliseFile(path, text)` that
  dispatches by extension: `*.cifra.md` through `write`/`parse`, `*.setlist.md`
  through `writeSetlist`/`parseSetlist`, and returns `{ ok: true, text }` with
  the canonical text, or `{ ok: false, reason: 'marked' | 'unreadable', marker?
  }` when the writer refuses (catching `MarkedTextError` for `'marked'`). Pure;
  imports only the cifra.md package.
- **`app/src/worker/working-copy.js`** —
  `createWorkingCopy({ fs, git, locks })` → `{ write, save, discard }`:
  - `write({ bookId, path, text })` — under `withLock`, `mkdir -p` the parent
    and `fs.writeFile` the bytes into `git.bookDir(bookId)/path`. No commit.
  - `save({ bookId, paths, message, author })` — under one `withLock`:
    canonicalise each path (abort the whole save on any refusal, committing
    nothing), write the canonical text back, `git.add` each (`git.remove` for a
    deletion), `commit({ message, author, committer: author })`, then
    `git.push`. Returns `{ commit, pushed }`; a push that fails offline resolves
    `{ commit, pushed: false }`.
  - `discard({ bookId, paths })` — under `withLock`, `checkout` each tracked
    path back to HEAD, and `unlink` each path with no HEAD blob (a never-saved
    new file).
- **Protocol and dispatch** — `protocol.js` gains `CommandKind.WRITE`, `SAVE`,
  `DISCARD` and `EventKind.SAVED`, `DISCARDED`, `SAVE_REFUSED`; `logic.js`
  constructs `createBookLocks`, `createGitHttpClient`, `createGitLayer` and
  `createWorkingCopy` in the `createWorkerLogic` closure (beside `ensureFs`) and
  dispatches the three commands, emitting the outcome events (and reusing
  `ERROR` for an unexpected failure). The new `options` seam injects the git
  `http` client's `fetch` and the `navigator` for locks, matching storage.git /
  storage.locks test style.
- **Reducer slice** — `reducer.js` folds `SAVED`/`DISCARDED`/`SAVE_REFUSED` into
  a `save` slice keyed by `bookId`, carrying the outcome **as a word** (`status:
  'saved' | 'discarded' | 'refused'`, plus `commit`, `pushed`, or the refused
  `path`/`reason`), referentially stable for books an event does not touch.

### Tests the task lands with, by level

- **unit** — `app/src/worker/author.test.js`: `noReplyAddress` builds
  `<id>@users.estantedecifras.app` for an account id and for a device local id,
  never a real email; `authorFrom` shapes name/email/timestamp. Pins
  `tasks/40-storage.tji:33` ("the author's no-reply address") and DIRECTION §3.2
  L164–170.
- **unit** — `app/src/worker/canonicalise.test.js`: a hand-typed song with
  voicings out of order comes back in canonical order with the chart untouched;
  a setlist canonicalises through the setlist writer; a text holding a conflict
  marker returns `{ ok: false, reason: 'marked' }` (via `MarkedTextError`); an
  already-canonical file is unchanged. Songs written for the purpose. Pins
  `tasks/40-storage.tji:33` ("canonicalising before commit"), workflow 4
  L48–56, spec §8.1 and §11.12.3.
- **behavior** — `app/src/worker/working-copy.behavior.test.js`: drives the real
  Worker logic in-process (loopback) over a fresh `new IDBFactory()`
  (fake-indexeddb, per-file) with `installWebLocks()` active, a `createFileSystem`
  fs, and the git layer against `startGitHttpRemote()` (the v1 harness, push
  enabled). It (1) clones a seeded book, **`WRITE`s** a song as "typed" and
  asserts the working file holds the typed bytes with no new commit; (2)
  **`SAVE`s** one file and asserts the commit's blob is the **canonical** text
  (voicings reordered, read with the `git` CLI via async `spawn`) authored by
  `<id>@users.estantedecifras.app`, and that the remote's `refs/heads/main`
  advanced (**push to the local remote**); (3) `WRITE`s two files and **saves
  both in one commit** (one parent, two changed blobs); (4) **`DISCARD`s** —
  edits to a saved song revert to HEAD, a never-saved new file is removed; (5)
  `WRITE`s a song holding a conflict marker and `SAVE`s — a **`SAVE_REFUSED`**
  event names the file, and the remote ref has **not** moved and no new commit
  exists (**a marked text refused**). Pins `tasks/40-storage.tji:33`, workflows
  3 (L19–23, L51–54, L97–101), 4 (L10–65) and 14 (L50–52, L84–113, L154–158).

### Why no e2e-web / e2e-api / axe here

The `.tji` names only unit and behavior. No UI ships in this task (the editor,
the save sheet and the "unsaved" badge are `shell`/`songs` leaves), so there is
nothing for axe or e2e-web to cover yet; the end-to-end journey — edit, save,
discard, and a save made offline pushed when the network returns — lands with
the save-sheet UI leaf and the sync engine, against the real stack. The push
shape against the **real** Go service and its `pre-receive` hook (workflow 14)
is pinned by the service/hook e2e-api leaves. The local v1 harness is the right
level for the Worker save/discard mechanism.

### Deferred work

None as new WBS leaves. Every flow that builds on this task already exists as a
leaf and `depends !working_copy`: the editor and save sheet (the semantic-diff
summary, the prefilled note, the "unsaved" badge, the title→filename slug) in
the `shell`/`songs` area; automatic commits in `storage.home_book`; indexing
unsaved work in `storage.index`; `storage.history`; `storage.download`; and
fetch + merge + push, the race retry, and pushing an offline save at the next
sync in the sync engine. Each adds its own command/event kinds and dispatch
when it wires its flow.

## Decisions

1. **This task does the wiring git.js and locks.js deferred; it adds the
   `WRITE`/`SAVE`/`DISCARD` commands.** locks.md Decision 4 and git.md Decision
   4 explicitly name "the first consumer" as the one that composes the git layer
   and the lock registry in `createWorkerLogic` and adds the store command/event
   kinds. working_copy is that consumer, so the wiring and the three commands
   land here — not speculatively earlier.
   *Rejected:* a standalone unwired `working-copy.js` with no protocol kinds
   (mirroring git.js/locks.js) — those were primitives with a named future
   consumer; this task *is* that consumer and its deliverable is a user-facing
   flow, which the behavior test exercises end to end through the store.
2. **Local git operations (`add`, `remove`, `commit`, `checkout`,
   `statusMatrix`) live in `working-copy.js`, calling isomorphic-git directly;
   the network stays in `git.js`.** git.md Decision 4 fixed git.js as the
   transport primitive that "does not canonicalise, stage, or decide when to
   sync — its consumers do." Keeping staging and committing in the working-copy
   layer honours that boundary and keeps git.js small and single-purpose (clone
   / fetch / push). The injected `fs` is shared, so both operate on the same
   working directory.
   *Rejected:* extending git.js with `add`/`commit`/`checkout` — it would blur
   the transport primitive git.md deliberately kept narrow, and no other
   consumer needs those in git.js (home_book and sync compose their own units).
3. **`WRITE` runs under the book lock, like save and discard.** DIRECTION §3.1
   merges incoming changes into the working tree "base, theirs, and the working
   text"; a sync's merge and a keystroke-write both mutate the working tree, so
   an unlocked write could race a merge and clobber an edit. A single
   `fs.writeFile` under the exclusive lock is brief; the view debounces its
   writes, so the lock is not contended per keystroke. Correctness (no
   interleave with sync) outweighs the small latency.
   *Rejected:* unlocked writes for speed — it reopens exactly the interleave
   locks.js exists to prevent (`locks.js:1–10`).
4. **Canonicalise by catching `MarkedTextError` / gating on the writer, not by
   scanning for markers.** The writer is the single authority on canonicality
   and marker lines (spec §8.1, §11.12.3; the writer's refinement makes
   `MarkedTextError`/`isCanonical` public "for the app's save path"). The save
   path calls `write`/`writeSetlist` and treats a `MarkedTextError` as the
   refusal; it never re-implements the §11.12.3 scan. Same library, same answer,
   in the app and in the service hook (DIRECTION §3.6).
   *Rejected:* an independent marker scan in the Worker — a second, drifting
   implementation of a format rule, forbidden by the standing "checked, not
   shared" rule and redundant with the writer.
5. **The canonical text is written back to the working copy on save, and a
   refusal aborts the whole save atomically.** Spec §8.1 and workflow 14 require
   a saved file to be canonical and the working file to agree with it; workflow
   14 L84–113 refuses a push "whole" if any blob is non-canonical, so the app
   mirrors that: one marked/unreadable file stops the entire multi-file save
   before any commit. This keeps the device from ever holding a committed
   non-canonical blob and matches the "one commit" semantics.
   *Rejected:* committing the readable files and skipping the bad one — it
   breaks the atomic "one commit" contract and would surprise a *save all*.
6. **Canonicalise setlists too, using the settled `cifra_js.setlists` writer,
   though the `.tji` `depends` names only `cifra_js.writer`.** A book holds both
   songs and setlists and the app "canonicalizes every song and setlist when
   saving" (workflow 14 L51–52); a save that left setlists non-canonical would
   be refused by the service hook. `cifra_js.setlists` is Done, so there is no
   blocker; the dispatch is by file extension. (Surfaced under Open questions
   for the closer to add to `depends`.)
   *Rejected:* scoping the save to songs only — it would ship a save path that
   cannot save a `*.setlist.md` file without the service rejecting it, an
   incomplete flow.
7. **The author `id` and display name are inputs, not generated here.** The
   no-reply address is formed from an `id` the command carries; the local id
   (pre-sign-in) and its replacement on sign-in, and the name kept in the home
   book, are storage.home_book / the account flow (DIRECTION §3.2 L167–170,
   workflow 4 L67–72). working_copy owns only the `id → email` mapping.
   *Rejected:* generating or persisting the id/name here — it would duplicate
   state the home book owns and couple this task to the account flow.
8. **The push failure does not roll back the commit (offline-first).** Workflow
   4 L37–41: a save pushes "at once if there is a network, at the next sync if
   not." So `save` always leaves a local commit; a failed push resolves
   `pushed: false` and the sync engine retries. The behavior test (online)
   asserts `pushed: true` and the remote moved.
   *Rejected:* treating a failed push as a failed save — it would make saving
   wait on the network, violating offline-first.

## Open questions

- The `.tji` `depends` line names `cifra_js.writer` but not `cifra_js.setlists`,
  which this task also consumes to canonicalise `*.setlist.md` files (Decision
  6). Both are settled, so nothing is blocked; the closer may add
  `cifra_js.setlists` to `storage.working_copy`'s `depends` for an accurate WBS
  graph. (Surfaced for the closer; not encoded as a task.)

## Status

**Done** — 2026-10-05.

- `app/src/worker/author.js` — `noReplyAddress(id)` and `authorFrom({ id, name }, now)` for the per-user no-reply address and isomorphic-git author/committer shape.
- `app/src/worker/canonicalise.js` — `canonicaliseFile(path, text)` dispatching by extension through the cifra.md package, returning `{ ok, text }` or `{ ok: false, reason, marker? }`.
- `app/src/worker/working-copy.js` — `createWorkingCopy({ fs, git, locks })` → `{ write, save, discard }`, composing the git transport, per-book lock and filesystem.
- `app/src/worker/protocol.js` — added `CommandKind.WRITE`, `SAVE`, `DISCARD` and `EventKind.SAVED`, `DISCARDED`, `SAVE_REFUSED`.
- `app/src/worker/logic.js` — constructs locks, git layer and working copy in the closure; dispatches all three commands; `options.fetch` and `options.navigator` seams for tests.
- `app/src/worker/reducer.js` — `save` slice keyed by `bookId` for `SAVED`/`DISCARDED`/`SAVE_REFUSED` outcomes.
- `app/package.json`, `app/package-lock.json` — `cifra-md` as a `file:` link to the sibling repo's JS package (first app consumer).
- `Dockerfile`, `compose.yaml` — `cifra-md` named build context so `npm ci` and vite resolve the symlinked sibling package inside Docker; `WORKDIR /build/app` so the `file:` path round-trips at depth ≥2.
- Tests: `app/src/worker/author.test.js` (unit, 5), `app/src/worker/canonicalise.test.js` (unit, 5), `app/src/worker/working-copy.behavior.test.js` (behavior, 5 scenarios), `app/src/worker/reducer.test.js` extended (7 total).
