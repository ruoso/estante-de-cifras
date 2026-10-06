# books.shelf — The book-management screen

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task shelf "The book-management
screen"` under `task books` (lines 9–14). Dependencies as declared:
`depends storage.home_book` (the task's own line), plus the parent `task books`
cascade `depends shell.layout, foundation.e2e_web`. The one-line note:

> "Title or label, where it lives, can save, sync state; new book; rename on my
> shelf. Workflow 7. Tests: behavior (title or label, where it lives, can save,
> sync state; new book; rename; axe); e2e-web (a new book made and renamed on
> the three viewports; axe)."

This is the **"screen of its own"** DIRECTION names beside search: "Books are a
scope on that search; **managing them is a screen of its own**" (DIRECTION §4
L434). It fills the `books` tab panel — the second destination (`DESTINATIONS =
['search', 'books', 'setlists']`, `app/src/shell/layout-mode.js:28`), today an
`<h1>`-only placeholder — with the shelf: every book the user holds, each shown
with its title, where it lives, whether they can save, and its sync state; the
way to make a **new book**; and the way to **rename** one on the shelf.

## Effort estimate

**2d** (as scoped in the `.tji`), allocated `team`. Roughly: ~1–1.25d for the
view (the shelf list, the *Add a book* sheet with **New book**, the rename
dialog — three viewports, React Aria, i18n, axe), ~0.75d for the Worker write
seam this task is the first to need (a `git.init` primitive, a local-book
creator, local-home-book provisioning so it works with no account, and the two
write commands), the rest for the e2e journey.

## Repository

**estante-de-cifras** only, `app/` and `e2e/`:

- `app/src/books/` (new area) — the shelf-screen view (`BooksScreen.jsx`) and
  its presentational children (a book row, the *Add a book* sheet, the rename
  dialog), a pure display helper (`book-display.js`), co-located styles
  (`books.css`) and tests.
- `app/src/shell/AppShell.jsx` — a one-line change: the `books` `<TabPanel>`
  body renders `<BooksScreen store={store} />` instead of the placeholder
  `<h1>`. The `store` is already threaded to `AppShell` (`songs.search`
  Decision 1), so no `App.jsx` change is needed.
- `app/src/worker/` — the write path this task is the first to exercise:
  a `init` primitive on the git layer (`git.js`), a small `books.js` module
  that creates a new local songbook repository, local-home-book provisioning
  so a write works before any account (`home-book.js`), and the
  `CREATE_BOOK` / `RENAME_BOOK` command handlers plus a `BOOK_CREATED` event in
  `protocol.js` / `logic.js`. It reuses the existing `shelf` slice and `SHELF`
  event (`storage.shelf_surface`) — it adds no new read slice.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — a new `books` copy section
  in all four catalogues (catalogue completeness is a hard build gate,
  `shell.i18n`).
- `e2e/web/tests/books.spec.js` — the Playwright journey.

**Not a `cifra.md:` task.** Nothing in the sibling `/home/ruoso/devel/cifra.md`
repo changes: a new book is a git repository on the device, not a format change,
and the app and the service share no code (DIRECTION §3.6 L288–291). Plain
JS/JSX; no TypeScript. Contracts are JSDoc `@typedef`s, as every sibling in
`app/src/worker/`. **No design delta** is authored: workflow 7 and the W07
board already decide the screen; `shelf.json`'s shape is already fixed by
`home-book-format.md` §4.2; and the protocol is open to new command/event kinds
(`protocol.js` builders; DIRECTION §3.7 L410–414).

## Inherited dependencies

- **`storage.home_book`** — *settled, Done 2026-10-05*
  ([`../storage/home_book.md`](../storage/home_book.md)). The module this task
  writes the shelf through, and the file it registers a new book in:
  - `createHomeBook({ fs, git, locks })` → `{ read, set, sync, ensureDeviceId }`
    (`app/src/worker/home-book.js:124`).
  - `set({ bookId, file, changes, author, now })` (`home-book.js:212–233`) —
    under one `withLock(bookId)`: read the settings file, set each change's
    register to `{ value, at: instant(now) }` at its key path (creating parent
    maps, `applyChange` `:158–168`), write back in canonical form, stage and
    commit that one file. **No push — offline-first.** This is exactly the call
    that writes a new book's `shelf.local` entry and a rename's label.
  - `SETTINGS_FILES` (`home-book.js:56–63`, `shelf.json` at `:58`), `HOME_BOOK_ID
    = 'home'` (`:86`), `ensureDeviceId({ idb, name, version })` (`:356`, the §7
    namespace key), `ensureScaffold(dir)` (`:176–195`, the §2.2 README +
    `.gitattributes` identity bytes this task reuses for a fresh **local** home
    book).
