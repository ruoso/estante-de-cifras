# account.new_device — A new device

## TaskJuggler entry

[`tasks/70-account.tji`](../../70-account.tji) lines 22–27, `task
account.new_device` ("A new device"). `depends !sign_in, storage.home_book,
sync.engine, books.online, service.home_book`. Every dependency is `complete
100`. It is a prerequisite of `milestones.m5_complete`
(`tasks/99-milestones.tji:44`).

Note (verbatim): *"Attach the home book to its service remote
(service.home_book) on sign-in, pushing what this device has. The home book
first, the shelf filling, only on your iPhone, a device used before signing in
(merge or keep both My songs). Workflow 13. Tests: behavior (the home book
first, the shelf filling, only on your iPhone; axe); e2e-web (a second browser
context signs in to the same account on the stack and fills its shelf; a device
used before signing in merges or keeps both My songs; axe)."*

## Effort estimate

3d (`allocate team`), as the `.tji` fixes it. Most of it reuses what is
already there:

- `home-book.js` `sync` already merges two unrelated home-book histories and
  pushes to an empty remote.
- `git.js` `setRemote` already attaches an origin.
- `add-by-link.js` `cloneHosted` and `logic.js` `cloneOntoShelf` already clone
  a hosted book onto the shelf.
- The workflow 7 upload preview and merge (`upload.js`, `UploadPreview.jsx`)
  already merge one book's songs into another, "unrelated histories and all".

The new work:

- the attach step;
- the shelf fill: a queue of clones for shelf entries that have no directory
  on this device, with progress reported per book;
- the *only on your …* rows;
- the *My songs* choice;
- two small additions to the home-book format.

The commit-author switch that `sign_in` Decision 6 handed here is split out
(Decision 8), which is what keeps this to three days.

## Repository

Lands in estante-de-cifras, not under `cifra.md/`:

- `app/src/worker/`: attach, fill, the device kind, the My songs choice and its
  commands.
- `app/src/books/` and `app/src/account/`: the shelf rows, the restore notice
  and the choice sheet.
- `app/src/i18n/locales/`: the new copy, in every locale the app ships.
- `e2e/web/tests/new-device.spec.js` and `e2e/web/lib/journeys-account.js`.
- `docs/home-book-format.md` §4.2 and §7: the format delta of Decision 4,
  written by the implementer in this task's commit.

The service, the hook and `api/` are unchanged (Decision 4 explains why the
hook accepts the new keys as they are).

**Design deltas:**

- `docs/workflows/13-new-device.md`, already written alongside this
  refinement:
  - §Books that were only on the other device (lines 101–105): a device is
    named by its kind.
  - §A device used before signing in (lines 119–133): *Later*; which *My
    songs* is the account's; merging takes the songs as they stand; the
    merged-away *My songs* leaves the shelf.
- `docs/home-book-format.md` §4.2 and §7: the implementer writes this in the
  same commit (Decision 4).

## Inherited dependencies

Settled, all `complete 100`:

- **`account.sign_in`** (`tasks/refinements/account/sign_in.md`):
  - `SignIn.jsx` calls `onSignedIn(account)` at `app/src/account/SignIn.jsx:133,
    219, 229, 240`.
  - `AppShell.jsx:720-733` mounts it, and today it only closes the surface.
    The comments at `AppShell.jsx:297-299` and `:715-717` hand the shelf fill
    to this task.
  - Decision 6 (`sign_in.md:487-500`) hands over the author switch and the
    cold-reload re-detection.
- **`storage.home_book`** (`tasks/refinements/storage/home_book.md`):
  - `app/src/worker/home-book.js`: `read` at :201, `set` at :213, `sync` at
    :251, `ensureLocal` at :346, `ensureDeviceId` at :390, and
    `HOME_BOOK_ID='home'` at :85.
  - `sync` fetches `origin`. When the origin holds commits that local `main`
    does not have, it merges every settings file key by key with `mergeTrees`
    and commits with parents `[local, origin]` (:282-304). That also covers two
    unrelated roots: a fresh device's scaffold against the account's history.
    It then pushes on a best-effort basis (:322-332). With no `origin/main`
    (an empty service repository) it skips the merge and pushes, which
    creates `main`.
- **`sync.engine`** (`tasks/refinements/sync/engine.md`):
  - `app/src/worker/sync-engine.js` `defaultListBooks` (:480-505) treats any
    `/books/<dir>` with `remote.origin.url` as hosted and flags
    `home: bookId === homeBookId`.
  - `syncHome` (:474) is called when the change check reports the home book
    changed or it is locally ahead.
  - `CommandKind.SYNC_HOME` is handled at `logic.js:1588`, which also runs
    `surfaceHomeBookPreferences`.
- **`books.online`** (`tasks/refinements/books/online.md`):
  - `PUT_ONLINE` (`logic.js:1860`) adopts the service id as the on-device id,
    tombstones `shelf.local[device][localId]` and writes `shelf.books[id]`
    (Decision 3).
  - `online.js:161` uses `git.setRemote` (`git.js:122`).
  - `online.detach` (`online.js:274`) is what sign-out uses to strip a remote.
