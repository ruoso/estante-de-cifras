// notice-surface (e2e-web) — a book the service took down for a copyright notice
// shows the operator's reason on its detail, against the compose stack, on the
// phone/tablet/computer projects, with axe at WCAG 2.1 AA (books.notice_surface;
// workflow 10 §A copyright notice; DIRECTION §3.6).
//
// A signed-in device puts its own book online and seeds a song. The book is then
// taken down through the db seam (the effect `estante-admin take-down` commits —
// no endpoint provides it — mirroring e2e/api/admin.test.js:119-125). The device
// syncs: the service's change-check still answers `gone`, so the sync engine
// probes git, meets the `403 taken_down` refusal and recovers the reason. The
// book's detail then shows that reason in the take-down notice beside Download,
// distinct from the lost-access notice. The shelf reads *no longer shared with
// you* like any gone book (workflow 10 L113).
//
// Reuses lost-access.spec.js's CDP virtual-authenticator sign-in and the owner's
// own cookie seeding a first song over smart HTTP. Book name, song and take-down
// reason are written for this test — never anyone's copyrighted words or a real
// notice (no-song-text rule).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';
import { baseUrl } from '../lib/env.js';
import { takeDownBook } from '../lib/db.js';

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

// The operator's free-text reason, as the service frames it and returns it on the
// git refusal (service/internal/server/git.go:232). Written for this test.
const TAKEN_DOWN_REASON =
  'This book has been taken down: a copyright notice was filed by the rights holder.';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rowFor = (title) => new RegExp('^' + escapeRegExp(title));

// --- CDP virtual authenticator + account helpers (inline, as lost-access does) ---

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
  const dir = mkdtempSync(join(tmpdir(), 'estante-e2e-notice-'));
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

async function reloadAndSync(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.waitForTimeout(1500);
}

test('a taken-down book shows the operator reason on its detail, beside Download; the shelf reads gone', async ({
  page,
}) => {
  test.setTimeout(240000);

  // A signed-in device with a hosted book carrying one seeded song.
  await enableVirtualAuthenticator(page);
  await signInWithPasskey(page);
  await makeLocalBook(page, BOOK);
  await putBookOnline(page, BOOK);
  const book = await bookFromApi(page, BOOK);
  const bookId = book.id;
  const gitUrl = new URL(book.gitUrl, `${baseUrl}/`).toString();
  await seedSong(gitUrl, await sessionCookieHeader(page));

  // The operator takes the book down for a copyright notice (the db seam — the
  // effect no endpoint provides; mirrors e2e/api/admin.test.js:119-125).
  await takeDownBook(bookId, TAKEN_DOWN_REASON);

  // The device syncs and learns the book is unreachable: the shelf reads
  // *no longer shared with you*, like any gone book (workflow 10 L113).
  await expect(async () => {
    await reloadAndSync(page);
    await page.getByRole('tab', { name: 'Books' }).click();
    await expect(page.getByText('no longer shared with you')).toBeVisible({ timeout: 2500 });
  }).toPass({ timeout: 120000 });
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the shelf with the gone badge

  // The book detail carries the take-down notice with the operator's reason,
  // beside Download — distinct from the lost-access notice (acceptance 5).
  await page.getByRole('button', { name: rowFor(BOOK) }).click();
  await expect(page.getByText('This book has been taken down', { exact: true })).toBeVisible();
  await expect(page.getByText(TAKEN_DOWN_REASON)).toBeVisible();
  // Not the lost-access card, and no fork offer (Decision 3).
  await expect(
    page.getByText(/no longer shared with you, so it will not sync again/),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Make this book your own' })).toHaveCount(0);
  // Download stays available — the book is still readable and exportable.
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the taken-down book detail
});
