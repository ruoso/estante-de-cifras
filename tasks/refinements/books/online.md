# books.online — Put online, remove, delete, download

## TaskJuggler

[`tasks/65-books.tji`](../../65-books.tji), `task books.online`
("Put online, remove, delete").

## Effort estimate

2d (from the `.tji`).

## Repository

**estante-de-cifras**, the app only: `app/src/books/` (the per-book detail and
its confirmations), `app/src/worker/` (the put-online / remove / delete /
download commands, the `/api/books` client, the ported zip writer), the four
`app/src/i18n/locales/*.js` catalogues, and the e2e harnesses `e2e/web/`. No
work in cifra.md, none in `service/` or `api/` — the service's book endpoints
and the OpenAPI contract already exist (service.books) and this task is their
first app-side consumer.

## Inherited dependencies

All **settled** (each `complete 100`):

- **books.shelf** (`tasks/refinements/books/shelf.md`) — the book-management
  screen `app/src/books/BooksScreen.jsx`, the pure display helpers
  `app/src/books/book-display.js`, and the ephemeral `selected` row seam the
  shelf built *for this task to read* (`BooksScreen.jsx:303-305`;
  `BookRow` at `:134`). Its header comment states outright: "Putting a book
  online, removing, deleting and the per-book detail are books.online's"
  (`BooksScreen.jsx:13-14`).
- **service.books** (`tasks/refinements/service/books.md`) — `POST /api/books`
  (create empty private book → `Book`), `GET /api/books` (list),
  `DELETE /api/books/{bookId}` (owner-only, no body), `POST /api/books/{bookId}/fork`;
  per-account quotas (100 books, 200 MB → `413`). Contract in
  `api/openapi.yaml`. The **service creates only an empty bare repo; the app
  pushes the first commit** — that push is the put-online act.
- **sync.engine** (`tasks/refinements/sync/engine.md`) — the device-side
  fetch/merge/push loop (`app/src/worker/sync-engine.js`). It treats a book as
  hosted the moment `remote.origin.url` is set (`defaultListBooks`, `:242-269`:
  a book with no remote is skipped), and it pushes a locally-ahead book on the
  next pass. Once put-online sets the remote and pushes the first commit, the
  engine keeps the book in step and retries a push that could not complete
  inline (offline-save retry).

**Driver complete but outside this task's `depends`** (satisfies the
test-driving rule by being `complete 100`, not by a `depends` edge):

