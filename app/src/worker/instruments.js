// instruments.js — the pure projection from the home book's instruments.json,
// preferences.json and shapes.json to the INSTRUMENTS event payload, and the
// removal change-set builder (music.instruments, workflow 15). The sibling of
// preferences.js / shelf.js: no I/O, no logging, no song text in any message
// (standing rules); plain ESM, Worker-only; it imports the framework-free music
// core (DIRECTION §5) to resolve an instrument's effective voicing config and
// the §3 register envelope guard.
//
// The value shapes this task fixes (home-book §1.2, §4.3, §4.4):
//   instruments.json → <id>.definition.value = { catalogId, label, tuning,
//     fretCount } (tuning is the cifra.md §6 text — the identity); <id>.rules
//     .value = { preset } | { preset: 'custom', config: <HeuristicConfig> }.
//   shapes.json      → <id>.<tuning>.<chord>.value = a fret-string shorthand.
//   preferences.json → instrumentInUse.value = an instrument id (absent means
//     the standard guitar — fromCatalog('6guitar','Standard'), nothing stored).
//
// Rebuild-on-load vs. keep-exactly (workflow 15 L124-161): an instrument whose
// rules name a preset is rebuilt from it (`configFor`), so a later preset
// correction reaches an old set-up; a Custom instrument keeps its frozen config
// exactly, with only `rootInBass` re-clamped by `hasBassRegister` — the one rule
// the user may not break on an instrument with no bass register.

import { isRegister } from './home-book-merge.js';
import {
  instrumentInstance,
  hasBassRegister,
  configFor,
  isReentrant,
  defaultPresetFor,
} from '../core/instrument.js';

// The built-in default every absent in-use register resolves to (workflow 1
// L72-78): the standard guitar, spelled as cifra.md §6 spells it (uppercase
// letter, single spaces). Nothing of it is stored; it is synthesised here so the
// chip and the search have an instrument in hand before the user sets any up.
const STANDARD_TUNING = 'E2 A2 D3 G3 B3 E4';
const STANDARD_CATALOG = '6guitar';
const STANDARD_FRETS = 22;

// The reserved instrument id the synthesized standard guitar carries and
// materializes under on its first star (music.explorer_standard_shapes; home-book
// §4.3 — the id is opaque to the format). A fixed constant, deliberately NOT a
// `crypto.randomUUID()`: two offline devices that each star on the fallback must
// write the *same* key so the home book's key-by-key merge (§5) converges on one
// standard guitar, not two. It must not be `null` (the present bug — it
// stringifies to the fragile `"null"` key) and must be outside the UUID space.
export const STANDARD_INSTRUMENT_ID = 'standard';

/**
 * The effective voicing config and preset label-id for an instrument, from its
 * stored `rules` value (home-book §4.3). A named preset is rebuilt with
 * `configFor` (which re-clamps `rootInBass` by the bass register); a Custom
 * value keeps its frozen config, with `rootInBass` likewise re-clamped. An
 * absent or malformed rules value falls back to the catalogue's default preset.
 *
 * @param {object} instrument a built music-core instrument instance
 * @param {*} rulesValue the stored `rules.value`, or null/undefined
 * @returns {{ presetId: string, config: object }}
 */
export function resolveRules(instrument, rulesValue) {
  const hasBass = hasBassRegister(instrument);
  if (
    rulesValue &&
    typeof rulesValue === 'object' &&
    rulesValue.preset === 'custom' &&
    rulesValue.config &&
    typeof rulesValue.config === 'object'
  ) {
    const config = {
      ...rulesValue.config,
      weights: { ...(rulesValue.config.weights ?? {}) },
      preset: 'custom',
    };
    // The one rule the user may not break: forced off where there is no bass
    // register, so switching a ukulele to Jazz cannot re-break it.
    config.rootInBass = Boolean(config.rootInBass) && hasBass;
    return { presetId: 'custom', config };
  }
  const named =
    rulesValue && typeof rulesValue === 'object' && typeof rulesValue.preset === 'string'
      ? rulesValue.preset
      : null;
  const presetId = named && named !== 'custom' ? named : defaultPresetFor(instrument.catalogId);
  try {
    const config = configFor(instrument, presetId);
    return { presetId: config.preset, config };
  } catch {
    // An unknown preset id (a hand-edited or forward-version home book): fall
    // back to the catalogue default rather than surface a broken instrument.
    const config = configFor(instrument, defaultPresetFor(instrument.catalogId));
    return { presetId: config.preset, config };
  }
}

