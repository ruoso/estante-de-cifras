/**
 * Transposing for reading (music.transpose; workflow 2 §Transposing).
 *
 * A reader reads a song in another key: every chord moves up or down by a whole
 * number of semitones and is drawn re-rooted, while the song itself — its text,
 * its chart and every voicing block — stays exactly as written. "It changes the
 * view, never the song" (workflow 2 L112). This is NOT cifra.md §8.6 (transposing
 * a *document*, which the spec leaves undefined because it would invalidate every
 * voicing block); it is "a reader showing what it read in another key" (L116-117),
 * so the stored document is never touched and `key` stays informative (spec
 * §1.4.3). What is saved, indexed, pushed and searched is always the written song.
 *
 * Pure, synchronous and framework-free, like everything in core/ (DIRECTION §3.7):
 * it imports only the music core and reads the cifra.md parse model as data. It
 * touches no React, no IndexedDB and no Worker message. `transpose` returns a NEW
 * model and never mutates its input.
 *
 * One spelling for the whole chart (workflow 2 L131-133): the sharp/flat choice is
 * a single global decision per offset, so a chart never mixes `D♯` and `E♭`. With
 * a `key` property the key decides (minimise the transposed tonic's accidentals);
 * without one, minimise the total accidentals across every chord root and bass. A
 * tie goes to flats (the workflow's "D♭" convention). `transposeNote` already
 * spells each note correctly once the interval's `letterSteps` is fixed, so the
 * whole decision reduces to the choice of `letterSteps` for the offset.
 */

import { parseChord } from './notation/parse.js';
import { formatChord } from './notation/format.js';
import { parseNote, transposeNote, interval } from './pitch.js';
import { DEFAULT_DIALECT } from './notation/dialects.js';

// The pitch class reached by moving N letter-names up from a natural note
// (letterSteps 0..6): a major second is +2, a major third +4, and so on. This is
// what lets one semitone offset be spelled two ways — a sharp spelling reaches the
// pitch with fewer letter steps and raises, a flat spelling with more and lowers.
const DIATONIC = [0, 2, 4, 5, 7, 9, 11];

/**
 * The two candidate letter-step counts for a pitch-class offset: the sharp
 * spelling (the most letter steps whose natural pitch is at or below the offset,
 * so the accidental raises) and the flat spelling (the fewest whose natural pitch
 * is at or above it, so the accidental lowers). For a "white-key" offset — a major
 * second, third, fourth, fifth, sixth or seventh — the two coincide: there is only
 * one natural spelling and no choice to make.
 *
 * @param {number} pc 0..11
 * @returns {{ sharp: number, flat: number }}
 */
function candidateLetterSteps(pc) {
  let sharp = 0;
  let flat = 6;
  for (let ls = 0; ls <= 6; ls += 1) if (DIATONIC[ls] <= pc) sharp = ls;
  for (let ls = 6; ls >= 0; ls -= 1) if (DIATONIC[ls] >= pc) flat = ls;
  return { sharp, flat };
}

/** The accidental count of a note under a candidate interval (a double-flat is 2). */
function accidentalsUnder(note, iv) {
  return Math.abs(transposeNote(note, iv).accidental);
}

