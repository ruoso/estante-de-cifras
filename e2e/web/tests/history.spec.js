// history.spec.js (e2e-web) — a song's history on the three viewports, offline,
// and a version restored and saved (songs.history, workflow 6; workflow 8
// §Offline). Against the compose stack, on the phone/tablet/computer projects:
// seed the example book, build a short history by editing and saving a song
// through #dev/editor (the save sheet is Done), then open #dev/history and
// drive the journey — the versions list newest first, reading a version,
// *compare with now*, *show the text*, and *restore this version* (which asks
// first over unsaved changes, then opens the save sheet, and the saved copy
// appears as a new version at the top) — with axe at WCAG 2.1 AA on the list,
// the version view and the restore dialog, and the whole flow once more after a
// reload with the network cut.
//
// No `#dev/history` entry point existed before this task (songs.reading wires
// the real toolbar control later, Decision 5); this spec reaches the surface
// through the dev hash, as the editor's save-sheet spec does.

import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';

const BOOK = 'local-example-book';
const SONG_PATH = 'morning-on-the-porch.cifra.md';
const SONG_TITLE = 'Morning on the Porch';
const editorUrl = (p) => `/#dev/editor?book=${BOOK}&path=${encodeURIComponent(p)}`;
const historyUrl = (p) => `/#dev/history?book=${BOOK}&path=${encodeURIComponent(p)}`;

// Put the example book on the device and wait until the song is indexed.
async function seedExampleBook(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Open the example book/ }).click();
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByText(SONG_TITLE)).toBeVisible();
  await page.getByRole('searchbox').fill('');
}

// Type a new section at the top of the song. insertText (not type): the mobile
// CodeMirror input path collapses Enter keydowns (editor.spec.js).
async function editSong(page, mark) {
  const heading = page.locator('.cm-content .cm-line').filter({ hasText: /^## / }).first();
  await heading.click();
  await page.keyboard.press('Home');
  await page.keyboard.insertText(`## ${mark}\n\`\`\`\nC | G\n\`\`\`\n\n`);
  await page.waitForTimeout(800); // let the debounced WRITE settle
}

// Confirm a save through the sheet, filling the one-time name prompt if present.
async function saveThroughSheet(page) {
  await page.getByRole('button', { name: 'Save' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill('Marina Souza');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
}

// Two saves give the song a short history over its bundled first version.
async function buildHistory(page) {
  await page.goto(editorUrl(SONG_PATH));
  await expect(page.locator('.cm-content')).toBeVisible();
  await editSong(page, 'Coda');
  await saveThroughSheet(page);
  await editSong(page, 'Bridge');
  await saveThroughSheet(page);
}

// Open a version (the computer opens the newest beside the list; the phone and
// tablet show the list until a row is tapped — tapping the first row reaches the
// version on every viewport).
async function openFirstVersion(page) {
  await expect(page.locator('.est-history-row').first()).toBeVisible();
  await page.locator('.est-history-row').first().click();
  await expect(page.getByRole('group', { name: 'The song as it was' })).toBeVisible();
}

test('a song’s history: list, read a version, compare with now, show the text; axe-clean', async ({
  page,
  checkA11y,
}) => {
  await seedExampleBook(page);
  await buildHistory(page);

  await page.goto(historyUrl(SONG_PATH));
  await expect(page.locator('.est-history-row').first()).toBeVisible();
  await checkA11y(); // the list (and, on the computer, the split)

  await openFirstVersion(page);
  await expect(page.getByText('What changed from the version before')).toBeVisible();
  await checkA11y(); // the version view

  await page.getByRole('button', { name: 'Compare with now' }).click();
  await expect(page.getByText('What changed from this version to now')).toBeVisible();

  await page.getByRole('switch', { name: 'Show the text' }).click();
  await expect(page.locator('.est-history-text')).toBeVisible();
});

test('restore asks first over unsaved changes, then saves as a new version; axe-clean dialog', async ({
  page,
  checkA11y,
}) => {
  await seedExampleBook(page);
  await buildHistory(page);

  // Leave an unsaved edit so restore must ask first (and clears on a reload —
  // the unsaved signal is the save preview, not the index flag).
  await page.goto(editorUrl(SONG_PATH));
  await expect(page.locator('.cm-content')).toBeVisible();
  await editSong(page, 'Outro');

  await page.goto(historyUrl(SONG_PATH));
  await expect(page.getByText('Unsaved, on this device')).toBeVisible();
  const before = await page.locator('.est-history-row').count();

  // Restore the oldest version: it differs from HEAD, so saving makes a new one.
  await page.locator('.est-history-row').last().click();
  await page.getByRole('button', { name: 'Restore this version' }).click();

  const confirm = page.getByRole('dialog');
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText(/Restore the version of/)).toBeVisible();
  await checkA11y(); // the restore confirm dialog

  await confirm.getByRole('button', { name: 'Lose them and restore' }).click();

  // The restored copy opens the save sheet; saving makes a new version.
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill('Marina Souza');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();

  await expect(page.locator('.est-history-row')).toHaveCount(before + 1);
});

test('the whole history flow works offline after a reload', async ({ page }) => {
  await seedExampleBook(page);
  await buildHistory(page);

  await runOffline(page, {
    path: historyUrl(SONG_PATH),
    async whileOffline(offlinePage) {
      await openFirstVersion(offlinePage);
      await offlinePage.getByRole('switch', { name: 'Show the text' }).click();
      await expect(offlinePage.locator('.est-history-text')).toBeVisible();

      // Restore an older version and save it — all local, no network. On the
      // phone and tablet a version fills the screen (W06 one-at-a-time), so step
      // back to the list to choose an older one; the computer keeps the list
      // beside the version and has no such back control.
      const backToHistory = offlinePage.getByRole('button', { name: 'Back to history' });
      if (await backToHistory.count()) await backToHistory.click();
      await offlinePage.locator('.est-history-row').last().click();
      await offlinePage.getByRole('button', { name: 'Restore this version' }).click();
      const sheet = offlinePage.getByRole('dialog');
      await expect(sheet).toBeVisible();
      // The name is asked once; fill it if the sheet still asks (as the other
      // save flows in this file do) so saving is never blocked.
      const nameField = sheet.getByRole('textbox', { name: /Your name/ });
      if (await nameField.count()) await nameField.fill('Marina Souza');
      await sheet.getByRole('button', { name: 'Save' }).click();
      await expect(sheet).toBeHidden();
    },
  });
});
