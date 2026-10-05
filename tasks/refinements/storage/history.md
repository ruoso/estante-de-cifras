# storage.history — History (the Worker's log reader)

## TaskJuggler entry

Back-link: `task storage.history "History"` in
[`tasks/40-storage.tji`](../../40-storage.tji) (lines 56–61).

> note "A song's log following renames, merges hidden unless resolved,
> versions read as they were, restore into the working copy; the book's whole
> log for the file view. Workflows 6, 14. Tests: behavior (a song's log
> following a rename, merges hidden unless resolved, a version read as it was,
> restore into the working copy, the book's whole log — against a repository
> built in the test)."

`depends !working_copy` (i.e. `storage.working_copy`).

## Effort estimate

**2d**, as scoped in the `.tji`.

## Repository

**estante-de-cifras.** All code is app-side, framework-free, below the view:
one production module under `app/src/worker/` (`history.js`), additions to the
existing `app/src/worker/{protocol.js, logic.js, reducer.js}`, and tests
co-located (`*.test.js` unit, `*.behavior.test.js` behavior) with support under
`app/src/test/`. Not a `cifra.md:` task — the format is consumed, not changed.

Per DIRECTION §3.6 (L288) the app and the service share no code, only the HTTP
API and the format; nothing here touches the service. The code is plain
JS/JSX; there is no TypeScript, so contracts are documented as JSDoc
`@typedef`s, matching the sibling modules.

## Inherited dependencies

- **`storage.working_copy`** — *settled, Done 2026-10-05* (`complete 100`,
  `tasks/40-storage.tji:32`). It ships `createWorkingCopy({ fs, git, locks })`
  → `{ write, save, discard }` (`app/src/worker/working-copy.js:53`), and
  through it the whole local-git chain this task reuses:
  - `createGitLayer({ fs, http })` → `{ clone, fetch, push, bookDir }`
    (`app/src/worker/git.js:44`), the **narrow network transport**. Its header
    comment (`git.js:9–13`) names `storage.history` among its consumers and
    states that each consumer "adds their own logic"; `bookDir(bookId)` →
    `/books/<bookId>` (`git.js:63`) is the one path convention to reuse.
  - `createBookLocks({ navigator })` → `{ withLock(bookId, fn) }`
    (`app/src/worker/locks.js:61`), one exclusive, **non-reentrant** Web Lock
    named `book:<bookId>` per logical operation.
  - `createFileSystem(name, { indexedDB })` (`app/src/worker/fs.js`), the
    isomorphic-git `fs` contract over lightning-fs.
  - `canonicaliseFile(path, text)` (`app/src/worker/canonicalise.js:68`) and
    `authorFrom`/`noReplyAddress` (`app/src/worker/author.js`) — not used by
    this task directly (reads don't canonicalise, restore doesn't commit), but
    they establish the `cifra-md` `file:` link already present in the app.
  - The **store protocol seam** from `storage.worker`: versioned,
    structured-cloneable envelopes with an open `kind`
    (`app/src/worker/protocol.js`), the `switch (message.kind)` dispatch and
    per-book `ensureX()` composition in `createWorkerLogic`
    (`app/src/worker/logic.js:120`), the pure `reduce()` with stable per-slice
    references (`app/src/worker/reducer.js`), and the behavior harness
    (`app/src/test/{loopback.js, git-http-remote.js, web-locks.js}`).

  **Decision this inherits:** working_copy's Decision 2 — local git object
  operations (`log`, `readCommit`, `readBlob`, `readTree`, `walk`, `checkout`)
  are imported directly from `isomorphic-git` *inside the consumer module*;
  `git.js` stays the network-only transport. home_book reaffirmed the same
  split. This task follows it: `history.js` imports its read ops directly over
  the shared `fs`, and adds nothing to `git.js`.

Nothing pending blocks this task — `storage.working_copy` and its whole chain
(`git`, `locks`, `fs`, `worker`) are Done 2026-10-05.

