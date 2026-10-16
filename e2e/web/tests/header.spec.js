// e2e-web — the header as drawn (shell.header_chrome) against the compose stack
// on phone, tablet and computer. The UI audit of 2026-10-14 found the chip
// spelling the full tuning and clipped by the account button on a phone, the
// phone shelf titled "Search" where the boards put the wordmark, and the
// computer's search rail beside a song without the wordmark or the chip (W01#1,
// W02#1, W02#4). This pins the fix: the header reads *Estante*, the one short
// chip (*Guitar*, its full tuning the accessible description) and *Account* on
// every destination, none of them clipped; the rail beside a song or the chord
// explorer carries the wordmark and the chip; and one chip per screen. Pins
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
// tablet/computer side header.
const shellHeader = (page) => page.locator('.instr-top, .side-head').filter({ visible: true });
const visibleChips = (page) => chip(page).filter({ visible: true });

// The wordmark, the chip and the account button lie inside the viewport, do
// not overlap, and the chip shows its label in full (not ellipsized).
async function expectUnclipped(page, header) {
  const viewport = page.viewportSize();
  const parts = [
    header.locator('.wordmark'),
    header.getByRole('button', { name: /change instrument/ }),
    header.getByRole('button', { name: 'Account' }),
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
  await expect(header.getByRole('button', { name: 'Account' })).toBeVisible();
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

test('one chip per screen: the rail beside a song and beside the explorer', async ({ page, checkA11y }, testInfo) => {
  const wide = testInfo.project.name !== 'phone';
  await openExampleBook(page);

  // A song open: on the computer the search rail beside it is headed by the
  // wordmark and the chip; the tablet reads without a rail, the chip in the
  // reading app bar (W02#3, songs.reading_chrome Decision 1); on the phone the
  // chip sits in the song's meta row.
  await openSongFromSearch(page, SONG.search, SONG.title);
  await expect(visibleChips(page)).toHaveCount(1);
  await expect(visibleChips(page)).toHaveText('Guitar');
  if (testInfo.project.name === 'computer') {
    const head = page.locator('.reading-side .rail-head');
    await expect(head.locator('.wordmark')).toHaveText('Estante');
    await expect(head.getByRole('button', { name: 'Guitar, change instrument' })).toBeVisible();
  } else if (testInfo.project.name === 'tablet') {
    await expect(page.locator('.rail-head')).toHaveCount(0);
    await expect(
      page.locator('.appbar.reading-chrome').getByRole('button', { name: 'Guitar, change instrument' }),
    ).toBeVisible();
  }
  await mockup(page, 'W02-find-and-play', 4);
  await checkA11y();

  // The chord explorer, opened from the search destination: one chip, at the
  // rail head on wide, in its app bar on the phone.
  await startApp(page);
  await toSearch(page);
  await openExplorerFor(page, 'A');
  await expect(visibleChips(page)).toHaveCount(1);
  if (wide) {
    await expect(page.locator('.explorer-side .rail-head').getByRole('button', { name: /change instrument/ })).toBeVisible();
  }
});

test('a guitar in Drop D reads "Guitar · Drop D", still unclipped', async ({ page, checkA11y }, testInfo) => {
  await startApp(page);
  await addInstrument(page, { tuning: 'Drop D', listed: 'Guitar (6-string) · Drop D' });
  await closeInstruments(page);

  const headerChip = await expectHeader(page, 'Guitar · Drop D');
  await expect(headerChip).toHaveAccessibleDescription('Guitar (6-string), Drop D tuning: D2 A2 D3 G3 B3 E4');
  await expectUnclippedEverywhere(page, testInfo);
  await checkA11y();
});
