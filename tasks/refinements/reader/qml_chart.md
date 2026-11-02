# reader.qml_chart — The chart and its diagrams, in QML

## TaskJuggler entry

`tasks/85-reader.tji`, `task qml_chart` under `task reader` →
`reader.qml_chart` (L68–73). Milestone: `milestones.m7_reader`
(`tasks/99-milestones.tji` L58–61).

## Effort estimate

3d.

## Repository

Not under `cifra.md/`, because the note does not start with `cifra.md:`. The
work lands in:

- `remarkable/qml/chart/` (new). The chart's components and its two pure
  modules:
  - `SheetView.qml`
  - `ChartBlock.qml` and the row components it chooses between
  - `ChordDiagram.qml`
  - `Faces.qml`
  - `blocks.js` (rows → blocks)
  - `paginate.js` (blocks + heights → pages)
  - `metrics.js` (the sizes, in one place)
- `remarkable/qml/fonts/` (new). The app's font files and their `LICENSE`s,
  byte for byte from `app/src/theme/fonts/`:
  - `figtree/`
  - `atkinson-hyperlegible/` (400 and 700)
  - `atkinson-hyperlegible-mono/`
- `remarkable/qml/tests/`. The new tests (`tst_chart_*.qml`,
  `tst_paginate.qml`, `tst_chord_diagram.qml`) and `fixtures/`:
  - `fixtures/songs/*.cifra.md`, songs written for the purpose
  - `fixtures/*.js`, the sheets generated from those songs
- `remarkable/qml/tests/check_folder.py`. The folder check also compiles
  `chart/SheetView.qml` from the rcc and checks that the faces load from it.
- `remarkable/internal/backend/qmlfixtures_test.go` (new). Generates the QML
  fixtures through the real backend, and fails when they have drifted.
- `remarkable/tools/appfolder/appfolder_test.go`. One case: the rcc carries
  the fonts and their licences.
- `remarkable/README.md`. A paragraph on regenerating the QML fixtures.

**Design delta (same commit):**

- `docs/workflows/19-remarkable-reader.md`:
  - §The screen (L92–96): the faces are the app's files, plus Atkinson
    Hyperlegible Mono for verbatim blocks.
  - §A song (L190–209):
    - the column rule also weighs the widest row of four bars;
    - a block of bars taller than a column breaks between its rows of four;
    - a line of bars keeps its own breaks;
    - an ending's label is its number as an ordinal (*1st*, *2nd*), which
      replaces the drawn *to B*.
- `docs/remarkable-reader.md`:
  - §7 (L416–429): the diagram's parts, the face for the fingers, and the
    faces travelling as the app's `woff2`.
  - §11 (L513–516): the risk of WOFF2 on the device.

## Inherited dependencies

- `reader.app_folder` (complete 100):
  - `remarkable/qml/Main.qml` is the root, at 1404 × 1872.
  - `appfolder.go` `qmlFiles` (L175–212) puts every file under
    `remarkable/qml/` into `resources.rcc`, except dotfiles, `tests/` and
    `harness/`. New `chart/` and `fonts/` files therefore ship with no list to
    edit (app_folder Decision 6).
  - Tests reach the code by directory import (`import ".."`, as
    `tst_main.qml` L8 does).
- `reader.qml_harness` (complete 100):
  - `remarkable/qml/tests/run.py` is Qt 6.12's `qmltestrunner` on
    PySide6-Essentials, offscreen, with the software renderer. It runs every
    `tst_*.qml` under `remarkable/qml/tests/`.
  - The gate's step is in `scripts/gate` L349–404.
  - `check_folder.py` loads each folder's rcc the way AppLoad does.
- Settled context, not in `depends`:
  - `reader.protocol` and `reader.backend_views` (complete 100) fixed the
    `105 sheet` payload: `remarkable/internal/protocol/messages.go` L215–248;
    built in `remarkable/internal/backend/views.go` L447–475.
    - `rows` is `chartRows(read.model)` with no `markEmpty`
      (`app/src/device/entry.js` L211).
    - Each shape's `model` is `diagramModel(fingering, { handed })`
      (`entry.js` L197), or `null` while the shape is pending.
  - `views_test.go` (L79–334) has the helpers the fixture generator reuses:
    `builtEngine`, `newViewsFixture`, `serve`, `openSong`.

