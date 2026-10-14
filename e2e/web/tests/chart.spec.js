import { test, expect } from '../lib/axe.js';
import { startApp, openSongFromSearch } from '../lib/journeys.js';
import { writeChartSong, CHART_TITLE, LONG_LINE_SONG } from '../lib/journeys-account.js';

// e2e-web (shell.chart) — the chart in a real browser, on the phone, tablet and
// computer projects (the config runs every spec on all three). A purpose-written
// song is written through the editor (workflow 3), then read the way a person
// reads it: search -> song -> the reading view's chart. That chart (sung lines
// with a split word, a long lyric line, a bar-lined chord line and a run of
// chords) is checked for no horizontal overflow — the proportional face wraps,
// it never scrolls sideways (mockups README line 24, GUIDE line 25) — and the
// axe fixture (WCAG 2.1 AA; color-contrast runs here, the check jsdom cannot)
// is clean, in Estante light and Palco dark so contrast is held on every theme.
// Pins the .tji note ("a chart on the three viewports without horizontal
// overflow, axe") and the density/size tokens (theme.css lines 113-115, 22).

const THEMES = [
  { name: 'Estante (light)', scheme: 'light', cls: /theme-estante/ },
  { name: 'Palco (dark)', scheme: 'dark', cls: /theme-palco/ },
];

async function expectChartWraps(page, checkA11y, lines) {
  await writeChartSong(page, lines);

  for (const theme of THEMES) {
    await page.emulateMedia({ colorScheme: theme.scheme });
    await startApp(page);
    await openSongFromSearch(page, 'Gallery', CHART_TITLE);

    // The reading view mounts under the resolved theme root.
    await expect(page.locator('.est').first()).toHaveClass(theme.cls);

    const charts = page.locator('.chart');
    const count = await charts.count();
    expect(count, 'the song’s chart is drawn').toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      // The chart wraps within its box: its content is no wider than its own
      // client box (a 1px tolerance for sub-pixel rounding).
      const overflow = await charts.nth(i).evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `chart ${i} overflows horizontally in ${theme.name}`).toBeLessThanOrEqual(1);
    }

    // And the page itself has no horizontal scroll on this viewport.
    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(pageOverflow, `the page scrolls sideways in ${theme.name}`).toBeLessThanOrEqual(1);

    await checkA11y();
  }
}

test('a song’s chart wraps without horizontal overflow, axe-clean on each theme', async ({
  page,
  checkA11y,
}) => {
  await expectChartWraps(page, checkA11y);
});

// A long run of words under one chord wraps inside its segment (theme.css
// .chart .s / .w) instead of pushing the chart wider than the screen.
test('a long sung line wraps without horizontal overflow, axe-clean on each theme', async ({
  page,
  checkA11y,
}) => {
  await expectChartWraps(page, checkA11y, LONG_LINE_SONG);
});
