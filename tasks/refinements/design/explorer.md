# Refinement — `design.explorer`

## TaskJuggler

- Task: `design.explorer` — "Workflow 16: the chord explorer".
- Defined in [`tasks/20-design.tji`](../../20-design.tji) (lines 14–18).
- `note`: *"What 'Explore A on your guitar' opens: fingerings ranked and
  grouped by position, viewing by notation, starring a shape as my shape.
  Workflow 2. Tests: none — design deliverable (the workflow document and its
  board)."*

## Effort estimate

2d (unchanged from the `.tji`). This is a design task: the deliverable is a
workflow document and a mockup board, not code. The budget covers writing
`docs/workflows/16-chord-explorer.md` to the shape of the existing fourteen
(screens and edge cases decided), drawing the `W16` board on two phones, a
tablet and a computer and registering it in `canvas.json`, and the DIRECTION
§6/§7 deltas that close the gap.

## Repository

**estante-de-cifras.** The deliverable is a design document, a mockup board
and governing-document deltas, all in this repository:

- `docs/workflows/16-chord-explorer.md` — the new workflow document.
- `docs/mockups/W16-chord-explorer.dc.html` — the board, registered in
  `docs/mockups/canvas.json` (`boards` entry + `order` array).
- `docs/DIRECTION.md` — §6 (retire the open bullet) and §7 (list workflow 16).

No `cifra.md:` work. The explorer is an app screen (DIRECTION §3.7); the only
place it touches the format is reading a typed chord symbol under the user's
notation dialect (cifra.md §5.6), which is already specified. Nothing in
`/home/ruoso/devel/cifra.md` changes.

## Inherited dependencies

The `design` parent task `depends bootstrap.workflows`
([`tasks/20-design.tji`](../../20-design.tji) line 7). `explorer` carries no
further `depends` of its own in the `.tji`.

