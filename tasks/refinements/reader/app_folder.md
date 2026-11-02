# reader.app_folder — The AppLoad app: its folder, and its QML root

## TaskJuggler entry

`tasks/85-reader.tji` L54–59, `task app_folder` under `task reader` →
`reader.app_folder`. Milestone: `milestones.m7_reader`
(`tasks/99-milestones.tji` L58–61).

## Effort estimate

1d.

## Repository

Not under `cifra.md/` (the note does not start with `cifra.md:`). The work
lands in:

- `remarkable/internal/backend/`: a new package holding the backend's message
  loop (`backend.go`, `backend_test.go`).
- `remarkable/cmd/estante-reader/`: `main.go` gains the `run` case and the
  bare-socket-path case, and `main_test.go` its tests.
- `remarkable/tools/appfolder/`: a new build tool (`main.go`, `appfolder.go`,
  `appfolder_test.go`, `icon.png`) that assembles one AppLoad folder per
  architecture. It sits outside `cmd/`, so the gate's cross-build of
  `./cmd/...` does not ship it.
- `remarkable/qml/`: `Main.qml` (the root) and `status.js` (the root's one
  line of state, as a pure function).
- `remarkable/qml/tests/`: `tst_main.qml` (behavior) and `check_folder.py`
  (the built folder, loaded the way AppLoad loads it).
- `scripts/gate`: the reader block gains the folder build and its check.
- `remarkable/README.md`: how to build a folder and install it by hand.
- `docs/remarkable-reader.md`: §3.1 and §9, the design delta this refinement
  makes (below). It rides in the task's commit.

## Inherited dependencies

- `reader.engine` (complete 100, settled): `engine.Open(dir)` over a bundle
  directory, its `Close()`, and the `sync.Engine` it satisfies.
- `reader.protocol` (complete 100, settled): `protocol.Dial(path)`,
  `NewConn(*net.UnixConn)`, `(*Conn).Next()` (which skips unknown types),
  `Write(Message)` and `Close()`. It also provides the system messages
  `Terminate`, `Attached` and `Detached`, `Hello`, `Sync`, and the `State`
  payload (`messages.go` L159–166). protocol.md L24–25 hands "running as
  `backend/entry` and answering `hello`" to this task.
- `reader.qml_harness` (complete 100, settled): the venv-pinned Qt 6.12
  (PySide6-Essentials, which carries `pyside6-rcc`), `run.py`, and the AppLoad
  stand-in at `remarkable/qml/tests/appload/net/asivery/AppLoad/AppLoad.qml`
  (it records `sent`, offers `play(type, payload)` and `terminated`, and
  emits `messageSent`). qml_harness.md L174–176 makes keeping the stand-in out
  of `resources.rcc` this task's concern.
- `reader.store` (complete 100; not a `depends`, reached through `engine` and
  `sync`): `store.Open(root)`, `DefaultRoot`, `Session()`, `LastSync()`,
  `ShapesShown()`, and `BundleDir()`.
- `reader.sync` (complete 100; not a `depends`, context): `sync.New(st, eng,
  Options{OnStatus})`, `(*Syncer).Run(ctx)` and `Trigger()`. sync.md L243–247
  says "the backend calls it on attach and on `Sync`". Nothing calls it yet;
  this task wires it.
- Downstream: `reader.qml_chart` (depends on this task), then `song_screen`
  and `browse_screens`, which grow inside this root. `reader.payload` builds
  the same folder in the Dockerfile. `reader.install` copies it to the device.

## What this task is

This task makes the reader an AppLoad app that can be installed and opened.
It has three parts:

- **The backend.** `estante-reader`, run by AppLoad as `backend/entry
  /tmp/estante.sock`, dials the socket. It starts the sync schedule. It
  answers each `hello` with a `state` and sends a fresh `state` whenever the
  sync status changes. It triggers a sync when a frontend attaches or `sync`
  arrives, and exits on `terminate` or when the socket closes.
