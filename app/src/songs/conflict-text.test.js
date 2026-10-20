// unit — the conflict resolver's pure text helpers (sync.conflicts_editing;
// workflow 9 §Settling one; W09#1 L42, W09#3; cifra.md §2.8, §11.12.2-3). Songs
// written for the purpose (no-song-text rule).

import { describe, it, expect } from 'vitest';
import { parse, isMarkerLine } from 'cifra-md';
import { labelMarkers, conflictPlace, differingMeasures, conflictTitle, conflictSummary } from './conflict-text.js';
import { t } from '../i18n/index.js';

const MARKED = [
  '## Parte',
  '```',
  '<<<<<<< ours',
  'C | G7 | F | F',
  '<<<<<<< ours extra',
  '=======',
  'C | G7 | D7 | F',
  '>>>>>>> theirs',
  '```',
  '',
].join('\n');

describe('labelMarkers', () => {
  it("labelMarkers renames only the format's own marker lines (sync.conflicts_editing; workflow 9 §Settling one; cifra.md §11.12.2-3)", () => {
    const out = labelMarkers(MARKED, { yours: 'yours', theirs: 'Ana’s' });
    const inLines = MARKED.split('\n');
    const outLines = out.split('\n');
    expect(outLines).toHaveLength(inLines.length);
    expect(outLines[2]).toBe('<<<<<<< yours');
    expect(outLines[7]).toBe('>>>>>>> Ana’s');
    // Everything else is byte for byte: `=======`, a labelled-but-not-ours
    // marker, and the body lines.
    for (const i of [0, 1, 3, 4, 5, 6, 8, 9]) expect(outLines[i]).toBe(inLines[i]);
    expect(out).not.toContain('<<<<<<< ours\n');
    expect(out).not.toContain('>>>>>>> theirs');

    // A name holding a newline (or any whitespace run) stays on its line.
    const split = labelMarkers(MARKED, { yours: 'yours', theirs: 'Ana\nMaria\t Souza' });
    expect(split.split('\n')).toHaveLength(inLines.length);
    expect(split.split('\n')[7]).toBe('>>>>>>> Ana Maria Souza');

    // Every marker line is still a marker line, so the Worker still refuses it.
    for (const text of [out, split]) {
      const lines = text.split('\n');
      for (const i of [2, 4, 5, 7]) expect(isMarkerLine(lines[i])).toBe(true);
    }
  });
});

// Two lines of Primeira parte: bars 1-4, then 5-8 (cifra.md §2.8).
const OURS_SONG = ['## Primeira parte', '```', 'F | F | C7 | C7', 'Db7 | C7 | F | F', '```', ''].join('\n');

