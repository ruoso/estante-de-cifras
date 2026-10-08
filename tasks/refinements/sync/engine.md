# sync.engine — The sync engine

## TaskJuggler

[`tasks/45-sync.tji:8`](../../45-sync.tji) — `task engine "Sync engine"`,
under `task sync`. `effort 3d`, `allocate team`, `depends
service.change_check, storage.home_book, storage.preferences_surface,
storage.shelf_surface`. Through the parent `task sync` it also inherits
`storage.working_copy`, `cifra_js.merge` and `foundation.e2e_api`.

Downstream, every other `sync.*` leaf depends on this one: `sync.unsaved`
(merge under unsaved edits), `sync.states` (the shelf marks),
`sync.conflicts` (the conflict screens), `sync.lost_access`, `sync.upload`,
`sync.fork_follow` and `sync.read_in_place` all `depends !engine`. This task
builds the loop they decorate.

## Effort estimate

**3d.** The loop is small — change check, fetch, merge, push, retry — but it
is the first place four settled seams are wired together into a scheduler
that decides *when* to run, and the first consumer of two seams that exist
only on paper so far: the `/api/shelf/change-check` HTTP client in the app
(server side and e2e only today), and cifra.md's `merge` as isomorphic-git's
`merge=cifra` driver (the `.gitattributes` declare it; nothing consumes it
yet). The genuinely new pieces:

- **A scheduler.** Coalesces the five triggers (open, foreground, network
  back, after save, every five minutes) into non-overlapping sync passes.
- **A change-check client.** The Worker's second non-git HTTP consumer, a
  sibling of `git-http.js`.
- **The per-book sync routine.** Fetch the moved books, cifra-aware merge,
  commit the merge, push — retried up to three times on a lost race.
- **A song-content merge driver.** cifra.md `merge` bound as
  isomorphic-git's `mergeDriver`, clean path only; conflict halts the book.
- **Home-book routing.** The home book goes to its own JSON merge, never the
  cifra-aware one, and re-surfaces preferences and the shelf.

## Repository

**estante-de-cifras**, app only. The note does not start with `cifra.md:`.
The engine is framework-free ESM under `app/src/worker/` (the Worker owns
git, the working copy and the index — DIRECTION §3.7 lines 417-419), plus a
thin main-thread adapter that forwards the two DOM-only triggers, and edits
to the protocol/logic/reducer seam. No cifra.md change: it *consumes*
cifra.md's JS `merge` (already a `file:` dependency) but modifies nothing in
the format repo. The app and the service **share no code** (DIRECTION §3.6
lines 288-291); only the HTTP contract in `api/` and the format bind them.

Directories/files that change:

- `app/src/worker/sync-engine.js` (new) — `createSyncEngine(...)`: the
  per-pass loop and the per-book fetch→merge→push routine with the
  three-retry policy.
- `app/src/worker/sync-scheduler.js` (new) — `createSyncScheduler(...)`:
  the trigger coalescer and the five-minute timer.
- `app/src/worker/change-check-client.js` (new) —
  `createChangeCheckClient({ fetch })`: `POST /api/shelf/change-check`.
- `app/src/worker/cifra-merge-driver.js` (new) — cifra.md `merge` wrapped as
  isomorphic-git's `mergeDriver`, surfacing the per-file `Outcome`.
- `app/src/worker/protocol.js` — add `CommandKind.SYNC` and `EventKind.SYNC`.
- `app/src/worker/logic.js` — compose the engine in `createWorkerLogic`,
  drive the scheduler on `OPEN` and after `SAVE`, dispatch `SYNC`, route the
  home book to the existing `SYNC_HOME` path.
- `app/src/worker/reducer.js` — a minimal `sync` slice keyed by `bookId`.
- `app/src/sync-triggers.js` (new, main thread) — forward
  `visibilitychange` (foreground) and `online` (network back) as `SYNC`
  commands through the store.

## Inherited dependencies (all settled)

- **`service.change_check`** — Done 2026-10-07.
  `POST /api/shelf/change-check` (`service/internal/server/shelf.go`).
  Request `{books:[{bookId, head|null}]}` (`api/openapi.yaml`
  `ShelfBookHead` L1060-1072, `ChangeCheckRequest` L1074-1083, ≤500 items);
  response `{books:[{bookId, status, head?}]}` with `status` ∈
  `changed|unchanged|gone` (`ShelfBookChange` L1085-1109,
  `ChangeCheckResponse` L1111-1120). A moved book comes back `changed` with
  its new head; a book the caller holds a non-null head for but can no
  longer read comes back `gone`; everything else is omitted. Session cookie
  `estante_session`.
