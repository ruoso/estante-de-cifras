import { describe, it, expect, beforeAll } from 'vitest';
import {
  titleFor,
  whereFor,
  canSaveFor,
  orderedBooks,
  originalOf,
  forkLineFor,
  saveTargetFor,
  broughtInOn,
  fillDisplayFor,
  elsewhereCopyFor,
  thisDeviceFor,
} from './book-display.js';
import { t, setLocale } from '../i18n/index.js';

// unit — the pure display/ordering helper for the book-management screen
// (books.shelf, the added level: a genuine pure module). Pins workflow 7 L16-21
// and home-book-format §4.2 (`position`), §5.3 (tombstones). All names are
// written for this test (no-song-text rule; a label is a user's words).

const AT = '2026-10-05T14:00:00.000Z';
const reg = (value) => ({ value, at: AT });

describe('book-display: titleFor (title or label — workflow 7 L16-18; §5.3)', () => {
  it('returns a shared book’s label when present and non-tombstone', () => {
    expect(titleFor({ label: reg('Choros da Ana') }, 'b-1')).toBe('Choros da Ana');
  });

  it('returns a local book’s title when present and non-tombstone', () => {
    expect(titleFor({ title: reg('Exercícios de violão') }, 'l-1')).toBe('Exercícios de violão');
  });

  it('falls back to the bookId for an absent register', () => {
    expect(titleFor({}, 'b-9')).toBe('b-9');
    expect(titleFor(undefined, 'b-9')).toBe('b-9');
  });

  it('falls back to the bookId for a tombstoned (value: null) or empty register (§5.3)', () => {
    expect(titleFor({ label: reg(null) }, 'b-1')).toBe('b-1');
    expect(titleFor({ title: reg('') }, 'l-1')).toBe('l-1');
  });
});

describe('book-display: whereFor / canSaveFor (where it lives / can save — workflow 7 L19-20)', () => {
  it('maps a local book to on this device and can save', () => {
    expect(whereFor('local')).toBe('onDevice');
    expect(canSaveFor('local', {})).toBe(true);
  });

  it('maps a shared book to on Estante, its role from the membership seam', () => {
    expect(whereFor('shared')).toBe('onEstante');
    // editor can save, reader cannot, an absent role is the unfilled seam.
    expect(canSaveFor('shared', { role: reg('editor') })).toBe(true);
    expect(canSaveFor('shared', { role: reg('reader') })).toBe(false);
    expect(canSaveFor('shared', {})).toBe(null);
  });
});

// The sync badge no longer reads the `shelf` slice: the placeholder `syncStateFor`
// (over a `book.sync.value` register `shelf_surface` never populated) is retired
// and the live derivation lives in `sync-display.js`, unit-tested in
// sync-display.test.js against the engine's real `sync` facts (sync.states).

describe('book-display: orderedBooks (shelf order — home-book-format §4.2 `position`)', () => {
  it('orders shared and local books ascending by position', () => {
    const shelf = {
      books: { 'b-1': { label: reg('B'), position: reg(2) } },
      local: {
        'l-1': { title: reg('L'), position: reg(0) },
        'l-2': { title: reg('M'), position: reg(1) },
      },
    };
    expect(orderedBooks(shelf).map((e) => e.id)).toEqual(['l-1', 'l-2', 'b-1']);
  });

  it('carries each book’s kind (local vs shared)', () => {
    const shelf = {
      books: { 'b-1': { position: reg(1) } },
      local: { 'l-1': { position: reg(0) } },
    };
    const kinds = Object.fromEntries(orderedBooks(shelf).map((e) => [e.id, e.kind]));
    expect(kinds).toEqual({ 'l-1': 'local', 'b-1': 'shared' });
  });

  it('breaks ties stably by id', () => {
    const shelf = {
      books: {},
      local: {
        'l-b': { position: reg(0) },
        'l-a': { position: reg(0) },
      },
    };
    expect(orderedBooks(shelf).map((e) => e.id)).toEqual(['l-a', 'l-b']);
  });

  it('puts a book with no position last (stable by id)', () => {
    const shelf = {
      books: { 'b-x': {} },
      local: { 'l-1': { position: reg(0) }, 'l-z': {} },
    };
    expect(orderedBooks(shelf).map((e) => e.id)).toEqual(['l-1', 'b-x', 'l-z']);
  });

  it('is empty for an empty shelf', () => {
    expect(orderedBooks({})).toEqual([]);
    expect(orderedBooks({ books: {}, local: {} })).toEqual([]);
  });

  it('drops a fully-tombstoned entry — a book put online or removed (books.online; §5.3)', () => {
    // A removed local book (title + position tombstoned) and a book that was put
    // online (its local entry tombstoned, a new hosted entry written) must not
    // ghost; a truly empty entry and a label-less-but-positioned book stay.
    const shelf = {
      books: {
        'srv-1': { label: reg('Now hosted'), position: reg(2), role: reg('owner') },
        'b-empty': {},
      },
      local: {
        'l-live': { title: reg('Still here'), position: reg(0) },
        'l-gone': { title: reg(null), position: reg(null) },
      },
    };
    expect(orderedBooks(shelf).map((e) => e.id)).toEqual(['l-live', 'srv-1', 'b-empty']);
  });
});

