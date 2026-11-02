// A browse screen's foot (reader.browse_screens; workflow 19 §The screen; the
// boards' 100 px footer, a 3 px rule over it): an optional word at its left
// (the shelf's *Settings*), and at its right the page — *2 of 5* — between
// its arrows. A list of one page keeps its foot, without arrows, so the
// content never changes height. `content` is { left, page, pageCount };
// replaced in one place, `show`.
import QtQuick
import "../song"
import "../chart/metrics.js" as M

Region {
    id: foot
    objectName: "foot"

    property var faces
    property string pending: ""
    readonly property alias leftButton: leftButton
    readonly property alias previous: previous
    readonly property alias next: next
    readonly property alias pageLabel: pageLabel

    signal leftTapped
    signal previousTapped
    signal nextTapped

    content: ({ left: "", page: 0, pageCount: 0 })
    width: M.screenWidth
    height: M.footHeight

    Rectangle {
        objectName: "footRule"
        x: 0
        y: 0
        width: foot.width
        height: M.rule
        color: "black"
        antialiasing: false
    }

    InkButton {
        id: leftButton
        objectName: "leftButton"
        faces: foot.faces
        visible: (foot.content.left || "") !== ""
        active: visible
        x: 40
        y: M.rule + Math.floor((M.footHeight - M.rule - height) / 2)
        height: 84
        padding: 8
        bordered: false
        underline: true
        fontSize: 34
        text: foot.content.left || ""
        held: foot.pending === "left"
        onActivated: foot.leftTapped()
    }

    InkButton {
        id: next
        objectName: "next"
        faces: foot.faces
        visible: foot.content.pageCount > 1
        active: visible
        arrow: "only-right"
        width: 96
        height: 80
        x: foot.width - 40 - width
        y: M.rule + Math.floor((M.footHeight - M.rule - height) / 2)
        onActivated: foot.nextTapped()
    }

    Text {
        id: pageLabel
        objectName: "pageLabel"
        width: 200
        height: 46
        x: foot.content.pageCount > 1 ? next.x - 24 - width : foot.width - 40 - width
        y: M.rule + Math.floor((M.footHeight - M.rule - height) / 2)
        color: "black"
        font.family: foot.faces ? foot.faces.ui : ""
        font.pixelSize: 34
        horizontalAlignment: foot.content.pageCount > 1 ? Text.AlignHCenter : Text.AlignRight
        verticalAlignment: Text.AlignVCenter
        textFormat: Text.PlainText
        text: foot.content.pageCount > 0 ? (foot.content.page + 1) + " of " + foot.content.pageCount : ""
    }

    InkButton {
        id: previous
        objectName: "previous"
        faces: foot.faces
        visible: foot.content.pageCount > 1
        active: visible
        arrow: "only-left"
        width: 96
        height: 80
        x: pageLabel.x - 24 - width
        y: M.rule + Math.floor((M.footHeight - M.rule - height) / 2)
        onActivated: foot.previousTapped()
    }
}
