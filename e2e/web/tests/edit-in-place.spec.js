// edit-in-place (e2e-web) — a song open in the EDITOR while sync merges a new
// version under its unsaved edits (songs.edit_in_place, workflow 8 §"A song open
// while it changes" L55-56; W08). The editor-view mirror of read-in-place.spec.js.
// Against the compose stack on the phone/tablet/computer projects, with axe at
// WCAG 2.1 AA on the editor + notice each viewport.
//
// The hosted journey, driven black-box (the read-in-place.spec.js pattern):
//   1. the device signs in (passkey), makes a local book and puts it online
//      (empty — an owner cannot write to a hosted book through the UI yet);
//   2. a SECOND device (the host `git` CLI, carrying the device's own session
//      cookie over smart HTTP) clones the book and seeds one song; the app syncs
//      it down and, after a reload, indexes it (the open-time sweep);
//   3. the reader opens that song in the file view's raw editor (books.file_view),
//      types an unsaved edit, and the second device pushes a NEW version of the
//      same song (a different part — a clean merge) as INCOMING_AUTHOR;
//   4. on the next sync the engine merges the incoming version UNDER the unsaved
//      edit and emits MERGED; the open editor re-reads the merged working text in
//      place (both edits present, the caret kept), the *Updated by {name}: see
//      what changed* notice appears, and its action opens the song's history.
//
// The merge/swap/notice/no-clobber logic is also pinned IN-PROCESS at the behavior
// level (SongEditor.behavior.test.jsx drives a MERGED event through the real
// store; sync-engine.behavior.test.js drives a real second clone racing a clean
// merge under an unsaved file). Book and song names are written for this test
// (no-song-text rule).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test, expect } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';
import { baseUrl } from '../lib/env.js';

const execFileAsync = promisify(execFile);

const BOOK = 'Caderno do Cais';
const SONG_TITLE = 'Harbour Lights';
const SONG_FILE = 'harbour-lights.cifra.md';
// A short, whole-doc-fits song: an intro chord line the reader will edit, then a
// couple of verses. The second device later appends a bridge ("lighthouse") in a
// different part, so the merge is clean. The reader's edit extends the intro line.
const INTRO_LINE = 'C | G | Am | F';
const INTRO_EDIT = ' | B7'; // typed at the end of the intro line
const EDITED_INTRO = `${INTRO_LINE}${INTRO_EDIT}`;
const SONG_V1 = [
  `# ${SONG_TITLE}`,
  '- language: en',
  '',
  '## Intro',
  '```',
  INTRO_LINE,
  '```',
  '',
  '## Verse 1',
  '```',
  'the harbour wakes at dawn',
  '```',
  '',
  '## Verse 2',
  '```',
  'and gulls begin to call',
  '```',
];
// The incoming version appends a bridge in its own section (its author becomes the
// notice's *Updated by {name}*). "lighthouse" is the token the merged swap surfaces.
// Leading '' makes the one canonical blank line before the heading; no trailing ''
// (a trailing blank line is non-canonical, which the pre-receive hook refuses).
const BRIDGE = ['', '## Bridge', '```', 'a lighthouse sweeps the bay', '```'];
const INCOMING_AUTHOR = 'Ana Luiza';

// ---- device (browser) helpers — the account + hosted-book setup, copied from
// read-in-place.spec.js (the harness favours inline CDP helpers, no shared
// module). ----

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

async function signIn(page) {
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
  await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
}

// Put the (empty) book online: it gains a real `remote.origin.url` on the stack,
// so the sync engine will sync it and the second device can clone it.
async function putBookOnline(page, name) {
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.getByRole('button', { name: 'Put online' }).click();
  await expect(page.getByText('On Estante · private')).toBeVisible();
}

// Sign in, make a local book, put it online (empty), and return its git endpoint
// and the device's session cookie so the second device can clone/push it.
async function hostedEmptyBook(page) {
  await enableVirtualAuthenticator(page);
  await signIn(page);
  await makeLocalBook(page, BOOK);
  await putBookOnline(page, BOOK);
  await page.goto('/');
  await waitForServiceWorker(page);
  const cookie = await sessionCookie(page);
  const url = await bookGitUrl(page, BOOK);
  return { url, cookie };
}

// Reload until the synced-in song is searchable — which proves the sync pass has
// fetched the song into the working copy (the open-time sweep then indexes it).
async function syncUntilSearchable(page) {
  await expect(async () => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await page.waitForTimeout(1500); // let this load's sync pass fast-forward
    await page.getByRole('searchbox').fill('Harbour');
    await expect(
      page.getByRole('button', { name: new RegExp(SONG_TITLE) }).first(),
    ).toBeVisible({ timeout: 2500 });
  }).toPass({ timeout: 60000 });
}

