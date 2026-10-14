// history.spec.js (e2e-web) — a song's history on the three viewports, offline,
// and a version restored and saved (songs.history, workflow 6; workflow 8
// §Offline). Against the compose stack, on the phone/tablet/computer projects,
// every step through the real UI from `/`: open the example book, build a short
// history by editing (reading -> Edit) and saving a song through the save sheet,
// then reading -> History and drive the journey — the versions list newest
// first, reading a version, *compare with now*, *show the text*, and *restore
// this version* (which asks first over unsaved changes, then opens the save
// sheet, and the saved copy appears as a new version at the top) — with axe at
// WCAG 2.1 AA on the list, the version view and the restore dialog, and the
// whole flow once more after a reload with the network cut.

import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { runOffline } from '../lib/offline.js';
import {
  openSongFromSearch,
  startApp,
} from '../lib/journeys.js';
import {
  addSection,
  buildHistory,
  editAgain,
  openFirstVersion,
  confirmSheet,
  openHistory as historyFromReading,
} from '../lib/journeys-edit.js';

const SONG_TITLE = 'Morning on the Porch';

test('a song’s history: list, read a version, compare with now, show the text; axe-clean', async ({
  page,
  checkA11y,
}) => {
  await buildHistory(page);

  await historyFromReading(page);
  await expect(page.locator('.est-history-row').first()).toBeVisible();
  await mockup(page, 'W06-history', 1); // the song's history
  await checkA11y(); // the list (and, on the computer, the split)

  await openFirstVersion(page);
  await expect(page.getByText('What changed from the version before')).toBeVisible();
  await mockup(page, 'W06-history', 2); // one old version
  await checkA11y(); // the version view

  await page.getByRole('button', { name: 'Compare with now' }).click();
  await expect(page.getByText('What changed from this version to now')).toBeVisible();

  await page.getByRole('switch', { name: 'Show the text' }).click();
  await expect(page.locator('.est-history-text')).toBeVisible();
  await mockup(page, 'W06-history', 4); // the list beside a version, text shown
});

test('after a save, reading -> History lists the new version with its note, also after a reload', async ({
  page,
}) => {
  await buildHistory(page);

  await historyFromReading(page);
  const rows = page.locator('.est-history-row');
  await expect(rows.first()).toBeVisible();
  await expect(rows.first()).toContainText('Add a Bridge'); // newest first
  await expect(page.locator('.est-history-row', { hasText: 'Add a Coda' })).toBeVisible();
  const count = await rows.count();

  // Durable: after a reload the history is the same.
  await startApp(page);
  await openSongFromSearch(page, 'Morning', SONG_TITLE);
  await historyFromReading(page);
  await expect(rows.first()).toContainText('Add a Bridge');
  await expect(rows).toHaveCount(count);
});

// A restored version opens the save sheet over the history (workflow 6 L59-62); saving it makes a
// new version at the top.

// Leave History (from its list or a version) for the song's reading view.
async function backToTheSong(page) {
  const backToHistory = page.getByRole('button', { name: 'Back to history' });
  if (await backToHistory.count()) await backToHistory.click();
  await page.getByRole('button', { name: 'Back to the song' }).click();
  await expect(page.getByRole('group', { name: SONG_TITLE }).first()).toBeVisible();
}

// Restore the oldest version from the open History list.
async function restoreOldest(page) {
  await page.locator('.est-history-row').last().click();
  await page.getByRole('button', { name: 'Restore this version' }).click();
}

test('restore asks first over unsaved changes, then puts the version in the working copy; axe-clean dialog', async ({
  page,
  checkA11y,
}) => {
  await buildHistory(page);

  // Leave an unsaved edit so restore must ask first.
  await editAgain(page);
  await addSection(page, 'Outro');
  await page.getByRole('button', { name: 'Back' }).first().click();

  await historyFromReading(page);
  await expect(page.getByText('Unsaved, on this device')).toBeVisible();

  // Restore the oldest version: it differs from the working copy.
  await restoreOldest(page);
  const confirm = page.getByRole('dialog').filter({ hasText: /Restore the version of/ });
  await expect(confirm).toBeVisible();
  await mockup(page, 'W06-history', 3); // restoring over unsaved changes asks first
  await checkA11y(); // the restore confirm dialog
  await confirm.getByRole('button', { name: 'Lose them and restore' }).click();
  await expect(confirm).toBeHidden();

  // The restored text opens the save sheet (workflow 6 L59-62); Cancel keeps it
  // in the working copy, unsaved.
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toBeHidden();

  // The working copy is the bundled first version again: no Coda/Bridge/Outro.
  await backToTheSong(page);
  await editAgain(page);
  const content = page.locator('.cm-content');
  await expect(content).toContainText(SONG_TITLE);
  await expect(content).not.toContainText('Outro');
  await expect(content).not.toContainText('Bridge');
  await expect(content).not.toContainText('Coda');
});

test('a restored version opens the save sheet, and saving makes it a new version at the top', async ({
  page,
}) => {
  await buildHistory(page);
  await historyFromReading(page);
  const before = await page.locator('.est-history-row').count();
  await restoreOldest(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await confirmSheet(page);
  // The sheet closes over the history, whose list now has the new version.
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.est-history-row')).toHaveCount(before + 1);
});

test('the history flow (list, read, show the text) works offline after a reload', async ({ page }) => {
  await buildHistory(page);

  await runOffline(page, {
    path: '/',
    async whileOffline(offlinePage) {
      await openSongFromSearch(offlinePage, 'Morning', SONG_TITLE);
      await historyFromReading(offlinePage);
      await openFirstVersion(offlinePage);
      await offlinePage.getByRole('switch', { name: 'Show the text' }).click();
      await expect(offlinePage.locator('.est-history-text')).toBeVisible();
    },
  });
});

test('an older version restored and saved offline becomes a new version', async ({ page }) => {
  await buildHistory(page);

  await runOffline(page, {
    path: '/',
    async whileOffline(offlinePage) {
      await openSongFromSearch(offlinePage, 'Morning', SONG_TITLE);
      await historyFromReading(offlinePage);
      const before = await offlinePage.locator('.est-history-row').count();
      await restoreOldest(offlinePage);
      await expect(offlinePage.getByRole('dialog')).toBeVisible();
      await confirmSheet(offlinePage);
      await expect(offlinePage.getByRole('dialog')).toBeHidden();
      await expect(offlinePage.locator('.est-history-row')).toHaveCount(before + 1);
    },
  });
});
