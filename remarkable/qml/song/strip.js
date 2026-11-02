.pragma library
// The shapes strip's content, size and paging (reader.song_screen; workflow
// 19 §A song: shapes on every page, the strip's fixed height, the strip
// paging past sixteen, hiding). Pure: the sheet's `shapes` and SheetView's
// `pages[].chords` in, plain data out. It computes no music: a chord is known
// by its key, the sheet's `shapes[].chord`, and what is hidden comes in the
// sheet (design §3.3).
.import "../chart/metrics.js" as M

function list(x) {
    if (Array.isArray(x))
        return x;
    if (x !== null && x !== undefined && typeof x === "object" && typeof x.length === "number")
        return Array.prototype.slice.call(x);
    return [];
}

// A page's shapes: its chords, in the order they first appear on it, mapped
// to the sheet's shapes by chord, split into the shown (a pending one — no
// model — included, its place kept empty) and the hidden. A chord the sheet
// has no shape for takes no place.
function pageShapes(sheet, chords) {
    var byChord = {};
    var shapes = list(sheet && sheet.shapes);
    for (var i = 0; i < shapes.length; ++i)
        byChord[shapes[i].chord] = shapes[i];
    var shown = [];
    var hidden = [];
    var keys = list(chords);
    for (var k = 0; k < keys.length; ++k) {
        var shape = byChord[keys[k]];
        if (!shape)
            continue;
        if (shape.hidden === true)
            hidden.push(shape);
        else
            shown.push(shape);
    }
    return { shown: shown, hidden: hidden };
}

// The strip a page needing `n` shown shapes asks for (`anyHidden`: some page
// holds a hidden one): large, one row, up to five; compact, eight to a row,
// at most two rows, beyond; the head alone when nothing is shown but
// something is hidden; none at all otherwise.
function stripFor(n, anyHidden) {
    if (n <= 0) {
        if (anyHidden)
            return { size: "compact", rows: 0, height: M.stripHeight("compact", 0) };
        return { size: "none", rows: 0, height: 0 };
    }
    if (n <= M.stripLargeMax)
        return { size: "large", rows: 1, height: M.stripHeight("large", 1) };
    var rows = Math.min(M.stripMaxRows, Math.ceil(n / M.stripPerRow.compact));
    return { size: "compact", rows: rows, height: M.stripHeight("compact", rows) };
}

// How many shapes a strip holds before it pages; the largest strip holds any
// number, paging itself past sixteen.
function capacity(strip) {
    if (strip.size === "large")
        return M.stripLargeMax;
    if (strip.size === "compact" && strip.rows >= M.stripMaxRows)
        return Infinity;
    if (strip.size === "compact")
        return strip.rows * M.stripPerRow.compact;
    return 0;
}

// The busiest page of a pagination: the most shapes a page shows, and
// whether any page hides one.
function need(sheet, pages) {
    var n = 0;
    var anyHidden = false;
    var ps = list(pages);
    for (var p = 0; p < ps.length; ++p) {
        var s = pageShapes(sheet, ps[p].chords);
        n = Math.max(n, s.shown.length);
        if (s.hidden.length > 0)
            anyHidden = true;
    }
    return { shown: n, anyHidden: anyHidden };
}

// Whether `strip` holds what `wanted` (a stripFor answer) holds: as many
// shapes, and the head when it is wanted.
function holds(strip, wanted) {
    if (wanted.size === "none")
        return true;
    if (strip.size === "none")
        return false;
    return capacity(wanted) <= capacity(strip) || wanted.rows <= 0;
}

// The strip for the song, fixed by its busiest page (Decision 3): start at
// the most a strip can be (compact, two rows), paginate the chart in what is
// left, size the strip by that pagination's busiest page; if smaller,
// paginate again in the larger chart and keep the smaller strip only when the
// new busiest page still fits it, else the first. Two paginations at most.
// `pagesFor(height)` is SheetView's. → { size, rows, height, pages }.
function stripSize(pagesFor, sheet, contentHeight) {
    var most = stripFor(M.stripPerPage + 1, true);
    if (list(sheet && sheet.shapes).length === 0) {
        return { size: "none", rows: 0, height: 0, pages: pagesFor(contentHeight) };
    }
    var first = pagesFor(contentHeight - most.height);
    var n1 = need(sheet, first);
    var s1 = stripFor(n1.shown, n1.anyHidden);
    if (s1.height === most.height)
        return { size: most.size, rows: most.rows, height: most.height, pages: first };
    var second = pagesFor(contentHeight - s1.height);
    var n2 = need(sheet, second);
    var s2 = stripFor(n2.shown, n2.anyHidden);
    if (holds(s1, s2))
        return { size: s1.size, rows: s1.rows, height: s1.height, pages: second };
    return { size: most.size, rows: most.rows, height: most.height, pages: first };
}

// How the strip draws `n` diagrams (the page's shown ones, or its hidden ones
// after *Show hidden*): large when the strip is large and they fit, else
// compact in the strip's rows; a strip that is its head alone draws them in
// one or two compact rows over the chart's foot, the way the key grid opens.
// → { size, rows, perPage, height } — `height` from the foot up.
function drawn(strip, n) {
    if (strip.size === "large" && n <= M.stripLargeMax)
        return { size: "large", rows: 1, perPage: M.stripLargeMax, height: strip.height };
    var rows;
    if (strip.size === "large")
        rows = 1;
    else if (strip.rows > 0)
        rows = strip.rows;
    else
        rows = Math.min(M.stripMaxRows, Math.max(1, Math.ceil(n / M.stripPerRow.compact)));
    return {
        size: "compact",
        rows: rows,
        perPage: Math.min(M.stripPerPage, rows * M.stripPerRow.compact),
        height: Math.max(strip.height, M.stripHeight("compact", rows))
    };
}

// One page of the strip: `shown` paged by sixteen (or `perPage`), page `n`
// (clamped). → { shapes, page, pages, from, to, total, range } — `range`
// "1–16 of 24" when the strip pages, else "".
function stripPage(shown, n, perPage) {
    var all = list(shown);
    var per = perPage > 0 ? perPage : M.stripPerPage;
    var pages = Math.max(1, Math.ceil(all.length / per));
    var page = Math.max(0, Math.min(n || 0, pages - 1));
    var from = page * per;
    var to = Math.min(all.length, from + per);
    return {
        shapes: all.slice(from, to),
        page: page,
        pages: pages,
        from: from,
        to: to,
        total: all.length,
        range: pages > 1 ? (from + 1) + "–" + to + " of " + all.length : ""
    };
}
