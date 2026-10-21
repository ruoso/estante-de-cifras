# books.setlist_row_opens — A song in a setlist opens from its row

## TaskJuggler entry

`books.setlist_row_opens` in [`tasks/65-books.tji`](../../65-books.tji)
("A song in a setlist opens from its row"), a `depends` of
`milestones.m5_complete` ("M5: The first pass, complete") in
`tasks/99-milestones.tji`.

## Effort estimate

1d — design and build in one task. The design is decided (with the human,
2026-10-21) and the delta is a few sentences in workflow 12 and a caption on
W12; the build is a pressable read row, a start position threaded from the
row to the player, the current song's note in the player, and focus returned
to the row on Stop.

## Repository

The work lands in **estante-de-cifras**, not under `cifra.md/` (the note does
not start with `cifra.md:`):

- `app/src/books/SetlistView.jsx` — read rows become RAC `Button`s; a new
  `onPlay` argument `at`; focus returned to the pressed row
- `app/src/books/SetlistPlay.jsx` — a `startAt` prop; the current song's note
- `app/src/books/setlist-play.js` — a pure `startIndex(playable, at)` helper
- `app/src/shell/AppShell.jsx` — `playingSetlist` carries `at`; the setlist
  is told which row to focus when Play stops
- `app/src/books/setlist.css` — only if the button row needs a rule beyond
  `theme/controls.css`'s `button:where(.row)` reset
- tests: `app/src/books/setlist-play.test.js`,
  `app/src/books/SetlistView.behavior.test.jsx`,
  `app/src/books/SetlistPlay.behavior.test.jsx`,
  `app/src/shell/AppShell.routing.behavior.test.jsx`,
  `e2e/web/tests/setlist-play.spec.js`, and a journey helper in
  `e2e/web/lib/journeys-files.js`

