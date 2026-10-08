import { describe, it, expect, beforeAll } from 'vitest';
import { syncDisplayFor, anyOutOfStep } from './sync-display.js';
import { t, setLocale } from './i18n/index.js';

// unit — "deriving each state" (the .tji note's unit clause): the pure mapping
// from the engine's per-book `sync` facts to the one workflow-8 word + class +
// dot the shelf renders. Pins workflow 8 "What the shelf says" L28-37, mockup
// W08 L239-242, theme.css L175-197. No React, no store — `t` is passed in and
// the English locale is pinned so the words are exact. All ids are opaque
// strings written for this test.

beforeAll(() => setLocale('en'));

// A last-in-step instant built from LOCAL wall-clock parts, so the HH:MM the
// derivation reads (local time, the user's own) is "09:40" regardless of the CI
// machine's timezone (sync-display.js `timeOf`).
const lastInStepAt = (h, m) => new Date(2026, 9, 7, h, m, 0).toISOString();

describe('syncDisplayFor — deriving each state (workflow 8 L28-34)', () => {
  it('in_step renders nothing (null)', () => {
    expect(syncDisplayFor({ phase: 'in_step' }, { t })).toBeNull();
  });

  it('an absent or unknown phase renders nothing', () => {
    expect(syncDisplayFor(undefined, { t })).toBeNull();
    expect(syncDisplayFor({}, { t })).toBeNull();
    expect(syncDisplayFor({ phase: 'something_else' }, { t })).toBeNull();
  });

  it('syncing → "syncing", the neutral .badge (no class, no dot)', () => {
    const atom = syncDisplayFor({ phase: 'syncing' }, { t });
    expect(atom).toMatchObject({ kind: 'syncing', word: 'syncing', cls: '', dot: false });
  });

  it('saves_waiting → "N save(s) waiting to go up" (.badge.unsaved), singular vs plural by count', () => {
    const one = syncDisplayFor({ phase: 'saves_waiting', savesWaiting: 1 }, { t });
    expect(one).toMatchObject({
      kind: 'saves_waiting',
      word: '1 save waiting to go up',
      cls: 'unsaved',
      dot: false,
      count: 1,
    });
    const many = syncDisplayFor({ phase: 'saves_waiting', savesWaiting: 2 }, { t });
    expect(many.word).toBe('2 saves waiting to go up');
    expect(many.count).toBe(2);
  });

  it('offline with a known lastInStep → "offline since HH:MM" (neutral .badge)', () => {
    const atom = syncDisplayFor({ phase: 'offline', lastInStep: lastInStepAt(9, 40) }, { t });
    expect(atom).toMatchObject({ kind: 'offline', word: 'offline since 09:40', cls: '', dot: false });
    expect(atom.since).toBe('09:40');
  });

  it('offline without a lastInStep → plain "offline" (never in step this session)', () => {
    const atom = syncDisplayFor({ phase: 'offline', lastInStep: null }, { t });
    expect(atom).toMatchObject({ kind: 'offline', word: 'offline', cls: '', dot: false });
    expect(atom.since).toBeUndefined();
  });

  it('needs_you → "needs you" on .badge.conflict with the attention dot', () => {
    const atom = syncDisplayFor({ phase: 'needs_you' }, { t });
    expect(atom).toMatchObject({ kind: 'needs_you', word: 'needs you', cls: 'conflict dot', dot: true });
  });

  it('gone → "no longer shared with you" on .badge.conflict with the dot', () => {
    const atom = syncDisplayFor({ phase: 'gone' }, { t });
    expect(atom).toMatchObject({
      kind: 'gone',
      word: 'no longer shared with you',
      cls: 'conflict dot',
      dot: true,
    });
  });
});

describe('anyOutOfStep — the header quiet mark (workflow 8 L36-37)', () => {
  it('is false when every shelf book is in step (or the slice is empty)', () => {
    expect(anyOutOfStep({})).toBe(false);
    expect(anyOutOfStep({ 'b-1': { phase: 'in_step' }, 'b-2': { phase: 'in_step' } })).toBe(false);
  });

  it('is true when some shelf book is out of step', () => {
    expect(anyOutOfStep({ 'b-1': { phase: 'in_step' }, 'b-2': { phase: 'offline' } })).toBe(true);
    expect(anyOutOfStep({ 'b-1': { phase: 'needs_you' } })).toBe(true);
    expect(anyOutOfStep({ 'b-1': { phase: 'saves_waiting', savesWaiting: 1 } })).toBe(true);
  });

  it('excludes the home book — personal state is not a shelf book (Constraints "Songbooks only")', () => {
    // The home book emits sync facts too, but the shelf mark is about shelf books.
    expect(anyOutOfStep({ home: { phase: 'offline' } })).toBe(false);
    expect(anyOutOfStep({ home: { phase: 'offline' }, 'b-1': { phase: 'in_step' } })).toBe(false);
    expect(anyOutOfStep({ home: { phase: 'offline' }, 'b-1': { phase: 'gone' } })).toBe(true);
  });
});
