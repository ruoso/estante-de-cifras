.pragma library
.import "../browse/pages.js" as Pages
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

// --- a song played from a setlist (reader.play; workflow 19 §A setlist) ---
//
// The place and the neighbours come from the `106` Play started from, held by
// the setlist screen (reader.play Decision 7): its rows, by `play.at`.

// The setlist rows a played sheet is played from: the held `106`'s items when
// it is the same book's same setlist, else null.
function playItems(sheet, setlist) {
    if (!sheet || !sheet.play || !setlist)
        return null;
    if (setlist.bookId !== sheet.bookId || setlist.path !== sheet.play.setlist)
        return null;
    const items = list(setlist.items);
    return items.length > 0 || Array.isArray(setlist.items) ? items : null;
}

// A played sheet's place — { at, n, of, next, previous, note }: its row, its
// position among the playable rows, how many, the next and the previous
// playable rows (−1 for none), and the item's own note — or null for a sheet
// not played. Without the held rows the position is unknown (0), and only
// the sheet's own `play.next` says a song follows.
function place(sheet, setlist) {
    if (!sheet || !sheet.play || typeof sheet.play.at !== "number")
        return null;
    const at = sheet.play.at;
    const items = playItems(sheet, setlist);
    if (items === null)
        return { at: at, n: 0, of: sheet.play.of, next: -1, previous: -1, note: "",
                 after: !!sheet.play.next, before: false };
    const next = Pages.nextPlayable(items, at);
    const previous = Pages.previousPlayable(items, at);
    return { at: at, n: Pages.position(items, at), of: sheet.play.of, next: next, previous: previous,
             note: (items[at] && items[at].note) || "", after: next >= 0, before: previous >= 0 };
}

// The bar's title: *3 of 12 · Garota* when played, else the song's title.
function barTitle(sheet, place) {
    const title = (sheet && sheet.title) || "";
    return place && place.n > 0 ? Pages.playTitle(place.n, place.of, title) : title;
}

// An array, or an array-like (a QVariantList a property handed over), as an
// array; anything else as [].
function list(x) {
    if (Array.isArray(x))
        return x;
    if (x !== null && x !== undefined && typeof x === "object" && typeof x.length === "number")
        return Array.prototype.slice.call(x);
    return [];
}

function texts(xs) {
    return list(xs).filter(n => typeof n === "string" && n !== "");
}

// The sheet the chart lays out: its rows, and as notes rows — paginated with
// them — the shapes' notes after the last (workflow 19 §A song as amended);
// played, the item's own note and *key: D* (the setlist's key when it cannot
// be applied, cifra.md §10.7.1) before the first, and *Next: Asa Branca, in
// G* with the next item's note after everything (workflow 19 §A setlist).
function chartSheet(sheet, place) {
    let rows = list(sheet.rows);
    let changed = false;
    if (place) {
        const first = texts([place.note, Pages.keyNoteLine(sheet.keyNote)]);
        if (first.length > 0) {
            rows = [{ type: "notes", paragraphs: first }].concat(rows);
            changed = true;
        }
    }
    const notes = texts(sheet.notes);
    if (notes.length > 0) {
        rows = rows.concat([{ type: "notes", paragraphs: notes }]);
        changed = true;
    }
    const next = place && sheet.play ? sheet.play.next : null;
    if (next) {
        rows = rows.concat([{ type: "notes", paragraphs: texts([Pages.nextLine(next), next.note]) }]);
        changed = true;
    }
    return changed ? Object.assign({}, sheet, { rows: rows }) : sheet;
}
