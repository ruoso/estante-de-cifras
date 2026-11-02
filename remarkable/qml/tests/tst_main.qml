// behavior — the reader's QML root (reader.app_folder): Main.qml, the file
// AppLoad loads, against the AppLoad stand-in. It says hello once, draws
// nothing before the first state, draws each state it is sent as workflow
// 19's line, ignores what it does not know, leaves the backend running when
// it unloads, and has the root's contract AppLoad relies on; a `105 sheet`
// shows the song screen (reader.song_screen Decision 11), whose Back opens
// the book.
import QtQuick
import QtTest
import ".."
import "fixtures/few-chords.js" as FewChords
import "fixtures/found-shape.js" as FoundShape
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

    function stateMessage(fields) {
        return Object.assign({ paired: false, syncing: false, online: true,
                               lastSync: null, shapesShown: true }, fields);
    }

    // A device-local time today, as the backend's RFC 3339 lastSync.
    function localTime(hours, minutes) {
        const t = new Date(2026, 9, 30, hours, minutes, 0);
        return t.toISOString();
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

    // Workflow 19, the refresh budget's rule 1: no intermediate state.
    function test_nothingBeforeState() {
        const main = createTemporaryObject(mainComponent, testCase);
        compare(main.backendState, null);
        compare(main.statusLine.text, "");
        main.endpoint.play(101, stateMessage({}));
        compare(main.statusLine.text, "Not paired");
    }

    // Workflow 19 §The shelf (the sync line) and §Pairing; rule 2, time
    // written as a time.
    function test_showsTheState() {
        const main = createTemporaryObject(mainComponent, testCase);
        main.endpoint.play(101, stateMessage({ paired: false }));
        compare(main.statusLine.text, "Not paired");
        main.endpoint.play(101, stateMessage({ paired: true, lastSync: localTime(14, 32) }));
        compare(main.statusLine.text, "Synced at 14:32");
        main.endpoint.play(101, stateMessage({ paired: true, syncing: true,
                                               lastSync: localTime(14, 32) }));
        compare(main.statusLine.text, "Syncing…");
        main.endpoint.play(101, stateMessage({ paired: true, online: false, error: "offline",
                                               lastSync: localTime(9, 10) }));
        compare(main.statusLine.text, "Not connected — showing what was synced at 09:10");
        main.endpoint.play(101, stateMessage({ paired: true }));
        compare(main.statusLine.text, "");
    }

    // Design §6: a type or a field it does not know changes nothing.
    function test_unknownIgnored() {
        const main = createTemporaryObject(mainComponent, testCase);
        main.endpoint.play(101, stateMessage({ paired: true, lastSync: localTime(14, 32) }));
        main.endpoint.clear();
        main.endpoint.play(199, stateMessage({ paired: false }));
        compare(main.statusLine.text, "Synced at 14:32");
        main.endpoint.play(101, stateMessage({ paired: true, lastSync: localTime(14, 32),
                                               somethingNew: 42 }));
        compare(main.statusLine.text, "Synced at 14:32");
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

    // reader.song_screen Decision 11: a played `105 sheet` shows the song
    // screen; another view (here `104 book`) hides it again, until
    // reader.browse_screens draws those views.
    function test_sheetShowsSongScreen() {
        // In the window's root, which is shown, so what is visible is drawn.
        const main = createTemporaryObject(mainComponent, testCase.parent);
        main.endpoint.play(101, stateMessage({ paired: true, lastSync: localTime(14, 32) }));
        compare(main.songShown, false);
        verify(main.statusLine.visible);
        verify(!main.songScreen.visible);
        main.endpoint.play(105, FewChords.sheet);
        verify(main.songShown);
        verify(main.songScreen.visible);
        compare(main.songScreen.bar.title.text, FewChords.sheet.title);
        compare(main.songScreen.bar.keyButton.text, "G");
        verify(!main.statusLine.visible);
        main.endpoint.play(104, { bookId: FewChords.sheet.bookId, title: "A book", songs: [], setlists: [] });
        compare(main.songShown, false);
        verify(!main.songScreen.visible);
        verify(main.statusLine.visible);
        compare(main.statusLine.text, "Synced at 14:32");
        // The same song opened again starts at its first page.
        main.endpoint.play(105, FewChords.sheet);
        mouseClick(main.songScreen.foot.next);
        compare(main.songScreen.view.page, 1);
        main.endpoint.play(104, { bookId: FewChords.sheet.bookId, title: "A book", songs: [], setlists: [] });
        main.endpoint.play(105, FewChords.sheet);
        verify(main.songShown);
        compare(main.songScreen.view.page, 0);
    }

    // Design §6 `2 open`: Back sends one open of the song's book.
    function test_backOpensTheBook() {
        const main = createTemporaryObject(mainComponent, testCase.parent);
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
    // song, not the status line; the found shape is drawn on the next page.
    // With no song shown, a 108 shows nothing.
    function test_routesShapes() {
        const main = createTemporaryObject(mainComponent, testCase.parent);
        main.endpoint.play(101, stateMessage({ paired: true, lastSync: localTime(14, 32) }));
        main.endpoint.play(105, FoundShape.sheet);
        const screen = main.songScreen;
        const chord = FoundShape.sheet.shapes.filter(s => s.model === null)[0].chord;
        const revisions = () => [screen.bar.revision, screen.chart.revision, screen.strip.revision,
                                 screen.foot.revision];
        const before = revisions();
        const status = main.statusLine.text;
        main.endpoint.play(108, FoundShape.shapes);
        compare(revisions(), before);
        verify(main.songShown);
        verify(screen.visible);
        verify(!main.statusLine.visible);
        compare(main.statusLine.text, status);
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
        main.endpoint.play(104, { bookId: FoundShape.sheet.bookId, title: "A book", songs: [], setlists: [] });
        main.endpoint.play(108, FoundShape.shapes);
        compare(main.songShown, false);
        verify(!screen.visible);
        verify(main.statusLine.visible);
    }
}
