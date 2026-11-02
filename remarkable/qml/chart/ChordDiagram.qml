// A chord diagram drawn from its model (reader.qml_chart;
// docs/remarkable-reader.md §7, as amended; workflow 19 §A song). The model is
// diagramModel's (app/src/render/diagram.js), drawn as given: strings already
// mirrored for a left-handed player, the start fret, the nut and the barre are
// never worked out again here. One component at two sizes, `large` (170 × 222)
// and `compact` (124 × 168), the symbol above in Figtree 700. Pixel-aligned
// black Rectangles and Text on white: strings, frets, the nut, the dots (round
// Rectangles, centred on string × row), the barre (one rounded Rectangle from
// its first string to its last), the fingers in white Atkinson Hyperlegible
// 700 inside them, open marks as rings and muted marks as ×, above the strings,
// and the start fret beside row 0 when the nut is not drawn
// (app/src/render/chord-box.js). A null model — a shape still pending — keeps
// its place, empty, with no symbol (design §6). No default or *your shape*
// marks (workflow 19 §A song).
import QtQuick
import "metrics.js" as M

Item {
    id: diagram

    property var model: null
    property string symbol: ""
    property string size: "large"
    // The faces to draw in (the reader's Faces); a SheetView's when given.
    property var faces: Faces {}

    readonly property var g: M.diagram[size === "compact" ? "compact" : "large"]
    readonly property int boxWidth: g.width
    readonly property int boxHeight: g.height
    readonly property bool drawn: model !== null && model !== undefined && typeof model === "object"

    readonly property int strings: drawn ? (model.stringCount || 0) : 0
    readonly property int fretsShown: drawn ? (model.fretsShown || 0) : 0
    readonly property int gridWidth: strings > 0 ? (strings - 1) * g.stringSpacing + g.stroke : 0
    readonly property int gridLeft: Math.floor((g.width - gridWidth) / 2)
    readonly property int halfStroke: Math.floor(g.stroke / 2)

    function stringX(i) {
        return gridLeft + i * g.stringSpacing;
    }
    function rowCentre(row) {
        return g.top + row * g.fretSpacing + Math.floor(g.fretSpacing / 2);
    }
    function hasFinger(f) {
        return f !== null && f !== undefined && f !== 0 && f !== "";
    }
    function list(x) {
        if (!x)
            return [];
        return Array.isArray(x) ? x : Array.prototype.slice.call(x);
    }

    implicitWidth: g.width
    implicitHeight: g.symbolLine + g.height
    width: implicitWidth
    height: implicitHeight

    Repeater {
        model: diagram.drawn && diagram.symbol !== "" ? 1 : 0
        Text {
            objectName: "symbol"
            width: Math.ceil(implicitWidth)
            height: diagram.g.symbolLine
            x: Math.floor((diagram.g.width - width) / 2)
            y: 0
            color: "black"
            font.family: diagram.faces.chart
            font.variableAxes: ({ "wght": 700 })
            font.pixelSize: diagram.g.symbolSize
            lineHeightMode: Text.FixedHeight
            lineHeight: diagram.g.symbolLine
            textFormat: Text.PlainText
            text: diagram.symbol
        }
    }

    Item {
        id: box
        objectName: "box"
        x: 0
        y: diagram.g.symbolLine
        width: diagram.g.width
        height: diagram.g.height

        Repeater {
            model: diagram.fretsShown > 0 ? diagram.fretsShown + 1 : 0
            Rectangle {
                objectName: "fret"
                x: diagram.gridLeft
                y: diagram.g.top + index * diagram.g.fretSpacing
                width: diagram.gridWidth
                height: diagram.g.stroke
                color: "black"
                antialiasing: false
            }
        }
        Repeater {
            model: diagram.strings
            Rectangle {
                objectName: "string"
                x: diagram.stringX(index)
                y: diagram.g.top
                width: diagram.g.stroke
                height: diagram.fretsShown * diagram.g.fretSpacing + diagram.g.stroke
                color: "black"
                antialiasing: false
            }
        }
        Repeater {
            model: diagram.drawn && diagram.model.showNut ? 1 : 0
            Rectangle {
                objectName: "nut"
                x: diagram.gridLeft
                y: diagram.g.top
                width: diagram.gridWidth
                height: diagram.g.nut
                color: "black"
                antialiasing: false
            }
        }
        Repeater {
            model: diagram.drawn && diagram.model.startFret > 1 ? 1 : 0
            Text {
                objectName: "fretNumber"
                width: Math.ceil(implicitWidth)
                height: diagram.g.fretSpacing
                x: diagram.gridLeft - 6 - width
                y: diagram.g.top
                color: "black"
                font.family: diagram.faces.ui
                font.weight: Font.Bold
                font.pixelSize: diagram.g.fretNumberSize
                lineHeightMode: Text.FixedHeight
                lineHeight: diagram.g.fretSpacing
                verticalAlignment: Text.AlignVCenter
                textFormat: Text.PlainText
                text: String(diagram.model.startFret)
            }
        }
        Repeater {
            model: diagram.drawn && diagram.model.barre ? 1 : 0
            Rectangle {
                id: barre
                objectName: "barre"
                readonly property var b: diagram.model.barre
                x: diagram.stringX(b.fromString) + diagram.halfStroke - diagram.g.dot / 2
                y: diagram.rowCentre(b.row) - diagram.g.dot / 2
                width: (b.toString - b.fromString) * diagram.g.stringSpacing + diagram.g.dot
                height: diagram.g.dot
                radius: diagram.g.dot / 2
                color: "black"
                antialiasing: false
                Repeater {
                    model: diagram.hasFinger(barre.b.finger) ? 1 : 0
                    Text {
                        objectName: "finger"
                        x: 0
                        y: 0
                        width: barre.width
                        height: barre.height
                        color: "white"
                        font.family: diagram.faces.ui
                        font.weight: Font.Bold
                        font.pixelSize: diagram.g.fingerSize
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                        textFormat: Text.PlainText
                        text: String(barre.b.finger)
                    }
                }
            }
        }
        Repeater {
            model: diagram.drawn ? diagram.list(diagram.model.dots) : []
            Rectangle {
                id: dot
                objectName: "dot"
                readonly property var d: modelData
                x: diagram.stringX(d.stringIndex) + diagram.halfStroke - diagram.g.dot / 2
                y: diagram.rowCentre(d.row) - diagram.g.dot / 2
                width: diagram.g.dot
                height: diagram.g.dot
                radius: diagram.g.dot / 2
                color: "black"
                antialiasing: false
                Repeater {
                    model: diagram.hasFinger(dot.d.finger) ? 1 : 0
                    Text {
                        objectName: "finger"
                        x: 0
                        y: 0
                        width: dot.width
                        height: dot.height
                        color: "white"
                        font.family: diagram.faces.ui
                        font.weight: Font.Bold
                        font.pixelSize: diagram.g.fingerSize
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                        textFormat: Text.PlainText
                        text: String(dot.d.finger)
                    }
                }
            }
        }
        Repeater {
            model: diagram.drawn ? diagram.list(diagram.model.markers) : []
            Item {
                id: marker
                readonly property var m: modelData
                readonly property int centre: diagram.stringX(m.stringIndex) + diagram.halfStroke
                x: centre - diagram.g.markSize / 2
                y: Math.floor((diagram.g.top - diagram.g.markSize) / 2)
                width: diagram.g.markSize
                height: diagram.g.markSize
                Repeater {
                    model: marker.m.kind === "open" ? 1 : 0
                    Rectangle {
                        objectName: "open"
                        x: 0
                        y: 0
                        width: diagram.g.markSize
                        height: diagram.g.markSize
                        radius: diagram.g.markSize / 2
                        color: "white"
                        border.color: "black"
                        border.width: diagram.g.ringBorder
                        antialiasing: false
                    }
                }
                Repeater {
                    model: marker.m.kind === "muted" ? 1 : 0
                    Text {
                        objectName: "muted"
                        x: 0
                        y: 0
                        width: diagram.g.markSize
                        height: diagram.g.markSize
                        color: "black"
                        font.family: diagram.faces.ui
                        font.weight: Font.Bold
                        font.pixelSize: diagram.g.markFontSize
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                        textFormat: Text.PlainText
                        text: "×"
                    }
                }
            }
        }
    }
}
