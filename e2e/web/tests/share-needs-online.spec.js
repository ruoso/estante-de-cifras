// e2e-web (books.share_needs_online) — Share on a song in a book only on this
// device leads to putting it online, then inviting: a first-time teacher's
// first Share. Workflow 10 §Sharing a song (the needs-online state), workflow 7
// §Putting a book online (it goes online private), workflow 13 §Signing in, or
// making an account. Runs on phone, tablet and computer (the projects); real
// UI only — writeSongFromScratch, makeAccount and the surface's own buttons.
// The song is written for this test.
//
// books.invite_send: right after Put online the book has nobody in it, so the
// owner's Share leads with the invitation (workflow 10 §Nobody in the book
// yet), and the made link goes out with Send where the device can share
// (§Sending the link) — the platform's own answer pinned first, then the Web
// Share API emulated on the live page (stubWebShare, Decision 9).

import { test, expect, analyzeBothThemes } from '../lib/axe.js';
import { startApp, gotoTab, enableVirtualAuthenticator, openSongFromSearch, makeAccount, openBookDetail } from '../lib/journeys.js';
import { writeSongFromScratch, bookRow } from '../lib/journeys-account.js';
import { stubWebShare, webShareCalls } from '../lib/journeys-share.js';
import { mockup } from '../lib/mockup.js';

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

test('Share on a song in My songs: only on this device, sign in, put online, then the invitation leads and the link is sent', async ({ page }) => {
  test.setTimeout(90000);
  await enableVirtualAuthenticator(page);
  // Signed out, a song into this device's My songs.
  await writeSongFromScratch(page, SONG);
  await startApp(page);

  const surface = await shareSong(page);
  await expect(surface.getByText('My songs is only on this device. Put it online to invite people.')).toBeVisible();
  await expect(
    surface.getByText('Only on this device: nobody else can see it. Put it online to invite people — up to 50.'),
  ).toBeVisible();
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

  // Nobody in the book yet: the invitation leads, the address follows it
  // (workflow 10 §Nobody in the book yet) — the phone's invite button, the
  // panel's Create link section.
  const inviteButton = surface.getByRole('button', { name: 'Invite someone to this song' });
  const create = surface.getByRole('button', { name: 'Create link' });
  const inviteControl = onPhone() ? inviteButton : create;
  await expect(inviteControl).toBeVisible();
  await expect(surface.getByText('0 of 50').first()).toBeVisible();
  const inviteBox = await inviteControl.boundingBox();
  const addressAt = await addressBox.boundingBox();
  expect(inviteBox.y).toBeLessThan(addressAt.y);
  if (onPhone()) await mockup(page, 'W10-share', 7);
  else await mockup(page, 'W10-share', 9, { note: 'panel, nobody yet' });
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the owner's song share, leading with the invitation

  // The platform as it is, before any stub: where it cannot share (the CI
  // viewports' Chromium), the made link has the field and Copy, no Send.
  const platformShares = await page.evaluate(() => typeof navigator.share === 'function');
  if (onPhone()) await inviteButton.click();
  await expect(create).toBeVisible();
  await create.click();
  const linkBox = surface.getByRole('textbox', { name: 'Invitation link' });
  const made = surface.locator('.est-sharing-created');
  const link = await linkBox.inputValue();
  expect(link).toContain('/i/');
  expect(decodeURIComponent(link)).toContain(`#${path}`);
  await expect(made.getByRole('button', { name: 'Copy', exact: true })).toBeVisible();
  if (!platformShares) await expect(made.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the made link, Copy alone
  await page.getByRole('button', { name: 'Done' }).click();

  // A device that can share: another link, now with Send beside Copy; Send
  // hands the device's sheet exactly the link in the field (§Sending the link).
  await stubWebShare(page);
  if (onPhone()) await inviteButton.click();
  await expect(create).toBeVisible();
  await create.click();
  const send = made.getByRole('button', { name: 'Send', exact: true });
  await expect(send).toBeVisible();
  await expect(made.getByRole('button', { name: 'Copy', exact: true })).toBeVisible();
  const sent = await linkBox.inputValue();
  expect(sent).toContain('/i/');
  expect(decodeURIComponent(sent)).toContain(`#${path}`);
  if (onPhone()) await mockup(page, 'W10-share', 8);
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the made link with Send
  await send.click();
  await expect.poll(() => webShareCalls(page)).toEqual([{ url: sent }]);
  await expect(send).toBeVisible(); // nothing claimed: Send still reads Send
  await page.getByRole('button', { name: 'Done' }).click();

  // The book went online private: its row is on Estante, its detail says private.
  await startApp(page);
  await gotoTab(page, 'Books');
  await expect(bookRow(page, 'My songs')).toContainText('On Estante');
  await openBookDetail(page, 'My songs');
  await expect(page.getByText('On Estante · private')).toBeVisible();
});
