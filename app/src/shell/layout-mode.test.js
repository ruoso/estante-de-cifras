import { describe, it, expect } from 'vitest';
import { ACCOUNT_WIDE_QUERY, DESTINATIONS, READING_ACTIONS_WIDE_QUERY, WIDE_QUERY, layoutMode } from './layout-mode.js';

// unit — the pure layout-mode policy (shell.layout). Framework-free, like the
// theme resolver's unit test: the breakpoint decision and the drawn destination
// order, with no DOM. Pins the two-layouts-on-one-breakpoint Decision and the
// drawn tab order (docs/mockups/GUIDE.md line 34; W02 lines 55-59).
describe('layout-mode', () => {
  it('picks the wide split when the wide query matches, the phone tab bar when it does not', () => {
    expect(layoutMode(true)).toBe('wide');
    expect(layoutMode(false)).toBe('narrow');
  });

  it('splits on one breakpoint between the e2e phone (412px) and tablet (712px) viewports', () => {
    // 600px, so the real test tablet (Galaxy Tab S4, 712px) lands on the wide
    // split as the design intends, not the phone tab bar a 768 breakpoint would
    // have given it (see layout-mode.js for why the refinement's 768 is adjusted).
    expect(WIDE_QUERY).toBe('(min-width: 600px)');
  });

  it('collapses the reading actions on a min-width query wider than the shell split (shell.narrow_fit item 7)', () => {
    // The reading appbar's full row needs more than the wide split: the 712px
    // tablet sits between the two and gets Edit + ⋯ (W02 tablet L109-115).
    const minWidth = (q) => Number(/^\(min-width: (\d+)px\)$/.exec(q)?.[1]);
    expect(minWidth(READING_ACTIONS_WIDE_QUERY)).toBeGreaterThan(minWidth(WIDE_QUERY));
    expect(minWidth(READING_ACTIONS_WIDE_QUERY)).toBeGreaterThan(712);
    expect(minWidth(READING_ACTIONS_WIDE_QUERY)).toBeLessThanOrEqual(1280);
  });

  it('splits the account screen on the computer, not on the 712px tablet (workflow 13 §The account screen)', () => {
    // The rail beside two preference columns needs a computer's width
    // (account.preferences_layout Decision 3); the tablet keeps the one column.
    expect(ACCOUNT_WIDE_QUERY).toBe('(min-width: 1080px)');
  });

  it('has exactly the three destinations in the drawn order Search · Books · Setlists', () => {
    expect(DESTINATIONS).toEqual(['search', 'books', 'setlists']);
  });

  it('exposes the destinations frozen, so the drawn order cannot be mutated', () => {
    expect(Object.isFrozen(DESTINATIONS)).toBe(true);
  });
});
