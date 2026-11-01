import { describe, it, expect } from 'vitest';
import { fillQueue, reconcileWithEstante } from './shelf-fill.js';

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

describe('fillQueue — books removed from this device (unit)', () => {
  it('leaves out a book removed here, though the account still lists it', () => {
    const shelf = { books: { 'b-1': book('/git/b-1', 0), 'b-2': book('/git/b-2', 1) } };
    expect(fillQueue(shelf, new Set(), new Set(['b-1']))).toEqual([
      { bookId: 'b-2', link: '/git/b-2', position: 1 },
    ]);
  });
});

// unit — the shelf kept in step with the account's books on Estante (workflow
// 13 §What comes down): what the shelf lost is put back, save what this device
// removed and a fork's original.
describe('reconcileWithEstante (unit)', () => {
  const listed = (id, extra = {}) => ({ id, title: `Title ${id}`, gitUrl: `/git/${id}`, role: 'owner', ...extra });
  const tomb = { label: reg(null), link: reg(null), position: reg(null), role: reg(null) };

  it('puts back a book the shelf never had and one a removal tombstoned, after the last position', () => {
    const shelf = { books: { 'b-1': book('/git/b-1', 4), 'b-2': tomb } };
    const { changes, rejoin } = reconcileWithEstante(
      [listed('b-1'), listed('b-2'), listed('b-3', { role: 'reader', ownerName: 'Ana' })],
      shelf,
      'dev-1',
    );
    expect(changes).toEqual([
      { path: ['books', 'b-2', 'label'], value: 'Title b-2' },
      { path: ['books', 'b-2', 'link'], value: '/git/b-2' },
      { path: ['books', 'b-2', 'position'], value: 5 },
      { path: ['books', 'b-2', 'role'], value: 'owner' },
      { path: ['books', 'b-3', 'label'], value: 'Title b-3' },
      { path: ['books', 'b-3', 'link'], value: '/git/b-3' },
      { path: ['books', 'b-3', 'position'], value: 6 },
      { path: ['books', 'b-3', 'role'], value: 'reader' },
      { path: ['books', 'b-3', 'owner'], value: 'Ana' },
    ]);
    expect(rejoin).toEqual([]);
  });

  it('leaves alone a book removed here and the original a fork replaced', () => {
    const fork = { ...book('/git/f-1', 0), original: reg({ bookId: 'b-orig', title: 'Orig', link: '/git/b-orig' }) };
    const shelf = { books: { 'f-1': fork, 'b-orig': tomb } };
    const { changes } = reconcileWithEstante([listed('f-1'), listed('b-orig'), listed('b-gone')], shelf, 'dev-1', [
      'b-gone',
    ]);
    expect(changes).toEqual([]);
  });

  it('takes back a book kept as local at sign-out, in its place, and names it to rejoin', () => {
    const shelf = {
      books: { 'b-1': tomb },
      local: { 'dev-1': { 'b-1': { title: reg('Kept'), position: reg(2) } } },
    };
    const { changes, rejoin } = reconcileWithEstante([listed('b-1')], shelf, 'dev-1');
    expect(changes).toEqual([
      { path: ['books', 'b-1', 'label'], value: 'Title b-1' },
      { path: ['books', 'b-1', 'link'], value: '/git/b-1' },
      { path: ['books', 'b-1', 'position'], value: 2 },
      { path: ['books', 'b-1', 'role'], value: 'owner' },
      { path: ['local', 'dev-1', 'b-1', 'title'], value: null },
      { path: ['local', 'dev-1', 'b-1', 'position'], value: null },
    ]);
    expect(rejoin).toEqual([{ bookId: 'b-1', link: '/git/b-1' }]);
  });

  it('writes nothing when the shelf already lists every book, or the listing is malformed', () => {
    const shelf = { books: { 'b-1': book('/git/b-1', 0) } };
    expect(reconcileWithEstante([listed('b-1')], shelf, 'dev-1').changes).toEqual([]);
    expect(reconcileWithEstante(null, shelf, 'dev-1').changes).toEqual([]);
    expect(reconcileWithEstante([{ id: 'x' }, null], {}, 'dev-1').changes).toEqual([]);
  });
});
