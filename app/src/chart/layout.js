// The chart's layout (shell.chart): a pure, framework-free transform from the
// cifra.md reader's parsed song model into an ordered list of chart render rows.
// No DOM, no React, and no `cifra-md` import — the Web Worker owns parsing and
// the model reaches the view as plain data (DIRECTION §3.7 lines 407-417), so
// this module's input is an ordinary object and its output is plain data a
// component renders. It is the seam the unit test pins with no DOM.
//
// The reader already ran the §4.5 convergence pass, so every sung line holds
// each chord with its attached `words` and the words divided among the
// measure-making items (spec/4-lyrics.md §4.4-§4.5). This module renders that
// attachment; it does not re-derive it (the refinement's "render the reader's
// already-laid-out model" decision). The stored `words` never contain the `_`
// padding (§4.4), so a chord that splits a word is inferred from the segment
// boundary, never printed from the text.

// The item types that carry words — they make a segment on a sung line and a
// cell on a chord line (spec §4.4: chord, no-chord, beat, repeat and an
// unknown token take words; `lead` is the synthetic run of syllables before the
// first chord). The structural tokens (`mark`, `count`, `ending`) carry a
// column but no words (§4.4) and so take no segment of their own.
const SEGMENT_TYPES = new Set(['chord', 'nochord', 'beat', 'repeat', 'unknown', 'lead']);

// The chord drawn above a segment's words, by item type: the symbol for a
// chord, the canonical `N.C.` for a no-chord (spec §2.6), the beat or repeat
// glyph, the kept text for an unknown token, and nothing for a `lead` (the
// leading syllables sit under an empty chord slot).
function chordText(item) {
  switch (item.type) {
    case 'chord':
      return item.symbol;
    case 'nochord':
      return 'N.C.';
    case 'beat':
      return item.mark;
    case 'repeat':
      return '%';
    case 'unknown':
      return item.text;
    default:
      return '';
  }
}

// A word is split by a chord — and a centred hyphen bridges it — when the left
// segment's words end on a non-space and the right segment's begin on a
// non-space (GUIDE.md segment helper lines 55-60; spec §4.4 padding). Because
// the stored words hold no `_`, the two conditions reduce to "neither boundary
// touches a space".
const endsTight = (text) => /\S$/.test(text);
const startsTight = (text) => /^\S/.test(text);

// A sung line → a row of segments built from the measure-making items in column
// order. Segments are grouped per measure so the hyphen never bridges across a
// bar rule (a word does not continue over a bar between measures); within a
// measure, a segment's `hyphen` is set when it splits a word with the next.
function sungRow(line, address) {
  const segments = [];
  for (const measure of line.measures) {
    const items = measure.items.filter((item) => SEGMENT_TYPES.has(item.type));
    items.forEach((item, i) => {
      const words = item.words ?? '';
      const next = items[i + 1];
      const hyphen = next != null && endsTight(words) && startsTight(next.words ?? '');
      segments.push({ chord: chordText(item), words, hyphen });
    });
  }
  return { type: 'sung', segments, address };
}

// One chord-only measure → its chords (and any beat/repeat/unknown glyph) in
// order, joined by a space; the structural tokens are dropped.
function measureCell(measure) {
  return measure.items
    .filter((item) => SEGMENT_TYPES.has(item.type))
    .map(chordText)
    .join(' ');
}

// A chord-only (chart) line → a run row when it carries no bar lines (§2.1,
// `run === true`), else a bars row of one cell per measure, drawn between bar
// rules by the adopted CSS. Chart lines carry no words (§4.4).
function chartRow(line, address) {
  if (line.run) {
    return { type: 'run', text: line.measures.map(measureCell).join(' '), address };
  }
  return { type: 'bars', measures: line.measures.map(measureCell), address };
}

function rowForLine(line, address) {
  switch (line.kind) {
    case 'sung':
      return sungRow(line, address);
    case 'chart':
      return chartRow(line, address);
    // A words-only line and a `//` annotation both render as a plain words line
    // — no new token (the refinement's scope note, §4.x).
    case 'lyric':
    case 'annotation':
      return { type: 'words', text: line.text, address };
    case 'break':
      return { type: 'gap', address };
    default:
      return { type: 'gap', address };
  }
}

/**
 * Turn a parsed cifra.md song model into an ordered list of chart render rows.
 *
 * A named section yields a section-name row (the pre-heading section's name is
 * the empty string and yields none); each `music` body part yields one content
 * row per line — a sung row, a bars row, a run row, a words row or a gap row —
 * carrying its stable `{ section, part, line }` address. Non-music body parts
 * (prose `notes`, `verbatim` fences) are the song-reading view's to draw, not
 * the chart's (the refinement's "scope of what the chart draws").
 *
 * @param {object} [model]  the reader's plain-object model
 * @returns {Array<object>} render rows in document order
 */
export function chartRows(model) {
  const rows = [];
  const sections = model?.sections ?? [];
  sections.forEach((section, sectionIndex) => {
    if (section.name) rows.push({ type: 'section', name: section.name });
    (section.body ?? []).forEach((part, partIndex) => {
      if (part.type !== 'music') return;
      (part.lines ?? []).forEach((line, lineIndex) => {
        rows.push(rowForLine(line, { section: sectionIndex, part: partIndex, line: lineIndex }));
      });
    });
  });
  return rows;
}
