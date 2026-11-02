# reader.missed_shapes — Shapes the cache did not hold, found in the background

## TaskJuggler entry

`tasks/85-reader.tji`, `task missed_shapes` under `task reader` →
`reader.missed_shapes` (L101–106). Milestone: `milestones.m7_reader`
(`tasks/99-milestones.tji` L58–61).

## Effort estimate

1d.

## Repository

Not under `cifra.md/`: the note does not start with `cifra.md:`. The work
lands in:

- `app/src/device/entry.js`: a new host call, `fill(chord)`, beside `misses()`
  (L284–286), within `hostApi` 1 (`app/src/device/host-api.js:7`, bundle.md
  Decision 5). Tests in `app/src/device/entry.test.js`.
- `remarkable/internal/engine/engine.go`: `Fill(ctx, chord)` on a lower lane
  of the owner loop (L300–317, `serve` L410–437, `do` L440–458), and
  `ErrPreempted`. Tests in `engine_test.go` (synthetic bundles) and
  `bundle_test.go` (the built bundle).
- `remarkable/internal/protocol/messages.go`: `TypeShapes = 108` and its
  payload `Shapes`, in the table at L18–36 and beside `SheetShape`
  (L251–257). Test rows in `messages_test.go`.
- `remarkable/internal/backend/`: a new `fill.go` (the filler goroutine) with
  `fill_test.go`; `backend.go`'s `Serve` (L128–183) reads the socket in a
  goroutine and selects over its messages and the filler's news; `views.go`
  nudges the filler after a sheet with an empty place, keeps the empty places
  it last sent, and answers a fill with `108`. Its `Engine` interface (L34–37)
  gains `Misses` and `Fill`. `qmlfixtures_test.go` generates the new QML
  fixture.
- `remarkable/qml/`: `Main.qml` routes `108` to the song screen;
  `song/SongScreen.qml` (`receive`, L207–231) and `song/songstate.js` merge
  a `108` into the sheet without replacing a region; `song/ShapesStrip.qml`
  draws the merged shapes the next time it draws. Tests in
  `remarkable/qml/tests/tst_song_regions.qml`, `tst_song_screen.qml`,
  `tst_main.qml`, and a new fixture `fixtures/found-shape.js`.
