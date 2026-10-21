// behavior — the device-local recents path through the real Worker logic, over
// the in-process loopback rig (as search-index.behavior.test.js): a fake
// IndexedDB, the shared lightning-fs, a real git-HTTP remote for the home book.
// Pins workflow 2 L17-20 and Decision 2: recents are kept on the device, in the
// Worker's `meta` store, and recording one makes NO home-book commit — "what
// you played on the phone is not something the laptop needs." And
// songs.unsaved_after_discard: a command that removes a song from its book
// (a discarded draft, a deleted file) drops its recent — workflow 2 L13-15,
// recents are the way back, and a way back to nothing is not one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { resolveRef } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { HOME_BOOK_ID } from './home-book.js';
import { DEFAULT_RECENTS_CAP, RECENTS_META_KEY } from './recents.js';
import { META_STORE } from './migrations.js';
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
const FENCE = '```';
const song = (lines) => lines.join('\n') + '\n';
const IDENTITY = { id: 'u_8f3a21', name: 'A Tester' };
const BOOK = 'book-1';

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
  // A song book, so a draft can be written, discarded and deleted for real.
  await git.clone({ dir: git.bookDir(BOOK), url: remote.url });

  // A fresh Worker logic + store over the shared idb/name; a second one is a
  // "restart" over the same backing store (to prove persistence in `meta`).
  function makeStore() {
    const endpoint = createLoopbackEndpoint((port) =>
      createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
    );
    return createStore(endpoint);
  }

  // Read-modify-write the stored recents list straight in the `meta` store, as
  // a device's IndexedDB holds it (not through the Worker).
  async function editStoredRecents(edit) {
    const db = await new Promise((resolve, reject) => {
      const req = idb.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, 'readwrite');
        const store = tx.objectStore(META_STORE);
        const req = store.get(RECENTS_META_KEY);
        let list;
        req.onsuccess = () => {
          list = edit(Array.isArray(req.result) ? req.result : []);
          if (list) store.put(list, RECENTS_META_KEY);
          else list = req.result;
        };
        tx.oncomplete = () => resolve(list);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  return {
    remote,
    makeStore,
    editStoredRecents,
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

  // books.put_online_no_ghosts Constraint 4 / Decision 5 — heal at OPEN: a
  // device that put a book online before the writers moved recents carries a
  // recent naming a `local-…` book that is gone; its next start drops it
  // (workflow 2 L29-35: a recent never leads to a book the device no longer has).
  it('OPEN drops a recent whose book is no longer on the device (books.put_online_no_ghosts)', async () => {
    const ctx = await setup();
    try {
      const store = ctx.makeStore();
      store.open();
      await until(() => expect(store.slice('index')[BOOK]).toBe('ready'));
      store.send(command(CommandKind.RECORD_RECENT, { bookId: BOOK, path: 'real.cifra.md' }));
      await until(() => expect(paths(store)).toEqual(['real.cifra.md']));

      // The ghost, written straight into `meta` as an older device left it.
      await ctx.editStoredRecents((list) => [
        ...list,
        { bookId: 'local-gone', path: 'ghost.cifra.md', at: '2026-10-19T10:00:00.000Z' },
      ]);

      const restarted = ctx.makeStore();
      restarted.open();
      await until(() => expect(restarted.slice('recents').length).toBeGreaterThan(0));
      expect(restarted.slice('recents').map((r) => [r.bookId, r.path])).toEqual([[BOOK, 'real.cifra.md']]);

      // Persisted: the stored list no longer holds the ghost.
      const stored = await ctx.editStoredRecents(() => null);
      expect(stored.map((r) => r.bookId)).toEqual([BOOK]);
    } finally {
      await ctx.cleanup();
    }
  });

  describe('a removed song leaves the recents (songs.unsaved_after_discard)', () => {
    const DRAFT = 'rascunho.cifra.md';
    const SAVED = 'guardada.cifra.md';
    const text = (title, chords = 'C   G') => song([`# ${title}`, '## A', FENCE, chords, 'linha', FENCE]);

    async function opened(ctx) {
      const store = ctx.makeStore();
      store.open();
      await until(() => expect(store.slice('index')[BOOK]).toBe('ready'));
      return store;
    }
    async function writeAndRecord(store, path, body) {
      // Wait for the WRITE's re-index (its INDEX_STATUS) so the draft is on
      // disk before anything discards it.
      const seen = recordEvents(store);
      store.send(command(CommandKind.WRITE, { bookId: BOOK, path, text: body }));
      await until(() =>
        expect(seen.some((m) => m.kind === EventKind.INDEX_STATUS && m.payload.bookId === BOOK)).toBe(true),
      );
      store.send(command(CommandKind.RECORD_RECENT, { bookId: BOOK, path }));
      await until(() => expect(paths(store)).toContain(path));
    }
    async function saveAndRecord(store, path) {
      store.send(command(CommandKind.WRITE, { bookId: BOOK, path, text: text('Guardada') }));
      store.send(command(CommandKind.SAVE, { bookId: BOOK, paths: [path], message: 'add song', author: IDENTITY }));
      await until(() => expect(store.slice('save')[BOOK]?.status).toBe('saved'));
      store.send(command(CommandKind.RECORD_RECENT, { bookId: BOOK, path }));
      await until(() => expect(paths(store)).toContain(path));
    }
    function recordEvents(store) {
      const seen = [];
      store.subscribeEvents((m) => seen.push(m));
      return seen;
    }

    it('discarding a never-saved draft drops it from the recents and emits RECENTS, and a restart still lacks it (workflow 3 L52-54; Constraints 3-4)', async () => {
      const ctx = await setup();
      try {
        const store = await opened(ctx);
        store.send(command(CommandKind.RECORD_RECENT, { bookId: BOOK, path: 'outra.cifra.md' }));
        await until(() => expect(paths(store)).toEqual(['outra.cifra.md']));
        await writeAndRecord(store, DRAFT, text('Rascunho'));
        expect(paths(store)).toEqual([DRAFT, 'outra.cifra.md']);

        const seen = recordEvents(store);
        store.send(command(CommandKind.DISCARD, { bookId: BOOK, paths: [DRAFT] }));
        await until(() => {
          const last = seen.filter((m) => m.kind === EventKind.RECENTS).at(-1);
          expect(last?.payload.recents.map((r) => r.path)).toEqual(['outra.cifra.md']);
        });
        expect(paths(store)).toEqual(['outra.cifra.md']);

        // Persisted in `meta`: a restart reads the pruned list.
        const restarted = ctx.makeStore();
        restarted.open();
        await until(() => expect(paths(restarted)).toEqual(['outra.cifra.md']));
      } finally {
        await ctx.cleanup();
      }
    });

    it('discarding a saved song\'s edits keeps its recent — no RECENTS change (Constraint 3)', async () => {
      const ctx = await setup();
      try {
        const store = await opened(ctx);
        await saveAndRecord(store, SAVED);
        store.send(command(CommandKind.WRITE, { bookId: BOOK, path: SAVED, text: text('Guardada', 'C   G   Am') }));

        const seen = recordEvents(store);
        store.send(command(CommandKind.DISCARD, { bookId: BOOK, paths: [SAVED] }));
        await until(() => {
          const i = seen.findIndex((m) => m.kind === EventKind.DISCARDED);
          expect(i).toBeGreaterThanOrEqual(0);
          expect(seen.slice(i).some((m) => m.kind === EventKind.INDEX_STATUS && m.payload.bookId === BOOK)).toBe(true);
        });
        // A record after it shares the recents write queue, so any forget the
        // discard had queued has landed by the time its RECENTS arrives.
        store.send(command(CommandKind.RECORD_RECENT, { bookId: BOOK, path: 'depois.cifra.md' }));
        await until(() => expect(paths(store)).toEqual(['depois.cifra.md', SAVED]));
        const recentsEvents = seen.filter((m) => m.kind === EventKind.RECENTS);
        expect(recentsEvents).toHaveLength(1);
      } finally {
        await ctx.cleanup();
      }
    });

    it('DELETE_FILE of a recent drops it (Constraint 3)', async () => {
      const ctx = await setup();
      try {
        const store = await opened(ctx);
        await saveAndRecord(store, SAVED);
        store.send(command(CommandKind.DELETE_FILE, { bookId: BOOK, path: SAVED }));
        await until(() => expect(paths(store)).toEqual([]));
      } finally {
        await ctx.cleanup();
      }
    });

    it('a forget racing a record loses neither: the result holds the new song and not the draft (Constraint 4)', async () => {
      const ctx = await setup();
      try {
        const store = await opened(ctx);
        await writeAndRecord(store, DRAFT, text('Rascunho'));

        // Sent together, without awaiting between them.
        store.send(command(CommandKind.RECORD_RECENT, { bookId: BOOK, path: 'nova.cifra.md' }));
        store.send(command(CommandKind.DISCARD, { bookId: BOOK, paths: [DRAFT] }));
        await until(() => expect(paths(store)).toEqual(['nova.cifra.md']));

        // And so it was written: a restart reads the same list.
        const restarted = ctx.makeStore();
        restarted.open();
        await until(() => expect(paths(restarted)).toEqual(['nova.cifra.md']));
      } finally {
        await ctx.cleanup();
      }
    });
  });
});
