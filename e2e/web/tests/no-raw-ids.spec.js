import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, expect } from '../lib/axe.js';
import { startApp, gotoTab, openSongFromSearch } from '../lib/journeys.js';
import { uploadZip } from '../lib/journeys-files.js';
import { addSection, backToSearch } from '../lib/journeys-edit.js';

// e2e-web — no raw ids and no file-name titles in lists (songs.no_raw_ids), on
// the phone, tablet and computer projects, real UI only, axe at WCAG 2.1 AA at
// each assertion point. Pins workflow 3 L37-41 (the placeholder file name shows
// only in the file view), workflow 2 L180-185 and workflow 7 L16-21 (as amended:
// a book with no name is *Untitled book*, never its internal id).
//
// The *missing shelf entry* heal has no real-UI path (every cause is a crash
// window or a cleared database — the refinement's Decision 6), so it is pinned at
// the behavior level; this level carries the user-visible promise through the
// one real path that yields a book with no shelf title: a zip whose README has
// no heading.
//
// `untitled-book.zip` is authored for this test (no-song-text rule): a README of
// one prose line with no `#` heading, and one song with a title of its own.

const here = dirname(fileURLToPath(import.meta.url));
const UNTITLED_ZIP = join(here, '../fixtures/upload/untitled-book.zip');
const SONG = 'Quinta no Coreto';
const SECTION = 'Travessia';
const PLACEHOLDER = /untitled-\d|untitled$/;
const BOOK_ID = /local-[0-9a-f]{8}/;

test('A song written without a title is listed as Untitled song (workflow 3 L37-41; workflow 2 L180-182)', async ({
  page,
  checkA11y,
}, testInfo) => {
  await startApp(page);

  // The first-run way in: the editor on My songs with an empty `#` heading.
  await page.getByRole('button', { name: /Write a song/ }).click();
  await expect(page.locator('.cm-content')).toBeVisible();
  // A chord section only — no heading typed.
  await addSection(page, SECTION);
  await page.waitForTimeout(800); // the write debounce
  await backToSearch(page);

  // The row reads *Untitled song*, never its placeholder file name.
  await page.getByRole('searchbox').first().fill(SECTION);
  await expect(page.getByRole('button', { name: /^Untitled song/ }).first()).toBeVisible();
  await expect(page.getByText(PLACEHOLDER)).toHaveCount(0);
  await checkA11y(); // search

  // Opened from search, the reading header reads *Untitled song* too.
  await openSongFromSearch(page, SECTION, 'Untitled song');
  await expect(page.locator('.reading-chrome .title').first()).toHaveText('Untitled song');
  await expect(page.getByText(PLACEHOLDER)).toHaveCount(0);
  await checkA11y(); // reading

  // On a computer, the editor's Unsaved list names it the same way.
  if (testInfo.project.name === 'computer') {
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const pane = page.getByRole('region', { name: 'Unsaved' });
    await expect(pane.getByRole('row').filter({ hasText: 'Untitled song' })).toBeVisible();
    await expect(page.getByText(PLACEHOLDER)).toHaveCount(0);
    await checkA11y(); // the editor with its Unsaved list
  }
});

test('A book with no title is never shown by its id (workflow 7 L16-21; workflow 2 L183-185)', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);
  await gotoTab(page, 'Books');
  await uploadZip(page, UNTITLED_ZIP);
  await expect(page.getByText(SONG, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import as a new book' }).click();
  await expect(page.getByRole('radiogroup', { name: 'What to do with the upload' })).toBeHidden();

  const everywhere = async () => {
    // The Books list: a row named *Untitled book*.
    await gotoTab(page, 'Books');
    await expect(page.getByRole('button', { name: /^Untitled book/ }).first()).toBeVisible();
    await expect(page.getByText(BOOK_ID)).toHaveCount(0);
    await checkA11y(); // the Books list

    // Search: its section and the song row's meta.
    await gotoTab(page, 'Search');
    await expect(page.getByRole('button', { name: /^Untitled book/ }).first()).toBeVisible();
    await page.getByRole('searchbox').first().fill('Coreto');
    const row = page.getByRole('button', { name: new RegExp(`^${SONG}`) }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('Untitled book');
    await expect(page.getByText(BOOK_ID)).toHaveCount(0);
    await checkA11y(); // search

    // The song's reading header meta.
    await openSongFromSearch(page, 'Coreto', SONG);
    await expect(page.locator('.reading-meta').first()).toContainText('Untitled book');
    await expect(page.getByText(BOOK_ID)).toHaveCount(0);
    await checkA11y(); // reading
  };

  await everywhere();
  // After a reload the same holds.
  await startApp(page);
  await everywhere();
});
