// e2e-web — a new device (account.new_device; workflow 13 §What comes down,
// §Books that were only on the other device, §A device used before signing in;
// board W13 frames 1-3). Against the compose stack, on the phone, tablet and
// computer projects, with axe at WCAG 2.1 AA on the filling shelf and on the
// two-My-songs choice and its preview.
//
// Device A is the project's own page (its user agent is the project's device
// descriptor: an Android phone, an Android tablet, a Windows computer); the
// other devices of the same person are fresh browser contexts holding a synced
// copy of A's passkey. Everything is done through the UI; the only reads below
// it are the account's home book as the service holds it (a git clone), to
// know A's settings have gone up before the other device signs in. Book and
// song names are written for the test (no-song-text rule).

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import {
  signedInDevice,
  makeLocalBook,
  putBookOnline,
  gotoTab,
  syncNow,
  startApp,
  openSongFromSearch,
  waitUntilSearchable,
  toDestinations,
  enableVirtualAuthenticator,
  sharePasskeys,
} from '../lib/journeys.js';
import { openDevice } from '../lib/devices.js';
import { addInstrument, closeInstruments, createSongFromSearch } from '../lib/journeys-core.js';
import { writeSongInBook, songLines } from '../lib/journeys-share.js';
import {
  anotherDeviceSignsIn,
  chooseTheme,
  untilAccountShelf,
  bookRow,
  signInExistingWithPasskey,
  closeAccount,
} from '../lib/journeys-account.js';

// The kind each project's device descriptor gives A (workflow 13 delta).
const KIND_WORDS = { phone: 'Android phone', tablet: 'Android tablet', computer: 'Windows computer' };

const liveBooks = (shelf) =>
  Object.values(shelf.books ?? {}).filter((b) => b?.link?.value).length;

// A hosted book with one song, made and put online through the UI.
async function hostedBookWithOneSong(page, title, songTitle) {
  await makeLocalBook(page, title);
  await writeSongInBook(page, title, songLines(songTitle));
  await putBookOnline(page, title);
}

