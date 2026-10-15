// Real-UI journeys for the `account` group of e2e-web specs (account screen,
// sign-in, leaving, chart reading). Yours alone: the coordinator folds the
// generally useful ones into journeys.js.

import { expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  startApp,
  gotoTab,
  enableVirtualAuthenticator,
  hasSessionCookie,
  sharePasskeys,
  sessionCookie,
} from './journeys.js';
import { waitForMessage, extractSignInLink } from './mail.js';
import { openDevice } from './devices.js';
import { GitDevice } from './git-device.js';
import { baseUrl } from './env.js';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function uniqueEmail(prefix = 'account') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}@estante.test`;
}

// Open the account screen from the header affordance.
export async function openAccount(page) {
  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
}

// Request an emailed sign-in link from the shell's Sign in and open it, as a
// mail client would. Leaves the page on the "Make signing in quicker" offer.
// The address must already be an account's: seeded (lib/db.js) or set through
// the account screen's Recovery email region (setRecoveryEmail). The mail read
// is the newest one carrying a sign-in link, since the same address may have
// had a verification mail just before.
export async function openEmailedLink(page, email) {
  await startApp(page);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await page.getByRole('textbox', { name: 'Your email' }).fill(email);
  await page.getByRole('button', { name: 'Send the link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  const message = await waitForMessage(email, (m) => extractSignInLink(m) !== null);
  expect(message, 'the sign-in mail should arrive at the catcher').not.toBeNull();
  const link = extractSignInLink(message);
  expect(link, 'the mail should carry a /sign-in/<token> link').not.toBeNull();
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Make signing in quicker' })).toBeVisible();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
}

// The account screen's Recovery email region (account.recovery_email).
export function recoveryRegion(page) {
  return page.getByRole('region', { name: 'Recovery email' });
}

// Set (or change) the recovery email from the account screen, which must be
// open: type the address, send, and wait for the waiting badge. A confirmed
// address is changed through Change; a pending one through Use a different
// address.
export async function setRecoveryEmail(page, email) {
  const region = recoveryRegion(page);
  const field = region.getByRole('textbox', { name: 'Recovery email' });
  // Loaded: one of the region's state words is drawn.
  await expect(
    region.getByText(/^(No recovery email|Confirmed|Waiting for you to confirm)$/).first(),
  ).toBeVisible();
  if (!(await field.isVisible())) {
    const change = region.getByRole('button', { name: 'Change' });
    if (await change.isVisible()) await change.click();
    else await region.getByRole('button', { name: 'Use a different address' }).click();
  }
  await field.fill(email);
  await region.getByRole('button', { name: 'Send a verification link' }).click();
  await expect(region.getByText('Waiting for you to confirm')).toBeVisible();
}

// Emailed-link sign-in, then add a passkey on the offer (needs a virtual
// authenticator on this context).
export async function signInByEmailWithPasskey(page, email) {
  await openEmailedLink(page, email);
  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Your shelf is empty' })).toBeVisible();
}

// ---- sharing between two people (workflow 10) ----------------------------------

// The owner's Share dialog for a book on the Books screen.
export async function openSharing(page, bookTitle) {
  // Right after putBookOnline the book's detail is still open (Share is there).
  const share = page.getByRole('button', { name: 'Share', exact: true });
  if (!(await share.isVisible().catch(() => false))) {
    await gotoTab(page, 'Books');
    await page.getByRole('button', { name: new RegExp(`^${escape(bookTitle)}`) }).click();
  }
  await share.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: `Share ${bookTitle}` })).toBeVisible();
  return dialog;
}

// Make an invitation link for `bookTitle` through the Share dialog.
export async function inviteLink(page, bookTitle, role = 'Editor') {
  const dialog = await openSharing(page, bookTitle);
  await dialog.getByRole('button', { name: 'Invite people' }).click();
  await dialog.getByRole('radio', { name: role }).click();
  await dialog.getByRole('button', { name: 'Create link' }).click();
  const link = await dialog.getByRole('textbox', { name: 'Invitation link' }).inputValue();
  expect(link).toContain('/i/');
  return link;
}

// A second PERSON: a fresh browser context with its own authenticator opens the
// invitation, makes an account and lands on the shelf with the book. The caller
// closes `.context`.
export async function joinByInvite(browser, link, bookTitle) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const authenticator = await enableVirtualAuthenticator(page);
  await page.goto(link);
  await expect(page.getByRole('heading', { name: /invited to a book on Estante/i })).toBeVisible();
  await page.getByRole('button', { name: 'Make an account' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^${escape(bookTitle)}`) })).toBeVisible();
  return { context, page, authenticator };
}

// ---- a second device of the same person (workflow 13) -------------------------

