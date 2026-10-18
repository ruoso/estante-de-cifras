// conflicts (e2e-web) — the conflict-resolution journey against the compose
// stack, on the phone/tablet/computer projects, with axe at WCAG 2.1 AA on every
// conflict screen (sync.conflicts, workflow 9; board W09). TWO PEOPLE: the owner
// writes a song into a book, puts it online and shares it as an editor with a
// second browser context (a second account, joined through the real Share
// dialog and the invitation link). The second person, Ana, edits the same bar
// in her own editor and saves (a push the server accepts from a member); the
// owner then edits the same bar and saves, syncs, and meets *needs you*, engages
// the paused panel while the rest of the book stays readable, and settles the
// conflict — each way across the tests: *take theirs*, *keep mine*, *edit* the
// markers away, *abandon*, *keep both* for a voicing, and a song one person
// deleted while the other edited it. Also: a save is refused while the book
// needs you. Book and song names are written for these tests (no-song-text
// rule). A git CLI device appears only to read what is on the server.

import { test, expect, analyzeBothThemes } from '../lib/axe.js';
import { GitDevice } from '../lib/git-device.js';
import { mockup } from '../lib/mockup.js';
import {
  saveSurface,
  signedInDevice,
  makeLocalBook,
  putBookOnline,
  startApp,
  gotoTab,
  waitUntilSearchable,
  openSongInEditor,
  saveThroughSheet,
  openSongFromSearch,
  bookGitUrl,
  sessionCookie,
  typeAtEndOfLine,
  syncNow,
} from '../lib/journeys.js';
import { writeSongInBook, inviteThroughShare } from '../lib/journeys-share.js';
import { joinByInvite } from '../lib/journeys-account.js';
import { deleteSongInFiles, saveAllChanges } from '../lib/journeys-files.js';
import { replaceLine, gotoTabFromSong, openBookRow } from '../lib/journeys-sync.js';

const BOOK = 'Choros da Ana';
const SONG_TITLE = 'Roda de rua';
const SONG_FILE = 'roda-de-rua.cifra.md';
const BAR_BASE = 'C | G | Am | F';
const BAR_OWNER = 'C | G | Am | Dm';
const BAR_ANA = 'C | G | Am | E7';
const INCOMING_AUTHOR = 'Ana';
const songWithBar = (bar) => [`# ${SONG_TITLE}`, '- language: en', '', '## Parte', '```', bar, '```', ''];

// A calm second song nobody touches, so the book has "the rest" and a place to
// try a save while the book needs you.
const OTHER_TITLE = 'Cantiga calma';
const OTHER_LINES = [`# ${OTHER_TITLE}`, '- language: en', '', '## Parte', '```', 'G | D | Em | C', '```', ''];

const rowFor = (title) => new RegExp('^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

const contexts = [];
test.afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close().catch(() => {});
});

// The owner hosts `songs` (arrays of lines) in BOOK, shares it as an editor, and
// Ana joins from her own browser context and has the first song.
async function ownerAndAna(browser, page, songs, { query, title }) {
  await signedInDevice(page);
  await makeLocalBook(page, BOOK);
  for (const lines of songs) await writeSongInBook(page, BOOK, lines);
  await putBookOnline(page, BOOK);
  await startApp(page);
  const link = await inviteThroughShare(page, BOOK, { role: 'Editor' });

  const ana = await joinByInvite(browser, link, BOOK);
  contexts.push(ana.context);
  await expect(ana.page.getByText('On Estante · can save')).toBeVisible();
  await waitUntilSearchable(ana.page, query, title);

  const url = await bookGitUrl(page, BOOK);
  const cookie = await sessionCookie(page);
  return { ana: ana.page, url, cookie };
}

// Ana changes `oldLine` to `newLine` in the song and saves (her save pushes).
async function anaRewrites(ana, { query, title, oldLine, newLine }) {
  await openSongInEditor(ana, query, title);
  await replaceLine(ana, oldLine, newLine);
  await saveThroughSheet(ana, { name: INCOMING_AUTHOR });
}

