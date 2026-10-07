# songs.arrange — Arrange mode and the picker

## TaskJuggler entry

Defined in [`tasks/60-songs.tji`](../../60-songs.tji) (`task arrange`, line 57),
under the parent cascade

```
task songs depends shell.layout, shell.chart, foundation.e2e_web
  task arrange depends !reading, cifra_js.editing, music.explorer
```

> "Tappable chords, every Cm or only here, choose these for every unchosen
> chord, enter a shape by hand, variations. Workflow 5. Tests: behavior
> (tappable chords, every Cm or only here, a shape by hand; a keyboard path
> through the picker; axe); e2e-web (arrange a song for guitar on the three
> viewports, keyboard only on the computer, a new variation; axe)."

## Effort estimate

**4d** (as scoped in the `.tji`), `allocate team`. Roughly: the arrange
surface and its mode toggle off the reading view (~1d); the picker — grouped
candidate shapes, every/only-here, enter a shape by hand — composed from the
carried explorer parts (~1.5d); "choose these for every unchosen chord" and
the variation add/select, each writing through the cifra.md §8.5 edit ops
(~1d); the behavior and e2e-web suites with axe (~0.5d).

## Repository

**estante-de-cifras** only. Touched directories:

- `app/src/songs/` — the arrange surface, its pure helpers, its dev mount.
- `app/src/chart/` — an opt-in press seam on the carried `Chart` (Decision 3).
- `app/src/music/` — a configurable primary action on the carried `EnterShape`
  (Decision 6).
- `app/src/shell/` — `AppShell` wires the reading view's `onArrange` seam.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — an `arrange.*` section.
- `app/src/App.jsx` — the `#dev/arrange` hash mount.
- `e2e/web/tests/` — the arrange journey.

**Not a `cifra.md:` task.** Arrange lands entirely in the app. It *consumes*
the cifra.md for-JavaScript library (`cifra-md`) — its parser, its §8.5
editing operations and its canonical writer — but writes no spec, reference
or corpus. The app and the service share no code; the music core and
`cifra-md` are framework-free below the view (DIRECTION §3.6 `:288`, §3.7
`:415-417`). The §8.5 operations themselves shipped in cifra_js.editing (see
below); arrange only calls them.

## Inherited dependencies

- **songs.reading** — *settled, Done 2026-10-07*
  ([`reading.md`](reading.md)). Arrange is a mode entered *from* the reading
  view. Reading already raises the **`onArrange({ bookId, path })`** seam from
  four places (the narrow action bar, the narrow and wide "More" menus, and
  the no-voicings "Arrange for {instrument}" notice shown when offset 0 && the
  song has chords && no variation is chosen), and it is **suppressed while the
  song is transposed**. Arrange reuses reading's composition verbatim:
  `parse(text, dialect)` → `resolveSongVoicings(model, instrument, …)` →
  `<Chart>` + `<ChordDiagram>` (`app/src/songs/SongReading.jsx`), the pure
  `chartChordList(parsed)` and `transposeStatus(…)`
  (`app/src/songs/reading-view.js`), and `songVariations(parsed, tuningId)`
  (`app/src/songs/song-variations.js`).