- **`service.home_book`** (`tasks/refinements/service/home_book.md`):
  - `GET /api/account/home-book` (`api/openapi.yaml:399-421`) returns
    `HomeBook {id, gitUrl}` (schema :1306-1318), or 401 without a session.
  - The service provisions the home book empty on the first request; the
    first push is a fast-forward onto nothing.
  - The change check covers the home book by its service id.
  - `service/home_book.md:248-252` hands the app side here: attach `gitUrl`,
    keep the service id beside the local id `'home'`, and send that id in the
    change check.
- **`books.add_by_link`** (`tasks/refinements/books/add_by_link.md`):
  - `app/src/worker/add-by-link.js` `cloneHosted({id, gitUrl, onProgress})`
    is at :51.
  - `logic.js` `cloneOntoShelf` is at :923-960.
  - `booksNotOnShelf` (`app/src/books/mine-on-estante.js:51`) leaves out any
    book that has a live `shelf.books` entry. On a new device, the books that
    are still cloning are therefore not offered twice in *Mine on Estante*,
    which is the behavior we want.
- **`sync.upload` / `books.upload_ui`**: `app/src/worker/upload.js` provides
  `preview` (:460), `previewUnrelated` (:391) and `import_` (:645, choice
  `'merge'`). `PREVIEW_UPLOAD` and `IMPORT_UPLOAD` are at `logic.js:1638-1700`.
  The UI is `app/src/books/UploadPreview.jsx`.
- **`account.sign_out`** (`tasks/refinements/account/sign_out.md`): sign-out
  already strips the home book's remote. The comment at `logic.js:2247-2249`
  says this is "a no-op today, since nothing attaches it yet". This task makes
  it real. Because the service id is kept inside the `origin` remote section
  (Decision 2), the same strip removes it too.

Pending: none.

## What this task is

Signing in makes the device the account's, as workflow 13 §What comes down
describes.

**On sign-in**, the Worker does two things in order:

1. **It attaches.** It asks the service where the account's home book is,
   sets `gitUrl` as the home book's `origin`, and records the service id
   there.
2. **It syncs the home book.**
   - If this device was never used, the account's settings come down.
   - If it was used before signing in, its local home book merges into the
     account's key by key, as two devices' home books do (workflow 8), and is
     pushed.
   - If the account's home book is still empty, this device's is pushed as
     the first.

The settings are surfaced first, so the instrument, notation, language and
theme are right before the shelf shows anything. When the account's settings
came down, a notice on the shelf says so: *Home book restored. Your
instrument, notation and language are set.*, with the instrument and tuning,
the notation and the language on a second line (board W13, frame 1).

**Then the shelf fills.**

- Every book in the account's `shelf.books` that has no directory on this
  device is listed at once, in shelf order, each row with its state.
- The books clone one at a time in the background:
  - *ready* (with its song count);
  - *cloning* (with progress, and its songs searchable as they arrive);
  - *waiting* (next in line).
- The fill resumes after a reload.

**Local books held by other devices** of the account are listed as *Only on
your iPhone: Rascunhos — Put it online there to have it here.* The device's
kind is something each device writes down for itself when it attaches.

**A device used before signing in** that has songs in its own *My songs*,
signing in to an account whose *My songs* is online, is offered the choice
(board W13, frame 3):

- **Merge** — this device's songs go into the account's *My songs* through the
  workflow 7 merge preview, unrelated histories and all.
- **Keep both** — the local one is relabelled *My songs (this device)*.
- **Later** — nothing changes, and the choice is asked again on the next start.

## Why it needs to be done

DIRECTION §3.2 promises that the home book "replaces both a backup and setting
up each new device". Until now nothing attaches the home book to the service,
so `home-book.js` `sync` fetches from a remote that does not exist and fails
quietly as offline every time. Settings, shelf and shapes never leave the
device they were set on.

Workflow 13 is the reason to have an account at all on a second device. Board
W13 frames 1–3 are listed in `tasks/parking-lot.md:131` as "waiting on
`service.home_book` / `account.new_device`".

Downstream, it unblocks three things:

- `milestones.m5_complete`;
- the author switch, `account.commit_author` (Decision 8);
- every later feature that assumes a person's settings follow them (fork
  following and the owner's name already read `shelf.json` registers that
  only another device can have written).

## Inputs / context

- **Workflow 13** (`docs/workflows/13-new-device.md`):
  - §What comes down (78–86): the home book first, then the shelf in shelf
    order, cloning in the background, searchable as songs arrive.
  - §The shelf is in the home book (87–93).
  - §Books that were only on the other device (94–105): *only on your
    iPhone*, and how a device is named (delta).
  - §Unsaved changes (107–111): nothing travels.
  - §A device used before signing in (112–133): the home book merged key by
    key; merge or keep both *My songs*; *Later*; which *My songs* is the
    account's (delta).
