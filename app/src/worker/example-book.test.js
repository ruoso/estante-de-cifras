// example-book.test.js (unit) — the shipped example book reads clean and is
// canonical under cifra.md for JavaScript (account.first_run unit clause;
// DIRECTION §2.1; cifra.md spec §8; the first standing rule — "a book only ever
// holds canonical text"). Over every song and setlist the seed module imports
// from app/example-book/, cifra-md's reader reports no diagnostics (nothing is
// dropped) and the file equals its own canonical re-emission (the writer
// round-trips to identical bytes). scripts/check-example-book guards the same in
// the gate with the Python reference; this pins it against the JS implementation
// the app actually seeds through.

import { describe, it, expect } from 'vitest';
import { parse, write, parseSetlist, writeSetlist } from 'cifra-md';
import { EXAMPLE_BOOK_FILES } from './example-book.js';

const SONG_SUFFIX = '.cifra.md';
const SETLIST_SUFFIX = '.setlist.md';

const songs = EXAMPLE_BOOK_FILES.filter((f) => f.name.endsWith(SONG_SUFFIX));
const setlists = EXAMPLE_BOOK_FILES.filter((f) => f.name.endsWith(SETLIST_SUFFIX));

describe('the bundled example book', () => {
  it('ships the three songs and one setlist the seeder writes', () => {
    // Guards the glob: if the bundle stops resolving the files, the seed path
    // would write an empty book and this catches it before the round-trips pass
    // vacuously.
    expect(songs.map((f) => f.name).sort()).toEqual([
      'morning-on-the-porch.cifra.md',
      'the-ferry-line.cifra.md',
      'walking-to-the-market.cifra.md',
    ]);
    expect(setlists.map((f) => f.name)).toEqual(['a-short-set.setlist.md']);
  });

  for (const file of songs) {
    describe(file.name, () => {
      it('reads with no diagnostics (nothing dropped)', () => {
        expect(parse(file.bytes).diagnostics).toEqual([]);
      });

      it('is canonical — the writer round-trips to identical bytes', () => {
        expect(write(parse(file.bytes))).toBe(file.bytes);
      });
    });
  }

  for (const file of setlists) {
    describe(file.name, () => {
      it('reads with no diagnostics (nothing dropped)', () => {
        expect(parseSetlist(file.bytes).diagnostics).toEqual([]);
      });

      it('is canonical — the setlist writer round-trips to identical bytes', () => {
        expect(writeSetlist(parseSetlist(file.bytes))).toBe(file.bytes);
      });
    });
  }
});
