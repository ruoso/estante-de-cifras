# songs.trailing_chord_gap — A chord after the last lyric keeps its distance

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task trailing_chord_gap` under
`task songs` (`tasks/60-songs.tji:233-237`). No `depends` of its own; the
parent `task songs` cascade (`shell.layout`, `shell.chart`,
`foundation.e2e_web`, `tasks/60-songs.tji:6`) applies. Wired into milestone
**`milestones.m3_service`** (`tasks/99-milestones.tji:32`). The note:

> "A chord written past the end of its sung line is drawn glued to the last
> word: mais cheia de graçaCmaj7, in the editor preview and the reading view.
> The parser keeps the chord column beyond the lyric (cifra.md/js parse: the
> item has a column past the words), and app/src/chart/layout.js places it
> with no gap. Keep at least a space between the last word and a chord after
> it, at every density, in both layouts the chart draws. … Tests: unit (layout
> of a chord past the lyric end); behavior (the reading view and the preview
> draw the gap; axe); e2e-web (that song read on the three viewports)."

## Effort estimate

**0.5d**, allocated `team`. One flag in one pure function, one class in one
component, one CSS rule, and three levels of test.

## Repository

**estante-de-cifras only, `app/` and `e2e/web/`** — not a `cifra.md:` task.
The reader already gives the model the task needs (below); no format change.

- `app/src/chart/layout.js` — `sungRow` (`:98-118`) sets a `tail` flag on a
  segment.
- `app/src/chart/layout.test.js` — unit cases; the existing `toEqual`
  expectations on segments gain `tail: false`.
- `app/src/chart/Chart.jsx` — `Segment` (`:92-102`) adds the `tail` class.
- `app/src/theme/theme.css` — one rule beside `.chart .s .c` (`:384`).
- `app/src/chart/Chart.behavior.test.jsx`,
  `app/src/editor/SongEditor.behavior.test.jsx`,
  `app/src/songs/SongReading.behavior.test.jsx` — behavior cases.
- `e2e/web/tests/trailing-chord.spec.js` *(new)* — the e2e-web journey.

## Inherited dependencies

All settled (`complete 100`):

- `shell.chart` (`tasks/50-shell.tji:29`) — the segment layout this task
  corrects (`layout.js`, `Chart.jsx`, the `.chart` rules in `theme.css`).
- `shell.layout` (`tasks/50-shell.tji:15`) — the narrow and wide reading
  layouts.
- `foundation.e2e_web` (`tasks/25-foundation.tji:72`) — the harness.
- `shell.display_preferences` (`tasks/50-shell.tji:92`) — not in `depends`
  but complete: the account screen's Density choice the e2e journey uses to
  read the song at Compact and Roomy (`e2e/web/lib/journeys-account.js:245`
  `chooseDensity`).
- `songs.render_notes` (sibling, complete) — the latest change to
  `chartRows` and the pattern of its tests (`e2e/web/tests/notes.spec.js`).

## What this task is

A sung line whose chord line runs longer than its words — `G` over *mais
cheia de graça* and `Cmaj7` after it — has, by cifra.md §4.4, a last chord
attached to the **end** of the words with **no words** of its own. The chart
draws a sung line as segments (§4.8), each a chord stacked over its words and
as wide as the wider of the two, so that last chord's segment starts exactly
where the previous segment's words end: `Cmaj7` sits on the chord row with
its left edge on the right edge of *graça*, reading as one run
(*graçaCmaj7*). This task opens at least a space between the last word and a
chord drawn after it, wherever the chart draws a sung line — the editor
preview, the reading view in its narrow and wide layouts (and full screen),
the arrange chart and the conflict preview, which all render `Chart` — at
every density.

## Why it needs to be done

It is a persona-exploration finding (2026-10-19): a teacher's song with a
closing chord after the last word reads wrong in the preview and on the
stand, and the chord looks like part of the word. It is one of the
`milestones.m3_service` fixes (`tasks/99-milestones.tji:32`). No task waits
on it.

## Inputs / context

- **cifra.md §4.4 Attachment** (`cifra.md/spec/4-lyrics.md:140-149`): an item
  at or past the end of the line is attached to the end of the words; and
  `:170` "An attached item at or past the end of the words has no words";
  `:171-172` the words are kept with their spaces, "Trimming is a display
  decision".
- **cifra.md §4.5** (`:332-334`): a chord line longer than its words keeps
  its tokens past the end at their distance from the end of the words.
- **cifra.md §4.8 Rendering in a proportional face** (`:367-372`): "an
  attached item at or past the end of the words (§4.4) is a chord with an
  empty segment"; `:384-386` at a word boundary the renderer sets ordinary
  inter-word space; `:390-394` §4.8 is advice and binds no profile.
- **The reader's model.** `parse("```\nG                   Cmaj7\nmais cheia de graça\n```")`
  in `cifra.md/js` gives one measure with `{symbol:'G', column:0,
  words:'mais cheia de graça'}` and `{symbol:'Cmaj7', column:20, words:''}`;
  `G        D` over `foi assim` gives `D` at column 9 (exactly at the end,
  no space even in the source) with `words:''`. The last words are trimmed of
  nothing and end on a letter.
- **`app/src/chart/layout.js`**: `SEGMENT_TYPES` (`:21`), `endsTight` /
  `startsTight` (`:49-50`), `sungRow` (`:98-118`) — segments per measure,
  `hyphen` set within a measure (`:108`). A past-end item becomes
  `{ chord: 'Cmaj7', words: '', hyphen: false, … }` with nothing marking it.
- **`app/src/chart/Chart.jsx`**: `Segment` (`:92-102`) renders
  `<span className="s">` with `.c` over `.w`; every `Chart` caller gets it:
  `SongEditor.jsx:676` (preview), `SongReading.jsx:493` (reading; `size` 20
  in `mode === 'wide'`), `SongArrange.jsx:526`, `SongConflict.jsx:156,455`,
  `SongWizard.jsx:551`.
- **`app/src/theme/theme.css`**: `.chart .sung` flex-wrap row (`:382`),
  `.chart .s .c` with `padding-right: 0.45em` (`:384`) — the gap between a
  chord and whatever follows it on the chord row, which is why two past-end
  chords in a row are already apart from each other; `.chart .s .w`
  `white-space: pre-wrap` (`:389`); densities `--chart-size` 15px / default /
  19px (`:277-279`); `.mark-tap .c` (`:432`).
- **`docs/mockups/theme.css:226-229`** — the boards' chart rules; the boards
  never draw a chord past the words, so the app's rule is an "app fix over
  the boards" like the one at `app/src/theme/theme.css:385-388`.
- **Tests to extend**: `app/src/chart/layout.test.js` (fixtures `chord`,
  `music`, `section`, `model` at `:17-29`; `describe('chartRows — sung
  lines')` `:31`); `app/src/chart/Chart.behavior.test.jsx` (parses a song
  through the real `cifra-md` reader, `:17`, `:61`); the `songs.render_notes`
  describes in `SongEditor.behavior.test.jsx:641` and
  `SongReading.behavior.test.jsx:345` as the pattern; e2e:
  `e2e/web/tests/notes.spec.js` (writes a song through the editor, saves,
  reads it), `e2e/web/lib/journeys.js` `startApp` `:26`, `openSongFromSearch`
  `:280`, `saveThroughSheet` `:352`; `e2e/web/lib/journeys-account.js`
  `openAccount` `:35`, `chooseDensity` `:245`.

