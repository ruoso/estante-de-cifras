// The reader's QML root: the file AppLoad loads (reader.app_folder;
// docs/remarkable-reader.md §2, §3.1, §3.3; rm-appload README §Applications'
// format). It holds the AppLoad endpoint, says hello when created, and parses
// what the backend sends; the screens and the routing between them are
// Screens.qml, made once the first `101 state` has come — nothing is drawn
// before it (the refresh budget, rule 1).
//
// The screen is the one AppLoad gives (workflow 19 §The screen, as amended):
// the manifest asks for scaling, so the root is sized to AppLoad's window —
// 1404 × 1872 on the rM2, 1620 × 2160 on the Paper Pro — at scale 1, and the
// screens are laid out for it (chart/metrics.js `configure`), with the
// chart's text at the size the state names (`textSize`, in points, kept on
// this reMarkable — workflow 19 §Settings). A state naming another text size
// makes the screens again at it, and reopens Settings, where it was chosen.
import QtQuick
import net.asivery.AppLoad 1.0
import "chart/metrics.js" as M

Rectangle {
    id: root
    // AppLoad sizes the root to its window; this is the rM2's, for a host
    // that does not.
    width: 1404
    height: 1872
    color: "white"

    // AppLoad closes this UI instance when the root emits close
    // (rm-appload resources/qml/window.qml).
    signal close

    property alias endpoint: backend
    readonly property var screens: loader.item
    readonly property var notPaired: screens ? screens.notPaired : null
    readonly property var shelfScreen: screens ? screens.shelfScreen : null
    readonly property var bookScreen: screens ? screens.bookScreen : null
    readonly property var setlistScreen: screens ? screens.setlistScreen : null
    readonly property var settingsScreen: screens ? screens.settingsScreen : null
    readonly property var songScreen: screens ? screens.songScreen : null

    // The last `101 state` (design §6), null until the first.
    readonly property var backendState: screens ? screens.backendState : null
    // The screen shown: "" (nothing, before the first state), "notPaired",
    // "shelf", "book", "setlist", "settings" or "song".
    readonly property string view: screens ? screens.view : ""
    readonly property bool songShown: view === "song"
    // The text size the screens were made at, 0 before they are.
    readonly property int textSize: d.textSize

    // Called by AppLoad as it unloads the UI. The backend is left running, so
    // it keeps syncing in the background (design §2, §5.3).
    function unloading() {
    }

    QtObject {
        id: d
        property int textSize: 0

        // The screens for a state's text size: made at the first state, made
        // again when another size is named.
        function screensFor(state) {
            const size = M.textSizeOf(state.textSize);
            if (loader.item !== null && size === d.textSize)
                return;
            const again = loader.item !== null;
            M.configure(root.width, root.height, size);
            d.textSize = size;
            loader.resume = again ? "settings" : "";
            loader.active = false;
            loader.active = true;
        }
    }

    Loader {
        id: loader
        property string resume: ""
        active: false
        x: 0
        y: 0
        width: root.width
        height: root.height
        sourceComponent: Component {
            Screens {
                endpoint: backend
                resume: loader.resume
            }
        }
    }

    AppLoad {
        id: backend
        applicationID: "estante"
        onMessageReceived: (type, contents) => {
            if (type < 101 || type > 109)
                return;
            let payload;
            try {
                payload = JSON.parse(contents);
            } catch (e) {
                return;
            }
            if (payload === null || typeof payload !== "object")
                return;
            if (type === 101)
                d.screensFor(payload);
            if (loader.item !== null)
                loader.item.receive(type, payload);
        }
    }

    // Design §6 `1 hello`: JSON always, `{}` (protocol.md Decision 8).
    Component.onCompleted: backend.sendMessage(1, JSON.stringify({}))
}
