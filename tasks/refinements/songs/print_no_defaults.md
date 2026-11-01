# songs.print_no_defaults — Paper carries the shapes, not how they were chosen

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), task `songs.print_no_defaults`
("Paper carries the shapes, not how they were chosen"), under `task songs`. It
`depends !reading, !shape_words` and sits in `milestones.m5_complete`.

## Source

The human's review of book printing, 2026-11-01: the *default* marker, the note
about defaults and the banner suggesting an arrangement should not be in the
printed format. Workflow 2 had already decided it — *On paper they print
alike, since a student needs the shape, not its provenance* — and the print
had not followed.

## Decisions

1. **Every shape prints as the song's own.** Under `@media print` a diagram
   of the app's suggestion or of the reader's own shape loses its word
   (*default*, *your shape*) and is filled in ink like the song's
   (`app/src/diagram/diagram.css`). Both, not only *default*: workflow 2 says
   they print alike.
2. **The marks caption stays on screen.** *In ink… In colour… In outline,
   marked default…* explains marks paper does not carry; `SongShapes` gives it
   `reading-shapes-marks` when `captionExplainsMarks(sheet)` — every case but
   the transposed caption, which says something true on paper too and still
   prints.
3. **The arrange notice stays on screen.** *This song doesn’t say yet how to
   play its chords on …*, with *Arrange for …*, is an offer to act, and takes
   `reading-no-voicings`, hidden in print beside the instrument prompt.
4. The reading view's print and the book's print share these through
   `SongShapes` and the global print rules; the book's on-screen preview keeps
   the marks, as the reading view does.

## Design delta (rides in this task's commit)

- `docs/workflows/02-find-and-play.md` §Where a chord's shape comes from — what
  *print alike* leaves off paper.

## Tests

- unit: `song-sheet.test.js` (`captionExplainsMarks`).
- behavior: `SongReading.behavior.test.jsx` (the marks caption and the arrange
  notice carry their screen-only classes).
- e2e-web: `print-defaults.spec.js` — with a Drop D instrument no example song
  carries, the reading view and the book's print under
  `emulateMedia({ media: 'print' })`: shapes visible, no *default* word, no
  marks caption, no arrange notice, every default dot filled in ink; back on
  screen all of it returns. *Your shape* follows by the same CSS rule; the
  suite has no journey that saves one before printing.
