// BookDetail.jsx — the per-book detail (books.online, workflow 7; W07 board).
// The four acts that turn a book from a device-only thing into a hosted one,
// carry it away, or take it off: Put online (a local book), Download (any),
// Remove from my shelf (any), Delete the book (owner only) — and, for a member,
// Leave this book (books.leave, workflow 10 §Leaving a book). Opened by *Manage*
// on the bar above the book's songs (books.row_opens_songs; workflow 7 L86-95):
// the shell lays it out as a layer over them — the main pane beside the book's
// songs on a computer, full screen with *Back to {book}* below that. Its title
// carries **Rename** (a label kept in the home book that changes nothing in the
// repository, workflow 7 L16-18), and a **Files** card after Download opens the
// file view (workflow 14 §The view). This component is the detail only — the
// title row, the chips, the act cards and their confirmations.
//
// When the book's live `sync` phase is `gone` — the device is no longer a member
// (sync.lost_access, workflow 8 §Losing access) — it also shows a *no longer
// shared with you* notice: the book is readable as it is and never syncs again,
// and it offers the download and "Make this book your own" so nothing unpushed
// is stranded. When the phase is `cannot_save` — the push was refused as a
// reader's (an editor lowered to reader, workflow 10 L83-85) — it says how many
// saves can no longer go to the book and makes the same offer. A hosted book the
// user does not own carries a **Fork** card, the deliberate way in (books.fork,
// workflow 11 §Ways in; W11 board :189-196). Every offer opens the one
// make-it-your-own sheet (MakeYourOwn.jsx).
//
// The Worker owns git, the working copy and the network (DIRECTION §3.7): this
// view only sends commands (PUT_ONLINE / DOWNLOAD_BOOK / REMOVE_BOOK /
// DELETE_BOOK / LEAVE_BOOK) and reacts to their replies. It reads the `shelf` and `sync`
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

import { t, currentLocale } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { titleFor, canSaveFor, orderedBooks, originalOf, broughtInOn, putOnlineFailureKey } from './book-display.js';
import { saveZip } from './download-zip.js';
import MakeYourOwn from './MakeYourOwn.jsx';
import LeaveDialog, { WarnIcon } from './LeaveDialog.jsx';
import { useOnline } from '../account/use-online.js';
import './book-detail.css';

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
    </svg>
  );
}

function ForkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="6" cy="5" r="2" />
      <circle cx="18" cy="5" r="2" />
      <circle cx="12" cy="19" r="2" />
      <path d="M6 7v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7M12 12v5" />
    </svg>
  );
}

function FilesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

