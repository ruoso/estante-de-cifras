// LeaveDialog.jsx — the Leave confirmation (books.leave; workflow 10 §Leaving a
// book L103-130; Leave-book board L72-77, L121-134, L192). One component for
// both places the verb sits: the *Leave this book* card in book management
// (`onDevice`: the book is on this shelf, so the sentence says it is removed
// from this one and what this device would lose is counted) and the *Leave* on a
// *Mine on Estante* row (not on this device: the sentence alone, no counts).
//
// The Worker owns the network call and the data (Constraint 2): this view sends
// LEAVE_BOOK and reacts to BOOK_LEFT / LEAVE_FAILED. The counts come from the
// Worker's existing SURVEY_SIGN_OUT (Decision 2), asked for when the dialog
// opens and filtered to this book; *Leave the book* is pressable before they
// arrive. A refused or unreachable leave keeps the dialog open and says, in a
// live region, that the person did not leave (Decision 7).
//
// Accessibility: RAC Button / Modal / Dialog (role="alertdialog"); the danger
// action is labelled by its word; Escape cancels and focus returns to the
// trigger (DialogTrigger); the status lines are words, never colour alone.

import { useRef, useState } from 'react';
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from 'react-aria-components';

import { t } from '../i18n/index.js';
import { useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';

// The device commit identity for a shelf-touching command (BookDetail.jsx).
const LOCAL_IDENTITY = { id: 'local', name: 'Me' };

export function WarnIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', color: 'var(--unsaved)' }}>
      <path d="M12 3l10 18H2zM12 10v5M12 18h.01" />
    </svg>
  );
}

/**
 * The Leave verb and its confirmation. `trigger` is the trigger's word and
 * `triggerLabel` its accessible name (a row's *Leave {book}*); `triggerClass`
 * and `triggerStyle` its button style (a card's left-aligned danger button by
 * default; a row passes its quiet button and no style). `isDisabled` holds the trigger off (offline, Decision 8).
 * `onMakeYourOwn` opens the fork sheet (book management only). `ownerName` is
 * the owner's name, when known (the shelf's `owner` register or the *Mine on
 * Estante* row — books.owner_name): the sentence then names who can invite you
 * again; without it, *The owner*.
 */
export default function LeaveDialog({
  store,
  bookId,
  title,
  ownerName,
  onDevice = false,
  isDisabled = false,
  trigger,
  triggerLabel,
  triggerClass = 'btn danger',
  triggerStyle = { alignSelf: 'flex-start' },
  onMakeYourOwn,
}) {
  const [open, setOpen] = useState(false);
  const [survey, setSurvey] = useState(null);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  // This book's entry in the Worker's survey of local-only work (Decision 2).
  useWorkerEvent(store, EventKind.SIGN_OUT_SURVEY, ({ books }) => {
    if (!open || !onDevice) return;
    setSurvey(books?.find((b) => b.id === bookId) ?? null);
  });
  useWorkerEvent(store, EventKind.BOOK_LEFT, ({ bookId: id }) => {
    if (id !== bookId) return;
    inFlight.current = false;
    setOpen(false);
  });
  useWorkerEvent(store, EventKind.LEAVE_FAILED, ({ bookId: id }) => {
    if (id !== bookId) return;
    inFlight.current = false;
    setFailed(true);
  });

  const onOpenChange = (next) => {
    setOpen(next);
    if (!next) return;
    setSurvey(null);
    setFailed(false);
    inFlight.current = false;
    if (onDevice) store.send(command(CommandKind.SURVEY_SIGN_OUT, {}));
  };

  const leave = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setFailed(false);
    store.send(command(CommandKind.LEAVE_BOOK, { bookId, author: LOCAL_IDENTITY }));
  };
  const download = () => store.send(command(CommandKind.DOWNLOAD_BOOK, { bookId }));

  const unsaved = survey?.unsavedSongs ?? 0;
  const unsavedTitles = survey?.unsavedTitles ?? [];
  const waiting = survey?.savesWaiting ?? 0;

  return (
    <DialogTrigger isOpen={open} onOpenChange={onOpenChange}>
      <Button
        className={triggerClass}
        style={triggerStyle ?? undefined}
        isDisabled={isDisabled}
        aria-label={triggerLabel}
      >
        {trigger}
      </Button>
      <ModalOverlay className="scrim center">
        <Modal className="dialog">
          <Dialog role="alertdialog">
            {({ close }) => (
              <>
                <Heading slot="title" className="t-h2">
                  {t('books.leaveTitle', { name: title })}
                </Heading>
                <p className="t-body">
                  {ownerName
                    ? t(onDevice ? 'books.leaveSentenceNamed' : 'books.leaveSentenceRemoteNamed', {
                        owner: ownerName,
                      })
                    : t(onDevice ? 'books.leaveSentence' : 'books.leaveSentenceRemote')}
                </p>
                {onDevice && unsaved > 0 ? (
                  <div className="notice unsaved" style={{ gap: 10 }}>
                    <WarnIcon />
                    <span>
                      <b>{t('books.leaveUnsaved', { count: unsaved })}</b>
                      {unsavedTitles.length ? ` · ${unsavedTitles.join(', ')}` : null}
                    </span>
                  </div>
                ) : null}
                {onDevice && waiting > 0 ? (
                  <>
                    <div className="notice unsaved" style={{ gap: 10 }}>
                      <WarnIcon />
                      <b>{t('books.leaveUnpushed', { count: waiting })}</b>
                    </div>
                    <p className="t-small">{t('books.leaveUnpushedHelp')}</p>
                  </>
                ) : null}
                {failed ? (
                  <p className="notice" role="status">
                    {t('books.leaveFailed', { name: title })}
                  </p>
                ) : null}
                <div className="actions" style={{ flexWrap: 'wrap' }}>
                  <Button className="btn" onPress={close}>
                    {t('books.cancel')}
                  </Button>
                  {onDevice && waiting > 0 ? (
                    <>
                      <Button className="btn" onPress={download}>
                        {t('books.leaveDownloadFirst')}
                      </Button>
                      {onMakeYourOwn ? (
                        <Button
                          className="btn primary"
                          onPress={() => {
                            close();
                            onMakeYourOwn();
                          }}
                        >
                          {t('books.leaveForkFirst')}
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  <Button className="btn danger" onPress={leave}>
                    {t('books.leaveConfirm')}
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
