// polyfills.js — what the device bundle needs that goja lacks
// (docs/remarkable-reader.md §4, the spike's list): `structuredClone`, a UTF-8
// `TextEncoder`/`TextDecoder`, and `Intl.PluralRules` (with `Intl` itself when
// it is absent). Each is installed only where the target has none, so a browser
// or Node keeps its native implementation exactly as before.
//
// The entry imports this module first, so it runs before any module reads a
// global.

// The music core clones only plain parse models, so JSON is a faithful copy.
function jsonClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function checkLabel(label) {
  const name = String(label).trim().toLowerCase();
  if (name !== 'utf-8') throw new RangeError(`The "${label}" encoding is not supported.`);
}

class Utf8Encoder {
  get encoding() {
    return 'utf-8';
  }

  encode(input = '') {
    const text = String(input);
    const bytes = [];
    for (let i = 0; i < text.length; i += 1) {
      let cp = text.charCodeAt(i);
      if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < text.length) {
        const low = text.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          cp = 0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00);
          i += 1;
        }
      }
      // A lone surrogate encodes as U+FFFD, as the standard encoder does.
      if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
      if (cp < 0x80) bytes.push(cp);
      else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
      else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      else
        bytes.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f),
        );
    }
    return new Uint8Array(bytes);
  }
}

function asBytes(input) {
  if (input === undefined) return new Uint8Array(0);
  if (input instanceof Uint8Array) return input;
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return new Uint8Array(input);
}

class Utf8Decoder {
  constructor(label = 'utf-8') {
    checkLabel(label);
  }

  get encoding() {
    return 'utf-8';
  }

  decode(input) {
    const bytes = asBytes(input);
    let out = '';
    let i = 0;
    // A leading byte-order mark is not part of the text.
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
    while (i < bytes.length) {
      const b = bytes[i];
      let cp = 0xfffd;
      let need = 0;
      let min = 0;
      if (b < 0x80) cp = b;
      else if (b >= 0xc2 && b <= 0xdf) [cp, need, min] = [b & 0x1f, 1, 0x80];
      else if (b >= 0xe0 && b <= 0xef) [cp, need, min] = [b & 0x0f, 2, 0x800];
      else if (b >= 0xf0 && b <= 0xf4) [cp, need, min] = [b & 0x07, 3, 0x10000];
      i += 1;
      let ok = true;
      for (let k = 0; k < need; k += 1) {
        const c = bytes[i];
        if (c === undefined || (c & 0xc0) !== 0x80) {
          ok = false;
          break;
        }
        cp = (cp << 6) | (c & 0x3f);
        i += 1;
      }
      if (!ok || (need && (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)))) cp = 0xfffd;
      out += String.fromCodePoint(cp);
    }
    return out;
  }
}

// English plural rules (CLDR): cardinal `one` for exactly 1, ordinal
// `one`/`two`/`few` for 1st/2nd/3rd but not 11th–13th.
class EnglishPluralRules {
  constructor(_locales, options = {}) {
    this.type = options && options.type === 'ordinal' ? 'ordinal' : 'cardinal';
  }

  select(value) {
    const n = Number(value);
    if (this.type === 'cardinal') return n === 1 ? 'one' : 'other';
    if (!Number.isInteger(n)) return 'other';
    const tens = Math.abs(n) % 100;
    const units = Math.abs(n) % 10;
    if (units === 1 && tens !== 11) return 'one';
    if (units === 2 && tens !== 12) return 'two';
    if (units === 3 && tens !== 13) return 'few';
    return 'other';
  }

  resolvedOptions() {
    return {
      locale: 'en',
      type: this.type,
      minimumIntegerDigits: 1,
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
      pluralCategories: this.type === 'cardinal' ? ['one', 'other'] : ['few', 'one', 'two', 'other'],
    };
  }

  static supportedLocalesOf() {
    return ['en'];
  }
}

/**
 * Install what `target` lacks, leaving every native implementation in place.
 *
 * @param {object} [target]
 * @returns {object} the target
 */
export function installPolyfills(target = globalThis) {
  if (typeof target.structuredClone !== 'function') target.structuredClone = jsonClone;
  if (typeof target.TextEncoder !== 'function') target.TextEncoder = Utf8Encoder;
  if (typeof target.TextDecoder !== 'function') target.TextDecoder = Utf8Decoder;
  if (!target.Intl || typeof target.Intl !== 'object') target.Intl = {};
  if (typeof target.Intl.PluralRules !== 'function') target.Intl.PluralRules = EnglishPluralRules;
  return target;
}

installPolyfills(globalThis);
