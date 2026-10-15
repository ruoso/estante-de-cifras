/**
 * e2e-api — following an original over the stack (sync.fork_follow; workflow 11
 * §Following the original; change check api/openapi.yaml changeCheck). Two
 * accounts by passkey: Ana makes *Choros de Teste* and invites Bia as a reader;
 * Bia forks it (POST /api/books/{id}/fork) and clones the fork with
 * isomorphic-git, as her device would. When Ana saves, Bia's change check
 * counts the new save on the fork (`originalNewSaves`), and once Bia fetches the
 * original, merges it cifra-aware (the app's real merge driver) and pushes to
 * her fork — accepted by the real pre-receive hook — the count clears. When the
 * original goes away (Bia removed from it; the original deleted) the change
 * check says `originalGone` for the fork — never `gone` — her fetch of the
 * original is refused 404, and she still pushes to her fork.
 *
 * Every test works in its own mkdtemp directory and cleans it up. All songs are
 * written for this test — never anyone's words.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import * as git from 'isomorphic-git';

import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';
import { IsoGit, makeTempDir } from './lib/git.js';
import { createCifraMergeDriver } from '../../app/src/worker/cifra-merge-driver.js';

const SONG = 'choro.cifra.md';
const NEW_SONG = 'valsa.cifra.md';
const MINE = 'minha.cifra.md';
const BASE_SONG = `# Choro de Teste

## Verse
First verse line
Second verse line
`;
const NEW_SONG_TEXT = `# Valsa de Teste

## Verse
A new song line
`;
const MINE_TEXT = `# Minha de Teste

## Verse
Only in the fork
`;

const ANA = { name: 'Ana', email: 'ana@users.estantedecifras.app' };
const BIA = { name: 'Bia', email: 'bia@users.estantedecifras.app' };
const ORIGINAL_REF = 'refs/remotes/original/main';

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

async function createInvitation(client, bookId, body) {
  const resp = await client.postJson(`/api/books/${bookId}/invitations`, body);
  expect(resp.status).toBe(201);
  return resp.json();
}

function tokenFromUrl(url) {
  const i = url.indexOf('/i/');
  expect(i).toBeGreaterThanOrEqual(0);
  return url.slice(i + '/i/'.length);
}

function gitEndpoint(book) {
  return new URL(book.gitUrl, `${baseUrl}/`).toString();
}

const headOf = (dev) => git.resolveRef({ fs: dev.fs, dir: dev.dir, ref: 'main' });

async function changeCheck(client, books) {
  const resp = await client.postJson('/api/shelf/change-check', { books });
  expect(resp.status).toBe(200);
  return (await resp.json()).books;
}

// Fetch the original into its own tracking ref by URL, with Bia's cookie — the
// fetch a bring-in makes (never into origin, which is the fork). As the Worker
// does, only the refspec is configured; the URL is per call.
async function fetchOriginal(dev, url, cookie) {
  await git.setConfig({
    fs: dev.fs,
    dir: dev.dir,
    path: 'remote.original.fetch',
    value: `+refs/heads/main:${ORIGINAL_REF}`,
  });
  return git.fetch({
    fs: dev.fs,
    http: dev.http,
    dir: dev.dir,
    url,
    remote: 'original',
    ref: 'main',
    singleBranch: true,
    headers: { cookie },
  });
}

async function saveAndPush(dev, file, text, message, author, url, cookie) {
  await writeFile(join(dev.dir, file), text);
  await dev.add(file);
  await dev.commit(message, author);
  await dev.push({ url, cookie });
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

// Ana's book with one song, shared with Bia as reader; Bia's fork, cloned.
async function forkJourney() {
  const ana = new HttpClient();
  await registerNewAccount(ana);
  const original = await createBook(ana, 'Choros de Teste');
  const originalUrl = gitEndpoint(original);
  const anaCookie = ana.cookieHeader();
  const anaDev = await IsoGit.create(await tempDir('estante-e2e-follow-ana-'));
  await anaDev.init();
  await anaDev.addRemote('origin', originalUrl);
  await saveAndPush(anaDev, SONG, BASE_SONG, 'Add the choro', ANA, originalUrl, anaCookie);

  const bia = new HttpClient();
  const biaId = await registerNewAccount(bia);
  const inv = await createInvitation(ana, original.id, { role: 'reader' });
  const accept = await bia.fetch(`/api/invitations/${tokenFromUrl(inv.url)}/accept`, { method: 'POST' });
  expect(accept.status).toBe(200);

  const forkResp = await bia.postJson(`/api/books/${original.id}/fork`, {});
  expect(forkResp.status).toBe(201);
  const fork = await forkResp.json();
  expect(fork.original.bookId).toBe(original.id);
  const forkUrl = gitEndpoint(fork);
  const biaCookie = bia.cookieHeader();
  const biaDev = await IsoGit.create(await tempDir('estante-e2e-follow-bia-'));
  await biaDev.clone({ url: forkUrl, cookie: biaCookie });

  return { ana, anaDev, anaCookie, original, originalUrl, bia, biaId, biaDev, biaCookie, fork, forkUrl };
}

describe('a fork following its original over the stack (workflow 11)', () => {
  it('counts the original’s new save on the fork and clears it once Bia brings it in', async () => {
    const j = await forkJourney();
    const forkHead = await headOf(j.biaDev);

    // In step with its original: nothing to report for the fork.
    let books = await changeCheck(j.bia, [{ bookId: j.fork.id, head: forkHead }]);
    expect(books.find((b) => b.bookId === j.fork.id)).toBeUndefined();

    // Ana saves a new song to the original.
    await saveAndPush(j.anaDev, NEW_SONG, NEW_SONG_TEXT, 'Add the valsa', ANA, j.originalUrl, j.anaCookie);

    books = await changeCheck(j.bia, [{ bookId: j.fork.id, head: forkHead }]);
    const counted = books.find((b) => b.bookId === j.fork.id);
    expect(counted).toEqual({ bookId: j.fork.id, status: 'unchanged', originalNewSaves: 1 });

    // Bia brings it in: fetch the original with her cookie, merge it into her
    // fork with a merge commit carrying her note, push to the fork.
    await fetchOriginal(j.biaDev, j.originalUrl, j.biaCookie);
    const result = await git.merge({
      fs: j.biaDev.fs,
      dir: j.biaDev.dir,
      ours: 'main',
      theirs: ORIGINAL_REF,
      author: BIA,
      committer: BIA,
      abortOnConflict: true,
      mergeDriver: createCifraMergeDriver(),
      message: 'Bring in Ana’s changes: Valsa de Teste',
      fastForward: false,
    });
    expect(result.mergeCommit).toBe(true);
    await git.checkout({ fs: j.biaDev.fs, dir: j.biaDev.dir, ref: 'main', force: true });
    expect(await j.biaDev.readFileAtHead(NEW_SONG)).toBe(NEW_SONG_TEXT);
    await j.biaDev.push({ url: j.forkUrl, cookie: j.biaCookie });

    // The fork on Estante now has the save: nothing to report again.
    books = await changeCheck(j.bia, [{ bookId: j.fork.id, head: await headOf(j.biaDev) }]);
    expect(books.find((b) => b.bookId === j.fork.id)).toBeUndefined();
  });

  it('says the original is gone — removed from it, then deleted — while the fork syncs on', async () => {
    // Bia removed from the original.
    const j = await forkJourney();
    const forkHead = await headOf(j.biaDev);
    const removed = await j.ana.fetch(`/api/books/${j.original.id}/members/${j.biaId}`, { method: 'DELETE' });
    expect(removed.status).toBe(204);

    let books = await changeCheck(j.bia, [{ bookId: j.fork.id, head: forkHead }]);
    expect(books.find((b) => b.bookId === j.fork.id)).toEqual({
      bookId: j.fork.id,
      status: 'unchanged',
      originalGone: true,
    });

    // Her fetch of the original is refused as a stranger's would be: 404.
    const refused = await fetchOriginal(j.biaDev, j.originalUrl, j.biaCookie).catch((err) => err);
    expect(refused?.data?.statusCode).toBe(404);

    // The fork is untouched and still hers: she saves and pushes to it.
    await saveAndPush(j.biaDev, MINE, MINE_TEXT, 'Add my own', BIA, j.forkUrl, j.biaCookie);
    books = await changeCheck(j.bia, [{ bookId: j.fork.id, head: await headOf(j.biaDev) }]);
    expect(books.find((b) => b.bookId === j.fork.id)).toEqual({
      bookId: j.fork.id,
      status: 'unchanged',
      originalGone: true,
    });

    // A second run: Ana deletes the original.
    const k = await forkJourney();
    const deleted = await k.ana.fetch(`/api/books/${k.original.id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(204);
    books = await changeCheck(k.bia, [{ bookId: k.fork.id, head: await headOf(k.biaDev) }]);
    expect(books.find((b) => b.bookId === k.fork.id)).toEqual({
      bookId: k.fork.id,
      status: 'unchanged',
      originalGone: true,
    });
  });
});
