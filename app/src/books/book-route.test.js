import { describe, it, expect } from 'vitest';
import {
  bookSongRoute,
  songAnchorFromHash,
  bookSongPath,
  invitationSongLink,
} from './book-route.js';

// unit (books.share) — the deep-link parser/builder for the two song-share link
// shapes (workflow 10 L92-101; Decision 2). Pure, DOM-free.

describe('bookSongRoute — /b/<bookId>/<path>', () => {
  it('parses a bookId and a song path', () => {
    expect(bookSongRoute('/b/choros-da-ana/carinhoso.cifra.md')).toEqual({
      bookId: 'choros-da-ana',
      path: 'carinhoso.cifra.md',
    });
  });

  it('keeps the slashes of a folder-nested song path', () => {
    expect(bookSongRoute('/b/choros-da-ana/choro/carinhoso.cifra.md')).toEqual({
      bookId: 'choros-da-ana',
      path: 'choro/carinhoso.cifra.md',
    });
  });

  it('decodes a percent-encoded id and path segment', () => {
    expect(bookSongRoute('/b/sr_abc%20123/pasta/uma%20can%C3%A7%C3%A3o.cifra.md')).toEqual({
      bookId: 'sr_abc 123',
      path: 'pasta/uma canção.cifra.md',
    });
  });

  it('returns null for a path that is not a /b/<bookId>/<path>', () => {
    expect(bookSongRoute('/b/onlyabook')).toBeNull();
    expect(bookSongRoute('/b/book/')).toBeNull();
    expect(bookSongRoute('/b/')).toBeNull();
    expect(bookSongRoute('/i/tok')).toBeNull();
    expect(bookSongRoute('/x/book/song.cifra.md')).toBeNull();
    expect(bookSongRoute('/')).toBeNull();
  });

  it('returns null for a non-string', () => {
    expect(bookSongRoute(null)).toBeNull();
    expect(bookSongRoute(42)).toBeNull();
  });
});

describe('songAnchorFromHash — the /i/<token>#<path> fragment', () => {
  it('yields the song path from a fragment, slashes preserved', () => {
    expect(songAnchorFromHash('#choro/carinhoso.cifra.md')).toBe('choro/carinhoso.cifra.md');
  });

  it('decodes a percent-encoded fragment', () => {
    expect(songAnchorFromHash('#pasta/uma%20can%C3%A7%C3%A3o.cifra.md')).toBe(
      'pasta/uma canção.cifra.md',
    );
  });

  it('accepts a fragment with no leading #', () => {
    expect(songAnchorFromHash('carinhoso.cifra.md')).toBe('carinhoso.cifra.md');
  });

  it('yields none for a bare /i/<token> (empty or #-only hash)', () => {
    expect(songAnchorFromHash('')).toBeNull();
    expect(songAnchorFromHash('#')).toBeNull();
    expect(songAnchorFromHash(null)).toBeNull();
  });
});

describe('the link builders round-trip with the parsers', () => {
  it('bookSongPath builds an address bookSongRoute reads back', () => {
    const link = bookSongPath('choros-da-ana', 'choro/carinhoso.cifra.md');
    expect(link).toBe('/b/choros-da-ana/choro/carinhoso.cifra.md');
    expect(bookSongRoute(link)).toEqual({
      bookId: 'choros-da-ana',
      path: 'choro/carinhoso.cifra.md',
    });
  });

  it('invitationSongLink appends the path as a fragment songAnchorFromHash reads back', () => {
    const link = invitationSongLink('https://estante.app/i/tok', 'choro/carinhoso.cifra.md');
    expect(link).toBe('https://estante.app/i/tok#choro/carinhoso.cifra.md');
    const hash = new URL(link).hash;
    expect(songAnchorFromHash(hash)).toBe('choro/carinhoso.cifra.md');
  });

  it('a path with reserved characters survives both round-trips', () => {
    const path = 'pasta/uma canção.cifra.md';
    expect(bookSongRoute(bookSongPath('b1', path))).toEqual({ bookId: 'b1', path });
    const link = invitationSongLink('https://estante.app/i/tok', path);
    expect(songAnchorFromHash(new URL(link).hash)).toBe(path);
  });
});
