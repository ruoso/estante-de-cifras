// Behavior (Worker) — the save preview, the note-as-commit-message, the
// first-save author name, and the offline save (songs.save_sheet, workflow 4
// §Saving, §Who made the change, §Save pushes). Drives the real Worker logic
// in-process over the loopback endpoint against a fake IndexedDB and the Web
// Locks shim; the online case clones a real git smart-HTTP remote. Fixtures are
// purpose-written songs — never anyone's copyrighted words.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import nodeFs from 'node:fs';
import { log as gitLog, resolveRef } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

const AUTHOR = { id: 'local', name: 'Me' };

// Two versions of one purpose-written song, differing by a single chord so the
// diff is exactly one change (an unsung song, so it numbers bars).
const V1 = ['# Tarde Clara', '- notation: brazilian', '', '## Parte', '```', 'D | Em', '```', ''].join('\n');
const V2 = ['# Tarde Clara', '- notation: brazilian', '', '## Parte', '```', 'D7 | Em', '```', ''].join('\n');
const MARE = ['# Maré Mansa', '- notation: brazilian', '', '## Parte', '```', 'G | C', '```', ''].join('\n');
const NOVA = ['# Nova', '- notation: brazilian', '', '## Parte', '```', 'Am | G', '```', ''].join('\n');

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

const until = (fn) => new Promise((resolve, reject) => {
  const started = Date.now();
  const tick = async () => {
    try {
      resolve(await fn());
    } catch (err) {
      if (Date.now() - started > 8000) reject(err);
      else setTimeout(tick, 25);
    }
  };
  tick();
});

// A new fake-IndexedDB + Worker-logic store, with no network (a local book
// never fetches — an offline fetch spy stands in).
function makeWorker() {
  const idb = new IDBFactory();
  const name = `sp-${Math.random().toString(36).slice(2)}`;
  const offlineFetch = () => Promise.reject(new Error('offline'));
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: offlineFetch }),
  );
  const store = createStore(endpoint);
  const events = [];
  store.subscribeEvents((m) => events.push(m));
  const lastEvent = (kind) => events.filter((e) => e.kind === kind).at(-1);
  // WRITE/DISCARD emit no event; drain the per-book lock to know they settled.
  const settled = async (bookId) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await navigator.locks.request(`book:${bookId}`, { mode: 'exclusive' }, () => {});
    await Promise.resolve();
  };
  return { store, events, lastEvent, settled, name, idb };
}

// Bring the Worker up and make a local book with one committed song (V1).
async function seedBookWithSong(w) {
  w.store.open();
  await until(() => expect(w.store.slice('connection').status).toBe('ready'));
  w.store.send(command(CommandKind.CREATE_BOOK, { title: 'My Book', author: AUTHOR }));
  await until(() => expect(w.lastEvent(EventKind.BOOK_CREATED)).toBeTruthy());
  const bookId = w.lastEvent(EventKind.BOOK_CREATED).payload.bookId;
  w.store.send(command(CommandKind.WRITE, { bookId, path: 'tarde.cifra.md', text: V1 }));
  await w.settled(bookId);
  w.store.send(
    command(CommandKind.SAVE, { bookId, paths: ['tarde.cifra.md'], message: 'Add Tarde Clara', author: AUTHOR }),
  );
  await until(() => expect(w.store.slice('save')[bookId]?.status).toBe('saved'));
  return bookId;
}

