// A setlist (reader.browse_screens; workflow 19 §A setlist; Setlist.dc.html).
// Three regions, fixed in place, each replaced in one place and counted in
// `revision` (workflow 19 §What it costs):
//
//   the setlist answered (`show`)        bar, list, foot
//   a page turned                        list, foot
//   Play or a row pressed                none but the control, inverted
//
// The bar: Back (to the book) · the setlist's name · *Play* at the right
// (reader.play), drawn only when the setlist has something to play. The
// content: *Book · n songs* at its top, then the items in order — number,
// title, the setlist's note under it, and at the right *in D* when the
// setlist sets a key, *missing* when the song is not in the book. Ten rows a
// page. *Play* opens the first playable item, playing; a playable row opens
// Play at it. A *missing* row is not a target (reader.play Decision 3): it
// does not invert and sends nothing. Each sends `2 open {view: "song", play}`
// and stays inverted until the answer replaces the screen (rule 7).
import QtQuick
import "../chart"
import "../chart/metrics.js" as M
import "pages.js" as Pages

Item {
    id: screen
    objectName: "setlistScreen"

    property var endpoint: null
    readonly property Faces faces: Faces {}

    readonly property ListBar bar: listBar
    readonly property Region list: listRegion
    readonly property ListFoot foot: listFoot
    readonly property alias rows: rowRepeater
    readonly property alias lineText: lineText
    readonly property var setlist: d.setlist
    readonly property int page: d.page
    readonly property int pageCount: Pages.pageCount(d.items.length, d.pages)
    readonly property string pending: d.pending

    width: M.screenWidth
    height: M.barHeight + M.contentHeight + M.footHeight

    // A `106 setlist`, from the book named `bookName` ("" when not known): on
    // the page holding item `at` when it is set, else the first.
    function show(setlist, bookName) {
        d.setlist = setlist;
        d.items = Pages.list(setlist && setlist.items);
        d.pages = Pages.evenPages(d.items.length, M.contentHeight - M.syncLineHeight, M.tallRow);
        d.page = (setlist && typeof setlist.at === "number")
                 ? Pages.clamp(Pages.pageOf(setlist.at, d.pages), d.items.length, d.pages) : 0;
        d.line = Pages.setlistLine(bookName, d.items.length);
        d.pending = "";
        listBar.show({ title: (setlist && setlist.title) || "", back: true,
                       action: Pages.firstPlayable(d.items) >= 0 ? Pages.copy.play : "", reserve: true });
        d.commitList();
        d.commitFoot();
    }

    QtObject {
        id: d
        property var setlist: null
        property var items: []
        property int page: 0
        property var pages: [0]
        property string line: ""
        property string pending: ""

        function send(type, payload) {
            if (screen.endpoint)
                screen.endpoint.sendMessage(type, JSON.stringify(payload));
        }

        // Open Play at row `at`, its control `pending` held until answered.
        function play(at, pending) {
            if (d.pending !== "" || d.setlist === null || !Pages.playable(d.items[at]))
                return;
            d.pending = pending;
            send(2, { view: "song", bookId: d.setlist.bookId, path: d.items[at].path,
                      play: { setlist: d.setlist.path, at: at } });
        }

        function commitList() {
            const range = Pages.pageRange(d.page, d.items.length, d.pages);
            const from = range.from;
            const rows = d.items.slice(range.from, range.to).map((it, i) => ({
                index: from + i,
                number: String(from + i + 1),
                title: it.title || Pages.fileName(it.path),
                note: it.note || "",
                right: Pages.itemRight(it),
                playable: Pages.playable(it)
            }));
            listRegion.show({ line: d.line, rows: rows });
        }

        function commitFoot() {
            listFoot.show({ left: "", page: d.page, pageCount: screen.pageCount });
        }

        function turn(delta) {
            const p = d.page + delta;
            if (p < 0 || p >= screen.pageCount || d.pending !== "")
                return;
            d.page = p;
            commitList();
            commitFoot();
        }
    }

    ListBar {
        id: listBar
        x: 0
        y: 0
        faces: screen.faces
        pending: d.pending === "back" || d.pending === "action" ? d.pending : ""
        onActionTapped: d.play(Pages.firstPlayable(d.items), "action")
        onBackTapped: {
            if (d.pending !== "" || d.setlist === null)
                return;
            d.pending = "back";
            d.send(2, { view: "book", bookId: d.setlist.bookId });
        }
    }

    Region {
        id: listRegion
        objectName: "list"
        x: 0
        y: M.barHeight
        width: screen.width
        height: M.contentHeight
        content: ({ line: "", rows: [] })

        SwipeArea {
            onSwiped: delta => d.turn(delta)
        }

        Text {
            id: lineText
            objectName: "setlistLine"
            x: M.contentSide
            y: 0
            width: listRegion.width - 2 * M.contentSide
            height: M.syncLineHeight - M.listRule
            color: "black"
            font.family: screen.faces.ui
            font.pixelSize: 34
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: listRegion.content.line || ""
        }

        Rectangle {
            objectName: "setlistLineRule"
            x: M.contentSide
            y: M.syncLineHeight - M.listRule
            width: listRegion.width - 2 * M.contentSide
            height: M.listRule
            color: "black"
            antialiasing: false
        }

        Repeater {
            id: rowRepeater
            model: listRegion.content.rows || []
            ListRow {
                readonly property var item: modelData
                faces: screen.faces
                y: M.syncLineHeight + index * M.tallRow
                height: M.tallRow
                active: modelData.playable === true
                held: screen.pending === "row:" + modelData.index
                titleSize: 44
                detailSize: 32
                italicDetail: true
                rightSize: 38
                rightBold: true
                number: modelData.number
                title: modelData.title
                detail: modelData.note
                rightWord: modelData.right
                onSwiped: delta => d.turn(delta)
                onActivated: d.play(modelData.index, "row:" + modelData.index)
            }
        }
    }

    ListFoot {
        id: listFoot
        x: 0
        y: M.barHeight + M.contentHeight
        faces: screen.faces
        onPreviousTapped: d.turn(-1)
        onNextTapped: d.turn(1)
    }
}
