// fork (e2e-web) — making a book your own against the compose stack, on the
// phone/tablet/computer projects, with axe at WCAG 2.1 AA on every screen it
// touches (books.fork; workflow 11 §Ways in, §What a fork is, §Following the
// original; workflow 4 §A book the user cannot push to; workflow 8 §Losing
// access; workflow 10 L83-85).
//
// Pure real UI. Ana (the `page`) owns a hosted book with one song and invites Bia
// (a second context) through the Share dialog; Bia joins through the link. The
// four ways in are each driven to a completed fork: deliberately from the book
// detail's Fork card, by saving in a book Bia can only read, after losing access
// with a save not yet pushed, and after being lowered to reader with one. The
// only read below the UI is Bia's books list (GET /api/books), to see the fork
// is hers on Estante. Book and song names are written for these tests
// (no-song-text rule).

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';
import { openSongFromSearch, openSongInEditor, saveSurface, syncNow, gotoTab } from '../lib/journeys.js';
import {
  hostedBookWithSong,
  openSharing,
  removeFirstMember,
  addSectionAndSave,
  booksList,
} from '../lib/journeys-share.js';
import { biaJoins as joins, makeItMyOwn as confirmSheet, bookRowName, forkSheetTitle } from '../lib/journeys-fork.js';
import { addSection } from '../lib/journeys-edit.js';
import { mockup } from '../lib/mockup.js';

const BOOK = 'Choros da Ana';
const SONG_TITLE = 'Roda de rua';
const QUERY = 'Roda';
const bookRow = bookRowName(BOOK);
const SHEET_TITLE = forkSheetTitle(BOOK);

// Bia joins Ana's book as `role` (journeys-fork.js), the song on Bia's device.
const biaJoins = (browser, page, role) => joins(browser, page, { book: BOOK, role, query: QUERY, songTitle: SONG_TITLE });
// The make-it-your-own sheet is open: axe it, then confirm.
const makeItMyOwn = (page) => confirmSheet(page, BOOK);

// The shelf shows one row for the book, reading *from {book}*.
async function expectOneForkRow(page) {
  await booksList(page);
  await expect(page.getByRole('button', { name: bookRow })).toHaveCount(1);
  await expect(page.getByText(`from ${BOOK}`, { exact: true })).toBeVisible();
}

// Search finds the song exactly once (its open button's name starts with the
// title; the row's *Add … to a setlist* button does not).
async function expectSongOnce(page) {
  // A full-screen song on a phone hides the tabs: Back to the destinations.
  const tab = page.getByRole('tab', { name: 'Search' });
  if (!(await tab.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /^Back/ }).filter({ visible: true }).first().click();
  }
  await gotoTab(page, 'Search');
  await page.getByRole('searchbox').first().fill(QUERY);
  const hits = page.getByRole('button', { name: new RegExp(`^${SONG_TITLE}`) });
  await expect(hits.first()).toBeVisible();
  await expect(hits).toHaveCount(1);
}

// Bia's books list on Estante: the fork is hers, and remembers its original.
async function expectForkOwnedOnEstante(page) {
  const resp = await page.request.get('/api/books');
  expect(resp.ok()).toBeTruthy();
  const { books } = await resp.json();
  const fork = books.find((b) => b.title === BOOK && b.role === 'owner');
  expect(fork, 'the fork is on Estante, owned by Bia').toBeTruthy();
  return fork;
}

