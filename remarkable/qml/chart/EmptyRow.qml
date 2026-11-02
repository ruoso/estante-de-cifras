// A section with nothing written in it (chartRows `empty`, which the reading
// view's markEmpty adds; the backend sends none today, but the chart draws
// every row chartRows can produce): reading.emptySection, in the interface
// face.
import QtQuick
import "metrics.js" as M

Item {
    id: row
    objectName: "piece"
    property var piece
    property var faces
    readonly property string kind: "empty"
    readonly property int rowIndex: piece.row
    readonly property int naturalWidth: 0

    function layout(w) {
        width = w;
        note.width = w;
        note.height = Math.ceil(note.implicitHeight);
        height = note.height + M.pieceSpacing;
    }

    Text {
        id: note
        objectName: "emptyNote"
        color: "black"
        font.family: row.faces.ui
        font.weight: Font.Normal
        font.pixelSize: M.emptySize
        lineHeightMode: Text.FixedHeight
        lineHeight: M.emptyLine
        wrapMode: Text.WordWrap
        textFormat: Text.PlainText
        text: qsTr("Nothing written here yet.")
    }
}
