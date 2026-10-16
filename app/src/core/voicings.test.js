import { describe, it, expect } from 'vitest';
import { parse } from 'cifra-md';
import { parseChord } from './notation/parse.js';
import { fromCatalog } from './instrument.js';
import { searchFingerings } from './search.js';
import { defaultVoicing, resolveSongVoicings, unvoiceableKeys } from './voicings.js';

const guitar = fromCatalog('6guitar');
const uke = fromCatalog('ukulele');

// The §6.2 tuning text whose §6.3 identity matches the standard guitar, so a
// voicings block and a my-shape both land on this instrument.
const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';

const FENCE = '```';
// A whole song: a chart in one music part, then (optionally) a voicings part.
const song = (chart, ...voicings) =>
  ['# Song', '## A', FENCE, chart, FENCE, ...(voicings.length ? ['', '---', '', ...voicings] : [])].join('\n') +
  '\n';

// A my-shape leaf as the Worker surfaces it on entry.shapes.
const shape = (chord, shorthand, tuning = GUITAR_TUNING) => ({ tuning, chord, shorthand });

describe('the default voicing', () => {
  it('is the open-position shape when there is one', () => {
    // Exactly what the explorer shows first, so "if you do not choose, you get
    // what you would have seen first".
    const chord = parseChord('C').chord;
    const shown = searchFingerings(chord, guitar).groups[0].fingerings[0];
    const chosen = defaultVoicing(chord, guitar);
    expect(chosen.shorthand).toBe(shown.shorthand);
    expect(chosen.position).toBe(0);
  });

  it('falls to the lowest position that has anything when nothing is open', () => {
    // No open-string voicing exists for this; the default must still be the
    // lowest group, not nothing.
    const chord = parseChord('F#m7b5').chord;
    const result = searchFingerings(chord, guitar);
    const chosen = defaultVoicing(chord, guitar);
    expect(chosen).not.toBeNull();
    expect(chosen.position).toBe(result.groups[0].position);
    expect(chosen.shorthand).toBe(result.groups[0].fingerings[0].shorthand);
  });

  it('is null when the search finds nothing', () => {
    expect(defaultVoicing(parseChord('C13#11').chord, uke)).toBeNull();
  });
});

