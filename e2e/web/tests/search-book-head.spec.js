// search-book-head.spec.js (e2e-web) — a book's section on the search screen
// fits a phone (songs.search_book_head_narrow; usability review 2026-10-19
// finding M13). Against the compose stack, on the phone, tablet and computer
// projects; on the phone checked at its 412 px and again at 390 px. The header
// holds the bordered row, the plus and the filter only; a book with unsaved
// songs shows, on a line of its own under the header and outside what opens
// and closes, "2 songs with unsaved changes" and Save all, which opens the one
// save sheet. Pins workflow 2 §A book's section header (02-find-and-play.md
// L17-26) and the Review-polish board's Phone frame (Review-polish.dc.html
// L26-60) — that board is not in lib/mockup-frames.json, so the drawn
// arrangement is asserted instead of a mockup() frame (the refinement's
// Decision 4) — and workflow 4 §Several songs at once. Real-UI journeys only;
// fixtures are the bundled example book's purpose-written songs.

import { test, expect } from '../lib/axe.js';
import { expectFits, expectInsideViewport } from '../lib/fit.js';
import { openExampleBook, openSongInEditor } from '../lib/journeys.js';
import { addSection, backToSearch } from '../lib/journeys-edit.js';

const SONG_TITLE = 'Morning on the Porch';
const FERRY_TITLE = 'The Ferry Line';

// The width the explorers' phones had, beside the phone project's 412 px.
const NARROW = 390;

const centre = (b) => b.y + b.height / 2;
const sameRow = (a, b) => Math.abs(centre(a) - centre(b)) <= Math.max(a.height, b.height) / 2;

// Leave two example-book songs unsaved through the real UI (one session, no
// reload: the live unsaved flags exist only in it), then come back to search
// with an empty box, where the book's section lists.
async function twoUnsavedSongs(page) {
  await openExampleBook(page);
  await openSongInEditor(page, 'Morning', SONG_TITLE);
  await addSection(page, 'CodaOne');
  await backToSearch(page);
  await openSongInEditor(page, 'Ferry', FERRY_TITLE);
  await addSection(page, 'CodaTwo');
  await backToSearch(page);
  await page.getByRole('searchbox').fill('');
}

function sectionParts(page) {
  return {
    trigger: page.getByRole('button', { name: /^Example Book/ }),
    plus: page.getByRole('button', { name: 'New song in Example Book' }),
    filter: page.getByRole('button', { name: 'Search only in Example Book' }),
    saveAll: page.getByRole('button', { name: 'Save all changes in Example Book' }),
    count: page.getByText('2 songs with unsaved changes', { exact: true }),
  };
}

test('a book section with unsaved songs: the header holds the row and two icons, Save all on its own line, nothing clipped; axe', async ({
  page,
  checkA11y,
}, testInfo) => {
  await twoUnsavedSongs(page);
  const { trigger, plus, filter, saveAll, count } = sectionParts(page);
  await expect(count).toBeVisible();
  await expect(saveAll).toBeVisible();
  await expect(saveAll).toHaveText('Save all');

  const before = page.viewportSize();
  const widths = testInfo.project.name === 'phone' ? [before.width, NARROW] : [before.width];
  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height: before.height });
      await saveAll.scrollIntoViewIfNeeded();
      const t = await trigger.boundingBox();
      const p = await plus.boundingBox();
      const f = await filter.boundingBox();
      const s = await saveAll.boundingBox();
      // The plus and the filter sit on the trigger's row…
      expect(sameRow(t, p), `${width}px: the plus is on the trigger's row`).toBe(true);
      expect(sameRow(t, f), `${width}px: the filter is on the trigger's row`).toBe(true);
      // …and Save all below it, on a line of its own.
      expect(s.y, `${width}px: Save all sits below the trigger`).toBeGreaterThanOrEqual(t.y + t.height - 1);

      await expectFits(page, { whole: [saveAll] });
      await expectInsideViewport(page, plus, `${width}px: the plus`);
      await expectInsideViewport(page, filter, `${width}px: the filter`);
      await expectInsideViewport(page, saveAll, `${width}px: Save all`);
      await checkA11y();
    }
  } finally {
    await page.setViewportSize(before);
  }
});

test('the section closed still shows the line, and Save all opens the sheet listing both songs', async ({ page }) => {
  await twoUnsavedSongs(page);
  const { trigger, saveAll, count } = sectionParts(page);

  // Closed (workflow 2: the line shows with the section closed too).
  if ((await trigger.getAttribute('aria-expanded')) === 'true') await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(count).toBeVisible();
  await expect(saveAll).toBeVisible();

  // Save all opens the one sheet naming both songs (workflow 4 §Several songs
  // at once); Escape closes it with nothing saved.
  await saveAll.click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(SONG_TITLE, { exact: true })).toBeVisible();
  await expect(sheet.getByText(FERRY_TITLE, { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(count).toBeVisible();
  await expect(saveAll).toBeVisible();
});
