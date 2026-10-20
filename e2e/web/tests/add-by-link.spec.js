// e2e-web (books.add_by_link) -- the collaborator's and the second device's path
// onto a shelf, against the compose stack on phone, tablet and computer (the
// three playwright.config projects). Pure real UI from `/`: an owner makes books
// and puts them online, and makes, ages and withdraws invitations in the Share
// dialog (role, expiry, use limit); the other people are other browser contexts
// with their own accounts, and the second device of one person is a context
// carrying a copy of the same passkey.
//
// Cases (workflow 1 §Invited, workflow 7 §Add-a-book, workflow 10):
//   - a second account opens an EDITOR invitation `/i/<token>`, is asked for an
//     account first (the generic invited screen names nothing about the book),
//     registers a passkey, and the book clones onto its shelf showing "can save";
//   - the same account opens a READER invitation and clones a book showing
//     "reader";
//   - a WITHDRAWN link shows "This link doesn't open a book" and a FULL book
//     shows "This book is full", neither naming the book, each a dialog over
//     the shelf (books.invited_presentation; W01 #4) -- and a fresh device that
//     makes its account through a withdrawn link is refused over its empty shelf;
//   - an invitation limited to one use is "used up" after it, and the next
//     person is refused;
//   - Add a book -> By link takes a pasted invitation URL;
//   - a second device of the same person finds the account's book come onto its
//     shelf on its own (workflow 13 §What comes down, account.new_device), so
//     Mine on Estante does not offer it twice; once removed from that shelf,
//     Mine on Estante offers it back and adds it.
// Axe (WCAG 2.1 AA) runs on the invited screen, each refusal and the Add-a-book
// sheet. Book names are written for this test (no-song-text rule).
//
// Server seeding kept on purpose: fillBookToCapacity inserts 50 accounts and
// memberships in SQL -- a full book cannot be reached through the UI.

import { test, expect, analyzeBothThemes } from '../lib/axe.js';
import {
  enableVirtualAuthenticator,
  hasSessionCookie,
  gotoTab,
  makeLocalBook,
  putBookOnline,
  sharePasskeys,
  signedInDevice,
  startApp,
  makeAccount,
} from '../lib/journeys.js';
import {
  acceptInvitation,
  bookIdOf,
  booksList,
  inviteThroughShare,
  openSharing,
  closeSharing,
} from '../lib/journeys-share.js';
import {
  accountWithConfirmed,
  signInExistingWithPasskey,
  signInFromMine,
  uniqueEmail,
  untilAccountShelf,
} from '../lib/journeys-account.js';
import { waitForMessage, extractSignInLink } from '../lib/mail.js';
import { openBookDetail } from '../lib/journeys-sync.js';
import { fillBookToCapacity } from '../lib/db.js';
import { openDevice } from '../lib/devices.js';
import { mockup } from '../lib/mockup.js';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rowFor = (title) => new RegExp('^' + escapeRegExp(title));

// An owner device with each of the named books online (a first commit pushed,
// so an accepted invitation can clone it).
async function ownerWithBooks(page, titles) {
  const authenticator = await signedInDevice(page);
  for (const title of titles) {
    await booksList(page);
    await makeLocalBook(page, title);
    await putBookOnline(page, title);
  }
  await startApp(page);
  return authenticator;
}

