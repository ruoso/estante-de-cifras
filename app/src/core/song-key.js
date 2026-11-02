// song-key.js — the key a song is named by when it states none (workflow 2
// §Transposing; workflow 19 §A song). Pure: it reads the cifra.md parse model
// as data and knows nothing of React, the Worker or the view (DIRECTION §3.7).
//
// The `key` property is informative (cifra.md §1.4.3) and many songs leave it
// out, yet the reader must always see a key, never a bare number of semitones.
// So a song with no key is named by the key its *last* chord gives: a cadence
// on the tonic is the most reliable cue to key a chord list carries, and a
// choro that opens on its dominant still ends on its key. cifra.md has no Fine
// or D.C. and writes a last ending after the closing mark (§3.4), so the last
// chord written is the last chord played.
//
// The name is only a name: it never computes a setlist interval — a setlist
// key is applied only through the song's own `key` property (§10.7.1).

import { formatNote } from 'cifra-md';
import { parseChord } from './notation/parse.js';
import { chartChords } from './voicings.js';

/**
 * The key a chord gives a song: its root, and `m` when it is minor — `Am7`
 * gives `Am`, `Eb/G` gives `Eb`. Null for a symbol the notation does not read
 * as a chord.
 *
 * @param {string|null|undefined} symbol a chord as the chart spells it
 * @param {string} notation the song's own dialect
 * @returns {string|null}
 */
export function chordKeyName(symbol, notation) {
  if (!symbol) return null;
  const chord = parseChord(symbol, notation).chord;
  if (!chord?.root) return null;
  return formatNote(chord.root) + (chord.quality === 'minor' ? 'm' : '');
}

/**
 * The key a song's chart gives: the key of its last chord (`chordKeyName`), in
 * the model's own spelling — so a transposed model names the transposed key.
 * Null when the chart has no chord. It does not read the `key` property:
 * callers name a stated key through `transposedKeyName` and fall back to this.
 *
 * @param {object|null|undefined} model a cifra.md parse model (possibly transposed)
 * @param {string} notation the song's own dialect
 * @returns {string|null}
 */
export function songKeyName(model, notation) {
  let last = null;
  for (const item of chartChords(model)) last = item;
  return last ? chordKeyName(last.symbol, notation) : null;
}
