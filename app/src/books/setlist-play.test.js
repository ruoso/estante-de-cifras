// Unit tests for the setlist player's pure glue (books.play; Decision 8). These
// pin the behaviour named in the refinement's acceptance criteria against the
// workflow sections cited inline.

import { describe, it, expect } from 'vitest';
import { playKeyOffset, playableItems, clampIndex, nextItem } from './setlist-play.js';

// A row as `setlistRows` returns it, with only the fields the glue reads.
function row({ number, title, path = null, missing = false, key = null, note = null }) {
  const resolvedPath = path;
  return { at: number - 1, number, title, path, resolvedPath, folder: '', key, note, missing };
}

describe('playKeyOffset — target key → signed semitone offset (workflow 12 §The key L52-54)', () => {
  it('G → A is +2', () => {
    expect(playKeyOffset('G', 'A')).toBe(2);
  });

  it('C → Db is one semitone', () => {
    expect(playKeyOffset('C', 'Db')).toBe(1);
  });

  it('reads a minor key by its root, folding the mode and the unicode glyphs', () => {
    expect(playKeyOffset('Em', 'F#m')).toBe(2);
    expect(playKeyOffset('G', 'A♭')).toBe(1);
  });

  // cifra.md §10.7.1 L342-347: keys that differ in mode are not applied.
  it('is null when the two keys differ in mode', () => {
    expect(playKeyOffset('Am', 'C')).toBeNull();
    expect(playKeyOffset('C', 'Am')).toBeNull();
  });

  // cifra.md §10.7.1 L335-337: the interval is between pitch classes, so the
  // same key — or an enharmonic respelling — is offset 0.
  it('is 0 for the same pitch class, enharmonic spellings included', () => {
    expect(playKeyOffset('G', 'G')).toBe(0);
    expect(playKeyOffset('A#', 'Bb')).toBe(0);
  });

  it('is null when the song has no written key', () => {
    expect(playKeyOffset(null, 'A')).toBeNull();
    expect(playKeyOffset(undefined, 'A')).toBeNull();
    expect(playKeyOffset('', 'A')).toBeNull();
  });

  it('is null when either key is unparseable', () => {
    expect(playKeyOffset('H', 'A')).toBeNull();
    expect(playKeyOffset('G', 'Z')).toBeNull();
    expect(playKeyOffset('G', null)).toBeNull();
  });
});

describe('playableItems — missing and unlinked skipped (workflow 12 §Songs moved L83-85)', () => {
  it('keeps linked, present song items in order', () => {
    const rows = [
      row({ number: 1, title: 'One', path: 'one.cifra.md' }),
      row({ number: 2, title: 'Two', path: 'two.cifra.md' }),
    ];
    expect(playableItems(rows).map((r) => r.title)).toEqual(['One', 'Two']);
  });

  it('excludes a missing middle item, playing the rest in order', () => {
    const rows = [
      row({ number: 1, title: 'One', path: 'one.cifra.md' }),
      row({ number: 2, title: 'Gone', path: 'gone.cifra.md', missing: true }),
      row({ number: 3, title: 'Three', path: 'three.cifra.md' }),
    ];
    expect(playableItems(rows).map((r) => r.title)).toEqual(['One', 'Three']);
  });

  it('excludes an unlinked item (no path)', () => {
    const rows = [
      row({ number: 1, title: 'Just a note', path: null, missing: true }),
      row({ number: 2, title: 'Real', path: 'real.cifra.md' }),
    ];
    expect(playableItems(rows).map((r) => r.title)).toEqual(['Real']);
  });

  it('tolerates an empty or missing rows list', () => {
    expect(playableItems([])).toEqual([]);
    expect(playableItems(undefined)).toEqual([]);
  });
});

describe('clampIndex — navigation stops at the ends, no wrap (workflow 12 §Playing through)', () => {
  it('clamps below zero to the first item', () => {
    expect(clampIndex(-1, 3)).toBe(0);
  });

  it('clamps past the end to the last item', () => {
    expect(clampIndex(3, 3)).toBe(2);
    expect(clampIndex(99, 3)).toBe(2);
  });

  it('passes an in-range index through', () => {
    expect(clampIndex(1, 3)).toBe(1);
  });

  it('is zero for an empty list', () => {
    expect(clampIndex(0, 0)).toBe(0);
    expect(clampIndex(2, 0)).toBe(0);
  });

  it('maps to the right item once missing items are already excluded', () => {
    const rows = [
      row({ number: 1, title: 'One', path: 'one.cifra.md' }),
      row({ number: 2, title: 'Gone', path: 'gone.cifra.md', missing: true }),
      row({ number: 3, title: 'Three', path: 'three.cifra.md' }),
    ];
    const playable = playableItems(rows);
    expect(playable[clampIndex(1, playable.length)].title).toBe('Three');
  });
});

describe('nextItem — the Next card (workflow 12 §Playing through L72)', () => {
  const playable = [
    row({ number: 1, title: 'One', path: 'one.cifra.md' }),
    row({ number: 3, title: 'Three', path: 'three.cifra.md', note: 'start from the B section' }),
  ];

  it('gives the following item its number, title and note', () => {
    expect(nextItem(playable, 0)).toEqual({ number: 3, title: 'Three', note: 'start from the B section' });
  });

  it('carries a null note when the next item has none', () => {
    expect(nextItem([playable[1], playable[0]], 0)).toEqual({ number: 1, title: 'One', note: null });
  });

  it('is null at the last song', () => {
    expect(nextItem(playable, 1)).toBeNull();
    expect(nextItem(playable, 5)).toBeNull();
  });
});
