# remarkable/ — the reMarkable reader

This directory is the reMarkable reader: a read-only client for the tablet,
run by AppLoad. It holds the reader's Go backend (`cmd/estante-reader` and its
`internal/` packages) and, to come, the QML frontend that draws (`qml/`).

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

The module needs Go 1.26 (goja's minimum).

It is its own Go module and shares no code with `service/` (DIRECTION §3.6):
it agrees with the service through the API contract (`api/openapi.yaml`), and
runs the app's music code only as the app's built bundle — bytes it loads,
never source it imports. The design is in
[docs/remarkable-reader.md](../docs/remarkable-reader.md).
