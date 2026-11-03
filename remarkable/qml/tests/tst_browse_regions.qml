// behavior — each browse action replaces only its regions, once
// (reader.browse_screens; workflow 19 §What it costs, rules 1, 4, 5 and 7).
// As tst_song_regions.qml does it (reader.song_screen Decision 2): by pixels
// — grabImage of each region before and after, equal where the table says
// untouched — and by `revision`, exactly +1 per replaced region per action,
// so no intermediate state is drawn.
//
// grabImage crops the window's grab at the item's own x and y, so every grab
// goes through a probe item hosted in the window's root at the scene
// rectangle wanted (the screens are hosted there too, at 0, 0).
import QtQuick
import QtTest
import net.asivery.AppLoad 1.0
import ".."
import "../browse"
import "fixtures/browse-shelf.js" as BrowseShelf
import "fixtures/browse-book.js" as BrowseBook
import "fixtures/browse-setlist.js" as BrowseSetlist
import "fixtures/browse-settings.js" as BrowseSettings
import "fixtures/found-shape.js" as FoundShape

TestCase {
    id: testCase
    name: "BrowseRegions"
    when: windowShown
    width: 1404
    height: 1872

    Component {
        id: endpointComponent
        AppLoad {
            applicationID: "estante"
        }
    }

    Component { id: mainComponent; Main {} }
    Component { id: bookComponent; BookScreen {} }
    Component { id: shelfComponent; ShelfScreen {} }
    Component { id: settingsComponent; SettingsScreen {} }
    Component { id: notPairedComponent; NotPaired {} }
    Component { id: probeComponent; Item {} }

    function clone(x) {
        return JSON.parse(JSON.stringify(x));
    }

    function localTime(hours, minutes) {
        return new Date(2026, 9, 30, hours, minutes, 0).toISOString();
    }

    function stateMessage(fields) {
        return Object.assign({ paired: true, syncing: false, online: true,
                               lastSync: localTime(14, 32), shapesShown: true }, fields);
    }

    function make(component) {
        const endpoint = createTemporaryObject(endpointComponent, testCase);
        const screen = createTemporaryObject(component, testCase.parent, { endpoint: endpoint });
        verify(screen !== null);
        tryVerify(() => screen.faces.ready);
        return screen;
    }

    // Main paired, on the shelf; the window's root shows it.
    function main() {
        const m = createTemporaryObject(mainComponent, testCase.parent);
        m.endpoint.play(101, stateMessage({}));
        m.endpoint.play(103, clone(BrowseShelf.shelf));
        tryVerify(() => m.shelfScreen.faces.ready);
        m.endpoint.clear();
        return m;
    }

    // The window's pixels in a scene rectangle.
    function grabRect(x, y, w, h) {
        const probe = probeComponent.createObject(testCase.parent, { x: x, y: y, width: w, height: h });
        const image = grabImage(probe);
        probe.destroy();
        return image;
    }

    function grab(item) {
        const at = item.mapToItem(null, 0, 0);
        return grabRect(Math.round(at.x), Math.round(at.y), item.width, item.height);
    }

    // The named regions' pixels and revisions now.
    // Settings' content region holds Account, Sync and This reader around
    // the Shapes region, so its pixels are read part by part.
    function pixelNames(screen, names) {
        const out = [];
        for (const n of names) {
            if (n === "content" && screen.objectName === "settingsScreen")
                out.push("accountPart", "syncPart", "readerPart");
            else
                out.push(n);
        }
        return out;
    }

    function snapshot(screen, names) {
        waitForRendering(screen);
        const s = { names: names, revisions: {}, pixels: {} };
        for (const name of names)
            s.revisions[name] = screen[name].revision;
        for (const name of pixelNames(screen, names))
            s.pixels[name] = screen[name].visible && screen[name].height > 0 ? grab(screen[name]) : null;
        return s;
    }

    function moved(before, screen) {
        const out = {};
        for (const name of before.names)
            out[name] = screen[name].revision - before.revisions[name];
        return out;
    }

    function samePixels(before, screen, names) {
        waitForRendering(screen);
        for (const name of pixelNames(screen, names)) {
            verify(before.pixels[name] !== null, name);
            verify(grab(screen[name]).equals(before.pixels[name]), name + "'s pixels changed");
        }
    }

    function changedPixels(before, screen, name) {
        waitForRendering(screen);
        verify(!grab(screen[name]).equals(before.pixels[name]), name + "'s pixels did not change");
    }

    function zeros(names) {
        const out = {};
        for (const n of names)
            out[n] = 0;
        return out;
    }

    readonly property var bookRegions: ["bar", "list", "letters", "foot"];
    readonly property var shelfRegions: ["bar", "syncLine", "list", "foot"];
    readonly property var setlistRegions: ["bar", "list", "foot"];
    readonly property var settingsRegions: ["bar", "content", "shapes", "signOut"];
    readonly property var pairingRegions: ["bar", "content", "foot"];

    // Costs table: turn a page — content and foot; a letter — content and
    // foot. The bar and the letters untouched.
    function test_bookTurnAndLetter() {
        const screen = make(bookComponent);
        screen.show(clone(BrowseBook.book), 0);
        let before = snapshot(screen, bookRegions);
        mouseClick(screen.foot.next);
        compare(moved(before, screen), { bar: 0, list: 1, letters: 0, foot: 1 });
        samePixels(before, screen, ["bar", "letters"]);
        changedPixels(before, screen, "list");
        changedPixels(before, screen, "foot");
        before = snapshot(screen, bookRegions);
        mouseClick(screen.letters.cell("T").button);
        verify(screen.page !== 1);
        compare(moved(before, screen), { bar: 0, list: 1, letters: 0, foot: 1 });
        samePixels(before, screen, ["bar", "letters"]);
        changedPixels(before, screen, "list");
    }

    // Costs table: Sync, on the shelf — 2, one line. The bar, the list and
    // the foot untouched; a state whose line is the same redraws nothing.
    function test_syncOnTheShelfOnlyTheLine() {
        const m = main();
        const screen = m.shelfScreen;
        let before = snapshot(screen, shelfRegions);
        m.endpoint.play(101, stateMessage({ syncing: true }));
        compare(moved(before, screen), { bar: 0, syncLine: 1, list: 0, foot: 0 });
        samePixels(before, screen, ["bar", "list", "foot"]);
        changedPixels(before, screen, "syncLine");
        const syncing = snapshot(screen, shelfRegions);
        m.endpoint.play(101, stateMessage({ syncing: false, lastSync: localTime(14, 40) }));
        compare(moved(syncing, screen), { bar: 0, syncLine: 1, list: 0, foot: 0 });
        samePixels(syncing, screen, ["bar", "list", "foot"]);
        compare(screen.syncText.text, "Synced at 14:40");
        const done = snapshot(screen, shelfRegions);
        m.endpoint.play(101, stateMessage({ lastSync: localTime(14, 40) }));
        compare(moved(done, screen), zeros(shelfRegions));
        samePixels(done, screen, shelfRegions);
    }

    // Rule 5, costs table: Sync anywhere else — 0. The same states on a
    // book, a setlist and Settings change nothing.
    function test_syncElsewhereChangesNothing() {
        const m = main();
        const cases = [
            [104, BrowseBook.book, m.bookScreen, bookRegions],
            [106, BrowseSetlist.setlist, m.setlistScreen, setlistRegions],
            [107, BrowseSettings.settings, m.settingsScreen, settingsRegions]
        ];
        for (const [type, payload, screen, names] of cases) {
            m.endpoint.play(type, clone(payload));
            verify(screen.visible);
            const opened = m.settingsScreen.syncPart.valueText.text;
            const before = snapshot(screen, names);
            m.endpoint.play(101, stateMessage({ syncing: true }));
            m.endpoint.play(101, stateMessage({ syncing: false, lastSync: localTime(14, 50) }));
            compare(moved(before, screen), zeros(names), String(type));
            samePixels(before, screen, names.filter(n => n === "content" || before.pixels[n] !== null));
            verify(screen.visible);
            // Settings keeps the line it opened with (Decision 6).
            if (type === 107) {
                compare(opened, "Synced at 14:50");
                compare(m.settingsScreen.syncPart.valueText.text, opened);
            }
        }
    }

    // §The shelf, Settings: Show all again's `107` replaces the Shapes line
    // only; Sign out's question, and Cancel, the sign-out part only.
    function test_settingsParts() {
        const m = main();
        m.endpoint.play(107, clone(BrowseSettings.settings));
        const screen = m.settingsScreen;
        let before = snapshot(screen, settingsRegions);
        mouseClick(screen.showAllButton);
        compare(m.endpoint.sent[0].type, 9);
        compare(moved(before, screen), zeros(settingsRegions));
        const none = clone(BrowseSettings.settings);
        none.hiddenShapes = 0;
        m.endpoint.play(107, none);
        compare(moved(before, screen), { bar: 0, content: 0, shapes: 1, signOut: 0 });
        samePixels(before, screen, ["bar", "content", "signOut"]);
        changedPixels(before, screen, "shapes");
        compare(screen.shapesText.text, "No shapes hidden.");

        before = snapshot(screen, settingsRegions);
        mouseClick(screen.signOutButton);
        compare(moved(before, screen), { bar: 0, content: 0, shapes: 0, signOut: 1 });
        samePixels(before, screen, ["bar", "content", "shapes"]);
        changedPixels(before, screen, "signOut");
        const asking = snapshot(screen, settingsRegions);
        mouseClick(screen.cancelButton);
        compare(moved(asking, screen), { bar: 0, content: 0, shapes: 0, signOut: 1 });
        samePixels(before, screen, settingsRegions);
    }

    // Rule 7: pressing a control makes it black at once — a pixel of its
    // paper reads black — and no region's revision moves, the rest of its
    // region keeping its pixels.
    function pressAndCheck(screen, names, control, region) {
        const before = snapshot(screen, names);
        const paper = 6;
        const at = [Math.floor(control.width / 2), paper];
        compare(grab(control).pixel(at[0], at[1]), Qt.color("white"), String(control));
        const aroundBefore = around(screen[region], control);
        mousePress(control);
        waitForRendering(screen);
        compare(grab(control).pixel(at[0], at[1]), Qt.color("black"), String(control));
        sameImages(around(screen[region], control), aroundBefore, String(control));
        compare(moved(before, screen), zeros(names), String(control) + " pressed");
        samePixels(before, screen, names.filter(n => n !== region && (n === "content" || before.pixels[n] !== null)));
        // Let go far from where it was pressed, straight up or down: no tap,
        // no swipe.
        const sceneY = control.mapToItem(null, 0, 0).y;
        const away = sceneY > 400 ? -300 : control.height + 300;
        mouseMove(control, at[0], away);
        mouseRelease(control, at[0], away);
        waitForRendering(screen);
        compare(moved(before, screen), zeros(names), String(control) + " released");
    }

    // A region's pixels outside a control's rectangle.
    function around(region, control) {
        const r = region.mapToItem(null, 0, 0);
        const c = control.mapToItem(null, 0, 0);
        const rx = Math.round(r.x), ry = Math.round(r.y);
        const cx = Math.round(c.x), cy = Math.round(c.y);
        const bands = [
            [rx, ry, region.width, cy - ry],
            [rx, cy + control.height, region.width, ry + region.height - cy - control.height],
            [rx, cy, cx - rx, control.height],
            [cx + control.width, cy, rx + region.width - cx - control.width, control.height]
        ];
        return bands.filter(b => b[2] > 0 && b[3] > 0).map(b => grabRect(b[0], b[1], b[2], b[3]));
    }

    function sameImages(a, b, what) {
        compare(a.length, b.length, what);
        for (let i = 0; i < a.length; ++i)
            verify(a[i].equals(b[i]), what + ": band " + i + " changed");
    }

    function test_pressInvertsOnlyTheControl() {
        const book = make(bookComponent);
        book.show(clone(BrowseBook.book), 0);
        pressAndCheck(book, bookRegions, book.rows.itemAt(4), "list");
        pressAndCheck(book, bookRegions, book.letters.cell("M").button, "letters");
        pressAndCheck(book, bookRegions, book.foot.next, "foot");
        pressAndCheck(book, bookRegions, book.bar.back, "bar");
        compare(book.endpoint.sent.length, 0);
        book.visible = false;

        const shelf = make(shelfComponent);
        shelf.show(clone(BrowseShelf.shelf), stateMessage({}), 0);
        pressAndCheck(shelf, shelfRegions, shelf.bar.action, "bar");
        pressAndCheck(shelf, shelfRegions, shelf.rows.itemAt(1), "list");
        pressAndCheck(shelf, shelfRegions, shelf.foot.leftButton, "foot");
        shelf.visible = false;

        const settings = make(settingsComponent);
        settings.show(clone(BrowseSettings.settings), stateMessage({}));
        pressAndCheck(settings, settingsRegions, settings.showAllButton, "shapes");
        pressAndCheck(settings, settingsRegions, settings.signOutButton, "signOut");
        settings.visible = false;

        const pairing = make(notPairedComponent);
        pairing.show();
        pressAndCheck(pairing, pairingRegions, pairing.pairButton, "content");
    }

    // A row tapped stays inverted, nothing else replaced, until its answer
    // replaces the screen (rule 7, "the tapped row inverted meanwhile").
    function test_tappedRowHeldUntilTheAnswer() {
        const m = main();
        const screen = m.shelfScreen;
        const before = snapshot(screen, shelfRegions);
        const row = screen.rows.itemAt(0);
        mouseClick(row);
        waitForRendering(screen);
        verify(row.inverted);
        compare(moved(before, screen), zeros(shelfRegions));
        samePixels(before, screen, ["bar", "syncLine", "foot"]);
        verify(screen.visible);
        m.endpoint.play(104, clone(BrowseBook.book));
        verify(!screen.visible);
        verify(m.bookScreen.visible);
    }

    // §Pairing, "the page then stays still": an unpaired state, sync
    // changes and a `108` change nothing on it; a `102` replaces the content
    // once.
    function test_pairingPageStaysStill() {
        const m = createTemporaryObject(mainComponent, testCase.parent);
        m.endpoint.play(101, stateMessage({ paired: false, lastSync: null }));
        const screen = m.notPaired;
        tryVerify(() => screen.faces.ready);
        verify(screen.visible);
        mouseClick(screen.pairButton);
        m.endpoint.play(102, { code: "KQ7-4TM", url: "https://estantedecifras.app/pair",
                               expiresAt: localTime(14, 42) });
        compare(screen.mode, "code");
        let before = snapshot(screen, pairingRegions);
        m.endpoint.play(101, stateMessage({ paired: false, lastSync: null }));
        m.endpoint.play(101, stateMessage({ paired: false, syncing: true, lastSync: null }));
        m.endpoint.play(101, stateMessage({ paired: false, syncing: false, lastSync: localTime(9, 0) }));
        m.endpoint.play(108, FoundShape.shapes);
        compare(moved(before, screen), zeros(pairingRegions));
        samePixels(before, screen, pairingRegions);
        verify(screen.visible);
        m.endpoint.play(102, { expired: true });
        compare(moved(before, screen), { bar: 0, content: 1, foot: 0 });
        samePixels(before, screen, ["bar", "foot"]);
        changedPixels(before, screen, "content");
    }
}
