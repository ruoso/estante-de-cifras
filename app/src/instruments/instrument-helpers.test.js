import { describe, it, expect, afterEach } from 'vitest';
import { DEFAULT_LOCALE, setLocale } from '../i18n/index.js';
import {
  CATALOG,
  chipDescription,
  chipLabel,
  defaultLabel,
  inUseEntry,
  rosterEntries,
  tuningName,
  tuningText,
} from './instrument-helpers.js';

// unit — the header chip's one short label and its full-identity description
// (shell.header_chrome). Pins workflow 15 §The roster, and switching (as
// amended: the user's name, else the short name plus the tuning's name when not
// standard), workflow 15 L88-94 (the default label a new instrument stores) and
// workflow 1 §The instrument (the standard guitar reads *Guitar*).

afterEach(() => setLocale(DEFAULT_LOCALE));

// A roster entry as the Worker surfaces it: the §6 tuning text, space-separated.
const entry = (catalogId, strings, label = null) => ({ catalogId, label, tuning: tuningText(strings) });

const SHORT = {
  '6guitar': 'Guitar',
  '7guitar': '7-string guitar',
  '4bass': 'Bass',
  '5bass': '5-string bass',
  ukulele: 'Ukulele',
  cavaquinho: 'Cavaquinho',
  mandolin: 'Mandolin',
  tenorbanjo: 'Tenor banjo',
};

describe('chipLabel', () => {
  it('names each catalogue instrument at its standard tuning by its short name', () => {
    for (const cat of CATALOG) {
      expect(chipLabel(entry(cat.id, cat.tunings[0].strings)), cat.id).toBe(SHORT[cat.id]);
    }
  });

  it('adds the preset name for every non-standard preset', () => {
    for (const cat of CATALOG) {
      for (const preset of cat.tunings.slice(1)) {
        expect(chipLabel(entry(cat.id, preset.strings))).toBe(`${SHORT[cat.id]} · ${preset.name}`);
      }
    }
    expect(chipLabel(entry('6guitar', 'D2 A2 D3 G3 B3 E4'))).toBe('Guitar · Drop D');
    expect(chipLabel(entry('ukulele', 'G3 C4 E4 A4'))).toBe('Ukulele · Low G');
    expect(chipLabel(entry('7guitar', 'C2 E2 A2 D3 G3 B3 E4'))).toBe('7-string guitar · Brazilian');
  });

  it('matches tunings as pitch lists, whatever the separator', () => {
    expect(chipLabel({ catalogId: '6guitar', label: null, tuning: 'D2, A2, D3, G3, B3, E4' })).toBe('Guitar · Drop D');
  });

  it('marks a tuning that matches no preset as Custom', () => {
    expect(chipLabel(entry('6guitar', 'D2 G2 D3 G3 B3 E4'))).toBe('Guitar · Custom');
  });

  it('shortens a stored default label like no label, and keeps a user label verbatim', () => {
    expect(chipLabel(entry('6guitar', 'D2 A2 D3 G3 B3 E4', defaultLabel('6guitar', tuningName('Drop D'))))).toBe(
      'Guitar · Drop D',
    );
    // The catalogue's raw (English) names count as the default too.
    expect(chipLabel(entry('6guitar', 'E2 A2 D3 G3 B3 E4', 'Guitar (6-string) · Standard'))).toBe('Guitar');
    // A custom tuning's default label is "catalogue · §6 text".
    const custom = 'D2 G2 D3 G3 B3 E4';
    expect(chipLabel(entry('6guitar', custom, defaultLabel('6guitar', custom)))).toBe('Guitar · Custom');
    expect(chipLabel(entry('6guitar', 'D2 A2 D3 G3 B3 E4', 'My Drop D'))).toBe('My Drop D');
  });

  it('reads nothing without an entry', () => {
    expect(chipLabel(null)).toBe('');
  });
});

