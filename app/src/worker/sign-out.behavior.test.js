// behavior (account.sign_out; workflow 13 §Signing out,
// docs/workflows/13-new-device.md:82-88; DIRECTION §3.2/§3.7) — the Worker's
// sign-out survey and teardown driven through its real collaborators: a
// fake-indexeddb, real git over a loopback git-HTTP remote, and web-locks. The
// view level (the dialog) is covered in AccountScreen.behavior.test.jsx; this
// pins the Worker commands the §3.7 boundary puts here.
//
// SURVEY_SIGN_OUT counts this device's local-only work (saves not yet pushed via
// countCommitsAhead, unsaved songs via the index) and flags the books only on
// this device. SIGN_OUT {mode:'remove'} drops every clone (shared and local) and
// tombstones the shelf; {mode:'keep'} migrates each shared book into the local
// shelf map, strips its remote (the inverse of put-online, logic.js:1506-1518),
// and leaves the already-local books. Either way the home book stays and its
// remote is stripped idempotently; the teardown completes with the network down.
// Song text is written for the test (no-song-text rule).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { add, commit, getConfig, log as gitLog } from 'isomorphic-git';
import { parse as realParse } from 'cifra-md';

import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { HOME_BOOK_ID } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { reduce, initialState } from './reducer.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { countCommitsAhead } from './sync-engine.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';

const IDENTITY = { id: 'u_tester', name: 'A Tester' };
const COMMIT_AUTHOR = { name: 'A Tester', email: 'u_tester@users.estantedecifras.app' };
const rand = () => Math.random().toString(36).slice(2);
const FENCE = '```';
const song = (lines) => lines.join('\n') + '\n';

// A routing `fetch` that sends git smart-HTTP (absolute http:// URLs) to the real
// loopback remotes and serves the /api/books + change-check contract from a fake.
// Each put-online POST spins up its own empty bare remote (the shape the service
// creates) and returns a fresh service id + that remote's URL, so several hosted
// books never collide on one repo. `offline()` makes every network call throw —
// to prove the local teardown needs no network.
function routingFetch({ newRemote, isOffline }) {
  const apiCalls = [];
  const remoteByService = new Map();
  const impl = async (url, init = {}) => {
    if (isOffline()) throw new Error('offline');
    if (typeof url === 'string' && url.startsWith('http')) {
      return globalThis.fetch(url, init); // real git over HTTP
    }
    apiCalls.push({ url, method: init.method ?? 'GET' });
    if (url === '/api/books' && init.method === 'POST') {
      const { title } = JSON.parse(init.body);
      const remote = await newRemote();
      const serviceId = `srv-${rand()}`;
      remoteByService.set(serviceId, remote);
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: serviceId,
          title,
          role: 'owner',
          visibility: 'private',
          gitUrl: remote.url,
          original: null,
        }),
      };
    }
    if (url === '/api/shelf/change-check') {
      return { ok: true, status: 200, json: async () => ({ books: [] }) };
    }
    return { ok: false, status: 404, json: async () => null };
  };
  return { impl, apiCalls, remoteByService };
}