**Design delta** (rides in this task's commit, already written):

- `docs/workflows/12-setlists.md` — §The file: "each song in the list opens
  from its row", a missing song is not pressed open, editing rows open
  nothing; §Playing through: Play starts at the pressed song, with the
  setlist's key and the song's note, next and previous through the rest both
  ways, stopping returns to the setlist at that song; the playing song's note
  shown above its chart.
- `docs/mockups/W12-setlists.dc.html` — the board subtitle and the phone
  pair's caption say the second phone is *Tarde Clara pressed in the list*:
  Play opens at it ("2 of 5", In A) and Stop returns to its row. The drawn
  screens already show it (the rows are drawn as links; the player is at the
  second song).

## Inherited dependencies

- `books.setlists`: **settled** (`complete 100`). It delivered `SetlistView`
  (read view, editor), `setlist-display.js` (`setlistRows`), and the `onPlay`
  seam (`tasks/refinements/books/setlists.md`, Decision 1).
- `books.play`: **settled** (`complete 100`). It delivered `SetlistPlay.jsx`,
  `setlist-play.js` (`playableItems`, `clampIndex`, `nextItem`,
  `playKeyOffset`), the `playingSetlist` host in AppShell and the `play.*`
  copy (`tasks/refinements/books/play.md`). It opens on the first linked song
  only.
- `books.setlist_done`: **settled** (`complete 100`). Done leaves editing and
  focuses Edit; the read view is the one this task makes pressable
  (`tasks/refinements/books/setlist_done.md`, Decision 4).
- Also settled, though not in `depends`: `books.setlist_play_chrome` (the
  chip and setlist-key line in the play bar), `books.setlist_chrome` (a
  phone's open setlist inside the Setlists tab panel), and the e2e harness
  `foundation.e2e_web` with `openSetlist`/`enterPlayer` in
  `e2e/web/lib/journeys-files.js`.

## What this task is

In reading mode a setlist's songs are listed in rows that look like every
pressable row in the app, but are plain `div`s: pressing one does nothing.
This task makes each present song's row a button that opens **Play at that
song** — the same full-screen player *Play* opens, with the setlist's key
applied and the song's note shown, next and previous through the rest of the
setlist, and *Stop playing* returning to the setlist with focus on the row
that was pressed. Keyboard and screen-reader users reach and press the rows
like any other row button.

## Why it needs to be done

A teacher in the persona exploration (2026-10-20) tapped *Samba de Verão* in
their lesson setlist to look at it and nothing happened. The rows are drawn
as links on W12 and styled as `.row`, so they promise an action; workflow 12
said only that opening a setlist lists its songs. Without it the only way to
reach the fourth song of a set is Play and three Nexts. Nothing downstream
depends on this task; it is part of `milestones.m5_complete`.

## Inputs / context

- `docs/workflows/12-setlists.md` §The file (opening a setlist lists its
  songs — amended here), §The key (the setlist's key transposes while played
  from the setlist, over the user's own), §Playing through (amended here),
  §Songs moved, renamed or deleted (a missing link is skipped when playing and
  offers to be pointed at a song).
- `docs/mockups/W12-setlists.dc.html` L26–102: phone #1 the setlist read
  view, rows drawn `<a class="row">` (L42–56), the missing notice (L57–60);
  phone #2 the player at the second song, "Tarde Clara · 2 of 5", chip
  "In A", "Setlist key A · written in G", the Next card with the next song's
  note (L70–102).
- `docs/DIRECTION.md` §4 (the interface) and §3.7 (the view is the only layer
  that knows React; the Worker owns the data).
- `app/src/books/SetlistView.jsx`:
  - props L140–157 (`onPlay`, `onBack`, …; no row action);
  - read rows L350–365, `<div className="row" key={row.at}>` holding
    `.setlist-num`, `.name`, the note and folder `.meta`, the `in {key}` and
    `missing` badges;
  - Play raised at L347 (body button), L408 (More menu `play`), L591 (editor
    bar), each `onPlay({ bookId, path })`;
  - `editing` state L162; read branch L333–432, editor L434–611.
- `app/src/books/setlist-display.js` `setlistRows` — each row carries `at`
  (its item index), `number`, `title`, `note`, `key`, `folder`, `missing`,
  `resolvedPath`, `path`.
- `app/src/books/SetlistPlay.jsx`: props L54–61 (`store, bookId, path, mode,
  onStop, wakeLock`); `playable` L84 from `playableItems(setlistRows(…))`;
  `cursor` `useState(0)` L91, `clampIndex` L92; next/previous L95–96, keys
  L128–136, swipe and edge taps L149–168; the key and setlist line
  L184–203; the note only on the Next card (`play.note`, L255); focus to the
  first button on mount L140–143.
- `app/src/books/setlist-play.js` L59–61 `playableItems` (missing and
  unlinked items filtered out — a play index is not a row's `at`).
- `app/src/shell/AppShell.jsx`: `playingSetlist` L494, the `play` layer L527
  and its closer L592, `SetlistPlay` mounted as a full-screen early return
  L1641–1650 (`onStop={() => back(closers.play)}`), `SetlistView` wiring
  L1697–1708 (`onPlay={({ bookId, path }) => setPlayingSetlist({ bookId,
  path })}`); the fork follow L704.
- Pressable-row precedent: `app/src/books/SetlistsScreen.jsx` L91–109
  (`<Button className="row" onPress=…>`), `app/src/theme/controls.css`
  L27–40 (`button:where(.row)` reset), `app/src/songs/SearchScreen.jsx`
  L217–273 (the wrapper pattern when a row has a second action).
- `app/src/i18n/locales/en.js` L572–589 (`play.*`; `play.note` is
  `Note: {note}`), with `es-419.js`, `it.js`, `pt-BR.js` beside it.
- Example book `app/example-book/a-short-set.setlist.md`: *Morning on the
  Porch* (note "start gently, let the intro ring"), *The Ferry Line*,
  *Walking to the Market* (`key: A`, written in G).
- Tests that exist: `app/src/books/SetlistView.behavior.test.jsx` (read view
  L128, Play seam L150), `app/src/books/SetlistPlay.behavior.test.jsx`
  (L172ff), `app/src/books/setlist-play.test.js`,
  `e2e/web/tests/setlist-play.spec.js` (L70 play-through), journeys
  `openSetlist` (L170) and `enterPlayer` (L251) in
  `e2e/web/lib/journeys-files.js`.

## Constraints / requirements

- **React Aria Components** for the row: a RAC `Button className="row"`, as
  `SetlistsScreen` does; its accessible name is its content (number, title,
  note or folder, key badge) so a screen reader hears what it opens. It must
  not take the accessible name "Play" — `enterPlayer` finds the Play button
  by exact name.
- **Missing rows stay non-pressable** `div`s with their `missing` badge in
  words; the notice under the list keeps *Point it at a song* (workflow 12
  §Songs moved…). Opening a missing song in the player is impossible — it is
  not in the playable list.
- **Editing rows are untouched**: the editor's `GridList` rows open nothing.
- **One player.** Play from a row is `SetlistPlay` with a start position, not
  a new screen: the key (`playKeyOffset` over the user's own transposition),
  next/previous clamping, the wake lock, sync waiting until Stop, the
  announcement "{title}, {i} of {n}" all behave as from *Play*. The position
  "i of n" counts playable songs, as today.
- **The start position is the row's `at`**, mapped to the playable index by
  a pure helper; a setlist may hold the same song twice, so the title or the
  path would not identify the row. A row whose `at` is no longer playable
  (the setlist changed under the player before it mounted) starts at the
  first playable song.
- **The current song's note** is shown in the player above its chart
  (`play.note`, existing copy, all four locales already have it), so a song
  opened from its row still carries the setlist's note for it (workflow 12
  §Playing through, as amended).
- **Back returns to the setlist**: *Stop playing* and Escape close the `play`
  layer as today, and focus lands on the row that was pressed (when Play came
  from a row) or on the Play button (when it came from Play) — the keyboard
  path does not drop focus to the document body.
- Offline first: nothing new touches the Worker; the player loads each song
  as it does today. No new copy keys are needed; if one turns out to be, it
  is added to all four locales.
- Status in words, never colour alone (the existing `missing` and key badges).

## Acceptance criteria

Behavior:

1. In a setlist's read view each present song's row is a button; pressing it
   (pointer, Enter or Space) opens the player at that song — its title, "{i}
   of {n}" with `i` its playable position, the setlist's key applied (chip and
   line as `books.setlist_play_chrome` settled), its note shown above the
   chart.
2. Next and previous from there go through the rest of the setlist both ways,
   skipping missing songs, clamping at the ends.
3. *Stop playing* (and Escape) returns to the setlist read view with focus on
   the pressed row; *Play* still starts at the first song and Stop from it
   focuses Play.
4. A missing row is not a button; editor rows open nothing.

Tests, by level:

- **unit** — `app/src/books/setlist-play.test.js`, `startIndex`: a row's `at`
  maps to its playable index when items before it are missing; an `at` that
  is missing or out of range gives 0; a song listed twice maps each `at` to
  its own position (workflow 12 §Playing through).
- **behavior** — `app/src/books/SetlistView.behavior.test.jsx`:
  - the read view's present rows are buttons named by their song, a missing
    row is not, and pressing the third row (click; and Enter on a focused row,
    one gesture each) raises `onPlay({ bookId, path, at: 2 })`; the Play
    button still raises `onPlay({ bookId, path })` (workflow 12 §The file);
  - with editing on, the editor rows raise no `onPlay`;
  - `returnFocusAt` focuses that row on mount; axe clean on the read view
    with button rows.
- **behavior** — `app/src/books/SetlistPlay.behavior.test.jsx`:
  - `startAt` on the third item of a setlist whose second is missing opens on
    that song, "2 of 2", in the setlist's key (chip and line), and Previous
    goes to the first (workflow 12 §Playing through, §The key);
  - the current song's note is shown above its chart, and a song without one
    shows none;
  - axe clean on a player opened at a song with a note.
- **behavior** — `app/src/shell/AppShell.routing.behavior.test.jsx`: opening a
  setlist, pressing a song's row, mounts the player at that song; *Stop
  playing* returns to the setlist with focus on that row (workflow 12
  §Playing through; the `play` layer's Back).
- **e2e-web** — `e2e/web/tests/setlist-play.spec.js`, new test "a song opens
  from its row in the setlist, in the setlist key, and Stop returns to it", on
  phone, tablet and computer: the example book's *A Short Set* opened
  (`openSetlist`), *Walking to the Market* pressed in its row (a new
  `openSetlistSong(page, title)` journey in `e2e/web/lib/journeys-files.js`,
  through the real UI); the player shows *Walking to the Market*, "3 of 3",
  "In A" and "Setlist key A · written in G"; Previous song twice reaches
  *Morning on the Porch* with "Note: start gently, let the intro ring" above
  its chart; Stop playing returns to the setlist with the *Walking to the
  Market* row focused; axe on the read view and on the player; `mockup(page,
  'W12-setlists', 2, { note: 'opened from its row' })` on the player. This
  sharpens the note's "a setlist of two songs, the second opened" to the
  example setlist the player's e2e already uses — no setlist-building steps
  needed to put two or more songs and a key in one.

No deferred follow-ups.

## Decisions

1. **Pressing a row plays from it, rather than opening the song's reading
   view.** Decided with the human (2026-10-21, in the `.tji` note). The
   alternative — opening the song in the reading view, as from search — would
   lose the setlist's key (workflow 12 §The key: the key applies "while a song
   is played from the setlist") and next/previous, and give a second way to
   read a song in a setlist that behaves unlike the first.
2. **The row is the button; no per-row "Play from here" icon.** One action
   per row, the `SetlistsScreen` pattern. A second button per row (the
   `SearchScreen` wrapper) would double the tab stops in a 20-song set and
   clash with `enterPlayer`'s exact "Play" name.
3. **The start position travels as the row's `at`, in the `playingSetlist`
   state**, not in the URL. The player is a layer that a reload drops
   (`use-place-history.js`); a URL for "playing at song 3" would be a new
   routing surface for nothing a user asked. `at` (not title, not path)
   because a setlist may hold a song twice (workflow 12 §Building one).
4. **Missing rows are not pressable.** They are skipped when playing; pressing
   one could only start at the next song, which surprises. Their action is
   *Point it at a song*, already offered in the notice below. Rejected: a
   missing row opening the repoint search — that belongs to editing, and the
   notice already offers it.
5. **The playing song's note is shown above its chart.** Today only the Next
   card shows a note, so a song opened from its row would never show its own
   — the note says "with the setlist's key and note". Shown with the existing
   `play.note` copy, beneath the setlist-key line, so no new copy.
6. **Focus returns to the pressed row on Stop**, through a `returnFocusAt`
   prop the shell passes to `SetlistView` after the `play` layer closes
   (SetlistView unmounts while the full-screen player is up). Precedent:
   `onShareFocusReturned` for the Share panel. Without it a keyboard user
   lands on the document body after every song looked at.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-21.

- In a setlist's read view each present song's row is a RAC button that opens Play at that song; missing rows and editor rows stay non-pressable (app/src/books/SetlistView.jsx).
- The player takes a `startAt` and shows the current song's note above its chart (app/src/books/SetlistPlay.jsx); the pure `startIndex(playable, at)` maps a row's `at` to its playable index (app/src/books/setlist-play.js).
- AppShell carries `at` in `playingSetlist` and returns focus to the pressed row, or to Play, on Stop (app/src/shell/AppShell.jsx).
- Design delta: docs/workflows/12-setlists.md and docs/mockups/W12-setlists.dc.html (canvas needs republishing — parking lot).
- Tests: unit app/src/books/setlist-play.test.js; behavior SetlistView, SetlistPlay and AppShell.routing `*.behavior.test.jsx`; e2e-web e2e/web/tests/setlist-play.spec.js on phone, tablet and computer, journeys in e2e/web/lib/journeys-files.js.
- No tech-debt follow-up.
