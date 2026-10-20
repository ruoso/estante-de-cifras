// unknown-words.js — which inputs the editor flags (songs.unknown_tokens_loud
// §Acceptance; workflow 4 §Editing, workflow 3 §When it looks like another
// format; spec §2.9, §1.7.2). Purpose-written fixtures only.

import { describe, test, expect } from 'vitest';

import { parse } from 'cifra-md';

import {
  isSongPath,
  unknownMarks,
  chordBracketHeadings,
  bracketChordsInNotes,
  unfencedChordsLine,
  formatHint,
} from './unknown-words.js';

const fenced = (t, props = '') => `# Tarde Clara\n${props}\n\`\`\`\n${t}\n\`\`\`\n`;
const marked = (text) => unknownMarks(text).map(({ from, to }) => text.slice(from, to));

describe('isSongPath (Decision 6)', () => {
  test('a cifra.md file and a new song with no path are songs', () => {
    expect(isSongPath('songs/tarde-clara.cifra.md')).toBe(true);
    expect(isSongPath(null)).toBe(true);
    expect(isSongPath(undefined)).toBe(true);
  });

  test('a setlist and a README are not', () => {
    expect(isSongPath('sets/domingo.setlist.md')).toBe(false);
    expect(isSongPath('README.md')).toBe(false);
  });
});

describe('unknownMarks (workflow 4 §Editing; spec §2.9)', () => {
  test('bracket chords mark exactly the two words after the heading', () => {
    const text = fenced('[Am]Teste [G]linha');
    const marks = unknownMarks(text);
    const start = text.indexOf('[Am]');
    expect(marks).toEqual([
      { from: start + 4, to: start + 9 },
      { from: start + 10, to: start + 18 },
    ]);
    expect(marked(text)).toEqual(['Teste', '[G]linha']);
  });

  test('a word in a bar, a word in a run, (solo) as one', () => {
    expect(marked(fenced('| G | C | fine |'))).toEqual(['fine']);
    expect(marked(fenced('| G | rit. |'))).toEqual(['rit.']);
    expect(marked(fenced('G C fine'))).toEqual(['fine']);
    expect(marked(fenced('| G | (solo) |'))).toEqual(['(solo)']);
  });

  test('a clean chart and notes outside a fence mark nothing', () => {
    expect(unknownMarks(fenced('| G | C | D7 | G |'))).toEqual([]);
    expect(unknownMarks('# Tarde Clara\n\nTeste linha fine\n')).toEqual([]);
  });

  test('marks follow the lines of a longer song', () => {
    const text = '# Tarde Clara\n\n## Verso\n```\n| G | C |\n```\n\n## Refrão\n```\n| D | fine |\n```\n';
    expect(marked(text)).toEqual(['fine']);
  });
});

describe('chordBracketHeadings (workflow 3 §When it looks like another format; §1.7.2)', () => {
  test('a bracket heading named by a chord is flagged, at its line', () => {
    expect(chordBracketHeadings(fenced('[Am]Teste [G]linha'))).toEqual([{ line: 4, name: 'Am' }]);
    expect(chordBracketHeadings(fenced('[G7]'))).toEqual([{ line: 4, name: 'G7' }]);
    expect(chordBracketHeadings(fenced('[A]'))).toEqual([{ line: 4, name: 'A' }]);
    expect(chordBracketHeadings(fenced('[Am] x2\n| Am | G |'))).toEqual([{ line: 4, name: 'Am' }]);
  });

  test('several are each located in order', () => {
    expect(chordBracketHeadings(fenced('[Refrão]\n| G |\n[Am]Teste\n[Am]linha'))).toEqual([
      { line: 6, name: 'Am' },
      { line: 7, name: 'Am' },
    ]);
  });

  test('a part name, a number, a markdown heading are not flagged', () => {
    expect(chordBracketHeadings(fenced('[Refrão]\n| G | C |'))).toEqual([]);
    expect(chordBracketHeadings(fenced('[1]\n| G | C |'))).toEqual([]);
    expect(chordBracketHeadings('# Tarde Clara\n\n## Am\n```\n| G | C |\n```\n')).toEqual([]);
  });

  test('a bracket line outside a fence, or in a fence of another kind, is not flagged', () => {
    expect(chordBracketHeadings('# Tarde Clara\n\n[Am]Teste linha\n')).toEqual([]);
    expect(chordBracketHeadings('# Tarde Clara\n\n```js\n[Am]\n```\n')).toEqual([]);
  });

  test("the song's notation is the one asked", () => {
    // Every dialect reads `C7+` as a chord, so the song's own notation flags
    // it — the dialect changes what a chord means, never whether it is one
    // (spec §5.6).
    const props = '\n- notation: american\n';
    expect(chordBracketHeadings(fenced('[C7+]', props))).toEqual([{ line: 6, name: 'C7+' }]);
    expect(chordBracketHeadings(fenced('[Do]', props))).toEqual([]);
  });
});

