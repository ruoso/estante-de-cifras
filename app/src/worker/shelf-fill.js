// shelf-fill.js — which of the account's books a device still has to bring
// down (account.new_device). Workflow 13 §What comes down: after the home book,
// "the shelf is listed at once from it — every book with its state — and books
// clone in the background … Books come in the shelf list's order". The queue is
// every live hosted book on the shelf (`shelf.books`, home-book-format §4.2)
// that has no repository on this device yet and was not removed from it, in
// `position` order.
//
// The shelf is kept in step with the account's books on Estante
// (`reconcileWithEstante`): a book the account has that the shelf does not list
// — never written there, or tombstoned by an older device's removal or sign-out
// — is put back, so every device brings down every book (workflow 13 §What
// comes down), save the ones removed on this device and a fork's original.
//
// Pure: the Worker (logic.js) works out which ids have a repository here and
// clones what this returns, one at a time. No I/O, no logging — a label or a
// link is the user's (standing rule).

// A register's value when it is live — present, not a tombstone, not empty.
function liveValue(register) {
  if (!register || typeof register !== 'object') return undefined;
  const value = register.value;
  return value === null || value === undefined || value === '' ? undefined : value;
}

const isMap = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * The books to clone onto this device, in the order they come in: every
 * `shelf.books` entry with a live `link` (what a clone needs; a tombstoned
 * entry — removed, left, forked away — has none) whose id is not in
 * `presentIds`, ascending by `position`, a book without one last, ties broken
 * by book id (workflow 13 §What comes down: "in the shelf list's order").
 *
 * A book in `removedIds` — removed from this device (removed-here.js) — is
 * left out too.
 *
 * @param {Object} shelf the parsed shelf.json model (an absent file is `{}`)
 * @param {Set<string> | string[]} presentIds the books this device already holds
 * @param {Set<string> | string[]} [removedIds] the books removed from this device
 * @returns {Array<{ bookId: string, link: string, position: number | null }>}
 */
export function fillQueue(shelf, presentIds, removedIds) {
  const present = presentIds instanceof Set ? presentIds : new Set(presentIds ?? []);
  const removed = removedIds instanceof Set ? removedIds : new Set(removedIds ?? []);
  const books = shelf && typeof shelf === 'object' && !Array.isArray(shelf) ? shelf.books : null;
  if (!books || typeof books !== 'object' || Array.isArray(books)) return [];
  const out = [];
  for (const bookId of Object.keys(books)) {
    if (present.has(bookId) || removed.has(bookId)) continue;
    const link = liveValue(books[bookId]?.link);
    if (typeof link !== 'string') continue;
    const position = liveValue(books[bookId]?.position);
    out.push({ bookId, link, position: typeof position === 'number' ? position : null });
  }
  out.sort((a, b) => {
    if (a.position !== b.position) {
      if (a.position === null) return 1;
      if (b.position === null) return -1;
      return a.position - b.position;
    }
    if (a.bookId === b.bookId) return 0;
    return a.bookId < b.bookId ? -1 : 1;
  });
  return out;
}

/**
 * The shelf changes that put back the account's books on Estante the shelf
 * does not list (workflow 13 §What comes down). `listed` is GET /api/books; a
 * book is put back when it has a `gitUrl` and no live `link` on the shelf —
 * absent, or tombstoned — unless it was removed from this device
 * (`removedIds`) or is the `original` of a book on the shelf (forking replaced
 * it there, workflow 11). Each gets `label` (the book's title), `link`,
 * `position` (one past the last, in listing order), `role` and, when the
 * listing names one, `owner`. A book left out of the shelf by keeping it as a
 * local book at sign-out (a live entry in this device's own `local` namespace,
 * §7) is taken back as the account's: its local registers are tombstoned, and
 * it is named in `rejoin` so the Worker puts its remote back — the clone, its
 * history and its unsaved changes are the account's book already.
 *
 * Pure: no I/O, no logging.
 *
 * @param {Array<{ id: string, title?: string, gitUrl?: string, role?: string,
 *   ownerName?: string }>} listed the account's books
 * @param {Object} shelf the parsed shelf.json model (an absent file is `{}`)
 * @param {string} deviceId this device's `local` namespace key
 * @param {Set<string> | string[]} [removedIds] the books removed from this device
 * @returns {{ changes: Array<{ path: string[], value: any }>,
 *   rejoin: Array<{ bookId: string, link: string }> }}
 */
export function reconcileWithEstante(listed, shelf, deviceId, removedIds) {
  const removed = removedIds instanceof Set ? removedIds : new Set(removedIds ?? []);
  const books = isMap(shelf) && isMap(shelf.books) ? shelf.books : {};
  const mine = isMap(shelf) && isMap(shelf.local) && isMap(shelf.local[deviceId]) ? shelf.local[deviceId] : {};
  const originals = new Set();
  let last = -1;
  const raise = (map) => {
    for (const id of Object.keys(map)) {
      const position = liveValue(map[id]?.position);
      if (typeof position === 'number' && position > last) last = position;
    }
  };
  raise(books);
  raise(mine);
  for (const id of Object.keys(books)) {
    if (typeof liveValue(books[id]?.link) !== 'string') continue;
    const original = liveValue(books[id]?.original);
    if (isMap(original) && typeof original.bookId === 'string') originals.add(original.bookId);
  }
  const changes = [];
  const rejoin = [];
  for (const book of Array.isArray(listed) ? listed : []) {
    const id = book?.id;
    const link = book?.gitUrl;
    if (typeof id !== 'string' || !id || typeof link !== 'string' || !link) continue;
    if (removed.has(id) || originals.has(id)) continue;
    if (typeof liveValue(books[id]?.link) === 'string') continue;
    const kept = mine[id];
    const keptHere = isMap(kept) && (liveValue(kept.title) !== undefined || liveValue(kept.position) !== undefined);
    const keptPosition = keptHere ? liveValue(kept.position) : undefined;
    const position = typeof keptPosition === 'number' ? keptPosition : (last += 1);
    const label = typeof book.title === 'string' && book.title ? book.title : keptHere ? liveValue(kept.title) : undefined;
    if (typeof label === 'string' && label) changes.push({ path: ['books', id, 'label'], value: label });
    changes.push({ path: ['books', id, 'link'], value: link });
    changes.push({ path: ['books', id, 'position'], value: position });
    if (typeof book.role === 'string' && book.role) changes.push({ path: ['books', id, 'role'], value: book.role });
    if (typeof book.ownerName === 'string' && book.ownerName) {
      changes.push({ path: ['books', id, 'owner'], value: book.ownerName });
    }
    if (keptHere) {
      changes.push({ path: ['local', deviceId, id, 'title'], value: null });
      changes.push({ path: ['local', deviceId, id, 'position'], value: null });
      rejoin.push({ bookId: id, link });
    }
  }
  return { changes, rejoin };
}
