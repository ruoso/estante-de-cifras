// read-in-place (e2e-web) — a song open while sync changes it (sync.read_in_place,
// workflow 8 §"A song open while it changes"; W08). Against the compose stack on
// the phone/tablet/computer projects, with axe at WCAG 2.1 AA on each surface.
//
// The hosted journey, driven black-box. books.online landed the in-browser
// put-a-book-online flow (online.spec.js is its reusable harness), so a device
// can now own a HOSTED book — one with a real `remote.origin.url` on the stack —
// which is what the sync engine's MERGED fact requires (a local-only book "is
// never synced", sync-engine.js). There is still no in-browser clone/join
// command, so the SECOND device is played by a Node git client (the host `git`
// CLI) that clones the same book with the device's own session cookie, seeds the
// song and later pushes a new version — the two-device pattern of
// e2e/api/sync.test.js, carried here over smart HTTP (service.git_http).
//
// The journey each hosted test drives:
//   1. the device signs in (passkey), makes a local book and puts it online
//      (empty — an owner cannot write to a hosted book through the UI yet, so the
//      second device seeds the song);
//   2. the second device clones the book and pushes one song into it; the app
//      syncs it down and, after a reload, finds it (the open-time index sweep,
//      not the engine, is what indexes a synced-in song);
//   3. the reader opens the song, the second device pushes a new version of it,
//      and a sync (a real `online` event — the DOM trigger the main thread
//      forwards to the Worker) fetches and cleanly fast-forwards the open song:
//      the engine emits MERGED and the open reading view reacts.
//
// Test 1 pins the open-and-read half (acceptance 2-3, 5; workflow 8 L51-52, W08
// L65/L177): the chart updates in place, the reader's place on the page is kept
// (the visual guarantee jsdom cannot give — asserted on the phone, where the
// sheet scrolls), the *Updated by {name}: see what changed* notice appears and
// opens the song's history in-app, axe-clean.
// Test 2 pins the full-screen half (acceptance 4; workflow 8 L53-54, W08
// L120/L155/L159; DIRECTION §3.7 L438-440): in full screen the update waits — the
// chart does not move and no notice shows — and applies only when the reader
// leaves full screen, axe-clean on both states.
// Test 3 pins the shared `onOpenHistory` seam from the reading toolbar's History
// button (acceptance 5) — the same in-app path the notice's action takes — with
// no hosted book needed, axe-clean on every viewport.
//
// The merge/in-place/defer/notice logic is also pinned IN-PROCESS at the behavior
// level (SongReading.behavior.test.jsx drives a MERGED event through the real
// store; sync-engine.behavior.test.js drives a real second clone racing a clean
// merge). Book and song names are written for this test (no-song-text rule).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test, expect } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';
import { baseUrl } from '../lib/env.js';

const execFileAsync = promisify(execFile);

const BOOK = 'Caderno da Enseada';
const SONG_TITLE = 'Lantern on the Pier';
const SONG_FILE = 'lantern-on-the-pier.cifra.md';
// A full, renderable song: an intro with chords, then lyric-only verses (each a
// single `.words` line in the chart — a stable boundingBox anchor). Tall enough
// that the reading sheet scrolls on the phone viewport. "harbour" is near the
// top; the second device later appends a bridge carrying "lighthouse".
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
// The new section the second device appends (its author becomes the notice's
// *Updated by {name}*). "lighthouse" is the token the in-place swap surfaces.
// Leading '' makes the one canonical blank line before the heading; no trailing ''
// (a trailing blank line is non-canonical, which the pre-receive hook refuses).
const BRIDGE = ['', '## Bridge', '```', 'a lighthouse sweeps the bay', '```'];
const INCOMING_AUTHOR = 'Ana Luiza';

// ---- device (browser) helpers — the account + hosted-book setup, copied from
// online.spec.js/account-sign-in.spec.js (the harness favours inline CDP helpers,
// no shared module). ----

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

// Put the (empty) book online: it gains a real `remote.origin.url` on the stack,
// so the sync engine will sync it and the second device can clone it.
async function putBookOnline(page, name) {
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.getByRole('button', { name: 'Put online' }).click();
  await expect(page.getByText('On Estante · private')).toBeVisible();
}

// Sign in, make a local book, put it online (empty), and return its git endpoint
// and the device's session cookie so the second device can clone/push it.
async function hostedEmptyBook(page) {
  await enableVirtualAuthenticator(page);
  await signIn(page);
  await makeLocalBook(page, BOOK);
  await putBookOnline(page, BOOK);
  await page.goto('/'); // leave the book detail for a clean search surface
  await waitForServiceWorker(page);
  const cookie = await sessionCookie(page);
  const url = await bookGitUrl(page, BOOK);
  return { url, cookie };
}