- **`storage.shelf_surface`** — *settled, Done 2026-10-06*
  ([`../storage/shelf_surface.md`](../storage/shelf_surface.md)). The read side
  this screen consumes and that both write commands re-emit:
  - `EventKind.SHELF` (`protocol.js:80–87`) → the `shelf` slice
    (`reducer.js:32–40`, fold `:308–316`), a whole-slice replace of
    `{ books, local }` nested maps of `{ value, at }` registers — `books.<id>.{
    label, link, position }` for shared books, `local.<id>.{ title, position }`
    for this device's local books (narrowed to the device, §7).
  - `surfaceShelf(model, deviceId)` (`app/src/worker/shelf.js`) and the
    `surfaceHomeBookShelf()` helper (`logic.js:439–446`) called on `OPEN` and in
    the `SYNC_HOME` case — the re-surface each write command calls after
    `home-book.set` so the slice reflects the new book / new label at once.
  - **This task is the write side `shelf_surface` explicitly deferred to it**
    (`shelf_surface.md:46`, `:139`: "the *write* side (relabelling, reordering,
    adding a book) is `books.shelf`'s (workflow 7)").
  - **Graph note for the closer (not a new task):** add `storage.shelf_surface`
    to `books.shelf`'s `depends` — the screen reads the `shelf` slice and both
    write commands call `surfaceHomeBookShelf`, so the `SHELF` event/surfacing
    this task needs is `shelf_surface`'s. Both are M2 leaves; nothing is
    blocked (the slice degrades to `{}` / `bookId` labels without it), so this
    is a graph edge to record, surfaced for the closer.
- **`shell.layout`** — *settled, Done*
  ([`../shell/layout.md`](../shell/layout.md)). One controlled React Aria
  `<Tabs>`; each destination is a `<TabPanel>` a screen task fills.
  `destinationPanels(store)` (`AppShell.jsx:122–132`) renders the `books` panel
  as an `<h1>`-only placeholder — **this is the seam `BooksScreen` replaces.**
  Two layout modes split at `(min-width: 600px)` (`layout-mode.js:22`): `narrow`
  (phone, `.screen`/`.scroll` + bottom `.tabbar`) and `wide` (tablet **and**
  computer, master-detail `.split` with a `.pane.side` rail + `.pane.main`
  `<main>`). **No router**; navigation and selection are ephemeral `useState`,
  not a store slice.
- **`foundation.e2e_web`** — *settled, Done*
  ([`../foundation/e2e_web.md`](../foundation/e2e_web.md)). The Playwright
  harness at `e2e/web/` (fixtures, `lib/`, phone/tablet/computer projects, the
  axe helper `e2e/web/lib/axe.js`, the offline helper `lib/offline.js`;
  siblings `navigation.spec.js`, `search.spec.js`). The shelf journey lands
  here.
- **`shell.i18n`** / **`shell.tokens`** — *settled, Done* (transitive). Copy
  goes through `t(key, params)` (`app/src/i18n/index.js:125–133`) with `{name}`
  interpolation and `Intl.PluralRules`; `shell.books` already reads "Books"
  (`en.js:22`), the `search.*` block (`en.js:28–47`) is the model for the new
  `books.*` block. The `.row`/`.list`/`.grow`/`.name`/`.meta`/`.badge`
  (`.unsaved`/`.conflict`/`.ok`/`.dot`)/`.chip`/`.card`/`.sheet`/`.dialog`/
  `.btn` (`.primary`/`.quiet`/`.danger`)/`.field`/`.input` classes the W07 board
  uses are all in `docs/mockups/theme.css`.

**No pending blocking dependencies.** The screen renders seams later tasks
fill — the reader/editor role, the live sync-state, the other three "ways in",
and the per-book detail actions — the way `songs.search` left `voicedFor` /
`conflict` / the explorer destination to their owners (Decisions 4–6 below;
each is an existing WBS leaf, no new task).

## What this task is

The book-management screen — the React view that fills the `books` tab panel —
and the first write path into the shelf:

1. **The shelf.** Every book the user holds, read from the `shelf` slice (the
   authoritative shelf membership: `books` + this device's `local`), ordered by
   each book's `position` register. Each book row shows its **title** (the
   shelf label/title the user gave it, else the book id), **where it lives**
   (*on this device* or *on Estante*), whether the user **can save** to it, and
   its **sync state** — shown only when a book is not in step with Estante
   (workflow 7 L14–21; W07 board).
2. **New book.** An *Add a book* affordance opens a sheet; its **New book**
   option takes a name and creates an **empty local repository — no account
   needed** (workflow 7 L25): a `git.init`, a scaffolded `README.md` (`# {name}`)
   and `.gitattributes` (the §2.1 cifra merge driver) with one commit, and a
   `shelf.local` entry (`title`, `position`) written through `home-book.set`,
   then the shelf re-surfaces and the new book appears. The other three ways in
   (By link, Mine on Estante, Upload) are their own tasks (Decision 6).
3. **Rename on my shelf.** A rename control writes the book's label (a shared
   book's `books.<id>.label`) or title (a local book's `local.<id>.title`)
   register through `home-book.set` — **a label kept in the home book that
   changes nothing in the repository** (workflow 7 L16–18); the README is
   untouched.

