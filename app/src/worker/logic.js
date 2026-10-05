// The Worker's data logic — transport-agnostic (DIRECTION §3.7 L394-396).
// "One owner for the data: a Web Worker. … The main thread never touches
// IndexedDB." This module is that owner's brain: it handles commands, opens
// and owns the Worker's IndexedDB database, and emits events through an
// injected port. Because the port is injected rather than `self`, the same
// logic runs behind the real worker global in production and in-process behind
// a loopback double in a test (jsdom has no `Worker`), fed a fake IndexedDB.
//
// Framework-free: no React. Logs nothing — in particular never song text,
// commit messages, or secrets (standing rule); this task stores none of those
// anyway, only the schema `meta`.

import { event, EventKind, COMMAND, CommandKind } from './protocol.js';

// The initial schema version. The IndexedDB database opens at this version and
// carries a `meta` record stamped with it; `storage.migrations` steps the
// version later (this task only opens at the initial one). Decision 7.
export const SCHEMA_VERSION = 1;
export const DB_NAME = 'estante';
export const META_STORE = 'meta';
export const META_KEY = 'meta';

// Open (and, first time, create) the Worker's database at the initial schema
// version with its `meta` object store. `idb` is the IndexedDB factory —
// `globalThis.indexedDB` in a real Worker, an injected fake in a test.
function openDatabase(idb, name, version) {
  return new Promise((resolve, reject) => {
    const request = idb.open(name, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('database open blocked'));
  });
}

// Read the persisted `meta` record, creating it on first open. The record is
// what a fresh Worker instance over the same database recovers. Resolved on
// transaction completion so the write is durable before we report it.
function loadOrCreateMeta(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const request = store.get(META_KEY);
    let meta;
    request.onsuccess = () => {
      meta = request.result;
      if (!meta) {
        meta = {
          schemaVersion: SCHEMA_VERSION,
          protocolVersion: 1,
          createdAt: Date.now(),
        };
        store.put(meta, META_KEY);
      }
    };
    tx.oncomplete = () => resolve(meta);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Create the Worker logic bound to a `port` (anything with `postMessage`)
// through which it emits events. `options.indexedDB` injects the IndexedDB
// factory (defaults to the global one, present in a real Worker);
// `options.name` lets a test isolate its database. Returns `{ handle }`:
// the adapter (real or loopback) feeds each incoming command to `handle`.
export function createWorkerLogic(port, options = {}) {
  const idb = options.indexedDB ?? globalThis.indexedDB;
  const name = options.name ?? DB_NAME;
  let dbPromise = null;

  function ensureOpen() {
    if (!dbPromise) dbPromise = openDatabase(idb, name, SCHEMA_VERSION);
    return dbPromise;
  }

  async function handleOpen() {
    const db = await ensureOpen();
    const meta = await loadOrCreateMeta(db);
    port.postMessage(event(EventKind.READY, { meta }));
  }

  return {
    async handle(message) {
      if (!message || message.dir !== COMMAND) return;
      try {
        switch (message.kind) {
          case CommandKind.OPEN:
            await handleOpen();
            break;
          default:
            port.postMessage(
              event(EventKind.ERROR, {
                message: `unknown command: ${message.kind}`,
                code: 'unknown_command',
              }),
            );
        }
      } catch (err) {
        // Report the failure as an event; never throw across the port. The
        // message is the error's own text (no song text, no secrets).
        port.postMessage(
          event(EventKind.ERROR, {
            message: String(err?.message ?? err),
            code: 'command_failed',
          }),
        );
      }
    },
  };
}
