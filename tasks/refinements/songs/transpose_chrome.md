# songs.transpose_chrome — Transposed reading names the key, once

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) — `songs.transpose_chrome`, lines 137-142:

> On a computer the transposed state is drawn twice: a Transposed (+1) chip
> with Back to the written key, and a second row whose Back to the written key
> overlaps the chart's first line (W02 desktop). The board names the key
> (Transposed to A (+2), Back to G). One control row, naming the key in the
> song's notation. Source: UI pairwise audit 2026-10-14 (e2e mockup()
> screenshots vs rendered boards, audit/out). Tests: behavior (one transposed
> row naming the key); e2e-web (transpose on the three viewports, nothing
> overlapping the chart; mockup W02#4).

`depends !reading, music.transpose`. Milestone: M5 (`tasks/99-milestones.tji:44`).

## Effort estimate

0.5d.

## Repository

The app only. Nothing lands under `cifra.md/`:

- `app/src/songs/SongReading.jsx`, `app/src/songs/reading.css`: the one
  transposed row and a stepper-only popover.
- `app/src/songs/reading-view.js`: `transposeStatus` names both keys, or
  neither.
- `app/src/core/transpose.js`: reads the `key` property as §1.4.3/§5.1.1
  define it (`♭`/`♯` included), and spells the key name with the glyphs the
  song uses.
- Tests:
  - `app/src/core/transpose.test.js`, `app/src/songs/reading-view.test.js` (unit);
  - `app/src/songs/SongReading.behavior.test.jsx` (behavior);
  - `e2e/web/tests/reading.spec.js` (e2e-web).

No locale key is added or removed. The existing `reading.transposedToKey`,
`reading.transposedBy`, `reading.backToKey`, `reading.backToWritten`,
`reading.arrangingOff` and `reading.writtenKey` cover the copy.

There is no design delta. Workflow 2 and the W02 board already decide the row
(see Decisions).

## Inherited dependencies

Settled:

- **`music.transpose`** (complete):
  - `transpose()`, `transposedKeyName()` (`app/src/core/transpose.js:198-212`), the
    per-song offset in the home book, and `SET_TRANSPOSITION`;
  - see `tasks/refinements/music/transpose.md`. That refinement left the
    keyless chip copy to the screen tasks.
- **`songs.reading`** (complete):
  - the transpose popover, the status row and the `reading.*` copy;
  - see `tasks/refinements/songs/reading.md`.
- Landed, not in `depends`, and to be kept green:
  - **`songs.reading_chrome`** (complete 2026-10-16): Transpose is an icon in
    the phone's app bar, a labelled button in the tablet's app bar, and the
    head of the meta row on the computer (Decision 3). The ⋯ menu drops
    *Arrange for…* while transposed. The heading reads *Shapes in {key}*
    (AC5). Its Status block names this task as the owner of "the one
    transposed row naming the key — W02#4".
  - **`shell.narrow_fit`**: `e2e/web/lib/fit.js` with `expectFits` and
    `overlaps` at L175-178.

Pending: none.

## What this task is

Draw the transposed state once, in one row, on every device. The row names
the destination key and the written key in the spelling the song writes its
key in: *Transposed to A (+2)* · *Back to G* · *Arranging is off while
transposed*. A song with no readable key gets *Transposed (+2)* · *Back to the
written key*.

The Transpose popover becomes only a stepper: − · the offset · +. It no longer
repeats the state or carries a second *Back*. Nothing transposed overlaps the
chart.

## Why it needs to be done

The 2026-10-14 pairwise audit compared `mockup()` screenshots with the
rendered W02 board and found three problems:

- The computer draws the transposed state twice. One copy is the status row
  under the meta row. The other is the popover, which stays open after a step
  and holds its own *Transposed (+1)* readout and a block *Back to the written
  key*. That popover is anchored at the Transpose button heading the meta row
  (`SongReading.jsx:373-406`, mounted at L615), so it falls across the chart's
  first line.
- The e2e uses the keyless example song, so the audit never saw the key
  named.
- The board draws one row that names the key (W02#4).

The reading view is where people spend their time (workflow 2), and a singer's
transposition is persistent state they see on every open (L137-140). M5 brings
the screens to their boards.

## Inputs / context

Governing documents:

- **`docs/workflows/02-find-and-play.md`** L112-151, "Transposing":
  - L114-116: view only.
  - L121-127: no chosen shapes.
  - L133-135: spelling. With a `key`, chords are spelled as the new key
    spells them. Without one, by fewest accidentals.
  - L137-140: "shown plainly while it applies — *transposed to D (+2)* — with
    a way back to the written key".
  - L142-148: arrange is not offered.
  - L150-151: print and links carry the transposition.
- **`docs/mockups/W02-find-and-play.dc.html`** L181-186 (W02#4, computer, "transposed for the singer"):
  - one row: `Pedro Araújo · My songs` · `chip accent` *Transposed to A (+2)* ·
    `btn quiet` *Back to G* · right-aligned *Arranging is off while
    transposed*;
  - L198-206: *Shapes in A*, with only yours and default shapes;
  - the phone (#2) and the tablet (#3) draw only the written key. The
    Transpose control is at L68 and L113.
  - Frame numbering is in `e2e/web/lib/mockup-frames.json`: #1-2 phone, #3
    tablet, #4 desktop.
- **`cifra.md/spec/1-*.md` L135** (the `key` property, §1.4.3): "as a chord
  symbol root with `m` for minor: `G`, `Em`, `Bb`".
- **`cifra.md/spec/5-*.md` L24-31** (§5.1.1, root): an uppercase letter `A`-`G`
  with an optional accidental `#`/`♯`, `b`/`♭`, `##`, `bb`. Lowercase is not a
  root.
- **`cifra.md/spec/10-setlists.md`** L318 and L343-345: what to do when "its
  value is not a key as defined". This is the precedent for treating a
  non-key `key` value as absent.
- **`docs/DIRECTION.md` §3.2** L139-140: the transposition is personal state
  in the home book.

Code as it stands:

- **`app/src/songs/SongReading.jsx`**:
  - L301-303: `writtenKey = songProperty(baseModel, 'key')`, raw.
  - L337-338: `transposeStatus(writtenKey, offset, dialect)`.
  - L350-364: `statusRow` (chip, *Back*, arranging-off), mounted in `body`
    at L633, after `metaRow`.
  - L366-406: `transposeControl`, whose popover readout (L387-393) and
    `Back` (L398-402) duplicate the row.
  - L608-623: `metaRow`, led by `transposeControl` on the computer. The *Key
    of* chip is hidden while transposed (L620).
- **`app/src/songs/reading.css`**: L32-39 `.reading-meta` (flex, wraps); L44-55
  `.reading-status`, `.reading-arranging-off`; L184-195 print hides both.
- **`app/src/songs/reading-view.js`** L9-25: `transposeStatus` → `{ offset, keyName }`.
- **`app/src/core/transpose.js`**:
  - L63-72 `keyTonic`: accepts lowercase, and does not read `♭`/`♯`. So
    `B♭` reads as B, and the chart's key-driven spelling at L127 goes wrong
    too.
  - L86-91 `keySuffix`: anything after the root, so `B♭` → `♭` and `G
    major` → ` major`.
  - L198-221 `transposedKeyName`: always ASCII `b`/`#`, and ignores `dialect`.
- **i18n**: `app/src/i18n/locales/en.js` L1401-1411 holds the `reading.*`
  transpose copy. pt-BR is at L1251-1260; es-419 and it are alongside.
- **Tests today**:
  - `SongReading.behavior.test.jsx` L304-336 (the transpose describe, using
    `getAllByText` "in the status row (and in the still-open popover)");
  - L730ff (computer: Transpose heads `.reading-meta`);
  - `installWidths(computer)` at L37-45;
  - `reading-view.test.js` L12-24;
  - `transpose.test.js` L145ff;
  - `e2e/web/tests/reading.spec.js` L135-150: keyless *Morning on the
    Porch*, `mockup(page, 'W02-find-and-play', 4)` taken with the popover
    still open;
  - `e2e/web/tests/arrange.spec.js` L191-224 (arranging off while
    transposed), which stays green.
- **e2e helpers**:
  - `writeSongFromScratch(page, lines)` (`e2e/web/lib/journeys-account.js:268`);
  - `openSongFromSearch` (`e2e/web/lib/journeys.js`);
  - `overlaps(a, b)` (`e2e/web/lib/fit.js:175`).

## Constraints / requirements

- **View only.** No Worker, protocol, storage or cifra.md change. The offset
  stays `SET_TRANSPOSITION` into the home book.
- **One transposed row on every device.**
  - While `offset ≠ 0`, the chip, *Back* and the arranging-off note sit in
    the meta row (`.reading-meta`), after the byline and before the variation
    picker. The variation picker is hidden while transposed anyway.
  - The separate `.reading-status` element goes, and so does its CSS and
    print rule.
  - The meta row keeps wrapping on narrow screens. The arranging-off note is
    a whole phrase (`shell.narrow_fit`: no word-by-word wrap).
- **Name both keys, or neither.** The key is "readable" when the trimmed
  `key` property is a §1.4.3 key: a §5.1.1 root (uppercase letter; `#`, `♯`,
  `b`, `♭`, `##`, `bb`), then `m` or nothing.
  - Readable: the chip reads *Transposed to {destination} ({±n})* and *Back*
    reads *Back to {written}*. `{written}` is the property as written,
    trimmed.
  - Not readable, absent or empty (for example `Sol` or `G major`): *Transposed
    ({±n})* and *Back to the written key*. This follows
    `10-setlists.md:343-345`.
- **In the song's notation.** The destination key is spelled the way the song
  spells its key:
  - the same sharp/flat choice the chart's chords get (one shared
    `keyTonic`, so the chart and the name never disagree);
  - the glyphs of the written key: `♭`/`♯` when the written key uses one,
    `b`/`#` otherwise (so a `G` key gives ASCII);
  - minor kept (`Em` +2 → `F#m`).

  The chord dialect (`notation`, §5.6) does not apply: it changes only
  ambiguous chord bodies, never a root.
- **The popover is a stepper only.**
  - Contents: − (*Down a semitone*) · the readout · + (*Up a semitone*).
  - The readout shows the signed offset (`+2`, `−1`; the existing `signed()`
    helper), or *Written key* at 0. It stays `aria-live="polite"` so a step is
    announced.
  - It has no *Transposed to…* text and no *Back*. The row carries those.
  - RAC `DialogTrigger`/`Popover` keep focus management and Escape.
- **Nothing overlaps the chart.** With the popover closed, the meta row is in
  flow above the sheet, and its box does not intersect the chart's first line
  on any viewport. If the implementer finds an overlap beyond the popover
  (CSS in the computer's split), they fix it here.
- **Accessibility.**
  - Every control is a RAC `Button`.
  - The state is carried by the chip's words, not its accent colour.
  - axe at WCAG 2.1 AA, clean in the transposed state on all three devices.
- Purpose-written test songs only.

## Acceptance criteria

1. **One row.** While transposed, every device draws exactly one *Transposed
   to {key} ({±n})* (or *Transposed ({±n})*) and exactly one *Back to…*
   button, both inside `.reading-meta`. There is no `.reading-status`. On the
   computer the order is Transpose · byline · chip · *Back* · arranging-off,
   as W02#4 L181-186 draws it.
2. **The keys named.** For a song with `- key: G` at +2, the row reads
   *Transposed to A (+2)* · *Back to G*.
3. **Back.** *Back to G* dispatches `SET_TRANSPOSITION { semitones: 0 }`. The
   row goes, and *Key of G* returns.
4. **A stepper popover.** It holds −, the offset readout and + only.
5. **Key reading** follows §1.4.3/§5.1.1, and the glyphs follow the written
   key, as in Constraints.
6. **Tests, by level:**

   **unit**

   `app/src/core/transpose.test.js`, in the `transposedKeyName` describe:
   - `B♭` +2 → `C`;
   - `E♭` +2 → `F`, and `E♭` +1 → `E`;
   - `A♭` +1 → `A`, and `G` +1 → `Ab`. The glyph follows the written key.
   - `F♯m` +1 → `Gm`;
   - `C♯m` −1 → `Cm`;
   - lowercase `g`, `G major` and `Sol` → `null`. §5.1.1 root, §1.4.3.

   `app/src/core/transpose.test.js`, in the "spelling by the key property"
   describe:
   - a chart under `- key: B♭` at +1 is spelled with flats, as `B` would not
     be. This pins one `keyTonic` for the chart and the name (workflow 2
     L133-135).

   `app/src/songs/reading-view.test.js`: `transposeStatus` returns
   `{ offset, keyName, writtenKey }`:
   - `('G', 2)` → `{ 2, 'A', 'G' }`;
   - `(' Em ', 2)` → `writtenKey: 'Em'`;
   - `('G major', 2)` and `(null, 3)` → both names `null`;
   - `null` at 0.

   This pins the both-or-neither rule.

   **behavior**

   `app/src/songs/SongReading.behavior.test.jsx`, a new describe *"the
   transposed row names the key, once (songs.transpose_chrome; W02#4)"*, each
   case on the phone, the tablet and the computer (`installWidths`):
   - With `- key: G` at transposition 2:
     - exactly one *Transposed to A (+2)* (`getByText`) and one *Back to G*
       button, both within `.reading-meta`;
     - no `.reading-status`;
     - no *Key of G*;
     - on the computer, the order of `.reading-meta`'s children matches AC1;
     - axe clean.
   - Open Transpose, step up:
     - the dialog holds *Down a semitone*, the readout `+3` and *Up a
       semitone*;
     - `within(dialog)` finds no *Transposed to…* and no *Back…*;
     - outside it the row reads *Transposed to Bb (+3)*;
     - axe clean with the dialog open.
   - *Back to G*:
     - `SET_TRANSPOSITION { semitones: 0 }` is dispatched;
     - after the slice updates, the row is gone and *Key of G* is back.
   - `- key: G major` at 2: *Transposed (+2)* and *Back to the written key*.

   Changes to existing cases:
   - The transpose describe at L304-336 asserts single occurrences
     (`getByText`), not `getAllByText`.
   - The keyless case stays.

   **e2e-web**

   `e2e/web/tests/reading.spec.js`, a new test *"a transposed song names its
   key once, clear of the chart (W02#4)"* on phone, tablet and computer:
   - Setup: `writeSongFromScratch` with a purpose-written song carrying
     `- key: G` and a verse fence (for example *Harbour Lights at Noon*), then
     `openSongFromSearch`.
   - Transpose → *Up a semitone* twice. Expect the readout `+2`, then
     `Escape` to close the popover.
   - Expect:
     - exactly one visible *Transposed to A (+2)* and one *Back to G*;
     - `overlaps(metaRowBox, firstChartLineBox)` is false (`fit.js:175`), and
       the row lies above the chart;
     - `mockup(page, 'W02-find-and-play', 4)`;
     - `checkA11y()`.
   - Then *Back to G*: the row is gone and *Key of G* is visible.

   Changes to the existing *"transposes and remembers the offset across a
   reload"* (L135-150):
   - it keeps the keyless example song;
   - it closes the popover and asserts the single *Transposed (+1)* and
     *Back to the written key*;
   - its `mockup(… 4)` call moves to the new test, which draws the board's
     keyed state.

   `arrange.spec.js` L191-224 and `narrow-fit.spec.js` stay green.

   Every prerequisite already exists:
   - a song with a key written through the editor: `songs.new_song` /
     `songs.editor`, both complete;
   - the reading view and its chrome: `songs.reading`, `songs.reading_chrome`;
   - the transposition store: `music.transpose`.

   There is no hosted book and no second device.

Tech debt: none.

## Decisions

1. **Fold the state into the meta row, rather than keep a separate status
   row.** W02#4 L181-186 draws the byline, the chip, *Back* and the note as
   one row, with Transpose at its head (`songs.reading_chrome` D3). The note
   asks for "one control row".

   The same rule holds on the phone and the tablet. Those boards draw no
   transposed state, so the computer's row is the only drawing, and one
   wrapping row is simpler than a per-device split.

   Rejected: keep `.reading-status` and only remove the popover duplicate.
   That still draws two rows on the computer, against the board.
2. **The popover becomes a stepper, rather than closing after each step.**
   Closing on every step would make three semitones three trips. Keeping the
   readout's key name would name the key twice while the popover is open.

   The readout shows the offset, which is what the stepper changes. The row
   names the key, which is what it means. `aria-live` on the readout keeps
   each step announced.

   An open popover covering content is what a popover does. The guarantee
   that nothing overlaps the chart is for the persistent state, with the
   popover closed.
3. **"The song's notation" means the written key's spelling, not the chord
   dialect or solfège.**
   - cifra.md has no Latin note-name notation.
   - Its `notation` property affects only four ambiguous bodies (§5.6), never
     roots.
   - The one notation a key carries is its accidental glyph (`♭`/`♯` vs
     `b`/`#`, both §5.1.1), so the name follows it.
   - *Back* names the key exactly as written (trimmed).
4. **Name both keys or neither.**

   A `key` value that is not a §1.4.3 key gets the keyless copy. This is the
   precedent of `10-setlists.md:343-345`.

   Rejected: the current behaviour.
   - *Transposed to A major (+2)* (the suffix passed through) and *Back to
     Sol* beside *Transposed (+2)* name the keys inconsistently.
   - A lowercase `g` is not a root (§5.1.1).
5. **Fix `keyTonic` in `transpose.js`, rather than in `reading-view.js`
   alone.** `B♭` read as B mis-spells the chart as well as the name (L127).
   One reader of the key keeps the chart and the row in agreement. That is
   the spelling promise of workflow 2 L133-135.
6. **The e2e writes a keyed song, rather than adding `key:` to the example
   book.** The example book is user-facing content, and other specs pin its
   keyless copy. Writing a purpose-written song through the editor stays
   inside the real UI.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-16.

- The transposed state is one row inside `.reading-meta` on every device (`app/src/songs/SongReading.jsx`, `app/src/songs/reading.css`): *Transposed to A (+2)* · *Back to G*, or the keyless *Transposed (+2)* · *Back to the written key*; `.reading-status` is gone and nothing overlaps the chart.
- The Transpose popover is only − · offset · + (`SongReading.jsx`).
- `transposeStatus` returns `{ offset, keyName, writtenKey }`, naming both keys or neither (`app/src/songs/reading-view.js`).
- `app/src/core/transpose.js` reads the `key` property with `♭`/`♯` and spells the key name in the song's own glyphs; steps crossing E–F or B–C can land on the next letter flattened (C♯m −1 → Cm), and a sharps/flats tie picks flats (D −1 → D♭, in chart and name).
- Deviation: a chart under `key: B♭` at +1 comes out in sharps by the fewest-accidentals rule, not flats as the refinement said; the test pins that `B♭` reads the same as `Bb`.
- Unit: `app/src/core/transpose.test.js`, `app/src/songs/reading-view.test.js`. Behavior: `app/src/songs/SongReading.behavior.test.jsx` (one row, order, stepper-only popover, *Back to G*, keyless, axe, three viewports). e2e-web: `e2e/web/tests/reading.spec.js` (names its key once, clear of the chart, mockup W02#4).
- Gate (`scripts/gate`) green; no tech debt registered.