**Downstream consumers (already WBS leaves):** `songs.history`
(`tasks/60-songs.tji:56`, `depends storage.history, cifra_js.diff`) renders the
song's version list with the musical summary; `books.file_view`
(`tasks/65-books.tji:57`, `depends storage.history, songs.editor`) renders the
book's whole log with line diffs and per-file restore. Both are in milestone
m2 (`tasks/99-milestones.tji:25`). This task delivers the data; those two
render it.

## What this task is

The Worker-side reader of git history for a book, exposed over the store
protocol so the main thread can show it without touching IndexedDB. Four reads,
all local to the on-device clone, each under the book lock:

- **A song's log** — the versions of one song, newest first, **following
  renames** so the list starts where the song did, not where its current name
  did. **Merge commits are omitted**, except a merge whose result for that song
  is a version no single save produced — *merged, with your resolution* — which
  is kept.
- **A version read as it was** — the exact bytes of the song at a chosen commit
  (at the path it had in that commit, so renames read correctly).
- **Restore into the working copy** — write a chosen version's bytes into the
  working tree at the song's *current* path, uncommitted, to be saved as a new
  version later. History is never rewritten.
- **The book's whole log** — every commit, newest first, merges included and
  marked, each with its short hash, author, date, message, parents, and the
  files it touched — git's own view, for the file view.

What this task does **not** do: it renders nothing (no React, no axe here), and
it does not compute the musical summary of a change. The summary — *Verse bar
5: G7 → D♭7* — is `cifra_js.diff`'s job, wired by `songs.history`
(which depends on it); this task returns raw version bytes and commit metadata.
The *unsaved-changes-first* entry and *compare with now* are `songs.history`'s,
derived from the working-copy state it already reads; this task returns only
the committed log.

## Why it needs to be done

DIRECTION §4 (L446–450): "Song history, in the song's own view, is the same log
seen through the format… Restoring an old version writes it into the working
copy, to be saved as a new one; history is never rewritten." §4 (L441–444): the
file view "shows the book as git sees it: … the book's log with the files each
commit touched." Workflow 6 and workflow 14 decide both to their screens. None
of it can be built until the Worker — the one owner of git and the working copy
(§3.7 L407–409) — can read a filtered song log, read a version, restore one,
and read the book log. `songs.history` and `books.file_view` both block on this
module; it is the data under two screens.

Every book is a full clone (workflow 6 L9; DIRECTION §3 L105–106), so all of
this works offline, with no server call.

## Inputs / context

### Governing design

- **DIRECTION §3** (`docs/DIRECTION.md:105–106`): each book is a git repository
  on IndexedDB, operated by isomorphic-git in a Web Worker. **§3 L118–119:** one
  lock per book, "since a git operation spans many IndexedDB transactions and
  two tabs must not interleave them" — the reason reads, not only writes, run
  under `withLock`.
- **DIRECTION §3.7** (`docs/DIRECTION.md:407–414`): "One owner for the data: a
  Web Worker… The main thread never touches IndexedDB." The interface mirrors
  it — a store fed by the Worker's messages, components reading slices through
  `useSyncExternalStore`. **§3.7 L415–417:** framework-free below the view.
- **DIRECTION §4** (`docs/DIRECTION.md:441–450`): the file view's book log and
  the song's history-through-the-format; restore writes into the working copy;
  history is never rewritten.

### Workflows

- **Workflow 6 — History** (`docs/workflows/06-history.md`):
  - L9: every book is a full clone, so all of it works offline.
  - L11–37 *The list*: the song's versions newest first, each with its note,
    author, when, and summary. **L24–32 Merges are not entries** — a sync merge
    joins changes already listed as the saves they came from; the exception is
    "a merge whose resolution changed the song — a conflict the user settled
    (workflow 9) — listed as *merged, with your resolution*, because that is a
    change nobody saved in the ordinary way." **L34–37 Renames are followed** —
    "renamed or moved, in the file view or by someone using git on a computer,
    keeps its history: the list starts where the song did."
  - L39–51 *A version*: opening an entry shows the song as it was then.
  - L53–62 *Restoring*: "*Restore this version* writes it into the working copy,
    to be saved as a new version… History is never rewritten." A *whole* version
    is restored, not part of one.
  - L64–68 *Deleted songs*: recovered from the file view, which shows deleted
    files in a book's history (workflow 14).
