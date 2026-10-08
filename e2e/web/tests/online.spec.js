// e2e-web — the per-book detail: put online, download, remove, delete
// (books.online, workflow 7; DIRECTION §3.3). Against the compose stack (the
// app served by the service on its one origin), on the three viewport projects
// (phone, tablet, computer) that auto-run every spec, with axe at WCAG 2.1 AA on
// every screen and overlay this task touches.
//
// This spec is also the reusable "put a local book online on the stack" harness
// that sync.states_e2e_hosted / sync.read_in_place / sync.lost_access were
// deferred to await (a downstream enabler, no new task). Book names are written
// for the test (no-song-text rule).
import { statSync } from 'node:fs';

import { test, expect } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';

// A signed-in device needs a passkey; the virtual authenticator is driven over
// CDP, the same inline helper account-sign-in.spec.js uses (no shared module).
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
  return client;
}

async function hasSessionCookie(page) {
  const cookies = await page.context().cookies();
  return cookies.some((c) => c.name === 'estante_session' && c.value);
}

// Make an account with a passkey, landing signed in on the shelf.
async function signIn(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
}

// Make a local book from the Books screen (the books.spec New-book flow).
async function makeLocalBook(page, name) {
  await page.getByRole('tab', { name: 'Books' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a book' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('textbox', { name: 'Book name' }).fill(name);
  await sheet.getByRole('button', { name: 'New book' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
}

test('put a local book online, download it, then delete it as owner (workflow 7)', async ({
  page,
  checkA11y,
}) => {
  await enableVirtualAuthenticator(page);
  await signIn(page);

  const NAME = 'Quarta à noite';
  await makeLocalBook(page, NAME);
  await checkA11y(); // the shelf with the new local book

  // Open its detail by pressing the row.
  await page.getByRole('button', { name: new RegExp(`^${NAME}`) }).click();
  await expect(page.getByRole('button', { name: 'Put online' })).toBeVisible();
  await checkA11y(); // the per-book detail

  // Put it online: it becomes On Estante · private.
  await page.getByRole('button', { name: 'Put online' }).click();
  await expect(page.getByText('On Estante · private')).toBeVisible();
  await checkA11y(); // the hosted detail

  // Download it: the browser saves a non-empty .zip.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const savedPath = await download.path();
  expect(statSync(savedPath).size).toBeGreaterThan(0);

  // Delete it from Estante (owner): the typed-name confirm acts only on an
  // exact match, then the book leaves the shelf.
  await page.getByRole('button', { name: 'Delete the book' }).click();
  const del = page.getByRole('dialog');
  await expect(del).toBeVisible();
  await checkA11y(); // the delete typed-name confirm
  await del.getByRole('textbox', { name: 'Type the book’s name to confirm' }).fill(NAME);
  await del.getByRole('button', { name: 'Delete the book' }).click();

  await expect(page.getByRole('button', { name: new RegExp(`^${NAME}`) })).toHaveCount(0);
});

test('remove a device-only book from the shelf through its confirmation (workflow 7 L128-135)', async ({
  page,
  checkA11y,
}) => {
  await enableVirtualAuthenticator(page);
  await signIn(page);

  const NAME = 'Só neste aparelho';
  await makeLocalBook(page, NAME);

  await page.getByRole('button', { name: new RegExp(`^${NAME}`) }).click();
  await expect(page.getByRole('button', { name: 'Remove from my shelf' })).toBeVisible();

  // Remove it: a device-only book warns it will be gone for good and offers
  // Download first; confirm the removal.
  await page.getByRole('button', { name: 'Remove from my shelf' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText(/deletes it for good/)).toBeVisible();
  await checkA11y(); // the remove confirmation
  await confirm.getByRole('button', { name: 'Remove from my shelf' }).click();

  await expect(page.getByRole('button', { name: new RegExp(`^${NAME}`) })).toHaveCount(0);
});