describe('PREVIEW_SAVE — what changed, in musical terms (§Saving)', () => {
  it('reads HEAD and the working copy and returns the per-path diff, title and isNew', async () => {
    const w = makeWorker();
    const bookId = await seedBookWithSong(w);

    // Edit the working copy (not yet saved): one chord changes.
    w.store.send(command(CommandKind.WRITE, { bookId, path: 'tarde.cifra.md', text: V2 }));
    await w.settled(bookId);

    w.store.send(command(CommandKind.PREVIEW_SAVE, { bookId, paths: ['tarde.cifra.md'] }));
    await until(() => expect(w.lastEvent(EventKind.SAVE_PREVIEW)).toBeTruthy());
    const { previews } = w.lastEvent(EventKind.SAVE_PREVIEW).payload;
    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({ path: 'tarde.cifra.md', title: 'Tarde Clara', isNew: false });
    expect(previews[0].changes.length).toBeGreaterThan(0);
    // The summary is the diff's one neutral-English line (the default note).
    expect(previews[0].summary).toContain('D → D7');
  });

  it('a never-saved song returns an all-added preview with its title and isNew true', async () => {
    const w = makeWorker();
    const bookId = await seedBookWithSong(w);

    // A new file written but never committed.
    w.store.send(command(CommandKind.WRITE, { bookId, path: 'nova.cifra.md', text: NOVA }));
    await w.settled(bookId);

    w.store.send(command(CommandKind.PREVIEW_SAVE, { bookId, paths: ['nova.cifra.md'] }));
    await until(() => expect(w.lastEvent(EventKind.SAVE_PREVIEW)).toBeTruthy());
    const p = w.lastEvent(EventKind.SAVE_PREVIEW).payload.previews[0];
    expect(p).toMatchObject({ path: 'nova.cifra.md', title: 'Nova', isNew: true });
    expect(p.changes.length).toBeGreaterThan(0); // all added
  });

  // songs.first_save_fields Constraint 2 — the note's "SAVE_PREVIEW carries the
  // filename NAME_AND_SAVE would take"; workflow 3 §Its file name L48.
  it("a never-saved song's preview carries the file name the first save will take, with the folder's suffix", async () => {
    const w = makeWorker();
    const bookId = await seedBookWithSong(w);

    // A song already named mare-mansa.cifra.md at the book root.
    w.store.send(command(CommandKind.WRITE, { bookId, path: 'mare-mansa.cifra.md', text: MARE }));
    await w.settled(bookId);
    w.store.send(
      command(CommandKind.SAVE, { bookId, paths: ['mare-mansa.cifra.md'], message: 'Add Maré Mansa', author: AUTHOR }),
    );
    await until(() =>
      expect(w.events.filter((e) => e.kind === EventKind.SAVED)).toHaveLength(2),
    );

    // A new song into the same book, headed the same.
    w.store.send(command(CommandKind.NEW_SONG, { targetBookId: bookId }));
    await until(() => expect(w.lastEvent(EventKind.NEW_SONG_READY)).toBeTruthy());
    const { path: fromPath } = w.lastEvent(EventKind.NEW_SONG_READY).payload;
    w.store.send(command(CommandKind.WRITE, { bookId, path: fromPath, text: MARE }));
    await w.settled(bookId);

    w.store.send(command(CommandKind.PREVIEW_SAVE, { bookId, paths: [fromPath, 'tarde.cifra.md'] }));
    await until(() => expect(w.lastEvent(EventKind.SAVE_PREVIEW)).toBeTruthy());
    const [fresh, saved] = w.lastEvent(EventKind.SAVE_PREVIEW).payload.previews;
    expect(fresh).toMatchObject({ path: fromPath, isNew: true, fileName: 'mare-mansa-2.cifra.md' });
    expect(fresh.taken).toContain('mare-mansa.cifra.md');
    expect(fresh.taken).not.toContain(fromPath);
    // A saved path's entry is the plain diff, with no name to take.
    expect(saved.isNew).toBe(false);
    expect(saved).not.toHaveProperty('fileName');
    expect(saved).not.toHaveProperty('taken');

    // The first save takes exactly the previewed name.
    w.store.send(command(CommandKind.NAME_AND_SAVE, { bookId, fromPath, author: AUTHOR }));
    await until(() =>
      expect(w.events.filter((e) => e.kind === EventKind.SAVED)).toHaveLength(3),
    );
    expect(w.lastEvent(EventKind.SAVED).payload.path).toBe(fresh.fileName);
  });
});