// Open the synced song in the file view's raw editor (books.file_view): the Books
// tab → the book's Files control → the file in the tree. The production path that
// opens the editor on an existing song in a hosted book.
async function openSongInEditor(page) {
  await page.getByRole('tab', { name: 'Books' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();
  await page.getByRole('button', { name: `Files in ${BOOK}` }).click();
  await page.getByRole('button', { name: new RegExp(SONG_FILE.replace(/\./g, '\\.')) }).click();
  await expect(page.locator('.cm-content')).toContainText(INTRO_LINE);
}

// Forward the network-back DOM trigger the real main thread forwards to the
// Worker (sync-triggers.js) — a deterministic way to run one sync pass.
async function triggerSync(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
}

// ---- second device (Node git client) helpers ----

const tmpDirs = [];
function makeDir() {
  const dir = mkdtempSync(join(tmpdir(), 'estante-e2e-edit-in-place-'));
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
function cookieArgs(cookie) {
  return ['-c', `http.extraHeader=Cookie: ${cookie}`];
}
async function configIdentity(dir, name, email) {
  await runGit(dir, ['config', 'user.name', name]);
  await runGit(dir, ['config', 'user.email', email]);
  await runGit(dir, ['config', 'commit.gpgsign', 'false']);
}

async function sessionCookie(page) {
  const cookies = await page.context().cookies();
  const c = cookies.find((x) => x.name === 'estante_session');
  if (!c) throw new Error('no estante_session cookie on the device context');
  return `estante_session=${c.value}`;
}

async function bookGitUrl(page, title) {
  const resp = await page.request.get('/api/books');
  expect(resp.ok()).toBeTruthy();
  const { books } = await resp.json();
  const book = books.find((b) => b.title === title);
  if (!book) throw new Error(`book ${title} not found for the account`);
  return new URL(book.gitUrl, `${baseUrl}/`).toString();
}

// The second device clones the hosted book and pushes the song into it.
async function secondDeviceSeedsSong(url, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', url, dir]);
  await configIdentity(dir, 'Marina Souza', 'marina@users.estantedecifras.app');
  writeFileSync(join(dir, SONG_FILE), `${SONG_V1.join('\n')}\n`);
  await runGit(dir, ['add', SONG_FILE]);
  await runGit(dir, ['commit', '-m', 'Add a song']);
  await runGit(dir, [...cookieArgs(cookie), 'push', url, 'HEAD:refs/heads/main']);
}

// The second device appends the bridge and pushes it as INCOMING_AUTHOR — a clean
// fast-forward of the version the device has open, touching a different part than
// the reader's unsaved intro edit, so the two merge cleanly.
async function secondDevicePushesNewVersion(url, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', url, dir]);
  await configIdentity(dir, INCOMING_AUTHOR, 'ana@users.estantedecifras.app');
  const current = readFileSync(join(dir, SONG_FILE), 'utf8');
  writeFileSync(join(dir, SONG_FILE), current + BRIDGE.join('\n') + '\n');
  await runGit(dir, ['add', SONG_FILE]);
  await runGit(dir, ['commit', '-m', 'Add a bridge']);
  await runGit(dir, [...cookieArgs(cookie), 'push', url, 'HEAD:refs/heads/main']);
}

test('a sync merges a new version under the open editor’s unsaved edit, in place, with the notice that opens history (workflow 8 L55-56, W08)', async ({
  page,
  checkA11y,
}) => {
  const { url, cookie } = await hostedEmptyBook(page);
  await secondDeviceSeedsSong(url, cookie);
  await syncUntilSearchable(page);

  // Open the song in the editor and make an unsaved edit at the end of the intro
  // line (the part the incoming version will NOT touch).
  await openSongInEditor(page);
  const content = page.locator('.cm-content');
  await content.getByText(INTRO_LINE, { exact: true }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(INTRO_EDIT);
  await expect(content).toContainText(EDITED_INTRO);
  await checkA11y(); // the editor with an unsaved edit, this viewport

  // Let the debounced WRITE flush the edit into the working copy before the sync
  // captures it (WRITE_DEBOUNCE_MS = 400).
  await page.waitForTimeout(700);

  // The second device publishes a new version (a bridge) of the same song.
  await secondDevicePushesNewVersion(url, cookie);

  // A sync pass merges the incoming version UNDER the unsaved edit and emits
  // MERGED: the editor re-reads the merged working text in place and the notice
  // appears.
  await triggerSync(page);
  const notice = page.locator('.est-editor-update-notice');
  await expect(notice).toBeVisible({ timeout: 20000 });
  await expect(notice).toHaveAttribute('role', 'status');
  await expect(notice).toContainText(`Updated by ${INCOMING_AUTHOR}`);

  // The buffer now holds the merged text — both the reader's unsaved intro edit
  // ("B7", added only by the reader) and the incoming bridge ("lighthouse", added
  // only by the second device). The merge folded the edit in as `ours`.
  await expect(content).toContainText('B7');
  await expect(content).toContainText('lighthouse');
  await checkA11y(); // the merged editor + notice state, this viewport

  // The notice's action opens the song's history in-app (the shared onOpenHistory
  // seam, carrying the incoming commit).
  await notice.getByRole('button', { name: 'See what changed' }).click();
  await expect(page.locator('.est-history-row').first()).toBeVisible();
  await checkA11y(); // the history surface reached from the notice, this viewport

  // Back returns to the file view the editor was open in (the merged text is safe
  // in the working copy; the tree selection resets).
  await page.getByRole('button', { name: 'Back to the song' }).click();
  await expect(
    page.getByRole('button', { name: new RegExp(SONG_FILE.replace(/\./g, '\\.')) }),
  ).toBeVisible();
});
