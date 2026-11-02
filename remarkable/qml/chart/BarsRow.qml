// One row of four bars (chartRows `bars`, reflowed by blocks.js): each bar a
// quarter of the column, or wider when its chords need it, 72 px tall, its
// chords in Figtree 40 px/700 between 3 px bar lines (Song.dc.html L36–38,
// L92–98). An ending's row has its ordinal label in its first place (*1st*,
// *2nd*: workflow 19 §A song, as amended). A repeat opens with a 6 px and a
// 3 px line and two 8 px dots, and closes with the same mirrored, its count
// drawn as `×n` after it (Chart.jsx RuleMarks). Bar numbers are not drawn
// (refinement Decision 10).
import QtQuick
import "metrics.js" as M

Item {
    id: row
    objectName: "piece"
    property var piece
    property var faces
    readonly property string kind: "bars"
    readonly property int rowIndex: piece.row
    property int naturalWidth: 0

    function layout(w) {
        width = w;
        const quarter = Math.floor(w / M.barsPerRow);
        let x = 0;
        let natural = 0;
        if (labels.count > 0) {
            const label = labels.itemAt(0);
            const labelNatural = M.barPadLeft + label.width + M.barPadRight;
            label.x = M.barPadLeft;
            natural += labelNatural;
            x += Math.max(quarter, labelNatural);
        }
        for (let i = 0; i < bars.count; ++i) {
            const bar = bars.itemAt(i);
            const n = bar.naturalWidth();
            natural += n;
            bar.x = x;
            bar.width = Math.max(quarter, n);
            bar.arrange();
            x += bar.width;
        }
        naturalWidth = natural;
        height = M.barsHeight + M.pieceSpacing;
    }

    Repeater {
        id: labels
        model: row.piece.label ? 1 : 0
        delegate: Text {
            objectName: "endingLabel"
            y: Math.floor((M.barsHeight - M.chordLine) / 2)
            width: Math.ceil(implicitWidth)
            height: M.chordLine
            color: "black"
            font.family: row.faces.chart
            font.variableAxes: ({ "wght": 700 })
            font.pixelSize: M.chordSize
            lineHeightMode: Text.FixedHeight
            lineHeight: M.chordLine
            textFormat: Text.PlainText
            text: row.piece.label
        }
    }

    Repeater {
        id: bars
        model: row.piece.bars
        delegate: Item {
            id: bar
            objectName: "bar"
            readonly property var marks: modelData.marks || ({})
            readonly property bool opens: marks.open === true
            readonly property bool closes: marks.close === true
            readonly property var count: closes && marks.count ? marks.count : null
            readonly property bool last: index === bars.count - 1
            readonly property bool afterClose: index > 0 && row.piece.bars[index - 1].marks
                                               && row.piece.bars[index - 1].marks.close === true
            readonly property int contentStart: opens ? M.repeatSign + 12 : M.barPadLeft
            readonly property int countWidth: countTexts.count > 0 ? countTexts.itemAt(0).width + 2 * M.countGap : 0

            // The bar's width at the chart size: its chords and its signs.
            function naturalWidth() {
                let cells = 0;
                for (let i = 0; i < cellTexts.count; ++i)
                    cells += (i > 0 ? M.chordGap : 0) + cellTexts.itemAt(i).width;
                return contentStart + cells + (closes ? 12 + M.repeatSign : M.barPadRight) + countWidth;
            }
            // The bar's right edge: its rule, or its close; the count after it.
            readonly property int edge: width - countWidth
            height: M.barsHeight

            function arrange() {
                let x = contentStart;
                for (let i = 0; i < cellTexts.count; ++i) {
                    const t = cellTexts.itemAt(i);
                    t.x = x;
                    x += t.width + M.chordGap;
                }
            }

            // The left bar line, unless a repeat opens here or the bar
            // before closed one (its thick line is the boundary).
            Repeater {
                model: !bar.opens && !bar.afterClose ? 1 : 0
                Rectangle {
                    objectName: "barRule"
                    x: 0; y: 0; width: M.barRule; height: M.barsHeight
                    color: "black"; antialiasing: false
                }
            }
            // The right bar line, at the row's end.
            Repeater {
                model: bar.last && !bar.closes ? 1 : 0
                Rectangle {
                    objectName: "barRule"
                    x: bar.width - M.barRule; y: 0; width: M.barRule; height: M.barsHeight
                    color: "black"; antialiasing: false
                }
            }
            // The open repeat: thick, thin, two dots.
            Repeater {
                model: bar.opens ? 1 : 0
                Item {
                    objectName: "repeatOpen"
                    x: 0; y: 0; width: M.repeatSign; height: M.barsHeight
                    Rectangle { x: 0; y: 0; width: M.repeatThick; height: M.barsHeight; color: "black"; antialiasing: false }
                    Rectangle { x: M.repeatThick + M.repeatSpace; y: 0; width: M.repeatThin; height: M.barsHeight; color: "black"; antialiasing: false }
                    Rectangle {
                        x: M.repeatSign - M.repeatDot; y: Math.floor(M.barsHeight / 2) - M.repeatDot - 6
                        width: M.repeatDot; height: M.repeatDot; radius: M.repeatDot / 2
                        color: "black"; antialiasing: false
                    }
                    Rectangle {
                        x: M.repeatSign - M.repeatDot; y: Math.floor(M.barsHeight / 2) + 6
                        width: M.repeatDot; height: M.repeatDot; radius: M.repeatDot / 2
                        color: "black"; antialiasing: false
                    }
                }
            }
            // The close, mirrored.
            Repeater {
                model: bar.closes ? 1 : 0
                Item {
                    objectName: "repeatClose"
                    x: bar.edge - M.repeatSign; y: 0; width: M.repeatSign; height: M.barsHeight
                    Rectangle {
                        x: 0; y: Math.floor(M.barsHeight / 2) - M.repeatDot - 6
                        width: M.repeatDot; height: M.repeatDot; radius: M.repeatDot / 2
                        color: "black"; antialiasing: false
                    }
                    Rectangle {
                        x: 0; y: Math.floor(M.barsHeight / 2) + 6
                        width: M.repeatDot; height: M.repeatDot; radius: M.repeatDot / 2
                        color: "black"; antialiasing: false
                    }
                    Rectangle { x: M.repeatDot + M.repeatSpace; y: 0; width: M.repeatThin; height: M.barsHeight; color: "black"; antialiasing: false }
                    Rectangle { x: M.repeatSign - M.repeatThick; y: 0; width: M.repeatThick; height: M.barsHeight; color: "black"; antialiasing: false }
                }
            }
            Repeater {
                id: countTexts
                model: bar.count ? 1 : 0
                Text {
                    objectName: "repeatCount"
                    x: bar.edge + M.countGap
                    y: Math.floor((M.barsHeight - M.chordLine) / 2)
                    width: Math.ceil(implicitWidth)
                    height: M.chordLine
                    color: "black"
                    font.family: row.faces.chart
                    font.variableAxes: ({ "wght": 700 })
                    font.pixelSize: M.chordSize
                    lineHeightMode: Text.FixedHeight
                    lineHeight: M.chordLine
                    textFormat: Text.PlainText
                    text: "×" + bar.count
                }
            }
            Repeater {
                id: cellTexts
                model: modelData.cells
                Text {
                    objectName: "chord"
                    y: Math.floor((M.barsHeight - M.chordLine) / 2)
                    width: Math.ceil(implicitWidth)
                    height: M.chordLine
                    color: "black"
                    font.family: row.faces.chart
                    font.variableAxes: ({ "wght": 700 })
                    font.pixelSize: M.chordSize
                    lineHeightMode: Text.FixedHeight
                    lineHeight: M.chordLine
                    textFormat: Text.PlainText
                    text: modelData.text || ""
                }
            }
        }
    }
}
