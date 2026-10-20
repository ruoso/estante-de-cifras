import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { startApp, gotoTab } from '../lib/journeys.js';

// e2e-web — the book-management screen against the compose stack, on the three
// viewports (the phone/tablet/computer projects auto-run every spec). Making and
// renaming a book is entirely in-app — a new book is an empty local repository
// created on the device with no account (workflow 7 L25) — so no song-seeding
// seam is needed and the journey is fully implementable now. Rename lives on
// the book's detail, reached from *Manage* on the bar above the book's songs
// (books.row_opens_songs; workflow 7 L86-95). Axe at WCAG 2.1 AA covers the
// shelf, the Add-a-book chooser and its New book step, and the rename dialog on
// every viewport (contrast included — the real browser gives axe the layout
// jsdom lacks). Pins workflow 7 L14-25; DIRECTION §4 L434. The book name is
// written for this test (no-song-text rule).

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

  // Add a book: a chooser of four ways in, no field yet (books.add_book_chooser;
  // W07 #2 L58-103; workflow 7 L23-38).
  await page.getByRole('button', { name: 'Add a book' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add a book' });
  await expect(sheet).toBeVisible();
  const newRow = sheet.getByRole('button', { name: 'New book' });
  await expect(newRow).toHaveAccessibleDescription('A name, and an empty book. No account needed.');
  await expect(sheet.getByRole('button', { name: 'By link' })).toHaveAccessibleDescription(
    'Paste a link to a book on Estante.',
  );
  await expect(sheet.getByRole('group', { name: 'Mine on Estante' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Upload' })).toHaveAccessibleDescription(
    'A zip of a book, with or without its history.',
  );
  await expect(sheet.getByRole('textbox', { name: 'Book name' })).toHaveCount(0);
  await mockup(page, 'W07-add-a-book', 2, { note: 'chooser' });
  await checkA11y(); // the chooser

  // New book → its step (the field focused) → Back → the chooser, focus on the
  // row it came from.
  await newRow.click();
  const nameField = sheet.getByRole('textbox', { name: 'Book name' });
  await expect(nameField).toBeFocused();
  await checkA11y(); // the New book step
  await sheet.getByRole('button', { name: 'Back' }).click();
  await expect(nameField).toHaveCount(0);
  await expect(newRow).toBeFocused();

  // By keyboard this time: Enter on the focused row opens the step again;
  // a name, and an empty local repository (workflow 7 L25).
  await page.keyboard.press('Enter');
  await expect(nameField).toBeFocused();
  await nameField.fill(NAME);
  await sheet.getByRole('button', { name: 'New book' }).click();
  await expect(sheet).toBeHidden();

  // It appears on the shelf, a row with no rename control of its own.
  await expect(page.getByRole('button', { name: new RegExp(`^${NAME}`) })).toBeVisible();
  await expect(page.getByRole('button', { name: `Rename ${NAME}` })).toHaveCount(0);

  // Rename it from its detail — Books → the book's songs → Manage → Rename, a
  // label that changes nothing in the repository (workflow 7 L16-18, L89).
  await page.getByRole('button', { name: new RegExp(`^${NAME}`) }).click();
  await page.getByRole('button', { name: `Manage ${NAME}` }).first().click();
  await page.getByRole('button', { name: `Rename ${NAME}` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await checkA11y(); // the rename dialog
  const field = dialog.getByRole('textbox', { name: 'Name on your shelf' });
  await field.fill(RENAMED);
  await dialog.getByRole('button', { name: 'Save' }).click();

  // The detail's title follows; back on the shelf the row shows the new name.
  await expect(page.getByRole('button', { name: `Rename ${RENAMED}` })).toBeVisible();
  await gotoTab(page, 'Books');
  await expect(page.getByRole('button', { name: new RegExp(`^${RENAMED}`) })).toBeVisible();
  await checkA11y(); // the shelf after the rename
});