/** The tonic note of a `key` property (`G`, `Em`, `Bb`), or null when unreadable. */
function keyTonic(key) {
  if (typeof key !== 'string') return null;
  const m = /^([A-Ga-g](?:bb|##|[b#])?)/.exec(key.trim());
  if (!m) return null;
  try {
    return parseNote(m[1]);
  } catch {
    return null;
  }
}

/**
 * The song's `key` property value, or null. `properties` is the cifra.md parse
 * model's ordered array of `{ key, value }` entries (spec §1.4.2); the key is the
 * entry whose `.key` is the literal property name `"key"` (spec §1.4.3). An empty
 * value reads as absent.
 */
function keyProperty(model) {
  const entry = (model?.properties ?? []).find((p) => p?.key === 'key');
  const value = entry?.value;
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** The non-tonic part of a `key` property (`m` for minor; `''` for major). */
function keySuffix(key) {
  if (typeof key !== 'string') return '';
  const m = /^[A-Ga-g](?:bb|##|[b#])?(.*)$/.exec(key.trim());
  return m ? m[1] : '';
}

/** Every chord item in the chart, in document order (cf. voicings.js chartChords). */
function* chordItems(model) {
  for (const section of model?.sections ?? []) {
    for (const part of section?.body ?? []) {
      if (part?.type !== 'music') continue;
      for (const line of part.lines ?? []) {
        if (line?.kind !== 'chart' && line?.kind !== 'sung') continue;
        for (const measure of line.measures ?? []) {
          for (const item of measure?.items ?? []) {
            if (item?.type === 'chord') yield item;
          }
        }
      }
    }
  }
}

/**
 * The interval to transpose by, with the globally-chosen spelling for the offset.
 * With a key, the tonic decides (fewest accidentals, tie → flats); without one,
 * the total across every chord root and bass decides (tie → flats). When the
 * offset has a single natural spelling, that is returned with no counting.
 *
 * @param {object} model the parse model (read for the key property and chords)
 * @param {number} pc the pitch-class offset, 1..11
 * @param {string} dialect the dialect to parse chord symbols in
 * @returns {import('./pitch.js').Interval}
 */
function chooseInterval(model, pc, dialect) {
  const { sharp, flat } = candidateLetterSteps(pc);
  const sharpIv = interval(sharp, pc);
  if (sharp === flat) return sharpIv; // one natural spelling — no choice
  const flatIv = interval(flat, pc);

  const tonic = keyTonic(keyProperty(model));
  if (tonic) {
    return accidentalsUnder(tonic, flatIv) <= accidentalsUnder(tonic, sharpIv)
      ? flatIv
      : sharpIv;
  }

  let sharpTotal = 0;
  let flatTotal = 0;
  for (const item of chordItems(model)) {
    const c = parseChord(item.symbol, dialect).chord;
    if (!c) continue;
    for (const n of [c.root, c.bass].filter(Boolean)) {
      sharpTotal += accidentalsUnder(n, sharpIv);
      flatTotal += accidentalsUnder(n, flatIv);
    }
  }
  return flatTotal <= sharpTotal ? flatIv : sharpIv; // tie → flats
}

/**
 * Transpose a parse model by a signed semitone offset, for reading.
 *
 * Returns a NEW model in which every `type:'chord'` item's `symbol` is the chord
 * re-rooted by `semitones` and re-formatted in `dialect`: its root and bass move
 * by the chosen interval, its quality and extensions are kept (they are relative
 * to the root). The input model is left deeply unchanged. `semitones === 0` (and
 * any whole-octave offset) returns the written chords untouched.
 *
 * A symbol the parser rejects is left verbatim — "a reader never discards what it
 * did not understand" (workflow 2 L78). Non-chord items (N.C., beats, repeats,
 * unknown tokens) are not transposed. The occurrence `key` (spec §2.4) is kept as
 * an opaque per-occurrence identity, so the transposition carries through the
 * whole reading pipeline (chart, voicings, diagrams) by the rewritten symbol alone
 * (see the refinement's Decisions).
 *
 * @param {object} model a cifra.md parse model
 * @param {number} semitones a signed integer
 * @param {{ dialect?: string }} [options]
 * @returns {object} a new parse model
 */
export function transpose(model, semitones, { dialect = DEFAULT_DIALECT } = {}) {
  const out = structuredClone(model);
  const pc = (((Math.trunc(semitones) % 12) + 12) % 12);
  if (pc === 0) return out; // the written key — symbols unchanged

  const iv = chooseInterval(out, pc, dialect);
  for (const item of chordItems(out)) {
    const c = parseChord(item.symbol, dialect).chord;
    if (!c) continue; // kept verbatim
    const transposed = {
      ...c,
      root: transposeNote(c.root, iv),
      bass: c.bass ? transposeNote(c.bass, iv) : null,
    };
    item.symbol = formatChord(transposed, dialect);
  }
  return out;
}

/**
 * The name of the key a song transposes to, in the globally-chosen spelling — the
 * reading control's "Transposed to A (+2)" chip and "Back to G" button (workflow 2
 * L136-138). `G` +2 → `A`; `C` +1 → `Db` (flats). Returns `null` when the song has
 * no `key` property. Minor keys keep their `m`: `Em` +2 → `F#m`.
 *
 * @param {string|null|undefined} key the song's `key` property
 * @param {number} semitones a signed integer
 * @param {string} [dialect] unused for the note name, kept for call-site symmetry
 * @returns {string|null}
 */
export function transposedKeyName(key, semitones, dialect = DEFAULT_DIALECT) {
  void dialect;
  const tonic = keyTonic(key);
  if (!tonic) return null;
  const pc = (((Math.trunc(semitones) % 12) + 12) % 12);
  const { sharp, flat } = candidateLetterSteps(pc);
  const sharpIv = interval(sharp, pc);
  const iv =
    sharp === flat
      ? sharpIv
      : accidentalsUnder(tonic, interval(flat, pc)) <= accidentalsUnder(tonic, sharpIv)
        ? interval(flat, pc)
        : sharpIv;
  return formatNoteName(transposeNote(tonic, iv)) + keySuffix(key);
}

// A spelled note's display name, reusing pitch.js's letter + accidental naming via
// formatChord's root path would pull in the whole chord; the key name is just the
// note, so spell it directly in the same `b`/`#` convention parseNote accepts.
const ACCIDENTAL_NAMES = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' };
function formatNoteName(n) {
  return n.letter + ACCIDENTAL_NAMES[String(n.accidental)];
}
