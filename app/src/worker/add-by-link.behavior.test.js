// Behavior (Worker) — join a shared book by its invitation (books.add_by_link,
// workflow 1 §Invited). Against a REAL git remote (startGitHttpRemote) seeded
// with a purpose-written song, the `/api/invitations/{token}/accept` call faked
// through an injected `fetch` double. Drives the whole Worker through the
// loopback, so the accept → clone → shelf-register write → index → BOOK_CLONED
// path (logic.js ADD_BY_LINK, add-by-link.js) is exercised end to end, like
// online.behavior.test.js is for put-online.
//
// Pins: the accept contract (openapi.yaml L548-573) and its four refusals; the
// granted role written on the shelf (reader/editor, never chosen); the
// online_reindex obligation (a freshly cloned book is findable at once,
// books.online); and the account-first gate (a 401 writes nothing, Decision 2).
//
// fake-indexeddb + installWebLocks + createFileSystem, the worker-behavior
// harness. Book names and song text are written for the test (no-song-text rule).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';

const IDENTITY = { id: 'u_joiner', name: 'A Joiner' };
const rand = () => Math.random().toString(36).slice(2);
const FENCE = '```';
const song = (lines) => lines.join('\n') + '\n';

const SONG_PATH = 'cancao.cifra.md';
const SONG_TERM = 'convite'; // a distinctive title word to search for
const SONG = song(['# Canção do Convite', '- artist: Trio de Teste', '## A', FENCE, 'C   G', 'oi', FENCE]);

const GIT_ENV = {
  PATH: process.env.PATH,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Owner',
  GIT_AUTHOR_EMAIL: 'owner@example.invalid',
  GIT_COMMITTER_NAME: 'Owner',
  GIT_COMMITTER_EMAIL: 'owner@example.invalid',
  GIT_AUTHOR_DATE: '2021-01-01T00:00:00Z',
  GIT_COMMITTER_DATE: '2021-01-01T00:00:00Z',
};

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

// Seed the empty remote with one song commit on `main`, as an owner would have
// pushed it — so the Worker's clone brings a findable song.
async function seedRemoteWithSong(remote, scratch) {
  const work = mkdtempSync(path.join(tmpdir(), 'estante-owner-'));
  scratch.push(work);
  const env = GIT_ENV;
  await run('git', ['init', '-q', '-b', 'main', work], { env });
  writeFileSync(path.join(work, SONG_PATH), SONG);
  await run('git', ['-C', work, 'add', '.'], { env });
  await run('git', ['-C', work, 'commit', '-q', '-m', 'add song'], { env });
  await run('git', ['-C', work, 'push', '-q', remote.repoDir, 'main:main'], { env });
}

// An injected `fetch` that routes git smart-HTTP (absolute `http://…` URLs) to
// the REAL loopback remote and serves the accept contract from `onAccept(token)`,
// which returns `{ status, body }`. The change-check is stubbed empty so the sync
// scheduler's trigger has nothing to do.
function routingFetch(onAccept) {
  const apiCalls = [];
  const impl = async (url, init = {}) => {
    if (typeof url === 'string' && url.startsWith('http')) {
      return globalThis.fetch(url, init); // real git over HTTP
    }
    apiCalls.push({ url, method: init.method ?? 'GET' });
    if (url.startsWith('/api/invitations/') && url.endsWith('/accept') && init.method === 'POST') {
      const token = decodeURIComponent(url.slice('/api/invitations/'.length, -'/accept'.length));
      const r = onAccept(token);
      const status = r.status ?? 200;
      return { ok: status >= 200 && status < 300, status, json: async () => r.body ?? null };
    }
    if (url === '/api/shelf/change-check') {
      return { ok: true, status: 200, json: async () => ({ books: [] }) };
    }
    return { ok: false, status: 404, json: async () => null };
  };
  return { impl, apiCalls };
}

