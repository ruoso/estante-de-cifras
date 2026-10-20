// author-name (e2e-web) — changing the name one saves as (account.author_name;
// workflow 4 §Who made the change; workflow 13 §The account screen; mockup
// Theme-picker). Against the compose stack, on the phone, tablet and computer
// projects, every step through the real UI: a signed-in device with a book
// online and a song saved as *Marina Souza* opens the Account screen, where
// *Your name* reads it; *Change your name* is prefilled, a blank name is
// refused in words, and *Marina Lima* is saved. The next save asks no name; on
// this device both saves read *you* in the song's history (one's own saves stay
// *you*). A second person who joins by invitation reads the newer save as
// *Marina Lima* and the earlier as *Marina Souza* — history is not rewritten.
// Axe at WCAG 2.1 AA on the Account screen, the open dialog and the joiner's
// history. Book and song names are written for the test (no-song-text rule).

import { test, expect, analyzeBothThemes } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { openSongInEditor, typeAtEndOfLine, waitUntilSearchable, syncNow } from '../lib/journeys.js';
import { hostedBookWithSong } from '../lib/journeys-share.js';
import {
  openAccount,
  closeAccount,
  changeAuthorName,
  inviteLink,
  joinByInvite,
  pushedAuthorEmails,
} from '../lib/journeys-account.js';
import { openSaveSheet, confirmSheet, openSongHistory } from '../lib/journeys-edit.js';

const BOOK = 'Cantigas da Varanda';
const SONG_TITLE = 'Toada do Nome';
const QUERY = 'Toada';
const BARS = 'C | G | Am | F';

const contexts = [];
test.afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close().catch(() => {});
});

test('a name changed on the Account screen authors the saves after it; earlier saves keep theirs; axe-clean', async ({
  browser,
  page,
  checkA11y,
}) => {
  test.setTimeout(120000);
  await hostedBookWithSong(page, BOOK, SONG_TITLE, { chords: BARS });
  // Two addresses (author, committer) per commit on the server.
  const pushedBefore = (await pushedAuthorEmails(page, BOOK)).length;

  // The Account screen: Your name reads the name the first save asked for.
  await openAccount(page);
  const row = page.getByRole('region', { name: 'Your name' });
  await expect(row.getByText('Marina Souza', { exact: true })).toBeVisible();
  await expect(
    row.getByText('Shown on the changes you save from now on. Changes already saved keep the name they were made with.'),
  ).toBeVisible();
  await mockup(page, 'Theme-picker', 1);
  await mockup(page, 'Theme-picker', 3);
  await mockup(page, 'Theme-picker', 4);
  await checkA11y(); // the Account screen with the row

  // Change: prefilled; a blank name is refused in words.
  await page.getByRole('button', { name: 'Change your name' }).click();
  const dialog = page.getByRole('dialog', { name: 'Your name' });
  const field = dialog.getByRole('textbox', { name: 'Your name' });
  await expect(field).toHaveValue('Marina Souza');
  await field.fill('');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('Your name can’t be empty.')).toBeVisible();
  await expect(dialog).toBeVisible();
  await checkA11y(); // the open dialog with the refusal
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();

  await changeAuthorName(page, 'Marina Lima');
  await closeAccount(page);

  // The next save asks no name.
  await openSongInEditor(page, QUERY, SONG_TITLE);
  await typeAtEndOfLine(page, BARS, ' | C');
  const sheet = await openSaveSheet(page);
  await expect(sheet.getByRole('textbox', { name: /Your name/ })).toHaveCount(0);
  await confirmSheet(page, { note: 'End on C' });

  // The save is on Estante before anyone else reads the book.
  await syncNow(page);
  await expect
    .poll(async () => (await pushedAuthorEmails(page, BOOK)).length, { timeout: 20000 })
    .toBe(pushedBefore + 2);

  // On this device both saves are one's own: *you*.
  await openSongHistory(page, QUERY, SONG_TITLE);
  const rows = page.locator('.est-history-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('End on C');
  await expect(rows.nth(0).locator('.meta')).toHaveText(/^you · /);
  await expect(rows.nth(1).locator('.meta')).toHaveText(/^you · /);

  // A second person joins by invitation and reads the names each save was
  // made with: the newer one carries the new name, the earlier keeps the old.
  const link = await inviteLink(page, BOOK);
  const joiner = await joinByInvite(browser, link, BOOK);
  contexts.push(joiner.context);
  await waitUntilSearchable(joiner.page, QUERY, SONG_TITLE);
  await openSongHistory(joiner.page, QUERY, SONG_TITLE);
  const theirRows = joiner.page.locator('.est-history-row');
  await expect(theirRows).toHaveCount(2);
  await expect(theirRows.nth(0)).toContainText('End on C');
  await expect(theirRows.nth(0).locator('.meta')).toHaveText(/^Marina Lima · /);
  await expect(theirRows.nth(1).locator('.meta')).toHaveText(/^Marina Souza · /);
  expect(await analyzeBothThemes(joiner.page)).toEqual([]); // axe: the joiner's history
});
