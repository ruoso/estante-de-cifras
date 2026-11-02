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
    account: "Account",
    syncHeading: "Sync",
    shapes: "Shapes",
    showAllAgain: "Show all again",
    thisReader: "This reader",
    signOut: "Sign out",
    signOutQuestion: "Sign out of this reMarkable? Your books are removed from it; nothing changes in your account.",
    cancel: "Cancel"
};

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

// --- settings ---

function pairedWith(account) {
    return "Paired with " + (account || "");
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

function list(x) {
    return Array.isArray(x) ? x : [];
}