test('deliberately: a reader forks from the book detail, and a new save of the original is counted', async ({
  browser,
  page,
}) => {
  test.setTimeout(120000);
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const bia = await biaJoins(browser, page, 'Reader');
  try {
    // Books → the book → Fork (workflow 11 §Ways in, deliberately).
    await booksList(bia.page);
    await bia.page.getByRole('button', { name: bookRow }).click();
    await expect(
      bia.page.getByText(`Your own copy of ${BOOK}, with its history, that keeps following it.`),
    ).toBeVisible();
    await bia.page.getByRole('button', { name: 'Fork', exact: true }).click();
    await makeItMyOwn(bia.page);

    // The fork took the original's place: one row, *from {book}*, and the
    // one-time note (W11 board #2).
    await expectOneForkRow(bia.page);
    await expect(bia.page.getByText(/is your own now/)).toBeVisible();
    expect(await analyzeWcag21aa(bia.page)).toEqual([]); // axe: the shelf after forking
    await mockup(bia.page, 'W11-fork', 2);
    await expectSongOnce(bia.page);

    // Ana saves in her book; Bia's next sync counts it (§Following the original).
    await openSongInEditor(page, QUERY, SONG_TITLE);
    await addSectionAndSave(page, 'AnaPart', { name: 'Ana' });
    await expect(async () => {
      await syncNow(bia.page);
      await expect(bia.page.getByText(`${BOOK} has 1 new save.`)).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });
    expect(await analyzeWcag21aa(bia.page)).toEqual([]); // axe: the shelf with the count
  } finally {
    await bia.context.close();
  }
});

test('saving where one cannot: Save in a reader’s book offers the fork, and the save lands there', async ({
  browser,
  page,
}) => {
  test.setTimeout(120000);
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const bia = await biaJoins(browser, page, 'Reader');
  const MARK = 'BiaPart';
  try {
    // Song → Edit → a section → Save: the sheet asks to make it her own
    // (workflow 4 L86-91; W11 board #1).
    await openSongInEditor(bia.page, QUERY, SONG_TITLE);
    await addSection(bia.page, MARK);
    await bia.page.getByRole('button', { name: 'Save', exact: true }).first().click();
    // The offer in a dialog, or in the computer's save panel (songs.editor_chrome).
    const sheet = bia.page
      .getByRole('dialog', { name: SHEET_TITLE })
      .or(bia.page.getByRole('region', { name: SHEET_TITLE }));
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(`You can read ${BOOK}, but not save to it.`, { exact: false })).toBeVisible();
    expect(await analyzeWcag21aa(bia.page)).toEqual([]); // axe: the cannot-save sheet
    await mockup(bia.page, 'W11-fork', 1);

    // Make it my own → the ordinary save form, for the fork → Save.
    await sheet.getByRole('button', { name: 'Make it my own' }).click();
    const form = saveSurface(bia.page);
    await expect(form.getByRole('button', { name: 'Save', exact: true })).toBeVisible({ timeout: 15000 });
    const nameField = form.getByRole('textbox', { name: /Your name/ });
    if (await nameField.count()) await nameField.fill('Bia');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(form).toBeHidden({ timeout: 15000 });

    // Bia's song carries the section, in her own book on the shelf.
    await expectSongOnce(bia.page);
    await openSongFromSearch(bia.page, QUERY, SONG_TITLE);
    await expect(bia.page.locator('.reading-sheet')).toContainText(MARK);
    await expectOneForkRow(bia.page);
    expect(await analyzeWcag21aa(bia.page)).toEqual([]); // axe: the shelf after forking

    // Ana's song does not have it after her sync.
    await syncNow(page);
    await openSongFromSearch(page, QUERY, SONG_TITLE);
    await expect(page.locator('.reading-sheet')).toBeVisible();
    await expect(page.locator('.reading-sheet')).not.toContainText(MARK);
  } finally {
    await bia.context.close();
  }
});