It is the shelf **list** plus **new** and **rename**. Putting a book online,
removing it, deleting it and downloading it are `books.online`'s; the other
"ways in" are `books.add_by_link` / `books.upload_ui`; the reader/editor role
and the live sync state are the sharing and sync tasks' (Decision 5, 6).

## Why it needs to be done

It is the home of the books that search scopes over: DIRECTION §4 L434 makes the
shelf "a screen of its own," and workflow 7 is its specification. It is a leaf
of milestone **M2 (`milestones.m2_local`)** — "a songbook on one device"
(`tasks/99-milestones.tji:23–25`), alongside `songs.search`, `songs.reading`,
`account.first_run` and the rest. Without it there is no way to **make** a book
(every other books task — `online`, `add_by_link`, `share`, `fork`,
`upload_ui` — `depends !shelf` or `!online`, so they extend this screen), and no
way to rename one. It is the first task to **write** the shelf, so it builds the
reusable local-book-creation seam that `account.first_run` ("the empty shelf …
My songs") also needs (graph note, Acceptance).

## Inputs / context

### Governing design

- **Workflow 7 — Add a book** (`docs/workflows/07-add-a-book.md`, Status:
  decided):
  - **The book-management screen** (L12–21): "It lists the books on the shelf,
    each with" its **title** — "the README's level-1 heading, or the repository
    name (DIRECTION §2.1), **unless the user has renamed it on their shelf — a
    label kept in the home book that changes nothing in the repository**"
    (L16–18); **where it lives** — "*on this device*, or *on Estante*" (L19);
    whether the user **can save** to it (L20); its **sync state** (workflow 8)
    (L21).
  - **Add a book** (L23–32): "*Add a book* offers four ways in" — **New book**:
    "a name, and an empty local repository. No account needed." (L25); **By
    link** (L26–27, workflow 1); **Mine on Estante** (L28–29, once signed in);
    **Upload** (L30). "Cloning shows its progress and can be cancelled." (L32).
  - **Removing a book, and deleting one** (L128–137) and **Putting a book
    online** (L46–52) and **Downloading** (L55–63) — *`books.online`'s, not
    this task's.*
- **DIRECTION §4 — The interface** (`docs/DIRECTION.md` L428–439): "Books are a
  scope on that search; **managing them is a screen of its own**" (L434);
  "Search never shows or changes a file name" (L437) — a book's title is a label
  and a README heading, never a filename.
- **DIRECTION §2.1 — Songs are found by name** (L57–75): a songbook holds
  `*.cifra.md`, `*.setlist.md`, a `README.md` and a `.gitattributes`, "and
  nothing else" (L63–66); "A book's title is the level-1 heading of its README,
  or the repository name." (L74). A **new book** is scaffolded to this shape.
- **DIRECTION §3.2 — Personal state** (L136–151): a user's labels and shelf
  order "live in a **home book** … committed automatically" (L141–144); its
  files "are JSON that merge key by key, the later change winning" (L146–147).
  A rename and a new-book entry are such automatic commits.
- **DIRECTION §3.7 — The app** (L394–427): "One owner for the data: a Web
  Worker … The main thread never touches IndexedDB" (L407–409); "A store on the
  main thread is fed by the Worker's messages, and components read the slices
  they need through `useSyncExternalStore` … only what shows it moves"
  (L410–414); React + React Aria Components (L396).
- **DIRECTION §3.3** (L164–182): **no book without an account** and `noindex`
  (L175–182) — bears on the online/shared tasks, not the local shelf here; but
  a device's pre-sign-in commits "carry a local id" (L164–170) — the author a
  new-book / rename commit uses before sign-in.

### The format

- **`docs/home-book-format.md` §4.2 `shelf.json`**: two maps — `books` (shared,
  keyed by book id; each a map of `label`, `link`, `position` registers; "Only
  the link and the label are written") and `local` (local-only, namespaced by
  device id then local-book id; each a map of `title`, `position` registers).
  This fixes where a new book and a rename write, and carries **no status
  field** (so where-it-lives / can-save / sync-state are composed by this screen,
  not read from the file — `shelf_surface.md` Decision 3).
- **§3 the register envelope** (`{ value, at }`), **§5.3 tombstones**
  (`{ value: null, at }` is a well-formed register — a cleared label the screen
  reads as "no label", falling back to the id), **§7 per-device state** (a device
  reads/writes only its own `local` namespace).

### The mockup (what the drawings decide)

- **`docs/mockups/W07-add-a-book.dc.html`** — the shelf board (the "Books" tab).
  Real anatomy and copy:
  - **A book row** — `.row` with `.grow > .name` (the title) + `.meta` =
    `{where} · {role}`, an optional sync-state `.badge` in `.badges`, and a
    trailing `▸`. `where` ∈ {"On Estante", "On this device"}; `role` ∈ {"can
    save", "reader"}. **"A sync state shows only when a book is not in step with
    Estante."** (W07 L47). On the desktop master-detail the open book carries
    `.row.sel`.
  - **Add a book** — a header `.btn.primary` ("+") opens a bottom `.sheet`
    (role="dialog") titled "Add a book" listing four `.row`s: **New book** —
    "A name, and an empty book. No account needed."; **By link** — "Paste a link
    to a book on Estante."; **Mine on Estante** — "Your books that are not on
    this shelf yet. Sign in to see them."; **Upload** — "A zip of a book, with
    or without its history." A "Sync now" button sits below.
  - **No rename control is drawn** — the renamed label simply overrides the
    displayed title (workflow 7 L16–18). This task introduces the rename
    affordance (Decision 3).
  - **No empty-shelf drawing** — the always-available *Add a book* / **New book**
    is the escape hatch (Decision 7); the `search.empty` `role="status"` line is
    the copy pattern to mirror.
- **`docs/mockups/W08-sync.dc.html`** — the sync-state words the badge carries
  when a book is not in step: "syncing" (no badge class), "2 saves waiting to go
  up" (`.badge.unsaved`), "needs you" (`.badge.conflict.dot`). *Seeds the
  render-when-present sync-state slot (Decision 5); no live source in M2.*
- **`docs/mockups/README.md` L26** — "**Every status badge carries a word, never
  colour alone.**" Binds the sync-state badge and the where/can-save text.

### The code seams this extends

- **Shell mount:** `app/src/shell/AppShell.jsx:122–132` (`destinationPanels`, the
  `books` `<TabPanel>` body — the placeholder `<h1>` this replaces); `store` is
  already a prop (`songs.search` Decision 1). `DESTINATIONS[1] === 'books'`
  (`layout-mode.js:28`).
- **Sibling screen pattern:** `app/src/songs/SearchScreen.jsx` — a default-export
  `({ store, … })` reading slices via `useSlice(store, name)` (`:252–257`,
  incl. `const shelf = useSlice(store, 'shelf')`), the book-label selector
  `shelf?.books?.[bookId]?.label?.value || bookId` (`:335`), commands via
  `store.send(command(Kind, payload))` (`:274–292`), React Aria Components
  (`SearchField`, `Button`, `Disclosure`, `Dialog`…), copy via `t()`, co-located
  `search.css`, badges that carry a word (`Badges` `:124–149`), the `.row`
  (`.grow`/`.name`/`.meta`) row shape (`SongRow` `:156–177`).
- **Store API (prop-threaded, no context):** `createStore(endpoint)` →
  `store.send`, `store.slice(name)`, `store.open()` (`app/src/worker/store.js`);
  `getAppStore()` the lazy singleton; `useSlice(store, name)` over
  `useSyncExternalStore` (`app/src/worker/useStore.js:14–20`); `command` /
  `CommandKind` / `event` / `EventKind` (`app/src/worker/protocol.js`).
- **The shelf slice + surface:** `reducer.js:32–40` (slice), `:308–316` (fold);
  `app/src/worker/shelf.js` (`surfaceShelf`); `logic.js:439–446`
  (`surfaceHomeBookShelf`), the `OPEN` and `SYNC_HOME` call sites.
- **The home book:** `home-book.js` — `createHomeBook` (`:124`), `set`
  (`:212–233`), `ensureScaffold` (`:176–195`), `ensureDeviceId` (`:356`),
  `SETTINGS_FILES` (`:56–63`), `HOME_BOOK_ID` (`:86`); `authorFrom`
  (`app/src/worker/author.js`) for the commit identity.
- **The git layer:** `createGitLayer({ fs, http })` → `{ clone, fetch, push,
  bookDir }` (`app/src/worker/git.js:44–92`), `bookDir(id)` → `/books/<id>`
  (`:63`). **There is no `init`** — this task adds it (Decision 2). The §2.1
  identity bytes to scaffold: `app/example-book/.gitattributes`
  (`*.cifra.md merge=cifra` / `*.setlist.md merge=cifra`), README `# {title}`.
- **Accessibility helper:** `checkWcag21aa(container)` (`app/src/a11y/axe.js`) —
  WCAG 2.1 AA tags; contrast/layout rules do not run under jsdom, so contrast is
  pinned at e2e-web.
- **Test support:** `createLoopbackEndpoint` (`app/src/test/loopback.js`),
  `installWebLocks` (`app/src/test/web-locks.js`), `fake-indexeddb`,
  `createFileSystem` (`app/src/worker/fs.js`), `createStore`
  (`app/src/worker/store.js`) — the in-process Worker behavior rig, as
  `shelf-surface.behavior.test.jsx` and `home-book.behavior.test.js` use it. A
  **local** home book needs no remote; the git CLI asserts committed state
  against `/books/<id>`.

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data.** `BooksScreen`
  reads the `shelf` slice through `useSlice` and sends `CREATE_BOOK` /
  `RENAME_BOOK` through `store.send`; it never touches IndexedDB, never runs
  git, never reads the home book directly (DIRECTION §3.7 L407–414). The git
  `init`, the scaffold, the shelf write and local-home-book provisioning are
  framework-free Worker code. *Central.*
- **Offline first; no account needed.** Making a new book and renaming one are
  local writes (`home-book.set` commits locally, never pushes — offline-first);
  **New book works with no account** (workflow 7 L25), so the write path must
  provision a **local** home book (no remote) when none exists (Decision 2).
  *Central — pinned by the Worker behavior test and the e2e.*
- **Canonical form over preserving content.** `shelf.json` is written in
  canonical form by `home-book.set` (already); a new book's `README.md` /
  `.gitattributes` are scaffolded to the §2.1 bytes. This task writes no song
  text. *Applies.*
- **Accessibility (every UI task).** Every interactive part is a React Aria
  Component — the *Add a book* trigger and sheet (a `Dialog`), the New-book name
  field and submit, the rename trigger and dialog, each book row and its
  selection — with full keyboard paths and axe at WCAG 2.1 AA on every state
  (list, sheet, rename dialog, empty). **Where-it-lives, can-save and the
  sync-state badge are carried by a word**, never colour alone (mockups README
  L26). Focus moves to the new book after creation (the `BOOK_CREATED` event,
  Decision 2). *Central.*
- **No song text / no labels or links in logs.** The Worker logs nothing — a
  label and a book name are a user's words; `home-book.set`'s commit message is
  content-free ("Update shelf.json"). Fixtures are purpose-written. *Applies.*
- **No book without an account** — bears on the **online/shared** books
  (`books.online`, `books.share`): *not applicable to a local book*, which lives
  only on the device and reaches no one. The whole app carries `noindex`.
  *Applies trivially.*
- **One lock per logical operation** (locks.md Decision 1). `home-book.set`
  takes one `withLock(HOME_BOOK_ID, …)`; the new-book repo init/scaffold/commit
  takes one `withLock(newBookId, …)`; two different repositories, no nesting
  (Web Locks are non-reentrant). *Applies.*
- **Component boundaries (DIRECTION §3.6).** No code shared with the service; a
  local book is created entirely on the device — the service is untouched (the
  service only ever sees a book when it is *put online*, `books.online`).
  *Applies.*

## Acceptance criteria

### Behavior delivered

1. **Mounts as the book-management screen.** The `books` `<TabPanel>` body
   renders `<BooksScreen store={store} />` instead of the placeholder `<h1>`,
   inside `<main>` on wide and the `.scroll` region on narrow (workflow 7 L12;
   DIRECTION §4 L434).
2. **The shelf lists every book, ordered by position.** `BooksScreen` reads the
   `shelf` slice (`books` + `local`) and renders one row per book, ascending by
   each book's `position` register (ties broken stably by id), with the title,
   where it lives, can-save and the sync-state slot (below). The `shelf` slice
   is the authoritative membership (Decision 1).
3. **Title or label.** A row's title is the book's label (a shared book's
   `books.<id>.label.value`) or title (a local book's `local.<id>.title.value`)
   when present and non-tombstone, else the book id — the same fallback
   `SearchScreen` uses (`:335`), extended to local titles (Decision 3). A
   README-heading fallback for a label-less **shared** book is deferred to when
   shared books/clones exist (Decision 4); in M2 a local book always has a
   `title` register.
4. **Where it lives, and can save.** Derived from which shelf map a book is in:
   a `local` book reads *on this device* and *can save*; a `books` (shared) book
   reads *on Estante* and its role (the reader/editor distinction) from the
   membership seam when present (Decision 5). Each is a **word** in the `.meta`
   line (`{where} · {role}`), never colour (workflow 7 L19–20; mockups README
   L26).
5. **Sync state — shown only when not in step.** A book row renders a labelled
   sync-state badge (`"syncing"` / `"N saves waiting to go up"` / `"needs you"`,
   the W08 words, each a word + the `.badge` class) **when the slice carries a
   sync-state for it**, and nothing when in step (workflow 7 L21, L47). The
   live source is `sync.states` / `books.online`; the slot renders when present
   and is seeded in the behavior test (Decision 5).
6. **New book — an empty local repository, no account.** The *Add a book*
   trigger opens a React Aria sheet (`Dialog`) whose **New book** option takes a
   name and sends `CREATE_BOOK { title, author }`; the Worker mints a path-safe
   local book id, `git.init`s `/books/<id>`, scaffolds `README.md` (`# {title}`)
   and `.gitattributes` (the §2.1 bytes) with one commit, writes
   `local.<deviceId>.<id>.{ title, position }` (position = max + 1) to the local
   home book through `home-book.set`, re-surfaces `SHELF`, and emits
   `BOOK_CREATED { bookId }`; the new book appears on the shelf and focus moves
   to it. **It works with no account** — the local home book is provisioned
   (init + scaffold, no remote) if absent (workflow 7 L25; Decision 2).
7. **Rename on my shelf.** A rename control (per-row / in the detail on wide)
   opens a React Aria dialog with the current name and sends `RENAME_BOOK {
   bookId, name, author }`; the Worker writes the `label` register (shared) or
   `title` register (local) through `home-book.set` and re-surfaces `SHELF`; the
   row re-labels. **The book's repository is unchanged** — no README edit, no
   file rename (workflow 7 L16–18; Decision 3).
8. **The other ways in, and the detail actions, are seams.** The *Add a book*
   sheet is introduced here with **New book** functional; By link / Mine on
   Estante / Upload are added by `books.add_by_link` / `books.upload_ui`; the
   per-book detail actions (put online, remove, delete, download) are
   `books.online`'s. This task renders the shelf and wires new + rename only
   (Decision 6).
9. **Empty shelf.** With an empty `shelf` slice the screen shows a
   `role="status"` empty line and the *Add a book* affordance, never a blank
   pane (Decision 7).

Wiring: a new `app/src/books/` area — `BooksScreen.jsx` and presentational
children (`BookRow`, `AddBookSheet`, `RenameDialog`), a pure `book-display.js`
(the title/where/can-save derivation and position ordering), `books.css`; a
`books` section in all four i18n catalogues; the `books` `<TabPanel>` body in
`AppShell.jsx`; `git.init` in `app/src/worker/git.js`; a new
`app/src/worker/books.js` (`createBooks({ fs, git, locks })` →
`createLocal({ title, author, now })`); `ensureLocal()` on the home book
(`home-book.js`, init + scaffold a local repo if absent, idempotent);
`CommandKind.CREATE_BOOK`/`RENAME_BOOK`, `EventKind.BOOK_CREATED` in
`protocol.js`; the two handlers + position computation + `surfaceHomeBookShelf`
re-emit in `logic.js`. **The `shelf` slice and `SHELF` fold are reused
unchanged.**

### Tests the task lands with, by level

Per the `.tji` note: **behavior** and **e2e-web**; a **unit** level is added for
the pure display/ordering helper and is justified below (a genuine pure module;
the testing policy permits adding a level a task needs). Fixtures are
purpose-written books, never anyone's copyrighted words.

- **unit — `app/src/books/book-display.test.js`** (added level):
  - *Title or label* — `titleFor(book, bookId)` returns the `label`/`title`
    register value when present and non-tombstone, the `bookId` for an absent or
    tombstoned register. *Pins workflow 7 L16–18; home-book-format §5.3.*
  - *Where it lives / can save* — `whereFor` / `canSaveFor` map a `local` book to
    *on this device* / *can save* and a shared (`books`) book to *on Estante* /
    the role seam. *Pins workflow 7 L19–20.*
  - *Order* — `orderedBooks(shelf)` returns books ascending by `position`, ties
    stable by id, a book with no `position` last. *Pins the shelf order
    (home-book-format §4.2 `position`).*
- **behavior — `app/src/books/BooksScreen.behavior.test.jsx`** (real RAC and
  i18n; a loopback-backed store seeded with a `shelf` slice; axe over
  `container`):
  - *The shelf* — a seeded `shelf` (a `local` book and a shared `books` book)
    renders both rows with title, where-it-lives and can-save; order by
    position. *Pins workflow 7 L14–21.*
  - *Title or label* — a book with a `label`/`title` register shows it; a
    tombstoned/absent register falls back to the id. *Pins workflow 7 L16–18.*
  - *Sync state* — a book seeded with a sync-state shows the labelled badge
    (word + class); a book in step shows none. *Pins workflow 7 L21, L47;
    mockups README L26.*
  - *New book* — the *Add a book* sheet opens (keyboard + pointer), New book
    submits a name, `CREATE_BOOK { title }` is sent, and — over the loopback
    store — the book appears on the shelf via the `SHELF` re-surface and focus
    moves to it. *Pins workflow 7 L25.*
  - *Rename* — the rename dialog opens with the current name, submits,
    `RENAME_BOOK { bookId, name }` is sent and the row re-labels. *Pins workflow
    7 L16–18.*
  - *Empty shelf* — an empty slice shows the `role="status"` empty line and the
    *Add a book* affordance.
  - axe clean on the list, the open sheet, the rename dialog and the empty state.
- **behavior — `app/src/worker/books.behavior.test.js`** (the Worker rig —
  `fake-indexeddb`, `installWebLocks()`, a `createFileSystem`; **no remote**, a
  local home book):
  - *New book is an empty local repository* — `CREATE_BOOK { title: "Quarta à
    noite" }` with no home book yet: a local home book is provisioned (init +
    §2.2 scaffold), `/books/<id>` is a git repo whose one commit holds
    `README.md` = `# Quarta à noite` and `.gitattributes` = the §2.1 bytes (and
    nothing else, §2.1), and `shelf.json` holds `local.<deviceId>.<id>.{ title,
    position: 0 }`; `SHELF` is re-surfaced with the book. Asserted against the
    repos via the git CLI / isomorphic-git `log`. *Pins workflow 7 L25; §2.1.*
  - *Position increments* — a second `CREATE_BOOK` gets `position: 1`. *Pins the
    order.*
  - *Rename changes nothing in the repository* — `RENAME_BOOK { bookId, name:
    "Quinta" }` for that local book rewrites `local.<deviceId>.<id>.title` and
    re-surfaces `SHELF`, while the book's `README.md` blob and tree are
    **unchanged** (asserted by oid). A shared book id (seeded in `shelf.json`'s
    `books`) renames via the `label` register. *Pins workflow 7 L16–18.*
  - *No account needed / offline* — the whole sequence makes **no network call
    and no push** (the local home book has no remote); the commits stay local.
    *Pins offline-first; workflow 7 L25.*
- **e2e-web — `e2e/web/tests/books.spec.js`** (compose stack, phone/tablet/
  computer projects, axe WCAG 2.1 AA on the screen):
  - *A new book made and renamed on the three viewports* — open the Books tab,
    *Add a book* → New book, type a name, see it on the shelf; rename it, see the
    new name — on each viewport. Entirely in-app (no song-seeding seam needed,
    unlike `songs.search`'s blocked cases), so fully implementable now. *Pins
    workflow 7 L14–25; DIRECTION §4 L434.*
  - axe at WCAG 2.1 AA on the shelf, the open *Add a book* sheet and the rename
    dialog, on every viewport.

No test level named in the `.tji` is dropped.

### Deferred work and graph notes (closer registers / wires)

- **No new WBS leaves.** Everything this screen leaves open is an **existing**
  leaf that extends it; this task exposes the seam:
  - **By link + Mine on Estante** → `books.add_by_link` (`65-books.tji`, `depends
    !online`): adds those two *Add a book* entries and their clone/sign-in flow.
  - **Upload** → `books.upload_ui` (`depends sync.upload, !shelf`): adds the
    Upload entry and the preview.
  - **Put online, remove, delete, download** → `books.online` (`depends !shelf,
    service.books, sync.engine`): the per-book detail actions.
  - **Reader/editor role + can-save for shared books** → `books.share` /
    membership: fills the role word this screen renders.
  - **Live sync state** → `sync.states` / `books.online`: fills the sync-state
    badge slot this screen renders.
  - **README-heading title fallback for a label-less shared book** → lands with
    shared books/clones (`books.add_by_link` era), when a README title is
    surfaced; in M2 local books always carry a `title` register. (Mirrors
    `songs.search` Decision 6's `bookId` fallback — a seam, not a new task.)
- **Graph note for the closer (not a new task): `account.first_run` should
  `depend` on `books.shelf`.** `first_run` ("the empty shelf and its four ways
  in … My songs", `70-account.tji:9–12`) needs exactly the local-book-creation
  and local-home-book-provisioning seam this task builds (`git.init`,
  `books.createLocal`, `home-book.ensureLocal`). Today `first_run depends
  songs.search, design.example_book` only; adding `books.shelf` lets it reuse the
  seam instead of rebuilding it. Both are M2 leaves; surfaced for the closer to
  wire.
- **Graph note (restated): add `storage.shelf_surface` to `books.shelf`'s
  `depends`** (Inherited dependencies) — the `SHELF` event/slice/surfacing this
  task reads and re-emits is `shelf_surface`'s.

## Decisions

1. **The shelf list is the `shelf` slice, not the `browse` slice; order by
   `position`.** The `shelf` slice is the authoritative shelf *membership* — a
   freshly made, empty book has no songs and so is absent from `browse`/the
   index, but it *is* on the shelf the moment its `shelf.json` entry is written.
   So `BooksScreen` lists `{ ...shelf.books, ...shelf.local }` ordered by each
   book's `position` register. *Rejected: listing from `browse` — it would hide
   an empty new book, exactly the book this screen just made. Rejected: a new
   "books" read slice — `shelf_surface` already surfaces the shelf; a second
   slice would duplicate it and break the "only what shows it moves" contract.*
2. **New book adds the missing `git.init` primitive, a `books.js` creator, and
   local-home-book provisioning — all delivered here because this is the first
   task to write a book with no account.** The git layer has `clone/fetch/push`
   but no `init` (`git.js:92`); a local book is `git.init`'d on the device and
   scaffolded to the §2.1 shape (`README.md` = `# {title}`, `.gitattributes` =
   the cifra merge driver) with one commit. Because workflow 7 L25 requires New
   book "No account needed," the home book that holds `shelf.json` may not exist
   yet — so `home-book.ensureLocal()` `git.init`s and scaffolds a **local** home
   book (no remote) when absent, idempotently, reusing the existing
   `ensureScaffold` bytes. *Rejected: deferring local-home-book provisioning to
   `account.first_run` — `books.shelf`'s own e2e (a new book with no account)
   must pass in the gate whether or not `first_run` has landed; the seam must be
   self-sufficient here (and `first_run` then reuses it — graph note). Rejected:
   requiring a signed-in account to make a book — it contradicts workflow 7 L25.*
3. **Rename writes the shelf label/title register only; the repository is
   untouched. A local book renames its `local.<id>.title`, a shared book its
   `books.<id>.label`.** Workflow 7 L16–18 is explicit: the shelf name is "a
   label kept in the home book that changes nothing in the repository." A shared
   book keeps its repository title (README H1) and gains a shelf *label*; a
   local book's name simply *is* its `local` `title` register (home-book-format
   §4.2 gives local books `title`, not `label`), so renaming rewrites that
   register. Both go through `home-book.set`, auto-committed, offline-first.
   *Rejected: editing the README H1 on rename — it would change the repository,
   which the workflow forbids, and would push on a shared book.*
4. **Title fallback: shelf label/title → book id, as `SearchScreen` does; the
   README-heading fallback is deferred.** The `shelf` slice carries the label,
   not the README; surfacing a shared book's README heading needs a reader that
   does not exist and lands with shared books/clones. In M2 a local book always
   has a `title` register (written on create), so the id fallback is only ever
   seen for a label-less shared book, of which there are none in M2. This keeps
   the screen consistent with the shipped `SearchScreen` selector (`:335`).
   *Rejected: surfacing the README heading now — no shared books exist to need
   it in M2, and the reader belongs with the clone path.*
5. **Where-it-lives and can-save are derived from the shelf slice; the
   reader/editor role and the live sync state are render-when-present seams.** A
   book in `local` is *on this device* and savable; a book in `books` is *on
   Estante*. The reader/editor distinction and the sync-state words come from
   membership (`books.share`) and sync (`sync.states` / `books.online`) — owned
   by later tasks. `BooksScreen` renders the role and the sync-state badge **when
   the slice carries them** and nothing otherwise, exactly as `songs.search`
   renders `voicedFor` / `conflict` when present (search Decision 7). The W07
   rule "a sync state shows only when a book is not in step" is naturally the
   absence of the slot. *Rejected: computing the role / sync state here — it
   would pull membership and merge state into the shelf screen, crossing the
   component boundary; the seam lets the owners fill it.*
6. **The *Add a book* sheet is introduced here with New book only; the other
   three ways in, and the per-book detail actions, are their own tasks.** The W07
   board draws the full end-state (four ways in, a detail pane with put online /
   remove / delete / download); the WBS builds toward it — `books.add_by_link`,
   `books.upload_ui` and `books.online` each `depends !shelf` / `!online` and
   add their part. `books.shelf` lands the sheet scaffold and the New book flow;
   the other entries and the detail actions are added by those tasks. *Rejected:
   stubbing all four ways and the detail actions here — it would draw dead
   affordances and pull sign-in, cloning, upload and the service into a
   local-only M2 screen; each belongs to the task that owns its flow and its
   dependency on the service.*
7. **Selection is ephemeral view state; the empty shelf has its own state.**
   Like the shell's destination selection (layout.md), the selected book (wide
   master-detail) and the open sheet/dialog are `useState`, not a store slice —
   there is no router and nothing to persist. The empty shelf (no drawing
   exists) renders a `role="status"` line plus the always-available *Add a book*
   affordance, mirroring `search.empty`. *Rejected: a store slice for selection —
   the shell set the precedent that navigation is ephemeral.*

## Open questions

(none — all decided.) Two graph edges are surfaced for the closer rather than
left open: `account.first_run` should depend on `books.shelf` (to reuse the
local-book-creation seam), and `books.shelf` should depend on
`storage.shelf_surface` (whose `SHELF` event it reads and re-emits).

## Status

**Done** — 2026-10-06.

- `app/src/books/BooksScreen.jsx`, `app/src/books/book-display.js`, `app/src/books/books.css` — new `books/` area: shelf list, Add-a-book sheet, rename dialog, pure display helper, co-located styles.
- `app/src/shell/AppShell.jsx` — one-line change: `books` `<TabPanel>` body renders `<BooksScreen store={store} />`.
- `app/src/worker/git.js` — `git.init` primitive added.
- `app/src/worker/books.js` (new) — `createBooks({ fs, git, locks }) → createLocal({ title, author, now })`.
- `app/src/worker/home-book.js` — `ensureLocal()`: provision a local home book (init + §2.2 scaffold, no remote), idempotent.
- `app/src/worker/protocol.js` — `CommandKind.CREATE_BOOK` / `RENAME_BOOK`, `EventKind.BOOK_CREATED`.
- `app/src/worker/logic.js` — `CREATE_BOOK` and `RENAME_BOOK` handlers, `nextShelfPosition`, `ensureBooks`, `surfaceHomeBookShelf` re-emit.
- `app/src/worker/worker-env.js` (new) — Browser Worker shim: sets `globalThis.Buffer` and `globalThis.global` before lightning-fs/isomorphic-git load; `app/src/worker/index.js` imports it first.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — new `books` copy section in all four catalogues.
- Tests: `app/src/books/book-display.test.js` (unit, 13 tests); `app/src/books/BooksScreen.behavior.test.jsx` (behavior, 7 tests); `app/src/worker/books.behavior.test.js` (behavior, 3 tests); `e2e/web/tests/books.spec.js` (e2e-web, all three viewports + axe).
- Portal-scope fix (`app/src/books/BooksScreen.jsx`, `app/src/books/books.css`): RAC overlays portal into the `.est` ancestor via `UNSTABLE_portalContainer`; max-width cap added to `.dialog`. App-wide tech debt registered as `shell.portal_provider`.
