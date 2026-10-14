// lost-access (e2e-web) — losing access to a shared book against the compose
// stack, on the phone/tablet/computer projects, with axe at WCAG 2.1 AA on every
// screen it touches (sync.lost_access, workflow 8 §Losing access; DIRECTION §3.3;
// states.md badge decision; the W11 board surface).
//
// Pure real UI. The owner invites an editor and later removes them in the Share
// dialog; the editor joins through the link, then makes a save (search -> song
// -> Edit) it has not pushed. The member's device then syncs and learns it is
// gone -- the shelf reads *no longer shared with you*, the book detail shows the
// losing-access notice and offers Download and *Make this book your own*, and the
// song still opens and reads with the unpushed save kept.
//
// The member is removed BEFORE the save so the local commit is deterministically
// unpushed: a 404 is what the member's device then meets (the engine's
// 404-push/fetch classification, pinned at the unit level). Book and song names
// are written for this test (no-song-text rule). The completed lost-access->fork
// journey is books.fork's e2e; here the fork offer is asserted present and
// reachable, not clicked through to a completed fork.

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';
import {
  enableVirtualAuthenticator,
  gotoTab,
  openSongFromSearch,
  openSongInEditor,
  startApp,
  waitUntilSearchable,
} from '../lib/journeys.js';
import {
  hostedBookWithSong,
  inviteThroughShare,
  openSharing,
  acceptInvitation,
  removeFirstMember,
  addSectionAndSave,
} from '../lib/journeys-share.js';
import { openDevice } from '../lib/devices.js';

const BOOK = 'Choros da Ana';
const SONG_TITLE = 'Roda de rua';
const SAVED_MARK = 'MemberPart'; // the member's unpushed section
const bookRow = new RegExp(`^${BOOK}`);

test('losing access: the owner removes an editor; the member sees no longer shared with you, reads on, and is offered the fork and download', async ({
  browser,
  page,
}) => {
  test.setTimeout(20000);

  // Owner: a signed-in device with a hosted book carrying one song, and an
  // editor invitation made in the Share dialog.
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const link = await inviteThroughShare(page, BOOK, { role: 'Editor' });

  const joiner = await openDevice(browser);
  try {
    // A second person opens the link, makes an account, and joins as an editor;
    // the book lands on their shelf as "can save" (books.add_by_link).
    await enableVirtualAuthenticator(joiner.page);
    await acceptInvitation(joiner.page, link);
    await expect(joiner.page.getByRole('button', { name: bookRow })).toBeVisible();
    await expect(joiner.page.getByText('On Estante · can save')).toBeVisible();
    await waitUntilSearchable(joiner.page, 'Roda', SONG_TITLE);

    // The owner removes the member in the Share dialog (typed-name confirm).
    // Removed first so the member's next local commit is deterministically
    // unpushed -- the losing-access case (workflow 8: "saves not yet pushed are
    // kept").
    const dialog = await openSharing(page, BOOK);
    await expect(dialog.getByText('1 of 50')).toBeVisible();
    await removeFirstMember(page, dialog);
    await expect(dialog.getByText('0 of 50')).toBeVisible();

    // The member makes a save on the book through song -> Edit -- it commits
    // locally and cannot go up (no longer a member). The save stays on the device.
    await openSongInEditor(joiner.page, 'Roda', SONG_TITLE);
    await addSectionAndSave(joiner.page, SAVED_MARK, { name: 'Beto' });

    // The member's device syncs and learns it is gone: the shelf reads
    // *no longer shared with you* (states.md; workflow 8 L34).
    await expect(async () => {
      await startApp(joiner.page);
      await joiner.page.waitForTimeout(1500);
      await gotoTab(joiner.page, 'Books');
      await expect(joiner.page.getByText('no longer shared with you')).toBeVisible({
        timeout: 2500,
      });
    }).toPass({ timeout: 10000 });
    expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the shelf with the gone badge

    // The book detail shows the losing-access notice and both escape offers
    // (acceptance 2, 4).
    await joiner.page.getByRole('button', { name: bookRow }).click();
    await expect(
      joiner.page.getByText('No longer shared with you', { exact: true }),
    ).toBeVisible();
    await expect(
      joiner.page.getByText(/no longer shared with you, so it will not sync again/),
    ).toBeVisible();
    const forkOffer = joiner.page.getByRole('button', { name: 'Make this book your own' });
    await expect(forkOffer).toBeVisible();
    await expect(forkOffer).toBeEnabled(); // offered and reachable (not clicked through)
    expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the gone book detail

    // Download produces a zip of the repository as it is on the device
    // (acceptance 4; the existing BOOK_DOWNLOAD path).
    const [download] = await Promise.all([
      joiner.page.waitForEvent('download'),
      joiner.page.getByRole('button', { name: 'Download' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.zip$/);

    // The song still opens and reads normally, with the unpushed save kept -- no
    // local read is blocked, no save/push is attempted (acceptance 3; Constraint
    // 3, 7).
    await openSongFromSearch(joiner.page, 'Roda', SONG_TITLE);
    await expect(joiner.page.locator('.reading-sheet')).toBeVisible();
    await expect(joiner.page.locator('.reading-sheet')).toContainText(SAVED_MARK);
    expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the reading view of the gone book
  } finally {
    await joiner.context.close();
  }
});
