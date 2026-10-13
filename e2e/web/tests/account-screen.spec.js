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
//   (2) Another device signed out from here — context A and context B sign in to
//       the same account via emailed links; A's account screen lists both
//       devices; "Sign out" on the B row revokes it; B's next request 401s, so
//       B's account screen reads "Not signed in" (workflow 13 L77-79).
//   (3) Passkeys listed, added and removed — make an account with a passkey via
//       the virtual authenticator; the account screen lists it; "Add a passkey"
//       registers a second; "Remove" takes one away (workflow 13 L80).
//
// Reuses lib/axe (checkA11y), lib/devices (openDevice), lib/mail (the Mailpit
// reader), lib/db (seedAccount) and the virtual-authenticator / hasSessionCookie
// helpers established by account-sign-in.spec.js — never a parallel harness.

import { test, expect } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';
import { waitForMessageTo, extractSignInLink } from '../lib/mail.js';
import { seedAccount } from '../lib/db.js';
import { openDevice } from '../lib/devices.js';

function uniqueEmail() {
  return `account-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}@estante.test`;
}

// Mirror of account-sign-in.spec.js (the two small WebAuthn/cookie helpers the
// refinement names; the harness libs are the shared seam, these stay local).
async function enableVirtualAuthenticator(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  await addVirtualAuthenticator(client);
  return client;
}

// Attach one resident-key, auto-present virtual authenticator to an
// already-enabled CDP WebAuthn session. A second one stands in for "another
// authenticator on this device": the service excludes the account's existing
// credentials from register/begin (so the same authenticator is never enrolled
// twice — service passkeys.go), so adding a passkey from the first authenticator
// would raise InvalidStateError; a fresh authenticator is the one create() can
// enrol. The second must use a non-internal transport: Chrome permits only one
// internal authenticator per environment, so the extra one is a 'usb' roamer.
async function addVirtualAuthenticator(client, transport = 'internal') {
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return authenticatorId;
}

async function hasSessionCookie(page) {
  const cookies = await page.context().cookies();
  return cookies.some((c) => c.name === 'estante_session' && c.value);
}

// Open the account screen from the header affordance.
async function openAccount(page) {
  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
}

// Sign a context in via an emailed link (no passkey): request a link from the
// empty shelf's Sign in row, read it from Mailpit, redeem, and decline the
// passkey offer — leaving a plain cookie session on this context.
async function signInByEmail(page, email) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await page.getByRole('textbox', { name: 'Your email' }).fill(email);
  await page.getByRole('button', { name: 'Send the link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  const message = await waitForMessageTo(email);
  expect(message, 'the sign-in mail should arrive at the catcher').not.toBeNull();
  const link = extractSignInLink(message);
  expect(link, 'the mail should carry a /sign-in/<token> link').not.toBeNull();

  await page.goto(link);
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
}

test('keeps a theme and language choice across a reload, with no sign-in', async ({
  page,
  checkA11y,
}) => {
  await page.goto('/');
  await waitForServiceWorker(page);

  await openAccount(page);

  // Choose Palco and Português (Brasil); the app applies them live.
  await page.getByRole('radio', { name: /Palco/ }).click();
  await expect(page.locator('div.est').first()).toHaveClass(/theme-palco/);
  await page.getByRole('radio', { name: /Português \(Brasil\)/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');

  await checkA11y(); // the account screen, this viewport

  // Reload: the committed registers re-surface, so the choice survives (offline,
  // unpushed — it is in the local home book).
  await page.reload();
  await waitForServiceWorker(page);
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
  const email = uniqueEmail();
  await seedAccount(email);

  // Context A signs in; context B signs in to the same account.
  await signInByEmail(page, email);
  const deviceB = await openDevice(browser);
  try {
    await signInByEmail(deviceB.page, email);

    // A's account screen lists both devices: the current one in use now, the
    // other with its last use.
    await page.goto('/');
    await waitForServiceWorker(page);
    await openAccount(page);
    // Exact match: the copy legitimately says "this device" in several places
    // (the Automatic theme meta, the signed-in status, the add-passkey button),
    // so pin the current device's row name, not a substring (the behavior test's
    // exact getByText pins the same marker).
    await expect(page.getByText('This device', { exact: true })).toBeVisible();
    const otherRow = page.locator('.account-row', { hasText: /last used/ });
    await expect(otherRow).toHaveCount(1);
    await checkA11y(); // the signed-in account screen, this viewport

    // Sign the other device out: confirm, which revokes its session.
    await otherRow.getByRole('button', { name: /Sign .* out/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    await expect(otherRow).toHaveCount(0);

    // B's next request 401s (lazy revocation), so B's account screen reads
    // "Not signed in".
    await deviceB.page.goto('/');
    await waitForServiceWorker(deviceB.page);
    await deviceB.page.getByRole('button', { name: 'Account' }).click();
    await expect(deviceB.page.getByText('Not signed in')).toBeVisible();
  } finally {
    await deviceB.context.close();
  }
});

test('lists, adds and removes passkeys', async ({ page, checkA11y }) => {
  const cdp = await enableVirtualAuthenticator(page);

  // Make an account with a passkey from the empty shelf (one resident passkey).
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Your shelf is empty' })).toBeVisible();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);

  // The account screen lists the one passkey.
  await openAccount(page);
  const passkeyRemovers = page.getByRole('button', { name: /^Remove/ });
  await expect(passkeyRemovers).toHaveCount(1);
  await checkA11y(); // the signed-in account screen, this viewport

  // Add a passkey: a second authenticator (register/begin excludes the account's
  // existing credential, so the first authenticator can't enrol again) takes the
  // new credential, and the list reflects it.
  await addVirtualAuthenticator(cdp, 'usb');
  await page.getByRole('button', { name: 'Add a passkey to this device' }).click();
  await expect(passkeyRemovers).toHaveCount(2);

  // Remove one: confirm, and the list reflects it.
  await passkeyRemovers.first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await expect(passkeyRemovers).toHaveCount(1);
});