- **cifra_js.editing** — *settled, Done 2026-10-05*, cifra.md `b1d1f94`
  ([`../cifra_js/editing.md`](../cifra_js/editing.md)). The five §8.5
  operations in `cifra-md`'s `js/src/edit.js`, pure `doc → doc` transforms
  (re-exported from `js/src/index.js`): `chooseShapeForOccurrence(doc,
  occurrence, tuning, variation, shape)` (§8.5.1, "only here"),
  `chooseShapeForKey(doc, key, tuning, variation, shape)` (§8.5.2, "every
  Cm"), `clearKey(doc, key, tuning, variation)` (§8.5.3), `chooseShapes(doc,
  plan, tuning, variation)` (§8.5.4, the batch), `addVariation(doc, tuning,
  name, copyFrom)` (§8.5.5, refuse-on-exists). **They do not
  self-canonicalise** — the caller runs `write`/`canonical` to apply the §8.3
  invariants. A shape-setting op creates its target block when absent; the
  `shape` input is `{ frets, fingers? }` in the model's array form.
- **music.explorer** — *settled, Done 2026-10-06*
  ([`../music/explorer.md`](../music/explorer.md)). The shared picker parts
  arrange reuses: `FingeringGroups.jsx` (the ranked-and-grouped shape list
  with a per-shape `renderAction` slot) over `fingering-groups.js`
  (`groupViewModel`), and `EnterShape.jsx` (the by-hand shape dialog). The
  carried engine underneath: `searchFingerings(chord, instrument, config,
  options)` (`app/src/core/search.js:344`), `fingeringFromFrets(frets, chord,
  instrument, config)` (`:447`), and the `Fingering` shape.

Transitively settled seams arrange leans on (through reading): the three-level
resolver `resolveSongVoicings` / `unvoiceableKeys` (`app/src/core/voicings.js:145,214`,
music.fallback), the instrument roster and `instrumentInstance` /
`openMidis` (`app/src/core/instrument.js`, music.instruments), the pure
voicing-plan engine `app/src/core/voicing-plan/` and its text writer
`apply.js` (`applyPlan`, `planIntoNewVariation`), and `analyseSong(doc,
dialect)` whose `ReadingEntry.occurrence = { section, part, line, measure,
item }` is the §8.5 occurrence path (`app/src/core/song-analysis.js`).

No pending blocking dependencies — every direct and transitive dependency is
Done. The wizard *run* (the planner question flow) is **songs.wizard_ui**
(1d, `depends !arrange, music.wizard`), a separate WBS leaf, not this task
(Decision 9).

## What this task is

Arranging is choosing how a song's chords are played on one instrument — the
voicing block for its tuning (cifra.md §7). From the reading view, *arrange*
(or *arrange for {instrument}* on a song with nothing chosen for this
instrument) turns the song's chords into things to tap, and *Done* turns them
back. Tapping a chord opens a picker — the shapes the search finds for that
chord on this instrument, ranked easiest first and grouped by neck position,
with *enter a shape* at the top — and choosing one writes `- Cm: x35543` into
the voicing block for this tuning and the variation in use, creating the block
if there is none. The picker offers **every Cm** (the whole voicing key) and
**only here** (this one occurrence, which marks the chart everyone shares, and
says so first). **Choose these for every unchosen chord** writes in what each
unchosen chord currently shows — the user's own shape or the app's default —
making it a choice. Variations keep an arrangement beside another: adding one
(empty or a copy of the one in use), a name already used refused, a selector
above the shapes when a tuning has more than one. Every change is an ordinary
unsaved working-copy edit (workflow 4): it shows as unsaved and is saved or
discarded the same way. Arrange is not offered while the song is transposed —
it writes voicings for the chords as written.

## Why it needs to be done

Arranging is the reason the music core was built, and it is the last reading-
side capability M2 (`m2_local`, [`tasks/99-milestones.tji`](../../99-milestones.tji))
promises: "find, read, write, edit, arrange, history, the explorer, the file
view — installed and offline." Reading already surfaces whether a song has
voicings for the instrument in use and dead-ends at the `onArrange` seam with
nothing behind it; this task is what that seam opens. Downstream,
**songs.wizard_ui** mounts the planner inside the arrange surface (into a new
variation first, over this one second), and the musical diff and save sheet
(songs.save_sheet) already render "added voicings for …" from an arrange edit
(DIRECTION §4 `:454-457`). Nothing else blocks on arrange, but M2 cannot close
without it.

## Inputs / context

### Governing design

- **Workflow 5 — Arrange for an instrument**
  ([`docs/workflows/05-arrange-for-an-instrument.md`](../../docs/workflows/05-arrange-for-an-instrument.md)),
  status *decided*. The normative source. Arranging is a mode (`:14-21`): a
  tap on a music stand must never change the song, so outside the mode a tap
  only enlarges the diagram. In the mode, chosen chords show their shape,
  unchosen ones show the fallback marked *your shape* or *default* (`:22-25`);
  arranging is not offered while transposed (`:26-27`). The picker
  (`:29-35`): the search's shapes for that chord on this instrument, ranked
  easiest first, grouped by position, with *enter a shape* at the top;
  choosing writes `- Cm: x35543` into the block for this tuning and the
  variation in use, creating the block if there is none. Every Cm vs only here
  (`:37-49`): a voicing key names a chord everywhere, so a key choice sets
  every `Cm`; *only here* gives the occurrence a footnote marker `Cm[2]` — a
  change to the chart every instrument shares — and **says so before it acts**;
  on every other tuning that occurrence becomes unchosen (§7.6 forbids `Cm[2]`
  falling back to `Cm`). Accepting what is shown (`:52-61`): **choose these for
  every unchosen chord** writes in what each shows, the only way *my shapes*
  get into a song. Variations (`:75-85`): empty or a copy of the one in use, a
  used name refused, the selector only when a tuning has more than one.
  Someone else's song (`:87-94`): nothing is different while arranging; *only
  here* is the one act that reaches other instruments, and it says so. *Later*
  (`:96-102`): starting from a nearby tuning, and the capo — out of scope (see
  Deferred work).
- **DIRECTION** ([`docs/DIRECTION.md`](../../docs/DIRECTION.md)):
  - §3.1 `:127-134` — an arrange edit lives in the working copy; sync merges
    incoming changes under the user's unsaved edits.
  - §3.2 `:136-151` — **the split arrange straddles.** *Which variation is in
    use* and *my shapes* ("how the user plays a chord … used wherever a song
    has chosen none") are **personal state** in the home book, committed
    automatically, never pushed. A shape chosen *into a song* (every Cm / only
    here) is **shared authored content**, an explicitly-saved edit.
  - §3.6 `:277-392` — the app is the view; `cifra-md` reads/canonicalises/
    merges/diffs; the app and service share no code (`:288`).
  - §3.7 `:394-434` — React Aria Components, "the shape picker" named among
    them (`:399-401`); `docs/mockups/theme.css` is the visual authority
    (`:404-405`); the Worker owns git, the working copy and the index, the
    main thread never touches IndexedDB (`:407-409`); the view reads slices
    through `useSyncExternalStore` (`:410-414`); framework-free below the view
    (`:415-417`); charts are proportional, chords stacked over syllables
    (`:421-423`).
  - §4 `:436-458` — search says whether a song has voicings for the instrument
    in use; history shows "added voicings for G4 C4 E4 A4" and a default save
    message drawn from the musical diff (`:454-457`).
  - §5 `:468-475` — the voicing planner (`src/core/voicing-plan/`), song
    analysis (`src/core/song-analysis.js`), and the document-adapters
    (`resolveSongVoicings`, `applySavedVoicings` in `voicings.js`) take a
    parsed song and come over with the music stream.

### The mockup (what the drawings decide)

[`docs/mockups/W05-arrange.dc.html`](../../docs/mockups/W05-arrange.dc.html),
drawn on two phones, a tablet and a computer. Board subtitle (`:20`):
"Arranging is a mode, so a tap on a music stand never changes the song.
Choosing a shape writes it into the block for this tuning; only 'only here'
touches the chart everyone shares, and it says so first. Every change is an
ordinary unsaved edit." Real copy and states:

- **Phone 1 — arrange overview** (`:28-65`): appbar Back · title · primary
  **Done**; a `.chip.accent` "Arranging · Guitar" with "Tap a chord to choose
  its shape"; the chart with `.mark-tap` on the sung lines (`:40-49`); a
  **Shapes** strip of `ChordBox`es, one per chord, with `kind` `song` /
  `yours` / `default` (`:52-55`) and the caption "G and D are chosen in this
  song. Em and C are not: they show your shape and the app's default."
  (`:57`); a full-width **"Choose these for every unchosen chord"** (`:58`);
  a footer of two equal buttons **"Run the wizard"** and **"Variations"**
  (`:61-62`).
- **Phone 2 — the picker from one bar** (`:67-115`): a chord-only (barline)
  chart; a bottom **sheet** (`role="dialog"`) over a scrim with a `.grip`,
  title **"Cm"** and meta **"Primeira Parte, bar 3"** (`:92-93`); a `.seg`
  segmented control **"Every Cm"** / **"Only here"** (`:95`); a
  `.notice.unsaved` (warning triangle) "Only here marks this bar in the chart,
  for everyone who plays the song. On their instruments it shows the default
  until someone chooses." (`:96-99`); a `.row.explore` **"Enter a shape"**
  (`:100-102`); candidate shapes grouped under **"Around fret 3"** / **"Around
  fret 8"** (`:103-112`), each a `<button>` wrapping a `ChordBox` with
  `aria-label` giving the chord + frets ("Cm, x35543").
- **Tablet — entering a shape by hand** (`:120-160`): appbar title "Enter a
  shape for Cm", a chip "Guitar · E A D G B E"; instruction "Tap a string at a
  fret to place a finger; tap above the nut to mute or open it." (`:130`); a
  large editable `ChordBox`; a live per-string "Notes it holds" readout with
  role badges and a `.badge.conflict` "not in Cm" (`:140-146`); a
  `.notice.conflict` "The A♭ … is not in Cm … You can still choose this
  shape." (`:149-152`); actions **"Cancel"** / primary **"Choose this shape"**
  (`:153-156`).
- **Computer — the wizard's plan** (`:165-231`): *this pane is
  songs.wizard_ui's* (into a new variation first, over this one second). What
  arrange owns here is the **variation selector** row — a `.seg` "Voicings" /
  "Up the neck" / "+ New variation" (`:200-203`) — and the note "The selector
  shows only when guitar has more than one variation in this song." (`:224`).

Component and token references:
[`ChordBox.dc.html`](../../docs/mockups/ChordBox.dc.html) — `kind` ∈
`song|yours|default` drives dot fill (ink / chord colour / hollow) and the
"who" caption ("your shape" / "default" / none) (`:81-82`); `frets` split on
`-` when present else per character (`:48`); `size` `s|m|l` (`:47`); `inherit`
embeds in the surrounding `.est` tokens (`:84-85`).
[`theme.css`](../../docs/mockups/theme.css) — the `.est` root and tokens
`--chord`, `--ink`, `--default-dot`, `--accent-soft` (the tappable chord bg),
`--unsaved`/`--unsaved-soft` (the only-here warning), `--conflict` (the
non-chord-tone badge); classes `.chip.accent`, `.seg`/`.seg button.on`,
`.scrim`/`.sheet`/`.grip`, `.notice.unsaved`/`.notice.conflict`, `.row.explore`,
`.shapes`, and `.mark-tap .c` (`:241`, the tappable-chord affordance).
[`README.md`](../../docs/mockups/README.md) "Decisions the drawings carry":
proportional chart (`:24`); a diagram up the neck shows the fret number alone
(`:25`); defaults hollow, your shapes in chord colour, the song's own in ink,
and **every status carries a word, never colour alone** (`:26`).

### The code seams this extends

- Reading surface and composition: `app/src/songs/SongReading.jsx`
  (the `onArrange` seam, the `parse → resolveSongVoicings → <Chart> +
  <ChordDiagram>` composition, the transpose suppression),
  `app/src/songs/reading-view.js` (`chartChordList`, `transposeStatus`),
  `app/src/songs/song-variations.js` (`songVariations`).
- The chart and diagram: `app/src/chart/Chart.jsx` — `markOf(address) =>
  'def'|'conf'|'tap'|null`, non-interactive, its comments already naming
  "arrange mode's tap-to-choose"; `app/src/chart/layout.js` (`chartRows`);
  `app/src/diagram/ChordDiagram.jsx` — `{ fingering, context, kind, size }`,
  `kind` 1:1 with the resolver's `source`.
- The resolver: `app/src/core/voicings.js` — `resolveSongVoicings(parsed,
  instrument, { variation, shapes, ignoreSongVoicings })` (`:145`) →
  `Map<key, { source: 'song'|'yours'|'default', fingering }>` in chart order,
  `unvoiceableKeys(parsed, resolved)` (`:214`), `defaultVoicing`.
- The picker parts: `app/src/music/FingeringGroups.jsx` (`renderAction({
  fingering, starred })` slot), `app/src/music/fingering-groups.js`
  (`groupViewModel`), `app/src/music/EnterShape.jsx`, `app/src/core/search.js`
  (`searchFingerings:344`, `fingeringFromFrets:447`, the `Fingering` typedef).
- The occurrence bridge and plan→text writer: `app/src/core/song-analysis.js`
  (`analyseSong` → `ReadingEntry.occurrence { section, part, line, measure,
  item }`), `app/src/core/voicing-plan/apply.js` (`applyPlan`,
  `planIntoNewVariation`, the thumb `0 → 'T'` re-encoding in `toShape`),
  `app/src/core/fretstring.js` (`shorthandOf`, `parseShorthand`).
- The cifra.md editing ops and writer (in `cifra-md`): `js/src/edit.js`
  (`chooseShapeForOccurrence:198`, `chooseShapeForKey:231`, `clearKey:258`,
  `chooseShapes:283`, `addVariation:362`), `js/src/write.js`
  (`voicingBlocks:338`), both re-exported from `js/src/index.js`.
- The Worker contract: `app/src/worker/protocol.js` (`CommandKind` —
  `OPEN_SOURCE`, `OPEN_SONG`, `SET_VARIATION`, `WRITE {bookId, path, text}`;
  `EventKind` — `SOURCE`, `SONG`), `app/src/worker/useStore.js`
  (`useSlice`, `useWorkerEvent`), `app/src/worker/songs.js`
  (`SET_VARIATION` writes the personal variation-in-use register, not song
  bytes), `app/src/worker/logic.js` (the `handle` switch, the working copy).
- Shell and theme: `app/src/shell/AppShell.jsx` (ephemeral nav `useState` —
  `openSong`, `exploring`, `editing`, `openFile`; its `:327-330` comment names
  arrange as a seam its owning task wires), `app/src/theme/ThemeRoot.jsx`
  (`UNSAFE_PortalProvider` into `.est`), `app/src/App.jsx` (the `#dev/<name>`
  hash mounts).