- **`storage.home_book`** — Done 2026-10-05.
  `createHomeBook({ fs, git, locks })` (`app/src/worker/home-book.js:124`)
  with `sync({ bookId, author }) → { commit, pushed }` (`home-book.js:251`):
  fetch, key-by-key JSON `mergeTrees` (`home-book-merge.js`), two-parent
  merge commit, best-effort push, offline-tolerant. `HOME_BOOK_ID = 'home'`
  (`home-book.js:85`). This is the home book's own merge — **not** the
  cifra-aware one.
- **`storage.preferences_surface`** — Done 2026-10-05. The
  `CommandKind.SYNC_HOME` handler (`logic.js:971-993`) runs
  `ensureHomeBook().sync(...)` then re-surfaces preferences
  (`surfaceHomeBookPreferences()`, `EventKind.PREFERENCES`).
- **`storage.shelf_surface`** — Done 2026-10-06. The same `SYNC_HOME`
  handler also re-surfaces the shelf (`surfaceHomeBookShelf()`,
  `EventKind.SHELF`), narrowed to this device.
- **`storage.working_copy`** (via parent) — Done 2026-10-05.
  `createWorkingCopy({ fs, git, locks })` (`working-copy.js:70`);
  `save(...) → { commit, pushed }` keeps the commit when a push fails
  offline — "the push is the sync engine's to retry" (`working-copy.js:171-180`,
  Decision 8).
- **`cifra_js.merge`** (via parent) — Done 2026-10-05, cifra.md `47a635e`.
  `merge(base, ours, theirs, { setlist }) → Outcome` (`cifra.md/js/src/merge.js`,
  exported `cifra.md/js/src/index.js:118`); `Outcome =
  { result, deleted, conflicts, marked, kept }`; deterministic to the byte,
  held to the Go `git-merge-cifra` driver by the corpus. The refinement
  states wiring it as isomorphic-git's merge-driver callback is this stream's
  job.
- **`foundation.e2e_api`** (via parent) — settled. The `e2e/api/` harness
  (`lib/http.js` `HttpClient`, `lib/git.js` `IsoGit`/`GitCli`,
  `lib/db.js`) with `e2e/api/change-check.test.js` as the working template.

## What this task is

The device-side sync engine: the self-driving loop that keeps the shelf in
step with the service. On each of five triggers it asks the service which
books moved (one change-check request), fetches only those, merges incoming
saves with the device's own by the cifra-aware rules, makes the merge commit
and pushes it without asking, and — when the push loses a race — fetches,
merges and pushes again, up to three times. It pushes saves that were made
offline the moment a push can go through. The home book rides the same loop
but through its own key-by-key JSON merge. Everything runs inside the Worker,
under one Web Lock per book.

This task delivers the **clean** path and the loop that drives it. The cases
that branch off it each have their own leaf: merging under *unsaved* edits
(`sync.unsaved`), the shelf *states* and *sync now* (`sync.states`), the
*conflict* screens and resolution (`sync.conflicts`), *losing access*
(`sync.lost_access`), and a song *open while it changes* (`sync.read_in_place`).
The engine emits the facts those tasks render and halts cleanly where they
take over.

## Why it needs to be done

Saves are already written and committed locally, and a save pushes
best-effort (`working-copy.js`), but **nothing fetches, nothing merges, and
nothing retries a push that failed** — `grep` for `*sync*` in `app/src`
finds no module. The change-check endpoint, the cifra-aware merge and the
home-book sync all exist and all say, in their own refinements, that the
engine is the thing that calls them. Until it exists the shelf is write-only:
a second device's saves never arrive, and a save made offline never leaves
the phone. Every downstream `sync.*` leaf (`!engine`) decorates this loop, so
it is the gate for the whole sync milestone.

## Inputs / context

Normative:

