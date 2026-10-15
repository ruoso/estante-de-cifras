// Behavior — the NEW_SONG / NAME_AND_SAVE Worker seam (songs.new_song), driven
// end to end over a loopback store with a fake IndexedDB, a real lightning-fs
// working copy, in-memory Web Locks, and real isomorphic-git. The view behavior
// test (NewSong.behavior.test.jsx) cannot reach this mechanism; this is where it
// is pinned. No network for the local cases; a `startGitHttpRemote()` only for
// the online push.
//
// Fixtures are songs written for the purpose — never anyone's copyrighted words.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { log, listFiles, resolveRef } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';
import { MY_SONGS_ID } from './my-songs.js';
import { HOME_BOOK_ID } from './home-book.js';

const IDENTITY = { id: 'local', name: 'Me' };
const MY_SONGS_LABEL = 'My songs';

// A valid, canonicalisable cifra.md song titled for the test (purpose-written).
const CORACAO = [
  '# Coração de Estrada',
  '- artist: Pedro Araújo',
  '- notation: brazilian',
  '',
  '## Intro',
  '```',
  'Am | Dm | G7 | C7M',
  '```',
  '',
].join('\n');

const until = (fn) => vi.waitFor(fn, { timeout: 8000, interval: 25 });

// Wait until a book's lock is free — WRITE/DISCARD emit no event (see
// working-copy.behavior.test.js). Queues behind the Worker's own lock request.
async function settled(bookId) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await navigator.locks.request(`book:${bookId}`, { mode: 'exclusive' }, () => {});
  await Promise.resolve();
}

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

// A Worker over a fresh fake-IDB + fs, its events collected off the store's raw
// event channel, its slices readable. `fetch` defaults to an offline spy that
// records and rejects every call, so a local flow is asserted to touch no
// network.
function makeWorker({ fetch } = {}) {
  const idb = new IDBFactory();
  const name = `ns-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const fetchCalls = [];
  const spyFetch = (...args) => {
    fetchCalls.push(args);
    return Promise.reject(new Error('offline'));
  };
  const useFetch = fetch ?? spyFetch;
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: useFetch }) });
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: useFetch }),
  );
  const store = createStore(endpoint);
  const events = [];
  store.subscribeEvents((m) => events.push(m));
  return {
    idb,
    name,
    fs,
    git,
    store,
    events,
    fetchCalls,
    send: (cmd) => store.send(cmd),
    ready: (n) => events.filter((e) => e.kind === EventKind.NEW_SONG_READY).at(n ?? -1),
    saved: () => events.filter((e) => e.kind === EventKind.SAVED).at(-1),
  };
}

describe('NEW_SONG — My songs under the reserved id', () => {
  it('provisions My songs idempotently, scaffolds §2.1, lists it on the shelf, and allocates untitled[-N] (workflow 3 §Which book L28, §Its file name L42-48)', async () => {
    const w = makeWorker();
    const dir = w.git.bookDir(MY_SONGS_ID);

    w.send(command(CommandKind.NEW_SONG, { mySongsTitle: MY_SONGS_LABEL, author: IDENTITY }));
    await until(() =>
      expect(w.events.filter((e) => e.kind === EventKind.NEW_SONG_READY)).toHaveLength(1),
    );

    const ready1 = w.ready().payload;
    expect(ready1.bookId).toBe(MY_SONGS_ID);
    expect(ready1.path).toBe('untitled.cifra.md');

    // The repository exists under the reserved id with the §2.1 scaffold.
    await expect(resolveRef({ fs: w.fs, dir, ref: 'main' })).resolves.toBeTruthy();
    const files = await listFiles({ fs: w.fs, dir, ref: 'main' });
    expect(files).toContain('README.md');
    expect(files).toContain('.gitattributes');
    const readme = await w.fs.promises.readFile(`${dir}/README.md`, 'utf8');
    expect(readme).toBe(`# ${MY_SONGS_LABEL}\n`);

    // It is on the shelf, in this device's local namespace, with its title.
    await until(() =>
      expect(w.store.slice('shelf')?.local?.[MY_SONGS_ID]?.title?.value).toBe(MY_SONGS_LABEL),
    );

    // Starting the song IS writing its template; write the placeholder so the
    // next NEW_SONG sees it taken, then confirm the reserved repo is reused and
    // the next placeholder is untitled-2 (not a second repository).
    w.send(command(CommandKind.WRITE, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md', text: CORACAO }));
    await settled(MY_SONGS_ID);

    w.send(command(CommandKind.NEW_SONG, { mySongsTitle: MY_SONGS_LABEL, author: IDENTITY }));
    await until(() =>
      expect(w.events.filter((e) => e.kind === EventKind.NEW_SONG_READY)).toHaveLength(2),
    );
    expect(w.ready().payload.path).toBe('untitled-2.cifra.md');

    // Still exactly one commit on the reserved repo (idempotent create — the
    // second NEW_SONG did not re-init or re-commit it).
    const commits = await log({ fs: w.fs, dir, ref: 'main' });
    expect(commits).toHaveLength(1);
    expect(w.fetchCalls).toHaveLength(0); // no account, no network
  });

  it('a home book is provisioned with no account (ensureLocal)', async () => {
    const w = makeWorker();
    w.send(command(CommandKind.NEW_SONG, { mySongsTitle: MY_SONGS_LABEL, author: IDENTITY }));
    await until(() =>
      expect(w.events.filter((e) => e.kind === EventKind.NEW_SONG_READY)).toHaveLength(1),
    );
    await expect(
      resolveRef({ fs: w.fs, dir: w.git.bookDir(HOME_BOOK_ID), ref: 'main' }),
    ).resolves.toBeTruthy();
  });
});

