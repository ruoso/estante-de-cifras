// Behavior (Worker) — leaving one shared book (books.leave; workflow 10 §Leaving
// a book, L119-130). Against a REAL git remote (startGitHttpRemote) the member
// cloned the book from, the service's `leaveBook` (DELETE
// /api/books/{id}/membership, api/openapi.yaml L668-692) faked through an
// injected `fetch` double. Drives the whole Worker through the loopback, so the
// service-first-then-device order (Constraint 1) and the shared REMOVE_BOOK
// teardown (Constraint 3) are exercised end to end.
//
// fake-indexeddb + installWebLocks + createFileSystem, the worker-behavior
// harness (online.behavior.test.js / add-by-link.behavior.test.js). Book names
// and song text are written for the test (no-song-text rule).
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
import { reduce, initialState } from './reducer.js';
import { command, event, CommandKind, EventKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';

const IDENTITY = { id: 'u_member', name: 'A Member' };
const rand = () => Math.random().toString(36).slice(2);
const FENCE = '```';
const song = (lines) => lines.join('\n') + '\n';

const SONG_PATH = 'roda.cifra.md';
const SONG_TERM = 'despedida'; // a distinctive title word to search for
const SONG = song(['# Roda da Despedida', '- artist: Trio de Teste', '## A', FENCE, 'C   G', 'oi', FENCE]);
const EDITED = song(['# Roda da Despedida', '- artist: Trio de Teste', '## A', FENCE, 'D   A', 'tchau', FENCE]);

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
    const err = [];
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${Buffer.concat(err)}`));
    });
  });
}

// Seed the empty remote with one song commit on `main`, as the owner pushed it.
async function seedRemoteWithSong(remote, scratch) {
  const work = mkdtempSync(path.join(tmpdir(), 'estante-owner-'));
  scratch.push(work);
  await run('git', ['init', '-q', '-b', 'main', work], { env: GIT_ENV });
  writeFileSync(path.join(work, SONG_PATH), SONG);
  await run('git', ['-C', work, 'add', '.'], { env: GIT_ENV });
  await run('git', ['-C', work, 'commit', '-q', '-m', 'add song'], { env: GIT_ENV });
  await run('git', ['-C', work, 'push', '-q', remote.repoDir, 'main:main'], { env: GIT_ENV });
}

// An injected `fetch`: git smart-HTTP to the REAL remote, the change-check
// stubbed empty, and `leaveBook` answered by `leave.answer` — a status, or
// 'throw' for an unreachable service. Every API call is recorded.
function routingFetch() {
  const apiCalls = [];
  const leave = { answer: 204 };
  const impl = async (url, init = {}) => {
    if (typeof url === 'string' && url.startsWith('http')) {
      return globalThis.fetch(url, init); // real git over HTTP
    }
    apiCalls.push({ url, method: init.method ?? 'GET', credentials: init.credentials });
    if (url.endsWith('/membership') && init.method === 'DELETE') {
      if (leave.answer === 'throw') throw new TypeError('Failed to fetch');
      const status = leave.answer;
      const body = status === 409 ? { code: 'owner_cannot_leave', message: 'owner' } : null;
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    }
    if (url === '/api/shelf/change-check') {
      return { ok: true, status: 200, json: async () => ({ books: [] }) };
    }
    return { ok: false, status: 404, json: async () => null };
  };
  return { impl, apiCalls, leave };
}

async function makeWorker() {
  const idb = new IDBFactory();
  const name = `leave-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
  const { impl: fetchImpl, apiCalls, leave } = routingFetch();
  const events = [];
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: fetchImpl }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  const send = (cmd) => endpoint.postMessage(cmd);
  const readHome = (file) => fs.promises.readFile(`${git.bookDir(HOME_BOOK_ID)}/${file}`, 'utf8');
  return { fs, git, events, send, apiCalls, leave, readHome };
}

const lastEvent = (events, kind) => [...events].reverse().find((e) => e.kind === kind);

// Put a member's book on this shelf the way *Mine on Estante* does (ADD_MINE —
// already a member, so no accept), and wait for the clone.
async function joinAsMember(w, remote, bookId, role = 'editor') {
  w.send(
    command(CommandKind.ADD_MINE, {
      bookId,
      gitUrl: remote.url,
      label: 'Roda de Choro',
      role,
      author: IDENTITY,
    }),
  );
  await waitFor(() => {
    expect(lastEvent(w.events, EventKind.BOOK_CLONED)?.payload.bookId).toBe(bookId);
  });
}