- **`docs/workflows/08-sync.md`** (decided). When it runs — the five triggers
  and change-check-first (lines 13-24); merging without asking, the merge
  hidden from history (lines 42-47); a push that loses a race — fetch, merge,
  push again up to three times, then *syncing* (lines 59-62); the shelf
  states (lines 28-34); the home book merges key by key, never a conflict
  (lines 72-76); losing access → *no longer shared with you* (lines 65-69); a
  song open while it changes (lines 50-56).
- **`docs/DIRECTION.md`** — §3.1 Sync, the normative order "fetch, merge,
  push, retried when the push races another" and the unsaved case "base,
  theirs, and the working text" (lines 127-134); §3.2 Personal state, the
  home book's key-by-key JSON merge, later change wins (lines 136-151); §3.3,
  the change check reads one ref so a client spends a fetch only on a book
  that moved (lines 195-198, 366-367), and "two pushes racing are settled by
  git's own ref locking" (line 203); §3.6, the app and service share no code
  (lines 288-291); §3.7, the Worker owns git / working copy / index and the
  main thread never touches IndexedDB, the interface mirrors it through
  messages (lines 417-427); §1 offline first (lines 29-31).
- **`docs/workflows/06-history.md`** — the merge commit is not listed in
  history (referenced from 08-sync.md:45).

Code seams:

- `app/src/worker/git.js:46` — `createGitLayer({ fs, http }) →
  { init, clone, fetch, push, bookDir }`, pinned to
  `{ remote:'origin', ref:'main', singleBranch:true }` (`git.js:52`),
  fast-forward push only (`git.js:103`), `bookDir(id) → /books/<id>`
  (`git.js:63-67`). The narrow transport: it does not stage, commit, merge or
  decide when to sync. Local git ops (`merge`, `add`, `commit`, `checkout`,
  `statusMatrix`, `resolveRef`) are called on isomorphic-git directly over
  the shared `fs`, as `working-copy.js` and `home-book.js` already do.
- `app/src/worker/git-http.js` — `createGitHttpClient({ fetch })`:
  `credentials:'include'`, pins protocol v1, logs nothing. The pattern the
  change-check client follows.
- `app/src/worker/home-book.js:251` — `sync(...)`, the one existing
  fetch→merge→commit→push, and the shape to mirror for songbooks (with the
  cifra-aware merge in place of `mergeTrees`).
- `app/src/worker/working-copy.js:116,171-180` — `save(...)`; the push is
  best-effort and the commit is kept for the engine to retry.
- `app/src/worker/locks.js:61` — `createBookLocks({ navigator })`,
  `withLock(bookId, fn)`, one exclusive Web Lock `book:<bookId>`,
  non-reentrant, one `fn` per logical operation.
- `app/src/worker/protocol.js:27,37,49` — the open `{ v, dir, kind,
  payload }` envelope; `CommandKind.SYNC_HOME`, `EventKind.PREFERENCES`,
  `EventKind.SHELF` already present.
- `app/src/worker/logic.js:682` — `handle(message)`, the `switch` over
  `CommandKind`; `:971-993` the `SYNC_HOME` handler; `:321-327` `ensureGit()`
  building the http client from `options.fetch`; `:1509-1518` the catch that
  posts any throw as an `ERROR` event, never across the port.
- `app/src/worker/books.js:33` — `GITATTRIBUTES_BYTES =
  "*.cifra.md merge=cifra\n*.setlist.md merge=cifra\n…"`, written when a book
  is scaffolded; the attribute the merge driver answers to.
- `app/src/account/auth-client.js` — the main thread's first non-git REST
  consumer; precedent for the thin `sync-triggers.js` adapter.
- `app/package.json` — `"cifra-md": "file:../../cifra.md/js"`.

Test harness:

- `app/src/test/git-http-remote.js:151` — `startGitHttpRemote()`: a real git
  smart-HTTP v1 remote (`git-http-backend` CGI, `http.receivepack=true`),
  returns `{ url, root, repoDir, stop() }`. Advance it with the real `git`
  CLI (async `spawn`, never sync — the server is in-process).
- `app/src/test/loopback.js:13` — `createLoopbackEndpoint(createLogic)`,
  in-process store↔Worker double, `structuredClone` per message.
- `app/src/test/web-locks.js` — `installWebLocks()` polyfill for Node.
- `app/src/worker/git.behavior.test.js` — the clone/push/fetch +
  `fake-indexeddb` + `createFileSystem` pattern to copy.
