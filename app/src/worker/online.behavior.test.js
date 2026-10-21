// Behavior (Worker) — put online / download / remove / delete (books.online,
// workflow 7 L46-63, L128-137). Against a REAL git remote (startGitHttpRemote),
// the `/api/books` calls faked through an injected `fetch` double, the
// push/merge over the real remote (the refinement's online.behavior.test
// clause). Drives the whole Worker through the loopback, so the shelf-register
// migration (logic.js) is exercised alongside the git/fs mechanics (online.js).
//
// fake-indexeddb + installWebLocks + createFileSystem, the worker-behavior
// harness (books.behavior.test.js / sync-engine.behavior.test.js). Book names
// and song text are written for the test (no-song-text rule).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getConfig, resolveRef } from 'isomorphic-git';
import { parse as realParse } from 'cifra-md';

import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { reduce, initialState } from './reducer.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { readZip } from './book-zip.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';

const IDENTITY = { id: 'u_tester', name: 'A Tester' };
const rand = () => Math.random().toString(36).slice(2);
const FENCE = '```';
const song = (lines) => lines.join('\n') + '\n';

// Run a host command, resolving stdout (used to drive the `git` CLI against the
// real remote and an unpacked download).
function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out).toString('utf8'));
      else reject(new Error(`${cmd} exited ${code}: ${Buffer.concat(err)}`));
    });
  });
}

const remoteHead = (repoDir) =>
  run('git', ['--git-dir', repoDir, 'rev-parse', 'refs/heads/main']).then((s) => s.trim());

