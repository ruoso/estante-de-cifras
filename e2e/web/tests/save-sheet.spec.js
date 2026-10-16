// save sheet (e2e-web) — saving, discarding and save-all against the compose
// stack, on the phone, tablet and computer projects (songs.save_sheet, workflow
// 4). A clean Save opens a sheet showing what changed in musical terms and a
// note prefilled from it; confirming commits the one file (or, for save all,
// every changed song in the book in one commit) and the song is no longer
// unsaved. Discard shows what would be lost and always asks. The first save ever
// asks once for a name; the second does not, nor does a save after a reload. A
// save made offline commits locally and persists. Axe runs at WCAG 2.1 AA on the
// sheet and the discard dialog.
// Every test starts at `/`: search -> song -> Edit, all through the real UI.
// Fixtures are the bundled example book — purpose-written songs.

import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { runOffline } from '../lib/offline.js';
import { openExampleBook, openSongInEditor, startApp, openSongFromSearch } from '../lib/journeys.js';
import { addSection, openSaveSheet, confirmSheet, backToSearch, editAgain } from '../lib/journeys-edit.js';

const SONG_TITLE = 'Morning on the Porch';
const FERRY_TITLE = 'The Ferry Line';

const openMorning = (page) => openSongInEditor(page, 'Morning', SONG_TITLE);

test('Save opens the sheet with what changed and a prefilled note; confirming saves and clears unsaved; axe-clean', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await openMorning(page);
  await addSection(page, 'Coda');
  await mockup(page, 'W04-edit-and-save', 1); // unsaved changes

  const sheet = await openSaveSheet(page);
  // What changed, and a note prefilled from the diff summary (not empty).
  await expect(sheet.getByText('What changed')).toBeVisible();
  await expect(sheet.getByRole('textbox', { name: 'Note' })).not.toHaveValue('');
  // The first save ever asks once for the author's name.
  await sheet.getByRole('textbox', { name: /Your name/ }).fill('Marina Souza');
  await mockup(page, 'W04-edit-and-save', 2); // the save sheet
  await checkA11y();

  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).toBeHidden();

  // Back on search the song is saved — no unsaved badge.
  await backToSearch(page);
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByText(SONG_TITLE).first()).toBeVisible();
  await expect(page.getByText('unsaved')).toHaveCount(0);
});

test('Discard shows what would be lost, always asks, and reverts the song; axe-clean', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await openMorning(page);
  await addSection(page, 'ThrowawayCoda');
  await expect(page.locator('.cm-content')).toContainText('ThrowawayCoda');

  await page.getByRole('button', { name: 'Discard changes' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/This would be lost/)).toBeVisible();
  // Tapped at once, inside the editor's write debounce: the confirm still lists
  // the edit — the same summary as save (songs.discard_summary).
  const row = dialog.locator('.diff .d').filter({ hasText: 'ThrowawayCoda' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('section added');
  await mockup(page, 'W04-edit-and-save', 3); // discard shows what would be lost
  await checkA11y();

  // The danger action reverts the working copy; the editor reloads it.
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.cm-content')).not.toContainText('ThrowawayCoda');
  await expect(page.locator('.cm-content')).toContainText('## Intro');

  // Nothing wrote the discarded text back: a reopened editor still lacks it.
  await page.getByRole('button', { name: 'Back' }).first().click();
  await openSongFromSearch(page, 'Morning', SONG_TITLE);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.locator('.cm-content')).toContainText('## Intro');
  await expect(page.locator('.cm-content')).not.toContainText('ThrowawayCoda');
});

test('Save all from a book section makes one commit over every changed song', async ({ page }) => {
  await openExampleBook(page);

  // Change two songs through the real UI, leaving each unsaved — all in one
  // session (no reload: the live unsaved flags exist only in this session).
  await openMorning(page);
  await addSection(page, 'CodaOne');
  await backToSearch(page);
  await openSongInEditor(page, 'Ferry', FERRY_TITLE);
  await addSection(page, 'CodaTwo');

  // Back to the search screen (same session); the example book's section
  // offers Save all now that two songs are unsaved.
  await backToSearch(page);
  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: /Save all changes in Example Book/ }).click();

  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  // Exact match: the prefilled save-all note also contains each title.
  await expect(sheet.getByText(SONG_TITLE, { exact: true })).toBeVisible();
  await expect(sheet.getByText(FERRY_TITLE, { exact: true })).toBeVisible();
  await sheet.getByRole('textbox', { name: /Your name/ }).fill('Marina Souza');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).toBeHidden();

  // Both songs are saved now — neither is unsaved any more.
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByText(SONG_TITLE).first()).toBeVisible();
  await expect(page.getByText('unsaved')).toHaveCount(0);
  await page.getByRole('searchbox').fill('Ferry');
  await expect(page.getByText(FERRY_TITLE).first()).toBeVisible();
  await expect(page.getByText('unsaved')).toHaveCount(0);
});

test('the first save asks for a name and the second does not', async ({ page }) => {
  await openExampleBook(page);
  await openMorning(page);

  // First save: the name is asked.
  await addSection(page, 'FirstCoda');
  const sheet = await openSaveSheet(page);
  await sheet.getByRole('textbox', { name: /Your name/ }).fill('Marina Souza');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).toBeHidden();

  // A save returns to reading; Edit again. The name is remembered (kept in the
  // home book), so the second save does not ask.
  await editAgain(page);
  await addSection(page, 'SecondCoda');
  const second = await openSaveSheet(page);
  await expect(second.getByRole('textbox', { name: /Your name/ })).toHaveCount(0);
  await second.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(second).toBeHidden();
});

// The name is kept in the home book, not in the page: after a reload the sheet
// still does not ask for it (workflow 4 §The save sheet: asked once, then kept).
test('a name kept in the home book is not asked again after a reload', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openMorning(page);
  await addSection(page, 'NamedCoda');
  const sheet = await openSaveSheet(page);
  await sheet.getByRole('textbox', { name: /Your name/ }).fill('Marina Souza');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).toBeHidden();

  await page.reload();
  await openMorning(page);
  await expect(page.locator('.cm-content')).toContainText('NamedCoda');

  await addSection(page, 'ReloadCoda');
  const second = await openSaveSheet(page);
  await expect(second.getByText('What changed')).toBeVisible();
  await expect(second.getByRole('textbox', { name: /Your name/ })).toHaveCount(0);
  await checkA11y();
  await second.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(second).toBeHidden();
});

test('a save made offline commits locally and persists', async ({ page }) => {
  // The example book is a local book, so its commit is always kept locally and
  // never pushed — the offline-commit behaviour a save over no network needs.
  await openExampleBook(page);

  await runOffline(page, {
    path: '/',
    async whileOffline(offlinePage) {
      await openSongInEditor(offlinePage, 'Morning', SONG_TITLE);
      await addSection(offlinePage, 'OfflineEdit');
      await openSaveSheet(offlinePage);
      await confirmSheet(offlinePage);
    },
  });

  // Back online and after a reload, the commit made offline persists: the
  // song is not unsaved and the editor opens on the saved section.
  await startApp(page);
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByText(SONG_TITLE).first()).toBeVisible();
  await expect(page.getByText('unsaved')).toHaveCount(0);
  await openSongFromSearch(page, 'Morning', SONG_TITLE);
  await editAgain(page);
  await expect(page.locator('.cm-content')).toContainText('OfflineEdit');
});