- **account.sign_in** (`tasks/70-account.tji:15`, `complete 100`) — the in-app
  passkey sign-in. The e2e-web journey needs a signed-in device to create a
  book on Estante; it signs in through the CDP virtual-authenticator pattern
  that `e2e/web/tests/account-sign-in.spec.js` already drives. No `.tji` edit is
  made for it (it is already complete; a successful valid push against the
  stack is likewise already proven by sync.engine's e2e-api).

## What this task is

The four acts that turn a book on the shelf from a private local thing into a
hosted one, take it back off, or carry it away — all reached from a **per-book
detail** opened by selecting a book row on the book-management screen:

1. **Put online** (device-only book) — create it on Estante, private; adopt the
   service id; set the git remote; push the first commit. The book becomes *On
   Estante · private · you own it · you can save*, and the sync engine keeps it
   in step from then on.
2. **Download** (any book) — a zip of the repository exactly as it is on the
   device: the whole `.git` history and the working tree, unsaved changes
   included, with the remote stripped; the browser saves the file.
3. **Remove from my shelf** (any book) — delete the local clone only, behind a
   confirmation that says what would be lost (unsaved changes, unpushed saves)
   for a hosted book, or that the book will be gone for good — offering the
   download first — for a book that is only on this device.
4. **Delete the book** (owner only) — delete it from Estante for everyone,
   behind a type-the-name confirmation; then remove the local clone.

It writes the app's first `/api/books` HTTP client, adds the put-online /
remove / delete / download commands to the Worker protocol and dispatch, adds
a remote-setting + push path to the git layer, and ports Explore Chords' zip
writer. It does **not** build add-by-link, *Mine on Estante*, upload, sharing
or fork — those are their own tasks (`books.add_by_link`, `books.upload_ui`,
`books.share`, `books.fork`); the Add-a-book sheet's other three ways in stay
the drawn-but-deferred stubs shelf left.

## Why it needs to be done

It is the hinge of M3 ("Estante online"): the only in-app path from a local
book to a hosted one. Much of M3/M4/M5 hangs off it — `sync.states_e2e_hosted`,
`sync.read_in_place`, `sync.lost_access`, `books.add_by_link`, `books.share`,
`books.fork` all depend on a book being online, and several of them explicitly
wait for the in-browser "put a local book online" capability this task
introduces (the e2e harness for a hosted book, which `sync.states_e2e_hosted`
and friends reuse rather than re-build). Without it the service's book
endpoints have no caller and the shelf's "On Estante" state can never be
reached from the app.

## Inputs / context

### Normative design

- **Workflow 7** `docs/workflows/07-add-a-book.md`:
  - *The book-management screen* L12-21 — title, where it lives, can save, sync
    state (the row, already built by shelf).
  - *Putting a book online* L46-52 — "*Put online*, on a local book, creates
    the book on Estante, adds it as the remote, and pushes. **It goes online
    private**: only its owner can open it … Private is where a book starts … it
    is never shared by default, since a book with words in it is copyrighted
    text."
  - *Downloading a book* L55-63 — "*Download*, on any book, saves the repository
    **as it is on the device**: the `.git` directory with the whole history, and
    the working tree, unsaved changes included. … The remote is removed, since
    its URL is the service's and useless outside the app. The zip is written by
    the zip writer Explore Chords already has."
  - *Removing a book, and deleting one* L128-137 — "**Remove from my shelf**
    deletes the local clone only. With unsaved changes or saves not yet pushed,
    it says what would be lost and asks. For a book that is only on this device,
    it says the book will be gone for good, and offers the download first.
    **Delete the book**, only for its owner, deletes it from Estante for
    everyone, and asks for the book's name to be typed."
- **DIRECTION.md**:
  - §3.7 L418-425 — "**One owner for the data: a Web Worker.** It holds git, the
    working copy and the search index, and does every clone, fetch, merge, save
    and index update. The main thread never touches IndexedDB." "The interface
    mirrors it. A store on the main thread is fed by the Worker's messages …"
  - §3.1 L129-134 — fetch/merge/push retried on a raced push; "Every git request
    to a hosted book goes through the app's one server component (§3.3)."
  - §3.3 L175-182 — "**No book is reachable without an account** … Every request
    for a book needs a session and a membership … no anonymous read and no link
    that opens a book to whoever holds it … (`noindex`)." At most fifty people.
  - §3.3 L213-217 — "**any book can be downloaded** as a zip of its git
    repository, history and all, and uploaded back (workflow 7): a clone in a
    file, which any git tool opens and any host accepts."
  - §3.6 L288-291 — "**The app and the service share no code**, only the HTTP
    API and the format."
  - §3.6 #### The API L363-372 — "**Books**: the user's own, listed; creating
    one, empty and private; deleting one (owner only) …"; "**Git**: smart HTTP
    for each book, for its members only, by session … pushes for editors and the
    owner, and every push through the hook."
- **Mockup board** `docs/mockups/W07-add-a-book.dc.html` — draws the per-book
  detail with all four acts (desktop frame), with this copy (verbatim):
  - Put online card body: *"Only on this device. Putting it online creates it on
    Estante, private: only you can open it, until you invite people to it, at
    most 50."* — button **"Put online"**.
  - Download card body: *"A zip of the repository as it is on this device: the
    whole history, and unsaved changes as modified files. Any git tool opens
    it."* — button **"Download"**.
  - Remove card body: *"Deletes this device's copy only. The book stays on
    Estante."* — button **"Remove from my shelf"** (not danger-styled).
  - Delete card body: *"Deletes it from Estante, for everyone. Only its owner
    can."* — button **"Delete the book"** (`.btn.danger`). Its modal: title
    *"Delete My songs from Estante?"*, body *"This deletes the book, with its
    whole history, for everyone who shares it. It cannot be undone."*, field
    *"Type the book's name to confirm"*, actions *Cancel* / *Delete the book*.
  - Status chips: *"On Estante · private"*, *"You own it"*, *"You can save"*.
  - The board draws these acts on the **desktop** frame only (see Decision 2 on
    the narrow layout, and the Decision 5 note on what the board does *not*
    draw for Remove). `docs/mockups/README.md:26` — every status badge carries a
    word, never colour alone; `docs/mockups/theme.css` — `.btn.danger` =
    `var(--conflict)`, `.badge.unsaved` = `var(--unsaved)`.

### Code seams this task extends

- **Shelf UI** — `app/src/books/BooksScreen.jsx`: `BookRow` (`:134`), the
  `selected`/`.sel` state (`:303-305`), `RenameDialog` (`:169`, the RAC
  `DialogTrigger`/`Modal` pattern to mirror for confirmations),
  `LOCAL_IDENTITY = { id:'local', name:'Me' }` (`:49`), command dispatch
  `store.send(command(CommandKind.X, …))`. Pure derivations in
  `app/src/books/book-display.js` (`titleFor`, `whereFor`, `canSaveFor`,
  `orderedBooks`). Sync word in `app/src/sync-display.js` (`syncDisplayFor`).
  Layout split at `app/src/shell/layout-mode.js:22` (`WIDE_QUERY =
  '(min-width: 600px)'`; phone narrow, tablet 712px + computer wide).
- **Worker protocol** — `app/src/worker/protocol.js`: `command`/`event`
  builders, `CommandKind` and `EventKind` (frozen, open to new kinds — the
  header says the `kind` string is open for exactly this). None of put-online /
  remove / delete / download exist yet.
- **Worker dispatch** — `app/src/worker/logic.js`: the `handle` switch (`:682`),
  `CREATE_BOOK` handler (`:1100-1135`) as the template (ensureLocal →
  createLocal → ensureDeviceId → `home.set` the shelf registers →
  `surfaceHomeBookShelf()` → `ensureFs().flush()` → emit), `ensureGit()` builds
  the git http client from `options.fetch`, the `:1509-1518` catch posts any
  throw as an `ERROR` event.
- **New-book creator** — `app/src/worker/books.js`:
  `createBooks({fs,git,locks}).createLocal({title,author,now})` mints
  `local-<uuid>`, inits, scaffolds `README.md` + `.gitattributes`
  (`GITATTRIBUTES_BYTES`), one commit, **no remote**.
- **Git layer** — `app/src/worker/git.js`:
  `createGitLayer({fs,http}) → { init, clone, fetch, push, bookDir }`;
  `bookDir(id) → /books/<id>` (non-bare working tree, kept non-bare because the
  editor and download need one); `fetch`/`push` read `remote.origin.url` from
  config (url not passed). **There is no `setRemote`/`addRemote` yet** — this
  task adds one (isomorphic-git `setConfig remote.origin.url`).
  `app/src/worker/git-http.js` `createGitHttp({fetch})` (`credentials:'include'`).
- **Home book / shelf model** — `app/src/worker/home-book.js`:
  `set({bookId,file,changes,author,now})` writes `shelf.json` registers under
  one `withLock(HOME_BOOK_ID)`, commits locally, **never pushes**;
  `HOME_BOOK_ID = 'home'`, `SETTINGS_FILES` includes `shelf.json`.
  `app/src/worker/shelf.js` surfaces the `shelf` slice `{ books:
  {<serviceId>: {label,link,position,role}}, local: {<deviceId>: {<localId>:
  {title,position}}} }` (each leaf a `{value,at}` register). **A book going
  online = tombstoning its `shelf.local[deviceId][localId]` entry and writing a
  `shelf.books[serviceId]` entry** (Decision 3).
- **Sync facts & change-check** — `app/src/worker/sync-engine.js`
  (`defaultListBooks` keys hosted books by their on-disk dir name = `bookId`;
  emits per-book `SYNC` facts keyed by `bookId`);
  `app/src/worker/change-check-client.js`
  (`check(books)` POSTs `{bookId,head}[]` to `/api/shelf/change-check`, logs
  nothing). Both key a book by the id that is also its shelf key — which is why
  put-online must adopt the service id (Decision 3).
- **API contract** — `api/openapi.yaml`: `CreateBookRequest = { title }`;
  `Book = { id, title, role: owner|editor|reader, visibility: 'private',
  gitUrl: uri, original?: {bookId,title}|null }` — `gitUrl` is what goes into
  `remote.origin.url`; `DELETE /api/books/{bookId}` takes no body (the typed
  name is the app's guard); session via the `estante_session` cookie; non-member
  → 404; quota → 413. Authoritative request/response example:
  `e2e/api/books.test.js`.
- **Zip writer to port** — `/home/ruoso/devel/explore-chords/src/state/zip.js`:
  `createZip(files, at?) → Promise<Blob>` (`files: {name,text}[]`, deflate-raw
  with a STORED fallback), `readZip(buffer) → {name,text}[]`, `crc32(bytes)`;
  dependency-free. (Downloading a git repo needs binary entries too, not just
  text — see Decision 6.)

### Test harness

- Behavior (React): `*.behavior.test.jsx` — `createLoopbackEndpoint(createLogic)`
  (`app/src/test/loopback.js`) → `createStore`, Testing Library, axe via
  `checkWcag21aa` (`app/src/a11y/axe.js`); RAC overlays portal into `.est`
  through the app-wide `UNSAFE_PortalProvider` (shell.portal_provider) — see
  [[rac-overlays-portal-outside-est-theme-root]]. Template:
  `app/src/books/BooksScreen.behavior.test.jsx`. Query by text, never colour.
- Behavior (Worker): `*.behavior.test.js` — `fake-indexeddb`,
  `installWebLocks()` (`app/src/test/web-locks.js`), `createFileSystem`
  (`app/src/worker/fs.js`); a **real** git remote via `startGitHttpRemote()`
  (`app/src/test/git-http-remote.js`, a real git-http-backend with
  `http.receivepack=true`), advanced with the `git` CLI. Template:
  `app/src/worker/books.behavior.test.js`, `sync-engine.behavior.test.js`.
- unit: `*.test.js` beside source (e.g. `change-check-client.test.js`,
  `book-display.test.js`).
- e2e-web: `e2e/web/tests/*.spec.js` against the compose stack, three viewport
  projects auto-run every spec; helpers `e2e/web/lib/axe.js` (`test`, `expect`,
  `checkA11y`), `lib/devices.js`, `lib/offline.js`. Sign-in via the CDP virtual
  authenticator (`account-sign-in.spec.js`). Template:
  `e2e/web/tests/books.spec.js`. Playwright captures a download with
  `page.waitForEvent('download')`.

## Constraints / requirements

- **Component boundary (DIRECTION §3.7 L418-425).** The Worker owns git, the
  working copy and IndexedDB and does every network call to a book; the view
  only sends commands and reads slices. The `/api/books` client lives in the
  Worker layer (beside `change-check-client.js`), because setting the remote and
  pushing happen there — the main thread never touches IndexedDB or git.
- **No book without an account (DIRECTION §3.3 L175-182).** Put online and
  delete both require a session; the create/delete calls carry the
  `estante_session` cookie (`credentials:'include'`). A device-only book can be
  created, downloaded and removed with no account (workflow 7 L25), but it
  cannot be put online offline/signed-out — the create call needs the network
  and a session.
- **It goes online private (workflow 7 L48-52).** Put online never shares; the
  created book is `visibility:'private'`, owner-only. Opening it up is
  `books.share`. No code here grants any other person access.
- **Canonical form; a marked text is never pushed.** The first commit a
  put-online pushes is the book as the device holds it in canonical form (the
  shelf's `createLocal` already scaffolds canonical `README.md` +
  `.gitattributes`). This task writes no non-canonical content and performs no
  merge; it reuses the sync engine's push, which the pre-receive hook gates (a
  valid new book passes).
- **No song text, no secrets, in logs (DIRECTION; service rule).** The
  `/api/books` client and every command log nothing about a book's contents,
  ids, titles, or the session — mirroring `change-check-client.js`. A refusal
  (quota `413`, no session `401`, non-owner `403`) surfaces to the caller as a
  typed error for the view to word; it carries no book content.
- **Offline first.** Nothing waits on the network except the two acts that
  inherently need the server (create-on-Estante, delete-on-Estante). Download
  and remove-from-shelf are fully local. After a successful create, a
  first-push that cannot complete (network drops mid-act) is not lost: the book
  is already hosted (remote set) and the sync engine pushes it on its next pass.
- **Accessibility (standing rule).** Every interactive part is a React Aria
  Component with a keyboard path and an accessible name; the destructive
  confirmations are RAC `Modal`/`Dialog` (the `RenameDialog` pattern), portaled
  into `.est`; status is a word, never colour alone (the chips, the loss
  warning); axe at WCAG 2.1 AA on every screen and overlay this task renders.
- **The typed-name guard is the app's (service.books decision).** `DELETE
  /api/books/{bookId}` takes no name; the app enables the delete only when the
  typed text matches the book's displayed name exactly.

## Acceptance criteria

### Behavior delivered

1. **A per-book detail**, opened by selecting a book row (the existing
   `selected` seam). On the wide layout (tablet, computer) it is the detail pane
   beside the list, as the board draws; on the narrow layout (phone) it is a
   full-screen detail over the list with a back affordance, mirroring the
   shell's master-detail (Decision 2). It shows the book's chips (*where it
   lives*, ownership, *can save*) and the acts that apply to it.
2. **Put online** on a device-only book: the Worker calls `POST /api/books
   {title}`, receives the `Book` (its `id`, `gitUrl`), **adopts the service id**
   as the book's on-device id (Decision 3), sets `remote.origin.url = gitUrl`,
   pushes the first commit, and migrates the shelf entry from
   `shelf.local[deviceId][localId]` to `shelf.books[serviceId]` (label = the
   former title, `link`, `position`, `role: owner`). The row re-renders as *On
   Estante · private · you own it · you can save*; the sync engine thereafter
   keeps it in step. A `413` (over quota) or a missing session surfaces as a
   worded message; nothing is half-written on failure before the server create
   succeeds.
3. **Download** on any book: the Worker reads every path under `bookDir(id)`
   (the `.git` directory and the working tree, unsaved changes included),
   strips the remote from the zipped `.git/config`, and returns a zip Blob the
   main thread saves as a file. Unpacked, `git status` shows the unsaved changes
   as modified files and `git log` shows the full history (workflow 7 L55-63).
4. **Remove from my shelf** on any book: deletes the local clone
   (`bookDir(id)`) and tombstones its shelf register; the service book (if any)
   is untouched. A confirmation names **what would be lost** — unsaved changes
   and/or unpushed saves (counted from the sync `saves_waiting` fact / local-ahead
   commits) — for a hosted book; for a device-only book it warns the book will
   be **gone for good** and offers **Download** first (workflow 7 L128-135).
5. **Delete the book** (owner only; readers/editors never see the act): a
   type-the-name confirmation (the delete enabled only on an exact match), then
   `DELETE /api/books/{bookId}`, then removal of the local clone. A non-owner's
   attempt is refused by the service (`403`/`404`) and never offered by the UI.

### Tests, by level

The `.tji` names **behavior** and **e2e-web**. This refinement adds **unit**
for the two pure modules it introduces (the `/api/books` client and the ported
zip writer) — a proportionate sharpening, not a dropped level (none is dropped).

- **unit — `app/src/worker/books-client.test.js`**: the `/api/books` client's
  create/delete/list request shapes and response parsing against the
  `api/openapi.yaml` `Book`/`CreateBookRequest` schemas; `credentials:'include'`;
  a `413`/`401`/`403` surfaced as a typed error; **logs nothing** (pins
  DIRECTION §3.6 L288-291, the no-logs rule) — modelled on
  `change-check-client.test.js`.
- **unit — `app/src/worker/book-zip.test.js`**: the ported zip writer
  round-trips (write then read) including a binary (non-text) entry, and `crc32`
  matches; pins the download format (workflow 7 L55-63; explore-chords
  `src/state/zip.js`).
- **behavior (React) — `app/src/books/BookDetail.behavior.test.jsx`**: the
  per-book detail renders the applicable acts and chips (words, not colour); the
  **delete typed-name confirm** is enabled only when the typed text matches the
  name; the **remove "what would be lost" confirm** shows the unsaved/unpushed
  warning for a hosted book and the "gone for good + Download first" warning for
  a device-only book; axe clean on each overlay. Pins workflow 7 L128-137; the
  W07 board copy. (The `.tji`'s "the confirmations: what would be lost, typing
  the name; axe".)
- **behavior (Worker) — `app/src/worker/online.behavior.test.js`**: against a
  real `startGitHttpRemote()`, a device-only book **put online** gets
  `remote.origin.url` set to the remote, pushes its first commit (the remote's
  log shows it), and its shelf entry migrates to `shelf.books[serviceId]` with
  `role: owner`; a **download** of a book with an unsaved change yields a zip
  that holds the working tree *and* the `.git` with **no remote**, and unpacked
  (via the git CLI) shows the same log and the unsaved change as modified
  (pins workflow 7 L46-63 — the download behavior absorbed from `storage.download`,
  see the graph note); a **remove** deletes `bookDir` and tombstones the shelf
  entry without touching the remote; a **delete** calls the delete endpoint
  (injected `fetch`) then removes the local clone. The `/api/books` calls use an
  injected `fetch` double; the push/merge use the real remote.
- **e2e-web — `e2e/web/tests/online.spec.js`** (three viewport projects auto-run;
  axe on every screen and overlay): sign in via the CDP virtual authenticator
  (the `account-sign-in.spec.js` pattern); make a local book (the `books.spec.js`
  New-book flow); open its detail; **put it online** and assert *On Estante ·
  private*; **download it** (`page.waitForEvent('download')`, assert a non-empty
  zip); **remove** a copy from the shelf through the loss confirmation; **delete
  it as owner** through the typed-name confirmation and assert it leaves the
  shelf. Pins workflow 7; DIRECTION §3.3. Book names are written for the test
  (no-song-text rule). This spec is also the reusable "put a local book online
  on the stack" harness that `sync.states_e2e_hosted`, `sync.read_in_place` and
  `sync.lost_access` were deferred to await (downstream enabler, no new task).

## Decisions

1. **The `/api/books` client lives in the Worker, modelled on
   `change-check-client.js`.** *Chosen* over a main-thread client because
   setting the remote and pushing already happen in the Worker (git lives
   there, DIRECTION §3.7), and co-locating the create call keeps the whole
   put-online act inside one `withLock(bookId)` with no cross-thread round-trip.
   The pattern (injectable `fetch`, `credentials:'include'`, logs nothing,
   errors surfaced) is the established one.
2. **The per-book detail is a master-detail view, not a per-row menu.** The W07
   board draws a book-detail layout (left list + detail pane), not a kebab menu;
   *chosen* to follow it, reusing the shell's existing `WIDE_QUERY` split
   (`layout-mode.js:22`): a side-by-side detail pane on tablet/computer (wide),
   a full-screen detail over the list on phone (narrow). *Rejected*: a row-level
   overflow menu (diverges from the board; crowds the row the shelf keeps spare)
   and a modal-only detail (no room for the four cards + chips on a phone, and
   the board's desktop layout is a pane, not a dialog). The board draws only the
   desktop frame; the narrow presentation is this refinement's call, reusing the
   shell seam rather than inventing one — not a design delta.
3. **Putting a book online adopts the service id as the book's on-device id.**
   *Chosen* because the whole Worker keys a book by its on-disk directory name
   (`bookDir`, the `withLock` key, the `SYNC` fact key) and the shelf keys a
   hosted book by its **service** id; the change-check client sends that same id
   to the server (`change-check-client.js`). A hosted book must therefore live
   at `bookDir(serviceId)` so change-check, the sync facts, and the shelf row
   all agree. So put-online relocates the working copy from
   `bookDir(localId)` to `bookDir(serviceId)` (under the book's lock), sets the
   remote, pushes, and migrates the shelf register. *Rejected*: keeping the
   `local-<uuid>` id and storing a local→service id map — it would break the
   "directory name = bookId" invariant every Worker module relies on and force
   change-check and every `SYNC` fact to translate ids. *Rejected*: re-cloning
   from the new empty remote — it would throw away the local commits the push
   exists to carry.
4. **The service create happens before the push; a dropped network after create
   does not lose the book.** *Chosen*: `POST /api/books` (needs the network),
   then set-remote + push inline. If the inline push fails, the book is already
   hosted (remote set, shelf migrated), so the sync engine's next pass pushes it
   (its documented offline-save retry). *Rejected*: pushing first — impossible,
   the remote does not exist until the service creates it. If the **create**
   itself fails (offline/`413`/`401`), nothing is changed on the device and the
   act reports the reason.
5. **Remove's "what would be lost" and "gone for good" confirmations are built
   from workflow 7 L128-135, which the W07 board does not fully draw.** The
   board draws only the hosted-in-step one-liner ("Deletes this device's copy
   only. The book stays on Estante."); the unsaved/unpushed loss warning and the
   device-only "gone for good, download first" path are normative in workflow 7
   but not illustrated. *Chosen*: implement the workflow's three cases, wording
   them from its text and the board's established voice, since the workflow (not
   the drawing) is the constitution here and this is not a deviation from it.
   The board under-illustrating Remove is surfaced to the human parking lot (a
   drawing gap, not a WBS task).
6. **The download ports Explore Chords' zip writer, extended to binary
   entries.** *Chosen* per workflow 7 L62 ("the zip writer Explore Chords
   already has") — a dependency-free module copied into `app/src/worker/`
   (app-lineage reuse, not a cross-implementation share, not a new runtime
   dependency). Its `createZip` takes `{name,text}[]`; a git repo's `.git`
   objects are binary, so the port takes `{name, bytes: Uint8Array}` entries
   (text encoded by the caller). The remote is stripped by rewriting the zipped
   `.git/config` without the `[remote "origin"]` block (workflow 7 L60).
   *Rejected*: adding a zip library (`fflate`/`jszip`) — against Explore Chords'
   no-runtime-dependency promise the writer was built to keep, and the workflow
   names the existing writer.

### Graph note to the closer — `storage.download` overlaps this task

`tasks/40-storage.tji:71` `task download "Download a book"` (effort 1d, `depends
!working_copy`, M5, **no refinement written**) specifies the same act this
task's note scopes to it ("Zip of the repository as it is on the device …
Explore Chords' zip writer. Workflow 7.") and the same behavior test. `books.online`
cannot defer download to it: `books.online` is M3 and a hard dependency of most
of M3/M4/M5 (including M5 itself), while `storage.download` sits in M5 — a
dependency on it would be circular and would strand M3. The download test is
named in `books.online`'s `.tji` and is delivered here in full (Decision 6, and
the `online.behavior.test.js` / `book-zip.test.js` cases). **Recommend the
closer retire `storage.download` as absorbed by `books.online`** (remove it from
`m5_complete`'s `depends` in `tasks/99-milestones.tji:44` and drop the leaf), so
no future pick builds a duplicate. I have not edited any `.tji` (the orchestrator
/ closer own the WBS shape).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-08.

- Worker: `app/src/worker/books-client.js` (new `/api/books` HTTP client, `credentials:'include'`, no logs, typed errors for 401/403/413); `app/src/worker/book-zip.js` (ported zip writer, binary entries, remote-stripping); `app/src/worker/online.js` (new put-online / download / remove / delete dispatch helpers).
- Worker extensions: `app/src/worker/git.js` (+`setRemote` via `isomorphic-git setConfig`); `app/src/worker/protocol.js` (+`PUT_ONLINE`/`DOWNLOAD_BOOK`/`REMOVE_BOOK`/`DELETE_BOOK` commands and `BOOK_ONLINE`/`BOOK_REFUSED`/`BOOK_DOWNLOAD`/`BOOK_REMOVED` events); `app/src/worker/logic.js` (four new handlers + shelf migration / tombstone on put-online).
- UI: `app/src/books/BookDetail.jsx`, `app/src/books/book-detail.css` (new per-book detail); `app/src/books/BooksScreen.jsx` (master-detail, `splitMode`, open-detail seam); `app/src/books/book-display.js` (`orderedBooks` drops fully-tombstoned entries); `app/src/shell/AppShell.jsx` (threads `mode`); `app/src/shell/layout-mode.js` (`BOOKS_WIDE_QUERY` at 1080 px for the nested shelf split).
- i18n: `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` (detail copy, confirmation wording).
- Test infra: `app/src/test/git-http-remote.js` (`{seed:false}` empty-remote option).
- Tests: unit `app/src/worker/books-client.test.js` (7), `app/src/worker/book-zip.test.js` (3), `app/src/books/book-display.test.js` (+12 incl. tombstone-drop); behavior (React) `app/src/books/BookDetail.behavior.test.jsx` (6); behavior (Worker) `app/src/worker/online.behavior.test.js` (5); e2e-web `e2e/web/tests/online.spec.js` (2 tests × 3 viewports).
