// e2e-web (books.add_by_link) — the collaborator's and the second device's path
// onto a shelf, against the compose stack on phone, tablet and computer (the
// three playwright.config projects). An owner seeds a book put online and
// invitations through the API with its own browser session (service.sharing
// endpoints, exactly as e2e/api/sharing.test.js drives them); the journeys are
// black-box through the browser.
//
// Cases (workflow 1 §Invited, workflow 7 §Add-a-book):
//   - a second account opens an EDITOR invitation `/i/<token>`, is asked for an
//     account first (the generic invited screen names nothing about the book),
//     registers a passkey, and the book clones onto its shelf showing "can save";
//   - the same account opens a READER invitation and clones a book showing
//     "reader";
//   - a WITHDRAWN link shows "This link doesn't open a book" and a FULL book
//     shows "This book is full", neither naming the book;
//   - Mine on Estante lists the account's off-shelf book and adds it.
// Axe (WCAG 2.1 AA) runs on the invited screen, each refusal and the Add-a-book
// sheet. Book names are written for this test (no-song-text rule).

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';
import { waitForMessageTo, extractSignInLink } from '../lib/mail.js';
import { seedAccount, fillBookToCapacity } from '../lib/db.js';
import { openDevice } from '../lib/devices.js';

const uniqueEmail = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}@estante.test`;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rowFor = (title) => new RegExp('^' + escapeRegExp(title));

// The CDP virtual authenticator (the joiner registers a passkey here), the same
// setup account-sign-in.spec.js / online.spec.js use.
async function enableVirtualAuthenticator(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return client;
}

async function hasSessionCookie(page) {
  const cookies = await page.context().cookies();
  return cookies.some((c) => c.name === 'estante_session' && c.value);
}

// Sign an owner in through the emailed-link fallback (no authenticator needed):
// the account holds a seeded recovery email, so the link signs it in. Declines
// adding a passkey here. Leaves the page signed in, with the empty shelf.
async function signInByEmail(page, email) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await page.getByRole('textbox', { name: 'Your email' }).fill(email);
  await page.getByRole('button', { name: 'Send the link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  const message = await waitForMessageTo(email);
  expect(message, `no sign-in email arrived for ${email}`).not.toBeNull();
  const link = extractSignInLink(message);
  expect(link, 'no sign-in link in the email').not.toBeNull();
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Make signing in quicker' })).toBeVisible();
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
}

// Create an EMPTY online book through the owner's browser session, and return
// the Book. `page.request` shares the signed-in context's cookie jar. The
// service creates only the bare repo (no first commit — book.go InitBare), so
// this book cannot be cloned; it is used only for the REFUSED cases, where the
// accept is rejected before any clone.
async function createEmptyBook(page, title) {
  const resp = await page.request.post('/api/books', { data: { title } });
  expect(resp.status(), `createEmptyBook(${title})`).toBe(201);
  return resp.json();
}

// Make a book the joiner can CLONE: create it locally through the UI (a first
// commit — the README scaffold) and put it online, which pushes that commit. The
// service-created empty repo has no refs/heads/main, so only a put-online book is
// cloneable. Returns its Book from GET /api/books (for the invitation call).
async function makeOnlineBook(page, title) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('tab', { name: 'Books' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a book' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('textbox', { name: 'Book name' }).fill(title);
  await sheet.getByRole('button', { name: 'New book' }).click();
  await expect(page.getByRole('button', { name: rowFor(title) })).toBeVisible();
  // Open its detail and put it online.
  await page.getByRole('button', { name: rowFor(title) }).click();
  await page.getByRole('button', { name: 'Put online' }).click();
  await expect(page.getByText('On Estante · private')).toBeVisible();
  const resp = await page.request.get('/api/books');
  expect(resp.status()).toBe(200);
  const { books } = await resp.json();
  const book = books.find((b) => b.title === title);
  expect(book, `online book ${title} not in /api/books`).toBeTruthy();
  return book;
}

// Create an invitation on a book and return it (its `url` is `<base>/i/<token>`).
async function createInvitation(page, bookId, role) {
  const resp = await page.request.post(`/api/books/${bookId}/invitations`, { data: { role } });
  expect(resp.status(), `createInvitation(${role})`).toBe(201);
  return resp.json();
}

async function withdrawInvitation(page, bookId, invitationId) {
  const resp = await page.request.delete(`/api/books/${bookId}/invitations/${invitationId}`);
  expect(resp.status()).toBe(204);
}

test.describe('add by link', () => {
  test('a second account joins as editor then reader; a withdrawn and a full link are refused', async ({
    browser,
    page,
  }) => {
    // Owner: sign in and seed the books + invitations. The two CLONEABLE books
    // (editor, reader) are put online through the UI so they carry a first
    // commit; the two REFUSED books (withdrawn, full) stay empty — the accept is
    // rejected before any clone.
    const ownerEmail = uniqueEmail('owner');
    await seedAccount(ownerEmail);
    await signInByEmail(page, ownerEmail);

    const editorBook = await makeOnlineBook(page, 'Choros da Ana');
    const editorInv = await createInvitation(page, editorBook.id, 'editor');
    const readerBook = await makeOnlineBook(page, 'Turma de quarta');
    const readerInv = await createInvitation(page, readerBook.id, 'reader');
    const deadBook = await createEmptyBook(page, 'Roda de choro');
    const deadInv = await createInvitation(page, deadBook.id, 'reader');
    await withdrawInvitation(page, deadBook.id, deadInv.id);
    const fullBook = await createEmptyBook(page, 'Sarau da sexta');
    const fullInv = await createInvitation(page, fullBook.id, 'reader');
    await fillBookToCapacity(fullBook.id);

    // Joiner: a fresh device with a virtual authenticator.
    const joiner = await openDevice(browser);
    try {
      await enableVirtualAuthenticator(joiner.page);

      // 1) The editor invitation: account-first, generic (names nothing about
      // the book), then a passkey, then the clone shows "can save".
      await joiner.page.goto(editorInv.url);
      await expect(
        joiner.page.getByRole('heading', { name: /invited to a book on Estante/i }),
      ).toBeVisible();
      await expect(joiner.page.getByText('Choros da Ana')).toHaveCount(0);
      expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the invited screen

      await joiner.page.getByRole('button', { name: 'Make an account' }).click();
      await expect(joiner.page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
      await joiner.page.getByRole('button', { name: 'Use a passkey' }).click();

      await expect(joiner.page.getByRole('button', { name: /^Choros da Ana/ })).toBeVisible();
      await expect(joiner.page.getByText('On Estante · can save')).toBeVisible();
      expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the shelf

      // 2) The reader invitation: already signed in, clones as reader.
      await joiner.page.goto(readerInv.url);
      await expect(joiner.page.getByRole('button', { name: /^Turma de quarta/ })).toBeVisible();
      await expect(joiner.page.getByText('On Estante · reader')).toBeVisible();

      // 3) A withdrawn link: "This link doesn't open a book", naming nothing.
      await joiner.page.goto(deadInv.url);
      await expect(joiner.page.getByRole('heading', { name: /doesn.t open a book/i })).toBeVisible();
      await expect(joiner.page.getByText('Roda de choro')).toHaveCount(0);
      expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the dead-link refusal

      // 4) A full book: "This book is full", naming nothing.
      await joiner.page.goto(fullInv.url);
      await expect(joiner.page.getByRole('heading', { name: /is full/i })).toBeVisible();
      await expect(joiner.page.getByText('Sarau da sexta')).toHaveCount(0);
      expect(await analyzeWcag21aa(joiner.page)).toEqual([]); // axe: the full-book refusal
    } finally {
      await joiner.context.close();
    }
  });

  test('Mine on Estante lists the account’s off-shelf book and adds it (workflow 7)', async ({
    page,
    checkA11y,
  }) => {
    // The account has an online book that is NOT on this device's shelf — modelled
    // by putting a book online, then removing it from this shelf (it stays on
    // Estante). It then appears under "Mine on Estante" and can be added back
    // (Decision 5; the tombstoned shelf entry counts as absent).
    const ownerEmail = uniqueEmail('mine');
    await seedAccount(ownerEmail);
    await signInByEmail(page, ownerEmail);
    await makeOnlineBook(page, 'Minhas cifras'); // on the shelf, online, detail open

    // Remove it from this device's shelf (it stays on Estante).
    await page.getByRole('button', { name: 'Remove from my shelf' }).click();
    const removeDialog = page.getByRole('dialog');
    await expect(removeDialog).toBeVisible();
    await removeDialog.getByRole('button', { name: 'Remove from my shelf' }).click();
    await expect(page.getByRole('button', { name: rowFor('Minhas cifras') })).toHaveCount(0);

    // Now it is listed under Mine on Estante, and can be added back.
    await page.getByRole('button', { name: 'Add a book' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Minhas cifras')).toBeVisible();
    await checkA11y(); // axe: the Add-a-book sheet with the list

    await sheet.getByRole('button', { name: 'Add Minhas cifras' }).click();

    // It clones onto the shelf, On Estante.
    await expect(page.getByRole('button', { name: rowFor('Minhas cifras') })).toBeVisible();
    await expect(page.getByText('On Estante')).toBeVisible();
  });
});
