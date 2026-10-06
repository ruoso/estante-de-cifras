// editor (e2e-web) — the source editor against the compose stack, on the phone,
// tablet and computer projects (songs.editor). Opens a song from the bundled
// example book through the `#dev/editor` mount (the on-device seam the editor's
// hosts are not wired to yet, Decision 6): editing by keyboard and touch that
// survives a reload (workflow 4 §Editing), the preview beside on a wide screen
// and a tap away on the phone (workflow 3 L78-79), pasting a cifra into a fence
// with an Undo (workflow 3 L87-95), a voicing the reader cannot read stopping
// the save (workflow 4 §Normalising), and all of it working offline
// (offline-first; DIRECTION §3.4). Axe runs at WCAG 2.1 AA on the editor on
// every viewport. A fresh Playwright context is a first visit — the shelf and
// IndexedDB start empty, so each test seeds the example book first.

import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';

const SONG_PATH = 'morning-on-the-porch.cifra.md';
const SONG_TITLE = 'Morning on the Porch';
const editorUrl = (p) => `/#dev/editor?book=local-example-book&path=${encodeURIComponent(p)}`;

// Put the example book on the device (first-run), wait until a song is indexed,
// then open the editor on it and confirm the working-copy text loaded.
async function seedAndOpen(page, songPath = SONG_PATH) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Open the example book/ }).click();
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByText(SONG_TITLE)).toBeVisible();
  await page.goto(editorUrl(songPath));
  await expect(page.locator('.cm-content')).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText(SONG_TITLE);
}

test('an edit typed by keyboard or touch persists across a reload, axe-clean on this viewport', async ({
  page,
  checkA11y,
}, testInfo) => {
  await seedAndOpen(page);
  const content = page.locator('.cm-content');
  // Touch on the phone and tablet, the keyboard on the computer — both reach it.
  if (testInfo.project.use.hasTouch) await content.tap();
  else await content.click();
  await page.keyboard.press('Control+End');
  const stamp = `porch-note-${testInfo.project.name}`;
  await page.keyboard.type(`\n${stamp}`);

  await checkA11y();

  // The debounced WRITE persists the edit locally; a reload of the mount reads
  // it straight back from the working copy.
  await page.waitForTimeout(800);
  await page.goto(editorUrl(SONG_PATH));
  await expect(page.locator('.cm-content')).toBeVisible();
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+End');
  await expect(page.locator('.cm-content')).toContainText(stamp);
});

test('the preview sits beside the text on a wide screen and a tap away on the phone', async ({
  page,
}, testInfo) => {
  await seedAndOpen(page);
  if (testInfo.project.name === 'phone') {
    await expect(page.locator('.chart')).toHaveCount(0);
    await page.getByRole('radio', { name: 'Preview' }).click();
    await expect(page.locator('.chart')).toBeVisible();
  } else {
    await expect(page.locator('.chart')).toBeVisible();
  }
});

test('pasting a cifra outside a fence wraps it in a fence, with an Undo', async ({ page, checkA11y }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#dev/editor?new=1');
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  // Past the template's closing fence, so the paste lands outside any fence.
  await page.keyboard.press('Control+End');
  await page.evaluate((text) => navigator.clipboard.writeText(text), 'Verse one\nAm  G  F  E7\na line of words');
  await page.keyboard.press('Control+v');

  await expect(page.getByRole('status')).toBeVisible();
  await expect(content).toContainText('```');
  await checkA11y();

  const undo = page.getByRole('button', { name: 'Undo' });
  await undo.click();
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
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

  await page.goto('/#dev/editor?new=1');
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  // Enter the whole song in one insertText. keyboard.type with Enter keydowns
  // forms the newlines on the desktop input path, but NOT on CodeMirror's
  // Android input reading — the phone and tablet projects carry a mobile
  // user-agent, where the keydowns collapse the song to a single line so no
  // voicing section parses and the save-gate never fires. insertText drives the
  // DOM `insertText` input event CodeMirror applies the same on both paths, so
  // the multi-line voicing section the save-gate reads forms on every viewport.
  await page.keyboard.insertText(LINES.join('\n'));

  await page.getByRole('button', { name: 'Save' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Not saved.');
  await expect(page.getByText('Ready to save.')).toHaveCount(0);
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
  await expect(page.getByText('Ready to save.')).toBeVisible();
});

test('loading, editing and preview still work after an offline reload', async ({ page }, testInfo) => {
  await seedAndOpen(page);
  await runOffline(page, {
    path: editorUrl(SONG_PATH),
    async whileOffline(offlinePage) {
      await expect(offlinePage.locator('.cm-content')).toBeVisible();
      await expect(offlinePage.locator('.cm-content')).toContainText(SONG_TITLE);
      if (testInfo.project.name === 'phone') {
        await offlinePage.getByRole('radio', { name: 'Preview' }).click();
      }
      await expect(offlinePage.locator('.chart')).toBeVisible();
      // An edit offline is accepted and persisted locally.
      await offlinePage.locator('.cm-content').click();
      await offlinePage.keyboard.press('Control+End');
      await offlinePage.keyboard.type('\noffline edit');
      await expect(offlinePage.locator('.cm-content')).toContainText('offline edit');
    },
  });
});
