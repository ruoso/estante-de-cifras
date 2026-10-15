// reload-step.test.js — which entries from before a reload Back passes over
// (shell.routing_reload_scope_step). Pins DIRECTION §3.7 "The address follows
// where you are" (the screens over a place are steps in history but not
// addresses) and workflow 2 §Scope (a one-book scope is shown, never skipped).
import { describe, expect, it } from 'vitest';
import { isDeadStep, reloadRecord } from './reload-step.js';

const SONG = { bookId: 'b1', path: 'choro/tarde-clara.cifra.md' };
const OTHER = { bookId: 'b1', path: 'choro/noite-alta.cifra.md' };
const SETLIST = { bookId: 'b1', path: 'sabado.setlist.md' };
const UNSCOPED = { tab: 'search', song: SONG };
const SCOPED = { tab: 'search', book: 'b1', song: SONG };

const record = (place, layers, depth = 3) => ({ place, layers, depth });
const entry = (place, layers = [], depth = 2) => ({ place, layers, depth });

describe('reloadRecord', () => {
  it('returns the place and layers of a state with layers', () => {
    expect(reloadRecord({ place: SCOPED, layers: ['editor'], depth: 2 })).toEqual({
      place: SCOPED,
      layers: ['editor'],
      depth: 2,
    });
  });

  it('returns null for no state, a state not ours, and nothing dropped', () => {
    expect(reloadRecord(null)).toBeNull();
    expect(reloadRecord({ dev: 'hash' })).toBeNull();
    expect(reloadRecord({ place: SCOPED, layers: [], depth: 2 })).toBeNull();
  });

  it('returns the record an earlier reload carried when the layers are empty', () => {
    const carried = record(UNSCOPED, ['editor'], 2);
    expect(reloadRecord({ place: SCOPED, layers: [], depth: 2, reloaded: carried })).toEqual(carried);
  });
});

describe('isDeadStep', () => {
  it('the entry below a reload under the editor is dead', () => {
    expect(isDeadStep(entry(UNSCOPED), record(UNSCOPED, ['editor']))).toBe(true);
  });

  it('an entry naming a dropped layer is dead', () => {
    expect(isDeadStep(entry(SCOPED, ['arrange']), record(SCOPED, ['wizard', 'arrange']))).toBe(true);
  });

  it('a scope-only step is kept, either way round', () => {
    expect(isDeadStep(entry(UNSCOPED), record(SCOPED, ['editor']))).toBe(false);
    expect(isDeadStep(entry(SCOPED), record(UNSCOPED, ['editor']))).toBe(false);
  });

  it('a tab-only step is kept', () => {
    expect(isDeadStep(entry({ tab: 'books', song: SONG }), record(UNSCOPED, ['editor']))).toBe(false);
  });

  it('another song or a setlist is kept', () => {
    expect(isDeadStep(entry({ tab: 'search', song: OTHER }), record(UNSCOPED, ['editor']))).toBe(false);
    expect(isDeadStep(entry({ tab: 'setlists', setlist: SETLIST }), record(UNSCOPED, ['editor']))).toBe(false);
    expect(
      isDeadStep(entry({ tab: 'setlists', setlist: SETLIST }), record({ tab: 'setlists' }, ['play'])),
    ).toBe(false);
  });

  it('a layer the reload did not drop is kept', () => {
    expect(isDeadStep(entry(UNSCOPED, ['history']), record(UNSCOPED, ['editor']))).toBe(false);
  });

  it('nothing dropped, nothing dead', () => {
    expect(isDeadStep(entry(UNSCOPED), null)).toBe(false);
  });

  it('depth bounds: depth 0 and depth at or above the record are never dead', () => {
    const rec = record(UNSCOPED, ['editor'], 3);
    expect(isDeadStep(entry(UNSCOPED, [], 0), rec)).toBe(false);
    expect(isDeadStep(entry(UNSCOPED, [], 3), rec)).toBe(false);
    expect(isDeadStep(entry(UNSCOPED, [], 4), rec)).toBe(false);
    expect(isDeadStep(entry(UNSCOPED, [], 1), rec)).toBe(true);
  });

  it('a renamed book: the entry names the old id and the record the new one', () => {
    const rename = (id) => (id === 'b1' ? 'fork-1' : id);
    const forked = { tab: 'search', book: 'fork-1', song: { ...SONG, bookId: 'fork-1' } };
    expect(isDeadStep(entry(SCOPED), record(forked, ['editor']), rename)).toBe(true);
    expect(isDeadStep(entry(SCOPED), record(forked, ['editor']))).toBe(false);
  });
});
