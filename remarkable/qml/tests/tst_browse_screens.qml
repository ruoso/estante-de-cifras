// behavior — the browse screens (reader.browse_screens): NotPaired,
// ShelfScreen, BookScreen, SetlistScreen and SettingsScreen over the
// backend's own views of the fixture books (fixtures/browse-*.js, generated
// by TestQMLFixtures from fixtures/browse-book/), sending through the AppLoad
// stand-in. Workflow 19 §Pairing, §The shelf, §A book, §A setlist, the
// refresh budget; design §6.
import QtQuick
import QtTest
import "../chart/metrics.js" as M
import net.asivery.AppLoad 1.0
import "../browse"
import "../browse/pages.js" as Pages
import "fixtures/browse-shelf.js" as BrowseShelf
import "fixtures/browse-book.js" as BrowseBook
import "fixtures/browse-book-small.js" as BrowseBookSmall
import "fixtures/browse-setlist.js" as BrowseSetlist
import "fixtures/browse-settings.js" as BrowseSettings
import "fixtures/browse-settings-update.js" as BrowseSettingsUpdate
import "fixtures/browse-settings-instruments.js" as BrowseSettingsInstruments
import "fixtures/browse-settings-instrument-chosen.js" as BrowseSettingsInstrumentChosen
import "fixtures/browse-settings-voiced.js" as BrowseSettingsVoiced
import "walk.js" as Walk

