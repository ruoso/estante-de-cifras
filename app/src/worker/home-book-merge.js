// home-book-merge.js — the register envelope and the key-by-key merge
// (storage.home_book). home-book-format.md §3, §5. This is the heart of "nobody
// should ever meet a conflict in their preferences" (workflow 8 L72-77): a pure
// binary function over two home-book trees that is commutative and associative
// (§5.4), so the Worker merges two divergent sides in either order, needs no
// common base, and every device converges on the same tree.
//
// The merge is the WORKER'S OWN, not git's (§1.1, §9; home-book.md Decision 2):
// git's line-based text merge is never consulted for settings. Keeping it a pure
// transport-free function is what makes §5's commutativity/associativity
// testable in isolation (the unit level the .tji names) and the sync path thin.
//
// Pure: no I/O, no logging, no song text or secrets. It imports the canonical
// serializer for the §5.1.2 equal-time tie-break — and nothing else — so the
// tie-break and the on-disk bytes agree (home-book.md Decision 4). Framework-
// free, Worker-only: plain ESM, no React.

import { serialize } from './home-book-canonical.js';

// A well-formed instant: UTC ISO-8601 to the millisecond with a literal `Z`
// (§3 L163). This is also how a register is told from a map without a schema.
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const ENCODER = new TextEncoder();

/**
 * A register is a JSON object whose keys are EXACTLY `value` and `at`, with `at`
 * a well-formed instant (§3 L167-171): "an object is a register if and only if
 * its keys are exactly `value` and `at`, with `at` a well-formed instant; every
 * other object is a map." The content of `value` is never inspected, so an
 * opaque value that itself contains `value`/`at` keys is safe (§3 L172-174).
 *
 * @param {*} obj
 * @returns {boolean}
 */
export function isRegister(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length !== 2) return false;
  if (!Object.prototype.hasOwnProperty.call(obj, 'value')) return false;
  if (!Object.prototype.hasOwnProperty.call(obj, 'at')) return false;
  return typeof obj.at === 'string' && INSTANT.test(obj.at);
}

/**
 * Compare two strings as UTF-8 byte sequences (§5.1.2). `String` `<` compares
 * UTF-16 code units, which is not UTF-8 byte order for astral characters, so we
 * encode and compare bytes — the comparison the spec names exactly.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a < b, positive if a > b, 0 if equal
 */
function compareUtf8(a, b) {
  const ba = ENCODER.encode(a);
  const bb = ENCODER.encode(b);
  const n = Math.min(ba.length, bb.length);
  for (let i = 0; i < n; i += 1) {
    if (ba[i] !== bb[i]) return ba[i] - bb[i];
  }
  return ba.length - bb.length;
}

/**
 * Merge two registers for the same key (§5.1). The register with the greater
 * `at` wins — "the later change wins, by the time each was made" (§5.1.1,
 * workflow 8). On equal `at`, the tie-break (§5.1.2): canonicalise each `value`
 * (§6) and take the one whose canonical bytes are lexicographically greater as
 * UTF-8; equal canonical values are equal registers and either is taken. The
 * tie-break is total, commutative and deterministic, so every device resolves an
 * equal-time clash identically regardless of merge order (§5.4).
 *
 * A tombstone (`value: null`, §5.3) is a register and merges here like any
 * other, so it is retained: a later unset removes a key, an earlier unset loses
 * to a later value.
 *
 * @param {{ value: *, at: string }} a
 * @param {{ value: *, at: string }} b
 * @returns {{ value: *, at: string }}
 */
export function mergeRegisters(a, b) {
  if (a.at > b.at) return a;
  if (b.at > a.at) return b;
  // Equal instants: the canonical-value byte tie-break. Taking `a` on a tie is
  // safe because the values are then byte-equal (equal registers).
  return compareUtf8(serialize(a.value), serialize(b.value)) >= 0 ? a : b;
}

/**
 * Whether a value is a map — a non-null, non-array object that is not a register.
 *
 * @param {*} v
 * @returns {boolean}
 */
function isMap(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v) && !isRegister(v);
}

/**
 * Merge two maps (§5.2): the result has the union of their keys. A key on one
 * side only is taken whole; a key on both is recursed — two registers resolve by
 * §5.1, two maps by §5.2. A key that is a register on one side and a map on the
 * other is a malformed home book (§3, §5.2): the merger does not produce one, so
 * it throws rather than guessing. The error names no key or value — nothing a
 * person wrote is put in a message (DIRECTION §3.3).
 *
 * Commutative and associative (§5.4): union is order-independent and the
 * per-key resolution (§5.1) is itself commutative, so merging any number of
 * sides in any order converges on the same tree.
 *
 * @param {Object} a a home-book tree (a map)
 * @param {Object} b a home-book tree (a map)
 * @returns {Object}
 */
export function mergeTrees(a, b) {
  const result = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const inA = Object.prototype.hasOwnProperty.call(a, key);
    const inB = Object.prototype.hasOwnProperty.call(b, key);
    if (inA && !inB) {
      result[key] = a[key];
    } else if (inB && !inA) {
      result[key] = b[key];
    } else {
      const va = a[key];
      const vb = b[key];
      if (isRegister(va) && isRegister(vb)) {
        result[key] = mergeRegisters(va, vb);
      } else if (isMap(va) && isMap(vb)) {
        result[key] = mergeTrees(va, vb);
      } else {
        throw new Error(
          'home-book-merge: malformed tree — a key is a register on one side and a map on the other',
        );
      }
    }
  }
  return result;
}
