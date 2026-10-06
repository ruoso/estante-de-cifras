// behavior — the device-local recents path through the real Worker logic, over
// the in-process loopback rig (as search-index.behavior.test.js): a fake
// IndexedDB, the shared lightning-fs, a real git-HTTP remote for the home book.
// Pins workflow 2 L17-20 and Decision 2: recents are kept on the device, in the
// Worker's `meta` store, and recording one makes NO home-book commit — "what
// you played on the phone is not something the laptop needs."

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { resolveRef } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind } from './protocol.js';
import { HOME_BOOK_ID } from './home-book.js';
import { DEFAULT_RECENTS_CAP } from './recents.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

const until = (fn) => vi.waitFor(fn, { timeout: 8000, interval: 25 });
const paths = (store) => store.slice('recents').map((r) => r.path);

async function setup() {
  const remote = await startGitHttpRemote();
  const idb = new IDBFactory();
  const name = `rec-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({
    fs,
    http: createGitHttpClient({ fetch: globalThis.fetch }),
  });
  // A home book cloned from the remote, so we can prove recording a recent
  // leaves its git history untouched (no commit, no push).
  const homeDir = git.bookDir(HOME_BOOK_ID);
  await git.clone({ dir: homeDir, url: remote.url });

  // A fresh Worker logic + store over the shared idb/name; a second one is a
  // "restart" over the same backing store (to prove persistence in `meta`).
  function makeStore() {
    const endpoint = createLoopbackEndpoint((port) =>
      createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
    );
    return createStore(endpoint);
  }

  return {
    remote,
    makeStore,
    headOid: () => resolveRef({ fs, dir: homeDir, ref: 'HEAD' }),
    async cleanup() {
      await remote.stop();
    },
  };
}

describe('recents (behavior)', () => {
  it('RECORD_RECENT writes the recents and emits RECENTS; it does NOT commit to the home book', async () => {
    const ctx = await setup();
    try {
      const store = ctx.makeStore();
      const before = await ctx.headOid();

      store.send(command(CommandKind.RECORD_RECENT, { bookId: 'book-1', path: 'bossa/tarde.cifra.md' }));
      await until(() => expect(paths(store)).toEqual(['bossa/tarde.cifra.md']));
      const entry = store.slice('recents')[0];
      expect(entry.bookId).toBe('book-1');
      expect(typeof entry.at).toBe('string'); // an instant, not song text

      // Device-local, not synced: the home book's HEAD is exactly where it was.
      expect(await ctx.headOid()).toBe(before);
    } finally {
      await ctx.cleanup();
    }
  });

  it('a second record moves an existing entry to the front (most-recent-first, de-duplicated)', async () => {
    const ctx = await setup();
    try {
      const store = ctx.makeStore();
      store.send(command(CommandKind.RECORD_RECENT, { bookId: 'book-1', path: 'a.cifra.md' }));
      await until(() => expect(paths(store)).toEqual(['a.cifra.md']));
      store.send(command(CommandKind.RECORD_RECENT, { bookId: 'book-1', path: 'b.cifra.md' }));
      await until(() => expect(paths(store)).toEqual(['b.cifra.md', 'a.cifra.md']));
      // Re-opening `a` moves it to the front without duplicating it.
      store.send(command(CommandKind.RECORD_RECENT, { bookId: 'book-1', path: 'a.cifra.md' }));
      await until(() => expect(paths(store)).toEqual(['a.cifra.md', 'b.cifra.md']));
    } finally {
      await ctx.cleanup();
    }
  });

  it('the list is capped, and persists in the device-local meta store across a restart', async () => {
    const ctx = await setup();
    try {
      const store = ctx.makeStore();
      const total = DEFAULT_RECENTS_CAP + 3;
      for (let i = 0; i < total; i += 1) {
        store.send(command(CommandKind.RECORD_RECENT, { bookId: 'book-1', path: `song-${i}.cifra.md` }));
      }
      // The records are fired without awaiting each; the list first reaches the
      // cap after song-49 lands, while the last records are still queued. Wait on
      // the terminal state — most-recent (song-{total-1}) at the front AND the
      // length capped — so the ordering assertions below see the settled list,
      // not a mid-stream snapshot.
      await until(() => {
        expect(store.slice('recents').length).toBe(DEFAULT_RECENTS_CAP);
        expect(paths(store)[0]).toBe(`song-${total - 1}.cifra.md`);
      });
      // Most-recent-first: the last recorded is at the front, and the three
      // oldest fell off the end.
      expect(paths(store)).not.toContain('song-0.cifra.md');

      // A restart over the same backing store recovers the recents from `meta`
      // (surfaced on OPEN) — proving they live on the device, not in memory.
      const restarted = ctx.makeStore();
      restarted.open();
      await until(() =>
        expect(restarted.slice('recents')[0]?.path).toBe(`song-${total - 1}.cifra.md`),
      );
      expect(restarted.slice('recents').length).toBe(DEFAULT_RECENTS_CAP);
    } finally {
      await ctx.cleanup();
    }
  });
});