// An injected `fetch` that routes git smart-HTTP (absolute `http://…` URLs) to
// the REAL loopback remote and serves the `/api/books` + change-check contract
// from a fake, recording the API calls. The service create returns a Book whose
// `gitUrl` is the real remote's URL, so the Worker pushes the first commit to it.
function routingFetch(remote, serviceId) {
  const apiCalls = [];
  const impl = async (url, init = {}) => {
    if (typeof url === 'string' && url.startsWith('http')) {
      return globalThis.fetch(url, init); // real git over HTTP
    }
    apiCalls.push({ url, method: init.method ?? 'GET' });
    if (url === '/api/books' && init.method === 'POST') {
      const { title } = JSON.parse(init.body);
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
    if (url.startsWith('/api/books/') && init.method === 'DELETE') {
      return { ok: true, status: 204, json: async () => null };
    }
    if (url === '/api/shelf/change-check') {
      return { ok: true, status: 200, json: async () => ({ books: [] }) };
    }
    return { ok: false, status: 404, json: async () => null };
  };
  return { impl, apiCalls };
}

async function makeWorker(remote, serviceId) {
  const idb = new IDBFactory();
  const name = `online-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  const deviceId = await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
  const { impl: fetchImpl, apiCalls } = routingFetch(remote, serviceId);
  const events = [];
  // A parse spy proves content-addressing survives the put-online rename: the
  // relocated serviceId tree is re-indexed without re-parsing a carried-over
  // song (books.online_reindex Decision 2). Wrapping the real cifra-md parse
  // keeps the Worker's behavior identical.
  const parseSpy = vi.fn(realParse);
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: fetchImpl, parse: parseSpy }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  const send = (cmd) => endpoint.postMessage(cmd);
  const readHome = (file) => fs.promises.readFile(`${git.bookDir(HOME_BOOK_ID)}/${file}`, 'utf8');
  return { idb, name, fs, git, locks, deviceId, events, send, apiCalls, readHome, parseSpy };
}

// A second Worker over the same backing store (`idb`/`name`, and so the same
// lightning-fs and `meta` store) — a "restart" of the device.
function restartWorker(w, remote, serviceId) {
  const { impl: fetchImpl } = routingFetch(remote, serviceId);
  const events = [];
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: w.idb, name: w.name, fetch: fetchImpl }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  return { events, send: (cmd) => endpoint.postMessage(cmd) };
}

const lastEvent = (events, kind) => [...events].reverse().find((e) => e.kind === kind);

// Fold the collected port events through the real reducer to read a slice the
// main-thread store would hold (the online worker drives raw events, not a
// store). Used to read the `index` build-status slice after a handler.
const foldState = (events) => events.reduce(reduce, initialState);

const latestResults = (events, query) =>
  [...events].reverse().find((e) => e.kind === EventKind.SEARCH_RESULTS && e.payload.query === query)
    ?.payload.results ?? null;

// Send one SEARCH after a handler has settled (we have already awaited its
// terminal event, so no concurrent write can race) and return its reply's rows.
// The index never crosses the port; only the ranked rows do.
async function searchOnce(w, query) {
  const mark = w.events.length;
  w.send(command(CommandKind.SEARCH, { query }));
  let results;
  await waitFor(() => {
    const hit = w.events
      .slice(mark)
      .find((e) => e.kind === EventKind.SEARCH_RESULTS && e.payload.query === query);
    expect(hit).toBeTruthy();
    results = hit.payload.results;
  });
  return results;
}

// Poll SEARCH until the latest reply satisfies the predicate (for the seed step,
// where the index-updating WRITE emits no event to await — the same re-send
// pattern search-index.behavior.test uses).
async function searchUntil(w, query, predicate) {
  await waitFor(() => {
    w.send(command(CommandKind.SEARCH, { query }));
    expect(predicate(latestResults(w.events, query) ?? [])).toBe(true);
  });
}

async function createLocalBook(w, title) {
  w.send(command(CommandKind.CREATE_BOOK, { title, author: IDENTITY }));
  let created;
  await waitFor(() => {
    created = lastEvent(w.events, EventKind.BOOK_CREATED);
    expect(created).toBeTruthy();
  });
  return created.payload.bookId;
}

async function putOnline(w, localId) {
  w.send(command(CommandKind.PUT_ONLINE, { bookId: localId, author: IDENTITY }));
  let online;
  await waitFor(() => {
    online = lastEvent(w.events, EventKind.BOOK_ONLINE);
    expect(online).toBeTruthy();
  });
  return online.payload;
}

let restoreLocks;
let scratch;
beforeEach(() => {
  restoreLocks = installWebLocks();
  scratch = [];
});
afterEach(() => {
  restoreLocks();
  for (const d of scratch) rmSync(d, { recursive: true, force: true });
});

describe('online (workflow 7 L46-63, L128-137)', () => {
  it('puts a device-only book online: sets the remote, pushes, migrates the shelf (L46-52)', async () => {
    const remote = await startGitHttpRemote({ seed: false }); // empty, as the service creates
    const serviceId = `srv-${rand()}`;
    try {
      const w = await makeWorker(remote, serviceId);
      const localId = await createLocalBook(w, 'Quarta à noite');
      const localHead = await resolveRef({ fs: w.fs, dir: w.git.bookDir(localId), ref: 'main' });

      const { previousBookId, bookId } = await putOnline(w, localId);
      expect(previousBookId).toBe(localId);
      expect(bookId).toBe(serviceId);

      // The POST /api/books call was made.
      expect(w.apiCalls.some((c) => c.url === '/api/books' && c.method === 'POST')).toBe(true);

      // The working copy relocated to bookDir(serviceId) with the remote set…
      const url = await getConfig({
        fs: w.fs,
        dir: w.git.bookDir(serviceId),
        path: 'remote.origin.url',
      });
      expect(url).toBe(remote.url);
      // …and the old local dir is gone.
      await expect(w.fs.promises.readdir(w.git.bookDir(localId))).rejects.toMatchObject({
        code: 'ENOENT',
      });

      // The first commit was pushed — the remote advanced to the local head.
      expect(await remoteHead(remote.repoDir)).toBe(localHead);

      // The shelf migrated: the hosted entry carries the former title and
      // role: owner; the local entry is tombstoned.
      const shelf = JSON.parse(await w.readHome('shelf.json'));
      expect(shelf.books[serviceId].label.value).toBe('Quarta à noite');
      expect(shelf.books[serviceId].role.value).toBe('owner');
      expect(shelf.books[serviceId].link.value).toBe(remote.url);
      expect(shelf.local[w.deviceId][localId].title.value).toBeNull();
    } finally {
      await remote.stop();
    }
  });

  it('surfaces a quota refusal (413) without writing anything on the device (Decision 4)', async () => {
    // A focused worker whose create always 413s (over quota). No put-online push
    // can happen, so the remote is unused here.
    const remote2 = await startGitHttpRemote({ seed: false });
    try {
      const idb = new IDBFactory();
      const name = `online-quota-${rand()}`;
      const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
      const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
      const locks = createBookLocks({ navigator });
      await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
      const events = [];
      const fetchImpl = async (url, init = {}) => {
        if (typeof url === 'string' && url.startsWith('http')) return globalThis.fetch(url, init);
        if (url === '/api/books' && init.method === 'POST') {
          return { ok: false, status: 413, json: async () => null };
        }
        if (url === '/api/shelf/change-check') return { ok: true, status: 200, json: async () => ({ books: [] }) };
        return { ok: false, status: 404, json: async () => null };
      };
      const endpoint = createLoopbackEndpoint((port) =>
        createWorkerLogic(port, { indexedDB: idb, name, fetch: fetchImpl }),
      );
      endpoint.onmessage = (ev) => events.push(ev.data);
      const send = (cmd) => endpoint.postMessage(cmd);

      send(command(CommandKind.CREATE_BOOK, { title: 'One too many', author: IDENTITY }));
      let created;
      await waitFor(() => {
        created = lastEvent(events, EventKind.BOOK_CREATED);
        expect(created).toBeTruthy();
      });
      const localId = created.payload.bookId;

      send(command(CommandKind.PUT_ONLINE, { bookId: localId, author: IDENTITY }));
      let refused;
      await waitFor(() => {
        refused = lastEvent(events, EventKind.BOOK_ONLINE_REFUSED);
        expect(refused).toBeTruthy();
      });
      expect(refused.payload).toEqual({ bookId: localId, reason: 'quota' });

      // Nothing was written: the local book still lives at its local dir with no
      // remote, and the shelf still lists it locally.
      await expect(
        getConfig({ fs, dir: git.bookDir(localId), path: 'remote.origin.url' }),
      ).resolves.toBeUndefined();
      const files = await fs.promises.readdir(git.bookDir(localId));
      expect(files).toContain('README.md');
    } finally {
      await remote2.stop();
    }
  });

  it('downloads the repository with the working tree and .git, remote stripped (L55-63)', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      const w = await makeWorker(remote, serviceId);
      const localId = await createLocalBook(w, 'A songbook');
      await putOnline(w, localId);

      // An UNSAVED change to the working copy (written, not committed).
      const dir = w.git.bookDir(serviceId);
      await w.fs.promises.writeFile(`${dir}/README.md`, '# A songbook\n\nedited but not saved\n');

      w.send(command(CommandKind.DOWNLOAD_BOOK, { bookId: serviceId }));
      let dl;
      await waitFor(() => {
        dl = lastEvent(w.events, EventKind.BOOK_DOWNLOAD);
        expect(dl).toBeTruthy();
      });
      expect(dl.payload.bookId).toBe(serviceId);
      const bytes = dl.payload.bytes;
      expect(bytes.length).toBeGreaterThan(0);

      // Unpack the zip to disk and look at it with the git CLI.
      const entries = await readZip(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      expect(entries.some((e) => e.name === 'README.md')).toBe(true);
      expect(entries.some((e) => e.name.startsWith('.git/'))).toBe(true);

      const out = mkdtempSync(path.join(tmpdir(), 'estante-dl-'));
      scratch.push(out);
      for (const entry of entries) {
        const full = path.join(out, entry.name);
        mkdirSync(path.dirname(full), { recursive: true });
        writeFileSync(full, Buffer.from(entry.bytes));
      }

      // The full history is present, the unsaved change shows as modified, and
      // the remote is gone (stripped from the zipped .git/config).
      const logOut = await run('git', ['-C', out, 'log', '--oneline']);
      expect(logOut).toContain('Create book');
      const status = await run('git', ['-C', out, 'status', '--porcelain']);
      expect(status).toMatch(/README\.md/);
      const remotes = await run('git', ['-C', out, 'remote']);
      expect(remotes.trim()).toBe('');
    } finally {
      await remote.stop();
    }
  });

  it('removes a copy from the shelf without touching the remote (L128-135)', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      const w = await makeWorker(remote, serviceId);
      const localId = await createLocalBook(w, 'Keep on Estante');
      await putOnline(w, localId);
      const headOnRemote = await remoteHead(remote.repoDir);

      w.send(command(CommandKind.REMOVE_BOOK, { bookId: serviceId, author: IDENTITY }));
      await waitFor(() => {
        expect(lastEvent(w.events, EventKind.BOOK_REMOVED)?.payload.bookId).toBe(serviceId);
      });

      // The local clone is gone and the shelf entry is tombstoned…
      await expect(w.fs.promises.readdir(w.git.bookDir(serviceId))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      const shelf = JSON.parse(await w.readHome('shelf.json'));
      expect(shelf.books[serviceId].label.value).toBeNull();
      // …but the service book is untouched: the remote still holds the commit.
      expect(await remoteHead(remote.repoDir)).toBe(headOnRemote);
    } finally {
      await remote.stop();
    }
  });

  it('deletes the book from Estante (DELETE /api/books/{id}) then removes the local clone (L136-137)', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      const w = await makeWorker(remote, serviceId);
      const localId = await createLocalBook(w, 'Delete me everywhere');
      await putOnline(w, localId);

      w.send(command(CommandKind.DELETE_BOOK, { bookId: serviceId, author: IDENTITY }));
      await waitFor(() => {
        expect(lastEvent(w.events, EventKind.BOOK_REMOVED)?.payload.bookId).toBe(serviceId);
      });

      // The delete endpoint was called for this book…
      expect(
        w.apiCalls.some((c) => c.url === `/api/books/${serviceId}` && c.method === 'DELETE'),
      ).toBe(true);
      // …and the local clone is gone, its shelf entry tombstoned.
      await expect(w.fs.promises.readdir(w.git.bookDir(serviceId))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      const shelf = JSON.parse(await w.readHome('shelf.json'));
      expect(shelf.books[serviceId].label.value).toBeNull();
    } finally {
      await remote.stop();
    }
  });
});

// Reindex on put-online / remove / delete (books.online_reindex). The Worker
// owns the search index (DIRECTION §3.7); these journeys re-key or drop a book's
// on-disk directory, and the index must follow within the live session. Song
// text is written for the test (no-song-text rule).
describe('reindex on put-online / remove / delete (books.online_reindex)', () => {
  const SONG_PATH = 'cancao.cifra.md';
  const SONG_TERM = 'mergulho'; // a distinctive title word to search for
  const SONG = song(['# Mergulho Fundo', '- artist: Trio de Teste', '## A', FENCE, 'C   G', 'oi', FENCE]);

  // Create a local book, bring the Worker up (building its index), then WRITE a
  // purpose-written song into it. After this the book has a live `ready` index
  // entry and the song is findable by SEARCH. Returns the local book id.
  async function seedIndexedLocalBook(w) {
    const localId = await createLocalBook(w, 'Para publicar');
    w.send(command(CommandKind.OPEN));
    await waitFor(() => {
      expect(foldState(w.events).index[localId]).toBe('ready');
    });
    w.send(command(CommandKind.WRITE, { bookId: localId, path: SONG_PATH, text: SONG }));
    await searchUntil(w, SONG_TERM, (rs) =>
      rs.some((r) => r.bookId === localId && r.path === SONG_PATH),
    );
    return localId;
  }

  it('put-online re-indexes under the service id, not the local id, with no re-parse', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      const w = await makeWorker(remote, serviceId);
      const localId = await seedIndexedLocalBook(w);

      // Content-addressing: record the parse count before the rename.
      const parsesBefore = w.parseSpy.mock.calls.length;
      expect(parsesBefore).toBeGreaterThan(0); // the seed song was parsed once

      const { bookId } = await putOnline(w, localId);
      expect(bookId).toBe(serviceId);

      // SEARCH now finds the song under the serviceId and NOT under the localId
      // (the note's "put-online then search finds the book by serviceId, not
      // localId"). The reindex ran before BOOK_ONLINE, so this is immediate.
      const results = await searchOnce(w, SONG_TERM);
      expect(results.some((r) => r.bookId === serviceId && r.path === SONG_PATH)).toBe(true);
      expect(results.some((r) => r.bookId === localId)).toBe(false);

      // The docs carried over by oid: the relocated tree was re-indexed with no
      // new parse (books.online_reindex Decision 2, DIRECTION §3 content-addressing).
      expect(w.parseSpy.mock.calls.length).toBe(parsesBefore);

      // The stale index build-status entry for localId is nulled; the serviceId
      // carries the live `ready` entry (Decision 4).
      const index = foldState(w.events).index;
      expect(localId in index).toBe(false);
      expect(index[serviceId]).toBe('ready');
    } finally {
      await remote.stop();
    }
  });

  // Record a recent for the seeded song (what opening it does) and wait for the
  // RECENTS that carries it.
  async function recordRecent(w, bookId) {
    w.send(command(CommandKind.RECORD_RECENT, { bookId, path: SONG_PATH }));
    await waitFor(() => {
      expect(
        lastEvent(w.events, EventKind.RECENTS)?.payload.recents.some(
          (r) => r.bookId === bookId && r.path === SONG_PATH,
        ),
      ).toBe(true);
    });
  }

  // books.put_online_no_ghosts Constraint 3 / Decision 2; workflow 2 L29-35 (a
  // recent follows its book) and workflow 7 §Putting a book online.
  it('put-online moves the book’s recents to the service id, persisted across a restart (books.put_online_no_ghosts)', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      const w = await makeWorker(remote, serviceId);
      const localId = await seedIndexedLocalBook(w);
      await recordRecent(w, localId);

      await putOnline(w, localId);

      // The last RECENTS before BOOK_ONLINE names the service id, and nothing
      // is left under the local id.
      const onlineAt = w.events.findIndex((e) => e.kind === EventKind.BOOK_ONLINE);
      const recents = lastEvent(w.events.slice(0, onlineAt), EventKind.RECENTS).payload.recents;
      expect(recents.some((r) => r.bookId === serviceId && r.path === SONG_PATH)).toBe(true);
      expect(recents.some((r) => r.bookId === localId)).toBe(false);
      // And Search lists no section for the old id.
      expect(localId in foldState(w.events).index).toBe(false);

      // Persisted in `meta`: a restart's OPEN surfaces the moved recent.
      const again = restartWorker(w, remote, serviceId);
      again.send(command(CommandKind.OPEN));
      await waitFor(() => {
        expect(lastEvent(again.events, EventKind.RECENTS)).toBeTruthy();
      });
      const reopened = lastEvent(again.events, EventKind.RECENTS).payload.recents;
      expect(reopened.map((r) => [r.bookId, r.path])).toEqual([[serviceId, SONG_PATH]]);
    } finally {
      await remote.stop();
    }
  });

  // books.put_online_no_ghosts Constraint 3; workflow 7 L252-264 (removing a
  // book) and workflow 2 L29-35.
  it('remove drops the book’s recents and its index entry', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      const w = await makeWorker(remote, serviceId);
      const localId = await seedIndexedLocalBook(w);
      const { bookId } = await putOnline(w, localId);
      await recordRecent(w, bookId);

      w.send(command(CommandKind.REMOVE_BOOK, { bookId, author: IDENTITY }));
      await waitFor(() => {
        expect(lastEvent(w.events, EventKind.BOOK_REMOVED)?.payload.bookId).toBe(bookId);
      });
      const recents = lastEvent(w.events, EventKind.RECENTS).payload.recents;
      expect(recents.some((r) => r.bookId === bookId)).toBe(false);
      expect(bookId in foldState(w.events).index).toBe(false);
    } finally {
      await remote.stop();
    }
  });

  // books.put_online_no_ghosts Constraint 3; workflow 7 L252-264 (deleting a
  // book) and workflow 2 L29-35.
  it('delete drops the book’s recents and its index entry', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      const w = await makeWorker(remote, serviceId);
      const localId = await seedIndexedLocalBook(w);
      const { bookId } = await putOnline(w, localId);
      await recordRecent(w, bookId);

      w.send(command(CommandKind.DELETE_BOOK, { bookId, author: IDENTITY }));
      await waitFor(() => {
        expect(lastEvent(w.events, EventKind.BOOK_REMOVED)?.payload.bookId).toBe(bookId);
      });
      const recents = lastEvent(w.events, EventKind.RECENTS).payload.recents;
      expect(recents.some((r) => r.bookId === bookId)).toBe(false);
      expect(bookId in foldState(w.events).index).toBe(false);
    } finally {
      await remote.stop();
    }
  });

  it('remove drops the book’s index entries', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      const w = await makeWorker(remote, serviceId);
      const localId = await seedIndexedLocalBook(w);
      const { bookId } = await putOnline(w, localId);

      // Re-confirm the song is findable under the service id before removal.
      let results = await searchOnce(w, SONG_TERM);
      expect(results.some((r) => r.bookId === bookId)).toBe(true);

      w.send(command(CommandKind.REMOVE_BOOK, { bookId, author: IDENTITY }));
      await waitFor(() => {
        expect(lastEvent(w.events, EventKind.BOOK_REMOVED)?.payload.bookId).toBe(bookId);
      });

      // SEARCH after remove returns no result for that book (the note's "remove
      // then search finds no entries for that book"), and its index slice entry
      // is not live.
      results = await searchOnce(w, SONG_TERM);
      expect(results.some((r) => r.bookId === bookId)).toBe(false);
      expect(foldState(w.events).index[bookId] ?? null).toBeNull();
    } finally {
      await remote.stop();
    }
  });

  it('delete drops the book’s index entries', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      const w = await makeWorker(remote, serviceId);
      const localId = await seedIndexedLocalBook(w);
      const { bookId } = await putOnline(w, localId);

      let results = await searchOnce(w, SONG_TERM);
      expect(results.some((r) => r.bookId === bookId)).toBe(true);

      w.send(command(CommandKind.DELETE_BOOK, { bookId, author: IDENTITY }));
      await waitFor(() => {
        expect(lastEvent(w.events, EventKind.BOOK_REMOVED)?.payload.bookId).toBe(bookId);
      });
      // The delete endpoint was called for this book.
      expect(
        w.apiCalls.some((c) => c.url === `/api/books/${bookId}` && c.method === 'DELETE'),
      ).toBe(true);

      // SEARCH after delete returns no result for that book, and its index slice
      // entry is not live.
      results = await searchOnce(w, SONG_TERM);
      expect(results.some((r) => r.bookId === bookId)).toBe(false);
      expect(foldState(w.events).index[bookId] ?? null).toBeNull();
    } finally {
      await remote.stop();
    }
  });
});
