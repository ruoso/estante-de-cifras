// e2e-web — a setlist made and changed in a book that is already online goes
// up to Estante, on the phone, tablet and computer (workflow 12 §Building one,
// workflow 8 §What the shelf says). Against the compose stack: the device signs
// in, puts a book with a song online, makes a setlist in it from the song, sets
// the song's key, saves and syncs — and a second device that speaks plain git
// (the host git CLI, real smart HTTP through the pre-receive hook) finds the
// setlist on the service. A second change to the same setlist goes up too.
//
// Then the session goes (the cookie dropped, as a phone ending the app's
// process used to drop it): a third change cannot go up, and the shelf says
// *sign in to sync* with a notice counting the save held back — never "saves
// waiting", which read as offline and hid it for good. Signing in again from
// the notice sends it.
//
// Book, song and setlist names are written for this test (no-song-text rule).

import { readdirSync } from 'node:fs';
import { test, expect } from '../lib/axe.js';
import {
  gotoTab,
  openSongFromSearch,
  bookGitUrl,
  sessionCookie,
  hasSessionCookie,
  syncNow,
  toDestinations,
} from '../lib/journeys.js';
import { hostedBookWithSong } from '../lib/journeys-share.js';
import { addToNewSetlistFromSong, openSetlist, editSetlist } from '../lib/journeys-files.js';
import { GitDevice } from '../lib/git-device.js';

const BOOK = 'Roda de Terça';
const SONG = 'Choro da Esquina';
const SETLIST = 'Ensaio de terça';

// The book's row on the shelf.
const bookRow = (page) => page.getByRole('button', { name: new RegExp(`^${BOOK}`) });

// Setlist read view → Edit → the key/note fields for the one song → Save, and
// wait for the editor's unsaved word to clear; then Done back to the read view.
async function setKeyAndNote(page, { key, note }) {
  await openSetlist(page, SETLIST);
  await editSetlist(page);
  await page.getByRole('textbox', { name: `Key for ${SONG}` }).fill(key);
  await page.getByRole('textbox', { name: `Note for ${SONG}` }).fill(note);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/not saved yet|unsaved/)).toBeHidden();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await toDestinations(page);
}

// The setlist as the service holds it: a fresh clone's one `*.setlist.md`.
async function setlistOnService(device) {
  await device.clone();
  const files = readdirSync(device.dir, { recursive: true }).filter((f) => String(f).endsWith('.setlist.md'));
  return files.length === 1 ? device.read(String(files[0])) : null;
}

test('a setlist made and changed in a hosted book goes up; signed out, the shelf says so and signing in sends it', async ({
  page,
  checkA11y,
}) => {
  test.setTimeout(120000);

  // Signed in, a book with one song, online (workflow 13; books.online).
  const authenticator = await hostedBookWithSong(page, BOOK, SONG);
  const device = new GitDevice({ url: await bookGitUrl(page, BOOK), cookie: await sessionCookie(page) });

  try {
    // The song → Add to setlist → New setlist…, then its key and note, saved.
    await openSongFromSearch(page, 'Choro', SONG);
    await addToNewSetlistFromSong(page, SONG, SETLIST);
    await page.getByRole('button', { name: /^Back/ }).filter({ visible: true }).first().click();
    await setKeyAndNote(page, { key: 'D', note: 'two choruses' });

    // Sync now: the book reads in step (no badge), and the service has it.
    await syncNow(page);
    await expect(bookRow(page).locator('.badge')).toHaveCount(0);
    await expect
      .poll(() => setlistOnService(device), { timeout: 20000 })
      .toMatch(/two choruses/);
    const first = await setlistOnService(device);
    expect(first).toContain(SETLIST);

    // A second change to the same setlist goes up too.
    await setKeyAndNote(page, { key: 'E', note: 'one chorus, then the coda' });
    await syncNow(page);
    await expect
      .poll(() => setlistOnService(device), { timeout: 20000 })
      .toMatch(/one chorus, then the coda/);

    // The session goes; the device still holds its account. A third change
    // cannot go up, and the shelf says why.
    await page.context().clearCookies();
    expect(await hasSessionCookie(page)).toBe(false);
    await setKeyAndNote(page, { key: 'F', note: 'after the break' });
    await syncNow(page);
    await expect(bookRow(page).getByText('sign in to sync')).toBeVisible({ timeout: 20000 });
    const notice = page.locator('.signed-out-notice');
    await expect(notice).toContainText('You’re not signed in on this device, so 1 save can’t go up.');
    await checkA11y();
    expect(await setlistOnService(device)).not.toMatch(/after the break/);

    // Sign in again from the notice, with the same passkey: the save goes up.
    await notice.getByRole('button', { name: 'Sign in' }).click();
    await page
      .getByRole('group', { name: 'Already have an account?' })
      .getByRole('button', { name: 'Use a passkey' })
      .click();
    await expect.poll(() => hasSessionCookie(page)).toBe(true);
    await expect(page.getByRole('heading', { name: 'Sign in or make an account' })).toBeHidden();
    await expect
      .poll(() => setlistOnService(device), { timeout: 30000 })
      .toMatch(/after the break/);
    await toDestinations(page);
    await gotoTab(page, 'Books');
    await expect(notice).toBeHidden();
    await expect(bookRow(page).locator('.badge')).toHaveCount(0);
  } finally {
    device.cleanup();
    void authenticator;
  }
});
