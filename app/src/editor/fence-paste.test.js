// Unit — the paste-into-a-fence transform (songs.editor, acceptance "paste into
// a fence"). Pins workflow 3 §Pasting a cifra L87-95. Purpose-written text.

import { describe, it, expect } from 'vitest';
import { fencePaste } from './fence-paste.js';

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
