// shelf.js — the pure projection from the home book's shelf.json model to the
// SHELF event payload (storage.shelf_surface). home-book-format §4.2: shelf.json
// is "Two maps: the shared books, keyed by book id, and the local-only books,
// namespaced by device id (§7)." Each shared book is a map of `label`, `link`
// and `position` registers; each local book a map of `title` and `position`.
// This projects that model to the payload the `shelf` slice carries —
// `{ books, local }`, each a map of books whose leaves are `{value, at}`
// registers (protocol.js EventKind.SHELF; reducer replaces the slice).
//
// Unlike preferences.js (a flat map of registers), shelf.json is NESTED, so the
// projection walks one level deeper, keeping only §3 `isRegister` leaves:
//   - a top-level entry that is not a map yields an empty sub-map;
//   - a book present but without a given register keeps no key for it (an absent
//     register stays absent — never defaulted or fabricated);
//   - a malformed leaf (not exactly `{value, at}` with a well-formed instant) is
//     dropped rather than surfaced (a malformed home book is the validator's
//     concern, hook.home_book — not something to put into the slice or crash on);
//   - a tombstone (`{ value: null, at }`) is a well-formed register (§5.3) and
//     is kept; the consumer reads a `null` label as "no label".
// `local` is narrowed to THIS device's namespace (§7, Decision 4): a device
// reads only its own local-book markers, never another device's titles.
//
// Pure: no I/O, no logging, no labels, links or secrets in any message
// (standing rules). Plain ESM, Worker-only; imports only `isRegister`.

import { isRegister } from './home-book-merge.js';

// Whether a value is a plain map (a non-null, non-array object) — the shape of
// both top-level maps and a single book's register map (§4.2).
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// Project one book's map to a new map holding only its §3 register leaves,
// dropping anything that is not a `{value, at}` register. A book present but
// malformed (not a map) yields `{}` — present, but with no registers.
function projectBook(book) {
  const out = {};
  if (!isPlainObject(book)) return out;
  for (const key of Object.keys(book)) {
    if (isRegister(book[key])) out[key] = book[key];
  }
  return out;
}

// Project a map of books (shared, or one device's local namespace) to a new map
// of the same ids, each reduced to its register leaves. A non-map (or absent)
// input yields the empty sub-map.
function projectBooks(books) {
  const out = {};
  if (!isPlainObject(books)) return out;
  for (const id of Object.keys(books)) {
    out[id] = projectBook(books[id]);
  }
  return out;
}

/**
 * Project a shelf.json model to the SHELF event payload (§4.2). Returns
 * `{ books, local }`: `books` is a new map holding, for each shared book, the
 * sub-map of its `isRegister` leaves; `local` is the sub-map of ONLY
 * `model.local[deviceId]`'s books (§7), each reduced the same way. A
 * non-object/array model, or an absent `books`/`local`, yields the empty
 * sub-map; `{}` → `{ books: {}, local: {} }`.
 *
 * @param {Object} model the parsed shelf.json (an absent file is `{}`)
 * @param {string} deviceId this device's id (§2.3), the `local` namespace key
 * @returns {{ books: Object, local: Object }}
 */
export function surfaceShelf(model, deviceId) {
  if (!isPlainObject(model)) return { books: {}, local: {} };
  const localNs = isPlainObject(model.local) ? model.local[deviceId] : undefined;
  return {
    books: projectBooks(model.books),
    local: projectBooks(localNs),
  };
}