- **Workflow 8** (`docs/workflows/08-sync.md`): home books merge key by key,
  and the later change wins.
- **Workflow 7** (`docs/workflows/07-add-a-book.md`): the upload preview and
  the merge of unrelated histories that *Merge* reuses.
- **DIRECTION**:
  - §3.1 (`docs/DIRECTION.md:127-134`): sync is fetch, merge, push.
  - §3.2 (:136-152): the home book and personal state.
  - §3.3 (:165-171): commit authorship, which goes to `account.commit_author`.
  - §3.7: the Worker owns git and IndexedDB.
- **`docs/home-book-format.md`**:
  - §2.3 (:128-150): a device id is a namespace key only.
  - §3 (:152): the register envelope.
  - §4.2 (:235-305): `shelf.json`'s `books` and `local`.
  - §5: the merge.
  - §7 (:498-522): per-device state.
  - §8 (:524-552): what the hook validates, which is the envelope and not the
    key names.
- **Board** `docs/mockups/W13-new-device.dc.html`:
  - Frame 1 (phone): sign-in.
  - Frame 2 (phone): the restore notice ("Home book restored. Your instrument,
    notation and language are set." / "Guitar · E A D G B E · Brazilian
    notation · English"), "Search songs as they arrive", "Your shelf · 3
    books", rows *ready / cloning / waiting* with a progress bar, and "Only on
    your iPhone: Rascunhos / Put it online there to have it here."
  - Frame 3 (tablet):
    - "Your two My songs" with *Later*, and "This tablet's preferences and
      shapes were merged into your account's, setting by setting.";
    - the card "This tablet has its own My songs / Your account has a My songs
      too. Bring the two together, or keep them apart.";
    - *Merge* ("This tablet's songs go into your account's My songs. Preview
      first, song by song.") and *Keep both* ("This one stays on the shelf as
      My songs (this device).");
    - the preview, "What merging would do / Nothing is written until you
      confirm / The two share no history, so every song that is in both is
      shown as a conflict to choose between.", with rows *added / conflict*,
      and the buttons *Keep both instead* and *Merge and save*.
  - Frame list: `e2e/web/lib/mockup-frames.json:356-379` (W13 1–3; frame 4 is
    the account screen, already reached by `account_screen`).
- **App seams**:
  - `app/src/shell/AppShell.jsx`: `LOCAL_IDENTITY` at :64 (untouched here,
    see Decision 8), the `signIn` state at :300, and `<SignIn onSignedIn>` at
    :720-733.
  - `app/src/account/auth-client.js`: `listSessions` at :196, which is the
    current way to learn that the device is signed in.
  - `app/src/worker/books-client.js`: the pattern for Worker-side API calls.
  - `app/src/worker/shelf.js` `surfaceShelf(model, deviceId)` at :68: it
    narrows `local` to this device and drops every other device's books.
  - `app/src/worker/logic.js`:
    - `cloneOntoShelf` at :923-960 and `nextShelfPosition` at :256;
    - `resolveSyncAuthor` at :784;
    - `CREATE_BOOK` and My songs `NEW_SONG` at :2475-2510 (the
      `local[deviceId][MY_SONGS_ID]` entry);
    - `PUT_ONLINE` at :1860;
    - `SYNC_HOME` at :1588.
  - `app/src/worker/my-songs.js`: `MY_SONGS_ID='local-my-songs'` at :30.
  - `app/src/worker/book-zip.js`: the zip that *Download* makes.
  - `app/src/books/BooksScreen.jsx` `BookRow` at :179.
  - `app/src/books/book-display.js`: `whereFor` at :44, and the shelf entries
    list at :101-112.
  - `app/src/i18n/locales/en.js`: `books.onDevice` at :100, the upload strings
    at :69-95, and `firstRun.mySongs` at :520.
- **e2e seams**:
  - `e2e/web/lib/journeys.js`:
    - `signedInDevice` at :120, `enableVirtualAuthenticator` at :65 and
      `sharePasskeys` at :85;
    - `makeLocalBook` at :128, `putBookOnline` at :139 and `syncNow` at :194;
    - `waitUntilSearchable` at :202.
  - `e2e/web/lib/journeys-account.js`: `signInExistingWithPasskey` at :128,
    `writeSongFromScratch` at :141 and `openAccount` at :16.
  - `e2e/web/lib/devices.js` `openDevice(browser)` at :11.
  - `e2e/web/lib/mockup.js` `mockup(page, board, index)`.
  - Template for the same account on two browser contexts:
    `e2e/web/tests/account-screen.spec.js:79-95`.
  - Playwright projects (`e2e/web/playwright.config.js:39-43`): Pixel 7,
    Galaxy Tab S4 and Desktop Chrome. Their user agents are an Android phone,
    an Android tablet and Windows.

## Constraints / requirements

- **The Worker owns it all** (DIRECTION §3.7). `GET /api/account/home-book`,
  the attach, the home sync, the clones, the device kind and the My songs
  merge all run in the Worker. The view sends commands and renders events.
  The main thread touches neither IndexedDB nor git.
- **Offline first.** Nothing the user does waits on the attach or the fill.
  The shelf shows the books it already has at once; the fill's rows appear as
  soon as the home book's shelf is surfaced. A clone that fails for want of a
  network stays *waiting* and resumes when the network returns or on the next
  start; it is never shown as failed or lost.
- **The home book first** (workflow 13 §What comes down). The fill does not
  start until the attach's home sync has finished and its preferences have
  been surfaced.
- **No book without an account; the session is the service's.**
  - The app never reads the cookie and stores no token.
  - A 401 from `GET /api/account/home-book` means "not signed in", and
    nothing is attached.
  - The attach stores only the `gitUrl` and the service id, inside the home
    book's own `remote "origin"` git config section. Nothing secret goes
    there, matching what `shelf.json` already holds (§4.2).
- **Format rules** (`docs/home-book-format.md` §2.3, §9):
  - A device id stays a namespace key only; it never becomes a register value.
  - Every write goes through `home.set`, so the envelope, canonical form and
    auto-commit come for free.
  - The device kind is a short token (Decision 5), never a user agent string
    and never a name the user typed.
- **Canonical form.** *Merge* lands through the workflow 7 merge path. A song
  in conflict is chosen in the preview. A merged song is saved in canonical
  form, and nothing marked is saved (cifra.md §8). The merge path already
  enforces this; this task must not get around it.
- **Unsaved changes stay put** (workflow 13 §Unsaved changes). The fill clones
  only. *Merge* takes this device's *My songs* as its working tree stands, so
  unsaved edits are carried and not lost (workflow 13 delta). Nothing else
  moves unsaved text between books.
- **No song text in logs**: no titles, labels, links or song text in any
  console or log line.
- **Accessibility**:
  - Every interactive element (the notice's dismiss, the choice card's
    buttons, *Later*) is a React Aria Component.
  - Fill states are words (*ready*, *cloning 45%*, *waiting*). The progress
    bar is a RAC `ProgressBar` with a label, never colour alone.
  - The restore notice and the fill progress are announced politely, through
    the notice surface or a `role="status"` region.
  - Axe at WCAG 2.1 AA on the shelf while it fills and on the choice and its
    preview.
  - Overlays portal inside `.est` (memory: RAC overlays portal outside the
    theme root).
- **No new runtime dependency.** The device kind comes from
  `navigator.userAgentData` when present, and otherwise from
  `navigator.userAgent` plus `navigator.maxTouchPoints`, using a small
  hand-written pure function.
- **Component boundaries.** The app and the service share no code. The
  service's `describeDevice` (`service/internal/session/device.go:14`) is not
  ported. The app's kind function is its own, written against workflow 13's
  list.

## Acceptance criteria

### Behavior delivered

1. **Attach on sign-in, and once per start while unattached.**
   - `onSignedIn` in `AppShell` sends `ATTACH_HOME`.
   - When `/books/home` has no `remote.origin.url`, the Worker:
     1. calls `GET /api/account/home-book`;
     2. `setRemote`s `gitUrl`;
     3. writes the service id as `remote.origin.estanteid`;
     4. writes `shelf.devices[deviceId].kind` (Decision 5);
     5. runs `home.sync`;
     6. surfaces preferences and the shelf.
   - It replies `{ attached, restored }`. `restored` is true when
     `origin/main` existed before the merge.
   - The same command runs once at Worker start when unattached. A 401 there
     ends quietly, and this is the cold-reload re-detection (Decision 3).
   - An already-attached home book is never re-attached.
2. **Change check by the service id.** The sync engine sends the home book's
   `estanteid`, not `'home'`, to `/api/shelf/change-check`, and maps the
   answer back to `'home'`. The home book then syncs on the same five triggers
   as any hosted book (`service/home_book.md:248-252`).
3. **The restore notice.**
   - When `restored`, the shelf shows *Home book restored. Your instrument,
     notation and language are set.* with the summary line: instrument and
     tuning, notation, and language, each read from the surfaced preferences.
   - It is shown until dismissed, or until the next start.
   - It is not shown after a first push to an empty home book.
4. **The shelf fill.**
   - Every live `shelf.books` entry with no `/books/<id>` is a fill row,
     ordered by `position`.
   - The Worker clones them one at a time through the `cloneHosted` /
     `cloneOntoShelf` path, emitting `SHELF_FILL` events
     `{ bookId, state: 'waiting' | 'cloning' | 'ready', progress }`.
   - Each book is indexed as it lands, so its songs are searchable as they
     arrive (workflow 2).
   - A failed clone returns to *waiting*.
   - The fill re-runs after each home sync that brings new `shelf.books`
     entries, and on start.
   - The existing `shelf.books` registers (label, role, owner, position,
     original) are kept as they are; the clone does not rewrite them
     (Decision 6).
5. **Only on your …**
   - `surfaceShelf` also returns `elsewhere`: other devices' live `local`
     books, as `{ deviceId, bookId, title, kind, position }`.
   - The shelf renders them after its own books as non-opening rows: *Only on
     your {kind}: {title}* / *Put it online there to have it here.*
   - An unknown kind reads *another device*.
   - A local book put online on its own device disappears from `elsewhere`,
     because its marker is tombstoned by `PUT_ONLINE`, and comes in through
     the fill.
6. **The account's My songs.**
   - `PUT_ONLINE` of `MY_SONGS_ID` also writes `shelf.mySongs` (a register
     holding the new service id; Decision 7).
   - After the attach, the Worker offers the choice (`MY_SONGS_CHOICE` event)
     when all of these hold:
     - `shelf.mySongs` names a live `shelf.books` entry;
     - this device has a `local[deviceId][MY_SONGS_ID]` with at least one
       song;
     - this device has not chosen *keep both*.
   - The offer is evaluated again on each start and after each home sync, so
     *Later* asks again on the next start.
7. **Merge.**
   - Once the account's *My songs* has cloned, *Merge* zips this device's
     *My songs* as `book-zip.js` does for *Download*, working tree included.
   - It runs `PREVIEW_UPLOAD` with the account's *My songs* as target. The
     result is workflow 7's unrelated-histories preview in
     `UploadPreview.jsx`, with this task's copy (*What merging would do*;
     *Keep both instead*; *Merge and save*).
   - *Merge and save* runs `IMPORT_UPLOAD` with choice `'merge'`. It then
     removes this device's *My songs* (tombstones its `local` marker, deletes
     its directory and drops it from the index), and lets the sync engine
     push.
   - Cancel, or *Keep both instead*, writes nothing to the target.
