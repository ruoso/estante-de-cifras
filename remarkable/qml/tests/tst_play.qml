// behavior — playing a setlist through (reader.play; workflow 19 §A setlist
// as amended, the refresh budget's rules 1, 5, 7 and 9, §What it costs "Turn
// a page (and a song, in Play) — 1"; workflow 12 §The key, §Playing through;
// cifra.md §10.7.1, §10.7.2, §10.8.2). Main.qml against the AppLoad stand-in,
// driven by the backend's own answers: the browse setlist's `106`
// (browse-setlist.js) and, for items of it opened playing, each `105` and the
// `109 ahead`s that followed it (play-<at>.js, TestQMLFixtures). In that
// setlist item 2 (*Canção Perdida*) is missing, and item 4 (*Domingo Cedo*,
// a song with no key) is given the key D.
import QtQuick
import QtTest
import ".."
import "../browse/pages.js" as Pages
import "fixtures/browse-setlist.js" as BrowseSetlist
import "fixtures/few-chords.js" as FewChords
import "fixtures/choro-long.js" as ChoroLong
import "fixtures/play-0.js" as Play0
import "fixtures/play-1.js" as Play1
import "fixtures/play-3.js" as Play3
import "fixtures/play-4.js" as Play4
import "fixtures/play-12.js" as Play12
import "fixtures/play-13.js" as Play13
import "walk.js" as Walk

