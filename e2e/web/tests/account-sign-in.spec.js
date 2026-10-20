// account-sign-in (e2e-web) — the authentication surface against the compose
// stack (account.sign_in; workflow 13 §Signing in on another device, workflow 7
// §Signing in). Three journeys on the phone, tablet and computer projects, with
// axe at WCAG 2.1 AA on each screen the surface draws:
//
//   (a) make an account with a passkey, driven by a CDP virtual authenticator —
//       register/finish creates the account, the surface signs the device in,
//       and the estante_session cookie is present on the context (so the
//       Worker's git fetches carry it with no further plumbing).
//   (b) the emailed link read from the mail catcher — request a link for an
//       address that already has an account (seeded through Postgres, the one
//       precondition no landed endpoint provides — see lib/db.js), read the
//       /sign-in/<token> URL from Mailpit, open it in the same context, and be
//       signed in after redeem.
//   (c) a passkey offered on a new device — after the emailed-link sign-in the
//       offer appears, and registering a passkey with the virtual authenticator
//       succeeds (workflow 13 lines 23-24).
//
// A fresh Playwright context is a fresh device: IndexedDB, the shelf and the
// cookie jar all start empty. The surface opens from the empty shelf's *Sign in
// or make an account* row, at its two sections (account.sign_in_two_doors). Reuses lib/devices-style
// context isolation, lib/axe's checkA11y and the new lib/mail reader — never a
// parallel harness.

import { test, expect } from '../lib/axe.js';
import { startApp, enableVirtualAuthenticator, hasSessionCookie } from '../lib/journeys.js';
import { waitForMessageTo, extractSignInLink } from '../lib/mail.js';
import { seedAccount } from '../lib/db.js';
import { uniqueEmail } from '../lib/journeys-account.js';

// Open the sign-in surface from the empty shelf's row.
async function openSignIn(page) {
  await startApp(page);
  await page.getByRole('button', { name: /^Sign in or make an account/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in or make an account' })).toBeVisible();
}

test('makes an account with a passkey (virtual authenticator) and lands signed in', async ({
  page,
  checkA11y,
}) => {
  await enableVirtualAuthenticator(page);
  await openSignIn(page);

  // The workflow-13 screen: the two sections — the two ways back in with the
  // no-passkey note, then making an account with its line — axe clean.
  const have = page.getByRole('group', { name: 'Already have an account?' });
  await expect(have.getByRole('button', { name: 'Use a passkey' })).toBeVisible();
  await expect(have.getByRole('button', { name: 'Email me a link' })).toBeVisible();
  await expect(have.getByText(/No passkey here\?/)).toBeVisible();
  const fresh = page.getByRole('group', { name: 'New here?' });
  await expect(fresh.getByText(/This would be a second, separate account\./)).toBeVisible();
  await checkA11y(); // the sign-in screen, this viewport

  await fresh.getByRole('button', { name: 'Make an account' }).click();

  // A fresh platform passkey leaves one resident here, so there is no offer;
  // making an account is followed by Add a recovery email, with the session
  // already set. Not now goes on to the empty shelf.
  await expect(page.getByRole('heading', { name: 'Add a recovery email' })).toBeVisible();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByRole('heading', { name: 'Your shelf is empty' })).toBeVisible();
});

test('signs in from an emailed link and then offers a passkey on this device', async ({
  page,
  checkA11y,
}) => {
  // seedAccount stays here: an emailed link needs an address on the account,
  // and this journey is about signing in by it, not setting it — that UI path
  // is recovery-email.spec.js's (account.recovery_email Decision 10). So the one
  // precondition is seeded in Postgres. Everything after it is the real UI and
  // the real mail.
  const email = uniqueEmail('signin');
  await seedAccount(email);
  await enableVirtualAuthenticator(page);

  await openSignIn(page);

  // Ask for a link; the surface always moves to "Check your email", telling the
  // user nothing about whether the address has an account.
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await page.getByRole('textbox', { name: 'Your email' }).fill(email);
  await page.getByRole('button', { name: 'Send the link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0); // never echoed
  await checkA11y(); // the check-your-email step, this viewport

  // Read the link from the catcher, as a mail client would, and open it in the
  // same context. The app boots at /sign-in/<token>, redeems, and signs in.
  const message = await waitForMessageTo(email);
  expect(message, 'the sign-in mail should arrive at the catcher').not.toBeNull();
  const link = extractSignInLink(message);
  expect(link, 'the mail should carry a /sign-in/<token> link').not.toBeNull();

  await page.goto(link);

  // Signed in by the link, the surface offers to add a passkey here (Decision 5),
  // and the session cookie is set.
  await expect(page.getByRole('heading', { name: 'Make signing in quicker' })).toBeVisible();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
  await checkA11y(); // the offer step, this viewport

  // (c) Registering a passkey here with the virtual authenticator succeeds and
  // the surface closes back to the shelf.
  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Your shelf is empty' })).toBeVisible();
  expect(await hasSessionCookie(page)).toBe(true);
});
