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

// behavior (account.account_screen) — the theme/language preference-write path
// driven through the real command/event path, on the preferences-surface rig
// (loopback + fake-indexeddb + a local git remote). SET_THEME writes the `theme`
// register to preferences.json and re-surfaces PREFERENCES; SET_LANGUAGE writes
// `language`; both auto-commit to the home book and DO NOT push (a fresh clone of
// the remote never sees them); a re-surface after a simulated reload still
// carries them; an invalid value is rejected (no write). `automatic` clears the
// theme register to a tombstone (Decision 3), never a literal "automatic".
//
// Pins home-book-format §4.1 (the theme/language registers, absent ⇒ automatic /
// the browser's) and DIRECTION §3.2 L138-144 (preferences auto-committed, never
// pushed — "explicit save is for what the user authors, not for preferences").

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
  const name = `ptl-h-${label}-${rand()}`;
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
  const name = `ptl-w-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  await git.clone({ dir: git.bookDir(HOME_BOOK_ID), url: remote.url });
  return { store: workerStore(idb, name), idb, name };
}

describe('the theme/language preference writes (behavior)', () => {
  it('SET_THEME writes the theme register, re-surfaces PREFERENCES, auto-commits without pushing, and survives a reload', async () => {
    const remote = await startGitHttpRemote();
    try {
      // A home book on the remote carrying only an unrelated register.
      await seedPreference(remote, 'seed', { path: ['authorName'], value: 'Rafael' }, T_EARLY);

      const { store, idb, name } = await makeWorkerDevice(remote, 'w');
      store.open();
      await waitFor(() => expect(store.slice('preferences')).toHaveProperty('authorName'));

      // SET_THEME → the theme register is written and PREFERENCES re-surfaces.
      store.send(command(CommandKind.SET_THEME, { theme: 'palco', author: IDENTITY }));
      await waitFor(() => expect(store.slice('preferences').theme?.value).toBe('palco'));

      // Does NOT push: a fresh clone of the remote never sees the theme.
      const { home } = await makeHomeDevice(remote, 'check');
      const remoteModel = await home.read({ bookId: HOME_BOOK_ID, file: 'preferences.json' });
      expect(remoteModel.theme).toBeUndefined();
      expect(remoteModel.authorName?.value).toBe('Rafael');

      // Survives a reload: a fresh worker over the same database re-surfaces it.
      const reloaded = workerStore(idb, name);
      reloaded.open();
      await waitFor(() => expect(reloaded.slice('preferences').theme?.value).toBe('palco'));
    } finally {
      await remote.stop();
    }
  });

  it('SET_LANGUAGE writes the language register and re-surfaces it', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedPreference(remote, 'seed', { path: ['authorName'], value: 'Rafael' }, T_EARLY);

      const { store } = await makeWorkerDevice(remote, 'w');
      store.open();
      await waitFor(() => expect(store.slice('preferences')).toHaveProperty('authorName'));

      store.send(command(CommandKind.SET_LANGUAGE, { language: 'pt-BR', author: IDENTITY }));
      await waitFor(() => expect(store.slice('preferences').language?.value).toBe('pt-BR'));
    } finally {
      await remote.stop();
    }
  });

  it('choosing Automatic clears the theme register to a tombstone (value null), never a literal "automatic"', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedPreference(remote, 'seed', { path: ['theme'], value: 'palco' }, T_EARLY);

      const { store } = await makeWorkerDevice(remote, 'w');
      store.open();
      await waitFor(() => expect(store.slice('preferences').theme?.value).toBe('palco'));

      store.send(command(CommandKind.SET_THEME, { theme: 'automatic', author: IDENTITY }));
      // The register is kept as a tombstone (home-book §5.3): present, value null.
      await waitFor(() => {
        const theme = store.slice('preferences').theme;
        expect(theme).toBeDefined();
        expect(theme.value).toBeNull();
      });
    } finally {
      await remote.stop();
    }
  });

  it('rejects an invalid value with no write (Decision 2: validated at the boundary)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedPreference(remote, 'seed', { path: ['authorName'], value: 'Rafael' }, T_EARLY);

      const { store } = await makeWorkerDevice(remote, 'w');
      const errors = [];
      store.subscribeEvents((message) => {
        if (message?.kind === EventKind.ERROR) errors.push(message.payload);
      });
      store.open();
      await waitFor(() => expect(store.slice('preferences')).toHaveProperty('authorName'));

      store.send(command(CommandKind.SET_THEME, { theme: 'neon', author: IDENTITY }));
      store.send(command(CommandKind.SET_LANGUAGE, { language: 'xx', author: IDENTITY }));

      await waitFor(() => expect(errors.length).toBe(2));
      // Neither register was written.
      expect(store.slice('preferences').theme).toBeUndefined();
      expect(store.slice('preferences').language).toBeUndefined();
    } finally {
      await remote.stop();
    }
  });
});
