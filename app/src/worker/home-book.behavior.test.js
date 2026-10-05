import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { spawn } from 'node:child_process';
import { resolveRef } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook } from './home-book.js';
import { serialize } from './home-book-canonical.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — the home book's writer and merger (storage.home_book acceptance,
// the .tji's "settings changed in two working copies merged through the local
// remote, committed automatically"). Two `createHomeBook` instances — devices A
// and B — each over its own fresh `new IDBFactory()` with a `createFileSystem`
// fs and `installWebLocks()` active, both cloning one `startGitHttpRemote()` url
// (the v1 push-enabled harness, which seeds only a generic fixture, so the home
// book's own files are scaffolded by `home-book.js` on first use). Committed
// state is read by spawning the `git` CLI against the bare remote, the idiom
// working-copy.behavior.test.js uses.
//
// Drives `createHomeBook` directly, as git.behavior.test.js drives git.js
// (home-book.md Decision 1 — this task ships the Worker-internal mechanism, no
// protocol kinds). Pins workflow 8 L72-77 and L41-47, workflow 1 L72-78,
// workflow 13 L58-66, home-book-format.md §2.2, §5, §6, and
// tasks/40-storage.tji:47. All settings are written for this test
// (no-song-text rule).

const BOOK = 'home';
// Devices A and B belong to the SAME account, so their auto-commits carry the
// same per-user no-reply address (DIRECTION §3.2).
const IDENTITY = { id: 'u_8f3a21', name: 'A Tester' };
const AUTHOR_EMAIL = 'u_8f3a21@users.estantedecifras.app';

// Two instants, B's the later; `set` takes `now` so the §3 `at` is pinned.
const T_EARLY = Date.UTC(2026, 9, 5, 14, 0, 0);
const T_LATE = Date.UTC(2026, 9, 5, 15, 0, 0);
const AT_EARLY = new Date(T_EARLY).toISOString();
const AT_LATE = new Date(T_LATE).toISOString();

// The exact §2.2 bytes the app writes, pinned here independently of the module.
const README_BYTES = `# Home book

This repository holds one person's Estante de Cifras settings. Its files are
JSON that merge key by key, the later change winning; it is written and merged
by the app, not edited by hand. The format is docs/home-book-format.md in the
estante-de-cifras repository.
`;
const GITATTRIBUTES_BYTES = `* text=auto eol=lf
*.json merge=binary
`;

// Run a git command to completion without blocking the event loop — the harness
// server runs in this process, so a synchronous child would deadlock a network
// op against it (mirrors working-copy.behavior.test.js).
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
const gitRemote = (repoDir, ...args) => run('git', ['--git-dir', repoDir, ...args]);
const remoteHead = (repoDir) =>
  gitRemote(repoDir, 'rev-parse', 'refs/heads/main').then((s) => s.trim());

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

// A device: its own fake IndexedDB, filesystem and git layer, the home book
// composed over them, and the book cloned from the shared remote.
async function makeDevice(remote, label) {
  const idb = new IDBFactory();
  const name = `hb-${label}-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  const dir = git.bookDir(BOOK);
  await git.clone({ dir, url: remote.url });
  const home = createHomeBook({ fs, git, locks });
  return {
    home,
    dir,
    read: (file) => fs.promises.readFile(`${dir}/${file}`, 'utf8'),
    head: () => resolveRef({ fs, dir, ref: 'main' }),
  };
}

describe('the home book, write / merge / commit automatically (behavior)', () => {
  it('A sets a preference — an automatic canonical commit pushed to the local remote (workflow 8 L41-47, §2.2, §6)', async () => {
    const remote = await startGitHttpRemote();
    try {
      const seed = await remoteHead(remote.repoDir);
      const a = await makeDevice(remote, 'a');

      // (1) A sets theme = "palco". A commit is made AUTOMATICALLY — no save —
      // and the file on disk is canonical bytes.
      const before = await a.head();
      await a.home.set({
        bookId: BOOK,
        file: 'preferences.json',
        changes: [{ path: ['theme'], value: 'palco' }],
        author: IDENTITY,
        now: T_EARLY,
      });
      expect(await a.head()).not.toBe(before); // committed, no explicit save
      const expectedPrefs = serialize({ theme: { value: 'palco', at: AT_EARLY } });
      expect(await a.read('preferences.json')).toBe(expectedPrefs); // canonical on disk

      // A syncs; the remote's main advances (committed automatically, pushed to
      // the local remote).
      const res = await a.home.sync({ bookId: BOOK, author: IDENTITY });
      expect(res.pushed).toBe(true);
      expect(await remoteHead(remote.repoDir)).not.toBe(seed);

      // The pushed preferences blob is the canonical bytes.
      expect(await gitRemote(remote.repoDir, 'show', 'main:preferences.json')).toBe(expectedPrefs);
      // Authored and committed by the per-user no-reply address.
      expect((await gitRemote(remote.repoDir, 'log', '-1', '--format=%ae', 'main')).trim()).toBe(
        AUTHOR_EMAIL,
      );
      // A fresh home book was scaffolded with the §2.2 exact bytes.
      expect(await gitRemote(remote.repoDir, 'show', 'main:README.md')).toBe(README_BYTES);
      expect(await gitRemote(remote.repoDir, 'show', 'main:.gitattributes')).toBe(
        GITATTRIBUTES_BYTES,
      );
    } finally {
      await remote.stop();
    }
  });

  it("B's sync merges A's change key by key and commits the merge automatically (workflow 8 L72-77, §5.2)", async () => {
    const remote = await startGitHttpRemote();
    try {
      // Both devices clone the seed, so B's later fetch of A's commit diverges.
      const a = await makeDevice(remote, 'a');
      const b = await makeDevice(remote, 'b');

      // (1) A sets theme and syncs it up.
      await a.home.set({
        bookId: BOOK,
        file: 'preferences.json',
        changes: [{ path: ['theme'], value: 'palco' }],
        author: IDENTITY,
        now: T_EARLY,
      });
      await a.home.sync({ bookId: BOOK, author: IDENTITY });

      // (2) B sets a DIFFERENT key in the same file, and a label in a different
      // file, then syncs — fetching A's commit and merging.
      await b.home.set({
        bookId: BOOK,
        file: 'preferences.json',
        changes: [{ path: ['language'], value: 'pt-BR' }],
        author: IDENTITY,
        now: T_LATE,
      });
      await b.home.set({
        bookId: BOOK,
        file: 'shelf.json',
        changes: [{ path: ['books', 'b-1', 'label'], value: 'Turma de quarta' }],
        author: IDENTITY,
        now: T_LATE,
      });
      const beforeMerge = await remoteHead(remote.repoDir);
      const res = await b.home.sync({ bookId: BOOK, author: IDENTITY });
      expect(res.pushed).toBe(true);
      expect(res.commit).toBeTruthy();

      // The merged preferences.json holds BOTH theme (from A) and language (from
      // B), key by key — the §6 canonical bytes.
      const expectedPrefs = serialize({
        language: { value: 'pt-BR', at: AT_LATE },
        theme: { value: 'palco', at: AT_EARLY },
      });
      expect(await gitRemote(remote.repoDir, 'show', 'main:preferences.json')).toBe(expectedPrefs);
      // shelf.json is B's, taken whole — A lacked the file (§5.2).
      const expectedShelf = serialize({
        books: { 'b-1': { label: { value: 'Turma de quarta', at: AT_LATE } } },
      });
      expect(await gitRemote(remote.repoDir, 'show', 'main:shelf.json')).toBe(expectedShelf);

      // A merge commit with TWO parents was made automatically and pushed; the
      // remote advanced to it (merged through the local remote).
      const parents = (await gitRemote(remote.repoDir, 'log', '-1', '--format=%P', res.commit))
        .trim()
        .split(/\s+/);
      expect(parents).toHaveLength(2);
      expect(await remoteHead(remote.repoDir)).toBe(res.commit);
      expect(res.commit).not.toBe(beforeMerge);
    } finally {
      await remote.stop();
    }
  });

  it('the later change wins and both devices converge byte-identically (§5.1, §5.4, §6)', async () => {
    const remote = await startGitHttpRemote();
    try {
      const a = await makeDevice(remote, 'a');
      const b = await makeDevice(remote, 'b');

      // Both set the same key; B's `at` is the greater, so B's value must win.
      await a.home.set({
        bookId: BOOK,
        file: 'preferences.json',
        changes: [{ path: ['theme'], value: 'estante' }],
        author: IDENTITY,
        now: T_EARLY,
      });
      await b.home.set({
        bookId: BOOK,
        file: 'preferences.json',
        changes: [{ path: ['theme'], value: 'caderno' }],
        author: IDENTITY,
        now: T_LATE,
      });

      // Sync both until their preferences files agree (a couple of rounds settle
      // a two-device divergence; the cap guards against a hang).
      let rounds = 0;
      while (
        rounds < 6 &&
        (await a.read('preferences.json')) !== (await b.read('preferences.json'))
      ) {
        await a.home.sync({ bookId: BOOK, author: IDENTITY });
        await b.home.sync({ bookId: BOOK, author: IDENTITY });
        rounds += 1;
      }

      const converged = serialize({ theme: { value: 'caderno', at: AT_LATE } });
      expect(await a.read('preferences.json')).toBe(converged); // B's value won
      expect(await b.read('preferences.json')).toBe(converged);
      // Byte-identical on both devices (the reproducible canonical auto-commit).
      expect(await a.read('preferences.json')).toBe(await b.read('preferences.json'));
    } finally {
      await remote.stop();
    }
  });

  it('offline: a set still commits locally and a sync resolves pushed:false without rolling back (workflow 1 L72-78)', async () => {
    const remote = await startGitHttpRemote();
    const device = await makeDevice(remote, 'off');
    // Make the remote unreachable AFTER the clone.
    await remote.stop();
    try {
      const before = await device.head();
      // A set never waits on the network: it commits locally.
      await device.home.set({
        bookId: BOOK,
        file: 'preferences.json',
        changes: [{ path: ['theme'], value: 'palco' }],
        author: IDENTITY,
        now: T_EARLY,
      });
      const afterSet = await device.head();
      expect(afterSet).not.toBe(before); // a local commit was made
      const expectedPrefs = serialize({ theme: { value: 'palco', at: AT_EARLY } });
      expect(await device.read('preferences.json')).toBe(expectedPrefs);

      // A sync with the remote unreachable resolves pushed:false and does not
      // roll back the local commit.
      const res = await device.home.sync({ bookId: BOOK, author: IDENTITY });
      expect(res.pushed).toBe(false);
      expect(await device.read('preferences.json')).toBe(expectedPrefs); // still there
    } finally {
      // The remote is already stopped; nothing more to tear down.
    }
  });
});
