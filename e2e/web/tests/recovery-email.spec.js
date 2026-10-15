// recovery-email (e2e-web) — the account screen's Recovery email region and the
// emailed verification link against the compose stack, on the phone/tablet/
// computer projects, with axe at WCAG 2.1 AA on every screen touched
// (account.recovery_email; workflow 13 §The recovery email, §The last way in;
// board Recovery-email.dc.html).
//
// Four journeys:
//   1. An email set and verified via the mail catcher: a passkey-only account
//      (its only passkey its last way in) sets an address, the link opens in a
//      FRESH context — no service worker, so the cold load exercises the
//      service's SPA fallback for the dotted token — confirms without signing
//      in, a second open reads expired/used, the first device then shows the
//      address Confirmed with Remove back, and the address signs in by email.
//   2. Changing it: A confirmed, B pending; B confirmed; A gets the notice.
//   3. An address another account holds: requested without a word, refused
//      only at the link.
//   4. Offline: the region's buttons wait, with the When offline note.
// Addresses are under @estante.test, written for this test.

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';
import { signedInDevice, startApp, hasSessionCookie } from '../lib/journeys.js';
import { openDevice } from '../lib/devices.js';
import { waitForMessage, extractRecoveryEmailLink } from '../lib/mail.js';
import {
  uniqueEmail,
  openAccount,
  openEmailedLink,
  recoveryRegion,
  setRecoveryEmail,
} from '../lib/journeys-account.js';

const CONFIRMED = 'Your recovery email is confirmed';
const EXPIRED = 'This link has expired or was already used — send a new one from the account screen.';
const TAKEN = 'This address is the recovery email of another Estante account — sign in with it instead.';

// The newest verification link mailed to `email` — other than `previous`, when
// an earlier one went to the same address.
async function readVerificationLink(email, previous = null) {
  const message = await waitForMessage(email, (m) => {
    const link = extractRecoveryEmailLink(m);
    return link !== null && link !== previous;
  });
  expect(message, 'the verification mail should arrive at the catcher').not.toBeNull();
  return extractRecoveryEmailLink(message);
}

// Axe on a page other than the fixture's own (a fresh context's).
async function expectAxeClean(page) {
  expect(await analyzeWcag21aa(page)).toEqual([]);
}

// Open the link on a fresh device (no service worker, no session) and expect
// it confirmed there, still signed out. The context is closed after.
async function confirmOnFreshDevice(browser, link) {
  const device = await openDevice(browser);
  try {
    await device.page.goto(link);
    await expect(device.page.getByRole('heading', { name: CONFIRMED })).toBeVisible();
    expect(await hasSessionCookie(device.page)).toBe(false);
  } finally {
    await device.context.close();
  }
}

// Reopen the account screen so it re-reads the region.
async function reopenAccount(page) {
  await startApp(page);
  await openAccount(page);
}

// A signed-in account whose recovery email is `email`, confirmed.
async function accountWithConfirmed(page, browser, email) {
  await signedInDevice(page);
  await openAccount(page);
  await setRecoveryEmail(page, email);
  const link = await readVerificationLink(email);
  await confirmOnFreshDevice(browser, link);
  await reopenAccount(page);
  await expect(recoveryRegion(page).getByText('Confirmed', { exact: true })).toBeVisible();
  return link;
}

