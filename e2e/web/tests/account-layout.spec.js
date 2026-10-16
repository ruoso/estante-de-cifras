// account-layout (e2e-web) — the account screen as drawn, against the compose
// stack (account.preferences_layout; workflow 13 §The account screen, as
// amended; mockup Theme-picker #1-4 and W13-new-device #4). On the phone, tablet
// and computer projects, with axe at WCAG 2.1 AA on each state:
//
//   (1) Theme rows are compact, not signed in — each theme row's swatch is the
//       board's 52x40 (phone) or 60x44 (tablet, computer) and its row is the
//       swatch plus the row's padding, not a window-high frame (the UI audit's
//       ~850px rows).
//   (2) The same in Palco and Roomy — the defect is not theme-dependent.
//   (3) Signed in, the layout — one "Sign out of this device", with who is signed
//       in; on a computer a left rail beside Preferences in two columns (Theme |
//       Density, Chord diagrams | Language) with devices below; on a phone and a
//       tablet one column, Preferences first.
//
// Real-UI journeys only (lib/journeys.js, lib/journeys-account.js) and the fit
// helpers (lib/fit.js); the boxes are measured, the structure behind them is
// pinned at the behavior level (AccountScreen.behavior.test.jsx).

import { mockup } from '../lib/mockup.js';
import { test, expect } from '../lib/axe.js';
import { startApp, signedInDevice } from '../lib/journeys.js';
import { openAccount, closeAccount, chooseTheme, chooseDensity } from '../lib/journeys-account.js';
import { expectFits, overlaps } from '../lib/fit.js';

const THEMES = ['Automatic', 'Estante', 'Caderno', 'Palco'];
const TOL = 1;

// The board's swatch for this project: 52x40 on a phone, 60x44 wider up.
function drawnSwatch(project) {
  return project === 'phone' ? { width: 52, height: 40 } : { width: 60, height: 44 };
}

// Each Theme row's swatch (the decorative box inside the radio's label) and the
// row (the label) measure as drawn; the whole Theme list is a short list.
async function expectCompactThemeRows(page, project) {
  const group = page.getByRole('radiogroup', { name: 'Theme' });
  const drawn = drawnSwatch(project);
  for (const name of THEMES) {
    const label = group.getByRole('radio', { name: new RegExp(`^${name}`) }).locator('xpath=ancestor::label[1]');
    const swatch = label.locator(':scope > [aria-hidden="true"]');
    await label.scrollIntoViewIfNeeded();
    const s = await swatch.boundingBox();
    const row = await label.boundingBox();
    expect(s, `${name} swatch has no box`).not.toBeNull();
    expect(Math.abs(s.width - drawn.width), `${name} swatch width ${s.width}`).toBeLessThanOrEqual(TOL);
    expect(Math.abs(s.height - drawn.height), `${name} swatch height ${s.height}`).toBeLessThanOrEqual(TOL);
    expect(row.height, `${name} row is ${row.height}px tall`).toBeLessThan(drawn.height + 40);
  }
  const list = await group.boundingBox();
  expect(list.height, `the Theme list is ${list.height}px tall`).toBeLessThan(400);
}

test('theme rows are compact, not signed in (Theme-picker #1/#3/#4)', async ({ page, checkA11y }, testInfo) => {
  const project = testInfo.project.name;
  await startApp(page);
  await openAccount(page);

  await expectCompactThemeRows(page, project);
  await expectFits(page);

  await mockup(page, 'Theme-picker', 1, { note: 'compact theme rows, not signed in' });
  await mockup(page, 'Theme-picker', 3, { note: 'compact theme rows, not signed in' });
  await mockup(page, 'Theme-picker', 4, { note: 'compact theme rows, not signed in' });
  await checkA11y();
});

