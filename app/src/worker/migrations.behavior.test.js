import { describe, it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createWorkerLogic } from './logic.js';
import { MIGRATIONS, META_STORE, runMigrations } from './migrations.js';
import { createStore } from './store.js';
import { createLoopbackEndpoint } from '../test/loopback.js';

// behavior — the Worker's migration stepping against a real (fake) IndexedDB,
// driven through the loopback where a command/event path is involved
// (storage.migrations acceptance; worker.md Decisions 4, 2). fake-indexeddb is
// imported here, not in the global setup, so the rest of the suite stays free
// of a global fake. A fresh IDBFactory per test is its own isolated IndexedDB;
// passing the same factory to a second Worker-logic instance is "the same
// database" on a user's device across an app update.

const DB = 'estante-test';

// Wire a Worker-logic instance (with an injected step list) to a store through
// the in-process loopback, exactly as the real main thread would wire a Worker.
function wireStore(idb, migrations) {
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name: DB, migrations }),
  );
  return createStore(endpoint);
}

// Open the database directly at a given version, running `steps` in the
// upgrade — the way a prior app build would have left a device's database.
// Resolves the open connection so the caller can seed or inspect, then close.
function openAtVersion(idb, version, steps) {
  return new Promise((resolve, reject) => {
    const request = idb.open(DB, version);
    request.onupgradeneeded = (ev) =>
      runMigrations(request.result, request.transaction, ev.oldVersion, ev.newVersion, steps);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('open blocked'));
  });
}

// Open the database at its current version (no upgrade), to inspect it.
function openCurrent(idb) {
  return new Promise((resolve, reject) => {
    const request = idb.open(DB);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('open blocked'));
  });
}

