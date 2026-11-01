// unit — which shapes caption explains the screen's marks (songs.print_no_defaults):
// that one is left off paper; the transposed caption is not.

import { describe, it, expect } from 'vitest';
import { captionExplainsMarks } from './song-sheet.js';

const sheet = (sources, transposed = false) => ({ transposed, shapes: sources.map((source) => ({ source })) });

describe('captionExplainsMarks', () => {
  it('is the marks caption when a shape is not the song’s own, at the written key', () => {
    expect(captionExplainsMarks(sheet(['song', 'default']))).toBe(true);
    expect(captionExplainsMarks(sheet(['yours']))).toBe(true);
  });
  it('is not when every shape is the song’s, or the song is read transposed', () => {
    expect(captionExplainsMarks(sheet(['song', 'song']))).toBe(false);
    expect(captionExplainsMarks(sheet(['default'], true))).toBe(false);
    expect(captionExplainsMarks(sheet([]))).toBe(false);
  });
});
