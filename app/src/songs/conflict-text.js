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

import { parse } from 'cifra-md';
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
