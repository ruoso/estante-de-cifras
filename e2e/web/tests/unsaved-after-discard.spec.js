// unsaved after discard (e2e-web) — songs.unsaved_after_discard, against the
// compose stack on the phone, tablet and computer projects. After *Discard
// changes* or a save, back on search the song no longer wears its *unsaved*
// badge — workflow 4 L11-14: the badge lasts "until it is saved or the changes
// are discarded" — and a never-saved draft that was discarded leaves *Recent*
// as well as its book (workflow 3 §Abandoning it L52-54; workflow 2 L13-15:
// recents are "the way back into what you were playing"). Axe runs at WCAG 2.1
// AA on the search screen at each assertion point. Real UI only: no `#dev/*`
// mount, nothing injected. The songs are written for this test.

import { test, expect } from '../lib/axe.js';
import {
  startApp,
  makeLocalBook,
  openSongFromSearch,
  openSongInEditor,
  editFromReading,
  settleEdits,
  saveThroughSheet,
  gotoTab,
} from '../lib/journeys.js';
import { createSongFromSearch, escape } from '../lib/journeys-core.js';
import { addSection, backToSearch } from '../lib/journeys-edit.js';

const recent = (page) => page.getByRole('region', { name: 'Recent' });
const songRow = (scope, title) => scope.getByRole('button', { name: new RegExp(`^${escape(title)}`) });

// The editor's Discard changes, confirmed in its dialog.
async function discardThroughConfirm(page) {
  await page.getByRole('button', { name: 'Discard changes' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText(/This would be lost/)).toBeVisible();
  await confirm.getByRole('button', { name: 'Discard changes' }).click();
  await expect(confirm).toBeHidden();
}

// The search screen with nothing typed: the pre-typing listing (Recent, Books).
async function clearSearch(page) {
  await page.getByRole('searchbox').first().fill('');
  await expect(page.getByRole('region', { name: 'Books' })).toBeVisible();
}

test('a discarded draft leaves no badge and no recent (workflow 3 L52-54; workflow 2 L13-15; workflow 4 L11-14)', async ({
  page,
  checkA11y,
}) => {
  const title = 'Lanterns Over the Quay';
  // A book of one's own, so the search screen lists books rather than the
  // first-run door once the draft is gone.
  await startApp(page);
  await makeLocalBook(page, 'Rehearsal Notes');
  await gotoTab(page, 'Search');

  // Create the song from search (not createSongFromSearch, which saves).
  await page.getByRole('searchbox').first().fill(title);
  await page.getByRole('button', { name: new RegExp(`^Create .${escape(title)}.`) }).click();
  await expect(page.locator('.cm-content')).toContainText(title);
  await addSection(page, 'Verse');
  await settleEdits(page);
  await backToSearch(page);

  // Never saved: its row reads unsaved.
  await page.getByRole('searchbox').first().fill(title);
  await expect(songRow(page, title).first()).toContainText('unsaved');
  await checkA11y();

  // Opening it records it as a recent.
  await openSongFromSearch(page, title, title);
  await backToSearch(page);
  await clearSearch(page);
  await expect(songRow(recent(page), title)).toBeVisible();
  await checkA11y();

  // Discard it: the never-saved file is deleted.
  await openSongFromSearch(page, title, title);
  await editFromReading(page);
  await discardThroughConfirm(page);
  await backToSearch(page);

  // Neither Recent nor a book's section lists it, and nothing reads unsaved.
  await clearSearch(page);
  await expect(page.getByRole('region', { name: 'Books' }).getByText(title)).toHaveCount(0);
  await expect(recent(page).getByText(title)).toHaveCount(0);
  await expect(page.getByText('unsaved')).toHaveCount(0);
  await checkA11y();
  // And search no longer finds it.
  await page.getByRole('searchbox').first().fill(title);
  await expect(page.getByRole('heading', { name: 'No songs match' })).toBeVisible();
});

test('an edit discarded, then an edit saved, each clears the badge (workflow 4 §Discarding L118-122, L11-14)', async ({
  page,
  checkA11y,
}) => {
  const title = 'Gulls at the Breakwater';
  const chords = 'Am G C';
  await startApp(page);
  await makeLocalBook(page, 'Rehearsal Notes');
  await gotoTab(page, 'Search');
  await createSongFromSearch(page, title, chords);
  await backToSearch(page);
  // The searchbox still holds the title the Create row was made from: wait
  // for the saved song's row, not the stale Create row, before opening it.
  await page.getByRole('searchbox').first().fill(title);
  await expect(songRow(page, title).first()).toBeVisible();

  // Edit the saved song: back on search its row reads unsaved.
  await openSongInEditor(page, title, title);
  await addSection(page, 'Bridge');
  await settleEdits(page);
  await backToSearch(page);
  await page.getByRole('searchbox').first().fill(title);
  await expect(songRow(page, title).first()).toContainText('unsaved');
  await checkA11y();

  // Discard the edit (the editor stays on the song, reverted).
  await openSongInEditor(page, title, title);
  await discardThroughConfirm(page);
  await expect(page.locator('.cm-content')).not.toContainText('## Bridge');
  await backToSearch(page);
  await clearSearch(page);
  await expect(page.getByText('unsaved')).toHaveCount(0);
  // A saved song whose edits are discarded stays a way back.
  await expect(songRow(recent(page), title)).toBeVisible();
  await checkA11y();

  // Edit again and save through the sheet: no badge either.
  await openSongInEditor(page, title, title);
  await addSection(page, 'Coda');
  await saveThroughSheet(page);
  await backToSearch(page);
  await clearSearch(page);
  await expect(page.getByText('unsaved')).toHaveCount(0);
  await page.getByRole('searchbox').first().fill(title);
  await expect(songRow(page, title).first()).toBeVisible();
  await expect(page.getByText('unsaved')).toHaveCount(0);
  await checkA11y();
});
