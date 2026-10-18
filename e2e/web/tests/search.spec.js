import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { runOffline } from '../lib/offline.js';
import {
  openExampleBook,
  openSongFromSearch,
  openSongInEditor,
  typeAtEndOfLine,
  saveThroughSheet,
  startApp,
} from '../lib/journeys.js';
import { toSearch, createSongFromSearch } from '../lib/journeys-core.js';

// e2e-web (songs.search) — the search screen against the served compose stack,
// on the phone / tablet / computer viewport projects (playwright.config.js),
// with axe at WCAG 2.1 AA (contrast included, in a real browser) on every
// screen the task touches.
//
// The app opens on search: one box across every book (workflow 2 L11, DIRECTION
// §4 L430). A chord typed into that box is offered as the explorer row, FIRST,
// recognised entirely on the device (workflow 2 L26-40) — and that recognition
// keeps working after an offline reload, because nothing on this screen needs a
// network (workflow 2 L152-155).
//
// The "across books" narrowing needs two books on the device: the bundled
// example book plus a second book made through Books (the scope test below).

const EXPLORE_ROW = /Explore A on your/;

test('opens on the search box, axe-clean on this viewport (workflow 2 L11, DIRECTION §4 L430)', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);

  // The app opens on the Search destination with its one box.
  await expect(page.getByRole('tab', { name: 'Search' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const box = page.getByRole('searchbox');
  await expect(box).toBeVisible();

  await checkA11y();
});

test('a chord typed in the box offers the explorer first, on the device (workflow 2 L26-40)', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);

  // Typing a chord symbol offers "Explore A on your instrument" — recognised on
  // the device, with no book on the shelf and no network call.
  await page.getByRole('searchbox').fill('A');
  await expect(page.getByRole('button', { name: EXPLORE_ROW })).toBeVisible();
  await mockup(page, 'W02-find-and-play', 1);

  // Axe clean in the typed state too, on this viewport.
  await checkA11y();
});

test('a setlist is found by the one search, marked as a setlist, and opens to list its songs (books.setlist_search; workflow 12 §The file L33-34)', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);

  // Type the setlist's title into the one song search: it is listed, marked by
  // the word "Setlist" alongside song results.
  await page.getByRole('searchbox').fill('A Short Set');
  const setlistResult = page.getByRole('button', { name: /A Short Set/ }).first();
  await expect(setlistResult).toBeVisible();
  await expect(setlistResult).toContainText('Setlist');
  await checkA11y(); // the results list with a setlist present

  // Opening it lands on the setlist view (workflow 12 L34, "Opening one lists
  // its songs") — not the reading view.
  await setlistResult.click();
  await expect(page.getByRole('heading', { level: 2, name: 'A Short Set' })).toBeVisible();
  await expect(page.getByText('Morning on the Porch')).toBeVisible();
  await checkA11y(); // the opened setlist
});

test('search still recognises a chord after an offline reload (workflow 2 L152-155, offline-first)', async ({
  page,
}) => {
  await runOffline(page, {
    async whileOffline(offlinePage) {
      // The screen comes back from cache with the network cut…
      await expect(offlinePage.getByRole('searchbox')).toBeVisible();
      // …and the chord explorer is still offered, because recognition runs
      // entirely on the device.
      await offlinePage.getByRole('searchbox').fill('A');
      await expect(
        offlinePage.getByRole('button', { name: EXPLORE_ROW }),
      ).toBeVisible();
    },
  });
});

const INTRO = 'G | C | G | D';
const ADDED = ' | Em';
const BADGE = '.search-row-open .badge.unsaved';

