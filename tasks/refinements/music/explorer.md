# music.explorer — The chord explorer

## TaskJuggler entry

[`tasks/55-music.tji`](../../55-music.tji), `task music.explorer`
("The chord explorer"), under `task music` (which
`depends foundation.music_core_import`).
`depends design.explorer, shell.diagram, !instruments, foundation.e2e_web`.

`note`: *"Workflow 16 built: search's chord row opens it; fingerings ranked,
grouped by position; starring a shape as my shape. Tests: unit (ranking and
grouping by position); behavior (the explorer with Testing Library and axe, a
keyboard path through fingerings, starring); e2e-web (search's chord row opens
it, a shape starred as my shape, used offline too; axe)."*

## Effort estimate

3d (`allocate team`), unchanged from the `.tji`. The ranking, grouping,
position bucketing, scoring, finger assignment, the diagram and the chord
parser are all **already in hand** — carried whole from Explore Chords
(`foundation.music_core_import`, Done) and already drawn by the shipped
`ChordDiagram` (`shell.diagram`, Done). So no music logic and no diagram
drawing is written here. The weight is the **frame**: one new screen, the
shared ranked-and-grouped view component (the seam `songs.arrange` will reuse),
the editable chord input with its notation-flip notice, the by-hand
*enter a shape* dialog, the Worker's one new `SAVE_SHAPE` write (unstar already
exists as `REMOVE_SHAPE`), and wiring search's existing chord row to open it.
One small music-core addition is in scope and called out under Decisions: the
fourth cifra.md §5.6 ambiguity (`C7(4)`), which the carried parser does not yet
report.

## Repository

**estante-de-cifras** only. App work (the note does not start with
`cifra.md:`). Nothing lands in `/home/ruoso/devel/cifra.md`; the one place this
task meets the format is conforming the app's carried chord parser to cifra.md
[`spec/5-chord-symbols.md` §5.6](../../../../cifra.md/spec/5-chord-symbols.md)
(the four ambiguities), a chapter already specified — no spec, reference or
corpus change. Directories touched:

- `app/src/music/` — **new** view feature: the explorer screen
  (`ChordExplorer.jsx`), the **shared** ranked-and-grouped component
  (`FingeringGroups.jsx` + its framework-free helper `fingering-groups.js`), the
  by-hand `EnterShape.jsx` dialog, all React Aria Components. (New directory;
  see Decisions — the area is `music` and `FingeringGroups` is shared with the
  in-song picker, so it is not under an `instruments/`- or `explorer/`-only
  home.)
- `app/src/worker/` — one new command kind `SAVE_SHAPE` in `protocol.js` and its
  arm in `logic.js`, mirroring the existing `REMOVE_SHAPE`. The write goes
  through the already-built `home-book.js` `set`. No new event: starred state
  rides the existing `INSTRUMENTS` event (shapes are already surfaced).
- `app/src/core/notation/` — `dialects.js` and `parse.js`: add the fourth
  §5.6 ambiguity `sevenFour` (`C7(4)`), the only one the carried parser omits.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the screen copy: the chord
  label, the four notation-flip notices, the difficulty words, the empty/
  unparseable states, *enter a shape*, the star's accessible names, in all four
  locales.
- `app/src/songs/SearchScreen.jsx` / `app/src/App.jsx` (or `shell/AppShell.jsx`)
  — wire the already-rendered chord row (i18n `search.explore`) to open the
  explorer surface carrying the typed symbol, and *back* to return to search
  with it still typed.
- `app/src/diagram/`, `app/src/core/`, `app/src/render/`, `app/src/instruments/`
  — **consumed, not modified** (except the notation addition above):
  `ChordDiagram.jsx` draws every shape; `core/search.js`, `core/score.js`,
  `render/diagram.js` do the search, scoring and accessible name; the
  `instruments` slice supplies the in-use instrument and its saved shapes.
- `e2e/web/tests/explorer.spec.js` — the workflow-16 journey.

## Inherited dependencies

All four settled.

