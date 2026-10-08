/**
 * e2e-api — the shelf change check, end to end (workflow 8 §When it runs;
 * DIRECTION §3.3; api/openapi.yaml changeCheck).
 *
 * Pins the service.change_check e2e clause: black-box over HTTP and real git
 * clients against the compose stack. Account A creates two books and shares both
 * with account B (membership seeded directly through lib/db.js, as books.test.js
 * does — no sharing API is needed here). B clones both and records the heads its
 * device holds. A pushes a commit to the first book only; B's change check for
 * both books returns the pushed book `changed` with the new head and omits the
 * untouched one — "a push from one client, then the change check from another
 * sees that book move and no other" (the .tji note).
 *
 * Sessions are obtained the way a device would, via the passkey ceremony driving
 * the JS software authenticator (no seeded email, no song text). Every test works
 * in its own mkdtemp directory and cleans it up.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';
import { connect } from './lib/db.js';
import { GitCli, makeTempDir } from './lib/git.js';
import { sampleSong } from './fixtures/songs.js';

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

describe('shelf change check (workflow 8)', () => {
  it('a push from one client, then the change check from another sees that book move and no other', async () => {
    const a = new HttpClient();
    await registerNewAccount(a);
    const moved = await createBook(a, 'Moved Book');
    const untouched = await createBook(a, 'Untouched Book');
    const movedUrl = gitEndpoint(moved);
    const untouchedUrl = gitEndpoint(untouched);
    const aCookie = a.cookieHeader();

    // A seeds a first commit on both books (they start empty).
    async function seedFirstCommit(url, prefix) {
      const dir = await tempDir(prefix);
      const work = await GitCli.create(dir);
      await work.init();
      await writeFile(join(dir, sampleSong.filename), sampleSong.content);
      await work.add('.');
      await work.commit('Add the tuning song');
      await work.pushHTTP(url, aCookie);
      return work;
    }
    const movedWork = await seedFirstCommit(movedUrl, 'estante-e2e-cc-moved-');
    await seedFirstCommit(untouchedUrl, 'estante-e2e-cc-untouched-');

    // B registers; A shares both books with B (membership seeded directly —
    // no sharing API is needed here).
    const b = new HttpClient();
    const bId = await registerNewAccount(b);
    const sql = connect();
    try {
      await sql`INSERT INTO memberships (book_id, account_id, role) VALUES (${moved.id}, ${bId}, 'reader')`;
      await sql`INSERT INTO memberships (book_id, account_id, role) VALUES (${untouched.id}, ${bId}, 'reader')`;
    } finally {
      await sql.end({ timeout: 5 });
    }
    const bCookie = b.cookieHeader();

    // B clones both books and records the head its device holds for each.
    async function cloneHead(url, prefix) {
      const dir = await tempDir(prefix);
      const clone = await GitCli.cloneHTTP(url, dir, bCookie);
      return (await clone.run('rev-parse', 'HEAD')).trim();
    }
    const movedHeadBefore = await cloneHead(movedUrl, 'estante-e2e-cc-bmoved-');
    const untouchedHead = await cloneHead(untouchedUrl, 'estante-e2e-cc-buntouched-');

    // A pushes a second commit to the first book only.
    await writeFile(join(movedWork.cwd, 'segundo.cifra.md'), '# Segundo\n\n```\n[Am] Teste\n```\n');
    await movedWork.add('.');
    await movedWork.commit('Add a second song');
    await movedWork.pushHTTP(movedUrl, aCookie);
    const movedHeadAfter = (await movedWork.run('rev-parse', 'HEAD')).trim();
    expect(movedHeadAfter).not.toBe(movedHeadBefore);

    // B's change check: the moved book comes back changed with the new head;
    // the untouched book is omitted.
    const resp = await b.postJson('/api/shelf/change-check', {
      books: [
        { bookId: moved.id, head: movedHeadBefore },
        { bookId: untouched.id, head: untouchedHead },
      ],
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();

    const movedChange = body.books.find((x) => x.bookId === moved.id);
    expect(movedChange).toBeTruthy();
    expect(movedChange.status).toBe('changed');
    expect(movedChange.head).toBe(movedHeadAfter);

    expect(body.books.find((x) => x.bookId === untouched.id)).toBeUndefined();
  });
});
