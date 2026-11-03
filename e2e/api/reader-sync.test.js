/**
 * e2e-api — the reMarkable reader's sync against the compose stack
 * (reader.sync; docs/remarkable-reader.md §5.2, §5.3, §9 "Integration
 * (stack)"; workflow 19).
 *
 * An account signs in by the passkey ceremony, creates two books and pushes a
 * song written for the test to each with the git CLI, then brings its home book
 * online with the §2.2 README and .gitattributes and a canonical shelf.json
 * naming both books (each `link` its gitUrl). The built reader
 * (ESTANTE_E2E_READER_BIN) is paired with the account through the real
 * pairing (`pairReader`, reader.pairing) and runs `sync`, whose stdout is its
 * Result: ids, statuses and heads. Pins the note's "a book
 * pushed by a web client appears on the reader after a sync" and "a second
 * sync fetches only the book that moved".
 */
import { afterEach, describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { GitCli, makeTempDir } from './lib/git.js';
import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';
import { bundleDir, pairReader, readerSession, runReader } from './lib/reader.js';

// The exact §2.2 bytes a home book holds (docs/home-book-format.md), as
// home-book.test.js uses.
const homeReadme =
  '# Home book\n' +
  '\n' +
  "This repository holds one person's Estante de Cifras settings. Its files are\n" +
  'JSON that merge key by key, the later change winning; it is written and merged\n' +
  'by the app, not edited by hand. The format is docs/home-book-format.md in the\n' +
  'estante-de-cifras repository.\n';
const homeGitattributes = '* text=auto eol=lf\n*.json merge=binary\n';

// Songs written for this test.
const firstSong = { filename: 'ponte-velha.cifra.md', content: '# Ponte Velha\n\n```\n[C] Luz do cais\n```\n' };
const secondSong = { filename: 'estrada.cifra.md', content: '# Estrada de Pedra\n\n```\n[Am] Passo a passo\n```\n' };
const laterSong = { filename: 'mare.cifra.md', content: '# Maré Alta\n\n```\n[G] Volta a vela\n```\n' };

const AT = '2026-10-06T12:00:00.000Z';

// The canonical JSON of §6: members sorted at every depth, two-space indent,
// one LF at the end.
function canonical(value) {
  const sort = (v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])]))
      : v;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

// A signed-in client by the passkey ceremony (git.test.js's helper;
// module-local there).
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
  expect(client.cookies.has('estante_session')).toBe(true);
}

async function createBook(client, title) {
  const resp = await client.postJson('/api/books', { title });
  expect(resp.status).toBe(201);
  return resp.json();
}

function gitEndpoint(gitUrl) {
  return new URL(gitUrl, `${baseUrl}/`).toString();
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

function runGit(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`git ${args[0]}: ${stderr}`))));
  });
}

// A book created and a song pushed to it; answers its id, url, working copy and
// head.
async function pushedBook(client, title, song) {
  const book = await createBook(client, title);
  const url = gitEndpoint(book.gitUrl);
  const dir = await tempDir('estante-e2e-reader-book-');
  const work = await GitCli.create(dir);
  await work.init();
  await writeFile(join(dir, song.filename), song.content);
  await work.add('.');
  await work.commit(`Add ${song.filename}`);
  await work.pushHTTP(url, client.cookieHeader());
  return { id: book.id, gitUrl: book.gitUrl, url, work, head: await work.revParse('HEAD') };
}

// The account, its two books, its home book listing them, and a reader root
// paired with the account.
async function setUp() {
  const client = new HttpClient();
  await registerNewAccount(client);
  const first = await pushedBook(client, 'Reader Sync First', firstSong);
  const second = await pushedBook(client, 'Reader Sync Second', secondSong);

  const homeResp = await client.get('/api/account/home-book');
  expect(homeResp.status).toBe(200);
  const home = await homeResp.json();
  const homeDir = await tempDir('estante-e2e-reader-home-');
  const homeWork = await GitCli.create(homeDir);
  await homeWork.init();
  await writeFile(join(homeDir, 'README.md'), homeReadme);
  await writeFile(join(homeDir, '.gitattributes'), homeGitattributes);
  const shelf = {
    books: {
      [first.id]: {
        label: { at: AT, value: 'Primeiro' },
        link: { at: AT, value: first.gitUrl },
        position: { at: AT, value: 0 },
        role: { at: AT, value: 'owner' },
      },
      [second.id]: {
        label: { at: AT, value: 'Segundo' },
        link: { at: AT, value: second.gitUrl },
        position: { at: AT, value: 1 },
        role: { at: AT, value: 'owner' },
      },
    },
  };
  await writeFile(join(homeDir, 'shelf.json'), canonical(shelf));
  await homeWork.add('.');
  await homeWork.commit('Bring the home book online');
  await homeWork.pushHTTP(gitEndpoint(home.gitUrl), client.cookieHeader());

  const root = join(await tempDir('estante-e2e-reader-root-'), 'estante');
  const paired = await pairReader(client, root);
  const { token } = await readerSession(root);
  expect(paired.stdout).not.toContain(token);
  expect(paired.stderr).not.toContain(token);
  return { client, first, second, root, token };
}

async function sync(root, token) {
  const { stdout, stderr } = await runReader(['sync', '--root', root, '--bundle', bundleDir]);
  expect(stdout).not.toContain(token);
  expect(stderr).not.toContain(token);
  return JSON.parse(stdout);
}

async function showMain(root, id, file) {
  return runGit(['--git-dir', join(root, 'books', id), 'show', `main:${file}`]);
}

describe('the reader syncs the shelf, read-only (reader.sync)', () => {
  it("the reader's first sync clones the shelf", async () => {
    const { first, second, root, token } = await setUp();
    const result = await sync(root, token);

    expect(result.home.status).toBe('cloned');
    expect(result.books[first.id]).toEqual({ status: 'cloned', head: first.head });
    expect(result.books[second.id]).toEqual({ status: 'cloned', head: second.head });
    // Ids, statuses and heads, nothing else.
    expect(Object.keys(result).sort()).toEqual(['books', 'home']);
    expect(JSON.stringify(result)).not.toContain('Primeiro');
    expect(JSON.stringify(result)).not.toContain(first.gitUrl);

    expect(await showMain(root, first.id, firstSong.filename)).toBe(firstSong.content);
    expect(await showMain(root, second.id, secondSong.filename)).toBe(secondSong.content);
  });

  it('a second sync fetches only the book that moved', async () => {
    const { client, first, second, root, token } = await setUp();
    await sync(root, token);

    await writeFile(join(first.work.cwd, laterSong.filename), laterSong.content);
    await first.work.add('.');
    await first.work.commit('Add a later song');
    await first.work.pushHTTP(first.url, client.cookieHeader());
    const newHead = await first.work.revParse('HEAD');
    expect(newHead).not.toBe(first.head);

    const result = await sync(root, token);
    expect(result.books[first.id]).toEqual({ status: 'fetched', head: newHead });
    expect(result.books[second.id]).toEqual({ status: 'unchanged', head: second.head });
    expect(result.home.status).toBe('unchanged');
    expect(await showMain(root, first.id, laterSong.filename)).toBe(laterSong.content);
    expect(await showMain(root, first.id, firstSong.filename)).toBe(firstSong.content);
  });
});
