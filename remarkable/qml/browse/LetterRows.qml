// A book's letter rows (reader.browse_screens; workflow 19 §A book, rule 8;
// Book.dc.html L41–49): two rows of thirteen cells, A–Z, each 108 × 100 px
// above the foot, a 3 px rule over them. Only a letter that starts a song is
// drawn, as a target; an absent letter leaves its cell empty, so the letters
// never move. None is marked as the current one; they never change while the
// book is open. `content` is { pages: { A: 0, … } }; replaced in one place,
// `show`.
import QtQuick
import "../song"
import "../chart/metrics.js" as M
import "pages.js" as Pages

Region {
    id: letters
    objectName: "letters"

    property var faces
    readonly property alias cells: cells

    signal letterTapped(string letter, int page)

    content: ({ pages: {} })
    width: M.screenWidth
    height: M.letterRowsHeight

    // The cell holding a letter, drawn or not.
    function cell(letter) {
        const i = Pages.alphabet.indexOf(letter);
        return i >= 0 ? cells.itemAt(i) : null;
    }

    Repeater {
        id: cells
        model: Pages.alphabet
        Item {
            id: cell
            objectName: "letterCell"
            readonly property string letter: modelData
            readonly property bool present: letters.content.pages !== undefined
                                            && letters.content.pages[modelData] !== undefined
            readonly property alias button: button
            x: (index % M.letterColumns) * M.letterCellWidth
            y: Math.floor(index / M.letterColumns) * M.letterCellHeight
            width: M.letterCellWidth
            height: M.letterCellHeight

            InkButton {
                id: button
                objectName: "letter"
                faces: letters.faces
                visible: cell.present
                active: visible
                x: 0
                y: 0
                width: cell.width
                height: cell.height
                bordered: false
                radius: 0
                fontSize: 40
                text: cell.letter
                onActivated: letters.letterTapped(cell.letter, letters.content.pages[cell.letter])
            }
        }
    }

    Rectangle {
        objectName: "lettersRule"
        x: 0
        y: 0
        width: letters.width
        height: M.rule
        color: "black"
        antialiasing: false
    }
}
