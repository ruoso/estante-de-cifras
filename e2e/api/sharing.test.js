/**
 * e2e-api — sharing: invitations and members, end to end (workflow 10;
 * DIRECTION §3.3 lines 175-182, §3.6 lines 368-372).
 *
 * Black-box over HTTP and real git clients against the compose stack, with
 * sessions obtained the way a device would (the passkey ceremony driving the JS
 * software authenticator — no seeded email, no song text). Pins the
 * service.sharing e2e clause: an invitation accepted by a second account that
 * then clones and, as editor, pushes over git, while a reader is refused the
 * push; and a full book refusing a join, and a withdrawn invitation refusing a
 * new join while an already-joined member keeps access.
 *
 * One setup step reaches Postgres directly through the harness's db seam
 * (lib/db.js): fifty members seeded straight, a fixture no endpoint shapes (the
 * cap is enforced at accept, not at seeding). It is a precondition, not an
 * assertion.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';
import { GitCli, makeTempDir } from './lib/git.js';
import { sampleSong } from './fixtures/songs.js';
import { connect } from './lib/db.js';

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

// The accept route carries the raw token in its path and takes no body.
function acceptInvitation(client, token) {
  return client.fetch(`/api/invitations/${token}/accept`, { method: 'POST' });
}

// The raw token the accept route expects, pulled from an invitation link
// (<base>/i/<raw>).
function tokenFromUrl(url) {
  const i = url.indexOf('/i/');
  expect(i).toBeGreaterThanOrEqual(0);
  return url.slice(i + '/i/'.length);
}

function gitEndpoint(book) {
  return new URL(book.gitUrl, `${baseUrl}/`).toString();
}

function findBook(list, id) {
  return list.books.find((b) => b.id === id);
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

describe('sharing (workflow 10)', () => {
  it('an accepted invitation admits a second account that clones and pushes as editor; a reader cannot push', async () => {
    const owner = new HttpClient();
    await registerNewAccount(owner);
    const book = await createBook(owner, 'Shared Over HTTP');
    const url = gitEndpoint(book);

    // The owner seeds a first commit so the clients have something to clone.
    const ownerDir = await tempDir('estante-e2e-share-owner-');
    const ownerWork = await GitCli.create(ownerDir);
    await ownerWork.init();
    await writeFile(join(ownerDir, sampleSong.filename), sampleSong.content);
    await ownerWork.add('.');
    await ownerWork.commit('Add the tuning song');
    await ownerWork.pushHTTP(url, owner.cookieHeader());

    // An editor accepts and joins; the book appears on its shelf.
    const editorInv = await createInvitation(owner, book.id, { role: 'editor' });
    const editor = new HttpClient();
    await registerNewAccount(editor);
    const editorAccept = await acceptInvitation(editor, tokenFromUrl(editorInv.url));
    expect(editorAccept.status).toBe(200);
    const accepted = await editorAccept.json();
    expect(accepted.id).toBe(book.id);
    expect(accepted.role).toBe('editor');
    expect(findBook(await editor.getJson('/api/books'), book.id)).toBeTruthy();

    // The editor clones over HTTP and pushes a second commit — editors may push.
    const editorDir = await tempDir('estante-e2e-share-editor-');
    const editorWork = await GitCli.cloneHTTP(url, editorDir, editor.cookieHeader());
    expect(await readFile(join(editorDir, sampleSong.filename), 'utf8')).toBe(sampleSong.content);
    await writeFile(join(editorDir, 'segundo.cifra.md'), '# Segundo\n\n```cifra\n[Am]Teste\n```\n');
    await editorWork.add('.');
    await editorWork.commit('Add a second song as editor');
    await editorWork.pushHTTP(url, editor.cookieHeader());

    // A reader accepts, clones successfully, but its push is refused (403).
    const readerInv = await createInvitation(owner, book.id, { role: 'reader' });
    const reader = new HttpClient();
    await registerNewAccount(reader);
    const readerAccept = await acceptInvitation(reader, tokenFromUrl(readerInv.url));
    expect(readerAccept.status).toBe(200);
    expect((await readerAccept.json()).role).toBe('reader');

    const readerDir = await tempDir('estante-e2e-share-reader-');
    const readerWork = await GitCli.cloneHTTP(url, readerDir, reader.cookieHeader());
    expect(await readFile(join(readerDir, sampleSong.filename), 'utf8')).toBe(sampleSong.content);
    await writeFile(join(readerDir, 'terceiro.cifra.md'), '# Terceiro\n\n```cifra\n[C]Nao vai\n```\n');
    await readerWork.add('.');
    await readerWork.commit('A reader tries to push');
    await expect(readerWork.pushHTTP(url, reader.cookieHeader())).rejects.toThrow();
  });

  it('a full book refuses a join (409 book_full)', async () => {
    const owner = new HttpClient();
    await registerNewAccount(owner);
    const book = await createBook(owner, 'Full Book');
    const inv = await createInvitation(owner, book.id, { role: 'reader' });

    // Seed the book to fifty members directly (a precondition no endpoint
    // shapes; the cap is enforced at accept, workflow 10 lines 28-38).
    const sql = connect();
    try {
      await sql`
        WITH a AS (
          INSERT INTO accounts (email) SELECT NULL::text FROM generate_series(1, 50) RETURNING id
        )
        INSERT INTO memberships (book_id, account_id, role) SELECT ${book.id}, id, 'reader' FROM a`;
    } finally {
      await sql.end({ timeout: 5 });
    }

    const latecomer = new HttpClient();
    await registerNewAccount(latecomer);
    const resp = await acceptInvitation(latecomer, tokenFromUrl(inv.url));
    expect(resp.status).toBe(409);
    expect((await resp.json()).code).toBe('book_full');
  });

  it('a withdrawn invitation refuses a new join while an already-joined member keeps access', async () => {
    const owner = new HttpClient();
    await registerNewAccount(owner);
    const book = await createBook(owner, 'Withdrawable Book');
    const inv = await createInvitation(owner, book.id, { role: 'reader' });
    const token = tokenFromUrl(inv.url);

    // A member joins before the withdrawal.
    const member = new HttpClient();
    await registerNewAccount(member);
    expect((await acceptInvitation(member, token)).status).toBe(200);
    expect(findBook(await member.getJson('/api/books'), book.id)).toBeTruthy();

    // The owner withdraws the invitation.
    const withdraw = await owner.fetch(`/api/books/${book.id}/invitations/${inv.id}`, { method: 'DELETE' });
    expect(withdraw.status).toBe(204);

    // A new account can no longer join; the earlier member still has the book.
    const latecomer = new HttpClient();
    await registerNewAccount(latecomer);
    const resp = await acceptInvitation(latecomer, token);
    expect(resp.status).toBe(409);
    expect((await resp.json()).code).toBe('invitation_withdrawn');
    expect(findBook(await member.getJson('/api/books'), book.id)).toBeTruthy();
  });
});
