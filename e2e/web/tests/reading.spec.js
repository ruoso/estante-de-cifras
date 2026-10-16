import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';
import { openExampleBook, openSongFromSearch } from '../lib/journeys.js';
import { expectFits } from '../lib/fit.js';

// e2e-web — reading a song end to end on the three viewports (songs.reading,
// workflow 2). The example book is seeded through the UI (the first-run "Open
// the example book" way-in), a song is opened from search (the real
// search→reading wiring this task added), read, transposed and re-opened, and
// read offline with the chord explorer — with axe at WCAG 2.1 AA on the default,
// transposed and full-screen states. phone is the narrow screen; the tablet
// reads on the whole pane; the computer is the master-detail, search beside the
// song (songs.reading_chrome Decision 1). Pins workflow 2 L67-70, L135-138,
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

  // On the computer, search sits beside the song (master-detail, W02#4); the
  // phone and the tablet read on the whole screen with no search box (W02#2-3).
  if (testInfo.project.name === 'computer') {
    await expect(page.getByRole('searchbox')).toBeVisible();
  } else {
    await expect(page.getByRole('searchbox')).toHaveCount(0);
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

// songs.reading_chrome — the header, the ⋯ menu and the shapes as the boards
// draw them on each device: phone W02#2 (Transpose icon and ⋯; Edit and Full
// screen below; plain *Shapes*), tablet W02#3 / W01#3 / W12#3 (no rail; the
// chip, Transpose, Edit and ⋯ in the app bar; the shapes in a card beside the
// chart), computer W02#4 (the chip in the rail head; the full row). The ⋯ menu
// holds every action on every device, keyboard-reachable (workflow 2 L86-87;
// workflow 15 L62-75). Print and Share are not activated here (Decision 6).
const MENU = ['Edit', 'History', 'Add to setlist', 'Print', 'Share', 'Arrange for Guitar', 'Full screen'];

test('the reading chrome as drawn: the header, the ⋯ menu and the shapes', async ({ page, checkA11y }, testInfo) => {
  const device = testInfo.project.name;
  await openExampleBook(page);
  await openSongFromSearch(page, SEARCH, SONG_TITLE);

  const bar = page.locator('.appbar.reading-chrome');
  const more = bar.getByRole('button', { name: 'More', exact: true });
  if (device === 'phone') {
    await expect(bar.getByRole('button', { name: 'Transpose' })).toBeVisible();
    await expect(more).toBeVisible();
    const actions = page.locator('.reading-actionbar');
    await expect(actions.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Full screen' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Shapes', exact: true })).toBeVisible();
  } else if (device === 'tablet') {
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    for (const name of ['Guitar, change instrument', 'Transpose', 'Edit', 'More']) {
      await expect(bar.getByRole('button', { name, exact: true })).toBeVisible();
    }
    const shapes = page.getByRole('region', { name: /^Shapes · Guitar/i });
    await expect(shapes).toBeVisible();
    await expect(shapes).toHaveClass(/\bcard\b/);
    const chartBox = await page.locator('.reading-sheet .chart').boundingBox();
    const shapesBox = await shapes.boundingBox();
    expect(shapesBox.x, 'the shapes card sits beside the chart').toBeGreaterThanOrEqual(chartBox.x + chartBox.width);
  } else {
    await expect(page.locator('.reading-side .rail-head').getByRole('button', { name: 'Guitar, change instrument' })).toBeVisible();
    for (const name of ['Edit', 'History', 'Add to setlist', 'Print', 'Share']) {
      await expect(bar.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('region', { name: /^Shapes · Guitar/i })).toBeVisible();
  }
  // The app bar fits: no button pushed out or clipped, the title the one thing
  // that ellipsizes (shell.narrow_fit).
  await expectFits(page, { whole: [more] });

  // ⋯ by the keyboard: the seven, in order; Escape back to More.
  await more.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: 'More' });
  await expect(menu.getByRole('menuitem')).toHaveText(MENU);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(more).toBeFocused();

  await mockup(page, 'W02-find-and-play', 2);
  await mockup(page, 'W02-find-and-play', 3, { note: 'reading chrome, guitar' });
  await mockup(page, 'W02-find-and-play', 4);
  await checkA11y();

  // ⋯ › History opens the song's history; Back returns to the song.
  await more.click();
  await page.getByRole('menuitem', { name: 'History', exact: true }).click();
  await expect(page.locator('.est-history-row').first()).toBeVisible();
  await page.getByRole('button', { name: 'Back to the song' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('group', { name: SONG_TITLE }).first()).toBeVisible();

  // ⋯ › Add to setlist opens its dialog; Cancel closes it.
  await more.click();
  await page.getByRole('menuitem', { name: 'Add to setlist', exact: true }).click();
  const heading = page.getByRole('heading', { name: 'Add to setlist' });
  await expect(heading).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(heading).toBeHidden();
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
      // Search beside the song on the computer only (songs.reading_chrome
      // Decision 1).
      if (testInfo.project.name === 'computer') {
        await expect(offlinePage.getByRole('searchbox')).toBeVisible();
      }
    },
  });
});
