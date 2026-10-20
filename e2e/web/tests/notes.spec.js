// notes and verbatim (e2e-web) — the chart draws the whole body of a song in
// document order (songs.render_notes; DIRECTION §3.7; cifra.md §1.9; workflow 3
// topic 7), against the compose stack, on the phone, tablet and computer
// projects. A new song with a note between two fences of one section and a
// `tab` block: the editor's preview shows the note and the block (on a phone
// behind the Preview tab), and once saved the reading view's chart shows the
// sung line, the note, the second music and the tab block in that order — the
// block in the theme's monospace, the note not — and on a phone the page never
// scrolls sideways. Axe at WCAG 2.1 AA on the editor with its preview and on
// the reading view. A local book: no account, no network. The song is
// purpose-written — never anyone's copyrighted words.

import { test, expect } from '../lib/axe.js';
import { startApp, saveThroughSheet, openSongFromSearch } from '../lib/journeys.js';

const TITLE = 'Beira do Rio';
const NOTE = 'Mais devagar na segunda vez.';
const TAB = 'e|--3--0--|\nB|--0--1--|';
const SONG = [
  `# ${TITLE}`,
  '',
  '## Verso',
  '```',
  'G        C',
  'Desço a beira do rio',
  '```',
  '',
  NOTE,
  '',
  '```',
  'Am | D | G',
  '```',
  '',
  '```tab',
  TAB,
  '```',
  '',
].join('\n');

// The first family of a CSS font-family list, unquoted and lower-cased.
const firstFamily = (value) => value.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();

test('a song with notes and a tab block previews and reads them in order', async ({ page, checkA11y }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  await startApp(page);
  await page.getByRole('button', { name: /Write a song/ }).click();

  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  // insertText: CodeMirror's mobile input path collapses Enter keydowns.
  await page.keyboard.insertText(SONG);

  // The preview: the note and the tab block, not a blank chart.
  if (phone) await page.getByRole('radio', { name: 'Preview' }).click();
  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(preview.getByText(NOTE)).toBeVisible();
  await expect(preview.getByRole('group', { name: 'Tab block' })).toHaveText(TAB);
  await checkA11y(); // the editor with its preview drawing notes and a tab block

  await saveThroughSheet(page);
  await openSongFromSearch(page, 'Beira', TITLE);

  // The reading view: sung line, note, second music, tab block, in that order.
  const chart = page.getByRole('group', { name: TITLE }).first();
  const sung = chart.locator('.sung').first();
  const note = chart.getByText(NOTE);
  const bars = chart.locator('.barline').first();
  const tab = chart.getByRole('group', { name: 'Tab block' });
  await expect(sung).toContainText('Desço');
  await expect(note).toBeVisible();
  await expect(bars).toBeVisible();
  await expect(tab).toHaveText(TAB);
  const order = await chart.evaluate((root) => {
    const nodes = [
      root.querySelector('.sung'),
      [...root.querySelectorAll('.notes p')].find((p) => p.textContent === 'Mais devagar na segunda vez.'),
      root.querySelector('.barline'),
      root.querySelector('pre.verbatim'),
    ];
    return nodes.every(Boolean) && nodes.every((n, i) => i === 0 || (nodes[i - 1].compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
  });
  expect(order).toBe(true);

  // The block is set in the theme's monospace (--font-code); the note is not.
  const code = await tab.evaluate((el) => getComputedStyle(el).getPropertyValue('--font-code'));
  const tabFace = await tab.evaluate((el) => getComputedStyle(el).fontFamily);
  const noteFace = await note.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(firstFamily(code)).not.toBe('');
  expect(firstFamily(tabFace)).toBe(firstFamily(code));
  expect(firstFamily(noteFace)).not.toBe(firstFamily(code));

  if (phone) {
    // The tab never widens the page: it scrolls inside itself.
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits).toBe(true);
  }
  await checkA11y(); // the reading view with notes and a tab block
});
