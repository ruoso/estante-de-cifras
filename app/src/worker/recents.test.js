// unit — the pure recents list moves (songs.unsaved_after_discard Constraint 5):
// `dropRecents` forgets the locations a command removed from their book, so a
// recent is always a way back to something (workflow 2 L13-15).

import { describe, it, expect } from 'vitest';
import { dropRecents, moveBookRecents, dropBookRecents } from './recents.js';

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

// books.put_online_no_ghosts Constraint 2 — a recent follows its book: when the
// book changes id (put online, forked) its recents move with it, and when it
// leaves the shelf they go too (the workflow 2 L29-35 delta).
describe('moveBookRecents', () => {
  it('re-keys only fromId’s entries and keeps the order and `at`', () => {
    const list = [
      { bookId: 'local-x', path: 'a.cifra.md', at: '2026-10-20T12:00:00.000Z' },
      r('b2', 'c.cifra.md'),
      { bookId: 'local-x', path: 'b.cifra.md', at: '2026-10-20T09:00:00.000Z' },
    ];
    expect(moveBookRecents(list, 'local-x', 'srv-1')).toEqual([
      { bookId: 'srv-1', path: 'a.cifra.md', at: '2026-10-20T12:00:00.000Z' },
      r('b2', 'c.cifra.md'),
      { bookId: 'srv-1', path: 'b.cifra.md', at: '2026-10-20T09:00:00.000Z' },
    ]);
  });

  it('keeps the earlier (more recent) entry when { toId, path } already exists', () => {
    const newer = { bookId: 'srv-1', path: 'a.cifra.md', at: '2026-10-20T12:00:00.000Z' };
    const older = { bookId: 'local-x', path: 'a.cifra.md', at: '2026-10-20T09:00:00.000Z' };
    expect(moveBookRecents([newer, r('b2', 'c.cifra.md'), older], 'local-x', 'srv-1')).toEqual([
      newer,
      r('b2', 'c.cifra.md'),
    ]);
    // And the other way round: the moved entry is the more recent one.
    const moved = { bookId: 'local-x', path: 'a.cifra.md', at: '2026-10-20T12:00:00.000Z' };
    const stale = { bookId: 'srv-1', path: 'a.cifra.md', at: '2026-10-20T09:00:00.000Z' };
    expect(moveBookRecents([moved, stale], 'local-x', 'srv-1')).toEqual([
      { ...moved, bookId: 'srv-1' },
    ]);
  });

  it('returns the same reference when nothing matched', () => {
    const list = [r('b1', 'a.cifra.md')];
    expect(moveBookRecents(list, 'local-x', 'srv-1')).toBe(list);
    expect(moveBookRecents([], 'local-x', 'srv-1')).toEqual([]);
  });
});

describe('dropBookRecents', () => {
  it('drops one book’s entries and keeps the rest in order', () => {
    const list = [r('b1', 'a.cifra.md'), r('b2', 'a.cifra.md'), r('b1', 'b.cifra.md'), r('b3', 'c.cifra.md')];
    expect(dropBookRecents(list, 'b1')).toEqual([r('b2', 'a.cifra.md'), r('b3', 'c.cifra.md')]);
  });

  it('returns the same reference when nothing matched', () => {
    const list = [r('b1', 'a.cifra.md')];
    expect(dropBookRecents(list, 'b9')).toBe(list);
  });
});