// One SEARCH, sent after the previous act settled; returns its rows.
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

// This book's entry in a fresh SIGN_OUT_SURVEY (the counts the Leave dialog
// reads, Decision 2) — here the witness that the unpushed save is still there.
async function surveyOf(w, bookId) {
  const mark = w.events.length;
  w.send(command(CommandKind.SURVEY_SIGN_OUT, {}));
  let entry;
  await waitFor(() => {
    const reply = w.events.slice(mark).find((e) => e.kind === EventKind.SIGN_OUT_SURVEY);
    expect(reply).toBeTruthy();
    entry = reply.payload.books.find((b) => b.id === bookId) ?? null;
  });
  return entry;
}

// Send LEAVE_BOOK and wait for its terminal reply (BOOK_LEFT / LEAVE_FAILED).
async function leaveBook(w, bookId) {
  const mark = w.events.length;
  w.send(command(CommandKind.LEAVE_BOOK, { bookId, author: IDENTITY }));
  let reply;
  await waitFor(() => {
    reply = w.events
      .slice(mark)
      .find(
        (e) =>
          (e.kind === EventKind.BOOK_LEFT || e.kind === EventKind.LEAVE_FAILED) &&
          e.payload.bookId === bookId,
      );
    expect(reply).toBeTruthy();
  });
  return { reply, after: w.events.slice(mark) };
}

const leaveCalls = (w, bookId) =>
  w.apiCalls.filter((c) => c.url === `/api/books/${bookId}/membership` && c.method === 'DELETE');

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

