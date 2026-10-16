/**
 * Where a chord's shape comes from: the song's choice, then my shape, then the
 * app's default, each marked for what it is (workflow 2 §"Where a chord's shape
 * comes from"; cifra.md §7.6).
 *
 * `resolveSongVoicings` is the read-time realisation of cifra.md §7.6, whose
 * third step — "a chord with no chosen shape takes a default" — the spec
 * deliberately leaves to the app (§7.6: "no chosen shape" is a defined outcome,
 * not an error). For every chord the chart uses it decides which shape to show
 * and where it came from, in the §7.6 order, and never falls back across a
 * voicing key, a variation or a tuning — a `Cm[2]` with no shape does not
 * inherit `Cm`'s.
 *
 * Nothing here is ever written into the song: defaults and my shapes are
 * "applied when the song is shown and are never written into it" (workflow 2).
 * Writing a saved shape into song text is a distinct, deliberate act owned by
 * the arrange wizard (workflow 5), not this read-only resolver.
 *
 * Pure, synchronous and framework-free, like everything in core/
 * (docs/DESIGN.md §3.2; DIRECTION §3.7). It imports only other core modules and
 * reads the cifra.md parse model as data; it touches no IndexedDB, no Worker
 * message and no React. The caller passes the in-use instrument and my shapes
 * already surfaced by the Worker; the resolver never reaches into storage.
 */

import { parseChord } from './notation/parse.js';
import { DEFAULT_DIALECT } from './notation/dialects.js';
import { sameChord } from './chord.js';
import { searchFingerings, fingeringFromFrets } from './search.js';
import { parseShorthand } from './fretstring.js';
import { openMidis, parseTuning } from './instrument.js';
import { pitchToMidi } from './pitch.js';

/**
 * @typedef {object} ResolvedVoicing
 * @property {'song'|'yours'|'default'} source  named to equal ChordDiagram's
 *   `kind` 1:1, so the view maps it with no translation (mockups README line 26)
 * @property {import('./search.js').Fingering} fingering
 */

/**
 * The shape a chord gets when nobody has chosen one: the shape the explorer
 * would show first — open position if there is one, otherwise the easiest shape
 * in the lowest position that has any. The result groups are already ordered
 * open-first with empty groups skipped, so that is the first shape of the first
 * group.
 *
 * @returns {import('./search.js').Fingering|null} null if nothing is playable
 */
export function defaultVoicing(chord, instrument) {
  const result = searchFingerings(chord, instrument);
  return result.groups[0]?.fingerings[0] ?? null;
}

/**
 * The §6.3 tuning identity of an instrument: the space-joined MIDI numbers of
 * its open strings (cifra.md tuning.js `tuningId`). Eb2 and D#2 are the same
 * string; a capo raises every string and so is a different tuning.
 */
function instrumentTuningId(instrument) {
  return openMidis(instrument).join(' ');
}

/** The §6.3 tuning id of a §6.2 tuning text, or null when it does not parse. */
function tuningIdOfText(text) {
  try {
    return parseTuning(text).map(pitchToMidi).join(' ');
  } catch {
    return null;
  }
}

/**
 * The voicing block for this instrument and the variation in use, or null when
 * the song has none for this tuning. The §7.6 no-fallback rule is absolute: a
 * named variation this tuning does not have yields no block (never another
 * variation's), and a block is never borrowed from another tuning.
 *
 * With no variation chosen (`''`): the default variation (`label === ''`) if the
 * song has one, otherwise the first block for that tuning in `parse.js` order.
 */
function selectBlock(parsed, tuningId, variation) {
  const candidates = (parsed?.blocks ?? []).filter((b) => b?.tuning?.id === tuningId);
  if (candidates.length === 0) return null;
  const named = candidates.find((b) => b.label === variation);
  if (named) return named;
  // No default block for this tuning → the first block it has (parse.js order).
  if (variation === '') return candidates[0];
  // A named variation this tuning does not have: no fallback across variations.
  return null;
}

/** Every chord item in the chart, in document order (with repeats of a key). */
function* chartChords(parsed) {
  for (const section of parsed?.sections ?? []) {
    for (const part of section?.body ?? []) {
      if (part?.type !== 'music') continue;
      for (const line of part.lines ?? []) {
        if (line?.kind !== 'chart' && line?.kind !== 'sung') continue;
        for (const measure of line.measures ?? []) {
          for (const item of measure?.items ?? []) {
            if (item?.type === 'chord' && item.chord) yield item;
          }
        }
      }
    }
  }
}

/**
 * The §7.5.1 fingering the song gave, mapped onto a resolved fingering. A
 * teacher's fingering is part of the shape they chose, so it is kept rather than
 * re-derived. cifra.md's per-string `int(1–4) | 'T' | null` maps to the app's
 * `1–4 | 0 (thumb) | null` (core/fingers.js).
 */
function withSongFingers(fingering, songFingers) {
  if (!Array.isArray(songFingers)) return fingering;
  return { ...fingering, fingers: songFingers.map((f) => (f === 'T' ? 0 : f)) };
}

