// The reader's QML root: the file AppLoad loads (reader.app_folder;
// docs/remarkable-reader.md §2, §3.1, §3.3; rm-appload README §Applications'
// format). It holds the AppLoad endpoint, says hello when created, keeps the
// last state the backend sent, and routes each view the backend answers to
// its screen (reader.browse_screens): *Not paired* and the code page, the
// shelf, a book, a setlist, Settings, and the song (reader.song_screen),
// handing it the `108 shapes` found in the background (reader.missed_shapes)
// and, while it plays a setlist, the `109 ahead` neighbours (reader.play).
// It computes nothing the backend would need. Fixed at the rM2's portrait
// 1404 × 1872 (workflow 19 §The screen); one bit, black on white, nothing
// animated, nothing drawn before the first state (the refresh budget, rules
// 1, 2 and 6).
//
// The screens are kept alive and hidden, never rebuilt (Decision 2): a view
// answered fills its screen, then that screen alone is shown — one redraw.
// Background news redraws nothing but the shelf's sync line (rule 5): a
// `101` elsewhere changes nothing on screen; `paired: false` mid-reading
// waits for the next shelf, which is drawn as *Not paired* (Decision 4).
import QtQuick
import net.asivery.AppLoad 1.0
import "song"
import "browse"
import "browse/pages.js" as Pages

