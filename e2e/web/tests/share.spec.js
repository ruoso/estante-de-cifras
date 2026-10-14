// share (e2e-web) — the sharing journeys against the compose stack, on the
// phone/tablet/computer projects, with axe at WCAG 2.1 AA on every sharing
// screen and overlay (books.share, workflow 10). Pure real UI, from `/`: the
// owner writes a song in a new book, puts it online and makes invitations in
// the Share dialog; a second PERSON (another browser context, its own account)
// joins through `/i/<token>`; both edit the shared song and sync; the owner's
// Share then reads the join, lowers the member to reader, withdraws the
// invitation (the joined member stays) and removes the member (whose shelf reads
// *no longer shared with you*). A second test shares from a song: the member
// address, an invitation that opens on that song, and a non-member who gets the
// "does not open" state. Book and song names are written for these tests.

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';
import {
  startApp,
  gotoTab,
  signedInDevice,
  enableVirtualAuthenticator,
  openSongFromSearch,
  openSongInEditor,
  waitUntilSearchable,
  syncNow,
} from '../lib/journeys.js';
import {
  hostedBookWithSong,
  openSharing,
  createInvitationIn,
  finishInvite,
  acceptInvitation,
  removeFirstMember,
  addSectionAndSave,
} from '../lib/journeys-share.js';
import { openDevice } from '../lib/devices.js';
import { mockup } from '../lib/mockup.js';

const BOOK = 'Choros da Ana';
const SONG_TITLE = 'Roda de rua';
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Sync (Books → Sync now), then reopen the song in the editor until it carries
// every mark — the clean-merge assertion.
async function expectSongHasMarks(page, marks) {
  await syncNow(page);
  await expect(async () => {
    await openSongInEditor(page, 'Roda', SONG_TITLE);
    for (const mark of marks) {
      await expect(page.locator('.cm-content')).toContainText(mark, { timeout: 1000 });
    }
  }).toPass({ timeout: 10000 });
}

test('the two-person sharing journey: invite, join, edit to a clean merge, lower a role, withdraw, remove', async ({
  browser,
  page,
}) => {

  // Owner: a signed-in device with a hosted book carrying one song.
  await hostedBookWithSong(page, BOOK, SONG_TITLE);

  // 1) The owner opens Share, sees 0 of 50, and makes an editor invitation.
  let dialog = await openSharing(page, BOOK);
  await expect(dialog.getByText('0 of 50')).toBeVisible();
  await expect(dialog.getByText('You', { exact: true })).toBeVisible();
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the owner Share surface
  await mockup(page, 'W10-share', 1);

  await dialog.getByRole('button', { name: 'Invite people' }).click();
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the new-invitation form
  await mockup(page, 'W10-share', 2);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  const link = await createInvitationIn(dialog, { role: 'Editor' });
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the link-shown-once state
  await finishInvite(dialog);

  // 2) A second person opens the link, makes an account and joins as an editor;
  // the book lands on their shelf as "can save".
  const joiner = await openDevice(browser);
  try {
    await enableVirtualAuthenticator(joiner.page);
    await joiner.page.goto(link);
    await expect(
      joiner.page.getByRole('heading', { name: /invited to a book on Estante/i }),
    ).toBeVisible();
    expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the invited screen
    await mockup(joiner.page, 'W01-first-run', 2);
    await joiner.page.getByRole('button', { name: 'Make an account' }).click();
    await expect(joiner.page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await joiner.page.getByRole('button', { name: 'Use a passkey' }).click();
    await expect(joiner.page.getByRole('button', { name: new RegExp(`^${escape(BOOK)}`) })).toBeVisible();
    await expect(joiner.page.getByText('On Estante · can save')).toBeVisible();

    // 3) Both edit the shared song and sync to a clean merge. The joiner opens
    // the song, adds a section and saves; the owner syncs it down, adds its own
    // and saves; the joiner syncs back. Both end with both contributions.
    await waitUntilSearchable(joiner.page, 'Roda', SONG_TITLE);
    await openSongInEditor(joiner.page, 'Roda', SONG_TITLE);
    await addSectionAndSave(joiner.page, 'JoinerPart', { name: 'Beto' });

    await expectSongHasMarks(page, ['JoinerPart']);
    await addSectionAndSave(page, 'OwnerPart', { name: 'Ana' });

    await expectSongHasMarks(joiner.page, ['JoinerPart', 'OwnerPart']);
    await expectSongHasMarks(page, ['JoinerPart', 'OwnerPart']);

    // 4) The owner's Share now reads 1 of 50 and shows who joined through the
    // invitation.
    dialog = await openSharing(page, BOOK);
    await expect(dialog.getByText('1 of 50')).toBeVisible();
    await expect(dialog.getByText('Editor invitation')).toBeVisible();
    await expect(dialog.getByText(/1 person/)).toBeVisible();
    await mockup(page, 'W10-share', 3);

    // 5) The owner lowers the member to reader (Make reader): the roster says
    // Reader, and the member's shelf follows on its next sync.
    const memberRow = dialog
      .locator('.est-sharing-member', { has: page.getByRole('button', { name: 'Remove' }) })
      .first();
    await memberRow.getByRole('button', { name: /’s role$/ }).click();
    await page.getByRole('menuitem', { name: 'Make reader' }).click();
    await expect(memberRow.locator('.badge')).toHaveText('Reader');
    await expect(memberRow.getByRole('button', { name: /’s role$/ })).toContainText('Reader');
    expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the roster with a reader

    // 6) The owner withdraws the invitation: nobody new can join; the joined
    // member stays (still 1 of 50).
    await dialog.getByRole('button', { name: 'Withdraw' }).click();
    await expect(dialog.getByText('withdrawn')).toBeVisible();
    await expect(dialog.getByText('1 of 50')).toBeVisible();
    expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the withdrawn state

    // 7) The owner removes the member through the typed-name confirm.
    const removing = removeFirstMember(page, dialog);
    await expect(page.getByRole('dialog').filter({ hasText: 'Remove' }).last()).toBeVisible();
    expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the remove confirm
    await removing;
    await expect(dialog.getByText('0 of 50')).toBeVisible();

    // The removed member's next sync is refused, and their shelf reads
    // *no longer shared with you*.
    await expect(async () => {
      await startApp(joiner.page);
      await gotoTab(joiner.page, 'Books');
      await expect(joiner.page.getByText('no longer shared with you')).toBeVisible({ timeout: 2500 });
    }).toPass({ timeout: 10000 });
  } finally {
    await joiner.context.close();
  }
});

// Owner → song → Share (the More menu on the phone). Returns the song's plain
// member address; leaves the dialog open.
async function shareSongAddress(page, narrow) {
  await openSongFromSearch(page, 'Roda', SONG_TITLE);
  if (narrow) {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'Share' }).click();
  } else {
    await page.getByRole('button', { name: 'Share' }).click();
  }
  return page.getByRole('dialog').getByRole('textbox', { name: 'Song address' }).inputValue();
}

