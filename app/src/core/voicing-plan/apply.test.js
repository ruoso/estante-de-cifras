import { describe, it, expect } from 'vitest';
import { parse, write, isCanonical } from 'cifra-md';
import { fromCatalog } from '../instrument.js';
import { analyseSong } from '../song-analysis.js';
import { planVoicings } from './index.js';
import { applyPlan, planIntoNewVariation } from './apply.js';

const guitar = fromCatalog('6guitar');
const uke = fromCatalog('ukulele');

// The §6.2 tuning texts whose §6.3 identity matches the instruments in use.
const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';
const UKE_TUNING = 'G4 C4 E4 A4';

const FENCE = '```';
// A whole song: a chart in one fenced music part, then optional voicings parts.
// Fixtures are purpose-written, never anyone's copyrighted words.
const song = (chart, ...voicings) =>
  ['# Song', '## A', FENCE, chart, FENCE, ...(voicings.length ? ['', '---', '', ...voicings] : [])].join('\n') +
  '\n';

const block = (doc, label) => doc.blocks.find((b) => b.label === label);
const keysOf = (blk) => new Set(blk.voicings.map((v) => v.key));

describe('the plan into a new variation', () => {
  it('writes the plan under a new variation, leaving the one in use untouched, canonical', () => {
    // Pins workflow 5 §The wizard ("into a new variation first") and
    // cifra.md §8.5.4/§8.5.5, §7.3 (variations do not inherit).
    const doc = parse(song('C | G | Am', '## Voicings: E2 A2 D3 G3 B3 E4', '- C: x32010'));
    const result = planVoicings('smoothest', doc, guitar, { dialect: 'brazilian' });

    const next = planIntoNewVariation(doc, result, { tuning: GUITAR_TUNING, name: 'Wizard' });
    const text = write(next);
    expect(isCanonical(text)).toBe(true);

    const reparsed = parse(text);
    // The default (in-use) variation is untouched: still just the author's C.
    const def = block(reparsed, '');
    expect(def.voicings.map((v) => v.key)).toEqual(['C']);
    expect(def.voicings[0].frets).toEqual(['x', 3, 2, 0, 1, 0]);
    // The plan lands in the new Wizard block: a shape for every chord.
    const wiz = block(reparsed, 'Wizard');
    expect(wiz).toBeTruthy();
    expect(keysOf(wiz)).toEqual(new Set(['C', 'G', 'Am']));
  });

  it('refuses a name already in use for the tuning (addVariation throws)', () => {
    // Workflow 5 §Variations: "a name already in use is refused."
    const doc = parse(song('C', '## Barre: E2 A2 D3 G3 B3 E4', '- C: 8-10-10-9-8-8'));
    const result = planVoicings('smoothest', doc, guitar, { dialect: 'brazilian' });
    expect(() =>
      planIntoNewVariation(doc, result, { tuning: GUITAR_TUNING, name: 'Barre' }),
    ).toThrow();
  });

  it('leaves a chord the planner could not voice out of the song (§8.5.4 / I4)', () => {
    // C13#11 has no shape on a ukulele; it is reported missing, not written —
    // it falls to the app default on read, never persisted.
    const doc = parse(song('C | C13#11'));
    const result = planVoicings('smoothest', doc, uke, { dialect: 'brazilian' });
    expect(result.missing.length).toBeGreaterThan(0);

    const next = planIntoNewVariation(doc, result, { tuning: UKE_TUNING, name: 'Wizard' });
    expect(block(next, 'Wizard').voicings.map((v) => v.key)).toEqual(['C']);
  });

  it("writes the app's thumb 0 as cifra.md 'T' (§7.5.1)", () => {
    // The bridge inverts voicings.js:withSongFingers on write: finger 0 → 'T'.
    const doc = parse(song('G'));
    const reading = analyseSong(doc, 'brazilian');
    const planResult = {
      reading,
      shapes: new Map([[0, { frets: [3, 2, 0, 0, 0, 3], fingers: [0, 2, null, null, null, 3] }]]),
      missing: [],
      unchanged: [],
    };

    const next = planIntoNewVariation(doc, planResult, { tuning: GUITAR_TUNING, name: 'Thumb' });
    const text = write(next);
    expect(isCanonical(text)).toBe(true);

    const g = block(parse(text), 'Thumb').voicings.find((v) => v.key === 'G');
    expect(g.frets).toEqual([3, 2, 0, 0, 0, 3]);
    expect(g.fingers).toEqual(['T', 2, null, null, null, 3]);
  });
});

describe('the plan over this one (applyPlan)', () => {
  it('writes into the variation in use rather than a new one', () => {
    // The "over this one second" path: the plan lands in the default variation,
    // no new block is made.
    const doc = parse(song('C | G', '## Voicings: E2 A2 D3 G3 B3 E4', '- C: x32010'));
    const result = planVoicings('smoothest', doc, guitar, { dialect: 'brazilian' });

    const next = applyPlan(doc, result, { tuning: GUITAR_TUNING, variation: '' });
    const text = write(next);
    expect(isCanonical(text)).toBe(true);

    const reparsed = parse(text);
    const def = block(reparsed, '');
    expect(keysOf(def)).toEqual(new Set(['C', 'G']));
    // Still one block for this tuning — nothing new was created.
    expect(reparsed.blocks.filter((b) => b.tuning.id === def.tuning.id)).toHaveLength(1);
  });
});
