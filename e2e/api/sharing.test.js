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
 * new join while an already-joined member keeps access. And service.leave_book's
 * clause: a member who joined by invitation leaves and can no longer clone,
 * while the owner cannot leave (workflow 10 §Leaving a book, §Edge cases).
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
import { GitCli, IsoGit, makeTempDir } from './lib/git.js';
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

// A home book as the owner's device brings it online: the exact §2.2 README and
// .gitattributes and a canonical §6 preferences.json holding the name the owner
// gives their saves (docs/home-book-format.md §4.1 authorName) — the bytes the
// hook accepts, as home-book.test.js pushes them.
const homeReadme =
  '# Home book\n' +
  '\n' +
  'This repository holds one person\'s Estante de Cifras settings. Its files are\n' +
  'JSON that merge key by key, the later change winning; it is written and merged\n' +
  'by the app, not edited by hand. The format is docs/home-book-format.md in the\n' +
  'estante-de-cifras repository.\n';
const homeGitattributes = '* text=auto eol=lf\n*.json merge=binary\n';
const namedPreferences =
  '{\n' +
  '  "authorName": {\n' +
  '    "at": "2026-10-05T14:29:12.500Z",\n' +
  '    "value": "Ana Lima"\n' +
  '  }\n' +
  '}\n';

// preferences.json naming `name` (§4.1 authorName, canonical §6).
function preferencesNaming(name) {
  return `{\n  "authorName": {\n    "at": "2026-10-05T14:29:12.500Z",\n    "value": ${JSON.stringify(name)}\n  }\n}\n`;
}

const tempDirs = [];

