// read-in-place (e2e-web) — a song open while sync changes it (sync.read_in_place,
// workflow 8 §"A song open while it changes"; W08). Against the compose stack on
// the phone/tablet/computer projects, with axe at WCAG 2.1 AA on each surface.
//
// The hosted journey, driven through the real UI from `/`:
//   1. the device signs in (passkey), makes a local book and puts it online
//      (journeys.hostedBook);
//   2. a SECOND DEVICE (the host `git` CLI carrying the device's own session
//      cookie over smart HTTP — lib/git-device.js) seeds one song; the app syncs
//      it down and indexes it (journeys-sync.hostedBookWithSongs);
//   3. the reader finds the song by search, the second device pushes a new
//      version of it, and a sync — the network drops and comes back
//      (journeys.networkBlip, the real `online` event) — fetches and cleanly
//      fast-forwards the open song: the engine emits MERGED and the open reading
//      view reacts.
//
// Test 1: the chart updates in place, the reader's place on the page is kept
// (asserted on the phone, where the sheet scrolls), the *Updated by {name}: see
// what changed* notice appears and opens the song's history in-app.
// Test 2: in full screen the update waits — the chart does not move and no
// notice shows — and applies only when the reader leaves full screen.
// Test 3: the reading toolbar's History button shares the same seam.
// Book and song names are written for this test (no-song-text rule).

import { test, expect } from '../lib/axe.js';
import { GitDevice } from '../lib/git-device.js';
import { mockup } from '../lib/mockup.js';
import { openExampleBook, openSongFromSearch, networkBlip } from '../lib/journeys.js';
import {
  hostedBookWithSongs,
  historyFromReadingAnyViewport,
  enterFullScreen,
} from '../lib/journeys-sync.js';

const BOOK = 'Caderno da Enseada';
const SONG_TITLE = 'Lantern on the Pier';
const SONG_FILE = 'lantern-on-the-pier.cifra.md';
// A full, renderable song: an intro with chords, then lyric-only verses (each a
// single `.words` line in the chart — a stable boundingBox anchor). Tall enough
// that the reading sheet scrolls on the phone viewport. The second device later
// appends a bridge carrying "lighthouse".
const ANCHOR_LINE = 'here the river bends toward home';
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
  '',
  '## Verse 2',
  '```',
  'and gulls begin to call',
  '```',
  '',
  '## Verse 3',
  '```',
  ANCHOR_LINE,
  '```',
  '',
  '## Verse 4',
  '```',
  'the fishing boats return',
  '```',
  '',
  '## Verse 5',
  '```',
  'with lanterns lit for night',
  '```',
  '',
  '## Verse 6',
  '```',
  'and quiet fills the bay',
  '```',
  '',
  '## Verse 7',
  '```',
  'the tide is slow and wide',
  '```',
  '',
  '## Verse 8',
  '```',
  'a lantern on the pier',
  '```',
];
// Leading '' makes the one canonical blank line before the heading; no trailing
// '' (a trailing blank line is non-canonical, which the pre-receive hook refuses).
const BRIDGE = ['', '## Bridge', '```', 'a lighthouse sweeps the bay', '```'];
const INCOMING_AUTHOR = 'Ana Luiza';

// Sign in, host the book, seed the song from the second device, wait until the
// app has it. Returns the hosted book's url/cookie for the later push.
async function hostedWithSong(page) {
  const hosted = await hostedBookWithSongs(
    page,
    BOOK,
    { [SONG_FILE]: `${SONG_V1.join('\n')}\n` },
    { query: 'Lantern', title: SONG_TITLE },
  );
  return hosted;
}

// The second device appends the bridge and pushes it as INCOMING_AUTHOR — a
// clean fast-forward of the version the device has open.
async function secondDevicePushesNewVersion({ url, cookie }) {
  const ana = new GitDevice({ url, cookie, name: INCOMING_AUTHOR, email: 'ana@users.estantedecifras.app' });
  try {
    await ana.clone();
    ana.write(SONG_FILE, ana.read(SONG_FILE) + BRIDGE.join('\n') + '\n');
    await ana.commit('Add a bridge');
    await ana.push();
  } finally {
    ana.cleanup();
  }
}

