# Refinement — `design.display_preferences`

## TaskJuggler

[`tasks/20-design.tji`](../../20-design.tji), `task display_preferences
"Density and chord-diagram display preferences"` (line 51):

> Decide and draw two new user-chosen, synced preferences on the account
> screen's Preferences section beside theme and language: density (the
> theme.css densities, today locked at comfortable) and the chord diagram's
> display — left-handed mirror and vertical/horizontal neck, as Explore Chords
> offered — applied in the explorer and the in-song picker. Add the home-book
> registers to docs/home-book-format.md §4.1 and the decision to workflow 1
> (density) and workflow 16 (diagram). Source: tasks/parking-lot.md 2026-10-14
> (Density; Left-handed / horizontal-neck). Tests: none — design deliverable
> (the workflow and home-book-format edits and the Theme-picker board updated).

## Effort estimate

1d (as the `.tji` gives it). The document text is written with this refinement
(the deltas below); the rest of the day is updating the Theme-picker board on
its four frames.

## Repository

estante-de-cifras, **not** `cifra.md/` (the note does not start with
`cifra.md:`; the registers live in the home book, a settings repository, not in
the song format). Files:

- `docs/home-book-format.md` §4.1 — three new registers `density`,
  `diagramHanded`, `diagramOrientation` in the example (L193-203) and their
  bullets (L218-233), plus the rule that an unknown value reads as the default
  (delta, **written**).
- `docs/workflows/01-first-run.md` — new §Density (L120-) after §Theme (delta,
  **written**).
- `docs/workflows/16-chord-explorer.md` — new §How diagrams are drawn (L193-),
  and the *Left-handed and horizontal-neck diagrams* bullet removed from §Out of
  scope (delta, **written**).
- `docs/workflows/13-new-device.md` §The account screen — the Preferences bullet
  (L118-128) lists density and chord diagrams and their order (delta,
  **written**).
- `docs/DIRECTION.md` — §3.2 Personal state (L138-139) names the density and how
  chord diagrams are drawn; §6 a new *Display preferences* bullet (L598-)
  (delta, **written**).
- `docs/mockups/Theme-picker.dc.html` — **updated** (the implementer draws it):
  the Density and Chord diagrams groups added on the four frames, the
  before-sign-in copy widened. Its canvas.json entry (`y: 28340`, 3208×1500) is
  unchanged — same board, same size.

No code, no `api/` change, no hook change: `hook.home_book` validates the
envelope, canonical form, paths and size of `preferences.json`, not its value
sets (home-book-format §8), so new registers pass it as they stand.

## Inherited dependencies

The task has no `depends`. What it builds on is settled (`complete 100`):

- `design.theme_picker` — the Preferences section of the account screen and its
  board `docs/mockups/Theme-picker.dc.html` (two phones: Estante before sign-in
  L30, Palco signed in L85; tablet Caderno L133-; computer L208-), the
  radio-group-with-*Selected* pattern, the before-sign-in card (L74-79).
- `design.home_book_format` — the register envelope and merge
  (`docs/home-book-format.md` §3, §5.1), §4.1 `preferences.json`.
- `design.explorer` — workflow 16, which parked the diagram toggles
  (`tasks/refinements/design/explorer.md` L468-476, L485-487).
- `shell.tokens` — `app/src/theme/resolve.js:20-24` (`DENSITIES`,
  `DEFAULT_DENSITY = 'comfortable'`, "no chooser, no persistence"),
  `app/src/theme/ThemeRoot.jsx:60-66` (the density class on `.est`), mounted
  with no density at `app/src/App.jsx:189`; the CSS at
  `app/src/theme/theme.css:113-115`.
- `shell.diagram` — `app/src/diagram/ChordDiagram.jsx:33` (no handed or
  orientation prop yet) over `app/src/render/diagram.js:21-33`
  (`DiagramOptions {orientation, handed}`, mirroring at `:57`),
  `app/src/render/neck.js` (the horizontal neck), `app/src/render/chord-box.js:136-140`
  (left-handed click targets mapped back to the logical string).
- `storage.preferences_surface` and `account.account_screen` — the Worker
  surfaces every `{value, at}` register of `preferences.json`
  (`app/src/worker/preferences.js:31`); `SET_THEME`/`SET_LANGUAGE`
  (`app/src/worker/logic.js:1211-1258`) are the write pattern; the
  Preferences region at `app/src/account/AccountScreen.jsx:402-432`.

