// A browse screen's bar (reader.browse_screens; workflow 19 §The screen; the
// boards' 140 px header, a 3 px rule under it): *Back* with its arrow at the
// left (when the screen has one), the title, and at most one action at the
// right. `content` is { title, back, action, reserve } — `reserve` keeps the
// right slot's room though empty (a setlist's, for Play). Replaced in one
// place, `show`.
import QtQuick
import "../song"
import "../chart/metrics.js" as M
import "pages.js" as Pages

Region {
    id: bar
    objectName: "bar"

    property var faces
    // The control waiting on the backend: "back", "action" or "".
    property string pending: ""
    readonly property alias back: back
    readonly property alias action: action
    readonly property alias title: title

    readonly property int actionRoom: 300

    signal backTapped
    signal actionTapped

    content: ({ title: "", back: false, action: "", reserve: false })
    width: M.screenWidth
    height: M.barHeight

    Rectangle {
        objectName: "barRule"
        x: 0
        y: M.barHeight - M.rule
        width: bar.width
        height: M.rule
        color: "black"
        antialiasing: false
    }

    InkButton {
        id: back
        objectName: "back"
        faces: bar.faces
        visible: bar.content.back === true
        active: visible
        x: 40
        y: 18
        height: 100
        padding: 16
        bordered: false
        arrow: "left"
        fontSize: 38
        text: Pages.copy.back
        held: bar.pending === "back"
        onActivated: bar.backTapped()
    }

    Text {
        id: title
        objectName: "title"
        x: back.visible ? back.x + back.width + 32 : 48
        y: Math.floor((M.barHeight - M.rule - height) / 2)
        width: Math.max(0, bar.width - 40
                        - ((bar.content.action || bar.content.reserve) ? bar.actionRoom + 32 : 8) - x)
        height: 56
        color: "black"
        font.family: bar.faces ? bar.faces.ui : ""
        font.weight: Font.Bold
        font.pixelSize: 46
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
        textFormat: Text.PlainText
        text: bar.content.title || ""
    }

    InkButton {
        id: action
        objectName: "action"
        faces: bar.faces
        visible: (bar.content.action || "") !== ""
        active: visible
        x: bar.width - 40 - width
        y: 22
        height: 96
        padding: 40
        fontSize: 36
        text: bar.content.action || ""
        held: bar.pending === "action"
        onActivated: bar.actionTapped()
    }
}
