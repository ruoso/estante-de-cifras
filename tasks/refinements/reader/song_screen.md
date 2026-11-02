# reader.song_screen — The song screen

## TaskJuggler entry

`tasks/85-reader.tji`, `task song_screen` under `task reader` →
`reader.song_screen` (L75–80). Milestone: `milestones.m7_reader`
(`tasks/99-milestones.tji` L58–61).

## Effort estimate

3d.

## Repository

Not under `cifra.md/`: the note does not start with `cifra.md:`. The work
lands in:

- `remarkable/qml/song/` (new): `SongScreen.qml` and its regions —
  `SongBar.qml`, `SongFoot.qml`, `ShapesStrip.qml`, `KeyGrid.qml` — the
  pressed-inverting control `InkButton.qml`, and two pure modules,
  `strip.js` (the strip's size and paging) and `songstate.js` (what a new
  sheet changes).
- `remarkable/qml/chart/`:
  - `SheetView.qml` gains `pagesFor(height)` (pagination of the measured
    blocks at another height, without building pages) and keeps its measured
    units across a height change, so the strip fixpoint and Hide shapes do not
    measure the song twice;
  - `ChordDiagram.qml` gains `inverted` (white on black, for the tapped
    diagram, workflow 19 rule 7);
  - `metrics.js` gains the chrome's sizes (bar 140, foot 100, the strip head
    72, the large strip, the key grid) beside `compactStripHeight`, which
    takes the fixed 72 px head.
- `remarkable/qml/Main.qml`: a `105 sheet` shows the song screen; Back sends
  `open book` (the book screen itself is `reader.browse_screens`).
- `remarkable/qml/tests/`: `tst_strip.qml`, `tst_song_screen.qml`,
  `tst_song_regions.qml`, additions to `tst_main.qml` and
  `tst_chart_pages.qml`, and new fixture songs (below), generated as today by
  `TestQMLFixtures`.
- The key grid's names, which the frontend may not spell (design §3.3):
  - `app/src/device/entry.js` `sheet()` (L124–217): `key.choices`;
  - `remarkable/internal/engine/engine.go` `SheetKey` (L123–131): `Choices`;
  - `remarkable/internal/protocol/messages.go` `SheetKey` (L233–237):
    `choices`;
  - `remarkable/internal/backend/views.go` L452: carried through.

**Design delta (same commit, already written):**

- `docs/workflows/19-remarkable-reader.md` §A song:
  - the shapes' notes follow the chart's last row (L216–219);
  - *Show hidden*'s head, *Hidden on this page · n*, with **Done**
    (L245–247);
  - the key grid opens over the bottom of the page whenever the strip is
    shorter than it, not only with the shapes hidden (L256–259);
  - the grid's names come with the song; *As written* is the written key even
    when a key is saved (L280–283).
- `docs/remarkable-reader.md` §6:
  - `3 key` (L362): `{offset: null}` forgets the device's choice; *As
    written* with a saved key is `{offset: 0}`;
  - `105 sheet` (L375): `key.choices`.

## Inherited dependencies

- `reader.qml_chart` (complete 100): `SheetView` (`sheet`, `page`,
  `pageCount`, `columns`, `pages[{firstRow, chords}]`, `pageOfRow`,
  `preparedPage`, `pagesBuilt`, `pageItem`), `ChordDiagram` (`model`,
  `symbol`, `size`), `Faces`, `metrics.js`, the generated fixtures and
  `walk.js`. Its Decision 1 leaves the strip-height fixpoint, turning, the
  key and hiding to this task; Decision 11 leaves the sheet's `notes` to it
  (`keyNote` goes to `reader.play`).
- `reader.store` (complete 100): the device keeps the key per song
  (`SetKey`, `nil` forgets it), the hidden voicings by tuning, chord and
  frets, and `shapesShown`.
- Settled context, not in `depends`:
  - `reader.backend_views` (complete 100): `3 key` answers the redrawn
    `105 sheet` (`views.go` L564–576); `7 hideShape`, `8 showShape` answer
    the redrawn sheet when a song is open (L578–587); `10 shapesShown`
    answers `101 state` (L135). The offset's order: the device's key over the
    saved transposition (L419–429).
  - `reader.qml_harness`, `reader.app_folder` (complete 100): the AppLoad
    stand-in (`play`, `sent`, `messageSent`), `run.py`, the gate step
    (`scripts/gate` L349–404), `Main.qml`.
  - `reader.key_without_property` (complete 100): `key.named` for a song
    with no `key` is its last chord's key.

