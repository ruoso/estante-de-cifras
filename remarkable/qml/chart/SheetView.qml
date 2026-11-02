// The chart, in pages (reader.qml_chart; workflow 19 §A song, as amended;
// docs/remarkable-reader.md §6 "The frontend lays the pages out", §7). It
// takes a `105 sheet` and the area it may use, and:
//   - turns `rows` into keep-together blocks (blocks.js);
//   - builds each block once, invisible, at a column's width, and measures it;
//   - decides one column or two: two, (width − 64) / 2 each, when the longest
//     sung line and the widest row of four bars both fit one at their natural
//     widths, else one of the full width;
//   - lays the song out into pages (paginate.js);
//   - draws the current page, with the next one already built, invisible;
//   - answers `pagesFor(height)`, the pages at another height, from the blocks
//     already measured (reader.song_screen: the strip's height). A new height
//     paginates the measured blocks again; only a new sheet or width measures.
// It draws the sheet's `rows` only — no bar, foot, strip or message; those
// are reader.song_screen's. It computes no music: it draws the text the rows
// carry and knows a chord by its token.key (design §3.3).
//
// The refresh budget (workflow 19): the layout is synchronous, so a page's
// items exist complete before it is visible (rule 1); nothing animates
// (rule 2); pages, never scrolling (rule 3); one bit, whole pixels (rule 6);
// the next page laid out ahead (rule 9). Nothing is laid out until the faces
// are loaded, because measuring in a fallback face would paginate wrong.
import QtQuick
import "blocks.js" as Blocks
import "paginate.js" as Paginate
import "metrics.js" as M

