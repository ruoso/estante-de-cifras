// Unit — the paste-into-a-fence transform (songs.editor, acceptance "paste into
// a fence"). Pins workflow 3 §Pasting a cifra L87-95. Purpose-written text.

import { describe, it, expect } from 'vitest';
import { parse } from 'cifra-md';
import { fencePaste, fenceAround } from './fence-paste.js';

describe('fencePaste', () => {
  it('wraps a paste that lands outside any fence', () => {
    const r = fencePaste({
      text: '# Song\n- artist:\n\n## Intro\n',
      pasted: 'Am  G\na line of words',
      hasTitle: true,
    });
    expect(r.insideFence).toBe(false);
    expect(r.wrapped).toBe(true);
    expect(r.titled).toBe(false);
    expect(r.title).toBeNull();
    expect(r.insert).toBe('```\nAm  G\na line of words\n```');
  });

  it('promotes the first pasted line to the title when the song is untitled', () => {
    const r = fencePaste({
      text: '',
      pasted: 'Maré Mansa\n[Intro] Am  G\nA maré veio mansa',
      hasTitle: false,
    });
    expect(r.wrapped).toBe(true);
    expect(r.titled).toBe(true);
    expect(r.title).toBe('# Maré Mansa');
    // The promoted first line is lifted out; the rest becomes the fenced body.
    expect(r.insert).toBe('```\n[Intro] Am  G\nA maré veio mansa\n```');
  });

  it('does not add a fence when the paste already lands inside one', () => {
    const r = fencePaste({
      text: '# Song\n\n## Intro\n```\nAm\n',
      pasted: 'Dm  G7',
      hasTitle: true,
    });
    expect(r.insideFence).toBe(true);
    expect(r.wrapped).toBe(false);
    expect(r.titled).toBe(false);
    expect(r.insert).toBe('Dm  G7');
    expect(r.title).toBeNull();
  });

  it('returns the title and the fenced body together, for one reversible move', () => {
    // The editor applies `title` at the document head and `insert` at the paste
    // point in a single CodeMirror transaction, so one undo reverts both.
    const r = fencePaste({ text: '', pasted: 'New One\nAm  Dm', hasTitle: false });
    expect(r.title).toBe('# New One');
    expect(r.insert.startsWith('```\n')).toBe(true);
    expect(r.insert.endsWith('\n```')).toBe(true);
  });
});

// Unit — Put it in the music (songs.editor_errors_in_words Constraint 6,
// Decision 6; workflow 3 §When it looks like another format; spec §1.9).
// Purpose-written text: *Rascunho*, a bar line of chords only.
describe('fenceAround', () => {
  const apply = (text, { from, to, insert }) => text.slice(0, from) + insert + text.slice(to);

  it('fences a lone bar line', () => {
    const text = '# Rascunho\n\n| Am7 | D7 | Gm7 | C7 |';
    const r = fenceAround(text, 3);
    expect(r).toEqual({ from: 12, to: text.length, insert: '```\n| Am7 | D7 | Gm7 | C7 |\n```' });
    expect(apply(text, r)).toBe('# Rascunho\n\n```\n| Am7 | D7 | Gm7 | C7 |\n```');
  });

  it('fences the paragraph, stopping at a blank line, a heading and a property', () => {
    // Chords over words are one paragraph: the chord line and its words go in
    // together, and nothing past the stops around them.
    const text = [
      '# Rascunho',
      '- artist: Ana',
      'Am7  D7',
      'a linha que se canta',
      '',
      'outra nota',
      '## Verso',
      'Gm7  C7',
      'mais uma linha',
      '- key: Gm',
    ].join('\n');
    expect(apply(text, fenceAround(text, 4))).toBe(
      ['# Rascunho', '- artist: Ana', '```', 'Am7  D7', 'a linha que se canta', '```', '', 'outra nota', '## Verso', 'Gm7  C7', 'mais uma linha', '- key: Gm'].join('\n'),
    );
    expect(apply(text, fenceAround(text, 8))).toBe(
      ['# Rascunho', '- artist: Ana', 'Am7  D7', 'a linha que se canta', '', 'outra nota', '## Verso', '```', 'Gm7  C7', 'mais uma linha', '```', '- key: Gm'].join('\n'),
    );
  });

  it('the result parses with no unfenced-music and the line reads as bars', () => {
    const text = '# Rascunho\n\n| Am7 | D7 | Gm7 | C7 |\n';
    expect(parse(text).diagnostics.map((d) => d.code)).toContain('unfenced-music');
    const out = apply(text, fenceAround(text, 3));
    const doc = parse(out);
    expect(doc.diagnostics.map((d) => d.code)).not.toContain('unfenced-music');
    const parts = doc.sections.flatMap((s) => s.body);
    const measures = parts.flatMap((p) => (p.lines ?? []).flatMap((l) => l.measures ?? []));
    expect(measures.map((m) => m.items.map((i) => i.symbol).join(' '))).toEqual(['Am7', 'D7', 'Gm7', 'C7']);
  });
});
