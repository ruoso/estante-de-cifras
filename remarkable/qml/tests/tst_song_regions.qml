// behavior — each action replaces only its region, once (reader.song_screen
// Decision 2; workflow 19 §What it costs, rules 1, 4, 5 and 7). Every check
// is made twice: by pixels — grabImage of each region before and after,
// equal where the table says untouched — and by `revision`, exactly +1 per
// replaced region per action, so no intermediate state is drawn.
//
// grabImage crops the window's grab at the item's own x and y, so every grab
// goes through a probe item hosted in the window's root at the scene
// rectangle wanted (the screen is hosted there too, at 0, 0).
import QtQuick
import QtTest
import net.asivery.AppLoad 1.0
import ".."
import "../song"
import "../song/strip.js" as Strip
import "../chart/metrics.js" as M
import "fixtures/few-chords.js" as FewChords
import "fixtures/few-chords-up2.js" as FewChordsUp2
import "fixtures/strip-17.js" as Strip17
import "fixtures/choro-long.js" as ChoroLong
import "fixtures/found-shape.js" as FoundShape
import "walk.js" as Walk

TestCase {
    id: testCase
    name: "SongRegions"
    when: windowShown
    width: 1404
    height: 1872

    Component {
        id: endpointComponent
        AppLoad {
            applicationID: "estante"
        }
    }

    Component {
        id: screenComponent
        SongScreen {}
    }

    Component {
        id: mainComponent
        Main {}
    }

    Component {
        id: probeComponent
        Item {}
    }

    function clone(x) {
        return JSON.parse(JSON.stringify(x));
    }

    function open(sheet) {
        const endpoint = createTemporaryObject(endpointComponent, testCase);
        const screen = createTemporaryObject(screenComponent, testCase.parent,
                                             { endpoint: endpoint, sheet: clone(sheet) });
        verify(screen !== null);
        compare(screen.view.ready, true);
        return screen;
    }

    // The window's pixels in a scene rectangle.
    function grabRect(x, y, w, h) {
        const probe = probeComponent.createObject(testCase.parent, { x: x, y: y, width: w, height: h });
        const image = grabImage(probe);
        probe.destroy();
        return image;
    }

    // The window's pixels where an item is.
    function grab(item) {
        const at = item.mapToItem(null, 0, 0);
        return grabRect(Math.round(at.x), Math.round(at.y), item.width, item.height);
    }

    // The four regions' pixels and revisions now.
    function snapshot(screen) {
        waitForRendering(screen);
        const s = { revisions: {}, pixels: {} };
        for (const name of ["bar", "chart", "strip", "foot"]) {
            s.revisions[name] = screen[name].revision;
            s.pixels[name] = screen[name].height > 0 ? grab(screen[name]) : null;
        }
        return s;
    }

    // Which regions' revisions moved, by how much.
    function moved(before, screen) {
        const out = {};
        for (const name of ["bar", "chart", "strip", "foot"])
            out[name] = screen[name].revision - before.revisions[name];
        return out;
    }

    // Regions whose pixels are unchanged since `before`.
    function samePixels(before, screen, names) {
        waitForRendering(screen);
        for (const name of names) {
            verify(before.pixels[name] !== null, name);
            verify(grab(screen[name]).equals(before.pixels[name]), name + "'s pixels changed");
        }
    }

    function cells(screen) {
        const out = [];
        for (let i = 0; i < screen.strip.diagrams.count; ++i)
            out.push(screen.strip.diagrams.itemAt(i));
        return out;
    }

    function keyNamed(screen, name) {
        const keys = screen.strip.grid.keys;
        for (let i = 0; i < keys.count; ++i)
            if (keys.itemAt(i).text === name)
                return keys.itemAt(i);
        return null;
    }

    // A region's pixels around a control: the four bands of the region
    // outside the control's rectangle.
    function around(region, control) {
        const r = region.mapToItem(null, 0, 0);
        const c = control.mapToItem(null, 0, 0);
        const rx = Math.round(r.x), ry = Math.round(r.y);
        const cx = Math.round(c.x), cy = Math.round(c.y);
        const bands = [
            [rx, ry, region.width, cy - ry],
            [rx, cy + control.height, region.width, ry + region.height - cy - control.height],
            [rx, cy, cx - rx, control.height],
            [cx + control.width, cy, rx + region.width - cx - control.width, control.height]
        ];
        return bands.filter(b => b[2] > 0 && b[3] > 0).map(b => grabRect(b[0], b[1], b[2], b[3]));
    }

    function sameImages(a, b, what) {
        compare(a.length, b.length, what);
        for (let i = 0; i < a.length; ++i)
            verify(a[i].equals(b[i]), what + ": band " + i + " changed");
    }

    // Rule 7: pressing a control makes it black at once — a pixel of its
    // paper, under its top edge, reads black — the rest of its region keeps
    // its pixels, and no region's revision moves before release and answer.
    function test_pressInvertsOnlyTheControl() {
        const screen = open(FewChords.sheet);
        mouseClick(screen.bar.keyButton);           // the grid open, for a key
        mouseClick(screen.strip.grid.closeButton);
        const controls = [
            [screen.bar.keyButton, screen.bar, false],
            [screen.foot.shapesButton, screen.foot, true],
            [cells(screen)[0], screen.strip, false]
        ];
        for (const [control, region, waits] of controls)
            pressAndCheck(screen, control, region, waits);
        // A grid key: its region is the strip, the grid open.
        mouseClick(screen.bar.keyButton);
        compare(screen.strip.mode, "grid");
        pressAndCheck(screen, keyNamed(screen, "A"), screen.strip, true);
    }

    function pressAndCheck(screen, control, region, waits) {
        const before = snapshot(screen);
        const aroundBefore = around(region, control);
        // Under a 3 px border, above any word or symbol.
        const paper = 6;
        const pixelBefore = grab(control).pixel(Math.floor(control.width / 2), paper);
        compare(pixelBefore, Qt.color("white"), String(control));
        mousePress(control);
        waitForRendering(screen);
        compare(grab(control).pixel(Math.floor(control.width / 2), paper), Qt.color("black"), String(control));
        sameImages(around(region, control), aroundBefore, String(control));
        compare(moved(before, screen), { bar: 0, chart: 0, strip: 0, foot: 0 });
        mouseRelease(control);
        if (waits) {
            // Its action waits on the backend: still black, nothing replaced.
            waitForRendering(screen);
            compare(grab(control).pixel(Math.floor(control.width / 2), paper), Qt.color("black"), String(control));
            compare(moved(before, screen), { bar: 0, chart: 0, strip: 0, foot: 0 });
            verify(screen.pending !== "");
        }
        // Back to a resting screen for the next control: the backend's answer
        // to what was sent, or the question or the grid closed.
        if (waits)
            screen.sheet = clone(screen.pending.indexOf("key:") === 0 ? FewChordsUp2.sheet : screen.sheet);
        compare(screen.pending, "");
        if (screen.strip.mode === "question")
            mouseClick(screen.strip.cancelButton);
        if (screen.strip.mode === "grid")
            mouseClick(screen.strip.grid.closeButton);
    }

    // Costs table, row 5: opening and closing the grid replaces the strip
    // only, once each.
    function test_keyGridOnlyTheStrip() {
        const screen = open(ChoroLong.sheet);
        verify(screen.strip.height >= M.keyGridHeight);
        const before = snapshot(screen);
        mouseClick(screen.bar.keyButton);
        compare(moved(before, screen), { bar: 0, chart: 0, strip: 1, foot: 0 });
        samePixels(before, screen, ["bar", "chart", "foot"]);
        verify(!grab(screen.strip).equals(before.pixels.strip));
        const open1 = snapshot(screen);
        mouseClick(screen.strip.grid.closeButton);
        compare(moved(open1, screen), { bar: 0, chart: 0, strip: 1, foot: 0 });
        samePixels(open1, screen, ["bar", "chart", "foot"]);
        samePixels(before, screen, ["strip"]);
    }

    // §A song L256–259 as amended: a one-row compact strip (321 px) is shorter
    // than the grid, which covers the chart's foot; the bar, the foot and the
    // chart above the grid are unchanged, and closing restores the chart's
    // pixels exactly. The same with the shapes hidden.
    function test_keyGridOverChartWhenStripShort() {
        const screen = open(FewChords.sheet);
        compare(screen.strip.height, 321);
        verify(screen.strip.height < M.keyGridHeight);
        gridOverChart(screen);
        screen.shapesShown = false;
        compare(screen.strip.height, 0);
        gridOverChart(screen);
    }

    function gridOverChart(screen) {
        const before = snapshot(screen);
        const gridTop = M.barHeight + M.contentHeight - M.keyGridHeight;
        const above = grabRect(0, M.barHeight, M.screenWidth, gridTop - M.barHeight);
        mouseClick(screen.bar.keyButton);
        compare(moved(before, screen), { bar: 0, chart: 0, strip: 1, foot: 0 });
        compare(Math.round(screen.strip.grid.mapToItem(null, 0, 0).y), gridTop);
        waitForRendering(screen);
        verify(grabRect(0, M.barHeight, M.screenWidth, gridTop - M.barHeight).equals(above));
        verify(!grab(screen.chart).equals(before.pixels.chart), "the grid does not cover the chart's foot");
        samePixels(before, screen, ["bar", "foot"]);
        const open1 = snapshot(screen);
        mouseClick(screen.strip.grid.closeButton);
        compare(moved(open1, screen), { bar: 0, chart: 0, strip: 1, foot: 0 });
        samePixels(before, screen, ["bar", "chart", "foot"]);
    }

    // Costs table, row 6: the strip's › replaces the strip only.
    function test_stripTurnOnlyTheStrip() {
        const screen = open(Strip17.sheet);
        const before = snapshot(screen);
        mouseClick(screen.strip.stripNext);
        compare(moved(before, screen), { bar: 0, chart: 0, strip: 1, foot: 0 });
        samePixels(before, screen, ["bar", "chart", "foot"]);
        verify(!grab(screen.strip).equals(before.pixels.strip));
    }

    // Costs table, row 7: a diagram's question, and Cancel, replace the strip
    // only.
    function test_questionAndCancelOnlyTheStrip() {
        const screen = open(FewChords.sheet);
        const before = snapshot(screen);
        mouseClick(cells(screen)[0]);
        compare(moved(before, screen), { bar: 0, chart: 0, strip: 1, foot: 0 });
        samePixels(before, screen, ["bar", "chart", "foot"]);
        const asked = snapshot(screen);
        mouseClick(screen.strip.cancelButton);
        compare(moved(asked, screen), { bar: 0, chart: 0, strip: 1, foot: 0 });
        samePixels(asked, screen, ["bar", "chart", "foot"]);
        samePixels(before, screen, ["strip"]);
    }

    // The sheet the backend answers a hide with: the same, the shape hidden.
    function hiding(sheet, chord) {
        const answer = clone(sheet);
        for (const s of answer.shapes)
            if (s.chord === chord)
                s.hidden = true;
        return answer;
    }

    // Costs table, row 8: a hide whose answer keeps the strip's rows replaces
    // the strip only.
    function test_hideVoicingKeepingRowsOnlyTheStrip() {
        const screen = open(FewChords.sheet);
        const shape = cells(screen)[0].shape;
        const before = snapshot(screen);
        mouseClick(cells(screen)[0]);
        mouseClick(screen.strip.hideButton);
        compare(screen.pending, "hide");
        const asked = snapshot(screen);
        screen.sheet = hiding(screen.sheet, shape.chord);
        compare(moved(asked, screen), { bar: 0, chart: 0, strip: 1, foot: 0 });
        compare(screen.strip.height, before.pixels.strip.height);
        samePixels(before, screen, ["bar", "chart", "foot"]);
        compare(screen.pending, "");
        verify(screen.strip.headText.text.endsWith(" · 1 hidden"), screen.strip.headText.text);
    }

    // Costs table, row 8, "the content too when the strip loses a row": the
    // busiest page drops to eight shown, one row; chart, strip and foot are
    // replaced once each, laid out again from the row at the top; the bar is
    // not.
    function test_hideVoicingLosingARowRelaysOnce() {
        // strip-17 with all but nine of its first page's shapes hidden.
        const first = Strip17.sheet;
        const probe = open(first);
        const keep = probe.view.pages[0].chords.slice(0, 9);
        const nine = clone(first);
        for (const s of nine.shapes)
            s.hidden = keep.indexOf(s.chord) < 0;
        const screen = open(nine);
        compare(screen.stripInfo.rows, 2);
        const top = screen.view.pages[screen.view.page].firstRow;
        const before = snapshot(screen);
        mouseClick(cells(screen)[0]);
        mouseClick(screen.strip.hideButton);
        compare(screen.endpoint.sent.length, 1);
        const asked = snapshot(screen);
        screen.sheet = hiding(screen.sheet, keep[0]);
        compare(screen.stripInfo.rows, 1);
        compare(moved(asked, screen), { bar: 0, chart: 1, strip: 1, foot: 1 });
        compare(screen.strip.height, M.stripHeight("compact", 1));
        compare(screen.chart.height, M.contentHeight - M.stripHeight("compact", 1));
        compare(screen.view.page, screen.view.pageOfRow(top));
        samePixels(before, screen, ["bar"]);
    }

    // Costs table, row 3: a turn replaces the chart, the strip and the foot,
    // once each; the bar keeps its pixels.
    function test_turnContentAndFoot() {
        const screen = open(ChoroLong.sheet);
        const before = snapshot(screen);
        mouseClick(screen.chart, 1200, 300);
        compare(screen.view.page, 1);
        compare(moved(before, screen), { bar: 0, chart: 1, strip: 1, foot: 1 });
        samePixels(before, screen, ["bar"]);
        waitForRendering(screen);
        verify(!grab(screen.chart).equals(before.pixels.chart));
        verify(!grab(screen.foot).equals(before.pixels.foot));
    }

    // Costs table, row 9: Hide shapes lays the song out once — chart, strip
    // and foot +1 each — and the bar is unchanged.
    function test_hideShapesOnce() {
        const screen = open(ChoroLong.sheet);
        const before = snapshot(screen);
        mouseClick(screen.foot.shapesButton);
        compare(moved(before, screen), { bar: 0, chart: 0, strip: 0, foot: 0 });
        screen.shapesShown = false;
        compare(moved(before, screen), { bar: 0, chart: 1, strip: 1, foot: 1 });
        samePixels(before, screen, ["bar"]);
    }

    // Costs table, row 10: choosing a key replaces the chart, the strip, the
    // foot and the bar's key button, once each; the title and Back keep their
    // pixels.
    function test_chooseKeyOnce() {
        const screen = open(FewChords.sheet);
        mouseClick(screen.bar.keyButton);
        mouseClick(keyNamed(screen, "A"));
        const before = snapshot(screen);
        const title = grab(screen.bar.title);
        const back = grab(screen.bar.back);
        const key = grab(screen.bar.keyButton);
        screen.sheet = clone(FewChordsUp2.sheet);
        compare(moved(before, screen), { bar: 1, chart: 1, strip: 1, foot: 1 });
        waitForRendering(screen);
        verify(grab(screen.bar.title).equals(title), "the title changed");
        verify(grab(screen.bar.back).equals(back), "Back changed");
        verify(!grab(screen.bar.keyButton).equals(key), "the key button did not change");
        compare(screen.bar.keyButton.text, "A (+2)");
    }

    // Rule 5: background news never redraws — a state with the same
    // shapesShown, a shelf played while a song is open in a SongScreen alone.
    function test_backgroundNewsChangesNothing() {
        const screen = open(ChoroLong.sheet);
        const before = snapshot(screen);
        screen.shapesShown = true;
        screen.endpoint.play(101, { paired: true, syncing: true, online: true, lastSync: null, shapesShown: true });
        screen.endpoint.play(103, { books: [{ bookId: "b1", title: "A book", songs: 3, setlists: 0 }] });
        compare(moved(before, screen), { bar: 0, chart: 0, strip: 0, foot: 0 });
        samePixels(before, screen, ["bar", "chart", "strip", "foot"]);
        compare(screen.endpoint.sent.length, 0);
    }

    // --- a shape found in the background (reader.missed_shapes; design §4.1,
    // §6 108; workflow 19 rule 5) ---

    // The chord FoundShape's 105 leaves empty.
    function foundChord() {
        const empty = FoundShape.sheet.shapes.filter(s => s.model === null);
        compare(empty.length, 1);
        return empty[0].chord;
    }

    // FoundShape's 105 played to Main, as the device delivers it, in the
    // window's root.
    function openFound() {
        const main = createTemporaryObject(mainComponent, testCase.parent);
        main.endpoint.play(105, FoundShape.sheet);
        verify(main.songShown);
        compare(main.songScreen.view.ready, true);
        return main;
    }

    // The strip's cell for a chord on the page shown, paging the strip to it
    // when it is past the first strip page; null when the page has none.
    function cellOf(screen, chord) {
        for (let n = 0; n < 4; ++n) {
            for (const c of cells(screen))
                if (c.shape.chord === chord)
                    return c;
            if (!screen.strip.stripNext.visible)
                return null;
            mouseClick(screen.strip.stripNext);
        }
        return null;
    }

    // Rule 5: a 108 for the song on screen moves no region's revision and
    // changes no pixel — though the chord it fills is on the page shown.
    function test_foundShapeDoesNotRedraw() {
        const chord = foundChord();
        const main = openFound();
        const screen = main.songScreen;
        verify(screen.view.pages[0].chords.indexOf(chord) >= 0, "the found chord is on the first page");
        const before = snapshot(screen);
        main.endpoint.play(108, FoundShape.shapes);
        compare(moved(before, screen), { bar: 0, chart: 0, strip: 0, foot: 0 });
        samePixels(before, screen, ["bar", "chart", "strip", "foot"]);
    }

    // §4.1: after the 108, a turn redraws the strip once, as any turn, and
    // the found chord's place on the new page is drawn — where, without the
    // 108, it is drawn empty; the strip's height stays the song's.
    function test_foundShapeOnNextPage() {
        const chord = foundChord();

        // Without the 108: the place on the second page is empty.
        const without = openFound().songScreen;
        verify(without.view.pages[1].chords.indexOf(chord) >= 0, "the found chord is on the second page");
        mouseClick(without.chart, 1200, 300);
        compare(without.view.page, 1);
        const empty = cellOf(without, chord);
        verify(empty !== null);
        compare(empty.diagram.drawn, false);
        compare(Walk.inked(empty.diagram).length, 0);

        const main = openFound();
        const screen = main.songScreen;
        const height = screen.strip.height;
        main.endpoint.play(108, FoundShape.shapes);
        const before = snapshot(screen);
        mouseClick(screen.chart, 1200, 300);
        compare(screen.view.page, 1);
        compare(moved(before, screen), { bar: 0, chart: 1, strip: 1, foot: 1 });
        compare(screen.strip.height, height);
        const cell = cellOf(screen, chord);
        verify(cell !== null);
        compare(cell.diagram.drawn, true);
        verify(Walk.inked(cell.diagram).length > 0, "the found shape's dots are drawn");
    }
}