describe('chipDescription', () => {
  it('spells the full identity: catalogue, tuning name and pitches', () => {
    expect(chipDescription(entry('6guitar', 'E2 A2 D3 G3 B3 E4'))).toBe(
      'Guitar (6-string), Standard tuning: E2 A2 D3 G3 B3 E4',
    );
    expect(chipDescription(entry('6guitar', 'D2 A2 D3 G3 B3 E4'))).toBe(
      'Guitar (6-string), Drop D tuning: D2 A2 D3 G3 B3 E4',
    );
  });

  it('reads a custom tuning as custom, with its pitches', () => {
    expect(chipDescription(entry('ukulele', 'A4 D4 F#4 B4'))).toBe('Ukulele, custom tuning: A4 D4 F#4 B4');
  });

  it('is the same full identity under a user-chosen name', () => {
    expect(chipDescription(entry('6guitar', 'D2 A2 D3 G3 B3 E4', 'My Drop D'))).toBe(
      'Guitar (6-string), Drop D tuning: D2 A2 D3 G3 B3 E4',
    );
  });
});

describe('in Brazilian Portuguese', () => {
  it('names the standard guitar Violão and describes it in Portuguese', () => {
    setLocale('pt-BR');
    const standard = entry('6guitar', 'E2 A2 D3 G3 B3 E4');
    expect(chipLabel(standard)).toBe('Violão');
    expect(chipDescription(standard)).toBe('Violão (6 cordas), afinação Padrão: E2 A2 D3 G3 B3 E4');
    expect(chipLabel(entry('6guitar', 'D2 G2 D3 G3 B3 E4'))).toBe('Violão · Personalizada');
  });
});

// unit — the roster's rows and in-use marking (music.instruments_roster_default).
// Pins workflow 15 §The roster, and switching: the built-in standard guitar is a
// roster row from the first run, *in use* while nothing else is, and stays listed
// beside the instruments the user adds; once stored it is one ordinary row.
describe('rosterEntries', () => {
  const standard = { id: 'standard', catalogId: '6guitar', label: null, tuning: 'E2 A2 D3 G3 B3 E4' };
  const dropD = { id: 'g1', catalogId: '6guitar', label: 'My Drop D', tuning: 'D2 A2 D3 G3 B3 E4' };
  const uke = { id: 'u1', catalogId: 'ukulele', label: null, tuning: 'G4 C4 E4 A4' };

  it('lists only the built-in standard, in use, when nothing is stored', () => {
    const slice = { instruments: [], inUseId: null, standard };
    expect(rosterEntries(slice)).toEqual({ entries: [standard], inUseId: 'standard' });
  });

  it('lists the standard first, then the stored entries, with the stored in-use marked', () => {
    const slice = { instruments: [dropD, uke], inUseId: 'g1', standard };
    expect(rosterEntries(slice)).toEqual({ entries: [standard, dropD, uke], inUseId: 'g1' });
  });

  it('marks the standard in use when the in-use id is absent or dangling', () => {
    expect(rosterEntries({ instruments: [dropD], inUseId: null, standard }).inUseId).toBe('standard');
    expect(rosterEntries({ instruments: [dropD], inUseId: 'gone', standard }).inUseId).toBe('standard');
  });

  it('lists a materialized standard once, as its stored entry', () => {
    const stored = { ...standard, presetId: 'jazz' };
    const slice = { instruments: [stored, dropD], inUseId: 'standard', standard: null };
    const { entries, inUseId } = rosterEntries(slice);
    expect(entries).toEqual([stored, dropD]);
    expect(entries.filter((e) => e.id === 'standard')).toHaveLength(1);
    expect(inUseId).toBe('standard');
  });

  it('does not throw on an empty or null slice', () => {
    expect(rosterEntries(null)).toEqual({ entries: [], inUseId: null });
    expect(rosterEntries(undefined)).toEqual({ entries: [], inUseId: null });
    expect(rosterEntries({})).toEqual({ entries: [], inUseId: null });
  });

  it('agrees with inUseEntry', () => {
    for (const slice of [
      { instruments: [], inUseId: null, standard },
      { instruments: [dropD], inUseId: 'g1', standard },
      { instruments: [dropD], inUseId: 'gone', standard },
      { instruments: [standard], inUseId: 'standard', standard: null },
    ]) {
      expect(rosterEntries(slice).inUseId).toBe(inUseEntry(slice)?.id);
    }
  });
});
