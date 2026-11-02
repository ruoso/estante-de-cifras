// unit — the strip's content, size and paging, and what a new sheet changes
// (reader.song_screen): strip.js and songstate.js over hand-built sheets and a
// hand-built pagesFor. Workflow 19 §A song: shapes on every page (L209–213),
// the strip's size and fixed height (L213–219), paging past sixteen
// (L223–230), hiding (L242–250); Decision 3 (the bounded fixpoint) and
// Decision 8 (a re-voicing keeps the chart).
import QtQuick
import QtTest
import "../song/strip.js" as Strip
import "../song/songstate.js" as SongState
import "../chart/metrics.js" as M

TestCase {
    id: testCase
    name: "Strip"

    // A sheet whose shapes are the chords named, `hidden` the ones hidden.
    function sheetOf(chords, hidden) {
        return {
            bookId: "b1", path: "a.cifra.md", offset: 0, rows: [{ type: "gap" }],
            shapes: chords.map(c => ({ chord: c, symbol: c, frets: "x32010", model: {},
                                       hidden: (hidden || []).indexOf(c) >= 0 }))
        };
    }

    function chordsNamed(n, prefix) {
        const out = [];
        for (let i = 0; i < n; ++i)
            out.push((prefix || "c") + i);
        return out;
    }

    // pagesFor answering the same pages at every height.
    function fixed(pages) {
        return h => pages.map((chords, i) => ({ firstRow: i, chords: chords }));
    }

    // Workflow 19 §A song L209–213: a page's shapes are its chords' shapes in
    // the order they first appear on it; a chord on two pages is on both.
    function test_pageShapesInFirstOrder() {
        const sheet = sheetOf(["A:", "B:", "C:", "D:"]);
        const one = Strip.pageShapes(sheet, ["C:", "A:", "D:"]);
        compare(one.shown.map(s => s.chord), ["C:", "A:", "D:"]);
        const two = Strip.pageShapes(sheet, ["D:", "B:"]);
        compare(two.shown.map(s => s.chord), ["D:", "B:"]);
        // A chord the sheet has no shape for takes no place.
        compare(Strip.pageShapes(sheet, ["E:", "A:"]).shown.map(s => s.chord), ["A:"]);
        // A pending shape (no model) keeps its place among the shown.
        const pending = sheetOf(["A:", "B:"]);
        pending.shapes[1].model = null;
        pending.shapes[1].frets = null;
        compare(Strip.pageShapes(pending, ["B:", "A:"]).shown.map(s => s.chord), ["B:", "A:"]);
    }

    // Workflow 19 §A song L213–216; Decision 4: up to five on the busiest
    // page large in one row; six compact in one row; seventeen compact in two.
    function test_largeWhenFewCompactWhenMany() {
        for (const [n, size, rows] of [[5, "large", 1], [6, "compact", 1], [8, "compact", 1],
                                       [9, "compact", 2], [17, "compact", 2]]) {
            const chords = chordsNamed(n);
            const got = Strip.stripSize(fixed([chords, chords.slice(0, 2)]), sheetOf(chords), M.contentHeight);
            compare(got.size, size, n + " shapes");
            compare(got.rows, rows, n + " shapes");
            compare(got.height, M.stripHeight(size, rows), n + " shapes");
        }
        // The heights the boards give: the 72 px head and its rows.
        compare(M.stripHeight("compact", 1), 321);
        compare(M.stripHeight("compact", 2), 537);
        compare(M.compactStripHeight(2), M.stripHeight("compact", 2));
    }

    // Workflow 19 §A song L216–219; Decision 3: the fixpoint returns the
    // busiest page's strip, paginating at most twice, and never a strip
    // smaller than a page of its own pagination needs.
    function test_heightFixedByBusiestPage() {
        const all = chordsNamed(20);
        const sheet = sheetOf(all);
        const heights = [];
        // In the chart a two-row strip leaves, the busiest page shows 6; in
        // the larger chart a one-row strip leaves, pages hold more but still
        // at most 8: the one-row strip is kept, with the second pagination.
        const growsWithin = h => {
            heights.push(h);
            const n = h > M.contentHeight - M.stripHeight("compact", 2) ? 8 : 6;
            return [{ firstRow: 0, chords: all.slice(0, n) }, { firstRow: 9, chords: all.slice(10, 12) }];
        };
        const kept = Strip.stripSize(growsWithin, sheet, M.contentHeight);
        compare(kept.size, "compact");
        compare(kept.rows, 1);
        compare(kept.pages[0].chords.length, 8);
        compare(heights, [M.contentHeight - M.stripHeight("compact", 2), M.contentHeight - M.stripHeight("compact", 1)]);

        // When the larger chart's busiest page outgrows the smaller strip, the
        // first strip (and its pagination) is kept.
        heights.length = 0;
        const outgrows = h => {
            heights.push(h);
            const n = h > M.contentHeight - M.stripHeight("compact", 2) ? 12 : 7;
            return [{ firstRow: 0, chords: all.slice(0, n) }];
        };
        const larger = Strip.stripSize(outgrows, sheet, M.contentHeight);
        compare(larger.size, "compact");
        compare(larger.rows, 2);
        compare(larger.height, M.stripHeight("compact", 2));
        compare(larger.pages[0].chords.length, 7);
        compare(heights.length, 2);
        // Large, then a busiest page of seven in the larger chart: the large
        // strip holds five, so the compact two-row strip stays.
        heights.length = 0;
        const largeOutgrown = h => {
            heights.push(h);
            const n = h > M.contentHeight - M.stripHeight("compact", 2) ? 7 : 5;
            return [{ firstRow: 0, chords: all.slice(0, n) }];
        };
        const kept2 = Strip.stripSize(largeOutgrown, sheet, M.contentHeight);
        compare([kept2.size, kept2.rows], ["compact", 2]);
        compare(heights.length, 2);
        // The busiest page needing the most strip: one pagination.
        heights.length = 0;
        const busy = h => {
            heights.push(h);
            return [{ firstRow: 0, chords: all.slice(0, 17) }];
        };
        compare(Strip.stripSize(busy, sheet, M.contentHeight).rows, 2);
        compare(heights.length, 1);
    }

    // Workflow 19 §A song L242–250: hidden shapes leave the shown list and are
    // counted; a song whose pages show none but hide some keeps the head
    // alone; a song with no shapes has no strip.
    function test_hiddenSplitAndCounted() {
        const sheet = sheetOf(["A:", "B:", "C:", "D:"], ["B:", "D:"]);
        const split = Strip.pageShapes(sheet, ["A:", "B:", "C:", "D:"]);
        compare(split.shown.map(s => s.chord), ["A:", "C:"]);
        compare(split.hidden.map(s => s.chord), ["B:", "D:"]);

        const allHidden = sheetOf(["A:", "B:"], ["A:", "B:"]);
        const head = Strip.stripSize(fixed([["A:", "B:"]]), allHidden, M.contentHeight);
        compare(head.rows, 0);
        compare(head.height, M.stripHeight("compact", 0));
        verify(head.height > 0);

        const none = Strip.stripSize(fixed([[]]), { shapes: [], rows: [] }, M.contentHeight);
        compare(none.size, "none");
        compare(none.height, 0);
    }

    // Workflow 19 §A song L223–230: 24 shown → pages of 16 and 8, labelled
    // "1–16 of 24"; sixteen or fewer do not page.
    function test_stripPagesPastSixteen() {
        const shown = chordsNamed(24);
        const first = Strip.stripPage(shown, 0);
        compare(first.shapes.length, 16);
        compare(first.pages, 2);
        compare(first.range, "1–16 of 24");
        const second = Strip.stripPage(shown, 1);
        compare(second.shapes, shown.slice(16));
        compare(second.range, "17–24 of 24");
        compare(Strip.stripPage(shown, 5).page, 1);
        const few = Strip.stripPage(chordsNamed(16), 0);
        compare(few.pages, 1);
        compare(few.range, "");
    }

    // Decision 8: same book, path, offset and rows → revoiced; a different
    // offset, path, book or rows → new; nothing shown → new.
    function test_revoicedOrNew() {
        const shown = { bookId: "b1", path: "a.cifra.md", offset: 2, rows: [{ type: "gap" }],
                        shapes: [{ chord: "A:", hidden: false }] };
        const hidden = JSON.parse(JSON.stringify(shown));
        hidden.shapes[0].hidden = true;
        compare(SongState.change(shown, hidden), "revoiced");
        compare(SongState.change(shown, Object.assign({}, shown, { offset: 3 })), "new");
        compare(SongState.change(shown, Object.assign({}, shown, { path: "b.cifra.md" })), "new");
        compare(SongState.change(shown, Object.assign({}, shown, { bookId: "b2" })), "new");
        compare(SongState.change(shown, Object.assign({}, shown, { rows: [{ type: "empty" }] })), "new");
        compare(SongState.change(null, shown), "new");
    }
}
