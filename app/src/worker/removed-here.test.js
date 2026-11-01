import { describe, it, expect } from 'vitest';
import { markRemoved } from './removed-here.js';

// The pure list move behind removing a book from this device only (workflow 7
// §Removing a book): add the id once, take it off when the book comes back.
describe('markRemoved (unit)', () => {
  it('adds an id once, and takes it off', () => {
    expect(markRemoved([], 'b-1', true)).toEqual(['b-1']);
    expect(markRemoved(undefined, 'b-1', true)).toEqual(['b-1']);
    expect(markRemoved(['b-1', 'b-2'], 'b-1', false)).toEqual(['b-2']);
  });

  it('returns the same array when nothing changed', () => {
    const list = ['b-1'];
    expect(markRemoved(list, 'b-1', true)).toBe(list);
    expect(markRemoved(list, 'b-2', false)).toBe(list);
  });

  it('drops malformed entries', () => {
    expect(markRemoved([null, 3, '', 'b-1'], 'b-2', true)).toEqual(['b-1', 'b-2']);
  });
});
