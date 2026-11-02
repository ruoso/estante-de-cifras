# reader.sync — Syncing the shelf, read-only

## TaskJuggler entry

`reader.sync` in [`tasks/85-reader.tji`](../../85-reader.tji) (the `task sync`
block inside `task reader`), a dependency of `milestones.m7_reader`
([`tasks/99-milestones.tji`](../../99-milestones.tji) L58–61), and of
`reader.pairing` and `reader.self_update`.

## Effort estimate

3d.

## Repository

Not under `cifra.md/`. The work lands in:

- `remarkable/internal/sync/` — new package: `sync.go` (the `Syncer`, one
  pass), `home.go` (reading the home book), `git.go` (go-git: clone, fetch,
  read at a commit, the cookie auth), `api.go` (`getHomeBook`, `changeCheck`),
  `schedule.go` (when a pass runs), `snapshot.go` (what the screens read), and
  their `_test.go` files beside them, with `fakeservice_test.go` (the local
  remote the behavior tests run against).
- `remarkable/internal/store/state.go` — one more piece of the reader's own
  state: the time of the last sync that finished (`LastSync`/`SetLastSync`),
  with its test in `state_test.go`.
- `remarkable/internal/engine/engine.go` — `Instrument(ctx, files)` beside
  `Load`, calling the bundle's new host call.
