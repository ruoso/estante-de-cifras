// book-print.js — the small pure helpers the book's print composes with
// (books.print): the anchors its links point at, and how far the songs have
// come in. No React, no Worker.

// The index's anchor: every page's way back points here.
export const INDEX_ANCHOR = 'book-print-index';

// A song's anchor, by its place in the book's order. By place, not by path: a
// path may hold characters a fragment would have to escape, and the print only
// needs its links to agree with one another.
export function songAnchor(index) {
  return `book-print-song-${index}`;
}

/**
 * How many of the book's songs have their text in: `{ done, total, ready }`,
 * ready once every song has (and never for a book with none).
 *
 * @param {{ path: string }[]} songs  the book's songs, as browsed
 * @param {Record<string, { text?: string }>} texts  the `source` slice for the book
 */
export function printProgress(songs, texts) {
  const total = songs.length;
  const done = songs.filter((s) => texts?.[s.path] != null).length;
  return { done, total, ready: total > 0 && done === total };
}