- **The QML root.** `Main.qml` is the file AppLoad loads. It holds the
  `AppLoad` endpoint (`applicationID` `estante`), the `close` signal and the
  `unloading()` function AppLoad requires. It sends `hello` when created, and
  draws the one line of state it is sent.
- **The folder build.** `tools/appfolder` turns a built backend and
  `remarkable/qml/` into `estante/{manifest.json, icon.png, resources.rcc,
  backend/entry}` for armv7 or arm64. The gate builds both folders and loads
  each `resources.rcc` the way AppLoad does.

Screens are not part of this task. What `open` computes is not part of it
either.

## Why it needs to be done

Every later reader task draws inside this root and talks to this backend. It
is step 2 of the design's order of work (docs/remarkable-reader.md §12,
"the AppLoad app — its folder, its QML root talking to the backend").

`reader.qml_chart` depends on it directly. `reader.payload` and
`reader.install` ship the folder it defines.

Until this task lands, the backend's parts (protocol, store, sync, engine) do
not run together in any process, and nothing could be put on a device.

## Inputs / context

- `tasks/85-reader.tji` L54–59: the note.
- `docs/remarkable-reader.md`:
  - §2 (L33–55): the folder's four entries. AppLoad starts the backend when
    the app first opens and leaves it running until the app calls
    `terminate()`.
  - §2.1 step 4 and step 7 (L101–150): the folder copied to
    `/home/root/xovi/exthome/appload/estante/`, and "the folder for the wrong
    architecture, or `backend/entry` not executable".
  - §3 / §3.1–§3.3 (L155–213): the four backend parts, and a frontend that
    "draws what the backend sends … keeps no state the backend would need".
    §3.1 also carries this task's delta.
  - §5.3 (L313–320): sync at backend start, on attach, on *Sync now*, and
    every fifteen minutes.
  - §6 (L330–382): `1 hello` "the backend answers with `state`" and
    `101 state` `{ paired, syncing, online, lastSync, shapesShown, error? }`;
    `error` is a word code.
  - §9 (L446–464): the gate's reader checks. This task's delta is here too.
- `docs/workflows/19-remarkable-reader.md`:
  - §The refresh budget, rule 1 (no intermediate state) and rule 2 (time
    written as a time, *Synced at 14:32*).
  - §The screen: portrait 1404 × 1872.
  - §The shelf, the sync line copy: *Synced at 14:32*, *Not connected —
    showing what was synced at 09:10*, *Syncing…*.
  - §Pairing, *Not paired*.
- rm-appload at df974a6 (2026-10-06, the revision the design cites; a
  checkout was read for this refinement):
  - `README.MD` §Applications' format: the folder layout, the root's `signal
    close` and `function unloading()`, and the manifest's `id`, `name`,
    `loadsBackend`, `entry`, `canHaveMultipleFrontends`, `supportsScaling`
    and `aspectRatio` (`'original'` for the rM1/rM2/rMPP, which is 0.75).
  - `src/library.cpp` L24–41: the backend is started as `backend/entry` with
    one argument, `/tmp/<id>.sock`, and the app folder as its working
    directory.
  - `src/library.cpp` L118: `QResource::registerResource(root +
    "/resources.rcc", "/" + internalIdentifier)`; the entry is loaded as
    `"qrc:/" + internalIdentifier + entry` (L85).
  - `src/library.cpp` L150–162: a manifest is valid only with `name`, `id`
    and `entry`, and `canHaveMultipleFrontends` defaults to `true`.
  - `resources/qml/window.qml` L428–481: the root's `close` signal makes
    AppLoad close the UI instance; `unloading()` is called when it unloads.
  - `examples/appload/full/build-rm.sh`: `rcc --binary -o resources.rcc
    application.qrc`.
  - `examples/appload/full/icon.png`: 100 × 100.
