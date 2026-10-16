/**
 * e2e-web — setlists end to end on the three viewports (books.setlists,
 * workflow 12). The example book is seeded through the UI. The journeys:
 *   - build a setlist from a song (Add to setlist → New setlist…), add a second
 *     song, open it, edit an item's key and note, and save;
 *   - reorder by drag, and on the computer by keyboard (RAC drag-and-drop,
 *     DIRECTION §3.7 L430);
 *   - remove an item in the editor, save, and it is gone after a reload;
 *   - copy a song from another book into a setlist (Copy and add), saved;
 *   - delete a referenced song in the file view (Books → Files) to make a
 *     missing item, then point it at a song, save, and see it fixed after a
 *     reload;
 *   - rename a song a setlist uses in the file view: the setlist still opens it.
 * axe (WCAG 2.1 AA, contrast in a real browser) runs on each screen and overlay.
 *
 * Pins workflow 12 §Building one (L57-61), §Songs from another book (L38-40),
 * §Songs moved L83-85, and DIRECTION §3.7 L430. All song/setlist text is the
 * bundled example book's, written for the project.
 */
import { mockup } from '../lib/mockup.js';
import { test, expect } from '../lib/axe.js';
import { openExampleBook, openFiles, saveThroughSheet, startApp, gotoTab } from '../lib/journeys.js';
import {
  EXAMPLE_BOOK,
  addToSetlistFromSearch,
  addToNewSetlist,
  addToExistingSetlist,
  openSetlist,
  editSetlist,
  deleteSongInFiles,
  renameOpenFile,
  fileRow,
  saveAllChanges,
  leaveFiles,
} from '../lib/journeys-files.js';

const seedExample = openExampleBook;

test('build a setlist from songs, add a second, edit key and note, and save', async ({
  page,
  checkA11y,
}) => {
  await seedExample(page);

  // Add to setlist → New setlist… → name it. The dialog is axe-clean.
  await addToSetlistFromSearch(page, 'Morning', 'Morning on the Porch');
  await checkA11y();
  await page.getByRole('button', { name: 'New setlist…' }).click();
  await page.getByRole('textbox', { name: 'Setlist name' }).fill('Gig Night');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Add to setlist' })).toBeHidden();

  // Add a second song to the same (existing) setlist.
  await addToExistingSetlist(page, 'Ferry', 'The Ferry Line', 'Gig Night');

  // Open the setlist (read view, axe-clean) and enter the editor.
  await openSetlist(page, 'Gig Night');
  await checkA11y();
  await editSetlist(page);

  // Edit the first item's key and note, then save; the unsaved word appears and
  // clears.
  await page.getByRole('textbox', { name: 'Key for Morning on the Porch' }).fill('G');
  await page.getByRole('textbox', { name: 'Note for Morning on the Porch' }).fill('start gently');
  await expect(page.getByText('unsaved changes')).toBeVisible();
  await checkA11y(); // the editor
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('unsaved changes')).toBeHidden();
});

// A two-song setlist open in the editor: Morning on the Porch, The Ferry Line.
async function gigNight(page) {
  await seedExample(page);
  await addToNewSetlist(page, 'Morning', 'Morning on the Porch', 'Gig Night');
  await addToExistingSetlist(page, 'Ferry', 'The Ferry Line', 'Gig Night');
  await openSetlist(page, 'Gig Night');
  await editSetlist(page);
}

test('reorder a setlist by drag', async ({ page }) => {
  await gigNight(page);

  const names = () => page.locator('.setlist-edit-row .name');
  await expect(names().first()).toHaveText('Morning on the Porch');

  // Drag the first handle down past the second row (RAC pointer drag).
  const handles = page.getByRole('button', { name: 'Drag to reorder' });
  const from = await handles.nth(0).boundingBox();
  const to = await handles.nth(1).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height + 10, { steps: 10 });
  await page.mouse.up();

  await expect(names().first()).toHaveText('The Ferry Line');
});

test('reorder a setlist by keyboard on the computer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'computer', 'keyboard reorder runs on the computer viewport');
  await gigNight(page);

  const names = () => page.locator('.setlist-edit-row .name');
  await expect(names().first()).toHaveText('Morning on the Porch');

  // Pick up the first row with the keyboard, move it down, and drop it.
  await page.getByRole('button', { name: 'Drag to reorder' }).first().focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(names().first()).toHaveText('The Ferry Line');
});

