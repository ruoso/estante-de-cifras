// e2e-web — Setlists never stuck loading, and a book still coming down never
// reads as empty (books.setlists_resilient; workflow 12 §The file L34, workflow
// 2 L177-179, workflow 13 §What comes down). Against the compose stack, on the
// phone, tablet and computer projects, with axe at WCAG 2.1 AA (both themes) on
// Setlists and Search while offline.
//
// Device A makes four books and puts them online, one with a song in a saved
// setlist; device B (the same person, a fresh context) signs in and fills its
// shelf, and the network goes the moment the first book is ready and another is
// still cloning (as new-device.spec.js does). The damaged-directory cases are
// pinned at the unit and behavior levels (Decision 7): the real-UI seam here is
// `context.setOffline`. Book, song and setlist names are written for the test
// (no-song-text rule).

import { test, expect, analyzeBothThemes } from '../lib/axe.js';
import { signedInDevice, makeLocalBook, putBookOnline, gotoTab, syncNow, toDestinations } from '../lib/journeys.js';
import { writeSongInBook, songLines } from '../lib/journeys-share.js';
import { addToNewSetlist, openSetlist, editSetlist } from '../lib/journeys-files.js';
import { anotherDeviceSignsIn, untilAccountShelf, bookRow } from '../lib/journeys-account.js';

const liveBooks = (shelf) =>
  Object.values(shelf.books ?? {}).filter((b) => b?.link?.value).length;

const OTHERS = ['Choros', 'Valsas', 'Sambas'];

test('a book still coming down beside one that is here: Setlists lists the one that is here, and Search says the rest are waiting', async ({
  browser,
  page,
}) => {
  test.setTimeout(240000);
  const authA = await signedInDevice(page);
  await makeLocalBook(page, 'Banda do Bairro');
  await writeSongInBook(page, 'Banda do Bairro', songLines('Marcha do Bairro'));
  // The song into a new setlist, saved, so putting the book online pushes it.
  await addToNewSetlist(page, 'Marcha', 'Marcha do Bairro', 'Ensaio de sábado');
  await openSetlist(page, 'Ensaio de sábado');
  await editSetlist(page);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('not saved yet')).toBeHidden();
  // Done leaves the editor for the read view, whose Back reaches the
  // destinations (books.setlist_done: Done replaced the editor's icon Back).
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await toDestinations(page);
  await putBookOnline(page, 'Banda do Bairro');
  // Every other book carries a song too, so a book here never reads *0 songs*
  // for being empty: *0 songs* could only mean a book still coming down.
  for (const title of OTHERS) {
    await makeLocalBook(page, title);
    await writeSongInBook(page, title, songLines(`Toada de ${title}`));
    await putBookOnline(page, title);
  }
  await syncNow(page);
  await untilAccountShelf(page, (shelf) => liveBooks(shelf) === 4);

  const b = await anotherDeviceSignsIn(browser, authA);
  try {
    // The network goes the moment the first book is ready and another is still
    // coming down (new-device.spec.js L241).
    await b.page.waitForFunction(
      () => {
        const rows = [...document.querySelectorAll('.book-row')];
        const words = (row) => [...row.querySelectorAll('.badge')].map((e) => e.textContent.trim());
        const first = rows.find((r) => r.querySelector('.name')?.textContent === 'Banda do Bairro');
        return Boolean(first && words(first).includes('ready') && rows.some((r) => words(r).some((w) => w.startsWith('cloning'))));
      },
      null,
      { polling: 'raf', timeout: 60000 },
    );
    await b.context.setOffline(true);

    // The rest go back to waiting.
    await expect(b.page.locator('.book-row .badge', { hasText: /^waiting$/ }).first()).toBeVisible({ timeout: 15000 });
    await b.page.waitForTimeout(1500);
    const waiting = [];
    for (const title of OTHERS) {
      const badges = await bookRow(b.page, title).locator('.badge').allTextContents();
      if (badges.map((w) => w.trim()).includes('waiting')) waiting.push(title);
    }
    expect(waiting.length).toBeGreaterThan(0);

    // Setlists: the book that is here is listed, and Loading is gone.
    await gotoTab(b.page, 'Setlists');
    await expect(b.page.getByRole('button', { name: /Ensaio de sábado/ })).toBeVisible({ timeout: 15000 });
    await expect(b.page.getByText('Loading setlists…')).toHaveCount(0);
    expect(await analyzeBothThemes(b.page)).toEqual([]); // axe: Setlists, offline

    // Search: the books not yet here read *waiting*, and no book reads *0 songs*.
    await gotoTab(b.page, 'Search');
    const section = (title) => b.page.locator('.book-trigger').filter({ hasText: title });
    await expect(section('Banda do Bairro')).toBeVisible();
    for (const title of waiting) {
      await expect(section(title).locator('.meta')).toHaveText('waiting');
    }
    await expect(b.page.locator('.book-trigger .meta', { hasText: /^0 songs$/ })).toHaveCount(0);
    expect(await analyzeBothThemes(b.page)).toEqual([]); // axe: Search, offline

    // Back online, the rest reach ready on the shelf.
    await b.context.setOffline(false);
    await syncNow(b.page);
    for (const title of OTHERS) {
      await expect(bookRow(b.page, title).getByText('ready', { exact: true })).toBeVisible({ timeout: 30000 });
    }
  } finally {
    await b.context.close();
  }
});