test('after losing access: the unpushed save arrives on Estante in Bia’s own book', async ({
  browser,
  page,
}) => {
  test.setTimeout(120000);
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const bia = await biaJoins(browser, page, 'Editor');
  const MARK = 'KeptPart';
  try {
    // Ana removes Bia first, so Bia's next save is deterministically unpushed
    // (lost-access.spec's ordering).
    const dialog = await openSharing(page, BOOK);
    await removeFirstMember(page, dialog);
    await expect(dialog.getByText('0 of 50')).toBeVisible();

    await openSongInEditor(bia.page, QUERY, SONG_TITLE);
    await addSectionAndSave(bia.page, MARK, { name: 'Bia' });

    // Sync now → no longer shared with you → the book → Make this book your own.
    await syncNow(bia.page);
    await expect(bia.page.getByText('no longer shared with you')).toBeVisible({ timeout: 15000 });
    await bia.page.getByRole('button', { name: bookRow }).click();
    await bia.page.getByRole('button', { name: 'Make this book your own' }).click();
    // Following has already ended: no *keeps following* point.
    await expect(bia.page.getByRole('dialog').getByText(/keeps following/)).toHaveCount(0);
    await makeItMyOwn(bia.page);

    // The row reads *from {book}* with *original no longer shared* (workflow 11
    // L41-46).
    await expectOneForkRow(bia.page);
    await expect(bia.page.getByText('original no longer shared', { exact: true })).toBeVisible();
    expect(await analyzeWcag21aa(bia.page)).toEqual([]); // axe: the shelf with the badge

    // After a sync the row is in step (no waiting or refusal word), the section
    // is in the song, and the fork is Bia's on Estante.
    await syncNow(bia.page);
    const row = bia.page.getByRole('button', { name: bookRow });
    await expect(row).not.toContainText(/waiting|can’t save|no longer shared with you/, { timeout: 15000 });
    await expectForkOwnedOnEstante(bia.page);
    await openSongFromSearch(bia.page, QUERY, SONG_TITLE);
    await expect(bia.page.locator('.reading-sheet')).toContainText(MARK);
    expect(await analyzeWcag21aa(bia.page)).toEqual([]); // axe: reading the fork
  } finally {
    await bia.context.close();
  }
});

test('lowered to reader with a save not yet pushed: can’t save here, then the fork takes the save', async ({
  browser,
  page,
}) => {
  test.setTimeout(120000);
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const bia = await biaJoins(browser, page, 'Editor');
  const MARK = 'LoweredPart';
  try {
    // Ana lowers Bia with Make reader on the people screen.
    const dialog = await openSharing(page, BOOK);
    const memberRow = dialog
      .locator('.est-sharing-member', { has: page.getByRole('button', { name: 'Remove' }) })
      .first();
    await memberRow.getByRole('button', { name: /’s role$/ }).click();
    await page.getByRole('menuitem', { name: 'Make reader' }).click();
    await expect(memberRow.getByRole('button', { name: /’s role$/ })).toContainText('Reader');

    // Bia's shelf still says editor, so she saves; the push is refused.
    await openSongInEditor(bia.page, QUERY, SONG_TITLE);
    await addSectionAndSave(bia.page, MARK, { name: 'Bia' });

    // Sync now → *can't save here* → the book says why → make it her own.
    await syncNow(bia.page);
    await expect(bia.page.getByText('can’t save here')).toBeVisible({ timeout: 15000 });
    expect(await analyzeWcag21aa(bia.page)).toEqual([]); // axe: the shelf with the refusal
    await bia.page.getByRole('button', { name: bookRow }).click();
    await expect(
      bia.page.getByText(`1 save can no longer go to ${BOOK}: you can read it, but no longer save to it.`),
    ).toBeVisible();
    await expect(bia.page.getByRole('button', { name: 'Download' })).toBeVisible();
    expect(await analyzeWcag21aa(bia.page)).toEqual([]); // axe: the cannot-save detail
    await bia.page.getByRole('button', { name: 'Make this book your own' }).click();
    await makeItMyOwn(bia.page);

    // After a sync the fork is in step with the section in it.
    await expectOneForkRow(bia.page);
    await syncNow(bia.page);
    const row = bia.page.getByRole('button', { name: bookRow });
    await expect(row).not.toContainText(/waiting|can’t save/, { timeout: 15000 });
    await expectForkOwnedOnEstante(bia.page);
    await openSongFromSearch(bia.page, QUERY, SONG_TITLE);
    await expect(bia.page.locator('.reading-sheet')).toContainText(MARK);
    expect(await analyzeWcag21aa(bia.page)).toEqual([]); // axe: reading the fork
  } finally {
    await bia.context.close();
  }
});
