// unit — the chord diagram's pure helpers (shell.diagram). No DOM: these pin
// the kind→(class, word) mapping and the starting-fret geometry that surfaces
// through the carried renderer.
//
// Pins: "the starting fret, the marks for the song's shape, my shape and the
// default" (shell.diagram .tji note); mockups README lines 25-26; ChordBox.dc.html
// lines 81-82.

import { describe, it, expect, beforeEach } from 'vitest';
import { setLocale } from '../i18n/index.js';
import { parseChord } from '../core/notation/parse.js';
import { instrumentInstance } from '../core/instrument.js';
import { searchFingerings, allFingerings, fingeringFromFrets } from '../core/search.js';
import { diagramKind, diagramSvg, KINDS } from './chord-diagram.js';

const guitar = instrumentInstance({
  catalogId: '6guitar',
  label: 'Guitar · Standard',
  strings: 'E2, A2, D3, G3, B3, E4',
  fretCount: 22,
});

// A shape read as written (not search-found), so the exact frets are kept.
function shape(symbol, frets) {
  const chord = parseChord(symbol).chord;
  const fingering = fingeringFromFrets(frets, chord, guitar);
  if (!fingering) throw new Error(`${symbol} ${frets.join('-')} is unplayable`);
  return fingering;
}

describe('diagramKind — the three kinds (ChordBox.dc.html 81-82; README 26)', () => {
  beforeEach(() => setLocale('en'));

  it('song is the plain, unlabelled case: its modifier class and no word', () => {
    const { kind, modifier, word } = diagramKind('song');
    expect(kind).toBe('song');
    expect(modifier).toBe('chord-diagram--song');
    expect(word).toBeNull();
  });

  it('yours carries the chord-colour modifier and the word "your shape"', () => {
    const { modifier, word } = diagramKind('yours');
    expect(modifier).toBe('chord-diagram--yours');
    expect(word).toBe('your shape');
  });

  it('default carries the hollow modifier and the word "default"', () => {
    const { modifier, word } = diagramKind('default');
    expect(modifier).toBe('chord-diagram--default');
    expect(word).toBe('default');
  });

  it('defaults to song, and falls back to song for an unknown kind', () => {
    expect(diagramKind().kind).toBe('song');
    expect(diagramKind('nonsense').kind).toBe('song');
    expect(KINDS).toEqual(['song', 'yours', 'default']);
  });
});

describe('diagramSvg — the starting fret surfaces from the renderer (README 25)', () => {
  it('a shape up the neck draws ec-fretnum carrying its lowest fret, no nut', () => {
    const chord = parseChord('C').chord;
    const high = allFingerings(searchFingerings(chord, guitar)).find((f) => f.position >= 5);
    expect(high, 'an up-the-neck C shape to draw').toBeTruthy();

    const svg = diagramSvg(high, { chord, instrument: guitar });
    expect(svg).toContain('ec-fretnum');
    // The number is the lowest fretted fret, right-aligned (the renderer's
    // left-margin text-anchor="middle"; chord-box.js 81-86).
    const lowest = Math.min(...high.frets.filter((f) => typeof f === 'number' && f > 0));
    expect(svg).toMatch(new RegExp(`class="ec-fretnum"[^>]*text-anchor="middle">${lowest}<`));
    // Up the neck there is no nut to draw.
    expect(svg).not.toContain('ec-nut');
  });

  it('an open-position shape draws no fret number and keeps the thick nut', () => {
    const open = shape('C', ['x', 3, 2, 0, 1, 0]); // x32010
    const svg = diagramSvg(open, { chord: parseChord('C').chord, instrument: guitar });
    expect(svg).not.toContain('ec-fretnum');
    expect(svg).toContain('ec-nut');
  });
});
