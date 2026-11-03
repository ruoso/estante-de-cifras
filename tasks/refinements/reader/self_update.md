# reader.self_update — The bundle and the QML update themselves

## TaskJuggler entry

[`tasks/85-reader.tji`](../../85-reader.tji), `task self_update` (in
`reader`, the reMarkable reader), around line 157.

## Effort estimate

2d.

## Repository

Not under `cifra.md/`. The work lands in:

- `remarkable/internal/update/` (new package): reading the served manifest,
  choosing what to fetch, downloading and checking it, staging it.
- `remarkable/internal/store/`: the update record and the QML's previous slot.
- `remarkable/internal/sync/`: the update check at the end of a pass, and an
  engine the syncer can be handed while it runs.
- `remarkable/internal/backend/`: switching the bundle on attach, rolling back
  a broken one, `updateReader` in `107 settings`.
- `remarkable/internal/protocol/messages.go`: `Settings.UpdateReader`.
- `remarkable/cmd/estante-reader/main.go`: opening the bundle with rollback at
  start, the app folder (`--app`) for `run` and `sync`.
- `remarkable/qml/browse/` (`SettingsScreen.qml`, `pages.js`): the *Update the
  reader on your reMarkable* line.
- `e2e/api/reader-update.test.js` (new) and `e2e/api/lib/reader.js` if a helper
  is needed.