// The text of `file` on the server now (a fresh clone of the book).
async function remoteFile(url, cookie, file) {
  const device = new GitDevice({ url, cookie });
  try {
    await device.clone();
    return device.read(file);
  } finally {
    device.cleanup();
  }
}

// Wait until Ana's save is on the server (so the owner's next save collides).
async function waitForRemote(url, cookie, file, text) {
  await expect.poll(() => remoteFile(url, cookie, file), { timeout: 10000 }).toContain(text);
}

// The owner (who has not synced since) changes the same line and saves, then a
// sync pass runs; the shelf reads *needs you*; engage the book → paused panel.
async function ownerCollidesAndEngages(page, { query, title, oldLine, newLine, deleted = false }) {
  await openSongInEditor(page, query, title);
  await replaceLine(page, oldLine, newLine);
  await saveThroughSheet(page);
  await page.context().setOffline(false); // back online: the sync pass meets the collision
  await gotoTabFromSong(page, 'Books');
  await expect(page.getByText('needs you').first()).toBeVisible({ timeout: 10000 });
  await openBookRow(page, BOOK);
  await expect(page.getByText(/songs? need you|song needs you/i)).toBeVisible();
  // A song deleted on one side has no "In conflict" group: its choice is inline.
  if (!deleted) await expect(page.getByText('In conflict')).toBeVisible();
}

// Both change the same bar: the paused panel is up for the owner.
async function reachNeedsYou(browser, page) {
  const { ana, url, cookie } = await ownerAndAna(browser, page, [songWithBar(BAR_BASE), OTHER_LINES], {
    query: 'Roda',
    title: SONG_TITLE,
  });
  await page.context().setOffline(true); // the owner is away from the network while Ana saves
  await anaRewrites(ana, { query: 'Roda', title: SONG_TITLE, oldLine: BAR_BASE, newLine: BAR_ANA });
  await waitForRemote(url, cookie, SONG_FILE, BAR_ANA);
  await ownerCollidesAndEngages(page, { query: 'Roda', title: SONG_TITLE, oldLine: BAR_BASE, newLine: BAR_OWNER });
  return { ana, url, cookie };
}

async function openResolver(page) {
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the paused book panel
  await page.getByRole('button', { name: new RegExp(`^Settle ${SONG_TITLE}`) }).click();
  await expect(page.getByText(/Conflict \d+ of \d+/)).toBeVisible();
  await expect(page.getByText('Yours', { exact: true })).toBeVisible();
  await expect(page.getByText('Ana’s', { exact: true })).toBeVisible();
  // The conflict is titled by where it is: its section and the differing bar,
  // the fourth of Parte (W09#1 L42; sync.conflicts_editing).
  await expect(page.getByRole('heading', { name: 'Parte, bar 4' })).toBeVisible();
  // Under each side's bar, the diagram of the chord that side wrote in the bar
  // that differs (workflow 9 §Settling one L49-51; W09#1 L45-77;
  // sync.conflicts_polish): Dm under *Yours*, E7 under *Ana's*.
  const yours = page.locator('.est-conflict-side[aria-label="Yours"]');
  const anas = page.locator('.est-conflict-side[aria-label="Ana’s"]');
  await expect(yours.getByRole('img', { name: /^Dm\b/ })).toHaveCount(1);
  await expect(yours.getByRole('img')).toHaveCount(1);
  await expect(anas.getByRole('img', { name: /^E7\b/ })).toHaveCount(1);
  await expect(anas.getByRole('img')).toHaveCount(1);
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the per-song resolver
}

