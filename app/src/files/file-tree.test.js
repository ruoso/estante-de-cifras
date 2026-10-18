// Unit — the pure file-tree display helpers (books.file_view, workflow 14
// L24-29, L134-138, L141-143). Fixtures are purpose-written paths.
import { describe, it, expect } from 'vitest';
import { buildTree, fileKind, statusWord } from './file-tree.js';

describe('fileKind', () => {
  it('derives the kind, and excludes anything a book may not hold (workflow 14 L24-29)', () => {
    expect(fileKind('valsa.cifra.md')).toBe('song');
    expect(fileKind('gigs.setlist.md')).toBe('setlist');
    expect(fileKind('README.md')).toBe('readme');
    expect(fileKind('.gitattributes')).toBe('gitattributes');
    // Not an allowed kind.
    expect(fileKind('notes.txt')).toBeNull();
    expect(fileKind('cover.png')).toBeNull();
    expect(fileKind('.cifra.md')).toBeNull(); // no base name
    expect(fileKind('config')).toBeNull();
  });
});

describe('buildTree', () => {
  it('assembles folders, orders folders-then-files alphabetically, and drops other kinds (workflow 14 L24-29, L141-143)', () => {
    const nodes = buildTree([
      { path: 'README.md', status: null },
      { path: '.gitattributes', status: null },
      { path: 'mpb/valsa.cifra.md', status: 'unsaved' },
      { path: 'mpb/choro.cifra.md', status: null },
      { path: 'gigs/ensaio.setlist.md', status: 'new' },
      { path: '.git/config', status: null }, // excluded (not an allowed kind)
      { path: 'cover.png', status: null }, // excluded
    ]);
    // Depth-first, folders (alphabetical) before files (alphabetical) at each
    // level; root files last.
    expect(nodes.map((n) => `${n.type}:${n.path}`)).toEqual([
      'folder:gigs',
      'file:gigs/ensaio.setlist.md',
      'folder:mpb',
      'file:mpb/choro.cifra.md',
      'file:mpb/valsa.cifra.md',
      'file:.gitattributes',
      'file:README.md',
    ]);
    // Depths and status carry through.
    const valsa = nodes.find((n) => n.path === 'mpb/valsa.cifra.md');
    expect(valsa).toMatchObject({ type: 'file', depth: 1, status: 'unsaved', kind: 'song' });
    expect(nodes.find((n) => n.path === 'mpb').depth).toBe(0);
  });

  it('adds the view-held folders, empty until a file is under them (books.file_view_create_menu Decision 3; workflow 14 §Statuses)', () => {
    const nodes = buildTree([{ path: 'mpb/valsa.cifra.md', status: null }], ['ensaios', 'mpb', 'a/b']);
    expect(nodes.map((n) => `${n.type}:${n.path}:${n.empty ?? ''}`)).toEqual([
      'folder:a:true',
      'folder:a/b:true',
      'folder:ensaios:true',
      'folder:mpb:false',
      'file:mpb/valsa.cifra.md:',
    ]);
    // Once a file is in it, it is the tree's own folder row.
    const later = buildTree([{ path: 'ensaios/x.setlist.md', status: 'new' }], ['ensaios']);
    expect(later.find((n) => n.path === 'ensaios').empty).toBe(false);
  });
});

describe('statusWord', () => {
  it('maps each status to its copy key, and nothing for in-step (workflow 14 L134-138; mockups README L26)', () => {
    expect(statusWord('unsaved')).toBe('fileView.status.unsaved');
    expect(statusWord('new')).toBe('fileView.status.new');
    expect(statusWord('deleted')).toBe('fileView.status.deleted');
    expect(statusWord('conflict')).toBe('fileView.status.conflict');
    expect(statusWord('empty')).toBe('fileView.status.empty');
    expect(statusWord(null)).toBeNull();
    expect(statusWord(undefined)).toBeNull();
  });
});
