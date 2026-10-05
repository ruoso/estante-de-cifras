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
import {
  MIGRATIONS,
  META_STORE,
  latestVersion,
  runMigrations,
} from './migrations.js';

// The schema version the database opens at, DERIVED from the migration step
// list (single source of truth — migrations.js Decision 1): bumping the schema
// is appending a step there, nothing here. `storage.migrations` turned the
// single-version open into this versioned stepping.
export const SCHEMA_VERSION = latestVersion(MIGRATIONS);
export const DB_NAME = 'estante';
export const META_KEY = 'meta';

// Open (and, first time or on upgrade, migrate) the Worker's database at the
// latest schema version derived from `steps`. `idb` is the IndexedDB factory —
// `globalThis.indexedDB` in a real Worker, an injected fake in a test. Every
// step between the version found on disk and `version` runs in order inside the
// one `versionchange` transaction.
function openDatabase(idb, name, version, steps) {
  return new Promise((resolve, reject) => {
    const request = idb.open(name, version);
    request.onupgradeneeded = (ev) => {
      const db = request.result;
      // The `versionchange` transaction — the only place structural changes are
      // valid, and the atomicity that keeps a half-applied upgrade from
      // corrupting a user's only copy of their books.
      const tx = request.transaction;
      try {
        runMigrations(db, tx, ev.oldVersion, ev.newVersion, steps);
      } catch (err) {
        // A step threw: abort so the on-disk version does not advance and no
        // store is half-built, then surface the original cause. The abort also
        // fires `onerror`, but the promise is already settled (Decision 3).
        try {
          tx.abort();
        } catch {
          // Already aborting — nothing more to do.
        }
        reject(err);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('database open blocked'));
  });
}

// Read the persisted `meta` record, creating it on first open and keeping its
// `schemaVersion` in step with the version on disk after an upgrade (Decision
// 5): a fresh Worker instance reads `meta` to know what shape it is looking at,
// so the record must never lie about the database. The on-disk version is
// `db.version` — the version migrations just stepped the database to. The
// record is what a fresh Worker instance over the same database recovers;
// resolved on transaction completion so the write is durable before we report
// it. `createdAt` is preserved across upgrades.
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
          schemaVersion: db.version,
          protocolVersion: 1,
          createdAt: Date.now(),
        };
        store.put(meta, META_KEY);
      } else if (meta.schemaVersion !== db.version) {
        // An upgrade advanced the database since this record was written; keep
        // it honest without disturbing the rest of the record.
        meta = { ...meta, schemaVersion: db.version };
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
// `options.name` lets a test isolate its database; `options.migrations` injects
// the step list (defaults to the production `MIGRATIONS`), reusing the existing
// `options` seam so behavior tests can exercise genuine multi-step stepping
// today, when only one real step exists. The version opened at is derived from
// whichever list is in effect. Returns `{ handle }`: the adapter (real or
// loopback) feeds each incoming command to `handle`.
export function createWorkerLogic(port, options = {}) {
  const idb = options.indexedDB ?? globalThis.indexedDB;
  const name = options.name ?? DB_NAME;
  const migrations = options.migrations ?? MIGRATIONS;
  const version = latestVersion(migrations);
  let dbPromise = null;

  function ensureOpen() {
    if (!dbPromise) dbPromise = openDatabase(idb, name, version, migrations);
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
