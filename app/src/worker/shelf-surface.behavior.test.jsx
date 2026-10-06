import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — the shelf surface driven through the real command/event path
// (storage.shelf_surface; the .tji's "the Worker against a fake IndexedDB and a
// local git remote surfaces a shelf change, the reducer folds it",
// tasks/40-storage.tji:95). `createWorkerLogic` runs in-process over the
// loopback double with an injected `fake-indexeddb`, `installWebLocks()` active,
// and the git layer against `startGitHttpRemote()`; a seeded home book is cloned
// into the Worker's shared lightning-fs the way preferences-surface.behavior does
// (and home-book.behavior.test.js:172-195 seeds shelf.json). All labels and
// titles are written for this test (no labels/links in logs, no-song-text rule).
//
// Pins tasks/40-storage.tji:95; DIRECTION §3.2 L136-151, §3.7 L407-414;
// home-book-format §4.2, §7; workflow 8.

const IDENTITY = { id: 'u_8f3a21', name: 'A Tester' };

// Two instants, the second later, so a §5.1 merge resolves deterministically
// (the later change wins). `set` takes `now`, pinning the §3 `at`.
const T_EARLY = Date.UTC(2026, 9, 5, 14, 0, 0);
const T_LATE = Date.UTC(2026, 9, 5, 15, 0, 0);
const AT_EARLY = new Date(T_EARLY).toISOString();
const AT_LATE = new Date(T_LATE).toISOString();

const rand = () => Math.random().toString(36).slice(2);

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

// A home-book device over its own fake IndexedDB, filesystem and git layer, the
// book cloned from the shared remote — used to seed and to push remote changes,
// exactly as home-book.behavior.test.js does.
async function makeHomeDevice(remote, label) {
  const idb = new IDBFactory();
  const name = `sh-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  const dir = git.bookDir(HOME_BOOK_ID);
  await git.clone({ dir, url: remote.url });
  return { home: createHomeBook({ fs, git, locks }) };
}

// The Worker's device: a fresh fake IndexedDB and FS name, the device id
// computed up front (so a test can seed a `local` namespace under it), the home
// book cloned into the shared lightning-fs, and the Worker-backed store the view
// reads. Returns the store plus the seams a test seeds through.
async function makeWorkerDevice(remote, label) {
  const idb = new IDBFactory();
  const name = `shw-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  // The device id the Worker's surface will read (§7 narrowing); computing it
  // here persists it to the same `meta` db the Worker opens, so both agree.
  const deviceId = await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
  const dir = git.bookDir(HOME_BOOK_ID);
  await git.clone({ dir, url: remote.url });
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
  );
  return { store: createStore(endpoint), deviceId };
}

// Seed the remote home book with one shelf.json change at a nested path, pushed.
async function seedShelf(remote, label, change, now) {
  const device = await makeHomeDevice(remote, label);
  await device.home.set({
    bookId: HOME_BOOK_ID,
    file: 'shelf.json',
    changes: [change],
    author: IDENTITY,
    now,
  });
  await device.home.sync({ bookId: HOME_BOOK_ID, author: IDENTITY });
}

describe('the shelf surface (behavior)', () => {
  it('surfaces a book label on open, and re-surfaces it when a sync merges a relabel (workflow 8)', async () => {
    const remote = await startGitHttpRemote();
    try {
      // Seed the remote home book with books.b-1.label = "Turma de quarta".
      await seedShelf(remote, 'seed', { path: ['books', 'b-1', 'label'], value: 'Turma de quarta' }, T_EARLY);

      const { store } = await makeWorkerDevice(remote, 'w');

      // (1) OPEN → the Worker reads shelf.json and emits SHELF; the reducer folds
      // it; the slice is the nested map of registers, local empty (*surfaces*,
      // *the reducer folds it*).
      store.open();
      await waitFor(() =>
        expect(store.slice('shelf')).toEqual({
          books: { 'b-1': { label: { value: 'Turma de quarta', at: AT_EARLY } } },
          local: {},
        }),
      );

      // (2) A second device pushes books.b-1.label = "Turma de quinta" with a
      // later `at`.
      await seedShelf(remote, 'two', { path: ['books', 'b-1', 'label'], value: 'Turma de quinta' }, T_LATE);

      // SYNC_HOME → the Worker fetches, merges key by key (the later change
      // wins), and re-surfaces (*re-emitted when sync changes a register*).
      store.send(command(CommandKind.SYNC_HOME, { author: IDENTITY }));
      await waitFor(() =>
        expect(store.slice('shelf').books['b-1'].label.value).toBe('Turma de quinta'),
      );
      expect(store.slice('shelf').books['b-1'].label.at).toBe(AT_LATE);
    } finally {
      await remote.stop();
    }
  });

  it('narrows surfaced `local` books to this device, excluding another device (§7)', async () => {
    const remote = await startGitHttpRemote();
    try {
      const { store, deviceId } = await makeWorkerDevice(remote, 'w');

      // Seed a local book under THIS device's namespace, and one under a
      // different device id — then sync them into the Worker's clone.
      await seedShelf(remote, 'mine', { path: ['local', deviceId, 'local-1', 'title'], value: 'Rascunhos' }, T_EARLY);
      await seedShelf(remote, 'other', { path: ['local', 'dev-other', 'local-9', 'title'], value: 'No iPhone' }, T_LATE);

      store.open();
      store.send(command(CommandKind.SYNC_HOME, { author: IDENTITY }));

      await waitFor(() =>
        expect(store.slice('shelf').local['local-1']).toBeDefined(),
      );
      // This device's local book surfaces…
      expect(store.slice('shelf').local).toEqual({
        'local-1': { title: { value: 'Rascunhos', at: AT_EARLY } },
      });
      // …the other device's never reaches this device's view (§7).
      expect(Object.prototype.hasOwnProperty.call(store.slice('shelf').local, 'local-9')).toBe(false);
    } finally {
      await remote.stop();
    }
  });

  it('surfaces the empty shelf end to end when shelf.json is absent', async () => {
    const remote = await startGitHttpRemote();
    try {
      // The remote has no shelf.json: OPEN reads ENOENT → `{}` → the empty shelf.
      const { store } = await makeWorkerDevice(remote, 'w');
      store.open();
      await waitFor(() =>
        expect(store.slice('shelf')).toEqual({ books: {}, local: {} }),
      );
    } finally {
      await remote.stop();
    }
  });
});