// The live my-shapes for one instrument id: the `shapes.json[id]` subtree
// flattened to `{ tuning, chord, shorthand }`, keeping only well-formed string
// leaf registers and dropping tombstones (§4.4, §5.3).
function shapesForId(shapesModel, id) {
  const out = [];
  const byTuning = shapesModel?.[id];
  if (!byTuning || typeof byTuning !== 'object' || Array.isArray(byTuning)) return out;
  for (const tuning of Object.keys(byTuning)) {
    const byChord = byTuning[tuning];
    if (!byChord || typeof byChord !== 'object' || Array.isArray(byChord)) continue;
    for (const chord of Object.keys(byChord)) {
      const reg = byChord[chord];
      if (!isRegister(reg) || typeof reg.value !== 'string') continue;
      out.push({ tuning, chord, shorthand: reg.value });
    }
  }
  return out;
}

// Project one instruments.json entry to a roster entry, or null when it is a
// tombstone (a removed instrument) or malformed (dropped rather than surfaced —
// a malformed home book is the validator's concern, not the slice's).
function buildEntry(id, node, shapesModel) {
  if (!node || typeof node !== 'object') return null;
  const defReg = node.definition;
  if (!isRegister(defReg)) return null;
  const def = defReg.value;
  // A tombstone (value null) or a non-object definition is not in the roster.
  if (!def || typeof def !== 'object' || Array.isArray(def)) return null;
  const { catalogId = null, label = null, tuning, fretCount } = def;
  if (typeof tuning !== 'string') return null;
  let instrument;
  try {
    instrument = instrumentInstance({ id, catalogId, label, strings: tuning, fretCount });
  } catch {
    return null; // a tuning that does not parse — drop the entry
  }
  const rulesValue = isRegister(node.rules) ? node.rules.value : null;
  const { presetId, config } = resolveRules(instrument, rulesValue);
  return {
    id,
    catalogId: catalogId ?? null,
    label: typeof label === 'string' ? label : null,
    tuning,
    fretCount: instrument.fretCount,
    stringCount: instrument.strings.length,
    reentrant: isReentrant(instrument),
    hasBass: hasBassRegister(instrument),
    presetId,
    config,
    shapes: shapesForId(shapesModel, id),
  };
}

// The synthesised standard-guitar roster entry (the reserved id), for the chip
// and the search when no in-use register points at a real instrument. It carries
// the reserved id — not null — so the explorer's star keys the shape write on a
// stable id and the SAVE_SHAPE arm can materialize it as a real instrument on the
// first star (music.explorer_standard_shapes; home-book §4.4). Its `shapes` is
// empty: once materialized it is surfaced by `buildEntry` with live shapes like
// any other instrument, and this synthesized entry is no longer emitted.
function standardEntry() {
  const instrument = instrumentInstance({
    catalogId: STANDARD_CATALOG,
    strings: STANDARD_TUNING,
    fretCount: STANDARD_FRETS,
  });
  const { presetId, config } = resolveRules(instrument, null);
  return {
    id: STANDARD_INSTRUMENT_ID,
    catalogId: STANDARD_CATALOG,
    label: null,
    tuning: STANDARD_TUNING,
    fretCount: instrument.fretCount,
    stringCount: instrument.strings.length,
    reentrant: isReentrant(instrument),
    hasBass: hasBassRegister(instrument),
    presetId,
    config,
    shapes: [],
  };
}

/**
 * Project the home book's instrument state to the INSTRUMENTS payload: the
 * roster (well-formed, non-tombstoned entries), the resolved in-use id (null for
 * the standard guitar — absent, or pointing at an instrument that is gone), and
 * the synthesized standard-guitar fallback entry (null once the standard has been
 * materialized under the reserved id, so the roster entry is the single standard).
 *
 * @param {{ instruments?: object, preferences?: object, shapes?: object }} models
 * @returns {{ instruments: object[], inUseId: string|null, standard: object|null }}
 */
export function surfaceInstruments({ instruments = {}, preferences = {}, shapes = {} } = {}) {
  const roster = [];
  if (instruments && typeof instruments === 'object' && !Array.isArray(instruments)) {
    for (const id of Object.keys(instruments)) {
      const entry = buildEntry(id, instruments[id], shapes);
      if (entry) roster.push(entry);
    }
  }
  const inUseReg = preferences?.instrumentInUse;
  let inUseId =
    isRegister(inUseReg) && typeof inUseReg.value === 'string' ? inUseReg.value : null;
  if (inUseId && !roster.some((e) => e.id === inUseId)) inUseId = null;
  // Once the standard guitar has been materialized under the reserved id (its
  // first star), the roster entry carries its live shapes — so stop synthesizing
  // the fallback, leaving that one entry as the single in-use standard rather
  // than two entries sharing the reserved id (music.explorer_standard_shapes).
  const materializedStandard = roster.some((e) => e.id === STANDARD_INSTRUMENT_ID);
  return {
    instruments: roster,
    inUseId,
    standard: materializedStandard ? null : standardEntry(),
  };
}

// The tunings a remaining (not-removed, not-tombstoned) instrument still uses —
// the guard for the per-tuning song variations (§4.5). Shapes are keyed by id
// (§4.4) so they are never shared; variations are keyed per tuning so two
// instruments of one tuning share them.
function remainingTunings(instruments, removedId) {
  const set = new Set();
  for (const id of Object.keys(instruments || {})) {
    if (id === removedId) continue;
    const def = instruments[id]?.definition;
    if (!isRegister(def) || !def.value || typeof def.value !== 'object') continue;
    if (typeof def.value.tuning === 'string') set.add(def.value.tuning);
  }
  return set;
}

