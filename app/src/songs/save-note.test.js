// save-note (unit) — the pure default-note builder (songs.save_sheet, Decision
// 3). Pins workflow 4 §Saving (one song → its summary verbatim) and §Several
// songs at once (save all → the per-song aggregate, one commit over many files).

import { describe, it, expect } from 'vitest';
import { buildSaveNote } from './save-note.js';

describe('buildSaveNote', () => {
  it('one song → the diff summary, verbatim (the neutral-English commit note)', () => {
    const summary = 'Primeira Parte bar 2: D → D7; added voicings for G4 C4 E4 A4';
    expect(buildSaveNote([{ title: 'Tarde Clara', summary }])).toBe(summary);
  });

  it('save all → each song summary prefixed with its title, joined with "; "', () => {
    expect(
      buildSaveNote([
        { title: 'Tarde Clara', summary: 'Primeira Parte bar 2: D → D7' },
        { title: 'Carinhoso', summary: 'added voicings for E2 A2 D3 G3 B3 E4' },
      ]),
    ).toBe(
      'Tarde Clara: Primeira Parte bar 2: D → D7; Carinhoso: added voicings for E2 A2 D3 G3 B3 E4',
    );
  });

  it('a titleless song in save all contributes its summary alone', () => {
    expect(
      buildSaveNote([
        { title: '', summary: 'Title added: Nova' },
        { title: 'Carinhoso', summary: 'Verse words changed' },
      ]),
    ).toBe('Title added: Nova; Carinhoso: Verse words changed');
  });

  it('no previews → empty note', () => {
    expect(buildSaveNote([])).toBe('');
    expect(buildSaveNote(undefined)).toBe('');
  });
});
