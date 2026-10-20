// share (e2e-web) — the sharing journeys against the compose stack, on the
// phone/tablet/computer projects, with axe at WCAG 2.1 AA on every sharing
// surface (books.share, books.share_people; workflow 10). Pure real UI, from
// `/`: the owner writes a song in a new book, puts it online and makes
// invitations; a second PERSON (another browser context, its own account, a
// name on the service) joins through `/i/<token>`; both edit the shared song
// and sync; the owner's people screen then names the person, lowers them to
// reader, withdraws the invitation (the joined member stays) and removes them
// (whose shelf reads *no longer shared with you*). Where each surface sits
// follows workflow 10 **Where it sits**: the phone's Share sheet leads to the
// people and New invitation screens; a tablet's or computer's Share opens the
// people screen; a song's Share is a panel beside it on wide. Further tests copy
// an open invitation's link again, share from a song and from a setlist
// (books.setlist_invitation), and read a full book and
// a member's view, and pin that Done on a made invitation returns to where it
// was made from (books.setlist_picker_fixes) with focus on the restored screen
// (shell.surface_restore_focus, shell.surface_restore_focus_song). Book, song
// and people are written for these tests.

import { test, expect, analyzeBothThemes } from '../lib/axe.js';
import {
  startApp,
  gotoTab,
  signedInDevice,
  enableVirtualAuthenticator,
  openSongFromSearch,
  openSongInEditor,
  openFiles,
  waitUntilSearchable,
  syncNow,
  makeAccount,
} from '../lib/journeys.js';
import {
  hostedBookWithSong,
  openSharing,
  openShareSheet,
  createInvitationIn,
  finishInvite,
  closeSharing,
  inviteThroughShare,
  acceptInvitation,
  addSectionAndSave,
  ownerNameOnService,
  bookIdOf,
  shareSetlist,
} from '../lib/journeys-share.js';
import { addToNewSetlistFromSong, openSetlist, saveAllChanges } from '../lib/journeys-files.js';
import { fillBookToCapacity } from '../lib/db.js';
import { openDevice } from '../lib/devices.js';
import { mockup } from '../lib/mockup.js';

const BOOK = 'Choros da Ana';
const SONG_TITLE = 'Roda de rua';
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const onPhone = () => test.info().project.name === 'phone';

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

// A second person on a fresh device: opens the link, makes an account, and
// lands with the book on their shelf.
async function joinThrough(browser, link) {
  const joiner = await openDevice(browser);
  await enableVirtualAuthenticator(joiner.page);
  await acceptInvitation(joiner.page, link);
  await expect(joiner.page.getByRole('button', { name: new RegExp(`^${escape(BOOK)}`) })).toBeVisible();
  return joiner;
}

