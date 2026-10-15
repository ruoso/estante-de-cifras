// PreviewRows.jsx — the song-by-song rows of a preview, shared by the upload
// preview (books.upload_ui, workflow 7 §A preview comes first) and the bring-in
// screen (books.bring_in, workflow 11 §Following the original: "the same preview
// an upload does"). One component keeps the status words and badge classes in
// step between the two (books.bring_in Decision 2).
//
// Each row is the Worker's preview shape `{ path, title, status, changes?,
// summary?, line? }`: the song's name, its musical summary (or, for a marked
// file left out, why and where), the diff lines through the save sheet's
// DiffRows, and the status as a word in a `.badge` — the word carries the
// meaning, the tint is only a second signal (mockups README L26). The keep
// toggle is drawn for a no-history `replace` row only when the host passes
// `onToggleKeep` (the upload does; a bring-in never replaces).

import { Checkbox } from 'react-aria-components';

import { t } from '../i18n/index.js';
import DiffRows from '../songs/DiffRows.jsx';
import './upload-preview.css';

const basename = (path) => path.split('/').pop();

// The badge modifier per status word (W07 board preview data L266-271; W11 board
// L240-251): added → ok, changed/replace → voiced, conflict/unresolved →
// conflict.
const BADGE_CLASS = {
  added: 'ok',
  changed: 'voiced',
  replace: 'voiced',
  conflict: 'conflict',
  unresolved: 'conflict',
};
const STATUS_KEY = {
  added: 'books.uploadAdded',
  changed: 'books.uploadChanged',
  conflict: 'books.uploadConflict',
  replace: 'books.uploadReplace',
  unresolved: 'books.uploadUnresolved',
};

/** A preview row's displayed name: its title, else the file's name. */
export function previewName(row) {
  return row.title || basename(row.path);
}

/**
 * The rows. `previews` is the Worker's list; `kept` (a Set of paths) and
 * `onToggleKeep(path, on)` drive the per-row keep toggle of a `replace` row,
 * drawn only when `onToggleKeep` is given.
 */
export default function PreviewRows({ previews, kept, onToggleKeep }) {
  return (
    <div className="list upload-songs">
      {previews.map((p) => (
        <div className="row upload-song" key={p.path}>
          <span className="grow">
            <span className="name">{previewName(p)}</span>
            {p.status === 'unresolved' ? (
              <span className="meta">
                {t('books.uploadUnresolvedHelp')} · {t('books.uploadMarkerLine', { line: p.line })}
              </span>
            ) : p.summary ? (
              <span className="meta">{p.summary}</span>
            ) : null}
            {(p.status === 'changed' || p.status === 'replace') && p.changes?.length ? (
              <DiffRows changes={p.changes} />
            ) : null}
            {p.status === 'replace' && onToggleKeep ? (
              <Checkbox
                className="upload-keep"
                isSelected={kept?.has(p.path) ?? false}
                onChange={(on) => onToggleKeep(p.path, on)}
              >
                <span className="upload-keep-box" aria-hidden="true" />
                {t('books.uploadKeep', { name: previewName(p) })}
              </Checkbox>
            ) : null}
          </span>
          <span className={`badge ${BADGE_CLASS[p.status] ?? ''}`}>{t(STATUS_KEY[p.status])}</span>
        </div>
      ))}
    </div>
  );
}
