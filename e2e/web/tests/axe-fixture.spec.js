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

// shell.palco_contrast — the fixture holds every screen to AA in Palco as well
// as Estante: it flips the device scheme (the automatic theme follows it live,
// workflow 1 §The theme), axes again and restores the scheme it found. This page
// is readable on a light device and unreadable on a dark one, so only the dark
// (Palco) pass can catch it. The words are written for this test.
const darkOnlyFaultHtml = `<!doctype html>
<html lang="en">
  <head>
    <title>A page that fails only in the dark</title>
    <style>
      body { background: #ffffff; color: #111111; }
      @media (prefers-color-scheme: dark) {
        body { background: #181b1f; color: #2a2e33; }
      }
    </style>
  </head>
  <body>
    <main><p>Twelve bars and a turnaround, written for this check.</p></main>
  </body>
</html>`;

const isDark = (page) => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);

test('the axe fixture catches a violation only Palco shows', async ({ page, checkA11y }) => {
  await page.setContent(darkOnlyFaultHtml);
  expect(await isDark(page)).toBe(false);

  // The Estante (light) pass alone is clean…
  expect(await analyzeWcag21aa(page)).toEqual([]);

  // …and the fixture still fails, naming the rule and the dark theme.
  await expect(checkA11y()).rejects.toThrow(/color-contrast \[Palco \(dark\)\]/);
});

test('the axe fixture restores the colour scheme it found', async ({ page, checkA11y }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();

  expect(await isDark(page)).toBe(false);
  await checkA11y();
  expect(await isDark(page)).toBe(false);

  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await isDark(page)).toBe(true);
  await checkA11y();
  expect(await isDark(page)).toBe(true);
});
