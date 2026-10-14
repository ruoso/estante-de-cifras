// The Setlists destination (books.setlists, workflow 12, board W12 tab bar): the
// setlists in the loaded books — title, book and song count — each opening the
// setlist surface. It replaces the shell's bare `<h1>` placeholder. A local,
// offline read: LIST_SETLISTS walks every book's working tree in the Worker and
// the `setlists` slice carries the result.

import { useEffect } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { orderedBooks, titleFor } from './book-display.js';
import './setlist.css';

export default function SetlistsScreen({ store, onOpenSetlist = () => {} }) {
  const setlists = useSlice(store, 'setlists');
  const shelf = useSlice(store, 'shelf');

  useEffect(() => {
    store.send(command(CommandKind.LIST_SETLISTS, {}));
  }, [store]);

  // A setlist created or changed elsewhere (the Add-to-setlist dialog, the
  // editor's save) re-lists so the destination stays current.
  useWorkerEvent(store, EventKind.SETLIST_UPDATED, () => {
    store.send(command(CommandKind.LIST_SETLISTS, {}));
  });
  useWorkerEvent(store, EventKind.SAVED, () => {
    store.send(command(CommandKind.LIST_SETLISTS, {}));
  });

  const nameFor = (bookId) =>
    titleFor(orderedBooks(shelf).find((e) => e.id === bookId)?.book ?? {}, bookId);

  return (
    <div className="setlists-screen">
      <h1 className="t-h1">{t('setlists.title')}</h1>
      {setlists === null ? (
        <p className="t-small">{t('setlists.loading')}</p>
      ) : setlists.length === 0 ? (
        <p className="t-small setlists-empty">{t('setlists.empty')}</p>
      ) : (
        <div className="list">
          {setlists.map((s) => (
            <Button
              key={`${s.bookId}/${s.path}`}
              className="row"
              onPress={() => onOpenSetlist({ bookId: s.bookId, path: s.path })}
            >
              <span className="grow">
                <span className="name">{s.title || s.path}</span>
                <span className="meta">
                  {t('setlists.pickerMeta', {
                    book: nameFor(s.bookId),
                    count: t('setlists.songCount', { count: s.count }),
                  })}
                </span>
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
