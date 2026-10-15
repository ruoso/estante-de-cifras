// book-renames.test.js — the record of renamed book ids outlives a reload
// (shell.routing_rename_across_reload; DIRECTION §3.7 "The address follows
// where you are"). A fake Storage stands in for sessionStorage.
import { describe, expect, it } from 'vitest';
import {
  RENAMES_KEY,
  readRenames,
  recordRename,
  resolveBookId,
  writeRenames,
} from './book-renames.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const throwing = {
  getItem() {
    throw new DOMException('denied', 'SecurityError');
  },
  setItem() {
    throw new DOMException('full', 'QuotaExceededError');
  },
};

describe('book-renames', () => {
  it('the rename record read back after a simulated reload resolves the old id', () => {
    const storage = fakeStorage();
    const map = recordRename(readRenames(storage), 'b1', 'fork-1');
    writeRenames(storage, map);
    // The reload: a fresh read of the same storage.
    const reloaded = readRenames(storage);
    expect(resolveBookId(reloaded, 'b1')).toBe('fork-1');
    expect(resolveBookId(reloaded, 'other')).toBe('other');
  });

  it('follows a chain of renames', () => {
    const map = new Map();
    recordRename(map, 'b1', 'fork-1');
    recordRename(map, 'fork-1', 'sr_x');
    expect(resolveBookId(map, 'b1')).toBe('sr_x');
    expect(resolveBookId(map, 'fork-1')).toBe('sr_x');
  });

  it('a cycle in a hand-written record terminates', () => {
    const storage = fakeStorage({ [RENAMES_KEY]: JSON.stringify([['a', 'b'], ['b', 'a']]) });
    const map = readRenames(storage);
    expect(map.size).toBe(2);
    expect(['a', 'b']).toContain(resolveBookId(map, 'a'));
  });

  it('recordRename drops a record whose old id is the new id', () => {
    const map = new Map();
    recordRename(map, 'b1', 'fork-1');
    recordRename(map, 'fork-1', 'b1');
    expect(map.has('b1')).toBe(false);
    expect(resolveBookId(map, 'fork-1')).toBe('b1');
    expect(resolveBookId(map, 'b1')).toBe('b1');
  });

  it.each([
    ['absent key', fakeStorage()],
    ['malformed JSON', fakeStorage({ [RENAMES_KEY]: '[["b1",' })],
    ['a non-array', fakeStorage({ [RENAMES_KEY]: '{"b1":"fork-1"}' })],
    ['a pair that is not two strings', fakeStorage({ [RENAMES_KEY]: '[["b1",7]]' })],
    ['a pair of three', fakeStorage({ [RENAMES_KEY]: '[["b1","fork-1","x"]]' })],
    ['a pair that is not an array', fakeStorage({ [RENAMES_KEY]: '["b1"]' })],
    ['no storage', undefined],
  ])('reads %s as an empty record', (_name, storage) => {
    expect(readRenames(storage).size).toBe(0);
  });

  it('a storage that throws reads empty and writes without throwing', () => {
    expect(readRenames(throwing).size).toBe(0);
    const map = recordRename(new Map(), 'b1', 'fork-1');
    expect(() => writeRenames(throwing, map)).not.toThrow();
    expect(resolveBookId(map, 'b1')).toBe('fork-1');
  });

  it('writes book ids only, as [old, new] pairs under one key', () => {
    const storage = fakeStorage();
    writeRenames(storage, recordRename(new Map(), 'b1', 'fork-1'));
    expect(JSON.parse(storage.getItem(RENAMES_KEY))).toEqual([['b1', 'fork-1']]);
  });
});
