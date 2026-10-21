// search-scope (e2e-web) — Search after a save shows where the song went
// (songs.search_scope_follows; workflow 2 §Scope — *A scoped search is that
// book's songs*, *After a save, the scope follows the song* — and §The search
// screen — a section's open state lasts the session), against the compose
// stack on the phone, tablet and computer projects, with axe at WCAG 2.1 AA on
// the scoped Search after the save.
//
// Pure real UI, no account: a local book made on the Books tab, Search scoped
// to it, then a song written for the test made through *Create* — which always
// lands in My songs. The Search-scope board is not a `mockup()` subject (W02's
// frames are captured by number; Decision 4), so this spec takes no capture.

import { test, expect } from '../lib/axe.js';
import { makeLocalBook, scopeToBook, gotoTab, startApp } from '../lib/journeys.js';
import { createSongFromSearch, escape } from '../lib/journeys-core.js';

const BOOK = 'Roda de Choro';
const MY_SONGS = 'My songs';
const SONG = 'Valsa do Quintal Vazio';
const BOOK_URL = /\/b\/[^/]+$/;

test('scoped to one book, a new song saved into My songs leaves Search scoped to My songs, the song in its open section; the open state lasts the session', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);
  await makeLocalBook(page, BOOK);
  await gotoTab(page, 'Search');
  await scopeToBook(page, BOOK);
  await expect(page).toHaveURL(BOOK_URL);
  const bookUrl = page.url();

  // Nothing matches in the book: Create makes the song in My songs, and the
  // first save returns to Search.
  await createSongFromSearch(page, SONG);
  await expect(page.getByRole('searchbox').first()).toBeVisible();

  // The scope followed the song: the chip and the bar name My songs, at its
  // own address (workflow 2 §Scope, *After a save*).
  const box = page.locator('.search').first();
  await expect(box.locator('.scope')).toContainText(MY_SONGS);
  await expect(page.locator('.book-bar').first().getByRole('heading', { name: MY_SONGS })).toBeVisible();
  await expect(page).toHaveURL(BOOK_URL);
  expect(page.url()).not.toBe(bookUrl);

  // With the box empty, My songs' section is open with the song under its
  // own count; the book the scope left has no section, and nothing reads
  // *0 songs* (workflow 2 §Scope, *A scoped search*).
  await page.getByRole('searchbox').first().fill('');
  const books = page.locator('.search-books').first();
  const mine = books.getByRole('button', { name: new RegExp(`^${escape(MY_SONGS)}`) });
  await expect(mine).toHaveAttribute('aria-expanded', 'true');
  await expect(mine).toContainText('1 song');
  await expect(books.locator('.search-row-open', { hasText: SONG })).toBeVisible();
  await expect(books.getByRole('button', { name: new RegExp(`^${escape(BOOK)}`) })).toHaveCount(0);
  await expect(page.getByText('0 songs')).toHaveCount(0);
  await checkA11y(); // the scoped Search after the save

  // Clearing the chip lists every book, each with its own count.
  await box.getByRole('button', { name: 'Clear filter' }).click();
  await expect(box.locator('.scope')).toHaveCount(0);
  await expect(books.getByRole('button', { name: new RegExp(`^${escape(MY_SONGS)}`) })).toContainText('1 song');
  const roda = books.getByRole('button', { name: new RegExp(`^${escape(BOOK)}`) });
  await expect(roda).toBeVisible();

  // A section opened stays open after Books and back (workflow 2 §The search
  // screen).
  await expect(roda).toHaveAttribute('aria-expanded', 'false');
  await roda.click();
  await expect(roda).toHaveAttribute('aria-expanded', 'true');
  await gotoTab(page, 'Books');
  await gotoTab(page, 'Search');
  await expect(
    page.locator('.search-books').first().getByRole('button', { name: new RegExp(`^${escape(BOOK)}`) }),
  ).toHaveAttribute('aria-expanded', 'true');
});
