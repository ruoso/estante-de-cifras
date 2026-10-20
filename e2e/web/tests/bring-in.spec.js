// bring-in (e2e-web) — following an original against the compose stack, on the
// phone/tablet/computer projects, with axe at WCAG 2.1 AA on every screen it
// touches (books.bring_in; workflow 11 §Following the original, §When the
// original goes away; workflow 8 offline; W11 board #2-#4).
//
// Pure real UI. Ana (the `page`) owns a hosted book with one song and invites Bia
// (a second context) as an editor through the Share dialog; Bia joins through
// the link and makes the book their own from its detail's Fork card (Books →
// the book's songs → Manage, books.row_opens_songs). Offline is
// the context's own `setOffline` (the harness's sanctioned seam, Decision 9) —
// the real *unreachable* path, no network mocking. Book and song names are
// written for these tests (no-song-text rule).

import { test, expect, analyzeBothThemes } from '../lib/axe.js';
import { openSongFromSearch, openSongInEditor, syncNow } from '../lib/journeys.js';
import {
  hostedBookWithSong,
  openSharing,
  removeFirstMember,
  addSectionAndSave,
  booksList,
} from '../lib/journeys-share.js';
import { biaJoins, makeItMyOwn, bookRowName } from '../lib/journeys-fork.js';
import { mockup } from '../lib/mockup.js';

const BOOK = 'Choros da Ana';
const SONG_TITLE = 'Roda de rua';
const QUERY = 'Roda';
const bookRow = bookRowName(BOOK);
const BRING_IN = `Bring them in from ${BOOK}`;
const SCREEN_TITLE = `Bring in saves from ${BOOK}`;
const GONE_TITLE = 'The original is no longer shared with you.';

// Ana hosts the book with its song; Bia joins as an editor and makes it their
// own deliberately, from the book detail's Fork card (workflow 11 §Ways in).
async function biaForks(browser, page) {
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const bia = await biaJoins(browser, page, { book: BOOK, role: 'Editor', query: QUERY, songTitle: SONG_TITLE });
  await booksList(bia.page);
  await bia.page.getByRole('button', { name: bookRow }).click();
  await bia.page.getByRole('button', { name: `Manage ${BOOK}` }).first().click();
  await bia.page.getByRole('button', { name: 'Fork', exact: true }).click();
  await makeItMyOwn(bia.page, BOOK);
  await booksList(bia.page);
  await expect(bia.page.getByText(`from ${BOOK}`, { exact: true })).toBeVisible();
  return bia;
}

