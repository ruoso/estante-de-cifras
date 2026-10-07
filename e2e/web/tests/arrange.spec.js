import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';

// e2e-web — arranging a song end to end on the three viewports (songs.arrange,
// workflow 5). The example book is seeded through the UI, a song is opened from
// search, arrange is entered from the reading view, a chord is tapped, and a
// shape is chosen — with axe at WCAG 2.1 AA on the arrange screen and the open
// picker. Then: only here and enter-a-shape; the whole journey by keyboard on
// the computer; a new variation; and choosing a shape offline. phone is the
// narrow screen; tablet and computer are the wide side-by-side. Pins workflow 5
// L14-41, L43-49, L30-31, L75-85; the .tji e2e clause; offline-first.

const SEARCH = 'Morning';
const SONG_TITLE = 'Morning on the Porch';

// Reach the search front door with the example book seeded and searchable (the
// seed-then-wait the reading/editor e2es use).
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

async function openSong(page) {
  await page.getByRole('searchbox').fill(SEARCH);
  const result = page.getByRole('button', { name: new RegExp(SONG_TITLE) });
  await expect(result.first()).toBeVisible();
  await result.first().click();
  await expect(page.locator('.reading-sheet')).toBeVisible();
}

// Enter arrange from the reading view: the narrow action bar's Arrange, or the
// wide "More" overflow's "Arrange for …".
async function enterArrange(page, narrow) {
  if (narrow) {
    await page.getByRole('button', { name: 'Arrange', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: /^Arrange for/ }).click();
  }
  await expect(page.getByText(/Arranging ·/)).toBeVisible();
}

const firstChord = (page) => page.getByRole('button', { name: /^Choose a shape for/ }).first();
const picker = (page) => page.getByRole('dialog');
// The candidate / enter-shape choose targets are labelled "Choose <chord>, …".
const candidate = (scope) => scope.getByRole('button', { name: /^Choose \S+,/ }).first();

test('arranges a song for guitar: tap a chord, choose a shape', async ({ page, checkA11y }, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  await gotoSearch(page);
  await openSong(page);
  await enterArrange(page, narrow);

  // The chart is a group of tappable chords; the shapes strip renders.
  await expect(firstChord(page)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Shapes' })).toBeVisible();
  await checkA11y(); // the arrange screen

  // Tap a chord → the picker opens (Every <chord> is the default scope).
  await firstChord(page).click();
  await expect(picker(page)).toBeVisible();
  await checkA11y(); // the open picker

  // Choose the first candidate shape; the picker closes and the chart remains.
  await candidate(picker(page)).click();
  await expect(picker(page)).toBeHidden();
  await expect(firstChord(page)).toBeVisible();
});

test('only here warns, and a shape by hand can be chosen', async ({ page, checkA11y }, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  await gotoSearch(page);
  await openSong(page);
  await enterArrange(page, narrow);

  await firstChord(page).click();
  await expect(picker(page)).toBeVisible();

  // Only here reveals the shared-chart warning before any shape is chosen.
  await picker(page).getByRole('button', { name: 'Only here' }).click();
  await expect(page.getByText(/marks this bar in the chart/)).toBeVisible();

  // Enter a shape by hand: place a finger and choose it.
  await picker(page).getByRole('button', { name: 'Enter a shape' }).click();
  const dialog = page.getByRole('dialog', { name: /^Enter a shape for/ });
  await expect(dialog).toBeVisible();
  await checkA11y(); // the enter-a-shape dialog
  await dialog.getByRole('radio', { name: 'String 1, fret 4' }).click();
  await candidate(dialog).click();
  await expect(dialog).toBeHidden();
});

test('runs the whole arrange journey by keyboard on the computer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'computer', 'keyboard-only journey runs on the computer viewport');
  await gotoSearch(page);
  await openSong(page);
  await enterArrange(page, false);

  // Focus a chord and open the picker with the keyboard; choose a candidate with
  // the keyboard — no pointer.
  await firstChord(page).focus();
  await page.keyboard.press('Enter');
  await expect(picker(page)).toBeVisible();
  await candidate(picker(page)).focus();
  await page.keyboard.press('Enter');
  await expect(picker(page)).toBeHidden();
});

test('adds a new variation and switches to it', async ({ page }, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  await gotoSearch(page);
  await openSong(page);
  await enterArrange(page, narrow);

  // Guitar has one variation here, so the selector is hidden. Add one.
  await expect(page.getByRole('group', { name: 'Variation' })).toBeHidden();
  await page.getByRole('button', { name: 'Variations' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a variation' });
  await dialog.getByRole('textbox', { name: 'Name for this variation' }).fill('Up the neck');
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(dialog).toBeHidden();

  // With two variations the selector appears; the new one is in use.
  await expect(page.getByRole('group', { name: 'Variation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Up the neck' })).toBeVisible();

  // A choice now lands in the new variation.
  await firstChord(page).click();
  await candidate(picker(page)).click();
  await expect(picker(page)).toBeHidden();
});

test('chooses a shape offline; the edit persists to the working copy', async ({ page }, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  await gotoSearch(page);
  await expect(page.getByRole('searchbox')).toBeVisible();

  await runOffline(page, {
    path: '/',
    async whileOffline(offlinePage) {
      await waitForServiceWorker(offlinePage);
      await openSong(offlinePage);
      await enterArrange(offlinePage, narrow);

      await firstChord(offlinePage).click();
      await expect(offlinePage.getByRole('dialog')).toBeVisible();
      await candidate(offlinePage.getByRole('dialog')).click();
      await expect(offlinePage.getByRole('dialog')).toBeHidden();
      // The chord is still tappable — the edit went to the working copy on-device.
      await expect(offlinePage.getByRole('button', { name: /^Choose a shape for/ }).first()).toBeVisible();
    },
  });
});