Downstream: `reader.song_screen` (`depends !qml_chart, !store`) puts
`SheetView` and `ChordDiagram` into the song screen: the bar, the foot, the
strip, turning, the key grid and hiding. `reader.play` (L137) depends on this
task too.

## What this task is

This task is the drawing half of the song screen, with no chrome. It has
three parts.

**`SheetView`** takes a `105 sheet` payload and the size of the area it may
use, and does four things:

- turns `rows` into keep-together blocks;
- decides one column or two;
- lays the song out into pages, as workflow 19 §A song decides;
- draws the current page, with the next one already built.

It also tells its user what the layout found: how many pages there are, how
many columns, which row starts each page, and which chords are on each page,
in the order they first appear. The song screen needs those to fix its strip
and to lay the song out again from a given bar.

**`ChordDiagram`** is one component at two sizes, large and compact. It draws
a `diagramModel` with pixel-aligned black `Rectangle`s and `Text`, on white.

**`Faces`** loads the reader's three faces from its own files.

Nothing in this task listens on the AppLoad socket, draws the bar, the foot
or the strip, or sends a message. Those belong to `reader.song_screen`.

## Why it needs to be done

The reader exists to show a song on a music stand (workflow 19 §A song). The
backend already answers `open song` with a `sheet` (`reader.backend_views`),
but nothing on the device can draw it.

The layout is the hard part of the screen. It is decided once, in the
frontend (design §6, L383–386: "The frontend lays the pages out"). Every
later screen task builds on it:

- `reader.song_screen` sizes its strip from the chords per page;
- Hide shapes lays the song out again from a row;
- `reader.play` prepares the first page of the next song.

Getting it right in isolation, against real `chartRows` output, keeps those
tasks about interaction.

## Inputs / context

**Governing documents (normative):**

- `docs/workflows/19-remarkable-reader.md`:
  - §The refresh budget (L17–63). The rules that apply here:
    - rule 1: one action, one redraw, nothing drawn incomplete;
    - rule 2: nothing animated;
    - rule 3: paged, never scrolled;
    - rule 6: one bit, strokes of at least 2 px;
    - rule 9: the next page laid out ahead.
  - §The screen (L65–96): the screen is 1404 × 1872, the bar 140 px, the foot
    100 px, so the content is 1632 px tall. The faces are named here, and this
    task's delta edits that passage.
  - §A song (L182–293):
    - the chart in pages (L190–198);
    - all-chord songs (L200–207);
    - shapes on every page and the strip's fixed height (L209–220), which the
      song screen consumes;
    - Hide shapes laying out again from the bar at the top (L248–256).
- `docs/remarkable-reader.md`:
  - §3.3 (L213–218): the frontend computes no music.
  - §6 (L335–405): the `sheet` row and the paragraph on `rows` (L379–388).
  - §7 (L406–440): the diagram drawn from its model, live first.
  - §9 (L476–495): the frontend test level.
  - §11 (L504–520): drawing-speed risks.

**The mockups (`docs/reader-mockups/`, which follow workflow 19's own
rules):** the boards are the source for the sizes in `metrics.js`.

- `Song.dc.html`:
  - content padding 20/48 px;
  - section names in Atkinson Hyperlegible 34 px/700;
  - bars four to a row (`repeat(4, 1fr)`, L36–38), 72 px tall, chords in
    Figtree 40 px/700, 3 px bar lines (L92–98);
  - endings as rows with a label in the first cell (L100, L114–117);
  - the compact diagram is 124 × 168, with strings 20 px apart, frets 26 px
    apart, the nut 6 px, 22 px dots, and the finger in the dot in Atkinson
    16 px/700, white (L121–142).
- `Song-lyrics.dc.html`:
  - two columns with a 64 px gap (L30);
  - a sung segment is a chord (Figtree 38 px/700, line 50 px) over words
    (44 px, line 56 px), and segments wrap as units (L44–50);
  - bars inside a sung song (L38–40);
  - the large diagram is 170 × 222, with strings 30 px apart, frets 34 px
    apart, the nut 8 px, 26 px dots and 3 px strokes (L123–140).
- `Song-hidden.dc.html` (L67–84): a whole all-chord song on one page with the
  shapes hidden.