describe('SAVE with the sheet note, and the first-save author name', () => {
  it('commits the working copy with the note as the message and re-indexes it saved', async () => {
    const w = makeWorker();
    const bookId = await seedBookWithSong(w);

    w.store.send(command(CommandKind.WRITE, { bookId, path: 'tarde.cifra.md', text: V2 }));
    await w.settled(bookId);
    w.store.send(
      command(CommandKind.SAVE, {
        bookId,
        paths: ['tarde.cifra.md'],
        message: 'Parte bar 1: D → D7',
        author: AUTHOR,
      }),
    );
    await until(() => expect(w.store.slice('save')[bookId]?.status).toBe('saved'));

    // The commit carries the note as its message (read HEAD off the shared fs).
    const fs = createFileSystem(`${w.name}-fs`, { indexedDB: w.idb });
    const [head] = await gitLog({ fs, dir: `/books/${bookId}`, depth: 1 });
    expect(head.commit.message.trim()).toBe('Parte bar 1: D → D7');

    // The saved song is no longer unsaved in search.
    w.store.send(command(CommandKind.SEARCH, { query: 'Tarde' }));
    await until(() => {
      const r = w.store.slice('search').results.find((x) => x.path === 'tarde.cifra.md');
      expect(r).toBeTruthy();
      expect(r.unsaved).toBe(false);
    });
  });

  it('SET_IDENTITY_NAME writes the author name to the home book and surfaces it', async () => {
    const w = makeWorker();
    w.store.open();
    await until(() => expect(w.store.slice('connection').status).toBe('ready'));

    w.store.send(
      command(CommandKind.SET_IDENTITY_NAME, { name: 'Marina Souza', author: AUTHOR }),
    );
    await until(() => expect(w.store.slice('preferences').authorName?.value).toBe('Marina Souza'));

    // It survives: a fresh Worker over the same backing store reads it back.
    const endpoint = createLoopbackEndpoint((port) =>
      createWorkerLogic(port, { indexedDB: w.idb, name: w.name, fetch: () => Promise.reject(new Error('offline')) }),
    );
    const store2 = createStore(endpoint);
    store2.open();
    await until(() => expect(store2.slice('preferences').authorName?.value).toBe('Marina Souza'));
  });
});

describe('an offline save keeps the commit and leaves the push waiting (§Save pushes)', () => {
  it('a save with no network commits locally and the remote stays where it was', async () => {
    const remote = await startGitHttpRemote();
    const idb = new IDBFactory();
    const name = `spo-${Math.random().toString(36).slice(2)}`;
    const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
    let online = true;
    const fetchImpl = (...args) =>
      online ? globalThis.fetch(...args) : Promise.reject(new Error('offline'));
    const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
    const bookId = 'book-online';
    try {
      await git.clone({ dir: git.bookDir(bookId), url: remote.url });
      const remoteMain = () =>
        resolveRef({ fs: nodeFs, gitdir: remote.repoDir, ref: 'refs/heads/main' });
      const seed = await remoteMain();

      const endpoint = createLoopbackEndpoint((port) =>
        createWorkerLogic(port, { indexedDB: idb, name, fetch: fetchImpl }),
      );
      const store = createStore(endpoint);
      store.open();
      await until(() => expect(store.slice('connection').status).toBe('ready'));

      // The network drops before the save; the commit is kept, the push queued.
      online = false;
      store.send(command(CommandKind.WRITE, { bookId, path: 'tarde.cifra.md', text: V1 }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await navigator.locks.request(`book:${bookId}`, { mode: 'exclusive' }, () => {});
      store.send(
        command(CommandKind.SAVE, {
          bookId,
          paths: ['tarde.cifra.md'],
          message: 'Add Tarde Clara',
          author: AUTHOR,
        }),
      );
      await until(() => expect(store.slice('save')[bookId]?.status).toBe('saved'));
      // SAVED claims no push outcome (songs.save_feedback Constraint 2); the
      // after-save sync pass cannot reach the remote, so it is still the seed.
      expect(store.slice('save')[bookId]).not.toHaveProperty('pushed');
      expect(await remoteMain()).toBe(seed);
      expect(store.slice('save')[bookId].commit).toBeTruthy();

      // The commit is durable: HEAD holds it on the shared fs.
      const [head] = await gitLog({ fs, dir: `/books/${bookId}`, depth: 1 });
      expect(head.commit.message.trim()).toBe('Add Tarde Clara');
    } finally {
      await remote.stop();
    }
  });
});
