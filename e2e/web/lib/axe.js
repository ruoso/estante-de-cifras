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

// A readable report of what axe found: the rule id, impact, help text and the
// offending node(s) — status carried by a word, never colour (standing rule).
function describeViolations(violations) {
  return violations
    .map((v) => {
      const nodes = v.nodes.map((n) => n.target.join(' ')).join(', ');
      return `  ${v.id} (${v.impact ?? 'n/a'}): ${v.help} — at ${nodes}`;
    })
    .join('\n');
}

// The axe fixture. A spec that imports `test`/`expect` from here gets a
// `checkA11y()` that runs the WCAG 2.1 AA check on the current page and fails
// the test on any violation, reporting each rule and node — the one-line easy
// path every later screen's test takes. The fixture seam is held to AA so no
// screen's axe check is a silent no-op.
export const test = base.extend({
  checkA11y: async ({ page }, use) => {
    const check = async () => {
      const violations = await analyzeWcag21aa(page);
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