**The data:**

- `app/src/chart/layout.js` L339–368, `chartRows`. The row types and their
  fields:
  - `section{name, times?}`
  - `sung{segments[{chord, words, hyphen, tail, token, voice, before?, after?}]}`
  - `bars{measures, cells[[{text, token, before?, after?}]], marks?[{open, close, count, ending}], numbers, grid, spans}`
  - `run{text, tokens}`
  - `words{text}`
  - `gap{grid?}`
  - `notes{paragraphs}`
  - `verbatim{info, text}`
  - `empty{}`

  `alignBars` (L389–416) gives a block of bars rows one shared `grid`. The
  rows' renderer in the app is `app/src/chart/Chart.jsx` `Row` (L271–392),
  and its `RuleMarks` (L241–270) draws endings as `n.` and counts as `×n`.
  The empty row's copy is `reading.emptySection`, *Nothing written here yet.*
  (`app/src/i18n/locales/en.js` L1713).
- `app/src/render/diagram.js` L41–108, `diagramModel`, returns
  `{ stringCount, fretsShown, startFret, showNut, dots[{stringIndex, fret, finger, row}], barre{fret, row, fromString, toString, finger}|null, markers[{stringIndex, kind:'muted'|'open'}], orientation, handed, size }`.
  - Strings are already mirrored for left-handed players.
  - Notes under the barre are not in `dots`.
- `app/src/render/chord-box.js` L48–160 is the app's SVG of the same model:
  - the fret number is the plain `startFret`, to the left of row 0, drawn
    only when `startFret > 1`;
  - the finger is inside the dot;
  - open marks are a ring, muted marks an X.
- `app/src/songs/print-columns.js` L38–49 and `app/src/songs/reading.css`
  L323–375 are the printed book's rule, which workflow 19 adapts:
  - the column width is measured from the widest sung line, or else the
    widest bar grid;
  - columns are filled, not balanced;
  - `break-inside: avoid` on sung lines, bar grids and run lines, and
    `break-after: avoid` on section names.
- `app/src/theme/fonts/README.md`: the files are OFL 1.1 and kept byte for
  byte, never re-encoded.
- `remarkable/qml/Main.qml`, `remarkable/qml/tests/tst_main.qml`,
  `remarkable/qml/tests/check_folder.py` L26–72 are the patterns to follow.

**Checked while refining:** the gate's Qt (PySide6 6.12, offscreen) loads
`figtree-latin-wght-normal.woff2` and
`atkinson-hyperlegible-latin-700-normal.woff2` with `FontLoader`, and both
reach `status` Ready. The variable Figtree reports its name as
*Figtree Light*, its default instance, so text asks for the family
`Figtree` and a `font.weight`.

## Constraints / requirements

- **The frontend computes no music** (design §3.3). The chart draws the
  text the rows carry: `segment.chord`, `cell.text`, `section.name`. It
  never re-spells, transposes or names a chord. The chords a page carries are
  identified by `token.key`, the engine's identity, which is the same value
  as `shapes[].chord`.
- **One bit** (rule 6):
  - every `Rectangle` is `#000000` or `#ffffff`, with `antialiasing: false`;
  - every `Text` is black, or white inside a black dot;
  - strokes are at least 2 px;
  - geometry is integral: `x`, `y`, `width` and `height` are whole pixels;
  - no opacity, no gradient, no `Behavior`, no `Animation`, no `Timer`
    (rule 2).
- **Laid out once, drawn once** (rules 1 and 9):
  - the layout is computed synchronously when `sheet`, `width`, `height` or
    `shapesShown`-driven size changes;
  - the page's items exist complete before it is visible;
  - the next page is built (invisible) as soon as the current one is shown;
  - turning to it makes it visible and builds the one after, never building
    the shown page again. No `Loader { asynchronous: true }`, which would
    show a page before it is complete.
- **Keep-together** (workflow 19 §A song, as amended):
  - a sung line is never split, including its wrapped continuation lines;
  - a block of bars is never split. It is a maximal run of consecutive `bars`
    rows, together with the `gap` rows that carry its `grid`. Only when a
    block is taller than a whole column does it break, and then between rows
    of four;
  - a section name is never the last block of a column;
  - a `gap` at a column's top is dropped;
  - a `notes` or `verbatim` block taller than a column breaks between
    paragraphs or lines; otherwise it is whole. `run` and `words` blocks are
    always whole;
  - a column is filled to its foot before the next begins.