- `remarkable/cmd/estante-reader/main.go`:
  - L35: `var version`.
  - L37–41: `usage`.
  - L56–83: `run(args, stdout, stderr) int`, the one dispatch (module.md
    Decision 2: "argv[1] is a socket path, not a flag").
  - L295–323: `syncCommand`, which composes store, engine and sync — the
    precedent for `run`.
- `remarkable/internal/protocol/frame_test.go` L32–57: `pair(t, sndbuf)` over
  `syscall.Socketpair(AF_UNIX, SOCK_SEQPACKET)`, the test precedent.
- `remarkable/qml/tests/HarnessProbe.qml`: the probe this root makes real
  (hello on completion, `101` → *Paired*/*Not paired*, `endpoint` alias).
- `remarkable/qml/tests/run.py` L51: `-import` of the stand-in only. The
  tests reach `Main.qml` by a relative directory import.
- `scripts/gate` L337–389: the reader block (go_checks, the three
  cross-builds to `$TMP/reader/<arch>/`, the venv, the QML tests, the
  must-fail check).
- `app/public/icon.svg`: the app's mark, which the reader's icon is drawn
  from.

## Design delta (this task)

`docs/remarkable-reader.md`, edited in the working tree; it rides in this
task's commit:

- §3.1 gains two rows. `remarkable/qml/Main.qml` is the root (endpoint
  `estante`, `close`, an `unloading()` that leaves the backend running, hello
  on attach). `remarkable/tools/appfolder` assembles the folder (the manifest
  fields, the one-bit 100 × 100 icon, the `rcc --binary` zlib resources of
  everything under `qml/` but its tests, and `backend/entry` checked for its
  architecture).
- §3.1 also gains a paragraph: `backend/entry` is `estante-reader`
  unrenamed, and a sole absolute path argument reads as `run` against the
  default store.
- §9: the gate assembles the armv7 and arm64 folders and loads each
  `resources.rcc` as AppLoad does.

## Constraints / requirements

- **CGO-free, three targets.** Nothing new breaks the gate's cross-builds.
  `tools/appfolder` runs on the host only.
- **The backend's protocol is reader.protocol's.** Use `Next`/`Write`; do
  no framing here. An unknown type is skipped, and a `*PayloadError` loses
  only that message (the loop continues).
- **No song text, title, token or account in a log.** The backend logs
  nothing beyond an error line naming the error class on a fatal exit
  (design §10). A non-dial failure never echoes a payload.
- **Read-only.** The backend never pushes and never writes the account. This
  task adds nothing that writes beyond what `sync` and `store` already do.
- **The frontend computes nothing the backend would need** (design §3.3).
  The root keeps only the last `state` it was sent, to draw it. It sends JSON
  always (protocol.md Decision 8): `hello` is `{}`, never empty.
- **Refresh budget** (workflow 19): the root draws nothing before the first
  `state` (rule 1, no *Loading…*), animates nothing (rule 2), is one bit
  (black on white, no greys; rule 6), and writes time as a time.
- **The stand-in never ships.** `resources.rcc` carries no file under
  `remarkable/qml/tests/` or `remarkable/qml/harness/`.
- **Nothing built into the tree.** Folders go to `$TMP/reader/app/<arch>/estante/`.
  Every `go` command carries `-p "$JOBS"`.

## Acceptance criteria

### Behavior delivered

1. **`remarkable/internal/backend`**:

   ```go
   Serve(ctx, conn *protocol.Conn, b Deps) error
   ```

   `Deps` holds `Store *store.Store`, a `Syncer` (`Run(ctx)`, `Trigger()`;
   `*sync.Syncer` satisfies it), and `Now`. The loop works like this:
   - It starts `Syncer.Run` in a goroutine. Run passes at start, as design
     §5.3 asks.
   - On `Hello`, it writes `State`, built as follows:
     - `paired` is whether `Store.Session()` holds one.
     - `shapesShown` is `Store.ShapesShown()`.
     - `lastSync` is `Store.LastSync()` as RFC 3339, or `null`.
     - `syncing`, `online` and `error` come from the last sync `Status`
       received. Before any status: `false`, `true` and none.
   - It is handed `OnStatus` (through `StatusFunc()`, given to
     `sync.Options`) and writes a fresh `State` on each status, while
     connected.
   - On `Attached` and on `Sync`, it calls `Trigger()`. On `Detached`, it
     does nothing.
   - On `Terminate` or `io.EOF`, it cancels the sync, closes the connection
     and returns `nil`.
   - Any other reader message (`open`, `key`, …) is accepted and answered
     with nothing yet (the views are `reader.backend_views`, deferred below).
2. **`estante-reader run [--root DIR] SOCKET`**, and `estante-reader
   /abs/path` (a sole argument starting with `/`, as AppLoad passes it),
   which means `run` with `--root` `store.DefaultRoot`. Through a `var
   defaultRoot` a test can replace. The command:
   - opens the store;
   - opens the engine from `BundleDir()` when one is installed, else runs
     with none (`sync.New` accepts a nil engine; the bundle arrives with
     `reader.self_update`), and a bundle that fails to open is treated as
     none;
   - builds the syncer with `OnStatus` wired;
   - dials the socket with `protocol.Dial` and calls `backend.Serve`;
   - exits 0 on terminate or close, and 1 on a dial failure.

   The usage line gains `run [--root DIR] SOCKET`.
3. **`remarkable/qml/Main.qml`**, 1404 × 1872, white:
   - It holds `AppLoad { id: backend; applicationID: "estante" }` (aliased
     `endpoint` for tests), `signal close`, and `function unloading()`, which
     does **not** call `terminate()` (the backend keeps running and syncing;
     design §2).
   - `Component.onCompleted` sends `sendMessage(1, "{}")`.
   - On `101` it keeps the parsed state (`property var backendState`, `null`
     until the first) and ignores every other type and unknown fields.
   - It draws one `Text` (`id: statusLine`), empty until the first state,
     from `status.js`'s `statusLine(state)`:
     - *Not paired* when `paired` is false;
     - *Syncing…* while `syncing`;
     - *Not connected — showing what was synced at HH:MM* when `error` is
       `offline` and `lastSync` is set;
     - *Synced at HH:MM* when `lastSync` is set;
     - otherwise nothing.

     HH:MM is device local time, 24-hour. The copy is workflow 19's.
     `browse_screens` moves this line onto the shelf and the *Not paired*
     page.
4. **`remarkable/tools/appfolder`**:

   ```
   appfolder --arch armv7|arm64 --backend FILE --qml DIR --rcc TOOL --out DIR
   ```

   It writes `DIR/estante/` with exactly these entries:
   - `manifest.json`: `{"id":"estante","name":"Estante","entry":"/Main.qml",
     "loadsBackend":true,"canHaveMultipleFrontends":false,
     "supportsScaling":false,"aspectRatio":"original"}`.
   - `icon.png`: the embedded 100 × 100 one-bit icon.
   - `resources.rcc`: compiled from a `.qrc` the tool generates in a temp
     directory. It lists every file under `--qml` except `tests/`,
     `harness/` and dotfiles, by its path relative to `--qml`. It is run as
     `TOOL --binary --compress-algo zlib -o resources.rcc FILE.qrc`.
   - `backend/entry`: the backend, mode 0755.

   The tool refuses a backend whose ELF machine is not the architecture's
   (`EM_ARM` 32-bit for armv7, `EM_AARCH64` for arm64), refuses a missing
   `Main.qml`, and replaces an existing `estante/` whole.
5. **The gate** (reader block, after the QML tests): it builds both folders
   from `$TMP/reader/arm/estante-reader` and `$TMP/reader/arm64/estante-reader`
   with `$qml_venv/bin/pyside6-rcc`, into `$TMP/reader/app/{armv7,arm64}/`,
   then runs `check_folder.py` on each. Steps: `estante reader: app folder
   armv7`, `… arm64`, `estante reader: app folders load as AppLoad loads
   them`.
6. **`remarkable/README.md`**: building a folder by hand, and copying it to
   the device per design §2.1 step 4.

### Tests, by level

- **unit (go test, `remarkable/internal/backend/backend_test.go`)**: over a
  real `SOCK_SEQPACKET` socketpair, with a `store.Open(t.TempDir())` and a
  fake `Syncer` recording `Run` and `Trigger` calls:
  - `TestHelloAnsweredWithState`: an empty store's `hello` gets exactly one
    `101` `{paired:false, syncing:false, online:true, lastSync:null,
    shapesShown:true}`, with no `error` key (design §6 `1 hello`,
    `101 state`).
  - `TestStateReadsTheStore`: with a session, `SetLastSync` and
    `SetShapesShown(false)`, the answer says `paired:true`, `lastSync` RFC
    3339 and `shapesShown:false` (design §5.4, §6).
  - `TestStatusSentAsState`: the status func called with `Syncing:true`,
    then `{Online:false, Error:"offline"}`, writes two `state`s in order
    (design §5.3; workflow 19 §The shelf, the line that changes by itself).
  - `TestAttachAndSyncTrigger`: `-2` and `4 sync` each trigger once; `-3`
    triggers nothing; `Run` was started once at Serve (design §5.3).
  - `TestTerminateEndsServe`: `-1 close` makes Serve return nil and cancels
    the context given to `Run` (design §6, AppLoad's terminate).
  - `TestPeerCloseEndsServe`: the peer closing returns nil.
  - `TestOtherMessagesIgnored`: a `2 open`, a type 77, and a malformed `1`
    payload get no answer, and a following `hello` is still answered (design
    §6, an unknown type ignored).
- **unit (go test, `remarkable/cmd/estante-reader/main_test.go`)**:
  - `TestRunServesTheSocket`: a `unixpacket` listener in `t.TempDir()`.
    `run([]string{"run", "--root", dir, sock})` in a goroutine is accepted,
    answers a `hello` with `state`, and returns 0 on `-1`.
  - `TestBareSocketPathIsRun`: `run([]string{sock})` with `defaultRoot`
    pointed at a temp dir does the same (rm-appload `src/library.cpp`
    L24–41, argv[1] the socket path).
  - `TestRunDialFails`: a missing socket returns 1, and stderr names no path
    contents.
  - `TestUsage`: updated for the new usage line.
- **unit (go test, `remarkable/tools/appfolder/appfolder_test.go`)**, with
  the rcc runner injected as a function and the backend a minimal ELF header
  written by the test:
  - `TestManifest`: the exact fields above (rm-appload README §Applications'
    format; design §3.1).
  - `TestLayoutPerArch`: for armv7 and arm64, `estante/` holds exactly
    `manifest.json`, `icon.png`, `resources.rcc` and `backend/entry`, and
    `entry` is mode 0755 (design §2; §2.1 step 7, "`backend/entry` not
    executable").
  - `TestRefusesBackendOfAnotherArch`: the test binary itself (amd64) is
    refused for both arches, and an arm64 header for armv7 is refused (§2.1
    step 7, "the folder for the wrong architecture").
  - `TestQrcCarriesAppQMLOnly`: a `--qml` tree with `Main.qml`, `status.js`,
    `tests/tst_x.qml`, `tests/appload/…` and `harness/must-fail/…` yields a
    qrc listing `Main.qml` and `status.js` only (qml_harness.md L174–176).
  - `TestRefusesMissingMain`.
  - `TestIconIsOneBit`: the embedded `icon.png` decodes to 100 × 100 with
    every pixel pure black or pure white (workflow 19 rule 6; AppLoad's
    example icon size).
- **behavior (QML, `remarkable/qml/tests/tst_main.qml`)**: `TestCase` `name:
  "Main"`, `when: windowShown`. It creates `Main` (`import ".."`) against the
  stand-in:
  - `test_helloOnAttach`: exactly one `sent` entry, type 1, payload `{}`
    (design §6 `1 hello`).
  - `test_nothingBeforeState`: `statusLine.text` is empty until a `101`
    arrives (workflow 19 rule 1).
  - `test_showsTheState`: `play(101, …)` draws *Not paired*; then
    `paired:true` with a `lastSync` made from a local 14:32 draws *Synced at
    14:32*; `syncing:true` draws *Syncing…*; `error:"offline"` with a local
    09:10 draws *Not connected — showing what was synced at 09:10* (workflow
    19 §The shelf, rule 2).
  - `test_unknownIgnored`: type 199 and an unknown field change nothing
    (design §6).
  - `test_unloadingLeavesTheBackendRunning`: `unloading()` leaves the
    stand-in's `terminated` false (design §2).
  - `test_rootContract`: the root is 1404 × 1872, `applicationID` is
    `estante`, and `close()` is spied once (rm-appload README; workflow 19
    §The screen).
- **gate check (`remarkable/qml/tests/check_folder.py`, run with the venv's
  `python -I`)**: for each built folder it
  - registers `resources.rcc` under a random root, as `src/library.cpp` L118
    does;
  - loads `qrc:/<root>/Main.qml` with a `QQmlEngine` whose import path has
    the stand-in, and creates it with no errors;
  - asserts the object has a `close` signal and an `unloading` method;
  - asserts the resource tree holds no `tests/`, `harness/` or `appload/`
    entry.

  It exits non-zero on any failure, and the gate step fails with it. This
  pins that the folder AppLoad would load works (design §2, §9 delta).

No e2e-api or e2e-web level. The note names neither, and the reader is not a
web client. Its stack-level test is `reader.sync`'s e2e-api, and pairing's
comes with `reader.pairing`. A run on a real rM2 is a person's step and is
not a gate test.

**Deferred work:** `reader.backend_views`, 2d, note not `cifra.md:` (closer
registers in WBS, milestone `milestones.m7_reader`, depends
`reader.app_folder`, `reader.sync`). Its note:

> The backend answers the frontend's view messages: `open` (shelf, book,
> song, setlist, settings) with `103 shelf`, `104 book`, `105 sheet` (the
> engine's `Sheet` mapped onto §6's payload, the key from the store over
> `songs.json`), `106 setlist`, `107 settings` from the sync snapshot, the
> engine and the store. It also handles `key`, `place`, `hideShape`,
> `showShape`, `showAllShapes` and `shapesShown`, kept in the store and
> answered with the re-drawn sheet or settings. `signOut` and `pair` are
> left to `reader.pairing`. Docs: docs/remarkable-reader.md §6, §5.4;
> workflow 19 §A song, §A setlist. Tests: unit (over a socketpair with a
> store holding a local book written for the purpose and the built bundle:
> each `open` answered, a key kept across a restart, a hidden voicing marked
> `hidden` in the next sheet, a song from a book gone still answered until
> Back).

## Decisions

1. **`backend/entry` is `estante-reader` itself, and a sole absolute path
   means `run`.** AppLoad passes only the socket path (`src/library.cpp`
   L41). A subcommand never starts with `/`, so the dispatch is unambiguous.
   `run --root DIR SOCKET` stays for development.
   - Rejected: a shell wrapper `entry` exec'ing `estante-reader run "$1"`.
     It adds a second file that can lose its executable bit.
   - Rejected: dispatching on `argv[0]`'s basename. It breaks if the file is
     ever renamed.
2. **The loop lives in `internal/backend`, and it wires sync.** design §5.3
   asks for a sync at start and on attach, and `sync` built `Run`/`Trigger`
   for exactly this caller. Without that wiring, `state`'s `syncing`,
   `online` and `lastSync` would never change.
   - Rejected: leaving the loop in `cmd/`, which is harder to test with a
     fake syncer.
3. **The views are out, registered as `reader.backend_views`.** The note
   asks for hello→state only. The screen tasks are QML-tested against
   scripted messages and do not need the backend views. Building the
   `open`→`sheet` mapping here would double the task's effort.
4. **`unloading()` does not terminate the backend.** rm-appload's README
   says `unloading()` is where an app *may* stop its backend for good. The
   design wants it running in the background (§2, §5.3), so the root does
   nothing there yet. Ending the backend for good is *Sign out*'s concern
   (`reader.pairing`), if ever.
5. **The folder builder is a Go tool under `tools/`, not a shell script,
   and not a subcommand of the device binary.**
   - It is tested with `go test` like the rest of the module (an injected
     rcc runner, crafted ELF headers).
   - It sits outside `./cmd/...`, so it is never cross-built or shipped.
   - It takes an already-built backend, so the gate reuses its cross-builds,
     and `reader.payload`'s Dockerfile stage can call it the same way.
   - It does not stamp a version: stamping is `reader.payload`'s (module.md
     Decision 3).
6. **The qrc is generated from the directory, not hand-kept.** Every later
   screen file is carried with no list to forget. The exclusion of `tests/`
   and `harness/` is the one rule, and it is pinned by a test.
7. **`rcc --binary --compress-algo zlib`.** Qt 6's rcc may default to zstd,
   which the device's Qt is not known to read. zlib is read by every Qt.
   The venv's `pyside6-rcc` is the rcc: the gate already pins it.
8. **Manifest choices.**
   - `canHaveMultipleFrontends: false`: one stand, one screen, and the
     state is per frontend.
   - `supportsScaling: false` with `aspectRatio: "original"`: the root is
     fixed at the rM2's 1404 × 1872 (workflow 19 §The screen), and AppLoad
     scales it to the window.
   - `name` *Estante*: what §2.1 step 4 says the list shows.
9. **The root draws one line of state, using workflow 19's copy.** The note
   asks the root to "show the state it is sent". Using the shelf's own sync
   line and *Not paired* invents no copy, and `status.js` is the function
   `browse_screens` reuses on the shelf.
10. **The icon is drawn from `app/public/icon.svg`, thresholded to one bit,
    and checked in as a 100 × 100 PNG.** It is the app's own mark, and AppLoad
    shows icons at that size. The test pins its size and its one bit.
11. **No `qmllint` step** (qml_harness.md Decision 7 left it optional).
    `check_folder.py` compiles the shipped QML from the rcc, and the
    behavior tests compile it from source. A lint pass would add a tool with
    no failure it alone catches today.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-11-02.

- Backend loop: remarkable/internal/backend/backend.go (+ backend_test.go) answers `hello` with `state`, sends a fresh `state` on each sync status, triggers a sync on attach and on `sync`, exits on terminate or close.
- `estante-reader run [--root DIR] SOCKET` (a bare absolute path too, as AppLoad starts it): remarkable/cmd/estante-reader/main.go, main_test.go.
- QML root: remarkable/qml/Main.qml and status.js — sends `hello`, draws workflow 19's one-line status; behavior tests in remarkable/qml/tests/tst_main.qml.
- App folder builder for armv7 and arm64: remarkable/tools/appfolder/ (main.go, appfolder.go, appfolder_test.go, icon.png).
- Gate: scripts/gate builds both folders and loads each resources.rcc as AppLoad does (remarkable/qml/tests/check_folder.py).
- Docs: docs/remarkable-reader.md §3.1/§9, remarkable/README.md.
- Follow-up registered: `reader.backend_views` (gated by milestones.m7_reader).
