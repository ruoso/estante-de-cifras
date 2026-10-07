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
import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';

// A signed-in client the way a device signs in — the passkey ceremony driving
// the JS software authenticator (no seeded email, no song text). Mirrors
// books.test.js; copied because the helper is module-local there.
async function registerNewAccount(client) {
  const beginResp = await client.postJson('/api/auth/passkey/register/begin', {});
  expect(beginResp.status).toBe(200);
  const begin = await beginResp.json();
  const credential = await new Authenticator(baseUrl).create(begin.publicKey);
  const finishResp = await client.postJson('/api/auth/passkey/register/finish', {
    state: begin.state,
    credential,
  });
  expect(finishResp.status).toBe(200);
  const account = await finishResp.json();
  expect(client.cookies.has('estante_session')).toBe(true);
  return account.id;
}

async function createBook(client, title) {
  const resp = await client.postJson('/api/books', { title });
  expect(resp.status).toBe(201);
  return resp.json();
}

// The per-book git endpoint, resolved against the one origin.
function gitEndpoint(book) {
  return new URL(book.gitUrl, `${baseUrl}/`).toString();
}

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

describe('git over HTTP (service.git_http)', () => {
  // The git CLI and isomorphic-git clone, fetch and push against the live stack
  // with a real session — a device moving a book to and from Estante. Pins
  // DIRECTION §3.6 lines 320–330; the contract's Git paths.
  it('the CLI and isomorphic-git clone, fetch and push with a session', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    const book = await createBook(client, 'HTTP Round Trip');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    // The owner pushes the first commit with the git CLI (the book starts empty).
    const workDir = await tempDir('estante-e2e-work-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.pushHTTP(url, cookie);

    // The CLI clones it back from a second working copy and reads the song.
    const cliCloneDir = await tempDir('estante-e2e-cliclone-');
    const cliClone = await GitCli.cloneHTTP(url, cliCloneDir, cookie);
    expect(await readFile(join(cliCloneDir, sampleSong.filename), 'utf8')).toBe(sampleSong.content);

    // isomorphic-git (the app's Worker client) clones it, then pushes a second
    // commit.
    const isoDir = await tempDir('estante-e2e-isohttp-');
    const iso = await IsoGit.create(isoDir);
    await iso.clone({ url, cookie });
    expect(await iso.readFileAtHead(sampleSong.filename)).toBe(sampleSong.content);

    await writeFile(join(isoDir, 'segundo.cifra.md'), '# Segundo\n\n```cifra\n[Am]Teste\n```\n');
    await iso.add('segundo.cifra.md');
    await iso.commit('Add a second song');
    await iso.push({ url, cookie });
    const isoHead = (await iso.log())[0].oid;

    // The CLI clone fetches the later commit isomorphic-git pushed.
    await cliClone.fetchHTTP(url, cookie);
    const fetched = (await cliClone.run('rev-parse', 'refs/remotes/origin/main')).trim();
    expect(fetched).toBe(isoHead);
  });

  // A protocol v2 fetch from the CLI (-c protocol.version=2) negotiates and
  // transfers. Pins DIRECTION §3.6 lines 331–332.
  it('a protocol v2 clone from the CLI succeeds', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    const book = await createBook(client, 'V2 Book');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    const workDir = await tempDir('estante-e2e-v2work-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.pushHTTP(url, cookie);

    const v2Dir = await tempDir('estante-e2e-v2clone-');
    await GitCli.cloneHTTP(url, v2Dir, cookie, { protocolVersion: 2 });
    expect(await readFile(join(v2Dir, sampleSong.filename), 'utf8')).toBe(sampleSong.content);
  });

  // A second account with no membership is refused — 404 on the advertisement
  // (never confirming a private book) and a failed clone and push. Pins contract
  // lines 782–790; DIRECTION §3.3 lines 175–182.
  it('a non-member is refused with 404', async () => {
    const owner = new HttpClient();
    await registerNewAccount(owner);
    const book = await createBook(owner, 'Private Book');
    const url = gitEndpoint(book);

    // Seed a first commit so the book is real (the owner can reach it).
    const workDir = await tempDir('estante-e2e-ownerwork-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.pushHTTP(url, owner.cookieHeader());

    // A stranger: signed in, but not a member.
    const stranger = new HttpClient();
    await registerNewAccount(stranger);
    const strangerCookie = stranger.cookieHeader();

    const refs = await stranger.get(`/git/${book.id}/info/refs?service=git-upload-pack`);
    expect(refs.status).toBe(404);

    const cloneDir = await tempDir('estante-e2e-nmclone-');
    await expect(GitCli.cloneHTTP(url, cloneDir, strangerCookie)).rejects.toThrow();
  });
});

describe('hook: refs (hook.refs)', () => {
  // The member clones, commits and pushes a fast-forward (accepted), then
  // force-pushes a rewritten history — the stack's pre-receive hook refuses the
  // whole push, the reason reaching the client through git's own channel (a
  // remote: line). Pins workflow 14 "Fast-forward only." (14-file-view.md:96-97)
  // and DIRECTION §3.6 line 341. Also the first case that proves the hook is
  // built into and run by the image.
  it('refuses a non-fast-forward force-push to main, the reason on git\'s channel', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    const book = await createBook(client, 'Fast Forward Only');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    // The initial push creates main — accepted (a book comes online).
    const workDir = await tempDir('estante-e2e-ffwork-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.pushHTTP(url, cookie);

    // A fast-forward: a second commit on top, pushed — accepted.
    await writeFile(join(workDir, 'segundo.cifra.md'), '# Segundo\n\n```cifra\n[Am]Teste\n```\n');
    await work.add('.');
    await work.commit('Add a second song');
    await work.pushHTTP(url, cookie);

    // Rewrite the tip and force-push: a non-fast-forward the hook refuses whole.
    await work.run('commit', '--amend', '-m', 'Rewritten tip');
    let error;
    try {
      await work.pushHTTP(url, cookie, 'main', { force: true });
    } catch (e) {
      error = e;
    }
    expect(error, 'the force-push should have been refused').toBeDefined();
    // git relays the hook's stderr to the client prefixed "remote:".
    const relayed = `${error.stderr ?? ''}${error.stdout ?? ''}${error.message ?? ''}`;
    expect(relayed).toContain('remote:');
    expect(relayed).toMatch(/non-fast-forward|refs\/heads\/main/);
  });
});