- **Columns:**
  - two columns, `(width − 64) / 2` each, when both the longest sung line's
    natural width (its segments unwrapped) and the widest row of four bars
    fit one column;
  - otherwise one column of the full width;
  - in one column, a sung line wider than the page wraps between segments,
    as the boards do.
- **Bars:**
  - four to a row, each a quarter of the column, at least wide enough for its
    cells at the chart size;
  - a line of bars keeps its own breaks;
  - a measure with `marks.ending` starts a new row whose first place holds
    the ordinal label (*1st*, *2nd*, *3rd*, *4th*…). That ending row then
    holds up to three bars;
  - `marks.open` and `marks.close` are drawn as a repeat sign from
    `Rectangle`s: a 6 px and a 3 px line with two 8 px dots, mirrored for a
    close;
  - `marks.count` is drawn as `×n` after the close;
  - bar numbers (`numbers`) are not drawn. The boards draw none, and the room
    goes to the music.
- **The other row types:**
  - `run`: its cells, in sequence, in the chord face;
  - `words`: in the words face, wrapped;
  - `notes`: one paragraph after another, in Figtree 36 px, wrapped;
  - `verbatim`: Atkinson Hyperlegible Mono, whitespace kept, never wrapped,
    clipped at the column's edge;
  - `section`: the name in Atkinson Hyperlegible 700, with ` ×n` when it has
    `times`;
  - `empty`: *Nothing written here yet.* in the interface face. The backend
    never sends an `empty` row today (no `markEmpty`), but the chart draws
    every row type `chartRows` can produce;
  - an unknown row type draws nothing and takes no room. The frontend ignores
    what it does not know (design §6).
- **`ChordDiagram`:**
  - the model is drawn as given, with no recomputation of `startFret`,
    mirroring or barre;
  - strings, frets and the nut (when `showNut`) are `Rectangle`s;
  - dots are `Rectangle`s with `radius` = half their size, centred on string
    × row;
  - the barre is a rounded `Rectangle` from `fromString` to `toString` at its
    row;
  - fingers are white Atkinson 700 inside the dot or barre, drawn when
    `finger` is set;
  - open marks are a ring (a rounded `Rectangle`, white with a black border
    of at least 2 px) and muted marks an X (two `Text` strokes, or the `×`
    glyph in Atkinson 700), above the nut;
  - the fret number is `startFret`, in Atkinson 700, left of row 0, drawn
    only when `startFret > 1`;
  - `size: "large"` is 170 × 222 and `"compact"` is 124 × 168, plus the
    symbol above (Figtree 700, 40 px and 32 px);
  - a `null` model, a pending shape, draws an empty place of the same size
    with no symbol (design §6: "its place in the strip left empty"). Shapes
    carry no *default* or *your shape* marks (workflow 19 §A song).
- **Faces:**
  - `Faces.qml` holds the `FontLoader`s for Figtree (latin and latin-ext,
    variable), Atkinson Hyperlegible 400 and 700 (latin and latin-ext), and
    Atkinson Hyperlegible Mono (variable);
  - it exposes `ready` (all loaded);
  - `SheetView` holds one `Faces`, and lays nothing out until
    `faces.ready`, because measuring in a fallback face would paginate wrong;
  - the files are byte-identical copies, each family with its `LICENSE`.
- **No song text in the repo but songs written for the purpose.** The
  fixtures are original, made for these tests. None is a real choro or
  someone's lyrics, so the boards' *Noites Cariocas* and *Três Estrelinhas*
  are not used.
- **`Main.qml` is unchanged.** Putting `SheetView` into a screen is
  `reader.song_screen`'s work.

## Acceptance criteria

### Behavior delivered

**`remarkable/qml/chart/SheetView.qml`**

Input properties:

- `sheet`, the parsed `105` payload, or `null`.
- `width` and `height`, the area the chart may use. The song screen passes
  the content height minus the strip's fixed height, or the whole 1632 px
  with the shapes hidden.
- `page` (0-based).

Read-only results:

