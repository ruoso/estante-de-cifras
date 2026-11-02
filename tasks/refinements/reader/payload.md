# reader.payload — The device payload, served from the site

## TaskJuggler entry

`tasks/85-reader.tji` L146–151, `task payload` under `task reader` →
`reader.payload`. Milestone: `milestones.m7_reader`
(`tasks/99-milestones.tji` L60).

## Effort estimate

1d.

## Repository

Not under `cifra.md/` (the note does not start with `cifra.md:`). The work
lands in:

- `Dockerfile`: a new `reader` stage, and one `COPY` into the final image.
- `.dockerignore`: `remarkable/qml/tests/.venv` excluded (the gate's local
  venv must never enter the context), and the header comment naming
  `remarkable/` among what the image builds from.
- `remarkable/tools/payload/`: a new build tool (`main.go`, `payload.go`,
  `payload_test.go`) beside `tools/appfolder`. It is outside `cmd/`, so the
  gate's cross-build of `./cmd/...` does not ship it.
- `service/internal/server/app.go`: `cacheControl`, `isAssetRequest` and
  `contentType` learn `device/`; `app_test.go` adds their tests.
- `e2e/api/device.test.js`: new.
- `remarkable/README.md`: one paragraph on where the served payload comes
  from.
- `docs/remarkable-reader.md` §2.1, §8, §9: the design delta (below), already
  edited in the working tree. It rides in this task's commit.

## Inherited dependencies

- `reader.qml_chart` (complete 100, settled): the QML tree that
  `resources.rcc` carries (`remarkable/qml/chart/`, `remarkable/qml/fonts/`),
  which ships through `appfolder`'s directory walk with no list to edit.
- `reader.engine` (complete 100, settled): `engine.HostAPI = 1`
  (`remarkable/internal/engine/engine.go:47`), `engine.ManifestFile`
  (`engine.go:50`), and the `engine.Manifest` type (`engine.go:98–106`).
  `engine.Open` reads the manifest with `encoding/json`, which ignores unknown
  fields. So the full manifest this task serves still opens as a bundle
  directory, and `reader.self_update` can keep it in the store's bundle slot
  as is.
- `reader.bundle` (complete 100, settled): `npm run build` writes
  `app/dist/device/{bundle.<8 hex>.js, manifest.json}`. The manifest is
  `{version, hostApi, salt, bundle:{path, sha256}}` (`app/src/device/build.js`
  L108–113). bundle.md L64 hands this task the copy into `/srv/app/device/`
  and the manifest's `qml` and `backend` fields. bundle.md Decision 6 hands it
  "what `version` covers".
- `reader.app_folder` (complete 100, settled; reached through `qml_chart`):
  `appfolder --arch armv7|arm64 --backend FILE --qml DIR --rcc TOOL --out DIR`
  writes `estante/{manifest.json, icon.png, resources.rcc, backend/entry}`.
  It checks the ELF machine and runs `rcc --binary --compress-algo zlib`.
  app_folder.md Decision 5 says it "does not stamp a version: stamping is
  `reader.payload`'s".
