// trailing chord (e2e-web) — a chord written past the end of its sung line
// keeps its distance from the last word (songs.trailing_chord_gap; cifra.md
// §4.4 "an attached item at or past the end of the words has no words", §4.8
// "a chord with an empty segment"), against the compose stack, on the phone,
// tablet and computer projects. A new song whose first line ends on a chord a
// few columns past the words and whose second ends on a chord exactly at the
// end of them: in the editor's preview (on a phone behind the Preview tab) and,
// once saved, in the reading view at Comfortable, Compact and Roomy, each such
// chord starts at least a quarter of the chart's font size to the right of the
// last glyph of the words. The phone reads in the narrow layout, the tablet
// and the computer in the wide one. Axe at WCAG 2.1 AA on the preview and on
// the reading view. A local book: no account, no network. The song is
// purpose-written — never anyone's copyrighted words.

import { test, expect } from '../lib/axe.js';
import { startApp, saveThroughSheet, openSongFromSearch } from '../lib/journeys.js';
import { openAccount, closeAccount, chooseDensity } from '../lib/journeys-account.js';
import { gotoTabFromSong } from '../lib/journeys-sync.js';

const TITLE = 'Porto de Lenha';
const SONG = [
  `# ${TITLE}`,
  '',
  '## Verso',
  '```',
  'C                     Fmaj7',
  'Vem a maré da tarde',
  'G           A7',
  'leva o barco',
  '```',
  '',
].join('\n');
const TAILS = ['Fmaj7', 'A7'];

// In the page, for each chord after the last word (the chart's `.s.tail`
// segments): a Range over the previous segment's words gives their right edge,
// a Range over the tail's chord glyph its left edge. Returns the chord, the gap
// and the chart's font size.
async function trailingGaps(chartHost) {
  return chartHost.evaluate((host) => {
    const chart = host.matches('.chart') ? host : host.querySelector('.chart');
    const fontSize = parseFloat(getComputedStyle(chart).fontSize);
    const textRect = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el.firstChild);
      return range.getBoundingClientRect();
    };
    return [...chart.querySelectorAll('.sung .s.tail')].map((tail) => {
      const words = tail.previousElementSibling.querySelector('.w');
      const glyph = tail.querySelector('.c');
      return {
        chord: glyph.textContent,
        gap: textRect(glyph).left - textRect(words).right,
        fontSize,
      };
    });
  });
}

async function expectGaps(chartHost) {
  await expect(chartHost.locator('.sung .s.tail')).toHaveCount(TAILS.length);
  const gaps = await trailingGaps(chartHost);
  expect(gaps.map((g) => g.chord)).toEqual(TAILS);
  for (const { chord, gap, fontSize } of gaps) {
    expect(gap, `${chord} keeps at least a quarter of the font size from the last word`).toBeGreaterThanOrEqual(
      0.25 * fontSize,
    );
  }
}

// From the open song: the account screen, a density, back to the song.
async function readAtDensity(page, density) {
  await gotoTabFromSong(page, 'Books');
  await openAccount(page);
  await chooseDensity(page, density);
  await closeAccount(page);
  await openSongFromSearch(page, 'Porto', TITLE);
}

test('a chord after the last word keeps its distance in the preview and the reading view', async ({
  page,
  checkA11y,
}, testInfo) => {
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

  // The preview: both chords after the words are drawn apart from them.
  if (phone) await page.getByRole('radio', { name: 'Preview' }).click();
  const preview = page.getByRole('region', { name: 'Preview' });
  await expectGaps(preview);
  await checkA11y(); // the editor with its preview

  await saveThroughSheet(page);
  await openSongFromSearch(page, 'Porto', TITLE);

  // The reading view at the default density, Comfortable.
  const chart = page.getByRole('group', { name: TITLE }).first();
  await expect(page.locator('div.est').first()).toHaveClass(/density-comfortable/);
  await expectGaps(chart);
  await checkA11y(); // the reading view

  // Compact, then Roomy: the gap follows the chart's size.
  await readAtDensity(page, 'Compact');
  await expectGaps(page.getByRole('group', { name: TITLE }).first());
  await readAtDensity(page, 'Roomy');
  await expectGaps(page.getByRole('group', { name: TITLE }).first());
});
