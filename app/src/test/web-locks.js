// A minimal in-memory Web Locks API, for the storage.fs tests. lightning-fs
// takes its cross-instance lock through `navigator.locks` when that API exists,
// and otherwise falls back to an IndexedDB-keyval lock that eagerly touches the
// *global* `indexedDB` — which jsdom does not provide, and which storage.fs
// deliberately never sets as a global (fs.js Decision 5). A real Worker has
// `navigator.locks`; jsdom does not, so these tests install this shim to put
// lightning-fs on its Web-Locks path and keep the only IndexedDB it touches the
// injected fake factory.
//
// Test infrastructure only: never imported from a production entry, so it never
// enters the app bundle. It implements just enough of the Web Locks contract
// for lightning-fs's `Mutex2` and for storage.locks' `withLock` — exclusive
// locks, FIFO queueing, `ifAvailable`, `steal`, and a `request()` promise that
// settles with the grant callback's own result or rejection (the part withLock
// relies on) — not the full specification. No `shared` mode and no
// `AbortSignal`: the book lock is exclusive-only and never cancelled.

export function makeLockManager() {
  // One FIFO queue of grant callbacks per lock name. The head of the queue
  // holds the lock; when its holder's callback promise settles, the next is
  // granted.
  const queues = new Map();

  function runHead(name) {
    const q = queues.get(name);
    if (!q || q.length === 0) return;
    const entry = q[0];
    const lock = { name, mode: 'exclusive' };
    // Hold the lock until the callback's returned promise settles (that promise
    // is what the holder keeps pending until it releases). Settle the request's
    // own promise with the callback's outcome — the real Web Locks contract:
    // `request()` resolves with the callback's return value and rejects with
    // its error (this is what storage.locks' withLock relies on) — then grant
    // the next waiter either way.
    Promise.resolve()
      .then(() => entry.callback(lock))
      .then(
        (value) => release(() => entry.resolve(value)),
        (err) => release(() => entry.reject(err)),
      );
    function release(settle) {
      q.shift();
      settle();
      runHead(name);
    }
  }

  function request(name, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const { ifAvailable = false, steal = false } = options || {};

    let q = queues.get(name);
    if (!q) {
      q = [];
      queues.set(name, q);
    }

    if (steal) {
      // Forcibly take the lock: drop any holder and run immediately.
      queues.set(name, []);
      return Promise.resolve(callback({ name, mode: 'exclusive' }));
    }
    if (ifAvailable && q.length > 0) {
      // Held by someone else: grant null without queueing, per the Web Locks
      // `ifAvailable` contract.
      return Promise.resolve(callback(null));
    }

    // The request promise settles when this entry reaches the head and its
    // callback settles (see runHead).
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    q.push({ callback, resolve, reject });
    if (q.length === 1) runHead(name);
    return promise;
  }

  return { request };
}

// Install the shim as `navigator.locks` for one test and return a teardown that
// restores whatever was there before (nothing, in jsdom). Pair with
// `beforeEach`/`afterEach` so no global leaks between tests.
export function installWebLocks() {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'locks');
  Object.defineProperty(navigator, 'locks', {
    value: makeLockManager(),
    configurable: true,
    writable: true,
  });
  return function restore() {
    if (previous) {
      Object.defineProperty(navigator, 'locks', previous);
    } else {
      delete navigator.locks;
    }
  };
}
