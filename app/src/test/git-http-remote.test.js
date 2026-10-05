import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startGitHttpRemote } from './git-http-remote.js';

// Run a command to completion without blocking the event loop — the harness
// server runs in this same process, so a synchronous child would deadlock the
// clone against the server it is talking to. Resolves with stdout, rejects
// with stderr on a non-zero exit.
function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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

// behavior — readies the Worker behavior level (storage.worker, Decision 5):
// the harness serves a seeded repository over git smart HTTP (protocol v1),
// the `git` CLI clones it over HTTP and reads the seeded commit, and the
// server tears down cleanly. This is the local git remote the note assigns
// here so storage.git / storage.working_copy / sync.engine can test against it.
describe('git-http-remote harness', () => {
  it('serves a seeded repo over smart HTTP v1 that the git CLI can clone', async () => {
    const remote = await startGitHttpRemote();
    const dest = mkdtempSync(path.join(tmpdir(), 'estante-git-clone-'));
    const checkout = path.join(dest, 'repo');
    const gitEnv = {
      PATH: process.env.PATH,
      HOME: dest,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
    };
    try {
      // Pin protocol v1 on the client to match what the server advertises.
      await run(
        'git',
        ['-c', 'protocol.version=1', 'clone', '-q', remote.url, checkout],
        { env: gitEnv },
      );

      // The seeded commit's file came across the wire.
      const content = readFileSync(path.join(checkout, 'README.txt'), 'utf8');
      expect(content).toContain('fixture');

      // And the commit itself is there with its purpose-written message.
      const log = await run(
        'git',
        ['-C', checkout, 'log', '--format=%s', '-1'],
        { env: gitEnv },
      );
      expect(log.trim()).toBe('seed fixture');
    } finally {
      rmSync(dest, { recursive: true, force: true });
      // The server tears down cleanly.
      await remote.stop();
    }
  });
});
