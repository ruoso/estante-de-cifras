# books.print_order — The songbook by artist, one copy per variation

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), task `books.print_order` ("The
songbook by artist, one copy per variation"), under `task books`. It `depends
songs.print_no_defaults` and sits in `milestones.m5_complete`.

## Source

The human's review of book printing, 2026-11-01: the print should print once
for each variant, and the names should be sorted, grouped by artist.

## Decisions

1. **Grouped by artist, alphabetical** (`songsByArtist`,
   `app/src/books/book-print.js`). The artists in alphabetical order, each a
   small heading over its songs, the songs by title; the songs that name no
   artist last, under *No artist named*. Sorted with `Intl.Collator` in the UI
   language at base sensitivity with numeric order — *Água* beside *abril*,
   *Canção 2* before *Canção 10* — and an artist written two ways (*Ana Lima*,
   *ana lima*) is one group, named as first met. A song with no title sorts by
   the name it shows. The artist no longer repeats on each row.
2. **The pages follow the index.** Each printed copy is numbered in that
   order, and its anchor is its place, so the index's links and the pages
   agree.
3. **One copy per variation** (`printCopies`). A song with more than one
   variation for the instrument in use prints once for each, in the song's
   order (`songVariations`: Default first): `PrintedSong` reads it with that
   variation in use for the tuning, its byline names it after the instrument
   (*Guitar · Easy*), and the index lists the copy with the variation beside
   the title, under the same artist. With one variation or none it prints once
   as read. A song read transposed prints once: its own voicings are
   suppressed there (workflow 2), so every variation would print alike.

## Design delta (rides in this task's commit)

- `docs/workflows/07-add-a-book.md` §Printing the book — the index grouped by
  artist, the pages in its order, and one copy per variation.

## Tests

- unit: `book-print.test.js` (`songsByArtist`, `printCopies`).
- behavior: `BookPrint.behavior.test.jsx` (the artist groups and their order,
  the pages in that order; a song with Default and *Easy* printed twice, each
  with its own shapes, byline, index row and way back; axe).
- e2e-web: none new — the print's order and copies are the view's
  composition, pinned at the behavior level; `print-defaults.spec.js` already
  drives the book's print in a browser.
