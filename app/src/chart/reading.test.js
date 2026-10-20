// unit (shell.a11y_chart) — the ordered announced tokens of a render row, no
// DOM. Pins the exact "Announced text (exact)" strings of docs/screen-reader.md
// §2.2 (a sung line), §4 (a split word, padding and hyphen silent), §5 (a chart
// line and a numbered + N.C. line, a run as a plain sequence), §6 (the diagram
// composed) and §7.2/§7.3 (the conflict/default region bounding). The rows are
// the real `chartRows` output (parsed through the reader where the alignment is
// natural, hand-built where a lone split word would not classify as sung), and
// the chord names come from the real `speakChord`, so this pins the whole
// reader → layout → reading → §3 path against the literal strings.
//
// Pins: "the reading-order text of a sung line, a chart, a diagram and a
// conflict" (.tji note); docs/screen-reader.md §2.2, §3, §4, §5, §6, §7.2, §7.3;
// cifra.md §2.4/§2.6/§2.8/§5.6.

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from 'cifra-md';
import { setLocale, t } from '../i18n/index.js';
import { parseChord } from '../core/notation/parse.js';
import { describeFingering } from '../render/diagram.js';
import { instrumentInstance } from '../core/instrument.js';
import { fingeringFromFrets } from '../core/search.js';
import { speakChord } from '../render/chord-speech.js';
import { chartRows } from './layout.js';
import { announce, readingTokens, regionAnnouncement, diagramReading } from './reading.js';

const speak = (chord, opts = {}) => speakChord(chord, { notation: 'brazilian', t, ...opts });
const deps = { speak, t };

// The one sung/chart row of a one-line fenced song.
function rowOf(src) {
  return chartRows(parse(src)).find((r) => r.type === 'sung' || r.type === 'bars' || r.type === 'run');
}

describe('announce — the sung line (§2.2)', () => {
  beforeEach(() => setLocale('en'));

  it('interleaves chord-before-word-run in source order, Em spoken as E minor', () => {
    const row = rowOf('## Verse\n```\nG      D        Em\nQuando eu te vi passar\n```\n');
    expect(announce(row, deps)).toBe('G, Quando, D, eu te vi, E minor, passar');
  });
});

describe('announce — padding and the centred hyphen are silent (§4)', () => {
  beforeEach(() => setLocale('en'));

  it('reads a split word as its pieces in source order, no hyphen', () => {
    // A lone split word does not classify as a sung line (it needs a lyric line
    // beside it), so the row is hand-built in the reader's shape — the §4.5
    // convergence output: C over "W", the centred hyphen, G over "hen".
    const row = {
      type: 'sung',
      segments: [
        { chord: 'C', words: 'W', hyphen: true, token: null, voice: { type: 'chord', chord: parseChord('C').chord, footnote: 1 } },
        { chord: 'G', words: 'hen', hyphen: false, token: null, voice: { type: 'chord', chord: parseChord('G').chord, footnote: 1 } },
      ],
      address: { section: 0, part: 0, line: 0 },
    };
    expect(announce(row, deps)).toBe('C, W, G, hen');
  });

  it('drops a lead segment to its word-run alone', () => {
    const row = {
      type: 'sung',
      segments: [
        { chord: '', words: 'Te', hyphen: true, token: null, voice: { type: 'lead' } },
        { chord: 'G', words: 'sting', hyphen: false, token: null, voice: { type: 'chord', chord: parseChord('G').chord, footnote: 1 } },
      ],
      address: { section: 0, part: 0, line: 0 },
    };
    expect(announce(row, deps)).toBe('Te, G, sting');
  });
});

describe('announce — the chart line (§5)', () => {
  beforeEach(() => setLocale('en'));

  it('reads measures in order, the bar glyph never spoken', () => {
    const row = rowOf('## Chart\n```\nG | D | Em | C\n```\n');
    expect(announce(row, deps)).toBe('G, D, E minor, C');
  });

  it('leads a stated numbered bar with its number and reads N.C. as no chord', () => {
    // §5's exact example writes "G7"; §3 is normative that an interval is a
    // spoken word, so G7 reads "G seven" (as Em reads "E minor", never "em").
    const row = rowOf('## Chart\n```\n@5 N.C. | C | G7\n```\n');
    expect(announce(row, deps)).toBe('bar 5: no chord, C, G seven');
  });

  it('reads a run/intro line as a plain chord sequence (no bar numbers)', () => {
    const row = rowOf('## Intro\n```\nG D Em C\n```\n');
    expect(row.type).toBe('run');
    expect(announce(row, deps)).toBe('G, D, E minor, C');
  });
});

