/**
 * The explorer's flip label (workflow 16 §Viewing by notation, *How the flip
 * spells the other reading*): the other reading of an ambiguous symbol, spelled
 * so it cannot be mistaken for the symbol typed.
 *
 * The other reading is spelled in American with `♯`/`♭` (*C7♯5*, *C9*, *Cdim*,
 * *C7add4*), except a flip back to the user's own dialect's reading, which is
 * spelled in that dialect (*C7M*), the way the notice first named it.
 */

import { getDialect } from './dialects.js';
import { formatChord } from './format.js';
import { parseChord } from './parse.js';

/**
 * @param {string} text the symbol as typed
 * @param {string} dialectId the user's notation dialect
 * @param {Record<string, string>} [overrides] the readings already flipped
 * @returns {string | null} the flip's chord, or null when there is nothing to flip
 */
export function flipSymbol(text, dialectId, overrides = {}) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parsed = parseChord(trimmed, dialectId, { readings: overrides });
  const ambiguity = parsed.chord ? parsed.ambiguities?.[0] : null;
  if (!ambiguity) return null;
  const alternative = ambiguity.alternatives[0];
  const other = parseChord(trimmed, dialectId, {
    readings: { ...overrides, [ambiguity.kind]: alternative },
  });
  if (!other.chord) return null;
  const own = getDialect(dialectId).readings[ambiguity.kind] === alternative;
  return formatChord(other.chord, own ? dialectId : 'american', { accidentals: 'unicode' });
}
