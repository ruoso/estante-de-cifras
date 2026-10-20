// narrow-fit.spec.js (e2e-web) — nothing clipped, overflowing or wrapped word by
// word at phone, tablet and computer widths (shell.narrow_fit). Against the
// compose stack, on the phone/tablet/computer projects; each test drives one
// surface the UI audit of 2026-10-14 found misfit through the real UI, then
// asserts lib/fit.js's expectFits — the document never scrolls sideways, no
// visible element is wider than the viewport, every visible control is fully
// visible, the named labels are whole and the named sentences are never
// squeezed — and runs axe at WCAG 2.1 AA. Pins DIRECTION §4 and the boards
// W01, W02, W04, W06, W12, W14, W16 and W17 at these widths.

import { test, expect } from '../lib/axe.js';
import { expectFits, expectInsideViewport, overlaps } from '../lib/fit.js';
import {
  editFromReading,
  gotoTab,
  openExampleBook,
  openFileInFiles,
  openSongFromSearch,
  signedInDevice,
  startApp,
} from '../lib/journeys.js';
import { SONG, addInstrument, chip, closeInstruments, openExplorerFor } from '../lib/journeys-core.js';
import { buildHistory, openFirstVersion, openHistory } from '../lib/journeys-edit.js';
import { EXAMPLE_BOOK, addToNewSetlist, editSetlist, openSetlist } from '../lib/journeys-files.js';
import { openAccount } from '../lib/journeys-account.js';

const SONG_FILE = 'morning-on-the-porch.cifra.md';
// A setlist named for the purpose, long enough that its raw file's title line
// runs past the edge of the raw pane.
const LONG_SETLIST = 'A setlist with a name long enough to run past the edge of the raw pane';

const openSong = (page) => openSongFromSearch(page, SONG.search, SONG.title);
const isPhone = (testInfo) => testInfo.project.name === 'phone';

test('the search field: the typed text and its clear control share one row (W01, W02 search)', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await gotoTab(page, 'Search');
  const input = page.getByRole('searchbox');
  await input.fill('Morning');
  const clear = page.getByRole('button', { name: 'Clear search' });
  await expect(clear).toBeVisible();

  const inputBox = await input.boundingBox();
  const clearBox = await clear.boundingBox();
  const centre = (b) => b.y + b.height / 2;
  expect(Math.abs(centre(inputBox) - centre(clearBox)), 'the ✕ sits on the typed text’s row').toBeLessThanOrEqual(
    inputBox.height / 2,
  );
  expect(clearBox.x, 'the ✕ is to the right of the typed text').toBeGreaterThanOrEqual(inputBox.x + inputBox.width - 1);

  await expectFits(page, { whole: [input] });
  await checkA11y();
});

test('first run: the ways-in descriptions are whole, never ellipsized (W01#1)', async ({ page, checkA11y }) => {
  await startApp(page);
  await expect(page.getByRole('button', { name: /Open the example book/ })).toBeVisible();
  const descriptions = page.locator('.first-run-ways .meta');
  await expect(descriptions).toHaveCount(4);
  await expectFits(page, { whole: [descriptions] });
  await checkA11y();
});

test('the reading notices read as sentences, their actions fully visible (W02 phone, workflow 2)', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await openSong(page);
  // The first-open instrument prompt.
  const prompt = page.getByText('Playing on guitar — change?');
  await expect(prompt).toBeVisible();
  await expectFits(page, { sentences: [prompt] });
  await checkA11y();

  // A tuning no example song carries: the no-voicings notice and its arrange
  // offer (explorer.spec's route to it).
  await addInstrument(page, { tuning: 'Drop D', name: 'My Drop D' });
  await closeInstruments(page);
  await openSong(page);
  const noVoicings = page.getByText(/^Nobody has chosen shapes for My Drop D/);
  await expect(noVoicings).toBeVisible();
  await expect(page.getByRole('button', { name: 'Arrange for My Drop D' })).toBeVisible();
  await expectFits(page, { sentences: [noVoicings] });
  await checkA11y();
});

test('the explorer: its title and the chip are whole, the chip clear of the wordmark and Account (W16#1-2)', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await gotoTab(page, 'Search');
  await openExplorerFor(page, 'A');
  const title = page.getByText('Explore a chord', { exact: true });
  const headerChip = chip(page).filter({ visible: true });
  await expect(headerChip).toHaveCount(1);
  await expectFits(page, { whole: [title, headerChip] });

  // Where the chip shares the header row with the wordmark (and Account), it
  // overlaps neither.
  const row = page.locator('.header-chrome').filter({ has: headerChip });
  if (await row.count()) {
    const chipBox = await headerChip.boundingBox();
    const neighbours = [row.locator('.wordmark'), row.getByRole('button', { name: 'Account', exact: true })];
    for (const neighbour of neighbours) {
      if (!(await neighbour.count())) continue;
      expect(overlaps(chipBox, await neighbour.boundingBox()), 'the chip overlaps its header neighbour').toBe(false);
    }
  }
  await checkA11y();
});

