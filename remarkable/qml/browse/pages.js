.pragma library
.import "../status.js" as Status
// The browse screens' arithmetic and copy (reader.browse_screens; workflow 19
// §Pairing, §The shelf, §A book, §A setlist). Presentation over what the
// backend sent, nothing more (design §3.3): the pages of a list, a title's
// letter, the letters' pages, and the words — in English, the reader's one
// locale (docs/remarkable-reader.md §3.1), kept here in one place.

// A list's pages are as many rows as its content's height holds (workflow 19
// §A book, §A setlist, §The shelf): `pages` is each page's first row, from
// heightPages or evenPages. Without one, ten rows to a page — the rM2's
// shelf and setlist, whose rows are 150 px under a 96 px line.
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
    byTitle: "By title",
    byAuthor: "By author",
    noAuthor: "No author",
    emptyBook: "No songs in this book yet.",
    missing: "missing",
    play: "Play",
    account: "Account",
    syncHeading: "Sync",
    shapes: "Shapes",
    showAllAgain: "Show all again",
    thisReader: "This reader",
    updateReader: "A new version is ready: it starts the next time Estante opens",
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
    textSize: "Text size",
    barNumbers: "Bar numbers",
    barNumbersShown: "Shown",
    barNumbersHidden: "Hidden",
    showBarNumbers: "Show",
    hideBarNumbers: "Hide",
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

// Whether the chart shows bar numbers, in words.
function barNumbersLine(numbers) {
    return numbers === "shown" ? copy.barNumbersShown : copy.barNumbersHidden;
}

