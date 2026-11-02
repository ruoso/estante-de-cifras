# reader.play — Playing a setlist through

## TaskJuggler entry

`tasks/85-reader.tji`, `task play` under `task reader` → `reader.play`
(L89–94). Milestone: `milestones.m7_reader` (`tasks/99-milestones.tji` L60).

## Effort estimate

1.5d.

## Repository

Not under `cifra.md/`, because the note does not start with `cifra.md:`. The
work lands in four places.

**`remarkable/qml/`** (most of the work):
- `Main.qml`: the router's Play state, the `109` route, and Back from Play.
- `browse/SetlistScreen.qml`: **Play** in the bar's right slot, and the row
  taps.
- `browse/pages.js`: the place and the neighbours in a setlist.
- `song/SongScreen.qml`, `song/SongBar.qml`, `song/SongFoot.qml`,
  `song/songstate.js`: the played song.
- `chart/SheetView.qml`: one more instance, laid out ahead.
- the tests under `qml/tests/`.

**`remarkable/internal/backend/`**:
- `views.go`: the neighbours read ahead, and `place` moving the open song.
- `views_test.go`.
- `qmlfixtures_test.go`: the played-sheet fixtures.

**`remarkable/internal/protocol/messages.go`**: type 109 `ahead`.

**`remarkable/internal/engine/bundle_test.go`**: the integration test.

**Docs**:
- `docs/remarkable-reader.md` §6: the table row for `109`, and the new
  meaning of `11 place`. This edit is part of the implementation, so it
  lands in the same commit.
- The design delta in `docs/workflows/19-remarkable-reader.md` §A setlist
  (Decisions 3–5), already written beside this refinement.

## Inherited dependencies

All of these are settled (`complete 100`):

- `reader.browse_screens` (89ef628), the declared dependency:
  - the setlist screen;
  - `ListBar`'s action slot, kept for Play (`reserve: true`);
  - rows left inert by its Decision 11;
  - `106` with `at` opening on the page that holds the item;
  - Main's hidden-but-alive screens.
- `reader.song_screen`:
  - the paged chart, the thirds, the swipe and the arrows;
  - `SheetView.preparedPage` and `pagesBuilt`;
  - the last page reading *n of n · End*;
  - the region `revision` counters;
  - the shape notes appended as a `notes` row on the last page (its
    Decision 10).
- `reader.backend_views`:
  - `open {view:"song", play:{setlist, at}}` answered at the setlist's key,
    with `play {setlist, at, of, next}`;
  - Play keeping its snapshot until an `open` leaves it (its Constraint 4);
  - `place` stored for Back (Constraint 5);
  - a `key` during Play kept for the song (its Decision 6).
- `reader.bundle` and `reader.engine`:
  - `setlist(text, setlistPath, bookPaths)` gives `{title, items (playable),
    missing, rows}`;
  - `sheet(…, {targetKey})` gives `keyNote` when the target cannot be
    applied.
- `reader.key_without_property`: `key.named` for a song with no `key`
  property. It is only a name and never sets a setlist interval; that
  refinement's L85 says "`reader.play` shows a setlist key as a note".
- `reader.missed_shapes`: `108 shapes` goes to the open song only, and never
  redraws a page.
- `reader.qml_harness`: the AppLoad stand-in, with `play(type, payload)` and
  `sent`.

Nothing is pending. Pairing's backend and **Sign out** belong to
`reader.pairing`, not to this task.

## What this task is

Play on the reader, as workflow 19 §A setlist draws it.

- **Starting Play.** **Play** in the setlist's bar opens the first playable
  song. Tapping a row opens Play at that song.
- **The bar.** It reads *3 of 12 · Garota*, and the key button shows the
  setlist's key.
- **The first page** of each song starts with the item's own note and, when
  the setlist's key cannot be applied, with *key: D*.
- **The last page** of each song ends with *Next: Asa Branca, in G* and that
  item's note.
- **Turning across songs.** *Next* on a song's last page shows the next
  song's first page. *Previous* on a first page shows the previous song's
  last page. Each is one redraw, because both neighbours were read and laid
  out ahead.
- **Missing songs** are never played.
- **Back** returns to the setlist, on the page that holds the song that was
  playing.

The backend already answers a played song. This task adds:
- the reading ahead of the songs on either side (`109 ahead`);
- `place` moving the backend's open song when a turn shows a song read
  ahead;
- everything in the QML.

