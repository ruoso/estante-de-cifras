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
//   2. The screen kept awake: an init script stubs navigator.wakeLock to record
//      request('screen'); entering the player calls it, Stop releases it
//      (workflow 12 L70).
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

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test, expect } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';
import { baseUrl } from '../lib/env.js';

const execFileAsync = promisify(execFile);

const EXAMPLE_BOOK_ID = 'local-example-book';

// ---- example-book journey helpers (the setlists/reading e2e pattern) ----

async function seedExample(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  const openExample = page.getByRole('button', { name: /Open the example book/ });
  const books = page.getByRole('heading', { name: 'Books' });
  await expect(async () => {
    if (await openExample.isVisible().catch(() => false)) {
      await openExample.click({ timeout: 2000 }).catch(() => {});
    }
    await expect(books).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await page.getByRole('searchbox').fill('Walking');
  await expect(page.getByRole('button', { name: /Walking to the Market/ }).first()).toBeVisible();
  await page.getByRole('searchbox').fill('');
}

async function openSetlist(page, name) {
  await page.getByRole('tab', { name: 'Setlists' }).click();
  const row = page.getByRole('button', { name: new RegExp(name) });
  await expect(row.first()).toBeVisible();
  await row.first().click();
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
}

async function enterPlayer(page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop playing' })).toBeVisible();
}

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
  await seedExample(page);

  // Delete a song the bundled setlist points at, in the file view: an unsaved
  // working-copy removal, so the item goes missing and is skipped when playing.
  await page.goto(`/#dev/files?book=${EXAMPLE_BOOK_ID}`);
  const ferryRow = page.getByRole('button', { name: /^the-ferry-line\.cifra\.md/ });
  await expect(ferryRow.first()).toBeVisible();
  await ferryRow.first().click();
  await page.getByRole('button', { name: 'Delete the-ferry-line.cifra.md' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('1 file changed')).toBeVisible();

  await page.goto('/');
  await openSetlist(page, 'A Short Set');
  await enterPlayer(page);

  // Opens on the first linked song. The Next card points PAST the missing Ferry
  // Line (item 2) straight to Walking to the Market (item 3).
  await expect(page.getByRole('group', { name: 'Morning on the Porch' })).toBeVisible();
  await expect(page.getByText('3. Walking to the Market')).toBeVisible();
  await expect(page.getByText(/screen kept awake/)).toBeVisible();
  await checkA11y(); // the player, first song

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

test('keeps the screen awake while playing, and releases it on Stop', async ({ page }) => {
  // Record the Wake Lock requests before any app script runs.
  await page.addInitScript(() => {
    window.__wakeLockRequests = [];
    window.__wakeLockReleases = 0;
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async (type) => {
          window.__wakeLockRequests.push(type);
          return {
            released: false,
            release: async () => { window.__wakeLockReleases += 1; },
            addEventListener: () => {},
            removeEventListener: () => {},
          };
        },
      },
    });
  });

  await seedExample(page);
  await openSetlist(page, 'A Short Set');
  await enterPlayer(page);

  // Entering the player asks for a screen wake lock.
  await expect.poll(() => page.evaluate(() => window.__wakeLockRequests)).toContain('screen');

  await page.getByRole('button', { name: 'Stop playing' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'A Short Set' })).toBeVisible();
  // Stopping releases it.
  await expect.poll(() => page.evaluate(() => window.__wakeLockReleases)).toBeGreaterThan(0);
});

// ---- hosted sync-waiting leg: device + second-device (Node git) helpers,
// copied from read-in-place.spec.js / online.spec.js (inline, per the harness
// convention). ----

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

async function signIn(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect.poll(() => hasSessionCookie(page)).toBe(true);
}

