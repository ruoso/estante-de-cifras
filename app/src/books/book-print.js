// book-print.js — the small pure helpers the book's print composes with
// (books.print): the anchors its links point at, how far the songs have come
// in, and how many times each song prints. No React, no Worker.

import { parse } from 'cifra-md';
import { songVariations } from '../core/song-variations.js';

// The indexes' anchors: every page has a way back to each (books.print_authors)
// — the index by artist, where the index begins, and the index by title.
export const INDEX_ANCHOR = 'book-print-index';
export const TITLE_INDEX_ANCHOR = 'book-print-index-titles';

// A song's anchor, by its place in the book's order. By place, not by path: a
// path may hold characters a fragment would have to escape, and the print only
// needs its links to agree with one another.
export function songAnchor(index) {
  return `book-print-song-${index}`;
}

/**
 * The copies of one song the book prints (books.print_variations): one per
 * variation the song has for the instrument in use, in the song's order
 * (Default first), when it has more than one — a student's simpler set prints
 * beside the full one; otherwise one copy as the song is read (`null`, the
 * variation in use). A song read transposed prints once: its own shapes give
 * way to yours and the default there, so every variation would print alike.
 *
 * @param {object} args
 * @param {string} args.text  the song's working-copy text
 * @param {{ transposition?: number }} [args.reading]  the song's reading state
 * @param {string} args.tuningId  the instrument in use's §6.3 tuning identity
 * @returns {(string|null)[]}  variation labels to print, or `[null]`
 */
export function printCopies({ text, reading = null, tuningId }) {
  if (!text || !tuningId || (reading?.transposition ?? 0) !== 0) return [null];
  const variations = songVariations(parse(text), tuningId);
  return variations.length > 1 ? variations : [null];
}

/**
 * The authors a song's `artist` names (books.print_authors): the field split on
 * `/`, `,` and `;` — *Pixinguinha / Benedito Lacerda*, *Pixinguinha, João de
 * Barros, Alberto Ribeiro* — each trimmed, blanks dropped. Not on *e*, *and* or
 * *&*: those as often join a duo that is one name (*Tonico e Tinoco*).
 *
 * @param {string|null|undefined} artist
 * @returns {string[]}
 */
export function splitArtists(artist) {
  return String(artist ?? '')
    .split(/[/,;]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * The book's songs as the print's index by artist lists them (books.print_order,
 * books.print_authors): grouped by author — a song with several listed under
 * each of them — the authors in alphabetical order and each author's songs by
 * title, the songs that name no artist in a last group of their own
 * (`artist: null`). Compared as the reader's language sorts (accents and case
 * aside), and a song with no title by the name it shows (`titleOf`).
 *
 * @param {{ path: string, title?: string|null, artist?: string|null }[]} songs
 * @param {object} [opts]
 * @param {string} [opts.locale]  the UI language, for the collation
 * @param {(song: object) => string} [opts.titleOf]  the title a song shows
 * @returns {{ artist: string|null, songs: object[] }[]}
 */
export function songsByArtist(songs, { locale, titleOf = (s) => s.title ?? '' } = {}) {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const groups = new Map();
  for (const song of songs) {
    const authors = splitArtists(song.artist);
    for (const artist of authors.length ? authors : [null]) {
      // One group per author however it is capitalised or accented.
      const key =
        artist === null ? null : ([...groups.keys()].find((k) => k !== null && collator.compare(k, artist) === 0) ?? artist);
      if (!groups.has(key)) groups.set(key, []);
      if (!groups.get(key).includes(song)) groups.get(key).push(song);
    }
  }
  const byTitle = (a, b) => collator.compare(titleOf(a), titleOf(b)) || collator.compare(a.path, b.path);
  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : collator.compare(a, b)))
    .map(([artist, list]) => ({ artist, songs: [...list].sort(byTitle) }));
}

/**
 * The book's songs as the print's index by title lists them (books.print_authors):
 * every song once, by the title it shows, as the reader's language sorts.
 *
 * @param {{ path: string, title?: string|null }[]} songs
 * @param {{ locale?: string, titleOf?: (song: object) => string }} [opts]
 */
export function songsByTitle(songs, { locale, titleOf = (s) => s.title ?? '' } = {}) {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  return [...songs].sort((a, b) => collator.compare(titleOf(a), titleOf(b)) || collator.compare(a.path, b.path));
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