- `remarkable/cmd/estante-reader/main.go` — the `session` and `sync`
  subcommands (development by hand, and the e2e-api's driver).
- `remarkable/go.mod`, `go.sum` — go-git, the one new dependency.
- `app/src/device/` — the bundle's `instrument(files)` host call:
  `instrument.js` (the pure choice of entry and table) and `entry.js` (exposed
  on `globalThis.estante`), with `instrument.test.js` and `entry.test.js`.
- `e2e/api/reader-sync.test.js` and `e2e/api/lib/env.js` (`readerBin`).
- `scripts/gate` — exports `ESTANTE_E2E_READER_BIN` (the amd64 build it
  already makes) to the e2e-api step.
- Design delta, already written beside this refinement:
  `docs/remarkable-reader.md` §4 (the host API table gains `instrument(files)`)
  and §4.1 (which other salt's table the bundle chooses).

## Inherited dependencies

- `reader.store` — **settled** (`complete 100`): `store.Open`, `Session()`
  (`Origin`, `Token` the `estante_session` cookie's value), `HomeDir()`,
  `BookDir(id)` (refuses an unsafe id with `ErrBadID`), `BookIDs()` (ignores
  `.tmp-*`), `RemoveBook(id)`; atomic writes; nothing logged
  (`remarkable/internal/store/store.go` L100–147, `session.go` L15–23).
- `reader.engine` — **settled** (`complete 100`): `engine.Open(dir)`,
  `Load(ctx, entry, table)` (a no-op for the same JSON, engine.go L497–534),
  `Manifest().Salt`; the integration tests read the built bundle from
  `app/dist/device/` and never skip (engine.md Decision 8).
- `reader.module` — **settled**: `go vet`/`go test -p "$JOBS"`/three CGO-free
  cross-builds in `scripts/gate` L328–347; `TestModuleSharesNoCode`.
- Read for continuity (both **settled**): `reader.protocol` (`Sync` 4,
  `State` 101 with `syncing`, `online`, `lastSync`, `error` `offline` /
  `signedOut`, `Shelf` 103 — messages.go L99, L150–188) and `reader.bundle`
  (host API 1, `app/src/device/entry.js` L222–232).
- What the tests need, all present: a signed-in session through the passkey
  ceremony, `POST /api/books`, the git push and the home book's hook
  (`e2e/api/change-check.test.js` L29–52, `e2e/api/home-book.test.js` L27–45,
  L128–140); the change check (`service.change_check`). Pairing
  (`reader.device_pairing`, `reader.pairing`) is not needed: the note says
  "with a session (pasted in for development until pairing lands)", and the
  e2e-api pastes the passkey session's cookie.

## What this task is

The reader's sync: with the session in the store, it fetches the account's home
book and every book on its shelf into the store with go-git, and never pushes.
It reads the home book by its own format — the books and their order from
`shelf.json`, the instrument in use and its default-shape table from
`instruments.json`, `preferences.json`, `shapes.json` and
`shapes-default-cache.json` (through the bundle, so the music core decides),
and each song's saved transposition and variation from `songs.json` — and
loads the instrument into the engine. Each book is cloned the first time it is
seen; after that one change check for the whole shelf says which books moved,
and only those are fetched. A pass runs at backend start, when the frontend
attaches, on *Sync*, and every fifteen minutes while the device is on Wi-Fi.
What the screens read is an immutable snapshot, so a sync never changes the
song on screen; a book no longer shared leaves the next snapshot.

## Why it needs to be done

Without it the reader has nothing to read but a fixture. Downstream:
`reader.pairing` (the session it keeps is what sync uses; *Sign out*),
`reader.self_update` (runs "at sync"), `reader.browse_screens` (the shelf and a
book's songs come from the snapshot; the sync line from the status),
`reader.song_screen` and `reader.play` (a song's text, its saved transposition
and variation, the instrument loaded), `reader.missed_shapes` (the instrument
the misses are searched on).

## Inputs / context

- `docs/remarkable-reader.md`
  - §3.2 (L192–193): "**sync** (§5) — the session, the home book and the
    books, fetched with go-git into the store. Never a push."
  - §4 host API table and §4.1 default shapes (the slow reader may read
    another non-decommissioned salt's table) — with this task's delta.
  - §5.2 (L290–300): what comes down; a local-only book is never on the reader.
  - §5.3 (L302–308): one change check, a fetch only of what moved, the four
    moments; "A fetch never changes the song on screen".
  - §9 (L440, L442): sync logic unit-tested against fakes; "Integration
    (stack)" against the compose stack.
  - §10 (L452–459): HTTPS to the one origin only; no song text, title, label or
    shape in a log.
  - §12 step 3: "Sync, by hand … a session pasted in for development".
- `docs/workflows/19-remarkable-reader.md`: rule 5 (L36–40) background news
  never redraws; §The shelf (L134–144) the sync line — *Synced at 14:32*, *Not
  connected — showing what was synced at 09:10*, *Syncing…*; §When something
  has changed (L311–319): a changed song shows on the next open, a setlist
  being played keeps its version until Back, a book no longer shared leaves
  the shelf on its next opening "and a song open from it stays readable until
  Back".
- `docs/home-book-format.md`: §2.1 (absent file reads `{}`), §2.3 (song ref
  `<book-id>/<path>`, path NFC), §3 (registers, tombstones), §4.2 `shelf.json`
  (L253–356: `books.<id>.{label, link, position, role, owner}`, `local` never
  cloned), §4.3–§4.4 (opaque instruments and shapes), §4.5 `songs.json`
  (L398–419), §4.6 `shapes-default-cache.json` (L421–540: "Which salt a reader
  uses", L483–490; a table it cannot read is absent, L537–540).
- `api/openapi.yaml`: the session cookie `estante_session` (L925–932);
  `getHomeBook` (L399–422, `{id, gitUrl}`, made empty on first request);
  `changeCheck` (L559–588; `ShelfBookHead` `head` null when the device has
  nothing, L1414–1426; `ShelfBookChange` `changed|unchanged|gone`,
  L1439–1471); git smart HTTP `/git/{bookId}/…` (L800–920); the home book is
  not in the change check.
- The web app's twin, for behavior to match (not code to share):
  `app/src/worker/instruments.js` `surfaceInstruments` (L204–230) and
  `defaultShapesFor` (L122–126); `app/src/worker/shelf-fill.js` `fillQueue`
  (L43–66: a live `link`, ascending `position`, null last, ties by id);
  `app/src/worker/change-check-client.js` (L51–90); `app/src/core/shape-cache.js`
  (`SHAPE_CACHE_SALT` L28, `DECOMMISSIONED_SALTS` L35).
- `app/src/device/entry.js`: `sheet(text, offset, {variation, preferences})`
  takes the raw `preferences.json` map (`song-sheet.js` L98, L141–146) and a
  variation id — what sync hands the screens.
- Service: `gitURL` is `<PublicBaseURL>/git/<id>` (`service/internal/server/books.go`
  L101–103); `session.Resolve` reads only the cookie
  (`service/internal/session/session.go` L25, L128–151).

## Constraints / requirements

- **Never a push.** No code path in the package names `git-receive-pack` or
  calls go-git's `Push`; the behavior tests' fake service records every
  request and fails the test on any receive-pack request.
- **Read-only toward the account**: no API write. The only requests are
  `GET /api/account/home-book`, `POST /api/shelf/change-check` (a read, by
  the contract) and git upload-pack.
- **The session goes to the one origin only.** The cookie is set by a go-git
  `http.AuthMethod` whose `SetAuth` adds `Cookie: estante_session=<token>`;
  before any request the URL (the home book's `gitUrl`, a shelf `link`) must
  have exactly the session's `Origin` (scheme, host, port), else the book is
  skipped as `refused` and nothing is sent. The auth method's `String()` and
  every error carry no token.
- **No song text, title, label, link or shape in a log or an error.** The
  package logs nothing; errors name the book only by its id and the step
  (`clone`, `fetch`, `changeCheck`, `homeBook`).
- **Atomic clones.** A clone goes into `books/.tmp-clone-<id>` (or
  `.tmp-clone-home` in the root) and is renamed into place only when complete;
  stale `.tmp-clone-*` are removed at the start of a pass. A failed fetch
  leaves the previous clone and the previous head.
- **One pass at a time.** A trigger during a pass makes at most one more pass
  after it.
- **Offline first.** A pass that cannot reach the service changes nothing on
  disk and keeps the last snapshot; nothing the screens do waits on a pass.
- **No music in Go.** The instrument entry and the table are the bundle's
  (`instrument(files)`); Go reads `shelf.json` and `songs.json`, which the
  format defines and are not music.
- **go-git**, the current stable major (v5), pure Go: the three CGO-free
  cross-builds still pass. Full (not shallow) bare clones.
- Standing rules: shares no code with `service/` or `app/` (only the built
  bundle's bytes); test fixtures are songs written for the purpose.

## Acceptance criteria

### Behavior delivered

**The bundle** (`app/src/device/`):

- `instrument.js` exports `chooseInstrument(files, { salt, decommissioned })`,
  pure: `files` is `{ instruments, preferences, shapes, defaultShapes }`
  (parsed JSON, absent as `{}`). It surfaces the roster as
  `surfaceInstruments` does and takes the entry in use (`inUseId`, else the
  standard guitar), and picks its table: the register under `salt` when it is
  a well-formed table; else, of the other salts not in `decommissioned`, the
  well-formed tables whose fingerprint equals the instrument's
  (`createShapeCache` with that table reports the fingerprint), latest `at`
  first; else `null`. Answers `{ entry, table, salt }` (`salt` the one chosen,
  or null).
- `entry.js` adds `instrument(files)` to `globalThis.estante`, calling
  `chooseInstrument` with `SHAPE_CACHE_SALT` and `DECOMMISSIONED_SALTS`. Host
  API stays 1 (an additive call; no reader is installed yet, as `held()` was
  added).

**The engine**: `Instrument(ctx, files InstrumentFiles) (Instrument, error)` —
`InstrumentFiles` four `json.RawMessage`, `Instrument{ Entry, Table
json.RawMessage; Salt *string }`.

**The store**: `LastSync() (time.Time, bool)`, `SetLastSync(time.Time)
error`, in `state.json`, read back across a restart, cleared by `SignOut`.

**The sync** (`remarkable/internal/sync`):

- `New(st *store.Store, eng Engine, opts Options) *Syncer` — `Engine` is the
  interface `{ Instrument; Load }` the engine satisfies; `Options` carries the
  HTTP client, `Now`, `Online func() bool` (default: `/sys/class/net/wlan0/operstate`
  reads `up`), and `OnStatus func(Status)`.
- `Pass(ctx) (Result, error)`, one pass:
  1. no session → `ErrNotPaired`, nothing sent;
  2. `GET /api/account/home-book`; a 401 is `Status.Error = "signedOut"`
     (nothing removed — signing out is `reader.pairing`'s); a network failure
     is `"offline"`;
  3. the home book: cloned if absent, else fetched (it is not in the change
     check); an empty home book (no `main`) reads as every file `{}`;
  4. the home book read at `main` (`home.go`): the **shelf** — every
     `books.<id>` with a live `link` string, ascending live `position`, a book
     without one last, ties by id; `local`, tombstoned and link-less entries
     left out; each with `label`, `role`, `owner` when live; **songs** —
     `songs.json` per song ref (`transposition` an integer, `variation` per
     tuning, tombstones as absent, refs NFC); **preferences** — the
     `preferences.json` map, raw, for `sheet`; the **instrument** —
     `eng.Instrument` with the four files, then `eng.Load(entry, table)`;
  5. one `POST /api/shelf/change-check` with every shelf book and the head its
     clone has (`null` for none); a book with no clone, or reported `changed`
     with a head unlike its own, is cloned or fetched (`+refs/heads/main:refs/heads/main`);
     `gone` drops the book from the shelf; `unchanged` or absent, nothing;
     a book whose clone attempt finds an empty repository stays unfetched,
     `head` null, until a later check reports it changed;
  6. clones of books not on the new shelf (or `gone`) are removed with
     `store.RemoveBook` — unless held (below), then on the first pass after
     release;
  7. a new snapshot is published; `SetLastSync(now)`; `Status{Syncing:false,
     Online:true, LastSync}`.
  `Result` names, per book id and for the home book, `cloned`, `fetched`,
  `unchanged`, `gone`, `empty`, `refused` or `failed`, and the head — ids and
  hashes only.
- `Snapshot() *Snapshot` — immutable: `Shelf()`, `Songs(ref)` (transposition,
  variation), `Preferences()` raw, and `Book(id)` with `Head()`, `Paths()`
  (every blob path at its head) and `Read(path) ([]byte, error)` at that head.
  A later pass never changes what an earlier snapshot reads (the bare clone
  keeps the old objects; a fetch never prunes). `Hold(bookID) (release
  func())` keeps a book's clone on disk while a screen reads it (workflow 19:
  "a song open from it stays readable until Back").
- `Run(ctx)` and `Trigger()`: a pass at start, on each `Trigger()` (the
  backend calls it on attach and on `Sync`), and every fifteen minutes while
  `Online()`; at most one pass running and one pending. `OnStatus` is called
  with `Syncing:true` when a pass begins and with its outcome when it ends —
  the two changes of the shelf's sync line.

**The command**: `estante-reader session --root DIR --origin URL` reads the
token from stdin (never argv) and keeps it with `store.SetSession` (0600);
`estante-reader sync --root DIR --bundle DIR` runs one `Pass` and prints its
`Result` as JSON — ids, statuses and heads, nothing else.

### Tests it lands with

**unit (Vitest, `app/src/device/`)**

- `instrument.test.js` — `chooseInstrument`: the instrument named by
  `instrumentInUse`; absent or pointing at a removed instrument → the
  standard guitar; my shapes for that instrument in its entry (format §4.4);
  the own salt's table chosen over another's; own absent → another salt's
  table with a fitting fingerprint, the latest `at` first; a table of a
  fitting salt but another fingerprint skipped; a salt in the injected
  `decommissioned` list never chosen (format §4.6 "Which salt a reader
  uses"); a malformed table read as absent; nothing at all → `table: null`.
- `entry.test.js`, `describe('instrument (reader.sync)')` — the built entry
  answers `instrument(files)` with the example book's fixture table under
  `SHAPE_CACHE_SALT`, and plain JSON only (design §4 host API).

**unit (go test)**

- `remarkable/internal/sync/home_test.go`:
  `TestShelfOrder` (position ascending, none last, ties by id — `fillQueue`'s
  order, format §4.2); `TestShelfLeavesOutLocalTombstonedAndLinkless`
  (format §4.2, design §5.2); `TestSongsJSON` (transposition, variation per
  tuning, a tombstone absent, an NFD path found by its NFC ref — format §4.5,
  §2.3); `TestAbsentFilesReadAsEmpty` (format §2.1);
  `TestMalformedFilesTolerated` (a non-register, a non-integer transposition:
  absent, never a failure); `TestInstrumentFilesGoToTheEngine` (a fake
  `Engine` receives exactly the four files, absent as `{}`, and `Load` gets
  its answer — the home-book read of the note: instrument in use, my shapes,
  the cache table).
- `remarkable/internal/sync/git_test.go`: `TestAuthCarriesNoToken` (the auth
  method's `String()`, and a clone error, without the token — design §10);
  `TestOtherOriginRefused` (a `link` on another host, or `http` for an `https`
  origin: `refused`, no request made — design §10 "the one origin only").
- `remarkable/internal/sync/schedule_test.go` with an injected clock:
  `TestPassAtStartAndOnTrigger`; `TestEveryFifteenMinutesOnlyOnline` (design
  §5.3); `TestTriggersCoalesce` (three triggers during a pass → one more pass);
  `TestStatusAroundAPass` (`Syncing` true then false with `LastSync`; offline
  → `error: offline` and the previous `LastSync` — workflow 19 §The shelf).
- `remarkable/internal/store/state_test.go`: `TestLastSyncRoundTripsAcrossRestart`;
  `TestSignOutClearsTheDevice` extended to `LastSync`.
- `remarkable/cmd/estante-reader/main_test.go`: `TestSessionReadsTokenFromStdin`
  (session.json 0600, the token not in stdout/stderr); `TestSyncUsage`.

**integration (go test, the built bundle, as `internal/engine/bundle_test.go`)**

- `remarkable/internal/engine/instrument_test.go`: `TestInstrumentFromBuiltBundle`
  — the built `app/dist/device` bundle, with the example book's fixture table
  (`app/dist-test/device/`) placed in a `shapes-default-cache.json` under the
  bundle's salt, then under another salt only: both answer a table, `Load`
  holds its shapes and the example book's songs read with no misses; an empty
  cache answers `table: null` (design §4.1).

**behavior (go test, `remarkable/internal/sync/sync_test.go`)** — against
`fakeservice_test.go`: an `httptest` server serving bare repositories made by
the git CLI in `t.TempDir()` through `git http-backend` (`net/http/cgi`), plus
`/api/account/home-book` and `/api/shelf/change-check` computed from those
repositories' heads, recording every request; in `t.Cleanup` it fails the test
on any `git-receive-pack` request or any request without the cookie:

- `TestFirstPassClonesHomeAndShelf` — a home book listing two books; both
  cloned under `books/<id>`, the snapshot's shelf in order, a song read
  (design §5.2).
- `TestSecondPassFetchesOnlyWhatMoved` — one book pushed to by the git CLI;
  the next pass makes one change check and upload-pack requests for that book
  and the home book only; the other book's requests are none (design §5.3).
- `TestNeverPushes` — a pass after a clone was made dirty by hand: no
  receive-pack request (the fake's check), the remote's refs unchanged (design
  §3.2 "Never a push").
- `TestSnapshotKeepsItsVersion` — a snapshot taken, a new version pushed and
  synced: the old snapshot reads the old text, a new one the new (workflow 19
  §When something has changed; design §5.3).
- `TestGoneBookLeavesTheShelf` — change check `gone`: the next snapshot has no
  such book and its clone is removed; a held book's clone stays until
  released, then goes on the next pass (workflow 19 §When something has
  changed).
- `TestTombstonedShelfEntryLeaves` — the entry's `link` tombstoned in
  `shelf.json`: the book leaves and its clone goes (format §4.2).
- `TestEmptyBookWaits` — a book with no `main`: `empty`, no directory; once
  pushed, the next pass clones it.
- `TestEmptyHomeBook` — the home book with no `main`: an empty shelf, the
  standard guitar loaded.
- `TestOfflineChangesNothing` — the server closed: `offline`, the clones and
  the snapshot as before (DIRECTION offline first).
- `TestUnauthorizedIsSignedOut` — the fake answers 401: `signedOut`, nothing
  removed.
- `TestInterruptedCloneLeavesNoBook` — the fake cuts an upload-pack response
  mid-pack: no `books/<id>`, the temporary removed, the next pass clones.
- `TestInstrumentLoadedOnHomeChange` — with a fake `Engine`: a changed
  `preferences.json` gives one `Load`, an unchanged home book none.

**e2e-api (`e2e/api/reader-sync.test.js`, against the compose stack)** — an
account by the passkey ceremony; a book created (`POST /api/books`) and a song
written for the test pushed with the git CLI; the home book pushed with its
`README.md`, `.gitattributes` and a canonical `shelf.json` naming the book
(`link` its `gitUrl`); a second book created, pushed and listed too. The built
reader (`ESTANTE_E2E_READER_BIN`, failing fast like `env.js`'s other
variables) is given the cookie by `session` on stdin and runs `sync`:

- `the reader's first sync clones the shelf` — `Result` names both books
  `cloned` at their pushed heads, and `git --git-dir <root>/books/<id> show
  main:<file>` gives the pushed bytes (the note's "a book pushed by a web
  client appears on the reader after a sync").
- `a second sync fetches only the book that moved` — a new commit pushed to the
  first book; the next `sync` names it `fetched` at the new head and the
  other `unchanged` (design §5.3).

No e2e-web or QML level: this task draws nothing; the sync line and the shelf
are `reader.browse_screens`'s, against the status and snapshot delivered here.

Deferred work: none.

## Decisions

1. **The instrument and its table are chosen in the bundle (`instrument(files)`),
   not in Go.** Surfacing an instrument rebuilds its rules from presets
   (`resolveRules`, `configFor`) and the table's fit is a fingerprint the music
   core computes; doing it in Go would be a port of the music core, which the
   design forbids (§4 "No port of the music core"), and the decommissioned list
   lives beside the salt in the core. Rejected: carrying the list in the
   manifest and choosing in Go (still needs the fingerprint, so still a port).
   The host API stays 1: the call is additive and no reader is installed yet,
   as `held()` was added in `reader.engine`. Delta: `docs/remarkable-reader.md`
   §4, §4.1.
2. **Of another salt's tables, one whose fingerprint fits, the latest written
   first.** Format §4.6 allows another non-decommissioned salt's table when the
   own is absent; a table of another fingerprint would be read as absent by the
   cache anyway, so choosing one that fits is the only useful choice, and `at`
   is the only order the format gives.
3. **Bare clones read at a commit, behind an immutable snapshot.** A fetch
   moves `refs/heads/main` and adds objects; a snapshot keeps the heads it was
   made from, so the song on screen and a setlist being played keep their
   version (workflow 19 §When something has changed) by construction, with no
   working tree to update or lock. Rejected: working trees checked out after a
   fetch (a read could see a half-updated tree, and a dirty tree is a state the
   reader never needs).
4. **Removing a gone book waits for its holds.** Workflow 19 says a song open
   from such a book stays readable until Back; `Hold` makes that a rule the
   screens can keep without copying texts out. The shelf drops it at once — the
   shelf screen shows it only on its next opening (rule 5), which is
   `browse_screens`'s.
5. **The home book is fetched every pass; the books only when the change check
   says.** The contract's change check is over shelf books, and the home book
   is not one (openapi.yaml L470); its fetch with nothing new is one ref
   advertisement. `getHomeBook` is asked every pass too: one small read that
   also says whether the session still holds (401 → `signedOut`).
6. **Only the change check's `gone`, or the shelf, removes a book.** A fetch
   that fails (a 403, a 404, the network) keeps the previous clone and head and
   reports `failed`: a book the person can still read stays readable, and the
   next change check says what happened. The reader does not put back books the
   account has that `shelf.json` does not list (workflow 13 §What comes down):
   that writes the shelf, and the reader writes nothing (design §5.4).
7. **The cookie through a go-git `AuthMethod`, the origin checked first.** It
   is the only credential the service reads (`session.Resolve`); setting it per
   request, only after the URL's origin equals the session's, keeps it off any
   other host (design §10). Go's client already drops `Cookie` on a redirect to
   another host.
8. **Full clones, not shallow.** Books are text and small; go-git's shallow
   fetches have a history of failing on later fetches. The reader reads heads
   only, but a full clone costs little on the device and nothing in
   correctness.
9. **The behavior level's remote is `git http-backend` behind `httptest`,** not
   the compose stack: the gate runs `remarkable/`'s tests before the stack is
   up, and the note asks for "a local git remote"; real git serving the real
   smart HTTP protocol, with the two API calls faked from the repositories'
   heads, lets the fake count every request (fetch only what moved, never a
   push). The stack is the e2e-api level's.
10. **The e2e-api drives the built binary from `e2e/api`,** not a Go test with
    the stack's URL (design §9's "Integration (stack)" row): one e2e harness
    (foundation.e2e_api), and the binary the gate already builds, passed in by
    `ESTANTE_E2E_READER_BIN`. The cookie of a passkey session stands in for the
    paired session until `reader.pairing`, whose e2e-api also runs the read-only
    refusal.
11. **The token is pasted on stdin.** A token on the command line is visible to
    every process on the device (`ps`); stdin is not.
12. **`LastSync` is kept in the store's state.** The shelf says *Not connected —
    showing what was synced at 09:10* after a restart too; the store is the
    reader's one place on disk, so the field joins `state.json` rather than a
    file of its own.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-01.

- Bundle: `app/src/device/instrument.js` (`chooseInstrument`, with `instrument.test.js`) and `instrument(files)` added to `app/src/device/entry.js` (host API stays 1; tested in `entry.test.js`).
- Engine: `Instrument(ctx, files)` in `remarkable/internal/engine/engine.go`; `engine/instrument_test.go` checks it against the built bundle.
- Store: `LastSync`/`SetLastSync` in `remarkable/internal/store/state.go`, cleared by `SignOut` (tests in `state_test.go`, `store_test.go`).
- Sync: `remarkable/internal/sync/{sync,home,git,api,schedule,snapshot}.go` — go-git v5.19.3 fetch through upload-pack only, never a push; the cookie goes only to the session's origin; atomic clones; immutable snapshots with `Hold`; a pass at start, on each trigger and every 15 minutes online. Tests: `home_test.go`, `git_test.go`, `schedule_test.go`, `sync_test.go` against `fakeservice_test.go` (`git http-backend`).
- Commands: `session` (token on stdin) and `sync` in `remarkable/cmd/estante-reader/main.go`; `remarkable/README.md` updated.
- e2e-api: `e2e/api/reader-sync.test.js` (two cases), `e2e/api/lib/env.js`; `scripts/gate` passes the reader's amd64 build to e2e-api.
- Tech debt: none.

