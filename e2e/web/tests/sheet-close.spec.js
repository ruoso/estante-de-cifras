// sheet-close.spec.js (e2e-web) — a sheet's close ✕ sits at the sheet's right
// edge on the title's row, as W07 #2 L72-77 draws the Add a book sheet's header
// (shell.sheet_close_placement; workflow 7 §The book-management screen). The
// persona exploration of 2026-10-20 found it beside the words *Add a book*
// instead. Against the compose stack, on the phone/tablet/computer projects,
// then axe at WCAG 2.1 AA. Real-UI journeys only. The Share sheet, the song-share
// panel and the format help share the same `.sheet-head`; their behavior cases
// pin it.

import { test, expect } from '../lib/axe.js';
import { openAddABook, startApp } from '../lib/journeys.js';

test('the Add a book sheet’s close sits at its right edge (W07; workflow 7 §The book-management screen)', async ({
  page,
  checkA11y,
}, testInfo) => {
  await startApp(page);
  const dialog = await openAddABook(page);
  const heading = dialog.getByRole('heading', { name: 'Add a book' });
  const close = dialog.getByRole('button', { name: 'Close' });
  await expect(heading).toBeVisible();
  await expect(close).toBeVisible();

  const closeBox = await close.boundingBox();
  const headingBox = await heading.boundingBox();
  // The sheet's content edge: the `.sheet` around the dialog, less its padding.
  const contentRight = await dialog.evaluate((el) => {
    const sheet = el.closest('.sheet');
    const rect = sheet.getBoundingClientRect();
    return rect.x + rect.width - parseFloat(getComputedStyle(sheet).paddingRight);
  });
  // The heading's words, not its (growing) box.
  const textRight = await heading.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rect = range.getBoundingClientRect();
    return rect.x + rect.width;
  });
  const sheetWidth = await dialog.evaluate((el) => el.closest('.sheet').getBoundingClientRect().width);

  // On the title's row: the close's vertical centre is within the heading's box.
  const closeCentre = closeBox.y + closeBox.height / 2;
  expect(closeCentre).toBeGreaterThanOrEqual(headingBox.y);
  expect(closeCentre).toBeLessThanOrEqual(headingBox.y + headingBox.height);
  // At the sheet's right edge, within 1 px.
  expect(Math.abs(closeBox.x + closeBox.width - contentRight)).toBeLessThanOrEqual(1);
  // To the right of the words, and — where the sheet is wide — far from them.
  expect(closeBox.x).toBeGreaterThan(textRight);
  if (testInfo.project.name !== 'phone') {
    expect(closeBox.x - textRight).toBeGreaterThan(sheetWidth / 2);
  }

  await checkA11y();

  await close.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
