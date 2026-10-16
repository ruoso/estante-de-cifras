// full-height.spec.js (e2e-web) — full-screen surfaces scroll inside, not the
// page (shell.full_height). The themed root is exactly the window, so on every
// surface a long content scrolls its own container, the document never
// overflows, and the surface's chrome (the app bar, the phone tab bar, the
// explorer's chord input and instrument chip) stays in view. Against the compose
// stack, on the phone/tablet/computer projects; each visit drives the surface
// through the real UI, then shortens the viewport to a fixed short height
// (keeping the project's width, so the narrow/wide layout is unchanged) so the
// example book's ordinary content is "long", asserts the geometry with
// lib/scroll.js's expectScrollsInside, and runs axe at WCAG 2.1 AA. Pins
// DIRECTION §4 (the surfaces in a fixed frame), workflow 16 L154-156, workflow 7
// §Uploading a book, sync.read_in_place Decision 4 (the reading scroll port) and
// workflow 2 L85, L100 (print).

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, expect } from '../lib/axe.js';
import { expectScrollsInside, shortenViewport, SHORT_HEIGHT } from '../lib/scroll.js';
import {
  gotoTab,
  openExampleBook,
  openFileInFiles,
  openFiles,
  openSongFromSearch,
  startApp,
} from '../lib/journeys.js';
import {
  SONG,
  addInstrument,
  chip,
  closeInstruments,
  enterArrange,
  escape,
  openExplorerFor,
  toPreview,
} from '../lib/journeys-core.js';
import { buildHistory, openFirstVersion, openHistory } from '../lib/journeys-edit.js';
import { EXAMPLE_BOOK, addToNewSetlist, openFilesHistory, uploadZip } from '../lib/journeys-files.js';
import { openAccount } from '../lib/journeys-account.js';
import { gotoTabFromSong } from '../lib/journeys-sync.js';

const here = dirname(fileURLToPath(import.meta.url));
const BOOK_ZIP = join(here, '../fixtures/upload/book.zip');
const MERGE_ZIP = join(here, '../fixtures/upload/merge.zip');
const UPLOADED = 'Banda do Bairro';
const SONG_FILE = 'morning-on-the-porch.cifra.md';

// The navigation (the phone's tab bar, the wide layouts' rail).
const tabBar = (page) => page.getByRole('tablist');
// The full-screen surface's app bar.
const appBar = (page) => page.locator('.appbar').filter({ visible: true }).first();

const openSong = (page) => openSongFromSearch(page, SONG.search, SONG.title);

// Enough setlists that the Setlists destination is a long list.
const SETLISTS = 12;
// Enough saves that the book's history is a long list.
const BOOK_SAVES = ['Coda', 'Bridge', 'Interlude', 'Outro', 'Tag', 'Vamp', 'Break'];