Design delta, in this task: `docs/remarkable-reader.md` §6 (the `107` row) and
§8 (the self-update bullet's sub-points), `docs/workflows/19-remarkable-reader.md`
§The shelf (the settings page's *This reader* part). Both are already edited in
the working tree and ride in the closer's commit.

## Inherited dependencies

- `reader.payload` (complete 100, settled) — the site serves
  `/device/manifest.json` (`{version, hostApi, salt, bundle, qml, backend,
  folder}`, `remarkable/tools/payload/payload.go` L55–69), the content-hashed
  files immutable, the manifest revalidated, an unknown `/device/` path a 404.
  The manifest is a superset of `engine.Manifest`, so it is kept in the
  bundle slot as it is (payload.md Inherited dependencies; Decision 9).
  Downstream promise: "`reader.self_update` reads `/device/manifest.json` and
  fetches what it names."
- `reader.sync` (complete 100, settled) — `sync.Syncer` (`sync.go` L127–153),
  `Pass`/`run` (L299–486), `Run`/`Trigger` (`schedule.go` L25–58): a pass at
  start, on attach, on *Sync now*, every fifteen minutes online. "Runs at
  sync" means at the end of this pass.
- Settled further back and relied on: `reader.store` (the bundle slots
  `current`/`previous`/`next`, `StageBundle`, `PromoteBundle`,
  `RollbackBundle`, `DropStaged`, crash recovery in `Open`; Sign out keeps the
  slots — store.md Decision 6; the QML is this task's to place — Decision 7),
  `reader.engine` (`engine.Open` with one sentinel per refusal: `ErrManifest`,
  `ErrBundleMissing`, `ErrChecksum`, `ErrHostAPI`, `ErrNoHost`, `ErrSalt`,
  `ErrEvaluate` — engine.go L55–72, "so `reader.self_update` can keep the last
  good bundle"), `reader.app_folder` (AppLoad registers
  `<folder>/resources.rcc`; the backend's working directory is the folder),
  `reader.backend_views` (`107 settings` `{account, version, hiddenShapes}`),
  `reader.pairing` (the e2e-api `pairReader` helper), `reader.install`
  (INSTALL.md step 6 promises what this task delivers).

## What this task is

At the end of every sync pass the backend reads `/device/manifest.json` from
the session's origin. If it names a bundle or a QML (`resources.rcc`) the
reader does not have, under a `hostApi` the backend speaks, the backend
downloads it, checks its SHA-256 and keeps it beside the last good one. The
bundle is switched to on the next frontend attach — promoted, opened, the
instrument loaded in it, handed to the views, the shape filler and the syncer —
and rolled back to the one it was running if it does not open. A reader with no
bundle at all (just installed) switches at the end of the pass. The QML
replaces the AppLoad folder's `resources.rcc` in one rename, read by AppLoad on
the next launch. A served `hostApi` newer than the backend's fetches nothing,
and the settings say *Update the reader on your reMarkable*. The backend binary
is never replaced.

## Why it needs to be done

Without it, no device ever has a bundle. `install.sh` installs the AppLoad
folder only and never writes the store (install.md Decision 1). `run` opens
`bundle/current` or runs with no engine (`main.go` L425–436), so a freshly
installed reader can show the shelf and books but no song. This task is how
the music code arrives at all, and how a change to the app's music or the
reader's screens reaches a device without a reinstall (design §4: "A change to
the app's music reaches the reader by rebuilding the bundle"). INSTALL.md step 6
(L286–287) and design §2.1 step 6 (L134–137) already promise it. It is one of
the last leaves of the reader milestone (`tasks/99-milestones.tji` L60).

## Inputs / context

- `docs/remarkable-reader.md` §8 Updates (the manifest; the bundle and QML
  bullet; the backend bullet: never replaced unsigned, *Update the reader on
  your reMarkable*). This task adds its sub-points (design delta). §10 says
  the bundle and QML are checked by hash against a manifest fetched over
  HTTPS, and the backend binary is never replaced unsigned. §6 has the
  `107 settings` row (delta: `updateReader`). §3.1 says the backend runs with
  the app folder as its working directory, and §5.3 says when a pass runs.
- `docs/workflows/19-remarkable-reader.md` §The shelf, the settings page
  (L170–181). *This reader*, *Version 0.1.0* gains the update line (delta).
- `remarkable/internal/engine/engine.go` — `HostAPI = 1` (L47), `Manifest`
  (L98–106), `Open` (L274–312), `evaluate` (L368–403), `Close` (L809–818,
  idempotent), `Load` (L685).
- `remarkable/internal/store/bundle.go` — slots (L12–16), `BundleDir` (L27),
  `StageBundle` (L37–77), `PromoteBundle` (L81), `RollbackBundle` (L108),
  `DropStaged` (L127), `recoverBundle` (L159). `store.go` — `writeAtomic`
  (L251–280), the `writeData`/`renameFile` seams (L241–244), `SignOut` keeping
  `bundle/` (L149–152).
- `remarkable/internal/sync/sync.go` — `Engine` (L85–88), `Options`
  (L101–110), `eng` and `loadDigest` fixed at `New` (L129, L139, L158),
  `run` (L348–486, the snapshot L478–481), `loadInstrument` (L607–635).
  `api.go` — `call` (L61–98, JSON only, with the cookie). `fakeservice_test.go`
  — `startFake` (L86–138), and the cleanup that fails a request without the
  cookie (L132–134).
- `remarkable/internal/backend/backend.go` — `Deps.Engine` (L43–67), `Serve`
  (L187–300: the filler built once, L210–219; `Attached`/`Sync` → `Trigger`,
  L283–298). `views.go` — `eng` (L64–65), `settings()` (L314–316).
  `backend_test.go` — `peer`, `serve`, `fakeSyncer`. `qmlfixtures_test.go` —
  `-update-qml-fixtures`, `browse-settings` (L261).
- `remarkable/internal/protocol/messages.go` — `Settings` (L302–306).
- `remarkable/cmd/estante-reader/main.go` — `version` (L46–47), the bare
  socket path read as `run` (L93–97), `runFlags` (L394–406), `runCommand`
  (L415–455), `syncCommand` (L362).
- `remarkable/tools/appfolder/appfolder.go` — `theManifest()` (`id`
  `estante`, L40–50). This is what the backend checks before writing into a
  folder.
- `remarkable/tools/payload/payload.go` — the manifest struct (L55–69), file
  naming `hashed` (L154–156), and the check that the armv7 and arm64 rcc are
  identical (L144–146).
- `remarkable/qml/browse/SettingsScreen.qml` (`show` L54–64, *This reader*
  L173–179), `remarkable/qml/browse/pages.js` (copy L14–41, `versionLine`
  L279–281), `remarkable/qml/tests/tst_browse_screens.qml` (`test_settings`
  L351).
- `e2e/api/reader-pairing.test.js`, `e2e/api/reader-sync.test.js`,
  `e2e/api/lib/reader.js` (`pairReader`), `e2e/api/device.test.js` (the
  served payload).
- Predecessor refinements: `tasks/refinements/reader/payload.md`, `sync.md`,
  `store.md`, `engine.md`, `app_folder.md`, `install.md`, `backend_views.md`.

## Constraints / requirements

1. **Nothing the person sees changes by itself** (workflow 19 rule 5). A
   bundle is switched only on a frontend attach (`-2`), before that frontend's
   `hello` and `open`s are answered, or when no engine is loaded at all.
   Switching never redraws the screen. The QML is read only by AppLoad's next
   load.
2. **The `hostApi` gate covers both** (design delta §8). Fetch a bundle or QML
   only when `manifest.hostApi == engine.HostAPI`. When the served one is
   greater, fetch neither and set *too old*. When it is smaller, fetch neither
   and say nothing.
3. **What to fetch is a pure choice**, `update.Plan(m Manifest, have Have)
   Plan`. `Have` holds the SHA-256 of the current bundle, the staged one, the
   app folder's `resources.rcc` and the refused bundles, plus the backend's
   `HostAPI`. `Plan` holds `Bundle`, `QML` and `TooOld`. A bundle is fetched
   when its SHA-256 is none of current, staged and refused. A QML is fetched
   when its SHA-256 differs from the folder's file, and only when an app
   folder is known.
4. **Names and sizes are checked before a byte is fetched.** A manifest path
   must be a local name (`filepath.IsLocal`, no separator) of the form
   `bundle.<8hex>.js` / `resources.<8hex>.rcc`, whose eight hex digits begin
   its `sha256`. Anything else refuses that file (`update.ErrManifest`).
   Bodies are read through a limit: the manifest at most 64 KiB, a bundle or
   rcc at most 32 MiB. Over the limit is refused. Only a 200 is accepted.
5. **The hash is checked before anything is kept.** A body whose SHA-256 is
   not the manifest's is refused (`update.ErrChecksum`) and nothing is staged
   or placed. A bad hash does not mark the bundle refused; it is fetched again
   at the next pass.
6. **From the session's origin, without the session.** Requests are
   `GET <origin>/device/<name>`, with `sync`'s HTTP client, the origin being
   `Session.Origin`. They carry no `estante_session` cookie: `/device/` is
   public, and the cookie only goes where it is needed (sync.md, design §10).
   No redirect is followed off the origin (`sameOrigin`, `git.go` L59).
7. **An update never changes what the pass reports.** The check runs after
   the books and the snapshot (`sync.go` after L481), only on a pass that got
   that far. Its error changes neither the `Status` nor `lastSync`, and its
   pass is not an offline one. It runs inside the pass's timeout.
8. **Staging the bundle**: `StageBundle({"manifest.json": served manifest
   bytes as they are, bundle.<8>.js: bytes})`. A newer staged one replaces an
   older staged one.
9. **Switching the bundle** (`backend`, on `Attached`, and at the end of a
   pass when no engine is loaded). The steps are `PromoteBundle`, then
   `engine.Open(current)`, then loading the instrument in use from disk on the
   new engine. If any step fails, `RollbackBundle`, `RefuseBundle(sha)`, and
   keep the engine that was running, or reopen the restored current at start.
   If all succeed, the views, the filler and the syncer are handed the new
   engine, and the old one is closed once none of them holds it. A call
   racing the swap that gets `engine.ErrClosed` is retried on the new engine,
   never reported as a pass or view error. The views and the filler are
   swapped on the `Serve` goroutine. The syncer gets `UseEngine(ctx, eng)
   error`, which loads the instrument and resets `loadDigest` under its lock.
10. **At start** (`runCommand`), a `bundle/current` that does not open is
    rolled back and refused, repeatedly, until one opens or there is no
    previous. Then the engine is nil, as today.
11. **The refused and too-old record** lives in the store, `bundle/update.json`
    (`{servedHostApi, refused: [sha256…]}`, at most 16 refused, the oldest
    dropped), written by `writeAtomic` with mode 0600. Sign out keeps it, as it
    keeps the slots. The methods are `RefuseBundle`, `Refused`,
    `SetServedHostAPI`, `ServedHostAPI`.
12. **Placing the QML** (`update`, at the check, any time). The app folder is
    `--app DIR`. `run` reached by AppLoad's bare socket path defaults it to
    the working directory; an explicit `run` or `sync` has none unless given.
    The folder is used only when its `manifest.json` has `id` `estante`. The
    steps are: the folder's current `resources.rcc` copied to the store's
    `qml/previous/resources.rcc`, then the new bytes written to a temporary
    file in the folder and renamed over `resources.rcc`, then the folder
    synced. A running frontend keeps the inode it registered.
13. **`107 settings` gains `updateReader`**: true when `ServedHostAPI() >
    engine.HostAPI`. The QML draws, in *This reader* under the version line,
    *Update the reader on your reMarkable* (`pages.js`
    `updateReader`), and nothing when it is false. Status is a word, never
    colour or an icon (one bit, workflow 19).
14. **Standing rules.** Standard library and the module's existing deps only,
    CGO-free, and the three cross-builds still pass. The packages log nothing.
    Errors name the role and step (`update: bundle: checksum`), never the
    origin's token. The backend binary (`backend/entry`) and the folder's
    `manifest.json` are never written. Every `go` command in the gate uses
    `-p "$JOBS"`.

## Acceptance criteria

### Behavior delivered

- A paired reader with no bundle, after its first sync, opens a song: the
  served bundle has been fetched, its hash checked, staged and switched to.
- A new bundle on the site reaches a running reader at the next pass. It is
  used from the next attach, and the open song is never redrawn by it.
- A bundle that throws on evaluation, or in which the instrument does not
  load, is rolled back. The reader goes on with the last good one and never
  fetches that bundle again.
- A new QML replaces the folder's `resources.rcc`, and the one it replaced is
  kept in `qml/previous/`.
- A site serving a newer `hostApi` changes nothing on the reader except the
  settings line *Update the reader on your reMarkable*, kept across restarts
  and offline.

### Tests, by level

**unit (go test, `remarkable/internal/update/plan_test.go`)** — `TestPlan`,
table-driven (constraint 3, design §8):
- a new bundle under the same `hostApi` is fetched;
- one equal to current, to staged or to a refused SHA-256 is not;
- a new QML is fetched, but not without an app folder and not when equal to
  the folder's;
- *a hostApi too new refused*: `hostApi` `HostAPI+1` fetches neither, `TooOld`;
- `hostApi` `HostAPI-1` fetches neither, not `TooOld`;
- a path not local, not of the hashed form, or whose digits disagree with its
  `sha256` refuses that file (`ErrManifest`).

**unit (go test, `remarkable/internal/update/fetch_test.go`)**, against an
`httptest` server (constraints 4–6):
- *a bad hash refused*: a body one byte off is `ErrChecksum`, and `bundle/next`
  and the folder are untouched;
- a body over the limit, a 404, and a manifest that is not JSON are refused;
- no `/device/` request carries the session cookie;
- a redirect to another host is not followed.

**unit (go test, `remarkable/internal/store/update_test.go`)**:
- `RefuseBundle`, `Refused`, `SetServedHostAPI` and `ServedHostAPI` survive a
  re-`Open` and Sign out, and are kept at 16, the oldest dropped;
- `update.json` is mode 0600 (constraint 11).

**behavior (go test, `remarkable/internal/update/update_test.go`)**, an
`httptest` site serving `/device/manifest.json` and its files, the store under
`t.TempDir()`, an app folder stand-in with `id` `estante`:
- *an update fetched*: `Check` stages the bundle (`bundle/next` holds the
  served manifest byte for byte and the bundle) and places the rcc (the
  folder's `resources.rcc` is the served bytes, `qml/previous/resources.rcc`
  the old ones). A second `Check` requests the manifest only;
- a folder whose `manifest.json` is not `estante`'s is never written;
- too new: nothing staged or placed, `ServedHostAPI` recorded (design §8).

**behavior (go test, `remarkable/internal/sync/sync_test.go`)**, the fake
service also serving `/device/` (constraint 7):
- a pass stages the served bundle after the books are fetched;
- a `/device/` that fails (500, bad hash) leaves the pass's `Status` and
  `lastSync` as without it.
- The fake's cleanup exempts `/device/` from the cookie rule and fails on a
  `/device/` request that carries the cookie.

**behavior (go test, `remarkable/internal/backend/update_test.go`)**, through
the socket `peer` with the built bundle (`app/dist/device`; fails, never
skips — engine.md Decision 8). A second good bundle is the built one with a
trailing comment and its SHA-256 recomputed. A broken one is `throw new
Error("broken")` under a manifest carrying its hash.
- *switched on attach*: with A current and B staged, a song opens on A. After
  `-2`, `bundle/current` is B, the song opens on B, and a `sheet` sent before
  the attach was not redrawn by the switch (no message between `-2` and the
  `state` that answers `hello`).
- *a broken bundle rolled back to the last good*: with A current and the
  broken one staged, after `-2` `bundle/current` is A again, a song opens, the
  broken SHA-256 is in `Refused`, and the next check (a stand-in site serving
  it) does not request its file.
- the instrument not loading in a staged bundle (a host whose `load` throws)
  is rolled back the same way;
- with no bundle loaded, a staged one is switched at the end of the pass
  without an attach;
- `107 settings` carries `updateReader: true` when `ServedHostAPI` is newer,
  false otherwise (design §6).

**unit (go test, `remarkable/cmd/estante-reader/main_test.go`)**:
- `runCommand` with a `bundle/current` that does not evaluate and a good
  previous starts with the previous one current and the bad one refused
  (constraint 10);
- the bare socket path's `--app` is the working directory (constraint 12).

**behavior (QML, `remarkable/qml/tests/tst_browse_screens.qml`)**:
- `test_settingsUpdateReader`: from a new golden fixture
  `browse-settings-update` (written by `qmlfixtures_test.go`), *This reader*
  shows *Version …* and under it *Update the reader on your reMarkable*,
  inside its part, one-bit;
- `test_settings`' fixture (`updateReader: false`) shows no such line
  (workflow 19 §The shelf).

**e2e-api (`e2e/api/reader-update.test.js`)**, vitest against the compose
stack, the built `ESTANTE_E2E_READER_BIN` —
`describe('the reader updates its bundle and QML from the site (reader.self_update)')`:
- *a paired reader's first sync brings the served bundle*: `pairReader`, then
  `sync --root R --app F` (F a stand-in folder with `id` `estante` and an old
  `resources.rcc`). Then `R/bundle/current/manifest.json` equals
  `GET /device/manifest.json` byte for byte, its bundle file's SHA-256 is the
  manifest's, `F/resources.rcc` is the served `qml` file, and
  `R/qml/previous/resources.rcc` the old one (design §8);
- a second `sync` fetches no file again: its `bundle/` is unchanged.

No e2e-web: the reader is not the web app (as for `reader.pairing`). The
switch-on-attach and rollback are pinned at the behavior level, through the
real socket protocol, since the stack cannot serve a broken bundle.

**Deferred work:** none. The backend's own signed self-update is not deferred
work of this task. The note and design §8 call it "a later decision", which
needs a human call on keys and signing; see Open questions.

## Decisions

1. **A new `internal/update` package, called by the syncer at the end of a
   pass.** The plan is pure and tested alone. Fetching and staging are a
   small seam (`Check(ctx, client, origin) (Result, error)`) that the syncer
   calls through an optional `Options.Update` (nil in tests that don't care).
   Rejected: folding it into `sync.run`. Sync is about books under a session,
   and the manifest is public, cookie-free and has its own refusals.
   Rejected: a separate timer. The note says "at sync", and §5.3's schedule
   already covers start, attach, *Sync now* and online ticks.
2. **One `hostApi` gates the bundle and the QML** (design delta §8). They come
   from one image; a QML expecting messages an old backend does not send is
   as broken as a bundle calling a host function it lacks. Rejected: a second
   `qmlApi` in the manifest. That is a new contract field for a case (a QML
   change with no backend change that breaks an old backend) the one number
   already covers by being bumped.
3. **Switch on attach by promote, open, load, else roll back**, using the
   store's slots as `reader.store` built them for this. The instrument's
   `Load` is part of "opens", since a bundle that evaluates but cannot load
   the instrument cannot draw a song. Rejected: opening `bundle/next` before
   promoting it. It works, but leaves `RollbackBundle` unused and start-time
   recovery of a crash mid-switch unaddressed. The promote/rollback path
   handles both.
4. **A refused bundle is remembered by SHA-256**, so the fifteen-minute pass
   does not download and roll back the same broken file forever. A bad hash
   in transit is not remembered, because it may be the network. Rejected:
   remembering nothing. That means 32 MiB at most every quarter hour on Wi-Fi
   for nothing.
5. **The first bundle switches at the end of the pass.** A just-paired reader
   is attached while it syncs, and "next attach" would mean it shows books but
   no song until the person leaves and reopens the app. With no engine,
   nothing on screen depends on one, so rule 5 holds. Rejected: always waiting
   for the attach, which strands the first use.
6. **The QML goes straight into the AppLoad folder by rename.** AppLoad reads
   `<folder>/resources.rcc` (app_folder.md), so that is the only place a QML
   can take effect. A rename leaves the registered resource of a running
   frontend on its old inode, and it is read anew when AppLoad next loads the
   app. Rejected: staging it in the store and placing it on a detach with no
   frontends left. The rename is already safe while one is attached, and it
   adds a moment, and a missed `-3`, to reason about. Rejected: a QML
   rollback. A broken QML cannot be seen from the backend (no `hello` is
   ambiguous with a slow launch); the served rcc is the one the gate loaded
   the way AppLoad does (design §9); and `qml/previous/` plus `install.sh`'s
   kept install are the recovery.
7. **The backend writes into a folder only when it is *Estante*'s**
   (`manifest.json` `id` `estante`) and only when told which one (`--app`, or
   AppLoad's working directory). A developer's `run` from the repository never
   overwrites a file.
8. **`/device/` fetched without the cookie.** It is public (install.sh and a
   browser download it without an account). The session goes only to the
   requests that need it. The fake service's cookie rule is narrowed to
   exempt it, and asserts the cookie is absent there.
9. **Too old is said from the served `hostApi`, kept in the store.** The
   settings line must hold offline and after a restart. Only *newer* is
   *too old*: an older served payload (a site rolled back) is fetched by
   neither and says nothing, because the backend's own bundle is still good
   and installing an older reader would be wrong advice. Rejected: comparing
   `backend[arch].version` with the running version. A different digest is
   not an older one, and it would nag after every site rebuild.
10. **`updateReader` is a field of `107 settings`, not of `101 state`.** Only
    the settings page shows it (workflow 19). The shelf's foot stays the sync
    line. Rejected: a new error word in `state`. It is not an error, and
    `state` drives the shelf's line.

## Open questions

(none — all decided)

The backend binary's signed self-update (an Ed25519 key built into the binary,
§8) is outside this task by its note. Choosing to build it, and holding the
signing key, is a human decision, not a WBS leaf.

## Status

**Done** — 2026-11-02.

- `remarkable/internal/update/` (`plan.go`, `fetch.go`, `update.go`, `switch.go`): the pure choice of what to fetch (`update.Plan` returns an `update.Choice`; bad file names in `Choice.Err`, wrapping `ErrManifest`), cookie-less fetch of `/device/manifest.json` with SHA-256 checks and size limits, staging in `bundle/next`, and the one-rename replacement of `resources.rcc` (old one to `qml/previous/`). The backend binary is never written.
- `remarkable/internal/store/update.go`: refused bundle hashes (16, oldest dropped) and the served `hostApi`, in a 0600 `update.json`, kept across restarts and sign out.
- `remarkable/internal/sync/{sync,schedule}.go`: the update check at the end of each pass; a failing `/device/` leaves the pass's status untouched. `sync` now runs without `--bundle`.
- `remarkable/internal/backend/update.go` (+ `backend.go`, `views.go`), `remarkable/internal/protocol/messages.go`: switch on the next frontend attach (or at pass end when none is loaded), rollback and refusal of a bundle that throws or whose instrument does not load; `107 settings` gains `updateReader`.
- `remarkable/cmd/estante-reader/main.go`: start-up rollback of a bad `bundle/current`; `--app` is the working directory. QML: `SettingsScreen.qml`, `pages.js` show *Update the reader on your reMarkable*.
- Tests: unit `update/plan_test.go`, `update/fetch_test.go`, `store/update_test.go`, `cmd/estante-reader/main_test.go`; behavior `update/update_test.go`, `sync/sync_test.go`, `backend/update_test.go`, QML `test_settingsUpdateReader`; e2e-api `e2e/api/reader-update.test.js`.
- Docs: `docs/remarkable-reader.md`, `docs/workflows/19-remarkable-reader.md`, `remarkable/README.md`.
- Behavior note: if the very first bundle fails to open there is nothing to roll back to; it stays in `bundle/current`, marked refused, and the reader shows no music until the site serves a good one.
