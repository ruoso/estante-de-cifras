.pragma library
.import "../status.js" as Status
// The browse screens' arithmetic and copy (reader.browse_screens; workflow 19
// §Pairing, §The shelf, §A book, §A setlist). Presentation over what the
// backend sent, nothing more (design §3.3): the pages of a list, a title's
// letter, the letters' pages, and the words — in English, the reader's one
// locale (docs/remarkable-reader.md §3.1), kept here in one place.

// Ten rows to a page (workflow 19 §A book, §A setlist, §The shelf).
var perPage = 10;

// --- the copy ---

var copy = {
    appName: "Estante de Cifras",
    notPairedTitle: "Your songbooks, on this reMarkable.",
    notPairedText: "Pair it with your account to bring them here. It reads; it never changes your songs.",
    pair: "Pair with your account",
    pairTitle: "Pair this reMarkable",
    getNewCode: "Get a new code",
    expired: "That code has expired.",
    offline: "This reMarkable is not connected to Wi-Fi. Connect it in Settings and try again.",
    signedOutFromAccount: "This reMarkable was signed out from your account.",
    back: "Back",
    shelfTitle: "Estante",
    sync: "Sync",
    settings: "Settings",
    emptyShelf: "No books on your shelf yet. Books you add in Estante on your phone or computer come here.",
    untitledBook: "Untitled book",
    setlistsHeading: "Setlists",
    songsHeading: "Songs",
    emptyBook: "No songs in this book yet.",
    missing: "missing",
    play: "Play",
    account: "Account",
    syncHeading: "Sync",
    shapes: "Shapes",
    showAllAgain: "Show all again",
    thisReader: "This reader",
    updateReader: "Update the reader on your reMarkable",
    signOut: "Sign out",
    signOutQuestion: "Sign out of this reMarkable? Your books are removed from it; nothing changes in your account.",
    cancel: "Cancel",
    instrument: "Instrument",
    change: "Change",
    instrumentFromAccount: "As in your account",
    instrumentChosenHere: "Chosen on this reMarkable",
    chooseInstrument: "Read every song with",
    accountsInstrument: "your account's",
    variation: "Variation",
    chordNames: "Chord names",
    asWritten: "As written",
    asVoiced: "As voiced",
    nameAsVoiced: "Name as voiced",
    nameAsWritten: "Name as written",
    defaultVariation: "Default",
    close: "Close"
};

// The instrument part's note: whose choice the instrument read with is
// (workflow 19 §Settings).
function instrumentNote(chosen) {
    return chosen ? copy.instrumentChosenHere : copy.instrumentFromAccount;
}

// How the chart names its chords, in words: as written, or as the shapes
// shown sound them.
function chordNamesLine(names) {
    return names === "voiced" ? copy.asVoiced : copy.asWritten;
}

// The chord names button's words: the other naming.
function chordNamesSwitch(names) {
    return names === "voiced" ? copy.nameAsWritten : copy.nameAsVoiced;
}

// An instrument's name in the choice list, the account's own marked.
function instrumentLabel(instrument, accountId) {
    const name = String(instrument && instrument.name || "");
    return instrument && instrument.id === accountId ? name + " · " + copy.accountsInstrument : name;
}

// A variation's name: the song's block label, the unnamed one *Default* (as
// the web app words it).
function variationName(v) {
    return v === "" || v === null || v === undefined ? copy.defaultVariation : String(v);
}

// --- pages ---

// The pages a list of n rows takes: one at least, so an empty list still has
// its page (the foot says 1 of 1).
function pageCount(n) {
    return Math.max(1, Math.ceil(n / perPage));
}

// The page (from 0) holding row i.
function pageOf(i) {
    return Math.max(0, Math.floor(i / perPage));
}

// A page clamped to a list of n rows.
function clamp(page, n) {
    const last = pageCount(n) - 1;
    if (!(page >= 0))
        return 0;
    return Math.min(Math.floor(page), last);
}

// --- a book ---

// A file's name without its folder and its .cifra.md.
function fileName(path) {
    const base = String(path || "").split("/").pop();
    return base.replace(/\.cifra\.md$/, "");
}

// A song's title as its row says it: its own, else its file name.
function songTitle(song) {
    if (song && song.title)
        return song.title;
    return fileName(song ? song.path : "");
}

// A title's letter: its first character without its accent, A–Z; "" for a
// title that starts with a digit or a sign (workflow 19 §A book).
function letterOf(title) {
    const first = String(title || "").trim().charAt(0);
    if (first === "")
        return "";
    const bare = first.normalize("NFD").charAt(0).toUpperCase();
    return /^[A-Z]$/.test(bare) ? bare : "";
}

// A song's letter: its title's, or its file name's when the title is "".
function songLetter(song) {
    return letterOf(songTitle(song));
}

var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// The letters' pages over a book's rows (setlists, then songs): for each
// letter that starts a song, the page of the first song with it, in the
// book's order; an absent letter is absent.
function letterPages(book) {
    const setlists = list(book && book.setlists);
    const songs = list(book && book.songs);
    const out = {};
    for (let i = 0; i < songs.length; ++i) {
        const l = songLetter(songs[i]);
        if (l !== "" && !(l in out))
            out[l] = pageOf(setlists.length + i);
    }
    return out;
}

// A book's rows: its setlists, then its songs, each with what its row says
// and, the first of each kind, its heading.
function bookRows(book) {
    const setlists = list(book && book.setlists);
    const songs = list(book && book.songs);
    const rows = [];
    for (let i = 0; i < setlists.length; ++i) {
        const s = setlists[i];
        rows.push({ kind: "setlist", path: s.path, title: s.title || fileName(s.path),
                    detail: "", right: songCount(s.songs),
                    heading: i === 0 ? copy.setlistsHeading : "" });
    }
    for (let i = 0; i < songs.length; ++i) {
        const s = songs[i];
        rows.push({ kind: "song", path: s.path, title: songTitle(s), detail: s.artist || "",
                    right: "", heading: i === 0 ? copy.songsHeading : "" });
    }
    return rows;
}