## Why it needs to be done

Playing a setlist through is one of the M7 promises (`99-milestones.tji`
L61: "plays a setlist through"), and the last screen workflow 19 draws that
nothing drives yet. `reader.browse_screens` left the setlist rows inert and
the Play slot empty for this task (its L92–93 and Decision 11).
`reader.song_screen` and `reader.backend_views` left `sheet.play` and
`keyNote` unread for it (song_screen L69 and L323). Later tasks
(`reader.payload`, `reader.install`) ship the QML folder this completes.

## Inputs / context

- **The governing workflows and spec:**
  - `docs/workflows/19-remarkable-reader.md`:
    - §The refresh budget L17–64: rules 1 (one action, one redraw), 5
      (background news), 7 (the pressed control), 9 (prepare ahead);
    - §A setlist L322–356, with this task's delta at L332–352;
    - §When something has changed L358ff: Play keeps its version until
      Back;
    - §What it costs: "Turn a page (and a song, in Play) — 1 — content and
      foot".
  - `docs/workflows/12-setlists.md`:
    - §The key L54–65: a target key, shown as a note when the song has no
      `key`;
    - §Playing through L151–173: the song's note above its chart, the next
      song's title at the end, stopping returns to the setlist at the song.
  - `cifra.md/spec/10-setlists.md`:
    - §10.7.1: the key as a target, and when it is shown as a note instead;
    - §10.7.2: the note shown with the song while it plays;
    - §10.8.2: a playable item is played, every other is skipped but still
      shown in its place, and the same song may appear twice.
- **The reader's design** (`docs/remarkable-reader.md`):
  - §4 the host API table (L235–236);
  - §5.4 the reader's own state (the place in a setlist);
  - §6 the messages L356–426: `2 open` with `play`, `11 place`, `105`'s
    `play {setlist, at, of, next}`, `106`'s `at`, and "played from a
    setlist, at the setlist's key";
  - §9 the testing levels, where "Integration" means the built bundle in
    goja.
- **The router:**
  - `remarkable/qml/Main.qml`:
    - `d.view`, `leave` (L79–94), `d.setlist` (L153), `d.sheet` (L170);
    - the type filter `101–108` (L183);
    - the `105` and `106` routes (L206–211).
  - `remarkable/qml/browse/SetlistScreen.qml`:
    - its header comment L8–13;
    - `show()` L41–51 (the bar shown with `action: ""`, `reserve: true`);
    - the rows built at L66–76;
    - `ListRow` with `active: false` (L153);
    - Back sending `open book` (L98–103).
  - `ListBar.qml` L20–26 and L79–91: `actionTapped`, and `pending ===
    "action"`.
  - `browse/pages.js`: `perPage` (L10), `pageOf` (L47–57), `itemRight`
    (L184).
- **The song screen:** `remarkable/qml/song/SongScreen.qml`:
  - `sheet` and `onSheetChanged → d.receive` (L57, L217);
  - `commitBar` L166, `commitFoot` L171, `turn` L302;
  - the thirds and the swipe L374–404;
  - Back sending `open book` L471–474;
  - `songstate.js` `change` (L21): "new" when bookId, path, offset or rows
    differ;
  - `chart/SheetView.qml`: `preparedPage` and `pagesBuilt` (L49–51),
    `pagesFor` (L80), `show` and `turn` building the page after (L248–267);
  - `chart/paginate.js` L23.
- **The backend:**
  - `remarkable/internal/backend/views.go`:
    - `place` → `SetPlace` (L145);
    - `open` (L155–195) and `enter` (L201: the snapshot kept while playing
      the same setlist);
    - `sheet()` (L408–494: the offset and the target key);
    - `play()` (L500–523): `At` is the **row** index, `Of` is the
      **playable** count, and `next` is the next playable item;
    - `setlist()` (L528ff).
  - `protocol/messages.go`: `Open`/`PlayAt` L78–91, `Place` L131–135,
    `SheetPlay`/`NextItem` L260–274, `Setlist`/`SetlistItem` L276–295.
  - `engine/engine.go` L176–205: `SetlistItem{At, Number, Title, Path, Key,
    Note}`, `SetlistRow{…, Missing}`, `Setlist{Title, Items, Missing,
    Rows}`.
