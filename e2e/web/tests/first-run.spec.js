// first-run (e2e-web) — the cold door of workflow 1 against the compose stack
// (account.first_run). A first visit lands on search with an empty shelf and the
// four ways in (workflow 1 §Cold); "Open the example book" puts the bundled book
// on the shelf as a local book — no account, no network — and makes its songs
// searchable; and because the book lives on the device, it survives a reload
// with the network cut (DIRECTION §1 L29-31, §3.7). Axe runs at WCAG 2.1 AA on
// the first-run screen and on the populated shelf, on the phone, tablet and
// computer projects (contrast runs in the real browser here). A fresh Playwright
// context IS the first visit — IndexedDB and the shelf start empty.

import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';

const WAYS = [
  'Write a song',
  'Add a book by its link',
  'Sign in',
  'Open the example book',
];

test('a first visit shows the empty shelf and its four ways in', async ({ page, checkA11y }) => {
  await page.goto('/');
  await waitForServiceWorker(page);

  await expect(
    page.getByRole('heading', { name: 'Your shelf is empty' }),
  ).toBeVisible();
  await expect(page.getByText(/A book is a collection of songs/)).toBeVisible();

  for (const name of WAYS) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
  // My songs is listed from the start, with its state carried by a word. Pin
  // the listing's own name exactly — "My songs" also appears inside the "Write
  // a song" row's meta ("It goes into My songs"), so a loose text match is
  // ambiguous.
  await expect(page.getByText('My songs', { exact: true })).toBeVisible();
  await expect(page.getByText(/No songs yet/)).toBeVisible();

  await checkA11y();
});

test('opening the example book puts it on the shelf, its songs are searchable, and it survives an offline reload', async ({
  page,
  checkA11y,
}) => {
  await page.goto('/');
  await waitForServiceWorker(page);

  await page.getByRole('button', { name: /Open the example book/ }).click();

  // A song from the book is found by search (the Worker seeded and indexed it).
  await page.getByRole('searchbox').fill('Ferry');
  await expect(page.getByText('The Ferry Line')).toBeVisible();

  // Back to the pre-typing state: the example book now sits on the shelf as a
  // section under its label (not a raw id), the normal pre-typing listing.
  await page.getByRole('searchbox').fill('');
  // The section trigger is named by the label, which leads its accessible name;
  // anchor the match so it pins the section itself and not the book's
  // "Search only in Example Book" scope button, which also carries the label.
  await expect(page.getByRole('button', { name: /^Example Book/ })).toBeVisible();
  await checkA11y();

  // Cut the network and reload: the book and its songs are still there, because
  // they live on the device (offline-first).
  await runOffline(page, {
    async whileOffline(offlinePage) {
      await offlinePage.getByRole('searchbox').fill('Ferry');
      await expect(offlinePage.getByText('The Ferry Line')).toBeVisible();
    },
  });
});