/**
 * Resolve every chord the chart uses to a shape and where it came from.
 *
 * For each distinct chord occurrence (keyed by the §2.4 voicing key, in chart
 * order), in the §7.6 order:
 *   1. `song`    — the block for this tuning and variation voices this key;
 *   2. `yours`   — no song's choice, but a shape starred for this chord
 *                  (`sameChord`, not spelling) on this instrument and tuning;
 *   3. `default` — neither: the easiest shape the search finds.
 * A valid chord the search cannot voice at all is absent from the map (and
 * returned by `unvoiceableKeys`). Unknown tokens are not chord items and are
 * skipped. `parsed` is never mutated.
 *
 * @param {object} parsed  a cifra.md parse model
 * @param {object} instrument  the in-use instrument instance (its effective
 *   heuristics on `.heuristics`)
 * @param {object} [options]
 * @param {string} [options.variation]  the variation in use; `''` is the default
 * @param {{tuning:string, chord:string, shorthand:string}[]} [options.shapes]
 *   my shapes for this instrument (Worker's `entry.shapes`)
 * @param {boolean} [options.ignoreSongVoicings]  suppress step 1, so a chord the
 *   song voices still takes my shape or the default — the seam music.transpose
 *   uses for "a transposed song has no chosen shapes" (workflow 2 lines 120–125)
 * @param {string} [options.dialect]  the dialect the chart's symbols are read in
 *   — the song's own (cifra.md §5.6; `songDialect`), the one the caller parsed
 *   and transposed it in. My shapes' chord keys are always read in
 *   `DEFAULT_DIALECT`, the dialect `shapes.json` writes them in (home-book
 *   format §4.4), so a star matches by chord whatever the song's dialect.
 * @returns {Map<string, ResolvedVoicing>}  key → resolution, in chart order
 */
export function resolveSongVoicings(
  parsed,
  instrument,
  { variation = '', shapes = [], ignoreSongVoicings = false, dialect = DEFAULT_DIALECT } = {}
) {
  const tuningId = instrumentTuningId(instrument);
  const block = ignoreSongVoicings ? null : selectBlock(parsed, tuningId, variation);

  /** key → the block's voicing item (frets, optional fingers). */
  const chosen = new Map();
  if (block) for (const v of block.voicings) chosen.set(v.key, v);

  // My shapes narrowed to this instrument's tuning (§6.3 identity): one leaf per
  // (instrument, tuning, chord), so at most one my-shape per chord.
  const myShapes = shapes.filter((s) => tuningIdOfText(s?.tuning) === tuningId);

  /** @type {Map<string, ResolvedVoicing>} */
  const out = new Map();
  /** @type {Map<string, import('./search.js').Fingering|null>} memoised per symbol */
  const defaultsBySymbol = new Map();

  for (const item of chartChords(parsed)) {
    if (out.has(item.key)) continue;
    const chord = parseChord(item.symbol, dialect).chord;
    if (!chord) continue;

    // 1. The song's choice.
    const voicing = chosen.get(item.key);
    if (voicing) {
      const fingering = fingeringFromFrets(voicing.frets, chord, instrument);
      // A chosen shape that cannot be made into a hand stays unresolved rather
      // than silently falling to a default — the song chose it, and §7.6 does
      // not fall back from a choice.
      if (fingering) out.set(item.key, { source: 'song', fingering: withSongFingers(fingering, voicing.fingers) });
      continue;
    }

    // 2. My shape — matched by chord, not spelling, so a Cmaj7 star serves a C7M
    //    song (workflow 2 line 106).
    const mine = myShapes.find((s) => {
      const theirs = parseChord(s.chord, DEFAULT_DIALECT)?.chord;
      return theirs && sameChord(theirs, chord);
    });
    if (mine) {
      const frets = parseShorthand(mine.shorthand);
      const fingering = frets && fingeringFromFrets(frets, chord, instrument);
      if (fingering) {
        out.set(item.key, { source: 'yours', fingering });
        continue;
      }
    }

    // 3. The app's default (computed once per symbol).
    if (!defaultsBySymbol.has(item.symbol)) {
      defaultsBySymbol.set(item.symbol, defaultVoicing(chord, instrument));
    }
    const fallback = defaultsBySymbol.get(item.symbol);
    if (fallback) out.set(item.key, { source: 'default', fingering: fallback });
  }

  return out;
}

/**
 * Keys that resolved to nothing at all: valid chords the search cannot voice.
 *
 * Walks the cifra.md model's chart chord items (keyed by §2.4 `key`) and lists,
 * once and in chart order, every parseable chord the resolver left unresolved.
 * `dialect` is the one the resolver was given, so both read the same chords.
 */
export function unvoiceableKeys(parsed, resolved, { dialect = DEFAULT_DIALECT } = {}) {
  const seen = new Set();
  const out = [];
  for (const item of chartChords(parsed)) {
    if (seen.has(item.key) || resolved.has(item.key)) continue;
    if (!parseChord(item.symbol, dialect).chord) continue; // not a chord the app can voice
    seen.add(item.key);
    out.push(item.key);
  }
  return out;
}
