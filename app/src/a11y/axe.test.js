import { describe, it, expect } from 'vitest';
import { WCAG_21_AA_TAGS, axeOptions } from './axe.js';

// unit — pins that the shared axe helper requests exactly the WCAG 2.1 AA tag
// set the standing accessibility rule and DIRECTION §3.7 (line 413, "axe at
// WCAG 2.1 AA") require. A pure module, so this is the first Vitest test,
// which flips the gate's `estante app: npm run test` branch from "no test
// files yet" (scripts/gate line 159) to a live run.
describe('the WCAG 2.1 AA axe tag set', () => {
  it('is exactly wcag2a, wcag2aa, wcag21a, wcag21aa', () => {
    expect(WCAG_21_AA_TAGS).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  });

  it('is the runOnly tag set the helper hands to axe', () => {
    expect(axeOptions).toEqual({
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    });
  });
});
