// first-run (e2e-web) — the cold door of workflow 1 against the compose stack
// (account.first_run). A first visit lands on search with an empty shelf and the
// four ways in (workflow 1 §Cold); "Open the example book" puts the bundled book
// on the shelf as a local book — no account, no network — and makes its songs
// searchable; and because the book lives on the device, it survives a reload
// with the network cut (DIRECTION §1 L29-31, §3.7). The first song opened then
// asks about the instrument once — "Playing on guitar — change?" — and a dismiss
// keeps the guitar and never asks again, on the next song or after a reload
// (workflow 1 §The instrument; songs.first_song). Axe runs at WCAG 2.1 AA on the
// first-run screen, the populated shelf and the reading screen with the notice,
// on the phone, tablet and computer projects (contrast runs in the real browser
// here). A fresh Playwright context IS the first visit — IndexedDB and the shelf
// start empty.

import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';

const WAYS = [
  'Write a song',
  'Add a book by its link',
  'Sign in',
  'Open the example book',
];

// The two seeded songs the instrument-prompt journey opens in turn (songs.first_song):
// the first shows the prompt, the second must not.
const FIRST = { search: 'Ferry', title: 'The Ferry Line' };
const SECOND = { search: 'Morning', title: 'Morning on the Porch' };
const PROMPT = /Playing on guitar/;

// Reach the search front door with the example book seeded and a song actually
// searchable (the seed-then-wait the reading/editor e2es use — the heading paints
// before the open-example durability flush, so wait for a result, not the
// heading). Idempotent across reloads and retries.
async function gotoSearch(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  const openExample = page.getByRole('button', { name: /Open the example book/ });
  const books = page.getByRole('heading', { name: 'Books' });
  await expect(async () => {
    if (await openExample.isVisible().catch(() => false)) {
      await openExample.click({ timeout: 2000 }).catch(() => {});
    }
    await expect(books).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await page.getByRole('searchbox').fill(FIRST.search);
  await expect(page.getByRole('button', { name: new RegExp(FIRST.title) }).first()).toBeVisible();
  await page.getByRole('searchbox').fill('');
}

// Open a seeded song from search and wait for the reading sheet. On the phone the
// reading view is a full screen, so the caller returns to search with Back; on the
// tablet/computer the side search is always present, so there is nothing to undo.
async function openSong(page, { search, title }) {
  await page.getByRole('searchbox').fill(search);
  const result = page.getByRole('button', { name: new RegExp(title) });
  await expect(result.first()).toBeVisible();
  await result.first().click();
  await expect(page.locator('.reading-sheet')).toBeVisible();
}

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

// The first-open instrument prompt (workflow 1 §The instrument; songs.first_song).
// On a fresh profile nobody has put an instrument in use, so the first song to
// show its shapes asks once; dismissing it keeps the guitar and never asks again.
test('the first song opened asks about the instrument once; the second does not', async ({
  page,
  checkA11y,
}, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  await gotoSearch(page);
  await openSong(page, FIRST);

  // The inline notice shows above the chart, with Change and dismiss controls.
  await expect(page.getByText(PROMPT)).toBeVisible();
  // Exact name: the header instrument chip's aria-label ends "…, change
  // instrument", which Playwright's default substring name match would also
  // catch (strict-mode violation); pin the notice's own control.
  await expect(page.getByRole('button', { name: 'Change instrument', exact: true })).toBeVisible();
  const dismiss = page.getByRole('button', { name: 'Keep guitar and dismiss' });
  await expect(dismiss).toBeVisible();
  await checkA11y(); // the reading screen with the notice present

  // Keep the guitar and dismiss: the notice goes.
  await dismiss.click();
  await expect(page.getByText(PROMPT)).toHaveCount(0);

  // A second song shows no notice (the phone returns to search with Back; the
  // wide master-detail keeps search beside the song).
  if (narrow) {
    await page.getByRole('button', { name: 'Back' }).click();
  }
  await openSong(page, SECOND);
  await expect(page.getByText(PROMPT)).toHaveCount(0);
});

test('the dismissed prompt stays dismissed across a reload (persisted in the home book)', async ({
  page,
}) => {
  await gotoSearch(page);
  await openSong(page, FIRST);
  await page.getByRole('button', { name: 'Keep guitar and dismiss' }).click();
  await expect(page.getByText(PROMPT)).toHaveCount(0);

  // Reload the app and open a song again: the flag lives in preferences.json, so
  // the prompt does not return (AC 2 durability; DIRECTION §3.2).
  await gotoSearch(page);
  await openSong(page, FIRST);
  await expect(page.getByText(PROMPT)).toHaveCount(0);
});
