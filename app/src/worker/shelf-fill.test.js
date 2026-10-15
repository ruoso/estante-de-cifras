import { describe, it, expect } from 'vitest';
import { fillQueue } from './shelf-fill.js';

// unit — the shelf fill's queue (account.new_device acceptance 4): every live
// `shelf.books` entry with no repository on this device, in the shelf list's
// order (workflow 13 §What comes down; home-book-format §4.2).

const AT = '2026-10-15T10:00:00.000Z';
const reg = (value) => ({ value, at: AT });
const book = (link, position) => ({
  label: reg(`Book ${link}`),
  link: reg(link),
  ...(position === undefined ? {} : { position: reg(position) }),
});

describe('fillQueue (unit)', () => {
  it('lists the live books without a directory, in position order', () => {
    const shelf = {
      books: {
        'b-3': book('/git/b-3', 2),
        'b-1': book('/git/b-1', 0),
        'b-2': book('/git/b-2', 1),
      },
    };
    expect(fillQueue(shelf, new Set())).toEqual([
      { bookId: 'b-1', link: '/git/b-1', position: 0 },
      { bookId: 'b-2', link: '/git/b-2', position: 1 },
      { bookId: 'b-3', link: '/git/b-3', position: 2 },
    ]);
  });

  it('leaves out a book already on the device and a tombstoned entry', () => {
    const shelf = {
      books: {
        'b-here': book('/git/b-here', 0),
        'b-gone': {
          label: reg(null),
          link: reg(null),
          position: reg(null),
          role: reg(null),
        },
        'b-new': book('/git/b-new', 2),
      },
    };
    expect(fillQueue(shelf, ['b-here']).map((e) => e.bookId)).toEqual(['b-new']);
  });

  it('orders equal positions by book id, and a book without a position last', () => {
    const shelf = {
      books: {
        'b-z': book('/git/b-z', 1),
        'b-a': book('/git/b-a', 1),
        'b-none': book('/git/b-none'),
        'b-first': book('/git/b-first', 0),
      },
    };
    expect(fillQueue(shelf, new Set()).map((e) => e.bookId)).toEqual(['b-first', 'b-a', 'b-z', 'b-none']);
  });

  it('is empty for an empty or malformed shelf', () => {
    expect(fillQueue({}, new Set())).toEqual([]);
    expect(fillQueue(null, new Set())).toEqual([]);
    expect(fillQueue({ books: [] }, new Set())).toEqual([]);
    expect(fillQueue({ books: { 'b-1': { label: reg('No link') } } }, new Set())).toEqual([]);
  });
});
