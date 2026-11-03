// behavior — the screen AppLoad gives and the chart's text size (workflow 19
// §The screen, §Settings, as amended; chart/metrics.js `configure`): the
// standard reproduces the rM2's sizes; another screen lays the screens out
// at its size — a book page filled with as many rows as fit, the strip with
// as many diagrams — and another text size the chart's faces and lines, more
// to a page when smaller; a state naming another text size makes Main's
// screens again at it, Settings reopened. metrics.js is shared, so every test
// leaves the rM2's standard behind.
import QtQuick
import QtTest
import net.asivery.AppLoad 1.0
import "../chart"
import "../browse"
import ".."
import "../chart/metrics.js" as M
import "fixtures/choro-long.js" as ChoroLong
import "fixtures/browse-book.js" as BrowseBook
import "fixtures/browse-settings.js" as BrowseSettings
import "walk.js" as Walk

TestCase {
    id: testCase
    name: "Sizes"
    when: windowShown
    width: 1620
    height: 2160

    Component {
        id: sheetComponent
        SheetView {}
    }

    Component {
        id: bookComponent
        BookScreen {}
    }

    Component {
        id: mainComponent
        Main {}
    }

    function cleanup() {
        M.configure(1404, 1872, 14);
    }

    function clone(x) {
        return JSON.parse(JSON.stringify(x));
    }

    function sheetPages(width, height, pt) {
        M.configure(width, height, pt);
        const view = createTemporaryObject(sheetComponent, testCase.parent, {
            sheet: clone(ChoroLong.sheet), width: M.chartWidth, height: M.contentHeight
        });
        tryVerify(() => view.facesReady);
        return view;
    }

    // The standard is the rM2's screen at 14 pt: every size as it was.
    function test_standardIsTheRM2() {
        M.configure(1404, 1872, 14);
        compare([M.screenWidth, M.screenHeight, M.contentHeight, M.chartWidth], [1404, 1872, 1632, 1308]);
        compare([M.wordsSize, M.wordsLine, M.sungChordSize, M.chordSize, M.barsHeight, M.sectionSize],
                [44, 56, 38, 40, 72, 34]);
        compare([M.stripPerRow.compact, M.stripPerRow.large, M.stripPerPage, M.stripLargeMax], [8, 5, 16, 5]);
        compare([M.letterColumns, M.letterCellWidth, M.letterRowsHeight], [13, 108, 200]);
        compare(M.textSizeOf(15), 14);
        compare(M.textSizeOf(undefined), 14);
    }

    // The Paper Pro's screen: the content and the chart at its size, more
    // diagrams to a strip row, and the song in fewer pages.
    function test_paperPro() {
        const rm2 = sheetPages(1404, 1872, 14).pageCount;
        M.configure(1620, 2160, 14);
        compare([M.contentHeight, M.chartWidth], [1920, 1524]);
        verify(M.stripPerRow.compact > 8);
        compare(M.letterColumns, 13);
        const pro = sheetPages(1620, 2160, 14);
        verify(pro.pageCount <= rm2, pro.pageCount + " pages on the Paper Pro, " + rm2 + " on the rM2");
        compare(Walk.oneBitProblems(pro), []);
    }

    // A book page holds as many rows as its content does: more on a taller
    // screen, every row inside it.
    function test_bookFillsTheScreen() {
        M.configure(1404, 1872, 14);
        const small = createTemporaryObject(bookComponent, testCase.parent);
        small.show(clone(BrowseBook.book), 0);
        const rm2Pages = small.pageCount;
        M.configure(1620, 2160, 14);
        const screen = createTemporaryObject(bookComponent, testCase.parent);
        tryVerify(() => screen.faces.ready);
        screen.show(clone(BrowseBook.book), 1);
        compare(screen.width, 1620);
        verify(screen.pageCount <= rm2Pages);
        const rows = [];
        for (let i = 0; i < screen.rows.count; ++i)
            rows.push(screen.rows.itemAt(i));
        // A page with no heading: as many 120 px rows as the list's height
        // holds, and no more.
        compare(rows.length, Math.floor(screen.list.height / M.listRow));
        for (const r of rows)
            verify(r.y + r.height <= screen.list.height);
    }

    // A smaller text size: smaller faces, so the song takes fewer pages; a
    // larger, more. Strokes never under 2 px.
    function test_textSizeScalesTheChart() {
        const standard = sheetPages(1404, 1872, 14).pageCount;
        const smaller = sheetPages(1404, 1872, 10);
        compare(M.wordsSize, 31);
        verify(M.hyphenStroke >= 2 && M.repeatThin >= 2);
        verify(smaller.pageCount <= standard);
        compare(Walk.oneBitProblems(smaller), []);
        const larger = sheetPages(1404, 1872, 18);
        verify(larger.pageCount >= standard);
        compare(M.wordsSize, 57);
    }

    // Main makes its screens at the first state's text size; a state naming
    // another makes them again at it and reopens Settings; the same size
    // makes nothing.
    function test_mainRemakesItsScreens() {
        const main = createTemporaryObject(mainComponent, testCase.parent);
        main.endpoint.play(101, { paired: true, syncing: false, online: true, lastSync: null, shapesShown: true, textSize: 11 });
        compare(main.textSize, 11);
        compare(M.textPt, 11);
        const first = main.screens;
        verify(first !== null);
        main.endpoint.play(101, { paired: true, syncing: false, online: true, lastSync: null, shapesShown: true, textSize: 11 });
        verify(main.screens === first);
        main.endpoint.play(107, clone(BrowseSettings.settings));
        main.endpoint.clear();
        main.endpoint.play(101, { paired: true, syncing: false, online: true, lastSync: null, shapesShown: true });
        compare(main.textSize, 14);
        verify(main.screens !== first);
        compare(main.endpoint.sent.length, 1);
        compare(main.endpoint.sent[0].type, 2);
        compare(main.endpoint.sent[0].payload, { view: "settings" });
        main.endpoint.play(107, clone(BrowseSettings.settings));
        compare(main.view, "settings");
    }
}