describe('diagramReading — the chord diagram (§6)', () => {
  beforeEach(() => setLocale('en'));

  it('composes the describeFingering sentence plus the role word, in order', () => {
    const guitar = instrumentInstance({
      catalogId: '6guitar',
      label: 'Guitar · Standard',
      strings: 'E2, A2, D3, G3, B3, E4',
      fretCount: 22,
    });
    const A = parseChord('A').chord;
    const openA = fingeringFromFrets(['x', 0, 2, 2, 2, 0], A, guitar);
    const sentence = describeFingering(openA, { chord: A, dialect: 'american', instrument: guitar });
    // The reading is the describeFingering sentence (reused as-is from
    // shell.diagram — §6, the "do not re-derive" decision) plus the role word:
    // the song's own shape appends none; "your shape" / "default" is appended in
    // the announced order, the sentence's trailing period dropped (§1.2).
    expect(sentence).toMatch(/^A, x02220, open position/); // the §6 sentence shape
    expect(diagramReading(sentence, null)).toBe(sentence.replace(/\.$/, ''));
    expect(diagramReading(sentence, 'your shape')).toBe(`${sentence.replace(/\.$/, '')}, your shape`);
    expect(diagramReading(sentence, 'your shape').endsWith(', your shape')).toBe(true);
  });
});

describe('regionAnnouncement — a conflict and a shown default (§7)', () => {
  beforeEach(() => setLocale('en'));

  it('bounds a conflict by "needs you" + the musical phrase, ending with end of conflict (§7.2)', () => {
    expect(regionAnnouncement('conf', { t, phrase: 'conflict in the chart line' })).toEqual({
      enter: 'needs you, conflict in the chart line',
      exit: 'end of conflict',
    });
  });

  it('bounds a shown default with default / end of defaults (§7.3)', () => {
    expect(regionAnnouncement('def', { t })).toEqual({ enter: 'default', exit: 'end of defaults' });
  });

  it('bounds nothing for an unmarked or tap row', () => {
    expect(regionAnnouncement(null, { t })).toBeNull();
    expect(regionAnnouncement('tap', { t })).toBeNull();
  });
});

describe('readingTokens — the token array', () => {
  beforeEach(() => setLocale('en'));

  it('returns the ordered tokens (the array `announce` joins)', () => {
    const row = rowOf('## Chart\n```\nG | D | Em | C\n```\n');
    expect(readingTokens(row, deps)).toEqual(['G', 'D', 'E minor', 'C']);
  });
});

// songs.render_notes — the new rows' reading, in the chart's one reading order
// (screen-reader.md §1.2): a notes row reads as its paragraphs, a verbatim row
// as its group name then its text.
describe('readingTokens — notes and verbatim (songs.render_notes)', () => {
  beforeEach(() => setLocale('en'));

  const notesRow = { type: 'notes', paragraphs: ['Softer the second time.  ', 'Then louder.\n  indented'], address: { section: 0, part: 1 } };
  const tabRow = { type: 'verbatim', info: 'tab', text: 'e|--3--|\nB|--0--|', address: { section: 0, part: 2 } };

  it('a notes row reads as its paragraphs, trailing spaces trimmed', () => {
    expect(readingTokens(notesRow, deps)).toEqual(['Softer the second time.', 'Then louder.\n  indented']);
  });

  it('a verbatim row reads as "Tab block" then its text', () => {
    expect(readingTokens(tabRow, deps)).toEqual(['Tab block', 'e|--3--|\nB|--0--|']);
  });

  it('announce joins them with ", " (§1.2)', () => {
    expect(announce(notesRow, deps)).toBe('Softer the second time., Then louder.\n  indented');
    expect(announce(tabRow, deps)).toBe('Tab block, e|--3--|\nB|--0--|');
  });

  it('the parsed rows read in document order', () => {
    const rows = chartRows(parse('## Verse\n```\nC | G\n```\n\nSofter the second time.\n\n```strum\nD DU UDU\n```\n'));
    expect(rows.map((row) => announce(row, deps)).filter(Boolean)).toEqual([
      'C, G',
      'Softer the second time.',
      'Strum block, D DU UDU',
    ]);
  });
});
