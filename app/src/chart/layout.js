// The chart's layout (shell.chart, songs.render_notes): a pure, framework-free transform from the
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

// The per-chord pressable token carried alongside each rendered chord, for the
// arrange surface's opt-in interactive seam (Chart's `onChordPress`, Workflow 5
// Decision 3). It is `null` for everything but a voiced chord: only a `chord`
// item with a §2.4 voicing `key` is a thing to tap (a no-chord, beat, repeat or
// unknown token is not). The `address` is the cifra.md occurrence path
// { section, part, line, measure, item } — `measure` the raw index into
// `line.measures`, `item` the raw index into `measure.items` — so it indexes the
// same item as `cifra-md`'s §8.5 `itemAt` / `song-analysis.analyseSong`. The
// field is additive: the non-interactive reading chart never reads it, so its
// render is unchanged.
function tokenFor(item, address, measure, item_) {
  if (item.type !== 'chord' || item.key == null) return null;
  return {
    symbol: item.symbol,
    key: item.key,
    address: { section: address.section, part: address.part, line: address.line, measure, item: item_ },
  };
}

// The per-slot `voice` descriptor the screen-reader reading consumes
// (`reading.js`, shell.a11y_chart): what to announce where the chart draws a
// glyph. A `chord` carries its parsed model (`item.chord`, the §3 spoken name's
// input) and its §2.4 footnote index; a `nochord` is announced "no chord"; a
// `lead` is a word-run alone; a beat/repeat/unknown carries its glyph text, as
// there is no §3 spoken form for it. It is additive — the non-reading render
// never looks at it (the refinement's "the view assembles the renderer's
// labels" seam; screen-reader.md §8).
function voiceFor(item) {
  switch (item.type) {
    case 'chord':
      return { type: 'chord', chord: item.chord ?? null, footnote: item.index ?? 1 };
    case 'nochord':
      return { type: 'nochord' };
    case 'lead':
      return { type: 'lead' };
    default:
      return { type: item.type, text: chordText(item) };
  }
}

// The repeat marks of spec §3 — a group's opening and closing marks, its count,
// its endings — take no words and no column of their own (§4.4), but a reader
// must still see them: they say what is played again. Each becomes a mark drawn
// against the chord beside it — an opening mark or an ending before the next
// chord, a closing mark or a count after the one before — as written, never
// expanded (§3: a reader is never required to expand a repeat). On a bars row
// the bar-line marks, the endings and a group's count are drawn on the measure
// instead (`measureMarks`), so only brackets and a line's count reach here.
function markFor(item) {
  switch (item.type) {
    case 'mark':
      return { kind: item.open ? 'open' : 'close', notation: item.notation };
    case 'count':
      return { kind: 'count', times: item.times };
    case 'ending':
      return { kind: 'ending', number: item.number };
    default:
      return null;
  }
}

const leadsChord = (mark) => mark.kind === 'open' || mark.kind === 'ending';

// Items in order → the marks to draw before and after each word-taking item
// (`SEGMENT_TYPES`), keyed by its position among them; `skip(item)` leaves an
// item to the caller. A mark with no chord on the side it leans to goes to the
// other side; a run with no chord at all draws none.
function marksAround(items, skip = () => false) {
  const around = [];
  let pending = [];
  let count = 0;
  for (const item of items) {
    if (SEGMENT_TYPES.has(item.type)) {
      around[count] = { before: pending, after: [] };
      pending = [];
      count += 1;
      continue;
    }
    if (skip(item)) continue;
    const mark = markFor(item);
    if (!mark) continue;
    if (leadsChord(mark) || count === 0) pending.push(mark);
    else around[count - 1].after.push(mark);
  }
  if (pending.length && count > 0) around[count - 1].after.push(...pending);
  return around;
}

// A bars row's measure → what is drawn on its bar lines (spec §3.2-§3.4): a
// repeat opens on its left rule, closes on its right, with the group's count
// over the closing rule and an ending's number over the measure it begins.
function measureMarks(measure) {
  const marks = { open: false, close: false, count: null, ending: null };
  for (const item of measure.items) {
    if (item.type === 'mark' && item.notation === 'barline') {
      if (item.open) marks.open = true;
      else marks.close = true;
    } else if (item.type === 'ending') marks.ending = item.number;
    else if (item.type === 'count' && marks.close) marks.count = item.times;
  }
  return marks;
}

// A predicate, fresh for each measure and read through its items in order:
// whether the measure draws this item on its rule itself (`measureMarks`).
function onTheRule() {
  let closed = false;
  return (item) => {
    if (item.type === 'mark' && item.notation === 'barline') {
      if (!item.open) closed = true;
      return true;
    }
    return item.type === 'ending' || (item.type === 'count' && closed);
  };
}

