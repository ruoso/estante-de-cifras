// A section's name, in the interface face (Atkinson Hyperlegible 700), with
// ` ×n` when the heading plays it n times (chartRows `section{name, times?}`;
// Song.dc.html L34). Never the last thing in a column (paginate.js).
import QtQuick
import "metrics.js" as M

Item {
    id: row
    objectName: "piece"
    property var piece
    property var faces
    readonly property string kind: "section"
    readonly property int rowIndex: piece.row
    readonly property int naturalWidth: 0

    function layout(w) {
        width = w;
        height = M.sectionTop + M.sectionLine + M.pieceSpacing;
    }

    Text {
        objectName: "sectionName"
        x: 0
        y: M.sectionTop
        width: Math.ceil(implicitWidth)
        height: M.sectionLine
        color: "black"
        font.family: row.faces.ui
        font.weight: Font.Bold
        font.pixelSize: M.sectionSize
        lineHeightMode: Text.FixedHeight
        lineHeight: M.sectionLine
        textFormat: Text.PlainText
        text: row.piece.name + (row.piece.times ? " ×" + row.piece.times : "")
    }
}
