import { describe, expect, it } from 'vitest';
import { INDEX_ANCHOR, printCopies, printProgress, songAnchor, songsByArtist } from './book-print.js';

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

  // books.print_variations
  describe('printCopies', () => {
    const GUITAR = '40 45 50 55 59 64';
    const song = (blocks) =>
      ['# Tarde Clara', '', '## A', '```', 'G  C', '```', '', '---', '', ...blocks].join('\n') + '\n';
    const DEFAULT = ['## Voicings: E2 A2 D3 G3 B3 E4', '- G: 320003', ''];
    const EASY = ['## Easy: E2 A2 D3 G3 B3 E4', '- G: 320033', ''];
    const UKE = ['## Uke: G4 C4 E4 A4', '- G: 0232', ''];

    it('prints a song once per variation it has for the instrument, Default first', () => {
      expect(printCopies({ text: song([...EASY, ...DEFAULT]), tuningId: GUITAR })).toEqual(['', 'Easy']);
    });
    it('prints once, as read, with one variation or none for the instrument', () => {
      expect(printCopies({ text: song(DEFAULT), tuningId: GUITAR })).toEqual([null]);
      expect(printCopies({ text: song([...DEFAULT, ...UKE]), tuningId: GUITAR })).toEqual([null]);
      expect(printCopies({ text: song([]), tuningId: GUITAR })).toEqual([null]);
    });
    it('prints once while the song is read transposed, or with no instrument or text', () => {
      const text = song([...DEFAULT, ...EASY]);
      expect(printCopies({ text, reading: { transposition: 2 }, tuningId: GUITAR })).toEqual([null]);
      expect(printCopies({ text, tuningId: '' })).toEqual([null]);
      expect(printCopies({ text: '', tuningId: GUITAR })).toEqual([null]);
    });
  });

  // books.print_order
  describe('songsByArtist', () => {
    const song = (path, title, artist = null) => ({ path, title, artist });
    const titles = (groups) => groups.map((g) => [g.artist, g.songs.map((s) => s.title)]);

    it('groups by artist, artists then titles in alphabetical order, no artist last', () => {
      const groups = songsByArtist(
        [song('1', 'Zebra', 'Bruno'), song('2', 'Alba'), song('3', 'Mar', 'Ana'), song('4', 'Brisa', 'Bruno')],
        { locale: 'en' },
      );
      expect(titles(groups)).toEqual([
        ['Ana', ['Mar']],
        ['Bruno', ['Brisa', 'Zebra']],
        [null, ['Alba']],
      ]);
    });
    it('sorts as the language does, accents and case aside, numbers by value', () => {
      const groups = songsByArtist(
        [song('1', 'Ébano', 'x'), song('2', 'abril', 'x'), song('3', 'Canção 10', 'x'), song('4', 'Canção 2', 'x')],
        { locale: 'pt-BR' },
      );
      expect(groups[0].songs.map((s) => s.title)).toEqual(['abril', 'Canção 2', 'Canção 10', 'Ébano']);
    });
    it('keeps one group for an artist written two ways, and a blank artist is none', () => {
      const groups = songsByArtist([song('1', 'B', 'Ana Lima'), song('2', 'A', 'ana lima'), song('3', 'C', '  ')], {
        locale: 'en',
      });
      expect(titles(groups)).toEqual([
        ['Ana Lima', ['A', 'B']],
        [null, ['C']],
      ]);
    });
    it('orders a song with no title by the name it shows', () => {
      const groups = songsByArtist([song('1', null), song('2', 'Morning')], {
        locale: 'en',
        titleOf: (s) => s.title ?? 'Untitled song',
      });
      expect(groups[0].songs.map((s) => s.path)).toEqual(['2', '1']);
    });
  });
});
