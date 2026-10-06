// book-display.js — the pure display derivation for the book-management screen
// (books.shelf). It turns one book's register map (from the `shelf` slice:
// `{ label|title, link, position, … }` registers) into what a row shows: its
// title, where it lives, whether the user can save, and its sync state; and it
// orders the shelf by each book's `position`. No React, no i18n, no I/O — the
// view maps these tokens to copy through `t()` and renders them (DIRECTION §3.7
// L410-414). Pinning the format: home-book-format §4.2 (shelf.json), §5.3
// (tombstones). Pinning the design: workflow 7 L14-21.

// A register is the §3 `{ value, at }` envelope; its `value` is `null` for a
// tombstone (§5.3). A register's displayable value is its `value` when it is a
// non-empty, non-null value, else nothing.
function registerValue(register) {
  const value = register?.value;
  return value === null || value === undefined || value === '' ? undefined : value;
}

/**
 * A book's displayed title: the shelf label (a shared book's `label` register)
 * or title (a local book's `title` register) when present and non-tombstone,
 * else the opaque `bookId` — the same fallback the search screen uses
 * (SearchScreen.jsx:335), extended to local titles (Decision 3). A README-heading
 * fallback for a label-less shared book is deferred to when shared books exist
 * (Decision 4); in M2 a local book always carries a `title`. Pins workflow 7
 * L16-18; home-book-format §5.3.
 *
 * @param {Object} book one book's register map from the `shelf` slice
 * @param {string} bookId the opaque id, the fallback
 * @returns {string}
 */
export function titleFor(book, bookId) {
  return registerValue(book?.label) ?? registerValue(book?.title) ?? bookId;
}

/**
 * Where a book lives, as a copy key the view translates (never colour alone,
 * mockups README L26): a `local` book is `onDevice`, a shared (`books`) book is
 * `onEstante`. Pins workflow 7 L19.
 *
 * @param {'local' | 'shared'} kind which shelf map the book is in
 * @returns {'onDevice' | 'onEstante'}
 */
export function whereFor(kind) {
  return kind === 'local' ? 'onDevice' : 'onEstante';
}

/**
 * Whether the user can save to a book: a `local` book is always savable; a
 * shared book's role is the membership seam (Decision 5) — `editor` can save,
 * `reader` cannot, and an absent role is `null` (the seam is not filled yet, so
 * the view renders no role word). Pins workflow 7 L20.
 *
 * @param {'local' | 'shared'} kind
 * @param {Object} book one book's register map
 * @returns {boolean | null} true (can save) / false (reader) / null (unknown)
 */
export function canSaveFor(kind, book) {
  if (kind === 'local') return true;
  const role = book?.role?.value;
  if (role === 'editor') return true;
  if (role === 'reader') return false;
  return null;
}

/**
 * A book's sync state, as a render-when-present seam (Decision 5): the live
 * source is sync.states / books.online, so this reads an optional `sync`
 * register and returns `null` when the book is in step (no badge, workflow 7
 * L21/L47). When present it returns the W08 word key and the `.badge` class the
 * view carries (a word, never colour alone):
 *   - `syncing`  → no badge class
 *   - `unsaved`  → `.badge.unsaved`, with a `count`
 *   - `conflict` → `.badge.conflict.dot`
 *
 * @param {Object} book one book's register map
 * @returns {{ state: string, cls: string, count?: number } | null}
 */
export function syncStateFor(book) {
  const value = book?.sync?.value;
  if (!value || typeof value !== 'object') return null;
  if (value.state === 'syncing') return { state: 'syncing', cls: '' };
  if (value.state === 'unsaved') {
    return { state: 'unsaved', cls: 'unsaved', count: value.count ?? 0 };
  }
  if (value.state === 'conflict') return { state: 'conflict', cls: 'conflict dot' };
  return null;
}

// Compare two book ids for a stable, deterministic order (ties on position).
function byId(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Every book on the shelf, ordered for display: the shared books (`shelf.books`)
 * and this device's local books (`shelf.local`, already narrowed to the device
 * by the surface, §7), ascending by each book's `position` register, ties broken
 * stably by id, and a book with no `position` last (also stable by id). Pins the
 * shelf order (home-book-format §4.2 `position`), books.shelf acceptance 2.
 *
 * @param {{ books?: Object, local?: Object }} shelf the `shelf` slice
 * @returns {Array<{ id: string, book: Object, kind: 'local' | 'shared' }>}
 */
export function orderedBooks(shelf) {
  const entries = [];
  const books = shelf?.books ?? {};
  const local = shelf?.local ?? {};
  for (const id of Object.keys(books)) entries.push({ id, book: books[id], kind: 'shared' });
  for (const id of Object.keys(local)) entries.push({ id, book: local[id], kind: 'local' });
  entries.sort((a, b) => {
    const pa = a.book?.position?.value;
    const pb = b.book?.position?.value;
    const na = typeof pa === 'number';
    const nb = typeof pb === 'number';
    if (na && nb) return pa === pb ? byId(a.id, b.id) : pa - pb;
    if (na) return -1; // a has a position, b does not: a first
    if (nb) return 1;
    return byId(a.id, b.id); // neither has a position: stable by id
  });
  return entries;
}
