// Pure helpers for the file view's *New* menu (books.file_view_create_menu,
// workflow 14 §What can be done to a file): the templates a new setlist and a new
// README start from, the path a new setlist takes, the rule a new folder's name
// must keep, which of the four kinds the menu offers, and "the folder being
// looked at" each create goes in (workflow 3 L32-33). Framework-free and
// unit-tested; the Worker's CREATE_FILE writes these same templates, and the
// view reads the rest.

import { writeSetlist } from 'cifra-md';
import { setlistFilename } from '../books/setlist-display.js';

/**
 * A new setlist's bytes: its title and nothing else, written canonically by
 * cifra-md's `writeSetlist`, so a save writes them unchanged (Constraint 4).
 *
 * @param {string} title
 */
export function setlistTemplate(title) {
  return writeSetlist({ title, properties: [], body: [] });
}

/**
 * A new README's bytes: the book's title as its level-1 heading, as a new book's
 * README holds it (workflow 14 §What a new book starts with; DIRECTION §2.1 L74).
 *
 * @param {string} title
 */
export function readmeTemplate(title) {
  return `# ${title}\n`;
}

/**
 * The book-root path a new setlist takes in `folder` ('' or null at the root):
 * the title's slug plus `.setlist.md`, `-2`, `-3`… when `existing` (the names
 * already in that folder) holds it, `untitled` for a title with no letters
 * (`setlistFilename`).
 *
 * @param {string|null} folder
 * @param {string} title
 * @param {Iterable<string>} existing
 */
export function newSetlistPath(folder, title, existing = []) {
  const name = setlistFilename(title, existing instanceof Set ? existing : [...existing]);
  const trimmed = folder ? folder.replace(/\/+$/, '') : '';
  return trimmed ? `${trimmed}/${name}` : name;
}

/**
 * Why a new folder's name cannot be used, or `null` when it can (Decision 4): a
 * folder is one path segment — not blank, no `/`, not `.` or `..`, no leading
 * dot (`.git`), and not the name of something already beside it (a clash would
 * merge silently). The name is otherwise kept as typed, trimmed.
 *
 * @param {string} name
 * @param {Iterable<string>} siblings the names already in the parent folder
 * @returns {'blank'|'slash'|'dots'|'hidden'|'taken'|null}
 */
export function folderNameProblem(name, siblings = []) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return 'blank';
  if (trimmed.includes('/') || trimmed.includes('\\')) return 'slash';
  if (trimmed === '.' || trimmed === '..') return 'dots';
  if (trimmed.startsWith('.')) return 'hidden';
  for (const sibling of siblings) {
    if (sibling === trimmed) return 'taken';
  }
  return null;
}

/**
 * The names directly in `folder` ('' at the root), from book-root paths: a
 * file's base name, or the next folder segment of a deeper path. What a new
 * folder's name must not clash with.
 *
 * @param {Iterable<string>} paths
 * @param {string|null} folder
 * @returns {Set<string>}
 */
export function namesIn(paths, folder) {
  const prefix = folder ? `${folder.replace(/\/+$/, '')}/` : '';
  const names = new Set();
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    const segment = rest.split('/')[0];
    if (segment) names.add(segment);
  }
  return names;
}

/**
 * The *New* menu's four entries in the board's order (W14 #1 L58-63), each with
 * whether it is offered. README.md is offered only when the book root holds
 * none, or holds one only as *deleted* (Decision 8); a README in a subfolder is
 * not the book's.
 *
 * @param {{ path: string, status?: string|null }[]} entries the `tree` slice
 * @returns {{ id: 'song'|'setlist'|'folder'|'readme', enabled: boolean }[]}
 */
export function createChoices(entries = []) {
  const hasReadme = entries.some((e) => e?.path === 'README.md' && e.status !== 'deleted');
  return [
    { id: 'song', enabled: true },
    { id: 'setlist', enabled: true },
    { id: 'folder', enabled: true },
    { id: 'readme', enabled: !hasReadme },
  ];
}

/**
 * The folder a new song, setlist or folder goes in (workflow 3 L32-33;
 * Constraint 2): the folder chosen in the tree, else the selected file's
 * folder, else the root (''). Book-root relative, no trailing slash.
 *
 * @param {{ chosenFolder?: string|null, selectedPath?: string|null }} view
 * @returns {string}
 */
export function folderBeingLookedAt({ chosenFolder = null, selectedPath = null } = {}) {
  if (chosenFolder) return chosenFolder;
  if (selectedPath) {
    const slash = selectedPath.lastIndexOf('/');
    return slash < 0 ? '' : selectedPath.slice(0, slash);
  }
  return '';
}
