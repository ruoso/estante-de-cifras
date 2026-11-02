// A sung line (chartRows `sung{segments}`): each segment a chord (Figtree
// 38 px/700) over its words (44 px), the chord drawn at its segment's left
// edge, so it stays over its words. Segments wrap as units: a line wider than
// its column goes on below at a segment boundary (Song-lyrics.dc.html
// L44–50). A chord that splits a word, and is wider than its part of it, opens
// a gap a centred hyphen bridges (layout.js `hyphen`); a chord past the end of
// the words keeps a space before it (`tail`). The line is one piece: never
// split across columns or pages.
import QtQuick
import "metrics.js" as M

Item {
    id: row
    objectName: "piece"
    property var piece
    property var faces
    readonly property string kind: "sung"
    readonly property int rowIndex: piece.row
    property int naturalWidth: 0
    property int lineCount: 1

    function layout(w) {
        width = w;
        const segments = row.piece.segments;
        const lineHeight = M.sungChordLine + M.wordsLine;
        let x = 0;
        let line = 0;
        let natural = 0;
        for (let i = 0; i < segments.length; ++i) {
            const seg = repeater.itemAt(i);
            const d = segments[i];
            const chordWidth = d.chord ? seg.chordWidth + M.segmentGap : 0;
            const wordsWidth = seg.wordsWidth;
            const segWidth = Math.max(chordWidth, wordsWidth);
            const lead = d.tail ? M.tailGap : 0;
            natural += lead + segWidth;
            let at = x + lead;
            if (x > 0 && at + segWidth > w) {
                line += 1;
                at = 0;
            }
            seg.x = at;
            seg.y = M.sungMargin + line * lineHeight;
            seg.width = segWidth;
            seg.height = lineHeight;
            seg.hyphenRoom = d.hyphen && chordWidth > wordsWidth ? chordWidth - wordsWidth : 0;
            x = at + segWidth;
        }
        naturalWidth = natural;
        lineCount = line + 1;
        height = 2 * M.sungMargin + lineCount * lineHeight + M.pieceSpacing;
    }

    Repeater {
        id: repeater
        model: row.piece.segments
        delegate: Item {
            id: segment
            objectName: "sungSegment"
            readonly property int chordWidth: Math.ceil(chord.implicitWidth)
            readonly property int wordsWidth: Math.ceil(words.implicitWidth)
            property int hyphenRoom: 0

            Text {
                id: chord
                objectName: "chord"
                x: 0
                y: 0
                width: segment.chordWidth
                height: M.sungChordLine
                color: "black"
                font.family: row.faces.chart
                font.variableAxes: ({ "wght": 700 })
                font.pixelSize: M.sungChordSize
                lineHeightMode: Text.FixedHeight
                lineHeight: M.sungChordLine
                textFormat: Text.PlainText
                text: modelData.chord || ""
            }
            Text {
                id: words
                objectName: "words"
                x: 0
                y: M.sungChordLine
                width: segment.wordsWidth
                height: M.wordsLine
                color: "black"
                font.family: row.faces.chart
                font.variableAxes: ({ "wght": 400 })
                font.pixelSize: M.wordsSize
                lineHeightMode: Text.FixedHeight
                lineHeight: M.wordsLine
                textFormat: Text.PlainText
                text: modelData.words || ""
            }
            Repeater {
                model: segment.hyphenRoom > 0 ? 1 : 0
                Rectangle {
                    objectName: "hyphen"
                    readonly property int span: Math.max(2, Math.min(M.hyphenWidth, segment.hyphenRoom - 8))
                    x: segment.wordsWidth + Math.floor((segment.hyphenRoom - span) / 2)
                    y: M.sungChordLine + Math.floor(M.wordsLine / 2)
                    width: span
                    height: M.hyphenStroke
                    color: "black"
                    antialiasing: false
                }
            }
        }
    }
}
