// Unit tests for conflict-model.js — the pure mapper from a cifra.md merge
// `Outcome` (spec §11.12.1) to the conflict view model (workflow 9 §Settling
// one). Fed fixed `Outcome`s shaped as cifra.md `merge` returns them (the
// members of §11.12.5), with fake songs written for the purpose — no git, no
// React, no cifra.md. One case per kind the screens draw, the reading-view
// marked-line derivation, and the ordering/labels (ours first; the incoming
// author for theirs).

import { describe, it, expect } from 'vitest';
import { songConflictModel, disputedChartLines, voicingKeepBothOp } from './conflict-model.js';

describe('songConflictModel', () => {
  it('maps a chart conflict to each side as its run of bar lines (§11.12.1)', () => {
    // A bar both people reworded (merge corpus shape: ours/theirs are runs).
    const outcome = {
      kind: 'conflicts',
      marked: '## Parte\n```\n<<<<<<< ours\nDm | G7 | C7 | F7M\n=======\nDm | G7 | C7 | Fmaj7\n>>>>>>> theirs\n```\n',
      conflicts: [
        {
          kind: 'chart',
          line: 3,
          base: ['Dm | G7 | C7 | F'],
          ours: ['Dm | G7 | C7 | F7M'],
          theirs: ['Dm | G7 | C7 | Fmaj7'],
        },
      ],
    };
    const model = songConflictModel(outcome, { author: 'Ana' });
    expect(model.count).toBe(1);
    expect(model.file).toBeNull();
    const [item] = model.items;
    expect(item.kind).toBe('chart');
    expect(item.line).toBe(3);
    expect(item.ours).toEqual(['Dm | G7 | C7 | F7M']);
    expect(item.theirs).toEqual(['Dm | G7 | C7 | Fmaj7']);
    expect(item.base).toEqual(['Dm | G7 | C7 | F']);
  });

  it('maps a voicing conflict to each side diagram with its tuning/variation/key, and the chord (§11.12.1)', () => {
    const outcome = {
      kind: 'conflicts',
      marked: '## Voicings: E2 A2 D3 G3 B3 E4\n<<<<<<< ours\n- Cm[2]: x35543\n=======\n- Cm[2]: 7-10-10-8-8-8\n>>>>>>> theirs\n',
      conflicts: [
        {
          kind: 'voicing',
          line: 2,
          tuning: 'E2 A2 D3 G3 B3 E4',
          variation: '',
          key: 'Cm[2]',
          base: '8-10-10-8-8-8',
          ours: 'x35543',
          theirs: '7-10-10-8-8-8',
        },
      ],
    };
    const [item] = songConflictModel(outcome, { author: 'Ana' }).items;
    expect(item.kind).toBe('voicing');
    expect(item.tuning).toBe('E2 A2 D3 G3 B3 E4');
    expect(item.variation).toBe('');
    expect(item.key).toBe('Cm[2]');
    expect(item.chord).toBe('Cm'); // key without the occurrence index (§8.4.6)
    expect(item.ours).toBe('x35543');
    expect(item.theirs).toBe('7-10-10-8-8-8');
  });

  it('maps a property conflict to each side value with the property key', () => {
    const outcome = {
      kind: 'conflicts',
      marked: '# Song\n<<<<<<< ours\n- artist: Pixinguinha\n=======\n- artist: Pixinguinha e Benedito Lacerda\n>>>>>>> theirs\n',
      conflicts: [
        { kind: 'property', line: 2, key: 'artist', base: 'Unknown', ours: 'Pixinguinha', theirs: 'Pixinguinha e Benedito Lacerda' },
      ],
    };
    const [item] = songConflictModel(outcome, { author: 'Ana' }).items;
    expect(item.kind).toBe('property');
    expect(item.key).toBe('artist');
    expect(item.ours).toBe('Pixinguinha');
    expect(item.theirs).toBe('Pixinguinha e Benedito Lacerda');
  });

  it('maps a title conflict to each side value', () => {
    const outcome = {
      kind: 'conflicts',
      marked: '<<<<<<< ours\n# Pequena\n=======\n# Tiny\n>>>>>>> theirs\n',
      conflicts: [{ kind: 'title', line: 1, base: 'Small', ours: 'Pequena', theirs: 'Tiny' }],
    };
    const [item] = songConflictModel(outcome, {}).items;
    expect(item.kind).toBe('title');
    expect(item.ours).toBe('Pequena');
    expect(item.theirs).toBe('Tiny');
  });

  it('maps a deleted-vs-edited (file) conflict to the whole-file choice, not a region item', () => {
    // Theirs deleted the song; ours edited it (workflow 9 §Settling one).
    const outcome = { kind: 'conflicts', marked: null, conflicts: [{ kind: 'file', deleted: 'theirs' }] };
    const model = songConflictModel(outcome, { author: 'Ana' });
    expect(model.count).toBe(0);
    expect(model.items).toEqual([]);
    expect(model.file).toEqual({ kind: 'file', deleted: 'theirs', base: null, ours: null, theirs: null });
    expect(model.marked).toBeNull();
  });

  it('carries the incoming author for theirs, and keeps the regions in order with ours first', () => {
    const outcome = {
      kind: 'conflicts',
      marked: 'm',
      conflicts: [
        { kind: 'chart', line: 5, base: ['a'], ours: ['a1'], theirs: ['a2'] },
        { kind: 'voicing', line: 13, tuning: 'E A D G B E', variation: '', key: 'G7', base: null, ours: '320001', theirs: '353433' },
      ],
    };
    const model = songConflictModel(outcome, { author: 'Ana' });
    expect(model.author).toBe('Ana');
    expect(model.marked).toBe('m');
    // Region order preserved (the merge sorts by line); ours is a named field,
    // always before theirs when the view lays the two cards out.
    expect(model.items.map((i) => i.line)).toEqual([5, 13]);
    expect(model.items[0]).toMatchObject({ ours: ['a1'], theirs: ['a2'] });
  });
});