test('the two-person sharing journey: invite, join, edit to a clean merge, the person named, lower a role, withdraw, remove', async ({
  browser,
  page,
}) => {
  // Owner: a signed-in device with a hosted book carrying one song.
  await hostedBookWithSong(page, BOOK, SONG_TITLE);

  // 1) Share: on the phone the sheet (W10 #1) and its New invitation screen
  // (#2); on a tablet or a computer the people screen, its New invitation a
  // dialog. Both say how much room the book has.
  let people;
  if (onPhone()) {
    const sheet = await openShareSheet(page, BOOK);
    await expect(sheet.getByText('0 of 50')).toBeVisible();
    await expect(sheet.getByText('Room for 50 more.')).toBeVisible();
    expect(await analyzeBothThemes(page)).toEqual([]); // axe: the Share sheet
    await mockup(page, 'W10-share', 1);
    await sheet.getByRole('button', { name: 'Invite people' }).click();
    const form = page.getByRole('region', { name: 'New invitation' });
    await expect(form.getByText(/Choros da Ana has room for 50 more people/)).toBeVisible();
    expect(await analyzeBothThemes(page)).toEqual([]); // axe: the New invitation screen
    await mockup(page, 'W10-share', 2);
    await form.getByRole('button', { name: 'Back' }).click();
    people = await openSharing(page, BOOK);
  } else {
    people = await openSharing(page, BOOK);
    await people.getByRole('button', { name: 'New invitation' }).click();
    const form = page.getByRole('dialog', { name: 'New invitation' });
    await expect(form.getByText(/Choros da Ana has room for 50 more people/)).toBeVisible();
    expect(await analyzeBothThemes(page)).toEqual([]); // axe: the New invitation dialog
    await form.getByRole('button', { name: 'Cancel' }).click();
  }
  await expect(people.getByText('0 of 50 people')).toBeVisible();
  await expect(people.getByText(/^(You|.+ \(you\))$/)).toBeVisible();
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the people screen
  const link = await createInvitationIn(people, { role: 'Editor' });
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the made link
  await finishInvite(people);
  await expect(people).toBeVisible();

  // 2) A second person opens the link, makes an account and joins as an editor;
  // the book lands on their shelf as "can save". They give their saves a name
  // on the service.
  const joiner = await openDevice(browser);
  try {
    await enableVirtualAuthenticator(joiner.page);
    await joiner.page.goto(link);
    await expect(
      joiner.page.getByRole('heading', { name: /invited to a book on Estante/i }),
    ).toBeVisible();
    expect(await analyzeBothThemes(joiner.page)).toEqual([]); // axe: the invited screen
    await mockup(joiner.page, 'W01-first-run', 2);
    // The invitation's sections are the sign-in surface's: Make an account in
    // place, then Not now on Add a recovery email.
    await makeAccount(joiner.page);
    await expect(joiner.page.getByRole('button', { name: new RegExp(`^${escape(BOOK)}`) })).toBeVisible();
    await expect(joiner.page.getByText('On Estante · can save')).toBeVisible();
    await ownerNameOnService(joiner.page, 'Bia Rocha');

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

    // 4) The owner's people screen reads 1 of 50 and names the person — as a
    // member and as who joined through the invitation — never by an id
    // (books.share_people).
    people = await openSharing(page, BOOK);
    await expect(people.getByText('1 of 50 people')).toBeVisible();
    await expect(people.getByText(/^Editor invitation/)).toBeVisible();
    const memberRow = people
      .locator('.est-sharing-member', { has: page.getByRole('button', { name: 'Remove' }) })
      .first();
    await expect(memberRow.locator('.name')).toHaveText('Bia Rocha');
    await expect(people.getByText(/Joined through it:\s*Bia Rocha/)).toBeVisible();
    expect(await people.textContent()).not.toMatch(UUID);

    // 5) The owner lowers the member to reader (Make reader): the row's role
    // says Reader, and the member's shelf follows on its next sync.
    await memberRow.getByRole('button', { name: 'Change Bia Rocha’s role' }).click();
    await page.getByRole('menuitem', { name: 'Make reader' }).click();
    await expect(memberRow.getByRole('button', { name: 'Change Bia Rocha’s role' })).toContainText('Reader');
    expect(await analyzeBothThemes(page)).toEqual([]); // axe: the people screen with a reader

    // 6) The owner withdraws the invitation: nobody new can join; the joined
    // member stays (still 1 of 50).
    await people.getByRole('button', { name: 'Withdraw' }).click();
    await expect(people.getByText('withdrawn', { exact: true })).toBeVisible();
    await expect(people.getByText('1 of 50 people')).toBeVisible();
    expect(await analyzeBothThemes(page)).toEqual([]); // axe: the withdrawn state

    // 7) The owner removes the member: the confirm as W10 #3 draws it, no typed
    // name.
    await memberRow.getByRole('button', { name: 'Remove' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm.getByRole('heading', { name: 'Remove Bia Rocha?' })).toBeVisible();
    await expect(confirm.getByText(/Removing them takes effect the next time their app reaches Estante/)).toBeVisible();
    await expect(confirm.getByRole('textbox')).toHaveCount(0);
    expect(await analyzeBothThemes(page)).toEqual([]); // axe: the remove confirm
    await mockup(page, 'W10-share', 3);
    await confirm.getByRole('button', { name: 'Remove Bia Rocha', exact: true }).click();
    await expect(people.getByText('0 of 50 people')).toBeVisible();

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

// books.share_people (workflow 10 §Invitations): an open invitation's link can
// be copied again, from the people screen, and still lets someone in; once
// withdrawn there is nothing to copy.
// Workflow 10 **Where it sits** and its delta (books.setlist_picker_fixes
// Constraint 4): Done on a made invitation returns to where it was made from —
// the book from the phone's sheet, the people screen on a tablet or a computer —
// never to another destination (the persona's /setlists report).
test('Done on a made invitation returns to the book', async ({ page, checkA11y }) => {
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const share = page.getByRole('button', { name: 'Share', exact: true });

  if (onPhone()) {
    const sheet = await openShareSheet(page, BOOK);
    await createInvitationIn(sheet);
    await finishInvite(sheet);
    await expect(page.getByRole('region', { name: 'New invitation' })).toBeHidden();
    await expect(share).toBeVisible();
    expect(new URL(page.url()).pathname).not.toContain('/setlists');
    await expect(page.getByRole('tab', { name: 'Setlists', selected: true })).toHaveCount(0);
  } else {
    const people = await openSharing(page, BOOK);
    await createInvitationIn(people);
    await finishInvite(people);
    await expect(page.getByRole('dialog', { name: 'New invitation' })).toBeHidden();
    await expect(people).toBeVisible();
    expect(new URL(page.url()).pathname).not.toContain('/setlists');
    await closeSharing(page);
    await expect(share).toBeVisible();
    expect(new URL(page.url()).pathname).not.toContain('/setlists');
  }
  await checkA11y(); // the screen Done returned to
});

// shell.surface_restore_focus (workflow 10 **Where it sits**; Constraints 1-4):
// a sharing screen that closes re-mounts the screen beneath, and focus lands on
// it — the book's Share, or the people screen's title — never on <body>. The
// wide New invitation dialog keeps RAC's own restore (above).
test('focus lands on the restored screen when a sharing screen closes', async ({ page, checkA11y }) => {
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const share = page.getByRole('button', { name: 'Share', exact: true });

  if (onPhone()) {
    const sheet = await openShareSheet(page, BOOK);
    await createInvitationIn(sheet);
    await finishInvite(sheet);
    await expect(share).toBeFocused();
    await checkA11y(); // the book detail, after Done

    const people = await openSharing(page, BOOK);
    await createInvitationIn(people);
    await finishInvite(people);
    await expect(people.getByRole('heading', { level: 1 })).toBeFocused();
    await checkA11y(); // the people screen, after Done

    await closeSharing(page);
    await expect(share).toBeFocused();
    await checkA11y(); // the book detail, after Back
  } else {
    await openSharing(page, BOOK);
    await closeSharing(page);
    await expect(share).toBeFocused();
    await checkA11y(); // the book detail, after Back
  }
});

test("the owner copies an open invitation's link again, and a third person joins through it", async ({
  browser,
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const made = await inviteThroughShare(page, BOOK, { role: 'Reader', expiry: 'Until withdrawn' });

  const people = await openSharing(page, BOOK);
  const card = people.locator('.est-sharing-invite').first();
  await card.getByRole('button', { name: 'Copy link' }).click();
  await expect(card.getByRole('button', { name: 'Copied' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(made);
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: Copied

  const third = await joinThrough(browser, copied);
  try {
    await expect(third.page.getByText('On Estante · reader')).toBeVisible();
  } finally {
    await third.context.close();
  }

  await card.getByRole('button', { name: 'Withdraw' }).click();
  await expect(card.getByText('withdrawn', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Copy link' })).toHaveCount(0);
});

// Owner → song → Share (an appbar button on the computer, the More menu on the
// phone and the tablet — shell.narrow_fit Decision 7). Returns the song's share
// surface — the phone's sheet, the wide panel — and the members' address.
async function shareSong(page) {
  await openSongFromSearch(page, 'Roda', SONG_TITLE);
  const share = page.getByRole('button', { name: 'Share', exact: true });
  if (await share.isVisible().catch(() => false)) {
    await share.click();
  } else {
    await page.getByRole('button', { name: 'More', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'Share', exact: true }).click();
  }
  const surface = page
    .getByRole('dialog', { name: `Share ${SONG_TITLE}` })
    .or(page.getByRole('complementary', { name: `Share ${SONG_TITLE}` }));
  const address = await surface.getByRole('textbox', { name: 'Song address' }).inputValue();
  return { surface, address };
}

test('share from a song: the member address, and an invitation that opens on the song', async ({
  browser,
  page,
}) => {
  test.setTimeout(30000);
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const { surface, address } = await shareSong(page);
  expect(address).toMatch(/\/b\/[^/]+\/.+\.cifra\.md$/);
  if (onPhone()) {
    await expect(page.getByRole('dialog', { name: `Share ${SONG_TITLE}` })).toBeVisible();
  } else {
    // A panel beside the chart: no scrim, the song still there.
    await expect(page.getByRole('complementary', { name: `Share ${SONG_TITLE}` })).toBeVisible();
    await expect(page.getByRole('group', { name: SONG_TITLE }).first()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: share-on-a-song
  await mockup(page, 'W10-share', 4);

  // The song invitation: the link carries the song as a fragment.
  if (onPhone()) await surface.getByRole('button', { name: 'Invite someone to this song' }).click();
  await surface.getByRole('button', { name: 'Create link' }).click();
  const link = await surface.getByRole('textbox', { name: 'Invitation link' }).inputValue();
  expect(link).toContain('/i/');
  expect(link).toContain('#');
  await finishInvite(surface);

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

  // On wide, the panel's Manage opens the people screen.
  if (!onPhone()) {
    await surface.getByRole('button', { name: 'Manage' }).click();
    await expect(page.getByRole('region', { name: `${BOOK} · People` })).toBeVisible();
  } else {
    // The phone's sheet is still open on its summary: its Members row.
    await surface.getByRole('button', { name: /^Members/ }).click();
    await expect(page.getByRole('region', { name: `${BOOK} · People` })).toBeVisible();
  }
  // shell.surface_restore_focus_song (workflow 10 **Where it sits**;
  // Constraints 1-5): Back from that people screen re-mounts the song, and focus
  // lands on its share opener — the app bar's Share on the computer, More on the
  // phone and the tablet.
  await closeSharing(page);
  await expect(page.getByRole('group', { name: SONG_TITLE }).first()).toBeVisible();
  if (test.info().project.name === 'computer') {
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeFocused();
  } else {
    await expect(page.getByRole('button', { name: 'More', exact: true }).first()).toBeFocused();
  }
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the restored song
});

// books.setlist_invitation (workflow 10 §Sharing a song or a setlist, **Where it
// sits**; workflow 12 §Sharing one): Share on a setlist — the sheet on a phone,
// a panel beside the list wider — gives a member its address and the owner an
// invitation whose link carries the setlist's path. The invited join the whole
// book, and land on the setlist, on its address. Done returns to the setlist,
// never to /setlists. The setlist *Lesson 3* is written for this test.
test('share from a setlist: the member address, and an invitation that opens on the setlist', async ({
  browser,
  page,
}) => {
  test.setTimeout(45000);
  const SETLIST = 'Lesson 3';
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  await openSongFromSearch(page, 'Roda', SONG_TITLE);
  await addToNewSetlistFromSong(page, SONG_TITLE, SETLIST);
  // The new setlist is an unsaved change to the book: save it through the file
  // view, so it reaches Estante. The reader has no tabs beside it: start from `/`
  // (the unsaved setlist stays in the working copy).
  await startApp(page);
  await openFiles(page, BOOK);
  await saveAllChanges(page);
  await syncNow(page);
  await openSetlist(page, SETLIST);

  const setlistScreen = page.locator('.setlist-screen');
  const { surface, address } = await shareSetlist(page);
  expect(address).toMatch(/\/b\/[^/]+\/.+\.setlist\.md$/);
  if (onPhone()) {
    await expect(page.getByRole('dialog', { name: `Share ${SETLIST}` })).toBeVisible();
  } else {
    // A panel beside the list: no scrim, the list still there.
    await expect(page.getByRole('complementary', { name: `Share ${SETLIST}` })).toBeVisible();
    await expect(setlistScreen.getByText(SONG_TITLE).first()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  // The invited join the whole book, and the surface says so.
  await expect(surface.getByText(`Everyone you invite joins ${BOOK}; the link opens it on ${SETLIST}.`, { exact: false })).toBeVisible();
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: share-on-a-setlist

  if (onPhone()) await surface.getByRole('button', { name: 'Invite someone to this setlist' }).click();
  await surface.getByRole('button', { name: 'Create link' }).click();
  const link = await surface.getByRole('textbox', { name: 'Invitation link' }).inputValue();
  expect(link).toContain('/i/');
  expect(link).toMatch(/#.+\.setlist\.md$/);
  await finishInvite(surface);
  // Done returns to the setlist (workflow 10 **Where it sits**): the phone's
  // sheet to its summary, closed onto the setlist; the panel stays beside it.
  if (onPhone()) {
    await expect(surface.getByRole('button', { name: 'Invite someone to this setlist' })).toBeVisible();
    await surface.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await expect(page.getByRole('heading', { level: 2, name: SETLIST, exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(/\.setlist\.md$/);
  expect(new URL(page.url()).pathname).not.toMatch(/\/setlists$/);

  // A second person accepts and lands on the setlist, at its address.
  const joiner = await openDevice(browser);
  try {
    await enableVirtualAuthenticator(joiner.page);
    await acceptInvitation(joiner.page, link);
    const landed = joiner.page.locator('.setlist-screen');
    await expect(joiner.page.getByRole('heading', { level: 2, name: SETLIST, exact: true })).toBeVisible();
    await expect(landed.getByText(SONG_TITLE).first()).toBeVisible();
    await expect.poll(() => new URL(joiner.page.url()).pathname).toBe(new URL(address).pathname);
    expect(await analyzeBothThemes(joiner.page)).toEqual([]); // axe: the setlist a joiner lands on

    // A member opens the plain address and reads the same setlist.
    await joiner.page.goto(address);
    await expect(joiner.page.getByRole('heading', { level: 2, name: SETLIST, exact: true })).toBeVisible();
    await expect(landed.getByText(SONG_TITLE).first()).toBeVisible();
  } finally {
    await joiner.context.close();
  }

  // shell.surface_restore_focus_song (workflow 10 **Where it sits**;
  // Constraints 1-5): the people screen reached from the setlist's share — the
  // phone's sheet's Members, the panel's Manage — closes onto the setlist, and
  // focus lands on its share opener: More on the phone, the app bar's Share wider.
  if (onPhone()) {
    const { surface: sheet } = await shareSetlist(page);
    await sheet.getByRole('button', { name: /^Members/ }).click();
  } else {
    await surface.getByRole('button', { name: 'Manage' }).click();
  }
  await expect(page.getByRole('region', { name: `${BOOK} · People` })).toBeVisible();
  await closeSharing(page);
  await expect(page.getByRole('heading', { level: 2, name: SETLIST, exact: true })).toBeVisible();
  if (onPhone()) {
    await expect(setlistScreen.getByRole('button', { name: 'More', exact: true })).toBeFocused();
  } else {
    await expect(setlistScreen.locator('.appbar').getByRole('button', { name: 'Share', exact: true })).toBeFocused();
  }
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the restored setlist
});

// W10 #5 and #6: a full book as its owner sees it, and the book's sharing as a
// member sees it — the owner named, no other reader listed, no controls.
test("a full book's people screen, and a member's view of the book's sharing", async ({ browser, page }) => {
  test.setTimeout(30000);
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  await ownerNameOnService(page, 'Ana');
  const link = await inviteThroughShare(page, BOOK, { role: 'Reader' });

  const joiner = await joinThrough(browser, link);
  try {
    const sharing = await openSharing(joiner.page, BOOK);
    await expect(sharing.getByText('You’re a reader')).toBeVisible();
    await expect(sharing.locator('.est-sharing-member .name').first()).toHaveText('Ana');
    await expect(sharing.getByText(/Other readers aren’t listed\./)).toBeVisible();
    await expect(sharing.getByRole('button', { name: 'Remove' })).toHaveCount(0);
    await expect(sharing.getByRole('button', { name: 'New invitation' })).toHaveCount(0);
    expect(await analyzeBothThemes(joiner.page)).toEqual([]); // axe: a member's view
    await mockup(joiner.page, 'W10-share', 6);
  } finally {
    await joiner.context.close();
  }

  // The joiner is one of the fifty; the fill seeds the other forty-nine.
  await fillBookToCapacity(await bookIdOf(page, BOOK), 49);
  const people = await openSharing(page, BOOK);
  await expect(people.getByText('50 of 50 people')).toBeVisible();
  await expect(people.getByText('Full', { exact: true })).toBeVisible();
  await expect(people.getByText(/Choros da Ana is full\./)).toBeVisible();
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the full book
  await mockup(page, 'W10-share', 5);
});

test('a non-member opening a book address gets the "does not open" state', async ({ browser, page }) => {
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const { address } = await shareSong(page);

  const outsider = await openDevice(browser);
  try {
    await signedInDevice(outsider.page);
    await outsider.page.goto(address);
    await expect(outsider.page.getByText(/does not open|doesn’t open|can’t open/i).first()).toBeVisible();
    await expect(outsider.page.getByRole('group', { name: SONG_TITLE })).toHaveCount(0);
    expect(await analyzeBothThemes(outsider.page)).toEqual([]); // axe: the non-member state
    await mockup(outsider.page, 'W01-first-run', 4);
  } finally {
    await outsider.context.close();
  }
});
