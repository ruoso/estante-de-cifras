# storage.home_book — the home book

## TaskJuggler entry

`tasks/40-storage.tji`, `task storage.home_book "The home book"` (lines 43–48):

> Committed automatically; settings and the shelf list; merged key by key, the
> later change winning. Workflows 1, 8, 13. Tests: unit (the key-by-key merge,
> the later change winning, equal times); behavior (settings changed in two
> working copies merged through the local remote, committed automatically).

`depends !working_copy, design.home_book_format`.

## Effort estimate

**2d**, as scoped in the `.tji`.

## Repository

estante-de-cifras. All code is app-side, framework-free, below the view:
production modules under `app/src/worker/`, tests co-located (`*.test.js` unit,
`*.behavior.test.js` behavior), test support under `app/src/test/`. Like its
predecessor `storage.working_copy`, it is a consumer of the **cifra.md for
JavaScript** package only indirectly — the home book's files are **not** a
cifra.md format (home-book-format.md §1 L12–14); nothing in the sibling
`/home/ruoso/devel/cifra.md` repo changes. This is **not** a `cifra.md:` task.

The code is plain JS/JSX; there is no TypeScript. Contracts are documented as
JSDoc `@typedef`s, matching every sibling in `app/src/worker/`.

## Inherited dependencies

- **storage.working_copy** — *settled, Done 2026-10-05.* Gives the Worker's
  working-copy mechanism and, more to the point, the **patterns this task
  mirrors**: `createWorkingCopy({ fs, git, locks })`
  (`app/src/worker/working-copy.js:53`) composing the git transport, the
  per-book lock and the filesystem; the **one-lock-per-logical-operation** rule
  (`working-copy.js:16–21`); local git operations (`add`, `remove`, `commit`,
  `checkout`, `statusMatrix`) called straight on isomorphic-git over the shared
  `fs` while git.js stays the narrow transport (`working-copy.js:9–14`,
  Decision 2 there); the `mkdirp` helper (`working-copy.js:63`); and the
  **offline-first push** rule — a commit is durable locally and a failed push
  resolves `pushed: false` without rolling back (`working-copy.js:141–152`,
  Decision 8 there). It also wired the git layer and lock registry into
  `createWorkerLogic`'s closure via `ensureWorkingCopy()`
  (`app/src/worker/logic.js:154–163`) — the composition seam this task extends.
  Transitively it settled **storage.git** (`createGitLayer({ fs, http })` →
  `{ clone, fetch, push, bookDir }`, `app/src/worker/git.js:44`, `bookDir` at
  `:63`), **storage.locks** (`createBookLocks({ navigator })` →
  `{ withLock(bookId, fn) }`, `app/src/worker/locks.js:61`), **storage.fs**
  (`createFileSystem` → the isomorphic-git `fs` with the `promises` surface,
  `app/src/worker/fs.js:144`) and **cifra_js** (not needed here — the home book
  is not a song). git.js names `storage.home_book` as one of its deferred
  consumers (`git.js:11–13`).
- **design.home_book_format** — *settled, Done 2026-10-05.* Gives the normative
  specification this task implements: `docs/home-book-format.md`, written in the
  cifra.md spec register. It fixes the eight tracked files (§2.1), the
  `{ value, at }` **register** envelope and how a register is told from a map
  (§3), the **key-by-key merge** — greater `at` wins, the equal-time tie-break,
  tombstones, map union — as a commutative/associative function (§5), the
  **canonical form** that makes two converged devices write byte-identical files
  (§6), the per-device namespacing of recents and local-book markers (§7), and
  the home book's allowed kinds for the validator (§8). §9 names
  **`storage.home_book` as the writer and merger** that pins §3, §5 and §6 in
  its tests. Its refinement (`tasks/refinements/design/home_book_format.md`)
  recorded the LWW-register choice, the file split, and the opaque-value rule.
