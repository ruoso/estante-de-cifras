// unsaved-list.js — the computer editor's *Unsaved* list (songs.editor_chrome
// Constraint 9; W04#4 L163-168; workflow 4 §Saving): every song with unsaved
// changes across the shelf, the one being edited first, each a step away. Pure:
// it reads the `browse` slice (each book's songs with their `unsaved` flag) and
// the `shelf` slice (which books are on it, in which order, under which name)
// and returns the rows the pane draws. No React, no i18n, no I/O.

import { orderedBooks, titleFor } from '../books/book-display.js';
import { songTitle, folderOf } from './search-query.js';

const keyOf = (bookId, path) => `${bookId}\u0000${path}`;

/**
 * The rows of the Unsaved list.
 *
 * - only songs the index marks `unsaved`, in books still on the shelf;
 * - the song being edited (`current`) first and marked `current`, whether or
 *   not the index has caught up with its edit yet;
 * - the rest in shelf order (each book's `position`), then by title;
 * - `meta` is the book's name at its root, `{book} · {folder}/` below it;
 * - `unsaved` is true on every row but the current one, which carries the
 *   host's live flag (`current.unsaved`) — it is listed even opened in step.
 *
 * @param {{ books?: Array<{ bookId: string, songs?: Array<{ path: string, title?: string, unsaved?: boolean }> }> }} browse
 * @param {{ books?: Object, local?: Object }} shelf
 * @param {{ bookId: string, path: string, title?: string, unsaved?: boolean } | null} current
 * @param {{ untitledBook: string, untitledSong: string }} fallbacks the
 *   localized *Untitled book* / *Untitled song* — never an id or a file name
 *   (songs.no_raw_ids Constraints 1-2)
 * @returns {Array<{ id: string, bookId: string, path: string, title: string, meta: string, current: boolean, unsaved: boolean }>}
 */
export function unsavedRows(browse, shelf, current, { untitledBook, untitledSong } = {}) {
  const books = orderedBooks(shelf);
  const order = new Map(books.map((b, i) => [b.id, i]));
  const labels = new Map(books.map((b) => [b.id, titleFor(b.book, untitledBook)]));
  const metaOf = (bookId, path) => {
    const book = labels.get(bookId) ?? untitledBook;
    const folder = folderOf(path);
    return folder ? `${book} · ${folder}/` : book;
  };

  const rows = [];
  const seen = new Set();
  let currentRow = null;
  if (current?.bookId && current?.path) {
    const id = keyOf(current.bookId, current.path);
    seen.add(id);
    // The title the browse slice holds, else the one the host shows.
    const indexed = browse?.books
      ?.find((b) => b.bookId === current.bookId)
      ?.songs?.find((s) => s.path === current.path);
    currentRow = {
      id,
      bookId: current.bookId,
      path: current.path,
      title: songTitle(current.title || indexed?.title || '', untitledSong),
      meta: metaOf(current.bookId, current.path),
      current: true,
      unsaved: current.unsaved ?? Boolean(indexed?.unsaved),
    };
  }

  for (const book of browse?.books ?? []) {
    if (!order.has(book.bookId)) continue; // no longer on the shelf
    for (const song of book.songs ?? []) {
      if (!song.unsaved) continue;
      const id = keyOf(book.bookId, song.path);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push({
        id,
        bookId: book.bookId,
        path: song.path,
        title: songTitle(song.title, untitledSong),
        meta: metaOf(book.bookId, song.path),
        current: false,
        unsaved: true,
      });
    }
  }
  rows.sort((a, b) => {
    const byBook = order.get(a.bookId) - order.get(b.bookId);
    if (byBook) return byBook;
    return a.title.localeCompare(b.title) || a.path.localeCompare(b.path);
  });
  return currentRow ? [currentRow, ...rows] : rows;
}