// The paused panel as W09#4 draws it (sync.conflicts_polish constraints 4-5):
// on a tablet or a computer it sits in the main pane with the rail beside it,
// on a phone it is the full screen; and the in-conflict row's title starts at
// the row's own padding, with no list indent, its summary line under it.
async function expectPanelAsDrawn(page, testInfo) {
  const list = page.getByRole('list', { name: 'In conflict' });
  await expect(list).toBeVisible();
  const rail = page.getByRole('tablist', { name: 'Destinations' });
  if (testInfo.project.name === 'phone') {
    await expect(rail).toBeHidden();
  } else {
    await expect(rail).toBeVisible();
    const railBox = await rail.boundingBox();
    const listBox = await list.boundingBox();
    expect(railBox.x + railBox.width).toBeLessThanOrEqual(listBox.x); // beside it
  }
  const listBox = await list.boundingBox();
  const title = list.getByRole('listitem').filter({ hasText: SONG_TITLE }).getByText(SONG_TITLE, { exact: true });
  const titleBox = await title.boundingBox();
  expect(titleBox.x - listBox.x).toBeLessThanOrEqual(24);
  // Under the title, the row's summary line names the song's conflict by place,
  // as the resolver titles it (W09#4 L222; sync.conflicts_row_summary).
  await expect(list.getByRole('listitem').filter({ hasText: SONG_TITLE })).toContainText('Parte, bar 4');
}

// After settling, the book leaves *needs you* and the song reads `bar`.
async function expectSettledWithBar(page, bar) {
  // Let the settle finish before going anywhere: the conflict panel (whose
  // every variant offers Abandon the merge) closes once the Worker has handled
  // it. Acting earlier races the panel's own exit (a reload kills the settle;
  // its Back vanishes under the click).
  await expect(page.getByRole('button', { name: 'Abandon the merge' })).toHaveCount(0, {
    timeout: 10000,
  });
  await openSongInEditor(page, 'Roda', SONG_TITLE);
  await expect(page.locator('.cm-content')).toContainText(bar);
  await expect(page.locator('.cm-content')).not.toContainText('<<<<<<<');
}

// Sync this device (Books → Sync now), then reopen the song in the editor until
// it reads `bar` with no markers.
async function syncUntilSongReads(page, bar) {
  await syncNow(page);
  await expect(async () => {
    await openSongInEditor(page, 'Roda', SONG_TITLE);
    await expect(page.locator('.cm-content')).toContainText(bar, { timeout: 1000 });
    await expect(page.locator('.cm-content')).not.toContainText('<<<<<<<', { timeout: 1000 });
  }).toPass({ timeout: 10000 });
}

test('take theirs settles the conflict, and the resolved merge is pushed, fetched back, and reaches the other person', async ({
  browser,
  page,
}, testInfo) => {
  const { ana, url, cookie } = await reachNeedsYou(browser, page);
  await expectPanelAsDrawn(page, testInfo);
  await mockup(page, 'W09-conflicts', 4);
  await openResolver(page);
  await mockup(page, 'W09-conflicts', 1);

  await page.getByRole('button', { name: 'Take theirs' }).click();

  // The two-parent merge is committed and pushed; a fresh clone sees Ana's bar.
  await expectSettledWithBar(page, BAR_ANA);
  await expect.poll(() => remoteFile(url, cookie, SONG_FILE), { timeout: 10000 }).toContain(BAR_ANA);

  // Ana's own device takes the resolved song too.
  await syncUntilSongReads(ana, BAR_ANA);
});

test('keep mine settles the conflict with the owner’s own version', async ({ browser, page }) => {
  await reachNeedsYou(browser, page);
  await openResolver(page);

  await page.getByRole('button', { name: 'Keep mine' }).click();
  await expectSettledWithBar(page, BAR_OWNER);
});

test('keep mine pushes the resolved merge, so the other person and the server get the owner’s version', async ({
  browser,
  page,
}) => {
  const { url, cookie } = await reachNeedsYou(browser, page);
  await openResolver(page);
  await page.getByRole('button', { name: 'Keep mine' }).click();
  // The server gets the owner's bar without any reload or nudge.
  await expect.poll(() => remoteFile(url, cookie, SONG_FILE), { timeout: 10000 }).toContain(BAR_OWNER);
  await expectSettledWithBar(page, BAR_OWNER);
});