test('a second device signs in: the home book first, then the shelf fills (workflow 13 §What comes down)', async ({
  browser,
  page,
  checkA11y,
}, testInfo) => {
  test.setTimeout(180000);
  // Device A: Palco, an instrument, two hosted books with a song each, and a
  // local book it does not put online.
  const authA = await signedInDevice(page);
  await chooseTheme(page, 'Palco');
  await addInstrument(page, { tuning: 'Drop D', name: 'My Drop D' });
  await closeInstruments(page);
  await hostedBookWithOneSong(page, 'Banda do Bairro', 'Marcha do Bairro');
  await hostedBookWithOneSong(page, 'Valsas', 'Valsa da Esquina');
  await makeLocalBook(page, 'Rascunhos');
  await syncNow(page);
  await checkA11y(); // A's shelf
  await untilAccountShelf(
    page,
    (shelf) =>
      liveBooks(shelf) === 2 &&
      Object.values(shelf.local ?? {}).some((ns) => Object.values(ns ?? {}).some((book) => book?.title?.value === 'Rascunhos')),
  );

  // Device B signs in.
  const b = await anotherDeviceSignsIn(browser, authA, {
    onSurface: (p) => mockup(p, 'W13-new-device', 1, { note: 'signing in on another device' }),
  });
  try {
    // The home book first: B is in Palco with A's instrument, and says so.
    await expect(b.page.locator('div.est').first()).toHaveClass(/theme-palco/);
    const notice = b.page.locator('.restore-notice');
    await expect(notice).toContainText('Home book restored. Your instrument, notation and language are set.');
    await expect(notice).toContainText('My Drop D');
    await expect(notice).toContainText('English');

    // The shelf fills: both books listed, each reaching ready.
    await expect(bookRow(b.page, 'Banda do Bairro')).toBeVisible();
    await expect(bookRow(b.page, 'Valsas')).toBeVisible();
    await mockup(b.page, 'W13-new-device', 2, { note: 'the shelf filling' });
    expect(await analyzeWcag21aa(b.page)).toEqual([]); // axe: the filling shelf
    await expect(bookRow(b.page, 'Banda do Bairro').getByText('ready', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(bookRow(b.page, 'Valsas').getByText('ready', { exact: true })).toBeVisible({ timeout: 30000 });

    // The local book is only on A, named by A's kind.
    const kind = KIND_WORDS[testInfo.project.name];
    const onlyOnA = b.page.locator('.elsewhere-row').filter({ hasText: `Only on your ${kind}: Rascunhos` });
    await expect(onlyOnA).toBeVisible();
    await expect(onlyOnA.getByText('Put it online there to have it here.')).toBeVisible();
    expect(await analyzeWcag21aa(b.page)).toEqual([]); // axe: the filled shelf

    // Their songs are found in search.
    await gotoTab(b.page, 'Search');
    await b.page.getByRole('searchbox').first().fill('Marcha');
    await expect(b.page.getByRole('button', { name: /Marcha do Bairro/ }).first()).toBeVisible();
    await b.page.getByRole('searchbox').first().fill('Valsa');
    await expect(b.page.getByRole('button', { name: /Valsa da Esquina/ }).first()).toBeVisible();

    // B reloads, and the shelf is all there.
    await startApp(b.page);
    await gotoTab(b.page, 'Books');
    await expect(bookRow(b.page, 'Banda do Bairro')).toBeVisible();
    await expect(bookRow(b.page, 'Valsas')).toBeVisible();
    await expect(b.page.getByText(`Only on your ${kind}: Rascunhos`)).toBeVisible();
    await expect(b.page.locator('div.est').first()).toHaveClass(/theme-palco/);
  } finally {
    await b.context.close();
  }
});

// A's My songs with two songs, put online; device C, used before signing in,
// with two songs in its own — one with the same title and other text — signs in
// through the account screen and goes Back to the shelf.
async function deviceUsedBeforeSigningIn(browser, page) {
  const authA = await signedInDevice(page);
  await gotoTab(page, 'Search');
  await createSongFromSearch(page, 'Tarde Clara', 'C G Am');
  await toDestinations(page);
  await gotoTab(page, 'Search');
  await createSongFromSearch(page, 'Chuva no Telhado', 'D A Bm');
  await toDestinations(page);
  await putBookOnline(page, 'My songs');
  await syncNow(page);
  await untilAccountShelf(page, (shelf) => Boolean(shelf.mySongs?.value));

  const c = await openDevice(browser);
  const own = await enableVirtualAuthenticator(c.page);
  expect(await sharePasskeys(authA, own)).toBeGreaterThan(0);
  await startApp(c.page);
  await gotoTab(c.page, 'Search');
  await createSongFromSearch(c.page, 'Tarde Clara', 'F Dm G');
  await toDestinations(c.page);
  await gotoTab(c.page, 'Search');
  await createSongFromSearch(c.page, 'Noite de Lua', 'Em C D');
  await toDestinations(c.page);
  await signInExistingWithPasskey(c.page);
  await closeAccount(c.page);
  return c;
}

test('a device used before signing in merges its My songs into the account’s (workflow 13; workflow 7)', async ({
  browser,
  page,
}) => {
  test.setTimeout(180000);
  const c = await deviceUsedBeforeSigningIn(browser, page);
  try {
    // The choice (W13 frame 3), once the account's My songs is here.
    await expect(c.page.getByText('Your two My songs')).toBeVisible({ timeout: 30000 });
    await expect(c.page.getByRole('heading', { name: /has its own My songs/ })).toBeVisible();
    const merge = c.page.getByRole('button', { name: /^Merge/ });
    await expect(merge).toBeEnabled({ timeout: 30000 });
    expect(await analyzeWcag21aa(c.page)).toEqual([]); // axe: the choice
    await mockup(c.page, 'W13-new-device', 3, { note: 'two My songs' });

    // Merge: the preview — one conflict, one added.
    await merge.click({ timeout: 15000 });
    await expect(c.page.getByRole('heading', { name: 'What merging would do' })).toBeVisible();
    const rows = c.page.locator('.upload-song');
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'Tarde Clara' }).getByText('conflict', { exact: true })).toBeVisible();
    await expect(rows.filter({ hasText: 'Noite de Lua' }).getByText('added', { exact: true })).toBeVisible();
    expect(await analyzeWcag21aa(c.page)).toEqual([]); // axe: the preview

    // Merge and save: the song in both is chosen between, then it lands.
    await c.page.getByRole('button', { name: 'Merge and save' }).click({ timeout: 15000 });
    await c.page.getByRole('button', { name: /^Settle Tarde Clara/ }).click({ timeout: 30000 });
    await c.page.getByRole('button', { name: 'Take theirs' }).click({ timeout: 15000 });
    await expect(c.page.getByRole('button', { name: 'Abandon the merge' })).toHaveCount(0, { timeout: 15000 });

    // One My songs on the shelf, with all three songs.
    await toDestinations(c.page);
    await gotoTab(c.page, 'Books');
    await expect(bookRow(c.page, 'My songs')).toHaveCount(1);
    for (const [query, title] of [
      ['Tarde', 'Tarde Clara'],
      ['Chuva', 'Chuva no Telhado'],
      ['Noite', 'Noite de Lua'],
    ]) {
      await openSongFromSearch(c.page, query, title);
      await toDestinations(c.page);
    }

    // A sees C's song.
    await waitUntilSearchable(page, 'Noite', 'Noite de Lua', { timeout: 20000 });
  } finally {
    await c.context.close();
  }
});

