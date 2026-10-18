import { test, expect, analyzeBothThemes } from '../lib/axe.js';
import {
  openExampleBook,
  openSongFromSearch,
  openSongInEditor,
  editFromReading,
  scopeToBook,
  gotoTab,
  saveSurface,
} from '../lib/journeys.js';
import { SONG, enterArrange } from '../lib/journeys-core.js';
import { hostedBookWithSong } from '../lib/journeys-share.js';
import { biaJoins, forkSheetTitle } from '../lib/journeys-fork.js';
import { addSection } from '../lib/journeys-edit.js';

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

// shell.routing_reload_scope_step — a reload under a screen over the song
// keeps only the song's address; back then leaves the song for the book's
// songs, passing over the entries the reload left showing the same song.
// Pins DIRECTION §3.7 and workflow 5 (arrange and the wizard as screens over a
// song).
async function songUnderArrangeFromBook(page) {
  await openExampleBook(page);
  await scopeToBook(page, EXAMPLE_BOOK);
  await expect(page).toHaveURL(BOOK_URL);
  const bookUrl = page.url();
  await openSongFromSearch(page, SONG.search, SONG.title);
  await enterArrange(page);
  return bookUrl;
}

async function expectBackOnTheBook(page, bookUrl) {
  await expect(page).toHaveURL(bookUrl);
  await expect(page.getByRole('group', { name: SONG.title })).toHaveCount(0);
  await expect(page.locator('.scope')).toContainText(EXAMPLE_BOOK);
}

test('back after a reload under arrange leaves the song', async ({ page, checkA11y }) => {
  const bookUrl = await songUnderArrangeFromBook(page);

  await page.reload();
  await expect(page.getByRole('group', { name: SONG.title }).first()).toBeVisible();
  await expect(page).toHaveURL(SONG_URL);
  await checkA11y(); // the song, reloaded without arrange

  await page.goBack();
  await expectBackOnTheBook(page, bookUrl);
  await checkA11y(); // the book's songs
});

test('back after a reload under the wizard leaves the song', async ({ page, checkA11y }) => {
  const bookUrl = await songUnderArrangeFromBook(page);
  await page.getByRole('button', { name: 'Run the wizard' }).click();
  await expect(page.getByRole('button', { name: 'The smoothest path' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('group', { name: SONG.title }).first()).toBeVisible();
  await page.goBack();
  await expectBackOnTheBook(page, bookUrl);
  await checkA11y(); // the book's songs
});

// shell.routing_rename_across_reload — a fork's new id reaches the history
// entries from before a reload. Ana's hosted book, Bia joins as a reader; on
// Bia's device: the book's songs (an entry naming the original), the song, a
// save that forks (fork.spec.js *saving where one cannot*), a reload, then
// back lands on the fork's songs, never the not-here screen. Pins DIRECTION
// §3.7, workflow 7 §Links to books, workflow 11 (the fork takes the original's
// place). Book and song names are written for this test.
test('back after a fork and a reload lands on the fork', async ({ browser, page }) => {
  test.setTimeout(120000);
  const BOOK = 'Serestas do Leo';
  const SONG_TITLE = 'Valsa da janela';
  const QUERY = 'Valsa';
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const bia = await biaJoins(browser, page, { book: BOOK, role: 'Reader', query: QUERY, songTitle: SONG_TITLE });
  try {
    await gotoTab(bia.page, 'Search');
    await scopeToBook(bia.page, BOOK);
    await expect(bia.page).toHaveURL(BOOK_URL);
    const originalUrl = bia.page.url();

    // The song → Edit → a section → Save → make it her own → the save form's Save.
    await openSongInEditor(bia.page, QUERY, SONG_TITLE);
    await addSection(bia.page, 'LeoPart');
    await bia.page.getByRole('button', { name: 'Save', exact: true }).first().click();
    // The offer in a dialog, or in the computer's save panel (songs.editor_chrome).
    const sheet = bia.page
      .getByRole('dialog', { name: forkSheetTitle(BOOK) })
      .or(bia.page.getByRole('region', { name: forkSheetTitle(BOOK) }));
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Make it my own' }).click();
    const form = saveSurface(bia.page);
    await expect(form.getByRole('button', { name: 'Save', exact: true })).toBeVisible({ timeout: 15000 });
    const nameField = form.getByRole('textbox', { name: /Your name/ });
    if (await nameField.count()) await nameField.fill('Bia');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(form).toBeHidden({ timeout: 15000 });
    await expect(bia.page).toHaveURL(SONG_URL);
    const originalId = new URL(originalUrl).pathname.split('/')[2];
    expect(new URL(bia.page.url()).pathname.split('/')[2]).not.toBe(originalId);

    await bia.page.reload();
    await expect(bia.page.getByRole('group', { name: SONG_TITLE }).first()).toBeVisible();

    await bia.page.goBack();
    await expect(bia.page).toHaveURL(BOOK_URL);
    expect(bia.page.url()).not.toBe(originalUrl);
    await expect(bia.page.getByRole('heading', { name: /This link doesn’t open a book/ })).toHaveCount(0);
    await expect(bia.page.locator('.scope')).toContainText(BOOK);
    expect(await analyzeBothThemes(bia.page)).toEqual([]); // axe: the fork's songs
  } finally {
    await bia.context.close();
  }
});
