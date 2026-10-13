import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';

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

// Reach the search front door with the example book on the shelf. On a true
// first run the empty-shelf way-in seeds the book; on a reload the already-
// seeded book hydrates from IndexedDB, which briefly flashes that same way-in
// before the shelf paints — and clicking that transient button hangs, because
// it detaches mid-click as the shelf hydrates. So poll the real end state (the
// seeded "Books" section), clicking the way-in only while it is the one
// showing, and tolerating it detaching as the shelf comes in. The (idempotent)
// seed is safe to re-trigger across retries.
//
// Then wait for the seeded song to actually be SEARCHABLE before returning —
// not just the "Books" heading. The heading paints as soon as the book is
// announced (its index is still "building"), but the open-example handler's
// durability flush — the one that lets the seeded tree survive a reload — runs
// at the handler's tail, AFTER that announce. A caller that reloads the moment
// the heading shows (the offline journey does) can kill the Worker before that
// flush commits, leaving a fresh instance with an empty filesystem and the book
// lost. The song surfacing in search is the observable "seeded, indexed and
// durable" signal (the seed-then-wait the editor and file-view e2es use); the
// box is cleared again so the caller starts at the bare front door.
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
  await page.getByRole('searchbox').fill(SEARCH);
  await expect(page.getByRole('button', { name: new RegExp(SONG_TITLE) }).first()).toBeVisible();
  await page.getByRole('searchbox').fill('');
}

// Open the seeded song and wait for the reading sheet. The example book indexes
// asynchronously and SEARCH is debounced, so wait for the song itself to surface
// as a result before opening it — clicking blind grabs the "create a new song"
// row that shows while the results are still empty (the seed-then-wait the editor
// and file-view e2es use).
async function openSong(page) {
  await page.getByRole('searchbox').fill(SEARCH);
  const result = page.getByRole('button', { name: new RegExp(SONG_TITLE) });
  await expect(result.first()).toBeVisible();
  await result.first().click();
  await expect(page.locator('.reading-sheet')).toBeVisible();
}

test('opens and reads a song; the chart and the shapes render', async ({ page, checkA11y }, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  await gotoSearch(page);
  await openSong(page);

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
  await gotoSearch(page);
  await openSong(page);

  // Step up a semitone through the transpose popover.
  await page.getByRole('button', { name: 'Transpose' }).click();
  await page.getByRole('button', { name: 'Up a semitone' }).click();
  await expect(page.getByText(/Transposed/).first()).toBeVisible();
  await checkA11y(); // transposed state

  // Reload and reopen — the offset is remembered per song in the home book.
  await gotoSearch(page);
  await openSong(page);
  await expect(page.getByText(/Transposed/).first()).toBeVisible();
});

test('reads the song, its shapes and the chord explorer offline', async ({ page }, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  // Seed online first so the book is on the device, then cut the network.
  await gotoSearch(page);
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
      await openSong(offlinePage);
      await expect(offlinePage.locator('.reading-sheet .chart')).toBeVisible();
      await expect(offlinePage.locator('.reading-shapes')).toBeVisible();
      if (!narrow) {
        await expect(offlinePage.getByRole('searchbox')).toBeVisible();
      }
    },
  });
});
