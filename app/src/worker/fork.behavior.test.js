// Behavior (Worker) — make it my own (books.fork, workflow 11 §What a fork is).
// The whole Worker through the loopback, over a fake IndexedDB, against REAL git
// remotes served over HTTP standing in for the original and the fork, with the
// `/api/books` + invitation + change-check contract served by an injected
// `fetch` (the refinement's fork.behavior.test clause). Each case joins the
// original through ADD_BY_LINK, makes a save that cannot go up (the original's
// remote is stopped — [[unpushed-commit-fixture-needs-dead-remote]]) and an
// unsaved edit on top, then sends FORK_BOOK.
//
// Pins: workflow 11 L27-34 (the fork replaces the original, named as it was),
// L41-46 (after losing access the device puts its own copy online, following
// ended), §A fork of a fork; Constraints 2-5 and 8. Song text is written for the
// test (no-song-text rule).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveRef, log as gitLog } from 'isomorphic-git';

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

const IDENTITY = { id: 'u_bia', name: 'Bia' };
const rand = () => Math.random().toString(36).slice(2);
const FENCE = '```';
const song = (lines) => lines.join('\n') + '\n';

const TITLE = 'Choros da Ana';
const SONG_PATH = 'cancao.cifra.md';
const SONG_TERM = 'travessia'; // a distinctive title word to search for
const songWith = (chords, words) =>
  song(['# Canção da Travessia', '- artist: Trio de Teste', '## A', FENCE, chords, words, FENCE]);
const SONG = songWith('C   G', 'oi');
const SONG_SAVED = songWith('C   G7', 'oi'); // the device's save that cannot go up
const SONG_UNSAVED = songWith('C   G7', 'olá'); // an unsaved edit on top
const SAVE_NOTE = 'Bia muda o acorde';

const GIT_ENV = {
  PATH: process.env.PATH,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Ana',
  GIT_AUTHOR_EMAIL: 'ana@example.invalid',
  GIT_COMMITTER_NAME: 'Ana',
  GIT_COMMITTER_EMAIL: 'ana@example.invalid',
  GIT_AUTHOR_DATE: '2021-01-01T00:00:00Z',
  GIT_COMMITTER_DATE: '2021-01-01T00:00:00Z',
};

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: GIT_ENV, ...options, stdio: ['ignore', 'pipe', 'pipe'] });
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

const remoteHead = (remote) =>
  run('git', ['--git-dir', remote.repoDir, 'rev-parse', 'refs/heads/main']).then((s) => s.trim());
const remoteSubjects = (remote) =>
  run('git', ['--git-dir', remote.repoDir, 'log', '--format=%s', 'main']).then((s) =>
    s.trim().split('\n'),
  );
const remoteFile = (remote, file) =>
  run('git', ['--git-dir', remote.repoDir, 'show', `main:${file}`]);

// Seed an empty remote with Ana's one song commit on `main`.
async function seedOriginal(remote, scratch, extra = {}) {
  const work = mkdtempSync(path.join(tmpdir(), 'estante-ana-'));
  scratch.push(work);
  await run('git', ['init', '-q', '-b', 'main', work]);
  writeFileSync(path.join(work, SONG_PATH), SONG);
  for (const [file, text] of Object.entries(extra)) writeFileSync(path.join(work, file), text);
  await run('git', ['-C', work, 'add', '.']);
  await run('git', ['-C', work, 'commit', '-q', '-m', 'add song']);
  await run('git', ['-C', work, 'push', '-q', remote.repoDir, 'main:main']);
}

// The service's repo copy (POST /api/books/{id}/fork): the fork's bare repo
// starts as the original's server head.
async function copyRemote(from, to) {
  await run('git', ['-C', from.repoDir, 'push', '-q', to.repoDir, 'main:main']);
}

// An injected `fetch`: git smart-HTTP to the real remotes; the invitation accept,
// the fork, the create and the change-check served from `api`, recording calls.
function routingFetch(api) {
  const calls = [];
  const json = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body ?? null,
  });
  const impl = async (url, init = {}) => {
    if (typeof url === 'string' && url.startsWith('http')) return globalThis.fetch(url, init);
    const method = init.method ?? 'GET';
    calls.push({ url, method });
    if (url.startsWith('/api/invitations/') && method === 'POST') return json(200, api.accept());
    const fork = url.match(/^\/api\/books\/([^/]+)\/fork$/);
    if (fork && method === 'POST') {
      const r = await api.fork(decodeURIComponent(fork[1]));
      return json(r.status, r.body);
    }
    if (url === '/api/books' && method === 'POST') {
      const r = await api.create(JSON.parse(init.body));
      return json(r.status, r.body);
    }
    if (url === '/api/shelf/change-check') return json(200, { books: [] });
    return json(404, null);
  };
  return { impl, calls };
}

