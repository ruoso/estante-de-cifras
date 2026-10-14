// leaving (e2e-web) — taking your data out and deleting the account against the
// compose stack, on the phone/tablet/computer projects, with axe at WCAG 2.1 AA
// on the account screen and each dialog state (account.leaving, workflow 17
// §Taking your data out / §Deleting / §Offline; board W17-leaving).
//
// Two journeys:
//   - Delete (online): signing in through the emailed link gives the account a
//     known email — the thing the terminal confirm type-matches (a passkey-only
//     account has none, the same reason the server degrades gracefully). Open
//     Account, take the data out (a per-book download of the home book, asserted
//     as a Playwright download), then Delete my account: type the email, confirm,
//     and the device returns signed-out to its first-run state (the session cookie
//     cleared, the empty shelf's Sign in back).
//   - Offline (virtual authenticator): take-your-data-out still downloads with its
//     notice, while Delete my account is disabled with the needs-a-connection note.
// Account email and book names are written for this test (no-song-text rule).

import { mockup } from '../lib/mockup.js';
import { test, expect } from '../lib/axe.js';
import {
  startApp,
  signedInDevice,
  enableVirtualAuthenticator,
  hasSessionCookie,
  makeLocalBook,
  putBookOnline,
  networkBlip,
} from '../lib/journeys.js';
import { seedAccount } from '../lib/db.js';
import {
  uniqueEmail,
  openAccount,
  signInByEmailWithPasskey,
  inviteLink,
  joinByInvite,
} from '../lib/journeys-account.js';

test('deletes the account end to end: data-out downloads, then the device returns to first-run; axe-clean', async ({
  page,
  checkA11y,
}) => {
  // seedAccount stays here, and only here: the terminal confirm type-matches
  // the account's email, a passkey-only account has none, and no UI writes a
  // recovery email yet (tasks account.recovery_email / service.recovery_email).
  // So the account is seeded with an address and signed in through the emailed
  // link, then a passkey is added on the offer.
  const email = uniqueEmail('leaving');
  await seedAccount(email);
  await enableVirtualAuthenticator(page);
  await signInByEmailWithPasskey(page, email);

  // The Leaving Estante region at the foot of the account screen.
  await openAccount(page);
  await expect(page.getByText('Leaving Estante')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take your data out' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete my account' })).toBeVisible();
  await checkA11y(); // the account screen with the Leaving region
  await mockup(page, 'W17-leaving', 1);

  // Take your data out: the home book downloads as a zip, read from the device.
  await page.getByRole('button', { name: 'Take your data out' }).click();
  const dataOut = page.getByRole('dialog');
  await expect(dataOut.getByText('Your home book')).toBeVisible();
  await checkA11y(); // the take-your-data-out surface
  const downloadPromise = page.waitForEvent('download');
  await dataOut.getByRole('button', { name: 'Download Your home book' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  await dataOut.getByRole('button', { name: 'Done' }).click();

  // Delete my account: the stated blast radius, the type-the-email guard, confirm.
  await page.getByRole('button', { name: 'Delete my account' }).click();
  const del = page.getByRole('dialog');
  await expect(del.getByText('When you delete your account:')).toBeVisible();
  await expect(del.getByText('This cannot be undone.')).toBeVisible();
  const confirmBtn = del.getByRole('button', { name: 'Delete my account' });
  await expect(confirmBtn).toBeDisabled();
  await checkA11y(); // the delete-account dialog
  await del.getByRole('textbox', { name: 'Type your email address to confirm:' }).fill(email);
  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();

  // The device returns signed-out to its first-run state.
  await expect.poll(() => hasSessionCookie(page)).toBe(false);
  await expect(page.getByRole('button', { name: /Sign in/ })).toBeVisible();
});

test('offline: take your data out still downloads, while Delete my account waits for a connection; axe-clean', async ({
  page,
  checkA11y,
}) => {
  await signedInDevice(page);

  await openAccount(page);
  await page.context().setOffline(true);

  // Delete my account is disabled with the needs-a-connection note.
  await page.getByRole('button', { name: 'Delete my account' }).click();
  const del = page.getByRole('dialog');
  await expect(del.getByText(/Needs a connection/)).toBeVisible();
  await expect(del.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
  await checkA11y(); // the offline delete dialog
  await del.getByRole('button', { name: 'Cancel' }).click();

  // Take your data out still works offline: its notice, and a real download.
  await page.getByRole('button', { name: 'Take your data out' }).click();
  const dataOut = page.getByRole('dialog');
  await expect(dataOut.getByText(/downloads work here/)).toBeVisible();
  await checkA11y(); // the offline take-your-data-out surface
  await mockup(page, 'W17-leaving', 2);
  const downloadPromise = page.waitForEvent('download');
  await dataOut.getByRole('button', { name: 'Download Your home book' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
});

test('deleting an account that shares a book counts the people who lose access, and the member’s shelf then reads no longer shared (workflow 17)', async ({
  browser,
  page,
}) => {
  test.setTimeout(180000);
  const BOOK = 'Choros do Dono';

  // The owner: an account with an address (seeded — see the first test), a
  // hosted book, and a second PERSON joined through the real Share dialog.
  const email = uniqueEmail('owner');
  await seedAccount(email);
  await enableVirtualAuthenticator(page);
  await signInByEmailWithPasskey(page, email);
  await makeLocalBook(page, BOOK);
  await putBookOnline(page, BOOK);
  const link = await inviteLink(page, BOOK, 'Reader');

  const member = await joinByInvite(browser, link, BOOK);
  try {
    // The owner's delete dialog counts the one person who loses access.
    await startApp(page);
    await openAccount(page);
    await page.getByRole('button', { name: 'Delete my account' }).click();
    const del = page.getByRole('dialog');
    await expect(del.getByText('Books you own — deleted for everyone:')).toBeVisible();
    await expect(del.getByText(`${BOOK} · shared with 1 person — they will lose access`)).toBeVisible();
    await mockup(page, 'W17-leaving', 4);
    await del.getByRole('textbox', { name: 'Type your email address to confirm:' }).fill(email);
    await del.getByRole('button', { name: 'Delete my account' }).click();
    await expect.poll(() => hasSessionCookie(page)).toBe(false);

    // The member's next sync finds the book gone: their shelf says so.
    await expect(async () => {
      await networkBlip(member.page);
      await startApp(member.page);
      await member.page.getByRole('tab', { name: 'Books' }).click();
      await expect(member.page.getByText('no longer shared with you')).toBeVisible({ timeout: 2500 });
    }).toPass({ timeout: 90000 });
    await mockup(member.page, 'W17-leaving', 3);
  } finally {
    await member.context.close();
  }
});
