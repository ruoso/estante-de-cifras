// editor split (e2e-web) — the editor shows text and preview side by side
// exactly when its own width is at least 640px, and Text | Preview with Help
// beside it otherwise, whatever the device (songs.editor_split_width; workflow
// 3 §The editor L78-84). On the phone, tablet and computer projects, at the
// project's own viewport, a phone turned sideways (844×390) and a narrow window
// on a computer (620×800, the shell in its wide layout with an editor under
// 640px), reached the way a person does: the example book, search, Edit. Axe at
// WCAG 2.1 AA in each arrangement.

import { test, expect } from '../lib/axe.js';
import { openExampleBook, openSongInEditor } from '../lib/journeys.js';

const SONG_TITLE = 'Morning on the Porch';
const SPLIT_MIN_WIDTH = 640;

// The rule, read off the editor's own body: under 640px the toggle (and the
// chart a tap away) with Help beside it; at 640px or more both panes and no
// toggle. Returns whether it split.
async function expectSplitByMeasure(page) {
  const body = page.locator('.est-editor-body');
  const width = await body.evaluate((el) => el.clientWidth);
  const preview = page.getByRole('radio', { name: 'Preview' });
  if (width < SPLIT_MIN_WIDTH) {
    await expect(preview, `the editor is ${width}px wide`).toBeVisible();
    await expect(page.locator('.est-editor-body.split')).toHaveCount(0);
    const help = page.locator('.est-editor-bar').getByRole('button', { name: 'Help', exact: true });
    await expect(help).toBeVisible();
    // Help sits beside the toggle, not with Add section.
    await expect(help).toHaveClass(/\bnarrow\b/);
    await expect(page.locator('.est-editor-bar-actions .est-editor-help')).toHaveCount(0);
    await preview.click();
    await expect(page.locator('.chart')).toBeVisible();
    await page.getByRole('radio', { name: 'Text' }).click();
    await expect(page.locator('.cm-content')).toBeVisible();
    return false;
  }
  await expect(page.locator('.est-editor-body.split'), `the editor is ${width}px wide`).toHaveCount(1);
  await expect(page.locator('.chart')).toBeVisible();
  await expect(page.locator('.cm-content')).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  return true;
}

async function openEditor(page) {
  await openExampleBook(page);
  await openSongInEditor(page, 'Morning', SONG_TITLE);
}

test('the project\'s own viewport: split exactly when the editor is 640px or wider, axe-clean', async ({
  page,
  checkA11y,
}, testInfo) => {
  await openEditor(page);
  const split = await expectSplitByMeasure(page);
  // The phone held upright (412px) is always Text | Preview.
  if (testInfo.project.name === 'phone') expect(split).toBe(false);
  await checkA11y();
});

test('a phone turned sideways (844×390): the editor follows its own width, axe-clean', async ({
  page,
  checkA11y,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'a phone turned sideways is the phone project');
  await page.setViewportSize({ width: 844, height: 390 });
  await openEditor(page);
  await expectSplitByMeasure(page);
  await checkA11y();
});

test('a narrow window on a computer (620×800): Text | Preview with Help, then the split back with the text kept', async ({
  page,
  checkA11y,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'computer', 'a narrow window on a computer is the computer project');
  await openEditor(page);
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('Control+End');
  const stamp = 'split-width-note';
  await page.keyboard.type(`\n${stamp}`);

  await page.setViewportSize({ width: 620, height: 800 });
  // The shell keeps its wide layout (≥ 600px) while the editor is under 640px.
  expect(await page.locator('.est-editor-body').evaluate((el) => el.clientWidth)).toBeLessThan(SPLIT_MIN_WIDTH);
  expect(await expectSplitByMeasure(page)).toBe(false);
  await expect(content).toContainText(stamp);
  await checkA11y();

  await page.setViewportSize({ width: 1280, height: 720 });
  expect(await expectSplitByMeasure(page)).toBe(true);
  await expect(content).toContainText(stamp);
});
