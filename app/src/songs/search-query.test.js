// unit — the pure search-query helpers (songs.search). These pin the two
// decisions that are testable without a DOM: "does the query parse as a chord,
// read in the user's notation" (workflow 2 L26-40) and "how the scope maps to a
// command payload, resetting each session" (workflow 2 L60-65).

import { describe, it, expect } from 'vitest';
import {
  recognizeChord,
  scopePayload,
  INITIAL_SCOPE,
  songTitle,
  folderOf,
  inScope,
  followScope,
} from './search-query.js';

describe('recognizeChord — a chord recognised (workflow 2 L26-40)', () => {
  it('recognises plain chord symbols', () => {
    // A bare letter is a chord (root-anchored parser) — which is why the
    // explorer row is additive, not a replacement.
    expect(recognizeChord('A')?.chord.root.letter).toBe('A');
    expect(recognizeChord('Am')?.chord.quality).toBe('minor');
    expect(recognizeChord('Cmaj7')?.chord.extensions).toEqual([
      { degree: 7, alter: 0 },
    ]);
  });

  it('returns null for text that is not a chord, accents and all', () => {
    expect(recognizeChord('Banda')).toBeNull();
    expect(recognizeChord('coração')).toBeNull();
    expect(recognizeChord('')).toBeNull();
    expect(recognizeChord('   ')).toBeNull();
    expect(recognizeChord(undefined)).toBeNull();
  });

  it('reads an ambiguous symbol in the given dialect, offering the chord in addition', () => {
    // C7+ (cifra.md §5.6) reads one way under the Brazilian notation and
    // another under the American one; the chord is still OFFERED either way
    // (non-null), never hidden by guessing which was meant.
    const br = recognizeChord('C7+', 'brazilian');
    const us = recognizeChord('C7+', 'american');
    expect(br).not.toBeNull();
    expect(us).not.toBeNull();
    expect(br.ambiguities[0].chosen).toBe('majorSeventh');
    expect(us.ambiguities[0].chosen).toBe('dominantSharpFive');
    // The reading really differs by dialect, so the explorer row would show
    // the dialect's chord.
    expect(br.chord.quality).not.toBe(us.chord.quality);
  });
});

describe('scopePayload — the scope → command mapping (workflow 2 L60-65)', () => {
  it('resets to no scope on a fresh session', () => {
    // The screen initialises its scope to this value on every mount, so a scope
    // is never carried across sessions (Decision 8).
    expect(INITIAL_SCOPE).toBeNull();
    expect(scopePayload(INITIAL_SCOPE)).toBeUndefined();
  });

  it('maps a set of books to a books scope', () => {
    expect(scopePayload({ books: ['book-1', 'book-2'] })).toEqual({
      books: ['book-1', 'book-2'],
    });
    // A single book chosen from the browse list narrows to that one book.
    expect(scopePayload({ bookId: 'book-1' })).toEqual({ books: ['book-1'] });
    // A scope that narrows to no book at all is no narrowing.
    expect(scopePayload({ books: [] })).toBeUndefined();
  });

  it('maps a folder prefix within one book to a prefix scope', () => {
    expect(scopePayload({ bookId: 'book-1', prefix: 'bossa/' })).toEqual({
      bookId: 'book-1',
      prefix: 'bossa/',
    });
  });
});

// songs.no_raw_ids — a titleless song is the caller's *Untitled song*; its
// placeholder file name shows only in the file view (workflow 3 L37-41;
// workflow 2 L180-182, amended).
describe('songTitle / folderOf — where a result lives (workflow 2 L49, L180-182)', () => {
  it('keeps a song’s own title', () => {
    expect(songTitle('Tarde Clara', 'Untitled song')).toBe('Tarde Clara');
  });

  it('returns the passed fallback for an empty, blank or missing title, never the file name', () => {
    for (const title of ['', '   ', undefined, null]) {
      const shown = songTitle(title, 'Untitled song');
      expect(shown).toBe('Untitled song');
      expect(shown).not.toMatch(/untitled-\d/);
    }
    expect(songTitle('', 'Música sem título')).toBe('Música sem título');
  });

  it('reports the folder only when the song is not at the root', () => {
    expect(folderOf('bossa/tarde.cifra.md')).toBe('bossa');
    expect(folderOf('nested/deep/song.cifra.md')).toBe('nested/deep');
    expect(folderOf('song.cifra.md')).toBe('');
  });
});

// songs.search_scope_follows — workflow 2 §Scope: *A scoped search is that
// book's songs* (inScope) and *After a save, the scope follows the song*
// (followScope).
describe('scope follows a save', () => {
  it('no scope stays no scope (Decision 2)', () => {
    expect(followScope(null, 'A', 'x.md')).toBeNull();
  });

  it('a save the one-book scope holds keeps the same object', () => {
    const scope = { bookId: 'A' };
    expect(followScope(scope, 'A', 'x.md')).toBe(scope);
    const listed = { books: ['A', 'C'] };
    expect(followScope(listed, 'C', 'x.md')).toBe(listed);
  });

  it('a save into a book outside the scope becomes that book', () => {
    expect(followScope({ books: ['A'] }, 'B', 'x.md')).toEqual({ bookId: 'B' });
    expect(followScope({ bookId: 'A' }, 'B')).toEqual({ bookId: 'B' });
  });

  it('a folder scope holds a save under its prefix and widens to the book otherwise', () => {
    const folder = { bookId: 'A', prefix: 'choros/' };
    expect(followScope(folder, 'A', 'choros/x.md')).toBe(folder);
    expect(followScope(folder, 'A', 'y.md')).toEqual({ bookId: 'A' });
    // No path given: the book is the scope's, so it is held.
    expect(followScope(folder, 'A')).toBe(folder);
  });

  it('inScope mirrors the Worker rule for every scope shape', () => {
    expect(inScope(null, 'A', 'x.md')).toBe(true);
    expect(inScope({ books: ['A', 'B'] }, 'B', 'x.md')).toBe(true);
    expect(inScope({ books: ['A'] }, 'B')).toBe(false);
    expect(inScope({ bookId: 'A' }, 'A')).toBe(true);
    expect(inScope({ bookId: 'A' }, 'B', 'x.md')).toBe(false);
    expect(inScope({ bookId: 'A', prefix: 'choros/' }, 'A', 'choros/x.md')).toBe(true);
    expect(inScope({ bookId: 'A', prefix: 'choros/' }, 'A', 'y.md')).toBe(false);
    expect(inScope({ bookId: 'A', prefix: 'choros/' }, 'A')).toBe(true);
    expect(inScope({ bookId: 'A', prefix: 'choros/' }, 'B')).toBe(false);
  });
});