- **`design.explorer`** — Done 2026-10-05
  ([`tasks/refinements/design/explorer.md`](../design/explorer.md)). The
  governing design: it wrote
  [`docs/workflows/16-chord-explorer.md`](../../../docs/workflows/16-chord-explorer.md)
  (Status: decided) and the board
  [`docs/mockups/W16-chord-explorer.dc.html`](../../../docs/mockups/W16-chord-explorer.dc.html)
  (registered in `canvas.json`), and retired the DIRECTION §6 bullet / added §7
  item 16. It decided, among others: one shared ranked-and-grouped component for
  the explorer *and* the in-song picker so order can never drift (the seam this
  task builds and `songs.arrange` reuses); position = open-or-lowest-fretted,
  not CAGED; difficulty as a bucketed word; starring writes *my shape* to the
  home book, never into a song; the §5.6 flip, not a dialect picker;
  *enter a shape* decided **in** the explorer.
- **`shell.diagram`** — Done 2026-10-05
  ([`tasks/refinements/shell/diagram.md`](../shell/diagram.md)). Shipped
  [`app/src/diagram/ChordDiagram.jsx`](../../../app/src/diagram/ChordDiagram.jsx)
  — the vertical chord box over the carried SVG renderer, in kinds
  `song | yours | default`, its accessible name the `describeFingering`
  sentence. It is **non-interactive by decision**: "when an enclosing surface
  makes the diagram pressable, that surface owns the control and its keyboard
  path." The explorer is that surface for the star.
- **`music.instruments`** (`!instruments`, same milestone) — Done 2026-10-06
  ([`tasks/refinements/music/instruments.md`](instruments.md)). Built the model
  this task reads: the header chip
  ([`InstrumentChip.jsx`](../../../app/src/instruments/InstrumentChip.jsx),
  mounted once in `AppShell.jsx`), the in-use instrument and voicing rules, the
  `shapes.json` path and its `REMOVE_SHAPE` write, and the per-instrument
  my-shapes review ([`MyShapes.jsx`](../../../app/src/instruments/MyShapes.jsx))
  — so this task does **not** build a cross-chord shape-management surface. It
  also fixed the Worker patterns (`protocol.js`, `logic.js`,
  `worker/instruments.js` surfacing shapes) this task extends by one command.
- **`foundation.e2e_web`** — Done 2026-10-05
  ([`tasks/refinements/foundation/e2e_web.md`](../foundation/e2e_web.md)). The
  Playwright harness at `e2e/web/`: three viewport projects (phone, tablet,
  computer), the axe fixture `e2e/web/lib/axe.js`
  (`import { test, expect } from '../lib/axe.js'`, WCAG 2.1 AA), and the offline
  helper `e2e/web/lib/offline.js`. The explorer's e2e is written here, never in
  a parallel harness.

Note — one dependency is **implicit in the graph**: the e2e criterion "search's
chord row opens it" needs the search screen. `songs.search` is Done
([`tasks/60-songs.tji`](../../60-songs.tji), `complete 100`): `SearchScreen.jsx`
already renders the chord row (i18n `search.explore`,
`app/src/i18n/locales/en.js:63`), so the row exists and this task wires its
press to the explorer. The `.tji` does not list a `music.explorer depends
songs.search` edge; see Graph notes under Acceptance criteria.

## What this task is