- **The bundle:** `app/src/device/entry.js`:
  - `sheet` L125–234 (L135–138: `playKeyOffset`, and `keyNote =
    targetKey` when it is null);
  - `setlist` L263–280.
  - `app/src/books/setlist-play.js` `startIndex` L91–105 is the web app's
    rule for a row that is not playable. It is precedent, not shared code.
- **The tests already there:**
  - `remarkable/internal/backend/views_test.go`: `TestOpenSetlistWithMissing`
    L636, `TestPlaySheet` L670, `TestPlayKeepsItsVersion` L692, and the
    fixture book with `a-short-set` and `with-a-gap` (L33–67).
  - `engine/bundle_test.go`: `TestSetlistRows` L455.
  - `qml/tests/tst_browse_screens.qml` L315–317: rows send nothing. This
    task changes that test.
  - `qml/tests/tst_song_regions.qml`: `snapshot`/`moved`/`samePixels`.
  - `qml/tests/tst_main.qml`.
  - `qml/tests/fixtures/browse-setlist.js`: `bar-do-ze`, 14 items with keys
    and notes, and item 3, *Canção Perdida*, missing.
  - `TestQMLFixtures` (`qmlfixtures_test.go` L262) writes these fixtures and
    checks them for drift.
- **The gate:** `scripts/gate` runs `go test -p $JOBS ./...` in
  `remarkable/` (L170–184) and the QML runner (L372).

## Constraints / requirements

1. **The place and the neighbours are the setlist's rows.**
   - The frontend holds the `106` that Play started from: the setlist screen
     keeps it alive (`setlistScreen.setlist`).
   - The place is the item's **row index** `at`, as in `PlayAt`, so the same
     song twice is two places (§10.8.2).
   - The next and previous items are the nearest rows after and before `at`
     with `missing: false`. In `106`, unlinked and outside-the-book items
     already read `missing`.
   - The bar's *n of m* comes from the playable rows: *n* is the count of
     playable rows up to and including `at`, and *m* is `play.of`.
   - `pages.js` gains the pure helpers: the place, the next and previous
     playable `at`, and the position. They are unit-pinned in a QML test.
2. **Starting.**
   - **Play** goes in `ListBar`'s action slot (`action: "Play"`, replacing
     `reserve`). It is drawn only when the setlist has a playable row; an
     empty or all-missing setlist has nothing to play (§10.8.2).
   - Tapping Play inverts it (rule 7), then sends `2 open {view:"song",
     bookId, path: <first playable row's path>, play:{setlist, at}}`.
   - A playable row becomes `active`. Its tap inverts it and sends the same
     open at that row.
   - A *missing* row stays inactive: no inversion, nothing sent (Decision
     3).
3. **The played song screen.** Given a `105` with `play`:
   - The bar's title is *{n} of {of} · {title}*. The key button shows
     `key.named` as it does today: when the target applies, that is the
     setlist's key, and with no item key it is the song's own key.
   - The first page starts with a `notes` row holding the item's note (from
     the held `106` row) and *key: {keyNote}* when `keyNote` is non-null.
     These are the first rows, so pagination counts them.
   - The last page ends with *Next: {title}, in {key}*, or *Next: {title}*
     when the next item sets no key, and the next item's note on its own
     line, after any shape notes. These are rows too, so they can push onto
     a page of their own. There is no Next line at the last playable item.
   - The foot reads *End* only on the last playable item's last page.
     Elsewhere *next* on a last page, and *previous* on a first page, cross
     songs. The first song's first page has no *previous*.
   - A `105` without `play` is an ordinary song, exactly as today.
4. **Reading ahead (backend).**
   - After it writes a played `105`, and after a `place` that moved the
     open song (item 5 below), the views compute and send the neighbours:
     the next playable item's sheet, then the previous one's.
   - Each goes out as `109 ahead`. Its payload is exactly a `105`'s, with
     `play`, read from Play's held snapshot at the setlist's key, by the
     same `sheet()` path.
   - At the ends, a neighbour that does not exist is not sent.
   - These run on Serve's loop like everything else (backend_views
     Constraint 10). A message arriving meanwhile waits at most two engine
     sheet calls, about 0.1 s each by design §4.2.
   - `109` never changes the backend's open song.
5. **`place` moves the open song.**
   - A `place {bookId, setlist, at}` for the setlist being played, naming an
     item other than the open song, makes that item the open song: its path
     comes from the held setlist, and it plays at the target with
     `useTarget` set. The views then send its neighbours' `109`s.
   - A `place` for the item already open is stored and answered with
     nothing, as today.
   - After a move, `key`, `hideShape` and `showShape` act on the new song,
     and the missed-shape `empty` set is that sheet's. A later `108`
     therefore names it.
   - A `place` while not playing is only stored, as today.
