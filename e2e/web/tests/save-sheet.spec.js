// save sheet (e2e-web) — saving, discarding and save-all against the compose
// stack, on the phone, tablet and computer projects (songs.save_sheet, workflow
// 4). A clean Save opens a sheet showing what changed in musical terms and a
// note prefilled from it; confirming commits the one file (or, for save all,
// every changed song in the book in one commit) and the song is no longer
// unsaved. Discard shows what would be lost and always asks. The first save ever
// asks once for a name; the second does not. A save made offline commits locally
// and persists. Axe runs at WCAG 2.1 AA on the sheet and the discard dialog. The
// editor is reached through the `#dev/editor` mount (the on-device seam its real
// hosts are not wired to yet, mirroring editor.spec.js). Fixtures are the
// bundled example book — purpose-written songs, never anyone's copyrighted words.

import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';

const SONG_PATH = 'morning-on-the-porch.cifra.md';
const SONG_TITLE = 'Morning on the Porch';
const FERRY_PATH = 'the-ferry-line.cifra.md';
const FERRY_TITLE = 'The Ferry Line';
const editorUrl = (p) => `/#dev/editor?book=local-example-book&path=${encodeURIComponent(p)}`;

// Put the example book on the device and wait until a song is indexed.
async function seedExampleBook(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Open the example book/ }).click();
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByText(SONG_TITLE)).toBeVisible();
  await page.getByRole('searchbox').fill('');
}

// Open a song in the editor and confirm its working-copy text loaded.
async function openEditor(page, songPath) {
  await page.goto(editorUrl(songPath));
  await expect(page.locator('.cm-content')).toBeVisible();
}

// Switch the dev mount by changing the hash in the SAME document (no reload), so
// the Worker session — and its live "unsaved" index flags — survive. A full
// reload reconciles every song as saved (the dirty flag is only ever set by a
// live WRITE), so save-all must stay in one session.
async function hashTo(page, hash) {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
}

async function openEditorInSession(page, songPath) {
  await hashTo(page, `#dev/editor?book=local-example-book&path=${encodeURIComponent(songPath)}`);
  await expect(page.locator('.cm-content')).toBeVisible();
}

