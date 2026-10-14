// Real-UI journeys for sharing a book (workflow 10) and joining one
// (workflow 1 §Invited, workflow 7 §By link). Group `share`; the coordinator
// folds what is generally useful into journeys.js.
//
// Everything is the Share dialog, the invited screen and the Add-a-book sheet:
// no API writes, no dev mounts. The only reads that go below the UI are the
// book's id (GET /api/books), which the SQL capacity fill and the take-down
// need, and which the app itself never prints.

import { expect } from '@playwright/test';
import { gotoTab, saveThroughSheet, signedInDevice, makeLocalBook, putBookOnline, startApp } from './journeys.js';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const row = (title) => new RegExp(`^${escape(title)}`);

// A song for a book, written for these tests (no-song-text rule).
export function songLines(title, chords = 'C | G | Am | F') {
  return [`# ${title}`, '- language: en', '', '## Parte', '```', chords, '```', ''];
}

// Search (no query) → "New song in {book}" → replace the template with `lines`
// → the save sheet. The first save on a device asks for the author's name.
export async function writeSongInBook(page, bookTitle, lines, { name = 'Marina Souza' } = {}) {
  await gotoTab(page, 'Search');
  // A book with no song yet has no section to write into, so go in through the
  // Create row for a title that matches nothing.
  await page.getByRole('searchbox').fill('Nova cifra');
  await page.getByRole('button', { name: /Create .Nova cifra./ }).click();
  // The editor opens on My songs; the which-book control moves it to the book.
  await page.getByRole('button', { name: 'Change book' }).click();
  await page.getByRole('menuitem', { name: bookTitle }).click();
  await expect(page.getByText(new RegExp(`In ${escape(bookTitle)}`))).toBeVisible();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(lines.join('\n'));
  await saveThroughSheet(page, { name });
}

// A signed-in device owning a book that is online and carries one song (written
// through the editor before the book goes online, so putting it online pushes
// it and an invitation's clone has something to read). Returns the authenticator.
export async function hostedBookWithSong(page, bookTitle, songTitle, { chords } = {}) {
  const authenticator = await signedInDevice(page);
  await makeLocalBook(page, bookTitle);
  await writeSongInBook(page, bookTitle, songLines(songTitle, chords));
  await putBookOnline(page, bookTitle);
  await startApp(page);
  return authenticator;
}

// Read-only: a hosted book's id, for the two seams that act below the UI (the
// SQL capacity fill, the operator take-down).
export async function bookIdOf(page, title) {
  const resp = await page.request.get('/api/books');
  expect(resp.ok()).toBeTruthy();
  const { books } = await resp.json();
  const book = books.find((b) => b.title === title);
  if (!book) throw new Error(`book ${title} not found for the account`);
  return book.id;
}

// ---- the Share dialog -------------------------------------------------------

// The Books list, from wherever the person is: with a book's detail open on a
// narrow layout, or a song or the editor in front, the list is not showing, so
// start again from the shell.
export async function booksList(page) {
  const tab = page.getByRole('tab', { name: 'Books' });
  const heading = page.getByRole('heading', { level: 1, name: 'Books' });
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    if (await heading.isVisible({ timeout: 1500 }).catch(() => false)) return;
  }
  await startApp(page);
  await gotoTab(page, 'Books');
}

// Books → the book → Share. Returns the dialog.
export async function openSharing(page, bookTitle) {
  await booksList(page);
  await page.getByRole('button', { name: row(bookTitle) }).click();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: `Share ${bookTitle}` })).toBeVisible();
  return dialog;
}

// In an open Share dialog: Invite → role / expiry / use limit → Create link.
// Returns the invitation URL (shown once) and leaves the dialog on the link
// screen; `finishInvite` clicks Done.
export async function createInvitationIn(dialog, { role = 'Reader', expiry, limit } = {}) {
  await dialog.getByRole('button', { name: /^(Invite people|Invite someone to this song)$/ }).click();
  await dialog.getByRole('radio', { name: role }).click();
  if (expiry) await dialog.getByRole('radio', { name: expiry }).click();
  if (limit) {
    // The visible label toggles it (the switch input itself sits under its track).
    await dialog.getByText('Limit how many can use it', { exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Number of uses' }).fill(String(limit));
  }
  await dialog.getByRole('button', { name: 'Create link' }).click();
  const link = await dialog.getByRole('textbox', { name: 'Invitation link' }).inputValue();
  expect(link).toContain('/i/');
  return link;
}

export async function finishInvite(dialog) {
  await dialog.getByRole('button', { name: 'Done' }).click();
}

// Books → book → Share → invitation → Done → close. Returns the URL.
//   role: 'Reader' | 'Editor'; expiry: 'A day' | 'A week' | 'A month' |
//   'Until withdrawn'; limit: a number of uses.
export async function inviteThroughShare(page, bookTitle, opts = {}) {
  const dialog = await openSharing(page, bookTitle);
  const link = await createInvitationIn(dialog, opts);
  await finishInvite(dialog);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  return link;
}

// The invitee's side: open the link and, when signed out, make an account with
// a passkey (the page's context needs a virtual authenticator). Resolves once
// the sign-in finished; the caller asserts where the app lands.
export async function acceptInvitation(page, url, { signedIn = false } = {}) {
  await page.goto(url);
  if (signedIn) return;
  await expect(page.getByRole('heading', { name: /invited to a book on Estante/i })).toBeVisible();
  await page.getByRole('button', { name: 'Make an account' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Use a passkey' }).click();
}

// In an open Share dialog: remove the first member row through the typed-name
// confirm. Returns the member's label.
export async function removeFirstMember(page, dialog) {
  const memberRow = dialog
    .locator('.est-sharing-member', { has: page.getByRole('button', { name: 'Remove' }) })
    .first();
  const label = (await memberRow.locator('.name').first().textContent())?.trim();
  expect(label, 'the member row shows a label').toBeTruthy();
  await memberRow.getByRole('button', { name: 'Remove' }).click();
  const confirm = page.getByRole('dialog').filter({ hasText: 'Remove' }).last();
  const confirmButton = confirm.getByRole('button', { name: new RegExp(`^Remove ${escape(label)}`) });
  await expect(confirmButton).toBeDisabled();
  await confirm.getByRole('textbox').fill(label);
  await confirmButton.click();
  return label;
}

// Insert a uniquely-marked section before the song's first heading in the open
// editor and save it (a clean, canonicalisable change).
export async function addSectionAndSave(page, mark, { name } = {}) {
  const heading = page.locator('.cm-content .cm-line').filter({ hasText: /^## / }).first();
  await heading.click();
  await page.keyboard.press('Home');
  await page.keyboard.insertText(`## ${mark}\n\`\`\`\nC | G\n\`\`\`\n\n`);
  await saveThroughSheet(page, { name });
}
