# songs.reading — Reading a song

## TaskJuggler entry

Defined in [`tasks/60-songs.tji`](../../60-songs.tji) as `songs.reading` under
`task songs`:

```
depends music.fallback, music.transpose
```

plus the parent `task songs` cascade `depends shell.layout, shell.chart,
foundation.e2e_web`. The one-line note:

> "The chart and the shapes, variation picker, full screen, print, add to
> setlist, share; updated in place by sync. Workflows 2, 8. Tests: behavior
> (variation picker, full screen, print styles, add to setlist, share; Testing
> Library and axe); e2e-web (open and read a song on the three viewports,
> transpose and reopen, updated in place by a sync from the stack; offline:
> after a reload with the network cut, the song, its shapes and the explorer;
> axe)."

This is the reading view — the screen that opens when a search result is
tapped (the view App.jsx has anticipated all along as "songs.reading's edit",
"songs.reading's toolbar"; `app/src/App.jsx:23,32,53`). Workflow 2's whole
second half ("## Reading a song", L67; "## Transposing", L111) is this screen.

## Effort estimate

**3d** (as scoped in the `.tji`), allocated `team`. The pure engines are
already built and unit-tested by `music.fallback` and `music.transpose`; the
three days are view work — the reading surface (the chart, the shapes, the
responsive app bar, full screen, print), the variation picker, the transpose
control, the two new Worker write-commands and the per-song read path they
re-surface, plus the behavior, unit and e2e-web tests.

## Repository

**estante-de-cifras** only. Touched directories:

- `app/src/songs/` — the reading surface (`SongReading.jsx` and its parts), the
  transpose control, the variation picker, the no-voicings notice, and the
  small pure view helper + its tests.
- `app/src/worker/` — the `OPEN_SONG`, `SET_TRANSPOSITION` and `SET_VARIATION`
  commands and the `SONG` event/slice (new kinds in `protocol.js` / `reducer.js`
  / `logic.js`), and the `variationOf` / `variationChange` seam in
  `songs.js` (the mirror of the transposition half `music.transpose` shipped).
- `app/src/shell/AppShell.jsx` — the open-song navigation state (narrow: the
  reading screen pushed over the tabs; wide: the reading view in `.pane.main`
  with search in `.pane.side`, the master-detail the computer mockup draws).
- `app/src/App.jsx` — a `#dev/reading?book=…&path=…` dev mount, mirroring
  `#dev/editor` / `#dev/history`.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — a new `reading.*` section.
- `e2e/web/tests/reading.spec.js` — the Playwright journey.

**Not a `cifra.md:` task.** The work only *consumes* the cifra.md library and
the app's framework-free music core (`parse`, `transpose`, `resolveSongVoicings`,
`transposedKeyName`); it writes no format code and changes nothing in the spec,
reference or corpus. The app and the service share no code (DIRECTION §3.6); a
song's reading state (transposition, variation in use) is personal state kept in
the home book (DIRECTION §3.2), never written into the song.

## Inherited dependencies

All **settled** — every declared and cascaded dependency is `complete 100`:

- **`music.fallback`** — *settled, Done 2026-10-06*
  ([`../music/fallback.md`](../music/fallback.md)). The three-level voicing
  resolver: `resolveSongVoicings(parsed, instrument, { variation = '',
  shapes = [], ignoreSongVoicings = false })` (`app/src/core/voicings.js:145`) →
  `Map<voicingKey, { source: 'song' | 'yours' | 'default', fingering }>` in chart
  order (§7.6), and `unvoiceableKeys(parsed, resolved)` (`:214`). The `source`
  enum equals `ChordDiagram`'s `kind` 1:1. `selectBlock` (private, `:81`) already
  implements the §7.6 no-fallback rule for the variation in use; the public
  `songVariations` this task adds (below) enumerates the labels that feed the
  picker.
