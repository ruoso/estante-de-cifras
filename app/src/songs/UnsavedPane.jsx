// UnsavedPane.jsx — the computer editor's *Unsaved* pane (songs.editor_chrome
// Constraint 9; W04#4 L163-176; workflow 4 §Saving): every song with unsaved
// changes across the shelf, the one being edited first and selected, each a
// step away. The rows come from `unsavedRows` over the `browse` and `shelf`
// slices the Worker already publishes; the pane asks for a BROWSE on mount, as
// the search screen does, so the slice is filled.
//
// A RAC GridList (Decision 5): arrow keys move between rows, the current one is
// the selected row, and choosing another opens it through the host's `onEdit`
// — the edit in progress is in the working copy already, so switching asks
// nothing (workflow 4 §Editing). Items carry `id` + `row`, never a domain `key`
// ([[rac-gridlist-item-key-collision]]).

import { useEffect, useId, useMemo } from 'react';
import { GridList, GridListItem } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import { unsavedRows } from './unsaved-list.js';

export default function UnsavedPane({ store, current, onEdit }) {
  const browse = useSlice(store, 'browse');
  const shelf = useSlice(store, 'shelf');
  const headingId = useId();

  // Asked again when the pane moves to another song (the host stays mounted):
  // the one left behind is no longer current, and its row comes from the index.
  // The editor it left flushed its last edit first, and the Worker answers in
  // order.
  const currentBook = current?.bookId;
  const currentPath = current?.path;
  useEffect(() => {
    store.send(command(CommandKind.BROWSE, { scope: undefined }));
  }, [store, currentBook, currentPath]);

  const rows = useMemo(
    () =>
      unsavedRows(browse, shelf, current, {
        untitledBook: t('books.untitled'),
        untitledSong: t('newSong.untitled'),
      }),
    [browse, shelf, current],
  );
  const items = rows.map((row) => ({ id: row.id, row }));
  const currentIds = rows.filter((r) => r.current).map((r) => r.id);

  return (
    <section className="pane side unsaved-pane" aria-labelledby={headingId}>
      <h2 className="t-h3" id={headingId}>
        {t('editor.unsavedList')}
      </h2>
      <GridList
        className="list"
        aria-labelledby={headingId}
        items={items}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={currentIds}
        onSelectionChange={(keys) => {
          const chosen = items.find((item) => keys !== 'all' && keys.has(item.id));
          if (chosen && !chosen.row.current) {
            onEdit({ bookId: chosen.row.bookId, path: chosen.row.path, title: chosen.row.title });
          }
        }}
      >
        {(item) => (
          <GridListItem
            id={item.id}
            className={({ isSelected }) => `row${isSelected ? ' sel' : ''}`}
            textValue={item.row.title}
          >
            <span className="grow">
              <span className="name">{item.row.title}</span>
              <span className="meta">{item.row.meta}</span>
            </span>
            {item.row.unsaved ? <span className="badge unsaved dot">{t('search.unsaved')}</span> : null}
          </GridListItem>
        )}
      </GridList>
    </section>
  );
}
