// One commit's per-file plain line diff, with per-file restore (books.file_view,
// workflow 14 L161-173; W14 desktop board). The Worker hands over each touched
// file's before/after text (COMMIT_DIFF); this runs the pure `lineDiff` and
// renders it through the same dependency-free `LineDiffView` the song history
// uses (songs.history Decision 6 — no CodeMirror, no jsdom geometry stub).
// *Restore this version* writes that file's version into the working copy, to be
// saved as a new version.

import { Button } from 'react-aria-components';
import { lineDiff } from '../songs/line-diff.js';
import { LineDiffView } from '../songs/SongHistory.jsx';
import { t } from '../i18n/index.js';
import { ClockIcon } from './icons.jsx';

export default function CommitDiff({ meta, files, onRestore }) {
  return (
    <div className="commit-diff">
      {meta ? <p className="t-small commit-meta">{meta}</p> : null}
      {files.map((file) => (
        <div className="commit-file" key={file.path}>
          <div className="commit-file-head">
            <span className="t-mono grow commit-file-name">{file.path}</span>
            <Button className="btn" onPress={() => onRestore(file)}>
              <ClockIcon />
              {t('fileView.restore')}
            </Button>
          </div>
          <LineDiffView
            hunks={lineDiff(file.before, file.after)}
            caption={t('fileView.diffCaption', { file: file.path })}
          />
        </div>
      ))}
      <p className="t-small">{t('fileView.restoreCaption')}</p>
    </div>
  );
}