Downstream: `reader.browse_screens` (the screens Back leads to, and a song
opened from a book), `reader.play` (the song screen with the place in the
bar and the next song prepared), `reader.missed_shapes` (a found shape on the
next page drawn — the empty place this task keeps).

## What this task is

The song screen of workflow 19 §A song, put together around the chart
`reader.qml_chart` drew:

- **the bar**: *Back*, the title with the artist under it, and the key
  button (*C*, or *D (+2)* while transposed);
- **the chart**, paged by `SheetView`, turned by its left and right thirds, a
  swipe, or the foot's arrows;
- **the strip** of the shapes on this page, in the order they first appear,
  its size and height fixed for the song by its busiest page, paging itself
  past sixteen shapes with its own arrows;
- **the key grid**, in place of the strip, twelve keys chosen in one tap,
  *As written* and *Your key* named;
- **hiding**: a tapped diagram asks to hide that voicing in every song,
  *Show hidden* shows them back, and *Hide shapes* / *Show shapes* lays the
  song out again from the bar at the top;
- **the foot**: *Hide shapes* or *Show shapes*, the page (*2 of 5*, *3 of 3 ·
  End*) and its arrows.

Every action redraws once, and only the region workflow 19's table names;
the tapped control inverts at once. What the person chooses is sent to the
backend to keep; the screen computes no music.

## Why it needs to be done

It is the screen the reader exists for (workflow 19 §A song: "The screen the
reader exists for"). The backend answers a song with a sheet and keeps what
is chosen on the device (`reader.backend_views`, `reader.store`), and the
chart can draw a sheet's pages (`reader.qml_chart`), but nothing yet frames
the chart, turns it, shows its shapes or lets the person choose a key.
`reader.browse_screens`, `reader.play` and `reader.missed_shapes` all build
on this screen.

## Inputs / context

**Governing documents (normative):**

- `docs/workflows/19-remarkable-reader.md`:
  - §The refresh budget (L17–63): rule 1 (one action, one redraw), 2
    (nothing moves), 3 (paged), 4 (fixed chrome), 5 (no background redraw),
    6 (one bit), 7 (the pressed control inverts at once), 8 (choose, don't
    step), 9 (prepare ahead), 10 (targets of at least 100 px; the thirds are
    turn zones).
  - §The screen (L65–96): the bar 140 px, the foot 100 px, *Back* a word
    with its arrow; a one-page screen keeps its foot.
  - §A song (L182–299): the bar (L186–188); shapes on every page and the
    strip's fixed height (L209–222); the strip paging past sixteen
    (L223–230); hiding a voicing, its question, *Show hidden* and the counts
    (L232–250); *Hide shapes* (L252–259); turning and *End* (L262–265); the
    key grid (L267–289); no key property, no chords (L292–296); the costs
    (L298–299).
  - §What it costs, in one table (L336–352): the region each action
    redraws.
- `docs/remarkable-reader.md`:
  - §3.3 (L213–218): the frontend draws and computes no music.
  - §5.4: the reader's own state, never the account's.
  - §6 (L335–405): `3 key`, `7 hideShape`, `8 showShape`, `10 shapesShown`,
    `101 state`, `105 sheet` (L362–375), and *What the backend answers*
    (L388–404).
  - §7 (L406–450): the diagram from its model.
  - §9: QML tests against the AppLoad stand-in.

**The boards (`docs/reader-mockups/`)**, the source of the chrome's sizes:

- `Song.dc.html` L18–83: the bar (*Back* 38 px/700 with its arrow, the
  title 46 px/700, the artist 30 px, the key button 96 px tall, 3 px border,
  40 px/700); the strip (3 px rule, the head 28 px/700 uppercase, eight
  across); the foot (*Hide shapes* 34 px/700 underlined; the arrows 96 × 80,
  the page 34 px).
- `Song-paged.dc.html` L46–52: the strip head 72 px tall, *Shapes on this
  page · 1–16 of 24* with its own ‹ › (96 × 72).
- `Song-known.dc.html` L46–52: *Shapes on this page · 8 · 11 hidden* with
  **Show hidden**.
- `Song-shape-tap.dc.html` L44–56: the question *C#° · x45320 — hide this
  shape in every song?* (88 px, 32 px), **Hide** inverted and **Cancel**;
  the tapped diagram inverted.
- `Song-key.dc.html` L58–75: the grid's head (*Key*, *As written: G*,
  *Your key: A*), six across, keys 100 px tall in Figtree 42 px/700, the
  current one inverted, *As written* and *Close* to the right (300 px wide).
- `Song-hidden.dc.html` L48: *Show shapes* in the foot.

**The code this task extends:**

