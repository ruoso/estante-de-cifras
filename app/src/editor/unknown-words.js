// What the editor flags in a song as it is typed (songs.unknown_tokens_loud;
// workflow 4 §Editing, workflow 3 §When it looks like another format): every
// word inside the music the reader does not read as a chord (spec §2.9), and a
// bracket heading whose name reads as a chord — almost certainly a chord written
// in another format (§1.7.2). The reader decides both — `unknownTokens` and the
// model's sections, `isChord` in the song's own notation — and this module only
// locates them in the text (editor Decision 8: never a second grammar).
//
// Pure: no React, no CodeMirror.

import { parse, unknownTokens, isChord, fenceOpen, closesFence, mdHeading } from 'cifra-md';
import { songDialect } from '../core/notation/dialects.js';

/**
 * Whether a path is a song a person is writing — a `*.cifra.md` file, or a new
 * song with no path yet (Decision 6). README.md, setlists and any other file
 * the raw editor opens get no marks and no notice.
 *
 * @param {string|null|undefined} path
 * @returns {boolean}
 */
export function isSongPath(path) {
  return !path || path.endsWith('.cifra.md');
}

// The start offset of each line of `text` (lines split on \n, as CodeMirror
// joins its document).
function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}

/**
 * The document ranges of every unknown token of a song, in source order. A
 * token whose text is not where the reader says it is (a text the text layer
 * normalises, spec §1.3) is not marked rather than marked in the wrong place.
 *
 * @param {string} text
 * @returns {{from: number, to: number}[]}
 */
export function unknownMarks(text) {
  const starts = lineStarts(text);
  const out = [];
  for (const tok of unknownTokens(text)) {
    const start = starts[tok.line - 1];
    if (start === undefined) continue;
    const from = start + tok.column;
    const to = from + tok.text.length;
    if (text.slice(from, to) === tok.text) out.push({ from, to });
  }
  return out;
}

// A bracket heading's name as written on a line (§1.7.2), or null.
const BRACKET = /^ *\[ *([^\]]*?) *\]/;
const firstWord = (name) => name.trim().split(/ +/)[0] ?? '';

/**
 * The bracket headings whose name — its first word, before any count — reads
 * as a chord in the song's notation: `[{line, name}]`, each at the first fenced
 * source line (after the previous one found) whose bracket heading carries that
 * name. `[A]` is flagged too: a part named *A* is legitimate, and the notice
 * only says it looks like a chord (workflow 3).
 *
 * @param {string} text
 * @returns {{line: number, name: string}[]}
 */
export function chordBracketHeadings(text) {
  const doc = parse(text);
  const dialect = songDialect(doc);
  const names = doc.sections
    .filter((s) => s.heading === 'bracket')
    .map((s) => firstWord(s.name))
    .filter((name) => name && isChord(name, dialect));
  if (names.length === 0) return [];

  // The bracket headings of the music fences, in order (a fence with another
  // info string is verbatim, so its lines are no headings).
  const lines = text.split('\n');
  const candidates = [];
  let fence = null;
  let music = false;
  lines.forEach((raw, idx) => {
    if (fence) {
      if (closesFence(raw, fence)) {
        fence = null;
        return;
      }
      if (!music) return;
      // A bracket heading may follow another on its line (`[Intro][Am]`).
      let rest = raw;
      let m;
      while ((m = BRACKET.exec(rest)) && m[1]) {
        candidates.push({ line: idx + 1, name: firstWord(m[1]) });
        rest = rest.slice(m[0].length);
      }
      return;
    }
    const fo = fenceOpen(raw);
    if (fo) {
      fence = { char: fo.char, length: fo.length };
      music = !fo.info || fo.info === 'cifra';
    }
  });

  const out = [];
  let k = 0;
  for (const name of names) {
    while (k < candidates.length && candidates[k].name !== name) k += 1;
    if (k === candidates.length) break;
    out.push({ line: candidates[k].line, name });
    k += 1;
  }
  return out;
}

