// Unit — the Add-section insertion point (songs.editor_section_after_voicings).
// `sectionInsertPos(text)` returns the end of the chart: the offset just before
// the first rule that opens the voicings part (net of the blank line(s) before
// it), or the document end when there is no rule. Pins spec §1.5/§1.6 (the two
// parts, and the rule as a hyphens-only line outside a fence — the parser
// boundary js/src/parse.js:30). Fixtures are purpose-written songs.

import { describe, it, expect } from 'vitest';
import { sectionInsertPos } from './section-insert.js';

describe('sectionInsertPos', () => {
  it('returns the end of the chart, before the appendix rule (net of the blank line before it)', () => {
    // chart ... ``` \n | \n (blank) | --- | ... voicings. The section must land
    // right after the chart's last content line, before the blank + the rule.
    const chart = '# Lua Nova\n\n## Primeira Parte\n```\nG  D\n```\n';
    const text = `${chart}\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- G: 320003\n`;
    expect(sectionInsertPos(text)).toBe(chart.length);
    // Spec §1.6: the returned offset sits at the start of the blank line that
    // precedes the rule — not at the rule, and not inside the chart content.
    expect(text.slice(sectionInsertPos(text))).toBe('\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- G: 320003\n');
  });

  it('returns the document end when the song has no rule', () => {
    const text = '# Lua Nova\n\n## Primeira Parte\n```\nG  D\n```\n';
    expect(sectionInsertPos(text)).toBe(text.length);
  });

  it('ignores a line of hyphens inside a music fence (spec §1.6 — not a rule)', () => {
    // The only hyphen run sits inside a ``` music fence, so it opens no appendix.
    const text = '# Lua Nova\n```\nG  D\n---\nC  G\n```\n';
    expect(sectionInsertPos(text)).toBe(text.length);
  });

  it('ignores a line of hyphens inside a ```tab verbatim fence (spec §1.6 — not a rule)', () => {
    const text = '# Lua Nova\n```tab\ne|---0---|\n-------\n```\n';
    expect(sectionInsertPos(text)).toBe(text.length);
  });

  it('inserts before the FIRST rule when more than one is present (a later rule divides nothing, §1.6)', () => {
    const chart = '# Lua Nova\n## A\n```\nG\n```\n';
    const text = `${chart}\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- G: 320003\n\n---\n\n## Voicings: D A D G B E\n- G: 5x0003\n`;
    expect(sectionInsertPos(text)).toBe(chart.length);
  });

  it('recognises a rule with up to three leading spaces (spec §1.3/§1.6)', () => {
    const chart = '# Lua Nova\n## A\n```\nG\n```\n';
    const text = `${chart}\n   ---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- G: 320003\n`;
    expect(sectionInsertPos(text)).toBe(chart.length);
  });

  it('recognises a longer run of hyphens as the rule (spec §1.6 — three or more)', () => {
    const chart = '# Lua Nova\n## A\n```\nG\n```\n';
    const text = `${chart}\n----------\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- G: 320003\n`;
    expect(sectionInsertPos(text)).toBe(chart.length);
  });

  it('backs up over multiple blank lines before the rule, landing right after the last content line', () => {
    const chart = '# Lua Nova\n## A\n```\nG\n```\n';
    const text = `${chart}\n\n\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- G: 320003\n`;
    expect(sectionInsertPos(text)).toBe(chart.length);
  });

  it('returns the rule offset itself when no blank line precedes it', () => {
    const chart = '# Lua Nova\n## A\n```\nG\n```\n';
    const text = `${chart}---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- G: 320003\n`;
    expect(sectionInsertPos(text)).toBe(chart.length);
  });

  it('returns 0 for the empty buffer', () => {
    expect(sectionInsertPos('')).toBe(0);
  });
});