function makeWorker({ newRemote, isOffline }) {
  const idb = new IDBFactory();
  const name = `signout-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  const { impl: fetchImpl, apiCalls, remoteByService } = routingFetch({ newRemote, isOffline });
  const events = [];
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: fetchImpl, parse: realParse }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  const send = (cmd) => endpoint.postMessage(cmd);
  const readHome = (file) => fs.promises.readFile(`${git.bookDir(HOME_BOOK_ID)}/${file}`, 'utf8');
  return { idb, name, fs, git, locks, events, send, apiCalls, remoteByService, readHome };
}

const lastEvent = (events, kind) => [...events].reverse().find((e) => e.kind === kind);
const foldState = (events) => events.reduce(reduce, initialState);
const latestResults = (events, query) =>
  [...events].reverse().find((e) => e.kind === EventKind.SEARCH_RESULTS && e.payload.query === query)
    ?.payload.results ?? null;

async function createLocalBook(w, title) {
  const mark = w.events.length;
  w.send(command(CommandKind.CREATE_BOOK, { title, author: IDENTITY }));
  let created;
  await waitFor(() => {
    created = w.events.slice(mark).find((e) => e.kind === EventKind.BOOK_CREATED);
    expect(created).toBeTruthy();
  });
  return created.payload.bookId;
}

async function putOnline(w, localId) {
  w.send(command(CommandKind.PUT_ONLINE, { bookId: localId, author: IDENTITY }));
  let online;
  await waitFor(() => {
    online = [...w.events]
      .reverse()
      .find((e) => e.kind === EventKind.BOOK_ONLINE && e.payload.previousBookId === localId);
    expect(online).toBeTruthy();
  });
  return online.payload.bookId;
}

// Create a local book, bring the Worker up (building its index), WRITE a
// purpose-written song (left unsaved — a working change, no commit), then put it
// online. The relocated serviceId tree keeps the unsaved flag. Returns the
// service id. Leaves one unsaved song on the hosted book.
async function sharedBookWithUnsavedSong(w, title, term) {
  const localId = await createLocalBook(w, title);
  w.send(command(CommandKind.OPEN));
  await waitFor(() => expect(foldState(w.events).index[localId]).toBe('ready'));
  const path = `${term}.cifra.md`;
  const text = song([`# ${term} fundo`, '- artist: Trio de Teste', `## A`, FENCE, 'C   G', 'ai', FENCE]);
  w.send(command(CommandKind.WRITE, { bookId: localId, path, text }));
  await waitFor(() => {
    w.send(command(CommandKind.SEARCH, { query: term }));
    const hit = (latestResults(w.events, term) ?? []).some((r) => r.bookId === localId);
    expect(hit).toBe(true);
  });
  return putOnline(w, localId);
}

let restoreLocks;
let remotes;
let offline;
const newRemote = async () => {
  const r = await startGitHttpRemote({ seed: false });
  remotes.push(r);
  return r;
};
beforeEach(() => {
  restoreLocks = installWebLocks();
  remotes = [];
  offline = false;
});
afterEach(async () => {
  restoreLocks();
  for (const r of remotes) await r.stop();
});

describe('SURVEY_SIGN_OUT (workflow 13 §Signing out)', () => {
  it('counts saves not pushed, unsaved songs and the only-here flag per book', async () => {
    const w = makeWorker({ newRemote, isOffline: () => offline });

    // A plain hosted book in step (pushed, clean).
    const inStep = await putOnline(w, await createLocalBook(w, 'Em dia'));

    // A dirty-working hosted book: one song written but not saved.
    const dirty = await sharedBookWithUnsavedSong(w, 'Rascunho hospedado', 'mergulho');

    // A hosted book with a local commit not yet pushed. Stop its remote right
    // after put-online so no sync pass can push the extra commit — it stays ahead.
    const unpushed = await putOnline(w, await createLocalBook(w, 'Com gravação'));
    await w.remoteByService.get(unpushed).stop();
    const unpushedDir = w.git.bookDir(unpushed);
    await w.fs.promises.writeFile(`${unpushedDir}/nova.cifra.md`, song(['# Nova', '## A', FENCE, 'C', FENCE]));
    await add({ fs: w.fs, dir: unpushedDir, filepath: 'nova.cifra.md' });
    await commit({ fs: w.fs, dir: unpushedDir, message: 'Gravação local', author: COMMIT_AUTHOR });
    expect(await countCommitsAhead({ fs: w.fs, dir: unpushedDir })).toBe(1);

    // A purely-local book, never put online.
    const local = await createLocalBook(w, 'Só aqui');

    w.send(command(CommandKind.SURVEY_SIGN_OUT, {}));
    await waitFor(() => expect(lastEvent(w.events, EventKind.SIGN_OUT_SURVEY)).toBeTruthy());
    const { books } = lastEvent(w.events, EventKind.SIGN_OUT_SURVEY).payload;
    const byId = Object.fromEntries(books.map((b) => [b.id, b]));

    expect(byId[inStep]).toMatchObject({ kind: 'shared', onEstante: true, savesWaiting: 0, unsavedSongs: 0 });
    expect(byId[dirty]).toMatchObject({ kind: 'shared', onEstante: true, savesWaiting: 0, unsavedSongs: 1 });
    expect(byId[unpushed]).toMatchObject({ kind: 'shared', onEstante: true, savesWaiting: 1 });
    expect(byId[local]).toMatchObject({ kind: 'local', onEstante: false, savesWaiting: 0 });
  });
});

