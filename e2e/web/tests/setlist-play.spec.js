// setlist-play (e2e-web) — playing a setlist through, end to end on the three
// viewports (books.play, workflow 12 §Playing through, §The key, §Songs moved;
// board W12). Against the compose stack, with axe at WCAG 2.1 AA on the player.
//
// Three journeys:
//   1. Play the bundled example setlist through: open "A Short Set", Play, go
//      next and previous (by the arrow/page keys on the computer, by swipe and
//      edge-tap on the touch viewports, and by the on-screen edge buttons
//      everywhere), see the next-song title, see the setlist's key applied
//      (Walking to the Market, written in G, played in A), and a song made
//      missing (its file deleted in the file view) skipped — axe on the player
//      (workflow 12 L65-72, L52-54, L83-85).
//   2. The screen kept awake: entering the player shows the "screen kept awake"
//      status the UI offers when the browser's Wake Lock API holds the lock;
//      Stop leaves the player (workflow 12 L70).
//   3. Sync waits until the end (the hosted leg, reusing online.spec.js and the
//      read-in-place two-device git-CLI pattern): the device signs in, makes a
//      book and puts it online; a second device (host git CLI, same session
//      cookie) seeds a setlist and its song and later pushes a new version of
//      the song on screen; while playing, a sync lands the merge into the
//      working copy but the displayed chart does not change; after Stop,
//      re-opening the song shows the new version (workflow 12 L71; workflow 8
//      L53-54).
//
// The in-process defer/no-re-request logic is also pinned at the behavior level
// (SetlistPlay.behavior.test.jsx) and the pure glue at the unit level
// (setlist-play.test.js). All song/setlist text is the bundled example book's
// or written for this test (no-song-text rule).

import { mockup } from '../lib/mockup.js';
import { test, expect } from '../lib/axe.js';
import {
  openExampleBook,
  hostedBook,
  waitUntilSearchable,
  networkBlip,
} from '../lib/journeys.js';
import { GitDevice } from '../lib/git-device.js';
import {
  EXAMPLE_BOOK,
  openSetlist,
  enterPlayer,
  deleteSongInFiles,
  leaveFiles,
} from '../lib/journeys-files.js';

// Swipe across the sheet: a clear horizontal drag turns the page (dx < 0 is a
// swipe left → next). A mouse drag emits the pointer events the surface reads.
async function swipe(page, dx) {
  const box = await page.locator('.play-sheet').boundingBox();
  const y = box.y + box.height / 2;
  const startX = box.x + box.width / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + dx, y, { steps: 8 });
  await page.mouse.up();
}

// An almost-still tap near a left/right edge of the sheet, away from the
// vertically-centred edge buttons (so it is the sheet's edge-tap, not a button).
async function edgeTap(page, side) {
  const box = await page.locator('.play-sheet').boundingBox();
  const y = box.y + 40;
  const x = side === 'left' ? box.x + box.width * 0.12 : box.x + box.width * 0.88;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
}

test('plays a setlist through, in the setlist key, skipping a missing song', async ({
  page,
  checkA11y,
}, testInfo) => {
  const computer = testInfo.project.name === 'computer';
  await openExampleBook(page);

  // Delete a song the bundled setlist points at, in the file view (Books →
  // Files): an unsaved working-copy removal, so the item goes missing and is
  // skipped when playing.
  await deleteSongInFiles(page, EXAMPLE_BOOK, 'the-ferry-line.cifra.md');
  await leaveFiles(page);

  await openSetlist(page, 'A Short Set');
  await mockup(page, 'W12-setlists', 1); // the setlist opened (phone)
  await enterPlayer(page);

  // Opens on the first linked song. The Next card points PAST the missing Ferry
  // Line (item 2) straight to Walking to the Market (item 3).
  await expect(page.getByRole('group', { name: 'Morning on the Porch' })).toBeVisible();
  await expect(page.getByText('3. Walking to the Market')).toBeVisible();
  await expect(page.getByText(/screen kept awake/)).toBeVisible();
  await checkA11y(); // the player, first song
  await mockup(page, 'W12-setlists', 2); // playing through it (phone)

  // Next and previous by the on-screen edge buttons (the keyboard/AT path).
  await page.getByRole('button', { name: 'Next song' }).click();
  await expect(page.getByRole('group', { name: 'Walking to the Market' })).toBeVisible();
  // Walking to the Market is written in G and played in A — transposed, named.
  await expect(page.getByText('In A')).toBeVisible();
  await expect(page.getByText('Setlist key A · written in G')).toBeVisible();
  // The Ferry Line never shows — it was skipped.
  await expect(page.getByText(/Ferry Line/)).toHaveCount(0);
  await checkA11y(); // the transposed song
  await page.getByRole('button', { name: 'Previous song' }).click();
  await expect(page.getByRole('group', { name: 'Morning on the Porch' })).toBeVisible();

  // And by the mechanism natural to the viewport: the arrow/page keys a pedal
  // sends (computer), or swipe and edge-tap (touch).
  if (computer) {
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('group', { name: 'Walking to the Market' })).toBeVisible();
    await page.keyboard.press('PageUp');
    await expect(page.getByRole('group', { name: 'Morning on the Porch' })).toBeVisible();
  } else {
    await swipe(page, -140); // swipe left → next
    await expect(page.getByRole('group', { name: 'Walking to the Market' })).toBeVisible();
    await edgeTap(page, 'left'); // tap the left edge → previous
    await expect(page.getByRole('group', { name: 'Morning on the Porch' })).toBeVisible();
  }

  // Stop returns to the setlist.
  await page.getByRole('button', { name: 'Stop playing' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'A Short Set' })).toBeVisible();
});

