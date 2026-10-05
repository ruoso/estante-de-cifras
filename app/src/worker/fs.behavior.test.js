import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — storage bring-up through the real command/event path
// (storage.fs acceptance). `createWorkerLogic` is driven in-process through the
// loopback double, with an injected `fake-indexeddb` factory and an injected
// `navigator` whose `storage.persist` is a spy. Two `open` commands prove the
// `.tji` note's "`persist()` asked for once" and that the durability result
// (DIRECTION §3 L114-115) is surfaced on the `ready` event's connection slice.
//
// Two distinct navigator concerns, both satisfied here: the injected
// `options.navigator` is what `persist()` is asked through (the spy); the
// global `navigator.locks` shim is only so lightning-fs's mutex avoids the
// global `indexedDB` jsdom lacks (web-locks.js) — a real Worker supplies both.

const DB = 'estante-test';

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

// Wire a Worker-logic instance to a store through the in-process loopback, with
// a fresh fake IndexedDB and a navigator stub whose persist() is `persistSpy`.
// OPEN now also surfaces the home book's preferences (storage.preferences_surface),
// whose per-book lock registry is taken on the SAME injected navigator (logic.js
// `options.navigator` — persist AND locks). These tests inject a navigator to
// control persist(), so the installed Web Locks shim is merged in so the
// home-book bring-up on OPEN composes.
function wireStore(idb, navigator) {
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, {
      indexedDB: idb,
      name: DB,
      navigator: { ...navigator, locks: globalThis.navigator.locks },
    }),
  );
  return createStore(endpoint);
}

describe('storage bring-up (behavior)', () => {
  it('asks persist() exactly once even when open is sent twice', async () => {
    // Pins the `.tji` "persist() asked for once" and fs.js Decision 4's
    // session-level memoisation, exercised across two real bring-ups.
    const idb = new IDBFactory();
    const persist = vi.fn().mockResolvedValue(true);
    const store = wireStore(idb, { storage: { persist } });

    store.open();
    store.open();

    await vi.waitFor(() =>
      expect(store.slice('connection').status).toBe('ready'),
    );
    // Let the second open's event drain too, so a stray extra persist() would
    // have fired before we assert the count.
    await vi.waitFor(() =>
      expect(store.slice('meta').schemaVersion).toBe(1),
    );

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('surfaces the granted durability result on the ready event', async () => {
    // Pins that `persisted` rides the ready payload into the connection slice
    // (DIRECTION §3 L114-115), so a later task can nudge toward export.
    const idb = new IDBFactory();
    const store = wireStore(idb, {
      storage: { persist: vi.fn().mockResolvedValue(true) },
    });

    store.open();
    await vi.waitFor(() =>
      expect(store.slice('connection').status).toBe('ready'),
    );
    expect(store.slice('connection').persisted).toBe(true);
  });

  it('comes up with persisted=null when the browser offers no Storage API', async () => {
    // Absence tolerance end-to-end: bring-up still reaches ready, and the
    // advisory result is null rather than a thrown error.
    const idb = new IDBFactory();
    const store = wireStore(idb, {}); // no `storage` at all

    store.open();
    await vi.waitFor(() =>
      expect(store.slice('connection').status).toBe('ready'),
    );
    expect(store.slice('connection').persisted).toBe(null);
  });
});
