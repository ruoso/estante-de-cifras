/**
 * e2e-api — admin: a copyright notice, end to end (service.admin; workflow 10
 * lines 103-115; DIRECTION §3.6 lines 338-341).
 *
 * Black-box over HTTP and real git clients against the compose stack. The
 * operator's three moderation actions are a server-side command, not an endpoint
 * (refinement Decisions), so the suite does not shell the binary: it applies the
 * operator *effect* through the harness's sanctioned db seam (lib/db.js connect(),
 * "to seed a precondition that no landed endpoint yet provides"), then asserts the
 * stack's observable refusals — the valuable integration (the git 403 taken_down
 * reason over the real stack; a withdrawn accept → 409). The binary's own rows and
 * notice are pinned by the Go behavior tests against real Postgres.
 *
 * Pins the task note e2e clause: a taken-down book refuses clone and push with its
 * reason; withdrawn invitations are no longer accepted.
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

// infoRefs hits a git route's advertisement through HttpClient — the only path
// that exposes a structured status + {code,message}; the GitCli wrappers only
// reject on a refusal. service is 'git-upload-pack' (clone/fetch advertisement) or
// 'git-receive-pack' (push advertisement).
function infoRefs(client, bookId, service) {
  return client.get(`/git/${bookId}/info/refs?service=${service}`);
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

describe('admin: a copyright notice (workflow 10)', () => {
  it('a taken-down book refuses clone and push with its reason; a stranger gets 404', async () => {
    const owner = new HttpClient();
    await registerNewAccount(owner);
    const book = await createBook(owner, 'To Be Taken Down');
    const url = gitEndpoint(book);

    // The owner seeds a first commit, and an editor accepts and clones it — the
    // book is live and shared before the notice.
    const ownerDir = await tempDir('estante-e2e-admin-owner-');
    const ownerWork = await GitCli.create(ownerDir);
    await ownerWork.init();
    await writeFile(join(ownerDir, sampleSong.filename), sampleSong.content);
    await ownerWork.add('.');
    await ownerWork.commit('Add the tuning song');
    await ownerWork.pushHTTP(url, owner.cookieHeader());

    const editorInv = await createInvitation(owner, book.id, { role: 'editor' });
    const editor = new HttpClient();
    await registerNewAccount(editor);
    expect((await acceptInvitation(editor, tokenFromUrl(editorInv.url))).status).toBe(200);
    const editorDir = await tempDir('estante-e2e-admin-editor-');
    await GitCli.cloneHTTP(url, editorDir, editor.cookieHeader());

    // The operator takes the book down (the effect the estante-admin command
    // commits; seeded here through the db seam).
    const reason = 'Copyright notice: removed on a rights-holder request.';
    const sql = connect();
    try {
      await sql`UPDATE books SET taken_down_reason = ${reason} WHERE id = ${book.id}::uuid`;
    } finally {
      await sql.end({ timeout: 5 });
    }

    // The owner and the editor are refused 403 taken_down carrying the reason, on
    // both the clone (upload-pack) and the push (receive-pack) advertisements.
    for (const [who, client] of [['owner', owner], ['editor', editor]]) {
      for (const service of ['git-upload-pack', 'git-receive-pack']) {
        const resp = await infoRefs(client, book.id, service);
        expect(resp.status, `${who} ${service}`).toBe(403);
        const err = await resp.json();
        expect(err.code, `${who} ${service} code`).toBe('taken_down');
        expect(err.message, `${who} ${service} reason`).toContain(reason);
      }
    }

    // And the real git clients fail: a fresh clone and a push are both refused.
    const retryDir = await tempDir('estante-e2e-admin-retry-');
    await expect(GitCli.cloneHTTP(url, retryDir, owner.cookieHeader())).rejects.toThrow();
    await expect(ownerWork.pushHTTP(url, owner.cookieHeader())).rejects.toThrow();

    // A stranger (non-member) still learns nothing — 404, never the reason.
    const stranger = new HttpClient();
    await registerNewAccount(stranger);
    const strangerResp = await infoRefs(stranger, book.id, 'git-upload-pack');
    expect(strangerResp.status).toBe(404);
    expect((await strangerResp.json()).message).not.toContain(reason);
  });

  it('withdrawn invitations are no longer accepted; an already-joined member keeps access', async () => {
    const owner = new HttpClient();
    await registerNewAccount(owner);
    const book = await createBook(owner, 'Invitations To Withdraw');
    const inv = await createInvitation(owner, book.id, { role: 'editor' });
    const token = tokenFromUrl(inv.url);

    // A member joins before the operator acts.
    const member = new HttpClient();
    await registerNewAccount(member);
    expect((await acceptInvitation(member, token)).status).toBe(200);
    expect(findBook(await member.getJson('/api/books'), book.id)).toBeTruthy();

    // The operator withdraws all of the book's invitations (the estante-admin
    // effect, seeded through the db seam).
    const sql = connect();
    try {
      await sql`UPDATE invitations SET withdrawn_at = now() WHERE book_id = ${book.id}::uuid AND withdrawn_at IS NULL`;
    } finally {
      await sql.end({ timeout: 5 });
    }

    // A fresh account can no longer join through that token.
    const latecomer = new HttpClient();
    await registerNewAccount(latecomer);
    const resp = await acceptInvitation(latecomer, token);
    expect(resp.status).toBe(409);
    expect((await resp.json()).code).toBe('invitation_withdrawn');

    // The already-joined member still has the book.
    expect(findBook(await member.getJson('/api/books'), book.id)).toBeTruthy();
  });
});
