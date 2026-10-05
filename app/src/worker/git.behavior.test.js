import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { log, add, commit, resolveRef } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — the real git transport (storage.git acceptance) over a fresh fake
// IndexedDB and a `createFileSystem` fs, against `startGitHttpRemote()` (the
// v1-only smart-HTTP harness). Drives the layer through the custom HTTP client
// with an observing `fetch` spy. Pins tasks/40-storage.tji:26, DIRECTION §3.6
// "Git over HTTP" (L317-350) and §3.3 one-origin / session (L170-211).
//
// All fixture text is written for this test — never anyone's words
// (no-song-text rule).

// Run a command to completion without blocking the event loop — the harness
// server runs in this same process, so a synchronous child would deadlock a
// network op against the server it is talking to. (Mirrors git-http-remote.test.js.)
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

// Isolated git identity for the CLI operations that advance the remote — no
// dependency on the developer's global config, purpose-written values.
function cliEnv(home) {
  return {
    PATH: process.env.PATH,
    HOME: home,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'Estante Test',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Estante Test',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
    GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
  };
}

// Deterministic author for the isomorphic-git side commit.
const AUTHOR = {
  name: 'Estante Test',
  email: 'test@example.invalid',
  timestamp: 1577836800, // 2020-01-01T00:00:00Z
  timezoneOffset: 0,
};

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

describe('git transport layer (behavior)', () => {
  it('clones, pushes and fetches over v1 smart HTTP with credentials and no v2 negotiation', async () => {
    const remote = await startGitHttpRemote();
    const idb = new IDBFactory();
    const fs = createFileSystem('git-behavior-fs', { indexedDB: idb });

    // Observe every request the custom client makes, then forward to the real
    // fetch (undici) that reaches the loopback harness.
    const calls = [];
    const realFetch = globalThis.fetch;
    const spyFetch = (url, init) => {
      calls.push({ url, init });
      return realFetch(url, init);
    };
    const http = createGitHttpClient({ fetch: spyFetch });
    const layer = createGitLayer({ fs, http });

    const tmpDirs = [];
    try {
      // bookDir settles the on-device layout: a non-bare working dir at
      // /books/<id> (Decision 5).
      const dir = layer.bookDir('book-abc');
      expect(dir).toBe('/books/book-abc');

      // (1) clone the seeded repo — working tree, .git, and the seed commit.
      await layer.clone({ dir, url: remote.url });
      const readme = await fs.promises.readFile(`${dir}/README.txt`, 'utf8');
      expect(readme).toContain('fixture');
      const gitStat = await fs.promises.stat(`${dir}/.git`);
      expect(gitStat.isDirectory()).toBe(true);
      const seeded = await log({ fs, dir, ref: 'main', depth: 1 });
      expect(seeded[0].commit.message.trim()).toBe('seed fixture');

      // (3) commit a local change and push. Done while still in sync with the
      // seed so the push is fast-forward — this transport primitive never
      // merges (that is storage.working_copy / sync's job) and never force-pushes.
      await fs.promises.writeFile(`${dir}/SONG.txt`, 'a test song, written for this test\n');
      await add({ fs, dir, filepath: 'SONG.txt' });
      const localSha = await commit({ fs, dir, message: 'add a test song', author: AUTHOR });
      await layer.push({ dir, url: remote.url });
      const remoteHeadAfterPush = (
        await run('git', ['--git-dir', remote.repoDir, 'rev-parse', 'refs/heads/main'])
      ).trim();
      expect(remoteHeadAfterPush).toBe(localSha); // the remote's main moved

      // (2) fetch after the remote advances. Advance it with the git CLI
      // (async spawn, never sync) by pushing a further commit to the bare repo.
      const work = mkdtempSync(path.join(tmpdir(), 'estante-git-advance-'));
      tmpDirs.push(work);
      const checkout = path.join(work, 'repo');
      const env = cliEnv(work);
      await run('git', ['clone', '-q', remote.repoDir, checkout], { env });
      writeFileSync(path.join(checkout, 'MORE.txt'), 'another test fixture line\n');
      await run('git', ['-C', checkout, 'add', '.'], { env });
      await run('git', ['-C', checkout, 'commit', '-q', '-m', 'advance the remote'], { env });
      await run('git', ['-C', checkout, 'push', '-q', 'origin', 'main'], { env });
      const advancedSha = (
        await run('git', ['--git-dir', remote.repoDir, 'rev-parse', 'refs/heads/main'])
      ).trim();

      const fetchResult = await layer.fetch({ dir, url: remote.url });
      expect(fetchResult.fetchHead).toBe(advancedSha); // the new commit arrived
      const trackedSha = await resolveRef({ fs, dir, ref: 'refs/remotes/origin/main' });
      expect(trackedSha).toBe(advancedSha);

      // (4) the observable form of "protocol v1" and "credentials included":
      // every request carried credentials:'include' and none advertised v2.
      expect(calls.length).toBeGreaterThan(0);
      for (const { init } of calls) {
        expect(init.credentials).toBe('include');
        for (const [key, value] of Object.entries(init.headers || {})) {
          if (key.toLowerCase() === 'git-protocol') {
            expect(String(value)).not.toMatch(/version=2/i);
          }
        }
      }
      // A receive-pack request was actually made and completed against the
      // v1-only backend — push stayed on the v1 flow, never getRemoteInfo2
      // (Decision 3).
      expect(calls.some(({ url }) => String(url).includes('git-receive-pack'))).toBe(true);
    } finally {
      for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
      await remote.stop();
    }
  });
});
