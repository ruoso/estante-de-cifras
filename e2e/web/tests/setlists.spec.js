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
 *   - rename a song a setlist uses in the file view: the setlist still opens it;
 *   - Add song in the editor marks a song already in the setlist, in words with
 *     its places, and still adds it (books.setlist_picker_fixes);
 *   - a new setlist reads *not saved yet* until saved, and Done leaves editing
 *     keeping the change (books.setlist_done);
 *   - a setlist made from the Setlists tab opens in its editor; with two books
 *     it asks which; one made from Add to setlist says the song is in it, and
 *     Open setlist opens it (books.setlist_making).
 * axe (WCAG 2.1 AA, contrast in a real browser) runs on each screen and overlay.
 *
 * Pins workflow 12 §Building one (L57-61), §Songs from another book (L38-40),
 * §Songs moved L83-85, and DIRECTION §3.7 L430. All song/setlist text is the
 * bundled example book's, written for the project.
 */
import { mockup } from '../lib/mockup.js';
import { test, expect } from '../lib/axe.js';
import {
  openExampleBook,
  openFiles,
  openSongFromSearch,
  saveThroughSheet,
  startApp,
  gotoTab,
} from '../lib/journeys.js';
import {
  EXAMPLE_BOOK,
  addToSetlistFromSearch,
  addToNewSetlist,
  addToNewSetlistFromSong,
  addToExistingSetlist,
  newSetlistFromTab,
  openSetlist,
  editSetlist,
  addSongInEditor,
  deleteSongInFiles,
  renameOpenFile,
  fileRow,
  saveAllChanges,
  leaveFiles,
} from '../lib/journeys-files.js';

const seedExample = openExampleBook;

