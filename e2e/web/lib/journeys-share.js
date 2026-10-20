// Real-UI journeys for sharing a book (workflow 10) and joining one
// (workflow 1 §Invited, workflow 7 §By link). Group `share`; the coordinator
// folds what is generally useful into journeys.js.
//
// Everything is the Share sheet, the people and New invitation screens, the
// invited screen and the Add-a-book sheet:
// no API writes, no dev mounts. The only reads that go below the UI are the
// book's id (GET /api/books), which the SQL capacity fill and the take-down
// need, and which the app itself never prints.

import { expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { gotoTab, saveThroughSheet, signedInDevice, makeLocalBook, putBookOnline, startApp, sessionCookie, makeAccount } from './journeys.js';
import { GitDevice } from './git-device.js';
import { baseUrl } from './env.js';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const row = (title) => new RegExp(`^${escape(title)}`);

// A song for a book, written for these tests (no-song-text rule).
export function songLines(title, chords = 'C | G | Am | F') {
  return [`# ${title}`, '- language: en', '', '## Parte', '```', chords, '```', ''];
}

// Search (no query) → "New song in {book}" → replace the template with `lines`
// → the save sheet. The first save on a device asks for the author's name.
export async function writeSongInBook(page, bookTitle, lines, { name = 'Marina Souza' } = {}) {
  await gotoTab(page, 'Search');
  // A book with no song yet has no section to write into, so go in through the
  // Create row for a title that matches nothing.
  await page.getByRole('searchbox').fill('Nova cifra');
  await page.getByRole('button', { name: /Create .Nova cifra./ }).click();
  // The editor opens on My songs; the which-book control moves it to the book.
  await page.getByRole('button', { name: 'Change book' }).click();
  await page.getByRole('menuitem', { name: bookTitle }).click();
  await expect(page.getByText(new RegExp(`In ${escape(bookTitle)}`))).toBeVisible();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(lines.join('\n'));
  await saveThroughSheet(page, { name });
}

// A signed-in device owning a book that is online and carries one song (written
// through the editor before the book goes online, so putting it online pushes
// it and an invitation's clone has something to read). Returns the authenticator.
export async function hostedBookWithSong(page, bookTitle, songTitle, { chords } = {}) {
  const authenticator = await signedInDevice(page);
  await makeLocalBook(page, bookTitle);
  await writeSongInBook(page, bookTitle, songLines(songTitle, chords));
  await putBookOnline(page, bookTitle);
  await startApp(page);
  return authenticator;
}

// ---- the owner's name on the service (books.owner_name) ---------------------

// The home book's README and .gitattributes, byte for byte (home-book-format
// §2.2), for a home book the service has not been given yet.
const HOME_README =
  '# Home book\n' +
  '\n' +
  "This repository holds one person's Estante de Cifras settings. Its files are\n" +
  'JSON that merge key by key, the later change winning; it is written and merged\n' +
  'by the app, not edited by hand. The format is docs/home-book-format.md in the\n' +
  'estante-de-cifras repository.\n';
const HOME_GITATTRIBUTES = '* text=auto eol=lf\n*.json merge=binary\n';

// home-book-format §6: sorted members at every depth, two-space pretty print,
// one trailing LF. Enough for the plain strings and registers written here.
function canonicalJson(value) {
  const sort = (v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])]))
      : v;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

// Give the signed-in account's home book on the service an `authorName`
// register (home-book-format §4.1), with the git CLI through the hook as a
// device would push it. A fixture for the joiner's side of books.owner_name:
// the web app does not yet bring its home book online on its own, so the
// service would have no name to tell the book's members. Keeps whatever the
// home book already holds; retries once if a device's push lands in between.
export async function ownerNameOnService(page, name) {
  const resp = await page.request.get('/api/account/home-book');
  expect(resp.ok()).toBeTruthy();
  const home = await resp.json();
  const url = new URL(home.gitUrl, `${baseUrl}/`).toString();
  const device = new GitDevice({ url, cookie: await sessionCookie(page), name, email: 'owner@users.estantedecifras.app' });
  try {
    for (let attempt = 0; ; attempt++) {
      await device.clone();
      if (!existsSync(join(device.dir, 'README.md'))) device.write('README.md', HOME_README);
      if (!existsSync(join(device.dir, '.gitattributes'))) device.write('.gitattributes', HOME_GITATTRIBUTES);
      const prefs = existsSync(join(device.dir, 'preferences.json')) ? JSON.parse(device.read('preferences.json')) : {};
      prefs.authorName = { at: new Date().toISOString(), value: name };
      device.write('preferences.json', canonicalJson(prefs));
      await device.commit('Set the author name');
      try {
        await device.push();
        return;
      } catch (err) {
        if (attempt > 0) throw err;
      }
    }
  } finally {
    device.cleanup();
  }
}