- **`music.transpose`** — *settled, Done 2026-10-06*
  ([`../music/transpose.md`](../music/transpose.md)). The pure engine
  `transpose(model, semitones, { dialect })` (`app/src/core/transpose.js:168`) →
  a new model with every chord re-rooted and re-spelled (one global spelling;
  key-aware; unparseable symbols kept verbatim; `semitones === 0` unchanged), and
  `transposedKeyName(key, semitones, dialect)` (`:198`) → the destination key
  name or `null`. The per-song **transposition** half of the memory seam —
  `transpositionOf(songsModel, songRef)` (`app/src/worker/songs.js:32`) and
  `transpositionChange(songRef, semitones)` (`:52`) — ships there, pinned at unit
  level. Its file header (`songs.js:10-16`) states explicitly that **"the
  variation half, the `SET_TRANSPOSITION` Worker command … and the reading
  control that dispatches it are songs.reading's"** and its Deferred/Decisions
  sections name this task as the owner of the `SET_TRANSPOSITION` command, the
  reducer slice, applying the remembered offset on open, and the "transpose and
  reopen" e2e. This task closes that deferral.
- **`shell.chart`** — *settled, Done 2026-10-05* ([`../shell/chart.md`](../shell/chart.md)).
  `Chart` (`app/src/chart/Chart.jsx:98`), `{ model, markOf, size, label,
  className }`: a pure React view over `chartRows(model)` (`app/src/chart/layout.js:120`),
  chord symbols as plain text in a proportional face (not monospaced), never
  parsing. `markOf(address) → 'def' | 'conf' | 'tap' | null` is the consumer
  marking seam. The chord diagram is the separate `ChordDiagram`
  (`app/src/diagram/ChordDiagram.jsx:33`), `{ fingering, context, kind =
  'song', size, className }`, `kind ∈ { song, yours, default }`. Today only the
  `#dev/chart` gallery renders a chart; this task is its first real host.
- **`shell.layout`** — *settled, Done* ([`../shell/layout.md`](../shell/layout.md)).
  One controlled RAC `<Tabs>`; `useLayoutMode()` (`AppShell.jsx:51`) splits
  `narrow` (phone) / `wide` (tablet **and** computer, master-detail `.split` with
  `.pane.side` + `.pane.main` `<main>`) at `(min-width: 600px)`. **No router** —
  navigation is ephemeral `useState`. The open-song state this task adds lives
  there.
- **`foundation.e2e_web`** — *settled, Done* ([`../foundation/e2e_web.md`](../foundation/e2e_web.md)).
  Playwright at `e2e/web/`: `lib/axe.js` (`checkA11y`, `analyzeWcag21aa`),
  `lib/offline.js` (`runOffline`), the phone/tablet/computer projects
  (`playwright.config.js`), siblings `chart.spec.js`, `search.spec.js`,
  `editor.spec.js`, `offline.spec.js`.
- **`storage.*`, `music.instruments`, `music.explorer`, `shell.i18n`,
  `shell.tokens`, `shell.portal_provider`** — *settled* (transitive). The
  reading view reads the `instruments` slice (`EventKind.INSTRUMENTS`: the
  instrument in use, effective rules, `entry.shapes: {tuning, chord, shorthand}[]`)
  and the `preferences` slice (the notation dialect, falling back to
  `DEFAULT_DIALECT`); it reaches the chord explorer (`music.explorer`, already
  offline-capable from search) and records a recent through the
  `CommandKind.RECORD_RECENT` seam `songs.search` exposed for exactly this. Copy
  goes through `t(key, params)`; overlays portal into the `.est` root via
  `ThemeRoot` + `UNSAFE_PortalProvider`.

**One governing capability is deliberately *not* a dependency: sync.** The
`sync` area (`tasks/45-sync.tji`) has no `complete 100` leaf and is not in this
task's graph; reading lands in milestone **M2 (`m2_local`)**, "a songbook on one
device," which has no network sync. The note's "updated in place by sync" phrase
and its matching e2e therefore cannot land here — see
Decisions → *The updated-in-place behavior is sync's, deferred* and Acceptance →
Deferred.

## What this task is

The reading view: the screen a reader lands on when a search result is opened.
It shows the song as the format holds it — the chart drawn in a proportional
face (chords stacked over the syllables), then the shapes, on the instrument in
use — resolving each chord's shape in the §7.6 order (the song's choice, then my
shape, then the app's default), each marked for what it is. Where the song has
more than one variation for the tuning, a picker chooses between them, remembered
per song and tuning in the home book. The view can transpose the song up or down
by semitones — changing only the view, never the song — showing the destination
key plainly and, while transposed, resolving every chord to my shape or the
default (the song's own voicings are suppressed because the rewritten symbols no
longer match them). The transposition is remembered per song in the home book
and re-applied on open. From the app bar the reader can go to the editor, the
history, arrange, add to a setlist, print, share, and enter a chrome-free full
screen. Opening a song records it as a recent (device-local).

