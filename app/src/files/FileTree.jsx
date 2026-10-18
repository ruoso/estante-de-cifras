// The file tree (books.file_view, workflow 14 §The view; W14 board). A
// keyboard-navigable list of the book's files, grouped into folders and indented
// by depth, each file a React Aria `Button` that opens it in the raw editor; the
// selected file reads `.sel`. Folders are emergent (git has no empty folders),
// but choosable: a folder row is a `Button` with `aria-pressed` that points the
// *New* menu at it (books.file_view_create_menu Decision 5), and a folder the
// view holds before a file is in it reads *empty*. Every status is a word + its
// badge class, never colour alone (mockups README L26).
//
// A row-button list carries `role="group"`, not `role="list"` — a list of RAC
// buttons fails axe's aria-required-children (memory
// role-list-of-rac-buttons-fails-axe).

import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { buildTree, statusWord } from './file-tree.js';
import { FolderIcon, FileIcon } from './icons.jsx';

// The indent for a row at a given depth, as inline padding-left (the W14 board
// uses `12 + depth*22` px).
function pad(depth) {
  return `${12 + depth * 22}px`;
}

// A file's status as a word and its badge classes (workflow 14 L134-138). In
// step (no status) renders nothing.
export function StatusBadge({ status }) {
  const key = statusWord(status);
  if (!key) return null;
  const cls =
    status === 'unsaved'
      ? 'badge unsaved dot'
      : status === 'new'
        ? 'badge ok'
        : status === 'conflict'
          ? 'badge conflict dot'
          : 'badge';
  return <span className={cls}>{t(key)}</span>;
}

export default function FileTree({
  entries,
  emptyFolders = [],
  selectedPath,
  chosenFolder = null,
  onSelect,
  onChooseFolder = () => {},
  label,
}) {
  const nodes = buildTree(entries, emptyFolders);
  return (
    <div className="list file-tree" role="group" aria-label={label}>
      {nodes.map((node) =>
        node.type === 'folder' ? (
          <Button
            key={`d:${node.path}`}
            className={`row file-folder${node.path === chosenFolder ? ' sel' : ''}`}
            style={{ paddingLeft: pad(node.depth) }}
            onPress={() => onChooseFolder(node.path)}
            aria-pressed={node.path === chosenFolder}
          >
            <FolderIcon />
            <span className="grow">
              <span className="name t-mono file-folder-name">
                <span>{node.name}</span>/
              </span>
            </span>
            {/* The space keeps the word apart in the row's name ("ensaios/ empty"). */}
            {node.empty ? <> <StatusBadge status="empty" /></> : null}
          </Button>
        ) : (
          <Button
            key={`f:${node.path}`}
            className={`row file-row${node.path === selectedPath ? ' sel' : ''}`}
            style={{ paddingLeft: pad(node.depth) }}
            onPress={() => onSelect(node.path)}
            aria-pressed={node.path === selectedPath}
          >
            <FileIcon />
            <span className="grow">
              <span
                className="name t-mono file-name"
                style={{ textDecoration: node.status === 'deleted' ? 'line-through' : 'none' }}
              >
                {node.name}
              </span>
            </span>
            <StatusBadge status={node.status} />
          </Button>
        ),
      )}
    </div>
  );
}
