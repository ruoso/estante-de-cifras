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
import { diagramModel } from '../render/index.js';
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

// The geometry mirrored and rotated as the app asks for it
// (shell.display_preferences). Pins workflow 16 §How diagrams are drawn
// (L199-206): left-handed is the strings in opposite order — on the vertical
// box an exact mirror; horizontal is the nut at the left, frets to the right,
// the lowest string at the top (at the bottom when left-handed). L223-228: the
// accessible name is the same whichever way the shape is drawn.
describe('diagramSvg — hand and neck (workflow 16 L199-206, L223-228)', () => {
  beforeEach(() => setLocale('en'));

  const openC = () => shape('C', ['x', 3, 2, 0, 1, 0]); // the lowest string muted
  const context = () => ({ chord: parseChord('C').chord, instrument: guitar });

  function svgOf(options) {
    const doc = new DOMParser().parseFromString(
      diagramSvg(openC(), context(), options),
      'image/svg+xml',
    );
    return doc.documentElement;
  }
  const num = (el, attr) => Number(el.getAttribute(attr));
  // The muted (×) marker's centre: the mid-point of its first stroke.
  function mutedCentre(root) {
    const d = root.querySelector('.ec-muted').getAttribute('d');
    const [a, b, c, e] = d.match(/-?\d+(\.\d+)?/g).map(Number);
    return { x: (a + c) / 2, y: (b + e) / 2 };
  }
  // The span the strings are drawn across, on the axis they are spread along.
  function stringSpan(root, axis) {
    const at = [...root.querySelectorAll('.ec-string')].map((l) => num(l, `${axis}1`));
    return { min: Math.min(...at), max: Math.max(...at) };
  }

  it('left-handed puts the lowest string at the mirrored x of the right-handed box', () => {
    // From the model: the lowest string (logical 0, muted) is display 0
    // right-handed and the last display string left-handed.
    const right = diagramModel(openC(), { handed: 'right' });
    const left = diagramModel(openC(), { handed: 'left' });
    const n = openC().frets.length - 1;
    expect(right.markers.find((m) => m.kind === 'muted').stringIndex).toBe(0);
    expect(left.markers.find((m) => m.kind === 'muted').stringIndex).toBe(n);

    // In the drawing: the vertical mirror is exact — every marker and dot sits
    // at (left edge + right edge) − its right-handed x.
    const r = svgOf({ handed: 'right' });
    const l = svgOf({ handed: 'left' });
    expect(r.getAttribute('class')).toContain('ec-diagram-vertical');
    expect(l.getAttribute('class')).toContain('ec-diagram-vertical');
    const { min, max } = stringSpan(r, 'x');
    expect(mutedCentre(r).x).toBeCloseTo(min);
    expect(mutedCentre(l).x).toBeCloseTo(min + max - mutedCentre(r).x);
    // Rounded to the hundredth: the mirror is exact up to float arithmetic.
    const xs = (list) => list.map((x) => Math.round(x * 100) / 100).sort((a, b) => a - b);
    const cx = (root, sel) => [...root.querySelectorAll(sel)].map((c) => num(c, 'cx'));
    expect(xs(cx(l, '.ec-dot'))).toEqual(xs(cx(r, '.ec-dot').map((x) => min + max - x)));
    expect(xs(cx(l, '.ec-open'))).toEqual(xs(cx(r, '.ec-open').map((x) => min + max - x)));
  });

  it('horizontal is a neck: the nut at the left and the lowest string at the top', () => {
    const h = svgOf({ orientation: 'horizontal' });
    expect(h.getAttribute('class')).toContain('ec-diagram-horizontal');
    const nut = h.querySelector('.ec-nut');
    // The nut runs across the strings (a vertical line) at the left edge.
    expect(num(nut, 'x1')).toBe(num(nut, 'x2'));
    const frets = [...h.querySelectorAll('.ec-fret')].map((l) => num(l, 'x1'));
    expect(num(nut, 'x1')).toBe(Math.min(...frets));
    // The lowest string's (muted) marker is on the top string.
    expect(mutedCentre(h).y).toBeCloseTo(stringSpan(h, 'y').min);
  });

  it('horizontal and left-handed puts the lowest string at the bottom', () => {
    const hl = svgOf({ orientation: 'horizontal', handed: 'left' });
    expect(hl.getAttribute('class')).toContain('ec-diagram-horizontal');
    expect(mutedCentre(hl).y).toBeCloseTo(stringSpan(hl, 'y').max);
  });

  it('keeps the accessible name identical across every hand × neck pair', () => {
    const labels = [];
    for (const handed of ['right', 'left']) {
      for (const orientation of ['vertical', 'horizontal']) {
        labels.push(svgOf({ handed, orientation }).getAttribute('aria-label'));
      }
    }
    expect(labels[0]).toMatch(/x32010/);
    expect(new Set(labels).size).toBe(1);
  });
});
