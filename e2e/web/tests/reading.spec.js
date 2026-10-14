import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';
import { openExampleBook, openSongFromSearch } from '../lib/journeys.js';

// e2e-web — reading a song end to end on the three viewports (songs.reading,
// workflow 2). The example book is seeded through the UI (the first-run "Open
// the example book" way-in), a song is opened from search (the real
// search→reading wiring this task added), read, transposed and re-opened, and
// read offline with the chord explorer — with axe at WCAG 2.1 AA on the default,
// transposed and full-screen states. phone is the narrow screen; tablet and
// computer are the wide master-detail. Pins workflow 2 L67-70, L135-138,
// L153-155; mockups W02; shell.layout; music.transpose's deferred e2e.

const SEARCH = 'Morning';
const SONG_TITLE = 'Morning on the Porch';

test('opens and reads a song; the chart and the shapes render', async ({ page, checkA11y }, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  await openExampleBook(page);
  await openSongFromSearch(page, SEARCH, SONG_TITLE);

  // The chart (proportional) and the shapes section both render.
  await expect(page.locator('.reading-sheet .chart')).toBeVisible();
  await expect(page.locator('.reading-shapes')).toBeVisible();
  const diagram = page.locator('.chord-diagram').first();
  await expect(diagram).toBeVisible();
  // §6 (shell.a11y_chart; docs/screen-reader.md §6) — a chord diagram reads as
  // its describeFingering sentence: the chord box is an img whose accessible
  // name describes the shape (its shorthand of fret numbers / x), the role word
  // read beside it in document order.
  await expect(diagram.getByRole('img')).toHaveAccessibleName(/[0-9x]{3,}/);

  // On the computer/tablet, search sits beside the song (master-detail); on the
  // phone the reading view is a full screen with no search box.
  if (narrow) {
    await expect(page.getByRole('searchbox')).toHaveCount(0);
  } else {
    await expect(page.getByRole('searchbox')).toBeVisible();
  }

  await mockup(page, 'W02-find-and-play', 2);
  await checkA11y(); // default reading state

  // Full screen: chrome-free, with a keyboard-reachable way out (axe in it).
  if (narrow) {
    await page.getByRole('button', { name: 'Full screen' }).click();
  } else {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'Full screen' }).click();
  }
  await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
  await expect(page.locator('.reading-sheet .chart')).toBeVisible();
  await checkA11y(); // full-screen state
  await page.getByRole('button', { name: 'Exit full screen' }).click();
});

test('transposes and remembers the offset across a reload', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openSongFromSearch(page, SEARCH, SONG_TITLE);

  // Step up a semitone through the transpose popover.
  await page.getByRole('button', { name: 'Transpose' }).click();
  await page.getByRole('button', { name: 'Up a semitone' }).click();
  await expect(page.getByText(/Transposed/).first()).toBeVisible();
  await mockup(page, 'W02-find-and-play', 4);
  await checkA11y(); // transposed state

  // Reload and reopen — the offset is remembered per song in the home book.
  await openExampleBook(page);
  await openSongFromSearch(page, SEARCH, SONG_TITLE);
  await expect(page.getByText(/Transposed/).first()).toBeVisible();
});

test('reads the song, its shapes and the chord explorer offline', async ({ page }, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  // Seed online first so the book is on the device, then cut the network.
  await openExampleBook(page);
  await expect(page.getByRole('searchbox')).toBeVisible();

  await runOffline(page, {
    path: '/',
    async whileOffline(offlinePage) {
      await waitForServiceWorker(offlinePage);

      // The chord explorer opens offline (reached from search's chord row).
      await offlinePage.getByRole('searchbox').fill('A');
      await offlinePage.getByRole('button', { name: /Explore A on your/ }).click();
      await expect(offlinePage.getByText('Explore a chord')).toBeVisible();
      await offlinePage.getByRole('button', { name: 'Back to search' }).click();

      // The song reads with its shapes, all on what is on the device.
      await openSongFromSearch(offlinePage, SEARCH, SONG_TITLE);
      await expect(offlinePage.locator('.reading-sheet .chart')).toBeVisible();
      await expect(offlinePage.locator('.reading-shapes')).toBeVisible();
      if (!narrow) {
        await expect(offlinePage.getByRole('searchbox')).toBeVisible();
      }
    },
  });
});
