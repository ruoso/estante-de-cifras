// save-note (unit) — the pure default-note builder (songs.save_sheet, Decision
// 3). Pins workflow 4 §Saving (one song → its summary verbatim) and §Several
// songs at once (save all → the per-song aggregate, one commit over many files).

import { describe, it, expect } from 'vitest';
import { buildSaveNote, defaultSaveMessage } from './save-note.js';

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

// songs.save_empty_message — workflow 4 §Saving: with no musical summary the note
// names the file it saves; a save is never left without a message.
describe('defaultSaveMessage', () => {
  it('one path → Update <path> (workflow 4 §Saving)', () => {
    expect(defaultSaveMessage(['README.md'])).toBe('Update README.md');
  });

  it('several paths → comma-joined in the given order', () => {
    expect(defaultSaveMessage(['README.md', 'songs/tarde-clara.md', '.gitattributes'])).toBe(
      'Update README.md, songs/tarde-clara.md, .gitattributes',
    );
  });

  it('no paths → Update', () => {
    expect(defaultSaveMessage([])).toBe('Update');
    expect(defaultSaveMessage(undefined)).toBe('Update');
  });
});

describe('buildSaveNote with no musical summary (workflow 4 §Saving)', () => {
  it('a single preview with an empty summary → Update <path>', () => {
    expect(buildSaveNote([{ path: 'README.md', title: '', summary: '' }])).toBe(
      'Update README.md',
    );
  });

  it('save all mixing a summarised song and a summary-less README.md', () => {
    expect(
      buildSaveNote([
        { path: 'tarde-clara.md', title: 'Tarde Clara', summary: 'Primeira Parte bar 2: D → D7' },
        { path: 'README.md', title: '', summary: '' },
      ]),
    ).toBe('Tarde Clara: Primeira Parte bar 2: D → D7; Update README.md');
  });
});
