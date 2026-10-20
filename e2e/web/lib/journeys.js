// Shared real-UI journeys for the e2e-web specs.
//
// Every helper here drives the app the way a person does — from `/`, through
// the real navigation, against the real stack — so a spec built from them
// covers the workflow end to end. The only things below the UI are platform
// emulation the browser itself offers (the CDP virtual WebAuthn authenticator,
// context.setOffline), and read-only lookups (a book's git URL, the session
// cookie) a second device needs. No helper writes app state from test code:
// no #dev/* mounts, no page.evaluate that changes anything, no page.route
// mocks, no synthetic DOM events, no API writes the UI can do.
//
// Before these existed, each spec carried its own copy of these steps, and the
// copies drifted into shortcuts. Add a step here, once, when a second spec
// needs it.

import { expect } from '@playwright/test';
import { waitForServiceWorker } from './offline.js';
import { baseUrl } from './env.js';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- arriving ------------------------------------------------------------

// Load the app at its real entry point and wait until the service worker
// controls it (the app is precache-first; offline steps depend on this).
export async function startApp(page, path = '/') {
  await page.goto(path);
  await waitForServiceWorker(page);
}

// One of the three destinations (phone tab bar; the same tabs on the wide
// layouts' rail). Waits for the destination's heading.
export async function gotoTab(page, name) {
  // A book's detail is a layer over its songs, with no tabs beside it
  // (books.row_opens_songs): step back through *Back to {book}* first. The
  // detail may close on its own meanwhile (a removed book's does, landing on
  // Books), so a Back that is gone by the time of the click is fine.
  const backToBook = page.locator('.book-detail').getByRole('button', { name: /^Back to / });
  if (await backToBook.count()) {
    await backToBook
      .first()
      .click({ timeout: 3000 })
      .catch(async (err) => {
        if (await backToBook.count()) throw err;
      });
    await expect(page.locator('.book-detail')).toHaveCount(0);
  }
  await page.getByRole('tab', { name }).click();
  if (name !== 'Search') {
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  }
}

// First run: put the bundled example book on the device and wait until its
// songs are searchable. The first-run button can race the shelf's first
// render, hence the retry.
export async function openExampleBook(page) {
  await startApp(page);
  const openExample = page.getByRole('button', { name: /Open the example book/ });
  const books = page.getByRole('heading', { name: 'Books' });
  await expect(async () => {
    if (await openExample.isVisible().catch(() => false)) {
      await openExample.click({ timeout: 2000 }).catch(() => {});
    }
    await expect(books).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 10000 });
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByRole('button', { name: /Morning on the Porch/ }).first()).toBeVisible();
  await page.getByRole('searchbox').fill('');
}

// ---- signing in (workflow 13) ----------------------------------------------

// A virtual platform authenticator on this page's browser context — platform
// emulation, the way a real device's passkey store answers WebAuthn.
export async function enableVirtualAuthenticator(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { client, authenticatorId };
}

// Model a synced passkey (iCloud Keychain, Google Password Manager): copy the
// credentials of one device's authenticator into another's, so the second
// device signs in to the SAME account with "Use a passkey". Both arguments are
// what enableVirtualAuthenticator returned.
export async function sharePasskeys(from, to) {
  const { credentials } = await from.client.send('WebAuthn.getCredentials', {
    authenticatorId: from.authenticatorId,
  });
  for (const credential of credentials) {
    await to.client.send('WebAuthn.addCredential', { authenticatorId: to.authenticatorId, credential });
  }
  return credentials.length;
}

export async function hasSessionCookie(page) {
  const cookies = await page.context().cookies();
  return cookies.some((c) => c.name === 'estante_session' && c.value);
}

// The session cookie as a `Cookie:` header value — what a second device (the
// git CLI over smart HTTP) carries to act as this account.
export async function sessionCookie(page) {
  const cookies = await page.context().cookies();
  const c = cookies.find((x) => x.name === 'estante_session');
  if (!c) throw new Error('no estante_session cookie on this context');
  return `estante_session=${c.value}`;
}