// resolveSongVoicings — the three-level resolver. Each case pins workflow 2
// §"Where a chord's shape comes from" and cifra.md §7.6. Fixtures are
// purpose-written, never anyone's copyrighted words (no-song-text rule).
describe("resolveSongVoicings — the song's choice, then my shape, then the default", () => {
  it("takes the song's choice for the tuning and variation in use (§7.6 step 1; wf2 L90)", () => {
    const parsed = parse(song('C', '## Voicings: E2 A2 D3 G3 B3 E4', '- C: x32010'));
    const r = resolveSongVoicings(parsed, guitar);
    expect(r.get('C').source).toBe('song');
    expect(r.get('C').fingering.frets).toEqual(['x', 3, 2, 0, 1, 0]);
    expect(r.get('C').fingering.shorthand).toBe('x32010');
  });

  it("keeps the song's own fingering when it gave one (§7.5.1; Decision)", () => {
    const parsed = parse(song('G', '## Voicings: E2 A2 D3 G3 B3 E4', '- G: 320003 (3 2 - - - 4)'));
    const { source, fingering } = resolveSongVoicings(parsed, guitar).get('G');
    expect(source).toBe('song');
    expect(fingering.frets).toEqual([3, 2, 0, 0, 0, 3]);
    // cifra.md's `int|'T'|null` maps to the app's `1-4|0(thumb)|null`; the
    // teacher's choice is kept, not re-derived.
    expect(fingering.fingers).toEqual([3, 2, null, null, null, 4]);
  });

  it("takes my shape when the song chose none (§7.6 step 2; wf2 L77-79, L93)", () => {
    const parsed = parse(song('Am')); // no voicings part at all
    const r = resolveSongVoicings(parsed, guitar, { shapes: [shape('Am', 'x02210')] });
    expect(r.get('Am').source).toBe('yours');
    expect(r.get('Am').fingering.shorthand).toBe('x02210');
  });

  it('matches my shape by chord, not spelling — a Cmaj7 star serves a C7M song (wf2 L106)', () => {
    const parsed = parse(song('C7M'));
    const r = resolveSongVoicings(parsed, guitar, { shapes: [shape('Cmaj7', 'x32000')] });
    expect(r.get('C7M').source).toBe('yours');
    expect(r.get('C7M').fingering.shorthand).toBe('x32000');
  });

  it("takes the app's default when neither a choice nor a star (§7.6 step 3; wf2 L96)", () => {
    const parsed = parse(song('C'));
    const r = resolveSongVoicings(parsed, guitar);
    expect(r.get('C').source).toBe('default');
    expect(r.get('C').fingering.shorthand).toBe(defaultVoicing(parseChord('C').chord, guitar).shorthand);
  });

  it('holds the three-level order: song, then yours, then default (wf2 L90-97)', () => {
    const voiced = ['## Voicings: E2 A2 D3 G3 B3 E4', '- C: x32010'];
    const star = [shape('C', 'x-x-10-9-8-8')];

    // All three in hand → the song wins.
    expect(resolveSongVoicings(parse(song('C', ...voiced)), guitar, { shapes: star }).get('C').source).toBe('song');
    // Drop the song's voicing → my shape wins.
    expect(resolveSongVoicings(parse(song('C')), guitar, { shapes: star }).get('C').source).toBe('yours');
    // Drop the star too → the default.
    expect(resolveSongVoicings(parse(song('C')), guitar).get('C').source).toBe('default');
  });

  it('never falls back across a key, a variation or a tuning (§7.6 L224-229)', () => {
    const parsed = parse(
      song(
        'Cm Cm[2] Bm A',
        '## Voicings: E2 A2 D3 G3 B3 E4',
        '- Cm: x35543',
        '',
        '## Up: E2 A2 D3 G3 B3 E4',
        '- Bm: x24432',
        '',
        '## Voicings: G4 C4 E4 A4',
        '- A: 2100',
      ),
    );
    const r = resolveSongVoicings(parsed, guitar); // default variation, guitar tuning
    // Cm is voiced for this tuning and variation.
    expect(r.get('Cm').source).toBe('song');
    expect(r.get('Cm').fingering.shorthand).toBe('x35543');
    // Cm[2] has no shape of its own: it does NOT inherit Cm's — a different key.
    expect(r.get('Cm[2]').source).toBe('default');
    // Bm is voiced only in the 'Up' variation: the default variation does not
    // borrow it.
    expect(r.get('Bm').source).toBe('default');
    // A is voiced only in the ukulele block: a guitar does not borrow it.
    expect(r.get('A').source).toBe('default');
  });

  it("selects the block by the variation in use, defaulting to '' then the first (§7.3, §7.6 step 1)", () => {
    const two = parse(
      song(
        'C',
        '## Voicings: E2 A2 D3 G3 B3 E4',
        '- C: x32010',
        '',
        '## Barre: E2 A2 D3 G3 B3 E4',
        '- C: 8-10-10-9-8-8',
      ),
    );
    // The named variation in use picks its block.
    expect(resolveSongVoicings(two, guitar, { variation: 'Barre' }).get('C').fingering.shorthand).toBe('8-10-10-9-8-8');
    // None chosen → the default variation (label '').
    expect(resolveSongVoicings(two, guitar).get('C').fingering.shorthand).toBe('x32010');

    // No default variation for the tuning → the first block in parse.js order.
    const noDefault = parse(
      song(
        'C',
        '## First: E2 A2 D3 G3 B3 E4',
        '- C: x32010',
        '',
        '## Second: E2 A2 D3 G3 B3 E4',
        '- C: 8-10-10-9-8-8',
      ),
    );
    expect(resolveSongVoicings(noDefault, guitar).get('C').source).toBe('song');
    expect(resolveSongVoicings(noDefault, guitar).get('C').fingering.shorthand).toBe('x32010');
  });

  it('resolves a mixed song in one pass — voiced keys song, the rest yours/default (wf2 L78-79)', () => {
    const parsed = parse(song('C Am D', '## Voicings: E2 A2 D3 G3 B3 E4', '- C: x32010'));
    const r = resolveSongVoicings(parsed, guitar, { shapes: [shape('Am', 'x02210')] });
    expect(r.get('C').source).toBe('song');
    expect(r.get('Am').source).toBe('yours');
    expect(r.get('D').source).toBe('default');
  });

  it("is read-only: it never mutates parsed nor writes a shape into the song (wf2 L108)", () => {
    const parsed = parse(song('C Am', '## Voicings: E2 A2 D3 G3 B3 E4', '- C: x32010'));
    const before = structuredClone({ sections: parsed.sections, blocks: parsed.blocks });
    resolveSongVoicings(parsed, guitar, { shapes: [shape('Am', 'x02210')] });
    expect({ sections: parsed.sections, blocks: parsed.blocks }).toEqual(before);
    // The block still carries only the one shape its author wrote — no Am added.
    expect(parsed.blocks[0].voicings.map((v) => v.key)).toEqual(['C']);
  });

  it('leaves an unvoiceable valid chord out of the map and in unvoiceableKeys', () => {
    // C13#11 has no shape on a ukulele (the default-voicing case above).
    const parsed = parse(song('C13#11'));
    const r = resolveSongVoicings(parsed, uke);
    expect(r.has('C13#11')).toBe(false);
    expect(unvoiceableKeys(parsed, r)).toEqual(['C13#11']);
  });

  it("suppresses the song's choice under ignoreSongVoicings — the transpose seam (wf2 L120-125)", () => {
    const parsed = parse(song('C', '## Voicings: E2 A2 D3 G3 B3 E4', '- C: x32010'));
    const star = [shape('C', 'x-x-10-9-8-8')];
    // Without the seam, C is the song's choice.
    expect(resolveSongVoicings(parsed, guitar, { shapes: star }).get('C').source).toBe('song');
    // With it, the song's voicing is ignored — a coincidence is not a choice —
    // so C takes my shape...
    expect(resolveSongVoicings(parsed, guitar, { shapes: star, ignoreSongVoicings: true }).get('C').source).toBe('yours');
    // ...or the app's default when there is no star.
    expect(resolveSongVoicings(parsed, guitar, { ignoreSongVoicings: true }).get('C').source).toBe('default');
  });
});

