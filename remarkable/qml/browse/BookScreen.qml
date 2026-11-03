// A book (reader.browse_screens; workflow 19 §A book; Book.dc.html). Four
// regions, fixed in place, each replaced in one place and counted in
// `revision` (workflow 19 §What it costs):
//
//   the book answered (`show`)           bar, list, letters, foot
//   a page turned                        list, foot
//   a letter                             list, foot (the letters untouched)
//
// Its setlists first, each its name and *12 songs*, then its songs, title
// over artist, in the backend's order (by path, as the web app's book page
// lists them); a heading above the first of each kind, on the page where it
// falls; ten rows a page. A book of more than two pages has the letter rows
// above the foot. A row sends `2 open` of its setlist or song and stays
// inverted until the answer replaces the screen (rule 7); Back sends
// `2 open {view: "shelf"}`.
import QtQuick
import "../chart"
import "../chart/metrics.js" as M
import "pages.js" as Pages

Item {
    id: screen
    objectName: "bookScreen"

    property var endpoint: null
    readonly property Faces faces: Faces {}

    readonly property ListBar bar: listBar
    readonly property Region list: listRegion
    readonly property LetterRows letters: letterRows
    readonly property ListFoot foot: listFoot
    readonly property alias rows: rowRepeater
    readonly property alias headings: headingRepeater
    readonly property alias emptyText: emptyText
    // The book shown ({ bookId, title, … }), null before the first.
    readonly property var book: d.book
    readonly property int page: d.page
    readonly property int pageCount: Pages.pageCount(d.rows.length, d.pages)
    readonly property bool hasLetters: d.hasLetters
    readonly property string pending: d.pending

    width: M.screenWidth
    height: M.barHeight + M.contentHeight + M.footHeight

    // A `104 book`, drawn at `page` (clamped to its pages).
    function show(book, page) {
        d.book = book;
        d.rows = Pages.bookRows(book);
        // As many rows as the content holds; past two pages the letter rows
        // take their room at its foot, and the rows what is left.
        let pages = Pages.heightPages(d.rows, M.contentHeight, M.listRow, M.listHeading);
        d.hasLetters = pages.length > 2;
        if (d.hasLetters)
            pages = Pages.heightPages(d.rows, M.contentHeight - M.letterRowsHeight, M.listRow, M.listHeading);
        d.pages = pages;
        d.page = Pages.clamp(page, d.rows.length, d.pages);
        d.pending = "";
        listBar.show({ title: Pages.bookTitle(book && book.title), back: true, action: "" });
        letterRows.show({ pages: d.hasLetters ? Pages.letterPages(book, d.pages) : {} });
        d.commitList();
        d.commitFoot();
    }

    QtObject {
        id: d
        property var book: null
        property var rows: []
        property var pages: [0]
        property int page: 0
        property bool hasLetters: false
        property string pending: ""

        function send(type, payload) {
            if (screen.endpoint)
                screen.endpoint.sendMessage(type, JSON.stringify(payload));
        }

        function commitList() {
            listRegion.show({
                rows: Pages.pageRows(d.rows, d.page, M.listRow, M.listHeading, d.pages),
                empty: d.rows.length === 0 || Pages.list(d.book && d.book.songs).length === 0
            });
        }

        function commitFoot() {
            listFoot.show({ left: "", page: d.page, pageCount: screen.pageCount });
        }

        function goTo(p) {
            if (p < 0 || p >= screen.pageCount || p === d.page || d.pending !== "")
                return;
            d.page = p;
            commitList();
            commitFoot();
        }

        function open(row) {
            if (d.pending !== "" || d.book === null)
                return;
            d.pending = "row:" + row.index;
            d.send(2, { view: row.kind, bookId: d.book.bookId, path: row.path });
        }
    }

    ListBar {
        id: listBar
        x: 0
        y: 0
        faces: screen.faces
        pending: d.pending === "back" ? "back" : ""
        onBackTapped: {
            if (d.pending !== "")
                return;
            d.pending = "back";
            d.send(2, { view: "shelf" });
        }
    }

    Region {
        id: listRegion
        objectName: "list"
        x: 0
        y: M.barHeight
        width: screen.width
        height: M.contentHeight - (screen.hasLetters ? M.letterRowsHeight : 0)
        content: ({ rows: [], empty: false })

        SwipeArea {
            onSwiped: delta => d.goTo(d.page + delta)
        }

        // *Setlists*, *Songs*: 30 px bold capitals with a 3 px rule under.
        Repeater {
            id: headingRepeater
            model: (listRegion.content.rows || []).filter(r => r.heading)
            Item {
                objectName: "heading"
                readonly property string text: modelData.heading
                x: 0
                y: modelData.headingY
                width: listRegion.width
                height: M.listHeading
                Text {
                    objectName: "headingText"
                    x: M.contentSide
                    y: M.listHeading - M.rule - 8 - height
                    width: parent.width - 2 * M.contentSide
                    height: 40
                    color: "black"
                    font.family: screen.faces.ui
                    font.weight: Font.Bold
                    font.pixelSize: 30
                    font.letterSpacing: 2
                    font.capitalization: Font.AllUppercase
                    verticalAlignment: Text.AlignBottom
                    textFormat: Text.PlainText
                    text: modelData.heading
                }
                Rectangle {
                    objectName: "headingRule"
                    x: M.contentSide
                    y: M.listHeading - M.rule
                    width: parent.width - 2 * M.contentSide
                    height: M.rule
                    color: "black"
                    antialiasing: false
                }
            }
        }

        Repeater {
            id: rowRepeater
            model: listRegion.content.rows || []
            ListRow {
                readonly property var row: modelData
                faces: screen.faces
                y: modelData.y
                height: M.listRow
                titleSize: 42
                detailSize: 30
                rightSize: 32
                title: modelData.title
                detail: modelData.detail
                rightWord: modelData.right
                held: d.pending === "row:" + modelData.index
                onActivated: d.open(modelData)
                onSwiped: delta => d.goTo(d.page + delta)
            }
        }

        Text {
            id: emptyText
            objectName: "emptyBook"
            visible: listRegion.content.empty === true
            x: M.contentSide
            y: listRegion.content.rows && listRegion.content.rows.length > 0
               ? listRegion.content.rows[listRegion.content.rows.length - 1].y + M.listRow + 48 : 48
            width: listRegion.width - 2 * M.contentSide
            height: Math.ceil(contentHeight)
            color: "black"
            font.family: screen.faces.ui
            font.pixelSize: 40
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: Pages.copy.emptyBook
        }
    }

    LetterRows {
        id: letterRows
        x: 0
        y: M.barHeight + M.contentHeight - M.letterRowsHeight
        faces: screen.faces
        visible: screen.hasLetters
        onLetterTapped: (letter, page) => d.goTo(page)
    }

    ListFoot {
        id: listFoot
        x: 0
        y: M.barHeight + M.contentHeight
        faces: screen.faces
        onPreviousTapped: d.goTo(d.page - 1)
        onNextTapped: d.goTo(d.page + 1)
    }
}
