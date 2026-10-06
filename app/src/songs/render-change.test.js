// render-change (unit) — the pure localized diff-row renderer (songs.save_sheet,
// Decision 3). Pins the diff output shape (cifra_js/diff: records
// `{ kind, op, where, before, after, text }`) and mockup W04's two-column
// `{ where, what }` rows: every kind × op maps to a localized row, with musical
// tokens (chords, note names, section names, property keys, bar numbers) passed
// through as data. Records are built exactly as `diff` emits them (diff.js).

import { describe, it, expect } from 'vitest';
import { t } from '../i18n/index.js';
import { renderChange } from './render-change.js';

// A record in diff.js's shape; `where` keeps only the keys that function sets.
const rec = (kind, op, where, before = null, after = null) => ({
  kind,
  op,
  where,
  before,
  after,
});

describe('renderChange: title', () => {
  it('added → Title · the new title as data', () => {
    expect(renderChange(rec('title', 'added', {}, null, 'Tarde Clara'), t)).toEqual({
      where: 'Title',
      what: 'Tarde Clara added',
    });
  });
  it('removed → Title · removed', () => {
    expect(renderChange(rec('title', 'removed', {}, 'Tarde Clara', null), t)).toEqual({
      where: 'Title',
      what: 'Tarde Clara removed',
    });
  });
  it('changed → Title · before → after', () => {
    expect(renderChange(rec('title', 'changed', {}, 'Tarde', 'Tarde Clara'), t)).toEqual({
      where: 'Title',
      what: 'Tarde → Tarde Clara',
    });
  });
});

describe('renderChange: property (key passed through as data)', () => {
  it('added', () => {
    expect(renderChange(rec('property', 'added', { key: 'capo' }, null, '2'), t)).toEqual({
      where: 'capo',
      what: '2 added',
    });
  });
  it('removed', () => {
    expect(renderChange(rec('property', 'removed', { key: 'capo' }, '2', null), t)).toEqual({
      where: 'capo',
      what: '2 removed',
    });
  });
  it('changed', () => {
    expect(renderChange(rec('property', 'changed', { key: 'key' }, 'G', 'A'), t)).toEqual({
      where: 'key',
      what: 'G → A',
    });
  });
});

describe('renderChange: section', () => {
  it('added (section name as data)', () => {
    expect(renderChange(rec('section', 'added', { section: 'Bridge' }, null, 'Bridge'), t)).toEqual({
      where: 'Bridge',
      what: 'section added',
    });
  });
  it('removed', () => {
    expect(renderChange(rec('section', 'removed', { section: 'Bridge' }, 'Bridge', null), t)).toEqual({
      where: 'Bridge',
      what: 'section removed',
    });
  });
  it('renamed (located by the old name, named by the new)', () => {
    expect(renderChange(rec('section', 'renamed', { section: 'Chorus' }, 'Refrain', 'Chorus'), t)).toEqual({
      where: 'Refrain',
      what: 'renamed to Chorus',
    });
  });
  it('reordered (whole-song, no single section)', () => {
    expect(renderChange(rec('section', 'reordered', {}, ['A', 'B'], ['B', 'A']), t)).toEqual({
      where: 'Sections',
      what: 'reordered',
    });
  });
  it('the pre-heading section reads (untitled)', () => {
    expect(renderChange(rec('section', 'added', { section: '' }, null, ''), t)).toEqual({
      where: '(untitled)',
      what: 'section added',
    });
  });
});

describe('renderChange: chord (by bar in an unsung song, by section in a sung one)', () => {
  it('changed, located by section and bar', () => {
    expect(
      renderChange(rec('chord', 'changed', { section: 'Primeira Parte', bar: 2 }, 'D', 'D7'), t),
    ).toEqual({ where: 'Primeira Parte bar 2', what: 'D → D7' });
  });
  it('added, located by section alone when there is no bar number (sung)', () => {
    expect(
      renderChange(rec('chord', 'added', { section: 'Chorus', bar: null }, null, 'Em'), t),
    ).toEqual({ where: 'Chorus', what: 'Em added' });
  });
  it('removed', () => {
    expect(
      renderChange(rec('chord', 'removed', { section: 'Verse', bar: 5 }, 'G7', null), t),
    ).toEqual({ where: 'Verse bar 5', what: 'G7 removed' });
  });
});

describe('renderChange: words (coarse)', () => {
  it('changed', () => {
    expect(renderChange(rec('words', 'changed', { section: 'Verse' }, 'a', 'b'), t)).toEqual({
      where: 'Verse',
      what: 'words changed',
    });
  });
});

describe('renderChange: voicing (block and per-voicing; tuning/chord as data)', () => {
  it('a whole block added reads under Voicings, naming the tuning', () => {
    expect(
      renderChange(rec('voicing', 'added', { tuning: 'G4 C4 E4 A4', variation: '' }), t),
    ).toEqual({ where: 'Voicings', what: 'added for G4 C4 E4 A4' });
  });
  it('a whole block removed', () => {
    expect(
      renderChange(rec('voicing', 'removed', { tuning: 'G4 C4 E4 A4', variation: '' }), t),
    ).toEqual({ where: 'Voicings', what: 'removed for G4 C4 E4 A4' });
  });
  it('a single voicing added, named by its chord (the block key)', () => {
    expect(
      renderChange(
        rec('voicing', 'added', { tuning: 'E2 A2 D3 G3 B3 E4', variation: '', key: 'D7' }, null, [1]),
        t,
      ),
    ).toEqual({ where: 'Voicings', what: 'for E2 A2 D3 G3 B3 E4: D7 added' });
  });
  it('a single voicing changed', () => {
    expect(
      renderChange(
        rec('voicing', 'changed', { tuning: 'E2 A2 D3 G3 B3 E4', variation: '', key: 'Em' }, [1], [2]),
        t,
      ),
    ).toEqual({ where: 'Voicings', what: 'for E2 A2 D3 G3 B3 E4: Em changed' });
  });
  it('a single voicing removed', () => {
    expect(
      renderChange(
        rec('voicing', 'removed', { tuning: 'E2 A2 D3 G3 B3 E4', variation: '', key: 'Em' }, [1], null),
        t,
      ),
    ).toEqual({ where: 'Voicings', what: 'for E2 A2 D3 G3 B3 E4: Em removed' });
  });
});
