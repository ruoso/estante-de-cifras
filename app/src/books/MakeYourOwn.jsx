// MakeYourOwn.jsx — the make-it-your-own sheet (books.fork, workflow 11 §Ways in;
// W11 board #1). One sheet for every way in: Save in a book the user cannot save
// to (the save sheet renders `MakeYourOwnBody` in its place), a book whose saves
// were refused as a reader's, a book the user lost access to, and the book
// detail's **Fork** card.
//
// It names the book, not its owner (Decision 4): *{book} is someone else's —
// make it your own?*, three points, the small print, **Make it my own** /
// **Not now**. After losing access the *keeps following* point is dropped —
// following has already ended (workflow 11 §When the original can no longer be
// opened).
//
// The Worker owns the fork (Constraint 1): this view only sends FORK_BOOK and
// renders the BOOK_FORKED / FORK_FAILED replies. Making it your own needs the
// network (Constraint 8): offline and over-the-limit refusals are said in words,
// and nothing on the device changes. The busy word and the outcome sit in one
// `role="status"` region, present from the start so assistive tech announces
// each change. React Aria throughout; the overlay portals into `.est` through
// the app-wide provider ([[rac-overlays-portal-outside-est-theme-root]]).

import { useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

import { t } from '../i18n/index.js';
import { useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import './make-your-own.css';

// The FORK_FAILED code as copy — always a word, never colour alone, never song
// text (Constraint 8).
function failureCopy(code) {
  switch (code) {
    case 'offline':
      return t('fork.offline');
    case 'quota':
      return t('fork.quota');
    case 'signed_out':
      return t('fork.signedOut');
    default:
      return t('fork.error');
  }
}

function CheckIcon() {
  return (
    <svg
      className="est-fork-check"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

/**
 * The sheet's content, for a dialog that already exists (the save sheet's). The
 * heading is the dialog's title slot. `following` is false after losing access.
 * `onForked({ previousBookId, bookId })` is called once the Worker made the fork;
 * `onCancel` is **Not now**.
 */
export function MakeYourOwnBody({
  store,
  bookId,
  bookTitle,
  following = true,
  onCancel = () => {},
  onForked = () => {},
}) {
  const [status, setStatus] = useState({ busy: false, code: null });

  useWorkerEvent(store, EventKind.BOOK_FORKED, (payload) => {
    if (payload?.previousBookId !== bookId) return;
    setStatus({ busy: false, code: null });
    onForked(payload);
  });
  useWorkerEvent(store, EventKind.FORK_FAILED, (payload) => {
    if (payload?.bookId !== bookId) return;
    setStatus({ busy: false, code: payload?.code ?? 'error' });
  });

  const makeIt = () => {
    if (status.busy) return;
    setStatus({ busy: true, code: null });
    store.send(command(CommandKind.FORK_BOOK, { bookId }));
  };

  const points = [
    t('fork.pointCopy'),
    ...(following ? [t('fork.pointFollow', { book: bookTitle })] : []),
    t('fork.pointShelf', { book: bookTitle }),
  ];
  const said = status.busy ? t('fork.busy') : status.code ? failureCopy(status.code) : '';

  return (
    <>
      <Heading slot="title" className="t-h1">
        {t('fork.title', { book: bookTitle })}
      </Heading>
      <p className="t-body">{t('fork.body', { book: bookTitle })}</p>
      <ul className="est-fork-points">
        {points.map((text) => (
          <li key={text} className="t-body">
            <CheckIcon />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <p className="t-small">{t('fork.smallPrint')}</p>
      <p className={`t-small est-fork-status${status.code ? ' failed' : ''}`} role="status">
        {said}
      </p>
      <div className="est-fork-actions">
        <Button className="btn primary block" isDisabled={status.busy} onPress={makeIt}>
          {t('fork.confirm')}
        </Button>
        <Button className="btn quiet block" onPress={onCancel}>
          {t('fork.notNow')}
        </Button>
      </div>
    </>
  );
}

/**
 * The sheet on its own (the book detail's cards). `isOpen` / `onClose` are the
 * host's; `onForked` as above — the sheet closes itself once the fork is made.
 */
export default function MakeYourOwn({
  store,
  isOpen,
  onClose = () => {},
  bookId,
  bookTitle,
  following = true,
  onForked = () => {},
}) {
  return (
    <ModalOverlay
      className="scrim"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
    >
      <Modal className="sheet est-fork-sheet">
        <Dialog>
          {({ close }) => (
            <>
              <div className="grip" aria-hidden="true" />
              <MakeYourOwnBody
                store={store}
                bookId={bookId}
                bookTitle={bookTitle}
                following={following}
                onCancel={close}
                onForked={(payload) => {
                  onForked(payload);
                  close();
                }}
              />
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
