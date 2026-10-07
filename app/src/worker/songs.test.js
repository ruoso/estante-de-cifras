import { describe, it, expect } from 'vitest';
import { transpositionOf, transpositionChange } from './songs.js';

// home-book-format §4.5 (songs.json, the `transposition` register) and §2.3 (the
// song ref key `<book-id>/<path>`). Pins the note's "remembered per song in the
// home book" at unit level; the SET_TRANSPOSITION command and its e2e round-trip
// are songs.reading's (the refinement's boundary).

const AT = '2026-10-06T12:00:00.000Z';
const reg = (value) => ({ value, at: AT });

// A §2.3 song ref: book id and the song's NFC-normalised path, joined by `/`.
const REF = 'b7c1/Chico/Construção.cifra.md';
const OTHER = 'b7c1/Tom/Águas.cifra.md';

// Apply a change the way home-book.set does — walk the key path, wrapping the
// value in the §3 register envelope — so the seam's change-set is pinned against
// the register it actually produces on disk, not a hand-built stand-in.
function apply(model, change, at = AT) {
  let node = model;
  for (let i = 0; i < change.path.length - 1; i += 1) {
    const key = change.path[i];
    if (!node[key] || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  }
  node[change.path[change.path.length - 1]] = { value: change.value, at };
  return model;
}

describe('transpositionChange — the home-book change that remembers an offset', () => {
  it('names the §4.5 key path and the signed value', () => {
    expect(transpositionChange(REF, 2)).toEqual({ path: [REF, 'transposition'], value: 2 });
    expect(transpositionChange(REF, -3)).toEqual({ path: [REF, 'transposition'], value: -3 });
    expect(transpositionChange(REF, 0)).toEqual({ path: [REF, 'transposition'], value: 0 });
  });

  it('round-trips through the register envelope back to transpositionOf (§4.5)', () => {
    const model = apply({}, transpositionChange(REF, 2));
    expect(model[REF].transposition).toEqual(reg(2));
    expect(transpositionOf(model, REF)).toBe(2);

    const down = apply({}, transpositionChange(REF, -5));
    expect(transpositionOf(down, REF)).toBe(-5);
  });
});

describe('transpositionOf — the stored offset, or the written key', () => {
  it('reads back a stored signed offset', () => {
    const model = { [REF]: { transposition: reg(4) } };
    expect(transpositionOf(model, REF)).toBe(4);
    expect(transpositionOf({ [REF]: { transposition: reg(-2) } }, REF)).toBe(-2);
  });

  it('an absent register or an absent song reads as the written key (0)', () => {
    expect(transpositionOf({}, REF)).toBe(0);
    expect(transpositionOf({ [REF]: {} }, REF)).toBe(0);
    expect(transpositionOf(undefined, REF)).toBe(0);
  });

  it('a stored 0 is the written key (0)', () => {
    expect(transpositionOf({ [REF]: { transposition: reg(0) } }, REF)).toBe(0);
  });

  it('a tombstone or a non-integer value reads as the written key (0)', () => {
    expect(transpositionOf({ [REF]: { transposition: reg(null) } }, REF)).toBe(0);
    expect(transpositionOf({ [REF]: { transposition: reg(1.5) } }, REF)).toBe(0);
    expect(transpositionOf({ [REF]: { transposition: reg('2') } }, REF)).toBe(0);
    // A malformed register (missing `at`) is not a register and is ignored.
    expect(transpositionOf({ [REF]: { transposition: { value: 2 } } }, REF)).toBe(0);
  });

  it('a different song ref is independent', () => {
    const model = apply({}, transpositionChange(REF, 3));
    expect(transpositionOf(model, REF)).toBe(3);
    expect(transpositionOf(model, OTHER)).toBe(0);
  });
});