// Reload until the synced-in song is searchable. The engine does not re-index a
// song it merges in; the open-time index sweep (handleOpen → buildIndexes) does,
// and it runs before that load's sync pass — so it takes one reload to fetch the
// song and a following reload to index it. Each pass waits for the fetch to land
// before the next reload sweeps.
async function syncUntilSearchable(page) {
  await expect(async () => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await page.waitForTimeout(1500); // let this load's sync pass fast-forward
    await page.getByRole('searchbox').fill('Lantern');
    await expect(
      page.getByRole('button', { name: new RegExp(SONG_TITLE) }).first(),
    ).toBeVisible({ timeout: 2500 });
  }).toPass({ timeout: 60000 });
}

async function openSong(page) {
  await page.getByRole('searchbox').fill('Lantern');
  const result = page.getByRole('button', { name: new RegExp(SONG_TITLE) });
  await expect(result.first()).toBeVisible();
  await result.first().click();
  await expect(page.locator('.reading-sheet')).toBeVisible();
}

// Forward the network-back DOM trigger the real main thread forwards to the
// Worker (sync-triggers.js) — a deterministic way to run one sync pass while the
// reader stays on the open song.
async function triggerSync(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
}

// Enter the chrome-free full-screen reading view (the phone has a button, the
// tablet/computer put it behind the More menu).
async function enterFullScreen(page, narrow) {
  if (narrow) {
    await page.getByRole('button', { name: 'Full screen' }).click();
  } else {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'Full screen' }).click();
  }
  await expect(page.locator('.reading-fullscreen-scroll')).toBeVisible();
}

// ---- second device (Node git client) helpers ----

const tmpDirs = [];
function makeDir() {
  const dir = mkdtempSync(join(tmpdir(), 'estante-e2e-read-in-place-'));
  tmpDirs.push(dir);
  return dir;
}
test.afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// Run host git with an argument array (no shell; the cookie and paths are never
// interpolated into a command line). GIT_TERMINAL_PROMPT=0 so a missing
// credential never blocks; GIT_CONFIG_NOSYSTEM keeps the host's global config out.
function runGit(cwd, args) {
  return execFileAsync('git', args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' },
  });
}
// The `-c http.extraHeader=Cookie: …` args that carry the device's session on
// every smart-HTTP request (the device's own path to an authenticated clone/push,
// service.git_http — the e2e/api/lib/git.js pattern, reproduced not imported).
function cookieArgs(cookie) {
  return ['-c', `http.extraHeader=Cookie: ${cookie}`];
}
async function configIdentity(dir, name, email) {
  await runGit(dir, ['config', 'user.name', name]);
  await runGit(dir, ['config', 'user.email', email]);
  await runGit(dir, ['config', 'commit.gpgsign', 'false']); // no signing key in the harness
}

// The device's own session cookie as an `estante_session=…` header string.
async function sessionCookie(page) {
  const cookies = await page.context().cookies();
  const c = cookies.find((x) => x.name === 'estante_session');
  if (!c) throw new Error('no estante_session cookie on the device context');
  return `estante_session=${c.value}`;
}

// The hosted book's absolute git endpoint. GET /api/books carries the context's
// cookies through page.request; the gitUrl (`/git/{id}`) resolves against the
// stack origin.
async function bookGitUrl(page, title) {
  const resp = await page.request.get('/api/books');
  expect(resp.ok()).toBeTruthy();
  const { books } = await resp.json();
  const book = books.find((b) => b.title === title);
  if (!book) throw new Error(`book ${title} not found for the account`);
  return new URL(book.gitUrl, `${baseUrl}/`).toString();
}

// The second device clones the hosted book and pushes the song into it.
async function secondDeviceSeedsSong(url, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', url, dir]);
  await configIdentity(dir, 'Marina Souza', 'marina@users.estantedecifras.app');
  writeFileSync(join(dir, SONG_FILE), `${SONG_V1.join('\n')}\n`);
  await runGit(dir, ['add', SONG_FILE]);
  await runGit(dir, ['commit', '-m', 'Add a song']);
  await runGit(dir, [...cookieArgs(cookie), 'push', url, 'HEAD:refs/heads/main']);
}

// The second device appends the bridge and pushes it as INCOMING_AUTHOR — a clean
// fast-forward of the version the device has open.
async function secondDevicePushesNewVersion(url, cookie) {
  const dir = makeDir();
  await runGit(tmpdir(), [...cookieArgs(cookie), 'clone', url, dir]);
  await configIdentity(dir, INCOMING_AUTHOR, 'ana@users.estantedecifras.app');
  const current = readFileSync(join(dir, SONG_FILE), 'utf8');
  writeFileSync(join(dir, SONG_FILE), current + BRIDGE.join('\n') + '\n');
  await runGit(dir, ['add', SONG_FILE]);
  await runGit(dir, ['commit', '-m', 'Add a bridge']);
  await runGit(dir, [...cookieArgs(cookie), 'push', url, 'HEAD:refs/heads/main']);
}

