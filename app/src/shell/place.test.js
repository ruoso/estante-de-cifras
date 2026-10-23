import { describe, it, expect } from 'vitest';
import { placeFromUrl, urlFromPlace, bookOfScope, isOpening } from './place.js';

// unit (shell.routing) — a place and its address, both ways. Pins DIRECTION
// §3.7 "The address follows where you are" and workflow 7 §Links to books
// (L45-50): `/`, `/books`, `/setlists`, `/b/<book>`, `/b/<book>/<path>`.

const CASES = [
  ['/', { tab: 'search' }],
  ['/books', { tab: 'books' }],
  ['/setlists', { tab: 'setlists' }],
  ['/b/choros-da-ana', { tab: 'books', book: 'choros-da-ana' }],
  [
    '/b/choros-da-ana/choro/tarde-clara.cifra.md',
    {
      tab: 'books',
      book: 'choros-da-ana',
      song: { bookId: 'choros-da-ana', path: 'choro/tarde-clara.cifra.md' },
    },
  ],
  [
    '/b/choros-da-ana/sabado.setlist.md',
    { tab: 'setlists', setlist: { bookId: 'choros-da-ana', path: 'sabado.setlist.md' } },
  ],
];

describe('placeFromUrl — the place an address names', () => {
  for (const [url, place] of CASES) {
    it(`${url} names its place`, () => {
      expect(placeFromUrl(url)).toEqual(place);
    });
  }

  it('a book address with a trailing slash is the book', () => {
    expect(placeFromUrl('/b/choros-da-ana/')).toEqual({ tab: 'books', book: 'choros-da-ana' });
  });

  it("a song's address carries its book's page beneath it (books.book_page)", () => {
    expect(placeFromUrl('/b/livro/x.cifra.md').book).toBe('livro');
  });

  it('decodes percent-encoded ids and path segments (spaces, accents)', () => {
    expect(placeFromUrl('/b/sr_abc%20123/pasta%20velha/uma%20can%C3%A7%C3%A3o.cifra.md')).toEqual({
      tab: 'books',
      book: 'sr_abc 123',
      song: { bookId: 'sr_abc 123', path: 'pasta velha/uma canção.cifra.md' },
    });
  });

  it('anything else is not an address', () => {
    for (const url of ['/x', '/b/', '/b', '/books/x', '/setlists/', '/i/tok', '/sign-in/tok']) {
      expect(placeFromUrl(url)).toBeNull();
    }
    expect(placeFromUrl(null)).toBeNull();
  });
});

describe('urlFromPlace — the address of a place', () => {
  for (const [url, place] of CASES) {
    it(`${url} is its place's address`, () => {
      expect(urlFromPlace(place)).toBe(url);
    });
  }

  it('round-trips every place: placeFromUrl(urlFromPlace(p)) is p', () => {
    for (const [, place] of CASES) {
      expect(placeFromUrl(urlFromPlace(place))).toEqual(place);
    }
  });

  it('encodes ids and path segments, and round-trips them', () => {
    const place = {
      tab: 'books',
      book: 'livro de ação',
      song: { bookId: 'livro de ação', path: 'pasta velha/uma canção.cifra.md' },
    };
    expect(urlFromPlace(place)).toBe(
      '/b/livro%20de%20a%C3%A7%C3%A3o/pasta%20velha/uma%20can%C3%A7%C3%A3o.cifra.md',
    );
    expect(placeFromUrl(urlFromPlace(place))).toEqual(place);
  });

  it("a song open over a setlist has the song's address", () => {
    expect(
      urlFromPlace({
        tab: 'setlists',
        setlist: { bookId: 'b1', path: 'sabado.setlist.md' },
        song: { bookId: 'b1', path: 'x.cifra.md' },
      }),
    ).toBe('/b/b1/x.cifra.md');
  });

  it("a book's page is an address on Books only; another tab keeps the tab's", () => {
    expect(urlFromPlace({ tab: 'search', book: 'b1' })).toBe('/');
  });
});

describe('bookOfScope — the one book a search scope narrows to', () => {
  it('reads { bookId } and a one-book { books }', () => {
    expect(bookOfScope({ bookId: 'b1' })).toBe('b1');
    expect(bookOfScope({ books: ['b1'] })).toBe('b1');
  });

  it('a folder, several books or no scope is not', () => {
    expect(bookOfScope({ bookId: 'b1', prefix: 'choro' })).toBeNull();
    expect(bookOfScope({ books: ['b1', 'b2'] })).toBeNull();
    expect(bookOfScope(null)).toBeNull();
  });
});

describe('isOpening — what is a history step (Decisions 3-4)', () => {
  it("opening a song, a setlist or a book's page is", () => {
    expect(isOpening({ tab: 'search' }, { tab: 'search', song: { bookId: 'b', path: 'x.cifra.md' } })).toBe(true);
    expect(isOpening({ tab: 'setlists' }, { tab: 'setlists', setlist: { bookId: 'b', path: 's.setlist.md' } })).toBe(true);
    expect(isOpening({ tab: 'books' }, { tab: 'books', book: 'b' })).toBe(true);
  });

  it('a tab switch, or anything closing, is not', () => {
    expect(isOpening({ tab: 'search' }, { tab: 'books' })).toBe(false);
    expect(isOpening({ tab: 'search' }, { tab: 'books', book: 'b' })).toBe(false);
    expect(isOpening({ tab: 'search', song: { bookId: 'b', path: 'x' } }, { tab: 'search' })).toBe(false);
  });
});
