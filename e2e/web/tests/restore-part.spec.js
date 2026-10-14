// restore-part.spec.js (e2e-web) — restoring ONE block of a song version on the
// three viewports (songs.restore_part, workflow 6 §Restoring). Against the compose
// stack, on the phone/tablet/computer projects: seed the example book, make two
// saved versions of a song through #dev/editor (the save sheet is Done), then open
// #dev/history and drive the journey — *compare with now*, *Restore this block* on
// one block, and the save — with axe at WCAG 2.1 AA on the history surface, the
// block-scoped restore confirm and the save sheet. One run restores a section (over
// an unsaved edit, so it asks first); the other restores a voicing block (clean, so
// it does not ask). The restored block comes back and the other edited block stays.
//
// Every step is the real UI from `/` (search -> Edit -> save sheet; reading ->
// History). A restore opens the save sheet over the history (workflow 6
// L59-62); saving it makes a new version.

import { test, expect } from '../lib/axe.js';
import { openExampleBook, openSongInEditor, saveThroughSheet } from '../lib/journeys.js';
import { replaceSong, editAgain, openHistory, confirmSheet } from '../lib/journeys-edit.js';

const SONG_TITLE = 'Morning on the Porch';

// Two-section versions: only the chords differ, with distinctive multi-character
// symbols so the restored/kept blocks are unambiguous to assert.
const SECTION_A = [
  '# Morning on the Porch',
  '',
  '## Verse',
  '```',
  '| Cadd9 | G |',
  '```',
  '',
  '## Chorus',
  '```',
  '| Am | Dm |',
  '```',
  '',
].join('\n');
const SECTION_B = [
  '# Morning on the Porch',
  '',
  '## Verse',
  '```',
  '| Fmaj7 | Bb |',
  '```',
  '',
  '## Chorus',
  '```',
  '| Esus4 | B7 |',
  '```',
  '',
].join('\n');
// An unsaved edit to the Verse so restoring that block must ask first.
const SECTION_DIRTY_VERSE = [
  '# Morning on the Porch',
  '',
  '## Verse',
  '```',
  '| Gadd9 | D |',
  '```',
  '',
  '## Chorus',
  '```',
  '| Esus4 | B7 |',
  '```',
  '',
].join('\n');

// A song with a voicing block, plus a second block (the Chorus) added in version B.
const VOICE_A = [
  '# Morning on the Porch',
  '',
  '## Verse',
  '```',
  '| C | G |',
  '```',
  '',
  '---',
  '',
  '## Voicings: G4 C4 E4 A4',
  '- C: 0003',
  '- G: 0232',
  '',
].join('\n');
const VOICE_B = [
  '# Morning on the Porch',
  '',
  '## Verse',
  '```',
  '| C | G |',
  '```',
  '',
  '## Chorus',
  '```',
  '| C | G |',
  '```',
  '',
  '---',
  '',
  '## Voicings: G4 C4 E4 A4',
  '- C: 5433',
  '- G: 0232',
  '',
].join('\n');


// Save the current editor text as a version with `note`; a save returns to reading.
const save = (page, note) => saveThroughSheet(page, { note });

// Search -> Edit, then save two versions (and optionally leave a third unsaved).
async function buildVersions(page, first, second, firstNote, secondNote) {
  await openExampleBook(page);
  await openSongInEditor(page, 'Morning', SONG_TITLE);
  await replaceSong(page, first);
  await save(page, firstNote);
  await editAgain(page);
  await replaceSong(page, second);
  await save(page, secondNote);
}

// A restore opens the save sheet (workflow 6 L59-62); Cancel keeps the restored
// text in the working copy, unsaved.
async function keepRestoreUnsaved(page) {
  const sheet = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Note' }) });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toBeHidden();
}

// From the song's reading view: the working copy's text, via Edit.
async function workingCopy(page) {
  await editAgain(page);
  await expect(page.locator('.cm-content')).toContainText(SONG_TITLE);
  return page.locator('.cm-content').innerText();
}

