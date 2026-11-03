#!/usr/bin/env python3
"""convert.py — the reader's faces as TrueType, from the app's woff2 files.

The reader draws with the app's three faces (docs/remarkable-reader.md §7),
but the reMarkable's Qt cannot read woff2: its FreeType is built without
Brotli, so every FontLoader of a woff2 file fails there (and the chart, which
lays out only once its faces are loaded, would wait on them). So the reader
carries each of the app's woff2 files (app/src/theme/fonts/, kept as
published) decoded to a .ttf under remarkable/qml/fonts/, same family, same
name, same subset; only the container changes, which the SIL OFL 1.1 the
faces are under permits (none declares a Reserved Font Name). Each family's
LICENSE is copied as it is.

qml/fonts/sources.json records, for each .ttf, the woff2 it was decoded from
and that file's SHA-256: tools/appfolder's tests fail when an app font changes
and this has not been run again.

Run from remarkable/, with fontTools and brotli (pip install fonttools
brotli):

    python3 tools/fonts/convert.py
"""

import hashlib
import json
import shutil
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

# The families the reader loads (qml/chart/Faces.qml), each file as the app
# names it.
FAMILIES = {
    "figtree": [
        "figtree-latin-wght-normal",
        "figtree-latin-ext-wght-normal",
    ],
    "atkinson-hyperlegible": [
        "atkinson-hyperlegible-latin-400-normal",
        "atkinson-hyperlegible-latin-ext-400-normal",
        "atkinson-hyperlegible-latin-700-normal",
        "atkinson-hyperlegible-latin-ext-700-normal",
    ],
    "atkinson-hyperlegible-mono": [
        "atkinson-hyperlegible-mono-latin-wght-normal",
        "atkinson-hyperlegible-mono-latin-ext-wght-normal",
    ],
}


def main() -> int:
    here = Path.cwd()
    app_fonts = here / ".." / "app" / "src" / "theme" / "fonts"
    out = here / "qml" / "fonts"
    if not (here / "go.mod").is_file() or not app_fonts.is_dir():
        print("run from remarkable/ in a checkout", file=sys.stderr)
        return 2
    if out.exists():
        shutil.rmtree(out)
    sources = {}
    for family, names in FAMILIES.items():
        (out / family).mkdir(parents=True)
        shutil.copyfile(app_fonts / family / "LICENSE", out / family / "LICENSE")
        for name in names:
            src = app_fonts / family / (name + ".woff2")
            dst = out / family / (name + ".ttf")
            font = TTFont(src)
            font.flavor = None
            font.save(dst)
            sources[f"{family}/{name}.ttf"] = {
                "from": f"app/src/theme/fonts/{family}/{name}.woff2",
                "sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
            }
    (out / "sources.json").write_text(json.dumps(sources, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
