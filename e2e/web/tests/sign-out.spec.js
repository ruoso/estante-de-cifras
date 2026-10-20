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
// The songs are opened through the real navigation (search → song → Edit) and
// the shell is reached by Back in the same session, never a reload: the index's
// `unsaved` flag is live-only. Book and song names are written for this test
// (no-song-text rule).

import { mockup } from '../lib/mockup.js';
import { test, expect } from '../lib/axe.js';
import {
  hostedBook,
  makeLocalBook,
  waitUntilSearchable,
  openFileInFiles,
  gotoTab,
  hasSessionCookie,
} from '../lib/journeys.js';
import { confirmSaveSheet, leaveFiles, editSong } from '../lib/journeys-files.js';
import { GitDevice } from '../lib/git-device.js';

const HOSTED = 'Banda do Bairro';
const LOCAL = 'Rascunhos';
const SONG_FILE = 'roda-de-rua.cifra.md';
const SONG = ['# Roda de rua', '- language: en', '', '## Parte', '```', 'C | G | Am | F', '```'].join('\n');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rowFor = (title) => new RegExp('^' + escapeRegExp(title));

// Leave the file view and open the shell's Account screen (in the same
// session — a reload would reconcile every song as saved).
async function openAccount(page) {
  await leaveFiles(page);
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
}

// Sign in, host a book, seed one song into it from a second device (the git CLI
// over the owner's session), and keep a second, purely-local book.
async function hostAndSeed(page) {
  const { url, cookie } = await hostedBook(page, HOSTED);
  const device = new GitDevice({ url, cookie, name: 'Beto', email: 'beto@users.estantedecifras.app' });
  try {
    await device.pushFiles({ [SONG_FILE]: `${SONG}\n` }, 'Seed a song');
  } finally {
    device.cleanup();
  }
  await waitUntilSearchable(page, 'Roda', 'Roda de rua'); // pull the seeded song in
  await page.getByRole('searchbox').fill('');
  await makeLocalBook(page, LOCAL); // a book only on this device (the download guard)
}

test('Remove counts this device’s local-only work and empties the account’s books; axe-clean', async ({
  page,
  checkA11y,
}) => {
  await hostAndSeed(page);

  // Everything from here is offline: the local teardown must not wait on the
  // network, and an offline save stays unpushed so the dialog can count it.
  await page.context().setOffline(true);

  // One save made offline (a commit not yet pushed), then a further unsaved edit.
  // (The wide layouts' reading view has no way back to the shell, so the song
  // is edited through Books → Files, whose Back returns to the Books screen.)
  await openFileInFiles(page, HOSTED, SONG_FILE);
  await editSong(page, 'Ponte');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await confirmSaveSheet(page, 'Marina');
  await editSong(page, 'Refrao');
  await expect(page.locator('.cm-content')).toContainText('Refrao');

  // Back to the shell in the same session (the unsaved flag survives) → account.
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
  await mockup(page, 'W13-new-device', 4); // the account screen and signing out (computer)

  // Remove is the default; confirm.
  await expect(dialog.getByRole('radio', { name: /Remove this account’s books/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Sign out and remove' }).click();

  // The account's books are gone from the shelf.
  await gotoTab(page, 'Books');
  await expect(page.getByRole('button', { name: rowFor(HOSTED) })).toHaveCount(0);
  await expect(page.getByRole('button', { name: rowFor(LOCAL) })).toHaveCount(0);
});

test('Keep turns the account’s books into local books and clears the session; axe-clean', async ({
  page,
  checkA11y,
}) => {
  await hostAndSeed(page);

  // One unsaved edit so the dialog has something to warn about (online — Keep
  // removes nothing and needs no offline teardown).
  await openFileInFiles(page, HOSTED, SONG_FILE);
  await editSong(page, 'Ponte');
  await expect(page.locator('.cm-content')).toContainText('Ponte');

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
  await gotoTab(page, 'Books');
  await expect(page.getByRole('button', { name: rowFor(HOSTED) })).toBeVisible();
  await page.getByRole('button', { name: rowFor(HOSTED) }).click();
  await expect(page.getByText('On Estante · private')).toHaveCount(0);
});
