// reading-view.js — the small pure helpers the reading surface composes with
// (songs.reading). They read the cifra.md parse model and the pure transpose
// engine as data; they know nothing of React, the Worker or storage, so the
// view stays a thin shell over them (DIRECTION §3.7) and the awkward bits are
// unit-tested without a render.

import { transposedKeyName } from '../core/transpose.js';

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
