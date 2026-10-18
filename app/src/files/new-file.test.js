// Unit — the file view's *New* menu helpers (books.file_view_create_menu,
// workflow 14 §What can be done to a file L147-171; workflow 3 L32-33).
// Fixtures are purpose-written names (*Rehearsal set*, `ensaios/`).
import { describe, it, expect } from 'vitest';
import { parseSetlist, writeSetlist } from 'cifra-md';
import {
  setlistTemplate,
  readmeTemplate,
  newSetlistPath,
  folderNameProblem,
  namesIn,
  createChoices,
  folderBeingLookedAt,
} from './new-file.js';

describe('setlistTemplate (workflow 14 L147-171: a setlist starts with only its title; Constraint 4)', () => {
  it('is the canonical setlist of its title and nothing else', () => {
    const text = setlistTemplate('Rehearsal set');
    expect(text).toBe(writeSetlist({ title: 'Rehearsal set', properties: [], body: [] }));
    const model = parseSetlist(text);
    expect(model.title).toBe('Rehearsal set');
    expect(model.body.filter((el) => el.type === 'song' || el.type === 'unlinked')).toEqual([]);
  });
});

describe('readmeTemplate (workflow 14 §What a new book starts with; DIRECTION §2.1 L74)', () => {
  it('holds the book title as a level-1 heading', () => {
    expect(readmeTemplate('Example Book')).toBe('# Example Book\n');
  });
});

describe('newSetlistPath (the delta: named as it is made, -2 when taken)', () => {
  it('slugs the title into the folder', () => {
    expect(newSetlistPath('ensaios', 'Rehearsal set', [])).toBe('ensaios/rehearsal-set.setlist.md');
  });
  it('takes -2 when the first name is taken', () => {
    expect(newSetlistPath('', 'Rehearsal set', ['rehearsal-set.setlist.md'])).toBe(
      'rehearsal-set-2.setlist.md',
    );
  });
  it('falls back to untitled for a title with no letters', () => {
    expect(newSetlistPath(null, '!!!', [])).toBe('untitled.setlist.md');
  });
});

describe('folderNameProblem (Decision 4: one path segment)', () => {
  it('accepts a plain name', () => {
    expect(folderNameProblem('ensaios', [])).toBeNull();
    expect(folderNameProblem('  ensaios  ', ['choro'])).toBeNull();
  });
  it('names each problem', () => {
    expect(folderNameProblem('', [])).toBe('blank');
    expect(folderNameProblem('   ', [])).toBe('blank');
    expect(folderNameProblem('a/b', [])).toBe('slash');
    expect(folderNameProblem('.', [])).toBe('dots');
    expect(folderNameProblem('..', [])).toBe('dots');
    expect(folderNameProblem('.git', [])).toBe('hidden');
    expect(folderNameProblem('choro', ['choro'])).toBe('taken');
    expect(folderNameProblem('README.md', new Set(['README.md']))).toBe('taken');
  });
});

describe('namesIn', () => {
  it('lists the files and folders directly in a folder', () => {
    const paths = ['README.md', 'choro/a.cifra.md', 'choro/deep/b.cifra.md', 'mpb/c.cifra.md'];
    expect([...namesIn(paths, '')].sort()).toEqual(['README.md', 'choro', 'mpb']);
    expect([...namesIn(paths, 'choro')].sort()).toEqual(['a.cifra.md', 'deep']);
  });
});

describe('createChoices (Acceptance 1; the delta: README offered only when the book has none)', () => {
  const readme = (entries) => createChoices(entries).find((c) => c.id === 'readme').enabled;
  it('offers the four kinds in the board order', () => {
    expect(createChoices([]).map((c) => c.id)).toEqual(['song', 'setlist', 'folder', 'readme']);
  });
  it('enables README with none at the root', () => {
    expect(readme([{ path: 'a.cifra.md', status: null }])).toBe(true);
  });
  it('enables README when the root one is only deleted', () => {
    expect(readme([{ path: 'README.md', status: 'deleted' }])).toBe(true);
  });
  it('disables README when one is present', () => {
    expect(readme([{ path: 'README.md', status: null }])).toBe(false);
    expect(readme([{ path: 'README.md', status: 'unsaved' }])).toBe(false);
  });
  it('is not disabled by a README.md in a subfolder', () => {
    expect(readme([{ path: 'choro/README.md', status: null }])).toBe(true);
  });
});

describe('folderBeingLookedAt (workflow 3 L32-33; Constraint 2)', () => {
  it('is the chosen folder first', () => {
    expect(folderBeingLookedAt({ chosenFolder: 'ensaios', selectedPath: 'choro/a.cifra.md' })).toBe('ensaios');
  });
  it('else the selected file’s folder', () => {
    expect(folderBeingLookedAt({ chosenFolder: null, selectedPath: 'choro/a.cifra.md' })).toBe('choro');
    expect(folderBeingLookedAt({ selectedPath: 'a.cifra.md' })).toBe('');
  });
  it('else the root', () => {
    expect(folderBeingLookedAt({})).toBe('');
  });
});
