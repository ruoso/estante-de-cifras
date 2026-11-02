// The song screen (reader.song_screen; workflow 19 §A song, §The screen, the
// refresh budget, §What it costs; docs/remarkable-reader.md §3.3, §6). Four
// regions, fixed in place: the bar (0–140), the chart, the strip (the bottom
// of the content, its height fixed for the song) and the foot (1772–1872).
// Each region replaces what it draws in one place and counts it in
// `revision`; an action replaces only the regions workflow 19's table names,
// each once:
//
//   turn a page                         chart, strip, foot
//   open / close the key grid           strip (the grid over the chart's foot
//                                       when the strip is shorter)
//   turn the strip; a question; Cancel  strip
//   hide or show a voicing              strip — chart, strip and foot when the
//                                       strip's rows change, laid out again
//                                       from the row at the top
//   Hide shapes / Show shapes           chart, strip, foot, from the row at
//                                       the top
//   choose a key; As written            chart, strip, foot and the key button
//   a new song                          every region
//   a shape found in the background     none: kept for the next page drawn
//
// The pressed control inverts at once, and one whose action waits on the
// backend stays inverted until the answer replaces its region (rule 7).
// What the person chooses is sent to the backend to keep (`endpoint`, the
// AppLoad item); the screen computes no music: key names, the transposed
// chart, which shapes are hidden and their models all come in the sheet.
import QtQuick
import "../chart"
import "../chart/metrics.js" as M
import "strip.js" as Strip
import "songstate.js" as SongState

