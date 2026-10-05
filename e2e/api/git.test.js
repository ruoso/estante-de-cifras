/**
 * e2e-api — both device-side git clients are wired and functional in the
 * harness.
 *
 * Pins DIRECTION §3.6 line 281 (the app does git through isomorphic-git) and
 * lines 317–353 (git over HTTP), and the .tji note's "the git CLI and
 * isomorphic-git helpers init, commit and clone a local repository". Scope per
 * the refinement's Decisions: the host `git` CLI clones a local repository
 * natively, so it does the full init → commit → clone round-trip; isomorphic-git
 * has no local-filesystem clone transport (clone speaks smart HTTP), so it
 * proves init → add → commit → read-back locally, and its HTTP clone/fetch/push
 * are exercised against the live service downstream (service.git_http, sync).
 * Every test works in its own mkdtemp directory and cleans it up.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { GitCli, IsoGit, makeTempDir } from './lib/git.js';
import { sampleSong } from './fixtures/songs.js';

const tempDirs = [];

async function tempDir(prefix) {
  const dir = await makeTempDir(prefix);
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('git clients', () => {
  it('git CLI: init, commit and clone a local repository round-trips a song', async () => {
    const bareDir = await tempDir('estante-e2e-bare-');
    const workDir = await tempDir('estante-e2e-work-');
    const cloneDir = await tempDir('estante-e2e-clone-');

    const bare = await GitCli.create(bareDir);
    await bare.init({ bare: true });

    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.addRemote('origin', bareDir);
    await work.push('origin', 'main');

    await GitCli.cloneRepo(bareDir, cloneDir);
    const readBack = await readFile(join(cloneDir, sampleSong.filename), 'utf8');
    expect(readBack).toBe(sampleSong.content);
  });

  it('isomorphic-git: init, add, commit and read a song back via log/readBlob', async () => {
    const dir = await tempDir('estante-e2e-isogit-');

    const repo = await IsoGit.create(dir);
    await repo.init();
    await writeFile(join(dir, sampleSong.filename), sampleSong.content);
    await repo.add(sampleSong.filename);
    await repo.commit('Add the tuning song');

    const commits = await repo.log();
    expect(commits).toHaveLength(1);
    expect(commits[0].commit.message.trim()).toBe('Add the tuning song');
    expect(await repo.readFileAtHead(sampleSong.filename)).toBe(sampleSong.content);
  });
});
