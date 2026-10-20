// format help (e2e-web) — the song format explained in the editor, against the
// compose stack, on the phone, tablet and computer projects
// (songs.format_help). While writing a new song: the editor's *Help* opens
// *Writing a song* — a sheet on a phone, a panel hanging from Help on a tablet
// and a computer — and *Insert* puts the Bars example in the song (workflow 3
// §Help with the format; board Format-help Phone 2, Tablet). Then chords typed
// in brackets raise the notice, whose *Show me how* opens the help at *Chords
// over words*; Escape closes it and focus goes back to Show me how (workflow 3
// §When it looks like another format; board Phone 1, Computer). Axe at WCAG
// 2.1 AA on the open help and on the editor with its notice. A local book: no
// account, no network. Copy is pinned at the behavior level (Decision 11).
// Fixtures are the help's own purpose-written examples and songs.

import { test, expect } from '../lib/axe.js';
import { startApp } from '../lib/journeys.js';

const NOTICE = 'Line 4 looks like chords in brackets. Here a chord goes on its own line, above its words.';

test('the help opened while writing a new song', async ({ page, checkA11y }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  await startApp(page);
  await page.getByRole('button', { name: /Write a song/ }).click();

  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();

  // Help, in the editor's own bar.
  const help = page.locator('.est-editor-bar').getByRole('button', { name: 'Help', exact: true });
  await help.click();
  const dialog = page.getByRole('dialog', { name: 'Writing a song' });
  await expect(dialog).toBeVisible();
  // A sheet on a phone, a panel hanging from Help elsewhere.
  await expect(page.locator(phone ? '.sheet.est-format-help' : '.popover.card.est-format-help')).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 3 })).toHaveCount(8);
  await checkA11y(); // the help open

  // Insert the Bars example: the help closes and the song holds it.
  await dialog.getByRole('button', { name: 'Insert the Bars example' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(content).toContainText('G | % | C | D');

  // Chords written in brackets, inside the music; on to the next line.
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText('# Moonlit Road\n\n```\n[Am]Walk the road');
  await page.keyboard.insertText('\n```\n');
  await expect(page.getByRole('status').filter({ hasText: NOTICE })).toBeVisible();
  await checkA11y(); // the editor with its notice

  // Show me how: the help at Chords over words.
  const showMe = page.getByRole('button', { name: 'Show me how' });
  await showMe.click();
  await expect(dialog).toBeVisible();
  const heading = dialog.getByRole('heading', { name: '3. Chords over words' });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();

  // Escape: closed, and focus back on what opened it.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(showMe).toBeFocused();
});
