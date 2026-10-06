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
import { waitForServiceWorker } from '../lib/offline.js';

const chip = (page) => page.getByRole('button', { name: /change instrument/ });
// The roster "+" and the form submit are both named exactly "Add instrument";
// only one is on screen at a time, so an exact match stays unambiguous.
const addButton = (page) => page.getByRole('button', { name: 'Add instrument', exact: true });

test('set up instruments from the header chip, switch, and edit the rules', async ({
  page,
  checkA11y,
}) => {
  await page.goto('/');
  await waitForServiceWorker(page);

  // The chip is present on every screen, showing the standard-guitar default.
  await expect(chip(page)).toContainText('Guitar');

  // Open the roster, and add an instrument on a tuning preset with a rename.
  await chip(page).click();
  await expect(page.getByRole('heading', { name: 'Instruments' })).toBeVisible();
  await checkA11y(); // the roster

  await addButton(page).click();
  await expect(page.getByRole('heading', { name: 'Add instrument' })).toBeVisible();
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
  await checkA11y(); // the rules panel

  // Close the overlay (Escape dismisses it) and confirm the chip updated — it is
  // aria-hidden behind the open overlay, so it is read once the overlay closes.
  await page.keyboard.press('Escape');
  await expect(chip(page)).toContainText('D4 G4 B4 D5');
});
