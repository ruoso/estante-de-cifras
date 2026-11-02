# remarkable/ — the reMarkable reader

This directory is the reMarkable reader: a read-only client for the tablet,
run by AppLoad. It holds the reader's Go backend (`cmd/estante-reader` and its
`internal/` packages), the QML frontend that draws (`qml/`, rooted at
`qml/Main.qml`), and the tool that assembles them into AppLoad's folder
(`tools/appfolder`).

`internal/engine` evaluates the app's built device bundle in goja and answers
its host API (design §4). Its tests read the build, so run `npm run build` in
`app/` first. Two subcommands use it:

```sh
go run ./cmd/estante-reader sheet --bundle ../app/dist/device \
  --shapes ../app/dist-test/device/example-book.default-shapes.json \
  --key 2 ../app/example-book/the-ferry-line.cifra.md
go run ./cmd/estante-reader bench --bundle ../app/dist/device \
  --shapes ../app/dist-test/device/example-book.default-shapes.json \
  ../app/example-book/*.cifra.md
```

`sheet` prints one song's sheet as JSON; `bench` prints the §4.2 reading-path
timings, and nothing of the songs.

`internal/sync` fetches the account's home book and its shelf's books into the
store with go-git, read-only (design §5). Until pairing lands, a session is
pasted in by hand — the token on stdin, never on the command line — and one
pass run:

```sh
printf '%s\n' "$TOKEN" | go run ./cmd/estante-reader session --root /tmp/estante \
  --origin https://estantedecifras.app
go run ./cmd/estante-reader sync --root /tmp/estante --bundle ../app/dist/device
```

`sync` prints what the pass did — ids, statuses and heads, nothing else. Its
behavior tests run real `git http-backend`, so they need `git` on the host.

The QML frontend's tests (`qml/tests/tst_*.qml`) run on Qt's own
qmltestrunner over a pinned Qt 6 from pip (PySide6-Essentials; the wheel has
no runner binary, so `qml/tests/run.py` calls its `quick_test_main`),
offscreen with Qt Quick's software renderer, as the rM2 has no GPU. The gate
builds the venv and runs them; by hand, from this directory:

```sh
python3 -m venv qml/tests/.venv && qml/tests/.venv/bin/pip install \
  --require-hashes -r qml/tests/requirements.txt
qml/tests/.venv/bin/python -I qml/tests/run.py -input qml/tests
```

A screen is tested without the backend, the socket or the device: `run.py`
puts a stand-in for AppLoad's `net.asivery.AppLoad` module
(`qml/tests/appload/`) first on the import path, so the screen's own
`AppLoad { … }` endpoint is the stand-in. A test `play`s design §6's messages
into it (`endpoint.play(101, { paired: true, … })`) and reads what the screen
sent back from `endpoint.sent` (`{ type, contents, payload }`), or spies on
`messageSent`. The stand-in throws where the device would misbehave: a type
that is not an integer, or contents that are not JSON text. The offscreen
platform links a few system libraries (libGL, libEGL, libxkbcommon,
fontconfig, glib, X11/xcb client libraries); the gate names them when it
cannot start.

The chart's and the song screen's tests (`tst_chart_*.qml`,
`tst_chord_diagram.qml`, `tst_song_*.qml`, `tst_main.qml`) read real sheets:
`qml/tests/fixtures/<name>.js` is the backend's `105 sheet` for
`qml/tests/fixtures/songs/<name>.cifra.md`, a song written for the tests,
opened through the views with the app's built device bundle; a few variants
(`choro-long-hidden`, `few-chords-up2`, `few-chords-saved`) are the same songs
opened with a voicing hidden, the device's key, or a saved key; and
`found-shape` holds `choro-long`'s `105 sheet` read with one chord missing
from the table and the `108 shapes` the background search sent for it
(reader.missed_shapes). The browse screens' tests (`tst_browse_*.qml`,
`tst_main.qml`) read `browse-shelf`, `browse-book`, `browse-book-small`,
`browse-setlist` and `browse-settings`: the backend's `103`, `104`, `106` and
`107` over books built from `qml/tests/fixtures/browse-book/`, 34 songs and 3
setlists written for the tests (reader.browse_screens). Go's
`TestQMLFixtures` (`internal/backend/qmlfixtures_test.go`) fails when a
committed fixture differs from what the backend answers now — after a change
to the songs, `chartRows` or `diagramModel` — and regenerates them, once
`npm run build` has run in `app/`:

```sh
go test ./internal/backend -run TestQMLFixtures -update-qml-fixtures
```

Read the difference before keeping it. The faces under `qml/fonts/` are the
app's `woff2` files and licences byte for byte (`app/src/theme/fonts/`);
`tools/appfolder`'s tests fail when they drift.

The app AppLoad loads is a folder, `estante/`: `manifest.json`, `icon.png`,
`resources.rcc` (everything under `qml/` but its `tests/` and `harness/`,
rooted at `qml/Main.qml`) and `backend/entry`, which is `estante-reader`
itself. AppLoad runs it as `backend/entry /tmp/estante.sock`, and a sole
absolute path is read as `estante-reader run` against the store at
`/home/root/.local/share/estante/` (`run --root DIR SOCKET` names another
store, for development). `tools/appfolder` assembles the folder for one
architecture from a built backend, with the venv's rcc; the gate builds both
and loads each as AppLoad does. By hand, from this directory, for the rM2:

```sh
CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -o /tmp/reader/arm/ ./cmd/...
go run ./tools/appfolder --arch armv7 --backend /tmp/reader/arm/estante-reader \
  --qml qml --rcc qml/tests/.venv/bin/pyside6-rcc --out /tmp/reader/app/armv7
qml/tests/.venv/bin/python -I qml/tests/check_folder.py /tmp/reader/app/armv7/estante
```

For the Paper Pro, `GOARCH=arm64` (no `GOARM`) and `--arch arm64`. To install
it by hand (design §2.1 step 4), with xovi and AppLoad already on the tablet,
copy the folder over and press **Reload** in AppLoad, where *Estante* is then
listed:

```sh
scp -r /tmp/reader/app/armv7/estante root@<address>:/home/root/xovi/exthome/appload/
```

The module needs Go 1.26 (goja's minimum).

It is its own Go module and shares no code with `service/` (DIRECTION §3.6):
it agrees with the service through the API contract (`api/openapi.yaml`), and
runs the app's music code only as the app's built bundle — bytes it loads,
never source it imports. The design is in
[docs/remarkable-reader.md](../docs/remarkable-reader.md).
