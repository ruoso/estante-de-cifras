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
 * Pure list move: drop every entry whose `{ bookId, path }` is among
 * `locations` (a song a command removed from its book — a discarded draft, a
 * deleted or moved file), keeping the rest in order. Returns the SAME array
 * when nothing matched, so the caller can tell "changed" without diffing
 * (songs.unsaved_after_discard Constraint 5; workflow 2 L13-15 — a recent is a
 * way back, and a way back to nothing is not one).
 *
 * @param {Array<{ bookId: string, path: string, at: string }>} list
 * @param {Array<{ bookId: string, path: string }>} locations
 * @returns {Array<{ bookId: string, path: string, at: string }>}
 */
export function dropRecents(list, locations) {
  const prev = Array.isArray(list) ? list : [];
  const gone = (r) =>
    (locations ?? []).some((l) => l.bookId === r.bookId && l.path === r.path);
  if (!prev.some(gone)) return prev;
  return prev.filter((r) => !gone(r));
}

/**
 * Pure list move: re-key every entry of book `fromId` to `toId` — a book that
 * changes id (put online, forked) takes its recents with it (workflow 2
 * L29-35; books.put_online_no_ghosts Constraint 2). Order and `at` are kept.
 * When an entry for the same `{ toId, path }` is already in the list, the
 * earlier one (the more recent) is kept and the later one dropped. Returns the
 * SAME array when nothing matched.
 *
 * @param {Array<{ bookId: string, path: string, at: string }>} list
 * @param {string} fromId
 * @param {string} toId
 * @returns {Array<{ bookId: string, path: string, at: string }>}
 */
export function moveBookRecents(list, fromId, toId) {
  const prev = Array.isArray(list) ? list : [];
  if (fromId === toId || !prev.some((r) => r.bookId === fromId)) return prev;
  const seen = new Set();
  const next = [];
  for (const r of prev) {
    const moved = r.bookId === fromId ? { ...r, bookId: toId } : r;
    if (moved.bookId === toId) {
      if (seen.has(moved.path)) continue;
      seen.add(moved.path);
    }
    next.push(moved);
  }
  return next;
}

/**
 * Pure list move: drop every entry of book `bookId` — a book that leaves the
 * device's shelf takes its recents with it (workflow 2 L29-35). Returns the
 * SAME array when nothing matched.
 *
 * @param {Array<{ bookId: string, path: string, at: string }>} list
 * @param {string} bookId
 * @returns {Array<{ bookId: string, path: string, at: string }>}
 */
export function dropBookRecents(list, bookId) {
  const prev = Array.isArray(list) ? list : [];
  if (!prev.some((r) => r.bookId === bookId)) return prev;
  return prev.filter((r) => r.bookId !== bookId);
}

/**
 * The device-local recents store over the Worker's open `meta` database. Both
 * operations run in one `meta`-store transaction, resolved on completion so the
 * write is durable before it is reported.
 *
 * @param {{ cap?: number }} [opts]
 * @returns {{ read: (db: IDBDatabase) => Promise<Array>,
 *   record: (db: IDBDatabase, entry: { bookId: string, path: string, now?: number }) => Promise<Array>,
 *   forget: (db: IDBDatabase, locations: Array<{ bookId: string, path: string }>)
 *     => Promise<{ recents: Array, changed: boolean }>,
 *   moveBook: (db: IDBDatabase, fromId: string, toId: string)
 *     => Promise<{ recents: Array, changed: boolean }>,
 *   forgetBook: (db: IDBDatabase, bookId: string)
 *     => Promise<{ recents: Array, changed: boolean }>,
 *   keepBooks: (db: IDBDatabase, bookIds: Array<string>)
 *     => Promise<{ recents: Array, changed: boolean }> }}
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

  // Chain `run` after the previous write; a failed write still lets the next
  // run.
  function enqueue(run) {
    const result = writeQueue.then(run, run);
    writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
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
    return enqueue(run);
  }

  // Forget the locations a command removed from their book (a discarded draft,
  // a deleted or moved file): drop them from the list and persist, on the same
  // queue as `record` — both read-modify-write the one key, and a separate
  // path would lose an entry to the race above (songs.unsaved_after_discard
  // Constraint 4, Decision 5). `changed` says whether anything was dropped, so
  // the caller posts RECENTS only when the slice must move. Writes nothing
  // when nothing matched.
  function forget(db, locations) {
    return rewrite(db, (prev) => dropRecents(prev, locations));
  }

  // Read-modify-write the list through `move` (a pure list move that returns
  // the same array when nothing changed) in one `meta` transaction, on the
  // shared queue. Writes nothing when nothing changed.
  function rewrite(db, move) {
    const run = () =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, 'readwrite');
        const store = tx.objectStore(META_STORE);
        const request = store.get(RECENTS_META_KEY);
        let next = [];
        let changed = false;
        request.onsuccess = () => {
          const prev = Array.isArray(request.result) ? request.result : [];
          next = move(prev);
          changed = next !== prev;
          if (changed) store.put(next, RECENTS_META_KEY);
        };
        tx.oncomplete = () => resolve({ recents: next, changed });
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    return enqueue(run);
  }

  // A book changed id (put online, forked): move its recents to the new id
  // (books.put_online_no_ghosts Constraint 2).
  function moveBook(db, fromId, toId) {
    return rewrite(db, (prev) => moveBookRecents(prev, fromId, toId));
  }

  // A book left the device's shelf: drop its recents.
  function forgetBook(db, bookId) {
    return rewrite(db, (prev) => dropBookRecents(prev, bookId));
  }

  // Heal at OPEN: keep only the recents whose book is among `bookIds` (the
  // books on disk) — a ghost left by a device from before the writers moved
  // recents with their book (books.put_online_no_ghosts Constraint 4).
  function keepBooks(db, bookIds) {
    const present = new Set(bookIds);
    return rewrite(db, (prev) =>
      prev.some((r) => !present.has(r.bookId))
        ? prev.filter((r) => present.has(r.bookId))
        : prev,
    );
  }

  return { read, record, forget, moveBook, forgetBook, keepBooks };
}
