import { describe, it, expect } from 'vitest';
import { parseChord } from './notation/parse.js';
import { fromCatalog } from './instrument.js';
import { searchFingerings } from './search.js';
import { defaultVoicing } from './voicings.js';

const guitar = fromCatalog('6guitar');
const uke = fromCatalog('ukulele');

describe('the default voicing', () => {
  it('is the open-position shape when there is one', () => {
    // Exactly what the explorer shows first, so "if you do not choose, you get
    // what you would have seen first".
    const chord = parseChord('C').chord;
    const shown = searchFingerings(chord, guitar).groups[0].fingerings[0];
    const chosen = defaultVoicing(chord, guitar);
    expect(chosen.shorthand).toBe(shown.shorthand);
    expect(chosen.position).toBe(0);
  });

  it('falls to the lowest position that has anything when nothing is open', () => {
    // No open-string voicing exists for this; the default must still be the
    // lowest group, not nothing.
    const chord = parseChord('F#m7b5').chord;
    const result = searchFingerings(chord, guitar);
    const chosen = defaultVoicing(chord, guitar);
    expect(chosen).not.toBeNull();
    expect(chosen.position).toBe(result.groups[0].position);
    expect(chosen.shorthand).toBe(result.groups[0].fingerings[0].shorthand);
  });

  it('is null when the search finds nothing', () => {
    expect(defaultVoicing(parseChord('C13#11').chord, uke)).toBeNull();
  });
});
