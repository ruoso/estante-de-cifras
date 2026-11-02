// The reader's QML root: the file AppLoad loads (reader.app_folder;
// docs/remarkable-reader.md §2, §3.1, §3.3; rm-appload README §Applications'
// format). It holds the AppLoad endpoint, says hello when created, keeps the
// last state the backend sent and draws it as one line, and shows a `105
// sheet` as the song screen (reader.song_screen), handing it the `108 shapes`
// found in the background (reader.missed_shapes). It computes nothing
// the backend would need. Fixed at the rM2's portrait 1404 × 1872 (workflow
// 19 §The screen); one bit, black on white, nothing animated, nothing drawn
// before the first state (the refresh budget, rules 1, 2 and 6).
import QtQuick
import net.asivery.AppLoad 1.0
import "status.js" as Status
import "song"

Rectangle {
    id: root
    width: 1404
    height: 1872
    color: "white"

    // AppLoad closes this UI instance when the root emits close
    // (rm-appload resources/qml/window.qml).
    signal close

    property alias endpoint: backend
    property alias statusLine: statusLine
    property alias songScreen: songScreen

    // The last `101 state` (design §6), null until the first.
    property var backendState: null
    // A `105 sheet` is on screen, until another view is answered.
    property bool songShown: false

    // Called by AppLoad as it unloads the UI. The backend is left running, so
    // it keeps syncing in the background (design §2, §5.3).
    function unloading() {
    }

    AppLoad {
        id: backend
        applicationID: "estante"
        onMessageReceived: (type, contents) => {
            // The views this root draws (reader.song_screen Decision 11): the
            // state, and a `105 sheet` as the song screen. The other views
            // hide the song and show the status line until
            // reader.browse_screens draws them.
            if (type !== 101 && type !== 103 && type !== 104 && type !== 105
                && type !== 106 && type !== 107 && type !== 108)
                return;
            let payload;
            try {
                payload = JSON.parse(contents);
            } catch (e) {
                return;
            }
            if (payload === null || typeof payload !== "object")
                return;
            if (type === 101) {
                root.backendState = payload;
            } else if (type === 108) {
                // A shape found in the background for the song on screen
                // (reader.missed_shapes): the song screen keeps it for the
                // next page it draws; nothing else changes.
                if (root.songShown)
                    songScreen.found(payload);
            } else if (type === 105) {
                songScreen.sheet = payload;
                root.songShown = true;
            } else {
                // The song left: opened again, it is laid out from its first
                // page, never taken for a re-voicing.
                root.songShown = false;
                songScreen.sheet = null;
            }
        }
    }

    Text {
        id: statusLine
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: 64
        color: "black"
        font.pixelSize: 36
        wrapMode: Text.WordWrap
        visible: !root.songShown
        text: Status.statusLine(root.backendState)
    }

    // The song (workflow 19 §A song): shown by a `105 sheet`, its Back sending
    // `2 open {view: "book"}` through the endpoint. Hide shapes is the
    // backend's state, kept on this reMarkable (shown before the first state).
    SongScreen {
        id: songScreen
        x: 0
        y: 0
        visible: root.songShown
        endpoint: backend
        shapesShown: root.backendState === null || root.backendState.shapesShown !== false
    }

    // Design §6 `1 hello`: JSON always, `{}` (protocol.md Decision 8).
    Component.onCompleted: backend.sendMessage(1, JSON.stringify({}))
}
