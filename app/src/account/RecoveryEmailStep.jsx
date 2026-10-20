// RecoveryEmailStep — the sign-in surface's *Add a recovery email* step
// (account.sign_in_two_doors; workflow 13 §Asked when the account is made;
// board Sign-in.dc.html Phone 2). SignIn shows it right after *Make an account*,
// and only then: the account exists, its home book is attaching behind it, and
// it has one passkey and no other way back in.
//
// It is the account screen's set-and-verify, not a second one: **Send link**
// posts the address through the same `requestRecoveryEmail` the Recovery email
// region uses, words a failure with the region's `requestErrorCopy`, and draws
// the region's field. On a 202 it says the region's *waiting* words, naming the
// address, with **Done**. **Not now** posts nothing and goes on; the banner and
// the account screen ask again. Offline *Send link* waits, saying so in words;
// *Not now* never does. It logs nothing.

import { forwardRef, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { RecoveryEmailField } from './RecoveryEmailRegion.jsx';
import { useOnline } from './use-online.js';

// A stand-in for `{address}` while the sentence is split around it, so the
// address can be set in bold inside whichever word order the language uses.
const ADDRESS_MARK = '⁣';

function withAddress(key, address) {
  const [before, after = ''] = t(key, { address: ADDRESS_MARK }).split(ADDRESS_MARK);
  return (
    <>
      {before}
      <b>{address}</b>
      {after}
    </>
  );
}

// The warning glyph of the step's notice (Sign-in Phone 2); decorative.
function WarnIcon() {
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
      className="account-recovery-warn-icon"
    >
      <path d="M12 3l10 18H2zM12 10v5M12 18h.01" />
    </svg>
  );
}

/**
 * @param {{
 *   authClient: { requestRecoveryEmail: (email: string) => Promise<void> },
 *   onDone: () => void,
 * }} props
 *   The ref is the step's heading, which SignIn focuses as the step appears.
 */
const RecoveryEmailStep = forwardRef(function RecoveryEmailStep({ authClient, onDone }, headingRef) {
  const online = useOnline();
  const [address, setAddress] = useState('');
  const [sent, setSent] = useState(null); // the address a 202 accepted, or null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // the failed request's AuthError, or null
  const inFlight = useRef(false);

  const request = async () => {
    const target = address.trim();
    if (!target || inFlight.current || !online) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await authClient.requestRecoveryEmail(target);
      setSent(target);
    } catch (err) {
      setError(err);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const submit = (event) => {
    event?.preventDefault?.();
    request();
  };

  return (
    <>
      <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
        {t('signIn.recoveryHeading')}
      </h2>
      {sent ? (
        <>
          <div className="notice accent account-recovery-sent">
            <span>{withAddress('account.recoverySent', sent)}</span>
            <span className="t-small">{t('account.recoveryOnceNone')}</span>
          </div>
          <Button className="btn primary block" onPress={onDone}>
            {t('arrange.done')}
          </Button>
        </>
      ) : (
        <>
          <div className="notice unsaved account-recovery-warn">
            <WarnIcon />
            <span>{t('account.recoveryNoneWarn')}</span>
          </div>
          <form className="account-form account-recovery-form" onSubmit={submit}>
            <RecoveryEmailField
              value={address}
              onChange={setAddress}
              error={error}
              retryDisabled={!online || busy}
              onRetry={request}
            />
            <Button type="submit" className="btn primary block" isDisabled={!online || busy}>
              {t('signIn.recoverySend')}
            </Button>
          </form>
          <Button className="btn quiet block" onPress={onDone}>
            {t('signIn.offerSkip')}
          </Button>
          {!online ? (
            <p className="notice account-recovery-offline" role="status">
              {t('account.recoveryOffline')}
            </p>
          ) : null}
        </>
      )}
    </>
  );
});

export default RecoveryEmailStep;
