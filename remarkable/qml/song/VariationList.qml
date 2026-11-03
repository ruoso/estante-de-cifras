// The variation list (reader.song_screen; workflow 19 §A song, the variation):
// laid out as the key grid is — its head *Variation*, the song's variations
// for the tuning it is read in (its voicing blocks, by name; the unnamed one
// *Default*), the one read inverted, three across, 100 px tall (rule 10), and
// *Close* to the right. A variation is chosen in one tap (rule 8); it stays on
// this reMarkable for the song and tuning. Part of the strip's region: it is
// drawn by ShapesStrip's `show`.
import QtQuick
import "../chart/metrics.js" as M
import "../browse/pages.js" as Pages

Item {
    id: list
    objectName: "variationList"

    property var faces
    // { variations: ["", "Up the neck"], current: "" }
    property var content: ({ variations: [], current: "" })
    property string pending: ""
    readonly property alias choices: choices
    readonly property alias closeButton: closeButton

    signal chosen(string variation)
    signal closed

    readonly property int choicesTop: M.rule + M.keyGridTop + M.keyGridHeadLine + M.keyGridGap
    readonly property int columnX: width - M.contentSide - M.keyColumnWidth
    readonly property int perRow: 3
    readonly property int choiceWidth: Math.floor((columnX - M.keyColumnGap - M.contentSide - (perRow - 1) * M.keyGap) / perRow)

    width: M.screenWidth
    height: M.keyGridHeight

    // The list takes its whole area: a tap in it is never the chart's.
    MouseArea {
        objectName: "variationGround"
        x: 0
        y: 0
        width: list.width
        height: list.height
    }

    Rectangle {
        x: 0
        y: 0
        width: list.width
        height: list.height
        color: "white"
        border.width: 0
        antialiasing: false
    }

    Rectangle {
        objectName: "variationRule"
        x: 0
        y: 0
        width: list.width
        height: M.rule
        color: "black"
        antialiasing: false
    }

    Text {
        objectName: "variationHead"
        x: M.contentSide
        y: M.rule + M.keyGridTop
        width: Math.ceil(implicitWidth)
        height: M.keyGridHeadLine
        color: "black"
        font.family: list.faces ? list.faces.ui : ""
        font.weight: Font.Bold
        font.pixelSize: 30
        font.letterSpacing: 2
        font.capitalization: Font.AllUppercase
        verticalAlignment: Text.AlignVCenter
        textFormat: Text.PlainText
        text: Pages.copy.variation
    }

    Repeater {
        id: choices
        model: list.content.variations || []
        InkButton {
            objectName: "variationChoice"
            readonly property string variation: modelData
            faces: list.faces
            fontSize: 36
            bold: false
            width: list.choiceWidth
            height: M.keyHeight
            padding: 24
            elide: true
            x: M.contentSide + (index % list.perRow) * (list.choiceWidth + M.keyGap)
            y: list.choicesTop + Math.floor(index / list.perRow) * (M.keyHeight + M.keyGap)
            text: Pages.variationName(modelData)
            held: modelData === list.content.current || list.pending === "variation:" + modelData
            onActivated: list.chosen(modelData)
        }
    }

    InkButton {
        id: closeButton
        objectName: "variationClose"
        faces: list.faces
        fontSize: 36
        width: M.keyColumnWidth
        height: M.keyHeight
        x: list.columnX
        y: list.choicesTop
        text: Pages.copy.close
        onActivated: list.closed()
    }
}