// Read-only: a hosted book's id, for the two seams that act below the UI (the
// SQL capacity fill, the operator take-down).
export async function bookIdOf(page, title) {
  const resp = await page.request.get('/api/books');
  expect(resp.ok()).toBeTruthy();
  const { books } = await resp.json();
  const book = books.find((b) => b.title === title);
  if (!book) throw new Error(`book ${title} not found for the account`);
  return book.id;
}

// ---- the sharing surfaces (books.share_people) ------------------------------

// The Books list, from wherever the person is: with a book's detail open, or a
// song or the editor in front, the list is not showing, so start again from the
// shell.
export async function booksList(page) {
  const tab = page.getByRole('tab', { name: 'Books' });
  const heading = page.getByRole('heading', { level: 1, name: 'Books' });
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    if (await heading.isVisible({ timeout: 1500 }).catch(() => false)) return;
  }
  await startApp(page);
  await gotoTab(page, 'Books');
}

// The people screen of a book (books.share_people; W10 #3, #6): a full screen,
// "{book} · People" for its owner, "{book} · Sharing" for a member.
export function peopleScreen(page, bookTitle) {
  return page.getByRole('region', { name: new RegExp(`^${escape(bookTitle)} · (People|Sharing)$`) });
}

// Books → the book → Manage → Share: the Share sheet on a phone, the people
// screen on a tablet or a computer (workflow 10 **Where it sits**).
async function pressShare(page, bookTitle) {
  await booksList(page);
  await page.getByRole('button', { name: row(bookTitle) }).click();
  await page.getByRole('button', { name: `Manage ${bookTitle}` }).first().click();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
}

// The phone's Share sheet for a book (W10 #1). Returns the sheet.
export async function openShareSheet(page, bookTitle) {
  await pressShare(page, bookTitle);
  const sheet = page.getByRole('dialog', { name: `Share ${bookTitle}` });
  await expect(sheet).toBeVisible();
  return sheet;
}

// Books → the book → Share → the people screen: directly on a tablet or a
// computer, through the sheet's Members row on a phone. Returns the screen.
export async function openSharing(page, bookTitle) {
  await pressShare(page, bookTitle);
  const sheet = page.getByRole('dialog', { name: `Share ${bookTitle}` });
  const people = peopleScreen(page, bookTitle);
  await expect(sheet.or(people)).toBeVisible();
  if (await sheet.isVisible()) await sheet.getByRole('button', { name: /^Members/ }).click();
  await expect(people).toBeVisible();
  return people;
}

// Back from the people screen to the book.
export async function closeSharing(page) {
  const people = page.getByRole('region', { name: / · (People|Sharing)$/ });
  await people.getByRole('button', { name: 'Back' }).click();
  await expect(people).toBeHidden();
}

// The new invitation: a screen of its own on a phone, a dialog on a tablet or
// a computer.
function newInvitationForm(page) {
  return page
    .getByRole('dialog', { name: 'New invitation' })
    .or(page.getByRole('region', { name: 'New invitation' }));
}

