import { axe } from 'vitest-axe';

// WCAG 2.1 AA, pinned to one tag set so the behavior level (jsdom, here) and
// the later e2e-web level (a real browser, foundation.e2e_web) ask axe for the
// same conformance level — "axe at WCAG 2.1 AA" (DIRECTION §3.7 line 413; the
// standing accessibility rule).
export const WCAG_21_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// The axe options every behavior-level check passes: run only the WCAG 2.1 AA
// rules, nothing more and nothing less.
export const axeOptions = { runOnly: { type: 'tag', values: WCAG_21_AA_TAGS } };

// Run axe over a rendered container at WCAG 2.1 AA. The result is asserted
// with `expect(await checkWcag21aa(container)).toHaveNoViolations()`.
//
// Note: axe's layout-dependent rules (notably color-contrast) do not run under
// jsdom, which has no layout. Those visual rules are verified in a real
// browser at the e2e-web level; here we pin the role/name/label/structure
// rules that do run in jsdom — the right division of labour, not a weakened
// check.
export function checkWcag21aa(container) {
  return axe(container, axeOptions);
}