async function backToTheSong(page) {
  const backToHistory = page.getByRole('button', { name: 'Back to history' });
  if (await backToHistory.count()) await backToHistory.click();
  await page.getByRole('button', { name: 'Back to the song' }).click();
  await expect(page.getByRole('group', { name: SONG_TITLE }).first()).toBeVisible();
}

async function compareWithVersion(page, note) {
  await openHistory(page);
  await page.getByRole('button', { name: new RegExp(note) }).click();
  await page.getByRole('button', { name: 'Compare with now' }).click();
  await expect(page.getByText('What changed from this version to now')).toBeVisible();
}

test('restore a section block over an unsaved edit: asks first, keeps the other block; axe', async ({
  page,
  checkA11y,
}) => {
  await buildVersions(page, SECTION_A, SECTION_B, 'Version A', 'Version B');
  // Leave an unsaved edit to the Verse, so restoring that block must ask first.
  await editAgain(page);
  await replaceSong(page, SECTION_DIRTY_VERSE);
  await page.getByRole('button', { name: 'Back' }).first().click();

  // Open Version A and compare with now; every differing block gets a restore.
  await compareWithVersion(page, 'Version A');
  await checkA11y(); // the history surface with per-block affordances

  // Restore the Verse block: it holds the unsaved edit, so it asks first.
  await page.getByRole('button', { name: 'Restore this block: Verse' }).click();
  const confirm = page.getByRole('dialog').filter({ hasText: 'Restore Verse?' });
  await expect(confirm).toBeVisible();
  await checkA11y(); // the block-scoped restore confirm
  await confirm.getByRole('button', { name: 'Lose them and restore' }).click();
  await expect(confirm).toBeHidden();
  await keepRestoreUnsaved(page);

  // The Verse is back to Version A; the Chorus kept Version B's chords.
  await backToTheSong(page);
  const content = await workingCopy(page);
  expect(content).toContain('Cadd9'); // Verse, restored from A
  expect(content).toContain('Esus4'); // Chorus, the other block, untouched
  expect(content).toContain('B7');
  expect(content).not.toContain('Fmaj7'); // Verse B is gone
  expect(content).not.toContain('Gadd9'); // and so is the unsaved Verse edit
});

test('restore a voicing block with no unsaved changes: no prompt, keeps the other block', async ({ page }) => {
  await buildVersions(page, VOICE_A, VOICE_B, 'Voicings version A', 'Voicings version B');
  await compareWithVersion(page, 'Voicings version A');

  // Clean working copy, so restoring the voicing block does not ask first: the
  // next dialog is the save sheet, not a confirm.
  await page.getByRole('button', { name: 'Restore this block: Voicings for G4 C4 E4 A4' }).click();
  await expect(page.getByRole('dialog').filter({ hasText: /^Restore / })).toHaveCount(0);
  await keepRestoreUnsaved(page);

  // The C voicing is back to version A (0003); the added Chorus block stays.
  await backToTheSong(page);
  const content = await workingCopy(page);
  expect(content).toContain('0003'); // the restored voicing
  expect(content).toContain('Chorus'); // the other block, untouched
  expect(content).not.toContain('5433'); // version B's voicing is gone
});

test('a restored block opens the save sheet; saving makes a new version; axe', async ({
  page,
  checkA11y,
}) => {
  await buildVersions(page, VOICE_A, VOICE_B, 'Voicings version A', 'Voicings version B');
  await compareWithVersion(page, 'Voicings version A');
  await page.getByRole('button', { name: 'Restore this block: Voicings for G4 C4 E4 A4' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('textbox', { name: 'Note' })).toBeVisible();
  await checkA11y(); // the save sheet
  await confirmSheet(page);
  await expect(page.getByRole('dialog')).toBeHidden();
  // The history behind the sheet now leads with the new version.
  await backToTheSong(page);
  await openHistory(page);
  await expect(page.locator('.est-history-row').first()).not.toContainText('Voicings version B');
});
