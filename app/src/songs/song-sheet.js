// song-sheet.js — what a song's sheet shows, from its text and how it is read
// (songs.reading; books.print). The reading view and the book's print both draw
// a song's sheet — the chart, then its shapes on the instrument in use, each
// resolved in the §7.6 order (the song's choice, then my shape, then the app's
// default) — so the chain is composed once, here, and each view only lays it out.
//
// Pure: it reads the working-copy text, the song's reading state (the `song`
// slice's `{ transposition, variations }`), the instrument in use (the
// `instruments` slice's entry) and the preferences as data, and composes the
// music core — parse → transpose → resolveSongVoicings — over them. No React,
// no Worker, no storage.

import { parse } from 'cifra-md';
import { instrumentInstance, openMidis } from '../core/instrument.js';
import { resolveSongVoicings, unvoiceableKeys } from '../core/voicings.js';
import { createShapeCache } from '../core/shape-cache.js';
import { transpose } from '../core/transpose.js';
import { songVariations } from '../core/song-variations.js';
import { DEFAULT_DIALECT, songDialect } from '../core/notation/dialects.js';
import { isEmptySong, isNumberedSong } from '../chart/layout.js';
import { resolveBarNumbers, resolveChordNaming } from '../theme/resolve.js';
import { songKeyName } from '../core/song-key.js';
import { transposeStatus, chartChordList, voicedNames } from './reading-view.js';

export function songProperty(parsed, name) {
  return parsed?.properties?.find((p) => p?.key === name)?.value ?? null;
}

/** The §6.3 identity of the instrument in use's tuning, or '' with none. */
export function tuningIdOf(entry) {
  const instrument = instrumentFor(entry);
  return instrument ? openMidis(instrument).join(' ') : '';
}

/**
 * The instrument instance the music core searches on, or null when there is no
 * entry or it does not make one.
 */