// A sung line → a row of segments built from the measure-making items in column
// order. Segments are grouped per measure so the hyphen never bridges across a
// bar rule (a word does not continue over a bar between measures); within a
// measure, a segment's `hyphen` is set when it splits a word with the next. Each
// segment also carries its pressable `token` (null for a non-chord), used only
// by the interactive arrange chart.
//
// A segment is a `tail` (songs.trailing_chord_gap) when it has no words and the
// segment before it on the same line — across bars, since a sung row draws no
// bar rule — has words holding a non-space: the chord attached past the end of
// the words (spec §4.4, §4.8 "a chord with an empty segment") would otherwise
// sit glued to the last word. The view draws the space; the words are untouched.
function sungRow(line, address) {
  const segments = [];
  let previousWords = null;
  const marks = marksAround(line.measures.flatMap((measure) => measure.items));
  line.measures.forEach((measure, measureIndex) => {
    const items = [];
    measure.items.forEach((item, itemIndex) => {
      if (SEGMENT_TYPES.has(item.type)) items.push({ item, itemIndex });
    });
    items.forEach(({ item, itemIndex }, i) => {
      const words = item.words ?? '';
      const next = items[i + 1];
      const hyphen = next != null && endsTight(words) && startsTight(next.item.words ?? '');
      const tail = words === '' && previousWords != null && /\S/.test(previousWords);
      previousWords = words;
      segments.push({
        chord: chordText(item),
        words,
        hyphen,
        tail,
        token: tokenFor(item, address, measureIndex, itemIndex),
        voice: voiceFor(item),
        ...withMarks(marks[segments.length]),
      });
    });
  });
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

// One chord-only measure → its renderable cells with their pressable tokens, in
// column order (the structured parallel of `measureCell`, for the interactive
// arrange chart). Each cell is `{ text, token }`; `token` is null for a
// non-chord glyph.
function measureTokens(measure, address, measureIndex, skip) {
  const cells = [];
  const marks = marksAround(measure.items, skip);
  measure.items.forEach((item, itemIndex) => {
    if (!SEGMENT_TYPES.has(item.type)) return;
    cells.push({
      text: chordText(item),
      token: tokenFor(item, address, measureIndex, itemIndex),
      voice: voiceFor(item),
      ...withMarks(marks[cells.length]),
    });
  });
  return cells;
}

// The `before`/`after` marks of one item, only where it has some, so a chart
// with no repeats renders exactly as before.
function withMarks(around) {
  if (!around) return {};
  const out = {};
  if (around.before.length) out.before = around.before;
  if (around.after.length) out.after = around.after;
  return out;
}

// A chord-only (chart) line → a run row when it carries no bar lines (§2.1,
// `run === true`), else a bars row of one cell per measure, drawn between bar
// rules by the adopted CSS. Chart lines carry no words (§4.4). The non-
// interactive `text`/`measures` strings are unchanged; `tokens`/`cells` are the
// additive structured form the interactive arrange chart reads.
function chartRow(line, address) {
  if (line.run) {
    const tokens = [];
    line.measures.forEach((measure, measureIndex) => {
      for (const cell of measureTokens(measure, address, measureIndex)) tokens.push(cell);
    });
    return { type: 'run', text: line.measures.map(measureCell).join(' '), tokens, address };
  }
  return {
    type: 'bars',
    measures: line.measures.map(measureCell),
    cells: line.measures.map((measure, measureIndex) => measureTokens(measure, address, measureIndex, onTheRule())),
    // What each measure draws on its bar lines (spec §3): present only on a row
    // that has a repeat, an ending or a group's count.
    ...(line.measures.some((measure) => measure.items.some(onTheRule()))
      ? { marks: line.measures.map(measureMarks) }
      : {}),
    // The running bar number and whether an anchor is stated on each measure
    // (cifra.md §2.8, set by the reader's `numberBars` on chart lines): the
    // screen-reader reading leads a stated measure with "bar N:" (§5), and a
    // sung line is never numbered. Absent on a sung song, so default to unstated.
    numbers: line.measures.map((measure) => ({
      number: measure.number ?? null,
      stated: measure.stated ?? false,
    })),
    address,
  };
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

// A notes part's text → its paragraphs: split on runs of blank lines (a line
// empty or only whitespace), each paragraph's lines kept with their `\n` and
// leading spaces (spec §1.3). Notes are free text shown as written and never
// interpreted (spec §1.9): no Markdown is read here or anywhere in the chart.
function notesParagraphs(text) {
  const paragraphs = [];
  let current = [];
  for (const line of String(text ?? '').split('\n')) {
    if (line.trim() === '') {
      if (current.length) paragraphs.push(current.join('\n'));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) paragraphs.push(current.join('\n'));
  return paragraphs;
}

/**
 * Turn a parsed cifra.md song model into an ordered list of chart render rows.
 *
 * A named section yields a section-name row (the pre-heading section's name is
 * the empty string and yields none); each `music` body part yields one content
 * row per line — a sung row, a bars row, a run row, a words row or a gap row —
 * carrying its stable `{ section, part, line }` address. The chart draws the
 * whole body in document order (DIRECTION §3.7): a `notes` part yields one notes
 * row of its paragraphs, in its place among the section's fences (cifra.md
 * §1.9), and a `verbatim` fence yields one verbatim row of its text whole, both
 * addressed `{ section, part }`.
 *
 * With `markEmpty` (the reading view only, songs.empty_states Decision 3), a
 * named section whose body draws nothing but gaps is followed by one `empty`
 * row, right after its section-name row (workflow 2 §Nothing written yet); the
 * unnamed leading section never gets one.
 *
 * @param {object} [model]  the reader's plain-object model
 * @param {{ markEmpty?: boolean }} [options]
 * @returns {Array<object>} render rows in document order
 */
export function chartRows(model, { markEmpty = false } = {}) {
  const rows = [];
  const sections = model?.sections ?? [];
  sections.forEach((section, sectionIndex) => {
    // A count at the end of a heading plays the whole section that many times
    // (spec §3.3, §1.7.4); it is drawn beside the name.
    if (section.name) rows.push({ type: 'section', name: section.name, ...(section.times ? { times: section.times } : {}) });
    const start = rows.length;
    (section.body ?? []).forEach((part, partIndex) => {
      if (part.type === 'notes') {
        const paragraphs = notesParagraphs(part.text);
        if (paragraphs.length) rows.push({ type: 'notes', paragraphs, address: { section: sectionIndex, part: partIndex } });
        return;
      }
      if (part.type === 'verbatim') {
        rows.push({ type: 'verbatim', info: part.info ?? '', text: part.text ?? '', address: { section: sectionIndex, part: partIndex } });
        return;
      }
      if (part.type !== 'music') return;
      (part.lines ?? []).forEach((line, lineIndex) => {
        rows.push(rowForLine(line, { section: sectionIndex, part: partIndex, line: lineIndex }));
      });
    });
    alignBars(rows, start);
    if (markEmpty && section.name && !hasContent(rows.slice(start))) {
      rows.splice(start, 0, { type: 'empty' });
    }
  });
  return rows;
}

// How a measure with `count` chords fills `width` columns: evenly where the
// count divides, the remainder on its last chord where it does not; an empty
// measure takes none (it spans the whole width as one blank cell).
function spansFor(count, width) {
  if (count === 0) return [];
  const base = Math.floor(width / count);
  const remainder = width - base * count;
  return Array.from({ length: count }, (_, j) => base + (j === count - 1 ? remainder : 0));
}

// Line the measures of a section's chart lines up in columns, as on a written
// chart, so the third bar of one line sits over the third bar of the next
// (Explore Chords' chart-layout, DESIGN.md §2.6). A block is a run of bars rows
// with nothing but blank lines between them; every bars row in it shares one
// `grid` — `widths[m]`, the most chords any of its lines puts in measure `m`,
// and `columns`, their sum — and carries `spans`, the columns each of its cells
// covers, so a bar split two ways reads as two half-width cells under the bars
// around it. A sung line joins no grid: its phrases have nothing to do with the
// next line's, and padding them to a column would only spread the words. The
// blank lines inside a block carry the grid too, so the view can keep them in it.
function alignBars(rows, start) {
  let i = start;
  while (i < rows.length) {
    if (rows[i].type !== 'bars') {
      i += 1;
      continue;
    }
    let last = i;
    for (let j = i; j < rows.length && (rows[j].type === 'bars' || rows[j].type === 'gap'); j += 1) {
      if (rows[j].type === 'bars') last = j;
    }
    const block = rows.slice(i, last + 1);
    const widths = [];
    for (const row of block) {
      if (row.type !== 'bars') continue;
      row.cells.forEach((cells, m) => {
        widths[m] = Math.max(widths[m] ?? 1, cells.length);
      });
    }
    const grid = { widths, columns: widths.reduce((sum, w) => sum + w, 0) };
    for (const row of block) {
      row.grid = grid;
      if (row.type === 'bars') row.spans = row.cells.map((cells, m) => spansFor(cells.length, widths[m]));
    }
    i = last + 1;
  }
}

// Whether any of these rows draws something besides a section name or a gap.
function hasContent(rows) {
  return rows.some((row) => row.type !== 'section' && row.type !== 'gap' && row.type !== 'empty');
}

/**
 * Whether a song has nothing written to read (workflow 2 §Nothing written yet,
 * L118-120): no section holds a bar, a sung line or a note, and nothing comes
 * before its first section — the chart would draw only section names and gaps.
 * The title and properties are not content.
 *
 * @param {object} [model]  the reader's plain-object model
 * @returns {boolean}
 */
export function isEmptySong(model) {
  return !hasContent(chartRows(model));
}
