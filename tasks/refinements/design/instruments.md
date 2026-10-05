# Refinement — `design.instruments`

## TaskJuggler

- Task: `design.instruments` — "Workflow 15: set up an instrument".
- Defined in [`tasks/20-design.tji`](../../20-design.tji) (lines 9–13).
- `note`: *"Tunings, a second instrument, switching, the voicing rules with
  presets and the expert panel. Explore Chords' DESIGN §2.1, 2.5 are the
  guide. DIRECTION §6. Tests: none — design deliverable (the workflow document
  and its board)."*

## Effort estimate

2d (unchanged from the `.tji`). This is a design task: the deliverable is a
workflow document and a mockup board, not code. The budget covers writing
`docs/workflows/15-set-up-an-instrument.md` to the shape of the existing
workflows (screens and edge cases decided), drawing the `W15` board on two
phones, a tablet and a computer and registering it in
[`docs/mockups/canvas.json`](../../../docs/mockups/canvas.json), and the
DIRECTION §6/§7/§3.2 deltas that close the gap. It is the largest of the
design gaps because it carries over the whole per-instrument voicing-rule
model from Explore Chords (DIRECTION §5); the budget is for *deciding and
drawing* that surface, not building it (that is `music.instruments`, 4d).

## Repository

**estante-de-cifras.** The deliverable is a workflow document and a board,
all in this repository:

- [`docs/workflows/15-set-up-an-instrument.md`](../../../docs/workflows/15-set-up-an-instrument.md)
  — the workflow, decided to its screens and edge cases in the shape of the
  existing fourteen.
- [`docs/mockups/W15-set-up-an-instrument.dc.html`](../../../docs/mockups/W15-set-up-an-instrument.dc.html)
  — the board, on two phones, a tablet and a computer
  ([`docs/mockups/GUIDE.md`](../../../docs/mockups/GUIDE.md)), registered in
  [`docs/mockups/canvas.json`](../../../docs/mockups/canvas.json) (a `boards`
  entry + the `order` array).
