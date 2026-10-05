import { describe, it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createHomeBook } from './home-book.js';
import { META_STORE, MIGRATIONS, latestVersion } from './migrations.js';

// unit — the §2.3 device id (storage.home_book). Pins home-book-format.md §2.3
// and §7: one UUID per installation, generated once, kept in the `meta` object
// store outside the home book, stable, and a BARE value never wrapped in a
// register. The git/fs/locks deps are unused by `ensureDeviceId`, so a minimal
// stub is enough to construct the module.

const STUB = { fs: {}, git: {}, locks: {} };

// Read the raw `meta` record a fresh connection sees, to assert exactly what was
// persisted (and in what shape).
function readMeta(idb, name) {
  return new Promise((resolve, reject) => {
    const open = idb.open(name, latestVersion(MIGRATIONS));
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(META_STORE, 'readonly');
      const get = tx.objectStore(META_STORE).get('meta');
      get.onsuccess = () => {
        resolve(get.result);
        db.close();
      };
      get.onerror = () => reject(get.error);
    };
    open.onerror = () => reject(open.error);
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('ensureDeviceId (home-book-format.md §2.3, §7)', () => {
  it('generates a UUID once against a fresh database and returns the same id on a second call', async () => {
    const idb = new IDBFactory();
    const name = `home-${Math.random().toString(36).slice(2)}`;
    const home = createHomeBook(STUB);

    const first = await home.ensureDeviceId({ idb, name });
    expect(first).toMatch(UUID);

    const second = await home.ensureDeviceId({ idb, name });
    expect(second).toBe(first); // stable across calls — generated once
  });

  it('persists the id as a BARE field on the `meta` record, never wrapped in a register (§2.3, §7)', async () => {
    const idb = new IDBFactory();
    const name = `home-${Math.random().toString(36).slice(2)}`;
    const home = createHomeBook(STUB);

    const id = await home.ensureDeviceId({ idb, name });
    const meta = await readMeta(idb, name);

    expect(meta.deviceId).toBe(id);
    expect(typeof meta.deviceId).toBe('string'); // a bare value, not { value, at }
    // The meta record still carries the fields logic.js's loadOrCreateMeta keeps.
    expect(meta.protocolVersion).toBe(1);
    expect(typeof meta.createdAt).toBe('number');
  });
});
