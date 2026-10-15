import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { resolveRef, statusMatrix } from 'isomorphic-git';
import { parse, write } from 'cifra-md';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — the Worker's history reads (storage.history acceptance) driven
// through the real command/event path. `createWorkerLogic` runs in-process over
// the loopback double, with an injected `fake-indexeddb`, `installWebLocks()`
// active, a `createFileSystem` fs and the git layer against `startGitHttpRemote()`
// (the v1 smart-HTTP harness). The repository is BUILT IN THE TEST: a disk work
// tree is cloned from the bare remote, commits (edits, a content-preserving
// rename, two merges, a deletion) are seeded with the `git` CLI, pushed back, and
// the Worker's clone is populated by cloning the bare into the SHARED lightning-fs
// (the Worker's fs `${name}-fs` and the test's share the name, so both see one
// clone). Committed state is cross-checked with the `git` CLI against the bare.
//
// Pins tasks/40-storage.tji:60 (the five behavior phrases), workflow 6 L24-37 and
// L39-62, workflow 9 L69-70, workflow 14 L161-173, and DIRECTION §4 L446-450. All
// song text is written for this test (no-song-text rule).

// Poll a SYNCHRONOUS assertion against already-folded store state until it passes
// (mirrors working-copy.behavior.test.js): it reads the store slice an event
// folds into, never the filesystem, so it never contends on the shared fs lock.
const until = (fn) => {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        fn();
        resolve();
      } catch (err) {
        if (Date.now() - start > 8000) reject(err);
        else setTimeout(tick, 25);
      }
    };
    tick();
  });
};

// Run a git command to completion without blocking the event loop — the harness
// server runs in this process, so a synchronous child would deadlock a network op
// against it (mirrors working-copy.behavior.test.js). `env` is merged in for the
// deterministic seeding identity and dates.
function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env });
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

// The deterministic seeding identity and monotonically increasing dates, so the
// log order is unambiguous (newest first) and the author surfaces predictably.
const SEED_NAME = 'Score Keeper';
const SEED_EMAIL = 'keeper@example.invalid';
let clock;
function seedEnv() {
  clock += 60000;
  const when = new Date(clock).toISOString();
  return {
    PATH: process.env.PATH,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: SEED_NAME,
    GIT_AUTHOR_EMAIL: SEED_EMAIL,
    GIT_COMMITTER_NAME: SEED_NAME,
    GIT_COMMITTER_EMAIL: SEED_EMAIL,
    GIT_AUTHOR_DATE: when,
    GIT_COMMITTER_DATE: when,
  };
}

// A small original song, two revisions; the words are written for this test.
const V1 = ['# Harbour Light', '', 'A lantern on the pier', ''].join('\n');
const V2 = ['# Harbour Light', '', 'A lantern on the quiet pier', ''].join('\n');
const V3 = ['# Harbour Light', '', 'A lantern on the far grey pier', ''].join('\n');

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
  clock = Date.UTC(2026, 0, 1, 0, 0, 0);
});
afterEach(() => {
  restoreLocks();
});