- Transitively **foundation.app_tooling** (Vite + React 19 PWA; Vitest in jsdom
  via `app/vite.config.js`; `scripts/gate` runs `vitest run`) and
  **storage.worker**/**storage.migrations** (the protocol/store/reducer/logic
  seam and the `estante` IndexedDB `meta` store this task reads a device id
  from).

Nothing pending blocks this task. Everything it consumes is Done. Its own
consumers are later leaves and all `depends storage.home_book`:
`storage.preferences_surface` (reads `preferences.json` → emits `PREFERENCES`),
`books.shelf` (reads/writes `shelf.json`), `account.new_device` (the sign-in
merge and the shelf filling), `music.instruments` (instruments in the home
book) and `music.transpose` (per-song reading state). See Acceptance → the
graph note on `sync.engine`.

## What this task is

Build the **home book** in the Worker: the per-user settings repository that
holds personal state (DIRECTION §3.2 L136–151) — theme, language, notation, the
shelf list and its labels and links, instruments and voicing rules, *my shapes*,
per-song transposition and variation, and recents. It is a git repository like
any other, cloned/fetched/pushed over the same transport as a songbook, but it
differs in exactly two ways (home-book-format.md §1 L22–26): it is **committed
automatically** rather than on an explicit save, and its files are **JSON that
merge key by key, the later change winning**, so a user's preferences never
reach a conflict (workflow 9 does not apply to it).

Concretely, this task delivers the Worker's **writer and merger** (home-book-
format.md §9 L508–512) as framework-free modules under `app/src/worker/`:

- **The canonical JSON serializer** (home-book-format.md §6) — sorted object
  keys at every depth, kept array order, the §6.2 number/string forms, NFC,
  UTF-8/LF, pretty-printed one-member-per-line with a trailing newline, `{}` for
  the empty map. It is a fixed point: canonicalising a canonical file changes no
  byte. This is what makes two converged devices write **byte-identical** files
  and the automatic merge commit reproducible.
- **The register envelope and the merge** (home-book-format.md §3, §5) — a pure,
  commutative, associative function over two home-book trees: a register
  (exactly `{ value, at }`, §3) resolves by the greater `at`, ties broken by the
  lexicographically-greater canonical value (§5.1); a map takes the union of its
  keys and recurses (§5.2); a tombstone (`value: null`) is a register retained
  like any other (§5.3). "Key by key" is the leaf register.
- **The home-book module** — `createHomeBook({ fs, git, locks })` composing the
  transport, the per-book lock and the filesystem, with: **set** (read a
  settings file, apply register changes with the current instant, write it back
  canonical, and **commit it automatically** — one file, one commit); **read**
  (parse a settings file to its model, absent read as `{}`); **sync** (fetch the
  origin, merge each settings file against the fetched side by §5, write the
  merged tree canonical, commit the merge automatically, then push); and the
  §2.3 **device id** provisioned once in the Worker's `meta` store.

It is the storage mechanism only. The screens that *read* home-book state (the
account screen's theme/language, the shelf, the instrument screens) and the
flows that *write* it (choosing a theme, labelling a book, remembering a
transposition) are later `shell`/`books`/`music`/`account` leaves that call
this module; the `PREFERENCES` read path is `storage.preferences_surface`'s.

## Why it needs to be done

DIRECTION §3.2 L143–144: the home book is the "one mechanism [that] replaces
both a backup and setting up each new device." Personal state is worthless until
it is durable and syncs without ever asking the user to resolve a conflict in
their own preferences (workflow 8 L72–77). This task is where that mechanism
exists. Its consumers are already WBS leaves and all `depends
storage.home_book`: `storage.preferences_surface`, `books.shelf`,
`music.instruments`, `music.transpose` (all milestone **M2**,
`milestones.m2_local`) and `account.new_device` (**M4**). Without the writer,
merger and canonical form this task delivers, none of them has a home book to
read or write, and the design decision DIRECTION §6 recorded and
`design.home_book_format` settled has no implementation.

## Inputs / context

### Governing design

- **DIRECTION §3.2 "Personal state"** (`docs/DIRECTION.md` L136–151): the home
  book is "a repository like any other but committed automatically — explicit
  save is for what the user authors, not for preferences"; it is "a **settings
  repository**, not a songbook: its files are JSON that merge key by key, the
  later change winning (workflow 8)," and "the format … is written down in
  [`home-book-format.md`](home-book-format.md)."
- **DIRECTION §3.2 the commit author** (L164–171): "**Commits are authored with
  a per-user no-reply address**, `<user-id>@users.estantedecifras.app`, never
  the user's real email." "before sign-in, a device's commits carry a local id
  in its place, which the account's address replaces in the saves not yet pushed
  when the user signs in." The home book's automatic commits use this same
  author (reusing `author.js`); forming the local id and replacing it on sign-in
  is the account flow's, not this task's (Decision 6).
- **DIRECTION §3.7 "The app"** (L407–414): "**One owner for the data: a Web
  Worker.** It holds git, the working copy and the search index, and does every
  clone, fetch, **merge**, save and index update. The main thread never touches
  IndexedDB." "A sync finishing, a merge landing … each is a message, and only
  what shows it moves." The home book's reading, merging and automatic
  committing are the Worker's; the merge is computed by the Worker, never by git
  (home-book-format.md §1.1 L40–46).
- **DIRECTION §6 "Open decisions"** (L496+): the home-book-format bullet is
  retired — decided and pointed at `docs/home-book-format.md` by
  `design.home_book_format`.

### Workflows

- **Workflow 1 §The home book / Language / Theme**
  (`docs/workflows/01-first-run.md` L72–78, L81–84, L94–103): the home book
  "starts local, with no remote, and gains one when the user signs in"; the
  language and the theme (including `automatic`) are preferences "kept in the
  home book like the language, so it follows the user to a new device."
  `automatic` remains a selectable choice and is per-device behaviour (it
  follows the device's light/dark mode); which theme is *chosen* is what the
  home book holds. This is why `set`/commit must work **before any network**
  (offline-first; Decision 5) and the remote is attached only on sign-in.
- **Workflow 8 §The home book** (`docs/workflows/08-sync.md` L72–77) — **the
  normative merge rule**: "nobody should ever meet a conflict in their
  preferences. Its files are JSON, and they merge key by key; where two devices
  changed the same key, the later change wins, by the time each was made. The
  home book never reaches workflow 9." §Merging (L41–47): sync "makes the merge
  commit and pushes it" without asking, and history does not list the merge.
  §When it runs (L12–25) and §A push that loses a race (L59–62) are the sync
  engine's loop that will *invoke* this module (Acceptance → graph note).
- **Workflow 13** (`docs/workflows/13-new-device.md`): §What comes down
  (L30–37) — the home book comes down **first** so the instrument, notation,
  language and theme are right before anything else; "Recents are kept per
  device." §The shelf is in the home book (L39–43) — "the home book holds the
  list of books on the shelf: each one's link, and the user's label for it.
  Access itself is the account's … so nothing secret is written down."
  §Books that were only on the other device (L45–50) — a local-only book is
  listed by title. §A device used before signing in (L58–66) — "The local home
  book merges into the account's **key by key**, as two devices' home books do
  (workflow 8)." The per-device namespacing (home-book-format.md §7) is what
  reconciles "recents per device" with the home book syncing.

### The format (the specification this task implements)

`docs/home-book-format.md`, settled by `design.home_book_format`:

- **§1.1 Terms / actors** (L37–52): a **writer** produces a file; a **merger**
  computes the merged tree and commits it, "the Worker's own, not git's" —
  "the Worker reads the two sides' JSON and computes the result itself" (this
  task is both). The **validator** is the service hook (`hook.home_book`, out of
  scope here).
- **§2.1 The tracked files** (L76–98): exactly `preferences.json`, `shelf.json`,
  `instruments.json`, `shapes.json`, `songs.json`, `recents.json`, `README.md`,
  `.gitattributes`, all at the root, nothing else. An absent settings file reads
  as `{}`; each file is created lazily; a change rewrites one file so the diff
  is one file.
- **§2.2 `README.md` and `.gitattributes`** (L100–127): the **exact bytes** the
  app writes (UTF-8, LF, one trailing newline) — the home-book README text and
  `* text=auto eol=lf` / `*.json merge=binary`. The merger never relies on git
  to merge; `merge=binary` is only for a bystanding git client.
- **§2.3 Identifiers** (L130–149): the **device id** — one UUID per
  installation, generated the first time the app runs and kept in "local storage
  the Worker owns (the `meta` object store, outside the home book)," never
  changing, used only as a **namespace key** in `recents.json` and
  `shelf.json`'s `local`. Book id and song ref are consumers' keys.
- **§3 The register envelope** (L150–180): `{ "value": <JSON, or null for a
  tombstone>, "at": "<UTC ISO-8601 ms instant>" }`; `at` matches
  `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`. "**an object is a register if
  and only if its keys are exactly `value` and `at`, with `at` a well-formed
  instant; every other object is a map.**" A register's `value` is never walked,
  so an opaque value containing `value`/`at` keys is safe.
- **§4 The settings files** (L181–329): each file's key namespaces; which values
  are **opaque** (instruments, voicing rules, shapes, variation ids, the
  notation dialect — the format fixes the key and envelope, not the value).
- **§5 The merge** (L330–377): **§5.1** two registers — greater `at` wins; on
  equal `at`, canonicalise each `value` (§6) and the lexicographically-greater
  UTF-8 byte sequence wins (total, commutative, deterministic). **§5.2** two
  maps — union of keys; a key on one side taken whole, a key on both recursed; a
  register/map mismatch under one key is **malformed** (the merger does not
  produce one). **§5.3** a tombstone is a register, retained. **§5.4** why it
  converges — max over a total order is commutative and associative, so any
  number of devices merging in any order converge on the same tree and, in
  canonical form, the same bytes.
- **§6 Canonical form** (L379–444): §6.1 sorts every object's members by code
  point at every depth (`at` before `value`), keeps array order, re-emits
  scalars per §6.2, NFC; §6.2 numbers = shortest round-tripping decimal
  (`Number.prototype.toString`), strings escape only what JSON requires with
  lowercase `\u00XX` and the solidus never escaped, non-ASCII literal UTF-8;
  §6.3 the bytes — UTF-8 no BOM, NFC, LF only, two-space pretty print one
  member/element per line, exactly one trailing LF, `{}` for the empty map.
- **§7 Per-device state** (L445–463): recents and local-book markers are
  namespaced by device id so they sync yet never collide and never provide a
  cross-device "most recently played"; a device writes and reads only its own
  namespace. The §5 map union handles this for free — each device writes under
  its own id, so the merge never reconciles two devices' recents into one list.
- **§8 Allowed kinds and validation** (L465–493) and **§9 Conformance**
  (L495–512): the validator (`hook.home_book`, deferred — see Acceptance) is the
  service hook's, not this task's; §9 is the writer/merger conformance this
  task's tests pin.

### The code seams this extends

- `app/src/worker/working-copy.js` — the composition template (`createWorkingCopy`
  at `:53`, `mkdirp` at `:63`, local git calls and the offline push). This task
  writes its sibling, `home-book.js`.
- `app/src/worker/git.js:44` — `createGitLayer` → `{ clone, fetch, push,
  bookDir }`; `bookDir(bookId)` → `/books/<bookId>` (`:63`), the shared
  convention for where a repository lives. The home book is a repository at its
  own `bookDir`.
- `app/src/worker/locks.js:61` — `createBookLocks({ navigator })` →
  `{ withLock(bookId, fn) }`; one exclusive Web Lock named `book:<bookId>`,
  non-reentrant. The home book takes a lock on its own id.
- `app/src/worker/fs.js:144` — the `{ promises }` surface (`readFile`,
  `writeFile`, `unlink`, `readdir`, `mkdir`, `stat`, …), isomorphic-git's `fs`.
- `app/src/worker/author.js` — `noReplyAddress(id)` →
  `` `${id}@users.estantedecifras.app` `` and `authorFrom({ id, name }, now)` →
  the isomorphic-git `author`/`committer` shape. Reused for the automatic
  commits (DIRECTION §3.2 L164–171).
- `app/src/worker/logic.js:118–128` — the `createWorkerLogic(port, options)`
  closure and its injection seam (`options.indexedDB`, `name`, `migrations`,
  `navigator`, `fetch`); `:154–163` — `ensureWorkingCopy()`, the memoised
  composition pattern an `ensureHomeBook()` (added by the **first store-command
  consumer**, not here — Decision 1) will mirror.
- `app/src/worker/migrations.js` (`META_STORE`) and `logic.js:33` / `:77–103`
  (`META_KEY`, `loadOrCreateMeta`) — the singleton `meta` record in the
  `estante` DB, where the §2.3 device id is persisted (an added field on the
  existing record; no new store, no migration — Decision 7).
- `app/src/worker/protocol.js` (`CommandKind`, `EventKind`) and
  `app/src/worker/reducer.js` — note that `EventKind.PREFERENCES`
  (`protocol.js:49`) and the `preferences` slice (`reducer.js:25–31`, `:120–125`)
  **already exist**: they are `shell.tokens`' contract, and their *producer* is
  `storage.preferences_surface`, a separate task. This task adds **no new
  protocol kinds** (Decision 1).
- `isomorphic-git ^1.43.0` — this task uses its local read/write commands
  (`add`, `commit`, `resolveRef`, `readBlob`, and a merge commit via
  `commit({ parent: [local, fetched] })`) directly over the injected `fs`,
  beside the transport in git.js (the boundary working_copy Decision 2 fixed).
- Test support: `app/src/test/git-http-remote.js` — `startGitHttpRemote()` (a
  real `git http-backend` over smart HTTP v1 with push enabled; returns
  `{ url, repoDir, stop() }`, auto-seeding a bare repo with a generic fixture
  commit, so the home book's own files are scaffolded by `home-book.js`, not
  pre-seeded); `app/src/test/web-locks.js` (`installWebLocks()` → a `restore()`
  teardown, keyed `book:<bookId>`); `fake-indexeddb ^6.2.5` (a fresh
  `new IDBFactory()` per test, threaded into both `createFileSystem(name, {
  indexedDB })` and the git layer); and reading committed state by spawning the
  `git` CLI against `--git-dir <remote.repoDir>` (`rev-parse`, `show`,
  `log --format=%ae/%ce/%P`, `diff-tree --name-only`), the idiom
  `working-copy.behavior.test.js` uses.

## Constraints / requirements

- **The Worker owns the home book; the view never does.** Every new module is
  framework-free plain ESM under `app/src/worker/`, imports no React, and is
  never imported by the main thread (DIRECTION §3.7 L407–409). The merge is the
  **Worker's own, not git's** (home-book-format.md §1.1 L40–46, §9 L503): the
  Worker reads both sides' JSON and computes the merged tree; git's line-based
  text merge is never consulted for settings.
- **Committed automatically** (DIRECTION §3.2 L141–143; workflow 8 L41–47). A
  `set` writes the file canonical and commits it with no explicit save; a `sync`
  that merges commits the merge and pushes it "without asking." There is no
  save sheet and no user confirmation in this flow.
- **Key-by-key merge, the later change winning** (home-book-format.md §5;
  workflow 8 L72–77; DIRECTION §6). Implemented exactly as §5: greater `at`,
  the §5.1 equal-time tie-break, tombstone retention, map union — a pure
  function that is commutative and associative (§5.4), so the auto-merge commit
  is reproducible regardless of fetch order.
- **Canonical form over preserving content** (standing rule; home-book-format.md
  §6). Every settings file is written in canonical form before it is committed;
  two converged devices write byte-identical files. A file holding anything
  non-canonical is never written and never pushed. The `README.md` and
  `.gitattributes` are the **exact bytes** of §2.2.
- **One lock per logical operation** (working_copy / locks.md Decision 1). A
  `set` (read → apply → write → `add` → `commit`) and a `sync` (fetch → merge →
  write → `add` → `commit` → push) each run inside **one** `withLock(homeBookId,
  …)` on the home book's own id; never reacquired per git call, never nested
  (Web Locks are non-reentrant). This keeps an auto-commit from interleaving
  with a concurrent sync on the same home book.
- **The author is the per-user no-reply address** (DIRECTION §3.2 L164–171). The
  automatic commits are authored and committed with `authorFrom` from
  `author.js` — the account user-id after sign-in, the device local id before.
  Never the user's real email, never logged.
- **Device id as a namespace key only** (home-book-format.md §2.3, §7, §9). The
  §2.3 device id is provisioned once in the `meta` store and used only as a map
  key; it is never a shared register and never leaves the namespace-key
  position, so per-device state cannot leak into account-wide settings.
- **Offline first** (standing rule; workflow 1 L72–78). `set` and the local
  commit never wait on the network and never fail for lack of one; the home book
  starts local with no remote and gains one on sign-in. `sync` is meaningful
  only with a remote; a push that fails for want of a network keeps the local
  commit (mirroring `working-copy.js:141–152`), to be retried by the sync
  engine.
- **No song text, preferences, labels, links or secrets in logs** (standing
  rule; DIRECTION §3.3). This module handles a person's preferences and the
  labels/links of their books; it logs none of it, and commit messages are
  content-free (they name the file touched, never a value). Errors surface to
  the caller (logic.js), which turns them into events — never to `console`.
- **Private to one account; no bespoke endpoint.** The home book moves over the
  same git-over-HTTP as any book (home-book-format.md §1 L18–21); this task uses
  the existing `createGitLayer` transport, no new API. Sharing and membership do
  not apply to it.
- **The byte ceiling and the allowed-kinds whitelist are the validator's**
  (home-book-format.md §8). The app writes only the eight kinds in canonical
  form; enforcing the whitelist and the 256 KB ceiling on a push is
  `hook.home_book` (deferred). The app does not re-police them.
- **Accessibility** — *not applicable.* No UI; a framework-free Worker module
  renders nothing. The screens that read home-book state carry their own axe
  coverage in their `shell`/`books`/`music`/`account` leaves.

## Acceptance criteria

### Behavior delivered

- **`app/src/worker/home-book-canonical.js`** — the §6 canonical JSON
  serializer. `serialize(value) → string`: sorts every object's keys by code
  point at every depth (so `at` precedes `value`), keeps array order, emits
  numbers as the shortest round-tripping decimal and strings with only the
  JSON-required escapes (lowercase `\u00XX`, solidus never escaped, non-ASCII
  literal), NFC-normalises all text, and pretty-prints two-space / one member or
  element per line / one trailing LF, with `{}` for the empty map (§6.1–6.3).
  `parse(bytes) → value` reads a settings file (an absent file is `{}`). Pure;
  no I/O, no logging; a fixed point (`serialize(parse(serialize(x)))` is
  byte-equal to `serialize(x)`).
- **`app/src/worker/home-book-merge.js`** — the §3 envelope and the §5 merge,
  pure. `isRegister(obj)` (exactly `{ value, at }` with a well-formed instant,
  §3); `mergeRegisters(a, b)` (§5.1 — greater `at`, else the §5.1.2 tie-break on
  `serialize(value)` compared as UTF-8 bytes); `mergeTrees(a, b)` (§5.2 — key
  union, per-key recursion, register/map mismatch flagged malformed; §5.3 —
  tombstones retained). The function is commutative and associative (§5.4).
  Imports `home-book-canonical.serialize` for the tie-break; imports nothing
  else.
- **`app/src/worker/home-book.js`** — `createHomeBook({ fs, git, locks })` →
  `{ read, set, sync, ensureDeviceId }`:
  - `read({ bookId, file })` — parse the working-copy file to its model; an
    absent file is `{}`.
  - `set({ bookId, file, changes, author, now = Date.now() })` — under one
    `withLock`: read the file, apply each change as a register `{ value,
    at: <instant(now)> }` (or a `null` tombstone to unset) at its key path,
    creating parent maps; `serialize` canonical and write it back; `add` and
    `commit` the **one file** automatically, authored by `authorFrom(author)`
    with a content-free message naming the file. No push (offline-first; the
    sync pushes). Returns the commit oid.
  - `sync({ bookId, author })` — under one `withLock`: `fetch` the origin; if the
    remote advanced, for each of the §2.1 settings files read both the local and
    the fetched blob (absent → `{}`), `mergeTrees`, `serialize` canonical, write
    back and `add`, then `commit` a merge with both parents
    (`parent: [localHead, fetchedOid]`) authored by `authorFrom(author)`; then
    `push`. Offline → the merge commit is kept and the result carries
    `pushed: false` (mirrors `working-copy.js:141–152`). A fresh home book is
    scaffolded with the §2.2 exact bytes of `README.md` and `.gitattributes`.
  - `ensureDeviceId({ idb, name })` — read the §2.3 device id from the `meta`
    record; generate a `crypto.randomUUID()` and persist it once if absent;
    return the stable id. Never a shared register (§2.3, §7).
- **No new protocol kinds, no logic.js dispatch.** Like `git.js`/`locks.js`
  before working_copy, this is the Worker-internal mechanism; the store commands
  and events belong to the consumer tasks that drive the home book
  (`storage.preferences_surface` for the `PREFERENCES` read — already contracted
  in `protocol.js`/`reducer.js` by `shell.tokens`; `books.shelf`, `music.*`,
  `account.*` for writes). This task adds no `CommandKind`/`EventKind` and leaves
  `reducer.js` untouched (Decision 1).

### Tests the task lands with, by level

- **unit** — `app/src/worker/home-book-merge.test.js` (the `.tji`'s "the
  key-by-key merge, the later change winning, equal times"): two registers, the
  greater `at` wins (§5.1.1 — *the later change winning*); **equal `at`** → the
  canonical-value byte tie-break, resolved identically whichever order the two
  sides are given (§5.1.2 — *equal times*); a map with a key on one side taken
  whole and a key on both recursed, two keys under one file not interfering
  (§5.2 — *key by key*); a later unset (tombstone) removes a key, an earlier
  unset loses to a later value, tombstones retained (§5.3); a side lacking a
  file merged as `{}`; `mergeTrees(a, b)` equals `mergeTrees(b, a)` and
  three-way merges converge regardless of order (§5.4); a register/map mismatch
  under one key flagged malformed (§5.2). Settings written for the purpose. Pins
  home-book-format.md §3, §5, workflow 8 L72–77, DIRECTION §6, and
  `tasks/40-storage.tji:47`.
- **unit** — `app/src/worker/home-book-canonical.test.js` (added: the canonical
  form is what makes the merge reproducible and the §5.1.2 tie-break total, so
  §6 is behaviour this task must pin). Keys sorted at every depth with `at`
  before `value` and nested maps sorted; an array (a recents list) kept in
  order; numbers shortest round-trip; strings escape only the required set with
  lowercase `\u00XX`, solidus unescaped, non-ASCII literal; NFC applied; the
  empty map `{}` + one LF; two-space one-member-per-line with a trailing
  newline; the fixed-point property. Pins home-book-format.md §6.
- **unit** — `app/src/worker/home-book.test.js` (added, small): `ensureDeviceId`
  generates a UUID once against a fresh `new IDBFactory()`, persists it in the
  `meta` record, and returns the same id on a second call; the id is a bare
  value, never wrapped in a register. Pins home-book-format.md §2.3, §7.
- **behavior** — `app/src/worker/home-book.behavior.test.js` (the `.tji`'s
  "settings changed in two working copies merged through the local remote,
  committed automatically"): two `createHomeBook` instances — devices A and B —
  each over its own fresh `new IDBFactory()` (fake-indexeddb, per-file) with a
  `createFileSystem` fs and `installWebLocks()` active, both cloning one
  `startGitHttpRemote()` url and scaffolding the home book (the §2.2 `README.md`
  / `.gitattributes` exact bytes written by `home-book.js` on first use, since
  the harness seeds only a generic fixture), the git layer with push enabled. It
  asserts, reading committed state by spawning the `git` CLI against
  `--git-dir <remote.repoDir>`:
  1. **A `set`s** `preferences.json` `theme = "palco"` — a commit is made
     **automatically** (no save), the file on disk is **canonical** bytes,
     authored by `<id>@users.estantedecifras.app`; A `sync`s and the remote's
     `refs/heads/main` advances (*committed automatically*, *the local remote*).
  2. **B `set`s** `preferences.json` `language = "pt-BR"` and `shelf.json` a
     label (a different key, a different file) — auto-commits — then **B `sync`s**:
     B fetches A's commit, the merged `preferences.json` holds **both** `theme`
     (from A) and `language` (from B) *key by key*, `shelf.json` is B's taken
     whole (A lacked it); a **merge commit** with two parents is made
     automatically and pushed; the remote advances (*merged through the local
     remote*).
  3. **The later change wins and converges byte-identically**: A and B both set
     `theme` with B's `at` the greater; after a round of sync both devices'
     `preferences.json` hold B's value and are **byte-identical** (§5.1, §5.4,
     §6 — the reproducible canonical auto-commit).
  4. **Offline**: with the remote unreachable, a `set` still commits locally and
     a `sync` resolves `pushed: false` without rolling back the commit
     (offline-first; workflow 1 L72–78).
  Pins workflow 8 L72–77 and L41–47, workflow 1 L72–78, workflow 13 L58–66,
  home-book-format.md §2.2, §5, §6, and `tasks/40-storage.tji:47`.

### Why no e2e-web / e2e-api / axe here

The `.tji` names only unit and behavior, and no UI ships in this task (the
account/shelf/instrument screens are `shell`/`books`/`music`/`account` leaves),
so there is nothing for axe or e2e-web. The home book syncing to the **real** Go
service and its pre-receive hook — the allowed-kinds whitelist and the canonical
settings check of home-book-format.md §8 — is pinned by `hook.home_book`'s
e2e-api, and the end-to-end new-device journey (the home book down first, the
shelf filling, a pre-sign-in device merged) by `account.new_device`'s e2e-web.
The local v1 harness is the right level for the Worker's writer/merger mechanism.

### Deferred work and graph notes

- **No new WBS leaves.** Every consumer already exists and `depends
  storage.home_book`: `storage.preferences_surface`, `books.shelf`,
  `music.instruments`, `music.transpose` (M2) and `account.new_device` (M4).
  Each adds its own store command/event and typed wrapper when it wires its
  flow; this task delivers the generic register/merge/canonical mechanism they
  share.
- **Graph note for the closer (not a new task): `sync.engine` should depend on
  `storage.home_book` and route the home book to this module's `sync`.** The sync
  engine (`tasks/45-sync.tji`, `sync.engine`) runs the fetch/merge/push loop
  "when it runs" (workflow 8 L12–25) over the user's books with the **cifra-aware**
  song merge; the home book must instead be routed to `home-book.js`'s §5 JSON
  `sync` (the merge is the Worker's own, not git's). `sync.engine` currently
  `depends service.change_check` only, not `storage.home_book`. This is the
  engine's existing scope, not new work — surfaced so the closer can add
  `storage.home_book` to `sync.engine`'s `depends` for an accurate graph. (Both
  are M2/M3 leaves; nothing is blocked, since `account.new_device` already
  depends on both.)

## Decisions

1. **This task adds no new protocol kinds or `logic.js` dispatch; it ships the
   Worker-internal writer/merger as composable modules.** The home book is
   mutated by later consumer tasks (`books.shelf`, `music.*`, `account.*`) and
   read by `storage.preferences_surface`; each adds its own store command/event
   and composes `createHomeBook` in the closure (an `ensureHomeBook()` beside
   `ensureWorkingCopy()`) when it wires its flow — exactly as `storage.git` and
   `storage.locks` shipped as primitives and `storage.working_copy` (their first
   consumer) wired them. The behavior test drives `createHomeBook` directly, as
   `git.behavior.test.js` drives `git.js`.
   *Rejected:* inventing a generic `SET_HOME`/`SYNC_HOME` command now — it would
   guess the consumers' API before any consumer exists, and the `PREFERENCES`
   read path is already `storage.preferences_surface`'s. Speculative protocol
   surface is churn.
2. **The merge is a pure function over two trees, computed by the Worker, never
   by git.** home-book-format.md §1.1 and §9 require the merger to read both
   sides' JSON and compute the result; `.gitattributes` sets `*.json
   merge=binary` only for a bystanding git client (§2.2). `home-book-merge.js`
   is therefore pure and transport-free, and `home-book.js` reads the two blobs
   (local HEAD and the fetched ref via `resolveRef`/`readBlob`) and feeds them to
   it. This keeps §5's commutativity/associativity testable in isolation
   (the unit level the `.tji` names) and the sync path thin.
   *Rejected:* a git merge driver for the home book — it would reintroduce the
   line-based conflict workflow 8 L72–77 forbids and could never guarantee
   byte-identical convergence.
3. **Local git read/write (`add`, `commit`, `resolveRef`, `readBlob`, the merge
   commit) live in `home-book.js`; the network stays in `git.js`.** This honours
   the boundary working_copy Decision 2 fixed — git.js is the narrow transport
   (clone/fetch/push) and its consumers compose their own units over the shared
   `fs`. The home book's two-parent merge commit (`commit({ parent: [local,
   fetched] })`) and the per-file auto-commit are its own.
   *Rejected:* extending git.js with commit/merge helpers — it would blur the
   transport primitive and no other consumer needs them there.
4. **A canonical JSON serializer, written here, is the single source of
   canonical bytes — for both writing files and the §5.1.2 tie-break.** §6 is
   stricter than `JSON.stringify` (sorted keys at every depth, NFC, the §6.2
   scalar forms, the §6.3 pretty-print), so a bespoke serializer is required;
   reusing it for the equal-time tie-break guarantees the tie-break and the
   on-disk bytes agree, which is what makes convergence byte-identical (§5.4,
   §6). A unit test pins it even though the `.tji` names only the merge, because
   the merge's reproducibility *depends* on it.
   *Rejected:* `JSON.stringify` with a replacer — it does not NFC-normalise, its
   key order is insertion order, and its number/escape forms are not §6.2; it
   cannot produce the canonical bytes two devices must agree on.
5. **Offline-first: `set` commits locally and never pushes; `sync` pushes and a
   failed push keeps the commit.** Workflow 1 L72–78 — the home book starts
   local and gains a remote only on sign-in; DIRECTION §3.2 — it is committed
   automatically. So an auto-commit must never wait on or fail for the network;
   `sync` (invoked by the engine's loop) is where the push happens, and a failed
   push resolves `pushed: false` without rolling back, mirroring
   `working-copy.js:141–152`.
   *Rejected:* pushing inside `set` — it would make a preference change wait on
   the network and fail offline, breaking offline-first and coupling every
   setter to connectivity.
6. **The automatic commit's author `id`/name are inputs, not generated here; the
   §2.3 device id is this task's.** The commit author is the no-reply address
   formed by `author.js` from an `id` the caller carries (the account id after
   sign-in, the device *local id* before) — forming the local id and rewriting
   unpushed commits on sign-in is `account.sign_in`'s (DIRECTION §3.2
   L168–170), as working_copy Decision 7 fixed. The **§2.3 device id** (the
   namespace key for recents and local books) is a *different* identifier and
   *is* this task's to provision (`ensureDeviceId`), because home-book-format.md
   §9 makes it the writer's conformance duty.
   *Rejected:* conflating the two ids, or generating the commit-author local id
   here — it would duplicate account-flow state and couple this task to sign-in.
7. **The device id is persisted as a field on the existing `meta` record, not a
   new store or migration.** home-book-format.md §2.3 places it in "the `meta`
   object store, outside the home book"; `loadOrCreateMeta`
   (`logic.js:77–103`) already reads and rewrites that singleton record, so
   `ensureDeviceId` adds a `deviceId` field to it lazily — no `storage.migrations`
   step, since no store shape changes (a new field on an existing record needs
   none).
   *Rejected:* a dedicated object store or a migration step — disproportionate
   for one UUID on a record that is already mutated in place.
8. **Settings are split across the eight §2.1 files, each committed on its own;
   there is no `home.json`.** This is the format's decision
   (`design.home_book_format`); honouring it keeps a preference change a
   one-file, one-line diff and the history legible (§2.1 L93–95). `set` touches
   and commits exactly the one file whose registers changed.
   *Rejected:* batching unrelated files into one commit — it would reintroduce
   the noisy history the file split exists to avoid.

## Open questions

(none — all decided.)

The format's own two open questions (home-book-format.md §Open questions
L514–534) — wall-clock skew under last-write-wins, bounded by the §5.1.2
tie-break; and tombstone pruning, retained for correctness with compaction
deferred — are accepted design limitations recorded there, not this task's to
settle and not WBS tasks. This task implements the format as written, including
retaining tombstones (§5.3).

## Status

**Done** — 2026-10-05.

- `app/src/worker/home-book-canonical.js` — §6 canonical JSON serializer (`serialize`/`serializeBytes`/`parse`): code-point-sorted keys at every depth, NFC, §6.2 scalar forms, two-space pretty-print, `{}` + one trailing LF, fixed-point property.
- `app/src/worker/home-book-merge.js` — §3 register envelope + §5 merge (`isRegister`/`mergeRegisters`/`mergeTrees`): pure, commutative, associative; imports canonical only for the §5.1.2 UTF-8 tie-break.
- `app/src/worker/home-book.js` — `createHomeBook({ fs, git, locks })` → `{ read, set, sync, ensureDeviceId }`: one-lock-per-op, auto-commit on `set`, offline-first push in `sync`, two-parent Worker-computed merge, §2.2 scaffold (`README.md` / `.gitattributes`), §2.3 device id on the `meta` record.
- `app/src/worker/home-book-merge.test.js` — unit (13 tests): §5.1.1 later change wins, §5.1.2 equal-time tie-break, §5.2 key-by-key map union, §5.3 tombstone retention, §5.4 commutativity/associativity, register/map mismatch.
- `app/src/worker/home-book-canonical.test.js` — unit (10 tests): sorted keys, array order kept, number/string scalar forms, NFC, `{}` + one LF, two-space pretty-print, fixed-point.
- `app/src/worker/home-book.test.js` — unit (2 tests): `ensureDeviceId` generates once, persists in `meta`, stable on second call.
- `app/src/worker/home-book.behavior.test.js` — behavior (4 tests): auto-commit, key-by-key merge through local remote, convergence + byte-identity, offline push with `pushed: false`.
- No new protocol kinds; `logic.js`/`protocol.js`/`reducer.js` untouched (Decision 1). No tech-debt follow-up tasks.