- `e2e/api/change-check.test.js`, `e2e/api/lib/{http,git,db}.js` — the
  two-device-over-the-stack template.

## Constraints / requirements

- **The Worker owns it.** The engine, the scheduler timer, the change-check
  client and the merge all live in the Worker. The main thread may only
  *forward* the two triggers it alone sees (foreground, network back) as
  messages; it never touches git or IndexedDB (DIRECTION §3.7 lines 417-427).
- **Offline first.** Nothing the user does waits on sync. A failed change
  check, fetch or push never rolls back a commit and never surfaces an error
  to the user; the book keeps its unpushed work and the engine retries on the
  next trigger (DIRECTION §1 lines 29-31; `working-copy.js:171-180`).
- **Change check first, fetch only what moved** (08-sync.md:21-24). A book
  with local unpushed commits is still pushed even when the change check
  reports it unchanged — that is the offline-save retry.
- **Canonical only.** The engine writes nothing non-canonical: the clean
  merge result comes from cifra.md's §8 writer and is canonical by
  construction; a merge that would produce marked text is a conflict, not a
  result, and is never committed or pushed (`cifra_js.merge`; project rule).
- **Merge without asking, hidden from history** (08-sync.md:42-45): the clean
  merge is a two-parent merge commit the engine makes and pushes silently;
  history does not list it (workflow 6).
- **One lock per book per logical operation.** Fetch→merge→push for a book,
  and the home-book sync, each run inside one `withLock(bookId, …)`; a
  `WRITE`/`SAVE` and a sync must not interleave on the same book
  (`locks.js:61`).
- **No song text, no secrets in any log.** The change-check client logs
  nothing (like `git-http.js`); the merge commit message is content-free.
- **No book without an account.** The change check and every git request
  carry the session cookie; an unauthenticated run surfaces nothing and
  simply does not sync (service enforces 401).
- **No new runtime dependency, no new IndexedDB store, no migration.**
  isomorphic-git and `cifra-md` are already dependencies; sync status is held
  in memory and emitted (matches `home_book`/`preferences_surface`).

## Acceptance criteria

The engine delivers:

1. **Five triggers, coalesced.** A sync pass runs on app open, on return to
   the foreground, when the network comes back, after every save, and every
   five minutes; overlapping triggers collapse and no pass starts while one
   is in flight (08-sync.md:13-19).
2. **Change check first.** Each pass posts every hosted book's local head
   (null when empty) to `/api/shelf/change-check` and fetches only the
   `changed` books (08-sync.md:21-24; `ChangeCheckRequest`/`Response`).
3. **Clean cifra-aware merge, pushed without asking.** For a moved songbook
   the engine fetches, merges incoming saves with the device's by the
   cifra-aware rules (cifra.md `merge`), makes the hidden two-parent merge
   commit and pushes it (08-sync.md:42-45; DIRECTION §3.1).
4. **Three-retry on a lost race.** A non-fast-forward push drives
   fetch→merge→push again, up to three times, silently; past three the book
   is left *syncing* for the next pass (08-sync.md:59-62; DIRECTION §3.3:203).
5. **Offline-save retry.** A book with local unpushed commits is pushed on
   the next pass once a push can go through, even when the change check
   reports it unchanged (`working-copy.js` Decision 8).
6. **Home book routed to its own merge.** The home book syncs through
   `home-book.js` `sync` (key-by-key JSON merge, never the cifra-aware one),
   and preferences and the shelf re-surface after (`SYNC_HOME` path;
   08-sync.md:72-76; DIRECTION §3.2).
7. **Clean halts for the branches that follow.** On a merge conflict the book
   stops (no commit, HEAD at ours, the fetched ref retained) and the engine
   emits `needs_you`; on a `gone` answer it emits `gone` and stops syncing the
   book; it emits a per-book sync status (`syncing`/`in_step`/`saves_waiting`/
   `offline`/`needs_you`/`gone`). Rendering those, and resolving conflicts, is
   `sync.states`/`sync.conflicts`/`sync.lost_access`.
8. **Unsaved edits are never clobbered.** When a book's working tree is dirty
   the engine still pushes committed work but defers the incoming merge,
   leaving the edit intact; the base/theirs/working-text merge is
   `sync.unsaved`.