describe('LEAVE_BOOK (books.leave; workflow 10 §Leaving a book)', () => {
  // The torn-down state REMOVE_BOOK leaves (the shared teardown, Constraint 3):
  // the clone gone, the shelf registers tombstoned, the book out of the index.
  async function expectTornDown(w, bookId) {
    await expect(w.fs.promises.readdir(w.git.bookDir(bookId))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    const shelf = JSON.parse(await w.readHome('shelf.json'));
    for (const reg of ['label', 'link', 'position', 'role']) {
      expect(shelf.books[bookId][reg].value).toBeNull();
    }
    const results = await searchOnce(w, SONG_TERM);
    expect(results.some((r) => r.bookId === bookId)).toBe(false);
  }

  it('(a) a member’s book on the shelf: the endpoint first, then the teardown, then BOOK_LEFT (L119-125)', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const bookId = `srv-${rand()}`;
    try {
      await seedRemoteWithSong(remote, scratch);
      const w = await makeWorker();
      await joinAsMember(w, remote, bookId, 'reader');
      expect((await searchOnce(w, SONG_TERM)).some((r) => r.bookId === bookId)).toBe(true);

      const { reply, after } = await leaveBook(w, bookId);

      expect(reply.kind).toBe(EventKind.BOOK_LEFT);
      // leaveBook was called once, with the session cookie (credentials).
      expect(leaveCalls(w, bookId)).toEqual([
        { url: `/api/books/${bookId}/membership`, method: 'DELETE', credentials: 'include' },
      ]);
      // The teardown re-surfaced the shelf before the reply.
      const shelfIdx = after.findIndex((e) => e.kind === EventKind.SHELF);
      const leftIdx = after.findIndex((e) => e.kind === EventKind.BOOK_LEFT);
      expect(shelfIdx).toBeGreaterThanOrEqual(0);
      expect(shelfIdx).toBeLessThan(leftIdx);
      await expectTornDown(w, bookId);
    } finally {
      await remote.stop();
    }
  });

  it('(b) a 404 (the membership already gone) counts as left: same teardown, BOOK_LEFT (Decision 3)', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const bookId = `srv-${rand()}`;
    try {
      await seedRemoteWithSong(remote, scratch);
      const w = await makeWorker();
      await joinAsMember(w, remote, bookId);
      w.leave.answer = 404;

      const { reply } = await leaveBook(w, bookId);

      expect(reply.kind).toBe(EventKind.BOOK_LEFT);
      expect(leaveCalls(w, bookId)).toHaveLength(1);
      await expectTornDown(w, bookId);
    } finally {
      await remote.stop();
    }
  });

  it('(c) unreachable, 401 and 409 each reply LEAVE_FAILED and touch nothing local (L119-120, L128-130)', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const bookId = `srv-${rand()}`;
    let stopped = false;
    try {
      await seedRemoteWithSong(remote, scratch);
      const w = await makeWorker();
      await joinAsMember(w, remote, bookId, 'editor');
      // An unpushed save: the remote is down, so the SAVE commits but cannot push
      // (memory: an unpushed-commit fixture needs a dead remote).
      await remote.stop();
      stopped = true;
      w.send(command(CommandKind.WRITE, { bookId, path: SONG_PATH, text: EDITED }));
      w.send(
        command(CommandKind.SAVE, { bookId, paths: [SONG_PATH], message: 'Change the key', author: IDENTITY }),
      );
      await waitFor(() => {
        expect(lastEvent(w.events, EventKind.SAVED)?.payload.bookId).toBe(bookId);
      });
      const before = await surveyOf(w, bookId);
      expect(before.savesWaiting).toBe(1);
      const shelfBefore = JSON.parse(await w.readHome('shelf.json')).books[bookId];

      for (const [answer, reason] of [
        ['throw', 'network'],
        [401, 'refused'],
        [409, 'refused'],
      ]) {
        w.leave.answer = answer;
        const { reply, after } = await leaveBook(w, bookId);
        expect(reply).toMatchObject({ kind: EventKind.LEAVE_FAILED, payload: { bookId, reason } });
        // Nothing was torn down: no shelf re-surface, no index drop, no BOOK_LEFT.
        expect(after.some((e) => e.kind === EventKind.BOOK_LEFT)).toBe(false);
        expect(after.some((e) => e.kind === EventKind.SHELF)).toBe(false);

        // The clone, its working copy and the unpushed commit are as they were…
        const text = await w.fs.promises.readFile(`${w.git.bookDir(bookId)}/${SONG_PATH}`, 'utf8');
        expect(text).toContain('tchau');
        expect((await surveyOf(w, bookId)).savesWaiting).toBe(before.savesWaiting);
        // …and so is the shelf entry and the book's place in the index.
        expect(JSON.parse(await w.readHome('shelf.json')).books[bookId]).toEqual(shelfBefore);
        expect((await searchOnce(w, SONG_TERM)).some((r) => r.bookId === bookId)).toBe(true);
      }
      expect(leaveCalls(w, bookId)).toHaveLength(3);
    } finally {
      if (!stopped) await remote.stop();
    }
  });

  it('(d) a book not on this shelf (Mine on Estante): the endpoint, BOOK_LEFT, nothing local touched', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const onShelf = `srv-${rand()}`;
    const offShelf = `srv-${rand()}`;
    try {
      await seedRemoteWithSong(remote, scratch);
      const w = await makeWorker();
      await joinAsMember(w, remote, onShelf);
      const shelfBefore = await w.readHome('shelf.json');

      const { reply, after } = await leaveBook(w, offShelf);

      expect(reply.kind).toBe(EventKind.BOOK_LEFT);
      expect(leaveCalls(w, offShelf)).toHaveLength(1);
      // No teardown ran: no shelf write, no re-surface, the other book untouched.
      expect(after.some((e) => e.kind === EventKind.SHELF)).toBe(false);
      expect(await w.readHome('shelf.json')).toBe(shelfBefore);
      expect(JSON.parse(shelfBefore).books[offShelf]).toBeUndefined();
      await expect(w.fs.promises.readdir(w.git.bookDir(onShelf))).resolves.toBeTruthy();
    } finally {
      await remote.stop();
    }
  });
});

describe('BOOK_LEFT fold (books.leave Decision 4)', () => {
  it('(e) drops the left book from the mine slice, and only that slice moves', () => {
    const mine = {
      status: 'ready',
      books: [
        { id: 'srv-a', label: 'Roda de Choro', gitUrl: 'u-a', role: 'reader' },
        { id: 'srv-b', label: 'Banda do Bairro', gitUrl: 'u-b', role: 'editor' },
      ],
    };
    const state = { ...initialState, mine };

    const next = reduce(state, event(EventKind.BOOK_LEFT, { bookId: 'srv-a' }));

    expect(next.mine).toEqual({ status: 'ready', books: [mine.books[1]] });
    expect(next.shelf).toBe(state.shelf);
    expect(next.sync).toBe(state.sync);
    // A book not in the list leaves the state untouched.
    expect(reduce(next, event(EventKind.BOOK_LEFT, { bookId: 'srv-z' }))).toBe(next);
  });
});
