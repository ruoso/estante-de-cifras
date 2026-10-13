// conflicts (e2e-web) — the conflict-resolution journey against the compose
// stack, on the phone/tablet/computer projects, with axe at WCAG 2.1 AA on every
// conflict screen (sync.conflicts, workflow 9; board W09). An owner hosts a book
// with one song; a second writer (a node `git` client, the read-in-place.spec.js
// pattern — the owner's own smart-HTTP session, committing as another person) and
// the owner both change the same bar. The owner syncs second, meets *needs you*,
// engages the paused panel while the rest of the book stays readable, and settles
// the conflict — each way across the four tests: *keep mine*, *take theirs*,
// *edit* the markers away, and *abandon*. The resolved merge is pushed and is
// fetched back by a fresh clone. Book and song names are written for this test
// (no-song-text rule).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';
import { baseUrl } from '../lib/env.js';

const execFileAsync = promisify(execFile);

const BOOK = 'Choros da Ana';
const SONG_TITLE = 'Roda de rua';
const SONG_FILE = 'roda-de-rua.cifra.md';
const BAR_BASE = 'C | G | Am | F';
const BAR_OWNER = 'C | G | Am | Dm';
const BAR_ANA = 'C | G | Am | E7';
const INCOMING_AUTHOR = 'Ana';
const songWithBar = (bar) => [`# ${SONG_TITLE}`, '- language: en', '', '## Parte', '```', bar, '```'].join('\n');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rowFor = (title) => new RegExp('^' + escapeRegExp(title));

// --- account + book helpers (inline, as the harness does) ---

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

// --- node git (the second writer, over the owner's own smart-HTTP session) ---

