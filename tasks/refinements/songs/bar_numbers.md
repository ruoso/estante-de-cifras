# songs.bar_numbers — Bar numbers on the reading page and on paper

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task bar_numbers` under `task
songs`. Depends on `songs.reading`, `songs.menu_grouping` (the View group the
toggle joins) and `shell.display_preferences` (the register pattern it
follows); `shell.chart`, the chart it draws in, comes with the parent `task
songs`. Wired into
milestone **`milestones.m5_complete`** (`tasks/99-milestones.tji`).

## Effort estimate

**1d**, allocated `team`: one register on an existing pattern, one menu item,
the chart's margin column and inline mark, and three levels of test.

## Repository

**estante-de-cifras only, `app/` and `e2e/web/`.** The format already counts
the bars (below); no `cifra.md:` change.

## What was there, and what was not

2cd8a74 (*Number the bars, and let the chart say which bar it is on*) taught
the reader to count: `numberBars` (`cifra.md/js/src/parse.js`) numbers every
bar of a song that is not sung, from 1, from an `@N` at the start of a bar,
and from a heading's `@N` for its first bar, marking a number `stated` when
the text wrote it. `chartRows` (`app/src/chart/layout.js`) passes the count on
each bars row as `numbers`. The chart used them only in its visually-hidden
layer — *bar 17:* before a stated bar — and the 0.12 release notes told users
the numbers ran in the margin and printed. Nothing drew them, and the commit's
locale string `chartBarNumbers` had no caller.

## Decisions

1. **A reader's preference, in the home book.** `barNumbers`, `"hidden"` or
   `"shown"`, default hidden, written by `SET_BAR_NUMBERS { barNumbers }` on
   the display-register template (`DISPLAY_REGISTERS` in
   `app/src/worker/logic.js`): validated, the default a tombstone, offline,
   auto-committed, never pushed. Someone transcribing from scores wants the
   numbers on every chart song, not one song at a time; and a per-song toggle
   would need a reading-state field beside transposition for no gain.
   Documented in `docs/home-book-format.md` §4.1.

2. **The toggle is a View item of ⋯**, beside *Name chords as voiced*:
   *Show bar numbers* / *Hide bar numbers*. It is offered only when the song
   has numbers (`isNumberedSong`), so never for a song with words: under a line
   of words a chord can last four bars or half of one and the text does not
   say which (cifra.md §2.8). A stored *shown* draws nothing on a sung song.

3. **The margin is a column of the block.** Every bars row sits in an aligned
   block (`alignBars`), a CSS grid of subgrids. With numbers shown the block
   gains a leading column (`minmax(1.8em, max-content)` — three digits wide
   whatever the block holds, so every block's bars start at one edge) and each
   bar line a leading `.barnum` cell holding its first counted bar's number. A
   real column, not an absolutely positioned label: the block scrolls sideways
   when it must (its overflow clips anything hung outside it), and print
   measures its width (`print-columns.js`) with the margin in it.

4. **A stated number mid-line shows over its bar** (`.barnum-at`), or the
   reader would count 5, 6, 7, 8 across `Dm | G7 | @17 Em | A7`. A number
   stated on the line's first bar is the margin's and is not drawn twice. The
   inline mark is positioned out of the measure's grid like an ending's
   number, and the row gains room above it.

5. **Drawn once, said once.** The drawn numbers are `aria-hidden`; the
   measure they number leads with *bar N:* in the visually-hidden layer — the
   stated ones as before, and, with the numbers shown, each line's first
   (`docs/screen-reader.md`). The margin cell is no list item: the bar line is
   still an ordered list of its measures.

6. **Print inherits it.** The printed sheet is the reading view's chart under
   the print stylesheet; nothing print-specific was needed.

7. **The look.** Smaller (0.6 of the chart's size), quieter (`--ink-2`), the
   code face with tabular figures, right-aligned against the first bar rule
   and set in a line box as tall as a chord's so it sits level with the chords
   even under an ending's bracket.

## Tests

- **unit** — `resolveBarNumbers` (absent, tombstone, unknown → hidden);
  `isNumberedSong` and the rows' counts with a stated anchor.
- **behavior** — `Chart`: nothing until asked; margins `1, 5, 21` and the
  inline `17`; the margin column in the grid template; numbers hidden from the
  tree and each said once; nothing on a sung song; axe. `SongReading`: the
  View item toggles and sends `SET_BAR_NUMBERS`; the home book's choice read
  on open; no item and no numbers for a sung song; axe. The worker's display
  preference write, table-driven with the other registers.
- **e2e-web** — `e2e/web/tests/bar-numbers.spec.js` on phone, tablet and
  computer: off until asked; shown, each margin number left of its line's
  first bar rule, the stated number visible; no sideways page scroll; axe;
  kept across a reload; drawn under print media; hidden again.