test('an email set and verified via the mail catcher, opened on a fresh device (workflow 13 §Setting it, §Confirming it, §The last way in)', async ({
  page,
  browser,
  checkA11y,
}) => {
  const email = uniqueEmail('recovery');

  // A passkey-only account: no recovery email, and its only passkey is its last
  // way in, with no Remove.
  await signedInDevice(page);
  await openAccount(page);
  const region = recoveryRegion(page);
  await expect(region.getByText('No recovery email')).toBeVisible();
  await expect(page.getByText('last way in', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Your only way to sign in — add a recovery email or another passkey first.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
  await checkA11y(); // none + last way in

  // Set it: waiting, naming the address.
  await setRecoveryEmail(page, email);
  await expect(region.getByText(email)).toBeVisible();
  await checkA11y(); // waiting

  // The link opens on a fresh device — a cold load, no service worker — and
  // confirms without signing in.
  const link = await readVerificationLink(email);
  const device = await openDevice(browser);
  try {
    await device.page.goto(link);
    await expect(device.page.getByRole('heading', { name: CONFIRMED })).toBeVisible();
    await expect(
      device.page.getByText(
        'This link only confirms the address — it does not sign you in on this device, and opens no book.',
      ),
    ).toBeVisible();
    expect(await hasSessionCookie(device.page)).toBe(false);
    await expectAxeClean(device.page); // the confirm page

    // The same link again: expired or used.
    await device.page.goto(link);
    await expect(device.page.getByRole('alert')).toHaveText(EXPIRED);
    expect(await hasSessionCookie(device.page)).toBe(false);
  } finally {
    await device.context.close();
  }

  // Back on the first device: the address is Confirmed, and the passkey has
  // Remove again.
  await reopenAccount(page);
  await expect(region.getByText('Confirmed', { exact: true })).toBeVisible();
  await expect(region.getByText(email)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Remove/ })).toHaveCount(1);
  await expect(page.getByText('last way in', { exact: true })).toHaveCount(0);
  await checkA11y(); // confirmed

  // The address is the account's way back in: an emailed sign-in on a third
  // device works (workflow 13 L25–30).
  const third = await openDevice(browser);
  try {
    await openEmailedLink(third.page, email);
  } finally {
    await third.context.close();
  }
});

test('changing it keeps the old address until the new one is confirmed, then tells the old one (workflow 13 §Changing it)', async ({
  page,
  browser,
  checkA11y,
}) => {
  const first = uniqueEmail('recovery-a');
  const second = uniqueEmail('recovery-b');
  await accountWithConfirmed(page, browser, first);

  // Change → B: A stays Confirmed, B waits.
  await setRecoveryEmail(page, second);
  const region = recoveryRegion(page);
  await expect(region.getByText('Confirmed', { exact: true })).toBeVisible();
  await expect(region.getByText(first, { exact: true }).first()).toBeVisible();
  await expect(region.getByText('Waiting for you to confirm')).toBeVisible();
  await expect(region.getByText(new RegExp(`We sent a verification link to ${second.replace(/[.]/g, '\\.')}`))).toBeVisible();
  await checkA11y(); // confirmed + waiting

  // Confirm B; A receives the changed notice.
  await confirmOnFreshDevice(browser, await readVerificationLink(second));
  const notice = await waitForMessage(first, (m) => /changed/i.test(m.Subject ?? ''));
  expect(notice, 'the old address should get the changed notice').not.toBeNull();

  // Account shows B Confirmed.
  await reopenAccount(page);
  await expect(region.getByText(second, { exact: true })).toBeVisible();
  await expect(region.getByText('Confirmed', { exact: true })).toBeVisible();
  await expect(region.getByText(first)).toHaveCount(0);
  await expect(region.getByText('Waiting for you to confirm')).toHaveCount(0);
});

test('an address another account holds is refused only at the link (workflow 13 §Who holds an address)', async ({
  page,
  browser,
  checkA11y,
}) => {
  const held = uniqueEmail('recovery-held');
  const firstLink = await accountWithConfirmed(page, browser, held);

  // A second person asks for the same address: the region still says waiting,
  // revealing nothing.
  const other = await openDevice(browser);
  try {
    await signedInDevice(other.page);
    await openAccount(other.page);
    await setRecoveryEmail(other.page, held);
    await expect(recoveryRegion(other.page).getByText(held)).toBeVisible();
  } finally {
    await other.context.close();
  }

  // Its link, opened, says the address is another account's.
  const link = await readVerificationLink(held, firstLink);
  await page.goto(link);
  await expect(page.getByRole('alert')).toHaveText(TAKEN);
  await checkA11y(); // the confirm page, address taken
});

test('offline: the region’s buttons wait, with the When offline note (workflow 13 L66–68)', async ({
  page,
  checkA11y,
}) => {
  await signedInDevice(page);
  await openAccount(page);
  const region = recoveryRegion(page);
  await expect(region.getByText('No recovery email')).toBeVisible();

  await page.context().setOffline(true);
  await expect(region.getByText('When offline')).toBeVisible();
  await expect(
    region.getByText(
      'The recovery email needs a connection, like signing in. Its buttons wait until you are back online; your songs do not.',
    ),
  ).toBeVisible();
  const buttons = region.getByRole('button');
  expect(await buttons.count()).toBeGreaterThan(0);
  for (const button of await buttons.all()) await expect(button).toBeDisabled();
  await checkA11y(); // offline
  await page.context().setOffline(false);
});
