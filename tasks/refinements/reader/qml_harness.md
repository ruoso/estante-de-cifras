# reader.qml_harness — QML tests in the gate

## TaskJuggler entry

`tasks/85-reader.tji`, `task qml_harness` under `task reader` →
`reader.qml_harness` (L47–52). Milestone: `milestones.m7_reader`
(`tasks/99-milestones.tji` L58–61).

## Effort estimate

1d.

## Repository

Not under `cifra.md/` (the note does not start with `cifra.md:`). The work
lands in:

- `remarkable/qml/tests/` — new: the runner, its pinned requirements, the
  AppLoad stand-in module, the harness's own test and its fixture
  component.
- `remarkable/qml/harness/must-fail/` — new: one deliberately failing test,
  outside the runner's input, that the gate runs to prove the runner fails.
- `remarkable/.gitignore` — new (or extended): the runner's `.venv/`.
- `scripts/gate` — the QML step inside the reader block (L330–349).
- `.github/workflows/gate.yml` — only if the runner's offscreen Qt lacks a
  system library on `ubuntu-24.04` (provisioning, never a check).
- `remarkable/README.md` — a paragraph on running the QML tests.

No design delta: docs/remarkable-reader.md §9 already decides the level
("the QML, in Qt Quick's software renderer offscreen, against scripted
backend messages | `remarkable/qml/tests`, the gate") and DIRECTION §3.6
(L311) already names the reader as "Go, QML". What Qt runs the tests is a
test-time tool, not a runtime dependency of any shipped component.

## Inherited dependencies

- `reader.module` (complete 100) — `remarkable/` exists as a Go module and
  the gate runs its checks and cross-builds in the reader block
  (`scripts/gate` L330–349), guarded by `remarkable/go.mod`. This task adds
  a QML step to that block.
- Settled context, not in `depends`: `reader.protocol` (complete 100)
  fixed the message table both sides speak (design §6) — the stand-in
  plays and records messages in exactly that shape (an `int` type, a
  string payload of JSON); `reader.engine`, `reader.store`, `reader.sync`
  (complete 100) are backend-only and untouched.

Downstream: `reader.app_folder` (the QML root, tested against this
stand-in), `reader.qml_chart`, `reader.song_screen`,
`reader.browse_screens`, `reader.play`, `reader.missed_shapes`,
`reader.pairing` all name "behavior (QML: …)" tests that run here.

## What this task is

Give the reader's QML frontend a test level that runs in the gate, on the
gate's host, with no reMarkable and no AppLoad: a pinned Qt 6 installed
from pip (PySide6-Essentials), a small runner that is Qt's own
`qmltestrunner` (it calls Qt Quick Test's `quick_test_main` from that
install), run offscreen with Qt Quick's software renderer, over every
`tst_*.qml` under `remarkable/qml/tests/`; and a stand-in for AppLoad's
`net.asivery.AppLoad` QML module, so a component written against the real
`AppLoad { … }` endpoint is tested by playing backend messages into it and
reading back what it sent. One QML test of the harness itself proves the
loop works; the gate also proves the runner fails when a test fails.

## Why it needs to be done

Every QML task of the reader (app root, chart, song screen, browse
screens, play, missed shapes, pairing) lands with QML behavior tests, and a
test the gate does not run is not a test (tasks/refinements/README.md
§Tests: "a harness that exists must run"). The frontend runs inside
xochitl on an e-ink device nobody's CI has; without a host harness the
only check of a screen would be a person with a tablet. The AppLoad
stand-in is the seam that lets a screen be driven by the same messages the
backend sends (design §6) without the backend, the socket or the device.

## Inputs / context

- `tasks/85-reader.tji` L47–52 — the note: "Pin a Qt for the gate (for
  example PySide6 from pip, offscreen, with Qt Quick's software renderer,
  as the rM2 has no GPU) and a qmltestrunner over remarkable/qml/tests,
  with a stand-in for AppLoad's net.asivery.AppLoad module that records
  sendMessage and plays messageReceived".
