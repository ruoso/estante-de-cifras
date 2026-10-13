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
// No real toolbar host wires #dev/history yet (songs.reading, Decision 5); this
// spec reaches the surface through the dev hash, as history.spec.js does.

import { test, expect } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';

const BOOK = 'local-example-book';
const SONG_PATH = 'morning-on-the-porch.cifra.md';
const editorUrl = (p) => `/#dev/editor?book=${BOOK}&path=${encodeURIComponent(p)}`;
const historyUrl = (p) => `/#dev/history?book=${BOOK}&path=${encodeURIComponent(p)}`;

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

async function seedExampleBook(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Open the example book/ }).click();
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByText('Morning on the Porch')).toBeVisible();
  await page.getByRole('searchbox').fill('');
}

// Replace the whole song with `text`. insertText (not type): the mobile CodeMirror
// input path collapses Enter keydowns (editor.spec.js).
async function replaceSong(page, text) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(text);
  await page.waitForTimeout(800); // let the debounced WRITE settle
}

// Save through the sheet, filling the one-time name prompt and an optional note.
async function saveThroughSheet(page, note) {
  await page.getByRole('button', { name: 'Save' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill('Marina Souza');
  if (note) await sheet.getByRole('textbox', { name: 'Note' }).fill(note);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
}

async function editorContent(page) {
  await page.goto(editorUrl(SONG_PATH));
  await expect(page.locator('.cm-content')).toBeVisible();
  return (await page.locator('.cm-content').innerText());
}

test('restore a section block over an unsaved edit: asks first, keeps the other block; axe', async ({
  page,
  checkA11y,
}) => {
  await seedExampleBook(page);

  await page.goto(editorUrl(SONG_PATH));
  await expect(page.locator('.cm-content')).toBeVisible();
  await replaceSong(page, SECTION_A);
  await saveThroughSheet(page, 'Version A');
  await replaceSong(page, SECTION_B);
  await saveThroughSheet(page, 'Version B');
  // Leave an unsaved edit to the Verse, so restoring that block must ask first.
  await replaceSong(page, SECTION_DIRTY_VERSE);

  await page.goto(historyUrl(SONG_PATH));
  await expect(page.locator('.est-history-row').first()).toBeVisible();

  // Open Version A and compare with now; every differing block gets a restore.
  await page.getByRole('button', { name: /Version A/ }).click();
  await page.getByRole('button', { name: 'Compare with now' }).click();
  await expect(page.getByText('What changed from this version to now')).toBeVisible();
  await checkA11y(); // the history surface with per-block affordances

  // Restore the Verse block: it holds the unsaved edit, so it asks first.
  await page.getByRole('button', { name: 'Restore this block: Verse' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText('Restore Verse?')).toBeVisible();
  await checkA11y(); // the block-scoped restore confirm
  await confirm.getByRole('button', { name: 'Lose them and restore' }).click();

  // The restored copy opens the save sheet; saving makes a new version.
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('textbox', { name: 'Note' })).toBeVisible();
  await checkA11y(); // the save sheet
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill('Marina Souza');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();

  // The Verse is back to Version A; the Chorus kept Version B's chords.
  const content = await editorContent(page);
  expect(content).toContain('Cadd9'); // Verse, restored from A
  expect(content).toContain('Esus4'); // Chorus, the other block, untouched
  expect(content).toContain('B7');
  expect(content).not.toContain('Fmaj7'); // Verse B is gone
  expect(content).not.toContain('Gadd9'); // and so is the unsaved Verse edit
});

test('restore a voicing block with no unsaved changes: no prompt, keeps the other block; axe', async ({
  page,
  checkA11y,
}) => {
  await seedExampleBook(page);

  await page.goto(editorUrl(SONG_PATH));
  await expect(page.locator('.cm-content')).toBeVisible();
  await replaceSong(page, VOICE_A);
  await saveThroughSheet(page, 'Voicings version A');
  await replaceSong(page, VOICE_B);
  await saveThroughSheet(page, 'Voicings version B');

  await page.goto(historyUrl(SONG_PATH));
  await expect(page.locator('.est-history-row').first()).toBeVisible();

  await page.getByRole('button', { name: /Voicings version A/ }).click();
  await page.getByRole('button', { name: 'Compare with now' }).click();
  await expect(page.getByText('What changed from this version to now')).toBeVisible();

  // Clean working copy, so restoring the voicing block does not ask — the save
  // sheet opens straight away.
  await page.getByRole('button', { name: 'Restore this block: Voicings for G4 C4 E4 A4' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('textbox', { name: 'Note' })).toBeVisible();
  await checkA11y(); // the save sheet
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill('Marina Souza');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();

  // The C voicing is back to version A (0003); the added Chorus block stays.
  const content = await editorContent(page);
  expect(content).toContain('0003'); // the restored voicing
  expect(content).toContain('Chorus'); // the other block, untouched
  expect(content).not.toContain('5433'); // version B's voicing is gone
});