## Constraints / requirements

- **The model is not changed.** The gap is a display decision (§4.4 :172,
  §4.8): no change to the reader, to `words`, or to canonical form; the saved
  text is exactly what it was.
- **The layout stays the one place that decides.** `layout.js` stays pure
  and framework-free; it marks the segment, `Chart.jsx` maps the mark to a
  class, the CSS draws the space. The screen-reader reading (`reading.js`)
  is unchanged — it already reads the chord after the words in order.
- **Scales with the chart.** The gap is in `em`, so it follows
  `--chart-size` at every density and the wide reading's `size={20}`.
- **Only where it is needed.** A chord with words of its own, the lead, a
  chord-only line (bars and runs are already spaced by `.m` padding and
  `word-spacing`), and the second of two past-end chords (already spaced by
  the first chord's `padding-right`) are drawn exactly as today.
- **Accessibility.** No new interactive part; the arrange chart's chord
  `Button` (`Chart.jsx:80`) keeps working inside a tail segment; axe at WCAG
  2.1 AA stays clean on every surface touched.
- **Test songs** are written for the purpose (below), never someone else's
  words. *Mais cheia de graça* in the finding is a phrase from a published
  song; the tests do not use it.

## Acceptance criteria

Behavior delivered:

1. `sungRow` gives every segment a boolean `tail`: `true` when the segment's
   words are empty (`''`) and the segment before it **on the same line**
   (across measures — the gap is about the words before it, wherever the bar
   falls) has words holding a non-space character; `false` otherwise. The
   lead and the first segment of a line are never `tail`.
2. `Segment` renders `<span className="s tail">` for a tail segment, `s`
   otherwise.
3. `theme.css` adds, after `.chart .s .c`, `.chart .s.tail { margin-left:
   0.45em; }` with a comment naming §4.4/§4.8 and the task — the same 0.45em
   a chord keeps after itself, so the chord row reads evenly.
4. In the editor preview and the reading view, on phone, tablet and
   computer, at Compact, Comfortable and Roomy, the chord after the last word
   starts at least a quarter of the chart's font size to the right of the
   last glyph of the words.

Tests, by level:

- **unit** — `app/src/chart/layout.test.js`, a new
  `describe('chartRows — a chord past the end of the words')`:
  - "a chord past the end of the words is a tail segment" — `G` over words
    then `chord('D', n, '')`: the second segment `{ chord: 'D', words: '',
    tail: true, hyphen: false }` (§4.4 :170, §4.8 :371-372).
  - "a chord exactly at the end of the words is a tail too" — the column-9
    case, as the parsed model gives it (parsed through `cifra-md`, like the
    file's `parsed:` case at `:398`).
  - "only the first of two chords past the end is a tail" — `G D Em` over one
    word: `D` tail, `Em` not.
  - "a tail across a bar" — words in one measure, the past-end chord in the
    next: tail.
  - "no tail after words of only spaces, on a chord with words of its own, or
    on the first segment" — the guard cases; the lead and the first segment
    are `tail: false`.
  - the existing segment expectations in the file gain `tail: false` (no
    assertion removed or loosened).
- **behavior** —
  - `app/src/chart/Chart.behavior.test.jsx`: "a chord after the last word is
    drawn as a tail segment" — the test song below through the real reader:
    the segment holding `Fmaj7` (and the one holding `A7`) has class `tail`
    and empty `.w`; the segments with words do not; axe clean (§4.8).
  - `app/src/editor/SongEditor.behavior.test.jsx`: "the preview draws a chord
    after the last word apart from it" — typed into the editor, the preview
    region's `Fmaj7` segment is `.s.tail`; axe over the preview.
  - `app/src/songs/SongReading.behavior.test.jsx`: "the reading view draws a
    chord after the last word apart from it" — the reading chart, narrow and
    wide (`mode`), `.s.tail` on both past-end chords; axe.
  - (jsdom has no layout: the behavior level pins the mark the CSS keys on;
    the geometry is pinned at e2e.)
- **e2e-web** — `e2e/web/tests/trailing-chord.spec.js` *(new)*, on the
  phone, tablet and computer projects, a local book (no account, no network),
  through the real UI only:
  - "a chord after the last word keeps its distance in the preview and the
    reading view" — write the test song in the editor (as
    `notes.spec.js` does), check the gap in the preview (phone: behind the
    Preview tab); save through the sheet; open it from search; check the gap
    in the reading view at Comfortable; open the account screen, choose
    Compact, return to the song, check; choose Roomy, check; axe at WCAG 2.1
    AA on the preview and on the reading view. The check, in the page: for
    each past-end chord, a DOM `Range` over the previous segment's `.w` text
    node gives the words' right edge, a `Range` over the tail's `.c` text
    gives the chord's left edge, and `left - right >= 0.25 ×` the chart's
    computed `font-size`. Phone covers the narrow reading layout, tablet and
    computer the wide one (`SongReading.jsx:190-193, 493`).

The test song (purpose-written):

~~~~
# Porto de Lenha

## Verso
```
C                  Fmaj7
Vem a maré da tarde
G        A7
leva o barco
```
~~~~

(The implementer may pad the first chord line so `Fmaj7` sits a few columns
past the words, and keeps the second line's `A7` exactly at the end of
*barco* — the two attachments §4.4 gives "past the end".)

## Decisions

1. **Mark the segment in the layout; draw the space in CSS.** Rejected:
   appending a space to the previous segment's `words` — it changes the text
   the screen reader reads and the unit expectations pin, and a trailing
   space in a `pre-wrap` box hangs at a line end and may not open room at
   all. Rejected: a pure-CSS selector (`.s:has(.w:empty)`) — it cannot tell
   "after words" from "after another past-end chord" or the first segment of
   a line, and `:empty` breaks if `.w` ever holds the hyphen span; the
   layout already decides `hyphen` the same way.
2. **At least a space, not the source's distance.** §4.5 keeps past-end
   tokens at their distance in the monospaced text, but in proportional type
   the chart does not reproduce columns (§4.8 :384-389 sets ordinary space at
   a word boundary); one fixed gap reads cleanly and matches the note's "at
   least a space". Rejected: carrying the column distance into the layout —
   it would mean computing it from columns the chart otherwise ignores.
3. **`margin-left: 0.45em` on the segment.** It mirrors the chord's own
   `padding-right`, scales with `--chart-size` at every density, and leaves
   `.mark-tap .c`'s negative margin intact. When a tail segment is the first
   thing on a wrapped flex row it is indented by that half-space — harmless,
   and rarer than the glued case.
4. **Across measures.** A sung line's segments are one row whatever the bar
   lines (`Chart.jsx` draws no bar rule in a sung row), so a past-end chord
   after a bar is glued just the same and is a tail too — unlike the hyphen,
   which never bridges a bar.
5. **No spec delta.** §4.8 already says a past-end item is a chord with an
   empty segment and that trimming and spacing are display decisions; how
   far apart to draw it is a renderer's call, advice that binds no profile
   (§9). The format, the reference and the corpus are untouched.
6. **"Both layouts the chart draws"** is read as the narrow and the wide
   reading layout (`SongReading.jsx:190-193`, `size` 20 when wide), covered by
   the phone and the tablet/computer projects; the one CSS rule applies to
   every `Chart` caller, so the arrange chart, the conflict preview and the
   wizard's preview get it without their own tests (they render the same
   `Segment`, pinned at `Chart.behavior.test.jsx`).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- `app/src/chart/layout.js`: `sungRow` sets a boolean `tail` on every segment — true for a chord with no words after a segment whose words hold a non-space character, across a bar too.
- `app/src/chart/Chart.jsx`: a tail segment renders `<span className="s tail">`.
- `app/src/theme/theme.css`: `.chart .s.tail { margin-left: 0.45em; }`, scaling with `--chart-size` at every density and in both reading layouts. The song model and saved text are unchanged.
- Unit: `app/src/chart/layout.test.js`, new describe "chartRows — a chord past the end of the words" (past the end, exactly at the end via `cifra-md`, first of two, across a bar, guards); existing expectations gained `tail: false`.
- Behavior: `app/src/chart/Chart.behavior.test.jsx`, `app/src/editor/SongEditor.behavior.test.jsx`, `app/src/songs/SongReading.behavior.test.jsx` (narrow and wide), each with axe.
- e2e-web: `e2e/web/tests/trailing-chord.spec.js` checks the gap in the preview and the reading view at Comfortable, Compact and Roomy, with axe.
- Fixer: `app/src/editor/SongEditor.behavior.test.jsx` — the older "Help opens the help and Escape returns focus to Help" test now waits for focus inside the dialog before Escape (a timing flake from f10330b).
- No tech-debt follow-ups; no spec or corpus change.

