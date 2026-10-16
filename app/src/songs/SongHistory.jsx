// SongHistory.jsx — a song's history surface (songs.history, workflow 6; W06
// board). It lists the song's versions newest-first, with the working copy's
// unsaved changes pinned first; opening a version shows it as it was (the
// rendered chart) beside what changed from the version before, with *compare
// with now* against the working copy, *show the text* for the file's line diff,
// and *restore this version* — which asks first, as discard does, when the
// working copy is dirty (workflow 6 §Restoring). Everything is local and offline
// (every book is a full clone, DIRECTION §3).
//
// The view is the only React layer (DIRECTION §3.7 L407-414): it reads the
// `history`, `savePreview`, `source` and `preferences` slices and sends
// SONG_LOG / READ_VERSION / RESTORE_VERSION / PREVIEW_SAVE / OPEN_SOURCE; it
// never touches IndexedDB, git or the book lock. `parse`/`diff` run here on the
// bytes the Worker already returned — the editor's pattern (SongEditor.jsx:246),
// and `storage.history`'s stated contract (Decision 1) — because cifra.md is
// framework-free and knows nothing of React. The musical summary and the unsaved
// entry are this task's job (storage/history.md:100-106); the pure assembly is
// `history-view.js`, the line diff `line-diff.js`.
//
// Navigation ("which version is open") is ephemeral view state, never a slice
// (the project's no-router convention, DIRECTION §3.7). Three layouts follow the
// drawings (Decision 2): phone stacks the list then the version with a sticky
// action footer; tablet is the single-column version with appbar actions; the
// computer is the persistent two-pane split (list left, version right). The
// restore confirm is the one overlay, a centered RAC dialog.

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Button, Switch } from 'react-aria-components';
import { parse, diff } from 'cifra-md';
import { t, currentLocale } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import Chart from '../chart/Chart.jsx';
import DiffRows from './DiffRows.jsx';
import RestoreConfirm from './RestoreConfirm.jsx';
import { restorableBlocks, sameBlockRef, blockLabelText } from './restorable-blocks.js';
import { buildHistoryView, beforeTextOf } from './history-view.js';
import { lineDiff } from './line-diff.js';
import { useLayoutMode } from '../shell/AppShell.jsx';
import './song-history.css';

// The computer split only has room past this width; below it (the phone and the
// tablet) the list and the version are one column at a time. The shell's single
// narrow/wide break at 600px (useLayoutMode) separates the phone from the rest;
// this screen-local break separates the tablet's single column from the
// computer's two-pane split (W06's three columns; layout-mode.js notes the real
// tablet viewport is 712px and the computer 1280px). jsdom reports no match, so
// the behavior test runs the phone layout unless it stubs this query true.
const COMPUTER_QUERY = '(min-width: 900px)';

function computerQuery() {
  return typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(COMPUTER_QUERY) : null;
}
function subscribeComputer(onChange) {
  const q = computerQuery();
  if (!q?.addEventListener) return () => {};
  q.addEventListener('change', onChange);
  return () => q.removeEventListener('change', onChange);
}
function readComputer() {
  return computerQuery()?.matches ?? false;
}

// phone | tablet | computer, from the shell's narrow/wide break plus the screen-
// local computer break (re-read live as the viewport crosses either).
function useHistoryLayout() {
  const mode = useLayoutMode();
  const isComputer = useSyncExternalStore(subscribeComputer, readComputer, readComputer);
  if (mode === 'narrow') return 'phone';
  return isComputer ? 'computer' : 'tablet';
}

// A back-arrow icon button (W06 appbar), the shell's icon affordance.
function BackButton({ label, onPress }) {
  return (
    <Button className="btn icon" aria-label={label} onPress={onPress}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Button>
  );
}

// One list row: the unsaved pin (non-interactive, a word badge) or a selectable
// version (a Button — React Aria for every interactive part, with a keyboard
// path and `aria-current` on the open one).
function HistoryRow({ row, selected, onSelect }) {
  if (row.kind === 'unsaved') {
    return (
      <div className="row est-history-unsaved">
        <span className="grow">
          <span className="name">{t('history.unsaved')}</span>
          {row.summary ? <span className="t-small est-history-summary">{row.summary}</span> : null}
          <span className="badges">
            <span className="badge unsaved dot">{t('history.unsavedBadge')}</span>
          </span>
        </span>
      </div>
    );
  }
  const by = row.when ? `${row.who} · ${row.when}` : row.who;
  return (
    <Button
      className={`row est-history-row${selected ? ' sel' : ''}`}
      aria-current={selected ? 'true' : undefined}
      onPress={() => onSelect(row.commit)}
    >
      <span className="grow">
        <span className="name">{row.note}</span>
        <span className="meta">{by}</span>
        {row.summary ? <span className="t-small est-history-summary">{row.summary}</span> : null}
      </span>
    </Button>
  );
}