test('a sync brings a new version of the open song in place, with the notice that opens history (acceptance 2-3, 5; workflow 8 L51-52, W08)', async ({
  page,
  checkA11y,
}, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  const { url, cookie } = await hostedEmptyBook(page);
  await secondDeviceSeedsSong(url, cookie);
  await syncUntilSearchable(page);

  // The reader opens the song (its current version) — not in full screen.
  await openSong(page);
  const sheet = page.locator('.reading-sheet');
  await expect(sheet).toContainText('harbour');
  await expect(sheet).not.toContainText('lighthouse');

  // The second device publishes a new version of the song.
  await secondDevicePushesNewVersion(url, cookie);

  // On the phone the sheet scrolls; capture where the reader is looking so we can
  // prove the place is kept across the swap (the visual guarantee jsdom cannot
  // give). Scroll a middle verse into view, so there is chart above it (which the
  // notice will push on) and below it (which the appended bridge adds to).
  const anchor = page.getByText(ANCHOR_LINE, { exact: true });
  let anchorBefore = null;
  if (narrow) {
    await anchor.scrollIntoViewIfNeeded();
    await expect(anchor).toBeVisible();
    anchorBefore = await anchor.boundingBox();
  }

  // A sync pass fetches and cleanly fast-forwards the open song: MERGED names it,
  // the view re-reads it in place, and the notice appears.
  await triggerSync(page);
  const notice = page.locator('.reading-update-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute('role', 'status');
  await expect(notice).toContainText(`Updated by ${INCOMING_AUTHOR}`);
  // The chart re-rendered to the merged version, in place.
  await expect(sheet).toContainText('lighthouse');

  if (narrow) {
    // Keeping the place: the line the reader was looking at stays put, even
    // though the notice appeared above the chart (Decision 4's anchor restore;
    // DIRECTION §3.7 "the worst moment for anything to move").
    const anchorAfter = await anchor.boundingBox();
    expect(Math.abs(anchorAfter.y - anchorBefore.y)).toBeLessThan(40);
  }

  await checkA11y(); // the in-place notice state, this viewport

  // The notice's action opens the song's history in-app (the shared
  // onOpenHistory seam, carrying the incoming commit).
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
  const { url, cookie } = await hostedEmptyBook(page);
  await secondDeviceSeedsSong(url, cookie);
  await syncUntilSearchable(page);

  // The reader opens the song and goes full screen for a performance.
  await openSong(page);
  await enterFullScreen(page, narrow);
  const sheet = page.locator('.reading-sheet');
  await expect(sheet).toContainText('harbour');

  // The second device publishes a new version while the reader is full screen.
  await secondDevicePushesNewVersion(url, cookie);

  // A sync lands it while full screen. The merge is durable in the Worker, but
  // the view must not move: the middle of a performance is the worst moment for a
  // song to move (DIRECTION §3.7 L438-440). The behavior test pins the defer logic
  // through the store; here we give the real round-trip a bounded window, then
  // assert the full-screen view did not swap and shows no notice.
  await triggerSync(page);
  await page.waitForTimeout(2500);
  await expect(sheet).toContainText('harbour');
  await expect(sheet).not.toContainText('lighthouse');
  await expect(page.locator('.reading-update-notice')).toHaveCount(0);
  await checkA11y(); // the full-screen waiting state, this viewport

  // Leaving full screen applies the deferred update: the chart swaps in place and
  // the notice appears (requires the merge to have landed — backstops the above).
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  const notice = page.locator('.reading-update-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(`Updated by ${INCOMING_AUTHOR}`);
  await expect(sheet).toContainText('lighthouse');
  await checkA11y(); // the applied-on-exit notice state, this viewport
});

test('the reading toolbar opens the song’s history in-app and returns (acceptance 5; the notice shares this seam)', async ({
  page,
  checkA11y,
}, testInfo) => {
  const narrow = testInfo.project.name === 'phone';

  // No hosted book needed here — the bundled example book reaches the reading
  // view, and the History toolbar control shares the onOpenHistory seam the merge
  // notice uses. Seed the example book and wait until its song is searchable (the
  // open-example durability flush runs after the "Books" heading paints).
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
  await page.getByRole('searchbox').fill('Morning');
  const result = page.getByRole('button', { name: /Morning on the Porch/ });
  await expect(result.first()).toBeVisible();
  await result.first().click();
  await expect(page.locator('.reading-sheet')).toBeVisible();

  // History: the overflow "More" menu on the phone, an app-bar button on the
  // tablet/computer (the same control the merge notice's "see what changed"
  // reuses through onOpenHistory).
  if (narrow) {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'History' }).click();
  } else {
    await page.getByRole('button', { name: 'History' }).click();
  }

  // It lands on the song's history surface in-app (not a dev hash): the bundled
  // first version is a row.
  await expect(page.locator('.est-history-row').first()).toBeVisible();
  await checkA11y(); // the history surface reached in-app, this viewport

  // Back returns to the reading view (the open song is still behind it).
  await page.getByRole('button', { name: 'Back to the song' }).click();
  await expect(page.locator('.reading-sheet')).toBeVisible();
});