// Open the one sign-in surface (account.sign_in_two_doors; workflow 13
// §Signing in, or making an account): the cold first run's row when the shelf
// offers it, else the account screen's card. Lands on its two sections.
export async function openSignInSurface(page) {
  const row = page.getByRole('button', { name: /^Sign in or make an account/ });
  if (!(await row.first().isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Account', exact: true }).click();
  }
  await row.first().click();
  await expect(page.getByRole('heading', { name: 'Sign in or make an account' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'New here?' })).toBeVisible();
}

// On the open surface (its own heading, or an invitation's): *Make an account*
// (a new account with a passkey — needs enableVirtualAuthenticator), then the
// step it is followed by, *Add a recovery email*: `recovery: 'not now'` skips
// it; an address sends the verification link and waits for the words that name
// it, then *Done*. Resolves once the surface is gone.
export async function makeAccount(page, { recovery = 'not now' } = {}) {
  await page.getByRole('group', { name: 'New here?' }).getByRole('button', { name: 'Make an account' }).click();
  await expect(page.getByRole('heading', { name: 'Add a recovery email' })).toBeVisible();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
  if (recovery === 'not now') {
    await page.getByRole('button', { name: 'Not now' }).click();
  } else {
    await page.getByRole('textbox', { name: 'Recovery email' }).fill(recovery);
    await page.getByRole('button', { name: 'Send link' }).click();
    await expect(page.getByText(/We sent a verification link to/)).toBeVisible();
    await expect(page.getByText(recovery, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Add a recovery email' })).toBeHidden();
}

// Make a new account with a passkey from the cold first run, skipping the
// recovery email (*Not now*). Needs enableVirtualAuthenticator first.
export async function signInWithPasskey(page) {
  await startApp(page);
  await openSignInSurface(page);
  await makeAccount(page);
}

// A fresh device with its own authenticator, signed in to a new account.
export async function signedInDevice(page) {
  const authenticator = await enableVirtualAuthenticator(page);
  await signInWithPasskey(page);
  return authenticator;
}

// ---- books (workflow 7) ------------------------------------------------------

// Books → *Add a book*: the chooser sheet of the ways in (books.add_book_chooser;
// workflow 7 §The book-management screen). Returns the sheet.
export async function openAddABook(page) {
  await gotoTab(page, 'Books');
  await page.getByRole('button', { name: 'Add a book' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  return sheet;
}

export async function makeLocalBook(page, name) {
  const sheet = await openAddABook(page);
  // The sheet is a chooser (books.add_book_chooser): New book's row opens its step.
  await sheet.getByRole('button', { name: 'New book' }).click();
  await sheet.getByRole('textbox', { name: 'Book name' }).fill(name);
  await sheet.getByRole('button', { name: 'New book' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^${escape(name)}`) })).toBeVisible();
}

// Books → the book's row: its songs, search scoped to it at `…/b/<book>`, the
// bar naming it above them (books.row_opens_songs; workflow 7 L28-34).
export async function openBookSongs(page, name) {
  await gotoTab(page, 'Books');
  await page.getByRole('button', { name: new RegExp(`^${escape(name)}`) }).click();
  await expect(page).toHaveURL(/\/b\/[^/]+$/);
  await expect(page.getByRole('button', { name: `Manage ${name}` }).first()).toBeVisible();
}

// Books → the book → *Manage*: the book's detail, a layer over its songs
// (workflow 7 L86-95).
export async function openBookDetail(page, name) {
  await openBookSongs(page, name);
  await page.getByRole('button', { name: `Manage ${name}` }).first().click();
  await expect(page.locator('.book-detail')).toBeVisible();
}

// Put a book online from its detail (signed in).
export async function putBookOnline(page, name) {
  await openBookDetail(page, name);
  await page.getByRole('button', { name: 'Put online' }).click();
  await expect(page.getByText('On Estante · private')).toBeVisible();
}

// Read-only: the hosted book's git URL, for a second device to clone.
export async function bookGitUrl(page, title) {
  const resp = await page.request.get('/api/books');
  expect(resp.ok()).toBeTruthy();
  const { books } = await resp.json();
  const book = books.find((b) => b.title === title);
  if (!book) throw new Error(`book ${title} not found for the account`);
  return new URL(book.gitUrl, `${baseUrl}/`).toString();
}

// Sign in, make a book, put it online, and come back to `/`. Returns the
// authenticator, the book's git URL and the session cookie.
export async function hostedBook(page, name) {
  const authenticator = await signedInDevice(page);
  await makeLocalBook(page, name);
  await putBookOnline(page, name);
  await startApp(page);
  return { authenticator, url: await bookGitUrl(page, name), cookie: await sessionCookie(page) };
}

// ---- sync (workflow 8) --------------------------------------------------------

// Run a sync pass the way the world does: the network drops and comes back.
// Chromium fires the real `online` event, which the app listens for
// (app/src/sync-triggers.js).
export async function networkBlip(page, { offlineMs = 300 } = {}) {
  const context = page.context();
  await context.setOffline(true);
  await page.waitForTimeout(offlineMs);
  await context.setOffline(false);
}

// Back out of an open song (or any full screen with a Back) to the
// destinations, where the tabs are.
export async function toDestinations(page) {
  // Close an open dialog or sheet first (Escape, as a person would).
  for (let i = 0; i < 3 && (await page.getByRole('dialog').count()) > 0; i++) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 1000 }).catch(() => {});
  }
  const tab = page.getByRole('tab', { name: 'Books' });
  // A surface may sit over another (the people screen over a book's detail,
  // the detail over the book's songs): step back until the tabs show.
  for (let i = 0; i < 4 && !(await tab.isVisible().catch(() => false)); i++) {
    await page.getByRole('button', { name: /^Back/ }).filter({ visible: true }).first().click();
    await tab.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
  }
  await expect(tab).toBeVisible();
}

// Books → Sync now: one sync pass, started the way a person starts it.
export async function syncNow(page) {
  await toDestinations(page);
  await gotoTab(page, 'Books');
  await page.getByRole('button', { name: 'Sync now' }).click();
}

// Sync, then wait until `title` is found by search — proof the pass brought
// the song down (a merge re-indexes its book at once).
export async function waitUntilSearchable(page, query, title, { timeout = 10000 } = {}) {
  await syncNow(page);
  await gotoTab(page, 'Search');
  await page.getByRole('searchbox').first().fill(query);
  await expect(page.getByRole('button', { name: new RegExp(escape(title)) }).first()).toBeVisible({
    timeout,
  });
}

// ---- songs (workflows 2, 4, 6) ---------------------------------------------

// Search for a song and open it in the reading view. With a song already open
// on the computer the search sits beside it (no tab bar); otherwise (the phone,
// the tablet's whole-pane reading) go to the Search destination first.
export async function openSongFromSearch(page, query, title) {
  // Landed (a reload, a deep link) on an address: the shell shows its
  // destination, busy, while the address resolves, then opens what it names.
  // Wait for that before deciding where search is.
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0);
  const searchbox = page.getByRole('searchbox');
  if (!(await searchbox.first().isVisible().catch(() => false))) {
    // A full-screen song on a phone: Back to the destinations first.
    const tab = page.getByRole('tab', { name: 'Search' });
    if (!(await tab.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /^Back/ }).filter({ visible: true }).first().click();
    }
    await gotoTab(page, 'Search');
  }
  await searchbox.first().fill(query);
  await page.getByRole('button', { name: new RegExp(escape(title)) }).first().click();
  await expect(page.getByRole('group', { name: title }).first()).toBeVisible();
}

// From search, narrow it to one book with that book's *Search only in {book}*
// (workflow 2 §Scope): the scope chip shows the book.
export async function scopeToBook(page, bookTitle) {
  await page.getByRole('searchbox').first().fill('');
  await page.getByRole('button', { name: `Search only in ${bookTitle}` }).click();
  await expect(page.locator('.scope')).toContainText(bookTitle);
}

// From the reading view, the song's Edit: the source editor opens on it.
export async function editFromReading(page) {
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.locator('.cm-content')).toBeVisible();
}

// Search → song → Edit.
export async function openSongInEditor(page, query, title) {
  await openSongFromSearch(page, query, title);
  await editFromReading(page);
}

// Put the caret at the end of the editor line that reads `line` exactly, and
// type `text` there.
export async function typeAtEndOfLine(page, line, text) {
  const content = page.locator('.cm-content');
  await content.getByText(line, { exact: true }).first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(text);
}

// The editor writes to the working copy on a debounce. Save, Back and leaving
// the editor all send it at once; only a step that kills the page (a reload,
// closing the tab) or reads the working copy from elsewhere (a sync) needs to
// wait it out.
export async function settleEdits(page) {
  await page.waitForTimeout(800);
}

// Where the save opens (songs.editor_chrome Constraint 7): a bottom sheet on a
// phone and a centred dialog on a tablet (both `role="dialog"`), and for a saved
// song on a computer an inline panel beside it — a region named *Save {title}*,
// or the make-it-your-own offer in that same panel. Whichever opened.
export function saveSurface(page) {
  return page.getByRole('dialog').or(page.getByRole('region', { name: /^Save / })).or(page.locator('.est-save-panel'));
}

// The editor's Save → the save sheet → its Save, with an optional note. The
// first save on a device asks for the author's name (workflow 4 §Who made the
// change); `name` answers it. Waits for the sheet to close (the commit landed).
// `onSheet(sheet)` runs while the sheet is open, before saving (assertions,
// axe, a mockup() snapshot). `saveAnyway` answers a sheet that lists words not
// read as chords (workflow 4 §Saving): its button then reads *Save anyway*. A
// journey that does not expect the list keeps the exact *Save*, so a fixture
// holding such words by accident fails here rather than being waved through.
export async function saveThroughSheet(page, { note, name = 'Marina Souza', onSheet, saveAnyway = false } = {}) {
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  const sheet = saveSurface(page);
  await expect(sheet).toBeVisible();
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill(name);
  if (note !== undefined) await sheet.getByRole('textbox', { name: /Note/ }).fill(note);
  if (onSheet) await onSheet(sheet);
  await sheet.getByRole('button', { name: saveAnyway ? 'Save anyway' : 'Save', exact: true }).click();
  await expect(sheet).toBeHidden();
}

// From the reading view, the song's History: a toolbar button on the wide
// layouts, the More menu on a phone. Waits for the history list.
export async function historyFromReading(page) {
  const button = page.getByRole('button', { name: 'History', exact: true }).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.getByRole('button', { name: 'More', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'History', exact: true }).click();
  }
  await expect(page.locator('.est-history-row').first()).toBeVisible();
}

// From the reading view, *Show the file* (songs.show_the_file; workflow 14 §The
// view): the More menu on every device. `checkA11y`, when given, runs with the
// menu open. Waits for the file view's raw editor on the song's file.
export async function showFileFromReading(page, checkA11y) {
  await page.getByRole('button', { name: 'More', exact: true }).filter({ visible: true }).first().click();
  const item = page.getByRole('menuitem', { name: 'Show the file', exact: true });
  await expect(item).toBeVisible();
  if (checkA11y) await checkA11y(); // the menu open
  await item.click();
  await expect(page.locator('.cm-content')).toBeVisible();
}

// ---- the file view (workflow 14) ---------------------------------------------

// Books → the book → Manage → Files: the file view on that book (workflow 14
// §The view).
export async function openFiles(page, bookTitle) {
  await openBookDetail(page, bookTitle);
  await page.getByRole('button', { name: `Files in ${bookTitle}` }).click();
}

// Books → Files → a file in the tree (a song opens in the raw editor).
export async function openFileInFiles(page, bookTitle, fileName) {
  await openFiles(page, bookTitle);
  await page.getByRole('button', { name: new RegExp(escape(fileName)) }).click();
}