- `pageCount`
- `columns` (1 or 2)
- `pages`, each `{ firstRow, chords: [key…] }`, where `chords` lists the
  page's `token.key`s in the order they first appear, without repeats.
- `function pageOfRow(rowIndex)`, the page that holds a row. Hide shapes uses
  it to stay at the bar that was at the top (workflow 19 L248–256).
- `preparedPage`, the index of the page built ahead, or −1 on the last page.

Turning does not lay the song out again: `page` changes which built page is
visible.

**`remarkable/qml/chart/blocks.js` (`.pragma library`)**

`blocks(rows)` returns the keep-together units, each with:

- `kind`
- its rows' indices
- `keepWithNext`, for a section
- `breakable` and its break points, which are rows of four, paragraphs or
  lines

It also does the bar reflow into rows of four, with endings, as plain data:
`[{ label?, bars: [{ cells, marks }] }]`.

**`remarkable/qml/chart/paginate.js` (`.pragma library`)**

`paginate(units, columnHeight, columns)` takes units already measured
(`height`, and `breakHeights` for a breakable unit). It returns pages of
columns of unit slices, under the rules above. It is pure, so it is
unit-tested apart from QML items.

**`remarkable/qml/chart/ChordDiagram.qml`**

Properties `model`, `symbol` and `size`, drawn as above. Its parts carry
`objectName`s that the tests find them by: `string`, `fret`, `nut`, `dot`,
`barre`, `finger`, `open`, `muted`, `fretNumber`, `symbol`.

**`remarkable/qml/chart/Faces.qml`**

The `FontLoader`s and `ready`. The files are under `remarkable/qml/fonts/`.

**`remarkable/internal/backend/qmlfixtures_test.go`, `TestQMLFixtures`**

It commits `remarkable/qml/tests/fixtures/songs/*.cifra.md` as a local book,
using `newViewsFixture`'s machinery and the built bundle (`builtEngine`). It
opens each song through `serve` → `openSong`, and serialises the `Sheet` as
`remarkable/qml/tests/fixtures/<name>.js` (`.pragma library`, then
`var sheet = <JSON>;`).

- With `-update-qml-fixtures` it writes the files.
- Without it, it fails when any committed fixture differs from what the
  backend produces now.

This way the QML tests read real `chartRows` and `diagramModel` output, and
cannot drift from it.

**The fixture songs** (`remarkable/qml/tests/fixtures/songs/`, all written
for the purpose):

- `every-row`: one of each row type the backend can send:
  - a section with a count;
  - a bars line with a repeat open and close and an `×2`;
  - a run line;
  - sung lines with a hyphenated segment;
  - a words-only line;
  - a gap;
  - a notes part;
  - a verbatim block.
- `two-columns`: a sung song of short lines, about 50 of them in five
  sections. Its longest line fits half the page, and it takes two pages.
- `one-column`: a sung song with one line wider than half the page, and one
  line wider than the whole page.
- `choro-31`: an all-chords song of 31 bars:
  - an A of 4+4+4+3;
  - a 1st and a 2nd ending of one bar each;
  - a B of 4+4+4+2;
  - two chords to most bars, `%` repeats, and at least sixteen distinct
    chords.
- `choro-long`: an all-chords song of about 80 bars in three sections, with
  endings. It runs to three pages in the height left by a two-row compact
  strip.

### Tests, by level

The level is **behavior (QML)**, as the note names. All of it is under
`remarkable/qml/tests/` and run by the gate's step *estante reader: QML
tests*. **unit** coverage is added for the two pure modules, and a **unit
(Go)** drift guard for the fixtures.

**unit (QML/JS), `tst_paginate.qml`** (`TestCase` `name: "Paginate"`, over
`blocks.js` and `paginate.js` with hand-built units):

- `test_sectionKeptWithFirstLine`: a section that would end a column moves to
  the next column with its first line (workflow 19 §A song).
- `test_columnFilledBeforeNext`: column 1 is filled to its foot before
  column 2 gets anything (workflow 19 §A song, books.print's
  `column-fill: auto`).
- `test_gapDroppedAtColumnTop`: a gap that would start a column is dropped.
- `test_tallBarsBlockBreaksBetweenRows`: a bars block taller than a column
  breaks only between rows of four (the workflow 19 delta).