TestCase {
    id: testCase
    name: "Play"
    when: windowShown
    width: 1404
    height: 1872

    Component {
        id: mainComponent
        Main {}
    }

    readonly property string bookId: BrowseSetlist.setlist.bookId
    readonly property string setlistPath: BrowseSetlist.setlist.path

    function clone(x) {
        return JSON.parse(JSON.stringify(x));
    }

    // Main paired, on the browse setlist, nothing sent since.
    function onSetlist(setlist) {
        const main = createTemporaryObject(mainComponent, testCase.parent);
        main.endpoint.play(101, { paired: true, syncing: false, online: true, lastSync: null, shapesShown: true });
        main.endpoint.play(106, clone(setlist || BrowseSetlist.setlist));
        compare(main.view, "setlist");
        tryVerify(() => main.setlistScreen.faces.ready);
        main.endpoint.clear();
        return main;
    }

    // The backend's answer to a played open: the `105`, then (unless
    // `aheads` is false) its `109`s.
    function answer(main, fixture, aheads) {
        main.endpoint.play(105, clone(fixture.sheet));
        tryVerify(() => main.songScreen.view.pageCount > 0);
        if (aheads !== false)
            for (const a of fixture.ahead)
                main.endpoint.play(109, clone(a));
        compare(main.view, "song");
    }

    // Main playing a fixture's item, nothing sent since.
    function playing(fixture, aheads) {
        const main = onSetlist();
        answer(main, fixture, aheads);
        main.endpoint.clear();
        return main;
    }

    function rows(screen) {
        const out = [];
        for (let i = 0; i < screen.rows.count; ++i)
            out.push(screen.rows.itemAt(i));
        return out;
    }

    function revisions(screen) {
        return { bar: screen.bar.revision, chart: screen.chart.revision, strip: screen.strip.revision,
                 foot: screen.foot.revision };
    }

    function moved(before, screen) {
        const now = revisions(screen);
        const out = {};
        for (const k in now)
            out[k] = now[k] - before[k];
        return out;
    }

    function paragraphs(view, page) {
        return Walk.named(view.pageItem(page), "notesParagraph").map(t => t.text);
    }

    function goToLastPage(screen) {
        const view = screen.view;
        while (view.page < view.pageCount - 1)
            mouseClick(screen.foot.next);
    }

    function sentPayloads(main, type) {
        return main.endpoint.sent.filter(m => m.type === type).map(m => m.payload);
    }

    // §A setlist: Play opens the first playable item, playing; it inverts
    // when pressed and stays inverted until the answer (rule 7). A setlist
    // with nothing playable has no Play (§10.8.2).
    function test_playOpensFirst() {
        const main = onSetlist();
        const play = main.setlistScreen.bar.action;
        verify(play.visible);
        compare(play.text, "Play");
        mousePress(play);
        verify(play.inverted);
        compare(main.endpoint.sent.length, 0);
        mouseRelease(play);
        verify(play.inverted);
        compare(main.endpoint.sent.length, 1);
        compare(main.endpoint.sent[0].type, 2);
        compare(main.endpoint.sent[0].payload, {
            view: "song", bookId: bookId, path: BrowseSetlist.setlist.items[0].path,
            play: { setlist: setlistPath, at: 0 }
        });

        // A first item missing: Play opens the first playable one.
        const gap = clone(BrowseSetlist.setlist);
        gap.items[0].missing = true;
        const other = onSetlist(gap);
        mouseClick(other.setlistScreen.bar.action);
        compare(other.endpoint.sent[0].payload.play, { setlist: setlistPath, at: 1 });

        // Nothing to play: every item missing, or none.
        const none = clone(BrowseSetlist.setlist);
        for (const it of none.items)
            it.missing = true;
        verify(!onSetlist(none).setlistScreen.bar.action.visible);
        const empty = clone(BrowseSetlist.setlist);
        empty.items = [];
        verify(!onSetlist(empty).setlistScreen.bar.action.visible);
    }

    // §A setlist: a playable row opens Play at it; a missing row is not a
    // target — no inversion, nothing sent (reader.play Decision 3).
    function test_rowOpensPlayAtIt() {
        const main = onSetlist();
        const r = rows(main.setlistScreen);
        compare(r[2].rightWord, "missing");
        mousePress(r[2]);
        verify(!r[2].inverted);
        mouseRelease(r[2]);
        verify(!r[2].inverted);
        compare(main.endpoint.sent.length, 0);

        mousePress(r[5]);
        verify(r[5].inverted);
        mouseRelease(r[5]);
        verify(r[5].inverted);
        compare(main.endpoint.sent.length, 1);
        compare(main.endpoint.sent[0].payload, {
            view: "song", bookId: bookId, path: BrowseSetlist.setlist.items[5].path,
            play: { setlist: setlistPath, at: 5 }
        });
        // Its open on its way, nothing else is sent.
        mouseClick(r[6]);
        mouseClick(main.setlistScreen.bar.action);
        compare(main.endpoint.sent.length, 1);
    }

    // §A setlist: the bar reads *n of m · Title*, n counting only playable
    // rows (the missing item 2 shifts the songs after it); the key button
    // shows the setlist's key (workflow 12 §The key).
    function test_barPlace() {
        const main = playing(Play0);
        const bar = main.songScreen.bar;
        compare(bar.title.text, "1 of 13 · Ária do Porto");
        compare(BrowseSetlist.setlist.items[0].key, "D");
        compare(Play0.sheet.key.named, "D");
        verify(bar.keyButton.text.startsWith("D"));
        answer(main, Play1);
        compare(bar.title.text, "2 of 13 · Balanço da Rede");
        answer(main, Play3);
        compare(bar.title.text, "3 of 13 · Chuva de Agosto");
        compare(BrowseSetlist.setlist.items[3].key, "C");
        verify(bar.keyButton.text.startsWith("C"));
        answer(main, Play13);
        compare(bar.title.text, "13 of 13 · Zabumba na Praça");
    }

    // §10.7.1, §10.7.2, workflow 19 §A setlist as amended: the item's note,
    // and *key: D* for the keyless song the setlist gives D, open its first
    // page; the key button still names the key the chart is read in.
    function test_firstPageNoteAndKeyNote() {
        const main = playing(Play0);
        const screen = main.songScreen;
        compare(screen.view.sheet.rows[0].type, "notes");
        compare(paragraphs(screen.view, 0)[0], "start soft, let the intro ring");

        answer(main, Play4);
        compare(Play4.sheet.keyNote, "D");
        compare(Play4.sheet.key.written, null);
        compare(screen.view.page, 0);
        compare(screen.view.sheet.rows[0].type, "notes");
        compare(screen.view.sheet.rows[0].paragraphs, ["key: D"]);
        compare(paragraphs(screen.view, 0)[0], "key: D");
        compare(screen.bar.keyButton.text, Play4.sheet.key.named);
        verify(!screen.bar.keyButton.text.startsWith("D"));

        // A song with neither: its first row is its own.
        answer(main, Play1);
        compare(screen.view.sheet.rows[0], Play1.sheet.rows[0]);
    }

    // Workflow 19 §A setlist, third bullet: the last page ends with *Next:
    // Title, in G* and the next item's note, or *Next: Title* when the
    // setlist sets it no key; the last item has none, and its foot says End.
    function test_nextLineWithNote() {
        const main = playing(Play4);
        const screen = main.songScreen;
        goToLastPage(screen);
        let drawn = paragraphs(screen.view, screen.view.page);
        compare(drawn.slice(-2), ["Next: Eco do Morro", "slower than the record"]);
        verify(!screen.foot.pageLabel.text.endsWith("End"));

        answer(main, Play1);
        goToLastPage(screen);
        drawn = paragraphs(screen.view, screen.view.page);
        compare(drawn[drawn.length - 1], "Next: Chuva de Agosto, in C");

        answer(main, Play13);
        goToLastPage(screen);
        drawn = paragraphs(screen.view, screen.view.page);
        verify(drawn.every(t => !t.startsWith("Next:")));
        verify(screen.foot.pageLabel.text.endsWith(" · End"));
    }

    // Rule 9: after the `109`, the invisible view has built the next song's
    // first page before any turn; the turn builds no page on screen.
    function test_nextSongReadyBeforeTurn() {
        const main = playing(Play1);
        const screen = main.songScreen;
        const ahead = screen.aheadView;
        verify(ahead !== screen.view);
        verify(!ahead.visible);
        compare(ahead.sheet.path, Play3.sheet.path);
        compare(ahead.page, 0);
        verify(ahead.pagesBuilt >= 1);
        verify(ahead.pageItem(0) !== null);
        const built = ahead.pagesBuilt;
        goToLastPage(screen);
        mouseClick(screen.foot.next);
        compare(screen.view, ahead);
        verify(screen.view.visible);
        compare(screen.view.sheet.path, Play3.sheet.path);
        compare(screen.view.pagesBuilt, built);
    }

    // Cost table: "Turn a page (and a song, in Play) — 1": next across songs
    // replaces the chart, strip and foot once each and the bar (its title)
    // once; previous lands on the previous song's last page, once too; each
    // then sends `11 place` with the new item.
    function test_acrossSongsOneRedraw() {
        const main = playing(Play1);
        const screen = main.songScreen;
        goToLastPage(screen);
        let before = revisions(screen);
        mouseClick(screen.foot.next);
        compare(moved(before, screen), { bar: 1, chart: 1, strip: 1, foot: 1 });
        compare(screen.bar.title.text, "3 of 13 · Chuva de Agosto");
        compare(screen.view.page, 0);
        compare(sentPayloads(main, 11), [{ bookId: bookId, setlist: setlistPath, at: 3 }]);
        compare(sentPayloads(main, 2), []);

        // The backend's neighbours of item 3; the previous one, item 1, made
        // long enough for pages, so its last page is not its first.
        main.endpoint.clear();
        const ahead = clone(Play3.ahead);
        compare(ahead[1].play.at, 1);
        ahead[1].rows = clone(ChoroLong.sheet.rows);
        ahead[1].shapes = clone(ChoroLong.sheet.shapes);
        for (const a of ahead)
            main.endpoint.play(109, a);
        compare(screen.view.page, 0);
        before = revisions(screen);
        mouseClick(screen.foot.previous);
        compare(moved(before, screen), { bar: 1, chart: 1, strip: 1, foot: 1 });
        compare(screen.bar.title.text, "2 of 13 · Balanço da Rede");
        verify(screen.view.pageCount > 1);
        compare(screen.view.page, screen.view.pageCount - 1);
        compare(sentPayloads(main, 11), [{ bookId: bookId, setlist: setlistPath, at: 1 }]);
        compare(sentPayloads(main, 2), []);
    }

    // §10.8.2, workflow 12: from item 1 (*2 of 13*), next lands on item 3;
    // the missing item 2 is never opened, and no open or place names it.
    function test_missingSkipped() {
        const main = playing(Play1);
        const screen = main.songScreen;
        compare(screen.bar.title.text, "2 of 13 · Balanço da Rede");
        goToLastPage(screen);
        mouseClick(screen.foot.next);
        compare(screen.view.sheet.play.at, 3);
        compare(screen.bar.title.text, "3 of 13 · Chuva de Agosto");
        for (const m of main.endpoint.sent) {
            verify(m.payload.at !== 2, "a place names the missing item");
            verify(!m.payload.play || m.payload.play.at !== 2, "an open names the missing item");
        }
        // Back again: item 1, not 2.
        for (const a of Play3.ahead)
            main.endpoint.play(109, clone(a));
        mouseClick(screen.foot.previous);
        compare(screen.view.sheet.play.at, 1);
        for (const m of main.endpoint.sent)
            verify(m.payload.at !== 2 && (!m.payload.play || m.payload.play.at !== 2));
    }

    // Rule 1: a turn with no `109` held opens the neighbour (and sends its
    // place) and leaves every region as it is until the `105`, which then
    // replaces each once.
    function test_turnBeforeAheadWaits() {
        const main = playing(Play1, false);
        const screen = main.songScreen;
        compare(screen.held.next, null);
        goToLastPage(screen);
        const before = revisions(screen);
        mouseClick(screen.foot.next);
        compare(moved(before, screen), { bar: 0, chart: 0, strip: 0, foot: 0 });
        compare(screen.bar.title.text, "2 of 13 · Balanço da Rede");
        compare(sentPayloads(main, 2), [{
            view: "song", bookId: bookId, path: Play3.sheet.path, play: { setlist: setlistPath, at: 3 }
        }]);
        compare(sentPayloads(main, 11), [{ bookId: bookId, setlist: setlistPath, at: 3 }]);
        // Another turn meanwhile asks nothing more.
        mouseClick(screen.foot.next);
        compare(main.endpoint.sent.length, 2);
        main.endpoint.play(105, clone(Play3.sheet));
        compare(moved(before, screen), { bar: 1, chart: 1, strip: 1, foot: 1 });
        compare(screen.bar.title.text, "3 of 13 · Chuva de Agosto");
        compare(main.endpoint.sent.length, 2);
    }

    // Workflow 19 §A setlist: Back sends `open setlist`; its `106` with the
    // place (at 12) opens on the page holding it. Back from a song not
    // played still opens the book.
    function test_backToSetlistAtSong() {
        const main = playing(Play12);
        mouseClick(main.songScreen.bar.back);
        compare(main.endpoint.sent.length, 1);
        compare(main.endpoint.sent[0].payload, { view: "setlist", bookId: bookId, path: setlistPath });
        const set = clone(BrowseSetlist.setlist);
        set.at = 12;
        main.endpoint.play(106, set);
        compare(main.view, "setlist");
        compare(main.setlistScreen.page, 1);
        compare(main.setlistScreen.foot.pageLabel.text, "2 of 2");
        verify(rows(main.setlistScreen).map(r => r.title).indexOf("Pandeiro Novo") >= 0);

        main.endpoint.play(105, clone(FewChords.sheet));
        compare(main.view, "song");
        main.endpoint.clear();
        mouseClick(main.songScreen.bar.back);
        compare(main.endpoint.sent[0].payload, { view: "book", bookId: FewChords.sheet.bookId });
    }

    // Rule 5: a `109` with no played song on screen, or for another setlist,
    // changes nothing; a `108` for a held neighbour changes nothing either.
    function test_aheadIgnoredOutsidePlay() {
        const main = onSetlist();
        const list = [main.setlistScreen.bar.revision, main.setlistScreen.list.revision,
                      main.setlistScreen.foot.revision];
        main.endpoint.play(109, clone(Play1.ahead[0]));
        compare(main.view, "setlist");
        compare([main.setlistScreen.bar.revision, main.setlistScreen.list.revision,
                 main.setlistScreen.foot.revision], list);
        compare(main.songScreen.held.next, null);

        // A song not played.
        main.endpoint.play(105, clone(FewChords.sheet));
        tryVerify(() => main.songScreen.view.pageCount > 0);
        let before = revisions(main.songScreen);
        main.endpoint.play(109, clone(Play1.ahead[0]));
        compare(main.songScreen.held, { next: null, previous: null });
        compare(moved(before, main.songScreen), { bar: 0, chart: 0, strip: 0, foot: 0 });

        // Played, a 109 of another setlist, or for an item not beside it.
        answer(main, Play1, false);
        const screen = main.songScreen;
        before = revisions(screen);
        const other = clone(Play1.ahead[0]);
        other.play.setlist = "another.setlist.md";
        main.endpoint.play(109, other);
        main.endpoint.play(109, clone(Play4.ahead[0]));
        compare(screen.held, { next: null, previous: null });
        compare(moved(before, screen), { bar: 0, chart: 0, strip: 0, foot: 0 });

        // A 108 for a held neighbour.
        main.endpoint.play(109, clone(Play1.ahead[0]));
        const held = screen.held.next;
        compare(held.path, Play3.sheet.path);
        before = revisions(screen);
        const shown = screen.sheet;
        main.endpoint.play(108, { bookId: held.bookId, path: held.path, offset: held.offset,
                                  tuningId: held.tuningId, shapes: clone(held.shapes) });
        compare(moved(before, screen), { bar: 0, chart: 0, strip: 0, foot: 0 });
        compare(screen.held.next, held);
        compare(screen.sheet, shown);
    }

    // The pages.js helpers (reader.play Constraint 1): the first, next and
    // previous playable rows and the position, over rows missing at the
    // start, in the middle and at the end; the bar's and the last page's
    // words.
    function test_playHelpers() {
        const rows = [
            { path: "gone.cifra.md", missing: true },
            { path: "a.cifra.md", missing: false },
            { path: "", missing: true },
            { path: "b.cifra.md", missing: false },
            { path: "a.cifra.md", missing: false },
            { path: "lost.cifra.md", missing: true }
        ];
        compare(Pages.firstPlayable(rows), 1);
        compare(Pages.nextPlayable(rows, 1), 3);
        compare(Pages.nextPlayable(rows, 3), 4);
        compare(Pages.nextPlayable(rows, 4), -1);
        compare(Pages.previousPlayable(rows, 4), 3);
        compare(Pages.previousPlayable(rows, 3), 1);
        compare(Pages.previousPlayable(rows, 1), -1);
        compare(Pages.position(rows, 1), 1);
        compare(Pages.position(rows, 3), 2);
        compare(Pages.position(rows, 4), 3);
        compare(Pages.position(rows, 2), 0);
        compare(Pages.firstPlayable([{ path: "", missing: true }]), -1);
        compare(Pages.firstPlayable([]), -1);
        compare(Pages.playTitle(3, 12, "Garota"), "3 of 12 · Garota");
        compare(Pages.nextLine({ title: "Asa Branca", key: "G", note: null }), "Next: Asa Branca, in G");
        compare(Pages.nextLine({ title: "Asa Branca", key: null, note: "capo 2" }), "Next: Asa Branca");
        compare(Pages.nextLine(null), "");
        compare(Pages.keyNoteLine("D"), "key: D");
        compare(Pages.keyNoteLine(null), "");
    }

    // Rule 6 (the reader's check in place of axe): one bit on a played first
    // page (the note and *key: D*) and a played last page (the Next line).
    function test_playOneBit() {
        const main = playing(Play4);
        waitForRendering(main.songScreen);
        compare(Walk.oneBitProblems(main.songScreen), []);
        goToLastPage(main.songScreen);
        verify(paragraphs(main.songScreen.view, main.songScreen.view.page).indexOf("Next: Eco do Morro") >= 0);
        waitForRendering(main.songScreen);
        compare(Walk.oneBitProblems(main.songScreen), []);
    }
}