- `remarkable/qml/chart/SheetView.qml`: `relayout()` (L105–177) measures
  every block at the width, then paginates at `height`; `d.units` holds the
  measured units but is internal, and a height change measures again.
  `pageOfRow` L56–63; `d.show()` L206–226 keeps p−1, p and p+1.
- `remarkable/qml/chart/ChordDiagram.qml`: `model`, `symbol`, `size`; no
  input of its own; a `null` model keeps its place empty.
- `remarkable/qml/chart/metrics.js`: `contentHeight` 1632,
  `compactStripHeight(rows)` L94–97 (a 34 px head line).
- `remarkable/qml/Main.qml` L33–48: handles `101 state` only.
- `remarkable/qml/tests/appload/net/asivery/AppLoad/AppLoad.qml`: `play`,
  `sent[{type, contents, payload}]`, `messageSent`, `clear`.
- `remarkable/qml/tests/tst_chart_pages.qml` L41–48 hosts the view in
  `testCase.parent`; the fixtures carry `key {written, named, saved}`,
  `offset`, `tuningId`, `shapes[{chord, symbol, frets, model, hidden}]`,
  `notes`.
- `app/src/device/entry.js` L124–217 `sheet()`: `key` from
  `read.writtenKey`, `named` by `transposedKeyName` or `songKeyName` (L177);
  `app/src/core/transpose.js` L226 `transposedKeyName(key, semitones)` spells
  a key with the fewest accidentals in the written key's style (glyphs or
  ASCII), keeping a minor `m`.
- `app/src/songs/song-sheet.js` L154–162: `blockNotes`, the voicing block's
  notes, only at the written key; the web app prints them under its shapes
  (`app/src/songs/SongShapes.jsx` L42).

**Checked while refining:** under the gate's Qt (`run.py`, offscreen,
software renderer), `TestCase.grabImage(item)` of items hosted in the
window's root item returns real pixels: after `waitForRendering`, an item
whose child moved compares unequal and its sibling equal, and `pixel(x, y)`
reads black and white. (A `TestCase` that is itself the window root grabbed
white; host the screen in `testCase.parent`, as the chart tests do.)

## Constraints / requirements

- **The screen computes no music** (design §3.3). Key names, the transposed
  chart, which shapes are hidden and their models all come in the sheet. The
  screen only formats the offset as *(+2)* / *(−3)* and finds the current
  choice by `offset`.
