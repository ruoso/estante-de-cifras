// The strip's region (reader.song_screen; workflow 19 §A song: shapes on
// every page, the strip paging past sixteen, hiding a voicing, the key grid):
// at the bottom of the content, its height fixed for the song. It draws one
// of:
//   - "shapes": the head — *Shapes on this page · 8*, *· 11 hidden* with
//     **Show hidden**, *1–16 of 24* with its own ‹ *1 of 2* › — over this
//     page's diagrams, in the order they first appear (Song.dc.html L48–68,
//     Song-paged L46–52, Song-known L46–52);
//   - "hidden": *Hidden on this page · 3* with **Done**, over the page's
//     hidden shapes, each a tap to show again;
//   - "question": in the head's place, *C#° · x45320 — hide this shape in
//     every song?* with **Hide** and **Cancel**, the tapped diagram inverted
//     (Song-shape-tap L44–56);
//   - "grid": the key grid, over the bottom of the chart from the foot up when
//     the strip is shorter than it (or hidden) (Song-key L58–75; workflow 19
//     §A song as amended);
//   - "none": nothing (a song with no shapes, or the shapes hidden).
// What it draws is replaced in one place, `show`, which bumps `revision`. The
// strip's buttons are its own turn zones, never the chart's (§A song).
import QtQuick
import "../chart"
import "../chart/metrics.js" as M

