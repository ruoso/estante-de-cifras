// history-view (unit) — the pure list assembly (songs.history, workflow 6 §The
// list L11-37). Pins: adjacent versions pair and carry each entry's `diff`
// summary; the oldest diffs against an empty parse; *you* is marked by the local
// no-reply email and by the stored name before sign-in; the unsaved row is
// prepended only when the save preview has changes; a resolution merge is
// labelled *merged, with your resolution* and diffed against its first parent;
// the *when* reads English as `en-GB` (day first, 24-hour — W06 L115, L137,
// songs.history_24h) and every other locale as itself.
// Fixtures are purpose-written songs, never anyone's words.

import { describe, it, expect } from 'vitest';
import { parse, diff } from 'cifra-md';
import { t } from '../i18n/index.js';
import { buildHistoryView, isYou } from './history-view.js';

// This device's own address, as the Worker marks it (`author.self`,
// account.commit_author Decision 7); the view never knows the address itself.
const OWN = '0c1d2e3f-local-author@users.estantedecifras.app';

const V1 = ['# Rua do Porto', '', '## Primeira Parte', '```', 'C', 'desci a rua', '```', ''].join('\n');
const V2 = ['# Rua do Porto', '', '## Primeira Parte', '```', 'C7', 'desci a rua', '```', ''].join('\n');

const summaryBetween = (before, after) => diff(parse(before), parse(after)).summary;

// Newest-first: V2 by Ana, then V1 (the first version) by the local identity.
const entries = () => [
  {
    commit: 'c2',
    path: 'rua-do-porto.cifra.md',
    parents: ['c1'],
    resolution: false,
    author: { name: 'Ana', email: 'ana-id@users.estantedecifras.app', self: false },
    timestamp: 1_700_000_100,
    message: 'Darker turn into the chorus',
  },
  {
    commit: 'c1',
    path: 'rua-do-porto.cifra.md',
    parents: [],
    resolution: false,
    author: { name: 'Me', email: OWN, self: true },
    timestamp: 1_700_000_000,
    message: 'First version',
  },
];
const versions = () => ({ c1: V1, c2: V2 });

