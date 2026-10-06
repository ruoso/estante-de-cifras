# music.instruments — Instruments and voicing rules

## TaskJuggler entry

[`tasks/55-music.tji`](../../55-music.tji), `task music.instruments`
("Instruments and voicing rules"), under `task music` (which
`depends foundation.music_core_import`).
`depends design.instruments, storage.home_book, shell.layout,
foundation.e2e_web`.

`note`: *"Workflow 15 built: tunings, instruments in the home book, the header
chip, presets and the expert panel. Tests: unit (voicing-rule presets and the
expert panel's rules); behavior (the instrument screens with Testing Library
and axe, stored in the home book); e2e-web (workflow 15 on the three viewports:
a tuning, a second instrument, switching from the header chip; axe)."*

## Effort estimate

4d (`allocate team`), unchanged from the `.tji`. The weight is the view —
a roster, an add/edit form, the voicing-rule panel (a preset control over an
expert panel of ~25 controls), a my-shapes review list, and a remove
confirmation, plus the header instrument chip that must sit in the shell frame
on every screen — and the Worker surfacing/write path over the already-built
home book. The music core (the model, the catalogue, the heuristics, the
fingering search) is carried over whole from Explore Chords
(`foundation.music_core_import`, Done), so no music logic is written here; the
task is the frame around it and its storage.

## Repository

**estante-de-cifras** only. App work (the note does not start with
`cifra.md:`). Nothing lands in `/home/ruoso/devel/cifra.md`; the one place this
task meets the format is adopting cifra.md §6 tuning text as the tuning
identity, and that chapter is already specified. Directories touched:

- `app/src/instruments/` — **new** view feature: the instrument surface (the
  header chip, the roster, the add/edit form, the voicing-rule panel, the
  my-shapes review, the remove confirmation), all React Aria Components.
- `app/src/worker/` — a new projection `instruments.js` (mirroring
  `preferences.js`), the surfacing call in `logic.js`, and the new
  command/event kinds in `protocol.js`. Writes go through the already-built
  `home-book.js` `set`.
- `app/src/shell/AppShell.jsx` — mounts the instrument chip in the shell chrome
  and the instrument surface overlay (no new tab destination; see Decisions).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — all the screen copy and the
  rule/limit/cost labels, in all four locales.
- `app/src/diagram/`, `app/src/core/`, `app/src/data/` — **consumed, not
  modified**: `ChordDiagram.jsx` draws my-shapes; the music core
  (`instrument.js`, `heuristics.js`) and the catalogue (`data/instruments.js`)
  are imported.
- `e2e/web/tests/` — the workflow-15 journey.

## Inherited dependencies

All four settled.

- **`design.instruments`** — Done 2026-10-05
  ([`tasks/refinements/design/instruments.md`](../design/instruments.md)). The
  governing design: it wrote [`docs/workflows/15-set-up-an-instrument.md`](../../../docs/workflows/15-set-up-an-instrument.md)
  (Status: decided), the board
  [`docs/mockups/W15-set-up-an-instrument.dc.html`](../../../docs/mockups/W15-set-up-an-instrument.dc.html),
  and the DIRECTION §3.2/§6/§7 deltas. This task builds that workflow in code;
  the refinement turns its promises into a work order, it does not re-decide
  them.
- **`storage.home_book`** — Done 2026-10-05
  ([`tasks/refinements/storage/home_book.md`](../storage/home_book.md)). Ships
  the Worker-internal home-book writer/merger/serializer
  (`app/src/worker/home-book.js` `createHomeBook({ fs, git, locks })` →
  `{ read, set, sync, ensureDeviceId }`, `home-book-merge.js`,
  `home-book-canonical.js`, exported `HOME_BOOK_ID`). It adds **no** protocol
  kinds or `logic.js` dispatch — consumers wire their own command/event and
  compose the module; `music.instruments` is such a consumer. `set` applies a
  list of register changes under one lock and **commits automatically, no push**
  — the offline-first write path this task's every mutation uses.