async function makeLocalBook(page, name) {
  await page.getByRole('tab', { name: 'Books' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a book' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('textbox', { name: 'Book name' }).fill(name);
  await sheet.getByRole('button', { name: 'New book' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
}

async function putBookOnline(page, name) {
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.getByRole('button', { name: 'Put online' }).click();
  await expect(page.getByText('On Estante · private')).toBeVisible();
}

async function sessionCookie(page) {
  const cookies = await page.context().cookies();
  const c = cookies.find((x) => x.name === 'estante_session');
  if (!c) throw new Error('no estante_session cookie on the device context');
  return `estante_session=${c.value}`;
}

async function bookGitUrl(page, title) {
  const resp = await page.request.get('/api/books');
  expect(resp.ok()).toBeTruthy();
  const { books } = await resp.json();
  const book = books.find((b) => b.title === title);
  if (!book) throw new Error(`book ${title} not found for the account`);
  return new URL(book.gitUrl, `${baseUrl}/`).toString();
}

async function hostedEmptyBook(page) {
  await enableVirtualAuthenticator(page);
  await signIn(page);
  await makeLocalBook(page, BOOK);
  await putBookOnline(page, BOOK);
  await page.goto('/');
  await waitForServiceWorker(page);
  const cookie = await sessionCookie(page);
  const url = await bookGitUrl(page, BOOK);
  return { url, cookie };
}

const tmpDirs = [];
function makeDir() {
  const dir = mkdtempSync(join(tmpdir(), 'estante-e2e-setlist-play-'));
  tmpDirs.push(dir);
  return dir;
}
test.afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function runGit(cwd, args) {
  return execFileAsync('git', args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' },
  });
}
function cookieArgs(cookie) {
  return ['-c', `http.extraHeader=Cookie: ${cookie}`];
}
async function configIdentity(dir, name, email) {
  await runGit(dir, ['config', 'user.name', name]);
  await runGit(dir, ['config', 'user.email', email]);
  await runGit(dir, ['config', 'commit.gpgsign', 'false']);
}

async function secondDeviceSeedsSetlist(url, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', url, dir]);
  await configIdentity(dir, 'Marina Souza', 'marina@users.estantedecifras.app');
  writeFileSync(join(dir, SONG_FILE), `${SONG_V1.join('\n')}\n`);
  writeFileSync(join(dir, SETLIST_FILE), `${SETLIST_V1.join('\n')}\n`);
  await runGit(dir, ['add', SONG_FILE, SETLIST_FILE]);
  await runGit(dir, ['commit', '-m', 'Seed a setlist and its song']);
  await runGit(dir, [...cookieArgs(cookie), 'push', url, 'HEAD:refs/heads/main']);
}

async function secondDevicePushesNewVersion(url, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', url, dir]);
  await configIdentity(dir, 'Ana Luiza', 'ana@users.estantedecifras.app');
  const current = readFileSync(join(dir, SONG_FILE), 'utf8');
  writeFileSync(join(dir, SONG_FILE), current + BRIDGE.join('\n') + '\n');
  await runGit(dir, ['add', SONG_FILE]);
  await runGit(dir, ['commit', '-m', 'Add a bridge']);
  await runGit(dir, [...cookieArgs(cookie), 'push', url, 'HEAD:refs/heads/main']);
}

// Reload until the synced-in setlist is listed. The open-time sweep indexes a
// synced-in book on load (the song-searchable pattern), so the setlist file is
// in the working copy and the Setlists tab lists it after a pass.
async function syncUntilSetlist(page) {
  await expect(async () => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await page.waitForTimeout(1500);
    await page.getByRole('searchbox').fill('Lantern');
    await expect(
      page.getByRole('button', { name: new RegExp(SONG_TITLE) }).first(),
    ).toBeVisible({ timeout: 2500 });
  }).toPass({ timeout: 60000 });
  await page.getByRole('searchbox').fill('');
}

async function triggerSync(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
}

test('sync waits until playing stops: the open chart does not move mid-performance', async ({
  page,
}) => {
  const { url, cookie } = await hostedEmptyBook(page);
  await secondDeviceSeedsSetlist(url, cookie);
  await syncUntilSetlist(page);

  // Play the setlist. The song on screen is its first (and only) item.
  await openSetlist(page, SETLIST_NAME);
  await enterPlayer(page);
  const sheet = page.locator('.play-sheet');
  await expect(sheet).toContainText('harbour');
  await expect(sheet).not.toContainText('lighthouse');

  // The second device publishes a new version of the song on screen.
  await secondDevicePushesNewVersion(url, cookie);

  // A sync lands the merge into the working copy, but the displayed chart must
  // not move: the middle of a performance is the worst moment for a song to
  // move (workflow 8 L53-54; workflow 12 L71). Give the round-trip a window,
  // then assert the player did not swap.
  await triggerSync(page);
  await page.waitForTimeout(2500);
  await expect(sheet).toContainText('harbour');
  await expect(sheet).not.toContainText('lighthouse');

  // Stop, then re-open the song: the next load shows the merged version.
  await page.getByRole('button', { name: 'Stop playing' }).click();
  await expect(page.getByRole('heading', { level: 2, name: SETLIST_NAME })).toBeVisible();
  await enterPlayer(page);
  await expect(page.locator('.play-sheet')).toContainText('lighthouse');

  await page.getByRole('button', { name: 'Stop playing' }).click();
});
