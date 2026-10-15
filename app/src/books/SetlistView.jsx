// The setlist surface (books.setlists, workflow 12, board W12): opening a
// setlist, reading its songs in order, and the structured editor that reorders
// (drag + keyboard), edits each item's key and note, removes an item, adds a
// song and points a missing item at a song. Every change is an ordinary unsaved
// WRITE, committed by Save / reverted by Discard, like any other file
// (workflow 4). Play is a seam (`onPlay`) this task draws but does not wire —
// books.play owns the player (Decision 1).
//
// The view composes the §10 model itself: it reads the working-copy text
// (OPEN_SOURCE → the `source` slice → cifra-md's `parseSetlist`) and the book's
// file set (BOOK_TREE → the `tree` slice) for missing-item detection, and
// applies cifra-md's pure §10.10 editing ops in the view, then `writeSetlist` +
// WRITE (Decision 3). The Worker owns no setlist model.

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  GridList,
  GridListItem,
  Input,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  TextField,
  useDragAndDrop,
} from 'react-aria-components';
import {
  parseSetlist,
  writeSetlist,
  moveItem,
  removeItem,
  setProperty,
  removeProperty,
  addSong,
  pointItemAtSong,
  pathFromSetlistToSong,
  textForSong,
} from 'cifra-md';
import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { orderedBooks, titleFor } from './book-display.js';
import { setlistRows, bookFileSet, folderOf } from './setlist-display.js';
import './setlist.css';

