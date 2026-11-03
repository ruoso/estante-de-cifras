// The song screen (reader.song_screen; workflow 19 §A song, §The screen, the
// refresh budget, §What it costs; docs/remarkable-reader.md §3.3, §6). Four
// regions, fixed in place: the bar (0–140), the chart, the strip (the bottom
// of the content, its height fixed for the song) and the foot (the screen's last 100 px).
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
//   a turn across songs (Play)          chart, strip, foot and the bar's
//                                       title, the next song laid out ahead
//   a neighbour read ahead (`109`)      none: laid out, invisible
//
// Played from a setlist (reader.play; workflow 19 §A setlist), the bar reads
// *3 of 12 · Garota*, the first page opens with the item's note (and *key: D*
// when the setlist's key cannot be applied), the last ends with *Next: Asa
// Branca, in G* and its note, and the turns cross songs: the next song is
// laid out ahead in a second, invisible SheetView, so a turn onto it swaps
// the views (rule 9); the previous one is laid out on the turn, at its last
// page. A turn whose neighbour has not arrived opens it and waits on the old
// page (rule 1). Each song shown is sent as `11 place`, for Back.
//
// The pressed control inverts at once, and one whose action waits on the
// backend stays inverted until the answer replaces its region (rule 7).
// What the person chooses is sent to the backend to keep (`endpoint`, the
// AppLoad item); the screen computes no music: key names, the transposed
// chart, which shapes are hidden and their models all come in the sheet.
import QtQuick
import "../browse/pages.js" as Pages
import "../chart"
import "../chart/metrics.js" as M
import "strip.js" as Strip
import "songstate.js" as SongState

