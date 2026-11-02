"""Load a built AppLoad folder the way AppLoad loads it (reader.app_folder).

For each folder given (…/estante/): register its resources.rcc under a random
root, as rm-appload's src/library.cpp L118 does
(QResource::registerResource(root + "/resources.rcc", "/" + id)); load
qrc:/<root>/Main.qml (the manifest's entry, L85) in a QQmlEngine whose import
path has the AppLoad stand-in, and create it with no error; check the root has
the close signal and the unloading() function AppLoad calls; and check the
resource tree carries none of the tests, the harness or the stand-in. It also
reads the manifest's entry and the backend's executable bit (design §2.1
step 7). Exit status non-zero on any failure (docs/remarkable-reader.md §9).

Run with the QML tests' venv: `.venv/bin/python -I check_folder.py DIR...`.
"""

import json
import os
import sys
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
STAND_IN = os.path.join(HERE, "appload")
FORBIDDEN = ("tests", "harness", "appload")


def check(folder, engine):
    from PySide6.QtCore import QDirIterator, QResource, QUrl
    from PySide6.QtQml import QQmlComponent

    problems = []
    with open(os.path.join(folder, "manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)
    entry = manifest.get("entry", "")
    if manifest.get("id") != "estante" or entry != "/Main.qml":
        problems.append(f"manifest id/entry {manifest.get('id')!r} {entry!r}")
    backend = os.path.join(folder, "backend", "entry")
    if not os.access(backend, os.X_OK):
        problems.append("backend/entry is not executable")

    root = "estante-" + uuid.uuid4().hex
    rcc = os.path.join(folder, "resources.rcc")
    if not QResource.registerResource(rcc, "/" + root):
        return problems + [f"{rcc}: QResource.registerResource refused it"]
    try:
        names = []
        it = QDirIterator(":/" + root, QDirIterator.IteratorFlag.Subdirectories)
        while it.hasNext():
            names.append(it.next()[len(":/" + root) + 1:])
        if "Main.qml" not in names:
            problems.append("the resources carry no Main.qml")
        for name in names:
            if any(part in FORBIDDEN for part in name.split("/")):
                problems.append(f"the resources carry {name}, which never ships")

        component = QQmlComponent(engine, QUrl("qrc:/" + root + entry))
        obj = component.create()
        if obj is None or component.isError():
            for e in component.errors():
                problems.append("QML: " + e.toString())
            if obj is None and not component.errors():
                problems.append("Main.qml did not create")
        else:
            meta = obj.metaObject()
            if meta.indexOfSignal("close()") < 0:
                problems.append("the root has no close signal")
            if meta.indexOfMethod("unloading()") < 0:
                problems.append("the root has no unloading() function")
            obj.deleteLater()
    finally:
        QResource.unregisterResource(rcc, "/" + root)
    return problems


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: check_folder.py FOLDER...")
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    os.environ.setdefault("QT_QUICK_BACKEND", "software")
    from PySide6.QtGui import QGuiApplication
    from PySide6.QtQml import QQmlEngine

    app = QGuiApplication(["check_folder"])
    failed = False
    for folder in sys.argv[1:]:
        engine = QQmlEngine()
        engine.addImportPath(STAND_IN)
        problems = check(folder, engine)
        engine.deleteLater()
        app.processEvents()
        if problems:
            failed = True
            for p in problems:
                print(f"check_folder: {folder}: {p}", file=sys.stderr)
        else:
            print(f"check_folder: {folder}: loads as AppLoad loads it")
    sys.stdout.flush()
    sys.stderr.flush()
    # Exit without Python's teardown racing Qt's (as run.py does).
    os._exit(1 if failed else 0)


if __name__ == "__main__":
    main()
