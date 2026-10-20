// open-a-book (e2e-web) — a book on the shelf opens on its songs
// (books.row_opens_songs; workflow 7 §The book-management screen and §A book's
// songs; workflow 14 §The view; the Open-a-book, W07 and W14 boards), against
// the compose stack on the phone, tablet and computer projects, with axe at
// WCAG 2.1 AA on every screen it touches.
//
// Pure real UI, no account: the bundled example book (account.first_run). The
// row says how many songs the book holds and has no Files button; pressing it
// opens the book's songs at `/b/<book>` with the bar naming it and *Manage*; a
// song is played from there; *Manage* opens the book's detail (full screen
// with *Back to {book}* on the phone and the tablet, the main pane beside the
// book's songs on the computer); *Files* opens the file view, whose Back
// returns to the detail; and a reload with the detail open lands on the book's
// songs, the detail being a layer, never an address. The example book's songs
// are written for the project (no one's words).

import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { openExampleBook, gotoTab } from '../lib/journeys.js';
import { EXAMPLE_BOOK, fileRow } from '../lib/journeys-files.js';

const SONG = 'Morning on the Porch';
const MORNING = 'morning-on-the-porch.cifra.md';
const BOOK_URL = /\/b\/[^/]+$/;

test('a book’s songs open from the Books tab, a song plays from there, and Manage leads to the detail and Files', async ({
  page,
  checkA11y,
}, testInfo) => {
  await openExampleBook(page);

  // Books: the row says how many songs, and is the row's one action — no
  // Files, no rename, no Bring them in beside it (workflow 7 L19-34).
  await gotoTab(page, 'Books');
  const row = page.getByRole('button', { name: new RegExp(`^${EXAMPLE_BOOK}`) });
  await expect(row).toBeVisible();
  await expect(row).toContainText(/On this device · can save · \d+ songs/);
  await expect(page.getByRole('button', { name: `Files in ${EXAMPLE_BOOK}` })).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Rename ${EXAMPLE_BOOK}` })).toHaveCount(0);
  await expect(page.getByText('Pick a book to see its details.')).toHaveCount(0);
  await checkA11y(); // the shelf with the count

  // Pressing the row opens the book's songs: its address, the scope chip in
  // the box, and the bar with Manage (workflow 7 §A book's songs L60-67).
  await row.click();
  await expect(page).toHaveURL(BOOK_URL);
  const bookUrl = page.url();
  await expect(page.locator('.search .scope')).toContainText(EXAMPLE_BOOK);
  const bar = page.locator('.book-bar');
  await expect(bar.getByRole('heading', { name: EXAMPLE_BOOK })).toBeVisible();
  await expect(bar).toContainText(/\d+ songs/);
  await expect(bar.getByRole('button', { name: `Manage ${EXAMPLE_BOOK}` })).toBeVisible();
  await checkA11y(); // the book's songs with the bar

  // A song played from the book's songs: it opens from the list and its chart
  // shows.
  await page.locator('.search-row-open', { hasText: SONG }).first().click();
  await expect(page.locator('.reading-sheet')).toBeVisible();
  await expect(page.locator('.reading-sheet .chart').first()).toBeVisible();

  // Back to the book's songs, the bar above them.
  await page.getByRole('button', { name: 'Back', exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(bookUrl);
  await expect(page.getByRole('button', { name: `Manage ${EXAMPLE_BOOK}` }).first()).toBeVisible();

  // Manage opens the book's detail (workflow 7 L86-95): full screen with Back
  // on the phone and the tablet, the main pane beside the book's songs on the
  // computer. Not an address: the URL stays the book's songs.
  await page.getByRole('button', { name: `Manage ${EXAMPLE_BOOK}` }).first().click();
  const detail = page.locator('.book-detail');
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('button', { name: `Back to ${EXAMPLE_BOOK}` })).toBeVisible();
  await expect(detail.getByRole('button', { name: `Rename ${EXAMPLE_BOOK}` })).toBeVisible();
  await expect(page).toHaveURL(bookUrl);
  if (testInfo.project.name === 'computer') {
    const side = page.locator('.book-detail-split .pane.side');
    await expect(side.locator('.search .scope')).toContainText(EXAMPLE_BOOK);
    await expect(side.locator('.search-row-open', { hasText: SONG }).first()).toBeVisible();
  } else {
    await expect(page.getByRole('tab', { name: 'Books' })).toBeHidden();
  }
  await checkA11y(); // the book's detail

  // Files opens the file view on the book (workflow 14 §The view); its Back
  // returns to the detail.
  await detail.getByRole('button', { name: `Files in ${EXAMPLE_BOOK}` }).click();
  await expect(fileRow(page, MORNING)).toBeVisible();
  await checkA11y(); // the file view
  await mockup(page, 'W14-file-view', 1); // the book's files (phone)
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('button', { name: `Files in ${EXAMPLE_BOOK}` })).toBeVisible();

  // Reloading with the detail open lands on the book's songs: the detail is a
  // layer, not an address.
  await page.reload();
  await expect(page).toHaveURL(bookUrl);
  await expect(page.locator('.book-detail')).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Manage ${EXAMPLE_BOOK}` }).first()).toBeVisible();
  await checkA11y(); // the book's songs after the reload

  // Back from the detail returns to the book's songs.
  await page.getByRole('button', { name: `Manage ${EXAMPLE_BOOK}` }).first().click();
  await page.locator('.book-detail').getByRole('button', { name: `Back to ${EXAMPLE_BOOK}` }).click();
  await expect(page.locator('.book-detail')).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Manage ${EXAMPLE_BOOK}` }).first()).toBeVisible();
});
