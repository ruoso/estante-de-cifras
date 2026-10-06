// unit (music.explorer) — the framework-free view-model over `searchFingerings`.
// Pins the explorer's shared list helper, NOT a reimplementation of the carried
// core: ranking, grouping by position and the difficulty bucket are search.js /
// score.js own already-tested logic, and this helper must preserve them exactly
// while adding the group labels, the six-per-group display cap and the
// starred-match. Pins: the .tji unit clause "ranking and grouping by position";
// workflow 16 L38-67; home-book §4.4 (chord key matched by chord, not spelling).

import { describe, it, expect, beforeEach } from 'vitest';
import { setLocale } from '../i18n/index.js';
import { parseChord } from '../core/notation/parse.js';
import { instrumentInstance, configFor } from '../core/instrument.js';
import { searchFingerings, allFingerings } from '../core/search.js';
import {
  DISPLAY_CAP,
  groupViewModel,
  groupLabel,
  starredShorthands,
  spokenShorthand,
} from './fingering-groups.js';

const guitar = () =>
  instrumentInstance({
    catalogId: '6guitar',
    label: 'Guitar · Standard',
    strings: 'E2, A2, D3, G3, B3, E4',
    fretCount: 22,
  });

const search = (symbol, instrument, preset = 'strumming') =>
  searchFingerings(parseChord(symbol).chord, instrument, configFor(instrument, preset));

beforeEach(() => setLocale('en'));

describe('groupViewModel order and grouping', () => {
  it('shows the shapes in the order and groups the core produced', () => {
    const result = search('A', guitar());
    const vm = groupViewModel(result, { chord: parseChord('A').chord });

    // Same groups, same order as the core — never re-sorted or re-grouped here.
    expect(vm.map((g) => g.position)).toEqual(result.groups.map((g) => g.position));

    // Flattening the view-model reproduces the core's overall easiest-first rank.
    const flat = vm.flatMap((g) => g.shapes.map((s) => s.fingering.shorthand));
    expect(flat).toEqual(allFingerings(result).map((f) => f.shorthand));
  });

  it('labels open position *Open* and the rest *Fret N*, empties skipped', () => {
    const result = search('A', guitar());
    const vm = groupViewModel(result, { chord: parseChord('A').chord });

    // Open first (every guitar A has an open shape), then ascending fret numbers.
    expect(vm[0].position).toBe(0);
    expect(vm[0].label).toBe('Open');
    for (const g of vm.slice(1)) {
      expect(g.position).toBeGreaterThan(0);
      expect(g.label).toBe(`Fret ${g.position}`);
    }
    // Positions strictly ascending — the core skips positions with no shape.
    const positions = vm.map((g) => g.position);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('groupLabel renders Open and Fret N directly', () => {
    expect(groupLabel(0)).toBe('Open');
    expect(groupLabel(5)).toBe('Fret 5');
  });
});

describe('the six-per-group display cap', () => {
  // A synthetic group of eight so the cap is deterministic regardless of the
  // core's shape count: the cap is DISPLAY_CAP and is display-only.
  const eight = Array.from({ length: 8 }, (_, i) => ({
    shorthand: `shape${i}`,
    difficulty: 'easy',
    position: 0,
  }));
  const result = { groups: [{ position: 0, fingerings: eight, total: 8 }] };

  it('caps the display at six and reports the hidden count', () => {
    const [group] = groupViewModel(result);
    expect(DISPLAY_CAP).toBe(6);
    expect(group.cap).toBe(6);
    expect(group.hiddenCount).toBe(2); // 8 found, 6 shown, 2 under *show more*
  });

  it('still holds every shape found — the cap is display-only', () => {
    const [group] = groupViewModel(result);
    expect(group.count).toBe(8);
    expect(group.shapes).toHaveLength(8);
    expect(group.shapes.map((s) => s.fingering.shorthand)).toEqual(eight.map((f) => f.shorthand));
  });

  it('reports no hidden shapes when a group fits under the cap', () => {
    const three = { groups: [{ position: 0, fingerings: eight.slice(0, 3), total: 3 }] };
    const [group] = groupViewModel(three);
    expect(group.hiddenCount).toBe(0);
  });
});

describe('the starred-match, by chord not spelling (home-book §4.4)', () => {
  it('marks a shape whose stored leaf matches the chord, whatever its spelling', () => {
    const result = search('C7M', guitar());
    const starredShape = allFingerings(result)[0].shorthand;

    // A leaf stored under a DIFFERENT spelling of the same chord (Cmaj7 ≡ C7M).
    const shapes = [{ tuning: 'E2 A2 D3 G3 B3 E4', chord: 'Cmaj7', shorthand: starredShape }];
    const vm = groupViewModel(result, { chord: parseChord('C7M').chord, shapes });

    const marked = vm.flatMap((g) => g.shapes).filter((s) => s.starred);
    expect(marked).toHaveLength(1);
    expect(marked[0].fingering.shorthand).toBe(starredShape);
  });

  it('does not mark a shape when no leaf matches the chord', () => {
    const result = search('C7M', guitar());
    const shorthand = allFingerings(result)[0].shorthand;
    // Same shorthand, but stored for a different chord (A, not C7M): no match.
    const shapes = [{ tuning: 'E2 A2 D3 G3 B3 E4', chord: 'A', shorthand }];
    const vm = groupViewModel(result, { chord: parseChord('C7M').chord, shapes });
    expect(vm.flatMap((g) => g.shapes).some((s) => s.starred)).toBe(false);
  });

  it('starredShorthands returns the matching shorthands as a set', () => {
    const set = starredShorthands(parseChord('C7M').chord, [
      { chord: 'Cmaj7', shorthand: 'x32000' },
      { chord: 'A', shorthand: 'x02220' },
    ]);
    expect(set.has('x32000')).toBe(true);
    expect(set.has('x02220')).toBe(false);
  });
});

describe('spokenShorthand', () => {
  it('keeps the compact single-char form and spaces the dashed form', () => {
    expect(spokenShorthand('x02220')).toBe('x02220');
    expect(spokenShorthand('x-x-7-6-5-5')).toBe('x x 7 6 5 5');
  });
});