Underneath it the task lands three small Worker additions: an `OPEN_SONG` read
path that surfaces a song's reading state, and `SET_TRANSPOSITION` /
`SET_VARIATION` writes that persist it through `home-book.set` (auto-committed,
never user-pushed) and re-surface the `song` slice.

## Why it needs to be done

It is the screen that plays a song — the destination of search, the host the
editor and history have been waiting for (`App.jsx:23,32`), and the surface
`songs.arrange` (`depends !reading`), `songs.first_song` (`depends !reading`) and
`books.setlists` (`depends songs.reading`) build on next. Milestone **M2
(`m2_local`)** depends on it directly (`tasks/99-milestones.tji:23`): without it
a songbook on one device cannot be read. It also discharges the
`SET_TRANSPOSITION` deferral `music.transpose` left for it.

## Inputs / context

### Governing design

- **Workflow 2** ([`docs/workflows/02-find-and-play.md`](../../../docs/workflows/02-find-and-play.md)),
  the normative spec for this screen:
  - **"## Reading a song"** (L67-86): opening a result "shows the song to be
    read … the chart, then the shapes, a page at a time on a phone" (L69-70); the
    instrument in use decides the shapes; where a tuning has more than one
    variation "a picker chooses between them; which one is in use is remembered
    per song and tuning, in the home book" (L73-74); a song with no voicings
    "still plays: every chord takes a default …, marked as not the song's choice,
    and the page offers **arrange for cavaquinho**" (L75-77); from the reading
    view the song "can be edited (workflow 4), its history opened (workflow 6),
    transposed (below), and printed" (L84-85).
  - **"### Where a chord's shape comes from"** (L88-108): the §7.6 order — the
    song's choice shown plain (L92-93), *your shape* (L94-96), *default* (L97);
    "On paper they print alike" (L100); my shapes match by chord not spelling,
    applied at display time, never written into the song (L103-108).
  - **"## Transposing"** (L111-151): "It changes the view, never the song"
    (L113-114; cites cifra.md §8.6, L116); "A transposed song has no chosen
    shapes" — my shape or the default, even when a transposed chord coincides
    with one the song voices (L120-125); capo is *Later* (L127-129, **out of
    scope**); spelling follows the key, else fewest accidentals (L131-133);
    remembered per song in the home book and shown plainly — *transposed to D
    (+2)* — "with a way back to the written key" (L135-138); while transposed
    *edit* opens the text as written and *arrange* is **not** offered (L140-146);
    printing and a link carry the transposition, search matches chords as written
    (L148-149).
  - **"## Offline"** (L153-155): "Search, the explorer and reading all run on
    what is on the device."
  - **Edge case** (L165): "A song open while sync brings a new version of it —
    see workflow 8."
- **Workflow 8** ([`docs/workflows/08-sync.md`](../../../docs/workflows/08-sync.md)),
  **"## A song open while it changes"** (L50-57): being read, "it updates in
  place, keeping the place on the page, with a notice — *updated by Ana: see what
  changed* — that opens its history" (L51-52); being read full screen, "it waits,
  and updates when the user leaves it. The middle of a performance is the worst
  moment for a song to move" (L53-54); being edited with unsaved changes, "the
  incoming version is merged under them (DIRECTION §3.1)" (L55-56). **This
  section needs sync and is deferred** (see Decisions).
- **DIRECTION** ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md)):
  - §3.2 Personal state (L136-151): "which variation is in use and how far a song
    is transposed, *my shapes*" live in the home book, "committed automatically —
    explicit save is for what the user authors, not for preferences."
  - §3.4 "One instance, and what comes after it" (L224-233) and §1 "Offline
    first" (L29): reading runs on what is on the device.
  - §3.7 The app (L394-434): React + React Aria Components; "the shape picker,
    comboboxes, segmented controls" (L400-401); "Charts are drawn by the app, in
    a proportional face, as chords stacked over the syllables … with a centred
    hyphen" (L422-423); "The middle of a performance is the worst moment for
    anything to move."
  - §4 The interface (L436-458): song history is "a diff in musical terms" seen
    in the song's own view (L454-456) — what the "see what changed" notice opens.