Downstream, waiting on this task: `shell.display_preferences`
(`tasks/50-shell.tji:76`), "as design.display_preferences decides". Also
touching the same screen, not waiting on this: `account.preferences_layout`
(`tasks/70-account.tji:55`), whose e2e compares the account screen to
Theme-picker#1-4 — it will be compared against the board as updated here.

## What this task is

Decide in workflows 1 and 16, register in the home-book format, and draw on the
Theme-picker board, three new preferences in the account screen's Preferences
section: **density** (Compact, Comfortable, Roomy — the theme.css densities) and
the chord diagram's **hand** (right / left-handed mirror) and **neck**
(vertical chord box / horizontal neck). Each is a synced home-book register,
applied app-wide.

## Why it needs to be done

`shell.tokens` shipped density locked at comfortable, and `design.explorer`
shipped the vertical chord box only, each parking the question (parking-lot
2026-10-05 *Density as a user-chosen, synced preference* and *Left-handed /
horizontal-neck diagram display options*, triaged on 2026-10-14 in 799f87d into
this task and `shell.display_preferences`). The render layer carried over from
Explore Chords already draws mirrored and horizontal diagrams
(`app/src/render/diagram.js`, `neck.js`) and the theme already defines three
densities; what is missing is the decision of where they are chosen, where they
are kept and what they reach — which `shell.display_preferences` builds.

## Inputs / context

