// unit — the pure instrument projection and rules logic, no Worker (the .tji
// "voicing-rule presets and the expert panel's rules"). Pins workflow 15
// L102-161 (rebuild-on-load vs. keep-exactly; rootInBass forced off with no bass
// register), L183-192 (removal), home-book §4.3–§4.5, §5.3. All fixtures are
// written for this test (no-song-text rule).

import { describe, it, expect } from 'vitest';
import { instrumentInstance } from '../core/instrument.js';
import { withOverrides, PRESETS } from '../core/heuristics.js';
import { surfaceInstruments, resolveRules, instrumentRemoval } from './instruments.js';

const AT = '2026-10-06T12:00:00.000Z';
const reg = (value) => ({ value, at: AT });

const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';
const UKE_TUNING = 'G4 C4 E4 A4';

const guitarDef = { catalogId: '6guitar', label: 'Guitar · Standard', tuning: GUITAR_TUNING, fretCount: 22 };
const ukeDef = { catalogId: 'ukulele', label: 'Ukulele · GCEA', tuning: UKE_TUNING, fretCount: 15 };

const guitar = instrumentInstance({ catalogId: '6guitar', strings: GUITAR_TUNING, fretCount: 22 });
const uke = instrumentInstance({ catalogId: 'ukulele', strings: UKE_TUNING, fretCount: 15 });

describe('surfaceInstruments (projection)', () => {
  it('projects well-formed entries, resolves an absent in-use to the standard guitar, and drops a malformed entry', () => {
    const model = {
      instruments: {
        g1: { definition: reg(guitarDef), rules: reg({ preset: 'strumming' }) },
        u1: { definition: reg(ukeDef), rules: reg({ preset: 'fingerstyle' }) },
        // malformed: definition is not a {value,at} register → dropped
        bad: { definition: { catalogId: '6guitar' }, rules: reg({ preset: 'jazz' }) },
        // malformed: tuning missing from the definition value → dropped
        bad2: { definition: reg({ catalogId: '6guitar', fretCount: 22 }), rules: reg({ preset: 'jazz' }) },
      },
      preferences: {},
      shapes: {},
    };
    const out = surfaceInstruments(model);
    expect(out.instruments.map((e) => e.id).sort()).toEqual(['g1', 'u1']);
    // absent instrumentInUse → the standard guitar (null id), the §6 identity.
    expect(out.inUseId).toBeNull();
    expect(out.standard.catalogId).toBe('6guitar');
    expect(out.standard.tuning).toBe('E2 A2 D3 G3 B3 E4');
    // the roster carries the preset, string count and bass register the view needs
    const g = out.instruments.find((e) => e.id === 'g1');
    expect(g.presetId).toBe('strumming');
    expect(g.stringCount).toBe(6);
    expect(g.hasBass).toBe(true);
  });

  it('resolves the in-use id, and falls back to the standard guitar when it points at a gone instrument', () => {
    const instruments = { g1: { definition: reg(guitarDef), rules: reg({ preset: 'strumming' }) } };
    expect(
      surfaceInstruments({ instruments, preferences: { instrumentInUse: reg('g1') } }).inUseId,
    ).toBe('g1');
    expect(
      surfaceInstruments({ instruments, preferences: { instrumentInUse: reg('gone') } }).inUseId,
    ).toBeNull();
  });

  it('skips a tombstoned definition (a removed instrument) and surfaces only live shapes', () => {
    const model = {
      instruments: {
        g1: { definition: reg(guitarDef), rules: reg({ preset: 'strumming' }) },
        dead: { definition: reg(null), rules: reg(null) },
      },
      preferences: {},
      shapes: {
        g1: {
          [GUITAR_TUNING]: {
            Em: reg('022000'),
            G: reg(null), // tombstoned shape → not surfaced
          },
        },
      },
    };
    const out = surfaceInstruments(model);
    expect(out.instruments.map((e) => e.id)).toEqual(['g1']);
    expect(out.instruments[0].shapes).toEqual([
      { tuning: GUITAR_TUNING, chord: 'Em', shorthand: '022000' },
    ]);
  });
});