// The version list (mockup W06 list): the unsaved pin then the versions.
function VersionList({ rows, selected, onSelect, label }) {
  return (
    <div className="list" role="group" aria-label={label}>
      {rows.map((row) => (
        <HistoryRow
          key={row.kind === 'unsaved' ? 'unsaved' : row.commit}
          row={row}
          selected={row.kind === 'version' && row.commit === selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// The file's line diff, classed del/add/gap, with a gap between hunks (mockup
// W06 `editor` block). Pure presentation over `lineDiff`.
export function LineDiffView({ hunks, caption }) {
  return (
    <div className="editor est-history-text" role="group" aria-label={caption}>
      {hunks.length === 0 ? (
        <div className="ln est-history-nochange">{t('history.empty')}</div>
      ) : (
        hunks.map((hunk, hi) => (
          <div key={hi} className="est-history-hunk">
            {hi > 0 ? <div className="ln gap" aria-hidden="true" /> : null}
            {hunk.lines.map((line, li) => (
              <div
                key={li}
                className={`ln${line.type === 'add' ? ' add' : line.type === 'del' ? ' del' : ''}`}
              >
                {line.text === '' ? ' ' : line.text}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// The version detail body: what changed, the chart as it was, and the optional
// line diff. Shared by all three layouts; the surrounding chrome (appbar vs
// sticky footer) differs by layout.
function VersionDetail({
  model,
  shownChanges,
  cardTitle,
  hunks,
  caption,
  showText,
  onShowText,
  restorable,
  onRestoreBlock,
  versionUnparseable,
  noopNotice,
}) {
  return (
    <>
      <div className="card pad est-history-card">
        <div className="t-h3">{cardTitle}</div>
        {restorable ? (
          <DiffRows blocks={restorable} onRestoreBlock={onRestoreBlock} />
        ) : (
          <DiffRows changes={shownChanges} />
        )}
        {versionUnparseable ? (
          <p className="t-small est-history-note" role="status">
            {t('history.noBlockRestore')}
          </p>
        ) : null}
        {noopNotice ? (
          <p className="t-small est-history-note" role="status">
            {t('history.nothingToRestore')}
          </p>
        ) : null}
      </div>

      <div className="est-history-showtext">
        <Switch isSelected={showText} onChange={onShowText} className="est-history-switch">
          <span className="toggle" aria-hidden="true" />
          <span className="t-body est-history-switch-label">{t('history.showText')}</span>
        </Switch>
        {showText ? <span className="t-small">{caption}</span> : null}
      </div>

      {showText ? (
        <LineDiffView hunks={hunks} caption={caption} />
      ) : (
        <>
          <div className="t-h3">{t('history.songAsItWas')}</div>
          {model ? <Chart model={model} label={t('history.songAsItWas')} /> : null}
        </>
      )}
    </>
  );
}

export default function SongHistory({
  store,
  bookId,
  path,
  bookLabel = '',
  songTitle = '',
  onBack = () => {},
  onRestored = () => {},
}) {
  const layout = useHistoryLayout();

  const historySlice = useSlice(store, 'history');
  const savePreviewSlice = useSlice(store, 'savePreview');
  const sourceSlice = useSlice(store, 'source');
  const preferences = useSlice(store, 'preferences');

  const bookHistory = historySlice?.[bookId] ?? null;
  const entries = useMemo(() => bookHistory?.[path]?.entries ?? [], [bookHistory, path]);
  const preview = useMemo(
    () => (savePreviewSlice?.[bookId]?.previews ?? []).find((p) => p.path === path) ?? null,
    [savePreviewSlice, bookId, path],
  );
  const workingText = sourceSlice?.[bookId]?.[path]?.text ?? null;
  const storedName = preferences?.authorName?.value;
  const identity = useMemo(() => ({ name: storedName }), [storedName]);

  // The song's title and the book's label for the chrome: the props when the
  // host knows them, else the working copy's parsed title (carried on the save
  // preview) and the book id — so the surface is labelled even before a host
  // threads them (the dev mount, songs.reading later).
  const displayTitle = songTitle || preview?.title || path;
  const displayBook = bookLabel || bookId;

  // The version texts read back so far, flattened by commit. A version is cached
  // under the historical path it was read at (SONG_LOG follows renames), so it is
  // gathered from `history[bookId][entry.path]`, not only the current path.
  const versions = useMemo(() => {
    const map = {};
    for (const entry of entries) {
      const cache = bookHistory?.[entry.path]?.versions ?? {};
      if (entry.commit in cache) map[entry.commit] = cache[entry.commit];
      const first = entry.parents?.[0];
      if (entry.resolution && first != null && first in cache) map[first] = cache[first];
    }
    return map;
  }, [entries, bookHistory]);

  const { rows } = useMemo(
    () => buildHistoryView({ entries, versions, preview, identity, t, locale: currentLocale() }),
    [entries, versions, preview, identity],
  );
  const versionRows = useMemo(() => rows.filter((r) => r.kind === 'version'), [rows]);

  // Ephemeral navigation: which version is open, and the two detail toggles.
  const [selected, setSelected] = useState(null);
  const [comparingNow, setComparingNow] = useState(false);
  const [showText, setShowText] = useState(false);
  // The restore confirm's target: either the whole version (`{ kind: 'version',
  // row }`) or one block (`{ kind: 'part', block, lostChanges }`).
  const [restoreFor, setRestoreFor] = useState(null);
  // A block restore that brought nothing back (behaviour 4): a word-carried notice.
  const [noopNotice, setNoopNotice] = useState(false);

  // The computer keeps a version open beside the list; the phone and tablet show
  // the list until one is chosen.
  const firstCommit = versionRows[0]?.commit ?? null;
  const openCommit = layout === 'computer' ? selected ?? firstCommit : selected;
  const openRow = useMemo(
    () => versionRows.find((r) => r.commit === openCommit) ?? null,
    [versionRows, openCommit],
  );

  // Opening the surface: the log, the save preview (the unsaved row + the restore
  // loss) and the working copy (compare with now). All local, offline reads.
  useEffect(() => {
    if (!bookId || !path) return;
    store.send(command(CommandKind.SONG_LOG, { bookId, path }));
    store.send(command(CommandKind.PREVIEW_SAVE, { bookId, paths: [path] }));
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
  }, [store, bookId, path]);

  // Read each version's bytes (and a resolution merge's first parent) at its
  // historical path, so renames read correctly (acceptance 3). Idempotent: a
  // cached commit is never re-requested.
  useEffect(() => {
    if (!bookId) return;
    for (const entry of entries) {
      const cache = bookHistory?.[entry.path]?.versions ?? {};
      if (!(entry.commit in cache)) {
        store.send(command(CommandKind.READ_VERSION, { bookId, path: entry.path, commit: entry.commit }));
      }
      const first = entry.parents?.[0];
      if (entry.resolution && first != null && !(first in cache)) {
        store.send(command(CommandKind.READ_VERSION, { bookId, path: entry.path, commit: first }));
      }
    }
  }, [store, bookId, entries, bookHistory]);

  // The restore landed in the working copy: hand off to the save sheet so the
  // restored copy is saved as a new version (workflow 6 L59-62). A block restore
  // that brought nothing back (`restored === false`) does NOT open the save sheet;
  // it shows a word-carried notice instead (behaviour 4).
  useWorkerEvent(store, EventKind.RESTORED, (payload) => {
    if (payload?.bookId !== bookId || payload?.path !== path) return;
    if (payload.restored === false) {
      setNoopNotice(true);
      return;
    }
    onRestored({ bookId, path });
  });

  // A save in this book landed (the restored copy saved as a new version, or an
  // edit saved elsewhere): re-read the log, the preview and the working copy so
  // the new version appears at the top and the unsaved row clears.
  useWorkerEvent(store, EventKind.SAVED, (payload) => {
    if (payload?.bookId !== bookId) return;
    store.send(command(CommandKind.SONG_LOG, { bookId, path }));
    store.send(command(CommandKind.PREVIEW_SAVE, { bookId, paths: [path] }));
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
    // A restored copy just saved as a new version: land back on the list so it
    // shows at the top. The computer keeps the list beside the detail, but the
    // phone and tablet show one at a time — without this they stay on the old
    // version's detail, hiding the freshly saved version.
    setSelected(null);
    setComparingNow(false);
    setShowText(false);
    setNoopNotice(false);
  });

  // Opening a different version resets its two detail toggles and any notice.
  const openVersion = (commit) => {
    setSelected(commit);
    setComparingNow(false);
    setShowText(false);
    setNoopNotice(false);
  };
  const backToList = () => setSelected(null);
  const toggleCompare = () => {
    setComparingNow((v) => !v);
    setNoopNotice(false);
  };

  const sendRestore = (row) => {
    // `path` is the song's CURRENT path (restore writes there); `fromPath` is the
    // entry's historical path, so a since-renamed version restores correctly.
    store.send(
      command(CommandKind.RESTORE_VERSION, { bookId, path, commit: row.commit, fromPath: row.path }),
    );
  };
  const onRestoreClick = (row) => {
    if (preview?.changes?.length) setRestoreFor({ kind: 'version', row });
    else sendRestore(row);
  };

  // Restore one block of the open version into the working copy (songs.restore_part).
  // `fromPath` is the entry's historical path; `block.ref` the ref the view minted.
  const sendRestorePart = (block) => {
    if (!openRow) return;
    setNoopNotice(false);
    store.send(
      command(CommandKind.RESTORE_PART, {
        bookId,
        path,
        commit: openRow.commit,
        fromPath: openRow.path,
        block: block.ref,
      }),
    );
  };
  const onRestoreBlock = (block) => {
    // Does this block hold unsaved changes (its working content differs from the
    // last saved version)? Group the HEAD-vs-working preview the same way and look
    // for the matching block; if it has changes, ask first — showing what would be
    // lost in that block — otherwise proceed (behaviour 3).
    const lost = restorableBlocks(preview?.changes ?? []).find((b) =>
      sameBlockRef(b.ref, block.ref),
    );
    if (lost) setRestoreFor({ kind: 'part', block, lostChanges: lost.changes });
    else sendRestorePart(block);
  };

  // The detail's "what changed": the version before by default, or the working
  // copy when comparing with now (acceptance 5), re-diffed in the view.
  const thisText = openRow ? versions[openRow.commit] : null;
  const model = useMemo(() => {
    if (thisText == null) return null;
    try {
      return parse(thisText);
    } catch {
      return null; // a version too old to read (not a valid UTF-8 document)
    }
  }, [thisText]);
  // A version reads in blocks when it has sections or voicing blocks of its own; a
  // version too old to read (an early placeholder, a title-only or empty blob)
  // offers only the whole-version restore (behaviour 5).
  const versionReadable = !!model && ((model.sections?.length ?? 0) > 0 || (model.blocks?.length ?? 0) > 0);
  // The compare-with-now diff, re-diffed in the view.
  const compareChanges = useMemo(() => {
    if (!comparingNow || thisText == null || workingText == null) return [];
    try {
      return diff(parse(thisText), parse(workingText)).changes;
    } catch {
      return [];
    }
  }, [comparingNow, thisText, workingText]);
  const versionUnparseable = comparingNow && !versionReadable;
  const shownChanges = comparingNow ? compareChanges : openRow?.changes ?? [];
  const cardTitle = comparingNow ? t('history.whatChangedToNow') : t('history.whatChanged');
  // The blocks the version differs in, each with a *Restore this block* affordance
  // (behaviour 1) — only in compare-with-now mode, and only when the version reads.
  const restorable = useMemo(
    () => (comparingNow && versionReadable ? restorableBlocks(compareChanges) : null),
    [comparingNow, versionReadable, compareChanges],
  );

  // The line diff for *show the text*: this version against the one before.
  const openIndex = useMemo(
    () => entries.findIndex((e) => e.commit === openCommit),
    [entries, openCommit],
  );
  const beforeText = openIndex >= 0 ? beforeTextOf(entries, openIndex, versions) : '';
  const hunks = useMemo(
    () => (thisText != null ? lineDiff(beforeText, thisText) : []),
    [beforeText, thisText],
  );
  const fileCaption = t('history.lineDiffCaption', { file: path });

  const confirmRestore = () => {
    if (!restoreFor) return;
    if (restoreFor.kind === 'part') sendRestorePart(restoreFor.block);
    else sendRestore(restoreFor.row);
    setRestoreFor(null);
  };
  const restoreDialog = (
    <RestoreConfirm
      store={store}
      isOpen={restoreFor != null}
      onClose={() => setRestoreFor(null)}
      onConfirm={confirmRestore}
      bookId={bookId}
      paths={[path]}
      titleHint={displayTitle}
      dateLabel={restoreFor?.kind === 'version' ? restoreFor.row.whenDate ?? '' : ''}
      changes={restoreFor?.kind === 'part' ? restoreFor.lostChanges : null}
      blockLabel={restoreFor?.kind === 'part' ? blockLabelText(restoreFor.block, t) : ''}
    />
  );

  const detail = openRow ? (
    <VersionDetail
      model={model}
      shownChanges={shownChanges}
      cardTitle={cardTitle}
      hunks={hunks}
      caption={fileCaption}
      showText={showText}
      onShowText={setShowText}
      restorable={restorable}
      onRestoreBlock={onRestoreBlock}
      versionUnparseable={versionUnparseable}
      noopNotice={noopNotice}
    />
  ) : null;

  const compareLabel = comparingNow ? t('history.compareBefore') : t('history.compareNow');
  // One unit, so when the title, badge and both do not fit in the appbar the
  // pair wraps onto a second row together (shell.narrow_fit Decision 6).
  const actionButtons = openRow ? (
    <div className="est-history-actions">
      <Button className="btn" onPress={toggleCompare}>
        {compareLabel}
      </Button>
      <Button className="btn primary" onPress={() => onRestoreClick(openRow)}>
        {t('history.restore')}
      </Button>
    </div>
  ) : null;

  const detailHeader = openRow ? (
    <div className="est-history-detail-head">
      <span className="t-h2">{openRow.note}</span>
      <span className="t-small">{openRow.when ? `${openRow.who} · ${openRow.when}` : openRow.who}</span>
    </div>
  ) : null;

  const listLabel = t('history.listLabel', { title: displayTitle });

  // ---- The computer: a persistent two-pane split (list left, version right).
  if (layout === 'computer') {
    return (
      <div className="est-history est-history-computer">
        <div className="split est-history-split">
          <nav className="pane side est-history-side" aria-label={listLabel}>
            <div className="est-history-side-head">
              <BackButton label={t('history.backToSong')} onPress={onBack} />
              <span className="est-history-side-titles">
                <span className="t-h2">{t('history.title')}</span>
                <span className="t-small">{t('history.songInBook', { title: displayTitle, book: displayBook })}</span>
              </span>
            </div>
            <div className="est-history-side-list">
              <VersionList rows={rows} selected={openCommit} onSelect={openVersion} label={listLabel} />
            </div>
          </nav>
          <section className="pane main est-history-main">
            <div className="appbar est-history-appbar">
              <span className="title">{openRow ? openRow.note : t('history.title')}</span>
              {actionButtons}
            </div>
            <div className="scroll est-history-detail">
              {openRow ? (
                <>
                  {detailHeader}
                  {detail}
                </>
              ) : (
                <p className="t-body">{rows.length ? '' : t('history.empty')}</p>
              )}
            </div>
          </section>
        </div>
        {restoreDialog}
      </div>
    );
  }

  // ---- The tablet: a single column, the version with appbar actions; the list
  // when no version is open.
  if (layout === 'tablet') {
    return (
      <div className="est-history est-history-tablet">
        <div className="appbar est-history-appbar">
          <BackButton
            label={openRow ? t('history.backToHistory') : t('history.backToSong')}
            onPress={openRow ? backToList : onBack}
          />
          <span className="title">
            {openRow ? t('history.songInBook', { title: displayTitle, book: openRow.whenDate }) : t('history.title')}
          </span>
          {preview?.changes?.length ? (
            <span className="badge unsaved dot">{t('history.unsavedChanges')}</span>
          ) : null}
          {actionButtons}
        </div>
        <div className="scroll est-history-body">
          {openRow ? (
            <>
              {detailHeader}
              {detail}
            </>
          ) : (
            <>
              <div className="est-history-list-head">
                <span className="t-h2">{displayTitle}</span>
                <span className="t-small">{t('history.newestFirst', { book: displayBook })}</span>
              </div>
              <VersionList rows={rows} selected={openCommit} onSelect={openVersion} label={listLabel} />
            </>
          )}
        </div>
        {restoreDialog}
      </div>
    );
  }

  // ---- The phone: stacked full screens — the list, then the version with a
  // sticky action footer.
  return (
    <div className="est-history est-history-phone">
      {openRow ? (
        <>
          <div className="appbar est-history-appbar">
            <BackButton label={t('history.backToHistory')} onPress={backToList} />
            <span className="title">{t('history.songInBook', { title: displayTitle, book: openRow.whenDate })}</span>
          </div>
          <div className="scroll est-history-body">
            {detailHeader}
            {detail}
          </div>
          <div className="est-history-footer">{actionButtons}</div>
        </>
      ) : (
        <>
          <div className="appbar est-history-appbar">
            <BackButton label={t('history.backToSong')} onPress={onBack} />
            <span className="title">{t('history.title')}</span>
          </div>
          <div className="scroll est-history-body">
            <div className="est-history-list-head">
              <span className="t-h2">{displayTitle}</span>
              <span className="t-small">{t('history.newestFirst', { book: displayBook })}</span>
            </div>
            <VersionList rows={rows} selected={openCommit} onSelect={openVersion} label={listLabel} />
          </div>
        </>
      )}
      {restoreDialog}
    </div>
  );
}