const tmpDirs = [];
function makeDir() {
  const dir = mkdtempSync(join(tmpdir(), 'estante-e2e-conflicts-'));
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
async function configIdentity(dir, name, email) {
  await runGit(dir, ['config', 'user.name', name]);
  await runGit(dir, ['config', 'user.email', email]);
  await runGit(dir, ['config', 'commit.gpgsign', 'false']);
}

async function seedSong(gitUrl, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', gitUrl, dir]);
  await configIdentity(dir, 'Beto', 'beto@users.estantedecifras.app');
  writeFileSync(join(dir, SONG_FILE), `${songWithBar(BAR_BASE)}\n`);
  await runGit(dir, ['add', SONG_FILE]);
  await runGit(dir, ['commit', '-m', 'Seed a song']);
  await runGit(dir, [...cookieArgs(cookie), 'push', gitUrl, 'HEAD:refs/heads/main']);
}

// The second writer rewrites the same bar and pushes it first, as INCOMING_AUTHOR.
async function anaRewritesTheBar(gitUrl, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', gitUrl, dir]);
  await configIdentity(dir, INCOMING_AUTHOR, 'ana@users.estantedecifras.app');
  writeFileSync(join(dir, SONG_FILE), `${songWithBar(BAR_ANA)}\n`);
  await runGit(dir, ['add', SONG_FILE]);
  await runGit(dir, ['commit', '-m', 'Rework the bar']);
  await runGit(dir, [...cookieArgs(cookie), 'push', gitUrl, 'HEAD:refs/heads/main']);
}

// The resolved bar now on the remote (a fresh clone — the merge fetched back).
async function remoteBar(gitUrl, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', gitUrl, dir]);
  return readFileSync(join(dir, SONG_FILE), 'utf8');
}

// --- editor / sync helpers ---

async function editorGoto(page, bookId) {
  await page.goto(`/#dev/editor?book=${encodeURIComponent(bookId)}&path=${encodeURIComponent(SONG_FILE)}`);
  await expect(page.locator('.cm-content')).toBeVisible();
}

async function reloadAndSync(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.waitForTimeout(1500);
}

// The owner rewrites the same bar in the on-device editor and saves (naming
// themselves on the first save). A local commit, ahead of the fetched remote.
async function ownerRewritesTheBar(page, bookId) {
  await editorGoto(page, bookId);
  const line = page.locator('.cm-content .cm-line').filter({ hasText: BAR_BASE }).first();
  await line.click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await page.keyboard.insertText(BAR_OWNER);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Save' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill('Beto');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
}

// Drive the owner to the paused panel: host + seed, the second writer collides,
// the owner rewrites the same bar and syncs second, meets *needs you*, engages.
// Returns `{ bookId, gitUrl, cookie }`.
async function reachNeedsYou(page) {
  await enableVirtualAuthenticator(page);
  await signInWithPasskey(page);
  await makeLocalBook(page, BOOK);
  await putBookOnline(page, BOOK);
  const book = await bookFromApi(page, BOOK);
  const bookId = book.id;
  const gitUrl = new URL(book.gitUrl, `${baseUrl}/`).toString();
  const cookie = await sessionCookieHeader(page);

  await seedSong(gitUrl, cookie);
  await reloadAndSync(page); // pull the seeded song into the working copy
  await anaRewritesTheBar(gitUrl, cookie); // the remote is now ahead, same bar
  await ownerRewritesTheBar(page, bookId); // a colliding local commit
  await reloadAndSync(page); // sync second → the merge cannot settle alone

  // The shelf reads *needs you*; the rest of the book stays readable.
  await page.getByRole('tab', { name: 'Books' }).click();
  await expect(page.getByText('needs you').first()).toBeVisible({ timeout: 30000 });

  // Engage the book: the paused panel opens.
  await page.getByRole('button', { name: rowFor(BOOK) }).click();
  await expect(page.getByText(/songs? need you|song needs you/i)).toBeVisible();
  await expect(page.getByText('In conflict')).toBeVisible();
  return { bookId, gitUrl, cookie };
}

async function openResolver(page) {
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the paused book panel
  await page.getByRole('button', { name: new RegExp(`^Settle ${escapeRegExp(SONG_TITLE)}`) }).click();
  await expect(page.getByText(/Conflict \d+ of \d+/)).toBeVisible();
  await expect(page.getByText('Yours', { exact: true })).toBeVisible();
  await expect(page.getByText('Ana’s', { exact: true })).toBeVisible();
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the per-song resolver
}

// After settling, the book leaves *needs you* and the editor shows `bar`.
async function expectSettledWithBar(page, bookId, bar) {
  await expect(async () => {
    await reloadAndSync(page);
    await editorGoto(page, bookId);
    await expect(page.locator('.cm-content')).toContainText(bar, { timeout: 2500 });
    await expect(page.locator('.cm-content')).not.toContainText('<<<<<<<', { timeout: 2500 });
  }).toPass({ timeout: 90000 });
}

test('take theirs settles the conflict, and the resolved merge is pushed and fetched back', async ({ page }) => {
  test.setTimeout(240000);
  const { bookId, gitUrl, cookie } = await reachNeedsYou(page);
  await openResolver(page);

  await page.getByRole('button', { name: 'Take theirs' }).click();

  // The two-parent merge is committed and pushed; a fresh clone sees Ana's bar.
  await expectSettledWithBar(page, bookId, BAR_ANA);
  await expect.poll(async () => remoteBar(gitUrl, cookie), { timeout: 90000 }).toContain(BAR_ANA);
});

test('keep mine settles the conflict with the owner’s own version', async ({ page }) => {
  test.setTimeout(240000);
  const { bookId } = await reachNeedsYou(page);
  await openResolver(page);

  await page.getByRole('button', { name: 'Keep mine' }).click();
  await expectSettledWithBar(page, bookId, BAR_OWNER);
});

test('edit opens the marked text and a save refuses while a marker line remains, then settles once removed (§11.12.3; workflow 9 L59)', async ({ page }) => {
  test.setTimeout(240000);
  const { bookId } = await reachNeedsYou(page);
  await openResolver(page);

  await page.getByRole('button', { name: 'Edit' }).click();
  const editor = page.getByRole('textbox', { name: /text, with the conflict markers/i });
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue(/<<<<<<</);
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the edit view

  // Edit the markers away, keeping the owner's line.
  const resolved = (await editor.inputValue())
    .split('\n')
    .filter((l) => !/^(<{7}|={7}|>{7}|\|{7})/.test(l) && l !== BAR_ANA)
    .join('\n');
  await editor.fill(resolved);
  await page.getByRole('button', { name: 'Save' }).click();

  await expectSettledWithBar(page, bookId, BAR_OWNER);
});

test('abandon puts the book back as it was before the sync', async ({ page }) => {
  test.setTimeout(240000);
  await reachNeedsYou(page);

  await page.getByRole('button', { name: 'Abandon the merge' }).click();

  // The panel closes back to the shell; the book is no longer paused (the
  // incoming change waits to be merged at the next sync — workflow 9 L77-78).
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible({ timeout: 30000 });
});

// --- keep both, for a voicing (workflow 9 §Settling one, the keep-both option;
// sync.keep_both) — a song that carries a voicings block, both sides reshaping
// the same chord. Its own song fixture (written for the purpose). ---

const VSONG_TITLE = 'Toada da Ana';
const VSONG_FILE = 'toada-da-ana.cifra.md';
const V_TUNING = 'E2 A2 D3 G3 B3 E4';
const V_BASE = 'x35543'; // the seeded Cm shape
const V_OWNER = 'x3554x'; // the owner reshapes it their way
const V_ANA = '8-10-10-8-8-8'; // the second writer reshapes it hers
const voicingSong = (cm) =>
  [`# ${VSONG_TITLE}`, '- language: en', '', '## Parte', '```', 'Cm | F7 | Cm | G7', '```',
    '', '---', '', `## Voicings: ${V_TUNING}`, `- Cm: ${cm}`, '- F7: 131211', '- G7: 320001'].join('\n');

async function seedVoicingSong(gitUrl, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', gitUrl, dir]);
  await configIdentity(dir, 'Beto', 'beto@users.estantedecifras.app');
  writeFileSync(join(dir, VSONG_FILE), `${voicingSong(V_BASE)}\n`);
  await runGit(dir, ['add', VSONG_FILE]);
  await runGit(dir, ['commit', '-m', 'Seed a voicing song']);
  await runGit(dir, [...cookieArgs(cookie), 'push', gitUrl, 'HEAD:refs/heads/main']);
}

async function anaReshapesVoicing(gitUrl, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', gitUrl, dir]);
  await configIdentity(dir, INCOMING_AUTHOR, 'ana@users.estantedecifras.app');
  writeFileSync(join(dir, VSONG_FILE), `${voicingSong(V_ANA)}\n`);
  await runGit(dir, ['add', VSONG_FILE]);
  await runGit(dir, ['commit', '-m', 'Reshape the chord']);
  await runGit(dir, [...cookieArgs(cookie), 'push', gitUrl, 'HEAD:refs/heads/main']);
}

async function ownerReshapesVoicing(page, bookId) {
  await page.goto(`/#dev/editor?book=${encodeURIComponent(bookId)}&path=${encodeURIComponent(VSONG_FILE)}`);
  await expect(page.locator('.cm-content')).toBeVisible();
  const line = page.locator('.cm-content .cm-line').filter({ hasText: `- Cm: ${V_BASE}` }).first();
  await line.click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await page.keyboard.insertText(`- Cm: ${V_OWNER}`);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Save' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill('Beto');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
}

async function remoteVoicingSong(gitUrl, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', gitUrl, dir]);
  return readFileSync(join(dir, VSONG_FILE), 'utf8');
}

async function reachNeedsYouVoicing(page) {
  await enableVirtualAuthenticator(page);
  await signInWithPasskey(page);
  await makeLocalBook(page, BOOK);
  await putBookOnline(page, BOOK);
  const book = await bookFromApi(page, BOOK);
  const bookId = book.id;
  const gitUrl = new URL(book.gitUrl, `${baseUrl}/`).toString();
  const cookie = await sessionCookieHeader(page);

  await seedVoicingSong(gitUrl, cookie);
  await reloadAndSync(page); // pull the seeded song
  await anaReshapesVoicing(gitUrl, cookie); // the remote is ahead, same chord
  await ownerReshapesVoicing(page, bookId); // a colliding local commit
  await reloadAndSync(page); // sync second → the merge cannot settle alone

  await page.getByRole('tab', { name: 'Books' }).click();
  await expect(page.getByText('needs you').first()).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: rowFor(BOOK) }).click();
  await expect(page.getByText(/songs? need you|song needs you/i)).toBeVisible();
  await expect(page.getByText('In conflict')).toBeVisible();
  return { bookId, gitUrl, cookie };
}

