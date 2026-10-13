// share (e2e-web) — the two-device sharing journey against the compose stack, on
// the phone/tablet/computer projects, with axe at WCAG 2.1 AA on every sharing
// screen and overlay (books.share, workflow 10; board W10). The owner makes an
// invitation through the Sharing surface; a second browser context joins through
// `/i/<token>`; both edit the shared song and sync to a clean merge; the owner's
// Sharing then reads the join, withdraws the invitation (the joined member
// stays), removes the member (whose next sync is refused and whose shelf reads
// *no longer shared with you*); and a song's Share opens the member's plain
// address `/b/<bookId>/<path>` in the reading view.
//
// The owner drives the real Sharing UI this task ships; the collaboration/merge
// is driven black-box through two browser editors (the edit/save/merge machinery
// of songs.editor / songs.save_sheet / sync.engine is already shipped, and is
// pinned concurrently at the behavior + sync-engine levels). A node `git` client
// seeds the first song into the hosted book the way read-in-place.spec.js does —
// the owner's own session cookie over smart HTTP — because the book is created
// empty. Book and song names are written for this test (no-song-text rule).

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

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rowFor = (title) => new RegExp('^' + escapeRegExp(title));

// --- CDP virtual authenticator + account helpers (inline, as the harness does) ---

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
  const dir = mkdtempSync(join(tmpdir(), 'estante-e2e-share-'));
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
  await page.goto(`/#dev/editor?book=${encodeURIComponent(bookId)}&path=${encodeURIComponent(SONG_FILE)}`);
  await expect(page.locator('.cm-content')).toBeVisible();
}

// Insert a uniquely-marked section before the song's first heading (the clean,
// canonicalisable change save-sheet.spec.js uses), then let the debounced WRITE
// settle and save it (answering the first-save name prompt when asked).
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

// Reload the shell so the sync engine runs a pass (pushes this device's unpushed
// commits, pulls the other's), settling before the caller reads the result.
async function reloadAndSync(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.waitForTimeout(1500);
}

// Open the song in the editor and poll (reloading to sync) until its text carries
// every expected mark — the clean-merge assertion.
async function expectSongHasMarks(page, bookId, marks) {
  await expect(async () => {
    await reloadAndSync(page);
    await editorGoto(page, bookId);
    for (const mark of marks) {
      await expect(page.locator('.cm-content')).toContainText(mark, { timeout: 2500 });
    }
  }).toPass({ timeout: 90000 });
}

// --- Sharing surface helpers ---

async function openSharing(page) {
  await page.getByRole('button', { name: rowFor(BOOK) }).click();
  await page.getByRole('button', { name: 'Share' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: `Share ${BOOK}` })).toBeVisible();
  return dialog;
}

