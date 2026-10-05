/**
 * e2e-web — the app loads at the one origin on all three viewports, and the
 * axe fixture finds zero WCAG 2.1 AA violations on the served shell.
 *
 * No project-level testMatch filter, so this runs on phone, tablet and computer
 * (playwright.config.js), proving the app loads on each viewport and is
 * accessible on each. Pins DIRECTION §3.6 lines 386–392 (end-to-end against the
 * one origin), §3.7 lines 399/426 (three viewports; axe at AA),
 * service.serve_app's `/` → app shell, and the .tji note's "the app loads at
 * the origin on all three viewports" and the clean half of "the axe fixture
 * passes a clean page".
 */
import { test, expect } from '../lib/axe.js';

test('the app shell loads at the origin and passes WCAG 2.1 AA', async ({
  page,
  checkA11y,
}) => {
  await page.goto('/');

  // Stable landmarks the served shell renders (app/src/App.jsx): the document
  // title, the main landmark and its level-1 heading.
  await expect(page).toHaveTitle(/Estante de Cifras/);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Estante de Cifras' }),
  ).toBeVisible();

  // The clean half of the axe seam: zero WCAG 2.1 AA violations on the shell.
  await checkA11y();
});
