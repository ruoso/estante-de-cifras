import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createFileSystem, createPersister } from './fs.js';
import { runFsContract } from './fs.contract.js';
import { installWebLocks } from '../test/web-locks.js';

// unit — the filesystem interface's contract suite run against lightning-fs
// over a fresh fake IndexedDB (storage.fs acceptance; the `.tji` note lines
// 15-20). fake-indexeddb is imported here, not in the global setup, so the rest
// of the suite stays free of a global fake (worker.md Decision 4). The Web-Locks
// shim is installed per test so lightning-fs takes its Web-Locks mutex path and
// never reaches for the global `indexedDB` jsdom lacks (web-locks.js); a real
// Worker has `navigator.locks`, so this only stands in for what jsdom omits.
//
// Running the suite here PINS the isomorphic-git `fs` contract so OPFS can later
// call the same `runFsContract` and pass unchanged (fs.js Decision 1).

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

// Each case gets a filesystem over its own fresh IDBFactory and a distinct name,
// so no two cases share a database and the fake is never leaked to a global
// (fs.js Decision 5). `createFileSystem` threads `options.indexedDB` exactly as
// `createWorkerLogic` does.
let counter = 0;
runFsContract(() =>
  createFileSystem(`contract-fs-${counter++}`, { indexedDB: new IDBFactory() }),
);

describe('createPersister (unit)', () => {
  it('asks navigator.storage.persist() at most once across repeated calls', async () => {
    // Pins the memoisation (fs.js Decision 4): one request per Worker session,
    // even when bring-up is driven more than once.
    const persist = vi.fn().mockResolvedValue(true);
    const requestPersistence = createPersister({ storage: { persist } });

    const first = await requestPersistence();
    const second = await requestPersistence();

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('returns null without throwing when navigator.storage is absent', async () => {
    // Absence tolerance: an older/embedded browser with no Storage API must not
    // make storage bring-up throw (fs.js Decision 4; DIRECTION §3 L114-115).
    expect(await createPersister({})()).toBe(null);
    expect(await createPersister(undefined)()).toBe(null);
    expect(await createPersister({ storage: {} })()).toBe(null);
  });

  it('treats a rejected persist() as unavailable (null), never a failure', async () => {
    // A browser that rejects the request is advisory-null, not a blocker.
    const persist = vi.fn().mockRejectedValue(new Error('denied by policy'));
    expect(await createPersister({ storage: { persist } })()).toBe(null);
  });

  it('surfaces a denied result as false', async () => {
    const persist = vi.fn().mockResolvedValue(false);
    expect(await createPersister({ storage: { persist } })()).toBe(false);
  });
});
