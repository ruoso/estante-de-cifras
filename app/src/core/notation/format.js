/**
 * Chord formatting, one implementation per dialect (docs/DESIGN.md §4.4).
 *
 * Parsing is shared and permissive; formatting is where the dialects genuinely
 * differ, so this is the only place per-dialect code belongs. The contract is a
 * round trip: `parse(format(c, d), d)` must equal `c` for every dialect, which
 * means a formatter may only emit spellings the parser accepts.
 */

import { formatNote } from '../pitch.js';
import { DEFAULT_DIALECT, getDialect } from './dialects.js';

/** Read a chord's extensions into a map for inspection. */
function extMap(c) {
  const m = new Map();
  for (const e of c.extensions) m.set(e.degree, e.alter);
  return m;
}

const ALTER_SUFFIX_BR = { '-2': 'bb', '-1': '-', 0: '', 1: '+', 2: '##' };
const ALTER_PREFIX_ASCII = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' };
// Display only (the explorer's flip, workflow 16 §Viewing by notation): the same
// accidentals as written music draws them. Never what a chart or a book holds.
const ALTER_PREFIX_UNICODE = { '-2': '♭♭', '-1': '♭', 0: '', 1: '♯', 2: '♯♯' };

/**
 * The spelling helpers one call formats with: ASCII `#`/`b` by default, `♯`/`♭`
 * with `{ accidentals: 'unicode' }`. Applied to every note and alteration the
 * formatters write, so the option is structural rather than a replace over text.
 */
function spelling(options) {
  const prefix = options?.accidentals === 'unicode' ? ALTER_PREFIX_UNICODE : ALTER_PREFIX_ASCII;
  return {
    note: (n) => (prefix === ALTER_PREFIX_ASCII ? formatNote(n) : n.letter + prefix[String(n.accidental)]),
    alter: (alter) => prefix[String(alter)],
  };
}

/**
 * Decide the chord's headline shape: the triad name plus which degree, if any,
 * is acting as its stated top. Shared by all three formatters so they agree on
 * what the chord *is* and differ only in how they spell it.
 */
function analyse(c) {
  const ext = extMap(c);
  const seventh = ext.get(7);
  const hasSeventh = seventh !== undefined;
  const has = (d) => ext.has(d);

  // The stated top: the highest stacked degree present with no alteration,
  // where every degree below it is also present and unaltered.
  let top = null;
  if (hasSeventh) {
    top = 7;
    if (ext.get(9) === 0) {
      top = 9;
      if (ext.get(11) === 0) top = 11;
      if (ext.get(13) === 0) top = 13;
    }
  }

  // Degrees already accounted for by the stated top.
  const covered = new Set();
  if (top !== null) {
    covered.add(7);
    if (top >= 9) covered.add(9);
    if (top === 11) covered.add(11);
    if (top === 13) covered.add(13);
  }

  const extras = [...ext.entries()]
    .filter(([degree]) => !covered.has(degree))
    .sort((a, b) => a[0] - b[0]);

  return {
    ext,
    hasSeventh,
    seventh,
    top,
    extras,
    isHalfDim: c.quality === 'dim' && seventh === -1,
    isDim7: c.quality === 'dim' && seventh === -2,
    hasSix: has(6),
    hasSixNine: has(6) && ext.get(9) === 0 && !hasSeventh,
  };
}

/**
 * Brazilian cifra: 7M for a major 7th, ° and +, a sus4 triad written as 4.
 *
 * Over a seventh everything past the seventh shares one parenthesis, the fourth
 * first: a suspended fourth opens it (`C7(4)`, `C7(4,9)` — spec §5.6: `C7(4)` is
 * the Brazilian suspension), and a natural fourth added to a major triad is
 * `add4`, since a bare 4 there is that suspension (`C7(add4)`, `C(add4)`).
 */
function formatBrazilian(c, a, sp) {
  const root = sp.note(c.root);
  let base = root;
  let tail = '';

  switch (c.quality) {
    case 'minor':
      base += 'm';
      break;
    case 'dim':
      // ° alone reads as the 7th, so a bare triad is written out as `dim`.
      base += a.isHalfDim ? 'm' : a.isDim7 ? '°' : 'dim';
      break;
    case 'aug':
      base += a.hasSeventh ? '' : '+';
      break;
    case 'sus2':
      base += 'sus2';
      break;
    case 'sus4':
      // Over a seventh the 4 moves into the parenthesis (`C7(4)`, not `C47`).
      if (!a.hasSeventh) base += '4';
      break;
    case 'power':
      base += '5';
      break;
    default:
      break;
  }

  if (a.hasSixNine) return `${base}6/9`;
  if (a.hasSix && !a.hasSeventh) tail += '6';

  // The one parenthesis: the fourth first, then a ninth top, then the rest.
  // The ninth stays ahead of a `5-`/`5+`: `C7(5-,9)` would read as a flat ninth.
  const fourth = [];
  const parenParts = [];
  if (a.hasSeventh) {
    // A diminished 7th is the ° in the base; nothing more to write.
    if (a.isDim7) tail += '';
    else if (a.seventh === 0) tail += a.top === 7 || a.top === 9 ? '7M' : `7M(${a.top})`;
    else tail += a.top === 9 ? '7' : String(a.top); // a bare C9 would read as an added 9th
    if (c.quality === 'sus4') fourth.push('4');
    // A ninth as the top joins the parenthesis (`C7(9,11+)`, not `C7(9)(11+)`).
    if (!a.isDim7 && a.top === 9) parenParts.push('9');
  }
  if (a.isHalfDim) parenParts.push('5-');
  if (c.quality === 'aug' && a.hasSeventh) parenParts.push('5+');
  for (const [degree, alter] of a.extras) {
    if (degree === 6 && !a.hasSeventh) continue;
    if (degree === 4 && alter === 0) fourth.push(c.quality === 'major' ? 'add4' : '4');
    else parenParts.push(`${degree}${ALTER_SUFFIX_BR[String(alter)]}`);
  }
  parenParts.unshift(...fourth);
  if (parenParts.length) tail += `(${parenParts.join(',')})`;

  return base + tail;
}

