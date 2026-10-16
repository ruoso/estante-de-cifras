// The raw-editor host for the file view's selected file (books.file_view,
// workflow 14 L148). It reuses the CodeMirror source editor songs use
// (songs.editor) over ANY file — a per-file header with Rename and Delete, then
// `SongEditor` keyed by `{bookId}:{path}` so switching files remounts and
// re-reads. The editor's own Save button fires the pre-save gate and calls
// `onSave`; the host turns that into the save sheet (FileView owns the sheets).

import { Button } from 'react-aria-components';
import SongEditor from '../editor/SongEditor.jsx';
import { t } from '../i18n/index.js';
import { TrashIcon } from './icons.jsx';

export default function RawEditorHost({
  store,
  bookId,
  file,
  mode,
  editorRef,
  flushRef,
  onSave,
  onOpenHistory,
  onRename,
  onDelete,
}) {
  const renameable = file.kind === 'song' || file.kind === 'setlist';
  return (
    <div className="raw-editor-host">
      <div className="appbar raw-editor-head">
        <span className="title t-mono raw-editor-name">{file.path}</span>
        {!file.isNew && renameable ? (
          <Button
            className="btn"
            onPress={onRename}
            aria-label={t('fileView.renameLabel', { name: file.path })}
          >
            {t('fileView.rename')}
          </Button>
        ) : null}
        <Button
          className="btn icon"
          onPress={onDelete}
          aria-label={t('fileView.deleteLabel', { name: file.path })}
        >
          <TrashIcon />
        </Button>
      </div>
      <SongEditor
        key={`${bookId}:${file.path}`}
        store={store}
        bookId={bookId}
        path={file.path}
        isNew={file.isNew}
        layoutMode={mode}
        editorRef={editorRef}
        flushRef={flushRef}
        onSave={onSave}
        onOpenHistory={onOpenHistory}
      />
    </div>
  );
}
