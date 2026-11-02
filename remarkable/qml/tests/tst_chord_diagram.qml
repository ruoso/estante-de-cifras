// behavior — the chord diagram (reader.qml_chart; docs/remarkable-reader.md
// §7, as amended; workflow 19 §A song). Models written here in diagramModel's
// exact shape (app/src/render/diagram.js L41–108) — an open shape, a barre up
// the neck — plus every model in the fixtures' shapes, which the backend made
// with diagramModel itself (TestQMLFixtures). Drawn as given, at two sizes,
// one bit, in whole pixels; a pending shape keeps its place, empty.
import QtQuick
import QtTest
import "../chart"
import "../chart/metrics.js" as M
import "fixtures/every-row.js" as EveryRow
import "fixtures/two-columns.js" as TwoColumns
import "fixtures/one-column.js" as OneColumn
import "fixtures/choro-31.js" as Choro31
import "fixtures/choro-long.js" as ChoroLong
import "walk.js" as Walk

TestCase {
    id: testCase
    name: "ChordDiagram"
    when: windowShown
    width: 400
    height: 400

    Component {
        id: diagramComponent
        ChordDiagram {}
    }

    readonly property var parts: ["string", "fret", "nut", "dot", "barre", "finger", "open", "muted",
                                  "fretNumber", "symbol"]

    // C, x32010, as diagramModel gives it for a right-handed guitar.
    function openC() {
        return {
            stringCount: 6, fretsShown: 5, startFret: 1, showNut: true,
            dots: [
                { stringIndex: 1, fret: 3, finger: 3, row: 2 },
                { stringIndex: 2, fret: 2, finger: 2, row: 1 },
                { stringIndex: 4, fret: 1, finger: 1, row: 0 }
            ],
            barre: null,
            markers: [
                { stringIndex: 0, kind: "muted" },
                { stringIndex: 3, kind: "open" },
                { stringIndex: 5, kind: "open" }
            ],
            orientation: "vertical", handed: "right", size: 1
        };
    }

    // Am at the fifth fret, 577555: a barre of the first finger across all
    // six strings, the notes under it not in `dots`.
    function barreAt5() {
        return {
            stringCount: 6, fretsShown: 5, startFret: 5, showNut: false,
            dots: [
                { stringIndex: 1, fret: 7, finger: 3, row: 2 },
                { stringIndex: 2, fret: 7, finger: 4, row: 2 }
            ],
            barre: { fret: 5, row: 0, fromString: 0, toString: 5, finger: 1 },
            markers: [],
            orientation: "vertical", handed: "right", size: 1
        };
    }

    function make(model, size, symbol) {
        const d = createTemporaryObject(diagramComponent, testCase.parent, {
            model: model, size: size || "large", symbol: symbol === undefined ? "C" : symbol
        });
        verify(d !== null);
        verify(d.faces.ready);
        return d;
    }

    function named(d, name) {
        return Walk.named(d, name);
    }

    function centreX(item, d) {
        const p = item.mapToItem(d, 0, 0);
        return p.x + item.width / 2;
    }

    function centreY(item, d) {
        const p = item.mapToItem(d, 0, 0);
        return p.y + item.height / 2;
    }

    function counts(d) {
        return parts.map(name => named(d, name).length);
    }

    // Design §7: an open shape — six strings, fretsShown + 1 fret lines, the
    // nut, each dot at its string × row with its finger white in it, the open
    // and muted marks above the strings `markers` names, no fret number.
    function test_openChord() {
        const model = openC();
        const d = make(model, "large", "C");
        const strings = named(d, "string");
        compare(strings.length, 6);
        compare(named(d, "fret").length, model.fretsShown + 1);
        compare(named(d, "nut").length, 1);
        compare(named(d, "fretNumber").length, 0);
        compare(named(d, "barre").length, 0);
        const frets = named(d, "fret").map(f => f.mapToItem(d, 0, 0).y).sort((a, b) => a - b);
        const dots = named(d, "dot");
        compare(dots.length, model.dots.length);
        for (let i = 0; i < dots.length; ++i) {
            const m = model.dots[i];
            fuzzyCompare(centreX(dots[i], d), centreX(strings[m.stringIndex], d), 1);
            // Between the row's two fret lines, centred.
            fuzzyCompare(centreY(dots[i], d), (frets[m.row] + frets[m.row + 1]) / 2 + 1, 2);
            compare(dots[i].radius, dots[i].width / 2);
            const finger = Walk.named(dots[i], "finger");
            compare(finger.length, 1);
            compare(finger[0].text, String(m.finger));
            verify(Qt.colorEqual(finger[0].color, "white"));
            compare(finger[0].fontInfo.family, d.faces.ui);
            compare(finger[0].fontInfo.weight, Font.Bold);
        }
        const nutY = named(d, "nut")[0].mapToItem(d, 0, 0).y;
        const open = named(d, "open");
        compare(open.length, 2);
        // Centred on strings 3 and 5 (to the pixel: a 3 px string's centre
        // falls between two).
        compare(open.length, 2);
        fuzzyCompare(centreX(open[0], d), centreX(strings[3], d), 1);
        fuzzyCompare(centreX(open[1], d), centreX(strings[5], d), 1);
        for (const o of open) {
            verify(Qt.colorEqual(o.color, "white"));
            verify(o.border.width >= 2);
            compare(o.radius, o.width / 2);
            verify(o.mapToItem(d, 0, 0).y + o.height <= nutY);
        }
        const muted = named(d, "muted");
        compare(muted.length, 1);
        compare(muted[0].text, "×");
        fuzzyCompare(centreX(muted[0], d), centreX(strings[0], d), 1);
        verify(muted[0].mapToItem(d, 0, 0).y + muted[0].height <= nutY);
        const symbol = named(d, "symbol");
        compare(symbol.length, 1);
        compare(symbol[0].text, "C");
        compare(symbol[0].fontInfo.family, d.faces.chart);
        verify(symbol[0].mapToItem(d, 0, 0).y + symbol[0].height <= named(d, "box")[0].y);
    }

    // Design §7, as amended: up the neck — no nut, the start fret beside row 0,
    // the barre one rounded Rectangle from its first string to its last with
    // its finger, and the other dots off it.
    function test_barreUpTheNeck() {
        const model = barreAt5();
        const d = make(model, "large", "Am");
        const strings = named(d, "string");
        compare(named(d, "nut").length, 0);
        const number = named(d, "fretNumber");
        compare(number.length, 1);
        compare(number[0].text, "5");
        compare(number[0].fontInfo.family, d.faces.ui);
        verify(number[0].mapToItem(d, 0, 0).x + number[0].width <= strings[0].mapToItem(d, 0, 0).x);
        const frets = named(d, "fret").map(f => f.mapToItem(d, 0, 0).y).sort((a, b) => a - b);
        verify(centreY(number[0], d) > frets[0] && centreY(number[0], d) < frets[1]);
        const barre = named(d, "barre");
        compare(barre.length, 1);
        const b = barre[0];
        compare(b.radius, b.height / 2);
        verify(b.mapToItem(d, 0, 0).x <= strings[0].mapToItem(d, 0, 0).x);
        verify(b.mapToItem(d, 0, 0).x + b.width >= strings[5].mapToItem(d, 0, 0).x + strings[5].width);
        verify(centreY(b, d) > frets[0] && centreY(b, d) < frets[1]);
        const barreFinger = Walk.named(b, "finger");
        compare(barreFinger.length, 1);
        compare(barreFinger[0].text, "1");
        const dots = named(d, "dot");
        compare(dots.length, 2);
        for (const dot of dots)
            verify(centreY(dot, d) > frets[2] && centreY(dot, d) < frets[3]);
        compare(named(d, "finger").length, 3);
        compare(named(d, "open").length + named(d, "muted").length, 0);
    }

    // Workflow 19 §A song: one component at two sizes, large 170 × 222 and
    // compact 124 × 168, the symbol above, the same parts at both.
    function test_twoSizes() {
        for (const model of [openC(), barreAt5()]) {
            const large = make(model, "large", "C");
            const compact = make(model, "compact", "C");
            compare([large.boxWidth, large.boxHeight], [170, 222]);
            compare([compact.boxWidth, compact.boxHeight], [124, 168]);
            const lbox = named(large, "box")[0];
            const cbox = named(compact, "box")[0];
            compare([lbox.width, lbox.height], [170, 222]);
            compare([cbox.width, cbox.height], [124, 168]);
            compare([large.width, large.height], [170, M.diagram.large.symbolLine + 222]);
            compare([compact.width, compact.height], [124, M.diagram.compact.symbolLine + 168]);
            compare(counts(compact), counts(large));
            compare(named(large, "symbol")[0].font.pixelSize, 40);
            compare(named(compact, "symbol")[0].font.pixelSize, 32);
            // Every part inside its box (the fret number beside it).
            for (const [d, box] of [[large, lbox], [compact, cbox]]) {
                for (const name of ["string", "fret", "nut", "dot", "barre", "open", "muted"]) {
                    for (const part of named(d, name)) {
                        const at = part.mapToItem(box, 0, 0);
                        verify(at.x >= 0 && at.y >= 0 && at.x + part.width <= box.width
                               && at.y + part.height <= box.height, name + " outside the box");
                    }
                }
            }
        }
    }

    // Design §6: a pending shape's place is left empty — no parts, no symbol,
    // the same size.
    function test_pendingShapeEmptyPlace() {
        for (const size of ["large", "compact"]) {
            const pending = make(null, size, "C");
            const drawn = make(openC(), size, "C");
            compare(counts(pending), parts.map(() => 0));
            compare(Walk.inked(pending).length, 0);
            compare([pending.width, pending.height], [drawn.width, drawn.height]);
        }
    }

    // Workflow 19 rule 6: every part in whole pixels, black or white, with no
    // antialiasing, strokes of at least 2 px.
    function test_pixelAlignedOneBit() {
        for (const size of ["large", "compact"]) {
            for (const model of [openC(), barreAt5()]) {
                const d = make(model, size, "Am7(11)");
                verify(Walk.inked(d).length > 15);
                compare(Walk.oneBitProblems(d), []);
                for (const name of ["string", "fret"])
                    for (const part of named(d, name))
                        verify(Math.min(part.width, part.height) >= 2);
            }
        }
    }

    // Every model the backend sent for the fixture songs draws, with no
    // warning, one dot per `dots` entry.
    function test_fixtureModelsDraw() {
        failOnWarning(/.?/);
        let drawn = 0;
        for (const sheet of [EveryRow.sheet, TwoColumns.sheet, OneColumn.sheet, Choro31.sheet, ChoroLong.sheet]) {
            for (const shape of sheet.shapes) {
                if (shape.model === null)
                    continue;
                for (const size of ["large", "compact"]) {
                    const d = make(shape.model, size, shape.symbol);
                    compare(named(d, "dot").length, shape.model.dots.length, shape.chord);
                    compare(named(d, "barre").length, shape.model.barre ? 1 : 0, shape.chord);
                    compare(named(d, "string").length, shape.model.stringCount);
                    compare(named(d, "symbol")[0].text, shape.symbol);
                    compare(Walk.oneBitProblems(d), [], shape.chord);
                }
                drawn += 1;
            }
        }
        verify(drawn >= 20, drawn + " models drawn");
    }
}
