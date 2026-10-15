// account-screen (e2e-web) — the account surface against the compose stack
// (account.account_screen; workflow 13 §The account screen; mockup Theme-picker).
// Three journeys on the phone, tablet and computer projects, with axe at WCAG 2.1
// AA on the account screen each draws:
//
//   (1) Theme and language kept across a reload, no sign-in — open the account
//       screen from the header, choose Palco and Português (Brasil), reload; the
//       app is in Palco (est theme-palco on the root) and Portuguese (<html
//       lang="pt-BR"> and a translated string). Preferences live in the local
//       home book from the first minute, offline, unpushed (workflow 13 L70-76).
//   (2) Another device signed out from here — context A makes an account with a
//       passkey and context B gets a copy of that passkey (a synced passkey,
//       journeys.sharePasskeys) and signs in with it; A's account screen lists both
//       devices; "Sign out" on the B row revokes it; B's next request 401s, so
//       B's account screen reads "Not signed in" (workflow 13 L77-79).
//   (3) Passkeys listed, added and removed — make an account with a passkey via
//       the virtual authenticator; the account screen lists it; "Add a passkey"
//       registers a second; "Remove" takes one away (workflow 13 L80).
//
// Built from lib/journeys.js (real-UI steps) and lib/axe (checkA11y); no SQL
// seeding and no emailed link: two devices of one person share one passkey.

import { mockup } from '../lib/mockup.js';
import { test, expect } from '../lib/axe.js';
import {
  startApp,
  signedInDevice,
  enableVirtualAuthenticator,
  sharePasskeys,
} from '../lib/journeys.js';
import { openAccount, signInExistingWithPasskey } from '../lib/journeys-account.js';
import { openDevice } from '../lib/devices.js';

// A second authenticator on the same device: the service excludes the account's
// existing credentials from register/begin (so the same authenticator is never
// enrolled twice — service passkeys.go), so adding a passkey from the first
// authenticator would raise InvalidStateError; a fresh authenticator is the one
// create() can enrol. It must use a non-internal transport: Chrome permits only
// one internal authenticator per environment, so the extra one is a 'usb' roamer.
async function addRoamingAuthenticator(client) {
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'usb',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

test('keeps a theme and language choice across a reload, with no sign-in', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);

  await openAccount(page);
  await mockup(page, 'Theme-picker', 1, { note: 'account screen before signing in (Estante)' });

  // Choose Palco and Português (Brasil); the app applies them live.
  await page.getByRole('radio', { name: /Palco/ }).click();
  await expect(page.locator('div.est').first()).toHaveClass(/theme-palco/);
  await page.getByRole('radio', { name: /Português \(Brasil\)/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');

  await checkA11y(); // the account screen, this viewport

  // Reload: the committed registers re-surface, so the choice survives (offline,
  // unpushed — it is in the local home book).
  await startApp(page);
  await expect(page.locator('div.est').first()).toHaveClass(/theme-palco/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  // A translated string: the empty shelf heading, now in Portuguese.
  await expect(page.getByText('Sua estante está vazia')).toBeVisible();
});

test('signs another device out from here, and that device’s session stops', async ({
  browser,
  page,
  checkA11y,
}) => {
  // Device A makes the account with a passkey; device B (a second browser
  // context) holds a synced copy of that passkey and signs in to the SAME
  // account with "Use a passkey".
  const authA = await signedInDevice(page);
  const deviceB = await openDevice(browser);
  try {
    const authB = await enableVirtualAuthenticator(deviceB.page);
    expect(await sharePasskeys(authA, authB)).toBeGreaterThan(0);
    await signInExistingWithPasskey(deviceB.page);

    // A's account screen lists both devices: the current one in use now, the
    // other with its last use.
    await startApp(page);
    await openAccount(page);
    // Exact match: the copy legitimately says "this device" in several places
    // (the Automatic theme meta, the signed-in status, the add-passkey button),
    // so pin the current device's row name, not a substring (the behavior test's
    // exact getByText pins the same marker).
    await expect(page.getByText('This device', { exact: true })).toBeVisible();
    const otherRow = page.locator('.account-row', { hasText: /last used/ });
    await expect(otherRow).toHaveCount(1);
    await checkA11y(); // the signed-in account screen, this viewport
    await mockup(page, 'W13-new-device', 4, { note: 'account screen with two devices' });

    // Sign the other device out: confirm, which revokes its session.
    await otherRow.getByRole('button', { name: /Sign .* out/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    await expect(otherRow).toHaveCount(0);

    // B's next request 401s (lazy revocation), so B's account screen reads
    // "Not signed in".
    await startApp(deviceB.page);
    await deviceB.page.getByRole('button', { name: 'Account' }).click();
    await expect(deviceB.page.getByText('Not signed in')).toBeVisible();
  } finally {
    await deviceB.context.close();
  }
});

test('lists, adds and removes passkeys', async ({ page, checkA11y }) => {
  // Make an account with a passkey from the empty shelf (one resident passkey).
  const { client } = await signedInDevice(page);
  await expect(page.getByRole('heading', { name: 'Your shelf is empty' })).toBeVisible();

  // The account screen lists the one passkey. With no recovery email it is the
  // account's last way in, so it has no Remove (account.recovery_email;
  // workflow 13 §The last way in).
  await openAccount(page);
  const passkeyRemovers = page.getByRole('button', { name: /^Remove/ });
  const lastWayIn = page.getByText('last way in', { exact: true });
  await expect(lastWayIn).toBeVisible();
  await expect(passkeyRemovers).toHaveCount(0);
  await checkA11y(); // the signed-in account screen, this viewport
  await mockup(page, 'Theme-picker', 2, { note: 'signed in (theme not Palco here)' });
  await mockup(page, 'Theme-picker', 3);
  await mockup(page, 'Theme-picker', 4);

  // Add a passkey: a second authenticator takes the new credential, and the
  // list reflects it.
  await addRoamingAuthenticator(client);
  await page.getByRole('button', { name: 'Add a passkey to this device' }).click();
  await expect(passkeyRemovers).toHaveCount(2);

  // Two passkeys: neither is the last way in, both have Remove.
  await expect(lastWayIn).toHaveCount(0);

  // Remove one: confirm, and the list reflects it — the survivor is now the
  // last way in, with no Remove.
  await passkeyRemovers.first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await expect(lastWayIn).toBeVisible();
  await expect(passkeyRemovers).toHaveCount(0);
});