- Tests: `app/src/a11y/axe.js` (`checkWcag21aa`), `app/src/test/loopback.js`
  (`createLoopbackEndpoint`, `createStore`), `app/vite.config.js` +
  `app/src/test/setup.js`; `e2e/web/lib/axe.js` (`test`/`expect`,
  `analyzeWcag21aa`), `e2e/web/lib/offline.js` (`runOffline`),
  `e2e/web/playwright.config.js` (phone/tablet/computer projects).

### cifra.md spec (current section numbers)

Verified against the current `spec/` in the sibling repository. **Note:**
Workflow 5's prose cites "§8.4" and "§8.7" for the chart and sung-line rules;
those numbers predate a spec renumbering. The current, correct sections are:

- **§7 voicings** ([`spec/7-voicings.md`](/home/ruoso/devel/cifra.md/spec/7-voicings.md)):
  §7.2 block headings (`:38-41`) — `## Voicings: <tuning>` names the default
  variation, `## <name>: <tuning>` a named one; §7.3 variations (do not
  inherit from one another); §7.4 items (`:111-114`) — `- <key>: <fret
  string>` / `- <key>: <fret string> (<fingering>)`; **§7.6** (`:212-233`) — a
  reader MUST NOT fall back from `Cm[2]` to `Cm`, across variations, or across
  tunings; **defaults are never written into the document** (I4).
