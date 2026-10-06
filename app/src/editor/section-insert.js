// Where the editor's Add-section command must insert a new section
// (songs.editor_section_after_voicings). A cifra.md document is two parts split
// by the first rule (spec §1.5): the **chart** (sections, chords and lyrics in
// fences) before it, the **voicings part** after it. A `##` heading placed after
// the rule is read as a voicing block, not a section, and the canonical writer
// drops a bare one on save (spec §7.2, §8.2; corpus/29-voicings-part) — so Add
// section must land the new section in the chart, before the rule that opens the
// appendix, not at the document end (editor.md AC 4 said "at the end"; that was
// the defect this corrects).
//
// Pure: no React, no CodeMirror. The editor turns the returned offset into a
// CodeMirror transaction. Fence recognition reuses cifra-md's own primitives,
// not a second grammar (editor Decision 8).

import { fenceOpen, closesFence } from 'cifra-md';

// The rule, exactly as the parser defines it (spec §1.6; js/src/parse.js:30
// `const RULE = /^ {0,3}-{3,}$/`): three or more `-` and nothing else, after up
// to three spaces. NOT the broad CommonMark thematic break (`-`/`*`/`_`) — only
// a hyphen rule opens the voicings part, so only it is the boundary (Decision
// 2). Kept local to the editor, the way cifra-syntax.js keeps its own line
// regexes, rather than exporting a one-line regex from cifra-md across repos.
const RULE = /^ {0,3}-{3,}$/;

/**
 * The character offset at which the editor's Add section must insert a new
 * section: the end of the chart — just before the first rule that opens the
 * voicings part (net of the blank line(s) that precede the rule), or
 * `text.length` when the song has no such rule.
 *
 * Fence-aware: a line of hyphens inside a music or verbatim fence is not a rule
 * (spec §1.6), so it never counts as the boundary. The first rule outside a
 * fence wins; a later rule "divides nothing" (spec §1.6).
 *
 * @param {string} text the buffer text
 * @returns {number} the insertion offset
 */
export function sectionInsertPos(text) {
  const lines = text.split('\n');

  // The start offset of each line (line i spans [starts[i], starts[i+1]-1),
  // with the '\n' that `split` consumed counted back in).
  const starts = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    starts.push(offset);
    offset += lines[i].length + 1;
  }

  // Strip a trailing '\r' so a CRLF buffer still recognises a rule / a blank.
  const clean = (raw) => (raw.endsWith('\r') ? raw.slice(0, -1) : raw);

  let fence = null; // the open fence's { char, length } while inside one
  let ruleIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = clean(lines[i]);
    if (fence) {
      if (closesFence(line, fence)) fence = null;
      continue;
    }
    if (RULE.test(line)) {
      ruleIndex = i;
      break;
    }
    const open = fenceOpen(line);
    if (open) fence = open;
  }

  if (ruleIndex === -1) return text.length;

  // Back up over the blank line(s) immediately before the rule, so the section
  // lands right after the last chart content; the editor re-creates the blank
  // line that separates the new section from the rule (acceptance criterion 1).
  let i = ruleIndex;
  while (i > 0 && clean(lines[i - 1]) === '') i -= 1;
  return starts[i];
}