- `docs/remarkable-reader.md`
  - §9 (L439–454): the Frontend row of the test table, and that the gate
    runs `remarkable/`'s checks after the app's.
  - §3.3 (L201–205): the frontend draws what the backend sends and sends
    back what was tapped; it computes no music and keeps no state the
    backend needs — so a frontend test is messages in, messages out, and
    what is drawn.
  - §6 (L323–370): the wire and the message table — AppLoad's own
    negative types are the backend's concern; the frontend sees only the
    positive types (1–11 it sends, 101–107 it receives), each payload
    JSON, an unknown type or field ignored.
- rm-appload at df974a6 (2026-10-06, the revision design §6 cites):
  - `src/AppLoad.h` — the QML type: `Q_PROPERTY(QString applicationID …)`,
    `Q_INVOKABLE void sendMessage(int type, const QString &string)`,
    `Q_INVOKABLE void terminate()`, `signal messageReceived(int type,
    QString contents)`.
  - `src/main.cpp` L61 — `qmlRegisterType<AppLoad>("net.asivery.AppLoad",
    1, 0, "AppLoad")`: a C++-registered type, imported as
    `import net.asivery.AppLoad 1.0`; built with `qmake6` (Qt 6).
  - `README.MD` §Applications' format — the root's `signal close` and
    `function unloading()`, and the endpoint usage
    `AppLoad { applicationID: …; onMessageReceived: (type, contents) => … }`.
- `scripts/gate`
  - L88–92: `TMP`, `step`, `skip`.
  - L330–349: the reader block (`go_checks "estante reader"` then the
    three cross-builds), guarded by `remarkable/go.mod`.
  - L430–442: the precedent for a Python venv the gate builds itself when
    absent (`cifra.md/reference/.venv`, `pip install --quiet`).
- `.github/workflows/gate.yml` — `actions/setup-python` (`python-version:
  "3"`) already provisions Python; the runner is `ubuntu-24.04`.
- Sibling refinement `tasks/refinements/reader/module.md` — the shape of
  the reader block (skip only while absent, bounded parallelism, nothing
  built into the tree), which this task follows.
- Measured while writing this refinement (2026-11-01, this host, Debian
  13, Python 3.13): `pip install PySide6-Essentials==6.12.0` ships Qt
  6.12.0 with `Qt/lib/libQt6QuickTest.so.6` exporting
  `quick_test_main(int, char**, const char*, const char*)`, the
  `QtTest` QML module, and the `offscreen` platform plugin — but **no
  `qmltestrunner` binary** (its `bin/` has `pyside6-qml`, `-qmllint`,
  `-rcc`, …, not the test runner). A ~15-line Python script calling
  `quick_test_main` through `ctypes` (the whole of Qt's own
  `qmltestrunner` `main`) with `QT_QPA_PLATFORM=offscreen`,
  `QT_QUICK_BACKEND=software`, `-import <stand-in dir> -input <tests dir>`
  ran a `TestCase` (`when: windowShown`) against a stand-in
  `net/asivery/AppLoad/` (qmldir + QML) and printed `PASS` per function
  with `Totals`, exit 0; a failing `compare` exited 1; a QML file that did
  not compile was reported as `FAIL! … compile()` and exited non-zero; a
  directory with no `tst_*.qml` exited 1. The offscreen plugin links
  `libGL`, `libEGL`, `libxkbcommon`, `libfontconfig`, `libX11`/`libxcb`
  and `glib` from the system.

## Constraints / requirements

- **A pinned Qt, from pip, in a venv the gate builds.**
  `remarkable/qml/tests/requirements.txt` pins `PySide6-Essentials==6.12.0`
  (exactly; with `--require-hashes` hashes for the manylinux x86_64 wheels
  of it and `shiboken6`). The gate creates `remarkable/qml/tests/.venv`
  when absent, and recreates it when `requirements.txt` is newer than a
  stamp file in the venv, the same way the cifra.md reference's venv is
  made (scripts/gate L430–442). The venv is gitignored. Nothing is
  installed system-wide; no apt Qt, no download outside pip.