- **§2.4 chord tokens and footnote markers**
  ([`spec/2-chart.md`](/home/ruoso/devel/cifra.md/spec/2-chart.md) `:98-134`) —
  `[` digits `]` after a symbol; the (symbol, index) pair is the voicing key;
  a reader does not renumber.
- **§8.3 I2** ([`spec/8-normalisation.md`](/home/ruoso/devel/cifra.md/spec/8-normalisation.md)
  `:132-136`) — the canonical writer renumbers footnote indices 1..n from use,
  in the chart and every block, so a chord back to one voicing loses its
  marker; **I4** — defaults are not written. §8.4.5 / §4.5 keep each chord
  over its syllable when a rewritten token changes width (`§8.3 :148-150`).
- **§6.3** ([`spec/6-tunings.md`](/home/ruoso/devel/cifra.md/spec/6-tunings.md)
  `:58-88`) — a capo is a tuning; there is no separate capo field (the *Later*
  feature's basis).
- **§8.5 editing operations** — the five ops arrange calls, implemented in
  `cifra-md` `js/src/edit.js` (above).

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data.** *Central.*
  Arrange composes `cifra-md` (parse, the §8.5 edit ops, `write`) and the
  music core in the view, exactly as reading composes `parse` /
  `resolveSongVoicings`. The Worker owns durability: an arrange choice is
  persisted through the existing `WRITE {bookId, path, text}` command
  (Decision 2); the view never touches IndexedDB, git or the book lock
  (DIRECTION §3.7 `:407-409`).
- **Canonical form over preserving content is the Worker/library's.**
  *Applies.* Arrange hands cifra.md's `write`/`canonical` the mutated model
  and persists its output — it never hand-writes voicing text. §8.3 I2
  renumbering (the `Cm[2]`→`Cm` collapse after "only here" is undone, I3 same-
  shape merge), I4 (no default written), and §8.4.5/§4.5 sung-line relayout
  are the writer's, not arrange's. Arrange must **never pass a computed default
  as if it were a choice** except through the explicit "choose these for every
  unchosen chord" act (§7.6 I4; cifra_js.editing Decision 3).
- **Offline first.** *Central.* Every arrange act — the search for candidate
  shapes, the edit, the canonical write to the working copy — runs on-device;
  nothing waits on the network. Saving and pushing the edit is
  songs.save_sheet's and happens when there is a network; arrange only writes
  the unsaved working copy.
- **Accessibility.** *Central.* Every interactive part is a React Aria
  Component with a full keyboard path: the tappable chords (a focusable group
  — `role="group"`, not `role="list"`, per
  [[role-list-of-rac-buttons-fails-axe]]), the picker sheet/dialog, the
  every/only-here segmented control, the per-shape press targets, the
  enter-a-shape dialog, the variation selector and the add-variation dialog.
  axe at WCAG 2.1 AA on every state. Overlays portal into the `.est` token
  root via `ThemeRoot`'s `UNSAFE_PortalProvider`
  ([[rac-overlays-portal-outside-est-theme-root]]); an open RAC Modal
  aria-hides the surface behind it, so assert the arrange chrome only when no
  overlay is open ([[rac-modal-aria-hides-shell-chrome]]). Status carried by a
  word, never colour alone (mockups README `:26`): *your shape* / *default*
  captions, the only-here warning, the "not in Cm" badge.
- **No song text in logs; fixtures are purpose-written songs.** *Applies.*
  Tests use songs written for the purpose, never anyone's copyrighted words.
- **No book without an account; `noindex`.** *Not applicable* here — arrange
  runs on an already-open local or cloned book; no new request to a hosted
  book.
- **Component boundaries (DIRECTION §3.6).** *Applies.* No code shared with the
  service; `cifra-md` and the music core stay framework-free — arrange's React
  wrappers call them, they know nothing of React.
- **Personal vs song content (§3.2).** *Central to arrange.* A shape chosen
  into the song (every Cm / only here / choose-for-every-unchosen / a new
  variation's blocks) is song content → the book working copy via `WRITE`.
  *Which variation is in use* is personal → the home book via `SET_VARIATION`
  (`app/src/worker/songs.js`). *My shapes* stay in the home book and are only
  ever read here (as the fallback the picker and strip show); arrange does not
  write them, and the picker's "enter a shape"/choose writes into the **song**,
  not the home book (unlike the explorer's star).
- **Arrange writes the written model only.** Arrange is not offered while
  transposed (reading hides the seam); the surface reads and edits at offset 0
  so it writes voicings for the chords as written (Workflow 5 `:26-27`, §7.6).

## Acceptance criteria

### Behavior delivered

1. **Arrange is a mode, entered from reading.** `AppShell` wires
   `<SongReading onArrange=…>` to mount the arrange surface
   (`app/src/songs/SongArrange.jsx`) full-screen over the reading view
   (ephemeral `useState`, no router — mirroring `openSong`/`exploring`);
   **Done** returns to reading with the working copy's unsaved edits intact.
   The appbar shows Back · title · primary **Done** and a `.chip.accent`
   "Arranging · {instrument}". *Pins Workflow 5 `:14-21`; mockup W05 `:30-38`;
   DIRECTION §3.7 `:407-414`.*
2. **Tappable chords, outside-the-mode safety.** In the mode every chord in the
   chart is a focusable press target (`.mark-tap`, a `role="group"` of
   buttons) and the per-chord **Shapes** strip shows each chord's `ChordDiagram`
   with `kind` `song` / `yours` / `default` and its word caption; outside the
   mode (the reading view) a tap only enlarges — an accidental tap never
   changes the song. *Pins Workflow 5 `:14-25`; mockup W05 `:40-57`; chart
   `markOf` 'tap' seam; mockups README `:26`.*
3. **The picker: every Cm or only here.** Pressing a chord opens the picker
   (a bottom sheet on phone, a popover/panel when wide) titled with the chord
   and its location; a `.seg` chooses **Every Cm** or **Only here**; candidate
   shapes come from `searchFingerings`, ranked and grouped by position
   **unchanged** (the view does not re-sort), each pressable with an
   `aria-label` of chord + shorthand. Choosing with **Every Cm** calls
   `chooseShapeForKey`; with **Only here** calls `chooseShapeForOccurrence`
   (the occurrence from the tapped address via `analyseSong`). When **Only
   here** is selected the `.notice.unsaved` warning is shown *before* a shape
   is chosen — the "says so first" — explaining it marks the chart for everyone
   and that other instruments show their default until someone chooses. The
   result is run through cifra.md `write` and persisted via `WRITE`; the chart
   and strip re-render with the new choice. *Pins Workflow 5 `:29-49`; mockup
   W05 `:67-115`; cifra.md §7.4, §7.6, §2.4, §8.3 I2.*
4. **Enter a shape by hand.** The picker's **Enter a shape** row opens
   `EnterShape`, reused with its primary action configured to **Choose this
   shape** (not the explorer's star); frets built by tapping strings, previewed
   with `fingeringFromFrets`, a non-chord-tone shown with a "not in Cm" badge
   and a `.notice.conflict` that still permits the shape; **Choose this shape**
   writes it with the picker's current every/only-here scope. *Pins Workflow 5
   `:30-31`; mockup W05 `:120-160`; `fingeringFromFrets`.*
5. **Choose these for every unchosen chord.** The full-width button writes, in
   one §8.5.4 `chooseShapes` pass, the shape each unchosen chord currently
   shows (its *your shape* or *default* fallback from the resolver) into the
   block for this tuning and variation — the only way *my shapes* and the app's
   defaults become song choices. *Pins Workflow 5 `:52-61`; mockup W05 `:58`;
   cifra.md §8.5.4, §7.6 I4.*
6. **Variations.** A **Variations** control adds a variation (empty or a copy
   of the one in use) via `addVariation`; a name already used is refused with
   an inline field error (a word); the new variation is written to the song and
   then set in use via `SET_VARIATION` so subsequent choices land in it; the
   selector appears above the shapes only when the tuning has more than one
   variation (`songVariations`). *Pins Workflow 5 `:75-85`; mockup W05
   `:200-203, :224`; cifra.md §7.2–7.3, §8.5.5; DIRECTION §3.2.*
7. **Every change is an ordinary unsaved edit.** Each choice persists through
   `WRITE` to the working copy, shows as unsaved, and is saved or discarded by
   the normal save sheet (songs.save_sheet) — arrange renders no Save of its
   own. Sync merges incoming changes under the unsaved edit (DIRECTION §3.1).
   *Pins Workflow 5 `:11-12`; DIRECTION §3.1 `:127-131`; §4 `:454-457`.*
8. **Run the wizard is a seam.** A **Run the wizard** affordance raises an
   `onRunWizard` callback whose destination is songs.wizard_ui; arrange renders
   the button, not the planner flow. *Pins Workflow 5 `:64-72`; mockup W05
   `:61`; the affordance-vs-action seam boundary.*

### Tests the task lands with, by level

Fixtures are purpose-written songs, never anyone's copyrighted words. The
behavior view tests render under `<ThemeRoot store={store}>` (so RAC overlays
portal into `.est`) against a loopback-backed store seeded with
`PREFERENCES`/`SHELF`/`INSTRUMENTS`/`SOURCE`/`SONG` slices, with
`checkWcag21aa(container)` over each state. No CodeMirror stub is needed — the
arrange surface is chart + diagrams, not an editor.

- **unit** — `app/src/songs/arrange-choices.test.js` (pure helpers, co-located,
  added per the testing policy since arrange's choice-building logic is pure
  and warrants it):
  - *occurrenceAt* — a tapped chart address maps to the §8.5 occurrence
    `{ section, part, line, measure, item }` of that chord. *Pins
    `analyseSong` occurrence; cifra.md §8.5.1 input.*
  - *unchosenPlan* — from a parsed song + the resolver's map, builds the
    `{ occurrence, shape }[]` for every occurrence of every chord whose
    `source` is `yours` or `default`, at its shown fingering, and omits
    `song`-sourced and unvoiceable chords; the shape encodes thumb `0 → 'T'`.
    *Pins Workflow 5 `:52-61`; cifra.md §8.5.4.*
  - *toShape* — a `Fingering` becomes the `{ frets, fingers }` model shape the
    §8.5 ops expect. *Pins cifra_js.editing shape input.*
- **behavior** — `app/src/songs/SongArrange.behavior.test.jsx` (real RAC + i18n,
  loopback store, axe over `container`):
  - *Tappable chords and the strip* — arrange mode renders the chord group as
    focusable buttons and the Shapes strip with `song`/`yours`/`default`
    diagrams and their word captions; axe clean. *Pins Workflow 5 `:22-25`;
    mockup W05 `:40-57`.*
  - *Every Cm* — choosing a shape with Every Cm sends `WRITE` whose text, when
    reparsed, has `- Cm: <shape>` in the tuning's default block for every `Cm`.
    *Pins Workflow 5 `:37-41`; cifra.md §8.5.2, §7.4.*
  - *Only here* — Only here shows the shared-chart `.notice.unsaved` before
    acting, and choosing marks that one occurrence `Cm[2]` in the chart and
    writes its block entry, leaving the other `Cm`s unchosen. *Pins Workflow 5
    `:43-49`; cifra.md §8.5.1, §2.4, §7.6.*
  - *A shape by hand* — Enter a shape opens `EnterShape` with the **Choose this
    shape** action; a shape with a non-chord tone shows the "not in Cm" badge
    and still chooses; axe clean over the open dialog. *Pins Workflow 5
    `:30-31`; mockup W05 `:120-160`.*
  - *Choose these for every unchosen chord* — one press writes every unchosen
    chord's shown shape into the block; a `song`-sourced chord is untouched.
    *Pins Workflow 5 `:52-61`; cifra.md §8.5.4.*
  - *Variations* — adding a variation with a fresh name writes a new block and
    switches to it (`SET_VARIATION`); a used name is refused inline; the
    selector hides when only one variation exists. *Pins Workflow 5 `:75-85`;
    cifra.md §8.5.5.*
  - *A keyboard path through the picker* — Tab/arrow to a chord, open the picker
    by keyboard, move the every/only-here segment and the candidate shapes, and
    choose — all without a pointer; focus returns to the chord on close. *Pins
    the `.tji` "a keyboard path through the picker"; DIRECTION §3.7 `:399-401`.*
- **e2e-web** — `e2e/web/tests/arrange.spec.js` (compose stack, phone/tablet/
  computer projects, axe WCAG 2.1 AA; the song seeded via the example book):
  - *Arrange a song for guitar on the three viewports* — open a song, enter
    arrange, tap a chord, choose a shape (Every Cm), see the chart and strip
    update to the chosen shape; axe on the arrange screen and the open picker.
    *Pins Workflow 5 `:14-41`; the `.tji` e2e clause.*
  - *Only here and enter a shape* — Only here shows the warning and marks the
    chart; Enter a shape chooses a hand-built shape; axe over the dialog.
    *Pins Workflow 5 `:43-49`, `:30-31`.*
  - *Keyboard only on the computer* — the whole arrange journey (focus a chord,
    open the picker, choose) by keyboard on the computer viewport. *Pins the
    `.tji` "keyboard only on the computer".*
  - *A new variation* — add a variation, name it, select it, choose a shape
    into it; the selector appears once there are two. *Pins Workflow 5
    `:75-85`; the `.tji` "a new variation".*
  - *Offline* — with the network cut (`runOffline`), arrange still lets the
    user choose a shape and the edit persists to the working copy (save/push is
    save_sheet's). *Pins offline-first (DIRECTION §3.1); standing rule.*

### Deferred work (closer registers in the WBS)

**None.** Arrange creates no new WBS leaf:

- The wizard *run* is **songs.wizard_ui** — an existing M2 leaf
  (`depends !arrange, music.wizard`); arrange only raises its `onRunWizard`
  seam (Decision 9).
- **Starting from a nearby tuning, and the capo** are Workflow 5 *§Later*
  (`:96-102`) — a genuinely new, not-yet-designed capability (an offer to
  adapt a neighbouring tuning's shapes, alongside first-class capo support). It
  needs a design decision before implementation and is tracked in the workflow,
  not spun into an under-specified leaf here; surfaced in the return summary
  for the parking lot.
- The extensions to carried components — an opt-in press seam on `Chart`
  (Decision 3) and a configurable primary action on `EnterShape` (Decision 6)
  — are **part of this task**, not deferred: both were anticipated by their own
  refinements as arrange's reuse. No "add tests" leaf exists; the tests above
  land with the work.

## Decisions

1. **Arrange is its own surface (`SongArrange.jsx`), mounted from reading's
   `onArrange` seam — not a flag inside `SongReading`.** *Chosen:* a dedicated
   full-screen surface that `AppShell` mounts over reading, reusing reading's
   composition (`parse → resolveSongVoicings → <Chart> + <ChordDiagram>`) by
   importing the same pure helpers. *Rationale:* the reading refinement already
   designed `onArrange` as a callback to a sibling's destination (the
   affordance-vs-action boundary every songs refinement keeps), the mockup's
   arrange screens have their own appbar with a **Done** primary, and folding a
   second full mode into `SongReading` would balloon it. *Rejected:* an
   `arranging` boolean inside `SongReading` — it would entangle two modes'
   state and overlays in one component and break the established seam.
2. **Choices persist through the existing `WRITE` command, composed in the
   view; no new Worker command.** *Chosen:* on each choice the view parses the
   working text, applies the relevant §8.5 op from `cifra-md`, runs
   `write`/`canonical`, and sends `WRITE {bookId, path, text}` — the same
   persistence the source editor uses; the arrange view holds the current text
   in local state seeded from the `source` slice and re-renders from it.
   *Rationale:* the §8.5 ops and the writer are framework-free and already
   callable in the view (DIRECTION §3.7 `:415-417`), `WRITE` already persists
   working-copy text as unsaved, and this keeps "the view composes the core,
   the Worker owns durability" without a redundant seam. *Rejected:* a
   structured `APPLY_VOICING`/`ARRANGE` Worker command carrying the occurrence
   and shape — it would duplicate the compose-then-write path the editor
   already proves, and move music-core logic into the Worker against the §3.7
   split, for no durability gain.
3. **The chart's chords become press targets via an opt-in interactive seam on
   `Chart`; the default stays non-interactive.** *Chosen:* `Chart` gains an
   optional `onChordPress(address)` (the address carrying `{ section, part,
   line, measure, item }` so the occurrence is identified), rendering each
   chord token as a keyboard-reachable button inside a `role="group"` only when
   the callback is given; absent, the chart renders exactly as today.
   *Rationale:* the picker opens "from one bar" with a per-occurrence meta
   ("Primeira Parte, bar 3"), so per-chord hit targets with a keyboard path are
   required; `Chart`'s own comments already reserve "tap-to-choose" for the
   arrange surface, so this is the anticipated extension, not a chart redesign
   (no design delta). *Rejected:* overlaying invisible hit areas over the chart
   geometry (fragile against relayout, poor for keyboard/AT); a chord list
   beside the chart as the only tap target (contradicts the mockup's in-chart
   tap and the per-occurrence "only here").
4. **"Only here" warns inline, the moment it is selected — no extra confirm
   modal.** *Chosen:* selecting **Only here** reveals the `.notice.unsaved`
   shared-chart warning in the picker before any shape is chosen; choosing a
   shape then acts. *Rationale:* Workflow 5 requires it "says so before it
   acts" (`:43-45`) and the mockup draws exactly this inline notice (`:96-99`);
   a second confirm dialog would be a redundant gate and a focus trap over the
   picker. *Rejected:* a separate "are you sure?" dialog after choosing.
5. **"Choose these for every unchosen chord" is one §8.5.4 `chooseShapes`
   pass.** *Chosen:* build a plan of every occurrence of every unchosen key at
   its shown fallback shape and call `chooseShapes` once; canonical `write`
   then collapses same-shape indices to key-level entries (§8.3 I3).
   *Rationale:* cifra_js.editing explicitly prescribes the batch op for this
   verb ("do not loop §8.5.1"), and it matches `apply.js`'s `applyPlan`.
   *Rejected:* looping `chooseShapeForKey`/`chooseShapeForOccurrence` per chord
   — slower, and risks intermediate footnote churn before canonicalisation.
6. **The picker reuses `FingeringGroups` (ranking/grouping untouched) and
   `EnterShape` (with a configurable primary action).** *Chosen:*
   `FingeringGroups`'s `renderAction` slot renders each candidate as a
   pressable "choose" target (labelled chord + shorthand, as the mockup's
   `aria-label`s); `EnterShape` gains a configurable primary action so the
   explorer passes its star and arrange passes **Choose this shape**.
   *Rationale:* music.explorer built both as shared components naming
   songs.arrange as a consumer, and the recurring decision is that ranking/
   grouping stay in the carried core — the view must not re-sort. *Rejected:*
   a second shape-list component for arrange (ordering would drift from the
   explorer's).
7. **A new variation is written to the song, then set in use.** *Chosen:*
   `addVariation` (empty or a copy of the one in use) writes the block to the
   working copy via `WRITE`; a name already present throws and is caught into
   an inline field error; `SET_VARIATION` then switches the personal
   variation-in-use so subsequent choices land in the new block. *Rationale:*
   the variation's blocks are song content (§7.3) while *which* is in use is
   personal (§3.2) — the two writes are to different stores by design.
   *Rejected:* treating a variation purely as personal state (it is authored,
   shared content).
8. **Arrange reads and writes the written model at offset 0.** *Chosen:* the
   surface ignores transposition; reading already suppresses the `onArrange`
   seam while transposed, and if entered the surface reads at offset 0.
   *Rationale:* a voicing is for the chord as written, and §7.6 forbids a
   transposed spelling's shapes standing in. *Rejected:* arranging a transposed
   view (would write voicings against symbols that are not in the song).
9. **"Run the wizard" is an affordance seam owned by songs.wizard_ui.**
   *Chosen:* arrange renders the button and raises `onRunWizard`; the planner
   flow (into a new variation first, over this one second) is wizard_ui.
   *Rationale:* the WBS already splits `wizard_ui` out (`depends !arrange,
   music.wizard`), and the affordance-vs-action seam is the house pattern.
   *Rejected:* building the wizard run here (it would absorb a separately-
   estimated task and its `music.wizard` dependency).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- Created `app/src/songs/SongArrange.jsx` — the full-screen arrange surface, mounted from `AppShell`'s `onArrange` seam; appbar with Back · title · primary Done, accent chip "Arranging · {instrument}", tappable chart via opt-in `onChordPress`, per-chord Shapes strip, "Choose these for every unchosen chord" button, Variations control, Run the wizard seam.
- Created `app/src/songs/arrange-choices.js` — pure helpers: `occurrenceAt`, `unchosenPlan`, `toShape` (§8.5 occurrence and plan builders).
- Created `app/src/songs/arrange-choices.test.js` — 5 unit tests covering `occurrenceAt`, `unchosenPlan`, `toShape`.
- Created `app/src/songs/SongArrange.behavior.test.jsx` — 8 behavior tests (tappable chords + strip + axe; every Cm; only here + warning; enter a shape + axe; choose every unchosen; variations; keyboard path).
- Created `app/src/songs/ArrangeDev.jsx` — `#dev/arrange` dev mount.
- Created `app/src/songs/arrange.css` — arrange sheet styles with viewport-capped scroll.
- Created `e2e/web/tests/arrange.spec.js` — 5 e2e-web tests (three viewports: arrange for guitar, only-here+enter-a-shape, keyboard-only on computer, new variation, offline).
- Edited `app/src/chart/Chart.jsx` and `app/src/chart/layout.js` — opt-in `onChordPress(address)` seam, per-chord occurrence tokens; new occurrence-token assertions added to `app/src/chart/layout.test.js`.
- Edited `app/src/music/EnterShape.jsx` — configurable primary action (explorer star vs. arrange "Choose this shape"); fret-cell CSS in `app/src/music/music.css` to un-clip RAC's VisuallyHidden `<input>` (`.enter-shape-fret > span` lift).
- Edited `app/src/shell/AppShell.jsx` — wires `<SongReading onArrange=…>` to mount `SongArrange`.
- Edited `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — `arrange.*` i18n section (i18n parity across all four locales).
- Edited `app/src/App.jsx` — `#dev/arrange` hash mount.
