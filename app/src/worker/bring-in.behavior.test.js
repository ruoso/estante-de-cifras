import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { add, commit, readBlob, readCommit, resolveRef } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook } from './home-book.js';
import { createCifraMergeDriver } from './cifra-merge-driver.js';
import { createSyncEngine } from './sync-engine.js';
import { createConflicts } from './conflicts.js';
import { createBringIn, ORIGINAL_REF } from './bring-in.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — following an original (sync.fork_follow; workflow 11 §Following
// the original). Two local git remotes stand for the service: the ORIGINAL (Ana's
// book) and the FORK (Bia's copy, seeded from the original as the service's
// `Store.Fork` does). Bia's device holds a working copy of the fork over a fake
// IndexedDB, a real home book (its shelf's `original` register) and the real
// git transport; only the change check is stubbed. Pins the count and the gone
// signal on a pass (workflow 11 line 46, :51-54), the preview and the bring-in
// (:47-48, Constraint 6), a conflict handed to workflow 9 (:48-49), the original
// refusing access (AC11) and a stale confirm (AC9). Every song is written for
// this test — never anyone's words.

const FORK = 'fork1';
const ORIGINAL_ID = 'orig1';
const SONG = 'choro.cifra.md';
const NEW_SONG = 'valsa.cifra.md';
const UNTOUCHED = 'minha.cifra.md';

const BASE_SONG = `# Choro de Teste

## Verse
First verse line
Second verse line

## Chorus
First chorus line
Second chorus line
`;
const VERSE_FROM_ANA = BASE_SONG.replace('First verse line', 'First verse line from Ana');
const VERSE_FROM_BIA = BASE_SONG.replace('First verse line', 'First verse line from Bia');
const NEW_SONG_TEXT = `# Valsa de Teste

## Verse
A new song line
`;
const UNTOUCHED_TEXT = `# Minha de Teste

## Verse
Only in the fork
`;
const UNTOUCHED_UNSAVED = UNTOUCHED_TEXT.replace('Only in the fork', 'Only in the fork, being edited');

const IDENTITY = { id: 'bia-device', name: 'Bia' };
const FOLLOWED_AT = '2026-09-28T10:00:00.000Z';
const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);
const AUTHOR = { name: 'Bia', email: 'bia@example.invalid', timestamp: 1577836800, timezoneOffset: 0 };

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

function cliEnv(home) {
  return {
    PATH: process.env.PATH,
    HOME: home,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'Ana',
    GIT_AUTHOR_EMAIL: 'ana@example.invalid',
    GIT_COMMITTER_NAME: 'Ana',
    GIT_COMMITTER_EMAIL: 'ana@example.invalid',
    GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
  };
}

const remoteHead = (repoDir) =>
  run('git', ['--git-dir', repoDir, 'rev-parse', 'refs/heads/main']).then((s) => s.trim());

let scratchDirs = [];

// One save on a bare remote through a throwaway CLI clone: write `files`, commit,
// push to `main`.
async function saveOn(remote, files, message) {
  const work = mkdtempSync(path.join(tmpdir(), 'estante-follow-'));
  scratchDirs.push(work);
  const env = cliEnv(work);
  const checkout = path.join(work, 'repo');
  await run('git', ['clone', '-q', remote.repoDir, checkout], { env });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(checkout, name), content);
  }
  await run('git', ['-C', checkout, 'add', '.'], { env });
  await run('git', ['-C', checkout, 'commit', '-q', '-m', message], { env });
  await run('git', ['-C', checkout, 'push', '-q', 'origin', 'main'], { env });
  return remoteHead(remote.repoDir);
}

// Fail every request to `url`'s remote with `respond()` — the service refusing
// the ORIGINAL (404 removed / deleted / a stranger; 403 taken_down) — and pass
// every other request (the fork's own remote) to the real fetch.
function refusingFetch(urlPrefix, respond) {
  return (url, init) => {
    if (String(url).startsWith(urlPrefix)) return Promise.resolve(respond());
    return globalThis.fetch(url, init);
  };
}