test('the two-device sharing journey: invite, join, edit to a clean merge, withdraw, remove, share a song', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(240000);
  const narrow = testInfo.project.name === 'phone';

  // Owner: a signed-in device with a hosted book carrying one seeded song.
  await enableVirtualAuthenticator(page);
  await signInWithPasskey(page);
  await makeLocalBook(page, BOOK);
  await putBookOnline(page, BOOK);
  const book = await bookFromApi(page, BOOK);
  const bookId = book.id;
  const gitUrl = new URL(book.gitUrl, `${baseUrl}/`).toString();
  await seedSong(gitUrl, await sessionCookieHeader(page));

  // 1) The owner opens Sharing, sees 0 of 50, and makes an editor invitation.
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('tab', { name: 'Books' }).click();
  let dialog = await openSharing(page);
  await expect(dialog.getByText('0 of 50')).toBeVisible();
  await expect(dialog.getByText('You', { exact: true })).toBeVisible();
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the owner Sharing surface

  await dialog.getByRole('button', { name: 'Invite people' }).click();
  await dialog.getByRole('radio', { name: 'Editor' }).click();
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the new-invitation form
  await dialog.getByRole('button', { name: 'Create link' }).click();
  const link = await dialog.getByRole('textbox', { name: 'Invitation link' }).inputValue();
  expect(link).toContain('/i/');
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the link-shown-once state

  // 2) A second browser context opens the link, makes an account, and joins as an
  // editor; the book lands on its shelf as "can save".
  const joiner = await openDevice(browser);
  try {
    await enableVirtualAuthenticator(joiner.page);
    await joiner.page.goto(link);
    await expect(
      joiner.page.getByRole('heading', { name: /invited to a book on Estante/i }),
    ).toBeVisible();
    expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the invited screen
    await joiner.page.getByRole('button', { name: 'Make an account' }).click();
    await expect(joiner.page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await joiner.page.getByRole('button', { name: 'Use a passkey' }).click();
    await expect(joiner.page.getByRole('button', { name: rowFor(BOOK) })).toBeVisible();
    await expect(joiner.page.getByText('On Estante · can save')).toBeVisible();

    // 3) Both edit the shared song and sync to a clean merge. The owner adds a
    // section and saves (it pushes on the next sync); the joiner syncs it down,
    // adds its own section on top and saves; the owner syncs back. Both devices
    // end with both contributions — a clean merge.
    await reloadAndSync(page);
    await editorGoto(page, bookId);
    await editAndSave(page, 'OwnerPart', 'Ana');
    await reloadAndSync(page);

    await expectSongHasMarks(joiner.page, bookId, ['OwnerPart']);
    await editAndSave(joiner.page, 'JoinerPart', 'Beto');
    await reloadAndSync(joiner.page);

    await expectSongHasMarks(page, bookId, ['OwnerPart', 'JoinerPart']);
    await expectSongHasMarks(joiner.page, bookId, ['OwnerPart', 'JoinerPart']);

    // 4) The owner's Sharing now reads 1 of 50 and shows who joined through the
    // invitation.
    await page.goto('/');
    await waitForServiceWorker(page);
    await page.getByRole('tab', { name: 'Books' }).click();
    dialog = await openSharing(page);
    await expect(dialog.getByText('1 of 50')).toBeVisible();
    await expect(dialog.getByText('Editor invitation')).toBeVisible();
    await expect(dialog.getByText(/1 person/)).toBeVisible();

    // The joined member's id, for the typed-name remove below.
    // The `has:` inner locator must be relative to each `.est-sharing-member`
    // row, so it is rooted at `page` (empty prefix), not `dialog` — a
    // dialog-rooted inner would look for a <dialog> descendant inside the row
    // and match nothing.
    const memberRow = dialog.locator('.est-sharing-member', { has: page.getByRole('button', { name: 'Remove' }) }).first();
    const memberId = (await memberRow.locator('.name').first().textContent())?.trim();
    expect(memberId, 'the joined member row shows an id').toBeTruthy();

    // 5) The owner withdraws the invitation: nobody new can join; the joined
    // member stays (still 1 of 50).
    await dialog.getByRole('button', { name: 'Withdraw' }).click();
    await expect(dialog.getByText('withdrawn')).toBeVisible();
    await expect(dialog.getByText('1 of 50')).toBeVisible();
    expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the withdrawn state

    // 6) The owner removes the member through the typed-name confirm.
    await memberRow.getByRole('button', { name: 'Remove' }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Remove' }).last();
    await expect(confirm.getByRole('button', { name: new RegExp(`^Remove ${escapeRegExp(memberId)}`) })).toBeDisabled();
    expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the remove confirm
    await confirm.getByRole('textbox').fill(memberId);
    await confirm.getByRole('button', { name: new RegExp(`^Remove ${escapeRegExp(memberId)}`) }).click();

    // The removed member's next sync is refused, and their shelf reads
    // *no longer shared with you*.
    await expect(async () => {
      await reloadAndSync(joiner.page);
      await joiner.page.getByRole('tab', { name: 'Books' }).click();
      await expect(joiner.page.getByText('no longer shared with you')).toBeVisible({ timeout: 2500 });
    }).toPass({ timeout: 90000 });

    // 7) Share from a song: the owner opens the shared song and shares it; the
    // member's plain address `/b/<bookId>/<path>` opens that song in the reading
    // view. (The owner reads their own book here — the member was removed.)
    await page.goto('/');
    await waitForServiceWorker(page);
    await page.getByRole('searchbox').fill('Roda');
    const result = page.getByRole('button', { name: new RegExp(SONG_TITLE) });
    await expect(result.first()).toBeVisible();
    await result.first().click();
    await expect(page.locator('.reading-sheet')).toBeVisible();

    // Open Share from the reading toolbar (the More menu on the phone).
    if (narrow) {
      await page.getByRole('button', { name: 'More' }).click();
      await page.getByRole('menuitem', { name: 'Share' }).click();
    } else {
      await page.getByRole('button', { name: 'Share' }).click();
    }
    const shareDialog = page.getByRole('dialog');
    const address = await shareDialog.getByRole('textbox', { name: 'Song address' }).inputValue();
    expect(address).toContain(`/b/${bookId}/${SONG_FILE}`);
    expect(await analyzeWcag21aa(page)).toEqual([]); // axe: share-on-a-song

    // The plain address deep-links to the song in the reading view.
    await page.goto(address);
    await waitForServiceWorker(page);
    await expect(page.locator('.reading-sheet')).toBeVisible();
    await expect(page.locator('.reading-sheet')).toContainText('OwnerPart');
  } finally {
    await joiner.context.close();
  }
});
