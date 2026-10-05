import { describe, it, expect } from 'vitest';
import { classifyMergeForPath, filterSongLog } from './history.js';

// unit — the pure, I/O-free helpers factored out of history.js (storage.history
// acceptance). No IndexedDB, no git: these operate on fabricated commit/blob-oid
// fixtures. They pin workflow 6 L24-32 (merges hidden unless resolved) and the
// classification rule history.md Decision 2 settles.

describe('classifyMergeForPath (workflow 6 L24-32; history.md Decision 2)', () => {
  it("flags a merge whose song equals one parent as 'joined' (omit it)", () => {
    // The song came verbatim from one side: the saves it joins are already in the
    // list, so the merge is hidden (workflow 6 L24-31).
    expect(classifyMergeForPath('blobA', ['blobA', 'blobBASE'])).toBe('joined');
    // Equal to the OTHER parent is joined too (order does not matter).
    expect(classifyMergeForPath('blobB', ['blobBASE', 'blobB'])).toBe('joined');
  });

  it("flags a merge whose song differs from every parent as 'resolution' (keep it)", () => {
    // A version no single save produced — "a change nobody saved in the ordinary
    // way" (workflow 6 L31-32; workflow 9 L69-70): merged, with your resolution.
    expect(classifyMergeForPath('blobR', ['blobA', 'blobB'])).toBe('resolution');
  });

  it("flags an absent song as 'absent' (no place in the song's log)", () => {
    expect(classifyMergeForPath(null, ['blobA', 'blobB'])).toBe('absent');
  });
});

describe('filterSongLog (workflow 6 L24-32)', () => {
  // Fabricated newest-first raw entries: non-merges, a joined merge, a resolution
  // merge, an absent merge. filterSongLog drops joined/absent merges and keeps
  // non-merges and resolution merges, in order, setting the `resolution` flag.
  const raw = [
    { commit: 'c5', isMerge: false, mergeClass: null, path: 's.cifra.md' },
    { commit: 'c4', isMerge: true, mergeClass: 'resolution', path: 's.cifra.md' },
    { commit: 'c3', isMerge: true, mergeClass: 'joined', path: 's.cifra.md' },
    { commit: 'c2', isMerge: true, mergeClass: 'absent', path: 's.cifra.md' },
    { commit: 'c1', isMerge: false, mergeClass: null, path: 's.cifra.md' },
  ];

  it('keeps non-merges and resolution merges, drops joined and absent merges, in order', () => {
    const kept = filterSongLog(raw);
    expect(kept.map((e) => e.commit)).toEqual(['c5', 'c4', 'c1']);
  });

  it('sets resolution true only on a resolution merge, false on a non-merge', () => {
    const kept = filterSongLog(raw);
    expect(kept.find((e) => e.commit === 'c5').resolution).toBe(false);
    expect(kept.find((e) => e.commit === 'c4').resolution).toBe(true);
    expect(kept.find((e) => e.commit === 'c1').resolution).toBe(false);
  });

  it('strips the internal mergeClass from kept entries', () => {
    for (const entry of filterSongLog(raw)) {
      expect(entry).not.toHaveProperty('mergeClass');
    }
  });
});