const book = (id, title, remote, role, original = null) => ({
  id,
  title,
  role,
  visibility: 'private',
  gitUrl: remote.url,
  original,
});

async function makeWorker(api) {
  const idb = new IDBFactory();
  const name = `fork-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
  const { impl, calls } = routingFetch(api);
  const events = [];
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: impl }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  const send = (cmd) => endpoint.postMessage(cmd);
  const shelf = async () =>
    JSON.parse(await fs.promises.readFile(`${git.bookDir(HOME_BOOK_ID)}/shelf.json`, 'utf8'));
  const exists = async (p) => {
    try {
      await fs.promises.stat(p);
      return true;
    } catch {
      return false;
    }
  };
  return { fs, git, events, send, calls, shelf, exists };
}

// Wait for the first event of one of `kinds` after `mark`.
async function next(w, mark, kinds, timeout = 15000) {
  let found;
  await waitFor(
    () => {
      found = w.events.slice(mark).find((e) => kinds.includes(e.kind));
      expect(found).toBeTruthy();
    },
    { timeout },
  );
  return found;
}

async function search(w, query) {
  const mark = w.events.length;
  w.send(command(CommandKind.SEARCH, { query }));
  const hit = await waitFor(() => {
    const e = w.events.slice(mark).find((x) => x.kind === EventKind.SEARCH_RESULTS && x.payload.query === query);
    expect(e).toBeTruthy();
    return e;
  });
  return hit.payload.results;
}

// Join the original (as an editor, so the device can commit), then — the
// original's remote stopped — save a change that cannot go up, and leave an
// unsaved edit on top. Returns the original's id.
async function joinSaveAndEdit(w, origId, stopOriginal) {
  let mark = w.events.length;
  w.send(command(CommandKind.ADD_BY_LINK, { token: 'tok', author: IDENTITY }));
  await next(w, mark, [EventKind.BOOK_CLONED]);
  await stopOriginal();

  w.send(command(CommandKind.WRITE, { bookId: origId, path: SONG_PATH, text: SONG_SAVED }));
  await waitFor(async () => {
    expect(await w.fs.promises.readFile(`${w.git.bookDir(origId)}/${SONG_PATH}`, 'utf8')).toBe(SONG_SAVED);
  });
  mark = w.events.length;
  w.send(command(CommandKind.SAVE, { bookId: origId, paths: [SONG_PATH], message: SAVE_NOTE, author: IDENTITY }));
  const saved = await next(w, mark, [EventKind.SAVED, EventKind.SAVE_REFUSED]);
  expect(saved.kind).toBe(EventKind.SAVED);
  // The save cannot go up; SAVED claims no push outcome either way
  // (songs.save_feedback Constraint 2).
  expect(saved.payload).not.toHaveProperty('pushed');

  w.send(command(CommandKind.WRITE, { bookId: origId, path: SONG_PATH, text: SONG_UNSAVED }));
  await waitFor(async () => {
    const results = await search(w, SONG_TERM);
    expect(results.find((r) => r.bookId === origId)?.unsaved).toBe(true);
  });
}

async function forkBook(w, bookId) {
  const mark = w.events.length;
  w.send(command(CommandKind.FORK_BOOK, { bookId, author: IDENTITY }));
  return next(w, mark, [EventKind.BOOK_FORKED, EventKind.FORK_FAILED]);
}

let restoreLocks;
let scratch;
let remotes;
beforeEach(() => {
  restoreLocks = installWebLocks();
  scratch = [];
  remotes = [];
});
afterEach(async () => {
  for (const r of remotes) await r.stop().catch(() => {});
  restoreLocks();
  for (const d of scratch) rmSync(d, { recursive: true, force: true });
});

async function startRemote() {
  const r = await startGitHttpRemote({ seed: false });
  let stopped = false;
  const handle = {
    ...r,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      await r.stop();
    },
  };
  remotes.push(handle);
  return handle;
}

describe('fork — the service copies it (workflow 11 L27-34; Constraints 2-5)', () => {
  it('carries the unsaved edit and the unpushed save into the fork, replaces the original on the shelf, moves search, marks the history', async () => {
    const original = await startRemote();
    const forkRemote = await startRemote();
    await seedOriginal(original, scratch);
    // The service's copy is the original's server head at fork time.
    await copyRemote(original, forkRemote);
    const origId = `srv-orig-${rand()}`;
    const forkId = `srv-fork-${rand()}`;
    const api = {
      accept: () => book(origId, TITLE, original, 'editor'),
      fork: async (id) => {
        expect(id).toBe(origId);
        return { status: 201, body: book(forkId, TITLE, forkRemote, 'owner', { bookId: origId, title: TITLE }) };
      },
      create: async () => ({ status: 500 }),
    };
    const w = await makeWorker(api);
    await joinSaveAndEdit(w, origId, () => original.stop());
    const before = await w.shelf();
    const origLink = before.books[origId].link.value;
    const origPosition = before.books[origId].position.value;

    const done = await forkBook(w, origId);
    expect(done.kind).toBe(EventKind.BOOK_FORKED);
    expect(done.payload).toMatchObject({ previousBookId: origId, bookId: forkId, via: 'service' });
    // The service copied it: no create.
    expect(w.calls.some((c) => c.url === '/api/books' && c.method === 'POST')).toBe(false);

    // The working copy moved, unsaved edit and all; the original's is gone.
    expect(await w.fs.promises.readFile(`${w.git.bookDir(forkId)}/${SONG_PATH}`, 'utf8')).toBe(SONG_UNSAVED);
    expect(await w.exists(w.git.bookDir(origId))).toBe(false);

    // One shelf write: the original's registers cleared, the fork's written in
    // its place with the original recorded (no goneAt — it is still followed).
    const shelf = await w.shelf();
    for (const key of ['label', 'link', 'position', 'role']) {
      expect(shelf.books[origId][key].value).toBeNull();
    }
    const entry = shelf.books[forkId];
    expect(entry.label.value).toBe(TITLE);
    expect(entry.link.value).toBe(forkRemote.url);
    expect(entry.position.value).toBe(origPosition);
    expect(entry.role.value).toBe('owner');
    expect(entry.original.value).toMatchObject({ bookId: origId, title: TITLE, link: origLink });
    expect(typeof entry.original.value.followedAt).toBe('string');
    expect(entry.original.value.goneAt).toBeUndefined();

    // Search finds the song once, under the fork's id, still marked unsaved.
    const results = (await search(w, SONG_TERM)).filter((r) => r.path === SONG_PATH);
    expect(results).toHaveLength(1);
    expect(results[0].bookId).toBe(forkId);
    expect(results[0].unsaved).toBe(true);

    // The next sync pushes to the fork: the unpushed save and the marker commit
    // reach the fork's remote; the unsaved edit stays on the device only.
    const localHead = await resolveRef({ fs: w.fs, dir: w.git.bookDir(forkId), ref: 'main' });
    await waitFor(async () => expect(await remoteHead(forkRemote)).toBe(localHead), { timeout: 15000 });
    const subjects = await remoteSubjects(forkRemote);
    expect(subjects[0]).toBe(`Made your own from ${TITLE}`);
    expect(subjects).toContain(SAVE_NOTE);
    const pushed = await remoteFile(forkRemote, SONG_PATH);
    expect(pushed).toMatch(/G7/); // the save that never reached the original
    expect(pushed).not.toMatch(/olá/); // the unsaved edit stays on the device
  }, 60000);
});

// songs.no_raw_ids Constraint 5 — the Worker never writes an id as a label: a
// hosted entry with no label forks under the book's README heading.
describe('fork — a book with no shelf label (songs.no_raw_ids Constraint 5)', () => {
  it('forks under its README heading, never the id', async () => {
    const HEADING = 'Cadernos da Turma';
    const original = await startRemote();
    const forkRemote = await startRemote();
    await seedOriginal(original, scratch, { 'README.md': `# ${HEADING}\n` });
    await copyRemote(original, forkRemote);
    const origId = `srv-orig-${rand()}`;
    const forkId = `srv-fork-${rand()}`;
    const api = {
      // The service names the book with nothing: its shelf entry has no label.
      accept: () => book(origId, '', original, 'editor'),
      fork: async () => ({ status: 201, body: book(forkId, HEADING, forkRemote, 'owner', { bookId: origId, title: HEADING }) }),
      create: async () => ({ status: 500 }),
    };
    const w = await makeWorker(api);
    const mark = w.events.length;
    w.send(command(CommandKind.ADD_BY_LINK, { token: 'tok', author: IDENTITY }));
    await next(w, mark, [EventKind.BOOK_CLONED]);
    const label = (await w.shelf()).books[origId].label?.value;
    expect(label === undefined || label === null || label === '').toBe(true);

    const done = await forkBook(w, origId);
    expect(done.kind).toBe(EventKind.BOOK_FORKED);

    const entry = (await w.shelf()).books[forkId];
    expect(entry.label.value).toBe(HEADING);
    expect(entry.label.value).not.toBe(origId);
    expect(entry.original.value.title).toBe(HEADING);
    const [marker] = await gitLog({ fs: w.fs, dir: w.git.bookDir(forkId), ref: 'main', depth: 1 });
    expect(marker.commit.message.trim()).toBe(`Made your own from ${HEADING}`);
  }, 60000);
});

