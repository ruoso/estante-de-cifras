import { describe, it, expect } from 'vitest';
import { isRegister, mergeRegisters, mergeTrees } from './home-book-merge.js';

// unit — the register envelope and the key-by-key merge (storage.home_book, the
// .tji's "the key-by-key merge, the later change winning, equal times"). Pins
// home-book-format.md §3 and §5, workflow 8 L72-77, DIRECTION §6, and
// tasks/40-storage.tji:47. All settings are written for this test
// (no-song-text rule).

const reg = (value, at) => ({ value, at });
const T = {
  early: '2026-10-05T14:29:12.500Z',
  late: '2026-10-05T14:30:00.000Z',
  later: '2026-10-05T15:00:00.000Z',
};

describe('isRegister — telling a register from a map (§3)', () => {
  it('is a register iff keys are exactly {value, at} with a well-formed instant', () => {
    expect(isRegister(reg('palco', T.late))).toBe(true);
    expect(isRegister(reg(null, T.late))).toBe(true); // a tombstone is a register
  });

  it('rejects a map, a wrong-arity object, and a malformed `at`', () => {
    expect(isRegister({ label: reg('x', T.late) })).toBe(false); // a map
    expect(isRegister({ value: 'x', at: T.late, extra: 1 })).toBe(false); // extra key
    expect(isRegister({ value: 'x' })).toBe(false); // missing `at`
    expect(isRegister({ value: 'x', at: '2026-10-05 14:30' })).toBe(false); // bad instant
    expect(isRegister(null)).toBe(false);
    expect(isRegister([reg('x', T.late)])).toBe(false); // an array
  });

  it('does not walk an opaque value that itself has value/at keys (§3 L172-174)', () => {
    // The register wraps an opaque object that happens to contain value/at; the
    // register is still a register, and its value is never inspected.
    const opaque = reg({ value: 1, at: 'inner' }, T.late);
    expect(isRegister(opaque)).toBe(true);
  });
});

describe('mergeRegisters — two registers (§5.1)', () => {
  it('the later change wins, by the greater `at` (§5.1.1 — the later change winning)', () => {
    expect(mergeRegisters(reg('estante', T.early), reg('palco', T.late))).toEqual(
      reg('palco', T.late),
    );
    // Commutative: order of arguments does not change the winner.
    expect(mergeRegisters(reg('palco', T.late), reg('estante', T.early))).toEqual(
      reg('palco', T.late),
    );
  });

  it('on equal `at`, the canonical-value byte tie-break resolves identically either way (§5.1.2 — equal times)', () => {
    const a = reg('caderno', T.late);
    const b = reg('palco', T.late); // "palco" > "caderno" as UTF-8 bytes
    expect(mergeRegisters(a, b)).toEqual(b);
    expect(mergeRegisters(b, a)).toEqual(b); // same winner regardless of order
  });

  it('on equal `at` and equal canonical value, the registers are equal (§5.1.2)', () => {
    expect(mergeRegisters(reg('palco', T.late), reg('palco', T.late))).toEqual(
      reg('palco', T.late),
    );
  });
});

describe('mergeTrees — two maps (§5.2, §5.3, §5.4)', () => {
  it('takes a key present on one side whole and recurses a key on both — key by key (§5.2)', () => {
    // preferences.json: `theme` only on A, `language` only on B, both kept; and
    // `notation` on both, the later winning — two keys in one file not interfering.
    const a = {
      theme: reg('palco', T.late),
      notation: reg('english', T.early),
    };
    const b = {
      language: reg('pt-BR', T.late),
      notation: reg('nashville', T.later),
    };
    expect(mergeTrees(a, b)).toEqual({
      theme: reg('palco', T.late),
      language: reg('pt-BR', T.late),
      notation: reg('nashville', T.later), // the later change won
    });
  });

  it('recurses nested maps so two keys under one file never interfere (§5.2)', () => {
    const a = { books: { 'b-1': { label: reg('Quarta', T.late) } } };
    const b = { books: { 'b-2': { label: reg('Domingo', T.late) } } };
    expect(mergeTrees(a, b)).toEqual({
      books: {
        'b-1': { label: reg('Quarta', T.late) },
        'b-2': { label: reg('Domingo', T.late) },
      },
    });
  });

  it('a later unset (tombstone) removes a key; an earlier unset loses to a later value; tombstones retained (§5.3)', () => {
    // `theme` is unset later than it was set → the tombstone wins and is kept.
    // `language` is unset earlier than a later value → the value wins.
    const a = { theme: reg('palco', T.early), language: reg(null, T.early) };
    const b = { theme: reg(null, T.late), language: reg('pt-BR', T.late) };
    expect(mergeTrees(a, b)).toEqual({
      theme: reg(null, T.late), // tombstone retained, still winning
      language: reg('pt-BR', T.late),
    });
  });

  it('merges a side that lacks a file as the empty map `{}` (§5, §2.1)', () => {
    const b = { theme: reg('palco', T.late) };
    expect(mergeTrees({}, b)).toEqual(b);
    expect(mergeTrees(b, {})).toEqual(b);
  });

  it('is commutative: mergeTrees(a, b) equals mergeTrees(b, a) (§5.4)', () => {
    const a = {
      theme: reg('palco', T.late),
      books: { 'b-1': { position: reg(1, T.early) } },
    };
    const b = {
      theme: reg('caderno', T.late), // equal `at` → byte tie-break, deterministic
      language: reg('pt-BR', T.later),
      books: { 'b-1': { position: reg(2, T.late) } },
    };
    expect(mergeTrees(a, b)).toEqual(mergeTrees(b, a));
  });

  it('three-way merges converge regardless of order (§5.4)', () => {
    const a = { theme: reg('estante', T.early) };
    const b = { theme: reg('caderno', T.late), language: reg('pt-BR', T.late) };
    const c = { theme: reg('palco', T.later), notation: reg('nashville', T.early) };
    const left = mergeTrees(mergeTrees(a, b), c);
    const right = mergeTrees(a, mergeTrees(b, c));
    const other = mergeTrees(mergeTrees(c, a), b);
    const converged = {
      theme: reg('palco', T.later), // the latest of the three
      language: reg('pt-BR', T.late),
      notation: reg('nashville', T.early),
    };
    expect(left).toEqual(converged);
    expect(right).toEqual(converged);
    expect(other).toEqual(converged);
  });

  it('flags a register/map mismatch under one key as malformed, naming no value (§5.2)', () => {
    const a = { notation: reg('english', T.late) };
    const b = { notation: { dialect: reg('english', T.late) } }; // a map, not a register
    expect(() => mergeTrees(a, b)).toThrow(/malformed/);
    // The message must not leak any key or value a person wrote (DIRECTION §3.3).
    try {
      mergeTrees(a, b);
    } catch (err) {
      expect(err.message).not.toContain('notation');
      expect(err.message).not.toContain('english');
    }
  });
});
