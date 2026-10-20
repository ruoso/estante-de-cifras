// ShareNeedsOnline.jsx — *Share* on a song in a book only on this device
// (books.share_needs_online; workflow 10 §Sharing a song): there is no one to
// share it with yet, so the surface says so in words — the book is only here,
// put it online to invite people — with the line *Put online* carries in the
// book's detail (workflow 7 §Putting a book online: it goes online private), and
// offers the way on: *Put online* right here, or, signed out, *Sign in to put it
// online* first (workflow 13 §Signing in, or making an account).
//
// It draws only the body, so any Share surface can hold it (the song's panel and
// sheet; a setlist's Share later). It asks Estante nothing itself: *Put online*
// sends the Worker the same PUT_ONLINE the book detail sends, and a refusal is
// worded by the one function the detail also uses. Once the book is online the
// shell moves the surface to the new id and the owner's song share replaces
// this body.

import { useState } from 'react';
import { Button } from 'react-aria-components';

import { t } from '../i18n/index.js';
import { useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { putOnlineFailureKey } from './book-display.js';

/**
 * `accountStatus` is the shell's `'unknown' | 'in' | 'out'`: signed out offers
 * signing in first (`onSignIn`); otherwise *Put online* — an unknown status
 * included, the Worker's refusal words the truth when it is pressed (Decision 4).
 */
export default function ShareNeedsOnline({ store, bookId, bookTitle, accountStatus = 'unknown', onSignIn = () => {} }) {
  const [putting, setPutting] = useState(false);
  const [failure, setFailure] = useState(null);

  useWorkerEvent(store, EventKind.BOOK_ONLINE_REFUSED, ({ bookId: id, reason }) => {
    if (id !== bookId) return;
    setPutting(false);
    setFailure(reason ?? 'error');
  });

  const putOnline = () => {
    setFailure(null);
    setPutting(true);
    store.send(command(CommandKind.PUT_ONLINE, { bookId }));
  };

  const failureKey = putOnlineFailureKey(failure);
  const signedOut = accountStatus === 'out';
  const offersSignIn = signedOut || failure === 'signed_out';

  return (
    <div className="est-sharing-body">
      <p className="t-small">{t('sharing.needsOnline', { book: bookTitle })}</p>
      <p className="t-small">{t('books.putOnlineBody')}</p>
      {failureKey ? (
        <p className="notice warn" role="alert">
          {t(failureKey)}
        </p>
      ) : null}
      {putting ? (
        <p className="t-small" role="status">
          {t('sharing.needsOnlinePutting')}
        </p>
      ) : null}
      <div className="actions">
        {signedOut ? null : (
          <Button className="btn primary" isDisabled={putting} onPress={putOnline}>
            {t('books.putOnline')}
          </Button>
        )}
        {offersSignIn ? (
          <Button className={signedOut ? 'btn primary' : 'btn'} onPress={onSignIn}>
            {t('sharing.needsOnlineSignIn')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
