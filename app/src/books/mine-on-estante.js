// mine-on-estante.js — the pure "mine on Estante" diff (books.add_by_link,
// workflow 7 §Add-a-book "Mine on Estante"). The account's books (GET /api/books)
// minus the books already on THIS device's shelf: the ones the person can add
// (clone) onto this device. A client-side diff, because the service has no
// per-device state — which books a device holds is the device's own knowledge
// (Decision 5). No I/O, no network, no React: the Worker computes it over the
// listBooks response and the home book's shelf model (home-book-format §4.2),
// then emits the result; the Add-a-book sheet renders it.
//
// Pure and unit-pinned (mine-on-estante.test.js). Logs nothing.

// A register is the §3 `{ value, at }` envelope; a tombstone is `{ value: null }`
// (§5.3). A register "holds" something when its value is present and non-empty.
function registerHolds(register) {
  const value = register?.value;
  return value !== null && value !== undefined && value !== '';
}

// Whether a book's register map marks it as present on the shelf: it has at least
// one live (non-tombstone, non-empty) register. A book with no registers (`{}`,
// surfaced before its label) or every register tombstoned (put online / removed,
// §5.3) counts as ABSENT — so a tombstoned shelf entry re-appears under "mine on
// Estante", addable again.
function onShelf(entry) {
  if (!entry || typeof entry !== 'object') return false;
  return Object.keys(entry).some((key) => registerHolds(entry[key]));
}

/**
 * The account's books not yet on this device's shelf, each addable (cloned) onto
 * it. A book from `listBooks` is excluded when it is already on the shelf — a
 * hosted clone (`shelf.books[id]`) or, defensively, this device's local
 * namespace (`shelf.local[deviceId][id]`) — and included otherwise, carrying its
 * `role` and `gitUrl` so the add can clone it with no extra fetch and show the
 * granted role. A fully-tombstoned shelf entry counts as absent (the book was
 * removed from this device and can be added back).
 *
 * @param {Array<{ id: string, title?: string, role?: string, gitUrl?: string }>} listBooks
 *   the GET /api/books response array (each Book carries `role` and `gitUrl`)
 * @param {{ books?: Object, local?: Object }} shelf the parsed shelf.json model
 *   (nested `{value, at}` registers; an absent file is `{}`)
 * @param {string} deviceId this device's local namespace key (§7)
 * @returns {Array<{ id: string, label: string, gitUrl: string, role: string }>}
 */
export function booksNotOnShelf(listBooks, shelf, deviceId) {
  const held = new Set();
  const books = shelf && typeof shelf === 'object' ? shelf.books : null;
  if (books && typeof books === 'object') {
    for (const id of Object.keys(books)) {
      if (onShelf(books[id])) held.add(id);
    }
  }
  const localNs =
    shelf && typeof shelf === 'object' && shelf.local && typeof shelf.local === 'object'
      ? shelf.local[deviceId]
      : null;
  if (localNs && typeof localNs === 'object') {
    for (const id of Object.keys(localNs)) {
      if (onShelf(localNs[id])) held.add(id);
    }
  }
  return (Array.isArray(listBooks) ? listBooks : [])
    .filter((book) => book && typeof book.id === 'string' && !held.has(book.id))
    .map((book) => ({
      id: book.id,
      label: book.title,
      gitUrl: book.gitUrl,
      role: book.role,
    }));
}
