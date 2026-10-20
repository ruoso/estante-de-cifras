// RecoveryEmailRegion — the account screen's Recovery email region
// (account.recovery_email; workflow 13 §The recovery email L32–68, §The account
// screen L135–142; board Recovery-email.dc.html Phone 1, Phone 2 and Tablet). It
// sits below Passkeys, signed in only, and is the one place the app shows the
// address — to its owner (design.recovery_email Decision L281).
//
// The account screen reads `GET /api/account/recovery-email` and hands the
// `{ email, pending }` here; the region draws one of its states
// (recoveryEmailState): none (the warning and the field), waiting (the pending
// address, Send again, Use a different address), confirmed (the address with
// its Confirmed badge and Change), or confirmed+waiting (both). A request posts
// the address and asks the screen to reload, which lands in waiting; the address
// is written only when the emailed link is opened, on the confirm page.
//
// Plain session HTTP through the injected auth-client — no Worker, no IndexedDB,
// no book (workflow 13 L34–39). Offline every button waits, and a note says so
// in words; the rest of the screen and the songs do not (L66–68). Every status
// is a word, never colour alone; errors are worded from the AuthError kind, never
// the server's message. It logs nothing.

import { useEffect, useId, useRef, useState } from 'react';
import { Button, Input, Label, Text, TextField } from 'react-aria-components';

import { t } from '../i18n/index.js';
import { AuthError } from './auth-client.js';
import { recoveryEmailState } from './recovery-email.js';

// A stand-in for `{address}` while a sentence is split around it, so the
// address can be set in bold inside whichever word order the language uses.
const ADDRESS_MARK = '⁣';

// A translated sentence with `{address}` set in bold.
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

// The warning glyph of the none state's notice (Phone 1); decorative.
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

// The person glyph beside the confirmed address (Tablet); decorative.
function PersonIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

// The cloud-off glyph of the When offline note (Phone 2); decorative.
function OfflineIcon() {
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
      <path d="M3 3l18 18M8 7a6 6 0 0 1 10 4h1a4 4 0 0 1 2 7.5M17 18H7a4 4 0 0 1-1-7.9" />
    </svg>
  );
}

// Word a failed request (a role="alert"): a malformed address, too many tries
// (DIRECTION §3.3), or the connection. Nothing names the address. Shared with
// the sign-in surface's *Add a recovery email* step (account.sign_in_two_doors).
export function requestErrorCopy(error) {
  if (error instanceof AuthError) {
    if (error.kind === 'bad_request') return t('account.recoveryInvalid');
    if (error.kind === 'rate_limited') return t('account.rateLimited');
    if (error.kind === 'network') return t('account.errNetwork');
  }
  return t('account.errGeneric');
}

// A failed request in words (a role="alert"), with Try again when the
// connection was the cause.
export function RequestErrorNotice({ error, retryDisabled, onRetry }) {
  if (!error) return null;
  return (
    <div className="account-error-row">
      <p className="notice warn" role="alert">
        {requestErrorCopy(error)}
      </p>
      {error instanceof AuthError && error.kind === 'network' ? (
        <Button className="btn" isDisabled={retryDisabled} onPress={onRetry}>
          {t('account.retry')}
        </Button>
      ) : null}
    </div>
  );
}

// The recovery address field — its label, the hint below it and a failed
// request's alert — shared by this region and the sign-in surface's *Add a
// recovery email* step, which bring their own buttons (account.sign_in_two_doors
// Decision *The recovery step shares the region's request and field*).
export function RecoveryEmailField({ value, onChange, inputRef, error, retryDisabled, onRetry }) {
  return (
    <>
      <TextField className="field" value={value} onChange={onChange} type="email" isRequired>
        <Label>{t('account.recoveryLabel')}</Label>
        <Input
          ref={inputRef}
          className="input"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <Text slot="description" className="t-small">
          {t('account.recoveryHint')}
        </Text>
      </TextField>
      <RequestErrorNotice error={error} retryDisabled={retryDisabled} onRetry={onRetry} />
    </>
  );
}

/**
 * @param {{
 *   recovery: { email: string|null, pending: string|null } | null,
 *   loadError: unknown,
 *   authClient: { requestRecoveryEmail: (email: string) => Promise<void> },
 *   online: boolean,
 *   onReload: () => void,
 *   focusRequest?: number,
 * }} props
 *   `recovery` is null until the screen has read it; `loadError` is the read's
 *   failure (worded, with Retry → `onReload`). `onReload` re-reads it after a
 *   request is accepted. `focusRequest` asks for the region (the banner's *Add
 *   one*, account.sign_in_two_doors): each new non-zero value scrolls it into
 *   view and focuses its field in the none state, or the region otherwise, once
 *   the address has been read.
 */
