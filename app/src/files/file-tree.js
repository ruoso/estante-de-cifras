// Pure display helpers for the file view's tree (books.file_view, workflow 14
// §The view). Framework-free: the kind derivation, the folder assembly and the
// status→word mapping, all unit-tested without React. The Worker hands over a
// flat list of `{ path, status }` (the `tree` slice); this turns it into the
// ordered, indented rows the view draws — folders before files, alphabetical,
// only the allowed kinds (workflow 14 L24-29).

const SONG_SUFFIX = '.cifra.md';
const SETLIST_SUFFIX = '.setlist.md';

/**
 * The kind of a file by its name (its last path segment), or `null` for a name
 * a book may not hold — `.git` and anything else (workflow 14 L24-29; DIRECTION
 * §2.1). Only `*.cifra.md`, `*.setlist.md`, `README.md` and `.gitattributes`
 * are kept.
 *
 * @param {string} name
 * @returns {'song'|'setlist'|'readme'|'gitattributes'|null}
 */
export function fileKind(name) {
  if (name.endsWith(SONG_SUFFIX) && name.length > SONG_SUFFIX.length) return 'song';
  if (name.endsWith(SETLIST_SUFFIX) && name.length > SETLIST_SUFFIX.length) return 'setlist';
  if (name === 'README.md') return 'readme';
  if (name === '.gitattributes') return 'gitattributes';
  return null;
}

/**
 * The i18n copy key for a file's working-copy status, or `null` when the file
 * is in step (nothing to say). Every status is a word (mockups README L26), not
 * colour alone (workflow 14 L134-138).
 *
 * @param {string|null|undefined} status
 * @returns {string|null}
 */
export function statusWord(status) {
  switch (status) {
    case 'unsaved':
      return 'fileView.status.unsaved';
    case 'new':
      return 'fileView.status.new';
    case 'deleted':
      return 'fileView.status.deleted';
    case 'conflict':
      return 'fileView.status.conflict';
    default:
      return null;
  }
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Assemble the tree rows from the Worker's flat entry list. Folders are emergent
 * — git has no empty folders, so a folder exists once a file sits in it. Rows
 * come out in display order: within each directory, folders first then files,
 * each group alphabetical, depth-first (a folder is immediately followed by its
 * contents). Anything not an allowed kind is dropped (workflow 14 L24-29).
 *
 * @param {{ path: string, status?: string|null }[]} entries
 * @returns {Array<
 *   { type: 'folder', name: string, path: string, depth: number } |
 *   { type: 'file', name: string, path: string, depth: number, status: string|null, kind: string }
 * >}
 */
export function buildTree(entries = []) {
  const root = { dirs: new Map(), files: [] };
  for (const entry of entries) {
    const segments = String(entry?.path ?? '').split('/').filter(Boolean);
    if (segments.length === 0) continue;
    const name = segments[segments.length - 1];
    const kind = fileKind(name);
    if (!kind) continue;
    let node = root;
    let prefix = '';
    for (const seg of segments.slice(0, -1)) {
      prefix = prefix ? `${prefix}/${seg}` : seg;
      if (!node.dirs.has(seg)) {
        node.dirs.set(seg, { name: seg, path: prefix, dirs: new Map(), files: [] });
      }
      node = node.dirs.get(seg);
    }
    node.files.push({ name, path: segments.join('/'), status: entry?.status ?? null, kind });
  }

  const out = [];
  const walk = (node, depth) => {
    const folders = [...node.dirs.values()].sort((a, b) => compare(a.name, b.name));
    for (const folder of folders) {
      out.push({ type: 'folder', name: folder.name, path: folder.path, depth });
      walk(folder, depth + 1);
    }
    const files = [...node.files].sort((a, b) => compare(a.name, b.name));
    for (const file of files) {
      out.push({
        type: 'file',
        name: file.name,
        path: file.path,
        depth,
        status: file.status,
        kind: file.kind,
      });
    }
  };
  walk(root, 0);
  return out;
}

/**
 * The changed files in the tree, in display order — the change-list the save
 * sheet saves (workflow 14 L152-159). A changed file is one with a status
 * (unsaved / new / deleted / conflict); an in-step file is not listed.
 *
 * @param {ReturnType<typeof buildTree>} nodes
 * @returns {{ path: string, status: string, kind: string }[]}
 */
export function changedFiles(nodes = []) {
  return nodes
    .filter((n) => n.type === 'file' && n.status)
    .map((n) => ({ path: n.path, status: n.status, kind: n.kind }));
}

/**
 * Split a book-root path into `{ folder, base }` — the containing folder
 * (segments joined by `/`, or '' at the root) and the file name. Used by the
 * rename dialog (the folder is kept, the name edited) and by "new song here".
 *
 * @param {string} path
 */
export function splitPath(path) {
  const slash = String(path ?? '').lastIndexOf('/');
  if (slash < 0) return { folder: '', base: path ?? '' };
  return { folder: path.slice(0, slash), base: path.slice(slash + 1) };
}

/**
 * The extension a file's kind pins on a rename (the dialog shows it beside the
 * name; the Worker refuses a cross-kind move). A song keeps `.cifra.md`, a
 * setlist `.setlist.md`; README/.gitattributes have no editable base so they are
 * not renamed here.
 *
 * @param {string} kind
 * @returns {string|null}
 */
export function kindSuffix(kind) {
  if (kind === 'song') return SONG_SUFFIX;
  if (kind === 'setlist') return SETLIST_SUFFIX;
  return null;
}

/**
 * The editable base name (without its kind suffix) of a file, for the rename
 * dialog's pre-filled input.
 *
 * @param {string} base the file name
 * @param {string} kind
 */
export function baseWithoutSuffix(base, kind) {
  const suffix = kindSuffix(kind);
  if (suffix && base.endsWith(suffix)) return base.slice(0, -suffix.length);
  return base;
}
