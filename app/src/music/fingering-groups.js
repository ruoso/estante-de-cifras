// The explorer's (and the in-song picker's) shared view-model over a
// `searchFingerings` result (music.explorer; design.explorer's one shared
// ranked-and-grouped component so *explore a chord* and *choose a shape in a
// song* can never rank or group differently). Framework-free: it holds the group
// labels, the six-per-group display cap and the starred-match, so a future call
// site (songs.arrange) and the unit test reach it without React.
//
// It never re-sorts, re-groups or re-buckets: ranking (easiest first), grouping
// by position (open first then up the neck, empties skipped) and the difficulty
// bucket are the carried core's own already-tested logic (core/search.js,
// core/score.js). This only labels the groups, caps the display, and marks the
// shapes the user has starred.

import { t } from '../i18n/index.js';
import { parseChord } from '../core/notation/parse.js';
import { sameChord } from '../core/chord.js';

// Each group shows its easiest six shapes, with *show more* revealing the rest
// (workflow 16 L65-67). The cap is display-only — the group holds every shape the
// search found, and *show more* never changes the search.
export const DISPLAY_CAP = 6;

// A fret shorthand spoken for an accessible name: the dash-separated multi-digit
// form (`x-x-7-6-5-5`) reads as spaced single tokens (`x x 7 6 5 5`), while the
// compact single-char form (`x02220`) is already its own spelling (board W16).
export function spokenShorthand(shorthand) {
  return shorthand.includes('-') ? shorthand.replace(/-/g, ' ') : shorthand;
}

// The label for a position group: *Open* for open position (0), else *Fret N*
// (workflow 16 L56-63; board W16 — the short form, not CAGED roman numerals).
export function groupLabel(position) {
  return position === 0 ? t('explorer.group.open') : t('explorer.group.fret', { position });
}

// The shorthands starred for `chord` among the stored `shapes` leaves (the in-use
// instrument's `shapes.json[id]` subtree, already filtered to the current tuning:
// `{ chord, shorthand }`). Matched **by chord, not by spelling** (home-book §4.4):
// a leaf written `Cmaj7` marks a shape shown for a `C7M` search, because both
// parse to the same chord.
export function starredShorthands(chord, shapes = []) {
  const out = new Set();
  if (!chord) return out;
  for (const leaf of shapes) {
    const parsed = parseChord(leaf.chord)?.chord;
    if (parsed && sameChord(parsed, chord)) out.add(leaf.shorthand);
  }
  return out;
}

/**
 * The view-model the shared list renders: one entry per position group, in the
 * order and groups the core produced. Each entry carries its label, the full
 * shape list (ranked, each flagged starred), the display cap and how many are
 * hidden under it.
 *
 * @param {{ groups?: Array<{ position:number, fingerings:object[], total:number }> }} result
 *   a `searchFingerings` result (search.js)
 * @param {{ chord?: object, shapes?: {chord:string, shorthand:string}[], cap?:number }} [options]
 * @returns {Array<{ position:number, label:string, total:number, count:number,
 *   cap:number, hiddenCount:number, shapes:{fingering:object, starred:boolean}[] }>}
 */
export function groupViewModel(result, { chord = null, shapes = [], cap = DISPLAY_CAP } = {}) {
  const starred = starredShorthands(chord, shapes);
  return (result?.groups ?? []).map((group) => {
    const marked = group.fingerings.map((fingering) => ({
      fingering,
      starred: starred.has(fingering.shorthand),
    }));
    return {
      position: group.position,
      label: groupLabel(group.position),
      total: group.total,
      count: marked.length,
      cap,
      hiddenCount: Math.max(0, marked.length - cap),
      shapes: marked,
    };
  });
}
