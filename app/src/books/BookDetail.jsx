// BookDetail.jsx — the per-book detail (books.online, workflow 7; W07 board).
// The four acts that turn a book from a device-only thing into a hosted one,
// carry it away, or take it off: Put online (a local book), Download (any),
// Remove from my shelf (any), Delete the book (owner only). Opened by selecting
// a book row on the book-management screen (the shelf's `selected` seam); laid
// out by BooksScreen as a detail pane beside the list on a wide viewport and a
// full-screen detail over the list on a phone (Decision 2). This component is
// the detail pane only — the chips, the act cards and their confirmations.
//
// The Worker owns git, the working copy and the network (DIRECTION §3.7): this
// view only sends commands (PUT_ONLINE / DOWNLOAD_BOOK / REMOVE_BOOK /
// DELETE_BOOK) and reacts to their replies. It reads the `shelf` and `sync`
// slices to resolve the book and its state; it never touches IndexedDB or git.
//
// Accessibility: every act is a React Aria Component with a keyboard path and a
// name; the destructive confirmations are RAC Modal/Dialog (the RenameDialog
// pattern), portaled into `.est` by the app-wide provider; status is a word,
// never colour alone (the chips, the loss warning).

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
} from 'react-aria-components';

import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { titleFor, canSaveFor, orderedBooks } from './book-display.js';
import './book-detail.css';

// The device commit identity for a shelf-touching command, the same literal the
// shelf and the shell use (BooksScreen.jsx:49). The Worker's `authorFrom` turns
// the id into a no-reply address.
const LOCAL_IDENTITY = { id: 'local', name: 'Me' };

// A filename-safe slug for the downloaded zip — ASCII letters, digits and
// dashes, from the book's title; a title that reduces to nothing falls back to
// a neutral word (never a book id or song text in the name).
function slugFor(title) {
  const slug = String(title ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || 'book';
}

// Save a zip the Worker produced as a file (workflow 7 L63: "the browser saves
// the file"). Guarded so a test environment without `URL.createObjectURL` does
// not throw — the download is exercised end to end in e2e-web.
function saveZip(title, bytes) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugFor(title)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
    </svg>
  );
}

function OnlineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20V8M7 13l5-5 5 5M4 4h16" />
    </svg>
  );
}

