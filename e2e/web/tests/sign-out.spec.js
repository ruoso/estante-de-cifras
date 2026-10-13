// sign-out (e2e-web) — leaving the account on this device against the compose
// stack, on the phone/tablet/computer projects, with axe at WCAG 2.1 AA on the
// account screen and each dialog state (account.sign_out, workflow 13 §Signing
// out, docs/workflows/13-new-device.md:82-88; board W13-new-device).
//
// A signed-in owner hosts a book with one song and keeps a second, purely-local
// book. The sign-out dialog surveys this device's local-only work — unsaved
// changes and saves not yet pushed, per book — and offers a download for the
// book only on this device. Two journeys:
//   - Remove (exercised OFFLINE, where the teardown is the security-critical
//     part): an offline save and an unsaved edit are both counted, then Remove
//     empties the account's books from the shelf;
//   - Keep: the hosted book becomes a local book on the shelf, no longer synced,
//     and the server session is cleared (the cookie drops).
// Book and song names are written for this test (no-song-text rule).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test, expect } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';
import { baseUrl } from '../lib/env.js';

const execFileAsync = promisify(execFile);

const HOSTED = 'Banda do Bairro';
const LOCAL = 'Rascunhos';
const SONG_FILE = 'roda-de-rua.cifra.md';
const SONG = ['# Roda de rua', '- language: en', '', '## Parte', '```', 'C | G | Am | F', '```'].join('\n');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rowFor = (title) => new RegExp('^' + escapeRegExp(title));
const editorHash = (bookId, path) =>
  `#dev/editor?book=${encodeURIComponent(bookId)}&path=${encodeURIComponent(path)}`;

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

async function openAccount(page) {
  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
}

// --- node git (seed a song into the hosted book over the owner's session) ---

const tmpDirs = [];
function makeDir() {
  const dir = mkdtempSync(join(tmpdir(), 'estante-e2e-signout-'));
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

async function seedSong(gitUrl, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', gitUrl, dir]);
  await runGit(dir, ['config', 'user.name', 'Beto']);
  await runGit(dir, ['config', 'user.email', 'beto@users.estantedecifras.app']);
  await runGit(dir, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(dir, SONG_FILE), `${SONG}\n`);
  await runGit(dir, ['add', SONG_FILE]);
  await runGit(dir, ['commit', '-m', 'Seed a song']);
  await runGit(dir, [...cookieArgs(cookie), 'push', gitUrl, 'HEAD:refs/heads/main']);
}

async function reloadAndSync(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.waitForTimeout(1500);
}

// Switch the dev editor mount by changing the hash in the SAME document (no
// reload), so the Worker session and its live "unsaved" flags survive (a full
// reload reconciles every song as saved). The app re-renders on hashchange.
async function hashTo(page, hash) {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
}

// Add a new section to the open song — a clean, canonicalisable change. Inserted
// before the first section heading so it lands in the body. Lets the debounced
// WRITE settle.
async function editSong(page, mark) {
  const heading = page.locator('.cm-content .cm-line').filter({ hasText: /^## / }).first();
  await heading.click();
  await page.keyboard.press('Home');
  await page.keyboard.insertText(`## ${mark}\n\`\`\`\nC | G\n\`\`\`\n\n`);
  await page.waitForTimeout(800);
}

async function saveOpenSong(page) {
  await page.getByRole('button', { name: 'Save' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill('Marina');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
}

// Sign in, host a book with one seeded song, and keep a second purely-local book.
// Returns the hosted book's id.
async function hostAndSeed(page) {
  await enableVirtualAuthenticator(page);
  await signInWithPasskey(page);
  await makeLocalBook(page, HOSTED);
  await putBookOnline(page, HOSTED);
  const book = await bookFromApi(page, HOSTED);
  const gitUrl = new URL(book.gitUrl, `${baseUrl}/`).toString();
  await seedSong(gitUrl, await sessionCookieHeader(page));
  await reloadAndSync(page); // pull the seeded song into the working copy
  await makeLocalBook(page, LOCAL); // a book only on this device (the download guard)
  return book.id;
}

test('Remove counts this device’s local-only work and empties the account’s books; axe-clean', async ({
  page,
  checkA11y,
}) => {
  const bookId = await hostAndSeed(page);

  // Everything from here is offline: the local teardown must not wait on the
  // network, and an offline save stays unpushed so the dialog can count it.
  await page.context().setOffline(true);

  // One save made offline (a commit not yet pushed), then a further unsaved edit.
  await hashTo(page, editorHash(bookId, SONG_FILE));
  await expect(page.locator('.cm-content')).toBeVisible();
  await editSong(page, 'Ponte');
  await saveOpenSong(page);
  await editSong(page, 'Refrao');
  await expect(page.locator('.cm-content')).toContainText('Refrao');

  // Back to the shell in the same session (the unsaved flag survives) → account.
  await hashTo(page, '');
  await openAccount(page);
  await checkA11y(); // the account screen

  await page.getByRole('button', { name: 'Sign out of this device' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Sign out of this device?')).toBeVisible();
  // The survey warns about work only on this device, counted per book…
  await expect(dialog.getByText(/unsaved changes in 1 song/)).toBeVisible();
  await expect(dialog.getByText(/1 save not yet pushed/)).toBeVisible();
  // …and offers a download for the book only on this device.
  await expect(dialog.getByText(new RegExp(`${LOCAL} is only on this device`))).toBeVisible();
  await expect(dialog.getByRole('button', { name: `Download ${LOCAL}` })).toBeVisible();
  await checkA11y(); // the dialog state

  // Remove is the default; confirm.
  await expect(dialog.getByRole('radio', { name: /Remove this account’s books/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Sign out and remove' }).click();

  // The account's books are gone from the shelf.
  await page.getByRole('tab', { name: 'Books' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();
  await expect(page.getByRole('button', { name: rowFor(HOSTED) })).toHaveCount(0);
  await expect(page.getByRole('button', { name: rowFor(LOCAL) })).toHaveCount(0);
});

test('Keep turns the account’s books into local books and clears the session; axe-clean', async ({
  page,
  checkA11y,
}) => {
  const bookId = await hostAndSeed(page);

  // One unsaved edit so the dialog has something to warn about (online — Keep
  // removes nothing and needs no offline teardown).
  await hashTo(page, editorHash(bookId, SONG_FILE));
  await expect(page.locator('.cm-content')).toBeVisible();
  await editSong(page, 'Ponte');
  await expect(page.locator('.cm-content')).toContainText('Ponte');

  await hashTo(page, '');
  await openAccount(page);

  await page.getByRole('button', { name: 'Sign out of this device' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/unsaved changes in 1 song/)).toBeVisible();

  // Choose Keep; its confirm names the action.
  await dialog.getByRole('radio', { name: /Keep them here/ }).click();
  await checkA11y(); // the dialog's Keep state
  await dialog.getByRole('button', { name: 'Sign out and keep' }).click();

  // The session cookie is cleared (the server signed this device out)…
  await expect.poll(() => hasSessionCookie(page)).toBe(false);

  // …and the hosted book remains on the shelf, now as a local book (no longer
  // "On Estante").
  await page.getByRole('tab', { name: 'Books' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();
  await expect(page.getByRole('button', { name: rowFor(HOSTED) })).toBeVisible();
  await page.getByRole('button', { name: rowFor(HOSTED) }).click();
  await expect(page.getByText('On Estante · private')).toHaveCount(0);
});