TestCase {
    id: testCase
    name: "BrowseScreens"
    when: windowShown
    width: 1404
    height: 1872

    Component {
        id: endpointComponent
        AppLoad {
            applicationID: "estante"
        }
    }

    Component { id: notPairedComponent; NotPaired {} }
    Component { id: shelfComponent; ShelfScreen {} }
    Component { id: bookComponent; BookScreen {} }
    Component { id: setlistComponent; SetlistScreen {} }
    Component { id: settingsComponent; SettingsScreen {} }

    function clone(x) {
        return JSON.parse(JSON.stringify(x));
    }

    function localTime(hours, minutes) {
        return new Date(2026, 9, 30, hours, minutes, 0).toISOString();
    }

    // A screen hosted in the window's root, sending through a stand-in.
    function make(component) {
        const endpoint = createTemporaryObject(endpointComponent, testCase);
        const screen = createTemporaryObject(component, testCase.parent, { endpoint: endpoint });
        verify(screen !== null);
        tryVerify(() => screen.faces.ready);
        return screen;
    }

    function rows(screen) {
        const out = [];
        for (let i = 0; i < screen.rows.count; ++i)
            out.push(screen.rows.itemAt(i));
        return out;
    }

    function titles(screen) {
        return rows(screen).map(r => r.title);
    }

    function headings(screen) {
        const out = [];
        for (let i = 0; i < screen.headings.count; ++i)
            out.push(screen.headings.itemAt(i).text);
        return out;
    }

    function songTitles(from, to) {
        return BrowseBook.book.songs.slice(from, to).map(s => Pages.songTitle(s));
    }

    function clean(screen) {
        waitForRendering(screen);
        compare(Walk.oneBitProblems(screen), []);
    }

    // --- a book ---

    // §A book: ten rows a page over the setlists and songs together; the
    // 34-song, 3-setlist book is 4 pages, page 1 the 3 setlists then 7 songs
    // under their headings, page 4 the last 7 songs.
    function test_bookPagedTenToAPage() {
        const screen = make(bookComponent);
        screen.show(clone(BrowseBook.book), 0);
        compare(screen.pageCount, 4);
        compare(screen.foot.pageLabel.text, "1 of 4");
        compare(screen.bar.title.text, "Banda do Bairro");
        verify(screen.bar.back.visible);
        compare(headings(screen), ["Setlists", "Songs"]);
        compare(titles(screen), BrowseBook.book.setlists.map(s => s.title).concat(songTitles(0, 7)));
        compare(rows(screen)[0].rightWord, "14 songs");
        compare(rows(screen)[2].rightWord, "1 song");
        compare(rows(screen)[4].detail, "Banda do Bairro");
        for (const r of rows(screen))
            verify(r.y + r.height <= screen.list.height, "a row past the content");
        clean(screen);
        // A page with no heading holds what the content holds: eleven rows
        // of 120 px in the 1432 px above the letters (workflow 19 §A book —
        // the page is filled, not cut at ten).
        mouseClick(screen.foot.next);
        compare(screen.page, 1);
        compare(headings(screen), []);
        compare(titles(screen), songTitles(7, 18));
        for (const r of rows(screen))
            verify(r.y + r.height <= screen.list.height, "a row past the content");
        mouseClick(screen.foot.next);
        compare(titles(screen), songTitles(18, 29));
        mouseClick(screen.foot.next);
        compare(screen.page, 3);
        compare(screen.foot.pageLabel.text, "4 of 4");
        compare(titles(screen), songTitles(29, 34));
        // The untitled song says its file name.
        mouseClick(screen.foot.previous);
        verify(titles(screen).indexOf("trem-das-seis") >= 0);
        // An empty artist: no second line.
        const eco = rows(screen).filter(r => r.title === "Ponte Velha")[0];
        verify(eco !== undefined);
        compare(eco.detail, "");
        verify(!eco.detailText.visible);
    }

    // §The screen as amended: a list turns by a swipe as by the arrows.
    function test_bookTurnsBySwipe() {
        const screen = make(bookComponent);
        screen.show(clone(BrowseBook.book), 0);
        const row = rows(screen)[5];
        mousePress(row, 1000, 60);
        mouseRelease(row, 400, 60);
        compare(screen.page, 1);
        compare(screen.endpoint.sent.length, 0);
        // The page's rows are new ones.
        const again = rows(screen)[5];
        mousePress(again, 400, 60);
        mouseRelease(again, 1000, 60);
        compare(screen.page, 0);
        compare(screen.endpoint.sent.length, 0);
    }

    // §A book, rule 8, Decision 8: only the letters that start a song are
    // targets; every other cell is empty and in place; none is marked.
    function test_absentLettersNotDrawn() {
        const screen = make(bookComponent);
        screen.show(clone(BrowseBook.book), 0);
        verify(screen.hasLetters);
        verify(screen.letters.visible);
        const present = "ABCDEFGIJLMNOPQRSTUVXZ";
        for (let i = 0; i < 26; ++i) {
            const cell = screen.letters.cells.itemAt(i);
            const letter = Pages.alphabet[i];
            compare(cell.letter, letter);
            compare(cell.x, (i % 13) * 108, letter);
            compare(cell.y, Math.floor(i / 13) * 100, letter);
            compare(cell.width, 108);
            compare(cell.height, 100);
            compare(cell.button.visible, present.indexOf(letter) >= 0, letter);
            compare(cell.button.inverted, false, letter);
        }
        compare(screen.letters.y + screen.letters.height, 140 + 1632);
        clean(screen);
    }

    // §A book: a book of two pages or fewer draws no letter rows, and its
    // list has the whole content.
    function test_twoPageBookHasNoLetters() {
        const screen = make(bookComponent);
        screen.show(clone(BrowseBookSmall.book), 0);
        compare(screen.pageCount, 2);
        verify(!screen.hasLetters);
        verify(!screen.letters.visible);
        compare(screen.list.height, 1632);
        clean(screen);
    }

    // §A book, rule 8: a letter sends nothing and shows the page of its
    // first song.
    function test_letterGoesToItsPage() {
        const screen = make(bookComponent);
        screen.show(clone(BrowseBook.book), 0);
        mouseClick(screen.letters.cell("M").button);
        compare(screen.endpoint.sent.length, 0);
        verify(screen.page > 0);
        verify(titles(screen).indexOf("Mar de Dentro") >= 0);
        // T is the untitled song's, by its file name.
        mouseClick(screen.letters.cell("T").button);
        verify(screen.page > 0);
        verify(titles(screen).indexOf("trem-das-seis") >= 0);
        mouseClick(screen.letters.cell("A").button);
        compare(screen.page, 0);
        // An empty cell is no target.
        mouseClick(screen.letters.cell("H"));
        compare(screen.page, 0);
        compare(screen.endpoint.sent.length, 0);
    }

    // §A book, design §6 `2 open`: a setlist row opens the setlist, a song
    // row the song, Back the shelf — one message each, the row held.
    function test_bookRowsAndBackSendTheirOpen() {
        const screen = make(bookComponent);
        const book = clone(BrowseBook.book);
        screen.show(book, 0);
        mouseClick(rows(screen)[0]);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].payload, { view: "setlist", bookId: book.bookId,
                                                   path: book.setlists[0].path });
        verify(rows(screen)[0].inverted);
        // Waiting: another tap sends nothing.
        mouseClick(rows(screen)[4]);
        compare(screen.endpoint.sent.length, 1);
        screen.show(book, 0);
        verify(!rows(screen)[0].inverted);
        screen.endpoint.clear();
        mouseClick(rows(screen)[4]);
        compare(screen.endpoint.sent[0].payload, { view: "song", bookId: book.bookId,
                                                   path: book.songs[1].path });
        screen.show(book, 0);
        screen.endpoint.clear();
        mouseClick(screen.bar.back);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].payload, { view: "shelf" });
    }

    // §A book: *No songs in this book yet.* for a book with none.
    function test_emptyBook() {
        const screen = make(bookComponent);
        screen.show({ bookId: "bk-empty", title: "", songs: [], setlists: [] }, 0);
        compare(screen.bar.title.text, "Untitled book");
        verify(screen.emptyText.visible);
        compare(screen.emptyText.text, "No songs in this book yet.");
        compare(screen.rows.count, 0);
        verify(!screen.foot.next.visible);
        compare(screen.foot.pageLabel.text, "1 of 1");
        clean(screen);
    }

    // --- the shelf ---

    // §The shelf: Estante, Sync; the sync line; the rows in the 103's order
    // with their counts; Untitled book.
    function test_shelfRows() {
        const screen = make(shelfComponent);
        screen.show(clone(BrowseShelf.shelf), { paired: true, lastSync: localTime(14, 32) }, 0);
        compare(screen.bar.title.text, "Estante");
        compare(screen.bar.action.text, "Sync");
        verify(!screen.bar.back.visible);
        compare(screen.syncText.text, "Synced at 14:32");
        compare(titles(screen), ["Banda do Bairro", "Choro na Varanda", "Untitled book", "Roda de Quinta"]);
        compare(rows(screen).map(r => r.detail),
                ["34 songs · 3 setlists", "12 songs · 2 setlists", "1 song · 1 setlist", "12 songs"]);
        compare(screen.foot.leftButton.text, "Settings");
        verify(!screen.emptyText.visible);
        clean(screen);
    }

    // §The shelf, design §6: a row opens its book; Sync sends `4 sync {}`
    // and nothing else changes; Settings opens settings.
    function test_shelfSends() {
        const screen = make(shelfComponent);
        const state = { paired: true, lastSync: localTime(14, 32) };
        screen.show(clone(BrowseShelf.shelf), state, 0);
        const line = screen.syncLine.revision;
        mouseClick(screen.bar.action);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].type, 4);
        compare(screen.endpoint.sent[0].payload, {});
        compare(screen.syncLine.revision, line);
        compare(screen.syncText.text, "Synced at 14:32");
        screen.endpoint.clear();
        mouseClick(rows(screen)[1]);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].payload, { view: "book", bookId: "bk-varanda" });
        screen.show(clone(BrowseShelf.shelf), state, 0);
        screen.endpoint.clear();
        mouseClick(screen.foot.leftButton);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].payload, { view: "settings" });
    }

    // §The shelf, Nothing yet.
    function test_emptyShelf() {
        const screen = make(shelfComponent);
        screen.show({ books: [] }, { paired: true, lastSync: localTime(9, 5) }, 0);
        compare(screen.rows.count, 0);
        verify(screen.emptyText.visible);
        compare(screen.emptyText.text,
                "No books on your shelf yet. Books you add in Estante on your phone or computer come here.");
        clean(screen);
    }

    // --- a setlist ---

    // §A setlist as amended: number, title, *in D*, the note under the
    // title, *missing*, no key for an item without one; the book's line.
    function test_setlistRows() {
        const screen = make(setlistComponent);
        screen.show(clone(BrowseSetlist.setlist), "Banda do Bairro");
        compare(screen.bar.title.text, "Bar do Zé, 10 October");
        verify(screen.bar.back.visible);
        // reader.play: Play at the bar's right, the setlist having songs to play.
        verify(screen.bar.action.visible);
        compare(screen.bar.action.text, "Play");
        compare(screen.lineText.text, "Banda do Bairro · 14 songs");
        compare(screen.pageCount, 2);
        const r = rows(screen);
        compare(r.length, 10);
        compare(r[0].number, "1");
        compare(r[0].title, "Ária do Porto");
        compare(r[0].rightWord, "in D");
        compare(r[0].detail, "start soft, let the intro ring");
        verify(r[0].detailText.y > r[0].titleText.y);
        compare(r[1].rightWord, "");
        verify(!r[1].rightText.visible);
        compare(r[1].detail, "");
        compare(r[2].title, "Canção Perdida");
        compare(r[2].rightWord, "missing");
        compare(r[9].number, "10");
        compare(r[9].rightWord, "in F");
        // A missing row is not a target (reader.play Decision 3): no
        // inversion, nothing sent. (A playable row opens Play: tst_play.qml.)
        verify(!r[2].active);
        mousePress(r[2]);
        verify(!r[2].inverted);
        mouseRelease(r[2]);
        compare(screen.endpoint.sent.length, 0);
        verify(!r[2].inverted);
        clean(screen);
        mouseClick(screen.foot.next);
        compare(rows(screen).map(x => x.number), ["11", "12", "13", "14"]);
        compare(rows(screen)[2].rightWord, "in Bb");
        mouseClick(screen.bar.back);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].payload, { view: "book", bookId: "bk-bairro" });
    }

    // §A setlist: a 106 with `at` opens on the page holding item `at`.
    function test_setlistOpensAtItsPlace() {
        const screen = make(setlistComponent);
        const set = clone(BrowseSetlist.setlist);
        set.at = 12;
        screen.show(set, "Banda do Bairro");
        compare(screen.page, 1);
        compare(screen.foot.pageLabel.text, "2 of 2");
        verify(titles(screen).indexOf("Pandeiro Novo") >= 0);
    }

    // --- settings ---

    // §The shelf, Settings, as amended: the five parts in order; Show all
    // again sends `9 showAllShapes {}` and the next 107 says No shapes
    // hidden.; Sign out asks, Cancel sends nothing, the second Sign out
    // sends `6 signOut {}`.
    function test_settings() {
        const screen = make(settingsComponent);
        screen.show(clone(BrowseSettings.settings), { paired: true, lastSync: localTime(14, 32) });
        compare(screen.bar.title.text, "Settings");
        verify(screen.bar.back.visible);
        const parts = [screen.accountPart, screen.syncPart, screen.shapes, screen.readerPart, screen.signOut];
        for (let i = 1; i < parts.length; ++i)
            verify(parts[i].mapToItem(screen, 0, 0).y > parts[i - 1].mapToItem(screen, 0, 0).y, "part " + i);
        compare(screen.accountPart.valueText.text, "Paired with marina@example.org");
        compare(screen.syncPart.valueText.text, "Synced at 14:32");
        compare(screen.shapesText.text, "11 shapes hidden — the ones you know");
        compare(screen.readerPart.valueText.text, "Version 0.9.0-test");
        // updateReader false (reader.self_update): no update line.
        compare(BrowseSettings.settings.updateReader, false);
        verify(!screen.updateText.visible);
        compare(screen.updateText.text, "");
        verify(screen.showAllButton.visible);
        verify(screen.signOutButton.visible);
        verify(!screen.questionText.visible);
        clean(screen);

        mouseClick(screen.showAllButton);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].type, 9);
        compare(screen.endpoint.sent[0].payload, {});
        const none = clone(BrowseSettings.settings);
        none.hiddenShapes = 0;
        screen.answered(none);
        compare(screen.shapesText.text, "No shapes hidden.");
        verify(!screen.showAllButton.visible);

        screen.endpoint.clear();
        mouseClick(screen.signOutButton);
        compare(screen.endpoint.sent.length, 0);
        verify(screen.questionText.visible);
        compare(screen.questionText.text,
                "Sign out of this reMarkable? Your books are removed from it; nothing changes in your account.");
        verify(!screen.signOutButton.visible);
        compare(screen.confirmButton.text, "Sign out");
        compare(screen.cancelButton.text, "Cancel");
        clean(screen);
        mouseClick(screen.cancelButton);
        compare(screen.endpoint.sent.length, 0);
        verify(screen.signOutButton.visible);
        verify(!screen.questionText.visible);
        mouseClick(screen.signOutButton);
        mouseClick(screen.confirmButton);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].type, 6);
        compare(screen.endpoint.sent[0].payload, {});
        mouseClick(screen.bar.back);
        compare(screen.endpoint.sent.length, 1);
    }

    // reader.self_update (design §8; workflow 19 §The shelf, This reader): a
    // site serving a newer hostApi — *Version …* and under it *Update the
    // reader on your reMarkable*, inside This reader's part, one-bit; the
    // parts keep their order.
    // workflow 19 §Settings: with one instrument there is nothing to choose,
    // and the Instrument part is not drawn.
    function test_settingsNoInstrumentChoice() {
        const screen = make(settingsComponent);
        screen.show(clone(BrowseSettings.settings), { paired: true });
        verify(!screen.instrumentPart.visible);
        verify(!screen.changeButton.visible);
    }

    // workflow 19 §Settings: the Instrument part names the one read with and
    // whose choice it is; Change puts the instruments in Sign out's place
    // (one redraw), the one read inverted and the account's marked; one
    // chosen is sent (12) and, answered, the part says it was chosen here and
    // Sign out comes back; the account's own is sent as null.
    function test_settingsChooseInstrument() {
        const screen = make(settingsComponent);
        const settings = clone(BrowseSettingsInstruments.settings);
        screen.show(settings, { paired: true });
        verify(screen.instrumentPart.visible);
        verify(screen.instrumentPart.mapToItem(screen, 0, 0).y > screen.readerPart.mapToItem(screen, 0, 0).y);
        verify(screen.signOutButton.mapToItem(screen, 0, 0).y >= screen.instrumentPart.mapToItem(screen, 0, 0).y + screen.partHeight);
        // Everything inside the content.
        verify(screen.signOutButton.mapToItem(screen, 0, 0).y + screen.signOutButton.height <= M.barHeight + M.contentHeight);
        compare(screen.instrumentPart.noteText.text, "As in your account");
        const guitar = settings.instruments[0];
        compare(screen.instrumentPart.valueText.text, guitar.name);
        verify(screen.changeButton.visible);
        clean(screen);

        const instrumentRev = screen.instrument.revision;
        const signOutRev = screen.signOut.revision;
        const contentRev = screen.content.revision;
        mouseClick(screen.changeButton);
        compare(screen.signOut.revision, signOutRev + 1);
        compare(screen.instrument.revision, instrumentRev);
        compare(screen.content.revision, contentRev);
        verify(!screen.signOutButton.visible);
        compare(screen.instrumentButtons.count, 2);
        const [first, uke] = [screen.instrumentButtons.itemAt(0), screen.instrumentButtons.itemAt(1)];
        compare(first.text, guitar.name + " · your account's");
        verify(first.inverted);
        compare(uke.text, "My uke");
        verify(!uke.inverted);
        verify(uke.height >= 100);
        clean(screen);

        mouseClick(uke);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].type, 12);
        compare(screen.endpoint.sent[0].payload, { id: "u1" });
        verify(uke.inverted);
        // Held while waiting: a second tap sends nothing.
        mouseClick(first);
        compare(screen.endpoint.sent.length, 1);

        screen.answered(clone(BrowseSettingsInstrumentChosen.settings));
        compare(screen.instrumentPart.valueText.text, "My uke");
        compare(screen.instrumentPart.noteText.text, "Chosen on this reMarkable");
        verify(screen.signOutButton.visible);
        compare(screen.instrumentButtons.count, 0);
        compare(screen.shapes.revision, 1);

        // The account's own follows the account again: null.
        mouseClick(screen.changeButton);
        mouseClick(screen.instrumentButtons.itemAt(0));
        compare(screen.endpoint.sent[1].type, 12);
        compare(screen.endpoint.sent[1].payload, { id: null });
    }

    // Cancel puts Sign out back and sends nothing; the one read, tapped,
    // only closes the list.
    function test_settingsInstrumentCancel() {
        const screen = make(settingsComponent);
        screen.show(clone(BrowseSettingsInstruments.settings), { paired: true });
        mouseClick(screen.changeButton);
        mouseClick(screen.cancelInstrumentButton);
        verify(screen.signOutButton.visible);
        compare(screen.instrumentButtons.count, 0);
        mouseClick(screen.changeButton);
        mouseClick(screen.instrumentButtons.itemAt(0));
        verify(screen.signOutButton.visible);
        compare(screen.endpoint.sent.length, 0);
    }

    // workflow 19 §Settings: Chord names says how the chart names its chords
    // and whose choice it is; its button names the other, sends it (14) and,
    // answered, the part alone is redrawn; back to the account's own, null.
    function test_settingsChordNames() {
        const screen = make(settingsComponent);
        screen.show(clone(BrowseSettingsInstrumentChosen.settings), { paired: true });
        verify(screen.chordNamesPart.mapToItem(screen, 0, 0).y > screen.readerPart.mapToItem(screen, 0, 0).y);
        verify(screen.instrumentPart.mapToItem(screen, 0, 0).y > screen.chordNamesPart.mapToItem(screen, 0, 0).y);
        compare(screen.chordNamesPart.valueText.text, "As written");
        compare(screen.chordNamesPart.noteText.text, "As in your account");
        compare(screen.chordNamesButton.text, "Name as voiced");
        verify(screen.chordNamesButton.height >= 100);
        clean(screen);

        const others = [screen.content.revision, screen.shapes.revision, screen.instrument.revision, screen.signOut.revision];
        mouseClick(screen.chordNamesButton);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].type, 14);
        compare(screen.endpoint.sent[0].payload, { value: "voiced" });
        verify(screen.chordNamesButton.inverted);
        const rev = screen.chordNames.revision;
        screen.answered(clone(BrowseSettingsVoiced.settings));
        compare(screen.chordNames.revision, rev + 1);
        compare([screen.content.revision, screen.shapes.revision, screen.instrument.revision, screen.signOut.revision], others);
        compare(screen.chordNamesPart.valueText.text, "As voiced");
        compare(screen.chordNamesPart.noteText.text, "Chosen on this reMarkable");
        compare(screen.chordNamesButton.text, "Name as written");
        verify(!screen.chordNamesButton.inverted);

        // Written is the account's own: null follows the account again.
        mouseClick(screen.chordNamesButton);
        compare(screen.endpoint.sent[1].type, 14);
        compare(screen.endpoint.sent[1].payload, { value: null });
        clean(screen);
    }

    // workflow 19 §Settings: Text size offers the chart's sizes in points,
    // the one read inverted; one chosen is sent (15), the standard as null;
    // the one read sends nothing.
    function test_settingsTextSize() {
        const screen = make(settingsComponent);
        screen.show(clone(BrowseSettingsInstruments.settings), { paired: true });
        const buttons = screen.textSizeButtons;
        compare(buttons.count, M.textSizes.length);
        const labels = [];
        for (let i = 0; i < buttons.count; ++i) {
            labels.push(buttons.itemAt(i).text);
            verify(buttons.itemAt(i).height >= 100);
            verify(buttons.itemAt(i).x + buttons.itemAt(i).width <= screen.width - M.contentSide);
        }
        compare(labels, M.textSizes.map(n => n + " pt"));
        const standard = M.textSizes.indexOf(M.standardPt);
        verify(buttons.itemAt(standard).inverted);
        verify(screen.textSize.mapToItem(screen, 0, 0).y > screen.chordNamesPart.mapToItem(screen, 0, 0).y);
        verify(screen.instrumentPart.mapToItem(screen, 0, 0).y >= screen.textSize.mapToItem(screen, 0, 0).y + screen.textSizeHeight);
        clean(screen);

        mouseClick(buttons.itemAt(standard));
        compare(screen.endpoint.sent.length, 0);
        mouseClick(buttons.itemAt(M.textSizes.indexOf(11)));
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].type, 15);
        compare(screen.endpoint.sent[0].payload, { value: 11 });
        verify(buttons.itemAt(M.textSizes.indexOf(11)).inverted);
    }

    function test_settingsUpdateReader() {
        const screen = make(settingsComponent);
        screen.show(clone(BrowseSettingsUpdate.settings), { paired: true, lastSync: localTime(14, 32) });
        compare(BrowseSettingsUpdate.settings.updateReader, true);
        compare(screen.readerPart.valueText.text, "Version 0.9.0-test");
        verify(screen.updateText.visible);
        compare(screen.updateText.text, "A new version is ready: it starts the next time Estante opens");
        const part = screen.readerPart.mapToItem(screen, 0, 0).y;
        const version = screen.readerPart.valueText.mapToItem(screen, 0, 0).y;
        const line = screen.updateText.mapToItem(screen, 0, 0).y;
        verify(line >= version + screen.readerPart.valueText.height, "the update line under the version");
        verify(line + screen.updateText.height <= part + screen.readerPart.height - 2, "the update line inside its part");
        verify(screen.updateText.implicitWidth <= screen.updateText.width, "the update line is not cut");
        verify(screen.signOut.mapToItem(screen, 0, 0).y >= part + screen.readerPart.height, "Sign out under This reader");
        clean(screen);
    }

    // Settings' Back opens the shelf; the hidden count's singular.
    function test_settingsBackAndSingular() {
        const screen = make(settingsComponent);
        const one = clone(BrowseSettings.settings);
        one.hiddenShapes = 1;
        screen.show(one, { paired: true, syncing: true });
        compare(screen.shapesText.text, "1 shape hidden — the one you know");
        compare(screen.syncPart.valueText.text, "Syncing…");
        mouseClick(screen.bar.back);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].payload, { view: "shelf" });
    }

    // --- pairing ---

    // §Pairing: Pair sends `5 pair {}`, the page unchanged until a 102; the
    // code drawn with its address and end; expired and offline say their
    // sentence with Get a new code, which sends `5 pair {}`; Back to Not
    // paired sends nothing.
    function test_pairingPage() {
        const screen = make(notPairedComponent);
        screen.show();
        compare(screen.mode, "notPaired");
        compare(screen.bar.title.text, "Estante de Cifras");
        verify(!screen.bar.back.visible);
        compare(screen.titleText.text, "Your songbooks, on this reMarkable.");
        compare(screen.pairButton.text, "Pair with your account");
        verify(!screen.accepts);
        clean(screen);
        const content = screen.content.revision;
        const bar = screen.bar.revision;
        mouseClick(screen.pairButton);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].type, 5);
        compare(screen.endpoint.sent[0].payload, {});
        compare(screen.mode, "notPaired");
        compare([screen.content.revision, screen.bar.revision], [content, bar]);
        verify(screen.pairButton.inverted);
        verify(screen.accepts);

        screen.pairing({ code: "KQ7-4TM", url: "https://www.estantedecifras.app/pair",
                         expiresAt: localTime(14, 42) });
        compare(screen.mode, "code");
        compare(screen.bar.title.text, "Pair this reMarkable");
        verify(screen.bar.back.visible);
        compare(screen.codeText.text, "KQ7-4TM");
        verify(screen.introText.text.indexOf("<b>www.estantedecifras.app/pair</b>") >= 0);
        compare(screen.untilText.text, "This code works until 14:42.");
        compare(screen.newCodeButton.text, "Get a new code");
        clean(screen);

        screen.endpoint.clear();
        screen.pairing({ expired: true });
        compare(screen.mode, "expired");
        compare(screen.sentenceText.text, "That code has expired.");
        verify(!screen.codeText.visible);
        verify(screen.newCodeButton.visible);
        clean(screen);
        mouseClick(screen.newCodeButton);
        compare(screen.endpoint.sent.length, 1);
        compare(screen.endpoint.sent[0].type, 5);

        screen.pairing({ offline: true });
        compare(screen.mode, "offline");
        compare(screen.sentenceText.text,
                "This reMarkable is not connected to Wi-Fi. Connect it in Settings and try again.");
        verify(screen.newCodeButton.visible);
        verify(!screen.newCodeButton.inverted);
        mouseClick(screen.newCodeButton);
        compare(screen.endpoint.sent.length, 2);
        compare(screen.endpoint.sent[1].type, 5);
        compare(screen.endpoint.sent[1].payload, {});

        screen.endpoint.clear();
        mouseClick(screen.bar.back);
        compare(screen.endpoint.sent.length, 0);
        compare(screen.mode, "notPaired");
        verify(!screen.bar.back.visible);
        verify(!screen.accepts);
    }

    // --- reader.pairing ---

    // Workflow 19 §The shelf (Settings), as reader.pairing amends it:
    // *Paired with* the account's name (its home book's authorName), *your
    // account* until it has one.
    function test_pairedWithYourAccount() {
        const screen = make(settingsComponent);
        const unnamed = clone(BrowseSettings.settings);
        unnamed.account = "";
        screen.show(unnamed, { paired: true, lastSync: localTime(14, 32) });
        compare(screen.accountPart.valueText.text, "Paired with your account");
        clean(screen);
        const named = clone(BrowseSettings.settings);
        named.account = "Marina Souza";
        screen.show(named, { paired: true, lastSync: localTime(14, 32) });
        compare(screen.accountPart.valueText.text, "Paired with Marina Souza");
    }

    // Workflow 19 §Pairing (signed out from the account): Not paired shown
    // after a refusal carries *This reMarkable was signed out from your
    // account.* above its words — drawn one-bit, inside the content region;
    // shown otherwise, and after the code page's Back, it does not.
    function test_signedOutLine() {
        const screen = make(notPairedComponent);
        screen.show(true);
        verify(screen.signedOut);
        verify(screen.signedOutText.visible);
        compare(screen.signedOutText.text, "This reMarkable was signed out from your account.");
        const line = screen.signedOutText.mapToItem(screen.content, 0, 0);
        verify(line.x >= 0 && line.y >= 0);
        verify(line.x + screen.signedOutText.width <= screen.content.width);
        verify(line.y + screen.signedOutText.height <= screen.content.height);
        const title = screen.titleText.mapToItem(screen.content, 0, 0);
        verify(title.y >= line.y + screen.signedOutText.height, "the line is above the words");
        const button = screen.pairButton.mapToItem(screen.content, 0, 0);
        verify(button.y + screen.pairButton.height <= screen.content.height, "the button stays in the content");
        clean(screen);

        screen.show();
        verify(!screen.signedOut);
        verify(!screen.signedOutText.visible);
        screen.show(true);
        mouseClick(screen.pairButton);
        screen.pairing({ code: "KQ7-4TM", url: "https://www.estantedecifras.app/pair",
                         expiresAt: localTime(14, 42) });
        verify(!screen.signedOutText.visible);
        mouseClick(screen.bar.back);
        compare(screen.mode, "notPaired");
        verify(!screen.signedOutText.visible);
    }
}
