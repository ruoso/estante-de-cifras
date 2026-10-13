/**
 * e2e-api — account deletion and its cascade, end to end (account.leaving,
 * workflow 17 §The cascade lines 115-136, §What happens to books others are
 * members of lines 85-113; DIRECTION §3.3 / §3.6).
 *
 * Black-box over HTTP and real git clients against the compose stack, with
 * sessions obtained the way a device would (the passkey ceremony driving the JS
 * software authenticator — no seeded email, no song text). A passkey account's
 * email is NULL, so the one thing seeded through the db seam (lib/db.js) is the
 * leaver's email, the thing the confirm type-matches — a precondition, not an
 * assertion. A fork is likewise seeded straight (no endpoint shapes a cross-account
 * fork of a private book here), to prove it survives its original's deletion.
 *
 * Pins: DELETE /api/account removes the account, its sessions and passkeys, drops
 * its memberships and withdraws its invitations, and soft-deletes + removes the
 * repos of the books it owns — so an owned book is deleted for everyone (a member
 * is refused its git endpoint and it leaves their shelf), while a book the leaver
 * was only a member of is untouched but for that one membership, and a fork
 * survives with original_book_id nulled. A wrong email is 400 and deletes nothing;
 * an unauthenticated call is 401.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
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

function acceptInvitation(client, token) {
  return client.fetch(`/api/invitations/${token}/accept`, { method: 'POST' });
}

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

// DELETE /api/account with the typed-email confirm in the body (the one call the
// app makes that waits for a connection; DeleteAccountRequest { confirm }).
function deleteAccount(client, confirm) {
  return client.fetch('/api/account', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirm }),
  });
}

// Push a first commit so the book is cloneable.
async function seedFirstCommit(url, cookie, dir) {
  const work = await GitCli.create(dir);
  await work.init();
  await writeFile(join(dir, sampleSong.filename), sampleSong.content);
  await work.add('.');
  await work.commit('Add the tuning song');
  await work.pushHTTP(url, cookie);
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

describe('account deletion (workflow 17)', () => {
  it('cascades: owned books gone for everyone, member-only book kept, a fork nulled; wrong email 400, no session 401', async () => {
    const rand = Math.random().toString(36).slice(2);
    const email = `leaver-${rand}@example.test`;

    // Owner A, with an email to type-match (a passkey account has none).
    const a = new HttpClient();
    const aId = await registerNewAccount(a);
    const bookA = await createBook(a, 'Banda do Bairro');
    const urlA = gitEndpoint(bookA);
    await seedFirstCommit(urlA, a.cookieHeader(), await tempDir('estante-e2e-acct-a-'));

    // B joins A's book as a member (editor).
    const b = new HttpClient();
    const bId = await registerNewAccount(b);
    const invB = await createInvitation(a, bookA.id, { role: 'editor' });
    expect((await acceptInvitation(b, tokenFromUrl(invB.url))).status).toBe(200);
    expect(findBook(await b.getJson('/api/books'), bookA.id)).toBeTruthy();

    // B owns a book of their own; A is only a member of it.
    const bookB = await createBook(b, 'Choros da Ana');
    const urlB = gitEndpoint(bookB);
    await seedFirstCommit(urlB, b.cookieHeader(), await tempDir('estante-e2e-acct-b-'));
    const invA = await createInvitation(b, bookB.id, { role: 'reader' });
    expect((await acceptInvitation(a, tokenFromUrl(invA.url))).status).toBe(200);

    // Seed A's email and a cross-account fork of A's book (preconditions).
    let forkerId;
    let forkId;
    {
      const sql = connect();
      try {
        await sql`UPDATE accounts SET email = ${email} WHERE id = ${aId}`;
        const made = await sql`INSERT INTO accounts (email) VALUES (NULL) RETURNING id`;
        forkerId = made[0].id;
        const fork = await sql`
          INSERT INTO books (owner_id, original_book_id) VALUES (${forkerId}, ${bookA.id}) RETURNING id`;
        forkId = fork[0].id;
      } finally {
        await sql.end({ timeout: 5 });
      }
    }

    // No session → 401.
    expect((await deleteAccount(new HttpClient(), email)).status).toBe(401);

    // Wrong email → 400, and nothing is deleted.
    expect((await deleteAccount(a, 'not-the-address@example.test')).status).toBe(400);
    expect((await a.get('/api/account/sessions')).status).toBe(200);

    // Right email → 204.
    const gone = await deleteAccount(a, email);
    expect(gone.status).toBe(204);

    // A's session no longer resolves.
    expect((await a.get('/api/account/sessions')).status).toBe(401);

    // A's owned book is deleted for everyone: its git endpoint is refused for B
    // (git never spawned) and it has left B's shelf.
    const bClone = await tempDir('estante-e2e-acct-bclone-');
    await expect(GitCli.cloneHTTP(urlA, bClone, b.cookieHeader())).rejects.toThrow();
    expect(findBook(await b.getJson('/api/books'), bookA.id)).toBeFalsy();

    // B's own book is untouched: B still owns it; only A's membership is gone.
    const bBook = findBook(await b.getJson('/api/books'), bookB.id);
    expect(bBook).toBeTruthy();
    expect(bBook.role).toBe('owner');

    // The registry: every row owned by A is gone, the fork survives nulled.
    const sql = connect();
    try {
      const n = async (q) => (await q)[0].n;
      expect(await n(sql`SELECT count(*)::int AS n FROM accounts WHERE id = ${aId}`)).toBe(0);
      expect(await n(sql`SELECT count(*)::int AS n FROM sessions WHERE account_id = ${aId}`)).toBe(0);
      expect(await n(sql`SELECT count(*)::int AS n FROM passkeys WHERE account_id = ${aId}`)).toBe(0);
      expect(await n(sql`SELECT count(*)::int AS n FROM books WHERE owner_id = ${aId}`)).toBe(0);
      expect(await n(sql`SELECT count(*)::int AS n FROM memberships WHERE account_id = ${aId}`)).toBe(0);
      expect(await n(sql`SELECT count(*)::int AS n FROM invitations WHERE book_id = ${bookA.id}`)).toBe(0);
      // B and B's book remain; A's membership in B's book is dropped.
      expect(await n(sql`SELECT count(*)::int AS n FROM accounts WHERE id = ${bId}`)).toBe(1);
      expect(await n(sql`SELECT count(*)::int AS n FROM books WHERE id = ${bookB.id} AND owner_id = ${bId}`)).toBe(1);
      expect(await n(sql`SELECT count(*)::int AS n FROM memberships WHERE book_id = ${bookB.id} AND account_id = ${aId}`)).toBe(0);
      // The fork survives its original's deletion, original_book_id nulled.
      expect(await n(sql`SELECT count(*)::int AS n FROM books WHERE id = ${forkId} AND owner_id = ${forkerId} AND original_book_id IS NULL`)).toBe(1);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
