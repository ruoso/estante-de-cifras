import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { add, commit, readCommit, resolveRef } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createSyncEngine } from './sync-engine.js';
import { createCifraMergeDriver } from './cifra-merge-driver.js';
import { createConflicts } from './conflicts.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — the conflict merge session (sync.conflicts) over a real local git
// remote and a fake IndexedDB, with another device pushing a colliding change.
// Pins workflow 9 §§The rest / Settling one / When every / Leaving one and
// DIRECTION §2.2. All songs are written for this test — never anyone's words
// (no-song-text rule).

const BOOK = 'book1';
const SONG = 'choro.cifra.md'; // both sides edit the same line → a conflict
const CLEAN = 'clean.cifra.md'; // only the other device edits → a clean incoming
const DEL = 'brejeiro.cifra.md'; // the device edits; the other device deletes it

const BASE_SONG = `# Choro Teste

## Primeira parte
First line of the chart
Second line of the chart
`;
// Both devices change the SAME first line, differently → a cifra-aware conflict
// (§11): recomputeMerge returns kind:'conflicts' with a marked text.
const DEVICE_EDIT = BASE_SONG.replace('First line of the chart', 'First line, my way');
const REMOTE_EDIT = BASE_SONG.replace('First line of the chart', "First line, Ana's way");

const BASE_CLEAN = `# Outra

## Parte
A clean untouched line
`;
const REMOTE_CLEAN = BASE_CLEAN.replace('A clean untouched line', 'A line only Ana changed');

const BASE_DEL = `# Brejeiro

## Parte
A line the device edits before it is deleted away
`;
const DEVICE_DEL_EDIT = BASE_DEL.replace('edits before', 'has edited before');

const AUTHOR = { name: 'Ana', email: 'ana@example.invalid', timestamp: 1577836800, timezoneOffset: 0 };
const SYNC_IDENTITY = { id: 'device-b', name: 'Beto' };
const FIXED_NOW = () => Date.UTC(2026, 9, 7, 12, 0, 0);

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(Buffer.concat(out).toString('utf8')) : reject(new Error(`${cmd} ${code}: ${Buffer.concat(err)}`)),
    );
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
// Advance the bare remote: clone, apply `files` (a string writes it, `null`
// deletes it), commit, push. Simulates the other device (Ana).
async function advanceRemote(remote, files, message) {
  const work = mkdtempSync(path.join(tmpdir(), 'estante-conf-adv-'));
  scratchDirs.push(work);
  const env = cliEnv(work);
  const checkout = path.join(work, 'repo');
  await run('git', ['clone', '-q', remote.repoDir, checkout], { env });
  for (const [name, content] of Object.entries(files)) {
    if (content === null) unlinkSync(path.join(checkout, name));
    else writeFileSync(path.join(checkout, name), content);
  }
  await run('git', ['-C', checkout, 'add', '-A'], { env });
  await run('git', ['-C', checkout, 'commit', '-q', '-m', message], { env });
  await run('git', ['-C', checkout, 'push', '-q', 'origin', 'main'], { env });
  return remoteHead(remote.repoDir);
}