// A list item, as the reader defines one (js/src/parse.js LIST_ITEM): the
// title's details and the voicings' lines, never notes to check.
const LIST_ITEM = /^ {0,3}[-*+](?: +(.*))?$/;
// A bracketed name followed at once by a letter: `[G]Walk` (ChordPro's way).
const BRACKET_IN_WORDS = /\[ *([^\]\s]+) *\](?=\p{L})/gu;

/**
 * The lines outside any fence — notes, to the reader (spec §1.9) — holding a
 * chord in brackets followed at once by a letter, `[G]Walk the road`: a chord
 * written inside the words, which the format does not read (workflow 3 §When
 * it looks like another format; songs.format_help Decision 3). The name is a
 * chord in the song's notation, as for `chordBracketHeadings`; `[Chorus]Walk`,
 * `[G] walk` and `[G]` alone are words. A `#` heading and a list item are not
 * notes, so they are not checked.
 *
 * @param {string} text
 * @returns {{line: number}[]}
 */
export function bracketChordsInNotes(text) {
  if (!text.includes('[')) return [];
  const dialect = songDialect(parse(text));
  const out = [];
  let fence = null;
  text.split('\n').forEach((raw, idx) => {
    if (fence) {
      if (closesFence(raw, fence)) fence = null;
      return;
    }
    const fo = fenceOpen(raw);
    if (fo) {
      fence = { char: fo.char, length: fo.length };
      return;
    }
    if (mdHeading(raw) || LIST_ITEM.test(raw)) return;
    for (const m of raw.matchAll(BRACKET_IN_WORDS)) {
      if (isChord(m[1], dialect)) {
        out.push({ line: idx + 1 });
        return;
      }
    }
  });
  return out;
}

/**
 * The line of the reader's *chords outside the music* report — a song with no
 * music fence holding a line that reads as chords (spec §1.9, the format's
 * MUST-report; songs.format_help Decision 2) — or null.
 *
 * @param {{diagnostics: {code: string, line: number}[]}} parsed the reader's model
 * @returns {number|null}
 */
export function unfencedChordsLine(parsed) {
  return parsed.diagnostics.find((d) => d.code === 'unfenced-music')?.line ?? null;
}

/**
 * The notice the editor shows, if any (workflow 3 §When it looks like another
 * format; songs.format_help Decision 1): one at a time, chords in brackets
 * first — bracket headings and notes together, the first line that counts —
 * then chords outside the music. A line counts once the cursor is not on it,
 * or at once when it was pasted. A dismissed kind is gone for the rest of the
 * editing (Decision 4); `topic` is the help's topic that answers the case.
 *
 * @param {object} args
 * @param {string} args.text
 * @param {object} [args.parsed] the reader's model of `text` (parsed if absent)
 * @param {number} args.cursorLine
 * @param {Set<number>} [args.pastedLines]
 * @param {Set<string>} [args.dismissed] the kinds sent away
 * @returns {{kind: 'bracket'|'unfenced', line: number, topic: string}|null}
 */
export function formatHint({ text, parsed, cursorLine, pastedLines = new Set(), dismissed = new Set() }) {
  const counts = (line) => line !== cursorLine || pastedLines.has(line);
  if (!dismissed.has('bracket')) {
    const lines = [
      ...chordBracketHeadings(text).map((h) => h.line),
      ...bracketChordsInNotes(text).map((h) => h.line),
    ].sort((a, b) => a - b);
    const line = lines.find(counts);
    if (line !== undefined) return { kind: 'bracket', line, topic: 'chords' };
  }
  if (!dismissed.has('unfenced')) {
    const line = unfencedChordsLine(parsed ?? parse(text));
    if (line !== null && counts(line)) return { kind: 'unfenced', line, topic: 'parts' };
  }
  return null;
}
