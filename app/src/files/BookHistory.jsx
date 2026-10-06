// The book's history as git sees it (books.file_view, workflow 14 L161-173; W14
// desktop board). A left pane with the changes-not-saved checkbox list (the one
// piece of git staging the file view keeps) and its Save, then the whole commit
// log newest-first with merges marked; a main pane showing an open commit's
// per-file line diff and per-file restore. Reads the `bookLog` slice; the open
// commit's diff arrives as a transient COMMIT_DIFF event (no slice — Decision
// 4), folded into local state.

import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox } from 'react-aria-components';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { t, currentLocale } from '../i18n/index.js';
import { StatusBadge } from './FileTree.jsx';
import CommitDiff from './CommitDiff.jsx';

function subjectOf(message) {
  return String(message ?? '').split('\n')[0];
}

function dateLabel(timestamp) {
  if (timestamp == null) return '';
  try {
    return new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'short' }).format(
      new Date(timestamp * 1000),
    );
  } catch {
    return '';
  }
}

function ChangeList({ changes, checked, onToggle }) {
  return (
    <div className="list change-list" role="group" aria-label={t('fileView.changesTitle')}>
      {changes.map((change) => (
        <Checkbox
          key={change.path}
          className="row change-row"
          isSelected={checked.has(change.path)}
          onChange={() => onToggle(change.path)}
        >
          <span className="check" aria-hidden="true" />
          <span className="grow">
            <span className="name t-mono">{change.path}</span>
          </span>
          <StatusBadge status={change.status} />
        </Checkbox>
      ))}
    </div>
  );
}

function CommitList({ commits, openCommit, onOpen, label }) {
  return (
    <div className="list commit-list" role="group" aria-label={label}>
      {commits.map((commit) => (
        <Button
          key={commit.commit}
          className={`row commit-row${commit.commit === openCommit ? ' sel' : ''}`}
          onPress={() => onOpen(commit.commit)}
          aria-pressed={commit.commit === openCommit}
        >
          <span className="grow">
            <span className="name">{subjectOf(commit.message)}</span>
            <span className="meta">
              {[commit.author?.name, dateLabel(commit.timestamp)].filter(Boolean).join(' · ')}
            </span>
            <span className="badges">
              <span className="badge t-mono">{commit.short}</span>
              {commit.isMerge ? <span className="badge voiced">{t('fileView.merge')}</span> : null}
              <span className="t-small">
                {t('fileView.commitFiles', { count: commit.files?.length ?? 0 })}
              </span>
            </span>
          </span>
        </Button>
      ))}
    </div>
  );
}

export default function BookHistory({
  store,
  bookId,
  bookLabel,
  changes,
  mode,
  onSaveChecked,
  onRestore,
}) {
  const bookLog = useSlice(store, 'bookLog');
  const commits = useMemo(() => bookLog?.[bookId]?.commits ?? [], [bookLog, bookId]);
  const [openCommit, setOpenCommit] = useState(null);
  const [diff, setDiff] = useState(null);

  const changeKey = changes.map((c) => c.path).join('\u0000');
  const [checked, setChecked] = useState(() => new Set(changes.map((c) => c.path)));
  // All changes start checked; when the set of changed paths shifts (a save, an
  // edit), reset to all-checked — derived from a prop change, adjusted during
  // render (React's documented pattern, not an effect).
  const [prevChangeKey, setPrevChangeKey] = useState(changeKey);
  if (prevChangeKey !== changeKey) {
    setPrevChangeKey(changeKey);
    setChecked(new Set(changeKey ? changeKey.split('\u0000') : []));
  }

  // The whole log, (re-)requested whenever the history opens.
  useEffect(() => {
    store.send(command(CommandKind.BOOK_LOG, { bookId }));
  }, [store, bookId]);

  useWorkerEvent(store, EventKind.COMMIT_DIFF, (payload) => {
    if (payload?.bookId === bookId) {
      setDiff({ commit: payload.commit, files: payload.files ?? [] });
    }
  });

  const openOne = (commit) => {
    setOpenCommit(commit);
    store.send(command(CommandKind.COMMIT_DIFF, { bookId, commit }));
  };

  const toggle = (path) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const checkedPaths = changes.filter((c) => checked.has(c.path)).map((c) => c.path);

  const openEntry = useMemo(
    () => commits.find((c) => c.commit === openCommit) ?? null,
    [commits, openCommit],
  );
  const meta = openEntry
    ? t('fileView.commitMeta', {
        author: openEntry.author?.name ?? '',
        date: dateLabel(openEntry.timestamp),
        hash: openEntry.short,
        files: t('fileView.commitFiles', { count: openEntry.files?.length ?? 0 }),
      })
    : '';

  const changeSection = (
    <>
      <div className="section-label">
        <span className="t-h3">{t('fileView.changesTitle')}</span>
        <span className="t-small">{t('fileView.changesCaption')}</span>
      </div>
      {changes.length ? (
        <>
          <ChangeList changes={changes} checked={checked} onToggle={toggle} />
          <Button
            className="btn primary block"
            onPress={() => onSaveChecked(checkedPaths)}
            isDisabled={checkedPaths.length === 0}
          >
            {t('fileView.saveFiles', { count: checkedPaths.length })}
          </Button>
        </>
      ) : (
        <p className="t-small" role="status">
          {t('fileView.noChanges')}
        </p>
      )}
    </>
  );

  const commitSection = (
    <>
      <div className="t-h3 commit-list-head">{t('fileView.historyHeading')}</div>
      <CommitList
        commits={commits}
        openCommit={openCommit}
        onOpen={openOne}
        label={t('fileView.commits', { book: bookLabel })}
      />
    </>
  );

  const diffPane =
    diff && diff.commit === openCommit ? (
      <CommitDiff
        meta={meta}
        files={diff.files}
        onRestore={(file) => onRestore(file.path, openCommit)}
      />
    ) : (
      <p className="t-small" role="status">
        {t('fileView.emptyCommit')}
      </p>
    );

  if (mode === 'wide') {
    return (
      <div className="split book-history">
        <div className="pane side">
          <div className="scroll">
            {changeSection}
            {commitSection}
          </div>
        </div>
        <div className="pane main">
          <div className="scroll">{diffPane}</div>
        </div>
      </div>
    );
  }

  // Narrow: the change/commit list, or one open commit at a time.
  if (openCommit) {
    return (
      <div className="scroll book-history">
        <Button className="btn" onPress={() => setOpenCommit(null)}>
          {t('fileView.backToHistory')}
        </Button>
        {diffPane}
      </div>
    );
  }
  return (
    <div className="scroll book-history">
      {changeSection}
      {commitSection}
    </div>
  );
}
