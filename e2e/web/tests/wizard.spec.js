import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';
import { mockup } from '../lib/mockup.js';
import { openExampleBook, openSongFromSearch, startApp, settleEdits } from '../lib/journeys.js';
import {
  SONG,
  enterArrange,
  unchosenWords,
  addEmptyVariation,
  saveArrangementThroughSheet,
  toPreview,
} from '../lib/journeys-core.js';

const openSong = (page) => openSongFromSearch(page, SONG.search, SONG.title);

// e2e-web — running the voicing wizard end to end on the three viewports
// (songs.wizard_ui, workflow 5). The example book is seeded through the UI, a
// song is opened from search, arrange is entered from the reading view, and
// **Run the wizard** opens the wizard: a policy is chosen, the plan previewed,
// and written into a new variation — with axe at WCAG 2.1 AA on the wizard and
// the arrange screen. Then: into a new variation first / over this one second,
// and the fresh-variation shortcut; and the whole run offline. The example song
// already has a guitar voicing block, so the in-use variation has choices and
// the new/over question is offered. phone is the narrow screen; tablet and
// computer are the wide side-by-side. Pins workflow 5 L64-72; the .tji e2e
// clause; offline-first.

const writePlan = (page) => page.getByRole('button', { name: 'Write the plan' });

test('runs the wizard into a new variation; the variation reads back in arrange', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);

  await toPreview(page);
  // The example song's guitar block already has choices, so the plan is offered
  // into a new variation first.
  await expect(page.getByRole('radio', { name: /Into a new variation/ })).toBeChecked();
  await mockup(page, 'W05-arrange', 4);
  await checkA11y(); // the wizard, at its preview + plan-ready state

  await page.getByRole('textbox', { name: 'Name for this variation' }).fill('Up the neck');
  await writePlan(page).click();

  // Back in arrange: the variation selector now shows, with the new one in use,
  // and the shapes strip reads the plan back.
  await expect(page.getByText(/Arranging ·/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Variation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Up the neck' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Shapes' })).toBeVisible();
  await checkA11y(); // the arrange screen after the wizard

  // Saved through the save sheet (Done, Edit, Save) and durable: after a reload
  // the variation is in the song and every chord in it has a chosen shape.
  await saveArrangementThroughSheet(page, {
    note: 'Wizard plan',
    inspect: async (sheet) => {
      await expect(sheet).toContainText('Voicings');
    },
  });
  await startApp(page);
  await openSong(page);
  await enterArrange(page);
  await page.getByRole('group', { name: 'Variation' }).getByRole('button', { name: 'Up the neck' }).click();
  await expect(page.getByRole('region', { name: 'Shapes' })).toBeVisible();
  await expect(unchosenWords(page)).toHaveCount(0);
});

test('offers into a new variation first and over this one second; a fresh variation writes straight in', async ({ page }) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);

  // With choices in the in-use variation, both options are offered, new first.
  await toPreview(page);
  await expect(page.getByRole('radio', { name: /Into a new variation/ })).toBeChecked();
  const over = page.getByRole('radio', { name: /Over Default/ });
  await expect(over).toBeVisible();

  // Over this one replaces the in-use variation's shapes and returns to arrange.
  await over.click();
  await writePlan(page).click();
  await expect(page.getByText(/Arranging ·/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Shapes' })).toBeVisible();

  // A fresh variation with no choices: add an empty one in arrange (not a copy
  // of the one in use), then the wizard writes straight in with no new/over
  // question.
  await addEmptyVariation(page, 'Blank');

  await toPreview(page, 'Down at the nut');
  await expect(page.getByRole('radio', { name: /Into a new variation/ })).toBeHidden();
  await writePlan(page).click();
  await expect(page.getByText(/Arranging ·/)).toBeVisible();
});

test('runs the wizard offline; the plan is in the working copy after an offline reload', async ({ page }) => {
  await openExampleBook(page);
  await expect(page.getByRole('searchbox')).toBeVisible();

  await runOffline(page, {
    path: '/',
    async whileOffline(offlinePage) {
      await waitForServiceWorker(offlinePage);
      await openSong(offlinePage);
      await enterArrange(offlinePage);

      await toPreview(offlinePage);
      await offlinePage.getByRole('textbox', { name: 'Name for this variation' }).fill('Offline plan');
      await writePlan(offlinePage).click();

      // The whole run and the write to the working copy succeed offline.
      await expect(offlinePage.getByText(/Arranging ·/)).toBeVisible();
      await expect(offlinePage.getByRole('button', { name: 'Offline plan' })).toBeVisible();

      // The plan is on the device: it is still there after a reload, offline.
      await settleEdits(offlinePage);
      await offlinePage.reload();
      await waitForServiceWorker(offlinePage);
      await openSong(offlinePage);
      await enterArrange(offlinePage);
      await offlinePage.getByRole('group', { name: 'Variation' }).getByRole('button', { name: 'Offline plan' }).click();
      await expect(unchosenWords(offlinePage)).toHaveCount(0);
    },
  });
});
