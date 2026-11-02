// pair-device (e2e-web) — pairing a reMarkable from the web app against the
// compose stack (reader.pair_web; workflow 13 §Pairing a reMarkable; board
// Pair-a-device.dc.html), on the phone, tablet and computer projects, with axe
// at WCAG 2.1 AA on every screen the journeys touch. Through the real UI only;
// the reMarkable is lib/remarkable-device.js, a Node `fetch` stand-in making the
// calls only a reader makes (begin, poll, a read with its session) — never the
// web UI's (Decision 5).
//
//   (1) Paired by the address — an account made with a passkey; the reader
//       begins; /pair, the code typed lower-case without the dash; Pair your
//       reMarkable → paired; the reader's poll is approved with a session; Done →
//       the account screen lists your reMarkable, Reads only. The same code again
//       (from the account screen's foot) → already used (workflow 13 §The page,
//       §A code that does not pair, §Among the signed-in devices).
//   (2) Signed out first — /pair signed out shows the lead above the one sign-in
//       surface; an account made there goes on to the Code field; a code no
//       reader began is unknown; a begun one pairs; the account screen's foot
//       opens the page and its Back returns there; the reMarkable row's Sign out
//       asks first and signs the reader out, whose next read is 401 (workflow 13
//       §Not signed in, §Where it lives, L428–434).
//   (3) Offline — the button disabled and the offline line, the typed code kept;
//       back online, enabled (workflow 13 L401–402).
//
// Expired and too-many-tries are pinned at behavior level (Decision 7).

import { test, expect } from '../lib/axe.js';
import { startApp, signedInDevice, enableVirtualAuthenticator } from '../lib/journeys.js';
import { RemarkableDevice } from '../lib/remarkable-device.js';

const PAIRED = 'Your reMarkable is paired. Its shelf appears on it in a moment.';
const LEAD = 'Sign in to the account whose books the reMarkable should read.';
const USED = /That code was already used\./;
const UNKNOWN = /No reMarkable is showing that code\./;
const OFFLINE = /offline\. Pairing needs a connection\./;

const codeField = (page) => page.getByRole('textbox', { name: 'Code' });
const pairButton = (page) => page.getByRole('button', { name: 'Pair your reMarkable' });
const remarkableRows = (page) => page.locator('.account-row', { hasText: 'your reMarkable' });

// Type a code and press Pair your reMarkable.
async function enterCode(page, code) {
  await codeField(page).fill(code);
  await pairButton(page).click();
}

// The account screen is on show (its Theme picker is its first region).
async function expectAccountScreen(page) {
  await expect(page.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
}

test('a code begun by the reader is approved from /pair, and the reader is listed among the signed-in devices', async ({
  page,
  checkA11y,
}) => {
  await signedInDevice(page);
  const reader = new RemarkableDevice();
  const code = await reader.begin();

  await startApp(page, '/pair');
  await expect(page.getByRole('heading', { level: 1, name: 'Pair a device' })).toBeVisible();
  await expect(codeField(page)).toBeVisible();
  // The address holds no code and is cleaned at boot (Decision 2).
  await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  await checkA11y(); // the page, signed in

  // As it came: lower case, without the dash.
  await enterCode(page, code.toLowerCase().replace('-', ''));
  await expect(page.getByText(PAIRED)).toBeVisible();
  await checkA11y(); // the paired outcome

  // The reader, polling, receives its session.
  expect(await reader.poll()).toBe('approved');
  expect(await reader.canRead()).toBe(true);

  // Done → the account screen, where the reader is listed.
  await page.getByRole('button', { name: 'Done' }).click();
  await expectAccountScreen(page);
  await expect(remarkableRows(page)).toHaveCount(1);
  await expect(remarkableRows(page).getByText('Reads only')).toBeVisible();
  await expect(remarkableRows(page).getByText('This device', { exact: true })).toHaveCount(0);
  await checkA11y(); // the account screen with the reader's row

  // The same code again → already used, under the field, its text kept.
  await page.getByRole('button', { name: 'Pair a device' }).click();
  await enterCode(page, code);
  await expect(page.getByText(USED)).toBeVisible();
  await expect(codeField(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(codeField(page)).toHaveValue(code);
  await expect(codeField(page)).toBeFocused();
});

test('signed out, /pair signs in first; then the account screen’s foot, and the reader signed out there', async ({
  page,
  checkA11y,
}) => {
  await enableVirtualAuthenticator(page);
  await startApp(page, '/pair');

  // Signed out: the lead above the one sign-in surface, both doors; no field.
  await expect(page.getByText(LEAD)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Pair a device' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Already have an account?' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'New here?' })).toBeVisible();
  await expect(codeField(page)).toHaveCount(0);
  await checkA11y(); // the signed-out page

  // An account made there: the page goes on to the code, on the same page.
  await page.getByRole('group', { name: 'New here?' }).getByRole('button', { name: 'Make an account' }).click();
  await expect(codeField(page)).toBeVisible();

  // A code no reader began.
  await enterCode(page, 'ZZZ-ZZZ');
  await expect(page.getByText(UNKNOWN)).toBeVisible();
  await expect(codeField(page)).toHaveValue('ZZZ-ZZZ');
  await checkA11y(); // a refusal under the field

  // A code the reader began pairs.
  const reader = new RemarkableDevice();
  const code = await reader.begin();
  await enterCode(page, code);
  await expect(page.getByText(PAIRED)).toBeVisible();
  expect(await reader.poll()).toBe('approved');
  expect(await reader.readStatus()).toBe(200);

  await page.getByRole('button', { name: 'Done' }).click();
  await expectAccountScreen(page);
  await expect(remarkableRows(page)).toHaveCount(1);

  // The foot opens the page; its Back returns to the account screen.
  await page.getByRole('button', { name: 'Pair a device' }).click();
  await expect(codeField(page)).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expectAccountScreen(page);

  // Sign the reader out: asked first, then its session stops.
  await remarkableRows(page).getByRole('button', { name: 'Sign your reMarkable out' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Sign your reMarkable out?' })).toBeVisible();
  await expect(
    dialog.getByText(
      'It stops reading your books the next time it syncs, and they are removed from it. Nothing in your account changes.',
    ),
  ).toBeVisible();
  await checkA11y(); // the sign-out dialog
  await dialog.getByRole('button', { name: 'Sign out' }).click();
  await expect(remarkableRows(page)).toHaveCount(0);
  expect(await reader.readStatus()).toBe(401);
});

test('offline, the page says so and waits; online again, it can pair', async ({ page, context, checkA11y }) => {
  await signedInDevice(page);
  await startApp(page, '/pair');
  await codeField(page).fill('kq7 4tm');

  await context.setOffline(true);
  await expect(page.getByText(OFFLINE)).toBeVisible();
  await expect(pairButton(page)).toBeDisabled();
  await expect(codeField(page)).toHaveValue('kq7 4tm');
  await checkA11y(); // the page offline

  await context.setOffline(false);
  await expect(pairButton(page)).toBeEnabled();
  await expect(page.getByText(OFFLINE)).toHaveCount(0);
  await expect(codeField(page)).toHaveValue('kq7 4tm');
});