// Bring up a remote, a fresh IndexedDB and the Worker-backed store, plus a
// test-side fs/git window over the SAME backing store. `seed(build)` clones the
// bare to a disk work tree, runs `build` to make commits, pushes, and then clones
// the bare into the shared lightning-fs so the Worker's history reads see them.
async function setup(bookId) {
  const remote = await startGitHttpRemote();
  const idb = new IDBFactory();
  const name = `hist-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const dir = git.bookDir(bookId);

  const workdir = mkdtempSync(nodePath.join(tmpdir(), 'hist-work-'));

  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
  );
  const store = createStore(endpoint);

  async function seed(build) {
    // Clone the bare to a disk work tree (CLI), build commits, push main back.
    execFileSync('git', ['clone', '-q', remote.repoDir, workdir], { env: seedEnv() });
    const oids = {};
    const g = (...args) => run('git', ['-C', workdir, ...args], seedEnv());
    const w = (file, text) => {
      const full = nodePath.join(workdir, file);
      mkdirSync(nodePath.dirname(full), { recursive: true });
      writeFileSync(full, text);
    };
    const rev = async (ref = 'HEAD') => (await g('rev-parse', ref)).trim();
    await build({ g, w, rev, oids });
    await g('push', '-q', 'origin', 'main');
    // Populate the Worker's clone from the bare (full clone — every book is a full
    // clone, workflow 6 L9), into the shared fs.
    await git.clone({ dir, url: remote.url });
    return oids;
  }

  return {
    remote,
    store,
    fs,
    dir,
    bookId,
    seed,
    // Read the bare remote with the CLI, for byte-for-byte cross-checks.
    bare: (...args) => run('git', ['--git-dir', remote.repoDir, ...args], seedEnv()),
    read: (path) => fs.promises.readFile(`${dir}/${path}`, 'utf8'),
    head: () => resolveRef({ fs, dir, ref: 'main' }),
    status: (path) => statusMatrix({ fs, dir, filepaths: [path] }),
    songSlice: (path) => store.slice('history')[bookId]?.[path],
    async cleanup() {
      rmSync(workdir, { recursive: true, force: true });
      await remote.stop();
    },
  };
}

describe("the Worker's history reads (behavior)", () => {
  it("returns a song's log following a rename, each entry at its path then (workflow 6 L34-37)", async () => {
    const ctx = await setup('book-rename');
    try {
      const oids = await ctx.seed(async ({ g, w, rev, oids }) => {
        w('songs/harbour.cifra.md', V1);
        await g('add', '.');
        await g('commit', '-qm', 'Add Harbour Light');
        oids.c1 = await rev();
        w('songs/harbour.cifra.md', V2);
        await g('add', '.');
        await g('commit', '-qm', 'Tighten the first line');
        oids.c2 = await rev();
        // Content-preserving rename (git mv keeps the blob) — the common app and
        // computer case Decision 3 ships exact following for.
        await g('mv', 'songs/harbour.cifra.md', 'songs/harbour-light.cifra.md');
        await g('commit', '-qm', 'Rename to harbour-light');
        oids.c3 = await rev();
        w('songs/harbour-light.cifra.md', V3);
        await g('add', '.');
        await g('commit', '-qm', 'Add the grey');
        oids.c4 = await rev();
      });

      const current = 'songs/harbour-light.cifra.md';
      const previous = 'songs/harbour.cifra.md';
      ctx.store.send(command(CommandKind.SONG_LOG, { bookId: ctx.bookId, path: current }));
      await until(() => expect(ctx.songSlice(current)?.entries).toBeTruthy());

      const entries = ctx.songSlice(current).entries;
      // Every version, newest first, across the rename.
      expect(entries.map((e) => e.commit)).toEqual([oids.c4, oids.c3, oids.c2, oids.c1]);
      // Each entry carries the song's path AT THAT COMMIT (pre-rename for c1/c2).
      expect(entries.map((e) => e.path)).toEqual([current, current, previous, previous]);
      // The author surfaces from the commit; none is a merge or a resolution.
      expect(entries[0].author).toEqual({ name: SEED_NAME, email: SEED_EMAIL, self: false });
      expect(entries.every((e) => e.isMerge === false && e.resolution === false)).toBe(true);
      expect(entries[0].short).toBe(oids.c4.slice(0, 7));
    } finally {
      await ctx.cleanup();
    }
  });

  it('hides a joined merge but keeps a resolution merge, flagged (workflow 6 L24-32, workflow 9 L69-70)', async () => {
    const ctx = await setup('book-merges');
    try {
      const song = 's.cifra.md';
      const oids = await ctx.seed(async ({ g, w, rev, oids }) => {
        w(song, 'S0\n');
        w('other.cifra.md', 'O0\n');
        await g('add', '.');
        await g('commit', '-qm', 'base');
        // Joined merge: only one side touches the song, the other touches a
        // different file; the merged song equals that side (comes verbatim).
        await g('checkout', '-qb', 'feat');
        w(song, 'SA\n');
        await g('add', '.');
        await g('commit', '-qm', 'edit song on feat');
        oids.sideA = await rev();
        await g('checkout', '-q', 'main');
        w('other.cifra.md', 'O1\n');
        await g('add', '.');
        await g('commit', '-qm', 'edit other on main');
        await g('merge', '--no-ff', '-q', 'feat', '-m', 'joined merge');
        oids.joined = await rev();
        // Resolution merge: both sides edit the song, resolved to a third value
        // that differs from both parents.
        await g('checkout', '-qb', 'kranch');
        w(song, 'SX\n');
        await g('add', '.');
        await g('commit', '-qm', 'edit song SX');
        await g('checkout', '-q', 'main');
        w(song, 'SY\n');
        await g('add', '.');
        await g('commit', '-qm', 'edit song SY');
        try {
          await g('merge', '--no-ff', '-q', 'kranch', '-m', 'resolution merge');
        } catch {
          // conflict expected; resolve below
        }
        w(song, 'SZ\n');
        await g('add', '.');
        await g('commit', '--no-edit', '-qm', 'resolution merge');
        oids.resolution = await rev();
      });

      ctx.store.send(command(CommandKind.SONG_LOG, { bookId: ctx.bookId, path: song }));
      await until(() => expect(ctx.songSlice(song)?.entries).toBeTruthy());
      const entries = ctx.songSlice(song).entries;
      const byCommit = new Map(entries.map((e) => [e.commit, e]));

      // The joined merge (song came verbatim from one side) is absent.
      expect(byCommit.has(oids.joined)).toBe(false);
      // The resolution merge (song differs from both parents) is present and flagged.
      expect(byCommit.has(oids.resolution)).toBe(true);
      expect(byCommit.get(oids.resolution).resolution).toBe(true);
      expect(byCommit.get(oids.resolution).isMerge).toBe(true);
      // A merge is not the first entry only when the log says so; the resolution
      // merge is the newest commit here, so it leads.
      expect(entries[0].commit).toBe(oids.resolution);
    } finally {
      await ctx.cleanup();
    }
  });

  it('reads a version as it was, byte-for-byte (workflow 6 L39-51; DIRECTION §4 L446-450)', async () => {
    const ctx = await setup('book-read');
    try {
      const song = 'harbour.cifra.md';
      const oids = await ctx.seed(async ({ g, w, rev, oids }) => {
        w(song, V1);
        await g('add', '.');
        await g('commit', '-qm', 'Add Harbour Light');
        oids.c1 = await rev();
        w(song, V2);
        await g('add', '.');
        await g('commit', '-qm', 'Tighten the first line');
        oids.c2 = await rev();
      });

      ctx.store.send(
        command(CommandKind.READ_VERSION, { bookId: ctx.bookId, path: song, commit: oids.c1 }),
      );
      await until(() => expect(ctx.songSlice(song)?.versions?.[oids.c1]).toBeTruthy());
      const text = ctx.songSlice(song).versions[oids.c1];
      expect(text).toBe(V1);
      // Byte-for-byte equal to what git itself shows at that commit.
      expect(text).toBe(await ctx.bare('show', `${oids.c1}:${song}`));
    } finally {
      await ctx.cleanup();
    }
  });

  it('restores a version into the working copy, uncommitted, at the current path (workflow 6 L53-62)', async () => {
    const ctx = await setup('book-restore');
    try {
      const previous = 'harbour.cifra.md';
      const current = 'harbour-light.cifra.md';
      const oids = await ctx.seed(async ({ g, w, rev, oids }) => {
        w(previous, V1);
        await g('add', '.');
        await g('commit', '-qm', 'Add Harbour Light');
        oids.c1 = await rev();
        await g('mv', previous, current);
        await g('commit', '-qm', 'Rename to harbour-light');
        w(current, V3);
        await g('add', '.');
        await g('commit', '-qm', 'Add the grey');
        oids.head = await rev();
      });

      const before = await ctx.head();
      // Restore the pre-rename version (V1 at c1, where the path was `previous`)
      // into the song's CURRENT name.
      ctx.store.send(
        command(CommandKind.RESTORE_VERSION, {
          bookId: ctx.bookId,
          path: current,
          commit: oids.c1,
          fromPath: previous,
        }),
      );
      await until(() => expect(ctx.songSlice(current)?.restored).toBe(1));

      // The current file now holds the old bytes, verbatim…
      expect(await ctx.read(current)).toBe(V1);
      // …HEAD did not move (history is never rewritten; restore does not commit)…
      expect(await ctx.head()).toBe(before);
      // …and the change is uncommitted in the working tree (WORKDIR differs from HEAD).
      const [row] = await ctx.status(current);
      expect(row[1]).toBe(1); // present at HEAD
      expect(row[2]).toBe(2); // working tree differs from HEAD
      expect(row[3]).toBe(1); // not staged
      // The pre-rename name was not resurrected.
      let gone = false;
      try {
        await ctx.read(previous);
      } catch {
        gone = true;
      }
      expect(gone).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });

  it('restores ONE block of a version into the working copy, uncommitted, rename-correct, nothing elsewhere (songs.restore_part, workflow 6 §Restoring)', async () => {
    const ctx = await setup('book-restore-part');
    try {
      // Two-section songs; only Refrão differs between the pre-rename version and
      // head (G → G7). Purpose-written words.
      const PV1 = ['# Harbour Light', '', '## Verse', '```', '| C | G |', '```', '', '## Refrain', '```', '| G | C |', '```', ''].join('\n');
      const PHEAD = ['# Harbour Light', '', '## Verse', '```', '| C | G |', '```', '', '## Refrain', '```', '| G7 | C |', '```', ''].join('\n');
      const previous = 'harbour.cifra.md';
      const current = 'harbour-light.cifra.md';
      const oids = await ctx.seed(async ({ g, w, rev, oids }) => {
        w(previous, PV1);
        await g('add', '.');
        await g('commit', '-qm', 'Add Harbour Light');
        oids.c1 = await rev();
        await g('mv', previous, current);
        w(current, PHEAD);
        await g('add', '.');
        await g('commit', '-qm', 'Rename and darken the refrain');
        oids.head = await rev();
      });

      const before = await ctx.head();
      // Restore the Refrain block of the pre-rename version (c1, path `previous`)
      // into the song's CURRENT name.
      ctx.store.send(
        command(CommandKind.RESTORE_PART, {
          bookId: ctx.bookId,
          path: current,
          commit: oids.c1,
          fromPath: previous,
          block: { kind: 'section', name: 'Refrain', fromName: 'Refrain' },
        }),
      );
      await until(() => expect(ctx.songSlice(current)?.restored).toBe(1));

      // Only the Refrain came back (G7 → G); the Verse is byte-identical. Since the
      // two versions differ only in the Refrain, the whole song is c1's canonical.
      expect(await ctx.read(current)).toBe(write(parse(PV1)));
      // HEAD did not move; the restore neither commits nor pushes.
      expect(await ctx.head()).toBe(before);
      expect((await ctx.bare('rev-parse', 'main')).trim()).toBe(oids.head);
      // The change is uncommitted in the working tree.
      const [row] = await ctx.status(current);
      expect(row[1]).toBe(1); // present at HEAD
      expect(row[2]).toBe(2); // working tree differs from HEAD
      expect(row[3]).toBe(1); // not staged
      // The pre-rename name was not resurrected.
      let gone = false;
      try {
        await ctx.read(previous);
      } catch {
        gone = true;
      }
      expect(gone).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });

  it("returns the book's whole log with files touched, merges marked, a delete as deleted (workflow 14 L161-173)", async () => {
    const ctx = await setup('book-log');
    try {
      const oids = await ctx.seed(async ({ g, w, rev, oids }) => {
        w('a.cifra.md', V1);
        await g('add', '.');
        await g('commit', '-qm', 'Add A');
        oids.addA = await rev();
        w('a.cifra.md', V2);
        w('b.cifra.md', V1);
        await g('add', '.');
        await g('commit', '-qm', 'Edit A, add B');
        oids.editAB = await rev();
        await g('rm', '-q', 'b.cifra.md');
        await g('commit', '-qm', 'Delete B');
        oids.delB = await rev();
      });

      ctx.store.send(command(CommandKind.BOOK_LOG, { bookId: ctx.bookId }));
      await until(() => expect(ctx.store.slice('bookLog')[ctx.bookId]?.commits).toBeTruthy());
      const commits = ctx.store.slice('bookLog')[ctx.bookId].commits;

      // Every commit, newest first, matching git's own order (the seed fixture
      // commit from the harness is the last one).
      const cliOrder = (await ctx.bare('log', '--format=%H', 'main')).trim().split('\n');
      expect(commits.map((c) => c.commit)).toEqual(cliOrder);

      const byCommit = new Map(commits.map((c) => [c.commit, c]));
      // The delete appears as `deleted` in its own commit.
      expect(byCommit.get(oids.delB).files).toEqual([{ path: 'b.cifra.md', status: 'deleted' }]);
      // The combined edit+add commit touches both files with their statuses.
      expect(byCommit.get(oids.editAB).files.sort((x, y) => x.path.localeCompare(y.path))).toEqual([
        { path: 'a.cifra.md', status: 'modified' },
        { path: 'b.cifra.md', status: 'added' },
      ]);
      // The first song commit adds A.
      expect(byCommit.get(oids.addA).files).toEqual([{ path: 'a.cifra.md', status: 'added' }]);
      // Shape: short hash, author, date, message, parents; none here is a merge.
      const head = byCommit.get(oids.delB);
      expect(head.short).toBe(oids.delB.slice(0, 7));
      expect(head.author).toEqual({ name: SEED_NAME, email: SEED_EMAIL, self: false });
      expect(typeof head.timestamp).toBe('number');
      expect(head.message).toContain('Delete B');
      expect(head.isMerge).toBe(false);
      expect(head.parents).toEqual([oids.editAB]);
    } finally {
      await ctx.cleanup();
    }
  });
});
