// Unit tests for the pure setlist display helpers (books.setlists). They pin:
//   - resolving a folder-relative item.path to a book-root path (spec §10.5;
//     memory setlist-item-path-is-folder-relative);
//   - missing-item detection against a book file set (resolved present → linked,
//     absent → missing; workflow 12 §Songs moved L83-85);
//   - display-row derivation (number, title from item.text, folder, the `key`
//     badge value, the `note`);
//   - the new-setlist filename slug from a title.
// The models are built with cifra-md's real reader, so the test is held to the
// same §10 shapes the view consumes — never a hand-rolled model.

import { describe, it, expect } from 'vitest';
import { parseSetlist } from 'cifra-md';
import {
  resolveItemPath,
  folderOf,
  bookFileSet,
  setlistRows,
  itemCount,
  setlistFilename,
} from './setlist-display.js';

describe('resolveItemPath (folder-relative → book-root, §10.5)', () => {
  it('resolves a sibling link against the setlist folder', () => {
    // The setlist lives in gigs/; `../bossa/x.cifra.md` climbs out of gigs/.
    expect(resolveItemPath('gigs/bar-do-ze.setlist.md', '../bossa/garota.cifra.md')).toBe(
      'bossa/garota.cifra.md',
    );
  });

  it('keeps a link beside a root setlist at the book root', () => {
    expect(resolveItemPath('a-short-set.setlist.md', 'morning.cifra.md')).toBe('morning.cifra.md');
  });

  it('collapses a `..` back into the setlist folder', () => {
    expect(resolveItemPath('gigs/set.setlist.md', '../gigs/x.cifra.md')).toBe('gigs/x.cifra.md');
  });

  it('drops `.` and empty segments', () => {
    expect(resolveItemPath('gigs/set.setlist.md', './choro/y.cifra.md')).toBe('gigs/choro/y.cifra.md');
  });
});

describe('folderOf', () => {
  it('returns the folder with a trailing slash', () => {
    expect(folderOf('bossa/garota.cifra.md')).toBe('bossa/');
  });
  it('returns empty at the book root', () => {
    expect(folderOf('garota.cifra.md')).toBe('');
  });
});

describe('setlistRows (display derivation + missing detection)', () => {
  const SETLIST = [
    '# Bar do Zé',
    '',
    '1. [Garota de Ipanema](../bossa/garota.cifra.md)',
    '   - key: D',
    '2. [Corcovado](../bossa/corcovado.cifra.md)',
    '   - note: start from the B section',
    '3. [Asa Branca](../choro/asa-branca.cifra.md)',
    '',
  ].join('\n');

  it('derives number, title, folder, key and note; marks the absent song missing', () => {
    const model = parseSetlist(SETLIST);
    const present = bookFileSet([
      { path: 'bossa/garota.cifra.md', status: null },
      { path: 'bossa/corcovado.cifra.md', status: null },
      // choro/asa-branca.cifra.md is NOT in the book → missing.
    ]);
    const rows = setlistRows(model, 'gigs/bar-do-ze.setlist.md', present);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      at: 0,
      number: 1,
      title: 'Garota de Ipanema',
      resolvedPath: 'bossa/garota.cifra.md',
      folder: 'bossa/',
      key: 'D',
      note: null,
      missing: false,
    });
    expect(rows[1]).toMatchObject({
      at: 1,
      number: 2,
      key: null,
      note: 'start from the B section',
      missing: false,
    });
    expect(rows[2]).toMatchObject({
      at: 2,
      number: 3,
      title: 'Asa Branca',
      resolvedPath: 'choro/asa-branca.cifra.md',
      missing: true,
    });
  });

  it('treats a deleted tree entry as absent, so its link reads missing', () => {
    const model = parseSetlist(SETLIST);
    const present = bookFileSet([
      { path: 'bossa/garota.cifra.md', status: null },
      { path: 'bossa/corcovado.cifra.md', status: 'deleted' },
      { path: 'choro/asa-branca.cifra.md', status: null },
    ]);
    const rows = setlistRows(model, 'gigs/bar-do-ze.setlist.md', present);
    expect(rows[1].missing).toBe(true); // corcovado deleted
    expect(rows[2].missing).toBe(false); // asa-branca now present
  });

  it('marks an unlinked item missing and keeps its 0-based item position', () => {
    const model = parseSetlist(
      ['# Set', '', '1. [Ok](a.cifra.md)', '2. not a link', ''].join('\n'),
    );
    const rows = setlistRows(model, 'set.setlist.md', ['a.cifra.md']);
    expect(rows[0].missing).toBe(false);
    expect(rows[1]).toMatchObject({ at: 1, number: 2, missing: true, path: null });
  });
});

describe('itemCount', () => {
  it('counts songs and unlinked items, not notes blocks', () => {
    const model = parseSetlist(
      ['# Set', '', '1. [A](a.cifra.md)', '', 'just a note', '', '2. [B](b.cifra.md)', ''].join('\n'),
    );
    expect(itemCount(model)).toBe(2);
  });
});

describe('setlistFilename (new-setlist slug)', () => {
  it('folds a title to an ASCII slug with the .setlist.md suffix', () => {
    expect(setlistFilename('Bar do Zé, 10 October')).toBe('bar-do-ze-10-october.setlist.md');
  });
  it('falls back to untitled for a title that folds to nothing', () => {
    expect(setlistFilename('   ')).toBe('untitled.setlist.md');
  });
  it('suffixes a colliding name', () => {
    expect(setlistFilename('Gig', ['gig.setlist.md'])).toBe('gig-2.setlist.md');
  });
});
