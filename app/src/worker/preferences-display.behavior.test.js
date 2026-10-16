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
import { command, CommandKind, EventKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior (shell.display_preferences) — the display-preference writes driven
// through the real command/event path, on the preferences-surface rig (loopback
// + fake-indexeddb + a local git remote), as preferences-theme-language does
// for theme and language. SET_DENSITY, SET_DIAGRAM_HANDED and
// SET_DIAGRAM_ORIENTATION each write one register (`density`, `diagramHanded`,
// `diagramOrientation`) to the home book's preferences.json, auto-commit it
// without pushing, and re-surface PREFERENCES carrying it; choosing the default
// afterwards (comfortable, right, vertical) writes the tombstone, never the
// literal default; an invalid value emits ERROR and writes nothing; two
// registers set in turn both survive (separate registers — design Decision 1).
//
// Pins home-book-format §4.1 (the registers and their defaults) and
// account_screen.md Decisions 2-3 (one validated command per register; the
// default is the tombstone).

const IDENTITY = { id: 'u_prefs', name: 'A Tester' };
const T_EARLY = Date.UTC(2026, 9, 5, 14, 0, 0);

const rand = () => Math.random().toString(36).slice(2);

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

// A home-book device over its own fake IndexedDB, filesystem and git layer, the
// home book cloned from the shared remote — used to seed the remote and, later,
// to prove nothing was pushed by reading a fresh clone.
async function makeHomeDevice(remote, label) {
  const idb = new IDBFactory();
  const name = `pdisp-h-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  await git.clone({ dir: git.bookDir(HOME_BOOK_ID), url: remote.url });
  return { home: createHomeBook({ fs, git, locks }) };
}

// Seed the remote home book with one preferences change, pushed up, so there is a
// home book to clone and a known baseline register.
async function seedPreference(remote, label, change, now) {
  const device = await makeHomeDevice(remote, label);
  await device.home.set({
    bookId: HOME_BOOK_ID,
    file: 'preferences.json',
    changes: [change],
    author: IDENTITY,
    now,
  });
  await device.home.sync({ bookId: HOME_BOOK_ID, author: IDENTITY });
}

// A store over a fresh worker logic bound to the given idb+name (so a reload
// re-opens the same database and sees the committed, flushed register).
function workerStore(idb, name) {
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
  );
  return createStore(endpoint);
}

// The Worker's device: a fresh fake IndexedDB and FS name, the home book cloned
// into the shared lightning-fs through a test-side git layer (so the Worker's own
// fs over the same name+idb sees it), and the Worker-backed store the view reads.
async function makeWorkerDevice(remote, label) {
  const idb = new IDBFactory();
  const name = `pdisp-w-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  await git.clone({ dir: git.bookDir(HOME_BOOK_ID), url: remote.url });
  return { store: workerStore(idb, name), idb, name };
}

const prefs = (store) => store.slice('preferences') ?? {};

describe('the display preference writes (behavior)', () => {
  const CASES = [
    { kind: CommandKind.SET_DENSITY, field: 'density', register: 'density', chosen: 'roomy', fallback: 'comfortable' },
    { kind: CommandKind.SET_DIAGRAM_HANDED, field: 'handed', register: 'diagramHanded', chosen: 'left', fallback: 'right' },
    {
      kind: CommandKind.SET_DIAGRAM_ORIENTATION,
      field: 'orientation',
      register: 'diagramOrientation',
      chosen: 'horizontal',
      fallback: 'vertical',
    },
  ];

  for (const { kind, field, register, chosen, fallback } of CASES) {
    it(`${kind} writes the ${register} register, auto-commits without pushing, survives a reload, and the default is a tombstone`, async () => {
      const remote = await startGitHttpRemote();
      try {
        await seedPreference(remote, 'seed', { path: ['authorName'], value: 'Rafael' }, T_EARLY);

        const { store, idb, name } = await makeWorkerDevice(remote, 'w');
        store.open();
        await waitFor(() => expect(prefs(store)).toHaveProperty('authorName'));

        // The choice → its register is written and PREFERENCES re-surfaces it.
        store.send(command(kind, { [field]: chosen, author: IDENTITY }));
        await waitFor(() => expect(prefs(store)[register]?.value).toBe(chosen));

        // Committed to the home book: a fresh worker over the same database
        // (a reload) re-surfaces it.
        const reloaded = workerStore(idb, name);
        reloaded.open();
        await waitFor(() => expect(prefs(reloaded)[register]?.value).toBe(chosen));

        // Not pushed by the command: a fresh clone of the remote never sees it.
        const { home } = await makeHomeDevice(remote, 'check');
        const remoteModel = await home.read({ bookId: HOME_BOOK_ID, file: 'preferences.json' });
        expect(remoteModel[register]).toBeUndefined();

        // Choosing the default afterwards writes the tombstone (value null),
        // never the literal default.
        reloaded.send(command(kind, { [field]: fallback, author: IDENTITY }));
        await waitFor(() => {
          const value = prefs(reloaded)[register];
          expect(value).toBeDefined();
          expect(value.value).toBeNull();
        });
      } finally {
        await remote.stop();
      }
    });
  }

  it('two registers set in turn both survive (separate registers, design Decision 1)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedPreference(remote, 'seed', { path: ['authorName'], value: 'Rafael' }, T_EARLY);

      const { store, idb, name } = await makeWorkerDevice(remote, 'w');
      store.open();
      await waitFor(() => expect(prefs(store)).toHaveProperty('authorName'));

      store.send(command(CommandKind.SET_DIAGRAM_HANDED, { handed: 'left', author: IDENTITY }));
      await waitFor(() => expect(prefs(store).diagramHanded?.value).toBe('left'));
      store.send(
        command(CommandKind.SET_DIAGRAM_ORIENTATION, { orientation: 'horizontal', author: IDENTITY }),
      );
      await waitFor(() => expect(prefs(store).diagramOrientation?.value).toBe('horizontal'));
      store.send(command(CommandKind.SET_DENSITY, { density: 'compact', author: IDENTITY }));
      await waitFor(() => expect(prefs(store).density?.value).toBe('compact'));

      // Each kept its own value — the later writes never re-stamped the earlier.
      expect(prefs(store).diagramHanded.value).toBe('left');
      expect(prefs(store).diagramOrientation.value).toBe('horizontal');

      const reloaded = workerStore(idb, name);
      reloaded.open();
      await waitFor(() => {
        const p = prefs(reloaded);
        expect(p.diagramHanded?.value).toBe('left');
        expect(p.diagramOrientation?.value).toBe('horizontal');
        expect(p.density?.value).toBe('compact');
      });
    } finally {
      await remote.stop();
    }
  });

  it('rejects an invalid value with an ERROR and no write (validated at the boundary)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedPreference(remote, 'seed', { path: ['authorName'], value: 'Rafael' }, T_EARLY);

      const { store } = await makeWorkerDevice(remote, 'w');
      const errors = [];
      store.subscribeEvents((message) => {
        if (message?.kind === EventKind.ERROR) errors.push(message.payload);
      });
      store.open();
      await waitFor(() => expect(prefs(store)).toHaveProperty('authorName'));

      store.send(command(CommandKind.SET_DENSITY, { density: 'huge', author: IDENTITY }));
      store.send(command(CommandKind.SET_DIAGRAM_HANDED, { handed: 'both', author: IDENTITY }));
      store.send(
        command(CommandKind.SET_DIAGRAM_ORIENTATION, { orientation: 'diagonal', author: IDENTITY }),
      );

      await waitFor(() => expect(errors.length).toBe(3));
      const messages = errors.map((e) => JSON.stringify(e));
      expect(messages.some((m) => m.includes('invalid density'))).toBe(true);
      expect(messages.some((m) => m.includes('invalid hand'))).toBe(true);
      expect(messages.some((m) => m.includes('invalid orientation'))).toBe(true);
      // None of the registers was written.
      expect(prefs(store).density).toBeUndefined();
      expect(prefs(store).diagramHanded).toBeUndefined();
      expect(prefs(store).diagramOrientation).toBeUndefined();
    } finally {
      await remote.stop();
    }
  });
});
