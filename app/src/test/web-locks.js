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
// for lightning-fs's `Mutex2` — exclusive locks, FIFO queueing, `ifAvailable`
// and `steal` — not the full specification.

export function makeLockManager() {
  // One FIFO queue of grant callbacks per lock name. The head of the queue
  // holds the lock; when its holder's callback promise settles, the next is
  // granted.
  const queues = new Map();

  function runHead(name) {
    const q = queues.get(name);
    if (!q || q.length === 0) return;
    const callback = q[0];
    const lock = { name, mode: 'exclusive' };
    // Hold the lock until the callback's returned promise settles (that promise
    // is what lightning-fs keeps pending until it releases), then grant the
    // next waiter.
    Promise.resolve(callback(lock)).then(release, release);
    function release() {
      q.shift();
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

    q.push(callback);
    if (q.length === 1) runHead(name);
    return Promise.resolve();
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
