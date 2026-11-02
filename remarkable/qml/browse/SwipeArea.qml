// A list's swipe zone (reader.browse_screens; workflow 19 §The screen as
// amended: a list turns by a swipe or the foot's arrows, its rows being the
// targets). Fills its parent under the rows; a swipe of at least 120 px,
// more across than down, is one turn — right to left forward. A tap does
// nothing.
import QtQuick

MouseArea {
    id: swipe
    objectName: "swipe"
    x: 0
    y: 0
    width: parent ? parent.width : 0
    height: parent ? parent.height : 0
    property real fromX: 0
    property real fromY: 0

    signal swiped(int delta)

    onPressed: mouse => {
        fromX = mouse.x;
        fromY = mouse.y;
    }
    onReleased: mouse => {
        const dx = mouse.x - fromX;
        const dy = mouse.y - fromY;
        if (Math.abs(dx) >= 120 && Math.abs(dx) > Math.abs(dy))
            swipe.swiped(dx < 0 ? 1 : -1);
    }
}