- **home-book-format** ([`docs/home-book-format.md`](../../../docs/home-book-format.md))
  **§4.5 `songs.json`** (L295-316): per song ref (§2.3 `<book-id>/<path>`, NFC),
  `transposition` — "the semitone offset …, a signed integer; `0` or the absent
  register means the written key" (L312-314) — and `variation` — "a map keyed by
  tuning, each a register whose value names the variation in use for that tuning"
  (L315-316). `shapes` ride the `instruments` slice (§4.4).

### The mockup (what the drawings decide)

[`docs/mockups/W02-find-and-play.dc.html`](../../../docs/mockups/W02-find-and-play.dc.html)
draws the reading view on three devices:

- **Phone** (L63-100): app bar Back · title · icon button `aria-label="Transpose"`
  · "More" overflow; meta "Pedro Araújo · My songs", chips "Guitar", "Key of G";
  the `.chart`; a "Shapes" heading then four `ChordDiagram`s `kind="song"`; a
  bottom action bar "Arrange", "Edit", primary **"Full screen"** (L97).
- **Tablet** (L107-143): a song "with nothing chosen for the cavaquinho" — the
  accent notice "Nobody has chosen shapes for cavaquinho in this song yet. These
  are the easiest shapes for each chord." with action "Arrange for cavaquinho"
  (L118); chart (lines carry `mark-def`) left, a "Shapes · cavaquinho" card right
  with `kind="default"` / `kind="yours"` diagrams and the caption "Hollow: the
  app's default. Filled in colour: your shape for that chord." (L138).
- **Computer** (L149-212): master-detail — search in the left pane ("Recent",
  "Books"), the song in the right pane; right-pane app bar buttons, in order,
  **"Edit", "History", "Add to setlist", "Print", "Share"** (L172-179); a
  transpose status row: accent chip **"Transposed to A (+2)"**, quiet button
  **"Back to G"**, right-aligned note **"Arranging is off while transposed"**
  (L181-186); the chart transposed into A; heading "Shapes in A" with
  `kind="yours"` / `kind="default"` diagrams and caption "The song's own shapes
  are for G, so transposed chords use your shapes, then the defaults." (L206).

[`docs/mockups/README.md`](../../../docs/mockups/README.md) "Decisions the
drawings carry" (L23-26): charts proportional, not monospace (L24); a diagram up
the neck shows the fret number alone (L25); "Defaults are drawn hollow, your
shapes filled in the chord colour, the song's own shapes filled in ink. Every
status badge carries a word, never colour alone." (L26).

### The code seams this extends

- **The reading view does not exist yet.** A song is addressed everywhere by
  `{ bookId, path }`; there is no `SongReading`/`SongView` component. The chart,
  the diagram, the transpose engine and the `songs.js` reading-state helpers are
  the seams it composes. The `#dev/<name>` hash-mount pattern (`#dev/chart`,
  `#dev/editor`, `#dev/history`, `App.jsx:13-53`) stands a surface up before its
  real host wires it; this task adds `#dev/reading`.
- **Worker protocol** (`app/src/worker/protocol.js`): `command(kind, payload)` /
  `event(kind, payload)`, `CommandKind` / `EventKind` (open strings); the view
  sends `store.send(command(…))` and reads `useSlice(store, name)` /
  `useWorkerEvent(store, kind, handler)` (`app/src/worker/useStore.js:15,30`);
  the dispatch is the `switch (message.kind)` in `handle` (`logic.js:657`). No
  promise/correlation API. Existing kinds this task reuses:
  `CommandKind.OPEN_SOURCE { bookId, path }` → `EventKind.SOURCE { bookId, path,
  text }` → `source` slice (`logic.js:1056-1066`) — the working-copy text the
  view parses, exactly as the editor does (editor Decision 2); and
  `CommandKind.RECORD_RECENT { bookId, path }` (`logic.js:907`) on open.
- **The reading-state seam** (`app/src/worker/songs.js`): `transpositionOf` /
  `transpositionChange` already there; this task adds `variationOf` /
  `variationChange` beside them, and `home-book.set({ bookId, file, changes,
  author, now })` is the writer (each change `{ path, value }` stored as a
  `{ value, at }` register, auto-committed; `instruments.js` tombstones
  `songs.json[*].variation[<tuning>]` when no instrument still uses a tuning).

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data.** *Central.* The
  Worker owns IndexedDB, git and the home book; the main thread never touches
  storage. Reading state is read through the `song` slice and written through
  `SET_TRANSPOSITION` / `SET_VARIATION` commands — never by the view touching
  storage. "Which song is open", the transpose stepper's open state, and full
  screen are ephemeral `useState`, never a Worker slice.
