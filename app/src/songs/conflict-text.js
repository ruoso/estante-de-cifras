// conflict-text — the pure helpers the conflict resolver's *edit* view and
// heading read (sync.conflicts_editing; workflow 9 §Settling one; W09#1, #3).
// No DOM, no React, no store, and nothing logged (no song text in logs).
//
// - labelMarkers: the marked text with the format's marker labels (`ours`,
//   `theirs`; cifra.md §11.12.2) renamed for the people, at display time only
//   (Decision 2). A relabelled marker is still a marker line (§11.12.3), so the
//   Worker refuses it and points at the same line.
// - conflictPlace: where a chart conflict is, in musical terms — its section
//   and the running numbers of the bars that differ (cifra.md §2.8; DIRECTION
//   §4), for a title like *Primeira parte, bar 5* (Decision 3).
// - conflictTitle / conflictSummary: a conflict's title, shared by the
//   resolver's heading and the book panel's *In conflict* row, and the row's
//   summary line (sync.conflicts_row_summary; W09#4). `t` is passed in, as
//   render-change.js takes it.

import { parse, resolveMarked } from 'cifra-md';
import { chartRows } from '../chart/layout.js';

const OURS_MARKER = '<<<<<<< ours';
const THEIRS_MARKER = '>>>>>>> theirs';

// A label stays on its marker line: any run of whitespace (newlines included)
// becomes one space. An empty label keeps the format's own.
function oneLine(label, fallback) {
  const flat = String(label ?? '').replace(/\s+/g, ' ').trim();
  return flat || fallback;
}

/**
 * Rename the format's own marker labels for the people: a whole line equal to
 * `<<<<<<< ours` becomes `<<<<<<< {yours}`, one equal to `>>>>>>> theirs`
 * becomes `>>>>>>> {theirs}`. Every other line — `=======` included — is kept
 * byte for byte, and the line count is unchanged.
 *
 * @param {string} marked  the marked text (§11.12.2)
 * @param {{ yours: string, theirs: string }} labels
 * @returns {string}
 */
export function labelMarkers(marked, { yours, theirs }) {
  const ours = `<<<<<<< ${oneLine(yours, 'ours')}`;
  const their = `>>>>>>> ${oneLine(theirs, 'theirs')}`;
  return String(marked ?? '')
    .split('\n')
    .map((line) => {
      if (line === OURS_MARKER) return ours;
      if (line === THEIRS_MARKER) return their;
      return line;
    })
    .join('\n');
}

/**
 * The reconstructed canonical text of a chart row, for matching a conflict's
 * lines (bars join with ` | `, as canonical form writes them); null for a row
 * that is not a line of text.
 */
export function rowText(row) {
  if (row.type === 'bars') return row.measures.join(' | ');
  if (row.type === 'run' || row.type === 'words') return row.text;
  return null;
}

// A side's units, one line each (a unit may hold several lines).
function sideLines(side) {
  if (!Array.isArray(side)) return [];
  return side.flatMap((unit) => String(unit).split('\n'));
}

function chartPlace(model, item) {
  const ours = sideLines(item.ours);
  if (ours.length === 0) return null;
  const theirs = sideLines(item.theirs);
  const rows = chartRows(model);
  for (let i = 0; i + ours.length <= rows.length; i += 1) {
    if (!ours.every((line, j) => rowText(rows[i + j]) === line)) continue;
    let section = null;
    for (let k = i - 1; k >= 0; k -= 1) {
      if (rows[k].type === 'section') {
        section = rows[k].name;
        break;
      }
    }
    if (!section) return null;
    const bars = [];
    ours.forEach((_, j) => {
      const row = rows[i + j];
      if (row.type !== 'bars') return;
      const other = theirs[j] != null ? theirs[j].split(' | ') : [];
      row.measures.forEach((measure, m) => {
        const number = row.numbers?.[m]?.number;
        if (number == null) return;
        if (m >= other.length || other[m] !== measure) bars.push(number);
      });
    });
    return { section, bars };
  }
  return null;
}

function sectionsPlace(model, item) {
  const ours = Array.isArray(item.ours) ? item.ours : [];
  if (ours.length === 0) return null;
  let named;
  try {
    named = parse(ours.join('\n\n')).sections.find((s) => s.name);
  } catch {
    return null;
  }
  if (!named) return null;
  const inModel = (model?.sections ?? []).some((s) => s.name === named.name);
  return inModel ? { section: named.name, bars: [] } : null;
}