8. **Keep both.**
   - `local[deviceId][MY_SONGS_ID].title` is set to *My songs (this device)*,
     in the device's language at the time.
   - The device-local meta flag `mySongsKeptBoth` is written in the Worker's
     `meta` store, outside the home book, and the offer stops.
9. **Sign-out unaffected.** Sign-out's existing strip of the home book's
   remote removes `estanteid` with it. Signing in again re-attaches.

### Tests, by level

Every test below can be driven with what already exists:

- the Worker and a local git remote (the `home-book.behavior.test.js` and
  `add-by-link.behavior.test.js` pattern);
- a signed-in device (`account.sign_in`: `signedInDevice`,
  `signInExistingWithPasskey` with shared virtual-authenticator passkeys);
- a second device of the same account, as a second browser context (the
  `account-screen.spec.js:79-95` template);
- hosted books on device A (`books.online`: `putBookOnline`);
- a local book (`makeLocalBook`);
- songs in *My songs* (`writeSongFromScratch`);
- the home book on the service (`service.home_book`).

All of these are `complete 100`.

**unit** (Vitest):

- `app/src/worker/device-kind.test.js`: `deviceKindOf`.
  - From `userAgentData` and from a user agent: iPhone, iPad (including the
    iPadOS desktop user agent with `maxTouchPoints > 1`), Android phone,
    Android tablet (no `Mobile`), Mac, Windows, Linux, ChromeOS.
  - Anything else is `other`.
  - The Playwright descriptors' user agents (Pixel 7, Galaxy Tab S4, Desktop
    Chrome) map to `android-phone`, `android-tablet` and `windows`
    (workflow 13 §Books that were only on the other device, delta).
