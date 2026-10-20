// Unit — the format help's topics and examples (songs.format_help; workflow 3
// §Help with the format L104-235; cifra.md §1.9, §2.9, §7.3). Pins that every
// example in every locale reads as its topic says (Constraint 3), that the
// English copy is the workflow's (Constraint 1), and that Insert lands where
// Add section does (Constraint 4). Fixtures: the help's own purpose-written
// examples (*Moonlit Road*, *The Porch Band*) and purpose-written songs.

import { describe, it, expect } from 'vitest';
import { parse, unknownTokens } from 'cifra-md';

import { FORMAT_TOPICS, exampleInsertion } from './format-help.js';
import en from '../i18n/locales/en.js';
import ptBR from '../i18n/locales/pt-BR.js';
import es419 from '../i18n/locales/es-419.js';
import it_ from '../i18n/locales/it.js';

const LOCALES = { en, 'pt-BR': ptBR, 'es-419': es419, it: it_ };
const topicsOf = (messages) => messages.editor.formatHelp.topics;

// Every chord symbol the reader read, in source order: the chart's, then the
// voicings'.
function chordsRead(model) {
  const out = [];
  for (const section of model.sections) {
    for (const part of section.body) {
      if (part.type !== 'music') continue;
      for (const line of part.lines) {
        for (const m of line.measures ?? []) {
          for (const item of m.items) if (item.type === 'chord') out.push(item.symbol);
        }
      }
    }
  }
  for (const block of model.blocks ?? []) for (const v of block.voicings) out.push(v.symbol);
  return out;
}

const sung = (model) =>
  model.sections.some((s) => s.body.some((p) => p.type === 'music' && p.lines.some((l) => l.kind === 'sung')));

describe('FORMAT_TOPICS', () => {
  it('the eight topics in order, Copy for the title and the voicings, Insert for the parts', () => {
    expect(FORMAT_TOPICS).toEqual([
      { id: 'title', action: 'copy' },
      { id: 'parts', action: 'insert' },
      { id: 'chords', action: 'insert' },
      { id: 'bars', action: 'insert' },
      { id: 'repeats', action: 'insert' },
      { id: 'bracketNames', action: 'insert' },
      { id: 'notes', action: 'insert' },
      { id: 'voicings', action: 'copy' },
    ]);
  });
});

describe("every locale's examples read as their topic says (Constraint 3; workflow 3 L229-235)", () => {
  const english = topicsOf(en);
  for (const [id, messages] of Object.entries(LOCALES)) {
    describe(id, () => {
      const topics = topicsOf(messages);
      for (const { id: topic } of FORMAT_TOPICS) {
        it(`${topic}: no diagnostic, no unknown token, the English chords in order`, () => {
          const { example } = topics[topic];
          const model = parse(example);
          expect(model.diagnostics).toEqual([]);
          expect(unknownTokens(example)).toEqual([]);
          expect(chordsRead(model)).toEqual(chordsRead(parse(english[topic].example)));
        });
      }

      it('parts and chords are sung', () => {
        expect(sung(parse(topics.parts.example))).toBe(true);
        expect(sung(parse(topics.chords.example))).toBe(true);
      });

      it('the bracket names example opens a part named by its word for Chorus', () => {
        const chorus = parse(topics.chords.example).sections[0].name;
        const [section] = parse(topics.bracketNames.example).sections;
        expect(section).toMatchObject({ heading: 'bracket', name: chorus });
        expect(topics.bracketNames.text).toContain(`[${chorus}]`);
      });

      it('the voicings sit under the default label, the marks untranslated (cifra.md §7.3)', () => {
        const model = parse(topics.voicings.example);
        expect(model.blocks).toHaveLength(1);
        expect(model.blocks[0].label).toBe('');
        expect(model.blocks[0].tuning.text).toBe('E2 A2 D3 G3 B3 E4');
        expect(topics.voicings.example).toContain('## Voicings: ');
      });

      it('the title example keeps the property keys', () => {
        const model = parse(topics.title.example);
        expect(model.title).toBeTruthy();
        expect(model.properties.map((p) => p.key)).toEqual(['artist', 'key']);
      });
    });
  }
});