- **View only, never the song.** *Central.* Transposition and the variation in
  use are personal state in the home book (DIRECTION §3.2, home-book-format §4.5);
  the song's bytes are never rewritten by reading. cifra.md §8.6 leaves document
  transposition undefined; `key` is informative and left as written. Canonical
  form over preserving content does not arise — reading writes no song.
- **The §7.6 resolution order, marked.** Each chord resolves song → yours →
  default via `resolveSongVoicings`; the chart marks every occurrence whose source
  is not `song` (`markOf → 'def'`), and each `ChordDiagram` carries the matching
  `kind`. Status is a word, never colour alone (mockups README L26) — the shapes
  print alike (workflow 2 L100). While transposed the resolver is called with
  `ignoreSongVoicings: true` (workflow 2 L120-125).
- **Accessibility.** Every interactive part — the transpose control, the
  variation picker, the overflow menu, the app-bar buttons, full-screen enter/
  exit — is a React Aria Component with a keyboard path; axe at WCAG 2.1 AA on
  every state (default, transposed, no-voicings, full screen). Overlays portal
  into `.est`.
- **Offline first.** Reading, its shapes and the explorer run on what is on the
  device (workflow 2 L153-155, DIRECTION §3.4); nothing on this screen waits on
  the network.
- **No song text in logs; no book without an account.** The Worker logs request
  metadata only; `OPEN_SONG` / `SET_*` carry a song ref and an offset/variation,
  never song text. Reading a hosted book still needs the session and membership
  the request layer enforces — unchanged here.
- **Capo is out of scope** (workflow 2 L127-129 marks it *Later*).

## Acceptance criteria

### Behavior delivered