- **The runner is Qt's runner.** `remarkable/qml/tests/run.py` loads
  `libQt6QuickTest.so.6` from the installed PySide6 and calls
  `quick_test_main(argc, argv, "estante-qml", NULL)` with the arguments it
  was given — so its flags, output and exit code are `qmltestrunner`'s
  (`-input`, `-import`, `-functions`, `-o file,format`, non-zero on any
  failure or compile error). It sets `QT_QPA_PLATFORM=offscreen` and
  `QT_QUICK_BACKEND=software` unless already set (the rM2 has no GPU:
  Qt Quick's software renderer is what the device draws with), and
  prepends `remarkable/qml/tests/appload` to the import path. It does not
  import PySide6's Python bindings beyond locating the library; it runs no
  Python test framework of its own. Run it with `python -I`.
- **The stand-in mirrors the real type, and nothing more.**
  `remarkable/qml/tests/appload/net/asivery/AppLoad/` — a `qmldir`
  (`module net.asivery.AppLoad`, `AppLoad 1.0 AppLoad.qml`) and
  `AppLoad.qml`, a `QtObject` with:
  - the real surface, same names and signatures: `property string
    applicationID`, `signal messageReceived(int type, string contents)`,
    `function sendMessage(type, contents)`, `function terminate()`;
  - `sendMessage` refuses what the real `Q_INVOKABLE (int, QString)` would
    silently mangle: a `type` that is not an integer, or `contents` that is
    not a string (an object passed instead of `JSON.stringify(…)` reaches
    the device as `[object Object]`) — it throws, so the test fails where
    the device would misbehave;
  - the test side: `readonly property var sent` (each `{ type, contents,
    payload }`, `payload` the parsed JSON), `signal messageSent(int type,
    string contents)` for `SignalSpy`, `property bool terminated`,
    `function play(type, payload)` — emits `messageReceived(type,
    typeof payload === "string" ? payload : JSON.stringify(payload))`, so
    a test scripts the backend's messages of design §6 as objects —
    and `function clear()`.
  The stand-in lives only under `tests/`: `reader.app_folder`'s
  `resources.rcc` must not carry it (that task's concern; this task keeps
  it out of any path the app's QML root would compile).
- **Messages as design §6 has them.** Types are the table's integers;
  payloads JSON text. The harness invents no message of its own: the
  fixture component in the harness test uses `1 hello` and `101 state`
  with the fields §6 gives them.
- **The gate.** Inside the reader block, after `go_checks` and the
  cross-builds, guarded by `remarkable/qml/tests/` existing (skip, saying
  so, otherwise — as every other block):
  1. build the venv if needed;
  2. `step "estante reader: QML tests"` — run the runner with
     `-input remarkable/qml/tests` and `-o -,txt` so every test function's
     `PASS`/`FAIL` line and the `Totals` line appear in the gate's output
     (the closer reads them); a non-zero exit fails the gate;
  3. `step "estante reader: QML runner fails a failing test"` — run it with
     `-input remarkable/qml/harness/must-fail` and fail the gate if that
     exits **zero**, so a runner that silently passes everything (a wrong
     library, a swallowed exit code) can never make every future QML test
     vacuous.
  If the venv cannot be built or the offscreen platform cannot start (a
  missing system library), the gate fails and says what to install — it
  never skips a harness that exists.
- **Bounded, and nothing in the tree.** One runner process, no
  parallelism to bound; `-o` writes nothing to the tree (results to
  stdout; any XML only under `$TMP`).
- **CI provisioning only if needed.** If the `ubuntu-24.04` runner lacks a
  library the offscreen plugin links (measured above: `libgl1`,
  `libegl1`, `libxkbcommon0`, `libfontconfig1`, `libglib2.0-0`, X11/xcb
  client libraries), `gate.yml` gains one `apt-get install` step before
  `Run scripts/gate`, commented as provisioning; the gate itself installs
  nothing system-wide.
- **No song text.** The harness test uses no song; later screen tests use
  the songs written for the purpose (the example book), never someone
  else's words.

## Acceptance criteria

### Behavior delivered

1. `remarkable/qml/tests/requirements.txt`, `run.py`, the stand-in module
   under `appload/net/asivery/AppLoad/`, and `remarkable/.gitignore`
   ignoring `qml/tests/.venv/`, as in Constraints.
2. `scripts/gate` runs the QML tests and the must-fail check in the reader
   block as above; a failing QML test, a QML compile error, or a runner
   that passes the must-fail test each fail the gate.
3. `remarkable/README.md` gains a paragraph: the QML tests, how to run
   them by hand (`python3 -m venv qml/tests/.venv && qml/tests/.venv/bin/pip
   install -r qml/tests/requirements.txt`, then `qml/tests/.venv/bin/python
   -I qml/tests/run.py -input qml/tests`), and that a screen is tested by
   `play`ing design §6's messages into the AppLoad stand-in and reading
   `sent`.
4. `.github/workflows/gate.yml` provisions any missing system library, if
   and only if CI shows one is missing.

### Tests, by level

- **behavior (QML)** — `remarkable/qml/tests/tst_harness.qml`, with its
  fixture `remarkable/qml/tests/HarnessProbe.qml` (a small `Item` holding
  an `AppLoad { applicationID: "estante" }` endpoint that, on completion,
  sends `1 hello` `{}`, and on `101 state` shows *Paired* or *Not paired*
  in a `Text` from the payload's `paired`; written as a screen will be,
  against the real type's surface). `TestCase` `name: "Harness"`,
  `when: windowShown`, functions:
  - `test_helloOnAttach` — the probe's `hello` is recorded: one `sent`
    entry, type `1`, payload `{}`, and `messageSent` spied once (design §6
    `1 hello`; AppLoad's `sendMessage(int, QString)`).
  - `test_answersScriptedState` — `play(101, { paired: true, syncing:
    false, online: true, lastSync: null, shapesShown: true })` changes the
    drawn text to *Paired*; `play(101, { …, paired: false })` back to
    *Not paired* (design §6 `101 state`; §3.3 the frontend draws what it
    is sent).
  - `test_unknownIgnored` — a played type the probe does not know (`199`)
    and a `state` with an unknown field change nothing and throw nothing
    (design §6: "each ignore a type they do not know, and a field they do
    not know").
  - `test_standInRefusesNonString` — `sendMessage(1, {})` and
    `sendMessage("1", "{}")` throw (the real `Q_INVOKABLE`'s types,
    rm-appload `src/AppLoad.h`).
  - `test_softwareRenderer` — the probe's attached `GraphicsInfo.api` is
    `GraphicsInfo.Software` (the rM2 has no GPU; design §9 "Qt Quick's
    software renderer offscreen").
  Run by the gate's "estante reader: QML tests" step; each function's
  `PASS` line is in the gate output.
- **gate self-check** — `remarkable/qml/harness/must-fail/tst_must_fail.qml`
  (one `TestCase` whose one function `compare(1, 2)`s), run by the gate's
  "QML runner fails a failing test" step, which passes only when the
  runner exits non-zero.

No unit or e2e level: the task delivers a harness, not a module with logic
of its own or a user-visible journey; the note names exactly the one QML
test above.

## Decisions

1. **PySide6-Essentials from pip, not an apt Qt, `aqtinstall`, or a
   container.** pip is already provisioned in CI and here, the wheel is
   self-contained (Qt libraries, QML modules, platform plugins), exactly
   pinnable and hashable, and ~260 MB in a venv. Debian/Ubuntu Qt packages
   differ between this host (Debian 13) and CI (Ubuntu 24.04) and cannot
   be pinned to one Qt; `aqtinstall` downloads the official SDK (with a
   real `qmltestrunner`) but is a ~1 GB download from a mirror outside
   pip's hashes; a container adds Docker to a step that needs none. Only
   `-Essentials` is pinned: it carries Qt Quick, Qt Quick Test and the
   QML engine; the Addons wheel (3D, web engine, …) is never needed.
2. **A ctypes call to `quick_test_main`, not a hand-rolled runner.** The
   wheel has no `qmltestrunner` binary, but Qt's own `qmltestrunner` is
   one call to `quick_test_main` — which the wheel's
   `libQt6QuickTest.so.6` exports with C-compatible arguments. Calling it
   gives Qt's flags, output and exit codes, and `TestCase`'s full runtime
   (`windowShown`, `SignalSpy`, `mouseClick`, `grabImage`), which a Python
   loop loading QML with `QQmlApplicationEngine` would not (`TestCase`
   needs the test root object that only `quick_test_main` installs).
   Compiling a C++ `qmltestrunner` would need a C++ toolchain and Qt
   headers in the gate for one line of `main`. Prototyped and green (see
   Inputs).
3. **The stand-in is a QML file module on the import path, not a C++
   plugin and not a mock injected per test.** The real `AppLoad` is
   imported by URI (`import net.asivery.AppLoad 1.0`), so a module of the
   same URI found first on the import path is what the screen's own
   `import` resolves to — the screen's QML is the shipped QML, unedited.
   A per-test injected object would need screens written to accept one, a
   seam the device does not have.
4. **The stand-in throws on a non-string payload or non-integer type**
   rather than coercing like the real one. The real `Q_INVOKABLE (int,
   QString)` turns an object into `[object Object]` and the backend drops
   it as bad JSON — a bug a test that only records would never see.
5. **Qt 6.12.0, the newest the wheel offers, rather than guessing the
   device's minor.** AppLoad is Qt 6 (built with `qmake6`); the design's
   measurements (§7) were made with Qt 6.12. Screens use versionless
   imports (`import QtQuick`) and the types every Qt 6 has; that the
   frontend loads on the device's own Qt is checked on the device when
   `reader.install` is exercised, not by this harness. Lowering the pin to
   the device's exact minor, once known, is a one-line change to
   `requirements.txt`.
6. **A must-fail check in the gate.** The cheapest proof that the runner's
   exit code is real. Without it, a broken runner turns every later QML
   test green silently.
7. **No `qmllint` step now.** `pyside6-qmllint` is in the same venv and
   would catch unresolved types, but there is no frontend QML to lint yet;
   `reader.app_folder`, which brings the first real QML, may add it.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-01.

- `remarkable/qml/tests/requirements.txt` pins PySide6-Essentials 6.12.0 (and shiboken6) with wheel hashes; `remarkable/.gitignore` ignores the venv.
- `remarkable/qml/tests/run.py` is Qt's `qmltestrunner` through ctypes on `quick_test_main` (loaded by its C++ mangled name, the only one exported), offscreen with the software renderer.
- `remarkable/qml/tests/appload/net/asivery/AppLoad/` (qmldir + AppLoad.qml) is the AppLoad stand-in: records `sent`, plays `messageReceived`, throws on a non-integer type, non-string contents, or contents that are not valid JSON (the last beyond the refinement).
- `remarkable/qml/tests/HarnessProbe.qml` and `tst_harness.qml`: five behavior tests (`test_helloOnAttach`, `test_answersScriptedState`, `test_unknownIgnored`, `test_standInRefusesNonString`, `test_softwareRenderer`), all PASS in the gate.
- `remarkable/qml/harness/must-fail/tst_must_fail.qml` is the self-check; `scripts/gate` builds the venv and runs both steps in the reader block.
- `remarkable/README.md` documents running the QML tests by hand. `.github/workflows/gate.yml` unchanged (no missing CI library known; the gate prints what to install if one is).