test('the raw editor from the file view: Save and Add section in reach (W14#2)', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openFileInFiles(page, EXAMPLE_BOOK, SONG_FILE);
  await expect(page.locator('.cm-content')).toBeVisible();
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await expect(page.getByRole('button', { name: 'Add section' })).toBeVisible();
  await expect(save).toBeInViewport({ ratio: 1 });
  await expectFits(page);
  await checkA11y();
});

test('the raw editor from Edit: Save and Add section in reach (W04 phone toolbar)', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openSong(page);
  await editFromReading(page);
  const save = page.getByRole('button', { name: 'Save', exact: true }).first();
  await expect(page.getByRole('button', { name: 'Add section' })).toBeVisible();
  await expect(save).toBeInViewport({ ratio: 1 });
  await expectFits(page);
  await checkA11y();
});

test('the version view: the version title is whole beside its actions (W06#2, W06#4)', async ({
  page,
  checkA11y,
}) => {
  test.setTimeout(60000);
  await buildHistory(page, ['Coda']);
  await openHistory(page);
  await openFirstVersion(page);
  await expectFits(page, { whole: [page.locator('.est-history-appbar .title').filter({ visible: true })] });
  await checkA11y();
});

test('the reading toolbar: every action fully visible, Print reachable (W02#2-4, W12 tablet)', async ({
  page,
  checkA11y,
}, testInfo) => {
  await openExampleBook(page);
  await openSong(page);
  await expectFits(page);
  await checkA11y();

  if (testInfo.project.name === 'computer') {
    // The W02 computer row: Print in the appbar.
    await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeInViewport({ ratio: 1 });
  } else {
    // Phone and tablet: Print is a ⋯ item (not activated — no print dialog).
    await page.getByRole('button', { name: 'More', exact: true }).first().click();
    await expect(page.getByRole('menuitem', { name: 'Print', exact: true })).toBeVisible();
    await expectFits(page);
    await checkA11y();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'Print', exact: true })).toBeHidden();
  }
});

test('the setlist raw pane scrolls sideways inside itself to a long line’s end (W12#4 side pane)', async ({
  page,
  checkA11y,
}, testInfo) => {
  test.setTimeout(60000);
  await openExampleBook(page);
  await addToNewSetlist(page, SONG.search, SONG.title, LONG_SETLIST);
  await openSetlist(page, LONG_SETLIST);
  await expectFits(page);
  await checkA11y();
  // The raw pane is the wide editor's side pane; the phone does not show it.
  if (isPhone(testInfo)) return;

  await editSetlist(page);
  const raw = page.locator('.setlist-raw');
  await expect(raw).toBeVisible();
  await expectFits(page);
  await checkA11y();

  const scrolled = await raw.evaluate(async (el) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const overflow = el.scrollWidth - el.clientWidth;
    // The longest line, and where its last character ends.
    const lines = [...el.querySelectorAll('.ln')];
    const longest = lines.reduce((a, b) => ((b.textContent?.length ?? 0) > (a.textContent?.length ?? 0) ? b : a));
    const endOf = () => {
      const range = document.createRange();
      range.selectNodeContents(longest);
      const rects = range.getClientRects();
      return rects[rects.length - 1].right;
    };
    el.scrollLeft = 0;
    await frame();
    const before = el.scrollLeft;
    el.scrollLeft = el.scrollWidth;
    await frame();
    const box = el.getBoundingClientRect();
    return { overflow, before, after: el.scrollLeft, endInPane: endOf() <= box.right + 1 && endOf() > box.left };
  });
  expect(scrolled.overflow, 'the long line overflows the raw pane').toBeGreaterThan(1);
  expect(scrolled.after, 'the raw pane scrolls sideways').toBeGreaterThan(scrolled.before);
  expect(scrolled.endInPane, 'scrolled to its end, the long line’s last character is in the pane').toBe(true);
  // Nothing outside the pane moved with it.
  await expectFits(page);
});

test('Leaving Estante: the region and both its buttons lie inside the viewport (W17#1)', async ({
  page,
  checkA11y,
}) => {
  await signedInDevice(page);
  await openAccount(page);
  const card = page.locator('.account-leave-card');
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByText('Leaving Estante', { exact: true })).toBeVisible();
  await expectInsideViewport(page, card, 'the Leaving Estante region');
  for (const name of ['Take your data out', 'Delete my account']) {
    const button = card.getByRole('button', { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await expectInsideViewport(page, button, `"${name}"`);
  }
  await expectFits(page);
  await checkA11y();
});
