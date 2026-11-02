// The reader's QML root: the file AppLoad loads (reader.app_folder;
// docs/remarkable-reader.md §2, §3.1, §3.3; rm-appload README §Applications'
// format). It holds the AppLoad endpoint, says hello when created, keeps the
// last state the backend sent and draws it as one line. It computes nothing
// the backend would need. Fixed at the rM2's portrait 1404 × 1872 (workflow
// 19 §The screen); one bit, black on white, nothing animated, nothing drawn
// before the first state (the refresh budget, rules 1, 2 and 6).
import QtQuick
import net.asivery.AppLoad 1.0
import "status.js" as Status

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

    // The last `101 state` (design §6), null until the first.
    property var backendState: null

    // Called by AppLoad as it unloads the UI. The backend is left running, so
    // it keeps syncing in the background (design §2, §5.3).
    function unloading() {
    }

    AppLoad {
        id: backend
        applicationID: "estante"
        onMessageReceived: (type, contents) => {
            if (type !== 101)
                return;
            let state;
            try {
                state = JSON.parse(contents);
            } catch (e) {
                return;
            }
            if (state !== null && typeof state === "object")
                root.backendState = state;
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
        text: Status.statusLine(root.backendState)
    }

    // Design §6 `1 hello`: JSON always, `{}` (protocol.md Decision 8).
    Component.onCompleted: backend.sendMessage(1, JSON.stringify({}))
}
