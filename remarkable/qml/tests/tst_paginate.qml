// unit — the chart's two pure modules (reader.qml_chart): blocks.js (rows →
// keep-together units, bars reflowed into rows of four) and paginate.js
// (measured units → pages of columns), over hand-built rows and units.
// Workflow 19 §A song, as amended; books.print's rule (print-columns.js,
// reading.css: column-fill auto, break-inside/after avoid).
import QtQuick
import QtTest
import "../chart/blocks.js" as Blocks
import "../chart/paginate.js" as Paginate

TestCase {
    name: "Paginate"

    function u(kind, height, extra) {
        return Object.assign({ kind: kind, keepWithNext: kind === "section", breakable: false,
                               height: height }, extra || {});
    }

    // Each column's units, as "unit[from-to]" (and "unit!" when dropped).
    function shape(pages) {
        return pages.map(p => p.columns.map(c => c.map(s => s.dropped ? s.unit + "!"
                                                                        : s.unit + "[" + s.from + "-" + s.to + "]")));
    }

    function bars(n, extra) {
        const cells = [];
        const marks = [];
        for (let i = 0; i < n; ++i) {
            cells.push([{ text: "C" + i, token: { key: "C" + i } }]);
            marks.push({ open: false, close: false, count: null, ending: null });
        }
        return Object.assign({ type: "bars", measures: cells.map(c => c[0].text), cells: cells,
                               marks: marks, numbers: [], grid: { widths: [], columns: n }, spans: [] },
                             extra || {});
    }

    // Workflow 19 §A song: "a section name with its first line never split".
    function test_sectionKeptWithFirstLine() {
        const units = [u("sung", 300), u("sung", 300), u("section", 60), u("sung", 120), u("sung", 120)];
        // 300 + 300 + 60 = 660 fits a 700 px column, but the section's first
        // line does not; the section goes over with it.
        const pages = Paginate.paginate(units, 700, 2);
        compare(shape(pages), [[["0[0-1]", "1[0-1]"], ["2[0-1]", "3[0-1]", "4[0-1]"]]]);
        // A section before a block that will break anyway keeps with its first
        // piece only.
        const tall = u("bars", 900, { breakable: true, breakHeights: [100, 100, 100, 100, 100, 100, 100, 100, 100] });
        const p2 = Paginate.paginate([u("sung", 500), u("section", 60), tall], 700, 1);
        compare(shape(p2), [[["0[0-1]", "1[0-1]", "2[0-1]"]], [["2[1-8]"]], [["2[8-9]"]]]);
    }

    // Workflow 19 §A song: "a column filled to its foot before the next
    // begins" (books.print's column-fill: auto, not balanced).
    function test_columnFilledBeforeNext() {
        const units = [];
        for (let i = 0; i < 7; ++i)
            units.push(u("sung", 100));
        const pages = Paginate.paginate(units, 500, 2);
        compare(shape(pages), [[["0[0-1]", "1[0-1]", "2[0-1]", "3[0-1]", "4[0-1]"], ["5[0-1]", "6[0-1]"]]]);
        // Two columns to a page, then the next page.
        const many = [];
        for (let j = 0; j < 11; ++j)
            many.push(u("sung", 100));
        const p2 = Paginate.paginate(many, 500, 2);
        compare(p2.length, 2);
        compare(p2[0].columns.length, 2);
        compare(p2[1].columns.length, 1);
        compare(shape(p2)[1], [["10[0-1]"]]);
        // One column: each page is one column.
        compare(Paginate.paginate(many, 500, 1).length, 3);
    }

    // Workflow 19 §A song (books.print): a blank line that would start a
    // column is dropped; elsewhere it keeps its room.
    function test_gapDroppedAtColumnTop() {
        const units = [u("sung", 400), u("gap", 50), u("sung", 100), u("gap", 50), u("sung", 50)];
        const pages = Paginate.paginate(units, 500, 2);
        compare(shape(pages), [[["0[0-1]", "1[0-1]"], ["2[0-1]", "3[0-1]", "4[0-1]"]]]);
        const top = Paginate.paginate([u("sung", 450), u("sung", 100), u("gap", 50), u("sung", 450)], 500, 2);
        // 100 + 50 + 450 > 500: the third sung starts the next page, the gap
        // stays where it was, at the foot of column 2.
        compare(shape(top), [[["0[0-1]"], ["1[0-1]", "2[0-1]"]], [["3[0-1]"]]]);
        const dropped = Paginate.paginate([u("sung", 450), u("gap", 60), u("sung", 100)], 500, 1);
        compare(shape(dropped), [[["0[0-1]"]], [["1!", "2[0-1]"]]]);
        compare(dropped[1].columns[0][0].height, 0);
    }

    // The workflow 19 delta: a block of bars taller than a column breaks
    // between its rows of four, never inside one; a block that fits a column
    // is never split.
    function test_tallBarsBlockBreaksBetweenRows() {
        const fits = u("bars", 400, { breakable: true, breakHeights: [100, 100, 100, 100] });
        const p1 = Paginate.paginate([u("sung", 300), fits], 500, 1);
        compare(shape(p1), [[["0[0-1]"]], [["1[0-4]"]]]);
        const tall = u("bars", 1200, { breakable: true,
                                       breakHeights: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100] });
        const p2 = Paginate.paginate([u("sung", 250), tall], 500, 2);
        // The rest of column 1 is filled (two rows), then five a column.
        compare(shape(p2), [[["0[0-1]", "1[0-2]"], ["1[2-7]"]], [["1[7-12]"]]]);
        for (const page of p2)
            for (const col of page.columns)
                for (const s of col)
                    verify(s.height <= 500);
        // Through blocks.js: a block of three bars lines of eight is six rows
        // of four, each a break point.
        const units = Blocks.blocks([bars(8), { type: "gap", grid: { widths: [], columns: 8 } }, bars(8), bars(8)]);
        compare(units.length, 1);
        compare(units[0].kind, "bars");
        compare(units[0].rows, [0, 1, 2, 3]);
        verify(units[0].breakable);
        compare(units[0].pieces.map(p => p.kind), ["bars", "bars", "gap", "bars", "bars", "bars", "bars"]);
    }

    // The workflow 19 delta: four to a row, and a line of bars keeps its own
    // breaks.
    function test_barsFourToARowKeepingLineBreaks() {
        const eight = Blocks.reflowBars(bars(8));
        compare(eight.map(r => r.bars.length), [4, 4]);
        compare(eight[1].bars[0].cells[0].text, "C4");
        const three = Blocks.reflowBars(bars(3));
        compare(three.map(r => r.bars.length), [3]);
        const units = Blocks.blocks([bars(8), bars(3)]);
        compare(units.length, 1);
        compare(units[0].pieces.map(p => p.bars.length), [4, 4, 3]);
        compare(units[0].pieces.map(p => p.row), [0, 0, 1]);
        compare(Blocks.reflowBars(bars(5)).map(r => r.bars.length), [4, 1]);
    }

    // The workflow 19 delta: an ending starts a row, labelled with its number
    // as an ordinal, in the place of its first bar.
    function test_endingStartsItsRowWithLabel() {
        const row = bars(5);
        row.marks[3].ending = 1;
        row.marks[3].close = true;
        row.marks[4].ending = 2;
        const rows = Blocks.reflowBars(row);
        compare(rows.length, 3);
        compare(rows[0].label, undefined);
        compare(rows[0].bars.length, 3);
        compare(rows[1].label, "1st");
        compare(rows[1].bars.map(b => b.cells[0].text), ["C3"]);
        compare(rows[2].label, "2nd");
        compare(rows[2].bars.map(b => b.cells[0].text), ["C4"]);
        // An ending's row holds up to three bars after its label.
        const long = bars(5);
        long.marks[0].ending = 2;
        const lr = Blocks.reflowBars(long);
        compare(lr.map(r => [r.label || "", r.bars.length]), [["2nd", 3], ["", 2]]);
        compare([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(Blocks.ordinal),
                ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd"]);
    }

    // Design §6: the frontend ignores what it does not know — an unknown row
    // makes no unit and takes no room, even inside a block of bars.
    function test_unknownRowTakesNoRoom() {
        const known = [{ type: "section", name: "A" }, bars(4), bars(4), { type: "words", text: "la" }];
        const withUnknown = [{ type: "section", name: "A" }, bars(4), { type: "hologram", text: "?" }, bars(4),
                             { type: "words", text: "la" }, { type: "hologram" }, null];
        const a = Blocks.blocks(known);
        const b = Blocks.blocks(withUnknown);
        compare(b.map(x => x.kind), a.map(x => x.kind));
        compare(b.map(x => x.pieces.length), a.map(x => x.pieces.length));
        compare(b[1].rows, [1, 3]);
        compare(Blocks.blocks([{ type: "hologram" }]), []);
        compare(Paginate.paginate([], 500, 1), []);
    }
}
