/**
 * The default-shape cache's port (home-book format §4.6): what makes two
 * lookups the same entry, and the small in-memory cache every host builds its
 * store on.
 *
 * The app's default shape for a chord (`defaultVoicing`, voicings.js) is a pure
 * function of the chord and the instrument, and the search behind it is the one
 * expensive step in reading a song: cheap with a JIT, over a second a chord on
 * an e-ink tablet. So the core lets a host hand it a cache — `lookup` for a hit,
 * `offer` for a result worth keeping — and decides everything that makes an
 * entry valid itself: the salt, the instrument's fingerprint and the chord's
 * key. A host only decides where entries live and when they are written, so a
 * wiring mistake can cost a miss but never a wrong shape.
 *
 * Pure, synchronous and framework-free, like everything in core/.
 */

import { openMidis } from './instrument.js';

/**
 * The cache salt (§4.6). Changed BY HAND, and only when a change to the search
 * (search.js, fingers.js, heuristics.js, score.js, or how voicings.js picks the
 * default) can change a shape it suggests. A release that leaves the search
 * alone keeps the salt, and every table written under it stays good. Never
 * reuse a salt; when this one is replaced, consider adding it to
 * DECOMMISSIONED_SALTS once no supported client carries it.
 */
export const SHAPE_CACHE_SALT = 'defaults-1';

/**
 * Salts deliberately retired because no supported client carries them any more
 * (§4.6) — an e-ink reader on an old release included. Only ever appended to.
 * A writer tombstones every table under one of these; no reader uses them.
 */
export const DECOMMISSIONED_SALTS = Object.freeze([]);

/**
 * Is `salt` retired?
 * @param {string} salt
 */
export function isDecommissionedSalt(salt) {
  return DECOMMISSIONED_SALTS.includes(salt);
}

// A canonical JSON text: object members sorted at every depth, so equal values
// give equal text whatever order their keys were built in.
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

// 32-bit FNV-1a over the UTF-16 code units, as 8 lowercase hex digits.
function fnv1a(text, seed) {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * The §6.3 tuning identity of an instrument: its open strings' MIDI numbers.
 * @param {object} instrument
 */
export function tuningIdOf(instrument) {
  return openMidis(instrument).join(' ');
}

/**
 * What the search reads besides the chord (§4.6 `fingerprint`): the open
 * strings, the fret count and the instrument's heuristics — the config
 * `searchFingerings` falls back to when given none, which is how
 * `defaultVoicing` calls it. Two FNV-1a passes with different seeds over the
 * canonical JSON, 16 hex digits: equal inputs always give equal fingerprints,
 * and an accidental collision between one person's few instruments is
 * vanishingly unlikely.
 *
 * @param {object} instrument
 * @returns {string}
 */
export function fingerprintOf(instrument) {
  const text = canonicalJson({
    strings: openMidis(instrument),
    fretCount: instrument.fretCount,
    heuristics: instrument.heuristics ?? null,
  });
  return fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x01000193);
}

const noteKey = (n) => `${n.letter}${n.accidental > 0 ? '#'.repeat(n.accidental) : 'b'.repeat(-n.accidental)}`;

/**
 * A chord's cache key: the chord as `sameChord` (chord.js) identifies it — the
 * root and bass as spelled, the quality, the extensions in any order — so two
 * symbols `sameChord` calls one chord (`Cmaj7`, `C7M`) share an entry, and two
 * it does not (`C#`, `Db`) never do.
 *
 * @param {import('./chord.js').Chord} chord
 * @returns {string}
 */
export function chordKeyOf(chord) {
  const extensions = chord.extensions
    .map((e) => `${e.degree}:${e.alter}`)
    .sort()
    .join(',');
  const bass = chord.bass ? `/${noteKey(chord.bass)}` : '';
  return `${noteKey(chord.root)} ${chord.quality}${extensions ? ` (${extensions})` : ''}${bass}`;
}

/**
 * @typedef {object} ShapeCacheKey
 * @property {string} tuning       the instrument's tuning identity
 * @property {string} fingerprint  what the search reads besides the chord
 * @property {string} chord        the chord's key
 */

/**
 * The key of one cache entry.
 * @returns {ShapeCacheKey}
 */
export function shapeCacheKey(chord, instrument) {
  return { tuning: tuningIdOf(instrument), fingerprint: fingerprintOf(instrument), chord: chordKeyOf(chord) };
}

/**
 * The port a host hands the core. Synchronous, so the core stays so.
 *
 * @typedef {object} ShapeCache
 * @property {(key: ShapeCacheKey) => string | null | undefined} lookup
 *   the default's fret shorthand; `null` for a chord the search voices no shape
 *   for; `undefined` for a miss
 * @property {(key: ShapeCacheKey, shorthand: string | null) => void} offer
 *   a result the core computed on a miss, for the host to keep if it likes
 */

/**
 * Whether `table` is a well-formed §4.6 table value: `{ fingerprint, shapes }`
 * with every shape a shorthand string or `null`. A reader treats anything else
 * as absent.
 */
export function isShapeTable(table) {
  if (!table || typeof table !== 'object' || Array.isArray(table)) return false;
  if (typeof table.fingerprint !== 'string') return false;
  const { shapes } = table;
  if (!shapes || typeof shapes !== 'object' || Array.isArray(shapes)) return false;
  return Object.values(shapes).every((v) => v === null || typeof v === 'string');
}

/**
 * An in-memory cache for one instrument, seeded from a stored table. A table
 * searched under another fingerprint — other rules, another tuning — is read as
 * absent (§4.6). Every offer for this instrument is kept, so the cache is also
 * the session's memo; `onOffer` tells the host about each new entry.
 *
 * @param {{ instrument: object, table?: object|null, onOffer?: (key: ShapeCacheKey, shorthand: string|null) => void }} opts
 * @returns {ShapeCache & { fingerprint: string, changed: boolean, size: number, toTable: () => { fingerprint: string, shapes: Record<string, string|null> } }}
 */
export function createShapeCache({ instrument, table = null, onOffer } = {}) {
  const fingerprint = fingerprintOf(instrument);
  const entries = new Map(
    isShapeTable(table) && table.fingerprint === fingerprint ? Object.entries(table.shapes) : [],
  );
  let changed = false;
  return {
    fingerprint,
    get changed() {
      return changed;
    },
    get size() {
      return entries.size;
    },
    lookup(key) {
      if (key.fingerprint !== fingerprint) return undefined;
      return entries.has(key.chord) ? entries.get(key.chord) : undefined;
    },
    offer(key, shorthand) {
      if (key.fingerprint !== fingerprint) return;
      if (entries.has(key.chord) && entries.get(key.chord) === shorthand) return;
      entries.set(key.chord, shorthand);
      changed = true;
      onOffer?.(key, shorthand);
    },
    // The table as §4.6 stores it, its shapes in key order.
    toTable() {
      const shapes = {};
      for (const chord of [...entries.keys()].sort()) shapes[chord] = entries.get(chord);
      return { fingerprint, shapes };
    },
  };
}
