import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createStore } from './store.js';
import { createWorkerLogic } from './logic.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';

// OPEN now brings up the home book too (storage.preferences_surface surfaces its
// preferences on bring-up), which — like every storage behavior flow — takes a
// per-book Web Lock; the shim puts lightning-fs's mutex and the lock registry on
// the Web Locks path jsdom otherwise lacks (web-locks.js). No global `indexedDB`
// is touched (Mutex2 uses navigator.locks), so the "injected factory only" case
// still holds.
let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

// behavior — the Worker's storage logic driven through the store, in-process,
// against a fake IndexedDB (the README behavior level; DIRECTION §3.7 L394-401
// and §3 L99-100, "each book is a git repository on a filesystem backed by
// IndexedDB, operated … in a Web Worker"). fake-indexeddb is imported here,
// not in the global setup, so the rest of the suite stays free of a global
// fake (Decision 4).
//
// A fresh IDBFactory per test is its own isolated IndexedDB; passing the same
// factory to a second Worker-logic instance is "the same database" for the
// recovery case.
function wireStore(idb, name) {
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name }),
  );
  return createStore(endpoint);
}

describe('worker store (behavior)', () => {
  it('round-trips an open command to a ready event that updates the slices', async () => {
    const idb = new IDBFactory();
    const store = wireStore(idb, 'estante-test');

    expect(store.slice('connection').status).toBe('idle');
    expect(store.slice('meta')).toBeNull();

    store.open();

    await vi.waitFor(() =>
      expect(store.slice('connection').status).toBe('ready'),
    );
    const meta = store.slice('meta');
    // The production schema version is derived from the migration step list;
    // storage.index lands step 2 and storage.progression_search step 3, so it
    // is 3.
    expect(meta.schemaVersion).toBe(3);
    expect(typeof meta.createdAt).toBe('number');
  });

  it('persists meta so a fresh Worker-logic instance over the same database recovers it', async () => {
    const idb = new IDBFactory();

    const first = wireStore(idb, 'estante-test');
    first.open();
    await vi.waitFor(() =>
      expect(first.slice('connection').status).toBe('ready'),
    );
    const original = first.slice('meta');

    // A brand-new store + Worker-logic instance over the *same* fake database:
    // it must read back the record the first one created, not mint a new one.
    const second = wireStore(idb, 'estante-test');
    second.open();
    await vi.waitFor(() =>
      expect(second.slice('connection').status).toBe('ready'),
    );
    expect(second.slice('meta')).toEqual(original);
    // Same createdAt proves it was recovered, not recreated.
    expect(second.slice('meta').createdAt).toBe(original.createdAt);
  });

  it('notifies subscribers only when the state actually moves', async () => {
    const idb = new IDBFactory();
    const store = wireStore(idb, 'estante-test');
    const notified = vi.fn();
    store.subscribe(notified);

    store.open();
    // OPEN makes three real state moves — the connection+meta (READY), the
    // home book's preferences surfaced on bring-up (PREFERENCES, empty here),
    // and the device-local recents surfaced right after (RECENTS, empty here;
    // songs.search) — so exactly three notifications, and no more (the reducer
    // returns the same reference for an event that changes nothing; with no
    // books on the device the index build emits no status).
    await vi.waitFor(() => expect(notified).toHaveBeenCalledTimes(3));
    expect(store.slice('connection').status).toBe('ready');
  });

  it('reaches IndexedDB only through the Worker logic (the injected factory), never a global one', async () => {
    const idb = new IDBFactory();
    const openSpy = vi.spyOn(idb, 'open');
    const store = wireStore(idb, 'estante-test');

    store.open();
    await vi.waitFor(() =>
      expect(store.slice('connection').status).toBe('ready'),
    );

    // The only IndexedDB access went through the factory handed to the Worker
    // logic. The store module never imports `indexedDB`, and jsdom defines no
    // global one, so nothing on the main thread could have touched a database.
    expect(openSpy).toHaveBeenCalled();
    expect(globalThis.indexedDB).toBeUndefined();
  });
});
