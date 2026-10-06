# account.first_run — First run

## TaskJuggler entry

[`tasks/70-account.tji`](../../70-account.tji), `task account.first_run`
("First run"). `depends songs.search, design.example_book, books.shelf`.

## Effort estimate

2d (`allocate team`), as the `.tji` fixes it. The view work is a single
empty-state branch on a screen that already exists; the weight is the Worker's
new seeding path for the bundled example book and its tests.

## Repository

**estante-de-cifras** only. This is app work (the note does not start with
`cifra.md:`). Directories touched:

- `app/src/songs/` — the search front door gains its first-run empty-shelf
  state (a presentational child + the branch that mounts it).
- `app/src/worker/` — a new module that seeds the bundled example book as a
  local git repository, a command/event pair for it in `protocol.js`, its
  dispatch in `logic.js`, and a one-line widening of the shelf label resolver
  so a local book shows its title.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the first-run copy and the
  example book's shelf label, in all four locales.
- `app/example-book/` — **consumed, not modified**: its files are imported into
  the Worker bundle and written into the seeded repository. (`design.example_book`
  authored them; `scripts/check-example-book` keeps them canonical in the gate.)
- `e2e/web/tests/` — the first-visit journey.

The `cifra-md` library for JavaScript (`app/package.json` line 19:
`"cifra-md": "file:../../cifra.md/js"`) is used by the unit test to confirm the
shipped example book reads clean and canonical. No work lands in the cifra.md
repository.

## Inherited dependencies

All three settled:

- **`songs.search`** — Done 2026-10-05
  ([`tasks/refinements/songs/search.md`](../songs/search.md)). Shipped
  `SearchScreen` filling the `search` `<TabPanel>` (the front door,
  `DESTINATIONS[0]`), reading the `search`/`index`/`browse`/`recents`/
  `preferences`/`shelf` slices via `useSlice`, with a pre-typing branch whose
  two sections (recents, books-as-sections) each render only when non-empty —
  so a cold device today shows nothing but the heading and the search box. This
  task fills that gap.
- **`design.example_book`** — Done 2026-10-05
  ([`tasks/refinements/design/example_book.md`](../design/example_book.md)).
  Authored the bundled book at `app/example-book/` (three purpose-written songs,
  one setlist, `README.md` titled `# Example Book`, `.gitattributes`), each file
  canonical under cifra.md and free of reader diagnostics, with
  `scripts/check-example-book` wired into `scripts/gate`. Its refinement hands
  this task the two named tests (the unit canonical-read check and the e2e-web
  open-offline journey) and leaves the book's **on-shelf label and its
  localisation** explicitly to this task.
- **`books.shelf`** — Done 2026-10-06
  ([`tasks/refinements/books/shelf.md`](../books/shelf.md)). Built the local-book
  and local-home-book provisioning seam this task reuses verbatim:
  `git.init` in `git.js`, `createLocal` in `books.js`, `home-book.ensureLocal()`,
  the `CREATE_BOOK`→`home.set(shelf.local…)`→re-surface-`SHELF`→`BOOK_CREATED`
  dispatch, and `nextShelfPosition`. It also settled that the shelf's membership
  is the `shelf` slice (`{...books, ...local}`), not the index.

Settled context relied on but not a direct predecessor: `shell.layout` (the
responsive navigation shell and the `search` panel), `storage.home_book` (the
home-book writer/merger and canonical serializer, in the Worker since commit
`1991708`), `storage.shelf_surface` (`surfaceShelf`, commit `ae28ab3`), and the
`foundation.e2e_web` harness (`e2e/web/`).

## What this task is

The cold door of workflow 1. A new user who opens the app with an empty shelf
lands on search and sees, instead of a blank screen: **what a book is**, the
**four ways to fill the shelf**, and **My songs** listed from the start. Of the
four ways, this task fully delivers one — **open the example book** — which puts
the bundled book on the shelf as a local book, no account and no network, and
makes its songs searchable; the other three are rows that route to the doors
owned by their own tasks. "My songs" is shown as a listed-from-the-start entry
so *write a song* never has to ask where a song goes.

