// Real-UI journeys for the `account` group of e2e-web specs (account screen,
// sign-in, leaving, chart reading). Yours alone: the coordinator folds the
// generally useful ones into journeys.js.

import { expect } from '@playwright/test';
import { startApp, gotoTab, enableVirtualAuthenticator, hasSessionCookie } from './journeys.js';
import { waitForMessageTo, extractSignInLink } from './mail.js';

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
// The address must already have an account: no UI writes a recovery email yet
// (tasks account.recovery_email / service.recovery_email), so callers seed it.
export async function openEmailedLink(page, email) {
  await startApp(page);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await page.getByRole('textbox', { name: 'Your email' }).fill(email);
  await page.getByRole('button', { name: 'Send the link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  const message = await waitForMessageTo(email);
  expect(message, 'the sign-in mail should arrive at the catcher').not.toBeNull();
  const link = extractSignInLink(message);
  expect(link, 'the mail should carry a /sign-in/<token> link').not.toBeNull();
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Make signing in quicker' })).toBeVisible();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
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
export async function signInExistingWithPasskey(page) {
  await startApp(page);
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
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
