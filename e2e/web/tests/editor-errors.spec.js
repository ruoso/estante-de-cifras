// editor errors (e2e-web) — a line the editor marks red says why, against the
// compose stack, on the phone, tablet and computer projects
// (songs.editor_errors_in_words). A new song's template overwritten with a
// bare bar line: the line turns red and a note right under it says, in words,
// that it reads as chords but is outside the music (workflow 4 §Editing; spec
// §1.9). Once the cursor has left the line the notice offers *Put it in the
// music*, which fences it — the preview draws its bars — and a notice with
// *Undo* says so; Undo brings the note back (workflow 3 §When it looks like
// another format; mockup W04, the phone frame "the template overwritten").
// Axe at WCAG 2.1 AA on the editor with the note and the offer, and with the
// wrap notice. A local book: no account, no network. Purpose-written song.

import { test, expect } from '../lib/axe.js';
import { startApp } from '../lib/journeys.js';
import { replaceSong } from '../lib/journeys-edit.js';
import { mockup } from '../lib/mockup.js';

test('the template overwritten with a bare bar line says why and puts it in the music', async ({ page, checkA11y }) => {
  await startApp(page);
  await page.getByRole('button', { name: /Write a song/ }).click();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();

  await replaceSong(page, '# Rascunho\n\n| Am7 | D7 | Gm7 | C7 |');

  // The red line says why, right under it.
  const bar = content.locator('.cm-line').filter({ hasText: '| Am7 | D7 | Gm7 | C7 |' });
  await expect(bar).toHaveClass(/est-err/);
  const note = content.locator('.est-line-note');
  await expect(note).toHaveCount(1);
  await expect(note).toBeVisible();
  await expect(note).toHaveText(/^Line 3: .*outside the music/);

  // Off the line: the notice counts it and offers the fix.
  await page.keyboard.press('Control+Home');
  const offer = page.getByRole('button', { name: 'Put it in the music' });
  await expect(offer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show me how' })).toBeVisible();
  await checkA11y(); // the note and the notice with its offer
  await mockup(page, 'W04-edit-and-save', 5); // the template overwritten

  await offer.click();
  await expect(content.locator('.cm-line.est-err')).toHaveCount(0);
  await expect(note).toHaveCount(0);
  const wrap = page.getByRole('status').filter({ hasText: 'Line 3 is now inside the music, so it reads as chords.' });
  await expect(wrap).toBeVisible();

  // The preview draws the line as bars (a tap away where the editor is too
  // narrow to split).
  const previewTab = page.getByRole('radio', { name: 'Preview' });
  const toggled = (await previewTab.count()) > 0;
  if (toggled) await previewTab.click();
  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(preview.locator('.m')).toHaveCount(4);
  await expect(preview).toContainText('Gm7');
  await checkA11y(); // the wrap notice
  if (toggled) await page.getByRole('radio', { name: 'Text' }).click();

  // Undo: the text as it was, and its note back.
  await wrap.getByRole('button', { name: 'Undo' }).click();
  await expect(wrap).toHaveCount(0);
  await expect(note).toHaveText(/^Line 3: .*outside the music/);
  await expect(bar).toHaveClass(/est-err/);
});