- **Settled.** `bootstrap.workflows` — the fourteen workflows are decided
  (DIRECTION §7, [`docs/DIRECTION.md`](../../docs/DIRECTION.md) lines 513–537).
  Workflow 2 already fixes the explorer's *entry* (a search result) and its
  *shape model* (where a chord's shape comes from, *my shapes*); this task
  decides what the explorer screen *shows*.
- **Settled (sibling, already landed).** `design.home_book_format`
  ([`tasks/refinements/design/home_book_format.md`](home_book_format.md),
  complete) fixes where a starred shape is stored:
  [`docs/home-book-format.md`](../../../docs/home-book-format.md)'s
  `shapes.json`, keyed by instrument + tuning + chord, merged key by key, the
  later change winning. Starring writes there; this task does not re-decide
  the storage format.
- **Not a dependency (deliberately decoupled).** `design.instruments`
  (workflow 15, a sibling design gap, [`tasks/20-design.tji`](../../20-design.tji)
  lines 9–13) decides the instrument, tuning and voicing-rule model. The
  explorer *reads* the instrument in use and its voicing rules as the search's
  configuration, but it does not design them; it treats a rule set as opaque
  input to the fingering search. So this task does **not** wait on
  `design.instruments`; see Decisions.

The downstream consumer that cites this refinement is the build task
`music.explorer` (3d, [`tasks/55-music.tji`](../../55-music.tji) lines 15–20),
which `depends design.explorer` and builds workflow 16 in code. Its tests
(below) depend on this document being concrete.

## What this task is

Decide, as a workflow document in the shape of the other fourteen, **what the
chord explorer shows and how it behaves**. Workflow 2 already makes it a search
result — when the typed text parses as a chord, the first result is *explore
Cmaj7 on your instrument* ([`docs/workflows/02-find-and-play.md`](../../../docs/workflows/02-find-and-play.md)
lines 27–42). This task decides the screen that result opens: the chord input
it carries, how the fingerings for that chord on the instrument in use are
**ranked** (easiest first) and **grouped by position**, how each shape is drawn
and labelled, how the chord is **read and shown in the user's notation**
(including the §5.6 ambiguities), how a shape is **starred as *my shape***
(written to the home book, never into a song), the **empty and edge states**,
and how all of it works **offline**. It is the standalone counterpart of the
in-song voicing picker (workflow 5), and the two share one ranked-and-grouped
presentation so they cannot drift.

The chord explorer is the feature Explore Chords was built around
(DIRECTION §1, §5); the music core, fingering search, scoring and diagram
rendering come over as is (DIRECTION §5). This task does not redesign that
engine — it decides the Estante screen that drives it, reconciling Explore
Chords' instrument-first UI with Estante's search-first, book-centred one.

## Why it needs to be done

DIRECTION §6 lists the explorer's screen as an open gap: *"The chord
explorer's screen: workflow 2 makes it a search result, not what it shows —
fingerings ranked and grouped by position, starring a shape as my shape"*
([`docs/DIRECTION.md`](../../docs/DIRECTION.md) lines 504–506). Until it is
decided and drawn, the downstream work cannot land:

- `music.explorer` ([`tasks/55-music.tji`](../../55-music.tji) lines 15–20)
  `depends design.explorer` and builds workflow 16: *"search's chord row opens
  it; fingerings ranked, grouped by position; starring a shape as my shape."*
  Its tests — unit (*ranking and grouping by position*), behavior (*the
  explorer with Testing Library and axe, a keyboard path through fingerings,
  starring*), e2e-web (*search's chord row opens it, a shape starred as my
  shape, used offline too; axe*) — need the decided screen, empty states and
  interaction model to pin.
- `songs.reading` ([`tasks/60-songs.tji`](../../60-songs.tji) line 18) and
  `songs.search` (line 12) cross-reference the explorer as the chord-row
  result and must agree with it.
- `music.explorer` reaches milestone **M2** ("A songbook on one device",
  [`tasks/99-milestones.tji`](../../99-milestones.tji) lines 23–27), which
  names *the explorer* among what M2 delivers.

## Inputs / context

Governing documents (the `.tji` note names Workflow 2; the fuller set below is
what it and DIRECTION settle):

- **Workflow 2 §The chord explorer is a result** —
  [`docs/workflows/02-find-and-play.md`](../../../docs/workflows/02-find-and-play.md)
  lines 27–42. The entry point: a typed chord symbol makes the first result
  *explore Cmaj7 on your instrument*; a short query can be both a chord and a
  word (`A` → the explorer row *and* songs); **ambiguous symbols (cifra.md
  §5.6) are read in the user's notation, with the explorer showing the
  ambiguity as Explore Chords does** (lines 39–40). The normative statement
  of how the explorer reads a symbol.
- **Workflow 2 §Where a chord's shape comes from** — lines 88–109. The
  fallback order (song's choice → *my shape* → app's default) and the rule
  that **my shapes match by chord, not by spelling** (a shape saved as `Cmaj7`
  serves a song that writes `C7M`), are **applied when a song is shown and
  never written into it** — writing them in is an explicit act (workflow 5).
  The explorer is where a *my shape* is set; this fixes its semantics.
- **Workflow 5 §Choosing a shape** —
  [`docs/workflows/05-arrange-for-an-instrument.md`](../../../docs/workflows/05-arrange-for-an-instrument.md)
  lines 42–50. The in-song picker: *"the shapes the search finds for that
  chord on this instrument, ranked easiest first and grouped by position, with
  enter a shape at the top (its DESIGN §2.11)."* Same presentation the explorer
  uses — the shared-component decision below.
- **Workflow 1 §The instrument** —
  [`docs/workflows/01-first-run.md`](../../../docs/workflows/01-first-run.md)
  lines 60–71. The instrument in use defaults to a standard guitar, shown as a
  **chip in the header**, changed from there; a preference in the home book.
  The explorer shows fingerings for that instrument.
- **DIRECTION §3.2 Personal state** — [`docs/DIRECTION.md`](../../docs/DIRECTION.md)
  lines 136–150. *My shapes* — *"how the user plays a chord on an instrument,
  used wherever a song has chosen none (workflow 2)"* — live in the home book,
  committed automatically (no explicit save for preferences).
- **DIRECTION §3.7 The app** — lines 394–427. React with React Aria Components;
  the Worker owns the data and the search index, the main thread never touches
  IndexedDB; the music core and cifra.md-for-JS know nothing of React (the view
  is the only layer that does); the chord diagram is the app's own drawing.
- **DIRECTION §4 The interface** — lines 428–450. Song search is the primary
  interface; the explorer is reached *through* it, not a peer tab.
- **DIRECTION §5 What comes over from Explore Chords** — lines 452–495. The
  music core and rendering (pitch, chords, notation dialects, fingering search,
  finger assignment, scoring, heuristics, diagrams) carry over as is, pure and
  storage-free; the UI is rewritten in React with Explore Chords' as the guide
  to what each component must do (*chord input, results, shape … dialogs*).
- **DIRECTION §6** — lines 504–506. The open-decision bullet this task retires.
- **DIRECTION §7** — lines 513–537. The workflow list this task extends with
  item 16.
- **cifra.md §5.6 Notation dialects and the four ambiguities** —
  [`/home/ruoso/devel/cifra.md/spec/5-chord-symbols.md`](/home/ruoso/devel/cifra.md/spec/5-chord-symbols.md)
  lines 237–284. Three dialects (`brazilian` default, `american`, `realbook`);
  they differ only for four spellings (`C7+`, bare `C9`, bare `B°`, `C7(4)`);
  a reader *"MUST report"* which reading it took *"so that an application can
  show which reading was taken and offer the other."* This is exactly what the
  explorer's ambiguity flip does.
- **cifra.md §7 Voicings** —
  [`/home/ruoso/devel/cifra.md/spec/7-voicings.md`](/home/ruoso/devel/cifra.md/spec/7-voicings.md)
  lines 1–30. A shape is `x35543` for a named tuning; a shape is meaningless
  without its tuning. The explorer's starred shape is a fret string for the
  instrument's tuning.
- **The home book's storage** — [`docs/home-book-format.md`](../../../docs/home-book-format.md)
  `shapes.json` (`design.home_book_format`, complete): *my shapes* keyed by
  instrument + tuning + chord, the registered-value envelope, merged key by key.
  Starring writes one key here.
- **The Explore Chords explorer, as the guide** (the sibling checkout
  `/home/ruoso/devel/explore-chords`, source carried over per DIRECTION §5):
  - `docs/DESIGN.md` §2.3 *"a tool, not a dashboard"* — the explorer is chord
    input + display toggles + ranked results, nothing else.
  - `docs/DESIGN.md` §2.4 result view and `src/core/search.js`
    `positionOf` (lines 142–148): **a position is** open position (every
    fretted note within the first four frets *and* at least one open string) or
    else the **lowest fretted fret** — explicitly *not* CAGED roman numerals,
    which assume a standard-tuned guitar. Groups are Open, Fret 1, Fret 3,
    Fret 5…, empties skipped.
  - `src/core/score.js` `scoreFingering` and `src/core/heuristics.js`
    `DEFAULT_WEIGHTS`: ranking is a weighted difficulty sum, sorted ascending,
    ties broken by position; the badge is a **bucketed word** (easy / medium /
    hard), not a number.
  - `src/ui/fingering-groups.js` `renderFingeringGroups`: the grouped-and-
    ranked list is **one component shared by the explorer and the song voicing
    picker**, with a per-group `displayCount` (6 by default) and *show more*.
  - `src/state/store.js` `toggleFavorite` + `src/state/persist.js`
    `favoriteKey = instrumentId|chordText|frets`: a favourite stores the fret
    pattern, not a rendered snapshot, and the shape is recomputed on load so it
    never drifts when the rules change.
  - `src/core/notation/dialects.js`: the three dialects and the per-chord
    *reading* flip chip (the reading taken + the alternative); the dialect
    itself is a single preference, not an explorer toggle.
- **Sibling design refinement for register and ritual** —
  [`tasks/refinements/design/home_book_format.md`](home_book_format.md) (the
  only landed `design` refinement) and the design-task convention in
  [`tasks/refinements/README.md`](../README.md) lines 38–45 (a workflow
  document + a board; DIRECTION §6/§7 updated).
- **Mockup conventions** — [`docs/mockups/GUIDE.md`](../../../docs/mockups/GUIDE.md)
  (how a board is drawn: two phones, a tablet, a computer; templating; icons),
  [`docs/mockups/README.md`](../../../docs/mockups/README.md) ("Decisions the
  drawings carry"), [`docs/mockups/theme.css`](../../../docs/mockups/theme.css)
  (the three themes and the status-word rule),
  [`docs/mockups/ChordBox.dc.html`](../../../docs/mockups/ChordBox.dc.html)
  (the diagram component: song shape in ink, *my shape* in the chord colour,
  default hollow; start fret right-aligned), and
  [`docs/mockups/W02-find-and-play.dc.html`](../../../docs/mockups/W02-find-and-play.dc.html)
  (the board the explorer is reached from; its first phone result row is
  *Explore A on your guitar*).

## Constraints / requirements

- **Workflow 2 is normative; this task fills the gap, it does not redesign.**
  The entry (a search result), the dialect reading, the fallback order and the
  *my shapes* rule are settled in workflow 2 and reused verbatim. This document
  decides only what the explorer screen shows and how starring behaves.
- **One shared presentation with the song picker.** The ranked-and-grouped
  fingering list in the explorer is the same component workflow 5's picker uses
  (Explore Chords' `fingering-groups.js`), so ranking, grouping and order can
  never diverge between "explore a chord" and "choose a shape in a song." The
  explorer adds the star control and the editable chord input around it; the
  picker adds *every Cm / only here*.
- **Starring writes *my shape* to the home book, never into a song.** A starred
  shape is a key in `shapes.json` (instrument + tuning + chord → frets),
  matched by chord not by spelling (workflow 2 lines 103–108). It is applied
  when a song is shown and never written into the song text; the only path into
  a song is the explicit act in workflow 5. Starring is a preference change, so
  it commits automatically to the home book — no explicit save (DIRECTION §3.2).
- **Offline first.** The explorer runs entirely on the device — the fingering
  search, the diagrams and starring need no network (workflow 2 §Offline,
  lines 152–155). Starring offline writes the home book locally and syncs when
  there is a network (workflow 8); nothing waits.
- **The Worker owns the data; the view is the only React layer.** The fingering
  search, scoring and diagram model are the framework-free music core
  (DIRECTION §3.7, §5); the explorer screen is a React/React Aria view reading
  the instrument in use and *my shapes* through the store the Worker feeds. The
  main thread never touches IndexedDB; starring is a message to the Worker.
- **Accessibility (standing rule).** Every interactive part uses React Aria
  Components; a full keyboard path through the groups and the fingerings and
  the star; each diagram has an accessible name (`describeFingering`); the
  difficulty is carried by a **word** (easy / medium / hard), never colour
  alone, and the starred/your-shape/default state by the diagram's word label
  (*your shape* / *default*) and its ink/chord-colour/hollow drawing, not colour
  alone. axe at WCAG 2.1 AA on the drawn screens (the board shows the states;
  `music.explorer`'s behavior/e2e tests run axe).
- **No song text in logs; fixtures use songs written for the purpose.** The
  board draws no copyrighted words; it reuses the invented cast (guitar
  `E2 A2 D3 G3 B3 E4`, cavaquinho, ukulele, the *Tarde Clara* / *Choros da
  Ana* songs) per `docs/mockups/GUIDE.md`.
- **No book without an account does not apply here** — the explorer reads the
  music core and the home book (the user's own), not a shared book; it needs no
  membership. (Noted so the rule is not mis-scoped onto it.)
- **No new runtime dependency and no new architectural seam.** The engine is
  the carried-over music core; the screen is React/React Aria already chosen
  (DIRECTION §3.7). This task introduces neither, so no DIRECTION §3.x delta —
  only the §6/§7 edits that close the documented gap.

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` `Tests:` clause is
*"none — design deliverable (the workflow document and its board)"*).
Acceptance is what the workflow document decides, what the board shows, and the
DIRECTION deltas. The document and board must be concrete enough that
`music.explorer`'s named tests (below) are writable against them.

**1. `docs/workflows/16-chord-explorer.md` exists**, in the shape of the other
fourteen (a `Status: decided` line, screens, edge cases, offline, *later*
notes), and decides:

- **Entry and the chord input.** The explorer opens from search's chord row
  (*Explore A on your instrument*, workflow 2 lines 27–42) and carries an
  **editable chord input** (Explore Chords' chord-input, two-way synced) so the
  chord can be changed without going back to search; a *back* path returns to
  search. The instrument in use is shown (the header chip, workflow 1) and
  switching it re-derives the results. Pins workflow 2, workflow 1.
- **Ranked, grouped by position.** Fingerings for the chord on the instrument
  in use, **ranked easiest first** by the music core's difficulty score and
  **grouped by position**, where a *position* is open position (all fretted
  within the first four frets and at least one open string) or else the lowest
  fretted fret — Open, Fret 1, Fret 3, Fret 5…, empties skipped (not CAGED).
  Each group shows a default count (6) with **show more**; each card draws the
  diagram (ChordBox) with its shorthand and a **difficulty word** (easy /
  medium / hard). States that this is the same presentation as workflow 5's
  picker. Pins the `music.explorer` unit test *ranking and grouping by
  position*.
- **Viewing by notation.** The typed symbol is read and shown in the user's
  notation dialect (the home book's `notation` preference; `brazilian` by
  default). Where the symbol is one of the four §5.6 ambiguities (`C7+`, bare
  `C9`, bare `B°`, `C7(4)`), the explorer shows **which reading it took and
  offers the other** (a flip control); flipping re-runs the search. No separate
  dialect picker lives in the explorer — the dialect is a single preference.
  Pins cifra.md §5.6, workflow 2 lines 39–40.
- **Starring a shape as *my shape*.** A **star / unstar control on every result
  card** writes that fret pattern as *my shape* for this chord on this
  instrument and tuning, into the home book's `shapes.json`, matched by chord
  not spelling; the starred shape is drawn as *your shape* (the chord colour,
  per `ChordBox`), and shown so in the song reading/fallback (workflow 2). It
  is **never written into a song**. Also decides whether *enter a shape* (the
  by-hand dialog, Explore Chords §2.11, reused from the shared picker) is
  offered in the explorer so a shape the search did not surface can be entered
  and starred — **decided: yes**, since it is the same shared affordance and a
  natural way to record "how I actually play it." Pins the `music.explorer`
  behavior test *starring* and e2e-web *a shape starred as my shape*.
- **Empty and edge states, decided definitively** (the successor tasks cite
  these rather than guess):
  - **No playable fingering** under the instrument's voicing rules: an empty
    state that names the reason and **points at the voicing rules**; the search
    **never silently relaxes the rules** (Explore Chords' rule). A path to the
    rules (workflow 15 / the instrument chip) is offered.
  - **A query that is both a chord and a word** (`A`): the explorer screen is
    about the chord only; getting back to the song results is the *back* path
    to search (workflow 2 keeps both kinds of result on the search screen).
  - **An ambiguous symbol** before the user has flipped: the default reading is
    shown with the flip offered (above).
  - **A very large result set**: capped per group for display with *show more*;
    the cap is display-only.
- **Scroll / navigation UX, decided definitively:** per-group list scrolls (a
  horizontally-scrollable row on a phone, a wrapped grid on a tablet/computer);
  groups stack vertically top-to-bottom, easiest position first; the chord
  input and instrument chip stay reachable while scrolling results. A keyboard
  path moves through groups and fingerings and reaches the star on each.
- **Offline.** The whole screen — search, diagrams, starring — runs on the
  device; starring offline writes the home book locally and syncs later
  (workflow 2 §Offline, workflow 8). Pins the e2e-web *used offline too*.
- **Out of scope, stated:** left-handed and horizontal-neck diagram display
  options (Explore Chords display toggles) are **not** part of this screen —
  no Estante workflow or mockup carries them and the app diagram is the vertical
  `ChordBox`; a dedicated *browse all my shapes* management surface is likewise
  not here (the explorer stars and unstars per chord). See Open questions /
  return summary — surfaced for the parking lot, not encoded as a WBS task.

**2. `docs/mockups/W16-chord-explorer.dc.html` exists and is registered**, to
`docs/mockups/GUIDE.md` (the `.dc.html` structure, `support.js`+`theme.css`,
the `.board-head`, three `.dev-col`s = **two phones, a tablet, a computer**),
drawing the states the document decides, with the invented cast and no
copyrighted words. It must show:

- the explorer for a chord on guitar (e.g. `A`): the editable chord input, the
  instrument chip, groups **Open / Fret N** each a ranked row of `ChordBox`
  diagrams with a **difficulty word** and a **star** control, and *show more*
  on a group;
- a **starred** shape drawn as *your shape* (chord colour) beside unstarred
  ones (`inherit="yes"`, `kind="yours"` / `kind="default"`), so the status is a
  word + drawing, never colour alone;
- the **notation ambiguity flip** on an ambiguous symbol (e.g. `C7+` → *read as
  C7M · read as C7♯5 instead?*);
- the **empty state** for a chord the instrument cannot voice, pointing at the
  rules;
- continuity with `W02` (reached from its *Explore A on your guitar* row).

Registered in `canvas.json`: a `boards["W16-chord-explorer.dc.html"]` entry
(`w` 3208, `h` 1500, `x` 0, the next `y` on the 1620 stride after the last
board) and appended to `order`. (The ChordBox and Main boards are not touched.)

**3. Governing-document deltas (same commit, closer's):**

- `docs/DIRECTION.md` §6: the chord-explorer bullet (lines 504–506) retired —
  marked decided and pointed at `docs/workflows/16-chord-explorer.md`.
- `docs/DIRECTION.md` §7: workflow **16** added to the list (*"The chord
  explorer — fingerings ranked and grouped by position, viewing by notation,
  starring a shape as my shape"*), with the intro's *"all fourteen"* language
  softened to admit the design-gap workflows (§6) as each is drawn. (Workflow
  15 is still a gap; a hole at 15 until `design.instruments` lands is expected.)

**4. No code tests, and none deferred.** The `.tji` `Tests:` clause is honoured
by the design deliverable. The tests for the explorer **as built** land in
`music.explorer` (they are not this task's and are not deferred from it): unit
(*ranking and grouping by position*), behavior (*the explorer with Testing
Library and axe, a keyboard path through fingerings, starring*), e2e-web
(*search's chord row opens it, a shape starred as my shape, used offline too;
axe*) — [`tasks/55-music.tji`](../../55-music.tji) line 19. This document must
be concrete enough that each is writable; naming them here is the handshake,
not a deferral.

**5. No deferred WBS follow-up.** A design task with no code seam to build
later; nothing is registered. The two out-of-scope items (display-option
carry-over, a *my shapes* management surface) are surfaced for human review
(return summary → parking lot), not encoded as tasks — they are product
judgments, and the second may already belong to `design.instruments`.

## Decisions

### A workflow document and a board, per the design-area convention

Unlike its sibling `design.home_book_format` (which deviated to a format
document because the home book is invisible), the explorer is a **screen the
user sees and operates**, and its `.tji` note is the standard *"the workflow
document and its board."* **Chosen:** `docs/workflows/16-chord-explorer.md`
plus `docs/mockups/W16-chord-explorer.dc.html`, numbered 16 to match the task
title and the DIRECTION §6→§7 slot. **Rejected:** folding it into workflow 2
(DIRECTION §6 explicitly carves it out as its own gap — *"workflow 2 makes it a
search result, not what it shows"*).

### One shared ranked-and-grouped component for the explorer and the picker

Workflow 5's picker and the explorer both show *"the shapes the search finds …
ranked easiest first and grouped by position"* (workflow 5 lines 48–50). In
Explore Chords this is a single component (`fingering-groups.js`) used by both.
**Chosen:** keep it one component in Estante too, so ranking, grouping and order
cannot drift between "explore a chord" and "choose a shape in a song"; the
explorer wraps it with the editable chord input and the star, the picker wraps
it with *every Cm / only here*. **Rejected:** two independent renderings — they
would be a correctness hazard (a fingering ranked differently in two places is a
bug a user would notice) for no benefit. This is an app-internal reuse already
precedented in Explore Chords and workflow 5, so it needs no design delta; it is
recorded here as the seam `music.explorer` must build and `songs.arrange` reuse.

### Position means open-or-lowest-fretted-fret, not CAGED

**Chosen:** carry Explore Chords' `positionOf` definition — open position (all
fretted within the first four frets with at least one open string) or else the
lowest fretted fret, grouped Open / Fret N. **Rejected:** CAGED roman numerals,
which assume a standard-tuned six-string guitar and are meaningless for the
cavaquinho, the ukulele, drop-D or any other tuning the app supports (cifra.md
§6). The music core already computes it this way; re-deciding it would
contradict the carried-over engine and workflow 5's picker.

### Difficulty as a word, starred state as a word-plus-drawing

**Chosen:** the difficulty badge is a bucketed **word** (easy / medium / hard),
and a shape's provenance is drawn as the `ChordBox` decision encodes it (song
shape in ink, *your shape* in the chord colour with the label *your shape*,
default hollow with the label *default*) plus the star's pressed state.
**Rejected:** a numeric score (noise to a player choosing a shape) or
colour-only status (fails the standing accessibility rule and WCAG). This keeps
status carried by a word, never colour alone, as every UI task must.

### Starring writes *my shape* to the home book, never into a song

Workflow 2 fixes this: *my shapes* are applied when a song is shown and never
written in; the only path into a song is the explicit act in workflow 5.
**Chosen:** the explorer's star writes one key to `shapes.json` (instrument +
tuning + chord → frets), matched by chord not spelling, committed automatically
to the home book; it changes what unchosen chords fall back to, not any song's
text. **Rejected:** writing a starred shape into the open song (Explore Chords
did a limited version of this, DIRECTION §5 and workflow 2 line 106 call it
out as wrong for a shared book — *"that would put one person's habits into
everyone's song at their next save"*).

### Viewing by notation is reading + the §5.6 flip, not a dialect picker

**Chosen:** the explorer reads and shows the chord in the user's notation
preference and, for the four §5.6 ambiguities, shows the reading it took and
offers the other (re-running the search on a flip) — matching cifra.md §5.6's
*"MUST report … so that an application can show which reading was taken and
offer the other"* and workflow 2's *"showing the ambiguity as Explore Chords
does."* **Rejected:** a dialect selector on the explorer screen — the dialect is
a single home-book preference set once (workflow 1 / `preferences.json`), not a
per-screen control; a per-chord flip is the right granularity for the only place
it matters.

### The explorer reads the instrument model, it does not design it

**Chosen:** treat the instrument in use, its tuning and its voicing rules as the
search's configuration — opaque input the explorer reads from the home book and
the music core — so this task does not depend on `design.instruments`
(workflow 15). **Rejected:** deciding the instrument/voicing-rule model here —
it is a separate, larger gap (workflow 15), and coupling would block a 2d screen
design on it. The explorer's empty state points *at* the rules without owning
them.

### Left-handed / horizontal-neck display options are out of scope

**Chosen:** the explorer draws the app's vertical `ChordBox`; the Explore Chords
display toggles (vertical/horizontal neck, left-handed mirror) are not carried
into this screen, since no Estante workflow or mockup includes them.
**Rejected:** carrying them silently — they are a handedness/display preference
that deserves a deliberate decision (and a home-book preference key) rather than
an undrawn import. Surfaced for the parking lot (return summary), not encoded as
a WBS task, because whether Estante wants them is a product judgment.

## Open questions

(none — all decided.)

Two matters are surfaced for the parking lot (human product judgment), not
blockers and not WBS tasks:

- **Left-handed / horizontal-neck diagram display options** — whether Estante
  carries Explore Chords' display toggles, and if so as a home-book preference.
  The explorer ships with the vertical `ChordBox` only.
- **A *browse / manage all my shapes* surface** — Explore Chords had a "Saved"
  screen; Estante's explorer stars and unstars per chord, but there is no decided
  screen to review or remove *my shapes* across chords. It may belong to
  `design.instruments` (workflow 15, which owns instrument-attached personal
  state); flagged for the orchestrator to place.

## Status

**Done** — 2026-10-05.

- Created `docs/workflows/16-chord-explorer.md`: `Status: decided` — entry & editable chord input, ranked/grouped-by-position display shared with workflow 5's picker, difficulty word, notation reading + §5.6 flip, starring to `shapes.json`, enter-a-shape, empty/edge states, scroll/keyboard UX, offline, out-of-scope noted.
- Created `docs/mockups/W16-chord-explorer.dc.html`: Phone 1 — explorer for `A` on guitar, Open/Fret 5 groups, one starred *your shape*, show-more, enter-a-shape; Phone 2 — empty state (cavaquinho/`C13`) pointing at the voicing rules; Tablet — `C7+` ambiguity flip (*read as C7M · read as C7♯5 instead?*) over a wrapped grid; Computer — W02 continuity (*Explore A on your guitar* row) beside the explorer.
- Edited `docs/mockups/canvas.json`: W16 entry at y=25100, appended to `order`.
- Edited `docs/DIRECTION.md` §6: chord-explorer bullet retired → pointed at `docs/workflows/16-chord-explorer.md`; §7: item 16 added, "all fourteen" softened, the 15 hole noted.