async function makeDeviceB(remote) {
  const idb = new IDBFactory();
  const name = `conf-b-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  const dir = git.bookDir(BOOK);
  await git.clone({ dir, url: remote.url });
  return {
    fs, git, locks, dir,
    read: (file) => fs.promises.readFile(`${dir}/${file}`, 'utf8'),
    exists: (file) => fs.promises.readFile(`${dir}/${file}`, 'utf8').then(() => true, () => false),
    head: () => resolveRef({ fs, dir, ref: 'main' }),
    async commitLocal(files, message) {
      for (const [file, content] of Object.entries(files)) {
        await fs.promises.writeFile(`${dir}/${file}`, content);
        await add({ fs, dir, filepath: file });
      }
      return commit({ fs, dir, message, author: AUTHOR });
    },
  };
}

// Reach the engine's halt for a colliding change, then build the conflict
// session over the same fs/git/locks. Returns the device, the session handle,
// the captured CONFLICTS payloads and SAVE_REFUSED payloads, and the engine.
async function engage(remote, { withDeleted = false, withClean = false } = {}) {
  const b = await makeDeviceB(remote);
  // The device's own saved edits (ahead of origin).
  const localEdits = { [SONG]: DEVICE_EDIT };
  if (withDeleted) localEdits[DEL] = DEVICE_DEL_EDIT;
  await b.commitLocal(localEdits, 'my edits');
  // Ana's colliding push: the same line, plus a clean change and a deletion.
  const remoteFiles = { [SONG]: REMOTE_EDIT };
  if (withClean) remoteFiles[CLEAN] = REMOTE_CLEAN;
  if (withDeleted) remoteFiles[DEL] = null;
  const theirHead = await advanceRemote(remote, remoteFiles, "Ana's edits");

  const facts = [];
  const engine = createSyncEngine({
    fs: b.fs, git: b.git, locks: b.locks,
    changeCheck: { check: async () => new Map([[BOOK, { bookId: BOOK, status: 'changed', head: theirHead }]]) },
    mergeDriver: createCifraMergeDriver(),
    resolveAuthor: async () => SYNC_IDENTITY,
    emit: (p) => facts.push(p),
    now: FIXED_NOW,
  });
  await engine.pass(); // fetch + abort on conflict → needs_you, origin/main retained

  const conflicts = [];
  const refused = [];
  const session = createConflicts({
    fs: b.fs, git: b.git, locks: b.locks,
    resolveAuthor: async () => SYNC_IDENTITY,
    emit: (p) => conflicts.push(p),
    emitRefused: (p) => refused.push(p),
    requestSync: () => {},
    now: FIXED_NOW,
  });
  return { b, session, conflicts, refused, facts, theirHead };
}

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
  scratchDirs = [];
});
afterEach(() => {
  restoreLocks();
  for (const d of scratchDirs) rmSync(d, { recursive: true, force: true });
});

describe('conflict merge session over a real remote (behavior)', () => {
  it('materialises on engage: clean incoming lands, the conflicted song stays at ours, the book is paused (workflow 9 §The rest)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG, [CLEAN]: BASE_CLEAN }, 'seed');
      const { b, session, conflicts, facts } = await engage(remote, { withClean: true });
      expect(facts.at(-1)?.phase).toBe('needs_you'); // the engine halted the book

      await session.open(BOOK);

      // The clean incoming change is already in the working copy (the rest of the
      // book carries on); the conflicted song still reads as ours.
      expect(await b.read(CLEAN)).toContain('A line only Ana changed');
      expect(await b.read(SONG)).toContain('First line, my way');
      expect(await b.read(SONG)).not.toContain('<<<<<<<');

      const payload = conflicts.at(-1);
      expect(payload.inProgress).toBe(true);
      expect(payload.songs.map((s) => s.path)).toEqual([SONG]);
      const song = payload.songs[0];
      expect(song.count).toBeGreaterThanOrEqual(1);
      expect(song.marked).toContain('<<<<<<<'); // the *edit* text
      expect(song.author).toBe('Ana'); // the incoming author labels *theirs*
      expect(Array.isArray(song.items[0].ours)).toBe(true);
      expect(payload.incoming.map((i) => i.path)).toContain(CLEAN);

      // The book has an in-progress merge — the engine skips it (no re-fetch).
      expect(session.hasInProgressMerge(BOOK)).toBe(true);
      const fetchBook = vi.fn();
      const facts2 = [];
      const engine2 = createSyncEngine({
        fs: b.fs, git: b.git, locks: b.locks,
        changeCheck: { check: async () => new Map([[BOOK, { bookId: BOOK, status: 'changed' }]]) },
        mergeDriver: createCifraMergeDriver(),
        resolveAuthor: async () => SYNC_IDENTITY,
        emit: (p) => facts2.push(p),
        hasInProgressMerge: session.hasInProgressMerge,
        fetchBook,
        now: FIXED_NOW,
      });
      const before = await b.head();
      await engine2.pass();
      expect(fetchBook).not.toHaveBeenCalled();
      expect(facts2.at(-1)?.phase).toBe('needs_you');
      expect(await b.head()).toBe(before); // nothing new taken in
    } finally {
      await remote.stop();
    }
  });

  it('take theirs resolves the conflict by their side, commits the two-parent merge canonical, and pushes (workflow 9 §When every)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed');
      const { b, session, conflicts } = await engage(remote);
      await session.open(BOOK);

      await session.resolve({ bookId: BOOK, path: SONG, choice: 'theirs' });

      // The last (only) conflict settled → committed and pushed.
      const headOid = await b.head();
      const { commit: merge } = await readCommit({ fs: b.fs, dir: b.dir, oid: headOid });
      expect(merge.parent).toHaveLength(2); // two-parent merge commit
      const saved = await b.read(SONG);
      expect(saved).toContain("First line, Ana's way");
      expect(saved).not.toContain('<<<<<<<'); // canonical, no marker lines
      expect(await remoteHead(remote.repoDir)).toBe(headOid); // pushed
      expect(session.hasInProgressMerge(BOOK)).toBe(false);
      expect(conflicts.at(-1)).toMatchObject({ bookId: BOOK, inProgress: false });
    } finally {
      await remote.stop();
    }
  });

  it('keep mine resolves the conflict by our side', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed');
      const { b, session } = await engage(remote);
      await session.open(BOOK);
      await session.resolve({ bookId: BOOK, path: SONG, choice: 'mine' });
      const saved = await b.read(SONG);
      expect(saved).toContain('First line, my way');
      expect(saved).not.toContain("Ana's way");
    } finally {
      await remote.stop();
    }
  });

  it('edit writes the user text, refusing a text that still holds a marker line and accepting one with the markers removed (§11.12.3; workflow 9 L59)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed');
      const { b, session, conflicts, refused } = await engage(remote);
      await session.open(BOOK);
      const marked = conflicts.at(-1).songs[0].marked;

      // A text that still holds a marker line is refused, pointing at it.
      await session.resolve({ bookId: BOOK, path: SONG, choice: 'edit', text: marked });
      expect(refused.at(-1)).toMatchObject({ bookId: BOOK, path: SONG, reason: 'marked' });
      expect(refused.at(-1).line).toBeGreaterThan(0);
      expect(session.hasInProgressMerge(BOOK)).toBe(true); // still unsettled

      // Editing the markers away (keeping both lines) settles it.
      const edited = marked
        .split('\n')
        .filter((l) => !/^(<{7}|={7}|>{7}|\|{7})/.test(l))
        .join('\n');
      await session.resolve({ bookId: BOOK, path: SONG, choice: 'edit', text: edited });
      expect(session.hasInProgressMerge(BOOK)).toBe(false);
      const saved = await b.read(SONG);
      expect(saved).not.toContain('<<<<<<<');
    } finally {
      await remote.stop();
    }
  });

  it('a deleted-vs-edited file is kept (keeping first) or deleted (workflow 9 §Settling one)', async () => {
    // Kept: the edited song survives.
    let remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG, [DEL]: BASE_DEL }, 'seed');
      const { b, session, conflicts } = await engage(remote, { withDeleted: true });
      await session.open(BOOK);
      const payload = conflicts.at(-1);
      expect(payload.deleted.map((d) => d.path)).toContain(DEL);
      expect(payload.deleted.find((d) => d.path === DEL).deleted).toBe('theirs');

      await session.resolve({ bookId: BOOK, path: DEL, choice: 'keep' });
      await session.resolve({ bookId: BOOK, path: SONG, choice: 'mine' });
      expect(await b.exists(DEL)).toBe(true);
      expect(await b.read(DEL)).toContain('has edited before');
    } finally {
      await remote.stop();
    }

    // Deleted: the song is removed.
    remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG, [DEL]: BASE_DEL }, 'seed');
      const { b, session } = await engage(remote, { withDeleted: true });
      await session.open(BOOK);
      await session.resolve({ bookId: BOOK, path: DEL, choice: 'delete' });
      await session.resolve({ bookId: BOOK, path: SONG, choice: 'mine' });
      expect(await b.exists(DEL)).toBe(false);
    } finally {
      await remote.stop();
    }
  });

  it('settles a song with two conflicts one region at a time — keep mine on one, take theirs on the other (workflow 9 §Settling one)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed');
      const b = await makeDeviceB(remote);
      // Both lines changed on both sides, differently → two regions.
      const deviceBoth = BASE_SONG
        .replace('First line of the chart', 'First line, my way')
        .replace('Second line of the chart', 'Second line, my way');
      const remoteBoth = BASE_SONG
        .replace('First line of the chart', "First line, Ana's way")
        .replace('Second line of the chart', "Second line, Ana's way");
      await b.commitLocal({ [SONG]: deviceBoth }, 'my two edits');
      const theirHead = await advanceRemote(remote, { [SONG]: remoteBoth }, "Ana's two edits");

      const facts = [];
      const engine = createSyncEngine({
        fs: b.fs, git: b.git, locks: b.locks,
        changeCheck: { check: async () => new Map([[BOOK, { bookId: BOOK, status: 'changed', head: theirHead }]]) },
        mergeDriver: createCifraMergeDriver(),
        resolveAuthor: async () => SYNC_IDENTITY,
        emit: (p) => facts.push(p), now: FIXED_NOW,
      });
      await engine.pass();

      const conflicts = [];
      const session = createConflicts({
        fs: b.fs, git: b.git, locks: b.locks,
        resolveAuthor: async () => SYNC_IDENTITY,
        emit: (p) => conflicts.push(p), emitRefused: () => {}, requestSync: () => {}, now: FIXED_NOW,
      });
      await session.open(BOOK);
      expect(conflicts.at(-1).songs[0].count).toBe(2);

      // Keep mine on the first region: one conflict remains, still paused.
      await session.resolve({ bookId: BOOK, path: SONG, choice: 'mine', index: 0 });
      expect(conflicts.at(-1).songs[0].count).toBe(1);
      expect(session.hasInProgressMerge(BOOK)).toBe(true);

      // Take theirs on the last region: settled, committed and pushed.
      await session.resolve({ bookId: BOOK, path: SONG, choice: 'theirs', index: 0 });
      expect(session.hasInProgressMerge(BOOK)).toBe(false);
      const saved = await b.read(SONG);
      expect(saved).toContain('First line, my way'); // kept ours
      expect(saved).toContain("Second line, Ana's way"); // took theirs
      expect(saved).not.toContain('<<<<<<<');
    } finally {
      await remote.stop();
    }
  });

  it('abandon restores the pre-sync state: ours back in the working copy, the incoming ref dropped, the book no longer paused (workflow 9 §Leaving one)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG, [CLEAN]: BASE_CLEAN }, 'seed');
      const { b, session, conflicts } = await engage(remote, { withClean: true });
      const oursBefore = await b.head();
      await session.open(BOOK);
      // Materialised: the clean incoming is present.
      expect(await b.read(CLEAN)).toContain('A line only Ana changed');

      await session.abandon(BOOK);

      // Working copy is back to ours: the clean incoming is gone again, HEAD
      // unchanged, the retained incoming ref dropped, the book no longer paused.
      expect(await b.read(CLEAN)).toContain('A clean untouched line');
      expect(await b.head()).toBe(oursBefore);
      await expect(resolveRef({ fs: b.fs, dir: b.dir, ref: 'refs/remotes/origin/main' })).rejects.toThrow();
      expect(session.hasInProgressMerge(BOOK)).toBe(false);
      expect(conflicts.at(-1)).toMatchObject({ bookId: BOOK, inProgress: false });
    } finally {
      await remote.stop();
    }
  });
});
