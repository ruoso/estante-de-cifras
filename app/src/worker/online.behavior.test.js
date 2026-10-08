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
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getConfig, resolveRef } from 'isomorphic-git';

import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { readZip } from './book-zip.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';

const IDENTITY = { id: 'u_tester', name: 'A Tester' };
const rand = () => Math.random().toString(36).slice(2);

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
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: fetchImpl }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  const send = (cmd) => endpoint.postMessage(cmd);
  const readHome = (file) => fs.promises.readFile(`${git.bookDir(HOME_BOOK_ID)}/${file}`, 'utf8');
  return { idb, name, fs, git, locks, deviceId, events, send, apiCalls, readHome };
}

const lastEvent = (events, kind) => [...events].reverse().find((e) => e.kind === kind);

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
