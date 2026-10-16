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
import { overlaps } from '../lib/fit.js';
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

// The instruments as W15 draws them (music.instruments_layout; workflow 15
// §Where it sits): a full screen on every viewport, the computer's roster a rail
// beside the open instrument. Layout is pinned by measured boxes.
const instruments = (page) => page.getByRole('dialog', { name: 'Instruments' });

async function expectFullScreen(page) {
  const box = await instruments(page).boundingBox();
  const { width, height } = page.viewportSize();
  expect(Math.abs(box.x), 'the instruments start at the left edge').toBeLessThanOrEqual(1);
  expect(Math.abs(box.y), 'the instruments start at the top edge').toBeLessThanOrEqual(1);
  expect(Math.abs(box.width - width), 'the instruments are as wide as the viewport').toBeLessThanOrEqual(1);
  expect(Math.abs(box.height - height), 'the instruments are as tall as the viewport').toBeLessThanOrEqual(1);
}

test('set up instruments from the header chip, switch, and edit the rules', async ({
  page,
  checkA11y,
}, testInfo) => {
  const computer = testInfo.project.name === 'computer';
  await startApp(page);

  // The chip is present on every screen, showing the standard-guitar default.
  await expect(chip(page)).toContainText('Guitar');

  // Open the roster, and add an instrument on a tuning preset with a rename.
  await chip(page).click();
  await expect(page.getByRole('heading', { name: 'Instruments' })).toBeVisible();
  // The built-in standard guitar is listed from the first run, marked *in use* by
  // a word (workflow 15 §The roster, and switching; board W15 #1;
  // music.instruments_roster_default).
  const builtIn = page.getByRole('button', { name: /^Open Guitar/ });
  await expect(builtIn).toHaveCount(1);
  await expect(builtIn.getByText('in use', { exact: true })).toBeVisible();
  // A full screen, never a floating card (W15 #1, #4).
  await expectFullScreen(page);
  if (computer) {
    // The rail beside the in-use guitar's screen, the two side by side (W15 #4).
    const rail = instruments(page).locator('.pane.side');
    const heading = page.getByRole('heading', { name: /^Guitar \(6-string\)/ });
    await expect(rail.getByRole('button', { name: /^Open Guitar/ })).toBeVisible();
    await expect(heading).toBeVisible();
    const railBox = await rail.boundingBox();
    const headingBox = await heading.boundingBox();
    expect(railBox.x + railBox.width, 'the rail is left of the heading').toBeLessThanOrEqual(headingBox.x + 0.5);
    expect(overlaps(railBox, headingBox), 'the rail and the heading overlap').toBe(false);
  } else {
    // The roster leaves by the board's back arrow (W15 #1).
    await expect(instruments(page).getByRole('button', { name: 'Back' })).toBeVisible();
  }
  await mockup(page, 'W15-set-up-an-instrument', 1);
  await checkA11y(); // the roster

  await addButton(page).click();
  await expect(page.getByRole('heading', { name: 'Add instrument' })).toBeVisible();
  if (computer) {
    // The add form opens in the main pane, the rail still shown.
    await expect(page.getByRole('button', { name: /^Open Guitar/ })).toBeVisible();
  } else {
    // One way out: the bar's ✕ Cancel, no back arrow (W15 #2).
    await expect(instruments(page).getByRole('button', { name: 'Cancel' })).toHaveCount(1);
    await expect(instruments(page).getByRole('button', { name: 'Back' })).toHaveCount(0);
  }
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
  // Two columns from a tablet up — Rules beside Limits and Costs — and one on the
  // phone (W15 #3).
  const rootBox = await page.getByRole('switch', { name: 'Root required' }).boundingBox();
  const spanBox = await page.getByRole('textbox', { name: /^Max span/ }).boundingBox();
  if (testInfo.project.name === 'phone') {
    const lastRule = await page.getByRole('switch').last().boundingBox();
    expect(spanBox.y, 'Max span is below the last rule').toBeGreaterThanOrEqual(lastRule.y + lastRule.height);
  } else {
    // The switch role sits on RAC's visually hidden 1px input, whose box is not
    // where the toggle is drawn; the rows each control sits in are what line up.
    const row = (control) =>
      control.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " row ")][1]');
    const rootRowBox = await row(page.getByRole('switch', { name: 'Root required' })).boundingBox();
    const spanRowBox = await row(page.getByRole('textbox', { name: /^Max span/ })).boundingBox();
    expect(Math.abs(spanRowBox.y - rootRowBox.y), 'Root required and Max span share a top').toBeLessThanOrEqual(4);
    expect(spanBox.x, 'Max span is right of Root required').toBeGreaterThan(rootBox.x + rootBox.width);
  }
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
}, testInfo) => {
  await startApp(page);
  await addInstrument(page, { tuning: 'Drop D', name: 'My Drop D' });

  // Open it: its screen has the definition, the rules, my shapes and Remove.
  await page.getByRole('button', { name: /^Open My Drop D/ }).click();
  await expect(page.getByRole('heading', { name: 'My Drop D' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove instrument' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByRole('heading', { name: /^Remove My Drop D\?/ })).toBeVisible();
  // With no shapes saved it names only the variations (workflow 15 §Removing).
  await expect(confirm).toContainText('The song variations in use for');
  await expect(confirm).not.toContainText('0 saved shape');
  if (testInfo.project.name === 'computer') {
    // The rail stays beside My Drop D's screen under the centred confirm (W15
    // #4). The open alertdialog aria-hides what is under it, so these are found
    // by their place, not their role.
    await expect(page.locator('.pane.side .row', { hasText: /^Guitar/ })).toBeVisible();
    await expect(page.locator('.pane.main .appbar .title', { hasText: 'My Drop D' })).toBeVisible();
  }
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
  // The fallback is listed: the built-in guitar's row, *in use*.
  const fallback = page.getByRole('button', { name: /^Open Guitar/ });
  await expect(fallback).toHaveCount(1);
  await expect(fallback.getByText('in use', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  // The screen underneath is as it was: its chip is back, reading the guitar.
  await expect(chip(page)).toBeVisible();
  await expect(chip(page)).toHaveText('Guitar');
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
