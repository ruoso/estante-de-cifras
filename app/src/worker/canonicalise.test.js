import { describe, it, expect } from 'vitest';
import { canonicaliseFile } from './canonicalise.js';

// unit — the canonicalise-one-file step (storage.working_copy). Pins
// tasks/40-storage.tji:33 ("canonicalising before commit"), workflow 4 L48-56
// (voicings put in canonical order, the chart untouched), spec §8.1 (every
// document has one canonical form a writer MUST save) and §11.12.3 (a marked
// text MUST be refused). All song/setlist text is written for this test.

// A small original song in canonical form: a fenced chart and a voicings block
// whose items are in code-point order (C, D, Em, G).
const CANONICAL_SONG = [
  '# Rainy Window',
  '',
  '## Verse',
  '```',
  'G            C',
  'The rain taps on the glass',
  'Em           D',
  'and I stay in today',
  '```',
  '',
  '---',
  '',
  '## Voicings: E2 A2 D3 G3 B3 E4',
  '- C: x32010',
  '- D: xx0232',
  '- Em: 022000',
  '- G: 320003',
  '',
].join('\n');

describe('canonicaliseFile — songs', () => {
  it('puts a hand-typed song back in canonical order, the chart untouched (workflow 4 L48-56)', () => {
    // The same song as typed by hand: the voicing lines are out of order (G
    // first, then Em, D, C). Canonicalisation reorders them; the chart lines are
    // left exactly as written.
    const typed = CANONICAL_SONG.replace(
      '- C: x32010\n- D: xx0232\n- Em: 022000\n- G: 320003',
      '- G: 320003\n- Em: 022000\n- D: xx0232\n- C: x32010',
    );
    const result = canonicaliseFile('rainy-window.cifra.md', typed);
    expect(result.ok).toBe(true);
    expect(result.text).toBe(CANONICAL_SONG);
    // The chart survived verbatim (only the voicings moved).
    expect(result.text).toContain('G            C\nThe rain taps on the glass');
  });

  it('leaves an already-canonical song unchanged (spec §8.1 fixed point)', () => {
    const result = canonicaliseFile('rainy-window.cifra.md', CANONICAL_SONG);
    expect(result).toEqual({ ok: true, text: CANONICAL_SONG });
  });

  it('refuses a song holding a conflict marker via MarkedTextError (spec §11.12.3)', () => {
    const marked = [
      '# Rainy Window',
      '',
      '## Verse',
      '```',
      '<<<<<<< ours',
      'G            C',
      '=======',
      'G            Am',
      '>>>>>>> theirs',
      '```',
      '',
    ].join('\n');
    const result = canonicaliseFile('rainy-window.cifra.md', marked);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('marked');
    // The refusal points at the first marker line (from the writer's error).
    expect(result.marker).toBe('<<<<<<< ours');
    expect(typeof result.line).toBe('number');
  });
});

describe('canonicaliseFile — setlists', () => {
  // A setlist whose one item has its entries out of order (note before key):
  // canonicalisation reorders them to key -> note (spec §10.9).
  const TYPED_SETLIST = [
    '# Evening Set',
    '',
    '1. [First Song](first-song.cifra.md)',
    '   - note: play slowly',
    '   - key: D',
    '',
  ].join('\n');

  it('canonicalises through the setlist writer (reorders item entries, §10.9)', () => {
    const result = canonicaliseFile('evening.setlist.md', TYPED_SETLIST);
    expect(result.ok).toBe(true);
    expect(result.text).toBe(
      [
        '# Evening Set',
        '',
        '1. [First Song](first-song.cifra.md)',
        '   - key: D',
        '   - note: play slowly',
        '',
      ].join('\n'),
    );
  });

  it('refuses a setlist holding a conflict marker (spec §11.12.3)', () => {
    // The setlist writer does not raise on a marker itself; the save path gates
    // on the format's own markerLines primitive, so a marked setlist is refused
    // the same as a marked song (standing rule: a marked text is never saved).
    const marked = '# Evening Set\n\n1. [A](a.cifra.md)\n<<<<<<< ours\n';
    const result = canonicaliseFile('evening.setlist.md', marked);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('marked');
    expect(result.marker).toBe('<<<<<<< ours');
  });
});
