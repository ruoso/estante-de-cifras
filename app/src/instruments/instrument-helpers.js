// instrument-helpers.js — the framework-free view helpers the instrument
// surface draws from (music.instruments, workflow 15). They lean on the carried
// music core (DIRECTION §5) and i18n, never on React, so the behavior test can
// drive them through the components and a future call site can reuse them. No
// IndexedDB, no git, no home-book knowledge — the Worker owns the data
// (DIRECTION §3.7); this is display logic only.

import { CATALOG, catalogEntry, parseTuning } from '../core/instrument.js';
import { formatPitch } from '../core/pitch.js';
import { fingeringFromFrets } from '../core/search.js';
import { parseShorthand } from '../core/fretstring.js';
import { instrumentInstance } from '../core/instrument.js';
import { parseChord } from '../core/notation/parse.js';
import { DEFAULT_DIALECT } from '../core/notation/dialects.js';
import { t, hasMessage } from '../i18n/index.js';

export { CATALOG, catalogEntry };

// The preset order the catalogue carries (music core), shown as the "How you
// play" choices and the rules segmented control — no "Standard" (workflow 15
// L113-120). Re-derived from the core's PRESET_IDS via a static list so the view
// owns no heuristics logic; the core is the source of truth for the ids.
export const PRESET_IDS = ['beginner', 'strumming', 'fingerstyle', 'jazz', 'bassFriendly'];

// The cifra.md §6 tuning text for a pitch list the user typed or a catalogue
// preset carries: the pitches joined by single spaces, each spelling kept
// (spec §6.2). `parseTuning` accepts both comma- and space-separated input and
// throws `fault('emptyTuning')` on nothing parseable — the add form catches it.
export function tuningText(input) {
  return parseTuning(input).map(formatPitch).join(' ');
}

// A catalogue entry's display name, from i18n (`catalog.<id>`), else its raw
// name — the same table the reference UI reads.
export function catalogName(catalogId) {
  if (catalogId && hasMessage(['catalog', catalogId])) return t(['catalog', catalogId]);
  return catalogEntry(catalogId)?.name ?? catalogId ?? '';
}

// A tuning preset's display name, from i18n (`tuning.<name>`), else the raw name
// (a custom tuning's §6 text is not in the table and shows as itself).
export function tuningName(name) {
  if (name && hasMessage(['tuning', name])) return t(['tuning', name]);
  return name;
}

// A voicing preset's display label — "Custom" for a custom set, else the
// preset's name (`rules.presets.<id>`, reused across the app).
export function presetLabel(presetId) {
  return presetId === 'custom' ? t('rules.custom') : t(['rules', 'presets', presetId]);
}

// The label shown in the chip and the roster: the user's own label, else the
// default "catalogue · tuning" (workflow 15 L94). The standard-guitar fallback
// (no stored label) reads as its catalogue name and §6 tuning text.
export function displayLabel(entry) {
  if (!entry) return '';
  if (typeof entry.label === 'string' && entry.label.trim()) return entry.label;
  return `${catalogName(entry.catalogId)} · ${entry.tuning}`;
}

// The default label a new instance takes before the user renames it
// (workflow 15 L94): "catalogue · tuning name" for a preset tuning, "catalogue ·
// §6 text" for a custom one.
export function defaultLabel(catalogId, tuningLabel) {
  return `${catalogName(catalogId)} · ${tuningLabel}`;
}

// Reconstruct a saved my-shape into a drawable `{ fingering, context }` for
// `ChordDiagram` (workflow 15 §Reviewing my shapes). The stored value is the
// fret-string shorthand and the key the chord as the core matches it; an
// instrument instance is built for the shape's own tuning so the geometry and
// the accessible name are correct. Returns null for a shape that no longer
// parses against the tuning (bad data), so the list drops it rather than crash.
export function buildShape(entry, shape) {
  const frets = parseShorthand(shape.shorthand);
  if (!frets) return null;
  const chord = parseChord(shape.chord)?.chord ?? null;
  let instrument;
  try {
    instrument = instrumentInstance({
      catalogId: entry.catalogId,
      label: entry.label ?? undefined,
      strings: shape.tuning,
      fretCount: entry.fretCount,
      heuristics: entry.config,
    });
  } catch {
    return null;
  }
  const fingering = fingeringFromFrets(frets, chord, instrument, entry.config);
  if (!fingering) return null;
  return { fingering, context: { chord, instrument, dialect: DEFAULT_DIALECT } };
}

// Group an instrument's saved shapes by their tuning (workflow 15 §Reviewing my
// shapes: "grouped by tuning"), each group keeping the order the Worker sent.
export function shapesByTuning(shapes = []) {
  const groups = new Map();
  for (const shape of shapes) {
    if (!groups.has(shape.tuning)) groups.set(shape.tuning, []);
    groups.get(shape.tuning).push(shape);
  }
  return [...groups.entries()].map(([tuning, list]) => ({ tuning, shapes: list }));
}