- **Regions** (workflow 19 §The screen, the costs table). The screen is
  four regions, fixed in place: the bar (0–140), the chart, the strip (the
  bottom of the content, its height fixed for the song), the foot
  (1772–1872). Each region is one component with a single place where what it
  draws is replaced, and exposes `revision`, bumped there. An action replaces
  only the regions the table names, each once:

  | Action | Regions replaced |
  |---|---|
  | turn a page | chart, strip, foot |
  | open / close the key grid | the strip region (or the grid over the chart's foot, below) |
  | turn the strip; a diagram's question; Cancel | strip |
  | Hide a voicing, the strip keeping its rows | strip |
  | Hide a voicing, the strip losing a row; Show one gaining a row | chart, strip, foot (laid out again from the row at the top) |
  | Hide shapes / Show shapes | chart, strip, foot |
  | choose a key; *As written* | chart, strip, foot, and the key button |
  | a new song | every region |

  The page number in the foot changes with the chart; the bar's title never
  changes while a song is open.
- **The pressed control inverts at once and nothing else does** (rule 7).
  `InkButton` (a `MouseArea` over a `Rectangle` and `Text`) is black with
  white text while pressed, and for a control whose action waits on the
  backend (a key, *As written*, **Hide**, a hidden shape tapped to show, *Hide
  shapes*) it stays inverted until the answer replaces its region. No other
  item changes before the answer. A tapped diagram inverts
  (`ChordDiagram.inverted`) and stays so while its question is asked.
- **Targets** (rule 10): every control at least 100 px on its short side
  except where the boards draw less inside a fixed region (the strip head's
  72 px buttons, the foot's 96 × 80 arrows, the question's 68 px buttons —
  the boards' sizes, kept). Each control's `MouseArea` is at least
  100 × 100 even when its ink is smaller.
- **Turning** (§A song L262–265):
  - a tap in the chart's left third goes back, the right third forward; the
    middle third does nothing;
  - a horizontal swipe of at least 120 px across the chart turns (right to
    left forward); a swipe is one turn, whatever its length;
  - the foot's ‹ › do the same;
  - the strip, the key grid and the bar are never turn zones (§A song
    L229–230);
  - on the last page *next* does nothing and the foot reads *3 of 3 · End*;
    on the first, *previous* does nothing;
  - a turn sets `SheetView.page` (the prepared page shown, rule 9) and
    replaces the strip with that page's shapes, starting at its first
    sixteen.
- **The strip** (§A song L209–230), computed by `strip.js` from the sheet's
  `shapes` and `SheetView`'s `pages[].chords`:
  - a page's shapes are its `chords` mapped to `shapes` by `chord` in that
    order, split into *shown* (`hidden: false`, a pending one included as an
    empty place) and *hidden*;
  - the song's size: **large** (`ChordDiagram` large, one row of up to
    five) when no page shows more than five, else **compact** (eight to a
    row, `min(2, ceil(n / 8))` rows by the busiest page);
  - the height: the 72 px head plus its rows (`metrics.stripHeight(size,
    rows)`); a song whose pages show no shape but hide some keeps the head
    alone, so *Show hidden* stays reachable; a song with no shapes has no
    strip;
  - **fixed for the song by its busiest page**: start at the most a strip
    can be (compact, two rows); paginate the chart in what is left
    (`pagesFor`); size the strip by the busiest page of that pagination; if
    smaller, paginate again in the larger chart and keep the smaller strip
    only when the new busiest page still fits it, else the first. Two
    paginations at most; the strip never holds fewer rows than one of its
    pages needs;
  - the head: *Shapes on this page · 8*; with hidden ones *· 11 hidden* and
    **Show hidden**; past sixteen *Shapes on this page · 1–16 of 24* with ‹ ›
    and *1 of 2*, turning the strip only; paged and hiding at once, both;
  - *Show hidden* turns the strip to the page's hidden shapes, the head
    *Hidden on this page · 3* with **Done**; a hidden shape tapped sends
    `8 showShape` and the strip stays in this mode until **Done** or a turn;
  - a pending shape (`model: null`) keeps its empty place and is not
    tappable.
- **Hiding a voicing** (§A song L232–250):
  - a tapped diagram: the head becomes *C#° · x45320 — hide this shape in
    every song?* (`symbol · frets`) with **Hide** and **Cancel** — the strip
    region only;
  - **Hide** sends `7 hideShape {tuningId, chord, frets}` from the sheet and
    the shape; the answer is a sheet with the same rows, and only the strip
    is replaced, unless the busiest page now needs fewer rows, when the song
    is laid out again from the row at the top of the page;
  - **Cancel** puts the head back, no message.
- **Hide shapes / Show shapes** (§A song L252–259): sends `10 shapesShown
  {shown}`; the backend's `101 state` with the new `shapesShown` lays the
  song out again without (or with) the strip, at
  `pageOfRow(firstRow of the page that was on screen)`. The screen reads
  `shapesShown` from the last `101 state` (default shown before one).
- **The key** (§A song L267–296; design §6 as amended):
  - the key button shows `key.named`, and while `offset ≠ 0`
    `named (+offset)` with a true minus sign; it is absent, and so is the
    strip, for a song with no chords (`key.choices` empty);
  - it opens the grid in the strip's region; when the strip is shorter than
    the grid (or hidden), the grid covers the bottom of the chart from the
    foot up, and closing it restores the chart there;
  - the grid's head: *Key*, *As written: G* (`key.written`, else the named
    key at offset 0 from `choices`), *Your key: A* (`key.saved`, only when it
    differs from as written); the twelve `choices` in their order, six
    across, the one whose `offset` equals the sheet's inverted;
  - a key sends `3 key {offset}`; *As written* sends `{offset: 0}` when a
    key is saved, `{offset: null}` when none is; *Close* puts the strip back
    with no message;
  - the answering sheet is laid out from its first page, the grid closed
    (one redraw: chart, strip, foot and the key button).
- **A new sheet**, decided by `songstate.js` from the shown sheet and the
  one received: a different `bookId`, `path` or `offset`, or different
  `rows`, is a new layout (page 0 for a new song or key); the same song at
  the same offset with the same `rows` (a `hideShape`/`showShape` answer) is
  a re-voicing: the chart and the page are kept and only the strip is
  recomputed — the rule above for a lost or gained row.
- **The shapes' notes** (workflow 19 §A song as amended L216–219): when
  `sheet.notes` is non-empty, the screen hands `SheetView` the sheet with one
  more `notes` row after the last (`{type: "notes", paragraphs: notes}`, the
  shape `chartRows` gives its own), so they are laid out on the last page as
  any notes are. `keyNote` and `play` are `reader.play`'s.
- **Fixed chrome, one bit, nothing moving** (rules 2, 4, 6): the walk of
  `walk.js` `oneBitProblems` is clean on every state of the screen; no
  `Timer`, `Behavior`, `Animation`, opacity or grey.
