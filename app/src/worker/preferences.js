// preferences.js — the pure projection from the home book's preferences.json
// model to the PREFERENCES event payload (storage.preferences_surface).
// home-book-format §4.1: preferences.json is "a flat map of singleton
// preferences, each a register." This projects that model to the payload the
// `preferences` slice carries — the flat map of `{value, at}` registers
// shell.tokens defined (protocol.js L39-42; reducer.js:120-125).
//
// The one rule it enforces is §3's register envelope: a top-level entry
// surfaces only if it passes `isRegister` — "an object is a register iff its
// keys are exactly `value` and `at` with `at` a well-formed instant." An absent
// key stays absent (never defaulted or fabricated — §4.1 L199-202, which is
// what lets ThemeRoot fall back to automatic), and a malformed entry is dropped
// rather than surfaced (a malformed home book is the validator's concern,
// hook.home_book — not something to put into the slice or crash the surface).
// A tombstone (`{ value: null, at }`) is a well-formed register (§5.3) and is
// kept; the resolver treats a `null` chosen theme as automatic.
//
// Pure: no I/O, no logging, no song text, no preference values in any message
// (standing rules). Plain ESM, Worker-only; imports only `isRegister`.

import { isRegister } from './home-book-merge.js';

/**
 * Project a preferences.json model to the PREFERENCES event payload: a new flat
 * map holding each top-level entry of `model` that is a §3 register, dropping
 * anything else. `{}` → `{}`; a non-object model → `{}`.
 *
 * @param {Object} model the parsed preferences.json (an absent file is `{}`)
 * @returns {Object<string, { value: *, at: string }>}
 */
export function surfacePreferences(model) {
  const payload = {};
  if (!model || typeof model !== 'object' || Array.isArray(model)) return payload;
  for (const key of Object.keys(model)) {
    if (isRegister(model[key])) payload[key] = model[key];
  }
  return payload;
}
