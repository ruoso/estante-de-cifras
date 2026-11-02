// A blank line inside a fence: room, and no ink (chartRows `gap`). Dropped
// at a column's top (paginate.js).
import QtQuick
import "metrics.js" as M

Item {
    objectName: "piece"
    property var piece
    property var faces
    readonly property string kind: "gap"
    readonly property int rowIndex: piece.row
    readonly property int naturalWidth: 0

    function layout(w) {
        width = w;
        height = M.gapHeight;
    }
}
