// @vitest-environment node
// unit — the device bundle's polyfills (reader.bundle; docs/remarkable-reader.md
// §4, the spike's list of what goja lacks). On a bare target each is installed;
// under Node the native implementations are left exactly as they are.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'cifra-md';
import { installPolyfills } from './polyfills.js';

const SAMPLE = 'Ação, coração — ♯♭';

describe('installPolyfills on a bare target', () => {
  const target = installPolyfills({});

  it('installs all four', () => {
    expect(typeof target.structuredClone).toBe('function');
    expect(typeof target.TextEncoder).toBe('function');
    expect(typeof target.TextDecoder).toBe('function');
    expect(typeof target.Intl.PluralRules).toBe('function');
  });

  it('structuredClone deep-copies a parsed song into a new object', () => {
    const text = readFileSync(new URL('../../example-book/the-ferry-line.cifra.md', import.meta.url), 'utf8');
    const model = parse(text);
    const copy = target.structuredClone(model);
    expect(copy).not.toBe(model);
    expect(copy.sections).not.toBe(model.sections);
    expect(copy).toEqual(model);
  });

  it('TextEncoder/TextDecoder round-trip UTF-8 to the same bytes as Node', () => {
    const bytes = new target.TextEncoder().encode(SAMPLE);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect([...bytes]).toEqual([...new globalThis.TextEncoder().encode(SAMPLE)]);
    expect(new target.TextDecoder().decode(bytes)).toBe(SAMPLE);
    expect(new target.TextDecoder('utf-8').decode(bytes.buffer)).toBe(SAMPLE);
    const astral = '𝄞 clef';
    expect([...new target.TextEncoder().encode(astral)]).toEqual([...new globalThis.TextEncoder().encode(astral)]);
    expect(new target.TextDecoder().decode(new target.TextEncoder().encode(astral))).toBe(astral);
  });

  it('TextDecoder reads UTF-8 only', () => {
    expect(() => new target.TextDecoder('latin1')).toThrow();
  });

  it('Intl.PluralRules gives English cardinals', () => {
    const rules = new target.Intl.PluralRules('en');
    expect(rules.select(1)).toBe('one');
    expect(rules.select(0)).toBe('other');
    expect(rules.select(2)).toBe('other');
    expect(rules.resolvedOptions().locale).toBe('en');
  });

  it('Intl.PluralRules gives English ordinals', () => {
    const rules = new target.Intl.PluralRules('en', { type: 'ordinal' });
    expect([1, 2, 3, 4, 11, 22].map((n) => rules.select(n))).toEqual(['one', 'two', 'few', 'other', 'other', 'two']);
  });
});

describe('installPolyfills on Node', () => {
  it('leaves the native implementations in place', () => {
    const before = {
      structuredClone: globalThis.structuredClone,
      TextEncoder: globalThis.TextEncoder,
      TextDecoder: globalThis.TextDecoder,
      Intl: globalThis.Intl,
      PluralRules: globalThis.Intl.PluralRules,
    };
    installPolyfills(globalThis);
    expect(globalThis.structuredClone).toBe(before.structuredClone);
    expect(globalThis.TextEncoder).toBe(before.TextEncoder);
    expect(globalThis.TextDecoder).toBe(before.TextDecoder);
    expect(globalThis.Intl).toBe(before.Intl);
    expect(globalThis.Intl.PluralRules).toBe(before.PluralRules);
  });
});
