// Unit — the editor's save gate (songs.save_gate_dropped_section): which of the
// reader's diagnostics stop a save, for which path, and which stop message each
// shows. Purpose-written songs run through cifra-md's `parse`. Pins workflow 4
// §Normalising (a line normalising would drop stops the save), spec §7.2 (a
// heading after the rule needs a tuning), §7.4 (nothing before the first
// block), §8.2 (the writer drops what the reader skips), and save_sheet
// Decision 3 (a marker line stops every file).

import { describe, it, expect } from 'vitest';
import { parse } from 'cifra-md';
import { saveBlockers, stopMessageKey } from './save-blockers.js';

const CHART = ['# Tarde Clara', '', '## Primeira Parte', '```', 'G  D', '```', ''];
const song = (...after) => [...CHART, ...after].join('\n');
const blockersOf = (text, path = 'x.cifra.md') => saveBlockers(parse(text).diagnostics, path);

// A section typed below the rule out of Markdown habit; the heading is line 10.
const SECTION_AFTER_RULE = song('---', '', '## Refrão', '```', 'C  G', '```', '');

describe('saveBlockers', () => {
  it('stops on a section typed after the rule, at its heading (spec §7.2)', () => {
    const blockers = blockersOf(SECTION_AFTER_RULE);
    expect(blockers.map((d) => [d.code, d.line])).toEqual([['bad-block-heading', 10]]);
    expect(stopMessageKey(blockers[0].code)).toBe('editor.source.afterRuleStop');
  });

  it('stops on a heading after the rule whose colon is not followed by a tuning (spec §7.2)', () => {
    for (const heading of ['## Coda: devagar', '## Voicings: cavaquinho']) {
      const blockers = blockersOf(song('---', '', heading, '- G: 320003', ''));
      expect(blockers.map((d) => d.code)).toEqual(['bad-block-heading']);
      expect(blockers[0].line).toBe(10);
      expect(stopMessageKey(blockers[0].code)).toBe('editor.source.afterRuleStop');
    }
  });

  it('stops on a note line or a voicing before the first block (spec §7.4, §8.2)', () => {
    const notes = blockersOf(song('---', '', 'tocar devagar', '', '## Voicings: E2 A2 D3 G3 B3 E4', '- G: 320003', ''));
    expect(notes.map((d) => [d.code, d.line])).toEqual([['notes-outside-block', 10]]);
    expect(stopMessageKey('notes-outside-block')).toBe('editor.source.afterRuleStop');

    const item = blockersOf(song('---', '', '- G: 320003', '', '## Voicings: E2 A2 D3 G3 B3 E4', '- D: xx0232', ''));
    expect(item.map((d) => [d.code, d.line])).toEqual([['item-outside-block', 10]]);
    expect(stopMessageKey('item-outside-block')).toBe('editor.source.afterRuleStop');
  });

  it('keeps stopping on an unreadable voicing and on a marker line (workflow 4 §Normalising)', () => {
    const bad = blockersOf(song('---', '', '## Voicings: E2 A2 D3 G3 B3 E4', '- Em: 02200', ''));
    expect(bad.map((d) => [d.code, d.line])).toEqual([['bad-voicing', 11]]);
    expect(stopMessageKey('bad-voicing')).toBe('editor.source.voicingStop');

    const marked = blockersOf(['# Tarde Clara', '```', '<<<<<<< ours', 'Am', '=======', 'C', '>>>>>>> theirs', '```'].join('\n'));
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.every((d) => d.code === 'marker-line')).toBe(true);
    expect(marked[0].line).toBe(3);
    expect(stopMessageKey('marker-line')).toBe('editor.source.markerStop');
  });

  it('does not stop on what loses nothing the user wrote: a second rule, a duplicate block, a bad fingering, an unclosed fence', () => {
    const cases = {
      'extra-rule': song('---', '', '## Voicings: E2 A2 D3 G3 B3 E4', '- G: 320003', '', '---', ''),
      'duplicate-block': song(
        '---',
        '',
        '## Voicings: E2 A2 D3 G3 B3 E4',
        '- G: 320003',
        '',
        '## Voicings: E2 A2 D3 G3 B3 E4',
        '- D: xx0232',
        '',
      ),
      'bad-fingering': song('---', '', '## Voicings: E2 A2 D3 G3 B3 E4', '- G: 320003 (99)', ''),
      'unclosed-fence': ['# Tarde Clara', '', '## Primeira Parte', '```', 'G  D', ''].join('\n'),
    };
    for (const [code, text] of Object.entries(cases)) {
      const { diagnostics } = parse(text);
      // The fixture really carries the diagnostic it is about…
      expect(diagnostics.map((d) => d.code)).toContain(code);
      // …and it does not stop the save.
      expect(saveBlockers(diagnostics, 'x.cifra.md')).toEqual([]);
    }
  });

  it('does not stop a clean song with a voicings appendix', () => {
    expect(blockersOf(song('---', '', '## Voicings: E2 A2 D3 G3 B3 E4', '- G: 320003', '- D: xx0232', ''))).toEqual([]);
  });

  it('stops the dropped-content codes only where the song writer runs; a marker line everywhere (Decision 3)', () => {
    const { diagnostics } = parse(SECTION_AFTER_RULE);
    expect(saveBlockers(diagnostics, 'x.setlist.md')).toEqual([]);
    expect(saveBlockers(diagnostics, 'x.cifra.md').map((d) => d.code)).toEqual(['bad-block-heading']);
    expect(saveBlockers(diagnostics, null).map((d) => d.code)).toEqual(['bad-block-heading']); // a new song
    expect(saveBlockers(diagnostics, undefined).map((d) => d.code)).toEqual(['bad-block-heading']);

    const marked = parse(['# Ensaio', '<<<<<<< ours', '- a.cifra.md', '=======', '- b.cifra.md', '>>>>>>> theirs'].join('\n'));
    const onSetlist = saveBlockers(marked.diagnostics, 'x.setlist.md');
    expect(onSetlist.length).toBeGreaterThan(0);
    expect(onSetlist.every((d) => d.code === 'marker-line')).toBe(true);
  });

  it('puts the earliest blocker first (line order)', () => {
    const text = song(
      '---',
      '',
      '## Voicings: E2 A2 D3 G3 B3 E4',
      '- Em: 02200', // line 11 — bad-voicing
      '',
      '## Refrão', // line 13 — bad-block-heading
      '```',
      'C  G',
      '```',
      '',
    );
    const blockers = blockersOf(text);
    expect(blockers.map((d) => [d.code, d.line])).toEqual([
      ['bad-voicing', 11],
      ['bad-block-heading', 13],
    ]);
    // Already-ordered or not, the gate returns them sorted.
    expect(saveBlockers([...parse(text).diagnostics].reverse(), 'x.cifra.md')[0].line).toBe(11);
  });
});