- [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §6, §7 and §3.2 — the gap
  retired and the workflow added.

**No `cifra.md:` work.** Workflow 15 designs the app's *personal-state* model:
instruments, tunings and voicing rules live in the home book
([`docs/home-book-format.md`](../../../docs/home-book-format.md)), and the
voicing-rule search is the Explore Chords music core (DIRECTION §5), not the
format. The one place it meets cifra.md is the *spelling of a tuning*: workflow
15 adopts cifra.md §6's tuning text as the tuning's identity (so a home-book
shape key and a song's voicing-block heading name the same tuning the same
way), and that chapter is already specified. Nothing in
`/home/ruoso/devel/cifra.md` changes.

## Inherited dependencies

The `design` parent task `depends bootstrap.workflows`
([`tasks/20-design.tji`](../../20-design.tji) line 7). `instruments` carries no
further `depends` of its own in the `.tji`.

- **Settled.** `bootstrap.workflows` — the fourteen workflows are decided
  (DIRECTION §7, [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines
  514–543). Three of them already fix this task's *surface* without defining
  it: workflow 1 establishes the instrument-in-use chip in the header and the
  standard-guitar default ([`docs/workflows/01-first-run.md`](../../../docs/workflows/01-first-run.md)
  lines 60–78); workflow 2 fixes the shape fallback that reads the rules
  ([`docs/workflows/02-find-and-play.md`](../../../docs/workflows/02-find-and-play.md)
  lines 68–108); workflow 5 arranges *into a song* for a tuning that already
  exists ([`docs/workflows/05-arrange-for-an-instrument.md`](../../../docs/workflows/05-arrange-for-an-instrument.md)).
- **Settled (sibling, already landed).** `design.home_book_format`
  ([`home_book_format.md`](home_book_format.md), complete) fixes *where*
  instruments, voicing rules, *my shapes* and per-song variation/transposition
  are stored and that they are treated as **opaque values** whose internal
  schema `design.instruments` owns:
  [`docs/home-book-format.md`](../../../docs/home-book-format.md) §4.3
  (`instruments.json`: per instrument id, a `definition` register and a `rules`
  register that merge independently), §4.4 (`shapes.json`, keyed by instrument
  + tuning + chord), §4.5 (`songs.json`, transposition and variation-in-use per
  tuning), and §1.2 (opaque value — "the music core and `design.instruments`
  own the value"). Workflow 15 defines those opaque values; it does **not**
  re-decide the files, the register envelope, or the merge.
- **Settled (sibling, already landed).** `design.explorer`
  ([`explorer.md`](explorer.md), complete) is the screen that *reads* this
  task's model as the search's configuration and, when no shape fits, points
  the user *at the rules* ([`docs/workflows/16-chord-explorer.md`](../../../docs/workflows/16-chord-explorer.md)
  lines 33–36, 173–179). Its empty state's destination is this workflow. The
  explorer treats a rule set as opaque input; workflow 15 owns its shape.
- **Not a dependency (deliberately decoupled).** Workflow 15 does not wait on
  anything beyond `bootstrap.workflows`; the two siblings above already landed
  reading its model as opaque, exactly so this task could be designed
  independently.

The downstream consumer that cites this refinement is the build task
`music.instruments` (4d, [`tasks/55-music.tji`](../../55-music.tji) lines
9–14), which `depends design.instruments, storage.home_book, shell.layout,
foundation.e2e_web` and builds workflow 15 in code. Its tests (below) depend on
this document and board being concrete. The per-chord reading of these rules is
`music.fallback` and `music.explorer`, both of which also wait on
`music.instruments`.

## What this task is

Half of Explore Chords is "set up an instrument": a user picks an instrument
from a catalogue, settles on a tuning, says *how they play*, and from then on
every fingering the app offers is shaped by that choice. Estante keeps that
model but demotes it — the song comes first (workflow 1), so instrument set-up
is reached when wanted, from the header's instrument chip, not front-loaded.
This task decides and draws that reached-for surface: the model of an
instrument (a catalogue entry, a tuning, voicing rules); adding a second
instrument and switching between them; and the voicing rules themselves — a
preset plus an expert panel of per-rule toggles and per-cost numbers — attached
to each instrument. The deliverable is the workflow document and its board, and
the DIRECTION edits that move this out of §6's open decisions into §7's
workflows.

## Why it needs to be done

It is a gap DIRECTION §6 records as blocking the reading view: "Half of Explore
Chords, and the reading view depends on it, but no workflow designs it yet"
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 501–503). Three
already-decided workflows lean on a model this task has not yet pinned:

- The **shape fallback** (workflow 2, lines 88–108) ends at "the app's default:
  the easiest shape the fingering search finds **under the instrument's
  rules**." Those rules are undefined until this task defines them.
- The **chord explorer** (workflow 16) ranks and groups shapes under the
  instrument's rules, and its empty state links to "where the rules live" —
  this workflow. Until it exists, that link has no destination.
- **Arranging** (workflow 5) writes shapes into a song for *a tuning*; the
  tuning, the instrument it belongs to, and the rules the picker ranks by are
  this task's.

Downstream, `music.instruments` cannot be built, and the home book's
`instruments.json`, `shapes.json` and `songs.json` opaque values have no agreed
schema, until this design lands.

## Inputs / context

Governing documents, with the sections this task turns into a work order:

- **Explore Chords' DESIGN** (the `.tji`'s named guide),
  `/home/ruoso/devel/explore-chords/docs/DESIGN.md`:
  - **§2.1** (lines 69–120) — the instrument as ambient context: a header chip
    showing the active instrument, switched in one tap; the instrument list as
    a set of *instances* ("Guitar · Drop D" and "Guitar · Standard" are two
    entries); adding one is a first-class flow (catalogue → tuning preset or
    custom → optional rename); and a transient "viewing as" bar for content
    carrying a different instrument.
  - **§2.5** (lines 201–227) — voicing heuristics belong to the instrument
    instance, not the app; each instance carries a **preset** (`Beginner`,
    `Strumming`, `Fingerstyle`, `Jazz`, `Bass-friendly`) plus per-rule
    overrides edited in an **expert panel**; editing anything flips the label
    to `Custom`; there is no "Standard" (the baseline is `Strumming`, named for
    what it assumes); a preset *is* its rules, so an instrument naming one is
    rebuilt from it on load.
  - **§4.3** (lines 1511–1552) — the instrument model: a catalogue of
    templates, a user's set of instances `{ id, catalogId, label, strings,
    fretCount, heuristics }`; tuning is a comma-separated scientific-pitch
    list and is the source of truth; **no capo field** (a capo is a tuning);
    re-entrant tunings allowed.
  - **§5.2** (lines 1744–1820) — which chord tones must sound as a function of
    the rules; "root in bass" applies only where the instrument has a bass
    register, "which is precisely why heuristics belong to the instrument".
  - The code these carry over as (DIRECTION §5): `src/core/instrument.js`
    (model, `parseTuning`/`formatTuning`, `hasBassRegister`, `configFor`),
    `src/core/heuristics.js` (`HeuristicConfig`, `DEFAULT_WEIGHTS`, the five
    `PRESETS`, `withOverrides`), `src/data/instruments.js` (the catalogue), and
    the expert-panel UI `src/ui/instrument-settings.js`. **Note:** Explore
    Chords' §2.10 *voicing wizard* (a song-wide shape plan) is a different
    thing from §2.5's per-instrument rules, and belongs to workflow 5 /
    `music.wizard`, not here.
- **DIRECTION** ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md)): §3.2
  personal state (lines 136–151 — the home book holds instruments, voicing
  rules, which variation is in use, my shapes); §3.7 the app (lines 394–427 —
  React Aria, the Worker owns the data, the view is the only React layer, the
  music core is framework-free); §4 the interface (lines 428–444 — a search
  result says "whether it has voicings for the instrument in use"); §5 what
  comes over (lines 452–494 — the music core and the instrument catalogue carry
  over as-is); §6 open decisions (lines 496–512, the bullet to retire); §7
  workflows (lines 514–543, the intro and list to amend).
- **The home book format**
  ([`docs/home-book-format.md`](../../../docs/home-book-format.md)) — §4.1
  `preferences.json` (lines 187–206), §4.3 `instruments.json` (lines 247–265),
  §4.4 `shapes.json` (lines 267–285), §4.5 `songs.json` (lines 287–308), §1.2
  opaque value (lines 64–68), §5 merge (lines 330–377), §6 canonical form
  (lines 379–443).
- **cifra.md** `/home/ruoso/devel/cifra.md/spec/6-tunings.md` (§6, whole; §6.2
  lines 46–50 the tuning text, §6.3 lines 58–73 identity and the capo) and
  `spec/7-voicings.md` §7.1/§7.6 (voicings are per tuning; a reader matches a
  block to an instrument by tuning identity).
- **The workflows that touch it**: 01-first-run.md (lines 60–78), 02-find-and-
  play.md (lines 68–108), 05-arrange-for-an-instrument.md (whole),
  16-chord-explorer.md (lines 29–36, 173–179, 203–205).
- **The visual language**: [`docs/mockups/GUIDE.md`](../../../docs/mockups/GUIDE.md)
  (the board format, the component vocabulary), README.md "Decisions the
  drawings carry" (lines 22–27 — proportional charts; a diagram up the neck
  shows the fret number; defaults hollow, *your shapes* in the chord colour, the
  song's shapes in ink; status a word, never colour alone),
  [`theme.css`](../../../docs/mockups/theme.css), and the two closest boards to
  imitate, [`W05-arrange.dc.html`](../../../docs/mockups/W05-arrange.dc.html)
  and [`W16-chord-explorer.dc.html`](../../../docs/mockups/W16-chord-explorer.dc.html).
- **The predecessor refinements** in this area:
  [`explorer.md`](explorer.md) and [`home_book_format.md`](home_book_format.md).

## Constraints / requirements

- **A workflow document and a board.** This is the standard design-area
  deliverable ([`tasks/refinements/README.md`](../README.md) "Design tasks"):
  a workflow decided to its screens and edge cases, and a board on two phones,
  a tablet and a computer, registered in `canvas.json`. The `.tji` note is the
  standard *"the workflow document and its board."*
- **The model is personal state, stored opaquely.** An instrument's definition
  and its rules are the opaque values of `instruments.json` §4.3; *my shapes*
  are the opaque values of `shapes.json` §4.4; variation-in-use and
  transposition are `songs.json` §4.5. Workflow 15 defines these values' shape
  but **must not** add a file, change the register envelope, or need an atomic
  multi-key write: each independently-settable thing is one register, merged
  "the later change wins" key by key (§5). The instrument's *definition* and its
  *rules* are deliberately two registers (§4.3) so editing a rule and renaming
  the instrument on two devices do not clobber one another.
- **A tuning is spelled as cifra.md §6 spells it.** The tuning text (uppercase
  letter, pitches joined by single spaces, each pitch's spelling kept —
  `E2 A2 D3 G3 B3 E4`, `G4 C4 E4 A4`) is the tuning's identity, and the identity
  used to key `shapes.json`/`songs.json` and to name a song's voicing block
  (cifra.md §6.3, §7.6). A capo is a tuning (§6.3); there is no capo field, as
  in Explore Chords §4.3. Workflow 15 adopts this spelling; it does not invent a
  tuning identity.
- **Offline first; the home book commits automatically.** Adding, switching,
  editing rules and removing a shape are home-book preference changes that
  commit automatically and sync when there is a network (DIRECTION §3.2;
  workflow 16 lines 119–122) — not the explicit save-sheet edits of workflow 4.
  Nothing here waits on the network.
- **Component boundaries (DIRECTION §3.6–3.7).** The voicing-rule search is the
  framework-free music core carried from Explore Chords; the Worker owns the
  home book and runs the search; the view (React Aria Components) is the only
  layer that knows React. No code is shared with the service.
- **Accessibility.** Every interactive part uses React Aria Components with a
  keyboard path, axe clean at WCAG 2.1 AA; a shape's status (yours / default /
  song) and a preset's state (Custom) are carried by a **word**, never colour
  alone (mockups README lines 22–27).
- **No song text, and no settings, in logs** — not this task's surface directly,
  but the fixtures the board and later tests use are invented songs and
  instruments (the established cast: guitar `E2 A2 D3 G3 B3 E4`, cavaquinho
  `D4 G4 B4 D5`, ukulele `G4 C4 E4 A4`; songs *Tarde Clara*, *Choros da Ana*).
- **No new runtime dependency and no new architectural seam.** The model, the
  search and the catalogue all carry over from Explore Chords under DIRECTION
  §5; the storage is the already-landed home book. This task adds no DIRECTION
  §3.x seam.

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` `Tests:` clause is
*"none — design deliverable (the workflow document and its board)"*).
Acceptance is what the workflow document decides, what the board shows, and the
DIRECTION deltas. The document and board must be concrete enough that
`music.instruments`' named tests (below) are writable against them.

