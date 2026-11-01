// editor errors (e2e-web) — chords outside the music, against the compose
// stack, on the phone, tablet and computer projects (songs.editor_errors_in_words;
// workflow 3 §When it looks like another format; spec §1.9, §1.9.1). A new
// song's template overwritten with a bare bar line has no fence at all, so the
// reader reads it as music: no red, no notice, the preview draws its bars. A
// line of chords typed under a fenced part is a note: once the cursor has left
// it the notice offers *Put it in the music*, which fences it — the preview
// draws its bars — and a notice with *Undo* says so; Undo brings the offer
// back (mockup W04, the phone frame "the template overwritten"). Axe at WCAG
// 2.1 AA on the editor with the offer, and with the wrap notice. A local book:
// no account, no network. Purpose-written songs.

import { test, expect } from '../lib/axe.js';
import { startApp } from '../lib/journeys.js';
import { replaceSong } from '../lib/journeys-edit.js';
import { mockup } from '../lib/mockup.js';

// The preview region, a tap away where the editor is too narrow to split; the
// returned function goes back to the text.
async function showPreview(page) {
  const previewTab = page.getByRole('radio', { name: 'Preview' });
  const toggled = (await previewTab.count()) > 0;
  if (toggled) await previewTab.click();
  return {
    preview: page.getByRole('region', { name: 'Preview' }),
    back: async () => {
      if (toggled) await page.getByRole('radio', { name: 'Text' }).click();
    },
  };
}

test('the template overwritten with a bare bar line reads as bars (spec §1.9.1)', async ({ page }) => {
  await startApp(page);
  await page.getByRole('button', { name: /Write a song/ }).click();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();

  await replaceSong(page, '# Rascunho\n\n| Am7 | D7 | Gm7 | C7 |');
  await page.keyboard.press('Control+Home');
  await expect(content.locator('.cm-line.est-err')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Put it in the music' })).toHaveCount(0);
  const { preview, back } = await showPreview(page);
  await expect(preview.locator('.m')).toHaveCount(4);
  await expect(preview).toContainText('Gm7');
  await back();
});

test('a line of chords typed under a fenced part is offered to the music', async ({ page, checkA11y }) => {
  await startApp(page);
  await page.getByRole('button', { name: /Write a song/ }).click();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();

  await replaceSong(page, '# Rascunho\n\n## Intro\n```\nC\n```\n\n| Am7 | D7 | Gm7 | C7 |');

  // Off the line: the notice counts it and offers the fix.
  await page.keyboard.press('Control+Home');
  const offer = page.getByRole('button', { name: 'Put it in the music' });
  await expect(offer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show me how' })).toBeVisible();
  await expect(page.getByText(/^Line 8 looks like chords, but it is outside the music/)).toBeVisible();
  await checkA11y(); // the notice with its offer
  await mockup(page, 'W04-edit-and-save', 5); // the template overwritten

  await offer.click();
  const wrap = page.getByRole('status').filter({ hasText: 'Line 8 is now inside the music, so it reads as chords.' });
  await expect(wrap).toBeVisible();

  const { preview, back } = await showPreview(page);
  await expect(preview.locator('.m')).toHaveCount(4); // the Intro's lone C is a run, not a bar (spec §2.1)
  await expect(preview).toContainText('Gm7');
  await checkA11y(); // the wrap notice
  await back();

  // Undo: the text as it was, and the offer back.
  await wrap.getByRole('button', { name: 'Undo' }).click();
  await expect(wrap).toHaveCount(0);
  await expect(offer).toBeVisible();
});
