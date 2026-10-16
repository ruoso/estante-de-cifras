// One commit's per-file plain line diff, with per-file restore (books.file_view,
// workflow 14 L161-173; W14 desktop board). The Worker hands over each touched
// file's before/after text (COMMIT_DIFF); this runs the pure `lineDiff` and
// renders it through the same dependency-free `LineDiffView` the song history
// uses (songs.history Decision 6 — no CodeMirror, no jsdom geometry stub).
// *Restore this version* writes that file's version into the working copy, to be
// saved as a new version.
//
// The open commit is headed by its message (W14 computer #4 L201-202;
// books.file_view_history_polish Decisions 4-5): the subject (first line) as a
// level-2 heading, the rest of the message under it, then the author · full date
// · hash (mono) · files line. Both widths render this, so the phone's
// one-at-a-time detail carries the heading too.

import { Button } from 'react-aria-components';
import { lineDiff } from '../songs/line-diff.js';
import { LineDiffView } from '../songs/SongHistory.jsx';
import { t } from '../i18n/index.js';
import { ClockIcon } from './icons.jsx';

// A commit message as its subject and the paragraphs of its body (trimmed; a run
// of blank lines separates paragraphs).
export function splitMessage(message) {
  const [subject = '', ...rest] = String(message ?? '').split('\n');
  const body = rest.join('\n').trim();
  return {
    subject: subject.trim(),
    paragraphs: body ? body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [],
  };
}

const HASH_SLOT = '\u0000';

// `fileView.commitMeta` in its own order, with the hash set in mono as the board
// draws it.
function MetaLine({ meta }) {
  const [before, after = ''] = t('fileView.commitMeta', { ...meta, hash: HASH_SLOT }).split(HASH_SLOT);
  return (
    <p className="t-small commit-meta">
      {before}
      <span className="t-mono">{meta.hash}</span>
      {after}
    </p>
  );
}

export default function CommitDiff({ message, meta, files, onRestore }) {
  const { subject, paragraphs } = splitMessage(message);
  return (
    <div className="commit-diff">
      <div className="commit-head">
        {subject ? <h2 className="t-h1 commit-subject">{subject}</h2> : null}
        {paragraphs.map((text, i) => (
          <p key={i} className="commit-body">
            {text}
          </p>
        ))}
        {meta ? <MetaLine meta={meta} /> : null}
      </div>
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