6. **Turning across songs (frontend).**
   - Main routes `109` to the song screen only while it shows a played
     sheet of the same setlist and book. The screen keeps at most one sheet
     for `play.at` = next and one for previous; anything else is ignored.
   - The next sheet is laid out in a second, invisible `SheetView` at the
     same strip height rule, with its first page built (`pagesBuilt ≥ 1`)
     **before** the turn (rule 9).
   - A turn onto it swaps the views. That is one commit per region: the
     chart, the strip, the foot, and the bar's title. The bar's title, like
     the key button, is a bar word, and it changes in the same redraw (the
     cost table's "content and foot", plus the bar words whose text
     changed). Then the screen sends `11 place`.
   - Previous lays out the held previous sheet and shows its **last** page,
     in one commit.
   - A turn whose neighbour has not arrived sends `2 open` with `play` at
     that item, keeps the old page, and shows the `105` when it comes
     (rule 1). It also sends `place`, because the backend records places
     only through `place`.
   - The first played song also sends `place` when it is shown.
7. **Back from Play** sends `2 open {view:"setlist", bookId, path:
   play.setlist}`. The backend's `106` carries `at`, the last place, and
   the setlist screen opens on that page (already built). That `open`
   leaves Play, and the snapshot is released (backend_views Constraint 4).
   - Back from an ordinary song still goes to the book.
8. **Background news never redraws** (rule 5).
   - A sync during Play changes nothing: the backend reads from the held
     snapshot.
   - A `108` for a held neighbour is ignored, as today. Its shapes arrive
     after the turn, through item 5.
9. **One-bit, fixed chrome.**
   - The Next line and the notes are `NotesParagraph` rows in the existing
     faces. Emphasis comes from weight, not grey, and `walk.js`
     `oneBitProblems` stays clean.
   - A key chosen during Play is a `key` → `105` redraw of that song only,
     with no `play` target. Its held neighbours are untouched (backend_views
     Decision 6).
10. **The standing rules.**
    - The reader writes nothing to the account.
    - Nothing new is logged: no paths, no titles (backend_views
      Constraint 9).
    - Test songs and setlists are written for the purpose: the existing
      fixture books and `fixtures/songs/`.

## Acceptance criteria

The behaviour above, delivered through the real messages, with these tests.
Each names what drives it, and everything they need already exists or lands
here:
- the AppLoad stand-in (`reader.qml_harness`);
- the fixture books in `views_test.go` and `fixtures/browse-book`;
- the built bundle (`reader.bundle`, which the gate builds).

There is no e2e level: the note names none. The reader has no e2e-web or
e2e-api harness, and design §9 places its levels at Go and QML.

**Integration** (`go test`, the built bundle in goja), in
`remarkable/internal/engine/bundle_test.go`:

- `TestPlaySetlistKeysNotesMissing`: the engine's `Setlist` over a setlist
  written for the purpose in the bundle fixtures. The setlist holds three
  things: an item with a key and a note, a missing item with a key and a
  note, and a keyless song given a key. The test pins:
  - `Items` holds only the playable items, in row order, each with its `at`
    (the row index), `key` and `note`;
  - `Rows` holds every item, the missing one `missing: true` in its place;
  - `Missing` is 1;
  - `Sheet` of the keyless item with `TargetKey` has offset 0 and
    `keyNote` equal to the target (§10.7.1, workflow 12 §The key).

**Behavior (Go)** (`httptest`-free: Serve over the AppLoad peer, as the
existing tests do), in `remarkable/internal/backend/views_test.go`:

- `TestPlaySendsNeighboursAhead`: `open` with play at the middle item of
  `a-short-set` answers `105`, then `109` for item 2, then `109` for item 0,
  each with `play` and at the setlist's key. At item 0 only the next is
  sent, and at the last item only the previous. Pins workflow 19 §A
  setlist, read ahead, and rule 9.
- `TestPlayAheadSkipsMissing`: on `with-a-gap`, the `109` neighbours of item
  2 are items 0 and 4. The missing and unlinked rows are never read ahead
  (§10.8.2).