1. **`docs/workflows/15-set-up-an-instrument.md` exists** (first line
   `Status: decided`, in the shape of the fourteen: screens, edge cases,
   offline, a *Later* note) and decides:
   - **The instrument model** — an instrument is a catalogue entry (`catalogId`),
     a user `label`, a `tuning` (cifra.md §6 text, the source of truth and the
     identity), a `fretCount`, and its `rules`. The definition and the rules are
     stored as the two `instruments.json` registers of home-book §4.3. *Pins the
     `instruments.json` opaque value and `music.instruments`' behavior test
     "stored in the home book".*
   - **Adding a second instrument** — the first-class flow catalogue → tuning
     (a preset for that catalogue entry, or a custom pitch list) → optional
     rename, producing a new instance; "Guitar · Standard" and "Guitar · Drop D"
     are two entries. *Pins `music.instruments`' e2e-web "a second instrument".*
   - **Switching** — the header instrument chip (workflow 1, workflow 16) opens
     the roster; the in-use instrument is marked; switching re-derives the
     shapes everywhere. One active instrument at a time. *Pins `music.instruments`'
     e2e-web "switching from the header chip".*
   - **The voicing rules** — each instrument carries a **preset** (`Beginner`,
     `Strumming`, `Fingerstyle`, `Jazz`, `Bass-friendly`; no "Standard") and
     per-rule overrides in an **expert panel** exposing every rule as a toggle
     (`rootInBass`, `requireThird`, `omitFifth`, `allowRootless`,
     `requireExtensions`, `allowBarre`, `allowInnerMutes`, `allowDoubling`,
     `allowDuplicatePitch`), every limit as a number (`maxSpan`,
     `minSoundingStrings`, `maxResultsPerGroup`) and every cost as a number
     (the weights). Editing any one flips the label to `Custom`; a preset is its
     rules, rebuilt on load; `rootInBass` is forced off where the instrument has
     no bass register. *Pins `music.instruments`' unit "voicing-rule presets and
     the expert panel's rules".*
   - **Reviewing my shapes** — on the instrument's screen, the *my shapes* for
     that instrument (home-book §4.4) are listed per tuning and can be removed
     (resolving the surface workflow 16 left open, lines 203–205); adding a shape
     stays the explorer's one-at-a-time starring. *Pins `music.instruments`'
     behavior test "the instrument screens … stored in the home book".*
   - **Removing an instrument** — asks first, naming that its saved shapes and
     per-tuning song variations go with it (a tombstone on each register, §4.3,
     §5.3); the last / in-use instrument's removal falls back to the standard
     guitar. *Pins the tombstone behaviour of home-book §5.3.*
   - **Edge cases, offline, and Later** — set-up offline commits and syncs
     later; a tuning that duplicates an existing instance; the *Later* notes
     (starting a tuning from a nearby one's shapes, already "later" in workflow
     5; a capo as a tuning, already "later" in workflow 16).
