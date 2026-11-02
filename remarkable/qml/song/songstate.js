.pragma library
// What a new `105 sheet` changes on the song screen (reader.song_screen
// Decision 8). A sheet is a whole song read again, so the screen tells a new
// layout from a re-voicing: a different book, path or offset, or different
// rows, is "new" (laid out from its first page); the same song at the same
// offset with the same rows — the answer to `7 hideShape` or `8 showShape` —
// is "revoiced": the chart and its page are kept and only the strip is
// worked out again.
//
// A `108 shapes` (reader.missed_shapes; design §4.1, §6) is neither: it fills
// the empty places of the sheet held, for the pages still to be drawn, and
// redraws nothing (workflow 19 rule 5) — `merge`.

function sameRows(a, b) {
    if (a === b)
        return true;
    return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
}

// change(shown, received) → "new" | "revoiced"; "new" when nothing is shown.
function change(shown, received) {
    if (!shown || !received)
        return "new";
    if (shown.bookId !== received.bookId || shown.path !== received.path || shown.offset !== received.offset)
        return "new";
    if (!sameRows(shown.rows, received.rows))
        return "new";
    return "revoiced";
}

function isEmpty(shape) {
    return !shape || shape.model === null || shape.model === undefined;
}

// merge(shown, found) → the sheet held with each empty place whose chord
// arrives with a model filled (its frets, model and hidden), or null when the
// `108` is for another song, key or tuning, or fills nothing. A place that
// arrives still empty, or not at all (no shape found), stays empty; a place
// already drawn is never changed. Nothing else of the sheet changes, so the
// strip's size and the pages stay as they were laid out.
function merge(shown, found) {
    if (!shown || !found)
        return null;
    if (shown.bookId !== found.bookId || shown.path !== found.path || shown.offset !== found.offset
            || shown.tuningId !== found.tuningId)
        return null;
    const arrived = {};
    const incoming = Array.isArray(found.shapes) ? found.shapes : [];
    for (let i = 0; i < incoming.length; ++i) {
        const s = incoming[i];
        if (s && typeof s.chord === "string" && !isEmpty(s))
            arrived[s.chord] = s;
    }
    const shapes = Array.isArray(shown.shapes) ? shown.shapes : [];
    let filled = false;
    const merged = shapes.map(s => {
        if (!isEmpty(s) || !arrived[s.chord])
            return s;
        const f = arrived[s.chord];
        filled = true;
        return Object.assign({}, s, { frets: f.frets, model: f.model, hidden: f.hidden === true });
    });
    if (!filled)
        return null;
    return Object.assign({}, shown, { shapes: merged });
}