describe('conflictPlace', () => {
  it('conflictPlace names the section and the differing bar (W09#1 L42)', () => {
    const model = parse(OURS_SONG);
    expect(conflictPlace(model, { kind: 'chart', ours: ['Db7 | C7 | F | F'], theirs: ['G7 | C7 | F | F'] }))
      .toEqual({ section: 'Primeira parte', bars: [5] });

    // Two differing measures give two bars.
    expect(conflictPlace(model, { kind: 'chart', ours: ['Db7 | C7 | F | F'], theirs: ['G7 | C7 | Bb | F'] }))
      .toEqual({ section: 'Primeira parte', bars: [5, 7] });

    // A two-line region: only the differing measures, across both lines.
    expect(conflictPlace(model, {
      kind: 'chart',
      ours: ['F | F | C7 | C7', 'Db7 | C7 | F | F'],
      theirs: ['F | F | C7 | Gm', 'Db7 | C7 | F | F'],
    })).toEqual({ section: 'Primeira parte', bars: [4] });

    // An anchored section (§2.8, `## A @9`) uses the stated numbers.
    const anchored = parse(OURS_SONG.replace('## Primeira parte', '## Primeira parte @9'));
    expect(conflictPlace(anchored, { kind: 'chart', ours: ['Db7 | C7 | F | F'], theirs: ['G7 | C7 | F | F'] }))
      .toEqual({ section: 'Primeira parte', bars: [13] });

    // A theirs line shorter than ours: the extra measures of ours differ.
    expect(conflictPlace(model, { kind: 'chart', ours: ['Db7 | C7 | F | F'], theirs: ['Db7 | C7'] }))
      .toEqual({ section: 'Primeira parte', bars: [7, 8] });
  });

  it('conflictPlace falls back', () => {
    const model = parse(OURS_SONG);

    // A sections conflict names the section, with no bar.
    expect(conflictPlace(model, {
      kind: 'sections',
      ours: ['## Primeira parte\n```\nF | F | C7 | C7\nDb7 | C7 | F | F\n```'],
      theirs: ['## Primeira parte\n```\nF | F | C7 | C7\n```'],
    })).toEqual({ section: 'Primeira parte', bars: [] });

    // A run row (§2.1) is not a bar: the section, no bar.
    const run = parse(['## Introdução', '```', 'F C7 F', '```', ''].join('\n'));
    expect(conflictPlace(run, { kind: 'chart', ours: ['F C7 F'], theirs: ['F Db7 F'] }))
      .toEqual({ section: 'Introdução', bars: [] });

    // An unnamed section (the text before any heading) cannot be named.
    const unnamed = parse(['```', 'F | F | C7 | C7', '```', ''].join('\n'));
    expect(conflictPlace(unnamed, { kind: 'chart', ours: ['F | F | C7 | C7'], theirs: ['F | F | C7 | Gm'] }))
      .toBeNull();

    // A region missing from the model cannot be placed.
    expect(conflictPlace(model, { kind: 'chart', ours: ['Am | Am | E7 | E7'], theirs: ['Am | Am | E7 | A7'] }))
      .toBeNull();
  });
});

describe('differingMeasures', () => {
  it('lists the measures of a side that differ from the other, position by position (sync.conflicts_polish constraint 1)', () => {
    const item = { kind: 'chart', ours: ['C | G7 | F | F'], theirs: ['C | Db7 | F | F'] };
    expect(differingMeasures(item, 'ours')).toEqual(['G7']);
    expect(differingMeasures(item, 'theirs')).toEqual(['Db7']);
    // A measure past the other side's end counts as different; a line only one
    // side has is wholly different.
    const longer = { kind: 'chart', ours: ['C | G', 'Am | F'], theirs: ['C | G | E7'] };
    expect(differingMeasures(longer, 'theirs')).toEqual(['E7']);
    expect(differingMeasures(longer, 'ours')).toEqual(['Am', 'F']);
    // An absent side, a sections item and other kinds have none.
    expect(differingMeasures({ kind: 'chart', ours: ['C | G'], theirs: null }, 'theirs')).toEqual([]);
    expect(differingMeasures({ kind: 'sections', ours: ['## A\n```\nC\n```'], theirs: [] }, 'ours')).toEqual([]);
    expect(differingMeasures({ kind: 'voicing', ours: '320001', theirs: 'x43424' }, 'ours')).toEqual([]);
  });
});