describe('fork — saving where one cannot (workflow 4 §A book the user cannot push to; books.fork AC1)', () => {
  it('a reader’s unsaved edit, forked, saves in the fork and reaches its remote', async () => {
    const original = await startRemote();
    const forkRemote = await startRemote();
    await seedOriginal(original, scratch);
    await copyRemote(original, forkRemote);
    const origId = `srv-orig-${rand()}`;
    const forkId = `srv-fork-${rand()}`;
    const api = {
      accept: () => book(origId, TITLE, original, 'reader'),
      fork: async () => ({
        status: 201,
        body: book(forkId, TITLE, forkRemote, 'owner', { bookId: origId, title: TITLE }),
      }),
      create: async () => ({ status: 500 }),
    };
    const w = await makeWorker(api);
    let mark = w.events.length;
    w.send(command(CommandKind.ADD_BY_LINK, { token: 'tok', author: IDENTITY }));
    await next(w, mark, [EventKind.BOOK_CLONED]);
    w.send(command(CommandKind.WRITE, { bookId: origId, path: SONG_PATH, text: SONG_UNSAVED }));
    await waitFor(async () => {
      const results = await search(w, SONG_TERM);
      expect(results.find((r) => r.bookId === origId)?.unsaved).toBe(true);
    });

    expect((await forkBook(w, origId)).payload.bookId).toBe(forkId);
    expect(await w.fs.promises.readFile(`${w.git.bookDir(forkId)}/${SONG_PATH}`, 'utf8')).toBe(SONG_UNSAVED);
    // The marker commit moved the branch itself (refs/heads/main), not a stray
    // `.git/main` that would shadow it.
    expect(await w.exists(`${w.git.bookDir(forkId)}/.git/main`)).toBe(false);

    mark = w.events.length;
    w.send(command(CommandKind.SAVE, { bookId: forkId, paths: [SONG_PATH], message: SAVE_NOTE, author: IDENTITY }));
    const saved = await next(w, mark, [EventKind.SAVED, EventKind.SAVE_REFUSED]);
    expect(saved.kind).toBe(EventKind.SAVED);
    const localHead = await resolveRef({ fs: w.fs, dir: w.git.bookDir(forkId), ref: 'main' });
    await waitFor(async () => expect(await remoteHead(forkRemote)).toBe(localHead), { timeout: 15000 });
    expect(await remoteFile(forkRemote, SONG_PATH)).toMatch(/olá/);
    expect(await remoteFile(original, SONG_PATH)).not.toMatch(/olá/);
  }, 60000);
});