// The pencil on Rename; decorative, the button is named by its aria-label.
function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 6.5l3 3" />
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
// Decision 5). A hosted book with unsaved songs also counts and names them above
// that line (books.remove_counts_unsaved; workflow 7 L148-149; Remove-from-shelf
// board L72-82): the counts come from the Worker's SURVEY_SIGN_OUT, asked for on
// open and filtered to this book as Leave does (Decision 1); until the reply
// arrives the `sync` slice's saves waiting stands in (Decision 2), and the
// confirm never waits on it.
function RemoveDialog({ store, bookId, title, isLocal, savesWaiting: syncWaiting, onRemove, onDownload }) {
  const [open, setOpen] = useState(false);
  const [survey, setSurvey] = useState(null);

  useWorkerEvent(store, EventKind.SIGN_OUT_SURVEY, ({ books }) => {
    if (!open || isLocal) return;
    setSurvey(books?.find((b) => b.id === bookId) ?? null);
  });

  const onOpenChange = (next) => {
    setOpen(next);
    if (!next) return;
    setSurvey(null);
    if (!isLocal) store.send(command(CommandKind.SURVEY_SIGN_OUT, {}));
  };

  const savesWaiting = survey?.savesWaiting ?? syncWaiting;
  const unsaved = isLocal ? 0 : (survey?.unsavedSongs ?? 0);
  const unsavedTitles = survey?.unsavedTitles ?? [];
  const body = isLocal
    ? t('books.removeGone')
    : savesWaiting > 0
      ? t('books.removeLoss', { count: savesWaiting })
      : t('books.removeBody');
  return (
    <DialogTrigger isOpen={open} onOpenChange={onOpenChange}>
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
                {unsaved > 0 ? (
                  <div className="notice unsaved" style={{ flexDirection: 'column', gap: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <WarnIcon />
                      <span>
                        <b>{t('books.removeUnsaved', { count: unsaved })}</b>
                        {unsavedTitles.length ? ` · ${unsavedTitles.join(', ')}` : null}
                      </span>
                    </span>
                    <span>{body}</span>
                  </div>
                ) : (
                  <p className="t-body">{body}</p>
                )}
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

// Rename (books.shelf Decision 3; moved from the shelf row to the detail's title
// by books.row_opens_songs): the trigger restores focus on close (RAC); the
// field opens pre-filled with the current name and, on submit, sends
// RENAME_BOOK and closes. The repository is never touched — only the shelf
// label.
function RenameDialog({ bookId, currentName, onRename }) {
  const [name, setName] = useState(currentName);
  return (
    <DialogTrigger
      onOpenChange={(open) => {
        if (open) setName(currentName);
      }}
    >
      <Button className="btn quiet rename-btn" aria-label={t('books.renameLabel', { name: currentName })}>
        <PencilIcon />
        {t('books.rename')}
      </Button>
      <ModalOverlay className="scrim center">
        <Modal className="dialog">
          <Dialog>
            {({ close }) => (
              <form
                className="book-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = name.trim();
                  if (!trimmed) return;
                  onRename(bookId, trimmed);
                  close();
                }}
              >
                <Heading slot="title" className="t-h2">
                  {t('books.renameTitle', { name: currentName })}
                </Heading>
                <TextField className="field" value={name} onChange={setName}>
                  <Label>{t('books.renameField')}</Label>
                  <Input className="input" />
                </TextField>
                <div className="actions">
                  <Button className="btn" onPress={close}>
                    {t('books.cancel')}
                  </Button>
                  <Button type="submit" className="btn primary">
                    {t('books.save')}
                  </Button>
                </div>
              </form>
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
 * The per-book detail. `bookId` is the book shown; `kind` ('local' | 'shared')
 * is the shelf map it lives in; `onBack` closes the detail (*Back to {book}*);
 * `onGone` closes it once the book left the shelf (removed, left or deleted —
 * defaults to `onBack`); `onReselect(id)` moves the open detail to a new id
 * (put-online adopts the service id — Decision 3); `onShare(bookId)` opens the
 * book's sharing where the shell puts it — the Share sheet on a phone, the
 * people screen on a tablet or a computer (books.share_people); `onFiles(bookId)`
 * opens the book's file view (workflow 14 §The view).
 */
export default function BookDetail({
  store,
  bookId,
  kind,
  onBack = () => {},
  onGone,
  onReselect = () => {},
  onShare = () => {},
  onFiles = () => {},
}) {
  const shelf = useSlice(store, 'shelf');
  const sync = useSlice(store, 'sync');
  const originals = useSlice(store, 'originals');
  const [failure, setFailure] = useState(null);

  const entry = orderedBooks(shelf).find((e) => e.id === bookId);
  const book = entry?.book ?? {};
  const bookKind = entry?.kind ?? kind ?? 'local';
  const isLocal = bookKind === 'local';
  const title = titleFor(book, t('books.untitled'));
  const role = book?.role?.value ?? null;
  const isOwner = isLocal || role === 'owner';
  // Who shares a member's book with them (books.owner_name): the shelf's `owner`
  // register, a display hint read offline. Absent when the owner has no name.
  const ownerName =
    typeof book?.owner?.value === 'string' && book.owner.value !== '' ? book.owner.value : null;
  const canSave = canSaveFor(bookKind, book);
  const savesWaiting = sync?.[bookId]?.savesWaiting ?? 0;
  // The book's live sync phase (the same `sync` slice the shelf badge reads —
  // no new store, Decision "No new durable state"). `gone` means the device is
  // no longer a member: the book is readable as it is and never synced again
  // (sync.lost_access; workflow 8 L65-69).
  const isGone = sync?.[bookId]?.phase === 'gone';
  // The service took the book down for a copyright notice (books.notice_surface):
  // a distinct halt from `gone` — the device is still a member, but the book is
  // unreachable, and the Worker recovered the operator's reason from the git
  // refusal. The notice shows that reason; the book stays readable and
  // downloadable (workflow 10 §A copyright notice; DIRECTION §3.6). A book is
  // either `gone` or `taken_down`, never both.
  const isTakenDown = sync?.[bookId]?.phase === 'taken_down';
  const takenDownReason = sync?.[bookId]?.reason ?? null;
  // The push was refused as a reader's (books.fork Constraint 6): still a
  // member, still read, but its saves can no longer go to it.
  const cannotSave = sync?.[bookId]?.phase === 'cannot_save';
  // The deliberate way in (books.fork Constraint 11): a hosted book the user
  // does not own. Not a local book (theirs already), not the home book, not a
  // taken-down one (notice_surface Decision 3) — and not while the gone or
  // cannot-save card already makes the offer.
  const offersFork =
    !isLocal && !isOwner && bookId !== 'home' && !isGone && !isTakenDown && !cannotSave;
  // A fork whose original went away (books.bring_in Constraint 7, Decision 6;
  // W11 board #4 :169): the register's durable `goneAt`, or the live ORIGINAL
  // fact before the register re-surfaces. Independent of the fork's own phase —
  // the original going away never changes it — and dated by `followedAt`.
  const original = originalOf(book);
  const originalGone = Boolean(original) && (Boolean(original.goneAt) || originals?.[bookId]?.gone === true);
  const lastBroughtIn = originalGone ? broughtInOn(original.followedAt, currentLocale()) : null;
  // Leaving one shared book (books.leave Constraint 4): only a member — a reader
  // or an editor — of a hosted book that is not the home book, and not once the
  // book is `gone` (nothing to leave, workflow 10 L141-143) or `taken_down`
  // (Decision 6). An owner sees *Delete the book* in that place.
  const offersLeave =
    !isLocal &&
    bookId !== 'home' &&
    (role === 'reader' || role === 'editor') &&
    !isGone &&
    !isTakenDown;
  // Leaving needs a connection (Decision 8): offline, the button is held off.
  const online = useOnline();
  // The make-it-your-own sheet: closed, or `{ following }` — false once access is
  // lost, when following has already ended.
  const [forkSheet, setForkSheet] = useState(null);

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
  const gone = onGone ?? onBack;
  useWorkerEvent(store, EventKind.BOOK_REMOVED, ({ bookId: id }) => {
    if (id === bookId) gone();
  });
  // A leave finished (books.leave): the book is gone from this shelf; close.
  useWorkerEvent(store, EventKind.BOOK_LEFT, ({ bookId: id }) => {
    if (id === bookId) gone();
  });
  // The Worker produced the download zip: save it as a file.
  useWorkerEvent(store, EventKind.BOOK_DOWNLOAD, ({ bookId: id, bytes }) => {
    if (id === bookId) saveZip(title, bytes);
  });

  const putOnline = () => {
    setFailure(null);
    store.send(command(CommandKind.PUT_ONLINE, { bookId }));
  };
  const download = () => store.send(command(CommandKind.DOWNLOAD_BOOK, { bookId }));
  // Every fork offer opens the one sheet; the Worker makes the fork on its
  // confirm (MakeYourOwn sends FORK_BOOK); the shell follows BOOK_FORKED.
  const makeYourOwn = (following) => setForkSheet({ following });
  const remove = () =>
    store.send(command(CommandKind.REMOVE_BOOK, { bookId }));
  const deleteBook = () =>
    store.send(command(CommandKind.DELETE_BOOK, { bookId }));
  const renameBook = (id, name) => store.send(command(CommandKind.RENAME_BOOK, { bookId: id, name }));

  const failureKey = putOnlineFailureKey(failure);
  const failureCopy = failureKey ? t(failureKey) : null;

  return (
    <div className="book-detail">
      <div className="appbar">
        <Button className="btn icon back" aria-label={t('books.backToBook', { book: title })} onPress={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Button>
        <span className="title t-h2">{title}</span>
        <RenameDialog bookId={bookId} currentName={title} onRename={renameBook} />
      </div>

      <div className="scroll book-detail-body">
        <div className="chips">
          <span className="chip">
            {isLocal
              ? t('books.onDevice')
              : `${t('books.onEstante')} · ${
                  isOwner
                    ? t('books.private')
                    : ownerName
                      ? t('books.sharedBy', { owner: ownerName })
                      : t('books.shared')
                }`}
          </span>
          {isOwner ? <span className="chip">{t('books.youOwn')}</span> : null}
          {canSave === true ? (
            <span className="chip">{t('books.youCanSave')}</span>
          ) : canSave === false ? (
            <span className="chip">{t('books.readOnly')}</span>
          ) : null}
        </div>

        {originalGone ? (
          <div className="card pad">
            <span className="t-h2">{t('books.originalGoneTitle')}</span>
            {/* The state in words, in a live region (never colour alone). */}
            <p className="t-small" role="status">
              {lastBroughtIn
                ? t('books.originalGoneBody', { original: original.title || original.bookId, date: lastBroughtIn })
                : t('books.originalGoneBodyUndated', { original: original.title || original.bookId })}
            </p>
          </div>
        ) : null}

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

        {isGone ? (
          <div className="card pad">
            <span className="t-h2">{t('books.lostAccessTitle')}</span>
            {/* The state is carried by a word, in a live region, never colour
                alone (Constraint 5; mockups/README.md:26) — the same role the
                detail's other status copy uses (the put-online error above). */}
            <p className="t-small" role="status">
              {t('books.lostAccessBody')}
            </p>
            {/* Make it my own: present and reachable here; the fork machinery and
                the completed journey are books.fork's (W11 board surface). */}
            <Button className="btn" style={{ alignSelf: 'flex-start' }} onPress={() => makeYourOwn(false)}>
              {t('saveSheet.makeYourOwn')}
            </Button>
          </div>
        ) : null}

        {cannotSave ? (
          <div className="card pad">
            <span className="t-h2">{t('books.cannotSaveTitle')}</span>
            {/* The count and the state, in words, in a live region (workflow 10
                L83-85; never colour alone). The saves are kept for the fork;
                Download stays available below. */}
            <p className="t-small" role="status">
              {t('books.cannotSaveBody', { count: savesWaiting, book: title })}
            </p>
            <Button className="btn" style={{ alignSelf: 'flex-start' }} onPress={() => makeYourOwn(true)}>
              {t('saveSheet.makeYourOwn')}
            </Button>
          </div>
        ) : null}

        {isTakenDown ? (
          <div className="card pad">
            <span className="t-h2">{t('books.takenDownTitle')}</span>
            {/* The operator's reason, verbatim (Decision 4 — the service frames it
                and it is inherently unlocalizable), in a live region so the state
                is carried by a word, never colour alone (Constraint 5;
                mockups/README.md:26) — the same role the lost-access and
                put-online status copy uses. No fork offer: forking a book taken
                down for a copyright notice would re-publish the content under
                notice (Decision 3). Download stays available below. */}
            <p className="t-small" role="status">
              {takenDownReason}
            </p>
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
          <span className="t-h2">{t('fileView.filesEntry')}</span>
          <p className="t-small">{t('books.filesBody')}</p>
          <Button
            className="btn"
            style={{ alignSelf: 'flex-start' }}
            aria-label={t('fileView.filesFor', { name: title })}
            onPress={() => onFiles(bookId)}
          >
            <FilesIcon />
            {t('fileView.filesEntry')}
          </Button>
        </div>

        {offersFork ? (
          <div className="card pad">
            <span className="t-h2">{t('books.fork')}</span>
            <p className="t-small">{t('books.forkBody', { book: title })}</p>
            <Button className="btn" style={{ alignSelf: 'flex-start' }} onPress={() => makeYourOwn(true)}>
              <ForkIcon />
              {t('books.fork')}
            </Button>
          </div>
        ) : null}

        <div className="card pad">
          <span className="t-h2">{t('books.remove')}</span>
          <p className="t-small">{t('books.removeBody')}</p>
          <RemoveDialog
            store={store}
            bookId={bookId}
            title={title}
            isLocal={isLocal}
            savesWaiting={savesWaiting}
            onRemove={remove}
            onDownload={download}
          />
        </div>

        {offersLeave ? (
          <div className="card pad">
            <span className="t-h2">{t('books.leave')}</span>
            <p className="t-small">{t('books.leaveBody')}</p>
            {online ? null : (
              // The precondition in words, in a live region (Leave-book board
              // L192; never colour alone).
              <p className="notice" role="status">
                <span>
                  <b>{t('books.leaveOffline')}</b> {t('books.leaveOfflineBody')}
                </span>
              </p>
            )}
            <LeaveDialog
              store={store}
              bookId={bookId}
              title={title}
              ownerName={ownerName}
              onDevice
              isDisabled={!online}
              trigger={t('books.leave')}
              onMakeYourOwn={() => makeYourOwn(true)}
            />
          </div>
        ) : null}

        {(isOwner && !isLocal) || offersLeave ? (
          // The owner shares the book; a member sees who shares it with them and
          // who saves to it (workflow 10 §Who sees whom; W10 #6).
          <div className="card pad">
            <span className="t-h2">{t('books.share')}</span>
            <p className="t-small">{isOwner ? t('books.shareBody') : t('books.shareBodyMember')}</p>
            <Button
              className="btn"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => onShare(bookId)}
            >
              {t('books.share')}
            </Button>
          </div>
        ) : null}

        {isOwner && !isLocal ? (
          <div className="card pad">
            <span className="t-h2">{t('books.delete')}</span>
            <p className="t-small">{t('books.deleteBody')}</p>
            <DeleteDialog title={title} onDelete={deleteBook} />
          </div>
        ) : null}
      </div>

      <MakeYourOwn
        store={store}
        isOpen={forkSheet !== null}
        onClose={() => setForkSheet(null)}
        bookId={bookId}
        bookTitle={title}
        following={forkSheet?.following ?? true}
      />

    </div>
  );
}
