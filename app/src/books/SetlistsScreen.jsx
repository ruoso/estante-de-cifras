// The Setlists destination (books.setlists, workflow 12, board W12 tab bar): the
// setlists in the loaded books — title, book and song count — each opening the
// setlist surface. It replaces the shell's bare `<h1>` placeholder. A local,
// offline read: LIST_SETLISTS walks every book's working tree in the Worker and
// the `setlists` slice carries the result. It always ends in a list, the empty
// sentence, or a plain failure sentence with Try again — never *Loading* forever
// (books.setlists_resilient Constraint 4).

import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { orderedBooks, titleFor } from './book-display.js';
import './setlist.css';

export default function SetlistsScreen({ store, onOpenSetlist = () => {} }) {
  const setlists = useSlice(store, 'setlists');
  const shelf = useSlice(store, 'shelf');

  // Whether a LIST_SETLISTS of ours is waiting on its reply. Envelopes carry no
  // request id, so an ERROR is ours only while one is in flight (the
  // UploadPreview pattern; Decision 4).
  const inFlightRef = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    inFlightRef.current = true;
    store.send(command(CommandKind.LIST_SETLISTS, {}));
  }, [store]);

  function relist() {
    inFlightRef.current = true;
    store.send(command(CommandKind.LIST_SETLISTS, {}));
  }

  useWorkerEvent(store, EventKind.SETLISTS, () => {
    inFlightRef.current = false;
    setFailed(false);
  });
  // A failed first list leaves *Loading* for the failure sentence; a failed
  // re-list over a list already showing leaves that list in place (it is still
  // true for what it shows). An ERROR with nothing of ours in flight is ignored.
  useWorkerEvent(store, EventKind.ERROR, () => {
    if (!inFlightRef.current) return;
    inFlightRef.current = false;
    if (store.slice('setlists') === null) setFailed(true);
  });

  function retry() {
    setFailed(false);
    relist();
  }

  // A setlist created or changed elsewhere (the Add-to-setlist dialog, the
  // editor's save) re-lists so the destination stays current; so does a book
  // that finishes coming down while Setlists is open (Constraint 5).
  useWorkerEvent(store, EventKind.SETLIST_UPDATED, relist);
  useWorkerEvent(store, EventKind.SAVED, relist);
  useWorkerEvent(store, EventKind.SHELF_FILL, (payload) => {
    if (payload?.state === 'ready') relist();
  });

  const nameFor = (bookId) =>
    titleFor(orderedBooks(shelf).find((e) => e.id === bookId)?.book ?? {}, bookId);

  return (
    <div className="setlists-screen">
      <h1 className="t-h1">{t('setlists.title')}</h1>
      {setlists === null && failed ? (
        <>
          <p className="t-small setlists-empty" role="status">
            {t('setlists.failed')}
          </p>
          <Button className="btn setlists-retry" onPress={retry}>
            {t('setlists.retry')}
          </Button>
        </>
      ) : setlists === null ? (
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