- `docs/remarkable-reader.md` §4, §4.1, §6 — the design delta below (already
  written; it rides in the closer's commit).

## Inherited dependencies

Settled (all `complete 100`):

- `reader.engine` — one goroutine owns the runtime and serves a request
  channel in arrival order; its Decision 1 anticipates "a second, lower queue"
  for this task. `Misses` and `Held` exist (`engine.go` L671, L683).
- `reader.bundle` — the reading path never searches: a chord the table does
  not hold comes back `pending`, is queued once in `misses()` as
  `{ chord, symbol, dialect }` (its §4.6 table key), and its memo entry is
  dropped so a later fill is seen (`entry.js` L156–171); a read-only view of
  the session cache answers the reading path, the writable cache stays in the
  session (`entry.js` L42–72). Its Decision 5 gives this task the call that
  searches.
- `reader.song_screen` — a pending shape (`model: null`) keeps an empty,
  untappable place in the strip (`ShapesStrip.qml` L307–345, `strip.js`
  L19–22); the strip's height is fixed for the song by its busiest page,
  pending places counted; each region exposes a `revision` bumped once per
  replace, and `tst_song_regions.qml` checks revisions and pixels
  (`snapshot`, `moved`, `samePixels`, L73–92).
- `reader.backend_views` — `105 sheet` carries a pending chord with `model`
  and `frets` `null` (`views.go` L461–465); the view keeps the snapshot it was
  opened from; views state is touched only by `Serve`'s loop goroutine;
  `protocol.Conn.Write` is safe across goroutines (`frame.go` L97, L265).
- `reader.sync` — `Load` is a no-op when the entry and table are unchanged
  (`engine.go` L608–617), so what the session found survives a sync that
  brings the same table.

Pending: none.

Downstream: `reader.play` (a setlist's next song read ahead benefits from
shapes already found; nothing here depends on it).

## What this task is

When the default-shape cache does not hold a chord, the reader draws the song
at once with that chord's place in the shapes strip empty. This task fills
that place: the backend searches the chord afterwards, with the web app's own
search, only while nothing the person asked for is waiting, keeps the answer
in memory for as long as it runs, and tells the frontend. The frontend never
redraws the page on screen for it; the shape appears on the next page it
draws, and in every song read after. Nothing is written to the home book.

## Why it needs to be done

The web app fills `shapes-default-cache.json` when a song is saved, so most
chords are there; but a song pushed by a client that has not filled it, a
salt the web app has not filled yet, a key nobody saved at, or a chord
spelled for the first time leaves holes. Without this task a hole stays a
hole for as long as the device runs. A search costs 1–2.5 s a chord on an
rM2 (§4.1), so it can never be on the reading path (workflow 19 rule 1), and
a found shape must never redraw the page (rule 5). The milestone
`milestones.m7_reader` promises "any song at any key with the shapes of the
instrument in use".

## Inputs / context

- `docs/remarkable-reader.md` §4 (the host API table, L231–239, now with
  `fill`), §4.1 (L249–, the miss and its background search, now with the
  lower lane and `108`), §4.2 (the budget), §6 (the message table; `105
  sheet`'s pending chord, the new `108 shapes`).
- `docs/workflows/19-remarkable-reader.md` §The refresh budget, rules 1, 5, 7,
  9 (L17–64); §A song (the strip); §What it costs (no row for a found
  shape: it costs nothing until the next turn, which costs what a turn
  costs).
- `app/src/core/voicings.js:58` `defaultVoicing(chord, instrument, { cache })`
  — on a lookup of `undefined` it runs `searchDefault` (`searchFingerings`,
  `app/src/core/search.js:344`) and `cache.offer`s the shorthand or `null`.
  This is the web app's search and its cache protocol; `fill` uses it as is.
- `app/src/core/shape-cache.js` — `shapeCacheKey` (L126–128), `createShapeCache`
  (L163): `lookup` `undefined` is a miss, `null` no shape.
- `app/src/device/entry.js` — `emptySession` (L42–72), `load` (L107–114),
  `sheet` (L124–227), `misses` (L284–286), `held` (L293–300);
  `entry.test.js` L227–311 "no search on the reading path", whose L290–302
  stands in for this task by offering into the cache by hand.
- `remarkable/internal/engine/engine.go` — the owner loop and `request`
  (L219–234, L300–317, L410–458), `Miss` (L202–206), `Held` (L210–215).
- `remarkable/internal/engine/bundle_test.go` — `readFixture` (L43),
  `openBuilt` (L65), `TestEveryHostCall` (L230), the fixtures
  `app/dist-test/device/{example-book,choros}.default-shapes.json` built by
  `app/src/device/build.js` L98–138.
- `remarkable/internal/backend/backend.go` `Serve` (L128–183);
  `views.go` `sheet` (L399–477), `redraw` (L589–595); `views_test.go`
  `builtEngine` (L79), `newViewsFixture` (L220), `f.serve` (L268);
  `qmlfixtures_test.go` `TestQMLFixtures` (L54).
- `remarkable/qml/song/SongScreen.qml` (header table L1–24, `receive`
  L207–231, `revoice` L245–264, chart region L317–344);
  `song/songstate.js` `change` (L16–25); `tests/appload/…/AppLoad.qml` `play`.
- Predecessor refinements: `bundle.md` (§Constraints "No search on the reading
  path", Decisions 3 and 5), `engine.md` (Decision 1, "Cancellation"),
  `backend_views.md` (Constraints 3, 4, 10; Decision 5), `song_screen.md`
  (the strip, Decision 2 on revision + pixels).

## Design delta (this task)

`docs/remarkable-reader.md`, written with this refinement:

- §4 host API table: `fill(chord)` — searches one queued miss as the web
  app's `defaultVoicing` would, keeps the answer (a shape or none) in the
  session's cache, never the loaded table, and takes the miss off the queue.
- §4.1: the search runs one miss at a time in queue order on the engine's
  lower lane; a reading call interrupts it and the miss stays queued; a
  completed search is never repeated until the next `load`; a filled place in
  the song on screen is sent as `108 shapes`, which redraws nothing; a chord
  found to have no shape keeps its empty place until the song is opened
  again.
- §6: `108 shapes` → frontend, `{ bookId, path, offset, tuningId, shapes }`.

## Constraints / requirements

1. **`fill(chord)` in the bundle.** Takes a queued miss's table key. If it is
   not in the queue, it returns `{ chord, searched: false }` and does nothing.
   Otherwise it parses the miss's `symbol` in its `dialect`, runs
   `defaultVoicing(chord, instrument, { cache: session.cache })` — the
   writable session cache, so the result is `offer`ed there — removes the miss
   from the queue, and returns `{ chord, searched: true, found: bool }`. It
   neither changes the table object `load` was given nor exposes a way back
   to it (§4.1 "It never writes the home book"). The next `sheet` sees the
   shape through the read-only view (a hit, rebuilt and memoised as any), or
   an unvoiceable chord (the cache now holds `null`), which is no longer a
   shape. `held().misses` drops by one. It joins `hostApi` 1; the manifest's
   `hostApi` does not change (bundle.md Decision 5).
2. **The engine's lower lane.** `Engine.Fill(ctx, chord) (Filled, error)`
   (`Filled{Chord string; Searched, Found bool}`) is served only when no
   reading request (every other call) is waiting. A reading request arriving
   while a fill runs interrupts it (`rt.Interrupt`, then `ClearInterrupt`, as
   "Cancellation" already does); the reading request is then served and
   `Fill` returns `ErrPreempted`. An interrupted search has offered nothing
   (the offer is after the search), so the miss stays queued. A reading call
   never waits for a search to finish — at most for the interrupt to land.
   No `goja.Value` leaves the owner goroutine; `Close` ends a fill in flight
   with `ErrClosed` like any call.
3. **The filler.** `backend/fill.go`: one goroutine started by `Serve` and
   ended with it. It sleeps until nudged (a one-slot channel; a nudge while
   one is pending is dropped). Nudged, it asks `Misses` and calls `Fill` for
   each in order; on `ErrPreempted` it starts the round again from `Misses`
   (the miss is still first); on another error it skips that chord until the
   next nudge; when the queue is empty it sleeps. After each fill that
   `searched`, it posts one event to `Serve`'s loop. It runs no search on its
   own initiative beyond what is queued, holds no view state, and writes
   nothing: no store write, no file, no push.
4. **Who nudges.** `views` nudges after it sends a `105 sheet` holding at
   least one empty place. So a song opened, a key chosen, or a voicing
   hidden that leaves holes starts the search; a sheet with none does not.
5. **`Serve`'s loop.** A goroutine reads `conn.Next()` and hands each
   message (or its error) to the loop on a channel; the loop selects over it
   and the filler's events, so views state stays on one goroutine
   (backend_views Constraint 10). Every existing behavior of `Serve` —
   terminate, EOF, ctx's end, a payload error skipped — is unchanged, and its
   existing tests pass as they are.
6. **`108 shapes`.** On a filler event, if a song is open and its last sent
   sheet (or `108`) had an empty place, `views` reads the open song again
   (`sheet()`, from the same snapshot and offset, Constraint 4 of
   backend_views); if any empty place now has a model, it writes `108` with
   the song's `bookId`, `path`, `offset`, `tuningId` and the whole `shapes`
   array as the sheet now carries it (each `hidden` from the store, as in
   `105`), and records the empty places left. Otherwise it writes nothing. A
   fill for a chord not in the open song sends nothing; the next `open`
   carries it in its `105`.
7. **The frontend merges, never redraws.** On `108` whose `bookId`, `path`,
   `offset` and `tuningId` match the sheet on screen, the song screen fills
   each empty place whose `chord` arrives with a model (its `frets`, `model`,
   `hidden`) in its held sheet. It bumps no `revision`, lays nothing out, and
   changes no pixel (workflow 19 rule 5). An empty place that arrives still
   empty, or absent (found to have no shape), stays empty for this view. The
   strip's height stays what it was for the song; the strip draws the merged
   shapes the next time it draws — a page turned either way, the key grid
   closed, a voicing hidden. A `108` for another song, key or tuning is
   ignored. Assigning the merged data must not route through
   `SongState.change`'s "revoiced" path, which redraws the strip.
8. **Memory only.** What is found lives in the bundle session's cache until
   the next `load` that really reloads (a new instrument or table). Nothing
   is written to the home book, the store, or the clones.
9. **No song text in logs.** A fill logs nothing of the chord or the song.

## Acceptance criteria

### Behavior delivered

- A song read with a chord the table lacks opens at once with that chord's
  place empty; within the backend's idle time the chord is searched once,
  and turning the page shows the shape where the chord is on the new page;
  the page on screen never changes for it.
- A key change, an open, a hide — anything the person does — while a search
  runs is answered without waiting for the search.
- The same chord in the next song, or the same song opened again, comes
  with its shape and costs no search.
- Nothing is pushed or written; the home book's table is untouched.

### Tests, by level

**unit (Vitest)** — `app/src/device/entry.test.js`, a new block
"fill (§4.1)", over the example book with one chord's entry removed from the
table (as L290–302 does):

- `a queued miss is searched once and kept` — `misses()` lists it; `fill`
  answers `searched: true, found: true`; `misses()` is empty and `held().misses`
  0; the next `sheet` has no pending shape and the filled shape's `frets` and
  `diagram` equal those of a sheet read with the full table; a second `fill`
  of the same chord answers `searched: false` and runs no search (spy on the
  session cache's `offer`: one call in all).
- `fill never writes the table it was loaded with` — the table object passed
  to `load` is deep-equal before and after (§4.1).
- `a chord with no shape becomes unvoiced` — a chord the instrument cannot
  play (a stand-in instrument with too few strings for it, or the bundle's own
  unvoiceable fixture chord) fills `found: false`, and the next `sheet` lists
  it under `unvoiced`, not `shapes`.
- `fill of a chord not queued does nothing` — `searched: false`.

**unit (Go, engine)** — `remarkable/internal/engine/engine_test.go`, synthetic
bundles:

- `TestFillYieldsToReading` — a bundle whose `fill` spins until interrupted;
  a `Sheet` sent while it runs is answered (within a bound far below the
  spin), and `Fill` returns `ErrPreempted` (§4.1 "lower lane").
- `TestFillWaitsForReading` — with a slow reading call in flight and a
  `Fill` and a second reading call queued, the reading call is served first.
- `TestCloseEndsFill` — `Close` during a fill returns `ErrClosed`.

**unit (Go, engine, the built bundle)** — `bundle_test.go`:

- `TestFillQueuedMissOnce` — the example book's fixture table with one chord
  removed: `Sheet` has it `Pending`, `Misses` one, `Fill` `Searched` and
  `Found`, `Held.Misses` 0, the next `Sheet`'s shape equals the full-table
  sheet's, a second `Fill` `Searched: false`.

**unit (Go, protocol)** — `messages_test.go`: `TestEachMessageRoundTrips`
and `TestWireNames` gain a `108 shapes` row (§6).

**unit (Go, backend, over a socketpair with the built bundle)** —
`remarkable/internal/backend/fill_test.go`, through `newViewsFixture` and a
table with one chord removed (the fixture's `homeFiles` writing it):

- `TestMissSearchedOnceAndKept` — `open` a song → `105` with that chord's
  `model` `null`; then `108` with the same `bookId`, `path`, `offset`,
  `tuningId` and that chord's model; an engine wrapper counting `Fill` calls
  that `searched` counts one; `open` the song again → `105` with the shape,
  and no further `108`.
- `TestFillYieldsToKey` — with an engine wrapper whose first `Fill` blocks
  until its ctx is interrupted (preempted), a `key` sent meanwhile is answered
  with its `105`, and the chord is filled after it.
- `TestFoundAfterLeavingSendsNothing` — the song is left (`open book`) before
  the fill ends: no `108` (`peer.silent`).
- `TestFillWritesNothing` — after the fill, the store directory and the home
  clone are byte-for-byte as before, and the fake syncer saw no push (§4.1,
  workflow 19: the device is read-only).
- `backend_test.go`'s existing `Serve` tests pass unchanged over the new
  reader goroutine (Constraint 5).

`qmlfixtures_test.go` `TestQMLFixtures` gains `found-shape`: the `105` and
the `108` the backend sends for a song of the choros book whose missing chord
is on its first two pages, written to `qml/tests/fixtures/found-shape.js`.

**behavior (QML)** — over the AppLoad stand-in:

- `tst_song_regions.qml` `test_foundShapeDoesNotRedraw` — open
  `FoundShape.sheet`, `play(108, FoundShape.shapes)`: no region's `revision`
  moves and every region's pixels are the same (workflow 19 rule 5).
- `tst_song_regions.qml` `test_foundShapeOnNextPage` — after that `108`, a
  turn redraws the strip once (as any turn) and the found chord's place is
  drawn (its diagram's dots present), where before it was empty; the strip's
  height is unchanged.
- `tst_song_screen.qml` `test_foundForAnotherSongIgnored` — a `108` with
  another `path`, or another `offset`, leaves the held sheet's place empty
  after a turn.
- `tst_song_screen.qml` `test_foundWithoutShapeKeepsPlace` — a `108` in
  which the pending chord is absent keeps its empty place, untappable, on the
  next page.
- `tst_main.qml` `test_routesShapes` — `Main.qml` hands `108` to the song
  screen and nothing else on screen changes.

Deferred work: none.

## Decisions

1. **The search is the web app's `defaultVoicing`, through a new host call
   `fill(chord)`.** It is the same function, cache protocol and preference
   the Worker's `fillDefaultShapes` uses, so a found shape is the shape the
   web app would have filled.
   - Rejected: a `searchMisses` flag on `sheet` (bundle.md Decision 3
     already rejected it — the reading path never searches); a search in Go
     (a port of the music core, which DIRECTION §3.6 and the design's §4
     forbid).
2. **A lower lane in the engine with preemption by interrupt.** engine.md
   Decision 1 kept the owner loop so this could be local to it. A search
   costs 1–2.5 s; waiting for it would break rule 1 on every tap. Interrupting
   loses at most the work of one partial search, which is retried when idle.
   - Rejected: a second goja runtime for searching (doubles the 8 MB heap and
     the 0.5 s bundle load, and the found shape would live in the wrong
     session's cache); time-slicing the search (`searchFingerings` has no
     yield points; adding them changes the music core for one host).
3. **The filler lives in the backend, not the engine.** The engine stays a
   runtime with two lanes; when to search (after a sheet with holes) and what
   to tell the frontend are the views' business, and the filler is tested
   over the socket with the real bundle.
   - Rejected: the engine draining `misses()` by itself after every `Sheet`
     (policy in the runtime wrapper, and the views would still need an event
     to send `108`).
4. **A new message, `108 shapes`, rather than a second `105`.** A `105`
   with the same rows is the "revoiced" path, which redraws the strip at once
   (`songstate.js`), exactly what rule 5 forbids; making `105` sometimes not
   redraw would give one message two meanings. `108` carries the whole
   `shapes` array as the sheet would now have it, so the frontend matches by
   the sheet's own `chord` keys (which are not the §4.6 table keys `misses()`
   names) and the backend owns `hidden`.
   - Rejected: sending only the found chord's table key and frets (the
     frontend would need the bundle's key mapping and the diagram model,
     which only the backend has).
5. **`Serve` reads the socket in a goroutine and selects.** The filler's
   news must reach `views` on its one goroutine (backend_views Constraint
   10); a select is the smallest change that keeps that.
   - Rejected: a mutex around `views` (every view handler would then race
     the filler for `cur`); the filler writing `108` itself (it would need
     the open song and its snapshot).
6. **A chord with no shape keeps its empty place until the song is opened
   again.** Removing the place would change the strip's size mid-song, which
   rule 4 and the strip's fixed height forbid; the next `105` simply leaves it
   out (it is `unvoiced`).
7. **Memory only, no table write-back.** §4.1 and the device's read-only
   rule; the web app remains the only writer of `shapes-default-cache.json`.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-02.

- Web app: `app/src/device/entry.js` (+ `entry.test.js`) gains the fill step (§4.1) with a "fill (§4.1)" Vitest block.
- Engine: `remarkable/internal/engine/engine.go` runs the search one miss at a time on a lower lane that any reading call interrupts (`engine_test.go`, `bundle_test.go`).
- Protocol: `remarkable/internal/protocol/messages.go` adds `108 shapes` (`messages_test.go`).
- Backend: `remarkable/internal/backend/fill.go` searches each miss once and keeps it in memory, writing nothing (`fill_test.go`, `backend.go`, `views.go`, `qmlfixtures_test.go`).
- QML: `remarkable/qml/Main.qml`, `song/SongScreen.qml`, `song/songstate.js` route a found shape so it shows on the next page and never redraws the open one; tests in `remarkable/qml/tests/` and fixture `fixtures/found-shape.js`.
- Docs: `docs/remarkable-reader.md`, `remarkable/README.md`.
- Fixer: `app/src/shell/AppShell.jsx` (+ behavior test) engages a book's merge pressed while a pass reads it syncing, fixing a flaky e2e-web conflicts test.
- Follow-up registered: `reader.bundle_chosen_unbuildable_pending`.
