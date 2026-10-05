import { test, expect } from '../lib/axe.js';

// e2e-web (shell.tokens) — the shell under the automatic theme on the three
// viewports (phone/tablet/computer via the config projects). With no chosen
// theme the app follows the device's light/dark mode: Estante in light, Palco
// in dark (Workflow 1 L94-103), switching live as the device mode changes.
// A computed-style assertion confirms theme.css cascades (the page background
// is Estante's #F3F4F1 / Palco's #0F1113), and the axe fixture (WCAG 2.1 AA —
// color-contrast runs here in a real browser, the check jsdom cannot do) is
// clean on each. Pins the .tji note ("the shell in Estante light and Palco dark
// on the three viewports, axe") and contrast at AA.

// The drawn --bg of each theme (docs/mockups/theme.css), as the browser reports
// a resolved background-color.
const ESTANTE_BG = 'rgb(243, 244, 241)'; // #F3F4F1
const PALCO_BG = 'rgb(15, 17, 19)'; // #0F1113

function rootBackground(page) {
  return page
    .locator('.est')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
}

test('automatic theme follows the device light/dark mode, axe-clean on each', async ({
  page,
  checkA11y,
}) => {
  // Device in light mode → Estante.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');

  const root = page.locator('.est');
  await expect(root).toHaveClass(/theme-estante/);
  await expect(root).toHaveClass(/density-comfortable/);
  expect(await rootBackground(page)).toBe(ESTANTE_BG);
  await checkA11y();

  // The device switches to dark → Palco, live, no reload.
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveClass(/theme-palco/);
  expect(await rootBackground(page)).toBe(PALCO_BG);
  await checkA11y();
});
