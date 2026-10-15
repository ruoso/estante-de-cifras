// shelf-fill.js — which of the account's books a device still has to bring
// down (account.new_device). Workflow 13 §What comes down: after the home book,
// "the shelf is listed at once from it — every book with its state — and books
// clone in the background … Books come in the shelf list's order". The queue is
// every live hosted book on the shelf (`shelf.books`, home-book-format §4.2)
// that has no repository on this device yet, in `position` order.
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

/**
 * The books to clone onto this device, in the order they come in: every
 * `shelf.books` entry with a live `link` (what a clone needs; a tombstoned
 * entry — removed, left, forked away — has none) whose id is not in
 * `presentIds`, ascending by `position`, a book without one last, ties broken
 * by book id (workflow 13 §What comes down: "in the shelf list's order").
 *
 * @param {Object} shelf the parsed shelf.json model (an absent file is `{}`)
 * @param {Set<string> | string[]} presentIds the books this device already holds
 * @returns {Array<{ bookId: string, link: string, position: number | null }>}
 */
export function fillQueue(shelf, presentIds) {
  const present = presentIds instanceof Set ? presentIds : new Set(presentIds ?? []);
  const books = shelf && typeof shelf === 'object' && !Array.isArray(shelf) ? shelf.books : null;
  if (!books || typeof books !== 'object' || Array.isArray(books)) return [];
  const out = [];
  for (const bookId of Object.keys(books)) {
    if (present.has(bookId)) continue;
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
