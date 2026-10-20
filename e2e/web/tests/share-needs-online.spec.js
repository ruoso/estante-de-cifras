// e2e-web (books.share_needs_online) — Share on a song in a book only on this
// device leads to putting it online, then inviting: a first-time teacher's
// first Share. Workflow 10 §Sharing a song (the needs-online state), workflow 7
// §Putting a book online (it goes online private), workflow 13 §Signing in, or
// making an account. Runs on phone, tablet and computer (the projects); real
// UI only — writeSongFromScratch, makeAccount and the surface's own buttons.
// The song is written for this test.

import { test, expect, analyzeBothThemes } from '../lib/axe.js';
import { startApp, gotoTab, enableVirtualAuthenticator, openSongFromSearch, makeAccount, openBookDetail } from '../lib/journeys.js';
import { writeSongFromScratch, bookRow } from '../lib/journeys-account.js';

const SONG_TITLE = 'Paper Lanterns';
const SONG = [`# ${SONG_TITLE}`, '', '## Verse', '```', 'G  D | Em  C', '```', ''];
const onPhone = () => test.info().project.name === 'phone';

// Song → Share (an appbar button on the computer, the More menu on the phone
// and the tablet — share.spec.js shareSong). The phone's sheet or the wide panel.
async function shareSong(page) {
  await openSongFromSearch(page, 'Lanterns', SONG_TITLE);
  const share = page.getByRole('button', { name: 'Share', exact: true });
  if (await share.isVisible().catch(() => false)) {
    await share.click();
  } else {
    await page.getByRole('button', { name: 'More', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'Share', exact: true }).click();
  }
  return page
    .getByRole('dialog', { name: `Share ${SONG_TITLE}` })
    .or(page.getByRole('complementary', { name: `Share ${SONG_TITLE}` }));
}

test('Share on a song in My songs: only on this device, sign in, put online, then invite to the song', async ({ page }) => {
  test.setTimeout(60000);
  await enableVirtualAuthenticator(page);
  // Signed out, a song into this device's My songs.
  await writeSongFromScratch(page, SONG);
  await startApp(page);

  const surface = await shareSong(page);
  await expect(surface.getByText('My songs is only on this device. Put it online to invite people.')).toBeVisible();
  await expect(surface.getByText(/Putting it online creates it on Estante, private/)).toBeVisible();
  await expect(surface.getByRole('textbox', { name: 'Song address' })).toHaveCount(0);
  await expect(surface.getByRole('button', { name: 'Put online' })).toHaveCount(0);
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: share on a local book, signed out

  // Sign in first: the one sign-in surface, and back to the song with the
  // surface still open, now offering Put online.
  await surface.getByRole('button', { name: 'Sign in to put it online' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in or make an account' })).toBeVisible();
  await makeAccount(page);
  await expect(surface).toBeVisible();
  const putOnline = surface.getByRole('button', { name: 'Put online' });
  await expect(putOnline).toBeVisible();
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: share on a local book, signed in

  // Put online in place: the same surface becomes the owner's song invite.
  await putOnline.click();
  // The members' address is on the sheet's first view (phone) and in the panel.
  const addressBox = surface.getByRole('textbox', { name: 'Song address' });
  await expect(addressBox).toBeVisible({ timeout: 30000 });
  const address = await addressBox.inputValue();
  const path = decodeURIComponent(address.replace(/^.*\/b\/[^/]+\//, ''));
  expect(path).toMatch(/\.cifra\.md$/);
  if (onPhone()) await surface.getByRole('button', { name: 'Invite someone to this song' }).click();
  const create = surface.getByRole('button', { name: 'Create link' });
  await expect(create).toBeVisible();
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the owner's song share

  await create.click();
  const link = await surface.getByRole('textbox', { name: 'Invitation link' }).inputValue();
  expect(link).toContain('/i/');
  expect(decodeURIComponent(link)).toContain(`#${path}`);
  await page.getByRole('button', { name: 'Done' }).click();

  // The book went online private: its row is on Estante, its detail says private.
  await startApp(page);
  await gotoTab(page, 'Books');
  await expect(bookRow(page, 'My songs')).toContainText('On Estante');
  await openBookDetail(page, 'My songs');
  await expect(page.getByText('On Estante · private')).toBeVisible();
});