Tests it lands with (the note names unit, behavior, e2e-api):

- **unit — `app/src/worker/sync-scheduler.test.js`** (when it runs): with an
  injected clock and timer, a pass fires on open, foreground, network-back,
  after-save and every five minutes, and overlapping triggers coalesce with
  no pass starting while one is in flight (08-sync.md:13-19).
- **unit — `app/src/worker/sync-engine.test.js`** (the retry policy): with
  injected change-check/fetch/merge/push fakes, a push rejected by a lost
  race drives fetch→merge→push again up to three times and then gives up,
  leaving the book `syncing`; a push that succeeds on the second try stops
  the loop (08-sync.md:59-62; DIRECTION §3.3:203).
- **unit — `app/src/worker/change-check-client.test.js`**: builds the request
  from each hosted book's head (null when empty), maps `changed`/`gone`/omit
  from the response, sends the session cookie (`credentials:'include'`) and
  logs nothing (`api/openapi.yaml` L1060-1120; DIRECTION §3.3).
- **behavior — `app/src/worker/sync-engine.behavior.test.js`** (Worker + real
  local remote + `fake-indexeddb`, no React → no axe): a book cloned on two
  working copies against `startGitHttpRemote()`; the remote advances with
  another's save; the engine (change-check stubbed `changed`) fetches,
  cifra-aware-merges cleanly with the real cifra.md `merge`, makes the hidden
  two-parent merge commit and pushes it; a second clone pushing between the
  fetch and the push forces a non-fast-forward and the engine retries —
  succeeding within three, and left `syncing` when the race outlasts three
  (08-sync.md:42-47, 59-62; DIRECTION §3.1). Songs written for the purpose.
- **behavior — same file**: the home book is routed to `home-book.js` `sync`
  (key-by-key JSON merge, never the cifra-aware one) and preferences + the
  shelf re-surface after (08-sync.md:72-76; DIRECTION §3.2); and a book with
  an unsaved working-tree edit is pushed for its committed work but its
  incoming merge is deferred with the edit left intact (DIRECTION §3.1
  unsaved clause — the merge itself is `sync.unsaved`).
- **e2e-api — `e2e/api/sync.test.js`** (two `IsoGit` devices against the
  compose stack): A and B both clone a shared book and record heads; both
  edit different sections and A pushes; B calls `POST /api/shelf/change-check`,
  sees the book `changed` with the new head, fetches, cifra-aware-merges
  cleanly, pushes the merge commit (accepted by the real pre-receive hook as
  canonical), and A fetches it back — the two-device journey's sync half
  (08-sync.md; change check `api/openapi.yaml:375`; DIRECTION §3.1, §3.3).

No **e2e-web**: the engine ships no screen. The shelf states, the *sync now*
control, the offline-then-back and conflict journeys, and a song updating in
place carry the e2e-web level in `sync.states`, `sync.conflicts`,
`sync.lost_access` and `sync.read_in_place` (each `depends !engine` and
`foundation.e2e_web`). The note names unit/behavior/e2e-api only; nothing is
dropped.

## Decisions

- **The scheduler lives in the Worker; a thin main-thread adapter forwards
  the two DOM-only triggers.** *Chosen:* the Worker owns the five-minute
  timer, the open trigger and the after-save trigger (both fire inside the
  Worker), and coalesces; `app/src/sync-triggers.js` forwards
  `visibilitychange` and `online` as `SYNC` commands, because only the
  document sees them. *Rejected:* a main-thread scheduler — splits sync
  ownership away from the data owner (DIRECTION §3.7) and can't see
  after-save; a Worker-only scheduler — can't observe foreground at all.
- **One `CommandKind.SYNC { reason }`, coalesced by the Worker.** *Chosen:* a
  single command carrying why it fired; *sync now* (`sync.states`) reuses it.
  *Rejected:* a command per trigger — needless protocol surface for an
  identical action.
- **Fetch→merge→push via isomorphic-git's `merge` with a `mergeDriver`
  delegating per file to cifra.md `merge(base, ours, theirs, { setlist })`,
  `abortOnConflict` so any conflict leaves HEAD at ours.** *Chosen:* reuse
  git's tree-walk — the driver is only called for files both sides touched —
  and the deterministic cifra-aware merge for those; the `.gitattributes`
  already declare `merge=cifra` (`books.js:33`) and `cifra_js.merge` was built
  for exactly this seam. *Rejected:* a hand-rolled tree merge — duplicates
  git and risks diverging from the Go `git-merge-cifra` driver the corpus
  holds JS to.