// The world: the original (with a song), the fork seeded from it plus a song of
// its own, and Bia's device holding the fork with its shelf register.
async function makeWorld({ fetch: fetchFor } = {}) {
  const original = await startGitHttpRemote();
  const fork = await startGitHttpRemote({ seed: false });
  await saveOn(original, { [SONG]: BASE_SONG }, 'seed the song');
  await run('git', ['--git-dir', original.repoDir, 'push', '-q', fork.repoDir, 'main:main']);
  await saveOn(fork, { [UNTOUCHED]: UNTOUCHED_TEXT }, "the fork's own song");

  const idb = new IDBFactory();
  const name = `follow-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const fetchImpl = fetchFor ? fetchFor(original) : globalThis.fetch;
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: fetchImpl }) });
  const locks = createBookLocks({ navigator });
  const dir = git.bookDir(FORK);
  await git.clone({ dir, url: fork.url });

  // The shelf's `original` register, as books.fork writes it (home-book-format §4.2).
  const home = createHomeBook({ fs, git, locks });
  await home.ensureLocal({ author: IDENTITY });
  await home.set({
    bookId: 'home',
    file: 'shelf.json',
    changes: [
      { path: ['books', FORK, 'original'], value: { bookId: ORIGINAL_ID, title: 'Choros de Teste', link: original.url, followedAt: FOLLOWED_AT } },
    ],
    author: IDENTITY,
  });
  const readOriginals = async () => {
    const shelf = await home.read({ bookId: 'home', file: 'shelf.json' });
    const out = {};
    for (const [id, entry] of Object.entries(shelf?.books ?? {})) {
      if (entry?.original?.value) out[id] = entry.original.value;
    }
    return out;
  };
  const recordOriginal = ({ bookId, original: value }) =>
    home.set({ bookId: 'home', file: 'shelf.json', changes: [{ path: ['books', bookId, 'original'], value }], author: IDENTITY });
  const originals = [];
  const emitOriginal = (payload) => originals.push(payload);
  const mergeDriver = createCifraMergeDriver();
  const bringIn = createBringIn({
    fs,
    git,
    locks,
    mergeDriver,
    resolveAuthor: async () => IDENTITY,
    readOriginal: async (bookId) => (await readOriginals())[bookId] ?? null,
    recordOriginal,
    emitOriginal,
    now: () => NOW,
  });

  // The fork's sync engine, only the change check stubbed (`news` per pass).
  function engine(news) {
    const facts = [];
    const e = createSyncEngine({
      fs,
      git,
      locks,
      changeCheck: { check: async () => new Map(news.map((n) => [n.bookId, n])) },
      mergeDriver,
      resolveAuthor: async () => IDENTITY,
      emit: (payload) => facts.push(payload),
      // Only the fork: the home book's own sync is home-book.js's.
      listBooks: async () => [{ bookId: FORK, head: await resolveRef({ fs, dir, ref: 'main' }), hosted: true, home: false }],
      readOriginals,
      recordOriginal,
      emitOriginal,
      now: () => NOW,
    });
    return { pass: () => e.pass(), facts };
  }

  return {
    original,
    fork,
    fs,
    git,
    locks,
    dir,
    bringIn,
    originals,
    engine,
    mergeDriver,
    register: async () => (await readOriginals())[FORK],
    head: () => resolveRef({ fs, dir, ref: 'main' }),
    read: (file) => fs.promises.readFile(`${dir}/${file}`, 'utf8'),
    async headBlob(file) {
      const oid = await resolveRef({ fs, dir, ref: 'main' });
      const { blob } = await readBlob({ fs, dir, oid, filepath: file });
      return new TextDecoder().decode(blob);
    },
    async commitLocal(file, content, message) {
      await fs.promises.writeFile(`${dir}/${file}`, content);
      await add({ fs, dir, filepath: file });
      return commit({ fs, dir, message, author: AUTHOR });
    },
    async stop() {
      await original.stop().catch(() => {});
      await fork.stop().catch(() => {});
    },
  };
}

const lastPhase = (facts) => [...facts].reverse().find((f) => f.bookId === FORK)?.phase;

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
  scratchDirs = [];
});
afterEach(() => {
  restoreLocks();
  for (const d of scratchDirs) rmSync(d, { recursive: true, force: true });
});

describe('following an original (behavior)', () => {
  // workflow 11 line 46 (*Ana's Choros has 3 new saves*) and :51-54 (following
  // ends; nothing else does).
  it('counted: a pass emits the count, and on originalGone records goneAt while the fork still syncs its own saves', async () => {
    const w = await makeWorld();
    try {
      const first = w.engine([{ bookId: FORK, status: 'unchanged', originalNewSaves: 2 }]);
      await first.pass();
      expect(w.originals).toEqual([{ bookId: FORK, newSaves: 2, gone: false }]);
      expect(lastPhase(first.facts)).toBe('in_step');

      const gone = w.engine([{ bookId: FORK, status: 'unchanged', originalGone: true }]);
      await gone.pass();
      expect(w.originals.at(-1)).toEqual({ bookId: FORK, newSaves: 0, gone: true });
      const register = await w.register();
      expect(register.goneAt).toBe(new Date(NOW).toISOString());
      expect(register.followedAt).toBe(FOLLOWED_AT);
      expect(lastPhase(gone.facts)).toBe('in_step');

      // The fork syncs on: another of Bia's devices saved to it, and this device
      // saved too — the pass fetches, merges and pushes the fork's own saves.
      const theirs = await saveOn(w.fork, { [NEW_SONG]: NEW_SONG_TEXT }, 'a save on another device');
      await w.commitLocal(UNTOUCHED, UNTOUCHED_UNSAVED, 'a save here');
      const after = w.engine([{ bookId: FORK, status: 'changed', head: theirs, originalNewSaves: 5 }]);
      const emittedBefore = w.originals.length;
      await after.pass();
      expect(lastPhase(after.facts)).toBe('in_step');
      expect(await remoteHead(w.fork.repoDir)).toBe(await w.head());
      expect(await w.read(NEW_SONG)).toBe(NEW_SONG_TEXT);
      // Following has ended: a count arriving for it is ignored.
      expect(w.originals.length).toBe(emittedBefore);
    } finally {
      await w.stop();
    }
  });

  // workflow 11 lines 47-48 and Constraint 6.
  it('brought in through the preview: nothing written until confirmed, then one merge commit with the note, pushed, unsaved edits kept', async () => {
    const w = await makeWorld();
    try {
      await saveOn(w.original, { [SONG]: VERSE_FROM_ANA }, 'Ana edits the verse');
      await saveOn(w.original, { [NEW_SONG]: NEW_SONG_TEXT }, 'Ana adds a song');
      const mainBefore = await w.head();
      const forkRemoteBefore = await remoteHead(w.fork.repoDir);

      const preview = await w.bringIn.preview({ bookId: FORK });
      expect(preview.newSaves).toBe(2);
      expect(preview.original).toEqual({ bookId: ORIGINAL_ID, title: 'Choros de Teste' });
      expect(typeof preview.followId).toBe('string');
      const rows = Object.fromEntries(preview.previews.map((r) => [r.path, r]));
      expect(rows[SONG].status).toBe('changed');
      expect(rows[NEW_SONG].status).toBe('added');
      expect(rows[NEW_SONG].title).toBe('Valsa de Teste');
      expect(rows[UNTOUCHED]).toBeUndefined();
      // Nothing written to the fork: its main, working tree and remote stand.
      expect(await w.head()).toBe(mainBefore);
      expect(await remoteHead(w.fork.repoDir)).toBe(forkRemoteBefore);
      expect(await w.read(SONG)).toBe(BASE_SONG);

      // An unsaved edit in the working copy while the user reads the preview.
      await w.fs.promises.writeFile(`${w.dir}/${UNTOUCHED}`, UNTOUCHED_UNSAVED);

      const note = 'Bring in Ana\'s changes: Choro de Teste, Valsa de Teste';
      const done = await w.bringIn.bringIn({ bookId: FORK, followId: preview.followId, note });
      expect(done).toEqual({ bookId: FORK, kind: 'merged', pushed: true });

      const mergeOid = await w.head();
      const { commit: merge } = await readCommit({ fs: w.fs, dir: w.dir, oid: mergeOid });
      expect(merge.parent).toHaveLength(2);
      expect(merge.parent[0]).toBe(mainBefore);
      expect(merge.message.trim()).toBe(note);
      expect(merge.author.name).toBe('Bia');
      expect(await remoteHead(w.fork.repoDir)).toBe(mergeOid);
      expect(await w.read(SONG)).toBe(VERSE_FROM_ANA);
      expect(await w.read(NEW_SONG)).toBe(NEW_SONG_TEXT);
      // The unsaved edit is still unsaved, on top.
      expect(await w.read(UNTOUCHED)).toBe(UNTOUCHED_UNSAVED);
      expect(await w.headBlob(UNTOUCHED)).toBe(UNTOUCHED_TEXT);

      const register = await w.register();
      expect(register.followedAt).toBe(new Date(NOW).toISOString());
      expect(register.goneAt).toBeUndefined();
      expect(w.originals.at(-1)).toEqual({ bookId: FORK, newSaves: 0, gone: false });
      // The fetched original was dropped with the merge.
      await expect(resolveRef({ fs: w.fs, dir: w.dir, ref: ORIGINAL_REF })).rejects.toThrow();
    } finally {
      await w.stop();
    }
  });

  // workflow 11 lines 48-49, workflow 9.
  it('a conflict: the preview row says conflict and the bring-in hands it to workflow 9 with nothing pushed', async () => {
    const w = await makeWorld();
    try {
      await w.commitLocal(SONG, VERSE_FROM_BIA, 'Bia edits the verse');
      await w.git.push({ dir: w.dir });
      await saveOn(w.original, { [SONG]: VERSE_FROM_ANA }, 'Ana edits the verse');
      const mainBefore = await w.head();
      const forkRemoteBefore = await remoteHead(w.fork.repoDir);

      const preview = await w.bringIn.preview({ bookId: FORK });
      expect(preview.previews.find((r) => r.path === SONG)?.status).toBe('conflict');

      const done = await w.bringIn.bringIn({ bookId: FORK, followId: preview.followId, note: 'Bring in' });
      expect(done).toEqual({ bookId: FORK, kind: 'needs_you' });
      expect(await w.head()).toBe(mainBefore);
      expect(await remoteHead(w.fork.repoDir)).toBe(forkRemoteBefore);
      expect(await w.read(SONG)).toBe(VERSE_FROM_BIA);

      // The conflict session settles it against the original, not origin/main.
      expect(await w.bringIn.incomingRefFor(FORK, w.dir)).toBe(ORIGINAL_REF);
      const models = [];
      const conflicts = createConflicts({
        fs: w.fs,
        git: w.git,
        locks: w.locks,
        resolveAuthor: async () => IDENTITY,
        emit: (payload) => models.push(payload),
        emitRefused: () => {},
        incomingRef: async (bookId, dir) => (await w.bringIn.incomingRefFor(bookId, dir)) ?? 'refs/remotes/origin/main',
      });
      await conflicts.open(FORK);
      const model = models.at(-1);
      expect(model.inProgress).toBe(true);
      expect(model.songs.map((s) => s.path)).toEqual([SONG]);
    } finally {
      await w.stop();
    }
  });

  // AC11; workflow 11 lines 51-54: a definite refusal from the ORIGINAL ends
  // following and touches nothing of the fork; no network changes nothing.
  for (const [label, respond] of [
    ['404 (removed, deleted, a stranger)', () => new Response(JSON.stringify({ code: 'not_found', message: 'No such book.' }), { status: 404 })],
    ['403 taken_down', () => new Response(JSON.stringify({ code: 'taken_down', message: 'This book has been taken down: test notice' }), { status: 403 })],
  ]) {
    it(`the original gone — ${label}: gone recorded, the fork untouched and still in step`, async () => {
      const w = await makeWorld({ fetch: (original) => refusingFetch(original.url, respond) });
      try {
        await w.fs.promises.writeFile(`${w.dir}/${UNTOUCHED}`, UNTOUCHED_UNSAVED);
        const mainBefore = await w.head();

        const reply = await w.bringIn.preview({ bookId: FORK });
        expect(reply).toEqual({ bookId: FORK, gone: true });
        expect((await w.register()).goneAt).toBe(new Date(NOW).toISOString());
        expect(w.originals).toEqual([{ bookId: FORK, newSaves: 0, gone: true }]);
        expect(await w.head()).toBe(mainBefore);
        expect(await w.read(UNTOUCHED)).toBe(UNTOUCHED_UNSAVED);

        // The fork's own phase: a pass leaves it in step, never gone.
        const e = w.engine([]);
        await e.pass();
        expect(lastPhase(e.facts)).toBe('in_step');
        // And a later preview answers gone without asking the original again.
        expect(await w.bringIn.preview({ bookId: FORK })).toEqual({ bookId: FORK, gone: true });
      } finally {
        await w.stop();
      }
    });
  }

  it('the original unreachable (connection refused): unreachable, nothing recorded', async () => {
    const w = await makeWorld();
    try {
      await w.original.stop();
      const mainBefore = await w.head();
      const reply = await w.bringIn.preview({ bookId: FORK });
      expect(reply).toEqual({ bookId: FORK, error: 'unreachable' });
      expect((await w.register()).goneAt).toBeUndefined();
      expect(w.originals).toEqual([]);
      expect(await w.head()).toBe(mainBefore);
    } finally {
      await w.stop();
    }
  });

  // AC9: a confirm that no longer matches the preview is refused.
  it('stale: a bring-in after a second preview is refused and merges nothing', async () => {
    const w = await makeWorld();
    try {
      await saveOn(w.original, { [NEW_SONG]: NEW_SONG_TEXT }, 'Ana adds a song');
      const mainBefore = await w.head();
      const first = await w.bringIn.preview({ bookId: FORK });
      const second = await w.bringIn.preview({ bookId: FORK });
      expect(second.followId).not.toBe(first.followId);

      const stale = await w.bringIn.bringIn({ bookId: FORK, followId: first.followId, note: 'Bring in' });
      expect(stale).toEqual({ bookId: FORK, kind: 'stale' });
      expect(await w.head()).toBe(mainBefore);
      expect((await w.register()).followedAt).toBe(FOLLOWED_AT);

      // A save that moved `main` since the preview also makes it stale.
      await w.commitLocal(UNTOUCHED, UNTOUCHED_UNSAVED, 'a save after the preview');
      const moved = await w.bringIn.bringIn({ bookId: FORK, followId: second.followId, note: 'Bring in' });
      expect(moved).toEqual({ bookId: FORK, kind: 'stale' });
      await expect(w.fs.promises.stat(`${w.dir}/${NEW_SONG}`)).rejects.toThrow();
    } finally {
      await w.stop();
    }
  });
});