- `TestPlaceMovesOpenSong`:
  - after `place` at the next item, a `key` redraws **that** song (`105`
    path and offset), and its own neighbours' `109`s were sent;
  - a `place` at the open item answers nothing;
  - a `place` while not playing only stores.
- `TestPlayAheadKeepsItsVersion`: a sync between the start and a `place`
  still reads the neighbours from the version Play started with (workflow
  19 §When something has changed).
- The existing `TestPlaySheet`, `TestPlayKeepsItsVersion` and
  `TestNothingLogged` still pass. `TestNothingLogged` is extended to a
  played open with reading ahead, which logs nothing.
- `remarkable/internal/protocol/messages_test.go`: `109 ahead` round-trips
  with the `Sheet` payload.

**Behavior (QML)**: `remarkable/qml/tests/tst_play.qml` (new). It is driven
by played-sheet fixtures that `TestQMLFixtures` writes from
`fixtures/browse-book/bar-do-ze.setlist.md`, extended with a keyless song
given a key (`play-*.js`: a `105` and its `109`s from the backend's own
answers). The cases:

- `test_playOpensFirst`: Play sends `open` with `play.at` set to the first
  playable row; its press inverts it. Also, Play is absent on a setlist with
  nothing playable.
- `test_rowOpensPlayAtIt`: a playable row's tap sends `open` at its `at`. A
  *missing* row's tap sends nothing and does not invert (Decision 3).
- `test_barPlace`: the bar reads *n of m · Title*, with *n* counting only
  playable rows (the missing item 3 shifts later songs). The key button
  shows the setlist's key.
- `test_firstPageNoteAndKeyNote`: the item's note, and *key: D* for the
  keyless song, open its first page. The bar's key button is unchanged
  (§10.7.1, §10.7.2).
- `test_nextLineWithNote`: the last page ends with *Next: Title, in G* and
  the next item's note, or *Next: Title* when it sets no key. The last item
  has none, and its foot reads *End*. Pins workflow 19 §A setlist, third
  bullet.
- `test_nextSongReadyBeforeTurn`: after the `109`, the invisible view has
  built the next song's first page before any turn. The turn builds no page
  on screen (`pagesBuilt` unchanged on the shown view after the swap) (rule
  9).
