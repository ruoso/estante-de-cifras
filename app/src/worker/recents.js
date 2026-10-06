// recents.js — the device-local "recently opened" list (songs.search,
// workflow 2 L13-20). A reader lands on recents before typing anything: "the
// way back into what you were playing." They change every time a song is
// opened, and — crucially — are NOT synced: "What you played on the phone last
// night is not something the laptop needs" (workflow 2 L17-20, DIRECTION §3.2).
// A home-book commit per song-open is exactly what that rules out, so recents
// live in the Worker-owned `meta` object store (home-book-format §2.3), the
// established device-local seam that already holds the device id — no new
// migration, no git, no network (Decision 2).
//
// BOUNDARY: like the rest of the Worker, this is framework-free and owns no
// React. The `meta` store is the one `logic.js` opens; this module takes that
// open database and reads/writes a single `recents` key within it, mirroring
// how `home-book.js`'s `ensureDeviceId` keeps the device id on the meta record.
// Logs nothing — a recent is a location reference (bookId + path), never song
// text (standing rule, logic.js:9-11).

import { META_STORE } from './migrations.js';

// The `meta` object store is keyless (out-of-line keys, migrations.js step 1),
// so the recents list lives under its own key alongside the singleton `meta`
// record — never a field on it, so recording a recent never disturbs the
// schema/device-id record.
export const RECENTS_META_KEY = 'recents';

// How many recents are kept. A reader's way back into what they were playing is
// a short list, not a history; older entries fall off the end as new songs are
// opened (workflow 2 L13-14). `storage.history` owns the full version log.
export const DEFAULT_RECENTS_CAP = 50;

/**
 * Pure list move: put `entry` at the front, drop any prior entry for the same
 * location (so re-opening a song moves it to the top rather than duplicating
 * it), and cap the length. Most-recent-first.
 *
 * @param {Array<{ bookId: string, path: string, at: string }>} list
 * @param {{ bookId: string, path: string, at: string }} entry
 * @param {number} cap
 * @returns {Array<{ bookId: string, path: string, at: string }>}
 */
export function promoteRecent(list, entry, cap = DEFAULT_RECENTS_CAP) {
  const rest = (Array.isArray(list) ? list : []).filter(
    (r) => !(r.bookId === entry.bookId && r.path === entry.path),
  );
  return [entry, ...rest].slice(0, cap);
}

/**
 * The device-local recents store over the Worker's open `meta` database. Both
 * operations run in one `meta`-store transaction, resolved on completion so the
 * write is durable before it is reported.
 *
 * @param {{ cap?: number }} [opts]
 * @returns {{ read: (db: IDBDatabase) => Promise<Array>,
 *   record: (db: IDBDatabase, entry: { bookId: string, path: string, now?: number }) => Promise<Array> }}
 */
export function createRecents({ cap = DEFAULT_RECENTS_CAP } = {}) {
  // Serialise writes. A RECORD_RECENT is a read-modify-write on the single
  // `recents` key, and the Worker handles commands concurrently — several
  // song-opens could arrive before one write completes, and two concurrent
  // read-modify-writes would lose an entry to a last-writer-wins race. Chaining
  // each record after the previous one (this factory is a per-Worker singleton,
  // so all records share the chain) makes the list grow correctly regardless of
  // arrival order.
  let writeQueue = Promise.resolve();

  // Read the recents list, an absent key as the empty list (first run).
  function read(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const request = tx.objectStore(META_STORE).get(RECENTS_META_KEY);
      let list = [];
      request.onsuccess = () => {
        list = Array.isArray(request.result) ? request.result : [];
      };
      tx.oncomplete = () => resolve(list);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // Record a song as just-opened: promote it to the front of the capped list
  // and persist. Returns the new list so the caller can emit it straight to the
  // `recents` slice. No commit, no push — device-local only (Decision 2).
  function record(db, { bookId, path, now = Date.now() }) {
    const run = () =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, 'readwrite');
        const store = tx.objectStore(META_STORE);
        const request = store.get(RECENTS_META_KEY);
        let next = [];
        request.onsuccess = () => {
          const prev = Array.isArray(request.result) ? request.result : [];
          next = promoteRecent(
            prev,
            { bookId, path, at: new Date(now).toISOString() },
            cap,
          );
          store.put(next, RECENTS_META_KEY);
        };
        tx.oncomplete = () => resolve(next);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    // Queue after the previous write; a failed write still lets the next run.
    const result = writeQueue.then(run, run);
    writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return { read, record };
}
