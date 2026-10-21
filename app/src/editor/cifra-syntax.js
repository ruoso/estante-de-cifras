// Line classification for the source editor's syntax colour (songs.editor
// Decision 8; workflow 3 §The editor; spec §1.9, §7). The editor colours the
// cifra.md text by its structure, and it does so with cifra.md's OWN primitives
// — `fenceOpen`/`closesFence`/`mdHeading` (markdown.js), `isMarkerLine`
// (text.js), the chord parser, and `parse().diagnostics` — never a second,
// drifting grammar. The colouring therefore agrees with the reader: the error
// and marker highlights are exactly the lines the reader reports.
//
// Pure: no React, no CodeMirror. `classifyLines` returns one class per source
// line; the editor maps each to a CSS class and the preview uses the same
// `parse()` the diagnostics come from.

import {
  fenceOpen,
  closesFence,
  mdHeading,
  isMarkerLine,
  isChord,
  parse,
} from 'cifra-md';
import { songDialect } from '../core/notation/dialects.js';
import { lineDiagnostics } from './diagnostic-words.js';

// The class vocabulary (each maps to an `est-<class>` CSS class on the line):
//   md       — markdown structure: the `#` title, `- property:` lines, `##`
//              headings (section and voicing-block), fence delimiters, the rule
//   ch       — a chord line inside a music fence
//   lyric    — a words line inside a music fence
//   voicing  — a `- key: frets` item in the voicings part
//   verbatim — a line inside a non-music (e.g. ```tab) fence
//   err      — a line the reader reported (a `bad-voicing`, any other problem)
//   mk       — a conflict-marker line (never saved; spec §11.12.3)
//   text     — anything else (plain)
export const LINE_CLASSES = Object.freeze([
  'md',
  'ch',
  'lyric',
  'voicing',
  'verbatim',
  'err',
  'mk',
  'text',
]);

const THEMATIC_BREAK = /^ {0,3}([-*_])( *\1){2,} *$/;
const LIST_ITEM = /^ {0,3}-\s+[^:]+:/; // `- key:` — a property or a voicing item
const BRACKET_MARKER = /^\[.*\]$/; // `[Intro]`-style heading inside a chart
const BAR_SEP = /^\|+$/;
const BEAT_OR_COUNT = /^(?:[./%-]+|x\d+)$/i;

// A line "looks like chords" when, after dropping bar separators, bracket
// markers and beat/count marks, at least one token remains and every remaining
// token parses as a chord. This mirrors how the reader tells a chord run from a
// lyric line, without re-deriving the reader's measure grammar: `Am | Dm | G7`
// and `[Intro] Am G F E7` are chords; `[Primeira Parte]` alone and `A maré veio
// mansa` are not.
function looksLikeChords(line, dialect) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  const meaningful = tokens.filter(
    (t) => !BRACKET_MARKER.test(t) && !BAR_SEP.test(t) && !BEAT_OR_COUNT.test(t),
  );
  if (meaningful.length === 0) return false;
  return meaningful.every((t) => isChord(t, dialect));
}

// The lines the reader reported, keyed by 1-based line number. A marker line
// takes its own class — a marker is the strongest signal, so no other
// diagnostic on the line downgrades it; every other reported line stands out as
// an error — "the lines the reader reported" (acceptance criterion 2). The
// error lines are exactly those `lineDiagnostics` words (diagnostic-words.js),
// so the red and its note never disagree. `parse` only throws on invalid UTF-8,
// which a string buffer cannot be, so this never throws.
function reportedLines(doc) {
  const byLine = new Map();
  for (const d of doc.diagnostics) {
    if (d.code === 'marker-line' && typeof d.line === 'number') byLine.set(d.line, 'mk');
  }
  for (const line of lineDiagnostics(doc.diagnostics).keys()) byLine.set(line, 'err');
  return byLine;
}

/**
 * Classify every line of a cifra.md buffer for syntax colour.
 *
 * The song is read in its own notation (cifra.md §5.6 Rules): the reader's
 * dialect is the song's `notation` property, never a caller's preference, so
 * the colouring — chord recognition and the reported lines, a `bad-notation`
 * included — is what the reader reports for the song as written
 * (songs.song_notation_views Decision 2).
 *
 * @param {string} text the buffer text
 * @returns {string[]} one class from {@link LINE_CLASSES} per source line
 */
export function classifyLines(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const doc = parse(text);
  const dialect = songDialect(doc);
  const reported = reportedLines(doc);

  let fence = null; // the open fence's { char, length } while inside one
  let fenceIsMusic = false;
  let inPreamble = true; // before the first heading / fence / rule
  let inVoicings = false; // after the first top-level rule (spec §7)

  return lines.map((line, i) => {
    const lineNo = i + 1;
    const reportedClass = reported.get(lineNo);
    // A reader-reported line stands out regardless of where it sits.
    if (reportedClass) {
      // Keep fence state honest even on a reported line.
      if (fence && closesFence(line, fence)) fence = null;
      else if (!fence) {
        const open = fenceOpen(line);
        if (open) {
          fence = open;
          fenceIsMusic = open.info === '' || open.info === 'cifra';
        }
      }
      return reportedClass;
    }

    if (fence) {
      if (closesFence(line, fence)) {
        fence = null;
        return 'md';
      }
      if (isMarkerLine(line)) return 'mk';
      if (!fenceIsMusic) return 'verbatim';
      if (line.trim() === '') return 'text';
      return looksLikeChords(line, dialect) ? 'ch' : 'lyric';
    }

    if (isMarkerLine(line)) return 'mk';

    if (THEMATIC_BREAK.test(line)) {
      inPreamble = false;
      inVoicings = true;
      return 'md';
    }

    const heading = mdHeading(line);
    if (heading) {
      // The `#` title is part of the preamble (the properties follow it); only
      // a `##`+ section heading ends it.
      if (heading.level >= 2) inPreamble = false;
      return 'md';
    }

    const open = fenceOpen(line);
    if (open) {
      inPreamble = false;
      fence = open;
      fenceIsMusic = open.info === '' || open.info === 'cifra';
      return 'md';
    }

    if (LIST_ITEM.test(line)) {
      if (inVoicings) return 'voicing';
      if (inPreamble) return 'md';
      return 'text';
    }

    return 'text';
  });
}
