// fs.js — the Worker's browser filesystem (storage.fs). DIRECTION §3 L100:
// "each book is a git repository on a filesystem backed by IndexedDB, operated
// by isomorphic-git in a Web Worker." isomorphic-git never touches IndexedDB
// itself — it is handed an `fs` object and does all its I/O through it. This
// module builds that `fs`.
//
// The deliverable is a SMALL INTERFACE — exactly the `.promises` method set
// isomorphic-git requires — with lightning-fs behind it. Everything above this
// layer (storage.git and the storage stack it feeds) sees only the interface,
// never a lightning-fs type, so a future OPFS backend can satisfy the same
// `@typedef` and pass the same contract suite (fs.contract.js) unchanged — the
// swappability DIRECTION §8 L547-549 keeps open for iOS's eviction-resistant
// storage.
//
// Framework-free, Worker-only: plain ESM, no React, no DOM beyond
// `navigator.storage`. Logs nothing — never song text, commit messages, or
// secrets (the standing rule logic.js states); it stores file bytes but never
// logs them.

import LightningFS from '@isomorphic-git/lightning-fs';

/**
 * The small filesystem interface — exactly the `.promises` surface
 * isomorphic-git requires (Decision 1), pinned to its documented `fs` contract
 * rather than invented. An OPFS backend implements this same shape, and
 * `runFsContract` (fs.contract.js) holds every backend to it.
 *
 * @typedef {Object} FsPromises
 * @property {(path: string, options?: any) => Promise<Uint8Array|string>} readFile
 * @property {(path: string, data: Uint8Array|string, options?: any) => Promise<void>} writeFile
 * @property {(path: string) => Promise<void>} unlink
 * @property {(path: string, options?: any) => Promise<string[]>} readdir
 * @property {(path: string, options?: any) => Promise<void>} mkdir
 * @property {(path: string) => Promise<void>} rmdir
 * @property {(path: string) => Promise<any>} stat
 * @property {(path: string) => Promise<any>} lstat
 * @property {(path: string) => Promise<string>} readlink
 * @property {(target: string, path: string) => Promise<void>} symlink
 * @property {(oldPath: string, newPath: string) => Promise<void>} rename
 *
 * @typedef {Object} FileSystem
 * @property {FsPromises} promises
 */

// A lightning-fs file backend parameterised by an injected `IDBFactory`
// (Decision 5). lightning-fs's own `IdbBackend` hard-codes the global
// `indexedDB`; this is the thin seam the `db` option exposes so a test can back
// the filesystem with `fake-indexeddb` and production uses the global — no
// global is mutated either way. It owns one object store keyed by inode number,
// with the superblock under `!root`, exactly as lightning-fs's default backend
// lays it out.
class InjectedIdbBackend {
  constructor(idb, dbName, storeName) {
    this._idb = idb;
    this._dbName = dbName;
    this._storeName = storeName;
    this._dbp = null;
  }

  _open() {
    if (this._dbp) return this._dbp;
    this._dbp = new Promise((resolve, reject) => {
      const request = this._idb.open(this._dbName);
      request.onupgradeneeded = () =>
        request.result.createObjectStore(this._storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this._dbp;
  }

  async _run(mode, op) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._storeName, mode);
      const request = op(tx.objectStore(this._storeName));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  }

  saveSuperblock(superblock) {
    return this._run('readwrite', (store) => store.put(superblock, '!root'));
  }
  loadSuperblock() {
    return this._run('readonly', (store) => store.get('!root'));
  }
  readFile(inode) {
    return this._run('readonly', (store) => store.get(inode));
  }
  writeFile(inode, data) {
    return this._run('readwrite', (store) => store.put(data, inode));
  }
  unlink(inode) {
    return this._run('readwrite', (store) => store.delete(inode));
  }
  wipe() {
    return this._run('readwrite', (store) => store.clear());
  }
  async close() {
    if (!this._dbp) return;
    (await this._dbp).close();
    this._dbp = null;
  }
}

// The exact method set isomorphic-git reaches for on `fs.promises` (Decision
// 1). Narrowing to precisely these keeps the OPFS target and the contract
// suite's subject unambiguous: lightning-fs's `.promises` carries extras
// (backFile, du, chmod, cp, …) that isomorphic-git never uses, so exposing them
// would be untested surface a second backend would have to reproduce for no
// caller.
const INTERFACE_METHODS = [
  'readFile',
  'writeFile',
  'unlink',
  'readdir',
  'mkdir',
  'rmdir',
  'stat',
  'lstat',
  'readlink',
  'symlink',
  'rename',
];

/**
 * Create the Worker's filesystem: the small interface backed by lightning-fs.
 * `options.indexedDB` injects the `IDBFactory` (defaults to the global one,
 * present in a real Worker); a test passes a fresh `new IDBFactory()` so
 * lightning-fs reads and writes a fake and no global is touched. `name` names
 * lightning-fs's own IndexedDB database (its own schema and versioning,
 * separate from the `estante` database — Decision 3), so a distinct name
 * isolates one filesystem from another.
 *
 * Returns the `FileSystem` interface object — a `.promises` surface conforming
 * to the `@typedef`. Callers (isomorphic-git in storage.git) receive this, never
 * the lightning-fs instance.
 *
 * @param {string} name
 * @param {{ indexedDB?: IDBFactory }} [options]
 * @returns {FileSystem}
 */
export function createFileSystem(name, options = {}) {
  const idb = options.indexedDB ?? globalThis.indexedDB;
  const backend = new InjectedIdbBackend(idb, name, `${name}_files`);
  const lfs = new LightningFS(name, { db: backend });
  const source = lfs.promises;

  // Bind exactly the interface methods onto a bare object, so nothing above
  // this layer can reach a lightning-fs-only method or the instance itself.
  const promises = /** @type {FsPromises} */ ({});
  for (const method of INTERFACE_METHODS) {
    promises[method] = (...args) => source[method](...args);
  }

  return { promises };
}

/**
 * Build the Worker session's persistence requester (Decision 4). The returned
 * function asks `navigator.storage.persist()` at most once per session
 * (memoised — the result does not change within a session, so a second call
 * returns the first call's promise) and tolerates absence: on an
 * older/embedded browser where `navigator.storage?.persist` is undefined, or if
 * the call throws, it resolves `null` rather than rejecting. Persistence is
 * best-effort and never blocks anything the user does (DIRECTION §3 L114-115);
 * the result is advisory, surfaced so a later task can nudge toward export when
 * it was denied.
 *
 * @param {{ storage?: { persist?: () => Promise<boolean> } }} [nav]
 * @returns {() => Promise<boolean|null>} resolves true (granted) / false
 *   (denied) / null (unavailable or errored)
 */
export function createPersister(nav = globalThis.navigator) {
  let pending = null;
  return function requestPersistence() {
    if (!pending) {
      pending = (async () => {
        const storage = nav?.storage;
        if (!storage || typeof storage.persist !== 'function') return null;
        try {
          return await storage.persist();
        } catch {
          // Best-effort: a browser that rejects the request is treated as
          // "unavailable", never a failure that blocks storage bring-up.
          return null;
        }
      })();
    }
    return pending;
  };
}
