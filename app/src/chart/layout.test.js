// unit (shell.chart) — the pure model→rows transform, no DOM. It is pinned
// against plain model-object fixtures in the reader's shape (the
// corpus/28-sung-line-layout structure, songs written for the purpose), so the
// geometry is tested without React or the reader.
//
// Pins: "sung-line layout: chords over syllables, the centred hyphen, measures
// between bar rules, sections" (shell.chart .tji note); mockups/README.md line
// 24; spec/4-lyrics.md §4.4-§4.5 (attachment, padding); spec/2-chart.md
// §2.1-§2.2 (chord lines, runs, measures and bar lines) and §2.6 (no-chord).

import { describe, it, expect } from 'vitest';
import { chartRows } from './layout.js';

// A chord item in the reader's shape; the chart reads `symbol`, `column` and
// `words` (the rest is present in the real model and ignored here).
const chord = (symbol, column, words) => ({
  type: 'chord',
  symbol,
  index: 1,
  key: symbol,
  chord: null,
  ...(column != null ? { column } : {}),
  ...(words != null ? { words } : {}),
});

const music = (lines) => ({ type: 'music', lines });
const section = (name, body) => ({ name, heading: name ? 'markdown' : null, anchor: null, body, groups: [] });
const model = (sections) => ({ title: null, properties: [], blocks: [], sung: true, sungAt: 1, diagnostics: [], sections });

describe('chartRows — sung lines', () => {
  it('yields one segment per measure-making item, chord over its attached words, with a lead segment for the leading syllables', () => {
    // "  G\nTesting": the syllables before the first chord become a `lead`
    // segment (empty chord), then G over "sting".
    const rows = chartRows(
      model([
        section('Verse', [
          music([
            {
              kind: 'sung',
              closeBar: null,
              forced: false,
              measures: [
                {
                  bar: null,
                  items: [
                    { type: 'lead', column: 0, words: 'Te' },
                    chord('G', 2, 'sting'),
                  ],
                },
              ],
            },
          ]),
        ]),
      ]),
    );
    const sung = rows.find((r) => r.type === 'sung');
    expect(sung.segments).toEqual([
      { chord: '', words: 'Te', hyphen: true, token: null },
      {
        chord: 'G',
        words: 'sting',
        hyphen: false,
        token: { symbol: 'G', key: 'G', address: { section: 0, part: 0, line: 0, measure: 0, item: 1 } },
      },
    ]);
    expect(sung.address).toEqual({ section: 0, part: 0, line: 0 });
  });

  it('sets the centred-hyphen flag between two segments that split a word and clears it at a word boundary', () => {
    // First line splits "Testing" (hyphen); second has each chord over a word
    // start, so a trailing/leading space clears the hyphen everywhere.
    const rows = chartRows(
      model([
        section('Verse', [
          music([
            {
              kind: 'sung',
              closeBar: null,
              forced: false,
              measures: [{ bar: null, items: [{ type: 'lead', column: 0, words: 'Te' }, chord('G', 2, 'sting')] }],
            },
            {
              kind: 'sung',
              closeBar: null,
              forced: false,
              measures: [
                { bar: null, items: [chord('G', 0, 'cats '), chord('D', 5, 'and '), chord('Em', 9, 'dogs')] },
              ],
            },
          ]),
        ]),
      ]),
    );
    const [split, clean] = rows.filter((r) => r.type === 'sung');
    expect(split.segments.map((s) => s.hyphen)).toEqual([true, false]);
    // "cats " / "and " each end on a space, so no hyphen opens between segments.
    expect(clean.segments.map((s) => s.hyphen)).toEqual([false, false, false]);
  });

  it('never bridges a word across a bar rule between measures', () => {
    // Two measures split a sung line; even though "some" ends tight and "more"
    // begins tight, the bar between them means no hyphen (the word does not
    // continue over a bar).
    const rows = chartRows(
      model([
        section('Verse', [
          music([
            {
              kind: 'sung',
              closeBar: null,
              forced: false,
              measures: [
                { bar: null, items: [chord('C', 0, 'some')] },
                { bar: '|', column: 5, items: [chord('G', 6, 'more')] },
              ],
            },
          ]),
        ]),
      ]),
    );
    const sung = rows.find((r) => r.type === 'sung');
    // The last segment of the first measure carries no hyphen onto the next.
    expect(sung.segments).toEqual([
      {
        chord: 'C',
        words: 'some',
        hyphen: false,
        token: { symbol: 'C', key: 'C', address: { section: 0, part: 0, line: 0, measure: 0, item: 0 } },
      },
      {
        chord: 'G',
        words: 'more',
        hyphen: false,
        token: { symbol: 'G', key: 'G', address: { section: 0, part: 0, line: 0, measure: 1, item: 0 } },
      },
    ]);
  });

  it('renders a no-chord item as N.C. and keeps an unknown token verbatim', () => {
    const rows = chartRows(
      model([
        section('Verse', [
          music([
            {
              kind: 'sung',
              closeBar: null,
              forced: false,
              measures: [
                {
                  bar: null,
                  items: [
                    { type: 'nochord', column: 0, words: 'hush ' },
                    { type: 'unknown', text: '>x', column: 5, words: 'then' },
                  ],
                },
              ],
            },
          ]),
        ]),
      ]),
    );
    const sung = rows.find((r) => r.type === 'sung');
    // A no-chord and an unknown token are not pressable (only a voiced chord is):
    // their token is null.
    expect(sung.segments).toEqual([
      { chord: 'N.C.', words: 'hush ', hyphen: false, token: null },
      { chord: '>x', words: 'then', hyphen: false, token: null },
    ]);
  });

  it('drops the non-attached structural tokens (mark, count, ending) — they take no segment', () => {
    const rows = chartRows(
      model([
        section('Verse', [
          music([
            {
              kind: 'sung',
              closeBar: null,
              forced: false,
              measures: [
                {
                  bar: null,
                  items: [
                    { type: 'nochord', column: 0, words: 'la ' },
                    { type: 'count', times: 2, column: 3 },
                    { type: 'mark', open: true, notation: 'bracket', column: 3 },
                    chord('Cm', 3, 'la'),
                  ],
                },
              ],
            },
          ]),
        ]),
      ]),
    );
    const sung = rows.find((r) => r.type === 'sung');
    // The dropped structural tokens do not shift the chord's raw item index: Cm
    // is item 3 (after the nochord, count and mark), the index cifra-md's §8.5
    // `itemAt` uses.
    expect(sung.segments).toEqual([
      { chord: 'N.C.', words: 'la ', hyphen: false, token: null },
      {
        chord: 'Cm',
        words: 'la',
        hyphen: false,
        token: { symbol: 'Cm', key: 'Cm', address: { section: 0, part: 0, line: 0, measure: 0, item: 3 } },
      },
    ]);
  });
});