/**
 * The register change-sets that remove an instrument (workflow 15 L183-192;
 * home-book §5.3), grouped by file so the Worker writes each under its own lock.
 * Tombstones the instrument's `definition` and `rules`, every live
 * `shapes.json[id]` leaf (always — shapes are the instrument's own), and each
 * `songs.json[*].variation[<tuning>]` only when no remaining instrument still
 * uses that tuning; clears `instrumentInUse` when the removed instrument was in
 * use or was the last one (falling back to the standard guitar).
 *
 * @param {{ id: string, instruments?: object, shapes?: object, songs?: object, preferences?: object }} opts
 * @returns {{ instruments: object[], shapes: object[], songs: object[], preferences: object[] }}
 */
export function instrumentRemoval({
  id,
  instruments = {},
  shapes = {},
  songs = {},
  preferences = {},
} = {}) {
  const instrumentChanges = [
    { path: [id, 'definition'], value: null },
    { path: [id, 'rules'], value: null },
  ];

  const shapeChanges = shapesForId(shapes, id).map((s) => ({
    path: [id, s.tuning, s.chord],
    value: null,
  }));

  const songChanges = [];
  const removedTuning = instruments?.[id]?.definition?.value?.tuning;
  if (typeof removedTuning === 'string' && !remainingTunings(instruments, id).has(removedTuning)) {
    for (const songKey of Object.keys(songs || {})) {
      const variation = songs[songKey]?.variation;
      if (!variation || typeof variation !== 'object' || Array.isArray(variation)) continue;
      const reg = variation[removedTuning];
      if (isRegister(reg) && reg.value !== null) {
        songChanges.push({ path: [songKey, 'variation', removedTuning], value: null });
      }
    }
  }

  const inUseReg = preferences?.instrumentInUse;
  const inUseId = isRegister(inUseReg) ? inUseReg.value : null;
  const liveRemaining = Object.keys(instruments || {}).some((otherId) => {
    if (otherId === id) return false;
    const def = instruments[otherId]?.definition;
    return isRegister(def) && def.value && typeof def.value === 'object';
  });
  const preferenceChanges =
    inUseId === id || !liveRemaining ? [{ path: ['instrumentInUse'], value: null }] : [];

  return {
    instruments: instrumentChanges,
    shapes: shapeChanges,
    songs: songChanges,
    preferences: preferenceChanges,
  };
}

/**
 * The register change-sets that materialize the synthesized standard guitar as a
 * real `instruments.json` entry under the reserved id (home-book §2.1 lazy write;
 * workflow 15 L74; music.explorer_standard_shapes), the first time a shape is
 * starred while the fallback is in use. Mirrors `instrumentRemoval`: pure, no
 * I/O, grouped by file so the Worker writes each under its own lock. It writes
 * the canonical `definition` + `rules` registers a hand-added *Guitar · Standard*
 * writes (AddInstrumentForm L129, `defaultPresetFor('6guitar')`) and sets
 * `instrumentInUse` to the reserved id when none is set (mirroring the
 * SAVE_INSTRUMENT add branch). `label` is null, so it renders through the same
 * catalogue·tuning derivation the synthesized fallback already used — no new
 * copy. Idempotent: once the reserved entry is already live it returns empty
 * change-sets, so a second star adds only its shape leaf, never re-materializing.
 *
 * @param {{ instruments?: object, preferences?: object }} opts
 * @returns {{ instruments: object[], preferences: object[] }}
 */
export function standardMaterialization({ instruments = {}, preferences = {} } = {}) {
  const existing = instruments?.[STANDARD_INSTRUMENT_ID]?.definition;
  const alreadyLive = isRegister(existing) && existing.value && typeof existing.value === 'object';
  if (alreadyLive) return { instruments: [], preferences: [] };

  const definition = {
    catalogId: STANDARD_CATALOG,
    label: null,
    tuning: STANDARD_TUNING,
    fretCount: STANDARD_FRETS,
  };
  const instrumentChanges = [
    { path: [STANDARD_INSTRUMENT_ID, 'definition'], value: definition },
    {
      path: [STANDARD_INSTRUMENT_ID, 'rules'],
      value: { preset: defaultPresetFor(STANDARD_CATALOG) },
    },
  ];

  const inUseReg = preferences?.instrumentInUse;
  const inUse =
    isRegister(inUseReg) && typeof inUseReg.value === 'string' ? inUseReg.value : null;
  const preferenceChanges = inUse
    ? []
    : [{ path: ['instrumentInUse'], value: STANDARD_INSTRUMENT_ID }];

  return { instruments: instrumentChanges, preferences: preferenceChanges };
}
