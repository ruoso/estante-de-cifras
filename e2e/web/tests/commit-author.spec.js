// e2e-web — authoring as the account (account.commit_author; workflow 6
// L16-19; DIRECTION §3.3). Against the compose stack, on the phone, tablet and
// computer projects, every step through the real UI: a fresh device, signed
// out, makes a local book and saves a song in it; then it signs in and puts the
// book online. The song's history reads *you*, axe-clean at WCAG 2.1 AA — and,
// what pins the re-author (the *you* row alone could pass on the name
// fallback), every address on the book's `main` as the service holds it is the
// account's no-reply address: the save made before sign-in was re-authored
// before it was pushed. The only reads below the UI are GETs and a git clone.
// Book and song names are written for the test (no-song-text rule).

import { test, expect } from '../lib/axe.js';
import {
  makeLocalBook,
  enableVirtualAuthenticator,
  signInWithPasskey,
  putBookOnline,
  startApp,
  openSongFromSearch,
  historyFromReading,
} from '../lib/journeys.js';
import { writeSongInBook, songLines } from '../lib/journeys-share.js';
import { pushedAuthorEmails } from '../lib/journeys-account.js';

const BOOK = 'Cadernos da Varanda';
const SONG_TITLE = 'Toada de Teste';

test('a song saved before sign-in shows as you in history after signing in and putting the book online; axe-clean', async ({
  page,
  checkA11y,
}) => {
  // Signed out: a local book, and a song saved in it (the name typed in the
  // sheet — the commit carries this device's local address).
  await startApp(page);
  await makeLocalBook(page, BOOK);
  await writeSongInBook(page, BOOK, songLines(SONG_TITLE), { name: 'Marina Souza' });

  // Sign in (a new account), then put the book online.
  await enableVirtualAuthenticator(page);
  await signInWithPasskey(page);
  await putBookOnline(page, BOOK);

  // The song's history: the save reads *you*.
  await startApp(page);
  await openSongFromSearch(page, 'Toada', SONG_TITLE);
  await historyFromReading(page);
  const rows = page.locator('.est-history-row');
  await expect(rows.first().getByText(/^you · /)).toBeVisible();
  await checkA11y(); // the history screen

  // What the service holds: every author and committer is the owner's no-reply
  // address — no local id went up.
  const list = await page.request.get('/api/books');
  expect(list.ok()).toBeTruthy();
  const book = (await list.json()).books.find((b) => b.title === BOOK);
  expect(book, `${BOOK} is on the account`).toBeTruthy();
  const members = await page.request.get(`/api/books/${book.id}/members`);
  expect(members.ok()).toBeTruthy();
  const owner = (await members.json()).members.find((m) => m.role === 'owner');
  expect(owner, 'the book has an owner').toBeTruthy();

  const emails = await pushedAuthorEmails(page, BOOK);
  expect(emails.length).toBeGreaterThan(0);
  for (const email of emails) {
    expect(email).toBe(`${owner.userId}@users.estantedecifras.app`);
  }
});
