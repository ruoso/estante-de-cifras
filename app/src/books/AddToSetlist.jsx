// The Add-to-setlist dialog (books.setlists, workflow 12 §Building one, §Songs
// from another book; board W12 tablet). The host (AppShell) mounts it with the
// song to add — raised by the reading view's `onAddToSetlist` seam and by the
// search rows. It lists the setlists in the user's savable books and a
// "New setlist…" row; choosing one in the song's own book adds it, choosing one
// (or a new setlist) in another book copies the song into that book first and
// says so (Decision 7). The copy and the setlist change are left unsaved,
// committed later like any other file. The Worker owns the copy/create/add as
// one locked change (ADD_TO_SETLIST); the view only chooses.
//
// A new setlist made here leaves a trace (books.setlist_making Constraint 7;
// workflow 12 §Building one; W12 tablet #10): its SETLIST_UPDATED does not
// close the picker, which then says *{song} is in {setlist}.* (or *was copied
// into*), that it is not saved yet, and offers Open setlist and Done. Adding to
// a setlist already in the list closes as before.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { orderedBooks, canSaveFor, mySongsIdFor, titleFor } from './book-display.js';
import { setlistFilename } from './setlist-display.js';
import { useLoadSong } from './use-load-song.js';
import NewSetlistDialog from './NewSetlistDialog.jsx';
import './setlist.css';

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="setlist-pick-check">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function AddToSetlist({ store, song, onClose, onOpenSetlist = () => {} }) {
  const shelf = useSlice(store, 'shelf');
  const setlists = useSlice(store, 'setlists');
  const [selected, setSelected] = useState(null); // the chosen setlist, or null
  const [naming, setNaming] = useState(false); // the New-setlist name dialog
  // The new setlist's name while its create is in flight (a ref: envelopes
  // carry no request id, so the SETLIST_UPDATED after it is the made one), and
  // the made step once it landed: `{ name, bookId, setlistPath, copied }`.
  const creatingRef = useRef(null);
  const [made, setMade] = useState(null);

  // The song's title, from search (passed in) or read from its source when the
  // reading view raised only { bookId, path } — needed for the copy notice and
  // the link text.
  const title = useLoadSong(store, song.bookId, song.path, song.title);

  // List setlists once on open (a fresh, local read).
  useEffect(() => {
    store.send(command(CommandKind.LIST_SETLISTS, {}));
  }, [store]);
  // A completed add to a listed setlist closes the dialog; a new setlist's
  // stays, saying where the song went (Constraint 7).
  useWorkerEvent(store, EventKind.SETLIST_UPDATED, (payload) => {
    const name = creatingRef.current;
    if (name == null) {
      onClose();
      return;
    }
    creatingRef.current = null;
    setMade({
      name,
      bookId: payload?.bookId,
      setlistPath: payload?.setlistPath,
      copied: Boolean(payload?.copied),
    });
  });

  const savable = useMemo(() => {
    const map = new Map();
    for (const entry of orderedBooks(shelf)) {
      if (canSaveFor(entry.kind, entry.book) === true) {
        map.set(entry.id, titleFor(entry.book, t('books.untitled')));
      }
    }
    return map;
  }, [shelf]);

  // The savable books' setlists (the only places a setlist can be written).
  const rows = useMemo(
    () => (setlists ?? []).filter((s) => savable.has(s.bookId)),
    [setlists, savable],
  );

  // The home ("My songs") book, the fallback target for a new setlist when the
  // song's own book is not savable (Decision 7) — found by id, never by its
  // label (books.owner_can_save Constraint 3), and only when it is savable.
  const homeBookId = useMemo(() => {
    const id = mySongsIdFor(shelf);
    return id && savable.has(id) ? id : null;
  }, [shelf, savable]);

  const songBookSavable = savable.has(song.bookId);

  const chosen = naming
    ? { targetBookId: songBookSavable ? song.bookId : homeBookId, isNew: true }
    : selected
      ? { targetBookId: selected.bookId, setlistPath: selected.path, isNew: false }
      : null;
  const copies = chosen && chosen.targetBookId && chosen.targetBookId !== song.bookId;
  const targetName = chosen?.targetBookId ? savable.get(chosen.targetBookId) : null;

  const confirm = () => {
    if (!selected) return;
    store.send(
      command(CommandKind.ADD_TO_SETLIST, {
        targetBookId: selected.bookId,
        setlistPath: selected.path,
        song: { bookId: song.bookId, path: song.path, title },
      }),
    );
  };

  // The new setlist's book: the song's own when savable, else My songs, else
  // none (Decision 7).
  const newTargetBookId = songBookSavable ? song.bookId : homeBookId;

  // Sends the create and reports whether it did: with no book to keep the
  // setlist in, nothing is sent and the name dialog stays open (Constraint 5).
  const createNew = (name) => {
    const targetBookId = newTargetBookId;
    if (!targetBookId) return false;
    const existing = (setlists ?? [])
      .filter((s) => s.bookId === targetBookId)
      .map((s) => s.path);
    creatingRef.current = name;
    store.send(
      command(CommandKind.ADD_TO_SETLIST, {
        targetBookId,
        setlistPath: setlistFilename(name, existing),
        newTitle: name,
        song: { bookId: song.bookId, path: song.path, title },
      }),
    );
    return true;
  };

  return (
    <ModalOverlay
      className="scrim center"
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="dialog setlist-dialog">
        <Dialog className="setlist-dialog-body" aria-label={t('setlists.addToSetlistTitle')}>
          {({ close }) => made ? (
            <>
              <Heading slot="title" className="t-h1">
                {t('setlists.addToSetlistTitle')}
              </Heading>
              <p className="setlist-made" role="status">
                {made.copied
                  ? t('setlists.madeCopiedIn', {
                    title,
                    book: savable.get(made.bookId),
                    setlist: made.name,
                  })
                  : t('setlists.madeIn', { title, setlist: made.name })}
              </p>
              <p className="t-small">
                {made.copied
                  ? t('setlists.copyThenUnsaved', { book: savable.get(made.bookId) })
                  : t('setlists.thenUnsaved', { book: savable.get(made.bookId) })}
              </p>
              <div className="actions">
                <Button
                  className="btn"
                  onPress={() => {
                    onOpenSetlist({ bookId: made.bookId, path: made.setlistPath });
                    onClose();
                  }}
                >
                  {t('setlists.openSetlist')}
                </Button>
                {/* The row that had focus is gone: Done takes it as the made
                    step draws (Constraint 7). */}
                {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                <Button className="btn primary" autoFocus onPress={close}>
                  {t('setlists.done')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Heading slot="title" className="t-h1">
                {t('setlists.addToSetlistTitle')}
              </Heading>

              <div className="list" role="group" aria-label={t('setlists.addToSetlistTitle')}>
                {rows.map((s) => {
                  const isSel = selected?.bookId === s.bookId && selected?.path === s.path;
                  return (
                    <Button
                      key={`${s.bookId}/${s.path}`}
                      className={`row${isSel ? ' sel' : ''}`}
                      aria-pressed={isSel}
                      onPress={() => {
                        setNaming(false);
                        setSelected(s);
                      }}
                    >
                      <span className="grow">
                        <span className="name">{s.title || s.path}</span>
                        <span className="meta">
                          {t('setlists.pickerMeta', {
                            book: savable.get(s.bookId),
                            count: t('setlists.songCount', { count: s.count }),
                          })}
                        </span>
                      </span>
                      {isSel ? <CheckIcon /> : null}
                    </Button>
                  );
                })}
                <Button
                  className="row setlist-new-row"
                  onPress={() => {
                    setSelected(null);
                    setNaming(true);
                  }}
                >
                  <PlusIcon />
                  <span className="grow">
                    <span className="name">
                      {t('setlists.newSetlist')}
                    </span>
                  </span>
                </Button>
              </div>

              {copies ? (
                <div className="notice accent setlist-copy-notice">
                  <span>
                    <b>{t('setlists.copyNotice', { book: targetName })}</b>{' '}
                    {t('setlists.copyDetail', {
                      title,
                      other: titleFor(
                        orderedBooks(shelf).find((e) => e.id === song.bookId)?.book ?? {},
                        t('books.untitled'),
                      ),
                    })}
                  </span>
                  <span className="t-small t-mono">{song.path}</span>
                </div>
              ) : null}

              {chosen && targetName ? (
                <p className="t-small">
                  {copies
                    ? t('setlists.copyThenUnsaved', { book: targetName })
                    : t('setlists.thenUnsaved', { book: targetName })}
                </p>
              ) : null}

              <div className="actions">
                <Button className="btn" onPress={close}>
                  {t('setlists.cancel')}
                </Button>
                <Button
                  className="btn primary"
                  isDisabled={!selected}
                  onPress={confirm}
                >
                  {copies ? t('setlists.copyAndAdd') : t('setlists.add')}
                </Button>
              </div>

              {naming ? (
                <NewSetlistDialog
                  hasTarget={Boolean(newTargetBookId)}
                  onCancel={() => setNaming(false)}
                  onCreate={createNew}
                />
              ) : null}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
