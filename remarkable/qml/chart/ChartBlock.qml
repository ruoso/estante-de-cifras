// A run of a unit's pieces, stacked (reader.qml_chart): what a column draws
// of one keep-together unit (blocks.js). It chooses each piece's row
// component by its kind, builds them all at once, and lays them out at the
// column's width, synchronously, so its height is known before anything is
// shown (workflow 19 rules 1 and 9). The same component measures a unit,
// invisible, and draws a slice of it on a page.
import QtQuick

Item {
    id: block
    objectName: "block"

    // The pieces to draw (blocks.js), and the faces to draw them in.
    property var pieces: []
    property var faces
    // Widest natural width of a sung line or a row of bars among the pieces.
    property int naturalWidth: 0

    property var _items: []

    readonly property var _components: ({
        section: sectionRow,
        sung: sungRow,
        bars: barsRow,
        run: runRow,
        words: wordsRow,
        gap: gapRow,
        paragraph: notesParagraph,
        verbatimLine: verbatimLine,
        empty: emptyRow
    })

    Component { id: sectionRow; SectionRow {} }
    Component { id: sungRow; SungRow {} }
    Component { id: barsRow; BarsRow {} }
    Component { id: runRow; RunRow {} }
    Component { id: wordsRow; WordsRow {} }
    Component { id: gapRow; GapRow {} }
    Component { id: notesParagraph; NotesParagraph {} }
    Component { id: verbatimLine; VerbatimLine {} }
    Component { id: emptyRow; EmptyRow {} }

    // Each piece's height, in order: a breakable unit's break heights.
    function pieceHeights() {
        return _items.map(item => item.height);
    }

    function pieceItems() {
        return _items.slice();
    }

    // Lay the pieces out at width w, one under the other.
    function layout(w) {
        width = w;
        let y = 0;
        let natural = 0;
        for (const item of _items) {
            item.layout(w);
            item.y = y;
            y += item.height;
            natural = Math.max(natural, item.naturalWidth);
        }
        naturalWidth = natural;
        height = y;
    }

    Component.onCompleted: {
        const items = [];
        for (const piece of pieces) {
            const component = _components[piece.kind];
            if (!component)
                continue;
            const item = component.createObject(block, { piece: piece, faces: block.faces });
            if (item)
                items.push(item);
        }
        _items = items;
        if (width > 0)
            layout(width);
    }
}