test('edit opens the marked text in the source editor, markers named for the people; a save refuses while a marker line remains and goes to it, then settles once removed (sync.conflicts_editing; workflow 9 §Settling one; W09#3; §11.12.3)', async ({
  browser,
  page,
}) => {
  await reachNeedsYou(browser, page);
  await openResolver(page);

  await page.getByRole('button', { name: 'Edit' }).click();
  // The source editor of workflow 3: numbered lines, the markers named
  // *yours* and *Ana's* as the side cards name them.
  const editor = page.getByRole('textbox', { name: /text, with the conflict markers/i });
  await expect(editor).toBeVisible();
  await expect(page.locator('.cm-lineNumbers')).toBeVisible();
  await expect(editor).toContainText('<<<<<<< yours');
  await expect(editor).toContainText('>>>>>>> Ana’s');
  await mockup(page, 'W09-conflicts', 3);
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the edit view

  // Saving with the markers still there is refused, pointing at the line.
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/is still a conflict marker/)).toBeVisible();
  const goTo = page.getByRole('button', { name: /^Go to line \d+$/ });
  await expect(goTo).toBeVisible();
  await goTo.click();
  await expect(editor).toBeFocused();
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the refusal

  // Edit the markers away through the editor, keeping the owner's line.
  const resolved = (await editor.locator('.cm-line').allTextContents())
    .filter((l) => !/^(<{7}|={7}|>{7}|\|{7})/.test(l) && l !== BAR_ANA)
    .join('\n');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(resolved);
  await page.getByRole('button', { name: 'Save' }).click();

  await expectSettledWithBar(page, BAR_OWNER);
});

test('abandon puts the book back as it was before the sync', async ({ browser, page }) => {
  await reachNeedsYou(browser, page);

  await page.getByRole('button', { name: 'Abandon the merge' }).click();

  // The panel closes back to the shell; the book is no longer paused (the
  // incoming change waits to be merged at the next sync — workflow 9 L77-78).
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible({ timeout: 10000 });
});

test('a save is refused while the book needs you, and the panel says so (workflow 9 L42-43)', async ({ browser, page }) => {
  await reachNeedsYou(browser, page);

  // The panel tells the owner a save now would be folded into the merge.
  await expect(page.getByText('Saving in this book')).toBeVisible();
  await expect(page.getByText(/A save made now would be folded into the merge/)).toBeVisible();

  // The rest of the book stays readable and editable: open the calm song, edit
  // it and try to save — the save is refused until the conflict is settled.
  await gotoTabFromSong(page, 'Search');
  await openSongInEditor(page, 'Cantiga', OTHER_TITLE);
  await typeAtEndOfLine(page, 'G | D | Em | C', ' | Am');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  const sheet = saveSurface(page); // the sheet, the dialog or the computer's panel
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Settle the conflicts in this book first/)).toBeVisible();
});

test('a song one person deleted while the other edited it asks to keep it with the edits or delete it (workflow 9 §Deleted vs edited)', async ({
  browser,
  page,
}) => {
  const { ana, url, cookie } = await ownerAndAna(browser, page, [songWithBar(BAR_BASE), OTHER_LINES], {
    query: 'Roda',
    title: SONG_TITLE,
  });

  // Ana deletes the song through the file view and saves (a push).
  await page.context().setOffline(true); // the owner is away from the network while Ana saves
  await deleteSongInFiles(ana, BOOK, SONG_FILE);
  await saveAllChanges(ana);
  await expect
    .poll(async () => remoteFile(url, cookie, SONG_FILE).then(() => 'present', () => 'gone'), { timeout: 10000 })
    .toBe('gone');

  // The owner, who has not synced, edits the same song and saves.
  await ownerCollidesAndEngages(page, { query: 'Roda', title: SONG_TITLE, oldLine: BAR_BASE, newLine: BAR_OWNER, deleted: true });
  await expect(page.getByText(/deleted this song\. You had edited it\./)).toBeVisible();
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: deleted vs edited

  await page.getByRole('button', { name: 'Keep the song, with the edits' }).click();
  await expectSettledWithBar(page, BAR_OWNER);
  // (The push of this resolution shows the same keep-mine push bug above.)
});

