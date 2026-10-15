import { describe, it, expect } from 'vitest';
import { surfaceShelf } from './shelf.js';

// unit — the pure projection from a shelf.json model to the SHELF event payload
// (storage.shelf_surface; the .tji's "shelf.json → the shelf event payload; an
// absent book stays absent", tasks/40-storage.tji:95). Pins home-book-format
// §4.2 L208-245 (two nested maps of registers; only link and label written for
// shared books), §3 L150-180 (the register envelope), §5.3 L360-367 (a
// tombstone is a well-formed register), §7 L445-463 (a device reads only its
// own local namespace). All books are written for this test (no-song-text rule).

// Well-formed §3 instants (UTC ISO-8601 to the millisecond, literal Z).
const AT1 = '2026-10-05T14:00:00.000Z';
const AT2 = '2026-10-05T15:00:00.000Z';

const THIS_DEVICE = 'dev-this';
const OTHER_DEVICE = 'dev-other';

describe('surfaceShelf (unit)', () => {
  it('passes through two shared books as nested maps of {value, at} registers (§4.2)', () => {
    const model = {
      books: {
        'b-1': {
          label: { value: 'Turma de quarta', at: AT1 },
          link: { value: 'https://example.test/b-1.git', at: AT1 },
          position: { value: 1, at: AT1 },
        },
        'b-2': {
          label: { value: 'Rodas de samba', at: AT2 },
          link: { value: 'https://example.test/b-2.git', at: AT2 },
          position: { value: 2, at: AT2 },
        },
      },
    };
    const payload = surfaceShelf(model, THIS_DEVICE);
    expect(payload.books).toEqual(model.books);
    expect(payload.local).toEqual({});
  });

  // sync.fork_follow AC7: a fork's `original` is one register whose value is an
  // object — projected whole, as are the `role` register and the rest.
  it('projects a fork\'s `original` register whole, with `role` (§4.2)', () => {
    const original = {
      bookId: 'b-orig',
      title: 'Choros de Teste',
      link: 'https://example.test/git/b-orig',
      followedAt: AT1,
      goneAt: AT2,
    };
    const out = surfaceShelf(
      {
        books: {
          'b-fork': {
            label: { value: 'Choros de Teste', at: AT1 },
            role: { value: 'owner', at: AT1 },
            original: { value: original, at: AT2 },
          },
        },
      },
      THIS_DEVICE,
    );
    expect(out.books['b-fork'].original).toEqual({ value: original, at: AT2 });
    expect(out.books['b-fork'].role).toEqual({ value: 'owner', at: AT1 });
  });

  it('narrows `local` to this device, excluding another device (§7 L445-463)', () => {
    const model = {
      local: {
        [THIS_DEVICE]: {
          'local-1': { title: { value: 'Rascunhos', at: AT1 }, position: { value: 1, at: AT1 } },
        },
        [OTHER_DEVICE]: {
          'local-9': { title: { value: 'No iPhone', at: AT2 }, position: { value: 1, at: AT2 } },
        },
      },
    };
    const payload = surfaceShelf(model, THIS_DEVICE);
    expect(payload.local).toEqual({
      'local-1': { title: { value: 'Rascunhos', at: AT1 }, position: { value: 1, at: AT1 } },
    });
    // The other device's local book never reaches this device's view.
    expect(Object.prototype.hasOwnProperty.call(payload.local, 'local-9')).toBe(false);
    expect(payload.books).toEqual({});
  });

  it('keeps a shared book present but with no `label` register — absent register stays absent', () => {
    // b-1 carries only a `link`: the book is present in the payload, but with no
    // `label` key — not defaulted, not fabricated (the consumer falls back to the
    // repository title / bookId).
    const model = {
      books: { 'b-1': { link: { value: 'https://example.test/b-1.git', at: AT1 } } },
    };
    const payload = surfaceShelf(model, THIS_DEVICE);
    expect(Object.prototype.hasOwnProperty.call(payload.books, 'b-1')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(payload.books['b-1'], 'label')).toBe(false);
    expect(payload.books['b-1']).toEqual({ link: { value: 'https://example.test/b-1.git', at: AT1 } });
  });

  it('keeps a tombstone label (value: null) — a well-formed register (§5.3)', () => {
    const model = { books: { 'b-1': { label: { value: null, at: AT2 } } } };
    const payload = surfaceShelf(model, THIS_DEVICE);
    expect(payload.books['b-1']).toEqual({ label: { value: null, at: AT2 } });
  });

  it('drops a malformed leaf at either nesting level — not {value, at}, or `at` not a §3 instant', () => {
    const model = {
      books: {
        'b-1': {
          label: { value: 'Turma de quarta', at: AT1 }, // well-formed, kept
          link: { value: 'x', at: AT1, extra: 'oops' }, // extra key → not a register, dropped
          position: { value: 2, at: 'not-an-instant' }, // `at` not a §3 instant, dropped
          nested: { child: { value: 'y', at: AT1 } }, // a map, not a register, dropped
          bare: 'just a string', // not an object, dropped
        },
      },
      local: {
        [THIS_DEVICE]: {
          'local-1': {
            title: { value: 'Rascunhos', at: AT1 }, // well-formed, kept
            position: 7, // not a register, dropped
          },
        },
      },
    };
    const payload = surfaceShelf(model, THIS_DEVICE);
    expect(payload.books['b-1']).toEqual({ label: { value: 'Turma de quarta', at: AT1 } });
    expect(payload.local['local-1']).toEqual({ title: { value: 'Rascunhos', at: AT1 } });
  });

  it('maps an empty model to the empty shelf ({} → { books: {}, local: {} })', () => {
    expect(surfaceShelf({}, THIS_DEVICE)).toEqual({ books: {}, local: {} });
  });

  it('maps a non-object model to the empty shelf (never crashes)', () => {
    expect(surfaceShelf(null, THIS_DEVICE)).toEqual({ books: {}, local: {} });
    expect(surfaceShelf([], THIS_DEVICE)).toEqual({ books: {}, local: {} });
    expect(surfaceShelf('nope', THIS_DEVICE)).toEqual({ books: {}, local: {} });
  });
});
