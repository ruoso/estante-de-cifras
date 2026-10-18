import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// WCAG 2.1 AA, the same tag set the app's behavior-level axe matcher uses
// (app/src/a11y/axe.js) — re-declared here, not imported, because the app and
// the harness share no code (DIRECTION §3.6 line 288). A screen that passes a
// component test is held to the identical bar end to end (DIRECTION §3.7 line
// 426, "axe at WCAG 2.1 AA"; the standing accessibility rule).
export const WCAG_21_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Run axe over the current page at WCAG 2.1 AA and return its violations.
// AxeBuilder is axe's first-party Playwright integration: it injects axe into
// the page under test and analyses whatever DOM the page holds, regardless of
// origin — so it works on the served app shell and on an in-page fixture alike.
export async function analyzeWcag21aa(page) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_21_AA_TAGS)
    .analyze();
  return results.violations;
}

// The device colour scheme the page reports right now. Playwright has no
// getter for an emulated scheme, so it is read in the page — exact, and it keeps
// a spec that emulated dark itself on dark after the check (shell.palco_contrast
// Decision 4).
async function currentScheme(page) {
  const dark = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  return dark ? 'dark' : 'light';
}

// The theme the app root carries (`.est theme-<name>`), named for a report; a
// page with no app root (an in-page fixture) is named by its scheme's
// automatic theme.
async function themeLabel(page, scheme) {
  const applied = await page.evaluate(() => {
    const root = document.querySelector('.est');
    return /\btheme-(\w+)/.exec(root?.className ?? '')?.[1] ?? null;
  });
  const name = applied ?? (scheme === 'dark' ? 'palco' : 'estante');
  return `${name[0].toUpperCase()}${name.slice(1)} (${scheme})`;
}

// Let the automatic theme follow a scheme change: ThemeRoot's matchMedia
// subscription re-renders through useSyncExternalStore, and two animation
// frames see that render painted.
async function settle(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

// Run axe at WCAG 2.1 AA in both device-mode themes and return the union of
// violations, each labelled with the theme `.est` carried when it was found
// (shell.palco_contrast). The automatic theme is Estante on a light device and
// Palco on a dark one (workflow 1 §The theme), and it follows the device mode
// live, so the check runs on the scheme it finds, flips to the other, runs
// again, and restores the scheme it found. A spec that chose a theme explicitly
// sees that theme twice, which is what its user sees.
export async function analyzeBothThemes(page) {
  const found = await currentScheme(page);
  const other = found === 'dark' ? 'light' : 'dark';
  const violations = [];
  const pass = async (scheme) => {
    const theme = await themeLabel(page, scheme);
    for (const v of await analyzeWcag21aa(page)) violations.push({ ...v, theme });
  };
  await pass(found);
  await page.emulateMedia({ colorScheme: other });
  try {
    await settle(page);
    await pass(other);
  } finally {
    await page.emulateMedia({ colorScheme: found });
    await settle(page);
  }
  return violations;
}

// A readable report of what axe found: the rule id, impact, help text and the
// offending node(s) — status carried by a word, never colour (standing rule).
function describeViolations(violations) {
  return violations
    .map((v) => {
      const nodes = v.nodes.map((n) => n.target.join(' ')).join(', ');
      const theme = v.theme ? ` [${v.theme}]` : '';
      return `  ${v.id}${theme} (${v.impact ?? 'n/a'}): ${v.help} — at ${nodes}`;
    })
    .join('\n');
}

// The axe fixture. A spec that imports `test`/`expect` from here gets a
// `checkA11y()` that runs the WCAG 2.1 AA check on the current page, in Estante
// and in Palco (analyzeBothThemes), and fails the test on any violation,
// reporting each rule, the theme it was found in and the node — the one-line
// easy path every later screen's test takes. The fixture seam is held to AA so
// no screen's axe check is a silent no-op, in either theme.
export const test = base.extend({
  checkA11y: async ({ page }, use) => {
    const check = async () => {
      const violations = await analyzeBothThemes(page);
      expect(
        violations,
        violations.length
          ? `axe found ${violations.length} WCAG 2.1 AA violation(s):\n${describeViolations(violations)}`
          : undefined,
      ).toEqual([]);
      return violations;
    };
    await use(check);
  },
});

export { expect };
