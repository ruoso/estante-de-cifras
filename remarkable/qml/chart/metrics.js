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
var barsHeight = 72;
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

// The song screen's chrome (reader.song_screen; workflow 19 §The screen,
// §A song): the bar 140 px and the foot 100 px, each with a 3 px rule
// (Song.dc.html L18–30, L71–83).
var barHeight = 140;
var footHeight = 100;
var rule = 3;

// The shapes strip (Song.dc.html L48–68; Song-paged.dc.html L46–52): a 3 px
// rule, 12 px of padding, the head a fixed 72 px (its buttons appearing never
// change the strip's height), 6 px to the first row, rows 8 px apart, 20 px
// under the last. Compact diagrams eight to a row, large ones up to five; a
// row is a symbol line over the box. The head alone (rows 0) keeps *Show
// hidden* reachable on a song whose pages show no shape but hide some.
var stripTop = 12;
var stripHead = 72;
var stripHeadGap = 6;
var stripRowGap = 8;
var stripBottom = 20;
var stripLeft = 48;
var stripRight = 40;
var stripPerRow = { compact: 8, large: 5 };
var stripPerPage = 16;
var stripMaxRows = 2;
var stripLargeMax = 5;

function stripRowHeight(size) {
    var d = diagram[size === "large" ? "large" : "compact"];
    return d.symbolLine + d.height;
}

// Where the strip's first row starts, from the strip's top.
var stripRowsTop = rule + stripTop + stripHead + stripHeadGap;

// The strip's height for `rows` rows of `size` diagrams; 0 rows is the head
// alone.
function stripHeight(size, rows) {
    if (rows <= 0)
        return rule + stripTop + stripHead + stripBottom;
    return stripRowsTop + rows * stripRowHeight(size) + (rows - 1) * stripRowGap + stripBottom;
}

// The shapes strip's height for `rows` rows of compact diagrams. The song
// screen owns the strip; the chart is given what is left.
function compactStripHeight(rows) {
    return stripHeight("compact", rows);
}

// The key grid (Song-key.dc.html L58–75, L143): a 3 px rule, 20 px of
// padding, the head (*Key*, *As written*, *Your key*), 16 px, two rows of six
// keys 100 px tall 12 px apart, *As written* and *Close* in a 300 px column to
// the right, 48 px from the keys.
var keyGridHeight = 380;
var keyGridTop = 20;
var keyGridHeadLine = 44;
var keyGridGap = 16;
var keyHeight = 100;
var keyGap = 12;
var keyColumnWidth = 300;
var keyColumnGap = 48;
