import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { startApp } from '../lib/journeys.js';

// e2e-web — the book-management screen against the compose stack, on the three
// viewports (the phone/tablet/computer projects auto-run every spec). Making and
// renaming a book is entirely in-app — a new book is an empty local repository
// created on the device with no account (workflow 7 L25) — so no song-seeding
// seam is needed and the journey is fully implementable now. Axe at WCAG 2.1 AA
// covers the shelf, the open Add-a-book sheet and the rename dialog on every
// viewport (contrast included — the real browser gives axe the layout jsdom
// lacks). Pins workflow 7 L14-25; DIRECTION §4 L434. The book name is written
// for this test (no-song-text rule).

const NAME = 'Quarta à noite';
const RENAMED = 'Quinta à noite';

test('a new book is made and renamed on the shelf, axe-clean on this viewport (workflow 7 L14-25)', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);

  // Open the Books destination — the book-management screen (DIRECTION §4 L434).
  await page.getByRole('tab', { name: 'Books' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();
  await checkA11y(); // the shelf (empty on a fresh device)

  // Add a book → New book: a name, and an empty local repository (workflow 7 L25).
  await page.getByRole('button', { name: 'Add a book' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await mockup(page, 'W07-add-a-book', 2);
  await checkA11y(); // the open Add-a-book sheet
  await sheet.getByRole('textbox', { name: 'Book name' }).fill(NAME);
  await sheet.getByRole('button', { name: 'New book' }).click();

  // It appears on the shelf (the open row, not the "Rename …" button).
  await expect(page.getByRole('button', { name: new RegExp(`^${NAME}`) })).toBeVisible();

  // Rename it on the shelf — a label that changes nothing in the repository
  // (workflow 7 L16-18).
  await page.getByRole('button', { name: `Rename ${NAME}` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await checkA11y(); // the rename dialog
  const field = dialog.getByRole('textbox', { name: 'Name on your shelf' });
  await field.fill(RENAMED);
  await dialog.getByRole('button', { name: 'Save' }).click();

  // The row shows the new name.
  await expect(page.getByRole('button', { name: new RegExp(`^${RENAMED}`) })).toBeVisible();
  await checkA11y(); // the shelf after the rename
});