- `app/src/worker/shelf.test.js` (extended): `surfaceShelf` and `elsewhere`.
  - Other devices' live local books are listed with their device's kind.
  - This device's own books are not listed.
  - A tombstoned marker is not listed.
  - A device with no `devices` entry gets `kind: 'other'`.
  - `mySongs` is surfaced (format §4.2, §7 delta).
- `app/src/worker/shelf-fill.test.js`: the pure `fillQueue(shelf, presentIds)`.
  - Live `books` entries without a directory, in `position` order.
  - Tombstoned entries and present directories are left out.
  - Equal positions are ordered by book id (workflow 13 §What comes down
    "in the shelf list's order").
- `app/src/worker/my-songs-choice.test.js`: the pure offer predicate. It
  offers only when all of these hold:
  - `mySongs` names a live hosted entry;
  - the local *My songs* has at least one song;
  - the device has not kept both.

  It does not offer when the account's *My songs* is only local on another
  device (workflow 13 §A device used before signing in, delta).
- `app/src/books/book-display.test.js` (extended): the *Only on your {kind}*
  copy for each kind and for `other`; the fill-row state words.

**behavior** (Vitest, the Worker against fake IndexedDB and a local bare git
remote standing in for the service; components with Testing Library and axe):

- `app/src/worker/new-device.behavior.test.js`. Device A and device B are two
  Worker instances sharing one local bare remote per book, plus a home-book
  remote. `GET /api/account/home-book` is served by an injected fetch that
  returns the remote's id and URL, or 401.
  - **The home book first.** A has a theme, an instrument and two hosted books
    in its pushed home book. B attaches:
    - `remote.origin.url` and `estanteid` are set;
    - B's preferences event (theme and instrument) is emitted before any
      `SHELF_FILL` event;
    - the reply is `restored: true`.

    Pins workflow 13 §What comes down, and DIRECTION §3.2.
  - **A first device.** A fresh account remote (no `main`): attach pushes this
    device's home book, `restored: false`, and the remote's `main` equals
    local `main`.
  - **A device used before signing in.** B set a preference and created a
    local book before attaching; A changed a different key, and the same key
    earlier. After the attach:
    - both keys are merged, and the later change wins;
    - the merge commit has two parents;
    - it is pushed;
    - B's local book's marker sits under B's namespace on the remote.

    Pins workflow 13 §A device used before signing in, and workflow 8.
  - **The shelf filling.** B's `SHELF_FILL` events run *waiting* for every
    book, then *cloning* then *ready* for each in turn, in `position` order.
    - Each book is searchable once *ready*.
    - The `shelf.books` registers are byte-identical before and after.
    - A clone made to fail (remote removed) returns to *waiting*, and
      completes on the next start (a new Worker instance over the same
      IndexedDB).
  - **Only on your Android phone.** A has a local book and `devices[A].kind =
    'android-phone'`. B's surfaced shelf `elsewhere` lists it, and B cannot
    open it. After A puts it online, B's next home sync drops it from
    `elsewhere` and fills it.
  - **Not signed in.** With a 401 at start, nothing is attached and no remote
    is set. Sign-out after an attach strips `estanteid` with the remote.
  - **Change check.** The engine's change-check request names the home book
    by `estanteid`, never `'home'`.
  - **My songs.**
    - The offer fires when A's *My songs* is online (`shelf.mySongs` written
      by `PUT_ONLINE`) and B's has songs.
    - It does not fire when A's *My songs* is only local.
    - Keep both relabels B's and stops the offer across a restart.
    - Merge previews the unrelated histories: a song in both is a conflict,
      B's own songs are added. *Merge and save* lands them in the account's
      book. B's *My songs* is gone from disk, the index and the shelf, and a
      B song with an unsaved edit lands with the edit.
