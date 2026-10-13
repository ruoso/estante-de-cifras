// restore-block.test.js (unit) — the pure model-level splice behind RESTORE_PART
// (songs.restore_part, workflow 6 §Restoring; cifra.md §8.3). Purpose-written
// songs (never copyrighted words). Each case pins a splice shape and the
// load-bearing invariant "one block changes, the rest byte-identical", asserted
// against the canonical round-trip `write(parse(expected))`.

import { describe, it, expect } from 'vitest';
import { parse, write, isCanonical } from 'cifra-md';
import { restoreBlock } from './restore-block.js';

// Canonical bytes of a song, the form restoreBlock writes and tests compare to.
const canon = (song) => write(parse(song));
const lines = (...l) => l.join('\n');

// A small unsung ukulele song: two sections and a voicings block for every chord
// the chart uses (G4 C4 E4 A4, the ukulele's sound).
const base = (chorus, extraSections = '', voicings = lines('- Am: 2000', '- C: 0003', '- F: 2010', '- G: 0232')) =>
  lines(
    '# Harbour Light',
    '',
    '## Verse',
    '```',
    '| C | G |',
    '```',
    '',
    '## Chorus',
    '```',
    `| ${chorus} |`,
    '```',
    extraSections,
    '---',
    '',
    '## Voicings: G4 C4 E4 A4',
    voicings,
    '',
  );

describe('restoreBlock — sections', () => {
  it('replaces one section and leaves the rest byte-identical (§Restoring; "the rest untouched")', () => {
    const working = base('Am | F');
    const version = base('F | Am'); // the Chorus chords are swapped — same chord set
    const out = restoreBlock(working, version, { kind: 'section', name: 'Chorus', fromName: 'Chorus' });
    expect(out.text).toBe(canon(base('F | Am')));
    // Verse and the voicings block are carried through unchanged.
    expect(out.text).toContain('## Verse');
    expect(out.text).toContain('## Voicings: G4 C4 E4 A4');
  });

  it('adds a section the version has and the working copy lost', () => {
    const working = base('Am | F');
    const version = base('Am | F', lines('', '## Bridge', '```', '| C | G |', '```', ''));
    const out = restoreBlock(working, version, { kind: 'section', name: 'Bridge', fromName: 'Bridge' });
    // The Bridge comes back after the Chorus (its version-order position).
    expect(out.text).toBe(canon(base('Am | F', lines('', '## Bridge', '```', '| C | G |', '```', ''))));
  });

  it('removes a section the working copy added since the version', () => {
    const working = base('Am | F', lines('', '## Outro', '```', '| C | G |', '```', ''));
    const version = base('Am | F');
    const out = restoreBlock(working, version, { kind: 'section', name: 'Outro', fromName: 'Outro' });
    expect(out.text).toBe(canon(base('Am | F')));
    expect(out.text).not.toContain('## Outro');
  });

  it('renames a section back and restores its content (rename pairs working→version names)', () => {
    const working = base('Am | F', lines('', '## Refrão', '```', '| C | G |', '```', ''));
    const version = base('Am | F', lines('', '## Bridge', '```', '| C | G |', '```', ''));
    const out = restoreBlock(working, version, { kind: 'section', name: 'Refrão', fromName: 'Bridge' });
    expect(out.text).toBe(canon(base('Am | F', lines('', '## Bridge', '```', '| C | G |', '```', ''))));
    expect(out.text).not.toContain('## Refrão');
  });
});

describe('restoreBlock — voicing blocks', () => {
  const twoBlocks = (altFrets, keys = lines('- Am: 2000', '- C: 0003', '- F: 2010', '- G: 0232')) =>
    lines(
      '# Harbour Light',
      '',
      '## Verse',
      '```',
      '| C | G |',
      '```',
      '',
      '## Chorus',
      '```',
      '| Am | F |',
      '```',
      '',
      '---',
      '',
      '## Voicings: G4 C4 E4 A4',
      keys,
      '',
      `## Low: G4 C4 E4 A4`,
      altFrets,
      '',
    );

  it('replaces one voicing block and leaves the default block untouched', () => {
    const working = twoBlocks(lines('- C: 0003'));
    const version = twoBlocks(lines('- C: 5433')); // the Low variation's C shape differs
    const out = restoreBlock(working, version, { kind: 'voicing', tuning: 'G4 C4 E4 A4', variation: 'Low' });
    expect(out.text).toBe(canon(twoBlocks(lines('- C: 5433'))));
    expect(isCanonical(out.text)).toBe(true);
  });

  it('adds a voicing block the version has and the working copy lost', () => {
    const working = base('Am | F');
    const version = twoBlocks(lines('- C: 5433'));
    const out = restoreBlock(working, version, { kind: 'voicing', tuning: 'G4 C4 E4 A4', variation: 'Low' });
    expect(out.text).toContain('## Low: G4 C4 E4 A4');
    expect(out.text).toContain('5433');
    expect(isCanonical(out.text)).toBe(true);
  });

  it('removes a voicing block the working copy added since the version', () => {
    const working = twoBlocks(lines('- C: 5433'));
    const version = base('Am | F');
    const out = restoreBlock(working, version, { kind: 'voicing', tuning: 'G4 C4 E4 A4', variation: 'Low' });
    expect(out.text).toBe(canon(base('Am | F')));
    expect(out.text).not.toContain('## Low');
  });

  it('canonicalisation renumbers footnote indices when a restored voicing collides (§8.3 I2/I3)', () => {
    // The default and Low blocks carry the same C shape in the working copy (§8.3
    // I3 would merge them); the version's Low block gives C a distinct shape, so
    // restoring it forces two numbered C voicings. The output must stay canonical.
    const working = twoBlocks(lines('- C: 0003'));
    const version = twoBlocks(lines('- C: 5433'));
    const out = restoreBlock(working, version, { kind: 'voicing', tuning: 'G4 C4 E4 A4', variation: 'Low' });
    expect(isCanonical(out.text)).toBe(true);
    // A re-parse/re-write is a fixed point: footnote indices are self-consistent.
    expect(write(parse(out.text))).toBe(out.text);
  });
});

describe('restoreBlock — brings nothing back (behaviour 4)', () => {
  it('a block that already matches now is empty', () => {
    const song = base('Am | F');
    const out = restoreBlock(song, song, { kind: 'section', name: 'Chorus', fromName: 'Chorus' });
    expect(out).toEqual({ empty: true });
  });

  it('a voicing block whose chords are not in the working chart prunes to nothing', () => {
    // The version voices a tuning/chord (D5 on a second instrument) the working
    // chart never plays; §8.3 I1 empties it, so the restore brings nothing back
    // and leaves no dangling heading.
    const working = base('Am | F');
    const version = lines(
      '# Harbour Light',
      '',
      '## Verse',
      '```',
      '| C | G |',
      '```',
      '',
      '## Chorus',
      '```',
      '| Am | F |',
      '```',
      '',
      '---',
      '',
      '## Voicings: G4 C4 E4 A4',
      '- Am: 2000',
      '- C: 0003',
      '- F: 2010',
      '- G: 0232',
      '',
      '## Voicings: D4 G4 B4 E4',
      '- D5: 0000', // D5 is never played in the chart above
      '',
    );
    const out = restoreBlock(working, version, { kind: 'voicing', tuning: 'D4 G4 B4 E4', variation: '' });
    expect(out).toEqual({ empty: true });
  });
});
