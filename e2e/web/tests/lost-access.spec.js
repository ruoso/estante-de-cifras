// lost-access (e2e-web) — losing access to a shared book against the compose
// stack, on the phone/tablet/computer projects, with axe at WCAG 2.1 AA on every
// screen it touches (sync.lost_access, workflow 8 §Losing access; DIRECTION §3.3;
// states.md badge decision; the W11 board surface).
//
// An editor joins a hosted book and makes a save it has not pushed; the owner
// removes the membership through the service; the member's device then syncs and
// learns it is gone — the shelf reads *no longer shared with you*, the book
// detail shows the losing-access notice and offers Download and *Make this book
// your own*, and the song still opens and reads with the unpushed save kept.
//
// Reuses share.spec.js's hosted-book + membership-removal seam: the owner's own
// session cookie seeds the first song over smart HTTP (the book is created
// empty), and the membership is removed through the service API (the refinement
// permits the owner UI or the API — this does not depend on the owner UI). The
// member is removed BEFORE the save so the local commit is deterministically
// unpushed: a 404 is what the member's device then meets (the engine's
// 404-push/fetch classification, pinned at the unit level). Book and song names
// are written for this test (no-song-text rule). The completed lost-access→fork
// journey is books.fork's e2e; here the fork offer is asserted present and
// reachable, not clicked through to a completed fork.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';
import { baseUrl } from '../lib/env.js';
import { openDevice } from '../lib/devices.js';

const execFileAsync = promisify(execFile);

const BOOK = 'Choros da Ana';
const SONG_TITLE = 'Roda de rua';
const SONG_FILE = 'roda-de-rua.cifra.md';
const SONG_V1 = [
  `# ${SONG_TITLE}`,
  '- language: en',
  '',
  '## Parte',
  '```',
  'C | G | Am | F',
  '```',
].join('\n');
const SAVED_MARK = 'MemberPart'; // the member's unpushed section

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rowFor = (title) => new RegExp('^' + escapeRegExp(title));

// --- CDP virtual authenticator + account helpers (inline, as share.spec does) ---

async function enableVirtualAuthenticator(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return client;
}

async function hasSessionCookie(page) {
  const cookies = await page.context().cookies();
  return cookies.some((c) => c.name === 'estante_session' && c.value);
}

async function signInWithPasskey(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
}