- **Background news never redraws** (rule 5): a `105 sheet` only ever
  answers an action of this screen or an `open`; any other message
  (`101 state` with the same `shapesShown`, `103`, `107`) changes nothing on
  the song screen.
- **Main.qml routes** the views it can draw: a `105 sheet` shows the song
  screen (or updates the one shown); *Back* sends `2 open {view: "book",
  bookId}`; any other view message (`103`, `104`, `106`, `107`) hides the
  song screen and shows the status line as today, until
  `reader.browse_screens` draws those views. Main still says hello and keeps
  the state.
- **The bundle names the keys** (design §6 as amended): `sheet()` returns
  `key.choices`, twelve `{name, offset}` with offsets −5…+6, ordered by the
  key's root pitch class from C, each `transposedKeyName(asWritten, offset)`
  where `asWritten` is the written key or, without one, `songKeyName` of the
  untransposed model; `[]` when the song has no chords. The field is
  additive: `hostApi` stays 1. Go carries it through `engine.SheetKey` and
  `protocol.SheetKey` unchanged.
- **Songs written for the purpose.** New fixture songs are original; no
  board song (*Noites Cariocas*, *Três Estrelinhas*) is used.

## Acceptance criteria

### Behavior delivered

- `SongScreen.qml` with the properties `sheet`, `shapesShown`, `endpoint`
  (the `AppLoad` item it sends through), the read-only `region` items
  (`bar`, `chart`, `strip`, `foot`, each with `revision`), and the behavior
  of §Constraints.
- `SheetView.pagesFor(height)` → `[{firstRow, chords}]` for the measured
  blocks at another column height, without building a page; a height
  change reuses the measured blocks (`pagesBuilt` and the existing chart
  tests unchanged).
- `ChordDiagram.inverted`; `metrics.stripHeight(size, rows)`,
  `metrics.keyGridHeight` (380, `Song-key.dc.html` L143), `metrics.barHeight`, `metrics.footHeight`.
- `strip.js` (`.pragma library`): `pageShapes(sheet, chords)`,
  `stripSize(pagesFor, sheet, contentHeight)` → `{size, rows, height,
  pages}`, `stripPage(shown, n)`; `songstate.js`: `change(shown, received)`
  → `"new" | "revoiced"`.
- `key.choices` from the bundle through to the `105 sheet`.

### Tests, by level

All QML tests live under `remarkable/qml/tests/` and run in the gate's step
*estante reader: QML tests* (`scripts/gate` L372–374). The screen is hosted
in `testCase.parent` with `waitForRendering` before each `grabImage`
(§Inputs, checked while refining). Region checks use both **pixels**
(`grabImage` of each region before and after: equal where the table says
untouched, unequal where touched) and **`revision`** (exactly +1 per
replaced region per action — no intermediate state, rule 1).

**New fixture songs** (`remarkable/qml/tests/fixtures/songs/`, written for
the purpose, generated to `fixtures/*.js` by `TestQMLFixtures`):

- `strip-17`: an all-chords song whose first page holds seventeen distinct
  chords at the compact two-row strip's height, and a second page of fewer.
- `few-chords`: a sung song in G of seven chords — one compact row, shorter
  than the key grid — two pages, and a voicing block note.