function putRecord(db, storeName, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getRecord(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// A synthetic step that creates a named object store, guarded so re-running is
// safe. Lets a behavior test build a multi-version schema without fabricating
// future production stores.
function createStoreStep(version, storeName) {
  return {
    version,
    label: `create ${storeName}`,
    upgrade(db) {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    },
  };
}

// Step 1 is always the real meta-store creation, so loadOrCreateMeta works.
const STEP_1 = MIGRATIONS[0];

describe('worker migrations (behavior)', () => {
  it('a store at version N is opened by N+1 and migrated, preserving data', async () => {
    // Pins "behavior (a store at version N opened by N+1 in a fake IndexedDB
    // and migrated)" (tasks/40-storage.tji:67).
    const idb = new IDBFactory();
    const stepsN = [STEP_1, createStoreStep(2, 'books')]; // N = 2
    const stepsN1 = [STEP_1, createStoreStep(2, 'books'), createStoreStep(3, 'index')]; // N+1 = 3

    // A device left at version 2 by a prior build, with a book already stored.
    const dbN = await openAtVersion(idb, 2, stepsN);
    await putRecord(dbN, 'books', 'song-1', { title: 'Test Song' });
    dbN.close();

    // The next launch: a Worker-logic instance built at version 3 opens the
    // same database and steps it 2 -> 3.
    const store = wireStore(idb, stepsN1);
    store.open();
    await vi.waitFor(() =>
      expect(store.slice('connection').status).toBe('ready'),
    );

    // The N->N+1 step ran: meta tracks version 3, the new store exists, and the
    // seeded book survived the upgrade.
    expect(store.slice('meta').schemaVersion).toBe(3);
    const after = await openCurrent(idb);
    expect(after.version).toBe(3);
    expect(Array.from(after.objectStoreNames)).toContain('index');
    expect(await getRecord(after, 'books', 'song-1')).toEqual({
      title: 'Test Song',
    });
    after.close();
  });

  it('runs every step in order from empty to the latest in one open', async () => {
    // Mirrors the service.schema "from empty to the latest" convention
    // (tasks/30-service.tji:12): a fresh factory opened at the latest version
    // runs all steps from an empty database.
    const idb = new IDBFactory();
    const steps = [
      STEP_1,
      createStoreStep(2, 'books'),
      createStoreStep(3, 'index'),
    ];

    const store = wireStore(idb, steps);
    store.open();
    await vi.waitFor(() =>
      expect(store.slice('connection').status).toBe('ready'),
    );

    expect(store.slice('meta').schemaVersion).toBe(3);
    const db = await openCurrent(idb);
    expect(db.version).toBe(3);
    const names = Array.from(db.objectStoreNames).sort();
    expect(names).toEqual(['books', 'index', META_STORE].sort());
    db.close();
  });

  it('opens the real production schema from empty at the derived latest version', async () => {
    // The default (injected-nothing) path: today's single real step runs from
    // empty and meta tracks the derived version (1).
    const idb = new IDBFactory();
    const endpoint = createLoopbackEndpoint((port) =>
      createWorkerLogic(port, { indexedDB: idb, name: DB }),
    );
    const store = createStore(endpoint);
    store.open();
    await vi.waitFor(() =>
      expect(store.slice('connection').status).toBe('ready'),
    );
    expect(store.slice('meta').schemaVersion).toBe(1);
  });

  it('holds the upgrade until the next launch: an open N-version connection blocks it', async () => {
    // Pins "behavior (…; an update held until the next launch)"
    // (tasks/40-storage.tji:67) and the skipWaiting:false guarantee
    // (vite.config.js:52, worker.md Decision 6). No migration fires
    // mid-session; the upgrade only happens on a fresh instance built at N+1,
    // and an old N-version connection still holding the database open blocks it
    // (onblocked -> error event, not a hang).
    const idb = new IDBFactory();
    const stepsN = [STEP_1, createStoreStep(2, 'books')]; // N = 2
    const stepsN1 = [STEP_1, createStoreStep(2, 'books'), createStoreStep(3, 'index')]; // N+1 = 3

    // A first logic instance (the current build) opens at version 2 and keeps
    // its connection open — the running session.
    const live = wireStore(idb, stepsN);
    live.open();
    await vi.waitFor(() => expect(live.slice('connection').status).toBe('ready'));
    expect(live.slice('meta').schemaVersion).toBe(2);

    // While that session runs, re-opening at the same build does not step the
    // version — no migration fires mid-session.
    const sameBuild = wireStore(idb, stepsN);
    sameBuild.open();
    await vi.waitFor(() =>
      expect(sameBuild.slice('connection').status).toBe('ready'),
    );
    expect(sameBuild.slice('meta').schemaVersion).toBe(2);

    // The next launch arrives as a build at version 3 while the N-version
    // connections are still open: the upgrade is blocked and surfaces as an
    // error event rather than hanging.
    const next = wireStore(idb, stepsN1);
    next.open();
    await vi.waitFor(() =>
      expect(next.slice('connection').status).toBe('error'),
    );
    expect(next.slice('connection').error.message).toMatch(/blocked/);

    // The database was not advanced by the blocked upgrade.
    expect(live.slice('meta').schemaVersion).toBe(2);
  });

  it('a failed migration leaves the prior version intact', async () => {
    // Pins the failed-migration constraint and the error-as-event path
    // (logic.js). A throwing step aborts the upgrade; the database stays at the
    // prior version with its data, and the Worker emits an ERROR event rather
    // than opening a half-migrated store.
    const idb = new IDBFactory();
    const stepsN = [STEP_1, createStoreStep(2, 'books')]; // N = 2
    const stepsBad = [
      STEP_1,
      createStoreStep(2, 'books'),
      {
        version: 3,
        label: 'boom',
        upgrade() {
          throw new Error('migration boom');
        },
      },
    ];

    // A device at version 2 with a stored book.
    const dbN = await openAtVersion(idb, 2, stepsN);
    await putRecord(dbN, 'books', 'song-1', { title: 'Test Song' });
    dbN.close();

    // The next build's version-3 upgrade throws in its step.
    const store = wireStore(idb, stepsBad);
    store.open();
    await vi.waitFor(() =>
      expect(store.slice('connection').status).toBe('error'),
    );
    expect(store.slice('connection').error.message).toMatch(/migration boom/);

    // The database stayed at version 2, the new store was not created, and the
    // book survived untouched.
    const after = await openCurrent(idb);
    expect(after.version).toBe(2);
    expect(Array.from(after.objectStoreNames)).not.toContain('index');
    expect(await getRecord(after, 'books', 'song-1')).toEqual({
      title: 'Test Song',
    });
    after.close();
  });
});
