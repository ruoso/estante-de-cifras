import { test, expect } from '../lib/axe.js';
import { openExampleBook, openSongFromSearch, editFromReading, scopeToBook } from '../lib/journeys.js';
import { SONG } from '../lib/journeys-core.js';

// e2e-web — the URL follows where you are (shell.routing), on the three
// viewports: a song's address survives a reload, and the browser's back — the
// one Android's back is in the installed app and the TWA (DIRECTION §8) — steps
// back through what the person did instead of leaving the app. Pins DIRECTION
// §3.7 "The address follows where you are" and workflow 7 §Links to books.

const SONG_URL = /\/b\/[^/]+\/.+\.cifra\.md$/;
const BOOK_URL = /\/b\/[^/]+$/;
const EXAMPLE_BOOK = 'Example Book';

test('a song opened, reloaded and still open', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openSongFromSearch(page, SONG.search, SONG.title);
  await expect(page).toHaveURL(SONG_URL);

  await page.reload();
  await expect(page.getByRole('group', { name: SONG.title }).first()).toBeVisible();
  await expect(page).toHaveURL(SONG_URL);
  await checkA11y(); // the song, reopened from its address
});

test('back from a song to its book', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await scopeToBook(page, EXAMPLE_BOOK);
  await expect(page).toHaveURL(BOOK_URL);
  const bookUrl = page.url();
  await checkA11y(); // search scoped to the book

  await openSongFromSearch(page, SONG.search, SONG.title);
  await expect(page).toHaveURL(SONG_URL);
  await checkA11y(); // the song

  await page.goBack();
  await expect(page).toHaveURL(bookUrl);
  await expect(page.getByRole('group', { name: SONG.title })).toHaveCount(0);
  await expect(page.locator('.scope')).toContainText(EXAMPLE_BOOK);
  await expect(page.getByRole('button', { name: 'Clear filter' })).toBeVisible();
  await checkA11y(); // back on the book's songs
});

test('back closes the editor before the song', async ({ page }) => {
  await openExampleBook(page);
  await openSongFromSearch(page, SONG.search, SONG.title);
  const songUrl = page.url();
  await editFromReading(page);
  await expect(page).toHaveURL(songUrl);

  await page.goBack();
  await expect(page.locator('.cm-content')).toHaveCount(0);
  await expect(page.getByRole('group', { name: SONG.title }).first()).toBeVisible();
  await expect(page).toHaveURL(songUrl);

  await page.goBack();
  await expect(page.getByRole('group', { name: SONG.title })).toHaveCount(0);
  await expect(page.getByRole('searchbox').first()).toBeVisible();
  await expect(page).not.toHaveURL(SONG_URL);
});
