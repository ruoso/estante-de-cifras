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
// — and the Worker device teardown (LEAVE_ESTANTE) runs only on its 204. How it
// is confirmed is the account screen's `confirmBy` (account.recovery_email
// Decision 2): an account with a confirmed email types it into a field — never
// prefilled, though the account screen's Recovery email region is the one place
// that shows the address to its owner — so the danger action gates only on a
// non-empty field and an online device, and the server verifies the address and
// returns 400 on a mismatch, which the dialog words in a role="alert" without
// ever showing the real one. An account with no email (workflow 17 §An account
// with no email) confirms with a fresh passkey instead: delete/begin, the
// browser's prompt, then DELETE with the assertion; a cancelled prompt or a
// refused passkey each leave the dialog open with their own alert. Warnings are counted from the sign-out survey (per-book unsaved /
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
import { useOnline } from './use-online.js';
import { getCredential, isCancellation } from './webauthn-json.js';

// The home book's id (home-book.js HOME_BOOK_ID). The view does not import the
// Worker module; it names the shared id the way sync-display.js does.
const HOME_BOOK_ID = 'home';

// The key glyph of the passkey notice (board Computer); decorative.
function PasskeyIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 6l3 3M15 8l2 2" />
    </svg>
  );
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
 *   authClient: {
 *     deleteAccount: (email: string) => Promise<void>,
 *     beginDeletePasskey: () => Promise<{ publicKey: object, state: string }>,
 *     deleteAccountByPasskey: (body: { state: string, credential: object }) => Promise<void>,
 *   },
 *   sharingClient: { listMembers: (bookId: string) => Promise<{ count: number }> },
 *   confirmBy?: 'email' | 'passkey' | null,
 *   onConfirmByChanged?: () => void,
 *   onLeft?: () => void,
 * }} props
 *   `confirmBy` is 'email' when the account has a confirmed email, 'passkey'
 *   when it has none, and null until the account screen knows (Delete is then
 *   disabled — account.recovery_email Decision 3). `onConfirmByChanged` asks the
 *   screen to reload the recovery email when the server says the account now
 *   confirms by email.
 */
export default function LeaveDialogs({
  store,
  authClient,
  sharingClient,
  confirmBy = null,
  onConfirmByChanged = () => {},
  onLeft = () => {},
}) {
  const shelf = useSlice(store, 'shelf');
  const online = useOnline();

  // null | 'data' | 'delete' — which dialog is open (controlled, so the delete
  // dialog's download-first link can switch to the data-out one).
  const [open, setOpen] = useState(null);

  // Delete-dialog state.
  const [survey, setSurvey] = useState(null);
  const [memberCounts, setMemberCounts] = useState({});
  const [confirmEmail, setConfirmEmail] = useState('');
  // null | 'mismatch' | 'network' | 'generic' | 'cancelled' | 'refused' | 'nowEmail'
  const [error, setError] = useState(null);
  // Set when delete/begin answered `confirm_by_email` (an email was confirmed
  // elsewhere since the screen loaded): the dialog switches to the typed field
  // without waiting for the screen's reload.
  const [switchedToEmail, setSwitchedToEmail] = useState(false);
  const mode = switchedToEmail ? 'email' : confirmBy;
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
    setSwitchedToEmail(false);
    setSurvey(null);
    setMemberCounts({});
    store.send(command(CommandKind.SURVEY_SIGN_OUT, {}));
    setOpen('delete');
  };

  // The server says this account now confirms by its email: switch the dialog to
  // the typed field, worded, and have the screen reload the recovery email.
  const switchToEmail = () => {
    inFlight.current = false;
    setSwitchedToEmail(true);
    setConfirmEmail('');
    setError('nowEmail');
    onConfirmByChanged();
  };

  // A passkey-only account (workflow 17 §An account with no email): begin, the
  // browser's passkey prompt, then DELETE with the assertion. No DELETE is sent
  // after a cancelled prompt; a device with no passkey for the account ends in
  // the same NotAllowedError, so it shares the cancelled alert (Decision 8).
  const confirmByPasskey = async () => {
    let begin;
    let credential;
    try {
      begin = await authClient.beginDeletePasskey();
    } catch (err) {
      if (err instanceof AuthError && err.kind === 'confirm_by_email') return switchToEmail();
      inFlight.current = false;
      return setError(err instanceof AuthError && err.kind === 'network' ? 'network' : 'generic');
    }
    try {
      ({ credential } = await getCredential(begin.publicKey));
    } catch (err) {
      inFlight.current = false;
      return setError(isCancellation(err) ? 'cancelled' : 'generic');
    }
    try {
      await authClient.deleteAccountByPasskey({ state: begin.state, credential });
    } catch (err) {
      if (err instanceof AuthError && err.kind === 'confirm_by_email') return switchToEmail();
      inFlight.current = false;
      if (err instanceof AuthError && err.kind === 'refused') return setError('refused');
      if (err instanceof AuthError && err.kind === 'network') return setError('network');
      return setError('generic');
    }
    // 204 — the same device teardown as the typed path.
    store.send(command(CommandKind.LEAVE_ESTANTE, {}));
  };

  const confirmDelete = async () => {
    if (inFlight.current || !canDeleteAccount({ confirmBy: mode, confirmEmail, online })) return;
    inFlight.current = true;
    setError(null);
    if (mode === 'passkey') return confirmByPasskey();
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

            {mode === 'passkey' ? (
              <div className="notice account-leave-passkey">
                <PasskeyIcon />
                <span>{t('account.leaveByPasskey')}</span>
              </div>
            ) : (
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
            )}

            {error === 'cancelled' ? (
              <p className="notice conflict account-leave-error" role="alert">
                <span>
                  <b>{t('account.leaveNotConfirmed')}</b> {t('account.leaveNotConfirmedBody')}
                </span>
              </p>
            ) : error ? (
              <p className="notice warn account-leave-error" role="alert">
                {error === 'mismatch'
                  ? t('account.leaveMismatch')
                  : error === 'refused'
                    ? t('account.leaveRefused')
                    : error === 'nowEmail'
                      ? t('account.leaveNowEmail')
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
                isDisabled={!canDeleteAccount({ confirmBy: mode, confirmEmail, online })}
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
