// first-run.test.js (unit) — the pure decisions behind the search screen's
// first-run empty state (account.first_run). Pins when the first-run state shows
// (bookIds and recents both empty — workflow 1 §Cold), the widened label
// resolver (a local book's title, then a shared label, then the id — Decision 5),
// and the shared My songs identity (Decision 4). No DOM, no store.

import { describe, it, expect } from 'vitest';
import { showsFirstRun, bookLabelFor, MY_SONGS } from './first-run.js';

const reg = (value) => ({ value, at: '2026-10-06T00:00:00.000Z' });

describe('showsFirstRun', () => {
  it('shows only when there are no books to list and no recents', () => {
    expect(showsFirstRun([], [])).toBe(true);
  });

  it('gives way once a book is on the shelf', () => {
    expect(showsFirstRun(['local-example-book'], [])).toBe(false);
  });

  it('gives way once there is a recent, even with no books', () => {
    expect(showsFirstRun([], [{ bookId: 'b', path: 'x.cifra.md' }])).toBe(false);
  });
});

// songs.no_raw_ids Constraint 1 — the same rule as titleFor over the `shelf`
// slice: a book with no name is the caller's *Untitled book*, never its id.
describe('bookLabelFor', () => {
  const UNTITLED = 'Untitled book';

  it('reads a local book’s title first', () => {
    const shelf = { books: {}, local: { ex: { title: reg('Example Book') } } };
    expect(bookLabelFor(shelf, 'ex', UNTITLED)).toBe('Example Book');
  });

  it('falls back to a shared book’s label', () => {
    const shelf = { books: { b: { label: reg('Choros da Ana') } }, local: {} };
    expect(bookLabelFor(shelf, 'b', UNTITLED)).toBe('Choros da Ana');
  });

  it('prefers a local title over a shared label for the same id', () => {
    const shelf = {
      books: { x: { label: reg('shared') } },
      local: { x: { title: reg('local') } },
    };
    expect(bookLabelFor(shelf, 'x', UNTITLED)).toBe('local');
  });

  it('returns the passed fallback, never the id, when no label register is present', () => {
    expect(bookLabelFor({ books: {}, local: {} }, 'local-123', UNTITLED)).toBe(UNTITLED);
    expect(bookLabelFor({}, 'local-123', UNTITLED)).toBe(UNTITLED);
    expect(bookLabelFor(undefined, 'local-123', UNTITLED)).toBe(UNTITLED);
  });

  it('falls through a tombstone, empty or blank value to the next source, then the fallback', () => {
    for (const title of [reg(null), reg(''), reg('   ')]) {
      expect(bookLabelFor({ books: {}, local: { ex: { title } } }, 'ex', UNTITLED)).toBe(UNTITLED);
      expect(
        bookLabelFor({ books: { ex: { label: reg('Banda') } }, local: { ex: { title } } }, 'ex', UNTITLED),
      ).toBe('Banda');
    }
    expect(bookLabelFor({ books: { b: { label: reg(null) } } }, 'b', 'Libro sin título')).toBe(
      'Libro sin título',
    );
  });
});

describe('MY_SONGS', () => {
  it('reserves a local id and names its i18n label keys', () => {
    expect(MY_SONGS.id).toBe('local-my-songs');
    expect(MY_SONGS.id.startsWith('local-')).toBe(true);
    expect(MY_SONGS.labelKey).toBe('firstRun.mySongs');
    expect(MY_SONGS.metaKey).toBe('firstRun.mySongsMeta');
  });
});
