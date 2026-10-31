/**
 * e2e-web — help on every page and the first-open tour (workflow 18), on phone,
 * tablet and computer, axe in each state.
 *
 * Pins: a fresh device offers the tour as an inline notice under the header;
 * Take the tour runs every card to Done; the answer is kept, so a reload never
 * offers it again; the shell's Help opens the destination's own page, Other
 * pages shows another's in place; a deep page — a song — has its own Help in
 * its app bar.
 */
import { test, expect } from '../lib/axe.js';
import { startApp, openExampleBook, openSongFromSearch, gotoTab } from '../lib/journeys.js';
import { SONG } from '../lib/journeys-core.js';

const OFFER = 'New to Estante? A short tour shows how it works.';

test('a fresh device offers the tour once; it runs to Done and is not offered again', async ({ page, checkA11y }) => {
  await startApp(page);
  await expect(page.getByText(OFFER)).toBeVisible();
  await checkA11y(); // the shell with the offer

  await page.getByRole('button', { name: 'Take the tour' }).click();
  const tour = page.getByRole('dialog', { name: 'Tour' });
  await expect(tour.getByRole('heading', { name: 'Welcome to Estante' })).toBeVisible();
  await expect(page.getByText(OFFER)).toHaveCount(0);

  // To the card with a chart line on it, axe there.
  await tour.getByRole('button', { name: 'Next' }).click();
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour.getByRole('heading', { name: 'Read and play' })).toBeVisible();
  await expect(tour.locator('.help-tour-picture .chart')).toBeVisible();
  await checkA11y(); // a tour card with a picture

  while (await tour.getByRole('button', { name: 'Next' }).isVisible()) {
    await tour.getByRole('button', { name: 'Next' }).click();
  }
  await expect(tour.getByRole('heading', { name: 'Help is always here' })).toBeVisible();
  await tour.getByRole('button', { name: 'Done' }).click();
  await expect(tour).toBeHidden();

  // Kept in the home book: a reload does not offer it again.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
  await expect(page.getByText(OFFER)).toHaveCount(0);
});

test('No, thanks answers the offer, and the tour is still in Help', async ({ page }) => {
  await startApp(page);
  await page.getByRole('button', { name: 'No, thanks' }).click();
  await expect(page.getByText(OFFER)).toHaveCount(0);

  await page.getByRole('button', { name: 'Help: Search' }).click();
  const help = page.getByRole('dialog', { name: 'Search' });
  await help.getByRole('button', { name: 'Take the tour' }).click();
  await expect(page.getByRole('dialog', { name: 'Tour' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('every page has Help: the shell\'s destination, other pages in place, and a song\'s own', async ({ page, checkA11y }) => {
  await openExampleBook(page);

  // The shell's Help is about the destination shown: Books on Books, Search on
  // Search.
  await gotoTab(page, 'Books');
  await page.getByRole('button', { name: 'Help: Books' }).click();
  await expect(page.getByRole('dialog', { name: 'Books' })).toBeVisible();
  await page.keyboard.press('Escape');
  await gotoTab(page, 'Search');
  await page.getByRole('button', { name: 'Help: Search' }).click();
  // The panel is named by the page it shows, so it is found as the open dialog.
  const help = page.getByRole('dialog');
  await expect(help).toHaveAccessibleName('Search');
  await expect(help.getByText(/Finds a song across every book on your shelf/)).toBeVisible();
  await checkA11y(); // the help panel

  // Other pages: another page's help in place, and back.
  await help.getByRole('button', { name: 'Chord explorer' }).click();
  await expect(help.getByRole('heading', { level: 2, name: 'Chord explorer' })).toBeVisible();
  await help.getByRole('button', { name: 'Back to Search' }).click();
  await expect(help.getByRole('heading', { level: 2, name: 'Search' })).toBeVisible();
  await help.getByRole('button', { name: 'Close help' }).click();
  await expect(help).toBeHidden();

  // A song carries its own Help in its app bar.
  await openSongFromSearch(page, SONG.search, SONG.title);
  await page.getByRole('button', { name: 'Help: Reading a song' }).filter({ visible: true }).click();
  const songHelp = page.getByRole('dialog', { name: 'Reading a song' });
  await expect(songHelp.getByText(/Transpose to read it in another key/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(songHelp).toBeHidden();
});
