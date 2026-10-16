// edit-and-save (e2e-web) — workflow 4 end to end through the real UI: a song
// found by search, opened, edited from the reading view's Edit, saved through
// the save sheet, and still changed after a reload. Against the compose stack
// on the phone/tablet/computer projects, with axe at WCAG 2.1 AA on the editor
// and the save sheet. Built only from lib/journeys.js (no dev mounts, nothing
// injected): the reference pattern for the other specs.

import { test, expect } from '../lib/axe.js';
import {
  openExampleBook,
  openSongInEditor,
  openSongFromSearch,
  typeAtEndOfLine,
  saveThroughSheet,
  startApp,
} from '../lib/journeys.js';
import { mockup } from '../lib/mockup.js';

const INTRO = 'G | C | G | D';
const ADDED = ' | Em';

test('a song edited from the reading view saves and is still changed after a reload (workflow 4)', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await openSongInEditor(page, 'Morning', 'Morning on the Porch');

  await typeAtEndOfLine(page, INTRO, ADDED);
  await expect(page.locator('.cm-content')).toContainText(`${INTRO}${ADDED}`);
  await checkA11y(); // the editor host with an edit, this viewport
  await mockup(page, 'W04-edit-and-save', 1);

  await saveThroughSheet(page, {
    note: 'Add Em to the intro',
    onSheet: async () => {
      await mockup(page, 'W04-edit-and-save', 2);
      await mockup(page, 'W04-edit-and-save', 4, { note: 'the first save asks your name' });
    },
  });

  // A save returns to reading the song, which shows the new chord.
  await expect(page.getByRole('group', { name: 'Morning on the Porch' }).first()).toBeVisible();

  // Durable: after a reload the saved text is what the editor opens.
  await startApp(page);
  await openSongInEditor(page, 'Morning', 'Morning on the Porch');
  await expect(page.locator('.cm-content')).toContainText(`${INTRO}${ADDED}`);
});

test('Back from the editor keeps the unsaved edit, and Discard reverts it (workflow 4 §Discarding)', async ({
  page,
}) => {
  await openExampleBook(page);
  await openSongInEditor(page, 'Morning', 'Morning on the Porch');
  await typeAtEndOfLine(page, INTRO, ADDED);

  await page.getByRole('button', { name: 'Back' }).first().click();
  await openSongFromSearch(page, 'Morning', 'Morning on the Porch');
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.locator('.cm-content')).toContainText(`${INTRO}${ADDED}`);

  await page.getByRole('button', { name: 'Discard changes' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText(/This would be lost/)).toBeVisible();
  // The confirm lists the typed change (flushed by Back's unmount): the added
  // chord reads at its section (render-change.js; songs.discard_summary).
  const row = confirm.locator('.diff .d').filter({ hasText: 'Em added' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Intro');
  await mockup(page, 'W04-edit-and-save', 3);
  await confirm.getByRole('button', { name: 'Discard changes' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.locator('.cm-content')).not.toContainText(`${INTRO}${ADDED}`);
  await expect(page.locator('.cm-content')).toContainText(INTRO);
});
