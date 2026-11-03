// unit — the browse screens' arithmetic and copy (reader.browse_screens):
// browse/pages.js. Ten rows to a page (workflow 19 §A book, §A setlist); a
// title's letter, accent stripped, none for a digit or a sign, the file
// name's for an untitled song (§A book as amended); the letters' pages over
// setlists and songs (§A book, rule 8); the shelf row's counts and Untitled
// book (§The shelf as amended); the Shapes line (§The shelf, Settings, as
// amended); the pairing page's address and time (§Pairing).
import QtQuick
import QtTest
import "../browse/pages.js" as Pages
import "fixtures/browse-book.js" as BrowseBook

TestCase {
    name: "BrowsePages"

    // "Ten rows to a page": 0, 1, 10, 11 and 34 rows.
    function test_pageCount_data() {
        return [
            { tag: "0", n: 0, pages: 1 },
            { tag: "1", n: 1, pages: 1 },
            { tag: "10", n: 10, pages: 1 },
            { tag: "11", n: 11, pages: 2 },
            { tag: "34", n: 34, pages: 4 }
        ];
    }

    function test_pageCount(data) {
        compare(Pages.pageCount(data.n), data.pages);
    }

    // The page holding an item.
    function test_pageOf() {
        compare(Pages.pageOf(0), 0);
        compare(Pages.pageOf(9), 0);
        compare(Pages.pageOf(10), 1);
        compare(Pages.pageOf(33), 3);
    }

    // A page kept, clamped to the list's pages (Back to a book that shrank).
    function test_clamp() {
        compare(Pages.clamp(2, 34), 2);
        compare(Pages.clamp(5, 34), 3);
        compare(Pages.clamp(-1, 34), 0);
        compare(Pages.clamp(3, 0), 0);
        compare(Pages.clamp(undefined, 12), 0);
    }

    // §A book as amended: the title's first letter without its accent.
    function test_letter_data() {
        return [
            { tag: "Ária", title: "Ária", letter: "A" },
            { tag: "Ção", title: "Ção", letter: "C" },
            { tag: "zé", title: "zé", letter: "Z" },
            { tag: "Óculos", title: "Óculos do Avô", letter: "O" },
            { tag: "7 Cordas", title: "7 Cordas", letter: "" },
            { tag: "(Intro)", title: "(Intro)", letter: "" },
            { tag: "empty", title: "", letter: "" }
        ];
    }

    function test_letter(data) {
        compare(Pages.letterOf(data.title), data.letter);
    }

    // An untitled song: its file name's letter, and its file name as title.
    function test_untitledSongUsesItsFileName() {
        const song = { path: "trem-das-seis.cifra.md", title: "", artist: "" };
        compare(Pages.songTitle(song), "trem-das-seis");
        compare(Pages.songLetter(song), "T");
        compare(Pages.songLetter({ path: "folder/ária.cifra.md", title: "" }), "A");
    }

    // §A book, rule 8: each letter goes to the page of its first song in the
    // book's order, the setlists counted before the songs; absent letters are
    // absent.
    function test_letterPages() {
        const book = {
            setlists: [{ path: "a.setlist.md", title: "A", songs: 1 },
                       { path: "b.setlist.md", title: "B", songs: 1 },
                       { path: "c.setlist.md", title: "C", songs: 1 }],
            songs: []
        };
        const titles = ["7 Cordas", "Ária", "Asa", "Balanço", "Barco", "Canção", "Chuva",
                        "Domingo", "Eco", "Estrada", "Feira"];
        for (const t of titles)
            book.songs.push({ path: t + ".cifra.md", title: t, artist: "" });
        const pages = Pages.letterPages(book);
        // Ária is row 4 (3 setlists, then 7 Cordas): page 0; Domingo row 10.
        compare(pages, { A: 0, B: 0, C: 0, D: 1, E: 1, F: 1 });
        verify(!("H" in pages));
    }

    // The fixture book: its letters, each to its first song's page.
    function test_letterPagesOfTheFixture() {
        const pages = Pages.letterPages(BrowseBook.book);
        compare(pages, {
            A: 0, B: 0, C: 0, D: 1, E: 1, F: 1, G: 1, I: 1, J: 1, L: 1,
            M: 2, N: 2, O: 2, P: 2, Q: 2, R: 2, S: 2,
            T: 3, U: 3, V: 3, X: 3, Z: 3
        });
    }

    // A book's rows: setlists first, then songs, a heading on the first of
    // each kind; a page's rows placed under the headings that fall on it.
    function test_bookRowsAndPages() {
        const rows = Pages.bookRows(BrowseBook.book);
        compare(rows.length, 37);
        compare(rows[0].kind, "setlist");
        compare(rows[0].heading, "Setlists");
        compare(rows[0].right, "14 songs");
        compare(rows[1].heading, "");
        compare(rows[3].kind, "song");
        compare(rows[3].heading, "Songs");
        const first = Pages.pageRows(rows, 0, 120, 72);
        compare(first.length, 10);
        compare(first[0].headingY, 0);
        compare(first[0].y, 72);
        compare(first[3].headingY, 72 + 3 * 120);
        compare(first[3].y, 2 * 72 + 3 * 120);
        compare(first[9].y + 120, 2 * 72 + 10 * 120);
        const last = Pages.pageRows(rows, 3, 120, 72);
        compare(last.length, 7);
        compare(last[0].index, 30);
        compare(last[0].y, 0);
    }

    // §The shelf as amended: the row's count line.
    function test_countLine() {
        compare(Pages.countLine(32, 4), "32 songs · 4 setlists");
        compare(Pages.countLine(1, 1), "1 song · 1 setlist");
        compare(Pages.countLine(12, 0), "12 songs");
        compare(Pages.countLine(0, 0), "0 songs");
        compare(Pages.songCount(1), "1 song");
    }

    function test_untitledBook() {
        compare(Pages.bookTitle(""), "Untitled book");
        compare(Pages.bookTitle("Banda do Bairro"), "Banda do Bairro");
    }

    // §The shelf, Settings, as amended: the Shapes line.
    function test_hiddenLine() {
        compare(Pages.hiddenLine(0), "No shapes hidden.");
        compare(Pages.hiddenLine(1), "1 shape hidden — the one you know");
        compare(Pages.hiddenLine(11), "11 shapes hidden — the ones you know");
    }

    // §A setlist as amended: the key the setlist sets, *missing*, or none.
    function test_itemRight() {
        compare(Pages.itemRight({ key: "D", missing: false }), "in D");
        compare(Pages.itemRight({ key: null, missing: false }), "");
        compare(Pages.itemRight({ key: "E", missing: true }), "missing");
        compare(Pages.setlistLine("Banda do Bairro", 6), "Banda do Bairro · 6 songs");
        compare(Pages.setlistLine("", 1), "1 song");
    }

    // §Pairing: the address without its scheme; the end as a local time.
    function test_pairingCopy() {
        compare(Pages.address("https://estantedecifras.app/pair"), "estantedecifras.app/pair");
        compare(Pages.address("https://www.estantedecifras.app/pair"), "www.estantedecifras.app/pair");
        compare(Pages.address("https://example.test/pair/"), "example.test/pair");
        const t = new Date(2026, 9, 30, 14, 42, 0).toISOString();
        compare(Pages.worksUntil(t), "This code works until 14:42.");
        compare(Pages.worksUntil("not a time"), "");
    }
}