- `app/src/books/BooksScreen.behavior.test.jsx` (extended), axe clean:
  - The restore notice with its summary line, dismissable.
  - Fill rows reading *ready*, *cloning 45%* (a labelled progress bar) and
    *waiting*.
  - The *Only on your Android phone: Rascunhos / Put it online there to have
    it here.* row, which is not a link or button that opens.
  - The rows are announced with words, never colour alone.

  Pins board W13 frame 2 and workflow 13 §What comes down, §Books that were
  only on the other device.
- `app/src/account/MySongsChoice.behavior.test.jsx`, axe clean:
  - The card's copy as on board W13 frame 3.
  - *Merge* opens the preview with *What merging would do* and the *added /
    conflict* rows.
  - *Keep both instead* and *Keep both* send `KEEP_BOTH_MY_SONGS`.
  - *Later* closes and sends nothing.
  - *Merge and save* sends `IMPORT_UPLOAD` with choice `'merge'`.
  - Keyboard: every action is reachable by Tab and Enter or Space (one
    gesture per press — memory: RAC Button keyDown plus click cancels the
    press).

**e2e-web** (Playwright on the stack, phone, tablet and computer, axe at
WCAG 2.1 AA): `e2e/web/tests/new-device.spec.js`. New real-UI helpers go in
`e2e/web/lib/journeys-account.js`; there are no `#dev/*` mounts, no injected
state and no API writes.

