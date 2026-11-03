// The reader's three faces, loaded from its own files (reader.qml_chart;
// workflow 19 §The screen, as amended; docs/remarkable-reader.md §7). The
// files under ../fonts/ are the app's woff2 files decoded to TrueType
// (tools/fonts/convert.py; sources.json names each one's woff2): the
// reMarkable's Qt cannot read woff2 (its FreeType has no Brotli). Each family
// keeps its LICENSE. Figtree and Atkinson Hyperlegible Mono are variable;
// Atkinson Hyperlegible is 400 and 700. Each family is two files, latin and
// latin-ext, under one name. Nothing is laid out until `ready`, because
// measuring in a fallback face would paginate wrong — but a face that fails
// to load counts as settled (`failed`), so a missing face draws the song in
// the fallback rather than never.
import QtQuick

QtObject {
    id: faces

    // The families as Qt registered them. A variable face registers under
    // its default instance's name (Figtree's reads "Figtree Light", the
    // mono's "Atkinson Hyperlegible Mono ExtraLight"), so text takes the
    // family from its loader and its weight from `font.variableAxes`.
    readonly property string chart: loaders[0].name
    readonly property string ui: loaders[2].name
    readonly property string mono: loaders[6].name

    readonly property list<FontLoader> loaders: [
        FontLoader { source: "../fonts/figtree/figtree-latin-wght-normal.ttf" },
        FontLoader { source: "../fonts/figtree/figtree-latin-ext-wght-normal.ttf" },
        FontLoader { source: "../fonts/atkinson-hyperlegible/atkinson-hyperlegible-latin-400-normal.ttf" },
        FontLoader { source: "../fonts/atkinson-hyperlegible/atkinson-hyperlegible-latin-ext-400-normal.ttf" },
        FontLoader { source: "../fonts/atkinson-hyperlegible/atkinson-hyperlegible-latin-700-normal.ttf" },
        FontLoader { source: "../fonts/atkinson-hyperlegible/atkinson-hyperlegible-latin-ext-700-normal.ttf" },
        FontLoader { source: "../fonts/atkinson-hyperlegible-mono/atkinson-hyperlegible-mono-latin-wght-normal.ttf" },
        FontLoader { source: "../fonts/atkinson-hyperlegible-mono/atkinson-hyperlegible-mono-latin-ext-wght-normal.ttf" }
    ]

    // Every loader settled: loaded, or failed to.
    readonly property bool ready: {
        for (let i = 0; i < loaders.length; ++i) {
            const st = loaders[i].status;
            if (st !== FontLoader.Ready && st !== FontLoader.Error)
                return false;
        }
        return true;
    }

    // A loader failed: its face is drawn in Qt's fallback.
    readonly property bool failed: {
        for (let i = 0; i < loaders.length; ++i) {
            if (loaders[i].status === FontLoader.Error)
                return true;
        }
        return false;
    }
}
