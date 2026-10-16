// Journeys for the `core` group of specs (search, reading, arrange, wizard,
// instruments, explorer): steps that more than one of them needs and that
// lib/journeys.js does not have. Real UI only, like journeys.js.

import { expect } from '@playwright/test';
import { settleEdits, saveThroughSheet } from './journeys.js';

export const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const SONG = { search: 'Morning', title: 'Morning on the Porch' };

// ---- navigation ----------------------------------------------------------------

// Leave an open song / explorer for the search screen, on any viewport: where
// search sits beside it (the computer's song, the wide explorer) stay; else Back.
export async function toSearch(page) {
  const searchbox = page.getByRole('searchbox');
  const tab = page.getByRole('tab', { name: 'Search' });
  for (let i = 0; i < 4; i++) {
    if (await searchbox.first().isVisible().catch(() => false)) return;
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
    } else {
      await page.getByRole('button', { name: 'Back' }).first().click();
    }
    await page.waitForTimeout(200);
  }
  await expect(searchbox.first()).toBeVisible();
}

// ---- arrange (workflow 5) -----------------------------------------------------

// From the reading view: the narrow action bar's Arrange, or the wide "More"
// overflow's "Arrange for …".
export async function enterArrange(page) {
  const direct = page.getByRole('button', { name: 'Arrange', exact: true });
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
  } else {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: /^Arrange for/ }).click();
  }
  await expect(page.getByText(/Arranging ·/)).toBeVisible();
}

// A chord in the arrange chart: a button named by its spoken chord.
export const arrangeChord = (page) => page.locator('.chart').getByRole('button').first();
export const picker = (page) => page.getByRole('dialog');
export const candidate = (scope) => scope.getByRole('button', { name: /^Choose \S+,/ }).first();
// The strip shows a word under every shape the song does not choose itself
// ("default", "your shape"); a song's own chosen shape has none.
export const unchosenWords = (page) => page.locator('.arrange-shapes .chord-diagram__who');

// How many shapes the strip marks as not chosen by the song, once there are any.
export async function countUnchosen(page) {
  await expect(unchosenWords(page).first()).toBeVisible();
  return unchosenWords(page).count();
}

// Add an EMPTY variation in arrange (not a copy), and wait for it to be in use.
export async function addEmptyVariation(page, name) {
  await page.getByRole('button', { name: 'Variations' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a variation' });
  await dialog.getByRole('textbox', { name: 'Name for this variation' }).fill(name);
  const copy = dialog.getByRole('checkbox');
  if (await copy.count()) await copy.uncheck();
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name })).toBeVisible();
}

// Arrange's Done, then the reading view's Edit, then the editor's Save → the
// save sheet. `inspect(sheet)` can assert on what the sheet lists before it is
// confirmed. Returns once the commit landed (the sheet closed).
export async function saveArrangementThroughSheet(page, { note, name = 'Marina Souza', inspect } = {}) {
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.locator('.cm-content')).toBeVisible();
  await settleEdits(page);
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill(name);
  if (inspect) await inspect(sheet);
  if (note !== undefined) await sheet.getByRole('textbox', { name: /Note/ }).fill(note);
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).toBeHidden();
}

// ---- instruments (workflow 15) -------------------------------------------------

export const chip = (page) => page.getByRole('button', { name: /change instrument/ });
// The roster "+" and the add form's submit are both exactly "Add instrument".
export const addInstrumentButton = (page) =>
  page.getByRole('button', { name: 'Add instrument', exact: true });

// Header chip → roster → Add instrument. `catalogue` picks an instrument kind
// ("Ukulele"), `tuning` a preset button ("Drop D"), `name` renames it. Lands
// back on the roster with the instrument listed (`listed` is the text its row
// starts with after "Open"); the first one added is in use.
export async function addInstrument(page, { catalogue, tuning, name, listed } = {}) {
  await chip(page).click();
  await expect(page.getByRole('heading', { name: 'Instruments' })).toBeVisible();
  await addInstrumentButton(page).click();
  await expect(page.getByRole('heading', { name: 'Add instrument' })).toBeVisible();
  if (catalogue) {
    await page.locator('.select-trigger').click();
    await page.getByRole('option', { name: catalogue }).click();
  }
  if (tuning) await page.getByRole('button', { name: tuning, exact: true }).click();
  if (name) await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await addInstrumentButton(page).click();
  await expect(
    page.getByRole('button', { name: new RegExp(`^Open ${escape(listed ?? name ?? '')}`) }).first(),
  ).toBeVisible();
}

// Close the instruments overlay (Escape) and wait for the chip to be reachable.
export async function closeInstruments(page) {
  const scrim = page.locator('.instr-scrim');
  for (let i = 0; i < 3 && (await scrim.count()) > 0; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  await expect(scrim).toHaveCount(0);
  await expect(chip(page)).toBeVisible();
}

// ---- the voicing wizard (workflow 5) ------------------------------------------

// From arrange: Run the wizard, choose a policy and preview it (the plan's
// Write the plan button shows).
export async function toPreview(page, name = 'The smoothest path') {
  await page.getByRole('button', { name: 'Run the wizard' }).click();
  const policy = page.getByRole('button', { name });
  await expect(policy).toBeVisible();
  await policy.click();
  await page.getByRole('button', { name: 'See the plan' }).click();
  await expect(page.getByRole('button', { name: 'Write the plan' })).toBeVisible();
}

// ---- the chord explorer (workflow 16) ---------------------------------------------

// From search, type a chord and open the explorer through its row.
export async function openExplorerFor(page, chord) {
  await page.getByRole('searchbox').fill(chord);
  await page.getByRole('button', { name: new RegExp(`^Explore ${escape(chord)} on your`) }).click();
  await expect(page.getByRole('textbox', { name: 'Chord' })).toHaveValue(chord);
}

// ---- writing a song (workflow 3) -------------------------------------------------

// From search with no match: Create "title" (a song in My songs), a chord line
// in the template's empty fence, and the first save. Ends back on search.
export async function createSongFromSearch(page, title, chords = 'Am G C') {
  await page.getByRole('searchbox').fill(title);
  await page.getByRole('button', { name: new RegExp(`^Create .${escape(title)}.`) }).click();
  const content = page.locator('.cm-content');
  await expect(content).toContainText(title);
  await content.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText(chords);
  await saveThroughSheet(page);
}

// The shapes drawn in the reading view, as their spoken descriptions (a read).
export async function readingShapeNames(page) {
  await expect(page.locator('.reading-shapes .chord-diagram').first()).toBeVisible();
  return page
    .locator('.reading-shapes .chord-diagram [role="img"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
}
