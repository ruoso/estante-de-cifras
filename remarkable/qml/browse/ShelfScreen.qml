// The shelf (reader.browse_screens; workflow 19 §The shelf; Shelf.dc.html).
// Four regions, fixed in place, each replaced in one place and counted in
// `revision` (workflow 19 §What it costs):
//
//   the shelf answered (`show`)          bar, sync line, list, foot
//   a page turned                        list, foot
//   a `101 state` (`showState`)          the sync line, when its words change
//
// The bar: *Estante*, **Sync** at the right (sends `4 sync`, nothing else —
// the line changes when the state does). The sync line at the content's top
// is the one word on any screen that changes by itself (rule 5). The rows:
// the books in the `103`'s order, each its name (or *Untitled book*) over
// its counts; a row sends `2 open {view: "book"}` and stays inverted until
// the book replaces the screen (rule 7). **Settings** at the foot's left.
import QtQuick
import "../chart"
import "../chart/metrics.js" as M
import "../status.js" as Status
import "pages.js" as Pages

Item {
    id: screen
    objectName: "shelfScreen"

    property var endpoint: null
    readonly property Faces faces: Faces {}

    readonly property ListBar bar: listBar
    readonly property Region syncLine: syncRegion
    readonly property Region list: listRegion
    readonly property ListFoot foot: listFoot
    readonly property alias rows: rowRepeater
    readonly property alias syncText: syncText
    readonly property alias emptyText: emptyText
    readonly property int page: d.page
    readonly property int pageCount: Pages.pageCount(d.books.length, d.pages)
    readonly property string pending: d.pending

    // *Sync* tapped: the person asked for this sync (reader.pairing — a
    // refusal it meets is shown at once, rule 5).
    signal syncTapped

    width: M.screenWidth
    height: M.barHeight + M.contentHeight + M.footHeight

    // A `103 shelf`, drawn at `page` (clamped), with the sync line of `state`.
    function show(shelf, state, page) {
        d.books = Pages.list(shelf && shelf.books);
        d.pages = Pages.evenPages(d.books.length, M.contentHeight - M.syncLineHeight, M.tallRow);
        d.page = Pages.clamp(page, d.books.length, d.pages);
        d.pending = "";
        listBar.show({ title: Pages.copy.shelfTitle, back: false, action: Pages.copy.sync });
        d.line = Status.statusLine(state);
        syncRegion.show({ text: d.line });
        d.commitList();
        d.commitFoot();
    }

    // A `101 state` while the shelf is shown: the sync line, only when its
    // words change (rule 5's exception).
    function showState(state) {
        const line = Status.statusLine(state);
        if (line === d.line)
            return;
        d.line = line;
        syncRegion.show({ text: line });
    }

    QtObject {
        id: d
        property var books: []
        property int page: 0
        property var pages: [0]
        property string line: ""
        property string pending: ""

        function send(type, payload) {
            if (screen.endpoint)
                screen.endpoint.sendMessage(type, JSON.stringify(payload));
        }

        function commitList() {
            const range = Pages.pageRange(d.page, d.books.length, d.pages);
            const from = range.from;
            const rows = d.books.slice(range.from, range.to).map((b, i) => ({
                index: from + i,
                bookId: b.bookId,
                title: Pages.bookTitle(b.title),
                detail: Pages.countLine(b.songs, b.setlists)
            }));
            listRegion.show({ rows: rows, empty: d.books.length === 0 });
        }

        function commitFoot() {
            listFoot.show({ left: Pages.copy.settings, page: d.page, pageCount: screen.pageCount });
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
        onActionTapped: {
            d.send(4, {});
            screen.syncTapped();
        }
    }

    // The sync line: *Synced at 14:32*, *Syncing…*, a 2 px rule under it.
    Region {
        id: syncRegion
        objectName: "syncLine"
        x: 0
        y: M.barHeight
        width: screen.width
        height: M.syncLineHeight
        content: ({ text: "" })

        Text {
            id: syncText
            objectName: "syncText"
            x: M.contentSide
            y: 0
            width: syncRegion.width - 2 * M.contentSide
            height: M.syncLineHeight - M.listRule
            color: "black"
            font.family: screen.faces.ui
            font.pixelSize: 34
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: syncRegion.content.text || ""
        }

        Rectangle {
            objectName: "syncRule"
            x: M.contentSide
            y: M.syncLineHeight - M.listRule
            width: syncRegion.width - 2 * M.contentSide
            height: M.listRule
            color: "black"
            antialiasing: false
        }
    }

    Region {
        id: listRegion
        objectName: "list"
        x: 0
        y: M.barHeight + M.syncLineHeight
        width: screen.width
        height: M.contentHeight - M.syncLineHeight
        content: ({ rows: [], empty: false })

        // A swipe below the last row turns the page too.
        SwipeArea {
            onSwiped: delta => d.turn(delta)
        }

        Repeater {
            id: rowRepeater
            model: listRegion.content.rows || []
            ListRow {
                faces: screen.faces
                y: index * M.tallRow
                height: M.tallRow
                titleSize: 46
                detailSize: 32
                title: modelData.title
                detail: modelData.detail
                held: d.pending === "book:" + modelData.bookId
                onActivated: {
                    if (d.pending !== "")
                        return;
                    d.pending = "book:" + modelData.bookId;
                    d.send(2, { view: "book", bookId: modelData.bookId });
                }
                onSwiped: delta => d.turn(delta)
            }
        }

        Text {
            id: emptyText
            objectName: "emptyShelf"
            visible: listRegion.content.empty === true
            x: M.contentSide
            y: 48
            width: listRegion.width - 2 * M.contentSide
            height: Math.ceil(contentHeight)
            color: "black"
            font.family: screen.faces.ui
            font.pixelSize: 40
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: Pages.copy.emptyShelf
        }
    }

    ListFoot {
        id: listFoot
        x: 0
        y: M.barHeight + M.contentHeight
        faces: screen.faces
        pending: d.pending === "settings" ? "left" : ""
        onLeftTapped: {
            if (d.pending !== "")
                return;
            d.pending = "settings";
            d.send(2, { view: "settings" });
        }
        onPreviousTapped: d.turn(-1)
        onNextTapped: d.turn(1)
    }
}