/** American jazz: maj7, m7b5, dim7, sus4, add9. */
function formatAmerican(c, a, sp) {
  const root = sp.note(c.root);
  let base = root;
  let tail = '';

  switch (c.quality) {
    case 'minor':
      base += 'm';
      break;
    case 'dim':
      base += a.isHalfDim ? 'm' : 'dim';
      break;
    case 'aug':
      base += a.hasSeventh ? '' : 'aug';
      break;
    case 'sus2':
      base += 'sus2';
      break;
    case 'sus4':
      // Over a seventh the suspension follows it (`C7sus4`, not `Csus47`).
      if (!a.hasSeventh) base += 'sus4';
      break;
    case 'power':
      base += '5';
      break;
    default:
      break;
  }

  if (a.hasSixNine) return `${base}6/9`;
  if (a.hasSix && !a.hasSeventh) tail += '6';

  if (a.hasSeventh) {
    if (a.isDim7) tail += '7';
    else if (a.seventh === 0) tail += `maj${a.top}`;
    else tail += String(a.top);
    if (c.quality === 'sus4') tail += 'sus4';
  }

  const parts = [];
  if (a.isHalfDim) parts.push(`${sp.alter(-1)}5`);
  if (c.quality === 'aug' && a.hasSeventh) parts.push(`${sp.alter(1)}5`);
  for (const [degree, alter] of a.extras) {
    if (degree === 6 && !a.hasSeventh) continue;
    // A natural 4th over a seventh is added, never a bare `4` (`C7add4`, not `C74`).
    if (alter === 0 && (!a.hasSeventh || degree === 4)) parts.push(`add${degree}`);
    else parts.push(`${sp.alter(alter)}${degree}`);
  }
  tail += parts.join('');

  return base + tail;
}

/** Real Book symbols: ∆ for a major 7th, − for minor, ø and °. */
function formatRealBook(c, a, sp) {
  const root = sp.note(c.root);
  let base = root;
  let tail = '';

  switch (c.quality) {
    case 'minor':
      base += '−';
      break;
    case 'dim':
      base += a.isHalfDim ? 'ø' : a.isDim7 ? '°' : 'dim';
      break;
    case 'aug':
      base += a.hasSeventh ? '' : '+';
      break;
    case 'sus2':
      base += 'sus2';
      break;
    case 'sus4':
      // Over a seventh the suspension follows it (`C7sus4`, not `Csus47`).
      if (!a.hasSeventh) base += 'sus4';
      break;
    case 'power':
      base += '5';
      break;
    default:
      break;
  }

  if (a.hasSixNine) return `${base}6/9`;
  if (a.hasSix && !a.hasSeventh) tail += '6';

  if (a.hasSeventh) {
    if (a.isDim7) tail += '';
    else if (a.isHalfDim) tail += '7';
    else if (a.seventh === 0) tail += `∆${a.top}`;
    else tail += String(a.top);
    if (c.quality === 'sus4') tail += 'sus4';
  }

  const parts = [];
  if (c.quality === 'aug' && a.hasSeventh) parts.push(`${sp.alter(1)}5`);
  for (const [degree, alter] of a.extras) {
    if (degree === 6 && !a.hasSeventh) continue;
    // A natural 4th over a seventh is added, never a bare `4` (`C7add4`, not `C74`).
    if (alter === 0 && (!a.hasSeventh || degree === 4)) parts.push(`add${degree}`);
    else parts.push(`${sp.alter(alter)}${degree}`);
  }
  tail += parts.join('');

  return base + tail;
}

const FORMATTERS = {
  brazilian: formatBrazilian,
  american: formatAmerican,
  realbook: formatRealBook,
};

/**
 * Render a chord in a notation dialect.
 *
 * `options.accidentals` is `'ascii'` (the default: `#`/`b`, what charts,
 * transposition and books hold) or `'unicode'` (`♯`/`♭`, for display only).
 *
 * @param {import('../chord.js').Chord} c
 * @param {string} [dialectId]
 * @param {{ accidentals?: 'ascii' | 'unicode' }} [options]
 * @returns {string}
 */
export function formatChord(c, dialectId = DEFAULT_DIALECT, options = {}) {
  const dialect = getDialect(dialectId);
  const a = analyse(c);
  const sp = spelling(options);
  const symbol = FORMATTERS[dialect.id](c, a, sp);
  return c.bass ? `${symbol}/${sp.note(c.bass)}` : symbol;
}
