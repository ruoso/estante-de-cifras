# storage.shelf_surface — Surface shelf.json for book labels and status

## TaskJuggler entry

`tasks/40-storage.tji`, `task storage.shelf_surface "Surface shelf.json for book labels and status"` (lines 91–96):

> The Worker reads shelf.json from the home book and emits a SHELF event the reducer folds into a shelf slice (each book's label, link, and per-book status — 'reading', 'N setlists'), mirroring storage.preferences_surface; the search screen and books.shelf both read it for labels and counts. Source of debt: tasks/refinements/songs/search.md (songs.search), Decision 6. Tests: unit (shelf.json → the shelf event payload; an absent book stays absent); behavior (the Worker against a fake IndexedDB and a local git remote surfaces a shelf change, the reducer folds it).

`depends !home_book`.

## Effort estimate

**1d**, as scoped in the `.tji`. The work is small and almost all composition against a path that already exists: a pure projection module, three edits to `logic.js` (a `surfaceHomeBookShelf()` helper, a call on open, a call in the already-present `SYNC_HOME` case), one new `EventKind` and one new slice with a fold that copies the `PREFERENCES` one, and the wiring of the one live consumer (`SearchScreen`'s book label). The hard parts — the register/merge/canonical mechanism, the Worker's `OPEN`/`SYNC_HOME` surfacing path, and the store/`useSyncExternalStore` seam — already shipped with `storage.home_book` and `storage.preferences_surface`.

## Repository

**estante-de-cifras only** (`app/`). This is app work below the view: framework-free Worker modules under `app/src/worker/`, plus a two-line consumer change in the view (`app/src/songs/SearchScreen.jsx`). The note does **not** start with `cifra.md:`; nothing in the sibling `/home/ruoso/devel/cifra.md` repo changes — `shelf.json` is a home-book file, not a cifra.md song (`docs/home-book-format.md` §1, §4.2). The app and the service share no code (DIRECTION §3.6). **No design delta** is authored: the protocol is open to new kinds (`protocol.js` builders; DIRECTION §3.7 L410–414 "each is a message"), the home book's JSON sync is already in DIRECTION §3.2 and workflow 8, and `shelf.json`'s shape is already fixed by `home-book-format.md` §4.2. The decision not to store the per-book *status* in `shelf.json` (Decision 3) keeps the format unchanged, so there is no `home-book-format.md` edit here. Plain JS/JSX; no TypeScript. Contracts are JSDoc `@typedef`s, as every sibling in `app/src/worker/`.

## Inherited dependencies

- **storage.home_book** — *settled, Done 2026-10-05.* Gives the module this task reads through and the file it surfaces:
  - `createHomeBook({ fs, git, locks })` → `{ read, set, sync, ensureDeviceId }` (`app/src/worker/home-book.js:124`); `read({ bookId, file })` (`home-book.js:201`) parses a settings file to its model, an absent file as `{}` (ENOENT → `{}`, `readModel` `home-book.js:133–140`) — the exact read this task surfaces, and safe before any home book exists.
  - `shelf.json` is already a tracked settings file: it is one of the §2.1 files in `SETTINGS_FILES` (`home-book.js:56–63`, `shelf.json` at `:58`), so it is already written, merged key by key and synced by the home book exactly like `preferences.json` — **no change to the writer/merger is needed** for a surface task. The home-book behavior test already seeds `shelf.json` and asserts its merged canonical bytes (`home-book.behavior.test.js:172–195`).
  - `sync({ bookId, author })` (`home-book.js:251`) fetches, merges each settings file key by key (the Worker's own §5 merge, not git's), commits and pushes; offline-first (`home-book.js` keeps the local commit on a failed push). This is the sync after which the shelf re-surfaces.
  - `ensureDeviceId({ idb, name })` (`home-book.js:350`) reads/creates the device id on the `meta` record — the key by which `shelf.json`'s `local` books are namespaced (§2.3, §7), used to narrow the surfaced `local` map to this device (Decision 4).
  - The envelope predicate reused here: `isRegister(obj)` — exactly `{ value, at }` with a well-formed §3 instant (`app/src/worker/home-book-merge.js:36`), neither re-authored.
  - `HOME_BOOK_ID = 'home'` (`home-book.js:86`), the reserved id the surface reads.
- **storage.preferences_surface** — *settled, Done 2026-10-05* (the pattern this task mirrors one-for-one; a sibling in area `storage`, [`preferences_surface.md`](preferences_surface.md)). It shipped:
  - the pure projection `surfacePreferences(model)` (`app/src/worker/preferences.js:31–38`), filtering top-level entries through `isRegister`; `surfaceShelf` is its nested analogue.
  - the Worker glue: `ensureHomeBook()` (`app/src/worker/logic.js:314`), `surfaceHomeBookPreferences()` (`logic.js:410–416`) called on `OPEN` after `READY` (`logic.js:445`), and the `CommandKind.SYNC_HOME` case that syncs the home book then re-surfaces (`logic.js:635–649`, the re-surface at `:647`). `surfaceHomeBookShelf()` is added beside each.
  - the event/slice/fold contract to copy: `EventKind.PREFERENCES` (`protocol.js:79`), the `preferences: {}` slice (`reducer.js:31`) and its fold — a whole-slice replace, an absent payload resetting to `{}`, "only what shows it moves" (`reducer.js:292–297`).
  - the store + `useSyncExternalStore` seam `useSlice(store, name)` (`app/src/worker/useStore.js:14–20`) the consumer reads through, and the loopback + fake-IndexedDB + local-git-remote behavior harness (`app/src/test/loopback.js`, `app/src/test/git-http-remote.js`, `app/src/test/web-locks.js`, `fake-indexeddb`) this task's behavior test reuses.
  - Transitively settled: **storage.git/fs/locks/worker/migrations** (the filesystem, git layer, lock registry, protocol/store/reducer/logic seam) and **foundation.app_tooling** (React 19 + React Aria, Vite, Vitest/jsdom, the shared `checkWcag21aa` in `app/src/a11y/axe.js`).

Nothing pending blocks this task; everything it consumes is Done. Its consumers are **songs.search** (already shipped with the `bookId` fallback this task replaces — Decision 5) and the future **books.shelf** (the book-management screen, workflow 7), which reuses the same slice; and **sync.engine**, which drives `SYNC_HOME` on its schedule and so re-surfaces the shelf for free (graph note, below).

## What this task is

Make the home book's **shelf** — the user's labels, clone links and order for each book, and the markers for this device's local-only books — **visible to the view**. The Worker already owns the home book and already writes, merges and syncs `shelf.json`; nothing yet **reads that file and emits an event** for the main-thread store. This task is that producer, built as the exact mirror of `storage.preferences_surface`:

1. A pure projection — `shelf.json`'s model → the `SHELF` payload. Unlike `preferences.json` (a flat map of registers), `shelf.json` is **nested**: `books.<book-id>.{label,link,position}` registers for shared books, and `local.<device-id>.<local-book-id>.{title,position}` registers for local-only books (`home-book-format.md` §4.2). The projection walks that nesting, keeping only well-formed `isRegister` leaves (an absent register stays absent; a malformed entry is dropped), and narrows `local` to **this device's** namespace (§7).
2. The Worker wiring in `logic.js`: a `surfaceHomeBookShelf()` helper that reads `shelf.json`, projects it, and posts a `SHELF` event; called on `OPEN` right after the preferences surface, and again in the existing `SYNC_HOME` case after the home-book sync, so a label or link a sync changed reaches the slice.
3. A new `EventKind.SHELF` and a `shelf` slice folded by a `SHELF` case that copies the `PREFERENCES` fold (whole-slice replace; absent → `{}`). **No new command** — `SYNC_HOME` already exists and already re-surfaces the home book (Decision 1).
4. The one live consumer: `SearchScreen`'s `bookLabelFor`/`scopeChipLabel` read the shelf label, falling back to the `bookId` when absent — resolving the seam `songs.search` Decision 6 left open.

It is the **read/surface** path only. Writing the shelf (relabelling a book, adding or reordering one) is the consumer tasks' — `home-book.set` is already built; the book-management screen that calls it is `books.shelf` (workflow 7), not this task. Provisioning the home book (cloning on a new device) is `account.new_device` / first-run; before a home book exists `read` returns `{}` and the shelf slice is `{}`.

## Why it needs to be done

Without this task the `shelf` slice does not exist, and the search screen labels every book by its opaque `bookId` rather than the name the user gave it — `songs.search` shipped with exactly that gap, deferred to here (Decision 6, below). A user's label and the clone link for a book live in the home book and sync across devices, but never reach the view. It is the last link between the shelf `home-book-format.md` §4.2 describes and the two screens that show it (search now, `books.shelf` next), and the seam the sync engine needs so a book relabelled on another device re-labels here. It is a leaf of milestone **M2** (`milestones.m2_local`), the same milestone `storage.home_book`, `storage.preferences_surface` and `songs.search` belong to.

## Inputs / context

### Governing design

- **DIRECTION §3.2 "Personal state"** (`docs/DIRECTION.md` L136–151): a user's labels and shelf order are personal state that "lives in a **home book** … committed automatically — explicit save is for what the user authors, not for preferences" (L141–144); the home book is "a **settings repository** … its files are JSON that merge key by key, the later change winning (workflow 8)" (L146–147); the format is `home-book-format.md` (L148–151). This also governs Decision 3: a derivable count (how many setlists a book holds) is not settable personal state and does not belong in the home book.
- **DIRECTION §3.7 "The app"** (L394–427): "**One owner for the data: a Web Worker.** … The main thread never touches IndexedDB" (L407–409); "**The interface mirrors it.** A store on the main thread is fed by the Worker's messages, and components read the slices they need through `useSyncExternalStore` … only what shows it moves" (L410–414). The shelf reaches the view **only** as a Worker event folded into a slice — never by the view reading the home book.
- **DIRECTION §3.6** (L277–): the app and the service share no code (named for repository scope; nothing here touches the service).

### Workflows

- **Workflow 2 §(the search screen)** (`docs/workflows/02-find-and-play.md` L11): "The app opens on search: one box, across every book on the shelf." The pre-typing listing shows books as sections; the human label for each is what this task supplies (`songs.search` Decision 6).
- **Workflow 7 §The book-management screen** (`docs/workflows/07-add-a-book.md` L14–21): the shelf lists each book with "its **title**: the README's level-1 heading, or the repository name (DIRECTION §2.1), unless the user has renamed it on their shelf — a label kept in the home book that changes nothing in the repository", plus where it lives, whether the user can save, and its sync state. The **label** is the `books.<id>.label` register this task surfaces; the local-only marker ("on this device") is the `local` namespace it surfaces (§7). `books.shelf` is the screen that will render this; it does not exist yet and is not in scope.

### The format

- **`docs/home-book-format.md` §4.2 `shelf.json`** (L208–245): "Two maps: the shared books, keyed by book id, and the local-only books, namespaced by device id (§7)." Each shared book is a map of three registers — `label` (the user's label), `link` (the clone URL), `position` (the order key); **"Only the link and the label are written"** for shared books (L233–237). Each local book is a map of `title` and `position` (L238–245). This fixes the payload shape (the nested maps of registers) and carries **no status field** — the basis of Decision 3.
- **§3 the register envelope** (L150–180): an object is a register iff its keys are exactly `value` and `at` with `at` a well-formed instant. `isRegister` (`home-book-merge.js:36`) is this predicate; the projection filters every leaf through it.
- **§5 the merge** (L330–377) and **§5.3 tombstones** (L360–367): registers merge by the greater `at`, a tombstone (`value: null`) is a well-formed register and is kept — so a label the user cleared surfaces as a `null`-valued register, which the consumer reads as "no label" (falls back to the title/`bookId`).
- **§7 Per-device state** (L445–463) and **§2.3 identifiers** (L129–149): local-only-book markers are namespaced by device id; "A device writes and reads only its **own** namespace." The projection narrows the surfaced `local` map to this device (Decision 4).

### The code seams this extends

- `app/src/worker/home-book.js` — `createHomeBook({ fs, git, locks })` (`:124`); `read` (`:201`, the surfaced read), `sync` (`:251`, the re-surface trigger), `ensureDeviceId` (`:350`, the device-id source for §7 narrowing); `SETTINGS_FILES` (`:56–63`, `shelf.json` at `:58`); `HOME_BOOK_ID` (`:86`).
- `app/src/worker/home-book-merge.js:36` — `isRegister(obj)` (the §3 predicate the projection filters with); `isMap` (`:95`) and `mergeTrees` (`:115`) establish how the nested structure is walked.
- `app/src/worker/preferences.js:31–38` — `surfacePreferences(model)`, the flat-map projection `surfaceShelf` mirrors one level deeper.
- `app/src/worker/protocol.js` — `EventKind` (`:73`, add `SHELF`); `CommandKind.SYNC_HOME` (`:37`, reused, no new command); `event()` builder (`:117`); `PROTOCOL_VERSION` (`:16`).
- `app/src/worker/reducer.js` — `initialState` (`:15`, add `shelf: {}`); the `PREFERENCES` fold (`:292–297`, the exact pattern the `SHELF` fold copies).
- `app/src/worker/logic.js` — `ensureHomeBook()` (`:314`); `surfaceHomeBookPreferences()` (`:410–416`); `handleOpen()` (`:429`) posting `READY` (`:439`) then surfacing preferences (`:445`) and recents (`:449`) — where `surfaceHomeBookShelf()` is appended; the `SYNC_HOME` case (`:635–649`, re-surface at `:647`) — where the shelf re-surface is appended; `import { surfacePreferences }` (`:32`).
- `app/src/worker/useStore.js:14–20` — `useSlice(store, name)` over `useSyncExternalStore`, the selector seam the consumer reads through.
- `app/src/songs/SearchScreen.jsx` — the live consumer: `scopeChipLabel(scope)` (`:234–242`) and `bookLabelFor(bookId)` (`:327–328`, today `(bookId) => bookId`), both tagged "until shelf.json is surfaced (Decision 6)" (`:234`, `:327`); `bookById` built from the browse slice (`:321–325`); the slice reads (`:249–253`). Book counts come from the `browse` slice, not from `shelf.json` (Decision 3).
- Test support (as `preferences-surface.behavior.test.jsx` uses them): `app/src/test/loopback.js` (`createLoopbackEndpoint`), `app/src/test/git-http-remote.js` (`startGitHttpRemote()`), `app/src/test/web-locks.js` (`installWebLocks()`), `fake-indexeddb` (a fresh `new IDBFactory()` per test), `createStore` (`app/src/worker/store.js`), `app/src/a11y/axe.js` (`checkWcag21aa`).

## Constraints / requirements

- **The Worker owns the home book; the view never reads it.** The shelf reaches the view only through the `SHELF` event folded into the `shelf` slice (DIRECTION §3.7 L407–409). The projection and surfacing are framework-free Worker code; only `SearchScreen` (already React) is the view side.
- **The payload is the whole shelf, not a delta.** The reducer *replaces* the slice (copying `reducer.js:292–297`), so every emit — on open and after a sync — surfaces the complete current `shelf.json`, narrowed to this device's `local` namespace.
- **An absent book, or an absent register, stays absent.** The projection never fabricates a book, a label, a link or a position; a book not in the file is not in the payload, and a register absent for a book that is present stays absent (so the consumer falls back to the repository title / `bookId`). A tombstone (`{ value: null, at }`) is a well-formed register (§5.3) and is kept; the consumer reads a `null` label as "no label."
- **Only well-formed registers surface.** Every leaf is kept only if it passes `isRegister` (§3); a malformed entry at any level is dropped, so the slice carries only `{value, at}` registers (a malformed home book is the validator's concern — `hook.home_book` — not something to crash the surface).
- **`local` is narrowed to this device (§7).** The surfaced `local` map holds only the namespace of the device id `ensureDeviceId` returns; another device's local-book markers never reach this device's view.
- **Safe before any home book exists.** On `OPEN` with no home book cloned yet, `read` returns `{}` (ENOENT) and the surface emits `{}` — never an error, never a crash. Provisioning is `account.new_device` / first-run.
- **Offline first** (standing rule). The initial surface on `OPEN` is a local read and never waits on the network. The re-surface rides the existing `SYNC_HOME` case, whose `home-book.sync` is offline-first; the re-surface runs regardless, reflecting whatever the local tree now holds.
- **One lock per logical operation** (locks.md Decision 1). `SYNC_HOME` already takes one `withLock(HOME_BOOK_ID, …)` for the whole fetch → merge → commit → push inside `home-book.sync`; the surface read runs outside that lock (a plain working-copy read). This task adds no new locking.
- **No labels, links or secrets in logs** (standing rule; DIRECTION §3.3). The projection and surfacing log nothing — a shelf label is a user's words and a link is account data; errors surface as the Worker's `ERROR` event via the existing catch, never to `console`, and never carry a label or link.
- **No new command, one new event, one new slice.** Add `EventKind.SHELF` and the `shelf` slice + fold only; reuse `SYNC_HOME` (Decision 1). The channel is designed for new kinds.
- **Accessibility.** The only view change is the text `SearchScreen` already renders for a book (a label instead of a `bookId`): no new interactive element, no new structure. The `SearchScreen` behavior test runs `checkWcag21aa` on the rendered screen (it already does) with a shelf label in place; the screen's contrast across viewports is pinned by `songs.search`'s e2e-web. Status is carried by a word, never colour alone (standing rule) — but the 'reading'/'N setlists' status is not this task's (Decision 3).
- *Rules named for completeness, not bearing here:* canonical form over preserving content (no file is written by this task — it only reads; the writer/merger is `home_book`'s); no book without an account (the home book is private to one account on the existing transport, no new endpoint).

## Acceptance criteria

### Behavior delivered

- **`app/src/worker/shelf.js`** — the pure projection. `surfaceShelf(model, deviceId) → payload`: returns `{ books, local }` where `books` is a new map holding, for each shared book, the sub-map of its `isRegister` leaves (dropping malformed ones; an absent register absent), and `local` is the sub-map of **only** `model.local[deviceId]`'s books, each reduced to its `isRegister` leaves. A non-object/array model, or an absent `books`/`local`, yields the empty sub-map; `{}` → `{ books: {}, local: {} }`. Pure; no I/O, no logging; imports only `isRegister` from `home-book-merge.js`.
- **`app/src/worker/logic.js`** — the wiring:
  - `surfaceHomeBookShelf()` — reads `ensureHomeBook().read({ bookId: HOME_BOOK_ID, file: 'shelf.json' })`, obtains the device id via `ensureHomeBook().ensureDeviceId({ idb, name })` (the same `idb`/`name` the closure already holds), applies `surfaceShelf(model, deviceId)`, and `port.postMessage(event(EventKind.SHELF, payload))`.
  - `handleOpen()` calls `surfaceHomeBookShelf()` after `surfaceHomeBookPreferences()` (`logic.js:445`), so the current shelf surfaces on bring-up (an empty `{ books: {}, local: {} }` when none).
  - the existing `case CommandKind.SYNC_HOME` (`logic.js:635–649`) calls `await surfaceHomeBookShelf()` after `await surfaceHomeBookPreferences()` (`:647`) — the re-emit after a sync that may have changed a label, link or order.
- **`app/src/worker/protocol.js`** — `EventKind.SHELF = 'shelf'` added, with a one-line comment describing the payload (`{ books, local }` of `{value, at}` registers). No new `CommandKind`.
- **`app/src/worker/reducer.js`** — `shelf: {}` added to `initialState`, and a `case EventKind.SHELF: return { ...state, shelf: message.payload ?? {} }` copying the `PREFERENCES` fold (whole-slice replace; only this slice moves).
- **`app/src/songs/SearchScreen.jsx`** — `bookLabelFor(bookId)` returns `shelf?.books?.[bookId]?.label?.value` when present and truthy, else the `bookId` (the existing fallback); `scopeChipLabel` uses the same label. `const shelf = useSlice(store, 'shelf')` added to the slice reads (`:249–253`). The Decision-6 comments (`:234`, `:327`) are updated to point at this task.
- **Observable result**: with a home book whose `shelf.json` holds `books.b-1.label = "Turma de quarta"`, after `OPEN` the `shelf` slice is `{ books: { 'b-1': { label: { value: "Turma de quarta", at } } }, local: {} }` and the search screen's book section (and any scope chip for `b-1`) reads **Turma de quarta** instead of `b-1`; after a `SYNC_HOME` that merges a remote relabel to "Turma de quinta" (a later `at`), the slice updates and the screen re-labels; with no `label` register for a book the screen falls back to the `bookId`.

### Tests the task lands with, by level

- **unit — `app/src/worker/shelf.test.js`** (the `.tji`'s "shelf.json → the shelf event payload; an absent book stays absent"):
  - a `shelf.json` model with two shared books (each `label`/`link`/`position` registers) → `payload.books` holds both unchanged (the nested map of `{value, at}` registers);
  - a model whose `local` has this device's namespace **and** another device's → `payload.local` holds only this device's books, the other device's excluded (§7 L445–463);
  - a shared book present but with **no `label`** register → that book present in `payload.books` with no `label` key (*an absent register stays absent* — not defaulted, not fabricated);
  - a tombstone `label: { value: null, at }` is kept (a well-formed register, §5.3);
  - a malformed leaf — not `{value, at}`, or `at` not a §3 instant, at either nesting level — is dropped;
  - `{}` → `{ books: {}, local: {} }`; a non-object model → `{ books: {}, local: {} }`.
  Books written for the purpose. *Pins:* home-book-format §4.2 L208–245, §3 L150–180, §5.3 L360–367, §7 L445–463; and `tasks/40-storage.tji:95`.
- **behavior — `app/src/worker/shelf-surface.behavior.test.jsx`** (the `.tji`'s "the Worker against a fake IndexedDB and a local git remote surfaces a shelf change, the reducer folds it"): over a fresh `new IDBFactory()`, `installWebLocks()` active and a `startGitHttpRemote()`, clone the home book into the device's fs and seed `shelf.json` with `books.b-1.label = "Turma de quarta"` (reusing the `home-book.behavior.test.js:172–195` seeding shape); build a store via `createStore(createLoopbackEndpoint((port) => createWorkerLogic(port, { indexedDB, name, fetch })))`. Then:
  1. `store.open()` → the Worker reads `shelf.json` and emits `SHELF`; the reducer folds it; `store.slice('shelf')` is `{ books: { 'b-1': { label: { value: 'Turma de quarta', at } } }, local: {} }` (*surfaces*, *the reducer folds it*).
  2. A second `createHomeBook` device (or a direct commit) pushes `books.b-1.label = "Turma de quinta"` with a later `at`; `store.send(command(CommandKind.SYNC_HOME, { author }))` → the Worker fetches, merges key by key, re-surfaces; `store.slice('shelf').books['b-1'].label.value === 'Turma de quinta'` (*re-emitted when sync changes a register*, workflow 8).
  3. A `local` book under this device's namespace surfaces in `store.slice('shelf').local`; one seeded under a *different* device id does not (§7).
  4. With a home book whose `shelf.json` is absent/empty, `open()` surfaces `{ books: {}, local: {} }` — the empty path end to end.
  *Pins:* `tasks/40-storage.tji:95`; DIRECTION §3.2 L136–151, §3.7 L407–414; home-book-format §4.2, §7; workflow 8.
- **behavior — `app/src/songs/SearchScreen.behavior.test.jsx`** (edited; the consumer wiring that resolves `songs.search` Decision 6): with the screen rendered and a `shelf` slice carrying `books.b-1.label`, the book section (and a `b-1` scope chip) shows the label **Turma de quarta**, not `b-1`; with no `label` register the screen falls back to `b-1` (Decision 6's fallback preserved). `checkWcag21aa` on the rendered screen is clean with the label in place. The slice is supplied the way the file already supplies slices for this screen (a store fed a `SHELF` event, mirroring `ThemeRoot.test.jsx`'s `manualStore()` pattern) — no heavy worker/index build needed to pin a label. *Pins:* `tasks/40-storage.tji:95`; `songs.search` Decision 6; workflow 2 L11, workflow 7 L14–21.

No test level is dropped; no test is deferred.

### Why no e2e-web / e2e-api / axe-contrast here

The `.tji` names only **unit** and **behavior**. No new screen ships — the one consumer, `SearchScreen`, already exists and already has its e2e-web journey and axe-contrast coverage from `songs.search`; swapping an opaque `bookId` for a label changes the text, not the structure or the palette, and is pinned at the behavior level with an axe check. The end-to-end shelf-across-devices journey — a book relabelled on one device showing relabelled on another after the home book syncs against the **real** Go service and its `hook.home_book` validator — is `account.new_device`'s / `sync.engine`'s e2e, not this producer seam's. The loopback + fake-IndexedDB + local-remote harness is the right level here, exactly as for `storage.preferences_surface`.

### Deferred work and graph notes

- **No new WBS leaves.** This task is read-only and complete in itself; the *write* side (relabelling, reordering, adding a book) is `books.shelf`'s (workflow 7), already a planned screen. Tests are not deferred — all three land here. The sibling `storage.recents_reconcile` (already in `tasks/40-storage.tji:97–102`) is a separate follow-up and not this task's to register.
- **Graph note for the closer (not a new task): add `storage.shelf_surface` to `sync.engine`'s `depends`.** `sync.engine` (`tasks/45-sync.tji`) drives `SYNC_HOME` on its schedule; because the shelf re-surface is appended to the existing `SYNC_HOME` case, the engine re-surfaces the shelf for free — but the graph should record the dependency, as it already records `storage.preferences_surface` there (both M2 leaves; nothing is blocked — surfaced so the closer can add the edge).

## Decisions

1. **Reuse the existing `SYNC_HOME` command; add no new command.** The note requires the shelf "re-emitted when sync changes a register," and `SYNC_HOME` already exists (added by `storage.preferences_surface`) and already syncs the whole home book and re-surfaces it (`logic.js:635–649`). `surfaceHomeBookShelf()` is appended to that same case, so one command re-surfaces every home-book-derived slice.
   *Rejected:* a new `SYNC_SHELF` command — the home book syncs as **one** repository (`home-book.sync` fetches, merges every §2.1 file and pushes in one locked operation), so a per-file sync command would fragment that and duplicate the trigger; the engine and the behavior test both already drive `SYNC_HOME`.
2. **Add `EventKind.SHELF` and a `shelf` slice; mirror the `PREFERENCES` fold exactly (whole-slice replace; absent → `{}`).** Two independently-changing files must move two slices independently — "only what shows it moves" (DIRECTION §3.7 L410–414): a book relabel must not re-render a theme consumer, and a theme change must not re-render the shelf.
   *Rejected:* extending the `PREFERENCES` event/slice to carry the shelf too — it would couple two unrelated files and break the referential-stability contract the reducer is built on.
3. **The `shelf` slice carries only `shelf.json`'s registers (label, link, position; this device's local title, position). The 'reading' / 'N setlists' status the note and the search mockup show is composed by the consumers from derived state, and `shelf.json` is not extended to hold it.** `home-book-format.md` §4.2 fixes `shelf.json` with no status field, and for a reason: a book's **setlist count** is derivable from its content — `songs.search`'s `browse` slice already carries a per-book song count from the index, and a setlist count is the same kind of index-derived fact — and **"reading"** is an ephemeral per-device reading state, not a value the user sets. Neither is settable personal state the home book should store (DIRECTION §3.2); storing a derived count there would duplicate the truth and go stale the moment a setlist is added or removed (the canonical-source standing rule). So the surface supplies the **label and link**; a consumer that wants to show "32 songs · 2 setlists" composes it from its own `browse`/index slice plus this label. Surfacing only label/link/position is faithful to §4.2, so **no format/design delta is needed**.
   This resolves an imprecision in the `.tji` note and in `songs.search` Decision 6, both of which say the status "comes from `shelf.json`"; it does not, and the format never provided for it. The label — which *does* come from `shelf.json` — is surfaced here; status composition stays with the screen that renders it (none renders it yet; `songs.search` currently renders only counts, from `browse`).
   *Rejected:* adding `status`/`setlists` registers to `shelf.json` (a `home-book-format.md` §4.2 delta) — it would store derivable, stale-prone data in the synced home book and make a book relabel and a setlist edit contend over the same file's history; it also contradicts §3.2's "explicit save is for what the user authors."
4. **Narrow `local` to this device's namespace in the projection (§7).** `surfaceShelf(model, deviceId)` surfaces `books` whole and only `local[deviceId]`, taking the device id from `ensureDeviceId` (mirroring how recents are device-scoped).
   *Rejected:* surfacing every device's `local` namespace and filtering in the view — §7 says a device reads only its own namespace, so keeping the narrowing in the Worker projection means the view never sees another device's local-book titles. (A recovery flow that lists a book "only on your iPhone," workflow 13, is `account.new_device`'s, not this task's.)
5. **Wire `SearchScreen` to read the shelf label now, falling back to `bookId` when absent; do not render the 'reading'/'N setlists' status.** `songs.search` Decision 6 explicitly deferred label enrichment to "when `storage.shelf_surface` lands," and this is when; a slice with no consumer would be dead code.
   *Rejected:* leaving `SearchScreen` on the `bookId` fallback and deferring the wiring to a later task — the note names the search screen as a reader, and the fallback was always a placeholder for this surface. *Rejected:* rendering the status in `SearchScreen` here — that is the status-composition work of Decision 3, which this task does not do and no screen yet needs.
6. **The projection keeps only `isRegister` leaves and never walks a value; `{}` → `{ books: {}, local: {} }`.** `home-book-format.md` §4.2 makes `shelf.json` nested maps of registers, and §3's predicate (`isRegister`, reused) is the exact leaf test; a malformed entry is dropped rather than surfaced or thrown on, keeping the slice clean without this task policing the format (that is `hook.home_book`'s).
   *Rejected:* passing the raw nested model through — a malformed file could put a non-register into the slice and break a consumer reading `.label.value`.

## Open questions

(none — all decided.) The one framing discrepancy — the `.tji` note and `songs.search` Decision 6 both say the per-book status "comes from `shelf.json`," which `home-book-format.md` §4.2 does not provide for — is resolved by Decision 3 (status is derived by consumers; the format is not extended) and needs nothing further; it is surfaced in the return summary in case the product wants to re-word that mockup expectation, but it is not a task.

## Status

**Done** — 2026-10-06.

- Created `app/src/worker/shelf.js` — pure `surfaceShelf(model, deviceId)` projection; walks the nested `books`/`local` maps, keeps only `isRegister` leaves, narrows `local` to this device's namespace (§7); `{}` and non-object inputs yield `{ books: {}, local: {} }`.
- Edited `app/src/worker/protocol.js` — `EventKind.SHELF = 'shelf'` added with a one-line payload comment.
- Edited `app/src/worker/reducer.js` — `shelf: {}` slice added to `initialState`; `case EventKind.SHELF` whole-slice replace copying the `PREFERENCES` fold.
- Edited `app/src/worker/logic.js` — `surfaceHomeBookShelf()` helper reading `shelf.json`, projecting it, and posting the `SHELF` event; called in `handleOpen()` after `surfaceHomeBookPreferences()` and in the existing `SYNC_HOME` case after `surfaceHomeBookPreferences()`; `ensureDeviceId` now receives the session's `version` to avoid spurious schema upgrades.
- Edited `app/src/worker/home-book.js` — `ensureDeviceId`/`openMetaDb` accept a `version` parameter (defaults to production) so OPEN can pass the session's schema version; `deviceId` key stripped from the surfaced `meta` record.
- Edited `app/src/songs/SearchScreen.jsx` — `const shelf = useSlice(store, 'shelf')` added; `bookLabelFor(bookId)` returns `shelf?.books?.[bookId]?.label?.value` when truthy, else `bookId`; `scopeChipLabel` uses the same label; Decision-6 comments updated.
- Edited `app/src/worker/store.test.js` — subscriber-count updated 3→4 (SHELF is a new real OPEN move).
- Unit tests: `app/src/worker/shelf.test.js` (7 tests — two shared books, §7 local narrowing, absent register, tombstone kept, malformed leaf dropped, `{}` model).
- Behavior tests: `app/src/worker/shelf-surface.behavior.test.jsx` (3 tests — label surfaces on OPEN, re-surfaces after `SYNC_HOME` relabel, local narrowed to this device, empty shelf end-to-end); `app/src/songs/SearchScreen.behavior.test.jsx` (edited, 7 tests — shelf label names a book and scope chip, falls back to `bookId`, axe clean).