- `no-chords`: words only.
- The existing `choro-31`, `choro-long` and `two-columns` serve too.
- Variants `TestQMLFixtures` gains, the same songs generated with other
  state through the same `newViewsFixture` machinery: `choro-long-hidden.js`
  (the store hiding one voicing of its first page), `few-chords-up2.js` (the
  device's key at +2), `few-chords-saved.js` (a saved transposition of +2 in
  the fixture book's `songs.json`, so *Your key: A*).

**unit (QML/JS), `tst_strip.qml`** (`TestCase` `name: "Strip"`, over
`strip.js` and `songstate.js` with a hand-built `pagesFor`):

- `test_pageShapesInFirstOrder`: a page's shapes are its chords' shapes in
  first-appearance order; a chord on two pages is on both (§A song L209–213).
- `test_largeWhenFewCompactWhenMany`: five shown on the busiest page →
  large, one row; six → compact, one row; seventeen → compact, two rows
  (§A song L213–216).
- `test_heightFixedByBusiestPage`: the fixpoint returns the busiest page's
  strip, and never a strip smaller than a page of its own pagination needs —
  a `pagesFor` whose busiest page grows when the chart grows keeps the larger
  strip (§A song L216–219).
- `test_hiddenSplitAndCounted`: hidden shapes leave the shown list and are
  counted; all hidden → the head alone; no shapes → no strip (§A song
  L242–250).
- `test_stripPagesPastSixteen`: 24 shown → pages of 16 and 8, labelled
  *1–16 of 24* (§A song L223–230).
- `test_revoicedOrNew`: same book, path, offset and rows → `revoiced`; a
  different offset, path or rows → `new`.

**behavior (QML), `tst_song_screen.qml`** (`TestCase` `name: "SongScreen"`,
`SongScreen` over the fixtures with the AppLoad stand-in as `endpoint`):

- `test_barFootAndStripDrawn`: *Back* with its arrow, the title and artist,
  the key button *G*; the foot's *Hide shapes*, *1 of 3* and arrows; the
  strip's head and diagrams (§A song L186–188, §The screen L84–90).
- `test_turnByThirdsSwipeAndArrows`: a tap in the right third, a swipe right
  to left, and › each go one page forward; the left third and ‹ back; the
  middle third and the strip do nothing; *End* on the last page, where next
  does nothing (§A song L262–265; §The screen L86–87).
- `test_turnShowsPreparedPage`: a turn shows the page `SheetView` had
  prepared (`pagesBuilt` up by one, for the page after) and the strip shows
  that page's shapes (rule 9; §A song L209–213).
- `test_keyChosenInOneStep`: on page 2 of `few-chords`, the key button
  opens the grid with the twelve `choices` in their names, *G* inverted,
  *As written: G*; tapping *A* sends exactly one `3 key {offset: 2}`; the
  answer, `few-chords-up2`, closes the grid and shows page 1 in A with
  *A (+2)* on the button (§A song L267–289, rule 8).
- `test_asWrittenAndYourKey`: on `few-chords-saved`, *Your key: A* is named
  and *As written* sends `{offset: 0}`; on `few-chords`, no *Your key*, and
  *As written* sends `{offset: null}` (design §6 as amended).
- `test_noChordsNoKeyNoStrip`: `no-chords` has no key button and no strip;
  the chart has the whole content (§A song L295–296).
- `test_stripPagedAtSeventeen`: `strip-17` page 1 says *Shapes on this
  page · 1–16 of 17* with *1 of 2*; › turns the strip to the seventeenth shape and
  leaves `SheetView.page` and the chart's pixels unchanged (§A song L223–230).
- `test_hideVoicingAsksThenSends`: tapping a diagram inverts it and asks
  *symbol · frets — hide this shape in every song?*; *Cancel* restores the
  head and sends nothing; *Hide* sends one `7 hideShape {tuningId, chord,
  frets}` matching the sheet (§A song L232–240; design §6).
- `test_showHiddenAndShowShape`: with `choro-long-hidden`, the head says
  *· 1 hidden* and **Show hidden**; it turns the strip to *Hidden on this page
  · 1* with **Done**; tapping the shape sends one `8 showShape`
  (workflow 19 §A song L245–247 as amended).
- `test_hideShapesFromTheBarAtTheTop`: on page 2 of `choro-long`, *Hide
  shapes* sends `10 shapesShown {shown: false}`; the `101 state` answer lays
  the song out with no strip at the page holding the row that was at the
  top; *Show shapes* does the reverse (§A song L252–257).
- `test_shapesNotesOnLastPage`: `few-chords`' block note is drawn after the
  chart's last row, on the last page (workflow 19 §A song L216–219 as
  amended).
- `test_pendingShapeKeepsPlace`: a shape with `model: null` keeps an empty
  place and a tap on it does nothing (design §6, §4.1).
- `test_oneBitEveryState`: `oneBitProblems` is empty with the strip, the
  grid, the question and *Show hidden* open (rule 6).

**behavior (QML), `tst_song_regions.qml`** (`TestCase` `name:
"SongRegions"`) — each action changes only its region, once (workflow 19
§What it costs; rules 1, 4, 7):

- `test_pressInvertsOnlyTheControl`: pressing the key button, a grid key,
  *Hide shapes* and a diagram makes that control black (its `grabImage`
  centre pixel black, the rest of its region's pixels unchanged) and no
  region's `revision` moves before release and answer (rule 7).
- `test_keyGridOnlyTheStrip`: open and close the grid: the strip region
  `revision` +1 each; bar, chart and foot pixels equal (costs table row 5).
- `test_keyGridOverChartWhenStripShort`: on `few-chords` (a one-row
  compact strip, 321 px, shorter than the grid) and with the shapes hidden, the grid covers the
  chart's foot; the bar, the foot and the chart above the grid are
  unchanged, and closing restores the chart's pixels exactly (§A song
  L256–259 as amended).
- `test_stripTurnOnlyTheStrip`: the strip's › — strip +1, others unchanged
  (costs row 6).
