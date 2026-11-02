// A chord line with no bar lines (chartRows `run{text, tokens}`): its cells
// in sequence, in the chord face, wrapping between cells. One piece.
import QtQuick
import "metrics.js" as M

Item {
    id: row
    objectName: "piece"
    property var piece
    property var faces
    readonly property string kind: "run"
    readonly property int rowIndex: piece.row
    readonly property int naturalWidth: 0

    function layout(w) {
        width = w;
        let x = 0;
        let line = 0;
        for (let i = 0; i < repeater.count; ++i) {
            const cell = repeater.itemAt(i);
            let at = x > 0 ? x + M.chordGap : 0;
            if (x > 0 && at + cell.width > w) {
                line += 1;
                at = 0;
            }
            cell.x = at;
            cell.y = M.sungMargin + line * M.runLine;
            x = at + cell.width;
        }
        height = 2 * M.sungMargin + (line + 1) * M.runLine + M.pieceSpacing;
    }

    Repeater {
        id: repeater
        model: row.piece.tokens
        delegate: Text {
            objectName: "chord"
            width: Math.ceil(implicitWidth)
            height: M.runLine
            color: "black"
            font.family: row.faces.chart
            font.variableAxes: ({ "wght": 700 })
            font.pixelSize: M.chordSize
            lineHeightMode: Text.FixedHeight
            lineHeight: M.runLine
            textFormat: Text.PlainText
            text: modelData.text || ""
        }
    }
}
