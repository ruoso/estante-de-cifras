// behavior (account.leaving; workflow 17 §cascade device-teardown / §Offline;
// DIRECTION §3.2/§3.7) — the Worker's LEAVE_ESTANTE teardown driven through its
// real collaborators: a fake-indexeddb, real git over a loopback git-HTTP remote,
// and web-locks. The view level (the delete dialog) is covered in
// LeaveDialogs.behavior.test.jsx; this pins the Worker command the §3.7 boundary
// puts here.
//
// LEAVE_ESTANTE runs after DELETE /api/account's 204 (so no network is needed): it
// drops every clone — the account's shared books, this device's local books AND
// the home book — clears the index, and re-surfaces an empty, first-run shelf.
// Unlike SIGN_OUT it keeps nothing, so the device returns to not-signed-in. The
// take-your-data-out DOWNLOAD_BOOK is proven to yield a zip with the network down.
// Song text is written for the test (no-song-text rule).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { parse as realParse } from 'cifra-md';

import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { HOME_BOOK_ID } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';

const IDENTITY = { id: 'u_tester', name: 'A Tester' };
const rand = () => Math.random().toString(36).slice(2);
const FENCE = '```';
const song = (lines) => lines.join('\n') + '\n';

// A routing `fetch`: real git over absolute http:// URLs, a fake /api/books +
// change-check contract, and an `offline()` switch that makes every network call
// throw — to prove the leave teardown and a data-out download need no network.
function routingFetch({ newRemote, isOffline }) {
  const remoteByService = new Map();
  const impl = async (url, init = {}) => {
    if (isOffline()) throw new Error('offline');
    if (typeof url === 'string' && url.startsWith('http')) return globalThis.fetch(url, init);
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
  return { impl, remoteByService };
}

function makeWorker({ newRemote, isOffline }) {
  const idb = new IDBFactory();
  const name = `leave-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const { impl: fetchImpl, remoteByService } = routingFetch({ newRemote, isOffline });
  const events = [];
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: fetchImpl, parse: realParse }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  const send = (cmd) => endpoint.postMessage(cmd);
  return { idb, name, fs, git, events, send, remoteByService };
}

const lastEvent = (events, kind) => [...events].reverse().find((e) => e.kind === kind);
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

async function sharedBookWithUnsavedSong(w, title, term) {
  const localId = await createLocalBook(w, title);
  w.send(command(CommandKind.OPEN));
  await waitFor(() => expect(w.events.some((e) => e.kind === EventKind.READY)).toBe(true));
  const path = `${term}.cifra.md`;
  const text = song([`# ${term}`, '- artist: Trio de Teste', '## A', FENCE, 'C   G', 'ai', FENCE]);
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
  for (const r of remotes) {
    try {
      await r.stop();
    } catch {
      // already stopped
    }
  }
});

describe('LEAVE_ESTANTE (workflow 17 §cascade device-teardown)', () => {
  it('drops the shared book, the local book AND the home book, clears the index, and surfaces an empty shelf', async () => {
    const w = makeWorker({ newRemote, isOffline: () => offline });
    const shared = await sharedBookWithUnsavedSong(w, 'Banda do Bairro', 'bairro');
    const local = await createLocalBook(w, 'Só aqui');

    // The home book exists after provisioning (preferences/shelf live there).
    await expect(w.fs.promises.readdir(w.git.bookDir(HOME_BOOK_ID))).resolves.toContain('.git');

    w.send(command(CommandKind.LEAVE_ESTANTE, {}));
    await waitFor(() => expect(lastEvent(w.events, EventKind.LEFT_ESTANTE)).toBeTruthy());

    // Every clone is gone from the device — the account's shared book, the local
    // book, and the home book itself (sign-out keeps the last; leaving removes it).
    await expect(w.fs.promises.readdir(w.git.bookDir(shared))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(w.fs.promises.readdir(w.git.bookDir(local))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(w.fs.promises.readdir(w.git.bookDir(HOME_BOOK_ID))).rejects.toMatchObject({ code: 'ENOENT' });

    // The index entries are dropped (INDEX_STATUS null per removed book).
    const cleared = w.events
      .filter((e) => e.kind === EventKind.INDEX_STATUS && e.payload.state === null)
      .map((e) => e.payload.bookId);
    expect(cleared).toEqual(expect.arrayContaining([shared, local]));

    // The re-surfaced shelf is empty — first-run, not-signed-in.
    const shelf = lastEvent(w.events, EventKind.SHELF).payload;
    const liveShared = Object.values(shelf.books ?? {}).filter((b) => b?.label?.value != null);
    const liveLocal = Object.values(shelf.local ?? {}).flatMap((ns) =>
      Object.values(ns ?? {}).filter((b) => b?.title?.value != null),
    );
    expect(liveShared).toHaveLength(0);
    expect(liveLocal).toHaveLength(0);

    // The reply precedes the shelf re-surface (the mounted-listener ordering).
    const leftIdx = w.events.findIndex((e) => e.kind === EventKind.LEFT_ESTANTE);
    const shelfIdx = w.events.map((e) => e.kind).lastIndexOf(EventKind.SHELF);
    expect(leftIdx).toBeLessThan(shelfIdx);
  });
});

describe('Take your data out offline (workflow 17 §Offline)', () => {
  it('DOWNLOAD_BOOK yields a per-book zip with the network down', async () => {
    const w = makeWorker({ newRemote, isOffline: () => offline });
    const shared = await sharedBookWithUnsavedSong(w, 'Banda do Bairro', 'bairro');

    offline = true; // every /api and git call now throws
    const mark = w.events.length;
    w.send(command(CommandKind.DOWNLOAD_BOOK, { bookId: shared }));
    await waitFor(() => {
      const ev = w.events
        .slice(mark)
        .find((e) => e.kind === EventKind.BOOK_DOWNLOAD && e.payload.bookId === shared);
      expect(ev).toBeTruthy();
      expect(ev.payload.bytes.length).toBeGreaterThan(0);
    });
  });
});
