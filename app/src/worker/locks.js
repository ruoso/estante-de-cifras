// locks.js — one exclusive lock per book (storage.locks). DIRECTION §3
// L118-119 makes this a standing rule of the storage design: "One lock per
// book (Web Locks), since a git operation spans many IndexedDB transactions
// and two tabs must not interleave them." A single git operation (clone,
// fetch, merge, checkout, commit, push) is a long sequence of reads and writes
// across many IndexedDB object-store transactions; it is not atomic. Two tabs
// of the same origin each run their own Worker, but every tab shares one
// browser-level Web Locks broker (locks are origin-global). Without a lock, a
// fetch/merge in one tab and a save in another can interleave their
// transactions and corrupt the working copy or the `.git` directory.
//
// This module turns that rule into a reusable Worker-side primitive. It is the
// companion to git.js: git.js moves the bytes, this serialises the units of
// work around them. Like git.js it is DELIBERATELY small, stateless, and
// unwired — it adds no store command/event kinds (Decision 4). The first
// consumer (storage.working_copy) constructs the lock registry in the
// createWorkerLogic closure, beside ensureFs, and composes it with the git
// layer; downstream consumers (storage.home_book, storage.history,
// storage.download, the sync engine) do the same.
//
// COMPOSITION RULE — one `fn` per logical operation. A consumer's unit of work
// that is several git calls (a save is commit + push; a sync is fetch + merge +
// push) passes ONE `fn`, so the lock is held across the whole unit and the
// working copy stays consistent for all of it — not reacquired per call, which
// would let another tab interleave between the calls (Decision 1).
//
// NON-REENTRANT, by the native Web Locks contract (Decision 6). Web Locks are
// not reentrant: never call `withLock(bookId, …)` while the same book's lock is
// already held on the same path, or the inner request queues forever behind the
// outer. The composition rule above is the mitigation.
//
// No song text in logs: this module logs nothing and carries only an opaque
// bookId. Offline-first: the lock is a local coordination primitive; it never
// waits on the network and adds no network dependency. Web Locks is a platform
// API, so there is no new runtime dependency.
//
// Framework-free, Worker-only: plain ESM, no React. The main thread and the
// view never import it (DIRECTION §3.7 L407-409: one owner for the data).

/**
 * The lock name for a book, keyed on the opaque `bookId` (Decision 2). The
 * `book:` prefix namespaces the lock so it never collides with lightning-fs's
 * own locks, which it keys on the FS name (`estante-fs`), not a bookId.
 *
 * @param {string} bookId
 * @returns {string}
 */
function lockName(bookId) {
  return `book:${bookId}`;
}

/**
 * Build the per-book lock registry over an injected `navigator` (defaulting to
 * the global one, present in a real Worker). The injection is the same style as
 * createFileSystem's `indexedDB` and createPersister's `navigator`, so tests
 * can drive it over the Web Locks shim (app/src/test/web-locks.js).
 *
 * @param {{ navigator?: { locks: { request: Function } } }} [deps]
 * @returns {{ withLock: <T>(bookId: string, fn: () => (T | Promise<T>)) => Promise<T> }}
 */
export function createBookLocks({ navigator = globalThis.navigator } = {}) {
  if (!navigator?.locks) {
    throw new Error('createBookLocks requires navigator.locks (Web Locks API)');
  }

  /**
   * Acquire the book's exclusive Web Lock, run `fn` while it is held, and
   * release it when `fn` settles — resolving with `fn`'s value or propagating
   * its rejection. `navigator.locks.request` holds the lock for exactly as long
   * as the callback's returned promise is pending and resolves to its value, so
   * a throw or rejection releases the lock and propagates (release-on-failure).
   * Exclusive is the only mode: every git/working-copy operation mutates, so
   * there is no safe concurrent-reader case (Decision 3).
   *
   * @template T
   * @param {string} bookId
   * @param {() => (T | Promise<T>)} fn
   * @returns {Promise<T>}
   */
  function withLock(bookId, fn) {
    return navigator.locks.request(
      lockName(bookId),
      { mode: 'exclusive' },
      () => fn(),
    );
  }

  return { withLock };
}
