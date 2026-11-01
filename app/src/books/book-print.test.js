import { describe, expect, it } from 'vitest';
import { INDEX_ANCHOR, printProgress, songAnchor } from './book-print.js';

describe('book-print', () => {
  it('names each song by its place, apart from the index', () => {
    expect(songAnchor(0)).toBe('book-print-song-0');
    expect(songAnchor(12)).toBe('book-print-song-12');
    expect(songAnchor(0)).not.toBe(INDEX_ANCHOR);
  });

  it('counts the songs whose text is in, ready only when all are', () => {
    const songs = [{ path: 'a.cifra.md' }, { path: 'b.cifra.md' }];
    expect(printProgress(songs, {})).toEqual({ done: 0, total: 2, ready: false });
    expect(printProgress(songs, { 'a.cifra.md': { text: '# A' } })).toEqual({ done: 1, total: 2, ready: false });
    expect(printProgress(songs, { 'a.cifra.md': { text: '# A' }, 'b.cifra.md': { text: '' } })).toEqual({
      done: 2,
      total: 2,
      ready: true,
    });
  });

  it('is never ready for a book with no songs', () => {
    expect(printProgress([], undefined)).toEqual({ done: 0, total: 0, ready: false });
  });
});
