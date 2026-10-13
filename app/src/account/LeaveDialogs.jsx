// LeaveDialogs — the Leaving Estante region's two affordances (account.leaving,
// workflow 17): "Take your data out" and the terminal "Delete my account". It
// renders inside the account screen's signed-in branch, below Passkeys, and owns
// both dialogs so the delete dialog's "Take your data out first" link can open the
// data-out one (a controlled open state, not two independent DialogTriggers).
//
// Take your data out is purely local and offline (Constraint 3): it lists every
// reachable book — the shelf's shared and local books plus the home book — each
// with a Download that dispatches DOWNLOAD_BOOK, reusing workflow 7's per-book zip
// (BOOK_DOWNLOAD → saveZip) exactly as SignOutDialog does. Nothing waits on the
// network; offline it still downloads and says so.
//
// Delete my account is the one action that waits for a connection (Constraint 2,
// Decision 3): the DELETE /api/account call comes FIRST — the inverse of sign-out
// — and the Worker device teardown (LEAVE_ESTANTE) runs only on its 204. The
// confirm is the account's email typed into a field; the app never holds the
// address (Decision 4), so the danger action gates only on a non-empty field and
// an online device, and the server verifies the address and returns 400 on a
// mismatch, which the dialog words in a role="alert" without ever showing the
// real one. Warnings are counted from the sign-out survey (per-book unsaved /
// not-yet-pushed) and listMembers (who loses access) via aggregateLeaveWarnings.
//
// Overlays are portaled into the `.est` token root by ThemeRoot's
// UNSAFE_PortalProvider ([[rac-overlays-portal-outside-est-theme-root]]), so no
// per-dialog portal wiring is needed here.

import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
} from 'react-aria-components';

import { t } from '../i18n/index.js';
import { orderedBooks, titleFor } from '../books/book-display.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { saveZip } from '../books/download-zip.js';
import { AuthError } from './auth-client.js';
import { canDeleteAccount, aggregateLeaveWarnings } from './leave.js';

// The home book's id (home-book.js HOME_BOOK_ID). The view does not import the
// Worker module; it names the shared id the way sync-display.js does.
const HOME_BOOK_ID = 'home';

// The device's online state, read from navigator and kept live by the network
// events. Deleting waits on a connection (workflow 17 §Offline); taking data out
// does not. In a test with no navigator this defaults to online.
function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    globalThis.addEventListener?.('online', up);
    globalThis.addEventListener?.('offline', down);
    return () => {
      globalThis.removeEventListener?.('online', up);
      globalThis.removeEventListener?.('offline', down);
    };
  }, []);
  return online;
}

// The four willHappen statements (workflow 17 §Deleting; mockup W17 Computer).
const WILL_HAPPEN_KEYS = [
  'account.leaveWillAccount',
  'account.leaveWillBooks',
  'account.leaveWillAccess',
  'account.leaveWillDevice',
];

/**
 * @param {{
 *   store: object,
 *   authClient: { deleteAccount: (email: string) => Promise<void> },
 *   sharingClient: { listMembers: (bookId: string) => Promise<{ count: number }> },
 *   onLeft?: () => void,
 * }} props
 */