// Sign an EXISTING account in on a fresh device with a (synced) passkey. The
// shell's first-run Sign in makes a NEW account (create intent); signing in to
// an existing one is the account screen's not-signed-in card -> Use a passkey
// -> the sign-in surface's Use a passkey. Needs an authenticator holding the
// account's credential (journeys.sharePasskeys).
// `onSurface(page)` runs on the sign-in surface before the passkey is used (a
// mockup() of it, say).
export async function signInExistingWithPasskey(page, { onSurface } = {}) {
  await startApp(page);
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  if (onSurface) await onSurface(page);
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
}

// ---- a new device (workflow 13 §What comes down) ---------------------------------

// Another device of the same person: a fresh browser context whose authenticator
// holds a synced copy of `authenticator`'s passkey signs in to the account from
// the account screen, then goes Back to the Books screen (no reload: what comes
// down comes down in this start). The caller closes `.context`.
export async function anotherDeviceSignsIn(browser, authenticator, { onSurface } = {}) {
  const device = await openDevice(browser);
  const own = await enableVirtualAuthenticator(device.page);
  expect(await sharePasskeys(authenticator, own)).toBeGreaterThan(0);
  await signInExistingWithPasskey(device.page, { onSurface });
  await closeAccount(device.page);
  await gotoTab(device.page, 'Books');
  return { ...device, authenticator: own };
}

// Leave the account screen with its Back.
export async function closeAccount(page) {
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  await expect(page.getByRole('tab', { name: 'Books' })).toBeVisible();
}

// Choose a theme on the account screen, and leave it.
export async function chooseTheme(page, name) {
  await openAccount(page);
  await page.getByRole('radio', { name: new RegExp(name) }).click();
  await expect(page.locator('div.est').first()).toHaveClass(new RegExp(`theme-${name.toLowerCase()}`));
  await closeAccount(page);
}

// Read-only: the account's home book's shelf.json as the service holds it (a
// git clone, the way another device would read it), `{}` while it holds none.
export async function accountShelf(page) {
  const resp = await page.request.get('/api/account/home-book');
  expect(resp.ok()).toBeTruthy();
  const home = await resp.json();
  const device = new GitDevice({ url: new URL(home.gitUrl, `${baseUrl}/`).toString(), cookie: await sessionCookie(page) });
  try {
    await device.clone();
    return existsSync(join(device.dir, 'shelf.json')) ? JSON.parse(device.read('shelf.json')) : {};
  } catch {
    return {}; // nothing pushed yet
  } finally {
    device.cleanup();
  }
}

// Wait until the account's home book on the service satisfies `check(shelf)` —
// the device's home sync has pushed what it wrote.
export async function untilAccountShelf(page, check, { timeout = 20000 } = {}) {
  await expect.poll(async () => check(await accountShelf(page)), { timeout }).toBe(true);
}

// A book's row on the Books screen, by its title.
export function bookRow(page, title) {
  return page.locator('.book-row').filter({ has: page.locator('.name', { hasText: new RegExp(`^${escape(title)}$`) }) });
}

// ---- writing a song (workflow 3) ------------------------------------------------

// From the empty shelf: Write a song, replace the template with `lines`, save
// through the first-save sheet. Lands back on search with the song on My songs.
export async function writeSongFromScratch(page, lines, { name = 'Marina Souza' } = {}) {
  await startApp(page);
  await page.getByRole('button', { name: /Write a song/ }).click();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(lines.join('\n'));
  await page.getByRole('button', { name: 'Save' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('textbox', { name: 'Note' })).not.toHaveValue('');
  await sheet.getByRole('textbox', { name: /Your name/ }).fill(name);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
}

// A purpose-written song for reading-the-chart specs: a split word (a chord
// opens room inside "Testing"), three chords over word starts, a words-only
// line after a stanza break, a bar-lined chord line and a run of chords with
// no bars.
export const CHART_TITLE = 'Gallery Tune';
export const CHART_SONG = [
  `# ${CHART_TITLE}`,
  '',
  '## Verse',
  '```',
  '  G',
  'Testing',
  'G    D   Em',
  'cats and dogs',
  '',
  'humming with no chords',
  '```',
  '',
  '## Chart',
  '```',
  'C | G | Am | F',
  'Am E F#m',
  '```',
  '',
];

// The same song plus one long sung lyric line under a single chord.
export const LONG_LINE_SONG = [
  ...CHART_SONG,
  '## Long',
  '```',
  'C',
  'a very long line of words that keeps going well past the width of a phone so it has to wrap',
  '```',
  '',
];

// Write the chart fixture song into My songs from the empty shelf.
export async function writeChartSong(page, lines = CHART_SONG) {
  await writeSongFromScratch(page, lines);
}
