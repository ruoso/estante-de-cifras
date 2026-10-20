// sign-in-two-doors (e2e-web) — the one sign-in surface and its two doors,
// against the compose stack, on the phone, tablet and computer projects, with a
// virtual authenticator and axe at WCAG 2.1 AA (both themes) on every screen
// named (account.sign_in_two_doors; workflow 13 §Signing in, or making an
// account, §Asked when the account is made, §The banner; workflow 1 §Cold;
// boards W13 #1/#2, W01 #1/#4 and Sign-in).
//
//   1. An account made from the cold first run sets its recovery email right
//      after, and the banner goes once the address is confirmed.
//   2. An account that chose Not now carries the banner on every screen until
//      it confirms one; a pending address keeps it.
//   3. From the Account screen after writing a local song: the card is one
//      entry, and making the account keeps the song.
//   4. Signing in from the cold first run with an existing passkey makes no
//      second account and asks for nothing.
//
// Real UI only. The one read below the UI is `GET /api/account/home-book`
// (homeBookId). Addresses are invented under @estante.test; the song is
// written for this test.

import { test, expect, analyzeBothThemes } from '../lib/axe.js';
import {
  startApp,
  gotoTab,
  enableVirtualAuthenticator,
  sharePasskeys,
  hasSessionCookie,
  openSignInSurface,
  makeAccount,
  openExampleBook,
  openSongFromSearch,
} from '../lib/journeys.js';
import { openDevice } from '../lib/devices.js';
import {
  uniqueEmail,
  openAccount,
  closeAccount,
  recoveryRegion,
  setRecoveryEmail,
  readVerificationLink,
  confirmOnFreshDevice,
  writeSongFromScratch,
  homeBookId,
} from '../lib/journeys-account.js';

const ROW = /^Sign in or make an account/;
const BANNER = 'No recovery email yet.';
const DESTINATIONS = ['Search', 'Books', 'Setlists'];

const banner = (page) => page.getByRole('region', { name: BANNER, exact: true });

// The banner as the boards draw it: in words, with one button, Add one.
async function expectBanner(page) {
  const shown = banner(page);
  await expect(shown).toBeVisible();
  await expect(shown).toContainText('If you lose your passkeys, you lose this account and your books on Estante.');
  await expect(shown.getByRole('button')).toHaveCount(1);
  await expect(shown.getByRole('button', { name: 'Add one' })).toBeVisible();
}

// The banner on each of the three destinations (or its absence).
async function bannerOnEveryDestination(page, shown) {
  for (const name of DESTINATIONS) {
    await gotoTab(page, name);
    if (shown) await expectBanner(page);
    else await expect(banner(page)).toHaveCount(0);
  }
}

// Both doors of the surface, in their order.
async function expectBothSections(page) {
  const have = page.getByRole('group', { name: 'Already have an account?' });
  const fresh = page.getByRole('group', { name: 'New here?' });
  await expect(have.getByRole('button', { name: 'Use a passkey' })).toBeVisible();
  await expect(have.getByRole('button', { name: 'Email me a link' })).toBeVisible();
  await expect(fresh.getByRole('button', { name: 'Make an account' })).toBeVisible();
  await expect(fresh.getByText('This would be a second, separate account.', { exact: false })).toBeVisible();
}

