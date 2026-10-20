// empty song (e2e-web) — a new song saved untouched from the template reads as
// its empty state, against the compose stack, on the phone, tablet and computer
// projects (songs.empty_states; workflow 2 §Nothing written yet, workflow 3 — a
// new song saved untouched). The reading view shows *Nothing written in this
// song yet.* in place of the chart, with no section name, and the notice's own
// Edit opens the editor on the song. Axe at WCAG 2.1 AA on that state. Real UI
// only; the title is written for the purpose. No mockup() frame: the
// Review-polish board is not in the frame list (the refinement's Decision 4).

import { test, expect } from '../lib/axe.js';
import { startApp, openSongFromSearch, saveThroughSheet } from '../lib/journeys.js';

test('a song saved untouched from the template reads as "Nothing written in this song yet." and its Edit opens the editor', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);

  // Create "Pebble Road" from search: the template, titled with the query.
  await page.getByRole('searchbox').fill('Pebble Road');
  await page.getByRole('button', { name: /Create .Pebble Road./ }).click();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await expect(content).toContainText('Pebble Road');

  // Save it untouched (songs.save_empty_message: an untouched save commits).
  await saveThroughSheet(page);
  // Back on search, the saved song replaces the Create row once the shelf
  // catches up; wait for its row so the search below opens it, not Create.
  await page.getByRole('searchbox').first().fill('Pebble Road');
  await expect(page.getByRole('button', { name: /^Pebble Road/ }).first()).toBeVisible();

  await openSongFromSearch(page, 'Pebble Road', 'Pebble Road');
  const sheet = page.getByRole('group', { name: 'Pebble Road' }).first();
  await expect(sheet.getByText('Nothing written in this song yet.')).toBeVisible();
  // No section name drawn: not *Intro*, nor any other.
  await expect(sheet).not.toContainText('Intro');
  await expect(page.locator('.reading-sheet .sec-name')).toHaveCount(0);
  await checkA11y();

  // The notice's Edit (not the toolbar's) opens the editor on the song.
  await sheet.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('.cm-content')).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('Pebble Road');
});
