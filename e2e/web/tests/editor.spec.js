// editor (e2e-web) — the source editor against the compose stack, on the phone,
// tablet and computer projects (songs.editor). Every test starts at `/` and
// reaches the editor the way a person does: search a song in the bundled example
// book and press Edit in the reading view, or Write a song from the empty shelf.
// Editing by keyboard and touch that survives a reload (workflow 4 §Editing),
// the preview beside when the editor is wide enough and a tap away otherwise
// (workflow 3 L78-84), pasting a cifra into a fence with an Undo using the REAL
// clipboard (workflow 3 L87-95), a voicing the reader cannot read stopping the save
// (workflow 4 §Normalising), and all of it working offline (offline-first;
// DIRECTION §3.4). Axe runs at WCAG 2.1 AA on the editor on every viewport.

import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { runOffline } from '../lib/offline.js';
import { openExampleBook, openSongInEditor, settleEdits, startApp } from '../lib/journeys.js';

const SONG_TITLE = 'Morning on the Porch';

test('an edit typed by keyboard or touch persists across a reload, axe-clean on this viewport', async ({
  page,
  checkA11y,
}, testInfo) => {
  await openExampleBook(page);
  await openSongInEditor(page, 'Morning', SONG_TITLE);
  const content = page.locator('.cm-content');
  // Touch on the phone and tablet, the keyboard on the computer — both reach it.
  if (testInfo.project.use.hasTouch) await content.tap();
  else await content.click();
  await page.keyboard.press('Control+End');
  const stamp = `porch-note-${testInfo.project.name}`;
  await page.keyboard.type(`\n${stamp}`);

  await checkA11y();

  // The debounced WRITE persists the edit locally; after a full reload the
  // editor opened through the UI reads it straight back from the working copy.
  await settleEdits(page); // a reload does not flush the editor's debounced write
  await startApp(page);
  await openSongInEditor(page, 'Morning', SONG_TITLE);
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+End');
  await expect(page.locator('.cm-content')).toContainText(stamp);
});

// The editor's own width decides (songs.editor_split_width; workflow 3
// L78-84): beside the text from 640px of editor, a tap away under it — the
// phone always, a tablet or computer whose editor is squeezed too.
test('the preview sits beside the text when the editor is wide enough and a tap away otherwise', async ({
  page,
}, testInfo) => {
  await openExampleBook(page);
  await openSongInEditor(page, 'Morning', SONG_TITLE);
  const width = await page.locator('.est-editor-body').evaluate((el) => el.clientWidth);
  if (testInfo.project.name === 'phone') expect(width).toBeLessThan(640);
  if (width < 640) {
    await expect(page.locator('.chart')).toHaveCount(0);
    await page.getByRole('radio', { name: 'Preview' }).click();
    await expect(page.locator('.chart')).toBeVisible();
  } else {
    await expect(page.locator('.est-editor-body.split')).toHaveCount(1);
    await expect(page.locator('.chart')).toBeVisible();
  }
  await mockup(page, 'W03-write-a-new-song', 4); // text and preview side by side
});

test('pasting a cifra outside a fence wraps it in a fence, with an Undo (real clipboard)', async ({
  page,
  context,
  checkA11y,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await startApp(page);
  await page.getByRole('button', { name: /Write a song/ }).click();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await mockup(page, 'W03-write-a-new-song', 2); // the template

  // Put the cifra on the system clipboard the way a person does: write it in
  // the editor, select it, Ctrl+C. (insertText: multi-line on every input path.)
  const CIFRA = 'Verse one\nAm  G  F  E7\na line of words';
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(CIFRA);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+c');

  // Start over with plain prose, so the paste lands outside any fence.
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('# Pasted\n\nSomething to play:\n\n');
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Control+v');

  // The paste notice — on a phone the new song's unsaved strip is a status too
  // (songs.editor_chrome).
  await expect(page.getByRole('status').filter({ hasText: 'inside a fence' })).toBeVisible();
  await expect(content).toContainText('```');
  await expect(content).toContainText('Am  G  F  E7');
  await mockup(page, 'W03-write-a-new-song', 3); // pasted cifra, fenced, with Undo
  await checkA11y();

  const undo = page.getByRole('button', { name: 'Undo' });
  await undo.click();
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
  await expect(content).not.toContainText('```');
});

test('a voicing the reader cannot read stops the save until it is fixed, axe-clean', async ({
  page,
  checkA11y,
}) => {
  // A fully-typed song (no book needed — Save still gates on the buffer's parse)
  // with one voicing the reader cannot read on its last line.
  const LINES = [
    '# Tide',
    '',
    '## Intro',
    '```',
    'Am  G',
    '```',
    '',
    '---',
    '',
    '## Voicings: G4 C4 E4 A4',
    '- Am: 2000',
    '- G: 1', // one fret for a four-string tuning — unreadable (§7.4)
  ];

  await startApp(page);
  await page.getByRole('button', { name: /Write a song/ }).click();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  // Enter the whole song in one insertText: keyboard.type with Enter keydowns
  // collapses the song to a single line on CodeMirror's Android input path (the
  // phone and tablet projects), so no voicing section parses.
  await page.keyboard.insertText(LINES.join('\n'));

  await page.getByRole('button', { name: 'Save' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Not saved.');
  await mockup(page, 'W04-edit-and-save', 4); // save stopped by an unreadable voicing
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await checkA11y();

  // Fix the last line to a readable four-fret shape; the stop clears and Save
  // goes through. Clicking Save moved focus to the button, so return to the
  // editor before the fixing keystrokes land.
  await content.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.type('- G: 0232');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); // the save sheet opens: the gate let it through
});

test('loading, editing and preview still work after an offline reload', async ({ page }, testInfo) => {
  await openExampleBook(page);
  await runOffline(page, {
    path: '/',
    async whileOffline(offlinePage) {
      await openSongInEditor(offlinePage, 'Morning', SONG_TITLE);
      await expect(offlinePage.locator('.cm-content')).toContainText(SONG_TITLE);
      if (testInfo.project.name === 'phone') {
        await offlinePage.getByRole('radio', { name: 'Preview' }).click();
      }
      await expect(offlinePage.locator('.chart')).toBeVisible();
      // An edit offline is accepted.
      await offlinePage.locator('.cm-content').click();
      await offlinePage.keyboard.press('Control+End');
      await offlinePage.keyboard.type('\noffline edit');
      await expect(offlinePage.locator('.cm-content')).toContainText('offline edit');
    },
  });
});