Rectangle {
    id: root
    width: 1404
    height: 1872
    color: "white"

    // AppLoad closes this UI instance when the root emits close
    // (rm-appload resources/qml/window.qml).
    signal close

    property alias endpoint: backend
    property alias notPaired: notPaired
    property alias shelfScreen: shelfScreen
    property alias bookScreen: bookScreen
    property alias setlistScreen: setlistScreen
    property alias settingsScreen: settingsScreen
    property alias songScreen: songScreen

    // The last `101 state` (design §6), null until the first.
    property var backendState: null
    // The screen shown: "" (nothing, before the first state), "notPaired",
    // "shelf", "book", "setlist", "settings" or "song".
    readonly property string view: d.view
    readonly property bool songShown: d.view === "song"

    // Called by AppLoad as it unloads the UI. The backend is left running, so
    // it keeps syncing in the background (design §2, §5.3).
    function unloading() {
    }

    QtObject {
        id: d
        property string view: ""
        // `open shelf` sent and not yet answered (Decision 3).
        property bool shelfAsked: false
        // Sign out confirmed: the next unpaired state shows Not paired.
        property bool signingOut: false
        // The page each book was left on for a song or a setlist, by bookId,
        // and the shelf's (Decision 9); in memory only.
        property var bookPages: ({})
        property int shelfPage: 0

        function send(type, payload) {
            backend.sendMessage(type, JSON.stringify(payload));
        }

        function openShelf() {
            if (d.shelfAsked)
                return;
            d.shelfAsked = true;
            send(2, { view: "shelf" });
        }

        // The screen shown leaves for `next`: what it was showing is
        // remembered where Back will want it.
        function leave(next) {
            if (d.view === "book" && bookScreen.book !== null) {
                const pages = Object.assign({}, d.bookPages);
                if (next === "song" || next === "setlist")
                    pages[bookScreen.book.bookId] = bookScreen.page;
                else
                    delete pages[bookScreen.book.bookId];
                d.bookPages = pages;
            }
            if (d.view === "shelf" && next !== "shelf")
                d.shelfPage = shelfScreen.page;
            if (d.view === "song" && next !== "song")
                // The song left: opened again, it is laid out from its first
                // page, never taken for a re-voicing.
                songScreen.sheet = null;
        }

        function showNotPaired() {
            leave("notPaired");
            d.signingOut = false;
            d.shelfAsked = false;
            d.bookPages = {};
            d.shelfPage = 0;
            notPaired.show();
            d.view = "notPaired";
        }

        function state(s) {
            root.backendState = s;
            const paired = s.paired === true;
            if (d.view === "") {
                if (paired)
                    openShelf();
                else
                    showNotPaired();
                return;
            }
            if (d.view === "notPaired") {
                // The pairing approved: the shelf replaces the page when it
                // is answered (one redraw of the content).
                if (paired)
                    openShelf();
                return;
            }
            if (!paired && d.signingOut) {
                showNotPaired();
                return;
            }
            if (d.view === "shelf")
                shelfScreen.showState(s);
        }

        function shelf(p) {
            d.shelfAsked = false;
            if (root.backendState !== null && root.backendState.paired !== true) {
                showNotPaired();
                return;
            }
            leave("shelf");
            shelfScreen.show(p, root.backendState,
                             d.view === "shelf" ? shelfScreen.page : d.shelfPage);
            d.view = "shelf";
        }

        function book(p) {
            const kept = d.bookPages[p.bookId];
            leave("book");
            const pages = Object.assign({}, d.bookPages);
            delete pages[p.bookId];
            d.bookPages = pages;
            bookScreen.show(p, kept !== undefined ? kept : 0);
            d.view = "book";
        }

        function setlist(p) {
            const fromBook = bookScreen.book !== null && bookScreen.book.bookId === p.bookId;
            leave("setlist");
            setlistScreen.show(p, fromBook ? Pages.bookTitle(bookScreen.book.title) : "");
            d.view = "setlist";
        }

        function settings(p) {
            if (d.view === "settings") {
                settingsScreen.showShapes(p);
                return;
            }
            leave("settings");
            settingsScreen.show(p, root.backendState);
            d.view = "settings";
        }

        function sheet(p) {
            leave("song");
            songScreen.sheet = p;
            d.view = "song";
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
            switch (type) {
            case 101:
                d.state(payload);
                break;
            case 102:
                // Only while the code page is asked for or shown.
                if (d.view === "notPaired")
                    notPaired.pairing(payload);
                break;
            case 103:
                d.shelf(payload);
                break;
            case 104:
                d.book(payload);
                break;
            case 105:
                d.sheet(payload);
                break;
            case 106:
                d.setlist(payload);
                break;
            case 107:
                d.settings(payload);
                break;
            case 108:
                // A shape found in the background for the song on screen
                // (reader.missed_shapes): the song screen keeps it for the
                // next page it draws; nothing else changes.
                if (d.view === "song")
                    songScreen.found(payload);
                break;
            case 109:
                // A neighbour of the song played, read ahead (reader.play):
                // the song screen holds it only while it shows a played sheet
                // of the same setlist and book; nothing is drawn.
                if (d.view === "song")
                    songScreen.ahead(payload);
                break;
            }
        }
    }

    NotPaired {
        id: notPaired
        x: 0
        y: 0
        visible: d.view === "notPaired"
        endpoint: backend
    }

    ShelfScreen {
        id: shelfScreen
        x: 0
        y: 0
        visible: d.view === "shelf"
        endpoint: backend
    }

    BookScreen {
        id: bookScreen
        x: 0
        y: 0
        visible: d.view === "book"
        endpoint: backend
    }

    SetlistScreen {
        id: setlistScreen
        x: 0
        y: 0
        visible: d.view === "setlist"
        endpoint: backend
    }

    SettingsScreen {
        id: settingsScreen
        x: 0
        y: 0
        visible: d.view === "settings"
        endpoint: backend
        onSignedOut: d.signingOut = true
    }

    // The song (workflow 19 §A song): shown by a `105 sheet`, its Back sending
    // `2 open {view: "book"}` through the endpoint — or, played from a setlist
    // (reader.play), `{view: "setlist"}`, the setlist screen's `106` giving it
    // the place and the neighbours. Hide shapes is the backend's state, kept
    // on this reMarkable (shown before the first state).
    SongScreen {
        id: songScreen
        x: 0
        y: 0
        visible: d.view === "song"
        endpoint: backend
        setlist: setlistScreen.setlist
        shapesShown: root.backendState === null || root.backendState.shapesShown !== false
    }

    // Design §6 `1 hello`: JSON always, `{}` (protocol.md Decision 8).
    Component.onCompleted: backend.sendMessage(1, JSON.stringify({}))
}