Item {
    id: screen
    objectName: "songScreen"

    // The `105 sheet` payload shown, or null.
    property var sheet: null
    // The `106 setlist` Play started from (the setlist screen's, kept alive):
    // a played sheet's place and neighbours are its rows (reader.play).
    property var setlist: null
    // `shapesShown` from the last `101 state` (shown before one).
    property bool shapesShown: true
    // The AppLoad item the screen sends through (design §6).
    property var endpoint: null

    readonly property SongBar bar: songBar
    readonly property Item chart: chartRegion
    readonly property ShapesStrip strip: shapesStrip
    readonly property SongFoot foot: songFoot
    // The chart's view shown, and the other one, invisible, where the next
    // song of a setlist is laid out ahead (reader.play).
    readonly property SheetView view: d.front
    readonly property SheetView aheadView: d.back
    readonly property var faces: viewA.faces
    // The played sheet's place ({ at, n, of, next, previous, note }), or null.
    readonly property var place: d.place
    // The neighbours held: { next, previous } — `109` payloads or null.
    readonly property var held: d.held
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

    // A `109 ahead` (reader.play): held when it is the played song's next or
    // previous playable item, the next laid out at once, invisible; anything
    // else is ignored. Nothing is drawn (rule 5).
    function ahead(sheet) {
        d.ahead(sheet);
    }
    onShapesShownChanged: d.reshape()

    // A sheet given before the chart can measure it is laid out once it can.
    Connections {
        target: viewA
        function onReadyChanged() {
            d.whenReady();
        }
    }
    Connections {
        target: viewB
        function onReadyChanged() {
            d.whenReady();
        }
    }

    QtObject {
        id: d

        // The sheet laid out, and the strip it was given.
        property var shown: null
        property var stripInfo: ({ size: "none", rows: 0, height: 0, pages: [] })
        // The strip's mode: "shapes", "hidden", "question", "grid" or
        // "variations".
        property string mode: "shapes"
        property int stripPage: 0
        property var question: null
        property int questionIndex: -1
        property string pending: ""

        // The view shown and the one laid out ahead (reader.play).
        property SheetView front: viewA
        property SheetView back: viewB
        // The played sheet's place, or null (SongState.place).
        property var place: null
        // The neighbours read ahead (`109`), and which the back view holds
        // laid out: the next one's row, with its strip, −1 for none.
        property var held: ({ next: null, previous: null })
        property int backFor: -1
        property var backInfo: null
        // The row last sent as `11 place`, −1 for none.
        property int placed: -1

        function send(type, payload) {
            if (screen.endpoint)
                screen.endpoint.sendMessage(type, JSON.stringify(payload));
        }

        function list(x) {
            return Strip.list(x);
        }

        function hasShapes() {
            return d.shown !== null && list(d.shown.shapes).length > 0;
        }

        function whenReady() {
            if (!viewA.ready || !viewB.ready)
                return;
            if (d.shown === null)
                d.receive();
            else
                prepareNext();
        }

        // The song's variations for its tuning, when it has a choice of two
        // or more (the backend lists none otherwise).
        function variations(s) {
            const v = list(s && s.variations);
            return v.length > 1 ? v : [];
        }

        // The variation button's words: the one read, at the written key
        // only; "" hides it (its room stays, SongBar).
        function variationLabel(s) {
            if (variations(s).length === 0 || ((s.offset % 12) + 12) % 12 !== 0)
                return "";
            return Pages.variationName(s.variation);
        }

        function hasKey() {
            return d.shown !== null && list(d.shown.key && d.shown.key.choices).length > 0;
        }

        // The strip and the pages for the song as it is now.
        function fixpoint() {
            return fixpointOf(d.front, d.shown);
        }

        // The strip and the pages for sheet s, measured in view.
        function fixpointOf(view, s) {
            if (!screen.shapesShown || list(s && s.shapes).length === 0)
                return { size: "none", rows: 0, height: 0, pages: view.pagesFor(M.contentHeight) };
            return Strip.stripSize(h => view.pagesFor(h), s, M.contentHeight);
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
            const p = d.front.pages[d.front.page];
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
            songBar.show({
                title: SongState.barTitle(s, d.place), artist: s.artist || "", keyLabel: keyLabel(s),
                variations: variations(s).length > 0, variationLabel: variationLabel(s)
            });
        }

        function commitFoot() {
            songFoot.show({
                page: d.front.page,
                pageCount: d.front.pageCount,
                shapes: hasShapes() ? (screen.shapesShown ? "hide" : "show") : "",
                before: d.place !== null && d.place.before,
                after: d.place !== null && d.place.after
            });
        }

        function commitStrip() {
            const info = d.stripInfo;
            const page = d.front.pages[d.front.page];
            const ps = Strip.pageShapes(d.shown, page ? page.chords : []);
            let mode = d.mode;
            if (mode !== "grid" && mode !== "variations" && info.size === "none")
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
                } : null,
                variations: mode === "variations" ? {
                    variations: variations(s),
                    current: s.variation === null || s.variation === undefined ? "" : s.variation
                } : null
            });
        }

        // --- laying out ---

        // A sheet received: a new song or key laid out from its first page,
        // or a re-voicing (Decision 8).
        function receive() {
            const s = screen.sheet;
            if (!s) {
                // No song: the next sheet is a new one, and nothing played is
                // held. Nothing is redrawn — the screen is not shown without
                // a song.
                d.shown = null;
                d.place = null;
                d.held = { next: null, previous: null };
                d.backFor = -1;
                d.placed = -1;
                d.pending = "";
                return;
            }
            if (!viewA.ready || !viewB.ready)
                return;
            if (SongState.change(d.shown, s) === "revoiced") {
                revoice(s);
                return;
            }
            d.shown = s;
            d.place = SongState.place(s, screen.setlist);
            d.mode = "shapes";
            d.stripPage = 0;
            d.question = null;
            d.questionIndex = -1;
            chartRegion.measure(SongState.chartSheet(s, d.place));
            layOut(-1);
            commitBar();
            d.pending = "";
            keepNeighbours();
            sendPlace();
        }

        // --- playing a setlist (reader.play) ---

        // The neighbours held for another place are let go; those of this
        // one are kept (a key chosen during Play keeps them, backend_views
        // Decision 6), the next laid out ahead if it is not already.
        function keepNeighbours() {
            const p = d.place;
            const h = d.held;
            const keep = (x, at) => x !== null && p !== null && at >= 0 && x.play.at === at
                                    && x.play.setlist === d.shown.play.setlist && x.bookId === d.shown.bookId;
            d.held = { next: keep(h.next, p ? p.next : -1) ? h.next : null,
                       previous: keep(h.previous, p ? p.previous : -1) ? h.previous : null };
            prepareNext();
        }

        // The played song shown is the place Back returns to.
        function sendPlace() {
            const p = d.place;
            if (p === null || p.at === d.placed)
                return;
            d.placed = p.at;
            send(11, { bookId: d.shown.bookId, setlist: d.shown.play.setlist, at: p.at });
        }

        function ahead(s) {
            const p = d.place;
            if (d.shown === null || p === null || !s || !s.play || typeof s.play.at !== "number")
                return;
            if (s.bookId !== d.shown.bookId || s.play.setlist !== d.shown.play.setlist)
                return;
            if (s.play.at === p.next && p.next >= 0) {
                d.held = { next: s, previous: d.held.previous };
                d.backFor = -1;
                prepareNext();
            } else if (s.play.at === p.previous && p.previous >= 0) {
                d.held = { next: d.held.next, previous: s };
            }
        }

        // The held next song measured and paginated in the back view, its
        // first page (and the one after) built, invisible — before any turn
        // (rule 9).
        function prepareNext() {
            const s = d.held.next;
            if (s === null || d.backFor === s.play.at || !d.back.ready)
                return;
            layOutBack(s, 0);
        }

        // Sheet s laid out in the back view with its strip, showing page
        // `page` (−1 for its last).
        function layOutBack(s, page) {
            const v = d.back;
            const place = SongState.place(s, screen.setlist);
            v.height = 0;
            v.page = 0;
            v.sheet = SongState.chartSheet(s, place);
            const info = fixpointOf(v, s);
            v.page = page >= 0 ? page : Math.max(0, info.pages.length - 1);
            v.height = M.contentHeight - info.height;
            d.backFor = s.play.at;
            d.backInfo = info;
        }

        // A turn across songs: onto the next song's first page (delta +1) or
        // the previous one's last (−1). Held, it is one commit of the chart,
        // the strip, the foot and the bar; not yet arrived, it is opened and
        // the old page stays until its `105` (rule 1).
        function cross(delta) {
            const p = d.place;
            const at = delta > 0 ? p.next : p.previous;
            if (at < 0 || d.pending !== "")
                return;
            const s = delta > 0 ? d.held.next : d.held.previous;
            if (s === null) {
                d.pending = "cross";
                send(2, { view: "song", bookId: d.shown.bookId, path: screen.setlist.items[at].path,
                          play: { setlist: d.shown.play.setlist, at: at } });
                d.placed = at;
                send(11, { bookId: d.shown.bookId, setlist: d.shown.play.setlist, at: at });
                return;
            }
            if (delta < 0 || d.backFor !== at)
                layOutBack(s, delta > 0 ? 0 : -1);
            const left = d.shown;
            const info = d.backInfo;
            const v = d.back;
            d.back = d.front;
            d.front = v;
            d.backFor = -1;
            d.shown = s;
            d.place = SongState.place(s, screen.setlist);
            d.held = { next: delta < 0 ? left : null, previous: delta > 0 ? left : null };
            d.mode = "shapes";
            d.stripPage = 0;
            d.question = null;
            d.questionIndex = -1;
            d.stripInfo = info;
            chartRegion.swapped(M.contentHeight - info.height);
            commitStrip();
            commitFoot();
            commitBar();
            sendPlace();
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
            // The next song laid out ahead again, with the strip as it is now.
            d.backFor = -1;
            prepareNext();
        }

        // --- actions ---

        function turn(delta) {
            if (d.shown === null)
                return;
            const p = d.front.page + delta;
            if ((p < 0 || p >= d.front.pageCount) && d.place !== null) {
                cross(delta);
                return;
            }
            if (p < 0 || p >= d.front.pageCount)
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
            d.front.height = 0;
            d.front.sheet = sheet;
        }

        // The measured song paginated `height` tall, showing `page` — what
        // the chart draws, replaced.
        function show(height, page) {
            d.front.height = 0;
            d.front.page = page;
            chartRegion.height = height;
            d.front.height = height;
            cd.revision += 1;
        }

        // The page shown, already prepared (rule 9).
        function turn(page) {
            d.front.page = page;
            cd.revision += 1;
        }

        // The views swapped: the one laid out ahead shown, `height` tall —
        // what the chart draws, replaced (reader.play).
        function swapped(height) {
            chartRegion.height = height;
            cd.revision += 1;
        }

        // Two views, one shown: the other holds the next song of a setlist,
        // laid out ahead and invisible (reader.play; rule 9).
        SheetView {
            id: viewA
            objectName: "viewA"
            visible: d.front === viewA
            x: M.contentSide
            y: 0
            width: M.chartWidth
            height: 0
        }

        SheetView {
            id: viewB
            objectName: "viewB"
            visible: d.front === viewB
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
        faces: viewA.faces
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
        onVariationChosen: variation => {
            if (d.pending !== "")
                return;
            if (variation === d.shown.variation) {
                d.stripMode("shapes");
                return;
            }
            d.pending = "variation:" + variation;
            d.send(13, { variation: variation });
        }
        onVariationsClosed: d.stripMode("shapes")
    }

    SongBar {
        id: songBar
        x: 0
        y: 0
        faces: viewA.faces
        pending: d.pending
        visible: d.shown !== null
        onBackTapped: {
            if (d.shown === null)
                return;
            // Played, Back returns to the setlist, at the page holding the
            // song (its `106` carries the place); else to the book.
            if (d.place !== null)
                d.send(2, { view: "setlist", bookId: d.shown.bookId, path: d.shown.play.setlist });
            else
                d.send(2, { view: "book", bookId: d.shown.bookId });
        }
        onKeyTapped: {
            if (d.shown === null || !d.hasKey())
                return;
            d.stripMode(d.mode === "grid" ? "shapes" : "grid");
        }
        onVariationTapped: {
            if (d.shown === null || d.variationLabel(d.shown) === "")
                return;
            d.stripMode(d.mode === "variations" ? "shapes" : "variations");
        }
    }

    SongFoot {
        id: songFoot
        x: 0
        y: M.barHeight + M.contentHeight
        faces: viewA.faces
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