1. **The chart and the shapes.** Opening `{ bookId, path }` renders the parsed
   song as a chart (proportional, chords over syllables) and a shapes section of
   `ChordDiagram`s, each resolved and marked song/yours/default. A song with no
   block for the tuning shows every chord as a `default` with the accent notice
   and an "Arrange for {instrument}" action (→ `onArrange`, `songs.arrange`'s).
   Chords the search cannot voice (`unvoiceableKeys`) are listed as unvoiced, the
   song still read. *Pins workflow 2 L69-77, L88-108; mockups W02, README L26.*
2. **The variation picker.** When `songVariations(parsed, tuningId)` yields more
   than one label for the instrument's tuning, a picker (RAC) chooses between
   them; a choice dispatches `SET_VARIATION` and re-resolves the shapes; the
   choice is remembered per song and tuning (home book) and re-applied on reopen.
   Keyboard-operable. Hidden while transposed. *Pins workflow 2 L73-74, L120-125;
   home-book-format §4.5.*
3. **Transpose.** The Transpose control steps the song up/down by semitones,
   dispatching `SET_TRANSPOSITION`; the chart re-renders transposed (one global
   spelling, key-aware) and every shape falls to yours/default
   (`ignoreSongVoicings`); the destination key shows as a chip "Transposed to
   {key} ({±n})" with a "Back to {written key}" reset and the note "Arranging is
   off while transposed"; when the song has no `key`, the chip shows the signed
   offset without a key name. The offset is remembered per song and re-applied on
   open. *Pins workflow 2 L111-146; mockups W02 L181-186; music.transpose
   deferral.*
4. **Full screen, print, and the app bar.** A chrome-free full-screen reading
   mode (enter from the phone primary action / the overflow; a keyboard-reachable
   way out); a print stylesheet that prints the chart and shapes with chrome
   hidden and shapes printing alike. The responsive app bar carries Edit (→ the
   editor), History (→ the history surface), Arrange, Add to setlist, Print,
   Share — the wide layout shows them inline (computer), the narrow collapses the
   secondary ones into "More". *Pins workflow 2 L84-85, L97; mockups W02
   L94-98, L172-179; DIRECTION §3.7.*
5. **Add to setlist and share are seams.** The app bar's "Add to setlist" and
   "Share" invoke `onAddToSetlist` / `onShare` callbacks; the toolbar owns the
   affordance, the destination flows are owned by `books.setlists` (`depends
   songs.reading`) and `books.share`, which wire them (mirrors editor Decision
   10). *Pins the note; mockups W02 L176,178.*
6. **Recorded on open, reached offline.** Opening a song dispatches
   `RECORD_RECENT` (device-local, no home-book song commit); the whole screen —
   song, shapes, transpose, explorer — works offline. *Pins workflow 2 L17-20,
   L153-155; search.md (the recents seam's consumer).*

Wiring: the view sends `OPEN_SOURCE` (text, parsed in the view) and `OPEN_SONG`
(reading state) on mount; reads the `instruments` and `preferences` slices for
the instrument/shapes/dialect; composes `model = parse(text, dialect)` →
`transpose(model, offset)` → `resolveSongVoicings(…, { variation, shapes,
ignoreSongVoicings: offset !== 0 })` → `<Chart markOf>` + `<ChordDiagram>`;
computes the chip from `transposedKeyName(key, offset, dialect)`. `AppShell`
holds the open-song `useState` (narrow push / wide master-detail).

### Tests the task lands with, by level

Fixtures are purpose-written songs (and the bundled example book), never
anyone's copyrighted words.

- **unit** (added — the `.tji` names behavior + e2e-web; the task introduces pure
  seams that a pure module gets unit tests for, as siblings did):
  - **`app/src/worker/songs.test.js`** (extended): `variationOf(songsModel,
    songRef, tuning)` returns the register's string value, `''` when absent/
    malformed/tombstone; `variationChange(songRef, tuning, variation)` returns
    `{ path: [songRef, 'variation', tuning], value }`. *Pins home-book-format
    §4.5 L315-316.*
  - **`app/src/core/song-variations.test.js`**: `songVariations(parsed, tuningId)`
    returns the ordered variation labels for a tuning (`''` default first), `[]`
    when the tuning has no blocks; never borrows across tunings. *Pins cifra.md
    §7.6, workflow 2 L73-74.*
- **behavior — `app/src/songs/SongReading.behavior.test.jsx`** (real RAC + i18n,
  a loopback-backed store with seeded `source`/`song`/`instruments`/`preferences`
  slices, axe over `container`):
  - *The chart and the shapes* — chords render over syllables; the shapes resolve
    song/yours/default and mark the non-song ones; a no-voicings song shows the
    notice + "Arrange for {instrument}" (→ `onArrange`); an unvoiceable chord is
    listed unvoiced. *Pins workflow 2 L69-77, L88-108.*
  - *The variation picker* — a song with two variations for the tuning shows the
    picker; a choice dispatches `SET_VARIATION` and re-renders; keyboard path; the
    picker is gone while transposed. *Pins workflow 2 L73-74, L120-125.*
  - *Full screen* — Full screen enters the chrome-free mode and returns; axe in
    full screen. *Pins workflow 2 L97, DIRECTION §3.7.*
  - *Print styles* — the print media rules hide chrome and keep the chart +
    shapes; shapes carry a word, not colour alone. *Pins workflow 2 L85, L100,
    mockups README L26.*
  - *Add to setlist / share* — the buttons invoke `onAddToSetlist` / `onShare`.
    *Pins the note, mockups W02 L176,178.*
  - *Transpose* — Transpose dispatches `SET_TRANSPOSITION`; the chip "Transposed
    to {key} ({±n})", "Back to {written}", "Arranging is off while transposed"
    render; the chart re-renders and every shape is yours/default; a keyless song
    shows the offset without a key name. *Pins workflow 2 L111-146, mockups W02
    L181-186.*
  - axe clean on default, transposed, no-voicings and full-screen states.
- **behavior — `app/src/worker/song-state.behavior.test.js`** (the Worker rig —
  loopback + `fake-indexeddb` + `startGitHttpRemote` + `installWebLocks`, as
  `instruments.behavior.test.js`): `OPEN_SONG { bookId, path }` emits `SONG` with
  the song's `{ transposition, variations }` from `songs.json`;
  `SET_TRANSPOSITION` writes the `transposition` register and re-surfaces `SONG`;
  `SET_VARIATION` writes the per-tuning `variation` register; both make an
  automatic home-book commit and **no user push** (asserted against the local
  remote); a `RECORD_RECENT` on open makes no home-book *song* commit. *Pins
  DIRECTION §3.2, home-book-format §4.5, workflow 2 L73-74, L135-138.*
- **e2e-web — `e2e/web/tests/reading.spec.js`** (compose stack, phone/tablet/
  computer projects, songs seeded via `OPEN_EXAMPLE_BOOK`, axe WCAG 2.1 AA):
  - *Open and read on the three viewports* — open a seeded song; the chart and
    shapes render; on the computer, search sits beside the song (master-detail).
    *Pins workflow 2 L67-70, mockups W02, shell.layout.*
  - *Transpose and reopen* — transpose up, see the chip; reload and reopen the
    song — the offset is remembered. *Pins workflow 2 L135-138, music.transpose
    deferral.*
  - *Offline: after a reload with the network cut, the song, its shapes and the
    explorer* — reload offline; the song reads with its shapes; the chord explorer
    opens. *Pins workflow 2 L153-155, DIRECTION §3.4.*
  - axe at WCAG 2.1 AA on the reading screen (default, transposed, full screen) on
    every viewport.

The note's **"updated in place by a sync from the stack"** e2e case is **not**
delivered here — it needs sync, which is not a dependency. It moves, with its
whole behavior, to a registered follow-up (below); its tests land there.

### Deferred work (closer registers in the WBS)

- **`sync.read_in_place`** — "A song open while sync changes it." The
  updated-in-place behavior of workflow 8 §A song open while it changes (L50-54):
  a sync bringing a new version of the open song updates it in place keeping the
  place on the page, with the notice *updated by {name}: see what changed* that
  opens its history; read full screen, the update waits until the reader leaves
  it. Area `sync`, **~1.5d**, `allocate team`, `depends songs.reading,
  sync.states`, milestone **M3 (`m3_service`)**. Not a `cifra.md:` task. Tests:
  behavior (the in-place update keeps the place, the notice opens history, full
  screen defers until exit; axe); e2e-web (a song open while a sync from the stack
  brings a new version updates in place on the three viewports, full screen
  defers; axe). *(The being-edited-under-unsaved case, L55-56, is already
  `sync.unsaved`'s.)* (closer registers in the WBS.)

The **Add to setlist** and **Share** destinations are not new leaves: the flows
are owned by `books.setlists` (`depends songs.reading`) and `books.share`, which
fill the `onAddToSetlist` / `onShare` seams this task exposes.

## Decisions

1. **The view composes the music core; the Worker surfaces state, not a prepared
   model.** *Chosen:* the view parses the working-copy text (`OPEN_SOURCE`, as the
   editor does) and calls `transpose` / `resolveSongVoicings` / `transposedKeyName`
   itself, feeding `<Chart>` and `<ChordDiagram>`; the Worker surfaces only the
   small reading state (`transposition`, `variations`) via `OPEN_SONG` → `SONG`.
   *Rationale:* music.transpose's own behavior test renders `<Chart model={
   transpose(parse(SONG), 2)} />` — the intended composition is at the view; the
   engines are pure and fast; this reuses the shared "parse in the view, Worker
   owns durability" rule (editor Decision 2) and keeps `songs.js` Worker-only and
   song-text-free. *Rejected:* a Worker command returning a fully transposed model
   + resolved voicing map — it would move chart/diagram concerns and the dialect
   into the Worker, duplicate parsing, and pass large structured payloads for no
   gain.
2. **A dedicated `OPEN_SONG` → `SONG` slice, not a field on `SOURCE`.** *Chosen:*
   reading state rides its own command/event/slice keyed by `{ bookId, path }`,
   mirroring `OPEN_SOURCE` → `SOURCE` → `source`. *Rationale:* reading always needs
   both text and state, but the editor needs only text; folding state onto
   `SOURCE` would couple the editor to reading state it never uses. A separate
   slice re-surfaces cleanly after `SET_TRANSPOSITION` / `SET_VARIATION`.
   *Rejected:* surfacing the whole `songs.json` projection as one slice (like
   `preferences`) — unbounded growth and a per-song read is all the view wants.
3. **`variationOf` / `variationChange` mirror the transposition half.** *Chosen:*
   add the two pure helpers beside `transpositionOf` / `transpositionChange` in
   `songs.js`, unit-tested, with `SET_VARIATION` dispatching `variationChange`.
   *Rationale:* the file header already reserves "the variation half" for this
   task; the register shape is defined (home-book-format §4.5); this is the exact
   pattern music.transpose established. *Rejected:* keeping the variation in use
   as ephemeral view state — workflow 2 L73-74 requires it remembered per song and
   tuning in the home book.
4. **The updated-in-place behavior is sync's, deferred.** *Chosen:* this task
   ships the reading surface as it is at open; the "updated in place by sync"
   behavior and its e2e move to `sync.read_in_place` (M3), which depends on this
   task and on `sync.states`. *Rationale:* reading's declared graph has no sync
   (`depends music.fallback, music.transpose`; parent cascade adds only layout/
   chart/e2e_web) and reading lands in **M2**, a single device with no network
   sync — there is no signal to update in place against, and the note's "a sync
   from the stack" e2e cannot run honestly. The deferral moves a *feature with its
   tests* to the era it can exist in, not a test off a delivered feature — the
   behavior does not exist in M2 at all. *Rejected:* building a view-side
   in-place mechanism now against a simulated re-emit — it would ship an untestable
   half-feature (no real trigger, no honest e2e) and pre-empt decisions
   `sync.states` owns.
5. **The reading view is the host; `AppShell` owns the open-song navigation.**
   *Chosen:* `AppShell` holds an ephemeral `openSong` `useState` (set from a
   search result); narrow pushes the reading screen over the tabs, wide renders it
   in `.pane.main` with search in `.pane.side` (the computer mockup's
   master-detail). A `#dev/reading?book=…&path=…` mount stands it up for tests
   ahead of the real search wiring. *Rationale:* shell.layout decided "no router,
   navigation is ephemeral useState" and provides exactly this master-detail
   split; the dev-mount pattern (editor/history) lets behavior and e2e run now.
   *Rejected:* a route/store slice for the open song — against shell.layout's
   no-router decision.
6. **Add to setlist and Share are affordance seams, not flows built here.**
   *Chosen:* render the buttons, invoke `onAddToSetlist` / `onShare`; the flows are
   `books.setlists` / `books.share`'s (which depend on / integrate with this
   view). *Rationale:* the toolbar is reading's, the destinations are sibling
   tasks' (the editor-owns-the-affordance, host-owns-the-action pattern, editor
   Decision 10); `books.setlists` already `depends songs.reading`. *Rejected:*
   building the setlist picker and share sheet here — out of this task's note and
   duplicating work those leaves own.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- **Core seam — `app/src/core/song-variations.js`**: pure `songVariations(parsed, tuningId)` helper enumerating variation labels for the picker; unit-tested in `app/src/core/song-variations.test.js` (6 tests).