// W12 tablet #3: a dialog's parts are spaced by the dialog's gap (16px at the
// default density). jsdom has no layout, so the gap is measured here, between
// each part's bottom and the next part's top, in the order given.
async function expectSpacedParts(parts) {
  const boxes = [];
  for (const part of parts) boxes.push(await part.boundingBox());
  for (let i = 1; i < boxes.length; i += 1) {
    expect(boxes[i].y - (boxes[i - 1].y + boxes[i - 1].height)).toBeGreaterThanOrEqual(12);
  }
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
  // The New-setlist dialog spaces its heading, field and actions (W12#3).
  const nameForm = page.locator('form.setlist-name-form');
  await expectSpacedParts([
    nameForm.getByRole('heading', { name: 'New setlist' }),
    nameForm.locator('.field'),
    nameForm.locator('.actions'),
  ]);
  await page.getByRole('textbox', { name: 'Setlist name' }).fill('Gig Night');
  await page.getByRole('button', { name: 'Create' }).click();
  // The picker stays and says where the song went (books.setlist_making).
  await expect(page.getByRole('status').filter({ hasText: 'Morning on the Porch is in Gig Night.' })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add to setlist' })).toBeHidden();

  // Add a second song to the same (existing) setlist.
  await addToExistingSetlist(page, 'Ferry', 'The Ferry Line', 'Gig Night');

  // Open the setlist (read view, axe-clean) and enter the editor.
  await openSetlist(page, 'Gig Night');
  await checkA11y();
  await editSetlist(page);

  // Edit the first item's key and note, then save; the status word — *not saved
  // yet*, the setlist never having been saved (books.setlist_done) — clears.
  await page.getByRole('textbox', { name: 'Key for Morning on the Porch' }).fill('G');
  await page.getByRole('textbox', { name: 'Note for Morning on the Porch' }).fill('start gently');
  await expect(page.getByText('not saved yet')).toBeVisible();
  await checkA11y(); // the editor
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('not saved yet')).toBeHidden();
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

// Workflow 12 §Building one (books.setlist_picker_fixes Constraints 1-3): the
// editor's in-book picker says a song is already in the setlist, with its
// places, and a setlist may still come back to it.
test('Add song in the editor marks a song already in the setlist', async ({ page, checkA11y }) => {
  await gigNight(page);
  const names = () => page.locator('.setlist-edit-row .name');
  await expect(names()).toHaveText(['Morning on the Porch', 'The Ferry Line']);

  await addSongInEditor(page, 'Morning');
  const marked = page.getByRole('button', { name: /Morning on the Porch.*Already in this setlist · 1/ });
  await expect(marked).toBeVisible();
  await expect(marked).toContainText('Already in this setlist · 1');
  await checkA11y(); // the picker with a marked row

  await marked.click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(names()).toHaveText(['Morning on the Porch', 'The Ferry Line', 'Morning on the Porch']);
  await expect(page.locator('.setlist-edit-row .setlist-num')).toHaveText(['1', '2', '3']);
  await expect(page.getByText('not saved yet')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('not saved yet')).toBeHidden();
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
  await expect(page.getByText('not saved yet')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('not saved yet')).toBeHidden();

  // Durable: after a reload the setlist has only the one song.
  await startApp(page);
  await openSetlist(page, 'Gig Night');
  await editSetlist(page);
  await expect(names()).toHaveText(['Morning on the Porch']);
});

// A song in a second local book ("My songs"): with the example book already on
// the shelf, the empty-shelf "Write a song" way-in is gone, so start the song
// the way search offers when books exist — the Create row (new-song.spec.js).
async function writeHarbourLights(page) {
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
}

test('copy a song from another book into a setlist (Copy and add), saved', async ({
  page,
  checkA11y,
}) => {
  await seedExample(page);

  // A setlist in the example book.
  await addToNewSetlist(page, 'Morning', 'Morning on the Porch', 'Gig Night');

  await writeHarbourLights(page);

  // Add the My-songs song to the example book's setlist: a cross-book copy.
  await addToSetlistFromSearch(page, 'Harbour', 'Harbour Lights');
  await page.getByRole('button', { name: /Gig Night/ }).click();
  await expect(page.getByText(/This song will be copied into/)).toBeVisible();
  await checkA11y(); // the copy notice
  // The dialog breathes: heading, list, notice, line and actions are spaced by
  // the dialog's gap (W12 tablet #3 L134-151).
  const dialog = page.getByRole('dialog', { name: 'Add to setlist' });
  await expectSpacedParts([
    dialog.getByRole('heading', { name: 'Add to setlist' }),
    dialog.getByRole('group', { name: 'Add to setlist' }),
    dialog.locator('.setlist-copy-notice'),
    dialog.getByText(/The copy and the setlist change are then unsaved changes/),
    dialog.locator('.actions'),
  ]);
  // Add to setlist, a song from another book (tablet)
  await mockup(page, 'W12-setlists', 3, { note: 'dialog spacing' });
  await page.getByRole('button', { name: 'Copy and add' }).click();
  await expect(page.getByRole('heading', { name: 'Add to setlist' })).toBeHidden();

  // Open the setlist and save: the copy and the setlist change commit together.
  await openSetlist(page, 'Gig Night');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('not saved yet')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('not saved yet')).toBeHidden();
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
  await expect(page.getByRole('button', { name: /walking-to-the-market/ }).first()).toBeVisible();
  await checkA11y(); // the in-book picker, its results listed (Estante and Palco, shell.palco_contrast)
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

// books.setlist_done — workflow 12 §Building one: a setlist never saved reads
// *not saved yet* (its row in Setlists, its read view, the editor bar) until its
// first save; an edited saved one reads *unsaved changes*. The editor's bar
// starts with **Done**, which leaves editing keeping every change, focus on Edit.
test('a setlist made from Add to setlist says not saved yet until saved, and Done leaves editing keeping the change (workflow 12 §Building one)', async ({
  page,
  checkA11y,
}) => {
  await seedExample(page);
  await addToNewSetlist(page, 'Morning', 'Morning on the Porch', 'Gig Night');

  // The Setlists destination: the row says it, in the row's own name.
  await gotoTab(page, 'Setlists');
  const row = page.getByRole('button', { name: /Gig Night/ });
  await expect(row).toContainText('not saved yet');
  await expect(row).not.toContainText('unsaved changes');
  await checkA11y();

  // The read view: under its title, never *unsaved changes*.
  await openSetlist(page, 'Gig Night');
  const head = page.locator('.setlist-head');
  await expect(head.getByText('not saved yet', { exact: true })).toBeVisible();
  await expect(page.getByText('unsaved changes')).toHaveCount(0);
  await checkA11y();

  // The editor bar says the same, before and after an edit.
  await editSetlist(page);
  const bar = page.locator('.setlist-edit-bar');
  await expect(bar.getByText('not saved yet', { exact: true })).toBeVisible();
  const key = page.getByRole('textbox', { name: 'Key for Morning on the Porch' });
  await key.fill('G');
  await expect(bar.getByText('not saved yet', { exact: true })).toBeVisible();
  await expect(page.getByText('unsaved changes')).toHaveCount(0);
  await checkA11y();

  // Done: back in the read view with the key kept, still not saved, Edit focused.
  await bar.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByText('in G', { exact: true })).toBeVisible();
  await expect(head.getByText('not saved yet', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeFocused();
  await checkA11y();

  // Edit again: the key is still there. Save clears the word everywhere.
  await editSetlist(page);
  await expect(key).toHaveValue('G');
  await bar.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(bar.getByText('not saved yet', { exact: true })).toBeHidden();
  await expect(bar.locator('.badge')).toHaveCount(0);
  await checkA11y();
  await bar.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByText('in G', { exact: true })).toBeVisible();
  await expect(head.locator('.badge')).toHaveCount(0);
  await checkA11y();
  // The read view's own Back (unchanged) to the Setlists destination.
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Setlists' })).toBeVisible();
  await expect(row).toBeVisible();
  await expect(row.locator('.badge')).toHaveCount(0);
  await checkA11y();

  // An edit to the saved setlist reads *unsaved changes* in the bar.
  await openSetlist(page, 'Gig Night');
  await editSetlist(page);
  await page.getByRole('textbox', { name: 'Note for Morning on the Porch' }).fill('start gently');
  await expect(bar.getByText('unsaved changes', { exact: true })).toBeVisible();
  await expect(page.getByText('not saved yet')).toHaveCount(0);
});

// books.setlist_making — workflow 12 §Building one: the Setlists tab makes a
// setlist (a name, and which book only when more than one can be saved to); it
// opens in its editor, not saved yet, with Add song focused (W12 #8, #11).
test('a setlist made from the Setlists tab opens in its editor, and songs go in (workflow 12 §Building one)', async ({
  page,
  checkA11y,
}) => {
  // A device with no book: nowhere to keep a setlist, so no New setlist….
  await startApp(page);
  await gotoTab(page, 'Setlists');
  await expect(
    page.getByText('No setlists yet. Add a song to a setlist from search or the reading view.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'New setlist…' })).toHaveCount(0);

  // The example book, its one setlist removed in the file view (an unsaved
  // removal), so the tab has a book to save to and no setlists.
  await seedExample(page);
  await deleteSongInFiles(page, EXAMPLE_BOOK, 'a-short-set.setlist.md');
  await leaveFiles(page);
  await gotoTab(page, 'Setlists');
  await expect(
    page.getByText(
      'No setlists yet. Make one with New setlist, or add a song to a setlist from search or the reading view.',
    ),
  ).toBeVisible();
  await checkA11y(); // the tab's head

  // New setlist…: the name focused; the example book alone, so no Book group.
  await newSetlistFromTab(page, 'Thursday lesson', {
    checkA11y: async () => {
      await expect(page.getByRole('radiogroup', { name: 'Book' })).toHaveCount(0);
      await checkA11y(); // the dialog without the book choice
    },
  });

  // The editor: empty, not saved yet, Add song focused.
  const bar = page.locator('.setlist-edit-bar');
  await expect(bar.getByText('Thursday lesson', { exact: true })).toBeVisible();
  await expect(bar.getByText('not saved yet', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add song', exact: true })).toBeFocused();
  await expect(page.locator('.setlist-edit-row')).toHaveCount(0);
  await checkA11y(); // the new setlist's editor
  await mockup(page, 'W12-setlists', 11, { note: 'new setlist editor' });

  // Songs go in, from the setlist's own book.
  await addSongInEditor(page, 'Morning');
  await page.getByRole('button', { name: /morning-on-the-porch/ }).first().click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await addSongInEditor(page, 'Walking');
  await page.getByRole('button', { name: /walking-to-the-market/ }).first().click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const names = page.locator('.setlist-edit-row .name');
  await expect(names).toHaveText(['Morning on the Porch', 'Walking to the Market']);
  await bar.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(bar.getByText('not saved yet', { exact: true })).toBeHidden();
  await bar.getByRole('button', { name: 'Done', exact: true }).click();

  // Back to the tab: the row, in the example book, with its count.
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Setlists' })).toBeVisible();
  const row = page.getByRole('button', { name: /Thursday lesson/ });
  await expect(row).toContainText(`${EXAMPLE_BOOK} · 2 songs`);
  await checkA11y();
  await mockup(page, 'W12-setlists', 8);
});

// books.setlist_making — workflow 12 §Building one, workflow 3 §Which book: with
// two books to save to, New setlist asks which, My songs chosen to begin with
// (W12 #9).
test('with two books, New setlist asks which book (workflow 12 §Building one; workflow 3 §Which book)', async ({
  page,
  checkA11y,
}) => {
  await seedExample(page);
  await writeHarbourLights(page);

  await newSetlistFromTab(page, 'Rehearsal', {
    book: EXAMPLE_BOOK,
    checkA11y: async () => {
      const group = page.getByRole('radiogroup', { name: 'Book' });
      await expect(group.getByRole('radio')).toHaveCount(2);
      await expect(group.getByRole('radio', { name: 'My songs' })).toBeChecked();
      await expect(group.getByRole('radio', { name: EXAMPLE_BOOK })).not.toBeChecked();
      await checkA11y(); // the dialog with the book choice
      await mockup(page, 'W12-setlists', 9);
    },
  });

  // In its editor, in the example book; back on the tab its row says so.
  const bar = page.locator('.setlist-edit-bar');
  await expect(bar.getByText(EXAMPLE_BOOK, { exact: true })).toBeVisible();
  await bar.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Setlists' })).toBeVisible();
  const row = page.getByRole('button', { name: /Rehearsal/ });
  await expect(row).toContainText(`${EXAMPLE_BOOK} · 0 songs`);
  await expect(row).toContainText('not saved yet');
  await checkA11y();
});

// books.setlist_making — workflow 12 §Building one: a setlist made from Add to
// setlist leaves the picker saying the song is in it (W12 #10); Open setlist
// opens it as a new place, and Back returns to the song; Done leaves the search.
test('a setlist made from Add to setlist says the song is in it, and Open setlist opens it (workflow 12 §Building one)', async ({
  page,
  checkA11y,
}) => {
  await seedExample(page);
  await openSongFromSearch(page, 'Morning', 'Morning on the Porch');
  await addToNewSetlistFromSong(page, 'Morning on the Porch', 'Gig Night', {
    open: true,
    checkA11y: async () => {
      const made = page.getByRole('status').filter({ hasText: 'Morning on the Porch is in Gig Night.' });
      if (await made.isVisible().catch(() => false)) {
        await expect(page.getByText(/The setlist change is then an unsaved change to/)).toBeVisible();
        await mockup(page, 'W12-setlists', 10);
      }
      await checkA11y();
    },
  });

  // The setlist, in front: the song in it, not saved yet.
  await expect(page.getByRole('group', { name: 'Morning on the Porch' })).toHaveCount(0);
  await expect(page.locator('.setlist-head').getByText('not saved yet', { exact: true })).toBeVisible();
  await expect(page.locator('.setlist-screen .list').getByText('Morning on the Porch')).toBeVisible();
  await checkA11y();

  // Back returns to the song it was made from.
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  await expect(page.getByRole('group', { name: 'Morning on the Porch' }).first()).toBeVisible();

  // From search (Back from the song first: beside an open song on the
  // computer, search rows carry no Add to setlist): Done leaves the search
  // showing.
  await page.getByRole('button', { name: /^Back/ }).filter({ visible: true }).first().click();
  await expect(page.getByRole('group', { name: 'Morning on the Porch' })).toHaveCount(0);
  await addToNewSetlist(page, 'Ferry', 'The Ferry Line', 'Ferry practice');
  await expect(page.getByRole('searchbox').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /The Ferry Line/ }).first()).toBeVisible();
});