// The rows of one page, each with its y in the content and its heading's.
function pageRows(rows, page, rowHeight, headingHeight) {
    const out = [];
    let y = 0;
    const from = page * perPage;
    for (let i = from; i < Math.min(rows.length, from + perPage); ++i) {
        const r = Object.assign({ index: i }, rows[i]);
        if (r.heading) {
            r.headingY = y;
            y += headingHeight;
        }
        r.y = y;
        y += rowHeight;
        out.push(r);
    }
    return out;
}

// --- counts ---

function plural(n, one, many) {
    return n + " " + (n === 1 ? one : many);
}

// "12 songs", "1 song".
function songCount(n) {
    return plural(Number(n) || 0, "song", "songs");
}

// A shelf row's second line: "32 songs · 4 setlists", "1 song · 1 setlist",
// "12 songs" — no setlists, none said (workflow 19 §The shelf).
function countLine(songs, setlists) {
    const s = songCount(songs);
    const n = Number(setlists) || 0;
    return n > 0 ? s + " · " + plural(n, "setlist", "setlists") : s;
}

// A book's name as the screens say it.
function bookTitle(title) {
    return title ? title : copy.untitledBook;
}

// --- a setlist ---

// A setlist's line: "Banda do Bairro · 6 songs"; its count alone when the
// book is not known.
function setlistLine(bookName, items) {
    const count = songCount(items);
    return bookName ? bookName + " · " + count : count;
}

// What an item's row says at its right: *missing*, else the key the setlist
// sets (*in D*), else nothing (workflow 19 §A setlist).
function itemRight(item) {
    if (item && item.missing)
        return copy.missing;
    if (item && item.key)
        return "in " + item.key;
    return "";
}

// --- playing a setlist (reader.play) ---
//
// The place in a setlist is an item's row index `at` in the `106`'s items
// (design §6 `play.at`), so the same song twice is two places; a row that is
// `missing` (a song the book lacks, an unlinked item) is never played
// (cifra.md §10.8.2).

// Whether a row can be played.
function playable(item) {
    return !!item && item.missing !== true && typeof item.path === "string" && item.path !== "";
}

// The first playable row's index, −1 for none.
function firstPlayable(items) {
    return nextPlayable(items, -1);
}

// The nearest playable row after `at`, −1 for none.
function nextPlayable(items, at) {
    const rows = list(items);
    for (let i = Math.max(-1, Math.floor(at)) + 1; i < rows.length; ++i)
        if (playable(rows[i]))
            return i;
    return -1;
}

// The nearest playable row before `at`, −1 for none.
function previousPlayable(items, at) {
    const rows = list(items);
    for (let i = Math.min(rows.length, Math.floor(at)) - 1; i >= 0; --i)
        if (playable(rows[i]))
            return i;
    return -1;
}

// The place's position among the playable rows: how many are playable up to
// and including `at` (the *3* of *3 of 12*); 0 when `at` is not playable.
function position(items, at) {
    const rows = list(items);
    if (!playable(rows[at]))
        return 0;
    let n = 0;
    for (let i = 0; i <= at; ++i)
        if (playable(rows[i]))
            n += 1;
    return n;
}

// The played song's bar title: "3 of 12 · Garota" (workflow 19 §A setlist).
function playTitle(n, of, title) {
    return n + " of " + of + " · " + (title || "");
}

// The last page's line for the next item: "Next: Asa Branca, in G", or
// "Next: Asa Branca" when the setlist sets it no key.
function nextLine(next) {
    if (!next)
        return "";
    const title = next.title || "";
    return next.key ? "Next: " + title + ", in " + next.key : "Next: " + title;
}

// The setlist's key as a note, when it cannot be applied (cifra.md §10.7.1).
function keyNoteLine(keyNote) {
    return keyNote ? "key: " + keyNote : "";
}

// --- settings ---

// The account by its home book's authorName, *your account* until it has one
// (reader.pairing; device_pairing Decision 10).
function pairedWith(account) {
    return "Paired with " + (account || "your account");
}

// The Shapes line (workflow 19 §The shelf, Settings).
function hiddenLine(n) {
    n = Number(n) || 0;
    if (n <= 0)
        return "No shapes hidden.";
    if (n === 1)
        return "1 shape hidden — the one you know";
    return n + " shapes hidden — the ones you know";
}

function versionLine(version) {
    return "Version " + (version || "");
}

// This reader's second line: the site serves screens and music code this
// reader's program is too old to run (reader.self_update; design §8). One
// bit: a sentence, or nothing.
function updateLine(updateReader) {
    return updateReader === true ? copy.updateReader : "";
}

// --- pairing ---

// The address a code is entered at, from the backend's url: no scheme, no
// trailing slash.
function address(url) {
    return String(url || "").replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/+$/, "");
}

// "This code works until 14:42." — device local, 24-hour (rule 2).
function worksUntil(expiresAt) {
    const at = Status.hhmm(expiresAt);
    return at !== "" ? "This code works until " + at + "." : "";
}

// --- helpers ---

// An array, or an array-like (a QVariantList a property handed over), as an
// array; anything else as [].
function list(x) {
    if (Array.isArray(x))
        return x;
    if (x !== null && x !== undefined && typeof x === "object" && typeof x.length === "number")
        return Array.prototype.slice.call(x);
    return [];
}
