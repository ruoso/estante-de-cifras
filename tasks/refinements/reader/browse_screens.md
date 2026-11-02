# reader.browse_screens — Pairing, the shelf, a book, a setlist, settings

## TaskJuggler entry

`tasks/85-reader.tji`, `task browse_screens` under `task reader` →
`reader.browse_screens` (L82–87). Milestone: `milestones.m7_reader`
(`tasks/99-milestones.tji` L60).

## Effort estimate

2d.

## Repository

Not under `cifra.md/`: the note does not start with `cifra.md:`. The work
lands in:

- `remarkable/qml/browse/` (new):
  - the screens: `NotPaired.qml` (*Not paired* and the code page, one file,
    two states), `ShelfScreen.qml`, `BookScreen.qml`, `SetlistScreen.qml`,
    `SettingsScreen.qml`;
  - shared chrome: `ListBar.qml` (Back · title · one action), `ListFoot.qml`
    (an optional left word, *n of m* and the arrows), `ListRow.qml` (a
    two-line row that inverts when pressed), `LetterRows.qml`;
  - one pure module, `pages.js`: ten rows to a page, the page of an item, a
    title's letter, the letters' pages, the row copy (*32 songs · 4
    setlists*, *1 song*, *Untitled book*).
- `remarkable/qml/song/InkButton.qml` and `Chevron.qml` reused as they are
  (imported from `../song`), not copied.
- `remarkable/qml/chart/metrics.js`: the list sizes (row 120 px, the list
  heading, the letter cell, the sync line) beside the song's chrome sizes.
- `remarkable/qml/Main.qml`: routes every view (below); the one status line
  goes, its function `status.js` moving onto the shelf and Settings
  (app_folder Decision 9; `status.js` L5 already says so).
- `remarkable/internal/backend/qmlfixtures_test.go`: `TestQMLFixtures`
  also writes the browse fixtures (below) from the backend's own views.
- `remarkable/qml/tests/`: `tst_browse_pages.qml`, `tst_browse_screens.qml`,
  `tst_browse_regions.qml`, changes to `tst_main.qml`, and generated
  fixtures `fixtures/browse-*.js` from a book written for the purpose under
  `fixtures/browse-book/`.

**Design delta (same commit, already written)** —
`docs/workflows/19-remarkable-reader.md`:

- §The screen L86–89: a list (shelf, book, setlist) turns by a swipe or the
  foot's arrows, not by the thirds — its rows are the targets.
- §Pairing L125–128: offline is said in the code's place with *Get a new
  code*; the code page's bar has **Back** to *Not paired* (as
  `docs/reader-mockups/Pair-code.dc.html` draws it).
- §The shelf L153–155: the row's count copy, singular, and no *0 setlists*.
- §The shelf L160–170: the Settings page in full — Account, Sync, Shapes
  (*Show all again*, *No shapes hidden.*), This reader, and Sign out's one
  question with **Sign out** / **Cancel** (as `Settings.dc.html` draws it,
  with the question made a step).
- §A book L189–197: a song's letter (its title's first letter, accent
  stripped; a digit or sign has none); an absent letter leaves its place
  empty (as `Book.dc.html` draws it); no current letter is marked; Back from
  a song or setlist returns to the page it was left on.
- §A setlist L326–329: the key a row names is the one the setlist sets; a
  song it sets none for names none.

## Inherited dependencies

- `reader.song_screen` (complete 100, the one `depends`): `SongScreen`, its
  Back sending `2 open {view:"book", bookId}` (`SongScreen.qml` L471–474),
  `InkButton` (inverts at once, rule 7), `Chevron`, the region `revision`
  pattern and the pixel probes in `tst_song_regions.qml` L58–130 (its
  Decision 2), and its Decision 11: *"Main.qml routes only the sheet …
  drawing the other views is `reader.browse_screens`"*.