// --- keep both, for a voicing (workflow 9 §Settling one, the keep-both option;
// sync.keep_both) — a song that carries a voicings block, both people reshaping
// the same chord. Its own song fixture (written for the purpose). ---

const VSONG_TITLE = 'Toada da Ana';
const VSONG_FILE = 'toada-da-ana.cifra.md';
const V_TUNING = 'E2 A2 D3 G3 B3 E4';
const V_BASE = 'x35543'; // the seeded Cm shape
const V_OWNER = 'x3554x'; // the owner reshapes it their way
const V_ANA = '8-10-10-8-8-8'; // Ana reshapes it hers
const voicingSong = (cm) => [
  `# ${VSONG_TITLE}`,
  '- language: en',
  '',
  '## Parte',
  '```',
  'Cm | F7 | Cm | G7',
  '```',
  '',
  '---',
  '',
  `## Voicings: ${V_TUNING}`,
  `- Cm: ${cm}`,
  '- F7: 131211',
  '- G7: 320001',
  '',
];

test('keep both a voicing: the owner keeps their shape and Ana’s lands in a variation named for her, pushed and fetched back (workflow 9 §Later)', async ({
  browser,
  page,
}) => {
  const { ana, url, cookie } = await ownerAndAna(browser, page, [voicingSong(V_BASE)], {
    query: 'Toada',
    title: VSONG_TITLE,
  });
  await page.context().setOffline(true); // the owner is away from the network while Ana saves
  await anaRewrites(ana, {
    query: 'Toada',
    title: VSONG_TITLE,
    oldLine: `- Cm: ${V_BASE}`,
    newLine: `- Cm: ${V_ANA}`,
  });
  await waitForRemote(url, cookie, VSONG_FILE, V_ANA);
  await ownerCollidesAndEngages(page, {
    query: 'Toada',
    title: VSONG_TITLE,
    oldLine: `- Cm: ${V_BASE}`,
    newLine: `- Cm: ${V_OWNER}`,
  });

  // Open the resolver; axe on the paused panel and the per-song resolver.
  expect(await analyzeBothThemes(page)).toEqual([]);
  await page.getByRole('button', { name: new RegExp(`^Settle ${VSONG_TITLE}`) }).click();
  await expect(page.getByText('The shape for Cm')).toBeVisible();
  await expect(page.getByText('Yours', { exact: true })).toBeVisible();
  await expect(page.getByText('Ana’s', { exact: true })).toBeVisible();
  await mockup(page, 'W09-conflicts', 2);
  expect(await analyzeBothThemes(page)).toEqual([]);

  // Keep both: ours stays in use, Ana's goes into a variation named for her.
  await page.getByRole('button', { name: 'Keep both', exact: true }).click();

  await expect
    .poll(() => remoteFile(url, cookie, VSONG_FILE), { timeout: 10000 })
    .toContain(`## Ana: ${V_TUNING}`);
  const resolved = await remoteFile(url, cookie, VSONG_FILE);
  expect(resolved).toContain(`- Cm: ${V_OWNER}`); // the owner's shape, still in use
  expect(resolved).toContain(V_ANA); // Ana's shape, kept
  expect(resolved).not.toContain('<<<<<<<'); // canonical, no markers

  // The book no longer *needs you*.
  await startApp(page);
  await gotoTab(page, 'Books');
  await expect(page.getByRole('button', { name: rowFor(BOOK) })).toBeVisible();
  await expect(page.getByText('needs you')).toHaveCount(0);

  // The reading view offers the variation named for Ana in its picker, and axe
  // is clean on the resolved song.
  await openSongFromSearch(page, 'Toada', VSONG_TITLE);
  const variationPicker = page.getByRole('button', { name: /Variation/ });
  await expect(variationPicker).toBeVisible({ timeout: 10000 });
  expect(await analyzeBothThemes(page)).toEqual([]);
  await variationPicker.click();
  await expect(page.getByRole('option', { name: 'Ana' })).toBeVisible();
});