describe('NEW_SONG — findable before the first save', () => {
  it('a written placeholder shows in search with unsaved: true (workflow 3 L20-23)', async () => {
    const w = makeWorker();
    w.send(command(CommandKind.NEW_SONG, { mySongsTitle: MY_SONGS_LABEL, author: IDENTITY }));
    await until(() =>
      expect(w.events.filter((e) => e.kind === EventKind.NEW_SONG_READY)).toHaveLength(1),
    );
    w.send(command(CommandKind.WRITE, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md', text: CORACAO }));
    await settled(MY_SONGS_ID);
    // Re-query each poll: the WRITE's inline re-index may not have landed on the
    // first SEARCH, and SEARCH_RESULTS only updates the slice when a search runs.
    await until(() => {
      w.send(command(CommandKind.SEARCH, { query: 'Estrada' }));
      const results = w.store.slice('search').results;
      const hit = results.find((r) => r.bookId === MY_SONGS_ID);
      expect(hit).toBeTruthy();
      expect(hit.unsaved).toBe(true);
    });
  });
});

describe('NAME_AND_SAVE — the first save names and commits', () => {
  it('renames the placeholder to the title slug, commits "Add {title}" by the device id, leaves no untitled file, and (local) does not push (workflow 3 §Its file name / §The first save; DIRECTION §3 L111-113)', async () => {
    const w = makeWorker();
    const dir = w.git.bookDir(MY_SONGS_ID);
    w.send(command(CommandKind.NEW_SONG, { mySongsTitle: MY_SONGS_LABEL, author: IDENTITY }));
    await until(() =>
      expect(w.events.filter((e) => e.kind === EventKind.NEW_SONG_READY)).toHaveLength(1),
    );
    w.send(command(CommandKind.WRITE, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md', text: CORACAO }));
    await settled(MY_SONGS_ID);

    w.send(
      command(CommandKind.NAME_AND_SAVE, {
        bookId: MY_SONGS_ID,
        fromPath: 'untitled.cifra.md',
        author: IDENTITY,
      }),
    );
    await until(() => expect(w.store.slice('save')[MY_SONGS_ID]?.status).toBe('saved'));

    const saved = w.saved().payload;
    expect(saved.path).toBe('coracao-de-estrada.cifra.md');
    expect(saved.pushed).toBe(false); // local book, no remote

    const [entry] = await log({ fs: w.fs, dir, ref: 'main', depth: 1 });
    expect(entry.commit.message.trim()).toBe('Add Coração de Estrada');
    expect(entry.commit.author.name).toBe('Me');
    // Signed out, the commit carries this device's own local author id — a random
    // id, never the shared literal `local` (account.commit_author Constraint 3).
    expect(entry.commit.author.email).toMatch(/^[0-9a-f-]{36}@users\.estantedecifras\.app$/);

    const files = await listFiles({ fs: w.fs, dir, ref: 'main' });
    expect(files).toContain('coracao-de-estrada.cifra.md');
    expect(files.some((f) => f.startsWith('untitled'))).toBe(false);
    const onDisk = await w.fs.promises.readdir(dir);
    expect(onDisk.some((f) => f.startsWith('untitled'))).toBe(false);
    expect(w.fetchCalls).toHaveLength(0);
  });
});

describe('NAME_AND_SAVE — online pushes; offline keeps the commit', () => {
  it('pushes the first save to an online book, and resolves pushed: false offline with the commit kept', async () => {
    // Online: the Worker rides the real remote. Clone a book into its fs, write
    // a placeholder, and name-and-save it — the push lands on the remote.
    const remote = await startGitHttpRemote();
    try {
      const online = makeWorker({ fetch: globalThis.fetch });
      const bookId = 'book-online';
      const dir = online.git.bookDir(bookId);
      await online.git.clone({ dir, url: remote.url });
      online.send(command(CommandKind.WRITE, { bookId, path: 'untitled.cifra.md', text: CORACAO }));
      await settled(bookId);
      online.send(
        command(CommandKind.NAME_AND_SAVE, { bookId, fromPath: 'untitled.cifra.md', author: IDENTITY }),
      );
      await until(() => expect(online.store.slice('save')[bookId]?.status).toBe('saved'));
      const saved = online.saved().payload;
      expect(saved.path).toBe('coracao-de-estrada.cifra.md');
      expect(saved.pushed).toBe(true);
      const remoteHead = await resolveRef({ fs: online.fs, dir, ref: 'main' });
      expect(remoteHead).toBe(saved.commit);

      // Offline: clone the same remote into an OFFLINE Worker's fs (so the book
      // has a remote url), then name-and-save — the push fails, pushed: false,
      // and the local commit is kept.
      const offline = makeWorker();
      const offDir = offline.git.bookDir(bookId);
      const cloner = createGitLayer({
        fs: offline.fs,
        http: createGitHttpClient({ fetch: globalThis.fetch }),
      });
      await cloner.clone({ dir: offDir, url: remote.url });
      offline.send(command(CommandKind.WRITE, { bookId, path: 'untitled.cifra.md', text: CORACAO }));
      await settled(bookId);
      offline.send(
        command(CommandKind.NAME_AND_SAVE, { bookId, fromPath: 'untitled.cifra.md', author: IDENTITY }),
      );
      await until(() => expect(offline.store.slice('save')[bookId]?.status).toBe('saved'));
      const offSaved = offline.saved().payload;
      expect(offSaved.pushed).toBe(false);
      // The commit is durable locally despite the failed push.
      await expect(resolveRef({ fs: offline.fs, dir: offDir, ref: 'main' })).resolves.toBe(
        offSaved.commit,
      );
    } finally {
      await remote.stop();
    }
  });
});

describe('DISCARD — an unsaved draft is deleted', () => {
  it('removes a never-saved placeholder (no HEAD blob) (workflow 3 §Abandoning it L50-55)', async () => {
    const w = makeWorker();
    const dir = w.git.bookDir(MY_SONGS_ID);
    w.send(command(CommandKind.NEW_SONG, { mySongsTitle: MY_SONGS_LABEL, author: IDENTITY }));
    await until(() =>
      expect(w.events.filter((e) => e.kind === EventKind.NEW_SONG_READY)).toHaveLength(1),
    );
    w.send(command(CommandKind.WRITE, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md', text: CORACAO }));
    await settled(MY_SONGS_ID);
    await expect(w.fs.promises.stat(`${dir}/untitled.cifra.md`)).resolves.toBeTruthy();

    w.send(command(CommandKind.DISCARD, { bookId: MY_SONGS_ID, paths: ['untitled.cifra.md'] }));
    await until(() => expect(w.store.slice('save')[MY_SONGS_ID]?.status).toBe('discarded'));
    await expect(w.fs.promises.stat(`${dir}/untitled.cifra.md`)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
