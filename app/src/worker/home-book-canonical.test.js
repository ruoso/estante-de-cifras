import { describe, it, expect } from 'vitest';
import { serialize, serializeBytes, parse } from './home-book-canonical.js';

// unit — the home book's canonical JSON form (storage.home_book). Pins
// home-book-format.md §6: sorted object keys at every depth (`at` before
// `value`), kept array order, the §6.2 number/string forms, NFC, the §6.3 bytes,
// and the fixed-point property that makes the §5 merge reproducible and the
// §5.1.2 tie-break total (home-book.md Decision 4). All text is written for this
// test (no-song-text rule).

describe('serialize — canonical form (home-book-format.md §6)', () => {
  it('sorts every object member by code point at every depth, `at` before `value` (§6.1)', () => {
    // Keys handed out of order; a register with `value` before `at`; a nested map.
    const model = {
      theme: { value: 'palco', at: '2026-10-05T14:30:00.000Z' },
      books: {
        'b-2': { position: { value: 2, at: '2026-10-05T14:30:00.000Z' } },
        'b-1': { label: { value: 'Quarta', at: '2026-10-05T14:30:00.000Z' } },
      },
      language: { value: 'pt-BR', at: '2026-10-05T14:29:12.500Z' },
    };
    expect(serialize(model)).toBe(
      [
        '{',
        '  "books": {',
        '    "b-1": {',
        '      "label": {',
        '        "at": "2026-10-05T14:30:00.000Z",',
        '        "value": "Quarta"',
        '      }',
        '    },',
        '    "b-2": {',
        '      "position": {',
        '        "at": "2026-10-05T14:30:00.000Z",',
        '        "value": 2',
        '      }',
        '    }',
        '  },',
        '  "language": {',
        '    "at": "2026-10-05T14:29:12.500Z",',
        '    "value": "pt-BR"',
        '  },',
        '  "theme": {',
        '    "at": "2026-10-05T14:30:00.000Z",',
        '    "value": "palco"',
        '  }',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('keeps an array (a recents list) in its original order (§6.1)', () => {
    // A recents list is meaningful newest-first; it must NOT be sorted.
    const model = { list: { value: ['s-3', 's-1', 's-2'], at: '2026-10-05T14:30:00.000Z' } };
    expect(serialize(model)).toBe(
      [
        '{',
        '  "list": {',
        '    "at": "2026-10-05T14:30:00.000Z",',
        '    "value": [',
        '      "s-3",',
        '      "s-1",',
        '      "s-2"',
        '    ]',
        '  }',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('emits numbers as the shortest round-tripping decimal (§6.2)', () => {
    expect(serialize({ a: -2, b: 0, c: 2, d: 1.5 })).toBe(
      ['{', '  "a": -2,', '  "b": 0,', '  "c": 2,', '  "d": 1.5', '}', ''].join('\n'),
    );
  });

  it('escapes only what JSON requires, lowercase \\u00XX, solidus literal, non-ASCII literal (§6.2)', () => {
    const model = {
      quote: { value: 'a "b" \\ c', at: '2026-10-05T14:30:00.000Z' },
      control: { value: 'x\u0001y\tz', at: '2026-10-05T14:30:00.000Z' },
      url: { value: 'https://example.app/a/b', at: '2026-10-05T14:30:00.000Z' },
      accent: { value: 'Construção', at: '2026-10-05T14:30:00.000Z' },
    };
    const out = serialize(model);
    expect(out).toContain('"value": "a \\"b\\" \\\\ c"');
    expect(out).toContain('"value": "x\\u0001y\\tz"'); // lowercase \u0001, short \t
    expect(out).toContain('"value": "https://example.app/a/b"'); // solidus never escaped
    expect(out).toContain('"value": "Construção"'); // non-ASCII literal UTF-8
  });

  it('normalises text to NFC — keys and values (§6.1, §6.3)', () => {
    // "é" as NFD (e + U+0301) must serialize identically to NFC "é" (U+00E9).
    const nfd = 'André'; // André, decomposed
    const nfc = 'André';
    const model = { [nfd]: { value: nfd, at: '2026-10-05T14:30:00.000Z' } };
    const out = serialize(model);
    expect(out).toContain(`"${nfc}"`);
    expect(out).not.toContain('́'); // the combining mark is gone
  });

  it('writes the empty map as `{}` with one trailing LF (§6.3)', () => {
    expect(serialize({})).toBe('{}\n');
  });

  it('is a fixed point: serialize(parse(serialize(x))) is byte-equal to serialize(x) (§6)', () => {
    const model = {
      theme: { value: 'palco', at: '2026-10-05T14:30:00.000Z' },
      books: { 'b-1': { position: { value: 3, at: '2026-10-05T14:29:12.500Z' } } },
      note: { value: 'line\nbreak and "quote"', at: '2026-10-05T14:30:00.000Z' },
    };
    const once = serialize(model);
    const twice = serialize(parse(once));
    expect(twice).toBe(once);
    // And the bytes are a genuine UTF-8 encoding of the same string.
    expect(serializeBytes(model)).toEqual(new TextEncoder().encode(once));
  });
});

describe('parse — reading a settings file (home-book-format.md §2.1)', () => {
  it('reads an absent file (null/undefined/empty) as the empty map `{}`', () => {
    expect(parse(null)).toEqual({});
    expect(parse(undefined)).toEqual({});
    expect(parse('')).toEqual({});
    expect(parse('   \n')).toEqual({});
  });

  it('reads canonical bytes (a Uint8Array) back to their model', () => {
    const model = { theme: { value: 'palco', at: '2026-10-05T14:30:00.000Z' } };
    expect(parse(serializeBytes(model))).toEqual(model);
  });

  it('drops a leading BOM a lenient reader may meet (§6.3)', () => {
    expect(parse('﻿{"a":1}')).toEqual({ a: 1 });
  });
});