test('Ana’s new save brought in: offline says so and changes nothing; online it merges, saves and sends', async ({
  browser,
  page,
}) => {
  test.setTimeout(150000);
  const bia = await biaForks(browser, page);
  const MARK = 'AnaPart';
  try {
    // Ana saves in her book; Bia's next sync counts it on the row, in words —
    // the row's one action opens the book's songs, and *Bring them in* is on
    // the bar above them (books.row_opens_songs; workflow 7 L83-85; W11 #2).
    await openSongInEditor(page, QUERY, SONG_TITLE);
    await addSectionAndSave(page, MARK, { name: 'Ana' });
    await expect(async () => {
      await syncNow(bia.page);
      await expect(bia.page.getByText(`${BOOK} has 1 new save.`)).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });
    await expect(bia.page.getByRole('button', { name: BRING_IN })).toHaveCount(0);
    expect(await analyzeBothThemes(bia.page)).toEqual([]); // axe: the shelf with the count
    await bia.page.getByRole('button', { name: bookRow }).click();
    const bar = bia.page.locator('.book-bar');
    await expect(bar.getByText(`${BOOK} has 1 new save.`)).toBeVisible();
    await expect(bar.getByRole('button', { name: BRING_IN })).toBeVisible();
    expect(await analyzeBothThemes(bia.page)).toEqual([]); // axe: the book's songs with the button
    await mockup(bia.page, 'W11-fork', 2);

    // Offline: the preview says so plainly, offers no Bring them in, and Not now
    // returns to the book's songs with the count still there (workflow 8;
    // Constraint 2).
    await bia.context.setOffline(true);
    await bia.page.getByRole('button', { name: BRING_IN }).click();
    await expect(bia.page.getByRole('heading', { name: SCREEN_TITLE })).toBeVisible();
    await expect(
      bia.page.getByText('Bringing them in needs the network. Nothing changed: connect, then try again.'),
    ).toBeVisible({ timeout: 15000 });
    await expect(bia.page.getByRole('button', { name: 'Bring them in', exact: true })).toHaveCount(0);
    expect(await analyzeBothThemes(bia.page)).toEqual([]); // axe: the offline reply
    await bia.page.getByRole('button', { name: 'Not now' }).click();
    await expect(bia.page.getByRole('heading', { name: SCREEN_TITLE })).toBeHidden();
    await expect(bia.page.getByText(`${BOOK} has 1 new save.`)).toBeVisible();
    await bia.context.setOffline(false);

    // Online: the preview, song by song — the song *changed*, the note already
    // written with its title (W11 board #3).
    await bia.page.getByRole('button', { name: BRING_IN }).click();
    await expect(bia.page.getByRole('heading', { name: SCREEN_TITLE })).toBeVisible();
    const row = bia.page.locator('.upload-song', { hasText: SONG_TITLE });
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.locator('.badge')).toHaveText('changed');
    await expect(bia.page.getByText(`1 new save in ${BOOK} since you last brought them in.`, { exact: false })).toBeVisible();
    await expect(bia.page.getByRole('textbox', { name: 'Note' })).toHaveValue(
      `Bring in changes from ${BOOK}: ${SONG_TITLE}`,
    );
    expect(await analyzeBothThemes(bia.page)).toEqual([]); // axe: the bring-in preview
    await mockup(bia.page, 'W11-fork', 3);

    // Bring them in → the book's songs, the count gone once it is on Estante.
    await bia.page.getByRole('button', { name: 'Bring them in', exact: true }).click();
    await expect(bia.page.getByRole('heading', { name: SCREEN_TITLE })).toBeHidden({ timeout: 20000 });
    await expect(bia.page.getByRole('button', { name: `Manage ${BOOK}` })).toBeVisible();
    await expect(bia.page.getByText(/has \d+ new saves?\./)).toHaveCount(0, { timeout: 15000 });
    await expect(bia.page.getByRole('button', { name: BRING_IN })).toHaveCount(0);

    // Bia's song carries Ana's section.
    await openSongFromSearch(bia.page, QUERY, SONG_TITLE);
    await expect(bia.page.locator('.reading-sheet')).toContainText(MARK);
    expect(await analyzeBothThemes(bia.page)).toEqual([]); // axe: reading the fork
  } finally {
    await bia.context.close();
  }
});

test('Bia removed from the original: the shelf badge, and the book says so with the last brought-in date', async ({
  browser,
  page,
}) => {
  test.setTimeout(150000);
  const bia = await biaForks(browser, page);
  try {
    // Ana removes Bia from her book through the Share dialog.
    const dialog = await openSharing(page, BOOK);
    await removeFirstMember(page, dialog);
    await expect(dialog.getByText('0 of 50')).toBeVisible();

    // Bia's next sync: following ends (workflow 11 §When the original goes away).
    await expect(async () => {
      await syncNow(bia.page);
      await expect(bia.page.getByText('original no longer shared', { exact: true })).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });

    // The book's detail says so, dated by the fork (it never brought any in).
    // Today, formatted in the page the way the app's English writes it — day
    // before month (W11 board #4 :169) — a read, nothing more.
    const today = await bia.page.evaluate(() =>
      new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date()),
    );
    await bia.page.getByRole('button', { name: bookRow }).click();
    await bia.page.getByRole('button', { name: `Manage ${BOOK}` }).first().click();
    await expect(bia.page.getByText(GONE_TITLE, { exact: true })).toBeVisible();
    await expect(
      bia.page.getByText(`This book stops following ${BOOK}; it was last brought in on ${today}.`, { exact: false }),
    ).toBeVisible();
    expect(await analyzeBothThemes(bia.page)).toEqual([]); // axe: the detail with the notice
    await mockup(bia.page, 'W11-fork', 4);
  } finally {
    await bia.context.close();
  }
});
