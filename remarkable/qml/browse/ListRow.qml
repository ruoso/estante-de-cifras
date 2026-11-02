// A list's row (reader.browse_screens; workflow 19 §The shelf, §A book, §A
// setlist; rule 10): the whole width is its target. A title over a second
// line (a book's counts, a song's artist, a setlist item's note), with an
// optional number at its left (a setlist's *1*) and a word at its right
// (*12 songs*, *in D*, *missing*). Pressed, it inverts at once (rule 7), and
// stays inverted while `held` — its open on its way. A swipe across it turns
// the list instead (workflow 19 §The screen: a list turns by a swipe or the
// foot's arrows). A 2 px rule under it.
import QtQuick
import "../chart/metrics.js" as M

Item {
    id: row

    property var faces
    property string title: ""
    property string detail: ""
    property bool italicDetail: false
    property string number: ""
    property string rightWord: ""
    property int titleSize: 42
    property int detailSize: 30
    property int rightSize: 32
    property bool rightBold: false
    property bool active: true
    property bool held: false

    readonly property bool inverted: (area.pressed && active) || held
    readonly property color ink: inverted ? "white" : "black"
    readonly property alias area: area
    readonly property alias titleText: titleText
    readonly property alias detailText: detailText
    readonly property alias numberText: numberText
    readonly property alias rightText: rightText

    signal activated
    // +1 forward (right to left), −1 back.
    signal swiped(int delta)

    width: M.screenWidth
    height: M.listRow

    readonly property int side: M.contentSide
    readonly property int numberWidth: number !== "" ? 64 : 0
    readonly property int textX: side + (number !== "" ? numberWidth + 32 : 0)
    readonly property int rightWidth: rightWord !== "" ? Math.ceil(rightText.implicitWidth) : 0
    readonly property bool twoLines: detail !== ""
    readonly property int block: titleText.height + (twoLines ? 6 + detailText.height : 0)
    readonly property int textTop: Math.floor((height - M.listRule - block) / 2)

    Rectangle {
        objectName: "rowPaper"
        x: 0
        y: 0
        width: row.width
        height: row.height - M.listRule
        color: row.inverted ? "black" : "white"
        border.width: 0
        antialiasing: false
    }

    Rectangle {
        objectName: "rowRule"
        x: row.side
        y: row.height - M.listRule
        width: row.width - 2 * row.side
        height: M.listRule
        color: "black"
        antialiasing: false
    }

    Text {
        id: numberText
        objectName: "rowNumber"
        visible: row.number !== ""
        x: row.side
        y: row.textTop
        width: row.numberWidth
        height: titleText.height
        color: row.ink
        font.family: row.faces ? row.faces.ui : ""
        font.weight: Font.Bold
        font.pixelSize: row.titleSize
        horizontalAlignment: Text.AlignRight
        verticalAlignment: Text.AlignVCenter
        textFormat: Text.PlainText
        text: row.number
    }

    Text {
        id: titleText
        objectName: "rowTitle"
        x: row.textX
        y: row.textTop
        width: Math.max(0, row.width - row.side - x - (row.rightWidth > 0 ? row.rightWidth + 32 : 0))
        height: Math.ceil(row.titleSize * 1.3)
        color: row.ink
        font.family: row.faces ? row.faces.ui : ""
        font.weight: Font.Bold
        font.pixelSize: row.titleSize
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
        textFormat: Text.PlainText
        text: row.title
    }

    Text {
        id: detailText
        objectName: "rowDetail"
        visible: row.twoLines
        x: row.textX
        y: titleText.y + titleText.height + 6
        width: titleText.width
        height: Math.ceil(row.detailSize * 1.3)
        color: row.ink
        font.family: row.faces ? row.faces.ui : ""
        font.pixelSize: row.detailSize
        font.italic: row.italicDetail
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
        textFormat: Text.PlainText
        text: row.detail
    }

    Text {
        id: rightText
        objectName: "rowRight"
        visible: row.rightWord !== ""
        x: row.width - row.side - width
        y: row.textTop
        width: row.rightWidth
        height: titleText.height
        color: row.ink
        font.family: row.faces ? row.faces.ui : ""
        font.weight: row.rightBold ? Font.Bold : Font.Normal
        font.pixelSize: row.rightSize
        horizontalAlignment: Text.AlignRight
        verticalAlignment: Text.AlignVCenter
        textFormat: Text.PlainText
        text: row.rightWord
    }

    MouseArea {
        id: area
        objectName: "touch"
        x: 0
        y: 0
        width: row.width
        height: row.height
        property real fromX: 0
        property real fromY: 0
        onPressed: mouse => {
            fromX = mouse.x;
            fromY = mouse.y;
        }
        onReleased: mouse => {
            const dx = mouse.x - fromX;
            const dy = mouse.y - fromY;
            // A swipe: at least 120 px across, more across than down.
            if (Math.abs(dx) >= 120 && Math.abs(dx) > Math.abs(dy)) {
                row.swiped(dx < 0 ? 1 : -1);
                return;
            }
            if (Math.abs(dx) >= 40 || Math.abs(dy) >= 40)
                return;
            if (row.active && mouse.x >= 0 && mouse.x < width && mouse.y >= 0 && mouse.y < height)
                row.activated();
        }
    }
}
