// default-shape-fill.js — filling the default-shape cache (home-book §4.6) for
// songs just saved: every chord of each song, in all twelve keys it can be read
// in, searched once on this device and kept in the home book, so a slower
// device — an e-ink reader — and every later read here find the shapes already
// searched.
//
// The fill is the reading path itself, run with a cache that keeps what it is
// offered (core/shape-cache.js): `resolveSongVoicings` over the song at each
// transposition, my shapes first, the song's own shapes set aside so every
// chord's default is reached. No second code path decides what a default is.
//
// Pure apart from the injected `yieldNow`, which lets the Worker's other
// commands run between keys: the search is the one expensive step, and a save
// of several songs must not hold the Worker for its whole length. No I/O, no
// logging (no song text, no shape, no instrument in any message).

import { parse } from 'cifra-md';
import { transpose } from '../core/transpose.js';
import { resolveSongVoicings } from '../core/voicings.js';
import { songDialect } from '../core/notation/dialects.js';
import { instrumentInstance } from '../core/instrument.js';
import { SHAPE_CACHE_SALT, createShapeCache, isDecommissionedSalt } from '../core/shape-cache.js';
import { isRegister } from './home-book-merge.js';
import { serialize } from './home-book-canonical.js';
import { defaultShapesFor } from './instruments.js';

/** The home-book file the cache lives in (§2.1, §4.6). */
export const CACHE_FILE = 'shapes-default-cache.json';

/** Every key a song can be read in: the written one and eleven transpositions. */
export const TRANSPOSITIONS = 12;

/** The per-file size limit a home-book file must stay within (§8). */
export const FILE_LIMIT_BYTES = 256 * 1024;

/**
 * The music-core instrument for a surfaced roster entry, as the reading view
 * builds it (songs/song-sheet.js), or null when it will not build.
 */
export function instrumentForEntry(entry) {
  if (!entry) return null;
  try {
    return instrumentInstance({
      catalogId: entry.catalogId,
      label: entry.label ?? undefined,
      strings: entry.tuning,
      fretCount: entry.fretCount,
      heuristics: entry.config,
    });
  } catch {
    return null;
  }
}

// Every table register in the cache model, with its path.
function* tables(cacheModel) {
  for (const id of Object.keys(cacheModel ?? {})) {
    const byTuning = cacheModel[id];
    if (!byTuning || typeof byTuning !== 'object' || Array.isArray(byTuning)) continue;
    for (const tuning of Object.keys(byTuning)) {
      const bySalt = byTuning[tuning];
      if (!bySalt || typeof bySalt !== 'object' || Array.isArray(bySalt)) continue;
      for (const salt of Object.keys(bySalt)) {
        const reg = bySalt[salt];
        if (isRegister(reg)) yield { id, tuning, salt, live: reg.value !== null };
      }
    }
  }
}

// The model with `changes` applied, as §4.6 sizes it: what the file would be.
function sizeAfter(cacheModel, changes) {
  const model = structuredClone(cacheModel ?? {});
  for (const { path, value } of changes) {
    let node = model;
    for (const key of path.slice(0, -1)) {
      if (!node[key] || typeof node[key] !== 'object') node[key] = {};
      node = node[key];
    }
    node[path[path.length - 1]] = { value, at: '0000-00-00T00:00:00.000Z' };
  }
  return new TextEncoder().encode(serialize(model)).length;
}

/**
 * The register changes that retire tables (§4.6): every live table under a
 * decommissioned salt, always; and, only when the file would pass the size
 * limit, whole tables to make room — other salts' first, then other
 * instruments' — never the table just written.
 *
 * @param {object} cacheModel the file as read
 * @param {{ path: string[], value: * }[]} changes the table writes so far
 * @param {{ id: string, tuning: string }} keep the table being written
 * @param {(salt: string) => boolean} [isRetired] which salts are decommissioned
 *   (the core's list; a seam for tests while that list is empty)
 */
export function retirements(cacheModel, changes, keep, isRetired = isDecommissionedSalt) {
  const out = [];
  const live = [...tables(cacheModel)].filter((t) => t.live);
  for (const t of live) {
    if (isRetired(t.salt)) out.push({ path: [t.id, t.tuning, t.salt], value: null });
  }
  const isKept = (t) => t.id === keep.id && t.tuning === keep.tuning && t.salt === SHAPE_CACHE_SALT;
  const candidates = [
    ...live.filter((t) => !isKept(t) && !isRetired(t.salt) && t.salt !== SHAPE_CACHE_SALT),
    ...live.filter((t) => !isKept(t) && t.salt === SHAPE_CACHE_SALT),
  ];
  for (const t of candidates) {
    if (sizeAfter(cacheModel, [...changes, ...out]) <= FILE_LIMIT_BYTES) break;
    out.push({ path: [t.id, t.tuning, t.salt], value: null });
  }
  return out;
}

/**
 * Search the defaults every given song needs on the instrument in use, in all
 * twelve keys, and return the register changes that keep them (§4.6): the
 * instrument's table under this app's salt, rewritten whole when a search found
 * anything new, and any retirements. Empty when nothing changed, so a save that
 * found nothing new costs no commit.
 *
 * @param {{
 *   texts: string[],
 *   entry: object|null,
 *   cacheModel: object,
 *   yieldNow?: () => Promise<void>,
 * }} opts
 * @returns {Promise<{ path: string[], value: * }[]>}
 */
export async function fillDefaultShapes({ texts, entry, cacheModel, yieldNow = () => Promise.resolve() }) {
  const instrument = instrumentForEntry(entry);
  if (!instrument || !texts.length) return [];
  const cache = createShapeCache({
    instrument,
    table: defaultShapesFor(cacheModel, entry.id, entry.tuning),
  });
  for (const text of texts) {
    let model;
    try {
      model = parse(text);
    } catch {
      continue; // not a song this reader can read; nothing to search
    }
    const dialect = songDialect(model);
    for (let offset = 0; offset < TRANSPOSITIONS; offset += 1) {
      const moved = offset ? transpose(model, offset, { dialect }) : model;
      // The song's own shapes set aside at every key, the written one too, so a
      // chord it voices has its default ready for a variation that does not.
      resolveSongVoicings(moved, instrument, {
        shapes: entry.shapes ?? [],
        ignoreSongVoicings: true,
        dialect,
        cache,
      });
      await yieldNow();
    }
  }
  const writes = cache.changed
    ? [{ path: [entry.id, entry.tuning, SHAPE_CACHE_SALT], value: cache.toTable() }]
    : [];
  const retire = retirements(cacheModel, writes, { id: entry.id, tuning: entry.tuning });
  return [...writes, ...retire];
}