test('a sync brings a new version of the open song in place, with the notice that opens history (acceptance 2-3, 5; workflow 8 L51-52, W08)', async ({
  page,
  checkA11y,
}, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  const hosted = await hostedWithSong(page);

  // The reader opens the song (its current version) — not in full screen.
  await openSongFromSearch(page, 'Lantern', SONG_TITLE);
  const sheet = page.locator('.reading-sheet');
  await expect(sheet).toContainText('harbour');
  await expect(sheet).not.toContainText('lighthouse');

  await secondDevicePushesNewVersion(hosted);

  // On the phone the sheet scrolls; capture where the reader is looking so we can
  // prove the place is kept across the swap.
  const anchor = page.getByText(ANCHOR_LINE, { exact: true });
  let anchorBefore = null;
  if (narrow) {
    await anchor.scrollIntoViewIfNeeded();
    await expect(anchor).toBeVisible();
    anchorBefore = await anchor.boundingBox();
  }

  // A sync pass (the network comes back) fetches and cleanly fast-forwards the
  // open song: MERGED names it, the view re-reads it in place, the notice shows.
  await networkBlip(page);
  const notice = page.locator('.reading-update-notice');
  await expect(notice).toBeVisible({ timeout: 10000 });
  await expect(notice).toHaveAttribute('role', 'status');
  await expect(notice).toContainText(`Updated by ${INCOMING_AUTHOR}`);
  await expect(sheet).toContainText('lighthouse');

  if (narrow) {
    // Keeping the place: the line the reader was looking at stays put, even
    // though the notice appeared above the chart.
    const anchorAfter = await anchor.boundingBox();
    expect(Math.abs(anchorAfter.y - anchorBefore.y)).toBeLessThan(40);
  }

  await mockup(page, 'W08-sync', 2);
  await checkA11y(); // the in-place notice state, this viewport

  await notice.getByRole('button', { name: 'See what changed' }).click();
  await expect(page.locator('.est-history-row').first()).toBeVisible();
  await checkA11y(); // the history surface reached from the notice
  await page.getByRole('button', { name: 'Back to the song' }).click();
  await expect(sheet).toBeVisible();
});

test('full screen holds the update back until the reader leaves it (acceptance 4; workflow 8 L53-54, W08 L120/L155/L159)', async ({
  page,
  checkA11y,
}, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  const hosted = await hostedWithSong(page);

  await openSongFromSearch(page, 'Lantern', SONG_TITLE);
  await enterFullScreen(page, narrow);
  const sheet = page.locator('.reading-sheet');
  await expect(sheet).toContainText('harbour');

  await secondDevicePushesNewVersion(hosted);

  // A sync lands it while full screen. The merge is durable in the Worker, but
  // the view must not move: give the real round-trip a bounded window, then
  // assert the full-screen view did not swap and shows no notice.
  await networkBlip(page);
  await page.waitForTimeout(2500);
  await expect(sheet).toContainText('harbour');
  await expect(sheet).not.toContainText('lighthouse');
  await expect(page.locator('.reading-update-notice')).toHaveCount(0);
  await mockup(page, 'W08-sync', 4);
  await checkA11y(); // the full-screen waiting state, this viewport

  // Leaving full screen applies the deferred update.
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  const notice = page.locator('.reading-update-notice');
  await expect(notice).toBeVisible({ timeout: 10000 });
  await expect(notice).toContainText(`Updated by ${INCOMING_AUTHOR}`);
  await expect(sheet).toContainText('lighthouse');
  await mockup(page, 'W08-sync', 5);
  await checkA11y(); // the applied-on-exit notice state, this viewport
});

test('the reading toolbar opens the song’s history in-app and returns (acceptance 5; the notice shares this seam)', async ({
  page,
  checkA11y,
}, testInfo) => {
  const narrow = testInfo.project.name === 'phone';

  // No hosted book needed — the bundled example book reaches the reading view,
  // and the History toolbar control shares the onOpenHistory seam the merge
  // notice uses.
  await openExampleBook(page);
  await openSongFromSearch(page, 'Morning', 'Morning on the Porch');
  await expect(page.locator('.reading-sheet')).toBeVisible();

  await historyFromReadingAnyViewport(page, narrow);

  // The bundled first version is a row.
  await expect(page.locator('.est-history-row').first()).toBeVisible();
  await checkA11y(); // the history surface reached in-app, this viewport

  await page.getByRole('button', { name: 'Back to the song' }).click();
  await expect(page.locator('.reading-sheet')).toBeVisible();
});