// The bar numbers button's words: the other choice.
function barNumbersSwitch(numbers) {
    return numbers === "shown" ? copy.hideBarNumbers : copy.showBarNumbers;
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

// The pages of rows of one height in `height`: each page's first row. One
// page at least, so an empty list still has its page.
function evenPages(n, height, rowHeight) {
    const per = Math.max(1, Math.floor(height / rowHeight));
    const out = [0];
    for (let i = per; i < n; i += per)
        out.push(i);
    return out;
}

// The pages of a list whose rows may carry a heading (`heading`, drawn above
// its row): as many as fit `height`, a heading never left at a page's foot.
function heightPages(rows, height, rowHeight, headingHeight) {
    const out = [0];
    let used = 0;
    for (let i = 0; i < rows.length; ++i) {
        let need = rowHeight + (headed(rows[i], used === 0) ? headingHeight : 0);
        if (used > 0 && used + need > height) {
            out.push(i);
            used = 0;
            need = rowHeight + (headed(rows[i], true) ? headingHeight : 0);
        }
        used += need;
    }
    return out;
}

// Whether a row has a heading over it: its own, or, first on its page, its
// group's again — an author's songs that run over a page are named again at
// the top of the next.
function headed(row, first) {
    return !!row && (!!row.heading || (first && !!row.group));
}

// The pages a list of n rows takes: one at least, so an empty list still has
// its page (the foot says 1 of 1).
function pageCount(n, pages) {
    if (pages)
        return Math.max(1, pages.length);
    return Math.max(1, Math.ceil(n / perPage));
}

// The page (from 0) holding row i.
function pageOf(i, pages) {
    if (pages) {
        let found = 0;
        for (let p = 0; p < pages.length; ++p)
            if (pages[p] <= i)
                found = p;
        return found;
    }
    return Math.max(0, Math.floor(i / perPage));
}

// Page p's rows: { from, to }, `to` past its last.
function pageRange(p, n, pages) {
    if (pages) {
        const from = pages[p] !== undefined ? pages[p] : n;
        const to = pages[p + 1] !== undefined ? pages[p + 1] : n;
        return { from: from, to: to };
    }
    return { from: p * perPage, to: Math.min(n, (p + 1) * perPage) };
}

// A page clamped to a list of n rows.
function clamp(page, n, pages) {
    const last = pageCount(n, pages) - 1;
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

// The letters' pages over a book's rows (bookRows): for each letter that
// starts a song's title — or, in the index by author, an author's name — the
// page of the first row with it; an absent letter is absent.
function letterPages(rows, pages) {
    const out = {};
    for (let i = 0; i < rows.length; ++i) {
        const l = rows[i].letter || "";
        if (l !== "" && !(l in out))
            out[l] = pageOf(i, pages);
    }
    return out;
}

// --- a book's two indexes (books.print_authors, as the printed book has) ---

// A name as it is compared: without its accents, in lower case.
function bare(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Two names in alphabetical order, accents and case aside, a number by its
// value (*2 Pássaros* before *10 Rosas*), as the web app's Intl.Collator
// ({ sensitivity: "base", numeric: true }) sorts them for the print.
function collate(a, b) {
    const x = bare(a).match(/\d+|\D+/g) || [];
    const y = bare(b).match(/\d+|\D+/g) || [];
    for (let i = 0; i < Math.min(x.length, y.length); ++i) {
        const nx = /^\d/.test(x[i]), ny = /^\d/.test(y[i]);
        if (nx && ny) {
            const d = Number(x[i]) - Number(y[i]);
            if (d !== 0)
                return d < 0 ? -1 : 1;
        } else if (x[i] !== y[i]) {
            return x[i] < y[i] ? -1 : 1;
        }
    }
    return x.length - y.length;
}

// Two strings by code point, the last word on a tie.
function exact(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}

// The authors a song's artist names: split on /, , and ;, each trimmed —
// not on *e*, *and* or *&*, which as often join a duo that is one name
// (book-print.js splitArtists).
function splitArtists(artist) {
    return String(artist || "").split(/[\/,;]/).map(n => n.trim()).filter(n => n !== "");
}

// Two songs by the title they show, then by path.
function byTitle(a, b) {
    return collate(songTitle(a), songTitle(b)) || exact(songTitle(a), songTitle(b)) || exact(a.path, b.path);
}

// A book's songs by title.
function songsByTitle(songs) {
    return list(songs).slice().sort(byTitle);
}

// A book's songs by author: [{ author, songs }], the authors in alphabetical
// order, each one's songs by title, a song with several authors under each,
// and the songs that name none last (author null) — as the printed book's
// index by artist (book-print.js songsByArtist).
function songsByAuthor(songs) {
    const groups = [];
    let none = null;
    for (const song of list(songs)) {
        const authors = splitArtists(song.artist);
        if (authors.length === 0) {
            if (none === null)
                none = { author: null, songs: [] };
            none.songs.push(song);
            continue;
        }
        for (const author of authors) {
            let g = groups.find(x => collate(x.author, author) === 0);
            if (!g) {
                g = { author: author, songs: [] };
                groups.push(g);
            }
            if (g.songs.indexOf(song) < 0)
                g.songs.push(song);
        }
    }
    groups.sort((a, b) => collate(a.author, b.author) || exact(a.author, b.author));
    if (none !== null)
        groups.push(none);
    for (const g of groups)
        g.songs.sort(byTitle);
    return groups;
}

// A book's rows in one of its indexes, "title" (the default) or "author":
// its setlists, then its songs — by title, each title over its artist, under
// *Songs*; or by author, under each author's name, a song's artist under its
// title only when it names others too. Each row with what it says, the
// heading over it (the first of each kind, or of each author), its group (the
// author it is listed under) and the letter it starts.
function bookRows(book, index) {
    const setlists = list(book && book.setlists);
    const songs = list(book && book.songs);
    const rows = [];
    for (let i = 0; i < setlists.length; ++i) {
        const s = setlists[i];
        rows.push({ kind: "setlist", path: s.path, title: s.title || fileName(s.path),
                    detail: "", right: songCount(s.songs),
                    heading: i === 0 ? copy.setlistsHeading : "", group: "", letter: "" });
    }
    if (index === "author") {
        for (const g of songsByAuthor(songs)) {
            const name = g.author === null ? copy.noAuthor : g.author;
            for (let i = 0; i < g.songs.length; ++i) {
                const s = g.songs[i];
                rows.push({ kind: "song", path: s.path, title: songTitle(s),
                            detail: splitArtists(s.artist).length > 1 ? s.artist : "",
                            right: "", heading: i === 0 ? name : "", group: name,
                            letter: i === 0 && g.author !== null ? letterOf(g.author) : "" });
            }
        }
        return rows;
    }
    const sorted = songsByTitle(songs);
    for (let i = 0; i < sorted.length; ++i) {
        const s = sorted[i];
        rows.push({ kind: "song", path: s.path, title: songTitle(s), detail: s.artist || "",
                    right: "", heading: i === 0 ? copy.songsHeading : "", group: "",
                    letter: songLetter(s) });
    }
    return rows;
}

// The rows of one page, each with its y in the content and its heading's.
function pageRows(rows, page, rowHeight, headingHeight, pages) {
    const out = [];
    let y = 0;
    const range = pageRange(page, rows.length, pages);
    for (let i = range.from; i < range.to; ++i) {
        const r = Object.assign({ index: i }, rows[i]);
        if (i === range.from && !r.heading && r.group)
            r.heading = r.group;
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