- **Workflow 14 — The file view** (`docs/workflows/14-file-view.md`):
  - L161–173 *The book's history*: "Every commit, newest first, merges included
    and marked as merges… Each shows its message, author, date, a short hash,
    and the files it touched. Opening one shows the line diff of each file, and
    offers, per file, *restore this version*, which writes it into the working
    copy. A deleted file is restored the same way (workflow 6). Short hashes are
    all of git's machinery that shows."
  - L76–82: existing history is never touched; only new commits are checked. A
    version read back is read as it was, not re-canonicalised.
- **Workflow 9 — Conflicts** (`docs/workflows/09-conflicts.md:69–70`): when
  every conflict is settled, "the merge is committed, listed in history as
  *merged, with your resolution* (workflow 6), and pushed." This is the one
  merge whose song result differs from both sides.

### The code seams this extends

- `app/src/worker/git.js:44,63` — `createGitLayer` / `bookDir`; network only,
  reused for the path, not extended.
- `app/src/worker/home-book.js:148` — `readBlob({ fs, dir, oid, filepath })`,
  the precedent for *read a version as it was*; `:272` `resolveRef`; merge
  commits built with `parent: [a, b]` (`:305`), the 2-parent shape to detect.
- `app/src/worker/working-copy.js:159–176` — `discard` uses
  `checkout({ fs, dir, ref: 'HEAD', filepaths, force: true })` and `mkdirp` +
  `fs.promises.writeFile` for the working-tree write; the mechanics *restore*
  reuses (writing historical bytes, not committing).
- `app/src/worker/protocol.js` — `CommandKind`/`EventKind` (`Object.freeze`d,
  open `kind`), `command()`/`event()` builders; the new read kinds are added
  here.
- `app/src/worker/logic.js:120,177–200,240–310` — `createWorkerLogic`, the
  `ensureX()` composition closures, and the `switch` dispatch; a new
  `ensureHistory()` and four cases go here.
- `app/src/worker/reducer.js:15,46` — `initialState` slices and `reduce()`; two
  new slices fold the history events.
- `app/src/test/{git-http-remote.js:151, web-locks.js:91, loopback.js:13}` —
  the behavior harness (`startGitHttpRemote`, `installWebLocks`,
  `createLoopbackEndpoint`), and the `gitRemote(repoDir, …)` CLI helper pattern
  from `working-copy.behavior.test.js` for seeding and cross-checking commits.

## Constraints / requirements

- **The Worker owns the data.** `history.js` is framework-free plain ESM; it
  reads git objects over the injected `fs` and never touches the DOM. The main
  thread reads history only by sending a command and reading the slice the
  resulting event folds into (`useSyncExternalStore`) — it never touches
  IndexedDB, the filesystem, or git (DIRECTION §3.7 L407–414).
- **git.js stays the network transport.** Local reads (`log`, `readCommit`,
  `readBlob`, `walk`/`TREE`) are imported directly from `isomorphic-git` inside
  `history.js` (working_copy Decision 2, home_book Decision 3). Nothing is added
  to `git.js`.
- **One lock per book, reads included.** Every read runs under
  `locks.withLock(bookId, fn)` — one `fn` per logical read, never nested (Web
  Locks are non-reentrant) — because a read spans many IndexedDB transactions
  and must not interleave with a concurrent save in another tab (DIRECTION §3
  L118–119). In particular *restore* reads the historical blob **and** writes
  the working tree inside a single `withLock`; it must not call
  `workingCopy.write` (which would take the lock again).