The screen *Explore A on your guitar* opens — reached through search, not a
home (workflow 16, DIRECTION §4). Given a chord symbol and the instrument in
use, it shows **every way to play that chord on that instrument, ranked easiest
first and grouped by position**, each shape drawn as a `ChordDiagram` with a
**difficulty word** and a **star**. The chord is an **editable input** (type
`Am` over `A` and the shapes re-derive); the instrument is the ambient header
chip (changing it re-derives for the new tuning). **Starring** a shape writes it
as *your shape* for that chord on that instrument and tuning — one leaf in the
home book's `shapes.json`, committed automatically, **never written into a
song**. An ambiguous symbol (one of cifra.md §5.6's four) shows **the reading it
took and a flip to the other**. *Enter a shape* places a fingering by hand and
lets it be starred. The whole screen runs on the device, offline, needing no
account.

## Why it needs to be done

It is the chord row's destination. `songs.search` already offers *Explore A on
your instrument* as the first result when the typed text parses as a chord
(workflow 2), but the row opens nothing yet — this task is what it opens. It is
also the only place a user records *your shape* one chord at a time (the
my-shapes list in `music.instruments` only **reviews and removes**; the empty
state there already reads "Star one in the explorer",
`app/src/i18n/locales/en.js:1428`). And it builds the **shared
ranked-and-grouped component** that `songs.arrange` (workflow 5's in-song
picker) will reuse, so *explore a chord* and *choose a shape in a song* can
never rank or group differently (design.explorer's recorded seam). The
`music.fallback` task then consumes a starred *your shape* as a fallback source
in the reading view (workflow 2's fallback order).

## Inputs / context

Normative (read before scoping):

- **Workflow 16** —
  [`docs/workflows/16-chord-explorer.md`](../../../docs/workflows/16-chord-explorer.md),
  the whole document. Getting here and the chord input (L22–36); ranked,
  grouped by position (L38–73, the six-per-group cap at L67, the difficulty word
  at L50–54, position at L56–63); viewing by notation and the four flips
  (L75–106); starring as *your shape* (L108–133, the never-into-a-song rule
  L129–133); *enter a shape* by hand (L136–146); scrolling and the keyboard path
  (L149–161); offline and no-account (L164–170); edge cases — no fingering, a
  word-and-chord query, an ambiguous symbol, a large set, an unparseable symbol
  (L173–191); out of scope (L194–205).
- **Board** —
  [`docs/mockups/W16-chord-explorer.dc.html`](../../../docs/mockups/W16-chord-explorer.dc.html):
  the real states and copy. Phone exploring A on guitar with one shape starred
  (L29–79) and the empty state on a cavaquinho (L82–104); tablet C7+ with the
  reading-it-took notice and flip (L111–167); computer reached from search's
  chord row, explorer beside the results (L173–244). The app bar is *Back to
  search · Explore a chord · [instrument chip]*; the star is a pressed-state
  button with an accessible name like *"Your shape for A, x02220 — unstar"* /
  *"Star A, 002220 as your shape"*; the group header is *Open · 6 shapes* /
  *Fret 5 · 2 shapes*; *Show 3 more*; the notice reads *"Read as **C7M** —
  major seventh… Read as C7♯5 instead?"*; the empty state is *"No shape fits the
  rules"* with a *Voicing rules* button.
- **cifra.md §5.6** —
  [`spec/5-chord-symbols.md` §5.6](../../../../cifra.md/spec/5-chord-symbols.md)
  (L237–266): the four ambiguities, their per-dialect default readings and the
  flip target, and the MUST-report rule ("a reader MUST apply the dialect and
  MUST report that it did"). The table at L245–248 is the source of truth for
  the four flips; `C7(4)` (sus4/add4 on a major triad) at L248, L261–265 is the
  one the carried parser does not report.
- **home-book format §4.4** —
  [`docs/home-book-format.md`](../../../docs/home-book-format.md) (L275–293):
  `shapes.json` keyed instrument id → tuning → chord, leaf value the opaque
  shape in a `{ value, at }` register; the chord key is the chord **as the music
  core matches it** (by chord, not spelling, L291–293).
- **DIRECTION** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md): §3.2 personal state
  (L136–151, starring is a preference that commits automatically — no explicit
  save); §3.7 the app (L394–434, React Aria, the Worker owns the data, the view
  is the only React layer, charts/diagrams drawn by the app, axe at AA); §4 the
  interface (L436–447, search is primary, the explorer reached through it); §5
  what comes over from Explore Chords (L460–482, the music core and rendering
  carried as is, the state layer and shell **not**).

The seams, on disk (consumed, not rebuilt):

- **The search, ranking, grouping, position** —
  [`app/src/core/search.js`](../../../app/src/core/search.js):
  `searchFingerings(chord, instrument, config, options)` (L344) already returns
  `{ groups: [{ position, fingerings, total }], ... }`, **sorted easiest-first,
  ties by position** (L408), **grouped by position** open-first then ascending
  (L410–428), each `Fingering` carrying `position`, `score`, `difficulty`,
  `shorthand`; `positionOf(frets, hand)` (L142, `OPEN_POSITION_LIMIT = 4` L129);
  `fingeringFromFrets(frets, chord, instrument, config)` (L447) builds a scored
  `Fingering` from hand-entered frets (for *enter a shape*). Ranking and
  grouping are **already implemented and already tested** here — this task does
  not reimplement them (see Decisions).
- **The difficulty word** —
  [`app/src/core/score.js`](../../../app/src/core/score.js):
  `difficultyBucket(total)` → `'easy' | 'medium' | 'hard'` (L90),
  `DIFFICULTY_LABELS` (L96). The number is never shown (workflow 16 L50–54).
- **The accessible name** —
  [`app/src/render/diagram.js`](../../../app/src/render/diagram.js):
  `describeFingering(fingering, { chord, dialect, instrument })` (L186) — the
  sentence the `ChordDiagram` already renders as its `role="img"` name.
- **The diagram** —
  [`app/src/diagram/ChordDiagram.jsx`](../../../app/src/diagram/ChordDiagram.jsx)
  (props at L24–33: `fingering`, `context={chord,dialect,instrument}`,
  `kind='song'|'yours'|'default'`, `size`, `className`). Starred →
  `kind="yours"` (chord colour, word *your shape*); unstarred → `kind="default"`
  (word *default*). Non-interactive; the explorer owns the pressable star.
- **The chord parser and the dialect flip** —
  [`app/src/core/notation/parse.js`](../../../app/src/core/notation/parse.js):
  `parseChord(text, options)` returns `{ chord, ambiguities, errors }`;
  `ambiguities[]` are `{ kind, chosen, alternatives }` (L19–27), and
  `options.readings` overrides one reading **per parse without changing the
  dialect** (L157–160) — this is exactly the flip. Three kinds are reported
  today: `sevenPlus` (L370–382), `bareNine` (L417), `degreeSign` (L466–470).
  [`app/src/core/notation/dialects.js`](../../../app/src/core/notation/dialects.js):
  `DIALECTS` readings (L28) and `READING_LABELS` (L73) carry the per-dialect
  default and the human-readable two-sided labels — both missing the `sevenFour`
  key (see Decisions). The notation preference is the home book's `notation`
  (`preferences.json`), `brazilian` by default.
- **The instrument and its shapes** —
  [`app/src/instruments/InstrumentChip.jsx`](../../../app/src/instruments/InstrumentChip.jsx)
  (`inUseEntry(slice)` L17) and the `instruments` store slice, which
  [`app/src/worker/instruments.js`](../../../app/src/worker/instruments.js)
  already populates with each instrument's `shapes` (`shapesForId` L89, surfaced
  into the `INSTRUMENTS` event). The explorer reads the in-use entry (its
  `catalogId`, `tuning`, `fretCount`, effective `config`) and its `shapes` to
  compute each shape's starred state; the drawable reconstruction helper
  `buildShape(entry, shape)` lives in
  [`app/src/instruments/instrument-helpers.js`](../../../app/src/instruments/instrument-helpers.js)
  (L75).
- **The write path** —
  [`app/src/worker/protocol.js`](../../../app/src/worker/protocol.js)
  (`REMOVE_SHAPE` L163 — the unstar; this task adds `SAVE_SHAPE` beside it) and
  the arm in [`app/src/worker/logic.js`](../../../app/src/worker/logic.js)
  (`REMOVE_SHAPE` at L1325; `home-book.js` `set` does the canonical,
  auto-committed, no-push write).
- **The chord row to wire** —
  [`app/src/songs/SearchScreen.jsx`](../../../app/src/songs/SearchScreen.jsx)
  renders *Explore {query} on your {instrument}* (i18n `search.explore` /
  `search.exploreMeta`, `app/src/i18n/locales/en.js:63–64`). Navigation in the
  shell is **in-memory `useState`, no URL router** (shell.layout); each surface
  composes its own `.appbar`.
- **Test harness** — the behavior stack
  (`app/src/test/loopback.js`, `app/src/test/git-http-remote.js`,
  `app/src/test/web-locks.js`, `fake-indexeddb`) and the e2e axe/offline
  fixtures above, exactly as `music.instruments` used them.

## Constraints / requirements

- **Reuse the carried music core; write no music logic.** Ranking, grouping,
  position, scoring, finger assignment, the difficulty bucket, the accessible
  name and the diagram are all carried and tested (`core/search.js`,
  `core/score.js`, `render/diagram.js`, `ChordDiagram.jsx`). The explorer calls
  `searchFingerings` and renders its `groups`; it must not re-sort, re-group or
  re-bucket. The one music-core edit is the fourth §5.6 ambiguity (Decisions).
- **The shared component boundary (DIRECTION §3.6–3.7).** The ranked-and-grouped
  list is one component used by both the explorer and the in-song picker; the
  explorer wraps it with the chord input and the star, the picker (later, in
  `songs.arrange`) wraps it with *every Cm / only here*. The view is the only
  React layer; the framework-free list helper (`fingering-groups.js`) holds the
  group labels, the display cap, and the starred-match, so a future call site
  and the unit test reach it without React.
- **The Worker owns the data (offline first).** Starring sends `SAVE_SHAPE` to
  the Worker, which writes `shapes.json[id][tuning][chord]` through
  `home-book.set` — canonical, **auto-committed** (a preference, no explicit
  save, DIRECTION §3.2), **no push** (syncs later, workflow 8). The main thread
  never touches IndexedDB or git. Nothing the user does waits on the network;
  the whole search runs on the device.
- **Canonical form, matched by chord.** The stored value is the **shape
  itself** (the fret-string shorthand for that tuning, cifra.md §7), never a
  rendered picture — the diagram is recomputed on load. The chord **key** is the
  chord as the music core matches it (home-book §4.4), so a shape starred for
  `Cmaj7` serves a song that writes `C7M`. A `SAVE_SHAPE` re-uses the exact
  path/key shape `REMOVE_SHAPE` already tombstones.
- **Never into a song.** Starring changes only the home book and thereby the
  reading-view fallback (workflow 2's order); it is never written into song
  text. This is the explicit break from Explore Chords (workflow 16 L129–133).
- **Notation is a single preference, read not set.** The symbol is read and
  shown in the home book's `notation` dialect; there is **no dialect picker** on
  this screen. The only per-screen notation control is the §5.6 flip, which is
  per-chord and does **not** change the preference (it is `options.readings`,
  not a write).
- **Accessibility (standing rule).** React Aria Components for every interactive
  part: the chord input (`TextField`), the star (a pressable button carrying
  `aria-pressed`/toggle state and a full accessible name as drawn), *show more*
  (`Button` with `aria-expanded`), the flip (`Button`), *enter a shape* and its
  dialog (`DialogTrigger`/`Modal`, portalled into `.est` via the theme root —
  [[rac-overlays-portal-outside-est-theme-root]]). A **full keyboard path**
  moves through the groups, the shapes within each, and reaches the star on
  every one, plus *show more*, *enter a shape* and the flip. Status is a **word**
  (the difficulty word, *your shape* / *default*), never colour alone. The
  button-row of shapes is a `role="group"`, not a `role="list"` of buttons
  ([[role-list-of-rac-buttons-fails-axe]]). axe at WCAG 2.1 AA on the built
  screen.
- **No account, no book.** The explorer reads the music core and the user's own
  home book only — no shared book, no membership. It renders offline with no
  signal (workflow 16 L164–170). No song text ever reaches a log.
- **Four languages.** All copy in `en`, `pt-BR`, `es-419`, `it`.

## Acceptance criteria

### Behavior delivered

1. **Search's chord row opens the explorer.** Pressing *Explore A on your
   instrument* on the search screen opens the explorer carrying the symbol
   (workflow 16 L22–27, board L182); the chord input and the search box hold the
   same symbol; *Back to search* returns to search with it still typed, songs
   and all. On the computer, the explorer sits beside the results (board
   L173–244).
2. **Ranked, grouped by position.** The shapes `searchFingerings` returns for
   that chord on the in-use instrument, **shown in the order and groups the core
   produced** — easiest first, *Open* then up the neck, empty positions skipped
   (workflow 16 L38–63). Each group shows its easiest **six** with *Show N more*
   revealing the rest; the cap is display-only (L67). Each shape is a
   `ChordDiagram` with its fret shorthand, its **difficulty word**
   (*easy/medium/hard*, never the number, never colour alone), and a star; the
   diagram's accessible name is `describeFingering` (L67–72).
3. **Starring as *your shape*.** The star on a shape toggles *your shape* for
   that chord on the in-use instrument and tuning: starring sends `SAVE_SHAPE`,
   unstarring `REMOVE_SHAPE`; the Worker writes/tombstones one leaf in
   `shapes.json` through `home-book.set` (canonical, auto-committed, no push),
   matched by chord not spelling. A starred shape draws `kind="yours"` (chord
   colour, labelled *your shape*); its button is pressed. It is **never written
   into a song**. Offline, it writes locally and syncs later (workflow 16
   L108–133, L164–170). The my-shapes review in
   `app/src/instruments/MyShapes.jsx` reads it back.
4. **Viewing by notation — the §5.6 flip.** The symbol is read and shown in the
   home-book `notation` dialect; on one of the four ambiguous spellings (`C7+`,
   bare `C9`, bare `B°`, `C7(4)`) the screen shows **the reading it took and a
   flip to the other**, and flipping re-runs the search on the new reading
   without changing the preference (workflow 16 L75–106, board L126–129). A
   symbol that is not one of the four shows no flip (board L207).
5. **Enter a shape by hand.** *Enter a shape* at the top of the results opens a
   by-hand dialog: tapping a string at a fret places a finger, tapping again
   lifts it, tapping above the nut mutes/opens; per-string notes are shown with
   any foreign to the chord marked by a word; a half-finished or unusual shape
   is drawn as entered and not rejected, an unplayable one says so without
   blocking; what it produces can be starred (workflow 16 L136–146). Built as a
   shared dialog `songs.arrange` will reuse.
6. **Edge cases.** No playable fingering → the empty state *"No shape fits the
   rules"* naming the reason and pointing at the voicing rules (the chip /
   workflow 15), never silently relaxing them (board L95–101, workflow 16
   L173–179). An unparseable symbol → says it is not a chord it can read and
   keeps the last good results dimmed rather than emptying; *back* still works
   (L189–191). A changed instrument from the chip re-derives the shapes
   (L30–36). The whole screen works offline (L164–170).

### Tests the task lands with, by level

- **unit — `app/src/music/fingering-groups.test.js`** (Vitest, no DOM). The
  framework-free list helper that wraps `searchFingerings`: that the groups come
  out **ranked easiest-first and grouped by position** with the correct labels
  (*Open*, *Fret 1*, *Fret 3*, …, empties skipped), the **six-per-group display
  cap** and the *show more* count (display-only — the group still holds every
  shape), and the **starred-match** flag (a stored `shapes.json` leaf marks its
  shape, matched by chord not spelling). *Pins:* the `.tji` unit clause "ranking
  and grouping by position"; workflow 16 L38–67; home-book §4.4. (Ranking/
  grouping/position/difficulty are the carried core's own already-tested logic —
  `core/search.js`, `core/score.js`; this unit pins the explorer's view-model
  over them, not a reimplementation.)
- **unit — `app/src/core/notation/notation.test.js`** (extended). The **fourth
  §5.6 ambiguity**: `C7(4)` on a major triad reports a `sevenFour` ambiguity
  (chosen = sus4 in `brazilian`, add4 in `american`/`realbook`), `options.readings`
  flips it, and `Cm7(4)` reports **no** ambiguity (added fourth in every
  dialect). *Pins:* cifra.md §5.6 L248, L261–265; workflow 16 L99–102.
- **behavior — `app/src/music/ChordExplorer.behavior.test.jsx`** (React Testing
  Library + real React Aria + i18n + a REAL Worker over `fake-indexeddb` and a
  local git remote, as `music.instruments` wired it). The explorer rendered for
  a chord on an instrument: the ranked groups with difficulty words and
  accessible names; a **full keyboard path** through the groups and shapes
  reaching the star on every one (and *show more*, *enter a shape*, the flip);
  **starring** a shape and reading the home book back (then unstarring);
  switching the chord in the input re-derives; the §5.6 flip re-runs the search;
  the empty and unparseable states; **axe clean** (WCAG 2.1 AA). *Pins:* the
  `.tji` behavior clause "the explorer with Testing Library and axe, a keyboard
  path through fingerings, starring"; workflow 16 L38–161; DIRECTION §3.2, §3.7.
- **behavior — `app/src/music/EnterShape.behavior.test.jsx`** (same stack). The
  by-hand dialog: placing/lifting/muting a string, the per-string note read-out
  with foreign notes marked by a word, an unplayable shape reported without
  blocking, and the result starred; axe clean. *Pins:* workflow 16 L136–146.
- **e2e-web — `e2e/web/tests/explorer.spec.js`** (Playwright,
  `import { test, expect } from '../lib/axe.js'`, all three viewports). Search's
  chord row opens the explorer (workflow 16 L22–27); a shape **starred as my
  shape** (and seen in the instrument's my-shapes review); the explorer **used
  offline too** (via `e2e/web/lib/offline.js`: online → `serviceWorker.ready` →
  offline → explore and star → results render and the star persists); **axe on
  the screen** on every viewport. *Pins:* the `.tji` e2e-web clause "search's
  chord row opens it, a shape starred as my shape, used offline too; axe";
  workflow 16 L164–170; workflow 8 (offline).

All named tests land in this task and run (not skipped) in `scripts/gate`.

### Deferred work / graph notes

- **No deferred WBS leaf.** Workflow 16's out-of-scope items are already placed:
  left-handed / horizontal-neck diagram toggles are a parked product judgment
  (workflow 16 L194–201 — surfaced to the parking lot, not a WBS task), and the
  cross-chord *browse all my shapes* surface was reassigned to and **built by**
  `music.instruments` (`MyShapes.jsx`). *Enter a shape* is **in scope here**
  (design.explorer decided it in the explorer; it is in every board viewport),
  not deferred.
- **Graph note (closer):** `music.explorer`'s e2e "search's chord row opens it"
  depends on `songs.search`, which is Done but is **not** an explicit `depends`
  edge in `tasks/55-music.tji`. The work is unblocked (search is complete), but
  the closer may add `depends songs.search` to the `music.explorer` block for an
  honest graph; flagged here rather than edited (this refinement does not touch
  `.tji`).
- **Downstream consumers (not this task):** `songs.arrange` reuses
  `app/src/music/FingeringGroups.jsx` and `EnterShape.jsx`; `music.fallback`
  consumes a starred *your shape* as a reading-view fallback source. Both are
  already WBS leaves.

## Decisions

- **New directory `app/src/music/` for the explorer and the shared list.**
  *Chosen* over placing the explorer under its own `app/src/explorer/` or
  folding it into `app/src/instruments/`. The WBS area is `music`, and the
  ranked-and-grouped component is explicitly shared with the in-song picker
  (`songs.arrange`, a different area) — a neutral `music/` home keeps the shared
  seam from living under one consumer's directory. The explorer screen, the
  shared `FingeringGroups`, its framework-free helper, and `EnterShape` all sit
  here; `instrument-helpers.js` stays in `app/src/instruments/` and is imported.
- **The shared list is one component; ranking/grouping stay in the core.**
  *Chosen:* `FingeringGroups.jsx` renders the `groups` that `searchFingerings`
  already returns and takes a per-shape action slot (the star here, the
  variation choice in the picker). The pure part — group labels, the six-cap,
  the starred-match — is `fingering-groups.js`, unit-tested without React.
  *Rejected:* re-deriving order or position in the view, which would let
  *explore a chord* and *choose a shape in a song* drift (design.explorer's
  whole reason for one component) and duplicate tested core logic (DIRECTION §5:
  the core is carried as is).
- **The star writes the shape value, keyed by matched chord; unstar reuses
  `REMOVE_SHAPE`.** *Chosen:* one new `SAVE_SHAPE` command mirroring the shipped
  `REMOVE_SHAPE`, writing `shapes.json[id][tuning][chord] = { value: shorthand,
  at }` through `home-book.set`. *Rejected:* storing a rendered diagram
  (workflow 16 L116–118 — the diagram is recomputed so a starred shape never
  drifts when the rules change) and keying by spelling (home-book §4.4 — must
  match a song that writes a different spelling of the same chord).
- **Add the fourth §5.6 ambiguity to the carried parser; no spec change.** The
  carried `notation/parse.js` reports three of §5.6's four ambiguities
  (`sevenPlus`, `bareNine`, `degreeSign`); `C7(4)` (sus4/add4 on a major triad)
  is parsed to sus4 with **no** ambiguity reported. Workflow 16 requires the
  flip on **all four**. *Chosen:* add a `sevenFour` reading to `DIALECTS` and
  `READING_LABELS` and its detection to `parse.js` (reported only on a major
  triad; `Cm7(4)` stays unambiguous), with a unit test. This is **conformance to
  an already-specified chapter** (cifra.md §5.6), not a format change — so **no**
  spec/reference/corpus delta, and no design delta. The app's chord parser and
  cifra.md-for-JavaScript remain separate implementations, each held to §5.6
  independently (the standing "agree because checked, not shared" rule); this
  task touches only the app's. *Rejected:* deferring the fourth flip (it would
  ship a screen that silently disagrees with the workflow and the spec on a
  stated behavior) and routing the explorer's bare-symbol input through
  cifra.md-for-JavaScript (the explorer's input is a lone chord, not a song; the
  app music core is the parser already in hand, per DIRECTION §5).
- **No URL route; the explorer is an in-memory surface.** *Chosen:* follow the
  shell's established in-memory `useState` navigation (no router, each surface
  owns its `.appbar`), opening the explorer from the chord row with the symbol
  as state and *back* restoring search. *Rejected:* introducing routing for one
  screen — a shell-wide change outside this task and against shell.layout's
  decision.
