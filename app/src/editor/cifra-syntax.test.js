// Unit — the syntax classifier (songs.editor, acceptance "syntax colouring").
// Pins workflow 3 §The editor, spec §1.9 L350-359 (a non-cifra fence is
// verbatim, not music) and §7.4 (a bad voicing is a reader-reported problem),
// and the mockup line classes. The fixtures are purpose-written songs.

import { describe, it, expect } from 'vitest';
import { classifyLines } from './cifra-syntax.js';

// A song that exercises every line class: title/property, section headings,
// music fences (chord vs lyric), a verbatim (```tab) fence, the rule, the
// voicings part, and one voicing the reader cannot read.
const SONG = [
  '# Tide and Timber', // 1  md (title)
  '- artist: The Wharf Hands', // 2  md (property)
  '- notation: brazilian', // 3  md (property)
  '', // 4  text
  '## Intro', // 5  md (heading)
  '```', // 6  md (fence open, music)
  'Am | Dm | G7 | C', // 7  ch
  '```', // 8  md (fence close)
  '', // 9  text
  '## Verse', // 10 md
  '```', // 11 md
  'Am          Dm', // 12 ch
  'the tide comes in slow', // 13 lyric
  '```', // 14 md
  '', // 15 text
  '## Notes', // 16 md
  '```tab', // 17 md (fence open, verbatim)
  'e|-0-1-3-|', // 18 verbatim
  '```', // 19 md
  '', // 20 text
  '---', // 21 md (the rule -> voicings part)
  '', // 22 text
  '## Voicings: E2 A2 D3 G3 B3 E4', // 23 md (voicing block heading)
  '- Am: x02210', // 24 voicing
  '- Dm: xx0231', // 25 voicing
  '- G7: 3200', // 26 err (4 frets for a 6-string tuning)
].join('\n');

describe('classifyLines', () => {
  it('tags each line of a song by its cifra.md structure', () => {
    const c = classifyLines(SONG, 'brazilian');
    // Title and properties (mockup `md`).
    expect(c[0]).toBe('md');
    expect(c[1]).toBe('md');
    expect(c[2]).toBe('md');
    // Section heading and fence delimiters.
    expect(c[4]).toBe('md');
    expect(c[5]).toBe('md');
    expect(c[7]).toBe('md');
    // A chord line vs a lyric line inside a music fence.
    expect(c[6]).toBe('ch');
    expect(c[11]).toBe('ch');
    expect(c[12]).toBe('lyric');
  });

  it('does not colour a verbatim (```tab) fence as music', () => {
    const c = classifyLines(SONG, 'brazilian');
    expect(c[16]).toBe('md'); // the ```tab delimiter is structure
    expect(c[17]).toBe('verbatim'); // its contents are not chords
    expect(c[17]).not.toBe('ch');
  });

  it('marks the rule and the voicings part', () => {
    const c = classifyLines(SONG, 'brazilian');
    expect(c[20]).toBe('md'); // ---
    expect(c[22]).toBe('md'); // ## Voicings: …
    expect(c[23]).toBe('voicing'); // - Am: x02210
    expect(c[24]).toBe('voicing');
  });

  it('marks a voicing the reader cannot read as an error', () => {
    const c = classifyLines(SONG, 'brazilian');
    expect(c[25]).toBe('err'); // - G7: 3200 — wrong number of strings (§7.4)
  });

  it('marks conflict-marker lines as their own class', () => {
    const marked = [
      '# Song',
      '```',
      '<<<<<<< ours',
      'Am',
      '=======',
      'C',
      '>>>>>>> theirs',
      '```',
    ].join('\n');
    const c = classifyLines(marked, 'brazilian');
    expect(c[2]).toBe('mk');
    expect(c[4]).toBe('mk');
    expect(c[6]).toBe('mk');
    // Ordinary music lines between the markers still read as chords.
    expect(c[3]).toBe('ch');
    expect(c[5]).toBe('ch');
  });
});
