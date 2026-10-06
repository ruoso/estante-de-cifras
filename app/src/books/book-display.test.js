import { describe, it, expect } from 'vitest';
import {
  titleFor,
  whereFor,
  canSaveFor,
  syncStateFor,
  orderedBooks,
} from './book-display.js';

// unit — the pure display/ordering helper for the book-management screen
// (books.shelf, the added level: a genuine pure module). Pins workflow 7 L16-21
// and home-book-format §4.2 (`position`), §5.3 (tombstones). All names are
// written for this test (no-song-text rule; a label is a user's words).

const AT = '2026-10-05T14:00:00.000Z';
const reg = (value) => ({ value, at: AT });

describe('book-display: titleFor (title or label — workflow 7 L16-18; §5.3)', () => {
  it('returns a shared book’s label when present and non-tombstone', () => {
    expect(titleFor({ label: reg('Choros da Ana') }, 'b-1')).toBe('Choros da Ana');
  });

  it('returns a local book’s title when present and non-tombstone', () => {
    expect(titleFor({ title: reg('Exercícios de violão') }, 'l-1')).toBe('Exercícios de violão');
  });

  it('falls back to the bookId for an absent register', () => {
    expect(titleFor({}, 'b-9')).toBe('b-9');
    expect(titleFor(undefined, 'b-9')).toBe('b-9');
  });

  it('falls back to the bookId for a tombstoned (value: null) or empty register (§5.3)', () => {
    expect(titleFor({ label: reg(null) }, 'b-1')).toBe('b-1');
    expect(titleFor({ title: reg('') }, 'l-1')).toBe('l-1');
  });
});

describe('book-display: whereFor / canSaveFor (where it lives / can save — workflow 7 L19-20)', () => {
  it('maps a local book to on this device and can save', () => {
    expect(whereFor('local')).toBe('onDevice');
    expect(canSaveFor('local', {})).toBe(true);
  });

  it('maps a shared book to on Estante, its role from the membership seam', () => {
    expect(whereFor('shared')).toBe('onEstante');
    // editor can save, reader cannot, an absent role is the unfilled seam.
    expect(canSaveFor('shared', { role: reg('editor') })).toBe(true);
    expect(canSaveFor('shared', { role: reg('reader') })).toBe(false);
    expect(canSaveFor('shared', {})).toBe(null);
  });
});

describe('book-display: syncStateFor (render-when-present seam — workflow 7 L21/L47)', () => {
  it('returns null when the book is in step (no sync register)', () => {
    expect(syncStateFor({ title: reg('X') })).toBe(null);
  });

  it('carries the W08 state and badge class when present', () => {
    expect(syncStateFor({ sync: reg({ state: 'syncing' }) })).toEqual({ state: 'syncing', cls: '' });
    expect(syncStateFor({ sync: reg({ state: 'unsaved', count: 2 }) })).toEqual({
      state: 'unsaved',
      cls: 'unsaved',
      count: 2,
    });
    expect(syncStateFor({ sync: reg({ state: 'conflict' }) })).toEqual({
      state: 'conflict',
      cls: 'conflict dot',
    });
  });
});

describe('book-display: orderedBooks (shelf order — home-book-format §4.2 `position`)', () => {
  it('orders shared and local books ascending by position', () => {
    const shelf = {
      books: { 'b-1': { label: reg('B'), position: reg(2) } },
      local: {
        'l-1': { title: reg('L'), position: reg(0) },
        'l-2': { title: reg('M'), position: reg(1) },
      },
    };
    expect(orderedBooks(shelf).map((e) => e.id)).toEqual(['l-1', 'l-2', 'b-1']);
  });

  it('carries each book’s kind (local vs shared)', () => {
    const shelf = {
      books: { 'b-1': { position: reg(1) } },
      local: { 'l-1': { position: reg(0) } },
    };
    const kinds = Object.fromEntries(orderedBooks(shelf).map((e) => [e.id, e.kind]));
    expect(kinds).toEqual({ 'l-1': 'local', 'b-1': 'shared' });
  });

  it('breaks ties stably by id', () => {
    const shelf = {
      books: {},
      local: {
        'l-b': { position: reg(0) },
        'l-a': { position: reg(0) },
      },
    };
    expect(orderedBooks(shelf).map((e) => e.id)).toEqual(['l-a', 'l-b']);
  });

  it('puts a book with no position last (stable by id)', () => {
    const shelf = {
      books: { 'b-x': {} },
      local: { 'l-1': { position: reg(0) }, 'l-z': {} },
    };
    expect(orderedBooks(shelf).map((e) => e.id)).toEqual(['l-1', 'b-x', 'l-z']);
  });

  it('is empty for an empty shelf', () => {
    expect(orderedBooks({})).toEqual([]);
    expect(orderedBooks({ books: {}, local: {} })).toEqual([]);
  });
});