- `test_barsFourToARowKeepingLineBreaks`: a line of 8 bars gives rows of
  4+4, and a line of 3 gives a row of 3 (the workflow 19 delta).
- `test_endingStartsItsRowWithLabel`: a measure with `ending: 2` starts a row
  labelled *2nd*.
- `test_unknownRowTakesNoRoom`.

**behavior (QML), `tst_chart_rows.qml`** (`TestCase` `name: "ChartRows"`,
`SheetView` over `fixtures/every-row.js`, and over that sheet with an `empty`
row and an unknown row spliced in):

- `test_eachRowTypeDrawn`: each of section (with ` ×2`), bars, run, sung (the
  chord over its words, the hyphen), words, notes (every paragraph), verbatim
  (whitespace kept, in the mono face), gap (space, no ink) and empty
  (*Nothing written here yet.*) is drawn with the text its row carries (design
  §6, `chartRows`).
- `test_repeatSignsAndCount`: the open and close repeat signs and `×2` drawn
  on their bars.
- `test_unknownRowIgnored`: an unknown type draws nothing and leaves the
  layout as without it (design §6).
- `test_oneBit`: every `Rectangle` and `Text` the page holds is black or
  white, with no antialiasing on `Rectangle`s, integral geometry, and strokes
  of at least 2 px (workflow 19 rule 6).
- `test_facesLoaded`: chord text's `fontInfo.family` is `Figtree`, section
  names' is `Atkinson Hyperlegible`, and verbatim's is
  `Atkinson Hyperlegible Mono` (workflow 19 §The screen, as amended).

**behavior (QML), `tst_chart_pages.qml`** (`TestCase` `name: "ChartPages"`):

- `test_twoColumnsWhenLongestLineFitsHalf`: `two-columns` lays out in 2
  columns; `one-column` and `choro-31` in 1 (workflow 19 §A song, as
  amended).
- `test_songPaginatedWithNoLineSplit`: `two-columns` and `one-column` at a
  height that takes at least two pages. Every row appears on exactly one page,
  in order. No sung line's items cross a column's foot, and none sits on two
  pages. No section name ends a column (workflow 19 §A song).
- `test_wideLineWrapsBetweenSegments`: in `one-column`, the line wider than
  the page wraps onto a second line at a segment boundary, with each chord
  still over its words.
