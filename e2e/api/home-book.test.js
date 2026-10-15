/**
 * e2e-api — the account's home book on the service (service.home_book).
 *
 * Black-box against the compose stack: an account signed in by passkey asks
 * GET /api/account/home-book for its home book (the same one on every call),
 * brings it online by pushing a canonical home book (the exact §2.2 README and
 * .gitattributes and a canonical preferences.json) with the git CLI — accepted
 * by the stack's pre-receive hook as settings, the kind coming from provisioning
 * rather than a hand UPDATE — and never sees it among its books. A second
 * session of the same account, signed in by the emailed link, is told the same
 * home book and clones the same bytes with the app's own client
 * (isomorphic-git); a second account cannot. Pins the note's "a signed-in client
 * gets its home book, pushes settings through the hook, a second session clones
 * the same bytes", workflow 13 (docs/workflows/13-new-device.md:31-36) and
 * docs/home-book-format.md §1, §8.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { GitCli, IsoGit, makeTempDir } from './lib/git.js';
import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';
import { connect } from './lib/db.js';
import { listMessages, getMessage, extractLink } from './lib/mail.js';

// The exact §2.2 bytes and a canonical §6 preferences.json a home book holds
// (docs/home-book-format.md), as git.test.js's hook.home_book case uses.
const homeReadme =
  '# Home book\n' +
  '\n' +
  'This repository holds one person\'s Estante de Cifras settings. Its files are\n' +
  'JSON that merge key by key, the later change winning; it is written and merged\n' +
  'by the app, not edited by hand. The format is docs/home-book-format.md in the\n' +
  'estante-de-cifras repository.\n';
const homeGitattributes = '* text=auto eol=lf\n*.json merge=binary\n';
const canonicalPreferences =
  '{\n' +
  '  "theme": {\n' +
  '    "at": "2026-10-05T14:30:00.000Z",\n' +
  '    "value": "palco"\n' +
  '  }\n' +
  '}\n';

function uniqueId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// A signed-in client the way a device signs in — the passkey ceremony driving
// the JS software authenticator. Mirrors git.test.js; copied because the helper
// is module-local there.
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

// Poll the catcher for a fresh message to `recipient` (sessions.test.js's
// helper; module-local there).
async function waitForNewMessageTo(recipient, seenIds, { timeout = 5000, interval = 100 } = {}) {
  const deadline = Date.now() + timeout;
  const target = recipient.toLowerCase();
  for (;;) {
    const { messages } = await listMessages();
    const summary = (messages ?? []).find(
      (m) => !seenIds.has(m.ID) && (m.To ?? []).some((a) => (a.Address ?? '').toLowerCase() === target),
    );
    if (summary) {
      seenIds.add(summary.ID);
      return getMessage(summary.ID);
    }
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

// Sign `client` in for `email` via the emailed link — a second session on the
// account (sessions.test.js's helper; module-local there).
async function signInViaEmail(client, email, seenIds) {
  const requested = await client.postJson('/api/auth/email/request', { email });
  expect(requested.status).toBe(202);

  const message = await waitForNewMessageTo(email, seenIds);
  expect(message, 'the sign-in mail should arrive at the catcher').not.toBeNull();
  const link = extractLink(message, /https?:\/\/\S*\/sign-in\/\S+/);
  expect(link, 'the mail should carry a /sign-in/<token> link').not.toBeNull();
  const token = link.slice(link.indexOf('/sign-in/') + '/sign-in/'.length).replace(/[\s"'<>]+$/, '');

  const redeemed = await client.postJson('/api/auth/email/redeem', { token });
  expect(redeemed.status).toBe(200);
  expect(client.cookies.has('estante_session')).toBe(true);
  return redeemed.json();
}

async function getHomeBook(client) {
  const resp = await client.get('/api/account/home-book');
  expect(resp.status).toBe(200);
  const book = await resp.json();
  expect(Object.keys(book).sort()).toEqual(['gitUrl', 'id']);
  return book;
}

// The home book's git endpoint, resolved against the one origin.
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

describe('the home book (service.home_book)', () => {
  it('is provisioned once, takes settings through the hook, and a second session clones the same bytes', async () => {
    // A device signed in by passkey asks for its home book twice: the same one.
    const device = new HttpClient();
    const accountId = await registerNewAccount(device);
    const home = await getHomeBook(device);
    expect(home.gitUrl).toMatch(new RegExp(`/git/${home.id}$`));
    expect((await getHomeBook(device)).id).toBe(home.id);

    // It brings its local home book online: a canonical first commit, accepted
    // by the hook as a home book (the kind set by provisioning).
    const url = gitEndpoint(home);
    const workDir = await tempDir('estante-e2e-homebook-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, 'README.md'), homeReadme);
    await writeFile(join(workDir, '.gitattributes'), homeGitattributes);
    await writeFile(join(workDir, 'preferences.json'), canonicalPreferences);
    await work.add('.');
    await work.commit('Bring the home book online');
    await work.pushHTTP(url, device.cookieHeader());
    const pushedHead = await work.revParse('HEAD');

    // It is not a songbook: never listed among the books.
    const listResp = await device.get('/api/books');
    expect(listResp.status).toBe(200);
    const { books } = await listResp.json();
    expect(books.some((b) => b.id === home.id)).toBe(false);

    // A second session of the same account — the emailed link, as a new device
    // signs in (workflow 13) — is told the same home book.
    const email = `home-book-${uniqueId()}@estante.test`;
    const sql = connect();
    try {
      await sql`UPDATE accounts SET email = ${email} WHERE id = ${accountId}`;
    } finally {
      await sql.end({ timeout: 5 });
    }
    const second = new HttpClient();
    const signedIn = await signInViaEmail(second, email, new Set());
    expect(signedIn.id).toBe(accountId);
    const secondHome = await getHomeBook(second);
    expect(secondHome).toEqual(home);

    // It clones the home book first with the app's own client and reads the
    // same bytes at the same head.
    const isoDir = await tempDir('estante-e2e-homebook-iso-');
    const iso = await IsoGit.create(isoDir);
    await iso.clone({ url: gitEndpoint(secondHome), cookie: second.cookieHeader() });
    const [head] = await iso.log();
    expect(head.oid).toBe(pushedHead);
    expect(await iso.readFileAtHead('preferences.json')).toBe(canonicalPreferences);

    // Another account cannot clone it: the same 404 as an unknown book.
    const stranger = new HttpClient();
    await registerNewAccount(stranger);
    const refs = await stranger.get(`/git/${home.id}/info/refs?service=git-upload-pack`);
    expect(refs.status).toBe(404);
    const strangerDir = await tempDir('estante-e2e-homebook-stranger-');
    await expect(GitCli.cloneHTTP(url, join(strangerDir, 'clone'), stranger.cookieHeader())).rejects.toThrow();
    // …and is given a home book of its own.
    expect((await getHomeBook(stranger)).id).not.toBe(home.id);
  });
});
