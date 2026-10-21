// search-query.js — the pure, framework-free helpers behind the search screen
// (songs.search). It knows nothing of React: it recognises a chord in the
// user's notation (so the screen can offer the explorer row), maps the screen's
// ephemeral scope to a SEARCH/BROWSE command payload, and derives a song's
// display title and folder from its path. The screen (SearchScreen.jsx) owns
// the state and the RAC view; this module owns the decisions that are testable
// without a DOM.
//
// Chord recognition reuses the music core's dialect-aware parser — the one
// conformance-pinned owner of "is this a chord?" — rather than a bespoke regex
// that would drift (Decision 4). The parser is permissive and root-anchored, so
// a bare letter like `A` or `G` parses as a chord; that is exactly why the
// explorer row is ADDITIVE (offered alongside the text and chord-use results,
// never instead of them — workflow 2 L35-40, "nothing is hidden by guessing").

import { parseChord } from '../core/notation/parse.js';
import { DEFAULT_DIALECT } from '../core/notation/dialects.js';

/**
 * Does the query parse as a chord symbol in the given notation dialect? Returns
 * the parsed chord and any ambiguities (cifra.md §5.6, read in that dialect) so
 * the screen can offer an "Explore {query}" row, or `null` when the text is not
 * a chord (a word, an accented word, empty). The ambiguity is read in the
 * dialect the caller passes (the user's `preferences.notation`), so `C7+` is
 * read one way under `brazilian` and another under `american`.
 *
 * @param {string} query the raw search box text
 * @param {string} [dialectId] the notation dialect id (defaults to the app's)
 * @returns {{ chord: import('../core/chord.js').Chord, ambiguities: Array } | null}
 */
export function recognizeChord(query, dialectId = DEFAULT_DIALECT) {
  const text = (query ?? '').trim();
  if (!text) return null;
  const { chord, ambiguities } = parseChord(text, dialectId);
  if (!chord) return null;
  return { chord, ambiguities };
}

// A fresh session starts with no scope: the filter "resets at the start of each
// session" (workflow 2 L63). The screen holds this in `useState`, so every
// mount re-initialises it to this value — nothing is persisted (Decision 8).
export const INITIAL_SCOPE = null;

/**
 * Map the screen's scope value to the `scope` of a SEARCH / BROWSE command
 * (storage.index understands `{ books: [...] }` and `{ bookId, prefix }`). The
 * screen's scope is one of: `null` (search every book — the reset default),
 * `{ books: [...] }` (a set of books), `{ bookId }` (one book), or
 * `{ bookId, prefix }` (a folder within one book). A scope that narrows to
 * nothing maps to `undefined`, i.e. no narrowing.
 *
 * @param {null | { books?: string[], bookId?: string, prefix?: string }} scope
 * @returns {undefined | { books: string[] } | { bookId: string, prefix: string }}
 */
export function scopePayload(scope) {
  if (!scope) return undefined;
  if (Array.isArray(scope.books)) {
    return scope.books.length ? { books: [...scope.books] } : undefined;
  }
  if (scope.bookId) {
    return scope.prefix
      ? { bookId: scope.bookId, prefix: scope.prefix }
      : { books: [scope.bookId] };
  }
  return undefined;
}

/**
 * Does the scope hold this book (and, when given, this path)? The main-thread
 * mirror of the Worker's `matchesScope` (storage.index) over the screen's scope
 * shapes: `null` holds everything; `{ books }` holds those books; `{ bookId }`
 * that one book; `{ bookId, prefix }` the paths under the prefix in that book —
 * a book with no path given is held when it is the scope's book. A scoped
 * search is that book's songs (workflow 2 §Scope), so the screen lists only the
 * books and recents this holds (songs.search_scope_follows Constraint 3).
 *
 * @param {null | { books?: string[], bookId?: string, prefix?: string }} scope
 * @param {string} bookId
 * @param {string} [path]
 * @returns {boolean}
 */
export function inScope(scope, bookId, path) {
  if (!scope) return true;
  if (Array.isArray(scope.books)) return scope.books.includes(bookId);
  if (scope.bookId) {
    if (bookId !== scope.bookId) return false;
    if (scope.prefix && path !== undefined && path !== null) {
      return path.startsWith(scope.prefix);
    }
    return true;
  }
  return true;
}

/**
 * Where the scope goes after a song is saved (workflow 2 §Scope, *After a save,
 * the scope follows the song*): no scope stays no scope (a save never sets one
 * the person did not — Decision 2); a scope that holds the saved song is kept,
 * the same object, so nothing re-renders and no history entry is made; any
 * other scope becomes the saved book's (`{ bookId }`), so the song shows.
 *
 * @param {null | { books?: string[], bookId?: string, prefix?: string }} scope
 * @param {string} bookId the book the song was saved into
 * @param {string} [path] the saved song's path in it
 * @returns {null | object}
 */
export function followScope(scope, bookId, path) {
  if (!scope) return scope ?? null;
  if (!bookId || inScope(scope, bookId, path)) return scope;
  return { bookId };
}

/**
 * A book's id changed (a fork, a put-online): its open-state entry in the
 * search's `Map<bookId, boolean>` moves with it (songs.search_scope_follows
 * Constraint 5). The same map when the old id has no entry, so applying it
 * twice is harmless.
 *
 * @param {Map<string, boolean>} expanded
 * @param {string} fromId
 * @param {string} toId
 * @returns {Map<string, boolean>}
 */
export function moveBookEntry(expanded, fromId, toId) {
  if (!expanded.has(fromId)) return expanded;
  const next = new Map(expanded);
  next.set(toId, next.get(fromId));
  next.delete(fromId);
  return next;
}

/**
 * A song's display title: its own title, or — for "a song with no title" — the
 * caller's localized `untitled` (*Untitled song*). The placeholder file name
 * (`untitled-2.cifra.md`) shows only in the file view (workflow 3 L37-41;
 * workflow 2 L180-182; songs.no_raw_ids Constraint 1). Search never shows a
 * filename (DIRECTION §4 L437).
 *
 * @param {string} title the indexed title (may be empty)
 * @param {string} untitled the localized fallback
 * @returns {string}
 */
export function songTitle(title, untitled) {
  return typeof title === 'string' && title.trim() ? title : untitled;
}

/**
 * The folder a song lives in within its book, or `''` at the root — so a result
 * says "where it lives": book, and folder only when it is not at the root
 * (workflow 2 L49).
 *
 * @param {string} path
 * @returns {string}
 */
export function folderOf(path) {
  const i = (path ?? '').lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}