- **Worker reading-state — `app/src/worker/songs.js`**: added `variationOf`, `variationChange`, `variationsOf`, `songRefOf`; `app/src/worker/songs.test.js` extended (17 tests total).
- **Worker protocol/logic — `app/src/worker/protocol.js`** (+`OPEN_SONG`, `SET_TRANSPOSITION`, `SET_VARIATION`, `SONG`); **`app/src/worker/reducer.js`** (`song` slice); **`app/src/worker/logic.js`** (3 handlers + `surfaceHomeBookSong`).
- **Reading surface — `app/src/songs/SongReading.jsx`**, **`app/src/songs/reading.css`**, **`app/src/songs/reading-view.js`** (pure view helpers), **`app/src/songs/ReadingDev.jsx`** (`#dev/reading` mount).
- **Shell wiring — `app/src/shell/AppShell.jsx`** (open-song `useState`, search→reading nav; narrow push / wide master-detail); **`app/src/App.jsx`** (`#dev/reading?book=…&path=…` dev hash mount).
- **i18n — `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`**: new `reading.*` section (48 keys in `en.js`).
- **Bug fixes (fixer) — `app/src/songs/SearchScreen.jsx`** (SEARCH re-fires on index change, mirroring BROWSE); **`app/src/theme/theme.css`** (`.appbar .title` → `flex: 1 1 auto`).
- **Tests — unit**: `app/src/core/song-variations.test.js`, `app/src/songs/reading-view.test.js`, extended `app/src/worker/songs.test.js`; **behavior**: `app/src/songs/SongReading.behavior.test.jsx` (11 tests; chart+shapes, variation picker, transpose, full screen, print, add-to-setlist/share, wide master-detail, axe × 4 states), `app/src/worker/song-state.behavior.test.js` (4 tests; OPEN_SONG, SET_TRANSPOSITION, SET_VARIATION round-trips, auto-commit + no push, RECORD_RECENT no song commit); **e2e-web**: `e2e/web/tests/reading.spec.js` (9 tests: open+read × 3 viewports, transpose+reopen, offline song/shapes/explorer, axe).
- **Deferred**: `sync.read_in_place` registered in the WBS (`tasks/45-sync.tji`), wired to M3.