// sync.conflicts_row_summary: the titles the resolver heading and the book
// panel's *In conflict* row share, with `t` at the default (en) locale.
describe('conflictTitle', () => {
  it('conflictTitle names each kind as the resolver heading does (workflow 9 §Settling one; W09#1 L42)', () => {
    const model = parse(OURS_SONG);
    const chart = (theirs) => ({ kind: 'chart', ours: ['Db7 | C7 | F | F'], theirs: [theirs] });
    expect(conflictTitle(chart('G7 | C7 | F | F'), model, t)).toBe('Primeira parte, bar 5');
    expect(conflictTitle(chart('G7 | C7 | Bb | F'), model, t)).toBe('Primeira parte, bars 5 and 7');
    expect(conflictTitle(chart('G7 | D7 | Bb | F'), model, t)).toBe('Primeira parte, bars 5–7');
    expect(conflictTitle({ kind: 'sections', ours: ['## Primeira parte\n```\nF | F | C7 | C7\n```'] }, model, t))
      .toBe('Primeira parte');
    // Unplaceable: a line not in the song, or no model at all.
    expect(conflictTitle({ kind: 'chart', ours: ['A | B | C | D'], theirs: ['A | B | C | E'] }, model, t))
      .toBe('A bar you both changed');
    expect(conflictTitle(chart('G7 | C7 | F | F'), null, t)).toBe('A bar you both changed');
    expect(conflictTitle({ kind: 'voicing', chord: 'G7' }, model, t)).toBe('The shape for G7');
    expect(conflictTitle({ kind: 'property', key: 'key' }, model, t)).toBe('The key');
    expect(conflictTitle({ kind: 'title' }, model, t)).toBe('The title');
    expect(conflictTitle({ kind: 'something-else' }, model, t)).toBe('A change you both made');
  });
});

// A marked text whose ours side is OURS_SONG: the second line of Primeira parte
// is the disputed region (bars 5-8).
const SUMMARY_MARKED = [
  '## Primeira parte',
  '```',
  'F | F | C7 | C7',
  '<<<<<<< ours',
  'Db7 | C7 | F | F',
  '=======',
  'G7 | C7 | F | F',
  '>>>>>>> theirs',
  '```',
  '',
].join('\n');
const CHART_ITEM = { kind: 'chart', ours: ['Db7 | C7 | F | F'], theirs: ['G7 | C7 | F | F'] };
const VOICING_ITEM = { kind: 'voicing', chord: 'G7', key: 'G7', tuning: 'E2 A2 D3 G3 B3 E4', ours: '320001', theirs: '353433' };

describe('conflictSummary', () => {
  it('conflictSummary joins the distinct titles of a song\'s conflicts with ` · ` (W09#4 L222)', () => {
    expect(conflictSummary({ marked: SUMMARY_MARKED, items: [CHART_ITEM, VOICING_ITEM] }, t))
      .toBe('Primeira parte, bar 5 · The shape for G7');
    // Two items with the same title appear once, in item order.
    expect(conflictSummary({ marked: SUMMARY_MARKED, items: [VOICING_ITEM, CHART_ITEM, { ...VOICING_ITEM, variation: 'B' }] }, t))
      .toBe('The shape for G7 · Primeira parte, bar 5');
    expect(conflictSummary({ marked: SUMMARY_MARKED, items: [] }, t)).toBeNull();
  });

  it('conflictSummary falls back without throwing when marked is absent or unreadable', () => {
    for (const marked of [null, '<<<<<<< ours\nDb7 | C7']) {
      expect(conflictSummary({ marked, items: [CHART_ITEM, VOICING_ITEM] }, t))
        .toBe('A bar you both changed · The shape for G7');
    }
  });
});

// songs.render_notes Decision 5 — chartPlace matches over music rows only, so a
// note between two fences of one section (now a chart row of its own) does not
// break a disputed run that spans both fences: it is placed as before.
describe('conflictPlace — a note between two fences', () => {
  const fenced = (between) => parse([
    '## Primeira parte',
    '```',
    'F | F | C7 | C7',
    '```',
    '',
    ...between,
    '```',
    'Db7 | C7 | F | F',
    '```',
    '',
  ].join('\n'));
  const item = { kind: 'chart', ours: ['F | F | C7 | C7', 'Db7 | C7 | F | F'], theirs: ['F | F | C7 | C7', 'G7 | C7 | F | F'] };

  it('places the disputed lines as it does with no note there', () => {
    const withNote = fenced(['Mais devagar na segunda vez.', '']);
    const without = fenced([]);
    const place = conflictPlace(withNote, item);
    expect(place).not.toBeNull();
    expect(place.section).toBe('Primeira parte');
    expect(place).toEqual(conflictPlace(without, item));
  });
});