Item {
    id: screen
    objectName: "songScreen"

    // The `105 sheet` payload shown, or null.
    property var sheet: null
    // `shapesShown` from the last `101 state` (shown before one).
    property bool shapesShown: true
    // The AppLoad item the screen sends through (design §6).
    property var endpoint: null

    readonly property SongBar bar: songBar
    readonly property Item chart: chartRegion
    readonly property ShapesStrip strip: shapesStrip
    readonly property SongFoot foot: songFoot
    readonly property SheetView view: sheetView
    readonly property var faces: sheetView.faces
    // The control waiting on the backend's answer, by name; "" for none.
    readonly property string pending: d.pending
    readonly property var stripInfo: d.stripInfo

    width: M.screenWidth
    height: M.barHeight + M.contentHeight + M.footHeight

    onSheetChanged: d.receive()

    // A `108 shapes` (reader.missed_shapes; design §4.1, §6): the empty places
    // of the sheet on screen it fills are kept for the next time the strip is
    // drawn — a page turned, the key grid closed, a voicing hidden — and
    // nothing is drawn now (workflow 19 rule 5). One for another song, key or
    // tuning is ignored.
    function found(shapes) {
        d.found(shapes);
    }
    onShapesShownChanged: d.reshape()

    // A sheet given before the chart can measure it is laid out once it can.
    Connections {
        target: sheetView
        function onReadyChanged() {
            if (d.shown === null)
                d.receive();
        }
    }

    QtObject {
        id: d

        // The sheet laid out, and the strip it was given.
        property var shown: null
        property var stripInfo: ({ size: "none", rows: 0, height: 0, pages: [] })
        // The strip's mode: "shapes", "hidden", "question" or "grid".
        property string mode: "shapes"
        property int stripPage: 0
        property var question: null
        property int questionIndex: -1
        property string pending: ""

        function send(type, payload) {
            if (screen.endpoint)
                screen.endpoint.sendMessage(type, JSON.stringify(payload));
        }

        function list(x) {
            return Strip.list(x);
        }

        // The sheet the chart lays out: its rows, and the shapes' notes as
        // one more notes row after the last (workflow 19 §A song as amended).
        function chartSheet(s) {
            const notes = list(s.notes).filter(n => typeof n === "string" && n !== "");
            if (notes.length === 0)
                return s;
            return Object.assign({}, s, { rows: list(s.rows).concat([{ type: "notes", paragraphs: notes }]) });
        }

        function hasShapes() {
            return d.shown !== null && list(d.shown.shapes).length > 0;
        }

        function hasKey() {
            return d.shown !== null && list(d.shown.key && d.shown.key.choices).length > 0;
        }

        // The strip and the pages for the song as it is now.
        function fixpoint() {
            if (!screen.shapesShown || !hasShapes())
                return { size: "none", rows: 0, height: 0, pages: sheetView.pagesFor(M.contentHeight) };
            return Strip.stripSize(h => sheetView.pagesFor(h), d.shown, M.contentHeight);
        }

        // The page holding a row, in a pagination: the last starting at or
        // before it (SheetView.pageOfRow's rule).
        function pageOf(pages, row) {
            let found = 0;
            for (let p = 0; p < pages.length; ++p) {
                if (pages[p].firstRow >= 0 && pages[p].firstRow <= row)
                    found = p;
            }
            return found;
        }

        function topRow() {
            const p = sheetView.pages[sheetView.page];
            return p && p.firstRow >= 0 ? p.firstRow : 0;
        }

        // "C", "D (+2)", "Bb (−3)": the offset as the grid's −5…+6, with a
        // true minus sign.
        function keyLabel(s) {
            if (!hasKey())
                return "";
            const named = s.key.named || "";
            let o = ((s.offset % 12) + 12) % 12;
            if (o > 6)
                o -= 12;
            if (o === 0)
                return named;
            return named + " (" + (o > 0 ? "+" + o : "−" + (-o)) + ")";
        }

        function asWrittenName(s) {
            if (s.key && s.key.written)
                return s.key.written;
            const choices = list(s.key && s.key.choices);
            for (const c of choices)
                if (c.offset === 0)
                    return c.name;
            return "";
        }

        // --- the regions' contents ---

        function commitBar() {
            const s = d.shown;
            songBar.show({ title: s.title || "", artist: s.artist || "", keyLabel: keyLabel(s) });
        }

        function commitFoot() {
            songFoot.show({
                page: sheetView.page,
                pageCount: sheetView.pageCount,
                shapes: hasShapes() ? (screen.shapesShown ? "hide" : "show") : ""
            });
        }

        function commitStrip() {
            const info = d.stripInfo;
            const page = sheetView.pages[sheetView.page];
            const ps = Strip.pageShapes(d.shown, page ? page.chords : []);
            let mode = d.mode;
            if (mode !== "grid" && info.size === "none")
                mode = "none";
            const shown = mode === "hidden" ? ps.hidden : ps.shown;
            const lay = Strip.drawn(info, shown.length);
            const onStrip = Strip.stripPage(shown, d.stripPage, lay.perPage);
            d.stripPage = onStrip.page;
            const s = d.shown;
            const saved = s.key && s.key.saved ? s.key.saved : "";
            const written = asWrittenName(s);
            screen.strip.show({
                mode: mode,
                size: info.size,
                rows: info.rows,
                height: info.height,
                layout: lay,
                strip: onStrip,
                shownCount: ps.shown.length,
                hiddenCount: ps.hidden.length,
                question: mode === "question" ? d.question : null,
                questionIndex: mode === "question" ? d.questionIndex : -1,
                grid: mode === "grid" ? {
                    choices: list(s.key && s.key.choices),
                    offset: s.offset,
                    asWritten: written,
                    yourKey: saved !== "" && saved !== written ? saved : ""
                } : null
            });
        }

        // --- laying out ---

        // A sheet received: a new song or key laid out from its first page,
        // or a re-voicing (Decision 8).
        function receive() {
            const s = screen.sheet;
            if (!s) {
                // No song: the next sheet is a new one. Nothing is redrawn —
                // the screen is not shown without a song.
                d.shown = null;
                d.pending = "";
                return;
            }
            if (!sheetView.ready)
                return;
            if (SongState.change(d.shown, s) === "revoiced") {
                revoice(s);
                return;
            }
            d.shown = s;
            d.mode = "shapes";
            d.stripPage = 0;
            d.question = null;
            d.questionIndex = -1;
            chartRegion.measure(chartSheet(s));
            layOut(-1);
            commitBar();
            d.pending = "";
        }

        // A `108` merged into the sheet held: no region replaced, no revision
        // moved, the strip's size kept (SongState.merge).
        function found(payload) {
            if (d.shown === null)
                return;
            const merged = SongState.merge(d.shown, payload);
            if (merged !== null)
                d.shown = merged;
        }

        // The song laid out again with the strip as it is now, from its first
        // page or from the page holding `row`.
        function layOut(row) {
            const info = fixpoint();
            d.stripInfo = info;
            chartRegion.show(M.contentHeight - info.height, row >= 0 ? pageOf(info.pages, row) : 0);
            commitStrip();
            commitFoot();
        }

        // A re-voicing: the strip only, unless the song's strip changes its
        // rows, when the chart is laid out again from the row at the top.
        function revoice(s) {
            const before = d.stripInfo;
            d.shown = s;
            d.question = null;
            d.questionIndex = -1;
            if (d.mode !== "hidden")
                d.mode = "shapes";
            const info = fixpoint();
            if (info.size === before.size && info.rows === before.rows && info.height === before.height) {
                d.stripInfo = info;
                commitStrip();
            } else {
                const row = topRow();
                d.stripInfo = info;
                chartRegion.show(M.contentHeight - info.height, pageOf(info.pages, row));
                commitStrip();
                commitFoot();
            }
            d.pending = "";
        }

        // Hide shapes / Show shapes answered: laid out again from the row at
        // the top (workflow 19 §A song).
        function reshape() {
            if (d.shown === null)
                return;
            const row = topRow();
            d.mode = "shapes";
            d.stripPage = 0;
            d.question = null;
            d.questionIndex = -1;
            layOut(row);
            d.pending = "";
        }

        // --- actions ---

        function turn(delta) {
            if (d.shown === null)
                return;
            const p = sheetView.page + delta;
            if (p < 0 || p >= sheetView.pageCount)
                return;
            d.mode = "shapes";
            d.stripPage = 0;
            d.question = null;
            d.questionIndex = -1;
            chartRegion.turn(p);
            commitStrip();
            commitFoot();
        }

        function stripMode(mode) {
            d.mode = mode;
            d.stripPage = 0;
            d.question = null;
            d.questionIndex = -1;
            commitStrip();
        }
    }

    // The chart: SheetView, 48 px from each side, turned by its thirds or a
    // swipe (workflow 19 §The screen, §A song "Turning"; rule 10: the thirds
    // are turn zones).
    Item {
        id: chartRegion
        objectName: "chart"
        x: 0
        y: M.barHeight
        width: screen.width
        height: 0

        readonly property int revision: cd.revision

        QtObject {
            id: cd
            property int revision: 0
        }

        // A new sheet measured, nothing paginated or drawn yet.
        function measure(sheet) {
            sheetView.height = 0;
            sheetView.sheet = sheet;
        }

        // The measured song paginated `height` tall, showing `page` — what
        // the chart draws, replaced.
        function show(height, page) {
            sheetView.height = 0;
            sheetView.page = page;
            chartRegion.height = height;
            sheetView.height = height;
            cd.revision += 1;
        }

        // The page shown, already prepared (rule 9).
        function turn(page) {
            sheetView.page = page;
            cd.revision += 1;
        }

        SheetView {
            id: sheetView
            x: M.contentSide
            y: 0
            width: M.chartWidth
            height: 0
        }

        MouseArea {
            id: turnZones
            objectName: "turnZones"
            x: 0
            y: 0
            width: chartRegion.width
            height: chartRegion.height
            property real fromX: 0
            property real fromY: 0
            onPressed: mouse => {
                fromX = mouse.x;
                fromY = mouse.y;
            }
            onReleased: mouse => {
                const dx = mouse.x - fromX;
                const dy = mouse.y - fromY;
                // A swipe: at least 120 px across, more across than down; one
                // turn, whatever its length. Right to left goes forward.
                if (Math.abs(dx) >= 120 && Math.abs(dx) > Math.abs(dy)) {
                    d.turn(dx < 0 ? 1 : -1);
                    return;
                }
                if (Math.abs(dx) >= 40 || Math.abs(dy) >= 40)
                    return;
                const third = Math.floor(fromX * 3 / width);
                if (third <= 0)
                    d.turn(-1);
                else if (third >= 2)
                    d.turn(1);
            }
        }
    }

    ShapesStrip {
        id: shapesStrip
        faces: sheetView.faces
        pending: d.pending
        onDiagramTapped: index => {
            const shape = shapesStrip.page.shapes[index];
            if (!shape || !shape.model)
                return;
            if (d.mode === "hidden") {
                d.pending = "show:" + index;
                d.send(8, { tuningId: d.shown.tuningId, chord: shape.chord, frets: shape.frets });
                return;
            }
            d.mode = "question";
            d.question = shape;
            d.questionIndex = index;
            d.commitStrip();
        }
        onHide: {
            if (!d.question || d.pending !== "")
                return;
            d.pending = "hide";
            d.send(7, { tuningId: d.shown.tuningId, chord: d.question.chord, frets: d.question.frets });
        }
        onCancel: d.stripMode("shapes")
        onShowHidden: d.stripMode("hidden")
        onDone: d.stripMode("shapes")
        onPreviousShapes: {
            if (shapesStrip.page.page <= 0)
                return;
            d.stripPage = shapesStrip.page.page - 1;
            d.commitStrip();
        }
        onMoreShapes: {
            if (shapesStrip.page.page >= shapesStrip.page.pages - 1)
                return;
            d.stripPage = shapesStrip.page.page + 1;
            d.commitStrip();
        }
        onKeyChosen: offset => {
            if (d.pending !== "")
                return;
            d.pending = "key:" + offset;
            d.send(3, { offset: offset });
        }
        onAsWritten: {
            if (d.pending !== "")
                return;
            d.pending = "asWritten";
            // With a saved key, null would open the song at it: As written is
            // the written key, offset 0 (Decision 7; design §6 as amended).
            const saved = d.shown.key && d.shown.key.saved;
            d.send(3, { offset: saved ? 0 : null });
        }
        onGridClosed: d.stripMode("shapes")
    }

    SongBar {
        id: songBar
        x: 0
        y: 0
        faces: sheetView.faces
        pending: d.pending
        visible: d.shown !== null
        onBackTapped: {
            if (d.shown !== null)
                d.send(2, { view: "book", bookId: d.shown.bookId });
        }
        onKeyTapped: {
            if (d.shown === null || !d.hasKey())
                return;
            d.stripMode(d.mode === "grid" ? "shapes" : "grid");
        }
    }

    SongFoot {
        id: songFoot
        x: 0
        y: M.barHeight + M.contentHeight
        faces: sheetView.faces
        pending: d.pending
        visible: d.shown !== null
        onPreviousTapped: d.turn(-1)
        onNextTapped: d.turn(1)
        onShapesTapped: {
            if (d.pending !== "")
                return;
            d.pending = "shapes";
            d.send(10, { shown: !screen.shapesShown });
        }
    }
}
