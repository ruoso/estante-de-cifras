import { describe, it, expect } from 'vitest';
import { booksNotOnShelf } from './mine-on-estante.js';

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