// From Books: the authored upload fixture imported as a second book.
async function importUploadedBook(page) {
  await uploadZip(page, BOOK_ZIP);
  await page.getByRole('button', { name: 'Import as a new book' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^${UPLOADED}`) })).toBeVisible();
}

test('search: the results scroll, the field and the tab bar stay (DIRECTION §4)', async ({ page, checkA11y }) => {
  // Two books on the shelf, and a chord most of their songs play: a list.
  await openExampleBook(page);
  await gotoTab(page, 'Books');
  await importUploadedBook(page);
  await gotoTab(page, 'Search');
  await page.getByRole('searchbox').fill('C');
  await expect(page.getByRole('button', { name: /Partida/ }).first()).toBeVisible();
  await shortenViewport(page);
  await expectScrollsInside(page, { stayInView: [page.getByRole('searchbox'), tabBar(page)] });
  await checkA11y();
});

test('books: the book scrolls inside the Books destination, the tab bar stays (DIRECTION §4)', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await gotoTab(page, 'Books');
  // The book's detail: beside the list on the wide layout, in its place on the
  // narrow ones.
  await page.getByRole('button', { name: new RegExp(`^${escape(EXAMPLE_BOOK)}`) }).first().click();
  await expect(page.locator('.book-detail')).toBeVisible();
  await shortenViewport(page);
  await expectScrollsInside(page, { stayInView: [tabBar(page)] });
  await checkA11y();
});

test('setlists: a long list of setlists scrolls inside the destination, the tab bar stays', async ({
  page,
  checkA11y,
}) => {
  test.setTimeout(120000);
  await openExampleBook(page);
  for (let i = 1; i <= SETLISTS; i++) await addToNewSetlist(page, SONG.search, SONG.title, `Rehearsal ${i}`);
  await gotoTab(page, 'Setlists');
  await expect(page.getByRole('button', { name: new RegExp(`Rehearsal ${SETLISTS}`) })).toBeVisible();
  await shortenViewport(page);
  await expectScrollsInside(page, { stayInView: [tabBar(page)] });
  await checkA11y();
});

test('account: the account screen scrolls inside itself', async ({ page, checkA11y }) => {
  await startApp(page);
  await openAccount(page);
  await shortenViewport(page);
  // The screen's chrome stays put: the app bar on a phone and tablet, the rail
  // head on a computer (account.preferences_layout) — both carry Back.
  await expectScrollsInside(page, {
    stayInView: [page.getByRole('button', { name: 'Back', exact: true }).first()],
  });
  await checkA11y();
});

test('arrange: the song scrolls under the app bar', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);
  await shortenViewport(page);
  await expectScrollsInside(page, { stayInView: [appBar(page)] });
  await checkA11y();
});

test('wizard: the plan scrolls under the app bar', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);
  await toPreview(page);
  await shortenViewport(page);
  await expectScrollsInside(page, { stayInView: [appBar(page)] });
  await checkA11y();
});

test('song history: a version scrolls under the app bar, its actions in view (beside the list on the computer)', async ({
  page,
  checkA11y,
}) => {
  test.setTimeout(90000);
  await buildHistory(page, ['Coda', 'Bridge', 'Interlude', 'Outro']);
  await openHistory(page);
  await openFirstVersion(page);
  await shortenViewport(page);
  // The version's actions stay in view too: the phone's bar after the scroller,
  // the app bar on tablet and computer (songs.history_phone_actions; W06#2).
  await expectScrollsInside(page, {
    stayInView: [
      appBar(page),
      page.getByRole('button', { name: 'Compare with now' }),
      page.getByRole('button', { name: 'Restore this version' }),
    ],
  });
  await checkA11y(); // the version view (and, on the computer, the list beside it)
});

test('file view: the tree scrolls under its bar', async ({ page, checkA11y }) => {
  test.setTimeout(90000);
  // Setlists made on the device are files in the book: a longer tree.
  await openExampleBook(page);
  for (let i = 1; i <= 6; i++) await addToNewSetlist(page, SONG.search, SONG.title, `Rehearsal ${i}`);
  await openFiles(page, EXAMPLE_BOOK);
  await expect(page.getByRole('button', { name: new RegExp(`^${escape(SONG_FILE)}`) })).toBeVisible();
  await shortenViewport(page);
  await expectScrollsInside(page, { stayInView: [appBar(page)] });
  await checkA11y();
});

test('file view: the book’s history scrolls under its bar', async ({ page, checkA11y }) => {
  test.setTimeout(150000);
  await buildHistory(page, BOOK_SAVES);
  await gotoTabFromSong(page, 'Books');
  await openFiles(page, EXAMPLE_BOOK);
  await openFilesHistory(page);
  await expect(page.getByText(`Add a ${BOOK_SAVES.at(-1)}`).first()).toBeVisible();
  await shortenViewport(page);
  await expectScrollsInside(page, { stayInView: [appBar(page)] });
  await checkA11y();
});

test('file view: an open file scrolls in its editor under the bar', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openFileInFiles(page, EXAMPLE_BOOK, SONG_FILE);
  await expect(page.locator('.cm-content')).toBeVisible();
  await shortenViewport(page);
  await expectScrollsInside(page, { stayInView: [appBar(page)] });
  await checkA11y();
});

test('new song: a long draft scrolls in the editor, Save stays in the app bar', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  const title = 'Tall Draft';
  await page.getByRole('searchbox').fill(title);
  await page.getByRole('button', { name: new RegExp(`^Create .${escape(title)}.`) }).click();
  const content = page.locator('.cm-content');
  await expect(content).toContainText(title);
  await content.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText(Array.from({ length: 30 }, () => 'Am | G | C | F').join('\n'));
  await shortenViewport(page);
  await expectScrollsInside(page, {
    stayInView: [appBar(page), page.getByRole('button', { name: 'Save', exact: true }).first()],
  });
  await checkA11y();
});

test('chord explorer: the results scroll, the chord input and the chip stay (workflow 16 L154-156)', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);
  // The built-in guitar is listed too (music.instruments_roster_default), so wait
  // on the added one's own row.
  await addInstrument(page, { listed: 'Guitar (6-string) · Standard' });
  await closeInstruments(page);
  await openExplorerFor(page, 'A');
  await shortenViewport(page);
  await expectScrollsInside(page, {
    stayInView: [page.getByRole('textbox', { name: 'Chord' }), chip(page).filter({ visible: true }).first()],
  });
  await checkA11y();
});

test('upload preview: a merge preview scrolls, its import action reachable at the end (workflow 7)', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);
  await gotoTab(page, 'Books');
  await importUploadedBook(page);
  await uploadZip(page, MERGE_ZIP);
  await page.getByRole('radio', { name: 'Merge into an existing book' }).click();
  await page.getByRole('radio', { name: UPLOADED }).click();
  await expect(page.getByText('replace', { exact: true })).toBeVisible();
  await shortenViewport(page);
  await expectScrollsInside(page, {
    stayInView: [page.getByRole('button', { name: 'Merge and save' })],
  });
  await checkA11y();
});

test('reading: the song scrolls in the reading body, the chrome stays (sync.read_in_place Decision 4)', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await openSong(page);
  await shortenViewport(page);
  const chrome = page.locator('.reading-chrome').filter({ visible: true });
  const stayInView = [];
  for (let i = 0; i < (await chrome.count()); i++) stayInView.push(chrome.nth(i));
  expect(stayInView.length).toBeGreaterThan(0);
  await expectScrollsInside(page, { stayInView });
  await checkA11y();
});

test('print: the reading view prints the whole song in flow, not the window’s slice (workflow 2 L85, L100)', async ({
  page,
}) => {
  await openExampleBook(page);
  await openSong(page);
  await shortenViewport(page);
  await page.emulateMedia({ media: 'print' });
  const { scrollHeight, clientHeight } = await page.evaluate(() => {
    const doc = document.scrollingElement;
    return { scrollHeight: doc.scrollHeight, clientHeight: doc.clientHeight };
  });
  expect(clientHeight).toBe(SHORT_HEIGHT);
  expect(scrollHeight).toBeGreaterThan(clientHeight);
});