test('a device used before signing in keeps both My songs (workflow 13)', async ({ browser, page }) => {
  test.setTimeout(180000);
  const c = await deviceUsedBeforeSigningIn(browser, page);
  try {
    await expect(c.page.getByText('Your two My songs')).toBeVisible({ timeout: 30000 });
    await c.page.getByRole('button', { name: /^Keep both/ }).click();
    await gotoTab(c.page, 'Books');
    await expect(bookRow(c.page, 'My songs')).toHaveCount(1, { timeout: 30000 });
    await expect(bookRow(c.page, 'My songs (this device)')).toHaveCount(1);

    // After a reload no choice is offered.
    await startApp(c.page);
    await gotoTab(c.page, 'Books');
    await expect(bookRow(c.page, 'My songs (this device)')).toHaveCount(1);
    await c.page.waitForTimeout(1500);
    await expect(c.page.getByText('Your two My songs')).toHaveCount(0);
  } finally {
    await c.context.close();
  }
});

test('offline while filling: the books not yet here wait, the ones here open, and the rest come when the network does', async ({
  browser,
  page,
}) => {
  test.setTimeout(180000);
  const authA = await signedInDevice(page);
  await hostedBookWithOneSong(page, 'Banda do Bairro', 'Marcha do Bairro');
  for (const title of ['Choros', 'Valsas', 'Sambas']) {
    await makeLocalBook(page, title);
    await putBookOnline(page, title);
  }
  await syncNow(page);
  await untilAccountShelf(page, (shelf) => liveBooks(shelf) === 4);

  const b = await anotherDeviceSignsIn(browser, authA);
  try {
    // The network goes the moment the first book is ready and another is still
    // coming down.
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

    // What is not here yet waits — never failed or lost — and stays waiting.
    await expect(b.page.locator('.book-row .badge', { hasText: /^waiting$/ }).first()).toBeVisible({ timeout: 15000 });
    await b.page.waitForTimeout(1500);
    const notReady = b.page.locator('.book-row').filter({ hasNot: b.page.getByText('ready', { exact: true }) });
    const count = await notReady.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(notReady.nth(i).locator('.badge')).toHaveText(['waiting']);
    }

    // The book that is here opens and plays.
    await openSongFromSearch(b.page, 'Marcha', 'Marcha do Bairro');
    await toDestinations(b.page);

    // Back online, the rest reach ready.
    await b.context.setOffline(false);
    await syncNow(b.page);
    for (const title of ['Choros', 'Valsas', 'Sambas']) {
      await expect(bookRow(b.page, title).getByText('ready', { exact: true })).toBeVisible({ timeout: 30000 });
    }
  } finally {
    await b.context.close();
  }
});