// books.fork — what a fork's shelf row says about its original (W11 board #2
// :68-97 and #4 :153; workflow 11 §What a fork is, §Following the original).
describe('book-display: a fork’s shelf lines (books.fork; W11 board #2, #4)', () => {
  beforeAll(() => setLocale('en'));
  const ORIGINAL = { bookId: 'srv-orig', title: 'Choros da Ana', link: 'https://x/git/srv-orig', followedAt: AT };
  const fork = (original) => ({ label: reg('Choros da Ana'), role: reg('owner'), original: reg(original) });

  it('is null for a book that is not a fork, or whose original was tombstoned', () => {
    expect(forkLineFor({ label: reg('Banda do Bairro') }, undefined)).toBeNull();
    expect(forkLineFor({ original: reg(null) }, undefined)).toBeNull();
    expect(originalOf({})).toBeNull();
  });

  it('gives the meta line *from {original}*', () => {
    const line = forkLineFor(fork(ORIGINAL), undefined);
    expect(line).toEqual({ from: 'Choros da Ana', newSaves: 0, gone: false });
    expect(t('books.fromOriginal', { original: line.from })).toBe('from Choros da Ana');
  });

  it('gives the *N new saves* line from the originals slice, with its singular', () => {
    const three = forkLineFor(fork(ORIGINAL), { newSaves: 3, gone: false });
    expect(three.newSaves).toBe(3);
    expect(t('books.originalNewSaves', { original: three.from, count: 3 })).toBe(
      'Choros da Ana has 3 new saves.',
    );
    const one = forkLineFor(fork(ORIGINAL), { newSaves: 1, gone: false });
    expect(t('books.originalNewSaves', { original: one.from, count: one.newSaves })).toBe(
      'Choros da Ana has 1 new save.',
    );
    expect(forkLineFor(fork(ORIGINAL), { newSaves: 0, gone: false }).newSaves).toBe(0);
  });

  it('says *original no longer shared* once `goneAt` is set — and counts nothing after', () => {
    const line = forkLineFor(fork({ ...ORIGINAL, goneAt: AT }), { newSaves: 2, gone: false });
    expect(line.gone).toBe(true);
    expect(line.newSaves).toBe(0);
    expect(t('books.originalNoLongerShared')).toBe('original no longer shared');
    // The live ORIGINAL fact says so before the register re-surfaces.
    expect(forkLineFor(fork(ORIGINAL), { newSaves: 0, gone: true }).gone).toBe(true);
  });
});

// books.fork Constraint 7 — every save sheet host asks the shelf whether a save
// can go there (workflow 4 §A book the user cannot push to).
describe('book-display: saveTargetFor (books.fork Constraint 7)', () => {
  const shelf = {
    books: {
      'srv-r': { label: reg('Turma de quarta'), role: reg('reader') },
      'srv-e': { label: reg('Banda do Bairro'), role: reg('editor') },
    },
    local: { 'l-1': { title: reg('My songs') } },
  };
  it('is false for a reader’s book, with its label', () => {
    expect(saveTargetFor(shelf, 'srv-r')).toEqual({ canSave: false, label: 'Turma de quarta' });
  });
  it('is true for an editor’s or a local book, and for a book with no shelf entry', () => {
    expect(saveTargetFor(shelf, 'srv-e').canSave).toBe(true);
    expect(saveTargetFor(shelf, 'l-1').canSave).toBe(true);
    expect(saveTargetFor(shelf, 'nowhere')).toEqual({ canSave: true, label: 'nowhere' });
  });
});

