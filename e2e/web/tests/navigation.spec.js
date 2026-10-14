/**
 * e2e-web — the navigation shell (shell.layout) on all three viewports. Each of
 * phone (Pixel 7), tablet (Galaxy Tab S4) and computer (Desktop Chrome) runs
 * this spec (no project testMatch filter, playwright.config.js), so each proves:
 * the app loads at the one origin, the drawn per-viewport layout is the phone
 * tab bar below the breakpoint and the sidebar + detail split above it, the
 * three destinations Search · Books · Setlists are each reached and their
 * region/heading shown, and the axe fixture is clean on each destination — with
 * contrast actually running here in a real browser (the jsdom scope note).
 *
 * Pins the .tji note ("Search, Books and Setlists reached on phone, tablet and
 * computer, axe on each"), DIRECTION §4 lines 430-435, and the drawn layout
 * (docs/mockups/GUIDE.md line 34). The destination switcher is RAC Tabs, so each
 * destination is a `tab` with its visible label as accessible name on every
 * viewport, reached the same way (tap the tab bar / activate the sidebar rail).
 */
import { test, expect } from '../lib/axe.js';

const DESTINATIONS = ['Search', 'Books', 'Setlists'];
// The shell's layout breakpoint (app/src/shell/layout-mode.js): phone (Pixel 7,
// 412px) → the tab bar; tablet (Galaxy Tab S4, 712px) and computer (1280px) →
// the split. Re-declared here, not imported, because the app and the harness
// share no code (DIRECTION §3.6 line 288).
const WIDE_BREAKPOINT = 600;

test('each destination is reached and axe-clean on this viewport', async ({
  page,
  checkA11y,
}) => {
  await page.goto('/');

  // The drawn layout for this viewport: the phone tab bar below the breakpoint,
  // the sidebar + detail split above it (GUIDE.md 34; the two-layouts Decision).
  await expect(page.getByRole('main')).toBeVisible();
  const width = page.viewportSize().width;
  if (width < WIDE_BREAKPOINT) {
    await expect(page.locator('.tabbar')).toBeVisible();
    await expect(page.locator('.split')).toHaveCount(0);
  } else {
    await expect(page.locator('.split')).toBeVisible();
    await expect(page.locator('.tabbar')).toHaveCount(0);
  }

  // Each destination is reached, its region/heading shown, and axe is clean
  // there (WCAG 2.1 AA, contrast included in a real browser).
  for (const name of DESTINATIONS) {
    await page.getByRole('tab', { name }).click();
    await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await checkA11y();
  }
});

test('the destinations are reachable by keyboard', async ({ page }) => {
  await page.goto('/');

  // Focus the first destination and move with the keyboard: RAC's roving
  // tabindex takes End to the last destination and selection follows focus.
  await page.getByRole('tab', { name: 'Search' }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Setlists' })).toBeFocused();
  await expect(page.getByRole('heading', { level: 1, name: 'Setlists' })).toBeVisible();
  // The Setlists destination now renders the real list surface (books.setlists),
  // no longer a bare heading: with no book on the device it shows the empty
  // state rather than nothing below the heading.
  await expect(page.getByText(/No setlists yet/)).toBeVisible();
});