export function instrumentFor(entry) {
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

// The session's default-shape cache for an instrument entry (core/shape-cache.js;
// home-book §4.6): seeded from the table the Worker surfaces with the entry, and
// keeping every default searched since, so a chord is searched once a session
// at most — a transposition, a reopened song, a printed book. Keyed by the entry
// object: a new INSTRUMENTS event brings new entries (a refilled table, changed
// rules) and a fresh cache with them. The Worker fills the stored table when a
// song is saved; what is searched here stays in memory.
const shapeCaches = new WeakMap();
function shapeCacheFor(entry, instrument) {
  if (!entry || !instrument || typeof entry !== 'object') return undefined;
  let cache = shapeCaches.get(entry);
  if (!cache) {
    cache = createShapeCache({ instrument, table: entry.defaultShapes ?? null });
    shapeCaches.set(entry, cache);
  }
  return cache;
}

/**
 * Everything a song's sheet draws, derived from its text and reading state.
 *
 * @param {object} args
 * @param {string} args.text  the song's working-copy text ('' while not loaded)
 * @param {{ transposition?: number, variations?: object }} [args.reading]
 * @param {object|null} [args.entry]  the instrument in use (inUseEntry)
 * @param {object|null} [args.preferences]  the `preferences` slice
 * @param {import('../core/shape-cache.js').ShapeCache} [args.cache]  a host's
 *   default-shape cache, in place of the session's one for `entry` — the device
 *   bundle's read-only view (docs/remarkable-reader.md §4.1)
 * @param {object} [args.parsed]  a parse of `text` the host already holds, so
 *   it is not parsed again (§4: the parsed model stays in memory)
 * @param {Map} [args.defaults]  a host's memo of the defaults across reads,
 *   passed through to `resolveSongVoicings`
 */
export function readSongSheet({
  text,
  reading = null,
  entry = null,
  preferences = null,
  cache,
  parsed,
  defaults,
}) {
  const offset = reading?.transposition ?? 0;
  const dialect = preferences?.notation?.value ?? DEFAULT_DIALECT;
  const instrument = instrumentFor(entry);
  const tuningId = instrument ? openMidis(instrument).join(' ') : '';

  // Parse the working copy, then transpose the view (offset 0 leaves it as
  // written). The written key is read from the untransposed song (its `key` is
  // left as written, cifra.md §8.6). The chart is read, transposed and voiced in
  // the song's own notation (cifra.md §5.6); `dialect`, the preference, only
  // spells chords for this user.
  const baseModel = parsed ?? (text ? parse(text) : null);
  const notation = songDialect(baseModel);
  const model = baseModel ? transpose(baseModel, offset, { dialect: notation }) : null;
  const writtenKey = songProperty(baseModel, 'key');
  const artist = songProperty(baseModel, 'artist');

  const variation = reading?.variations?.[tuningId] ?? '';
  const variations = baseModel && tuningId ? songVariations(baseModel, tuningId) : [];

  // Every chord in the §7.6 order. While transposed the song's own voicings are
  // suppressed (the rewritten symbols no longer match them), so every shape
  // falls to yours or the default (workflow 2 L120-125).
  const resolved =
    instrument && model
      ? resolveSongVoicings(model, instrument, {
          variation,
          shapes: entry?.shapes ?? [],
          ignoreSongVoicings: offset !== 0,
          dialect: notation,
          cache: cache ?? shapeCacheFor(entry, instrument),
          defaults,
        })
      : new Map();
  const chordList = model ? chartChordList(model) : [];
  const symbolByKey = new Map(chordList.map((c) => [c.key, c.symbol]));
  const shapes = [...resolved.entries()].map(([key, v]) => ({
    key,
    symbol: symbolByKey.get(key) ?? key,
    source: v.source,
    fingering: v.fingering,
  }));
  const unvoiced = model ? unvoiceableKeys(model, resolved, { dialect: notation }) : [];
  // The chart names its chords as written, or — the reader's choice, kept in the
  // home book (`chordNames`) — as the shapes shown sound them.
  const naming = resolveChordNaming(preferences);
  const renamed = naming === 'voiced' ? voicedNames(shapes, notation) : null;
  // Bar numbers (cifra.md §2.8): the reader's choice, kept in the home book
  // (`barNumbers`), only for a song whose bars are counted.
  const numbered = isNumberedSong(model);
  const barNumbers = numbered && resolveBarNumbers(preferences) === 'shown';

  // A song that names no key is named by the key its last chord gives
  // (core/song-key.js), as written and as now read (`Dm` → `Ebm`).
  const startKey = writtenKey ? null : songKeyName(baseModel, notation);
  const startKeyNow = writtenKey ? null : songKeyName(model, notation);
  const status = transposeStatus(writtenKey, offset, { from: startKey, to: startKeyNow });
  const transposed = offset !== 0;

  // The notes written in the voicing block in use (cifra.md §7.4), only at the
  // written key, where the block's own shapes are the ones drawn.
  const inUseVariation = variations.includes(variation) ? variation : (variations[0] ?? '');
  const blockNotes = transposed
    ? []
    : (baseModel?.blocks ?? [])
        .filter((b) => b.tuning?.id === tuningId && (b.label ?? '') === inUseVariation)
        .flatMap((b) => b.notes ?? [])
        .filter((line) => line.trim() !== '');

  return {
    offset,
    transposed,
    dialect,
    notation,
    instrument,
    tuningId,
    baseModel,
    model,
    empty: Boolean(model) && isEmptySong(model),
    writtenKey,
    artist,
    variation,
    variations,
    chordList,
    symbolByKey,
    shapes,
    unvoiced,
    naming,
    renamed,
    numbered,
    barNumbers,
    startKey,
    status,
    blockNotes,
  };
}

/**
 * The shapes caption (mockups README L26; W02 L138, L206): while transposed, why
 * the shapes are not the song's; otherwise, how to read the kinds when any chord
 * is on a non-song shape. Null when there is nothing to say.
 *
 * @param {ReturnType<typeof readSongSheet>} sheet
 * @param {(key: string, vars?: object) => string} t
 */
/** Whether the caption is the one explaining the marks — not printed. */
export function captionExplainsMarks(sheet) {
  return !(sheet.transposed && sheet.shapes.length) && sheet.shapes.some((s) => s.source !== 'song');
}

export function shapesCaption(sheet, t) {
  if (sheet.transposed && sheet.shapes.length) {
    return sheet.writtenKey
      ? t('reading.transposedCaptionKey', { key: sheet.writtenKey })
      : t('reading.transposedCaption');
  }
  if (sheet.shapes.some((s) => s.source !== 'song')) return t('reading.shapesCaption');
  return null;
}

/**
 * The transposed state in words — *In D (+2)* or *Transposed +2* — or null at
 * the written key.
 *
 * @param {ReturnType<typeof readSongSheet>} sheet
 * @param {(key: string, vars?: object) => string} t
 */
export function transposedLabel(sheet, t) {
  const { status } = sheet;
  if (!status) return null;
  const offset = status.offset > 0 ? `+${status.offset}` : `${status.offset}`;
  return status.keyName
    ? t('reading.transposedToKey', { key: status.keyName, offset })
    : t('reading.transposedBy', { offset });
}
