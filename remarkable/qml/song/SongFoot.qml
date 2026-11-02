// The song screen's foot (reader.song_screen; workflow 19 §The screen, §A
// song; Song.dc.html L71–83): *Hide shapes* or *Show shapes* at its left, and
// at its right the page — *2 of 5*, *3 of 3 · End* — between its arrows. A
// one-page song keeps its foot, without arrows, so the content never changes
// height. Played from a setlist (reader.play), a song before or after it
// gives the arrows a turn across songs, and *End* is said only on the last
// playable item's last page. 100 px, a 3 px rule over it. What it draws is replaced in one
// place, `show`, which bumps `revision`.
import QtQuick
import "../chart/metrics.js" as M

Item {
    id: foot
    objectName: "foot"

    property var faces
    property string pending: ""
    // { page, pageCount, shapes: "hide" | "show" | "", before, after } —
    // before / after: a played song has a song before / after it.
    readonly property var content: d.content
    readonly property int revision: d.revision
    readonly property alias shapesButton: shapesButton
    readonly property alias previous: previous
    readonly property alias next: next
    readonly property alias pageLabel: pageLabel

    signal previousTapped
    signal nextTapped
    signal shapesTapped

    function show(content) {
        d.content = content;
        d.revision += 1;
    }

    // "2 of 5"; "3 of 3 · End" on the last page — of the last song, when
    // played.
    function label(c) {
        if (!c || c.pageCount <= 0)
            return "";
        const last = c.page >= c.pageCount - 1 && c.after !== true;
        return (c.page + 1) + " of " + c.pageCount + (last ? " · End" : "");
    }

    width: M.screenWidth
    height: M.footHeight

    QtObject {
        id: d
        property var content: ({ page: 0, pageCount: 0, shapes: "" })
        property int revision: 0
    }

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
        id: shapesButton
        objectName: "shapesButton"
        faces: foot.faces
        visible: foot.content.shapes !== ""
        active: visible
        x: 40
        y: M.rule + Math.floor((M.footHeight - M.rule - height) / 2)
        height: 84
        padding: 8
        bordered: false
        underline: true
        fontSize: 34
        text: foot.content.shapes === "show" ? "Show shapes" : "Hide shapes"
        held: foot.pending === "shapes"
        onActivated: foot.shapesTapped()
    }

    InkButton {
        id: next
        objectName: "next"
        faces: foot.faces
        visible: foot.content.pageCount > 1 || foot.content.before === true || foot.content.after === true
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
        width: 260
        height: 46
        x: next.x - 24 - width
        y: M.rule + Math.floor((M.footHeight - M.rule - height) / 2)
        color: "black"
        font.family: foot.faces ? foot.faces.ui : ""
        font.pixelSize: 34
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        textFormat: Text.PlainText
        text: foot.label(foot.content)
    }

    InkButton {
        id: previous
        objectName: "previous"
        faces: foot.faces
        visible: foot.content.pageCount > 1 || foot.content.before === true || foot.content.after === true
        active: visible
        arrow: "only-left"
        width: 96
        height: 80
        x: pageLabel.x - 24 - width
        y: M.rule + Math.floor((M.footHeight - M.rule - height) / 2)
        onActivated: foot.previousTapped()
    }
}
