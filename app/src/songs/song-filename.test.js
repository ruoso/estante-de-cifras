// Unit — deriveSongFilename, the title→filename slug (songs.new_song). Pins
// workflow 3 §Its file name L39-48 and DIRECTION §4 L446-448: accents dropped,
// lower case, non-alphanumeric runs collapsed to one hyphen, `.cifra.md`
// appended, an empty/placeholder title → `untitled`, a taken name gaining
// `-2`/`-3`. Fixtures are the titles the workflow and the W03 board name.

import { describe, it, expect } from 'vitest';
import { deriveSongFilename, slugify } from './song-filename.js';

describe('deriveSongFilename', () => {
  it('folds accents and lower-cases the title (workflow 3 §Its file name L43-45)', () => {
    // Coração Vagabundo → coracao-vagabundo.cifra.md (the worked example).
    expect(deriveSongFilename('Coração Vagabundo')).toBe('coracao-vagabundo.cifra.md');
    // Coração de Estrada → coracao-de-estrada.cifra.md (the W03 save dialog).
    expect(deriveSongFilename('Coração de Estrada')).toBe('coracao-de-estrada.cifra.md');
  });

  it('collapses runs of non-alphanumeric characters to one hyphen and trims them', () => {
    expect(deriveSongFilename('  Garota de Ipanema  ')).toBe('garota-de-ipanema.cifra.md');
    expect(deriveSongFilename('Hello, (World)! — 123')).toBe('hello-world-123.cifra.md');
    expect(deriveSongFilename('***Maré***')).toBe('mare.cifra.md');
  });

  it('yields untitled for an empty or punctuation-only title (workflow 3 L39-41)', () => {
    expect(deriveSongFilename('')).toBe('untitled.cifra.md');
    expect(deriveSongFilename('   ')).toBe('untitled.cifra.md');
    expect(deriveSongFilename('—')).toBe('untitled.cifra.md');
    expect(deriveSongFilename(null)).toBe('untitled.cifra.md');
  });

  it('gains -2, -3 against names taken in the same folder (workflow 3 L48)', () => {
    const existing = ['coracao-vagabundo.cifra.md'];
    expect(deriveSongFilename('Coração Vagabundo', existing)).toBe(
      'coracao-vagabundo-2.cifra.md',
    );
    expect(
      deriveSongFilename('Coração Vagabundo', [
        'coracao-vagabundo.cifra.md',
        'coracao-vagabundo-2.cifra.md',
      ]),
    ).toBe('coracao-vagabundo-3.cifra.md');
  });

  it('suffixes the untitled placeholder too (untitled → untitled-2)', () => {
    expect(deriveSongFilename('', ['untitled.cifra.md'])).toBe('untitled-2.cifra.md');
    expect(
      deriveSongFilename('', new Set(['untitled.cifra.md', 'untitled-2.cifra.md'])),
    ).toBe('untitled-3.cifra.md');
  });

  it('is unaffected by unrelated names in the folder', () => {
    expect(
      deriveSongFilename('Maré Mansa', ['README.md', '.gitattributes', 'outra.cifra.md']),
    ).toBe('mare-mansa.cifra.md');
  });
});

describe('slugify', () => {
  it('returns the bare slug, no extension', () => {
    expect(slugify('Coração Vagabundo')).toBe('coracao-vagabundo');
    expect(slugify('')).toBe('');
  });
});
