// unknown tokens (e2e-web) — chords written in another format are flagged
// before a save, against the compose stack, on the phone, tablet and computer
// projects (songs.unknown_tokens_loud). Typing `[Am]Teste [G]linha` inside the
// music of a new song: the editor marks the two words it does not read as
// chords and, once the cursor has left the line, says the line looks like
// chords in brackets (workflow 3 §When it looks like another format; workflow 4
// §Editing; spec §2.9, §1.7.2). The save sheet lists the words and asks
// *Save anyway*, which saves (workflow 4 §Saving). Axe at WCAG 2.1 AA on the
// editor and the sheet. A local book: no account, no network. Fixtures are
// purpose-written — never anyone's copyrighted words.

import { test, expect } from '../lib/axe.js';
import { startApp, saveThroughSheet, openSongFromSearch } from '../lib/journeys.js';

const NOTICE = 'Line 4 looks like chords in brackets. Here a chord goes on its own line, above its words.';

test('bracket chords typed into a new song are flagged, and the save asks first', async ({ page, checkA11y }) => {
  await startApp(page);
  await page.getByRole('button', { name: /Write a song/ }).click();

  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  // Typed (insertText: CodeMirror's mobile input path collapses Enter keydowns),
  // ending on the bracket line: the cursor is still on it, so no notice yet.
  await page.keyboard.insertText('# Tarde Clara\n\n```\n[Am]Teste [G]linha');
  const marks = content.locator('.est-unknown');
  await expect(marks).toHaveText(['Teste', '[G]linha']);
  await expect(marks.first()).toHaveAttribute('title', 'Not read as a chord');
  await expect(page.getByText(NOTICE)).toHaveCount(0);

  // On to the next line: now the line counts.
  await page.keyboard.insertText('\n```\n');
  await expect(page.getByRole('status').filter({ hasText: NOTICE })).toBeVisible();
  await expect(marks).toHaveText(['Teste', '[G]linha']);
  await checkA11y(); // the marked editor and its notice

  await saveThroughSheet(page, {
    saveAnyway: true,
    onSheet: async (sheet) => {
      await expect(sheet.getByText('Not read as chords, kept as written: Teste, [G]linha')).toBeVisible();
      await expect(sheet.getByRole('button', { name: 'Save anyway', exact: true })).toBeEnabled();
      await expect(sheet.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
      await checkA11y(); // the sheet asking
    },
  });

  // Saved: it opens in the reading view.
  await openSongFromSearch(page, 'Tarde', 'Tarde Clara');
});
