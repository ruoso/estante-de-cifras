// home-book-canonical.js — the home book's canonical JSON form (storage.home_book).
// home-book-format.md §6: "Every home-book file has exactly one canonical form,
// and a writer and a merger MUST write it." Canonical form is what makes two
// converged devices (§5.4) write BYTE-IDENTICAL files, so the automatic merge
// commit is reproducible and carries no spurious diff. It is also the single
// source of bytes for the §5.1.2 equal-time tie-break (home-book.md Decision 4):
// the tie-break and the on-disk bytes must agree, or convergence would not be
// byte-identical.
//
// `JSON.stringify` cannot produce it (home-book.md Decision 4): it does not
// NFC-normalise, its key order is insertion order rather than code-point order,
// and its number/escape forms are not §6.2. So this serializer is bespoke.
//
// Pure: no I/O, no logging, no song text or secrets (standing rule). A fixed
// point — canonicalising a canonical file changes no byte (§6, the validator's
// check). Framework-free, Worker-only: plain ESM, no React.

// A canonical file is UTF-8. The tie-break (§5.1.2) compares canonical values as
// UTF-8 byte sequences, so we encode once here and reuse it for that comparison.
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder('utf-8');

/**
 * Compare two strings by Unicode code point, ascending (§6.1 — "the Unicode
 * code points of the member name"). `String` `<` compares UTF-16 code units,
 * which diverges from code-point order for astral characters; iterating with
 * `Array.from` yields whole code points, so an emoji in a song ref (a map key)
 * sorts the same on every device.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareCodePoints(a, b) {
  const ca = Array.from(a);
  const cb = Array.from(b);
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < n; i += 1) {
    const da = ca[i].codePointAt(0);
    const db = cb[i].codePointAt(0);
    if (da !== db) return da - db;
  }
  return ca.length - cb.length;
}

// The short escapes JSON gives these control characters (§6.2). Every other
// character in U+0000–U+001F takes a lowercase `\u00XX`; everything at or above
// U+0020 — including every non-ASCII character — is emitted literally, and the
// solidus is never escaped.
const SHORT_ESCAPE = {
  '"': '\\"',
  '\\': '\\\\',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

/**
 * Emit a string as a canonical JSON string literal (§6.2): NFC-normalised,
 * escaping only what JSON requires — `"`, `\`, and U+0000–U+001F — with the
 * short escapes where they exist and lowercase `\u00XX` otherwise, the solidus
 * never escaped, every other character literal UTF-8.
 *
 * @param {string} raw
 * @returns {string}
 */
function serializeString(raw) {
  let out = '"';
  for (const ch of raw.normalize('NFC')) {
    const short = SHORT_ESCAPE[ch];
    if (short !== undefined) {
      out += short;
      continue;
    }
    const code = ch.codePointAt(0);
    if (code <= 0x1f) {
      out += `\\u${code.toString(16).padStart(4, '0')}`;
    } else {
      out += ch;
    }
  }
  return `${out}"`;
}

/**
 * Emit a number in the shortest decimal that round-trips to the same IEEE-754
 * double — the form `Number.prototype.toString` produces (§6.2). Non-finite
 * numbers have no JSON form and are rejected: a writer must never produce one.
 *
 * @param {number} n
 * @returns {string}
 */
function serializeNumber(n) {
  if (!Number.isFinite(n)) {
    throw new Error('home-book-canonical: a number must be finite');
  }
  return String(n);
}

/**
 * Serialize a value at a given indentation (§6.1, §6.3): objects pretty-printed
 * one member per line with members sorted by code point at every depth (so `at`
 * precedes `value` in a register), arrays one element per line in their original
 * order, two-space indentation per level, `": "` between a member name and its
 * value. An empty object is `{}` and an empty array `[]` on one line.
 *
 * @param {*} value
 * @param {string} indent the indentation of the line this value opens on
 * @returns {string}
 */
function serializeValue(value, indent) {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'string') return serializeString(value);
  if (type === 'number') return serializeNumber(value);
  if (type === 'boolean') return value ? 'true' : 'false';

  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => inner + serializeValue(item, inner));
    return `[\n${items.join(',\n')}\n${indent}]`;
  }
  if (type === 'object') {
    // Normalise member names to NFC, then sort by code point. Keep the original
    // value against the normalised name so a non-NFC key still resolves.
    const entries = Object.keys(value).map((key) => ({
      name: key.normalize('NFC'),
      value: value[key],
    }));
    entries.sort((a, b) => compareCodePoints(a.name, b.name));
    if (entries.length === 0) return '{}';
    const members = entries.map(
      (entry) => `${inner}${serializeString(entry.name)}: ${serializeValue(entry.value, inner)}`,
    );
    return `{\n${members.join(',\n')}\n${indent}}`;
  }
  throw new Error(`home-book-canonical: cannot serialize a ${type}`);
}

/**
 * The canonical bytes (as a string) of a home-book model (§6). Pretty-printed
 * with exactly one trailing LF; the empty map is `{}` followed by one LF.
 *
 * @param {*} value a home-book file's model (a map at its root)
 * @returns {string}
 */
export function serialize(value) {
  return `${serializeValue(value, '')}\n`;
}

/**
 * The canonical bytes of a model as a UTF-8 `Uint8Array` — what is written to
 * disk, and what the §5.1.2 tie-break compares. `serialize` produces a JS
 * string; encoding it here keeps the one definition of "the bytes".
 *
 * @param {*} value
 * @returns {Uint8Array}
 */
export function serializeBytes(value) {
  return ENCODER.encode(serialize(value));
}

/**
 * Read a settings file to its model (§2.1). An absent file — `null`/`undefined`
 * or empty content — reads as the empty map `{}`. Bytes are decoded as UTF-8
 * with any leading BOM dropped (a canonical file has none, §6.3, but a reader is
 * lenient). Accepts a string or a `Uint8Array` (isomorphic-git's `readBlob`
 * returns bytes).
 *
 * @param {string | Uint8Array | null | undefined} bytes
 * @returns {*}
 */
export function parse(bytes) {
  if (bytes == null) return {};
  let text = typeof bytes === 'string' ? bytes : DECODER.decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.trim() === '') return {};
  return JSON.parse(text);
}
