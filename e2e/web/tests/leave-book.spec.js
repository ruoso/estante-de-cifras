// leave-book (e2e-web) — a member leaves one shared book against the compose
// stack, on the phone/tablet/computer projects, with axe at WCAG 2.1 AA on every
// screen it touches (books.leave; workflow 10 §Leaving a book L87-143; the
// Leave-book board).
//
// Pure real UI. The owner puts a book online with one song and invites a reader
// in the Share dialog; the joiner opens the link on a second device, makes an
// account and joins. Then, through book management or a *Mine on Estante* row,
// the joiner leaves: the membership ends on the service first, then the book
// leaves the shelf, *Mine on Estante* no longer offers it, and the owner's Share
// no longer lists them. Offline, the verb says it needs a connection and nothing
// changes. Book and song names are written for this test (no-song-text rule).

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';
import { enableVirtualAuthenticator, gotoTab } from '../lib/journeys.js';
import {
  hostedBookWithSong,
  inviteThroughShare,
  openSharing,
  acceptInvitation,
} from '../lib/journeys-share.js';
import { openBookRow } from '../lib/journeys-sync.js';
import { openDevice } from '../lib/devices.js';

const BOOK = 'Roda de Saída';
const SONG_TITLE = 'Valsa da Porta';
const bookRow = new RegExp(`^${BOOK}`);

// Owner: a hosted book with a song and a reader invitation. The joiner: a second
// device that opens the link, makes an account and lands with the book on its
// shelf. Returns the joiner's device; the caller closes its context.
async function ownerAndReader(browser, page) {
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const link = await inviteThroughShare(page, BOOK, { role: 'Reader' });
  const joiner = await openDevice(browser);
  await enableVirtualAuthenticator(joiner.page);
  await acceptInvitation(joiner.page, link);
  await expect(joiner.page.getByRole('button', { name: bookRow })).toBeVisible({ timeout: 10000 });
  return joiner;
}

// Open the Add-a-book sheet and wait until *Mine on Estante* has answered (a row,
// or the "already on this shelf" line). Returns the sheet.
async function openMineOnEstante(page) {
  await gotoTab(page, 'Books');
  await page.getByRole('button', { name: 'Add a book' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add a book' });
  await expect(sheet).toBeVisible();
  await expect(
    sheet.locator('.mine-row').or(sheet.getByText('All your books are already on this shelf.')).first(),
  ).toBeVisible({ timeout: 10000 });
  return sheet;
}

test('a reader leaves from book management: gone from the shelf, from Mine on Estante and from the owner’s Share (L95-125)', async ({
  browser,
  page,
}) => {
  test.setTimeout(30000);
  const joiner = await ownerAndReader(browser, page);
  try {
    // The owner's own book management offers Delete, never Leave (L97-98).
    await openBookRow(page, BOOK);
    await expect(page.getByRole('button', { name: 'Delete the book' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave this book' })).toHaveCount(0);

    // The joiner's book management carries Leave this book.
    await openBookRow(joiner.page, BOOK);
    const leave = joiner.page.getByRole('button', { name: 'Leave this book' });
    await expect(leave).toBeVisible();
    expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: book management with the Leave card

    // The confirmation: nothing to lose, so the sentence and two buttons.
    await leave.click();
    const confirm = joiner.page.getByRole('alertdialog');
    await expect(confirm.getByRole('heading', { name: `Leave ${BOOK}?` })).toBeVisible();
    await expect(confirm.getByText(/and it is removed from this one/)).toBeVisible();
    expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the open confirmation
    await confirm.getByRole('button', { name: 'Leave the book' }).click();

    // The book's row is gone from the shelf.
    await expect(confirm).toBeHidden({ timeout: 10000 });
    await gotoTab(joiner.page, 'Books');
    await expect(joiner.page.getByRole('button', { name: bookRow })).toHaveCount(0);

    // Mine on Estante does not offer it back (unlike Remove from my shelf).
    const sheet = await openMineOnEstante(joiner.page);
    await expect(sheet.getByText(BOOK)).toHaveCount(0);

    // The owner's Share no longer lists the joiner.
    const sharing = await openSharing(page, BOOK);
    await expect(sharing.getByText('0 of 50')).toBeVisible();
  } finally {
    await joiner.context.close();
  }
});

test('a book removed from the shelf is left from its Mine on Estante row (L99-101, L116-117)', async ({
  browser,
  page,
}) => {
  test.setTimeout(30000);
  const joiner = await ownerAndReader(browser, page);
  try {
    // Remove from my shelf keeps the membership: Mine on Estante offers it back.
    await openBookRow(joiner.page, BOOK);
    await joiner.page.getByRole('button', { name: 'Remove from my shelf' }).click();
    const remove = joiner.page.getByRole('dialog');
    await remove.getByRole('button', { name: 'Remove from my shelf' }).click();
    await gotoTab(joiner.page, 'Books');
    await expect(joiner.page.getByRole('button', { name: bookRow })).toHaveCount(0);

    let sheet = await openMineOnEstante(joiner.page);
    const rowLeave = sheet.getByRole('button', { name: `Leave ${BOOK}` });
    await expect(rowLeave).toBeVisible();
    expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the sheet with Leave on the row

    // The row's confirmation is the sentence alone: nothing here to lose.
    await rowLeave.click();
    const confirm = joiner.page.getByRole('alertdialog');
    await expect(
      confirm.getByText('You will no longer open or sync it, on any of your devices. The owner can invite you again.'),
    ).toBeVisible();
    expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the row's confirmation
    await confirm.getByRole('button', { name: 'Leave the book' }).click();

    // The row is gone…
    await expect(confirm).toBeHidden({ timeout: 10000 });
    await expect(sheet.getByText(BOOK)).toHaveCount(0);

    // …and stays gone once the sheet asks the service again.
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toBeHidden();
    sheet = await openMineOnEstante(joiner.page);
    await expect(sheet.getByText(BOOK)).toHaveCount(0);
  } finally {
    await joiner.context.close();
  }
});

test('offline, Leave says it needs a connection and nothing changes; back online it goes through (L127-128)', async ({
  browser,
  page,
}) => {
  test.setTimeout(30000);
  const joiner = await ownerAndReader(browser, page);
  try {
    await openBookRow(joiner.page, BOOK);
    const leave = joiner.page.getByRole('button', { name: 'Leave this book' });
    await expect(leave).toBeEnabled();

    await joiner.context.setOffline(true);
    try {
      await expect(joiner.page.getByText('Leaving needs a connection.')).toBeVisible();
      await expect(joiner.page.getByText('Nothing has changed; you are still a member.')).toBeVisible();
      await expect(leave).toBeDisabled();
      expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the offline Leave card

      // The book is still on the shelf.
      await gotoTab(joiner.page, 'Books');
      await expect(joiner.page.getByRole('button', { name: bookRow })).toBeVisible();
    } finally {
      await joiner.context.setOffline(false);
    }

    // Back online, the leave goes through.
    await openBookRow(joiner.page, BOOK);
    await expect(leave).toBeEnabled();
    await expect(joiner.page.getByText('Leaving needs a connection.')).toHaveCount(0);
    await leave.click();
    const confirm = joiner.page.getByRole('alertdialog');
    await confirm.getByRole('button', { name: 'Leave the book' }).click();
    await expect(confirm).toBeHidden({ timeout: 10000 });
    await gotoTab(joiner.page, 'Books');
    await expect(joiner.page.getByRole('button', { name: bookRow })).toHaveCount(0);
  } finally {
    await joiner.context.close();
  }
});
