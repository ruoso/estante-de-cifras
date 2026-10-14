// notice-surface (e2e-web) — a book the service took down for a copyright notice
// shows the operator's reason on its detail, against the compose stack, on the
// phone/tablet/computer projects, with axe at WCAG 2.1 AA (books.notice_surface;
// workflow 10 §A copyright notice; DIRECTION §3.6).
//
// A signed-in device writes a song in its own book through the editor and puts
// the book online, all through the UI. The book is then taken down through the
// db seam: that is the effect `estante-admin take-down` commits -- an operator
// command with no endpoint by design, so there is no UI path (mirrors
// e2e/api/admin.test.js:119-125). The device syncs: the service's change-check
// still answers `gone`, so the sync engine probes git, meets the `403
// taken_down` refusal and recovers the reason. The book's detail then shows that
// reason in the take-down notice beside Download, distinct from the lost-access
// notice. The shelf reads *no longer shared with you* like any gone book
// (workflow 10 L113).
//
// Book name, song and take-down reason are written for this test -- never
// anyone's copyrighted words or a real notice (no-song-text rule).

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';
import { syncNow } from '../lib/journeys.js';
import { hostedBookWithSong, bookIdOf } from '../lib/journeys-share.js';
import { takeDownBook } from '../lib/db.js';

const BOOK = 'Choros da Ana';
const SONG_TITLE = 'Roda de rua';

// The operator's free-text reason, as the service frames it and returns it on the
// git refusal (service/internal/server/git.go:232). Written for this test.
const TAKEN_DOWN_REASON =
  'This book has been taken down: a copyright notice was filed by the rights holder.';

test('a taken-down book shows the operator reason on its detail, beside Download; the shelf reads gone', async ({
  page,
}) => {
  test.setTimeout(10000);

  // A signed-in device with a hosted book carrying one song, made through the UI.
  await hostedBookWithSong(page, BOOK, SONG_TITLE);
  const bookId = await bookIdOf(page, BOOK);

  // The operator takes the book down for a copyright notice (the db seam -- the
  // effect no endpoint provides).
  await takeDownBook(bookId, TAKEN_DOWN_REASON);

  // The device syncs and learns the book is unreachable: the shelf reads
  // *no longer shared with you*, like any gone book (workflow 10 L113).
  await syncNow(page);
  await expect(page.getByText('no longer shared with you')).toBeVisible({ timeout: 10000 });
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the shelf with the gone badge

  // The book detail carries the take-down notice with the operator's reason,
  // beside Download -- distinct from the lost-access notice (acceptance 5).
  await page.getByRole('button', { name: new RegExp(`^${BOOK}`) }).click();
  await expect(page.getByText('This book has been taken down', { exact: true })).toBeVisible();
  await expect(page.getByText(TAKEN_DOWN_REASON)).toBeVisible();
  // Not the lost-access card, and no fork offer (Decision 3).
  await expect(
    page.getByText(/no longer shared with you, so it will not sync again/),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Make this book your own' })).toHaveCount(0);
  // Download stays available -- the book is still readable and exportable.
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the taken-down book detail
});
