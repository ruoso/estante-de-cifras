/**
 * e2e-api — the reMarkable reader pairs with an account, syncs, cannot write,
 * and signs out, against the compose stack (reader.pairing;
 * docs/remarkable-reader.md §5.1 *On the device*, §10; workflow 19 §Pairing,
 * §The shelf).
 *
 * An account signs in by the passkey ceremony, creates a book and pushes a
 * song written for the test to it with the git CLI, and brings its home book
 * online with a shelf naming the book. The built reader
 * (ESTANTE_E2E_READER_BIN) runs `pair --root R --origin <stack>`: it prints
 * its code, which the signed-in account approves, and exits once it has kept
 * the session (0600, its token in no output); `sync` brings the book. With the
 * reader's session the git CLI's push is refused (read-only by scope). The
 * reader's `signout` ends the session with the service and leaves nothing of
 * the account under R. Paired again, the account signs the reader out from
 * its device list, and the reader's next `sync` reports it signed out and
 * forgets the session and the books (pair_design Decision 2).
 */
import { afterEach, describe, it, expect } from 'vitest';
import { readdir, rm, stat, writeFile } from 'node:fs/promises';
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

// Songs written for this test (never anyone's copyrighted words).
const song = { filename: 'farol.cifra.md', content: '# Farol do Norte\n\n```\n[D] Luz que gira\n```\n' };
const readerSong = { filename: 'escrita.cifra.md', content: '# Não Escrevo\n\n```\n[E] Só leio\n```\n' };

// DevicePairing.code (api/openapi.yaml).
const CODE = /^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/;

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

// The account, a book with a song, and a home book whose shelf names it.
async function setUp() {
  const owner = new HttpClient();
  await registerNewAccount(owner);
  const resp = await owner.postJson('/api/books', { title: 'Livro do Leitor' });
  expect(resp.status).toBe(201);
  const book = await resp.json();
  const url = gitEndpoint(book.gitUrl);
  const bookDir = await tempDir('estante-e2e-reader-pair-book-');
  const work = await GitCli.create(bookDir);
  await work.init();
  await writeFile(join(bookDir, song.filename), song.content);
  await work.add('.');
  await work.commit(`Add ${song.filename}`);
  await work.pushHTTP(url, owner.cookieHeader());
  const head = await work.revParse('HEAD');

  const home = await owner.getJson('/api/account/home-book');
  const homeDir = await tempDir('estante-e2e-reader-pair-home-');
  const homeWork = await GitCli.create(homeDir);
  await homeWork.init();
  await writeFile(join(homeDir, 'README.md'), homeReadme);
  await writeFile(join(homeDir, '.gitattributes'), homeGitattributes);
  const shelf = {
    books: {
      [book.id]: {
        label: { at: AT, value: 'Farol' },
        link: { at: AT, value: book.gitUrl },
        position: { at: AT, value: 0 },
        role: { at: AT, value: 'owner' },
      },
    },
  };
  await writeFile(join(homeDir, 'shelf.json'), canonical(shelf));
  await homeWork.add('.');
  await homeWork.commit('Bring the home book online');
  await homeWork.pushHTTP(gitEndpoint(home.gitUrl), owner.cookieHeader());

  const root = join(await tempDir('estante-e2e-reader-pair-root-'), 'estante');
  return { owner, book, url, head, root };
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// Nothing of the account under the reader's root: no session, no books.
async function expectSignedOut(root) {
  expect(await exists(join(root, 'session.json'))).toBe(false);
  expect(await readdir(join(root, 'books'))).toEqual([]);
  expect(await readdir(join(root, 'home'))).toEqual([]);
}

describe('the reader pairs, syncs, cannot write, and signs out (reader.pairing)', () => {
  it('the reader begins, a signed-in web client approves, the reader syncs; a push with its session is refused; Sign out ends the session with the service', async () => {
    const { owner, book, url, head, root } = await setUp();

    // The reader begins, prints its code, and exits 0 once approved.
    const paired = await pairReader(owner, root);
    expect(Object.keys(paired.codeLine).sort()).toEqual(['code', 'expiresAt', 'url']);
    expect(paired.codeLine.code).toMatch(CODE);
    expect(paired.codeLine.url).toBe(new URL('/pair', `${baseUrl}/`).toString());
    expect(paired.stdout.trim().split('\n')).toHaveLength(1);

    // The session kept 0600, for the stack's origin; its token in no output.
    const session = await readerSession(root);
    expect(session.mode).toBe(0o600);
    expect(session.origin).toBe(new URL(baseUrl).origin);
    expect(session.token.length).toBeGreaterThan(0);
    expect(paired.stdout).not.toContain(session.token);
    expect(paired.stderr).not.toContain(session.token);

    // sync brings the book, its head the pushed one.
    const synced = await runReader(['sync', '--root', root, '--bundle', bundleDir]);
    expect(synced.stdout).not.toContain(session.token);
    expect(synced.stderr).not.toContain(session.token);
    const result = JSON.parse(synced.stdout);
    expect(result.home.status).toBe('cloned');
    expect(result.books[book.id]).toEqual({ status: 'cloned', head });

    // A push with the reader's session is refused (§5.1 read-only), and the
    // book's head is unchanged.
    const readerCookie = `estante_session=${session.token}`;
    const cliDir = await tempDir('estante-e2e-reader-pair-push-');
    const cli = await GitCli.cloneHTTP(url, cliDir, readerCookie);
    await writeFile(join(cliDir, readerSong.filename), readerSong.content);
    await cli.add('.');
    await cli.commit('From the reader');
    await expect(cli.pushHTTP(url, readerCookie)).rejects.toThrow(/403/);
    const checkDir = await tempDir('estante-e2e-reader-pair-check-');
    const check = await GitCli.cloneHTTP(url, checkDir, owner.cookieHeader());
    expect(await check.revParse('HEAD')).toBe(head);

    // Sign out ends the session with the service: nothing of the account
    // under the root, and the old token is refused.
    const signedOut = await runReader(['signout', '--root', root]);
    expect(signedOut.stdout).toBe('');
    expect(signedOut.stderr).toBe('');
    await expectSignedOut(root);
    const old = new HttpClient();
    old.cookies.set('estante_session', session.token);
    expect((await old.get('/api/account/home-book')).status).toBe(401);
  });

  it('signed out from the account: the next sync reports it and forgets the session and the books', async () => {
    const { owner, book, root } = await setUp();
    await pairReader(owner, root);
    const first = JSON.parse((await runReader(['sync', '--root', root, '--bundle', bundleDir])).stdout);
    expect(first.books[book.id].status).toBe('cloned');
    const { token } = await readerSession(root);

    // The owner signs the reader out from the account's device list.
    const list = await owner.getJson('/api/account/sessions');
    const row = list.sessions.find((s) => s.kind === 'remarkable');
    expect(row).toBeDefined();
    const resp = await owner.fetch(`/api/account/sessions/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
    expect(resp.status).toBe(204);

    // The reader's next sync is refused: it says signed out, and leaves no
    // session and no books.
    const refused = await runReader(['sync', '--root', root, '--bundle', bundleDir]).then(
      () => {
        throw new Error('sync succeeded with a session signed out from the account');
      },
      (err) => err,
    );
    expect(refused.code).toBe(1);
    expect(refused.stderr).toMatch(/signed out/);
    expect(refused.stderr).not.toContain(token);
    await expectSignedOut(root);
  });
});