describe('fork — after losing access, the device puts its own copy online (workflow 11 L41-46; Decision 2)', () => {
  it('a 404 fork creates the book and pushes the device’s history, unpushed save included; goneAt is set', async () => {
    const original = await startRemote();
    const forkRemote = await startRemote(); // empty, as POST /api/books makes it
    await seedOriginal(original, scratch);
    const origId = `srv-orig-${rand()}`;
    const forkId = `srv-own-${rand()}`;
    const created = [];
    const api = {
      accept: () => book(origId, TITLE, original, 'editor'),
      fork: async () => ({ status: 404, body: { code: 'not_found', message: 'No such book.' } }),
      create: async (req) => {
        created.push(req);
        return { status: 201, body: book(forkId, req.title, forkRemote, 'owner') };
      },
    };
    const w = await makeWorker(api);
    await joinSaveAndEdit(w, origId, () => original.stop());

    const done = await forkBook(w, origId);
    expect(done.kind).toBe(EventKind.BOOK_FORKED);
    expect(done.payload).toMatchObject({ previousBookId: origId, bookId: forkId, via: 'own' });
    expect(created).toEqual([{ title: TITLE }]);

    // The fork holds the device's whole history — Ana's song, Bia's save that
    // never reached the original, and the marker.
    const localHead = await resolveRef({ fs: w.fs, dir: w.git.bookDir(forkId), ref: 'main' });
    await waitFor(async () => expect(await remoteHead(forkRemote)).toBe(localHead), { timeout: 15000 });
    const subjects = await remoteSubjects(forkRemote);
    expect(subjects).toEqual([`Made your own from ${TITLE}`, SAVE_NOTE, 'add song']);
    // The saved version (canonicalised on save), not the unsaved edit.
    const pushed = await remoteFile(forkRemote, SONG_PATH);
    expect(pushed).toMatch(/G7/);
    expect(pushed).not.toMatch(/olá/);
    // The unsaved edit carried over, still unsaved.
    expect(await w.fs.promises.readFile(`${w.git.bookDir(forkId)}/${SONG_PATH}`, 'utf8')).toBe(SONG_UNSAVED);

    // Following has already ended: goneAt is written at once.
    const entry = (await w.shelf()).books[forkId];
    expect(entry.original.value).toMatchObject({ bookId: origId, title: TITLE });
    expect(entry.original.value.goneAt).toBe(entry.original.value.followedAt);
  }, 60000);
});

