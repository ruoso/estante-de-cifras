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
// (letterSteps 0..7): a major second is +2, a major third +4, an octave 12, and so
// on. This is what lets one semitone offset be spelled two ways — a sharp spelling
// reaches the pitch with fewer letter steps and raises, a flat spelling with more
// and lowers.
const DIATONIC = [0, 2, 4, 5, 7, 9, 11, 12];

/**
 * The candidate intervals for a pitch-class offset, in tie-break order.
 *
 * - A "black-key" offset (a minor second, third, sixth or seventh, a tritone) has
 *   a flat spelling (the fewest letter steps whose natural pitch is above it, so
 *   the accidental lowers) and a sharp one (the most at or below, so it raises):
 *   flats first, so a tie goes to flats (the "D♭" convention).
 * - A "white-key" offset has its one natural spelling, and where that natural
 *   interval sits a half step from a neighbour letter (a major third and a
 *   diminished fourth, a perfect fourth and an augmented third, a major seventh
 *   and a diminished octave) the neighbour's spelling too: `C♯` down a semitone
 *   is `C`, not `B♯`. The natural spelling comes first, so a tie keeps it.
 *
 * @param {number} pc 0..11
 * @returns {import('./pitch.js').Interval[]}
 */
function candidateIntervals(pc) {
  let sharp = 0;
  let flat = 7;
  for (let ls = 0; ls <= 7; ls += 1) if (DIATONIC[ls] <= pc) sharp = ls;
  for (let ls = 7; ls >= 0; ls -= 1) if (DIATONIC[ls] >= pc) flat = ls;
  if (sharp !== flat) return [interval(flat, pc), interval(sharp, pc)];
  const natural = interval(sharp, pc);
  if (pc === 0) return [natural];
  if (DIATONIC[sharp + 1] - pc === 1) return [natural, interval(sharp + 1, pc)];
  if (pc - DIATONIC[sharp - 1] === 1) return [natural, interval(sharp - 1, pc)];
  return [natural];
}

/** The candidate with the lowest cost; the earlier candidate wins a tie. */
function cheapest(candidates, cost) {
  let best = candidates[0];
  let bestCost = candidates.length > 1 ? cost(best) : 0;
  for (const iv of candidates.slice(1)) {
    const c = cost(iv);
    if (c < bestCost) [best, bestCost] = [iv, c];
  }
  return best;
}

/** The accidental count of a note under a candidate interval (a double-flat is 2). */
function accidentalsUnder(note, iv) {
  return Math.abs(transposeNote(note, iv).accidental);
}

/**
 * A `key` property read as spec §1.4.3 defines it — a §5.1.1 root (an uppercase
 * letter with an optional `#`/`♯`, `b`/`♭`, `##` or `bb`), then `m` for minor or
 * nothing — or null when the value is not a key (`g`, `G major`, `Sol`), which a
 * reader treats as absent (cf. spec 10-setlists L343-345). `glyphs` records
 * whether the written key spells its accidental with `♭`/`♯`, so a name derived
 * from it can be spelled the same way.
 *
 * @param {unknown} key
 * @returns {{ tonic: import('./pitch.js').SpelledNote, minor: boolean, glyphs: boolean }|null}
 */
function readKey(key) {
  if (typeof key !== 'string') return null;
  const m = /^([A-G])(##|bb|#|♯|b|♭)?(m?)$/.exec(key.trim());
  if (!m) return null;
  const accidental = { '♯': '#', '♭': 'b' }[m[2]] ?? m[2] ?? '';
  return {
    tonic: parseNote(m[1] + accidental),
    minor: m[3] === 'm',
    glyphs: m[2] === '♯' || m[2] === '♭',
  };
}

/** The tonic note of a `key` property (`G`, `Em`, `B♭`), or null when it is not a key. */
function keyTonic(key) {
  return readKey(key)?.tonic ?? null;
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
 * With a key, the tonic decides (fewest accidentals); without one, the total
 * across every chord root and bass decides. A tie goes as candidateIntervals
 * orders it. When the offset has a single spelling, that is returned with no
 * counting.
 *
 * @param {object} model the parse model (read for the key property and chords)
 * @param {number} pc the pitch-class offset, 1..11
 * @param {string} dialect the dialect to parse chord symbols in
 * @returns {import('./pitch.js').Interval}
 */
function chooseInterval(model, pc, dialect) {
  const candidates = candidateIntervals(pc);
  if (candidates.length === 1) return candidates[0]; // one spelling — no choice

  const tonic = keyTonic(keyProperty(model));
  if (tonic) return cheapest(candidates, (iv) => accidentalsUnder(tonic, iv));

  const notes = [];
  for (const item of chordItems(model)) {
    const c = parseChord(item.symbol, dialect).chord;
    if (c) notes.push(...[c.root, c.bass].filter(Boolean));
  }
  return cheapest(candidates, (iv) => notes.reduce((sum, n) => sum + accidentalsUnder(n, iv), 0));
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
 * The name of the key a song transposes to, in the spelling the chart gets — the
 * reading row's "Transposed to A (+2)" chip (workflow 2 L133-140; W02#4). `G` +2 →
 * `A`; `C` +1 → `Db` (flats). The tonic is read by the same keyTonic the chart's
 * spelling is, so the two never disagree. The name is spelled in the written
 * key's glyphs — `♭`/`♯` when the written key uses one, `b`/`#` otherwise (`G`
 * +1 → `Ab`, `A♭` +1 → `A`) — and minor keeps its `m`: `Em` +2 → `F#m`. Returns `null` when the value is absent or not a key as spec §1.4.3
 * defines it (`g`, `G major`, `Sol`).
 *
 * @param {string|null|undefined} key the song's `key` property
 * @param {number} semitones a signed integer
 * @returns {string|null}
 */
export function transposedKeyName(key, semitones) {
  const read = readKey(key);
  if (!read) return null;
  const pc = (((Math.trunc(semitones) % 12) + 12) % 12);
  const iv = cheapest(candidateIntervals(pc), (c) => accidentalsUnder(read.tonic, c));
  const names = read.glyphs ? GLYPH_NAMES : ASCII_NAMES;
  const n = transposeNote(read.tonic, iv);
  return n.letter + names[String(n.accidental)] + (read.minor ? 'm' : '');
}

// The key name is just a note, so it is spelled directly rather than through
// formatChord: in the ASCII accidentals parseNote accepts, or in the ♭/♯ glyphs
// when the written key uses them (spec §5.1.1 allows both).
const ASCII_NAMES = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' };
const GLYPH_NAMES = { '-2': '♭♭', '-1': '♭', 0: '', 1: '♯', 2: '♯♯' };
