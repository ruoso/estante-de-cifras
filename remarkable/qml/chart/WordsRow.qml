// A line of words with no chord over it (chartRows `words`): the words face,
// wrapped at the column's edge, never split across columns.
import QtQuick
import "metrics.js" as M

Item {
    id: row
    objectName: "piece"
    property var piece
    property var faces
    readonly property string kind: "words"
    readonly property int rowIndex: piece.row
    readonly property int naturalWidth: 0

    function layout(w) {
        width = w;
        words.width = w;
        height = Math.ceil(words.implicitHeight) + 2 * M.sungMargin + M.pieceSpacing;
        words.height = Math.ceil(words.implicitHeight);
    }

    Text {
        id: words
        objectName: "wordsLine"
        y: M.sungMargin
        color: "black"
        font.family: row.faces.chart
        font.variableAxes: ({ "wght": 400 })
        font.pixelSize: M.wordsSize
        lineHeightMode: Text.FixedHeight
        lineHeight: M.wordsLine
        wrapMode: Text.WordWrap
        textFormat: Text.PlainText
        text: row.piece.text
    }
}
