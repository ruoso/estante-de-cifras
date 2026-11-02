import { describe, it, expect } from 'vitest';
import { checkPairCode } from './pair-code.js';

// unit (reader.pair_web) — workflow 13 §The page L387–392: the field takes the
// code in any case, with or without the dash or spaces; fewer or more than six
// letters and numbers is malformed. The alphabet is the service's (Decision 3),
// so a look-alike is well-shaped here and answered by the service.
describe('checkPairCode', () => {
  it('takes the code as typed: case, dash and spaces', () => {
    for (const typed of ['KQ7-4TM', 'kq74tm', ' kq7 4tm ', 'KQ7--4TM']) {
      expect(checkPairCode(typed).ok, typed).toBe(true);
    }
  });

  it('sends the code as typed, trimmed', () => {
    expect(checkPairCode(' kq7 4tm ')).toEqual({ ok: true, code: 'kq7 4tm' });
  });

  it('refuses fewer or more than six letters and numbers, or another character', () => {
    for (const typed of ['KQ7-4T', 'KQ7-4TMX', '', 'KQ7-4T#']) {
      expect(checkPairCode(typed).ok, typed).toBe(false);
    }
    expect(checkPairCode(undefined).ok).toBe(false);
  });

  it('leaves the alphabet to the service: a look-alike is well-shaped', () => {
    expect(checkPairCode('KQ7-4TO').ok).toBe(true);
  });
});