// books.bring_in Constraint 7 — the gone card's *last brought in on {date}* (W11
// board #4 :169; workflow 11 §When the original goes away). Midday instants, so
// the day is the same in every test timezone.
describe('book-display: broughtInOn (books.bring_in Constraint 7)', () => {
  const NOW = new Date('2026-10-15T12:00:00.000Z');
  it('is day and long month in en for a date this year (*28 September*)', () => {
    expect(broughtInOn('2026-09-28T12:00:00.000Z', 'en', NOW)).toBe('28 September');
  });
  it('adds the year for a date in a past year', () => {
    expect(broughtInOn('2025-09-28T12:00:00.000Z', 'en', NOW)).toBe('28 September 2025');
  });
  it('words the date in the given locale', () => {
    expect(broughtInOn('2026-09-28T12:00:00.000Z', 'pt-BR', NOW)).toBe('28 de setembro');
  });
  it('is null for a missing or invalid followedAt (the card drops the date clause)', () => {
    expect(broughtInOn(undefined, 'en', NOW)).toBeNull();
    expect(broughtInOn('', 'en', NOW)).toBeNull();
    expect(broughtInOn('not a date', 'en', NOW)).toBeNull();
    expect(broughtInOn(42, 'en', NOW)).toBeNull();
  });
});

// account.new_device — the shelf filling and the *only on your …* rows
// (workflow 13 §What comes down, §Books that were only on the other device,
// delta: a device named by its kind; W13 board frame 2).
describe('book-display: a new device (account.new_device)', () => {
  beforeAll(() => setLocale('en'));

  it('words the only-on row for each kind', () => {
    const cases = {
      iphone: 'Only on your iPhone: Rascunhos',
      ipad: 'Only on your iPad: Rascunhos',
      'android-phone': 'Only on your Android phone: Rascunhos',
      'android-tablet': 'Only on your Android tablet: Rascunhos',
      mac: 'Only on your Mac: Rascunhos',
      windows: 'Only on your Windows computer: Rascunhos',
      linux: 'Only on your Linux computer: Rascunhos',
      chromebook: 'Only on your Chromebook: Rascunhos',
    };
    for (const [kind, line] of Object.entries(cases)) {
      expect(elsewhereCopyFor({ title: 'Rascunhos', kind }, { t })).toEqual({
        line,
        help: 'Put it online there to have it here.',
      });
    }
  });

  it('a device it cannot tell is another device', () => {
    expect(elsewhereCopyFor({ title: 'Rascunhos', kind: 'other' }, { t }).line).toBe(
      'Only on another device: Rascunhos',
    );
    expect(elsewhereCopyFor({ title: 'Rascunhos', kind: 'toaster' }, { t }).line).toBe(
      'Only on another device: Rascunhos',
    );
  });

  it('words this device by its kind', () => {
    expect(thisDeviceFor('android-tablet', { t })).toBe('This tablet');
    expect(thisDeviceFor('iphone', { t })).toBe('This iPhone');
    expect(thisDeviceFor('other', { t })).toBe('This device');
    expect(thisDeviceFor(undefined, { t })).toBe('This device');
  });

  it('words each fill state: ready (with its songs), cloning 45%, waiting', () => {
    expect(fillDisplayFor({ state: 'ready', progress: 100, songs: 21 }, { t })).toEqual({
      state: 'ready',
      word: 'ready',
      meta: '21 songs · searchable',
      cls: 'ok',
      percent: null,
    });
    expect(fillDisplayFor({ state: 'ready', songs: 1 }, { t }).meta).toBe('1 song · searchable');
    expect(fillDisplayFor({ state: 'cloning', progress: 45 }, { t })).toEqual({
      state: 'cloning',
      word: 'cloning 45%',
      meta: 'songs searchable as they arrive',
      cls: '',
      percent: 45,
    });
    expect(fillDisplayFor({ state: 'waiting', progress: 0 }, { t })).toEqual({
      state: 'waiting',
      word: 'waiting',
      meta: 'next in line',
      cls: '',
      percent: null,
    });
  });

  it('is nothing for a book that is not filling', () => {
    expect(fillDisplayFor(undefined, { t })).toBeNull();
    expect(fillDisplayFor({ state: 'something' }, { t })).toBeNull();
  });
});
