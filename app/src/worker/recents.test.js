// unit — the pure recents list moves (songs.unsaved_after_discard Constraint 5):
// `dropRecents` forgets the locations a command removed from their book, so a
// recent is always a way back to something (workflow 2 L13-15).

import { describe, it, expect } from 'vitest';
import { dropRecents } from './recents.js';

const at = '2026-10-20T10:00:00.000Z';
const r = (bookId, path) => ({ bookId, path, at });

describe('dropRecents', () => {
  it('removes the matching { bookId, path } entries and keeps the rest in order', () => {
    const list = [r('b1', 'a.cifra.md'), r('b1', 'b.cifra.md'), r('b2', 'c.cifra.md'), r('b1', 'd.cifra.md')];
    expect(
      dropRecents(list, [
        { bookId: 'b1', path: 'b.cifra.md' },
        { bookId: 'b1', path: 'd.cifra.md' },
      ]),
    ).toEqual([r('b1', 'a.cifra.md'), r('b2', 'c.cifra.md')]);
  });

  it('matches on both fields: the same path in another book is kept', () => {
    const list = [r('b1', 'a.cifra.md'), r('b2', 'a.cifra.md')];
    expect(dropRecents(list, [{ bookId: 'b1', path: 'a.cifra.md' }])).toEqual([r('b2', 'a.cifra.md')]);
  });

  it('returns the same reference when nothing matched', () => {
    const list = [r('b1', 'a.cifra.md')];
    expect(dropRecents(list, [{ bookId: 'b1', path: 'z.cifra.md' }])).toBe(list);
    expect(dropRecents(list, [])).toBe(list);
  });

  it('tolerates a non-array list', () => {
    expect(dropRecents(undefined, [{ bookId: 'b1', path: 'a.cifra.md' }])).toEqual([]);
    expect(dropRecents(null, [])).toEqual([]);
  });
});