test('shows the screen is kept awake while playing, and leaves the player on Stop', async ({
  page,
  context,
}) => {
  // The Wake Lock API needs the browser's screen-wake-lock permission; it is
  // granted to the context the way a person's browser grants it.
  await context.grantPermissions(['screen-wake-lock']).catch(() => {});
  await openExampleBook(page);
  await openSetlist(page, 'A Short Set');
  await enterPlayer(page);

  // The status word is shown only when the browser supports the Wake Lock API
  // (books/wake-lock.js), i.e. the app asked for the screen lock.
  await expect(page.getByText(/screen kept awake/)).toBeVisible();

  await page.getByRole('button', { name: 'Stop playing' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'A Short Set' })).toBeVisible();
  await expect(page.getByText(/screen kept awake/)).toHaveCount(0);
});

// ---- hosted sync-waiting leg: the device signs in and hosts a book; a second
// device (the git CLI, same session cookie) seeds and later changes it. ----

const BOOK = 'Caderno da Enseada';
const SETLIST_NAME = 'Caderno Set';
const SETLIST_FILE = 'caderno.setlist.md';
const SONG_TITLE = 'Lantern on the Pier';
const SONG_FILE = 'lantern-on-the-pier.cifra.md';
const SONG_V1 = [
  `# ${SONG_TITLE}`,
  '- language: en',
  '',
  '## Intro',
  '```',
  'C | G | Am | F',
  '```',
  '',
  '## Verse 1',
  '```',
  'the harbour wakes at dawn',
  '```',
];
// The second device appends this; "lighthouse" is the token the new version
// carries. No trailing blank line (the pre-receive hook refuses it).
const BRIDGE = ['', '## Bridge', '```', 'a lighthouse sweeps the bay', '```'];
const SETLIST_V1 = [`# ${SETLIST_NAME}`, '', `1. [${SONG_TITLE}](${SONG_FILE})`];

test('sync waits until playing stops: the open chart does not move mid-performance', async ({
  page,
}) => {
  const { url, cookie } = await hostedBook(page, BOOK);
  const second = new GitDevice({ url, cookie });
  try {
    await second.pushFiles(
      { [SONG_FILE]: `${SONG_V1.join('\n')}\n`, [SETLIST_FILE]: `${SETLIST_V1.join('\n')}\n` },
      'Seed a setlist and its song',
    );
    await waitUntilSearchable(page, 'Lantern', SONG_TITLE);
    await page.getByRole('searchbox').fill('');

    // Play the setlist. The song on screen is its first (and only) item.
    await openSetlist(page, SETLIST_NAME);
    await enterPlayer(page);
    const sheet = page.locator('.play-sheet');
    await expect(sheet).toContainText('harbour');
    await expect(sheet).not.toContainText('lighthouse');

    // The second device publishes a new version of the song on screen.
    await second.clone();
    second.write(SONG_FILE, second.read(SONG_FILE) + BRIDGE.join('\n') + '\n');
    await second.commit('Add a bridge');
    await second.push();

    // A sync lands the merge into the working copy, but the displayed chart must
    // not move: the middle of a performance is the worst moment for a song to
    // move (workflow 8 L53-54; workflow 12 L71). Give the round-trip a window,
    // then assert the player did not swap.
    await networkBlip(page);
    await page.waitForTimeout(2500);
    await expect(sheet).toContainText('harbour');
    await expect(sheet).not.toContainText('lighthouse');

    // Stop, then re-open the song: the next load shows the merged version.
    await page.getByRole('button', { name: 'Stop playing' }).click();
    await expect(page.getByRole('heading', { level: 2, name: SETLIST_NAME })).toBeVisible();
    await enterPlayer(page);
    await expect(page.locator('.play-sheet')).toContainText('lighthouse');

    await page.getByRole('button', { name: 'Stop playing' }).click();
  } finally {
    second.cleanup();
  }
});