describe('resolveRules (rebuild-on-load vs. keep-exactly)', () => {
  it('rebuilds a named preset from the catalogue (so a later correction reaches an old set-up)', () => {
    const { presetId, config } = resolveRules(guitar, { preset: 'jazz' });
    expect(presetId).toBe('jazz');
    expect(config.allowRootless).toBe(PRESETS.jazz.allowRootless);
    expect(config.allowInnerMutes).toBe(PRESETS.jazz.allowInnerMutes);
  });

  it('keeps a Custom config exactly', () => {
    const custom = withOverrides(
      { ...PRESETS.strumming, weights: { ...PRESETS.strumming.weights }, preset: 'strumming' },
      { allowRootless: true, maxSpan: 5 },
    );
    expect(custom.preset).toBe('custom');
    const { presetId, config } = resolveRules(guitar, { preset: 'custom', config: custom });
    expect(presetId).toBe('custom');
    expect(config.allowRootless).toBe(true);
    expect(config.maxSpan).toBe(5);
  });

  it('forces rootInBass off on an instrument with no bass register — preset and custom alike', () => {
    // A guitar has a bass register, so strumming's rootInBass survives.
    expect(resolveRules(guitar, { preset: 'strumming' }).config.rootInBass).toBe(true);
    // A ukulele has none, so it is forced off even though strumming asks for it.
    expect(resolveRules(uke, { preset: 'strumming' }).config.rootInBass).toBe(false);
    // And forced off for a Custom config that tried to turn it on.
    const custom = { ...PRESETS.strumming, weights: { ...PRESETS.strumming.weights }, rootInBass: true, preset: 'custom' };
    expect(resolveRules(uke, { preset: 'custom', config: custom }).config.rootInBass).toBe(false);
  });

  it('withOverrides flips the preset label to Custom when an edit diverges', () => {
    const base = resolveRules(guitar, { preset: 'strumming' }).config;
    expect(withOverrides(base, { allowRootless: true }).preset).toBe('custom');
  });

  it('falls back to the catalogue default for an absent or unknown rules value', () => {
    expect(resolveRules(guitar, null).presetId).toBe('strumming');
    expect(resolveRules(guitar, { preset: 'nonesuch' }).presetId).toBe('strumming');
  });
});

describe('instrumentRemoval (change-set builder)', () => {
  const base = {
    instruments: {
      g1: { definition: reg(guitarDef), rules: reg({ preset: 'strumming' }) },
      g2: { definition: reg({ ...guitarDef, label: 'Guitar · Drop D', tuning: 'D2 A2 D3 G3 B3 E4' }), rules: reg({ preset: 'fingerstyle' }) },
    },
    shapes: {
      g1: { [GUITAR_TUNING]: { Em: reg('022000'), G: reg('320003') } },
    },
    songs: {
      'song-a': { variation: { [GUITAR_TUNING]: reg('v1'), 'D2 A2 D3 G3 B3 E4': reg('v2') } },
    },
    preferences: { instrumentInUse: reg('g1') },
  };

  it('tombstones the two registers and every shapes leaf', () => {
    const changes = instrumentRemoval({ id: 'g1', ...base });
    expect(changes.instruments).toEqual([
      { path: ['g1', 'definition'], value: null },
      { path: ['g1', 'rules'], value: null },
    ]);
    expect(changes.shapes).toEqual([
      { path: ['g1', GUITAR_TUNING, 'Em'], value: null },
      { path: ['g1', GUITAR_TUNING, 'G'], value: null },
    ]);
  });

  it("tombstones a song variation only when no remaining instrument still uses that tuning", () => {
    // g1 is the only instrument on E2 A2 D3 G3 B3 E4 → its variation goes.
    const changes = instrumentRemoval({ id: 'g1', ...base });
    expect(changes.songs).toEqual([
      { path: ['song-a', 'variation', GUITAR_TUNING], value: null },
    ]);

    // A sibling instrument shares the tuning → the variation is kept.
    const shared = {
      ...base,
      instruments: {
        g1: base.instruments.g1,
        g3: { definition: reg({ ...guitarDef, label: 'Guitar · Capo' }), rules: reg({ preset: 'jazz' }) },
      },
    };
    expect(instrumentRemoval({ id: 'g1', ...shared }).songs).toEqual([]);
  });

  it('clears instrumentInUse when the removed instrument was in use', () => {
    expect(instrumentRemoval({ id: 'g1', ...base }).preferences).toEqual([
      { path: ['instrumentInUse'], value: null },
    ]);
    // Removing a NOT-in-use instrument with others remaining leaves it alone.
    expect(instrumentRemoval({ id: 'g2', ...base }).preferences).toEqual([]);
  });

  it('clears instrumentInUse when the last instrument goes', () => {
    const only = {
      instruments: { g1: base.instruments.g1 },
      shapes: {},
      songs: {},
      preferences: {},
    };
    expect(instrumentRemoval({ id: 'g1', ...only }).preferences).toEqual([
      { path: ['instrumentInUse'], value: null },
    ]);
  });
});
