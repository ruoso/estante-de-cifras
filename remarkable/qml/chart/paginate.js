.pragma library
// Blocks + heights → pages (reader.qml_chart; workflow 19 §A song, as
// amended, which adapts books.print's rule: print-columns.js, reading.css).
// Pure: it takes units already measured and answers where each goes.
//
// A unit is { kind, keepWithNext, breakable, height, breakHeights? }:
// `height` is the whole unit's, and a breakable unit's `breakHeights` are its
// pieces' heights, in order — it may break only between two of them.
//
// The answer is pages of columns of slices, `{ unit, from, to, height }`
// (pieces [from, to) of the unit), and `dropped: true` on a gap that would
// have started a column. The rules:
//   - a column is filled to its foot before the next begins (column-fill: auto);
//   - a unit that does not fit what is left of a column starts the next one,
//     whole, when it fits a column;
//   - only a breakable unit taller than a whole column breaks, between its
//     pieces, filling each column it runs into;
//   - a section name never ends a column: it goes to the next with what
//     follows it (break-after: avoid);
//   - a gap at a column's top is dropped;
//   - a unit taller than a column with nowhere to break is placed alone and
//     overruns its column's foot; there is no smaller place for it.
function paginate(units, columnHeight, columns) {
    var H = columnHeight;
    var ncol = columns === 2 ? 2 : 1;
    var pages = [];
    var page = null;
    var col = null;
    var used = 0;

    function newColumn() {
        if (page === null || page.columns.length >= ncol) {
            page = { columns: [] };
            pages.push(page);
        }
        col = [];
        page.columns.push(col);
        used = 0;
    }

    function parts(u) {
        if (u.breakable && Array.isArray(u.breakHeights) && u.breakHeights.length > 0)
            return u.breakHeights;
        return [u.height];
    }

    // What must fit beside a section for it not to end a column: the next
    // unit whole, or its first piece when it is one that will break anyway.
    function lead(u) {
        if (!u)
            return 0;
        if (u.breakable && u.height > H)
            return parts(u)[0];
        return u.height;
    }

    function place(i, from, to, h) {
        col.push({ unit: i, from: from, to: to, height: h });
        used += h;
    }

    newColumn();
    for (var i = 0; i < units.length; ++i) {
        var u = units[i];
        var ps = parts(u);
        var n = ps.length;
        if (u.kind === "gap" && (used === 0 || used + u.height > H)) {
            if (used > 0)
                newColumn();
            col.push({ unit: i, from: 0, to: n, height: 0, dropped: true });
            continue;
        }
        if (u.keepWithNext) {
            if (used > 0 && used + u.height + lead(units[i + 1]) > H)
                newColumn();
            place(i, 0, n, u.height);
            continue;
        }
        if (used + u.height <= H) {
            place(i, 0, n, u.height);
            continue;
        }
        if (!u.breakable || n < 2 || u.height <= H) {
            if (used > 0)
                newColumn();
            place(i, 0, n, u.height);
            continue;
        }
        var k = 0;
        while (k < n) {
            var start = k;
            var h = 0;
            while (k < n && (used + h + ps[k] <= H || (used === 0 && k === start))) {
                h += ps[k];
                k += 1;
            }
            if (k === start) {
                newColumn();
                continue;
            }
            place(i, start, k, h);
            if (k < n)
                newColumn();
        }
    }

    // A song with nothing to draw has no pages.
    var drawn = false;
    for (var p = 0; p < pages.length && !drawn; ++p) {
        for (var c = 0; c < pages[p].columns.length && !drawn; ++c) {
            var slices = pages[p].columns[c];
            for (var s = 0; s < slices.length; ++s) {
                if (!slices[s].dropped) {
                    drawn = true;
                    break;
                }
            }
        }
    }
    return drawn ? pages : [];
}
