# books.print_authors — The songbook found by any author, and by title

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), task `books.print_authors` ("The
songbook found by any author, and by title"), under `task books`. It `depends
!print_order` and sits in `milestones.m5_complete`.

## Source

The human's review of book printing with their chorinho book, 2026-11-01: a
song with more than one author (*K-Ximbinho / Del Loro*, *Pixinguinha /
Benedito Lacerda*, *Pixinguinha, João de Barros, Alberto Ribeiro*) should be
presented under each author, even though the song repeats, so it is easy to
find by author; and an index by name should follow the index by author.

## Decisions

1. **Authors are split on `/`, `,` and `;`** (`splitArtists`,
   `app/src/books/book-print.js`), each trimmed, blanks dropped — the forms the
   book uses. Not on *e*, *and* or *&*: those as often join a duo that is one
   name (*Tonico e Tinoco*, *Kleiton & Kledir*), and a duo split in two is
   harder to find than a pair left whole.
2. **A song is listed under each of its authors** in the index by artist,
   merged with that author's other songs however the name is capitalised or
   accented; once per author even if the field repeats a name.
3. **Its pages print once**, where it first comes in the index by artist;
   every row for it — under each author, and in the index by title — links to
   that page. Printing a whole song once per author would grow the book by
   its co-written songs without helping anyone find them; the repetition the
   human asked for is the index's.
4. **The index by title follows the index by artist**, on a page of its own
   on paper: every song once (once per variation where it prints so), in
   alphabetical order as the reader's language sorts, its authors beside it
   as the song writes them.
5. The page's byline keeps the artist field as written.
6. **Every page has a way back to each index**: its running head carries
   *↑ Artists* (to the index by artist, where the index begins) and *↑ Titles*
   (to the index by title), in place of the one *↑ Index*, repeated on every
   page the song runs over.

## Design delta (rides in this task's commit)

- `docs/workflows/07-add-a-book.md` §Printing the book — authors split, a
  song under each, printed once, and the index by title.

## Tests

- unit: `book-print.test.js` (`splitArtists`, `songsByArtist` with several
  authors, `songsByTitle`).
- behavior: `BookPrint.behavior.test.jsx` (Cochichando under Alberto Ribeiro,
  João de Barros and Pixinguinha; each song printed once, in first-index
  order; every row for it, by artist and by title, leading to its one page;
  the byline as written; the index by title after the index by artist with
  authors beside each title; every song's running head leading to each index;
  axe).
