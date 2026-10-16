# music.instruments_roster_default — The roster lists the instrument in use from the first run

## TaskJuggler entry

[`tasks/55-music.tji`](../../55-music.tji), task `music.instruments_roster_default`
(under `task music`), with milestone wiring in `tasks/99-milestones.tji` (`milestones.m5_complete`'s `depends`).

## Effort estimate

0.5d.

## Repository

The app only. The work is in `app/src/instruments/` (the roster and detail
overlay, a pure roster helper and its test, the behavior test), `app/src/worker/logic.js`
(two command arms), `app/src/i18n/locales/` (one new key in four locales) and
`e2e/web/tests/instruments.spec.js`. Nothing lands under `cifra.md/`, and nothing
in `service/` or `api/`.

Design delta: `docs/workflows/15-set-up-an-instrument.md` §The roster, and
switching (the built-in standard guitar is a roster row from the first run) and
§Removing an instrument (the confirm with no saved shapes). This was written
with this refinement and goes into the closer's commit.

## Inherited dependencies

- `music.instruments` — **settled** (complete). It built the roster, the detail
  screen, the chip, `USE_INSTRUMENT` / `SAVE_INSTRUMENT` /
  `SET_INSTRUMENT_RULES` / `REMOVE_INSTRUMENT`, and the behavior and e2e tests
  this task extends.
- Also settled, though not a `depends`: `music.explorer_standard_shapes`. It gave
  the fallback the reserved id `'standard'` and added `standardMaterialization`,
  which this task reuses.

## What this task is

On a fresh device the header chip reads *Guitar*, the built-in standard guitar
the app plays until the user sets anything up. Tapping the chip opens a roster
that shows only *Add instrument*: the instrument in use is not listed and not
marked. This task makes the roster list the built-in standard guitar, marked
*in use* while it is the one in use. The row stays beside instruments the user
adds, so switching back to it is one tap. It opens a detail screen like any other
row. A write to its rules or definition stores it under its reserved id, the same
way the first star does. It offers no *Remove* until it is stored.

It also fixes the remove confirmation. With no saved shapes the confirm now names
only the song variations. Today it reads *Its 0 saved shapes and …*.

## Why it needs to be done

Workflow 15 §The roster, and switching says the roster is "the one in use
**marked with a word**". The W15 board (phone #1) always draws the standard
guitar as a listed row badged *in use*. The UI pairwise audit (2026-10-14)
compared the e2e `mockup()` screenshot against the board and found an empty
roster under a chip that names an instrument.

The gap is the root cause of more than the first run:

- After the user adds a first instrument, which goes into use, nothing in the
  roster gets them back to the built-in guitar.
- After they remove their last one, the chip falls back to *Guitar* over an
  empty roster again.

`music.instruments_layout` redraws these screens next (the full-screen rules and
the computer rail). It builds on a roster that has the right rows.

## Inputs / context

- **The workflow.** `docs/workflows/15-set-up-an-instrument.md`:
  - §The roster, and switching (L60–96). The roster with its *in use* word. The
    `instrumentInUse` register, "absent meaning the standard guitar — the
    built-in the app shows until the user has set anything up". The new paragraph
    at L72–79 is this task's delta.
  - §Removing an instrument (L197–209). The confirm names what goes. The new
    zero-shapes sentence at L202–204 is this task's delta.
- **Workflow 1.** `docs/workflows/01-*.md` L79–82 makes the standard guitar the
  default in use, shown on the chip.
- **The board.** `docs/mockups/W15-set-up-an-instrument.dc.html`:
  - L28–46 (phone #1): the row *Guitar · E A D G B E*, meta *Strumming · 6
    strings*, `badge ok` *in use*.
  - L218–219: the desktop confirm copy.
  - `e2e/web/lib/mockup-frames.json` L404–427 lists the W15 frames.
- **The home-book format.** `docs/home-book-format.md` §2.1 (L89–92): files are
  written lazily. §4.3 is `instruments.json`.
- **The roster overlay.** `app/src/instruments/InstrumentsOverlay.jsx`:
  - L52–54: the roster reads only `slice.instruments` and `slice.inUseId`, never
    `slice.standard`.
  - L87–91: the detail lookup searches `instruments` only.
  - L113–124: the roster list.
  - L31–49: `RosterRow`.
  - L195–303: the detail screen; L199 is `shapeCount`.
  - L265–300: the Remove `DialogTrigger`; L276–279 is the confirm body.
- **The chip.** `app/src/instruments/InstrumentChip.jsx` L20–27, `inUseEntry(slice)`:
  the stored entry whose id is `inUseId`, else `slice.standard`. The chip, the
  explorer (`ChordExplorer.jsx` L49) and search (`SearchScreen.jsx` L415) use it.
- **The helpers.** `app/src/instruments/instrument-helpers.js`:
  - L57–61: `displayLabel`. The fallback reads *Guitar (6-string) · E2 A2 D3 G3
    B3 E4*.
  - L111–119: `chipLabel`.
  - Their test is `instrument-helpers.test.js`.
- **The Worker's pure module.** `app/src/worker/instruments.js`:
  - L47: `STANDARD_INSTRUMENT_ID = 'standard'`.
  - L156–176: `standardEntry()`.
  - L188–210: `surfaceInstruments`. It returns `standard: null` once the standard
    is materialized, and it turns an `inUseId` that is not in the stored roster
    into `null`.
  - L239–285: `instrumentRemoval`.
  - L304–331: `standardMaterialization`. It is idempotent and sets in use only
    when the register is absent.
- **The Worker's command arms.** `app/src/worker/logic.js`:
  - L3222: `SAVE_INSTRUMENT`. The edit branch writes only `definition`.
  - `SET_INSTRUMENT_RULES` comes right after it. It writes only `rules`.
  - L3292: `USE_INSTRUMENT`.
  - L3311: `REMOVE_INSTRUMENT`.
  - About L3378–3395: the `SAVE_SHAPE` arm, which materializes the standard before
    writing its shape leaf. This is the pattern to mirror.
- **i18n.**
  - `app/src/i18n/locales/en.js` L2632–2638: `instr.remove.{title,shapes,body}`.
    The same block is in `pt-BR.js` (about L2474), `es-419.js` (about L2480) and
    `it.js` (about L2481).
  - `app/src/i18n/index.js` L127–131: the plural select uses `Intl.PluralRules`
    with a fallback to `other`. English never picks `zero`, so 0 falls to
    *Its 0 saved shapes*.
- **Existing tests.**
  - `app/src/instruments/instruments.behavior.test.jsx`: L259 tests the roster
    marking on a seeded `g1`. L330 tests shapes and removal. It has no
    fresh-roster case and no zero-shape case.
  - `e2e/web/tests/instruments.spec.js`: test 1 (L28) takes `mockup` W15 #1 on
    the fresh roster. Test 2 (L84) removes a 0-shape *My Drop D* at mockup W15 #4.
  - The journey helpers are in `e2e/web/lib/journeys-core.js` L93–129 (`chip`,
    `addInstrument`, `closeInstruments`).
- **Predecessor refinements.**
  - `tasks/refinements/music/instruments.md`. AC 1 (L342–349) is the roster.
    AC 5 (L377–385) is the confirm copy. The decision at L475–485 makes the
    in-use a singleton register whose absence means the standard.
  - `tasks/refinements/music/explorer_standard_shapes.md` L97–117 and L348–404.
    The id is reserved and fixed. A stored standard is an ordinary roster entry.
    The standard is materialized lazily, on a write.

## Constraints / requirements

- **The Worker's surfaced shape stays as it is.** `surfaceInstruments` keeps
  returning `{ instruments, inUseId, standard }`, with `standard` non-null only
  while the standard is unmaterialized. The chip, the explorer and search depend
  on that shape. SAVE_INSTRUMENT's "first instrument goes into use" rule reads
  `preferences.json`, not the slice, and stays unchanged.
- **No write merely for viewing.** Listing the standard, opening its screen and
  looking at it write nothing (home-book §2.1 lazy writes). A write happens only
  when the user changes something: its rules, its definition, a star, or
  switching to it.
- **Materialize before a partial write.** `SAVE_INSTRUMENT` (edit branch) and
  `SET_INSTRUMENT_RULES` on `id === STANDARD_INSTRUMENT_ID` each write a single
  register. Before that write, each runs `standardMaterialization` under its own
  file locks, never nested, the same way `SAVE_SHAPE` does. Otherwise a rules
  edit would leave a stored `'standard'` entry with no definition.
  `standardMaterialization` sets in use only when the register is absent, so
  editing the built-in's rules while *Drop D* is in use does not switch
  instruments.
- **Switching to the unmaterialized standard.** `USE_INSTRUMENT` with `'standard'`
  keeps writing the id. `surfaceInstruments` already resolves a dangling id to the
  standard, and a later materialization finds `'standard'` already in use. This
  needs no change in the Worker.
- **The view stays thin** (DIRECTION §3.7). The overlay reads the slice and sends
  commands. It never touches IndexedDB.
- **Accessibility.**
  - The standard's row is the same RAC `Button` as every row: *Open {label}*,
    with *in use* as a word badge.
  - The empty-roster case goes away. When the standard is stored, the roster
    shows one standard row, never two.
  - axe stays clean at WCAG 2.1 AA.
- **Copy in all four locales.** The new zero-shapes body is added to `en`,
  `pt-BR`, `es-419` and `it`. It is a distinct key, not a `zero` plural form,
  because the plural rules never select `zero` for 0 in these locales.

## Acceptance criteria

Behavior:

1. **Fresh device.** The roster opened from the chip lists one row,
   *Guitar (6-string) · E2 A2 D3 G3 B3 E4* (`displayLabel` of the standard), with
   meta *Strumming · 6 strings* and the word *in use*. *Add instrument* sits at
   the foot. Opening the roster writes nothing to the home book.
2. **After an add.** Once *My Drop D* is added (and goes into use), the roster
   lists the built-in guitar first, without *in use*, and *My Drop D* with
   *in use*. Opening the guitar and choosing *Use this instrument* switches back.
   The chip then reads *Guitar*, and the guitar's row is the one marked.
3. **The built-in's screen.**
   - It shows its definition, rules and my shapes (empty), and has no
     *Remove instrument*.
   - Changing its rules stores it under `'standard'` with both `definition` and
     `rules`. The roster still shows one guitar row, now an ordinary stored entry
     that offers *Remove instrument*. Editing its definition stores it the same
     way.
4. **The stored standard.** After a star, or one of the edits above, the standard
   is an ordinary roster entry. Removing it falls back to the built-in, which is
   listed again, *in use* (workflow 15 §Removing).
5. **The remove confirm.**
   - With zero saved shapes it reads: *The song variations in use for
     `<tuning>` are removed with it. Your songs keep their own voicings — only
     this instrument's own settings go.* It has no *Its 0 saved shapes*.
   - With one or more shapes it keeps the existing *Its N saved shape(s) and …*.

Tests, by level:

- **unit:** `app/src/instruments/instrument-helpers.test.js` covers a new pure
  helper, `rosterEntries(slice) → { entries, inUseId }`. It pins workflow 15
  §The roster (the delta at L72–79):
  - no stored instrument: `[standard]`, in use `'standard'`;
  - stored instruments with the in-use one among them: the standard first, then
    the stored entries, in use the stored id;
  - absent or dangling `inUseId`: in use `'standard'`;
  - a materialized standard (`standard: null`): only the stored entries, the
    stored `'standard'` in use when the register names it;
  - an empty or null slice: no throw, the standard-less empty list.

  The helper agrees with `inUseEntry` by construction: its `inUseId` is
  `inUseEntry(slice)?.id`.
- **behavior:** `app/src/instruments/instruments.behavior.test.jsx`. It runs
  against the real `createWorkerLogic` and a local git remote, like its existing
  cases:
  - (a) **a fresh roster lists the built-in guitar in use** (AC 1). No seeding.
    The test asserts the `^Open Guitar` row, the *in use* word and
    *Strumming · 6 strings*, and that `instruments.json` and `preferences.json`
    were not written. axe is clean on the roster.
  - (b) **switch back to the built-in** (AC 2): add *My Drop D*, open the guitar,
    *Use this instrument*. The chip reads *Guitar* and the guitar's row carries
    *in use*.
  - (c) **the built-in's screen and a rules change** (AC 3): no *Remove
    instrument* until a rules preset is changed. After the change,
    `instruments.json['standard']` holds both `definition` and `rules`, and one
    guitar row remains. axe is clean on the detail screen.
  - (d) **the zero-shape confirm** (AC 5): remove a 0-shape instrument. The
    dialog text has no `0 saved shape` and starts with *The song variations in
    use for*. The existing L330 case keeps pinning the N-shapes copy. Assert its
    *Its 1 saved shape* text if it does not already.
- **e2e-web:** `e2e/web/tests/instruments.spec.js`, on phone, tablet and
  computer, through the real UI only:
  - Test 1 (first run → Instruments): after the chip opens the roster, and before
    `mockup(page, 'W15-set-up-an-instrument', 1)`, assert the `^Open Guitar` row
    and the word *in use* in it. This pins workflow 15 §The roster and board
    W15 #1. `checkA11y()` stays on the roster.
  - Test 2 (removing):
    - At mockup W15 #4, the alertdialog does not contain `0 saved shape`, and it
      contains *The song variations in use for* (workflow 15 §Removing).
    - After the removal, the roster lists the `^Open Guitar` row with *in use*
      before Escape. This pins the fallback being listed.

Nothing is deferred.

## Decisions

1. **List the standard in the view, not in the Worker's surfaced roster.** A pure
   main-thread helper, `rosterEntries(slice)`, puts `slice.standard` in front of
   `slice.instruments` and resolves in-use as `inUseEntry(slice)?.id`. The
   overlay uses it for the roster and for the detail lookup.
   - *Rejected:* folding the synthesized standard into
     `surfaceInstruments().instruments`. That changes what "the stored roster"
     means for `inUseEntry`, SAVE_INSTRUMENT's first-add rule, and the
     `standard: null` once-materialized contract that `explorer_standard_shapes`
     pinned. It would ripple into the chip, the explorer and search for no gain.
   - The helper reuses `inUseEntry`, so the roster's marking and the chip cannot
     disagree.
2. **The built-in stays listed after the user adds instruments.** The board lists
   the standard guitar beside Drop D, cavaquinho and ukulele.
   - *Rejected:* listing it only while the roster is empty. Then a user whose
     first add went into use could never get back to the default without
     re-adding it. That turns "switching is one tap" into a set-up flow.
3. **Show no *Remove* on the unmaterialized standard.** Removing nothing has no
   effect, and the built-in is what removal falls back to, so it would come
   straight back.
   - *Rejected:* a disabled button with an explanation. That is an extra string
     and an extra state for a no-op.
   - Once the standard is stored it is ordinary and removable, as
     `explorer_standard_shapes` settled.
4. **Writes to its rules or definition materialize first, in the Worker.** This
   mirrors `SAVE_SHAPE` and reuses `standardMaterialization`. The view sends the
   same commands it sends for any instrument.
   - *Rejected:* hiding Edit and the rules on the built-in. Workflow 15 gives
     every instrument its own rules, and the default guitar is the one most users
     will tune the rules for.
   - *Rejected:* materializing on first open. That writes for viewing, against
     home-book §2.1's lazy writes.
5. **Zero shapes get a separate message key, not a `zero` plural form.**
   `Intl.PluralRules` gives `other` for 0 in en, pt-BR, es-419 and it, so a
   `zero` form would never fire. The fix is a component branch on
   `shapeCount === 0` and a new key, `instr.remove.bodyNoShapes`, in the four
   locales.
6. **The row's label stays as it is.** It remains `displayLabel(standard)` (*Guitar
   (6-string) · E2 A2 D3 G3 B3 E4*). That matches what the materialized standard
   already shows and how the roster tells instruments apart in full. The board's
   abbreviated *Guitar · E A D G B E* row styling belongs to
   `music.instruments_layout` (W15 as drawn), not here.
7. **Design delta.** Workflow 15 did not say that the built-in is a roster row,
   that it has no Remove until stored, or what the confirm says with no shapes.
   The two paragraphs added at L72–79 and L202–204 settle all three. No
   home-book-format change is needed. The reserved id and the lazy
   materialization are already designed.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-16.

- The roster lists the built-in standard guitar first, marked *in use* while it is the one in use: pure `rosterEntries` helper in app/src/instruments/instrument-helpers.js (`inUseEntry` moved there, re-exported from app/src/instruments/InstrumentChip.jsx).
- app/src/instruments/InstrumentsOverlay.jsx: the not-yet-stored built-in offers no Remove; the no-shapes remove confirm uses the new `instr.remove.bodyNoShapes` message.
- app/src/worker/logic.js: a shared helper stores the standard under `'standard'` on a rules or definition change (also used by the star path).
- app/src/i18n/locales/{en,pt-BR,es-419,it}.js: `instr.remove.bodyNoShapes`.
- Unit: app/src/instruments/instrument-helpers.test.js (`rosterEntries` cases). Behavior: app/src/instruments/instruments.behavior.test.jsx (fresh roster, switch back, built-in screen and stored standard, zero-shape confirm; axe).
- e2e-web: e2e/web/tests/instruments.spec.js (built-in row in use, zero-shapes confirm, fallback row); locators narrowed in e2e/web/tests/explorer.spec.js and full-height.spec.js.
- Design delta: docs/workflows/15-set-up-an-instrument.md. No tech-debt follow-up.
