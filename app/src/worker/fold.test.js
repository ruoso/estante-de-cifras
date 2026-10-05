// unit — the accent fold (storage.index). Pins workflow 2 L24 ("ignores accents
// and case: `coracao` finds *Coração*") and DIRECTION §4 L431–432
// ("Accent-insensitive, so `coracao` finds *coração*").

import { describe, it, expect } from 'vitest';
import { fold } from './fold.js';

describe('fold', () => {
  it('maps accent and case variants of the same word to one term', () => {
    // coração / Coração / CORACAO / coracao all collapse to one key so a query
    // typed without accents finds the accented title and vice versa.
    const forms = ['coração', 'Coração', 'CORAÇÃO', 'CORACAO', 'coracao'];
    const folded = forms.map(fold);
    expect(new Set(folded).size).toBe(1);
    expect(folded[0]).toBe('coracao');
  });

  it('folds accents on other Latin / diacritic-bearing scripts', () => {
    expect(fold('São João')).toBe('sao joao');
    expect(fold('José')).toBe('jose');
    expect(fold('Über')).toBe('uber');
  });

  it('preserves non-Latin scripts unharmed', () => {
    // Scripts whose marks are not in the Latin combining block, and scripts with
    // no case or accents, pass through unchanged.
    expect(fold('さくら')).toBe('さくら');
    expect(fold('노래')).toBe('노래');
    expect(fold('音楽')).toBe('音楽');
  });

  it('is idempotent', () => {
    for (const s of ['Coração', 'São João', 'さくら', 'ABC', '']) {
      expect(fold(fold(s))).toBe(fold(s));
    }
  });
});
