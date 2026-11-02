.pragma library
// What a new `105 sheet` changes on the song screen (reader.song_screen
// Decision 8). A sheet is a whole song read again, so the screen tells a new
// layout from a re-voicing: a different book, path or offset, or different
// rows, is "new" (laid out from its first page); the same song at the same
// offset with the same rows — the answer to `7 hideShape` or `8 showShape` —
// is "revoiced": the chart and its page are kept and only the strip is
// worked out again.

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
