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

import { test, expect } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';
import { waitForMessageTo, extractSignInLink } from '../lib/mail.js';
import { seedAccount } from '../lib/db.js';

function uniqueEmail() {
  return `leaving-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}@estante.test`;
}

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
}

async function hasSessionCookie(page) {
  const cookies = await page.context().cookies();
  return cookies.some((c) => c.name === 'estante_session' && c.value);
}

async function openAccount(page) {
  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
}

test('deletes the account end to end: data-out downloads, then the device returns to first-run; axe-clean', async ({
  page,
  checkA11y,
}) => {
  const email = uniqueEmail();
  await seedAccount(email);
  await enableVirtualAuthenticator(page);

  // Sign in via the emailed link, so the account carries the email the confirm
  // type-matches; add a passkey on the offer to land on the empty shelf.
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await page.getByRole('textbox', { name: 'Your email' }).fill(email);
  await page.getByRole('button', { name: 'Send the link' }).click();
  const message = await waitForMessageTo(email);
  expect(message, 'the sign-in mail should arrive at the catcher').not.toBeNull();
  await page.goto(extractSignInLink(message));
  await expect(page.getByRole('heading', { name: 'Make signing in quicker' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Your shelf is empty' })).toBeVisible();

  // The Leaving Estante region at the foot of the account screen.
  await openAccount(page);
  await expect(page.getByText('Leaving Estante')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take your data out' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete my account' })).toBeVisible();
  await checkA11y(); // the account screen with the Leaving region

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
  await enableVirtualAuthenticator(page);
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);

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
  const downloadPromise = page.waitForEvent('download');
  await dataOut.getByRole('button', { name: 'Download Your home book' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
});
