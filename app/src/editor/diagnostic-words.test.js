// Unit — the words for a reported line (songs.editor_errors_in_words
// Constraints 1-2; workflow 4 §Editing). The words come from the diagnostic's
// code, in every language, with `other` for a code the app does not know.

import { describe, it, expect } from 'vitest';
import { parse } from 'cifra-md';
import { LOCALES } from '../i18n/index.js';
import { DIAGNOSTIC_CODES, diagnosticKey, lineDiagnostics, lineNoteText } from './diagnostic-words.js';
import { classifyLines } from './cifra-syntax.js';

const lookup = (messages, key) => key.split('.').reduce((n, seg) => (n == null ? undefined : n[seg]), messages);

describe('diagnostic words', () => {
  it('every locale words every diagnostic code', () => {
    for (const { id, messages } of LOCALES) {
      for (const code of [...DIAGNOSTIC_CODES, 'other']) {
        const words = lookup(messages, `editor.diagnostic.${code}`);
        expect(typeof words, `${id} ${code}`).toBe('string');
        expect(words.trim(), `${id} ${code}`).not.toBe('');
      }
      expect(lookup(messages, 'editor.source.lineNote'), id).toContain('{words}');
    }
  });

  it('an unknown code falls back to other', () => {
    expect(diagnosticKey('a-code-from-the-future')).toBe('editor.diagnostic.other');
    expect(diagnosticKey('bad-voicing')).toBe('editor.diagnostic.bad-voicing');
    const t = (key, params = {}) => (key === 'editor.source.lineNote' ? `Line ${params.line}: ${params.words}` : key);
    expect(lineNoteText({ code: 'a-code-from-the-future', line: 4 }, t)).toBe('Line 4: editor.diagnostic.other');
  });

  it('the note names the first diagnostic on a line', () => {
    const byLine = lineDiagnostics([
      { code: 'stray-mark', line: 5 },
      { code: 'unclosed-group', line: 5 },
      { code: 'bad-voicing', line: 9 },
      { code: 'marker-line', line: 12 },
      { code: 'bad-voicing', line: 12 },
      { code: 'bad-notation' },
    ]);
    expect([...byLine.keys()]).toEqual([5, 9]);
    expect(byLine.get(5).code).toBe('stray-mark');
    // A marker line is `mk`, never `err`: its words are the conflict notice's.
    expect(byLine.has(12)).toBe(false);
  });

  it('notes exactly the lines the classifier colours err', () => {
    const text = '# Rascunho\n\n## Intro\n```\n|: Am | D7 |\n```\n\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- Em: 02200\n';
    const classes = classifyLines(text);
    const errLines = classes.flatMap((c, i) => (c === 'err' ? [i + 1] : []));
    expect(errLines.length).toBeGreaterThan(0);
    expect([...lineDiagnostics(parse(text).diagnostics).keys()].sort((a, b) => a - b)).toEqual(errLines);
  });
});
