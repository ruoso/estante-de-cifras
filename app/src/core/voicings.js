/**
 * The default voicing for a chord on one instrument, and the keys that cannot
 * be voiced at all.
 *
 * A teacher writing out a song should only have to choose voicings for the
 * chords that are not obvious. For the rest, the default is the shape the
 * explorer would show first — open position if there is one, otherwise the
 * easiest shape in the lowest position that has any. Since the result groups
 * are already ordered open-first with empty groups skipped, that is simply the
 * first shape of the first group.
 *
 * Defaults are derived here, never written into the song text: writing them in
 * would fill the voicings with shapes nobody chose and hide the ones somebody
 * did.
 *
 * Pure and synchronous, like everything in core/ (docs/DESIGN.md §3.2).
 */

import { searchFingerings } from './search.js';

/**
 * The shape a chord gets when nobody has chosen one.
 * @returns {import('./search.js').Fingering|null} null if nothing is playable
 */
export function defaultVoicing(chord, instrument) {
  const result = searchFingerings(chord, instrument);
  return result.groups[0]?.fingerings[0] ?? null;
}

/** Keys that resolved to nothing at all: valid chords the search cannot voice. */
export function unvoiceableKeys(parsed, resolved) {
  const seen = new Set();
  const out = [];
  for (const chord of parsed.occurrences) {
    if (seen.has(chord.key) || !chord.valid || resolved.has(chord.key)) continue;
    seen.add(chord.key);
    out.push(chord.key);
  }
  return out;
}