- **Workflow 1** — `docs/workflows/01-first-run.md` §Language (L88-94), §Theme
  (L96-118, "The chart itself never changes with the theme beyond colour and
  typeface"), the new §Density (L120-).
- **Workflow 16** — `docs/workflows/16-chord-explorer.md` §Ranked, grouped by
  position (L37-72: the shared component with workflow 5's picker, the
  `ChordBox` and `describeFingering`), §Starring a shape (L108-, entering a
  shape by hand), the new §How diagrams are drawn (L193-), §Out of scope.
- **Workflow 13** — `docs/workflows/13-new-device.md` §The account screen
  (L116-).
- **Home-book format** — `docs/home-book-format.md` §3 (the envelope, the
  tombstone L59-60, L157-162), §4.1 (L189-), §5.1 (merge), §8 (what the hook
  validates).
- **DIRECTION** — §3.2 Personal state (L136-151: preferences committed
  automatically), §6 (the theme picker bullet, L577-582).
- **Mockups** — `docs/mockups/theme.css` L107-109 (`density-compact` `--u: 6px;
  --chart-size: 15px`, `density-comfortable` `--u: 8px`, `density-roomy`
  `--u: 10px; --chart-size: 19px`); `docs/mockups/README.md` L18 (every board
  switchable to any density), L25-26 (the starting fret; your shape / default);
  `docs/mockups/Theme-picker.dc.html` (frames above; props at L286: `density`
  enum, default comfortable); `docs/mockups/GUIDE.md`; `ChordBox.dc.html`.
- **Explore Chords** — `../explore-chords/src/ui/display-toggles.js` ("Both are
  display concerns: they change how a fingering is drawn, never which
  fingerings are found"); `src/state/persist.js:139-142` (`orientation:
  'vertical'`, `handed: 'right'` defaults); copy `en.js:110-114` (*Diagram
  display*, *Neck view*, *Left-handed*), `pt-BR.js` (*Canhoto*);
  `docs/DESIGN.md` L1904-1906 ("Left-handed mode is a coordinate transform, not
  a second code path").
- **Predecessor refinements** — `tasks/refinements/design/theme_picker.md`
  (the Preferences section, *Selected* by word, automatic per device),
  `home_book_format.md` (one-line diffs, last-writer-wins registers),
  `explorer.md` L331-336, L468-476 (the parked toggles), `leave_book.md` and
  `recovery_email.md` (the text written with the refinement, the board drawn by
  the implementer).

## Constraints / requirements

- **Preferences are home-book registers** (DIRECTION §3.2): written through the
  Worker, committed automatically, no save, synced when there is a network;
  nothing the user chooses waits on it.
- **One meaning for the default**: absent, tombstone and the default value are
  one state, as the theme's *automatic* is written today (`SET_THEME` writes the
  tombstone); an unknown value reads as the default and is left alone, so an
  older app meeting a newer value never fails.
- **Display only**: density never changes what a chart says (which chord over
  which syllable); hand and neck never change which shapes are found, their
  ranking, grouping, shorthand, accessible name, or the shape recorded when one
  is entered by hand.
- **Accessibility**: each preference a labelled radio group (React Aria
  `RadioGroup`, as theme and language are), the chosen one marked by the word
  *Selected*, never colour alone; the live sample is decorative beside the
  words.
- **The board** follows `docs/mockups/GUIDE.md`: same 3208×1500 board, two
  phones / tablet / computer, only `var(--…)` tokens, real copy from the
  workflows, the cast; the theme columns it already draws stay.

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` `Tests:` clause:
*"none — design deliverable (the workflow and home-book-format edits and the
Theme-picker board updated)"*). Acceptance is what the documents decide and
what the board shows — concrete enough that `shell.display_preferences`'s named
tests (unit: ChordBox geometry mirrored and rotated, preference defaults;
behavior: choosing each re-renders, axe in each density and orientation;
e2e-web: a preference chosen, kept across a reload) are written against them.

1. **`docs/home-book-format.md` §4.1 registers** (written): `density`
   (`"compact"` | `"comfortable"` | `"roomy"`, absent = comfortable),
   `diagramHanded` (`"right"` | `"left"`, absent = right), `diagramOrientation`
   (`"vertical"` | `"horizontal"`, absent = vertical); choosing the default
   writes the tombstone; an unknown value reads as the default — *pins
   `shell.display_preferences`'s unit "preference defaults"*.
2. **Workflow 1 §Density decides** (written): the three choices named in words
   with a one-line description and a live sample; Comfortable the default;
   effect at once on every screen; synced to every device (not per device);
   never changes the chart beyond spacing and size — *pins the behavior
   "choosing each re-renders", axe in each density, and the e2e "kept across a
   reload"*.
3. **Workflow 16 §How diagrams are drawn decides** (written): Hand (Right-handed
   default / Left-handed, the strings in opposite order) and Neck (Vertical
   default / Horizontal, nut at the left, lowest string at the top, at the
   bottom when left-handed — as `app/src/render/neck.js` draws it); chosen in
   Preferences with one live diagram; synced; applied to **every** diagram the
   app draws (explorer, in-song picker, beside a song, wizard, conflict, my
   shapes, entering by hand — taps land on the string drawn, the shape recorded
   is the same); accessible name, starting fret and your-shape/default
   unchanged; the *Out of scope* bullet retired — *pins the unit "ChordBox
   geometry mirrored and rotated", the behavior "axe in each orientation"*.
4. **Workflow 13 and DIRECTION** carry the pointers listed under Repository
   (written): the Preferences order **theme, density, chord diagrams,
   language**. DIRECTION §7 is unchanged: no new workflow.
5. **The board** `docs/mockups/Theme-picker.dc.html` is updated, drawn to
   GUIDE.md, same size and registration:
   - `board-num` *Workflow 1 · Workflow 13 · Workflow 16*; `board-sub` extended
     by one sentence naming density and chord diagrams;
   - a **Density** group (radio rows Compact / Comfortable / Roomy, each with
     its one-line description, a small sample of a chart line in that density,
     *Selected* on the chosen one) and a **Chord diagrams** group (Hand: Right-
     handed / Left-handed; Neck: Vertical / Horizontal; one live diagram of a C
     major on guitar, `x32010`, drawn as the pair chosen) between Theme and
     Language, on every frame that shows the Preferences section;
   - **Phone 1** (Estante, not signed in): defaults selected — Comfortable,
     Right-handed, Vertical; the not-signed-in card says *carry your
     preferences to your other devices* in place of *theme and language*;
   - **Phone 2** (Palco, signed in): scrolled to Density and Chord diagrams,
     **Left-handed** selected and the sample diagram mirrored;
   - **Tablet** (Caderno): the frame itself drawn in `density-roomy`, **Roomy**
     selected;
   - **Computer**: **Compact** selected and the frame in `density-compact`;
     **Left-handed** and **Horizontal** selected, the sample drawn as a
     horizontal left-handed neck;
   - status in words (`.badge` *Selected*), never colour alone; no other board
     touched; the canvas.json entry unchanged.
6. **No code tests, and none deferred.** The tests pinning these decisions are
   `shell.display_preferences`'s, named in its `.tji` note — the handshake, not
   a deferral.
7. **No deferred WBS follow-up.** The build is `shell.display_preferences`;
   applying the diagram choices to every diagram (not only the explorer and the
   picker its note names) falls inside it — `ChordDiagram` reading the
   preferences slice reaches every caller (`app/src/songs/SongReading.jsx:427`,
   `SongArrange.jsx:56`, `SongWizard.jsx:355`, `SongConflict.jsx:110`,
   `app/src/instruments/MyShapes.jsx:40`, `app/src/music/EnterShape.jsx:134`,
   `FingeringGroups.jsx:46`) with no extra seam.

## Decisions

### Three registers, not one `display` object

**Chosen:** `density`, `diagramHanded`, `diagramOrientation`, each its own
register in the flat §4.1 map. Two devices changing different ones both keep
their change (§5.1 merges per register), and each change is a one-line diff
(`home_book_format.md`). **Rejected:** one `diagram` register holding
`{handed, orientation}` (a change of hand on one device and of neck on another
would lose one to last-writer-wins); names `handed`/`orientation` bare (too
generic in a flat map that will grow; the `diagram` prefix says what they draw).

### Synced to every device, not per device

**Chosen:** like the theme and language, one value that follows the person — a
left-handed player is left-handed on every device, and density answers the
reader's eyes and distance, while each viewport's layout already adapts to its
size. **Rejected:** per-device registers under §7's device namespacing
(a preference that silently differs between devices, and a new device would
start at the default after the person had chosen); an *automatic* density by
viewport (that is what the responsive layouts already do; a fourth choice
would explain itself poorly).

### The default is the tombstone; unknown values read as default

**Chosen:** absent, `null` and the default value mean one thing, as `SET_THEME`
already writes *automatic* (`app/src/worker/logic.js:1211-1236`), and an unknown
value reads as the default, as `resolve.js:26-32` does for a theme.
**Rejected:** writing `"comfortable"` explicitly (two spellings of one state);
failing on an unknown value (a newer device would break an older one).

### Every diagram, not only the explorer and the picker

**Chosen:** the choices reach every diagram the app draws. The parked question
named the explorer and the picker because those are where shapes are browsed,
but a left-handed player reading a song (workflow 2) or entering a shape by hand
would otherwise meet the other hand's drawing a screen later. The render layer
already makes mirroring a coordinate transform with click targets mapped back
(`chord-box.js:136-140`), so it costs nothing extra. **Rejected:** explorer and
picker only (inconsistent drawings of one shape across screens); forcing
vertical in the wizard as Explore Chords did (the wizard there was a guided
guitar lesson; here it draws the same shapes as everywhere else).

### Radio groups in the Preferences section, not toggle buttons beside the diagrams

**Chosen:** two labelled radio groups with one live diagram, in Preferences,
ordered theme, density, chord diagrams, language — the house pattern for a
preference (`theme_picker.md`), with each option named. **Rejected:** Explore
Chords' `aria-pressed` toggles on the explorer screen (the choice applies
app-wide, so it belongs where the app's preferences are; a toggle on one screen
reads as that screen's); a second place to change them on the explorer (two
homes for one register).