- **`storage.preferences_surface`** — Done 2026-10-05
  ([`tasks/refinements/storage/preferences_surface.md`](../storage/preferences_surface.md)),
  relied on though not a direct `depends`. It is the **nearest template**: the
  pure projection `app/src/worker/preferences.js` `surfacePreferences(model)`,
  the `logic.js` wiring (`ensureHomeBook()`, memoised `ensureGit()`/
  `ensureLocks()`, `surfaceHomeBookPreferences()` posting a `PREFERENCES`
  event on `OPEN`), and the generic `CommandKind.SYNC_HOME` ("sync the home
  book and re-surface"). This task mirrors every piece of it for instruments.
- **`shell.layout`** — Done 2026-10-05
  ([`tasks/refinements/shell/layout.md`](../shell/layout.md)). The responsive
  shell (`app/src/shell/AppShell.jsx`, React Aria `Tabs`; phone tab bar vs.
  wide `.split` master-detail at the 600px breakpoint in
  `app/src/shell/layout-mode.js`). **Two deliberate gaps bear on this task:**
  there is **no URL router** (navigation is in-memory `useState`), and there is
  **no shared app bar** (each content surface composes its own `.appbar` from
  `app/src/theme/theme.css`; a general shared app bar is parked). So the
  instrument screen is not a tab destination and the header chip has no slot to
  plug into — this task decides both (see Decisions). Also relied on:
  `shell.portal_provider` (Done 2026-10-06) — `ThemeRoot` wraps children in
  React Aria's `UNSAFE_PortalProvider` onto the `.est` token root, so every
  overlay this task opens inherits tokens with no per-screen plumbing
  ([[rac-overlays-portal-outside-est-theme-root]]); and `shell.diagram`
  (Done 2026-10-05) — `app/src/diagram/ChordDiagram.jsx` draws a `Fingering` as
  a chord box in kind `yours`/`default`/`song`.
- **`foundation.e2e_web`** — Done 2026-10-05
  ([`tasks/refinements/foundation/e2e_web.md`](../foundation/e2e_web.md)). The
  Playwright harness at `e2e/web/`: three Chromium viewport projects
  (phone `Pixel 7`, tablet `Galaxy Tab S4`, computer `Desktop Chrome`), every
  spec run on all three, the axe fixture `e2e/web/lib/axe.js`
  (`import { test, expect } from '../lib/axe.js'`, WCAG 2.1 AA), the offline
  helper `e2e/web/lib/offline.js`; the compose stack is brought up by
  `scripts/gate`, not the config.
- **`foundation.music_core_import`** (the `music` parent's `depends`) — Done
  2026-10-05 ([`tasks/refinements/foundation/music_core_import.md`](../foundation/music_core_import.md)).
  Carried Explore Chords' `src/core` (minus `song.js`) and `src/render` with
  history, `src/data/instruments.js`, and the renderer's `src/i18n/`, into
  `app/src/{core,render,data,i18n}`. The modules this task consumes
  (`instrument.js`, `heuristics.js`, `data/instruments.js`) are **byte-identical
  to the Explore Chords originals**. Landed unit tests only; this task adds the
  behavior and e2e-web levels around them.

The downstream consumers waiting on `music.instruments`: `music.explorer`
(`depends !instruments` — stars shapes into the `shapes.json` this task
defines), `music.fallback` (`depends !instruments` — reads my-shape → default
through the rules), `music.transpose` and `music.wizard` (transitively). Each
reads the opaque `instruments.json`/`shapes.json` values whose shape this task
fixes.

## What this task is

Build workflow 15 — *set up an instrument* — in code. An instrument is an
instance the user set up (a catalogue entry, a tuning that is its identity,
a label, a fret count, and its voicing rules); two tunings are two instruments.
The task delivers: the **header instrument chip** present on every screen,
opening the **roster**; **adding** an instrument (catalogue → a tuning preset or
a custom pitch list → optional rename); **switching** the one instrument in use,
which re-derives every shape the app offers; the **voicing rules** each
instrument carries — a **preset** (Beginner / Strumming / Fingerstyle / Jazz /
Bass-friendly, no "Standard") over an **expert panel** exposing every rule as a
toggle, every limit and cost as a number, any edit flipping the label to
*Custom*; **reviewing and removing *my shapes*** on the instrument's screen; and
**removing** an instrument, which asks first and names what goes with it. All of
it is personal state in the home book, written locally and committed
automatically; the music core (the model, the catalogue, the fingering search,
the heuristics) is carried over whole and only framed here.

## Why it needs to be done

Three already-built surfaces lean on the rules this model carries but cannot
read them until an instrument exists to hold them: the shape fallback
(workflow 2) ends at "the easiest shape the fingering search finds under the
instrument's rules"; the explorer (`music.explorer`, `depends !instruments`)
ranks and groups under those rules and its empty state points here; arranging
(workflow 5 / `music.wizard`) writes shapes for a tuning. The home book's
`instruments.json` and `shapes.json` opaque values have an agreed *envelope*
(home-book §4.3, §4.4) but no agreed *value shape* until this task defines it.
And the header instrument chip — the one piece of ambient context workflows 1,
15 and 16 all assume — does not exist yet.

## Inputs / context

Governing design (normative — turned into a work order here, not redesigned):

- **Workflow 15**, [`docs/workflows/15-set-up-an-instrument.md`](../../../docs/workflows/15-set-up-an-instrument.md),
  whole; by section: the instrument model (lines 18–59), the roster and
  switching (61–82), adding (84–100), the voicing rules — preset and expert
  panel (102–161), reviewing my shapes (163–181), removing an instrument
  (183–192), no "viewing as" override (194–202), offline (204–213), edge cases
  (215–234), later (236–246).
- **Workflow 1**, [`docs/workflows/01-first-run.md`](../../../docs/workflows/01-first-run.md)
  lines 60–78 — the instrument-in-use chip in the header and the standard-guitar
  default (absent in-use preference).
- **Workflow 2**, [`docs/workflows/02-find-and-play.md`](../../../docs/workflows/02-find-and-play.md)
  lines 88–108 — the shape fallback (song's choice → *my shape* → app default)
  that reads the rules; `music.fallback`'s to build, cited so this task's
  stored shapes match it.
- **Workflow 16**, [`docs/workflows/16-chord-explorer.md`](../../../docs/workflows/16-chord-explorer.md)
  lines 29–36 (the chip), 119–122 (preference changes commit and sync),
  173–179 (the *no shape fits the rules* empty state pointing here), 203–205
  (the my-shapes review this task owns).
- **DIRECTION** [`docs/DIRECTION.md`](../../../docs/DIRECTION.md): §3.2
  lines 136–151 — personal state, including the newly-added "which instrument is
  in use"; committed automatically. §3.6 lines 279–291 — the app and the service
  share no code. §3.7 lines 394–435 — React Aria; the Worker owns the data
  (lines 406–408), the view mirrors it over `useSyncExternalStore`
  (409–414), the music core is framework-free and the view is the only React
  layer (415–417). §5 lines 460–503 — the music core and catalogue come over
  as-is (462–468).
- **Home-book format** [`docs/home-book-format.md`](../../../docs/home-book-format.md):
  §1.2 lines 65–68 (opaque value — "the music core and `design.instruments`
  own the value"); §3 lines 156–176 (the `{ value, at }` register envelope; an
  object is a register iff its keys are exactly `value` and `at`; a register's
  value is never walked); §4.1 lines 189–214 (`preferences.json` singleton
  registers, the key list descriptive); §4.3 lines 255–273 (`instruments.json`:
  per id a `definition` register and a `rules` register, merged independently;
  removal a tombstone on each); §4.4 lines 275–293 (`shapes.json` keyed instrument
  → tuning → chord, the chord key "the chord as the music core matches it");
  §4.5 lines 295–316 (`songs.json` `variation` keyed per tuning); §5.1
  lines 339–351 (register merge, greater `at` wins, equal-time byte tie-break);
  §5.2 lines 354–359 (map union, per-key recursion); §5.3 lines 361–368
  (tombstones retained).
- **cifra.md** `spec/6-tunings.md` §6.2 lines 47–50 (the tuning text: uppercase
  letter, pitches joined by single spaces, each pitch's spelling kept), §6.3
  lines 60–73 (tuning identity; a reader matches a voicing block to an instrument
  by it; a capo is a tuning, no capo field); `spec/7-voicings.md` §7.1
  lines 23–32 (a shape is meaningless without its tuning), §7.6 lines 215–229
  (resolving a chord to its shape by the instrument's tuning; "no chosen shape"
  is a defined outcome, no fallback across tunings/variations).

Code seams (all verified on disk):

- **The music core** — `app/src/core/instrument.js`: `parseTuning(text)` →
  `Pitch[]` (throws `fault('emptyTuning')` on nothing parseable),
  `formatTuning(pitches)`, `instrumentInstance({ catalogId, label, strings,
  fretCount, preset, heuristics })`, `hasBassRegister(instrument)` (lowest open
  string below MIDI 48 = C3), `configFor(instrument, presetId='strumming')`
  (a preset's config with `rootInBass` clamped by `hasBassRegister` — **use this,
  not `presetConfig`, whenever an instrument is in hand**), `defaultPresetFor(catalogId)`
  (`'bassFriendly'` for `4bass`/`5bass`, else `'strumming'`),
  `fromCatalog(catalogId, tuningName)`, `isReentrant(instrument)`, `catalogEntry(id)`,
  `CATALOG`. `app/src/core/heuristics.js`: `DEFAULT_WEIGHTS`, the `HeuristicConfig`
  typedef (`maxSpan`, `requireRoot`, `rootInBass`, `requireThird`, `omitFifth`,
  `allowRootless`, `requireExtensions`, `allowDoubling`, `allowDuplicatePitch`,
  `allowInnerMutes`, `allowBarre`, `minSoundingStrings`, `maxResultsPerGroup`,
  `weights`), `STRUMMING` (the baseline), `PRESETS` and `PRESET_IDS`
  (`['beginner','strumming','fingerstyle','jazz','bassFriendly']` — **camelCase
  ids**, display labels come from i18n), `presetConfig(id)`,
  `withOverrides(config, overrides)` (sets `preset` to `'custom'` when it
  differs), `resolvePresetId(id)` (`RENAMED = { standard: 'strumming' }`),
  `optionalRoles(config)`. `app/src/data/instruments.js`: `CATALOG` — 8 entries
  (`6guitar` 22 frets, `7guitar` 22, `4bass` 20, `5bass` 20, `ukulele` 15
  re-entrant, `cavaquinho` 17, `mandolin` 20, `tenorbanjo` 19), each
  `{ id, name, fretCount, tunings: [{ name, strings }] }`.
  `app/src/core/voicings.js` (trimmed): `defaultVoicing(chord, instrument)`,
  `unvoiceableKeys(parsed, resolved)`.
- **The reference UI** (Explore Chords, **not carried** — the estante view is
  rebuilt in React): `/home/ruoso/devel/explore-chords/src/ui/instrument-settings.js`
  — its `RULES`/`LIMITS`/`WEIGHTS` label tables and interaction pattern (the
  preset `<select>` built from `PRESET_IDS`; changing a preset calls
  `onRules(configFor(instrument, id))`; each rule edit calls
  `onRules(withOverrides(config, patch))`); its `src/ui/instrument-form.js`
  (`renderInstrumentForm`, `presetLabel`) is the add/edit-form precedent.
- **The diagram** — `app/src/diagram/ChordDiagram.jsx` (+ pure
  `app/src/diagram/chord-diagram.js` `diagramKind()`/`KINDS`, `diagram.css`):
  renders a `Fingering` (`app/src/core/search.js`) `kind="yours"` in the chord
  colour, labelled "your shape"; `role="img"` with an aria-label from
  `describeFingering`.
- **The home book** — `app/src/worker/home-book.js` (`createHomeBook`, `read`,
  `set`, `sync`, `ensureDeviceId`, `HOME_BOOK_ID`); `home-book-merge.js`
  (`isRegister`, `mergeRegisters`, `mergeTrees`); `home-book-canonical.js`
  (`serialize`/`serializeBytes`/`parse`).
- **The Worker spine** — `app/src/worker/preferences.js` `surfacePreferences`
  (projection template); `app/src/worker/logic.js` (`ensureHomeBook()`,
  memoised `ensureGit()`/`ensureLocks()`, `surfaceHomeBookPreferences()`, the
  `handle` switch, `CommandKind.SYNC_HOME`); `app/src/worker/protocol.js`
  (`CommandKind`, `EventKind`, `command()`, `event()`).
- **The shell** — `app/src/shell/AppShell.jsx`, `app/src/shell/layout-mode.js`
  (`matches → 'wide' | 'narrow'`, 600px), `app/src/theme/theme.css` `.appbar`
  / `.chip` / `.seg` / `.toggle` / `.badge` / `.row` / `.card` classes,
  `app/src/theme/ThemeRoot.jsx` (portal provider). The store is threaded by prop,
  slices read with `useSlice`, commands sent with `store.send(command(...))`
  (precedent: [`tasks/refinements/account/first_run.md`](../account/first_run.md),
  `songs.search`).
- **The test harness** — `app/src/test/loopback.js`
  (`createLoopbackEndpoint`), `app/src/test/git-http-remote.js`
  (`startGitHttpRemote`), `app/src/test/web-locks.js` (`installWebLocks`),
  `fake-indexeddb`; `e2e/web/lib/axe.js`, `e2e/web/playwright.config.js`.
- **The visual language** — the board
  [`docs/mockups/W15-set-up-an-instrument.dc.html`](../../../docs/mockups/W15-set-up-an-instrument.dc.html)
  (the real states and copy — Acceptance criteria quote them), [`docs/mockups/README.md`](../../../docs/mockups/README.md)
  "Decisions the drawings carry" (defaults hollow, *your shapes* in the chord
  colour, status a word never colour alone), [`docs/mockups/ChordBox.dc.html`](../../../docs/mockups/ChordBox.dc.html),
  [`docs/mockups/theme.css`](../../../docs/mockups/theme.css), and the two
  closest boards W05 and W16.

## Constraints / requirements

- **The opaque values this task defines** (the format fixes the key and the
  `{ value, at }` envelope only — home-book §1.2, §4.3, §4.4):
  - `instruments.json` → `<id>.definition.value` =
    `{ catalogId, label, tuning, fretCount }`, where `tuning` is the cifra.md §6
    text (the source of truth and the identity; the string count is the tuning's
    length). `<id>.rules.value` is **either** a named preset
    `{ "preset": "strumming" }` **or** a custom config
    `{ "preset": "custom", "config": <HeuristicConfig> }`. Definition and rules
    are **two registers** so a rename on one device and a rule edit on another
    merge independently (§4.3, §5.2).
  - `shapes.json` → `<id>.<tuning>.<chord>.value` = the shape in the music
    core's fret-string form (`shorthandOf`/`fingeringFromFrets`,
    `app/src/core/{fretstring,search}.js`). The `<chord>` key is the chord as the
    music core matches it (`sameChord`, `parseChord` — not by spelling, §4.4
    line 291). Shapes are keyed **by instrument id first**, so they are an
    instrument's own, never shared with another instrument of the same tuning.
  - `preferences.json` → a **singleton register** `instrumentInUse.value` = an
    instrument id; **absent means the standard guitar** (the built-in
    `fromCatalog('6guitar', 'Standard')`, nothing stored). Per `design.instruments`
    and DIRECTION §3.2, this needs **no home-book-format change**: §4.1's key
    list is descriptive; the format validates the register envelope and the
    file whitelist, not a fixed set of preference keys.
- **Rebuild-on-load vs. keep-exactly.** An instrument whose `rules` names a
  preset is **rebuilt from it on load** — the effective config is
  `configFor(instrument, preset)`, so a later correction to a preset reaches an
  old set-up. A `Custom` instrument keeps its `config` exactly, with only
  `rootInBass` re-clamped by `hasBassRegister` (the one rule the user may not
  break — forced off where the instrument has no bass register, so switching a
  ukulele to Jazz cannot re-break it). The surfacing computes the effective
  config and the label (`Strumming` / `Custom`) for the view and the search.
- **A tuning is spelled as cifra.md §6 spells it** (uppercase letter, pitches
  joined by single spaces). A custom pitch list that `parseTuning` faults on is
  refused with the reason; nothing is stored until it reads. There is no capo
  field (a capo is a tuning, §6.3). The tuning text is the identity keying
  `shapes.json`/`songs.json` and naming a song's voicing block, so a kept shape
  and a song written for the tuning match.
- **Offline first; commits automatically.** Adding, editing a definition or a
  rule, switching the in-use instrument, and removing a shape or an instrument
  are home-book changes written through `home-book.set` — one lock, canonical,
  auto-committed, **no push** (DIRECTION §3.2; workflow 16 lines 119–122).
  Nothing waits on the network; nothing here needs an account or a membership —
  it is all the user's own, in a home book that starts local.
- **Component boundaries (DIRECTION §3.6–3.7).** The Worker owns the home book
  and the search; the view (React Aria Components, the only React layer) reads
  the instrument slice via `useSlice` and sends commands via
  `store.send(command(...))`, never touching IndexedDB or git. The music core is
  framework-free and imported by both the Worker (search) and the view
  (drawing, `configFor`/`withOverrides` for the panel). No code is shared with
  the service.
- **Accessibility.** Every control is a React Aria Component with a keyboard
  path, axe clean at WCAG 2.1 AA. Status is a **word**: the in-use instrument
  marked *in use* (badge, never colour alone), the preset state *Strumming* /
  *Custom*, a shape *your shape*. The expert-panel toggles are `role="switch"`
  with `aria-checked`; the preset control is a `role="group"` segmented control
  of buttons (not a `role="list"` — [[role-list-of-rac-buttons-fails-axe]]);
  overlays portal into `.est` for tokens ([[rac-overlays-portal-outside-est-theme-root]]).
- **No song text in logs.** `home-book.set` already commits with a content-free
  message; no instrument label, tuning or shape is logged. Fixtures are the
  established cast (guitar `E2 A2 D3 G3 B3 E4`, cavaquinho `D4 G4 B4 D5`, ukulele
  `G4 C4 E4 A4`), never anyone's words.
- **No new runtime dependency and no new architectural seam.** The model, the
  search and the catalogue carry over from Explore Chords; the storage is the
  landed home book; the overlay/token plumbing is the landed portal provider.
  This task adds no DIRECTION §3.x seam and no `docs/`/`spec/` edit (see
  Decisions — no design delta).

## Acceptance criteria

### Behavior delivered

1. **The header instrument chip** is present on every screen (mounted in the
   shell chrome — see Decisions), showing the in-use instrument
   *Guitar · E A D G B E*; absent `instrumentInUse` shows the standard guitar.
   Tapping it opens the **roster**: the user's instruments, the in-use one marked
   with the word *in use*, each row showing its preset and string count
   (*Strumming · 6 strings*), and *+ Add instrument* at the foot. Choosing
   another **switches** (writes `instrumentInUse`) and everything on screen
   re-derives. One instrument in use at a time.
2. **Adding** is catalogue → tuning → optional rename: pick a catalogue entry
   (*Guitar (6-string)*…), pick a tuning preset for it (*Standard*, *Drop D*,
   *Open G*, *DADGAD*, *Custom…*) **or** type a custom pitch list (shown as its
   §6 identity text; refused with a reason if it does not parse), pick a *How you
   play* preset (default per catalogue entry), rename if wanted (default
   *catalogue · tuning*), *Add instrument*. The result is a new instance stored
   as the two `instruments.json` registers; *Guitar · Standard* and
   *Guitar · Drop D* are two entries. Adding the first instrument (while the
   in-use is still the implicit standard guitar) sets it in use; a later addition
   leaves the in-use unchanged (switching is explicit).
3. **The voicing rules** screen: a preset segmented control
   (*Beginner / Strumming / Fingerstyle / Jazz / Bass-friendly*, no *Standard*)
   over the **expert panel** — every `HeuristicConfig` rule a toggle
   (*Root required*, *Root in bass*, *Third required*, *Fifth may be omitted*,
   *Rootless allowed*, *Extensions required*, *Barre allowed*, *Inner mutes
   allowed*, *Doubling allowed*, *Duplicate pitch allowed*), every limit a number
   (*Max span*, *Min sounding strings*, *Shapes per group*), every weight a
   number. Editing any one flips the label to **Custom** and stores the config
   exactly; a named preset is rebuilt on load; *Root in bass* is forced off (and
   shown so) on an instrument with no bass register; a *Custom* set offers
   *Reset to \<preset\>*.
4. **Reviewing my shapes** on the instrument's screen: the shapes saved for that
   instrument (`shapes.json[id]`), grouped by tuning, each a `ChordDiagram`
   `kind="yours"` labelled *your shape*, each removable (the remove button named,
   e.g. *Remove your shape for E minor, 222000*). Removal tombstones the leaf
   register. Adding a shape stays the explorer's one-at-a-time starring
   (`music.explorer`), not a second editor here.
5. **Removing an instrument** asks first and names what goes: *Its N saved shapes
   and the song variations in use for `<tuning>` are removed with it. Your songs
   keep their own voicings.* On confirm it tombstones the instrument's
   `definition` and `rules`, tombstones every `shapes.json[id]` leaf, and
   tombstones `songs.json[*].variation[<tuning>]` **only where no remaining
   instrument still uses that tuning** (variation is keyed per tuning and so is
   shared across instruments of a tuning — §4.5; shapes are not, §4.4). Removing
   the in-use or last instrument falls back to the standard guitar (clears
   `instrumentInUse`). The songs' own voicing blocks are untouched.
6. **The board's states and copy** (W15) are realised: the roster with the
   *in use* badge and the footer *"The one in use shapes every chord… one tap.
   One instrument in use at a time."*; the add form with the tuning helper
   *"…the same spelling a song's voicing block uses (cifra.md §6). A capo is a
   tuning; there is no capo field."*; the rules panel explainer
   *"Editing any rule turns the preset to Custom and keeps it exactly…"* and the
   no-bass note; the my-shapes footer *"Starred one at a time in the explorer
   (workflow 16); reviewed and removed here. Never written into a song."* All
   copy in all four locales (the i18n parity test).

### Tests, by level (the `.tji` `Tests:` clause, sharpened)

- **unit** — `app/src/worker/instruments.test.js` (Vitest): the pure projection
  and rules logic, no Worker — (a) `surfaceInstruments(model)` projects
  `instruments.json` + the `instrumentInUse` preference to the roster payload,
  keeping only well-formed `{value, at}` registers, resolving absent in-use to
  the standard guitar, dropping a malformed entry; (b) the rules resolution — a
  named preset resolves to `configFor(instrument, preset)` (rebuilt), a `Custom`
  config is kept exactly, `rootInBass` is forced off on a no-bass instrument
  (ukulele/cavaquinho) for both a preset and a custom config, `withOverrides`
  flips the label to `Custom`; (c) the removal change-set builder emits
  tombstones for `definition`/`rules` and each `shapes.json[id]` leaf, and a
  `songs.json[*].variation[<tuning>]` tombstone only when no other instrument
  retains the tuning. *Pins the `.tji` unit clause "voicing-rule presets and the
  expert panel's rules"; workflow 15 lines 102–161, 183–192; home-book §4.3–§4.5,
  §5.3; Explore Chords §2.5.*
- **behavior** — `app/src/instruments/instruments.behavior.test.jsx` (React
  Testing Library + real React Aria + i18n + a loopback-backed **real Worker**
  over `fake-indexeddb` + `startGitHttpRemote()`, the `preferences_surface`
  template): render the instrument surface over `<ThemeRoot store={store}>`;
  assert the roster marks the in-use with the word *in use*; add an instrument
  (catalogue → tuning preset, then a custom pitch list; a faulting list refused)
  and **read `instruments.json` back** to confirm the two registers stored; switch
  from the chip and see the slice re-surface; toggle a rule → label *Custom* and
  a custom config stored, choose a preset → rebuilt, the *Root in bass* toggle
  forced off and disabled on a ukulele; the my-shapes list drawn as
  `ChordDiagram kind="yours"` and a removal tombstones the leaf; the remove
  dialog names what goes and tombstones on confirm; a full keyboard path through
  the roster and the add form; **axe** clean over every rendered screen. *Pins the
  `.tji` behavior clause "the instrument screens with Testing Library and axe,
  stored in the home book"; workflow 15; home-book §4.3–§4.4; mockup W15.*
- **e2e-web** — `e2e/web/tests/instruments.spec.js` (Playwright against the
  compose stack on phone/tablet/computer, `import { test, expect } from
  '../lib/axe.js'`, WCAG 2.1 AA): from a fresh app (no sign-in — all local), open
  the header chip, **add a second instrument** (catalogue → a tuning → rename →
  Add), add one via a **custom tuning** pitch list, **switch from the header
  chip** and see the chip update, open the voicing-rules panel; **axe on each
  screen** (roster, add form, rules panel) on all three viewports. *Pins the
  `.tji` e2e-web clause "workflow 15 on the three viewports: a tuning, a second
  instrument, switching from the header chip; axe"; workflow 15.*

All named tests land in this task and run (not skipped) in `scripts/gate`. The
CodeMirror jsdom note ([[codemirror-jsdom-getclientrects]]) does not apply — this
surface has no editor — but the behavior test renders chord diagrams
(`ChordDiagram` is SVG), so no `getClientRects` stub is needed.

### Deferred work / graph notes

**None net-new.** The my-shapes review that `design.explorer` parked is built
here (criterion 4), as `design.instruments` already placed it — no new WBS leaf.
Starring shapes is `music.explorer`'s, the fallback that reads them is
`music.fallback`'s, transposition is `music.transpose`'s — all already WBS leaves
that `depends !instruments`; none is deferred by this task. No tech-debt leaf,
and no test deferred.

## Decisions

### The instrument surface is mounted in the shell chrome; the chip is the one shared control

The shell has no router and no shared app bar (`shell.layout`; both parked), yet
the chip must be present "everywhere in the header" (workflow 1 lines 65–66,
workflow 15 lines 61–69, DIRECTION §4). **Chosen:** mount the instrument feature
once in `AppShell.jsx` — the chip rendered as the single shared piece of shell
chrome (in the `.pane.side` header on wide, as the mockup's computer board draws
it; in a minimal top strip holding only the chip on narrow), and the roster /
add-edit / rules / my-shapes / remove drawn as an in-memory view stack inside a
React Aria overlay (full-screen `Modal` on narrow, master-detail within on wide),
each deep view composing its own `.appbar` with a Back per `shell.layout`'s
convention, all portaled via the existing provider. The in-use instrument is a
store slice so the shell-level chip can read it. **Why:** `AppShell` is the only
component present on every destination, so it is where "everywhere" is cheapest
and keeps the change inside this task (not in `songs.search`'s or any other
screen). **Rejected:** a fourth tab destination — the chip is ambient context,
not a section, and the mockup puts the roster behind the chip, not in the tab
bar. **Rejected:** rendering the chip in each screen's own `.appbar` — it would
touch every content task and drift. **This does not resurrect the parked general
app bar** (the per-screen Back/Edit/Transpose bar); it adds one ambient control
to the frame, which is exactly what the workflows already decided.

### The in-use instrument is a singleton `instrumentInUse` register in `preferences.json`

Following `design.instruments` and DIRECTION §3.2 (updated to say so): a single
account-wide preference, value an instrument id, absent meaning the standard
guitar, lazily written. **Why:** in-use is singular; a singleton register admits
one winner under last-write-wins, and §4.1's key list is descriptive so no
format change is needed. **Rejected:** per-device (the workflows call it "a
preference", and a few devices converging under last-write-wins is fine —
switching is one tap); a boolean *in use* per instrument in `instruments.json`
(a key-by-key merge would admit two winners). This mirrors how `notation` is an
opaque singleton in the same file.

### Rules stored as `{ preset }` or `{ preset: "custom", config }`; effective config derived on surfacing

The `rules` opaque value is the *intent* (a preset name, or a frozen custom
config), not the derived `HeuristicConfig`. **Why:** a named preset must be
*rebuilt on load* so a later preset correction reaches an old instrument
(workflow 15 lines 124–128), which only works if the stored value names the
preset rather than freezing its config; a `Custom` set must be *kept exactly*,
which only works if the frozen config is stored. The Worker derives the
effective config (`configFor` for a preset; the frozen config with `rootInBass`
re-clamped for custom) when surfacing, so the view and the search never re-derive
differently. **Rejected:** storing the derived config always (loses the
rebuild-on-correction property); storing only overrides against a preset (the
expert panel edits every field, so a full config is the honest custom value, and
`withOverrides` already produces one).

### Removal guards the per-tuning song variations; shapes are always the instrument's own

Shapes are keyed by instrument id (§4.4), so removing an instrument tombstones
*its* shapes unconditionally — they are never shared. Song variations-in-use are
keyed per tuning (§4.5), so two instruments of the same tuning share them; this
task tombstones `variation[<tuning>]` **only when no remaining instrument uses
that tuning**. **Why:** it honours workflow 15's "the per-tuning variations-in-use
for its tunings are removed too" without destroying a sibling instrument's live
reading state in the duplicate-tuning edge case the workflow itself flags
(lines 217–223). The format (§4.4 keyed by id, §4.5 keyed by tuning) governs
over the workflow's looser "would share the same my shapes" phrasing, which is
true only of variations, not shapes. **Rejected:** tombstoning the tuning's
variations unconditionally (would clobber a kept sibling's reading state);
tombstoning nothing (leaves orphaned variations for a tuning no instrument has).

### A per-operation command set, each write through `home-book.set`

New `protocol.js` kinds: a `CommandKind` per mutation —
`SAVE_INSTRUMENT` (add or edit a definition), `SET_INSTRUMENT_RULES`,
`USE_INSTRUMENT`, `REMOVE_INSTRUMENT`, `REMOVE_SHAPE` — and one
`EventKind.INSTRUMENTS` carrying the roster, the resolved in-use, the catalogue,
and the per-instrument shapes; `CommandKind.SYNC_HOME` (from
`preferences_surface`) is reused to re-surface after a sync. Each handler composes
`ensureHomeBook()` and calls `home-book.set` with the register change(s) under
one lock, then re-surfaces. **Why:** named commands match the house pattern
(`OPEN_EXAMPLE_BOOK` in `account.first_run`); separate definition/rules commands
keep the two-register independence visible and match the mockup's separate *Edit*
and *Edit rules*. **Rejected:** a generic "set home-book register" command
(leaks the format's key paths to the main thread and loses the per-operation
validation/tombstone logic the Worker should own); surfacing shapes in a separate
event (they are small and per-instrument; one event keeps the slice coherent).

### No "viewing as" override, and notation is not set here

Carried from `design.instruments`: the reading view's fallback chain
(workflow 2) already handles a song written for an unused tuning, and a shared
book carries no instrument, so no transient "viewing as" bar is built; notation
is a single home-book preference set once (workflow 1), not a per-instrument
property, so the instrument screen does not repeat it.

### No design delta

Every choice realises what workflow 15, DIRECTION §3.2/§4 and the home-book
format already decided; nothing deviates from a governing document, changes the
format, or adds a runtime dependency (`instrumentInUse` is accommodated by the
descriptive §4.1 key list; the shell chip realises the workflows' header chip).
So no `docs/` or `spec/` edit rides with this task.

## Open questions

(none — all decided.)

Two matters are deliberately *not* this task's and are recorded only so they are
not mistaken for gaps: the exact wording of the duplicate-tuning warning (a
*later* detail in workflow 15 lines 217–223 — the task refuses nothing and may
offer "edit the existing one instead", but the copy is settled while building),
and a capo as a tuning the search runs on (a *later* item in workflows 5 and 16,
not landing here). Neither is a blocker; neither is a WBS task.

## Status

**Done** — 2026-10-06.

- `app/src/worker/instruments.js` — pure projection `surfaceInstruments`, `resolveRules`, `instrumentRemoval`; mirrors the `preferences.js` template
- `app/src/instruments/` — new feature directory: `InstrumentChip.jsx`, `InstrumentsOverlay.jsx`, `AddInstrumentForm.jsx`, `VoicingRules.jsx`, `MyShapes.jsx`, `instrument-helpers.js`, `icons.jsx`, `instruments.css`
- `app/src/worker/protocol.js` — five new `CommandKind`s (`SAVE_INSTRUMENT`, `SET_INSTRUMENT_RULES`, `USE_INSTRUMENT`, `REMOVE_INSTRUMENT`, `REMOVE_SHAPE`) and `EventKind.INSTRUMENTS`
- `app/src/worker/logic.js` — `surfaceHomeBookInstruments()` called on `OPEN`/`SYNC_HOME`, five command handlers through `home-book.set`; also added `store.open()` call in `AppShell.jsx` to trigger the bring-up
- `app/src/worker/reducer.js` — `instruments` slice and case
- `app/src/worker/store.test.js` — updated `OPEN` assertion: count 4→5 slices (INSTRUMENTS now surfaced)
- `app/src/shell/AppShell.jsx` — instrument chip in the side-header; overlay mount; `useEffect(() => store.open?.(), [store])` to fire `OPEN` on mount
- `app/src/shell/shell.css` — narrow chip strip styles
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — full `instr` namespace in all four locales
- `app/src/worker/instruments.test.js` — unit tests: projection, rebuild-vs-keep-exactly, rootInBass clamp, removal change-set (12 tests)
- `app/src/instruments/instruments.behavior.test.jsx` — behavior tests: roster, add preset+custom+refusal, switch, rule→Custom, preset rebuild, ukulele rootInBass disabled, my-shapes, remove, keyboard, axe (5 tests)
- `e2e/web/tests/instruments.spec.js` — e2e-web: tuning preset, second instrument, custom tuning, chip switch, rules panel, axe on roster/add/rules (3 viewports)