describe('fork — refused or unreachable, nothing changes (Constraint 8)', () => {
  for (const [label, forkReply, code] of [
    ['a 413', async () => ({ status: 413, body: { code: 'too_large', message: 'Over the limit.' } }), 'quota'],
    [
      'offline',
      async () => {
        throw new TypeError('Failed to fetch');
      },
      'offline',
    ],
  ]) {
    it(`${label}: FORK_FAILED {code: ${code}}; the original's directory, shelf entry and unsaved flag are unchanged`, async () => {
      const original = await startRemote();
      await seedOriginal(original, scratch);
      const origId = `srv-orig-${rand()}`;
      const api = {
        accept: () => book(origId, TITLE, original, 'editor'),
        fork: forkReply,
        create: async () => {
          throw new Error('create must not be called');
        },
      };
      const w = await makeWorker(api);
      await joinSaveAndEdit(w, origId, () => original.stop());
      const shelfBefore = await w.shelf();
      const headBefore = await resolveRef({ fs: w.fs, dir: w.git.bookDir(origId), ref: 'main' });

      const done = await forkBook(w, origId);
      expect(done.kind).toBe(EventKind.FORK_FAILED);
      expect(done.payload).toMatchObject({ bookId: origId, code });
      expect(Object.keys(done.payload).sort()).toEqual(['bookId', 'code', 'message']);
      expect(w.calls.some((c) => c.url === '/api/books' && c.method === 'POST')).toBe(false);

      // Nothing on the device changed.
      expect(await w.fs.promises.readFile(`${w.git.bookDir(origId)}/${SONG_PATH}`, 'utf8')).toBe(SONG_UNSAVED);
      expect(await resolveRef({ fs: w.fs, dir: w.git.bookDir(origId), ref: 'main' })).toBe(headBefore);
      expect(await w.shelf()).toEqual(shelfBefore);
      const results = (await search(w, SONG_TERM)).filter((r) => r.path === SONG_PATH);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ bookId: origId, unsaved: true });
    }, 60000);
  }
});

describe('fork — a fork of a fork records its immediate parent (workflow 11 §A fork of a fork)', () => {
  it('forking a fork names the fork as the original, not the first book', async () => {
    const original = await startRemote();
    const remoteA = await startRemote();
    const remoteB = await startRemote();
    await seedOriginal(original, scratch);
    await copyRemote(original, remoteA);
    const origId = `srv-orig-${rand()}`;
    const forkA = `srv-a-${rand()}`;
    const forkB = `srv-b-${rand()}`;
    const api = {
      accept: () => book(origId, TITLE, original, 'editor'),
      fork: async (id) => {
        if (id === origId) {
          return { status: 201, body: book(forkA, TITLE, remoteA, 'owner', { bookId: origId, title: TITLE }) };
        }
        // The service copies A as it now stands.
        await copyRemote(remoteA, remoteB);
        return { status: 201, body: book(forkB, TITLE, remoteB, 'owner', { bookId: forkA, title: TITLE }) };
      },
      create: async () => ({ status: 500 }),
    };
    const w = await makeWorker(api);
    await joinSaveAndEdit(w, origId, () => original.stop());

    expect((await forkBook(w, origId)).payload.bookId).toBe(forkA);
    // Let the first fork's history reach its remote before the second copy.
    const headA = await resolveRef({ fs: w.fs, dir: w.git.bookDir(forkA), ref: 'main' });
    await waitFor(async () => expect(await remoteHead(remoteA)).toBe(headA), { timeout: 15000 });

    const second = await forkBook(w, forkA);
    expect(second.payload).toMatchObject({ previousBookId: forkA, bookId: forkB, via: 'service' });

    const shelf = await w.shelf();
    expect(shelf.books[forkB].original.value.bookId).toBe(forkA);
    // The first fork's row is gone entirely — its own `original` cleared too.
    expect(shelf.books[forkA].original.value).toBeNull();
    expect(shelf.books[forkA].label.value).toBeNull();
  }, 60000);
});
