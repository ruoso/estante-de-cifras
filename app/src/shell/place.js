// place.js — where the person is, and its address (shell.routing; DIRECTION
// §3.7 "The address follows where you are"; workflow 7 §Links to books).
//
// A place is the destination tab, the book whose page is open on Books, and the
// open song or setlist:
//
//   { tab: 'search' | 'books' | 'setlists',
//     book?:    bookId,              — that book's page, on Books (books.book_page)
//     song?:    { bookId, path },    — the open song
//     setlist?: { bookId, path } }   — the open setlist
//
// and its address is one of `/`, `/books`, `/setlists`, `/b/<book>` (the book's
// page) or `/b/<book>/<path>` (a song, or a setlist when the path
// ends in `.setlist.md`). With a song open over a setlist (a song opened from
// the setlist), the address is the song's. Everything else about the screen —
// the typed query, any search scope, the editor or history open
// over a song — is not part of an address (Decisions 2 and 3).
//
// Pure and DOM-free (pinned by place.test.js): it reads and writes a pathname
// only — the `#dev/*` mounts live in the hash and are never touched. Segments
// are percent-encoded/decoded through book-route.js.

import { bookPath, bookRoute, bookSongPath, bookSongRoute } from '../books/book-route.js';

const TAB_PATHS = { search: '/', books: '/books', setlists: '/setlists' };

const SETLIST_SUFFIX = '.setlist.md';

// Whether a book-relative path names a setlist rather than a song.
export function isSetlistPath(path) {
  return typeof path === 'string' && path.endsWith(SETLIST_SUFFIX);
}

// The place an address names, or null when the pathname is not an address (the
// app then opens on search with the URL replaced by `/`). A song's address
// carries its book's page beneath it, so its Back lands on the book's songs
// (workflow 7 §A book's page).
export function placeFromUrl(pathname) {
  if (typeof pathname !== 'string') return null;
  for (const [tab, url] of Object.entries(TAB_PATHS)) {
    if (pathname === url) return { tab };
  }
  const book = bookRoute(pathname);
  if (book) return { tab: 'books', book };
  const item = bookSongRoute(pathname);
  if (item) {
    if (isSetlistPath(item.path)) return { tab: 'setlists', setlist: item };
    return { tab: 'books', book: item.bookId, song: item };
  }
  return null;
}

// The address of a place: the open song's, else the open setlist's, else the
// open book page's (on Books), else the tab's.
export function urlFromPlace(place) {
  if (!place) return '/';
  if (place.song) return bookSongPath(place.song.bookId, place.song.path);
  if (place.setlist) return bookSongPath(place.setlist.bookId, place.setlist.path);
  if (place.book && place.tab === 'books') return bookPath(place.book);
  return TAB_PATHS[place.tab] ?? '/';
}

// The one book a search scope narrows to, or null: `{ bookId }` (no folder) or
// `{ books: [id] }` (the per-book *Search only in* button). No search scope is
// an address: a book's address is its page (books.book_page).
export function bookOfScope(scope) {
  if (!scope) return null;
  if (Array.isArray(scope.books)) return scope.books.length === 1 ? scope.books[0] : null;
  if (scope.bookId && !scope.prefix) return scope.bookId;
  return null;
}

export function sameItem(a, b) {
  if (!a || !b) return !a && !b;
  return a.bookId === b.bookId && a.path === b.path;
}

// Two places are the same place (the same address and the same tab).
export function samePlace(a, b) {
  if (!a || !b) return !a && !b;
  return (
    a.tab === b.tab &&
    (a.book ?? null) === (b.book ?? null) &&
    sameItem(a.song, b.song) &&
    sameItem(a.setlist, b.setlist)
  );
}

// Whether moving from `from` to `to` opens something — a song, a setlist, or a
// book's page on the same tab — and so is a history step (a push). A tab
// switch alone, and anything closing, is not (Decision 4).
export function isOpening(from, to) {
  if (!from || !to) return false;
  if (to.song && !sameItem(to.song, from.song)) return true;
  if (to.setlist && !sameItem(to.setlist, from.setlist)) return true;
  if (to.book && to.tab === from.tab && to.book !== (from.book ?? null)) return true;
  return false;
}