- `reader.module` (complete 100, settled): `var version = "dev"` in
  `remarkable/cmd/estante-reader/main.go:43–44`, stamped with
  `-ldflags "-X main.version=<v>"` (module.md Decision 3, "what
  `reader.payload`'s Dockerfile stage can set deterministically"). The backend
  passes it on as `Backend.Version`, and the settings show it
  (`remarkable/internal/backend/views.go:289`).
- `reader.qml_harness` (complete 100, settled): the pinned Qt,
  `remarkable/qml/tests/requirements.txt`. It holds PySide6-Essentials 6.12.0
  and shiboken6 6.12.0 with `--require-hashes` for the manylinux_2_34 x86_64
  wheels, and carries `pyside6-rcc`.
- Downstream: `reader.self_update` reads `/device/manifest.json` and fetches
  what it names. `reader.install` fetches `/device/estante-<arch>.tar.gz`
  (design §2.1 step 4).

## What this task is

The image the site runs gains everything a reMarkable needs, served under
`/device/` beside the app:

- the bundle the app's build already made;
- the QML compiled into `resources.rcc`;
- the backend for armv7 (rM2) and arm64 (Paper Pro);
- each architecture's whole AppLoad folder as a `.tar.gz`;
- a manifest naming every one of them with its SHA-256 and the host API.

The service serves the content-hashed files as immutable and the manifest and
folders as revalidated. A `/device/` path with no file behind it is a 404,
never the app shell.

## Why it needs to be done

Until now the reader exists only as build outputs in the gate's `$TMP`, so no
device can get it. `reader.install` (the guide and `install.sh`) downloads the
app folder from `/device/`. `reader.self_update` reads the manifest at sync to
fetch a new bundle or QML. Both depend on this task. The design names the
place (`docs/remarkable-reader.md` §8) and the Dockerfile stage (§9). bundle.md
L289 deferred the e2e level for the served payload to this task.

## Inputs / context

- `docs/remarkable-reader.md`:
  - §8 L482 onward: the served layout and manifest, as edited by this task.
  - §9 L525 onward: the gate and the Dockerfile stage.
  - §2.1 L103–114: step 4, the folder downloaded and unpacked.
  - §3.1: `remarkable/tools/appfolder`, and `backend/entry` as
    `estante-reader` unrenamed.
  - §10: the backend runs as root, so it never updates itself here.
- `Dockerfile`:
  - stage `app` L15–29 (`npm run build`, which runs `build:device`);
  - stage `service` L32 (`golang:1.25-alpine`);
  - the final stage L72 onward, with `COPY --from=app /build/app/dist
    /srv/app` at L84.
  - `remarkable/go.mod` needs Go 1.26.0 and replaces
    `github.com/ruoso/cifra.md/go => ../cifra.md/go` (L27, L37). So the new
    stage needs its own Go 1.26 image and the `cifra.md/go` sources at
    `../cifra.md/go`.
- `.dockerignore`: excludes `**/dist`, `scripts`, `e2e`, `docs`, and does not
  exclude `remarkable/` or its `.venv`.
- `scripts/gate`:
  - L339–347 cross-build `amd64 arm:7 arm64` with `CGO_ENABLED=0`;
  - L361–366 and L390 build the venv and `qml_rcc`;
  - L391–402 run appfolder twice, then `check_folder.py`;
  - L244–280 `stack_up` (`docker compose up --build`), which builds this image
    from the working tree;
  - L446–462 run e2e-api.
- `service/internal/server/app.go`:
  - L20–21 the two policies;
  - L54 `reservedPrefixes`;
  - L86–105 `ServeHTTP` (serve the file, or 404 an asset, or fall back to the
    shell);
  - L153–158 `isAssetRequest`;
  - L187 onward `contentType`;
  - L215–226 `cacheControl`.
  - The app root is `os.DirFS(cfg.AppRoot)`, `/srv/app` by default
    (`service/internal/config/config.go:23`).
- What app.go does with `/device/` today:
  - an existing file is served `no-cache`;
  - a missing `/device/estante-reader-armv7.x` 404s because it has an
    extension;
  - a missing extensionless `/device/estante-reader-armv7` falls back to the
    shell with 200. That is the bug this task closes.
- `service/internal/server/app_test.go`: `newTestHandler` L66,
  `TestCacheHeaders` L171, `TestMissingAssetIs404` L254.
- `e2e/api/app.test.js`, which this test is modeled on, and its client
  `e2e/api/lib/http.js` (`HttpClient`, base `ESTANTE_E2E_BASE_URL`).
- `remarkable/tools/appfolder/{main.go, appfolder.go}`: the pattern
  `tools/payload` follows (package main, flags, a temp dir renamed into place,
  injected seams for its tests).

## Design delta (this task)

`docs/remarkable-reader.md`, edited in the working tree; it rides in this
task's commit:

- **§8's listing** gains four things:
  - `backend.<arch>` is spelled out as `{path, sha256, version, hostApi}`;
  - a `folder: {armv7:{path, sha256}, arm64:{…}}` key is added;
  - the backends are named `estante-reader-<arch>.<hash>`, by content, no
    longer by `-<version>`;
  - two folder archives are listed, `estante-armv7.tar.gz` and
    `estante-arm64.tar.gz`.

  A paragraph defines:
  - `<hash>`;
  - the payload `version`;
  - each backend's `version` and `hostApi`;
  - what the archives are;
  - the two cache policies;
  - the 404.
- **§9**: the Dockerfile sentence names the `reader` stage, the pinned
  `pyside6-rcc`, `tools/appfolder` and `tools/payload`.
- **§2.1 step 4, by hand**: the folder is `/device/estante-armv7.tar.gz`,
  unpacked with `tar xzf`.

## Constraints / requirements

- **Same bytes as the gate checks.** The image's rcc is the gate's: the same
  `requirements.txt`, installed `--require-hashes`, and the same `appfolder`
  run. A second Qt (Debian's `qt6-base-dev-tools`) would compile QML the gate
  never loaded.
- **One build of the backend per architecture.** The binary stored in the
  folder's `backend/entry` and the served `estante-reader-<arch>.<hash>` are
  the same bytes. The tool reads both the backend and the rcc out of the
  assembled folders, so they cannot drift.
- **A payload the reader refuses is never built.** The image build fails in
  three cases:
  - the bundle manifest's `hostApi` is not `engine.HostAPI`;
  - the bundle's bytes do not match its manifest's `sha256`;
  - the two folders' `resources.rcc` differ.
- **Deterministic where the bytes are made here.** The `.tar.gz` and the
  manifest are byte-identical for identical inputs. The tar is sorted, with
  mtime 0, uid/gid 0, modes 0755 for directories and `backend/entry` and 0644
  for the rest. The gzip header has no name and no mtime. The manifest is
  `JSON` with two-space indent and a newline, with keys in the §8 order. The
  rcc's bytes come from Qt and may carry file mtimes, so nothing here depends
  on them being reproducible: names come from the bytes actually built.
- **No new runtime dependency** in the final image: it gains files under
  `/srv/app/device/` and nothing else. The Python, Qt and Go of the `reader`
  stage are discarded with it.
- **No book data.** The payload is code, public like the app's own bundle
  (the account rule is about books). `noindex` still rides on every response
  (`TestNoIndexOnEveryResponse`). The PWA never precaches `device/**`
  (`app/src/pwa/workbox.js:10`, unchanged).
- **The app build's own manifest is unchanged.** `app/dist/device/manifest.json`
  stays the bundle-only manifest. The gate's reader tests and
  `e2e/api/reader-sync.test.js` read it from `app/dist/device`. The full
  manifest is written only into the image's `/srv/app/device/`, over the
  copied one.
- Bounded parallelism everywhere: `go build -p "$(nproc)"` in the stage, as
  the gate does.

## Acceptance criteria

### Behavior delivered

1. **`remarkable/tools/payload`**:

   ```
   payload --device DIR --folder armv7=DIR --folder arm64=DIR --backend-version V --out DIR
   payload digest DIR...
   ```

   - The first form takes the app's `dist/device` (`--device`) and each
     architecture's assembled folder, the parent of `estante/`, as appfolder's
     `--out` writes it. It writes into `--out`:
     - `bundle.<8>.js`, copied after its `sha256` is checked;
     - `resources.<8>.rcc`, from the armv7 folder, identical to the arm64
       folder's;
     - `estante-reader-armv7.<8>` and `estante-reader-arm64.<8>`, each from
       its folder's `backend/entry`, mode 0755;
     - `estante-armv7.tar.gz` and `estante-arm64.tar.gz`, each its folder's
       `estante/` tree;
     - `manifest.json`: `{version, hostApi, salt, bundle:{path,sha256},
       qml:{path,sha256}, backend:{armv7:{path,sha256,version,hostApi},
       arm64:{…}}, folder:{armv7:{path,sha256}, arm64:{…}}}`.
   - The manifest's fields:
     - `<8>` is the first eight hex digits of the file's SHA-256, lowercase.
     - `hostApi` and `salt` come from the bundle manifest.
     - Each backend's `hostApi` is `engine.HostAPI`, imported from the same
       module the backend is built from.
     - Each backend's `version` is `--backend-version`.
     - The top-level `version` is the first 12 hex digits of the SHA-256 of
       the lines `"<path> <sha256>\n"` of every named file, sorted by path.
   - `payload digest DIR...` prints the first 12 hex digits of a SHA-256. It
     covers every `*.go` file that is not `_test.go`, every `go.mod` and
     `go.sum` under the given trees (`testdata/` skipped), and
     `runtime.Version()`. Each file enters as its slash-separated path
     relative to its root, plus its bytes, in sorted order. The Dockerfile
     stamps this value into the backend as `main.version`.
   - The tool writes into a temp dir and renames it into place. It refuses,
     with a message naming the problem:
     - a bundle whose hash does not match;
     - a bundle `hostApi` other than `engine.HostAPI`;
     - folders whose `resources.rcc` differ;
     - a folder missing any of its four entries;
     - an `--out` that exists and is not empty.
2. **`Dockerfile`, stage `reader`** (`FROM golang:1.26-trixie AS reader`):
   - apt installs `python3-venv` and the Qt libraries the gate names (L361
     onward);
   - `pip install --require-hashes -r remarkable/qml/tests/requirements.txt`
     into `/venv`;
   - module files first for a cached download, with `cifra.md/go` at
     `/cifra.md/go`, then the sources;
   - `v=$(go run ./tools/payload digest . /cifra.md/go)`;
   - for `arm:7` and `arm64`: `CGO_ENABLED=0 GOOS=linux GOARCH=… GOARM=… go
     build -p "$(nproc)" -trimpath -ldflags "-X main.version=$v" -o
     /out/<arch>/ ./cmd/estante-reader`;
   - `go run ./tools/appfolder` twice, with `--rcc /venv/bin/pyside6-rcc`;
   - `COPY --from=app /build/app/dist/device /in/device`;
   - `go run ./tools/payload --device /in/device … --backend-version "$v"
     --out /out/device`.

   The final stage gains `COPY --from=reader /out/device/ /srv/app/device/`
   after the app's copy, so the full manifest replaces the bundle-only one.
   Like the gate and CI, the image builds on an amd64 host (Decision 6).
3. **`service/internal/server/app.go`**:
   - `cacheControl`: under `device/`, `bundle.<8hex>.js`,
     `resources.<8hex>.rcc` and `estante-reader-(armv7|arm64).<8hex>` are
     immutable. Everything else under `device/` is revalidated:
     `manifest.json`, the `.tar.gz`, and any name not matching.
   - `isAssetRequest`: a path under `device/` is an asset. A missing one is a
     404, never the shell.
   - `contentType`: `.tar.gz` is `application/gzip`; `.rcc` and the
     extensionless backends fall to `application/octet-stream`.
   - The existing `assets/` and `workbox-*` rules are unchanged.
4. **`.dockerignore`** excludes `remarkable/qml/tests/.venv`, and its header
   names `remarkable/` among the build's sources.
5. **`remarkable/README.md`**: the served payload, `/device/`, is built by the
   image's `reader` stage with `tools/payload`. It names the two archives a
   person downloads.

### Tests, by level

- **unit (go test, `service/internal/server/app_test.go`)**, which is the
  note's "cacheControl for device files":
  - `TestDeviceCacheControl`: a table over `cacheControl`. Immutable cases:
    `device/bundle.0123abcd.js`, `device/resources.0123abcd.rcc`,
    `device/estante-reader-armv7.0123abcd`,
    `device/estante-reader-arm64.0123abcd`. Revalidated cases:
    `device/manifest.json`, `device/estante-armv7.tar.gz`,
    `device/estante-arm64.tar.gz`, `device/bundle.js`,
    `device/estante-reader-armv7` and `device/estante-reader-x86.0123abcd`.
    The existing `assets/app-abc123.js` and `sw.js` rows keep their policies
    (design §8, as edited).
  - `TestDeviceFilesServed`: `newTestHandler` gains a `device/` fixture.
    Through the handler:
    - the manifest is `application/json` with `no-cache`;
    - a backend is `application/octet-stream` and immutable;
    - an archive is `application/gzip` with `no-cache`.
  - `TestDeviceMissingIs404`: a missing `/device/estante-reader-armv7.deadbeef`,
    a missing extensionless `/device/estante-reader-armv7` and a missing
    `/device/manifest.json` are each a 404 and not the shell's body (design §8:
    "never the app's shell").
- **unit (go test, `remarkable/tools/payload/payload_test.go`)**: the fixtures
  are a bundle dir written by the test (a small JS file and its manifest) and
  two folders written by hand, each with a stand-in ELF header as
  `backend/entry`.
  - `TestManifestNamesEveryFile`: the manifest has exactly the §8 keys, in
    order. Every `path` exists in `--out`, and every `sha256` is that file's.
    Each name carries its hash's first eight digits.
  - `TestVersionCoversEveryFile`: the top-level `version` is the digest of the
    sorted `path sha256` lines. Changing one byte of the rcc changes it.
  - `TestBackendEntries`: each backend's `hostApi` is `engine.HostAPI`, its
    `version` is the flag's, and its bytes are its folder's `backend/entry`,
    mode 0755.
  - `TestArchiveCarriesFolder`: gunzip and untar each archive. It holds
    exactly `estante/`, `estante/manifest.json`, `estante/icon.png`,
    `estante/resources.rcc`, `estante/backend/` and `estante/backend/entry`,
    with the folder's bytes, the modes above, mtime 0 and uid/gid 0.
  - `TestDeterministic`: two runs over the same inputs give byte-identical
    archives and manifests.
  - `TestRefusals`, one subtest each:
    - a bundle with a wrong `sha256`;
    - a bundle `hostApi` of 2;
    - folders with differing `resources.rcc`;
    - a folder missing `backend/entry`;
    - a non-empty `--out`.

    Each fails, names the problem, and leaves `--out` as it was.
  - `TestDigest`: stable across two calls. It changes when a non-test `.go`
    file or `go.sum` changes, and does not change when a `_test.go` or a file
    under `testdata/` does.
- **e2e-api (`e2e/api/device.test.js`)**, against the compose stack, whose
  image the gate builds from the working tree (design §8):
  - **the manifest**: `GET /device/manifest.json` returns 200,
    `application/json`, `no-cache` and `noindex`. It has the §8 shape:
    - `version` is 12 hex;
    - `hostApi` is the integer 1;
    - `salt` is a non-empty string;
    - `bundle`, `qml`, `backend.armv7`, `backend.arm64`, `folder.armv7` and
      `folder.arm64` each carry `path` and a 64-hex `sha256`;
    - each backend carries `hostApi` 1 and a 12-hex `version`;
    - the payload `version` equals the digest of its sorted `path sha256`
      lines.
  - **every file it names is served and matches**: each `path` is fetched,
    returns 200, and its body's SHA-256 is the manifest's.
    - The bundle, rcc and backends are `immutable`; the folders are
      `no-cache`.
    - `backend.armv7` begins with the ELF magic, `ELFCLASS32` and `e_machine`
      40 (`EM_ARM`); `backend.arm64` with `ELFCLASS64` and 183
      (`EM_AARCH64`).
  - **the folder is the installable one** (design §2.1 step 4): each archive,
    unpacked with `node:zlib` and a ustar reader written in the test, holds
    `estante/manifest.json` with `id` `estante` and `entry` `/Main.qml`. Its
    `estante/resources.rcc` is byte-identical to the served `qml`, and its
    `estante/backend/entry` to that architecture's served backend.
  - **a missing device file is a 404**: `/device/estante-reader-armv7.deadbeef`
    returns 404 with `noindex`, and its body is not the shell's.

No behavior or e2e-web level: no screen and no component changes. The
behavior a device sees (fetching and switching) is `reader.self_update`'s. The
gate's existing `check_folder.py` already loads folders built by the same
`appfolder` and the same pinned rcc, and e2e-api pins that the image's folder
carries the very bytes it serves.

**Deferred work:** none.

## Decisions

1. **The payload is laid out by a Go tool, `remarkable/tools/payload`, not by
   shell in the Dockerfile.** Hashing, renaming, a deterministic tar and a
   manifest merge are logic that wants unit tests. app_folder.md Decision 5
   set the precedent: build tools are Go under `tools/`, outside `./cmd/...`.
   Being in the `remarkable` module, the tool imports `engine.HostAPI`, the
   very constant the backend is compiled with. So the manifest's backend
   `hostApi` cannot disagree with the binary.
   - Rejected: `sha256sum` and `jq` in a `RUN`. That is untestable, and needs
     `jq`.
   - Rejected: extending the app's `build.js`. The app's build knows nothing
     of Go or Qt, and its manifest is what the gate's reader tests read.
2. **The backend and the rcc are read out of the assembled folders.** One
   build per architecture feeds both the folder and the served file, and the
   two architectures' rcc must be identical. The served payload and the
   installable folder therefore cannot drift. Rejected: separate `--backend`
   and `--rcc` flags. They allow passing bytes that differ from the folder's.
3. **Every downloaded file is named by its content; the folders and manifest
   by a fixed name.** The note asks for "content-hashed device files served as
   immutable".
   - §8's `estante-reader-<arch>-<version>` named a backend by a version. A
     toolchain bump under the same source would serve new bytes under a name
     already cached as immutable. Hence the delta to
     `estante-reader-<arch>.<hash>`.
   - The folders keep fixed names because a person types them (design §2.1)
     and `install.sh` fetches them. They are revalidated, and the manifest's
     `folder.<arch>.sha256` lets the script check what it got.
   - Rejected: hashed folder names plus a redirect. That means a second
     moving part for a file read once per install.
4. **The payload's `version` covers every file it serves; the backend's
   `version` is a source digest.**
   - bundle.md Decision 6 left `version` open until the payload broadened. The
     bundle's hash already sits in `bundle.sha256`. A `version` derived from
     every `path sha256` changes exactly when anything served changes, needs
     no git (the context excludes `.git`), and is reproducible.
   - The backend cannot carry its own hash, so `main.version` is
     `payload digest`, computed over the sources it is built from plus the Go
     version. This is deterministic, as module.md Decision 3 asks, and the
     same in the gate and the image. The settings show it, and two images
     from the same tree show the same value.
   - Rejected: a `--build-arg` from `git describe`. compose and the gate pass
     no build args, and it would read `dev` in every stack the tests run.
5. **The image's rcc is the gate's pinned `pyside6-rcc`, in a
   `golang:1.26-trixie` stage.** It produces the same Qt and the same rcc the
   gate's `check_folder.py` loads. The PySide6 wheel is glibc, so the stage is
   Debian, not Alpine. It is one stage because appfolder runs Go and rcc
   together. Go 1.26 is what `remarkable/go.mod` requires; the service stage's
   1.25 cannot build it. Rejected: Debian's `qt6-base-dev-tools` rcc. It is a
   different Qt from the one the gate tests the QML on.
6. **The image builds on amd64 only.** `requirements.txt` pins the x86_64
   wheels by hash, and the gate and CI are amd64. The *targets* are armv7 and
   arm64 by cross-compilation, which needs no ARM host. An arm64 build host
   is a later concern, and widening the pinned hashes is `reader.qml_harness`'s
   file to change. Nothing here needs it.
7. **`/device/` is an asset prefix in the app handler, not a reserved
   namespace.** Its files are real files under `/srv/app`, served by the same
   `ServeContent` path. Only the fallback is wrong for it: a missing
   extensionless backend name would get the shell with 200, and a client
   would hash HTML. Rejected: adding `/device` to `reservedPrefixes`. That
   declines the files too.
8. **`hostApi` stays 1.** This is the first payload ever served. As every
   predecessor said (bundle.md Decision 5, backend_views.md Decision 4), from
   now on an incompatible host-API change bumps it.
9. **The app's own `dist/device/manifest.json` is left bundle-only.** The
   gate's reader tests and `reader-sync.test.js` open `app/dist/device` as a
   bundle directory. The full manifest is a superset that `engine.Open`
   reads equally, but writing it needs the Go and Qt build the app's
   `npm run build` does not have.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-02.

- Dockerfile gains a `reader` stage (Go 1.26, the gate's pinned `pyside6-rcc`, both architectures built and folders assembled with `tools/appfolder`) that runs `remarkable/tools/payload` and lays out `/device/` in the image; `.dockerignore` admits what it needs.
- remarkable/tools/payload/{main.go,payload.go}: content-hashed bundle, resources.rcc and backends, deterministic `.tar.gz` installable folders, and `manifest.json` naming every file with its SHA-256 and the backend's hostApi.
- remarkable/tools/payload/payload_test.go: manifest names every file, version covers every file, backend entries, archive carries the folder, determinism, refusals, digest.
- service/internal/server/app.go: device files served immutable when content-hashed, manifest and archives no-cache, archives as `application/gzip`, a missing `/device/` path a 404; unit tests in app_test.go (`TestDeviceCacheControl`, `TestDeviceFilesServed`, `TestDeviceMissingIs404`).
- e2e/api/device.test.js: the manifest, every named file served with a matching hash, the folder is the installable one, a missing device file is a 404.
- Docs: docs/remarkable-reader.md (§2.1, §8, §9 design delta) and remarkable/README.md.