- **A second device fills its shelf.**
  1. Device A (`signedInDevice`) changes the theme to Palco and the notation
     in the account screen.
  2. A makes two books with a song each and puts them online (`makeLocalBook`,
     `writeSongFromScratch`, `putBookOnline`), and makes a third local book
     it does not put online.
  3. A runs `syncNow`.
  4. Device B (`openDevice`, `sharePasskeys`, `signInExistingWithPasskey`)
     signs in.
  5. B shows Palco and the notation before its shelf lists the books, and the
     restore notice is visible.
  6. Both hosted books reach *ready* and their songs are found in search.
  7. The local one reads *Only on your Android phone* on the phone project
     (the kind that project's descriptor gives; asserted per project).
  8. B reloads, and the shelf is all there.

  Axe runs on the filling shelf. `mockup(page, 'W13-new-device', 1)` is
  called at sign-in and `mockup(page, 'W13-new-device', 2)` while filling.
  Pins workflow 13 §What comes down and §Books that were only on the other
  device.
- **A device used before signing in: merge.**
  1. A writes a song in *My songs*, puts *My songs* online, and syncs.
  2. Device C is fresh. It writes two songs in its own *My songs*, one with
     the same title and different text, then signs in.
  3. The choice appears; *Merge* opens the preview: one conflict, one added.
  4. C chooses a side for the conflict, then *Merge and save*.
  5. The shelf holds one *My songs* with all three songs, and A sees C's song
     after `syncNow`.

  Axe runs on the choice and on the preview. `mockup(page, 'W13-new-device',
  3)` is called on the choice. Pins workflow 13 §A device used before signing
  in, and workflow 7.
- **A device used before signing in: keep both.** The same setup as merge,
  then *Keep both*. The shelf lists *My songs* (the account's, cloned) and *My
  songs (this device)*. After a reload no choice is offered.
- **Offline while filling.** B signs in. The network is set offline
  (`context.setOffline`) after the first book is ready. The rest stay
  *waiting* and the first opens and plays. Back online, the rest reach
  *ready*. Pins the offline-first constraint and workflow 8 §When it runs.

### Deferred work / graph notes

- Deferred to **`account.commit_author`** (closer registers in WBS). This is
  not a `cifra.md:` task, the estimate is 2d, and it belongs in
  `milestones.m5_complete`. Its `depends` are `!new_device` and
  `sync.engine`.
  - What it covers: after sign-in, saves, merges and home syncs are authored
    as `<account-id>@users.estantedecifras.app` instead of the device-local
    id. The account id comes from the sign-in reply and the attach, and is
    kept in the Worker's `meta` store. On sign-in, the saves not yet pushed
    that carry the local id are re-authored (the commit chain in local books
    is rewritten from the first local-authored commit). Sign-out reverts to
    the local id. `AppShell`'s `LOCAL_IDENTITY` is retired.
  - Governing documents: DIRECTION §3.3 :165-171, workflow 6 (*you* in
    history), `sign_in.md` Decision 6, and `sign_out.md:359-363`.
  - Tests it lands with:
    - unit: the re-author of a mixed local and foreign chain;
    - behavior: Worker, a local book's pre-sign-in saves re-authored and
      hosted pushes authored by the account; sign-out reverts;
    - e2e-web: a song saved before sign-in shows as *you* in history after
      signing in and putting the book online; axe.

## Decisions

1. **The Worker fetches the home book, triggered by `onSignedIn` and once per
   start.**
   - *Chosen:* a Worker command, `ATTACH_HOME`. It calls `GET
     /api/account/home-book` the way `books-client.js` calls the books API
     (the cookie flows, same origin), and it is idempotent on an attached
     home book.
   - *Why:*
     - the Worker owns git and the home book (DIRECTION §3.7);
     - one command serves both the fresh sign-in and the restart that
       interrupted an attach;
     - a 401 is the cheapest possible "not signed in".
   - *Rejected:*
     - The main thread fetching the URL and passing it in: it splits one step
       across two threads for no gain.
     - Attaching on every sync pass: a 401 round-trip on every trigger for a
       device that never signs in.
2. **The service id is stored as `remote.origin.estanteid` in the home book's
   git config.**
   - *Why:*
     - The local id `'home'` stays the directory name every other module
       knows (`HOME_BOOK_ID`).
     - The service id lives exactly as long as the remote: `online.detach`
       on sign-out removes the whole `[remote "origin"]` section, and the id
       with it, with no new teardown code.
   - *Rejected:*
     - Renaming `/books/home` to the service id, which is what `PUT_ONLINE`
       does for a songbook: `HOME_BOOK_ID` is used throughout `logic.js`,
       and a home book with two possible names is a trap.
     - A `meta`-store field: it would need its own removal on sign-out, and
       it could outlive the remote.
3. **Cold-reload re-detection is the start-time attach, and nothing else.**
   - Every behavior here keys on either "the home book has an origin" (fill,
     change check) or the Worker's start (attach when unattached). So a
     signed-in device that reloads resumes, and a signed-out one does
     nothing.
   - No signed-in flag is persisted. This keeps `sign_in` Decision 6's "the
     session cookie is the source of truth".
   - The account id needed for authorship is `account.commit_author`'s
     (Decision 8).
4. **Two additions to `shelf.json`, written as a delta to
   `docs/home-book-format.md` §4.2 and §7 in this task's commit.**
   - The additions:
     - `devices: { "<device-id>": { "kind": register } }`: a map keyed by
       device id, the namespace-key position §2.3 already allows, like
       `local`.
     - `mySongs`: a top-level register whose value is the hosted book id of
       the account's *My songs*.
   - *Why:*
     - Workflow 13 and the board name the device (*your iPhone*), but
       nothing in the home book records what a device is: §4.2's `local`
       carries only a UUID namespace.
     - Nothing records which hosted book is the account's *My songs* either,
       and labels are user-editable and in the user's language, so they
       cannot identify it.
     - The hook validates the §3 envelope and the seven file names
       (`service/internal/hook/home_book.go:84`, §8), not the keys inside
       `shelf.json`. So both additions pass it unchanged, and the
       implementer confirms this with the e2e push. No hook or API change
       follows.
   - *Rejected:*
     - Generic copy, *Only on another device*: it contradicts workflow 13 and
       the board.
     - Using the session roster's `device` label from the service (*Chrome on
       Android*): sessions are not tied to a device id, and the app and the
       service share no code.
     - Matching *My songs* by its label.
   - The format document is not in the refinement writer's file scope, so
     the implementer writes the §4.2/§7 text (the two keys, their meaning,
     and that `kind` is one of the Decision 5 tokens) in the same commit.
     The behavior and e2e tests above pin it.
5. **The device kind is a token, rendered in the reader's language.**
   - The tokens: `iphone`, `ipad`, `android-phone`, `android-tablet`, `mac`,
     `windows`, `linux`, `chromebook`, `other`.
   - Each is written by the device itself at attach, and refreshed if it has
     changed.
   - *Why:* each device reads the copy in its own language (*your iPhone* /
     *seu iPhone*). A token cannot leak a user agent string or a
     user-chosen name into a synced file.
   - *Rejected:* storing localized text, which would show in the writer's
     language on every reader.
6. **The fill clones into existing shelf entries without rewriting them.**
   - On a new device the `shelf.books` registers already exist, so the
     opposite of `add_by_link` Decision 4 (which writes the registers once a
     clone lands) applies.
   - The fill calls `cloneHosted` and indexes, but does not call the part of
     `cloneOntoShelf` that writes registers. That part would bump every
     register's `at`, and the next sync would then make this device the
     latest writer of labels it never changed.
   - Clones run **one at a time**, in shelf order (workflow 13: "Books come in
     the shelf list's order"; a shelf is a handful of small books). Parallel
     clones would compete for the same connection and finish later for the
     first book.
7. **Merge reuses the workflow 7 upload path over a zip of *My songs*.**
   - Workflow 13 says it in so many words: "the upload preview, unrelated
     histories and all (workflow 7)". `book-zip.js` makes the bytes
     *Download* makes, and `upload.js` already previews and merges them,
     history included, with the working tree synthesized as a commit.
   - No new merge code is written, and the canonical-form gate is the
     existing one.
   - *Rejected:* fetching *My songs*' objects straight into the target and
     merging through `mergeInto`. It is a second path to the same preview,
     with its own edge cases.
   - `shelf.mySongs` is written by `PUT_ONLINE` of `MY_SONGS_ID`, the one
     moment a *My songs* becomes the account's. If two devices each put
     theirs online, the later write wins, and the other stays a hosted book
     on the shelf under its label. This is acceptable, and the merge offer
     then concerns only the named one.
8. **The commit-author switch is split out to `account.commit_author`.**
   - `sign_in` Decision 6 handed "the author switch and the cold-reload
     re-detection" here. This task takes the re-detection (Decision 3) and
     defers the author switch.
   - *Why:*
     - Re-authoring the saves not yet pushed is a history rewrite across
       every local book, with its own reversal on sign-out
       (`sign_out.md:359-363`).
     - It is unrelated to what comes down to a new device, and it does not
       fit the three days alongside the fill and the *My songs* merge.
     - Nothing here depends on it: home syncs and fill clones author with
       the device id as they do today (`resolveSyncAuthor`, `logic.js:784`).
   - It is registered as a concrete leaf with its own tests, not as a
     revisit.
9. **The restore notice shows only when the account's settings came down.**
   - `restored` means `origin/main` existed before the attach. A first
     device pushing into an empty home book has restored nothing, and
     saying so would be false.
   - The notice lives on the shelf, as on the board, and not as a modal: the
     shelf is already filling behind it.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- Worker attach: `ATTACH_HOME`, restore notice, `estanteid` change check and device kind in `app/src/worker/logic.js`, `protocol.js`, `reducer.js`, `home-book.js`, `sync-engine.js`, `store.js`; new `app/src/worker/account-client.js`, `device-kind.js`.
- Shelf fill and `elsewhere` rows: `app/src/worker/shelf-fill.js`, `app/src/worker/shelf.js`; display copy in `app/src/books/book-display.js`, `BooksScreen.jsx`, `books.css`.
- My songs choice (merge or keep both): `app/src/worker/my-songs-choice.js`, `app/src/account/MySongsChoice.jsx`, `account.css`; wiring in `app/src/shell/AppShell.jsx`; strings in the four locales under `app/src/i18n/locales/`.
- Format delta (`devices`, `mySongs`) in `docs/home-book-format.md` and `docs/workflows/13-new-device.md`.
- Unit tests: `device-kind.test.js`, `shelf-fill.test.js`, `my-songs-choice.test.js`, `shelf.test.js`, `book-display.test.js`; behavior: `new-device.behavior.test.js`, `BooksScreen.behavior.test.jsx`, `MySongsChoice.behavior.test.jsx`.
- e2e-web: `e2e/web/tests/new-device.spec.js`, helpers in `e2e/web/lib/journeys-account.js`, `journeys.js`; `add-by-link.spec.js` adjusted.
- Deferred to the new leaf `account.commit_author` (Decision 8), wired into `milestones.m5_complete`.
