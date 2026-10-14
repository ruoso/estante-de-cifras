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
//     shows "This book is full", neither naming the book;
//   - an invitation limited to one use is "used up" after it, and the next
//     person is refused;
//   - Add a book -> By link takes a pasted invitation URL;
//   - Mine on Estante lists the account's off-shelf book on a second device and
//     adds it.
// Axe (WCAG 2.1 AA) runs on the invited screen, each refusal and the Add-a-book
// sheet. Book names are written for this test (no-song-text rule).
//
// Server seeding kept on purpose: fillBookToCapacity inserts 50 accounts and
// memberships in SQL -- a full book cannot be reached through the UI.

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';
import {
  enableVirtualAuthenticator,
  gotoTab,
  makeLocalBook,
  putBookOnline,
  sharePasskeys,
  signedInDevice,
  startApp,
} from '../lib/journeys.js';
import {
  acceptInvitation,
  bookIdOf,
  booksList,
  inviteThroughShare,
  openSharing,
} from '../lib/journeys-share.js';
import { signInExistingWithPasskey } from '../lib/journeys-account.js';
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

test.describe('add by link', () => {
  test('a second account joins as editor then reader; a withdrawn and a full link are refused', async ({
    browser,
    page,
  }) => {
    test.setTimeout(20000);

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
    await dialog.getByRole('button', { name: 'Close' }).click();

    // A withdrawn invitation: made, then withdrawn in the Share dialog.
    const deadLink = await inviteThroughShare(page, 'Roda de choro', { role: 'Reader' });
    dialog = await openSharing(page, 'Roda de choro');
    await dialog.getByRole('button', { name: 'Withdraw' }).click();
    await expect(dialog.getByText('withdrawn')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();

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
      await expect(
        joiner.page.getByRole('heading', { name: /invited to a book on Estante/i }),
      ).toBeVisible();
      await expect(joiner.page.getByText('Choros da Ana')).toHaveCount(0);
      expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the invited screen
      await mockup(joiner.page, 'W01-first-run', 2);

      await joiner.page.getByRole('button', { name: 'Make an account' }).click();
      await expect(joiner.page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
      await joiner.page.getByRole('button', { name: 'Use a passkey' }).click();

      await expect(joiner.page.getByRole('button', { name: /^Choros da Ana/ })).toBeVisible();
      await expect(joiner.page.getByText('On Estante · can save')).toBeVisible();
      expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the shelf
      await mockup(joiner.page, 'W07-add-a-book', 1);

      // 2) The reader invitation: already signed in, clones as reader.
      await acceptInvitation(joiner.page, readerLink, { signedIn: true });
      await expect(joiner.page.getByRole('button', { name: /^Turma de quarta/ })).toBeVisible();
      await expect(joiner.page.getByText('On Estante · reader')).toBeVisible();

      // 3) A withdrawn link: "This link doesn't open a book", naming nothing.
      await joiner.page.goto(deadLink);
      await expect(joiner.page.getByRole('heading', { name: /doesn.t open a book/i })).toBeVisible();
      await expect(joiner.page.getByText('Roda de choro')).toHaveCount(0);
      expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the dead-link refusal
      await mockup(joiner.page, 'W01-first-run', 4);

      // 4) A full book: "This book is full", naming nothing.
      await joiner.page.goto(fullLink);
      await expect(joiner.page.getByRole('heading', { name: /is full/i })).toBeVisible();
      await expect(joiner.page.getByText('Sarau da sexta')).toHaveCount(0);
      expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the full-book refusal
    } finally {
      await joiner.context.close();
    }
  });

  test('a link limited to one use is used up by the first person and refuses the next', async ({
    browser,
    page,
  }) => {
    test.setTimeout(10000);

    await ownerWithBooks(page, ['Turma de quinta']);
    const link = await inviteThroughShare(page, 'Turma de quinta', {
      role: 'Reader',
      limit: 1,
    });
    let dialog = await openSharing(page, 'Turma de quinta');
    await expect(dialog.getByText('1 use left')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();

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
      await expect(dialog.getByText(/1 person/)).toBeVisible();
      await dialog.getByRole('button', { name: 'Close' }).click();

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
    test.setTimeout(10000);

    await ownerWithBooks(page, ['Choros da Ana']);
    const link = await inviteThroughShare(page, 'Choros da Ana', { role: 'Reader' });

    const joiner = await openDevice(browser);
    try {
      await signedInDevice(joiner.page);
      await gotoTab(joiner.page, 'Books');
      await joiner.page.getByRole('button', { name: 'Add a book' }).click();
      const sheet = joiner.page.getByRole('dialog');
      await expect(sheet).toBeVisible();
      expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the Add-a-book sheet
      await mockup(joiner.page, 'W07-add-a-book', 2);

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
  async function secondDevice(browser, first) {
    const other = await openDevice(browser);
    const second = await enableVirtualAuthenticator(other.page);
    expect(await sharePasskeys(first, second)).toBeGreaterThan(0);
    await signInExistingWithPasskey(other.page);
    await startApp(other.page); // out of the Account screen, back to the shell
    await gotoTab(other.page, 'Books');
    return other;
  }

  test('a second device signs in to the same account with a synced passkey and lists its book under Add a book (workflow 7)', async ({
    browser,
    page,
  }) => {
    test.setTimeout(10000);
    const first = await ownerWithBooks(page, ['Minhas cifras']);
    const other = await secondDevice(browser, first);
    try {
      // Nothing on this shelf yet, though the account has a book.
      await expect(other.page.getByRole('button', { name: rowFor('Minhas cifras') })).toHaveCount(0);
      await other.page.getByRole('button', { name: 'Add a book' }).click();
      const sheet = other.page.getByRole('dialog');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText('Minhas cifras')).toBeVisible();
      expect(await analyzeWcag21aa(other.page)).toEqual([]); // axe: the Add-a-book sheet with the list
    } finally {
      await other.context.close();
    }
  });

  test('Mine on Estante adds the account’s off-shelf book on a second device (workflow 7)', async ({
    browser,
    page,
  }) => {
    test.setTimeout(10000);
    const first = await ownerWithBooks(page, ['Minhas cifras']);
    const other = await secondDevice(browser, first);
    try {
      await other.page.getByRole('button', { name: 'Add a book' }).click();
      const sheet = other.page.getByRole('dialog');
      await sheet.getByRole('button', { name: 'Add Minhas cifras' }).click();

      // It clones onto the shelf, On Estante (the add lands on Search).
      await gotoTab(other.page, 'Books');
      await expect(other.page.getByRole('button', { name: rowFor('Minhas cifras') })).toBeVisible();
      await expect(other.page.getByText('On Estante')).toBeVisible();
    } finally {
      await other.context.close();
    }
  });
});
