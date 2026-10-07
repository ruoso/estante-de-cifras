// wizard-choices.js — the voicing wizard's one pure branch helper
// (songs.wizard_ui, workflow 5). No React and no I/O: given the parsed
// working-copy model, the §6.2 tuning text and the variation in use, it answers
// the two questions the wizard screen asks the engine and itself —
//
//   - does the in-use variation already hold chosen shapes for this tuning, so
//     the screen offers *into a new variation* first and *over this one* second
//     (when it does not, the plan is written straight in with no question —
//     Workflow 5 L70-72, Decision 3)?
//   - what shapes does it already hold, as the `existing` map `planVoicings`
//     wants so its "{n} of {m} would change" count is right (DESIGN §2.10)?
//
// Both read the same block the read-time resolver reads, so the branch matches
// what the song actually shows: the §7.6 no-fallback block selection
// (core/voicings.js `selectBlock`) — the block for this tuning and variation, or
// the first block for the tuning when the default is in use and unlabelled, and
// never another variation's. Pure and framework-free, like everything it sits
// beside (DIRECTION §3.7 lines 415-417); a co-located unit test pins it, as
// `arrange-choices` did, since the branch is pure and warrants it.

import { parseTuning } from '../core/instrument.js';
import { pitchToMidi } from '../core/pitch.js';

/** The §6.3 tuning id of a §6.2 tuning text, or null when it does not parse. */
function tuningIdOfText(text) {
  try {
    return parseTuning(text).map(pitchToMidi).join(' ');
  } catch {
    return null;
  }
}

/**
 * The voicing block in use for this tuning and variation, mirroring
 * `voicings.js:selectBlock` so the wizard branches on exactly what the resolver
 * resolves from: the block whose §6.3 tuning id matches and whose label is the
 * variation in use; failing that, when the default (`''`) is in use, the first
 * block for the tuning (a song with no unlabelled default block); and never a
 * block from another variation (§7.6 does not fall back across one).
 *
 * @param {object} model  a cifra.md parse model
 * @param {string} tuningText  the §6.2 tuning text (`entry.tuning`)
 * @param {string} variation  the variation in use; `''` is the default
 * @returns {object|null} the voicing block, or null when the tuning has none
 */
function inUseBlock(model, tuningText, variation = '') {
  const tuningId = tuningIdOfText(tuningText);
  if (!tuningId) return null;
  const candidates = (model?.blocks ?? []).filter((b) => b?.tuning?.id === tuningId);
  if (candidates.length === 0) return null;
  const named = candidates.find((b) => (b.label ?? '') === variation);
  if (named) return named;
  if (variation === '') return candidates[0];
  return null;
}

/**
 * Whether the variation in use already holds chosen shapes for this tuning.
 *
 * True when a block is in use and it voices at least one chord — the signal the
 * wizard uses to offer *into a new variation* / *over this one* rather than
 * writing straight in (Workflow 5 L70-72, Decision 3). False when the tuning has
 * no block, or the in-use block is empty.
 *
 * @param {object} model  a cifra.md parse model
 * @param {string} tuningText  the §6.2 tuning text
 * @param {string} [variation]  the variation in use; `''` is the default
 * @returns {boolean}
 */
export function inUseHasChoices(model, tuningText, variation = '') {
  const block = inUseBlock(model, tuningText, variation);
  return Boolean(block && Array.isArray(block.voicings) && block.voicings.length > 0);
}

/**
 * The song's current choices in the in-use variation, as the `Map<key, frets>`
 * `planVoicings`'s `existing` wants: keyed by the §2.4 voicing key (the same
 * `reading.line[at].ref.key` the engine compares against), valued by the block's
 * raw frets. Empty when the tuning has no block in use. This is what lets the
 * preview report which planned shapes the song already had (`unchanged`), so the
 * "{n} of {m} chords would change" count is right (DESIGN §2.10).
 *
 * @param {object} model  a cifra.md parse model
 * @param {string} tuningText  the §6.2 tuning text
 * @param {string} [variation]  the variation in use; `''` is the default
 * @returns {Map<string, (number|'x')[]>}
 */
export function existingFor(model, tuningText, variation = '') {
  const out = new Map();
  const block = inUseBlock(model, tuningText, variation);
  if (block) for (const v of block.voicings ?? []) out.set(v.key, v.frets);
  return out;
}