// Add a new section to the open song — the clean, canonicalisable change the
// diff reports as "section added". Inserted before the song's FIRST section
// heading so it lands in the body: appending at the very end would fall after
// the voicings appendix (`---` then `## Voicings:`), which cifra.md treats as
// the appendix and drops on both parse and canonicalise — so it would be no diff
// at all, and an empty prefilled note. The first heading is near the top, so it
// is always rendered (CodeMirror virtualises long documents). `mark` names the
// section — unique per call, so it is visible in the editor and a repeated save
// on one song reports a distinct change each time. Lets the debounced WRITE
// settle.
async function editSong(page, mark) {
  const heading = page.locator('.cm-content .cm-line').filter({ hasText: /^## / }).first();
  await heading.click();
  await page.keyboard.press('Home');
  // insertText (not type): the mobile CodeMirror input path collapses Enter
  // keydowns, so the multi-line section only forms with insertText (editor.spec.js).
  await page.keyboard.insertText(`## ${mark}\n\`\`\`\nC | G\n\`\`\`\n\n`);
  await page.waitForTimeout(800);
}

test('Save opens the sheet with what changed and a prefilled note; confirming saves and clears unsaved; axe-clean', async ({
  page,
  checkA11y,
}) => {
  await seedExampleBook(page);
  await openEditor(page, SONG_PATH);
  await editSong(page, 'Coda');

  await page.getByRole('button', { name: 'Save' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  // What changed, and a note prefilled from the diff summary (not empty).
  await expect(sheet.getByText('What changed')).toBeVisible();
  await expect(sheet.getByRole('textbox', { name: 'Note' })).not.toHaveValue('');
  // The first save ever asks once for the author's name.
  await sheet.getByRole('textbox', { name: /Your name/ }).fill('Marina Souza');
  await checkA11y();

  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();

  // Back on search the song is saved — no unsaved badge.
  await page.goto('/');
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByText(SONG_TITLE)).toBeVisible();
  await expect(page.getByText('unsaved')).toHaveCount(0);
});

test('Discard shows what would be lost, always asks, and reverts the song; axe-clean', async ({
  page,
  checkA11y,
}) => {
  await seedExampleBook(page);
  await openEditor(page, SONG_PATH);
  await editSong(page, 'ThrowawayCoda');
  await expect(page.locator('.cm-content')).toContainText('ThrowawayCoda');

  await page.getByRole('button', { name: 'Discard changes' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/This would be lost/)).toBeVisible();
  await checkA11y();

  // The danger action reverts the working copy; the editor reloads it.
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.cm-content')).not.toContainText('ThrowawayCoda');
});

test('Save all from a book section makes one commit over every changed song', async ({ page }) => {
  await seedExampleBook(page);

  // Change two songs, leaving each unsaved — all in one Worker session (hash
  // navigation), so the live unsaved flags survive to the search screen.
  await openEditorInSession(page, SONG_PATH);
  await editSong(page, 'CodaOne');
  await openEditorInSession(page, FERRY_PATH);
  await editSong(page, 'CodaTwo');

  // Back to the shell's search screen (same session); the example book's section
  // offers Save all now that two songs are unsaved.
  await hashTo(page, '');
  await expect(page.getByRole('searchbox')).toBeVisible();
  await page.getByRole('button', { name: /Save all changes in Example Book/ }).click();

  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  // Exact match: the prefilled save-all note also contains each title (the diff
  // summary is prefixed with the song's title), so a substring match would
  // resolve to both the song-title row and the note field.
  await expect(sheet.getByText(SONG_TITLE, { exact: true })).toBeVisible();
  await expect(sheet.getByText(FERRY_TITLE, { exact: true })).toBeVisible();
  await sheet.getByRole('textbox', { name: /Your name/ }).fill('Marina Souza');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();

  // Both songs are saved now — neither is unsaved any more.
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByText(SONG_TITLE)).toBeVisible();
  await expect(page.getByText('unsaved')).toHaveCount(0);
  await page.getByRole('searchbox').fill('Ferry');
  await expect(page.getByText(FERRY_TITLE)).toBeVisible();
  await expect(page.getByText('unsaved')).toHaveCount(0);
});

test('the first save asks for a name and the second does not', async ({ page }) => {
  await seedExampleBook(page);
  await openEditor(page, SONG_PATH);

  // First save: the name is asked.
  await editSong(page, 'FirstCoda');
  await page.getByRole('button', { name: 'Save' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('textbox', { name: /Your name/ }).fill('Marina Souza');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();

  // Second save: the name is remembered (kept in the home book), so it is not
  // asked again.
  await editSong(page, 'SecondCoda');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('textbox', { name: /Your name/ })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
});

test('a save made offline commits locally and persists', async ({ page }) => {
  // The example book is a local book, so its commit is always kept locally and
  // never pushed — the offline-commit behaviour a save over no network needs.
  // (The push-on-reconnect of a SHARED book is pinned at the Worker level; there
  // is no e2e-web seam to create an online book yet — see the task summary.)
  await seedExampleBook(page);
  await openEditor(page, SONG_PATH);
  await waitForServiceWorker(page);

  await runOffline(page, {
    path: editorUrl(SONG_PATH),
    async whileOffline(offlinePage) {
      await expect(offlinePage.locator('.cm-content')).toBeVisible();
      await editSong(offlinePage, 'OfflineEdit');
      await offlinePage.getByRole('button', { name: 'Save' }).click();
      const sheet = offlinePage.getByRole('dialog');
      await expect(sheet).toBeVisible();
      await sheet.getByRole('textbox', { name: /Your name/ }).fill('Marina Souza');
      await sheet.getByRole('button', { name: 'Save' }).click();
      await expect(sheet).toBeHidden();
    },
  });

  // Back online, the commit made offline persists; the song is not unsaved.
  await page.goto('/');
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByText(SONG_TITLE)).toBeVisible();
  await expect(page.getByText('unsaved')).toHaveCount(0);
});