test('before typing, the songs just opened are listed as recents, most recent first, and survive a reload (workflow 2 §Before typing)', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await openSongFromSearch(page, 'Morning', 'Morning on the Porch');
  await toSearch(page);
  await openSongFromSearch(page, 'Ferry', 'The Ferry Line');
  await toSearch(page);
  await page.getByRole('searchbox').fill('');

  const recents = page.getByRole('region', { name: 'Recent' });
  const rows = recents.locator('.search-row-open');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('The Ferry Line');
  await expect(rows.nth(1)).toContainText('Morning on the Porch');
  await expect(page.getByRole('region', { name: 'Books' })).toBeVisible(); // the book sections follow
  await checkA11y(); // search before typing, with recents

  // Opening the older one again moves it to the top.
  await rows.nth(1).click();
  await expect(page.getByRole('group', { name: 'Morning on the Porch' }).first()).toBeVisible();
  await toSearch(page);
  await expect(rows.nth(0)).toContainText('Morning on the Porch');

  // The list lives on the device: a reload brings it back in the same order.
  await startApp(page);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Morning on the Porch');
  await expect(rows.nth(1)).toContainText('The Ferry Line');
});

test('Search only in a book narrows the results to it, and a reload resets the filter (workflow 2 §Scope)', async ({
  page,
  checkA11y,
}) => {
  const OTHER = 'My songs';
  await openExampleBook(page);
  // A second book with a song of its own: Create from a search with no match
  // writes into My songs.
  await createSongFromSearch(page, 'Moonlit Pier');
  await toSearch(page);
  await page.getByRole('searchbox').fill('');
  await expect(page.getByRole('button', { name: `Search only in ${OTHER}` })).toBeVisible();

  // Narrow to the example book: its song is found, the other book's is not.
  await page.getByRole('button', { name: 'Search only in Example Book' }).click();
  await expect(page.getByRole('button', { name: 'Clear filter' })).toBeVisible();
  await expect(page.locator('.scope')).toContainText('Example Book');
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByRole('button', { name: /Morning on the Porch/ }).first()).toBeVisible();
  await page.getByRole('searchbox').fill('Moonlit');
  await expect(page.getByRole('heading', { name: 'No songs match' })).toBeVisible();

  // Narrow to the other book instead: the same query now finds the other song
  // and the example book's is out of reach.
  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: 'Clear filter' }).click();
  await expect(page.getByRole('button', { name: 'Clear filter' })).toHaveCount(0);
  await page.getByRole('button', { name: `Search only in ${OTHER}` }).click();
  await expect(page.locator('.scope')).toContainText(OTHER);
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByRole('heading', { name: 'No songs match' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Morning on the Porch/ })).toHaveCount(0);
  await checkA11y(); // a filtered search with no result
  await page.getByRole('searchbox').fill('Moonlit');
  await expect(page.getByRole('button', { name: /Moonlit Pier/ }).first()).toBeVisible();

  // The filter is for this session only: after a reload, search spans every book.
  await startApp(page);
  await expect(page.getByRole('button', { name: 'Clear filter' })).toHaveCount(0);
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByRole('button', { name: /Morning on the Porch/ }).first()).toBeVisible();
});

test('a song edited through Edit carries the unsaved badge in search until it is saved (workflow 2 §Badges, workflow 4)', async ({
  page,
}) => {
  await openExampleBook(page);
  await openSongInEditor(page, 'Morning', 'Morning on the Porch');
  await typeAtEndOfLine(page, INTRO, ADDED);
  await expect(page.locator('.cm-content')).toContainText(`${INTRO}${ADDED}`);

  // Back to search: the badge is a word on the result, and on the recent.
  await toSearch(page);
  await page.getByRole('searchbox').fill('Morning');
  const row = page.locator('.search-row-open', { hasText: 'Morning on the Porch' }).first();
  await expect(row).toBeVisible();
  await expect(row.locator('.badge.unsaved')).toHaveText('unsaved');
  await page.getByRole('searchbox').fill('');
  await expect(page.getByRole('region', { name: 'Recent' }).locator(BADGE)).toHaveCount(1);

  // Save through the sheet: the badge goes.
  await openSongFromSearch(page, 'Morning', 'Morning on the Porch');
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.locator('.cm-content')).toContainText(`${INTRO}${ADDED}`);
  await saveThroughSheet(page, { note: 'Add Em' });
  await toSearch(page);
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.locator('.search-row-open', { hasText: 'Morning on the Porch' }).first()).toBeVisible();
  await expect(page.locator(BADGE)).toHaveCount(0);
});