export default function RecoveryEmailRegion({ recovery, loadError, authClient, online, onReload, focusRequest = 0 }) {
  const headingId = useId();
  const sectionRef = useRef(null);
  const fieldRef = useRef(null);
  const focusedRequest = useRef(0);
  // Whether the field is open over a waiting or confirmed state (Use a different
  // address / Change). In the none state it is always open.
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // the failed request's AuthError, or null
  const lastRequest = useRef(null); // the address of the request a Retry re-sends
  const inFlight = useRef(false);

  const disabled = !online || busy;

  // The banner's *Add one*: bring the region into view and put focus where the
  // person can act — the field when there is none, the region otherwise. Held
  // until the address is read, so a request made as the screen opens lands too.
  const loaded = recovery != null || loadError != null;
  const none = !loadError && recovery != null && recoveryEmailState(recovery) === 'none';
  useEffect(() => {
    if (!focusRequest || focusedRequest.current === focusRequest || !loaded) return;
    focusedRequest.current = focusRequest;
    sectionRef.current?.scrollIntoView?.({ block: 'start' });
    if (none && fieldRef.current) fieldRef.current.focus();
    else sectionRef.current?.focus();
  }, [focusRequest, loaded, none]);

  const request = async (value) => {
    const target = value.trim();
    if (!target || inFlight.current || !online) return;
    inFlight.current = true;
    lastRequest.current = target;
    setBusy(true);
    setError(null);
    try {
      await authClient.requestRecoveryEmail(target);
      setEditing(false);
      setAddress('');
      onReload();
    } catch (err) {
      setError(err);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const submit = (event) => {
    event?.preventDefault?.();
    request(address);
  };

  const closeField = () => {
    setEditing(false);
    setAddress('');
    setError(null);
  };

  const errorNotice = (
    <RequestErrorNotice
      error={error}
      retryDisabled={disabled}
      onRetry={() => request(lastRequest.current ?? '')}
    />
  );

  let body;
  if (loadError) {
    body = (
      <div className="account-error-row">
        <p className="notice warn" role="alert">
          {loadError instanceof AuthError && loadError.kind === 'network'
            ? t('account.errNetwork')
            : t('account.errGeneric')}
        </p>
        <Button className="btn" onPress={onReload}>
          {t('account.retry')}
        </Button>
      </div>
    );
  } else if (!recovery) {
    body = (
      <p className="t-small account-note" role="status">
        {t('account.loading')}
      </p>
    );
  } else {
    const state = recoveryEmailState(recovery);
    const confirmed = state === 'confirmed' || state === 'confirmed+waiting';
    const waiting = state === 'waiting' || state === 'confirmed+waiting';
    const fieldOpen = state === 'none' || editing;

    const field = (
      <form className="account-form account-recovery-form" onSubmit={submit}>
        <RecoveryEmailField
          value={address}
          onChange={setAddress}
          inputRef={fieldRef}
          error={error}
          retryDisabled={disabled}
          onRetry={() => request(lastRequest.current ?? '')}
        />
        <Button type="submit" className="btn primary block" isDisabled={disabled}>
          {t('account.recoverySend')}
        </Button>
        {state !== 'none' ? (
          <Button className="btn quiet block" isDisabled={busy} onPress={closeField}>
            {t('account.cancel')}
          </Button>
        ) : null}
      </form>
    );

    body = (
      <>
        {state === 'none' ? (
          <div className="card pad account-recovery-card">
            <span className="account-recovery-badges">
              <span className="badge unsaved dot">{t('account.recoveryNone')}</span>
            </span>
            <div className="notice unsaved account-recovery-warn">
              <WarnIcon />
              <span>{t('account.recoveryNoneWarn')}</span>
            </div>
            {field}
          </div>
        ) : null}

        {confirmed ? (
          <div className="card pad account-recovery-card">
            <div className="account-recovery-confirmed">
              <PersonIcon />
              <span className="grow account-recovery-address">
                <span className="t-h2">{recovery.email}</span>
                <span className="t-small">{t('account.recoveryConfirmedBody')}</span>
              </span>
              <span className="badge ok dot">{t('account.recoveryConfirmed')}</span>
              {!fieldOpen && !waiting ? (
                <Button
                  className="btn"
                  isDisabled={disabled}
                  onPress={() => {
                    setError(null);
                    setEditing(true);
                  }}
                >
                  {t('account.recoveryChange')}
                </Button>
              ) : null}
            </div>
            <p className="t-small">{t('account.recoveryChangeHint')}</p>
            {fieldOpen && !waiting ? field : null}
          </div>
        ) : null}

        {waiting ? (
          <div className="card pad account-recovery-card">
            <span className="account-recovery-badges">
              <span className="badge dot">{t('account.recoveryWaiting')}</span>
            </span>
            <div className="notice accent account-recovery-sent">
              <span>{withAddress('account.recoverySent', recovery.pending)}</span>
              <span className="t-small">
                {recovery.email
                  ? withAddress('account.recoveryOnceKept', recovery.email)
                  : t('account.recoveryOnceNone')}
              </span>
            </div>
            {fieldOpen ? (
              field
            ) : (
              <>
                {errorNotice}
                <Button
                  className="btn block"
                  isDisabled={disabled}
                  onPress={() => request(recovery.pending)}
                >
                  {t('account.recoverySendAgain')}
                </Button>
                <Button
                  className="btn quiet block"
                  isDisabled={disabled}
                  onPress={() => {
                    setError(null);
                    setEditing(true);
                  }}
                >
                  {t('account.recoveryDifferent')}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <section className="account-recovery" aria-labelledby={headingId} ref={sectionRef} tabIndex={-1}>
      <h3 className="t-h3 account-section" id={headingId}>
        {t('account.recoveryHeading')}
      </h3>
      {body}
      {!online ? (
        <div className="notice account-recovery-offline" role="status">
          <span className="account-recovery-offline-head">
            <OfflineIcon />
            <b>{t('account.recoveryOfflineHead')}</b>
          </span>
          <span className="t-small">{t('account.recoveryOffline')}</span>
        </div>
      ) : null}
    </section>
  );
}
