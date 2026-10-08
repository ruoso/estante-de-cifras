/**
 * e2e-api — the two-device sync journey's service half (workflow 8; DIRECTION
 * §3.1, §3.3; change check api/openapi.yaml:375). Two isomorphic-git devices
 * against the compose stack: A and B clone a shared book and record heads; both
 * edit different sections and A pushes; B calls POST /api/shelf/change-check,
 * sees the book `changed` with the new head, fetches, cifra-aware-merges cleanly
 * (through the app's real merge driver, the same cifra.md `merge` the Worker
 * wires), pushes the merge commit — accepted by the real pre-receive hook — and
 * A fetches it back.
 *
 * The merge driver is imported from the app (app/src/worker/cifra-merge-driver.js),
 * the production code the Worker runs; it is framework-free and resolves
 * `cifra-md` from the app's own node_modules. Sessions come the way a device's
 * would, via the passkey ceremony; memberships are seeded directly (no sharing
 * API is needed here, as change-check.test.js does). Every test works in its own
 * mkdtemp directory and cleans it up. All songs are written for this test —
 * never anyone's words.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import * as git from 'isomorphic-git';

import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';
import { connect } from './lib/db.js';
import { IsoGit, makeTempDir } from './lib/git.js';
import { createCifraMergeDriver } from '../../app/src/worker/cifra-merge-driver.js';

const SONG = 'song.cifra.md';
// A base song with two separate sections; A edits the verse, B edits the
// chorus — non-touching, so the cifra-aware rules merge them cleanly (§11).
const BASE_SONG = `# Sync Journey Song

## Verse
First verse line
Second verse line

## Chorus
First chorus line
Second chorus line
`;
const VERSE_EDIT = BASE_SONG.replace('First verse line', 'First verse line edited by A');
const CHORUS_EDIT = BASE_SONG.replace('Second chorus line', 'Second chorus line edited by B');

const AUTHOR = { name: 'Device', email: 'device@users.estantedecifras.app' };

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

const headOf = (dev) => git.resolveRef({ fs: dev.fs, dir: dev.dir, ref: 'main' });

// The device-side cifra-aware merge: merge the fetched origin into local main
// through the app's real merge driver, make the two-parent merge commit (or
// fast-forward) and bring the working copy to it — exactly what the engine does.
async function cifraAwareMerge(dev) {
  const result = await git.merge({
    fs: dev.fs,
    dir: dev.dir,
    ours: 'main',
    theirs: 'refs/remotes/origin/main',
    author: AUTHOR,
    committer: AUTHOR,
    abortOnConflict: true,
    mergeDriver: createCifraMergeDriver(),
    message: 'Merge',
    fastForward: true,
  });
  await git.checkout({ fs: dev.fs, dir: dev.dir, ref: 'main', force: true });
  return result;
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

describe('two-device sync over the stack (workflow 8)', () => {
  it('B fetches A’s change, cifra-aware-merges cleanly, pushes the merge commit, and A fetches it back', async () => {
    const a = new HttpClient();
    await registerNewAccount(a);
    const book = await createBook(a, 'Shared Book');
    const url = gitEndpoint(book);
    const aCookie = a.cookieHeader();

    // A seeds the empty book with the base song and pushes it.
    const aDir = await tempDir('estante-e2e-sync-a-');
    const aGit = await IsoGit.create(aDir);
    await aGit.init();
    // A created this book, so (like a real created-book device) it configures
    // its own origin remote — url + fetch refspec — rather than cloning it. The
    // refspec is what lets A fetch the merge back at the end of the journey.
    await aGit.addRemote('origin', url);
    await writeFile(join(aDir, SONG), BASE_SONG);
    await aGit.add(SONG);
    await aGit.commit('Add the base song', AUTHOR);
    await aGit.push({ url, cookie: aCookie });

    // B registers; A shares the book with B as an editor (so B may push).
    const b = new HttpClient();
    const bId = await registerNewAccount(b);
    const sql = connect();
    try {
      await sql`INSERT INTO memberships (book_id, account_id, role) VALUES (${book.id}, ${bId}, 'editor')`;
    } finally {
      await sql.end({ timeout: 5 });
    }
    const bCookie = b.cookieHeader();

    // B clones and records the head its device holds.
    const bDir = await tempDir('estante-e2e-sync-b-');
    const bGit = await IsoGit.create(bDir);
    await bGit.clone({ url, cookie: bCookie });
    const bHeadBefore = await headOf(bGit);

    // Both edit different sections. A commits the verse edit and pushes it.
    await writeFile(join(aDir, SONG), VERSE_EDIT);
    await aGit.add(SONG);
    await aGit.commit('A edits the verse', AUTHOR);
    await aGit.push({ url, cookie: aCookie });
    const aHeadAfter = await headOf(aGit);

    // B commits the chorus edit locally (an already-saved edit, diverging).
    await writeFile(join(bDir, SONG), CHORUS_EDIT);
    await bGit.add(SONG);
    await bGit.commit('B edits the chorus', AUTHOR);

    // B's change check: the book comes back changed with A's new head.
    const ccResp = await b.postJson('/api/shelf/change-check', {
      books: [{ bookId: book.id, head: bHeadBefore }],
    });
    expect(ccResp.status).toBe(200);
    const change = (await ccResp.json()).books.find((x) => x.bookId === book.id);
    expect(change).toBeTruthy();
    expect(change.status).toBe('changed');
    expect(change.head).toBe(aHeadAfter);

    // B fetches only the changed book, cifra-aware-merges cleanly, and pushes
    // the merge commit — accepted by the real pre-receive hook as canonical.
    await bGit.fetch({ url, cookie: bCookie });
    const merge = await cifraAwareMerge(bGit);
    expect(merge.mergeCommit).toBe(true); // a two-parent merge, not a fast-forward
    const mergeHead = await headOf(bGit);
    const { commit: mergeCommit } = await git.readCommit({ fs: bGit.fs, dir: bGit.dir, oid: mergeHead });
    expect(mergeCommit.parent).toHaveLength(2);

    const mergedText = await bGit.readFileAtHead(SONG);
    expect(mergedText).toContain('First verse line edited by A');
    expect(mergedText).toContain('Second chorus line edited by B');

    await bGit.push({ url, cookie: bCookie }); // the hook accepts the canonical merge

    // A fetches the merge back and sees both edits — the two-device journey's
    // sync half is complete.
    await aGit.fetch({ url, cookie: aCookie });
    const aTracked = await git.resolveRef({ fs: aGit.fs, dir: aGit.dir, ref: 'refs/remotes/origin/main' });
    expect(aTracked).toBe(mergeHead); // A's device sees the merge the service holds
    // Read the fetched merge commit's blob (A's own `main` has not moved).
    const { blob } = await git.readBlob({ fs: aGit.fs, dir: aGit.dir, oid: mergeHead, filepath: SONG });
    const aMerged = new TextDecoder().decode(blob);
    expect(aMerged).toContain('First verse line edited by A');
    expect(aMerged).toContain('Second chorus line edited by B');
  });
});
