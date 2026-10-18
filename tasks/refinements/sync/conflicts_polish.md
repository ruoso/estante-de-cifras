# sync.conflicts_polish — The conflict resolver as drawn

## TaskJuggler entry

[`tasks/45-sync.tji`](../../45-sync.tji), lines 77-82:

> Workflow 9 (Settling one) shows the two bars with their chord diagrams; the
> app resolver shows no diagrams for yours and theirs. Also from the W09 board:
> a blank indent before the conflicted title in the IN CONFLICT row, and on a
> computer the book panel without the shell sidebar. Source: UI audit
> 2026-10-14 (app screens vs rendered boards; e2e/web/lib/mockup.js). Tests:
> behavior (both diagrams beside each choice, axe); e2e-web (a conflict settled
> on the three viewports, mockup W09#1-4).

`depends !conflicts, !keep_both`. Both are `complete 100`. Milestone:
`m5_complete` (`tasks/99-milestones.tji:44`).

## Effort estimate

1d (from the `.tji`). The task has three small view changes: the diagrams in
the bar cards, the list markup, and where the shell mounts the panel. It adds
no Worker, protocol or format change.

## Repository

Not cifra.md. The work lands in `app/`, with the e2e in `e2e/web/`:

- `app/src/songs/SongConflict.jsx`, `app/src/songs/song-conflict.css`: the
  diagrams in a chart conflict's side cards.
- `app/src/books/BookConflicts.jsx`, `app/src/books/book-conflicts.css`: the
  *In conflict* and *came in* rows, and an `embedded` presentation.
- `app/src/shell/AppShell.jsx`: on a wide layout, the panel goes in the main
  pane beside the rail.
- Tests:
  - `app/src/songs/SongConflict.behavior.test.jsx`
  - `app/src/books/BookConflicts.behavior.test.jsx`
  - `app/src/shell/AppShell.behavior.test.jsx`
  - `e2e/web/tests/conflicts.spec.js`

No design delta. Workflow 9 and the W09 board already decide all of this, and
this task brings the app into line with them.

## Inherited dependencies

- **sync.conflicts** (settled, Done 2026-10-13,
  `tasks/refinements/sync/conflicts.md`). It delivered:
  - `SongConflict.jsx`: the stepper, the two `SideCard`s named *Yours* and
    *{author}’s*, keep mine / take theirs / edit, and *settled so far*.
  - `BookConflicts.jsx`: the paused panel.
  - The early-return mount of both panels in `AppShell.jsx`.

  Its file plan described W09#1 as "a one-bar chart + a chord diagram each",
  but only the chart was built.
- **sync.keep_both** (settled, Done 2026-10-13,
  `tasks/refinements/sync/keep_both.md`). It added *Keep both* on a voicing
  step and on each *In conflict* row (`BookConflicts.jsx` L78-80). Both stay.
- **sync.conflicts_editing** (sibling, Done 2026-10-16,
  `tasks/refinements/sync/conflicts_editing.md`). It is not a dependency, but
  it touched the same component. It took the edit view, the marked-text editor
  and the place title (*Parte, bar 4*, from `conflictPlace` in
  `app/src/songs/conflict-text.js`). Its L88-95 hand these three items to this
  task: "the two chord diagrams beside each choice", "the IN CONFLICT row
  indent", and "the computer layout without the shell sidebar". The two tasks
  edit different regions of `SongConflict.jsx`: that task the edit view and
  the heading, this one the side cards.

## What this task is

This task brings three parts of the conflict screens into line with the W09
board:

1. **Diagrams on a bar conflict.** A bar both people changed shows, in each
   side card, the chord diagram for each chord that side wrote in the
   differing bars. The diagram sits under that side's bar.
2. **The *In conflict* row.** The conflicted song's title starts at the row's
   own padding, like every other list row, not after a blank indent.
3. **The panel on a wide screen.** On a tablet and a computer, the book's
   paused panel opens in the shell's main pane. The shell sidebar (the header
   chrome and the destinations rail) stays beside it, as W09#4 draws it. The
   whole screen is no longer covered.