Item {
    id: view

    // The parsed `105 sheet` payload, or null.
    property var sheet: null
    // The page shown, 0-based.
    property int page: 0

    // The reader's faces; nothing is measured before they are ready.
    readonly property Faces faces: Faces {}
    property bool facesReady: faces.ready
    // Created and the faces loaded: a sheet given now is measured at once.
    readonly property bool ready: d.complete && facesReady

    // What the layout found.
    readonly property int pageCount: d.pages.length
    readonly property int columns: d.columns
    // Each page: { firstRow, chords: [token.key…] } — the page's chords in the
    // order they first appear on it, without repeats.
    readonly property var pages: d.pages
    // The page built ahead, or −1 on the last page (rule 9).
    readonly property int preparedPage: d.prepared
    // How many page items have been built since the last layout.
    readonly property int pagesBuilt: d.built
    // The layout itself: per page, per column, its slices
    // { unit, kind, from, to, rows: [rowIndex…], height, dropped? }.
    readonly property var layout: d.layout
    readonly property int columnWidth: d.columnWidth

    // The page that holds a row: the last page that starts at or before it
    // (so a row of bars continued from one page to the next is the second
    // page's top). Hide shapes stays at the bar that was at the top with it
    // (workflow 19 L248–256). −1 with no pages.
    function pageOfRow(rowIndex) {
        let found = -1;
        for (let p = 0; p < d.pages.length; ++p) {
            if (d.pages[p].firstRow <= rowIndex)
                found = p;
        }
        return found < 0 && d.pages.length > 0 ? 0 : found;
    }

    // The built item of page p, or null when it is not built.
    function pageItem(p) {
        return d.items[p] || null;
    }

    // The pages the measured blocks would make in columns `height` tall —
    // [{ firstRow, chords }], as `pages` — without building a page or
    // changing the one shown (reader.song_screen: the strip's height is found
    // by paginating at other heights, Decision 3). [] before anything is
    // measured.
    function pagesFor(height) {
        const h = Math.floor(height);
        if (d.units.length === 0 || h <= 0)
            return [];
        return d.summarise(Paginate.paginate(d.units, h, d.columns)).pages;
    }

    onSheetChanged: d.relayout()
    onWidthChanged: d.relayout()
    // A new height paginates the blocks already measured again: measuring is
    // the expensive part, and the width decides it, not the height.
    onHeightChanged: d.repaginate()
    onFacesReadyChanged: d.relayout()
    onPageChanged: d.show()
    Component.onCompleted: {
        d.complete = true;
        d.relayout();
    }

    QtObject {
        id: d
        property bool complete: false
        property var units: []
        property var pages: []
        property var layout: []
        property int columns: 0
        property int columnWidth: 0
        property int prepared: -1
        property int built: 0
        property var items: ({})

        // Let go of the built pages and the pagination; the measured blocks
        // stay.
        function clearPages() {
            for (const key in items)
                items[key].destroy();
            items = {};
            built = 0;
            prepared = -1;
            layout = [];
            pages = [];
        }

        function clear() {
            clearPages();
            units = [];
            columns = 0;
            columnWidth = 0;
        }

        // Measure every block of the sheet at the width, then paginate at the
        // height (a height of 0 measures only).
        function relayout() {
            if (!complete)
                return;
            clear();
            const rows = view.sheet ? Blocks.list(view.sheet.rows) : null;
            const fullWidth = Math.floor(view.width);
            if (!view.facesReady || rows === null || fullWidth <= 0)
                return;

            const found = Blocks.blocks(rows);
            // Measure: every block built once, invisible, at the full width
            // for the natural widths, then at the column's width.
            const measured = found.map(u => blockComponent.createObject(measuring, {
                pieces: u.pieces, faces: view.faces, width: fullWidth
            }));
            let natural = 0;
            for (const b of measured)
                natural = Math.max(natural, b.naturalWidth);
            const half = Math.floor((fullWidth - M.columnGap) / 2);
            const ncol = found.length > 0 && natural <= half ? 2 : 1;
            const width = ncol === 2 ? half : fullWidth;
            for (let i = 0; i < found.length; ++i) {
                if (ncol === 2)
                    measured[i].layout(width);
                found[i].height = measured[i].height;
                found[i].breakHeights = measured[i].pieceHeights();
                measured[i].destroy();
            }
            units = found;
            columns = ncol;
            columnWidth = width;
            repaginate();
        }

        // The measured blocks into pages at the height, and the page shown.
        function repaginate() {
            if (!complete)
                return;
            clearPages();
            const columnHeight = Math.floor(view.height);
            if (units.length === 0 || columnHeight <= 0)
                return;
            const result = summarise(Paginate.paginate(units, columnHeight, columns));
            layout = result.layout;
            pages = result.pages;
            show();
        }

        // paginate's answer → { pages: [{ firstRow, chords }], layout }.
        function summarise(result) {
            const found = units;
            const out = [];
            const slicesOut = [];
            for (const pg of result) {
                let firstRow = -1;
                const chords = [];
                const seen = {};
                const cols = [];
                for (const col of pg.columns) {
                    const slices = [];
                    for (const s of col) {
                        const u = found[s.unit];
                        const pieces = u.pieces.slice(s.from, s.to);
                        const rowsIn = [];
                        for (const piece of pieces) {
                            if (rowsIn.indexOf(piece.row) < 0)
                                rowsIn.push(piece.row);
                            if (s.dropped)
                                continue;
                            for (const key of Blocks.pieceChords(piece)) {
                                if (!seen[key]) {
                                    seen[key] = true;
                                    chords.push(key);
                                }
                            }
                        }
                        if (!s.dropped && firstRow < 0 && rowsIn.length)
                            firstRow = rowsIn[0];
                        slices.push({ unit: s.unit, kind: u.kind, from: s.from, to: s.to, rows: rowsIn,
                                      height: s.height, dropped: s.dropped === true });
                    }
                    cols.push(slices);
                }
                out.push({ firstRow: firstRow, chords: chords });
                slicesOut.push(cols);
            }
            return { pages: out, layout: slicesOut };
        }

        // Build page p, invisible, complete.
        function build(p) {
            if (items[p])
                return items[p];
            const item = pageComponent.createObject(view, { index: p, visible: false });
            const cols = layout[p];
            for (let c = 0; c < cols.length; ++c) {
                let y = 0;
                for (const s of cols[c]) {
                    if (s.dropped)
                        continue;
                    const b = blockComponent.createObject(item, {
                        pieces: units[s.unit].pieces.slice(s.from, s.to), faces: view.faces,
                        width: columnWidth, x: c * (columnWidth + M.columnGap), y: y
                    });
                    y += b.height;
                }
            }
            const next = Object.assign({}, items);
            next[p] = item;
            items = next;
            built += 1;
            return item;
        }

        // Show the current page, build the next one ahead, and let go of
        // pages further than one away.
        function show() {
            if (pages.length === 0)
                return;
            const p = Math.max(0, Math.min(view.page, pages.length - 1));
            const shown = build(p);
            const ahead = p + 1 < pages.length ? p + 1 : -1;
            if (ahead >= 0)
                build(ahead);
            const kept = {};
            for (const key in items) {
                const k = Number(key);
                if (k === p || k === ahead || k === p - 1)
                    kept[k] = items[key];
                else
                    items[key].destroy();
            }
            items = kept;
            for (const key in items)
                items[key].visible = Number(key) === p;
            prepared = ahead;
        }
    }

    // Where blocks are measured: built, never shown.
    Item {
        id: measuring
        visible: false
    }

    Component {
        id: blockComponent
        ChartBlock {}
    }

    Component {
        id: pageComponent
        Item {
            objectName: "page"
            property int index: -1
            width: view.width
            height: view.height
        }
    }
}
