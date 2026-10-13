// unit (shell.a11y_chart) — the spoken chord name, no DOM. Pins the exact §3
// strings of docs/screen-reader.md: a chord is spoken by name, never by its
// glyph, so a reader does not read `Em` as "em", spell `C#m7` letter by letter,
// or read `/` as "slash". The footnote marker (cifra.md §2.4) is appended as a
// reference; index 1 is the bare key and adds nothing.
//
// Pins: "the reading-order text of a ... chord" (shell.a11y_chart .tji note);
// docs/screen-reader.md §3; cifra.md §2.4 (footnote), §5.6 (notation dialect).

import { describe, it, expect, beforeEach } from 'vitest';
import { setLocale, t } from '../i18n/index.js';
import { parseChord } from '../core/notation/parse.js';
import { speakChord } from './chord-speech.js';

const chord = (symbol) => parseChord(symbol).chord;
const speak = (symbol, opts = {}) => speakChord(chord(symbol), { notation: 'brazilian', t, ...opts });

describe('speakChord (§3)', () => {
  beforeEach(() => setLocale('en'));

  it('speaks a chord by name, never by its glyph', () => {
    expect(speak('Em')).toBe('E minor');
    expect(speak('C#m7')).toBe('C sharp minor seven');
    expect(speak('G/B')).toBe('G over B');
  });

  it('keeps a plain major triad bare (no quality word)', () => {
    expect(speak('G')).toBe('G');
    expect(speak('C')).toBe('C');
  });

  it('appends a §2.4 footnote only above index 1 (the bare key)', () => {
    expect(speak('Cm', { footnote: 2 })).toBe('C minor footnote 2');
    expect(speak('Cm', { footnote: 1 })).toBe('C minor');
    expect(speak('Cm')).toBe('C minor'); // index defaults to the bare key
  });

  it('speaks a dominant seventh by its number', () => {
    expect(speak('G7')).toBe('G seven');
  });

  it('follows the app language', () => {
    setLocale('pt-BR');
    expect(speakChord(chord('Em'), { notation: 'brazilian', t })).toBe('E menor');
    expect(speakChord(chord('G/B'), { notation: 'brazilian', t })).toBe('G sobre B');
  });
});
