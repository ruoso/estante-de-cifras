import { describe, it, expect } from 'vitest';
import { isPairPath } from './pair-route.js';

// unit (reader.pair_web) — the address the reMarkable shows (workflow 13 §Where
// it lives L343–347) opens the Pair a device page; it holds no code
// (pair_design.md L331–338), so a path with anything after the segment is not it.
describe('isPairPath', () => {
  it('is the bare /pair and /pair/', () => {
    expect(isPairPath('/pair')).toBe(true);
    expect(isPairPath('/pair/')).toBe(true);
  });

  it('is not the root, a longer segment, or a code in the path', () => {
    expect(isPairPath('/')).toBe(false);
    expect(isPairPath('/pairs')).toBe(false);
    expect(isPairPath('/pair/KQ7-4TM')).toBe(false);
    expect(isPairPath('/b/pair')).toBe(false);
  });

  it('is not anything that is not a string', () => {
    expect(isPairPath(undefined)).toBe(false);
    expect(isPairPath(null)).toBe(false);
    expect(isPairPath(42)).toBe(false);
  });
});