- **Restore does not commit, canonicalise, or push.** It writes the chosen
  version's bytes into the working tree at the song's current path, uncommitted,
  exactly as they were committed (workflow 6 L53–62; workflow 14 L76–82). The
  subsequent save (`songs.save_sheet`, workflow 4) is what canonicalises and
  commits. A whole version is restored, not part of one (workflow 6 L62).
- **Offline first** — *applies.* Every operation reads the local clone; none
  contacts the network. Restore never pushes. History works with the network
  cut (workflow 6 L9).
- **Canonical form over preserving content** — *applies, by not interfering.*
  Versions read back are returned verbatim, never re-canonicalised; existing
  history is never touched (workflow 14 L76–82). There is no non-canonical
  spelling to preserve — saved versions were already canonical.
- **No song text in logs** — *applies.* `history.js` logs nothing; errors
  surfaced over the port carry a code and a short message, never song text, a
  blob, or a commit message body (the inherited `git-http.js` already logs
  nothing). Test fixtures use songs written for the purpose.
- **Accessibility (axe / WCAG 2.1 AA)** — *not applicable here.* This task ships
  no React and renders nothing; the `.tji` names behavior only. The axe checks
  land with the screens that render this data — `songs.history` and
  `books.file_view` (both name behavior + e2e-web with axe). See *Why no axe
  here*.
- **No book without an account** — *not this task.* Local books are read offline
  with no account; membership and anonymity are service concerns and no history
  read leaves the device.

## Acceptance criteria

### Behavior delivered

A new module **`app/src/worker/history.js`** —
`createHistory({ fs, git, locks })` → four operations, each under
`locks.withLock(bookId, …)`, over `dir = git.bookDir(bookId)`:

- **`songLog({ bookId, path })` → `{ entries }`** — the song's versions, newest
  first, following renames. Implemented with
  `log({ fs, dir, filepath: path, follow: true })` so the chain crosses
  content-preserving renames. Each raw commit is classified for `path`:
  - a non-merge that changed the song → **kept**;
  - a merge (`commit.parent.length ≥ 2`) whose blob for the song **equals some
    parent's blob** for that path (the song came verbatim from one side) →
    **omitted** — the saves it joins are already in the list;
  - a merge whose blob for the song **differs from every parent** (a version no
    single save produced) → **kept**, flagged `resolution: true` (*merged, with
    your resolution*).

  Each kept entry: `{ commit, short, path, parents, author: { name, email },
  timestamp, timezoneOffset, message, isMerge, resolution }`. `path` is the
  song's path *at that commit* (so later reads address the pre-rename blob).
