// behavior — the reader's QML root (reader.app_folder, reader.browse_screens):
// Main.qml, the file AppLoad loads, against the AppLoad stand-in. It says
// hello once, draws nothing before the first state, routes each view to its
// screen — Not paired, the shelf (whose sync line is workflow 19's line for
// the state), a book, a setlist, Settings, the song (reader.song_screen
// Decision 11), the `109 ahead` neighbours of a played song (reader.play) —
// ignores what it does not know, keeps background news off
// every screen but the shelf's sync line, leaves the backend running when it
// unloads, and has the root's contract AppLoad relies on.
import QtQuick
import QtTest
import ".."
import "fixtures/few-chords.js" as FewChords
import "fixtures/found-shape.js" as FoundShape
import "fixtures/browse-shelf.js" as BrowseShelf
import "fixtures/browse-book.js" as BrowseBook
import "fixtures/browse-setlist.js" as BrowseSetlist
import "fixtures/browse-settings.js" as BrowseSettings
import "fixtures/play-1.js" as Play1
import "walk.js" as Walk

TestCase {
    id: testCase
    name: "Main"
    when: windowShown
    width: 400
    height: 300

    Component {
        id: mainComponent
        Main {}
    }

    // The spy listens before Main's Component.onCompleted says hello.
    Component {
        id: spiedMainComponent
        Main {
            id: spied
            readonly property SignalSpy spy: SignalSpy {
                target: spied.endpoint
                signalName: "messageSent"
            }
        }
    }

    function clone(x) {
        return JSON.parse(JSON.stringify(x));
    }

    function stateMessage(fields) {
        return Object.assign({ paired: false, syncing: false, online: true,
                               lastSync: null, shapesShown: true }, fields);
    }

    // A device-local time today, as the backend's RFC 3339 lastSync.
    function localTime(hours, minutes) {
        const t = new Date(2026, 9, 30, hours, minutes, 0);
        return t.toISOString();
    }

    // Main in the window's root, which is shown, so what is visible is drawn
    // and can be tapped.
    function shown() {
        return createTemporaryObject(mainComponent, testCase.parent);
    }

    // The messages sent since the last clear, without hello.
    function sentAfterHello(main) {
        return main.endpoint.sent.filter(m => m.type !== 1);
    }

    // Main paired, on the shelf of the browse fixture.
    function onShelf(state) {
        const main = shown();
        main.endpoint.play(101, stateMessage(Object.assign({ paired: true, lastSync: localTime(14, 32) }, state || {})));
        main.endpoint.play(103, clone(BrowseShelf.shelf));
        compare(main.view, "shelf");
        main.endpoint.clear();
        return main;
    }

    function visibleScreens(main) {
        const out = [];
        for (const name of ["notPaired", "shelfScreen", "bookScreen", "setlistScreen", "settingsScreen", "songScreen"])
            if (main[name].visible)
                out.push(name);
        return out;
    }

    // Design §6 `1 hello`: once, with `{}`.
    function test_helloOnAttach() {
        const main = createTemporaryObject(spiedMainComponent, testCase);
        compare(main.endpoint.sent.length, 1);
        compare(main.endpoint.sent[0].type, 1);
        compare(main.endpoint.sent[0].contents, "{}");
        compare(main.endpoint.sent[0].payload, {});
        compare(main.spy.count, 1);
    }

    // Workflow 19, the refresh budget's rule 1: no intermediate state —
    // nothing drawn before the first state; the first state unpaired shows Not
    // paired (§Pairing).
    function test_nothingBeforeState() {
        const main = shown();
        compare(main.backendState, null);
        compare(main.view, "");
        compare(visibleScreens(main), []);
        main.endpoint.play(101, stateMessage({}));
        compare(main.view, "notPaired");
        compare(visibleScreens(main), ["notPaired"]);
        compare(main.notPaired.mode, "notPaired");
        compare(sentAfterHello(main), []);
    }

    // Decision 3: the first state paired sends `2 open {view: "shelf"}` once,
    // however many states follow before the answer; the `103` shows the shelf.
    function test_firstPairedStateOpensTheShelf() {
        const main = shown();
        main.endpoint.play(101, stateMessage({ paired: true, lastSync: localTime(14, 32) }));
        main.endpoint.play(101, stateMessage({ paired: true, syncing: true, lastSync: localTime(14, 32) }));
        compare(sentAfterHello(main).length, 1);
        compare(sentAfterHello(main)[0].type, 2);
        compare(sentAfterHello(main)[0].payload, { view: "shelf" });
        compare(visibleScreens(main), []);
        main.endpoint.play(103, clone(BrowseShelf.shelf));
        compare(visibleScreens(main), ["shelfScreen"]);
        compare(main.shelfScreen.syncText.text, "Syncing…");
        compare(main.shelfScreen.rows.count, BrowseShelf.shelf.books.length);
    }

    // Workflow 19 §The shelf (the sync line) and §Pairing; rule 2, time
    // written as a time — the line read off the shelf.
    function test_showsTheState() {
        const main = onShelf();
        compare(main.shelfScreen.syncText.text, "Synced at 14:32");
        main.endpoint.play(101, stateMessage({ paired: true, syncing: true,
                                               lastSync: localTime(14, 32) }));
        compare(main.shelfScreen.syncText.text, "Syncing…");
        main.endpoint.play(101, stateMessage({ paired: true, online: false, error: "offline",
                                               lastSync: localTime(9, 10) }));
        compare(main.shelfScreen.syncText.text, "Not connected — showing what was synced at 09:10");
        main.endpoint.play(101, stateMessage({ paired: true }));
        compare(main.shelfScreen.syncText.text, "");
        compare(main.endpoint.sent.length, 0);
    }

    // Design §6: a type or a field it does not know changes nothing.
    function test_unknownIgnored() {
        const main = onShelf();
        const revisions = main.shelfScreen.syncLine.revision;
        main.endpoint.play(199, stateMessage({ paired: false }));
        compare(main.shelfScreen.syncText.text, "Synced at 14:32");
        main.endpoint.play(101, stateMessage({ paired: true, lastSync: localTime(14, 32),
                                               somethingNew: 42 }));
        compare(main.shelfScreen.syncText.text, "Synced at 14:32");
        compare(main.shelfScreen.syncLine.revision, revisions);
        compare(main.view, "shelf");
        compare(main.endpoint.sent.length, 0);
    }

    // Design §2: the backend keeps running, and syncing, after the UI unloads.
    function test_unloadingLeavesTheBackendRunning() {
        const main = createTemporaryObject(mainComponent, testCase);
        main.unloading();
        compare(main.endpoint.terminated, false);
    }

    // rm-appload README §Applications' format (signal close, unloading());
    // workflow 19 §The screen (portrait 1404 × 1872).
    function test_rootContract() {
        const main = createTemporaryObject(mainComponent, testCase);
        compare(main.width, 1404);
        compare(main.height, 1872);
        compare(main.endpoint.applicationID, "estante");
        compare(typeof main.unloading, "function");
        closeSpy.target = main;
        main.close();
        compare(closeSpy.count, 1);
        closeSpy.target = null;
        closeSpy.clear();
    }

    // Workflow 19 §Pairing, "approved — 1": a state turning paired on the
    // code page sends `open shelf`; the `103` replaces the page.
    function test_pairingApprovedOpensTheShelf() {
        const main = shown();
        main.endpoint.play(101, stateMessage({}));
        mouseClick(main.notPaired.pairButton);
        main.endpoint.play(102, { code: "KQ7-4TM", url: "https://estantedecifras.app/pair",
                                  expiresAt: localTime(14, 42) });
        compare(main.notPaired.mode, "code");
        main.endpoint.clear();
        main.endpoint.play(101, stateMessage({ paired: true, lastSync: localTime(14, 41) }));
        compare(main.endpoint.sent.length, 1);
        compare(main.endpoint.sent[0].payload, { view: "shelf" });
        compare(visibleScreens(main), ["notPaired"]);
        main.endpoint.play(103, clone(BrowseShelf.shelf));
        compare(visibleScreens(main), ["shelfScreen"]);
        compare(main.shelfScreen.syncText.text, "Synced at 14:41");
    }

    // Rule 5, §The shelf, §When something has changed: a sync while a book is
    // open changes nothing on it; Back opens the shelf, whose `103` (with the
    // book the sync brought) says the new time and shows the new row.
    function test_syncWhileBookOpenWaitsForTheShelf() {
        const main = onShelf();
        main.endpoint.play(104, clone(BrowseBook.book));
        compare(visibleScreens(main), ["bookScreen"]);
        const book = main.bookScreen;
        const revisions = () => [book.bar.revision, book.list.revision, book.letters.revision,
                                 book.foot.revision];
        const before = revisions();
        main.endpoint.play(101, stateMessage({ paired: true, syncing: true, lastSync: localTime(14, 32) }));
        main.endpoint.play(101, stateMessage({ paired: true, lastSync: localTime(14, 40) }));
        compare(revisions(), before);
        compare(visibleScreens(main), ["bookScreen"]);
        compare(main.endpoint.sent.length, 0);
        mouseClick(book.bar.back);
        compare(main.endpoint.sent.length, 1);
        compare(main.endpoint.sent[0].payload, { view: "shelf" });
        const shelf = clone(BrowseShelf.shelf);
        shelf.books.push({ bookId: "bk-new", title: "Brought by the Sync", songs: 3, setlists: 0 });
        main.endpoint.play(103, shelf);
        compare(visibleScreens(main), ["shelfScreen"]);
        compare(main.shelfScreen.syncText.text, "Synced at 14:40");
        compare(main.shelfScreen.rows.count, shelf.books.length);
        const last = main.shelfScreen.rows.itemAt(shelf.books.length - 1);
        compare(last.title, "Brought by the Sync");
        compare(last.detail, "3 songs");
    }

    // Workflow 19 §A book as amended: Back from a song, or a setlist, returns
    // to the book at the page it was left on; from the shelf it opens at its
    // first page.
    function test_backReturnsToThePageLeft() {
        const main = onShelf();
        main.endpoint.play(104, clone(BrowseBook.book));
        mouseClick(main.bookScreen.foot.next);
        mouseClick(main.bookScreen.foot.next);
        compare(main.bookScreen.page, 2);
        const row = main.bookScreen.rows.itemAt(0);
        mouseClick(row);
        compare(main.endpoint.sent[0].payload.view, "song");
        main.endpoint.play(105, clone(FewChords.sheet));
        compare(visibleScreens(main), ["songScreen"]);
        main.endpoint.play(104, clone(BrowseBook.book));
        compare(visibleScreens(main), ["bookScreen"]);
        compare(main.bookScreen.page, 2);
        compare(main.bookScreen.foot.pageLabel.text, "3 of 4");
        // A setlist, then Back: the same.
        mouseClick(main.bookScreen.foot.previous);
        compare(main.bookScreen.page, 1);
        main.endpoint.play(106, clone(BrowseSetlist.setlist));
        compare(visibleScreens(main), ["setlistScreen"]);
        main.endpoint.play(104, clone(BrowseBook.book));
        compare(main.bookScreen.page, 1);
        // Back to the shelf and in again: the first page.
        main.endpoint.play(103, clone(BrowseShelf.shelf));
        main.endpoint.play(104, clone(BrowseBook.book));
        compare(main.bookScreen.page, 0);
    }

    // §Pairing L102, Decision 4: `paired: false` while a song is open changes
    // nothing; the next shelf answered is drawn as Not paired.
    function test_unpairedMidSongWaitsForTheShelf() {
        const main = onShelf();
        main.endpoint.play(105, clone(FewChords.sheet));
        const screen = main.songScreen;
        const revisions = () => [screen.bar.revision, screen.chart.revision, screen.strip.revision,
                                 screen.foot.revision];
        const before = revisions();
        main.endpoint.play(101, stateMessage({ paired: false, error: "signedOut" }));
        compare(revisions(), before);
        compare(visibleScreens(main), ["songScreen"]);
        main.endpoint.play(103, { books: [] });
        compare(visibleScreens(main), ["notPaired"]);
        compare(main.notPaired.mode, "notPaired");
    }

    // §The shelf (Settings), Decision 5: Sign out confirmed, then the
    // unpaired state, shows Not paired at once.
    function test_signOutShowsNotPaired() {
        const main = onShelf();
        main.endpoint.play(107, clone(BrowseSettings.settings));
        compare(visibleScreens(main), ["settingsScreen"]);
        mouseClick(main.settingsScreen.signOutButton);
        mouseClick(main.settingsScreen.confirmButton);
        compare(main.endpoint.sent.length, 1);
        compare(main.endpoint.sent[0].type, 6);
        compare(visibleScreens(main), ["settingsScreen"]);
        main.endpoint.play(101, stateMessage({ paired: false }));
        compare(visibleScreens(main), ["notPaired"]);
        compare(main.notPaired.mode, "notPaired");
    }

    // §Pairing: a `102` is drawn only while the code page is asked for or
    // shown — not on Not paired before Pair is tapped, not on the shelf.
    function test_pairingIgnoredUnlessAsked() {
        const main = shown();
        main.endpoint.play(101, stateMessage({}));
        const revision = main.notPaired.content.revision;
        main.endpoint.play(102, { code: "KQ7-4TM", url: "https://estantedecifras.app/pair",
                                  expiresAt: localTime(14, 42) });
        compare(main.notPaired.mode, "notPaired");
        compare(main.notPaired.content.revision, revision);
        const paired = onShelf();
        paired.endpoint.play(102, { expired: true });
        compare(visibleScreens(paired), ["shelfScreen"]);
        compare(paired.notPaired.mode, "notPaired");
    }

    // reader.song_screen Decision 11 as browse_screens completes it: a
    // played `105 sheet` shows the song screen; a `104 book` after it shows
    // the book, not the song.
    function test_sheetShowsSongScreen() {
        const main = onShelf();
        compare(main.songShown, false);
        main.endpoint.play(105, FewChords.sheet);
        verify(main.songShown);
        compare(visibleScreens(main), ["songScreen"]);
        compare(main.songScreen.bar.title.text, FewChords.sheet.title);
        compare(main.songScreen.bar.keyButton.text, "G");
        main.endpoint.play(104, clone(BrowseBook.book));
        compare(main.songShown, false);
        compare(visibleScreens(main), ["bookScreen"]);
        compare(main.bookScreen.bar.title.text, BrowseBook.book.title);
        // The same song opened again starts at its first page.
        main.endpoint.play(105, FewChords.sheet);
        mouseClick(main.songScreen.foot.next);
        compare(main.songScreen.view.page, 1);
        main.endpoint.play(104, clone(BrowseBook.book));
        main.endpoint.play(105, FewChords.sheet);
        verify(main.songShown);
        compare(main.songScreen.view.page, 0);
    }

    // Design §6 `2 open`: Back sends one open of the song's book.
    function test_backOpensTheBook() {
        const main = shown();
        main.endpoint.play(105, FewChords.sheet);
        main.endpoint.clear();
        mouseClick(main.songScreen.bar.back);
        compare(main.endpoint.sent.length, 1);
        compare(main.endpoint.sent[0].type, 2);
        compare(main.endpoint.sent[0].payload, { view: "book", bookId: FewChords.sheet.bookId });
    }

    SignalSpy {
        id: closeSpy
        signalName: "close"
    }

    // reader.missed_shapes (design §6 108): Main hands a `108 shapes` to the
    // song screen, and nothing else on screen changes — no region of the
    // song, no other screen; the found shape is drawn on the next page. With
    // no song shown, a 108 shows nothing.
    function test_routesShapes() {
        const main = onShelf();
        main.endpoint.play(105, FoundShape.sheet);
        const screen = main.songScreen;
        const chord = FoundShape.sheet.shapes.filter(s => s.model === null)[0].chord;
        const revisions = () => [screen.bar.revision, screen.chart.revision, screen.strip.revision,
                                 screen.foot.revision];
        const before = revisions();
        const shelfRevisions = main.shelfScreen.syncLine.revision;
        main.endpoint.play(108, FoundShape.shapes);
        compare(revisions(), before);
        verify(main.songShown);
        compare(visibleScreens(main), ["songScreen"]);
        compare(main.shelfScreen.syncLine.revision, shelfRevisions);
        compare(screen.sheet.shapes.filter(s => s.chord === chord)[0].model, null);
        mouseClick(screen.foot.next);
        compare(screen.view.page, 1);
        let cell = null;
        for (let n = 0; n < 4 && cell === null; ++n) {
            for (let i = 0; i < screen.strip.diagrams.count; ++i)
                if (screen.strip.diagrams.itemAt(i).shape.chord === chord)
                    cell = screen.strip.diagrams.itemAt(i);
            if (cell === null && screen.strip.stripNext.visible)
                mouseClick(screen.strip.stripNext);
        }
        verify(cell !== null);
        compare(cell.diagram.drawn, true);

        // No song shown: a 108 shows none.
        main.endpoint.play(104, clone(BrowseBook.book));
        const bookRevisions = [main.bookScreen.list.revision, main.bookScreen.foot.revision];
        main.endpoint.play(108, FoundShape.shapes);
        compare(main.songShown, false);
        compare(visibleScreens(main), ["bookScreen"]);
        compare([main.bookScreen.list.revision, main.bookScreen.foot.revision], bookRevisions);
    }

    // reader.play (design §6 109 ahead): Main hands a `109` to the song
    // screen only while it shows a played sheet of the same setlist and book;
    // anywhere else it changes nothing.
    function test_routesAhead() {
        const main = onShelf();
        main.endpoint.play(109, clone(Play1.ahead[0]));
        compare(visibleScreens(main), ["shelfScreen"]);
        compare(main.songScreen.held, { next: null, previous: null });

        // A song not played: ignored.
        main.endpoint.play(105, clone(FewChords.sheet));
        main.endpoint.play(109, clone(Play1.ahead[0]));
        compare(main.songScreen.held, { next: null, previous: null });

        // Played from the setlist on hand: held, nothing redrawn.
        main.endpoint.play(106, clone(BrowseSetlist.setlist));
        main.endpoint.play(105, clone(Play1.sheet));
        verify(main.songShown);
        const screen = main.songScreen;
        const revisions = () => [screen.bar.revision, screen.chart.revision, screen.strip.revision,
                                 screen.foot.revision];
        const before = revisions();
        main.endpoint.play(109, clone(Play1.ahead[0]));
        compare(screen.held.next.path, Play1.ahead[0].path);
        compare(revisions(), before);
        compare(visibleScreens(main), ["songScreen"]);
    }
}