// The Remove confirmation: names what would be lost. For a hosted book with
// unpushed saves it warns of the saves not yet on Estante; for a device-only
// book it warns the book will be gone for good and offers Download first; for a
// hosted book in step it is the board's plain one-liner (workflow 7 L128-135,
// Decision 5).
function RemoveDialog({ title, isLocal, savesWaiting, onRemove, onDownload }) {
  const body = isLocal
    ? t('books.removeGone')
    : savesWaiting > 0
      ? t('books.removeLoss', { count: savesWaiting })
      : t('books.removeBody');
  return (
    <DialogTrigger>
      <Button className="btn" style={{ alignSelf: 'flex-start' }}>
        {t('books.remove')}
      </Button>
      <ModalOverlay className="scrim center">
        <Modal className="dialog">
          <Dialog>
            {({ close }) => (
              <>
                <Heading slot="title" className="t-h2">
                  {t('books.removeTitle', { name: title })}
                </Heading>
                <p className="t-body">{body}</p>
                <div className="actions">
                  <Button className="btn" onPress={close}>
                    {t('books.cancel')}
                  </Button>
                  {isLocal ? (
                    <Button
                      className="btn"
                      onPress={() => {
                        onDownload();
                      }}
                    >
                      {t('books.download')}
                    </Button>
                  ) : null}
                  <Button
                    className="btn danger"
                    onPress={() => {
                      onRemove();
                      close();
                    }}
                  >
                    {t('books.removeConfirm')}
                  </Button>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

// The Delete confirmation (owner only): the destructive action is enabled only
// when the typed text matches the book's displayed name exactly — the app's
// type-the-name guard, since DELETE /api/books/{id} takes no name (service.books
// decision; workflow 7 L136-137; the W07 board modal).
function DeleteDialog({ title, onDelete }) {
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === title;
  return (
    <DialogTrigger onOpenChange={(open) => open && setTyped('')}>
      <Button className="btn danger" style={{ alignSelf: 'flex-start' }}>
        {t('books.delete')}
      </Button>
      <ModalOverlay className="scrim center">
        <Modal className="dialog">
          <Dialog>
            {({ close }) => (
              <>
                <Heading slot="title" className="t-h2">
                  {t('books.deleteTitle', { name: title })}
                </Heading>
                <p className="t-body">{t('books.deleteModalBody')}</p>
                <TextField className="field" value={typed} onChange={setTyped}>
                  <Label>{t('books.deleteField')}</Label>
                  <Input className="input" />
                </TextField>
                <div className="actions">
                  <Button className="btn" onPress={close}>
                    {t('books.cancel')}
                  </Button>
                  <Button
                    className="btn danger"
                    isDisabled={!matches}
                    onPress={() => {
                      onDelete();
                      close();
                    }}
                  >
                    {t('books.deleteConfirm')}
                  </Button>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

/**
 * The per-book detail pane. `bookId` is the book shown; `kind` ('local' |
 * 'shared') is the shelf map it lives in; `mode` is the layout ('wide' |
 * 'narrow'); `onBack` closes the detail (the narrow back affordance and the
 * close after a remove/delete); `onReselect(id)` moves the open detail to a new
 * id (put-online adopts the service id — Decision 3).
 */
export default function BookDetail({
  store,
  bookId,
  kind,
  mode = 'narrow',
  onBack = () => {},
  onReselect = () => {},
}) {
  const shelf = useSlice(store, 'shelf');
  const sync = useSlice(store, 'sync');
  const [failure, setFailure] = useState(null);

  const entry = orderedBooks(shelf).find((e) => e.id === bookId);
  const book = entry?.book ?? {};
  const bookKind = entry?.kind ?? kind ?? 'local';
  const isLocal = bookKind === 'local';
  const title = titleFor(book, bookId);
  const role = book?.role?.value ?? null;
  const isOwner = isLocal || role === 'owner';
  const canSave = canSaveFor(bookKind, book);
  const savesWaiting = sync?.[bookId]?.savesWaiting ?? 0;

  // A successful put-online changed the book's on-device id (Decision 3): move
  // the open detail to the adopted service id so it keeps showing the book.
  useWorkerEvent(store, EventKind.BOOK_ONLINE, ({ previousBookId, bookId: newId }) => {
    if (previousBookId === bookId) {
      setFailure(null);
      onReselect(newId);
    }
  });
  // A failed put-online: word the reason (the service create was refused).
  useWorkerEvent(store, EventKind.BOOK_ONLINE_REFUSED, ({ bookId: id, reason }) => {
    if (id === bookId) setFailure(reason);
  });
  // A remove or delete finished: close the detail (the SHELF re-surface drops
  // the row).
  useWorkerEvent(store, EventKind.BOOK_REMOVED, ({ bookId: id }) => {
    if (id === bookId) onBack();
  });
  // The Worker produced the download zip: save it as a file.
  useWorkerEvent(store, EventKind.BOOK_DOWNLOAD, ({ bookId: id, bytes }) => {
    if (id === bookId) saveZip(title, bytes);
  });

  const putOnline = () => {
    setFailure(null);
    store.send(command(CommandKind.PUT_ONLINE, { bookId, author: LOCAL_IDENTITY }));
  };
  const download = () => store.send(command(CommandKind.DOWNLOAD_BOOK, { bookId }));
  const remove = () =>
    store.send(command(CommandKind.REMOVE_BOOK, { bookId, author: LOCAL_IDENTITY }));
  const deleteBook = () =>
    store.send(command(CommandKind.DELETE_BOOK, { bookId, author: LOCAL_IDENTITY }));

  const failureCopy =
    failure === 'quota'
      ? t('books.putOnlineQuota')
      : failure === 'signed_out'
        ? t('books.putOnlineSignedOut')
        : failure === 'offline'
          ? t('books.putOnlineOffline')
          : failure
            ? t('books.putOnlineError')
            : null;

  return (
    <div className="book-detail">
      <div className="appbar">
        {mode === 'narrow' ? (
          <Button className="btn icon back" aria-label={t('books.detailBack')} onPress={onBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Button>
        ) : null}
        <span className="title t-h2">{title}</span>
      </div>

      <div className="scroll book-detail-body">
        <div className="chips">
          <span className="chip">
            {isLocal ? t('books.onDevice') : `${t('books.onEstante')} · ${t('books.private')}`}
          </span>
          {isOwner ? <span className="chip">{t('books.youOwn')}</span> : null}
          {canSave === true ? (
            <span className="chip">{t('books.youCanSave')}</span>
          ) : canSave === false ? (
            <span className="chip">{t('books.readOnly')}</span>
          ) : null}
        </div>

        {isLocal ? (
          <div className="card pad">
            <span className="t-h2">{t('books.putOnline')}</span>
            <p className="t-small">{t('books.putOnlineBody')}</p>
            {failureCopy ? (
              <p className="t-small detail-error" role="status">
                {failureCopy}
              </p>
            ) : null}
            <Button className="btn" style={{ alignSelf: 'flex-start' }} onPress={putOnline}>
              <OnlineIcon />
              {t('books.putOnline')}
            </Button>
          </div>
        ) : null}

        <div className="card pad">
          <span className="t-h2">{t('books.download')}</span>
          <p className="t-small">{t('books.downloadBody')}</p>
          <Button className="btn" style={{ alignSelf: 'flex-start' }} onPress={download}>
            <DownloadIcon />
            {t('books.download')}
          </Button>
        </div>

        <div className="card pad">
          <span className="t-h2">{t('books.remove')}</span>
          <p className="t-small">{t('books.removeBody')}</p>
          <RemoveDialog
            title={title}
            isLocal={isLocal}
            savesWaiting={savesWaiting}
            onRemove={remove}
            onDownload={download}
          />
        </div>

        {isOwner && !isLocal ? (
          <div className="card pad">
            <span className="t-h2">{t('books.delete')}</span>
            <p className="t-small">{t('books.deleteBody')}</p>
            <DeleteDialog title={title} onDelete={deleteBook} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