test('share from a song: the member address, and an invitation that opens on the song', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(10000);
  const narrow = testInfo.project.name === 'phone';

  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const address = await shareSongAddress(page, narrow);
  expect(address).toMatch(/\/b\/[^/]+\/.+\.cifra\.md$/);
  const dialog = page.getByRole('dialog');
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: share-on-a-song
  await mockup(page, 'W10-share', 4);

  // The song invitation: the link carries the song as a fragment.
  await dialog.getByRole('button', { name: 'Invite someone to this song' }).click();
  await mockup(page, 'W10-share', 5);
  await dialog.getByRole('button', { name: 'Create link' }).click();
  const link = await dialog.getByRole('textbox', { name: 'Invitation link' }).inputValue();
  expect(link).toContain('/i/');
  expect(link).toContain('#');
  await mockup(page, 'W10-share', 6);
  await finishInvite(dialog);

  // A second person accepts and lands on the song, not just the shelf.
  const joiner = await openDevice(browser);
  try {
    await enableVirtualAuthenticator(joiner.page);
    await acceptInvitation(joiner.page, link);
    await expect(joiner.page.getByRole('group', { name: SONG_TITLE }).first()).toBeVisible();

    // A member opens the plain address and reads the song.
    await joiner.page.goto(address);
    await expect(joiner.page.getByRole('group', { name: SONG_TITLE }).first()).toBeVisible();
  } finally {
    await joiner.context.close();
  }
});

test('a non-member opening a book address gets the "does not open" state', async ({ browser, page }, testInfo) => {
  // BUG: /b/<book>/<path> for a book the account does not hold opens an empty reading view (title = file name, no chart, Edit/Share offered) instead of a "does not open" state — see coordinator report
  test.fixme(true, 'no non-member state for /b/<id>/<path>: app/src/shell/AppShell.jsx boot effect just setOpenSong');
  const narrow = testInfo.project.name === 'phone';

  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const address = await shareSongAddress(page, narrow);

  const outsider = await openDevice(browser);
  try {
    await signedInDevice(outsider.page);
    await outsider.page.goto(address);
    await expect(outsider.page.getByText(/does not open|doesn’t open|can’t open/i).first()).toBeVisible();
    await expect(outsider.page.getByRole('group', { name: SONG_TITLE })).toHaveCount(0);
    expect(await analyzeWcag21aa(outsider.page)).toEqual([]); // axe: the non-member state
    await mockup(outsider.page, 'W01-first-run', 4);
  } finally {
    await outsider.context.close();
  }
});
