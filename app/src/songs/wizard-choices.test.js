// Unit — the voicing wizard's pure branch helper (songs.wizard_ui, workflow 5).
// No DOM, no React: parse a purpose-written song and pin the new-vs-over branch
// and the `existing` map the preview's "would change" count rests on. Fixtures
// are songs written for the purpose, never anyone's copyrighted words.

import { describe, it, expect } from 'vitest';
import { parse } from 'cifra-md';
import { inUseHasChoices, existingFor } from './wizard-choices.js';

const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';
const CAVACO_TUNING = 'D4 G4 B4 D5';
const FENCE = '```';

// A chord-only chart, with any number of voicing blocks after the `---` rule.
const song = (blocks = []) =>
  parse(
    [
      '# Tarde Clara',
      '',
      '## Primeira Parte',
      FENCE,
      'G | C | Am | G',
      FENCE,
      ...(blocks.length ? ['', '---', '', ...blocks] : []),
    ].join('\n') + '\n',
  );

const guitarDefault = [`## Voicings: ${GUITAR_TUNING}`, '- G: 320003', '- C: x32010', '- Am: x02210'];

describe('inUseHasChoices', () => {
  // Pins Workflow 5 L70-72, cifra.md §7.2–7.3: the wizard offers new/over only
  // when the variation in use already holds chosen shapes for this tuning.
  it('is true when the in-use default variation voices chords for this tuning', () => {
    const model = song(guitarDefault);
    expect(inUseHasChoices(model, GUITAR_TUNING, '')).toBe(true);
  });

  it('is false when the song has no block for this tuning (write straight in)', () => {
    const model = song(guitarDefault);
    // The cavaco has no voicing block, so its default variation holds nothing.
    expect(inUseHasChoices(model, CAVACO_TUNING, '')).toBe(false);
  });

  it('is false for a song with no voicings at all', () => {
    expect(inUseHasChoices(song(), GUITAR_TUNING, '')).toBe(false);
  });

  it('follows the named variation in use, never falling back across variations (§7.3)', () => {
    const model = song([
      ...guitarDefault,
      '',
      `## Up the neck: ${GUITAR_TUNING}`,
      '- G: 355433',
    ]);
    // The named variation has its own choices.
    expect(inUseHasChoices(model, GUITAR_TUNING, 'Up the neck')).toBe(true);
    // A named variation this tuning does not have yields no block — no fallback.
    expect(inUseHasChoices(model, GUITAR_TUNING, 'Nowhere')).toBe(false);
  });

  it('is false for an empty in-use block (a heading with no shapes)', () => {
    const model = song([`## Voicings: ${GUITAR_TUNING}`]);
    expect(inUseHasChoices(model, GUITAR_TUNING, '')).toBe(false);
  });

  it('is false when the tuning text does not parse', () => {
    expect(inUseHasChoices(song(guitarDefault), 'not a tuning', '')).toBe(false);
  });
});

describe('existingFor', () => {
  // Pins planVoicings `unchanged`; DESIGN §2.10: the preview's "would change"
  // count needs the song's current choices keyed by the §2.4 voicing key.
  it('builds the key→frets map of the in-use variation', () => {
    const map = existingFor(song(guitarDefault), GUITAR_TUNING, '');
    expect([...map.keys()].sort()).toEqual(['Am', 'C', 'G']);
    expect(map.get('G')).toEqual([3, 2, 0, 0, 0, 3]);
    expect(map.get('C')).toEqual(['x', 3, 2, 0, 1, 0]);
  });

  it('reads the named variation in use, not the default', () => {
    const model = song([
      ...guitarDefault,
      '',
      `## Up the neck: ${GUITAR_TUNING}`,
      '- G: 355433',
    ]);
    const map = existingFor(model, GUITAR_TUNING, 'Up the neck');
    expect([...map.keys()]).toEqual(['G']);
    expect(map.get('G')).toEqual([3, 5, 5, 4, 3, 3]);
  });

  it('is empty when the tuning has no block in use', () => {
    expect(existingFor(song(guitarDefault), CAVACO_TUNING, '').size).toBe(0);
    expect(existingFor(song(), GUITAR_TUNING, '').size).toBe(0);
  });
});
