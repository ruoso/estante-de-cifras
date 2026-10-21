// The Setlists destination (books.setlists, workflow 12, board W12 tab bar): the
// setlists in the loaded books — title, book and song count — each opening the
// setlist surface. It replaces the shell's bare `<h1>` placeholder. A local,
// offline read: LIST_SETLISTS walks every book's working tree in the Worker and
// the `setlists` slice carries the result. It always ends in a list, the empty
// sentence, or a plain failure sentence with Try again — never *Loading* forever
// (books.setlists_resilient Constraint 4).
//
// Its head offers *New setlist…* whenever a book can be saved to
// (books.setlist_making; workflow 12 §Building one; W12 phone #8-9): a name and,
// with more than one savable book, which one; Create sends CREATE_FILE (no
// folder: the book's root) and the FILE_CREATED for it opens the new setlist in
// its editor (`startEditing`).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { orderedBooks, titleFor, savableBooks, newSetlistBook } from './book-display.js';
import NewSetlistDialog from './NewSetlistDialog.jsx';
import './setlist.css';

// A row's status word (books.setlist_done Constraint 3; workflow 12 §Building
// one): the same rule as the setlist's own badge, inside the row button so a
// screen reader hears it in the row's name.
const STATUS_WORD = { new: 'setlists.notSavedYet', unsaved: 'setlists.unsaved' };

export default function SetlistsScreen({ store, onOpenSetlist = () => {} }) {
  const setlists = useSlice(store, 'setlists');
  const shelf = useSlice(store, 'shelf');

  // Whether a LIST_SETLISTS of ours is waiting on its reply. Envelopes carry no
  // request id, so an ERROR is ours only while one is in flight (the
  // UploadPreview pattern; Decision 4).
  const inFlightRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [naming, setNaming] = useState(false);
  // The book a CREATE_FILE of ours was sent for, until its FILE_CREATED: as
  // with LIST_SETLISTS, envelopes carry no request id, so a FILE_CREATED is
  // ours only for that book and a setlist path (the file view's are not;
  // books.setlist_making Constraint 5).
  const creatingRef = useRef(null);

  const savable = useMemo(() => savableBooks(shelf, t('books.untitled')), [shelf]);
  const defaultBookId = useMemo(() => newSetlistBook(shelf, savable), [shelf, savable]);

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

  useWorkerEvent(store, EventKind.FILE_CREATED, (payload) => {
    const bookId = creatingRef.current;
    if (!bookId || payload?.bookId !== bookId || !payload?.path?.endsWith('.setlist.md')) return;
    creatingRef.current = null;
    relist();
    onOpenSetlist({ bookId, path: payload.path, startEditing: true });
  });

  // Sends the create (the Worker names the file from the title, under the book
  // lock; Constraint 1) and reports it was sent, so the dialog closes.
  const create = (title, bookId) => {
    const target = bookId ?? defaultBookId;
    if (!target) return false;
    creatingRef.current = target;
    store.send(command(CommandKind.CREATE_FILE, { bookId: target, kind: 'setlist', title }));
    return true;
  };

  const nameFor = (bookId) =>
    titleFor(orderedBooks(shelf).find((e) => e.id === bookId)?.book ?? {}, t('books.untitled'));

  return (
    <div className="setlists-screen">
      <div className="setlists-head">
        <h1 className="t-h1 grow">{t('setlists.title')}</h1>
        {savable.length ? (
          <Button className="btn setlists-new" onPress={() => setNaming(true)}>
            {t('setlists.newSetlist')}
          </Button>
        ) : null}
      </div>
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
        <p className="t-small setlists-empty">
          {t(savable.length ? 'setlists.emptyCanMake' : 'setlists.empty')}
        </p>
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
              {STATUS_WORD[s.status] ? (
                <span className="badges">
                  <span className="badge unsaved dot">{t(STATUS_WORD[s.status])}</span>
                </span>
              ) : null}
            </Button>
          ))}
        </div>
      )}
      {naming ? (
        <NewSetlistDialog
          books={savable}
          defaultBookId={defaultBookId}
          onCancel={() => setNaming(false)}
          onCreate={create}
        />
      ) : null}
    </div>
  );
}
