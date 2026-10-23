import { describe, it, expect } from 'vitest';
import { addDismissal } from './dismissed-elsewhere.js';

// The pure list move behind DISMISS_ELSEWHERE (workflow 13 §Books that were
// only on the other device): add the pair once, prune pairs no live row names.
describe('addDismissal (unit)', () => {
  const RASC = { deviceId: 'dev-phone', bookId: 'l-rasc' };
  const IDEIAS = { deviceId: 'dev-phone', bookId: 'l-ideias' };

  it('adds a pair to an empty or absent list', () => {
    expect(addDismissal([], RASC)).toEqual([RASC]);
    expect(addDismissal(undefined, RASC)).toEqual([RASC]);
  });

  it('returns the same array when the pair is already there and nothing is pruned', () => {
    const list = [RASC, IDEIAS];
    expect(addDismissal(list, RASC, [RASC, IDEIAS])).toBe(list);
  });

  it('prunes pairs that name no live row', () => {
    expect(addDismissal([RASC], IDEIAS, [IDEIAS])).toEqual([IDEIAS]);
  });

  it('drops malformed entries', () => {
    expect(addDismissal([null, { deviceId: 1 }, RASC], IDEIAS)).toEqual([RASC, IDEIAS]);
  });
});
