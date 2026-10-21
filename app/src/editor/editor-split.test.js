// Unit — the editor's split rule (songs.editor_split_width; workflow 3 §The
// editor L78-84, Constraints 1-2): side by side exactly when the editor's own
// width is at least 640px, the layout mode when the width is unmeasured, and
// never when the host withholds the preview.

import { describe, it, expect } from 'vitest';
import { EDITOR_SPLIT_MIN_WIDTH, editorSplits } from './editor-split.js';

describe('editorSplits', () => {
  it('splits at 640px of editor width and not below', () => {
    expect(EDITOR_SPLIT_MIN_WIDTH).toBe(640);
    for (const mode of ['wide', 'narrow']) {
      expect(editorSplits({ width: 639, mode, previewAllowed: true })).toBe(false);
      expect(editorSplits({ width: 640, mode, previewAllowed: true })).toBe(true);
      expect(editorSplits({ width: 1000, mode, previewAllowed: true })).toBe(true);
    }
  });

  it('unmeasured (null or 0) falls back to the layout mode', () => {
    for (const width of [null, 0, undefined]) {
      expect(editorSplits({ width, mode: 'wide', previewAllowed: true })).toBe(true);
      expect(editorSplits({ width, mode: 'narrow', previewAllowed: true })).toBe(false);
    }
  });

  it('a withheld preview never splits, at any width', () => {
    for (const width of [null, 0, 600, 639, 640, 1000]) {
      for (const mode of ['wide', 'narrow']) {
        expect(editorSplits({ width, mode, previewAllowed: false })).toBe(false);
      }
    }
  });
});