- `test_questionAndCancelOnlyTheStrip`: tap a diagram, then *Cancel* —
  strip +1 each, others unchanged (costs row 7).
- `test_hideVoicingKeepingRowsOnlyTheStrip`: a hide whose answer keeps the
  rows: strip +1, chart, bar and foot unchanged (costs row 8).
- `test_hideVoicingLosingARowRelaysOnce`: a hide whose answer drops the
  busiest page to one row: chart, strip and foot +1 each, the bar unchanged
  (costs row 8, "the content too when the strip loses a row").
- `test_turnContentAndFoot`: a turn: chart, strip and foot +1; the bar's
  pixels unchanged (costs row 3).
- `test_hideShapesOnce`: chart and foot +1 each, the bar unchanged (costs
  row 9).
- `test_chooseKeyOnce`: chart, strip, foot and the bar's key button +1; the
  bar's title and *Back* pixels unchanged (costs row 10).
- `test_backgroundNewsChangesNothing`: a `101 state` with the same
  `shapesShown`, a `103 shelf` played while a song is open in a
  `SongScreen` alone — no region's pixels change and no `revision` moves
  (rule 5).

**behavior (QML), `tst_main.qml`** (additions):

- `test_sheetShowsSongScreen`: a played `105 sheet` shows the song screen
  with the sheet's title; a `104 book` afterwards hides it again.
- `test_backOpensTheBook`: *Back* sends one `2 open {view: "book",
  bookId}` (design §6).

**unit (QML/JS), `tst_chart_pages.qml`** (additions):

- `test_pagesForMatchesALayout`: `pagesFor(h)` equals the `pages` a
  `SheetView` laid out at `h` gives, for `choro-long` and `two-columns` at
  two heights, without building a page (`pagesBuilt` unchanged).

