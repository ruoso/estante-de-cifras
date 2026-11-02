// One line of a verbatim block (chartRows `verbatim{info, text}`): Atkinson
// Hyperlegible Mono, its whitespace kept, never wrapped, clipped at the
// column's edge (workflow 19 §The screen, as amended). A verbatim block
// taller than a column breaks between its lines (paginate.js).
import QtQuick
import "metrics.js" as M

Item {
    id: row
    objectName: "piece"
    property var piece
    property var faces
    readonly property string kind: "verbatimLine"
    readonly property int rowIndex: piece.row
    readonly property int naturalWidth: 0
    clip: true

    function layout(w) {
        width = w;
        height = M.verbatimLine + (row.piece.last ? M.pieceSpacing : 0);
    }

    Text {
        objectName: "verbatimLine"
        width: Math.ceil(implicitWidth)
        height: M.verbatimLine
        color: "black"
        font.family: row.faces.mono
        font.variableAxes: ({ "wght": 400 })
        font.pixelSize: M.verbatimSize
        lineHeightMode: Text.FixedHeight
        lineHeight: M.verbatimLine
        wrapMode: Text.NoWrap
        textFormat: Text.PlainText
        text: row.piece.text
    }
}