describe("the English copy is the workflow's (Constraint 1; workflow 3 L118-211)", () => {
  const help = en.editor.formatHelp;
  const F = '```';

  it('the intro and the eight headings', () => {
    expect(help.title).toBe('Writing a song');
    expect(help.intro).toBe('A song here is plain text. A few marks tell the app what is music.');
    expect(FORMAT_TOPICS.map(({ id }) => help.topics[id].heading)).toEqual([
      '1. The title and details',
      '2. Parts and the music fence',
      '3. Chords over words',
      '4. Bars',
      '5. Repeats',
      '6. Part names inside the music',
      '7. Notes',
      '8. How to play a chord',
    ]);
  });

  it('the eight examples', () => {
    expect(FORMAT_TOPICS.map(({ id }) => help.topics[id].example)).toEqual([
      '# Moonlit Road\n- artist: The Porch Band\n- key: G',
      `## Verse\n${F}\nG                C\nWalk the moonlit road\n${F}`,
      `## Chorus\n${F}\nC          G\nSing it slow\nD             G\nAll the way home\n${F}`,
      `## Intro\n${F}\nG | % | C | D\n${F}`,
      `## Bridge\n${F}\n|: Em | C :| x3\n|: G | C |1. D | G :|2. D | D |\n${F}`,
      `${F}\n[Chorus]\nG | C | D | G\n${F}`,
      `## Verse 2\nSofter the second time.\n${F}\n// guitar alone\nG | C | D | G\n${F}`,
      '---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- G: 320003\n- C: x32010',
    ]);
  });

  it('the actions and the refused copy', () => {
    expect(help.insert).toBe('Insert');
    expect(help.copy).toBe('Copy');
    expect(help.copied).toBe('Copied');
    expect(help.copyFailed).toBe('Could not copy — select the example instead');
    expect(en.editor.source.showMeHow).toBe('Show me how');
  });
});

describe('Insert lands where Add section does (Constraint 4)', () => {
  const bars = en.editor.formatHelp.topics.bars.example;
  const apply = (text, { from, insert }) => text.slice(0, from) + insert + text.slice(from);

  it('on an empty text: the example alone, the cursor at its end', () => {
    const change = exampleInsertion('', bars);
    expect(change).toEqual({ from: 0, insert: bars, cursor: bars.length });
  });

  it('on a song ending in a fence: after it, a blank line between', () => {
    const text = '# Noite Calma\n\n## Verse\n```\nG | C |\n```\n';
    const change = exampleInsertion(text, bars);
    const result = apply(text, change);
    expect(result).toBe(`${text}\n${bars}`);
    expect(result.slice(0, change.cursor)).toBe(`${text}\n${bars}`);
    expect(parse(result).sections.map((s) => s.name)).toEqual(['Verse', 'Intro']);
  });

  it('on a song with a voicings appendix: before the ---, the voicings kept', () => {
    const chart = '# Noite Calma\n\n## Verse\n```\nG | C |\n```\n';
    const appendix = '\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- G: 320003\n';
    const text = chart + appendix;
    const change = exampleInsertion(text, bars);
    expect(change.from).toBe(chart.length);
    expect(change.from).toBeLessThan(text.indexOf('---'));
    const result = apply(text, change);
    expect(result.slice(0, change.cursor)).toBe(`${chart}\n${bars}`);
    const model = parse(result);
    expect(model.diagnostics).toEqual([]);
    expect(model.sections.map((s) => s.name)).toEqual(['Verse', 'Intro']);
    expect(model.blocks[0].voicings.map((v) => v.symbol)).toEqual(['G']);
  });
});