test('keep both a voicing: the owner keeps their shape and Ana’s lands in a variation named for her, pushed and fetched back (workflow 9 §Later)', async ({ page }) => {
  test.setTimeout(240000);
  const { bookId, gitUrl, cookie } = await reachNeedsYouVoicing(page);

  // Open the resolver; axe on the paused panel and the per-song resolver.
  expect(await analyzeWcag21aa(page)).toEqual([]);
  await page.getByRole('button', { name: new RegExp(`^Settle ${escapeRegExp(VSONG_TITLE)}`) }).click();
  await expect(page.getByText('The shape for Cm')).toBeVisible();
  await expect(page.getByText('Yours', { exact: true })).toBeVisible();
  await expect(page.getByText('Ana’s', { exact: true })).toBeVisible();
  expect(await analyzeWcag21aa(page)).toEqual([]);

  // Keep both: ours stays in use, Ana's goes into a variation named for her.
  await page.getByRole('button', { name: 'Keep both', exact: true }).click();

  // The resolved two-parent merge is pushed: a fresh clone keeps the owner's Cm
  // in the default block and carries Ana's shape in a variation named for her.
  await expect.poll(async () => remoteVoicingSong(gitUrl, cookie), { timeout: 90000 }).toContain(`## Ana: ${V_TUNING}`);
  const resolved = await remoteVoicingSong(gitUrl, cookie);
  expect(resolved).toContain(`- Cm: ${V_OWNER}`); // the owner's shape, still in use
  expect(resolved).toContain(V_ANA); // Ana's shape, kept
  expect(resolved).not.toContain('<<<<<<<'); // canonical, no markers

  // The book no longer *needs you*.
  await reloadAndSync(page);
  await page.getByRole('tab', { name: 'Books' }).click();
  await expect(page.getByRole('button', { name: rowFor(BOOK) })).toBeVisible();
  await expect(page.getByText('needs you')).toHaveCount(0);

  // The reading view offers the variation named for Ana in its picker (the
  // picker — a Select — appears once the song has two variations), and axe is
  // clean on the resolved song.
  await page.goto(`/#dev/reading?book=${encodeURIComponent(bookId)}&path=${encodeURIComponent(VSONG_FILE)}`);
  const variationPicker = page.getByRole('button', { name: /Variation/ });
  await expect(variationPicker).toBeVisible({ timeout: 30000 });
  expect(await analyzeWcag21aa(page)).toEqual([]);
  await variationPicker.click();
  await expect(page.getByRole('option', { name: 'Ana' })).toBeVisible();
});
