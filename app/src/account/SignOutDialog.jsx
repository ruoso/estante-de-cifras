// SignOutDialog — the current-device sign-out (account.sign_out, workflow 13
// §Signing out; mockup docs/mockups/W13-new-device.dc.html:174-197). It fills the
// `onSignOut` seam the account screen left: on "Sign out of this device" it asks
// how to leave the account on THIS device — remove this account's books (the
// default, for a borrowed or shared device) or keep them as local books — having
// first surveyed and warned about work only on this device (unsaved changes and
// saves not yet pushed, per book) and offered a download for any book only here.
//
// The Worker owns the teardown (SURVEY_SIGN_OUT counts, SIGN_OUT removes or
// migrates; DIRECTION §3.7): the view only dispatches and reads the reply event.
// On confirm the Worker tears down locally first, then the app POSTs
// /api/auth/signout, then it returns to the not-signed-in state (Decision 4) —
// offline-first, so a failed/offline POST still leaves the device account-free.
//
// Accessibility: a React Aria Dialog holding focus; the choice is a RadioGroup
// with the default pre-selected; counts and the download guard are carried by
// words in notice text; the confirm is a danger button whose label states the
// chosen action; the offline outcome is a role="status" line. axe-clean per state.

import { Fragment, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
} from 'react-aria-components';

import { t } from '../i18n/index.js';
import { useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { aggregateSignOutSurvey } from '../worker/sign-out.js';
import { saveZip } from '../books/download-zip.js';
import { AuthError } from './auth-client.js';

// The device commit identity for the shelf-touching teardown, the same literal
// the shell and the shelf use; the Worker's `authorFrom` turns it into a no-reply
// address (the account-id switch is new_device's, unbuilt).
const LOCAL_IDENTITY = { id: 'local', name: 'Me' };

// A check-mark for the chosen card (mockup's filled circle); the Radio's own
// aria-checked carries the selection to a screen reader, so this is decoration.
function CheckMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

// One choice card (a RAC Radio laid out like the mockup's cards,
// W13-new-device.dc.html:178-185): a round check that fills when chosen, the
// label and a line of meta. The whole card is the radio.
function SignOutChoice({ value, label, meta }) {
  return (
    <Radio className="card pad signout-card" value={value}>
      {({ isSelected }) => (
        <>
          <span className={`check signout-check${isSelected ? ' on' : ''}`}>
            {isSelected ? <CheckMark /> : null}
          </span>
          <span className="signout-choice-text">
            <span className="t-h3 account-subhead">{label}</span>
            <span className="t-small">{meta}</span>
          </span>
        </>
      )}
    </Radio>
  );
}

export default function SignOutDialog({ store, authClient, onSignedOut = () => {} }) {
  const [survey, setSurvey] = useState(null);
  const [mode, setMode] = useState('remove');
  const [offline, setOffline] = useState(false);
  const inFlight = useRef(false);

  // The Worker's point-in-time survey of this device's local-only work.
  useWorkerEvent(store, EventKind.SIGN_OUT_SURVEY, ({ books }) => setSurvey({ books }));

  // A guard-book download the user asked for: save the Worker's zip as a file.
  useWorkerEvent(store, EventKind.BOOK_DOWNLOAD, ({ bookId, bytes }) => {
    const book = survey?.books?.find((b) => b.id === bookId);
    saveZip(book?.title, bytes);
  });

  // Teardown is done (clones gone / migrated, shelf re-surfaced). Now clear the
  // server session (Decision 4): the device is already locally account-free, so
  // a 401 or an offline failure is fine — note it and return to not-signed-in.
  useWorkerEvent(store, EventKind.SIGNED_OUT, async () => {
    try {
      await authClient.signOut();
    } catch (error) {
      if (error instanceof AuthError && error.kind === 'network') setOffline(true);
      // A 401 (no session) means it is already cleared — nothing to report.
    }
    inFlight.current = false;
    onSignedOut();
  });

  const openSurvey = (open) => {
    if (!open) return;
    setSurvey(null);
    setMode('remove');
    setOffline(false);
    inFlight.current = false;
    store.send(command(CommandKind.SURVEY_SIGN_OUT, {}));
  };

  const download = (bookId) => store.send(command(CommandKind.DOWNLOAD_BOOK, { bookId }));

  const confirm = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    store.send(command(CommandKind.SIGN_OUT, { mode, author: LOCAL_IDENTITY }));
  };

  const { notYetOnEstante, downloadGuard } = aggregateSignOutSurvey(survey?.books ?? []);

  return (
    <DialogTrigger onOpenChange={openSurvey}>
      <Button className="btn">{t('account.signOutThis')}</Button>
      <ModalOverlay className="scrim center">
        <Modal className="dialog">
          <Dialog>
            {() => (
              <>
                <Heading slot="title" className="t-h2">
                  {t('account.signOutThisTitle')}
                </Heading>
                <RadioGroup
                  className="signout-choice"
                  aria-label={t('account.signOutChoice')}
                  value={mode}
                  onChange={setMode}
                >
                  <SignOutChoice
                    value="remove"
                    label={t('account.signOutRemove')}
                    meta={t('account.signOutRemoveMeta')}
                  />
                  <SignOutChoice
                    value="keep"
                    label={t('account.signOutKeep')}
                    meta={t('account.signOutKeepMeta')}
                  />
                </RadioGroup>

                {notYetOnEstante.length > 0 ? (
                  <div className="notice unsaved signout-notice">
                    <span>
                      <b>{t('account.signOutNotYet')}</b>
                    </span>
                    {notYetOnEstante.map((book) => (
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
                            {t('account.signOutUnpushed', {
                              title: book.title,
                              count: book.savesWaiting,
                            })}
                          </span>
                        ) : null}
                      </Fragment>
                    ))}
                  </div>
                ) : null}

                {mode === 'remove'
                  ? downloadGuard.map((book) => (
                      <div className="notice signout-notice" key={book.id}>
                        <span>{t('account.signOutOnlyHere', { title: book.title })}</span>
                        <Button
                          className="act"
                          onPress={() => download(book.id)}
                          aria-label={t('account.signOutDownloadLabel', { title: book.title })}
                        >
                          {t('account.signOutDownload')}
                        </Button>
                      </div>
                    ))
                  : null}

                {offline ? (
                  <p className="t-small" role="status">
                    {t('account.signOutLeftOffline')}
                  </p>
                ) : null}

                <div className="actions">
                  <Button className="btn" slot="close">
                    {t('account.cancel')}
                  </Button>
                  <Button className="btn danger" onPress={confirm}>
                    {mode === 'keep'
                      ? t('account.signOutConfirmKeep')
                      : t('account.signOutConfirmRemove')}
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
