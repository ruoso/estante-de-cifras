# shell.header_chrome — The header as drawn: wordmark and a short instrument chip

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 113–118, task
`shell.header_chrome` ("The header as drawn: wordmark and a short instrument
chip"), under `task shell`. It `depends !layout, music.instruments` and sits in
the polish milestone `milestones.m5_complete` (`tasks/99-milestones.tji` line
44). The note, verbatim:

> The instrument chip shows the full tuning (Guitar (6-string) · E2 A2 D3 G3 B3
> E4) and is clipped by the account button on a phone; the boards and workflow 1
> (The instrument) draw a short chip (Guitar), and its copy varies between
> screens (W16). The phone shelf is titled Search where the boards put the
> Estante wordmark, and the computer search rail lacks the wordmark and the chip
> (W02 desktop). One chip label everywhere, the full tuning as its accessible
> description. Source: UI audit 2026-10-14 (app screens vs rendered boards;
> e2e/web/lib/mockup.js). Tests: unit (the chip label for each instrument);
> behavior (the chip and wordmark on each destination, axe); e2e-web (the header
> on the three viewports with no clipping, mockup W01#1, W02#1, W02#4).

## Effort estimate

**1 day** (from the `.tji`). One pure label/description helper pair with its
unit tests, one small header component reused in four places, a handful of
call-site swaps from ad-hoc instrument copy to the helper, CSS for the phone
header row and the rail heads, three i18n tables across four locales, and one
e2e-web spec.

## Repository

**estante-de-cifras only** — `app/src/` (`instruments/`, `shell/`, `songs/`,
`music/`, `books/`, `i18n/locales/`) and the e2e-web harness
(`e2e/web/tests/`). Not format work; the note does not start with `cifra.md:`.
Nothing touches the service, the API or cifra.md.

**Design delta (rides in this task's commit):**

- `docs/workflows/15-set-up-an-instrument.md` §The roster, and switching — the
  chip's label was written as *Guitar · E A D G B E*; it now states the one
  short label (the user's name, else the short instrument name plus the
  tuning's name when not standard) and the full identity as the accessible
  description.
- `docs/workflows/16-chord-explorer.md` (the instrument-in-use paragraph,
  ~L29) — the same correction, by reference to workflow 15.
- `docs/workflows/01-first-run.md` §The instrument — the header's contents:
  the *Estante* wordmark, the chip, the account affordance; above every
  destination on a phone, at the head of the side rail on a tablet or computer.

These make the workflows say what the boards already draw (W01, W02, W16 phone
and computer frames draw a chip reading *Guitar*); they do not invent a new
behaviour.

## Inherited dependencies

Settled (all `complete 100`):

- `shell.layout` — `AppShell` on RAC `Tabs`; narrow `.screen` with a bottom
  `.tabbar`, wide `.split` with `.pane.side` (`.side-head` + `.rail`) and
  `.pane.main`; breakpoint `(min-width: 600px)` (`app/src/shell/layout-mode.js:22`).
  No shared app bar; each deep screen composes its own `.appbar`
  (layout.md Decisions; parking-lot "Shared deep-screen app bar" stays parked —
  this task does not extract one).
- `music.instruments` — `InstrumentChip` is "the one shared piece of shell
  chrome" (instruments.md Decision 1), mounted in the wide `.side-head`
  (`AppShell.jsx:1104`) and the narrow `.instr-top` strip (`AppShell.jsx:1125`),
  plus in `ChordExplorer.jsx:259` (its `.appbar`) and `SongReading.jsx:554`
  (`.reading-meta`). Pressing it opens `InstrumentsOverlay`.
- `shell.full_height` — the chip must stay in view while content scrolls
  (`e2e/web/tests/full-height.spec.js:209` `stayInView`); this task keeps every
  chip it places outside the scroller.
- `shell.dev_mount_open` — OPEN is sent from `App`, so `AppShell` holds no open
  effect; irrelevant here beyond not reintroducing one.

Sibling, not a dependency: `shell.narrow_fit` fixes the other fit defects
(search field wrap, toolbars, "the explorer title truncates and the chip clips
at tablet width (W16)"). With the short label this task removes the chip's
cause of the W16 clip; `narrow_fit` keeps its e2e "nothing wider than the
viewport" sweep.

## What this task is

Make the header look and read as the boards draw it. The instrument chip shows
**one short label on every screen** (*Guitar*, *Cavaquinho*, *Guitar · Drop D*,
or the user's own name for the instrument), and carries the full identity
(*Guitar (6-string), Standard tuning: E2 A2 D3 G3 B3 E4*) as its accessible
description. Every other place that names the instrument in use in running
copy (arrange's mode chip, the reading view's "arrange for" and "no voicings",
the explorer's empty state, search's "Explore A on your …", the home-book
restore notice) uses the same label. The phone's header row reads **Estante**
(the wordmark), the chip and the account button above every destination,
instead of a chip-only strip and a visible "Search" title; the tablet/computer
side header reads *Estante* (not *Estante de Cifras*) with the chip and the
account button; and the search rail that sits beside an open song or the chord
explorer on a tablet or computer gains a head with the wordmark and the chip.

## Why it needs to be done

The UI audit of 2026-10-14 (app screenshots via `e2e/web/lib/mockup.js` vs the
rendered boards) found: the default chip reads `Guitar (6-string) · E2 A2 D3 G3
B3 E4` (`displayLabel`, `app/src/instruments/instrument-helpers.js:56-60`) and
is clipped by the account button on a phone; the chip's copy differs between
screens (`SongArrange.jsx:136` and `SongReading.jsx:301` use `entry?.label ??
"instrument"`, so the default guitar reads "Arranging · instrument");
`SearchScreen.jsx:412` reads a `preferences.instrument` value nobody sets, so
search always says "on your instrument"; the phone shelf shows the "Search"
title where the boards draw the wordmark; and the reading/explorer search rail
on a computer (W02#4) has neither wordmark nor chip. It is in the M5 polish
milestone; nothing downstream depends on it.

## Inputs / context

Governing documents:

- `docs/workflows/01-first-run.md` §The instrument (L68–78): the standard guitar
  "shown as a chip in the header, and changed from there".
- `docs/workflows/15-set-up-an-instrument.md` §The roster, and switching
  (L60–): the chip in the header, everywhere; L88–94: a new instrument's
  default label is *catalogue · tuning* (*Guitar · Drop D*).
- `docs/workflows/16-chord-explorer.md` L29–31 (the chip as everywhere else),
  L154–156 ("the chord input and the instrument chip stay reachable").
- Boards (`docs/mockups/`):
  - `W01-first-run.dc.html` phone 1 (L30–34): header row `<span class="t-h1"
    style="flex: 1">Estante</span>` + `<span class="chip accent">Guitar</span>`
    + `<button class="btn icon" aria-label="Account">`, then the search box —
    no "Search" title. Computer (L144–148): `.pane.side` top row *Estante* +
    chip *Guitar*.
  - `W02-find-and-play.dc.html` phone 1 (L30–34): the same header, search typing
    "A". Computer (L151–169): the rail beside the song — top row *Estante* +
    *Guitar*, then search, Recent, Books; the main `.appbar` (L172) carries no
    chip.
  - `W16-chord-explorer.dc.html`: chip is a button,
    `aria-label="Guitar, change instrument"`; phone *Guitar* / *Cavaquinho*;
    tablet/computer appbar draws *Guitar · E A D G B E* — the copy variance the
    note calls out; computer side pane *Estante* + *Guitar*.
  - `docs/mockups/theme.css`: `.t-h1` (L131) for the wordmark, `.chip` (L176),
    `.chip.accent` (L177), `.btn.icon` (L154), `.pane.side` (L145).
- Frames (`e2e/web/lib/mockup-frames.json`): W01#1 (phone, cold start search),
  W02#1 (phone, typing "A"), W02#4 (computer, search beside the song).
  `mockup(page, board, index, { note })` at `e2e/web/lib/mockup.js:45` is a
  no-op unless `ESTANTE_E2E_MOCKUPS` is set; existing calls at
  `first-run.spec.js:45`, `search.spec.js:57`, `reading.spec.js:66`.

Code seams:

- `app/src/instruments/InstrumentChip.jsx:26-38` — RAC `Button`,
  `className="chip accent instrument-chip"`, `aria-label={t('instr.chip.change',
  { label })}`; `inUseEntry(slice)` (L17).
- `app/src/instruments/instrument-helpers.js` — `catalogName` (L35),
  `tuningName` (L42), `displayLabel` (L56), `defaultLabel` (L65),
  `tuningText` (L29).
- `app/src/instruments/AddInstrumentForm.jsx:105-129` — every added instrument
  stores a `label`: the user's name, or the suggested `defaultLabel(catalogId,
  tuningName(preset) | §6 text)` in the locale of the moment.
- `app/src/worker/instruments.js` — roster entry `{ id, catalogId, label|null,
  tuning (§6 text, space-separated), … }`; the standard fallback has
  `label: null`, `tuning: 'E2 A2 D3 G3 B3 E4'` (L36, L156–176).
- `app/src/data/instruments.js` — `CATALOG`, each entry's `tunings[0]` is its
  standard (6guitar *Standard*, ukulele *Standard (re-entrant)*, cavaquinho
  *Standard (Brazil)*, …); `strings` comma-separated.
- `app/src/shell/AppShell.jsx:1096-1127` — wide `.side-head` (`t('app.name')`
  wordmark, chip, `AccountButton` L109–129) and narrow `.instr-top`
  (chip + account). CSS: `app/src/shell/shell.css:93-105` (`.side-head`),
  `app/src/instruments/instruments.css:8-22` (`.instr-top`, `.instrument-chip`).
- `app/src/songs/SearchScreen.jsx:412` (`instrument` copy), `:524` (`<h1
  className="t-h1">{t('shell.search')}</h1>`).
- `app/src/songs/SongReading.jsx:301` (instrument copy), `:554` (chip in
  `metaRow`), `:564-569` (wide `.reading-split`, `SearchScreen` in
  `.pane.side.reading-side`).
- `app/src/music/ChordExplorer.jsx:214` (empty-state copy), `:259` (chip in
  `.appbar`), `:265-279` (wide `.explorer-split`, `SearchScreen` in
  `.pane.side.explorer-side`).
- `app/src/songs/SongArrange.jsx:136` (instrument copy for
  `arrange.selectorCaption`, `arrange.modeChip`, `arrange.noShapes`).
- `app/src/books/BooksScreen.jsx:312` (restore notice, `displayLabel`).
- i18n: `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — `app.name`
  ("Estante de Cifras", L8), `catalog.*` (en L1494–1503), `tuning.*`,
  `instr.chip.change` (en L2438); `i18n/i18n.test.js` holds the catalogues in
  key parity. `pwa/manifest.js:29-30` already uses `short_name: 'Estante'`.

Predecessor refinements: `tasks/refinements/shell/layout.md`,
`tasks/refinements/music/instruments.md` (Decision 1: the chip as shell
chrome, rejected placing it in each screen's `.appbar`),
`tasks/refinements/shell/full_height.md` (the chip stays in view).

## Constraints / requirements

- **The view only.** Label and description are pure display logic in
  `instrument-helpers.js` (no React, no IndexedDB); the Worker's slice is
  unchanged and no stored instrument data is rewritten.
- **Accessibility.** The chip stays a RAC `Button`; its accessible name keeps
  the `instr.chip.change` pattern (*"Guitar, change instrument"*), so every
  existing lookup by `/change instrument/` still finds it; the full identity is
  an `aria-describedby` description (a visually hidden element referenced by
  id — no `title` tooltip). Axe clean at WCAG 2.1 AA on every screen touched.
  The wordmark is text, not a heading: the destination's own `h1` stays the
  page heading.
- **One chip per screen.** No screen shows two instrument chips (two
  identically named buttons would make the screen ambiguous to a screen-reader
  user and to `getByRole`).
- **The chip stays reachable while content scrolls** (workflow 16 L154–156;
  full_height): every placement is outside the scroller.
- **i18n.** New copy in all four locales; the wordmark *Estante* is the proper
  noun, the same in every catalogue (like `app.name`). Document `<title>` and
  the PWA manifest keep *Estante de Cifras*.
- **Offline first** is untouched; nothing here waits on the network.

## Acceptance criteria

### Behavior delivered

1. **`chipLabel(entry)`** in `app/src/instruments/instrument-helpers.js`:
   - a **user-chosen label** (any stored `label` that is not a default) is
     shown as is (*My Drop D*);
   - otherwise — `label` null (the standard fallback) or a stored label equal
     to the default `defaultLabel(catalogId, tuningName(preset))` /
     `defaultLabel(catalogId, §6 text)` in the current locale or the
     catalogue's raw (English) names — the **short name** from a new
     `catalogShort.<id>` i18n table (en: *Guitar*, *7-string guitar*, *Bass*,
     *5-string bass*, *Ukulele*, *Cavaquinho*, *Mandolin*, *Tenor banjo*),
     followed by ` · <tuning name>` (`tuningName`) when the entry's tuning is a
     preset other than the catalogue's first (*Guitar · Drop D*), or
     ` · ` + `t('tuning.custom')` when it matches no preset (*Guitar ·
     Custom*). Tuning matching compares pitch lists through `tuningText`, so
     comma vs space spelling does not matter.
2. **`chipDescription(entry)`**: the full identity, via a new
   `instr.chip.description` message — en *"{catalogue}, {tuning} tuning:
   {pitches}"* (*Guitar (6-string), Standard tuning: E2 A2 D3 G3 B3 E4*); a
   custom tuning reads *"…, custom tuning: …"* (`instr.chip.descriptionCustom`).
   When the label is the user's own, the description is the same full identity
   (it is what the name stands for).
3. **`InstrumentChip`** renders `chipLabel` as its text, `aria-label =
   t('instr.chip.change', { label: chipLabel })`, and `aria-describedby`
   pointing at a visually hidden span holding `chipDescription` (id from
   `useId`). It keeps its single-line ellipsis as a last resort, never as the
   normal case.
4. **One label everywhere.** `displayLabel` stays for the roster and the
   instrument detail (`InstrumentsOverlay.jsx` :32, :211, :273 — where
   instruments must be told apart in full). Every other place naming the
   instrument in use uses `chipLabel(inUseEntry(slice))`: `SongArrange.jsx:136`,
   `SongReading.jsx:301`, `ChordExplorer.jsx:214`, `BooksScreen.jsx:312`, and
   `SearchScreen.jsx:412` (which reads the `instruments` slice instead of the
   unset `preferences.instrument`). So the default guitar reads *Arranging ·
   Guitar*, *Arrange for Guitar*, *Explore A on your Guitar*.
5. **`HeaderChrome`** — a small component (`app/src/shell/HeaderChrome.jsx`):
   the wordmark `<span className="t-h1 wordmark">{t('app.wordmark')}</span>`
   (new key, *Estante* in every locale, `flex: 1`), the `InstrumentChip`, and
   optionally the `AccountButton` (moved out of `AppShell.jsx` beside it, or
   exported from it). Placements:
   - **phone shell** (`AppShell` narrow): the `.instr-top` strip becomes the
     header row *Estante · Guitar · Account* above every destination (Search,
     Books, Setlists), kept out of the scroller with `order: -1` as today;
   - **tablet/computer shell** (`AppShell` wide `.side-head`): *Estante* (no
     longer *Estante de Cifras*) · chip · Account;
   - **the search rail beside a song** (`SongReading` wide, `.reading-side`)
     and **beside the explorer** (`ChordExplorer` wide, `.explorer-side`): a
     rail head *Estante · chip* above `SearchScreen`, outside its scroller (no
     account button — the boards draw none there). On wide, the chip in
     `SongReading`'s meta row and in `ChordExplorer`'s `.appbar` is dropped, so
     each screen has one chip; on narrow they stay where they are (W02 phone 2,
     W16 phone 1).
6. **The "Search" title is visually hidden.** `SearchScreen`'s `<h1>` stays in
   the DOM as the page heading (outline, screen readers, `getByRole('heading',
   { level: 1, name: 'Search' })`) but is visually hidden on every layout (the
   app's existing visually-hidden utility if there is one, else one added to
   `shell.css`), because the wordmark row is what the boards draw there. Books
   and Setlists keep their visible titles.
7. **No clipping.** At 370 px (the W01/W02 phone frame) the phone header row
   shows the wordmark, the chip and the account button in full, none
   overlapping, with the default guitar and with *Guitar · Drop D*.

### Tests, by level

- **unit — `app/src/instruments/instrument-helpers.test.js`** (new):
  - every `CATALOG` entry at its first preset (label null) → its short name
    (*Guitar*, *7-string guitar*, *Bass*, *5-string bass*, *Ukulele*,
    *Cavaquinho*, *Mandolin*, *Tenor banjo*);
  - each non-first preset → *short · preset name* (*Guitar · Drop D*,
    *Ukulele · Low G*, *7-string guitar · Brazilian*, …);
  - a tuning matching no preset → *Guitar · Custom*;
  - a stored default label (`defaultLabel('6guitar', 'Drop D')`, and the §6-text
    default of a custom tuning) is shortened like a null label; a user label
    (*My Drop D*) is kept verbatim;
  - `chipDescription` for the standard guitar (*Guitar (6-string), Standard
    tuning: E2 A2 D3 G3 B3 E4*), a preset and a custom tuning;
  - one pt-BR case (*Violão*, description in Portuguese) through the locale
    switch `i18n.test.js` already uses.
  *Pins:* workflow 15 §The roster, and switching (as amended), L88–94 (default
  label); workflow 1 §The instrument.
- **unit — `app/src/i18n/i18n.test.js`**: the existing parity check covers the
  new `catalogShort.*`, `app.wordmark`, `instr.chip.description*` keys in all
  four locales; add `t('app.wordmark') === 'Estante'` in every locale beside
  the `app.name` case (L107–109).
- **behavior — `app/src/shell/AppShell.behavior.test.jsx`**:
  - narrow: on each of Search, Books, Setlists the header shows the text
    *Estante*, a button named *Guitar, change instrument* with text *Guitar*
    and accessible description *Guitar (6-string), Standard tuning: E2 A2 D3 G3
    B3 E4*, and the *Account* button; the Search destination still has its
    level-1 heading *Search*; exactly one chip; axe clean via `checkWcag21aa`;
  - wide: the side header shows *Estante* (not *Estante de Cifras*), the chip
    and *Account* on each destination; axe clean.
  *Pins:* workflow 1 §The instrument (as amended); W01 phone 1 / computer.
- **behavior — `app/src/instruments/instruments.behavior.test.jsx`**: update
  the chip assertions to the new rule — after adding *Drop D* through the form
  without renaming, the chip reads *Guitar · Drop D* (not *Guitar (6-string) ·
  Drop D*) and its description names the pitches; a renamed instrument shows
  its name; the custom-tuning case (today L203 `/G4 C4 E4 A4/`) asserts the
  pitches in the **description** and *· Custom* in the label; roster rows keep
  their full `displayLabel` (`/^Open Guitar \(6-string\) · …/` style lookups
  unchanged); axe clean. *Pins:* workflow 15 §The roster, and switching.
- **behavior — `app/src/songs/SongReading.behavior.test.jsx`**: wide — the rail
  head shows *Estante* and the chip, the meta row shows none, exactly one
  button named `/change instrument/`; narrow — the chip in the meta row, no
  wordmark; with the unlabelled standard fallback, "Arrange for Guitar" (not
  "instrument"); axe clean. *Pins:* W02 phone 2 / computer; workflow 2.
- **behavior — `app/src/music/ChordExplorer.behavior.test.jsx`**: wide — rail
  head *Estante* + chip, no chip in the `.appbar`, one chip; narrow — chip in
  the `.appbar`; the empty state names the instrument by `chipLabel`; axe
  clean. *Pins:* workflow 16 L29–31 (as amended), L154–156.
- **behavior — `app/src/songs/SongArrange.behavior.test.jsx`**: with the
  standard fallback (no label) the mode chip reads *Arranging · Guitar*.
  *Pins:* workflow 5's mode chip naming the instrument; the note's "copy varies
  between screens".
- **behavior — `app/src/songs/SearchScreen.behavior.test.jsx`**: typing a chord offers *Explore A on your Guitar* with
  the standard fallback and *… on your Cavaquinho* with a cavaquinho in use.
  *Pins:* workflow 2 L28.
- **e2e-web — `e2e/web/tests/header.spec.js`** (new; `test`/`expect` from
  `../lib/axe.js`, real-UI journeys only — `startApp`, `gotoTab`,
  `openExampleBook`, `openSongFromSearch`, `openExplorerFor`, `addInstrument`,
  `closeInstruments`, `chip` from `e2e/web/lib/journeys*.js`), on phone, tablet
  and computer:
  - cold start: the header shows *Estante*, the chip *Guitar* with accessible
    description *Guitar (6-string), Standard tuning: E2 A2 D3 G3 B3 E4*
    (`toHaveAccessibleDescription`), and *Account*; the three boxes lie inside
    the viewport, do not intersect, and the chip is not ellipsized
    (`scrollWidth <= clientWidth`); `mockup(page, 'W01-first-run', 1)`; axe;
  - Books and Setlists destinations: the same header (wordmark, chip, account);
    axe;
  - typing "A" in search: `mockup(page, 'W02-find-and-play', 1)`; the explore
    row reads *Explore A on your Guitar*;
  - opening a song (example book): on tablet and computer the rail beside it
    shows *Estante* and the chip and the page has exactly one visible chip;
    `mockup(page, 'W02-find-and-play', 4)`; axe;
  - the chord explorer: exactly one visible chip on each viewport;
  - after `addInstrument` of *Guitar* · *Drop D* (not renamed): the chip reads
    *Guitar · Drop D* on every viewport, still unclipped beside the account
    button on the phone; axe.
  *Pins:* the note's audit findings (W01#1, W02#1, W02#4); workflow 1 §The
  instrument and workflow 15 §The roster, and switching (as amended).
  Existing specs keep passing unchanged: chip lookups by `/change instrument/`,
  `toContainText('Guitar')` / `('Ukulele')` (instruments.spec.js), the
  `h1 'Search'` checks (app-loads, offline, pwa, navigation — the heading is
  still in the accessibility tree), the full-height `stayInView` chip.

Every prerequisite exists: the shell, search, the example book, reading, the
explorer and the instrument add form are all built (`shell.layout`,
`songs.search`, `songs.reading`, `music.explorer`, `music.instruments`, all
`complete 100`); no hosted book, sign-in or second device is needed.

No test level is dropped. No test is deferred. No deferred WBS leaf.

## Decisions

1. **The chip label is short; the full identity is the description.**
   *Rationale:* the note settles it ("one chip label everywhere, the full
   tuning as its accessible description"); the boards draw *Guitar*.
   *Rejected:* keeping the tuning pitches visible on wide screens (W16
   tablet/computer draw *Guitar · E A D G B E*) — that is exactly the
   between-screens variance the note asks to remove.
2. **A non-standard tuning shows its name; the standard does not.**
   *Rationale:* the roster can hold *Guitar · Standard* and *Guitar · Drop D*
   as two instruments (workflow 15 L96–99); a bare *Guitar* for both would make
   the chip lie about which is in use. The standard is the unmarked case, so
   the common chip is one word. *Rejected:* the bare catalogue name always
   (ambiguous); the catalogue's full name *Guitar (6-string)* (longer than the
   boards and the reason it clipped).
3. **A stored default label is recognised and shortened rather than migrated.**
   Every instrument added so far stores `defaultLabel(…)` as its label
   (`AddInstrumentForm.jsx:128`), indistinguishable in the data from a typed
   name. `chipLabel` treats a label equal to the default (current locale, or
   the catalogue's raw names) as no label. *Rejected:* rewriting stored labels
   in `instruments.json` (touches the user's data for a display concern);
   changing the form to store `label: null` (leaves existing data long-form and
   changes what the roster shows). Known edge: a default label stored in one
   locale and read in another shows as stored — harmless, and the user can
   rename.
4. **Roster and detail keep `displayLabel`.** The roster is where instruments
   are told apart in full; it is not the chip. Only places that name the
   instrument *in use* in passing use `chipLabel`.
5. **The wordmark is *Estante*, a new key, not `app.name`.** The boards and the
   PWA `short_name` say *Estante*; the document title and manifest `name` keep
   *Estante de Cifras*. It is a `span`, not a heading — the destination's own
   `h1` remains the page heading.
6. **The Search title is visually hidden, not removed.** *Rationale:* the
   boards draw no "Search" title (the wordmark is the row), but a page needs a
   level-1 heading, and five specs and `App.test.jsx` find it by role.
   *Rejected:* making the wordmark the `h1` (the same `h1` would then read
   "Estante" on Books and Setlists too, which have their own titles); deleting
   the heading (breaks the outline).
7. **One chip per screen; on wide the rail head carries it.** On the reading
   and explorer splits the boards draw the chip at the head of the rail (W02
   computer; W16 computer side pane). Showing it there *and* in the reading
   meta row / explorer appbar would put two identically named buttons on one
   screen. So on wide the rail head holds it and the other placement is
   dropped; on narrow (no rail) they stay. *Rejected:* keeping the explorer's
   appbar chip on wide as W16's computer frame also draws — that frame is the
   variance being removed, and workflow 16 L154–156's "stays reachable" is met
   by the fixed rail head. *Rejected:* a shared app bar component — still
   parked (`shell.layout`); `HeaderChrome` is only the wordmark/chip/account
   cluster, reused in four spots.
8. **The phone header is shell chrome on every destination.** The note's
   behavior test says "on each destination"; the strip already spans them
   (`music.instruments` Decision 1). Deep screens (reading, explorer, editor)
   keep their own `.appbar` and do not get the wordmark — the boards draw none
   there.
9. **Design delta to workflows 1, 15, 16** (see Repository): the workflows
   spelled the chip *Guitar · E A D G B E*, which the boards and the note
   contradict; the workflows now say the one short label and the description.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- `app/src/instruments/instrument-helpers.js`: `chipLabel` and `chipDescription` (short catalogue name, tuning name when not standard, *Custom* otherwise; stored default labels shortened, user labels kept); unit tests in `app/src/instruments/instrument-helpers.test.js`.
- `app/src/instruments/InstrumentChip.jsx` and `instruments.css`: the chip shows the short label, with the full identity as an `aria-describedby` description.
- `app/src/shell/HeaderChrome.jsx` (new), `AppShell.jsx`, `shell.css`: the *Estante* · chip · Account header on the phone and the wide side header; the Search title visually hidden but still the page heading.
- `app/src/songs/{SearchScreen,SongReading,SongArrange}.jsx`, `app/src/music/ChordExplorer.jsx`, `app/src/books/BooksScreen.jsx`: every place naming the instrument in use uses `chipLabel`; the search rail beside a song or the explorer gets the wordmark and chip head, one chip per screen.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` and `i18n.test.js`: `app.wordmark`, `catalogShort.*`, `instr.chip.description*`.
- Behavior tests (each with axe): AppShell, instruments, SongReading, ChordExplorer, SongArrange, SearchScreen, BooksScreen `.behavior.test.jsx`; the explorer's heavy "left-handed horizontal neck" test given the 20 s budget.
- e2e-web: `e2e/web/tests/header.spec.js` on phone, tablet and computer (no clipping, W01#1, W02#1, W02#4, axe); `instruments.spec.js` updated to the short label.
- Design delta: `docs/workflows/01-first-run.md`, `15-set-up-an-instrument.md`, `16-chord-explorer.md`.
