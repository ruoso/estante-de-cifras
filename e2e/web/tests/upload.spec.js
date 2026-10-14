import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { startApp, gotoTab, openFiles } from '../lib/journeys.js';

// e2e-web — the upload preview surface against the compose stack, on the three
// viewports (the phone/tablet/computer projects auto-run every spec). The whole
// journey is local: a `.zip` is read in the browser, previewed by the Worker and
// imported to a local book with no account (workflow 7 §Uploading a book) — so no
// seeding seam is needed. Axe at WCAG 2.1 AA covers the picker, the open preview
// and the merge preview on every viewport (contrast included — the real browser
// gives axe the layout jsdom lacks). Pins workflow 7 L64-99; DIRECTION §4 L434.
//
// Fixtures are authored for this test (no-song-text rule): `book.zip` is a small
// book (a README giving the title + two songs); `merge.zip` shares one song's
// path (a *replace* row) and adds one new song (an *added* row).

const here = dirname(fileURLToPath(import.meta.url));
const BOOK_ZIP = join(here, '../fixtures/upload/book.zip');
const MERGE_ZIP = join(here, '../fixtures/upload/merge.zip');
const TITLE = 'Banda do Bairro';

async function openBooks(page) {
  await startApp(page);
  await gotoTab(page, 'Books');
}

// Pick a zip through the Add-a-book Upload way-in; the full-screen preview opens.
async function uploadZip(page, zipPath, checkA11y) {
  await page.getByRole('button', { name: 'Add a book' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('A zip of a book, with or without its history.')).toBeVisible();
  if (checkA11y) await checkA11y(); // the picker
  await sheet.locator('input[type="file"]').setInputFiles(zipPath);
  await expect(page.getByRole('radiogroup', { name: 'What to do with the upload' })).toBeVisible();
}

test('a zip uploaded as a new book appears on the shelf (workflow 7 §Ends one of two ways)', async ({
  page,
  checkA11y,
}) => {
  await openBooks(page);
  await uploadZip(page, BOOK_ZIP, checkA11y);

  // Every song previews as *added*; the default choice is a new book (Decision 4).
  // Exact text: each row also carries a `.meta` summary line that names the song
  // ("Title added: Partida; …"), so a loose substring match is not unique.
  await expect(page.getByText('Partida', { exact: true })).toBeVisible();
  await expect(page.getByText('Chegada', { exact: true })).toBeVisible();
  await mockup(page, 'W07-add-a-book', 3);
  await checkA11y(); // the open preview

  await page.getByRole('button', { name: 'Import as a new book' }).click();

  // The new book (its README title) is on the shelf and the surface is gone.
  await expect(page.getByRole('button', { name: new RegExp(`^${TITLE}`) })).toBeVisible();
  await checkA11y(); // the shelf after import
});

test('a zip merged into an existing book replaces song by song (workflow 7 §A zip with no history)', async ({
  page,
  checkA11y,
}) => {
  await openBooks(page);

  // First bring a book onto the shelf to merge into.
  await uploadZip(page, BOOK_ZIP);
  await expect(page.getByText('Partida', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import as a new book' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^${TITLE}`) })).toBeVisible();

  // Now upload the merge zip and merge it into that book.
  await uploadZip(page, MERGE_ZIP);
  await page.getByRole('radio', { name: 'Merge into an existing book' }).click();
  await page.getByRole('radio', { name: TITLE }).click();

  // The preview shows the song by song list: the shared song as *replace*, the
  // new one as *added*. Exact text pins the status badge, not the `.meta` summary
  // line (which also contains words like "added").
  await expect(page.getByText('replace', { exact: true })).toBeVisible();
  await expect(page.getByText('added', { exact: true })).toBeVisible();
  await checkA11y(); // the merge preview

  await page.getByRole('button', { name: 'Merge and save' }).click();

  // The surface closes and the target reflects the import: open its files and
  // find the newly added song.
  await expect(page.getByRole('radiogroup', { name: 'What to do with the upload' })).toBeHidden();
  await openFiles(page, TITLE);
  await expect(page.getByText('nova.cifra.md')).toBeVisible();
  await checkA11y(); // the book's files after the merge
});