// The invited screen as W01 #2 draws it (books.invited_presentation): the
// heading takes focus on arrival without drawing a ring (Decision 2, pinned here
// against the real CSS — Decision 3), and the column sits at the top, the
// heading in the upper third of the window, under the book mark.
async function expectInvitedScreenAsDrawn(page, heading) {
  await expect(heading).toBeFocused();
  expect(await heading.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
  const box = await heading.boundingBox();
  const mark = await page.locator('.invited-mark').boundingBox();
  const { height } = page.viewportSize();
  expect(box.y).toBeLessThan(height / 3);
  expect(mark.y + mark.height).toBeLessThanOrEqual(box.y);
}

// Dismissing a refusal leaves the person on their shelf (workflow 1 §Invited,
// the presentation paragraph): the books they already had are still there.
async function expectShelfStill(page) {
  await gotoTab(page, 'Books');
  await expect(page.getByRole('button', { name: /^Choros da Ana/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Turma de quarta/ })).toBeVisible();
}

test.describe('add by link', () => {
  test('a second account joins as editor then reader; a withdrawn and a full link are refused', async ({
    browser,
    page,
  }) => {
    test.setTimeout(60000);

    await ownerWithBooks(page, ['Choros da Ana', 'Turma de quarta', 'Roda de choro', 'Sarau da sexta']);
    const editorLink = await inviteThroughShare(page, 'Choros da Ana', { role: 'Editor' });
    const readerLink = await inviteThroughShare(page, 'Turma de quarta', {
      role: 'Reader',
      expiry: 'A day',
    });

    // The owner's roster carries the terms the invitation was made with.
    let dialog = await openSharing(page, 'Turma de quarta');
    await expect(dialog.getByText('Reader invitation')).toBeVisible();
    await expect(dialog.getByText(/Expires in a day/)).toBeVisible();
    await closeSharing(page);

    // A withdrawn invitation: made, then withdrawn in the Share dialog.
    const deadLink = await inviteThroughShare(page, 'Roda de choro', { role: 'Reader' });
    dialog = await openSharing(page, 'Roda de choro');
    await dialog.getByRole('button', { name: 'Withdraw' }).click();
    await expect(dialog.getByText('withdrawn')).toBeVisible();
    await closeSharing(page);

    // A full book: the capacity fill is SQL (see the header).
    const fullLink = await inviteThroughShare(page, 'Sarau da sexta', { role: 'Reader' });
    await fillBookToCapacity(await bookIdOf(page, 'Sarau da sexta'));

    // Joiner: a fresh device with a virtual authenticator.
    const joiner = await openDevice(browser);
    try {
      await enableVirtualAuthenticator(joiner.page);

      // 1) The editor invitation: account-first, generic (names nothing about
      // the book), then a passkey, then the clone shows "can save".
      await joiner.page.goto(editorLink);
      const invitedHeading = joiner.page.getByRole('heading', { name: /invited to a book on Estante/i });
      await expect(invitedHeading).toBeVisible();
      await expect(joiner.page.getByText('Choros da Ana')).toHaveCount(0);
      await expectInvitedScreenAsDrawn(joiner.page, invitedHeading);
      expect(await analyzeBothThemes(joiner.page)).toEqual([]); // axe: the invited screen
      await mockup(joiner.page, 'W01-first-run', 2);

      // The invitation's sections are the sign-in surface's: Make an account in
      // place, then Not now on Add a recovery email.
      await makeAccount(joiner.page);

      await expect(joiner.page.getByRole('button', { name: /^Choros da Ana/ })).toBeVisible();
      await expect(joiner.page.getByText('On Estante · can save')).toBeVisible();
      expect(await analyzeBothThemes(joiner.page)).toEqual([]); // axe: the shelf
      await mockup(joiner.page, 'W07-add-a-book', 1);

      // 2) The reader invitation: already signed in, clones as reader.
      await acceptInvitation(joiner.page, readerLink, { signedIn: true });
      await expect(joiner.page.getByRole('button', { name: /^Turma de quarta/ })).toBeVisible();
      await expect(joiner.page.getByText('On Estante · reader')).toBeVisible();

      // 3) A withdrawn link: "This link doesn't open a book", naming nothing,
      // in a dialog over the shelf (books.invited_presentation; W01 #4).
      await joiner.page.goto(deadLink);
      let refusal = joiner.page.getByRole('alertdialog', { name: /doesn.t open a book/i });
      await expect(refusal).toBeVisible();
      await expect(joiner.page.getByText('Roda de choro')).toHaveCount(0);
      expect(await analyzeBothThemes(joiner.page)).toEqual([]); // axe: the dead-link refusal
      await mockup(joiner.page, 'W01-first-run', 4);
      await refusal.getByRole('button', { name: 'OK', exact: true }).click();
      await expect(refusal).toHaveCount(0);
      await expectShelfStill(joiner.page);

      // 4) A full book: "This book is full", naming nothing, likewise a dialog.
      await joiner.page.goto(fullLink);
      refusal = joiner.page.getByRole('alertdialog', { name: /is full/i });
      await expect(refusal).toBeVisible();
      await expect(refusal.getByRole('button', { name: 'Add a book by its link' })).toHaveCount(0);
      await expect(joiner.page.getByText('Sarau da sexta')).toHaveCount(0);
      expect(await analyzeBothThemes(joiner.page)).toEqual([]); // axe: the full-book refusal
      await mockup(joiner.page, 'W01-first-run', 4, { note: 'full book' });
      await refusal.getByRole('button', { name: 'OK', exact: true }).click();
      await expect(refusal).toHaveCount(0);
      await expectShelfStill(joiner.page);
    } finally {
      await joiner.context.close();
    }
  });

  // books.invited_presentation — W01 #4's exact state: a person who made their
  // account through a withdrawn link is refused in a dialog over the empty
  // front door, and stays on it once the dialog is dismissed.
  test('a fresh device opening a withdrawn link makes an account and is refused in a dialog over its empty shelf', async ({
    browser,
    page,
  }) => {
    test.setTimeout(25000);

    await ownerWithBooks(page, ['Roda de choro']);
    const deadLink = await inviteThroughShare(page, 'Roda de choro', { role: 'Reader' });
    const dialog = await openSharing(page, 'Roda de choro');
    await dialog.getByRole('button', { name: 'Withdraw' }).click();
    await expect(dialog.getByText('withdrawn')).toBeVisible();
    await closeSharing(page);

    const joiner = await openDevice(browser);
    try {
      await enableVirtualAuthenticator(joiner.page);
      await joiner.page.goto(deadLink);
      await expect(joiner.page.getByRole('heading', { name: /invited to a book on Estante/i })).toBeVisible();
      // The invitation's sections are the sign-in surface's: Make an account in
      // place, then Not now on Add a recovery email.
      await makeAccount(joiner.page);

      const refusal = joiner.page.getByRole('alertdialog', { name: /doesn.t open a book/i });
      await expect(refusal).toBeVisible();
      await expect(joiner.page.getByText('Roda de choro')).toHaveCount(0);
      // The empty front door is behind it (the modal aria-hides it, so by text).
      await expect(joiner.page.getByText('Your shelf is empty')).toBeVisible();
      expect(await analyzeBothThemes(joiner.page)).toEqual([]); // axe: the refusal over the empty shelf
      await mockup(joiner.page, 'W01-first-run', 4, { note: 'a new account, an empty shelf' });

      await refusal.getByRole('button', { name: 'OK', exact: true }).click();
      await expect(refusal).toHaveCount(0);
      await expect(joiner.page.getByRole('heading', { name: 'Your shelf is empty' })).toBeVisible();
      expect(await analyzeBothThemes(joiner.page)).toEqual([]); // axe: the empty shelf after it
    } finally {
      await joiner.context.close();
    }
  });

  test('a link limited to one use is used up by the first person and refuses the next', async ({
    browser,
    page,
  }) => {
    test.setTimeout(25000);

    await ownerWithBooks(page, ['Turma de quinta']);
    const link = await inviteThroughShare(page, 'Turma de quinta', {
      role: 'Reader',
      limit: 1,
    });
    let dialog = await openSharing(page, 'Turma de quinta');
    await expect(dialog.getByText('1 use left')).toBeVisible();
    await closeSharing(page);

    const first = await openDevice(browser);
    const second = await openDevice(browser);
    try {
      await signedInDevice(first.page);
      await acceptInvitation(first.page, link, { signedIn: true });
      await expect(first.page.getByRole('button', { name: /^Turma de quinta/ })).toBeVisible();
      await expect(first.page.getByText('On Estante · reader')).toBeVisible();

      // The owner's roster: the invitation is used up, one person joined.
      dialog = await openSharing(page, 'Turma de quinta');
      await expect(dialog.getByText('used up')).toBeVisible();
      await expect(dialog.getByText('0 uses left')).toBeVisible();
      // The joiner gave no name yet: named by role, never by an id
      // (books.share_people).
      await expect(dialog.getByText(/Joined through it:\s*Unnamed reader/)).toBeVisible();
      await closeSharing(page);

      // The next person is refused, and told nothing about the book.
      await signedInDevice(second.page);
      await acceptInvitation(second.page, link, { signedIn: true });
      await expect(second.page.getByRole('heading', { name: /doesn.t open a book/i })).toBeVisible();
      await expect(second.page.getByText('Turma de quinta')).toHaveCount(0);
    } finally {
      await first.context.close();
      await second.context.close();
    }
  });

  test('Add a book -> By link takes a pasted invitation URL (workflow 7)', async ({
    browser,
    page,
  }) => {
    test.setTimeout(25000);

    await ownerWithBooks(page, ['Choros da Ana']);
    const link = await inviteThroughShare(page, 'Choros da Ana', { role: 'Reader' });

    const joiner = await openDevice(browser);
    try {
      await signedInDevice(joiner.page);
      await gotoTab(joiner.page, 'Books');
      await joiner.page.getByRole('button', { name: 'Add a book' }).click();
      const sheet = joiner.page.getByRole('dialog', { name: 'Add a book' });
      await expect(sheet).toBeVisible();
      expect(await analyzeBothThemes(joiner.page)).toEqual([]); // axe: the chooser

      // The By link row opens its step in the sheet (books.add_book_chooser).
      await sheet.getByRole('button', { name: 'By link' }).click();
      await expect(sheet.getByRole('heading', { name: 'By link' })).toBeVisible();
      await expect(sheet.getByRole('textbox', { name: 'Book link' })).toBeFocused();
      expect(await analyzeBothThemes(joiner.page)).toEqual([]); // axe: the By link step
      await mockup(joiner.page, 'W07-add-a-book', 2, { note: 'by link' });

      // Something that is not a book link is refused in place.
      await sheet.getByRole('textbox', { name: 'Book link' }).fill('not a link');
      await sheet.getByRole('button', { name: 'Open' }).click();
      await expect(sheet.getByText('That is not a book link.')).toBeVisible();

      await sheet.getByRole('textbox', { name: 'Book link' }).fill(link);
      await sheet.getByRole('button', { name: 'Open' }).click();

      // The book is cloned onto the shelf with the invitation's role.
      await expect(joiner.page.getByRole('button', { name: /^Choros da Ana/ })).toBeVisible();
      await expect(joiner.page.getByText('On Estante · reader')).toBeVisible();
    } finally {
      await joiner.context.close();
    }
  });

  // The second device of one person: a copy of the passkey, the same account.
  // The owner's home book is on the service first (its shelf lists the book),
  // so signing in brings the book down (workflow 13 §What comes down).
  async function secondDevice(browser, page, first, title) {
    await untilAccountShelf(page, (shelf) =>
      Object.values(shelf.books ?? {}).some((b) => b?.label?.value === title && b?.link?.value),
    );
    const other = await openDevice(browser);
    const second = await enableVirtualAuthenticator(other.page);
    expect(await sharePasskeys(first, second)).toBeGreaterThan(0);
    await signInExistingWithPasskey(other.page);
    await startApp(other.page); // out of the Account screen, back to the shell
    await gotoTab(other.page, 'Books');
    return other;
  }

  // Workflow 13 §What comes down (account.new_device): the shelf fills on its
  // own, so the account's book is not offered twice under Add a book. The
  // second device signs in FROM THE CHOOSER: Mine on Estante's "Sign in with a
  // passkey" opens the surface for an existing account (books.add_book_chooser
  // Decision 4), never the create intent.
  test('a second device signs in from the chooser to the same account with a synced passkey: the account’s book comes onto its shelf, and Mine on Estante does not offer it twice (workflows 7, 13)', async ({
    browser,
    page,
  }) => {
    test.setTimeout(60000);
    const first = await ownerWithBooks(page, ['Minhas cifras']);
    await untilAccountShelf(page, (shelf) =>
      Object.values(shelf.books ?? {}).some((b) => b?.label?.value === 'Minhas cifras' && b?.link?.value),
    );
    const other = await openDevice(browser);
    const second = await enableVirtualAuthenticator(other.page);
    expect(await sharePasskeys(first, second)).toBeGreaterThan(0);
    try {
      await startApp(other.page);
      await signInFromMine(other.page, 'passkey', {
        onChooser: async () => {
          expect(await analyzeBothThemes(other.page)).toEqual([]); // axe: the signed-out chooser
        },
      });
      await other.page.getByRole('button', { name: 'Use a passkey' }).click();
      await expect.poll(() => hasSessionCookie(other.page)).toBe(true);

      await gotoTab(other.page, 'Books');
      await expect(other.page.getByRole('button', { name: rowFor('Minhas cifras') })).toBeVisible({ timeout: 30000 });
      await other.page.getByRole('button', { name: 'Add a book' }).click();
      const sheet = other.page.getByRole('dialog', { name: 'Add a book' });
      await expect(sheet).toBeVisible();
      const mine = sheet.getByRole('group', { name: 'Mine on Estante' });
      await expect(mine.getByText('All your books are already on this shelf.')).toBeVisible({ timeout: 10000 });
      expect(await analyzeBothThemes(other.page)).toEqual([]); // axe: the signed-in chooser
    } finally {
      await other.context.close();
    }
  });

  // Workflow 13 L25-30 (books.add_book_chooser Decision 4): a device with no
  // passkey signs in from the chooser by the account's recovery email — "No
  // passkey here? Email me a link" lands on the email step, the mail's
  // /sign-in/<token> link signs in, and the account's book comes down.
  test('No passkey here? Email me a link, from Mine on Estante, signs in an account by its recovery email (workflows 7, 13)', async ({
    browser,
    page,
  }) => {
    test.setTimeout(60000);
    const email = uniqueEmail('mine');
    await accountWithConfirmed(page, browser, email);
    await startApp(page);
    await makeLocalBook(page, 'Cifras do sábado');
    await putBookOnline(page, 'Cifras do sábado');
    await untilAccountShelf(page, (shelf) =>
      Object.values(shelf.books ?? {}).some((b) => b?.label?.value === 'Cifras do sábado' && b?.link?.value),
    );

    // A fresh device with no passkey.
    const fresh = await openDevice(browser);
    try {
      await startApp(fresh.page);
      await signInFromMine(fresh.page, 'email');
      expect(await analyzeBothThemes(fresh.page)).toEqual([]); // axe: the email step
      await fresh.page.getByRole('textbox', { name: 'Your email' }).fill(email);
      await fresh.page.getByRole('button', { name: 'Send the link' }).click();
      await expect(fresh.page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

      const message = await waitForMessage(email, (m) => extractSignInLink(m) !== null);
      expect(message, 'the sign-in mail should arrive at the catcher').not.toBeNull();
      const link = extractSignInLink(message);
      expect(link, 'the mail should carry a /sign-in/<token> link').not.toBeNull();
      await fresh.page.goto(link);
      await expect(fresh.page.getByRole('heading', { name: 'Make signing in quicker' })).toBeVisible();
      await expect.poll(() => hasSessionCookie(fresh.page)).toBe(true);
      await fresh.page.getByRole('button', { name: 'Not now' }).click();

      // The account's book comes onto this shelf, On Estante.
      await gotoTab(fresh.page, 'Books');
      await expect(fresh.page.getByRole('button', { name: rowFor('Cifras do sábado') })).toBeVisible({ timeout: 30000 });
      await expect(fresh.page.getByText(/^On Estante/).first()).toBeVisible();
    } finally {
      await fresh.context.close();
    }
  });

  test('Mine on Estante adds the account’s off-shelf book on a second device (workflow 7)', async ({
    browser,
    page,
  }) => {
    test.setTimeout(60000);
    const first = await ownerWithBooks(page, ['Minhas cifras']);
    const other = await secondDevice(browser, page, first, 'Minhas cifras');
    try {
      // It came down on its own; taken off this shelf, the account still has it.
      await expect(other.page.getByRole('button', { name: rowFor('Minhas cifras') })).toBeVisible({ timeout: 30000 });
      await openBookDetail(other.page, 'Minhas cifras');
      await other.page.getByRole('button', { name: 'Remove from my shelf' }).click();
      await other.page.getByRole('dialog').getByRole('button', { name: 'Remove from my shelf' }).click();
      await gotoTab(other.page, 'Books');
      await expect(other.page.getByRole('button', { name: rowFor('Minhas cifras') })).toHaveCount(0);

      await other.page.getByRole('button', { name: 'Add a book' }).click();
      const sheet = other.page.getByRole('dialog');
      // Listed in place, in the chooser's Mine on Estante row.
      await expect(
        sheet.getByRole('group', { name: 'Mine on Estante' }).getByText('Minhas cifras'),
      ).toBeVisible({ timeout: 10000 });
      expect(await analyzeBothThemes(other.page)).toEqual([]); // axe: the Add-a-book sheet with the list
      await sheet.getByRole('button', { name: 'Add Minhas cifras' }).click();

      // It clones onto the shelf, On Estante (the add lands on Search).
      await gotoTab(other.page, 'Books');
      await expect(other.page.getByRole('button', { name: rowFor('Minhas cifras') })).toBeVisible();
      // The row's meta leads with where it lives, then the owner's can-save
      // word, then its song count (books.row_opens_songs,
      // books.owner_can_save; workflow 7 L19-23).
      await expect(other.page.getByText(/^On Estante · can save · (\d+ songs?|still loading)$/)).toBeVisible();
    } finally {
      await other.context.close();
    }
  });
});