describe('disputedChartLines', () => {
  it('collects the ours side of every chart/sections region a reading view marks (§11.12.1)', () => {
    const outcome = {
      kind: 'conflicts',
      marked: 'm',
      conflicts: [
        { kind: 'chart', line: 3, base: ['F | F'], ours: ['G7 | C7 | F | F'], theirs: ['D7 | C7 | F | F'] },
        { kind: 'voicing', line: 20, tuning: 'E A D G B E', variation: '', key: 'G7', ours: '320001', theirs: '353433' },
        { kind: 'sections', line: 30, base: [], ours: ['## Ponte\nAm | Dm'], theirs: ['## Ponte\nA7 | Dm'] },
      ],
    };
    // Chart + sections contribute their ours lines (sections split on LF);
    // a voicing has no chart line to mark.
    expect(disputedChartLines(outcome)).toEqual(['G7 | C7 | F | F', '## Ponte', 'Am | Dm']);
  });

  it('is empty for a whole-file conflict (no region)', () => {
    expect(disputedChartLines({ kind: 'conflicts', conflicts: [{ kind: 'file', deleted: 'ours' }] })).toEqual([]);
  });
});

// Unit — voicingKeepBothOp, the keep-both descriptor for a voicing conflict
// (sync.keep_both Decision 2): what the Worker needs to write theirs's shape
// into a variation named for the author, copied from the in-use block.
describe('voicingKeepBothOp', () => {
  const voicing = {
    kind: 'voicing',
    line: 2,
    tuning: 'E2 A2 D3 G3 B3 E4',
    variation: '',
    key: 'Cm[2]',
    base: '8-10-10-8-8-8',
    ours: 'x35543',
    theirs: '7-10-10-8-8-8',
  };

  it('carries the tuning, in-use variation to copy, key and theirs shorthand (§7.3/§8.4.6)', () => {
    expect(voicingKeepBothOp(voicing, 'Ana')).toEqual({
      tuning: 'E2 A2 D3 G3 B3 E4',
      copyFrom: '', // the default variation the conflict lives in
      key: 'Cm[2]',
      shorthand: '7-10-10-8-8-8',
      name: 'Ana',
    });
  });

  it('drops a ` (fingers)` suffix, keeping only the frets (the shape, not its fingering)', () => {
    const withFingers = { ...voicing, theirs: 'x32010 (- 3 2 - 1 -)' };
    expect(voicingKeepBothOp(withFingers, 'Ana').shorthand).toBe('x32010');
  });

  it('returns null for a non-voicing conflict, a voicing with no theirs, or no author', () => {
    expect(voicingKeepBothOp({ kind: 'chart', ours: ['C | G'], theirs: ['C | Am'] }, 'Ana')).toBeNull();
    expect(voicingKeepBothOp({ ...voicing, theirs: undefined }, 'Ana')).toBeNull();
    expect(voicingKeepBothOp(voicing, null)).toBeNull();
  });
});