describe('chartRows — chord-only lines', () => {
  it('yields one measure per measure, its chords, for a bar-lined line', () => {
    const rows = chartRows(
      model([
        section('Chart', [
          music([
            {
              kind: 'chart',
              closeBar: '|',
              measures: [
                { bar: null, items: [chord('C'), chord('Am')] },
                { bar: '|', items: [chord('F')] },
                { bar: '|', items: [chord('G')] },
              ],
            },
          ]),
        ]),
      ]),
    );
    const bars = rows.find((r) => r.type === 'bars');
    expect(bars.measures).toEqual(['C Am', 'F', 'G']);
    expect(bars.address).toEqual({ section: 0, part: 0, line: 0 });
  });

  it('carries each chord-only cell its pressable token with the §8.5 occurrence (arrange seam, Decision 3)', () => {
    const rows = chartRows(
      model([
        section('Chart', [
          music([
            {
              kind: 'chart',
              closeBar: '|',
              measures: [
                { bar: null, items: [chord('C'), chord('Am')] },
                { bar: '|', items: [chord('F')] },
              ],
            },
          ]),
        ]),
      ]),
    );
    const bars = rows.find((r) => r.type === 'bars');
    // One cell array per measure; each voiced chord carries its raw item index.
    expect(bars.cells).toEqual([
      [
        { text: 'C', token: { symbol: 'C', key: 'C', address: { section: 0, part: 0, line: 0, measure: 0, item: 0 } } },
        { text: 'Am', token: { symbol: 'Am', key: 'Am', address: { section: 0, part: 0, line: 0, measure: 0, item: 1 } } },
      ],
      [{ text: 'F', token: { symbol: 'F', key: 'F', address: { section: 0, part: 0, line: 0, measure: 1, item: 0 } } }],
    ]);
  });

  it('yields a run row for a chord line with no bar lines', () => {
    const rows = chartRows(
      model([
        section('Intro', [
          music([
            {
              kind: 'chart',
              run: true,
              closeBar: null,
              measures: [{ bar: null, items: [chord('G'), chord('D'), chord('Em'), chord('C')] }],
            },
          ]),
        ]),
      ]),
    );
    const run = rows.find((r) => r.type === 'run');
    expect(run).toMatchObject({ type: 'run', text: 'G D Em C' });
    // The run also carries pressable tokens in column order (the arrange seam).
    expect(run.tokens.map((c) => c.text)).toEqual(['G', 'D', 'Em', 'C']);
    expect(run.tokens[2].token.address).toEqual({ section: 0, part: 0, line: 0, measure: 0, item: 2 });
  });

  it('renders N.C. as a chord-only cell (spec §2.6)', () => {
    const rows = chartRows(
      model([
        section('Break', [
          music([
            {
              kind: 'chart',
              closeBar: null,
              measures: [{ bar: null, items: [{ type: 'nochord' }] }],
            },
          ]),
        ]),
      ]),
    );
    expect(rows.find((r) => r.type === 'bars').measures).toEqual(['N.C.']);
  });
});

describe('chartRows — words, breaks and sections', () => {
  it('yields a words row for a lyric line and an annotation line', () => {
    const rows = chartRows(
      model([
        section('Verse', [
          music([
            { kind: 'lyric', text: 'singing along', forced: false },
            { kind: 'annotation', text: 'repeat the chorus' },
          ]),
        ]),
      ]),
    );
    expect(rows.filter((r) => r.type === 'words').map((r) => r.text)).toEqual([
      'singing along',
      'repeat the chorus',
    ]);
  });

  it('yields a gap row for a break line', () => {
    const rows = chartRows(
      model([section('Verse', [music([{ kind: 'break' }])])]),
    );
    expect(rows.find((r) => r.type === 'gap')).toMatchObject({ type: 'gap', address: { section: 0, part: 0, line: 0 } });
  });

  it('yields a section-name row for a named section and none for the pre-heading (empty-name) section', () => {
    const rows = chartRows(
      model([
        section('', [music([{ kind: 'lyric', text: 'before any heading', forced: false }])]),
        section('Verse', [music([{ kind: 'lyric', text: 'in the verse', forced: false }])]),
      ]),
    );
    expect(rows.filter((r) => r.type === 'section')).toEqual([{ type: 'section', name: 'Verse' }]);
  });
});