- **On conflict the engine halts and does not persist the `Outcome`.**
  *Chosen:* no commit, HEAD stays at ours, the fetched `refs/remotes/origin/main`
  is retained, emit `needs_you`, stop retrying that book; `sync.conflicts`
  recomputes the `Outcome` via the byte-deterministic `merge` when the user
  engages. *Rejected:* a conflict store — redundant state for a deterministic
  function, and a shape `sync.conflicts` would have to own anyway.
- **The change check gates fetching; local-ahead still pushes.** *Chosen:*
  fetch only `changed` books, but push any book whose local head is ahead of
  `refs/remotes/origin/main` (a local ref comparison, no network) — that is
  the offline-save retry. The home book is included in the change check and
  synced (through `home-book.js` `sync`) only when `changed` or locally
  ahead. *Rejected:* fetching every book each pass — defeats §3.3; always
  running the home sync — a redundant network fetch when nothing is pending.
- **The engine emits per-book sync facts; the shelf renders them.** *Chosen:*
  `EventKind.SYNC { bookId, phase, savesWaiting?, lastInStep?, at }` into a
  minimal `sync` reducer slice; the single source of sync truth is the
  Worker. *Rejected:* deriving the display word here — that is `sync.states`
  (its unit test is "deriving each state"); the engine ships facts, the shelf
  ships presentation.
- **Dirty-tree guard until `sync.unsaved`.** *Chosen:* when a working tree is
  dirty the engine defers the incoming merge (never checks a merged tree over
  an unsaved edit) but still pushes committed work. *Rejected:* merging
  anyway — would clobber unsaved edits, which DIRECTION §3.1 says must survive
  on top; the base/theirs/working-text merge is `sync.unsaved` (`!engine`),
  which supersedes the guard.
- **No new IndexedDB store or migration.** *Chosen:* sync status in memory,
  emitted as events; durable "when last in step" is derivable and belongs to
  `sync.states`. *Rejected:* a status table — a migration for data the shelf
  re-derives on open.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `app/src/worker/sync-engine.js` (new) — `createSyncEngine`: per-pass change-check→fetch→cifra-merge→push loop with three-retry lost-race policy, dirty-tree guard, offline-first, home-book routing via `SYNC_HOME`.
- `app/src/worker/sync-scheduler.js` (new) — `createSyncScheduler`: coalesces the five triggers (open, foreground, network-back, after-save, five-minute heartbeat) into non-overlapping passes; timer unref'd so tests don't hang.
- `app/src/worker/change-check-client.js` (new) — `createChangeCheckClient`: `POST /api/shelf/change-check` with `credentials:'include'`, logs nothing.
- `app/src/worker/cifra-merge-driver.js` (new) — cifra.md `merge` bound as isomorphic-git `mergeDriver`; `abortOnConflict` leaves HEAD at ours on conflict.
- `app/src/sync-triggers.js` (new, main thread) — forwards `visibilitychange` and `online` as `SYNC` commands through the store.
- `app/src/worker/protocol.js` — added `CommandKind.SYNC` and `EventKind.SYNC`.
- `app/src/worker/reducer.js` — minimal `sync` slice keyed by `bookId`.
- `app/src/worker/logic.js` — composes engine+scheduler, drives on `OPEN`/after-`SAVE`, `SYNC` handler, `resolveSyncAuthor`/`surfaceHomeBook`.
- `app/src/main.jsx` — wires `sync-triggers.js` to the store.
- `e2e/api/lib/git.js` — added `IsoGit.addRemote(remote, url)` (fixer: device A had no origin fetch refspec after `init()`+`push()`).
- `e2e/api/sync.test.js` (new) — two `IsoGit` devices over the compose stack; A pushes, B change-checks, cifra-aware-merges, pushes the merge commit, A fetches back.
- Tests: unit (`change-check-client.test.js` 4 cases, `sync-scheduler.test.js` 4 cases, `sync-engine.test.js` 7 cases); behavior (`sync-engine.behavior.test.js` 6 cases); e2e-api (`sync.test.js` 1 case). All green (gate iter-0172).
