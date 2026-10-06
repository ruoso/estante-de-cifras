import { describe, it, expect } from 'vitest';
import { DESTINATIONS, WIDE_QUERY, layoutMode } from './layout-mode.js';

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

  it('has exactly the three destinations in the drawn order Search · Books · Setlists', () => {
    expect(DESTINATIONS).toEqual(['search', 'books', 'setlists']);
  });

  it('exposes the destinations frozen, so the drawn order cannot be mutated', () => {
    expect(Object.isFrozen(DESTINATIONS)).toBe(true);
  });
});
