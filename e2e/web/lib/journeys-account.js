// Real-UI journeys for the `account` group of e2e-web specs (account screen,
// sign-in, leaving, chart reading). Yours alone: the coordinator folds the
// generally useful ones into journeys.js.

import { expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  startApp,
  gotoTab,
  enableVirtualAuthenticator,
  hasSessionCookie,
  sharePasskeys,
  sessionCookie,
  bookGitUrl,
  signedInDevice,
} from './journeys.js';
import { waitForMessage, extractSignInLink, extractRecoveryEmailLink } from './mail.js';
import { openDevice } from './devices.js';
import { GitDevice } from './git-device.js';
import { baseUrl } from './env.js';
import { inviteThroughShare } from './journeys-share.js';

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

// ---- a confirmed recovery email (account.recovery_email) ---------------------

export const RECOVERY_CONFIRMED = 'Your recovery email is confirmed';

// The newest verification link mailed to `email` — other than `previous`, when
// an earlier one went to the same address.
export async function readVerificationLink(email, previous = null) {
  const message = await waitForMessage(email, (m) => {
    const link = extractRecoveryEmailLink(m);
    return link !== null && link !== previous;
  });
  expect(message, 'the verification mail should arrive at the catcher').not.toBeNull();
  return extractRecoveryEmailLink(message);
}

// Open the link on a fresh device (no service worker, no session) and expect
// it confirmed there, still signed out. The context is closed after.
export async function confirmOnFreshDevice(browser, link) {
  const device = await openDevice(browser);
  try {
    await device.page.goto(link);
    await expect(device.page.getByRole('heading', { name: RECOVERY_CONFIRMED })).toBeVisible();
    expect(await hasSessionCookie(device.page)).toBe(false);
  } finally {
    await device.context.close();
  }
}

// Reopen the account screen so it re-reads the region.
export async function reopenAccount(page) {
  await startApp(page);
  await openAccount(page);
}

// A signed-in account whose recovery email is `email`, confirmed. Returns the
// verification link it was confirmed with.
export async function accountWithConfirmed(page, browser, email) {
  await signedInDevice(page);
  await openAccount(page);
  await setRecoveryEmail(page, email);
  const link = await readVerificationLink(email);
  await confirmOnFreshDevice(browser, link);
  await reopenAccount(page);
  await expect(recoveryRegion(page).getByText('Confirmed', { exact: true })).toBeVisible();
  return link;
}

// From the Add-a-book chooser's Mine on Estante row, signed out
// (books.add_book_chooser Decision 4): open the sign-in surface for an EXISTING
// account — `'passkey'` lands on its method step ("Sign in"), `'email'` on its
// email step ("Email me a link", "Your email"). Starts from the Books
// destination; `onChooser(sheet)` runs on the chooser once Mine has answered.
export async function signInFromMine(page, how, { onChooser } = {}) {
  await gotoTab(page, 'Books');
  await page.getByRole('button', { name: 'Add a book' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add a book' });
  const mine = sheet.getByRole('group', { name: 'Mine on Estante' });
  const passkey = mine.getByRole('button', { name: 'Sign in with a passkey' });
  const email = mine.getByRole('button', { name: 'No passkey here? Email me a link' });
  await expect(passkey).toBeVisible();
  await expect(email).toBeVisible();
  if (onChooser) await onChooser(sheet);
  if (how === 'email') {
    await email.click();
    await expect(page.getByRole('heading', { name: 'Email me a link' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Your email' })).toBeFocused();
  } else {
    await passkey.click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  }
}

// Emailed-link sign-in, then add a passkey on the offer (needs a virtual
// authenticator on this context).
export async function signInByEmailWithPasskey(page, email) {
  await openEmailedLink(page, email);
  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Your shelf is empty' })).toBeVisible();
}

// ---- sharing between two people (workflow 10) ----------------------------------

// Make an invitation link for `bookTitle` through the people screen
// (books.share_people), and come back to the book.
export async function inviteLink(page, bookTitle, role = 'Editor') {
  return inviteThroughShare(page, bookTitle, { role });
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

// On the open account screen, choose a density (shell.display_preferences;
// workflow 1 §Density) by its name — Compact, Comfortable, Roomy — and wait for
// the app root to apply it and the row to be marked chosen.
export async function chooseDensity(page, name) {
  const radio = page.getByRole('radiogroup', { name: 'Density' }).getByRole('radio', { name: new RegExp(name) });
  await radio.click();
  await expect(page.locator('div.est').first()).toHaveClass(new RegExp(`density-${name.toLowerCase()}`));
  await expect(radio).toBeChecked();
}

// On the open account screen, choose how chord diagrams are drawn
// (workflow 16 §How diagrams are drawn): the hand by its name — Right-handed,
// Left-handed — and the neck — Vertical, Horizontal. Each waits for the live
// sample diagram to follow.
const diagramSample = (page) => page.locator('.account-diagram-sample .chord-diagram');

export async function chooseDiagramHand(page, name) {
  const radio = page.getByRole('radiogroup', { name: 'Hand' }).getByRole('radio', { name: new RegExp(name) });
  await radio.click();
  await expect(radio).toBeChecked();
  const left = /chord-diagram--left/;
  if (name.startsWith('Left')) await expect(diagramSample(page)).toHaveClass(left);
  else await expect(diagramSample(page)).not.toHaveClass(left);
}

export async function chooseDiagramNeck(page, name) {
  const radio = page.getByRole('radiogroup', { name: 'Neck' }).getByRole('radio', { name: new RegExp(name) });
  await radio.click();
  await expect(radio).toBeChecked();
  await expect(diagramSample(page).locator('svg')).toHaveClass(
    new RegExp(`ec-diagram-${name.toLowerCase()}`),
  );
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

// Read-only: every author and committer address on a hosted book's `main` as the
// service holds it — a git clone carrying the session, the way another device
// would read it (account.commit_author; DIRECTION §3.3).
export async function pushedAuthorEmails(page, title) {
  const device = new GitDevice({ url: await bookGitUrl(page, title), cookie: await sessionCookie(page) });
  try {
    await device.clone();
    const { stdout } = await promisify(execFile)('git', ['log', '--format=%ae%n%ce', 'main'], {
      cwd: device.dir,
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
    });
    return stdout.split('\n').filter(Boolean);
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
