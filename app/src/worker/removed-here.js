// removed-here.js — the device-local list of the account's books removed from
// THIS device (workflow 7 §Removing a book: *Remove from my shelf* deletes the
// local clone only). The account's shelf (home-book-format §4.2) is every
// device's, so a removal is not written there — tombstoning the shared register
// would take the book off every other device's shelf too, and keep a new
// device from bringing it down (workflow 13 §What comes down). Like recents and
// the dismissed *only on your …* rows, it lives in the Worker-owned `meta`
// object store under its own key: no git, no commit, no network.
//
// A book on this list is left out of this device's shelf, its fill and its
// reconciliation with the account's books on Estante; *Mine on Estante* offers
// it again, and adding it takes it off. Signing out clears the list: the next
// account on this device starts with every one of its books.
//
// BOUNDARY: framework-free, owns no React. Logs nothing (a book id is account
// data; standing rule).

import { META_STORE } from './migrations.js';

export const REMOVED_HERE_META_KEY = 'removedHere';

/**
 * Pure list move: `bookId` added (`removed: true`) or taken off (`false`).
 * Returns the SAME array when nothing changed; drops malformed entries.
 *
 * @param {string[]} list
 * @param {string} bookId
 * @param {boolean} removed
 * @returns {string[]}
 */
export function markRemoved(list, bookId, removed) {
  const prev = Array.isArray(list) ? list : [];
  const kept = prev.filter((id) => typeof id === 'string' && id !== '');
  const has = kept.includes(bookId);
  if (removed === has) return kept.length === prev.length ? prev : kept;
  return removed ? [...kept, bookId] : kept.filter((id) => id !== bookId);
}

/**
 * The device-local store over the Worker's open `meta` database. Writes are
 * serialised, as recents' are: each is a read-modify-write on one key, and the
 * Worker handles commands concurrently.
 *
 * @returns {{ read: (db: IDBDatabase) => Promise<Set<string>>,
 *   mark: (db: IDBDatabase, bookId: string, removed: boolean) => Promise<Set<string>>,
 *   clear: (db: IDBDatabase) => Promise<void> }}
 */
export function createRemovedHere() {
  let writeQueue = Promise.resolve();

  function read(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const request = tx.objectStore(META_STORE).get(REMOVED_HERE_META_KEY);
      let list = [];
      request.onsuccess = () => {
        list = markRemoved(request.result, '', false);
      };
      tx.oncomplete = () => resolve(new Set(list));
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function serialised(apply) {
    const run = () =>
      new Promise((resolve, reject) => {
        let next = [];
        const tx = apply((value) => {
          next = value;
        });
        tx.oncomplete = () => resolve(new Set(next));
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    const result = writeQueue.then(run, run);
    writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  // Add or take off one book, and persist; resolves with the new set once the
  // write is durable.
  function mark(db, bookId, removed) {
    return serialised((settle) => {
      const tx = db.transaction(META_STORE, 'readwrite');
      const store = tx.objectStore(META_STORE);
      const request = store.get(REMOVED_HERE_META_KEY);
      request.onsuccess = () => {
        const prev = Array.isArray(request.result) ? request.result : [];
        const next = markRemoved(prev, bookId, removed);
        if (next !== prev) store.put(next, REMOVED_HERE_META_KEY);
        settle(next);
      };
      return tx;
    });
  }

  // Forget every removal (signing out).
  function clear(db) {
    return serialised(() => {
      const tx = db.transaction(META_STORE, 'readwrite');
      tx.objectStore(META_STORE).delete(REMOVED_HERE_META_KEY);
      return tx;
    }).then(() => undefined);
  }

  return { read, mark, clear };
}
