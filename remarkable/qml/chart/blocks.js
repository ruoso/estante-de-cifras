.pragma library
// Rows → keep-together blocks (reader.qml_chart; workflow 19 §A song, as
// amended). Pure: plain data in, plain data out, no QML items. The rows are
// the backend's `105 sheet` rows, chartRows exactly (docs/remarkable-reader.md
// §6); nothing here computes music — the text drawn is the text a row carries,
// and a chord is known by its token.key, the engine's identity.
//
// A unit is what the pages never split unless it is taller than a column:
//
//   { kind, rows: [rowIndex…], keepWithNext, breakable, pieces: [piece…] }
//
// Its pieces are what a page draws, one item each, and the only places a
// breakable unit may break: between rows of four in a block of bars, between
// paragraphs of notes, between lines of a verbatim block. A sung line, a run
// and a words line are one piece, never split; a section name keeps with what
// follows it. A row of a type the chart does not know makes no unit and takes
// no room (design §6: the frontend ignores what it does not know).

var KNOWN = {
    section: true, sung: true, bars: true, run: true, words: true,
    gap: true, notes: true, verbatim: true, empty: true
};

// An array as plain JS: a sheet handed through a QML `var` may arrive with
// its arrays as sequences, which Array.isArray does not recognise.
function list(x) {
    if (Array.isArray(x))
        return x;
    if (x !== null && x !== undefined && typeof x === "object" && typeof x.length === "number")
        return Array.prototype.slice.call(x);
    return null;
}

function known(row) {
    return row !== null && typeof row === "object" && KNOWN[row.type] === true;
}

// 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", 11 → "11th", 21 → "21st".
function ordinal(n) {
    var tens = n % 100;
    if (tens >= 11 && tens <= 13)
        return n + "th";
    switch (n % 10) {
    case 1: return n + "st";
    case 2: return n + "nd";
    case 3: return n + "rd";
    default: return n + "th";
    }
}

// One bars row → its rows of four (workflow 19 §A song, as amended): the
// line's own break starts a row; a measure that begins an ending
// (`marks.ending`) starts a row whose first place holds its ordinal label, so
// that row holds up to three bars; otherwise a row takes four. A row's
// `number` is the count of its first counted bar (cifra.md §2.8; the row's
// `numbers`), null when none is counted.
//
//   [{ label?, number, bars: [{ cells, marks }] }]
function reflowBars(row) {
    var out = [];
    var cur = null;
    var cells = list(row.cells) || [];
    var allMarks = list(row.marks);
    var numbers = list(row.numbers) || [];
    for (var i = 0; i < cells.length; ++i) {
        var marks = allMarks ? (allMarks[i] || null) : null;
        var ending = marks && marks.ending !== null && marks.ending !== undefined ? marks.ending : null;
        if (ending !== null) {
            cur = { label: ordinal(ending), number: null, bars: [] };
            out.push(cur);
        } else if (cur === null || cur.bars.length + (cur.label ? 1 : 0) >= 4) {
            cur = { number: null, bars: [] };
            out.push(cur);
        }
        var counted = numbers[i] && typeof numbers[i].number === "number" ? numbers[i].number : null;
        if (cur.number === null && counted !== null)
            cur.number = counted;
        cur.bars.push({ cells: list(cells[i]) || [], marks: marks });
    }
    return out;
}

function lines(text) {
    return String(text === undefined || text === null ? "" : text).split("\n");
}

function unit(kind, rows, pieces, keepWithNext) {
    return {
        kind: kind,
        rows: rows,
        keepWithNext: keepWithNext === true,
        breakable: pieces.length > 1,
        pieces: pieces
    };
}

// The keep-together units of `rows`, in order.
// With `opts.barNumbers` (the sheet's barNumbers: shown, on a counted song),
// every row of bars is `numbered` — it keeps a margin for the numbers, so the
// rows' bars line up — and carries its first counted bar's `number`.
function blocks(rows, opts) {
    var numbered = !!(opts && opts.barNumbers);
    var units = [];
    rows = list(rows);
    if (rows === null)
        return units;
    var i = 0;
    while (i < rows.length) {
        var row = rows[i];
        if (!known(row)) {
            i += 1;
            continue;
        }
        switch (row.type) {
        case "section":
            units.push(unit("section", [i], [{ kind: "section", row: i, name: String(row.name || ""),
                                                times: row.times || null }], true));
            i += 1;
            break;
        case "bars": {
            // A block: the maximal run of bars rows with the blank lines that
            // carry its grid (alignBars) — a row the chart does not know
            // inside it is passed over, so it changes nothing.
            var rowsIn = [];
            var pieces = [];
            var j = i;
            for (; j < rows.length; ++j) {
                var r = rows[j];
                if (!known(r))
                    continue;
                if (r.type === "bars") {
                    var reflowed = reflowBars(r);
                    for (var k = 0; k < reflowed.length; ++k)
                        pieces.push({ kind: "bars", row: j, label: reflowed[k].label || null,
                                      bars: reflowed[k].bars, numbered: numbered,
                                      number: numbered ? reflowed[k].number : null });
                    rowsIn.push(j);
                } else if (r.type === "gap" && r.grid) {
                    pieces.push({ kind: "gap", row: j });
                    rowsIn.push(j);
                } else {
                    break;
                }
            }
            units.push(unit("bars", rowsIn, pieces));
            i = j;
            break;
        }
        case "sung":
            units.push(unit("sung", [i], [{ kind: "sung", row: i,
                                             segments: list(row.segments) || [] }]));
            i += 1;
            break;
        case "run":
            units.push(unit("run", [i], [{ kind: "run", row: i,
                                            tokens: list(row.tokens) || [] }]));
            i += 1;
            break;
        case "words":
            units.push(unit("words", [i], [{ kind: "words", row: i, text: String(row.text || "") }]));
            i += 1;
            break;
        case "gap":
            units.push(unit("gap", [i], [{ kind: "gap", row: i }]));
            i += 1;
            break;
        case "notes": {
            var paragraphs = list(row.paragraphs) || [];
            var ps = [];
            for (var p = 0; p < paragraphs.length; ++p)
                ps.push({ kind: "paragraph", row: i, text: String(paragraphs[p]) });
            if (ps.length)
                units.push(unit("notes", [i], ps));
            i += 1;
            break;
        }
        case "verbatim": {
            var ls = lines(row.text);
            var vs = [];
            for (var l = 0; l < ls.length; ++l)
                vs.push({ kind: "verbatimLine", row: i, text: ls[l], last: l === ls.length - 1 });
            units.push(unit("verbatim", [i], vs));
            i += 1;
            break;
        }
        case "empty":
            units.push(unit("empty", [i], [{ kind: "empty", row: i }]));
            i += 1;
            break;
        }
    }
    return units;
}

// The chord keys a piece draws, in order, repeats kept (token.key, the
// engine's identity — the same value as the sheet's shapes[].chord).
function pieceChords(piece) {
    var keys = [];
    function add(token) {
        if (token && token.key !== undefined && token.key !== null)
            keys.push(token.key);
    }
    if (piece.kind === "sung") {
        for (var i = 0; i < piece.segments.length; ++i)
            add(piece.segments[i] && piece.segments[i].token);
    } else if (piece.kind === "run") {
        for (var j = 0; j < piece.tokens.length; ++j)
            add(piece.tokens[j] && piece.tokens[j].token);
    } else if (piece.kind === "bars") {
        for (var b = 0; b < piece.bars.length; ++b) {
            var cells = piece.bars[b].cells;
            for (var c = 0; c < cells.length; ++c)
                add(cells[c] && cells[c].token);
        }
    }
    return keys;
}
