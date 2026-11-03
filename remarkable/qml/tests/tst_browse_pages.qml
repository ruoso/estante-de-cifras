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
        const pages = Pages.letterPages(Pages.bookRows(book));
        // Ária is row 4 (3 setlists, then 7 Cordas): page 0; Domingo row 10.
        compare(pages, { A: 0, B: 0, C: 0, D: 1, E: 1, F: 1 });
        verify(!("H" in pages));
    }

    // The fixture book: its letters, each to its first song's page.
    function test_letterPagesOfTheFixture() {
        const pages = Pages.letterPages(Pages.bookRows(BrowseBook.book));
        compare(pages, {
            A: 0, B: 0, C: 0, D: 1, E: 1, F: 1, G: 1, I: 1, J: 1, L: 1,
            M: 2, N: 2, O: 2, P: 2, Q: 2, R: 2, S: 2,
            T: 3, U: 3, V: 3, X: 3, Z: 3
        });
    }

    // The two indexes compare as the print's Intl.Collator does: accents and
    // case aside, a number by its value.
    function test_collate() {
        verify(Pages.collate("Ária", "asa") < 0);
        compare(Pages.collate("ÁRIA", "aria"), 0);
        verify(Pages.collate("2 Pássaros", "10 Rosas") < 0);
        verify(Pages.collate("Canção", "Cancioneiro") < 0);
        verify(Pages.collate("Zé", "Zeca") < 0);
    }

    // The authors an artist names, split as the print splits them (on /, ,
    // and ;), never on *e*, *and* or *&*.
    function test_splitArtists() {
        compare(Pages.splitArtists("Pixinguinha / Benedito Lacerda"), ["Pixinguinha", "Benedito Lacerda"]);
        compare(Pages.splitArtists("Pixinguinha, João de Barros; Alberto Ribeiro"),
                ["Pixinguinha", "João de Barros", "Alberto Ribeiro"]);
        compare(Pages.splitArtists("Tonico e Tinoco"), ["Tonico e Tinoco"]);
        compare(Pages.splitArtists(" / "), []);
        compare(Pages.splitArtists(""), []);
    }

    function authorsBook() {
        return {
            setlists: [{ path: "roda.setlist.md", title: "Roda", songs: 2 }],
            songs: [
                { path: "carinhoso.cifra.md", title: "Carinhoso", artist: "Pixinguinha / João de Barros" },
                { path: "um-a-zero.cifra.md", title: "Um a Zero", artist: "Pixinguinha, Benedito Lacerda" },
                { path: "brejeiro.cifra.md", title: "Brejeiro", artist: "Ernesto Nazareth" },
                { path: "ainda-me-recordo.cifra.md", title: "Ainda Me Recordo", artist: "pixinguinha" },
                { path: "sem-nome.cifra.md", title: "Sem Nome", artist: "" },
                { path: "tico-tico.cifra.md", title: "Tico-Tico no Fubá", artist: "Zequinha de Abreu" }
            ]
        };
    }

    // §A book, by title: every song once, alphabetically, its artist under.
    function test_bookRowsByTitle() {
        const rows = Pages.bookRows(authorsBook(), "title");
        compare(rows.map(r => r.title),
                ["Roda", "Ainda Me Recordo", "Brejeiro", "Carinhoso", "Sem Nome", "Tico-Tico no Fubá", "Um a Zero"]);
        compare(rows[1].heading, "Songs");
        compare(rows[3].detail, "Pixinguinha / João de Barros");
        compare(rows.map(r => r.letter), ["", "A", "B", "C", "S", "T", "U"]);
    }

    // §A book, by author: a song under each of its authors, the authors in
    // alphabetical order (one group however capitalised), each one's songs by
    // title, the songs with none last; the artist under a title only when it
    // names others too; a letter on each author's first row.
    function test_bookRowsByAuthor() {
        const rows = Pages.bookRows(authorsBook(), "author");
        compare(rows.map(r => r.heading),
                ["Setlists", "Benedito Lacerda", "Ernesto Nazareth", "João de Barros",
                 "Pixinguinha", "", "", "Zequinha de Abreu", "No author"]);
        compare(rows.map(r => r.title),
                ["Roda", "Um a Zero", "Brejeiro", "Carinhoso",
                 "Ainda Me Recordo", "Carinhoso", "Um a Zero", "Tico-Tico no Fubá", "Sem Nome"]);
        compare(rows.map(r => r.detail),
                ["", "Pixinguinha, Benedito Lacerda", "", "Pixinguinha / João de Barros",
                 "", "Pixinguinha / João de Barros", "Pixinguinha, Benedito Lacerda", "", ""]);
        compare(rows.map(r => r.letter), ["", "B", "E", "J", "P", "", "", "Z", ""]);
        compare(Pages.letterPages(rows), { B: 0, E: 0, J: 0, P: 0, Z: 0 });
    }

    // An author's songs that run onto the next page are named again atop it,
    // and that heading is counted in the page's height.
    function test_authorHeadingRepeatsAtopAPage() {
        const songs = [];
        for (let i = 0; i < 5; ++i)
            songs.push({ path: "s" + i + ".cifra.md", title: "Song " + i, artist: "Same" });
        const rows = Pages.bookRows({ setlists: [], songs: songs }, "author");
        // 72 + 3 × 120 = 432 fits 450; the fourth row starts the next page,
        // under the heading again.
        const pages = Pages.heightPages(rows, 450, 120, 72);
        compare(pages, [0, 3]);
        const second = Pages.pageRows(rows, 1, 120, 72, pages);
        compare(second[0].heading, "Same");
        compare(second[0].headingY, 0);
        compare(second[0].y, 72);
        compare(second[1].heading, "");
        compare(rows[3].heading, "");
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