/**
 * Where a chart or sections conflict is, over the ours model (the resolver's
 * preview): `{ section, bars }` — the section's name and the running bar
 * numbers (§2.8) of the measures of ours that differ from theirs, position by
 * position — or null when the section is unnamed or the region is not found.
 * A sections conflict, or a region with no numbered differing measure (a run,
 * a sung song, lines only theirs added), has `bars: []`.
 *
 * @param {object|null} model  the parsed ours song
 * @param {object} item        one conflict of the song (conflict-model.js)
 * @returns {{ section: string, bars: number[] } | null}
 */
export function conflictPlace(model, item) {
  if (!model || !item) return null;
  if (item.kind === 'chart') return chartPlace(model, item);
  if (item.kind === 'sections') return sectionsPlace(model, item);
  return null;
}

/**
 * The measures of one side of a chart conflict that differ from the other side,
 * position by position — the comparison `conflictPlace` names the bars by, so
 * the title and the diagrams under each side agree (sync.conflicts_polish
 * Decision 1). A measure past the other side's end counts as different. Only a
 * `chart` item has measures; any other kind, or an absent side, has none.
 *
 * @param {object} item  one conflict of the song (conflict-model.js)
 * @param {'ours'|'theirs'} side
 * @returns {string[]}  the differing measures' text, in order
 */
export function differingMeasures(item, side) {
  if (item?.kind !== 'chart') return [];
  const mine = sideLines(side === 'ours' ? item.ours : item.theirs);
  const other = sideLines(side === 'ours' ? item.theirs : item.ours);
  const out = [];
  mine.forEach((line, j) => {
    const theirs = other[j] != null ? other[j].split(' | ') : [];
    line.split(' | ').forEach((measure, m) => {
      if (!measure.trim()) return;
      if (m >= theirs.length || theirs[m] !== measure) out.push(measure);
    });
  });
  return out;
}

/**
 * The ours side of a marked text, parsed — the model `conflictPlace` names a
 * chart conflict's place over (the resolver's preview) — or null when there is
 * no marked text, a conflict region is left open, or it will not parse.
 *
 * @param {string|null|undefined} marked  the marked text (§11.12.2)
 * @returns {object|null}
 */
export function oursModel(marked) {
  if (!marked) return null;
  try {
    return parse(resolveMarked(marked, 'ours'));
  } catch {
    return null;
  }
}

// A chart conflict's title by where it is (W09#1 L42; DIRECTION §4): the
// section, and the bar or bars that differ — or the generic title when the
// place cannot be named.
function placeTitle(place, t) {
  if (!place) return t('songConflict.chartTitleFallback');
  const { section, bars } = place;
  if (bars.length === 0) return t('songConflict.chartTitle', { section });
  if (bars.length === 1) return t('songConflict.chartTitleBar', { section, bar: bars[0] });
  if (bars.length === 2) return t('songConflict.chartTitleBars', { section, first: bars[0], second: bars[1] });
  return t('songConflict.chartTitleBarRange', { section, first: bars[0], last: bars[bars.length - 1] });
}

/**
 * A conflict's title in musical terms — the resolver's heading for it and the
 * name the book panel's *In conflict* row gives it (workflow 9 §Settling one;
 * W09#1 L42, W09#4 L222). Musical tokens (section names, chord symbols,
 * property keys) pass through as data; only the words around them are
 * translated.
 *
 * @param {object} item         one conflict of the song (conflict-model.js)
 * @param {object|null} model   the parsed ours song (`oursModel`)
 * @param {(key: string, params?: object) => string} t  the i18n lookup
 * @returns {string}
 */
export function conflictTitle(item, model, t) {
  if (item?.kind === 'voicing') return t('songConflict.voicingTitle', { chord: item.chord ?? item.key ?? '' });
  if (item?.kind === 'property') return t('songConflict.propertyTitle', { key: item.key ?? '' });
  if (item?.kind === 'title') return t('songConflict.titleTitle');
  if (item?.kind === 'chart' || item?.kind === 'sections') return placeTitle(conflictPlace(model, item), t);
  return t('songConflict.genericTitle');
}

/**
 * The *In conflict* row's summary line (W09#4 L222): the distinct titles of a
 * song's conflicts, in item order, joined by ` · ` — or null when it has none.
 * Never throws: an absent or unreadable marked text names chart conflicts by
 * the generic title.
 *
 * @param {{ marked?: string|null, items?: object[] }} song  a `conflicts` slice song
 * @param {(key: string, params?: object) => string} t  the i18n lookup
 * @returns {string|null}
 */
export function conflictSummary(song, t) {
  const items = Array.isArray(song?.items) ? song.items : [];
  if (items.length === 0) return null;
  const model = oursModel(song.marked);
  const titles = [];
  for (const item of items) {
    const title = conflictTitle(item, model, t);
    if (!titles.includes(title)) titles.push(title);
  }
  return titles.join(' · ');
}
