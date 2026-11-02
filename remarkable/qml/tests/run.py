"""Qt's own qmltestrunner, on the Qt pinned in requirements.txt.

The PySide6-Essentials wheel ships Qt Quick Test but no qmltestrunner binary;
qmltestrunner's whole main is one call to quick_test_main, which the wheel's
libQt6QuickTest.so.6 exports. This makes that call, with this script's
arguments, so its flags (-input, -import, -functions, -o file,format), output
and exit code are qmltestrunner's (reader.qml_harness).

Offscreen, with Qt Quick's software renderer (the reMarkable 2 has no GPU),
unless the environment says otherwise; the AppLoad stand-in (appload/) is first
on the import path, so `import net.asivery.AppLoad 1.0` resolves to it.

Run with `python -I`, e.g. `.venv/bin/python -I run.py -input .`.
"""

import ctypes
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STAND_IN = os.path.join(HERE, "appload")
QUICK_TEST_MAIN = "_Z15quick_test_mainiPPcPKcS2_"


def quick_test_library():
    spec = importlib.util.find_spec("PySide6")
    if spec is None or not spec.submodule_search_locations:
        sys.exit("run.py: PySide6 is not installed; "
                 "pip install --require-hashes -r requirements.txt")
    package = list(spec.submodule_search_locations)[0]
    path = os.path.join(package, "Qt", "lib", "libQt6QuickTest.so.6")
    if not os.path.exists(path):
        sys.exit(f"run.py: {path} not found")
    # RTLD_GLOBAL so the Qt libraries it pulls in are the wheel's own.
    return ctypes.CDLL(path, mode=ctypes.RTLD_GLOBAL)


def main():
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    os.environ.setdefault("QT_QUICK_BACKEND", "software")
    lib = quick_test_library()
    # int quick_test_main(int argc, char **argv, const char *name,
    #                     const char *sourceDir) — a C++ symbol, so by its
    # Itanium-mangled name; its arguments are plain C.
    quick_test_main = getattr(lib, QUICK_TEST_MAIN)
    quick_test_main.argtypes = [ctypes.c_int, ctypes.POINTER(ctypes.c_char_p),
                                ctypes.c_char_p, ctypes.c_char_p]
    quick_test_main.restype = ctypes.c_int

    args = ["qmltestrunner", "-import", STAND_IN] + sys.argv[1:]
    argv = (ctypes.c_char_p * (len(args) + 1))(
        *[os.fsencode(a) for a in args], None)
    sys.stdout.flush()
    code = quick_test_main(len(args), argv, b"estante-qml", None)
    # Exit without Python's teardown racing Qt's; the code is Qt's.
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(code)


if __name__ == "__main__":
    main()
