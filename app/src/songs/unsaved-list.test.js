// Unit — the computer editor's Unsaved list (songs.editor_chrome Constraint 9).
// Pins W04#4 L163-168 (rows: name, meta *book* or *book · folder/*, the current
// one selected) and workflow 4 §Saving (as edited: every song with unsaved
// changes on any book of the shelf). Titles are written for the purpose.

import { describe, it, expect } from 'vitest';
import { unsavedRows } from './unsaved-list.js';

const AT = '2026-10-18T00:00:00.000Z';
const reg = (value) => ({ value, at: AT });

const SHELF = {
  books: {
    'srv-a': { label: reg('Choros da Lia'), position: reg(1) },
    'srv-b': { label: reg('Banda do Bairro'), position: reg(2) },
  },
  local: {
    'local-my-songs': { title: reg('My songs'), position: reg(0) },
  },
};

const BROWSE = {
  books: [
    {
      bookId: 'srv-b',
      songs: [
        { path: 'zeca.cifra.md', title: 'Zeca na Praça', unsaved: true },
        { path: 'aurora.cifra.md', title: 'Aurora Mansa', unsaved: true },
        { path: 'saved.cifra.md', title: 'Já Salva', unsaved: false },
      ],
    },
    {
      bookId: 'srv-a',
      songs: [{ path: 'choro/lua-de-vidro.cifra.md', title: 'Lua de Vidro', unsaved: true }],
    },
    {
      bookId: 'local-my-songs',
      songs: [
        { path: 'tarde-clara.cifra.md', title: 'Tarde Clara', unsaved: false },
        { path: 'pe-de-vento.cifra.md', title: 'Pé de Vento', unsaved: true },
      ],
    },
    // A book that left the shelf: its unsaved song is not listed.
    { bookId: 'srv-gone', songs: [{ path: 'x.cifra.md', title: 'Fora', unsaved: true }] },
  ],
};

const FALLBACKS = { untitledBook: 'Untitled book', untitledSong: 'Untitled song' };

const CURRENT = { bookId: 'local-my-songs', path: 'tarde-clara.cifra.md', title: 'Tarde Clara' };

describe('unsavedRows (W04#4 L163-168; workflow 4 §Saving)', () => {
  it('lists only unsaved songs, the current one first even before the index caught up', () => {
    const rows = unsavedRows(BROWSE, SHELF, CURRENT, FALLBACKS);
    expect(rows[0]).toMatchObject({
      bookId: 'local-my-songs',
      path: 'tarde-clara.cifra.md',
      title: 'Tarde Clara',
      current: true,
    });
    expect(rows.filter((r) => r.current)).toHaveLength(1);
    expect(rows.map((r) => r.title)).not.toContain('Já Salva');
  });

  it('orders the rest by shelf position, then by title', () => {
    const rows = unsavedRows(BROWSE, SHELF, CURRENT, FALLBACKS);
    expect(rows.map((r) => r.title)).toEqual([
      'Tarde Clara',
      'Pé de Vento',
      'Lua de Vidro',
      'Aurora Mansa',
      'Zeca na Praça',
    ]);
  });

  it('says the book at its root, and book · folder/ below it', () => {
    const rows = unsavedRows(BROWSE, SHELF, CURRENT, FALLBACKS);
    expect(rows.find((r) => r.title === 'Pé de Vento').meta).toBe('My songs');
    expect(rows.find((r) => r.title === 'Lua de Vidro').meta).toBe('Choros da Lia · choro/');
  });

  it('leaves out a book no longer on the shelf', () => {
    const rows = unsavedRows(BROWSE, SHELF, CURRENT, FALLBACKS);
    expect(rows.find((r) => r.bookId === 'srv-gone')).toBeUndefined();
  });

  it('marks every other row unsaved, and the current one by the host’s live flag', () => {
    const rows = unsavedRows(BROWSE, SHELF, { ...CURRENT, unsaved: false }, FALLBACKS);
    expect(rows[0].unsaved).toBe(false);
    expect(rows.slice(1).every((r) => r.unsaved)).toBe(true);
    expect(unsavedRows(BROWSE, SHELF, { ...CURRENT, unsaved: true }, FALLBACKS)[0].unsaved).toBe(true);
  });

  it('does not list the current song twice once the index marks it unsaved', () => {
    const browse = {
      books: BROWSE.books.map((b) =>
        b.bookId === 'local-my-songs'
          ? { ...b, songs: b.songs.map((s) => ({ ...s, unsaved: true })) }
          : b,
      ),
    };
    const rows = unsavedRows(browse, SHELF, CURRENT, FALLBACKS);
    expect(rows.filter((r) => r.path === 'tarde-clara.cifra.md')).toHaveLength(1);
    expect(rows[0].current).toBe(true);
  });

  it('with no current song, lists the unsaved ones alone; an empty slice lists nothing', () => {
    expect(unsavedRows(BROWSE, SHELF, null, FALLBACKS).every((r) => !r.current)).toBe(true);
    expect(unsavedRows({ books: [] }, SHELF, null, FALLBACKS)).toEqual([]);
  });

  // songs.no_raw_ids Constraints 1-2 — no row names a book by its id or a song
  // by its file name.
  it('gives a current row whose book is not on the shelf the Untitled book meta, not the id', () => {
    const current = { bookId: 'local-6467d4de-0000', path: 'sets/tarde.cifra.md', title: 'Tarde' };
    const [row] = unsavedRows({ books: [] }, SHELF, current, FALLBACKS);
    expect(row.meta).toBe('Untitled book · sets/');
    expect(row.meta).not.toContain('local-6467d4de');
  });

  it('reads a titleless row as the passed song fallback, a folder still following the book', () => {
    const shelf = { local: { 'local-1': { position: reg(0) } } };
    const browse = {
      books: [{ bookId: 'local-1', songs: [{ path: 'sets/untitled-2.cifra.md', title: '', unsaved: true }] }],
    };
    const current = { bookId: 'local-1', path: 'untitled.cifra.md', title: '' };
    const rows = unsavedRows(browse, shelf, current, FALLBACKS);
    expect(rows.map((r) => r.title)).toEqual(['Untitled song', 'Untitled song']);
    expect(rows.map((r) => r.meta)).toEqual(['Untitled book', 'Untitled book · sets/']);
    expect(rows.some((r) => /untitled-\d|untitled$/.test(r.title))).toBe(false);
  });
});