// From the people screen (or the phone's sheet): New invitation → role / expiry
// / use limit → Create link. Returns the invitation URL and leaves the made
// link showing; `finishInvite` clicks Done.
export async function createInvitationIn(scope, { role = 'Reader', expiry, limit } = {}) {
  const page = scope.page();
  await scope.getByRole('button', { name: /^(New invitation|Invite people)$/ }).click();
  const form = newInvitationForm(page);
  await expect(form).toBeVisible();
  await form.getByRole('radio', { name: role }).click();
  if (expiry) await form.getByRole('radio', { name: expiry }).click();
  if (limit) {
    // The visible label toggles it (the switch input itself sits under its track).
    await form.getByText('Limit how many can use it', { exact: true }).click();
    await form.getByRole('textbox', { name: 'Number of uses' }).fill(String(limit));
  }
  await form.getByRole('button', { name: 'Create link' }).click();
  const link = await form.getByRole('textbox', { name: 'Invitation link' }).inputValue();
  expect(link).toContain('/i/');
  return link;
}

// Done on the made link: back to where the invitation was made from.
export async function finishInvite(scope) {
  await scope.page().getByRole('button', { name: 'Done' }).click();
}

// Books → book → Share → people → New invitation → Done → Back. Returns the URL.
//   role: 'Reader' | 'Editor'; expiry: 'A day' | 'A week' | 'A month' |
//   'Until withdrawn'; limit: a number of uses.
export async function inviteThroughShare(page, bookTitle, opts = {}) {
  const people = await openSharing(page, bookTitle);
  const link = await createInvitationIn(people, opts);
  await finishInvite(people);
  await expect(people).toBeVisible();
  await closeSharing(page);
  return link;
}

// The invitee's side: open the link and, when signed out, make an account with
// a passkey (the page's context needs a virtual authenticator). Resolves once
// the sign-in finished; the caller asserts where the app lands.
export async function acceptInvitation(page, url, { signedIn = false } = {}) {
  await page.goto(url);
  if (signedIn) return;
  await expect(page.getByRole('heading', { name: /invited to a book on Estante/i })).toBeVisible();
  // The invitation's sections are the sign-in surface's: Make an account in
  // place, then *Not now* on the recovery step it is followed by.
  await makeAccount(page);
}

// On the people screen: Remove on the first member row → the confirm, as W10
// #3 draws it (no typed name) → *Remove {name}*, or *Remove* for someone with
// no name. Returns the member's shown name.
export async function removeFirstMember(page, people) {
  const memberRow = people
    .locator('.est-sharing-member', { has: page.getByRole('button', { name: 'Remove' }) })
    .first();
  const label = (await memberRow.locator('.name').first().textContent())?.trim();
  expect(label, 'the member row shows a name').toBeTruthy();
  await memberRow.getByRole('button', { name: 'Remove' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toBeVisible();
  const unnamed = /^Unnamed (reader|editor)$/.test(label);
  await confirm.getByRole('button', { name: unnamed ? 'Remove' : `Remove ${label}`, exact: true }).click();
  await expect(confirm).toBeHidden();
  return label;
}

// Insert a uniquely-marked section before the song's first heading in the open
// editor and save it (a clean, canonicalisable change).
export async function addSectionAndSave(page, mark, { name } = {}) {
  const heading = page.locator('.cm-content .cm-line').filter({ hasText: /^## / }).first();
  await heading.click();
  await page.keyboard.press('Home');
  await page.keyboard.insertText(`## ${mark}\n\`\`\`\nC | G\n\`\`\`\n\n`);
  await saveThroughSheet(page, { name });
}

// On a setlist open in its read view: Share — the More menu on a phone, the app
// bar's Share on a tablet or a computer (books.setlist_invitation; workflow 12
// §Sharing one). Returns the setlist's share surface — the phone's sheet, the
// wide panel, named *Share {setlist}* — and the members' address.
export async function shareSetlist(page) {
  const screen = page.locator('.setlist-screen');
  const name = (await screen.getByRole('heading', { level: 2 }).first().textContent()).trim();
  const share = screen.locator('.appbar').getByRole('button', { name: 'Share', exact: true });
  if (await share.isVisible().catch(() => false)) {
    await share.click();
  } else {
    await screen.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Share', exact: true }).click();
  }
  const surface = page
    .getByRole('dialog', { name: `Share ${name}` })
    .or(page.getByRole('complementary', { name: `Share ${name}` }));
  await expect(surface).toBeVisible();
  const address = await surface.getByRole('textbox', { name: 'Setlist address' }).inputValue();
  return { surface, address };
}