test('an account made from the cold first run sets its recovery email right after (workflow 13 §Asked when the account is made; workflow 1 §Cold)', async ({
  page,
  browser,
  checkA11y,
}) => {
  test.setTimeout(60000);
  await enableVirtualAuthenticator(page);
  await startApp(page);

  // The cold row is the one door for both.
  const row = page.getByRole('button', { name: ROW });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Bring back your shelf, or start one on Estante.');

  await openSignInSurface(page);
  await expectBothSections(page);
  await checkA11y(); // the surface, both sections

  await page.getByRole('group', { name: 'New here?' }).getByRole('button', { name: 'Make an account' }).click();
  await expect(page.getByRole('heading', { name: 'Add a recovery email' })).toBeVisible();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
  await checkA11y(); // the Add a recovery email step

  const email = uniqueEmail('twodoors');
  await page.getByRole('textbox', { name: 'Recovery email' }).fill(email);
  await page.getByRole('button', { name: 'Send link' }).click();
  await expect(page.getByText(/We sent a verification link to/)).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // The shelf: three ways in, no sign-in row, and the banner (the address is
  // only pending).
  await expect(page.getByRole('heading', { name: 'Your shelf is empty' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Write a song/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Add a book by its link/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Open the example book/ })).toBeVisible();
  await expect(page.getByRole('button', { name: ROW })).toHaveCount(0);
  await expectBanner(page);
  await checkA11y(); // the shelf under the banner

  // The link, read as a mail client would, confirmed on another device.
  const link = await readVerificationLink(email);
  await confirmOnFreshDevice(browser, link);

  // Back here: the region reads Confirmed, the banner is gone, and stays gone.
  await openAccount(page);
  await expect(recoveryRegion(page).getByText('Confirmed', { exact: true })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  await closeAccount(page);
  await bannerOnEveryDestination(page, false);
});

test('an account that chose Not now sees the banner on every destination until it confirms one (workflow 13 §The banner)', async ({
  page,
  browser,
  checkA11y,
}) => {
  test.setTimeout(90000);
  await enableVirtualAuthenticator(page);
  await startApp(page);
  await openSignInSurface(page);
  await makeAccount(page); // Not now

  await bannerOnEveryDestination(page, true);
  await checkA11y(); // the banner over a destination

  // A song read (a screen without the header chrome) carries it too.
  await openExampleBook(page);
  await openSongFromSearch(page, 'Morning', 'Morning on the Porch');
  await expectBanner(page);
  await checkA11y(); // the banner over a song being read

  // And the account screen draws its own.
  await startApp(page);
  await openAccount(page);
  await expectBanner(page);
  await closeAccount(page);

  // From Books, Add one opens the account screen at the Recovery email field.
  await gotoTab(page, 'Books');
  await banner(page).getByRole('button', { name: 'Add one' }).click();
  await expect(recoveryRegion(page).getByRole('textbox', { name: 'Recovery email' })).toBeFocused();

  // A pending address keeps it, everywhere.
  const email = uniqueEmail('notnow');
  await setRecoveryEmail(page, email);
  await expect(recoveryRegion(page).getByText('Waiting for you to confirm')).toBeVisible();
  await expectBanner(page);
  await closeAccount(page);
  await bannerOnEveryDestination(page, true);

  // Confirmed elsewhere: the account screen asks again, and on Back it is gone
  // from every destination.
  const link = await readVerificationLink(email);
  await confirmOnFreshDevice(browser, link);
  await openAccount(page);
  await expect(recoveryRegion(page).getByText('Confirmed', { exact: true })).toBeVisible();
  await closeAccount(page);
  await bannerOnEveryDestination(page, false);
});

test('from the Account screen after writing a local song, the card is one entry, and the made account keeps the song (workflow 13 L30-33)', async ({
  page,
  checkA11y,
}) => {
  test.setTimeout(60000);
  await enableVirtualAuthenticator(page);
  await writeSongFromScratch(page, ['# Lantern Walk', '', '## Verse', '```', 'D  G | A  D', '```', '']);
  await startApp(page);
  // The shelf is no longer empty, so the cold row is not there.
  await expect(page.getByRole('heading', { name: 'Your shelf is empty' })).toHaveCount(0);

  await openAccount(page);
  await expect(page.getByText('Not signed in')).toBeVisible();
  await expect(page.getByText('Bring your books to this device, or start keeping them on Estante.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in or make an account', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use a passkey' })).toHaveCount(0);
  await checkA11y(); // the account screen's card

  await page.getByRole('button', { name: 'Sign in or make an account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in or make an account' })).toBeVisible();
  await expectBothSections(page);
  await makeAccount(page); // Not now

  expect(await hasSessionCookie(page)).toBe(true);
  await expectBanner(page);
  // My songs still holds the song.
  await closeAccount(page);
  await page.getByRole('searchbox').fill('Lantern');
  await expect(page.getByRole('button', { name: /Lantern Walk/ }).first()).toBeVisible();
});

test('signing in from the cold first run with an existing passkey makes no second account (workflow 13 L19-28)', async ({
  page,
  browser,
  checkA11y,
}) => {
  test.setTimeout(60000);
  // Device A makes the account.
  const authA = await enableVirtualAuthenticator(page);
  await startApp(page);
  await openSignInSurface(page);
  await makeAccount(page); // Not now
  const homeA = await homeBookId(page);

  // Device B holds a synced copy of the passkey.
  const deviceB = await openDevice(browser);
  try {
    const authB = await enableVirtualAuthenticator(deviceB.page);
    expect(await sharePasskeys(authA, authB)).toBeGreaterThan(0);
    await startApp(deviceB.page);
    await openSignInSurface(deviceB.page);
    await deviceB.page
      .getByRole('group', { name: 'Already have an account?' })
      .getByRole('button', { name: 'Use a passkey' })
      .click();
    await expect.poll(() => hasSessionCookie(deviceB.page)).toBe(true);

    // Signing in asks nothing: B lands on its shelf.
    await expect(deviceB.page.getByRole('heading', { name: 'Sign in or make an account' })).toHaveCount(0);
    await expect(deviceB.page.getByRole('tab', { name: 'Books' })).toBeVisible();
    await expect(deviceB.page.getByRole('heading', { name: 'Add a recovery email' })).toHaveCount(0);

    // The same account: one home book, two signed-in devices.
    expect(await homeBookId(deviceB.page)).toBe(homeA);
    await openAccount(page);
    await expect(page.getByText('This device', { exact: true })).toBeVisible();
    await expect(page.locator('.account-row', { hasText: /last used/ })).toHaveCount(1);
    await closeAccount(page);

    // B carries the banner: the account still has no confirmed address.
    await expectBanner(deviceB.page);
    expect(await analyzeBothThemes(deviceB.page)).toEqual([]); // axe: B's shelf under the banner
  } finally {
    await deviceB.context.close();
  }
  await checkA11y(); // A's shelf under the banner
});

