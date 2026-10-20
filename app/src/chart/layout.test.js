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
import { parse } from 'cifra-md';
import { chartRows, isEmptySong } from './layout.js';
import { template } from '../editor/template.js';

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
      { chord: '', words: 'Te', hyphen: true, tail: false, token: null, voice: { type: 'lead' } },
      {
        chord: 'G',
        words: 'sting',
        hyphen: false,
        tail: false,
        token: { symbol: 'G', key: 'G', address: { section: 0, part: 0, line: 0, measure: 0, item: 1 } },
        voice: { type: 'chord', chord: null, footnote: 1 },
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
        tail: false,
        token: { symbol: 'C', key: 'C', address: { section: 0, part: 0, line: 0, measure: 0, item: 0 } },
        voice: { type: 'chord', chord: null, footnote: 1 },
      },
      {
        chord: 'G',
        words: 'more',
        hyphen: false,
        tail: false,
        token: { symbol: 'G', key: 'G', address: { section: 0, part: 0, line: 0, measure: 1, item: 0 } },
        voice: { type: 'chord', chord: null, footnote: 1 },
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
      { chord: 'N.C.', words: 'hush ', hyphen: false, tail: false, token: null, voice: { type: 'nochord' } },
      { chord: '>x', words: 'then', hyphen: false, tail: false, token: null, voice: { type: 'unknown', text: '>x' } },
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
      { chord: 'N.C.', words: 'la ', hyphen: false, tail: false, token: null, voice: { type: 'nochord' } },
      {
        chord: 'Cm',
        words: 'la',
        hyphen: false,
        tail: false,
        token: { symbol: 'Cm', key: 'Cm', address: { section: 0, part: 0, line: 0, measure: 0, item: 3 } },
        voice: { type: 'chord', chord: null, footnote: 1 },
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
        { text: 'C', token: { symbol: 'C', key: 'C', address: { section: 0, part: 0, line: 0, measure: 0, item: 0 } }, voice: { type: 'chord', chord: null, footnote: 1 } },
        { text: 'Am', token: { symbol: 'Am', key: 'Am', address: { section: 0, part: 0, line: 0, measure: 0, item: 1 } }, voice: { type: 'chord', chord: null, footnote: 1 } },
      ],
      [{ text: 'F', token: { symbol: 'F', key: 'F', address: { section: 0, part: 0, line: 0, measure: 1, item: 0 } }, voice: { type: 'chord', chord: null, footnote: 1 } }],
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

// songs.render_notes — the chart draws the whole body in document order
// (DIRECTION §3.7): a notes part in its place among the fences, a verbatim
// fence as one block (cifra.md spec/1-document.md §1.9).
describe('chartRows — notes and verbatim', () => {
  const sungLine = (words) => ({
    kind: 'sung',
    closeBar: null,
    measures: [{ items: [chord('G', 0, words)] }],
  });
  const notes = (text) => ({ type: 'notes', text });
  const verbatim = (info, text) => ({ type: 'verbatim', info, text });

  it('a section [music, notes, music] yields the notes row between the two parts (spec §1.9: position relative to the fences)', () => {
    const rows = chartRows(
      model([section('Verse', [music([sungLine('one')]), notes('Softer the second time.'), music([sungLine('two')])])]),
    );
    expect(rows.map((r) => r.type)).toEqual(['section', 'sung', 'notes', 'sung']);
    expect(rows[1].address).toEqual({ section: 0, part: 0, line: 0 });
    expect(rows[2]).toEqual({ type: 'notes', paragraphs: ['Softer the second time.'], address: { section: 0, part: 1 } });
    expect(rows[3].address).toEqual({ section: 0, part: 2, line: 0 });
  });

  it('splits notes into paragraphs on blank lines, keeping inner and leading spaces (spec §1.3)', () => {
    const rows = chartRows(model([section('Verse', [notes('Softer the second time.\n\nThen   louder.\n  indented')])]));
    expect(rows[1].paragraphs).toEqual(['Softer the second time.', 'Then   louder.\n  indented']);
  });

  it('treats a whitespace-only line as a blank line between paragraphs', () => {
    const rows = chartRows(model([section('Verse', [notes('first\n   \n\nsecond')])]));
    expect(rows[1].paragraphs).toEqual(['first', 'second']);
  });

  it('passes Markdown in notes through unchanged (spec §1.9: notes are never interpreted)', () => {
    const rows = chartRows(model([section('Verse', [notes('**bold** and _soft_ and [x](y) and <b>')])]));
    expect(rows[1].paragraphs).toEqual(['**bold** and _soft_ and [x](y) and <b>']);
  });

  it('a verbatim part yields one row with its text whole, blank line kept (spec §1.9)', () => {
    const rows = chartRows(model([section('Verse', [verbatim('tab', 'e|--3--|\n\nB|--0--|')])]));
    expect(rows[1]).toEqual({ type: 'verbatim', info: 'tab', text: 'e|--3--|\n\nB|--0--|', address: { section: 0, part: 0 } });
  });

  it('an empty verbatim fence still yields its row; an empty notes part yields none', () => {
    const rows = chartRows(model([section('Verse', [verbatim('strum', ''), notes(''), notes('  \n ')])]));
    expect(rows.map((r) => r.type)).toEqual(['section', 'verbatim']);
    expect(rows[1].text).toBe('');
  });

  it('an empty-name section holding only notes yields the notes row and no section row (spec §1.8)', () => {
    const rows = chartRows(model([section('', [notes('[G]Walk the [C]road')])]));
    expect(rows).toEqual([{ type: 'notes', paragraphs: ['[G]Walk the [C]road'], address: { section: 0, part: 0 } }]);
  });

  it('parsed: notes before the first heading, a note between two fences and a tab block come in document order', () => {
    const src = [
      '# Riverside Walk',
      '',
      'Play it gently.',
      '',
      '## Verse',
      '```',
      'G      C',
      'Down by the water',
      '```',
      '',
      'Softer the second time.',
      '',
      '```',
      'C | G',
      '```',
      '',
      '```tab',
      'e|--3--|',
      'B|--0--|',
      '```',
      '',
    ].join('\n');
    const rows = chartRows(parse(src));
    expect(rows.map((r) => r.type)).toEqual(['notes', 'section', 'sung', 'notes', 'bars', 'verbatim']);
    expect(rows[0].paragraphs).toEqual(['Play it gently.']);
    expect(rows[3].paragraphs).toEqual(['Softer the second time.']);
    expect(rows[5]).toMatchObject({ info: 'tab', text: 'e|--3--|\nB|--0--|' });
  });
});

describe('chartRows — a chord past the end of the words', () => {
  // songs.trailing_chord_gap: a chord attached at or past the end of the words
  // has no words (spec/4-lyrics.md §4.4 :170) and is "a chord with an empty
  // segment" (§4.8 :371-372); the layout marks it `tail` when words precede it on
  // the line, so the view keeps it apart from the last word.
  const sungLine = (measures) =>
    chartRows(model([section('Verse', [music([{ kind: 'sung', closeBar: null, forced: false, measures }])])])).find(
      (r) => r.type === 'sung',
    );

  it('a chord past the end of the words is a tail segment', () => {
    const sung = sungLine([{ bar: null, items: [chord('G', 0, 'the tide'), chord('D', 12, '')] }]);
    expect(sung.segments[0]).toMatchObject({ chord: 'G', words: 'the tide', tail: false, hyphen: false });
    expect(sung.segments[1]).toMatchObject({ chord: 'D', words: '', tail: true, hyphen: false });
  });

  it('a chord exactly at the end of the words is a tail too', () => {
    // As the reader gives it: D at column 9, exactly the end of "the night" (no space even in the source).
    const rows = chartRows(parse(['## Verse', '```', 'G        D', 'the night', '```', ''].join('\n')));
    const sung = rows.find((r) => r.type === 'sung');
    expect(sung.segments.map(({ chord: c, words, tail, hyphen }) => ({ chord: c, words, tail, hyphen }))).toEqual([
      { chord: 'G', words: 'the night', tail: false, hyphen: false },
      { chord: 'D', words: '', tail: true, hyphen: false },
    ]);
  });

  it('only the first of two chords past the end is a tail', () => {
    // The second is already spaced by the first chord's own padding.
    const sung = sungLine([{ bar: null, items: [chord('G', 0, 'home'), chord('D', 6, ''), chord('Em', 8, '')] }]);
    expect(sung.segments.map((s) => s.tail)).toEqual([false, true, false]);
  });

  it('a tail across a bar', () => {
    // A sung row draws no bar rule, so the past-end chord after a bar would be
    // glued to the words just the same.
    const sung = sungLine([
      { bar: null, items: [chord('C', 0, 'away')] },
      { bar: '|', column: 5, items: [chord('G', 7, '')] },
    ]);
    expect(sung.segments.map((s) => s.tail)).toEqual([false, true]);
  });

  it('no tail after words of only spaces, on a chord with words of its own, or on the first segment', () => {
    const afterSpaces = sungLine([{ bar: null, items: [chord('C', 0, '   '), chord('G', 3, '')] }]);
    expect(afterSpaces.segments.map((s) => s.tail)).toEqual([false, false]);
    const withWords = sungLine([{ bar: null, items: [chord('C', 0, 'one '), chord('G', 4, 'two')] }]);
    expect(withWords.segments.map((s) => s.tail)).toEqual([false, false]);
    const firstEmpty = sungLine([{ bar: null, items: [chord('C', 0, ''), chord('G', 2, '')] }]);
    expect(firstEmpty.segments.map((s) => s.tail)).toEqual([false, false]);
    const lead = sungLine([{ bar: null, items: [{ type: 'lead', column: 0, words: 'Oh ' }, chord('G', 3, 'yes')] }]);
    expect(lead.segments.map((s) => s.tail)).toEqual([false, false]);
  });
});

// songs.empty_states — workflow 2 §Nothing written yet (L118-120: when a song
// is empty; L124-126: an empty section in a song with content). Emptiness is
// judged from the chart's own rows (Decision 1).
describe('isEmptySong — workflow 2 L118-120', () => {
  const lines = (...ls) => ['# Pebble Road', '- artist:', '- notation: brazilian', '', ...ls, ''].join('\n');

  it('is true for the untouched new-song template', () => {
    const { text } = template(undefined, { title: 'Pebble Road' });
    expect(isEmptySong(parse(text))).toBe(true);
  });

  it('is true for a song of headings only (bodies [])', () => {
    const m = model([section('A', []), section('B', [])]);
    expect(isEmptySong(m)).toBe(true);
    expect(isEmptySong(parse(lines('## A', '', '## B')))).toBe(true);
  });

  it('is true for an empty fence plus a blank notes part', () => {
    expect(isEmptySong(model([section('Intro', [music([]), { type: 'notes', text: '  \n ' }])]))).toBe(true);
  });

  it('is true for a fence holding only blank lines (gap rows)', () => {
    // The reader drops a fence's blank lines (an empty `lines`); a break line in
    // the model is what draws a gap, so both shapes are pinned.
    expect(isEmptySong(parse(lines('## Intro', '```', '', '', '```')))).toBe(true);
    const m = model([section('Intro', [music([{ kind: 'break' }, { kind: 'break' }])])]);
    expect(chartRows(m).map((r) => r.type)).toEqual(['section', 'gap', 'gap']);
    expect(isEmptySong(m)).toBe(true);
  });

  it('is false for a single bar', () => {
    expect(isEmptySong(parse(lines('## Intro', '```', '| G |', '```')))).toBe(false);
  });

  it('is false for a single sung line', () => {
    expect(isEmptySong(parse(lines('## Verse', '```', 'G      C', 'Down by the water', '```')))).toBe(false);
  });

  it('is false for a lyric-only line', () => {
    expect(isEmptySong(model([section('Verse', [music([{ kind: 'lyric', text: 'Down by the water' }])])]))).toBe(false);
  });

  it('is false for a notes paragraph before the first heading', () => {
    expect(isEmptySong(parse(lines('Play it gently.', '', '## Intro', '```', '', '```')))).toBe(false);
  });

  it('is false for a verbatim fence', () => {
    expect(isEmptySong(parse(lines('## Intro', '```tab', 'e|--3--|', '```')))).toBe(false);
  });

  it('is true for no model at all (nothing to draw)', () => {
    expect(isEmptySong(model([]))).toBe(true);
  });
});

describe('chartRows — markEmpty (workflow 2 L124-126; Decision 3)', () => {
  const bars = { kind: 'chart', measures: [{ items: [chord('G')] }] };
  const gapLine = { kind: 'break' };
  const mixed = () =>
    model([
      section('', [music([gapLine])]),
      section('Verse', [music([bars])]),
      section('Chorus', [music([gapLine, gapLine])]),
      section('Bridge', []),
    ]);

  it('yields an empty row right after the section row of each named section with only gaps', () => {
    const rows = chartRows(mixed(), { markEmpty: true });
    expect(rows.map((r) => r.type)).toEqual(['gap', 'section', 'bars', 'section', 'empty', 'gap', 'gap', 'section', 'empty']);
    expect(rows[4]).toEqual({ type: 'empty' });
    expect(rows[3]).toEqual({ type: 'section', name: 'Chorus' });
    expect(rows[7]).toEqual({ type: 'section', name: 'Bridge' });
  });

  it('never marks the unnamed leading section, nor a section with content', () => {
    const rows = chartRows(model([section('', []), section('Verse', [music([bars])])]), { markEmpty: true });
    expect(rows.some((r) => r.type === 'empty')).toBe(false);
  });

  it('without the option, the rows are unchanged', () => {
    expect(chartRows(mixed()).map((r) => r.type)).toEqual(['gap', 'section', 'bars', 'section', 'gap', 'gap', 'section']);
    expect(chartRows(mixed(), {})).toEqual(chartRows(mixed()));
  });
});