- **Difficulty as the carried bucket word.** *Chosen:* `difficultyBucket` /
  `DIFFICULTY_LABELS` as carried (easy/medium/hard), a word adjacent to each
  shape. *Rejected:* showing the score number (workflow 16 L50–54: noise to
  someone choosing a shape) or colour-coding alone (standing a11y rule).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- Created `app/src/music/` (new directory): `ChordExplorer.jsx` (the explorer screen), `FingeringGroups.jsx` (shared ranked-grouped component), `fingering-groups.js` (framework-free helper: group labels, six-per-group cap, starred-match), `EnterShape.jsx` (by-hand shape entry dialog), `icons.jsx`, `music.css`.
- Extended `app/src/core/notation/dialects.js` and `parse.js` with the fourth §5.6 ambiguity `sevenFour` (`C7(4)` on a major triad — sus4 in `brazilian`, add4 in `american`/`realbook`; `Cm7(4)` remains unambiguous).
- Added `SAVE_SHAPE` command to `app/src/worker/protocol.js` and `logic.js`, mirroring the existing `REMOVE_SHAPE`; writes `shapes.json[id][tuning][chord]` through `home-book.set` (canonical, auto-committed, no push).
- Wired search's chord-row → explorer in `app/src/shell/AppShell.jsx` and `app/src/songs/SearchScreen.jsx`; lifted the chord query so *Back to search* restores it with songs intact.
- Added explorer copy and `readings.sevenFour` flip labels to all four locales: `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Added e2e journey at `e2e/web/tests/explorer.spec.js` (chord row opens explorer, star as my shape, offline explore+star+persist, axe; all three viewports).
- Fixed a flaky timing assertion in `app/src/worker/recents.behavior.test.js` (front-of-list check moved inside the `until()` guard).
- Tests landed: unit (`app/src/music/fingering-groups.test.js`; `app/src/core/notation/notation.test.js` extended); behavior (`app/src/music/ChordExplorer.behavior.test.jsx`, `app/src/music/EnterShape.behavior.test.jsx`); e2e-web (`e2e/web/tests/explorer.spec.js`, all three viewports).
