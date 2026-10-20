// unknown-words.js — which inputs the editor flags (songs.unknown_tokens_loud
// §Acceptance; workflow 4 §Editing, workflow 3 §When it looks like another
// format; spec §2.9, §1.7.2). Purpose-written fixtures only.

import { describe, test, expect } from 'vitest';

import { isSongPath, unknownMarks, chordBracketHeadings } from './unknown-words.js';

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
