/**
 * e2e-web — setlists end to end on the three viewports (books.setlists,
 * workflow 12). The example book is seeded through the UI. The journeys:
 *   - build a setlist from a song (Add to setlist → New setlist…), add a second
 *     song, open it, reorder by drag, edit an item's key and note, and save;
 *   - on the computer, reorder by keyboard (RAC drag-and-drop, DIRECTION §3.7
 *     L430);
 *   - copy a song from another book into a setlist (Copy and add), saved;
 *   - delete a referenced song in the file view to make a missing item, then
 *     point it at a song.
 * axe (WCAG 2.1 AA, contrast in a real browser) runs on each screen and overlay.
 *
 * Pins workflow 12 §Building one (L57-61), §Songs from another book (L38-40),
 * §Songs moved L83-85, and DIRECTION §3.7 L430. All song/setlist text is the
 * bundled example book's, written for the project.
 */
import { test, expect } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';

const EXAMPLE_BOOK_ID = 'local-example-book';

// Put the example book on the device and wait until its songs are indexed, at
// the search front door (the reading/arrange e2e pattern).
async function seedExample(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  const openExample = page.getByRole('button', { name: /Open the example book/ });
  const books = page.getByRole('heading', { name: 'Books' });
  await expect(async () => {
    if (await openExample.isVisible().catch(() => false)) {
      await openExample.click({ timeout: 2000 }).catch(() => {});
    }
    await expect(books).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByRole('button', { name: /Morning on the Porch/ }).first()).toBeVisible();
  await page.getByRole('searchbox').fill('');
}

// The Add-to-setlist icon on a song row in search (its aria-label carries the
// title). Search for the song first so the row is present.
async function addToSetlistFromSearch(page, query, title) {
  await page.getByRole('searchbox').fill(query);
  const addButton = page.getByRole('button', { name: `Add ${title} to a setlist` });
  await expect(addButton.first()).toBeVisible();
  await addButton.first().click();
  await expect(page.getByRole('heading', { name: 'Add to setlist' })).toBeVisible();
}

// Open the Setlists destination and open the named setlist.
async function openSetlist(page, name) {
  await page.getByRole('tab', { name: 'Setlists' }).click();
  const row = page.getByRole('button', { name: new RegExp(name) });
  await expect(row.first()).toBeVisible();
  await row.first().click();
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
}

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
  await addToSetlistFromSearch(page, 'Ferry', 'The Ferry Line');
  await page.getByRole('button', { name: /Gig Night/ }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add to setlist' })).toBeHidden();

  // Open the setlist (read view, axe-clean) and enter the editor.
  await openSetlist(page, 'Gig Night');
  await checkA11y();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('grid', { name: 'Songs · drag to reorder' })).toBeVisible();

  // Edit the first item's key and note, then save; the unsaved word appears and
  // clears.
  await page.getByRole('textbox', { name: 'Key for Morning on the Porch' }).fill('G');
  await page.getByRole('textbox', { name: 'Note for Morning on the Porch' }).fill('start gently');
  await expect(page.getByText('unsaved changes')).toBeVisible();
  await checkA11y(); // the editor
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('unsaved changes')).toBeHidden();
});

test('reorder a setlist by drag', async ({ page }) => {
  await seedExample(page);
  await addToSetlistFromSearch(page, 'Morning', 'Morning on the Porch');
  await page.getByRole('button', { name: 'New setlist…' }).click();
  await page.getByRole('textbox', { name: 'Setlist name' }).fill('Gig Night');
  await page.getByRole('button', { name: 'Create' }).click();
  await addToSetlistFromSearch(page, 'Ferry', 'The Ferry Line');
  await page.getByRole('button', { name: /Gig Night/ }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await openSetlist(page, 'Gig Night');
  await page.getByRole('button', { name: 'Edit' }).click();

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
  await seedExample(page);
  await addToSetlistFromSearch(page, 'Morning', 'Morning on the Porch');
  await page.getByRole('button', { name: 'New setlist…' }).click();
  await page.getByRole('textbox', { name: 'Setlist name' }).fill('Gig Night');
  await page.getByRole('button', { name: 'Create' }).click();
  await addToSetlistFromSearch(page, 'Ferry', 'The Ferry Line');
  await page.getByRole('button', { name: /Gig Night/ }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await openSetlist(page, 'Gig Night');
  await page.getByRole('button', { name: 'Edit' }).click();

  const names = () => page.locator('.setlist-edit-row .name');
  await expect(names().first()).toHaveText('Morning on the Porch');

  // Pick up the first row with the keyboard, move it down, and drop it.
  await page.getByRole('button', { name: 'Drag to reorder' }).first().focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(names().first()).toHaveText('The Ferry Line');
});

test('copy a song from another book into a setlist (Copy and add), saved', async ({
  page,
  checkA11y,
}) => {
  await seedExample(page);

  // A setlist in the example book.
  await addToSetlistFromSearch(page, 'Morning', 'Morning on the Porch');
  await page.getByRole('button', { name: 'New setlist…' }).click();
  await page.getByRole('textbox', { name: 'Setlist name' }).fill('Gig Night');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Add to setlist' })).toBeHidden();

  // A song in a second local book ("My songs"): with the example book already on
  // the shelf, the empty-shelf "Write a song" way-in is gone, so start the song
  // the way search offers when books exist — the Create row (new-song.spec.js).
  await page.getByRole('searchbox').fill('Harbour Lights');
  await page.getByRole('button', { name: /Create .Harbour Lights./ }).click();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(['# Harbour Lights', '', 'A quiet harbour tune', ''].join('\n'));
  await page.waitForTimeout(800); // let the debounced WRITE settle
  await page.getByRole('button', { name: 'Save' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill('Marina Souza');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();

  // Add the My-songs song to the example book's setlist: a cross-book copy.
  await addToSetlistFromSearch(page, 'Harbour', 'Harbour Lights');
  await page.getByRole('button', { name: /Gig Night/ }).click();
  await expect(page.getByText(/This song will be copied into/)).toBeVisible();
  await checkA11y(); // the copy notice
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

test('a deleted song becomes a missing item, pointed at another song', async ({
  page,
  checkA11y,
}) => {
  await seedExample(page);

  // Delete a song the bundled setlist (a-short-set) points at, in the file view
  // (an unsaved working-copy removal — not relinked, so it goes missing).
  await page.goto(`/#dev/files?book=${EXAMPLE_BOOK_ID}`);
  const ferryRow = page.getByRole('button', { name: /^the-ferry-line\.cifra\.md/ });
  await expect(ferryRow.first()).toBeVisible();
  await ferryRow.first().click();
  await page.getByRole('button', { name: 'Delete the-ferry-line.cifra.md' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  // Wait until the working-copy removal has landed (the change shows in the file
  // view) before reloading, so the setlist reads the deletion, not a race.
  await expect(page.getByText('1 file changed')).toBeVisible();

  // Open the setlist: the item is missing, with its notice and a repoint action.
  await page.goto('/');
  await openSetlist(page, 'A Short Set');
  await expect(page.getByText(/is missing\./)).toBeVisible();
  await checkA11y(); // the missing notice

  // Point it at a present song via the in-book search.
  await page.getByRole('button', { name: 'Point it at a song' }).first().click();
  await page.getByRole('searchbox', { name: 'Search for a song' }).fill('Walking');
  await page.getByRole('button', { name: /walking-to-the-market/ }).first().click();
  await page.getByRole('button', { name: 'Point here' }).click();
  // The missing badge is gone once the item points at a present song.
  await expect(page.getByRole('button', { name: 'Point here' })).toBeHidden();
});
