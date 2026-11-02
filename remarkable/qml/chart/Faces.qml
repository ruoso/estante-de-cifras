// The reader's three faces, loaded from its own files (reader.qml_chart;
// workflow 19 §The screen, as amended; docs/remarkable-reader.md §7). The
// files under ../fonts/ are the app's woff2 files byte for byte, each family
// with its LICENSE (app/src/theme/fonts/README.md). Figtree and Atkinson
// Hyperlegible Mono are variable; Atkinson Hyperlegible is 400 and 700. Each
// family is two files, latin and latin-ext, under one name. Nothing is
// laid out until `ready`, because measuring in a fallback face would
// paginate wrong.
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
        FontLoader { source: "../fonts/figtree/figtree-latin-wght-normal.woff2" },
        FontLoader { source: "../fonts/figtree/figtree-latin-ext-wght-normal.woff2" },
        FontLoader { source: "../fonts/atkinson-hyperlegible/atkinson-hyperlegible-latin-400-normal.woff2" },
        FontLoader { source: "../fonts/atkinson-hyperlegible/atkinson-hyperlegible-latin-ext-400-normal.woff2" },
        FontLoader { source: "../fonts/atkinson-hyperlegible/atkinson-hyperlegible-latin-700-normal.woff2" },
        FontLoader { source: "../fonts/atkinson-hyperlegible/atkinson-hyperlegible-latin-ext-700-normal.woff2" },
        FontLoader { source: "../fonts/atkinson-hyperlegible-mono/atkinson-hyperlegible-mono-latin-wght-normal.woff2" },
        FontLoader { source: "../fonts/atkinson-hyperlegible-mono/atkinson-hyperlegible-mono-latin-ext-wght-normal.woff2" }
    ]

    readonly property bool ready: {
        for (let i = 0; i < loaders.length; ++i) {
            if (loaders[i].status !== FontLoader.Ready)
                return false;
        }
        return true;
    }
}
