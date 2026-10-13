// restorable-blocks.test.js (unit) — grouping a compare-with-now musical diff into
// restorable blocks (songs.restore_part; diff.md:210-236). Real `diff` records
// over purpose-written songs, so the grouping is pinned against the shape the diff
// actually emits, not a hand-written stand-in.

import { describe, it, expect } from 'vitest';
import { parse, diff } from 'cifra-md';
import { restorableBlocks, sameBlockRef, blockLabelText } from './restorable-blocks.js';

const lines = (...l) => l.join('\n');
const changesOf = (before, after) => diff(parse(before), parse(after)).changes;

describe('restorableBlocks', () => {
  it('groups a section and its chord/words changes into one section block (by name)', () => {
    const version = lines('# S', '', '## Verse', '```', '| C | G |', '```', '');
    const working = lines('# S', '', '## Verse', '```', '| C | Am |', '```', '');
    const blocks = restorableBlocks(changesOf(version, working));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('section');
    expect(blocks[0].ref).toEqual({ kind: 'section', name: 'Verse', fromName: 'Verse' });
    expect(blocks[0].changes.every((c) => c.where.section === 'Verse')).toBe(true);
  });

  it('keys a voicing block on (tuning, variation) and carries its tuning label', () => {
    const version = lines('# S', '', '## V', '```', '| C |', '```', '', '---', '', '## Voicings: G4 C4 E4 A4', '- C: 0003', '');
    const working = lines('# S', '', '## V', '```', '| C |', '```', '', '---', '', '## Voicings: G4 C4 E4 A4', '- C: 5433', '');
    const blocks = restorableBlocks(changesOf(version, working));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('voicing');
    expect(blocks[0].ref).toEqual({ kind: 'voicing', tuning: 'G4 C4 E4 A4', variation: '' });
    expect(blocks[0].label).toBe('G4 C4 E4 A4');
  });

  it('records the version-side name for a renamed section (restore renames back)', () => {
    const version = lines('# S', '', '## Bridge', '```', '| C | G |', '```', '');
    const working = lines('# S', '', '## Refrão', '```', '| C | G |', '```', '');
    const blocks = restorableBlocks(changesOf(version, working));
    const renamed = blocks.find((b) => b.kind === 'section');
    expect(renamed.ref).toEqual({ kind: 'section', name: 'Refrão', fromName: 'Bridge' });
  });

  it('excludes title, property and whole-song reorder (not independently restorable)', () => {
    const version = lines('# Old', '- key: C', '', '## A', '```', '| C |', '```', '', '## B', '```', '| G |', '```', '');
    const working = lines('# New', '- key: D', '', '## B', '```', '| G |', '```', '', '## A', '```', '| C |', '```', '');
    const changes = changesOf(version, working);
    // There are title/property/reorder records in the raw diff…
    expect(changes.some((c) => c.kind === 'title')).toBe(true);
    expect(changes.some((c) => c.kind === 'property')).toBe(true);
    // …but restorableBlocks offers none of them.
    const blocks = restorableBlocks(changes);
    expect(blocks.every((b) => b.kind === 'section' || b.kind === 'voicing')).toBe(true);
    expect(blocks.every((b) => b.changes.every((c) => c.op !== 'reordered'))).toBe(true);
  });

  it('orders sections (document order) before voicing blocks (model order)', () => {
    const version = lines('# S', '', '## One', '```', '| C |', '```', '', '## Two', '```', '| G |', '```', '', '---', '', '## Voicings: G4 C4 E4 A4', '- C: 0003', '');
    const working = lines('# S', '', '## One', '```', '| C7 |', '```', '', '## Two', '```', '| G7 |', '```', '', '---', '', '## Voicings: G4 C4 E4 A4', '- C: 5433', '');
    const blocks = restorableBlocks(changesOf(version, working));
    const kinds = blocks.map((b) => b.kind);
    expect(kinds.indexOf('voicing')).toBe(kinds.length - 1); // voicing block is last
    expect(blocks.filter((b) => b.kind === 'section').map((b) => b.label)).toEqual(['One', 'Two']);
  });

  it('returns nothing for an empty or absent change list', () => {
    expect(restorableBlocks([])).toEqual([]);
    expect(restorableBlocks(undefined)).toEqual([]);
  });
});

describe('sameBlockRef / blockLabelText', () => {
  it('pairs refs by kind and identity', () => {
    expect(sameBlockRef({ kind: 'section', name: 'V' }, { kind: 'section', name: 'V', fromName: 'X' })).toBe(true);
    expect(sameBlockRef({ kind: 'section', name: 'V' }, { kind: 'section', name: 'W' })).toBe(false);
    expect(sameBlockRef({ kind: 'voicing', tuning: 'g', variation: '' }, { kind: 'voicing', tuning: 'g', variation: '' })).toBe(true);
    expect(sameBlockRef({ kind: 'voicing', tuning: 'g', variation: '' }, { kind: 'voicing', tuning: 'g', variation: 'Low' })).toBe(false);
  });

  it('localizes a block label, passing musical tokens through as data', () => {
    const t = (key, params) => (key === 'history.voicingBlock' ? `Voicings for ${params.tuning}` : key === 'saveSheet.change.untitledSection' ? '(untitled)' : key);
    expect(blockLabelText({ kind: 'voicing', label: 'G4 C4 E4 A4' }, t)).toBe('Voicings for G4 C4 E4 A4');
    expect(blockLabelText({ kind: 'section', label: 'Verse' }, t)).toBe('Verse');
    expect(blockLabelText({ kind: 'section', label: '' }, t)).toBe('(untitled)');
  });
});
