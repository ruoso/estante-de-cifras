// e2e-web — workflow 15 against the compose stack on phone, tablet and computer
// (music.instruments; the .tji "workflow 15 on the three viewports: a tuning, a
// second instrument, switching from the header chip; axe"). From a fresh app
// with no sign-in — everything is the user's own, local and offline-first — the
// header instrument chip opens the roster; a second instrument is added from the
// catalogue on a tuning preset with a rename, and another via a custom §6 pitch
// list; switching from the chip re-derives the chip; and the voicing-rules panel
// opens. Axe runs at WCAG 2.1 AA on the roster, the add form and the rules panel
// (contrast runs in the real browser here). Each of the three viewport projects
// runs this spec (no testMatch filter, playwright.config.js).

import { test, expect } from '../lib/axe.js';
import { chip } from '../lib/journeys-core.js';
import { mockup } from '../lib/mockup.js';
import { startApp, openExampleBook, openSongFromSearch } from '../lib/journeys.js';
import {
  SONG,
  toSearch,
  addInstrument,
  closeInstruments,
  readingShapeNames,
} from '../lib/journeys-core.js';

// The roster "+" and the form submit are both named exactly "Add instrument";
// only one is on screen at a time, so an exact match stays unambiguous.
const addButton = (page) => page.getByRole('button', { name: 'Add instrument', exact: true });

test('set up instruments from the header chip, switch, and edit the rules', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);

  // The chip is present on every screen, showing the standard-guitar default.
  await expect(chip(page)).toContainText('Guitar');

  // Open the roster, and add an instrument on a tuning preset with a rename.
  await chip(page).click();
  await expect(page.getByRole('heading', { name: 'Instruments' })).toBeVisible();
  await mockup(page, 'W15-set-up-an-instrument', 1);
  await checkA11y(); // the roster

  await addButton(page).click();
  await expect(page.getByRole('heading', { name: 'Add instrument' })).toBeVisible();
  await mockup(page, 'W15-set-up-an-instrument', 2);
  await checkA11y(); // the add form

  await page.getByRole('button', { name: 'Drop D' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('My Drop D');
  await addButton(page).click();

  // Back on the roster, the named instrument is listed.
  await expect(page.getByRole('button', { name: /^Open My Drop D/ })).toBeVisible();

  // Add another via a CUSTOM pitch list (its §6 identity text).
  await addButton(page).click();
  await page.getByRole('button', { name: 'Custom…' }).click();
  await page.getByRole('textbox', { name: 'Custom tuning' }).fill('D4 G4 B4 D5');
  await addButton(page).click();
  await expect(page.getByRole('button', { name: /^Open .*D4 G4 B4 D5/ })).toBeVisible();

  // Switch the one in use: My Drop D became in use as the first instrument, so
  // open the custom one and use it — a real switch.
  await page.getByRole('button', { name: /^Open .*D4 G4 B4 D5/ }).click();
  await page.getByRole('button', { name: 'Use this instrument' }).click();

  // Open its voicing-rules panel and axe it.
  await page.getByRole('button', { name: /^Open .*D4 G4 B4 D5/ }).click();
  await page.getByRole('button', { name: 'Edit rules' }).click();
  await expect(page.getByRole('heading', { name: 'Voicing rules' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Root required' })).toBeVisible();
  await mockup(page, 'W15-set-up-an-instrument', 3);
  await checkA11y(); // the rules panel

  // Close the overlay (Escape dismisses it) and confirm the chip updated — it is
  // aria-hidden behind the open overlay, so it is read once the overlay closes.
  // The chip shows the one short label — a custom tuning reads "· Custom" — and
  // carries the pitches as its accessible description (shell.header_chrome).
  await page.keyboard.press('Escape');
  await expect(chip(page)).toHaveText('Guitar · Custom');
  await expect(chip(page)).toHaveAccessibleDescription(/D4 G4 B4 D5/);
});

test('removing the instrument in use asks first, and the app falls back to guitar (workflow 15 §Removing)', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);
  await addInstrument(page, { tuning: 'Drop D', name: 'My Drop D' });

  // Open it: its screen has the definition, the rules, my shapes and Remove.
  await page.getByRole('button', { name: /^Open My Drop D/ }).click();
  await expect(page.getByRole('heading', { name: 'My Drop D' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove instrument' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByRole('heading', { name: /^Remove My Drop D\?/ })).toBeVisible();
  await mockup(page, 'W15-set-up-an-instrument', 4);
  await checkA11y(); // the remove confirmation

  // Cancel keeps it.
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole('heading', { name: 'My Drop D' })).toBeVisible();

  // Confirm removes it; with none left the chip falls back to the standard guitar.
  await page.getByRole('button', { name: 'Remove instrument' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Open My Drop D/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(chip(page)).toContainText('Guitar');
  await expect(chip(page)).not.toContainText('My Drop D');

  // Still gone after a reload.
  await startApp(page);
  await expect(chip(page)).toContainText('Guitar');
});

test('switching the instrument in use changes the shapes the reading view draws (workflow 15 §Switching)', async ({
  page,
}) => {
  await openExampleBook(page);
  await openSongFromSearch(page, SONG.search, SONG.title);
  const onGuitar = await readingShapeNames(page);
  expect(onGuitar.length).toBeGreaterThan(0);

  // Add a ukulele from the chip: it becomes the one in use.
  await toSearch(page);
  await addInstrument(page, { catalogue: 'Ukulele', listed: 'Ukulele' });
  await closeInstruments(page);
  await expect(chip(page)).toContainText('Ukulele');

  await openSongFromSearch(page, SONG.search, SONG.title);
  const onUkulele = await readingShapeNames(page);
  expect(onUkulele).toHaveLength(onGuitar.length);
  expect(onUkulele).not.toEqual(onGuitar);

  // Removing the ukulele puts the guitar back in use, and re-derives the shapes.
  await toSearch(page);
  await chip(page).click();
  await page.getByRole('button', { name: /^Open Ukulele/ }).click();
  await expect(page.getByRole('button', { name: 'Remove instrument' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove instrument' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Open Ukulele/ })).toHaveCount(0);
  await closeInstruments(page);
  await expect(chip(page)).toContainText('Guitar');
  await openSongFromSearch(page, SONG.search, SONG.title);
  expect(await readingShapeNames(page)).toEqual(onGuitar);
});
