// bar numbers (e2e-web) — a chart's bars numbered on the reading page and on
// the printed sheet (songs.bar_numbers; cifra.md §2.8), against the compose
// stack, on the phone, tablet and computer projects. A new song that is all
// chart, one bar stating its number mid-line (`@17`) and a heading stating its
// first bar's (`## Coda @21`): off until asked; *Show bar numbers* in ⋯ puts
// each line's first bar in the margin, left of the line's first bar rule, and
// the stated number over its bar; the page never scrolls sideways; the choice
// survives a reload (the home book's `barNumbers`); print draws the same
// numbers; *Hide bar numbers* takes them away. Axe at WCAG 2.1 AA with the
// numbers shown. A local book: no account, no network. The song is
// purpose-written — never anyone's copyrighted words.

import { test, expect } from '../lib/axe.js';
import { startApp, saveThroughSheet, openSongFromSearch } from '../lib/journeys.js';

const TITLE = 'Contagem do Cais';
const SONG = [
  `# ${TITLE}`,
  '',
  '## A',
  '```',
  'Dm | G7 | C7 | F',
  'Bb | A7 | @17 Dm | %',
  '```',
  '',
  '## Coda @21',
  '```',
  'Gm | A7 | Dm | Dm',
  '```',
  '',
].join('\n');

const chartOf = (page) => page.getByRole('group', { name: TITLE }).first();

async function chooseFromMore(page, name) {
  await page.getByRole('button', { name: 'More', exact: true }).filter({ visible: true }).first().click();
  const item = page.getByRole('menuitem', { name, exact: true });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page.getByRole('menu', { name: 'More' })).toHaveCount(0);
}

// Each margin number beside the first bar rule of its line: its text, and
// whether it ends at or before that rule (a 1px tolerance).
async function marginPlacement(chart) {
  return chart.evaluate((host) =>
    [...host.querySelectorAll('.barline')].map((line) => {
      const num = line.querySelector('.barnum').getBoundingClientRect();
      const bar = line.querySelector('.m').getBoundingClientRect();
      return { text: line.querySelector('.barnum').textContent, left: num.right <= bar.left + 1, shown: num.width > 0 };
    }),
  );
}

async function expectNumbersDrawn(page) {
  const chart = chartOf(page);
  await expect(chart.locator('.barnum')).toHaveText(['1', '5', '21']);
  expect(await marginPlacement(chart)).toEqual([
    { text: '1', left: true, shown: true },
    { text: '5', left: true, shown: true },
    { text: '21', left: true, shown: true },
  ]);
  // The jump shows over the bar that states it, the third of its line.
  const stated = chart.locator('.barline').nth(1).locator('.m').nth(2).locator('.barnum-at');
  await expect(stated).toHaveText('17');
  await expect(stated).toBeVisible();
}

test('bar numbers show in the margin when asked, survive a reload, print, and hide again', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);
  await page.getByRole('button', { name: /Write a song/ }).click();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  // insertText: CodeMirror's mobile input path collapses Enter keydowns.
  await page.keyboard.insertText(SONG);
  await saveThroughSheet(page);
  await openSongFromSearch(page, 'Contagem', TITLE);

  // Off until asked.
  await expect(chartOf(page)).toBeVisible();
  await expect(chartOf(page).locator('.barnum, .barnum-at')).toHaveCount(0);

  await chooseFromMore(page, 'Show bar numbers');
  await expectNumbersDrawn(page);
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(pageOverflow, 'the page scrolls sideways').toBeLessThanOrEqual(1);
  await checkA11y(); // the reading view with the numbers shown

  // Kept in the home book: a reload reads the song numbered.
  await page.reload();
  await openSongFromSearch(page, 'Contagem', TITLE);
  await expectNumbersDrawn(page);

  // The printed sheet draws the same chart.
  await page.emulateMedia({ media: 'print' });
  await expectNumbersDrawn(page);
  await page.emulateMedia({ media: 'screen' });

  await chooseFromMore(page, 'Hide bar numbers');
  await expect(chartOf(page).locator('.barnum, .barnum-at')).toHaveCount(0);
});
