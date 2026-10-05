/**
 * e2e-web — the axe seam both passes a clean page and actually catches a real
 * WCAG 2.1 AA violation, so no later screen's axe check is a silent no-op.
 *
 * Pins DIRECTION §3.7 line 426 ("axe at WCAG 2.1 AA") and the .tji note's "the
 * axe fixture passes a clean page and fails a fixture page with a planted
 * violation". The negative case is wrapped so a detected violation is the
 * expected outcome, not a red test.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { test, expect, analyzeWcag21aa } from '../lib/axe.js';

const violationHtml = readFileSync(
  fileURLToPath(new URL('../fixtures/violation.html', import.meta.url)),
  'utf8',
);

test('the axe fixture passes on the clean served shell', async ({
  page,
  checkA11y,
}) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await checkA11y();
});

test('the axe fixture catches a planted WCAG 2.1 AA violation', async ({
  page,
  checkA11y,
}) => {
  await page.setContent(violationHtml);

  // The planted fault is real and WCAG 2.1 AA: axe reports the image with no
  // text alternative (image-alt, tag wcag2a).
  const violations = await analyzeWcag21aa(page);
  expect(violations.map((v) => v.id)).toContain('image-alt');

  // And the fixture every screen uses fails on it — the negative case wrapped
  // so the detected violation is the expected outcome, not a failing test.
  await expect(checkA11y()).rejects.toThrow();
});
