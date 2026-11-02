// The key grid (reader.song_screen; workflow 19 §A song, the key; Song-key
// .dc.html L58–75): its head — *Key*, *As written: G*, and *Your key: A* when
// a saved key differs — the twelve keys six across, in the names the sheet
// brings (`key.choices`, design §3.3: the screen spells no key), the current
// one inverted; *As written* and *Close* to the right. Keys 100 px tall in
// Figtree 42 px/700 (rule 10). A key is chosen in one tap, never stepped to
// (rule 8). Part of the strip's region: it is drawn by ShapesStrip's `show`.
import QtQuick
import "../chart/metrics.js" as M

Item {
    id: grid
    objectName: "keyGrid"

    property var faces
    // { choices: [{ name, offset }], offset, asWritten, yourKey }
    property var content: ({ choices: [], offset: 0, asWritten: "", yourKey: "" })
    property string pending: ""
    readonly property alias keys: keys
    readonly property alias asWrittenButton: asWrittenButton
    readonly property alias closeButton: closeButton
    readonly property alias asWrittenLabel: asWrittenLabel
    readonly property alias yourKeyLabel: yourKeyLabel

    signal chosen(int offset)
    signal asWritten
    signal closed

    readonly property int keysTop: M.rule + M.keyGridTop + M.keyGridHeadLine + M.keyGridGap
    readonly property int columnX: width - M.contentSide - M.keyColumnWidth
    readonly property int keyWidth: Math.floor((columnX - M.keyColumnGap - M.contentSide - 5 * M.keyGap) / 6)

    function isCurrent(offset) {
        return (((offset - (content.offset || 0)) % 12) + 12) % 12 === 0;
    }

    width: M.screenWidth
    height: M.keyGridHeight

    // The grid takes its whole area: a tap in it is never the chart's.
    MouseArea {
        objectName: "gridGround"
        x: 0
        y: 0
        width: grid.width
        height: grid.height
    }

    Rectangle {
        objectName: "gridPaper"
        x: 0
        y: 0
        width: grid.width
        height: grid.height
        color: "white"
        border.width: 0
        antialiasing: false
    }

    Rectangle {
        objectName: "gridRule"
        x: 0
        y: 0
        width: grid.width
        height: M.rule
        color: "black"
        antialiasing: false
    }

    Text {
        id: head
        objectName: "gridHead"
        x: M.contentSide
        y: M.rule + M.keyGridTop
        width: Math.ceil(implicitWidth)
        height: M.keyGridHeadLine
        color: "black"
        font.family: grid.faces ? grid.faces.ui : ""
        font.weight: Font.Bold
        font.pixelSize: 30
        font.letterSpacing: 2
        font.capitalization: Font.AllUppercase
        verticalAlignment: Text.AlignVCenter
        textFormat: Text.PlainText
        text: "Key"
    }

    Text {
        id: asWrittenLabel
        objectName: "asWrittenLabel"
        x: head.x + head.width + 48
        y: head.y
        width: Math.ceil(implicitWidth)
        height: M.keyGridHeadLine
        color: "black"
        font.family: grid.faces ? grid.faces.ui : ""
        font.pixelSize: 34
        verticalAlignment: Text.AlignVCenter
        textFormat: Text.PlainText
        text: grid.content.asWritten ? "As written: " + grid.content.asWritten : ""
    }

    Text {
        id: yourKeyLabel
        objectName: "yourKeyLabel"
        visible: text !== ""
        x: asWrittenLabel.x + asWrittenLabel.width + 48
        y: head.y
        width: Math.ceil(implicitWidth)
        height: M.keyGridHeadLine
        color: "black"
        font.family: grid.faces ? grid.faces.ui : ""
        font.pixelSize: 34
        verticalAlignment: Text.AlignVCenter
        textFormat: Text.PlainText
        text: grid.content.yourKey ? "Your key: " + grid.content.yourKey : ""
    }

    Repeater {
        id: keys
        model: grid.content.choices || []
        InkButton {
            objectName: "gridKey"
            readonly property int offset: modelData.offset
            faces: grid.faces
            chartFace: true
            fontSize: 42
            width: grid.keyWidth
            height: M.keyHeight
            x: M.contentSide + (index % 6) * (grid.keyWidth + M.keyGap)
            y: grid.keysTop + Math.floor(index / 6) * (M.keyHeight + M.keyGap)
            text: modelData.name
            held: grid.isCurrent(modelData.offset) || grid.pending === "key:" + modelData.offset
            onActivated: grid.chosen(modelData.offset)
        }
    }

    InkButton {
        id: asWrittenButton
        objectName: "asWritten"
        faces: grid.faces
        fontSize: 36
        width: M.keyColumnWidth
        height: M.keyHeight
        x: grid.columnX
        y: grid.keysTop
        text: "As written"
        held: grid.pending === "asWritten"
        onActivated: grid.asWritten()
    }

    InkButton {
        id: closeButton
        objectName: "close"
        faces: grid.faces
        fontSize: 36
        width: M.keyColumnWidth
        height: M.keyHeight
        x: grid.columnX
        y: grid.keysTop + M.keyHeight + M.keyGap
        text: "Close"
        onActivated: grid.closed()
    }
}