// songs.format_help: the notice's two other cases and the one function that
// picks the notice shown (Decisions 1-4; workflow 3 §When it looks like another
// format; spec §1.9).
describe('bracketChordsInNotes (workflow 3 §When it looks like another format; Decision 3)', () => {
  test('a chord in brackets followed at once by a letter, outside a fence, is flagged at its line', () => {
    expect(bracketChordsInNotes('# Tarde Clara\n\n[G]Walk the road\n')).toEqual([{ line: 3 }]);
    expect(bracketChordsInNotes('# Tarde Clara\n\nWalk [G]the [C]road\n[Am]Again\n')).toEqual([
      { line: 3 },
      { line: 4 },
    ]);
  });

  test('a part name, a space after the bracket, a bracket alone are words', () => {
    expect(bracketChordsInNotes('# Tarde Clara\n\n[Chorus]Walk the road\n')).toEqual([]);
    expect(bracketChordsInNotes('# Tarde Clara\n\n[G] walk the road\n')).toEqual([]);
    expect(bracketChordsInNotes('# Tarde Clara\n\n[G]\n')).toEqual([]);
  });

  test('inside a fence, in a heading or a list item it is not a note', () => {
    expect(bracketChordsInNotes(fenced('[G]Walk the road'))).toEqual([]);
    expect(bracketChordsInNotes('# Tarde Clara\n\n```js\n[G]Walk\n```\n')).toEqual([]);
    expect(bracketChordsInNotes('# Tarde Clara\n\n## [G]Walk\n')).toEqual([]);
    expect(bracketChordsInNotes('# Tarde Clara\n- artist: [G]Walk\n')).toEqual([]);
  });

  test("the song's notation decides, as for chordBracketHeadings", () => {
    const props = '- notation: american\n\n';
    expect(bracketChordsInNotes(`# Tarde Clara\n${props}[C7+]Walk\n`)).toEqual([{ line: 4 }]);
    expect(bracketChordsInNotes(`# Tarde Clara\n${props}[Do]Walk\n`)).toEqual([]);
  });
});

describe('unfencedChordsLine (spec §1.9; Decision 2)', () => {
  test("the line of the reader's unfenced-music report, or null", () => {
    expect(unfencedChordsLine(parse('# Tarde Clara\n\n## Intro\nG | C | D\n'))).toBe(4);
    expect(unfencedChordsLine(parse(fenced('G | C | D')))).toBeNull();
  });
});

describe('formatHint (workflow 3 §When it looks like another format; Decisions 1, 4)', () => {
  const unfenced = '# Tarde Clara\n\n## Intro\nG | C | D\n';

  test('chords outside the music under ## Intro with no fence: the unfenced case, at Parts', () => {
    expect(formatHint({ text: unfenced, cursorLine: 1 })).toEqual({ kind: 'unfenced', line: 4, topic: 'parts' });
  });

  test('none once any fence exists (the reader checks only a song with no music fence)', () => {
    const text = `${unfenced}\n## Verse\n\`\`\`\nG | C |\n\`\`\`\n`;
    expect(formatHint({ text, cursorLine: 1 })).toBeNull();
  });

  test('chords in brackets come first, headings and notes together, the first line that counts', () => {
    const text = `# Tarde Clara\n\n[G]Walk the road\n\n## Intro\nG | C | D\n`;
    expect(formatHint({ text, cursorLine: 1 })).toEqual({ kind: 'bracket', line: 3, topic: 'chords' });
    const both = `# Tarde Clara\n\n[G]Walk the road\n\`\`\`\n[Am]Teste\n\`\`\`\n`;
    expect(formatHint({ text: both, cursorLine: 3 })).toEqual({ kind: 'bracket', line: 5, topic: 'chords' });
  });

  test("the cursor's line does not count until it leaves; a pasted line counts at once", () => {
    const text = '# Tarde Clara\n\n[G]Walk the road\n';
    expect(formatHint({ text, cursorLine: 3 })).toBeNull();
    expect(formatHint({ text, cursorLine: 3, pastedLines: new Set([3]) })).toEqual({
      kind: 'bracket',
      line: 3,
      topic: 'chords',
    });
    expect(formatHint({ text: unfenced, cursorLine: 4 })).toBeNull();
  });

  test('a dismissed kind yields the other', () => {
    const text = `# Tarde Clara\n\n[G]Walk the road\n\n## Intro\nG | C | D\n`;
    expect(formatHint({ text, cursorLine: 1, dismissed: new Set(['bracket']) })).toEqual({
      kind: 'unfenced',
      line: 6,
      topic: 'parts',
    });
    expect(formatHint({ text, cursorLine: 1, dismissed: new Set(['bracket', 'unfenced']) })).toBeNull();
  });

  test('the parse given is the one read', () => {
    expect(formatHint({ text: unfenced, parsed: parse(unfenced), cursorLine: 1 })?.kind).toBe('unfenced');
  });
});