test('theme rows stay compact in Palco and Roomy (Theme-picker #2)', async ({ page, checkA11y }, testInfo) => {
  const project = testInfo.project.name;
  await startApp(page);
  await chooseTheme(page, 'Palco');
  await openAccount(page);
  await chooseDensity(page, 'Roomy');
  await closeAccount(page);
  await openAccount(page);

  await expect(page.locator('div.est').first()).toHaveClass(/theme-palco/);
  await expect(page.locator('div.est').first()).toHaveClass(/density-roomy/);
  await expectCompactThemeRows(page, project);
  await expectFits(page);

  await mockup(page, 'Theme-picker', 2, { note: 'Palco, Roomy' });
  await checkA11y(); // Palco contrast on the swatches and the Selected badge
});

test('signed in: sign-out beside who is signed in; two columns on a computer, one on a phone and tablet', async ({
  page,
  checkA11y,
}, testInfo) => {
  const project = testInfo.project.name;
  await signedInDevice(page);
  await openAccount(page);

  const status = page.getByText('Signed in on this device');
  await expect(status).toBeVisible();
  await expect(page.getByText('Signed-in devices')).toBeVisible();

  // One sign-out of this device on every viewport, inside the viewport and within
  // the identity block's vertical extent (the innermost box holding both).
  const signOut = page.getByRole('button', { name: 'Sign out of this device' });
  await expect(signOut).toHaveCount(1);
  await signOut.scrollIntoViewIfNeeded();
  await expect(signOut).toBeVisible();
  const vp = page.viewportSize();
  const b = await signOut.boundingBox();
  expect(b.x >= -TOL && b.y >= -TOL && b.x + b.width <= vp.width + TOL && b.y + b.height <= vp.height + TOL).toBe(true);
  const identity = page.locator('div').filter({ has: status }).filter({ has: signOut }).last();
  const id = await identity.boundingBox();
  expect(b.y).toBeGreaterThanOrEqual(id.y - TOL);
  expect(b.y + b.height).toBeLessThanOrEqual(id.y + id.height + TOL);
  await expectFits(page);

  const box = (name) => page.getByRole('radiogroup', { name }).boundingBox();

  if (project === 'computer') {
    // The rail: sign-out and who is signed in sit left of the Theme picker.
    const theme = await box('Theme');
    const statusBox = await status.boundingBox();
    expect(b.x + b.width).toBeLessThanOrEqual(theme.x + TOL);
    expect(statusBox.x + statusBox.width).toBeLessThanOrEqual(theme.x + TOL);

    // Theme beside Density, Chord diagrams beside Language (Theme-picker #4).
    const density = await box('Density');
    expect(Math.abs(theme.y - density.y)).toBeLessThanOrEqual(4);
    expect(overlaps(theme, density)).toBe(false);
    const hand = await box('Hand');
    const language = await box('Language');
    const diagramsHead = await page.getByText('Chord diagrams', { exact: true }).boundingBox();
    const languageHead = await page.getByText('Language', { exact: true }).boundingBox();
    expect(Math.abs(diagramsHead.y - languageHead.y)).toBeLessThanOrEqual(4);
    expect(overlaps(hand, language)).toBe(false);
    expect(hand.x + hand.width).toBeLessThanOrEqual(language.x + TOL);

    // Devices full width below both preference rows.
    const devices = await page.getByText('Signed-in devices').boundingBox();
    const rowsBottom = Math.max(theme.y + theme.height, density.y + density.height, hand.y + hand.height, language.y + language.height);
    expect(devices.y).toBeGreaterThanOrEqual(rowsBottom - TOL);

    await mockup(page, 'Theme-picker', 4, { note: 'signed in, the computer split' });
    await mockup(page, 'W13-new-device', 4, { note: 'signed in, the computer split' });
  } else {
    // One column: Theme, Density and Language stacked, the identity below Language.
    const theme = await box('Theme');
    const density = await box('Density');
    const language = await box('Language');
    expect(density.y).toBeGreaterThanOrEqual(theme.y + theme.height - TOL);
    expect(language.y).toBeGreaterThanOrEqual(density.y + density.height - TOL);
    const idNow = await identity.boundingBox();
    const languageNow = await box('Language');
    expect(idNow.y).toBeGreaterThanOrEqual(languageNow.y + languageNow.height - TOL);

    await mockup(page, 'Theme-picker', 3, { note: 'signed in, one column' });
  }

  await checkA11y();
});
