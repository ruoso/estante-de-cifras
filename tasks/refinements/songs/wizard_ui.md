# songs.wizard_ui — The wizard in a song

## TaskJuggler entry

Defined in [`tasks/60-songs.tji`](../../60-songs.tji) (`task wizard_ui`, line 64),
under the parent cascade

```
task songs depends shell.layout, shell.chart, foundation.e2e_web
  task wizard_ui depends !arrange, music.wizard
```

> "Into a new variation first, over this one second. Workflow 5. Tests:
> behavior (into a new variation first, over this one second; axe); e2e-web
> (the wizard run in a song and its variation read back; axe)."

## Effort estimate

**1d** (as scoped in the `.tji`), `allocate team`. Roughly: the two-step wizard
surface — the policy chooser (the planners that apply to this instrument, each
with "How it works" and its citations, and the choro's one stylistic question)
and the in-memory preview — mounted from arrange's `onRunWizard` seam (~0.4d);
the *into a new variation first / over this one second* branch, the
variation-name field and the write through the music core's plan→variation
writer (~0.3d); the unit, behavior and e2e-web suites with axe (~0.3d).

## Repository

**estante-de-cifras** only. Touched directories:

- `app/src/songs/` — the wizard surface (`SongWizard.jsx`), its one pure helper,
  its dev mount.
- `app/src/shell/` — `AppShell` wires arrange's `onRunWizard` seam to mount the
  wizard.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the song-side keys the
  wizard adds to the already-prepared `wizard.*` section (the *new variation /
  over this one / plan-ready / variation-name* copy), with parity across all
  four locales.
- `app/src/App.jsx` — the `#dev/wizard` hash mount.
- `e2e/web/tests/` — the wizard journey.

**Not a `cifra.md:` task.** The wizard run lands entirely in the app. It
*consumes* the pure voicing-wizard engine (`app/src/core/voicing-plan/`,
`music.wizard`) and, through it, the cifra.md for-JavaScript library
(`cifra-md`) — its parser, its §8.5 editing operations and its canonical writer
— but writes no spec, reference or corpus. The app and the service share no
code; the music core and `cifra-md` are framework-free below the view
(DIRECTION §3.6 `:288`, §3.7 `:415-417`). The planners, the plan→variation
writers and the §8.5 operations shipped in `music.wizard` / `cifra_js.editing`
(see below); the wizard screen only drives them.

## Inherited dependencies

All **settled** — every declared and cascaded dependency is `complete 100`:

- **songs.arrange** — *settled, Done 2026-10-07*
  ([`arrange.md`](arrange.md)). The wizard is the *action* behind arrange's
  **Run the wizard** affordance. Arrange already renders the button and raises
  **`onRunWizard({ bookId, path })`** (`app/src/songs/SongArrange.jsx:91,:382`),
  which `AppShell` leaves unwired (`app/src/shell/AppShell.jsx:333-343`, its
  comment naming this task). The wizard reuses arrange's whole composition and
  persistence verbatim: the song brought in with `OPEN_SOURCE` / `OPEN_SONG`,
  the written model at offset 0 from `parse(text, dialect)`, the instrument via
  `inUseEntry` / `instrumentInstance` / `openMidis`
  (`tuningId` = the §6.3 identity for `SET_VARIATION`, `tuningText` =
  `entry.tuning` for the §8.5 ops), the in-use variation from the `song` slice
  (`reading.variations?.[tuningId]`), `songVariations(model, tuningId)`
  (`app/src/core/song-variations.js`), `resolveSongVoicings`
  (`app/src/core/voicings.js:145`), and the `persist(doc)` → `WRITE {bookId,
  path, text}` + `SET_VARIATION` pattern (arrange Decisions 2, 7).
- **music.wizard** — *settled, Done 2026-10-07*
  ([`../music/wizard.md`](../music/wizard.md)). The pure engine the wizard
  drives, all framework-free (`app/src/core/`):
  - `PLANNERS` (`voicing-plan/index.js:70`) — the three policies `smoothest`,
    `openPosition`, `choroCentro`; each `{ id, sources, appliesTo?, options?,
    plan }`. `plannersFor(instrument)` (`:266`) filters by `appliesTo`
    (`choroCentro` needs `stringCount ≥ 5`); `optionDefaults(planner)` (`:271`)
    seeds the stylistic radiogroup; `plannerById(id)` (`:261`).
  - `planVoicings(plannerId, song, instrument, { dialect, existing, choices })`
    (`:291`) → `{ planner, reading, shapes: Map<at,(number|'x')[]>, missing:
    number[], unchanged: number[] }`. `existing` is `Map<key,(number|'x')[]>`
    (the song's current choices, so the preview can report `unchanged`).
  - The plan→variation writers (`voicing-plan/apply.js`), each returning the
    **mutated cifra.md model** — the caller runs `write`:
    `planIntoNewVariation(doc, planResult, { tuning, name, copyFrom? })`
    (`:93`, the primary "new variation first" path; `addVariation` **throws** if
    a block for that tuning+name already exists) and `applyPlan(doc, planResult,
    { tuning, variation = '' })` (`:74`, the "over this one" path).
  - The citation bibliography `SOURCES` (`app/src/data/sources.js`), the ids a
    planner's `sources` point into; and the already-prepared `wizard.*` i18n
    block (the policy names, texts, "how it works" steps and the choro's
    stylistic-option prose) in all four locales (`app/src/i18n/locales/*.js`,
    e.g. `en.js:899-1014`).

Transitively settled seams the wizard leans on (through arrange and the
engine): `analyseSong(doc, dialect)` whose `ReadingEntry.occurrence = { section,
part, line, measure, item }` is the §8.5 occurrence path
(`app/src/core/song-analysis.js`); the three-level resolver and `defaultVoicing`
(`app/src/core/voicings.js`, music.fallback); and the Worker contract
(`WRITE`, `SET_VARIATION`, `OPEN_SOURCE`, `OPEN_SONG`, the `source` / `song`
slices — `app/src/worker/protocol.js`, `useStore.js`, `songs.js`).

No pending blocking dependencies — every direct and transitive dependency is
Done.

## What this task is

*Run the wizard*, in the arrange surface, opens a wizard that chooses a shape
for every chord in the song at once (docs/DESIGN.md §2.10, Workflow 5 §The
wizard). It is **two steps**: choose a policy — the planners that make sense on
this instrument (the smoothest path, down at the nut, and, on an instrument with
strings to spare, choro beside a seven-string), each shown with *How it works*
and the works it cites, and the choro's one stylistic question — then see the
shapes it would choose, as the diagrams and "voiced as" labels the song will
carry, before anything changes. Accepting writes the plan into the working copy
like any other edit. Because a variation keeps a plan beside an existing
arrangement rather than over it, **when the variation in use already has choices
the wizard offers *into a new variation* first (named, a used name refused) and
*over this one* second**; when the in-use variation has no choices yet, the plan
is written straight into it with no question. Either way the result is an
ordinary unsaved working-copy edit (workflow 4): it shows as unsaved and is
saved or discarded by the normal save sheet. The wizard is reached only from the
arrange surface, which is not offered while the song is transposed — so it plans
for the chords as written.

## Why it needs to be done

The wizard is the reason the planner engine was built, and it is the last piece
of *arrange for an instrument* that M2 (`m2_local`,
[`tasks/99-milestones.tji`](../../99-milestones.tji)) promises. Arrange shipped
the **Run the wizard** button and raised `onRunWizard`, but `AppShell` left it
unwired — a dead-end this task opens (arrange Decision 9; `AppShell.jsx:333-334`
names it). The pure engine (`music.wizard`) is complete and tested but has no
caller in the running app; this screen is its first and only one. Downstream,
the plan the wizard writes is an arrange edit like any other: the musical diff
and save sheet (songs.save_sheet) already render "added voicings for …" from it
(DIRECTION §4 `:454-457`). Nothing else blocks on the wizard, but M2's arrange
story cannot close without it.

## Inputs / context

### Governing design

- **Workflow 5 — Arrange for an instrument**
  ([`docs/workflows/05-arrange-for-an-instrument.md`](../../docs/workflows/05-arrange-for-an-instrument.md)),
  status *decided*. The normative source. §The wizard (`:64-72`): *Run the
  wizard* plans the whole song at once, "with the planners and questions Explore
  Chords' wizard had (its DESIGN §2.10)"; its plan "is written into the working
  copy like any other edit: the save sheet shows what it chose, and discard
  undoes it"; and — the sentence this task turns into UI — "when the variation
  in use already has choices, the wizard offers **into a new variation** first,
  and *over this one* second" (`:70-72`). §Variations (`:75-85`): a new variation
  starts empty or as a copy of the one in use, a used name is refused, the
  selector appears only when a tuning has more than one. §Someone else's song
  (`:87-94`): nothing is different while arranging; the wizard writing a block
  for a tuning the author does not play merges back cleanly. Every change is an
  ordinary unsaved edit (`:11-12`).
- **docs/DESIGN.md §2.10 The voicing wizard**
  ([`app/src/core/DESIGN.md`](../../app/src/core/DESIGN.md) `:47-62`) — the
  carried design the engine implements and this screen presents. "A button above
  the chart … opens a wizard. It is two steps. Choose a policy, see the shapes it
  would choose, then accept them." A one-click rewrite "would be something you
  undo rather than something you use, and the preview shows the same diagram and
  the same 'voiced as' label (§6.2) the song will carry, so it is the thing
  itself rather than a description of it." `appliesTo` keeps a planner off an
  instrument it makes no sense on.
- **DIRECTION** ([`docs/DIRECTION.md`](../../docs/DIRECTION.md)):
  - §3.2 `:136-151` — **the split the wizard straddles.** A new variation's
    blocks and the shapes the plan writes are **shared authored content** (via
    `WRITE`); *which variation is in use* is **personal state** in the home book
    (via `SET_VARIATION`), committed automatically, never pushed.
  - §3.6 `:277-392` — the app is the view; `cifra-md` and the music core are
    framework-free; the app and service share no code (`:288`).
  - §3.7 `:394-434` — React Aria Components (`:399-401`); `theme.css` the visual
    authority (`:404-405`); the Worker owns git, the working copy and the index,
    the main thread never touches IndexedDB (`:407-409`); the view reads slices
    through `useSyncExternalStore` (`:410-414`); framework-free below the view
    (`:415-417`).
  - §4 `:436-458` — history shows "added voicings for G4 C4 E4 A4" and a default
    save message drawn from the musical diff (`:454-457`); the plan the wizard
    writes is exactly such an edit.

### The mockup (what the drawings decide)

[`docs/mockups/W05-arrange.dc.html`](../../docs/mockups/W05-arrange.dc.html),
drawn on two phones, a tablet and a computer. The wizard entry is the arrange
footer's **"Run the wizard"** button (`:61`). The wizard's own pane is the
**computer** drawing, subtitled "the wizard's plan, offered into a new variation
first" (`:164-231`) — arrange's refinement flags this pane as *songs.wizard_ui's*
(arrange `:221-222`). Real copy and states:

- A side pane `Voicing wizard` / **"The plan is ready"** with the prompt
  "Voicings already has shapes chosen in this song. Put the plan beside them, or
  over them?" (`:167-170`).
- Two radio cards: **"Into a new variation"** — selected first, with a **Name**
  field prefilled ("Up the neck") and the sub-label "Voicings stays as it is"
  (`:171-180`); and **"Over Voicings"** second, "Replaces what is chosen there"
  (`:181-186`).
- The reassurance "Either way it is an edit in the working copy: the save sheet
  shows what it chose, and discard undoes it." (`:187`), and actions **"Back"** /
  primary **"Write the plan"** (`:188-191`).
- The arrange main beside it shows the result: the variation selector gains the
  new label ("Voicings" / "Up the neck" / "+ New variation", `:200-203`) with the
  note "The selector shows only when guitar has more than one variation in this
  song." (`:224`), and the chosen shapes previewed (`:216-225`). The selector
  row itself is arrange's (arrange AC 6); the wizard's job is to produce the
  variation it then shows.

Component and token references:
[`theme.css`](../../docs/mockups/theme.css) — the `.card.pad` option cards with
`--accent` / `--accent-soft` for the selected one, the `.check`/`.check.on`
radio marks, the `.field` / `.input` name field, the `.seg` variation selector,
`.actions`. [`README.md`](../../docs/mockups/README.md) "Decisions the drawings
carry": every status carries a word, never colour alone (`:26`) — the selected
option, the name-taken error.

### The code seams this extends

- The arrange surface and seam: `app/src/songs/SongArrange.jsx` — the
  `onRunWizard` prop (`:91`) raised by the footer button (`:382-384`); the
  `persist(doc)` → `WRITE` path (`:175-185`); `selectVariation(next)` →
  `SET_VARIATION` (`:217-226`, `LOCAL_IDENTITY` `:65`); the tuning pair
  (`tuningId` / `tuningText`, `:142-147`); `submitAddVar`'s refuse-on-duplicate
  pattern (`:239-258`); its two controlled `ModalOverlay`/`Modal`/`Dialog`
  overlays (`:393-503`) as the RAC overlay template.
- The shell: `app/src/shell/AppShell.jsx` — the ephemeral nav `useState`
  (`arranging` `:203`, mounted `:335-345`, checked before `openSong`); this task
  adds the wizard destination for `onRunWizard` in the same style.
- The pure engine: `app/src/core/voicing-plan/index.js` (`PLANNERS:70`,
  `plannersFor:266`, `optionDefaults:271`, `planVoicings:291`),
  `app/src/core/voicing-plan/apply.js` (`planIntoNewVariation:93`,
  `applyPlan:74`, the thumb `0 → 'T'` re-encoding), `app/src/core/song-analysis.js`
  (`analyseSong`), `app/src/core/song-variations.js` (`songVariations`),
  `app/src/core/voicings.js` (`resolveSongVoicings:145` — the source of the
  `existing` map and of "does the in-use variation have choices").
- The data and copy: `app/src/data/sources.js` (`SOURCES`), the prepared
  `wizard.*` i18n (`app/src/i18n/locales/*.js`, e.g. `en.js:899-1014`:
  `open`, `title`, `help`, `planners.*.{name,text,how}`,
  `planners.choroCentro.options.whenNoThirdAbove.*`, `summary`, `covers`,
  `nothing`, `missing`, `how`, `howTitle`, `sources`, `noSources`, `apply`,
  `back`, `cancel`).
- The cifra.md ops and writer (through the engine, in `cifra-md`):
  `js/src/edit.js` (`chooseShapes:283`, `addVariation:362`), `js/src/write.js`
  (`write:413`, `canonical:175`, `isCanonical:422`), re-exported from
  `js/src/index.js`.
- The Worker contract: `app/src/worker/protocol.js` (`CommandKind.WRITE`,
  `SET_VARIATION`, `OPEN_SOURCE`, `OPEN_SONG`; `EventKind.SOURCE`, `SONG`),
  `app/src/worker/useStore.js` (`useSlice`), `app/src/worker/songs.js`
  (`SET_VARIATION` writes the personal register, not song bytes).
- Shell and theme: `app/src/theme/ThemeRoot.jsx` (`UNSAFE_PortalProvider` into
  `.est`), `app/src/App.jsx` (the `#dev/<name>` hash mounts).
- Tests: `app/src/a11y/axe.js` (`checkWcag21aa`), `app/src/test/loopback.js`
  (`createLoopbackEndpoint`), `app/src/worker/store.js` (`createStore`);
  `app/src/songs/SongArrange.behavior.test.jsx` as the loopback-store +
  `ThemeRoot` + reparse-the-WRITE template; `e2e/web/lib/axe.js`
  (`analyzeWcag21aa`), `e2e/web/lib/offline.js` (`runOffline`),
  `e2e/web/playwright.config.js` (phone/tablet/computer projects).

### cifra.md spec (behaviour the engine mirrors, not code to translate)

Consumed through the engine, so lighter than arrange's. The current section
numbers (verified against the sibling `spec/`):

- **§8.5.4 `chooseShapes`** and **§8.5.5 `addVariation`**
  ([`spec/8-normalisation.md`](/home/ruoso/devel/cifra.md/spec/8-normalisation.md))
  — the batch write and new-block ops the plan→variation writers call;
  `addVariation` refuses a tuning+name already present.
- **§7.3 variations** ([`spec/7-voicings.md`](/home/ruoso/devel/cifra.md/spec/7-voicings.md))
  — variations do not inherit, so writing into a new variation leaves the
  default and the previously in-use variation untouched.
- **§7.6 / I4** — defaults are never written: a chord the planner could not
  voice (`planResult.missing`) is left out of the plan and falls back on read,
  never persisted.
- **§8.3 I2/I3** — the canonical writer renumbers footnote indices and merges
  same-shape entries; the wizard hands the writer the mutated model and persists
  its output, never hand-writing voicing text.

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data.** *Central.*
  The wizard composes the pure engine and `cifra-md` in the view and persists
  through the existing `WRITE {bookId, path, text}` command (Decision 4); the
  view never touches IndexedDB, git or the book lock (DIRECTION §3.7
  `:407-409`). *Which variation is in use* is set through `SET_VARIATION`
  (personal state), as arrange does.
- **Nothing is written until the user accepts.** *Central to this task.* The
  two-step design (DESIGN §2.10) requires the plan to be *previewed* — computed
  in memory and rendered as diagrams — with nothing persisted until **Write the
  plan** (Decision 2). The preview must not write a provisional block.
- **Canonical form over preserving content is the library's.** *Applies.* The
  engine returns the mutated model; the wizard runs cifra.md `write` and
  persists its output. §7.6/I4 (missing chords unwritten), §8.3 renumbering and
  same-shape merging are the writer's, not the wizard's.
- **Offline first.** *Central.* Every wizard act — reading the song, planning,
  rendering the preview, and the canonical write to the working copy — runs
  on-device; nothing waits on the network. Saving and pushing the plan is
  songs.save_sheet's and happens when there is a network; the wizard only writes
  the unsaved working copy.
- **Accessibility.** *Central.* Every interactive part is a React Aria Component
  with a full keyboard path: the policy list (a focusable group of options), the
  choro's stylistic radiogroup, the *How it works* / citations disclosure, the
  preview, the **into a new variation / over this one** choice (a `radiogroup`,
  not a list of buttons — [[role-list-of-rac-buttons-fails-axe]]), the variation
  **Name** field, and **Back** / **Write the plan**. axe at WCAG 2.1 AA on every
  state. Overlays portal into the `.est` token root via `ThemeRoot`'s
  `UNSAFE_PortalProvider` ([[rac-overlays-portal-outside-est-theme-root]]); an
  open RAC Modal aria-hides the surface behind it, so assert the arrange chrome
  only when no overlay is open ([[rac-modal-aria-hides-shell-chrome]]). Status
  by a word, never colour alone (mockups README `:26`): the selected policy and
  option, the name-taken error.
- **No song text in logs; fixtures are purpose-written songs.** *Applies.*
  Tests use songs written for the purpose, never anyone's copyrighted words.
- **No book without an account; `noindex`.** *Not applicable* — the wizard runs
  on an already-open local or cloned book; no new request to a hosted book.
- **Component boundaries (DIRECTION §3.6).** *Applies.* No code shared with the
  service; the engine, `cifra-md` and the music core stay framework-free — the
  wizard's React wrappers call them, they know nothing of React.
- **Personal vs song content (§3.2).** *Central.* A new variation's blocks and
  the plan's shapes are song content → `WRITE`; *which variation is in use* is
  personal → `SET_VARIATION`. The wizard writes *my shapes* nowhere; it plans
  from the search and the song, not the home book's shapes.
- **The wizard plans the written model only.** It is reached only from arrange,
  which reading suppresses while transposed; the wizard reads the song at offset
  0 and writes voicings for the chords as written (Workflow 5 `:26-27`, §7.6).

## Acceptance criteria

### Behavior delivered

1. **The wizard is reached from Run the wizard, as the action behind arrange's
   affordance.** `AppShell` wires arrange's `onRunWizard({ bookId, path })` to
   mount the wizard surface (`app/src/songs/SongWizard.jsx`) over the arrange
   surface (ephemeral `useState`, no router — mirroring `arranging`/`openSong`):
   a full surface on the phone, the mockup's side pane beside the arrange main
   when wide. Closing (**Back**, or after **Write the plan**) returns to arrange
   with the working copy's unsaved edits intact. *Pins Workflow 5 `:64`; DESIGN
   §2.10 `:54-56`; mockup W05 `:61,:164-231`; the affordance-vs-action seam.*
2. **Step one — choose a policy.** The policy list is `plannersFor(instrument)`,
   so *Choro, beside a seven-string* appears only on an instrument with
   `stringCount ≥ 5`; each policy shows its `name` and `text`, a **How it
   works** disclosure of its `how` steps, and **Where this comes from** — the
   works it cites resolved from `SOURCES` (author, title, year), or the
   no-source line for the heuristics. The choro's `whenNoThirdAbove` stylistic
   question is a `radiogroup` seeded from `optionDefaults(planner)`. *Pins DESIGN
   §2.10 `:55,:61,:64-67`; the `.tji` "the planners and questions"; `SOURCES`.*
3. **Step two — preview, written to nothing.** Choosing a policy runs
   `planVoicings(id, model, instrument, { dialect, existing, choices })` and
   previews the result as the same `ChordDiagram`s and "voiced as" labels the
   song will carry — a summary "{n} of {m} chords would change" (from
   `unchanged`), the chords it could not voice named (from `missing`), and
   "every chord already has the shape this would choose" when nothing changes.
   Nothing is persisted at this step. *Pins DESIGN §2.10 `:55-59`; `wizard.*`
   `summary`/`missing`/`nothing`; cifra.md §7.6 I4.*
4. **Into a new variation first, over this one second.** When the in-use
   variation already holds chosen shapes for this tuning, accepting the plan
   offers two options in a `radiogroup` with **Into a new variation** selected
   first — a **Name** field (prefilled, a name already used for this tuning
   refused inline, a word) — and **Over {current variation}** second; when the
   in-use variation has no choices yet, the plan is written straight into it with
   no question. *Pins Workflow 5 `:70-72`; mockup W05 `:167-191`; the `.tji`
   "into a new variation first, over this one second".*
5. **Writing the plan reuses arrange's persistence.** **Write the plan** with
   *into a new variation* calls `planIntoNewVariation(model, result, { tuning:
   tuningText, name, copyFrom })` then `SET_VARIATION` to switch the personal
   register to the new block; with *over this one* calls `applyPlan(model,
   result, { tuning: tuningText, variation })`; the returned model runs through
   cifra.md `write` and persists via `WRITE` as an ordinary unsaved edit. A new
   variation leaves the default and previously in-use variations untouched. *Pins
   Workflow 5 `:66-72`; cifra.md §8.5.4/§8.5.5, §7.3; DIRECTION §3.2
   `:136-151`.*
6. **An ordinary unsaved edit; no Save of its own.** The plan shows as unsaved
   and is saved or discarded by the normal save sheet (songs.save_sheet); the
   wizard renders no Save or push. The musical diff renders "added voicings for
   …" from the wizard's edit like any arrange edit. *Pins Workflow 5 `:11-12,
   :68`; DIRECTION §4 `:454-457`.*

### Tests the task lands with, by level

Fixtures are purpose-written songs, never anyone's copyrighted words. The
behavior view tests render under `<ThemeRoot store={store}>` (so RAC overlays
portal into `.est`) against a loopback-backed store seeded with
`PREFERENCES`/`SHELF`/`INSTRUMENTS`/`SOURCE`/`SONG` slices (the
`SongArrange.behavior.test.jsx` rig), recording every command and verifying
effects by reparsing the recorded `WRITE`'s text; `checkWcag21aa(container)` over
each state. No CodeMirror stub is needed — the wizard is a dialog of policies,
diagrams and a text field.

- **unit** — `app/src/songs/wizard-choices.js` + `app/src/songs/wizard-choices.test.js`
  (one pure helper, co-located, added per the testing policy since the new-vs-over
  branch is pure and warrants it, as `arrange-choices` did):
  - *inUseHasChoices* — given the parsed model, `tuningText` and the in-use
    variation label, answers whether that variation already holds chosen shapes
    for this tuning (so the screen knows to offer *new / over* or to write
    straight in). *Pins Workflow 5 `:70-72`; cifra.md §7.2–7.3.*
  - *existingFor* — builds the `Map<key,(number|'x')[]>` of the song's current
    choices in the in-use variation that `planVoicings`'s `existing` wants, so
    the preview's "would change" count is right. *Pins `planVoicings` `unchanged`;
    DESIGN §2.10.*
- **behavior** — `app/src/songs/SongWizard.behavior.test.jsx` (real RAC + i18n,
  the engine, loopback store, axe over `container`):
  - *The policy list by instrument, how-it-works and citations* — on guitar the
    three policies show; on a four-string instrument *Choro* is absent; a
    policy's **How it works** and its cited works render; axe clean. *Pins DESIGN
    §2.10 `:61`; `plannersFor`; `SOURCES`.*
  - *The preview* — choosing a policy shows the plan's diagrams, the "{n} of {m}
    would change" summary, a `missing` chord named, and the "nothing would
    change" state on a song already voiced that way; nothing is written yet (no
    `WRITE` recorded). *Pins DESIGN §2.10 `:55-59`; `wizard.*` summary/missing/
    nothing.*
  - *Into a new variation first* — on a song whose in-use variation already has
    choices, accepting offers *new* (selected) and *over this one*; **Write the
    plan** into a new named variation records a `WRITE` whose reparsed text has
    the plan under the new block with the default/in-use variation untouched,
    then a `SET_VARIATION` to the new label; a duplicate name is refused inline.
    axe over the choice. *Pins Workflow 5 `:70-72`; cifra.md §8.5.5, §7.3.*
  - *Over this one, and the no-choices shortcut* — choosing *over this one*
    records a `WRITE` whose reparsed text has the plan in the in-use variation;
    on a song whose in-use variation has no choices, **Write the plan** writes
    straight in with no new/over question. *Pins Workflow 5 `:66-72`; cifra.md
    §8.5.4.*
  - *A keyboard path through the wizard* — open from arrange, move the policy
    list and the stylistic radiogroup, reach the preview, choose new/over, type a
    name and write — all without a pointer; focus returns to arrange's Run-the-
    wizard button on close. *Pins DIRECTION §3.7 `:399-401`; the `.tji` axe
    clause.*
- **e2e-web** — `e2e/web/tests/wizard.spec.js` (compose stack, phone/tablet/
  computer projects, axe WCAG 2.1 AA; the song seeded via the example book):
  - *The wizard run in a song and its variation read back* — open a song, enter
    arrange, **Run the wizard**, choose a policy, preview, write into a new
    variation; the variation selector appears and the song reads back with the
    plan's shapes in the new variation; axe on the wizard and the arrange screen.
    *Pins the `.tji` "the wizard run in a song and its variation read back".*
  - *Into a new variation first, over this one second* — on a song whose in-use
    variation already has choices the wizard offers both with *new* first; *over
    this one* replaces the in-use variation's shapes; on a fresh variation it
    writes straight in. *Pins Workflow 5 `:70-72`; the `.tji` clause.*
  - *Offline* — with the network cut (`runOffline`), the whole wizard run and the
    write to the working copy succeed; save/push is save_sheet's. *Pins
    offline-first (DIRECTION §3.1); standing rule.*

### Deferred work (closer registers in the WBS)

**None.** The wizard creates no new WBS leaf:

- The pure planners, their questions and the plan→variation writers are
  **music.wizard** (Done); this task only drives them.
- Save, discard and the save sheet that commit the wizard's edit are
  **songs.save_sheet** (Done); the wizard writes the unsaved working copy only.
- "Starting from a nearby tuning, and the capo" is Workflow 5 *§Later*
  (`:96-102`), already tracked in the workflow (surfaced for the parking lot by
  arrange), not this wizard's.
- Consuming the prepared `wizard.*` i18n and adding the song-side *new / over /
  plan-ready / variation-name* copy across all four locales is **part of this
  task**, not deferred; the tests above land with the work.

## Decisions

1. **The wizard is its own component (`SongWizard.jsx`), mounted from arrange's
   `onRunWizard` seam — the action behind arrange's affordance, not folded into
   `SongArrange`.** *Chosen:* a dedicated surface that `AppShell` mounts over the
   arrange surface (a full surface on the phone, the mockup's side pane beside the
   arrange main when wide), opening the song itself (`OPEN_SOURCE`/`OPEN_SONG`)
   and driving the pure engine. *Rationale:* arrange deliberately left
   `onRunWizard` as a seam to this task's destination (arrange Decision 9;
   `AppShell.jsx:333-334`), the mockup draws the wizard with its own chrome and a
   two-step flow, and the affordance-vs-action split is the house pattern every
   songs refinement keeps. *Rejected:* building the planner flow inside
   `SongArrange` as a third overlay — it would entangle a second heavy,
   multi-step flow into arrange and absorb a separately-estimated task with its
   own `music.wizard` dependency.
2. **The plan is computed and previewed in memory; nothing persists until Write
   the plan.** *Chosen:* step two renders the plan's diagrams and labels from
   `planVoicings`' result without touching the working copy; only **Write the
   plan** runs a writer and `WRITE`. *Rationale:* DESIGN §2.10 is explicit that a
   one-click rewrite "would be something you undo rather than something you use"
   and that the preview is "the thing itself" — so the preview cannot be a
   speculative write. *Rejected:* writing a provisional variation to preview then
   rolling it back on **Back** — it would churn the working copy and surface a
   phantom edit in the save sheet.
3. **New-vs-over is the screen's branch, keyed on whether the in-use variation
   already has choices (a pure helper).** *Chosen:* `inUseHasChoices(model,
   tuningText, variation)` decides it; when true the wizard offers *into a new
   variation* (first, named) and *over this one* (second); when false it writes
   straight into the in-use variation with no question. *Rationale:* Workflow 5
   `:70-72` states exactly this condition, and `music.wizard` explicitly leaves
   "which of the two to offer, and the variation's name" to this screen. A pure
   helper keeps the branch unit-testable, as `arrange-choices` did. *Rejected:*
   always asking (a needless question on a fresh variation, and the mockup only
   draws the question for a variation that "already has shapes chosen"); always
   new (loses *over this one*).
4. **Writing reuses arrange's persistence exactly: the engine's model →
   `write` → `WRITE`, and `SET_VARIATION` for a new variation; no new Worker
   command.** *Chosen:* `planIntoNewVariation` / `applyPlan` return the mutated
   model, the view canonicalises with `write` and sends `WRITE {bookId, path,
   text}`, then `SET_VARIATION` to switch into a new block — the same two writes,
   to the same two stores, arrange already proves. *Rationale:* the writers and
   the ops are framework-free and callable in the view (DIRECTION §3.7
   `:415-417`); `WRITE` persists working-copy text as unsaved; this keeps "the
   view composes the core, the Worker owns durability" with no redundant seam.
   *Rejected:* a structured `RUN_WIZARD` Worker command carrying the planner id
   and choices — it would move music-core logic into the Worker against the §3.7
   split, duplicate the compose-then-write path, and gain no durability.
5. **The view drives the engine and never re-plans or re-ranks.** *Chosen:* the
   policy list is `plannersFor(instrument)`, the stylistic question is seeded
   from `optionDefaults`, and the plan is `planVoicings`' result rendered as-is;
   the view adds no policy logic. *Rationale:* `music.wizard` owns every
   decision, and the recurring house rule is that ranking and planning stay in
   the carried core (arrange Decision 6). *Rejected:* the view filtering or
   re-ordering the plan (it would drift from the engine and the citations it
   stands on).
6. **The variation Name is refused inline via `addVariation`'s throw, mirroring
   arrange's add-variation dialog.** *Chosen:* **Write the plan** into a new
   variation calls `planIntoNewVariation`, whose `addVariation` throws on a
   tuning+name already present; the throw is caught into an inline field error (a
   word, never colour alone). *Rationale:* Workflow 5 `:78` ("a name already in
   use is refused") and the identical pattern in `SongArrange.submitAddVar`
   (`:239-258`). *Rejected:* a pre-check against `songVariations` (it would
   duplicate the library's own refusal and risk a race with it).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `app/src/songs/SongWizard.jsx` — the two-step wizard surface (policy chooser
  with how-it-works/citations, stylistic radiogroup, in-memory preview, and the
  into-a-new-variation-first / over-this-one write)
- `app/src/songs/wizard-choices.js` — pure helpers `inUseHasChoices` and
  `existingFor`, the new-vs-over branch and the `existing` map for the planner
- `app/src/songs/WizardDev.jsx` — the `#dev/wizard` hash mount
- `app/src/songs/wizard.css` — wizard layout and RAC radio/input overlay styles
- `app/src/shell/AppShell.jsx` — wires arrange's `onRunWizard` seam to mount
  `SongWizard` over the arrange surface; focus-return state
- `app/src/songs/SongArrange.jsx` — focus-return props and `autoFocusWizard`
  button ref for focus restoration after the wizard closes
- `app/src/songs/arrange.css` — RAC Checkbox overlay fix for the add-a-variation
  dialog's `.arrange-copy` field (Playwright hit-target)
- `app/src/App.jsx` — `#dev/wizard` hash route
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — song-side `wizard.*` keys
  (new variation / over this one / plan-ready / variation-name copy) across all
  four locales with parity
- **unit** `app/src/songs/wizard-choices.test.js` — `inUseHasChoices`,
  `existingFor` (9 tests, all passed)
- **behavior** `app/src/songs/SongWizard.behavior.test.jsx` — policy list by
  instrument + how-it-works + citations + axe; preview summary/missing/nothing,
  nothing persisted; into-a-new-variation-first write + default untouched +
  SET_VARIATION + duplicate-name refused + axe; over-this-one + no-choices
  shortcut; keyboard path + focus returns to Run-the-wizard (9 tests, all passed)
- **e2e-web** `e2e/web/tests/wizard.spec.js` — run into a new variation + reads
  back + axe on wizard & arrange; new-first/over-second + fresh-variation writes
  straight in; offline — all three viewports (phone/tablet/computer), 9 tests,
  all passed