- **`readVersion({ bookId, path, commit })` → `{ text }`** — the song's exact
  bytes at that commit, via `readBlob({ fs, dir, oid: commit, filepath: path })`
  (`path` is the entry's historical path). UTF-8 text returned verbatim.
- **`restoreVersion({ bookId, path, commit, fromPath })` → `{ restored: true }`**
  — read the historical blob (`fromPath` at `commit`) and write its bytes to the
  song's *current* `path` in the working tree (mkdirp + `fs.promises.writeFile`),
  uncommitted, inside one `withLock`. Rename-correct: a renamed song restores to
  its current name.
- **`bookLog({ bookId })` → `{ commits }`** — every commit, newest first, via
  `log({ fs, dir })`; each `{ commit, short, parents, isMerge, author,
  timestamp, timezoneOffset, message, files }`, where `files` is the paths the
  commit touched with a status (`added` / `modified` / `deleted`), computed by
  walking the commit's tree against its first parent (`walk` / `TREE`). Merges
  are marked (`isMerge`) and included.

Wired over the store protocol (this task owns the seam — see Decision 1):

- **`app/src/worker/protocol.js`** — `CommandKind` gains `SONG_LOG`,
  `READ_VERSION`, `RESTORE_VERSION`, `BOOK_LOG`; `EventKind` gains `SONG_LOG`,
  `VERSION`, `RESTORED`, `BOOK_LOG`.
- **`app/src/worker/logic.js`** — `ensureHistory()` composing
  `{ fs: ensureFs(), git: ensureGit(), locks: ensureLocks() }`, and four `case`s
  in `handle`'s switch, each calling the matching operation and posting its
  event (`SONG_LOG`/`VERSION`/`BOOK_LOG` carrying the result, `RESTORED`
  carrying `{ bookId, path }` so the UI can open the save sheet). Errors surface
  as `EventKind.ERROR` with a code, never thrown across the port.
- **`app/src/worker/reducer.js`** — a `history` slice keyed by `bookId` then
  `path` (`{ entries, versions: { [commit]: text } }`, folding `SONG_LOG` and
  `VERSION`) and a `bookLog` slice keyed by `bookId` (folding `BOOK_LOG`), with
  the inherited referential-stability rule (an untouched slice keeps its
  `Object.is` reference; an unknown kind returns the same state).

### Tests the task lands with, by level

- **unit** — `app/src/worker/history.test.js` pins the pure, I/O-free helpers
  factored out of the module: `classifyMergeForPath(mergeBlobOid,
  parentBlobOids[])` returning `'joined'` (equals some parent → omit) vs
  `'resolution'` (differs from every parent → keep) vs `'absent'`, and
  `filterSongLog(rawEntries)` dropping `joined` merges while keeping non-merges
  and `resolution` merges newest-first, over fabricated commit/blob-oid
  fixtures (no IndexedDB, no git). Also extends `app/src/worker/reducer.test.js`
  to fold `SONG_LOG`/`VERSION`/`BOOK_LOG`/`RESTORED` into their slices and
  assert referential stability on untouched slices. **Pins** workflow 6 L24–32
  (merges hidden unless resolved), workflow 14 L161–173 (book-log shape), and
  the reducer's stability rule.
- **behavior** — `app/src/worker/history.behavior.test.js` drives the real
  module through `app/src/test/loopback.js` into `createWorkerLogic` over a
  fresh `new IDBFactory()` (`fake-indexeddb`, imported per-file) with
  `installWebLocks()` active, a `createFileSystem` fs, and `startGitHttpRemote()`
  (the v1 smart-HTTP harness). A test repository is built in the test — commits
  seeded through the Worker's save path and/or the `git` CLI
  (`gitRemote(repoDir, …)`) — and committed state is cross-checked with the
  `git` CLI (`git log`, `git show`, `git diff-tree`) against `--git-dir`. It
  covers, each pinning the `.tji` phrase it satisfies (`tasks/40-storage.tji:60`):
  1. **a song's log following a rename** — create a song, edit it, rename it
     (content-preserving), edit again; `SONG_LOG` returns every version newest
     first across the rename, each entry carrying its path *at that commit*.
     Pins workflow 6 L34–37.
  2. **merges hidden unless resolved** — a clean merge where only one side
     touched the song (the song's merge blob equals one parent) is **absent**
     from `SONG_LOG`; a merge whose result for the song differs from both
     parents is **present**, flagged `resolution`. Pins workflow 6 L24–32,
     workflow 9 L69–70.
  3. **a version read as it was** — `READ_VERSION` at an earlier commit returns
     that version's exact bytes, byte-for-byte equal to `git show <oid>:<path>`.
     Pins workflow 6 L39–51, DIRECTION §4 L446–450.
  4. **restore into the working copy** — `RESTORE_VERSION` writes the chosen
     version's bytes to the song's current path in the working tree (verified
     through the test's shared fs), leaves it uncommitted (HEAD unchanged,
     `statusMatrix` shows a modification), and emits `RESTORED`; a renamed song
     restores to its current name. Pins workflow 6 L53–62, DIRECTION §4
     L448–450.
  5. **the book's whole log** — `BOOK_LOG` returns every commit newest first,
     merges marked, each with short hash, author, date, message, parents and the
     files it touched (a delete appears as `deleted` in its commit), matching
     `git log`. Pins workflow 14 L161–173.

  Seeded songs are written for the test, never anyone's words.

### Why no e2e-web / e2e-api / axe here

The `.tji` names **behavior only**, and that is right: this task is Worker data
logic reading the local clone, with no UI and no HTTP endpoint. There is no
cross-device or server behavior to black-box (history is read from the on-device
repository, never over the wire), so **no e2e-api**. The screens that render
this data carry the real-stack journeys and the axe checks: `songs.history`
names `e2e-web` (a song's history on three viewports, offline, a version
restored and saved; axe) and `books.file_view` names `e2e-web` (a restore from
the log on three viewports; axe). Adding those levels here would duplicate them
on a layer that renders nothing.

### Deferred work

**None requiring a new WBS leaf.** The rendering and the musical summary are
already WBS leaves downstream: `songs.history` (prepends the unsaved-changes
entry, adds *compare with now* and *show the text*, and renders the per-version
musical summary via `cifra_js.diff`; axe; e2e-web) and `books.file_view`
(renders the book log with per-file line diffs and per-file restore; axe;
e2e-web). One product-judgment item (rename-following by content similarity for
the rare rename-and-edit-in-one-commit case) is surfaced to the parking lot, not
the WBS — see Decisions 2 and Open questions.

## Decisions

1. **This task owns the store-protocol seam for history reads; it does not ship
   a bare module for a UI task to wire.** It adds the four `CommandKind`/
   `EventKind` pairs, the `ensureHistory()` composition, the dispatch cases and
   the reducer slices, alongside the framework-free `history.js`. This mirrors
   `storage.working_copy`, the other task that exposes a user-driven flow over
   the port.
   *Rejected:* ship only `createHistory` and let `songs.history` /
   `books.file_view` add the protocol kinds and `logic.js` dispatch (the bare
   style of `storage.git` / `storage.home_book`). Those two are React UI leaves
   in the `songs` and `books` areas; pushing Worker-protocol plumbing into them
   would cross the component boundary (DIRECTION §3.6–3.7: the view is the only
   layer that knows React; the Worker owns the data). The git/home_book
   precedent withheld wiring because their *only* consumer was another Worker
   task that naturally owned the seam — here the consumers are the view, so the
   Worker task owns it.

2. **Merges are classified by blob-OID identity against the parents, not by
   re-running the merge.** A merge is omitted from a song's log when the song's
   blob at the merge equals the blob at one of its parents, and kept (as
   *resolution*) when it differs from every parent. This is exactly workflow 6's
   own rationale: a merge is hidden because "the changes it joins are already
   listed as the saves they came from" — true precisely when the merged song
   *is* one of those saved versions (equals a parent). When the merged song is a
   version no single save produced (differs from both), it is "a change nobody
   saved in the ordinary way" (workflow 6 L31–32) — the *merged, with your
   resolution* case. The rule needs only blob reads, so this task does not
   depend on `cifra_js.merge` (which the WBS does not give it) and is robust to
   canonical reserialisation (it compares whole canonical blobs, not lines).
   *Rejected:* reconstruct the mechanical 3-way merge of (base, ours, theirs)
   and flag the merge as resolved iff the committed blob differs from it. That
   is the only way to tell a *clean two-sided auto-merge* (both sides edited the
   same song, combined mechanically) from a hand resolution — but it requires
   the cifra-aware merge engine (`cifra_js.merge`) for songs, which this task
   does not depend on, and it would make the Worker re-run a merge just to label
   a log entry. The blob-OID rule treats the rare clean two-sided merge as a
   resolution (it shows it), which is defensible: that combined version is
   genuinely a song state no one saved as such, so surfacing it — never *hiding*
   a version that differs from every save — is the conservative, truthful call.
   *Also rejected:* git's dense combined diff (`--cc`) at the line level. It is
   line-provenance-based and so is defeated by the canonical reserialisation a
   cifra-aware merge performs (lines move), producing false *resolution* flags,
   and isomorphic-git does not provide it.

3. **Rename following ships as exact (content-preserving) following, via
   `log({ follow: true })`.** The app's own renames (the file view's rename/move,
   workflow 14 L140–148) and a plain `git mv` on a computer preserve the blob in
   the rename commit, so exact following covers every rename the app makes and
   the common computer case. Content-*similarity* detection (git's `-M`
   heuristic) would additionally catch a rename-and-edit folded into one commit
   by someone using git on a computer.
   *Rejected (for now):* building similarity-based rename detection in this
   task. It is a heuristic with a similarity threshold and ambiguity that is a
   product judgment, not a settled behavior, and it serves only non-app git
   users who rename-and-edit in a single commit — a rare case the exact rule
   degrades on gracefully (the chain simply starts at the rename, as git's own
   default `log` does). Surfaced to the parking lot rather than encoded as a WBS
   leaf, to avoid an open-ended "tune the heuristic" task.

4. **Restore reads the historical blob and writes the working tree itself, under
   one lock; it does not delegate to `workingCopy.write`.** Web Locks are
   non-reentrant (`locks.js`), and restore is one logical operation spanning a
   blob read and a working-tree write; calling `workingCopy.write` (which takes
   the book lock) from inside the restore lock would deadlock. `history.js`
   therefore does its own mkdirp + `writeFile` (the same mechanics as
   `working-copy.js:159–176`).
   *Rejected:* `checkout({ ref: commit, filepaths: [path] })`. Checkout restores
   the file at *its path in that commit*; for a renamed song that path differs
   from the current one, so checkout-by-ref would miss the rename. Reading the
   historical blob and writing it to the current path is rename-correct.

5. **Reads run under the book lock, like writes.** Even a pure read spans many
   IndexedDB transactions and must present a consistent repository against a
   concurrent save in another tab (DIRECTION §3 L118–119). Serialising reads
   behind writes costs nothing the user perceives (history is opened
   deliberately, not polled).
   *Rejected:* lock-free reads for speed. The consistency rule in DIRECTION §3 is
   stated for "every git operation"; a read that races a save could return a
   half-written tree. No measured need justifies the exception.

## Open questions

(none — all decided). One product-judgment item (whether to add
content-similarity rename following for rename-and-edit-in-one-commit by
non-app git users) is raised for the parking lot, per Decision 3; the shipping
behavior (exact following) is decided.

## Status

**Done** — 2026-10-05.

- `app/src/worker/history.js` — `createHistory({ fs, git, locks })` with `songLog`, `readVersion`, `restoreVersion`, `bookLog`; pure helpers `classifyMergeForPath` and `filterSongLog` factored out for unit testing.
- `app/src/worker/protocol.js` — `CommandKind` gains `SONG_LOG`, `READ_VERSION`, `RESTORE_VERSION`, `BOOK_LOG`; `EventKind` gains `SONG_LOG`, `VERSION`, `RESTORED`, `BOOK_LOG`.
- `app/src/worker/logic.js` — `ensureHistory()` composition closure and four dispatch cases wiring each command to its history operation and posting the event.
- `app/src/worker/reducer.js` — `history` slice (keyed by bookId then path; folds `SONG_LOG` and `VERSION`) and `bookLog` slice (keyed by bookId; folds `BOOK_LOG`); `RESTORED` folds with referential stability; unknown kinds return unchanged state.
- `app/src/worker/history.test.js` — unit: `classifyMergeForPath` (joined/resolution/absent) and `filterSongLog` over fabricated fixtures; pins workflow 6 L24–32.
- `app/src/worker/reducer.test.js` — extended: `SONG_LOG`/`VERSION`/`BOOK_LOG`/`RESTORED` folds and referential-stability assertions on untouched slices.
- `app/src/worker/history.behavior.test.js` — 5 behavior cases against real `createWorkerLogic` over fake IndexedDB and a local git HTTP remote: rename-following, merges hidden unless resolved (joined absent / resolution flagged), a version read byte-for-byte vs `git show`, restore into working copy (uncommitted, HEAD unchanged, rename-correct), the book's whole log vs `git log` with per-file statuses incl. a delete.