- `test_acrossSongsOneRedraw`: next across songs moves the chart, strip and
  foot `revision` by exactly 1 each, and the bar by its title only, once.
  Previous across songs lands on the previous song's **last** page, also
  once. Then `place` is sent with the new `at` (cost table: "Turn a page
  (and a song, in Play) — 1").
- `test_missingSkipped`: from item 2 (*n* = 2), next lands on item 4. The
  missing item 3 is never opened, and no `open` or `place` names it
  (§10.8.2, workflow 12).
- `test_turnBeforeAheadWaits`: a turn with no `109` held sends `open` at the
  neighbour and leaves every region unchanged until the `105`, which then
  commits once (rule 1).
- `test_backToSetlistAtSong`: Back sends `open setlist`. A `106` with `at:
  12` opens on page 2 of the setlist. Back from an ordinary song still
  opens the book.
- `test_aheadIgnoredOutsidePlay`: a `109` with no played song on screen,
  or for another setlist, changes nothing. A `108` for a held neighbour
  changes nothing (rule 5).
- `test_playHelpers`: the `pages.js` pure helpers (next and previous
  playable `at`, position, first playable), over rows with missing items
  at the start, the middle and the end.
- `test_playOneBit` (the reader has no axe; its check is one-bit): `walk.js` `oneBitProblems` is clean on a
  played first page and a played last page.
- `tst_browse_screens.qml` L315–317 changes from "rows send nothing" to "a
  missing row sends nothing". `tst_main.qml` gains the `109` route
  (ignored unless a played sheet is on screen).

**Docs in the same commit:**
- `docs/remarkable-reader.md` §6 gains these rows:
  - `| 109 \`ahead\` | → frontend | a \`105\`'s payload, with \`play\`, for
    the next or the previous playable item of the setlist being played,
    read ahead; never shown until a turn reaches it |`;
  - the `11 place` row reads: "… kept so Back returns to it; while playing
    that setlist, an item other than the open song becomes the open song,
    and its neighbours are sent as `109`".
- The "What the backend answers" paragraph says the same.
- The workflow 19 delta is already on disk.

Nothing is deferred.

## Decisions

1. **Read ahead with a backend-pushed `109 ahead`, not a frontend request,
   and not a `105` with its neighbours inside.**
   - Embedding the neighbours in the `105` would triple the work before the
     song opens, which breaks design §4.2's tenth of a second.
   - A frontend `prepare` request adds a round trip on every turn, for no
     gain. The backend already knows the neighbours as it answers.
   - A distinct type, not a flagged `105`, keeps Main's `105` route meaning
     "show this", and lets any old frontend ignore it, as §6 already
     requires.
2. **`place` moves the open song, rather than a new message or a second
   `open`.**
   - An `open` would answer a `105`. The frontend would then have to tell
     "this is the page already shown" apart from a redraw, or it would draw
     twice.
   - `place` already means "the item being played" (store Decision 4). It is
     already sent, and today answers nothing. Making it also move the
     backend's notion of the open song keeps one message for one fact.
3. **A missing row is not a target.**
   - The web app starts Play at the first song when the row is not playable
     (`setlist-play.js` `startIndex`). On paper that is a full redraw onto a
     song nobody pressed.
   - Opening at the next playable song guesses intent.
   - The row already says *missing* (§10.8.2: shown, skipped). Not making it
     a target costs no redraw and asks nothing. This is written into
     workflow 19 §A setlist.
4. **The playing song's own note on its first page.**
   - This is a design delta in workflow 19 §A setlist. The workflow drew
     only the next song's note at the end of the one before. A song Play
     starts at would then never show its note.
   - cifra.md §10.7.2 ("the note is shown with the song while it is
     played") and workflow 12 §Playing through ("shown above its chart") say
     it shows.
   - The text comes from the held `106` row, so the protocol is unchanged.
5. **The setlist key as a note goes on the first page, beside the note.**
   This applies when the key cannot be applied: no song key, or a different
   mode (`keyNote`).
   - It does not go on the key button. That button names the key the chart
     is read in (`key.named`), and after key_without_property Decision 2 a
     key name never doubles as an interval.
   - §10.7.1 says "show it to the player as a note".
6. **Both neighbours are read ahead, not only the next.** Rule 9 names only
   the next song, but workflow 19's cost table says "every turn, across
   songs too — 1", backwards included. Reading the previous song ahead
   costs one more sheet call. The delta says it ("the songs on either
   side").
7. **The place and position come from the held `106`, and `SheetPlay` is
   not extended.**
   - The setlist screen is always where Play starts, and it stays alive, so
     its `106` is in hand.
   - `SheetPlay.at` is already the row index that the helpers walk.
   - Adding `n` and `prev` to the protocol would duplicate what the rows
     already say.
8. **No e2e level.** The note names behavior and integration only. The
   reader's frontend has no web or API surface, and design §9 tests it at Go
   and QML. Pairing and sync's stack test belong to their own tasks.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-02.

- Backend: `remarkable/internal/protocol/messages.go` (type 109 `ahead`), `remarkable/internal/backend/views.go` (both neighbours read ahead; `11 place` moves the open song; Play keeps its version).
- QML: `remarkable/qml/Main.qml` (Play route, `109`, Back to the setlist's page), `remarkable/qml/browse/SetlistScreen.qml` and `pages.js` (Play in the bar, playable rows open Play, missing rows are not targets).
- Song screen: `remarkable/qml/song/{SongScreen,SongBar,SongFoot}.qml`, `songstate.js` (bar *n of m · Title*, item note and *key: D* on the first page, *Next: …* and note on the last, *End* on the last playable item; next song laid out ahead in a second invisible view, one redraw per turn).
- Tests: `remarkable/qml/tests/tst_play.qml` (13 cases) with fixtures `play-{0,1,3,4,12,13}.js`; `tst_main.qml` `test_routesAhead`; `tst_browse_screens.qml` `test_setlistRows`.
- Go tests: `TestPlaySendsNeighboursAhead`, `TestPlayAheadSkipsMissing`, `TestPlaceMovesOpenSong`, `TestPlayAheadKeepsItsVersion` in `views_test.go`; integration `TestPlaySetlistKeysNotesMissing` in `remarkable/internal/engine/bundle_test.go`; `messages_test.go` round-trip.
- Fixtures: *Domingo Cedo* lost `key: C` and its setlist item got `key: D` (`remarkable/qml/tests/fixtures/browse-book/`); `browse-setlist.js` regenerated.
- Docs: `docs/remarkable-reader.md` §6, `docs/workflows/19-remarkable-reader.md` §A setlist, `remarkable/README.md`.

