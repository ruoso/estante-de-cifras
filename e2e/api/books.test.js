/**
 * e2e-api — books: create, list, fork, delete, end to end (workflows 7, 11, 14;
 * DIRECTION §3.6 one origin).
 *
 * Pins the service.books e2e clause: black-box over HTTP against the compose
 * stack (the service's image with git, Postgres), with a session obtained the
 * way a device would — here via the passkey ceremony, driving the JS software
 * authenticator (no seeded email, no song text; synthetic accounts the flow
 * creates). Pushing to a created book is NOT exercised here: git over HTTP is
 * service.git_http, downstream of this task — the title-from-README path is
 * pinned at behavior level by seeding a bare repo directly.
 *
 * Two setup steps reach Postgres directly through the harness's db seam
 * (lib/db.js): a membership row (no sharing API yet — service.sharing is
 * downstream) and a bulk of books to trip the per-account quota. Both are
 * fixture-shaping the API has no endpoint for yet, not assertions.
 */
import { describe, it, expect } from 'vitest';

import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';
import { connect } from './lib/db.js';

async function registerNewAccount(client, authenticator) {
  const beginResp = await client.postJson('/api/auth/passkey/register/begin', {});
  expect(beginResp.status).toBe(200);
  const begin = await beginResp.json();
  const credential = await authenticator.create(begin.publicKey);
  const finishResp = await client.postJson('/api/auth/passkey/register/finish', {
    state: begin.state,
    credential,
  });
  expect(finishResp.status).toBe(200);
  const account = await finishResp.json();
  expect(account.id).toBeTruthy();
  expect(client.cookies.has('estante_session')).toBe(true);
  return account.id;
}

function findBook(list, id) {
  return list.books.find((b) => b.id === id);
}

describe('books (workflows 7 and 11)', () => {
  it('creates, lists, forks and deletes a book over HTTP', async () => {
    const client = new HttpClient();
    await registerNewAccount(client, new Authenticator(baseUrl));

    // Create: a private book owned by the caller, with a git remote URL.
    const createResp = await client.postJson('/api/books', { title: 'My Choros' });
    expect(createResp.status).toBe(201);
    const book = await createResp.json();
    expect(book.id).toBeTruthy();
    expect(book.title).toBe('My Choros');
    expect(book.role).toBe('owner');
    expect(book.visibility).toBe('private');
    expect(book.gitUrl).toContain(`/git/${book.id}`);
    expect(book.original ?? null).toBeNull();

    // List sees the new book owned by the caller.
    let list = await client.getJson('/api/books');
    const listed = findBook(list, book.id);
    expect(listed).toBeTruthy();
    expect(listed.role).toBe('owner');
    expect(listed.visibility).toBe('private');

    // Fork it; list sees the fork with its single-level original.
    const forkResp = await client.postJson(`/api/books/${book.id}/fork`, {});
    expect(forkResp.status).toBe(201);
    const fork = await forkResp.json();
    expect(fork.id).not.toBe(book.id);
    expect(fork.role).toBe('owner');
    expect(fork.original).toBeTruthy();
    expect(fork.original.bookId).toBe(book.id);

    list = await client.getJson('/api/books');
    const listedFork = findBook(list, fork.id);
    expect(listedFork).toBeTruthy();
    expect(listedFork.original.bookId).toBe(book.id);

    // Delete the source; it drops from the list, and the fork survives.
    const deleteResp = await client.fetch(`/api/books/${book.id}`, { method: 'DELETE' });
    expect(deleteResp.status).toBe(204);

    list = await client.getJson('/api/books');
    expect(findBook(list, book.id)).toBeUndefined();
    expect(findBook(list, fork.id)).toBeTruthy();
  });

  it("refuses a second account's delete and an over-quota create", async () => {
    const owner = new HttpClient();
    await registerNewAccount(owner, new Authenticator(baseUrl));
    const created = await owner.postJson('/api/books', { title: 'Private Book' });
    expect(created.status).toBe(201);
    const book = await created.json();

    const stranger = new HttpClient();
    const strangerId = await registerNewAccount(stranger, new Authenticator(baseUrl));

    // A non-member is told the book does not exist (404) and never sees it.
    const nonMemberDelete = await stranger.fetch(`/api/books/${book.id}`, { method: 'DELETE' });
    expect(nonMemberDelete.status).toBe(404);
    const strangerList = await stranger.getJson('/api/books');
    expect(findBook(strangerList, book.id)).toBeUndefined();

    // Made a member directly (no sharing API yet — service.sharing is
    // downstream), the stranger may open the book but still cannot delete it:
    // delete is owner-only (403).
    const sql = connect();
    try {
      await sql`INSERT INTO memberships (book_id, account_id, role) VALUES (${book.id}, ${strangerId}, 'editor')`;
    } finally {
      await sql.end({ timeout: 5 });
    }
    const memberDelete = await stranger.fetch(`/api/books/${book.id}`, { method: 'DELETE' });
    expect(memberDelete.status).toBe(403);

    // Not signed in -> 401.
    const anon = new HttpClient();
    const anonList = await anon.get('/api/books');
    expect(anonList.status).toBe(401);

    // Over the 100-book quota -> 413. A fresh account is seeded with 100 books
    // directly, so its next create over HTTP is the 101st (quota is a code
    // constant, workflow 14 lines 42-43).
    const quotaClient = new HttpClient();
    const quotaId = await registerNewAccount(quotaClient, new Authenticator(baseUrl));
    const sql2 = connect();
    try {
      await sql2`INSERT INTO books (owner_id) SELECT ${quotaId}::uuid FROM generate_series(1, 100)`;
    } finally {
      await sql2.end({ timeout: 5 });
    }
    const overQuota = await quotaClient.postJson('/api/books', { title: 'One Too Many' });
    expect(overQuota.status).toBe(413);
  });
});
