// e2e-web — the header as drawn (shell.header_chrome) against the compose stack
// on phone, tablet and computer. The UI audit of 2026-10-14 found the chip
// spelling the full tuning and clipped by the account button on a phone, the
// phone shelf titled "Search" where the boards put the wordmark, and the
// computer's search rail beside a song without the wordmark or the chip (W01#1,
// W02#1, W02#4). This pins the fix: the header reads *Estante*, the one short
// chip (*Guitar*, its full tuning the accessible description) and *Account* on
// every destination, none of them clipped; and one chip per screen. Since
// shell.one_bar there is no rail: a song and the chord explorer each draw one
// bar ending with the chip, Help and the account, on every device. Pins
// workflow 1 §The instrument and workflow 15 §The roster, and switching (as
// amended). Real-UI journeys only; axe at WCAG 2.1 AA on every screen touched.

import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { startApp, gotoTab, openExampleBook, openSongFromSearch } from '../lib/journeys.js';
import { SONG, chip, addInstrument, closeInstruments, openExplorerFor, toSearch } from '../lib/journeys-core.js';

const STANDARD_DESCRIPTION = 'Guitar (6-string), Standard tuning: E2 A2 D3 G3 B3 E4';
// The boards' phone frame, inside its rim (lib/mockup.js SIZE.phone).
const PHONE_FRAME = { width: 370, height: 824 };

// The shell's header row: the phone's strip above every destination, or the
// tablet/computer top bar with the tabs (shell.one_bar).
const shellHeader = (page) => page.locator('.instr-top, .top-bar').filter({ visible: true });
const visibleChips = (page) => chip(page).filter({ visible: true });

// The wordmark, the chip and the account button lie inside the viewport, do
// not overlap, and the chip shows its label in full (not ellipsized).
async function expectUnclipped(page, header) {
  const viewport = page.viewportSize();
  const parts = [
    header.locator('.wordmark'),
    header.getByRole('button', { name: /change instrument/ }),
    header.getByRole('button', { name: 'Account', exact: true }),
  ];
  const boxes = [];
  for (const part of parts) {
    await expect(part).toBeVisible();
    const box = await part.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    boxes.push(box);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i], boxes[j]];
      const apart =
        a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5 || a.y + a.height <= b.y + 0.5 || b.y + b.height <= a.y + 0.5;
      expect(apart, `header parts ${i} and ${j} overlap`).toBe(true);
    }
  }
  const fits = await parts[1].evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(fits, 'the chip label is ellipsized').toBe(true);
}

// On the phone project, check the row again at the boards' 370 px frame.
async function expectUnclippedEverywhere(page, testInfo) {
  await expectUnclipped(page, shellHeader(page));
  if (testInfo.project.name !== 'phone') return;
  const before = page.viewportSize();
  await page.setViewportSize(PHONE_FRAME);
  try {
    await expectUnclipped(page, shellHeader(page));
  } finally {
    await page.setViewportSize(before);
  }
}

async function expectHeader(page, label) {
  const header = shellHeader(page);
  await expect(header.locator('.wordmark')).toHaveText('Estante');
  const headerChip = header.getByRole('button', { name: `${label}, change instrument` });
  await expect(headerChip).toHaveText(label);
  await expect(header.getByRole('button', { name: 'Account', exact: true })).toBeVisible();
  await expect(visibleChips(page)).toHaveCount(1);
  return headerChip;
}

test('the header on every destination: wordmark, a short unclipped chip, account', async ({ page, checkA11y }, testInfo) => {
  await startApp(page);

  // Cold start, on search: the wordmark row; the Search heading is still the
  // page's level-1 heading, for the outline, though the boards draw none.
  const headerChip = await expectHeader(page, 'Guitar');
  await expect(headerChip).toHaveAccessibleDescription(STANDARD_DESCRIPTION);
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeAttached();
  await expectUnclippedEverywhere(page, testInfo);
  await mockup(page, 'W01-first-run', 1);
  await checkA11y();

  // The same header above Books and Setlists.
  for (const destination of ['Books', 'Setlists']) {
    await gotoTab(page, destination);
    await expectHeader(page, 'Guitar');
    await expectUnclippedEverywhere(page, testInfo);
    await checkA11y();
  }

  // Typing a chord: the explore row names the instrument by the chip's label.
  await gotoTab(page, 'Search');
  await page.getByRole('searchbox').fill('A');
  await expect(page.getByRole('button', { name: /^Explore A on your Guitar/ })).toBeVisible();
  await mockup(page, 'W02-find-and-play', 1);
});

test('one bar, one chip: a song and the explorer end their bar with the chip and the account', async ({ page, checkA11y }, testInfo) => {
  const wide = testInfo.project.name !== 'phone';
  await openExampleBook(page);

  // A song open: no rail beside it on any device (shell.one_bar). On a tablet
  // or a computer the chip ends the reading bar, before Help and the account;
  // on the phone the chip sits in the song's meta row and the bar ends with
  // Help and the account.
  await openSongFromSearch(page, SONG.search, SONG.title);
  await expect(page.locator('.rail-head, .pane.side')).toHaveCount(0);
  await expect(visibleChips(page)).toHaveCount(1);
  await expect(visibleChips(page)).toHaveText('Guitar');
  const readingBar = page.locator('.appbar.reading-chrome').first();
  await expect(readingBar.getByRole('button', { name: 'Account', exact: true })).toBeVisible();
  if (wide) {
    await expect(readingBar.getByRole('button', { name: 'Guitar, change instrument' })).toBeVisible();
  }
  await expectBarInViewport(page, readingBar);
  await mockup(page, 'W02-find-and-play', 4);
  await checkA11y();

  // The chord explorer, opened from the search destination: one screen, its
  // one chip ending its app bar on a tablet or computer and beside the chord
  // field on the phone, the account at the bar's end on every device.
  await startApp(page);
  await toSearch(page);
  await openExplorerFor(page, 'A');
  await expect(page.locator('.rail-head, .pane.side')).toHaveCount(0);
  await expect(visibleChips(page)).toHaveCount(1);
  const explorerBar = page.locator('.explorer-screen .appbar');
  const chipHome = wide ? explorerBar : page.locator('.explorer-head');
  await expect(chipHome.getByRole('button', { name: /change instrument/ })).toBeVisible();
  await expect(explorerBar.getByRole('button', { name: 'Account', exact: true })).toBeVisible();
  await expectBarInViewport(page, explorerBar);
});

// Every control in a bar lies inside the viewport: the account at the bar's end
// is never pushed past the edge (shell.one_bar).
async function expectBarInViewport(page, bar) {
  const viewport = page.viewportSize();
  const buttons = bar.getByRole('button');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const box = await buttons.nth(i).boundingBox();
    if (!box) continue;
    expect(box.x, `bar control ${i} starts inside the viewport`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `bar control ${i} ends inside the viewport`).toBeLessThanOrEqual(viewport.width + 0.5);
  }
}

test('a guitar in Drop D reads "Guitar · Drop D", still unclipped', async ({ page, checkA11y }, testInfo) => {
  await startApp(page);
  await addInstrument(page, { tuning: 'Drop D', listed: 'Guitar (6-string) · Drop D' });
  await closeInstruments(page);

  const headerChip = await expectHeader(page, 'Guitar · Drop D');
  await expect(headerChip).toHaveAccessibleDescription('Guitar (6-string), Drop D tuning: D2 A2 D3 G3 B3 E4');
  await expectUnclippedEverywhere(page, testInfo);
  await checkA11y();
});
