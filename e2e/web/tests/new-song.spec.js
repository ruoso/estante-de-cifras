// new song (e2e-web) — writing a new song from nothing to a song saved in a
// book, against the compose stack, on the phone, tablet and computer projects
// (songs.new_song, workflow 3). The three ways in that have a host — the empty
// shelf, search's Create row, a book's section — each open the editor on a
// concrete book, and the first save names and commits the file; and all of it
// works offline. Axe runs at WCAG 2.1 AA on the ways-in surface, the editor host
// and the which-book control on every viewport. The file-view way in is
// books.file_view's (no file view exists yet — Decision 7). A fresh Playwright
// context is a first visit: the shelf and IndexedDB start empty. Fixtures are
// purpose-written songs — never anyone's copyrighted words.

import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';

// A full, canonicalisable song to type in place of the template.
const HARBOUR = [
  '# Harbour Lights',
  '- artist: The Jetty Trio',
  '- notation: brazilian',
  '',
  '## Intro',
  '```',
  'Am | Dm | G7 | C7M',
  '```',
  '',
];

// Replace the editor's template with `lines`, let the debounced WRITE settle so
// the first save reads the typed title, then press Save.
async function typeAndSave(page, lines) {
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(lines.join('\n'));
  // The debounced WRITE persists the buffer; the first save reads it back, so
  // wait for it before Save (mirrors editor.spec.js).
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Save' }).click();
}

test('from the empty shelf: Write a song opens the editor on My songs, the first save names and keeps it', async ({
  page,
  checkA11y,
}) => {
  await page.goto('/');
  await waitForServiceWorker(page);

  // The first-run ways-in surface is axe-clean.
  await checkA11y();

  await page.getByRole('button', { name: /Write a song/ }).click();

  // The host is up on My songs — the which-book control says so.
  await expect(page.getByText(/In My songs/)).toBeVisible();
  await checkA11y();

  await typeAndSave(page, HARBOUR);

  // Back on search, the song is on the shelf and findable without an unsaved
  // badge; My songs now exists as a book.
  await page.getByRole('searchbox').fill('Harbour');
  await expect(page.getByText('Harbour Lights')).toBeVisible();
  await expect(page.getByText('unsaved')).toHaveCount(0);

  await page.getByRole('searchbox').fill('');
  // The book row (not the "New song in…" / "Search only in…" scope buttons,
  // whose labels also contain "My songs"): anchor at the start so the regex
  // pins the book trigger, whose name is "My songs <count>".
  await expect(page.getByRole('button', { name: /^My songs/ })).toBeVisible();
});

test('from search (no match): Create "{query}" opens the template titled with the query', async ({
  page,
}) => {
  await page.goto('/');
  await waitForServiceWorker(page);

  await page.getByRole('searchbox').fill('Moonlit Pier');
  await page.getByRole('button', { name: /Create .Moonlit Pier./ }).click();

  // The template is titled with the query.
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await expect(content).toContainText('Moonlit Pier');

  // Put a chord in the empty fence and save; the song is then findable.
  await content.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText('Am G C');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('searchbox').fill('Moonlit');
  await expect(page.getByText('Moonlit Pier')).toBeVisible();
});

test('from a book section: new song in this book lands the song in that book', async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page);

  // Seed the bundled example book (the editor's e2e pattern), wait until indexed.
  await page.getByRole('button', { name: /Open the example book/ }).click();
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByText('Morning on the Porch')).toBeVisible();
  await page.getByRole('searchbox').fill('');

  await page.getByRole('button', { name: /New song in Example Book/ }).click();
  await expect(page.getByText(/In Example Book/)).toBeVisible();

  await typeAndSave(page, [
    '# Jetty at Dawn',
    '- artist: The Jetty Trio',
    '- notation: brazilian',
    '',
    '## Intro',
    '```',
    'C | G | Am | F',
    '```',
    '',
  ]);

  // It is in the example book: searching finds it, and its where is that book.
  await page.getByRole('searchbox').fill('Jetty at Dawn');
  await expect(page.getByText('Jetty at Dawn')).toBeVisible();
  await expect(page.getByText(/Example Book/)).toBeVisible();
});

test('offline: a new song can be written and saved, and persists', async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page);

  await runOffline(page, {
    path: '/',
    async whileOffline(offlinePage) {
      await offlinePage.getByRole('button', { name: /Write a song/ }).click();
      await expect(offlinePage.getByText(/In My songs/)).toBeVisible();
      await typeAndSave(offlinePage, HARBOUR);

      // The commit is kept locally with no network; the song is findable offline.
      await offlinePage.getByRole('searchbox').fill('Harbour');
      await expect(offlinePage.getByText('Harbour Lights')).toBeVisible();
      await expect(offlinePage.getByText('unsaved')).toHaveCount(0);
    },
  });
});
