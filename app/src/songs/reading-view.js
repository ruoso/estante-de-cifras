// reading-view.js — the small pure helpers the reading surface composes with
// (songs.reading). They read the cifra.md parse model and the pure transpose
// engine as data; they know nothing of React, the Worker or storage, so the
// view stays a thin shell over them (DIRECTION §3.7) and the awkward bits are
// unit-tested without a render.

import { transposedKeyName } from '../core/transpose.js';
import { parseChord } from '../core/notation/parse.js';
import { voicedAsLabel, voicedAsSymbol } from '../render/index.js';

/**
 * The transposed row the reading view shows while a song is read away from its
 * written key (workflow 2 L137-140; mockups W02#4 L181-186): `null` at the
 * written key (`offset === 0` — no row, no "Arranging is off" note), else
 * `{ offset, keyName, writtenKey }`. Both keys are named, or neither: when the
 * `key` property is a key (spec §1.4.3), `keyName` is the destination key in the
 * chart's spelling and `writtenKey` the property as written, trimmed; when it is
 * absent or not a key (`G major`, `Sol`), both are `null` and the row falls back
 * to the signed offset and "the written key" (cf. spec 10-setlists L343-345).
 *
 * @param {string|null|undefined} key  the song's `key` property, as written
 * @param {number} offset  the signed semitone offset the song is read at
 * @returns {{ offset: number, keyName: string|null, writtenKey: string|null }|null}
 */
export function transposeStatus(key, offset) {
  if (!offset) return null;
  const keyName = transposedKeyName(key, offset);
  return { offset, keyName, writtenKey: keyName ? key.trim() : null };
}

/** Every chord item in the chart, in document order (chart.js layout order). */
function* chartChordItems(parsed) {
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
 * The distinct chord occurrences of a song, keyed by the §2.4 voicing key, in
 * chart order, first spelling kept — the order the shapes section draws its
 * diagrams in and the pairing a `resolveSongVoicings` / `unvoiceableKeys` key
 * needs to recover its symbol (which those two, keyed by `key` alone, drop).
 * Mirrors `voicings.js`'s private `chartChords` walk so the view reads one
 * order, never re-sorting what the core resolved.
 *
 * @param {object} parsed  a cifra.md parse model
 * @returns {{ key: string, symbol: string }[]}
 */
export function chartChordList(parsed) {
  const seen = new Set();
  const out = [];
  for (const item of chartChordItems(parsed)) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push({ key: item.key, symbol: item.symbol });
  }
  return out;
}

/**
 * What each chord sounds as on its shape, where that is not what the chart
 * wrote (Explore Chords §6.2; the `chordNames` preference): by §2.4 voicing
 * key, the sounded symbol — `D7/A` for a `D7` whose shape puts the fifth lowest —
 * and its parsed chord, for the spoken name. A chord the shape sounds as written
 * is left out, so the chart names it as written.
 *
 * @param {{ key: string, symbol: string, fingering: object }[]} shapes
 * @param {string} notation  the song's own dialect
 * @returns {Map<string, { symbol: string, chord: object|null }>}
 */
export function voicedNames(shapes, notation) {
  const names = new Map();
  for (const shape of shapes) {
    const chord = parseChord(shape.symbol, notation).chord;
    if (!chord) continue;
    const symbol = voicedAsSymbol(shape.fingering, { chord, dialect: notation, name: shape.symbol });
    if (symbol) names.set(shape.key, { symbol, chord: parseChord(symbol, notation).chord ?? null });
  }
  return names;
}

/**
 * The words over a shape's diagram: the chord's name as the chart draws it and,
 * when the chart keeps the written names, what the shape sounds beside it
 * (`D7` · `D7/A`, or `Am` · `no root`), so the two can be compared. Once the
 * chart is named as voiced the sounded name is the name, and there is no second
 * one to show.
 *
 * @param {{ key: string, symbol: string, fingering: object }} shape
 * @param {{ notation: string, renamed?: Map<string, { symbol: string }>|null }} options
 * @returns {{ name: string, sounded: string|null }}
 */
export function shapeNames(shape, { notation, renamed = null }) {
  if (renamed) return { name: renamed.get(shape.key)?.symbol ?? shape.symbol, sounded: null };
  const chord = parseChord(shape.symbol, notation).chord;
  const sounded = chord
    ? voicedAsLabel(shape.fingering, { chord, dialect: notation, full: true, name: shape.symbol })
    : null;
  return { name: shape.symbol, sounded };
}
