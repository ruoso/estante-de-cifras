// An arrow, ‹ or ›, in whole pixels (reader.song_screen; the boards' 34 px
// chevron, Song.dc.html L20, L74–80): nine steps of 2 px, each 5 px wide, so
// it is one bit with no antialiased edge (workflow 19 rule 6). `pointing` is
// "left" or "right"; `color` black, or white inside an inverted control.
import QtQuick

Item {
    id: chevron
    property string pointing: "left"
    property color color: "black"
    readonly property int steps: 9
    readonly property int step: 2
    readonly property int stroke: 5
    readonly property int reach: 2 * Math.floor(steps / 2)

    implicitWidth: reach + stroke
    implicitHeight: steps * step
    width: implicitWidth
    height: implicitHeight

    Repeater {
        model: chevron.steps
        Rectangle {
            objectName: "chevronStep"
            readonly property int out: 2 * Math.abs(index - Math.floor(chevron.steps / 2))
            x: chevron.pointing === "left" ? out : chevron.reach - out
            y: index * chevron.step
            width: chevron.stroke
            height: chevron.step
            color: chevron.color
            border.width: 0
            antialiasing: false
        }
    }
}