describe('SIGN_OUT remove (Decision 1)', () => {
  it('drops every clone, tombstones the shelf and clears the index', async () => {
    const w = makeWorker({ newRemote, isOffline: () => offline });
    const shared = await sharedBookWithUnsavedSong(w, 'Hospedado', 'estrada');
    const local = await createLocalBook(w, 'Local');

    w.send(command(CommandKind.SIGN_OUT, { mode: 'remove', author: IDENTITY }));
    await waitFor(() => expect(lastEvent(w.events, EventKind.SIGNED_OUT)?.payload.mode).toBe('remove'));

    // Both clones are gone from the device.
    await expect(w.fs.promises.readdir(w.git.bookDir(shared))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(w.fs.promises.readdir(w.git.bookDir(local))).rejects.toMatchObject({ code: 'ENOENT' });

    // The shelf registers are tombstoned (the rows drop); the home book stays.
    const shelf = foldState(w.events).shelf;
    expect(shelf.books[shared].label.value).toBeNull();
    expect(shelf.local[local].title.value).toBeNull();

    // The index entries are dropped (INDEX_STATUS null emitted per removed book).
    const cleared = w.events.filter(
      (e) => e.kind === EventKind.INDEX_STATUS && e.payload.state === null,
    );
    expect(cleared.map((e) => e.payload.bookId)).toEqual(expect.arrayContaining([shared, local]));
  });
});

describe('SIGN_OUT keep (Decision 3 — the put-online inverse)', () => {
  it('migrates each shared book into the local shelf, stripping its remote, keeping its work', async () => {
    const w = makeWorker({ newRemote, isOffline: () => offline });
    const shared = await sharedBookWithUnsavedSong(w, 'Banda do Bairro', 'bairro');
    const local = await createLocalBook(w, 'Já local');
    const sharedDir = w.git.bookDir(shared);
    const historyBefore = (await gitLog({ fs: w.fs, dir: sharedDir, ref: 'main' })).length;

    w.send(command(CommandKind.SIGN_OUT, { mode: 'keep', author: IDENTITY }));
    await waitFor(() => expect(lastEvent(w.events, EventKind.SIGNED_OUT)?.payload.mode).toBe('keep'));

    const shelf = foldState(w.events).shelf;
    // The hosted register is tombstoned and a local register written (label → title).
    expect(shelf.books[shared].label.value).toBeNull();
    expect(shelf.local[shared].title.value).toBe('Banda do Bairro');
    // The already-local book is untouched.
    expect(shelf.local[local].title.value).toBe('Já local');

    // The git remote is stripped (a later SYNC is a no-op with no origin)…
    expect(await getConfig({ fs: w.fs, dir: sharedDir, path: 'remote.origin.url' })).toBeUndefined();
    // …while the working copy and the full history stay in place.
    expect((await gitLog({ fs: w.fs, dir: sharedDir, ref: 'main' })).length).toBe(historyBefore);
    await expect(w.fs.promises.readdir(sharedDir)).resolves.toContain('.git');

    // The home book stays; its remote is stripped idempotently (none to begin with).
    expect(
      await getConfig({ fs: w.fs, dir: w.git.bookDir(HOME_BOOK_ID), path: 'remote.origin.url' }),
    ).toBeUndefined();
  });
});

describe('SIGN_OUT offline (Constraint 3, Decision 4)', () => {
  it('completes the local teardown with the network down', async () => {
    const w = makeWorker({ newRemote, isOffline: () => offline });
    const local = await createLocalBook(w, 'Sem rede');

    offline = true; // every /api and git call now throws
    w.send(command(CommandKind.SIGN_OUT, { mode: 'remove', author: IDENTITY }));
    await waitFor(() => expect(lastEvent(w.events, EventKind.SIGNED_OUT)?.payload.mode).toBe('remove'));

    await expect(w.fs.promises.readdir(w.git.bookDir(local))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(foldState(w.events).shelf.local[local].title.value).toBeNull();
  });
});