2. **`docs/mockups/W15-set-up-an-instrument.dc.html` exists**, drawn on two
   phones, a tablet and a computer per `GUIDE.md`, and **registered in
   `canvas.json`**: a `boards` entry
   `"W15-set-up-an-instrument.dc.html": { "x": 0, "y": 26720, "w": 3208,
   "h": 1500, "title": "15. Setting up an instrument" }` (the next 1620-stride
   slot after W16 at `y: 25100`), appended to the `order` array after
   `W16-chord-explorer.dc.html`. The board shows the real states and copy: the
   header chip and the instrument roster with the in-use one marked; the
   add/edit form (catalogue, tuning preset vs. a custom pitch list, rename); the
   voicing-rule panel (a preset segmented control plus the expert panel of
   toggles/numbers, the `Custom` label); and the my-shapes review list. It
   honours the ChordBox legend (default hollow, *yours* in the chord colour),
   the status-as-a-word rule, and uses the established cast (guitar, cavaquinho,
   ukulele). *Pins the e2e-web axe-on-every-screen criterion of
   `music.instruments`.*
3. **Governing-document deltas (same commit, the closer's):**
   - `docs/DIRECTION.md` §6: the "Setting up an instrument" bullet (lines
     501–503) retired — marked decided and pointed at
     `docs/workflows/15-set-up-an-instrument.md`, mirroring the already-retired
     chord-explorer bullet (lines 504–507).
   - `docs/DIRECTION.md` §7: workflow **15** inserted in the list between 14 and
     16 ("15. **Set up an instrument** — tunings, a second instrument,
     switching, the voicing rules with presets and the expert panel"), and the
     intro (lines 519–521) amended to stop saying workflow 15 "is still a gap,
     so the numbering skips it".
   - `docs/DIRECTION.md` §3.2: "which instrument is in use" added to the
     personal-state list (lines 138–142), stored as a singleton register in
     `preferences.json` (see Decisions) — the home book already accommodates it
     (envelope + file whitelist, not a fixed preference-key list), so no
     home-book-format change is needed.
4. **No code tests, and none deferred.** A design task lands with no code
   tests; `music.instruments` lands with its unit, behavior and e2e-web tests,
   written against this document and board. Naming them here is the handshake,
   not a deferral — the tests for what *this* task delivers (the document and
   the board) are the document and the board.
5. **No `cifra.md:` work; the parked surface resolved here; nothing deferred.**
   The "browse *all my shapes*" surface workflow 16 flagged for this task (lines
   203–205) is resolved by the per-instrument my-shapes review of criterion 1
   (built within `music.instruments`' instrument screens) — no new WBS task and
   no "audit later" leaf. No tech debt is registered.

## Decisions

### A workflow document and a board, per the design-area convention

Workflow 15 is a screen the user sees and operates — a roster, a form, a rule
panel — so the standard design-area deliverable applies: a workflow document
and a board (`tasks/refinements/README.md` "Design tasks"), and the `.tji` note
is the standard *"the workflow document and its board."* **Chosen:** the
standard pair. **Rejected:** a format document in the register of
`design.home_book_format` — that sibling deviated because the home book is
*invisible* (nothing to draw); an instrument screen is the opposite, and its
states must be drawn.

### The instrument model carries over from Explore Chords unchanged

An instrument is `{ catalogId, label, tuning, fretCount, rules }` — Explore
Chords' §4.3 model, whose code carries over under DIRECTION §5. The tuning is a
scientific-pitch list and is the source of truth; number of strings is the list
length; **there is no capo field** because a capo is exactly a transposed
tuning (cifra.md §6.3; Explore Chords §4.3); re-entrant tunings are allowed.
**Chosen:** adopt the carried-over model verbatim. **Rejected:** a capo field —
it is a value nothing reads (the frets come out capo-relative from the tuning
already), and it would contradict cifra.md §6.3, which this task must align
with. **Rejected:** re-deciding the catalogue's contents — DIRECTION §5 brings
`src/data/instruments.js` over as-is; the board illustrates with the app's cast
(guitar, cavaquinho, ukulele) but the catalogue is inherited, not designed here.

### The instrument in use is a singleton register in `preferences.json`

Workflows 1 and 16 both say the in-use instrument is "a preference in the home
book". It is a singleton, so it lives as a register in `preferences.json`
(home-book §4.1) — value an instrument id, absent meaning the standard guitar.
This needs **no home-book-format change**: §4.1's key list is descriptive, and
the format validates the register envelope and the file whitelist, not a fixed
set of preference keys, so a new singleton register is already well-formed.
**Chosen:** an account-wide singleton preference, lazily written (home-book
§2.1 — the standard guitar is a built-in the app shows until the user has
something to store). **Rejected:** per-device, like recents (§4.6) — the two
shipped workflows call it "a preference", not a per-device matter; a single
user's few devices converging on one in-use instrument under last-write-wins is
fine, and switching is one tap. **Rejected:** a boolean "in use" on each
instrument in `instruments.json` — "in use" is singular and would admit two
winners under a key-by-key merge; a singleton register cannot.

### Voicing rules attach to the instrument; a preset plus an expert panel

Each instrument instance carries its own rules (Explore Chords §2.5): a preset
drawn from `Beginner`, `Strumming`, `Fingerstyle`, `Jazz`, `Bass-friendly` —
**no "Standard"**, the baseline being `Strumming`, named for the one rule it
rests on (a strumming hand crosses every string, so no inner mutes) — plus
per-rule overrides in an expert panel that exposes every rule as a toggle and
every cost as a number. Editing any one flips the label to `Custom`. A preset
*is* its rules, so an instrument naming a preset is rebuilt from it on load
(a correction to a preset reaches an old set-up; a `Custom` config is kept
exactly). `rootInBass` is forced off where the instrument has no bass register
(so switching a ukulele to `Jazz` cannot re-break it). **Chosen:** rules per
instrument, stored as the `rules` register of §4.3. **Rejected:** a global
voicing mode — "a bass and a ukulele want permanently different rules" (Explore
Chords §2.5); a global mode you must remember to switch is the wrong model.

### "How you play" is the preset, chosen in the editor — not a first-run question

Explore Chords asked "how you play" at first run, before anything else. Estante
puts the song first (workflow 1 lines 62–63), so the question is not
front-loaded; it is the preset choice inside the instrument editor, with a
sensible default per catalogue entry (`Strumming` for a guitar, `Bass-friendly`
for a bass). **Chosen:** the preset is set when setting up or editing an
instrument. **Rejected:** a first-run "how you play" step — it contradicts
workflow 1's "the song comes first".

### No "viewing as" transient override

Explore Chords had a transient "viewing as" bar for a shared link or a song
sheet written for a different instrument (§2.1). Estante does not need it: the
reading view already handles a song whose voicings are for a tuning you do not
use, through the shape fallback (workflow 2 lines 88–108 — the song's choice,
then *my shape*, then the app default), and a shared *book* (workflow 10) does
not carry an instrument. **Chosen:** no override mechanism; switching the in-use
instrument from the chip is the only instrument change, and it is explicit.
**Rejected:** porting the "viewing as" bar — it answers a problem the fallback
chain already answers, and it would add a transient state the estante workflows
do not have.

### Reviewing my shapes lives on the instrument's screen

Workflow 16 stars and unstars one shape at a time and left "a *browse all my
shapes* surface" for this task (lines 203–205). Workflow 15 owns
instrument-attached personal state, so the instrument's screen lists *my shapes*
for that instrument (per tuning) and lets one be removed; adding stays the
explorer's one-at-a-time starring. **Chosen:** a modest per-instrument review /
remove on the instrument screen, built within `music.instruments`' instrument
screens. **Rejected:** a separate cross-instrument "my shapes" browser — a
speculative screen with no second call site today; a per-instrument list is
enough to remove a stale shape without re-finding it in the explorer.
**Rejected:** leaving it unowned — the orchestrator flagged it for placement;
deciding it here (not re-parking it) is the rule.

### Notation is not set here

The notation dialect is a single home-book preference set once (workflow 1;
`preferences.json` §4.1), and workflow 16 states there is "no dialect picker on
this screen". The instrument screen does not repeat it. **Chosen:** notation
stays out of workflow 15. **Rejected:** a per-instrument notation — notation is
how the user reads chords, not a property of the instrument.

## Open questions

(none — all decided.)

Two matters are deliberately *not* this task's and are recorded only so they are
not mistaken for gaps: starting a new tuning from a nearby tuning's shapes
(already a *Later* item in workflow 5) and a capo as a tuning the search runs on
(already a *Later* item in workflow 16). Neither is a blocker; neither is a WBS
task.

## Status

**Done** — 2026-10-05.

- `docs/workflows/15-set-up-an-instrument.md` — workflow decided (Status: decided), covering the instrument model (`catalogId`, `label`, `tuning`, `fretCount`, `rules`), adding a second instrument (catalogue → tuning preset or custom pitch list → optional rename), switching from the header chip, voicing rules (Beginner/Strumming/Fingerstyle/Jazz/Bass-friendly presets + expert panel of toggles/limits/costs, Custom label, `rootInBass` forced off without a bass register), my-shapes review and remove per tuning on the instrument screen, removing an instrument with tombstones, offline/edge cases, and Later notes.
- `docs/mockups/W15-set-up-an-instrument.dc.html` — board drawn on two phones, tablet, and computer: instrument roster with in-use mark, add/edit form (catalogue, tuning preset vs. custom pitch list, rename), voicing-rule panel (preset segmented control + expert panel, Custom label), my-shapes list with ChordBoxes kind=yours + remove; ChordBox legend honoured (default hollow, yours in chord colour), status as a word.
- `docs/mockups/canvas.json` — boards entry `W15-set-up-an-instrument.dc.html` at y:26720 (x:0, w:3208, h:1500), appended to order after `W16-chord-explorer.dc.html`.
- `docs/DIRECTION.md` §3.2 — "which instrument is in use" added to the personal-state list (singleton register in `preferences.json`).
- `docs/DIRECTION.md` §6 — "Setting up an instrument" bullet retired, marked decided, pointed at `docs/workflows/15-set-up-an-instrument.md`.
- `docs/DIRECTION.md` §7 — workflow 15 ("Set up an instrument — tunings, a second instrument, switching, the voicing rules with presets and the expert panel") inserted between 14 and 16; intro amended to remove the "15 still a gap" note.
- The "browse all my shapes" surface that `design.explorer` parked is resolved here: per-instrument my-shapes review and remove lives on the instrument screen, built within `music.instruments`.