## Why it needs to be done

- **Workflow 9 §Settling one** (`docs/workflows/09-conflicts.md` L49-51)
  promises "the two versions side by side in musical terms — two bars
  rendered, two diagrams". A guitarist decides between `Dm` and `E7` by the
  shape as much as by the name. The app shows only the bar text.
- **The indent.** It is a defect of the markup: an unstyled `<ul>` keeps the
  browser's own `padding-inline-start`.
- **The full-screen panel** contradicts W09#4's caption, "the book needs you;
  the rest of it carries on". The rest of the shelf should stay one click
  away.

The audit of 2026-10-14 (`e2e/web/lib/mockup.js` screenshots against the
rendered boards) found all three. This is one of the M5 polish leaves.

## Inputs / context

- **Workflow 9 §Settling one**, `docs/workflows/09-conflicts.md` L47-68:
  - two bars rendered and two diagrams, named *yours* and *Ana's*;
  - keep mine, take theirs, edit, and keep both on a voicing.
- **Board `docs/mockups/W09-conflicts.dc.html`.** Frames per
  `e2e/web/lib/mockup-frames.json` L249-271: #1-2 phone, #3 tablet, #4
  desktop.
  - **W09#1** (phone A, L28-93): *Conflict 1 of 2*, *Primeira parte, bar 5*
    (L42).
    - Two cards side by side (L45 `display:flex; gap:10px`; each card L46/L60
      is `card pad`, `flex:1`, `align-items:center`).
    - Each card holds the *Yours* (L47) or *Ana's* (L61) `t-h3` label, then
      the bar, then a `ChordBox` centred under it, size `m`, about 90×110:
      - L58: `chord="G7" frets="320001"`;
      - L72: `chord="D♭7" frets="x43424"`.
    - The actions sit in a row below the cards (L75-79).
  - **W09#2** (phone B, L95-139): the voicing step. The app already draws its
    two diagrams.
  - **W09#3** (tablet, L144-178): *Edit*, delivered by
    `sync.conflicts_editing`.
  - **W09#4** (computer, L181-257):
    - `.split` (L184) holds `.pane.side` (L185-204: the wordmark, the
      instrument chip, the shelf) and `.pane.main` (L205-254: the panel's app
      bar *Choros da Ana* / *needs you*, the notice, and two columns).
    - The *In conflict* row (L222) is a plain `.row`. Its `.grow` and `.name`
      begin at the row's padding (theme.css `.row`: `padding: calc(var(--u)*1.5)
      calc(var(--u)*2)`), with no leading slot.
- **`docs/mockups/README.md` L25-26.**
  - A diagram up the neck shows the fret number alone.
  - Defaults are drawn hollow, your shapes filled in the chord colour, the
    song's own shapes filled in ink.
  - Every status carries a word. `ChordDiagram`'s `.chord-diagram__who`
    already does this.
- **The resolver today.**
  - `app/src/songs/SongConflict.jsx`:
    - `SideCard` (L93-124) renders a chart, sections or block-notes side as
      `<Chart model={snippetModel(value, {fence})}>` and draws no diagram.
    - A voicing side is drawn as `<ChordDiagram>` via `fingeringFor`
      (L39-55).
    - `previewModel` (L206) is `resolveMarked(song.marked, 'ours')` parsed.
    - The cards are mounted at L344-347.
  - Item shapes are in `app/src/worker/conflict-model.js` L40-58. A `chart`
    item's `ours`/`theirs` are arrays of bar lines.
  - `chartPlace` (`app/src/songs/conflict-text.js` L66-95) already compares the
    two sides measure by measure (`other[m] !== measure`). That is the "which
    bars differ" rule this task reuses.
- **Voicing resolution, as the reader does it.**
  - `app/src/songs/SongReading.jsx` builds the instrument and resolves:
    - L293: `dialect` from preferences;
    - L294: `inUseEntry(instrumentsSlice)`;
    - L299-310: `instrumentInstance({…, strings: entry.tuning, heuristics:
      entry.config})`;
    - L335-342: `resolveSongVoicings(model, instrument, { shapes:
      entry.shapes, dialect })`.
  - `app/src/core/voicings.js`:
    - `resolveSongVoicings` (L151) returns key → `{ source:
      'song'|'yours'|'default', fingering }` in the §7.6 order;
    - `unvoiceableKeys` is at L221.
  - `app/src/songs/reading-view.js` L57 `chartChordList` maps key → symbol.
  - `app/src/diagram/ChordDiagram.jsx` L42 takes `kind` and a visible kind
    word, and its accessible name is the `describeFingering` sentence.
- **The rows today**, `app/src/books/BookConflicts.jsx`:
  - L69: `<ul className="list est-bookconf-list">`;
  - L105: `<ul className="list est-bookconf-incoming">`;
  - their `<li className="est-bookconf-row">`.
  - `book-conflicts.css` L47-51 gives the row only `display:flex; gap`.
  - `.list` (`app/src/theme/theme.css` L338) is designed for `div`s and resets
    no list padding, so the `<ul>` keeps the UA's ~40px inline-start padding.
    That is the blank indent.
  - The rows also lack `.row`'s padding, border and 44px minimum (theme.css
    L339).
  - Precedents that reset a list: `app/src/files/file-view.css` L96 and
    `app/src/books/make-your-own.css` L7 (`list-style: none`).
- **The shell**, `app/src/shell/AppShell.jsx`:
  - `if (songConflict)` (L922) and `if (conflictsBook)` (L936) return early,
    before the `Tabs` and `.split` of L1234-1263, so on every layout they
    replace the whole shell.
  - `openBook` (L869-876) routes a *needs you* book to `OPEN_CONFLICTS` and
    `setConflictsBook`.
  - `closers.conflicts` is at L451.
  - Precedent for a view inside a destination panel:
    - `destinationPanels(..., openSetlistView, ...)` (L175, L223) places an
      open setlist in the Setlists `TabPanel` on the phone;
    - `selectTab` (L1220) closes it when a tab is pressed
      (books.setlist_chrome Decisions 3-4).
  - `layout-mode.js` L22: `WIDE_QUERY` is `(min-width: 600px)`, so a tablet is
    wide too.
- **e2e**, `e2e/web/tests/conflicts.spec.js`:
  - fixture bars `C | G | Am | F` → owner `…| Dm`, Ana `…| E7` (L42-46);
  - `ownerAndAna` (L62) and `reachNeedsYou` (L119);
  - `openResolver` (L131-142) runs axe on the panel, presses *Settle*, checks
    *Yours*, *Ana’s* and *Parte, bar 4*, then runs axe on the resolver;
  - the take-theirs test calls `mockup(page,'W09-conflicts',4)` at L173 and
    `…,1` at L175;
  - the edit test calls `…,3` at L222;
  - the keep-both test calls `…,2` at L359.
  - The spec runs on the phone, tablet and computer projects.

## Constraints / requirements

1. **Which diagrams.** In a chart conflict's card for side S:
   - Take the measures of S's bar lines that differ from the other side
     position by position. This is the same comparison as `chartPlace`. A
     measure past the other side's end counts as different.
   - Show one diagram per distinct chord symbol in those measures, in order of
     appearance.
   - When no measure differs (for example a whole-section `sections` item, or
     an absent side), show no diagrams.
   - Block-notes and other kinds are unchanged.
2. **How each is voiced: what this device's reader would draw.**
   - Each side's diagrams are resolved against that side's whole song:
     `resolveMarked(song.marked, 'ours' | 'theirs')`, parsed. The ours model is
     the existing `previewModel`; the theirs model is new.
   - Use `resolveSongVoicings` with the in-use instrument from the
     `instruments` slice (`inUseEntry`), `shapes: entry.shapes`, and the
     notation preference. These are the same calls as `SongReading.jsx`
     L293-342.
   - The diagram's `kind` is the resolved `source` (`song` / `yours` /
     `default`), so README L26's hollow / chord-colour / ink rule and the
     visible kind word hold.
   - A chord in the side's list that is unvoiceable on this instrument
     (`unvoiceableKeys`) renders its name as text and no diagram. It never
     throws.
3. **Placement.**
   - Inside each `SideCard`, under that side's `<Chart>`, the diagrams sit in
     a wrapping row, centred, at the reader's default diagram size.
   - The two cards stay side by side and the actions stay below them
     (W09#1 L45-79).
   - On the phone the cards keep `flex:1; min-width:0`, and the diagram row
     wraps rather than overflowing.
   - Tokens only. No hard-coded colour.
4. **The rows.**
   - Each `<li>` in both lists of `BookConflicts.jsx` carries `row` (the theme
     row) as well as its own class.
   - Both `<ul>`s reset `list-style`, `margin` and `padding` in
     `book-conflicts.css`.
   - The title then begins at the row's padding, as in W09#4 L222.
   - Semantics stay a real `ul`/`li` list (an axe-clean list of `li`, unlike
     the RAC-button lists of the memory note): each row holds buttons, it is
     not a button.
5. **The panel on a wide layout (≥600px: tablet and computer).**
   - With `conflictsBook` set and the layout `wide`, the shell renders its
     normal `.split`: the header chrome and the destinations rail in
     `.pane.side`.
   - `<BookConflicts embedded>` takes the place of the Books destination's
     content in `.pane.main`, through the same seam `openSetlistView` uses.
   - Opening it selects the Books tab.
   - Pressing any rail tab while it is open leaves the panel. This is the same
     close as *Back*, through `closers.conflicts`, so routing history stays
     consistent.
   - `embedded` makes the panel render as content of the pane, not a second
     `.screen`. Its app bar (title, *needs you*, Back) stays.
   - On the narrow layout (phone) the panel stays a full screen over the shell,
     as today.
   - The per-song resolver (`SongConflict`) stays a full screen on every
     layout. No board draws it beside the sidebar (W09#1-3 are phone and
     tablet frames of the resolver itself, the tablet one in Edit).
6. **No Worker, protocol or format change.**
   - The view already holds `song.marked`, which gives both sides' whole
     songs.
   - The main thread never touches IndexedDB.
   - Nothing is saved or pushed by any of this.
7. **Accessibility.**
   - Every diagram is the existing `ChordDiagram`, which is `role="img"` named
     by the `describeFingering` sentence and carries its visible kind word.
   - Each card keeps its `aria-label` (*Yours* / *Ana’s*), so a diagram is
     found within the side it belongs to.
   - The rail stays keyboard-reachable beside the panel.
   - Axe at WCAG 2.1 AA must be clean on the resolver, on the panel narrow,
     and on the panel embedded.
8. Test songs are the spec's own fixtures (*Roda de rua*, *Cantiga calma*),
   written for the purpose.

## Acceptance criteria

**Behavior delivered.**

- A bar conflict shows, under each side's bar, the diagrams of the chords that
  side wrote in the differing bars. In the e2e that is `Dm` under *Yours* and
  `E7` under *Ana’s*. Each is voiced the way this device's reader would draw
  it, with the kind word visible.
- The *In conflict* and *came in* rows are theme rows with no leading indent.
- On a tablet and a computer, the paused panel sits in the main pane with the
  rail beside it. On a phone it is unchanged.

**Tests.**

- **behavior**, `app/src/songs/SongConflict.behavior.test.jsx`:
  - *"a bar conflict draws, beside each choice, the diagram of each chord that
    side wrote in the differing bars (workflow 9 §Settling one L49-51; W09#1
    L45-77)"*
    - Fixture: the chart item's `ours` `['C | G7 | F | F']` against `theirs`
      `['C | Db7 | F | F']`, with `marked` carrying both, and an `instruments`
      slice whose in-use entry is the built-in guitar.
    - Asserts:
      - within the *Yours* card, exactly one `role="img"` whose name starts
        with the G7 sentence;
      - within the *Ana’s* card, exactly one for D♭7;
      - no diagram for `C` or `F`, the unchanged measures;
      - the visible kind word of each;
      - axe clean.
  - *"a side's diagram is the song's own voicing when the song holds one for
    this tuning (§7.6 order; mockups README L26)"*
    - Fixture: `marked` whose ours side carries a voicing block for G7 on
      guitar.
    - Asserts: the *Yours* G7 diagram is kind `song` with that shape, and the
      *Ana’s* chord falls back to `default`.
  - *"an unvoiceable chord shows its name without a diagram, and never
    throws"*
  - The existing tests stay green and unedited:
    - L82, the sides as bars: `.est-conflict-sides .chart .barline` is still
      there;
    - L101, the voicing step's two diagrams.
- **behavior**, `app/src/books/BookConflicts.behavior.test.jsx`:
  - *"the in-conflict and came-in rows are theme rows in a reset list (W09#4
    L222)"*
    - Asserts:
      - every `listitem` under the *In conflict* list has class `row`;
      - both `ul`s still carry their own class (`est-bookconf-list`,
        `est-bookconf-incoming`) that the reset rule targets;
      - axe clean.
    - jsdom has no layout, so the absent indent itself is pinned by the
      e2e-web geometry check below.
  - *"embedded, it renders as pane content, not a screen, keeping its app
    bar"*
    - Asserts: no `.screen` root, the title and *needs you* badge are present,
      Back fires `onClose`, and axe is clean.
- **behavior**, `app/src/shell/AppShell.behavior.test.jsx`. These use its
  `matchMedia` stub (L21-30).
  - *"wide: a book needing you opens its panel in the main pane, the rail
    beside it; a rail tab leaves it (constraint 5; W09#4 L184-205)"*
    - Asserts:
      - with `wide` true and a `SYNC needs_you` + `CONFLICTS` emitted, opening
        the book shows the panel inside `main` and the *Destinations* tablist
        still present, Books selected;
      - pressing *Search* in the rail removes the panel;
      - axe clean.
  - *"narrow: the panel is a full screen over the shell (no tab bar), as
    before"*
- **e2e-web**, `e2e/web/tests/conflicts.spec.js`, on phone, tablet and
  computer:
  - In the take-theirs test, after `reachNeedsYou` and before
    `mockup(page,'W09-conflicts',4)`:
    - On tablet and computer, the *Destinations* tablist is visible beside the
      panel's *In conflict* list. On a phone, the panel is the full screen and
      no tab bar shows.
    - The *Roda de rua* row's title box starts within 24px of its list's left
      edge (`boundingBox`). This pins no indent through the real UI.
    - Axe already runs in `openResolver` (L132).
  - In `openResolver`, after the *Parte, bar 4* heading, before
    `mockup(page,'W09-conflicts',1)`:
    - within the region named *Yours*, one `img` whose name begins with Dm;
    - within *Ana’s*, one for E7.
    - Axe on the resolver already runs at L141.
  - Every test that uses `openResolver` thereby pins the diagrams, including
    keep mine and edit. The settle assertions (`expectSettledWithBar`,
    `syncUntilSongReads`) are unchanged. The `mockup` calls stay at W09#4, #1,
    #3 and #2, all observational, so W09#1-4 are each reached.
  - The spec stays inside the e2e lint rule: real UI only, two browser
    contexts. No new journey helper is needed.

**Deferred.**

- **`sync.conflicts_row_summary`** (closer registers in WBS): *"The In
  conflict row's summary line, as drawn"*.
  - Effort 0.5d. Not cifra.md. Milestone `m5_complete`.
  - Note: "W09#4 L222 gives each In conflict row a `.meta` line naming its
    conflicts by place (Primeira parte, bar 5 · the shape for G7 on guitar).
    The panel shows the title only. Lift the conflict titles (`describe` /
    `placeTitle` in SongConflict.jsx) into the pure conflict-text.js, and
    render them joined by `·` under the title. Source:
    tasks/refinements/sync/conflicts_polish.md. Tests: unit (the joined
    summary for a chart and a voicing item; fallback titles); behavior
    (BookConflicts row meta, axe); e2e-web (conflicts.spec.js: the row reads
    Parte, bar 4)."
  - Depends `!conflicts_polish`.

## Decisions

1. **The diagrams are the chords in the differing measures, not every chord
   on the line.**
   - The bar is the whole of what is in dispute. The board draws one diagram
     per side for one changed bar (W09#1 L58/L72).
   - Rejected: every chord of the side's lines. On a four-bar line that puts
     `C G Am` twice beside the one chord that matters.
   - The comparison is `chartPlace`'s, so the title (*bar 4*) and the
     diagrams agree on which bars differ.
2. **Voiced as this device's reader would, against each side's whole song.**
   - The point of the diagram is "what will I play if I take this". That is
     the §7.6 order the reader uses: the song's own voicing for this tuning,
     then my shapes, then the default.
   - Resolving against the whole side song (both are available from
     `song.marked` via `resolveMarked`) lets a voicing block in the song, on
     either side, govern its own chords.
   - Rejected:
     - Always the default shape (`defaultVoicing`). It would contradict what
       the reader shows a moment later.
     - Resolving against the fenced snippet. It holds no voicing block, so the
       song's own shapes would be lost.
3. **The book panel goes into the main pane through the Setlists precedent.**
   - It reuses `destinationPanels`' `openSetlistView` seam, generalised to the
     Books panel, with a rail-tab press closing it like `selectTab` closes a
     setlist. This keeps the RAC `Tabs` and `TabPanel` linkage intact.
   - Rejected: rendering the panel in `main` outside any `TabPanel`. That
     would leave a selected tab with no panel and break `aria-controls`.
   - Books is selected because the panel is a view of a book. W09#4's
     sidebar marks the book in the shelf.
4. **Wide means tablet as well as computer.**
   - The shell's one wide/narrow switch is `WIDE_QUERY` (600px). The rail is
     there on a tablet for every other destination.
   - Special-casing the computer would add a second breakpoint for one screen.
   - The phone keeps the full screen, which is where its tab bar would crowd
     the two-column panel.
5. **The resolver stays full screen.**
   - The note and W09#4 concern the book panel. The resolver's frames are a
     phone and a tablet in Edit (#1-3), both drawn without the shelf.
   - Putting it in the pane is unasked for, and would compete with the
     side-by-side cards for width.
6. **The indent is fixed by markup, not by a negative margin.**
   - Make the `li`s theme `.row`s and reset the `ul`. That also gives them the
     row padding, the dividing line and the 44px touch minimum the board
     draws.
   - Keep the `ul`/`li` semantics; do not switch to `div`s. The rows hold
     buttons, so a real list is the honest structure and is axe-clean.
7. **The row's summary line is deferred, not dropped.** W09#4 also draws a
   `.meta` line under the title. The note does not name it, and it needs the
   conflict titles moved into a shared pure module. It becomes
   `sync.conflicts_row_summary` rather than widening this 1d task.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-18.

- A bar conflict shows, beside each choice, the diagrams of the chords that side wrote in the differing bars, voiced as the reader would (the song's own voicing, else the default): app/src/songs/SongConflict.jsx, song-conflict.css, and the new `differingMeasures` helper in app/src/songs/conflict-text.js.
- The *In conflict* and *came in* rows lose the list indent: app/src/books/BookConflicts.jsx, book-conflicts.css.
- On tablet and computer the paused panel opens in the main pane with the rail beside it; on phone it stays a full screen: app/src/shell/AppShell.jsx.
- Tests: conflict-text.test.js (unit); SongConflict, BookConflicts and AppShell behavior tests with axe; e2e/web/tests/conflicts.spec.js extended on phone, tablet and computer.
- Follow-up registered: `sync.conflicts_row_summary` (the row's summary line, W09#4).
