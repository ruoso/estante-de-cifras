// sync-states (e2e-web) — the Books-header sync affordances (sync.states)
// against the compose stack, on the phone/tablet/computer projects with axe at
// WCAG 2.1 AA on the shelf (contrast included — the real browser gives axe the
// layout jsdom lacks). This file drives the REAL Worker end to end: the sync
// slice it reads, the `anyOutOfStep` header mark, the render-when-present badge
// slot, and the *Sync now* command path (CommandKind.SYNC { reason: 'sync-now' }
// through store.send → the scheduler). Pins workflow 8 L28, L36-38; acceptance 2
// (the quiet mark, negative), 3 (*Sync now*), 1 (in_step → nothing); DIRECTION
// §1 (offline-first: *Sync now* returns at once, never an error), §3.7. The book
// name is written for this test (no-song-text rule).
//
// SCOPE — what this e2e level can and cannot drive without a hosted book.
// The sync engine emits a per-book fact ONLY for a HOSTED book — one with a
// `remote.origin.url` (sync-engine.js listBooks: "A local-only book … is never
// synced"). A book made in-browser via *Add a book* is a local repository with
// no account and no remote (workflow 7 L25), so it never enters the sync slice:
// the shelf shows it with no badge, which is exactly the "shown only when not in
// step" rule (workflow 8 L28, mockup L48). There is no in-browser path to a
// hosted, syncing book today — the Worker has no clone/join command yet
// (logic.js:223 "no book cloned yet"; protocol.js:27 "Later tasks add clone"),
// and *Add a book by its link* / *put a book online* are unbuilt (books.add_by_link,
// books.online). So the POSITIVE out-of-step journey the note sketches — a
// hosted book goes offline and the shelf reads *offline since …* / *N saves
// waiting to go up* with the header mark, then the network returns and the states
// clear — cannot be reached black-box here: it needs a seam that seeds a hosted
// book + membership on the stack and clones it into the browser. That full
// journey is deferred to `sync.states_e2e_hosted` (which carries the
// `foundation.e2e_hosted_book` seam); the badge-state RENDERING itself is fully
// covered in-process at the behavior level (BooksScreen.behavior.test.jsx injects
// each phase through the real reducer slice). What this file pins at e2e is the
// half that needs no hosted book and that no lower level reaches: the real Worker
// *Sync now* round-trip, the in-step negatives, and real-browser axe/contrast on
// the shelf across the three viewports.

import { test, expect } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';

const NAME = 'Domingo de manhã';

// Open the Books destination with one local book on the shelf (a row to assert
// the in-step negative against). A new book is an empty local repository made on
// the device with no account (workflow 7 L25) — the same entirely-in-app path
// books.spec.js uses, so no song-seeding or hosted-book seam is needed.
async function booksWithOneLocalBook(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('tab', { name: 'Books' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();

  await page.getByRole('button', { name: 'Add a book' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('textbox', { name: 'Book name' }).fill(NAME);
  await sheet.getByRole('button', { name: 'New book' }).click();

  // The open row (not the "Rename …" button) appears on the shelf.
  await expect(page.getByRole('button', { name: new RegExp(`^${NAME}`) })).toBeVisible();
}

test('an in-step shelf shows no badge and no header quiet mark, and the shelf is axe-clean (workflow 8 L28, L36)', async ({
  page,
  checkA11y,
}) => {
  await booksWithOneLocalBook(page);

  // The local book is in step (never hosted → no sync fact): its row carries no
  // sync badge — the absence IS "in step with Estante" (workflow 8 L28, mockup
  // L48). Scope the query to this book's row so it pins that row, not the shelf.
  const row = page.locator('.book-row', { hasText: NAME });
  await expect(row).toBeVisible();
  await expect(row.locator('.badge')).toHaveCount(0);

  // The header's one quiet mark is absent when every shelf book is in step
  // (the home book is excluded regardless — workflow 8 L36-37, acceptance 2).
  await expect(
    page.getByRole('img', { name: 'Some books are not in step' }),
  ).toHaveCount(0);

  await checkA11y(); // the shelf in step, this viewport (real contrast)
});

test('Sync now is reachable by keyboard, fires a pass and returns at once (workflow 8 L37; DIRECTION §1)', async ({
  page,
}) => {
  await booksWithOneLocalBook(page);

  // *Sync now* is a React Aria Button in the Books header (acceptance 3). Reach
  // it by keyboard and activate it with Enter — the real store.send sends
  // CommandKind.SYNC { reason: 'sync-now' } to the Worker, whose scheduler
  // coalesces the pass. Nothing blocks on the network (DIRECTION §1).
  const syncNow = page.getByRole('button', { name: 'Sync now' });
  await syncNow.focus();
  await expect(syncNow).toBeFocused();
  await page.keyboard.press('Enter');

  // It returns immediately: the shelf stays, the button stays enabled, and a
  // local-only pass surfaces nothing — no header mark, no error (offline-first;
  // a failed/empty sync is a calm statement of fact, never a dialog).
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();
  await expect(syncNow).toBeEnabled();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(
    page.getByRole('img', { name: 'Some books are not in step' }),
  ).toHaveCount(0);
  // The book is still on the shelf with no badge after the pass.
  await expect(page.locator('.book-row', { hasText: NAME }).locator('.badge')).toHaveCount(0);
});
