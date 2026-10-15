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
 * A member's book also carries the owner's name (`ownerName`, books.owner_name)
 * when the service gave one, so the row's Leave can name the owner and the add
 * can write the shelf's `owner` register; it is absent otherwise.
 *
 * @param {Array<{ id: string, title?: string, role?: string, gitUrl?: string,
 *   ownerName?: string }>} listBooks
 *   the GET /api/books response array (each Book carries `role` and `gitUrl`)
 * @param {{ books?: Object, local?: Object }} shelf the parsed shelf.json model
 *   (nested `{value, at}` registers; an absent file is `{}`)
 * @param {string} deviceId this device's local namespace key (§7)
 * @returns {Array<{ id: string, label: string, gitUrl: string, role: string,
 *   ownerName?: string }>}
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
      ...(ownerNameOf(book) ? { ownerName: book.ownerName } : {}),
    }));
}

// The owner's name a listed Book carries, or null when it carries none (the
// field is optional, books.owner_name). Only a non-empty string is a name.
function ownerNameOf(book) {
  return typeof book?.ownerName === 'string' && book.ownerName !== '' ? book.ownerName : null;
}

/**
 * The shelf changes that bring each on-shelf book's `owner` register in line
 * with the account's listing (books.owner_name; home-book-format §4.2): the
 * owner's name as the service last gave it. A book on the shelf (any live
 * register) whose listed name differs from its register gets the new name, or
 * a tombstone when the listing no longer carries one and the register still
 * holds one (§5.3). A book not on the shelf, or already in line, yields no
 * change — so a listing with nothing new writes nothing.
 *
 * @param {Array<{ id: string, ownerName?: string }>} listBooks the GET /api/books array
 * @param {{ books?: Object }} shelf the parsed shelf.json model
 * @returns {Array<{ path: string[], value: string | null }>} home-book `set` changes
 */
export function ownerRefreshChanges(listBooks, shelf) {
  const books = shelf && typeof shelf === 'object' ? shelf.books : null;
  if (!books || typeof books !== 'object') return [];
  const changes = [];
  for (const book of Array.isArray(listBooks) ? listBooks : []) {
    if (!book || typeof book.id !== 'string' || !onShelf(books[book.id])) continue;
    const name = ownerNameOf(book);
    const held = books[book.id].owner;
    const current = registerHolds(held) ? held.value : null;
    if (name === current) continue;
    changes.push({ path: ['books', book.id, 'owner'], value: name });
  }
  return changes;
}