describe('buildHistoryView', () => {
  it('pairs adjacent versions — each row carries the diff summary against the one before', () => {
    const { rows } = buildHistoryView({ entries: entries(), versions: versions(), identity: {}, t });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ commit: 'c2', note: 'Darker turn into the chorus' });
    expect(rows[0].summary).toBe(summaryBetween(V1, V2));
    expect(rows[0].changes).toEqual(diff(parse(V1), parse(V2)).changes);
  });

  it('the oldest version diffs against an empty parse (its New song summary)', () => {
    const { rows } = buildHistoryView({ entries: entries(), versions: versions(), identity: {}, t });
    expect(rows[1].commit).toBe('c1');
    expect(rows[1].summary).toBe(summaryBetween('', V1));
  });

  it('marks *you* by the Worker\'s `author.self`, and shows the author name otherwise', () => {
    // A stored name that matches nobody: *you* comes from the address flag alone.
    const { rows } = buildHistoryView({
      entries: entries(),
      versions: versions(),
      identity: { name: 'Nobody Here' },
      t,
    });
    expect(rows[0].isYou).toBe(false);
    expect(rows[0].who).toBe('Ana');
    expect(rows[1].isYou).toBe(true);
    expect(rows[1].who).toBe(t('history.you'));
  });

  it('marks *you* by the stored name before sign-in (no email match)', () => {
    const before = [
      {
        commit: 'x',
        path: 'p.cifra.md',
        parents: [],
        resolution: false,
        author: { name: 'Marina Souza', email: 'some-hash@users.estantedecifras.app' },
        timestamp: 1,
        message: 'First version',
      },
    ];
    const { rows } = buildHistoryView({
      entries: before,
      versions: { x: V1 },
      identity: { name: 'Marina Souza' },
      t,
    });
    expect(rows[0].isYou).toBe(true);
    expect(isYou(before[0].author, { name: 'Marina Souza' })).toBe(true);
    expect(isYou(before[0].author, { name: 'Someone Else' })).toBe(false);
  });

  // account.commit_author acceptance 6; workflow 6 L16-19: *you* by the address
  // the Worker recognises, else by the name given before sign-in.
  describe('isYou', () => {
    it('is true on `author.self`, whatever the name', () => {
      expect(isYou({ name: 'A Name', email: OWN, self: true }, { name: 'Other' })).toBe(true);
      expect(isYou({ name: 'A Name', email: OWN, self: true }, {})).toBe(true);
    });

    it('falls back to the stored name when the address is not this device\'s', () => {
      expect(
        isYou({ name: 'Marina', email: 'x@users.estantedecifras.app', self: false }, { name: 'Marina' }),
      ).toBe(true);
    });

    it('a foreign author with a different name is not *you*', () => {
      expect(
        isYou({ name: 'Ana', email: 'ana@users.estantedecifras.app', self: false }, { name: 'Marina' }),
      ).toBe(false);
      expect(isYou({ name: 'Ana', email: 'ana@users.estantedecifras.app' }, {})).toBe(false);
    });
  });

  it('prepends the unsaved row only when the preview has changes', () => {
    const previewChanges = diff(parse(V1), parse(V2)).changes;
    const withUnsaved = buildHistoryView({
      entries: entries(),
      versions: versions(),
      preview: { changes: previewChanges, summary: 'Primeira Parte: C → C7' },
      identity: {},
      t,
    }).rows;
    expect(withUnsaved).toHaveLength(3);
    expect(withUnsaved[0]).toMatchObject({ kind: 'unsaved', summary: 'Primeira Parte: C → C7' });

    const clean = buildHistoryView({
      entries: entries(),
      versions: versions(),
      preview: { changes: [], summary: '' },
      identity: {},
      t,
    }).rows;
    expect(clean.some((r) => r.kind === 'unsaved')).toBe(false);
  });

  it('labels a resolution merge and summarises it against its first parent', () => {
    const merge = [
      {
        commit: 'm',
        path: 'rua-do-porto.cifra.md',
        parents: ['p1', 'p2'],
        resolution: true,
        author: { name: 'Me', email: OWN, self: true },
        timestamp: 1_700_000_200,
        message: 'Merge branch main',
      },
    ];
    const { rows } = buildHistoryView({
      entries: merge,
      versions: { m: V2, p1: V1 },
      identity: {},
      t,
    });
    expect(rows[0].resolution).toBe(true);
    expect(rows[0].note).toBe(t('history.mergedWithResolution'));
    // Against the FIRST parent (p1 = V1), not the second.
    expect(rows[0].summary).toBe(summaryBetween(V1, V2));
  });

  it('a version whose text is not yet read carries no summary', () => {
    const { rows } = buildHistoryView({ entries: entries(), versions: {}, identity: {}, t });
    expect(rows[0].hasText).toBe(false);
    expect(rows[0].summary).toBe('');
    expect(rows[0].changes).toEqual([]);
  });
});

// songs.history_24h — the history tells the time as the rest of the app does.
// The local-time constructor keeps the hour at 16:59 under any TZ, and October
// avoids ICU's Sep/Sept variance.
describe('when', () => {
  const date = new Date(2026, 9, 2, 16, 59);
  const at = [{ ...entries()[0], timestamp: date.getTime() / 1000 }];
  const rowFor = (locale) =>
    buildHistoryView({ entries: at, versions: {}, identity: {}, t, ...(locale ? { locale } : {}) })
      .rows[0];

  it('en reads day first on a 24-hour clock (W06 "20 Sep, 18:02"; book-display.js en → en-GB)', () => {
    const row = rowFor('en');
    expect(row.when).toContain('16:59');
    expect(row.when).not.toMatch(/AM|PM/i);
    expect(row.when).toMatch(/^2 Oct/);
    // The restore dialog's date (W06 L137 "Restore the version of 20 Sep?").
    expect(row.whenDate).toBe('2 Oct');
  });

  it('an omitted locale is the app\'s English, not the runner\'s default (Constraint 3)', () => {
    const row = rowFor(undefined);
    expect(row.when).toContain('16:59');
    expect(row.when).not.toMatch(/AM|PM/i);
    expect(row.when).toMatch(/^2 Oct/);
    expect(row.whenDate).toBe('2 Oct');
  });

  it.each(['pt-BR', 'it'])('%s reads 16:59 with no AM/PM', (locale) => {
    const row = rowFor(locale);
    expect(row.when).toContain('16:59');
    expect(row.when).not.toMatch(/AM|PM/i);
  });

  it('es-419 formats as itself, as the book history does (Decision 2)', () => {
    const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    expect(rowFor('es-419').when).toBe(new Intl.DateTimeFormat('es-419', options).format(date));
  });
});