async function makeLocalBook(page, name) {
  await page.getByRole('tab', { name: 'Books' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a book' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('textbox', { name: 'Book name' }).fill(name);
  await sheet.getByRole('button', { name: 'New book' }).click();
  await expect(page.getByRole('button', { name: rowFor(name) })).toBeVisible();
}

async function putBookOnline(page, name) {
  await page.getByRole('button', { name: rowFor(name) }).click();
  await page.getByRole('button', { name: 'Put online' }).click();
  await expect(page.getByText('On Estante · private')).toBeVisible();
}

async function sessionCookieHeader(page) {
  const cookies = await page.context().cookies();
  const c = cookies.find((x) => x.name === 'estante_session');
  if (!c) throw new Error('no estante_session cookie on the device context');
  return `estante_session=${c.value}`;
}

async function bookFromApi(page, title) {
  const resp = await page.request.get('/api/books');
  expect(resp.ok()).toBeTruthy();
  const { books } = await resp.json();
  const book = books.find((b) => b.title === title);
  if (!book) throw new Error(`book ${title} not found for the account`);
  return book;
}

// --- node git seeding (the owner's own cookie over smart HTTP) ---

const tmpDirs = [];
function makeDir() {
  const dir = mkdtempSync(join(tmpdir(), 'estante-e2e-lost-'));
  tmpDirs.push(dir);
  return dir;
}
test.afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function runGit(cwd, args) {
  return execFileAsync('git', args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' },
  });
}
const cookieArgs = (cookie) => ['-c', `http.extraHeader=Cookie: ${cookie}`];

async function seedSong(gitUrl, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', gitUrl, dir]);
  await runGit(dir, ['config', 'user.name', 'Ana']);
  await runGit(dir, ['config', 'user.email', 'ana@users.estantedecifras.app']);
  await runGit(dir, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(dir, SONG_FILE), `${SONG_V1}\n`);
  await runGit(dir, ['add', SONG_FILE]);
  await runGit(dir, ['commit', '-m', 'Seed a song']);
  await runGit(dir, [...cookieArgs(cookie), 'push', gitUrl, 'HEAD:refs/heads/main']);
}

// --- editor helpers (the #dev/editor on-device mount, as save-sheet.spec.js) ---

async function editorGoto(page, bookId) {
  await page.goto(
    `/#dev/editor?book=${encodeURIComponent(bookId)}&path=${encodeURIComponent(SONG_FILE)}`,
  );
  await expect(page.locator('.cm-content')).toBeVisible();
}

// Insert a uniquely-marked section before the song's first heading (the clean,
// canonicalisable change share.spec uses), let the debounced WRITE settle and
// save it — answering the first-save name prompt when asked. The commit is local;
// the push is the engine's job, and it will be refused (the member was removed).
async function editAndSave(page, mark, name) {
  const heading = page.locator('.cm-content .cm-line').filter({ hasText: /^## / }).first();
  await heading.click();
  await page.keyboard.press('Home');
  await page.keyboard.insertText(`## ${mark}\n\`\`\`\nC | G\n\`\`\`\n\n`);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Save' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill(name);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
}

async function reloadAndSync(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.waitForTimeout(1500);
}

test('losing access: the owner removes an editor; the member sees no longer shared with you, reads on, and is offered the fork and download', async ({
  browser,
  page,
}) => {
  test.setTimeout(240000);

  // Owner: a signed-in device with a hosted book carrying one seeded song.
  await enableVirtualAuthenticator(page);
  await signInWithPasskey(page);
  await makeLocalBook(page, BOOK);
  await putBookOnline(page, BOOK);
  const book = await bookFromApi(page, BOOK);
  const bookId = book.id;
  const gitUrl = new URL(book.gitUrl, `${baseUrl}/`).toString();
  await seedSong(gitUrl, await sessionCookieHeader(page));

  // The owner mints an editor invitation through the service API (the refinement
  // allows the API or the owner UI for the removal seam; the invitation is the
  // same choice).
  const inviteResp = await page.request.post(`/api/books/${bookId}/invitations`, {
    data: { role: 'editor', expiry: 'week' },
  });
  expect(inviteResp.ok()).toBeTruthy();
  const { url: link } = await inviteResp.json();
  expect(link).toContain('/i/');

  const joiner = await openDevice(browser);
  try {
    // A second account opens the link, makes an account, and joins as an editor;
    // the book lands on its shelf as "can save" (books.add_by_link).
    await enableVirtualAuthenticator(joiner.page);
    await joiner.page.goto(link);
    await expect(
      joiner.page.getByRole('heading', { name: /invited to a book on Estante/i }),
    ).toBeVisible();
    await joiner.page.getByRole('button', { name: 'Make an account' }).click();
    await expect(joiner.page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await joiner.page.getByRole('button', { name: 'Use a passkey' }).click();
    await expect(joiner.page.getByRole('button', { name: rowFor(BOOK) })).toBeVisible();
    await expect(joiner.page.getByText('On Estante · can save')).toBeVisible();

    // The owner removes the member through the service API. Removed first so the
    // member's next local commit is deterministically unpushed — the losing-access
    // case (workflow 8: "saves not yet pushed are kept").
    const membersResp = await page.request.get(`/api/books/${bookId}/members`);
    expect(membersResp.ok()).toBeTruthy();
    const { members } = await membersResp.json();
    const member = members.find((m) => m.role === 'editor');
    expect(member, 'the joined editor is in the roster').toBeTruthy();
    const removeResp = await page.request.delete(
      `/api/books/${bookId}/members/${member.userId}`,
    );
    expect(removeResp.ok()).toBeTruthy();

    // The member makes a save on the book — it commits locally and cannot go up
    // (no longer a member). The save stays on the device.
    await editorGoto(joiner.page, bookId);
    await editAndSave(joiner.page, SAVED_MARK, 'Beto');

    // The member's device syncs and learns it is gone: the shelf reads
    // *no longer shared with you* (states.md; workflow 8 L34).
    await expect(async () => {
      await reloadAndSync(joiner.page);
      await joiner.page.getByRole('tab', { name: 'Books' }).click();
      await expect(joiner.page.getByText('no longer shared with you')).toBeVisible({
        timeout: 2500,
      });
    }).toPass({ timeout: 120000 });
    expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the shelf with the gone badge

    // The book detail shows the losing-access notice and both escape offers
    // (acceptance 2, 4).
    await joiner.page.getByRole('button', { name: rowFor(BOOK) }).click();
    // The notice title is a card title (`span.t-h2`, like its sibling cards), so
    // it is matched by its exact text — "No longer shared with you" (capitalised),
    // distinct from the lowercase shelf badge.
    await expect(
      joiner.page.getByText('No longer shared with you', { exact: true }),
    ).toBeVisible();
    await expect(
      joiner.page.getByText(/no longer shared with you, so it will not sync again/),
    ).toBeVisible();
    const forkOffer = joiner.page.getByRole('button', { name: 'Make this book your own' });
    await expect(forkOffer).toBeVisible();
    await expect(forkOffer).toBeEnabled(); // offered and reachable (not clicked through)
    expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the gone book detail

    // Download produces a zip of the repository as it is on the device
    // (acceptance 4; the existing BOOK_DOWNLOAD path).
    const [download] = await Promise.all([
      joiner.page.waitForEvent('download'),
      joiner.page.getByRole('button', { name: 'Download' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.zip$/);

    // The song still opens and reads normally, with the unpushed save kept — no
    // local read is blocked, no save/push is attempted (acceptance 3; Constraint
    // 3, 7).
    await joiner.page.goto(`/b/${bookId}/${SONG_FILE}`);
    await waitForServiceWorker(joiner.page);
    await expect(joiner.page.locator('.reading-sheet')).toBeVisible();
    await expect(joiner.page.locator('.reading-sheet')).toContainText(SAVED_MARK);
    expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the reading view of the gone book
  } finally {
    await joiner.context.close();
  }
});
