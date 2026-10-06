// line-diff (unit) — the pure line/hunk diff behind *show the text*
// (songs.history, workflow 6 §A version L43-45). Pins the add/remove/unchanged
// hunks for an insert, a delete and a one-line chord change, an empty result for
// identical text, and the hunk split (the `gap` the view draws) for two distant
// changes. Fixtures are purpose-written, never anyone's words.

import { describe, it, expect } from 'vitest';
import { lineDiff } from './line-diff.js';

const types = (hunk) => hunk.lines.map((l) => l.type);
const texts = (hunk) => hunk.lines.map((l) => l.text);

describe('lineDiff', () => {
  it('identical text → no hunks', () => {
    const text = ['# Harbour Light', '', '## Verse', '```', 'C', 'a lantern on the pier', '```', ''].join('\n');
    expect(lineDiff(text, text)).toEqual([]);
    // A trailing newline is not an extra blank line either way.
    expect(lineDiff('a\nb\n', 'a\nb')).toEqual([]);
  });

  it('an inserted line → one hunk with an add and no del, context kept', () => {
    const before = ['a', 'b', 'c'].join('\n');
    const after = ['a', 'b', 'X', 'c'].join('\n');
    const hunks = lineDiff(before, after);
    expect(hunks).toHaveLength(1);
    expect(types(hunks[0])).toContain('add');
    expect(types(hunks[0])).not.toContain('del');
    expect(texts(hunks[0])).toEqual(['a', 'b', 'X', 'c']);
    expect(hunks[0].lines.find((l) => l.type === 'add').text).toBe('X');
  });

  it('a deleted line → one hunk with a del and no add', () => {
    const before = ['a', 'b', 'c', 'd'].join('\n');
    const after = ['a', 'b', 'd'].join('\n');
    const hunks = lineDiff(before, after);
    expect(hunks).toHaveLength(1);
    expect(types(hunks[0])).toContain('del');
    expect(types(hunks[0])).not.toContain('add');
    expect(hunks[0].lines.find((l) => l.type === 'del').text).toBe('c');
  });

  it('a one-line chord change → a del of the old chord line then an add of the new', () => {
    const before = ['## Verse', '```', 'C      G', 'desci a rua', '```'].join('\n');
    const after = ['## Verse', '```', 'C      D7', 'desci a rua', '```'].join('\n');
    const hunks = lineDiff(before, after);
    expect(hunks).toHaveLength(1);
    const del = hunks[0].lines.find((l) => l.type === 'del');
    const add = hunks[0].lines.find((l) => l.type === 'add');
    expect(del.text).toBe('C      G');
    expect(add.text).toBe('C      D7');
    // Old-then-new reading order at the change point.
    expect(hunks[0].lines.indexOf(del)).toBeLessThan(hunks[0].lines.indexOf(add));
  });

  it('two distant changes → two hunks (the view draws a gap between them)', () => {
    const base = Array.from({ length: 24 }, (_, i) => `line ${i}`);
    const after = [...base];
    after[1] = 'LINE one';
    after[21] = 'LINE twenty-one';
    const hunks = lineDiff(base.join('\n'), after.join('\n'));
    expect(hunks).toHaveLength(2);
  });
});