- `test_choro31OnOnePageShapesHidden`: `choro-31` at the full 1632 px gives
  `pageCount` 1, all 31 bars drawn, rows of 4,4,4,3, then the *1st* and *2nd*
  ending rows, then 4,4,4,2 (workflow 19 §A song, "*Três Estrelinhas* fits on
  one").
- `test_choroLongPages`: `choro-long` in the height left by a two-row compact
  strip gives 3 pages. No block of bars is split where it fits a column, and
  each page's `chords` is that page's chord keys in the order they first
  appear (workflow 19 §Shapes on every page).
- `test_pageOfRow`: `pageOfRow` of each page's `firstRow` answers that page.
  A row in the middle of page 2 answers 1.
- `test_nextPagePreparedAhead`: on page 0, `preparedPage` is 1 and its items
  exist complete but invisible. Setting `page: 1` shows those same items, with
  no new page built for 1, and prepares 2. On the last page, `preparedPage`
  is −1 (workflow 19 rule 9).
- `test_nothingBeforeFaces`: with the faces not yet ready, `pageCount` is 0
  and nothing is drawn (rule 1).

**behavior (QML), `tst_chord_diagram.qml`** (`TestCase`
`name: "ChordDiagram"`). The models are written in the test in
`diagramModel`'s exact shape (`app/src/render/diagram.js` L41–108), plus
every model in the fixtures' `shapes`:

- `test_openChord`: on a 6-string open shape, 6 strings, `fretsShown`+1 fret
  lines, the nut drawn (`showNut`), each dot at its string × row, its finger
  as white text in it, the open and muted marks above the strings named by
  `markers`, and no fret number.
- `test_barreUpTheNeck`: at `startFret` 5, no nut, a fret number *5* beside
  row 0, the barre one rounded `Rectangle` spanning `fromString`–`toString`
  with its finger, and the dots off the barre (design §7, as amended).
- `test_twoSizes`: `large` is 170 × 222 and `compact` 124 × 168. One
  component, with the same parts at both sizes (workflow 19 §A song).
- `test_pendingShapeEmptyPlace`: a `null` model draws no parts and keeps the
  size of its place (design §6).
- `test_pixelAlignedOneBit`: every part has integral geometry, black or white,
  no antialiasing, and strokes of at least 2 px (rule 6).
- `test_fixtureModelsDraw`: every non-null `model` in the fixtures draws with
  no warning, with one dot per `dots` entry.

**unit (Go), `remarkable/internal/backend/qmlfixtures_test.go`,
`TestQMLFixtures`**: the committed `fixtures/*.js` equal what the backend
answers for each fixture song now (design §6: `rows` are `chartRows` exactly).
This runs in the gate's reader `go test` (`scripts/gate` L176–177), after the
app's build has made the bundle.

**unit (Go), `remarkable/tools/appfolder/appfolder_test.go`**: a new case
`TestQrcCarriesFaces`. The qrc lists `fonts/figtree/…woff2`,
`fonts/atkinson-hyperlegible/…`, `fonts/atkinson-hyperlegible-mono/…` and
each family's `LICENSE`. Each file is byte-identical to its counterpart under
`app/src/theme/fonts/` (the app's README rule).

**Gate folder check, `remarkable/qml/tests/check_folder.py`**: after
`Main.qml`, it also creates `qrc:/<root>/chart/SheetView.qml` and
`chart/Faces.qml` from each architecture's rcc. Both must compile, and every
`FontLoader` must reach Ready (design §9: "a QML file the folder does not
carry, or one that does not compile, fails it").

**No e2e level.** The reader has no e2e harness: design §9 names the QML
harness as its frontend level, and the screen has no user path until
`reader.song_screen` mounts it.

## Decisions

1. **The scope boundary: the chart and the diagram, with no chrome or
   strip.** `SheetView` exposes pages, chords per page and `pageOfRow`, and
   `reader.song_screen` does everything else: it computes the strip's height
   from the busiest page, passes the remaining height in, and handles turning,
   the key and hiding.
   - Rejected: `SheetView` owning the strip-height fixpoint. That fixpoint
     depends on large versus compact and on the strip's paging (the 16-shape
     cap), which are the song screen's rules.
2. **Measure real items, paginate in pure JS.** Each block is built once,
   invisible, at the column width. Its `implicitHeight` (and its break
   heights) feed `paginate.js`, and pages are then built from the blocks
   they hold.
   - Rejected: computing heights from `FontMetrics` arithmetic. Wrapping a
     sung line between segments would be re-implemented beside the `Flow`
     that draws it, and the two would disagree.
   - Rejected: a `Flickable`/`ListView` clipped by page. That is scrolling in
     disguise (rule 3), and gives no keep-together rules.
3. **Fixtures generated by the real backend, held by a drift test.** The QML
   tests read sheets that `TestQMLFixtures` produced through `views.go` and
   the built bundle, from songs written for the purpose. The generated files
   are committed, so the QML step needs no Go or bundle at run time.
   - Rejected: hand-written `chartRows` JSON. Plausible-looking rows would
     drift silently from what `chartRows` emits.
   - Rejected: QML reading `.cifra.md` through a helper. That would compute
     music in the frontend (design §3.3).

   The diagram tests still write models by hand, so that they reach barre and
   up-the-neck cases the example cache may not hold.
4. **The column rule also weighs the widest row of four bars** (design delta
   in workflow 19 §A song). Workflow 19 names only the longest sung line, but
   a song of words with two-chord bars needs about 327 px a bar. At about
   155 px a bar in a half-page column, the bars would not hold their chords.
   books.print measures the bar grid too (`print-columns.js` L38–49).
   - Rejected: always one column for any song with bars. Some sung songs with
     a short bars intro fit two columns.
5. **Rows of four keep their line's breaks, and an ending's label is its
   ordinal** (design delta). `Song.dc.html` draws an A of 4+4+4+3, which is
   what keeping the line's breaks gives.
   - The board's *to B* label is not something the chart carries:
     `marks.ending` is a number (`layout.js`; `Chart.jsx` L246–249).
     Inventing destination labels would be music computed in the frontend, so
     the workflow now says *1st*, *2nd*.
6. **A block of bars taller than a column breaks between rows of four**
   (design delta). Workflow 19 says a block is never split, but a long
   section written as one block can exceed 1632 px. The only alternative is
   clipping it, which loses music.
7. **Verbatim in Atkinson Hyperlegible Mono** (design delta in workflow 19
   §The screen). Verbatim blocks hold column-aligned text, such as tablature,
   which a proportional face breaks. The app ships this family as the Palco
   code face (`theme.css` L103–106), under OFL.
   - Rejected: Figtree for verbatim. Its columns would misalign.
   - Rejected: the device's own monospace. It is unknown on xochitl, and the
     gate could not check it.
8. **The faces are the app's `woff2` files, copied byte for byte, and checked
   identical.** The gate's Qt reads WOFF2 (checked while refining). The app's
   README forbids re-encoding, and copying keeps the reader an unmodified
   redistributor.
   - Rejected: having `appfolder` pull the fonts from `app/` at build time.
     The QML tests run from the source tree and need the files there, so a
     duplicate is unavoidable. The byte-identity test keeps the duplicate
     honest.

   Whether the device's Qt reads WOFF2 is recorded as a §11 risk. The
   fallback is the families' upstream TTFs.
9. **The fingers and the fret number in the interface face** (Atkinson
   Hyperlegible), as `Song.dc.html` L65 draws them. This settles the "reader's
   face" wording in design §7, which the delta now names.
10. **Bar numbers are not drawn.** No board draws them, and the room on an
    e-ink page goes to chords. The rows still carry them, so a later task can
    draw them without any protocol change.
11. **The top-level `notes` and `keyNote` are not the chart's.** The sheet's
    `notes` (the voicing block's notes) belong with the shapes strip, and
    `keyNote` with the bar and Play. `reader.song_screen` and `reader.play`
    draw them. `SheetView` draws `rows` only.
12. **Synchronous layout, with the next page built ahead.** QML object
    creation for one page plus the prepared next page is the cost that design
    §7 and §11 accept ("live first"). `grabToImage` caching is the
    documented next step if the rM2 proves slow, and is not scoped here.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-11-02.

- The chart: `remarkable/qml/chart/{SheetView,ChartBlock,SectionRow,SungRow,BarsRow,RunRow,WordsRow,GapRow,NotesParagraph,VerbatimLine,EmptyRow}.qml` with `blocks.js` (rows to blocks), `paginate.js` (blocks and heights to pages) and `metrics.js` (sizes in one place); one or two columns, the next page built ahead, chords per page, `pageOfRow`.
- `remarkable/qml/chart/ChordDiagram.qml` at large and compact sizes (large strings 28 px apart so the 26 px dots stay inside the 170 px box; 18 px ring marks), and `Faces.qml` loading the app's fonts from `remarkable/qml/fonts/` (woff2 and LICENSEs, unchanged). Qt registers the variable fonts as "Figtree Light" / "Atkinson Hyperlegible Mono ExtraLight", so text takes the family from `Faces` and the weight from `font.variableAxes`.
- QML tests: `remarkable/qml/tests/tst_paginate.qml` (unit), `tst_chart_rows.qml`, `tst_chart_pages.qml`, `tst_chord_diagram.qml` (behavior), with songs in `remarkable/qml/tests/fixtures/songs/` and generated `fixtures/*.js`; `walk.js` helper.
- `remarkable/internal/backend/qmlfixtures_test.go`: `TestQMLFixtures` generates the fixtures through the real backend and fails on drift (`-update-qml-fixtures` regenerates); `remarkable/tools/appfolder/appfolder_test.go`: `TestQrcCarriesFaces`.
- `remarkable/qml/tests/check_folder.py` now compiles `chart/SheetView.qml` and `chart/Faces.qml` from the rcc and requires every FontLoader to reach Ready; `remarkable/README.md` documents regenerating the fixtures.
- Design edits in `docs/workflows/19-remarkable-reader.md` and `docs/remarkable-reader.md` (faces, column rule, ordinal ending labels, diagram parts, WOFF2 risk) landed in the same commit.
- Deviation: the `two-columns` fixture song has 45 lines rather than about 50 so it comes to exactly two pages.
