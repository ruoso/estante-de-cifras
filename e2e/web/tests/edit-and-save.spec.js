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
  settleEdits,
  saveThroughSheet,
  startApp,
} from '../lib/journeys.js';
import { mockup } from '../lib/mockup.js';
import { expectFits } from '../lib/fit.js';

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

// songs.editor_chrome — the editor host as the W04 board draws it, per device.
// Pins W04#1-4 and workflow 4 §Editing, §Saving (as edited): the header names
// the song by its title as the text has it now and carries Save; the phone's
// *unsaved changes · Kept on this device* strip; where the save sits.
test('the editor chrome as drawn: the header, the unsaved strip and where the save sits', async ({
  page,
  checkA11y,
}, testInfo) => {
  const device = testInfo.project.name;
  await openExampleBook(page);
  await openSongInEditor(page, 'Morning', 'Morning on the Porch');
  await typeAtEndOfLine(page, INTRO, ADDED);
  await settleEdits(page);

  const bar = page.locator('.editor-chrome > .appbar');
  const title = bar.locator('.title');
  const save = bar.getByRole('button', { name: 'Save', exact: true });
  await expect(title).toHaveText('Morning on the Porch');
  await expect(save).toBeVisible();

  if (device === 'phone') {
    // Back · title · Save: the title whole, Discard not in the bar.
    await expectFits(page, { whole: [title], sentences: [title] });
    await expect(bar.getByRole('button', { name: 'Discard changes' })).toHaveCount(0);
    const strip = page.getByRole('status').filter({ hasText: 'Kept on this device' });
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('unsaved changes');
    const bottom = page.locator('.editor-chrome-bottom');
    await expect(bottom.getByRole('button', { name: 'Add section' })).toBeVisible();
    await expect(bottom.getByRole('button', { name: 'Discard changes' })).toBeVisible();
    await mockup(page, 'W04-edit-and-save', 1);

    await save.click();
    const sheet = page.getByRole('dialog');
    await expect(page.locator('.sheet')).toBeVisible();
    await expect(sheet).toBeVisible();
    await mockup(page, 'W04-edit-and-save', 2);
    await checkA11y(); // the sheet open
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet).toBeHidden();
  } else if (device === 'tablet') {
    await expect(bar.getByText('unsaved changes', { exact: true })).toBeVisible();
    await expect(page.getByText('Kept on this device')).toHaveCount(0);
    await bar.getByRole('button', { name: 'Discard changes' }).click();
    const confirm = page.getByRole('dialog');
    await expect(page.locator('.scrim.center .dialog')).toBeVisible();
    await mockup(page, 'W04-edit-and-save', 3);
    await confirm.getByRole('button', { name: 'Keep editing' }).click();
    await expect(confirm).toBeHidden();

    await save.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('.scrim.center .dialog')).toBeVisible();
    await checkA11y(); // the dialog open
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  } else {
    // The Unsaved pane lists the song, selected.
    const pane = page.getByRole('region', { name: 'Unsaved' });
    const row = pane.getByRole('row').filter({ hasText: 'Morning on the Porch' });
    await expect(row).toHaveAttribute('aria-selected', 'true');

    // Save opens the panel beside the editor, not over it.
    await save.click();
    const panel = page.getByRole('region', { name: 'Save Morning on the Porch' });
    await expect(panel).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const editorBox = await page.locator('.edit-song-main').boundingBox();
    const panelBox = await panel.boundingBox();
    expect(panelBox.x).toBeGreaterThanOrEqual(editorBox.x + editorBox.width - 1);
    await mockup(page, 'W04-edit-and-save', 4, { note: 'the save panel' });
    await checkA11y(); // the panel open
    await panel.getByRole('button', { name: 'Cancel' }).click();
    await expect(panel).toBeHidden();
  }

  // Rename the song in its heading: the header follows the text.
  await typeAtEndOfLine(page, '# Morning on the Porch', ' Again');
  await expect(title).toHaveText('Morning on the Porch Again');

  await saveThroughSheet(page, {
    note: 'Add Em to the intro, and rename',
    onSheet: async (sheet) => {
      await expect(sheet.getByRole('heading', { name: 'Save Morning on the Porch Again' })).toBeVisible();
      await checkA11y(); // the save surface open, this viewport
    },
  });
  // Saved: the mark is gone, the song reads under its new title.
  await expect(page.getByText('unsaved changes', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Morning on the Porch Again' }).first()).toBeVisible();
  await checkA11y(); // after the save
});

// W04#4 L163-168: on a computer the Unsaved pane holds every song with unsaved
// changes, a step away from each other. Runs on every project: on the phone and
// the tablet it checks there is no such pane.
test('on a computer, the Unsaved pane moves between two unsaved songs', async ({ page, checkA11y }, testInfo) => {
  const computer = testInfo.project.name === 'computer';
  await openExampleBook(page);
  await openSongInEditor(page, 'Morning', 'Morning on the Porch');
  await typeAtEndOfLine(page, INTRO, ADDED);
  await settleEdits(page);
  await page.getByRole('button', { name: 'Back' }).first().click();

  const WALKING_INTRO = 'G | Em | C | D';
  await openSongInEditor(page, 'Walking', 'Walking to the Market');
  await typeAtEndOfLine(page, WALKING_INTRO, ' | G');
  await settleEdits(page);

  const pane = page.getByRole('region', { name: 'Unsaved' });
  if (!computer) {
    await expect(page.locator('.cm-content')).toBeVisible();
    await expect(pane).toHaveCount(0);
    await checkA11y();
    return;
  }

  const walking = pane.getByRole('row').filter({ hasText: 'Walking to the Market' });
  const morning = pane.getByRole('row').filter({ hasText: 'Morning on the Porch' });
  await expect(walking).toHaveAttribute('aria-selected', 'true');
  await expect(morning).toBeVisible();
  await expect(morning).toContainText('unsaved');
  await checkA11y(); // the pane with both

  // Choose the other one: its editor opens, its edit still there.
  await morning.click();
  await expect(page.locator('.editor-chrome > .appbar .title')).toHaveText('Morning on the Porch');
  await expect(page.locator('.cm-content')).toContainText(`${INTRO}${ADDED}`);
  await expect(pane.getByRole('row').filter({ hasText: 'Morning on the Porch' })).toHaveAttribute('aria-selected', 'true');
  await expect(pane.getByRole('row').filter({ hasText: 'Walking to the Market' })).toBeVisible();
  await checkA11y();
});
