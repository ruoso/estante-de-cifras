// One paragraph of a notes part (chartRows `notes{paragraphs}`): Figtree
// 36 px, wrapped, its own lines kept. A notes block taller than a column
// breaks between its paragraphs (paginate.js).
import QtQuick
import "metrics.js" as M

Item {
    id: row
    objectName: "piece"
    property var piece
    property var faces
    readonly property string kind: "paragraph"
    readonly property int rowIndex: piece.row
    readonly property int naturalWidth: 0

    function layout(w) {
        width = w;
        para.width = w;
        para.height = Math.ceil(para.implicitHeight);
        height = para.height + M.pieceSpacing;
    }

    Text {
        id: para
        objectName: "notesParagraph"
        color: "black"
        font.family: row.faces.chart
        font.variableAxes: ({ "wght": 400 })
        font.pixelSize: M.notesSize
        lineHeightMode: Text.FixedHeight
        lineHeight: M.notesLine
        wrapMode: Text.WordWrap
        textFormat: Text.PlainText
        text: row.piece.text
    }
}