Item {
    id: strip
    objectName: "strip"

    property var faces
    property string pending: ""
    readonly property var content: d.content
    readonly property int revision: d.revision
    readonly property alias headText: headText
    readonly property alias diagrams: diagrams
    readonly property alias grid: grid
    readonly property alias showHiddenButton: showHiddenButton
    readonly property alias doneButton: doneButton
    readonly property alias stripPrevious: stripPrevious
    readonly property alias stripNext: stripNext
    readonly property alias stripPageLabel: stripPageLabel
    readonly property alias hideButton: hideButton
    readonly property alias cancelButton: cancelButton
    readonly property alias panel: panel
    // The question, as one line: "C#° · x45320 — hide this shape in every song?".
    readonly property string questionText: d.content.question
        ? d.content.question.symbol + " · " + d.content.question.frets + " — hide this shape in every song?" : ""

    signal diagramTapped(int index)
    signal showHidden
    signal done
    signal previousShapes
    signal moreShapes
    signal hide
    signal cancel
    signal keyChosen(int offset)
    signal asWritten
    signal gridClosed

    function show(content) {
        d.content = content;
        d.revision += 1;
    }

    readonly property string mode: d.content.mode
    readonly property var layout: d.content.layout || ({ size: "compact", rows: 0, perPage: 0, height: 0 })
    readonly property var page: d.content.strip || ({ shapes: [], page: 0, pages: 1, range: "" })
    readonly property int cellWidth: Math.floor((width - M.stripLeft - M.stripRight)
                                                / (layout.size === "large" ? M.stripPerRow.large : M.stripPerRow.compact))
    readonly property int headTop: M.rule + M.stripTop

    width: M.screenWidth
    height: d.content.height
    x: 0
    y: M.barHeight + M.contentHeight - height

    QtObject {
        id: d
        property var content: ({ mode: "none", height: 0 })
        property int revision: 0
    }

    // The strip, or the hidden shapes over the chart's foot when the strip
    // is its head alone.
    Item {
        id: panel
        objectName: "stripPanel"
        visible: strip.mode === "shapes" || strip.mode === "hidden" || strip.mode === "question"
        x: 0
        width: strip.width
        height: Math.max(strip.height, strip.layout.height)
        y: strip.height - height

        // Taps between the diagrams are the strip's, never the chart's.
        MouseArea {
            objectName: "stripGround"
            x: 0
            y: 0
            width: panel.width
            height: panel.height
        }

        Rectangle {
            objectName: "stripPaper"
            x: 0
            y: 0
            width: panel.width
            height: panel.height
            color: "white"
            border.width: 0
            antialiasing: false
        }

        Rectangle {
            objectName: "stripRule"
            x: 0
            y: 0
            width: panel.width
            height: M.rule
            color: "black"
            antialiasing: false
        }

        // The head: its words at the left, its buttons at the right.
        Text {
            id: headText
            objectName: "stripHead"
            visible: strip.mode === "shapes" || strip.mode === "hidden"
            x: M.stripLeft
            y: strip.headTop
            width: Math.max(0, headButtonsLeft() - 20 - x)
            height: M.stripHead
            color: "black"
            font.family: strip.faces ? strip.faces.ui : ""
            font.weight: Font.Bold
            font.pixelSize: 28
            font.letterSpacing: 2
            font.capitalization: Font.AllUppercase
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: strip.headWords()

            function headButtonsLeft() {
                let left = panel.width - M.stripRight;
                if (stripPrevious.visible)
                    left = stripPrevious.x;
                if (showHiddenButton.visible)
                    left = Math.min(left, showHiddenButton.x);
                if (doneButton.visible)
                    left = Math.min(left, doneButton.x);
                return left;
            }
        }

        InkButton {
            id: stripNext
            objectName: "moreShapes"
            faces: strip.faces
            visible: (strip.mode === "shapes" || strip.mode === "hidden") && strip.page.pages > 1
            active: visible
            arrow: "only-right"
            width: 96
            height: M.stripHead
            x: panel.width - M.stripRight - width
            y: strip.headTop
            onActivated: strip.moreShapes()
        }

        Text {
            id: stripPageLabel
            objectName: "stripPageLabel"
            visible: stripNext.visible
            width: 90
            height: M.stripHead
            x: stripNext.x - 20 - width
            y: strip.headTop
            color: "black"
            font.family: strip.faces ? strip.faces.ui : ""
            font.pixelSize: 30
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            textFormat: Text.PlainText
            text: (strip.page.page + 1) + " of " + strip.page.pages
        }

        InkButton {
            id: stripPrevious
            objectName: "previousShapes"
            faces: strip.faces
            visible: stripNext.visible
            active: visible
            arrow: "only-left"
            width: 96
            height: M.stripHead
            x: stripPageLabel.x - 20 - width
            y: strip.headTop
            onActivated: strip.previousShapes()
        }

        InkButton {
            id: showHiddenButton
            objectName: "showHidden"
            faces: strip.faces
            visible: strip.mode === "shapes" && (strip.content.hiddenCount || 0) > 0
            active: visible
            height: M.stripHead
            padding: 32
            fontSize: 30
            x: (stripPrevious.visible ? stripPrevious.x : panel.width - M.stripRight) - 20 - width
            y: strip.headTop
            text: "Show hidden"
            onActivated: strip.showHidden()
        }

        InkButton {
            id: doneButton
            objectName: "done"
            faces: strip.faces
            visible: strip.mode === "hidden"
            active: visible
            height: M.stripHead
            padding: 32
            fontSize: 30
            x: (stripPrevious.visible ? stripPrevious.x : panel.width - M.stripRight) - 20 - width
            y: strip.headTop
            text: "Done"
            onActivated: strip.done()
        }

        // The question, in the head's place.
        Rectangle {
            id: question
            objectName: "question"
            visible: strip.mode === "question"
            x: M.stripLeft
            y: M.rule + 2
            width: panel.width - M.stripLeft - M.stripRight
            height: M.stripTop + M.stripHead - 2
            radius: 12
            color: "white"
            border.color: "black"
            border.width: 3
            antialiasing: false

            Text {
                id: questionShape
                objectName: "questionShape"
                x: 24
                y: Math.floor((question.height - height) / 2)
                width: Math.ceil(implicitWidth)
                height: 40
                color: "black"
                font.family: strip.faces ? strip.faces.chart : ""
                font.variableAxes: ({ "wght": 700 })
                font.pixelSize: 32
                verticalAlignment: Text.AlignVCenter
                textFormat: Text.PlainText
                text: strip.content.question ? strip.content.question.symbol + " · " + strip.content.question.frets : ""
            }

            Text {
                objectName: "questionWords"
                x: questionShape.x + questionShape.width
                y: questionShape.y
                width: Math.max(0, cancelButton.x - 20 - x)
                height: 40
                color: "black"
                font.family: strip.faces ? strip.faces.ui : ""
                font.pixelSize: 32
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
                textFormat: Text.PlainText
                text: " — hide this shape in every song?"
            }

            InkButton {
                id: cancelButton
                objectName: "cancel"
                faces: strip.faces
                active: question.visible
                height: 68
                radius: 10
                fontSize: 32
                x: hideButton.x - 20 - width
                y: Math.floor((question.height - height) / 2)
                text: "Cancel"
                onActivated: strip.cancel()
            }

            // Hide is drawn inverted (Song-shape-tap L48), and stays so while
            // the backend answers.
            InkButton {
                id: hideButton
                objectName: "hide"
                faces: strip.faces
                active: question.visible
                height: 68
                radius: 10
                fontSize: 32
                x: question.width - 12 - width
                y: Math.floor((question.height - height) / 2)
                text: "Hide"
                held: true
                onActivated: strip.hide()
            }
        }

        Repeater {
            id: diagrams
            model: strip.page.shapes || []
            Item {
                id: cell
                objectName: "shapeCell"
                readonly property var shape: modelData
                readonly property bool pendingShape: !shape.model
                readonly property int perRow: strip.layout.size === "large" ? M.stripPerRow.large : M.stripPerRow.compact
                readonly property alias diagram: diagram
                x: M.stripLeft + (index % perRow) * strip.cellWidth
                y: M.stripRowsTop + Math.floor(index / perRow) * (M.stripRowHeight(strip.layout.size) + M.stripRowGap)
                width: strip.cellWidth
                height: M.stripRowHeight(strip.layout.size)

                ChordDiagram {
                    id: diagram
                    faces: strip.faces
                    size: strip.layout.size === "large" ? "large" : "compact"
                    model: cell.pendingShape ? null : cell.shape.model
                    symbol: cell.shape.symbol || ""
                    x: Math.floor((cell.width - width) / 2)
                    y: 0
                    inverted: touch.pressed
                              || (strip.mode === "question" && strip.content.question
                                  && strip.content.questionIndex === index)
                              || strip.pending === "show:" + index
                }

                MouseArea {
                    id: touch
                    objectName: "shapeTouch"
                    enabled: !cell.pendingShape && strip.mode !== "grid"
                    x: 0
                    y: 0
                    width: cell.width
                    height: cell.height
                    onClicked: strip.diagramTapped(index)
                }
            }
        }
    }

    KeyGrid {
        id: grid
        faces: strip.faces
        visible: strip.mode === "grid"
        content: strip.content.grid || ({ choices: [], offset: 0, asWritten: "", yourKey: "" })
        pending: strip.pending
        x: 0
        width: strip.width
        height: Math.max(strip.height, M.keyGridHeight)
        y: strip.height - height
        onChosen: offset => strip.keyChosen(offset)
        onAsWritten: strip.asWritten()
        onClosed: strip.gridClosed()
    }

    // The head's words for the mode and the page's counts.
    function headWords() {
        const c = d.content;
        if (c.mode === "hidden")
            return "Hidden on this page · " + (page.range || (c.hiddenCount || 0));
        if (c.mode !== "shapes")
            return "";
        return "Shapes on this page · " + (page.range || (c.shownCount || 0))
            + ((c.hiddenCount || 0) > 0 ? " · " + c.hiddenCount + " hidden" : "");
    }
}