// The signed-in account's device brings its home book online with an
// authorName, with the git CLI through the hook (as the ownerName case does).
async function nameOnService(client, name) {
  const homeResp = await client.get('/api/account/home-book');
  expect(homeResp.status).toBe(200);
  const home = await homeResp.json();
  const dir = await tempDir('estante-e2e-home-');
  const work = await GitCli.create(dir);
  await work.init();
  await writeFile(join(dir, 'README.md'), homeReadme);
  await writeFile(join(dir, '.gitattributes'), homeGitattributes);
  await writeFile(join(dir, 'preferences.json'), preferencesNaming(name));
  await work.add('.');
  await work.commit('Bring the home book online');
  await work.pushHTTP(gitEndpoint(home), client.cookieHeader());
}

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
    await writeFile(join(editorDir, 'segundo.cifra.md'), '# Segundo\n\n```\n[Am] Teste\n```\n');
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

  // service.leave_book e2e-api: "joins by invitation, leaves, and can no longer
  // clone" (workflow 10 §Leaving a book lines 121-122) and "the owner cannot
  // leave" (§Edge cases lines 140-141).
  it('a member who leaves can no longer clone, and the owner cannot leave', async () => {
    const owner = new HttpClient();
    await registerNewAccount(owner);
    const book = await createBook(owner, 'Leavable Book');
    const url = gitEndpoint(book);

    const ownerDir = await tempDir('estante-e2e-leave-owner-');
    const ownerWork = await GitCli.create(ownerDir);
    await ownerWork.init();
    await writeFile(join(ownerDir, sampleSong.filename), sampleSong.content);
    await ownerWork.add('.');
    await ownerWork.commit('Add the tuning song');
    await ownerWork.pushHTTP(url, owner.cookieHeader());

    // A reader joins by invitation and clones.
    const inv = await createInvitation(owner, book.id, { role: 'reader' });
    const member = new HttpClient();
    const memberId = await registerNewAccount(member);
    expect((await acceptInvitation(member, tokenFromUrl(inv.url))).status).toBe(200);
    const firstDir = await tempDir('estante-e2e-leave-member-');
    await GitCli.cloneHTTP(url, firstDir, member.cookieHeader());
    expect(await readFile(join(firstDir, sampleSong.filename), 'utf8')).toBe(sampleSong.content);

    // The member leaves, without asking the owner.
    const leave = await member.fetch(`/api/books/${book.id}/membership`, { method: 'DELETE' });
    expect(leave.status).toBe(204);

    // The book is gone from their shelf and refused to their git clients.
    expect(findBook(await member.getJson('/api/books'), book.id)).toBeUndefined();
    const refs = await member.get(`/git/${book.id}/info/refs?service=git-upload-pack`);
    expect(refs.status).toBe(404);
    const cliDir = await tempDir('estante-e2e-leave-cli-');
    await expect(GitCli.cloneHTTP(url, cliDir, member.cookieHeader())).rejects.toThrow();
    const iso = await IsoGit.create(await tempDir('estante-e2e-leave-iso-'));
    await expect(iso.clone({ url, cookie: member.cookieHeader() })).rejects.toThrow();

    // The owner's people list no longer shows them.
    const people = await owner.getJson(`/api/books/${book.id}/members`);
    expect(people.members.some((m) => m.userId === memberId)).toBe(false);
    expect(people.count).toBe(0);

    // Nothing left to leave: a second leave is 404.
    const again = await member.fetch(`/api/books/${book.id}/membership`, { method: 'DELETE' });
    expect(again.status).toBe(404);
    expect((await again.json()).code).toBe('not_found');

    // The owner cannot leave their own book.
    const ownerLeave = await owner.fetch(`/api/books/${book.id}/membership`, { method: 'DELETE' });
    expect(ownerLeave.status).toBe(409);
    expect((await ownerLeave.json()).code).toBe('owner_cannot_leave');
    expect(findBook(await owner.getJson('/api/books'), book.id)).toBeTruthy();
  });

  // books.owner_name (workflow 10 §Leaving a book, §Who sees whom; DIRECTION
  // §3.3): the service reads the owner's name from their home book and tells the
  // book's members — on the accept and on the member's listing — and no one
  // else: the owner's own listing carries none.
  it("a member's listBooks carries the owner's name", async () => {
    const owner = new HttpClient();
    await registerNewAccount(owner);

    // The owner's device brings its home book online with an authorName, with
    // the git CLI through the hook.
    const homeResp = await owner.get('/api/account/home-book');
    expect(homeResp.status).toBe(200);
    const home = await homeResp.json();
    const homeDir = await tempDir('estante-e2e-owner-home-');
    const homeWork = await GitCli.create(homeDir);
    await homeWork.init();
    await writeFile(join(homeDir, 'README.md'), homeReadme);
    await writeFile(join(homeDir, '.gitattributes'), homeGitattributes);
    await writeFile(join(homeDir, 'preferences.json'), namedPreferences);
    await homeWork.add('.');
    await homeWork.commit('Bring the home book online');
    await homeWork.pushHTTP(gitEndpoint(home), owner.cookieHeader());

    // The owner creates a book and invites; a second account accepts.
    const book = await createBook(owner, 'Choros Compartilhados');
    expect(book.ownerName).toBeUndefined();
    const inv = await createInvitation(owner, book.id, { role: 'reader' });
    const member = new HttpClient();
    await registerNewAccount(member);
    const acceptResp = await acceptInvitation(member, tokenFromUrl(inv.url));
    expect(acceptResp.status).toBe(200);
    expect((await acceptResp.json()).ownerName).toBe('Ana Lima');

    // The member's listing names the owner; the owner's own does not.
    expect(findBook(await member.getJson('/api/books'), book.id).ownerName).toBe('Ana Lima');
    const ownList = await owner.getJson('/api/books');
    expect(findBook(ownList, book.id)).toBeTruthy();
    expect(ownList.books.every((b) => !('ownerName' in b))).toBe(true);
  });

  // books.share_people (workflow 10 §Who sees whom, §Invitations; DIRECTION
  // §3.3): members and joiners are named by the name they give their saves,
  // within who-sees-whom, and the owner's list carries an open invitation's
  // link again — the same link, which still lets someone in — until withdrawn.
  it("members and invitations carry the names people gave their saves, and the owner copies an open invitation's link again", async () => {
    const owner = new HttpClient();
    const ownerId = await registerNewAccount(owner);
    await nameOnService(owner, 'Ana');
    const book = await createBook(owner, 'Choros da Ana');
    const inv = await createInvitation(owner, book.id, { role: 'reader', expiry: 'until-withdrawn' });

    const bia = new HttpClient();
    const biaId = await registerNewAccount(bia);
    await nameOnService(bia, 'Bia Rocha');
    expect((await acceptInvitation(bia, tokenFromUrl(inv.url))).status).toBe(200);

    // The owner's members name Bia; the invitation names her as its joiner and
    // carries the very link the create returned.
    const members = await owner.getJson(`/api/books/${book.id}/members`);
    expect(members.members.find((m) => m.userId === biaId)?.displayName).toBe('Bia Rocha');
    expect(members.members.find((m) => m.userId === ownerId)?.displayName).toBe('Ana');
    let listed = (await owner.getJson(`/api/books/${book.id}/invitations`)).invitations.find((i) => i.id === inv.id);
    expect(listed.joined.map((j) => j.displayName)).toEqual(['Bia Rocha']);
    expect(listed.url).toBe(inv.url);

    // A third person joins through the listed link.
    const third = new HttpClient();
    const thirdId = await registerNewAccount(third);
    expect((await acceptInvitation(third, tokenFromUrl(listed.url))).status).toBe(200);
    expect(findBook(await third.getJson('/api/books'), book.id)).toBeTruthy();
    listed = (await owner.getJson(`/api/books/${book.id}/invitations`)).invitations.find((i) => i.id === inv.id);
    expect(listed.joined.map((j) => j.userId).sort()).toEqual([biaId, thirdId].sort());
    // Someone with no name carries none — never an id in its place.
    expect(listed.joined.find((j) => j.userId === thirdId).displayName).toBeUndefined();

    // Withdrawn, the invitation has no link to copy.
    expect((await owner.fetch(`/api/books/${book.id}/invitations/${inv.id}`, { method: 'DELETE' })).status).toBe(204);
    listed = (await owner.getJson(`/api/books/${book.id}/invitations`)).invitations.find((i) => i.id === inv.id);
    expect(listed.withdrawn).toBe(true);
    expect(listed.url).toBeUndefined();

    // A reader sees the owner, named, and no reader at all.
    const asReader = await bia.getJson(`/api/books/${book.id}/members`);
    expect(asReader.members).toEqual([{ userId: ownerId, role: 'owner', displayName: 'Ana' }]);
    expect(asReader.count).toBe(2);
  });
});