**unit (JS, Vitest), `app/src/device/entry.test.js`** (additions, the
bundle's music under Node, as `reader.bundle` tests it):

- `it('names the twelve keys of the grid from the written key')`: a song in
  C → C, Db, D, Eb, E, F, F#, G, Ab, A, Bb, B with offsets 0, 1, 2, 3, 4, 5,
  6, −5, −4, −3, −2, −1 (as `transposedKeyName` spells them); a minor song
  keeps `m`; a song written with ♭ glyphs keeps glyphs (design §6 as
  amended; `transpose.js` L226).
- `it('names the grid of a song with no key from its last chord')` (the
  `key_without_property` rule).
- `it('gives no choices to a song with no chords')`.
- `it('gives the same choices at every offset')`: `choices` do not depend on
  the offset the sheet is read at.

**unit (Go)**:

- `remarkable/internal/protocol/messages_test.go`: the `105 sheet`
  round-trip carries `key.choices`.
- `remarkable/internal/engine/bundle_test.go`: every example-book song's
  `Key.Choices` are twelve, offsets −5…+6, at all twelve offsets (the built
  bundle, as the existing twelve-key test reads them).
- `remarkable/internal/backend/views_test.go`: an `open song` answers a
  sheet whose `key.choices` are the engine's.
- `remarkable/internal/backend/qmlfixtures_test.go` `TestQMLFixtures`: the
  new fixtures (and `choro-long-hidden`, `few-chords-up2`) are generated and
  checked for drift like the others.

**No e2e level.** The note names behavior (QML) only; the reader has no
e2e-web harness (design §9 names the QML harness as the frontend's level),
and a song cannot be reached on the device through the UI until
`reader.browse_screens` draws the book.

## Decisions

1. **The key grid's names come in the sheet (`key.choices`), spelled by the
   bundle.** The sheet carried only `written`, `named` and `saved`, and the
   grid must name twelve keys "in the song's own spelling".
   - Rejected: spelling them in QML from the written key — that is music in
     the frontend (design §3.3), a second `transposedKeyName`.
   - Rejected: asking the backend for a sheet per offset — twelve readings
     to open a grid, and a new message.
   - The field is additive, so `hostApi` stays 1; design §6 is amended.
2. **Regions with a single commit point, checked by pixels and by
   `revision`.** The cost table is the contract, and the panel's partial
   update follows what Qt repaints. `grabImage` per region (checked to work
   under the gate's Qt) pins "only its region"; a `revision` per region pins
   "once" (no intermediate state, which pixels after the fact cannot see).
   - Rejected: pixel diffs of the whole window — 2.6 M `pixel()` calls per
     comparison; region grabs with `equals` are cheap.
   - Rejected: `revision` alone — it trusts the component's own account.
3. **The strip's height by a bounded fixpoint over `pagesFor`.** The strip
   depends on the pages and the pages on the strip. Two paginations of
   already-measured blocks, keeping the larger strip on any doubt, settle it
   and never leave a page without room for its shapes. `SheetView` gains
   `pagesFor` because pagination at another height is cheap once measured,
   and measuring is the expensive part.
   - Rejected: a second invisible `SheetView` — measures twice.
   - Rejected: always the largest strip — wastes a row of the chart on most
     songs (workflow 19 sizes the strip by the busiest page).
4. **Large up to five shown on the busiest page, compact beyond.** Workflow
   19 says "few … four or five across; many … compact, eight to a row".
   Five large diagrams (5 × 170 + gaps) fit 1308 px in one row; a sixth would
   need a second large row (≈ 270 px) where one compact row (208 px) holds
   eight.
5. **The strip head is a fixed 72 px**, as `Song-paged` and `Song-known`
   draw it, so the head's buttons appearing (*Show hidden*, the strip's
   arrows) never change the strip's height. `compactStripHeight` moves from
   the 34 px text line to it.
6. **The key grid over the chart's foot when the strip is shorter.** The
   grid needs two rows of 100 px keys (rule 10) and its head; a one-row
   compact strip or a large one is shorter. Shrinking the keys below 100 px
   breaks rule 10; changing the strip's height for the grid would move the
   chart. Covering the chart's foot is what workflow 19 already does with the
   shapes hidden — now said for both (workflow 19 delta).
7. ***As written* sends `{offset: 0}` when a key is saved.** The backend
   reads the device's key over the saved transposition, and `{offset:
   null}` forgets the device's choice, so with a saved key `null` would open
   the song at *Your key*, not as written. Without a saved key, `null`
   clears the device's state (the store holds nothing it does not need).
   Design §6 is amended to say so; the backend is unchanged.
8. **A re-voicing keeps the chart.** A `hideShape`/`showShape` answer is a
   whole sheet; telling it from a new song by book, path, offset and rows
   lets the strip alone redraw (the cost table), and the chart is laid out
   again only when the strip's rows change.
9. **Hide shapes waits for the `101 state`.** Applying it before the answer
   would be right almost always, but the backend owns the state (it answers
   nothing when the store fails); waiting about a frame keeps the screen and
   the store in agreement, and the inverted control covers the wait
   (rule 7).
10. **The shapes' notes after the chart's last row** (workflow 19 delta).
    The web app prints them under the shapes; the strip has no room for
    words without changing its fixed height per page. Appended as a `notes`
    row, they paginate with the chart and draw in the notes face.
11. **Main.qml routes only the sheet.** The song screen must be mountable
    from the backend's messages for `reader.play` and the book screen;
    drawing the other views is `reader.browse_screens`. Until then those
    views show the status line.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-02.

- The song screen: `remarkable/qml/song/{SongScreen,SongBar,SongFoot,ShapesStrip,KeyGrid,InkButton,Chevron}.qml`, shown by `remarkable/qml/Main.qml` for a `105 sheet`; each action replaces only its regions, once, with the pressed control inverting at once.
- `remarkable/qml/song/strip.js` (pageShapes, stripSize, stripPage) and `songstate.js` (change); `SheetView.pagesFor(height)` in `remarkable/qml/chart/SheetView.qml`; `ChordDiagram.inverted`; `metrics.js` gains stripHeight, keyGridHeight, barHeight, footHeight (the old bars-row `barHeight` renamed `barsHeight`).
- `key.choices` from the bundle (`app/src/core/transpose.js` `keyChoices`, `app/src/device/entry.js`) through the Go engine, protocol and views (`remarkable/internal/{engine,protocol,backend}`) to the `105 sheet`.
- Fixture songs `few-chords`, `strip-17`, `no-chords` and generated fixtures (incl. `choro-long-hidden`, `few-chords-up2`, `few-chords-saved`) under `remarkable/qml/tests/fixtures/`; the five existing fixtures regenerated with `key.choices`.
- Tests: `tst_strip.qml`, `tst_song_screen.qml`, `tst_song_regions.qml`, additions to `tst_chart_pages.qml` and `tst_main.qml`; Vitest in `app/src/device/entry.test.js`; Go in `messages_test.go`, `bundle_test.go`, `views_test.go`, `qmlfixtures_test.go`.
- Departures: C at +6 is Gb (as `transposedKeyName` spells it); `test_barFootAndStripDrawn` uses `few-chords` (*1 of 2*); the hide question is 84 px tall to fit the head; the key button is not inverted while the grid is open (costs table keeps the bar's pixels unchanged).
- Docs updated: `docs/remarkable-reader.md`, `docs/workflows/19-remarkable-reader.md`, `remarkable/README.md`.
