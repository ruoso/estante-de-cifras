// RecoveryEmailConfirm — the page the recovery email's verification link opens
// (account.recovery_email; workflow 13 §Confirming it L48–53, §Who holds an
// address L60–65; board Recovery-email.dc.html Tablet). App.jsx captures the
// token from `/recovery-email/<token>` at boot and AppShell shows this as its own
// full-screen surface, on any device, signed in or not (Decision 6).
//
// It posts the token once and says, in words, what came of it: confirmed, the
// link expired or was used, the address belongs to another account, too many
// tries, or no connection. It never signs in — the confirm takes no session and
// sets no cookie — so the device's signed-in state is untouched, and a 401 is
// not a state here. It does not name the address: the 204 carries none and the
// page has no session to read it (Decision 7). "Open Estante" closes it onto the
// shelf. It logs nothing — no token, no address.

import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';

import { t } from '../i18n/index.js';
import { createAuthClient, AuthError } from './auth-client.js';
import './account.css';

// The real client, bound to the browser's fetch; the behavior level injects a
// loopback double instead.
const DEFAULT_CLIENT = createAuthClient();

// The check of the confirmed outcome (board Tablet); decorative.
function CheckIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

// The outcome a failed confirm is worded as.
function failureOf(error) {
  if (error instanceof AuthError) {
    if (error.kind === 'link_invalid') return 'expired';
    if (error.kind === 'address_taken') return 'taken';
    if (error.kind === 'rate_limited') return 'rateLimited';
  }
  return 'errNetwork';
}

/**
 * @param {{
 *   token: string,
 *   authClient?: { confirmRecoveryEmail: (token: string) => Promise<void> },
 *   onClose?: () => void,
 * }} props
 */
export default function RecoveryEmailConfirm({ token, authClient = DEFAULT_CLIENT, onClose = () => {} }) {
  // 'working' | 'confirmed' | 'expired' | 'taken' | 'rateLimited' | 'errNetwork'
  const [outcome, setOutcome] = useState('working');
  const clientRef = useRef(authClient);
  const started = useRef(false);
  const headingRef = useRef(null);

  const confirm = async () => {
    try {
      await clientRef.current.confirmRecoveryEmail(token);
      setOutcome('confirmed');
    } catch (error) {
      setOutcome(failureOf(error));
    }
  };

  // Post the token once (a ref-guarded effect, as SignIn's redeem does), so a
  // re-render never spends the single-use link twice.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Land focus on each outcome's heading as it appears.
  useEffect(() => {
    headingRef.current?.focus();
  }, [outcome]);

  const retry = () => {
    setOutcome('working');
    confirm();
  };

  let content;
  if (outcome === 'working') {
    content = (
      <>
        <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
          {t('recoveryConfirm.heading')}
        </h2>
        <p className="t-body account-sub" role="status">
          {t('recoveryConfirm.working')}
        </p>
      </>
    );
  } else if (outcome === 'confirmed') {
    content = (
      <>
        <div className="account-confirm-head">
          <span className="account-confirm-check">
            <CheckIcon />
          </span>
          <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
            {t('recoveryConfirm.confirmed')}
          </h2>
        </div>
        <p className="t-body account-sub" role="status">
          {t('recoveryConfirm.body')}
        </p>
        <div className="notice">
          <span>{t('recoveryConfirm.notice')}</span>
        </div>
        <Button className="btn primary block" onPress={onClose}>
          {t('recoveryConfirm.open')}
        </Button>
      </>
    );
  } else {
    const canRetry = outcome === 'rateLimited' || outcome === 'errNetwork';
    content = (
      <>
        <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
          {t('recoveryConfirm.heading')}
        </h2>
        <p className="notice conflict" role="alert">
          {t(`recoveryConfirm.${outcome}`)}
        </p>
        {canRetry ? (
          <Button className="btn block" onPress={retry}>
            {t('recoveryConfirm.retry')}
          </Button>
        ) : null}
        <Button className={`btn block${canRetry ? '' : ' primary'}`} onPress={onClose}>
          {t('recoveryConfirm.open')}
        </Button>
      </>
    );
  }

  return (
    <div className="screen account-screen">
      <div className="appbar">
        <span className="title">{t('recoveryConfirm.brand')}</span>
      </div>
      <div className="scroll account-scroll">
        <div className="account-card">{content}</div>
      </div>
    </div>
  );
}
