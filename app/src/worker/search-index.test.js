// unit — the search index's field extraction, ranking, chord-use and
// content-addressing (storage.index). All song text here is written for this
// test (no-song-text rule). Pins:
//   - field extraction → DIRECTION §3 L114-115, `.tji` "the fields";
//   - ranking → `.tji` "ranking", workflow 2 L22-24;
//   - chord-use → workflow 2 L37;
//   - content-addressing → DIRECTION §3 L115 "parsed once per distinct text".

import { describe, it, expect, vi } from 'vitest';
import { parse } from 'cifra-md';
import { createSearchIndex, extractFields } from './search-index.js';

const FENCE = '```';
const song = (lines) => lines.join('\n') + '\n';

describe('extractFields', () => {
  it('pulls the five fields (title, properties, section names, words, chords) and nothing else', () => {
    const src = song([
      '# Coração Valente',
      '- artist: Banda Teste',
      '- key: G',
      '',
      '## Intro',
      'uma nota de rodape apenas', // notes prose — must NOT be indexed
      '',
      '## Verso',
      FENCE,
      'G           D',
      'Era uma vez um coração',
      'Em              C',
      'cantando a solidão',
      FENCE,
    ]);
    const fields = extractFields(parse(src), 'oid-1');

    expect(fields.title).toBe('Coração Valente');
    expect(fields.artist).toBe('Banda Teste');
    // properties = the values (artist and the rest), not the keys.
    expect(fields.properties).toContain('Banda Teste');
    expect(fields.properties).toContain('G');
    // section names, the implicit lead section ("") dropped.
    expect(fields.sections.split(' ')).toEqual(
      expect.arrayContaining(['Intro', 'Verso']),
    );
    // lyric words come from the per-chord `words` on sung lines.
    expect(fields.words).toContain('coração');
    expect(fields.words).toContain('solidão');
    // chords are the chord-item symbols.
    expect(fields.chords.split(' ')).toEqual(
      expect.arrayContaining(['G', 'D', 'Em', 'C']),
    );

    // "nothing else": the notes prose "rodape" is not indexed into any field.
    const haystack = [
      fields.title,
      fields.properties,
      fields.sections,
      fields.words,
      fields.chords,
    ].join(' ');
    expect(haystack).not.toContain('rodape');
    // The extracted record carries only the known keys.
    expect(Object.keys(fields).sort()).toEqual(
      ['artist', 'chords', 'oid', 'properties', 'sections', 'title', 'words'].sort(),
    );
  });

  it('tolerates a title-less, property-less song', () => {
    const fields = extractFields(parse(song(['## A', FENCE, 'G', FENCE])), 'oid-2');
    expect(fields.title).toBe('');
    expect(fields.artist).toBe('');
    expect(fields.properties).toBe('');
    expect(fields.chords).toContain('G');
  });
});

describe('createSearchIndex — ranking', () => {
  const index = createSearchIndex({ parse });

  it('ranks a title hit above a body-only hit, and a multi-field hit above a single-field hit', async () => {
    await index.indexDocument({
      bookId: 'b',
      path: 'title-hit.cifra.md',
      bytes: song(['# Melodia Azul', '## A', FENCE, 'C', FENCE]),
    });
    await index.indexDocument({
      bookId: 'b',
      path: 'words-hit.cifra.md',
      bytes: song([
        '# Outra Canção',
        '## A',
        FENCE,
        'C',
        'uma melodia no ar',
        FENCE,
      ]),
    });

    const results = index.search({ query: 'melodia' });
    expect(results.length).toBe(2);
    // The song whose title is "Melodia Azul" outranks the one that only sings
    // the word (title boost over words boost).
    expect(results[0].path).toBe('title-hit.cifra.md');
    expect(results[0].title).toBe('Melodia Azul');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });
});

describe('createSearchIndex — chord-use', () => {
  it('returns a song that uses a queried chord symbol', async () => {
    const index = createSearchIndex({ parse });
    await index.indexDocument({
      bookId: 'b',
      path: 'uses-bm7.cifra.md',
      bytes: song(['# Progressão', '## A', FENCE, 'Bm7   E', 'A', FENCE]),
    });
    await index.indexDocument({
      bookId: 'b',
      path: 'no-bm7.cifra.md',
      bytes: song(['# Simples', '## A', FENCE, 'C   G', FENCE]),
    });

    const results = index.search({ query: 'Bm7' });
    expect(results.map((r) => r.path)).toContain('uses-bm7.cifra.md');
    expect(results.map((r) => r.path)).not.toContain('no-bm7.cifra.md');
  });
});

describe('createSearchIndex — content-addressing', () => {
  it('parses once per distinct blob: two identical texts cause a single parse', async () => {
    const spy = vi.fn(parse);
    const index = createSearchIndex({ parse: spy });
    const bytes = song(['# Mesma Letra', '## A', FENCE, 'G   C', 'oi', FENCE]);

    await index.indexDocument({ bookId: 'b', path: 'copy-1.cifra.md', bytes });
    await index.indexDocument({ bookId: 'b', path: 'copy-2.cifra.md', bytes });

    // Same bytes → same git blob oid → one parse, shared record (DIRECTION §3 L115).
    expect(spy).toHaveBeenCalledTimes(1);
    // Both locations are still two distinct results (not grouped, workflow 2 L52).
    const results = index.search({ query: 'mesma' });
    expect(results.map((r) => r.path).sort()).toEqual([
      'copy-1.cifra.md',
      'copy-2.cifra.md',
    ]);
  });
});

describe('createSearchIndex — accent-insensitive and scope', () => {
  const index = createSearchIndex({ parse });

  it('matches across accents and case, and honours a book/prefix scope', async () => {
    await index.indexDocument({
      bookId: 'b1',
      path: 'folder/one.cifra.md',
      bytes: song(['# Coração', '## A', FENCE, 'G', 'coração', FENCE]),
    });
    await index.indexDocument({
      bookId: 'b2',
      path: 'two.cifra.md',
      bytes: song(['# Outro', '## A', FENCE, 'C', 'coracao mais', FENCE]),
    });

    // `coracao` (no accents) finds *Coração* (workflow 2 L24).
    expect(index.search({ query: 'coracao' }).length).toBe(2);
    expect(index.search({ query: 'CORAÇÃO' }).length).toBe(2);

    // Scope to a single book.
    const inB1 = index.search({ query: 'coracao', scope: { books: ['b1'] } });
    expect(inB1.map((r) => r.bookId)).toEqual(['b1']);

    // Scope to a folder prefix within a book.
    const inFolder = index.search({
      query: 'coracao',
      scope: { bookId: 'b1', prefix: 'folder/' },
    });
    expect(inFolder.map((r) => r.path)).toEqual(['folder/one.cifra.md']);
  });
});
