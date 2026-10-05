import { describe, it, expect } from 'vitest';
import { surfacePreferences } from './preferences.js';

// unit — the pure projection from a preferences.json model to the PREFERENCES
// event payload (storage.preferences_surface; the .tji's "a preferences.json
// map → the event payload of {value, at} registers; an absent register stays
// absent", tasks/40-storage.tji:79). Pins home-book-format §4.1 L199-202 (a
// flat map of registers; absent until the user chooses) and §3 (the register
// envelope). All settings are written for this test (no-song-text rule).

// Two well-formed §3 instants (UTC ISO-8601 to the millisecond, literal Z).
const AT_EARLY = '2026-10-05T14:00:00.000Z';
const AT_LATE = '2026-10-05T15:00:00.000Z';

describe('surfacePreferences (unit)', () => {
  it('passes through a flat map of {value, at} registers unchanged (§4.1)', () => {
    const model = {
      theme: { value: 'palco', at: AT_EARLY },
      language: { value: 'pt-BR', at: AT_LATE },
    };
    expect(surfacePreferences(model)).toEqual({
      theme: { value: 'palco', at: AT_EARLY },
      language: { value: 'pt-BR', at: AT_LATE },
    });
  });

  it('keeps an absent register absent — never defaulted, never fabricated (§4.1 L199-202)', () => {
    // No `theme` register: the payload must have no `theme` key, so ThemeRoot
    // falls back to automatic rather than a manufactured default.
    const payload = surfacePreferences({ language: { value: 'pt-BR', at: AT_LATE } });
    expect(Object.prototype.hasOwnProperty.call(payload, 'theme')).toBe(false);
    expect(payload).toEqual({ language: { value: 'pt-BR', at: AT_LATE } });
  });

  it('keeps a tombstone register (value: null) — a well-formed register (§5.3)', () => {
    const model = { theme: { value: null, at: AT_LATE } };
    expect(surfacePreferences(model)).toEqual({ theme: { value: null, at: AT_LATE } });
  });

  it('drops a malformed top-level entry — not {value, at}, or `at` not a §3 instant', () => {
    const model = {
      theme: { value: 'palco', at: AT_EARLY }, // a well-formed register, kept
      extra: { value: 'x', at: AT_EARLY, note: 'oops' }, // extra key → not a register
      nested: { child: { value: 'y', at: AT_EARLY } }, // a map, not a register
      bad: { value: 'z', at: 'not-an-instant' }, // `at` not a §3 instant
      bare: 'just a string', // not an object at all
    };
    expect(surfacePreferences(model)).toEqual({ theme: { value: 'palco', at: AT_EARLY } });
  });

  it('maps an empty model to an empty payload ({} → {})', () => {
    expect(surfacePreferences({})).toEqual({});
  });
});