// A `key` as §10.7.1 writes it — a root then `m` for minor; mirrored locally so
// the field can flag a value the format would not read (the chord layer is not
// imported — cifra_js.setlists Decisions).
const KEY_RE = /^[A-G](?:#|b|♯|♭)?m?$/;

function Icon({ d, size = 20, fill = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {d.map((p) => <path key={p} d={p} />)}
    </svg>
  );
}
const BACK = ['M15 18l-6-6 6-6'];
const PLAY = ['M7 4l13 8-13 8z'];
const PLUS = ['M12 5v14M5 12h14'];
const GRIP = ['M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01'];
const TRASH = ['M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'];
const DOTS = ['M5 12h.01M12 12h.01M19 12h.01'];

// The in-book song picker that drives both Add-song and the missing-item
// repoint: a search field scoped to the setlist's own book, its results, and a
// pick. A setlist points only into its own book, so the search is book-scoped.
function InBookPicker({ store, bookId, onPick, onCancel, titleText, confirmLabel }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const results = useSlice(store, 'search');
  const list = useMemo(() => {
    const all = results?.results ?? [];
    return all.filter((r) => r.bookId === bookId);
  }, [results, bookId]);

  const onQuery = (value) => {
    setQuery(value);
    setPicked(null);
    store.send(command(CommandKind.SEARCH, { query: value, scope: { books: [bookId] } }));
  };

  return (
    <div className="setlist-repoint">
      {titleText ? <span className="t-h3">{titleText}</span> : null}
      <SearchField className="search" aria-label={t('setlists.searchLabel')} value={query} onChange={onQuery}>
        <Input className="setlist-search-input" />
      </SearchField>
      {list.length === 0 && query ? (
        <p className="t-small">{t('setlists.noResults')}</p>
      ) : (
        <div className="list" role="group" aria-label={t('setlists.searchLabel')}>
          {list.map((r) => {
            const isSel = picked?.path === r.path;
            return (
              <Button
                key={r.path}
                className={`row${isSel ? ' sel' : ''}`}
                aria-pressed={isSel}
                onPress={() => setPicked(r)}
              >
                <span className="grow">
                  <span className="name">{r.title || r.path}</span>
                  <span className="meta t-mono">{r.path}</span>
                </span>
              </Button>
            );
          })}
        </div>
      )}
      <div className="actions">
        <Button className="btn quiet" onPress={onCancel}>{t('setlists.cancel')}</Button>
        <Button className="btn primary" isDisabled={!picked} onPress={() => onPick(picked)}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

export default function SetlistView({
  store,
  bookId,
  path,
  mode = 'narrow',
  onBack = () => {},
  onPlay = () => {},
}) {
  const source = useSlice(store, 'source');
  const tree = useSlice(store, 'tree');
  const shelf = useSlice(store, 'shelf');
  const [model, setModel] = useState(null); // null → show the source as-is
  const [editing, setEditing] = useState(false);
  const [touched, setTouched] = useState(false);
  const [addingSong, setAddingSong] = useState(false);
  const [repointAt, setRepointAt] = useState(null);

  useEffect(() => {
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
    store.send(command(CommandKind.BOOK_TREE, { bookId }));
  }, [store, bookId, path]);

  useWorkerEvent(store, EventKind.SAVED, (payload) => {
    if (payload?.bookId === bookId) {
      setTouched(false);
      store.send(command(CommandKind.BOOK_TREE, { bookId }));
    }
  });

  const sourceText = source?.[bookId]?.[path]?.text;
  const current = useMemo(
    () => model ?? (sourceText != null ? parseSetlist(sourceText) : null),
    [model, sourceText],
  );
  const treeEntries = useMemo(() => tree?.[bookId]?.entries ?? [], [tree, bookId]);
  const present = useMemo(() => bookFileSet(treeEntries), [treeEntries]);
  const statusByPath = useMemo(
    () => Object.fromEntries(treeEntries.map((e) => [e.path, e.status])),
    [treeEntries],
  );
  const rows = useMemo(
    () => (current ? setlistRows(current, path, present) : []),
    [current, path, present],
  );

  const bookTitle = titleFor(orderedBooks(shelf).find((e) => e.id === bookId)?.book ?? {}, bookId);
  const folder = folderOf(path);
  const songCount = t('setlists.songCount', { count: rows.length });
  const unsaved = touched || statusByPath[path] === 'unsaved' || statusByPath[path] === 'new';

  const apply = (next) => {
    setModel(next);
    setTouched(true);
    store.send(command(CommandKind.WRITE, { bookId, path, text: writeSetlist(next) }));
  };

  // The paths a Save commits: the setlist and any song it references that is not
  // yet committed (a cross-book copy lands as a `new` file — saved with the
  // setlist as one commit, workflow 12 §Songs from another book).
  const savePaths = useMemo(() => {
    const paths = [path];
    for (const row of rows) {
      const status = row.resolvedPath && statusByPath[row.resolvedPath];
      if (status === 'new' || status === 'unsaved') paths.push(row.resolvedPath);
    }
    return paths;
  }, [rows, path, statusByPath]);

  const save = () => {
    store.send(command(CommandKind.SAVE, {
      bookId,
      paths: savePaths,
      message: t('setlists.saveMessage'),
    }));
  };

  const discard = () => {
    store.send(command(CommandKind.DISCARD, { bookId, paths: savePaths }));
    setModel(null);
    setTouched(false);
    setRepointAt(null);
    setAddingSong(false);
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
    store.send(command(CommandKind.BOOK_TREE, { bookId }));
  };

  const relFor = (songPath) => pathFromSetlistToSong(path.split('/').slice(0, -1), songPath.split('/'));
  const linkFor = (result) =>
    textForSong({ title: result.title || null, fileName: result.path.slice(result.path.lastIndexOf('/') + 1) });

  const addPicked = (result) => {
    apply(addSong(current, { text: linkFor(result), path: relFor(result.path) }));
    setAddingSong(false);
  };
  const repointPicked = (result) => {
    apply(pointItemAtSong(current, repointAt, { text: linkFor(result), path: relFor(result.path) }));
    setRepointAt(null);
  };

  const setKey = (at, value) => {
    const trimmed = value.trim();
    apply(trimmed ? setProperty(current, at, 'key', trimmed) : removeProperty(current, at, 'key'));
  };
  const setNote = (at, value) => {
    apply(value ? setProperty(current, at, 'note', value) : removeProperty(current, at, 'note'));
  };

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ 'text/plain': String(key) })),
    onReorder(e) {
      const from = Number([...e.keys][0]);
      const insertion = Number(e.target.key) + (e.target.dropPosition === 'after' ? 1 : 0);
      const to = insertion > from ? insertion - 1 : insertion;
      if (to !== from) apply(moveItem(current, from, to));
    },
  });

  if (current == null) {
    return (
      <div className="setlist-screen">
        <div className="appbar">
          <Button className="btn icon" aria-label={t('setlists.back')} onPress={onBack}>
            <Icon d={BACK} size={24} />
          </Button>
          <span className="title">{t('setlists.title')}</span>
        </div>
        <div className="scroll">
          <p className="t-small">{t('setlists.loading')}</p>
        </div>
      </div>
    );
  }

  const missingRows = rows.filter((r) => r.missing);
  const title = current.title || path.slice(path.lastIndexOf('/') + 1);

  // ---- read view ----------------------------------------------------------
  if (!editing) {
    return (
      <div className="setlist-screen">
        <div className="appbar">
          <Button className="btn icon" aria-label={t('setlists.back')} onPress={onBack}>
            <Icon d={BACK} size={24} />
          </Button>
          <span className="title">{title}</span>
          <Button className="btn quiet" onPress={() => setEditing(true)}>
            {t('setlists.edit')}
          </Button>
          <MenuTrigger>
            <Button className="btn icon" aria-label={t('setlists.more')}>
              <Icon d={DOTS} size={24} fill />
            </Button>
            <Popover>
              <Menu
                onAction={(key) => {
                  if (key === 'edit') setEditing(true);
                  else if (key === 'play') onPlay({ bookId, path });
                }}
              >
                <MenuItem id="edit">{t('setlists.edit')}</MenuItem>
                <MenuItem id="play">{t('setlists.play')}</MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
        <div className="scroll">
          <div className="setlist-head">
            <h2 className="t-display">{title}</h2>
            <span className="t-small">
              {[bookTitle, folder, songCount].filter(Boolean).join(' · ')}
            </span>
          </div>
          <Button className="btn primary block" onPress={() => onPlay({ bookId, path })}>
            <Icon d={PLAY} fill /> {t('setlists.play')}
          </Button>
          <div className="list">
            {rows.map((row) => (
              <div className="row" key={row.at}>
                <span className="t-h2 setlist-num">{row.number}</span>
                <span className="grow">
                  <span className="name">{row.title}</span>
                  {row.note ? <span className="meta">{row.note}</span> : null}
                  {!row.missing && row.folder ? <span className="meta">{row.folder}</span> : null}
                </span>
                <span className="badges">
                  {row.key ? <span className="badge voiced">{t('setlists.inKey', { key: row.key })}</span> : null}
                  {row.missing ? <span className="badge conflict dot">{t('setlists.missing')}</span> : null}
                </span>
              </div>
            ))}
          </div>
          {missingRows.map((row) => (
            <div className="notice conflict setlist-missing-notice" key={row.at}>
              <span>
                <b>{t('setlists.missingNotice', { title: row.title })}</b>{' '}
                {t('setlists.missingDetail', { path: row.resolvedPath || row.title })}
              </span>
              <Button
                className="btn quiet setlist-point-act"
                onPress={() => {
                  setEditing(true);
                  setRepointAt(row.at);
                }}
              >
                {t('setlists.pointItAtASong')}
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- editor -------------------------------------------------------------
  const editorBody = (
    <div className="scroll">
      <div className="section-label">
        <span className="t-h3">{t('setlists.songsLabel')}</span>
        <span className="t-small">{t('setlists.keyNoteHint')}</span>
      </div>
      <GridList
        className="list setlist-edit-list"
        aria-label={t('setlists.songsLabel')}
        items={rows.map((r) => ({ id: String(r.at), row: r }))}
        dragAndDropHooks={dragAndDropHooks}
      >
        {(entry) => {
          const row = entry.row;
          return (
          <GridListItem
            id={entry.id}
            className={`row setlist-edit-row${row.missing ? ' setlist-row-missing' : ''}`}
            textValue={row.title}
          >
            <Button slot="drag" className="btn icon setlist-drag" aria-label={t('setlists.dragToReorder')}>
              <Icon d={GRIP} />
            </Button>
            <span className="t-h2 setlist-num">{row.number}</span>
            <span className="grow">
              <span className="name">{row.title}</span>
              <span className="meta">
                {row.missing ? t('setlists.notInBook', { path: row.resolvedPath || row.title }) : row.folder}
              </span>
            </span>
            {row.missing ? (
              <span className="badge conflict dot">{t('setlists.missing')}</span>
            ) : (
              <>
                <TextField
                  className="setlist-field"
                  aria-label={t('setlists.keyLabel', { title: row.title })}
                  value={row.key || ''}
                  onChange={(v) => setKey(row.at, v)}
                  isInvalid={Boolean(row.key) && !KEY_RE.test(row.key)}
                >
                  <Input className="input setlist-key" placeholder={t('setlists.keyPlaceholder')} />
                </TextField>
                <TextField
                  className="setlist-field"
                  aria-label={t('setlists.noteLabel', { title: row.title })}
                  value={row.note || ''}
                  onChange={(v) => setNote(row.at, v)}
                >
                  <Input className="input setlist-note" placeholder={t('setlists.notePlaceholder')} />
                </TextField>
              </>
            )}
            <Button
              className="btn icon"
              aria-label={t('setlists.removeFromSetlist', { title: row.title })}
              onPress={() => {
                if (repointAt === row.at) setRepointAt(null);
                apply(removeItem(current, row.at));
              }}
            >
              <Icon d={TRASH} />
            </Button>
          </GridListItem>
          );
        }}
      </GridList>

      {repointAt != null ? (
        <InBookPicker
          store={store}
          bookId={bookId}
          titleText={t('setlists.pointHereTitle', { book: bookTitle })}
          confirmLabel={t('setlists.pointHere')}
          onPick={repointPicked}
          onCancel={() => setRepointAt(null)}
        />
      ) : null}

      {addingSong ? (
        <InBookPicker
          store={store}
          bookId={bookId}
          titleText={t('setlists.addSong')}
          confirmLabel={t('setlists.add')}
          onPick={addPicked}
          onCancel={() => setAddingSong(false)}
        />
      ) : null}

      {missingRows.length && repointAt == null ? (
        <div className="list" aria-label={t('setlists.missing')}>
          {missingRows.map((row) => (
            <div className="notice conflict setlist-missing-notice" key={row.at}>
              <span>
                <b>{t('setlists.missingNotice', { title: row.title })}</b>{' '}
                {t('setlists.missingDetail', { path: row.resolvedPath || row.title })}
              </span>
              <Button className="btn quiet setlist-point-act" onPress={() => setRepointAt(row.at)}>
                {t('setlists.pointItAtASong')}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  const sidePane =
    mode === 'wide' ? (
      <div className="pane side setlist-side">
        <div className="scroll">
          <span className="t-mono setlist-filename">{path}</span>
          <div className="editor setlist-raw">
            {writeSetlist(current).split('\n').map((line, i) => (
              <div className="ln" key={i}>{line}</div>
            ))}
          </div>
          <p className="t-small">{t('setlists.relativeNote', { folder: folder || '/' })}</p>
        </div>
      </div>
    ) : null;

  return (
    <div className="setlist-screen">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('setlists.back')} onPress={() => setEditing(false)}>
          <Icon d={BACK} size={24} />
        </Button>
        <span className="title">{title}</span>
        <span className="t-small setlist-appbar-book">{bookTitle}</span>
        {unsaved ? <span className="badge unsaved dot">{t('setlists.unsaved')}</span> : null}
        <Button className="btn" onPress={() => setAddingSong(true)}>
          <Icon d={PLUS} size={18} /> {t('setlists.addSong')}
        </Button>
        <Button className="btn" onPress={() => onPlay({ bookId, path })}>
          <Icon d={PLAY} size={18} fill /> {t('setlists.play')}
        </Button>
        {unsaved ? (
          <Button className="btn" onPress={discard}>{t('setlists.discard')}</Button>
        ) : null}
        <Button className="btn primary" isDisabled={!unsaved} onPress={save}>
          {t('setlists.save')}
        </Button>
      </div>
      {sidePane ? (
        <div className="split">
          <div className="pane main">{editorBody}</div>
          {sidePane}
        </div>
      ) : (
        editorBody
      )}
    </div>
  );
}
