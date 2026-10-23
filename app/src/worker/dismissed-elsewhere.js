// dismissed-elsewhere.js — the device-local list of *only on your …* rows the
// reader dismissed (workflow 13 §Books that were only on the other device). A
// book only on another device is a warning on this device's shelf, not a book:
// once the reader has seen it they can put it away. The dismissal belongs to
// THIS device — the marker it hides lives in the other device's namespace of
// the home book (home-book-format §7), which this device never writes, and
// another new device should still be told. So, like recents, it lives in the
// Worker-owned `meta` object store under its own key: no git, no commit, no
// network.
//
// An entry is `{ deviceId, bookId }`, the same pair that names an `elsewhere`
// item. A book the other device puts online drops out of `elsewhere` on its
// own (its marker is tombstoned); a stale dismissal is harmless and is pruned
// whenever the list is written.
//
// BOUNDARY: framework-free, owns no React. Logs nothing (a book id is account
// data; standing rule).

import { META_STORE } from './migrations.js';

export const DISMISSED_ELSEWHERE_META_KEY = 'dismissedElsewhere';

// Whether a stored value is a well-formed entry.
function isEntry(e) {
  return !!e && typeof e.deviceId === 'string' && typeof e.bookId === 'string';
}

/**
 * Pure list move: add `{ deviceId, bookId }`, and keep only the entries that
 * still name a live `elsewhere` item when `live` is given (a stale one can
 * never show again). Returns the SAME array when nothing changed.
 *
 * @param {Array<{ deviceId: string, bookId: string }>} list
 * @param {{ deviceId: string, bookId: string }} entry
 * @param {Array<{ deviceId: string, bookId: string }>} [live]
 * @returns {Array<{ deviceId: string, bookId: string }>}
 */
export function addDismissal(list, entry, live) {
  const prev = Array.isArray(list) ? list : [];
  const same = (a, b) => a.deviceId === b.deviceId && a.bookId === b.bookId;
  const kept = prev.filter((e) => isEntry(e) && (!Array.isArray(live) || live.some((l) => same(l, e))));
  if (kept.some((e) => same(e, entry))) return kept.length === prev.length ? prev : kept;
  return [...kept, { deviceId: entry.deviceId, bookId: entry.bookId }];
}

/**
 * The device-local dismissal store over the Worker's open `meta` database.
 * Writes are serialised, as recents' are: a dismissal is a read-modify-write on
 * one key, and the Worker handles commands concurrently.
 *
 * @returns {{ read: (db: IDBDatabase) => Promise<Array>,
 *   dismiss: (db: IDBDatabase, entry: { deviceId: string, bookId: string },
 *     live?: Array<{ deviceId: string, bookId: string }>) => Promise<Array> }}
 */
export function createDismissedElsewhere() {
  let writeQueue = Promise.resolve();

  // Read the list, an absent key as the empty list.
  function read(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const request = tx.objectStore(META_STORE).get(DISMISSED_ELSEWHERE_META_KEY);
      let list = [];
      request.onsuccess = () => {
        list = Array.isArray(request.result) ? request.result.filter(isEntry) : [];
      };
      tx.oncomplete = () => resolve(list);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // Add a dismissal (pruning stale ones against `live`) and persist; resolves
  // with the new list once the write is durable.
  function dismiss(db, entry, live) {
    const run = () =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, 'readwrite');
        const store = tx.objectStore(META_STORE);
        const request = store.get(DISMISSED_ELSEWHERE_META_KEY);
        let next = [];
        request.onsuccess = () => {
          const prev = Array.isArray(request.result) ? request.result : [];
          next = addDismissal(prev, entry, live);
          if (next !== prev) store.put(next, DISMISSED_ELSEWHERE_META_KEY);
        };
        tx.oncomplete = () => resolve(next);
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

  return { read, dismiss };
}
