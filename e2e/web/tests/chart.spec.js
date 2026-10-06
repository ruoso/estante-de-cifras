import { test, expect } from '../lib/axe.js';

// e2e-web (shell.chart) — the chart in a real browser, on the phone, tablet and
// computer projects (the config runs every spec on all three). It drives the
// hash-gated dev gallery (`#dev/chart`), the chart's e2e mount point before any
// song screen exists, which draws four written-for-purpose charts (plain,
// all-defaults, a conflicted line, arrange mode).
//
// For each chart it asserts no horizontal overflow — the proportional face
// wraps, it never scrolls sideways (mockups README line 24, GUIDE line 25) — and
// the axe fixture (WCAG 2.1 AA; color-contrast runs here, the check jsdom
// cannot) is clean, in Estante light and Palco dark so contrast is held on
// every theme. Pins the .tji note ("a chart on the three viewports without
// horizontal overflow, axe") and the density/size tokens (theme.css lines
// 113-115, 22).

const THEMES = [
  { name: 'Estante (light)', scheme: 'light', cls: /theme-estante/ },
  { name: 'Palco (dark)', scheme: 'dark', cls: /theme-palco/ },
];

test('the dev gallery charts wrap without horizontal overflow, axe-clean on each theme', async ({
  page,
  checkA11y,
}) => {
  for (const theme of THEMES) {
    await page.emulateMedia({ colorScheme: theme.scheme });
    await page.goto('/#dev/chart');

    // The gallery mounts under the resolved theme root.
    await expect(page.locator('.est')).toHaveClass(theme.cls);

    const charts = page.locator('.chart');
    const count = await charts.count();
    expect(count, 'four gallery charts are drawn').toBeGreaterThanOrEqual(4);

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
});