### Density copy names the three theme.css densities

**Chosen:** *Compact*, *Comfortable*, *Roomy*, the names `theme.css` and every
board's tweak already use, each with a one-line description; the group headed
*Density*. **Rejected:** a slider or a text-size control (density is three
tested token sets, each checked for contrast and fit by `shell.tokens`'
behavior tests; a continuous control would ship untested states).

### The Theme-picker board, updated, not a new board

**Chosen:** the note names it, and the Preferences section is drawn there;
same board size and registration. **Rejected:** a new `Display-preferences`
board (would split one section across two boards and leave the Theme-picker
drawing an incomplete section); redrawing W16 (its frames are the explorer;
workflow 16's text and the Preferences sample carry the mirrored drawing).

## Open questions

(none — all decided.)

## Status

**Done** — 2026-10-15.

- docs/mockups/Theme-picker.dc.html: the board now has a Density group and a Chord diagrams group (Hand, Neck, one live C `x32010`) between Theme and Language on all four frames; phone 2 shows Palco, left-handed and mirrored, the tablet Caderno and Roomy, the computer Compact with a left-handed horizontal neck; the sign-in card mentions carrying preferences to other devices.
- docs/home-book-format.md: the home-book registers for density and the diagram's hand and neck (§4.1).
- docs/workflows/01-first-run.md, 13-new-device.md, 16-chord-explorer.md: the density, sync and diagram decisions.
- docs/DIRECTION.md: agrees with the above.
- Tests: none — design task; acceptance is the documents and the board. The tests belong to `shell.display_preferences`.
- The board was not rendered (checked only that tags balance); the canvas needs republishing (parking lot).