describe("resolveSongVoicings — the song's own notation (cifra.md §5.6)", () => {
  // A song that declares its notation (§1.4.3), or none. The chart is two of
  // §5.6's ambiguous spellings, written for the purpose.
  const songIn = (notation, chart = 'C7+  C7(4)') =>
    [
      '# Song',
      ...(notation ? [`- notation: ${notation}`] : []),
      '## A',
      FENCE,
      chart,
      FENCE,
    ].join('\n') + '\n';
  const defaultOf = (symbol) => defaultVoicing(parseChord(symbol).chord, guitar).shorthand;

  const SHARP_FIFTH = defaultOf('C7#5');
  const ADDED_FOURTH = defaultOf('C7add4');
  const MAJOR_SEVENTH = defaultOf('C7M');
  const SUSPENSION = defaultOf('C7sus4');

  it('the two readings have different defaults, so the cases below can fail', () => {
    expect(SHARP_FIFTH).not.toBe(MAJOR_SEVENTH);
    expect(ADDED_FOURTH).not.toBe(SUSPENSION);
    // The spellings the cases compare against are the ones the dialects name.
    expect(SHARP_FIFTH).toBe(defaultVoicing(parseChord('C7#5', 'american').chord, guitar).shorthand);
    expect(ADDED_FOURTH).toBe(defaultVoicing(parseChord('C7add4', 'american').chord, guitar).shorthand);
  });

  it('an american song voices C7+ as the sharp fifth and C7(4) as the added fourth', () => {
    const r = resolveSongVoicings(parse(songIn('american')), guitar, { dialect: 'american' });
    expect(r.get('C7+')).toMatchObject({ source: 'default' });
    expect(r.get('C7+').fingering.shorthand).toBe(SHARP_FIFTH);
    expect(r.get('C7(4)')).toMatchObject({ source: 'default' });
    expect(r.get('C7(4)').fingering.shorthand).toBe(ADDED_FOURTH);
  });

  it('a brazilian song voices them as the major seventh and the suspension', () => {
    const r = resolveSongVoicings(parse(songIn(null)), guitar);
    expect(r.get('C7+')).toMatchObject({ source: 'default' });
    expect(r.get('C7+').fingering.shorthand).toBe(MAJOR_SEVENTH);
    expect(r.get('C7(4)')).toMatchObject({ source: 'default' });
    expect(r.get('C7(4)').fingering.shorthand).toBe(SUSPENSION);
  });

  it('a realbook song reads them as american does', () => {
    const r = resolveSongVoicings(parse(songIn('realbook')), guitar, { dialect: 'realbook' });
    expect(r.get('C7+').fingering.shorthand).toBe(SHARP_FIFTH);
    expect(r.get('C7(4)').fingering.shorthand).toBe(ADDED_FOURTH);
  });

  it('matches my shape by chord across dialects (wf2 L112-113; home-book format §4.4)', () => {
    // `shapes.json` keys are written in the default dialect: the added fourth
    // is `C7(add4)` there, the suspension `C7(4)`. Neither shorthand is a
    // default, so a hit can only be the star.
    const american = parse(songIn('american', 'C7(4)'));
    const brazilian = parse(songIn(null, 'C7(4)'));
    const addedFourthStar = [shape('C7(add4)', 'x33311')];
    const suspensionStar = [shape('C7(4)', 'x35363')];
    expect('x33311').not.toBe(ADDED_FOURTH);
    expect('x35363').not.toBe(SUSPENSION);

    const a1 = resolveSongVoicings(american, guitar, { dialect: 'american', shapes: addedFourthStar });
    expect(a1.get('C7(4)')).toMatchObject({ source: 'yours' });
    expect(a1.get('C7(4)').fingering.shorthand).toBe('x33311');
    const b1 = resolveSongVoicings(brazilian, guitar, { shapes: addedFourthStar });
    expect(b1.get('C7(4)')).toMatchObject({ source: 'default' });
    expect(b1.get('C7(4)').fingering.shorthand).toBe(SUSPENSION);

    const b2 = resolveSongVoicings(brazilian, guitar, { shapes: suspensionStar });
    expect(b2.get('C7(4)')).toMatchObject({ source: 'yours' });
    expect(b2.get('C7(4)').fingering.shorthand).toBe('x35363');
    const a2 = resolveSongVoicings(american, guitar, { dialect: 'american', shapes: suspensionStar });
    expect(a2.get('C7(4)')).toMatchObject({ source: 'default' });
    expect(a2.get('C7(4)').fingering.shorthand).toBe(ADDED_FOURTH);
  });

  it('unvoiceableKeys reads in the same dialect as the resolver', () => {
    // On a ukulele the american C7+(9) — a sharp-fifth ninth — has no shape;
    // the brazilian one, a major-seventh ninth, has.
    const chart = 'C7+  C7(4)  C7+(9)';
    const american = parse(songIn('american', chart));
    const brazilian = parse(songIn(null, chart));

    const ra = resolveSongVoicings(american, uke, { dialect: 'american' });
    expect([...ra.keys()]).toEqual(['C7+', 'C7(4)']);
    expect(unvoiceableKeys(american, ra, { dialect: 'american' })).toEqual(['C7+(9)']);

    const rb = resolveSongVoicings(brazilian, uke);
    expect([...rb.keys()]).toEqual(['C7+', 'C7(4)', 'C7+(9)']);
    expect(unvoiceableKeys(brazilian, rb)).toEqual([]);
    expect(unvoiceableKeys(brazilian, rb, { dialect: 'brazilian' })).toEqual([]);
  });
});