async function makeWorker(onAccept) {
  const idb = new IDBFactory();
  const name = `addlink-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  const deviceId = await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
  const { impl: fetchImpl, apiCalls } = routingFetch(onAccept);
  const events = [];
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: fetchImpl }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  const send = (cmd) => endpoint.postMessage(cmd);
  const readHome = (file) => fs.promises.readFile(`${git.bookDir(HOME_BOOK_ID)}/${file}`, 'utf8');
  return { idb, name, fs, git, locks, deviceId, events, send, apiCalls, readHome };
}

// Send ADD_BY_LINK and wait for a terminal event (cloned / needs-account /
// refused), returning it. The accept path does a real clone over HTTP, so the
// wait gets the budget the other real-git worker tests use (CLONE_WAIT), not
// waitFor's 1s default, which a loaded full-suite run can outlast.
const CLONE_WAIT = { timeout: 8000 };
async function addByLink(w, token) {
  const mark = w.events.length;
  w.send(command(CommandKind.ADD_BY_LINK, { token, author: IDENTITY }));
  let terminal;
  await waitFor(() => {
    terminal = w.events
      .slice(mark)
      .find(
        (e) =>
          e.kind === EventKind.BOOK_CLONED ||
          e.kind === EventKind.NEED_ACCOUNT ||
          e.kind === EventKind.BOOK_REFUSED,
      );
    expect(terminal).toBeTruthy();
  }, CLONE_WAIT);
  return terminal;
}

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

const bookOf = (role, serviceId, gitUrl) => ({
  id: serviceId,
  title: 'Choros da Ana',
  role,
  visibility: 'private',
  gitUrl,
});

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

describe('add by link (books.add_by_link, workflow 1 §Invited)', () => {
  it('an editor accept clones into bookDir(serviceId), writes role: editor, indexes, and emits BOOK_CLONED', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      await seedRemoteWithSong(remote, scratch);
      const w = await makeWorker(() => ({ status: 200, body: bookOf('editor', serviceId, remote.url) }));

      const terminal = await addByLink(w, 'tok-editor');
      expect(terminal.kind).toBe(EventKind.BOOK_CLONED);
      expect(terminal.payload.bookId).toBe(serviceId);

      // The accept endpoint was called for this token.
      expect(
        w.apiCalls.some(
          (c) => c.url === '/api/invitations/tok-editor/accept' && c.method === 'POST',
        ),
      ).toBe(true);

      // The repository cloned into bookDir(serviceId), song and all.
      const files = await w.fs.promises.readdir(w.git.bookDir(serviceId));
      expect(files).toContain(SONG_PATH);

      // The shelf carries the hosted entry with the GRANTED role (editor), the
      // book's title as its label and the clone URL as its link.
      const shelf = JSON.parse(await w.readHome('shelf.json'));
      expect(shelf.books[serviceId].role.value).toBe('editor');
      expect(shelf.books[serviceId].label.value).toBe('Choros da Ana');
      expect(shelf.books[serviceId].link.value).toBe(remote.url);

      // Indexed before BOOK_CLONED: search finds the seeded song at once.
      const results = await searchOnce(w, SONG_TERM);
      expect(results.some((r) => r.bookId === serviceId && r.path === SONG_PATH)).toBe(true);
    } finally {
      await remote.stop();
    }
  });

  it('a reader accept writes role: reader', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      await seedRemoteWithSong(remote, scratch);
      const w = await makeWorker(() => ({ status: 200, body: bookOf('reader', serviceId, remote.url) }));

      const terminal = await addByLink(w, 'tok-reader');
      expect(terminal.kind).toBe(EventKind.BOOK_CLONED);

      const shelf = JSON.parse(await w.readHome('shelf.json'));
      expect(shelf.books[serviceId].role.value).toBe('reader');
    } finally {
      await remote.stop();
    }
  });

  it('a 401 emits NEED_ACCOUNT and writes no shelf entry, no clone (the account-first gate, Decision 2)', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      const w = await makeWorker(() => ({ status: 401 }));

      const terminal = await addByLink(w, 'tok-401');
      expect(terminal.kind).toBe(EventKind.NEED_ACCOUNT);
      expect(terminal.payload.token).toBe('tok-401');

      // Nothing on the shelf, nothing on disk.
      const shelf = JSON.parse(await w.readHome('shelf.json').catch(() => '{}'));
      expect(shelf.books?.[serviceId]).toBeUndefined();
      await expect(w.fs.promises.readdir(w.git.bookDir(serviceId))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      await remote.stop();
    }
  });

  it('a 409 book_full emits BOOK_REFUSED reason "full" and leaves the shelf unchanged', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    try {
      const w = await makeWorker(() => ({ status: 409, body: { code: 'book_full' } }));
      const terminal = await addByLink(w, 'tok-full');
      expect(terminal.kind).toBe(EventKind.BOOK_REFUSED);
      expect(terminal.payload.reason).toBe('full');

      const shelf = JSON.parse(await w.readHome('shelf.json').catch(() => '{}'));
      expect(Object.keys(shelf.books ?? {})).toHaveLength(0);
    } finally {
      await remote.stop();
    }
  });

  it('a withdrawn invitation (409) and an unknown/non-member (404) both refuse with reason "dead"', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    try {
      const withdrawn = await makeWorker(() => ({
        status: 409,
        body: { code: 'invitation_withdrawn' },
      }));
      expect((await addByLink(withdrawn, 'tok-withdrawn')).payload.reason).toBe('dead');

      const notFound = await makeWorker(() => ({ status: 404 }));
      const t = await addByLink(notFound, 'tok-404');
      expect(t.kind).toBe(EventKind.BOOK_REFUSED);
      expect(t.payload.reason).toBe('dead');
    } finally {
      await remote.stop();
    }
  });
});