The task does **not** cover the invited door (an invitation landing, the
account-first prompt, a dead or full link), which workflow 1 draws beside the
cold one but which belongs to `books.add_by_link` (`.tji` note: "Workflows 1, 7
… a dead or full link telling nothing about whose book"); nor the one-time
"Playing on guitar — change?" prompt, which is `songs.first_song` (workflow 1,
drawn on W01's tablet); nor the first-write creation of the My-songs repository,
which is `songs.new_song` ("My songs created when first written to"). The theme
is already automatic (light→Estante, dark→Palco, commit `0f2016a`) and the
language already follows the browser (commit `cc08222`); workflow 1's theme and
language paragraphs need nothing here.

## Why it needs to be done

It is the app's first screen for the common case — someone who found the app and
has nothing yet. Workflow 1 opens the whole product; until this lands, a cold
start is a dead end (a search box over no books). It is the first screen every
e2e-web journey and every later workflow implicitly starts from, and it is the
only place the shipped example book — the proof that the app does anything at
all before a user adds music — becomes reachable. It is a dependency of
`account.new_device`, which reconciles what the shelf and home book hold when an
account arrives from another device.

## Inputs / context

Governing design (normative — this refinement turns these into a work order, it
does not redesign them):

- **Workflow 1**, [`docs/workflows/01-first-run.md`](../../docs/workflows/01-first-run.md):
  - §Cold, lines 18–33 — the first screen is search with an empty shelf; the
    empty state "says what a book is, and offers the ways to fill the shelf":
    write a song (into My songs), add a book by its link (workflow 7), sign in
    (workflow 13), open the example book. The example book "comes with the app …
    puts it on the shelf as a local book, and it is removed like any other.
    Nothing of it is on the shelf until asked for."
  - §*My songs*, lines 35–41 — "Every shelf has a local book called *My songs* …
    listed from the start and created — an empty repository, no remote — when the
    first song is written into it. Until then there is nothing to store."
  - §The home book, lines 73–78 — "starts local, with no remote, and gains one
    when the user signs in."
- **DIRECTION** [`docs/DIRECTION.md`](../../docs/DIRECTION.md): §3.7 lines
  394–426 (React + React Aria; the Worker is the one data owner, the main thread
  never touches IndexedDB; the store mirrors the Worker over
  `useSyncExternalStore`; the view is the only layer that knows React); §3.2
  lines 136–151 (the home book, personal state, committed automatically); §4
  lines 428–439 (song search is the primary interface, a screen for managing
  books is its own); §2.1 (a book is a well-formed songbook and nothing else);
  §3.3 lines 175–182 (no book without an account — which is *why* the example
  book ships with the app rather than being hosted).
- **The home-book format**,
  [`docs/home-book-format.md`](../../docs/home-book-format.md): §4.2 (`shelf.json`
  — shared `books` and device-namespaced `local`, each entry a map of `{value,
  at}` registers; a local book has `title` and `position`); §2.3 (local book id;
  device id as a namespace key); §6 (canonical form — written by `home-book.set`).
- **The mockup**, [`docs/mockups/W01-first-run.dc.html`](../../docs/mockups/W01-first-run.dc.html),
  and the visual language ([`docs/mockups/theme.css`](../../docs/mockups/theme.css),
  [`docs/mockups/README.md`](../../docs/mockups/README.md) "Decisions the drawings
  carry" line 26 — "every status badge carries a word, never colour alone"). The
  board draws the empty shelf on the phone (search header, the four ways-in as a
  `.list` of `.row` links, a "Books" section with the My songs row, the
  Search·Books·Setlists tab bar) and on the computer (the ways-in as a 2-column
  `.card` grid in the main pane, My songs in the side pane). Verbatim copy is
  captured under Decisions.

Code seams (all cited file:line):

- `app/src/songs/SearchScreen.jsx` — pre-typing branch lines 414–460; the two
  guarded sections at 416 (`recentItems.length > 0`) and 436 (`bookIds.length >
  0`); `bookIds` derived 319–323; the first-run block plugs in as a sibling when
  `bookIds.length === 0 && recentItems.length === 0`. Label resolver
  `bookLabelFor` at 335 reads only `shelf.books[id].label.value`, falling back to
  the raw id — it must also read `shelf.local[id].title.value` (the `local` map
  is already narrowed to this device by `surfaceShelf`).
- `app/src/worker/protocol.js` — `CommandKind` 28–73, `EventKind` 83–132,
  `command()`/`event()` 137–144. A new `OPEN_EXAMPLE_BOOK` command and the reuse
  of `SHELF`/`BOOK_CREATED` events land here.
- `app/src/worker/logic.js` — `handle` switch 529–787; the `CREATE_BOOK` handler
  726–753 is the template (ensureLocal → createLocal → deviceId →
  `nextShelfPosition` → `home.set` two registers → `surfaceHomeBookShelf` →
  `BOOK_CREATED`); `handleOpen` 494–526 (empty home book → `SHELF {books:{},
  local:{}}`, never an error); `buildIndexes` on bring-up (516).
- `app/src/worker/books.js` — `createBooks().createLocal` 70–93; the
  `GITATTRIBUTES_BYTES` constant 33–35 (reused rather than importing
  `.gitattributes`); `readmeBytes` 37–40.
- `app/src/worker/home-book.js` — `ensureLocal` 346–367 (idempotent, no
  network), `set` 213–234 (one register change, auto-commit, no push),
  `ensureDeviceId` 390–420.
- `app/src/worker/shelf.js` — `surfaceShelf(model, deviceId)` 70–77 (projects
  `local` down to this device).
- `app/vite.config.js` — Vite root is `app/` (no `root:` key; scripts run from
  `app/`), so `app/example-book/` is inside the root and reachable from
  `app/src/worker/*` by `import.meta.glob('../../example-book/*.{cifra,setlist}.md',
  { query: '?raw', import: 'default', eager: true })`; the module Worker
  (`store.js` 63–68) bundles these raw imports, and the PWA precache (lines
  42–52) carries them as part of the Worker JS.
- `app/src/i18n/index.js` — `t(key, params)`; locales registered 26–31; the
  parity test `app/src/i18n/i18n.test.js` checks every non-`en` locale against
  `en`. Existing precedent copy: `books.empty`, `books.newBookHelp`,
  `search.empty` in `locales/en.js`.
- `cifra-md` (JS) public API used by the unit test: `parse`, `write`,
  `parseSetlist`, `writeSetlist` (as imported in
  `app/src/worker/canonicalise.js` 20–28).

## Constraints / requirements

- **Offline first, no account.** Opening the example book and listing My songs
  touch no network. The example book is seeded as a **local** repository with no
  remote (workflow 1 lines 29–33); the home book is provisioned locally via
  `ensureLocal` if absent. Nothing waits on sign-in.
- **The Worker owns the data.** Seeding (git init, writing blobs, committing,
  the `shelf.json` write, indexing the new book) happens entirely in the Web
  Worker (DIRECTION §3.7). The view sends `OPEN_EXAMPLE_BOOK` and reads the
  `shelf`/`index`/`browse` slices; it never touches IndexedDB, git, or the
  bundled files. The raw example-book bytes are imported in the Worker, not the
  main thread.
- **Canonical form, and a well-formed songbook.** The seeded repository is the
  bundled book byte for byte: the `*.cifra.md`/`*.setlist.md` files (already
  canonical and diagnostic-free, held so by `scripts/check-example-book`), the
  exact `README.md`, and the §2.1 `.gitattributes` (the `GITATTRIBUTES_BYTES`
  constant). The `shelf.json` entry is written canonical by `home-book.set`. No
  file holding a conflict marker is ever written.
- **One lock per logical operation** (locks.md Decision 1, as `books.shelf`
  followed): the example repo under `withLock(exampleBookId)`, the home book
  under `withLock(HOME_BOOK_ID)`, in sequence, never nested.
- **No song text or labels in logs** (standing rule): the seed path logs
  nothing; its commit message names the act only (as `books.js` does, "Create
  book"), never a song title.
- **Accessibility** (DIRECTION §3.7; standing rule): every interactive part of
  the first-run state is React Aria Components; the four ways-in are reachable
  and operable by keyboard; status is carried by words ("No songs yet"), never
  colour; axe at WCAG 2.1 AA is clean on every state the task renders.
- **The store contract** (search Decision 1; shelf §40–43): `store` is threaded
  by prop (`App → AppShell → SearchScreen`), never React context; slices are
  read with `useSlice`; commands go through `store.send(command(...))`.
  Navigation between destinations stays view-state in `AppShell` (no router);
  the "add a book" way-in routes through an `AppShell` navigation callback, the
  other seams through plain callback props.
- **Idempotence.** Opening the example book twice (it is removable and the
  empty-shelf state returns once the shelf is empty again) must not create a
  second repository or a duplicate shelf entry.

## Acceptance criteria

### Behavior delivered

1. On a cold start — the `shelf` slice has no `books` and no `local` entries and
   there are no recents — the search screen's pre-typing region shows the
   first-run empty state: the heading "Your shelf is empty", the body explaining
   what a book is, the **four ways in** in workflow-1 order (write a song; add a
   book by its link; sign in; open the example book), and a **My songs** entry
   listed from the start with "No songs yet". Each of the four is a keyboard- and
   screen-reader-operable React Aria control.
2. **Open the example book** sends `OPEN_EXAMPLE_BOOK`; the Worker provisions the
   local home book if absent, seeds the bundled book as a local git repository
   under a reserved id (idempotently), writes its `shelf.local` entry
   (`title` = the localised label, `position`), re-surfaces `SHELF`, indexes the
   new book, and signals `BOOK_CREATED`. The example book then appears on the
   shelf under a human label (not a raw id), and its songs are found by search
   and listed as a book section.
3. The other three ways in are wired to their doors: *write a song* →
   `songs.new_song` (seam `onWriteSong`), *add a book by its link* → the Books
   screen's add-a-book flow via `AppShell` navigation (`books.add_by_link` fills
   in the by-link option), *sign in* → `account.sign_in` (seam `onSignIn`). Each
   row renders and invokes its callback; the destinations land with those tasks.
4. Once the shelf holds a book, the first-run empty state gives way to the normal
   pre-typing state (recents / books-as-sections); the example book survives an
   offline reload because it is on the device.

### Tests, by level (the `.tji` `Tests:` clause, sharpened)

- **unit** — `app/src/worker/example-book.test.js` (Vitest): over every file the
  seed module imports from `app/example-book/`, `cifra-md`'s `parse` /
  `parseSetlist` report **no diagnostics** (nothing dropped) and the file equals
  its canonical re-emission (`write` / `writeSetlist` round-trips to identical
  bytes) — i.e. the shipped book reads clean and is canonical under cifra.md for
  JavaScript (pins the `.tji` unit clause; DIRECTION §2.1; cifra.md spec §8; the
  first standing rule). A second unit, `app/src/songs/first-run.test.js` (or
  cases in the existing `search-query` unit) pins the pure predicate that decides
  when the first-run state shows (`bookIds.length === 0 && recentItems.length ===
  0`) and the widened `bookLabelFor` (local `title` → shared `label` → id).
- **behavior** — `app/src/songs/FirstRun.behavior.test.jsx` (React Testing
  Library + real React Aria + i18n, loopback-backed store seeded with an empty
  `shelf`): the four ways-in in order with their copy, the My songs entry, that
  "open the example book" sends `OPEN_EXAMPLE_BOOK` and the other three invoke
  their callbacks, a keyboard path through the four, and **axe** clean over the
  container (pins workflow 1 §Cold, §*My songs*; mockup W01). And
  `app/src/worker/example-book.behavior.test.js` (in-process Worker rig:
  `createLoopbackEndpoint`, `fake-indexeddb`, `installWebLocks`,
  `createFileSystem`, a local git remote): `OPEN_EXAMPLE_BOOK` creates one local
  repository at the reserved id whose tree is the bundled files byte for byte
  (`README.md` = `# Example Book`, the §2.1 `.gitattributes`, the three songs and
  the setlist), writes `shelf.local.<deviceId>.<exampleId>.{title,position}`,
  emits `SHELF` then `BOOK_CREATED`, indexes the book so a `SEARCH` finds a song
  in it, makes **no network call / no push**, and is **idempotent** (a second
  `OPEN_EXAMPLE_BOOK` adds no second repo and no duplicate entry) (pins workflow 1
  lines 29–33; home-book-format §4.2; DIRECTION §3.7).
- **e2e-web** — `e2e/web/tests/first-run.spec.js` (Playwright against the compose
  stack, the phone/tablet/computer projects, `@axe-core/playwright` at WCAG 2.1
  AA): a first visit shows the empty shelf and its four ways in on all three
  viewports (axe on that screen); "Open the example book" puts it on the shelf
  and a song from it is found by search; after a reload **with the network cut**
  (`context.setOffline`, as `offline.spec.js` does) the example book and its songs
  are still there; axe on the populated shelf (pins workflow 1 §Cold; the offline
  reload of DIRECTION §1 lines 29–31, §3.7).

All named tests land in this task and run (not skipped) in `scripts/gate`;
`scripts/check-example-book` already guards the book's canonical form in the gate.

### Deferred work / graph notes

None net-new. The three other doors route to leaves already in the WBS —
`songs.new_song` (first-write creation of the My-songs repository and the
editor), `books.add_by_link` (the invited door, the account-first prompt, the
dead/full-link dialogs), `account.sign_in` — each of which carries its own tests.
No new tech-debt leaf, and no test is deferred.

## Decisions

1. **The first-run empty state lives on the search front door, as a third branch
   of the pre-typing region** (SearchScreen.jsx 414–460), shown when
   `bookIds.length === 0 && recentItems.length === 0`, rendered by a new
   presentational child `app/src/songs/FirstRun.jsx` that receives the four
   callbacks and reads nothing itself. *Why:* workflow 1 and W01 put the empty
   state and its four ways-in on search (the first screen, with the search box
   above it), not on the Books screen — whose own "No books yet" empty state
   (`books.empty`, shipped by `books.shelf`) is a different, within-management
   message and is left unchanged. A separate child keeps `SearchScreen` readable
   and the behavior/axe test focused, matching the small-presentational-children
   convention (`BookRow`, `AddBookSheet`). *Rejected:* a standalone first-run
   screen outside search (contradicts the mockup, and would need its own slot in
   `AppShell`); folding the four ways-in into the Books screen's `AddBookSheet`
   (that sheet is workflow 7's add-a-book, a different set of sources).

2. **Opening the example book is a new Worker command, `OPEN_EXAMPLE_BOOK`,
   modelled on `CREATE_BOOK`** and handled by a new seeding module
   `app/src/worker/example-book.js` composed over the same `fs`/`git`/`locks`
   primitives. The Worker imports the bundled files as raw strings via
   `import.meta.glob('../../example-book/*.{cifra,setlist}.md', {query:'?raw',
   import:'default', eager:true})` plus `README.md?raw`, and reuses the
   `GITATTRIBUTES_BYTES` constant for `.gitattributes`. *Why:* the Worker is the
   one data owner (DIRECTION §3.7); importing in the Worker keeps the main thread
   out of storage, and the module Worker bundles and precaches the raw imports so
   seeding works offline. Reusing `GITATTRIBUTES_BYTES` avoids a dotfile glob and
   keeps one source of truth for the §2.1 bytes. *Rejected:* pre-serialising the
   book to a JS/JSON asset (bypasses the "checked canonical" guarantee —
   `example_book.md`'s own decision); importing the raw files on the main thread
   and posting them into the Worker (puts book bytes on the main thread for no
   gain); a new storage task (the seam already exists from `books.shelf`).

3. **The example book is seeded under a reserved local id** (e.g.
   `local-example-book`), keeping the `local-` prefix `books.js` uses, and
   seeding is idempotent: if `main` already resolves at `/books/<reserved>` the
   module skips the git write and only re-asserts the shelf entry. *Why:* the
   empty-shelf state (and so the "open the example book" row) reappears whenever
   the shelf is emptied again, and the book is removable "like any other"
   (workflow 1 line 32); a fixed id makes a re-open reuse the one repository
   instead of accumulating orphans, and makes the book recognisable. The id is a
   namespace key under this device in `shelf.json` (home-book-format §2.3), so two
   devices' example books never collide, exactly like the reserved `home` id.
   *Rejected:* minting a fresh `local-<uuid>` per open (a second open after a
   remove would leave a dangling repository and could double the entry).

4. **My songs is a listed-from-the-start synthetic entry in the first-run state,
   labelled live from i18n** ("My songs" / "No songs yet · your own, on this
   device"); it is not a stored shelf entry and no repository is created here.
   *Why:* workflow 1 is explicit that My songs is "listed from the start" but
   "created … when the first song is written into it. Until then there is nothing
   to store", and the first-run state only shows when the shelf is empty (so no
   My-songs repository can exist yet). The persistent repository, created on first
   write under the same reserved identity, is `songs.new_song`'s ("My songs
   created when first written to"). This task introduces the shared `MY_SONGS`
   identity constant (the reserved local id and the i18n label) so the two agree.
   *Rejected:* creating the My-songs repository eagerly on first run (workflow 1
   rules it out — "nothing to store"); recognising My songs by title-matching
   (fragile across the four locales and a rename).

5. **The example book's shelf label is a localised string written into the
   `shelf.local` `title` register at seed time, in the user's current language**,
   and `bookLabelFor` is widened to read a local book's `title` before falling
   back to a shared `label` and then the id. *Why:* `example_book.md` left the
   on-shelf label and its localisation to this task; the shelf's `title` register
   is exactly the user-facing name mechanism (CREATE_BOOK writes it at
   logic.js:746), so the example book behaves as "a plain local book" its own
   README calls it — including being renamable later. A local book otherwise
   shows its opaque id in search (SearchScreen.jsx:335), which this widening fixes
   for every local book, not only the example. *Rejected:* using the README H1
   "Example Book" as the shelf label (fixed English, not the user's language);
   re-deriving the label live from the reserved id in every shelf-display path
   (special-casing one book forever, where storing a title is the existing path).

6. **The ways-in copy is one i18n string per door, used across viewports**; where
   W01's phone rows and desktop cards differ only in trailing punctuation
   (`"… put on your shelf; remove it any time"` vs `"… put on your shelf. Remove
   it any time."`) the single string uses the phone's form, the layout difference
   (a `.list` of rows on phone, a `.card` grid on the computer) being CSS, not
   copy. *Why:* the difference is an authoring slip, not a decision; one string
   keeps the four locales in parity (the i18n parity test) and the two layouts in
   step. *Rejected:* two strings per door (duplicates copy and risks drift across
   locales); editing the mockup to match (a punctuation slip is not a design-level
   change, so no design delta is warranted).

7. **No design delta.** Every choice above realises what workflow 1, DIRECTION
   and the home-book format already decided; nothing deviates from a governing
   document or changes the format, and no new runtime dependency is added
   (`import.meta.glob` is built into Vite). So no `docs/` or `spec/` edit rides
   with this task.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- `app/src/songs/first-run.js` — new module: `showsFirstRun` predicate, widened `bookLabelFor` (reads `shelf.local[id].title.value` before `shelf.books[id].label.value`), `MY_SONGS` identity constant.
- `app/src/songs/FirstRun.jsx` — new presentational child rendering the four ways-in and the My songs entry from i18n and callbacks; pure React Aria.
- `app/src/songs/SearchScreen.jsx` — first-run branch in the pre-typing region (when `bookIds.length === 0 && recentItems.length === 0`), three seam props (`onWriteSong`, `onSignIn`, `onAddBook`), example-book send via `store.send(command(OPEN_EXAMPLE_BOOK))`.
- `app/src/songs/search.css` — first-run layout styles.
- `app/src/worker/example-book.js` — new seeder: raw-bundled example-book files via `import.meta.glob`, reserved id `local-example-book`, idempotent git init + write + commit + shelf entry.
- `app/src/worker/protocol.js` — `OPEN_EXAMPLE_BOOK` command added.
- `app/src/worker/logic.js` — `OPEN_EXAMPLE_BOOK` handler, composer composed over `fs`/`git`/`locks`, `indexOneBook` refactor.
- `app/src/worker/books.js` — exports `GITATTRIBUTES_BYTES`.
- `app/src/shell/AppShell.jsx` — threads `onAddBook` navigation callback to SearchScreen.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — `firstRun` block and example-book shelf label in all four locales.
- Tests — unit: `app/src/worker/example-book.test.js`, `app/src/songs/first-run.test.js`; behavior: `app/src/songs/FirstRun.behavior.test.jsx`, `app/src/worker/example-book.behavior.test.js`; e2e-web: `e2e/web/tests/first-run.spec.js` (phone, tablet, computer).