test('removing an item in the setlist editor and saving drops it for good (audit P2 #11)', async ({
  page,
}) => {
  await gigNight(page);
  const names = () => page.locator('.setlist-edit-row .name');
  await expect(names()).toHaveText(['Morning on the Porch', 'The Ferry Line']);

  await page.getByRole('button', { name: 'Remove The Ferry Line from setlist' }).click();
  await expect(names()).toHaveText(['Morning on the Porch']);
  await expect(page.getByText('unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('unsaved changes')).toBeHidden();

  // Durable: after a reload the setlist has only the one song.
  await startApp(page);
  await openSetlist(page, 'Gig Night');
  await editSetlist(page);
  await expect(names()).toHaveText(['Morning on the Porch']);
});

test('copy a song from another book into a setlist (Copy and add), saved', async ({
  page,
  checkA11y,
}) => {
  await seedExample(page);

  // A setlist in the example book.
  await addToNewSetlist(page, 'Morning', 'Morning on the Porch', 'Gig Night');

  // A song in a second local book ("My songs"): with the example book already on
  // the shelf, the empty-shelf "Write a song" way-in is gone, so start the song
  // the way search offers when books exist — the Create row (new-song.spec.js).
  await gotoTab(page, 'Search');
  await page.getByRole('searchbox').fill('Harbour Lights');
  await page.getByRole('button', { name: /Create .Harbour Lights./ }).click();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(['# Harbour Lights', '', 'A quiet harbour tune', ''].join('\n'));
  await saveThroughSheet(page);

  // Add the My-songs song to the example book's setlist: a cross-book copy.
  await addToSetlistFromSearch(page, 'Harbour', 'Harbour Lights');
  await page.getByRole('button', { name: /Gig Night/ }).click();
  await expect(page.getByText(/This song will be copied into/)).toBeVisible();
  await checkA11y(); // the copy notice
  await mockup(page, 'W12-setlists', 3); // Add to setlist, a song from another book (tablet)
  await page.getByRole('button', { name: 'Copy and add' }).click();
  await expect(page.getByRole('heading', { name: 'Add to setlist' })).toBeHidden();

  // Open the setlist and save: the copy and the setlist change commit together.
  await openSetlist(page, 'Gig Night');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('unsaved changes')).toBeHidden();
  // Harbour Lights is now a song in the setlist.
  await expect(page.locator('.setlist-edit-row .name', { hasText: 'Harbour Lights' })).toBeVisible();
});

test('a deleted song becomes a missing item, pointed at another song and saved', async ({
  page,
  checkA11y,
}) => {
  await seedExample(page);

  // Delete a song the bundled setlist (a-short-set) points at, in the file view
  // (an unsaved working-copy removal — not relinked, so it goes missing).
  await deleteSongInFiles(page, EXAMPLE_BOOK, 'the-ferry-line.cifra.md');
  await leaveFiles(page);

  // Open the setlist: the item is missing, with its notice and a repoint action.
  await openSetlist(page, 'A Short Set');
  await expect(page.getByText(/is missing\./)).toBeVisible();
  await checkA11y(); // the missing notice

  // Point it at a present song via the in-book search.
  await page.getByRole('button', { name: 'Point it at a song' }).first().click();
  await page.getByRole('searchbox', { name: 'Search for a song' }).fill('Walking');
  await mockup(page, 'W12-setlists', 4); // a missing link being repointed (computer)
  await page.getByRole('button', { name: /walking-to-the-market/ }).first().click();
  await page.getByRole('button', { name: 'Point here' }).click();

  // The item is actually fixed: no missing notice or repoint action remains,
  // the change is an unsaved edit of the setlist, and saving it clears that.
  await expect(page.getByRole('button', { name: 'Point here' })).toBeHidden();
  await expect(page.getByText(/is missing\./)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Point it at a song' })).toHaveCount(0);
  await expect(page.getByText('unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('unsaved changes')).toBeHidden();

  // Durable: after a reload the setlist opens with nothing missing.
  await startApp(page);
  await openSetlist(page, 'A Short Set');
  await expect(page.getByText(/is missing\./)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Point it at a song' })).toHaveCount(0);
});

test('renaming a song a setlist uses keeps the setlist pointing at it (audit P2 #11, workflow 12 §Songs moved)', async ({
  page,
}) => {
  await seedExample(page);

  // Files → rename the Ferry Line (A Short Set's second item) → save.
  await openFiles(page, EXAMPLE_BOOK);
  await fileRow(page, 'the-ferry-line.cifra.md').click();
  await renameOpenFile(page, 'the-ferry-line.cifra.md', 'ferry-crossing');
  await saveAllChanges(page);
  await leaveFiles(page);

  // After a reload the setlist still opens it: nothing is missing, and Play
  // reaches The Ferry Line.
  await startApp(page);
  await openSetlist(page, 'A Short Set');
  await expect(page.getByText(/is missing\./)).toHaveCount(0);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Next song' }).click();
  await expect(page.getByRole('group', { name: 'The Ferry Line' })).toBeVisible();
});

// books.setlist_chrome — W12 phone #1 keeps the tab bar (Search · Books ·
// Setlists, Setlists on) under an open setlist; a tab press replaces the entry
// (routing Decision 4). Tablet and computer draw no rail or tab bar under it
// (W12 #3, #4): Back to the Setlists destination, whose rail reaches Search.
test('the tab bar stays under an open setlist on a phone; Search is a tap away', async ({
  page,
  checkA11y,
}, testInfo) => {
  await openExampleBook(page);
  await openSetlist(page, 'A Short Set');
  const heading = page.getByRole('heading', { level: 2, name: 'A Short Set' });

  if (testInfo.project.name === 'phone') {
    const tablist = page.getByRole('tablist', { name: 'Destinations' });
    await expect(tablist).toBeVisible();
    await expect(tablist).toBeInViewport();
    await expect(page.getByRole('tab', { name: 'Setlists' })).toHaveAttribute('aria-selected', 'true');
    await mockup(page, 'W12-setlists', 1, { note: 'tab bar' });
    await checkA11y();

    await page.getByRole('tab', { name: 'Search' }).click();
    await expect(page.getByRole('searchbox')).toBeVisible();
    await expect(heading).toBeHidden();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  } else {
    await expect(heading).toBeVisible();
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await checkA11y();

    await page.getByRole('button', { name: 'Back' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Setlists' })).toBeVisible();
    await gotoTab(page, 'Search');
    await expect(page.getByRole('searchbox')).toBeVisible();
  }
});