- Settled context, not in `depends` (all complete 100):
  - `reader.backend_views`: the answers this task draws —
    `103 shelf` (`views.go` L248–275, books without a clone left out, `title`
    `""` worded by the frontend, L284–293), `104 book` (L297–347, setlists
    and songs each sorted by path, *"as the web app's book page lists them"*),
    `106 setlist` (L531–567, every item, `at` the store's place), `107
    settings` (L279–282); `9 showAllShapes` with no song open answers `107`
    (L587–595); an unanswerable `open` answers the book, else the shelf
    (its Decision 7).
  - `reader.sync`: `101 state` is sent by itself on every sync status change
    (`backend.go` L76–86); nothing else is pushed after a sync — a new shelf
    or book is seen only on the next `open` (sync Decision 4, backend_views
    Decision 5). `lastSync` survives a restart (sync Decision 12).
  - `reader.protocol`: the whole vocabulary of design §6 is fixed
    (`messages.go` L16–38), including `5 pair`, `6 signOut` and `102
    pairing {code?, url?, expiresAt?, expired?, offline?}`; errors are word
    codes, the frontend owns the copy (protocol Decision 6).
  - `reader.qml_harness`, `reader.app_folder`: the AppLoad stand-in
    (`tests/appload/net/asivery/AppLoad/AppLoad.qml`: `play`, `sent`,
    `messageSent`), `run.py`, the gate step (`scripts/gate` L349–385), the
    folder build taking everything under `qml/` (`appfolder.go` L176–193),
    and `check_folder.py` compiling `Main.qml` from the rcc.
- Pending, downstream (they depend on this task): `reader.play` (the
  setlist's **Play** and its row taps, the song in the bar, the next song),
  `reader.pairing` (the backend's side of `5 pair` and `6 signOut` — today
  `views.handle`, `views.go` L128–151, does nothing for either, and nothing
  sends `102`).

## What this task is

The reader's screens other than the song, drawn in QML from the backend's
messages as workflow 19 draws them: *Not paired* and the pairing code page;
the shelf with **Sync** and its sync line; a book with its setlists then its
songs, ten rows a page, and for a book of more than two pages the two letter
rows; a setlist with each song's key and note and a missing song said; and
Settings with the account, the sync time, the shapes hidden with **Show all
again**, the version, and **Sign out** with its one question. `Main.qml`
becomes the router between them and the song screen: it opens the shelf once
paired, carries Back, and keeps background news from redrawing anything but
the shelf's sync line.

## Why it needs to be done

Without it the reader shows one status line and a song nobody can reach:
song_screen landed with no e2e because a song is reachable only through the
book (song_screen.md L533–536). `reader.play` adds Play to the setlist screen
drawn here; `reader.pairing` wires the backend under the pairing page and
Sign out drawn here; `reader.payload` and `reader.install` ship the result.

## Inputs / context

- `docs/workflows/19-remarkable-reader.md`:
  - §The refresh budget L17–63 — the ten rules; rule 5 (L36–40) *"Background
    news never redraws the screen … The only exceptions are the two the
    person is waiting for: a pairing approved, and the sync word on the
    shelf"*; rule 7 (L46–49) the tapped control inverts; rule 8 (L50–53) the
    letter row; rule 10 (L57–60) rows ≥ 120 px, controls ≥ 100 px.
  - §The screen L65–98 — bar 140 px, foot 100 px, the foot without arrows on
    a single page; the list delta L86–89.
  - §Pairing L100–130; §The shelf L132–172; §A book L174–199; §A setlist
    L322–346 (Play and row taps are `reader.play`'s); §When something has
    changed L348–357; §What it costs L359–375 (open/Back — content and bar;
    turn — content and foot; a letter — content and foot; Sync on the shelf
    — 2, one line; Sync elsewhere — 0; pairing approved/expired — content).
- `docs/reader-mockups/`: `Main.dc.html` (Not paired), `Pair-code.dc.html`,
  `Shelf.dc.html`, `Book.dc.html` (letter grid 13×2 above the foot, absent
  letters an empty cell, L41–66), `Setlist.dc.html` (number, title, note
  under it, key at the right, *missing*, the line *Banda do Bairro · 6
  songs* at the content's top), `Settings.dc.html` (L27–44); redraw notes in
  `canvas.json` L48–49.
- `docs/remarkable-reader.md` §6 L356–426 — the messages (`101` L392, `102`
  L393, `103` L394, `104` L395, `106` L397, `107` L398) and *What the backend
  answers* L410–426; §5.1 pairing, §5.4 the device's own state.
- Code: `remarkable/qml/Main.qml` (L42–75 the router to replace, L47–48 drop
  `102` today), `remarkable/qml/status.js` (the sync line's copy, L16–30),
  `remarkable/qml/song/SongScreen.qml` (revisions L337–363),
  `remarkable/qml/tests/tst_main.qml` (L60–96 the status-line tests,
  L125–209 routing and background news), `remarkable/qml/tests/walk.js`
  `oneBitProblems` (L42), `remarkable/internal/protocol/messages.go` (L67–91
  open, L300–301 settings), `remarkable/internal/backend/qmlfixtures_test.go`
  (L100 `TestQMLFixtures`).

## Constraints / requirements

- **The frontend only draws** (design §3.3): no music, no file reading, no
  sorting the backend's lists. It may compute pages, a title's letter and
  the count copy — presentation over what it was sent.
- **One action, one redraw, of the region the cost table names.** Each screen
  has regions with one commit point and an `int revision` each, as the song
  screen does (song_screen Decision 2): shelf — bar, sync line, list, foot;
  book — bar, list, letters, foot; setlist — bar, list, foot; settings —
  bar, content, the sign-out part; pairing — content. A view answered
  replaces the screen at once when its message arrives, never before (the
  tapped row or button inverted meanwhile, rule 7). No *Loading…*, no
  spinner, no Timer, no Behavior, no animation, no grey (rules 1, 2, 6;
  `walk.js` `oneBitProblems` clean on every screen).
- **Routing, in `Main.qml`**:
  - Nothing is drawn before the first `101` (as today).
  - `101` with `paired: false` and no screen yet, or after Sign out was
    confirmed → *Not paired*. A `paired: false` arriving while a book,
    setlist, song or Settings is open changes nothing on screen (rule 5);
    the next `103 shelf` answered is drawn as *Not paired* instead.
  - `101` with `paired: true` while *Not paired*, the code page, or nothing
    is shown → `2 open {view:"shelf"}`; the `103` replaces the page (the
    pairing approved — one redraw of the content).
  - `102` is accepted only while the code page is asked for or shown:
    `{code, url, expiresAt}` draws the code (the address from `url`, the end
    as a device-local 24-hour time, as `status.js` `hhmm`); `{expired:true}`
    replaces the code with *That code has expired.*; `{offline:true}` with
    the Wi-Fi sentence. Each keeps *Get a new code*, which sends `5 pair
    {}`. *Pair with your account* sends `5 pair {}` and the page stays until
    the `102` (the pairing page still until a pairing message). The code
    page's Back returns to *Not paired* without a message.
  - `103`, `104`, `106`, `107`, `105` each show their screen; the others are
    hidden, never destroyed and rebuilt mid-redraw. A `107` while Settings
    is shown (the answer to *Show all again*) redraws only the Shapes line.
  - `101` while the shelf is shown redraws only the sync line, and only when
    its text changes. `101` anywhere else changes nothing (the song screen's
    `shapesShown` handling stays as it is).
  - `108` goes to the song screen only, as today.
- **Back**: book → `open shelf`; setlist → `open book {bookId}`; Settings →
  `open shelf`; song → `open book` (unchanged). Main remembers the page a
  book was left on (by `bookId`) and the shelf's page, and a book reopened
  by Back opens there, clamped to its page count (workflow 19 L197). A
  `106` with `at` opens on the page holding item `at`.
- **The shelf**: title *Estante*, **Sync** at the right sends `4 sync {}`
  and nothing else (the line changes when the `101` with `syncing: true`
  arrives); the sync line at the content's top is `status.js`
  `statusLine(state)`; rows `title` (or *Untitled book*) and the count line;
  tapping a row sends `2 open {view:"book", bookId}`; **Settings** at the
  foot's left sends `2 open {view:"settings"}`; the empty shelf's sentence.
- **A book**: bar Back · title; setlists first, each with *n songs*, then
  songs with title (or the file name without `.cifra.md` when `""`) and
  artist; a heading *Setlists* / *Songs* above the first row of each kind,
  on the page where it falls; ten rows a page over the setlists and songs
  together; a row taps `open setlist {bookId, path}` or `open song {bookId,
  path}`. The letter rows (two of thirteen, A–Z, each cell 108 × 100 px) only
  when the book has more than two pages; a letter that starts no song is not
  drawn and its cell stays empty; a letter turns to the page holding the
  first song, in the book's order, whose letter it is — one redraw of list
  and foot, the letters untouched. *No songs in this book yet.* for a book
  with none.
- **A setlist**: bar Back · title (the right slot left for `reader.play`'s
  **Play**); the line *Book name · n songs* at the content's top (the book's
  title from the `104` that opened it); each item its number, its title,
  *in D* when `key` is set, *missing* when `missing`, and its `note` under
  the title; ten rows a page; rows not tappable in this task.
- **Settings**: Account (*Paired with* the `account`), Sync (`statusLine`
  of the state when the page opened, not updated after), Shapes (*n shapes
  hidden — the ones you know* / *1 shape hidden — the one you know* with
  **Show all again** sending `9 showAllShapes {}`, or *No shapes hidden.*),
  This reader (*Version* `version`), **Sign out** → the question with
  **Sign out** (sends `6 signOut {}`) and **Cancel** (back to the button, no
  message) — one redraw of that part each.
- **Sizes**: rows ≥ 120 px and controls ≥ 100 px (rule 10); with the bar 140
  and foot 100, a book with letters has 1432 px of content — ten 120 px rows
  and two headings fit.
- Copy is workflow 19's, in English, the reader's one locale (`docs/remarkable-reader.md` §3.1);
  the copy strings live in `pages.js` beside the count functions, not
  scattered in the screens.
- No song text in logs: the screens log nothing.

## Acceptance criteria

Behavior delivered as the constraints above. Tests, all run by
`scripts/gate`'s QML step (`run.py -input remarkable/qml/tests`):

- **unit** — `remarkable/qml/tests/tst_browse_pages.qml` over `pages.js`:
  - ten rows a page: 0, 1, 10, 11 and 34 items → 1, 1, 1, 2, 4 pages; the
    page of item 0, 9, 10, 33 (workflow 19 §A book, §A setlist "Ten rows to
    a page");
  - a title's letter: *Ária* → A, *Ção* → C, *zé* → Z, *7 Cordas* and
    *(Intro)* → none, `""` → the file name's letter (workflow 19 L189–193
    delta);
  - the letters' pages over setlists + songs: the first song of each letter,
    offset by the setlists; absent letters absent (§A book, rule 8);
  - the count copy: *32 songs · 4 setlists*, *1 song · 1 setlist*, *12
    songs* (no setlists), *0 songs*; *Untitled book* for `""` (L153–155
    delta);
  - the hidden count copy: 0, 1, 11 (L160–170 delta).
- **behavior** — `remarkable/qml/tests/tst_browse_screens.qml`, each screen
  driven by the stand-in's `play` with the generated fixtures:
  - rows paged ten to a page: the 34-song, 3-setlist book is 4 pages, page 1
    holding the 3 setlists then 7 songs with their headings, page 4 the last
    7 songs (§A book);
  - absent letters not drawn: only the fixture's letters are targets, every
    other cell empty and in place; a book of two pages draws no letter rows
    (§A book);
  - a letter goes to its page: tapping one sends nothing and shows the page
    of its first song (§A book, rule 8);
  - each row sends its `open` (book, setlist, song) and Back its `open`
    (§The shelf, §A book; design §6 `2 open`);
  - the shelf: the rows in the `103`'s order with their count lines, **Sync**
    sending `4 sync {}`, **Settings** sending `open settings`, the empty
    shelf's sentence (§The shelf);
  - a setlist: number, title, *in D*, the note under the title, *missing*
    for the missing item, no key for an item with `key: null`; a `106` with
    `at: 12` opens on page 2 (§A setlist delta);
  - Settings: the five parts in order; **Show all again** sends `9
    showAllShapes {}` and the next `107` with `hiddenShapes: 0` says *No
    shapes hidden.*; Sign out asks, **Cancel** sends nothing, the second
    **Sign out** sends `6 signOut {}` (L160–170 delta);
  - the pairing page: *Pair with your account* sends `5 pair {}` and the page
    is unchanged until a `102`; the `102` code draws the code, the address
    and *This code works until 14:42*; `{expired:true}` and `{offline:true}`
    each say their sentence with *Get a new code*, which sends `5 pair {}`;
    Back to *Not paired* sends nothing (§Pairing);
  - every screen `walk.js` `oneBitProblems` clean (rules 2, 6).
- **behavior** — `remarkable/qml/tests/tst_browse_regions.qml`, with the
  `revision` and `grabImage` probes of `tst_song_regions.qml`, the cost table
  (workflow 19 §What it costs):
  - a page turn on a book changes list and foot once, bar and letters
    untouched; a letter the same;
  - a `101` with `syncing: true` then `false` on the shelf changes the sync
    line once each, nothing else; the same `101`s on a book, a setlist and
    Settings change nothing (rule 5);
  - *Show all again*'s `107` changes the Shapes line only; Sign out's
    question its part only;
  - a pressed row or button inverts at once with nothing else changed
    (rule 7);
  - the pairing page: a `101` with `paired: false`, `syncing` changes, and a
    `108`, change nothing on it; a `102` changes the content once (§Pairing
    "the page then stays still").
- **behavior** — `remarkable/qml/tests/tst_main.qml`, the status-line tests
  (L60–96, L125–209) rewritten to the screens they now land on, keeping what
  each pinned (copy of the sync line now read off the shelf; a `104` after a
  sheet shows the book, not the song):
  - first `101` unpaired → *Not paired*; first `101` paired → `2 open
    {view:"shelf"}` sent once, and the `103` shows the shelf;
  - a `101` turning `paired: true` on the code page → `open shelf`, the
    `103` replacing the page (§Pairing "approved — 1");
  - a sync arriving while a book is open changes nothing until the shelf is
    opened again: `101 syncing` → `101 lastSync 14:40` with the book shown,
    book's revisions unchanged; Back → `open shelf` → the `103` (with a book
    the sync brought) shows *Synced at 14:40* and the new row (rule 5,
    §The shelf, §When something has changed);
  - Back from a song to a book on page 3 reopens page 3 (L197 delta);
  - `paired: false` while a song is open changes nothing; the next `103` is
    drawn as *Not paired*; Sign out confirmed then `101 paired: false` →
    *Not paired* (§Pairing L102);
  - `102` ignored unless the code page was asked for.
- **Fixtures** — `TestQMLFixtures` writes `fixtures/browse-shelf.js`,
  `browse-book.js`, `browse-book-small.js`, `browse-setlist.js`,
  `browse-settings.js` from the backend's views over a local book written
  for the purpose (`fixtures/browse-book/`: 34 songs with invented titles
  covering accented, digit-led and empty-artist titles, 3 setlists, one with
  a missing item, keys, a `key`-less item and notes), checked unchanged on a
  normal run as the sheets are, so a payload field renamed in Go fails the
  QML tests.
- No e2e level: the note names behavior only, and the reader is not served
  by the stack the e2e harnesses drive; the pairing journey against the
  stack is `reader.pairing`'s e2e-api.
- No new WBS task: Play and setlist row taps are `reader.play`'s, the
  backend under `pair`/`signOut` is `reader.pairing`'s — both already in
  the WBS and depending on this one.

## Decisions

1. **Lists turn by swipe and arrows, not the thirds** (workflow 19 delta at
   L86–89). A row is a whole-width target (rule 10: rows ≥ 120 px tall,
   and wide); thirds would leave rows tappable only in the middle third or
   make a tap ambiguous. The song page keeps the thirds — it has no row
   targets. Rejected: thirds outside the rows — the rows fill the content.
2. **Main routes by message, screens kept alive and hidden.** One
   `visible` switch per message keeps "one redraw" (a Loader rebuilding a
   screen would draw it in parts). Rejected: a StackView — transitions
   (rule 2) and a history the backend already owns (Back sends `open`).
3. **The shelf opens itself once paired, from the frontend.** The backend
   answers `hello` with `state` only (design §6); Main sends `open shelf`
   on the first paired state, and on `paired` turning true (the pairing
   approved). Rejected: the backend pushing `103` — design §6 has every view
   answer an `open`, and backend_views is complete.
4. **`paired: false` mid-reading waits for the next shelf.** A session
   revoked from the web is background news (rule 5); the held copies stay
   readable until Back (§When something has changed). Sign out, which the
   person asked for, shows *Not paired* at once.
5. **Sign out asks as a step, with Cancel.** Workflow 19 says it "asks
   once"; the board prints the question under the button. Sign out removes
   every book from the device, so the question is a second tap, not a
   caption: the first tap replaces the button with the question, **Sign
   out** and **Cancel** — one redraw of that part (workflow 19 delta).
   Rejected: the question as a caption with one tap — one tap away from
   losing the device's books.
6. **Settings shows the sync time as it was when opened.** The note and
   the board name it; rule 5 allows the sync word to change by itself only
   on the shelf (workflow 19 delta). Read from the last `101`, so `107` is
   unchanged.
7. **A setlist row names only the key the setlist sets.** `106`'s `key` is
   the item's own property; naming every song's own key would parse every
   song of the setlist on an rM2 (backend_views Decision 3). The song
   screen names it on opening. Workflow 19 delta at L326–329. Rejected:
   adding the song's key to `106` — a backend change for a word the next
   screen already says.
8. **The letter is the title's, accent stripped; absent letters keep their
   cell.** The book's order is the backend's (by path, as the web app's
   book page); the letter goes to the first song with that letter in that
   order. Keeping empty cells keeps every letter in place from book to
   book, as `Book.dc.html` draws it; "not drawn" is still true. Digit- or
   sign-led titles have no letter: twenty-six targets, nothing that leads
   nowhere.
9. **Back reopens the page left on**, by `bookId`, kept in Main. Returning
   to page 1 of a thirty-page book after each song would cost the letter
   row's saving every time. Kept in memory only; nothing written to the
   store (the backend owns the store; the page is not worth a message).
10. **Fixtures generated from the backend's views**, as the sheets are
    (`TestQMLFixtures`): hand-written payloads would drift from
    `messages.go` silently. Small variants (empty shelf, empty book, a
    two-page book) are slices of them built in the test.
11. **Setlist rows inert, the bar's right slot empty, until `reader.play`.**
    The workflow's row tap opens Play, which is `reader.play`'s whole task;
    a plain open-the-song here would be a behavior that task then changes.
12. **Copy in `pages.js`**, one place, English: the reader carries one
    locale (`docs/remarkable-reader.md` §3.1), and the counts need their singular forms tested.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-02.

- Browse screens in `remarkable/qml/browse/`: `pages.js` (paging, letters, count copy), `Region.qml`, `ListBar.qml`, `ListFoot.qml`, `ListRow.qml`, `LetterRows.qml`, `SwipeArea.qml`, and the screens `NotPaired.qml` (with the code page and its expired and offline states), `ShelfScreen.qml`, `BookScreen.qml`, `SetlistScreen.qml`, `SettingsScreen.qml`.
- `remarkable/qml/Main.qml` routes between the screens and the song screen: the shelf opens once paired, Back returns a book to the page it was left on, and only the shelf's sync line changes on its own; `remarkable/qml/chart/metrics.js` and `remarkable/qml/status.js` (comment only) adjusted.
- Ten-row pages turned by swipe or arrows; two rows of thirteen letters (empty cells kept) for books over two pages; Settings with Show all again and a Sign out question with Cancel.
- Fixtures: `remarkable/qml/tests/fixtures/browse-book/` (34 invented songs, 3 setlists) and generated `browse-{shelf,book,book-small,setlist,settings}.js`, written and drift-guarded by `TestQMLFixtures` in `remarkable/internal/backend/qmlfixtures_test.go`.
- Tests: unit `remarkable/qml/tests/tst_browse_pages.qml`; behavior `tst_browse_screens.qml`, `tst_browse_regions.qml`, and `tst_main.qml` rewritten to the screens; gate QML step 152 passed, 0 skipped. No e2e, as scoped.
- Deviations: two files beyond the refinement's list (`Region.qml`, `SwipeArea.qml`); shelf and setlist rows are 150 px as their boards draw them, book rows 120 px; a missing setlist item shows only *missing*, not its key; *Pair with your account* is a white bordered button rather than the board's black one.
- Docs: `docs/workflows/19-remarkable-reader.md` and `remarkable/README.md` updated.