export default function LeaveDialogs({ store, authClient, sharingClient, onLeft = () => {} }) {
  const shelf = useSlice(store, 'shelf');
  const online = useOnline();

  // null | 'data' | 'delete' — which dialog is open (controlled, so the delete
  // dialog's download-first link can switch to the data-out one).
  const [open, setOpen] = useState(null);

  // Delete-dialog state.
  const [survey, setSurvey] = useState(null);
  const [memberCounts, setMemberCounts] = useState({});
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState(null); // null | 'mismatch' | 'network' | 'generic'
  const inFlight = useRef(false);
  const sharingRef = useRef(sharingClient); // held in a ref so the count fetch
  useEffect(() => {
    sharingRef.current = sharingClient; // effect never re-runs on re-render
  });

  // Every reachable book, for the data-out list: the shelf's books (owned and
  // member) plus the home book (it holds the preferences, shelf and shapes).
  const dataOutBooks = [
    ...orderedBooks(shelf).map(({ id, book }) => ({ id, title: titleFor(book, id) })),
    { id: HOME_BOOK_ID, title: t('account.leaveHomeBook') },
  ];

  // A download yields its zip; look the title up for the filename.
  useWorkerEvent(store, EventKind.BOOK_DOWNLOAD, ({ bookId, bytes }) => {
    const book = dataOutBooks.find((b) => b.id === bookId);
    saveZip(book?.title, bytes);
  });

  // The per-book survey arrives after a SURVEY_SIGN_OUT; fetch who-loses-access
  // counts for the owned books it names (offline, those simply stay uncounted).
  useWorkerEvent(store, EventKind.SIGN_OUT_SURVEY, ({ books }) => setSurvey(books ?? []));
  useEffect(() => {
    if (!survey) return undefined;
    const owned = survey.filter((b) => b.role === 'owner');
    let cancelled = false;
    (async () => {
      const counts = {};
      for (const book of owned) {
        try {
          const list = await sharingRef.current.listMembers(book.id);
          counts[book.id] = list?.count ?? 0;
        } catch {
          // Offline or a stranger's 404 — leave this book uncounted.
        }
      }
      if (!cancelled) setMemberCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, [survey]);

  // The leave teardown reply: the device is now account-free; return to first-run.
  useWorkerEvent(store, EventKind.LEFT_ESTANTE, () => {
    inFlight.current = false;
    setOpen(null);
    onLeft();
  });

  const download = (bookId) => store.send(command(CommandKind.DOWNLOAD_BOOK, { bookId }));
  const downloadEverything = () => dataOutBooks.forEach((b) => download(b.id));

  const openDelete = () => {
    setConfirmEmail('');
    setError(null);
    setSurvey(null);
    setMemberCounts({});
    store.send(command(CommandKind.SURVEY_SIGN_OUT, {}));
    setOpen('delete');
  };

  const confirmDelete = async () => {
    if (inFlight.current || !canDeleteAccount({ confirmEmail, online })) return;
    inFlight.current = true;
    setError(null);
    try {
      await authClient.deleteAccount(confirmEmail);
    } catch (err) {
      inFlight.current = false;
      if (err instanceof AuthError && err.kind === 'mismatch') return setError('mismatch');
      if (err instanceof AuthError && err.kind === 'network') return setError('network');
      return setError('generic');
    }
    // 204 — hand the device teardown to the Worker (no author: it writes nothing,
    // only drops clones and re-surfaces an empty, first-run home book).
    store.send(command(CommandKind.LEAVE_ESTANTE, {}));
  };

  const { loseAccess, onlyHere } = aggregateLeaveWarnings({ books: survey ?? [], memberCounts });

  return (
    <>
      <div className="account-card account-leave-card">
        <span className="t-h3 account-section account-leave-head">{t('account.leaving')}</span>
        <p className="t-small account-leave-body">{t('account.leavingBody')}</p>
        <Button className="btn block" onPress={() => setOpen('data')}>
          {t('account.leaveTakeData')}
        </Button>
        <Button className="btn danger block account-leave-delete" onPress={openDelete}>
          {t('account.leaveDelete')}
        </Button>
      </div>

      {/* Take your data out — local, offline, repeatable. */}
      <ModalOverlay
        className="scrim center"
        isOpen={open === 'data'}
        onOpenChange={(o) => !o && setOpen(null)}
      >
        <Modal className="dialog">
          <Dialog aria-label={t('account.leaveTakeTitle')}>
            <Heading slot="title" className="t-h2">
              {t('account.leaveTakeTitle')}
            </Heading>
            {!online ? (
              <div className="notice account-leave-offline" role="status">
                <span>
                  <b>{t('account.leaveOffline')}</b>
                </span>
                <span className="t-small">{t('account.leaveOfflineNote')}</span>
              </div>
            ) : null}
            <p className="t-small">{t('account.leaveDataBody')}</p>
            <Button className="btn primary block" onPress={downloadEverything}>
              {t('account.leaveDownloadAll')}
            </Button>
            <div className="list account-list">
              {dataOutBooks.map((book) => (
                <div className="row account-row" key={book.id}>
                  <span className="grow">
                    <span className="name">{book.title}</span>
                  </span>
                  <Button
                    className="btn quiet"
                    onPress={() => download(book.id)}
                    aria-label={t('account.leaveDownloadLabel', { title: book.title })}
                  >
                    {t('account.leaveDownload')}
                  </Button>
                </div>
              ))}
            </div>
            <div className="actions">
              <Button className="btn" onPress={() => setOpen(null)}>
                {t('account.leaveClose')}
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>

      {/* Delete my account — terminal, network-first. */}
      <ModalOverlay
        className="scrim center"
        isOpen={open === 'delete'}
        onOpenChange={(o) => !o && setOpen(null)}
      >
        <Modal className="dialog">
          <Dialog aria-label={t('account.leaveTitle')}>
            <Heading slot="title" className="t-h2">
              {t('account.leaveTitle')}
            </Heading>
            <p className="t-body account-leave-lead">{t('account.leaveWhen')}</p>
            <ul className="account-leave-will">
              {WILL_HAPPEN_KEYS.map((key) => (
                <li className="t-body" key={key}>
                  {t(key)}
                </li>
              ))}
            </ul>

            {loseAccess.length > 0 ? (
              <div className="notice conflict account-leave-notice">
                <span>
                  <b>{t('account.leaveOwnHead')}</b>
                </span>
                {loseAccess.map((book) => (
                  <span key={book.id}>
                    {book.count > 0
                      ? t('account.leaveSharedWith', { title: book.title, count: book.count })
                      : t('account.leaveOnlyYou', { title: book.title })}
                  </span>
                ))}
              </div>
            ) : null}

            {onlyHere.length > 0 ? (
              <div className="notice unsaved account-leave-notice">
                <span>
                  <b>{t('account.leaveLocalHead')}</b>
                </span>
                {onlyHere.map((book) => (
                  <Fragment key={book.id}>
                    {book.unsavedSongs > 0 ? (
                      <span>
                        {t('account.signOutUnsavedSongs', {
                          title: book.title,
                          count: book.unsavedSongs,
                        })}
                      </span>
                    ) : null}
                    {book.savesWaiting > 0 ? (
                      <span>
                        {t('account.signOutUnpushed', { title: book.title, count: book.savesWaiting })}
                      </span>
                    ) : null}
                  </Fragment>
                ))}
                <Button className="act" onPress={() => setOpen('data')}>
                  {t('account.leaveTakeFirst')}
                </Button>
              </div>
            ) : null}

            <TextField
              className="field"
              value={confirmEmail}
              onChange={setConfirmEmail}
              type="email"
              autoComplete="off"
            >
              <Label>{t('account.leaveConfirmLabel')}</Label>
              <Input className="input" />
            </TextField>

            {error ? (
              <p className="notice warn account-leave-error" role="alert">
                {error === 'mismatch'
                  ? t('account.leaveMismatch')
                  : error === 'network'
                    ? t('account.errNetwork')
                    : t('account.errGeneric')}
              </p>
            ) : null}

            {!online ? (
              <p className="t-small account-leave-needs" role="status">
                {t('account.leaveNeedsConnection')}
              </p>
            ) : null}

            <p className="t-small">
              <b>{t('account.leaveCannotUndo')}</b>
            </p>

            <div className="actions">
              <Button className="btn" onPress={() => setOpen(null)}>
                {t('account.cancel')}
              </Button>
              <Button
                className="btn danger"
                isDisabled={!canDeleteAccount({ confirmEmail, online })}
                onPress={confirmDelete}
              >
                {t('account.leaveDelete')}
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
