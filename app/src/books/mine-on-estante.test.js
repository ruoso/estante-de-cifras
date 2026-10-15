import { describe, it, expect } from 'vitest';
import { booksNotOnShelf, ownerRefreshChanges } from './mine-on-estante.js';

// unit (books.add_by_link) — the pure "mine on Estante" diff (workflow 7
// §Add-a-book "Mine on Estante"; Decision 5): GET /api/books minus this device's
// shelf. A book already on the shelf is excluded; an account book absent from the
// shelf is included carrying its role and gitUrl; a tombstoned shelf entry counts
// as absent. Book titles are written for the test (no-song-text rule).
const AT = '2026-10-12T10:00:00.000Z';
const reg = (value) => ({ value, at: AT });
const DEVICE = 'dev-1';

// The /api/books rows carry role + gitUrl per Book (openapi.yaml L1013-1036).
const listBooks = [
  { id: 'b-choros', title: 'Choros da Ana', role: 'reader', gitUrl: 'https://e/git/b-choros' },
  { id: 'b-turma', title: 'Turma de quarta', role: 'editor', gitUrl: 'https://e/git/b-turma' },
];

describe('booksNotOnShelf', () => {
  it('includes an account book that is not on the shelf, with its role and gitUrl', () => {
    const shelf = { books: {}, local: {} };
    expect(booksNotOnShelf(listBooks, shelf, DEVICE)).toEqual([
      { id: 'b-choros', label: 'Choros da Ana', role: 'reader', gitUrl: 'https://e/git/b-choros' },
      { id: 'b-turma', label: 'Turma de quarta', role: 'editor', gitUrl: 'https://e/git/b-turma' },
    ]);
  });

  it('excludes a book already on the shelf as a hosted clone (shelf.books[id])', () => {
    const shelf = {
      books: { 'b-choros': { label: reg('Choros da Ana'), link: reg('https://e/git/b-choros'), role: reg('reader') } },
      local: {},
    };
    const out = booksNotOnShelf(listBooks, shelf, DEVICE);
    expect(out.map((b) => b.id)).toEqual(['b-turma']);
  });

  it('counts a fully-tombstoned shelf entry as absent (the book can be added back)', () => {
    // Every register nulled (§5.3) — removed from this device. It re-appears.
    const shelf = {
      books: {
        'b-choros': { label: reg(null), link: reg(null), position: reg(null), role: reg(null) },
      },
      local: {},
    };
    const out = booksNotOnShelf(listBooks, shelf, DEVICE);
    expect(out.map((b) => b.id)).toEqual(['b-choros', 'b-turma']);
  });

  it('excludes a book held in this device’s local namespace too', () => {
    const shelf = {
      books: {},
      local: { [DEVICE]: { 'b-turma': { title: reg('Turma de quarta'), position: reg(0) } } },
    };
    const out = booksNotOnShelf(listBooks, shelf, DEVICE);
    expect(out.map((b) => b.id)).toEqual(['b-choros']);
  });

  it('ignores another device’s local namespace (not this device’s knowledge)', () => {
    const shelf = {
      books: {},
      local: { 'other-dev': { 'b-choros': { title: reg('Choros da Ana'), position: reg(0) } } },
    };
    const out = booksNotOnShelf(listBooks, shelf, DEVICE);
    expect(out.map((b) => b.id)).toEqual(['b-choros', 'b-turma']);
  });

  it('is empty when every account book is already on the shelf', () => {
    const shelf = {
      books: {
        'b-choros': { label: reg('Choros da Ana') },
        'b-turma': { label: reg('Turma de quarta') },
      },
      local: {},
    };
    expect(booksNotOnShelf(listBooks, shelf, DEVICE)).toEqual([]);
  });

  it('tolerates an absent/empty shelf model and a non-array list', () => {
    expect(booksNotOnShelf(listBooks, {}, DEVICE).map((b) => b.id)).toEqual(['b-choros', 'b-turma']);
    expect(booksNotOnShelf(listBooks, undefined, DEVICE).map((b) => b.id)).toEqual([
      'b-choros',
      'b-turma',
    ]);
    expect(booksNotOnShelf(null, { books: {} }, DEVICE)).toEqual([]);
  });
});

// unit (books.owner_name) — the owner's name a member's Book carries (ownerName,
// api/openapi.yaml Book) rides the row through, so the row's Leave can name the
// owner (workflow 10 §Leaving a book L116-117) and the add can write the shelf's
// `owner` register (home-book-format §4.2); a Book without it gives a row without it.
describe('booksNotOnShelf — the owner\'s name', () => {
  it('carries ownerName through, and leaves it absent when the Book has none', () => {
    const named = [
      { id: 'b-choros', title: 'Choros da Ana', role: 'reader', gitUrl: 'https://e/git/b-choros', ownerName: 'Ana' },
      { id: 'b-turma', title: 'Turma de quarta', role: 'editor', gitUrl: 'https://e/git/b-turma' },
    ];
    const [choros, turma] = booksNotOnShelf(named, { books: {}, local: {} }, DEVICE);
    expect(choros).toEqual({
      id: 'b-choros',
      label: 'Choros da Ana',
      role: 'reader',
      gitUrl: 'https://e/git/b-choros',
      ownerName: 'Ana',
    });
    expect(turma).not.toHaveProperty('ownerName');
  });
});

// unit (books.owner_name) — LIST_MINE's refresh of the shelf's `owner` register
// (home-book-format §4.2): only on-shelf books, only when the name differs.
describe('ownerRefreshChanges', () => {
  const onShelfEntry = (extra = {}) => ({ label: reg('x'), role: reg('reader'), ...extra });

  it('writes the listed name for an on-shelf book whose register lacks or differs from it', () => {
    const shelf = {
      books: {
        'b-new': onShelfEntry(),
        'b-old': onShelfEntry({ owner: reg('Ana') }),
        'b-same': onShelfEntry({ owner: reg('Bia') }),
      },
    };
    const listed = [
      { id: 'b-new', ownerName: 'Ana' },
      { id: 'b-old', ownerName: 'Ana Lima' },
      { id: 'b-same', ownerName: 'Bia' },
    ];
    expect(ownerRefreshChanges(listed, shelf)).toEqual([
      { path: ['books', 'b-new', 'owner'], value: 'Ana' },
      { path: ['books', 'b-old', 'owner'], value: 'Ana Lima' },
    ]);
  });

  it('tombstones a held name the listing no longer carries, and leaves an absent one absent', () => {
    const shelf = { books: { 'b-held': onShelfEntry({ owner: reg('Ana') }), 'b-none': onShelfEntry() } };
    expect(ownerRefreshChanges([{ id: 'b-held' }, { id: 'b-none' }], shelf)).toEqual([
      { path: ['books', 'b-held', 'owner'], value: null },
    ]);
  });

  it('ignores a listed book that is not on the shelf (absent or fully tombstoned)', () => {
    const shelf = { books: { 'b-gone': { label: reg(null), role: reg(null) } } };
    expect(ownerRefreshChanges([{ id: 'b-gone', ownerName: 'Ana' }, { id: 'b-off', ownerName: 'Ana' }], shelf)).toEqual([]);
    expect(ownerRefreshChanges([{ id: 'b-off', ownerName: 'Ana' }], {})).toEqual([]);
  });
});
