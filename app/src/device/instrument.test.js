// @vitest-environment node
// unit — the reader's choice of instrument and default-shape table from the
// home book's files (reader.sync; docs/remarkable-reader.md §4
// `instrument(files)`, §4.1; docs/home-book-format.md §4.3–§4.6, "Which salt a
// reader uses").

import { describe, it, expect } from 'vitest';
import { chooseInstrument } from './instrument.js';
import { STANDARD_INSTRUMENT_ID } from '../worker/instruments.js';
import { fingerprintOf } from '../core/shape-cache.js';
import { instrumentFor } from '../songs/song-sheet.js';

const reg = (value, at = '2026-10-06T12:00:00.000Z') => ({ at, value });

const GUITAR = 'E2 A2 D3 G3 B3 E4';
const UKE = 'G4 C4 E4 A4';
const SALT = 'defaults-9';

const instruments = {
  u1: { definition: reg({ catalogId: 'ukulele', label: 'Ukulele · GCEA', tuning: UKE, fretCount: 15 }), rules: reg({ preset: 'fingerstyle' }) },
  gone: { definition: reg(null) },
};
const inUse = (id) => ({ instrumentInUse: reg(id) });

// The fingerprint the instrument as surfaced has now.
const fingerprintFor = (files) => fingerprintOf(instrumentFor(chooseInstrument(files, { salt: SALT }).entry));

const tableWith = (fingerprint, shapes = { '0 4 7': '0003' }) => ({ fingerprint, shapes });

describe('chooseInstrument — the entry (format §4.3, §4.4)', () => {
  it('takes the instrument named by instrumentInUse', () => {
    const got = chooseInstrument({ instruments, preferences: inUse('u1') }, { salt: SALT });
    expect(got.entry.id).toBe('u1');
    expect(got.entry.tuning).toBe(UKE);
  });

  it('takes the standard guitar when nothing is in use', () => {
    const got = chooseInstrument({ instruments }, { salt: SALT });
    expect(got.entry.id).toBe(STANDARD_INSTRUMENT_ID);
    expect(got.entry.tuning).toBe(GUITAR);
  });

  it('takes the standard guitar when the instrument in use was removed', () => {
    const got = chooseInstrument({ instruments, preferences: inUse('gone') }, { salt: SALT });
    expect(got.entry.id).toBe(STANDARD_INSTRUMENT_ID);
  });

  it('reads absent files as {}', () => {
    const got = chooseInstrument({}, { salt: SALT });
    expect(got).toMatchObject({ entry: { id: STANDARD_INSTRUMENT_ID }, table: null, salt: null });
    expect(chooseInstrument(undefined, { salt: SALT }).entry.id).toBe(STANDARD_INSTRUMENT_ID);
  });

  it('carries my shapes for that instrument in its entry (format §4.4)', () => {
    const shapes = { u1: { [UKE]: { C: reg('0003'), Dm: reg(null) } }, other: { [UKE]: { G: reg('0232') } } };
    const got = chooseInstrument({ instruments, preferences: inUse('u1'), shapes }, { salt: SALT });
    expect(got.entry.shapes).toEqual([{ tuning: UKE, chord: 'C', shorthand: '0003' }]);
  });
});

describe('chooseInstrument — the table (format §4.6 "Which salt a reader uses")', () => {
  const files = (bySalt) => ({
    instruments,
    preferences: inUse('u1'),
    defaultShapes: { u1: { [UKE]: bySalt } },
  });

  it("chooses the own salt's table over another's", () => {
    const fp = fingerprintFor(files({}));
    const own = tableWith(fp, { a: '0000' });
    const other = tableWith(fp, { b: '1111' });
    const got = chooseInstrument(files({ [SALT]: reg(own), 'defaults-8': reg(other, '2027-01-01T00:00:00.000Z') }), {
      salt: SALT,
    });
    expect(got.table).toEqual(own);
    expect(got.salt).toBe(SALT);
  });

  it("with the own absent, takes another salt's table of a fitting fingerprint, the latest at first", () => {
    const fp = fingerprintFor(files({}));
    const older = tableWith(fp, { old: '0000' });
    const newer = tableWith(fp, { new: '2222' });
    const got = chooseInstrument(
      files({
        'defaults-7': reg(older, '2026-10-01T00:00:00.000Z'),
        'defaults-8': reg(newer, '2026-10-05T00:00:00.000Z'),
      }),
      { salt: SALT },
    );
    expect(got.table).toEqual(newer);
    expect(got.salt).toBe('defaults-8');
  });

  it('skips a table of a fitting salt but another fingerprint', () => {
    const fp = fingerprintFor(files({}));
    const fits = tableWith(fp, { fits: '0000' });
    const got = chooseInstrument(
      files({
        'defaults-7': reg(fits, '2026-10-01T00:00:00.000Z'),
        'defaults-8': reg(tableWith('another'), '2026-10-05T00:00:00.000Z'),
      }),
      { salt: SALT },
    );
    expect(got.table).toEqual(fits);
    expect(got.salt).toBe('defaults-7');
    expect(chooseInstrument(files({ 'defaults-8': reg(tableWith('another')) }), { salt: SALT }).table).toBeNull();
  });

  it('never chooses a salt in the decommissioned list', () => {
    const fp = fingerprintFor(files({}));
    const got = chooseInstrument(files({ 'defaults-8': reg(tableWith(fp)) }), {
      salt: SALT,
      decommissioned: ['defaults-8'],
    });
    expect(got).toMatchObject({ table: null, salt: null });
  });

  it('reads a malformed table as absent', () => {
    const fp = fingerprintFor(files({}));
    const fallback = tableWith(fp, { ok: '0000' });
    for (const own of [
      reg({ fingerprint: fp }), // a table with no shapes
      reg({ fingerprint: 7, shapes: {} }), // a fingerprint that is not a string
      reg('not a table'),
      tableWith(fp), // a bare value, not a register
    ]) {
      const got = chooseInstrument(files({ [SALT]: own, 'defaults-8': reg(fallback) }), { salt: SALT });
      expect(got.table).toEqual(fallback);
      expect(got.salt).toBe('defaults-8');
    }
  });

  it('answers table null when there is nothing at all', () => {
    expect(chooseInstrument(files({}), { salt: SALT })).toMatchObject({ entry: { id: 'u1' }, table: null, salt: null });
    expect(chooseInstrument({ instruments, preferences: inUse('u1') }, { salt: SALT }).table).toBeNull();
  });
});
