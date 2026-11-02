.pragma library
// The chart's sizes, in one place (reader.qml_chart). Whole pixels, taken
// from the reader's boards (docs/reader-mockups/Song.dc.html,
// Song-lyrics.dc.html), which follow workflow 19's own rules: one bit,
// strokes of at least 2 px, a face read at arm's length on a stand.

// The screen (workflow 19 §The screen): 1404 × 1872, the bar 140 px and the
// foot 100 px, so the content is 1632 px tall; the boards pad it 48 px a side.
var screenWidth = 1404;
var contentHeight = 1632;
var contentSide = 48;
var chartWidth = screenWidth - 2 * contentSide;

// Two columns, 64 px apart (Song-lyrics L30).
var columnGap = 64;

// Space under every piece of the chart (Song L31: rows 10 px apart).
var pieceSpacing = 10;

// Section names: Atkinson Hyperlegible 34 px/700, 14 px above (Song L34).
var sectionSize = 34;
var sectionLine = 44;
var sectionTop = 14;

// Sung lines: a chord (Figtree 38 px/700, line 50 px) over its words (44 px,
// line 56 px), segments wrapping as units (Song-lyrics L44–50).
var sungChordSize = 38;
var sungChordLine = 50;
var wordsSize = 44;
var wordsLine = 56;
var sungMargin = 4;
var segmentGap = 16;    // room after a chord wider than its words
var tailGap = 24;       // a chord past the end of the words (layout.js `tail`)
var hyphenWidth = 16;
var hyphenStroke = 3;

// Bars: four to a row, 72 px tall, chords in Figtree 40 px/700, 28 px apart,
// 3 px bar lines (Song L36–38, L92–98). A repeat sign is a 6 px and a 3 px
// line with two 8 px dots.
var barHeight = 72;
var barsPerRow = 4;
var barRule = 3;
var barPadLeft = 20;
var barPadRight = 16;
var chordSize = 40;
var chordLine = 56;
var chordGap = 28;
var repeatThick = 6;
var repeatThin = 3;
var repeatSpace = 4;
var repeatDot = 8;
var repeatSign = repeatThick + repeatSpace + repeatThin + repeatSpace + repeatDot;
var countGap = 8;

// A run line and a words line: the chord face and the words face.
var runLine = 56;

// Notes: Figtree 36 px, wrapped.
var notesSize = 36;
var notesLine = 46;

// Verbatim: Atkinson Hyperlegible Mono, never wrapped.
var verbatimSize = 32;
var verbatimLine = 40;

// An empty section's line, in the interface face.
var emptySize = 34;
var emptyLine = 44;

// A blank line inside a fence: room, no ink.
var gapHeight = 28;

// The chord diagram at its two sizes (Song L121–142; Song-lyrics L123–140).
// `box` is the diagram without its symbol; the symbol line sits above it.
// The large strings are 28 px apart, not the board's 30, so that a 26 px dot
// on an outer string stays inside the 170 px box; marks are 18 px rings.
var diagram = {
    large: {
        width: 170, height: 222, top: 44, stringSpacing: 28, fretSpacing: 34,
        nut: 8, stroke: 3, dot: 26, fingerSize: 20, markSize: 18, ringBorder: 3,
        markFontSize: 30, fretNumberSize: 24, symbolSize: 40, symbolLine: 50
    },
    compact: {
        width: 124, height: 168, top: 32, stringSpacing: 20, fretSpacing: 26,
        nut: 6, stroke: 2, dot: 22, fingerSize: 16, markSize: 18, ringBorder: 2,
        markFontSize: 24, fretNumberSize: 20, symbolSize: 32, symbolLine: 40
    }
};

// The shapes strip's height for `rows` rows of compact diagrams (Song
// L101–106): a 3 px rule, 16 px and 20 px of padding, the 28 px title line
// (34 px) and its 6 px gap, each row a symbol line over the box, rows 8 px
// apart. The song screen owns the strip; the chart is given what is left.
function compactStripHeight(rows) {
    var d = diagram.compact;
    return 3 + 16 + 34 + 6 + rows * (d.symbolLine + d.height) + (rows - 1) * 8 + 20;
}
