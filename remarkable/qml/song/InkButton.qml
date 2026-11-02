// A control that inverts at once when pressed (reader.song_screen; workflow
// 19 rule 7, "the pressed control inverts at once"): a Rectangle and its
// Text, black on white, white on black while pressed — and, for a control
// whose action waits on the backend, while `held`, until the answer replaces
// its region. Nothing else in it changes. Its touch area is at least
// 100 × 100 (rule 10) even where the boards draw the ink smaller; the ink is
// the item's own size.
import QtQuick
import "../chart"

Item {
    id: button

    property string text: ""
    // The faces to draw in (the screen's).
    property var faces
    property int fontSize: 34
    property bool bold: true
    property bool underline: false
    property bool chartFace: false
    property bool bordered: true
    property int radius: 12
    property int padding: 36
    // "left" for Back's arrow before the word, "only-left"/"only-right" for an
    // arrow alone; "" for a word alone.
    property string arrow: ""
    // Inverted while the action it asked for is on its way.
    property bool held: false
    property bool active: true

    readonly property bool inverted: area.pressed || held
    readonly property color ink: inverted ? "white" : "black"
    readonly property color paper: inverted ? "black" : "white"
    readonly property alias label: label
    readonly property alias area: area

    signal activated

    implicitWidth: (arrow === "only-left" || arrow === "only-right") ? 96
                   : padding * 2 + Math.ceil(label.implicitWidth) + (arrow === "left" ? chevron.width + 12 : 0)
    implicitHeight: 100
    width: implicitWidth
    height: implicitHeight

    Rectangle {
        id: ink
        objectName: "ink"
        x: 0
        y: 0
        width: button.width
        height: button.height
        radius: button.radius
        color: button.paper
        border.color: button.ink
        border.width: button.bordered ? 3 : 0
        antialiasing: false
    }

    Chevron {
        id: chevron
        visible: button.arrow !== ""
        pointing: button.arrow === "only-right" ? "right" : "left"
        color: button.ink
        x: button.arrow === "left" ? button.padding
           : Math.floor((button.width - width) / 2)
        y: Math.floor((button.height - height) / 2)
    }

    Text {
        id: label
        objectName: "label"
        visible: button.arrow !== "only-left" && button.arrow !== "only-right"
        x: button.arrow === "left" ? chevron.x + chevron.width + 12
           : Math.floor((button.width - width) / 2)
        y: Math.floor((button.height - height) / 2)
        width: Math.ceil(implicitWidth)
        height: Math.ceil(implicitHeight)
        color: button.ink
        font.family: button.faces ? (button.chartFace ? button.faces.chart : button.faces.ui) : ""
        font.weight: button.bold ? Font.Bold : Font.Normal
        font.variableAxes: button.chartFace ? ({ "wght": button.bold ? 700 : 400 }) : ({})
        font.pixelSize: button.fontSize
        font.underline: button.underline
        textFormat: Text.PlainText
        text: button.text
    }

    MouseArea {
        id: area
        objectName: "touch"
        enabled: button.active
        width: Math.max(100, button.width)
        height: Math.max(100, button.height)
        x: Math.floor((button.width - width) / 2)
        y: Math.floor((button.height - height) / 2)
        onClicked: button.activated()
    }
}
